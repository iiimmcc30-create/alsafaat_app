import type { Prisma } from '@prisma/client';
import {
  ADMIN_PAGE_SIZE_DEFAULT,
  ADMIN_PAGE_SIZE_MAX,
} from '../constants';
import {
  countSubmittedApplications,
  createButcher,
  getApplicationByIdOrThrow,
  listAdminApplications,
  updateApplicationStatus,
  type ApplicationEntity,
} from '../repositories/application.repository';
import { approveUploadedDocuments } from '../repositories/document.repository';
import {
  runInTransaction,
  assertUserHasNoButcher,
} from '../helpers/transaction';
import { appendTimelineEvent } from '../helpers/timeline';
import {
  assertTransition,
  timelineActionForTransition,
} from '../helpers/stateTransitions';
import { buildPaginatedResult } from '../helpers/validation';
import {
  toAdminApplicationSummary,
  toApplicationDetail,
  toTimelineEventDto,
} from '../mappers';
import {
  ButcherApplicationError,
  mapPrismaUniqueViolation,
} from '../errors';
import type {
  AdminApplicationSummaryDto,
  AdminListQuery,
  ApproveInput,
  ApproveResultDto,
  ApplicationDetailDto,
  CommentInput,
  PaginatedResult,
  RejectInput,
  TimelineEventDto,
} from '../types';
import { logger } from '@/lib/logger';
import {
  notifyApplicationApproved,
  notifyApplicationRejected,
} from '../notifications';

function resolveAdminLimit(limit?: number): number {
  if (!limit) return ADMIN_PAGE_SIZE_DEFAULT;
  return Math.min(Math.max(limit, 1), ADMIN_PAGE_SIZE_MAX);
}

/** Maps an approved application snapshot into butcher persistence input (AdminService-owned). */
export function buildButcherCreateInput(
  application: ApplicationEntity,
): Prisma.ButcherUncheckedCreateInput {
  return {
    userId: application.userId,
    nameAr: application.nameAr!,
    nameEn: application.nameEn!,
    country: application.country!,
    city: application.city!,
    cityAr: application.cityAr!,
    address: application.address!,
    addressAr: application.addressAr!,
    lat: application.lat,
    lng: application.lng,
    phone: application.shopPhone!,
    bioAr: application.bioAr,
    bioEn: application.bioEn,
    specialties: application.specialties,
    commercialReg: application.commercialReg,
    openTime: application.openTime,
    closeTime: application.closeTime,
    closedDays: [],
    type: 'regular',
    sourceApplicationId: application.id,
  };
}

export class ButcherApplicationAdminService {
  async listApplications(
    query: AdminListQuery,
  ): Promise<
    PaginatedResult<AdminApplicationSummaryDto> & { counts: { submitted: number } }
  > {
    const limit = resolveAdminLimit(query.limit);
    const rows = await listAdminApplications(query, limit);
    const page = buildPaginatedResult(rows, limit);
    const submitted = await countSubmittedApplications();

    return {
      items: page.items.map(toAdminApplicationSummary),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      counts: { submitted },
    };
  }

  async getApplication(applicationId: string): Promise<ApplicationDetailDto> {
    const application = await getApplicationByIdOrThrow(applicationId);
    return toApplicationDetail(application, {
      includeAdminFields: true,
      includeUser: true,
    });
  }

  async approveApplication(
    adminUserId: string,
    applicationId: string,
    input: ApproveInput = {},
  ): Promise<ApproveResultDto> {
    try {
      const result = await runInTransaction(async (tx) => {
        const existing = await getApplicationByIdOrThrow(applicationId, tx);

        if (existing.status === 'APPROVED' && existing.sourcedButcher) {
          return {
            application: toApplicationDetail(existing, {
              includeAdminFields: true,
              includeUser: true,
            }),
            butcher: {
              id: existing.sourcedButcher.id,
              sourceApplicationId: applicationId,
            },
            isNewApproval: false as const,
          };
        }

        assertTransition(existing.status, 'APPROVED');
        await assertUserHasNoButcher(tx, existing.userId);

        const now = new Date();
        const butcher = await createButcher(tx, buildButcherCreateInput(existing));

        await approveUploadedDocuments(tx, applicationId, adminUserId, now);

        const updated = await updateApplicationStatus(tx, applicationId, {
          status: 'APPROVED',
          approvedAt: now,
        });

        await appendTimelineEvent(tx, {
          applicationId,
          action: timelineActionForTransition('APPROVED'),
          createdBy: adminUserId,
          comment: input.comment ?? null,
          metadata: { butcherId: butcher.id },
        });

        return {
          application: toApplicationDetail(updated, {
            includeAdminFields: true,
            includeUser: true,
          }),
          butcher,
          isNewApproval: true as const,
        };
      });

      if (result.isNewApproval) {
        void notifyApplicationApproved(
          result.application,
          result.application.user!.id,
          result.butcher.id,
        ).catch((err) =>
          logger.warn({ err, applicationId }, 'Approve notification side effect failed'),
        );
      }

      const { isNewApproval: _, ...approveResult } = result;
      return approveResult;
    } catch (err) {
      const mapped = mapPrismaUniqueViolation(err);
      if (mapped) throw mapped;
      throw err;
    }
  }

  async rejectApplication(
    adminUserId: string,
    applicationId: string,
    input: RejectInput,
  ): Promise<ApplicationDetailDto> {
    if (!input.rejectionReason?.trim()) {
      throw new ButcherApplicationError('REJECTION_REASON_REQUIRED');
    }

    const rejectionReason = input.rejectionReason.trim();

    const result = await runInTransaction(async (tx) => {
      const existing = await getApplicationByIdOrThrow(applicationId, tx);
      assertTransition(existing.status, 'REJECTED');

      const now = new Date();
      const updated = await updateApplicationStatus(tx, applicationId, {
        status: 'REJECTED',
        rejectedAt: now,
        rejectionReason,
      });

      await appendTimelineEvent(tx, {
        applicationId,
        action: timelineActionForTransition('REJECTED'),
        createdBy: adminUserId,
        comment: input.comment ?? null,
        metadata: { rejectionReason },
      });

      return toApplicationDetail(updated, {
        includeAdminFields: true,
        includeUser: true,
      });
    });

    void notifyApplicationRejected(result, result.user!.id).catch((err) =>
      logger.warn({ err, applicationId }, 'Reject notification side effect failed'),
    );

    return result;
  }

  async addComment(
    adminUserId: string,
    applicationId: string,
    input: CommentInput,
  ): Promise<TimelineEventDto> {
    if (!input.comment?.trim()) {
      throw new ButcherApplicationError('APPLICATION_INCOMPLETE', { missing: ['comment'] });
    }

    return runInTransaction(async (tx) => {
      await getApplicationByIdOrThrow(applicationId, tx);

      const event = await appendTimelineEvent(tx, {
        applicationId,
        action: 'COMMENT',
        createdBy: adminUserId,
        comment: input.comment.trim(),
      });

      return toTimelineEventDto(event);
    });
  }
}

export const butcherApplicationAdminService = new ButcherApplicationAdminService();
