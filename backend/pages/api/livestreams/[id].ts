// pages/api/livestreams/[id].ts
// POST /api/livestreams/:id/start  — host goes live (sets isLive=true, records startedAt)
// POST /api/livestreams/:id/end    — host ends stream
// GET  /api/livestreams/:id/token  — viewer requests Agora RTC token
// GET  /api/livestreams/:id        — get stream details + last 50 comments

import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { withAuth, withOptionalAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { logger } from '@/lib/logger';
import { generateViewerToken, streamIdToChannel } from '@/lib/agora';
import { cacheDel, CacheKeys } from '@/lib/redis';
import { checkLiveStreamAccess } from '@/lib/liveStreamAccess';
import { notifyUsers } from '@/lib/notifications';

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, action } = req.query as { id: string; action?: string };

  if (!id || typeof id !== 'string') {
    return apiError(res, 400, 'missing_id', 'معرّف البث مطلوب');
  }

  // Route by action query param: /api/livestreams/UUID?action=start|end|token
  if (req.method === 'POST' && action === 'start') return withAuth(req, res, (r, s) => startStream(r, s, id));
  if (req.method === 'POST' && action === 'end')   return withAuth(req, res, (r, s) => endStream(r, s, id));
  if (req.method === 'GET'  && action === 'token') return withAuth(req, res, (r, s) => getViewerToken(r, s, id));
  if (req.method === 'GET'  && !action)            return withOptionalAuth(req, res, (r, s) => getStream(r, s, id));

  return res.status(405).end();
}

// ── POST /api/livestreams/:id?action=start ────────────────────────────────────

async function startStream(req: AuthedRequest, res: NextApiResponse, id: string) {
  if (!(await apiRateLimit(req, res, 'api'))) return;

  try {
    const stream = await prisma.liveStream.findUnique({
      where:  { id },
      select: { id: true, hostId: true, isLive: true, title: true, arabicTitle: true, category: true },
    });

    if (!stream)                        return apiError(res, 404, 'not_found', 'البث غير موجود');
    if (stream.hostId !== req.user.userId) return apiError(res, 403, 'forbidden', 'غير مسموح');
    if (stream.isLive)                  return apiError(res, 409, 'already_live', 'البث نشط بالفعل');

    const sub = await prisma.subscription.findUnique({
      where:  { userId: req.user.userId },
      select: { planId: true, liveMinutesUsed: true },
    });

    const access = checkLiveStreamAccess(sub);
    if (!access.allowed) {
      return apiError(res, 403, access.code, access.messageAr);
    }

    await prisma.liveStream.update({
      where: { id },
      data:  { isLive: true, startedAt: new Date() },
    });

    // Invalidate live streams cache so new stream appears immediately
    await cacheDel(CacheKeys.liveStreams());

    // Notify followers async (fire and forget)
    notifyFollowers(req.user.userId, stream).catch(() => {});

    logger.info({ streamId: id, userId: req.user.userId }, 'Stream started');

    return apiResponse(res, { started: true, startedAt: new Date() });
  } catch (err) {
    logger.error({ err }, 'Start stream error');
    return apiError(res, 500, 'server_error', 'خطأ في الخادم');
  }
}

// ── POST /api/livestreams/:id?action=end ─────────────────────────────────────

async function endStream(req: AuthedRequest, res: NextApiResponse, id: string) {
  if (!(await apiRateLimit(req, res, 'api'))) return;

  try {
    const stream = await prisma.liveStream.findUnique({
      where:  { id },
      select: { id: true, hostId: true, isLive: true, startedAt: true, viewers: true, peakViewers: true },
    });

    if (!stream)                           return apiError(res, 404, 'not_found', 'البث غير موجود');
    if (stream.hostId !== req.user.userId) return apiError(res, 403, 'forbidden', 'غير مسموح');

    const endedAt = new Date();
    const durationMinutes = stream.startedAt
      ? Math.round((endedAt.getTime() - stream.startedAt.getTime()) / 60000)
      : 0;

    await prisma.liveStream.update({
      where: { id },
      data:  { isLive: false, endedAt, viewers: 0 },
    });

    if (durationMinutes > 0) {
      await prisma.subscription.updateMany({
        where: { userId: req.user.userId },
        data:  { liveMinutesUsed: { increment: durationMinutes } },
      }).catch(() => {});
    }

    await cacheDel(CacheKeys.liveStreams());

    logger.info({ streamId: id, durationMinutes }, 'Stream ended');

    return apiResponse(res, {
      ended:           true,
      endedAt,
      durationMinutes,
      peakViewers:     stream.peakViewers,
    });
  } catch (err) {
    logger.error({ err }, 'End stream error');
    return apiError(res, 500, 'server_error', 'خطأ في الخادم');
  }
}

// ── GET /api/livestreams/:id?action=token ─────────────────────────────────────
// Viewer requests a fresh Agora RTC token. Short TTL — clients renew before expiry.

async function getViewerToken(req: AuthedRequest, res: NextApiResponse, id: string) {
  if (!(await apiRateLimit(req, res, 'api'))) return;

  try {
    const stream = await prisma.liveStream.findUnique({
      where:  { id },
      select: { id: true, isLive: true },
    });

    if (!stream)        return apiError(res, 404, 'not_found', 'البث غير موجود');
    if (!stream.isLive) return apiError(res, 410, 'stream_ended', 'انتهى البث');

    const agoraChannel = streamIdToChannel(id);
    const { token: agoraToken, uid: agoraUid } = generateViewerToken(id, req.user.userId);

    return apiResponse(res, {
      agoraAppId:   process.env.AGORA_APP_ID,
      agoraChannel,
      agoraToken,
      agoraUid,
      expiresIn:    7200, // 2 hours in seconds
    });
  } catch (err) {
    logger.error({ err }, 'Get viewer token error');
    return apiError(res, 500, 'server_error', 'خطأ في الخادم');
  }
}

// ── GET /api/livestreams/:id ──────────────────────────────────────────────────

async function getStream(req: any, res: NextApiResponse, id: string) {
  if (!(await apiRateLimit(req, res, 'api'))) return;

  try {
    const stream = await prisma.liveStream.findUnique({
      where: { id },
      select: {
        id:          true,
        title:       true,
        arabicTitle: true,
        category:    true,
        topic:       true,
        thumbnail:   true,
        isLive:      true,
        viewers:     true,
        peakViewers: true,
        likes:       true,
        startedAt:   true,
        endedAt:     true,
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
        comments: {
          orderBy: { createdAt: 'desc' },
          take:    50,
          select: {
            id:          true,
            userId:      true,
            username:    true,
            arabicName:  true,
            message:     true,
            avatar:      true,
            isOffer:     true,
            offerAmount: true,
            createdAt:   true,
          },
        },
      },
    });

    if (!stream) return apiError(res, 404, 'not_found', 'البث غير موجود');

    return apiResponse(res, stream);
  } catch (err) {
    logger.error({ err }, 'Get stream error');
    return apiError(res, 500, 'server_error', 'خطأ في الخادم');
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function notifyFollowers(
  hostId: string,
  stream: { arabicTitle: string; title: string; id: string },
) {
  const followers = await prisma.follow.findMany({
    where:  { followingId: hostId },
    select: { followerId: true },
    take:   500, // cap to avoid huge fan-out
  });

  await notifyUsers(
    followers.map((f) => f.followerId),
    {
      type:    'live_start',
      titleAr: 'بث مباشر جديد',
      bodyAr:  `${stream.arabicTitle} — ابدأ المشاهدة الآن`,
      data:    { streamId: stream.id },
    },
  );
}
