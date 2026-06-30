// pages/api/users/[id]/follow.ts
// POST /api/users/[id]/follow — toggle follow/unfollow
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { cacheDel } from '@/lib/redis';
import { addNotification } from '@/lib/queue';
import { logger } from '@/lib/logger';

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'POST') return withAuth(req, res, toggleFollow);
  return res.status(405).end();
}

async function toggleFollow(req: AuthedRequest, res: NextApiResponse) {
  const { id: targetId } = req.query as { id: string };
  const followerId = req.user.userId;

  if (targetId === followerId) {
    return apiError(res, 400, 'invalid_action', 'لا يمكنك متابعة نفسك');
  }

  // Check target user exists
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, arabicName: true },
  });
  if (!target) return apiError(res, 404, 'not_found', 'المستخدم غير موجود');

  // Toggle follow
  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId: targetId } },
  });

  if (existing) {
    // Unfollow
    await prisma.follow.delete({
      where: { followerId_followingId: { followerId, followingId: targetId } },
    });
    await cacheDel(`user:${targetId}`);
    logger.info({ followerId, targetId }, 'User unfollowed');
    return apiResponse(res, { following: false });
  } else {
    // Follow
    await prisma.follow.create({
      data: { followerId, followingId: targetId },
    });

    // Send notification (fire-and-forget)
    const follower = await prisma.user.findUnique({
      where: { id: followerId },
      select: { arabicName: true, avatar: true },
    });

    try {
      await addNotification({
        userId: targetId,
        type: 'follow',
        titleAr: 'متابع جديد',
        bodyAr: `${follower?.arabicName || 'مستخدم'} بدأ متابعتك`,
        data: { actorId: followerId, actorAvatar: follower?.avatar },
      });
    } catch {
      // Non-critical — don't fail the follow action
    }

    await cacheDel(`user:${targetId}`);
    logger.info({ followerId, targetId }, 'User followed');
    return apiResponse(res, { following: true });
  }
}
