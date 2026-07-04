import { ButcherApplicationAdminService } from '../../services/admin.service';
import * as appRepo from '../../repositories/application.repository';
import * as docRepo from '../../repositories/document.repository';
import * as transaction from '../../helpers/transaction';
import * as notifications from '../../notifications';
import { TEST_APP_ID, TEST_ADMIN_ID, TEST_USER_ID } from '../helpers/testUtils';

jest.mock('../../repositories/application.repository');
jest.mock('../../repositories/document.repository');
jest.mock('../../notifications');
jest.mock('../../helpers/transaction');
jest.mock('../../helpers/timeline', () => ({
  appendTimelineEvent: jest.fn().mockResolvedValue({
    id: 'event-1',
    action: 'APPROVE',
    comment: null,
    createdBy: 'admin',
    metadata: {},
    createdAt: new Date(),
    actor: { id: 'admin', username: 'admin' },
  }),
}));

const baseApp = {
  id: TEST_APP_ID,
  userId: TEST_USER_ID,
  applicationNumber: 3,
  status: 'SUBMITTED' as const,
  nameAr: 'ملحمة',
  nameEn: 'Shop',
  shopPhone: '+966501234567',
  commercialReg: 'CR-1',
  country: 'SA' as const,
  city: 'Riyadh',
  cityAr: 'الرياض',
  address: 'Street',
  addressAr: 'شارع',
  lat: 24.7,
  lng: 46.7,
  bioAr: null,
  bioEn: null,
  specialties: [],
  openTime: '08:00',
  closeTime: '22:00',
  rejectionReason: null,
  acceptedTermsAt: new Date(),
  submittedAt: new Date(),
  approvedAt: null,
  rejectedAt: null,
  withdrawnAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  documents: [],
  timelineEvents: [],
  sourcedButcher: null,
  user: { id: TEST_USER_ID, username: 'user', phone: null, avatar: null },
};

describe('ButcherApplicationAdminService', () => {
  const service = new ButcherApplicationAdminService();
  const runInTransaction = transaction.runInTransaction as jest.Mock;
  const tx = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    runInTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
    (transaction.assertUserHasNoButcher as jest.Mock).mockResolvedValue(undefined);
    (appRepo.countSubmittedApplications as jest.Mock).mockResolvedValue(2);
    (notifications.notifyApplicationApproved as jest.Mock).mockResolvedValue(undefined);
    (notifications.notifyApplicationRejected as jest.Mock).mockResolvedValue(undefined);
  });

  describe('approveApplication', () => {
    it('returns existing butcher on idempotent approve without notifying', async () => {
      (appRepo.getApplicationByIdOrThrow as jest.Mock).mockResolvedValue({
        ...baseApp,
        status: 'APPROVED',
        sourcedButcher: { id: 'butcher-1' },
      });

      const result = await service.approveApplication(TEST_ADMIN_ID, TEST_APP_ID, {});
      expect(result.butcher.id).toBe('butcher-1');
      expect(notifications.notifyApplicationApproved).not.toHaveBeenCalled();
    });

    it('approves and notifies applicant on new approval', async () => {
      (appRepo.getApplicationByIdOrThrow as jest.Mock).mockResolvedValue(baseApp);
      (appRepo.createButcher as jest.Mock).mockResolvedValue({
        id: 'butcher-new',
        sourceApplicationId: TEST_APP_ID,
      });
      (docRepo.approveUploadedDocuments as jest.Mock).mockResolvedValue(undefined);
      (appRepo.updateApplicationStatus as jest.Mock).mockResolvedValue({
        ...baseApp,
        status: 'APPROVED',
      });

      const result = await service.approveApplication(TEST_ADMIN_ID, TEST_APP_ID, {});
      expect(result.butcher.id).toBe('butcher-new');
      expect(notifications.notifyApplicationApproved).toHaveBeenCalled();
    });
  });

  describe('rejectApplication', () => {
    it('requires rejection reason', async () => {
      await expect(
        service.rejectApplication(TEST_ADMIN_ID, TEST_APP_ID, { rejectionReason: '  ' }),
      ).rejects.toMatchObject({ code: 'REJECTION_REASON_REQUIRED' });
    });

    it('rejects and notifies applicant', async () => {
      (appRepo.getApplicationByIdOrThrow as jest.Mock).mockResolvedValue(baseApp);
      (appRepo.updateApplicationStatus as jest.Mock).mockResolvedValue({
        ...baseApp,
        status: 'REJECTED',
        rejectionReason: 'Incomplete documents provided',
      });

      const result = await service.rejectApplication(TEST_ADMIN_ID, TEST_APP_ID, {
        rejectionReason: 'Incomplete documents provided',
      });

      expect(result.status).toBe('REJECTED');
      expect(notifications.notifyApplicationRejected).toHaveBeenCalled();
    });

    it('rejects approved application via state machine', async () => {
      (appRepo.getApplicationByIdOrThrow as jest.Mock).mockResolvedValue({
        ...baseApp,
        status: 'APPROVED',
      });

      await expect(
        service.rejectApplication(TEST_ADMIN_ID, TEST_APP_ID, {
          rejectionReason: 'Should not be allowed after approval',
        }),
      ).rejects.toMatchObject({ code: 'APPLICATION_ALREADY_APPROVED' });
    });
  });

  describe('addComment', () => {
    it('requires non-empty comment', async () => {
      await expect(
        service.addComment(TEST_ADMIN_ID, TEST_APP_ID, { comment: '  ' }),
      ).rejects.toMatchObject({ code: 'APPLICATION_INCOMPLETE' });
    });
  });
});
