# SAFAT Platform — Complete Technical Documentation

> Combined documentation generated from all feature docs in `docs/`.
> Evidence-based from codebase. If code and docs disagree, trust the code.
> Generated: 2026-07-07

---



---

# FILE: SYSTEM_ARCHITECTURE.md


# SAFAT Platform — System Architecture

> Evidence-based documentation derived from the codebase at `SAFAT_APP_fixed`.  
> Last audited: 2026-07-07. If code and this document disagree, **trust the code**.

---

## 1. High-Level Architecture

SAFAT (mobile app package name: **Sarh**, `com.safat.app`) is a livestock marketplace and social platform with butcher commerce, subscriptions, live streaming, and admin moderation.

### Three client applications

| Client | Stack | Path | Default port |
|--------|-------|------|--------------|
| Mobile app | Expo Router (React Native) | `app/` | Expo dev |
| Admin panel | Next.js 14 App Router | `admin-panel/` | `3000` |
| Backend API | NestJS + Prisma | `backend-nest/` | `3001` |

### Three backend runtime processes

| Process | Entry | Port | Purpose |
|---------|-------|------|---------|
| HTTP API | `backend-nest/src/main.ts` | `3001` (`PORT`) | REST API, Swagger |
| Socket.IO | `backend-nest/src/gateway/socket.main.ts` | `3002` (`SOCKET_PORT`) | Realtime (chat, live, orders) |
| Workers | `backend-nest/src/queue/worker.main.ts` | — | BullMQ processors + hourly cron |

### Data stores

| Store | Technology | Usage |
|-------|------------|-------|
| Primary DB | PostgreSQL via Prisma | All persistent entities |
| Redis DB 0 | `ioredis` | Entity cache, rate limits, presence, cron locks |
| Redis DB 1 | BullMQ | Job queues |
| Redis DB 2 | `RedisSessionService` | Token blacklist, email-verify codes |
| Redis DB 3 | Socket.IO adapter + pub/sub | Multi-instance sockets, forced disconnect |
| File storage | Local `/uploads` or S3 presign | Images, documents |

---

## 2. Folder Structure

```
SAFAT_APP_fixed/
├── app/                    # Expo mobile client
│   ├── app/                # Expo Router screens
│   ├── components/         # UI + feature components
│   ├── contexts/           # Auth, App, Subscription, Theme
│   ├── hooks/              # Data + socket hooks
│   ├── services/           # API clients
│   └── lib/                # socket, notifications, utilities
├── admin-panel/            # Next.js admin dashboard
│   └── src/
│       ├── app/(dashboard)/# Admin pages
│       ├── components/     # UI, layout, modals
│       ├── hooks/          # useAdminOrderSocket
│       └── services/       # admin.service, auth, api.client
└── backend-nest/           # NestJS monolith
    ├── prisma/schema.prisma
    └── src/
        ├── auth/           # JWT, OTP, sessions
        ├── users/          # Profiles, follow
        ├── listings/       # Marketplace ads
        ├── posts/          # Social feed
        ├── stories/        # Ephemeral stories
        ├── butchers/       # Shops, products, orders
        ├── butcher-applications/
        ├── livestreams/    # Agora live
        ├── messages/       # DMs
        ├── notifications/  # In-app inbox REST
        ├── payments/       # Network International
        ├── subscriptions/  # Plan entitlements
        ├── plans/          # Plan catalog
        ├── admin/          # Staff dashboard API
        ├── fees/           # Commission rules
        ├── search/           # Trending tags only
        ├── upload/           # Presign + direct upload
        ├── queue/            # BullMQ + notifications
        ├── gateway/          # Socket.IO
        ├── redis/            # Cache + session Redis
        ├── health/           # Health checks
        └── common/           # Guards, filters, rate limit
```

---

## 3. Request Lifecycle (HTTP)

```
Client
  → CORS + security headers (main.ts)
  → Global prefix /api (v1 rewrite supported)
  → RateLimitGuard (Redis or in-memory fallback)
  → JwtAuthGuard (unless @Public / @OptionalAuth)
  → RolesGuard (@Roles decorator)
  → ValidationPipe (DTO class-validator)
  → Controller
  → Service (business rules)
  → Repository (Prisma queries)
  → PostgreSQL
  → successResponse() envelope { success, data, timestamp }
```

**Response envelope:** `backend-nest/src/common/utils/response.util.ts` — `{ success: true, data: T }` or thrown `ApiException` → `GlobalExceptionFilter`.

**Auth header:** `Authorization: Bearer <accessToken>` on protected routes.

---

## 4. Authentication Flow

### Token model (`auth/services/jwt-token.service.ts`)

| Token | Secret env | Default TTL | Claims |
|-------|------------|-------------|--------|
| Access | `JWT_SECRET` | `15m` | `userId`, `username`, `role`, `passwordVersion` |
| Refresh | `JWT_REFRESH_SECRET` | `30d` | `userId`, `jti` |
| Phone OTP proof | `JWT_SECRET` | `15m` | Used between OTP verify → register/reset |

### Session storage

- **Refresh tokens:** PostgreSQL `UserSession` (max 5 per user, rotation on refresh).
- **Access revocation:** Redis `blacklist:{token}` (TTL 15 min) via `RedisSessionService`.
- **Password change:** increments `User.passwordVersion`, invalidates all sessions.

### OTP (`auth/services/auth.service.ts`)

- Twilio Verify when configured (`TWILIO_*` env vars).
- Dev fallback code `123456` when Twilio not configured.
- Purposes: login, register, reset password.

### Mobile auth (`app/contexts/AuthContext.tsx`)

- Stores tokens in AsyncStorage.
- `authFetch` wrapper auto-refreshes on 401.
- `activeMode`: `USER` | `BUTCHER` (client-side mode switch, not a separate JWT role).

### Admin auth (`admin-panel/src/services/auth.service.ts`)

- `POST /api/admin/auth/login` → stores `admin_access_token` in localStorage + `admin_token` cookie.
- Middleware (`admin-panel/src/middleware.ts`) checks cookie presence only (no JWT validation at edge).

---

## 5. Socket Architecture

### Bootstrap

- Standalone Nest app: `gateway/socket.main.ts` on port `3002`.
- Redis adapter (`gateway/services/socket-redis-adapter.service.ts`) on Redis DB 3 for horizontal scaling.

### Authentication (`gateway/services/socket-gateway.service.ts`)

1. Token from `handshake.auth.token` or `Authorization` header.
2. Verify JWT, check Redis blacklist, validate `passwordVersion`.
3. Join room `user:{userId}`; set `online:{userId}` in Redis cache.

### Room naming

| Room pattern | Used for |
|--------------|----------|
| `user:{userId}` | Per-user events (notifications, orders) |
| `thread:{threadId}` | Chat messages |
| `stream:{streamId}` | Live comments, likes, viewers |

### Event categories

| Category | Client → Server | Server → Client |
|----------|-----------------|-----------------|
| Chat | `chat:join`, `chat:send`, `chat:typing`, `chat:read` | `chat:message`, `chat:notification`, `chat:typing`, `chat:read` |
| Live | `live:join`, `live:leave`, `live:comment`, `live:like` | `live:comment`, `live:like`, `live:likes`, `live:viewers`, `live:stats` |
| Orders | `order:status` (butcher) | `order.created`, `order.updated`, `order.cancelled`, `order.timeline.updated`, `inventory.updated`, `admin.*` |
| Presence | `presence:ping` | — |
| Notifications | `notifications:read` | — (no `notification:new` for general notifications) |

### Mobile socket client (`app/lib/socket.ts`)

- URL: `EXPO_PUBLIC_SOCKET_URL` or dev host port `3002`.
- Used for: live streams (`useLiveSocket`), orders (`useOrderSocket`), butcher manage (inline listeners).

### Admin socket (`admin-panel/src/hooks/useAdminOrderSocket.ts`)

- Listens to `admin.order.*` and fallback direct order events for orders pages only.

---

## 6. Queue Architecture (BullMQ)

**Connection:** Redis DB 1 (`queue/constants.ts`). Disabled when `REDIS_ENABLED=false` — notifications fall back to synchronous persist.

### Queues

| Queue | Job name | Processor | Purpose |
|-------|----------|-----------|---------|
| `notifications` | `create` | `NotificationProcessor` | Persist DB notification |
| `push-notifications` | `send` | `PushProcessor` | Firebase FCM |
| `emails` | `send` | `EmailProcessor` | Nodemailer |
| `fee-checks` | `check` | `FeeCheckProcessor` | Overdue listing fees |
| `image-processing` | `process` | `ImageProcessingProcessor` | **Stub only** (logs, no processing) |
| `subscriptions` | `expire`, `reminders`, `reset_live_minutes`, `auto_renew_attempt` | `SubscriptionProcessor` | Subscription lifecycle |

### Notification pipeline

```
AppNotificationsService.notifyUser()
  → NotificationQueueService.addNotification()
    → NotificationProcessor
      → NotificationPersistService
        1. INSERT Notification (Postgres)
        2. PushQueueService.addPush() if fcmToken present
          → PushProcessor → Firebase Admin SDK
```

---

## 7. Redis Architecture

Controlled by `REDIS_ENABLED` (default on unless `'false'`).

| DB | Service | Keys / usage |
|----|---------|--------------|
| 0 | `RedisCacheService`, `RateLimitService` | `user:`, `listing:`, `post:`, `butcher:`, `feed:`, `streams:live`, `subscription:{userId}`, `rl:api`, `rl:auth`, `rl:payment`, `online:{userId}`, `cron:*` locks |
| 1 | BullMQ | Job queues |
| 2 | `RedisSessionService` | `blacklist:{token}`, `email_verify:{userId}`, `subscription:reminder:{userId}:{kind}` |
| 3 | Socket adapter | `@socket.io/redis-adapter`, channel `socket:disconnect` |

**Rate limits** (`common/services/rate-limit.service.ts` via `RateLimitGuard`):

| Type | Limit | Window |
|------|-------|--------|
| `api` | 100 | 15 min |
| `auth` | 5 | 15 min |
| `payment` | 10 | 1 hour |

Skipped in `NODE_ENV=development`. Falls back to in-memory if Redis unavailable.

---

## 8. Database Architecture

**ORM:** Prisma 5+ on PostgreSQL. Schema: `backend-nest/prisma/schema.prisma`.

### Domain groupings

| Domain | Models |
|--------|--------|
| Identity | `User`, `UserSession`, `Follow` |
| Commerce | `Listing`, `ListingFee`, `ListingOffer` |
| Social | `Post`, `PostLike`, `PostRepost`, `PostComment`, `Story`, `StoryView`, `StoryReaction`, `Activity` |
| Butchers | `Butcher`, `ButcherProduct`, `ButcherOffer`, `ButcherStory`, `ButcherOrder`, `OrderTimeline`, `OrderStatusAudit`, `OrderNumberSequence`, `ButcherReview` |
| Onboarding | `ButcherApplication`, `ButcherApplicationDocument`, `ButcherApplicationTimelineEvent` |
| Live | `LiveStream`, `LiveComment` |
| Messaging | `Message`, `MessageThread` |
| Billing | `Plan`, `PlanFeature`, `Subscription`, `Payment` |
| Platform | `Notification`, `SupportTicket`, `AppSetting`, `ContentSection` |

### Soft delete

Many entities use `deletedAt` via `common/utils/soft-delete.util.ts` (`notDeleted` filter).

### Order management (recent)

- `ButcherOrder.orderNumber`: `ORD-YYYY-######` from `OrderNumberSequence`.
- Inventory: `ButcherProduct.availableQuantity`, `reservedQuantity`.
- All status changes via `OrderLifecycleService` only.

---

## 9. Notification Architecture

| Channel | Implementation | When |
|---------|----------------|------|
| Database | `Notification` model + REST `GET /api/notifications` | Most events via `AppNotificationsService` |
| Push (FCM) | `PushProcessor` + Firebase Admin | After DB persist if `User.fcmToken` set |
| Socket | `chat:notification` only | New DM to receiver |
| Email | `EmailProcessor` | welcome, fee_reminder, order_update, subscription_renew, email_verification templates |

**Mobile push setup:** `app/lib/notifications.ts` — Expo Notifications, FCM token synced via `PUT /api/users/:id` `{ fcmToken }`.

**No general `notification:new` socket event** — clients poll REST or use push.

---

## 10. Background Workers & Cron

**Worker entry:** `queue/worker.main.ts` bootstraps `WorkerModule`.

**Cron:** `queue/services/worker-cron.service.ts` — `setInterval` hourly (not Nest `@Cron`):

| Job | Schedule | Action |
|-----|----------|--------|
| Fee check | 09:00 daily | Enqueue overdue `fee-checks` jobs |
| DB cleanup | 03:00 daily | `POST /api/admin/cleanup` with `x-cron-secret` |
| Subscription maintenance | 06:00 daily | Enqueue `expire` + `reminders` |
| Live minutes reset | Monday 04:00 | Enqueue `reset_live_minutes` |

Uses Redis distributed locks (`cron:*:lock`).

---

## 11. Mobile State Management

**No Redux. No React Query.**

| Layer | Implementation |
|-------|----------------|
| Auth | `AuthContext` |
| Feed data | `AppContext` (posts, listings, me) |
| Subscription | `SubscriptionContext` |
| Theme | `ThemeContext` |
| Feature hooks | `useState`/`useEffect`/`useCallback` wrappers |

---

## 12. Deployment Architecture

### Environment variables (key)

