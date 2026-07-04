// pages/api/upload/presign.ts
// FIX: validate file count per user per hour, validate folder access by role
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import {
  getPresignedUploadUrl,
  getStorageProvider,
  type UploadFolder,
  type UploadSlot,
} from '@/lib/storage';
import { getSessionRedis, isRedisEnabled } from '@/lib/redis';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_SHOP_PHOTO_FILE_BYTES,
} from '@/butcher-applications/constants';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
const MAX_UPLOADS_PER_HOUR = 30; // per user

const FOLDERS = [
  'avatars',
  'listings',
  'stories',
  'butchers',
  'posts',
  'temp',
  'butcher-applications',
] as const;

const schema = z
  .object({
    mimetype: z.string(),
    folder: z.enum(FOLDERS),
    count: z.number().int().min(1).max(8).default(1),
  })
  .strict()
  .superRefine((data, ctx) => {
    const allowed =
      data.folder === 'butcher-applications'
        ? ALLOWED_DOCUMENT_MIME_TYPES
        : IMAGE_MIME_TYPES;

    if (!allowed.includes(data.mimetype as (typeof allowed)[number])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `نوع الملف غير مدعوم. المسموح: ${allowed.join(', ')}`,
        path: ['mimetype'],
      });
    }
  });

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

function butcherApplicationFileKey(userId: string, slot: UploadSlot): string | undefined {
  if (slot.provider === 's3') return slot.key;
  if (slot.provider === 'cloudinary') {
    return `butcher-applications/${userId}/${slot.publicId}`;
  }
  return undefined;
}

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
  const presignOptions =
    folder === 'butcher-applications' ? { userId: req.user.userId } : undefined;

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
        getPresignedUploadUrl(folder as UploadFolder, mimetype, 300, presignOptions),
      ),
    );

    const maxSizeMb =
      folder === 'butcher-applications'
        ? Math.ceil(MAX_SHOP_PHOTO_FILE_BYTES / (1024 * 1024))
        : 20;

    const normalizedUrls =
      folder === 'butcher-applications'
        ? urls.map((slot) => {
            const fileKey = butcherApplicationFileKey(req.user.userId, slot);
            return fileKey ? { ...slot, fileKey } : slot;
          })
        : urls;

    return apiResponse(res, {
      provider: getStorageProvider(),
      urls: normalizedUrls,
      maxSizeMb,
    });
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes('Cloudinary')
        ? 'Cloudinary غير مُعدّ. أضف CLOUDINARY_* في backend/.env'
        : 'خطأ في خدمة التخزين';
    return apiError(res, 503, 'storage_error', message);
  }
}
