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
│   ├── server.js                  43 doğrudan route + 32 alt-router = 75 (aşağıya bak)
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
├── db/                            ★ Şema + tablo kaydı — SQL yazmadan ÖNCE oku
│   ├── README.md                  Yönelim + 7 tuzak + tazeleme kuralı
│   ├── SCHEMA.sql                 81 tablo · 1188 kolon, constraint'ler, view'lar
│   ├── SCHEMA-RLS.sql             156 RLS policy · 54 fonksiyon · 60 trigger · 289 index
│   │                              (rakamlar dökümün kendi başlığından — orası kaynaktır)
│   ├── REGISTER.md                ★ NİYE açıldı — 80/80 tablo, elle bakımlı (db-ustasi)
│   └── NUTZUNG.json/.md           KİM okuyor/yazıyor — üretilir (tools/tabellenkarte.mjs)
│
├── module/                        ★ YENİ FRONTEND KODUNUN YERİ (Konsey 2026-08-13)
│                                  59 dosya · `dashboard.js` büyümesin diye burası var.
│                                  `*.test.js` → `npm test` (node --test, 158 test)
│
├── vendor/ + tools/vendor/        ★ CANLI: yerelleştirilmiş supabase-js · node-forge ·
│                                  fullcalendar · cropperjs. CDN'e geri dönmek YASAK
│                                  (Konsey 2026-08-13 S3). Üretim + airgap testi:
│                                  vendor/README.md
├── tools/                         Kapılar ve üreticiler: check-dashboard-size.sh ·
│                                  check-namen.sh · check-tabellen-register.sh ·
│                                  funktionskarte.mjs · tabellenkarte.mjs · plz-orte.mjs
├── .githooks/pre-commit           Üç kapıyı da çalıştırır (kurulum: bkz. Kurallar)
│
├── db/                            ★ Şema + tablo kaydı — SQL yazmadan ÖNCE oku
│   ├── README.md                  Yönelim + 7 tuzak + tazeleme kuralı
│   ├── SCHEMA.sql                 81 tablo · 1188 kolon, constraint'ler, view'lar
│   ├── SCHEMA-RLS.sql             156 RLS policy · 54 fonksiyon · 60 trigger · 289 index
│   │                              (rakamlar dökümün kendi başlığından — orası kaynaktır)
│   ├── REGISTER.md                ★ NİYE açıldı — 80/80 tablo, elle bakımlı (db-ustasi)
│   └── NUTZUNG.json/.md           KİM okuyor/yazıyor — üretilir (tools/tabellenkarte.mjs)
├── funktionen/                    Fonksiyon haritası (üretilir) — INDEX.json + INDEX.md
├── fortschritte/                  Günlük ilerleme kaydı — bir gün = bir dosya
├── konsey/                        Konsey tutanakları + KARARLAR.md
├── compliance/                    DSGVO: VVT · TOM · DSFA · LEGAL_DECISIONS.md
├── guvenlik/                      ⛔ GITIGNORE — güvenlik sicili (açık zafiyet + angriffsweg).
│                                  Public repoya ÇIKMAZ, aktarım Google Drive üzerinden
├── blog/                          ★ CANLI 17 SEO makalesi — sitemap'te 18 giriş,
│                                  index.html nav "Insights".
│                                  ⚠️ blog/component-lab.html hariç: ölü, noindex,
│                                  başlığı hâlâ "InfinityMade". Kökteki komponenten.html
│                                  ile KARIŞTIRMA — o ayrı ve canlı bakımlı
├── ops/                           Ops-Dashboard kodu — ★ AYRI Vercel projesi,
│                                  ★ AYRI Supabase projesi (farkaejociddtgqkusvm)
│
│   ── Belge arşivleri: kodda sadece KAYNAK olarak alıntılanır, runtime'da YÜKLENMEZ ──
├── Handbücher/                    GKV/§302 belge arşivi — INDEX.md protokolü zorunlu
├── Podoloji/                      Podoloji alan belgeleri + HPNR referansı + FAK
├── verordnung rezept/             HeilM-RL · ICD-10-GM katalog dosyaları · Blanko
├── .claude/agents/ + skills/      ★ Ajanlar ve /konsey (aşağıya bak) — .gitignore'lu
├── praxissoftware-*.html          SEO landing sayfaları (4 Fachbereich + TI)
├── komponenten.html               Elle bakımlı bileşen envanteri (dark dev sayfası).
│                                  ⚠️ Elle yazıldığı için DRIFT EDER — iddialarını koda
│                                  karşı doğrula, kaynak funktionen/INDEX.json
└── archive/                       39 eskimiş rapor — güncel bilgi için BAKMA
```

### 🗺️ Haritasız değil, sınıflandırılmış: geri kalan klasörler (2026-08-27)

Aşağıdakiler **koda bağlı değildir** — hiçbiri runtime'da yüklenmez, hiçbiri yayına
gitmez (`.vercelignore`). Kod ararken buralara bakma; ne oldukları burada yazılı ki
bir daha "bu klasör neydi" diye açılmasın.

| Klasör / dosya | Ne | Durum |
|---|---|---|
| `ui-audit/` (235) · `mobile-audit/` (56) | Responsive/mobil denetim kanıt görselleri. `ui_audit_shots.py` · `capture_mobile*.py` üretir | REFERANS — yeniden üretilebilir. `mobile-audit/` ayrıca `mobil-ui` ajanının **protokol gereği** before/after klasörü |
| `funktionen-shots/raw/` (31) | `assets/img/fn/`'in ham PNG kaynağı (1:1 eşleşir). ⚠️ PNG→WebP adımı hiçbir script'te belgeli değil | REFERANS |
| `competitor-research/` (118) | Optica ekran arşivi — `archive/competitor-research-optica/` metinlerinin görsel eki | REFERANS — **TAŞIMA**, 40+ link kırılır |
| `onprem/` | (a) `supabase-docker/` = **upstream vendor kopyası**, bizim kodumuz değil (b) `schema/` = 2026-07-06 pg_dump (c) `poc-frontend-server.mjs` = Faz 0 | REFERANS — playbook Faz 2 girdisi. ⚠️ **Şema gerçeği `db/` altındadır**; `onprem/schema` Temmuz'da dondu (70 tablo) |
| kök `database_v*.sql` (39) | Tarihsel migration arşivi | ⚠️ **OTORİTE DEĞİL** — numaralar çakışıyor (v28/v29/v31 ikişer kez, v13/v14 yok), DB'de 195 migration kayıtlı. Gerçek: `db/SCHEMA.sql` |
| `supabase/migrations/` (10) | Repo'daki migration dosyaları | Kaynak DEĞİL (DB'de 195). Bkz. üstteki satır |
| `sql-melih/` | Melih'e SQL teslim kanalı — `SUPABASE-JETZT-AUSFUEHREN.sql` **uygulandı** (kolonlar `db/SCHEMA.sql`'de) | ARŞİVLİK, iş kapandı |
| `assets/` · `fonts/` · `images/` | ★ **CANLI.** `assets/img/fn/` = Funktionen-walkthrough (`index.html:1485`), `img/foot/` = podoloji ayak haritası; `fonts/` = self-hosted Inter/Outfit (Google-Fonts-CDN sorununun **cevabı**, CDN'e dönme); `images/` sadece `kemal-demir-v4.png` | CANLI |
| `Logo/` · `web foto/` · `app ss/` · `demo rezept/` · `voice demo/` · `pakete/` · `demo slayt/` · `cache/` | Marka kaynakları + medya/demo kalıntısı. `cache/projects.json` bir aracın yerel cache'i, kazara girmiş | ARŞİVLİK — sıfır kod referansı |
| `.planning/` · `.plans/` | İki **farklı** sistem: `.planning/` = GSD `pause-work` handoff'u (2026-05-19, sprint-6 kapandı) · `.plans/` = 4 eski plan | ARŞİVLİK — açık iş **Ops-Dashboard'a** yazılır |
| ~~kök `lib/`~~ | ✅ **ÇÖZÜLDÜ 28.08.2026** — `archive/lib-orphan/`'a taşındı. Hiçbir yerden import edilmiyordu (`admin.js` dahil kontrol edildi). Gerekçe ve içinden ne kurtarılabileceği: `archive/README.md` | **`api-backend/lib/` ile KARIŞTIRMA** — o canlı ve dokunulmadı |
| `ai chatbot proje/` | Terk edilmiş "Chatbot Widget Builder" (92 KB tek dosya). Belgeleri `archive/ai-chatbot-proje/`'ye taşındı, **kodu kökte kaldı** | ARŞİVLİK — taşıma yarım |
| kök `*.py` (25) | `qa_crawl_*.py` = prod QA (`app.praxura.de`, çalışır) · `capture_funktionen/flows.py` = `funktionen-shots` üretimi (korumalı, bkz. isim kuralı) · `qa_visual_verify*` / `qa_demo_prep` = **KIRIK** (ölü `app.infinitymade.de` hedefi) · `scratch_*` / `ui_*` / `test_runner` = atık · `write_icd.py` = **0 bayt** | Karışık — bu ayrım geçerli |
| kök `*.md` raporları | **GÜNCEL:** `ONPREM_MIGRATION_PLAYBOOK` · `TYPECHECK` · `REBRANDING_GUARDRAILS` · `ARBEITSZEITEN_PRO_STANDORT` (uygulanmamış açık plan) · `LEGAL_ONPREM_REQUIREMENTS` · `UMAMI_SETUP` (⚠️ 29.08.2026 düzeltildi — burada "hiç kurulmadı" yazıyordu, **yanlıştı**: Umami kurulu ve çalışıyor. `cookie-consent.js` → `injectUmami()`, `analytics.infinitymade.de` HTTP 200, 19 blog sayfasının 18'inde (tek istisna ölü `component-lab.html`) + 10 pazarlama sayfasında, `datenschutz.html:121'de ilan edilmiş. ⚠️ `datenschutz.html:146` "onay gerekmez" diyor ama kod yalnız onaydan sonra yüklüyor — Mayıs metni, Haziran kararı; hukuk metni geride kalmış). **ARŞİVLİK:** `SEO_AKTIONSPLAN` · `KONTRAST_AUDIT` · `DUPLICATION_AUDIT` · `ITSG_EMAIL_DRAFT` · `PODOLOGIE_ORCHESTRATOR_PROMPT` · `STRIPE_SETUP` (yalnız env var **adları** geçerli) | — |

