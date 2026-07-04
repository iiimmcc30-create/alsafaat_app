// src/lib/queue.ts
// BullMQ uses its own Redis connection (DB 1) — separate from app cache (DB 0)
import { randomUUID } from 'crypto';
import { Queue, QueueEvents } from 'bullmq';
import { logger } from './logger';
import { isRedisEnabled } from './redis';
import prisma from './prisma';

const connection = {
  host:     process.env.REDIS_HOST || 'localhost',
  port:     parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db:       1,
};

const defaultOpts = {
  connection,
  defaultJobOptions: { removeOnComplete: 100, removeOnFail: 200 },
};

let notificationQueue: Queue | null = null;
let emailQueue: Queue | null = null;
let feeCheckQueue: Queue | null = null;
let pushQueue: Queue | null = null;
let imageQueue: Queue | null = null;

function getNotificationQueue(): Queue {
  if (!notificationQueue) {
    notificationQueue = new Queue('notifications', defaultOpts);
  }
  return notificationQueue;
}

function getEmailQueue(): Queue {
  if (!emailQueue) {
    emailQueue = new Queue('emails', { ...defaultOpts, defaultJobOptions: { removeOnComplete: 50, removeOnFail: 100 } });
  }
  return emailQueue;
}

function getFeeCheckQueue(): Queue {
  if (!feeCheckQueue) {
    feeCheckQueue = new Queue('fee-checks', { ...defaultOpts, defaultJobOptions: { removeOnComplete: 50, removeOnFail: 100 } });
  }
  return feeCheckQueue;
}

function getPushQueue(): Queue {
  if (!pushQueue) {
    pushQueue = new Queue('push-notifications', { ...defaultOpts, defaultJobOptions: { removeOnComplete: 50, removeOnFail: 100 } });
  }
  return pushQueue;
}

function getImageQueue(): Queue {
  if (!imageQueue) {
    imageQueue = new Queue('image-processing', { ...defaultOpts, defaultJobOptions: { removeOnComplete: 20, removeOnFail: 50 } });
  }
  return imageQueue;
}

/** @deprecated Import addNotification() instead — lazy queue access */
export function getNotificationQueueForHealth(): Queue | null {
  return isRedisEnabled() ? getNotificationQueue() : null;
}

// ─── Job types ────────────────────────────────────────────────────────────────
export type NotificationJob = {
  userId:  string;
  type:    string;
  titleAr: string;
  bodyAr:  string;
  data?:   Record<string, string>;
};

export type EmailJob = {
  to:        string;
  subject:   string;
  template:  string;
  variables: Record<string, string>;
};

export type PushJob = {
  fcmToken: string;
  titleAr:  string;
  bodyAr:   string;
  data?:    Record<string, string>;
};

export type FeeCheckJob = {
  listingFeeId: string;
  userId:       string;
  amount:       number;
};

export type ImageJob = {
  fileKey:    string;
  bucket:     string;
  operations: ('resize' | 'webp' | 'thumbnail')[];
};

/** Best-effort FCM enqueue after a notification row exists (never throws). */
export async function enqueuePushAfterPersist(params: {
  userId:         string;
  notificationId: string;
  type:           string;
  titleAr:        string;
  bodyAr:         string;
  data:           Record<string, string>;
}): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: params.userId },
      select: { fcmToken: true },
    });
    if (!user?.fcmToken) return;

    await addPush({
      fcmToken: user.fcmToken,
      titleAr:  params.titleAr,
      bodyAr:   params.bodyAr,
      data:     params.data,
    });
  } catch (err) {
    logger.warn(
      { err, userId: params.userId, notificationId: params.notificationId },
      'Failed to enqueue push after notification persist',
    );
  }
}

/** Persist notification first, then best-effort push — shared by worker and no-Redis fallback. */
export async function persistNotificationAndEnqueuePush(job: NotificationJob): Promise<string> {
  const notificationId = randomUUID();
  const data: Record<string, string> = {
    ...(job.data || {}),
    notificationId,
  };

  await prisma.notification.create({
    data: {
      id:      notificationId,
      userId:  job.userId,
      type:    job.type as any,
      titleAr: job.titleAr,
      bodyAr:  job.bodyAr,
      data,
    },
  });

  await enqueuePushAfterPersist({
    userId:         job.userId,
    notificationId,
    type:           job.type,
    titleAr:        job.titleAr,
    bodyAr:         job.bodyAr,
    data:           { ...data, type: job.type },
  });

  return notificationId;
}

async function writeNotificationDirect(job: NotificationJob) {
  await persistNotificationAndEnqueuePush(job);
}

// ─── Add job helpers ──────────────────────────────────────────────────────────
export async function addNotification(job: NotificationJob) {
  if (!isRedisEnabled()) {
    await writeNotificationDirect(job).catch((err) =>
      logger.warn({ err }, 'Direct notification write failed (no Redis)')
    );
    return null;
  }
  return getNotificationQueue().add('create', job, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  });
}

export async function addEmail(job: EmailJob) {
  if (!isRedisEnabled()) return null;
  return getEmailQueue().add('send', job, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
}

export async function addPush(job: PushJob) {
  if (!isRedisEnabled()) return null;
  return getPushQueue().add('send', job, { attempts: 2 });
}

export async function scheduleFeeCheck(job: FeeCheckJob, delayMs: number) {
  if (!isRedisEnabled()) return null;
  return getFeeCheckQueue().add('check', job, {
    delay:    Math.max(0, delayMs),
    attempts: 2,
    jobId:    `fee:${job.listingFeeId}`,
  });
}

export async function addImageProcessing(job: ImageJob) {
  if (!isRedisEnabled()) return null;
  return getImageQueue().add('process', job, { attempts: 2 });
}

export { getFeeCheckQueue };

// ─── Queue event logging ──────────────────────────────────────────────────────
export function setupQueueLogging() {
  if (!isRedisEnabled()) return;
  const queues = [
    getNotificationQueue(),
    getEmailQueue(),
    getFeeCheckQueue(),
    getPushQueue(),
    getImageQueue(),
  ];
  for (const q of queues) {
    const events = new QueueEvents(q.name, { connection });
    events.on('completed', ({ jobId }) =>
      logger.debug({ queue: q.name, jobId }, 'Job completed')
    );
    events.on('failed', ({ jobId, failedReason }) =>
      logger.error({ queue: q.name, jobId, failedReason }, 'Job failed')
    );
  }
}
