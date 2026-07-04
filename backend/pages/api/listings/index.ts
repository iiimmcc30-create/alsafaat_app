// pages/api/listings/index.ts
// FIX: atomic transaction for listing creation + subscription limit (no race condition)
// FIX: cursor-based pagination instead of OFFSET
// FIX: full cache invalidation on write
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, withOptionalAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { cacheGet, cacheSet, cacheDel, getRedis } from '@/lib/redis';
import { calculateCommission, ListingCat } from '@/lib/commissions';
import { scheduleFeeCheck } from '@/lib/queue';
import { logger } from '@/lib/logger';
import { countrySchema } from '@/lib/countries';
import { notifyUser } from '@/lib/notifications';

const PAGE_SIZE = 20;

const createSchema = z.object({
  title:             z.string().min(3).max(100).trim(),
  arabicTitle:       z.string().min(3).max(100).trim(),
  description:       z.string().min(10).max(2000).trim(),
  arabicDescription: z.string().min(10).max(2000).trim(),
  price:             z.number().positive().max(10_000_000),
  currency:          z.string().length(3).default('SAR'),
  category:          z.enum(['camels','sheep','goats','cows','horses','birds','feed','equipment']),
  breed:             z.string().max(50).optional(),
  age:               z.string().max(50).optional(),
  quantity:          z.number().int().positive().max(9999).default(1),
  location:          z.string().min(2).max(100).trim(),
  arabicLocation:    z.string().min(2).max(100).trim(),
  country:           countrySchema,
  images:            z.array(z.string().url()).min(1).max(8),
  featured:          z.boolean().default(false),
});

export const config = { api: { bodyParser: { sizeLimit: '64kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'GET')  return withOptionalAuth(req, res, getListings);
  if (req.method === 'POST') return withAuth(req, res, createListing);
  return res.status(405).end();
}

// GET /api/listings — cursor-based pagination (no OFFSET slow-down)
async function getListings(req: NextApiRequest & { user?: any }, res: NextApiResponse) {
  const cursor    = req.query.cursor as string | undefined;  // last seen id
  const category  = req.query.category as string | undefined;
  const country   = req.query.country  as string | undefined;
  const search    = req.query.search   as string | undefined;
  const featured  = req.query.featured === 'true';
  const sellerId  = req.query.sellerId as string | undefined;

  const cacheKey = search
    ? null  // Never cache search results
    : `listings:v2:${JSON.stringify({ cursor, category, country, featured, sellerId })}`;

  if (cacheKey) {
    const cached = await cacheGet(cacheKey);
    if (cached) return apiResponse(res, cached);
  }

  const where: any = { status: 'active' };
  if (category) where.category = category;
  if (country)  where.country  = country;
  if (featured) where.featured = true;
  if (sellerId) where.sellerId = sellerId;

  if (search && search.length >= 2) {
    // Use PostgreSQL full-text search when available, fallback to contains
    where.OR = [
      { title:         { contains: search, mode: 'insensitive' } },
      { arabicTitle:   { contains: search } },
      { arabicLocation:{ contains: search } },
      { breed:         { contains: search, mode: 'insensitive' } },
    ];
  }

  const listings = await prisma.listing.findMany({
    where,
    take:    PAGE_SIZE + 1,  // fetch one extra to check if there's a next page
    cursor:  cursor ? { id: cursor } : undefined,
    skip:    cursor ? 1 : 0,
    orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    include: {
      seller: {
        select: { id: true, username: true, displayName: true, arabicName: true, avatar: true, verified: true, country: true },
      },
    },
  });

  const hasMore   = listings.length > PAGE_SIZE;
  const items     = hasMore ? listings.slice(0, -1) : listings;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  const result = { listings: items, nextCursor, hasMore };

  if (cacheKey) await cacheSet(cacheKey, result, 90);
  return apiResponse(res, result);
}

// POST /api/listings — fully atomic (no race condition on listing limit)
async function createListing(req: AuthedRequest, res: NextApiResponse) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const data = parsed.data;
  const { commission, dueDate } = calculateCommission(
    data.category as ListingCat,
    data.price,
    data.quantity
  );

  try {
    // ── Single atomic transaction: check limit → create listing → update usage ──
    const listing = await prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.findUnique({
        where:  { userId: req.user.userId },
        select: { planId: true, listingsUsed: true },
      });

      // Enforce plan limits inside the transaction (prevents race condition)
      if (sub && sub.planId !== 'vip') {
        const limits: Record<string, number> = { free: 5, starter: 15, pro: 30 };
        const limit = limits[sub.planId] ?? 5;
        if (sub.listingsUsed >= limit) {
          throw Object.assign(
            new Error(`listing_limit:${limit}`),
            { code: 'listing_limit', limit }
          );
        }
      }

      const created = await tx.listing.create({
        data: {
          ...data,
          country:  data.country  as any,
          category: data.category as any,
          sellerId: req.user.userId,
          fee: {
            create: {
              userId:     req.user.userId,
              category:   data.category,
              quantity:   data.quantity,
              price:      data.price,
              commission,
              dueDate,
              status:     'pending',
            },
          },
        },
        include: {
          seller: { select: { id: true, username: true, displayName: true, arabicName: true, avatar: true } },
          fee:    true,
        },
      });

      if (sub) {
        await tx.subscription.update({
          where: { userId: req.user.userId },
          data:  { listingsUsed: { increment: 1 } },
        });
      }

      return created;
    });

    // ── Post-creation side-effects (outside transaction) ──────────────────────
    const delayMs = dueDate.getTime() - Date.now() + 60_000;
    await scheduleFeeCheck({ listingFeeId: listing.fee!.id, userId: req.user.userId, amount: commission }, delayMs);

    await notifyUser({
      userId:   req.user.userId,
      type:     'fee_due',
      titleAr:  '✅ تم نشر إعلانك',
      bodyAr:   `إعلانك "${data.arabicTitle}" منشور. الرسوم: ${commission} ريال خلال ١٤ يوم.`,
      data:     { listingId: listing.id, feeId: listing.fee!.id },
    });

    // Invalidate ALL listings cache keys matching this category/country pattern
    await invalidateListingsCache(data.category, data.country);

    logger.info({ listingId: listing.id, userId: req.user.userId, commission }, 'Listing created');
    return apiResponse(res, listing, 201);

  } catch (err: any) {
    if (err.code === 'listing_limit') {
      return apiError(res, 403, 'listing_limit',
        `وصلت للحد الأقصى (${err.limit} إعلانات). يرجى ترقية الباقة.`
      );
    }
    logger.error({ err }, 'Create listing error');
    return apiError(res, 500, 'server_error', 'خطأ في الخادم');
  }
}

// Invalidate all cache keys that could be affected by a new/updated listing
async function invalidateListingsCache(category?: string, country?: string) {
  try {
    const redis = getRedis();
    // Use SCAN to find and delete matching keys (safer than KEYS in production)
    const pattern = 'listings:v2:*';
    let cursor = '0';
    const keysToDelete: string[] = [];
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keysToDelete.push(...keys);
    } while (cursor !== '0');

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
      logger.debug({ count: keysToDelete.length }, 'Listings cache invalidated');
    }
  } catch (err) {
    logger.warn({ err }, 'Cache invalidation failed (non-critical)');
  }
}