> **Yayın yüzeyi kuralı (2026-08-27):** `.vercelignore` artık **klasör bazlı** tutulur,
> yalnızca dosya uzantısı bazlı değil. 2026-06-03 denetimi uzantıları kapatmıştı; sonradan
> eklenen her klasör aynı delikten geçip `praxura.de` üzerinde HTTP 200 döndü —
> `ui-audit/`, `onprem/supabase-docker/docker-compose.yml`, `funktionen/INDEX.json`
> (990 KB, uygulamanın tam fonksiyon haritası), `tools/.namen-hashes`, `dashboard.js.bak`.
> **Yeni klasör eklerken:** yayına girmesi gerekiyor mu? Gerekmiyorsa aynı commit'te
> `.vercelignore`'a yazılır. Ölçüt **runtime**'dır — yorumdaki kaynak atfı sayılmaz.

---

## 🏗️ Mimari

### 3 ana sistem birbirine bağlı:

**1. Web (Vercel)** → `praxura.de` + `app.praxura.de`
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

**Base:** `https://n8n.infinitymade.de/api` · **75 route** — `server.js`'te 43 doğrudan,
`billing/api/*` + `ai/router.js` alt-router'larında 32. Aile aile:

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
(Diğer açık işlerin tamamı → Ops-Dashboard, kategori **Teknik**)

