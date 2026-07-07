# Payments (Network International)

## 1. Business Purpose

Payments let authenticated users pay for **subscription upgrades** and **listing commission fees** through **Network International (NI)** hosted checkout. The app never processes card data directly; it creates a pending `Payment` row, obtains an NI payment link, and fulfills entitlements when NI confirms payment via webhook.

**Who uses it:**
- **Mobile app users** — subscription checkout (`app/payment.tsx`) and listing fee checkout (`app/fees.tsx`)
- **Network International** — server-to-server webhook caller (`POST /api/payments/webhook`)
- **Backend services** — `PaymentsService` fulfills subscriptions and listing fees after successful payment

---

## 2. Frontend Flow

| Screen | File | Entry |
|--------|------|-------|
| Subscription payment | `app/app/payment.tsx` | From `app/app/subscription.tsx` via `router.push({ pathname: '/payment', params: { planId, cycle } })` |
| Listing fee payment | `app/app/fees.tsx` | Fees tab → pay modal → `handleConfirmPayment` |

### `payment.tsx` flow

1. Reads `planId` and `cycle` (`monthly` \| `yearly`) from route params.
2. Loads plan pricing via `usePlans(subscription.planAudience)` and `useSubscription()`.
3. User selects NI method from `PAYMENT_METHODS` in `app/services/network_international.ts` (`mada`, `visa`, `mastercard`, `apple_pay`, `stc_pay`).
4. Optional card-details step is **UI-only**; card fields are not sent to the API.
5. `POST /api/payments/initiate` with:
   - `type: 'subscription'`
   - `referenceId: subscription.id`
   - `planId`, `billingCycle`, `amount`, `method`
6. Opens `checkoutUrl` via `Linking.openURL` or `WebBrowser.openBrowserAsync`.
7. User is prompted to return; `refetchSubscription()` runs on dismiss.

### `fees.tsx` flow

1. `POST /api/payments/initiate` with `type: 'listing_fee'`, `referenceId: fee.id`, `amount: fee.commission`.
2. Opens NI checkout URL; refetches fees on return.

**Hooks/context:** `useSubscription`, `usePlans`, `useAuth`, `useApp`.

---

## 3. API Flow

| Method | URL | Auth | Body / headers |
|--------|-----|------|----------------|
| POST | `/api/payments/initiate` | JWT (`Authorization: Bearer`) | `InitiatePaymentDto` — see below |
| POST | `/api/payments/webhook` | Public (`@Public()`) | Raw JSON body; `x-signature` or `x-ni-signature` |

### `InitiatePaymentDto` (`backend-nest/src/payments/dto/payments.dto.ts`)

| Field | Required | Notes |
|-------|----------|-------|
| `amount` | yes | 0.01–100000 |
| `currency` | optional | default `SAR` |
| `method` | yes | `mada` \| `visa` \| `mastercard` \| `apple_pay` \| `stc_pay` |
| `type` | yes | `subscription` \| `fee` \| `listing_fee` |
| `referenceId` | yes | UUID — subscription id or listing fee id |
| `description`, `descriptionAr` | optional | max 200 chars |
| `planId` | required for subscription | slug, e.g. `sarh-pro` |
| `billingCycle` | required for subscription | `monthly` \| `yearly` |

**Responses:**
- Initiate success: `{ success: true, data: { paymentId, orderId, checkoutUrl, status: 'pending' } }`
- Webhook: always attempts `200 { received: true }` after processing (errors logged, not surfaced to NI)

**Rate limit:** `@RateLimit('payment')` on initiate.

---

## 4. Backend Flow

```
PaymentsController.initiate
  → PaymentsService.initiate(user, dto)
    → validate subscription plan/amount OR fee amount
    → checkReference() — subscription exists / fee pending & amount match
    → PaymentsRepository.createPendingPaymentOrReturnExisting()
    → if existing pending for same user+reference → return checkoutUrl
    → NI API POST {NI_BASE_URL}/outlets/{NI_OUTLET_ID}/payment-links
       OR dev sandbox URL if NI_API_KEY missing/test/non-production
    → PaymentsRepository.updatePaymentCheckout()
    → return { paymentId, orderId, checkoutUrl }

PaymentsController.webhook
  → verifyWebhookSignature(rawBody, signature)
  → PaymentsService.processWebhook(rawBody)
    → handleNIWebhook(event)
      → find payment by customData.paymentId or merchantOrderReference
      → refund path → markPaymentRefunded + optional subscription downgrade
      → success path → PaymentsRepository.processSuccessfulPayment()
      → failure path → markPaymentFailedById + notifications
```

