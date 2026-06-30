// GET /api/livestreams/eligibility — هل يمكن للمستخدم بدء بث؟ (يتطلب إعلاناً واحداً على الأقل)
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { checkLiveStreamAccess } from '@/lib/liveStreamAccess';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!(await apiRateLimit(req, res, 'api'))) return;
  return withAuth(req, res, checkEligibility);
}

async function checkEligibility(req: AuthedRequest, res: NextApiResponse) {
  try {
    const [listingsCount, sub] = await Promise.all([
      prisma.listing.count({ where: { sellerId: req.user.userId } }),
      prisma.subscription.findUnique({
        where:  { userId: req.user.userId },
        select: { planId: true, liveMinutesUsed: true },
      }),
    ]);

    const access = checkLiveStreamAccess(sub);
    const hasListing = listingsCount > 0;

    return apiResponse(res, {
      canStream: hasListing && access.allowed,
      listingsCount,
      planId: access.planId,
      ...(!access.allowed
        ? { reason: access.code }
        : {
            liveMinutesLimit: access.liveMinutesLimit,
            liveMinutesUsed:  access.liveMinutesUsed,
          }),
    });
  } catch {
    return apiError(res, 500, 'server_error', 'خطأ في الخادم');
  }
}