---

## 💳 Stripe (LIVE — 2026-06-11'den beri gerçek ödeme alınıyor)

- **Plans (2026-08-05 canlı `index.html`'den doğrulandı — TEK GEÇERLİ SET):**
  Starter **29 €**/ay (25 € yıllık) · Professional **49 €**/ay (42 €) · Klinik **99 €**/ay (84 €) · Enterprise bireysel.
  ⚠️ Eski pazarlama/plan dosyalarında dolaşan 39/59 ve 89/149/219 setleri **geçersizdir.**
- **Trial:** 14 gün · **Customer Portal:** aktif · **Checkout domain:** `pay.praxura.de`
- **Enterprise price ID hâlâ YOK** — `pricing.js`/`stripe-live-setup.cjs`'te geçmiyor (Ops-Dashboard → **Launch**)
- **Webhook:** `https://app.praxura.de/api/stripe/webhook` — ✅ 2026-08-05'te panelden
  doğrulandı. Kodun fallback'i de aynı (`create-checkout-session.js:10`,
  `portal-session.js:8`), yani `NEXT_PUBLIC_URL` boş olsa bile doğru domain'e gider.
  ⚠️ Ama env **yanlış** bir değere set edilmişse fallback devreye girmez — Vercel'de
  `NEXT_PUBLIC_URL` varsa `https://app.praxura.de` olmalı.

