// pages/api/posts/[id]/like.ts
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { cacheDel, CacheKeys } from '@/lib/redis';
import { notifyUser } from '@/lib/notifications';

export const config = { api: { bodyParser: { sizeLimit: '1kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;  // FIX: was missing await
  if (req.method === 'POST') return withAuth(req, res, toggleLike);
  return res.status(405).end();
}

async function toggleLike(req: AuthedRequest, res: NextApiResponse) {
  const { id: postId } = req.query as { id: string };
  if (!postId || typeof postId !== 'string') {
    return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');
  }

  const post = await prisma.post.findUnique({
    where:  { id: postId },
    select: { id: true, authorId: true },
  });
  if (!post) return apiError(res, 404, 'not_found', 'المنشور غير موجود');

  const existing = await prisma.postLike.findUnique({
    where:  { postId_userId: { postId, userId: req.user.userId } },
    select: { id: true },
  });

  let liked = false;
  await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.postLike.delete({ where: { postId_userId: { postId, userId: req.user.userId } } });
      await tx.post.update({ where: { id: postId }, data: { likesCount: { decrement: 1 } } });
      liked = false;
    } else {
      await tx.postLike.create({ data: { postId, userId: req.user.userId } });
      await tx.post.update({ where: { id: postId }, data: { likesCount: { increment: 1 } } });
      liked = true;
    }
  });

  if (liked && post.authorId !== req.user.userId) {
    void notifyUser({
      userId:  post.authorId,
      type:    'like',
      titleAr: 'إعجاب جديد',
      bodyAr:  `أعجب ${req.user.username} بمنشورك`,
      data:    { postId },
    }).catch(() => {});
  }

  await cacheDel(CacheKeys.post(postId));
  return apiResponse(res, { liked });
}
