import { Injectable } from '@nestjs/common';
import { Prisma, OrderStatus } from '@prisma/client';
import { z } from 'zod';
import { ButchersRepository } from './repositories/butchers.repository';
import { RedisService } from '../redis/redis.service';
import { throwApi, ApiException } from '../common/exceptions/api.exception';
import { notDeleted } from '../common/utils/soft-delete.util';
import { countrySchema } from '../shared/lib/countries';
import { logger } from '../shared/lib/logger';
import {
  STORY_IMAGE_DURATION_SEC,
  clampStoryDuration,
  storyExpiresAt,
} from '../shared/lib/stories';
import type { JwtPayload } from '../common/types/jwt-payload.interface';
import { OrderLifecycleService } from './services/order-lifecycle.service';
import { OrderStateMachineService } from './services/order-state-machine.service';
import { resolveProductAvailableQuantity } from './lib/product-inventory.util';

const PAGE_SIZE = 20;

const updateButcherSchema = z
  .object({
    nameAr: z.string().min(2).max(100).trim().optional(),
    nameEn: z.string().min(2).max(100).trim().optional(),
    logo: z.string().url().optional().nullable(),
    cover: z.string().url().optional().nullable(),
    bioAr: z.string().max(500).trim().optional().nullable(),
    bioEn: z.string().max(500).trim().optional().nullable(),
    specialties: z.array(z.string()).optional(),
    commercialReg: z.string().max(50).trim().optional().nullable(),
    phone: z
      .string()
      .regex(/^\+?[0-9]{8,20}$/, 'رقم هاتف غير صالح')
      .optional(),
    openTime: z
      .string()
      .regex(/^([0-9]{2}):([0-9]{2})$/)
      .optional(),
    closeTime: z
      .string()
      .regex(/^([0-9]{2}):([0-9]{2})$/)
      .optional(),
    closedDays: z.array(z.string()).optional(),
    address: z.string().min(5).max(300).trim().optional(),
    addressAr: z.string().min(5).max(300).trim().optional(),
    city: z.string().min(2).max(100).trim().optional(),
    cityAr: z.string().min(2).max(100).trim().optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    country: countrySchema.optional(),
    isOpen: z.boolean().optional(),
  })
  .strict();

const periodSchema = z.enum(['week', 'month', '3months']);

const createProductSchema = z
  .object({
    nameAr: z.string().min(2).max(100).trim(),
    nameEn: z.string().min(2).max(100).trim(),
    category: z.enum([
      'whole_livestock',
      'lamb',
      'beef',
      'camel',
      'chicken',
      'goat',
      'special_orders',
    ]),
    images: z.array(z.string().url()).min(0).max(5).default([]),
    pricePerKg: z.number().positive().optional().nullable(),
    priceFixed: z.number().positive().optional().nullable(),
    pricingNoteAr: z.string().max(100).optional().nullable(),
    availableCuts: z.array(z.string()).min(1),
    weightMin: z.number().positive().optional().nullable(),
    weightMax: z.number().positive().optional().nullable(),
    availableQuantity: z.number().min(0).optional().nullable(),
    inStock: z.boolean().optional(),
    freshness: z.string().default('fresh'),
    descriptionAr: z.string().min(5).max(1000).trim(),
    descriptionEn: z.string().min(5).max(1000).trim(),
    country: countrySchema,
  })
  .strict();

const updateProductSchema = z
  .object({
    nameAr: z.string().min(2).max(100).trim().optional(),
    nameEn: z.string().min(2).max(100).trim().optional(),
    category: z
      .enum([
        'whole_livestock',
        'lamb',
        'beef',
        'camel',
        'chicken',
        'goat',
        'special_orders',
      ])
      .optional(),
    images: z.array(z.string().url()).min(1).max(5).optional(),
    pricePerKg: z.number().positive().optional().nullable(),
    priceFixed: z.number().positive().optional().nullable(),
    pricingNoteAr: z.string().max(100).optional().nullable(),
    availableCuts: z.array(z.string()).optional(),
    weightMin: z.number().positive().optional().nullable(),
    weightMax: z.number().positive().optional().nullable(),
    availableQuantity: z.number().min(0).optional().nullable(),
    inStock: z.boolean().optional(),
    freshness: z.string().optional(),
    descriptionAr: z.string().min(5).max(1000).trim().optional(),
    descriptionEn: z.string().min(5).max(1000).trim().optional(),
  })
  .strict();

