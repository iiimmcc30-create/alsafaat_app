// pages/api/butcher-applications/[id]/documents/[documentId].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { butcherApplicationDocumentService } from '@/butcher-applications/services/document.service';
import { handleButcherApplicationError } from '@/butcher-applications/helpers/httpError';
import {
  parseApplicationId,
  parseDocumentId,
} from '@/butcher-applications/routes/parseRequest';
import { documentReplaceBodySchema } from '@/butcher-applications/routes/schemas';

export const config = { api: { bodyParser: { sizeLimit: '32kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;

  if (req.method === 'PATCH') return withAuth(req, res, replaceDocument);
  if (req.method === 'DELETE') return withAuth(req, res, deleteDocument);

  return res.status(405).end();
}

async function replaceDocument(req: AuthedRequest, res: NextApiResponse) {
  const applicationId = parseApplicationId(req.query);
  const documentId = parseDocumentId(req.query);

  if (!applicationId || !documentId) {
    return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');
  }

  const parsed = documentReplaceBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  try {
    const document = await butcherApplicationDocumentService.replaceDocument(
      req.user.userId,
      applicationId,
      documentId,
      parsed.data,
    );
    return apiResponse(res, document);
  } catch (err) {
    handleButcherApplicationError(res, err);
  }
}

async function deleteDocument(req: AuthedRequest, res: NextApiResponse) {
  const applicationId = parseApplicationId(req.query);
  const documentId = parseDocumentId(req.query);

  if (!applicationId || !documentId) {
    return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');
  }

  try {
    await butcherApplicationDocumentService.deleteDocument(
      req.user.userId,
      applicationId,
      documentId,
    );
    return res.status(204).end();
  } catch (err) {
    handleButcherApplicationError(res, err);
  }
}