**NI order reference format:** `SFAT-{userId8}-{timestamp36}` via `buildNIOrderReference()`.

**NI method mapping:** `mada→MADA`, `visa/mastercard→CARD`, `apple_pay→APPLE_PAY`, `stc_pay→STC_PAY`.

**Dev fallback:** If `!NI_API_KEY`, key starts with `test_`, or `NODE_ENV !== 'production'`, checkout URL is `https://sandbox.network.ae/demo/{orderReference}` without calling NI API.

---

## 5. Database

### `Payment` model (`backend-nest/prisma/schema.prisma`)

| Column | Role |
|--------|------|
| `id` | Internal payment UUID (sent to NI in `customData.paymentId`) |
| `userId` | Payer |
| `subscriptionId`, `feeId` | Optional FKs |
| `referenceId`, `referenceType` | `subscription` \| `fee` \| `listing_fee` |
| `orderId` | Unique merchant reference (`SFAT-...`) |
| `amount`, `currency`, `method` | Checkout details |
| `status` | `pending` \| `paid` \| `failed` \| `refunded` |
| `transactionId`, `checkoutUrl` | NI references |
| `metadata` | JSON — `type`, `referenceId`, `targetPlanId`, `billingCycle`, `subscriptionFulfilled` |
| `paidAt` | Set on successful fulfillment |

**Fulfillment (`processSuccessfulPayment`):**
- Subscription: extends `renewDate` (+30 or +365 days), updates plan, resets usage counters, sets butcher `subscriptionActive` for paid butcher plans, may set `user.verified`.
- Listing fee: sets `ListingFee.status = paid`, activates linked `Listing`.

---

## 6. Socket

Payments do **not** emit socket events. Clients refresh subscription/fees via REST after returning from NI checkout.

---

## 7. Notifications

Via `AppNotificationsService` → BullMQ `notifications` queue:

| Event | Type | Recipient |
|-------|------|-----------|
| Payment success (non-subscription) | `system` | Payer |
| Subscription renewal success | `subscription_renew` | Payer (via `SubscriptionLifecycleService.notifyRenewalSuccess`) |
| Payment failure | `system` or `subscription_renew` | Payer |
| Refund | `system` | Payer |

---

## 8. Redis

No payment-specific cache keys. Rate limiting for `payment` tier uses Redis when `REDIS_ENABLED !== 'false'`.

`SubscriptionCacheService.invalidate(userId)` runs after successful payment and refunds.

---

## 9. BullMQ

Payments do not enqueue jobs directly. Downstream notification and email jobs are queued via `AppNotificationsService` and `EmailQueueService`.

---

## 10. Security

- Initiate requires valid JWT (`@CurrentUser()`).
- Webhook is `@Public()` but protected by HMAC (`NI_WEBHOOK_SECRET`) in production.
- Raw body preserved via `RawBodyMiddleware` on `payments/webhook` only (`payments.module.ts`).
- Amount validation server-side against plan prices and pending fee amounts (±1 SAR tolerance).
- Subscription payment blocked if `shouldBlockSubscriptionPayment` (active paid period).
- Duplicate pending payments deduplicated per `userId + referenceId + referenceType`.
- NI API uses Basic auth: `Authorization: Basic base64(NI_API_KEY:)`.

**Required env vars:** `NI_API_KEY`, `NI_BASE_URL`, `NI_OUTLET_ID`, `NI_WEBHOOK_SECRET`, `APP_URL`.

---

## 11. Possible Bugs

1. **Card form is cosmetic** — `payment.tsx` collects card number/CVV but never sends them; all card entry happens on NI hosted page.
2. **No client polling** — after opening checkout, success depends on webhook; user may see stale subscription until manual refetch.
3. **Dev sandbox URL** — payments marked pending but never auto-complete without manual webhook simulation.
4. **`GET /api/fees` missing** — `fees.tsx` calls it to list fees; backend only exposes `GET /api/fees/rules` (see `docs/fees.md`).
5. **`isFailure` includes `ORDER.REVERSED`** — same event type used for refunds and failures in success/failure branching order; refund handling runs first for `paid` payments.
6. **Success screen in `payment.tsx` unreachable** — `step === 'success'` UI exists but initiate flow never sets it.

---

## 12. Production Readiness (%)

**78%**

NI integration, idempotent pending payments, HMAC webhooks, and fulfillment transactions are implemented. Gaps: no payment status polling endpoint for clients, dev-mode bypass easy to misconfigure, and frontend fee listing API mismatch.
