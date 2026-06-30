// pages/api/auth/google.ts
// تسجيل الدخول أو التسجيل عبر Google OAuth

import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { signAccessToken, signRefreshToken } from '@/lib/jwt';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { apiResponse, apiError } from '@/middleware/auth';
import { logger } from '@/lib/logger';

const schema = z.object({
  id_token: z.string().min(10),
});

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };

// ── التحقق من Google ID Token ─────────────────────────────────────────────────
function getAllowedGoogleClientIds(): string[] {
  const ids = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_WEB_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
  ].filter((id): id is string => Boolean(id && !id.includes('your_google')));
  return [...new Set(ids)];
}

async function verifyGoogleToken(idToken: string) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
  if (!res.ok) return null;
  const data = await res.json();

  const allowed = getAllowedGoogleClientIds();
  if (allowed.length > 0 && !allowed.includes(data.aud as string)) {
    return null;
  }

  return {
    googleId:    data.sub as string,
    email:       data.email as string,
    displayName: (data.name ?? data.email) as string,
    avatar:      (data.picture ?? null) as string | null,
    emailVerified: data.email_verified === 'true',
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!(await apiRateLimit(req, res, 'auth'))) return;

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'invalid_token', 'رمز Google غير صحيح');
  }

  const { id_token } = parsed.data;

  let googleUser;
  try {
    googleUser = await verifyGoogleToken(id_token);
    if (!googleUser) {
      return apiError(res, 401, 'invalid_google_token', 'فشل التحقق من حساب Google');
    }
  } catch {
    return apiError(res, 500, 'google_verify_error', 'خطأ في التحقق من Google');
  }

  try {
    // ابحث عن المستخدم بـ googleId أو email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId: googleUser.googleId },
          { email: googleUser.email },
        ],
      },
      include: { subscription: true },
    });

    if (!user) {
      // مستخدم جديد عبر Google — يجب إكمال التسجيل (اسم + رقم جوال)
      return apiResponse(res, {
        is_new_user:  true,
        google_id:    googleUser.googleId,
        email:        googleUser.email,
        display_name: googleUser.displayName,
        avatar:       googleUser.avatar,
        message:      'مستخدم جديد — يجب إكمال بيانات الملف الشخصي',
      });
    }

    // ربط googleId إن لم يكن مربوطاً
    if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data:  { googleId: googleUser.googleId, avatar: user.avatar ?? googleUser.avatar },
        include: { subscription: true },
      });
    }

    // إنشاء جلسة
    const sessionCount = await prisma.userSession.count({ where: { userId: user.id } });
    if (sessionCount >= 5) {
      const oldest = await prisma.userSession.findFirst({
        where: { userId: user.id }, orderBy: { createdAt: 'asc' }, select: { id: true },
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
          userId:     user.id,
          refreshToken,
          expiresAt:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          ipAddress:  req.socket.remoteAddress,
          deviceInfo: req.headers['user-agent']?.slice(0, 200),
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data:  { lastSeenAt: new Date() },
      }),
    ]);

    logger.info({ userId: user.id }, 'User logged in via Google');

    return apiResponse(res, {
      is_new_user: false,
      user: {
        id: user.id, username: user.username, email: user.email,
        displayName: user.displayName, arabicName: user.arabicName,
        avatar: user.avatar, verified: user.verified,
        country: user.country, role: user.role,
        subscription: user.subscription,
        phone: user.phone,
      },
      access_token:  accessToken,
      refresh_token: refreshToken,
    });
  } catch (err) {
    logger.error({ err }, 'Google login DB error');
    return apiError(res, 500, 'server_error', 'خطأ في الخادم');
  }
}
