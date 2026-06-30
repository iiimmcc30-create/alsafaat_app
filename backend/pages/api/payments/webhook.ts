// backend/pages/api/payments/webhook.ts
// ✅ استبدال Moyasar Webhook → Network International (NI) Webhook
// NI ترسل إشعارات الدفع عبر HTTP POST بتوقيع HMAC-SHA256

import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { addNotification } from '@/lib/queue';
import { logger } from '@/lib/logger';

// ── التحقق من توقيع NI ───────────────────────────────────────────────────────
// NI ترسل رأس: x-signature مع HMAC-SHA256 على الـ body الخام
function verifyNISignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature.replace(/^sha256=/, ''), 'hex')
    );
  } catch {
    return false;
  }
}

export const config = {
  api: {
    bodyParser: false, // نحتاج الـ body الخام للتوقيع
  },
};

async function getRawBody(req: NextApiRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end',  () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody     = await getRawBody(req);
  // NI ترسل التوقيع في: x-signature أو x-ni-signature
  const signature   = (req.headers['x-signature'] ?? req.headers['x-ni-signature']) as string;
  const webhookSecret = process.env.NI_WEBHOOK_SECRET;

  // ── التحقق من الأصالة ────────────────────────────────────────────────────
  if (webhookSecret && signature) {
    if (!verifyNISignature(rawBody, signature, webhookSecret)) {
      logger.warn({ signature: signature?.slice(0, 8) }, 'Invalid NI webhook signature');
      return res.status(401).json({ error: 'invalid_signature' });
    }
  } else if (process.env.NODE_ENV === 'production') {
    logger.error('NI Webhook received without signature in production');
    return res.status(401).json({ error: 'missing_signature' });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'invalid_json' });
  }

  // ── الرد الفوري — NI تنتظر 200 خلال 5 ثوان ──────────────────────────────
  res.status(200).json({ received: true });

  try {
    await processNIWebhook(event);
  } catch (err) {
    logger.error({ err, event }, 'NI Webhook processing error');
  }
}

