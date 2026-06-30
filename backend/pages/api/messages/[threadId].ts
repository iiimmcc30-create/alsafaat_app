// pages/api/messages/[threadId].ts
// GET /api/messages/[threadId] — load messages in a thread
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'GET') return withAuth(req, res, getMessages);
  return res.status(405).end();
}

async function getMessages(req: AuthedRequest, res: NextApiResponse) {
  const { threadId } = req.query as { threadId: string };
  const { userId } = req.user;
  const cursor = req.query.cursor as string | undefined;
  const PAGE_SIZE = 40;

  // Verify the user participates in this thread
  const thread = await prisma.messageThread.findFirst({
    where: {
      id: threadId,
      OR: [{ participant1: userId }, { participant2: userId }],
    },
    select: { id: true, participant1: true, participant2: true },
  });
  if (!thread) return apiError(res, 404, 'not_found', 'المحادثة غير موجودة');

  const messages = await prisma.message.findMany({
    where: { threadId },
    take: PAGE_SIZE + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    orderBy: { createdAt: 'desc' },
    include: {
      sender: { select: { id: true, displayName: true, arabicName: true, avatar: true } },
    },
  });

  const hasMore = messages.length > PAGE_SIZE;
  const items = hasMore ? messages.slice(0, -1) : messages;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  // Mark unread messages as read
  await prisma.message.updateMany({
    where: { threadId, receiverId: userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  return apiResponse(res, { messages: items.reverse(), nextCursor, hasMore });
}
