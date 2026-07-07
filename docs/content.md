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