const createOfferSchema = z
  .object({
    titleAr: z.string().min(2).max(100),
    titleEn: z.string().min(2).max(100),
    descriptionAr: z.string().min(2).max(500),
    descriptionEn: z.string().min(2).max(500),
    discountPercent: z.number().min(0).max(100).optional().nullable(),
    originalPrice: z.number().positive().optional().nullable(),
    offerPrice: z.number().positive().optional().nullable(),
    image: z.string().url(),
    validUntil: z.string().datetime(),
    country: countrySchema,
  })
  .strict();

const updateOfferSchema = z
  .object({
    titleAr: z.string().min(2).max(100).optional(),
    titleEn: z.string().min(2).max(100).optional(),
    descriptionAr: z.string().min(2).max(500).optional(),
    descriptionEn: z.string().min(2).max(500).optional(),
    discountPercent: z.number().min(0).max(100).optional().nullable(),
    originalPrice: z.number().positive().optional().nullable(),
    offerPrice: z.number().positive().optional().nullable(),
    image: z.string().url().optional(),
    validUntil: z.string().datetime().optional(),
    country: countrySchema.optional(),
  })
  .strict();

const createOrderSchema = z
  .object({
    butcherId: z.string().uuid(),
    productId: z.string().uuid(),
    cutType: z.string(),
    weightKg: z.number().positive(),
    deliveryType: z.enum(['pickup', 'delivery']),
    deliveryAddress: z.string().max(300).optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
    currency: z.string().length(3).default('SAR'),
  })
  .strict();

const updateOrderSchema = z
  .object({
    status: z.enum([
      'pending',
      'confirmed',
      'preparing',
      'ready',
      'delivered',
      'cancelled',
    ]),
    cancellationReason: z.string().max(500).optional().nullable(),
  })
  .strict();

const createStorySchema = z
  .object({
    thumbnail: z.string().url(),
    mediaUrl: z.string().url().optional().nullable(),
    caption: z.string().max(200).optional().nullable(),
    captionAr: z.string().max(200).optional().nullable(),
    type: z.enum(['daily_slaughter', 'offer', 'new_stock', 'update']),
    duration: z.number().int().min(5).max(15).optional(),
  })
  .strict();

const reviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(500).optional(),
  })
  .strict();

