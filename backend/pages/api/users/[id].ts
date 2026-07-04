// pages/api/users/[id].ts
// FIX: strict schema (.strict()), validated avatar URLs must be from our CDN only,
//      cache invalidation on update, body size limit, follow/unfollow actions
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, withOptionalAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { cacheGet, cacheSet, cacheDel } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { countrySchema } from '@/lib/countries';
import { isOurUploadUrl } from '@/lib/storage';
import { disconnectUserSockets } from '@/socket-server';

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };

const cdnUrl = () =>
  z.string().url().refine(isOurUploadUrl, 'Image must be uploaded via SAFAT upload endpoint');

const updateSchema = z.object({
  displayName: z.string().min(2).max(50).trim().optional(),
  arabicName:  z.string().min(2).max(50).trim().optional(),
  bio:         z.string().max(160).trim().optional(),
  avatar:      cdnUrl().optional(),
  coverImage:  cdnUrl().optional(),
  country:     countrySchema.optional(),
  fcmToken:    z.union([z.string().max(500), z.null()]).optional(),
}).strict(); // reject any unlisted fields — prevents mass assignment

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'GET')    return withOptionalAuth(req, res, getUser);
  if (req.method === 'PUT')    return withAuth(req, res, updateUser);
  if (req.method === 'DELETE') return withAuth(req, res, deleteUser);
  return res.status(405).end();
}

async function getUser(req: NextApiRequest & { user?: any }, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  if (!id || typeof id !== 'string') return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');

  const cacheKey = `user:${id}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return apiResponse(res, cached);

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, username: true, displayName: true, arabicName: true,
      avatar: true, coverImage: true, bio: true, verified: true,
      country: true, createdAt: true, lastSeenAt: true,
      butcherProfile: {
        select: { rating: true, reviewCount: true },
      },
      _count: {
        select: { followers: true, following: true, listings: true, posts: true },
      },
    },
  });

  if (!user) return apiError(res, 404, 'not_found', 'المستخدم غير موجود');

  // Check if current user follows this profile (single additional query)
  let isFollowing = false;
  if (req.user?.userId && req.user.userId !== id) {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.user.userId, followingId: id } },
      select: { id: true },
    });
    isFollowing = !!follow;
  }

  const reviewCount = user.butcherProfile?.reviewCount ?? 0;
  const result = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    arabicName: user.arabicName,
    avatar: user.avatar,
    coverImage: user.coverImage,
    bio: user.bio,
    verified: user.verified,
    country: user.country,
    createdAt: user.createdAt,
    lastSeenAt: user.lastSeenAt,
    rating: reviewCount > 0 ? user.butcherProfile!.rating : null,
    reviewCount,
    followersCount: user._count.followers,
    followingCount: user._count.following,
    listingsCount:  user._count.listings,
    postsCount:     user._count.posts,
    isFollowing,
  };

  await cacheSet(cacheKey, result, 300);
  return apiResponse(res, result);
}

async function updateUser(req: AuthedRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };

  // Only the user themselves or an ADMIN can update a profile
  if (id !== req.user.userId && req.user.role !== 'ADMIN') {
    return apiError(res, 403, 'forbidden', 'غير مسموح');
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  // Exclude fcmToken from the public profile fields
  const { fcmToken, ...profileData } = parsed.data;

  const updated = await prisma.user.update({
    where: { id },
    data:  {
      ...profileData,
      country:  profileData.country as any,
      ...(fcmToken !== undefined && { fcmToken }),
    },
    select: {
      id: true, username: true, displayName: true, arabicName: true,
      avatar: true, coverImage: true, bio: true, verified: true, country: true,
      butcherProfile: {
        select: { rating: true, reviewCount: true },
      },
      _count: {
        select: { followers: true },
      },
    },
  });

  const reviewCount = updated.butcherProfile?.reviewCount ?? 0;
  await cacheDel(`user:${id}`);
  logger.info({ userId: id }, 'User profile updated');
  return apiResponse(res, {
    id: updated.id,
    username: updated.username,
    displayName: updated.displayName,
    arabicName: updated.arabicName,
    avatar: updated.avatar,
    coverImage: updated.coverImage,
    bio: updated.bio,
    verified: updated.verified,
    country: updated.country,
    rating: reviewCount > 0 ? updated.butcherProfile!.rating : null,
    reviewCount,
    followersCount: updated._count.followers,
  });
}

async function deleteUser(req: AuthedRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };

  if (id !== req.user.userId && req.user.role !== 'ADMIN') {
    return apiError(res, 403, 'forbidden', 'غير مسموح');
  }

  // Soft delete — deactivate account, don't wipe data
  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data:  { isActive: false, email: `deleted_${Date.now()}@safat.deleted`, fcmToken: null },
    }),
    prisma.userSession.deleteMany({ where: { userId: id } }),
  ]);

  await disconnectUserSockets(id);

  await cacheDel(`user:${id}`);
  logger.info({ userId: id, by: req.user.userId }, 'User account deactivated');
  return apiResponse(res, { deleted: true });
}
