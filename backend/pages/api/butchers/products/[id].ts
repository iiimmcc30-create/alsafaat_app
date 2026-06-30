// pages/api/butchers/products/[id].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { cacheDel } from '@/lib/redis';
import { logger } from '@/lib/logger';

const updateProductSchema = z.object({
  nameAr:        z.string().min(2).max(100).trim().optional(),
  nameEn:        z.string().min(2).max(100).trim().optional(),
  category:      z.enum(['whole_livestock','lamb','beef','camel','chicken','goat','special_orders']).optional(),
  images:        z.array(z.string().url()).min(1).max(5).optional(),
  pricePerKg:    z.number().positive().optional().nullable(),
  priceFixed:    z.number().positive().optional().nullable(),
  pricingNoteAr: z.string().max(100).optional().nullable(),
  availableCuts: z.array(z.string()).optional(),
  weightMin:     z.number().positive().optional().nullable(),
  weightMax:     z.number().positive().optional().nullable(),
  inStock:       z.boolean().optional(),
  freshness:     z.string().optional(),
  descriptionAr: z.string().min(5).max(1000).trim().optional(),
  descriptionEn: z.string().min(5).max(1000).trim().optional(),
}).strict();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'PUT')    return withAuth(req, res, updateProduct);
  if (req.method === 'DELETE') return withAuth(req, res, deleteProduct);
  return res.status(405).end();
}

async function updateProduct(req: AuthedRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  if (!id) return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');

  const product = await prisma.butcherProduct.findUnique({
    where: { id },
    include: { butcher: { select: { userId: true, id: true } } },
  });

  if (!product) return apiError(res, 404, 'not_found', 'المنتج غير موجود');
  if (product.butcher.userId !== req.user.userId && req.user.role !== 'ADMIN') {
    return apiError(res, 403, 'forbidden', 'غير مسموح');
  }

  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const updated = await prisma.butcherProduct.update({
    where: { id },
    data: parsed.data,
  });

  await cacheDel(`butcher:${product.butcher.id}`);
  await cacheDel('butcher:me');

  logger.info({ productId: id, userId: req.user.userId }, 'Butcher product updated');
  return apiResponse(res, updated);
}

async function deleteProduct(req: AuthedRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  if (!id) return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');

  const product = await prisma.butcherProduct.findUnique({
    where: { id },
    include: { butcher: { select: { userId: true, id: true } } },
  });

  if (!product) return apiError(res, 404, 'not_found', 'المنتج غير موجود');
  if (product.butcher.userId !== req.user.userId && req.user.role !== 'ADMIN') {
    return apiError(res, 403, 'forbidden', 'غير مسموح');
  }

  await prisma.butcherProduct.delete({ where: { id } });

  await cacheDel(`butcher:${product.butcher.id}`);
  await cacheDel('butcher:me');

  logger.info({ productId: id, userId: req.user.userId }, 'Butcher product deleted');
  return apiResponse(res, { deleted: true });
}
