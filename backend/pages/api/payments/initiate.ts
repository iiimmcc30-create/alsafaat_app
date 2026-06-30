// backend/pages/api/payments/initiate.ts
// ✅ استبدال Moyasar → Network International (NI)
// Network International Payment Gateway Integration
// Docs: https://developer.network.ae/docs/payment-link-api

import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import axios from 'axios';
import prisma from '@/lib/prisma';
import { PaymentReferenceType } from '@prisma/client';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { logger } from '@/lib/logger';
import { getPlanPrice, UPGRADABLE_PLANS, PlanId, BillingCycle } from '@/lib/plans';

// ── NI يدعم هذه الطرق في السعودية ─────────────────────────────────────────
const schema = z.object({
  amount:        z.number().positive().max(100000),
  currency:      z.string().default('SAR'),
  method:        z.enum(['mada', 'visa', 'mastercard', 'apple_pay', 'stc_pay']),
  type:          z.enum(['subscription', 'fee', 'listing_fee']),
  referenceId:   z.string().uuid('referenceId must be a valid UUID'),
  description:   z.string().max(200).optional(),
  descriptionAr: z.string().max(200).optional(),
  planId:        z.enum(['starter', 'pro', 'vip']).optional(),
  billingCycle:  z.enum(['monthly', 'yearly']).optional(),
}).strict();

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };

interface RefError {
  status:    400 | 403 | 404;
  code:      string;
  messageAr: string;
}

async function checkReference(
  userId:      string,
  type:        string,
  referenceId: string,
  amount:      number,
): Promise<RefError | null> {
  if (type === 'subscription') {
    const sub = await prisma.subscription.findFirst({
      where:  { id: referenceId, userId },
      select: { id: true, planId: true, renewDate: true },
    });
    if (!sub) return { status: 404, code: 'ref_not_found', messageAr: 'الاشتراك غير موجود' };
    if (sub.renewDate > new Date()) {
      return { status: 400, code: 'subscription_active', messageAr: 'اشتراكك لا يزال سارياً حتى تاريخ التجديد' };
    }
    return null;
  }

  if (type === 'fee' || type === 'listing_fee') {
    const fee = await prisma.listingFee.findFirst({
      where:  { id: referenceId, userId, status: { in: ['pending', 'overdue'] } },
      select: { id: true, commission: true },
    });
    if (!fee) {
      return { status: 404, code: 'fee_not_found', messageAr: 'الرسوم غير موجودة أو مسددة بالفعل' };
    }
    if (Math.abs(fee.commission - amount) > 1) {
      return { status: 400, code: 'amount_mismatch', messageAr: `المبلغ غير مطابق. المبلغ الصحيح: ${fee.commission} ريال` };
    }
    return null;
  }

  return { status: 400, code: 'invalid_type', messageAr: 'نوع الدفع غير صالح' };
}

// ── بناء رابط طلب NI ────────────────────────────────────────────────────────
function buildNIOrderReference(userId: string): string {
  // NI: alphanumeric + hyphens, max 40 chars
  const ts  = Date.now().toString(36).toUpperCase();
  const uid = userId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `SFAT-${uid}-${ts}`;
}

// ── NI: خريطة طريقة الدفع ───────────────────────────────────────────────────
function mapMethodToNI(method: string): string {
  // NI Payment Links يقبل هذه القيم
  switch (method) {
    case 'mada':       return 'MADA';
    case 'visa':
    case 'mastercard': return 'CARD';  // NI يتعامل مع كليهما كـ CARD
    case 'apple_pay':  return 'APPLE_PAY';
    case 'stc_pay':    return 'STC_PAY';
    default:           return 'CARD';
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!(await apiRateLimit(req, res, 'payment'))) return;
  return withAuth(req, res, initiatePayment);
}

