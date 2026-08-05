# Praxura — Project Instructions

> Bu dosya Claude Code projeyi her açtığında otomatik okur. Tüm proje context'i burada.

---

## 🎯 Proje Özeti

**Praxura** — Almanya'daki **Heilmittel praxis'leri** için all-in-one praksis yönetim
yazılımı: randevu, dijital hasta dosyası, KI-Rezept taraması, §302 SGB V GKV abrechnung
hazırlığı, Fahrtenbuch.

**Hedef kitle:** SADECE Heilmittelerbringer — **Physio · Ergo · Logopädie · Podologie**
(+ interdisipliner praxis'ler ve Enterprise praxis birlikleri).
**Uygun DEĞİL:** doktor/diş hekimi muayenehaneleri, kuaför/güzellik salonları, Heilmittel
dışı sektörler.

> **Tarihçe (yanlış anlaşılmasın):** Proje 2026 başında "InfinityMade" adıyla genel KOBİ
> (kuaför, güzellik, fitness, gastro + fizyoterapi) hedefliyordu. 2026-06'da praxis alanında
> uzmanlaşma kararı alındı, diğer sektörler kapsam dışına çıkarıldı ve ürün **Praxura**
> olarak yeniden markalandı. Eski dosyalarda geçen genel-KOBİ hedefi **geçersizdir.**

### Marka / domain ayrımı — karıştırma

| Ne | Nerede |
|---|---|
| **Ürün** (pazarlama sitesi) | `praxura.de` |
| **Uygulama** | `app.praxura.de` |
| **Tüzel kişi / üretici** (Impressum, sözleşmeler) | InfinityMade, Siegburg NRW — `infinitymade.de` ayrı kurumsal repo |
| **Backend + n8n + analytics + status** | `n8n.infinitymade.de` (Hetzner) — **kasten taşınmadı** |

Yani `infinitymade.de` görmek her zaman "eskimiş" demek değildir: altyapı ve tüzel kişi
hâlâ orada. Eskimiş olan, **ürünün** InfinityMade diye anılması.

**Status (2026-08-05):** Beta, ilk müşteriler test ediyor 🟡

---

## 🛠️ Tech Stack

```
Frontend:    Vanilla HTML/CSS/JS — Next.js DEĞİL, TypeScript DEĞİL, framework YOK.
             `app/` klasörü yok, `page.tsx` yok. `dashboard.html` + `dashboard.js` gibi
             düz dosyalar. ES modules (<script type="module">).
Hosting:     Vercel (bu klasör) — ⚠️ serverless fonksiyon limiti, bkz. Kurallar
Auth:        Supabase Auth (email + Google OAuth)
Database:    Supabase PostgreSQL (project: njvuclullotbksskpwgk)
Backend:     Node.js Express, VPS'te Docker container — `api-backend/server.js`
AI:          Azure AI gateway (n8n üzerinden) — rezept OCR, b2c-draft → api-backend/ai/router.js
Payments:    Stripe LIVE (2026-06-11'den beri gerçek ödeme)
Monitoring:  Sentry — frontend (sentry-init.js) + backend (api-backend/instrument.js)
Mail:        nodemailer + SMTP  ⛔ Resend/Postmark KULLANMA
```

---

## 📁 Proje Yapısı

```
website/                          ← BU DİZİN (Claude Code burada açılır)
│
├── dashboard.html + dashboard.js  ★ ANA UYGULAMA (dev; tüm modüller burada)
├── index.html                     Pazarlama landing (praxura.de)
├── onboarding.html/.js            Kayıt akışı
├── login.html/.js · employee-signup · admin-login/admin
├── booking.html/.js               Public rezervasyon (slug ile) — CANLI
├── booking-request.html/.js       Termin-Anfrage: hasta talep eder, owner onaylar — CANLI
├── kalender.html/.js              Owner: services, hours, integrations
│
│   ── Ortak modüller (YENİDEN YAZMA, bunları kullan) ──
├── nav-registry.js                Sidebar/modül görünürlük — tek kaynak
├── katalog-suche.js               ICD / Diagnosegruppe / Heilmittel seçici
├── patient-suche.js               Hasta seçici
├── calendar-widget.js             Tarih seçici
├── cookie-consent.js · sentry-init.js · supabase-config.js
│
├── api/                           Vercel serverless — ⚠️ 12/12 DOLU (bkz. Kurallar)
│   ├── _lib/                      auth.js, stripe.js, pricing.js (fonksiyon SAYILMAZ)
│   ├── stripe/                    create-checkout-session, portal-session, webhook
│   ├── onboarding/                pending, check-email
│   ├── admin/                     data, feedbacks
│   └── config.js · contact.js · demo-booking.js · dsgvo.js · apify/search.js
│
├── api-backend/                   ★ VPS Express backend (Docker container)
│   ├── server.js                  ~35 route (aşağıya bak)
│   ├── instrument.js              Sentry init
│   ├── ai/                        router.js · azureClient.js · pii-mask.js · audit.js
│   │   ├── validators/            Rezept doğrulama (blankoRules, validate)
│   │   ├── catalogs/  tasks/
│   ├── billing/                   ★ §302 SGB V zinciri
│   │   ├── dta/                   EDIFACT üretimi (SLGA/SLLA/SLEZ/SLAU/SLEK)
│   │   ├── zaa/                   Kasa geri bildirim (Absetzung) parser
│   │   ├── kostentraeger/         IK / Kostenträgerdatei
│   │   ├── zuzahlung/ belegliste/ pdf/ codes/ utils/ api/
│   ├── lib/phi-encrypt.js         Hasta verisi şifreleme
│   ├── Dockerfile · docker-compose.yml
│
├── Handbücher/                    GKV/§302 belge arşivi — INDEX.md protokolü zorunlu
├── Podoloji/ · verordnung rezept/  Alan belgeleri
├── billing/ compliance/ konsey/   DSGVO belgeleri, konsey kararları
├── .claude/agents/ + skills/       ★ Ajanlar ve /konsey (aşağıya bak)
├── praxissoftware-*.html           SEO landing sayfaları (4 Fachbereich + TI)
└── archive/                        39 eskimiş rapor — güncel bilgi için BAKMA
```

---

## 🏗️ Mimari

### 3 ana sistem birbirine bağlı:

**1. Web (Vercel)** → `infinitymade.de`
- Landing, dashboard, onboarding, booking pages
- Stripe entegrasyonu serverless functions ile

**2. VPS (Hetzner)** → `n8n.infinitymade.de`
- **İki ayrı Docker stack, aynı `web` network'ünde:**
  - `/opt/n8n/` → Traefik (HTTPS/Let's Encrypt) + n8n
  - `/opt/calendar-api/` → `calendar-api` container + **Watchtower**
- `calendar-api` container'ının **içinde** PM2 çalışır (`pm2-runtime`, 2 instance).
  Host'ta PM2 **yok**.
- Traefik: `n8n.infinitymade.de/api/*` → calendar-api

> ⚠️ **"Calendar API" adı yanıltıcı — artık takvim servisi değil.** İsim eskiden kaldı;
> bugün içinde Rezept OCR, attendance, §302 billing, booking-request, hasta arama var.
> Backend'in tamamı odur.

**3. Supabase** → `njvuclullotbksskpwgk.supabase.co`
- Auth + PostgreSQL + Vault
- **Vault bugün TEK iş yapıyor:** onboarding'in geçici şifresini şifreli saklamak
  (`api/onboarding/pending.js`). Eskiden "per-tenant API secrets" tutuyordu — o zincir
  WhatsApp'la beraber öldü, kalıntı fonksiyonları 2026-08-05'te drop edildi.

---

## 🔌 Backend API (`api-backend/server.js`)

**Base:** `https://n8n.infinitymade.de/api` · ~35 route. Aile aile:

| Aile | Route'lar | Auth |
|---|---|---|
| **Rezept / KI** | `POST /rezept/upload` · `/rezept/confirm` · `/rezept/save` · `/prescription/lookup-by-phone` | `requireAuthAI` |
| **Booking** | `POST /booking/get-slots` · `/booking/create` · `/booking/manual-create` · `/booking/batch-create` · `/booking/batch-create-explicit` · `/booking/ai-suggest-series` · `PATCH /booking/:id` | karışık |
| **Termin-Anfrage** | `POST /booking-request/create` · `/approve` · `/decline` · `/cancel` · `GET /booking-request/list` | karışık |
| **Attendance** | `POST /attendance/check-in` · `/check-out` · `GET /attendance/today` · `/report` · `PATCH /attendance/:id/note` | `requireAuthAI` |
| **Public lookup** | `GET /patients/lookup` · `/services/public` · `/team/public` · `/krankenkassen` · `POST /verify-code` | public + rate limit |
| **Google** | `GET /calendar/google-auth` · `/calendar/google-callback` · `/gmail/connect` · `POST /gmail/send` | karışık |
| **Diğer** | `GET /health` · `/team` · `POST /apify/search` · `/admin/recover-checkout` | karışık |

> Route eklemeden/değiştirmeden önce **server.js'i grep'le** — bu tablo özettir, kaynak koddur.

**Çözülmüş, tekrar açma:** OAuth race (`newOAuthClient()` factory) · double-booking
(`no_overlapping_bookings` EXCLUDE GIST constraint) · timezone (tümü `Intl.DateTimeFormat`
+ `berlinOffsetMin()`, DST-safe) · service-role fallback (env yoksa `process.exit(1)`) ·
rate limit (`express-rate-limit`, public route'larda).

**Bilinen eksik:** reCAPTCHA yok — public route'larda tek koruma rate limit.
(Diğer açık işlerin tamamı → `TODO.md`)

---

## 💳 Stripe (LIVE — 2026-06-11'den beri gerçek ödeme alınıyor)

- **Plans (2026-08-05 canlı `index.html`'den doğrulandı — TEK GEÇERLİ SET):**
  Starter **29 €**/ay (25 € yıllık) · Professional **49 €**/ay (42 €) · Klinik **99 €**/ay (84 €) · Enterprise bireysel.
  ⚠️ Eski pazarlama/plan dosyalarında dolaşan 39/59 ve 89/149/219 setleri **geçersizdir.**
- **Trial:** 14 gün · **Customer Portal:** aktif · **Checkout domain:** `pay.praxura.de`
- **Enterprise price ID hâlâ YOK** — `pricing.js`/`stripe-live-setup.js`'te geçmiyor (`TODO.md` §2.3)
- **Webhook:** endpoint'in praxura.de'ye baktığı **panelden doğrulanmalı** (`TODO.md` §2.3)

`STRIPE_SETUP.md` — env var **adları** geçerli, ama dosya Test Mode döneminde yazıldı.
LIVE ürün/fiyat scripti: `stripe-live-setup.js`.

### Profile alanları
```
plan, plan_status (pending/trial/active/past_due/canceled/expired),
trial_ends_at, stripe_customer_id, stripe_subscription_id,
stripe_price_id, billing_interval, current_period_end
```

---

## 🤖 n8n

Bugün **tek iş** yapıyor: **Azure AI gateway** (rezept OCR, b2c-draft) → `api-backend/ai/router.js`.
Ayrıca `gkv-datenaustausch.de` izleme workflow'u Telegram bildirimi atıyor.

WhatsApp / Twilio / AI resepsiyonist **2026-05-20'de raflandı ve geri gelmiyor** — tablolar
DROP'lu. Pazarlama metinlerinde kullanma, `business_lookup_for_twilio` RPC'sine dokunma.

⛔ G8: **yeni n8n workflow'u açılmaz** (aşağıya bak).

---

## 🔐 Environment Variables

**Vercel (Production):**
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client'a `/api/config` ile gider)
- `SUPABASE_SERVICE_ROLE_KEY`
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS`
- `NEXT_PUBLIC_URL` — ⚠️ praxura.de olmalı, doğrulanmadı (`TODO.md` §2.3)

**VPS (`/opt/calendar-api/.env.calendar`):**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URL`
- `N8N_WEBHOOK_URL`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`

> ⚠️ **Doğru anahtar adı `SUPABASE_SERVICE_ROLE_KEY`.** `SUPABASE_SERVICE_KEY` yazmak
> prod'da crash-loop yaratmıştı — Watchtower bozuk image'ı 60 saniyede canlıya alır.

---

## 📐 Kurallar

### 📚 Belge arşivi protokolü (2026-08-04)
`Handbücher/`, `Podoloji/`, `verordnung rezept/` altındaki GKV/§302/Heilmittel belgelerine
dokunan her iş şu sırayı izler:
1. **Önce `Handbücher/INDEX.md`** — 33 belgenin kaydı, sürümü ve bölüm haritası orada
2. **Hedefli oku** — kayıttaki "Anahtar bölümler"den `Grep` ile ilgili kısmı bul, sadece onu oku.
   Belgenin tamamını okumak neredeyse her zaman hatadır (`Anlage_1_TP5_V21` tek başına ~130k token)
3. **Sonra kaydet** — INDEX'te kaydı olmayan bir belge okunduysa kaydı INDEX'e eklenir
4. Okuma her zaman `.txt` üzerinden; `.pdf` açılmaz (`pdftotext -enc UTF-8 -layout` ile üretilir)

Süzülmüş kurallar: `Handbücher/SPEC-RULES.md` (kaynak + sürüm + kod satırı üçlüsü zorunlu).
Geçerli sürüm: **Anlage 1 ve 3 TP5 = V21**. V22/V10 → 01.02.2027, erken geçiş dosya reddi demektir.

### 🚨 Vercel serverless limiti — 12/12 DOLU

Vercel planımız **en fazla 12 serverless fonksiyona** izin veriyor. `api/` altında şu an
**tam 12** tane var. **Bir tane daha eklersen deploy patlar.**

- `api/_lib/*` sayılmaz (import edilen yardımcılar, endpoint değil) — ortak kod oraya gider
- Yeni bir HTTP endpoint gerekiyorsa → **`api-backend/server.js`'e yaz** (G8 zaten bunu söylüyor)
- Mecburen Vercel'de olmalıysa: mevcut bir fonksiyona `?action=` ile bindir, yeni dosya açma
- Sayımı doğrula: `find api -name "*.js" -not -path "api/_lib/*" | wc -l`

### ⛔ G8 — On-Prem uyumluluğu

Yeni özellik buluta **YENİ zincir ekleyemez**: yeni Vercel fonksiyonu yok · Supabase
cloud-only özelliği yok · yeni üçüncü-parti CDN script'i yok · yeni n8n workflow'u yok.
Sebep: SaaS→on-premise geçişi planlanıyor (`ONPREM_MIGRATION_PLAYBOOK.md`), her yeni bulut
bağımlılığı geçiş maliyetini büyütür.

### 🎯 Vertikal sıralaması — hangi alanla uğraşıyoruz

**Önce Podoloji, uçtan uca bitene kadar.** Diğer alanlar (Physio · Ergo · Logopädie) ortak
özellikleri kullanır ama **ince ayarı ertelenmiştir.**

- Bir alanın ince ayarı bitmeden **o alanda müşteri alınmaz**
- Başka alanda bulunan eksik → not edilir, hemen yapılmaz
- Örnek: Ergotherapie Blankoverordnung sözleşmesi 01.04.2024'ten beri yürürlükte ve kodumuz
  onu blokluyor. Gelir etkisi var ama **bilinçli olarak beklemede** (`TODO.md` §3.7)

### Frontend

- **Ortak modülleri yeniden yazma.** Yeni seçici/arama/takvim gerekiyorsa önce bak:
  `katalog-suche.js` (ICD/Diagnosegruppe/Heilmittel) · `patient-suche.js` · `calendar-widget.js`
- **`<datalist>` kullanma** — bu modüller onun yerine var
- **Sidebar modülü** eklenecekse `nav-registry.js`'e yazılır (tek kaynak + görünürlük toggle)
- **Dark theme:** `#fff` / `#f3f4f6` gibi sabit renk **YASAK** →
  `--bg-card-solid`, `--text-main` CSS değişkenlerini kullan
- **i18n:** `data-i18n` etiketi HTML'i ezer; gerçek metin **`dashboard.js` sözlüğünde**
  (de / en / tr). Metin değiştirirsen **üç dili de** güncelle
- Cache busting: `?v=YYYYMMDD`, aynı sürümü tekrar kullanma
- Inline `onclick` ES-module içinden çalışmaz → `window.fn = fn` gerekir

### Multi-tenant

Model: `profiles.role` → `owner` | `employee` · `profiles.owner_id` → çalışan→sahip bağı ·
`profiles.company_code` → 6 haneli çalışan kayıt kodu.

- Her query'de `user_id` filtresi veya RLS
- `service_role` **SADECE** backend'de, asla client'ta
- **Owner seviyesindeki ayarlar `profiles`'a yazılır, `businesses`'a DEĞİL.** Tek-praxis
  owner'ların `businesses` kaydı yok — oraya konan ayar görünmez/kaydedilmez
- Standort'lar arası veri paylaşımı: `data_sharing_settings` + `bizScope` helper
- **İki ayrı veri havuzu var, birleştirme:** Physio/Logo/Ergo → `prescriptions` +
  `prescription_sessions` · Podologie → `verordnungen` + `podologie_behandlungen`

### Genel

- API anahtarını ASLA hardcode etme — env var
- `console.log` yerine düzgün error response; her route'ta try/catch + anlamlı HTTP status
- Opsiyonel lookup'ta `.single()` **kullanma** → 406 döner, `.maybeSingle()` kullan
- UI metinleri Almanca (DE varsayılan)
- `git push`'u **ana context'te ve ön planda** çalıştır — subagent'ta veya
  `run_in_background` ile Windows Credential Manager'a erişilemiyor, sessizce asılı kalır

---

## 🚀 Deployment

**Frontend:** `git push` → Vercel auto-deploy (main branch)

**VPS (backend):** `git push` → image build → **Watchtower** ~60 sn içinde yeni image'ı
çeker ve container'ı yeniler. **Otomatik.**

> ⛔ **WinSCP ile host'a dosya kopyalamak İŞE YARAMAZ.** Kod container image'ının içinde;
> host'taki dosyayı değiştirmek canlıyı değiştirmez. Eski `pm2 restart calendar-api`
> talimatı da geçersiz — host'ta PM2 yok.

Manuel müdahale gerekirse (env değişti, container yeniden yaratılacak vb.):
`docker compose pull && up -d --force-recreate calendar-api` + `docker logs calendar-api`.

**Supabase:** SQL editor veya MCP (`mcp__supabase__apply_migration`)

> **Tam komutlar, SSH erişimi ve sık operasyonlar → `INFRASTRUCTURE.md`.**
> O dosya `.gitignore`'da (bu depo **public**) — erişim detayları kasten dışarıda tutuluyor.
> Bu dosyaya SSH komutu, anahtar veya host yolu **yazma.**

---

## 🤖 Ajanlar ve /konsey (2026-08-05'te kuruldu)

`.claude/agents/` altında 6 uzman ajan var. Kendin araştırmaya başlamadan önce **doğru
ajana sor** — hepsi kendi alanının belgelerini zaten biliyor.

| Ajan | Ne için | Kod yazar mı |
|---|---|---|
| `builder` | ★ Orkestra şefi. İşi parçalar, `agy` (Antigravity/Gemini) worker'larına dağıtır, dönen kodu doğrulatır. Çok adımlı feature/refactor/toplu düzeltme | ✅ |
| `gkv-302` | §302 SGB V, EDIFACT/DTA, Kostenträger/IK, Heilmittel-Richtlinie, Diagnosegruppen, Korrekturverfahren. **"Para gelir mi?"** | ❌ |
| `legal-de` | DSGVO/BDSG, §203 StGB, MDR, EU AI Act, AGB/Impressum/UWG. Startup bütçesine kalibreli. **"Başımız derde girer mi?"** | ❌ |
| `podoloji` | Podolog'un gerçek iş günü, Fußbefund/Wagner-Armstrong, HPNR 78xxx, tık-ekonomisi | ❌ |
| `muhalif` | Yapıcı muhalif — fikir nerede kırılır, gizli maliyet ne. Alternatifsiz itiraz yasak | ❌ |
| `deger-mi` | Efor/değer, fırsat maliyeti, daha küçük sürüm yeterli mi | ❌ |

**`/konsey`** — karar **öncesi** danışma kurulu. "Şunu şöyle mi yapsam böyle mi" tipi
sorularda ilgili ajanları paralel toplar, tek uygulanabilir KARAR üretir; `builder` uygular.
Olgusal sorular ve onay arayışı için kullanılmaz. Kararlar: `konsey/KARARLAR.md`
(**kapanmış karar yeniden açılmaz**).

`legal-de` ve `gkv-302`'nin ⛔'ü **sert vetodur** — aşılmaz, etrafından dolaşılır.

---

## 📚 İlgili Dosyalar

- **`TODO.md`** — ★ **PROJEDEKİ TEK YAPILACAKLAR LİSTESİ.** Acil işler + haftalık beta planı
  (T1–T6) + launch checklist + açık teknik işler. Başka yerde TODO tutma.
- `INFRASTRUCTURE.md` — SSH/VPS erişimi, deploy pipeline, sık operasyonlar
- `ONPREM_MIGRATION_PLAYBOOK.md` — ★ on-premise geçiş rehberi; "bu dosyayı uygula" tetikleyici.
  Arka plan: `ON_PREMISE_ANALYSE.md`
- `Handbücher/INDEX.md` — 33 GKV/§302 belgesinin haritası + okuma protokolü
- `Handbücher/SPEC-RULES.md` — süzülmüş §302 kuralları (kaynak + sürüm + kod satırı)
- `konsey/KARARLAR.md` — konsey kararlarının dizini
- `compliance/LEGAL_DECISIONS.md` — kapatılmış hukuki kararlar
- `Podoloji/PRODUKT-ENTSCHEIDUNGEN.md` — podoloji ürün kararları
- `STRIPE_SETUP.md` — env var adları (⚠️ Test Mode döneminde yazıldı)

### 🗄️ Arşiv (2026-08-05)
39 eskimiş rapor/plan `archive/` altına taşındı — **silinmedi.** Neden eskidikleri ve içlerinden
neyin kurtarıldığı `archive/README.md`'de. Oradaki audit bulguları **iddiadır**, aksiyon almadan
önce koda/DB'ye karşı doğrula (2026-08-05'te iki güvenlik iddiası doğrulandı ve çürüdü).

---

*Son güncelleme: 2026-08-05 | Status: Beta, ilk müşteriler test ediyor 🟡*
