// pages/api/notifications/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };

const markReadSchema = z.object({
  ids: z.array(z.string().uuid()).max(100).optional(),
}).strict();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'GET')   return withAuth(req, res, getNotifications);
  if (req.method === 'PATCH') return withAuth(req, res, markRead);
  return res.status(405).end();
}

async function getNotifications(req: AuthedRequest, res: NextApiResponse) {
  const cursor    = req.query.cursor as string | undefined;
  const PAGE_SIZE = 30;

  const notifications = await prisma.notification.findMany({
    where:   { userId: req.user.userId },
    take:    PAGE_SIZE + 1,
    cursor:  cursor ? { id: cursor } : undefined,
    skip:    cursor ? 1 : 0,
    orderBy: { createdAt: 'desc' },
  });

  const hasMore    = notifications.length > PAGE_SIZE;
  const items      = hasMore ? notifications.slice(0, -1) : notifications;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  // Efficient unread count using compound index (userId, isRead)
  const unreadCount = await prisma.notification.count({
    where: { userId: req.user.userId, isRead: false },
  });

  return apiResponse(res, { notifications: items, nextCursor, hasMore, unreadCount });
}

async function markRead(req: AuthedRequest, res: NextApiResponse) {
  const parsed = markReadSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const { ids } = parsed.data;

  if (ids && ids.length > 0) {
    // Always filter by userId to prevent marking other users' notifications
    await prisma.notification.updateMany({
      where: { id: { in: ids }, userId: req.user.userId },
      data:  { isRead: true, readAt: new Date() },
    });
  } else {
    // Mark all as read
    await prisma.notification.updateMany({
      where: { userId: req.user.userId, isRead: false },
      data:  { isRead: true, readAt: new Date() },
    });
  }

  return apiResponse(res, { updated: true });
}
