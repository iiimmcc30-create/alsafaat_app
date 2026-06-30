# SAFAT Backend — دليل التشغيل الكامل

## هيكل المشروع

```
safat-backend/
├── pages/api/            ← Next.js API Routes
│   ├── auth/             ← تسجيل، دخول، تحديث token
│   ├── listings/         ← إعلانات السوق
│   ├── posts/            ← المنشورات + likes + reposts
│   ├── butchers/         ← الملاحم
│   ├── users/            ← الملفات الشخصية
│   ├── payments/         ← بوابة Network International
│   ├── fees/             ← رسوم الإعلانات
│   ├── notifications/    ← الإشعارات
│   ├── upload/           ← رفع الملفات (S3 presign)
│   └── health.ts         ← Health check
├── src/
│   ├── lib/
│   │   ├── prisma.ts     ← Prisma singleton
│   │   ├── redis.ts      ← Redis + Cache helpers
│   │   ├── jwt.ts        ← JWT sign/verify
│   │   ├── queue.ts      ← BullMQ queues
│   │   ├── storage.ts    ← AWS S3
│   │   ├── commissions.ts← حساب العمولات
│   │   └── logger.ts     ← Pino logger
│   ├── middleware/
│   │   ├── auth.ts       ← JWT middleware
│   │   └── rateLimiter.ts← Rate limiting
│   ├── socket-server.ts  ← Socket.IO standalone
│   └── workers/
│       └── index.ts      ← BullMQ workers
├── prisma/
│   ├── schema.prisma     ← Database schema
│   └── seed.ts           ← Initial data
├── nginx/
│   └── nginx.conf        ← Reverse proxy + HTTPS
├── .github/workflows/
│   └── deploy.yml        ← CI/CD pipeline
├── docker-compose.yml    ← Full stack
├── Dockerfile            ← Multi-stage build
└── .env.example          ← Variables template
```

---

## ⚡ تشغيل سريع (Development)

### 1. المتطلبات
- Node.js 20+
- Docker + Docker Compose
- PostgreSQL 16
- Redis 7

### 2. إعداد المتغيرات
```bash
cp .env.example .env
# عدّل القيم حسب بيئتك
```

### 3. تشغيل PostgreSQL + Redis
```bash
docker compose up postgres redis -d
```

### 4. تهيئة قاعدة البيانات
```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
```

### 5. تشغيل الخادم
```bash
# Terminal 1: Next.js API
npm run dev

# Terminal 2: Socket.IO
npm run socket:dev

# Terminal 3: BullMQ Workers
npm run worker
```

---

## 🐳 تشغيل بـ Docker (Production)

```bash
# بناء وتشغيل كل الخدمات
docker compose up -d

# تهيئة قاعدة البيانات
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma db seed

# متابعة السجلات
docker compose logs -f api socket worker
```

---

## 🔌 Socket.IO Events

### Client → Server
| Event | البيانات | الوصف |
|-------|---------|-------|
| `chat:join` | `threadId` | انضمام لخيط محادثة |
| `chat:send` | `{threadId, receiverId, text}` | إرسال رسالة |
| `chat:typing` | `{threadId, receiverId}` | مؤشر الكتابة |
| `live:join` | `streamId` | مشاهدة بث مباشر |
| `live:comment` | `{streamId, message}` | تعليق على البث |
| `live:like` | `streamId` | إعجاب بالبث |
| `order:status` | `{orderId, status}` | تحديث حالة طلب ملحمة |

### Server → Client
| Event | الوصف |
|-------|-------|
| `chat:message` | رسالة جديدة في الخيط |
| `chat:notification` | إشعار رسالة |
| `chat:typing` | الطرف الآخر يكتب |
| `live:viewers` | عدد المشاهدين محدّث |
| `live:comment` | تعليق جديد |
| `order:updated` | تحديث طلب الملحمة |
| `notification` | إشعار عام |

---

## 💳 API الرئيسية

### Auth
```
POST /api/auth/register  — تسجيل جديد
POST /api/auth/login     — تسجيل دخول
POST /api/auth/refresh   — تجديد access token
```

### Listings
```
GET    /api/listings              — قائمة الإعلانات (مع فلترة)
POST   /api/listings              — نشر إعلان جديد (+ حساب عمولة)
GET    /api/listings/[id]         — تفاصيل إعلان
PUT    /api/listings/[id]         — تعديل
DELETE /api/listings/[id]         — حذف
```

### Posts
```
GET  /api/posts          — بيانات المنشورات
POST /api/posts          — نشر منشور
POST /api/posts/[id]/like — إعجاب/إلغاء إعجاب
```

### Fees & Payments
```
GET  /api/fees                    — رسوم المستخدم
POST /api/payments/initiate       — بدء الدفع (Network International)
```

### Upload
```
POST /api/upload/presign          — رابط رفع مباشر لـ S3
```

---

## 📊 نظام العمولات

| الصنف | الرسوم |
|-------|--------|
| 🐑 الأغنام بجميع أنواعها | **٢٠ ريال / رأس** |
| 🐐 الماعز بجميع أنواعها | **٢٠ ريال / رأس** |
| 🐪 الإبل بجميع أنواعها | **٦٠ ريال / رأس** |
| الخيول + الأبقار + الطيور + العلف + المعدات | **٢٪ من السعر** |
| 🏪 المتجر العادي | **٥٪ من البيع** |

---

## 🚀 Cloud Deployment (VPS)

```bash
# على الخادم
git clone https://github.com/your-org/safat-backend /opt/safat-backend
cd /opt/safat-backend
cp .env.example .env
# عدّل .env بالبيانات الحقيقية

# Let's Encrypt SSL
apt install certbot
certbot certonly --standalone -d api.safat.app
cp /etc/letsencrypt/live/api.safat.app/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/api.safat.app/privkey.pem nginx/ssl/

# تشغيل
docker compose up -d
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma db seed
```

---

## 🔧 Environment Variables المطلوبة

```env
DATABASE_URL          — PostgreSQL connection string
REDIS_HOST            — Redis host
JWT_SECRET            — 32+ حرف عشوائي
JWT_REFRESH_SECRET    — 32+ حرف عشوائي
MAYSAR_API_KEY        — مفتاح بوابة Network International
AWS_ACCESS_KEY_ID     — AWS للتخزين
AWS_SECRET_ACCESS_KEY — AWS للتخزين
AWS_S3_BUCKET         — اسم bucket
FIREBASE_PROJECT_ID   — Firebase للإشعارات
SENTRY_DSN            — Sentry للمراقبة
```
