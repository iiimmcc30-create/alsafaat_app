import { stringifyNotificationData, notifyUser, notifyUsers } from '@/lib/notifications';
import { addNotification } from '@/lib/queue';

jest.mock('@/lib/queue', () => ({
  addNotification: jest.fn().mockResolvedValue({ id: 'job-1' }),
}));

describe('lib/notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('stringifyNotificationData', () => {
    it('stringifies values and omits nullish', () => {
      expect(
        stringifyNotificationData({
          event: 'butcher_application_received',
          applicationNumber: 12,
          skipped: null,
          missing: undefined,
        }),
      ).toEqual({
        event: 'butcher_application_received',
        applicationNumber: '12',
      });
    });
  });

  describe('notifyUser', () => {
    it('delegates to addNotification with system type', async () => {
      await notifyUser({
        userId: 'user-1',
        type: 'system',
        titleAr: 'عنوان',
        bodyAr: 'نص',
        data: { event: 'butcher_application_received', applicationId: 'app-1' },
      });

      expect(addNotification).toHaveBeenCalledWith({
        userId: 'user-1',
        type: 'system',
        titleAr: 'عنوان',
        bodyAr: 'نص',
        data: {
          event: 'butcher_application_received',
          applicationId: 'app-1',
        },
      });
    });

    it('swallows queue errors', async () => {
      (addNotification as jest.Mock).mockRejectedValueOnce(new Error('redis down'));
      await expect(
        notifyUser({
          userId: 'user-1',
          type: 'system',
          titleAr: 't',
          bodyAr: 'b',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('notifyUsers', () => {
    it('uses Promise.allSettled for fan-out', async () => {
      const spy = jest.spyOn(Promise, 'allSettled');
      await notifyUsers(['a', 'b'], {
        type: 'system',
        titleAr: 't',
        bodyAr: 'b',
        data: { event: 'butcher_application_submitted' },
      });
      expect(spy).toHaveBeenCalled();
      expect(addNotification).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    });
  });
});
