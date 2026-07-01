import {
  ADMIN_PAGE_SIZE_DEFAULT,
  ADMIN_PAGE_SIZE_MAX,
} from '../constants';
import {
  countSubmittedApplications,
  getApplicationByIdOrThrow,
  listAdminApplications,
  provisionButcherFromApplication,
  updateApplicationStatus,
} from '../repositories/application.repository';
import { approveUploadedDocuments } from '../repositories/document.repository';
import {
  runInTransaction,
  assertUserHasNoButcher,
} from '../helpers/transaction';
import { appendTimelineEvent } from '../helpers/timeline';
import {
  assertApprovableStatus,
  assertRejectableStatus,
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

function resolveAdminLimit(limit?: number): number {
  if (!limit) return ADMIN_PAGE_SIZE_DEFAULT;
  return Math.min(Math.max(limit, 1), ADMIN_PAGE_SIZE_MAX);
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
      return await runInTransaction(async (tx) => {
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
          };
        }

        assertApprovableStatus(existing.status);
        await assertUserHasNoButcher(tx, existing.userId);

        const now = new Date();
        const butcher = await provisionButcherFromApplication(tx, existing);

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
        };
      });
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

    return runInTransaction(async (tx) => {
      const existing = await getApplicationByIdOrThrow(applicationId, tx);
      assertRejectableStatus(existing.status);

      const now = new Date();
      const updated = await updateApplicationStatus(tx, applicationId, {
        status: 'REJECTED',
        rejectedAt: now,
        rejectionReason: input.rejectionReason.trim(),
      });

      await appendTimelineEvent(tx, {
        applicationId,
        action: timelineActionForTransition('REJECTED'),
        createdBy: adminUserId,
        comment: input.comment ?? null,
        metadata: { rejectionReason: input.rejectionReason.trim() },
      });

      return toApplicationDetail(updated, {
        includeAdminFields: true,
        includeUser: true,
      });
    });
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

      const event = await tx.butcherApplicationTimelineEvent.create({
        data: {
          applicationId,
          action: 'COMMENT',
          createdBy: adminUserId,
          comment: input.comment.trim(),
          metadata: {},
        },
        include: {
          actor: { select: { id: true, username: true } },
        },
      });

      return toTimelineEventDto(event);
    });
  }
}

export const butcherApplicationAdminService = new ButcherApplicationAdminService();
