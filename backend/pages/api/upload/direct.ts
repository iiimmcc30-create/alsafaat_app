// POST /api/upload/direct — رفع محلي للتطوير (بدون Cloudinary/S3)
import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { withAuth, apiResponse, apiError, type AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { getStorageProvider, type UploadFolder } from '@/lib/storage';
import { logger } from '@/lib/logger';

export const config = { api: { bodyParser: false } };

const ALLOWED_FOLDERS: UploadFolder[] = [
  'avatars', 'listings', 'stories', 'butchers', 'posts', 'temp',
];

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function runMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  fn: (...args: unknown[]) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: unknown) => {
      if (result instanceof Error) reject(result);
      else resolve();
    });
  });
}

function createUploader(folder: UploadFolder) {
  const dest = path.join(process.cwd(), 'public', 'uploads', folder);
  fs.mkdirSync(dest, { recursive: true });

  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, dest),
      filename: (_req, file, cb) => {
        const ext = file.mimetype.split('/')[1] || 'jpg';
        cb(null, `${uuidv4()}.${ext}`);
      },
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_MIMES.has(file.mimetype)) {
        cb(new Error('نوع الملف غير مدعوم'));
        return;
      }
      cb(null, true);
    },
  }).single('file');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!(await apiRateLimit(req, res))) return;

  if (getStorageProvider() !== 'local') {
    return apiError(res, 404, 'not_available', 'الرفع المباشر متاح في وضع التطوير المحلي فقط');
  }

  return withAuth(req, res, uploadDirect);
}

async function uploadDirect(req: AuthedRequest, res: NextApiResponse) {
  const folderParam = (req.query.folder as string) || 'temp';
  if (!ALLOWED_FOLDERS.includes(folderParam as UploadFolder)) {
    return apiError(res, 400, 'validation_error', 'مجلد الرفع غير صالح');
  }

  const folder = folderParam as UploadFolder;

  try {
    const upload = createUploader(folder);
    await runMiddleware(req, res, upload);

    const file = (req as AuthedRequest & { file?: Express.Multer.File }).file;
    if (!file) {
      return apiError(res, 400, 'no_file', 'لم يُرسل أي ملف');
    }

    const host = req.headers.host;
    const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
    const base = host
      ? `${proto}://${host}`.replace(/\/$/, '')
      : (process.env.APP_URL || 'http://localhost:3001').replace(/\/$/, '');
    const publicPath = `/uploads/${folder}/${file.filename}`;
    const url = `${base}${publicPath}`;

    logger.info({ folder, filename: file.filename, userId: req.user.userId }, 'Local file uploaded');

    return apiResponse(res, { url, key: publicPath });
  } catch (err) {
    logger.error({ err }, 'Local upload failed');
    return apiError(res, 500, 'upload_failed', 'فشل رفع الملف');
  }
}