// ── معالجة إشعارات NI ───────────────────────────────────────────────────────
// NI webhook events: ORDER.PAID | ORDER.FAILED | ORDER.CAPTURED | ORDER.AUTHORISED
// الحقول الرئيسية: order.reference, order.amount.value, order.paymentMethod.name
async function processNIWebhook(event: any) {
  // NI ترسل البيانات داخل: event.order أو مباشرة في الجذر
  const order = event.order ?? event;
  const eventType: string = event.eventName ?? event.type ?? '';

  // نستخدم merchantOrderReference الذي أرسلناه = orderId في قاعدة البيانات
  const merchantOrderRef: string =
    order?.merchantAttributes?.merchantOrderReference ??
    order?.merchantOrderReference ??
    order?.reference ?? '';

  // البيانات المخصصة التي أرسلناها
  const customData = order?.customData ?? order?.metadata ?? {};
  const internalPaymentId: string = customData?.paymentId ?? '';

  // نبحث عبر orderId (merchantOrderReference) أو عبر paymentId المخصص
  const payment = await prisma.payment.findFirst({
    where: internalPaymentId
      ? { id: internalPaymentId }
      : { orderId: merchantOrderRef },
  });

  if (!payment) {
    logger.warn({ merchantOrderRef, internalPaymentId }, 'NI Webhook: payment not found');
    return;
  }

  // Idempotency
  if (payment.status === 'paid' || payment.status === 'failed') {
    logger.debug({ paymentId: payment.id, status: payment.status }, 'NI Webhook already processed');
    return;
  }

  const storedMeta    = (payment.metadata ?? {}) as Record<string, unknown>;
  const type          = payment.referenceType ?? (storedMeta.type as string)          ?? customData?.type;
  const referenceId   = payment.referenceId   ?? (storedMeta.referenceId as string)   ?? customData?.referenceId;
  const userId        = (storedMeta.userId as string)        ?? customData?.userId ?? payment.userId;
  const targetPlanId  = (storedMeta.targetPlanId as string)  ?? customData?.targetPlanId;
  const billingCycle  = (storedMeta.billingCycle as string)  ?? customData?.billingCycle ?? 'monthly';

  // NI حالات النجاح: ORDER.PAID | ORDER.CAPTURED | ORDER.AUTHORISED
  const isSuccess = ['ORDER.PAID', 'ORDER.CAPTURED', 'ORDER.AUTHORISED']
    .includes(eventType.toUpperCase())
    || ['CAPTURED', 'AUTHORISED', 'PURCHASED'].includes(order?.state?.toUpperCase() ?? '');

  const isFailure = ['ORDER.FAILED', 'ORDER.REVERSED', 'ORDER.CANCELLED']
    .includes(eventType.toUpperCase())
    || ['FAILED', 'REVERSED', 'CANCELLED'].includes(order?.state?.toUpperCase() ?? '');

  const niTransactionId = order?.reference ?? order?.transactionId ?? merchantOrderRef;

  if (isSuccess) {
    const processed = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: payment.id, status: 'pending' },
        data: {
          status:        'paid',
          transactionId: niTransactionId,
          paidAt:        new Date(),
        },
      });
      if (updated.count === 0) {
        return false;
      }

      if (type === 'subscription' && referenceId) {
        if ((storedMeta.subscriptionFulfilled as boolean) === true) {
          return true;
        }

        const sub = await tx.subscription.findUnique({
          where:  { id: referenceId },
          select: { id: true, renewDate: true },
        });
        if (!sub) {
          logger.warn({ paymentId: payment.id, referenceId }, 'Subscription not found for payment fulfillment');
          throw new Error('Subscription not found for payment fulfillment');
        }

        const now = new Date();
        const renewDays = billingCycle === 'yearly' ? 365 : 30;
        const msPerDay  = 24 * 60 * 60 * 1000;
        const baseDate  = sub.renewDate > now ? sub.renewDate : now;
        const newRenewDate = new Date(baseDate.getTime() + renewDays * msPerDay);

        const updateData: Record<string, unknown> = {
          renewDate: newRenewDate,
          billingCycle,
        };
        if (targetPlanId && ['starter', 'pro', 'vip'].includes(targetPlanId)) {
          updateData.planId = targetPlanId;
        }
        await tx.subscription.update({
          where: { id: referenceId },
          data:  updateData as any,
        });

        await tx.payment.update({
          where: { id: payment.id },
          data:  {
            metadata: {
              ...storedMeta,
              subscriptionFulfilled: true,
            },
          },
        });

        if (targetPlanId === 'vip') {
          await tx.user.update({
            where: { id: userId },
            data:  { verified: true },
          }).catch(() => {});
        }
      }

      if (type === 'fee' || type === 'listing_fee') {
        await tx.listingFee.update({
          where: { id: referenceId },
          data:  { status: 'paid', paidAt: new Date(), transactionId: niTransactionId },
        });
        const fee = await tx.listingFee.findUnique({ where: { id: referenceId } });
        if (fee) {
          await tx.listing.update({ where: { id: fee.listingId }, data: { status: 'active' } });
        }
      }

      return true;
    });

    if (processed) {
      await addNotification({
        userId,
        type:    'system',
        titleAr: '✅ تم الدفع بنجاح',
        bodyAr:  `تم سداد ${payment.amount} ${payment.currency}. رقم العملية: ${niTransactionId}`,
        data:    { paymentId: payment.id, transactionId: niTransactionId },
      });

      logger.info({ paymentId: payment.id, type, referenceId, amount: payment.amount }, 'NI Payment confirmed');
    }

  } else if (isFailure) {
    await prisma.payment.update({
      where: { id: payment.id },
      data:  { status: 'failed' },
    });

    await addNotification({
      userId,
      type:    'system',
      titleAr: '❌ فشل الدفع',
      bodyAr:  'فشلت عملية الدفع. يرجى المحاولة مجدداً.',
      data:    { paymentId: payment.id },
    });

    logger.warn({ paymentId: payment.id, eventType }, 'NI Payment failed');
  }
}
