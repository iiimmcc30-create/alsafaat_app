// src/workers/index.ts
// FIX: distributed cron lock (prevents duplicate runs across worker instances)
//      atomic fee check with proper transaction
import { Worker } from 'bullmq';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import { getRedis } from '@/lib/redis';
import type { NotificationJob, EmailJob, PushJob, FeeCheckJob } from '@/lib/queue';

// FIX: workers use DB 1 (same as queues) — not DB 0 (app cache)
const connection = {
  host:     process.env.REDIS_HOST || 'localhost',
  port:     parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db:       1,
};

// ─── Firebase init ────────────────────────────────────────────────────────────
if (!admin.apps.length && process.env.FIREBASE_PROJECT_ID) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

// ─── Email transporter ────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  pool: true, // reuse connections
  maxConnections: 3,
});

// ─── Worker: notifications ────────────────────────────────────────────────────
const notificationWorker = new Worker<NotificationJob>(
  'notifications',
  async (job) => {
    const { userId, type, titleAr, bodyAr, data } = job.data;
    await prisma.notification.create({
      data: { userId, type: type as any, titleAr, bodyAr, data: data || {} },
    });
  },
  { connection, concurrency: 10 }
);

// ─── Worker: push notifications ───────────────────────────────────────────────
const pushWorker = new Worker<PushJob>(
  'push-notifications',
  async (job) => {
    if (!admin.apps.length) return; // Firebase not configured
    const { fcmToken, titleAr, bodyAr, data } = job.data;

    try {
      await admin.messaging().send({
        token:        fcmToken,
        notification: { title: titleAr, body: bodyAr },
        data:         data || {},
        android:      { priority: 'high', notification: { sound: 'default' } },
        apns:         { payload: { aps: { sound: 'default', badge: 1 } } },
      });
    } catch (err: any) {
      if (err.code === 'messaging/registration-token-not-registered') {
        await prisma.user.updateMany({ where: { fcmToken }, data: { fcmToken: null } });
        return; // Don't retry
      }
      throw err;
    }
  },
  { connection, concurrency: 5 }
);

// ─── Worker: emails ───────────────────────────────────────────────────────────
const emailWorker = new Worker<EmailJob>(
  'emails',
  async (job) => {
    const { to, subject, template, variables } = job.data;
    const templates: Record<string, string> = {
      welcome:            `مرحباً بك في الصفاة، ${variables.name}! حسابك جاهز.`,
      fee_reminder:       `تذكير: لديك رسوم معلقة ${variables.amount} ريال مستحقة بتاريخ ${variables.dueDate}.`,
      order_update:       `تحديث طلبك: ${variables.status}`,
      subscription_renew: `تجديد اشتراكك: ${variables.plan} - ${variables.amount} ريال`,
      email_verification: `رمز التحقق: <strong>${variables.code}</strong> (صالح 10 دقائق)`,
    };

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@safat.app',
      to,
      subject,
      html: `<div dir="rtl" style="font-family:sans-serif;max-width:600px;margin:0 auto">${templates[template] || variables.body || subject}</div>`,
    });
  },
  { connection, concurrency: 3 }
);

// ─── Worker: fee checks ───────────────────────────────────────────────────────
const feeCheckWorker = new Worker<FeeCheckJob>(
  'fee-checks',
  async (job) => {
    const { listingFeeId, userId, amount } = job.data;

    // FIX: atomic transaction — check and update in one operation
    await prisma.$transaction(async (tx) => {
      const fee = await tx.listingFee.findUnique({
        where:  { id: listingFeeId },
        select: { status: true, dueDate: true, listingId: true },
      });

      if (!fee || fee.status !== 'pending') return; // Already paid or waived

      if (new Date() > fee.dueDate) {
        await tx.listingFee.update({
          where: { id: listingFeeId },
          data:  { status: 'overdue' },
        });
        await tx.listing.update({
          where: { id: fee.listingId },
          data:  { status: 'pending_fee' },
        });
        await tx.notification.create({
          data: {
            userId,
            type:    'fee_due',
            titleAr: 'رسوم متأخرة',
            bodyAr:  `رسوم إعلانك (${amount} ريال) متأخرة. سيُوقف الإعلان حتى السداد.`,
            data:    { feeId: listingFeeId, amount: String(amount) },
          },
        });
        logger.warn({ listingFeeId, userId }, 'Fee marked overdue');
      }
    });
  },
  { connection, concurrency: 5 }
);

