// pages/api/butchers/orders/[id].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { logger } from '@/lib/logger';

const updateOrderSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled']),
}).strict();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'PUT') return withAuth(req, res, updateOrder);
  return res.status(405).end();
}

async function updateOrder(req: AuthedRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  if (!id) return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');

  const parsed = updateOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const order = await prisma.butcherOrder.findUnique({
    where: { id },
    include: { butcher: { select: { userId: true } } },
  });

  if (!order) return apiError(res, 404, 'not_found', 'الطلب غير موجود');

  const isCustomer = order.customerId === req.user.userId;
  const isButcher = order.butcher.userId === req.user.userId;
  const isAdmin = req.user.role === 'ADMIN';

  if (!isCustomer && !isButcher && !isAdmin) {
    return apiError(res, 403, 'forbidden', 'غير مسموح');
  }

  if (isCustomer && !isButcher && !isAdmin && parsed.data.status !== 'cancelled') {
    return apiError(res, 403, 'forbidden_status_change', 'لا يمكنك تغيير حالة الطلب لغير ملغى');
  }

  const updated = await prisma.butcherOrder.update({
    where: { id },
    data: { status: parsed.data.status as any },
  });

  logger.info({ orderId: id, status: parsed.data.status }, 'Butcher order status updated');
  return apiResponse(res, updated);
}
