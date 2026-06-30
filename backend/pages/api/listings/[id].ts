// pages/api/listings/[id].ts
// FIX: strict update schema (no mass assignment), full cache invalidation
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, withOptionalAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { cacheGet, cacheSet, cacheDel, getRedis } from '@/lib/redis';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { logger } from '@/lib/logger';

export const config = { api: { bodyParser: { sizeLimit: '32kb' } } };

// Strict allowlist — only these fields can be updated by the owner
const updateSchema = z.object({
  title:             z.string().min(3).max(100).trim().optional(),
  arabicTitle:       z.string().min(3).max(100).trim().optional(),
  description:       z.string().min(10).max(2000).trim().optional(),
  arabicDescription: z.string().min(10).max(2000).trim().optional(),
  price:             z.number().positive().max(10_000_000).optional(),
  images:            z.array(z.string().url()).min(1).max(8).optional(),
  breed:             z.string().max(50).optional(),
  age:               z.string().max(50).optional(),
  location:          z.string().min(2).max(100).trim().optional(),
  arabicLocation:    z.string().min(2).max(100).trim().optional(),
}).strict(); // .strict() rejects any keys not in the schema

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'GET')    return withOptionalAuth(req, res, getListing);
  if (req.method === 'PUT')    return withAuth(req, res, updateListing);
  if (req.method === 'DELETE') return withAuth(req, res, deleteListing);
  return res.status(405).end();
}

async function getListing(req: NextApiRequest & { user?: any }, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  if (!id || typeof id !== 'string') return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');

  const cacheKey = `listing:${id}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    prisma.listing.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => {});
    return apiResponse(res, cached);
  }

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      seller: {
        select: {
          id: true, username: true, displayName: true, arabicName: true,
          avatar: true, verified: true, country: true, bio: true,
        },
      },
      fee: { select: { status: true, commission: true, dueDate: true } },
    },
  });

  if (!listing) return apiError(res, 404, 'not_found', 'الإعلان غير موجود');

  prisma.listing.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => {});
  await cacheSet(cacheKey, listing, 300);
  return apiResponse(res, listing);
}

async function updateListing(req: AuthedRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };

  const listing = await prisma.listing.findUnique({
    where:  { id },
    select: { sellerId: true, category: true, country: true },
  });
  if (!listing)                                               return apiError(res, 404, 'not_found', 'الإعلان غير موجود');
  if (listing.sellerId !== req.user.userId && req.user.role !== 'ADMIN') {
    return apiError(res, 403, 'forbidden', 'غير مسموح');
  }

  // Validate with strict schema — rejects any extra fields
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const updated = await prisma.listing.update({ where: { id }, data: parsed.data });

  // Invalidate both single listing cache AND list caches for this category/country
  await cacheDel(`listing:${id}`);
  await invalidateListingsCacheByPattern();

  return apiResponse(res, updated);
}

async function deleteListing(req: AuthedRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };

  const listing = await prisma.listing.findUnique({
    where:  { id },
    select: { sellerId: true },
  });
  if (!listing)                                               return apiError(res, 404, 'not_found', 'الإعلان غير موجود');
  if (listing.sellerId !== req.user.userId && req.user.role !== 'ADMIN') {
    return apiError(res, 403, 'forbidden', 'غير مسموح');
  }

  await prisma.listing.update({ where: { id }, data: { status: 'sold' } });
  await cacheDel(`listing:${id}`);
  await invalidateListingsCacheByPattern();

  logger.info({ listingId: id, userId: req.user.userId }, 'Listing deleted');
  return apiResponse(res, { deleted: true });
}

async function invalidateListingsCacheByPattern() {
  try {
    const redis = getRedis();
    let cursor = '0';
    const keys: string[] = [];
    do {
      const [nextCursor, found] = await redis.scan(cursor, 'MATCH', 'listings:v2:*', 'COUNT', 50);
      cursor = nextCursor;
      keys.push(...found);
    } while (cursor !== '0');
    if (keys.length) await redis.del(...keys);
  } catch {}
}
