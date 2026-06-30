// pages/api/auth/change-password.ts
// FIX: invalidate ALL sessions when password changes — refresh tokens stay valid otherwise
import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { cacheSet, sessionSet, sessionGet, sessionDel } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { disconnectUserSockets } from '@/socket-server';

const schema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword:     z.string()
    .min(8).max(72)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number'),
}).strict();

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!(await apiRateLimit(req, res, 'auth'))) return;
  return withAuth(req, res, changePassword);
}

async function changePassword(req: AuthedRequest, res: NextApiResponse) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where:  { id: req.user.userId },
    select: { passwordHash: true },
  });
  if (!user) return apiError(res, 404, 'not_found', 'المستخدم غير موجود');

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return apiError(res, 401, 'wrong_password', 'كلمة المرور الحالية غير صحيحة');

  const newHash = await bcrypt.hash(newPassword, 12);

  // Update password AND delete all sessions atomically
  // This invalidates ALL refresh tokens — users on other devices must re-login
  await prisma.$transaction([
    prisma.user.update({
      where: { id: req.user.userId },
      data:  { passwordHash: newHash, passwordVersion: { increment: 1 } },
    }),
    prisma.userSession.deleteMany({ where: { userId: req.user.userId } }),
  ]);

  // Also blacklist the current access token
  const accessToken = req.headers.authorization!.slice(7);
  await sessionSet(`blacklist:${accessToken}`, true, 15 * 60);

  await disconnectUserSockets(req.user.userId);

  logger.info({ userId: req.user.userId }, 'Password changed — all sessions invalidated');
  return apiResponse(res, { changed: true, message: 'تم تغيير كلمة المرور. سجّل دخولك مجدداً.' });
}
