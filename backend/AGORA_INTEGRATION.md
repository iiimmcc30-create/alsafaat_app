# SAFAT × Agora — تكامل البث المباشر

## الملفات الجديدة

```
backend/
├── src/lib/agora.ts                          ← توليد Agora AccessToken2 (بدون مكتبات خارجية)
├── pages/api/livestreams/
│   ├── index.ts                              ← POST (إنشاء بث) + GET (قائمة البثوث النشطة)
│   └── [id].ts                              ← start / end / token / تفاصيل بث
└── prisma/migrations/20240103_agora/         ← إضافة agoraChannel + agoraUid للـ Schema

frontend/
├── hooks/useLiveStream.ts                    ← Hook كامل لـ Agora RTC (host + viewer)
└── app/live/
    ├── create.tsx                            ← نموذج إنشاء البث
    ├── broadcast.tsx                         ← شاشة المضيف (كاميرا + تحكم)
    └── watch/[id].tsx                        ← شاشة المشاهد
```

---

## خطوات التثبيت

### 1. متغيرات البيئة (backend/.env)

```env
AGORA_APP_ID="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"       # 32 حرف من console.agora.io
AGORA_APP_CERTIFICATE="yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"  # 32 حرف
```

### 2. مكتبة Agora (frontend)

```bash
cd frontend
npm install react-native-agora
npx expo prebuild --clean   # مطلوب لأن react-native-agora native module
```

> **ملاحظة:** `react-native-agora` لا تعمل مع Expo Go — يجب استخدام Development Build:
> ```bash
> npx expo run:ios
> # أو
> npx expo run:android
> ```

### 3. تحديث قاعدة البيانات

```bash
cd backend
npx prisma migrate dev --name add_agora_fields
# أو في الإنتاج:
npx prisma migrate deploy
```

### 4. تحديث Schema (أضف يدوياً)

في `backend/prisma/schema.prisma`، أضف لـ `model LiveStream`:

```prisma
model LiveStream {
  // ... الحقول الموجودة ...
  agoraChannel  String?   // channel name = streamId بدون hyphens
  agoraUid      Int?      // UID عددي مشتق من userId

  @@index([agoraChannel])
}
```

### 5. تحديث Nginx (اختياري — للـ CORS)

```nginx
# في nginx.conf، أضف لـ location /api/livestreams:
location /api/livestreams {
    proxy_pass http://api;
    proxy_read_timeout 30s;
}
```

---

## API Endpoints الجديدة

| Method | Endpoint | Auth | الوصف |
|--------|----------|------|-------|
| `POST` | `/api/livestreams` | ✅ مطلوب | إنشاء بث → يرجع Agora host token |
| `GET`  | `/api/livestreams` | — | قائمة البثوث النشطة (مكتنزة، 15s cache) |
| `GET`  | `/api/livestreams/:id` | — | تفاصيل بث + آخر 50 تعليق |
| `POST` | `/api/livestreams/:id?action=start` | ✅ Host فقط | بدء البث الفعلي |
| `POST` | `/api/livestreams/:id?action=end` | ✅ Host فقط | إنهاء البث + تسجيل إحصائيات |
| `GET`  | `/api/livestreams/:id?action=token` | ✅ مطلوب | رمز Agora viewer (صالح ساعتين) |

---

## تدفق العملية

```
المضيف:
  create.tsx → POST /api/livestreams → يحصل على { streamId, agoraToken, ... }
             → ينتقل لـ broadcast.tsx → join() Agora (preview mode)
             → يضغط "بدء البث" → POST /api/livestreams/:id?action=start
             → io.emit('live:start') → يُشعر المتابعين
             → يبدأ النشر (publish video + audio)

المشاهد:
  watch/[id].tsx → GET /api/livestreams/:id (تفاصيل + تعليقات)
                 → GET /api/livestreams/:id?action=token (Agora viewer token)
                 → join() Agora كـ Subscriber
                 → يشاهد بث المضيف تلقائياً
                 → يرسل تعليقات عبر Socket.IO
```

---

## حدود الاشتراكات

| الخطة | البث المباشر |
|-------|-------------|
| مجاني | ❌ غير متاح |
| أساسي (59 ر.س) | ✅ متاح |
| احترافي (149 ر.س) | ✅ متاح |
| VIP (299 ر.س) | ✅ متاح |

الحد الشهري يُتتبع في `subscription.liveMinutesUsed` — يتم تحديثه عند `action=end`.

---

## أمان التوكن

- **Host token:** صالح 4 ساعات، دور Publisher
- **Viewer token:** صالح ساعتين، دور Subscriber فقط
- **التجديد التلقائي:** `useLiveStream` ينفّذ `onTokenWillExpire` قبل 30 ثانية من انتهاء الصلاحية
- **لا يُرسل App Certificate للـ client أبداً** — التوقيع يتم في الـ Backend فقط

---

## اختبار محلي

```bash
# 1. شغّل Backend
cd backend && npm run dev

# 2. شغّل Frontend
cd frontend && npx expo run:ios

# 3. اختبر API مباشرةً
curl -X POST http://localhost:3001/api/livestreams \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Stream","arabicTitle":"بث تجريبي","category":"camels"}'
```

---

## ملاحظات الإنتاج

1. **Agora pricing:** يُحتسب بعدد الدقائق × عدد المشاركين. راقب الاستخدام من [console.agora.io](https://console.agora.io).
2. **Token renewal:** المشاهدون يجددون التوكن تلقائياً — تأكد من أن endpoint `/token` سريع الاستجابة.
3. **Channel cleanup:** عند `action=end`، Agora يُنهي القناة تلقائياً بعد مغادرة الجميع.
4. **Recording (اختياري):** Agora Cloud Recording يمكن تفعيله بـ API منفصل لتسجيل البثوث.
