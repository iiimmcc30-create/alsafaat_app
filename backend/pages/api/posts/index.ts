// pages/api/posts/index.ts
// FIX: createMany for follower notifications (no N+1), cursor pagination
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, withOptionalAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { cacheGet, cacheSet, cacheDel } from '@/lib/redis';

const PAGE_SIZE = 20;

const createSchema = z.object({
  content:       z.string().min(1).max(280).trim(),
  arabicContent: z.string().min(1).max(280).trim(),
  image:         z.string().url().optional(),
}).strict();

export const config = { api: { bodyParser: { sizeLimit: '32kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'GET')  return withOptionalAuth(req, res, getFeed);
  if (req.method === 'POST') return withAuth(req, res, createPost);
  return res.status(405).end();
}

// GET /api/posts — cursor-based pagination
async function getFeed(req: NextApiRequest & { user?: any }, res: NextApiResponse) {
  const cursor   = req.query.cursor as string | undefined;
  const authorId = req.query.userId as string | undefined;

  const cacheKey = authorId
    ? `posts:user:${authorId}:${cursor || 'first'}`
    : `posts:feed:${cursor || 'first'}`;

  const cached = await cacheGet(cacheKey);
  if (cached) return apiResponse(res, cached);

  const where = authorId ? { authorId } : {};

  const posts = await prisma.post.findMany({
    where,
    take:    PAGE_SIZE + 1,
    cursor:  cursor ? { id: cursor } : undefined,
    skip:    cursor ? 1 : 0,
    orderBy: { createdAt: 'desc' },
    include: {
      author: {
        select: { id: true, username: true, displayName: true, arabicName: true, avatar: true, verified: true },
      },
      _count: { select: { likes: true, reposts: true, comments: true } },
    },
  });

  const hasMore    = posts.length > PAGE_SIZE;
  const items      = hasMore ? posts.slice(0, -1) : posts;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  // Batch-check liked posts for authenticated user
  let likedPostIds = new Set<string>();
  let repostedPostIds = new Set<string>();
  if (req.user?.userId) {
    const postIds = items.map((p) => p.id);
    const [likes, reposts] = await Promise.all([
      prisma.postLike.findMany({
        where:  { userId: req.user.userId, postId: { in: postIds } },
        select: { postId: true },
      }),
      prisma.postRepost.findMany({
        where:  { userId: req.user.userId, postId: { in: postIds } },
        select: { postId: true },
      }),
    ]);
    likedPostIds = new Set(likes.map((l) => l.postId));
    repostedPostIds = new Set(reposts.map((r) => r.postId));
  }

  const postsWithMeta = items.map((p) => ({
    ...p,
    likesCount:    p._count.likes,
    repostsCount:  p._count.reposts,
    commentsCount: p._count.comments,
    liked:         likedPostIds.has(p.id),
    reposted:      repostedPostIds.has(p.id),
    _count:        undefined,
  }));

  const result = { posts: postsWithMeta, nextCursor, hasMore };
  await cacheSet(cacheKey, result, 60);
  return apiResponse(res, result);
}

// POST /api/posts
async function createPost(req: AuthedRequest, res: NextApiResponse) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const post = await prisma.post.create({
    data: { ...parsed.data, authorId: req.user.userId },
    include: {
      author: {
        select: { id: true, username: true, displayName: true, arabicName: true, avatar: true, verified: true },
      },
    },
  });

  // FIX: single createMany instead of N sequential inserts
  const followers = await prisma.follow.findMany({
    where:  { followingId: req.user.userId },
    select: { followerId: true },
    take:   500, // cap at 500 for safety
  });

  if (followers.length > 0) {
    await prisma.notification.createMany({
      data: followers.map((f) => ({
        userId:   f.followerId,
        type:     'system' as const,
        titleAr:  'منشور جديد',
        bodyAr:   `${post.author.arabicName} نشر منشوراً جديداً`,
        data:     { postId: post.id, authorId: req.user.userId },
      })),
      skipDuplicates: true,
    });
  }

  // Invalidate feed caches
  await cacheDel('posts:feed:first');

  return apiResponse(res, post, 201);
}
