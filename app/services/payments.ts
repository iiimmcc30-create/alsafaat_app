import { Alert } from 'react-native';
import { router } from 'expo-router';
import { API_BASE } from './api';
import { openPaymentCheckout } from './paymentCheckout';

export type PaymentContext =
  | 'subscription'
  | 'listing_fee'
  | 'commission'
  | 'boost'
  | 'butcher_order'
  | 'generic';

export type InitiatedPayment = {
  paymentId?: string;
  checkoutUrl?: string;
  devMode?: boolean;
  boostId?: string;
};

export async function devCompletePayment(
  accessToken: string,
  paymentId: string,
): Promise<{ ok: boolean; status?: string; message?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/payments/${paymentId}/dev-complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) {
      return { ok: true, status: json.data?.status ?? 'paid' };
    }
    return {
      ok: false,
      message: json.messageAr ?? json.message ?? 'فشل إتمام الدفع التجريبي',
    };
  } catch {
    return { ok: false, message: 'تعذّر الاتصال بالخادم' };
  }
}

export async function syncPaymentStatus(
  accessToken: string,
  paymentId: string,
): Promise<'paid' | 'pending' | 'failed'> {
  try {
    const res = await fetch(`${API_BASE}/api/payments/${paymentId}/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) return 'pending';
    const status = String(json.data?.status ?? 'pending');
    if (status === 'paid') return 'paid';
    if (status === 'failed') return 'failed';
    return 'pending';
  } catch {
    return 'pending';
  }
}

type LaunchPaymentOptions = {
  accessToken: string;
  paymentId?: string;
  checkoutUrl?: string;
  devMode?: boolean;
  context?: PaymentContext;
  returnParams?: Record<string, string>;
};

function goToPaymentResult(
  paymentId: string,
  context: PaymentContext,
  returnParams?: Record<string, string>,
) {
  router.push({
    pathname: '/payment/result',
    params: {
      paymentId,
      context,
      ...returnParams,
    },
  } as never);
}

/** Unified checkout: dev test payment or NI hosted page. */
export async function launchPaymentCheckout(
  options: LaunchPaymentOptions,
): Promise<'paid' | 'opened' | 'cancelled' | 'failed'> {
  const {
    accessToken,
    paymentId,
    checkoutUrl,
    devMode,
    context = 'generic',
    returnParams,
  } = options;

  if (devMode) {
    if (!paymentId) return 'failed';

    return new Promise((resolve) => {
      Alert.alert(
        'وضع الاختبار',
        'بوابة الدفع في وضع التطوير.\n\nيمكنك إتمام دفع تجريبي الآن لاختبار الاشتراك والخدمات قبل الإطلاق.',
        [
          { text: 'إلغاء', style: 'cancel', onPress: () => resolve('cancelled') },
          {
            text: 'إتمام دفع تجريبي',
            onPress: () => {
              void (async () => {
                const result = await devCompletePayment(accessToken, paymentId);
                if (result.ok) {
                  goToPaymentResult(paymentId, context, returnParams);
                  resolve('paid');
                } else {
                  Alert.alert('فشل الدفع', result.message ?? 'تعذّر إتمام الدفع التجريبي');
                  resolve('failed');
                }
              })();
            },
          },
        ],
      );
    });
  }

  if (!checkoutUrl) return 'failed';

  await openPaymentCheckout(checkoutUrl, paymentId);

  if (paymentId) {
    goToPaymentResult(paymentId, context, returnParams);
  }

  return 'opened';
}
