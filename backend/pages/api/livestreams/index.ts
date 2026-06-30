// pages/api/livestreams/index.ts
// POST  — create a new live stream session → returns Agora host token
// GET   — list active live streams (public, paginated)

import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { logger } from '@/lib/logger';
import { generateHostToken, streamIdToChannel } from '@/lib/agora';
import { cacheGet, cacheSet, CacheKeys } from '@/lib/redis';
import { checkLiveStreamAccess } from '@/lib/liveStreamAccess';

// ─── Validation ───────────────────────────────────────────────────────────────

const createSchema = z.object({
  title:       z.string().min(3).max(100),
  arabicTitle: z.string().min(3).max(100),
  category:    z.enum(['camels', 'horses', 'sheep', 'goats', 'cattle', 'falcons', 'feed', 'general']),
  topic:       z.string().max(200).optional(),
  thumbnail:   z.string().url().optional(),
}).strict();

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') return listStreams(req, res);
  if (req.method === 'POST') return withAuth(req, res, createStream);
  return res.status(405).end();
}

// ── GET /api/livestreams ──────────────────────────────────────────────────────

async function listStreams(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res, 'api'))) return;

  const cacheKey = CacheKeys.liveStreams();
  const cached = await cacheGet(cacheKey);
  if (cached) return apiResponse(res, cached);

  try {
    const streams = await prisma.liveStream.findMany({
      where:   { isLive: true },
      orderBy: { viewers: 'desc' },
      take:    30,
      select: {
        id:          true,
        title:       true,
        arabicTitle: true,
        category:    true,
        topic:       true,
        thumbnail:   true,
        viewers:     true,
        peakViewers: true,
        likes:       true,
        startedAt:   true,
        host: {
          select: {
            id:          true,
            username:    true,
            displayName: true,
            arabicName:  true,
            avatar:      true,
            verified:    true,
            country:     true,
          },
        },
      },
    });

    await cacheSet(cacheKey, streams, 15); // 15s TTL — live data stays fresh
    return apiResponse(res, streams);
  } catch (err) {
    logger.error({ err }, 'List livestreams error');
    return apiError(res, 500, 'server_error', 'خطأ في الخادم');
  }
}

// ── POST /api/livestreams ─────────────────────────────────────────────────────

async function createStream(req: AuthedRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res, 'api'))) return;

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const { userId } = req.user;

  try {
    // Check if user already has an active stream
    const existing = await prisma.liveStream.findFirst({
      where:  { hostId: userId, isLive: true },
      select: { id: true },
    });

    if (existing) {
      return apiError(res, 409, 'stream_exists', 'لديك بث مباشر نشط بالفعل');
    }

    const listingsCount = await prisma.listing.count({
      where: { sellerId: userId },
    });

    if (listingsCount === 0) {
      return apiError(
        res,
        403,
        'listing_required',
        'يجب نشر إعلان واحد على الأقل في السوق قبل بدء بث مباشر',
      );
    }

    const sub = await prisma.subscription.findUnique({
      where:  { userId },
      select: { planId: true, liveMinutesUsed: true },
    });

    const access = checkLiveStreamAccess(sub);
    if (!access.allowed) {
      return apiError(res, 403, access.code, access.messageAr);
    }

    // Create stream record
    const stream = await prisma.liveStream.create({
      data: {
        hostId:      userId,
        title:       parsed.data.title,
        arabicTitle: parsed.data.arabicTitle,
        category:    parsed.data.category,
        topic:       parsed.data.topic,
        thumbnail:   parsed.data.thumbnail,
        // isLive stays false until host calls /start
      },
      select: { id: true, streamKey: true },
    });

    // Generate Agora channel & host token (channel is derived from stream id)
    const agoraChannel = streamIdToChannel(stream.id);
    const { token: agoraToken, uid: agoraUid } = generateHostToken(stream.id, userId);

    logger.info({ streamId: stream.id, userId }, 'Live stream created');

    return apiResponse(res, {
      streamId:     stream.id,
      agoraAppId:   process.env.AGORA_APP_ID,
      agoraChannel,
      agoraToken,
      agoraUid,
    }, 201);
  } catch (err) {
    logger.error({ err }, 'Create livestream error');
    return apiError(res, 500, 'server_error', 'خطأ في الخادم');
  }
}
