// pages/api/auth/resend-verification.ts
import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { sessionSet, sessionGet } from '@/lib/redis';
import { addEmail } from '@/lib/queue';
import prisma from '@/lib/prisma';

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!(await apiRateLimit(req, res, 'auth'))) return;
  return withAuth(req, res, resend);
}

async function resend(req: AuthedRequest, res: NextApiResponse) {
  const cooldownKey = `email_verify_cooldown:${req.user.userId}`;
  const onCooldown  = await sessionGet<string>(cooldownKey);
  if (onCooldown) return apiError(res, 429, 'too_soon', 'انتظر دقيقة قبل طلب رمز جديد');

  const user = await prisma.user.findUnique({
    where:  { id: req.user.userId },
    select: { email: true, arabicName: true, emailVerified: true },
  });
  if (!user)               return apiError(res, 404, 'not_found', 'المستخدم غير موجود');
  if (user.emailVerified)  return apiError(res, 400, 'already_verified', 'البريد محقق بالفعل');

  const code = crypto.randomInt(100000, 999999).toString();
  await sessionSet(`email_verify:${req.user.userId}`, code, 600);
  await sessionSet(cooldownKey, '1', 60);

  await addEmail({
    to:        user.email,
    subject:   'تأكيد البريد الإلكتروني — الصفاة',
    template:  'email_verification',
    variables: { name: user.arabicName, code },
  });

  return apiResponse(res, { sent: true });
}
