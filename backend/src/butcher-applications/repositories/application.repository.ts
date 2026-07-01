import type {
  ButcherApplicationStatus,
  Country,
  Prisma,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import type { ApplicationSnapshotInput, AdminListQuery, UserListQuery } from '../types';
import type { TransactionClient } from '../helpers/transaction';
import type { AdminSortOption } from '../constants';
import { ButcherApplicationError } from '../errors';

const timelineInclude = {
  orderBy: { createdAt: 'asc' as const },
  include: {
    actor: { select: { id: true, username: true } },
  },
};

const documentInclude = {
  orderBy: { createdAt: 'asc' as const },
};

export const applicationInclude = {
  documents: documentInclude,
  timelineEvents: timelineInclude,
  sourcedButcher: { select: { id: true } },
  user: {
    select: { id: true, username: true, phone: true, avatar: true },
  },
};

export type ApplicationEntity = Prisma.ButcherApplicationGetPayload<{
  include: typeof applicationInclude;
}>;

function adminOrderBy(sort: AdminSortOption = 'submittedAt_desc') {
  switch (sort) {
    case 'createdAt_desc':
      return [{ createdAt: 'desc' as const }, { id: 'desc' as const }];
    case 'updatedAt_desc':
      return [{ updatedAt: 'desc' as const }, { id: 'desc' as const }];
    case 'submittedAt_desc':
    default:
      return [{ submittedAt: 'desc' as const }, { id: 'desc' as const }];
  }
}

export async function findButcherByUserId(userId: string) {
  return prisma.butcher.findUnique({
    where: { userId },
    select: { id: true },
  });
}

export async function findActiveApplicationByUserAndStatus(
  tx: TransactionClient,
  userId: string,
  status: ButcherApplicationStatus,
) {
  return tx.butcherApplication.findFirst({
    where: { userId, status },
    select: { id: true, status: true },
  });
}

export async function getNextApplicationNumber(
  tx: TransactionClient,
  userId: string,
): Promise<number> {
  const latest = await tx.butcherApplication.findFirst({
    where: { userId },
    orderBy: { applicationNumber: 'desc' },
    select: { applicationNumber: true },
  });
  return (latest?.applicationNumber ?? 0) + 1;
}

export async function createApplication(
  tx: TransactionClient,
  userId: string,
  data: ApplicationSnapshotInput,
): Promise<ApplicationEntity> {
  const applicationNumber = await getNextApplicationNumber(tx, userId);

  return tx.butcherApplication.create({
    data: {
      userId,
      applicationNumber,
      status: 'DRAFT',
      ...data,
    },
    include: applicationInclude,
  });
}

export async function findApplicationById(
  id: string,
  tx: TransactionClient | typeof prisma = prisma,
): Promise<ApplicationEntity | null> {
  return tx.butcherApplication.findUnique({
    where: { id },
    include: applicationInclude,
  });
}

export async function getApplicationByIdOrThrow(
  id: string,
  tx: TransactionClient | typeof prisma = prisma,
): Promise<ApplicationEntity> {
  const application = await findApplicationById(id, tx);
  if (!application) {
    throw new ButcherApplicationError('APPLICATION_NOT_FOUND');
  }
  return application;
}

export async function updateApplicationSnapshot(
  tx: TransactionClient,
  id: string,
  data: ApplicationSnapshotInput,
): Promise<ApplicationEntity> {
  return tx.butcherApplication.update({
    where: { id },
    data,
    include: applicationInclude,
  });
}

export async function updateApplicationStatus(
  tx: TransactionClient,
  id: string,
  data: Prisma.ButcherApplicationUpdateInput,
): Promise<ApplicationEntity> {
  return tx.butcherApplication.update({
    where: { id },
    data,
    include: applicationInclude,
  });
}

const summaryInclude = {
  sourcedButcher: { select: { id: true } },
};

export type ApplicationSummaryEntity = Prisma.ButcherApplicationGetPayload<{
  include: typeof summaryInclude;
}>;

export async function listUserApplications(
  userId: string,
  query: UserListQuery,
  limit: number,
): Promise<ApplicationSummaryEntity[]> {
  const where: Prisma.ButcherApplicationWhereInput = { userId };
  if (query.status) where.status = query.status;

  return prisma.butcherApplication.findMany({
    where,
    take: limit + 1,
    cursor: query.cursor ? { id: query.cursor } : undefined,
    skip: query.cursor ? 1 : 0,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: summaryInclude,
  });
}

export async function listAdminApplications(
  query: AdminListQuery,
  limit: number,
): Promise<ApplicationEntity[]> {
  const where: Prisma.ButcherApplicationWhereInput = {};

  if (query.status) where.status = query.status;
  if (query.country) where.country = query.country;

  if (query.submittedFrom || query.submittedTo) {
    where.submittedAt = {};
    if (query.submittedFrom) where.submittedAt.gte = query.submittedFrom;
    if (query.submittedTo) where.submittedAt.lte = query.submittedTo;
  }

  if (query.search && query.search.length >= 2) {
    const asNumber = parseInt(query.search, 10);
    where.OR = [
      { nameAr: { contains: query.search } },
      { nameEn: { contains: query.search, mode: 'insensitive' } },
      ...(Number.isFinite(asNumber)
        ? [{ applicationNumber: asNumber }]
        : []),
      {
        user: {
          OR: [
            { username: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search } },
          ],
        },
      },
    ];
  }

  return prisma.butcherApplication.findMany({
    where,
    take: limit + 1,
    cursor: query.cursor ? { id: query.cursor } : undefined,
    skip: query.cursor ? 1 : 0,
    orderBy: adminOrderBy(query.sort),
    include: applicationInclude,
  });
}

export async function countSubmittedApplications(): Promise<number> {
  return prisma.butcherApplication.count({ where: { status: 'SUBMITTED' } });
}

export async function provisionButcherFromApplication(
  tx: TransactionClient,
  application: ApplicationEntity,
): Promise<{ id: string; sourceApplicationId: string | null }> {
  const butcher = await tx.butcher.create({
    data: {
      userId: application.userId,
      nameAr: application.nameAr!,
      nameEn: application.nameEn!,
      country: application.country!,
      city: application.city!,
      cityAr: application.cityAr!,
      address: application.address!,
      addressAr: application.addressAr!,
      lat: application.lat,
      lng: application.lng,
      phone: application.shopPhone!,
      bioAr: application.bioAr,
      bioEn: application.bioEn,
      specialties: application.specialties,
      commercialReg: application.commercialReg,
      openTime: application.openTime,
      closeTime: application.closeTime,
      closedDays: [],
      type: 'regular',
      sourceApplicationId: application.id,
    },
    select: { id: true, sourceApplicationId: true },
  });

  return butcher;
}

export async function findAllAdminUserIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}
