import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

const APP_SCHEME = 'safat';

/** Return deep link used after Network International hosted checkout. */
export function paymentResultDeepLink(paymentId?: string): string {
  const base = `${APP_SCHEME}://payment/result`;
  return paymentId ? `${base}?paymentId=${encodeURIComponent(paymentId)}` : base;
}

/**
 * Open NI checkout and prefer an in-app auth session that returns via deep link.
 * Falls back to the system browser if the auth session is unavailable.
 */
export async function openPaymentCheckout(
  checkoutUrl: string,
  paymentId?: string,
): Promise<'success' | 'cancel' | 'dismiss'> {
  const returnUrl = paymentResultDeepLink(paymentId);
  try {
    const result = await WebBrowser.openAuthSessionAsync(checkoutUrl, returnUrl);
    if (result.type === 'success') return 'success';
    if (result.type === 'cancel') return 'cancel';
    return 'dismiss';
  } catch {
    try {
      await WebBrowser.openBrowserAsync(checkoutUrl);
    } catch {
      await Linking.openURL(checkoutUrl);
    }
    return 'dismiss';
  }
}
