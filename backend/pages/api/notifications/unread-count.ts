// pages/api/notifications/unread-count.ts
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { withAuth, apiResponse, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'GET') return withAuth(req, res, getUnreadCount);
  return res.status(405).end();
}

async function getUnreadCount(req: AuthedRequest, res: NextApiResponse) {
  const unreadCount = await prisma.notification.count({
    where: { userId: req.user.userId, isRead: false },
  });

  return apiResponse(res, { unreadCount });
}
