// pages/api/auth/verify-email.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { sessionGet, sessionDel } from '@/lib/redis';
import { apiRateLimit } from '@/middleware/rateLimiter';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

const schema = z.object({ code: z.string().length(6).regex(/^\d+$/) }).strict();

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!(await apiRateLimit(req, res, 'auth'))) return;
  return withAuth(req, res, verifyEmail);
}

async function verifyEmail(req: AuthedRequest, res: NextApiResponse) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, 'validation_error', 'رمز غير صالح');

  const storedCode = await sessionGet<string>(`email_verify:${req.user.userId}`);
  if (!storedCode) return apiError(res, 410, 'code_expired', 'انتهت صلاحية الرمز، اطلب رمزاً جديداً');

  if (storedCode !== parsed.data.code) {
    return apiError(res, 400, 'invalid_code', 'الرمز غير صحيح');
  }

  // FIX: use emailVerified (schema field), not verified (platform badge)
  await prisma.user.update({
    where: { id: req.user.userId },
    data:  { emailVerified: true },
  });
  await sessionDel(`email_verify:${req.user.userId}`);

  logger.info({ userId: req.user.userId }, 'Email verified');
  return apiResponse(res, { verified: true });
}
