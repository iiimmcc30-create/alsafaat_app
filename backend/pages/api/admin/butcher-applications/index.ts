// pages/api/admin/butcher-applications/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { withAdmin, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { butcherApplicationAdminService } from '@/butcher-applications/services/admin.service';
import {
  countDraftApplications,
} from '@/butcher-applications/repositories/application.repository';
import { handleButcherApplicationError } from '@/butcher-applications/helpers/httpError';
import { adminListQuerySchema } from '@/butcher-applications/routes/schemas';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method !== 'GET') return res.status(405).end();

  return withAdmin(req, res, listApplications);
}

async function listApplications(req: AuthedRequest, res: NextApiResponse) {
  const parsed = adminListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  try {
    const [page, draft] = await Promise.all([
      butcherApplicationAdminService.listApplications(parsed.data),
      countDraftApplications(),
    ]);

    return apiResponse(res, {
      applications: page.items,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      counts: { submitted: page.counts.submitted, draft },
    });
  } catch (err) {
    handleButcherApplicationError(res, err);
  }
}
