// pages/api/auth/reset-password.ts
// إعادة تعيين كلمة المرور بعد التحقق من OTP

import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { apiResponse, apiError } from '@/middleware/auth';
import { logger } from '@/lib/logger';
import { disconnectUserSockets } from '@/socket-server';

const schema = z.object({
  phone:        z.string().regex(/^\+\d{9,14}$/),
  phone_token:  z.string().min(10),
  newPassword:  z.string().min(6).max(128),
}).strict();

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!(await apiRateLimit(req, res, 'auth'))) return;

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const { phone, phone_token, newPassword } = parsed.data;

  try {
    const decoded = jwt.verify(phone_token, process.env.JWT_SECRET!) as {
      phone: string;
      verified: boolean;
      purpose?: string;
    };

    if (!decoded.verified || decoded.phone !== phone) {
      return apiError(res, 400, 'invalid_phone_token', 'رمز تحقق الجوال غير صحيح أو لا يطابق رقم الجوال');
    }

    if (decoded.purpose && decoded.purpose !== 'reset_password') {
      return apiError(res, 400, 'invalid_phone_token', 'رمز التحقق غير مخصص لإعادة تعيين كلمة المرور');
    }
  } catch {
    return apiError(res, 400, 'invalid_phone_token', 'رمز تحقق الجوال منتهي الصلاحية أو غير صحيح');
  }

  try {
    const user = await prisma.user.findFirst({
      where: { phone, isActive: true },
      select: { id: true },
    });

    if (!user) {
      return apiError(res, 404, 'not_found', 'لا يوجد حساب مرتبط بهذا الرقم');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordVersion: { increment: 1 },
        },
      }),
      prisma.userSession.deleteMany({ where: { userId: user.id } }),
    ]);

    await disconnectUserSockets(user.id);

    logger.info({ userId: user.id }, 'Password reset via OTP');

    return apiResponse(res, {
      reset: true,
      message: 'تم تحديث كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.',
    });
  } catch (err) {
    logger.error({ err }, 'Reset password error');
    return apiError(res, 500, 'server_error', 'خطأ في الخادم');
  }
}
