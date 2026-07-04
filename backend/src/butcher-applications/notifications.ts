// src/butcher-applications/notifications.ts
// Butcher application notification adapter — calls shared notifyUser/notifyUsers only.
import { notifyUser, notifyUsers } from '@/lib/notifications';
import { findAllAdminUserIds } from './repositories/application.repository';
import type { ApplicationDetailDto } from './types';

const SYSTEM_TYPE = 'system';

function shopLabel(app: ApplicationDetailDto): string {
  return app.nameAr || app.nameEn || 'ملحمة';
}

function baseApplicationData(app: ApplicationDetailDto): Record<string, string | number> {
  return {
    applicationId:     app.id,
    applicationNumber: app.applicationNumber,
  };
}

/** Notify all active admins that a new application was submitted. */
export async function notifyApplicationSubmitted(
  app: ApplicationDetailDto,
  applicantUserId: string,
): Promise<void> {
  const adminIds = await findAllAdminUserIds();
  await notifyUsers(adminIds, {
    type:    SYSTEM_TYPE,
    titleAr: 'طلب تقديم ملحمة جديد',
    bodyAr:  `طلب رقم ${app.applicationNumber} — ${shopLabel(app)}`,
    data: {
      event: 'butcher_application_submitted',
      ...baseApplicationData(app),
      userId:  applicantUserId,
      nameAr:  app.nameAr ?? '',
      country: app.country ?? '',
    },
  });
}

/** Confirm to the applicant that their application was received. */
export async function notifyApplicationReceived(
  app: ApplicationDetailDto,
  applicantUserId: string,
): Promise<void> {
  await notifyUser({
    userId:  applicantUserId,
    type:    SYSTEM_TYPE,
    titleAr: 'تم استلام طلبك',
    bodyAr:  `طلب رقم ${app.applicationNumber} قيد المراجعة`,
    data: {
      event: 'butcher_application_received',
      ...baseApplicationData(app),
    },
  });
}

/** Notify applicant (and optionally admins) after withdrawal. */
export async function notifyApplicationWithdrawn(
  app: ApplicationDetailDto,
  applicantUserId: string,
  options: { notifyAdmins?: boolean } = {},
): Promise<void> {
  const { notifyAdmins = true } = options;

  const tasks: Promise<void>[] = [
    notifyUser({
      userId:  applicantUserId,
      type:    SYSTEM_TYPE,
      titleAr: 'تم سحب طلبك',
      bodyAr:  `تم سحب طلب رقم ${app.applicationNumber}`,
      data: {
        event: 'butcher_application_withdrawn',
        ...baseApplicationData(app),
      },
    }),
  ];

  if (notifyAdmins) {
    tasks.push(
      findAllAdminUserIds().then((adminIds) =>
        notifyUsers(adminIds, {
          type:    SYSTEM_TYPE,
          titleAr: 'سحب طلب تقديم ملحمة',
          bodyAr:  `تم سحب طلب رقم ${app.applicationNumber} — ${shopLabel(app)}`,
          data: {
            event: 'butcher_application_withdrawn',
            ...baseApplicationData(app),
            userId: applicantUserId,
          },
        }),
      ),
    );
  }

  await Promise.allSettled(tasks);
}

/** Notify applicant after admin approval. */
export async function notifyApplicationApproved(
  app: ApplicationDetailDto,
  applicantUserId: string,
  butcherId: string,
): Promise<void> {
  await notifyUser({
    userId:  applicantUserId,
    type:    SYSTEM_TYPE,
    titleAr: 'تم قبول طلبك',
    bodyAr:  `تم قبول طلب رقم ${app.applicationNumber}. يمكنك الآن إدارة ملحمتك.`,
    data: {
      event: 'butcher_application_approved',
      ...baseApplicationData(app),
      butcherId,
    },
  });
}

/** Notify applicant after admin rejection. */
export async function notifyApplicationRejected(
  app: ApplicationDetailDto,
  applicantUserId: string,
): Promise<void> {
  await notifyUser({
    userId:  applicantUserId,
    type:    SYSTEM_TYPE,
    titleAr: 'تم رفض طلبك',
    bodyAr:  `تم رفض طلب رقم ${app.applicationNumber}`,
    data: {
      event:            'butcher_application_rejected',
      ...baseApplicationData(app),
      rejectionReason:  app.rejectionReason ?? '',
    },
  });
}

/** Fan-out after successful submit (admins + applicant). */
export async function notifyAfterApplicationSubmit(
  app: ApplicationDetailDto,
  applicantUserId: string,
): Promise<void> {
  await Promise.allSettled([
    notifyApplicationSubmitted(app, applicantUserId),
    notifyApplicationReceived(app, applicantUserId),
  ]);
}
