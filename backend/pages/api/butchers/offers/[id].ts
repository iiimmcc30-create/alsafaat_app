// pages/api/butchers/offers/[id].ts
// PUT    /api/butchers/offers/:id — update offer
// DELETE /api/butchers/offers/:id — delete offer
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { cacheDel } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { countrySchema } from '@/lib/countries';

const updateSchema = z.object({
  titleAr:         z.string().min(2).max(100).optional(),
  titleEn:         z.string().min(2).max(100).optional(),
  descriptionAr:   z.string().min(2).max(500).optional(),
  descriptionEn:   z.string().min(2).max(500).optional(),
  discountPercent: z.number().min(0).max(100).optional().nullable(),
  originalPrice:   z.number().positive().optional().nullable(),
  offerPrice:      z.number().positive().optional().nullable(),
  image:           z.string().url().optional(),
  validUntil:      z.string().datetime().optional(),
  country:         countrySchema.optional(),
}).strict();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'PUT')    return withAuth(req, res, updateOffer);
  if (req.method === 'DELETE') return withAuth(req, res, deleteOffer);
  return res.status(405).end();
}

async function getOwnedOffer(offerId: string, userId: string) {
  return prisma.butcherOffer.findFirst({
    where: { id: offerId, butcher: { userId } },
    select: { id: true, butcherId: true },
  });
}

async function updateOffer(req: AuthedRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  if (!id) return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');

  const offer = await getOwnedOffer(id, req.user.userId);
  if (!offer) return apiError(res, 404, 'not_found', 'العرض غير موجود');

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.validUntil) {
    data.validUntil = new Date(parsed.data.validUntil);
  }

  const updated = await prisma.butcherOffer.update({
    where: { id },
    data,
  });

  await cacheDel(`butcher:${offer.butcherId}`);
  await cacheDel('butcher:me');

  logger.info({ offerId: id }, 'Butcher offer updated');
  return apiResponse(res, updated);
}

async function deleteOffer(req: AuthedRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  if (!id) return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');

  const offer = await getOwnedOffer(id, req.user.userId);
  if (!offer) return apiError(res, 404, 'not_found', 'العرض غير موجود');

  await prisma.butcherOffer.delete({ where: { id } });

  await cacheDel(`butcher:${offer.butcherId}`);
  await cacheDel('butcher:me');

  logger.info({ offerId: id }, 'Butcher offer deleted');
  return apiResponse(res, { deleted: true });
}