`STRIPE_SETUP.md` — env var **adları** geçerli, ama dosya Test Mode döneminde yazıldı.
LIVE ürün/fiyat scripti: **`stripe-live-setup.cjs`** — `.cjs` uzantısı şart.
⚠️ Yanındaki `stripe-live-setup.js` **çalışmaz**: `package.json`'da `"type": "module"` var,
dosya ise `require()` kullanıyor → `ReferenceError: require is not defined in ES module scope`.
İki dosya tek kelime farkla aynı (hata mesajı DE/TR). Silme kararı kullanıcının.

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
- `NEXT_PUBLIC_URL` — ⚠️ praxura.de olmalı, doğrulanmadı (Ops-Dashboard → **Launch**)

**VPS (`/opt/calendar-api/.env.calendar`):**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URL`
- `N8N_WEBHOOK_URL`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`

> ⚠️ **Doğru anahtar adı `SUPABASE_SERVICE_ROLE_KEY`.** `SUPABASE_SERVICE_KEY` yazmak
> prod'da crash-loop yaratmıştı — Watchtower bozuk image'ı 60 saniyede canlıya alır.

---

## 📐 Kurallar

### 🗄️ Şema dökümü protokolü (2026-08-10)

**SQL yazmadan / tablo-kolon varsayımı yapmadan önce `db/README.md` okunur.**
Orada 6 tuzak yazılı (en önemlisi: hasta tablosu `patients` değil **`leads`**).

- **Her şema değişikliğinden sonra döküm aynı commit'te tazelenir.**
  `mcp__supabase__apply_migration` çalıştırdıysan, iş bitmedi — `db/SCHEMA.sql` ve
  `db/SCHEMA-RLS.sql` yeniden üretilir, iki dosyanın başındaki tarih + son migration
  satırı güncellenir. Tetikleyici cümle: **"şema güncelle"**.
- **Eski döküm hiç dökümden kötüdür** — okuyan ona inanır. Bu yüzden tazeleme
  ertelenmez, "sonra yaparım" denmez.
- `supabase/migrations/` **kaynak değildir**: repoda 10 dosya var, DB'de 195 migration
  kayıtlı. Şema gerçeği `db/` altındadır.
- Döküm **sadece yapı** içerir, tek satır veri yok — depo public.
- Melih'in (ve DB'yi göremeyen her aracın) tek bağlamı bu dosyalar.
  Onun ürettiği SQL bize gelir, MCP ile burada uygulanır, sonra döküm tazelenir.

### 🗄️ Tablo kaydı protokolü (2026-08-29)

**"Bu tablo ne işe yarıyor / silsek mi" sorusu tahminle değil `db/REGISTER.md` okunarak
cevaplanır.** Şema neyin *olduğunu* söyler, **niye açıldığını söylemez** — ve yazılmayan
niyet altı ayda kaybolur. Kaybolduğu anda her tablo "belki lazımdır" diye durur.

Üç dosya, üç ayrı soru — karıştırma:

| Dosya | Soru | Nasıl bakımı yapılır |
|---|---|---|
| `db/SCHEMA.sql` + `SCHEMA-RLS.sql` | **Ne** var (kolon, policy) | MCP ile üretilir — "şema güncelle" |
| `db/REGISTER.md` | **Niye** açıldı, ne zaman, hâlâ gerekli mi | **elle** — "tablo kaydı güncelle" |
| `db/NUTZUNG.json` + `.md` | **Kim** okuyor/yazıyor, hangi ekran | `node tools/tabellenkarte.mjs` — "tablo haritası güncelle" |

