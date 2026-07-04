import {
  notifyApplicationSubmitted,
  notifyAfterApplicationSubmit,
} from '../../notifications';
import { notifyUser, notifyUsers } from '@/lib/notifications';
import { findAllAdminUserIds } from '../../repositories/application.repository';
import { TEST_APP_ID, TEST_USER_ID } from '../helpers/testUtils';

jest.mock('@/lib/notifications');
jest.mock('../../repositories/application.repository', () => ({
  findAllAdminUserIds: jest.fn().mockResolvedValue(['admin-1', 'admin-2']),
}));

const app = {
  id: TEST_APP_ID,
  applicationNumber: 7,
  status: 'SUBMITTED' as const,
  nameAr: 'ملحمة',
  nameEn: 'Butcher',
  country: 'SA' as const,
  city: null,
  submittedAt: new Date(),
  approvedAt: null,
  rejectedAt: null,
  withdrawnAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  provisionedButcherId: null,
  shopPhone: null,
  commercialReg: null,
  cityAr: null,
  address: null,
  addressAr: null,
  lat: null,
  lng: null,
  bioAr: null,
  bioEn: null,
  specialties: [],
  openTime: '08:00',
  closeTime: '22:00',
  rejectionReason: null,
  acceptedTermsAt: null,
  documents: [],
  timeline: [],
};

describe('butcher-applications/notifications adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('notifyApplicationSubmitted fans out to admins with system event', async () => {
    await notifyApplicationSubmitted(app, TEST_USER_ID);

    expect(findAllAdminUserIds).toHaveBeenCalled();
    expect(notifyUsers).toHaveBeenCalledWith(
      ['admin-1', 'admin-2'],
      expect.objectContaining({
        type: 'system',
        data: expect.objectContaining({
          event: 'butcher_application_submitted',
          applicationId: TEST_APP_ID,
          applicationNumber: 7,
          userId: TEST_USER_ID,
        }),
      }),
    );
  });

  it('notifyAfterApplicationSubmit notifies admins and applicant', async () => {
    const allSettled = jest.spyOn(Promise, 'allSettled');
    await notifyAfterApplicationSubmit(app, TEST_USER_ID);
    expect(allSettled).toHaveBeenCalled();
    expect(notifyUsers).toHaveBeenCalled();
    expect(notifyUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: TEST_USER_ID,
        data: expect.objectContaining({ event: 'butcher_application_received' }),
      }),
    );
    allSettled.mockRestore();
  });
});
