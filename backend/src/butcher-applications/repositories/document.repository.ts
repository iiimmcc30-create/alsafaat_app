import type { ButcherApplicationDocumentType, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import type { TransactionClient } from '../helpers/transaction';
import { ButcherApplicationError } from '../errors';
import type { DocumentUploadInput, DocumentReplaceInput } from '../types';

export async function findDocumentById(
  id: string,
  tx: TransactionClient | typeof prisma = prisma,
) {
  return tx.butcherApplicationDocument.findUnique({ where: { id } });
}

export async function findDocumentByIdAndApplication(
  documentId: string,
  applicationId: string,
  tx: TransactionClient | typeof prisma = prisma,
) {
  return tx.butcherApplicationDocument.findFirst({
    where: { id: documentId, applicationId },
  });
}

export async function findDocumentByApplicationAndType(
  applicationId: string,
  type: ButcherApplicationDocumentType,
  tx: TransactionClient | typeof prisma = prisma,
) {
  return tx.butcherApplicationDocument.findFirst({
    where: { applicationId, type },
  });
}

export async function listDocumentsByApplicationId(
  applicationId: string,
  tx: TransactionClient | typeof prisma = prisma,
) {
  return tx.butcherApplicationDocument.findMany({
    where: { applicationId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createDocument(
  tx: TransactionClient,
  applicationId: string,
  input: DocumentUploadInput,
) {
  return tx.butcherApplicationDocument.create({
    data: {
      applicationId,
      type: input.type,
      fileKey: input.fileKey,
      originalFileName: input.originalFileName ?? null,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      status: 'UPLOADED',
    },
  });
}

export async function replaceDocument(
  tx: TransactionClient,
  documentId: string,
  input: DocumentReplaceInput,
) {
  return tx.butcherApplicationDocument.update({
    where: { id: documentId },
    data: {
      fileKey: input.fileKey,
      originalFileName: input.originalFileName ?? null,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      status: 'UPLOADED',
      verifiedBy: null,
      verifiedAt: null,
      notes: null,
    },
  });
}

export async function deleteDocument(
  tx: TransactionClient,
  documentId: string,
): Promise<void> {
  await tx.butcherApplicationDocument.delete({ where: { id: documentId } });
}

export async function approveUploadedDocuments(
  tx: TransactionClient,
  applicationId: string,
  adminUserId: string,
  now: Date,
): Promise<void> {
  await tx.butcherApplicationDocument.updateMany({
    where: { applicationId, status: 'UPLOADED' },
    data: {
      status: 'APPROVED',
      verifiedBy: adminUserId,
      verifiedAt: now,
    },
  });
}

export async function getDocumentOrThrow(
  documentId: string,
  applicationId: string,
  tx: TransactionClient | typeof prisma = prisma,
) {
  const document = await findDocumentByIdAndApplication(documentId, applicationId, tx);
  if (!document) {
    throw new ButcherApplicationError('DOCUMENT_NOT_FOUND');
  }
  return document;
}

export type DocumentEntity = Prisma.ButcherApplicationDocumentGetPayload<object>;
