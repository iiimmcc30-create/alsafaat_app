// pages/api/admin/butcher-applications/[id]/reject.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { withAdmin, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { butcherApplicationAdminService } from '@/butcher-applications/services/admin.service';
import { handleButcherApplicationError } from '@/butcher-applications/helpers/httpError';
import { parseApplicationId } from '@/butcher-applications/routes/parseRequest';
import { rejectBodySchema } from '@/butcher-applications/routes/schemas';

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method !== 'POST') return res.status(405).end();

  return withAdmin(req, res, rejectApplication);
}

async function rejectApplication(req: AuthedRequest, res: NextApiResponse) {
  const applicationId = parseApplicationId(req.query);
  if (!applicationId) {
    return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');
  }

  const parsed = rejectBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  try {
    const application = await butcherApplicationAdminService.rejectApplication(
      req.user.userId,
      applicationId,
      parsed.data,
    );
    return apiResponse(res, application);
  } catch (err) {
    handleButcherApplicationError(res, err);
  }
}
