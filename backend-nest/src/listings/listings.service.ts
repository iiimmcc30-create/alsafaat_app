import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { calculateCommission, type ListingCat } from '../lib/commissions';
import { throwApi } from '../common/exceptions/api.exception';
import { LoggerService } from '../common/services/logger.service';
import { RedisCacheService } from '../redis/services/redis-cache.service';
import { FeeCheckQueueService } from '../queue/services/fee-check-queue.service';
import { AppNotificationsService } from '../queue/services/app-notifications.service';
import type { JwtPayload } from '../common/types/jwt-payload.interface';
import {
  CreateListingDto,
  ListListingsQueryDto,
  UpdateListingDto,
} from './dto/listings.dto';
import { ListingsRepository } from './repositories/listings.repository';
import { SubscriptionEntitlementService } from '../subscriptions/services/subscription-entitlement.service';
import { PlanResolverService } from '../plans/plan-resolver.service';
import { notDeleted } from '../common/utils/soft-delete.util';

const PAGE_SIZE = 20;

@Injectable()
export class ListingsService {
  constructor(
    private readonly repo: ListingsRepository,
    private readonly cache: RedisCacheService,
    private readonly logger: LoggerService,
    private readonly feeCheckQueue: FeeCheckQueueService,
    private readonly notifications: AppNotificationsService,
    private readonly entitlements: SubscriptionEntitlementService,
    private readonly planResolver: PlanResolverService,
  ) {}

