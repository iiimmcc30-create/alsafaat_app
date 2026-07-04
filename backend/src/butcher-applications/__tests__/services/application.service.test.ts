import { ButcherApplicationUserService } from '../../services/application.service';
import * as appRepo from '../../repositories/application.repository';
import * as transaction from '../../helpers/transaction';
import * as notifications from '../../notifications';
import { TEST_APP_ID, TEST_USER_ID } from '../helpers/testUtils';

jest.mock('../../repositories/application.repository');
jest.mock('../../notifications');
jest.mock('../../helpers/transaction');
jest.mock('../../helpers/timeline', () => ({
  appendTimelineEvent: jest.fn().mockResolvedValue({
    id: 'event-1',
    action: 'CREATE',
    comment: null,
    createdBy: 'user',
    metadata: {},
    createdAt: new Date(),
    actor: { id: 'user', username: 'user' },
  }),
}));

const mockApplication = {
  id: TEST_APP_ID,
  userId: TEST_USER_ID,
  applicationNumber: 1,
  status: 'DRAFT' as const,
  nameAr: 'ملحمة',
  nameEn: 'Shop',
  shopPhone: '+966501234567',
  commercialReg: 'CR-12345',
  country: 'SA' as const,
  city: 'Riyadh',
  cityAr: 'الرياض',
  address: 'Street 1',
  addressAr: 'شارع ١',
  lat: 24.7,
  lng: 46.7,
  bioAr: null,
  bioEn: null,
  specialties: [],
  openTime: '08:00',
  closeTime: '22:00',
  rejectionReason: null,
  acceptedTermsAt: null,
  submittedAt: null,
  approvedAt: null,
  rejectedAt: null,
  withdrawnAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  documents: [
    { type: 'commercial_license', fileKey: 'k', status: 'UPLOADED' },
    { type: 'national_id', fileKey: 'k', status: 'UPLOADED' },
    { type: 'municipal_permit', fileKey: 'k', status: 'UPLOADED' },
    { type: 'shop_photo', fileKey: 'k', status: 'UPLOADED' },
  ],
  timelineEvents: [],
  sourcedButcher: null,
  user: { id: TEST_USER_ID, username: 'user', phone: null, avatar: null },
};

describe('ButcherApplicationUserService', () => {
  const service = new ButcherApplicationUserService();
  const runInTransaction = transaction.runInTransaction as jest.Mock;
  const tx = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    runInTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
    (transaction.assertUserHasNoButcher as jest.Mock).mockResolvedValue(undefined);
    (transaction.assertApplicationOwner as jest.Mock).mockImplementation(() => undefined);
    (transaction.assertNotModified as jest.Mock).mockImplementation(() => undefined);
    (notifications.notifyAfterApplicationSubmit as jest.Mock).mockResolvedValue(undefined);
    (notifications.notifyApplicationWithdrawn as jest.Mock).mockResolvedValue(undefined);
  });

  describe('createDraft', () => {
    it('rejects when active draft exists', async () => {
      (appRepo.findActiveApplicationByUserAndStatus as jest.Mock)
        .mockResolvedValueOnce({ id: 'draft' });

      await expect(service.createDraft(TEST_USER_ID, {})).rejects.toMatchObject({
        code: 'ACTIVE_DRAFT_EXISTS',
      });
    });

    it('creates draft when no conflicts', async () => {
      (appRepo.findActiveApplicationByUserAndStatus as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (appRepo.createApplication as jest.Mock).mockResolvedValue(mockApplication);

      const result = await service.createDraft(TEST_USER_ID, { nameAr: 'ملحمة' });
      expect(result.id).toBe(TEST_APP_ID);
      expect(appRepo.createApplication).toHaveBeenCalled();
    });
  });

  describe('updateDraft', () => {
    it('rejects non-draft via assertEditableStatus path', async () => {
      (appRepo.getApplicationByIdOrThrow as jest.Mock).mockResolvedValue({
        ...mockApplication,
        status: 'SUBMITTED',
      });

      await expect(
        service.updateDraft(TEST_USER_ID, TEST_APP_ID, { nameAr: 'x' }),
      ).rejects.toMatchObject({ code: 'APPLICATION_NOT_EDITABLE' });
    });
  });

  describe('submitApplication', () => {
    it('rejects incomplete legal confirmations', async () => {
      await expect(
        service.submitApplication(TEST_USER_ID, TEST_APP_ID, {
          acceptedTerms: false as unknown as true,
          confirmAccuracy: true,
        }),
      ).rejects.toMatchObject({ code: 'APPLICATION_INCOMPLETE' });
    });

    it('submits and triggers notifications post-commit', async () => {
      (appRepo.getApplicationByIdOrThrow as jest.Mock).mockResolvedValue(mockApplication);
      (appRepo.updateApplicationStatus as jest.Mock).mockResolvedValue({
        ...mockApplication,
        status: 'SUBMITTED',
      });

      const result = await service.submitApplication(TEST_USER_ID, TEST_APP_ID, {
        acceptedTerms: true,
        confirmAccuracy: true,
      });

      expect(result.status).toBe('SUBMITTED');
      expect(notifications.notifyAfterApplicationSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ id: TEST_APP_ID }),
        TEST_USER_ID,
      );
    });
  });

  describe('withdrawApplication', () => {
    it('withdraws submitted application and notifies', async () => {
      (appRepo.getApplicationByIdOrThrow as jest.Mock).mockResolvedValue({
        ...mockApplication,
        status: 'SUBMITTED',
      });
      (appRepo.updateApplicationStatus as jest.Mock).mockResolvedValue({
        ...mockApplication,
        status: 'WITHDRAWN',
      });

      const result = await service.withdrawApplication(TEST_USER_ID, TEST_APP_ID, {});
      expect(result.status).toBe('WITHDRAWN');
      expect(notifications.notifyApplicationWithdrawn).toHaveBeenCalled();
    });

    it('rejects withdraw on approved application', async () => {
      (appRepo.getApplicationByIdOrThrow as jest.Mock).mockResolvedValue({
        ...mockApplication,
        status: 'APPROVED',
      });

      await expect(
        service.withdrawApplication(TEST_USER_ID, TEST_APP_ID, {}),
      ).rejects.toMatchObject({ code: 'APPLICATION_ALREADY_APPROVED' });
    });
  });
});
