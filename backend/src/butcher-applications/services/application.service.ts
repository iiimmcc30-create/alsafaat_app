import type { ApplicationSnapshotInput, UserListQuery } from '../types';
import {
  USER_PAGE_SIZE_DEFAULT,
  USER_PAGE_SIZE_MAX,
} from '../constants';
import {
  findButcherByUserId,
  findActiveApplicationByUserAndStatus,
  createApplication,
  findApplicationById,
  getApplicationByIdOrThrow,
  updateApplicationSnapshot,
  updateApplicationStatus,
  listUserApplications,
  type ApplicationEntity,
  type ApplicationSummaryEntity,
} from '../repositories/application.repository';
import {
  runInTransaction,
  assertNotModified,
  assertUserHasNoButcher,
  assertApplicationOwner,
} from '../helpers/transaction';
import { appendTimelineEvent } from '../helpers/timeline';
import {
  assertEditableStatus,
  assertSubmittableStatus,
  assertWithdrawableStatus,
  timelineActionForTransition,
} from '../helpers/stateTransitions';
import {
  validateSubmitSnapshot,
  validateRequiredDocuments,
  collectChangedFields,
  buildPaginatedResult,
} from '../helpers/validation';
import {
  toApplicationDetail,
  toApplicationSummaryFromEntity,
} from '../mappers';
import {
  ButcherApplicationError,
  mapPrismaUniqueViolation,
  isButcherApplicationError,
} from '../errors';
import type {
  ApplicationDetailDto,
  ApplicationSummaryDto,
  PaginatedResult,
  SubmitInput,
  WithdrawInput,
} from '../types';

function resolveUserLimit(limit?: number): number {
  if (!limit) return USER_PAGE_SIZE_DEFAULT;
  return Math.min(Math.max(limit, 1), USER_PAGE_SIZE_MAX);
}

export class ButcherApplicationUserService {
  async createDraft(
    userId: string,
    data: ApplicationSnapshotInput = {},
  ): Promise<ApplicationDetailDto> {
    try {
      return await runInTransaction(async (tx) => {
        await assertUserHasNoButcher(tx, userId);

        const draft = await findActiveApplicationByUserAndStatus(tx, userId, 'DRAFT');
        if (draft) throw new ButcherApplicationError('ACTIVE_DRAFT_EXISTS');

        const submitted = await findActiveApplicationByUserAndStatus(tx, userId, 'SUBMITTED');
        if (submitted) throw new ButcherApplicationError('ACTIVE_SUBMITTED_EXISTS');

        const application = await createApplication(tx, userId, data);

        await appendTimelineEvent(tx, {
          applicationId: application.id,
          action: 'CREATE',
          createdBy: userId,
          metadata: {
            fieldsProvided: Object.keys(data).filter(
              (k) => (data as Record<string, unknown>)[k] !== undefined,
            ),
          },
        });

        return toApplicationDetail(application);
      });
    } catch (err) {
      const mapped = mapPrismaUniqueViolation(err);
      if (mapped) throw mapped;
      throw err;
    }
  }

  async listApplications(
    userId: string,
    query: UserListQuery,
  ): Promise<PaginatedResult<ApplicationSummaryDto>> {
    const limit = resolveUserLimit(query.limit);
    const rows = await listUserApplications(userId, query, limit);
    const page = buildPaginatedResult(rows, limit);

    return {
      ...page,
      items: page.items.map((app) => toApplicationSummaryFromEntity(app)),
    };
  }

  async getApplication(userId: string, applicationId: string): Promise<ApplicationDetailDto> {
    const application = await getApplicationByIdOrThrow(applicationId);
    assertApplicationOwner(application.userId, userId);
    return toApplicationDetail(application);
  }

  async updateDraft(
    userId: string,
    applicationId: string,
    data: ApplicationSnapshotInput,
    expectedUpdatedAt?: Date | string,
  ): Promise<ApplicationDetailDto> {
    return runInTransaction(async (tx) => {
      const existing = await getApplicationByIdOrThrow(applicationId, tx);
      assertApplicationOwner(existing.userId, userId);
      assertEditableStatus(existing.status);
      assertNotModified(existing.updatedAt, expectedUpdatedAt);

      const changedFields = collectChangedFields(
        existing as unknown as Record<string, unknown>,
        data as Record<string, unknown>,
      );

      const updated = await updateApplicationSnapshot(tx, applicationId, data);

      if (changedFields.length > 0) {
        await appendTimelineEvent(tx, {
          applicationId,
          action: 'UPDATE',
          createdBy: userId,
          metadata: { changedFields },
        });
      }

      return toApplicationDetail(updated);
    });
  }

  async submitApplication(
    userId: string,
    applicationId: string,
    input: SubmitInput,
  ): Promise<ApplicationDetailDto> {
    if (!input.acceptedTerms || !input.confirmAccuracy) {
      throw new ButcherApplicationError('APPLICATION_INCOMPLETE', {
        missing: ['acceptedTerms', 'confirmAccuracy'],
      });
    }

    try {
      return await runInTransaction(async (tx) => {
        await assertUserHasNoButcher(tx, userId);

        const existing = await getApplicationByIdOrThrow(applicationId, tx);
        assertApplicationOwner(existing.userId, userId);
        assertSubmittableStatus(existing.status);

        validateSubmitSnapshot(existing);
        validateRequiredDocuments(existing);

        const now = new Date();
        const updated = await updateApplicationStatus(tx, applicationId, {
          status: 'SUBMITTED',
          submittedAt: now,
          acceptedTermsAt: now,
        });

        await appendTimelineEvent(tx, {
          applicationId,
          action: timelineActionForTransition('SUBMITTED'),
          createdBy: userId,
        });

        return toApplicationDetail(updated);
      });
    } catch (err) {
      const mapped = mapPrismaUniqueViolation(err);
      if (mapped) throw mapped;
      if (isButcherApplicationError(err)) throw err;
      throw err;
    }
  }

  async withdrawApplication(
    userId: string,
    applicationId: string,
    input: WithdrawInput = {},
  ): Promise<ApplicationDetailDto> {
    return runInTransaction(async (tx) => {
      const existing = await getApplicationByIdOrThrow(applicationId, tx);
      assertApplicationOwner(existing.userId, userId);
      assertWithdrawableStatus(existing.status);

      const now = new Date();
      const updated = await updateApplicationStatus(tx, applicationId, {
        status: 'WITHDRAWN',
        withdrawnAt: now,
      });

      await appendTimelineEvent(tx, {
        applicationId,
        action: timelineActionForTransition('WITHDRAWN'),
        createdBy: userId,
        comment: input.reason ?? null,
      });

      return toApplicationDetail(updated);
    });
  }

  async requireEditableApplication(
    userId: string,
    applicationId: string,
  ): Promise<ApplicationEntity> {
    const application = await getApplicationByIdOrThrow(applicationId);
    assertApplicationOwner(application.userId, userId);
    assertEditableStatus(application.status);
    return application;
  }
}

export const butcherApplicationUserService = new ButcherApplicationUserService();

export async function userHasButcherProfile(userId: string): Promise<boolean> {
  const butcher = await findButcherByUserId(userId);
  return Boolean(butcher);
}

export async function getApplicationIfOwned(
  userId: string,
  applicationId: string,
): Promise<ApplicationEntity> {
  const application = await findApplicationById(applicationId);
  if (!application) throw new ButcherApplicationError('APPLICATION_NOT_FOUND');
  assertApplicationOwner(application.userId, userId);
  return application;
}
