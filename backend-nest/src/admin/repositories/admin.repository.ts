import { Injectable } from '@nestjs/common';
import { Prisma, Role, TicketStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  notDeleted,
  retentionCutoff,
  softDeleteFields,
} from '../../common/utils/soft-delete.util';
import type { PaginationQueryDto } from '../dto/admin.dto';

const USER_SELECT = {
  id: true,
  username: true,
  email: true,
  displayName: true,
  arabicName: true,
  avatar: true,
  role: true,
  verified: true,
  isActive: true,
  country: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const AUTHOR_SELECT = {
  id: true,
  username: true,
  arabicName: true,
  displayName: true,
  avatar: true,
} satisfies Prisma.UserSelect;

const OWNER_USER_SELECT = {
  ...USER_SELECT,
  phone: true,
  emailVerified: true,
  bio: true,
  lastSeenAt: true,
  _count: {
    select: {
      posts: true,
      listings: true,
      followers: true,
      following: true,
      liveStreams: true,
    },
  },
} satisfies Prisma.UserSelect;

function paginate<T>(items: T[], total: number, page: number, pageSize: number) {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function searchOr(fields: string[], search?: string): Prisma.UserWhereInput | undefined {
  if (!search?.trim()) return undefined;
  const q = search.trim();
  return {
    OR: fields.map((f) => ({ [f]: { contains: q, mode: 'insensitive' as const } })),
  };
}

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  runCleanup(now: Date) {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const archivedBefore = retentionCutoff();

    return Promise.all([
      this.prisma.userSession.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      this.prisma.notification.deleteMany({
        where: { isRead: true, createdAt: { lt: ninetyDaysAgo } },
      }),
      this.prisma.story.deleteMany({
        where: { expiresAt: { lt: thirtyDaysAgo }, deletedAt: null },
      }),
      this.prisma.butcherOffer.deleteMany({
        where: { validUntil: { lt: thirtyDaysAgo }, deletedAt: null },
      }),
      // Hard purge soft-deleted content after retention window
      this.prisma.post.deleteMany({ where: { deletedAt: { lt: archivedBefore } } }),
      this.prisma.listing.deleteMany({ where: { deletedAt: { lt: archivedBefore } } }),
      this.prisma.liveStream.deleteMany({ where: { deletedAt: { lt: archivedBefore } } }),
      this.prisma.supportTicket.deleteMany({ where: { deletedAt: { lt: archivedBefore } } }),
      this.prisma.contentSection.deleteMany({ where: { deletedAt: { lt: archivedBefore } } }),
      this.prisma.butcherStory.deleteMany({ where: { deletedAt: { lt: archivedBefore } } }),
      this.prisma.butcherOffer.deleteMany({ where: { deletedAt: { lt: archivedBefore } } }),
      this.prisma.butcherProduct.deleteMany({
        where: { deletedAt: { lt: archivedBefore }, orderItems: { none: {} } },
      }),
      this.prisma.story.deleteMany({ where: { deletedAt: { lt: archivedBefore } } }),
    ]);
  }

  findAdminUserForLogin(login: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ email: login }, { username: login }, { phone: login }],
        role: { in: [Role.ADMIN, Role.MODERATOR] },
        isActive: true,
        deletedAt: null,
      },
    });
  }

  findUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
  }

  async listUsers(query: PaginationQueryDto) {
    const { page, pageSize, search } = query;
    const where: Prisma.UserWhereInput = {
      ...notDeleted,
      ...searchOr(['username', 'email', 'arabicName', 'displayName'], search),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(items, total, page, pageSize);
  }

  updateUser(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT,
    });
  }

  purgeUser(id: string) {
    const ts = Date.now();
    return this.prisma.$transaction([
      this.prisma.userSession.deleteMany({ where: { userId: id } }),
      this.prisma.user.update({
        where: { id },
        data: {
          isActive: false,
          ...softDeleteFields(),
          username: `deleted_${id.slice(0, 8)}_${ts}`,
          email: `deleted_${ts}@safat.deleted`,
          phone: null,
          googleId: null,
          fcmToken: null,
          displayName: 'Deleted User',
          arabicName: 'مستخدم محذوف',
          bio: null,
          avatar: null,
          coverImage: null,
        },
      }),
    ]);
  }

  async listPosts(query: PaginationQueryDto) {
    const { page, pageSize, search, hidden } = query;
    const where: Prisma.PostWhereInput = {
      ...notDeleted,
      ...(hidden === 'true' ? { isHidden: true } : hidden === 'false' ? { isHidden: false } : {}),
      ...(search?.trim()
        ? {
            OR: [
              { content: { contains: search.trim(), mode: 'insensitive' } },
              { arabicContent: { contains: search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: { author: { select: AUTHOR_SELECT } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.post.count({ where }),
    ]);
    return paginate(items, total, page, pageSize);
  }

  updatePost(id: string, data: Prisma.PostUpdateInput) {
    return this.prisma.post.update({
      where: { id },
      data,
      include: { author: { select: AUTHOR_SELECT } },
    });
  }

  softDeletePost(id: string) {
    return this.prisma.post.update({
      where: { id },
      data: { ...softDeleteFields(), isHidden: true },
    });
  }

  async listListings(query: PaginationQueryDto) {
    const { page, pageSize, search, status } = query;
    const where: Prisma.ListingWhereInput = {
      ...notDeleted,
      ...(status ? { status: status as Prisma.EnumListingStatusFilter['equals'] } : {}),
      ...(search?.trim()
        ? {
            OR: [
              { title: { contains: search.trim(), mode: 'insensitive' } },
              { arabicTitle: { contains: search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        include: { seller: { select: AUTHOR_SELECT } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.listing.count({ where }),
    ]);
    return paginate(items, total, page, pageSize);
  }

  updateListing(id: string, data: Prisma.ListingUpdateInput) {
    return this.prisma.listing.update({
      where: { id },
      data,
      include: { seller: { select: AUTHOR_SELECT } },
    });
  }

  softDeleteListing(id: string) {
    return this.prisma.listing.update({
      where: { id },
      data: { ...softDeleteFields(), status: 'suspended' },
    });
  }

  async listTickets(query: PaginationQueryDto) {
    const { page, pageSize, search, status, category } = query;
    const where: Prisma.SupportTicketWhereInput = {
      ...notDeleted,
      ...(status ? { status: status as TicketStatus } : {}),
      ...(category ? { category } : {}),
      ...(search?.trim()
        ? {
            OR: [
              { subject: { contains: search.trim(), mode: 'insensitive' } },
              { ticketNumber: { contains: search.trim(), mode: 'insensitive' } },
              { description: { contains: search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return paginate(items, total, page, pageSize);
  }

  findTicket(id: string) {
    return this.prisma.supportTicket.findUnique({ where: { id } });
  }

  updateTicket(id: string, data: Prisma.SupportTicketUpdateInput) {
    return this.prisma.supportTicket.update({ where: { id }, data });
  }

  softDeleteTicket(id: string) {
    return this.prisma.supportTicket.update({
      where: { id },
      data: { ...softDeleteFields(), status: 'CLOSED' },
    });
  }

  async listLiveStreams(query: PaginationQueryDto) {
    const { page, pageSize, search, live } = query;
    const where: Prisma.LiveStreamWhereInput = {
      ...notDeleted,
      ...(live === 'true' ? { isLive: true } : live === 'false' ? { isLive: false } : {}),
      ...(search?.trim()
        ? {
            OR: [
              { title: { contains: search.trim(), mode: 'insensitive' } },
              { arabicTitle: { contains: search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.liveStream.findMany({
        where,
        include: { host: { select: AUTHOR_SELECT } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.liveStream.count({ where }),
    ]);
    return paginate(items, total, page, pageSize);
  }

  stopLiveStream(id: string) {
    return this.prisma.liveStream.update({
      where: { id },
      data: { isLive: false, endedAt: new Date(), viewers: 0 },
      include: { host: { select: AUTHOR_SELECT } },
    });
  }

  softDeleteLiveStream(id: string) {
    return this.prisma.liveStream.update({
      where: { id },
      data: { ...softDeleteFields(), isLive: false, endedAt: new Date(), viewers: 0 },
    });
  }

  async listButchers(query: PaginationQueryDto) {
    const { page, pageSize, search } = query;
    const where: Prisma.ButcherWhereInput = {
      ...notDeleted,
      ...(search?.trim()
        ? {
            OR: [
              { nameAr: { contains: search.trim(), mode: 'insensitive' } },
              { nameEn: { contains: search.trim(), mode: 'insensitive' } },
              { cityAr: { contains: search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.butcher.findMany({
        where,
        include: { user: { select: AUTHOR_SELECT } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.butcher.count({ where }),
    ]);
    return paginate(items, total, page, pageSize);
  }

  updateButcher(id: string, data: Prisma.ButcherUpdateInput) {
    return this.prisma.butcher.update({
      where: { id },
      data,
      include: { user: { select: AUTHOR_SELECT } },
    });
  }

  findButcherById(id: string) {
    return this.prisma.butcher.findUnique({
      where: { id },
      include: {
        user: { select: OWNER_USER_SELECT },
        sourceApplication: {
          select: { id: true, applicationNumber: true, status: true, submittedAt: true },
        },
      },
    });
  }

  listSettings() {
    return this.prisma.appSetting.findMany({ orderBy: { key: 'asc' } });
  }

  upsertSetting(key: string, value: unknown, labelAr?: string, category?: string) {
    return this.prisma.appSetting.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue, labelAr, category },
      update: {
        value: value as Prisma.InputJsonValue,
        ...(labelAr !== undefined ? { labelAr } : {}),
        ...(category !== undefined ? { category } : {}),
      },
    });
  }

  listSections() {
    return this.prisma.contentSection.findMany({
      where: notDeleted,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  createSection(data: Prisma.ContentSectionCreateInput) {
    return this.prisma.contentSection.create({ data });
  }

  updateSection(id: string, data: Prisma.ContentSectionUpdateInput) {
    return this.prisma.contentSection.update({ where: { id }, data });
  }

  softDeleteSection(id: string) {
    return this.prisma.contentSection.update({
      where: { id },
      data: { ...softDeleteFields(), isActive: false },
    });
  }

  async getDashboardStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      newToday,
      totalPosts,
      hiddenPosts,
      totalListings,
      activeListings,
      suspendedListings,
      totalStreams,
      liveNow,
      openTickets,
      urgentTickets,
      totalTickets,
      totalButchers,
      verifiedButchers,
      usersRaw,
      ticketsByCategory,
    ] = await Promise.all([
      this.prisma.user.count({ where: notDeleted }),
      this.prisma.user.count({ where: { ...notDeleted, isActive: true } }),
      this.prisma.user.count({ where: { ...notDeleted, isActive: false } }),
      this.prisma.user.count({ where: { ...notDeleted, createdAt: { gte: todayStart } } }),
      this.prisma.post.count({ where: notDeleted }),
      this.prisma.post.count({ where: { ...notDeleted, isHidden: true } }),
      this.prisma.listing.count({ where: notDeleted }),
      this.prisma.listing.count({ where: { ...notDeleted, status: 'active' } }),
      this.prisma.listing.count({ where: { ...notDeleted, status: 'suspended' } }),
      this.prisma.liveStream.count({ where: notDeleted }),
      this.prisma.liveStream.count({ where: { ...notDeleted, isLive: true } }),
      this.prisma.supportTicket.count({
        where: { ...notDeleted, status: { in: ['OPEN', 'IN_REVIEW', 'IN_PROGRESS'] } },
      }),
      this.prisma.supportTicket.count({
        where: { ...notDeleted, priority: 'URGENT', status: { not: 'CLOSED' } },
      }),
      this.prisma.supportTicket.count({ where: notDeleted }),
      this.prisma.butcher.count({ where: notDeleted }),
      this.prisma.butcher.count({ where: { ...notDeleted, type: 'verified' } }),
      this.prisma.user.findMany({
        where: { ...notDeleted, createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
      }),
      this.prisma.supportTicket.groupBy({
        by: ['category'],
        where: notDeleted,
        _count: { category: true },
      }),
    ]);

    const dayMap = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
      dayMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const u of usersRaw) {
      const key = u.createdAt.toISOString().slice(0, 10);
      if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
    }

    return {
      users: { total: totalUsers, active: activeUsers, banned: bannedUsers, newToday },
      posts: { total: totalPosts, hidden: hiddenPosts },
      listings: { total: totalListings, active: activeListings, suspended: suspendedListings },
      liveStreams: { total: totalStreams, liveNow },
      tickets: { open: openTickets, urgent: urgentTickets, total: totalTickets },
      butchers: { total: totalButchers, verified: verifiedButchers },
      charts: {
        usersByDay: Array.from(dayMap.entries()).map(([date, count]) => ({ date, count })),
        ticketsByCategory: ticketsByCategory.map((t) => ({
          category: t.category,
          count: t._count.category,
        })),
      },
    };
  }

  async listOrders(query: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
    butcherId?: string;
    customerId?: string;
    dateFrom?: string;
    dateTo?: string;
    orderNumber?: string;
  }) {
    const { page, pageSize, search } = query;
    const createdAt: Prisma.DateTimeFilter | undefined =
      query.dateFrom || query.dateTo
        ? {
            ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
            ...(query.dateTo ? { lte: new Date(`${query.dateTo}T23:59:59.999Z`) } : {}),
          }
        : undefined;

    const where: Prisma.ButcherOrderWhereInput = {
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.butcherId ? { butcherId: query.butcherId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(query.orderNumber?.trim()
        ? { orderNumber: { contains: query.orderNumber.trim(), mode: 'insensitive' } }
        : {}),
      ...(search?.trim()
        ? {
            OR: [
              { orderNumber: { contains: search.trim(), mode: 'insensitive' } },
              { notes: { contains: search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.butcherOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          butcher: { select: { id: true, nameAr: true, nameEn: true, userId: true } },
          customer: { select: { id: true, arabicName: true, displayName: true, phone: true } },
          product: {
            select: { id: true, nameAr: true, nameEn: true, availableQuantity: true, reservedQuantity: true },
          },
          timeline: { orderBy: { createdAt: 'asc' } },
        },
      }),
      this.prisma.butcherOrder.count({ where }),
    ]);
    return paginate(items, total, page, pageSize);
  }

  getOrderById(orderId: string) {
    return this.prisma.butcherOrder.findUnique({
      where: { id: orderId },
      include: {
        butcher: { select: { id: true, nameAr: true, nameEn: true, userId: true } },
        customer: { select: { id: true, arabicName: true, displayName: true, phone: true } },
        product: true,
        timeline: { orderBy: { createdAt: 'asc' } },
        audits: { orderBy: { changedAt: 'asc' } },
      },
    });
  }

  ensureDefaultSettings() {
    const defaults = [
      { key: 'maintenanceMode', value: false, labelAr: 'وضع الصيانة', category: 'system' },
      { key: 'allowRegistration', value: true, labelAr: 'السماح بالتسجيل', category: 'auth' },
      { key: 'liveStreamsEnabled', value: true, labelAr: 'تفعيل البث المباشر', category: 'features' },
      { key: 'butcherApplicationsEnabled', value: true, labelAr: 'طلبات الملاحم', category: 'features' },
    ];
    return Promise.all(
      defaults.map((s) =>
        this.prisma.appSetting.upsert({
          where: { key: s.key },
          create: s,
          update: {},
        }),
      ),
    );
  }
}
