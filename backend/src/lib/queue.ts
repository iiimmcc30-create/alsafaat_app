// src/lib/queue.ts
// BullMQ uses its own Redis connection (DB 1) — separate from app cache (DB 0)
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

async function writeNotificationDirect(job: NotificationJob) {
  await prisma.notification.create({
    data: {
      userId:  job.userId,
      type:    job.type as any,
      titleAr: job.titleAr,
      bodyAr:  job.bodyAr,
      data:    job.data || {},
    },
  });
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