async function initiatePayment(req: AuthedRequest, res: NextApiResponse) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, 'validation_error', 'بيانات غير صحيحة', parsed.error.flatten());
  }

  const { amount, currency, method, type, referenceId, description, descriptionAr, planId, billingCycle } = parsed.data;

  if (type === 'subscription') {
    if (!planId || !billingCycle) {
      return apiError(res, 400, 'validation_error', 'يجب تحديد الباقة ودورة الفوترة');
    }
    if (!UPGRADABLE_PLANS.includes(planId)) {
      return apiError(res, 400, 'invalid_plan', 'باقة غير صالحة للترقية');
    }
    const expectedAmount = getPlanPrice(planId as PlanId, billingCycle as BillingCycle);
    if (Math.abs(expectedAmount - amount) > 1) {
      return apiError(res, 400, 'amount_mismatch', `المبلغ غير مطابق. المبلغ الصحيح: ${expectedAmount} ريال`);
    }
  }

  const refError = await checkReference(req.user.userId, type, referenceId, amount);
  if (refError) {
    return apiError(res, refError.status, refError.code, refError.messageAr);
  }

  const orderReference = buildNIOrderReference(req.user.userId);

  const user = await prisma.user.findUnique({
    where:  { id: req.user.userId },
    select: { email: true, displayName: true, arabicName: true },
  });

  const paymentMetadata: Record<string, unknown> = {
    type,
    referenceId,
    userId: req.user.userId,
    ...(type === 'subscription' && planId && billingCycle
      ? { targetPlanId: planId, billingCycle }
      : {}),
  };

  // ── Idempotency: check pending + create atomically ───────────────────────
  const referenceType = type as PaymentReferenceType;
  const pendingWhere = {
    userId:        req.user.userId,
    status:        'pending' as const,
    referenceId,
    referenceType,
  };

  const txResult = await prisma.$transaction(async (tx) => {
    const existingPending = await tx.payment.findFirst({
      where:   pendingWhere,
      orderBy: { createdAt: 'asc' },
      select:  { id: true, checkoutUrl: true, orderId: true },
    });
    if (existingPending) {
      return { existingPending };
    }

    try {
      const payment = await tx.payment.create({
        data: {
          userId:        req.user.userId,
          orderId:       orderReference,
          amount,
          currency,
          method:        method as any,
          status:        'pending',
          description,
          descriptionAr,
          metadata:      paymentMetadata,
          referenceId,
          referenceType,
          ...(type === 'subscription'                          && { subscriptionId: referenceId }),
          ...(type === 'fee' || type === 'listing_fee' ? { feeId: referenceId } : {}),
        },
      });
      return { payment };
    } catch (err: any) {
      const isPendingRefUniqueViolation =
        err?.code === 'P2002' &&
        (String(err?.meta?.target ?? '').includes('referenceId') ||
          String(err?.meta?.target ?? '').includes('Payment_userId_referenceId_referenceType_pending_key'));
      if (isPendingRefUniqueViolation) {
        const racedPending = await tx.payment.findFirst({
          where:   pendingWhere,
          orderBy: { createdAt: 'asc' },
          select:  { id: true, checkoutUrl: true, orderId: true },
        });
        if (racedPending) {
          return { existingPending: racedPending };
        }
      }
      throw err;
    }
  });

  if ('existingPending' in txResult && txResult.existingPending) {
    const existingPending = txResult.existingPending;
    logger.info({ paymentId: existingPending.id }, 'Returning existing pending payment');
    return apiResponse(res, {
      paymentId:   existingPending.id,
      orderId:     existingPending.orderId,
      checkoutUrl: existingPending.checkoutUrl,
      status:      'pending',
    });
  }

  const payment = txResult.payment!;

  // ── استدعاء Network International Payment Links API ───────────────────────
  try {
    const isDev = !process.env.NI_API_KEY ||
      process.env.NI_API_KEY.startsWith('test_') ||
      process.env.NODE_ENV !== 'production';

    let checkoutUrl: string;

    if (isDev) {
      await new Promise((r) => setTimeout(r, 300));
      checkoutUrl = `https://sandbox.network.ae/demo/${orderReference}`;
    } else {
      // NI Payment Links API
      // POST https://api-gateway.network.ae/payment-links/api/v1/outlets/{outletId}/payment-links
      const niRes = await axios.post(
        `${process.env.NI_BASE_URL}/outlets/${process.env.NI_OUTLET_ID}/payment-links`,
        {
          action:   'SALE',           // SALE = تحصيل فوري
          amount: {
            currencyCode: currency,
            value:        Math.round(amount * 100), // NI يعمل بأصغر وحدة (هللة)
          },
          language:    'ar',
          description: descriptionAr || description || 'SAFAT Payment',
          merchantAttributes: {
            redirectUrl:          `${process.env.APP_URL}/payment/result`,
            cancelUrl:            `${process.env.APP_URL}/payment/cancel`,
            merchantOrderReference: orderReference,
          },
          billingAddress: {
            firstName: user?.displayName ?? user?.arabicName ?? 'Customer',
            email:     user?.email ?? '',
            countryCode: 'SA',
          },
          paymentMethods: [mapMethodToNI(method)],
          // بيانات إضافية للتتبع
          customData: {
            paymentId:   payment.id,
            type,
            referenceId,
            userId:      req.user.userId,
            ...(planId ? { targetPlanId: planId, billingCycle } : {}),
          },
        },
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${process.env.NI_API_KEY}:`).toString('base64')}`,
            'Content-Type':  'application/json',
            'Accept':        'application/json',
          },
          timeout: 12000,
        },
      );

      // NI يُرجع paymentLink أو url
      checkoutUrl = niRes.data?.paymentLink ?? niRes.data?.url ?? niRes.data?._links?.payment?.href;
      if (!checkoutUrl) throw new Error('NI returned no payment link');

      const niOrderRef = niRes.data?.reference ?? niRes.data?.orderReference ?? orderReference;

      await prisma.payment.update({
        where: { id: payment.id },
        data:  {
          transactionId: niOrderRef,
          checkoutUrl,
          metadata: {
            ...(paymentMetadata as any),
            niOrderReference: niOrderRef,
          },
        },
      });
    }

    logger.info({ userId: req.user.userId, orderReference, amount, type, paymentId: payment.id }, 'NI Payment initiated');

    return apiResponse(res, { paymentId: payment.id, orderId: orderReference, checkoutUrl, status: 'pending' });

  } catch (err: any) {
    await prisma.payment.update({
      where: { id: payment.id },
      data:  { status: 'failed' },
    }).catch(() => {});

    logger.error({ err: err.message, paymentId: payment.id }, 'NI API error');
    return apiError(res, 502, 'payment_gateway_error', 'خطأ في بوابة الدفع، حاول مجدداً');
  }
}
