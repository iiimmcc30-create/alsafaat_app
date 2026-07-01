// pages/api/auth/register.ts
// التسجيل عبر رقم الجوال (OTP محقق) أو Google مع التحقق الإلزامي من رقم الجوال

import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { signAccessToken, signRefreshToken } from '@/lib/jwt';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { apiResponse, apiError } from '@/middleware/auth';
import { logger } from '@/lib/logger';
import { countrySchema } from '@/lib/countries';

const schema = z.object({
  // بيانات أساسية
  phone:       z.string().regex(/^\+\d{9,14}$/),
  phone_token: z.string().min(10),
  displayName: z.string().min(2).max(50).trim(),
  arabicName:  z.string().min(2).max(50).trim().optional(),
  username:    z.string().min(3).max(30).regex(/^[a-z0-9_]+$/, 'أحرف إنجليزية صغيرة وأرقام وشرطة سفلية فقط'),
  country:     countrySchema.default('SA'),
  // اختياري (للتسجيل بكلمة مرور)
  password:    z.string().min(6).max(128).optional(),

  // إذا عبر Google
  googleId:    z.string().optional(),
  email:       z.string().email().toLowerCase().optional(),
  avatar:      z.string().url().optional(),
});

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!(await apiRateLimit(req, res, 'auth'))) return;

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const { phone, phone_token, displayName, arabicName, username, country, password, googleId, email, avatar } = parsed.data;

  if (req.body?.role === 'BUTCHER') {
    return apiError(res, 400, 'invalid_role', 'تسجيل الملاحم يتم من صفحة تسجيل الملاحم فقط');
  }

  // 1. التحقق من الـ phone_token
  try {
    const decoded = jwt.verify(phone_token, process.env.JWT_SECRET!) as { phone: string; verified: boolean };
    if (!decoded.verified || decoded.phone !== phone) {
      return apiError(res, 400, 'invalid_phone_token', 'رمز تحقق الجوال غير صحيح أو لا يطابق رقم الجوال');
    }
  } catch (err) {
    return apiError(res, 400, 'invalid_phone_token', 'رمز تحقق الجوال منتهي الصلاحية أو غير صحيح');
  }

  try {
    // 2. تحقق من عدم وجود المستخدم مسبقاً
    const orConditions: any[] = [{ username }, { phone }];
    if (email)    orConditions.push({ email });
    if (googleId) orConditions.push({ googleId });

    const exists = await prisma.user.findFirst({
      where:  { OR: orConditions },
      select: { phone: true, username: true, email: true, googleId: true },
    });

    if (exists) {
      if (exists.username === username) return apiError(res, 409, 'username_taken', 'اسم المستخدم مستخدم بالفعل');
      if (exists.phone === phone)       return apiError(res, 409, 'phone_taken', 'رقم الجوال مسجّل بالفعل');
      if (email    && exists.email === email)       return apiError(res, 409, 'email_taken', 'البريد الإلكتروني مستخدم بالفعل');
      if (googleId && exists.googleId === googleId) return apiError(res, 409, 'google_linked', 'حساب Google مرتبط بمستخدم آخر');
    }

    // 3. معالجة وتشفير كلمة المرور
    let passwordHash: string;
    if (password) {
      passwordHash = await bcrypt.hash(password, 12);
    } else {
      // توليد كلمة مرور عشوائية للتسجيل الخالي من كلمة المرور (مثل Google أو OTP المباشر) لتخطي قيد الـ database
      const randomPassword = Math.random().toString(36).slice(-8) + Date.now().toString(36);
      passwordHash = await bcrypt.hash(randomPassword, 12);
    }

    const user = await prisma.user.create({
      data: {
        username,
        displayName,
        arabicName:   arabicName ?? displayName,
        country:      country as any,
        phone,
        email:        email ?? null,
        googleId:     googleId ?? null,
        avatar:       avatar ?? null,
        passwordHash,
        role:         'USER',
        isActive:     true,
        verified:     !!googleId,    // حسابات Google تكون موثقة تلقائياً
        subscription: {
          create: {
            planId:    'free',
            renewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
        },
      },
      include: { subscription: true },
    });

    const accessToken  = signAccessToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      passwordVersion: user.passwordVersion,
    });
    const refreshToken = signRefreshToken(user.id);

    await prisma.userSession.create({
      data: {
        userId:     user.id,
        refreshToken,
        expiresAt:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ipAddress:  req.socket.remoteAddress,
        deviceInfo: req.headers['user-agent']?.slice(0, 200),
      },
    });

    logger.info({ userId: user.id, via: googleId ? 'google' : 'otp' }, 'User registered');

    return apiResponse(res, {
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
    }, 201);
  } catch (err) {
    logger.error({ err }, 'Register error');
    return apiError(res, 500, 'server_error', 'خطأ في الخادم');
  }
}
