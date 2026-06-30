// pages/api/admin/cleanup.ts — daily DB cleanup cron endpoint
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { withAdmin, apiResponse, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { logger } from '@/lib/logger';

export const config = { api: { bodyParser: { sizeLimit: '1kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Allow internal cron via secret header (no JWT needed for scheduled job)
  const cronSecret = req.headers['x-cron-secret'];
  if (cronSecret && cronSecret === process.env.CRON_SECRET) {
    return runCleanup(res);
  }

  if (!(await apiRateLimit(req, res))) return;
  return withAdmin(req, res, (_req: AuthedRequest) => runCleanup(res));
}

async function runCleanup(res: NextApiResponse) {
  const now           = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30  * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90  * 24 * 60 * 60 * 1000);
  const sixMonthsAgo  = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

  logger.info('Running scheduled cleanup');

  const [sessions, notifications, stories, offers] = await Promise.all([
    prisma.userSession.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.notification.deleteMany({ where: { isRead: true, createdAt: { lt: ninetyDaysAgo } } }),
    prisma.story.deleteMany({ where: { expiresAt: { lt: thirtyDaysAgo } } }),
    prisma.butcherOffer.deleteMany({ where: { validUntil: { lt: thirtyDaysAgo } } }),
  ]);

  const stats = {
    expiredSessions:  sessions.count,
    oldNotifications: notifications.count,
    expiredStories:   stories.count,
    expiredOffers:    offers.count,
  };

  logger.info({ stats }, 'Cleanup complete');
  return apiResponse(res, stats);
}
