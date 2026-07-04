// pages/api/admin/butcher-applications/[id].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { withAdmin, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { butcherApplicationAdminService } from '@/butcher-applications/services/admin.service';
import { handleButcherApplicationError } from '@/butcher-applications/helpers/httpError';
import { parseApplicationId } from '@/butcher-applications/routes/parseRequest';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method !== 'GET') return res.status(405).end();

  return withAdmin(req, res, getApplication);
}

async function getApplication(req: AuthedRequest, res: NextApiResponse) {
  const applicationId = parseApplicationId(req.query);
  if (!applicationId) {
    return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');
  }

  try {
    const application = await butcherApplicationAdminService.getApplication(applicationId);
    return apiResponse(res, application);
  } catch (err) {
    handleButcherApplicationError(res, err);
  }
}