  async list(query: ListListingsQueryDto) {
    const { cursor, category, country, search, featured, sellerId, minPrice, maxPrice } = query;

    const cacheKey = search || minPrice != null || maxPrice != null
      ? null
      : `listings:v2:${JSON.stringify({ cursor, category, country, featured, sellerId })}`;

    if (cacheKey) {
      const cached = await this.cache.get<{
        listings: unknown[];
        nextCursor: string | null;
        hasMore: boolean;
      }>(cacheKey);
      if (cached) return cached;
    }

    const where: Prisma.ListingWhereInput = { status: 'active', ...notDeleted };
    if (category) where.category = category;
    if (country) where.country = country;
    if (featured) where.featured = true;
    if (sellerId) where.sellerId = sellerId;

    if (search && search.length >= 2) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { arabicTitle: { contains: search } },
        { arabicLocation: { contains: search } },
        { location: { contains: search, mode: 'insensitive' } },
        { breed: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (minPrice != null || maxPrice != null) {
      where.price = {};
      if (minPrice != null) where.price.gte = minPrice;
      if (maxPrice != null) where.price.lte = maxPrice;
    }

    const listings = await this.repo.findMany({
      where,
      take: PAGE_SIZE + 1,
      cursor,
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    });

    const hasMore = listings.length > PAGE_SIZE;
    const items = hasMore ? listings.slice(0, -1) : listings;

    const sorted = [...items].sort((a, b) => {
      const featuredDiff = Number(b.featured) - Number(a.featured);
      if (featuredDiff !== 0) return featuredDiff;
      const aPlan = (a.seller as {
        subscription?: { planId?: string; planAudience?: 'USER' | 'BUTCHER' };
      })?.subscription;
      const bPlan = (b.seller as {
        subscription?: { planId?: string; planAudience?: 'USER' | 'BUTCHER' };
      })?.subscription;
      const tierDiff =
        this.planResolver.planTier(
          bPlan?.planId ?? 'free',
          bPlan?.planAudience ?? 'USER',
        ) -
        this.planResolver.planTier(
          aPlan?.planId ?? 'free',
          aPlan?.planAudience ?? 'USER',
        );
      if (tierDiff !== 0) return tierDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const nextCursor = hasMore ? (sorted[sorted.length - 1]?.id ?? null) : null;

    const result = { listings: sorted, nextCursor, hasMore };

    if (cacheKey) await this.cache.set(cacheKey, result, 90);
    return result;
  }

  async getById(id: string) {
    if (!id) throwApi(400, 'invalid_id', 'معرّف غير صالح');

    const cacheKey = `listing:${id}`;
    const cached = await this.cache.get<unknown>(cacheKey);
    if (cached) {
      this.repo.incrementViews(id).catch(() => {});
      return cached;
    }

    const listing = await this.repo.findById(id);
    if (!listing) throwApi(404, 'not_found', 'الإعلان غير موجود');

    this.repo.incrementViews(id).catch(() => {});
    await this.cache.set(cacheKey, listing, 300);
    return listing;
  }

  async create(user: JwtPayload, dto: CreateListingDto) {
    const quantity = dto.quantity ?? 1;
    const currency = dto.currency ?? 'SAR';
    const featured = dto.featured ?? false;

    const effectivePlanSlug = await this.entitlements.assertCanCreateListing(
      user.userId,
      { images: dto.images, featured },
    );

    const permissions = await this.entitlements.getPermissionsForUser(user.userId);

    const { commission, dueDate } = calculateCommission(
      dto.category as ListingCat,
      dto.price,
      quantity,
      permissions,
    );

    try {
      const listing = await this.repo.createListingWithFee({
        userId: user.userId,
        featured,
        data: {
          title: dto.title,
          arabicTitle: dto.arabicTitle,
          description: dto.description,
          arabicDescription: dto.arabicDescription,
          price: dto.price,
          currency,
          category: dto.category,
          breed: dto.breed,
          age: dto.age,
          quantity,
          location: dto.location,
          arabicLocation: dto.arabicLocation,
          country: dto.country,
          images: dto.images,
          featured,
        },
        commission,
        dueDate,
        category: dto.category,
        quantity,
        price: dto.price,
      });

      const delayMs = dueDate.getTime() - Date.now() + 60_000;
      await this.feeCheckQueue.scheduleFeeCheck(
        {
          listingFeeId: listing.fee!.id,
          userId: user.userId,
          amount: commission,
        },
        delayMs,
      );

      await this.notifications.notifyUser({
        userId: user.userId,
        type: 'fee_due',
        titleAr: '✅ تم نشر إعلانك',
        bodyAr: `إعلانك "${dto.arabicTitle}" منشور. الرسوم: ${commission} ريال خلال ١٤ يوم.`,
        data: { listingId: listing.id, feeId: listing.fee!.id },
      });

      await this.cache.delPattern('listings:v2:*');

      this.logger.info(
        { listingId: listing.id, userId: user.userId, commission },
        'Listing created',
      );
      return listing;
    } catch (err: unknown) {
      const e = err as { code?: string; limit?: number; message?: string };
      if (e.code === 'listing_limit' || e.code === 'featured_limit') {
        throwApi(
          403,
          e.code,
          e.code === 'featured_limit'
            ? `وصلت للحد الأقصى للإعلانات المميزة (${e.limit}).`
            : `وصلت للحد الأقصى (${e.limit} إعلانات). يرجى ترقية الباقة.`,
        );
      }
      this.logger.error({ err }, 'Create listing error');
      throwApi(500, 'server_error', 'خطأ في الخادم');
    }
  }

  async update(user: JwtPayload, id: string, dto: UpdateListingDto) {
    const listing = await this.repo.findOwnerMeta(id);
    if (!listing) throwApi(404, 'not_found', 'الإعلان غير موجود');
    if (listing.sellerId !== user.userId && user.role !== 'ADMIN') {
      throwApi(403, 'forbidden', 'غير مسموح');
    }

    const updated = await this.repo.update(id, dto);
    await this.cache.del(`listing:${id}`);
    await this.cache.delPattern('listings:v2:*');
    return updated;
  }

  async remove(user: JwtPayload, id: string) {
    const listing = await this.repo.findSellerId(id);
    if (!listing) throwApi(404, 'not_found', 'الإعلان غير موجود');
    if (listing.sellerId !== user.userId && user.role !== 'ADMIN') {
      throwApi(403, 'forbidden', 'غير مسموح');
    }

    await this.repo.softDelete(id);
    await this.cache.del(`listing:${id}`);
    await this.cache.delPattern('listings:v2:*');

    this.logger.info({ listingId: id, userId: user.userId }, 'Listing deleted');
    return { deleted: true };
  }
}
