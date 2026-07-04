// pages/api/butcher-applications/[id].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { butcherApplicationUserService } from '@/butcher-applications/services/application.service';
import { handleButcherApplicationError } from '@/butcher-applications/helpers/httpError';
import {
  parseApplicationId,
  parseIfUnmodifiedSince,
} from '@/butcher-applications/routes/parseRequest';
import { snapshotSchema } from '@/butcher-applications/routes/schemas';

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;

  if (req.method === 'GET') return withAuth(req, res, getApplication);
  if (req.method === 'PATCH') return withAuth(req, res, updateDraft);

  return res.status(405).end();
}

async function getApplication(req: AuthedRequest, res: NextApiResponse) {
  const applicationId = parseApplicationId(req.query);
  if (!applicationId) {
    return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');
  }

  try {
    const application = await butcherApplicationUserService.getApplication(
      req.user.userId,
      applicationId,
    );
    return apiResponse(res, application);
  } catch (err) {
    handleButcherApplicationError(res, err);
  }
}

async function updateDraft(req: AuthedRequest, res: NextApiResponse) {
  const applicationId = parseApplicationId(req.query);
  if (!applicationId) {
    return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');
  }

  const parsed = snapshotSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const ifUnmodifiedSince = parseIfUnmodifiedSince(req);
  if (ifUnmodifiedSince === null) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', {
      fieldErrors: { 'If-Unmodified-Since': ['Invalid date format'] },
    });
  }

  try {
    const application = await butcherApplicationUserService.updateDraft(
      req.user.userId,
      applicationId,
      parsed.data,
      ifUnmodifiedSince,
    );
    return apiResponse(res, application);
  } catch (err) {
    handleButcherApplicationError(res, err);
  }
}
