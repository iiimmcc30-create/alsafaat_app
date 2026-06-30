// pages/api/plans/index.ts
// GET /api/plans — subscription plan catalog
import { NextApiRequest, NextApiResponse } from 'next';
import { PLANS } from '@/lib/plans';
import { apiResponse } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!(await apiRateLimit(req, res))) return;
  return apiResponse(res, { plans: PLANS });
}
