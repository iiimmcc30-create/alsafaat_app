// pages/api/auth/verify-otp.ts
// التحقق من OTP عبر Twilio Verify + تسجيل دخول أو توجيه للتسجيل

import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import twilio from 'twilio';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';
import { signAccessToken, signRefreshToken } from '@/lib/jwt';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { apiResponse, apiError } from '@/middleware/auth';
import { logger } from '@/lib/logger';

const schema = z.object({
  phone:   z.string().min(10).max(15).regex(/^\+\d{9,14}$/),
  code:    z.string().length(6).regex(/^\d{6}$/),
  purpose: z.enum(['login', 'reset_password']).default('login'),
});

export const config = { api: { bodyParser: { sizeLimit: '2kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!(await apiRateLimit(req, res, 'auth'))) return;

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'invalid_input', 'بيانات غير صحيحة');
  }

  const { phone, code, purpose } = parsed.data;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  const isDevMode = !accountSid || accountSid === 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

  // ── Dev mode: قبول 123456 كـ OTP ──────────────────────────────────────────
  if (isDevMode) {
    if (code !== '123456') {
      return apiError(res, 400, 'invalid_code', 'الرمز غير صحيح (وضع التطوير: استخدم 123456)');
    }
  } else {
    // ── Twilio Verify ──────────────────────────────────────────────────────
    try {
      const client = twilio(accountSid!, authToken!);
      const check = await client.verify.v2
        .services(serviceSid!)
        .verificationChecks.create({ to: phone, code });

      if (check.status !== 'approved') {
        logger.warn({ phone }, 'OTP verification failed');
        return apiError(res, 400, 'invalid_code', 'الرمز غير صحيح أو منتهي الصلاحية');
      }
    } catch (err: any) {
      logger.error({ err, phone }, 'Twilio verify error');
      return apiError(res, 500, 'verify_failed', 'فشل التحقق. حاول مجدداً.');
    }
  }

  // ── OTP صحيح — ابحث عن المستخدم ──────────────────────────────────────────
  try {
    const user = await prisma.user.findFirst({
      where: { phone, isActive: true },
      include: { subscription: true },
    });

    if (purpose === 'reset_password') {
      if (!user) {
        return apiError(res, 404, 'not_found', 'لا يوجد حساب مرتبط بهذا الرقم');
      }

      const phoneToken = jwt.sign(
        { phone, verified: true, purpose: 'reset_password' },
        process.env.JWT_SECRET!,
        { expiresIn: '15m' }
      );

      logger.info({ userId: user.id }, 'OTP verified for password reset');

      return apiResponse(res, {
        verified: true,
        purpose: 'reset_password',
        phone,
        phone_token: phoneToken,
        message: 'تم التحقق — يمكنك تعيين كلمة مرور جديدة',
      });
    }

    if (!user) {
      // مستخدم جديد — وجّهه للتسجيل مع توثيق مؤقت
      const phoneToken = jwt.sign(
        { phone, verified: true },
        process.env.JWT_SECRET!,
        { expiresIn: '15m' }
      );

      return apiResponse(res, {
        verified: true,
        is_new_user: true,
        phone,
        phone_token: phoneToken,
        message: 'مستخدم جديد — يجب إكمال التسجيل',
      });
    }

    // مستخدم موجود — سجّل دخوله
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
          userId:      user.id,
          refreshToken,
          expiresAt:   new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          ipAddress:   req.socket.remoteAddress,
          deviceInfo:  req.headers['user-agent']?.slice(0, 200),
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data:  { lastSeenAt: new Date(), phone },
      }),
    ]);

    logger.info({ userId: user.id }, 'User logged in via OTP');

    return apiResponse(res, {
      verified:     true,
      is_new_user:  false,
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
    logger.error({ err }, 'OTP login DB error');
    return apiError(res, 500, 'server_error', 'خطأ في الخادم');
  }
}
