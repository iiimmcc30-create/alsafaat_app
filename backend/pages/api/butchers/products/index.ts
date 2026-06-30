// pages/api/butchers/products/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth, withOptionalAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { logger } from '@/lib/logger';
import { countrySchema } from '@/lib/countries';

const createProductSchema = z.object({
  nameAr:        z.string().min(2).max(100).trim(),
  nameEn:        z.string().min(2).max(100).trim(),
  category:      z.enum(['whole_livestock','lamb','beef','camel','chicken','goat','special_orders']),
  images:        z.array(z.string().url()).min(0).max(5).default([]),
  pricePerKg:    z.number().positive().optional().nullable(),
  priceFixed:    z.number().positive().optional().nullable(),
  pricingNoteAr: z.string().max(100).optional().nullable(),
  availableCuts: z.array(z.string()).min(1),
  weightMin:     z.number().positive().optional().nullable(),
  weightMax:     z.number().positive().optional().nullable(),
  freshness:     z.string().default('fresh'),
  descriptionAr: z.string().min(5).max(1000).trim(),
  descriptionEn: z.string().min(5).max(1000).trim(),
  country:       countrySchema,
}).strict();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'GET')  return withOptionalAuth(req, res, getProducts);
  if (req.method === 'POST') return withAuth(req, res, createProduct);
  return res.status(405).end();
}

async function getProducts(req: NextApiRequest, res: NextApiResponse) {
  const { butcherId } = req.query as { butcherId: string };
  if (!butcherId) return apiError(res, 400, 'invalid_butcher_id', 'معرّف الملحمة مطلوب');

  const products = await prisma.butcherProduct.findMany({
    where: { butcherId },
    orderBy: { createdAt: 'desc' },
  });

  return apiResponse(res, products);
}

async function createProduct(req: AuthedRequest, res: NextApiResponse) {
  const butcher = await prisma.butcher.findUnique({
    where: { userId: req.user.userId },
    select: { id: true },
  });

  if (!butcher) {
    return apiError(res, 403, 'no_butcher_profile', 'ليس لديك ملف ملحمة مسجل');
  }

  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const product = await prisma.butcherProduct.create({
    data: {
      ...parsed.data,
      category: parsed.data.category as any,
      country: parsed.data.country as any,
      butcherId: butcher.id,
    },
  });

  logger.info({ productId: product.id, butcherId: butcher.id }, 'Butcher product created');
  return apiResponse(res, product, 201);
}
