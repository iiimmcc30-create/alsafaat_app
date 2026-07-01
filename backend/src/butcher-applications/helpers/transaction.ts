import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { ButcherApplicationError } from '../errors';

export type TransactionClient = Prisma.TransactionClient;

export async function runInTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(fn);
}

export function assertNotModified(
  currentUpdatedAt: Date,
  expectedUpdatedAt?: Date | string,
): void {
  if (expectedUpdatedAt === undefined) return;

  const expected =
    expectedUpdatedAt instanceof Date
      ? expectedUpdatedAt.getTime()
      : new Date(expectedUpdatedAt).getTime();

  if (Number.isNaN(expected) || currentUpdatedAt.getTime() !== expected) {
    throw new ButcherApplicationError('APPLICATION_CONFLICT');
  }
}

export async function assertUserHasNoButcher(
  tx: TransactionClient,
  userId: string,
): Promise<void> {
  const existing = await tx.butcher.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (existing) {
    throw new ButcherApplicationError('BUTCHER_ALREADY_EXISTS');
  }
}

export function assertApplicationOwner(
  applicationUserId: string,
  requestUserId: string,
): void {
  if (applicationUserId !== requestUserId) {
    throw new ButcherApplicationError('APPLICATION_ACCESS_DENIED');
  }
}

export function assertDraftStatus(status: string): void {
  if (status !== 'DRAFT') {
    throw new ButcherApplicationError('APPLICATION_NOT_EDITABLE');
  }
}
