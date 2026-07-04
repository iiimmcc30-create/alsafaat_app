// pages/api/butcher-applications/[id]/documents/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { butcherApplicationDocumentService } from '@/butcher-applications/services/document.service';
import { handleButcherApplicationError } from '@/butcher-applications/helpers/httpError';
import { parseApplicationId } from '@/butcher-applications/routes/parseRequest';
import { documentUploadBodySchema } from '@/butcher-applications/routes/schemas';

export const config = { api: { bodyParser: { sizeLimit: '32kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method !== 'POST') return res.status(405).end();

  return withAuth(req, res, uploadDocument);
}

async function uploadDocument(req: AuthedRequest, res: NextApiResponse) {
  const applicationId = parseApplicationId(req.query);
  if (!applicationId) {
    return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');
  }

  const parsed = documentUploadBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  try {
    const document = await butcherApplicationDocumentService.uploadDocument(
      req.user.userId,
      applicationId,
      parsed.data,
    );
    return apiResponse(res, document, 201);
  } catch (err) {
    handleButcherApplicationError(res, err);
  }
}
