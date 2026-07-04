// pages/api/butchers/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { withAuth, withOptionalAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { cacheGet, cacheSet } from '@/lib/redis';

const PAGE_SIZE = 20;

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'GET')  return withOptionalAuth(req, res, getButchers);
  if (req.method === 'POST') return withAuth(req, res, registerButcher);
  return res.status(405).end();
}

async function getButchers(req: NextApiRequest, res: NextApiResponse) {
  const cursor   = req.query.cursor as string | undefined;
  const country  = req.query.country  as string | undefined;
  const verified = req.query.verified === 'true';
  const search   = req.query.search   as string | undefined;
  const isOpen   = req.query.isOpen   === 'true';

  const cacheKey = (!search)
    ? `butchers:v2:${JSON.stringify({ cursor, country, verified, isOpen })}`
    : null;

  if (cacheKey) {
    const cached = await cacheGet(cacheKey);
    if (cached) return apiResponse(res, cached);
  }

  const where: any = {};
  if (country)  where.country = country;
  if (verified) where.subscriptionActive = true;
  if (isOpen)   where.isOpen = true;
  if (search && search.length >= 2) {
    where.OR = [
      { nameAr: { contains: search } },
      { nameEn: { contains: search, mode: 'insensitive' } },
      { cityAr: { contains: search } },
      { city:   { contains: search, mode: 'insensitive' } },
    ];
  }

  // Cursor-based pagination — no OFFSET
  const butchers = await prisma.butcher.findMany({
    where,
    take:    PAGE_SIZE + 1,
    cursor:  cursor ? { id: cursor } : undefined,
    skip:    cursor ? 1 : 0,
    orderBy: [
      { subscriptionActive: 'desc' },
      { rating: 'desc' },
      { activityScore: 'desc' },
      { id: 'asc' },  // stable tiebreaker for cursor pagination
    ],
    include: {
      user:   { select: { id: true, username: true, avatar: true } },
      _count: { select: { products: true, orders: true } },
    },
  });

  const hasMore    = butchers.length > PAGE_SIZE;
  const items      = hasMore ? butchers.slice(0, -1) : butchers;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  const result = { butchers: items, nextCursor, hasMore };

  if (cacheKey) await cacheSet(cacheKey, result, 180);
  return apiResponse(res, result);
}

async function registerButcher(_req: AuthedRequest, res: NextApiResponse) {
  return apiError(
    res,
    403,
    'application_required',
    'يجب تقديم طلب تسجيل ملحمة والحصول على موافقة الإدارة. استخدم بوابة طلبات التسجيل في التطبيق.',
  );
}
