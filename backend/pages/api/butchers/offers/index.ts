// pages/api/butchers/offers/index.ts
// GET  /api/butchers/offers — list offers for authenticated butcher
// POST /api/butchers/offers — create offer
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { cacheDel } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { countrySchema } from '@/lib/countries';

const createSchema = z.object({
  titleAr:         z.string().min(2).max(100),
  titleEn:         z.string().min(2).max(100),
  descriptionAr:   z.string().min(2).max(500),
  descriptionEn:   z.string().min(2).max(500),
  discountPercent: z.number().min(0).max(100).optional().nullable(),
  originalPrice:   z.number().positive().optional().nullable(),
  offerPrice:      z.number().positive().optional().nullable(),
  image:           z.string().url(),
  validUntil:      z.string().datetime(),
  country:         countrySchema,
}).strict();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'GET')  return withAuth(req, res, listOffers);
  if (req.method === 'POST') return withAuth(req, res, createOffer);
  return res.status(405).end();
}

async function getButcherForUser(userId: string) {
  return prisma.butcher.findUnique({
    where: { userId },
    select: { id: true },
  });
}

async function listOffers(req: AuthedRequest, res: NextApiResponse) {
  const butcher = await getButcherForUser(req.user.userId);
  if (!butcher) return apiError(res, 404, 'not_found', 'الملحمة غير موجودة');

  const offers = await prisma.butcherOffer.findMany({
    where: { butcherId: butcher.id, validUntil: { gte: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  return apiResponse(res, offers);
}

async function createOffer(req: AuthedRequest, res: NextApiResponse) {
  const butcher = await getButcherForUser(req.user.userId);
  if (!butcher) return apiError(res, 404, 'not_found', 'الملحمة غير موجودة');

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const offer = await prisma.butcherOffer.create({
    data: {
      butcherId: butcher.id,
      ...parsed.data,
      validUntil: new Date(parsed.data.validUntil),
    },
  });

  await cacheDel(`butcher:${butcher.id}`);
  await cacheDel('butcher:me');

  logger.info({ offerId: offer.id, butcherId: butcher.id }, 'Butcher offer created');
  return apiResponse(res, offer, 201);
}
