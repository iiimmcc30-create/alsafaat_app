// pages/api/butcher-applications/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { butcherApplicationUserService } from '@/butcher-applications/services/application.service';
import { handleButcherApplicationError } from '@/butcher-applications/helpers/httpError';
import { listQuerySchema, snapshotSchema } from '@/butcher-applications/routes/schemas';

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;

  if (req.method === 'GET') return withAuth(req, res, listApplications);
  if (req.method === 'POST') return withAuth(req, res, createDraft);

  return res.status(405).end();
}

async function listApplications(req: AuthedRequest, res: NextApiResponse) {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  try {
    const page = await butcherApplicationUserService.listApplications(
      req.user.userId,
      parsed.data,
    );

    return apiResponse(res, {
      applications: page.items,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    });
  } catch (err) {
    handleButcherApplicationError(res, err);
  }
}

async function createDraft(req: AuthedRequest, res: NextApiResponse) {
  const body = req.body ?? {};
  const parsed = snapshotSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  try {
    const application = await butcherApplicationUserService.createDraft(
      req.user.userId,
      parsed.data,
    );
    return apiResponse(res, application, 201);
  } catch (err) {
    handleButcherApplicationError(res, err);
  }
}
