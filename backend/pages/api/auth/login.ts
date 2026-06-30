// pages/api/auth/login.ts
// FIX: rate limit uses 'auth' type, invalidate tokens on password change,
//      timing-safe credential check, session limit per user
import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { signAccessToken, signRefreshToken } from '@/lib/jwt';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { apiResponse, apiError } from '@/middleware/auth';
import { logger } from '@/lib/logger';

const schema = z.object({
  login:    z.string().min(1).max(254).toLowerCase().trim(),
  password: z.string().min(1).max(128),
}).strict();

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!(await apiRateLimit(req, res, 'auth'))) return;

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    // Return generic error — don't reveal which field is wrong
    return apiError(res, 401, 'invalid_credentials', 'بيانات الدخول غير صحيحة');
  }

  const { login, password } = parsed.data;

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: login },
          { username: login },
          { phone: login }
        ],
        isActive: true,
      },
      include: { subscription: true },
    });

    // Always run bcrypt even if user not found — prevents timing attacks
    // that reveal whether an email/username exists
    const dummyHash = '$2a$12$dummyhashfordummypassword1234567890abcdef';
    const hashToCompare = user?.passwordHash ?? dummyHash;
    const valid = await bcrypt.compare(password, hashToCompare);

    if (!user || !valid) {
      // Identical error for both "user not found" and "wrong password"
      logger.warn({ login: login.slice(0, 20) }, 'Failed login attempt');
      return apiError(res, 401, 'invalid_credentials', 'بيانات الدخول غير صحيحة');
    }

    // Enforce max 5 active sessions per user (prevent session flooding)
    const sessionCount = await prisma.userSession.count({ where: { userId: user.id } });
    if (sessionCount >= 5) {
      // Delete oldest session
      const oldest = await prisma.userSession.findFirst({
        where:   { userId: user.id },
        orderBy: { createdAt: 'asc' },
        select:  { id: true },
      });
      if (oldest) await prisma.userSession.delete({ where: { id: oldest.id } });
    }

    const accessToken  = signAccessToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      passwordVersion: user.passwordVersion,
    });
    const refreshToken = signRefreshToken(user.id);

    await prisma.$transaction([
      prisma.userSession.create({
        data: {
          userId:      user.id,
          refreshToken,
          expiresAt:   new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          ipAddress:   req.socket.remoteAddress,
          deviceInfo:  req.headers['user-agent']?.slice(0, 200),
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data:  { lastSeenAt: new Date() },
      }),
    ]);

    logger.info({ userId: user.id }, 'User logged in');

    return apiResponse(res, {
      user: {
        id: user.id, username: user.username, email: user.email,
        displayName: user.displayName, arabicName: user.arabicName,
        avatar: user.avatar, verified: user.verified,
        country: user.country, role: user.role,
        subscription: user.subscription,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    logger.error({ err }, 'Login error');
    return apiError(res, 500, 'server_error', 'خطأ في الخادم');
  }
}
