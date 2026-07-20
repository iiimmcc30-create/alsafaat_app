import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { notDeleted, softDeleteFields } from '../../common/utils/soft-delete.util';

const SELLER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  arabicName: true,
  avatar: true,
  verified: true,
  country: true,
} as const;

const SELLER_DETAIL_SELECT = {
  ...SELLER_SELECT,
  bio: true,
} as const;

@Injectable()
export class ListingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(params: {
    where: Prisma.ListingWhereInput;
    take: number;
    cursor?: string;
    orderBy: Prisma.ListingOrderByWithRelationInput[];
  }) {
    return this.prisma.listing.findMany({
      where: params.where,
      take: params.take,
      cursor: params.cursor ? { id: params.cursor } : undefined,
      skip: params.cursor ? 1 : 0,
      orderBy: params.orderBy,
      include: {
        seller: {
          select: {
            ...SELLER_SELECT,
            subscription: {
              select: { planId: true, planAudience: true },
            },
          },
        },
      },
    });
  }

  findById(id: string) {
    return this.prisma.listing.findFirst({
      where: { id, ...notDeleted },
      include: {
        seller: { select: SELLER_DETAIL_SELECT },
        fee: { select: { status: true, commission: true, dueDate: true } },
      },
    });
  }

  findOwnerMeta(id: string) {
    return this.prisma.listing.findUnique({
      where: { id },
      select: { sellerId: true, category: true, country: true, weightKg: true },
    });
  }

  findSellerId(id: string) {
    return this.prisma.listing.findUnique({
      where: { id },
      select: { sellerId: true },
    });
  }

  incrementViews(id: string) {
    return this.prisma.listing.update({
      where: { id },
      data: { views: { increment: 1 } },
    });
  }

  update(id: string, data: Prisma.ListingUpdateInput) {
    return this.prisma.listing.update({ where: { id }, data });
  }

  markSold(id: string) {
    return this.prisma.listing.update({
      where: { id },
      data: { status: 'sold', ...softDeleteFields() },
    });
  }

  softDelete(id: string) {
    return this.prisma.listing.update({
      where: { id },
      data: { status: 'suspended', ...softDeleteFields() },
    });
  }

  createListingWithFee(params: {
    userId: string;
    featured: boolean;
    pinned?: boolean;
    data: Omit<Prisma.ListingUncheckedCreateInput, 'sellerId'>;
    commission: number;
    dueDate: Date;
    category: string;
    quantity: number;
    price: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const sub = await tx.subscription.findUnique({
        where: { userId: params.userId },
        select: {
          dailyAdsUsed: true,
          dailyAdsWindowStart: true,
        },
      });

      const usageUpdate: Prisma.SubscriptionUpdateInput = {
        listingsUsed: { increment: 1 },
        dailyAdsUsed: { increment: 1 },
        dailyAdsWindowStart: sub?.dailyAdsWindowStart ?? now,
      };
      if (params.featured) {
        usageUpdate.featuredAdsUsed = { increment: 1 };
      }
      if (params.pinned) {
        usageUpdate.pinnedAdsUsed = { increment: 1 };
      }

      const created = await tx.listing.create({
        data: {
          ...params.data,
          sellerId: params.userId,
          fee: {
            create: {
              userId: params.userId,
              category: params.category,
              quantity: params.quantity,
              price: params.price,
              commission: params.commission,
              dueDate: params.dueDate,
              status: 'pending',
            },
          },
        },
        include: {
          seller: {
            select: {
              id: true,
              username: true,
              displayName: true,
              arabicName: true,
              avatar: true,
            },
          },
          fee: true,
        },
      });

      await tx.subscription.update({
        where: { userId: params.userId },
        data: usageUpdate,
      });

      return created;
    });
  }
}
