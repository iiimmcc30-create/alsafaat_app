// src/lib/notifications.ts
// Shared notification API — domain code should call notifyUser/notifyUsers only.
import { addNotification, type NotificationJob } from './queue';
import { logger } from './logger';

export type NotifyUserInput = {
  userId:  string;
  type:    string;
  titleAr: string;
  bodyAr:  string;
  data?:   Record<string, string | number | boolean | null | undefined>;
};

/** Coerce notification / FCM data values to strings (null/undefined omitted). */
export function stringifyNotificationData(
  data: Record<string, string | number | boolean | null | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    out[key] = String(value);
  }
  return out;
}

/** Enqueue an in-app notification via the shared BullMQ / direct-write pipeline. */
export async function notifyUser(input: NotifyUserInput): Promise<void> {
  try {
    const job: NotificationJob = {
      userId:  input.userId,
      type:    input.type,
      titleAr: input.titleAr,
      bodyAr:  input.bodyAr,
      data:    input.data ? stringifyNotificationData(input.data) : undefined,
    };
    await addNotification(job);
  } catch (err) {
    logger.warn(
      { err, userId: input.userId, type: input.type },
      'notifyUser failed',
    );
  }
}

/** Fan-out to multiple recipients; failures are isolated per user. */
export async function notifyUsers(
  userIds: string[],
  input: Omit<NotifyUserInput, 'userId'>,
): Promise<void> {
  if (userIds.length === 0) return;

  await Promise.allSettled(
    userIds.map((userId) => notifyUser({ ...input, userId })),
  );
}
