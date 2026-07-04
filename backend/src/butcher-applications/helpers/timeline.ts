import type { ButcherApplicationTimelineAction, Prisma } from '@prisma/client';
import type { TransactionClient } from './transaction';

export type AppendTimelineParams = {
  applicationId: string;
  action: ButcherApplicationTimelineAction;
  createdBy: string;
  comment?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export type TimelineEventWithActor = Prisma.ButcherApplicationTimelineEventGetPayload<{
  include: { actor: { select: { id: true; username: true } } };
}>;

export async function appendTimelineEvent(
  tx: TransactionClient,
  params: AppendTimelineParams,
): Promise<TimelineEventWithActor> {
  return tx.butcherApplicationTimelineEvent.create({
    data: {
      applicationId: params.applicationId,
      action: params.action,
      createdBy: params.createdBy,
      comment: params.comment ?? null,
      metadata: params.metadata ?? {},
    },
    include: {
      actor: { select: { id: true, username: true } },
    },
  });
}