// ─── Worker event logging ─────────────────────────────────────────────────────
[notificationWorker, pushWorker, emailWorker, feeCheckWorker].forEach((w) => {
  w.on('completed', (job) => logger.debug({ queue: w.name, jobId: job.id }, 'Job done'));
  w.on('failed', (job, err) => logger.error({ queue: w.name, jobId: job?.id, err: err.message }, 'Job failed'));
  w.on('error', (err) => logger.error({ queue: w.name, err: err.message }, 'Worker error'));
});

logger.info('🔧 Workers started');

// ─── Cron jobs (all with distributed lock) ───────────────────────────────────
import { getFeeCheckQueue } from '@/lib/queue';
import axios from 'axios';

async function withLock(key: string, ttl: number, fn: () => Promise<void>): Promise<void> {
  const redis = getRedis();
  const acquired = await redis.set(key, '1', 'EX', ttl, 'NX');
  if (!acquired) {
    logger.debug({ key }, 'Cron lock not acquired — another instance running');
    return;
  }
  try {
    await fn();
  } catch (err) {
    logger.error({ err, key }, 'Cron job error');
  }
  // Lock expires automatically after ttl seconds
}

async function runFeeCheckCron() {
  const redis = getRedis();
  const lockKey  = 'cron:fee_check:lock';
  const lockTTL  = 120; // seconds — longer than the job itself

  // Atomic SET NX EX — only succeeds on one instance
  const acquired = await redis.set(lockKey, '1', 'EX', lockTTL, 'NX');
  if (!acquired) {
    logger.debug('Fee check cron: lock not acquired, another worker is running it');
    return;
  }

  try {
    logger.info('Running daily fee check cron');
    const overdueFees = await prisma.listingFee.findMany({
      where:  { status: 'pending', dueDate: { lt: new Date() } },
      select: { id: true, userId: true, commission: true },
      take:   1000, // safety limit
    });

    if (overdueFees.length > 0) {
      // Bulk add to queue with deduplication
      await Promise.all(
        overdueFees.map((fee) =>
          getFeeCheckQueue().add(
            'check',
            { listingFeeId: fee.id, userId: fee.userId, amount: fee.commission },
            { jobId: `fee:${fee.id}`, attempts: 3 } // jobId deduplicates
          )
        )
      );
      logger.info({ count: overdueFees.length }, 'Fee check jobs queued');
    }
  } catch (err) {
    logger.error({ err }, 'Fee check cron error');
  }
  // Lock expires automatically after lockTTL seconds
}

const APP_URL = process.env.APP_URL || 'http://localhost:3001';

// Track last-run dates to avoid re-running in same window
const lastRun: Record<string, string> = {};

function shouldRun(key: string, hour: number): boolean {
  const now      = new Date();
  const today    = now.toISOString().slice(0, 10);
  const currHour = now.getHours();
  if (currHour === hour && lastRun[key] !== today) {
    lastRun[key] = today;
    return true;
  }
  return false;
}

setInterval(async () => {
  // 09:00 — fee overdue check
  if (shouldRun('fee_check', 9)) {
    await runFeeCheckCron();
  }

  // 03:00 — database cleanup (expired sessions, old notifications, etc.)
  if (shouldRun('db_cleanup', 3)) {
    await withLock('cron:db_cleanup:lock', 300, async () => {
      logger.info('Running daily database cleanup');
      try {
        await axios.post(
          `${APP_URL}/api/admin/cleanup`,
          {},
          { headers: { 'x-cron-secret': process.env.CRON_SECRET || '' }, timeout: 30000 }
        );
        logger.info('Database cleanup triggered via API');
      } catch (err: any) {
        logger.error({ err: err.message }, 'DB cleanup cron failed');
      }
    });
  }
}, 60 * 60 * 1000); // check every hour
