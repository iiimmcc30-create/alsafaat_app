import { Injectable } from '@nestjs/common';
import axios from 'axios';
import crypto from 'crypto';
import { PaymentReferenceType, PlanAudience } from '@prisma/client';
import { normalizePlanSlug, type BillingCycle } from '../lib/plans';
import { throwApi } from '../common/exceptions/api.exception';
import { LoggerService } from '../common/services/logger.service';
import { AppNotificationsService } from '../queue/services/app-notifications.service';
import { SubscriptionCacheService } from '../subscriptions/services/subscription-cache.service';
import { SubscriptionLifecycleService } from '../subscriptions/services/subscription-lifecycle.service';
import { SubscriptionEntitlementService } from '../subscriptions/services/subscription-entitlement.service';
import { PlansService } from '../plans/plans.service';
import type { JwtPayload } from '../common/types/jwt-payload.interface';
import { InitiatePaymentDto } from './dto/payments.dto';
import { PaymentsRepository } from './repositories/payments.repository';

function buildNIOrderReference(userId: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const uid = userId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `SFAT-${uid}-${ts}`;
}

function mapMethodToNI(method: string): string {
  switch (method) {
    case 'mada':
      return 'MADA';
    case 'visa':
    case 'mastercard':
      return 'CARD';
    case 'apple_pay':
      return 'APPLE_PAY';
    case 'stc_pay':
      return 'STC_PAY';
    default:
      return 'CARD';
  }
}

function verifyNISignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature.replace(/^sha256=/, ''), 'hex'),
    );
  } catch {
    return false;
  }
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly repo: PaymentsRepository,
    private readonly logger: LoggerService,
    private readonly notifications: AppNotificationsService,
    private readonly subscriptionCache: SubscriptionCacheService,
    private readonly subscriptionLifecycle: SubscriptionLifecycleService,
    private readonly entitlements: SubscriptionEntitlementService,
    private readonly plans: PlansService,
  ) {}

  private async resolveAudience(userId: string): Promise<PlanAudience> {
    return this.entitlements.getAudienceForUser(userId);
  }

  private async checkReference(
    userId: string,
    type: string,
    referenceId: string,
    amount: number,
    targetPlanId?: string,
  ): Promise<void> {
    if (type === 'subscription') {
      const sub = await this.repo.findSubscriptionForPayment(
        referenceId,
        userId,
      );
      if (!sub) throwApi(404, 'ref_not_found', 'الاشتراك غير موجود');
      const audience = await this.resolveAudience(userId);
      if (
        targetPlanId &&
        this.subscriptionLifecycle.shouldBlockPayment(
          sub,
          normalizePlanSlug(targetPlanId),
          audience,
        )
      ) {
        throwApi(
          400,
          'subscription_active',
          'اشتراكك لا يزال سارياً حتى تاريخ التجديد',
        );
      }
      return;
    }

    if (type === 'fee' || type === 'listing_fee') {
      const fee = await this.repo.findPendingFee(referenceId, userId);
      if (!fee) {
        throwApi(404, 'fee_not_found', 'الرسوم غير موجودة أو مسددة بالفعل');
      }
      if (Math.abs(fee.commission - amount) > 1) {
        throwApi(
          400,
          'amount_mismatch',
          `المبلغ غير مطابق. المبلغ الصحيح: ${fee.commission} ريال`,
        );
      }
      return;
    }

    if (type === 'butcher_order') {
      const order = await this.repo.findUnpaidButcherOrder(referenceId, userId);
      if (!order) {
        throwApi(
          404,
          'order_not_found',
          'الطلب غير موجود أو تم سداده مسبقاً',
        );
      }
      if (Math.abs(order.totalPrice - amount) > 1) {
        throwApi(
          400,
          'amount_mismatch',
          `المبلغ غير مطابق. المبلغ الصحيح: ${order.totalPrice} ${order.currency}`,
        );
      }
      return;
    }

    throwApi(400, 'invalid_type', 'نوع الدفع غير صالح');
  }

  async initiate(user: JwtPayload, dto: InitiatePaymentDto) {
    const {
      amount,
      currency = 'SAR',
      method,
      type,
      referenceId,
      description,
      descriptionAr,
      planId,
      billingCycle,
    } = dto;

    if (type === 'subscription') {
      if (!planId || !billingCycle) {
        throwApi(400, 'validation_error', 'يجب تحديد الباقة ودورة الفوترة');
      }
      const audience = await this.resolveAudience(user.userId);
      const normalizedPlan = normalizePlanSlug(planId);
      const upgradable = this.plans.getUpgradablePlans(audience);
      if (!upgradable.includes(normalizedPlan)) {
        throwApi(400, 'invalid_plan', 'باقة غير صالحة للترقية');
      }
      const expectedAmount = this.plans.getPlanPrice(
        normalizedPlan,
        audience,
        billingCycle as BillingCycle,
      );
      if (Math.abs(expectedAmount - amount) > 1) {
        throwApi(
          400,
          'amount_mismatch',
          `المبلغ غير مطابق. المبلغ الصحيح: ${expectedAmount} ريال`,
        );
      }
    }

    await this.checkReference(user.userId, type, referenceId, amount, planId);

    const orderReference = buildNIOrderReference(user.userId);
    const contact = await this.repo.findUserContact(user.userId);

    const paymentMetadata: Record<string, unknown> = {
      type,
      referenceId,
      userId: user.userId,
      ...(type === 'subscription' && planId && billingCycle
        ? { targetPlanId: planId, billingCycle }
        : {}),
    };

    const referenceType = type as PaymentReferenceType;
    const txResult = await this.repo.createPendingPaymentOrReturnExisting({
      userId: user.userId,
      orderId: orderReference,
      amount,
      currency,
      method,
      description,
      descriptionAr,
      metadata: paymentMetadata,
      referenceId,
      referenceType,
      subscriptionId: type === 'subscription' ? referenceId : undefined,
      feeId: type === 'fee' || type === 'listing_fee' ? referenceId : undefined,
    });

    if ('existingPending' in txResult && txResult.existingPending) {
      const existingPending = txResult.existingPending;
      this.logger.info(
        { paymentId: existingPending.id },
        'Returning existing pending payment',
      );
      const isDev =
        !process.env.NI_API_KEY ||
        process.env.NI_API_KEY.startsWith('test_') ||
        process.env.NODE_ENV !== 'production';
      return {
        paymentId: existingPending.id,
        orderId: existingPending.orderId,
        checkoutUrl: existingPending.checkoutUrl,
        status: 'pending',
        devMode: isDev,
      };
    }

    const payment = txResult.payment!;

    try {
      const isDev =
        !process.env.NI_API_KEY ||
        process.env.NI_API_KEY.startsWith('test_') ||
        process.env.NODE_ENV !== 'production';

      let checkoutUrl: string;

      if (isDev) {
        await new Promise((r) => setTimeout(r, 300));
        checkoutUrl = `https://sandbox.network.ae/demo/${orderReference}`;
        await this.repo.updatePaymentCheckout(payment.id, {
          transactionId: `DEV-${orderReference}`,
          checkoutUrl,
          metadata: { ...paymentMetadata, sandbox: true },
        });
      } else {
        const niRes = await axios.post(
          `${process.env.NI_BASE_URL}/outlets/${process.env.NI_OUTLET_ID}/payment-links`,
          {
            action: 'SALE',
            amount: {
              currencyCode: currency,
              value: Math.round(amount * 100),
            },
            language: 'ar',
            description: descriptionAr || description || 'سرح Payment',
            merchantAttributes: {
              redirectUrl: `${process.env.APP_URL}/payment/result`,
              cancelUrl: `${process.env.APP_URL}/payment/cancel`,
              merchantOrderReference: orderReference,
            },
            billingAddress: {
              firstName:
                contact?.displayName ?? contact?.arabicName ?? 'Customer',
              email: contact?.email ?? '',
              countryCode: 'SA',
            },
            paymentMethods: [mapMethodToNI(method)],
            customData: {
              paymentId: payment.id,
              type,
              referenceId,
              userId: user.userId,
              ...(planId ? { targetPlanId: planId, billingCycle } : {}),
            },
          },
          {
            headers: {
              Authorization: `Basic ${Buffer.from(`${process.env.NI_API_KEY}:`).toString('base64')}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            timeout: 12000,
          },
        );

        checkoutUrl =
          niRes.data?.paymentLink ??
          niRes.data?.url ??
          niRes.data?._links?.payment?.href;
        if (!checkoutUrl) throw new Error('NI returned no payment link');

        const niOrderRef =
          niRes.data?.reference ?? niRes.data?.orderReference ?? orderReference;

        await this.repo.updatePaymentCheckout(payment.id, {
          transactionId: niOrderRef,
          checkoutUrl,
          metadata: { ...paymentMetadata, niOrderReference: niOrderRef },
        });
      }

      this.logger.info(
        {
          userId: user.userId,
          orderReference,
          amount,
          type,
          paymentId: payment.id,
        },
        'NI Payment initiated',
      );

      return {
        paymentId: payment.id,
        orderId: orderReference,
        checkoutUrl,
        status: 'pending',
        devMode: isDev,
      };
    } catch (err: unknown) {
      await this.repo.markPaymentFailed(payment.id).catch(() => {});
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        { err: message, paymentId: payment.id },
        'NI API error',
      );
      throwApi(502, 'payment_gateway_error', 'خطأ في بوابة الدفع، حاول مجدداً');
    }
  }

  verifyWebhookSignature(
    rawBody: string,
    signature: string | undefined,
  ): { ok: true } | { ok: false; status: number; error: string } {
    const webhookSecret = process.env.NI_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      if (!verifyNISignature(rawBody, signature, webhookSecret)) {
        this.logger.warn(
          { signature: signature?.slice(0, 8) },
          'Invalid NI webhook signature',
        );
        return { ok: false, status: 401, error: 'invalid_signature' };
      }
      return { ok: true };
    }

    if (process.env.NODE_ENV === 'production') {
      this.logger.error(
        {},
        'NI Webhook received without signature in production',
      );
      return { ok: false, status: 401, error: 'missing_signature' };
    }

    return { ok: true };
  }

  async processWebhook(rawBody: string) {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return { status: 400, body: { error: 'invalid_json' } };
    }

    try {
      await this.handleNIWebhook(event);
    } catch (err) {
      this.logger.error({ err, event }, 'NI Webhook processing error');
    }

    return { status: 200, body: { received: true } };
  }

  private async handleNIWebhook(event: Record<string, unknown>) {
    const order = (event.order ?? event) as Record<string, unknown>;
    const eventType = String(event.eventName ?? event.type ?? '');

    const merchantAttrs = order?.merchantAttributes as
      Record<string, unknown> | undefined;
    const merchantOrderRef = String(
      merchantAttrs?.merchantOrderReference ??
        order?.merchantOrderReference ??
        order?.reference ??
        '',
    );

    const customData = (order?.customData ?? order?.metadata ?? {}) as Record<
      string,
      unknown
    >;
    const internalPaymentId = customData?.paymentId
      ? String(customData.paymentId)
      : '';

    const payment = await this.repo.findPaymentForWebhook(
      internalPaymentId || undefined,
      merchantOrderRef,
    );

    if (!payment) {
      this.logger.warn(
        { merchantOrderRef, internalPaymentId },
        'NI Webhook: payment not found',
      );
      return;
    }

    const storedMeta = (payment.metadata ?? {}) as Record<string, unknown>;
    const type =
      payment.referenceType ??
      (storedMeta.type as string | undefined) ??
      (customData?.type as string | undefined);
    const referenceId =
      payment.referenceId ??
      (storedMeta.referenceId as string | undefined) ??
      (customData?.referenceId as string | undefined);
    const userId =
      (storedMeta.userId as string | undefined) ??
      (customData?.userId as string | undefined) ??
      payment.userId;
    const targetPlanId =
      (storedMeta.targetPlanId as string | undefined) ??
      (customData?.targetPlanId as string | undefined);
    const billingCycle =
      (storedMeta.billingCycle as string | undefined) ??
      (customData?.billingCycle as string | undefined) ??
      'monthly';

    const orderState = String(
      (order?.state as string | undefined) ?? '',
    ).toUpperCase();

    const niTransactionId = String(
      order?.reference ?? order?.transactionId ?? merchantOrderRef,
    );

    const isRefundEvent =
      ['ORDER.REVERSED', 'ORDER.REFUNDED', 'ORDER.PARTIALLY_REFUNDED'].includes(
        eventType.toUpperCase(),
      ) || ['REVERSED', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(orderState);

    if (payment.status === 'refunded') {
      this.logger.debug(
        { paymentId: payment.id, status: payment.status },
        'NI Webhook already processed',
      );
      return;
    }

    if (payment.status === 'paid' && isRefundEvent) {
      await this.repo.markPaymentRefunded(payment.id, {
        ...storedMeta,
        refundedAt: new Date().toISOString(),
        refundEvent: eventType,
      });
      if (
        type === 'subscription' &&
        referenceId &&
        storedMeta.subscriptionFulfilled === true
      ) {
        const sub = await this.repo.findSubscriptionForPayment(
          referenceId,
          userId,
        );
        if (sub) {
          await this.subscriptionLifecycle.downgradeUser(
            userId,
            sub.planId,
            sub.planAudience ?? (await this.resolveAudience(userId)),
            'refund',
          );
        }
      }
      await this.subscriptionCache.invalidate(userId);
      await this.notifications.notifyUser({
        userId,
        type: 'system',
        titleAr: 'تم استرداد الدفع',
        bodyAr: `تم استرداد ${payment.amount} ${payment.currency}.`,
        data: { paymentId: payment.id, transactionId: niTransactionId },
      });
      return;
    }

    if (payment.status === 'paid' || payment.status === 'failed') {
      this.logger.debug(
        { paymentId: payment.id, status: payment.status },
        'NI Webhook already processed',
      );
      return;
    }

    const isSuccess =
      ['ORDER.PAID', 'ORDER.CAPTURED', 'ORDER.AUTHORISED'].includes(
        eventType.toUpperCase(),
      ) || ['CAPTURED', 'AUTHORISED', 'PURCHASED'].includes(orderState);

    const isFailure =
      ['ORDER.FAILED', 'ORDER.REVERSED', 'ORDER.CANCELLED'].includes(
        eventType.toUpperCase(),
      ) || ['FAILED', 'REVERSED', 'CANCELLED'].includes(orderState);

    if (isSuccess) {
      const fulfillment = await this.repo.processSuccessfulPayment({
        paymentId: payment.id,
        niTransactionId,
        type,
        referenceId,
        userId,
        targetPlanId,
        billingCycle,
        storedMeta,
      });

      if (fulfillment.processed) {
        await this.subscriptionCache.invalidate(userId);

        if (fulfillment.subscription) {
          await this.subscriptionLifecycle.notifyRenewalSuccess(
            userId,
            fulfillment.subscription.targetPlanId,
            payment.amount,
            payment.currency,
          );
        } else if (fulfillment.butcherOrder) {
          const bo = fulfillment.butcherOrder;
          await Promise.all([
            this.notifications.notifyUser({
              userId: bo.customerId,
              type: 'order_update',
              titleAr: `طلب ${bo.orderNumber}`,
              bodyAr: 'تم الدفع بنجاح ووصل طلبك للملحمة',
              data: {
                orderId: bo.id,
                orderNumber: bo.orderNumber,
                paymentStatus: 'paid',
                butcherId: bo.butcherId,
              },
            }),
            this.notifications.notifyUser({
              userId: bo.butcherUserId,
              type: 'system',
              titleAr: 'طلب مدفوع جديد',
              bodyAr: `وصلك طلب مدفوع رقم ${bo.orderNumber}`,
              data: {
                orderId: bo.id,
                orderNumber: bo.orderNumber,
                paymentStatus: 'paid',
                butcherId: bo.butcherId,
              },
            }),
          ]);
        } else {
          await this.notifications.notifyUser({
            userId,
            type: 'system',
            titleAr: '✅ تم الدفع بنجاح',
            bodyAr: `تم سداد ${payment.amount} ${payment.currency}. رقم العملية: ${niTransactionId}`,
            data: { paymentId: payment.id, transactionId: niTransactionId },
          });
        }

        this.logger.info(
          { paymentId: payment.id, type, referenceId, amount: payment.amount },
          'NI Payment confirmed',
        );
      }
    } else if (isFailure) {
      await this.repo.markPaymentFailedById(payment.id);

      if (type === 'butcher_order' && referenceId) {
        await this.repo.markButcherOrderPaymentFailed(referenceId).catch(() => {});
      }

      if (type === 'subscription' && targetPlanId) {
        await this.subscriptionLifecycle.notifyRenewalFailed(
          userId,
          targetPlanId,
        );
      } else {
        await this.notifications.notifyUser({
          userId,
          type: 'system',
          titleAr: '❌ فشل الدفع',
          bodyAr: 'فشلت عملية الدفع. يرجى المحاولة مجدداً.',
          data: { paymentId: payment.id },
        });
      }

      this.logger.warn(
        { paymentId: payment.id, eventType },
        'NI Payment failed',
      );
    }
  }

  /** Local/sandbox only: mark a pending payment as paid without NI webhook. */
  async simulateDevPayment(user: JwtPayload, paymentId: string) {
    const isDev =
      !process.env.NI_API_KEY ||
      process.env.NI_API_KEY.startsWith('test_') ||
      process.env.NODE_ENV !== 'production';
    if (!isDev) {
      throwApi(403, 'forbidden', 'غير متاح في بيئة الإنتاج');
    }

    const payment = await this.repo.findPaymentOwnedByUser(
      paymentId,
      user.userId,
    );
    if (!payment) throwApi(404, 'not_found', 'الدفعة غير موجودة');
    if (payment.status === 'paid') {
      return { paymentId: payment.id, status: 'paid' as const };
    }
    if (payment.status !== 'pending') {
      throwApi(400, 'invalid_status', 'لا يمكن إتمام هذه الدفعة');
    }

    const storedMeta = (payment.metadata ?? {}) as Record<string, unknown>;
    const type =
      payment.referenceType ?? (storedMeta.type as string | undefined);
    const referenceId =
      payment.referenceId ?? (storedMeta.referenceId as string | undefined);
    const niTransactionId = `DEV-${payment.orderId}`;

    const fulfillment = await this.repo.processSuccessfulPayment({
      paymentId: payment.id,
      niTransactionId,
      type,
      referenceId,
      userId: user.userId,
      targetPlanId: storedMeta.targetPlanId as string | undefined,
      billingCycle: (storedMeta.billingCycle as string | undefined) ?? 'monthly',
      storedMeta,
    });

    if (fulfillment.processed && fulfillment.butcherOrder) {
      const bo = fulfillment.butcherOrder;
      await Promise.all([
        this.notifications.notifyUser({
          userId: bo.customerId,
          type: 'order_update',
          titleAr: `طلب ${bo.orderNumber}`,
          bodyAr: 'تم الدفع بنجاح ووصل طلبك للملحمة',
          data: {
            orderId: bo.id,
            orderNumber: bo.orderNumber,
            paymentStatus: 'paid',
            butcherId: bo.butcherId,
          },
        }),
        this.notifications.notifyUser({
          userId: bo.butcherUserId,
          type: 'system',
          titleAr: 'طلب مدفوع جديد',
          bodyAr: `وصلك طلب مدفوع رقم ${bo.orderNumber}`,
          data: {
            orderId: bo.id,
            orderNumber: bo.orderNumber,
            paymentStatus: 'paid',
            butcherId: bo.butcherId,
          },
        }),
      ]);
    }

    return { paymentId: payment.id, status: 'paid' as const };
  }
}
