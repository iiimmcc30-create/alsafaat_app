// pages/api/butchers/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, withOptionalAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { cacheGet, cacheSet, cacheDel } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { countrySchema } from '@/lib/countries';

const PAGE_SIZE = 20;

const registerSchema = z.object({
  nameAr:    z.string().min(2).max(100).trim(),
  nameEn:    z.string().min(2).max(100).trim(),
  country:   countrySchema,
  city:      z.string().min(2).max(100).trim(),
  cityAr:    z.string().min(2).max(100).trim(),
  address:   z.string().min(5).max(300).trim(),
  addressAr: z.string().min(5).max(300).trim(),
  phone:     z.string().regex(/^\+?[0-9]{8,15}$/, 'رقم هاتف غير صالح'),
  type:      z.enum(['regular','verified']).default('regular'),
  lat:       z.number().min(-90).max(90),
  lng:       z.number().min(-180).max(180),
}).strict();

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

async function registerButcher(req: AuthedRequest, res: NextApiResponse) {
  const existing = await prisma.butcher.findUnique({
    where:  { userId: req.user.userId },
    select: { id: true },
  });
  if (existing) return apiError(res, 409, 'already_registered', 'لديك ملحمة مسجلة بالفعل');

  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const butcher = await prisma.butcher.create({
    data: { ...parsed.data, country: parsed.data.country as any, userId: req.user.userId },
  });

  // Update User role to BUTCHER
  await prisma.user.update({
    where: { id: req.user.userId },
    data: { role: 'BUTCHER' },
  });

  // Invalidate butcher list caches
  await cacheDel('butchers:v2:*').catch(() => {});

  logger.info({ butcherId: butcher.id, userId: req.user.userId }, 'Butcher registered');
  return apiResponse(res, butcher, 201);
}
