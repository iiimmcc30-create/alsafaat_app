// pages/api/butchers/stories/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { cacheGet, cacheSet, cacheDel } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { STORY_SLIDE_DURATION_SEC, storyExpiresAt } from '@/lib/stories';

const createSchema = z.object({
  thumbnail: z.string().url(),
  caption:   z.string().max(200).optional().nullable(),
  captionAr: z.string().max(200).optional().nullable(),
  type:      z.enum(['daily_slaughter', 'offer', 'new_stock', 'update']),
}).strict();

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'GET')  return getButcherStories(req, res);
  if (req.method === 'POST') return withAuth(req, res, createButcherStory);
  return res.status(405).end();
}

// GET /api/butchers/stories
async function getButcherStories(req: NextApiRequest, res: NextApiResponse) {
  const cacheKey = 'butchers:stories:active';
  const cached = await cacheGet(cacheKey);
  if (cached) return apiResponse(res, cached);

  try {
    const activeStories = await prisma.butcherStory.findMany({
      where: {
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        butcher: {
          select: {
            id: true,
            nameAr: true,
            nameEn: true,
            logo: true,
            subscriptionActive: true,
            country: true,
          }
        }
      }
    });

    await cacheSet(cacheKey, activeStories, 30); // 30s TTL
    return apiResponse(res, activeStories);
  } catch (err) {
    logger.error({ err }, 'Fetch active butcher stories error');
    return apiError(res, 500, 'server_error', 'خطأ في الخادم');
  }
}

// POST /api/butchers/stories
async function createButcherStory(req: AuthedRequest, res: NextApiResponse) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const { userId } = req.user;

  try {
    const butcher = await prisma.butcher.findUnique({
      where: { userId },
      select: { id: true }
    });

    if (!butcher) {
      return apiError(res, 403, 'butcher_profile_required', 'يجب أن تمتلك ملف ملحمة نشط لنشر القصص');
    }

    const expiresAt = storyExpiresAt();

    const story = await prisma.butcherStory.create({
      data: {
        ...parsed.data,
        duration: STORY_SLIDE_DURATION_SEC,
        butcherId: butcher.id,
        expiresAt,
      },
      include: {
        butcher: {
          select: {
            id: true,
            nameAr: true,
            nameEn: true,
            logo: true,
            subscriptionActive: true,
            country: true,
          }
        }
      }
    });

    await cacheDel('butchers:stories:active');
    logger.info({ storyId: story.id, butcherId: butcher.id }, 'Butcher story created successfully');
    return apiResponse(res, story, 201);
  } catch (err) {
    logger.error({ err }, 'Create butcher story error');
    return apiError(res, 500, 'server_error', 'خطأ في الخادم');
  }
}
