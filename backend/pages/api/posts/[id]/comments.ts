// pages/api/posts/[id]/comments.ts — GET / POST comments
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, withOptionalAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { cacheDel, CacheKeys } from '@/lib/redis';
import { notifyUser } from '@/lib/notifications';

const createSchema = z.object({
  content: z.string().min(1).max(500).trim(),
}).strict();

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'GET')  return withOptionalAuth(req, res, listComments);
  if (req.method === 'POST') return withAuth(req, res, createComment);
  return res.status(405).end();
}

async function listComments(req: NextApiRequest, res: NextApiResponse) {
  const { id: postId } = req.query as { id: string };
  if (!postId) return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) return apiError(res, 404, 'not_found', 'المنشور غير موجود');

  const comments = await prisma.postComment.findMany({
    where: { postId },
    orderBy: { createdAt: 'asc' },
    take: 100,
    include: {
      author: {
        select: { id: true, username: true, displayName: true, arabicName: true, avatar: true, verified: true },
      },
    },
  });

  return apiResponse(res, { comments });
}

async function createComment(req: AuthedRequest, res: NextApiResponse) {
  const { id: postId } = req.query as { id: string };
  if (!postId) return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true },
  });
  if (!post) return apiError(res, 404, 'not_found', 'المنشور غير موجود');

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.postComment.create({
      data: {
        postId,
        authorId: req.user.userId,
        content: parsed.data.content,
      },
      include: {
        author: {
          select: { id: true, username: true, displayName: true, arabicName: true, avatar: true, verified: true },
        },
      },
    });
    await tx.post.update({
      where: { id: postId },
      data: { commentsCount: { increment: 1 } },
    });
    return created;
  });

  if (post.authorId !== req.user.userId) {
    void notifyUser({
      userId:  post.authorId,
      type:    'comment',
      titleAr: 'تعليق جديد',
      bodyAr:  `علّق ${req.user.username} على منشورك`,
      data:    { postId, commentId: comment.id },
    }).catch(() => {});
  }

  await cacheDel(CacheKeys.post(postId));
  await cacheDel('posts:feed:first');

  return apiResponse(res, comment, 201);
}
