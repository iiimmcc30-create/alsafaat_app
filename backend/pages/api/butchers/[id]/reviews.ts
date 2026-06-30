// pages/api/butchers/[id]/reviews.ts
// GET  /api/butchers/[id]/reviews — get reviews for a butcher
// POST /api/butchers/[id]/reviews — submit a review
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, withOptionalAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { cacheDel } from '@/lib/redis';
import { logger } from '@/lib/logger';

const reviewSchema = z.object({
  rating:  z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
}).strict();

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'GET')  return withOptionalAuth(req, res, getReviews);
  if (req.method === 'POST') return withAuth(req, res, submitReview);
  return res.status(405).end();
}

async function getReviews(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  if (!id) return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');

  const butcher = await prisma.butcher.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!butcher) return apiError(res, 404, 'not_found', 'الملحمة غير موجودة');

  const reviews = await prisma.butcherReview.findMany({
    where: { butcherId: id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      reviewer: {
        select: { id: true, displayName: true, arabicName: true, avatar: true, verified: true },
      },
    },
  });

  return apiResponse(res, reviews);
}

async function submitReview(req: AuthedRequest, res: NextApiResponse) {
  const { id: butcherId } = req.query as { id: string };
  const reviewerId = req.user.userId;

  const butcher = await prisma.butcher.findUnique({
    where: { id: butcherId },
    select: { id: true, userId: true },
  });
  if (!butcher) return apiError(res, 404, 'not_found', 'الملحمة غير موجودة');

  // Can't review your own butcher profile
  if (butcher.userId === reviewerId) {
    return apiError(res, 400, 'invalid_action', 'لا يمكنك تقييم ملحمتك الخاصة');
  }

  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  try {
    const review = await prisma.butcherReview.upsert({
      where: { butcherId_reviewerId: { butcherId, reviewerId } },
      update: { rating: parsed.data.rating, comment: parsed.data.comment },
      create: { butcherId, reviewerId, rating: parsed.data.rating, comment: parsed.data.comment },
      include: {
        reviewer: {
          select: { id: true, displayName: true, arabicName: true, avatar: true },
        },
      },
    });

    // Recalculate average rating
    const agg = await prisma.butcherReview.aggregate({
      where: { butcherId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await prisma.butcher.update({
      where: { id: butcherId },
      data: {
        rating:      agg._avg.rating ?? 0,
        reviewCount: agg._count.rating,
      },
    });

    // Invalidate caches
    await cacheDel(`butcher:${butcherId}`);

    logger.info({ butcherId, reviewerId }, 'Butcher review submitted');
    return apiResponse(res, review, 201);
  } catch (err: any) {
    if (err.code === 'P2002') {
      return apiError(res, 409, 'already_reviewed', 'لقد قيّمت هذه الملحمة من قبل');
    }
    logger.error({ err }, 'Submit review error');
    return apiError(res, 500, 'server_error', 'خطأ في الخادم');
  }
}
