// pages/api/butchers/[id].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, withOptionalAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { countrySchema } from '@/lib/countries';

const updateSchema = z.object({
  nameAr:        z.string().min(2).max(100).trim().optional(),
  nameEn:        z.string().min(2).max(100).trim().optional(),
  logo:          z.string().url().optional().nullable(),
  cover:         z.string().url().optional().nullable(),
  bioAr:         z.string().max(500).trim().optional().nullable(),
  bioEn:         z.string().max(500).trim().optional().nullable(),
  specialties:   z.array(z.string()).optional(),
  commercialReg: z.string().max(50).trim().optional().nullable(),
  phone:         z.string().regex(/^\+?[0-9]{8,20}$/, 'رقم هاتف غير صالح').optional(),
  openTime:      z.string().regex(/^([0-9]{2}):([0-9]{2})$/).optional(),
  closeTime:     z.string().regex(/^([0-9]{2}):([0-9]{2})$/).optional(),
  closedDays:    z.array(z.string()).optional(),
  address:       z.string().min(5).max(300).trim().optional(),
  addressAr:     z.string().min(5).max(300).trim().optional(),
  city:          z.string().min(2).max(100).trim().optional(),
  cityAr:        z.string().min(2).max(100).trim().optional(),
  lat:           z.number().min(-90).max(90).optional(),
  lng:           z.number().min(-180).max(180).optional(),
  country:       countrySchema.optional(),
  isOpen:        z.boolean().optional(),
}).strict();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'GET')  return withOptionalAuth(req, res, getButcher);
  if (req.method === 'PUT') return withAuth(req, res, updateButcher);
  return res.status(405).end();
}

async function getButcher(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  if (!id) return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');

  const isMe = id === 'me';
  const viewerId = (req as any).user?.userId as string | undefined;

  // Public profile views: skip cache so profileViews stays accurate
  if (!isMe) {
    const existing = await prisma.butcher.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!existing) return apiError(res, 404, 'not_found', 'الملحمة غير موجودة');
    if (existing.userId !== viewerId) {
      await prisma.butcher.update({
        where: { id },
        data: { profileViews: { increment: 1 } },
      });
    }
  } else {
    const cacheKey = `butcher:${id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return apiResponse(res, cached);
  }

  let butcher;
  if (isMe) {
    const userReq = req as any;
    if (!userReq.user?.userId) {
      return apiError(res, 401, 'unauthorized', 'غير مصرح');
    }
    butcher = await prisma.butcher.findUnique({
      where: { userId: userReq.user.userId },
      include: {
        products: true,
        offers: true,
        reviews: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            reviewer: { select: { id: true, displayName: true, arabicName: true, avatar: true } },
          },
        },
        user: { select: { id: true, username: true, avatar: true } },
      }
    });
  } else {
    butcher = await prisma.butcher.findUnique({
      where: { id },
      include: {
        products: true,
        offers: true,
        reviews: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            reviewer: { select: { id: true, displayName: true, arabicName: true, avatar: true } },
          },
        },
        user: { select: { id: true, username: true, avatar: true } },
      }
    });
  }

  if (!butcher) return apiError(res, 404, 'not_found', 'الملحمة غير موجودة');

  if (isMe) {
    await cacheSet(`butcher:${id}`, butcher, 300);
  }
  return apiResponse(res, butcher);
}

async function updateButcher(req: AuthedRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  if (!id) return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');

  let butcher = await prisma.butcher.findUnique({
    where: id === 'me' ? { userId: req.user.userId } : { id },
    select: { id: true, userId: true },
  });

  if (!butcher) return apiError(res, 404, 'not_found', 'الملحمة غير موجودة');
  if (butcher.userId !== req.user.userId && req.user.role !== 'ADMIN') {
    return apiError(res, 403, 'forbidden', 'غير مسموح');
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const updated = await prisma.butcher.update({
    where: { id: butcher.id },
    data: parsed.data,
  });

  await cacheDel(`butcher:${id}`);
  await cacheDel('butcher:me');
  await cacheDel(`butcher:${butcher.id}`);
  await cacheDelPattern('butchers:v2:*').catch(() => {});

  logger.info({ butcherId: butcher.id, userId: req.user.userId }, 'Butcher profile updated');
  return apiResponse(res, updated);
}
