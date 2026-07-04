import { ButcherApplicationDocumentService } from '../../services/document.service';
import * as appRepo from '../../repositories/application.repository';
import * as docRepo from '../../repositories/document.repository';
import * as transaction from '../../helpers/transaction';
import { TEST_APP_ID, TEST_DOC_ID, TEST_USER_ID } from '../helpers/testUtils';
import { MAX_DOCUMENT_FILE_BYTES } from '../../constants';

jest.mock('../../repositories/application.repository');
jest.mock('../../repositories/document.repository');
jest.mock('../../helpers/transaction');
jest.mock('../../helpers/timeline', () => ({
  appendTimelineEvent: jest.fn().mockResolvedValue({
    id: 'event-1',
    action: 'UPDATE',
    comment: null,
    createdBy: 'user',
    metadata: {},
    createdAt: new Date(),
    actor: { id: 'user', username: 'user' },
  }),
}));

const draftApp = {
  id: TEST_APP_ID,
  userId: TEST_USER_ID,
  status: 'DRAFT' as const,
  documents: [],
};

describe('ButcherApplicationDocumentService', () => {
  const service = new ButcherApplicationDocumentService();
  const runInTransaction = transaction.runInTransaction as jest.Mock;
  const tx = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    runInTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
    (transaction.assertApplicationOwner as jest.Mock).mockImplementation(() => undefined);
  });

  describe('uploadDocument', () => {
    const input = {
      type: 'commercial_license' as const,
      fileKey: `butcher-applications/${TEST_USER_ID}/license.pdf`,
      mimeType: 'application/pdf',
      fileSizeBytes: 1024,
    };

    it('rejects invalid mime before transaction', async () => {
      await expect(
        service.uploadDocument(TEST_USER_ID, TEST_APP_ID, {
          ...input,
          mimeType: 'text/plain',
        }),
      ).rejects.toMatchObject({ code: 'UNSUPPORTED_MIME_TYPE' });
    });

    it('rejects invalid file key ownership', async () => {
      await expect(
        service.uploadDocument(TEST_USER_ID, TEST_APP_ID, {
          ...input,
          fileKey: 'butcher-applications/other-user/license.pdf',
        }),
      ).rejects.toMatchObject({ code: 'INVALID_FILE' });
    });

    it('rejects duplicate required document type', async () => {
      (appRepo.getApplicationByIdOrThrow as jest.Mock).mockResolvedValue(draftApp);
      (docRepo.findDocumentByApplicationAndType as jest.Mock).mockResolvedValue({ id: 'existing' });

      await expect(
        service.uploadDocument(TEST_USER_ID, TEST_APP_ID, input),
      ).rejects.toMatchObject({ code: 'DOCUMENT_TYPE_ALREADY_EXISTS' });
    });

    it('uploads document on valid input', async () => {
      (appRepo.getApplicationByIdOrThrow as jest.Mock).mockResolvedValue(draftApp);
      (docRepo.findDocumentByApplicationAndType as jest.Mock).mockResolvedValue(null);
      (docRepo.createDocument as jest.Mock).mockResolvedValue({
        id: TEST_DOC_ID,
        type: 'commercial_license',
        fileKey: input.fileKey,
        status: 'UPLOADED',
        notes: null,
        originalFileName: null,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
        verifiedBy: null,
        verifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const doc = await service.uploadDocument(TEST_USER_ID, TEST_APP_ID, input);
      expect(doc.id).toBe(TEST_DOC_ID);
    });
  });

  describe('replaceDocument', () => {
    it('rejects oversized replacement', async () => {
      (appRepo.getApplicationByIdOrThrow as jest.Mock).mockResolvedValue(draftApp);
      (docRepo.getDocumentOrThrow as jest.Mock).mockResolvedValue({
        id: TEST_DOC_ID,
        type: 'commercial_license',
      });

      await expect(
        service.replaceDocument(TEST_USER_ID, TEST_APP_ID, TEST_DOC_ID, {
          fileKey: `butcher-applications/${TEST_USER_ID}/license.pdf`,
          mimeType: 'application/pdf',
          fileSizeBytes: MAX_DOCUMENT_FILE_BYTES + 1,
        }),
      ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
    });
  });

  describe('deleteDocument', () => {
    it('rejects delete on submitted application', async () => {
      (appRepo.getApplicationByIdOrThrow as jest.Mock).mockResolvedValue({
        ...draftApp,
        status: 'SUBMITTED',
      });

      await expect(
        service.deleteDocument(TEST_USER_ID, TEST_APP_ID, TEST_DOC_ID),
      ).rejects.toMatchObject({ code: 'APPLICATION_NOT_EDITABLE' });
    });

    it('deletes document on draft', async () => {
      (appRepo.getApplicationByIdOrThrow as jest.Mock).mockResolvedValue(draftApp);
      (docRepo.getDocumentOrThrow as jest.Mock).mockResolvedValue({
        id: TEST_DOC_ID,
        type: 'commercial_license',
      });
      (docRepo.deleteDocument as jest.Mock).mockResolvedValue(undefined);

      await expect(
        service.deleteDocument(TEST_USER_ID, TEST_APP_ID, TEST_DOC_ID),
      ).resolves.toBeUndefined();
      expect(docRepo.deleteDocument).toHaveBeenCalled();
    });
  });
});
