// pages/api/subscriptions/index.ts
// GET  /api/subscriptions/me — get current user's subscription state
// NOTE: subscription planId is stored in Subscription model
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { cacheGet, cacheSet, cacheDel } from '@/lib/redis';

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'GET') return withAuth(req, res, getSubscription);
  return res.status(405).end();
}

async function getSubscription(req: AuthedRequest, res: NextApiResponse) {
  const { userId } = req.user;
  const cacheKey = `subscription:${userId}`;

  const cached = await cacheGet(cacheKey);
  if (cached) return apiResponse(res, cached);

  let subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      id: true,
      planId: true,
      billingCycle: true,
      renewDate: true,
      listingsUsed: true,
      liveMinutesUsed: true,
      autoRenew: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // If no subscription exists, return a "free" default (upsert)
  if (!subscription) {
    subscription = await prisma.subscription.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        planId: 'free',
        renewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      select: {
        id: true,
        planId: true,
        billingCycle: true,
        renewDate: true,
        listingsUsed: true,
        liveMinutesUsed: true,
        autoRenew: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  await cacheSet(cacheKey, subscription, 120); // 2-minute cache
  return apiResponse(res, subscription);
}
