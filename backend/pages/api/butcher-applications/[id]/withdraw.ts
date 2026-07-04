// pages/api/butcher-applications/[id]/withdraw.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { butcherApplicationUserService } from '@/butcher-applications/services/application.service';
import { handleButcherApplicationError } from '@/butcher-applications/helpers/httpError';
import { parseApplicationId } from '@/butcher-applications/routes/parseRequest';
import { withdrawBodySchema } from '@/butcher-applications/routes/schemas';

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method !== 'POST') return res.status(405).end();

  return withAuth(req, res, withdrawApplication);
}

async function withdrawApplication(req: AuthedRequest, res: NextApiResponse) {
  const applicationId = parseApplicationId(req.query);
  if (!applicationId) {
    return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');
  }

  const parsed = withdrawBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  try {
    const application = await butcherApplicationUserService.withdrawApplication(
      req.user.userId,
      applicationId,
      parsed.data,
    );
    return apiResponse(res, application);
  } catch (err) {
    handleButcherApplicationError(res, err);
  }
}