- **Yeni tablo açıldığında kaydı aynı commit'e yazılır.** Kapı var: `db/SCHEMA.sql` staged ise
  pre-commit `tools/check-tabellen-register.sh` çalışır ve kayıtsız tabloda commit'i reddeder
  (atlamak: `SKIP_REGISTER_GATE=1`).
- Yeni tablo/kolon yazmadan önce **`db-ustasi`** ajanına sorulur: kolon eklemek yetiyor mu,
  bu kavramın ikinci hâli zaten var mı. `fonksiyon-ustasi` fonksiyon tarafında neyse, bu veri
  tarafında odur — **aynı ayrıcalıkla, izin sormadan çağrılır.**
- **"Bu tablo kullanılmıyor" hükmü DÖRT kaynak birden boş çıkmadan verilmez:** kod
  taraması (`codeStumm`) + ham grep + `SCHEMA-RLS.sql` (trigger/policy/RPC) + `api/dsgvo.js`.
  Kanıtlanmış tuzaklar: `nummernkreise` yalnız trigger'dan beslenir · `icd10_titles`
  yalnız `search_diagnosen()` RPC'sinden okunur · `demo_bookings` `.from()` değil PostgREST
  yolu kullanır · `heilmittel_position` aynı zamanda bir **kolon** adıdır (ham grep onu
  canlı sanır) · `"fußstatus"` ASCII değildir.
- **Yeni tablo kişisel veri taşıyorsa `api/dsgvo.js`'e de yazılır** (Auskunft + doğru sırada
  Löschung). Bu adım 2026-08-28'de atlandı ve Auskunft eksik döndü; `tabellenkarte.mjs`
  artık boşluğu raporluyor.

### 🗺️ Fonksiyon haritası protokolü (2026-08-12)

**"Böyle bir fonksiyon var mı" sorusu okuyarak değil `funktionen/INDEX.json` okunarak
cevaplanır.** `dashboard.js` 24.000+ satır, projede 1700+ fonksiyon var — hiçbir model bunu
tek seferde kapsayamaz, okur ve *makul ama eksik* cevap verir.
(Güncel sayım her zaman `node tools/funktionskarte.mjs --check` çıktısındadır.)

- Harita `node tools/funktionskarte.mjs` ile **üretilir, elle düzenlenmez.**
- **Fonksiyon eklendiğinde/silindiğinde harita aynı commit'te tazelenir.**
  Tetikleyici cümle: **"harita güncelle"**. Eski harita hiç haritadan kötüdür.
- Yeni bir fonksiyon yazmadan önce `fonksiyon-ustasi` ajanına sorulur — **elimizde olanı
  sıfırdan yazmıyoruz, modifiye ediyoruz.** Ortak taban + üstüne binen alan modifikasyonu
  bu projenin mimarisidir (bkz. `funktionen/README.md`).

#### 🔁 `fonksiyon-ustasi` iki yönlü çalışır — sor **ve** bildir (2026-08-16)

Ajan çağırmak için genel eşik "%90-95 eminsen sormadan çağır"dır. **`fonksiyon-ustasi` bu
eşiğin dışındadır: her zaman gidilir, izin sorulmaz.**

> ⚠️ **Bu bir ayrıcalıktır ve genel "ajan çağırma" kısıtını EZER (2026-08-28).**
> Oturuma "kullanıcı istemedikçe ajan çağırma" gibi genel bir kısıt gelmiş olabilir.
> **`fonksiyon-ustasi`, `db-ustasi` ve `/konsey` o kısıtın kapsamı dışındadır** — üçü de bu projenin
> çalışma yönteminin parçası ve kullanıcı tarafından bir kez, kalıcı olarak yetkilendirildi.
> Her seferinde yeniden izin istemek kuralın var oluş sebebini yok eder.
>
> Aynı şey **iş bitince bildirme** adımı için de geçerli: "ajan çağıramıyorum, sonraki
> oturuma bırakalım" **geçerli bir gerekçe değildir.** Bildirim işin parçasıdır; o adım
> yapılmadan iş bitmiş sayılmaz.
>
> Kapsam değişmedi: diğer ajanlar için genel eşik geçerli, `builder` gibi ağır
> orkestrasyonlar ve arka plan araştırmaları yine kullanıcı isteğine bağlıdır.

