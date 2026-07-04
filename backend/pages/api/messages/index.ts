// pages/api/messages/index.ts
// GET  /api/messages — list message threads for current user
// POST /api/messages — send a message (creates thread if needed)
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { logger } from '@/lib/logger';
import { notifyUser } from '@/lib/notifications';

const sendMessageSchema = z.object({
  receiverId: z.string().uuid(),
  text:       z.string().max(2000).optional(),
  imageUrl:   z.string().url().optional(),
  orderId:    z.string().uuid().optional(),
}).strict();

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'GET')  return withAuth(req, res, getThreads);
  if (req.method === 'POST') return withAuth(req, res, sendMessage);
  return res.status(405).end();
}

// GET /api/messages — return all threads the current user participates in
async function getThreads(req: AuthedRequest, res: NextApiResponse) {
  const { userId } = req.user;

  const threads = await prisma.messageThread.findMany({
    where: {
      OR: [{ participant1: userId }, { participant2: userId }],
    },
    orderBy: { lastMessageAt: 'desc' },
    take: 50,
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          text: true,
          imageUrl: true,
          isRead: true,
          createdAt: true,
          senderId: true,
        },
      },
    },
  });

  // Get participant user IDs (the other participant)
  const otherIds = threads.map((t) =>
    t.participant1 === userId ? t.participant2 : t.participant1
  );

  const participants = await prisma.user.findMany({
    where: { id: { in: otherIds } },
    select: { id: true, displayName: true, arabicName: true, avatar: true, username: true, verified: true },
  });

  const participantMap = new Map(participants.map((p) => [p.id, p]));

  const unreadCounts = await prisma.message.groupBy({
    by: ['threadId'],
    where: {
      receiverId: userId,
      isRead: false,
      threadId: { in: threads.map((t) => t.id) },
    },
    _count: { id: true },
  });
  const unreadMap = new Map(unreadCounts.map((u) => [u.threadId, u._count.id]));

  const result = threads.map((t) => {
    const otherId = t.participant1 === userId ? t.participant2 : t.participant1;
    const other = participantMap.get(otherId);
    const lastMsg = t.messages[0];
    return {
      id: t.id,
      participant: other ?? null,
      lastMessage: lastMsg?.text || (lastMsg?.imageUrl ? '[صورة]' : null),
      lastMessageAt: t.lastMessageAt,
      unread: unreadMap.get(t.id) ?? 0,
      isMine: lastMsg?.senderId === userId,
    };
  });

  return apiResponse(res, result);
}

// POST /api/messages — send a message
async function sendMessage(req: AuthedRequest, res: NextApiResponse) {
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const { receiverId, text, imageUrl, orderId } = parsed.data;
  const senderId = req.user.userId;

  if (!text && !imageUrl) {
    return apiError(res, 400, 'empty_message', 'يجب إرسال نص أو صورة');
  }

  if (receiverId === senderId) {
    return apiError(res, 400, 'invalid_action', 'لا يمكنك مراسلة نفسك');
  }

  // Check receiver exists
  const receiver = await prisma.user.findUnique({
    where: { id: receiverId },
    select: { id: true },
  });
  if (!receiver) return apiError(res, 404, 'not_found', 'المستخدم غير موجود');

  // Canonical thread order (alphabetical by id for uniqueness)
  const [p1, p2] = [senderId, receiverId].sort();

  // Upsert thread
  const thread = await prisma.messageThread.upsert({
    where: { participant1_participant2: { participant1: p1, participant2: p2 } },
    update: { lastMessageAt: new Date() },
    create: { participant1: p1, participant2: p2 },
  });

  const message = await prisma.message.create({
    data: {
      threadId: thread.id,
      senderId,
      receiverId,
      text,
      imageUrl,
      orderId,
    },
    include: {
      sender: { select: { id: true, displayName: true, arabicName: true, avatar: true } },
    },
  });

  const senderName =
    message.sender.arabicName || message.sender.displayName || req.user.username || 'مستخدم';
  void notifyUser({
    userId:  receiverId,
    type:    'new_message',
    titleAr: senderName,
    bodyAr:  text?.trim() || 'أرسل صورة',
    data: {
      threadId: thread.id,
      messageId: message.id,
      senderId,
      actorId: senderId,
      actorAvatar: message.sender.avatar,
      ...(orderId ? { orderId } : {}),
    },
  });

  logger.info({ messageId: message.id, senderId, receiverId }, 'Message sent');
  return apiResponse(res, { message, threadId: thread.id }, 201);
}
