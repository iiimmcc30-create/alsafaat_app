import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { notDeleted, softDeleteFields } from '../../common/utils/soft-delete.util';

const BUTCHER_LIST_INCLUDE = {
  user: { select: { id: true, username: true, avatar: true } },
  _count: { select: { products: true, orders: true } },
} as const;

const BUTCHER_DETAIL_INCLUDE = {
  products: true,
  offers: true,
  reviews: {
    take: 10,
    orderBy: { createdAt: 'desc' as const },
    include: {
      reviewer: {
        select: { id: true, displayName: true, arabicName: true, avatar: true },
      },
    },
  },
  user: { select: { id: true, username: true, avatar: true } },
} as const;

@Injectable()
export class ButchersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyButchers(params: {
    where: Prisma.ButcherWhereInput;
    cursor?: string;
    take: number;
  }) {
    const { where, cursor, take } = params;
    return this.prisma.butcher.findMany({
      where,
      take,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: [
        { subscriptionActive: 'desc' },
        { rating: 'desc' },
        { activityScore: 'desc' },
        { id: 'asc' },
      ],
      include: BUTCHER_LIST_INCLUDE,
    });
  }

  findButcherById(id: string) {
    return this.prisma.butcher.findFirst({
      where: { id, ...notDeleted },
      include: BUTCHER_DETAIL_INCLUDE,
    });
  }

  findButcherByUserId(userId: string) {
    return this.prisma.butcher.findFirst({
      where: { userId, ...notDeleted },
      include: BUTCHER_DETAIL_INCLUDE,
    });
  }

  findButcherOwner(id: string) {
    return this.prisma.butcher.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
  }

  findButcherOwnerByUser(userId: string) {
    return this.prisma.butcher.findUnique({
      where: { userId },
      select: { id: true, userId: true },
    });
  }

  incrementProfileViews(id: string) {
    return this.prisma.butcher.update({
      where: { id },
      data: { profileViews: { increment: 1 } },
    });
  }

  updateButcher(id: string, data: Prisma.ButcherUpdateInput) {
    return this.prisma.butcher.update({ where: { id }, data });
  }

  findButcherForStats(userId: string) {
    return this.prisma.butcher.findUnique({
      where: { userId },
      select: {
        id: true,
        nameAr: true,
        profileViews: true,
        rating: true,
        reviewCount: true,
        subscriptionActive: true,
      },
    });
  }

  findOrdersInRange(butcherId: string, from: Date, to?: Date) {
    return this.prisma.butcherOrder.findMany({
      where: {
        butcherId,
        createdAt: to ? { gte: from, lt: to } : { gte: from },
      },
      include: to ? undefined : { product: { select: { nameAr: true } } },
    });
  }

  findProducts(butcherId: string) {
    return this.prisma.butcherProduct.findMany({
      where: { butcherId, ...notDeleted },
      orderBy: { createdAt: 'desc' },
    });
  }

  createProduct(data: Prisma.ButcherProductUncheckedCreateInput) {
    return this.prisma.butcherProduct.create({ data });
  }

  findProductWithButcher(id: string) {
    return this.prisma.butcherProduct.findFirst({
      where: { id, ...notDeleted },
      include: { butcher: { select: { userId: true, id: true } } },
    });
  }

  updateProduct(id: string, data: Prisma.ButcherProductUpdateInput) {
    return this.prisma.butcherProduct.update({ where: { id }, data });
  }

  softDeleteProduct(id: string) {
    return this.prisma.butcherProduct.update({
      where: { id },
      data: { ...softDeleteFields(), inStock: false },
    });
  }

  findButcherIdByUser(userId: string) {
    return this.prisma.butcher.findUnique({
      where: { userId },
      select: { id: true },
    });
  }

  findActiveOffers(butcherId: string) {
    return this.prisma.butcherOffer.findMany({
      where: { butcherId, validUntil: { gte: new Date() }, ...notDeleted },
      orderBy: { createdAt: 'desc' },
    });
  }

  createOffer(data: Prisma.ButcherOfferUncheckedCreateInput) {
    return this.prisma.butcherOffer.create({ data });
  }

  findOwnedOffer(offerId: string, userId: string) {
    return this.prisma.butcherOffer.findFirst({
      where: { id: offerId, butcher: { userId } },
      select: { id: true, butcherId: true },
    });
  }

  updateOffer(id: string, data: Prisma.ButcherOfferUpdateInput) {
    return this.prisma.butcherOffer.update({ where: { id }, data });
  }

  softDeleteOffer(id: string) {
    return this.prisma.butcherOffer.update({
      where: { id },
      data: softDeleteFields(),
    });
  }

  findOrdersForButcher(butcherId: string) {
    return this.prisma.butcherOrder.findMany({
      where: { butcherId },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: {
            id: true,
            displayName: true,
            arabicName: true,
            avatar: true,
            phone: true,
          },
        },
        product: true,
        timeline: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  findOrdersForCustomer(customerId: string) {
    return this.prisma.butcherOrder.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        butcher: true,
        product: true,
        timeline: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  findProductForOrder(productId: string) {
    return this.prisma.butcherProduct.findUnique({
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
  }

  findOrderWithButcher(id: string) {
    return this.prisma.butcherOrder.findUnique({
      where: { id },
      include: { butcher: { select: { userId: true, id: true } } },
    });
  }

  findOrderById(id: string) {
    return this.prisma.butcherOrder.findUnique({
      where: { id },
      include: {
        butcher: true,
        customer: {
          select: {
            id: true,
            displayName: true,
            arabicName: true,
            avatar: true,
            phone: true,
          },
        },
        product: true,
        timeline: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  findOrderAudits(orderId: string) {
    return this.prisma.orderStatusAudit.findMany({
      where: { orderId },
      orderBy: { changedAt: 'asc' },
    });
  }

  findActiveStories() {
    return this.prisma.butcherStory.findMany({
      where: { expiresAt: { gt: new Date() }, ...notDeleted },
      orderBy: { createdAt: 'desc' },
      include: {
        butcher: {
          select: {
            id: true,
            nameAr: true,
            nameEn: true,
            logo: true,
            subscriptionActive: true,
            country: true,
          },
        },
      },
    });
  }

  createStory(data: Prisma.ButcherStoryUncheckedCreateInput) {
    return this.prisma.butcherStory.create({
      data,
      include: {
        butcher: {
          select: {
            id: true,
            nameAr: true,
            nameEn: true,
            logo: true,
            subscriptionActive: true,
            country: true,
          },
        },
      },
    });
  }

  findStoryWithButcher(id: string) {
    return this.prisma.butcherStory.findUnique({
      where: { id },
      include: { butcher: { select: { userId: true } } },
    });
  }

  softDeleteStory(id: string) {
    return this.prisma.butcherStory.update({
      where: { id },
      data: softDeleteFields(),
    });
  }

  findButcherForReview(id: string) {
    return this.prisma.butcher.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
  }

  findReviews(butcherId: string) {
    return this.prisma.butcherReview.findMany({
      where: { butcherId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        reviewer: {
          select: {
            id: true,
            displayName: true,
            arabicName: true,
            avatar: true,
            verified: true,
          },
        },
      },
    });
  }

  upsertReview(params: {
    butcherId: string;
    reviewerId: string;
    rating: number;
    comment?: string;
  }) {
    const { butcherId, reviewerId, rating, comment } = params;
    return this.prisma.butcherReview.upsert({
      where: { butcherId_reviewerId: { butcherId, reviewerId } },
      update: { rating, comment },
      create: { butcherId, reviewerId, rating, comment },
      include: {
        reviewer: {
          select: {
            id: true,
            displayName: true,
            arabicName: true,
            avatar: true,
          },
        },
      },
    });
  }

  aggregateReviews(butcherId: string) {
    return this.prisma.butcherReview.aggregate({
      where: { butcherId },
      _avg: { rating: true },
      _count: { rating: true },
    });
  }

  updateButcherRating(butcherId: string, rating: number, reviewCount: number) {
    return this.prisma.butcher.update({
      where: { id: butcherId },
      data: { rating, reviewCount },
    });
  }
}