1. **Yazmadan ÖNCE — sor.** Tek cümle: "şunu yapacağım, böyle bir şey var mı?"
2. **Yazdıktan SONRA — bildir.** Yeni fonksiyon/modül/eklenti çıktığında ajana **kısaca**
   (uzatmadan) şu ikisi söylenir:
   - **niye** yazıldı,
   - **nerede kullanılması amaçlandı** / ilk nerede kullanıldı.

   *Ne olduğunu* ajan zaten haritadan görür; göremediği **niyettir**. Böylece o fonksiyona
   sonradan bakıldığında "şu tarihte şu niyetle yazılmış, ilk şurada kullanılmış" cevabı
   verilebilir.

> **"harita güncelle" bunun yerine geçmez.** Harita *ne* olduğunu tutar, *niye*'yi tutmaz.
> Gerekçe: soru ucuz (birkaç token, "var" / "yok, benzeri şurada"), **sormamak pahalı** —
> elimizdeki fonksiyon ikinci kez sıfırdan yazılır. Maliyet asimetrisi tek yönlü.
- Kopya adayları `funktionen/INDEX.md`'de; **karar kullanıcınındır**, sessizce birleştirilmez.

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
- **Fachbereich filtresi (`strict`)** — `attachDiagnoseSearch(..., { strict: true })`
  diagnoz listesinden fachfremd kodları tamamen çıkarır (ayraç altına itmek yerine).
  Bugün sadece podolojide (`podNewIcd10`) açık. **Her alan için düşünülmüştür**;
  `icd_sector_ranges` dördü için de dolu, sırası gelen alanın alan tanımına
  `strict: true` eklenir — modülde yapılacak iş yok
- Örnek: Ergotherapie Blankoverordnung sözleşmesi 01.04.2024'ten beri yürürlükte ve kodumuz
  onu blokluyor. Gelir etkisi var ama **bilinçli olarak beklemede** (Ops-Dashboard → **Teknik**)

### Frontend

#### 🚧 Yeni kod yeni dosyaya — `dashboard.js` BÜYÜMEZ (Konsey 2026-08-13)

**`dashboard.js` bugün 24.120 satır. Bir satır daha büyümeyecek.** Yeni bir modül/ekran/akış
yazılacaksa `module/<alan>.js` olarak **ayrı dosya** açılır ve `dashboard.js`'e tek `import`
satırıyla bağlanır. Altyapı zaten var ve çalışıyor — `dashboard.js:1-8`'de 8 örnek
(`katalog-suche`, `patient-suche`, `calendar-widget`, `nav-registry`, `icd-dg-match`, `arzt-suche`).

- Bu bir tavsiye değil **kapı**: pre-commit hook `dashboard.js` satır sayısı artarsa commit'i
  reddeder (`tools/check-dashboard-size.sh`, taban `tools/.dashboard-baseline`).
  **Kurulum — her geliştirici bir kez:** `git config core.hooksPath .githooks`
  (dosya küçülürse taban otomatik sıkışır, kazanım geri alınamaz.)
- Mevcut bir fonksiyonu düzeltmek serbest — dosyayı **büyütmemek** şartıyla.
- Eski kod yeniden yazılmaz; **kuşatma** yöntemiyle dokunuldukça ayrı modüle göç eder.
  Göç tek yönlüdür: modülden `dashboard.js`'e geri taşıma yasak.
- ✅ İlk kuşatma hedefi **podoloji kümesi** tamamlandı (27.08.2026): 1.315 satır
  `module/podologie-abrechnung.js` + `module/diagnosegruppen-regeln.js`'e taşındı,
  `dashboard.js` 26.857 → 24.120 satıra indi. Sıradaki kuşatma hedefi seçilmedi.

> Gerekçe ve ölçüm: `konsey/tutanak/2026-08-13-frontend-mimari-katman.md`.
> Kararın özeti: React'a geçilmeyecek, 27k satır yeniden yazılmayacak; eksik katmanlar
> (olay/sinyal, tip kontrolü, veri katmanı) vanilla kalınarak eklenir.

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

### 🕶️ Kişi adı yazma — depo PUBLIC (Konsey 2026-08-27)

**Beta müşterisinin adı depoya yazılmaz.** Ne kod yorumuna, ne `fortschritte/`'ye, ne
commit mesajına. Yerine rumuz:

