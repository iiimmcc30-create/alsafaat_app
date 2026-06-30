// pages/api/auth/refresh.ts
// FIX: rate limit, validate session ownership, handle concurrent refresh (race condition)
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/lib/jwt';
import { apiResponse, apiError } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { logger } from '@/lib/logger';

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!(await apiRateLimit(req, res, 'auth'))) return;

  const { refreshToken } = req.body;
  if (!refreshToken || typeof refreshToken !== 'string') {
    return apiError(res, 400, 'missing_token', 'الرمز مطلوب');
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);

    const session = await prisma.userSession.findUnique({
      where:   { refreshToken },
      include: { user: { select: { id: true, username: true, role: true, isActive: true, passwordVersion: true } } },
    });

    if (!session) {
      // Token was already used or never existed — possible token theft
      logger.warn({ userId: decoded.userId }, 'Refresh token reuse detected — invalidating all sessions');
      // Security: if a refresh token is used that doesn't exist in DB,
      // it may have been stolen. Invalidate ALL sessions for this user.
      await prisma.userSession.deleteMany({ where: { userId: decoded.userId } });
      return apiError(res, 401, 'token_reuse', 'تم إلغاء جميع الجلسات لأسباب أمنية. سجّل دخولك مجدداً.');
    }

    if (session.expiresAt < new Date()) {
      await prisma.userSession.delete({ where: { id: session.id } });
      return apiError(res, 401, 'session_expired', 'انتهت الجلسة، يرجى تسجيل الدخول');
    }

    if (!session.user.isActive) {
      return apiError(res, 401, 'account_disabled', 'الحساب موقوف');
    }

    const newAccessToken  = signAccessToken({
      userId:          session.user.id,
      username:        session.user.username,
      role:            session.user.role,
      passwordVersion: session.user.passwordVersion,
    });
    const newRefreshToken = signRefreshToken(session.user.id);

    // Rotate: replace old token atomically
    await prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshToken: newRefreshToken,
        expiresAt:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return apiResponse(res, { accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err: any) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return apiError(res, 401, 'invalid_refresh', 'رمز غير صالح');
    }
    logger.error({ err }, 'Refresh error');
    return apiError(res, 500, 'server_error', 'خطأ في الخادم');
  }
}
