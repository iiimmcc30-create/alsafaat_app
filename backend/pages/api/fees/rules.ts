// pages/api/fees/rules.ts
// GET /api/fees/rules — commission rules table
import { NextApiRequest, NextApiResponse } from 'next';
import { COMMISSION_TABLE } from '@/lib/commissions';
import { apiResponse } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!(await apiRateLimit(req, res))) return;
  return apiResponse(res, { rules: COMMISSION_TABLE });
}