function periodDays(period: string): number {
  if (period === 'week') return 7;
  if (period === '3months') return 90;
  return 30;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

@Injectable()
export class ButchersService {
  constructor(
    private readonly repo: ButchersRepository,
    private readonly redis: RedisService,
    private readonly orderLifecycle: OrderLifecycleService,
    private readonly orderStateMachine: OrderStateMachineService,
  ) {}

  async listButchers(query: {
    cursor?: string;
    country?: string;
    verified?: string;
    search?: string;
    isOpen?: string;
  }) {
    const { cursor, country, search } = query;
    const verified = query.verified === 'true';
    const isOpen = query.isOpen === 'true';

    const cacheKey = !search
      ? `butchers:v2:${JSON.stringify({ cursor, country, verified, isOpen })}`
      : null;

    if (cacheKey) {
      const cached = await this.redis.cacheGet(cacheKey);
      if (cached) return cached;
    }

    const where: Prisma.ButcherWhereInput = { ...notDeleted };
    if (country) where.country = country as Prisma.ButcherWhereInput['country'];
    if (verified) where.subscriptionActive = true;
    if (isOpen) where.isOpen = true;
    if (search && search.length >= 2) {
      where.OR = [
        { nameAr: { contains: search } },
        { nameEn: { contains: search, mode: 'insensitive' } },
        { cityAr: { contains: search } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    const butchers = await this.repo.findManyButchers({
      where,
      cursor,
      take: PAGE_SIZE + 1,
    });

    const hasMore = butchers.length > PAGE_SIZE;
    const items = hasMore ? butchers.slice(0, -1) : butchers;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;
    const result = { butchers: items, nextCursor, hasMore };

    if (cacheKey) await this.redis.cacheSet(cacheKey, result, 180);
    return result;
  }

  registerButcher() {
    throwApi(
      403,
      'application_required',
      'يجب تقديم طلب تسجيل ملحمة والحصول على موافقة الإدارة. استخدم بوابة طلبات التسجيل في التطبيق.',
    );
  }

  async getButcher(id: string, viewer?: JwtPayload) {
    if (!id) throwApi(400, 'invalid_id', 'معرّف غير صالح');

    const isMe = id === 'me';
    const viewerId = viewer?.userId;

    if (!isMe) {
      const existing = await this.repo.findButcherOwner(id);
      if (!existing) throwApi(404, 'not_found', 'الملحمة غير موجودة');
      if (existing.userId !== viewerId) {
        await this.repo.incrementProfileViews(id);
      }
    } else {
      const cacheKey = `butcher:${id}`;
      const cached = await this.redis.cacheGet(cacheKey);
      if (cached) return cached;
    }

    let butcher;
    if (isMe) {
      if (!viewer?.userId) throwApi(401, 'unauthorized', 'غير مصرح');
      butcher = await this.repo.findButcherByUserId(viewer.userId);
    } else {
      butcher = await this.repo.findButcherById(id);
    }

    if (!butcher) throwApi(404, 'not_found', 'الملحمة غير موجودة');

    if (isMe) {
      await this.redis.cacheSet(`butcher:${id}`, butcher, 300);
    }
    return butcher;
  }

  async updateButcher(id: string, user: JwtPayload, body: unknown) {
    if (!id) throwApi(400, 'invalid_id', 'معرّف غير صالح');

    const butcher =
      id === 'me'
        ? await this.repo.findButcherOwnerByUser(user.userId)
        : await this.repo.findButcherOwner(id);

    if (!butcher) throwApi(404, 'not_found', 'الملحمة غير موجودة');
    if (butcher.userId !== user.userId && user.role !== 'ADMIN') {
      throwApi(403, 'forbidden', 'غير مسموح');
    }

    const parsed = updateButcherSchema.safeParse(body);
    if (!parsed.success) {
      throwApi(
        400,
        'validation_error',
        'بيانات غير صحيحة',
        parsed.error.flatten(),
      );
    }

    const updated = await this.repo.updateButcher(butcher.id, parsed.data);

    await this.redis.cacheDel(`butcher:${id}`);
    await this.redis.cacheDel('butcher:me');
    await this.redis.cacheDel(`butcher:${butcher.id}`);
    await this.redis.cacheDelPattern('butchers:v2:*').catch(() => {});

    logger.info(
      { butcherId: butcher.id, userId: user.userId },
      'Butcher profile updated',
    );
    return updated;
  }

  async getStats(user: JwtPayload, periodRaw?: string) {
    const parsed = periodSchema.safeParse(periodRaw ?? 'month');
    if (!parsed.success) {
      throwApi(400, 'validation_error', 'فترة غير صالحة');
    }

    const period = parsed.data;
    const days = periodDays(period);
    const now = new Date();
    const limitDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const prevLimitDate = new Date(
      limitDate.getTime() - days * 24 * 60 * 60 * 1000,
    );

    const butcher = await this.repo.findButcherForStats(user.userId);
    if (!butcher) {
      throwApi(404, 'not_found', 'لم يتم العثور على ملحمة مرتبطة بحسابك');
    }

    const butcherStats = butcher;

    const [currentOrders, previousOrders] = await Promise.all([
      this.repo.findOrdersInRange(butcherStats.id, limitDate),
      this.repo.findOrdersInRange(butcherStats.id, prevLimitDate, limitDate),
    ]);

    const validOrders = currentOrders.filter((o) => o.status !== 'cancelled');
    const prevValid = previousOrders.filter((o) => o.status !== 'cancelled');

    const revenue = validOrders.reduce((s, o) => s + o.totalPrice, 0);
    const prevRevenue = prevValid.reduce((s, o) => s + o.totalPrice, 0);

    const deliveredCount = currentOrders.filter(
      (o) => o.status === 'delivered',
    ).length;
    const cancelledCount = currentOrders.filter(
      (o) => o.status === 'cancelled',
    ).length;
    const totalStatusCount = deliveredCount + cancelledCount;
    const completionRate =
      totalStatusCount > 0
        ? Math.round((deliveredCount / totalStatusCount) * 100)
        : 100;

    const avgOrderValue =
      validOrders.length > 0 ? Math.round(revenue / validOrders.length) : 0;

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
      const name =
        (o as { product?: { nameAr?: string } }).product?.nameAr ?? 'منتج';
      if (!productMap[name]) productMap[name] = { sales: 0, revenue: 0 };
      productMap[name].sales += 1;
      productMap[name].revenue += o.totalPrice;
    });
    const topProducts = Object.entries(productMap)
      .map(([name, stats]) => ({
        name,
        sales: stats.sales,
        revenue: stats.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3);

    const prevOrderCount = previousOrders.length;
    const orderCount = currentOrders.length;

    return {
      period,
      butcher: {
        id: butcherStats.id,
        nameAr: butcherStats.nameAr,
        subscriptionActive: butcherStats.subscriptionActive,
      },
      revenue,
      orders: orderCount,
      profileViews: butcherStats.profileViews,
      completionRate,
      avgOrderValue,
      newCustomers,
      dailyRevenue,
      topProducts,
      reviews: { avg: butcherStats.rating, count: butcherStats.reviewCount },
      trends: {
        revenue: pctChange(revenue, prevRevenue),
        orders: pctChange(orderCount, prevOrderCount),
        profileViews: null,
        completionRate: null,
      },
    };
  }

  async getProducts(butcherId: string) {
    if (!butcherId) throwApi(400, 'invalid_butcher_id', 'معرّف الملحمة مطلوب');
    return this.repo.findProducts(butcherId);
  }

  async createProduct(user: JwtPayload, body: unknown) {
    const butcher = await this.repo.findButcherIdByUser(user.userId);
    if (!butcher) {
      throwApi(403, 'no_butcher_profile', 'ليس لديك ملف ملحمة مسجل');
    }

    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      throwApi(
        400,
        'validation_error',
        'بيانات غير صحيحة',
        parsed.error.flatten(),
      );
    }

    const availableQuantity = resolveProductAvailableQuantity(parsed.data);
    const product = await this.repo.createProduct({
      ...parsed.data,
      availableQuantity,
      category: parsed.data
        .category as Prisma.ButcherProductCreateInput['category'],
      country: parsed.data
        .country as Prisma.ButcherProductCreateInput['country'],
      butcherId: butcher.id,
    });

    logger.info(
      { productId: product.id, butcherId: butcher.id },
      'Butcher product created',
    );
    return product;
  }

  async updateProduct(id: string, user: JwtPayload, body: unknown) {
    if (!id) throwApi(400, 'invalid_id', 'معرّف غير صالح');

    const product = await this.repo.findProductWithButcher(id);
    if (!product) throwApi(404, 'not_found', 'المنتج غير موجود');
    if (product.butcher.userId !== user.userId && user.role !== 'ADMIN') {
      throwApi(403, 'forbidden', 'غير مسموح');
    }

    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
      throwApi(
        400,
        'validation_error',
        'بيانات غير صحيحة',
        parsed.error.flatten(),
      );
    }

    const updateData = { ...parsed.data } as Prisma.ButcherProductUpdateInput;
    if (
      parsed.data.availableQuantity != null ||
      parsed.data.weightMin != null ||
      parsed.data.weightMax != null
    ) {
      const existing = await this.repo.findProductWithButcher(id);
      if (existing) {
        updateData.availableQuantity = resolveProductAvailableQuantity({
          availableQuantity:
            parsed.data.availableQuantity ?? existing.availableQuantity,
          weightMax: parsed.data.weightMax ?? existing.weightMax,
          weightMin: parsed.data.weightMin ?? existing.weightMin,
        });
      }
    }

    const updated = await this.repo.updateProduct(id, updateData);
    await this.redis.cacheDel(`butcher:${product.butcher.id}`);
    await this.redis.cacheDel('butcher:me');

    logger.info(
      { productId: id, userId: user.userId },
      'Butcher product updated',
    );
    return updated;
  }

  async deleteProduct(id: string, user: JwtPayload) {
    if (!id) throwApi(400, 'invalid_id', 'معرّف غير صالح');

    const product = await this.repo.findProductWithButcher(id);
    if (!product) throwApi(404, 'not_found', 'المنتج غير موجود');
    if (product.butcher.userId !== user.userId && user.role !== 'ADMIN') {
      throwApi(403, 'forbidden', 'غير مسموح');
    }

    await this.repo.softDeleteProduct(id);
    await this.redis.cacheDel(`butcher:${product.butcher.id}`);
    await this.redis.cacheDel('butcher:me');

    logger.info(
      { productId: id, userId: user.userId },
      'Butcher product deleted',
    );
    return { deleted: true };
  }

  async listOffers(user: JwtPayload) {
    const butcher = await this.repo.findButcherIdByUser(user.userId);
    if (!butcher) throwApi(404, 'not_found', 'الملحمة غير موجودة');
    return this.repo.findActiveOffers(butcher.id);
  }

  async createOffer(user: JwtPayload, body: unknown) {
    const butcher = await this.repo.findButcherIdByUser(user.userId);
    if (!butcher) throwApi(404, 'not_found', 'الملحمة غير موجودة');

    const parsed = createOfferSchema.safeParse(body);
    if (!parsed.success) {
      throwApi(
        400,
        'validation_error',
        'بيانات غير صحيحة',
        parsed.error.flatten(),
      );
    }

    const offer = await this.repo.createOffer({
      butcherId: butcher.id,
      ...parsed.data,
      validUntil: new Date(parsed.data.validUntil),
    });

    await this.redis.cacheDel(`butcher:${butcher.id}`);
    await this.redis.cacheDel('butcher:me');

    logger.info(
      { offerId: offer.id, butcherId: butcher.id },
      'Butcher offer created',
    );
    return offer;
  }

  async updateOffer(id: string, user: JwtPayload, body: unknown) {
    if (!id) throwApi(400, 'invalid_id', 'معرّف غير صالح');

    const offer = await this.repo.findOwnedOffer(id, user.userId);
    if (!offer) throwApi(404, 'not_found', 'العرض غير موجود');

    const parsed = updateOfferSchema.safeParse(body);
    if (!parsed.success) {
      throwApi(
        400,
        'validation_error',
        'بيانات غير صحيحة',
        parsed.error.flatten(),
      );
    }

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.validUntil) {
      data.validUntil = new Date(parsed.data.validUntil);
    }

    const updated = await this.repo.updateOffer(id, data);
    await this.redis.cacheDel(`butcher:${offer.butcherId}`);
    await this.redis.cacheDel('butcher:me');

    logger.info({ offerId: id }, 'Butcher offer updated');
    return updated;
  }

  async deleteOffer(id: string, user: JwtPayload) {
    if (!id) throwApi(400, 'invalid_id', 'معرّف غير صالح');

    const offer = await this.repo.findOwnedOffer(id, user.userId);
    if (!offer) throwApi(404, 'not_found', 'العرض غير موجود');

    await this.repo.softDeleteOffer(id);
    await this.redis.cacheDel(`butcher:${offer.butcherId}`);
    await this.redis.cacheDel('butcher:me');

    logger.info({ offerId: id }, 'Butcher offer deleted');
    return { deleted: true };
  }

  async getOrders(user: JwtPayload) {
    const butcher = await this.repo.findButcherIdByUser(user.userId);
    if (butcher) {
      const orders = await this.repo.findOrdersForButcher(butcher.id);
      return orders.map((order) => ({
        ...order,
        allowedNextStatuses: this.orderStateMachine.getAllowedNext(
          order.status as OrderStatus,
        ),
      }));
    }
    const orders = await this.repo.findOrdersForCustomer(user.userId);
    return orders.map((order) => ({
      ...order,
      allowedNextStatuses: this.orderStateMachine.getAllowedNext(
        order.status as OrderStatus,
      ),
    }));
  }

  async createOrder(user: JwtPayload, body: unknown) {
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      throwApi(
        400,
        'validation_error',
        'بيانات غير صحيحة',
        parsed.error.flatten(),
      );
    }

    const orderInput = parsed.data;

    const {
      butcherId,
      productId,
      cutType,
      weightKg,
      deliveryType,
      deliveryAddress,
      notes,
      currency,
    } = orderInput;

    const product = await this.repo.findProductForOrder(productId);
    if (!product || product.butcherId !== butcherId) {
      throwApi(404, 'not_found', 'المنتج غير موجود');
    }

    if (!product.inStock) {
      throwApi(400, 'validation_error', 'المنتج غير متوفر حالياً');
    }

    if (product.weightMin != null && weightKg < product.weightMin) {
      throwApi(
        400,
        'validation_error',
        `الوزن يجب أن يكون ${product.weightMin} كجم على الأقل`,
      );
    }

    if (product.weightMax != null && weightKg > product.weightMax) {
      throwApi(
        400,
        'validation_error',
        `الوزن يجب ألا يتجاوز ${product.weightMax} كجم`,
      );
    }

    const totalPrice = (() => {
      if (product.priceFixed != null) return product.priceFixed;
      if (product.pricePerKg != null) return product.pricePerKg * weightKg;
      throwApi(400, 'validation_error', 'المنتج لا يحتوي على سعر');
    })();

    const roundedTotal = Math.round(totalPrice * 100) / 100;

    const order = await this.orderLifecycle.createOrder({
      butcherId,
      productId,
      cutType,
      weightKg,
      deliveryType,
      deliveryAddress,
      notes,
      currency,
      totalPrice: roundedTotal,
      customerId: user.userId,
    });

    logger.info(
      { orderId: order.id, customerId: user.userId },
      'Butcher order placed',
    );
    return order;
  }

  async updateOrder(id: string, user: JwtPayload, body: unknown) {
    if (!id) throwApi(400, 'invalid_id', 'معرّف غير صالح');

    const parsed = updateOrderSchema.safeParse(body);
    if (!parsed.success) {
      throwApi(
        400,
        'validation_error',
        'بيانات غير صحيحة',
        parsed.error.flatten(),
      );
    }

    const statusInput = parsed.data;

    const order = await this.repo.findOrderWithButcher(id);
    if (!order) throwApi(404, 'not_found', 'الطلب غير موجود');

    const isCustomer = order.customerId === user.userId;
    const isButcher = order.butcher.userId === user.userId;
    const isAdmin = user.role === 'ADMIN';

    if (!isCustomer && !isButcher && !isAdmin) {
      throwApi(403, 'forbidden', 'غير مسموح');
    }

    if (
      isCustomer &&
      !isButcher &&
      !isAdmin &&
      statusInput.status !== 'cancelled'
    ) {
      throwApi(
        403,
        'forbidden_status_change',
        'لا يمكنك تغيير حالة الطلب لغير ملغى',
      );
    }

    const updated = await this.orderLifecycle.transitionOrder({
      orderId: id,
      actorId: user.userId,
      nextStatus: statusInput.status as OrderStatus,
      cancellationReason:
        statusInput.status === 'cancelled'
          ? statusInput.cancellationReason ?? 'Order cancelled by actor'
          : null,
    });

    logger.info(
      { orderId: id, status: statusInput.status },
      'Butcher order status updated',
    );
    return updated;
  }

  async getOrderById(id: string, user: JwtPayload) {
    if (!id) throwApi(400, 'invalid_id', 'معرّف غير صالح');
    const order = await this.repo.findOrderById(id);
    if (!order) throwApi(404, 'not_found', 'الطلب غير موجود');

    const isCustomer = order.customerId === user.userId;
    const isButcher = order.butcher.userId === user.userId;
    const isAdmin = user.role === 'ADMIN' || user.role === 'MODERATOR';
    if (!isCustomer && !isButcher && !isAdmin) {
      throwApi(403, 'forbidden', 'غير مسموح');
    }

    const audits = isAdmin ? await this.repo.findOrderAudits(id) : undefined;
    return {
      ...order,
      allowedNextStatuses: this.orderStateMachine.getAllowedNext(
        order.status as OrderStatus,
      ),
      ...(audits ? { audits } : {}),
    };
  }

  async getActiveStories() {
    const cacheKey = 'butchers:stories:active';
    const cached = await this.redis.cacheGet(cacheKey);
    if (cached) return cached;

    try {
      const activeStories = await this.repo.findActiveStories();
      await this.redis.cacheSet(cacheKey, activeStories, 30);
      return activeStories;
    } catch (err) {
      logger.error({ err }, 'Fetch active butcher stories error');
      throwApi(500, 'server_error', 'خطأ في الخادم');
    }
  }

  async createStory(user: JwtPayload, body: unknown) {
    const parsed = createStorySchema.safeParse(body);
    if (!parsed.success) {
      throwApi(
        400,
        'validation_error',
        'بيانات غير صحيحة',
        parsed.error.flatten(),
      );
    }

    const storyInput = parsed.data;

    try {
      const butcher = await this.repo.findButcherIdByUser(user.userId);
      if (!butcher) {
        throwApi(
          403,
          'butcher_profile_required',
          'يجب أن تمتلك ملف ملحمة نشط لنشر القصص',
        );
      }

      const expiresAt = storyExpiresAt();
      const duration = clampStoryDuration(
        storyInput.duration ?? STORY_IMAGE_DURATION_SEC,
      );

      const story = await this.repo.createStory({
        ...storyInput,
        duration,
        butcherId: butcher.id,
        expiresAt,
      });

      await this.redis.cacheDel('butchers:stories:active');
      logger.info(
        { storyId: story.id, butcherId: butcher.id },
        'Butcher story created successfully',
      );
      return story;
    } catch (err) {
      if (err instanceof ApiException) throw err;
      logger.error({ err }, 'Create butcher story error');
      throwApi(500, 'server_error', 'خطأ في الخادم');
    }
  }

  async deleteStory(id: string, user: JwtPayload) {
    if (!id) throwApi(400, 'invalid_id', 'معرّف غير صالح');

    const story = await this.repo.findStoryWithButcher(id);
    if (!story) throwApi(404, 'not_found', 'القصة غير موجودة');
    if (story.butcher.userId !== user.userId && user.role !== 'ADMIN') {
      throwApi(403, 'forbidden', 'غير مسموح');
    }

    await this.repo.softDeleteStory(id);
    await this.redis.cacheDel('butchers:stories:active');

    logger.info({ storyId: id, userId: user.userId }, 'Butcher story deleted');
    return { deleted: true };
  }

  async getReviews(butcherId: string) {
    if (!butcherId) throwApi(400, 'invalid_id', 'معرّف غير صالح');

    const butcher = await this.repo.findButcherOwner(butcherId);
    if (!butcher) throwApi(404, 'not_found', 'الملحمة غير موجودة');

    return this.repo.findReviews(butcherId);
  }

  async submitReview(butcherId: string, user: JwtPayload, body: unknown) {
    const butcher = await this.repo.findButcherForReview(butcherId);
    if (!butcher) throwApi(404, 'not_found', 'الملحمة غير موجودة');

    if (butcher.userId === user.userId) {
      throwApi(400, 'invalid_action', 'لا يمكنك تقييم ملحمتك الخاصة');
    }

    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      throwApi(
        400,
        'validation_error',
        'بيانات غير صحيحة',
        parsed.error.flatten(),
      );
    }

    const reviewInput = parsed.data;

    try {
      const review = await this.repo.upsertReview({
        butcherId,
        reviewerId: user.userId,
        rating: reviewInput.rating,
        comment: reviewInput.comment,
      });

      const agg = await this.repo.aggregateReviews(butcherId);
      await this.repo.updateButcherRating(
        butcherId,
        agg._avg.rating ?? 0,
        agg._count.rating,
      );

      await this.redis.cacheDel(`butcher:${butcherId}`);

      logger.info(
        { butcherId, reviewerId: user.userId },
        'Butcher review submitted',
      );
      return review;
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throwApi(409, 'already_reviewed', 'لقد قيّمت هذه الملحمة من قبل');
      }
      logger.error({ err }, 'Submit review error');
      throwApi(500, 'server_error', 'خطأ في الخادم');
    }
  }
}
