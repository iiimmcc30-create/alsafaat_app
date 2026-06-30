// pages/api/auth/send-otp.ts
// إرسال OTP عبر Twilio Verify Service

import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import twilio from 'twilio';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { apiResponse, apiError } from '@/middleware/auth';
import { logger } from '@/lib/logger';

const schema = z.object({
  phone:   z.string().min(10).max(15).regex(/^\+\d{9,14}$/, 'رقم الجوال يجب أن يبدأ بـ + ويحتوي على أرقام فقط'),
  channel: z.enum(['sms', 'whatsapp']).default('sms'),
});

export const config = { api: { bodyParser: { sizeLimit: '2kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!(await apiRateLimit(req, res, 'auth'))) return;

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'invalid_phone', 'رقم الجوال غير صحيح');
  }

  const { phone, channel } = parsed.data;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !serviceSid ||
      accountSid.startsWith('AC...') || accountSid === 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
    // Dev mode: إذا لم تُضبط Twilio credentials بعد
    logger.warn({ phone }, 'Twilio not configured — using dev OTP mode');
    return apiResponse(res, {
      success:   true,
      dev_mode:  true,
      message:   'وضع التطوير: استخدم الكود 123456',
    });
  }

  try {
    const client = twilio(accountSid, authToken);
    const to = channel === 'whatsapp' ? `whatsapp:${phone}` : phone;

    await client.verify.v2
      .services(serviceSid)
      .verifications.create({ to, channel: channel === 'whatsapp' ? 'whatsapp' : 'sms' });

    logger.info({ phone }, 'OTP sent via Twilio');
    return apiResponse(res, { success: true, expiresIn: 120 });
  } catch (err: any) {
    logger.error({ err, phone }, 'Twilio send OTP error');
    return apiError(res, 500, 'otp_send_failed', 'فشل إرسال رمز التحقق. حاول مجدداً.');
  }
}
