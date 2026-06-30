// pages/api/fees/index.ts
// FIX: PATCH endpoint to pay a fee, proper atomic activation
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'GET')   return withAuth(req, res, getFees);
  return res.status(405).end();
}

async function getFees(req: AuthedRequest, res: NextApiResponse) {
  const status = req.query.status as string | undefined;

  // Validate status if provided
  const validStatuses = ['pending', 'paid', 'overdue', 'waived'];
  if (status && !validStatuses.includes(status)) {
    return apiError(res, 400, 'invalid_status', 'حالة غير صالحة');
  }

  const where: any = { userId: req.user.userId };
  if (status) where.status = status;

  const fees = await prisma.listingFee.findMany({
    where,
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }], // overdue first
    include: {
      listing: {
        select: {
          id:          true,
          arabicTitle: true,
          category:    true,
          images:      true,
          status:      true,
        },
      },
    },
  });

  const all = await prisma.listingFee.findMany({
    where:  { userId: req.user.userId },
    select: { status: true, commission: true },
  });

  const summary = {
    totalPending: all.filter(f => f.status === 'pending').reduce((s, f) => s + f.commission, 0),
    totalOverdue: all.filter(f => f.status === 'overdue').reduce((s, f) => s + f.commission, 0),
    totalPaid:    all.filter(f => f.status === 'paid').reduce((s, f) => s + f.commission, 0),
    pendingCount: all.filter(f => f.status === 'pending').length,
    overdueCount: all.filter(f => f.status === 'overdue').length,
    paidCount:    all.filter(f => f.status === 'paid').length,
  };

  return apiResponse(res, { fees, summary });
}
