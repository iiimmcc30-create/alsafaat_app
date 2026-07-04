import createListHandler from '../../pages/api/butcher-applications/index';
import detailHandler from '../../pages/api/butcher-applications/[id]';
import submitHandler from '../../pages/api/butcher-applications/[id]/submit';
import withdrawHandler from '../../pages/api/butcher-applications/[id]/withdraw';
import uploadDocHandler from '../../pages/api/butcher-applications/[id]/documents/index';
import docDetailHandler from '../../pages/api/butcher-applications/[id]/documents/[documentId]';
import adminListHandler from '../../pages/api/admin/butcher-applications/index';
import adminDetailHandler from '../../pages/api/admin/butcher-applications/[id]';
import approveHandler from '../../pages/api/admin/butcher-applications/[id]/approve';
import rejectHandler from '../../pages/api/admin/butcher-applications/[id]/reject';
import commentHandler from '../../pages/api/admin/butcher-applications/[id]/comment';
import { butcherApplicationUserService } from '@/butcher-applications/services/application.service';
import { butcherApplicationDocumentService } from '@/butcher-applications/services/document.service';
import { butcherApplicationAdminService } from '@/butcher-applications/services/admin.service';
import { countDraftApplications } from '@/butcher-applications/repositories/application.repository';
import {
  createMockReq,
  createMockRes,
  getResponseBody,
  TEST_ADMIN_ID,
  TEST_APP_ID,
  TEST_DOC_ID,
  TEST_USER_ID,
  userPayload,
} from '@/butcher-applications/__tests__/helpers/testUtils';