| Rumuz | Kim |
|---|---|
| `Beta-1` | Podologe — 08.08.2026 görüşmeleri |
| `Beta-2` | 12.08.2026 görüşmeleri |

**Alıntı ve tarih AYNEN kalır** — kararın gerekçesini onlar taşır, kopması gereken tek
şey kimlik:

```js
✗  // <Kundenname>, 12.08.2026: „wir sind die meiste Zeit dort"
✓  // Beta-2, 12.08.2026: „wir sind die meiste Zeit dort"
```

- Rumuz→kişi eşlemesi **yalnızca depo dışında**: `I:\My Drive\Ops Praxura gitnogo\meetings\`
  ve `ops_meetings` kaydı. Tarih + rumuz ikilisi oradan kişiye tek adımda gider.
- Kapı: `tools/check-namen.sh` (pre-commit). Yasak isimler **hash olarak** tutulur
  (`tools/.namen-hashes`) — düz metin liste, kapatmaya çalıştığımız sızıntının aynısı olurdu.
- İstisna: `SKIP_NAME_GATE=1 git commit …`
- ⚠️ `Beta-1`/`Beta-2` seçildi çünkü **`B1`/`B2` GKV Schlüsselwert'i** (`Anlage_3_TP5_V21`:
  "B1 = Leistungserbringer von Modellvorhaben", "B2 = Genehmigung gem. § 8 Abs. 3").
  §302 kod tabanında karışırdı.
- Kurucular (`Kemal`, `Melih`) bu kapsamda **değil** — kendi projeleri.
- Demo verisindeki uydurma adlar da kapsam dışı: `Stefan Wolff` (demo hastası,
  `demo-dashboard.html` + `capture_flows.py`), `Dr. med. Stefan Hoffmann`
  (`VIDEO_DEMO_DATEN.md`). Bunlara **dokunma** — `capture_flows.py` aynı dizgiye bağlı.

Gerekçe: `konsey/tutanak/2026-08-27-klarnamen-public-repo.md` ·
hukuki kayıt: `compliance/LEGAL_DECISIONS.md`

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
| `db-ustasi` | ★ Veritabanının kurumsal hafızası. Hangi tablo niye/ne zaman açıldı, kim yazıyor, hâlâ gerekli mi. MCP ile canlı DB'ye bağlı. Şema/SQL işinden ÖNCE sor | ✅ (yalnız migration) |
| `gkv-302` | §302 SGB V, EDIFACT/DTA, Kostenträger/IK, Heilmittel-Richtlinie, Diagnosegruppen, Korrekturverfahren. **"Para gelir mi?"** | ❌ |
| `legal-de` | DSGVO/BDSG, §203 StGB, MDR, EU AI Act, AGB/Impressum/UWG. Startup bütçesine kalibreli. **"Başımız derde girer mi?"** | ❌ |
| `guvenlik` | ★ Güvenlik sorumlusu + kurumsal güvenlik hafızası. Sızıntı, mandant sınırı, açık yüzey. Sicili `guvenlik/REGISTER.md` tutar — neyin ÇÜRÜTÜLDÜĞÜNÜ de bilir. Konseyin daimi üyesi, dört konuda sert veto | ❌ |
| `podoloji` | Podolog'un gerçek iş günü, Fußbefund/Wagner-Armstrong, HPNR 78xxx, tık-ekonomisi | ❌ |
| `mobil-ui` | Küçük ekran: üst üste binme, yatay taşma, dokunma hedefi, breakpoint çakışması. Playwright ile **ölçer**, sonra sadece CSS'te düzeltir | ✅ (yalnız CSS) |
| `muhalif` | Yapıcı muhalif — fikir nerede kırılır, gizli maliyet ne. Alternatifsiz itiraz yasak | ❌ |
| `todo-maker` | Ham girdiyi (toplantı dökümü, transkript, hata raporu) zengin pano kartlarına çevirir — hangi ekran, hangi dosya, kim istedi, bitti sayılır ölçütü, gerekirse kopyala-yapıştır Fix-Prompt | ❌ (JSON üretir) |
| `deger-mi` | Efor/değer, fırsat maliyeti, daha küçük sürüm yeterli mi | ❌ |

**`/konsey`** — karar **öncesi** danışma kurulu. "Şunu şöyle mi yapsam böyle mi" tipi
sorularda ilgili ajanları paralel toplar, tek uygulanabilir KARAR üretir; `builder` uygular.
Olgusal sorular ve onay arayışı için kullanılmaz. Kararlar: `konsey/KARARLAR.md`
(**kapanmış karar yeniden açılmaz**).

`legal-de` ve `gkv-302`'nin ⛔'ü **sert vetodur** — aşılmaz, etrafından dolaşılır.

`guvenlik` konseyin **daimi üyesidir** — güvenlik sonucu olabilecek her kararda masadadır,
ayrıca çağrılması gerekmez. Sert vetosu yalnız **dört** konuyla sınırlıdır: sırrı yayına
çıkaran karar · mandant sınırını gevşeten karar · var olan bir güvenlik kontrolünü
(GoBD kilidi, `patient_consents` RESTRICT, rate limit, PHI şifrelemesi) kaldıran karar ·
PHI'yi yeni bir yere taşıyan karar. Dışında görüş bildirir, veto etmez — her riski vetolayan
güvenlik sorumlusu dinlenmeyen güvenlik sorumlusudur.

---

## 📚 İlgili Dosyalar

- **Ops-Dashboard** — ★ **AÇIK İŞLERİN TEK YERİ:** https://ops.infinitymade.de → Aufgaben.
  Kemal + Melih ortak panosu; kategoriler **Ortaklık · Launch · Güvenlik · Teknik · Podoloji ·
  Fikir**. 2026-08-08'de `TODO.md`'deki 54 açık madde buraya taşındı. **Yeni iş çıkarsa
  buraya yazılır.** Kod `ops/`, kurulum `ops/SETUP.md`, yazma kanalı `ops/tools/ingest.mjs`.
  ⚠️ **Ayrı Supabase projesi** (`farkaejociddtgqkusvm`) — Supabase MCP aracı ÜRÜN projesine
  bağlıdır, ops tarafına MCP ile SQL çalıştırma.
- **`fortschritte/`** — günlük ilerleme kaydı. **Kural: bir gün = bir dosya**
  (`fortschritte/JJJJ-MM-TT.md`). Aynı güne ait yeni iş, o günün dosyasına
  **eklenir**; ikinci dosya açılmaz. Tam kural ve dosya şablonu:
  `fortschritte/REGELN.md`. Açık işler yine Ops-Dashboard'a yazılır — burası
  sadece "o gün ne oldu ve neden" sorusunu yanıtlar.
- **`TODO.md`** — artık yapılacaklar listesi **değil.** Sadece iki şey kaldı: §1 haftalık beta
  roadmap (T1–T6 plan metni, katman zinciri, DoD) ve §5 kapanmış maddelerin kaydı.
- **Paylaşılan belge klasörü** — `I:\My Drive\Ops Praxura gitnogo\` (Google Drive, 2026-08-08).
  Depoya girmeyen ama Melih'in de görmesi gereken belgeler burada:
  `vertraege/` (imzalı sözleşmeler + üretim script'i) · `meetings/` (toplantı dökümleri,
  beta müşteri ismi içerir) · `partnerschaft/` (`PARTNERSHIP_NOTES.md`) ·
  `infra/` (`INFRASTRUCTURE.md`) · `finanzen/`.
  ⛔ **Kod ve `.git` buraya KONMAZ** — depo 1,1 GB, `.git` 352 MB; senkron istemcisi `.git`'i
  bozar ve iki kişi aynı anda çalışınca çakışan-kopya üretir. Kod GitHub'dan paylaşılır.
  ⛔ Sırlar (`.env`, SSH özel anahtarı, API key) buraya da girmez → parola kasası.
- `INFRASTRUCTURE.md` — SSH/VPS erişimi, deploy pipeline, sık operasyonlar.
  Depoda (gitignore'lu) **ve** paylaşılan klasörün `infra/` altında. Ön koşul olan koruyucu
  belgeler 2026-08-06'da imzalandı (Datengeheimnis · Nutzungsrechte · §203 kapsanıyor).
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

*Son güncelleme: 2026-08-27 | Status: Beta, ilk müşteriler test ediyor 🟡*
