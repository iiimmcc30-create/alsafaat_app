// pages/api/stories/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, withOptionalAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { cacheGet, cacheSet, cacheDel } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { STORY_SLIDE_DURATION_SEC, storyExpiresAt } from '@/lib/stories';

const createSchema = z.object({
  thumbnail:    z.string().url(),
  mediaUrl:     z.string().url().optional().nullable(),
  caption:      z.string().max(200).optional().nullable(),
  captionAr:    z.string().max(200).optional().nullable(),
  isLive:       z.boolean().default(false),
  liveStreamId: z.string().uuid().optional().nullable(),
  listingId:    z.string().uuid().optional().nullable(),
}).strict();

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'GET')  return getStories(req, res);
  if (req.method === 'POST') return withAuth(req, res, createStory);
  return res.status(405).end();
}

// GET /api/stories
async function getStories(req: NextApiRequest, res: NextApiResponse) {
  const cacheKey = 'stories:active';
  const cached = await cacheGet(cacheKey);
  if (cached) return apiResponse(res, cached);

  try {
    const activeStories = await prisma.story.findMany({
      where: {
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            arabicName: true,
            avatar: true,
            verified: true,
            country: true,
          }
        }
      }
    });

    await cacheSet(cacheKey, activeStories, 30); // 30s TTL
    return apiResponse(res, activeStories);
  } catch (err) {
    logger.error({ err }, 'Fetch active stories error');
    return apiError(res, 500, 'server_error', 'خطأ في الخادم');
  }
}

// POST /api/stories
async function createStory(req: AuthedRequest, res: NextApiResponse) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const { userId } = req.user;
  const expiresAt = storyExpiresAt();

  try {
    const story = await prisma.story.create({
      data: {
        ...parsed.data,
        duration: STORY_SLIDE_DURATION_SEC,
        userId,
        expiresAt,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            arabicName: true,
            avatar: true,
            verified: true,
            country: true,
          }
        }
      }
    });

    await cacheDel('stories:active');
    logger.info({ storyId: story.id, userId }, 'Story created successfully');
    return apiResponse(res, story, 201);
  } catch (err) {
    logger.error({ err }, 'Create story error');
    return apiError(res, 500, 'server_error', 'خطأ في الخادم');
  }
}