jest.mock('@/middleware/rateLimiter', () => ({
  apiRateLimit: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/middleware/auth', () => {
  const actual = jest.requireActual('@/middleware/auth');
  return {
    ...actual,
    withAuth: (req: any, res: any, handler: any) =>
      handler({ ...req, user: req._testUser ?? userPayload() }, res),
    withAdmin: (req: any, res: any, handler: any) =>
      handler({ ...req, user: req._testUser ?? userPayload(TEST_ADMIN_ID, 'ADMIN') }, res),
  };
});

jest.mock('@/butcher-applications/services/application.service');
jest.mock('@/butcher-applications/services/document.service');
jest.mock('@/butcher-applications/services/admin.service');
jest.mock('@/butcher-applications/repositories/application.repository', () => ({
  countDraftApplications: jest.fn().mockResolvedValue(1),
}));

const appDto = {
  id: TEST_APP_ID,
  applicationNumber: 1,
  status: 'DRAFT',
  nameAr: 'ملحمة',
  nameEn: 'Shop',
  country: 'SA',
  city: 'Riyadh',
  submittedAt: null,
  approvedAt: null,
  rejectedAt: null,
  withdrawnAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  provisionedButcherId: null,
};

describe('butcher-applications API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/butcher-applications', () => {
    it('returns 201 with application on valid create', async () => {
      (butcherApplicationUserService.createDraft as jest.Mock).mockResolvedValue(appDto);
      const req = createMockReq({ method: 'POST', body: { nameAr: 'ملحمة الصفاة', country: 'SA' } });
      const res = createMockRes();

      await createListHandler(req, res);

      expect(res._status).toBe(201);
      const body = getResponseBody(res);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(TEST_APP_ID);
    });

    it('returns 400 validation_error on invalid body', async () => {
      const req = createMockReq({ method: 'POST', body: { shopPhone: 'bad' } });
      const res = createMockRes();
      await createListHandler(req, res);
      expect(res._status).toBe(400);
      expect(getResponseBody(res).error).toBe('validation_error');
    });
  });

  describe('GET /api/butcher-applications', () => {
    it('returns list contract', async () => {
      (butcherApplicationUserService.listApplications as jest.Mock).mockResolvedValue({
        items: [appDto],
        nextCursor: null,
        hasMore: false,
      });
      const req = createMockReq({ method: 'GET', query: {} });
      const res = createMockRes();

      await createListHandler(req, res);

      const body = getResponseBody(res);
      expect(body.data).toMatchObject({
        applications: [appDto],
        nextCursor: null,
        hasMore: false,
      });
    });

    it('returns 400 on invalid pagination', async () => {
      const req = createMockReq({ method: 'GET', query: { limit: '99' } });
      const res = createMockRes();
      await createListHandler(req, res);
      expect(res._status).toBe(400);
    });
  });

  describe('GET/PATCH /api/butcher-applications/:id', () => {
    it('returns 400 invalid_id for malformed uuid', async () => {
      const req = createMockReq({ method: 'GET', query: { id: 'bad' } });
      const res = createMockRes();
      await detailHandler(req, res);
      expect(res._status).toBe(400);
      expect(getResponseBody(res).error).toBe('invalid_id');
    });

    it('returns application detail for owner', async () => {
      (butcherApplicationUserService.getApplication as jest.Mock).mockResolvedValue(appDto);
      const req = createMockReq({ method: 'GET', query: { id: TEST_APP_ID } });
      const res = createMockRes();
      await detailHandler(req, res);
      expect(getResponseBody(res).data.id).toBe(TEST_APP_ID);
    });

    it('maps ownership violation to 403', async () => {
      const { ButcherApplicationError } = jest.requireActual('@/butcher-applications/errors');
      (butcherApplicationUserService.getApplication as jest.Mock).mockRejectedValue(
        new ButcherApplicationError('APPLICATION_ACCESS_DENIED'),
      );
      const req = createMockReq({ method: 'GET', query: { id: TEST_APP_ID } });
      const res = createMockRes();
      await detailHandler(req, res);
      expect(res._status).toBe(403);
    });

    it('returns 409 on optimistic lock conflict', async () => {
      const { ButcherApplicationError } = jest.requireActual('@/butcher-applications/errors');
      (butcherApplicationUserService.updateDraft as jest.Mock).mockRejectedValue(
        new ButcherApplicationError('APPLICATION_CONFLICT'),
      );
      const req = createMockReq({
        method: 'PATCH',
        query: { id: TEST_APP_ID },
        body: { nameAr: 'محدث' },
        headers: { 'if-unmodified-since': new Date().toISOString() },
      });
      const res = createMockRes();
      await detailHandler(req, res);
      expect(res._status).toBe(409);
    });
  });

  describe('POST submit / withdraw', () => {
    it('submit rejects incomplete payload', async () => {
      const req = createMockReq({
        method: 'POST',
        query: { id: TEST_APP_ID },
        body: { acceptedTerms: true },
      });
      const res = createMockRes();
      await submitHandler(req, res);
      expect(res._status).toBe(400);
    });

    it('submit returns application on success', async () => {
      (butcherApplicationUserService.submitApplication as jest.Mock).mockResolvedValue({
        ...appDto,
        status: 'SUBMITTED',
      });
      const req = createMockReq({
        method: 'POST',
        query: { id: TEST_APP_ID },
        body: { acceptedTerms: true, confirmAccuracy: true },
      });
      const res = createMockRes();
      await submitHandler(req, res);
      expect(getResponseBody(res).data.status).toBe('SUBMITTED');
    });

    it('withdraw returns application', async () => {
      (butcherApplicationUserService.withdrawApplication as jest.Mock).mockResolvedValue({
        ...appDto,
        status: 'WITHDRAWN',
      });
      const req = createMockReq({ method: 'POST', query: { id: TEST_APP_ID }, body: {} });
      const res = createMockRes();
      await withdrawHandler(req, res);
      expect(getResponseBody(res).data.status).toBe('WITHDRAWN');
    });
  });

  describe('documents', () => {
  const fileKey = `butcher-applications/${TEST_USER_ID}/license.pdf`;

    it('POST document returns 201', async () => {
      (butcherApplicationDocumentService.uploadDocument as jest.Mock).mockResolvedValue({
        id: TEST_DOC_ID,
        type: 'commercial_license',
      });
      const req = createMockReq({
        method: 'POST',
        query: { id: TEST_APP_ID },
        body: {
          type: 'commercial_license',
          fileKey,
          mimeType: 'application/pdf',
          fileSizeBytes: 1000,
        },
      });
      const res = createMockRes();
      await uploadDocHandler(req, res);
      expect(res._status).toBe(201);
    });

    it('PATCH document validates mime', async () => {
      const req = createMockReq({
        method: 'PATCH',
        query: { id: TEST_APP_ID, documentId: TEST_DOC_ID },
        body: {
          fileKey,
          mimeType: 'text/plain',
          fileSizeBytes: 1000,
        },
      });
      const res = createMockRes();
      await docDetailHandler(req, res);
      expect(res._status).toBe(400);
    });

    it('DELETE document returns 204', async () => {
      (butcherApplicationDocumentService.deleteDocument as jest.Mock).mockResolvedValue(undefined);
      const req = createMockReq({
        method: 'DELETE',
        query: { id: TEST_APP_ID, documentId: TEST_DOC_ID },
      });
      const res = createMockRes();
      await docDetailHandler(req, res);
      expect(res._status).toBe(204);
    });
  });

  describe('admin routes', () => {
    it('GET admin list returns counts contract', async () => {
      (butcherApplicationAdminService.listApplications as jest.Mock).mockResolvedValue({
        items: [appDto],
        nextCursor: null,
        hasMore: false,
        counts: { submitted: 2 },
      });
      const req = createMockReq({ method: 'GET', query: {}, _testUser: userPayload(TEST_ADMIN_ID, 'ADMIN') } as any);
      const res = createMockRes();
      await adminListHandler(req, res);
      expect(getResponseBody(res).data).toMatchObject({
        applications: [appDto],
        counts: { submitted: 2, draft: 1 },
      });
      expect(countDraftApplications).toHaveBeenCalled();
    });

    it('GET admin detail returns application', async () => {
      (butcherApplicationAdminService.getApplication as jest.Mock).mockResolvedValue(appDto);
      const req = createMockReq({
        method: 'GET',
        query: { id: TEST_APP_ID },
        _testUser: userPayload(TEST_ADMIN_ID, 'ADMIN'),
      } as any);
      const res = createMockRes();
      await adminDetailHandler(req, res);
      expect(getResponseBody(res).data.id).toBe(TEST_APP_ID);
    });

    it('POST approve returns application + butcher contract', async () => {
      (butcherApplicationAdminService.approveApplication as jest.Mock).mockResolvedValue({
        application: { ...appDto, status: 'APPROVED' },
        butcher: { id: 'butcher-1', sourceApplicationId: TEST_APP_ID },
      });
      const req = createMockReq({
        method: 'POST',
        query: { id: TEST_APP_ID },
        body: {},
        _testUser: userPayload(TEST_ADMIN_ID, 'ADMIN'),
      } as any);
      const res = createMockRes();
      await approveHandler(req, res);
      expect(getResponseBody(res).data).toMatchObject({
        application: expect.objectContaining({ status: 'APPROVED' }),
        butcher: { id: 'butcher-1', sourceApplicationId: TEST_APP_ID },
      });
    });

    it('POST reject validates rejection reason', async () => {
      const req = createMockReq({
        method: 'POST',
        query: { id: TEST_APP_ID },
        body: { rejectionReason: 'short' },
        _testUser: userPayload(TEST_ADMIN_ID, 'ADMIN'),
      } as any);
      const res = createMockRes();
      await rejectHandler(req, res);
      expect(res._status).toBe(400);
    });

    it('POST comment returns timelineEvent with 201', async () => {
      (butcherApplicationAdminService.addComment as jest.Mock).mockResolvedValue({
        id: 'event-1',
        action: 'COMMENT',
      });
      const req = createMockReq({
        method: 'POST',
        query: { id: TEST_APP_ID },
        body: { comment: 'Internal review note for compliance team' },
        _testUser: userPayload(TEST_ADMIN_ID, 'ADMIN'),
      } as any);
      const res = createMockRes();
      await commentHandler(req, res);
      expect(res._status).toBe(201);
      expect(getResponseBody(res).data).toMatchObject({
        timelineEvent: { id: 'event-1', action: 'COMMENT' },
      });
    });
  });
});
