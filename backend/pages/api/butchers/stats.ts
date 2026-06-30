// pages/api/butchers/stats.ts
// GET /api/butchers/stats?period=week|month|3months — butcher dashboard statistics
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';

const periodSchema = z.enum(['week', 'month', '3months']).default('month');

function periodDays(period: string): number {
  if (period === 'week') return 7;
  if (period === '3months') return 90;
  return 30;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!(await apiRateLimit(req, res))) return;
  return withAuth(req, res, getStats);
}

async function getStats(req: AuthedRequest, res: NextApiResponse) {
  const parsed = periodSchema.safeParse(req.query.period ?? 'month');
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'فترة غير صالحة');
  }

  const period = parsed.data;
  const days = periodDays(period);
  const now = new Date();
  const limitDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevLimitDate = new Date(limitDate.getTime() - days * 24 * 60 * 60 * 1000);

  const butcher = await prisma.butcher.findUnique({
    where: { userId: req.user.userId },
    select: {
      id: true,
      nameAr: true,
      profileViews: true,
      rating: true,
      reviewCount: true,
      subscriptionActive: true,
    },
  });

  if (!butcher) {
    return apiError(res, 404, 'not_found', 'لم يتم العثور على ملحمة مرتبطة بحسابك');
  }

  const [currentOrders, previousOrders] = await Promise.all([
    prisma.butcherOrder.findMany({
      where: { butcherId: butcher.id, createdAt: { gte: limitDate } },
      include: { product: { select: { nameAr: true } } },
    }),
    prisma.butcherOrder.findMany({
      where: {
        butcherId: butcher.id,
        createdAt: { gte: prevLimitDate, lt: limitDate },
      },
    }),
  ]);

  const validOrders = currentOrders.filter((o) => o.status !== 'cancelled');
  const prevValid = previousOrders.filter((o) => o.status !== 'cancelled');

  const revenue = validOrders.reduce((s, o) => s + o.totalPrice, 0);
  const prevRevenue = prevValid.reduce((s, o) => s + o.totalPrice, 0);

  const deliveredCount = currentOrders.filter((o) => o.status === 'delivered').length;
  const cancelledCount = currentOrders.filter((o) => o.status === 'cancelled').length;
  const totalStatusCount = deliveredCount + cancelledCount;
  const completionRate = totalStatusCount > 0
    ? Math.round((deliveredCount / totalStatusCount) * 100)
    : 100;

  const avgOrderValue = validOrders.length > 0
    ? Math.round(revenue / validOrders.length)
    : 0;

  const newCustomers = new Set(currentOrders.map((o) => o.customerId)).size;

  const dailyMap: Record<string, number> = {};
  validOrders.forEach((o) => {
    const dateStr = o.createdAt.toISOString().slice(0, 10);
    dailyMap[dateStr] = (dailyMap[dateStr] ?? 0) + o.totalPrice;
  });
  const dailyRevenue = Object.values(dailyMap).slice(-7);
  if (dailyRevenue.length === 0) dailyRevenue.push(0);

  const productMap: Record<string, { sales: number; revenue: number }> = {};
  validOrders.forEach((o) => {
    const name = o.product?.nameAr ?? 'منتج';
    if (!productMap[name]) productMap[name] = { sales: 0, revenue: 0 };
    productMap[name].sales += 1;
    productMap[name].revenue += o.totalPrice;
  });
  const topProducts = Object.entries(productMap)
    .map(([name, stats]) => ({ name, sales: stats.sales, revenue: stats.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3);

  const prevOrderCount = previousOrders.length;
  const orderCount = currentOrders.length;

  return apiResponse(res, {
    period,
    butcher: {
      id: butcher.id,
      nameAr: butcher.nameAr,
      subscriptionActive: butcher.subscriptionActive,
    },
    revenue,
    orders: orderCount,
    profileViews: butcher.profileViews,
    completionRate,
    avgOrderValue,
    newCustomers,
    dailyRevenue,
    topProducts,
    reviews: { avg: butcher.rating, count: butcher.reviewCount },
    trends: {
      revenue: pctChange(revenue, prevRevenue),
      orders: pctChange(orderCount, prevOrderCount),
      profileViews: null,
      completionRate: null,
    },
  });
}
