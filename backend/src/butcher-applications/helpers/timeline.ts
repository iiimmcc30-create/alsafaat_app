import type { ButcherApplicationTimelineAction, Prisma } from '@prisma/client';
import type { TransactionClient } from './transaction';

export type AppendTimelineParams = {
  applicationId: string;
  action: ButcherApplicationTimelineAction;
  createdBy: string;
  comment?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function appendTimelineEvent(
  tx: TransactionClient,
  params: AppendTimelineParams,
): Promise<void> {
  await tx.butcherApplicationTimelineEvent.create({
    data: {
      applicationId: params.applicationId,
      action: params.action,
      createdBy: params.createdBy,
      comment: params.comment ?? null,
      metadata: params.metadata ?? {},
    },
  });
}

export async function appendTimelineEvents(
  tx: TransactionClient,
  events: AppendTimelineParams[],
): Promise<void> {
  for (const event of events) {
    await appendTimelineEvent(tx, event);
  }
}
