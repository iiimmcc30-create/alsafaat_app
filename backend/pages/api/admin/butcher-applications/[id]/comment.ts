// pages/api/admin/butcher-applications/[id]/comment.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { withAdmin, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { butcherApplicationAdminService } from '@/butcher-applications/services/admin.service';
import { handleButcherApplicationError } from '@/butcher-applications/helpers/httpError';
import { parseApplicationId } from '@/butcher-applications/routes/parseRequest';
import { commentBodySchema } from '@/butcher-applications/routes/schemas';

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method !== 'POST') return res.status(405).end();

  return withAdmin(req, res, addComment);
}

async function addComment(req: AuthedRequest, res: NextApiResponse) {
  const applicationId = parseApplicationId(req.query);
  if (!applicationId) {
    return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');
  }

  const parsed = commentBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  try {
    const timelineEvent = await butcherApplicationAdminService.addComment(
      req.user.userId,
      applicationId,
      parsed.data,
    );
    return apiResponse(res, { timelineEvent }, 201);
  } catch (err) {
    handleButcherApplicationError(res, err);
  }
}
