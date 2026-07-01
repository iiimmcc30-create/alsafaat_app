import type { ButcherApplicationDocumentType } from '@prisma/client';
import {
  createDocument,
  replaceDocument,
  deleteDocument,
  findDocumentByApplicationAndType,
  getDocumentOrThrow,
} from '../repositories/document.repository';
import { getApplicationByIdOrThrow } from '../repositories/application.repository';
import { runInTransaction, assertApplicationOwner } from '../helpers/transaction';
import { appendTimelineEvent } from '../helpers/timeline';
import { assertEditableStatus } from '../helpers/stateTransitions';
import {
  validateDocumentUploadInput,
  assertFileKeyOwnedByUser,
  isUniqueRequiredDocumentType,
} from '../helpers/validation';
import { toDocumentDtoPublic } from '../mappers';
import {
  ButcherApplicationError,
  mapPrismaUniqueViolation,
} from '../errors';
import type {
  DocumentDto,
  DocumentReplaceInput,
  DocumentUploadInput,
} from '../types';

export class ButcherApplicationDocumentService {
  async uploadDocument(
    userId: string,
    applicationId: string,
    input: DocumentUploadInput,
  ): Promise<DocumentDto> {
    validateDocumentUploadInput(input);
    assertFileKeyOwnedByUser(input.fileKey, userId);

    try {
      return await runInTransaction(async (tx) => {
        const application = await getApplicationByIdOrThrow(applicationId, tx);
        assertApplicationOwner(application.userId, userId);
        assertEditableStatus(application.status);

        if (isUniqueRequiredDocumentType(input.type)) {
          const existing = await findDocumentByApplicationAndType(
            applicationId,
            input.type,
            tx,
          );
          if (existing) {
            throw new ButcherApplicationError('DOCUMENT_TYPE_ALREADY_EXISTS');
          }
        }

        const document = await createDocument(tx, applicationId, input);

        await appendTimelineEvent(tx, {
          applicationId,
          action: 'UPDATE',
          createdBy: userId,
          metadata: {
            documentType: input.type,
            action: 'document_added',
            documentId: document.id,
          },
        });

        return toDocumentDtoPublic(document);
      });
    } catch (err) {
      const mapped = mapPrismaUniqueViolation(err);
      if (mapped) throw mapped;
      throw err;
    }
  }

  async replaceDocument(
    userId: string,
    applicationId: string,
    documentId: string,
    input: DocumentReplaceInput,
  ): Promise<DocumentDto> {
    if (!input.fileKey || input.fileKey.length < 10) {
      throw new ButcherApplicationError('INVALID_FILE');
    }

    return runInTransaction(async (tx) => {
      const application = await getApplicationByIdOrThrow(applicationId, tx);
      assertApplicationOwner(application.userId, userId);
      assertEditableStatus(application.status);

      const existing = await getDocumentOrThrow(documentId, applicationId, tx);

      validateDocumentUploadInput({
        type: existing.type,
        fileKey: input.fileKey,
        originalFileName: input.originalFileName,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
      });
      assertFileKeyOwnedByUser(input.fileKey, userId);

      const document = await replaceDocument(tx, existing.id, input);

      await appendTimelineEvent(tx, {
        applicationId,
        action: 'UPDATE',
        createdBy: userId,
        metadata: {
          documentType: existing.type,
          action: 'document_replaced',
          documentId: existing.id,
        },
      });

      return toDocumentDtoPublic(document);
    });
  }

  async deleteDocument(
    userId: string,
    applicationId: string,
    documentId: string,
  ): Promise<void> {
    await runInTransaction(async (tx) => {
      const application = await getApplicationByIdOrThrow(applicationId, tx);
      assertApplicationOwner(application.userId, userId);
      assertEditableStatus(application.status);

      const existing = await getDocumentOrThrow(documentId, applicationId, tx);
      await deleteDocument(tx, existing.id);

      await appendTimelineEvent(tx, {
        applicationId,
        action: 'UPDATE',
        createdBy: userId,
        metadata: {
          documentType: existing.type as ButcherApplicationDocumentType,
          action: 'document_removed',
          documentId: existing.id,
        },
      });
    });
  }
}

export const butcherApplicationDocumentService = new ButcherApplicationDocumentService();