| Var | Used by |
|-----|---------|
| `DATABASE_URL` | Prisma |
| `REDIS_URL` / `REDIS_ENABLED` | Cache, queues, sockets |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Auth |
| `PORT`, `SOCKET_PORT` | API, Socket |
| `FIREBASE_*` | Push notifications |
| `TWILIO_*` | OTP |
| Network International vars | Payments webhook + checkout |
| `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SOCKET_URL` | Mobile |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL` | Admin |

### Static files

- `main.ts` serves `uploads/` at `/uploads`.
- Admin proxies `/api/*` → backend via `next.config.mjs` rewrites.

### Health

- `GET /api/health` — checks DB, Redis cache, Redis session, queue job counts.
- Returns `200 ok` or `503 degraded`.

---

## 13. Security Summary

| Layer | Mechanism |
|-------|-----------|
| Authentication | JWT Bearer globally (`JwtAuthGuard`) except `@Public` |
| Authorization | `@Roles('ADMIN','MODERATOR')`, ownership checks in services |
| Rate limiting | Global `RateLimitGuard` + per-route `@RateLimit()` |
| Token revocation | Redis blacklist + session deletion |
| Payment webhooks | HMAC SHA256 signature verification |
| Order concurrency | `SELECT ... FOR UPDATE` in `OrderLifecycleService` |
| Admin edge | Cookie presence only (no role check in middleware) |

---

## 14. Known Gaps (from code audit)

| Item | Status |
|------|--------|
| Dedicated search API (full-text) | **Missing** — only `GET /search/trending` |
| Image processing queue | **Stub** — no actual processing |
| General notification socket push | **Missing** |
| Dedicated analytics module | **Missing** — butcher stats + plan permission flag only |
| Admin order status mutation | **Missing** — read-only in admin UI |
| `POST /butchers` register endpoint | Calls `registerButcher()` with no return — legacy/disabled pattern |
| App ESLint toolchain | Environment dependency issues (not architecture) |

---

## 15. Related Documentation

See `docs/FEATURE_INDEX.md` for per-feature deep dives and `docs/*.md` for individual feature documentation.



---

# FILE: FEATURE_INDEX.md


# SAFAT Platform — Feature Index

> Evidence-based index. Main files and APIs are from actual codebase paths.  
> Production readiness scores reflect implementation completeness as of 2026-07-07.

---

## Core Platform

| Feature | Doc | Description | Main Backend Files | Main Frontend Files | DB Models | Production |
|---------|-----|-------------|-------------------|---------------------|-----------|------------|
| System Architecture | [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) | Full platform overview | `backend-nest/src/` | `app/`, `admin-panel/` | All | 90% |
| Authentication | [auth.md](./auth.md) | Login, OTP, JWT, refresh, Google | `auth/` | `contexts/AuthContext.tsx`, `app/auth/*` | `User`, `UserSession` | 92% |
| Users & Profile | [users.md](./users.md) | Profiles, update, delete | `users/` | `app/users/[id].tsx`, `profile/edit.tsx` | `User` | 88% |
| Follow System | [follow.md](./follow.md) | Follow/unfollow users | `users/services/users.service.ts` | `profile/connections.tsx` | `Follow` | 90% |
| Connections | [connections.md](./connections.md) | List followers/following | `users/` | `profile/connections.tsx` | `Follow` | 90% |
| Roles & Permissions | [roles-permissions.md](./roles-permissions.md) | USER, ADMIN, MODERATOR, plan gates | `auth/guards/`, `plans/` | `SubscriptionContext` | `User.role`, `PlanFeature` | 85% |

---

## Social & Content

| Feature | Doc | Description | Main APIs | DB Models | Production |
|---------|-----|-------------|-----------|-----------|------------|
| Posts | [posts.md](./posts.md) | Feed, likes, reposts, comments | `GET/POST /api/posts` | `Post`, `PostLike`, `PostRepost`, `PostComment` | 88% |
| Stories | [stories.md](./stories.md) | User ephemeral stories | `GET/POST /api/stories/*` | `Story`, `StoryView`, `StoryReaction` | 87% |
| Story Viewer | [story-viewer.md](./story-viewer.md) | View tracking, reactions, replies | `POST /api/stories/:id/view` | `StoryView` | 85% |
| Story Expiration | [story-expiration.md](./story-expiration.md) | TTL-based story expiry | Stories service | `Story.expiresAt` | 88% |
| Butcher Stories | [butcher-stories.md](./butcher-stories.md) | Butcher shop stories | `GET/POST /api/butchers/stories` | `ButcherStory` | 85% |

---

## Marketplace

| Feature | Doc | Description | Main APIs | DB Models | Production |
|---------|-----|-------------|-----------|-----------|------------|
| Listings | [listings.md](./listings.md) | Livestock marketplace ads | `GET/POST /api/listings` | `Listing` | 88% |
| Featured Listings | [featured-listings.md](./featured-listings.md) | Plan-gated featured ads | Listings + subscription entitlement | `Listing.featured` | 82% |
| Pinned Listings | [pinned-listings.md](./pinned-listings.md) | Plan-gated pinned ads | Listings + subscription entitlement | `Listing.pinned` | 82% |
| Search | [search.md](./search.md) | Client-side + trending API | `GET /api/search/trending`, `GET /api/users?search=` | — | 70% |
| Fees & Commissions | [fees.md](./fees.md), [commissions.md](./commissions.md) | Listing commission rules | `GET /api/fees/rules` | `ListingFee` | 78% |

---

## Butchers & Orders

| Feature | Doc | Description | Main APIs | DB Models | Production |
|---------|-----|-------------|-----------|-----------|------------|
| Butchers | [butchers.md](./butchers.md) | Shop profiles, discovery | `GET /api/butchers` | `Butcher` | 90% |
| Butcher Products | [butcher-products.md](./butcher-products.md) | Product catalog + inventory | `POST /api/butchers/products` | `ButcherProduct` | 91% |
| Butcher Offers | [butcher-offers.md](./butcher-offers.md) | Promotional offers | `POST /api/butchers/offers` | `ButcherOffer` | 85% |
| Orders | [orders.md](./orders.md) | Order lifecycle, inventory | `POST/PUT /api/butchers/orders` | `ButcherOrder`, `OrderTimeline`, `OrderStatusAudit` | 91% |
| Reviews | [reviews.md](./reviews.md) | Butcher reviews | `POST /api/butchers/:id/reviews` | `ButcherReview` | 85% |
| Butcher Applications | [butcher-applications.md](./butcher-applications.md) | Onboarding workflow | `POST /api/butcher-applications` | `ButcherApplication` | 88% |
| Analytics Dashboard | [analytics.md](./analytics.md) | Butcher stats (plan-gated) | `GET /api/butchers/stats` | Aggregations | 75% |

---

## Billing

| Feature | Doc | Description | Main APIs | DB Models | Production |
|---------|-----|-------------|-----------|-----------|------------|
| Plans | [plans.md](./plans.md) | Subscription plan catalog | `GET /api/plans`, `admin/plans` | `Plan`, `PlanFeature` | 90% |
| Subscriptions | [subscriptions.md](./subscriptions.md) | Entitlements, usage limits | `GET /api/subscriptions` | `Subscription` | 88% |
| Subscription Lifecycle | [subscription-lifecycle.md](./subscription-lifecycle.md) | Activate, expire, renew, downgrade | `subscriptions/services/subscription-lifecycle.service.ts` | `Subscription` | 87% |
| Payments | [payments.md](./payments.md) | NI checkout initiation | `POST /api/payments/initiate` | `Payment` | 88% |
| Payment Webhooks | [payment-webhooks.md](./payment-webhooks.md) | NI webhook fulfillment | `POST /api/payments/webhook` | `Payment` | 88% |
| Refunds | [refunds.md](./refunds.md) | Payment refund handling | `payments.repository.ts` | `Payment.status=refunded` | 75% |

---

## Realtime & Communication

| Feature | Doc | Description | Main APIs / Events | Production |
|---------|-----|-------------|-------------------|------------|
| Chat / Messages | [chat.md](./chat.md), [messages.md](./messages.md) | Direct messages REST + socket | `GET/POST /api/messages`, `chat:*` events | 85% |
| Livestreams | [livestreams.md](./livestreams.md) | Agora live broadcast | `GET/POST /api/livestreams` | 86% |
| Agora | [agora.md](./agora.md) | RTC token generation | `shared/lib/agora.ts` | 85% |
| Live Comments | [live-comments.md](./live-comments.md) | Stream chat | `live:comment` socket | 86% |
| Live Likes | [live-likes.md](./live-likes.md) | Stream likes | `live:like` socket | 86% |
| Socket.IO | [socket.md](./socket.md) | Realtime gateway | Port 3002 | 90% |
| Notifications | [notifications.md](./notifications.md) | In-app inbox | `GET /api/notifications` | 88% |
| Push Notifications | [push-notifications.md](./push-notifications.md) | FCM via Firebase | `PushProcessor` | 87% |

---

## Admin & Platform

| Feature | Doc | Description | Main APIs | Production |
|---------|-----|-------------|-----------|------------|
| Admin Dashboard | [admin.md](./admin.md) | Staff moderation panel | `GET /api/admin/*` | 90% |
| Reports | [reports.md](./reports.md) | Support tickets | `GET /api/admin/reports` | 85% |
| Settings | [settings.md](./settings.md) | App feature flags | `GET/PUT /api/admin/settings` | 85% |
| Content CMS | [content.md](./content.md) | Terms, privacy sections | `GET/POST /api/admin/sections` | 82% |
| Moderation | [moderation.md](./moderation.md) | Hide posts, suspend listings | Admin PATCH/DELETE | 85% |
| Uploads | [uploads.md](./uploads.md) | Image presign + direct upload | `POST /api/upload/*` | 85% |
| Health Checks | [health.md](./health.md) | Liveness / dependency checks | `GET /api/health` | 95% |

---

## Infrastructure

| Feature | Doc | Description | Main Files | Production |
|---------|-----|-------------|------------|------------|
| Redis | [redis.md](./redis.md) | Cache, sessions, rate limit, adapter | `redis/` | 92% |
| BullMQ | [bullmq.md](./bullmq.md) | Background job queues | `queue/` | 88% |
| Cron Jobs | [cron.md](./cron.md) | Scheduled maintenance | `worker-cron.service.ts` | 85% |
| Firebase | [firebase.md](./firebase.md) | FCM push only | `push.processor.ts` | 87% |
| Image Processing | [image-processing.md](./image-processing.md) | Queue stub | `image-processing.processor.ts` | 20% |

---

## Dependency Graph (simplified)

```
Auth ──► all protected APIs
Plans ──► Subscriptions ──► Listings/Live/Featured limits
Payments ──► Subscriptions (activate)
Payments ──► ListingFee (fee payment)
Butchers ──► Orders ──► OrderLifecycle ──► Notifications + Sockets + Inventory
ButcherApplications ──► Butcher profile creation
Upload ──► Posts, Listings, Stories, Applications
Redis ──► Cache, RateLimit, BullMQ, Socket adapter, Blacklist
BullMQ ──► Notifications, Push, Email, Fees, Subscriptions
```

---

## Documentation Conventions

Each `docs/*.md` file follows this structure:

1. Business purpose  
2. Frontend flow  
3. API flow  
4. Backend flow (Controller → Service → Repository → Prisma)  
5. Database  
6. Socket  
7. Notifications  
8. Redis  
9. BullMQ  
10. Security  
11. Possible bugs / risks  
12. Production readiness score  

**State management note:** Mobile app uses React Context, not Redux or React Query (verified absent from `app/package.json`).



---

# FILE: admin.md


# Admin API & Panel

## 1. Business Purpose

Staff dashboard for moderating users, content, butcher shops, applications, orders, plans, CMS sections, and system settings.

**Who uses it:** `ADMIN` and `MODERATOR` roles via `admin-panel/` (Next.js). Some endpoints are `ADMIN`-only.

---

## 2. Frontend Flow

### Admin panel (`admin-panel/`)

| Page | Path | API |
|------|------|-----|
| Dashboard | `(dashboard)/page.tsx` | `GET /admin/dashboard/stats` |
| Users | `users/page.tsx`, `users/[id]/page.tsx` | users CRUD |
| Posts | `posts/page.tsx` | hide/delete posts |
| Listings | `listings/page.tsx` | suspend listings |
| Reports | `reports/page.tsx`, `reports/[id]/page.tsx` | support tickets |
| Live | `live/page.tsx` | stop/delete streams |
| Butchers | `butchers/page.tsx` | butcher management |
| Applications | `applications/page.tsx` | approve/reject butcher apps |
| Orders | `orders/page.tsx`, `orders/[id]/page.tsx` | order oversight |
| Plans | `plans/page.tsx`, `plans/[id]/page.tsx` | `admin/plans` controller |
| Content | `content/page.tsx` | CMS sections |
| Settings | `settings/page.tsx` | `AppSetting` (ADMIN only) |
| Login | `login/page.tsx` | `POST /admin/auth/login` |

**Nav:** `components/layout/Sidebar.tsx`

**Auth:** `admin_access_token` + cookie; `middleware.ts` checks cookie presence.

**Services:** `services/admin.service.ts`, `services/auth.service.ts`, `services/api.client.ts`

---

## 3. API Flow

Base: `/api/admin` — `admin.controller.ts`  
Plans (separate): `/api/admin/plans` — `admin-plans.controller.ts`

### Auth

| Method | URL | Roles | Notes |
|--------|-----|-------|-------|
| POST | `/admin/auth/login` | Public | Rate limit `auth` |
| GET | `/admin/auth/me` | ADMIN, MODERATOR | |

### Dashboard

| GET | `/admin/dashboard/stats` | ADMIN, MODERATOR |

### Users

| GET | `/admin/users` | List (pagination, search) |
| GET | `/admin/users/:id` | Detail |
| PATCH | `/admin/users/:id` | `isActive`, `verified`, `role` |
| DELETE | `/admin/users/:id` | **ADMIN only** — soft purge |

### Posts

| GET | `/admin/posts` | Query `hidden=true\|false` |
| PATCH | `/admin/posts/:id` | `{ isHidden: boolean }` |
| DELETE | `/admin/posts/:id` | Soft delete + `isHidden: true` |

### Listings

| GET | `/admin/listings` | Query `status` |
| PATCH | `/admin/listings/:id` | `{ status }` incl. `suspended` |
| DELETE | `/admin/listings/:id` | Soft delete + `suspended` |

### Reports (SupportTicket)

| GET | `/admin/reports` | List |
| GET | `/admin/reports/:id` | Detail |
| PATCH | `/admin/reports/:id` | status, priority, adminNotes |
| DELETE | `/admin/reports/:id` | Soft delete |

### Livestreams

| GET | `/admin/livestreams` | List |
| POST | `/admin/livestreams/:id` | Stop stream |
| DELETE | `/admin/livestreams/:id` | Soft delete |

### Butchers & orders

| GET | `/admin/butchers` | List |
| GET | `/admin/butchers/:id` | Detail + user |
| PATCH | `/admin/butchers/:id` | `type`, `isOpen` |
| GET | `/admin/orders` | Filters: status, butcherId, customerId, dates |
| GET | `/admin/orders/:id` | Detail |

### Settings (ADMIN only)

| GET | `/admin/settings` | All `AppSetting` rows |
| PUT | `/admin/settings` | Upsert by `key` |

### Content sections

| GET | `/admin/sections` | List CMS sections |
| POST | `/admin/sections` | Create |
| PATCH | `/admin/sections/:id` | Update |
| DELETE | `/admin/sections/:id` | Soft delete |

### Butcher applications

| GET | `/admin/butcher-applications` | List |
| GET | `/admin/butcher-applications/:id` | Detail |
| POST | `/admin/butcher-applications/:id/approve` | Create butcher profile |
| POST | `/admin/butcher-applications/:id/reject` | Reject with reason |
| POST | `/admin/butcher-applications/:id/comment` | Staff timeline comment |

### Maintenance

| POST | `/admin/cleanup` | Public with `x-cron-secret` or staff JWT |

### Plans (`admin-plans.controller.ts`)

| GET/POST/PATCH/DELETE | `/admin/plans/*` | Plan catalog + features |

---

## 4. Backend Flow

```
AdminController → AdminService → AdminRepository (Prisma)
Butcher applications → ButcherApplicationAdminService (separate module)
Plans → AdminPlansController → Plans module
```

Staff login validates `role IN (ADMIN, MODERATOR)` and issues JWT like mobile auth.

---

## 5. Database

Touches: `User`, `Post`, `Listing`, `SupportTicket`, `LiveStream`, `Butcher`, `ButcherOrder`, `AppSetting`, `ContentSection`, `ButcherApplication`, and related entities.

---

## 6. Socket

`useAdminOrderSocket` listens for `order:updated` on admin panel (optional).

---

## 7. Notifications

Admin actions trigger butcher-application notifications via `ButcherApplicationNotificationsService`. Other admin actions do not auto-notify users in all cases.

---

## 8. Redis

Session blacklist checked on `adminMe`. No admin-specific cache.

---

## 9. BullMQ

`POST /admin/cleanup` triggered by worker cron — not enqueued via BullMQ.

---

## 10. Security

- `@Roles('ADMIN' | 'MODERATOR')` + `RolesGuard`
- Delete user: ADMIN only
- Settings: ADMIN only
- Cleanup: `CRON_SECRET` header or Bearer staff token
- Admin panel middleware: cookie-only (does not re-validate JWT server-side per request)

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| Moderator can approve butcher apps | Same role as ADMIN on application endpoints |
| No audit log table | Timeline on applications only |
| Panel middleware weak | Cookie presence only |

---

## 12. Production Readiness: **87%**

Broad admin surface is implemented. Gaps: stricter moderator RBAC, audit trail, public ticket creation API missing.

**Main files:** `backend-nest/src/admin/`, `admin-panel/src/app/(dashboard)/`



---

# FILE: agora.md


# Agora RTC Tokens

## 1. Business Purpose

Agora provides realtime audio/video transport for livestreams. The backend generates **short-lived RTC tokens** so hosts can publish and viewers can subscribe without exposing the App Certificate to clients. Channel names and UIDs are derived deterministically from stream and user IDs.

**Who uses it:**
- **LivestreamsService** — issues tokens on stream create (host) and viewer join (token action)
- **Mobile app** — `useLiveStream` + `AgoraVideoView` consume tokens passed from API or route params

---

## 2. Frontend Flow

| Component | File | Role |
|-----------|------|------|
| Agora hook | `app/hooks/useLiveStream.ts` | Join channel, publish/subscribe, token renewal |
| Video view | `app/components/live/AgoraVideoView.tsx` | Renders local/remote video |
| Platform SDK | `app/lib/agora.ts` / `app/lib/agora.web.ts` | Native vs web Agora module loader |
| Host | `app/app/live/broadcast.tsx` | Params from `live/create.tsx` after `POST /api/livestreams` |
| Viewer | `app/app/live/watch/[id].tsx` | `GET /api/livestreams/:id?action=token` |

### Token usage

**Host** receives from create stream API:
- `agoraAppId`, `agoraChannel`, `agoraToken`, `agoraUid`

**Viewer** receives from token endpoint; refreshes on `onTokenWillExpire` in `useLiveStream`.

Channel join via `getAgoraModule()` — **requires development build** (not Expo Go).

---

## 3. API Flow

Tokens are not a standalone route; they are returned embedded in livestream endpoints:

| Call | Token role | Generator |
|------|------------|-----------|
| `POST /api/livestreams` | Host (publisher) | `generateHostToken(stream.id, user.userId)` |
| `GET /api/livestreams/:id?action=token` | Viewer (subscriber) | `generateViewerToken(id, user.userId)` |

Response fields: `agoraAppId` (from env), `agoraChannel`, `agoraToken`, `agoraUid`, viewer also `expiresIn: 7200`.

---

## 4. Backend Flow

**Source:** `backend-nest/src/shared/lib/agora.ts`

```
getAgoraConfig()
  → validate AGORA_APP_ID (exactly 32 chars)
  → validate AGORA_APP_CERTIFICATE (min 32 chars)

streamIdToChannel(streamId)
  → streamId.replace(/-/g, '')  // hex channel, max 64 chars

uidFromUserId(userId)
  → FNV-1a style hash → uint32, non-zero

generateHostToken(streamId, userId)
  → RtcRole.PUBLISHER, expire 4 hours (HOST_TOKEN_EXPIRE)

generateViewerToken(streamId, userId)
  → RtcRole.SUBSCRIBER, expire 2 hours (VIEWER_TOKEN_EXPIRE)

buildToken()
  → RtcTokenBuilder.buildTokenWithUid(appId, certificate, channel, uid, role, expire, expire)
```

Package: `agora-token` (`RtcTokenBuilder`, `RtcRole`).

**Called from:** `backend-nest/src/livestreams/livestreams.service.ts` in `createStream` and `getViewerToken`.

---

## 5. Database

Agora tokens are **not stored** in the database. Only `LiveStream` records reference `streamId` used as channel input.

Persistence: stream metadata, comments, viewer/like counts — separate from token lifecycle.

---

## 6. Socket

Agora handles media transport; **signaling** for comments/viewers uses Socket.IO (`live:*` events), not Agora signaling.

No Agora-specific socket events.

---

## 7. Notifications

None from Agora module. Stream start notifications are sent by `LivestreamsService.notifyFollowers` independently.

---

## 8. Redis

Agora token generation does not use Redis.

Live stream **list** cache uses Redis (15s) — unrelated to tokens.

---

## 9. BullMQ

No Agora-related BullMQ jobs.

---

## 10. Security

- **App Certificate** only on server (`AGORA_APP_CERTIFICATE` env).
- Clients receive time-limited tokens only.
- Host tokens: publisher role, 4h expiry.
- Viewer tokens: subscriber role, 2h expiry; endpoint requires JWT and live stream.
- UID deterministic per user — stable across reconnects for same user.
- Channel name derived from stream UUID — unguessable without stream id.

**Required env:**
- `AGORA_APP_ID` (32 characters)
- `AGORA_APP_CERTIFICATE`

---

## 11. Possible Bugs

1. **Expiry mismatch** — viewer API returns `expiresIn: 7200` (2h) matching code; host 4h not exposed in API metadata for client renewal (host may need manual re-create).
2. **UID collision** — hash to uint32 has theoretical collision risk (low).
3. **Channel name** — stripping hyphens only; assumes UUID format.
4. **Throws on misconfig** — `getAgoraConfig()` throws at token build time; surfaces as 500 on stream create.
5. **Duplicate lib** — `app/lib/agora.ts` is client SDK wrapper; do not confuse with `backend-nest/src/shared/lib/agora.ts` server token generator.

---

## 12. Production Readiness (%)

**90%**

Official `agora-token` builder, role separation, env validation, and integration with livestream flows are production-standard. Ensure certificate rotation process and host token renewal UX for streams longer than 4 hours.



---

# FILE: analytics.md


# Butcher Analytics

## 1. Business Purpose

Butcher shop owners view revenue, orders, and product performance over selectable periods. Plan feature `analyticsDashboard` exists in subscription catalog but is **not enforced** on the stats API in current code.

**There is no separate `analytics` Nest module.**

---

## 2. Frontend Flow

### Mobile

| Screen | Path |
|--------|------|
| Analytics dashboard | `app/butchers/dashboard.tsx` |

**Hooks:** `useButcherStats` → `GET /api/butchers/stats?period=`, `useRequireApprovedButcher` (approved application gate — **not** plan feature gate)

**Periods:** `week`, `month`, `year` (validated server-side)

**UI:** Revenue chart, order counts, top products, completion rate, trends vs previous period.

---

## 3. API Flow

| Method | URL | Auth |
|--------|-----|------|
| GET | `/api/butchers/stats` | JWT |

**Query:** `period` — `week` \| `month` \| `year` (default `month`)

**Response highlights:** `revenue`, `orders`, `profileViews`, `completionRate`, `avgOrderValue`, `newCustomers`, `dailyRevenue[]`, `topProducts[]`, `trends`, `reviews`, `butcher` summary.

---

## 4. Backend Flow

```
ButchersController.stats
  → ButchersService.getStats(user, period)
    → findButcherForStats(userId) — 404 if no butcher
    → findOrdersInRange (current + previous period)
    → Aggregate revenue, products, trends
```

**Plan check:** **Missing** — `PlanPermissionService.hasAnalyticsDashboard()` is not called in `getStats`.

**Feature catalog:** `analyticsDashboard` boolean on paid butcher plans in `seed-plans.ts`.

---

## 5. Database

Reads `Butcher`, `ButcherOrder`, `ButcherProduct` (via order relations). No analytics tables or events warehouse.

---

## 6. Socket

Not used.

---

## 7. Notifications

Not used for analytics.

---

## 8. Redis

No stats caching.

---

## 9. BullMQ

Not used.

---

## 10. Security

- Requires JWT and linked butcher profile
- Any approved butcher can call API regardless of subscription tier (current behavior)
- Returns aggregated shop data only for owning user’s butcher

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| **Plan entitlement not enforced** | `hasAnalyticsDashboard` unused in butchers.service |
| `profileViews` trend always null | Returned as `null` in trends object |
| No export/CSV | Not implemented |
| Heavy queries on large order history | No pagination on stats computation |

---

## 12. Production Readiness: **70%**

Useful stats endpoint exists. **Missing:** `analyticsDashboard` enforcement, dedicated analytics module, caching.

**Main files:** `backend-nest/src/butchers/butchers.controller.ts`, `butchers.service.ts` (`getStats`), `app/butchers/dashboard.tsx`



---

# FILE: auth.md


# Authentication

## 1. Business Purpose

Authentication lets users and staff securely access the platform. It supports:

- **Customers / butchers (mobile):** Phone OTP, password login, Google OAuth, registration, password reset.
- **Admin / moderators (web):** Separate admin login (`POST /admin/auth/login`).

**Who uses it:** All authenticated users (`User` role `USER`, `ADMIN`, `MODERATOR`). Guests can access `@Public` endpoints only.

---

## 2. Frontend Flow

### Mobile (`app/`)

| Screen | Path | Trigger |
|--------|------|---------|
| Phone entry | `app/auth/phone.tsx` | User enters phone |
| OTP | `app/auth/otp.tsx` | After send-otp |
| Register | `app/auth/register.tsx` | New user after OTP |
| Forgot password | `app/auth/forgot-password.tsx` | Reset flow |

**State:** `contexts/AuthContext.tsx` — no Redux, no React Query.

**Flow:**
1. `sendOtp(phone)` → `POST /api/auth/send-otp`
2. `verifyOtp(code)` → `POST /api/auth/verify-otp` → returns `phone_token` or full tokens
3. Register: `register()` with `phone_token` → `POST /api/auth/register`
4. Login: `login(username, password)` → `POST /api/auth/login`
5. Tokens stored in AsyncStorage; `authFetch` (`services/authFetch.ts`) attaches Bearer + auto-refresh on 401

**Sockets:** Not used for auth.

**Errors:** Alert dialogs in auth screens; 401 triggers refresh or logout.

### Admin (`admin-panel/`)

| Screen | Path |
|--------|------|
| Login | `src/app/login/page.tsx` |

Flow: `adminLogin()` → persist `admin_access_token` + cookie → redirect `/`.

---

## 3. API Flow

Base: `/api/auth/*` — `auth.controller.ts`

| Method | URL | Auth | Rate limit |
|--------|-----|------|------------|
| POST | `/auth/login` | Public | `auth` (5/15min) |
| POST | `/auth/register` | Public | `auth` |
| POST | `/auth/refresh` | Public | `auth` |
| POST | `/auth/logout` | JWT | — |
| POST | `/auth/change-password` | JWT | `auth` |
| POST | `/auth/send-otp` | Public | `auth` |
| POST | `/auth/verify-otp` | Public | `auth` |
| POST | `/auth/google` | Public | `auth` |
| POST | `/auth/reset-password` | Public | `auth` |
| POST | `/auth/verify-email` | JWT | `auth` |
| POST | `/auth/resend-verification` | JWT | `auth` |

**Admin:** `POST /api/admin/auth/login` — `admin.controller.ts`

**Response envelope:** `{ success: true, data: { accessToken, refreshToken, user } }`

**Error codes:** `ApiException` — 400 validation, 401 unauthorized, 409 conflict, 429 rate limit.

---

## 4. Backend Flow

```
AuthController
  → AuthService
    → AuthRepository (User, UserSession CRUD)
    → JwtTokenService (sign/verify)
    → RedisSessionService (blacklist)
    → Twilio (OTP) when configured
```

**Login:** Validate credentials → `passwordVersion` in JWT → create `UserSession` → enforce max 5 sessions.

**Refresh:** Verify refresh JWT → rotate session → detect reuse → invalidate all sessions on theft.

**Logout:** Blacklist access token (Redis 15min TTL) → delete refresh session → `SocketDisconnectService.disconnectUser()`.

**OTP:** Twilio Verify API; dev fallback `123456` when Twilio env missing.

---

## 5. Database

| Model | Purpose |
|-------|---------|
| `User` | Credentials, `passwordHash`, `passwordVersion`, `role`, `fcmToken` |
| `UserSession` | `refreshToken`, `expiresAt`, `deviceInfo` |

Indexes: `User.username`, `User.email`, `User.phone` unique; `UserSession.userId`, `expiresAt`.

---

## 6. Socket

Auth does not use sockets directly. On logout/password change, `SocketDisconnectService` publishes `socket:disconnect` on Redis to force disconnect.

---

## 7. Notifications

- Welcome email via `EmailQueueService` on registration (if configured).
- Email verification codes in Redis (`email_verify:{userId}`).

No push on login.

---

## 8. Redis

| Key | DB | Purpose |
|-----|-----|---------|
| `blacklist:{token}` | 2 | Revoked access tokens |
| `email_verify:{userId}` | 2 | Email verification code |
| `email_verify_cooldown:{userId}` | 2 | Resend cooldown |

---

## 9. BullMQ

Auth does not enqueue jobs directly. Email verification/welcome may use `emails` queue indirectly.

---

## 10. Security

- Global `JwtAuthGuard` except `@Public`, `@OptionalAuth`
- `passwordVersion` invalidates tokens after password change
- Refresh token rotation + reuse detection
- Rate limit on auth endpoints (5/15min)
- OTP via Twilio (or dev static code)
- Admin login separate endpoint; backend validates staff role

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| Dev OTP `123456` when Twilio unset | `auth.service.ts` — must disable in production |
| Admin middleware only checks cookie presence | `admin-panel/src/middleware.ts` |
| `activeMode` USER/BUTCHER is client-only | Not enforced server-side as separate role |
| Session limit race on concurrent logins | Possible duplicate 6th session briefly |

---

## 12. Production Readiness: **92%**

Core JWT + OTP + refresh is production-grade. Gaps: admin edge middleware validation, ensure Twilio enabled in prod.

**Main files:** `backend-nest/src/auth/`, `app/contexts/AuthContext.tsx`, `admin-panel/src/services/auth.service.ts`



---

# FILE: bullmq.md


# BullMQ Job Queues

## 1. Business Purpose

Background workers process notifications, email, push, listing fee checks, subscription maintenance, and (stub) image processing without blocking HTTP requests.

**Who uses it:** Worker process (`queue/worker.main.ts`); producers in API and cron.

---

## 2. Frontend Flow

Not visible to users except via delayed effects (push, emails, fee overdue).

---

## 3. API Flow

No direct REST to enqueue jobs (except indirect domain actions).

---

## 4. Backend Flow

**Worker entry:** `backend-nest/src/queue/worker.main.ts` → `WorkerModule`

**Registration:** `queue.module.ts` — `BullModule.forRoot({ connection: QUEUE_CONNECTION })` where `db: 1`.

**Global producers:** `AppNotificationsService`, `EmailQueueService`, `PushQueueService`, `FeeCheckQueueService`, `ImageQueueService`, `SubscriptionQueueService`.

All queue services no-op when Redis disabled or queue injection null.

---

## 5. Database

Processors read/write PostgreSQL (`PrismaService`, repositories).

---

## 6. Socket

`OrderLifecycleService` emits sockets directly, not via queue.

---

## 7. Notifications

Primary path: `notifications` queue → persist → `push-notifications` queue.

---

## 8. Redis

Queue connection: Redis **DB 1** (`QUEUE_CONNECTION` in `queue/constants.ts`).

---

## 9. BullMQ Queues & Processors

| Queue name | Job names | Processor | Concurrency | Purpose |
|------------|-----------|-----------|-------------|---------|
| `notifications` | `create` | `NotificationProcessor` | 10 | Persist `Notification`, enqueue push |
| `push-notifications` | `send` | `PushProcessor` | 5 | FCM send |
| `emails` | `send` | `EmailProcessor` | 3 | SMTP via nodemailer |
| `fee-checks` | `check` | `FeeCheckProcessor` | 5 | Mark overdue listing fees |
| `subscriptions` | `expire`, `reminders`, `reset_live_minutes`, `auto_renew_attempt` | `SubscriptionProcessor` | 3 | Subscription lifecycle |
| `image-processing` | `process` | `ImageProcessingProcessor` | 2 | **Stub** — logs only |

**Default job options:** Varies per queue (`removeOnComplete`, `attempts: 2-3`, exponential backoff on subscriptions).

**Email templates:** `welcome`, `fee_reminder`, `order_update`, `subscription_renew`, `email_verification`.

**Fee check scheduling:** `FeeCheckQueueService.scheduleFeeCheck` with delay when listing created.

---

## 10. Security

- Workers run with full DB access — protect worker host
- SMTP and Firebase creds in env only
- No user-facing job injection endpoint

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| No jobs if Redis off | Entire notification pipeline skipped |
| `image-processing` never enqueued | `addImageProcessing` has no callers |
| Email fails silently if SMTP unset | Processor may throw at runtime |
| Duplicate cron on multiple workers | Mitigated by Redis locks in `WorkerCronService` |

---

## 12. Production Readiness: **85%**

Core queues are production-ready. Gaps: image queue unused, no dead-letter admin UI.

**Main files:** `backend-nest/src/queue/`



---

# FILE: butcher-applications.md


# Butcher Applications

## 1. Business Purpose

Onboarding flow for users applying to become verified butcher shops: draft → submit → staff review → approve (creates `Butcher`) or reject.

**Who uses it:** Mobile applicants; admin/moderator reviewers in admin panel and mobile admin flows.

---

## 2. Frontend Flow

### Mobile (`app/`)

| Screen | Path |
|--------|------|
| Apply / my application | `app/butchers/apply.tsx`, `my-application` |
| Edit draft | `app/butchers/application/edit/[id].tsx` |
| Admin review (mobile) | `app/butchers/application/[id].tsx` |

**Components:** `components/butcherApplication/*`

**Validation:** `lib/butcherApplicationValidation.ts`, `lib/butcherApplicationLabels.ts`

### Admin panel

| Screen | Path |
|--------|------|
| Applications list | `admin-panel/.../applications/page.tsx` |
| Review modal | `ApplicationReviewModal.tsx` |

---

## 3. API Flow

### User API — `/api/butcher-applications`

| Method | URL | Purpose |
|--------|-----|---------|
| GET | `/butcher-applications` | List own applications (cursor) |
| POST | `/butcher-applications` | Create **DRAFT** |
| GET | `/butcher-applications/:id` | Detail |
| PATCH | `/butcher-applications/:id` | Update draft (`If-Unmodified-Since`) |
| POST | `/butcher-applications/:id/documents` | Attach document metadata |
| PATCH | `/butcher-applications/:id/documents/:documentId` | Replace document |
| DELETE | `/butcher-applications/:id/documents/:documentId` | Remove document |
| POST | `/butcher-applications/:id/submit` | Submit for review |
| POST | `/butcher-applications/:id/withdraw` | Withdraw |

**Upload:** Presign folder `butcher-applications` via `/api/upload/presign`.

### Admin API — `/api/admin/butcher-applications`

| Method | URL |
|--------|-----|
| GET | `/admin/butcher-applications` |
| GET | `/admin/butcher-applications/:id` |
| POST | `/admin/butcher-applications/:id/approve` |
| POST | `/admin/butcher-applications/:id/reject` |
| POST | `/admin/butcher-applications/:id/comment` |

---

## 4. Backend Flow

### Status machine

`DRAFT` → `SUBMITTED` → `APPROVED` | `REJECTED` | `WITHDRAWN`

Helpers: `helpers/stateTransitions.ts`, `helpers/snapshotValidation.ts`, `helpers/timeline.ts`

### User path

```
ButcherApplicationsController
  → ButcherApplicationUserService (application.service.ts)
    → ApplicationRepository + TransactionService
    → ButcherApplicationNotificationsService (on submit/withdraw)
```

### Admin approve path

```
AdminController → AdminService → ButcherApplicationAdminService.approveApplication()
  Transaction:
    1. assertTransition → APPROVED
    2. assertUserHasNoButcher
    3. createButcher(buildButcherCreateInput(snapshot))
    4. approveUploadedDocuments
    5. updateApplicationStatus
    6. appendTimelineEvent
  → notifyApplicationApproved (if new)
```

**Reject:** Requires `rejectionReason`; timeline + notification.

**Idempotent approve:** If already approved with butcher, returns existing butcher.

---

## 5. Database

| Model | Purpose |
|-------|---------|
| `ButcherApplication` | Snapshot fields, status, timestamps |
| `ButcherApplicationDocument` | Uploaded file refs |
| `ButcherApplicationTimeline` | Audit trail (`CREATE`, `SUBMIT`, `APPROVE`, etc.) |
| `Butcher` | Created on approve (`sourceApplicationId`) |

---

## 6. Socket

Not used.

---

## 7. Notifications

`ButcherApplicationNotificationsService` → `AppNotificationsService` with `data.event`:
- `butcher_application_submitted` (to staff)
- `butcher_application_received` / `withdrawn`
- `butcher_application_approved` / `rejected`

Navigation in `app/lib/notifications.ts` handles `event` field.

---

## 8. Redis

Not used in application module.

---

## 9. BullMQ

Notifications enqueued via standard notification queue on state changes.

---

## 10. Security

- User endpoints scoped to owner (`assertApplicationOwner`)
- Optimistic concurrency via `If-Unmodified-Since`
- Admin endpoints: `@Roles(ADMIN, MODERATOR)`
- Document URLs validated against upload storage

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| Moderator can approve | Same roles as admin on approve endpoint |
| `Role.BUTCHER` in schema unused | Butcher access via `Butcher.userId` not JWT role |
| Concurrent draft creation | Transaction guards `ACTIVE_DRAFT_EXISTS` |

---

## 12. Production Readiness: **90%**

Full lifecycle with timeline and notifications. Gaps: finer RBAC on approve, no SLA metrics.

**Main files:** `backend-nest/src/butcher-applications/`, `admin-panel/.../applications/`



---

# FILE: butcher-offers.md


# Butcher Offers (Promotional Deals)

## 1. Business Purpose

Time-limited promotional offers for butcher shops: bilingual titles/descriptions, discount metadata, hero image, validity date, and country. Owners create and manage offers in the butcher dashboard; customers view active offers on the butcher profile **Offers** tab.

**Key files:** `backend-nest/src/butchers/butchers.controller.ts` (offers routes), `backend-nest/src/butchers/butchers.service.ts`, `backend-nest/src/butchers/repositories/butchers.repository.ts`, `app/app/butchers/[id].tsx` (`OffersTab`), `app/app/(butcher)/manage.tsx`.

---

## 2. Frontend Flow

### Customer — `app/app/butchers/[id].tsx`

- `OffersTab` renders offers from butcher detail payload (`GET /api/butchers/:id` includes `offers`)
- Empty state: "لا توجد عروض حالياً"
- Shows image, titles, prices, `validUntil`

### Owner — `app/app/(butcher)/manage.tsx`

- Offers section loads via authenticated `GET /api/butchers/offers` (own butcher only)
- Create/update/delete calls:
  - `POST /api/butchers/offers`
  - `PUT /api/butchers/offers/:id`
  - `DELETE /api/butchers/offers/:id`

(Exact form component names vary in manage screen; API paths match controller.)

**Public list:** No separate public `GET /butchers/:id/offers` — relies on embedded offers in butcher GET.

---

## 3. API Flow

| Method | Endpoint | Auth | Body |
|--------|----------|------|------|
| GET | `/api/butchers/offers` | JWT | — (resolves butcher from `user.userId`) |
| POST | `/api/butchers/offers` | JWT | `createOfferSchema` |
| PUT | `/api/butchers/offers/:id` | JWT | `updateOfferSchema` |
| DELETE | `/api/butchers/offers/:id` | JWT | — → `{ deleted: true }` |

**No** `GET /api/butchers/:butcherId/offers` for anonymous clients.

### `createOfferSchema` (Zod)

| Field | Validation |
|-------|------------|
| `titleAr`, `titleEn` | 2–100 chars |
| `descriptionAr`, `descriptionEn` | 2–500 chars |
| `discountPercent` | 0–100 optional |
| `originalPrice`, `offerPrice` | positive optional |
| `image` | URL required |
| `validUntil` | ISO datetime string |
| `country` | `countrySchema` |

---

## 4. Backend Flow

**listOffers(user):**

1. `findButcherIdByUser` — 404 if no profile
2. `findActiveOffers(butcher.id)` — repository filters valid/non-deleted

**createOffer:**

1. Resolve butcher from JWT user
2. Validate body
3. `createOffer({ butcherId, ... validUntil: new Date(...) })`
4. Invalidate Redis `butcher:{butcherId}`, `butcher:me`

**updateOffer / deleteOffer:**

- `findOwnedOffer(id, user.userId)` — ownership check
- Soft delete on remove (`softDeleteOffer`)
- Cache invalidation same as create

**Public profile:** `findButcherById` includes all `offers: true` (not only active) — **verify** repository filters expired offers on detail include.

---

## 5. Database

**Model:** `ButcherOffer` — `schema.prisma` (lines 572–592)

| Field | Type |
|-------|------|
| `butcherId` | FK → Butcher |
| `titleAr`, `titleEn` | String |
| `descriptionAr`, `descriptionEn` | String |
| `discountPercent` | Float? |
| `originalPrice`, `offerPrice` | Float? |
| `image` | String |
| `validUntil` | DateTime |
| `country` | Country |
| `deletedAt` | DateTime? soft delete |

Indexes: `butcherId`, `validUntil`, `deletedAt`.

---

## 6. Socket

**missing** — no push when new offer published or offer expires.

---

## 7. Notifications

**missing** — customers are not notified of new offers.

Butcher stories type `offer` is a separate feature (`ButcherStory`), not tied to `ButcherOffer` rows.

---

## 8. Redis

Invalidation on create/update/delete:

```
redis.cacheDel(`butcher:${butcherId}`)
redis.cacheDel('butcher:me')
```

**missing** dedicated offer cache keys; offers ride on butcher detail cache (300s for `me`).

---

## 9. BullMQ

**missing** — no scheduled job to expire offers or notify before `validUntil`.

Expiry must be enforced in queries (`findActiveOffers`) or client-side display only.

---

## 10. Security

| Control | Implementation |
|---------|----------------|
| List/create/update/delete | JWT + butcher ownership (`findOwnedOffer`) |
| Admin | Not explicit on offers — owner match via `userId` on butcher |
| Validation | Zod strict; image must be URL |
| Rate limiting | `@RateLimit('api')` |
| Public exposure | Only non-deleted offers on profile; auth required for owner list endpoint |

---

## 11. Possible Bugs

1. **Expired offers on profile** — `BUTCHER_DETAIL_INCLUDE` uses `offers: true` without `validUntil > now` filter; expired offers may still display.
2. **No public offers API** — third parties cannot fetch offers without full butcher detail.
3. **Discount fields optional** — schema allows all price fields null; UI may show incomplete pricing.
4. **Timezone** — `validUntil` parsed with `new Date(iso)`; client display depends on locale.
5. **Cache staleness** — after create, cached `butcher:me` cleared but public `findButcherById` cache only for `id=me` path — other users may see stale offers until TTL.

---

## 12. Production Readiness (with %)

**68%**

| Ready | Gap |
|-------|-----|
| Owner CRUD API + validation | Expired offer filtering inconsistent |
| Profile display tab | No customer notifications |
| Soft delete + ownership checks | No expiry automation (BullMQ) |
| Redis cache invalidation on write | No public read-optimized offers endpoint |



---

# FILE: butcher-products.md


# Butcher Products (Inventory CRUD)

## 1. Business Purpose

Butcher owners manage meat product catalog: names, categories, cuts, pricing (per-kg or fixed), images, stock flags, and **available quantity** (kg) used for order inventory. Customers see products on public butcher profile; owners manage via butcher dashboard.

**Key files:** `backend-nest/src/butchers/butchers.controller.ts` (products routes), `backend-nest/src/butchers/butchers.service.ts`, `backend-nest/src/butchers/lib/product-inventory.util.ts`, `app/app/(butcher)/manage.tsx` (`AddProductForm`).

---

## 2. Frontend Flow

### Owner — `app/app/(butcher)/manage.tsx`

**`AddProductForm` component** (lines ~79+):

| Field | UI | API field |
|-------|-----|-----------|
| Name | `nameAr` | `nameAr`, `nameEn` (duplicated from Arabic) |
| Category | chips from `CATEGORY_LABELS` | `category` (`MeatCategory`) |
| Price | per-kg OR fixed | `pricePerKg`, `priceFixed` |
| Quantity | **الكمية المتاحة (كغ)** | `availableQuantity` (optional float) |
| Cuts | multi-select | `availableCuts[]` |
| Freshness / stock | toggles | `freshness`, `inStock` |
| Images | up to 5, upload to `butchers` folder | `images[]` URLs |

**Save:**

- Create: `POST /api/butchers/products`
- Update: `PUT /api/butchers/products/:id`
- Uses raw `fetch` + `Authorization: Bearer` (not `authFetch`)

### Customer — `app/app/butchers/[id].tsx`

`ProductsTab` displays products from `GET /api/butchers/:id` embedded `products` array; order button respects `inStock`.

**Public product list endpoint:** `GET /api/butchers/products?butcherId=` exists but profile uses embedded products.

---

## 3. API Flow

| Method | Endpoint | Auth | Body / Query |
|--------|----------|------|--------------|
| GET | `/api/butchers/products` | JWT (controller default) | `?butcherId=` required |
| POST | `/api/butchers/products` | JWT | `createProductSchema` |
| PUT | `/api/butchers/products/:id` | JWT | `updateProductSchema` |
| DELETE | `/api/butchers/products/:id` | JWT | — → `{ deleted: true }` |

**Note:** `GET products` has no `@Public()` — unauthenticated clients cannot call it; public reads use butcher detail include.

### Create schema highlights (`createProductSchema`)

- `category`: `whole_livestock`, `lamb`, `beef`, `camel`, `chicken`, `goat`, `special_orders`
- `availableCuts`: min 1 string
- `availableQuantity`: optional number ≥ 0
- `images`: 0–5 URLs
- `country`: required on create

---

## 4. Backend Flow

**createProduct:**

1. `findButcherIdByUser(user.userId)` — 403 if no butcher profile
2. Zod validate body
3. `availableQuantity = resolveProductAvailableQuantity(parsed.data)`
4. `repo.createProduct({ ... butcherId })`

**`resolveProductAvailableQuantity`** (`product-inventory.util.ts`):

1. If `availableQuantity` provided and ≥ 0 → use it
2. Else fallback `weightMax` → `weightMin` → `0`

**updateProduct:**

- Owner or ADMIN
- Re-resolve quantity if `availableQuantity`, `weightMin`, or `weightMax` changed
- Invalidate `butcher:{butcherId}`, `butcher:me` Redis keys

**deleteProduct:** soft delete (`softDeleteProduct`)

**getProducts:** `findProducts(butcherId)` — no cache layer in service.

---

## 5. Database

**Model:** `ButcherProduct` — `schema.prisma` (lines 541–570)

| Field | Type | Notes |
|-------|------|-------|
| `availableQuantity` | Float | default 0 |
| `reservedQuantity` | Float | default 0; used by orders (order flow) |
| `inStock` | Boolean | default true |
| `pricePerKg`, `priceFixed` | Float? | Either pricing model |
| `availableCuts` | String[] | |
| `weightMin`, `weightMax` | Float? | Fallback for quantity |
| `deletedAt` | DateTime? | Soft delete |

**Relation:** `butcherId` → `Butcher`; `orderItems` → `ButcherOrder`.

Indexes: `butcherId`, `inStock`, `deletedAt`.

---

## 6. Socket

**missing** — stock/quantity changes are not pushed to clients viewing product list.

---

## 7. Notifications

**missing** for product CRUD (no alert to followers on new stock).

---

## 8. Redis

On **update** and **delete** only:

- `redis.cacheDel(\`butcher:${butcherId}\`)`
- `redis.cacheDel('butcher:me')`

**missing** cache invalidation on **create** in `createProduct` (stale butcher detail until TTL/update elsewhere).

---

## 9. BullMQ

**missing** — no async image processing or inventory sync jobs for products.

Order placement (separate feature) may reserve quantity via order services.

---

## 10. Security

| Control | Implementation |
|---------|----------------|
| Mutations | JWT + must own butcher profile |
| Admin override | `user.role === 'ADMIN'` on update/delete |
| Validation | Zod strict schemas; URL images |
| Public read | Via butcher profile OptionalAuth endpoint |
| GET `/products` | Effectively owner/tooling — requires auth on route |

---

## 11. Possible Bugs

1. **Create cache stale** — new product not invalidating `butcher:{id}` cache.
2. **Quantity fallback** — if owner leaves quantity empty and no weight range, quantity resolves to **0** → may block orders incorrectly.
3. **`nameEn` copied from Arabic** in mobile form — poor i18n/data quality.
4. **GET products auth** — public clients cannot refresh products without loading full butcher.
5. **`inStock` vs quantity** — UI can show "اطلب الآن" based on `inStock` only; quantity not shown on profile cards.
6. **Image optional on create** — schema allows 0 images; UX may allow save without images if not validated client-side.

---

## 12. Production Readiness (with %)

**73%**

| Ready | Gap |
|-------|-----|
| Full CRUD API + Zod validation | Create cache invalidation missing |
| Inventory quantity resolver | No real-time stock updates |
| Owner mobile form (`AddProductForm`) | Quantity/stock UX inconsistent on buyer side |
| Soft delete + authz | Reserved quantity logic lives in orders (must stay in sync) |



---

# FILE: butchers.md


# Butchers (Discovery & Profile)

## 1. Business Purpose

Butcher (ملحمة) profiles: discovery list with filters, public profile with products/offers/reviews/stories, profile view analytics, and subscription-verified badge. Registration is application-based — `POST /api/butchers` is blocked in favor of butcher application flow.

**Key files:** `backend-nest/src/butchers/butchers.controller.ts`, `backend-nest/src/butchers/butchers.service.ts`, `app/app/butchers/index.tsx`, `app/app/butchers/[id].tsx`.

---

## 2. Frontend Flow

### Discovery — `app/app/butchers/index.tsx`

| Feature | Implementation |
|---------|----------------|
| List | `GET /api/butchers` → maps `json.data.butchers` |
| Filters | Client-side: country, search text, verified-only (`subscriptionActive`) |
| Sort | `rankButchers()` client helper after fetch |
| Stories row | `GET /api/butchers/stories` — butcher story rings (separate from user stories) |
| Card tap | `router.push(/butchers/[id])` |

### Profile — `app/app/butchers/[id].tsx`

| Feature | Implementation |
|---------|----------------|
| Load | `GET /api/butchers/:id` — includes `products`, `offers`, `reviews` (embedded) |
| Tabs | `products`, `offers`, `stories`, `about`, `chat` |
| Stories tab | Also fetches `GET /api/butchers/stories` |
| Order CTA | Navigates to order flow with selected product |
| Reviews display | `ReviewsStrip` from embedded `b.reviews` on butcher payload |

**Auth:** Optional `Authorization` header when `accessToken` present.

---

## 3. API Flow

Controller: `ButchersController` — prefix `/api/butchers`

| Method | Endpoint | Auth | Notes |
|--------|----------|------|-------|
| GET | `/butchers` | OptionalAuth | Query: `cursor`, `country`, `verified`, `search`, `isOpen` → `{ butchers, nextCursor, hasMore }` |
| GET | `/butchers/:id` | OptionalAuth | Detail with products, offers, reviews; `id=me` for owner |
| PUT | `/butchers/:id` | JWT | Update profile (`updateButcherSchema`) |
| POST | `/butchers` | JWT | **Always 403** `application_required` |
| GET | `/butchers/stories` | Public | Active butcher stories |
| GET | `/butchers/stats` | JWT | Owner analytics |
| GET | `/butchers/:id/reviews` | OptionalAuth | Review list (separate from embedded reviews) |

**List page size:** 20 (`PAGE_SIZE` in service).

---

## 4. Backend Flow

**listButchers:**

1. Cache key `butchers:v2:{filters}` when no search (TTL 180s via `RedisService.cacheSet`)
2. `findManyButchers` — order: `subscriptionActive desc`, `rating desc`, `activityScore desc`
3. Filters: country, `subscriptionActive` (verified), `isOpen`, text search (≥2 chars) on name/city fields
4. Cursor pagination

**getButcher:**

- `id !== 'me'`: verify exists; increment `profileViews` if viewer ≠ owner
- `id === 'me'`: requires JWT; cache `butcher:me` / `butcher:{id}` 300s
- `findButcherById` / `findButcherByUserId` with `BUTCHER_DETAIL_INCLUDE` (products, offers, reviews×10, user)

**registerButcher:** throws `application_required` — use `butcher-applications` module instead.

---

## 5. Database

**Model:** `Butcher` — `backend-nest/prisma/schema.prisma` (~490–539)

| Field | Purpose |
|-------|---------|
| `userId` | Link to `User` |
| `nameAr`, `nameEn`, `logo`, `cover` | Branding |
| `rating`, `reviewCount` | Aggregated from `ButcherReview` |
| `subscriptionActive` | Verified badge in UI |
| `isOpen`, `openTime`, `closeTime`, `closedDays` | Hours |
| `lat`, `lng`, `address`, `city`, `country` | Location |
| `profileViews`, `activityScore` | Discovery ranking |

**Relations:** `products`, `offers`, `reviews`, `orders`, `stories`.

**List include:** `user`, `_count.products`, `_count.orders`.

---

## 6. Socket

**missing** for butcher discovery/profile (open/closed status, new products, etc.).

Order flow may use sockets elsewhere — not in butcher list/profile screens.

---

## 7. Notifications

**missing** in butcher list/get flows.

Butcher application approval and orders use other modules.

Story create under butcher path does not notify followers in `ButchersService.createStory` (unlike user stories reactions).

---

## 8. Redis

`RedisService` in `ButchersService`:

| Key | TTL | When |
|-----|-----|------|
| `butchers:v2:{filters}` | 180s | List without search |
| `butcher:me` / `butcher:{id}` | 300s | Owner profile (`id=me`) |
| `butchers:stories:active` | 30s | Active butcher stories |

Invalidation on profile/product/offer updates: `cacheDel(butcher:{id})`, `butcher:me`.

---

## 9. BullMQ

**missing** for butcher discovery and profile.

Stats/orders may use queues in order lifecycle — outside this feature surface.

---

## 10. Security

| Control | Implementation |
|---------|----------------|
| Public browse | List + public profile OptionalAuth |
| Owner update | JWT + `butcher.userId === user.userId` or ADMIN |
| Registration guard | Direct register endpoint disabled |
| Rate limiting | `@RateLimit('api')` on controller |
| Soft delete | `notDeleted` on butcher queries |
| Profile view inflation | Increment only when viewer ≠ owner |

---

## 11. Possible Bugs

1. **Mobile ignores pagination** — index loads first page only; `nextCursor` unused.
2. **Client-side search** — server supports `search` query but app filters locally after full fetch.
3. **`seenStories` local only** — butcher story rings use client `Set`; not synced with server.
4. **Reviews mapping** — `[id].tsx` expects `authorNameAr`, `commentAr`; API returns `reviewer` + `comment` — mapping layer must align (verify field names in fetch handler).
5. **`GET /butchers/me`** — mobile uses UUID from list; `me` alias may be unused on client.
6. **Chat tab** — preview messages empty array; placeholder UI.

---

## 12. Production Readiness (with %)

**76%**

| Ready | Gap |
|-------|-----|
| Discovery API + caching + ranking | Mobile pagination/search not aligned with API |
| Rich profile with relations | No real-time status |
| Application-gated onboarding | Story seen state client-only |
| Stats endpoint for owners | Chat tab incomplete |



---

# FILE: butcher-stories.md


# Butcher Stories

## 1. Business Purpose

Butcher shops publish promotional **stories** (daily slaughter, offers, stock updates) separate from user social stories. Simpler model: no views/reactions API, public list endpoint.

---

## 2. Frontend Flow

### Mobile

| Screen | Path |
|--------|------|
| Butcher story viewer | `app/butchers/story-viewer.tsx` |
| Create (butcher mode) | Butcher profile / manage flows |

**Data:** `GET /api/butchers/stories` — filters by `butcherId` client-side.

**Viewer features:** Local like UI (client state only — **not** synced to server), reply text field (local; no butcher-story reply API).

**Types:** `daily_slaughter`, `offer`, `new_stock`, `update` (`StoryType` enum).

---

## 3. API Flow

Base: `/api/butchers/stories` — `butcher-stories.controller.ts`

| Method | URL | Auth |
|--------|-----|------|
| GET | `/butchers/stories` | **Public** |
| POST | `/butchers/stories` | JWT (must own active butcher) |
| DELETE | `/butchers/stories/:id` | JWT (butcher owner or ADMIN) |

**Create body:** `thumbnail`, optional `mediaUrl`, captions, `type`, optional `duration`.

---

## 4. Backend Flow

```
StoriesService.getActiveButcherStories()
  → findActiveButcherStories (expiresAt > now, not deleted)
  → cache butchers:stories:active (30s)

StoriesService.createButcherStory()
  → findButcherByUserId — 403 if no butcher
  → createButcherStory, invalidate cache
```

**No** `recordView`, reactions, or reply endpoints for butcher stories.

---

## 5. Database

| Model | Notes |
|-------|-------|
| `ButcherStory` | `butcherId`, `type` (`StoryType`), `seen` boolean (default false — **not updated by API**) |
| `Story` | User stories — different table |

`ButcherStory.seen` field exists but **no endpoint sets it** — effectively unused.

---

## 6. Socket

Not used.

---

## 7. Notifications

No notifications on butcher story publish in current code.

---

## 8. Redis

| Key | TTL |
|-----|-----|
| `butchers:stories:active` | 30s |

Also invalidated on `butchers.service` when loading butcher detail active stories.

---

## 9. BullMQ

Not used.

---

## 10. Security

- Create/delete require butcher profile linked to user
- Public read of active stories only
- Admin can delete any butcher story

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| Viewer “like” is client-only | `story-viewer.tsx` local state |
| `seen` column never updated | Schema vs API gap |
| No view analytics for butcher stories | Unlike user `Story` |
| Confusion with user `/stories` | Separate controllers |

---

## 12. Production Readiness: **72%**

CRUD and public listing work. Gaps: view tracking, server-side engagement, notifications.

**Main files:** `backend-nest/src/stories/butcher-stories.controller.ts`, `stories.service.ts`, `app/butchers/story-viewer.tsx`



---

# FILE: chat.md


# Chat & Messages

## 1. Business Purpose

Direct messaging lets users converse 1:1 (e.g. customer ↔ butcher) with text, images, and video. Threads are persisted in PostgreSQL; the backend also supports real-time delivery via Socket.IO `chat:*` events (mobile chat screen currently uses REST only).

**Who uses it:**
- **Customers / sellers** — butcher chat, messages tab, profile messages panel
- **Butchers** — `(butcher)/messages.tsx` tab
- **Backend socket layer** — optional realtime for clients that connect

---

## 2. Frontend Flow

| Screen | File | Entry |
|--------|------|-------|
| Messages tab | `app/app/(tabs)/messages.tsx` | Tab bar — `<MessagesPanel variant="standalone" />` |
| Profile embedded | `app/app/(tabs)/profile.tsx` | `<MessagesPanel variant="embedded" />` |
| Butcher messages tab | `app/app/(butcher)/messages.tsx` | Butcher layout — threads + activity |
| Chat thread | `app/app/butchers/chat.tsx` | From MessagesPanel, butcher profile, or deep link params |

### `MessagesPanel` (`app/components/feature/MessagesPanel.tsx`)

- `useMessageThreads(accessToken)` → `GET /api/messages`
- Tabs: `messages` | `activity` (notifications via `fetchNotifications`)
- Opens chat: `router.push({ pathname: '/butchers/chat', params: { threadId, receiverId, receiverName, receiverAvatar } })`

### `butchers/chat.tsx`

**Modes:** thread (`threadId` + `receiverId`), direct (`receiverId` only), butcher (`butcherId`).

**REST only (no socket in this file):**
- Load threads/messages: `GET /api/messages`, `GET /api/messages/:threadId`
- Send: `POST /api/messages` with `{ receiverId, text?, imageUrl?, videoUrl? }`
- Media: upload via `uploadMediaFromUri` then send URLs

Optimistic UI adds temp message; replaces with server message on success.

### `useMessageThreads` (`app/hooks/useMessageThreads.ts`)

Polls `GET /api/messages` on mount — no socket subscription.

---

## 3. API Flow

| Method | URL | Auth | Body / query |
|--------|-----|------|--------------|
| GET | `/api/messages` | JWT | — (thread list) |
| POST | `/api/messages` | JWT | `SendMessageDto`: `receiverId`, optional `text`, `imageUrl`, `videoUrl`, `orderId` |
| GET | `/api/messages/:threadId` | JWT | `?cursor=` (pagination) |

All `@RateLimit('api')`.

### Responses

**GET threads:** array of `{ id, participant, lastMessage, lastMessageAt, unread, isMine }`

**POST:** `{ message, threadId }` — creates thread via upsert if needed

**GET thread messages:** `{ messages, nextCursor, hasMore }` — page size 40; marks thread read

---

## 4. Backend Flow

### REST (`MessagesService`)

```
getThreads(user)
  → findThreadsForUser
  → load participants, unread counts
  → map last message preview

sendMessage(user, dto)
  → validate not self, receiver exists
  → upsertThread(sorted participant pair)
  → createMessage
  → AppNotificationsService.notifyUser type 'new_message'

getThreadMessages(user, threadId, cursor)
  → verify participant
  → paginate messages
  → markThreadRead
```

### Socket (`AppGateway` + `SocketGatewayService`)

**Client → Server (subscribe messages):**

| Event | Payload | Handler |
|-------|---------|---------|
| `chat:join` | `threadId` (UUID string) | Verify participant → `client.join('thread:{id}')` |
| `chat:leave` | `threadId` | Leave room |
| `chat:send` | `ChatSendDto` | Create message + emit |
| `chat:typing` | `{ threadId, receiverId }` | Forward to receiver |
| `chat:read` | `{ threadId, messageIds[] }` | Mark read + broadcast |

**Server → Client:**

| Event | Target | Payload |
|-------|--------|---------|
| `chat:message` | `thread:{threadId}` | Full message row |
| `chat:notification` | `user:{receiverId}` | `{ threadId, senderId, senderName, preview }` |
| `chat:typing` | `user:{receiverId}` | `{ threadId, userId }` |
| `chat:read` | `thread:{threadId}` | `{ threadId, readBy }` |
| `error` | caller | `{ code, message }` |

Socket auth: JWT in `handshake.auth.token` or `Authorization` header (`SocketGatewayService.authenticate`).

---

## 5. Database

Typical models (via `MessagesRepository` / `SocketRepository`):

| Entity | Role |
|--------|------|
| Message thread | Two participants (`participant1`, `participant2`), `lastMessageAt` |
| Message | `threadId`, `senderId`, `receiverId`, `text`, `imageUrl`, `videoUrl`, `orderId`, `isRead` |

Thread upsert uses sorted participant IDs for stable pairing.

---

## 6. Socket

**Gateway:** `backend-nest/src/gateway/app.gateway.ts`  
**Port:** `SOCKET_PORT` env (default **3002**)  
**Client:** `app/lib/socket.ts` — `connectSocket(accessToken)` → `io(EXPO_PUBLIC_SOCKET_URL)`

**Rooms:**
- `user:{userId}` — joined on connect
- `thread:{threadId}` — joined on `chat:join`

**Note:** Mobile `butchers/chat.tsx` does **not** call `connectSocket` or `chat:*` events. Realtime path exists server-side for future/other clients.

Redis adapter: `SocketRedisAdapterService` for multi-instance emit.

---

## 7. Notifications

| Path | Type | When |
|------|------|------|
| REST `sendMessage` | `new_message` | Always on POST |
| Socket `chat:send` | `new_message` | On socket send |

Payload includes `threadId`, `messageId`, `senderId`, `actorId`, `actorAvatar`, optional `orderId`/media URLs.

Push via BullMQ `notifications` → `push-notifications`.

---

## 8. Redis

| Key | TTL | Purpose |
|-----|-----|---------|
| `online:{userId}` | 3600s | Presence on socket connect / `presence:ping` |

Socket scaling via Redis adapter (not message persistence).

---

## 9. BullMQ

Chat does not enqueue dedicated jobs. `new_message` notifications go through `NotificationQueueService`.

---

## 10. Security

- REST and socket require valid JWT; revoked/blacklisted tokens rejected on socket.
- Thread access: participant check on join, send, and message fetch.
- Socket `chat:send` validates `receiverId` matches other participant in thread.
- Cannot message self (REST 400).
- `chat:read` limited to 50 message IDs per call (notifications read handler pattern).

---

## 11. Possible Bugs

1. **Mobile chat not realtime** — no socket listeners; users must reload/pull to see new messages.
2. **Duplicate send paths** — REST and socket both create messages independently; clients mixing both could duplicate logic.
3. **No typing/read in mobile UI** — socket events unused in `chat.tsx`.
4. **Thread list stale** — `useMessageThreads` only fetches on mount, not on focus.
5. **Activity tab conflates notifications** — not true chat activity feed.

---

## 12. Production Readiness (%)

**72%**

REST messaging, notifications, and full socket protocol are implemented server-side. Mobile UX is REST-only, so realtime chat is **not production-complete** for the primary app client.



---

# FILE: commissions.md


# Commissions

## 1. Business Purpose

Commissions define how much the platform charges sellers when livestock listings are sold. Rules are used to calculate `ListingFee` amounts owed by sellers.

**Who uses it:**
- **Sellers** — see commission rules in `app/fees.tsx`
- **Backend** — applies rules when creating listing fees on sale
- **Admins** — indirect via listing/fee management

---

## 2. Frontend Flow

| Location | File | Behavior |
|----------|------|----------|
| Fees screen rules tab | `app/app/fees.tsx` | `GET /api/fees/rules` for live rules |
| Local display helpers | `app/services/commissions.ts` | **Client-side** commission calculation helpers for UI labels |

**Note:** `app/services/commissions.ts` contains local rules/constants for display — not the authoritative server source.

---

## 3. API Flow

| Method | URL | Auth | Response |
|--------|-----|------|----------|
| GET | `/api/fees/rules` | Public | Commission rule definitions |

Controller: `fees.controller.ts` → `FeesService.getRules()`.

**Missing:** `GET /api/fees` is called by `fees.tsx` for user fee list but **no such endpoint exists** in `fees.controller.ts` (only `/rules`). Fee history may fail or use alternate path — verify `fees.tsx` implementation.

---

## 4. Backend Flow

```
FeesController.getRules()
  → FeesService.getRules()
    → Returns static/configured rules (see fees.service.ts)
```

**Listing fee creation:** When listing marked sold — `listings.repository.ts` / `ListingFee` creation with `commission` amount.

**Payment:** User pays fee via `POST /api/payments/initiate` with `type: 'fee'` or `listing_fee`.

---

## 5. Database

| Model | Purpose |
|-------|---------|
| `ListingFee` | Per-listing commission owed: `amount`, `commission`, `status`, `dueDate` |
| `Payment` | Fee payment records linked via `feeId` |

---

## 6. Socket

Not used.

---

## 7. Notifications

Overdue fees: `WorkerCronService` (09:00) → `fee-checks` queue → `FeeCheckProcessor` → may send `fee_reminder` email.

---

## 8. Redis

Cron lock: `cron:fee_check:lock`.

---

## 9. BullMQ

| Queue | Job | Purpose |
|-------|-----|---------|
| `fee-checks` | `check` | Process overdue listing fees |

---

## 10. Security

- Rules endpoint is public (read-only)
- Fee payment requires authenticated user + ownership of fee
- Webhook fulfills payment (see [payment-webhooks.md](./payment-webhooks.md))

---

## 11. Possible Bugs / Risks

| Risk | Notes |
|------|-------|
| `GET /api/fees` missing | Mobile `fees.tsx` may error on fees tab |
| Client vs server rule mismatch | `commissions.ts` local vs `fees/rules` API |
| No refund of commission on listing dispute | See [refunds.md](./refunds.md) |

---

## 12. Production Readiness: **78%**

Rules API works; user fee listing endpoint gap reduces readiness.

**Main files:** `backend-nest/src/fees/`, `app/services/commissions.ts`, `app/app/fees.tsx`

See also: [fees.md](./fees.md)



---

# FILE: connections.md


# Connections (Followers / Following Lists)

## 1. Business Purpose

Exposes a user's social graph: who follows them (`followers`) and whom they follow (`following`). When a viewer is authenticated, each listed user includes `isFollowing` so the UI can show follow/unfollow buttons in context.

**Primary users:** Profile owners and visitors browsing another user's network.

**Key files:** `backend-nest/src/users/users.controller.ts`, `backend-nest/src/users/services/users.service.ts`, `app/app/profile/connections.tsx`, `app/services/users.ts`.

---

## 2. Frontend Flow

**Screen:** `app/app/profile/connections.tsx`

| Step | Behavior |
|------|----------|
| Route params | `userId` (defaults to `me.id`), `tab` (`followers` \| `following`), optional `username` |
| Load | `fetchUserConnections(targetUserId, activeTab)` on mount / tab change |
| Tabs | Switch between `followers` and `following` (client-side; refetches API) |
| Row tap | `openUserProfile(router, item.id)` |
| Follow button | Hidden for self; calls `toggleFollowUser` and patches local `isFollowing` |

**Navigation entry points:**

- `app/app/users/[id].tsx` — `openConnections('followers' | 'following')` with `userId`, `tab`, `username`
- `app/app/(tabs)/profile.tsx` — links to own connections

**Service:** `app/services/users.ts` → `GET /api/users/:userId/connections?type={type}`

---

## 3. API Flow

| Method | Endpoint | Auth | Query | Response `data` |
|--------|----------|------|-------|-----------------|
| GET | `/api/users/:id/connections` | OptionalAuth (`@Public()` + `@OptionalAuth()`) | `type` = `followers` (default) \| `following` | `{ type, users: ConnectionUser[] }` |

**`ConnectionsQueryDto`** (`users.dto.ts`): `type` optional enum, default `followers`.

**Each user object:**

```typescript
{
  id, username, displayName, arabicName, avatar?, verified,
  isFollowing: boolean  // false for self; else viewer's follow state
}
```

**Errors:**

| Code | HTTP | When |
|------|------|------|
| `invalid_id` | 400 | Empty `id` |
| `invalid_type` | 400 | `type` not `followers` or `following` |
| `not_found` | 404 | Target user inactive / missing |

---

## 4. Backend Flow

```
GET /users/:id/connections?type=
  → UsersController.connections()
  → UsersService.getConnections(id, query, viewer)
      → UsersRepository.findActiveUserId(id)
      → type === 'followers'
           ? findFollowers(id, PAGE_SIZE=50)
           : findFollowing(id, PAGE_SIZE=50)
      → map follower | following user from join rows
      → if viewer: findFollowsByViewer(viewerId, listedUserIds)
      → attach isFollowing per user
```

**Repository selects** (`connectionUserSelect`): `id`, `username`, `displayName`, `arabicName`, `avatar`, `verified`.

**Ordering:** `createdAt desc` on `Follow` rows.

---

## 5. Database

**Primary model:** `Follow` (same as follow feature)

| Query | Prisma filter |
|-------|---------------|
| Followers | `where: { followingId: id }` → select `follower` |
| Following | `where: { followerId: id }` → select `following` |
| Viewer follows | `where: { followerId: viewerId, followingId: { in: ids } }` |

**User visibility:** `findActiveUserId` requires `isActive: true` and `deletedAt: null`.

No separate `Connection` table.

---

## 6. Socket

**missing** — connections list is REST-only; no live updates when someone follows/unfollows while screen is open.

---

## 7. Notifications

**missing** for the connections list endpoint itself.

Follow actions initiated from this screen use the follow notification path (`type: 'follow'`) documented in `docs/follow.md`.

---

## 8. Redis

**missing** for connections endpoint — no cache read/write in `getConnections`.

Profile endpoint (`user:{id}`) may still cache follower **counts**, not the connection list.

---

## 9. BullMQ

**missing** — no queue involvement for listing connections.

---

## 10. Security

| Control | Implementation |
|---------|----------------|
| Public read | `@Public()` — anyone can list another user's followers/following |
| `isFollowing` enrichment | Only when valid JWT viewer present |
| Active users only | Target must pass `findActiveUserId` |
| Rate limiting | `@RateLimit('api')` |
| Privacy | No block/mutual-follow filtering implemented |

---

## 11. Possible Bugs

1. **Hard limit 50** — `PAGE_SIZE = 50` in `UsersService`; no `cursor` query param; UI cannot load more.
2. **Tab param desync** — `connections.tsx` sets tab from URL on `useEffect` but local `activeTab` state can briefly show wrong data during switch.
3. **Stale list after follow** — Row updates `isFollowing` only; does not add/remove user from the other tab.
4. **`isFollowing` for anonymous** — Always `false` when no viewer; follow buttons still shown but gated by login alert.
5. **Inactive followers** — Follow rows are not filtered by `User.isActive`; deactivated accounts may appear if follow row exists.

---

## 12. Production Readiness (with %)

**72%**

| Ready | Gap |
|-------|-----|
| Working followers/following API | No pagination |
| OptionalAuth `isFollowing` hints | No caching (may be heavy for popular accounts) |
| Mobile list UI + inline follow | No socket refresh |
| Validation + rate limits | No privacy controls (private accounts) |



---

# FILE: content.md


# Content Sections (CMS)

## 1. Business Purpose

`ContentSection` stores bilingual CMS blocks (slug, titles, body) for static in-app content (terms, help, marketing sections).

**Who uses it:** Admin/moderator staff via admin panel. **Public mobile API to fetch active sections is not implemented.**

---

## 2. Frontend Flow

### Admin panel

| Screen | Path |
|--------|------|
| Content CMS | `admin-panel/src/app/(dashboard)/content/page.tsx` |

**Actions:** Create section (slug, titleAr, bodyAr), list, soft-delete (archive).

### Mobile

Info pages (`app/app/info/terms.tsx`, `privacy.tsx`, `contact.tsx`) use **hardcoded or brand copy** — not wired to `GET /sections` (endpoint does not exist publicly).

---

## 3. API Flow

Staff only — `/api/admin/sections`

| Method | URL | Roles |
|--------|-----|-------|
| GET | `/admin/sections` | ADMIN, MODERATOR |
| POST | `/admin/sections` | Create |
| PATCH | `/admin/sections/:id` | Partial update |
| DELETE | `/admin/sections/:id` | Soft delete |

**Create body:** `slug`, `titleAr`, `bodyAr`, optional `titleEn`, `bodyEn`, `isActive`, `sortOrder`.

---

## 4. Backend Flow

```
AdminController → AdminService → AdminRepository
  listSections — orderBy sortOrder
  createSection / updateSection / softDeleteSection
```

---

## 5. Database

| Model | Fields |
|-------|--------|
| `ContentSection` | `slug` (unique), `titleAr`, `titleEn?`, `bodyAr`, `bodyEn?`, `isActive`, `sortOrder`, `deletedAt?` |

**Cleanup:** Hard delete after retention if soft-deleted (`runCleanup`).

---

## 6. Socket

Not used.

---

## 7. Notifications

Not used.

---

## 8. Redis

Not used.

---

## 9. BullMQ

Not used.

---

## 10. Security

- Staff JWT required
- Slug uniqueness enforced in DB
- No HTML sanitization documented in service layer

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| **No public read API** | Mobile cannot load CMS content dynamically |
| Delete is soft archive | No restore UI |
| English fields optional | App may be Arabic-only today |

---

## 12. Production Readiness: **45%**

Admin authoring works. **Missing:** public `GET /content/sections` (or similar), mobile integration, preview.

**Main files:** `backend-nest/src/admin/`, `admin-panel/.../content/page.tsx`



---

# FILE: cron.md


# Worker Cron Schedules

## 1. Business Purpose

Hourly tick in the worker process runs daily maintenance: overdue fee checks, DB cleanup, subscription expiry/reminders, and weekly live-minute resets.

**Who uses it:** `WorkerCronService` in the BullMQ worker process only (not HTTP API cron).

---

## 2. Frontend Flow

No direct UI. Users see effects: fee overdue notifications, expired subscriptions, cleaned old data.

---

## 3. API Flow

| Method | URL | Trigger |
|--------|-----|---------|
| POST | `/api/admin/cleanup` | Called by cron with `x-cron-secret: CRON_SECRET` |

---

## 4. Backend Flow

**File:** `queue/services/worker-cron.service.ts`

**Mechanism:**
- `setInterval(tick, 60 * 60 * 1000)` — hourly check
- `shouldRun(key, hour)` — runs once per calendar day when local hour matches
- `withLock(redisKey, ttl, fn)` — NX lock on Redis DB 0

### Schedules (local server time)

| Job key | Hour | Day | Action |
|---------|------|-----|--------|
| `fee_check` | **09:00** | daily | Find overdue `ListingFee` → enqueue `fee-checks` jobs |
| `db_cleanup` | **03:00** | daily | `POST {APP_URL}/api/admin/cleanup` with cron secret |
| `subscription` | **06:00** | daily | Enqueue `subscriptions` jobs: `expire`, `reminders` |
| `subscription_weekly` | **04:00** | **Monday only** | Enqueue `reset_live_minutes` |

**Fee check lock:** `cron:fee_check:lock` (120s TTL) — separate from `withLock` wrapper.

**Cleanup lock:** `cron:db_cleanup:lock` (300s).

**Subscription lock:** `cron:subscription:lock` (300s).

**Weekly reset lock:** `cron:subscription:weekly_reset` (300s).

---

## 5. Database

Cleanup (`AdminRepository.runCleanup`) deletes/archives:
- Expired `UserSession`
- Read notifications > 90 days
- Expired `Story` (> 30 days past `expiresAt`, not soft-deleted)
- Expired `ButcherOffer`
- Hard purge soft-deleted posts, listings, streams, tickets, sections, butcher stories/products after retention

---

## 6. Socket

Not used by cron.

---

## 7. Notifications

Fee cron → `FeeCheckProcessor` → `fee_due` notification. Subscription cron → reminder/expire notifications via `SubscriptionLifecycleService`.

---

## 8. Redis

Distributed locks on DB 0 (see `redis.md`).

---

## 9. BullMQ

Cron enqueues to `fee-checks` and `subscriptions` queues rather than running heavy logic inline.

---

## 10. Security

- `CRON_SECRET` required for unattended cleanup HTTP call
- Staff JWT also accepted by `runCleanupAuthorized`
- Locks prevent duplicate runs across worker instances

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| Hourly tick only checks at top of hour | Miss if worker down entire hour window |
| Uses server local timezone | `getHours()` not UTC |
| Cleanup HTTP self-call | Requires `APP_URL` reachable from worker |
| Story cleanup 30 days after expiry | Not immediate on `expiresAt` |

---

## 12. Production Readiness: **82%**

Functional for single-region deployment. Gaps: timezone documentation, no external scheduler (e.g. K8s CronJob) as backup.

**Main files:** `backend-nest/src/queue/services/worker-cron.service.ts`, `backend-nest/src/queue/repositories/worker-cron.repository.ts`



---

# FILE: featured-listings.md


# Featured Listings

## 1. Business Purpose

Sellers with paid plans can mark new listings as **featured** (`Listing.featured = true`) for higher visibility in search/home ordering, within monthly plan limits (`monthlyFeaturedAds`).

---

## 2. Frontend Flow

### Mobile

- Create listing: `app/create/listing.tsx` — may pass `featured: true` if plan allows
- `ListingCard` shows “مميز” badge when `listing.featured`
- Home tab sorts featured first (`app/(tabs)/index.tsx`)
- `SubscriptionContext` shows `featuredAdsUsed` vs plan limit

---

## 3. API Flow

| Method | URL | Body |
|--------|-----|------|
| POST | `/api/listings` | `{ featured?: boolean, ... }` |
| GET | `/api/listings` | Query `featured=true` filters featured only |

**Errors:** `403 featured_limit` or `plan_required` when over quota or on free plan.

---

## 4. Backend Flow

```
ListingsService.create()
  → SubscriptionEntitlementService.assertCanCreateListing(userId, { featured })
    → checks monthlyFeaturedAds vs subscription.featuredAdsUsed
  → ListingsRepository.createListingWithFee()
    → increments featuredAdsUsed on subscription if featured
```

**List ordering:** `featured DESC`, then seller plan tier, then `createdAt` (`listings.service.ts`).

**Plan keys:** `monthlyFeaturedAds` in `PlanFeature`; `PlanPermissionService.monthlyFeaturedAds()`.

---

## 5. Database

| Model | Field |
|-------|-------|
| `Listing` | `featured` Boolean, indexed |
| `Subscription` | `featuredAdsUsed` Int |

Monthly reset: `SubscriptionProcessor` job `reset_live_minutes` resets usage counters via `resetMonthlyUsageCounters` (includes featured/pinned counts).

---

## 6. Socket

Not used.

---

## 7. Notifications

`fee_due` on listing create, not specific to featured.

---

## 8. Redis

`listings:v2:*` cache invalidated on create. Featured filter in cache key.

---

## 9. BullMQ

Fee check scheduled on listing create.

---

## 10. Security

- Entitlement enforced server-side
- Cannot toggle featured on update via `UpdateListingDto` (no `featured` field) — **featured only at create time**

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| Cannot feature existing listing later | No PATCH featured |
| Counter increments even if listing later suspended | No decrement on admin suspend |
| Free plan: featured must be false | Validated in assert |

---

## 12. Production Readiness: **85%**

Featured create + list boost implemented. Gaps: post-create featuring, decrement on delete.

**Main files:** `backend-nest/src/listings/`, `subscription-entitlement.service.ts`



---

# FILE: fees.md


# Fees & Commissions

## 1. Business Purpose

Listing fees are **commission charges** owed when users publish marketplace listings. Rules vary by animal/category; store listings may be exempt or charged a plan-based percentage. Fees must be paid within a due window or listings move to `pending_fee` / `overdue`.

**Who uses it:**
- **Sellers** — `app/app/fees.tsx` hub (pay fees, view rules, subscription tab)
- **Listings service** — creates `ListingFee` on listing publish
- **Payments** — `type: 'listing_fee'` checkout via NI
- **Cron / BullMQ** — marks overdue fees and notifies users

---

## 2. Frontend Flow

| Screen | File | Tabs |
|--------|------|------|
| Fees hub | `app/app/fees.tsx` | `fees`, `subscription`, `history`, `rules` |

### Data loading

| Source | Endpoint | Status |
|--------|----------|--------|
| Commission rules table | `GET /api/fees/rules` | **Implemented** (public) |
| User's pending/paid fees | `GET /api/fees` | **Called by frontend but NOT implemented in backend** |

`fees.tsx` maps `json.data.fees` when present; otherwise fees list stays empty.

### Pay flow

1. User selects pending fee(s).
2. `POST /api/payments/initiate` with `type: 'listing_fee'`, `referenceId: fee.id`, `amount: fee.commission`.
3. Opens NI `checkoutUrl`.
4. Webhook marks fee paid and activates listing (see `docs/payments.md`).

**Also links to:** `/subscription` for plan upgrades (store commission exemption).

---

## 3. API Flow

### Implemented

| Method | URL | Auth | Response |
|--------|-----|------|----------|
| GET | `/api/fees/rules` | Public | `{ rules: COMMISSION_TABLE }` |

`FeesController` (`backend-nest/src/fees/fees.controller.ts`) — **only** `getRules()`.

### Referenced by frontend but missing

| Method | URL | Expected by |
|--------|-----|-------------|
| GET | `/api/fees` | `app/app/fees.tsx` `fetchFees()` |

### Related (payments module)

| Method | URL | Purpose |
|--------|-----|---------|
| POST | `/api/payments/initiate` | Pay fee (`type: 'listing_fee'`) |

---

## 4. Backend Flow

### Rule source (`backend-nest/src/lib/commissions.ts`)

`FeesService.getRules()` returns static `COMMISSION_TABLE` for UI display.

`calculateCommission(category, price, quantity, permissions)` used at listing creation:

| Category | Rule |
|----------|------|
| sheep, goats | 20 SAR / head |
| camels | 60 SAR / head |
| horses, cows, birds, feed, equipment | 2% of price |
| store | `storeCommission` from plan permissions (default 5%), or **exempt** if commission <= 0 |

`shouldCreateFee` — skips fee row for exempt store listings.

### Listing creation (`listings.service.ts`)

```
create(user, dto)
  → entitlements.assertCanCreateListing()
  → calculateCommission(category, price, quantity, permissions)
  → repo.createListingWithFee({ commission, dueDate, ... })
  → feeCheckQueue.scheduleFeeCheck({ listingFeeId, userId, amount }, delayMs)
  → notifyUser type 'fee_due' — "تم نشر إعلانك"
```

`dueDate` = now + 7 days from `calculateCommission` (notification text mentions 14 days — copy mismatch).

### Overdue processing

```
WorkerCronService (daily 09:00)
  → findOverdueListingFees (pending + dueDate < now)
  → feeCheckQueue.addFeeCheck per fee

FeeCheckProcessor
  → if still pending and past dueDate:
       ListingFee.status = overdue
       Listing.status = pending_fee
       notifyUser type 'fee_due' — "رسوم متأخرة"
```

### Payment fulfillment

`PaymentsRepository.processSuccessfulPayment` for `fee` / `listing_fee`:
- `ListingFee.status = paid`, `paidAt`, `transactionId`
- `Listing.status = active`

---

## 5. Database

### `ListingFee`

| Field | Type / notes |
|-------|----------------|
| `listingId` | Unique — one fee per listing |
| `userId` | Seller |
| `category`, `quantity`, `price` | Snapshot at creation |
| `commission` | Amount due |
| `status` | `pending` \| `paid` \| `overdue` \| `waived` |
| `dueDate` | Payment deadline |
| `paidAt`, `transactionId` | Set on successful payment |

### `FeeStatus` enum

`pending`, `paid`, `overdue`, `waived`

### Relations

- `Listing.fee` — optional 1:1
- `Payment.feeId` — links NI payment to fee

Indexes: `userId`, `status`, `dueDate`, `(status, dueDate)`.

---

## 6. Socket

Fees do not use socket events.

---

## 7. Notifications

| Trigger | Type | Message |
|---------|------|---------|
| Listing created with fee | `fee_due` | إعلانك منشور + commission amount |
| Fee marked overdue (processor) | `fee_due` | رسوم متأخرة — listing suspended until paid |
| Payment success | `system` | Via payments webhook (generic payment success) |

---

## 8. Redis

| Key | Purpose |
|-----|---------|
| `cron:fee_check:lock` | Daily overdue scan lock (TTL 120s) |

Fee check queue only runs when `RedisCacheService.isEnabled()`.

---

## 9. BullMQ

**Queue:** `fee-checks` (`QUEUE_NAMES.FEE_CHECKS`)

| Job name | Payload | When |
|----------|---------|------|
| `check` | `{ listingFeeId, userId, amount }` | Scheduled at listing create (`delay` until after dueDate + 60s) or cron for overdue |

`FeeCheckProcessor` concurrency: **5**. Job id: `fee:{listingFeeId}`.

---

## 10. Security

- Rules endpoint is public (marketing/transparency).
- Fee payment requires JWT + `findPendingFee` validates ownership and amount.
- Listing creation enforces plan listing limits before fee creation.
- Overdue transition runs in DB transaction.

---

## 11. Possible Bugs

1. **Missing `GET /api/fees`** — primary fees UI cannot load user fees from API.
2. **Due date copy** — notification says 14 days; code sets 7 days.
3. **No waive endpoint** — `waived` status exists in schema but no controller sets it.
4. **Refund gap** — refunded payment does not revert `ListingFee` or listing status.
5. **Batch pay** — UI allows multi-select but `handleConfirmPayment` only pays first selected fee.
6. **History tab** — depends on same missing `GET /api/fees` data.

---

## 12. Production Readiness (%)

**68%**

Commission calculation, fee creation on listing, overdue cron, NI payment fulfillment, and public rules API exist. Critical gap: **no authenticated fees list endpoint** for the mobile hub. Treat fees listing as **partial**.



---

# FILE: firebase.md


# Firebase (Push Only)

## 1. Business Purpose

Firebase Admin SDK is used **only** for sending FCM push messages in `PushProcessor`. There is **no** Firebase Analytics, Crashlytics, or Remote Config in the codebase.

---

## 2. Frontend Flow

Mobile obtains native FCM token via Expo Notifications (`app/lib/notifications.ts`), not Firebase JS SDK directly.

---

## 3. API Flow

No Firebase REST from clients. Server sends push after notification queue processing.

---

## 4. Backend Flow

**Single integration point:** `backend-nest/src/queue/processors/push.processor.ts`

```text
PushProcessor constructor:
  if (!admin.apps.length && process.env.FIREBASE_PROJECT_ID)
    admin.initializeApp({ credential: cert(...) })

PushProcessor.process (job name 'send'):
  admin.messaging().send({
    token: fcmToken,
    notification: { title: titleAr, body: bodyAr },
    data,
    android: { priority: 'high', notification: { sound: 'default' } },
    apns: { payload: { aps: { sound: 'default', badge: 1 } } },
  })
```

**Error handling:** `messaging/registration-token-not-registered` → clear `User.fcmToken`.

**Early exit:** If Firebase not initialized, job completes without sending.

---

## 5. Database

Reads `User.fcmToken`; may null it on invalid token.

---

## 6. Socket

Not used.

---

## 7. Notifications

Firebase is the transport layer after `NotificationPersistService` enqueues push job.

---

## 8. Redis

Push jobs stored in BullMQ (Redis DB 1).

---

## 9. BullMQ

Queue: `push-notifications`, job: `send`, processor: `PushProcessor`.

---

## 10. Security

**Required env vars:**
- `FIREBASE_PROJECT_ID`
- `FIREBASE_PRIVATE_KEY` (escaped `\n` normalized in code)
- `FIREBASE_CLIENT_EMAIL`

Service account must have FCM send permission. Keys must not be committed to git.

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| Silent no-op without env | No startup warning beyond missing sends |
| No Firebase Analytics | Confirmed — not in code |
| Badge always 1 on iOS | Static in APNS payload |
| No topic/multicast | Single `token` only |

---

## 12. Production Readiness: **80%**

Adequate for token-based push. Missing: analytics, batch send, rich media, failure metrics.

**Main file:** `backend-nest/src/queue/processors/push.processor.ts`



---

# FILE: follow.md


# Follow (User Follow / Unfollow)

## 1. Business Purpose

Lets authenticated users follow or unfollow other users to build a social graph. Following updates follower counts on profiles and triggers a push/in-app notification to the followed user. Self-follow is blocked.

**Primary users:** Registered app users viewing profiles or connection lists.

**Key files:** `backend-nest/src/users/users.controller.ts`, `backend-nest/src/users/services/users.service.ts`, `app/services/users.ts`, `app/app/users/[id].tsx`, `app/app/profile/connections.tsx`.

---

## 2. Frontend Flow

| Screen | Path | Behavior |
|--------|------|----------|
| Public profile | `app/app/users/[id].tsx` | Loads profile via `fetchUserProfile`; follow button calls `toggleFollowUser(profile.id)`; updates `isFollowing` and `followersCount locally |
| Connections list | `app/app/profile/connections.tsx` | Per-row follow toggle via `toggleFollowUser`; requires `accessToken` |
| Profile tab | `app/app/(tabs)/profile.tsx` | Navigates to connections with `userId` / `tab` params |

**Service layer:** `app/services/users.ts`

- `toggleFollowUser(userId)` → `POST /api/users/:id/follow` via `authFetch`
- `fetchUserProfile(userId)` → returns `isFollowing` when viewer is authenticated

**State:** No dedicated follow context; local component state + `AppContext.me` for current user id.

---

## 3. API Flow

Base prefix: `/api/users` (`UsersController`)

| Method | Endpoint | Auth | Request | Response `data` |
|--------|----------|------|---------|-----------------|
| POST | `/users/:id/follow` | JWT required (`@RateLimit('api')`) | — | `{ following: boolean }` — `true` = now following, `false` = unfollowed |
| GET | `/users/:id` | OptionalAuth | — | Profile includes `isFollowing`, `followersCount`, `followingCount` |

**Errors (from `UsersService.toggleFollow`):**

| Code | HTTP | When |
|------|------|------|
| `invalid_action` | 400 | `targetId === followerId` |
| `not_found` | 404 | Target user missing |
| `forbidden` | 403 | missing/invalid JWT (global guard) |

---

## 4. Backend Flow

```
POST /users/:id/follow
  → UsersController.follow()
  → UsersService.toggleFollow(targetId, user.userId)
      → UsersRepository.findFollow(followerId, followingId)
      → if exists: deleteFollow → cacheDel user:{targetId} → { following: false }
      → else: createFollow → AppNotificationsService.notifyUser(type: 'follow')
             → cacheDel user:{targetId} → { following: true }
```

**Repository methods** (`users.repository.ts`): `findFollow`, `createFollow`, `deleteFollow`, `findFollowers`, `findFollowing`, `findFollowsByViewer`.

**Profile cache:** `getUser` caches at `user:{id}` (TTL 300s). Follow toggle invalidates target profile cache only.

---

## 5. Database

**Model:** `Follow` — `backend-nest/prisma/schema.prisma` (lines 82–93)

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `followerId` | String | FK → `User` (`Followers` relation) |
| `followingId` | String | FK → `User` (`Following` relation) |
| `createdAt` | DateTime | Default `now()` |

**Constraints:** `@@unique([followerId, followingId])`; indexes on `followerId`, `followingId`; `onDelete: Cascade` on both user FKs.

**Related counts:** `User._count.followers` / `following` used in profile and list endpoints.

---

## 6. Socket

**missing** for follow events. No socket emit on follow/unfollow.

`SocketDisconnectService` is injected in `UsersService` but only used in `deleteUser`, not follow.

---

## 7. Notifications

On **new follow** (not unfollow), `UsersService.toggleFollow` calls:

```typescript
AppNotificationsService.notifyUser({
  userId: targetId,
  type: 'follow',
  titleAr: 'متابع جديد',
  bodyAr: `${follower?.arabicName || 'مستخدم'} بدأ متابعتك`,
  data: { actorId: followerId, actorAvatar: follower?.avatar },
});
```

Delivery path: `AppNotificationsService` → `NotificationQueueService` (BullMQ) → FCM/persisted notification (see queue workers).

**Unfollow:** no notification.

---

## 8. Redis

| Key | Operation | TTL | When |
|-----|-----------|-----|------|
| `user:{targetId}` | `cacheDel` | — | After follow or unfollow |
| `user:{id}` | `cacheGet` / `cacheSet` | 300s | Profile read in `getUser` |

Uses `RedisService` (`cacheGet`, `cacheSet`, `cacheDel`) in `UsersService`.

---

## 9. BullMQ

Follow notifications are enqueued indirectly via `AppNotificationsService` → notification BullMQ queue. No dedicated follow job type or follow-specific queue.

**Fee checks / other queues:** not used for follow.

---

## 10. Security

| Control | Implementation |
|---------|----------------|
| Authentication | `POST :id/follow` requires JWT (`@CurrentUser()`); no `@Public()` |
| Authorization | Any authenticated user may follow any other user (except self) |
| Rate limiting | `@RateLimit('api')` on controller |
| Idempotency | Toggle semantics: repeated POST alternates follow state |
| Data integrity | DB unique constraint prevents duplicate follow rows |

---

## 11. Possible Bugs

1. **Stale follower count on follower’s device** — `users/[id].tsx` adjusts count optimistically; no server recount returned from follow endpoint.
2. **Profile cache race** — 300s cached profile may show wrong `isFollowing` if cache invalidation fails.
3. **Connections list cap** — `getConnections` uses `PAGE_SIZE = 50` with no cursor; large follower lists are truncated.
4. **Notification fan-out** — `void this.notifications.notifyUser(...)` on follow; failures are logged only.
5. **Guest follow UX** — connections screen alerts login; profile screen should gate similarly (verify `users/[id].tsx` auth check).

---

## 12. Production Readiness (with %)

**78%**

| Ready | Gap |
|-------|-----|
| CRUD + unique constraint + toggle API | No real-time socket update for counts |
| Push notification on follow | No pagination on connections |
| Redis profile cache invalidation | Optimistic UI can drift from server |
| Rate limiting + auth | No follow spam/abuse limits beyond generic API rate limit |



---

# FILE: health.md


# Health Check

## 1. Business Purpose

Liveness/readiness probe for load balancers and ops to verify API dependencies: PostgreSQL, Redis cache/session, and BullMQ connectivity.

---

## 2. Frontend Flow

Not used by mobile or admin UI.

---

## 3. API Flow

| Method | URL | Auth |
|--------|-----|------|
| GET | `/api/health` | **Public** (`@Public`) |

**Response (200 or 503):**
```json
{
  "status": "ok" | "degraded",
  "checks": {
    "db": boolean,
    "redis_cache": boolean,
    "redis_session": boolean,
    "queue": boolean
  },
  "duration": "12ms",
  "uptime": 3600,
  "timestamp": "ISO-8601",
  "version": "1.0.0"
}
```

HTTP status: **200** if `db` ok AND (Redis disabled OR both redis checks ok); else **503**.

---

## 4. Backend Flow

```
HealthController.get()
  → HealthService.check()
    → HealthRepository.pingDb() — SELECT 1
    → RedisCacheService.ping()
    → RedisSessionService.ping()
    → NotificationQueueService.getJobCounts() (if queue enabled)
```

Checks run in parallel via `Promise.allSettled`.

---

## 5. Database

Raw query only; no models.

---

## 6. Socket

Not covered. Socket process has **no** dedicated health endpoint in code.

---

## 7. Notifications

Queue check uses `notifications` queue as BullMQ probe.

---

## 8. Redis

Probes DB 0 (cache) and DB 2 (session). BullMQ on DB 1 via queue service.

When `REDIS_ENABLED=false`, redis checks skipped; healthy if DB up.

---

## 9. BullMQ

`checks.queue` true if `notificationQueue.isEnabled()` and `getJobCounts()` succeeds.

---

## 10. Security

Public endpoint — reveals dependency status (acceptable for internal LB). No sensitive data.

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| Socket/worker not probed | Separate processes |
| Redis disabled marks healthy without queue | By design |
| `version` from npm_package_version | May be unset |

---

## 12. Production Readiness: **75%**

Good for API process. Add socket/worker health endpoints for full stack monitoring.

**Main files:** `backend-nest/src/health/health.controller.ts`, `health.service.ts`



---

# FILE: image-processing.md


# Image Processing (Queue Stub)

## 1. Business Purpose

Planned async image transforms (resize, watermark, format conversion) after upload. **Currently a no-op stub** — jobs can be enqueued only via `ImageQueueService`, which has **no callers** in the codebase.

---

## 2. Frontend Flow

Not used. Clients upload final images via presign/direct upload without post-processing.

---

## 3. API Flow

No REST endpoint for image processing.

---

## 4. Backend Flow

```
ImageQueueService.addImageProcessing(job)
  → queue 'image-processing', job name 'process'
    → ImageProcessingProcessor.process()
      → logs debug "no-op stub" and returns
```

**Job type (`ImageJob`):** `fileKey`, `bucket`, `operations` (defined in `queue.types`).

**Processor concurrency:** 2

---

## 5. Database

No persistence of processing jobs beyond BullMQ Redis metadata.

---

## 6. Socket

Not used.

---

## 7. Notifications

Not used.

---

## 8. Redis

Queue on DB 1. `removeOnComplete: 20`, `removeOnFail: 50`.

---

## 9. BullMQ

| Queue | Job | Processor | Status |
|-------|-----|-----------|--------|
| `image-processing` | `process` | `ImageProcessingProcessor` | **Stub only** |

---

## 10. Security

If implemented, must validate `fileKey` ownership and sandbox operations.

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| **Not implemented** | Processor only logs |
| Dead code path | `addImageProcessing` never imported elsewhere |
| False expectation of auto thumbnails | Upload URLs used as-is |

---

## 12. Production Readiness: **5%**

Infrastructure registered; zero functional processing. Safe to ignore in ops until implemented.

**Main files:** `backend-nest/src/queue/processors/image-processing.processor.ts`, `services/image-queue.service.ts`



---

# FILE: listings.md


# Listings (Marketplace Ads)

## 1. Business Purpose

Marketplace listings for livestock and related goods (camels, sheep, feed, equipment, etc.). Sellers publish ads with images, price, location, and optional featured placement. Creation enforces subscription entitlements, calculates commission fees, schedules fee-check jobs, and ranks results by featured flag and plan tier.

**Primary users:** Sellers (`USER` audience subscriptions); buyers browse market tab.

**Key files:** `backend-nest/src/listings/listings.module.ts`, `app/app/(tabs)/market.tsx`, `app/app/create/listing.tsx`, `app/contexts/SubscriptionContext.tsx`.

---

## 2. Frontend Flow

| Screen | Path | Behavior |
|--------|------|----------|
| Market tab | `app/app/(tabs)/market.tsx` | Reads `listings` from `AppContext`; **client-side** filter by category, country, featured, search text |
| Create listing | `app/app/create/listing.tsx` | 4-step wizard; uploads images; `addListing` → `POST /api/listings`; commission preview via `calculateCommission` + `subscription.permissions` |
| Listing detail | `app/listing/[id].tsx` | (separate screen; not primary doc scope) |

**AppContext:**

- `fetchListings` → `GET /api/listings` (first page, no cursor)
- `addListing` → `POST /api/listings`
- `removeListing` → `DELETE /api/listings/:id`

**SubscriptionContext** (`app/contexts/SubscriptionContext.tsx`):

- Fetches `GET /api/subscriptions` + plan catalog
- Exposes `subscription.permissions` and `usageCounters` (`listingsUsed`, `featuredAdsUsed`, `dailyAdsUsed`, etc.)
- Used in create flow for commission preview; **backend enforces limits** on create

---

## 3. API Flow

Controller: `ListingsController` — prefix `/api/listings`

| Method | Endpoint | Auth | Query / Body | Response |
|--------|----------|------|--------------|----------|
| GET | `/listings` | OptionalAuth | `cursor`, `category`, `country`, `search`, `featured`, `sellerId`, `minPrice`, `maxPrice` | `{ listings, nextCursor, hasMore }` |
| POST | `/listings` | JWT | `CreateListingDto` | Created listing + seller + fee |
| GET | `/listings/:id` | OptionalAuth | — | Listing detail; increments views |
| PUT | `/listings/:id` | JWT | `UpdateListingDto` | Updated listing |
| DELETE | `/listings/:id` | JWT | — | `{ deleted: true }` (marks `sold`) |

**Create body highlights:** `title`, `arabicTitle`, descriptions, `price`, `currency`, `category`, `images[]`, `featured`, `quantity`, `location`, `country`, optional `breed`, `age`.

---

## 4. Backend Flow

```
ListingsController → ListingsService → ListingsRepository
                  ↘ SubscriptionEntitlementService.assertCanCreateListing
                  ↘ calculateCommission (lib/commissions)
                  ↘ FeeCheckQueueService.scheduleFeeCheck
                  ↘ AppNotificationsService (fee_due)
```

**list:**

- Cache `listings:v2:{filters}` when no search/price range (TTL 90s)
- `where: { status: 'active', notDeleted }`
- Re-sort by featured, plan tier (`PlanResolverService`), `createdAt`

**create:**

1. `assertCanCreateListing(userId, { images, featured })` — daily ads, featured limits
2. `calculateCommission(category, price, quantity, permissions)`
3. Transaction: create `Listing` + `ListingFee` + increment subscription usage counters
4. Schedule BullMQ fee check at `dueDate + 60s`
5. Notify seller `fee_due`
6. `cache.delPattern('listings:v2:*')`

**remove:** `markSold` + soft delete fields; cache invalidation

---

## 5. Database

| Model | Key fields |
|-------|------------|
| `Listing` | `sellerId`, titles, `price`, `category`, `images[]`, `featured`, `status`, `views`, `expiresAt?`, soft delete |
| `ListingFee` | `commission`, `dueDate`, `status` (`pending`), linked 1:1 to listing |
| `Subscription` | `listingsUsed`, `dailyAdsUsed`, `featuredAdsUsed`, `pinnedAdsUsed`, `dailyAdsWindowStart` |

**Schema:** `backend-nest/prisma/schema.prisma` — `Listing` (~185), `ListingFee` (~224).

`createListingWithFee` increments `listingsUsed` and `dailyAdsUsed` atomically in repository transaction.

---

## 6. Socket

**missing** — no live listing updates or new-listing broadcasts.

---

## 7. Notifications

On successful create (`listings.service.ts`):

```typescript
type: 'fee_due',
titleAr: '✅ تم نشر إعلانك',
bodyAr: `إعلانك "${dto.arabicTitle}" منشور. الرسوم: ${commission} ريال خلال ١٤ يوم.`,
data: { listingId, feeId }
```

Via `AppNotificationsService` → notification queue.

---

## 8. Redis

`RedisCacheService` in `ListingsService`:

| Key | TTL | When |
|-----|-----|------|
| `listings:v2:{json filters}` | 90s | List without search/price filter |
| `listing:{id}` | 300s | Single listing GET |

Invalidation: `delPattern('listings:v2:*')` on create/update/delete; `del(listing:{id})` on update/delete.

---

## 9. BullMQ

**Fee check queue** — `FeeCheckQueueService.scheduleFeeCheck`:

- Queue: `QUEUE_NAMES.FEE_CHECKS`
- Job: `{ listingFeeId, userId, amount }`
- Delay: `dueDate - now + 60_000` ms
- Job id: `fee:{listingFeeId}`
- Skipped if Redis/BullMQ disabled (`cache.isEnabled()` / queue null)

---

## 10. Security

| Control | Implementation |
|---------|----------------|
| Create | JWT + subscription entitlement checks |
| Update/delete | Seller or `ADMIN` |
| Public browse | OptionalAuth on list/detail |
| Rate limiting | `@RateLimit('api')` |
| Image URLs | Validated in DTO (URLs expected after client upload) |
| Featured abuse | Plan-gated `featuredAdsUsed` / `featured_limit` errors |

---

## 11. Possible Bugs

1. **Mobile loads one page** — `AppContext.fetchListings` ignores `nextCursor`; market tab filters in-memory only.
2. **Client vs server search** — `market.tsx` filters loaded listings locally; server supports `search` query but app does not use it on market tab.
3. **Lat/lng not sent** — `create/listing.tsx` captures map coords but `addListing` payload omits them (only text location).
4. **`listing_limit` handler** — `listings.service.ts` catch references `listing_limit` but `assertCanCreateListing` throws `listing_limit` for **daily** ad cap; monthly `listingsUsed` check may be missing in entitlement (verify plan rules).
5. **Delete = sold** — `remove` sets `status: 'sold'` not `deleted` only; semantic confusion.
6. **Featured toggle** — no client-side check against `featuredAdsUsed` before submit; user sees generic error.

---

## 12. Production Readiness (with %)

**75%**

| Ready | Gap |
|-------|-----|
| Full REST CRUD + fees + entitlements | Mobile pagination/search not wired |
| Redis caching + plan-based sort | No socket/real-time market |
| BullMQ fee scheduling | Geo coordinates not persisted from create UI |
| Commission + pledge UX | Plan limit errors could be clearer in app |



---

# FILE: live-comments.md


# Live Stream Comments (Socket)

## 1. Business Purpose

Viewers send real-time comments (and optional price offers) during a live stream. Comments persist to `LiveComment` and broadcast to all viewers in the stream room.

---

## 2. Frontend Flow

### Mobile

| Screen | Usage |
|--------|-------|
| `app/live/watch/[id].tsx` | Emit `live:comment`, listen for incoming comments |
| `app/live/broadcast.tsx` | Host sees comments on `live:comment` |

Uses app socket client with stream room from `live:join`.

---

## 3. API Flow

**No REST** for sending live comments. Optional HTTP for stream metadata via `livestreams` module.

---

## 4. Backend Flow

```
Client emit live:comment (LiveCommentDto)
  → AppGateway.onLiveComment
  → SocketGatewayService.handleLiveComment
    → findLiveStreamForComment (must be isLive)
    → createLiveComment in DB
    → emitToStream(streamId, 'live:comment', comment)
```

**DTO:** `streamId`, `message` (1–500 chars), optional `isOffer`, `offerAmount`.

**Profile:** Username/avatar from user profile at send time.

---

## 5. Database

| Model | Fields |
|-------|--------|
| `LiveComment` | `streamId`, `userId`, `username`, `message`, `isOffer`, `offerAmount`, timestamps |
| `LiveStream` | `comments` relation; `_count.comments` in join stats |

---

## 6. Socket

| Direction | Event | Payload |
|-----------|-------|---------|
| Client → Server | `live:comment` | `LiveCommentDto` |
| Server → Clients | `live:comment` | Full comment object |
| Server → Client | `live:stats` | Includes `commentsCount` on join |

**Room:** `stream:{streamId}` (after `live:join`).

**Errors:** `stream_ended` if stream not live.

---

## 7. Notifications

Live comments do not trigger push notifications (unlike chat DMs).

---

## 8. Redis

Stream list cache `streams:live` separate; comments not cached in Redis.

---

## 9. BullMQ

Not used.

---

## 10. Security

- Requires authenticated socket
- Stream must be live at comment time
- No per-user rate limit on comments in gateway
- Offer amount validated 0.01–10M

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| Comment spam / flood | No throttle |
| Host moderation tools missing | No delete/hide comment API |
| Comments persist after stream ends | No cleanup on end |

---

## 12. Production Readiness: **80%**

Realtime comment path works. Gaps: moderation, rate limits, REST history pagination for VOD.

**Main files:** `backend-nest/src/gateway/app.gateway.ts`, `socket-gateway.service.ts` (`handleLiveComment`)



---

# FILE: live-likes.md


# Live Stream Likes (Socket)

## 1. Business Purpose

Viewers tap like during a live stream to increment aggregate like count, broadcast to all participants in real time.

---

## 2. Frontend Flow

### Mobile

| Screen | Usage |
|--------|-------|
| `app/live/watch/[id].tsx` | Emit `live:like` with `streamId` |
| `app/live/broadcast.tsx` | Listen `live:like` / `live:likes`, update UI |

`useLiveStream` / broadcast screen updates `likes` from `live:stats` on join.

---

## 3. API Flow

No REST endpoint for live likes. Count stored on `LiveStream.likes`.

---

## 4. Backend Flow

```
Client emit live:like (streamId UUID string)
  → AppGateway.onLiveLike
  → SocketGatewayService.handleLiveLike
    → incrementStreamLikes(streamId)
    → emitToStream(streamId, 'live:like', { userId, likes })
    → emitToStream(streamId, 'live:likes', likes)
```

**No per-user deduplication** — each emit increments total.

---

## 5. Database

| Model | Field |
|-------|-------|
| `LiveStream` | `likes` Int (default 0) |

No `LiveLike` join table — cannot list who liked.

---

## 6. Socket

| Direction | Event | Payload |
|-----------|-------|---------|
| Client → Server | `live:like` | `streamId` (string UUID) |
| Server → Clients | `live:like` | `{ userId, likes }` |
| Server → Clients | `live:likes` | number (total) |
| Server → Clients | `live:stats` | `{ viewers, likes, commentsCount }` on join |

---

## 7. Notifications

None.

---

## 8. Redis

Not used for like counts.

---

## 9. BullMQ

Not used.

---

## 10. Security

- Auth required
- No verification stream is live before increment (increment may no-op if stream missing)
- Spam: unlimited likes per user

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| Like inflation | No one-like-per-user constraint |
| Host can spam likes | Same handler for all users |
| Count not reset on stream restart | Persists on `LiveStream` row |

---

## 12. Production Readiness: **70%**

Basic counter + broadcast works. Gaps: deduplication, live check, abuse controls.

**Main files:** `backend-nest/src/gateway/socket-gateway.service.ts` (`handleLiveLike`)



---

# FILE: livestreams.md


# Livestreams

## 1. Business Purpose

Livestreams let eligible sellers **broadcast live video** (Agora RTC) with realtime viewer counts, comments, and likes. Viewers watch via the watch screen; hosts broadcast from the broadcast screen. Access is gated by subscription plan permissions and listing requirements.

**Who uses it:**
- **Hosts** — `app/app/live/create.tsx` → `app/app/live/broadcast.tsx`
- **Viewers** — `app/app/live/watch/[id].tsx`, live tab list `app/app/(tabs)/live.tsx`
- **Followers** — `live_start` notifications when stream starts

---

## 2. Frontend Flow

| Screen | File | Flow |
|--------|------|------|
| Live tab | `app/app/(tabs)/live.tsx` | `GET /api/livestreams` — list live streams |
| Create stream | `app/app/live/create.tsx` | `POST /api/livestreams` → navigate to broadcast with Agora params |
| Host broadcast | `app/app/live/broadcast.tsx` | Agora host + `useLiveSocket` for comments/viewers/likes |
| Watch | `app/app/live/watch/[id].tsx` | Stream info + viewer token + Agora join + `useLiveSocket` |

### `broadcast.tsx`

1. Receives route params: `streamId`, `agoraAppId`, `agoraChannel`, `agoraToken`, `agoraUid`, title, category.
2. `useLiveStream({ role: 'host' })` — joins Agora channel, publishes AV.
3. `useLiveSocket` — `live:join`, comments, viewer/like stats.
4. Calls `POST /api/livestreams/:id?action=start` when going live; `action=end` on stop.

### `watch/[id].tsx`

1. Parallel fetch: `GET /api/livestreams/:id` + `GET /api/livestreams/:id?action=token`.
2. `useLiveStream({ role: 'viewer' })` — subscribes to host video.
3. `useLiveSocket` for comments, viewers, likes.
4. Token refresh via `onTokenWillExpire` → refetch `?action=token`.

### `useLiveSocket` (`app/hooks/useLiveSocket.ts`)

Connects `connectSocket(accessToken)`, emits `live:join` / `live:leave`, listens `live:comment`, `live:viewers`, `live:like`, `live:likes`, `live:stats`. Sends `live:comment`, `live:like`.

---

## 3. API Flow

| Method | URL | Auth | Notes |
|--------|-----|------|-------|
| GET | `/api/livestreams` | Public | List live streams (cached 15s) |
| POST | `/api/livestreams` | JWT | Create stream + host Agora token |
| GET | `/api/livestreams/eligibility` | JWT | Can user stream? plan + listing check |
| GET | `/api/livestreams/:id` | Optional JWT | Stream detail + comments |
| GET | `/api/livestreams/:id?action=token` | JWT required | Viewer Agora token |
| POST | `/api/livestreams/:id?action=start` | JWT (host) | Mark live, notify followers |
| POST | `/api/livestreams/:id?action=end` | JWT (host) | End stream, bill live minutes |

Invalid `action` on GET (other than `token`) → `405 Method Not Allowed`.

### Create response

```json
{
  "streamId", "agoraAppId", "agoraChannel", "agoraToken", "agoraUid"
}
```

### Viewer token response

```json
{
  "agoraAppId", "agoraChannel", "agoraToken", "agoraUid", "expiresIn": 7200
}
```

---

## 4. Backend Flow

```
LivestreamsController → LivestreamsService

listStreams()
  → Redis cache key liveStreams (15s)
  → repo.findLiveStreams()

createStream(user, body)
  → no active stream for host
  → listingsCount > 0
  → subscriptionLifecycle.expireIfNeededForUser
  → entitlements.assertCanCreateLiveStream
  → repo.createStream
  → generateHostToken(streamId, userId) from shared/lib/agora.ts

startStream(id, user)
  → host owns stream, not already live
  → assertCanCreateLiveStream again
  → repo.startStream, invalidate list cache
  → notifyFollowers → live_start notifications

endStream(id, user)
  → repo.endStream
  → incrementLiveMinutes(userId, durationMinutes)
  → invalidate cache

getViewerToken(id, user)
  → stream exists and isLive
  → generateViewerToken(id, userId)
```

Realtime comments/likes/viewers: **Socket.IO** via `SocketGatewayService` (not REST).

---

## 5. Database

Via `LivestreamsRepository` (typical fields):

| Model / fields | Role |
|----------------|------|
| Live stream | `hostId`, `title`, `arabicTitle`, `category`, `isLive`, `viewers`, `peakViewers`, `likes`, `startedAt`, `endedAt` |
| Live comment | `streamId`, `userId`, `message`, `isOffer`, `offerAmount` |
| Subscription.liveMinutesUsed | Incremented on `endStream` by duration minutes |

---

## 6. Socket

**Client → Server:**

| Event | Payload | Handler |
|-------|---------|---------|
| `live:join` | `streamId` | Increment viewers (non-host), emit stats |
| `live:leave` | `streamId` | Decrement viewers |
| `live:comment` | `{ streamId, message, isOffer?, offerAmount? }` | Persist + broadcast |
| `live:like` | `streamId` | Increment likes |

**Server → Client:**

| Event | Room | Data |
|-------|------|------|
| `live:stats` | `stream:{id}` | `{ viewers, likes, commentsCount }` |
| `live:viewers` | `stream:{id}` | count number |
| `live:comment` | `stream:{id}` | comment object |
| `live:like` / `live:likes` | `stream:{id}` | like payload or total |

Room: `stream:{streamId}` (joined on `live:join`).

---

## 7. Notifications

| Trigger | Type | Audience |
|---------|------|----------|
| Stream started | `live_start` | All followers of host |

Via `AppNotificationsService.notifyUsers` with `data: { streamId }`.

---

## 8. Redis

| Key | TTL | Purpose |
|-----|-----|---------|
| Live streams list cache | 15s | `RedisService.CacheKeys.liveStreams()` |

Deleted on start/end stream.

---

## 9. BullMQ

Livestreams do not enqueue dedicated jobs. Follower notifications use the notification queue.

Live minute billing updates `Subscription` directly in `endStream` (usage tied to subscription lifecycle weekly reset job).

---

## 10. Security

- Create/start require plan permission `canCreateLive` and live minutes quota (`SubscriptionEntitlementService`).
- At least one listing required to create stream.
- Host-only `start`/`end`; viewer token requires auth and live stream.
- One active stream per host (409 if exists).
- Optional auth on stream detail GET; token action requires JWT.

---

## 11. Possible Bugs

1. **Viewer count drift** — socket join/leave vs disconnect may desync; negative viewers reset in `handleLiveLeave`.
2. **Host joins as viewer count** — host `live:join` does not increment viewers (by design).
3. **Comments on watch screen** — duplicate comments possible if both REST-loaded history and socket append same IDs (socket only for new).
4. **Expo Go** — `useLiveStream` warns Agora requires dev build.
5. **Eligibility vs create** — race if plan expires between eligibility check and create.

---

## 12. Production Readiness (%)

**83%**

Full create/start/end API, Agora tokens, socket realtime, entitlement gating, and follower notifications are implemented. Needs production Agora credentials, dev-build distribution, and viewer-count hardening.



---

# FILE: messages.md


# Messages (Direct Messaging)

> This feature shares implementation with [chat.md](./chat.md). This document focuses on the **Message** domain model and REST API.

## 1. Business Purpose

Direct messaging lets users send text/image/video messages in 1:1 threads. Messages can reference butcher orders via optional `orderId`.

**Who uses it:** Authenticated users (customers, butchers). Guests cannot send messages.

---

## 2. Frontend Flow

| Entry | File |
|-------|------|
| Profile messages | `app/(tabs)/profile.tsx` → `MessagesPanel` |
| Hidden messages tab | `app/(tabs)/messages.tsx` |
| Butcher messages | `app/(butcher)/messages.tsx` |
| Chat thread UI | `app/butchers/chat.tsx` |

**Hook:** `hooks/useMessageThreads.ts` → `GET /api/messages`

**Navigation:** `/butchers/chat` with params `threadId`, `receiverId`, `receiverName`, `receiverAvatar`.

**State:** No Redux/React Query — local state + `authFetch`.

**Note:** Mobile chat uses **REST only** for send/receive. Backend also supports `chat:*` socket events (see [socket.md](./socket.md)); mobile does not subscribe to them in `butchers/chat.tsx`.

---

## 3. API Flow

Controller: `messages.controller.ts` — prefix `/api/messages`

| Method | URL | Auth | Purpose |
|--------|-----|------|---------|
| GET | `/messages` | JWT | List threads for current user |
| POST | `/messages` | JWT | Send message (creates thread if needed) |
| GET | `/messages/:threadId` | JWT | Paginated messages in thread |

**Send body (`SendMessageDto`):** `receiverId`, `content`, `type` (text/image/video), optional `orderId`, `mediaUrl`.

**Rate limit:** `api` (100/15min).

---

## 4. Backend Flow

```
MessagesController
  → MessagesService
    → MessagesRepository
      → Prisma Message + MessageThread
```

**sendMessage:** Find or create `MessageThread` between two users → insert `Message` → optional socket emit via gateway (`chat:message`, `chat:notification`).

**getThreads:** Returns threads with last message preview, ordered by recent activity.

**Authorization:** User must be participant in thread.

---

## 5. Database

| Model | Purpose |
|-------|---------|
| `MessageThread` | Two participants, unique pair |
| `Message` | Content, type, `senderId`, `threadId`, optional `orderId` |

Relations: `Message` → `User` (sender/receiver), optional `ButcherOrder`.

---

## 6. Socket

See [chat.md](./chat.md) and [socket.md](./socket.md).

| Event | Direction |
|-------|-----------|
| `chat:join` / `chat:leave` | Client → Server |
| `chat:send` | Client → Server (alternative to REST) |
| `chat:message` | Server → `thread:{id}` room |
| `chat:notification` | Server → `user:{receiverId}` |
| `chat:typing`, `chat:read` | Bidirectional |

---

## 7. Notifications

New message → `chat:notification` socket to receiver. May also enqueue in-app notification via message service (verify `messages.service.ts` for `AppNotificationsService` calls).

Push: If notification persisted and receiver has `fcmToken`.

---

## 8. Redis

No message-specific cache keys documented in `messages/` module.

---

## 9. BullMQ

Messages do not enqueue dedicated jobs. Notifications may use `notifications` queue indirectly.

---

## 10. Security

- Thread access restricted to participants
- `receiverId` must be valid active user
- Rate limited under global API limit
- Media URLs should come from upload service

---

## 11. Possible Bugs / Risks

| Risk | Notes |
|------|-------|
| Mobile REST-only vs socket on backend | Duplicate delivery patterns if both used |
| No E2E encryption | Messages stored plaintext in DB |
| Order-linked messages | `orderId` optional; validation depth varies |

---

## 12. Production Readiness: **85%**

REST API and backend sockets exist; mobile does not use sockets for chat. See [chat.md](./chat.md) for full chat flow.

**Main files:** `backend-nest/src/messages/`, `app/hooks/useMessageThreads.ts`, `app/butchers/chat.tsx`



---

# FILE: moderation.md


# Content Moderation (Admin)

## 1. Business Purpose

Staff hide inappropriate **posts** and **suspend listings** (plus soft-delete) from the admin panel without deleting user accounts.

**Who uses it:** `ADMIN` and `MODERATOR`.

---

## 2. Frontend Flow

### Admin panel

| Screen | Action |
|--------|--------|
| `posts/page.tsx` | Filter hidden posts; toggle `isHidden`; delete |
| `listings/page.tsx` | Set listing `status` including `suspended`; delete |

Uses `ResourcePage` + `admin.service.ts` helpers.

---

## 3. API Flow

### Posts

| Method | URL | Body |
|--------|-----|------|
| GET | `/admin/posts?hidden=true\|false` | — |
| PATCH | `/admin/posts/:id` | `{ isHidden: boolean }` |
| DELETE | `/admin/posts/:id` | Sets `isHidden: true` + soft delete |

### Listings

| Method | URL | Body |
|--------|-----|------|
| GET | `/admin/listings?status=suspended` | — |
| PATCH | `/admin/listings/:id` | `{ status: 'active'\|'sold'\|'expired'\|'pending_fee'\|'suspended' }` |
| DELETE | `/admin/listings/:id` | Sets `status: 'suspended'` + soft delete |

**Schemas:** `updatePostSchema`, `updateListingSchema` in `admin/dto/admin.dto.ts`.

---

## 4. Backend Flow

```
AdminService.updatePost / deletePost / updateListing / deleteListing
  → AdminRepository
```

**Post hide:** `isHidden: true` — post remains in DB, excluded from public feeds when queries filter hidden (verify feed queries use `isHidden: false`).

**Listing suspend:** `status: 'suspended'` — listing excluded from `listings.service` which filters `status: 'active'`.

**Dashboard stats:** Counts `hiddenPosts` and `suspendedListings` in `getDashboardStats`.

---

## 5. Database

| Model | Moderation fields |
|-------|-------------------|
| `Post` | `isHidden`, `deletedAt` |
| `Listing` | `status` (incl. `suspended`), `deletedAt` |

---

## 6. Socket

Not used for moderation events. Hidden posts do not trigger socket fanout.

---

## 7. Notifications

**Not implemented:** No automatic notify to author when post hidden or listing suspended.

---

## 8. Redis

Post/listing caches may serve stale data until TTL expires. **Missing:** explicit cache invalidation on admin update.

---

## 9. BullMQ

Not used.

---

## 10. Security

- Moderator and admin share same moderation endpoints
- No appeal workflow API
- Delete is soft archive with retention purge via cron

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| Stale listing cache | `listing:{id}` may remain until TTL |
| Hidden post may still appear in direct link | Depends on `getPost` query |
| DELETE post forces hidden | Cannot hard delete from panel |

---

## 12. Production Readiness: **78%**

Core hide/suspend works. Gaps: author notification, cache bust, audit log.

**Main files:** `backend-nest/src/admin/`, `admin-panel/.../posts/`, `listings/`



---

# FILE: notifications.md


# In-App Notifications

## 1. Business Purpose

In-app notifications give users a persistent Arabic inbox for social, commerce, subscription, and system events. Push alerts are a separate layer (see `push-notifications.md`); this feature is the **read/mark-read REST inbox** backed by PostgreSQL.

**Who uses it:** Authenticated mobile users (`USER` role). Staff do not have a dedicated admin inbox; they may receive `system` notifications on mobile if logged in as admin.

---

## 2. Frontend Flow

### Mobile (`app/`)

| Screen | Path | Trigger |
|--------|------|---------|
| Notification center | `app/notifications/index.tsx` | Profile tab, bell icon, or deep link |

**State:** `hooks/useNotificationsList.ts` — cursor pagination, mark read, mark all read.

**Flow:**
1. `GET /api/notifications` — load first page + `unreadCount`
2. Tap row → `markAsRead(id)` → `PATCH /api/notifications` with `{ ids: [id] }`
3. `handleNotificationNavigation()` from `lib/notifications.ts` routes by `type` + `data`
4. Header “mark all” → `PATCH /api/notifications` with `{}` (no ids = all read)
5. Unread badge elsewhere: `hooks/useUnreadNotificationCount.ts` → `GET /api/notifications/unread-count`

**Sockets:** Optional realtime mark-read via `notifications:read` (see `socket.md`). No server push of new inbox rows over socket in current code.

---

## 3. API Flow

Base: `/api/notifications` — `notifications.controller.ts`

| Method | URL | Auth | Rate limit |
|--------|-----|------|------------|
| GET | `/notifications` | JWT | `api` |
| PATCH | `/notifications` | JWT | `api` |
| GET | `/notifications/unread-count` | JWT | `api` |

**Query params (GET list):** `cursor` — UUID of last item for pagination (page size 30).

**PATCH body:** `{ ids?: string[] }` — max 100 UUIDs; omit or empty `ids` to mark **all** read.

**Response envelope:** `{ success: true, data: { notifications, nextCursor, hasMore, unreadCount } }`

---

## 4. Backend Flow

### Write path (async pipeline)

```
Domain service (posts, orders, stories, …)
  → AppNotificationsService.notifyUser()
    → NotificationQueueService.addNotification({ name: 'create', … })
      → NotificationProcessor
        → NotificationPersistService.persistNotificationAndEnqueuePush()
          → Prisma Notification.create
          → PushQueueService.addPush() (if fcmToken)
```

`AppNotificationsService` (`queue/services/app-notifications.service.ts`) stringifies `data` values and swallows enqueue errors (logs warning).

### Read path (sync REST)

```
NotificationsController
  → NotificationsService
    → NotificationsRepository (findMany, countUnread, markRead)
```

---

## 5. Database

| Model | Purpose |
|-------|---------|
| `Notification` | `userId`, `type` (`NotificationType` enum), `titleAr`, `bodyAr`, `data` (JSON), `isRead`, `readAt` |

**Indexes:** `userId`, `(userId, isRead)`, `createdAt`.

**Cleanup:** Daily cron deletes read notifications older than 90 days (`admin.repository.runCleanup`).

**NotificationType enum:** `like`, `follow`, `comment`, `repost`, `offer`, `order_update`, `fee_due`, `subscription_renew`, `new_message`, `live_start`, `system`, `story_reaction`, `story_reply`.

---

## 6. Socket

| Client → Server | Purpose |
|-----------------|---------|
| `notifications:read` | Body: array of notification UUIDs (max 50). Marks read in DB via `SocketRepository.markNotificationsRead`. |

No server→client `notification:new` event is emitted when a notification is created.

---

## 7. Notifications

This module **is** the notification inbox. Creation is always via `AppNotificationsService` → BullMQ (not direct REST create).

Producers include: `posts.service`, `messages.service`, `order-lifecycle.service`, `listings.service`, `livestreams.service`, `stories.service`, `subscription-lifecycle.service`, `butcher-application-notifications.service`, `socket-gateway.service` (chat), `fee-check.processor`.

---

## 8. Redis

Feed-related cache keys are invalidated by story/post flows; the notification inbox itself is **not** Redis-cached.

Story feed cache (`stories:feed:*`) is separate — see `story-viewer.md`.

---

## 9. BullMQ

| Queue | Job | Processor |
|-------|-----|-----------|
| `notifications` | `create` | `NotificationProcessor` → persist + enqueue push |

If Redis/BullMQ disabled, `NotificationQueueService` no-ops; notifications are **not** persisted.

---

## 10. Security

- All REST endpoints require JWT (`JwtAuthGuard`).
- Users can only list/mark their own notifications (`userId` from token).
- `data` payload may contain entity IDs; navigation is client-side only.

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| Notifications lost when Redis off | Queue required for persist path |
| No realtime inbox refresh | Client must poll or pull on focus |
| `notifyUser` failures silent | Caught and logged in `AppNotificationsService` |
| Socket `notifications:read` accepts raw array, not DTO | `socket-gateway.service.ts` — inconsistent with REST validation |

---

## 12. Production Readiness: **88%**

REST inbox and async persist pipeline are solid. Gaps: no push-to-socket for new rows, queue dependency for durability.

**Main files:** `backend-nest/src/notifications/`, `backend-nest/src/queue/services/app-notifications.service.ts`, `app/app/notifications/index.tsx`



---

# FILE: orders.md


# Order Management

## 1. Business Purpose

Order management lets **customers** place meat orders from **butchers**, and lets **butchers** advance orders through a fulfillment pipeline. **Admins** monitor orders read-only.

**Who uses it:**
- Customer: place order, view details, realtime status
- Butcher: receive orders, confirm/prepare/ready/deliver/cancel
- Admin: list, filter, view audit (no status mutation in UI)

---

## 2. Frontend Flow

### Customer

| Screen | File | Entry |
|--------|------|-------|
| Place order | `app/butchers/order.tsx` | From butcher profile `[id].tsx` |
| Success | `app/butchers/order-success.tsx` | After `POST /orders` |
| Order details | `app/butchers/order/[id].tsx` | "تتبع الطلب" button |

**Hooks:** `hooks/useOrderSocket.ts` — listens `order.updated`, `order.cancelled`, `order.timeline.updated`, `inventory.updated`.

**No Redux/React Query** — `useState` + `fetch` + socket refresh.

### Butcher

| Screen | File |
|--------|------|
| Manage orders tab | `app/(butcher)/manage.tsx` |

- Loads `GET /api/butchers/orders`
- Status buttons call `PUT /api/butchers/orders/:id` with `{ status }`
- Cancel: modal with predefined/custom `cancellationReason`
- Socket listeners refresh order list

### Admin

| Screen | File |
|--------|------|
| Orders list | `admin-panel/.../orders/page.tsx` |
| Order detail | `admin-panel/.../orders/[id]/page.tsx` |

`useAdminOrderSocket` for realtime table refresh. Read-only.

---

## 3. API Flow

| Method | URL | Auth | Body |
|--------|-----|------|------|
| GET | `/api/butchers/orders` | JWT (butcher or customer) | — |
| POST | `/api/butchers/orders` | JWT (customer) | `butcherId`, `productId`, `cutType`, `weightKg`, `deliveryType`, `notes`, etc. |
| PUT | `/api/butchers/orders/:id` | JWT (butcher owner) | `{ status, cancellationReason? }` |
| GET | `/api/butchers/orders/:id` | JWT (customer, butcher, admin) | — |
| GET | `/api/admin/orders` | ADMIN/MODERATOR | query filters |
| GET | `/api/admin/orders/:id` | ADMIN/MODERATOR | — |

**Status codes:** 201 create, 200 update, 409 invalid transition / insufficient inventory, 404 not found, 403 forbidden.

---

## 4. Backend Flow

```
ButchersController
  → ButchersService.createOrder / updateOrder / getOrderById
    → OrderLifecycleService (ONLY path for status changes)
      → OrderStateMachineService.assertTransition
      → Prisma $transaction:
          SELECT ... FOR UPDATE OF o
          → inventory UPDATE ... WHERE
          → butcherOrder.update
          → orderTimeline.create
          → orderStatusAudit.create
      → AppNotificationsService (customer, butcher, staff)
      → SocketEmitService (customer, butcher, admin.*)
```

**Same-status no-op:** If `locked.status === nextStatus`, return order without timeline/audit/notifications/sockets.

**State machine:**
```
pending → confirmed | cancelled
confirmed → preparing | cancelled
preparing → ready
ready → delivered
```

**Inventory:**
- Create: reserve `reservedQuantity` on `ButcherProduct`
- Cancel: release reservation
- Deliver: decrement `reservedQuantity` and `availableQuantity`

---

## 5. Database

| Model | Role |
|-------|------|
| `ButcherOrder` | Order record, `orderNumber`, status, pricing, cancellation fields |
| `OrderTimeline` | Status history events |
| `OrderStatusAudit` | Audit trail |
| `OrderNumberSequence` | `ORD-YYYY-######` generation |
| `ButcherProduct` | `availableQuantity`, `reservedQuantity` |

Relations: Order → Butcher, Customer (User), Product.

---

## 6. Socket

| Event | Emitter | Listeners |
|-------|---------|-----------|
| `order.created` | `OrderLifecycleService` | Butcher manage, admin orders |
| `order.updated`, `order:updated` | Lifecycle | Customer detail, butcher |
| `order.timeline.updated` | Lifecycle | Customer, butcher |
| `order.cancelled` | Lifecycle | All parties |
| `inventory.updated` | Lifecycle | Product inventory UIs |
| `admin.order.*` | Broadcast | Admin dashboard |

**Client → Server:** `order:status` on socket (butcher) → `handleOrderStatus` → `transitionOrder`.

---

## 7. Notifications

On create and every transition:
- **DB + Push:** Customer, butcher user, all ADMIN/MODERATOR staff via `notifyOrderParties`
- **Socket:** Realtime UI refresh (not a separate notification inbox event)

Cancel includes `cancellationReason` in timeline note.

---

## 8. Redis

Order rows are not cached. Rate limiting uses `rl:api`. No order-specific Redis keys.

---

## 9. BullMQ

Orders do not enqueue BullMQ jobs directly. Notifications go through `notifications` → `push-notifications` queues.

---

## 10. Security

- Customer can only create orders as self (`customerId` from JWT)
- Butcher can only update own shop orders
- Admin/moderator can read any order
- Status changes **only** via `OrderLifecycleService` (repo bypass methods removed)
- Concurrency: PostgreSQL `FOR UPDATE` row lock in transaction
- Invalid transitions: HTTP 409

---

## 11. Possible Bugs / Risks

| Risk | Notes |
|------|-------|
| Admin cannot mutate status from UI | By design; may need ops tooling |
| Socket disconnect on mobile background | Client may miss events until reconnect |
| Product `availableQuantity` 0 blocks orders | Must set on product create |
| No E2E concurrency integration test | Unit tests mock transaction |

---

## 12. Production Readiness: **91%**

Lifecycle, inventory, notifications, sockets, and UIs are implemented. Gaps: admin write actions, integration test coverage.

**Main files:**
- `backend-nest/src/butchers/services/order-lifecycle.service.ts`
- `backend-nest/src/butchers/services/order-state-machine.service.ts`
- `app/app/butchers/order/[id].tsx`
- `app/app/(butcher)/manage.tsx`
- `admin-panel/src/app/(dashboard)/orders/`



---

# FILE: payments.md


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



---

# FILE: payment-webhooks.md


# Payment Webhooks (Network International)

## 1. Business Purpose

The webhook endpoint receives asynchronous payment events from **Network International** and updates internal `Payment` records, fulfills subscriptions/listing fees, handles refunds, and triggers user notifications. It is the **only** path that marks payments `paid` after hosted checkout.

**Who uses it:**
- **Network International** — POSTs order lifecycle events
- **Backend** — `PaymentsService.handleNIWebhook()` drives all post-checkout state changes

---

## 2. Frontend Flow

No frontend directly calls the webhook. Mobile apps open NI `checkoutUrl` and rely on backend webhook processing.

**Indirect client behavior:**
- `app/app/payment.tsx` — user returns manually; calls `refetchSubscription()`
- `app/app/fees.tsx` — `fetchFees()` after payment alert (depends on missing `GET /api/fees`)

---

## 3. API Flow

| Method | URL | Auth | Headers | Body |
|--------|-----|------|---------|------|
| POST | `/api/payments/webhook` | None (`@Public()`) | `x-signature` **or** `x-ni-signature` | Raw JSON (not standard `json()` parser) |

**Controller:** `backend-nest/src/payments/payments.controller.ts`

```typescript
@RawBody()
@Public()
@Post('webhook')
async webhook(@Req() req, @Res() res, @Headers('x-signature') xSignature?, @Headers('x-ni-signature') xNiSignature?)
```

**Signature verification responses:**
- `401 { error: 'invalid_signature' }` — HMAC mismatch
- `401 { error: 'missing_signature' }` — production without secret/signature

**Processing response:**
- `200 { received: true }` — always returned after `processWebhook` (even on internal errors)
- `400 { error: 'invalid_json' }` — malformed body

**Global prefix:** `/api` (`main.ts`). Alternate alias `/api/v1/payments/webhook` rewritten to `/api/...`.

**Body parser bypass:** `main.ts` skips default JSON middleware for `/api/payments/webhook`; `RawBodyMiddleware` captures raw string into `req.rawBody`.

---

## 4. Backend Flow

```
POST /api/payments/webhook
  → PaymentsController.webhook
    → PaymentsService.verifyWebhookSignature(rawBody, signature)
    → PaymentsService.processWebhook(rawBody)
      → JSON.parse(rawBody)
      → handleNIWebhook(event)
```

### `handleNIWebhook` (`payments.service.ts`)

1. **Parse event:** `order = event.order ?? event`; `eventType = event.eventName ?? event.type`.
2. **Resolve payment:**
   - `merchantOrderRef` from `merchantAttributes.merchantOrderReference`, `order.reference`, etc.
   - `internalPaymentId` from `order.customData.paymentId` (set at initiate).
   - `PaymentsRepository.findPaymentForWebhook(internalPaymentId, merchantOrderRef)`.
3. **Extract metadata:** `type`, `referenceId`, `userId`, `targetPlanId`, `billingCycle` from DB row + stored/custom metadata.
4. **Refund branch** (if `payment.status === 'paid'` and refund event):
   - Events: `ORDER.REVERSED`, `ORDER.REFUNDED`, `ORDER.PARTIALLY_REFUNDED` or states `REVERSED`, `REFUNDED`, `PARTIALLY_REFUNDED`.
   - `markPaymentRefunded()` → if subscription fulfilled, `subscriptionLifecycle.downgradeUser(..., 'refund')`.
5. **Idempotency:** skip if already `refunded`, `paid`, or `failed` (except refund branch above).
6. **Success branch:**
   - Events: `ORDER.PAID`, `ORDER.CAPTURED`, `ORDER.AUTHORISED` or states `CAPTURED`, `AUTHORISED`, `PURCHASED`.
   - `PaymentsRepository.processSuccessfulPayment({...})`.
   - `subscriptionCache.invalidate(userId)`.
   - Notify renewal success or generic payment success.
7. **Failure branch:**
   - Events: `ORDER.FAILED`, `ORDER.REVERSED`, `ORDER.CANCELLED` or states `FAILED`, `REVERSED`, `CANCELLED`.
   - `markPaymentFailedById()` + failure notifications.

### HMAC verification (`verifyNISignature`)

```typescript
crypto.createHmac('sha256', NI_WEBHOOK_SECRET).update(body).digest('hex')
crypto.timingSafeEqual(expected, signature.replace(/^sha256=/, ''))
```

If `NI_WEBHOOK_SECRET` is unset, verification is **skipped** except in production (rejected).

### `processSuccessfulPayment` (`payments.repository.ts`)

Transactional:
1. `UPDATE Payment SET status='paid' WHERE id=? AND status='pending'` — returns `{ processed: false }` if no row updated (race/idempotent).
2. Subscription: extend `renewDate`, update plan, reset counters, set `metadata.subscriptionFulfilled = true`.
3. Fee: `ListingFee.status = paid`, `Listing.status = active`.

---

## 5. Database

**Tables touched:**
- `Payment` — status, `transactionId`, `paidAt`, `metadata`
- `Subscription` — on subscription payments
- `ListingFee`, `Listing` — on fee payments
- `User.verified`, `Butcher.subscriptionActive` — side effects on subscription fulfillment

**Payment lookup:**
```sql
WHERE id = :internalPaymentId OR orderId = :merchantOrderRef
```

---

## 6. Socket

Webhooks do not emit socket events.

---

## 7. Notifications

| Outcome | Service | Notification |
|---------|---------|--------------|
| Success (subscription) | `SubscriptionLifecycleService.notifyRenewalSuccess` | `subscription_renew` + optional email |
| Success (fee/other) | `AppNotificationsService.notifyUser` | `system` — "تم الدفع بنجاح" |
| Failure | `notifyRenewalFailed` or `notifyUser` | `subscription_renew` or `system` |
| Refund | `notifyUser` | `system` — "تم استرداد الدفع" |

All via BullMQ notification/email queues.

---

## 8. Redis

`SubscriptionCacheService.invalidate(userId)` after success and refund.

No webhook-specific Redis keys.

---

## 9. BullMQ

Webhook handler does not enqueue BullMQ jobs directly. Notifications and emails are queued asynchronously by `AppNotificationsService` / `EmailQueueService`.

---

## 10. Security

- **HMAC-SHA256** with `NI_WEBHOOK_SECRET`; timing-safe comparison.
- Production **requires** signature when secret is configured; missing signature returns 401.
- Endpoint is public — signature is the primary auth layer.
- Raw body required — re-parsing JSON from parsed body would break HMAC.
- CORS allows `x-signature` and `x-ni-signature` headers (`main.ts`).
- Errors in `handleNIWebhook` are logged but webhook still returns 200 to avoid NI retry storms (may mask failures).

---

## 11. Possible Bugs

1. **Always 200 on handler errors** — `processWebhook` catches exceptions and still returns `{ received: true }`; NI will not retry failed fulfillments.
2. **`ORDER.REVERSED` in both refund and failure lists** — handled correctly for `paid` (refund first) but confusing for `pending` payments.
3. **No webhook event persistence** — no audit log of raw events for dispute debugging.
4. **Partial refunds** — `PARTIALLY_REFUNDED` triggers full subscription downgrade if `subscriptionFulfilled === true`.
5. **Missing payment** — unknown `merchantOrderRef` logs warning and returns silently (200 to NI).
6. **Non-production skips signature** — dev environments accept unsigned webhooks.

---

## 12. Production Readiness (%)

**82%**

HMAC verification, raw body handling, idempotent `updateMany` on pay, and refund/downgrade paths are production-grade. Weaknesses: silent error swallowing, no event store, and no admin replay tool.



---

# FILE: pinned-listings.md


# Pinned Listings

## 1. Business Purpose

Subscription plans define `monthlyPinnedAds` limits intended for **pinned** listings (top placement). Usage counters exist on subscriptions, but **full pinned listing behavior is not implemented**.

---

## 2. Frontend Flow

### Mobile

- `SubscriptionContext` exposes `pinnedAdsUsed` from subscription API
- Plan marketing copy in `subscriptionPlans.ts` may mention pinned ads
- **No UI found** to pin a listing at create time (no `pinned` in `CreateListingDto` or create listing screen)

---

## 3. API Flow

**Missing public API** for pinned listings.

`SubscriptionEntitlementService.assertCanCreateListing` accepts `pinned?: boolean` and enforces `monthlyPinnedAds` limit, but:

- `ListingsService.create()` only passes `featured`, never `pinned`
- `CreateListingDto` has no `pinned` field
- `Listing` model has **no `pinned` column** in Prisma schema (only `featured`)

---

## 4. Backend Flow

**Partial implementation:**

```
assertCanCreateListing(..., { pinned: true })  // would check plan + pinnedAdsUsed
ListingsRepository.createListingWithFee({ pinned?: boolean })
  → if pinned: pinnedAdsUsed increment on subscription
```

**Never called with `pinned: true` from listings service.**

---

## 5. Database

| Model | Field | Status |
|-------|-------|--------|
| `Subscription` | `pinnedAdsUsed` | **Implemented** — incremented only if pinned create path used |
| `Listing` | `pinned` | **Missing** — not in schema |

---

## 6. Socket

Not used.

---

## 7. Notifications

None.

---

## 8. Redis

Listing list cache does not account for pinned (N/A).

---

## 9. BullMQ

Monthly reset clears `pinnedAdsUsed` with other counters.

---

## 10. Security

N/A until API exists.

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| **Feature incomplete** | Entitlement without Listing field or API |
| Users see limit in subscription UI but cannot use | `pinnedAdsUsed` always 0 |
| Misleading plan marketing | `monthlyPinnedAds` in seed plans |

---

## 12. Production Readiness: **25%**

Plan plumbing only. **Missing:** `Listing.pinned`, create/update API, list sort, mobile UI.

**Main files:** `subscription-entitlement.service.ts`, `listings.repository.ts` (pinned increment stub)



---

# FILE: plans.md


# Plans

## 1. Business Purpose

Plans define **pricing**, **audience** (`USER` vs `BUTCHER`), and **feature permissions** (live streaming, ad limits, store commission, verified badge, etc.) stored in PostgreSQL. The app and backend resolve permissions from the database rather than hardcoded tiers.

**Who uses it:**
- **Mobile app** — `usePlans`, subscription/payment screens, entitlement-gated features
- **Admin panel** — plan CRUD and feature editing
- **Backend** — payments (price validation), subscriptions, listings, livestreams, commissions

---

## 2. Frontend Flow

### Mobile (`app/hooks/usePlans.ts`)

1. `GET /api/plans?audience={USER|BUTCHER}` on mount.
2. Maps API rows via `mapApiPlan()` from `app/services/subscriptionPlans.ts`.
3. Returns `{ plans, loading, getPlanBySlug, refetch }`.

**Consumers:**
| File | Usage |
|------|-------|
| `app/app/subscription.tsx` | Plan cards, pricing, upgrade CTA |
| `app/app/payment.tsx` | Amount, gradient colors, plan name |
| `app/contexts/SubscriptionContext.tsx` | Plan catalog for current subscription |
| `app/app/fees.tsx` | Plan display on subscription tab |

### Admin (`admin-panel`)

| Screen | File | API |
|--------|------|-----|
| Plans list | `admin-panel/src/app/(dashboard)/plans/page.tsx` | `GET /api/admin/plans` |
| Plan detail/edit | `admin-panel/src/app/(dashboard)/plans/[id]/page.tsx` | `GET/PATCH /api/admin/plans/:id` |

`admin.service.ts`: `fetchPlans`, `createPlan`, `updatePlan`, `deactivatePlan`, `duplicatePlan`, `deletePlan`, `fetchFeatureCatalog`.

---

## 3. API Flow

### Public

| Method | URL | Auth | Query |
|--------|-----|------|-------|
| GET | `/api/plans` | Public | `?audience=USER` \| `BUTCHER` (optional) |

Response: `{ success: true, data: { plans: PlanApiResponse[] } }`

### Admin (`AdminPlansController` — `backend-nest/src/plans/admin-plans.controller.ts`)

| Method | URL | Roles |
|--------|-----|-------|
| GET | `/api/admin/plans` | ADMIN, MODERATOR |
| GET | `/api/admin/plans/feature-catalog/list` | ADMIN, MODERATOR |
| GET | `/api/admin/plans/:id` | ADMIN, MODERATOR |
| POST | `/api/admin/plans` | ADMIN |
| PATCH | `/api/admin/plans/:id` | ADMIN |
| PATCH | `/api/admin/plans/:id/features` | ADMIN |
| POST | `/api/admin/plans/:id/deactivate` | ADMIN |
| POST | `/api/admin/plans/:id/duplicate` | ADMIN |
| DELETE | `/api/admin/plans/:id` | ADMIN |

---

## 4. Backend Flow

```
PlansController.getPlans
  → PlansService.getPlans(audience)
    → PlanResolverService.refreshCache()
    → getActiveByAudience / getAllActive
    → toApiResponse() per plan

Admin mutations
  → PlansRepository create/update/delete
  → PlanResolverService.refreshCache()

Entitlement checks (elsewhere)
  → PlanPermissionService.resolveEffective(planSlug, audience, hasPaidAccess)
  → PlanPermissionService.canCreateLive, maxAdsPer24Hours, storeCommission, etc.
```

### `PlanPermissionService` (`plan-permission.service.ts`)

| Method | Permission key |
|--------|----------------|
| `resolveForUser` / `resolveEffective` | Full context; falls back to default free plan |
| `canCreateLive` | `canCreateLive` |
| `maxAdsPer24Hours` | `maxAdsPer24Hours` |
| `monthlyFeaturedAds` | `monthlyFeaturedAds` |
| `monthlyPinnedAds` | `monthlyPinnedAds` |
| `monthlyLiveHours` / `monthlyLiveMinutes` | `monthlyLiveHours` |
| `hasPrioritySearch` / `hasPriorityHome` | priority flags |
| `hasVerifiedBadge` | `verifiedBadge` |
| `storeCommission` | `storeCommission` (default 5) |
| `isStoreExempt` | commission <= 0 |
| `priorityBoost` | composite ranking boost |

### `PlanResolverService`

In-memory `Map` cache keyed `audience:slug`, refreshed from `Plan` + `PlanFeature` rows on module init and after admin changes.

### Payments integration

`PaymentsService.initiate` uses:
- `PlansService.getUpgradablePlans(audience)`
- `PlansService.getPlanPrice(slug, audience, billingCycle)`

---

## 5. Database

### `Plan`

| Field | Notes |
|-------|-------|
| `slug`, `audience` | Unique together |
| `monthlyPrice`, `yearlyPrice` | SAR default |
| `sortOrder` | Upgrade ordering |
| `isActive` | Hidden when false |

### `PlanFeature`

| Field | Notes |
|-------|-------|
| `key` | e.g. `canCreateLive`, `storeCommission` |
| `value` | string stored |
| `valueType` | `BOOLEAN` \| `NUMBER` \| `STRING` \| `JSON` |

`buildPermissions(features)` in `plan.types.ts` converts features to `PlanPermissions` object.

Seed script: `backend-nest/scripts/seed-plans.ts`  
Migration: `prisma/migrations/20250707000000_database_driven_plans/`

---

## 6. Socket

Plans do not use socket events.

---

## 7. Notifications

No plan-specific notifications. Plan changes affect users on next subscription fetch or payment fulfillment notification.

---

## 8. Redis

`PlanResolverService` uses **in-process memory cache**, not Redis.

Subscription cache (`subscription:{userId}`) holds resolved plan in API payload.

---

## 9. BullMQ

Plans module does not enqueue BullMQ jobs.

---

## 10. Security

- Public plan list exposes pricing and features only (no secrets).
- Admin routes require `ADMIN` or `MODERATOR` (`@Roles`).
- Create/update/delete restricted to `ADMIN`.
- Delete blocked if plan in use (`plan_in_use` error).
- Payment initiate validates slug against upgradable list server-side.

---

## 11. Possible Bugs

1. **In-memory plan cache per instance** — admin changes may take until `refreshCache` on each instance; no Redis pub/sub invalidation.
2. **Legacy slug normalization** — `normalizePlanSlug` accepts old slugs (`starter`/`pro`/`vip`); mismatch risk if DB only has new slugs.
3. **`getUpgradablePlans` logic** — must align with `subscription.tsx` `isUpgrade` sortOrder UI.
4. **Free plan row required per audience** — downgrade assumes `slug_audience: { slug: 'free', audience }` exists.

---

## 12. Production Readiness (%)

**88%**

Database-driven plans with admin CRUD, feature catalog, permission service, and payment price validation are production-ready. Minor gaps: distributed cache coherence and reliance on seed data for free tier rows.



---

# FILE: posts.md


# Posts (Feed, Create, Interactions)

## 1. Business Purpose

Text-first social posts (Arabic + English content, optional image) with likes, reposts, and comments. Global chronological feed; authors can create, edit, and delete own posts. New posts notify followers via push queue.

**Primary users:** All app users; guests can read feed with reduced interaction.

**Key files:** `backend-nest/src/posts/posts.controller.ts`, `backend-nest/src/posts/posts.service.ts`, `app/contexts/AppContext.tsx`, `app/app/(tabs)/posts.tsx`, `app/app/create/post.tsx`.

---

## 2. Frontend Flow

| Screen | Path | Role |
|--------|------|------|
| Posts tab | `app/app/(tabs)/posts.tsx` | Renders `posts` from `useApp()`; category filter is **client-side** substring match on `arabicContent` / `content` |
| Create / edit | `app/app/create/post.tsx` | Create via `addPost`; edit loads `GET /api/posts/:editId` then `updatePost` |
| Comments | `PostCommentsModal` in posts tab | `addComment(postId, content)` |

**AppContext** (`app/contexts/AppContext.tsx`):

| Method | API |
|--------|-----|
| `fetchPosts` (on auth) | `GET /api/posts` |
| `addPost` | `POST /api/posts` |
| `updatePost` | `PUT /api/posts/:id` |
| `deletePost` | `DELETE /api/posts/:id` |
| `toggleLike` | `POST /api/posts/:id/like` |
| `toggleRepost` | `POST /api/posts/:id/repost` |
| `addComment` | `POST /api/posts/:id/comments` |

**Deep link:** `posts.tsx` accepts `postId` + `openComments=1` to open comments modal.

**Create post UI gaps:** `POST_TYPES` (image, poll, listing) and toolbar buttons are visual only — submit sends `content` + `arabicContent` only (no `image` upload wired in `handlePost`).

---

## 3. API Flow

Controller: `PostsController` — prefix `/api/posts`

| Method | Endpoint | Auth | Body / Query | Response |
|--------|----------|------|--------------|----------|
| GET | `/posts` | OptionalAuth | `cursor?`, `userId?` (author filter) | `{ posts, nextCursor, hasMore }` |
| POST | `/posts` | JWT | `CreatePostDto` | Created post + author |
| GET | `/posts/:id` | OptionalAuth | — | Post + `liked`, `reposted`, counts |
| PUT | `/posts/:id` | JWT | `UpdatePostDto` | Updated post |
| DELETE | `/posts/:id` | JWT | — | `{ deleted: true }` |
| POST | `/posts/:id/like` | JWT | — | `{ liked: boolean }` |
| POST | `/posts/:id/repost` | JWT | — | `{ reposted: boolean }` |
| GET | `/posts/:id/comments` | OptionalAuth | — | `{ comments }` |
| POST | `/posts/:id/comments` | JWT | `{ content }` | Comment + author |

**DTO limits:** post text max 280 chars; comment max 500 chars.

---

## 4. Backend Flow

```
PostsController → PostsService → PostsRepository → Prisma
```

**getFeed:**

1. Build cache key `posts:feed:{cursor}` or `posts:user:{authorId}:{cursor}`
2. Query `findFeed` — `notDeleted`, `isHidden: false`, order `createdAt desc`, page 20+1
3. If viewer: batch `findLikesByUser` + `findRepostsByUser`
4. Map `likesCount`, `repostsCount`, `commentsCount`, `liked`, `reposted`
5. Cache result 60s

**createPost:** `repo.create` → notify up to 500 followers (`type: 'system'`, title منشور جديد) → invalidate `posts:feed:first`

**toggleLike / toggleRepost:** transaction on `PostLike`/`PostRepost` + increment/decrement denormalized counts on `Post`

**deletePost:** soft delete (`deletedAt`, `isHidden: true`)

---

## 5. Database

| Model | Purpose |
|-------|---------|
| `Post` | `content`, `arabicContent`, `image?`, counts, `isHidden`, soft delete |
| `PostLike` | `@@unique([postId, userId])` |
| `PostRepost` | `@@unique([postId, userId])` |
| `PostComment` | `postId`, `authorId`, `content` |
| `Follow` | Used to find follower IDs for new-post notifications |

**Schema:** `backend-nest/prisma/schema.prisma` — `Post` (lines 262–284), `PostLike`, `PostRepost`, `PostComment`.

Indexes: `authorId`, `createdAt`, `deletedAt` on `Post`; `postId` on comments.

---

## 6. Socket

**missing** — no WebSocket events for new posts, likes, or comments. Feed updates require pull/refetch (`AppContext.refetchData`).

---

## 7. Notifications

| Event | Recipient | `type` | Service call |
|-------|-----------|--------|--------------|
| New post | Up to 500 followers | `system` | `notifyUsers(followerIds, ...)` |
| Like | Post author (not self) | `like` | `notifyUser` |
| Repost | Post author (not self) | `repost` | `notifyUser` |
| Comment | Post author (not self) | `comment` | `notifyUser` |

All via `AppNotificationsService` → BullMQ notification queue.

---

## 8. Redis

Uses `RedisCacheService` (`posts.service.ts`):

| Key pattern | TTL | Notes |
|-------------|-----|-------|
| `posts:feed:{cursor\|first}` | 60s | Global feed |
| `posts:user:{authorId}:{cursor}` | 60s | Per-author feed |
| `post:{id}` via `cache.keys.post` | — | Invalidated on like/repost/comment/update |

Invalidation: `posts:feed:first`, `posts:user:{authorId}:first`, per-post key on mutations.

---

## 9. BullMQ

**Notification queue only** — `AppNotificationsService.addNotification` for follower blast and interaction alerts.

No dedicated post-processing queue (media, moderation, etc.).

---

## 10. Security

| Control | Implementation |
|---------|----------------|
| Create / mutate | JWT required |
| Read feed | OptionalAuth for `liked`/`reposted` flags |
| Update/delete | Owner or `ADMIN` role |
| Rate limiting | `@RateLimit('api')` on all routes |
| Validation | `class-validator` on DTOs; content length caps |
| Hidden posts | Excluded from feed via `isHidden: false` |

---

## 11. Possible Bugs

1. **Feed not following graph** — `getFeed` returns global posts, not followed-users-only (product may expect social feed).
2. **No pagination in AppContext** — mobile loads first page only; `nextCursor` ignored.
3. **Create post types UI** — image/poll/listing selectors do not affect payload.
4. **Follower notify cap** — only first 500 followers notified (`findFollowerIds` `take: 500`).
5. **Category filter** — `posts.tsx` filters by hardcoded Arabic category strings in post text; fragile.
6. **Count denormalization** — like/repost toggles update `Post.likesCount` in transaction; cache may serve stale feed counts for 60s.

---

## 12. Production Readiness (with %)

**70%**

| Ready | Gap |
|-------|-----|
| Full CRUD + interactions API | No infinite scroll on mobile |
| Redis feed cache | No real-time updates |
| Notifications for engagement | Global feed vs follow feed unclear |
| Soft delete + authz | Image/poll post types not implemented in app |



---

# FILE: push-notifications.md


# Push Notifications (FCM)

## 1. Business Purpose

Push notifications deliver Arabic alerts to the user’s device when in-app notifications are created, using **Firebase Cloud Messaging** with native device tokens from Expo.

**Who uses it:** Mobile users on **development/production builds** (not Expo Go). Web push is **not implemented**.

---

## 2. Frontend Flow

### Mobile (`app/lib/notifications.ts`)

| Function | Purpose |
|----------|---------|
| `registerForPushNotifications()` | Permission + `Notifications.getDevicePushTokenAsync()` |
| `syncPushToken(userId)` | `PUT /api/users/:id` with `{ fcmToken }` if changed |
| `clearPushTokenOnLogout()` | Clears server token + AsyncStorage |
| `listenForegroundNotifications()` | Expo foreground handler |
| `listenNotificationResponses()` | Tap handler → `handleNotificationNavigation()` |
| `getInitialNotificationData()` | Cold-start from notification |

**Storage keys:** `safat_push_token`, `safat_push_token_synced`.

**Android channel:** `default` — “إشعارات صفاة”, HIGH importance.

**Skipped when:** `Platform.OS === 'web'`, simulator, or Expo Go (`storeClient`).

**Integration:** Typically called from `AuthContext` after login (`syncPushToken`).

---

## 3. API Flow

Push is **not** sent via a dedicated REST endpoint from the client.

| Method | URL | Purpose |
|--------|-----|---------|
| PUT | `/api/users/:id` | Body `{ fcmToken: string \| null }` — stores token on `User.fcmToken` |

Token is read server-side when enqueueing push after notification persist.

---

## 4. Backend Flow

```
NotificationPersistService.enqueuePushAfterPersist()
  → NotificationRepository.findUserFcmToken(userId)
  → PushQueueService.addPush({ fcmToken, titleAr, bodyAr, data })
    → PushProcessor (job name: 'send')
      → firebase-admin.messaging().send()
```

**Invalid token:** On `messaging/registration-token-not-registered`, clears `User.fcmToken` in DB.

**Firebase init:** Only in `PushProcessor` constructor when `FIREBASE_PROJECT_ID` is set.

---

## 5. Database

| Field | Model | Purpose |
|-------|-------|---------|
| `fcmToken` | `User` | Latest FCM/APNs device token; nulled on invalid token or logout |

---

## 6. Socket

Not used for push delivery.

---

## 7. Notifications

Push payload `data` includes stringified fields from the in-app notification plus `notificationId` and `type`. Client navigation uses `handleNotificationNavigation()` in `lib/notifications.ts` (supports `event` field for butcher-application flows).

---

## 8. Redis

BullMQ queue `push-notifications` uses Redis **DB 1** (see `bullmq.md`). No separate FCM token cache in Redis.

---

## 9. BullMQ

| Queue | Job | Concurrency | Processor |
|-------|-----|-------------|-----------|
| `push-notifications` | `send` | 5 | `PushProcessor` |

Skipped when Redis disabled or queue unavailable (`PushQueueService` returns null).

---

## 10. Security

- FCM credentials via env: `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`.
- Users can only update their own `fcmToken` via authenticated `PUT /users/:id`.
- Push `data` is client-trusted for navigation only; sensitive actions still require API auth.

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| No push if Firebase env missing | `PushProcessor` returns early when `!admin.apps.length` |
| Expo Go cannot test FCM | Explicit skip in `registerForPushNotifications` |
| iOS requires EAS build + credentials | `getExpoProjectId()` for EAS |
| Token sync race on fast logout | `clearPushTokenOnLogout` best-effort |

---

## 12. Production Readiness: **85%**

Pipeline is complete when Firebase + EAS build are configured. Gaps: no web push, no topic/broadcast API, no delivery receipts.

**Main files:** `backend-nest/src/queue/processors/push.processor.ts`, `app/lib/notifications.ts`



---

# FILE: redis.md


# Redis

## 1. Business Purpose

Redis provides entity caching, rate limiting, session/token storage, BullMQ backing, Socket.IO clustering, distributed cron locks, and upload rate limits.

**Who uses it:** All backend processes when `REDIS_ENABLED !== 'false'`.

---

## 2. Frontend Flow

Clients do not connect to Redis directly. Effects are indirect (faster API, rate limits, realtime).

---

## 3. API Flow

No public Redis API. Health check reports cache/session ping: `GET /api/health`.

---

## 4. Backend Flow

| Service | File | DB |
|---------|------|-----|
| `RedisCacheService` | `redis/services/redis-cache.service.ts` | **0** |
| `RedisSessionService` | `redis/services/redis-session.service.ts` | **2** |
| BullMQ | `queue/constants.ts` `QUEUE_CONNECTION.db` | **1** |
| Socket.IO adapter | `socket-redis-adapter.service.ts` | **3** |
| Socket disconnect pub/sub | `socket-disconnect.service.ts` | **3** |
| Rate limiter | `rate-limit.service.ts` | **0** |

`RedisService` facade exposes cache + session helpers.

---

## 5. Database

Redis is not the primary store. PostgreSQL remains source of truth; cache TTLs are short (default 300s).

---

## 6. Socket

DB **3**: `@socket.io/redis-adapter` for horizontal scaling; channel `socket:disconnect` for forced logout.

---

## 7. Notifications

No dedicated notification cache. Queue on DB 1 handles async notification jobs.

---

## 8. Redis Keys & DBs

### DB 0 — Cache & limits

| Key pattern | TTL | Purpose |
|-------------|-----|---------|
| `user:{id}` | 300s | User profile cache |
| `listing:{id}` | 300s | Listing detail |
| `listings:v2:{json}` | 90s | Listing list pages |
| `listings:{page}:{filters}` | — | Legacy pattern in `CacheKeys` |
| `post:{id}` | — | Post cache |
| `posts:{page}` | — | Post list |
| `butcher:{id}` | 300s | Butcher profile |
| `butchers:{country}:{page}` | 180s | Butcher list |
| `feed:{userId}:{page}` | — | User feed |
| `streams:live` | 15s | Active live streams |
| `stories:feed:{viewerId\|anon}` | 20s | Stories feed |
| `stories:feed:*` | — | Pattern invalidation |
| `butchers:stories:active` | 30s | Butcher stories list |
| `subscription:{userId}` | varies | Subscription view cache |
| `subscription:reminder:{userId}:{kind}` | NX lock | Reminder dedup |
| `online:{userId}` | 3600s | Socket presence |
| `rl:api:{ip}` | 900s window | API rate limit |
| `rl:auth:{ip}` | 900s | Auth rate limit |
| `rl:payment:{ip}` | 3600s | Payment rate limit |
| `cron:fee_check:lock` | 120s | Fee cron lock |
| `cron:db_cleanup:lock` | 300s | Cleanup cron lock |
| `cron:subscription:lock` | 300s | Subscription cron lock |
| `cron:subscription:weekly_reset` | 300s | Weekly live minutes reset |

### DB 1 — BullMQ

All queue metadata and jobs for: `notifications`, `emails`, `push-notifications`, `fee-checks`, `image-processing`, `subscriptions`.

### DB 2 — Session

| Key pattern | TTL | Purpose |
|-------------|-----|---------|
| `blacklist:{accessToken}` | 900s | Revoked JWT |
| `email_verify:{userId}` | 600s | Email verification code |
| `email_verify_cooldown:{userId}` | — | Resend cooldown |
| `upload_count:{userId}` | 3600s | Upload rate limit (hourly) |

### DB 3 — Socket

Socket.IO adapter channels + `socket:disconnect` pub/sub (no app-defined key prefix beyond adapter internals).

---

## 9. BullMQ

Uses DB 1 exclusively. Disabled when `REDIS_ENABLED=false` — queues no-op.

---

## 10. Security

- Redis should not be exposed publicly
- Session DB holds short-lived auth artifacts
- Dev mode may skip cache when Redis unavailable (`markedUnavailable`)

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| Dev silently drops cache | `RedisCacheService.markUnavailable` |
| Rate limit bypass in development | `NODE_ENV === 'development'` skips limits |
| Upload counter on session DB not cache DB | Intentional but easy to mis-document |
| Multiple DBs on one instance | Requires Redis `SELECT` support |

---

## 12. Production Readiness: **90%**

Four-DB layout is clear and used consistently. Ensure `REDIS_ENABLED=true` and persistence policy in prod.

**Main files:** `backend-nest/src/redis/`, `backend-nest/src/common/services/rate-limit.service.ts`



---

# FILE: refunds.md


# Refunds

## 1. Business Purpose

Refunds reverse a completed payment when Network International sends a reversal/refund webhook. The system marks the `Payment` as `refunded` and, for fulfilled subscription payments, downgrades the user back to the free plan.

**Who uses it:**
- **Network International** — webhook events only
- **Affected users** — receive in-app notification on refund
- **No admin or mobile UI** — refunds are not initiated from the app

---

## 2. Frontend Flow

There is **no refund UI** in the mobile app or admin panel.

Users may see:
- In-app notification: "تم استرداد الدفع" (from webhook handler)
- Subscription downgrade notification: "تم استرداد مبلغ الاشتراك" (from `downgradeUser` with `reason: 'refund'`)

`SubscriptionContext` reflects downgrade on next `GET /api/subscriptions`.

---

## 3. API Flow

**No dedicated refund endpoints exist.**

Refunds are processed exclusively via:

| Method | URL | Trigger |
|--------|-----|---------|
| POST | `/api/payments/webhook` | NI events `ORDER.REVERSED`, `ORDER.REFUNDED`, `ORDER.PARTIALLY_REFUNDED` or order states `REVERSED`, `REFUNDED`, `PARTIALLY_REFUNDED` |

There is no `POST /api/payments/refund` or admin refund route in the codebase.

---

## 4. Backend Flow

```
PaymentsService.handleNIWebhook()
  → isRefundEvent = eventType/state in refund sets
  → if payment.status === 'refunded' → return (idempotent)
  → if payment.status === 'paid' && isRefundEvent:
       PaymentsRepository.markPaymentRefunded(paymentId, metadata)
       if type === 'subscription' && subscriptionFulfilled:
         find subscription → SubscriptionLifecycleService.downgradeUser(userId, planId, audience, 'refund')
       SubscriptionCacheService.invalidate(userId)
       AppNotificationsService.notifyUser({ type: 'system', titleAr: 'تم استرداد الدفع', ... })
```

### `markPaymentRefunded` (`payments.repository.ts`)

```typescript
prisma.payment.update({
  where: { id: paymentId },
  data: {
    status: 'refunded',
    metadata: { ...existing, refundedAt, refundEvent },
  },
});
```

### `downgradeUser` with `reason: 'refund'` (`subscription-lifecycle.service.ts`)

- `SubscriptionLifecycleRepository.downgradeToFreeTx()` — plan → `free`, reset counters, butcher subscription flags cleared
- Notification type `system` with refund-specific Arabic copy

**Listing fee refunds:** payment marked `refunded` but **no** automatic reversal of `ListingFee.paid` or listing activation in webhook handler.

---

## 5. Database

### `PaymentStatus` enum (`schema.prisma`)

```
pending | paid | failed | refunded
```

### Refund-related fields

| Model | Field | On refund |
|-------|-------|-----------|
| `Payment` | `status` | → `refunded` |
| `Payment` | `metadata` | adds `refundedAt`, `refundEvent` |
| `Subscription` | plan, counters | downgraded only if subscription payment was fulfilled |
| `ListingFee` | — | **not updated** on refund |
| `Listing` | — | **not reverted** on refund |

---

## 6. Socket

No refund-specific socket events.

---

## 7. Notifications

| Trigger | Type | Title (AR) |
|---------|------|------------|
| Payment refunded | `system` | تم استرداد الدفع |
| Subscription downgraded after refund | `system` | تم استرداد مبلغ الاشتراك |

Queued via `AppNotificationsService` → BullMQ.

---

## 8. Redis

`SubscriptionCacheService.invalidate(userId)` after refund processing.

---

## 9. BullMQ

Refund path does not enqueue dedicated jobs. User notifications go through the standard notification queue.

---

## 10. Security

- Refunds only accepted via verified NI webhook (HMAC in production).
- No user-facing refund API — prevents arbitrary refund requests.
- Subscription downgrade only when `metadata.subscriptionFulfilled === true` (payment actually activated plan).

---

## 11. Possible Bugs

1. **Partial implementation for listing fees** — fee payment refunded in `Payment` table but `ListingFee` stays `paid` and listing stays `active`.
2. **Partial refunds treated as full downgrade** — `ORDER.PARTIALLY_REFUNDED` triggers same path as full refund for subscriptions.
3. **No refund API for support** — operations must use NI portal + wait for webhook.
4. **No ledger/audit table** — only `metadata.refundEvent` string stored.
5. **`activateFromPayment` in lifecycle service unused by webhook** — fulfillment happens in `payments.repository.processSuccessfulPayment` instead; two parallel activation paths exist in codebase.
6. **Double idempotency** — `refunded` status short-circuits; good, but no compensation if downgrade fails after `markPaymentRefunded`.

---

## 12. Production Readiness (%)

**65%**

Core subscription refund webhook path exists with status enum and downgrade logic. Missing: fee refund reversal, partial refund handling, admin tools, and dedicated refund API. Treat as **partial / webhook-only**.



---

# FILE: reports.md


# Support Reports (SupportTicket)

## 1. Business Purpose

Support tickets (`SupportTicket`) let staff track user reports and support cases from the admin panel.

**Who uses it:** Admin/moderator staff in `admin-panel`. End-user ticket submission API is **not implemented** in the current backend (tickets are seeded or created manually).

---

## 2. Frontend Flow

### Admin panel

| Screen | Path |
|--------|------|
| Reports list | `admin-panel/src/app/(dashboard)/reports/page.tsx` |
| Report detail | `admin-panel/src/app/(dashboard)/reports/[id]/page.tsx` |

**List actions:** Mark `IN_REVIEW`, close as `CLOSED` via `updateReport()` from `admin.service.ts`.

**Mobile:** No dedicated report submission screen wired to a public API.

---

## 3. API Flow

All routes under `/api/admin/reports` — staff JWT required.

| Method | URL | Body / query |
|--------|-----|--------------|
| GET | `/admin/reports` | `page`, `pageSize`, `search` |
| GET | `/admin/reports/:id` | — |
| PATCH | `/admin/reports/:id` | `status`, `priority`, `adminNotes` (optional fields) |
| DELETE | `/admin/reports/:id` | Soft delete |

**Status enum:** `OPEN`, `IN_REVIEW`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`  
**Priority enum:** `LOW`, `NORMAL`, `HIGH`, `URGENT`

**Missing:** `POST /reports` or similar public endpoint for mobile users.

---

## 4. Backend Flow

```
AdminController.listReports / getReport / updateReport / deleteReport
  → AdminService
    → AdminRepository.listTickets / findTicket / updateTicket / softDeleteTicket
```

Dashboard stats aggregate open/closed ticket counts (`getDashboardStats`).

---

## 5. Database

| Model | Fields |
|-------|--------|
| `SupportTicket` | `ticketNumber` (unique), `category`, `priority`, `status`, `subject`, `description`, `adminNotes`, `reporterId?`, soft delete |

**Indexes:** `status`, `category`, `priority`, `createdAt`, `deletedAt`.

**Seed:** `backend-nest/scripts/seed-admin.ts` may create sample tickets.

**Cleanup:** Hard delete soft-deleted tickets after retention window (`runCleanup`).

---

## 6. Socket

Not used.

---

## 7. Notifications

No automatic user notification on ticket status change.

---

## 8. Redis

Not used.

---

## 9. BullMQ

Not used.

---

## 10. Security

- Admin/moderator only via `@Roles`
- Reporter relation optional; no PII export controls beyond staff access

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| No user-facing create API | Only admin CRUD exists |
| Category is free string | No enum validation on create (N/A until API exists) |
| Delete is soft archive | Users cannot see ticket history in app |

---

## 12. Production Readiness: **55%**

Admin triage UI works against seeded/manual data. **Missing:** mobile report flow, email alerts, assignment workflow.

**Main files:** `backend-nest/src/admin/`, `admin-panel/src/app/(dashboard)/reports/`



---

# FILE: reviews.md


# Butcher Reviews (Ratings & Comments)

## 1. Business Purpose

Customers rate butcher shops (1–5 stars) with optional comment. One review per user per butcher (`@@unique([butcherId, reviewerId])`). Submitting upserts the review and recomputes `Butcher.rating` and `Butcher.reviewCount` aggregates displayed on discovery cards and profile.

**Key files:** `backend-nest/src/butchers/butchers.controller.ts`, `backend-nest/src/butchers/butchers.service.ts`, `backend-nest/src/butchers/repositories/butchers.repository.ts`, `app/app/butchers/[id].tsx`.

---

## 2. Frontend Flow

### Display — `app/app/butchers/[id].tsx`

| Element | Source |
|---------|--------|
| Header rating | `butcher.rating`, `butcher.reviewCount` from `GET /api/butchers/:id` |
| Reviews strip | Maps `b.reviews` embedded in butcher response to `ButcherReview` UI model |
| `ReviewsStrip` | Horizontal scroll of cards (avatar, stars, comment) |

**Submit UI:** **missing** in mobile app — no `POST /api/butchers/:id/reviews` call found under `app/`. Reviews are read-only in current client.

### Separate reviews endpoint

`GET /api/butchers/:id/reviews` exists on backend but profile screen uses embedded reviews from butcher GET, not this route.

---

## 3. API Flow

| Method | Endpoint | Auth | Body | Response |
|--------|----------|------|------|----------|
| GET | `/api/butchers/:id/reviews` | OptionalAuth (`@Public` on route group) | — | Array of reviews + `reviewer` (max 20, `findReviews`) |
| POST | `/api/butchers/:id/reviews` | JWT | `{ rating: 1-5, comment?: string }` | Upserted review + reviewer |

### POST validation (`reviewSchema`)

```typescript
rating: z.number().int().min(1).max(5)
comment: z.string().max(500).optional()
```

### Errors

| Code | HTTP | When |
|------|------|------|
| `not_found` | 404 | Butcher missing |
| `invalid_action` | 400 | Owner reviews own shop |
| `validation_error` | 400 | Zod failure |
| `already_reviewed` | 409 | Prisma P2002 (race; upsert normally prevents) |

---

## 4. Backend Flow

**getReviews(butcherId):**

1. `findButcherOwner` exists check
2. `findReviews(butcherId)` — latest 20 with reviewer profile

**submitReview(butcherId, user, body):**

1. `findButcherForReview` — must exist; `butcher.userId !== user.userId`
2. Zod parse
3. `repo.upsertReview({ butcherId, reviewerId, rating, comment })`
4. `aggregateReviews` → `_avg.rating`, `_count.rating`
5. `updateButcherRating(butcherId, avg, count)`
6. `redis.cacheDel(\`butcher:${butcherId}\`)`
7. Return review row

**Embedded in profile:** `findButcherById` includes `reviews: { take: 10, orderBy: createdAt desc, include: reviewer }`.

---

## 5. Database

**Model:** `ButcherReview` — `schema.prisma` (lines 679–692)

| Field | Type |
|-------|------|
| `id` | UUID |
| `butcherId` | FK → Butcher |
| `reviewerId` | FK → User |
| `rating` | Int (1–5) |
| `comment` | String? |
| `createdAt` | DateTime |

**Constraint:** `@@unique([butcherId, reviewerId])` — one review per pair; upsert updates existing.

**Denormalized:** `Butcher.rating` (Float), `Butcher.reviewCount` (Int) updated on each submit.

**User profile:** `UsersService.formatProfile` exposes butcher `rating` / `reviewCount` when user has `butcherProfile`.

---

## 6. Socket

**missing** — new reviews do not push to butcher dashboard or profile viewers.

---

## 7. Notifications

**missing** — butcher owner is not notified when a review is submitted.

---

## 8. Redis

On submit:

- `redis.cacheDel(\`butcher:${butcherId}\`)` in `ButchersService.submitReview`

Profile cache for `butcher:me` is **not** explicitly cleared on review (may stale for owner until TTL).

---

## 9. BullMQ

**missing** — no async moderation queue for review text or fraud detection.

---

## 10. Security

| Control | Implementation |
|---------|----------------|
| Submit | JWT required |
| Self-review | Blocked (`invalid_action`) |
| Read | Public GET reviews; embedded on OptionalAuth butcher profile |
| One review per user | DB unique + upsert semantics |
| Rate limiting | `@RateLimit('api')` on controller |
| Comment length | Max 500 chars |

**missing:** verified-purchase requirement (any user can review any butcher).

---

## 11. Possible Bugs

1. **No mobile submit form** — API exists but app cannot create reviews.
2. **Field name mismatch risk** — UI expects `authorNameAr`, `commentAr`; API returns `reviewer.arabicName`, `comment` — mapping in `[id].tsx` must stay in sync.
3. **Aggregate drift** — if reviews deleted manually in DB, aggregates not recalculated (no delete review endpoint).
4. **409 vs upsert** — service catches P2002 but upsert should prevent; redundant error path.
5. **Embedded vs GET reviews** — two sources (10 vs 20 items) may confuse if client mixes them.
6. **Rating on list cards** — defaults to `5.0` in `index.tsx` when null (`b.rating ?? 5.0`) — misleading for new butchers.

---

## 12. Production Readiness (with %)

**62%**

| Ready | Gap |
|-------|-----|
| Backend POST/GET with upsert + aggregates | No mobile review submission UI |
| DB constraints + owner self-review block | No notifications to butcher |
| Public read on profile | No verified-buyer gate |
| Cache invalidation on submit | No review delete/moderation API |



---

# FILE: roles-permissions.md


# Roles & Plan Permissions

## 1. Business Purpose

Two authorization layers:
1. **Staff roles** (`Role` enum + `RolesGuard`) for admin API
2. **Subscription plan permissions** (`PlanPermissionService`) for paid features (ads, live, featured listings, analytics flag, etc.)

---

## 2. Frontend Flow

### Mobile

- JWT `user.role` is typically `USER` (butcher mode is client `activeMode`, not server `BUTCHER` role)
- `SubscriptionContext` exposes plan limits (`featuredAdsUsed`, `pinnedAdsUsed`, etc.)
- Plan feature labels: `app/services/subscriptionPlans.ts`

### Admin panel

- Login stores user with `ADMIN` or `MODERATOR`
- Settings page restricted to `ADMIN` in UI

---

## 3. API Flow

**Staff:** `@Roles(...)` on `admin.controller.ts`, `admin-plans.controller.ts`

**Plans:** Resolved server-side per user subscription — no separate permissions REST endpoint; entitlements checked inside domain services (`assertCanCreateListing`, `assertCanCreateLiveStream`, etc.).

---

## 4. Backend Flow

### RolesGuard

```
@Roles('ADMIN', 'MODERATOR')
  → RolesGuard reads ROLES_KEY metadata
  → Compares req.user.role from JWT
  → ForbiddenException if not in list
```

**Role enum (Prisma):** `USER`, `BUTCHER`, `ADMIN`, `MODERATOR`

**Note:** `BUTCHER` role exists in schema but butcher access is primarily via `Butcher.userId` link; JWT role often remains `USER`.

### PlanPermissionService

Resolves effective plan (`free` if unpaid) via `PlanResolverService`.

| Method | Permission key |
|--------|----------------|
| `canCreateLive` | `canCreateLive` |
| `maxAdsPer24Hours` | `maxAdsPer24Hours` |
| `monthlyFeaturedAds` | `monthlyFeaturedAds` |
| `monthlyPinnedAds` | `monthlyPinnedAds` |
| `monthlyLiveHours` / `monthlyLiveMinutes` | `monthlyLiveHours` |
| `hasPrioritySearch` | `prioritySearch` |
| `hasPriorityHome` | `priorityHome` |
| `hasVerifiedBadge` | `verifiedBadge` |
| `storeCommission` | `storeCommission` |
| `isStoreEnabled` | `storeEnabled` |
| `canReceiveOrders` | `receiveOrders` |
| `hasAnalyticsDashboard` | `analyticsDashboard` |
| `priorityBoost` | Derived from priority flags |

**Enforcement:** `SubscriptionEntitlementService.assertCanCreateListing`, `assertCanCreateLiveStream`, listing sort boost via `PlanResolverService.planTier`.

**Catalog:** `plans/plan-feature-catalog.ts`; seeded in `scripts/seed-plans.ts`.

---

## 5. Database

| Model | Relevant fields |
|-------|-----------------|
| `User` | `role` |
| `Subscription` | `planId`, `planAudience`, usage counters |
| `Plan`, `PlanFeature` | Feature key/value pairs |

---

## 6. Socket

Uses same JWT role for connection; no separate plan check on socket connect (live/order handlers check ownership separately).

---

## 7. Notifications

Not role-specific except staff receiving butcher-application notifications.

---

## 8. Redis

`subscription:{userId}` caches subscription view.

---

## 9. BullMQ

Subscription processor resets monthly counters (`reset_live_minutes` job).

---

## 10. Security

- Global `JwtAuthGuard` + per-route `@Roles`
- Plan permissions enforced server-side on create listing/live
- Client-side gating alone is insufficient — backend throws `403` with codes like `featured_limit`, `plan_required`

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| `BUTCHER` JWT role unused | Schema vs runtime mismatch |
| `analyticsDashboard` not enforced on `GET /butchers/stats` | See `analytics.md` |
| `pinnedAds` entitlement without listing `pinned` field | See `pinned-listings.md` |
| Moderator ≈ Admin on many routes | Broad `@Roles(...STAFF)` |

---

## 12. Production Readiness: **83%**

Plan entitlement system is thorough for listings/live. Gaps: butcher role clarity, analytics gating, pinned ads completion.

**Main files:** `backend-nest/src/auth/guards/roles.guard.ts`, `backend-nest/src/plans/plan-permission.service.ts`, `backend-nest/src/subscriptions/services/subscription-entitlement.service.ts`



---

# FILE: search.md


# Search (Trending + Client-Side Discovery)

## 1. Business Purpose

Discovery UX combining:

1. **Backend trending hashtags** — only `GET /api/search/trending` (hashtag frequency from recent posts).
2. **Client-side filtering** — listings from `AppContext` filtered in the app.
3. **Direct API calls** — `GET /api/users` (with optional `search`) and `GET /api/livestreams` for accounts and live streams.

There is **no** unified backend search endpoint for listings, users, or livestreams in `SearchController`.

**Key file:** `app/app/search.tsx`, `backend-nest/src/search/search.controller.ts`.

---

## 2. Frontend Flow

**Screen:** `app/app/search.tsx`

| Phase | Behavior |
|-------|----------|
| Empty query | Shows recent searches (`AsyncStorage` key `safat_recent_searches`) + trending tags from API |
| With query | Filter chips: `all`, `listings`, `users`, `live` |
| Listings | `useApp().listings` filtered locally by title / `arabicTitle` / `arabicLocation` |
| Users | `dbUsers` from `GET /api/users` or `GET /api/users?search={query}` — **no client filter** (`filteredUsers = dbUsers`) |
| Live | `dbLiveStreams` from `GET /api/livestreams`, filtered locally by title |

**Trending load (mount only):**

```typescript
fetch(`${API_BASE}/api/search/trending`)
```

**Users/live load:** `useEffect` on `[query]` — refetches when query changes.

**Recent searches:** saved on submit (max 10 terms).

---

## 3. API Flow

### Backend (`SearchController` only)

| Method | Endpoint | Auth | Response `data` |
|--------|----------|------|-----------------|
| GET | `/api/search/trending` | Public (`@Public()`) | `{ trending: { tag: string, count: number }[] }` |

Top 10 hashtags from posts in last **30 days** (max 500 posts scanned).

### Other endpoints used by mobile (not in Search module)

| Method | Endpoint | Auth | Used for |
|--------|----------|------|----------|
| GET | `/api/users` | Public | User list / `?search=` |
| GET | `/api/livestreams` | Public | Live stream list |

**missing:** `GET /api/search/listings`, `GET /api/search/posts`, Elasticsearch/Meilisearch integration.

---

## 4. Backend Flow

```
GET /search/trending
  → SearchController.trending()
  → SearchService.getTrending()
      → SearchRepository.findRecentPosts(since: now - 30d)
      → Regex /#[\u0600-\u06FF\w_]+/g on content + arabicContent
      → Count, sort desc, slice(0, 10)
```

**Files:**

- `backend-nest/src/search/search.controller.ts`
- `backend-nest/src/search/search.service.ts`
- `SearchRepository` in same file as service

**Users search** (separate module): `UsersService.listUsers` — `findActiveUsers(search)` max 20, case-insensitive on username/displayName/arabicName.

**Listings search** (if called directly): `ListingsService.list` supports `search` query (≥2 chars) — **not used by `search.tsx`**.

---

## 5. Database

| Source | Query |
|--------|-------|
| Trending | `Post` where `createdAt >= since`, `notDeleted`, `isHidden: false`, take 500 |
| Users | `User` where `isActive: true`, optional OR `contains` on names |
| Livestreams | `LiveStream` via livestreams module (read in app only) |
| Listings (local) | Already loaded in `AppContext` — not queried at search time |

No `TrendingTag` or search index tables.

---

## 6. Socket

**missing** — search results are static HTTP pulls; live tab does not subscribe to stream start/stop events.

---

## 7. Notifications

**missing** — search feature does not send notifications.

---

## 8. Redis

**missing** in `SearchService` — trending recomputed on every request.

`ListingsService` and `UsersService` may cache their own endpoints, but trending endpoint has no cache layer.

---

## 9. BullMQ

**missing** — no background job to precompute trending tags or build search indexes.

---

## 10. Security

| Control | Implementation |
|---------|----------------|
| Trending | `@Public()` — no auth |
| Users list | `@Public()` on `GET /users` |
| Rate limiting | Users/listings controllers use `@RateLimit('api')`; **SearchController trending has no `@RateLimit`** |
| Injection | Prisma parameterized queries; hashtag regex only on fetched text |
| PII | User search returns public profile fields only |

---

## 11. Possible Bugs

1. **Listings scope** — search only covers listings already fetched in `AppContext` (first page), not full catalog.
2. **Users search mismatch** — when query empty, loads all users (limit 20); when query set, server filters but client assigns all results without secondary filter.
3. **Trending not refreshed** — fetched once on mount; stale if user stays on screen.
4. **No rate limit on trending** — cheap but unbounded repeated DB reads (500 posts × regex).
5. **Arabic hashtag normalization** — `toLowerCase()` only; may split duplicate Arabic tags.
6. **Live filter** — uses `arabicTitle.includes(q)` without lowercasing Arabic query consistently.

---

## 12. Production Readiness (with %)

**58%**

| Ready | Gap |
|-------|-----|
| Trending hashtags API works | Only one backend search endpoint |
| Usable mobile UX with filters | Listings not server-searched |
| Recent search persistence | No trending cache or rate limit |
| Users + live wired | No unified search API or indexing |



---

# FILE: settings.md


# App Settings (Admin)

## 1. Business Purpose

Key-value **feature flags and system configuration** stored in `AppSetting`, editable only by `ADMIN` in the admin panel.

**Who uses it:** Platform administrators. Mobile app does **not** fetch settings via a public API in current code.

---

## 2. Frontend Flow

### Admin panel

| Screen | Path |
|--------|------|
| Settings | `admin-panel/src/app/(dashboard)/settings/page.tsx` |

**UI:** Lists all settings; boolean toggles flip via `PUT`; non-boolean shown as JSON.

**Access:** Page shows warning if user role ≠ `ADMIN`.

---

## 3. API Flow

| Method | URL | Roles |
|--------|-----|-------|
| GET | `/api/admin/settings` | **ADMIN** |
| PUT | `/api/admin/settings` | **ADMIN** |

**PUT body:** `{ key, value, labelAr?, category? }` — upsert by unique `key`.

---

## 4. Backend Flow

```
AdminController → AdminService.listSettings / updateSetting
  → AdminRepository (Prisma AppSetting)
```

`updateSettingSchema` validates key + value (unknown JSON).

---

## 5. Database

| Model | Fields |
|-------|--------|
| `AppSetting` | `key` (unique), `value` (Json), `labelAr`, `category` (default `general`) |

No seed file referenced in docs; settings may be empty until seeded manually.

---

## 6. Socket

Not used.

---

## 7. Notifications

Not used.

---

## 8. Redis

Not used. **Missing:** runtime cache of settings for API feature gates.

---

## 9. BullMQ

Not used.

---

## 10. Security

- `MODERATOR` cannot read or write settings (`@Roles('ADMIN')`)
- No public read endpoint — flags cannot be toggled by clients

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| Settings not consumed by backend | Stored but no `AppSettingService` in domain modules found |
| Mobile cannot read flags | No `/api/settings` public route |
| JSON value not validated per key | Generic `z.unknown()` |

---

## 12. Production Readiness: **50%**

Admin CRUD exists. **Missing:** consumer API, backend enforcement of flags, seed documentation.

**Main files:** `backend-nest/src/admin/admin.controller.ts`, `admin-panel/.../settings/page.tsx`



---

# FILE: socket.md


# Socket.IO Gateway

## 1. Business Purpose

Realtime layer for DMs, live stream presence/comments/likes, butcher order status updates, online presence, and optional notification mark-read.

**Who uses it:** Authenticated mobile users. Separate process from HTTP API.

---

## 2. Frontend Flow

### Mobile (`app/lib/socket.ts`, hooks)

| Hook / screen | Events used |
|---------------|-------------|
| Chat | `chat:join`, `chat:send`, `chat:typing`, `chat:read` |
| Live watch/broadcast | `live:join`, `live:leave`, `live:comment`, `live:like` |
| Butcher orders | `order:status` (butcher), listen `order:updated` |
| Admin orders panel | `hooks/useAdminOrderSocket.ts` |

**Connection:** `SOCKET_URL` (default port `3002`). Auth via `handshake.auth.token` or `Authorization: Bearer`.

---

## 3. API Flow

Sockets are **not** REST. HTTP companion: none required beyond JWT issuance.

---

## 4. Backend Flow

**Entry:** `backend-nest/src/gateway/socket.main.ts` → `AppGateway` (`app.gateway.ts`)

**Services:**
- `SocketGatewayService` — auth, handlers, business logic
- `SocketEmitService` — `emitToUser`, `emitToThread`, `emitToStream`
- `SocketRedisAdapterService` — multi-instance adapter (Redis DB 3)
- `SocketDisconnectService` / `SocketDisconnectListenerService` — forced logout disconnect

**Auth on connect:**
1. Verify JWT access token
2. Check `blacklist:{token}` in Redis session DB
3. Validate `passwordVersion`
4. Confirm user active
5. `client.join('user:{userId}')`

---

## 5. Database

Socket handlers read/write via `SocketRepository`:
- `Message`, `MessageThread` — chat
- `LiveStream`, `LiveComment` — live
- `ButcherOrder` — order status
- `Notification` — mark read
- `User.lastSeenAt` — disconnect cleanup

---

## 6. Socket Events

### Client → Server (`@SubscribeMessage`)

| Event | Payload | Handler |
|-------|---------|---------|
| `chat:join` | `threadId` (UUID string) | Join `thread:{id}` after participant check |
| `chat:leave` | `threadId` | Leave room |
| `chat:send` | `ChatSendDto` | Persist message, emit to thread + receiver |
| `chat:typing` | `ChatTypingDto` | Emit to `user:{receiverId}` |
| `chat:read` | `ChatReadDto` | Mark read, emit `chat:read` to thread |
| `live:join` | `streamId` | Join `stream:{id}`, bump viewers, emit stats |
| `live:leave` | `streamId` | Decrement viewers |
| `live:comment` | `LiveCommentDto` | Persist comment, broadcast |
| `live:like` | `streamId` | Increment likes, broadcast |
| `order:status` | `OrderStatusDto` | Butcher-only status transition |
| `presence:ping` | — | Refresh `online:{userId}` TTL |
| `notifications:read` | `string[]` (notification ids) | Mark notifications read |

### Server → Client (emitted)

| Event | Room | Purpose |
|-------|------|---------|
| `error` | socket | `{ code, message }` |
| `chat:message` | `thread:{id}` | New message |
| `chat:notification` | `user:{id}` | DM preview for receiver |
| `chat:typing` | `user:{id}` | Typing indicator |
| `chat:read` | `thread:{id}` | Read receipt |
| `live:stats` | `stream:{id}` | `{ viewers, likes, commentsCount }` |
| `live:viewers` | `stream:{id}` | Viewer count |
| `live:comment` | `stream:{id}` | New comment object |
| `live:like` | `stream:{id}` | `{ userId, likes }` |
| `live:likes` | `stream:{id}` | Total like count |
| `order:updated` | `user:{customerId}`, `user:{butcherUserId}` | From `OrderLifecycleService` |

### Rooms

| Pattern | Joined when |
|---------|-------------|
| `user:{userId}` | On connection (automatic) |
| `thread:{threadId}` | `chat:join` |
| `stream:{streamId}` | `live:join` |

---

## 7. Notifications

`chat:send` triggers `AppNotificationsService.notifyUser` (`type: new_message`) for the receiver.

---

## 8. Redis

| DB | Usage |
|----|-------|
| 0 | `online:{userId}` — presence (TTL 3600s) |
| 2 | `blacklist:{token}` — auth on connect |
| 3 | Socket.IO adapter pub/sub; `socket:disconnect` channel |

**Env:** `SOCKET_PORT` (3002), `ALLOWED_ORIGINS`, `SOCKET_USE_MEMORY_ADAPTER=true` for single-instance dev.

---

## 9. BullMQ

Not used by the gateway directly.

---

## 10. Security

- Unauthenticated connections disconnected immediately
- Thread/stream participation verified before join/send
- `order:status` limited to butcher owner of order
- Forced disconnect on logout via Redis pub/sub

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| In-memory adapter in dev | No cross-instance rooms if Redis down |
| Viewer count can drift | `handleLiveLeave` resets negative viewers |
| `notifications:read` weak validation | Raw array, not `NotificationsReadDto` |
| Live like not deduplicated per user | Increments on every `live:like` |

---

## 12. Production Readiness: **90%**

Core chat/live/order realtime is production-grade with Redis adapter. Gaps: live like spam, no socket rate limits.

**Main files:** `backend-nest/src/gateway/`



---

# FILE: stories.md


# Stories (24h Ephemeral Content)

## 1. Business Purpose

Instagram-style stories: image or video slides expiring after 24 hours. Users publish from the home feed; viewers see grouped rings (seen/unseen), can react, reply privately (creates chat message), and owners see viewer lists. Optional link to own `Listing`. Separate butcher story flow exists under `/api/butchers/stories` (documented briefly here as related).

**Key files:** `backend-nest/src/stories/stories.controller.ts`, `backend-nest/src/stories/stories.service.ts`, `app/components/feature/StoriesBar.tsx`, `app/app/create/story.tsx`, `backend-nest/src/shared/lib/stories.ts`.

---

## 2. Frontend Flow

| Component / Screen | Path | Behavior |
|--------------------|------|----------|
| Stories bar | `app/components/feature/StoriesBar.tsx` | Horizontal rings; opens full-screen `StoryViewer` modal |
| Home tab | `app/app/(tabs)/index.tsx` | `fetchStoriesFeed` → passes `feed`, `myStories` to `StoriesBar` |
| Create story | `app/app/create/story.tsx` | Pick image/video, trim video, upload, `POST /api/stories` or `/api/butchers/stories` in butcher mode |
| Story service | `app/services/stories.ts` | `fetchStoriesFeed`, `recordStoryView`, reactions, reply, delete |

**StoriesBar viewer actions:**

- Auto `recordStoryView` when viewing others' stories
- Reactions: `setStoryReaction` / `removeStoryReaction`
- Reply: `replyToStory` → navigates to `/butchers/chat` with `threadId`
- Owner: viewer list (`fetchStoryViewers`), delete story
- Listing CTA if `story.listing` present

**Expiration UI:** playback duration from `story.duration`; no countdown label in bar (helper `storyTimeLeftLabel` exists server-side).

---

## 3. API Flow

Controller: `StoriesController` — prefix `/api/stories`

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/stories/feed` | OptionalAuth | Grouped feed `{ items, myStories }` |
| GET | `/stories` | OptionalAuth | Flat legacy list |
| GET | `/stories/me` | JWT | Current user's active stories |
| GET | `/stories/user/:userId` | OptionalAuth | User's active stories |
| POST | `/stories` | JWT | Create (`CreateStoryDto`) |
| DELETE | `/stories/:id` | JWT | Soft-delete own story |
| POST | `/stories/:id/view` | JWT | Record unique view |
| GET | `/stories/:id/viewers` | JWT | Owner-only viewer list |
| POST | `/stories/:id/reactions` | JWT | Upsert reaction |
| DELETE | `/stories/:id/reactions` | JWT | Remove reaction |
| POST | `/stories/:id/reply` | JWT | Private reply → `MessagesService` |

**CreateStoryDto fields:** `thumbnail`, `mediaUrl?`, `caption`, `captionAr`, `location`, `duration`, `isLive`, `liveStreamId`, `listingId`.

---

## 4. Backend Flow

**Expiration:** `storyExpiresAt()` = now + `STORY_LIFETIME_MS` (24h) from `shared/lib/stories.ts`. Active queries use `expiresAt: { gt: new Date() }`.

**getFeed:**

1. `findActiveStories()` — non-expired, not soft-deleted
2. Batch load views + reactions for viewer
3. Group by `userId`, compute `hasUnseen`, sort unseen first
4. Cache `stories:feed:{viewerId|anon}` TTL **20s**

**createStory:** validate optional `listingId` ownership → set `expiresAt`, `clampStoryDuration` → create → `invalidateFeedCache`

**recordView:** skip self-views; unique per `(storyId, viewerId)`; increment `viewsCount`

**replyToStory:** prefix message with story caption → `MessagesService.sendMessage` + notification `story_reply`

---

## 5. Database

| Model | Notes |
|-------|-------|
| `Story` | `thumbnail`, `mediaUrl`, `duration`, `expiresAt`, `viewsCount`, `reactionsCount`, optional `listingId`, soft delete |
| `StoryView` | `@@unique([storyId, viewerId])` |
| `StoryReaction` | `@@unique([storyId, userId])`, `type` string |
| `ButcherStory` | Separate table for butcher channel stories |

**Indexes:** `expiresAt`, `[userId, expiresAt, createdAt]` on `Story`.

**Repository:** `backend-nest/src/stories/repositories/stories.repository.ts` — `findActiveStories` filters `expiresAt > now`.

**Background expiry job:** **missing** — expired stories excluded by query only; rows remain until manual cleanup.

---

## 6. Socket

**missing** — no real-time story publish or view events. Feed refresh is pull-based (`onRefresh` callback).

---

## 7. Notifications

| Event | Type | Recipient |
|-------|------|-----------|
| Story reaction | `story_reaction` | Story owner (not self) |
| Story reply | `story_reply` | Story owner |

Via `AppNotificationsService`. **missing** notification when someone views a story.

---

## 8. Redis

`RedisCacheService` (`stories.service.ts`):

| Key | TTL |
|-----|-----|
| `stories:feed:{viewerId}` / `stories:feed:anon` | 20s |
| `butchers:stories:active` | 30s (butcher stories) |

Invalidation: `delPattern('stories:feed:*')` on create/delete/view/reaction; also `stories:active` key.

---

## 9. BullMQ

**missing** for stories lifecycle (no expiry sweeper queue, no transcode queue).

Notifications for reactions/replies use the general notification queue.

---

## 10. Security

| Control | Implementation |
|---------|----------------|
| Create / view / react | JWT required |
| Feed read | OptionalAuth (seen state anonymous = all unseen) |
| Delete | Owner or `ADMIN` |
| Viewers list | Owner or `ADMIN` only |
| Listing attach | Must own listing (`findListingOwnedByUser`) |
| Rate limiting | `@RateLimit('api')` |
| Expired content | `recordView` / react reject if `expiresAt <= now` |

---

## 11. Possible Bugs

1. **20s feed cache** — new stories may lag for other users up to TTL.
2. **No expiry cleanup** — DB grows with expired `Story` rows.
3. **Reply routes to butcher chat** — `StoriesBar` always opens `/butchers/chat` even for non-butcher story owners.
4. **Legacy GET `/stories`** — flat list may duplicate user grouping client-side.
5. **Video ready timeout** — viewer forces `mediaReady` after 3.5s even if video not loaded.
6. **Butcher vs user story split** — two APIs; `create/story.tsx` picks endpoint by mode but home `StoriesBar` only uses user feed.

---

## 12. Production Readiness (with %)

**74%**

| Ready | Gap |
|-------|-----|
| Full CRUD + feed grouping + views/reactions | No expiry cron / archival |
| 24h expiration enforced in queries | No socket live updates |
| Redis feed cache | Reply navigation path hardcoded to butcher chat |
| Owner analytics (viewers count) | Short cache can feel stale |



---

# FILE: story-expiration.md


# Story Expiration & Cleanup

## 1. Business Purpose

User and butcher stories expire **24 hours** after creation (`Story.expiresAt` / `ButcherStory.expiresAt`). Expired stories are hidden from feeds immediately; physical deletion happens on a schedule.

---

## 2. Frontend Flow

- Stories not yet expired appear in feeds; expired ones disappear on next fetch.
- `storyTimeLeftLabel()` in `shared/lib/stories.ts` shows Arabic time remaining in UI.

---

## 3. API Flow

No dedicated “expire” endpoint. Expiration is **time-based** in queries:

```sql
WHERE expiresAt > NOW()
```

Create endpoints set `expiresAt = storyExpiresAt()` → `now + 24h`.

---

## 4. Backend Flow

### At read time

- `findActiveStories`, `findActiveButcherStories` filter `expiresAt > new Date()`
- `recordView`, `setReaction`, `replyToStory` reject if `expiresAt <= now`

### Scheduled cleanup

`WorkerCronService` (03:00 daily) → `POST /admin/cleanup` → `AdminRepository.runCleanup`:

| Action | Condition |
|--------|-----------|
| `story.deleteMany` | `expiresAt < 30 days ago` AND `deletedAt IS NULL` |
| `story.deleteMany` | Soft-deleted stories past retention archive date |

**Note:** Stories remain in DB up to ~30 days after expiry before hard delete (if not soft-deleted earlier).

### Manual delete

User `DELETE /stories/:id` → `softDeleteStory` (sets `deletedAt`).

---

## 5. Database

| Model | Field |
|-------|-------|
| `Story` | `expiresAt` indexed |
| `ButcherStory` | `expiresAt` indexed |

**Lifetime constant:** `STORY_LIFETIME_MS = 24 * 60 * 60 * 1000` (`shared/lib/stories.ts`).

---

## 6. Socket

Not used.

---

## 7. Notifications

No “story expired” notification.

---

## 8. Redis

Feed caches invalidated on create/delete; expired stories drop out when cache refreshes.

---

## 9. BullMQ

Cleanup triggered via HTTP from worker cron, not a BullMQ job.

---

## 10. Security

Expired content not returned by active queries; owner can still delete via API if row exists.

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| 30-day lag before hard delete | `runCleanup` threshold |
| No cron for butcher story expiry-only rows | Same cleanup paths |
| Clock skew | Server `Date` dependent |

---

## 12. Production Readiness: **85%**

Expiration logic is correct for UX. Retention window is long; no immediate purge job.

**Main files:** `backend-nest/src/shared/lib/stories.ts`, `admin/repositories/admin.repository.ts` (`runCleanup`)



---

# FILE: story-viewer.md


# Story Viewer (User Stories)

## 1. Business Purpose

Users publish 24-hour **ephemeral stories** with views, emoji reactions, and private replies. Viewers see grouped feeds with seen/unseen state.

**Distinct from butcher stories** — see `butcher-stories.md`.

---

## 2. Frontend Flow

### Mobile

| Screen | Path |
|--------|------|
| Create story | `app/create/story.tsx` |
| User story viewer | Integrated in feed / tabs (not `butchers/story-viewer.tsx`) |

**Constants:** `app/constants/stories.ts`, `app/services/stories.ts`

**Viewer UX:** Tap story ring → advance slides → reactions/reply call API.

`butchers/story-viewer.tsx` is for **butcher** stories only.

---

## 3. API Flow

Base: `/api/stories` — `stories.controller.ts`

| Method | URL | Auth | Purpose |
|--------|-----|------|---------|
| GET | `/stories/feed` | Optional | Grouped feed |
| GET | `/stories` | Optional | Flat list (legacy) |
| GET | `/stories/me` | JWT | Own stories |
| GET | `/stories/user/:userId` | Optional | User’s active stories |
| POST | `/stories` | JWT | Create |
| DELETE | `/stories/:id` | JWT | Delete own (admin override) |
| POST | `/stories/:id/view` | JWT | Record unique view |
| GET | `/stories/:id/viewers` | JWT | Owner/admin viewer list |
| POST | `/stories/:id/reactions` | JWT | Set reaction `{ type }` |
| DELETE | `/stories/:id/reactions` | JWT | Remove reaction |
| POST | `/stories/:id/reply` | JWT | DM reply `{ text }` |

---

## 4. Backend Flow

```
StoriesService
  getFeed → buildFeed (group by user, seen/unseen)
  recordView → StoryViewRepository (unique per viewer)
  setReaction → StoryReactionRepository upsert + count sync
  replyToStory → MessagesService.sendMessage + notification
```

**Active filter:** `expiresAt > now` AND `deletedAt IS NULL` (`stories.repository.ts`).

**Owner view:** Self-views do not increment `viewsCount`.

**Reaction notify:** `story_reaction` to owner if new/changed reaction.

---

## 5. Database

| Model | Purpose |
|-------|---------|
| `Story` | Media, caption, `expiresAt`, counters |
| `StoryView` | Unique `(storyId, viewerId)` |
| `StoryReaction` | Unique `(storyId, userId)`, `type` string |

---

## 6. Socket

Not used for story views/reactions (REST only).

---

## 7. Notifications

| Type | Trigger |
|------|---------|
| `story_reaction` | Someone reacts to your story |
| `story_reply` | DM reply to your story |

---

## 8. Redis

| Key | TTL |
|-----|-----|
| `stories:feed:{viewerId\|anon}` | 20s |
| `stories:feed:*` | Invalidated on create/view/reaction |

---

## 9. BullMQ

Notifications via standard queue on reaction/reply.

---

## 10. Security

- View/reply require auth for mutations
- Viewers list: owner or `ADMIN` only
- Cannot reply to own story
- Expired stories return 404 on view/react/reply

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| Reaction type not enum-validated | Free string in DTO |
| Feed cache may show stale seen state | 20s TTL |
| No socket realtime for new stories | Poll/refresh only |

---

## 12. Production Readiness: **88%**

Full view/reaction/reply pipeline implemented. Gaps: realtime updates, reaction type catalog.

**Main files:** `backend-nest/src/stories/stories.service.ts`, `stories.controller.ts`



---

# FILE: subscription-lifecycle.md


# Subscription Lifecycle

## 1. Business Purpose

Subscription lifecycle manages **paid access windows**, **grace periods**, **expiration downgrades**, **renewal reminders**, **usage counter resets**, and **side effects** (verified badge, butcher subscription flags). Pure helpers live in `lib/subscription-lifecycle.ts`; orchestration in `subscription-lifecycle.service.ts`.

**Who uses it:**
- **Subscriptions API** — enrich `GET /api/subscriptions`
- **Payments webhook** — renewal success/failure notifications, refund downgrade
- **Livestreams / listings** — `expireIfNeededForUser` before entitlement checks
- **Cron / BullMQ** — batch expiration and reminders

---

## 2. Frontend Flow

No dedicated lifecycle screen. Users experience lifecycle through:

| UX | Trigger |
|----|---------|
| Plan shows as free after expiry | `expireIfNeeded` on `GET /api/subscriptions` |
| "تم إلغاء التجديد التلقائي" | `POST /api/subscriptions/cancel` |
| Renewal reminder notifications | Cron → `processReminderBatch` |
| "انتهى اشتراكك" notification | Expiration batch or grace reminder |

`SUBSCRIPTION_GRACE_DAYS` env (default **3**) controls grace after `renewDate` when `autoRenew: true`.

---

## 3. API Flow

Lifecycle logic is **not** exposed as standalone REST routes. It runs inside:

| Entry | Method | Path |
|-------|--------|------|
| Get subscription | GET | `/api/subscriptions` |
| Cancel auto-renew | POST | `/api/subscriptions/cancel` |
| Payment webhook | POST | `/api/payments/webhook` |
| Live eligibility | GET | `/api/livestreams/eligibility` |

---

## 4. Backend Flow

### Core helpers (`backend-nest/src/lib/subscription-lifecycle.ts`)

| Function | Behavior |
|----------|----------|
| `isPaidPlan(planId)` | slug !== `free` |
| `hasPaidAccess(sub, now)` | `renewDate > now` OR grace window if `autoRenew` |
| `getSubscriptionStatus(sub, now)` | `active` \| `cancelled` \| `grace_period` \| `expired` |
| `getEffectivePlanSlug(sub, now)` | paid slug or `free` when expired |
| `shouldBlockSubscriptionPayment(sub, targetPlan, tierOf)` | blocks pay if still in paid window |
| `daysUntilRenewDate(renewDate, now)` | reminder math |

### `SubscriptionLifecycleService` methods

| Method | Purpose |
|--------|---------|
| `getForUser` | Load row, `expireIfNeeded`, enrich with permissions |
| `expireIfNeeded` / `expireIfNeededForUser` | Downgrade if status `expired` |
| `downgradeUser` | `downgradeToFreeTx` + cache invalidate + notify |
| `cancelAutoRenew` | `setAutoRenew(false)` for active paid |
| `shouldBlockPayment` | Used by `PaymentsService.initiate` |
| `notifyRenewalSuccess` / `notifyRenewalFailed` | Post-payment notifications |
| `sendRenewalReminder` | Deduped via Redis, push + email |
| `processReminderBatch` | Days 7, 3, 1 before renew |
| `processExpirationBatch` | Downgrade expired; grace day-0 reminder |
| `activateFromPayment` | Alternate activation path (repository tx + notify) — **not called from payments webhook** (webhook uses `payments.repository.processSuccessfulPayment` instead) |

### `SubscriptionProcessor` (`backend-nest/src/queue/processors/subscription.processor.ts`)

| Job `kind` | Handler |
|------------|---------|
| `expire` | `lifecycle.processExpirationBatch()` |
| `reminders` | `lifecycle.processReminderBatch()` |
| `reset_live_minutes` | `subscriptionRepo.resetMonthlyUsageCounters()` |
| `auto_renew_attempt` | `notifyRenewalFailed(userId, 'subscription')` only — **no payment charge** |

Concurrency: **3**. Queue: `QUEUE_NAMES.SUBSCRIPTIONS` (`subscriptions`).

### Cron schedule (`WorkerCronService`)

| Job | Schedule | Action |
|-----|----------|--------|
| Subscription maintenance | Daily **06:00** (server local hour) | Enqueue `expire` + `reminders` |
| Weekly live minutes reset | **Monday 04:00** | Enqueue `reset_live_minutes` |

Uses Redis lock keys `cron:subscription:lock` and `cron:subscription:weekly_reset` (TTL 300s).

`SubscriptionQueueService.addSubscriptionJob` no-ops if Redis disabled or queue unavailable.

---

## 5. Database

### `SubscriptionLifecycleRepository`

| Method | DB effect |
|--------|-----------|
| `findExpirablePaidSubscriptions` | `planId != free` AND `renewDate < now` |
| `findPaidSubscriptionsRenewingWithin(days)` | renew within N days, `autoRenew: true` |
| `downgradeToFreeTx` | plan → free, reset counters, clear butcher subscription, verified badge side effect |
| `activatePaidPlanTx` | Used by `activateFromPayment` |
| `setAutoRenew` | `autoRenew: false` |
| `resetMonthlyUsageCounters` | Batch reset `liveMinutesUsed` (weekly cron job name is historical) |

---

## 6. Socket

No lifecycle-specific socket events.

---

## 7. Notifications

See `subscriptions.md`. Lifecycle service is the primary emitter for expiration, reminders, cancel, and downgrade (except payment success which also runs from `PaymentsService`).

Email template: `subscription_renew` via `EmailQueueService`.

---

## 8. Redis

| Key pattern | Purpose |
|-------------|---------|
| `subscription:{userId}` | Invalidated on state changes |
| `subscription:reminder:{userId}:d{7\|3\|1\|0}` | NX lock — one reminder per window |
| `cron:subscription:lock` | Cron deduplication |

---

## 9. BullMQ

**Queue:** `subscriptions` (Redis DB **1**, `QUEUE_CONNECTION`)

**Jobs enqueued by cron:**
```typescript
{ kind: 'expire' }
{ kind: 'reminders' }
{ kind: 'reset_live_minutes' }
```

**Defined but never enqueued in codebase:**
```typescript
{ kind: 'auto_renew_attempt', userId, subscriptionId }
```

Job options: 3 attempts, exponential backoff 5s, `removeOnComplete: 50`.

---

## 10. Security

- Expiration/downgrade always server-side — cannot extend `renewDate` from client.
- `shouldBlockSubscriptionPayment` prevents paying while still in paid window.
- Reminder dedup prevents notification spam per user/kind.
- Cron locks prevent duplicate batch runs across instances.

---

## 11. Possible Bugs

1. **`auto_renew_attempt` never scheduled** — no true auto-renew charging; only failure notification if manually enqueued.
2. **Dual activation paths** — `activateFromPayment` vs `processSuccessfulPayment` may diverge over time.
3. **`activateFromPayment` unused by webhook** — dead code risk / confusion.
4. **Cron hour uses server local time** — may not match KSA business expectations.
5. **Weekly job named `reset_live_minutes`** — resets monthly usage counters; naming mismatch.
6. **Grace reminder at day 0** — sent during expiration batch for `grace_period` but downgrade waits until grace ends.

---

## 12. Production Readiness (%)

**76%**

Expiration, reminders, downgrade transactions, and cron infrastructure are implemented. Major gap: **no automatic NI rebill** — `auto_renew_attempt` only notifies failure. Auto-renew flag affects grace only, not payment collection.



---

# FILE: subscriptions.md


# Subscriptions

## 1. Business Purpose

Subscriptions control **plan tier**, **feature permissions**, and **usage counters** (listings, live minutes, featured/pinned/daily ads) for **USER** and **BUTCHER** audiences. Users upgrade via NI payment; the app reads effective plan and permissions on every gated action.

**Who uses it:**
- **Mobile app** — `SubscriptionContext`, subscription picker, payment, fees hub, live eligibility, listing creation
- **Backend** — entitlements, livestreams, listings, payments fulfillment
- **Admin** — indirect via plan management (not subscription rows directly in admin UI reviewed)

---

## 2. Frontend Flow

| Screen / module | File | Role |
|-----------------|------|------|
| Plan picker | `app/app/subscription.tsx` | Lists plans via `usePlans`, billing toggle, navigates to `/payment` |
| Payment | `app/app/payment.tsx` | Initiates subscription payment |
| Fees hub (subscription tab) | `app/app/fees.tsx` | Shows current plan, links to `/subscription` |
| Profile / gating | `app/app/(tabs)/profile.tsx`, create flows | `useSubscription()` for permissions |
| Global state | `app/contexts/SubscriptionContext.tsx` | Fetches and caches subscription + plan catalog |

### `SubscriptionContext` flow

1. On auth: `GET /api/subscriptions` via `authFetch`.
2. Fetches `GET /api/plans?audience={planAudience}` to map plan details.
3. Exposes: `subscription` (id, planSlug, planAudience, plan, renewDate, permissions, usageCounters), `refetchSubscription`, `upgradePlan` (triggers refetch).

### `subscription.tsx` flow

1. `usePlans(subscription.planAudience)` for catalog.
2. User selects plan + monthly/yearly cycle.
3. `handleContinue` → `router.push({ pathname: '/payment', params: { planId: selected, cycle } })`.
4. Shows current plan card via `getPlanBySlug(subscription.planSlug)`.

**Provider mount:** `SubscriptionProvider` in app layout (wraps authenticated tree).

---

## 3. API Flow

| Method | URL | Auth | Body |
|--------|-----|------|------|
| GET | `/api/subscriptions` | JWT | — |
| POST | `/api/subscriptions/cancel` | JWT | — (no body) |

Both use `@RateLimit('api')`.

### `GET /api/subscriptions` response (enriched)

Includes: `id`, `planId`, `planAudience`, `billingCycle`, `renewDate`, `status`, `effectivePlanSlug`, `autoRenew`, usage counters, `permissions`, nested `plan` object from `PlanResolverService.toApiResponse()`.

Auto-creates free subscription if missing (`SubscriptionsRepository.upsertFree`).

### `POST /api/subscriptions/cancel`

Calls `SubscriptionLifecycleService.cancelAutoRenew(userId)` — sets `autoRenew: false` for active paid subscriptions; does not immediately downgrade.

Invalidates `subscription:{userId}` Redis cache.

---

## 4. Backend Flow

```
SubscriptionsController.getMine
  → SubscriptionsService.getMine(user)
    → repo.findByUserId OR upsertFree
    → SubscriptionLifecycleService.getForUser(userId)
      → expireIfNeeded (downgrade if expired)
      → PlanPermissionService.resolveEffective(slug, audience, hasPaidAccess)
    → RedisCacheService.set('subscription:{userId}', payload, 120s)

SubscriptionsController.cancel
  → SubscriptionLifecycleService.cancelAutoRenew()
  → SubscriptionCacheService.invalidate()
```

**Payment activation** (not in subscriptions controller): `PaymentsRepository.processSuccessfulPayment` updates subscription on successful NI webhook.

**Related services:**
- `SubscriptionEntitlementService` — `assertCanCreateListing`, `assertCanCreateLiveStream`, audience resolution
- `PlanPermissionService` — permission helpers used in lifecycle enrichment

---

## 5. Database

### `Subscription` model

| Field | Purpose |
|-------|---------|
| `userId` | Unique — one subscription per user |
| `planId` | Slug string, default `free` |
| `planAudience` | `USER` \| `BUTCHER` |
| `planDbId` | FK to `Plan` table |
| `billingCycle` | `monthly` \| `yearly` |
| `renewDate` | Paid access end / renewal anchor |
| `autoRenew` | Grace period eligibility when false after expiry |
| `listingsUsed`, `liveMinutesUsed`, `featuredAdsUsed`, `pinnedAdsUsed`, `dailyAdsUsed` | Usage counters |
| `status` | String — includes `active`, `downgraded` |

Related: `Payment.subscriptionId` links payments to subscription rows.

---

## 6. Socket

Subscriptions do not use dedicated socket events. Plan changes appear after REST refetch or notification tap.

---

## 7. Notifications

| Event | Type | Source |
|-------|------|--------|
| Cancel auto-renew | `subscription_renew` | `cancelAutoRenew` |
| Renewal success | `subscription_renew` + email | `notifyRenewalSuccess` (payment webhook) |
| Renewal failure | `subscription_renew` | `notifyRenewalFailed` (failed payment webhook) |
| Expiration downgrade | `subscription_renew` | `downgradeUser(..., 'expiration')` |
| Refund downgrade | `system` | `downgradeUser(..., 'refund')` |
| Renewal reminders (7/3/1 days) | `subscription_renew` + email | `sendRenewalReminder` (cron job) |

---

## 8. Redis

| Key | TTL | Purpose |
|-----|-----|---------|
| `subscription:{userId}` | 120s | Response cache from `SubscriptionsService.getMine` |
| `subscription:reminder:{userId}:{kind}` | 8 days | Dedup renewal reminders (`markReminderSent`) |

`SubscriptionCacheService.invalidate(userId)` on payment, cancel, downgrade, activation.

---

## 9. BullMQ

Subscriptions controller does not enqueue jobs. Lifecycle maintenance runs via `SubscriptionProcessor` (see `docs/subscription-lifecycle.md`).

Emails for renewal/reminder use `EmailQueueService.addEmail` with template `subscription_renew`.

---

## 10. Security

- All subscription endpoints require JWT.
- Users can only read/cancel their own subscription (`userId` from token).
- Effective permissions computed server-side — client `permissions` object is advisory for UI.
- Payment initiate validates plan slug against `PlansService.getUpgradablePlans` and blocks duplicate payment during active period.

---

## 11. Possible Bugs

1. **`upgradePlan` in context only refetches** — does not change plan without payment.
2. **Cache staleness** — 120s Redis cache may serve pre-payment subscription briefly.
3. **`isSubscriptionCacheStale` defined but unused** in hot path for invalidation on read.
4. **Cancel semantics** — UI may imply immediate cancellation; backend only disables auto-renew until `renewDate`.
5. **Audience mismatch** — user role vs `planAudience` resolved in `SubscriptionEntitlementService` (not in subscriptions controller).

---

## 12. Production Readiness (%)

**84%**

Read/cancel APIs, enriched permissions, payment fulfillment, and cache invalidation are solid. Gaps: no subscription history endpoint, no explicit upgrade-without-payment admin path in this module, and client relies on manual refetch after payment.



---

# FILE: uploads.md


# File Uploads

## 1. Business Purpose

Authenticated users upload images/videos/documents via **S3/Cloudinary presigned URLs** (production) or **local direct upload** (dev).

**Who uses it:** Mobile app for avatars, listings, posts, stories, butcher media, messages, butcher-application documents.

---

## 2. Frontend Flow

Typical flow:
1. `POST /api/upload/presign` with `{ folder, mimetype, count? }`
2. Client PUTs file to returned presigned URL
3. Uses public URL in subsequent API calls (listing images, story media, etc.)

Local dev may use `POST /api/upload/direct?folder=` multipart (when storage provider is `local`).

---

## 3. API Flow

Base: `/api/upload` — `upload.controller.ts`

| Method | URL | Auth | Purpose |
|--------|-----|------|---------|
| POST | `/upload/presign` | JWT | Generate presigned upload slot(s) |
| POST | `/upload/direct` | JWT | Local multer upload (dev only) |

**Presign body (`PresignUploadDto`):** `folder`, `mimetype`, optional `count` (default 1).

**Rate limit:** Max **30 uploads/hour/user** (`upload_count:{userId}` on Redis session DB).

---

## 4. Backend Flow

```
UploadController → UploadService
  presign → getPresignedUploadUrl() from lib/storage
  direct → multer disk → public/uploads/{folder}/
```

**Folders (`UploadFolder`):** `avatars`, `listings`, `stories`, `butchers`, `posts`, `temp`, `messages`, `butcher-applications`

**MIME rules:**
- Images: jpeg, png, webp, gif
- Stories/messages: images + story video types (`STORY_VIDEO_MIME_TYPES`)
- Butcher applications: `ALLOWED_DOCUMENT_MIME_TYPES` + size cap

**Size limits:** 20MB images, 50MB video/media folders; butcher docs per `MAX_SHOP_PHOTO_FILE_BYTES`.

**Storage provider:** `getStorageProvider()` — `local` | `s3` | `cloudinary` from env.

---

## 5. Database

Upload URLs stored as strings on entities (`User.avatar`, `Listing.images`, etc.). No separate `Upload` model.

---

## 6. Socket

Chat may send `imageUrl` / `videoUrl` from prior presign — not uploaded via socket.

---

## 7. Notifications

None on upload.

---

## 8. Redis

| Key | DB | TTL | Purpose |
|-----|-----|-----|---------|
| `upload_count:{userId}` | 2 | 3600s | Hourly upload quota |

---

## 9. BullMQ

`ImageQueueService.addImageProcessing` exists but **is never called** from upload flow (see `image-processing.md`).

---

## 10. Security

- JWT required
- Folder whitelist
- MIME validation per folder
- `IsOurUploadUrl` validator on some DTOs ensures URLs match configured storage
- Direct upload returns 404 when provider ≠ `local`

---

## 11. Possible Bugs / Risks

| Risk | Evidence |
|------|----------|
| Rate limit skipped if Redis off | `enforceUploadRateLimit` returns early |
| No virus scanning | Not implemented |
| Presign TTL 300s | Large slow uploads may expire |
| Cloudinary misconfig opaque error | 503 `storage_error` |

---

## 12. Production Readiness: **88%**

Presign + validation is solid for production S3/Cloudinary. Image post-processing not wired.

**Main files:** `backend-nest/src/upload/`, `backend-nest/src/lib/storage` (via `@/lib/storage`)



---

# FILE: users.md


# Users & Profile

## 1. Business Purpose

User profiles represent platform identities — display name, avatar, bio, verification badge, country. Users can update their profile and manage push tokens.

**Who uses it:** All registered users; guests can view public profiles.

---

## 2. Frontend Flow

| Screen | Path | Action |
|--------|------|--------|
| Public profile | `app/users/[id].tsx` | View user, follow button |
| Edit profile | `app/profile/edit.tsx` | Update name, avatar, bio |
| Profile tab | `app/(tabs)/profile.tsx` | Own listings, messages |
| Push token sync | `lib/notifications.ts` | `PUT /users/:id` with `fcmToken` |

**State:** `AppContext.me` for current user; `services/users.ts` + `authFetch` for API.

**No Redux / React Query.**

---

## 3. API Flow

Controller: `users.controller.ts` — prefix `/api/users`

| Method | URL | Auth | Notes |
|--------|-----|------|-------|
| GET | `/users` | Public | List/search users |
| GET | `/users/:id` | OptionalAuth | Profile + viewer context |
| PUT | `/users/:id` | JWT | Owner or admin only |
| DELETE | `/users/:id` | JWT | Soft delete |
| POST | `/users/:id/follow` | JWT | Toggle follow |
| GET | `/users/:id/connections` | OptionalAuth | Followers/following |

**Update body (`UpdateUserDto`):** `displayName`, `arabicName`, `bio`, `avatar`, `fcmToken`, etc.

---

## 4. Backend Flow

```
UsersController → UsersService → UsersRepository → Prisma User
```

**getUser:** Cache read `user:{id}` (Redis) → DB → cache set.

**updateUser:** Ownership check (`userId === id` or admin) → invalidate cache.

**deleteUser:** Soft delete (`deletedAt`) → cascade rules per relations.

**toggleFollow:** Insert/delete `Follow` row; unique constraint on pair.

---

## 5. Database

**Model:** `User` — see `prisma/schema.prisma` lines 10–66.

Key fields: `username` (unique), `email`, `phone`, `role`, `verified`, `fcmToken`, `deletedAt`.

Relations: posts, listings, butcher profile, orders, notifications, etc.

Indexes: `username`, `email`, `country`, `isActive`, `deletedAt`.

---

## 6. Socket

Users feature does not emit socket events directly. Online presence: `online:{userId}` set on socket connect.

---

## 7. Notifications

Follow actions may create `Activity` records (if implemented in service). Push token stored on `User.fcmToken` for all future pushes.

---

## 8. Redis

| Key | Purpose |
|-----|---------|
| `user:{id}` | Profile cache |

Invalidated on update.

---

## 9. BullMQ

Not used directly by users module.

---

## 10. Security

- Users can only update/delete own profile (unless ADMIN)
- Soft delete preserves referential integrity
- `fcmToken` update requires authentication as that user
- Public list may expose limited fields

---

## 11. Possible Bugs / Risks

| Risk | Notes |
|------|-------|
| Public user list without pagination limits | Check `listUsers` default page size |
| Avatar URL validation | Depends on upload service |
| Stale cache after admin ban | Cache invalidation on admin update |

---

## 12. Production Readiness: **88%**

**Main files:** `backend-nest/src/users/`, `app/services/users.ts`, `app/users/[id].tsx`

