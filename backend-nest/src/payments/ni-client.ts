/**
 * Network International (N-Genius) API client.
 * Flow: access-token (Basic) → create order (Bearer) → payment page URL.
 */
import axios from 'axios';

export type NiCheckoutInput = {
  amount: number;
  currency: string;
  orderReference: string;
  description: string;
  redirectUrl: string;
  cancelUrl: string;
  firstName?: string;
  email?: string;
  paymentMethods?: string[];
  customData?: Record<string, unknown>;
};

/** True only when NI credentials are missing / placeholders — not based on NODE_ENV. */
export function isNiSandboxMockMode(): boolean {
  const key = process.env.NI_API_KEY?.trim() ?? '';
  return !key || key.startsWith('test_') || key === 'change-me';
}

function gatewayBase(): string {
  const raw =
    process.env.NI_BASE_URL?.trim() ||
    'https://api-gateway.ksa.ngenius-payments.com';
  // Support both ".../networkapi/" legacy values and clean gateway roots
  return raw
    .replace(/\/+$/, '')
    .replace(/\/networkapi$/i, '')
    .replace(/\/transactions$/i, '');
}

/**
 * Portal API keys are often already Base64. UUID keys need `base64(key:)`.
 * Also supports NI_BASIC_AUTH as a full pre-encoded Basic credential.
 */
function basicAuthHeader(): string {
  const preencoded = process.env.NI_BASIC_AUTH?.trim();
  if (preencoded) {
    return preencoded.startsWith('Basic ')
      ? preencoded
      : `Basic ${preencoded}`;
  }

  const key = process.env.NI_API_KEY?.trim() ?? '';
  // Already looks like Base64 (no UUID dashes pattern alone)
  const looksBase64 =
    /^[A-Za-z0-9+/]+=*$/.test(key) && key.length >= 40 && !key.includes('-');

  if (looksBase64) return `Basic ${key}`;

  // Standard N-Genius: encode "apiKey:"
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

async function getAccessToken(): Promise<string> {
  const url = `${gatewayBase()}/identity/auth/access-token`;
  const auth = basicAuthHeader();
  const realm =
    process.env.NI_REALM?.trim() ||
    (gatewayBase().includes('sandbox') ? 'ni' : 'ni');

  // KSA portal succeeds with: { grant_type, realm: 'ni' }
  const attempts: Array<{ body: unknown; contentType: string }> = [
    {
      body: { grant_type: 'client_credentials', realm },
      contentType: 'application/vnd.ni-identity.v1+json',
    },
    {
      body: { realmName: realm },
      contentType: 'application/vnd.ni-identity.v1+json',
    },
    {
      body: { grant_type: 'client_credentials', realm: 'networkinternational' },
      contentType: 'application/vnd.ni-identity.v1+json',
    },
    {
      body: { realmName: 'networkinternational' },
      contentType: 'application/vnd.ni-identity.v1+json',
    },
    {
      body: {},
      contentType: 'application/vnd.ni-identity.v1+json',
    },
  ];

  let lastDetail = '';
  for (const attempt of attempts) {
    const { data, status } = await axios.post(url, attempt.body, {
      headers: {
        Authorization: auth,
        'Content-Type': attempt.contentType,
        Accept: 'application/vnd.ni-identity.v1+json',
      },
      timeout: 12000,
      validateStatus: () => true,
    });

    if (data?.access_token) return data.access_token as string;

    lastDetail =
      data?.errors?.[0]?.message ||
      data?.message ||
      JSON.stringify(data || { status }).slice(0, 300);
  }

  throw new Error(
    `NI access token failed — تحقق من NI_API_KEY / NI_BASIC_AUTH / NI_CHAIN_ID وبيئة الـ Sandbox. (${lastDetail})`,
  );
}

/**
 * Create an NI hosted payment order and return the checkout URL + NI order ref.
 */
export async function createNiCheckout(input: NiCheckoutInput): Promise<{
  checkoutUrl: string;
  niOrderReference: string;
}> {
  const outletId = process.env.NI_OUTLET_ID?.trim();
  if (!outletId) throw new Error('NI_OUTLET_ID is not configured');

  const token = await getAccessToken();
  const url = `${gatewayBase()}/transactions/outlets/${outletId}/orders`;

  const body = {
    action: 'PURCHASE',
    amount: {
      currencyCode: input.currency || 'SAR',
      value: Math.round(input.amount * 100),
    },
    merchantAttributes: {
      redirectUrl: input.redirectUrl,
      cancelUrl: input.cancelUrl,
      merchantOrderReference: input.orderReference,
      skipConfirmationPage: true,
    },
    ...(input.email ? { emailAddress: input.email } : {}),
    ...(input.firstName
      ? {
          billingAddress: {
            firstName: input.firstName,
            lastName: '.',
          },
        }
      : {}),
  };

  const { data, status } = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/vnd.ni-payment.v2+json',
      Accept: 'application/vnd.ni-payment.v2+json',
    },
    timeout: 15000,
    validateStatus: () => true,
  });

  if (status >= 400) {
    const detail =
      data?.errors?.[0]?.localizedMessage ||
      data?.errors?.[0]?.message ||
      data?.message ||
      JSON.stringify(data || {}).slice(0, 400);
    throw new Error(`NI create order failed (${status}): ${detail}`);
  }

  const links = (data?._links ?? {}) as Record<string, { href?: string }>;
  const checkoutUrl =
    links.payment?.href ||
    links['payment:card']?.href ||
    links['cnp:payment-link']?.href ||
    data?.paymentLink ||
    data?.url;

  if (!checkoutUrl) {
    throw new Error('NI returned no payment link');
  }

  const niOrderReference =
    data?.reference ||
    data?._id?.replace?.(/^urn:order:/, '') ||
    data?.orderReference ||
    input.orderReference;

  return { checkoutUrl, niOrderReference };
}

/**
 * Fetch order status from NI (for sync / webhook fallback).
 */
export async function fetchNiOrder(orderRef: string): Promise<unknown> {
  const outletId = process.env.NI_OUTLET_ID?.trim();
  if (!outletId) throw new Error('NI_OUTLET_ID is not configured');

  const token = await getAccessToken();
  const url = `${gatewayBase()}/transactions/outlets/${outletId}/orders/${orderRef}`;

  const { data, status } = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.ni-payment.v2+json',
    },
    timeout: 12000,
    validateStatus: () => true,
  });

  if (status >= 400) {
    throw new Error(`NI order fetch failed (${status})`);
  }

  return data;
}
