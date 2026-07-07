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
