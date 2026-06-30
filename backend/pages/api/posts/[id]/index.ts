// pages/api/posts/[id]/index.ts — GET / PUT / DELETE single post
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, withOptionalAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { cacheDel, CacheKeys } from '@/lib/redis';

const updateSchema = z.object({
  content:       z.string().min(1).max(280).trim(),
  arabicContent: z.string().min(1).max(280).trim(),
  image:         z.string().url().optional().nullable(),
}).strict();

export const config = { api: { bodyParser: { sizeLimit: '32kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'GET')    return withOptionalAuth(req, res, getPost);
  if (req.method === 'PUT')      return withAuth(req, res, updatePost);
  if (req.method === 'DELETE')  return withAuth(req, res, deletePost);
  return res.status(405).end();
}

async function getPost(req: NextApiRequest & { user?: any }, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  if (!id) return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: {
        select: { id: true, username: true, displayName: true, arabicName: true, avatar: true, verified: true },
      },
      _count: { select: { likes: true, reposts: true, comments: true } },
    },
  });
  if (!post) return apiError(res, 404, 'not_found', 'المنشور غير موجود');

  let liked = false;
  let reposted = false;
  if (req.user?.userId) {
    const [likeRow, repostRow] = await Promise.all([
      prisma.postLike.findUnique({
        where: { postId_userId: { postId: id, userId: req.user.userId } },
        select: { id: true },
      }),
      prisma.postRepost.findUnique({
        where: { postId_userId: { postId: id, userId: req.user.userId } },
        select: { id: true },
      }),
    ]);
    liked = !!likeRow;
    reposted = !!repostRow;
  }

  return apiResponse(res, {
    ...post,
    likesCount:    post._count.likes,
    repostsCount:  post._count.reposts,
    commentsCount: post._count.comments,
    liked,
    reposted,
    _count: undefined,
  });
}

async function updatePost(req: AuthedRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  if (!id) return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });
  if (!post) return apiError(res, 404, 'not_found', 'المنشور غير موجود');
  if (post.authorId !== req.user.userId && req.user.role !== 'ADMIN') {
    return apiError(res, 403, 'forbidden', 'غير مسموح');
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const updated = await prisma.post.update({
    where: { id },
    data: parsed.data,
    include: {
      author: {
        select: { id: true, username: true, displayName: true, arabicName: true, avatar: true, verified: true },
      },
    },
  });

  await cacheDel(CacheKeys.post(id));
  await cacheDel('posts:feed:first');
  await cacheDel(`posts:user:${post.authorId}:first`);

  return apiResponse(res, updated);
}

async function deletePost(req: AuthedRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  if (!id) return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });
  if (!post) return apiError(res, 404, 'not_found', 'المنشور غير موجود');
  if (post.authorId !== req.user.userId && req.user.role !== 'ADMIN') {
    return apiError(res, 403, 'forbidden', 'غير مسموح');
  }

  await prisma.post.delete({ where: { id } });

  await cacheDel(CacheKeys.post(id));
  await cacheDel('posts:feed:first');
  await cacheDel(`posts:user:${post.authorId}:first`);

  return apiResponse(res, { deleted: true });
}
