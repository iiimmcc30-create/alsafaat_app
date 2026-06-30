// pages/api/butchers/orders/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { logger } from '@/lib/logger';

const createOrderSchema = z.object({
  butcherId:       z.string().uuid(),
  productId:       z.string().uuid(),
  cutType:         z.string(),
  weightKg:        z.number().positive(),
  deliveryType:    z.enum(['pickup', 'delivery']),
  deliveryAddress: z.string().max(300).optional().nullable(),
  notes:           z.string().max(500).optional().nullable(),
  currency:        z.string().length(3).default('SAR'),
}).strict();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'GET')  return withAuth(req, res, getOrders);
  if (req.method === 'POST') return withAuth(req, res, createOrder);
  return res.status(405).end();
}

async function getOrders(req: AuthedRequest, res: NextApiResponse) {
  const butcher = await prisma.butcher.findUnique({
    where: { userId: req.user.userId },
    select: { id: true },
  });

  let orders;
  if (butcher) {
    orders = await prisma.butcherOrder.findMany({
      where: { butcherId: butcher.id },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, displayName: true, arabicName: true, avatar: true, phone: true } },
        product: true,
      },
    });
  } else {
    orders = await prisma.butcherOrder.findMany({
      where: { customerId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        butcher: true,
        product: true,
      },
    });
  }

  return apiResponse(res, orders);
}

async function createOrder(req: AuthedRequest, res: NextApiResponse) {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const { butcherId, productId, cutType, weightKg, deliveryType, deliveryAddress, notes, currency } = parsed.data;

  const product = await prisma.butcherProduct.findUnique({
    where: { id: productId },
    select: {
      id: true,
      butcherId: true,
      inStock: true,
      weightMin: true,
      weightMax: true,
      priceFixed: true,
      pricePerKg: true,
    },
  });

  if (!product || product.butcherId !== butcherId) {
    return apiError(res, 404, 'not_found', 'المنتج غير موجود');
  }

  if (!product.inStock) {
    return apiError(res, 400, 'validation_error', 'المنتج غير متوفر حالياً');
  }

  if (product.weightMin != null && weightKg < product.weightMin) {
    return apiError(res, 400, 'validation_error', `الوزن يجب أن يكون ${product.weightMin} كجم على الأقل`);
  }

  if (product.weightMax != null && weightKg > product.weightMax) {
    return apiError(res, 400, 'validation_error', `الوزن يجب ألا يتجاوز ${product.weightMax} كجم`);
  }

  let totalPrice: number;
  if (product.priceFixed != null) {
    totalPrice = product.priceFixed;
  } else if (product.pricePerKg != null) {
    totalPrice = product.pricePerKg * weightKg;
  } else {
    return apiError(res, 400, 'validation_error', 'المنتج لا يحتوي على سعر');
  }

  totalPrice = Math.round(totalPrice * 100) / 100;

  const order = await prisma.butcherOrder.create({
    data: {
      butcherId,
      productId,
      cutType,
      weightKg,
      deliveryType,
      deliveryAddress,
      notes,
      currency,
      totalPrice,
      customerId: req.user.userId,
    },
    include: {
      product: true,
      butcher: true,
    },
  });

  logger.info({ orderId: order.id, customerId: req.user.userId }, 'Butcher order placed');
  return apiResponse(res, order, 201);
}
