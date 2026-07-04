// pages/api/posts/[id]/repost.ts — POST toggle repost
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { cacheDel, CacheKeys } from '@/lib/redis';
import { notifyUser } from '@/lib/notifications';

export const config = { api: { bodyParser: { sizeLimit: '1kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'POST') return withAuth(req, res, toggleRepost);
  return res.status(405).end();
}

async function toggleRepost(req: AuthedRequest, res: NextApiResponse) {
  const { id: postId } = req.query as { id: string };
  if (!postId || typeof postId !== 'string') {
    return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');
  }

  const post = await prisma.post.findUnique({
    where:  { id: postId },
    select: { id: true, authorId: true },
  });
  if (!post) return apiError(res, 404, 'not_found', 'المنشور غير موجود');

  const existing = await prisma.postRepost.findUnique({
    where:  { postId_userId: { postId, userId: req.user.userId } },
    select: { id: true },
  });

  let reposted = false;
  await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.postRepost.delete({ where: { postId_userId: { postId, userId: req.user.userId } } });
      await tx.post.update({ where: { id: postId }, data: { repostsCount: { decrement: 1 } } });
      reposted = false;
    } else {
      await tx.postRepost.create({ data: { postId, userId: req.user.userId } });
      await tx.post.update({ where: { id: postId }, data: { repostsCount: { increment: 1 } } });
      reposted = true;
    }
  });

  if (reposted && post.authorId !== req.user.userId) {
    void notifyUser({
      userId:  post.authorId,
      type:    'repost',
      titleAr: 'إعادة نشر',
      bodyAr:  `أعاد ${req.user.username} نشر منشورك`,
      data:    { postId },
    }).catch(() => {});
  }

  await cacheDel(CacheKeys.post(postId));
  await cacheDel('posts:feed:first');

  return apiResponse(res, { reposted });
}
