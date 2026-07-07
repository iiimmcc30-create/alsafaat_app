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
