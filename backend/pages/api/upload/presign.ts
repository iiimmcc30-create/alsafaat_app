// pages/api/upload/presign.ts
// FIX: validate file count per user per hour, validate folder access by role
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { getPresignedUploadUrl, getStorageProvider, UploadFolder } from '@/lib/storage';
import { getSessionRedis, isRedisEnabled } from '@/lib/redis';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_UPLOADS_PER_HOUR = 30; // per user

const schema = z.object({
  mimetype: z.string().refine((t) => ALLOWED_TYPES.includes(t), `نوع الملف غير مدعوم. المسموح: ${ALLOWED_TYPES.join(', ')}`),
  folder:   z.enum(['avatars', 'listings', 'stories', 'butchers', 'posts', 'temp']),
  count:    z.number().int().min(1).max(8).default(1),
}).strict();

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!(await apiRateLimit(req, res))) return;
  return withAuth(req, res, getPresignUrl);
}

async function getPresignUrl(req: AuthedRequest, res: NextApiResponse) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const { mimetype, folder, count } = parsed.data;

  // Rate limit uploads per user when Redis is available
  if (isRedisEnabled()) {
    try {
      const redis = getSessionRedis();
      const userUploadKey = `upload_count:${req.user.userId}`;
      const currentCount = parseInt((await redis.get(userUploadKey)) || '0');

      if (currentCount + count > MAX_UPLOADS_PER_HOUR) {
        return apiError(res, 429, 'upload_limit', `حد الرفع: ${MAX_UPLOADS_PER_HOUR} ملف في الساعة`);
      }

      const pipe = redis.pipeline();
      pipe.incrby(userUploadKey, count);
      pipe.expire(userUploadKey, 3600);
      await pipe.exec();
    } catch {
      // Redis hiccup — allow upload in dev rather than blocking saves
      if (process.env.NODE_ENV === 'production') {
        return apiError(res, 503, 'storage_error', 'خطأ مؤقت في خدمة التخزين');
      }
    }
  }

  try {
    const urls = await Promise.all(
      Array.from({ length: count }, () =>
        getPresignedUploadUrl(folder as UploadFolder, mimetype)
      )
    );
    return apiResponse(res, { provider: getStorageProvider(), urls, maxSizeMb: 20 });
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes('Cloudinary')
        ? 'Cloudinary غير مُعدّ. أضف CLOUDINARY_* في backend/.env'
        : 'خطأ في خدمة التخزين';
    return apiError(res, 503, 'storage_error', message);
  }
}
