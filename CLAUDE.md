# InfinityMade — Project Instructions

> Bu dosya Claude Code projeyi her açtığında otomatik okur. Tüm proje context'i burada.

---

## 🎯 Proje Özeti

**InfinityMade** — Almanya'daki küçük işletmeler için (kuaför, salon, restoran, fizyoterapi, klinik) WhatsApp AI resepsiyonist + randevu yönetimi + dashboard SaaS platformu.

**Hedef kitle:** Almanya'daki KOBİ'ler (~3M işletme)
**Domain:** [infinitymade.de](https://infinitymade.de)
**VPS:** `n8n.infinitymade.de` (Hetzner, Docker + Traefik)
**Status (2026-05-09):** Production'da, ilk müşteriler test ediyor

---

## 🛠️ Tech Stack

```
Frontend:       Vanilla HTML/CSS/JS (NEXT.JS DEĞİL)
Hosting:        Vercel (website/ klasörü)
Auth:           Supabase Auth (email + Google OAuth)
Database:       Supabase PostgreSQL (project: njvuclullotbksskpwgk)
AI/Bot:         n8n workflow + Claude/Gemini
WhatsApp:       Twilio (sandbox şu an, production approval bekleniyor)
Calendar API:   Custom Node.js Express backend (VPS'te PM2)
Payments:       Stripe (test mode şu an)
```

**ÖNEMLİ:** Bu proje **vanilla HTML/JS**. Next.js DEĞİL. `app/` klasörü yok, `page.tsx` yok. `dashboard.html` + `dashboard.js` gibi düz dosyalar.

---

## 📁 Proje Yapısı

```
website/                              ← BU DİZİN (Claude Code burada açılır)
├── index.html                        Landing page
├── dashboard.html + dashboard.js     Müşteri dashboard
├── onboarding.html + onboarding.js   8-adımlı kayıt akışı
├── login.html + login.js             Auth
├── booking.html + booking.js         Public müşteri rezervasyon (kendi sistem!)
├── kalender.html + kalender.js       Owner: services, hours, integrations
├── employee-signup.html + .js        Çalışan kayıt (company_code ile)
├── api/                              Vercel serverless functions
│   ├── _lib/                         (auth.js, stripe.js helpers)
│   └── stripe/                       Stripe checkout/webhook/portal
├── api-backend/                      ★ VPS Node.js backend
│   ├── server.js                     Express API (port 3000)
│   ├── package.json
│   └── docker-compose.yml            Traefik + n8n + api-proxy
├── pakete/, *-stadt.html             SEO landing pages
├── messages/, styles.css, script.js
└── supabase-config.js
```

---

## 🏗️ Mimari

### 3 ana sistem birbirine bağlı:

**1. Web (Vercel)** → `infinitymade.de`
- Landing, dashboard, onboarding, booking pages
- Stripe entegrasyonu serverless functions ile

**2. VPS (Hetzner)** → `n8n.infinitymade.de`
- Docker stack: Traefik (HTTPS) + n8n + api-proxy (socat)
- PM2 ile `calendar-api` Node.js servis (port 3000, host'ta)
- Traefik label: `n8n.infinitymade.de/api/*` → host:3000

**3. Supabase** → `njvuclullotbksskpwgk.supabase.co`
- Auth + DB + Vault (encrypted tenant secrets)

### Multi-tenant model:
- `profiles.role` → `owner` veya `employee`
- `profiles.owner_id` → çalışanlar şirket sahibine bağlı
- `profiles.company_code` → 6-haneli kod, çalışan kayıt için

---

## 🔌 Calendar API (kendi sistemimiz, Cal.com YERİNE)

**Production endpoint base:** `https://n8n.infinitymade.de/api`

**Routes:**
- `GET /api/calendar/google-auth?userId=...` — OAuth başlat
- `GET /api/calendar/google-callback` — OAuth callback (Google Console'da kayıtlı)
- `POST /api/booking/get-slots` — `{userId, date, duration}` → müsait slot listesi
- `POST /api/booking/create` — public rezervasyon
- `POST /api/booking/manual-create` — admin paneli üzerinden manuel
- `POST /api/verify-code` — `{code}` → owner ID lookup
- `GET /api/team?owner_id=...` — şirket çalışan listesi

### ✅ Eskiden P0 sayılanlar (2026-05-22 itibariyle çözüldü)

1. ~~OAuth race~~: `newOAuthClient()` factory'ye dönüştürüldü, modül seviyesinde singleton kalktı
2. ~~Double-booking~~: PostgreSQL `no_overlapping_bookings` EXCLUDE GIST constraint var (tstzrange `&&` overlap, status='confirmed' filtreli)
3. ~~Timezone~~: tüm helper'lar `Intl.DateTimeFormat({ timeZone: BUSINESS_TZ })` + `berlinOffsetMin()` ile DST-safe
4. ~~Service-role fallback~~: env eksikse `process.exit(1)`, hardcoded yok
5. ~~Rate limit~~ (2026-05-22): `express-rate-limit` ile `/booking/get-slots` (60/dk), `/booking/create` (20/dk), `/verify-code` (5/10dk) korumalı

### 🟡 Hâlâ kalan eksikler

- **Captcha**: rate limit yeterli sıradan abuse için, ama bot için reCAPTCHA henüz yok
- **Email confirmation**: booking sonrası müşteriye e-posta gitmiyor (Resend/Postmark entegrasyonu lazım)
- **Monitoring**: Sentry yok, üretim hatası tarayıcı console'a düşer

---

## 💳 Stripe (Test Mode)

- **Plans:** Starter €29 / Professional €49 / Klinik €99 (monthly + yearly)
- **Trial:** 14 gün
- **Webhook URL:** `https://www.infinitymade.de/api/stripe/webhook` (www zorunlu)
- **Customer Portal:** Aktif

`STRIPE_SETUP.md` ✅ — fiyat ID'leri ve env vars dökümante.

### Profile alanları
```
plan, plan_status (pending/trial/active/past_due/canceled/expired),
trial_ends_at, stripe_customer_id, stripe_subscription_id,
stripe_price_id, billing_interval, current_period_end
```

---

## 🤖 n8n Workflow (Multi-tenant WhatsApp)

- Tek workflow, per-business config Supabase Vault'tan çekiliyor
- Twilio sandbox: `+14155238886`
- Customer Twilio'ya WhatsApp → n8n → Claude/Gemini → Cal.com (eskiden) / kendi calendar API (yeni)
- `business_lookup_for_twilio` RPC → service_role key gerekli

---

## 🔐 Environment Variables

**Vercel (Production):**
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, fiyat ID'leri
- `NEXT_PUBLIC_URL=https://infinitymade.de`
- `SUPABASE_SERVICE_ROLE_KEY`

**VPS (`/var/www/calendar-api/api-backend/.env`):**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URL`
- `N8N_WEBHOOK_URL`

---

## 📐 Kurallar

### Genel
- API anahtarlarını ASLA hardcode etme — env var
- `console.log` yerine proper error response
- Her API route'unda try/catch + anlamlı HTTP status

### Frontend
- Vanilla JS, framework yok
- ES modules (`<script type="module">`)
- Cache busting: HTML'lerde `?v=YYYYMMDD` query param
- `vercel.json` JS/CSS/HTML için `Cache-Control: max-age=0, must-revalidate`

### Multi-tenant
- Her query'de `user_id` filter veya RLS
- `service_role` SADECE backend'de (asla client'ta!)

### Stil
- TypeScript yok, vanilla JS
- Almanca UI metinleri (DE default, EN/TR çeviri var)

---

## 🚀 Deployment

**Frontend:** `git push` → Vercel auto-deploy (main branch)
**VPS:** WinSCP ile `server.js` upload → `pm2 restart calendar-api`
**Supabase:** SQL editor veya MCP

---

## 📋 Aktif TODO (öncelik sırası)

1. 🔴 Calendar API P0 buglar (oauth race, double-booking, timezone)
2. 🟡 Public endpoint rate limit + captcha
3. 🟠 Cal.com kalıntılarını temizle (`cal_username` field, dashboard iframe)
4. 🟠 Email confirmation sistemi (booking sonrası)
5. 🟢 Twilio production numarası + Facebook Business approval
6. 🟢 Sector branching (barber-only şu an, diğerleri "coming soon")

---

## 📚 İlgili Dosyalar

- `INFINITYMADE_DASHBOARD.md` — dashboard tasarım dokümantasyonu
- `PRAXISAI_UPGRADE_CHEATSHEET.md` — n8n workflow upgrade notları
- `STRIPE_SETUP.md` — Stripe kurulum rehberi
- `infinitymade.md`, `infinitymade_v2.md` — eski plan dokümanları (referans)

---

*Son güncelleme: 2026-05-09 | Status: Beta, ilk müşteriler test ediyor 🟡*
