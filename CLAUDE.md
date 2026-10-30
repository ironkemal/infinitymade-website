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
| **İşleten / sözleşme tarafı** (Impressum, sözleşmeler) | **Yavuz Kemal Demir** (Kleingewerbe, Siegburg NRW). "InfinityMade" yalnız adının yanında iş adı olarak yazılabilir ("Yavuz Kemal Demir – InfinityMade"), tek başına tüzel kişi gibi yazılmaz. `infinitymade.de` ayrı kurumsal repo |
| **Backend + n8n + analytics + status** | `n8n.infinitymade.de` (Hetzner) — **kasten taşınmadı** |

Yani `infinitymade.de` görmek her zaman "eskimiş" demek değildir: altyapı ve iş adı
hâlâ orada. Eskimiş olan, **ürünün** InfinityMade diye anılması.

**Status:** Beta 🟡 — beta test hesapları var, ödeme yapan canlı müşteri yok.
**Satış modeli:** tek ürün = kutu ("Praxura Lokal"); SaaS satılmaz, `app.praxura.de` depo
bölme günü kapanır (playbook **K1**, kurucu kararı 04.10.2026). Aşağıdaki Vercel/Stripe/
Supabase-cloud anlatımı **bugün çalışan** sistemi tarif eder, satılan ürünü değil.

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
AI:          Azure OpenAI — DOĞRUDAN, n8n aradan çıktı. Bütün görevler tek kapıdan geçer:
             api-backend/ai/ki-gateway.js (ayar: ki-config.js, taşıma: azureClient.js).
             b2c-draft → api-backend/ai/router.js. EU Data Boundary kontrolü kodda.
             ⚠️ Rezept OCR bugün KAPALI: `POST /rezept/upload` 503 `AI_OCR_DISABLED` döner
             (Rezept barkodu yerelde okunur). Kutuda AI: tek Praxura Azure + kısa ömürlü
             jeton (ki-jeton.js), `AI_MODE=aus|direkt|jeton`, kutuda varsayılan `aus`
             (playbook K4, 05.10.2026 K-20'de değişti). Jeton modu yazıldı ama AÇILMADI —
             onprem/REGISTER.md O-169
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
├── api/                           Vercel serverless — limitli, yeni uç AÇILMAZ (bkz. Kurallar)
│   ├── _lib/                      auth.js, stripe.js, pricing.js (fonksiyon SAYILMAZ)
│   ├── stripe/                    create-checkout-session, portal-session, webhook
│   ├── onboarding/                pending, check-email
│   ├── admin/                     data, feedbacks
│   └── config.js · contact.js · demo-booking.js · apify/search.js
│
├── api-backend/                   ★ VPS Express backend (Docker container)
│   ├── server.js                  doğrudan route + `billing/api/*`/`ai/router.js` alt-router'ları (aşağıya bak)
│   ├── instrument.js              Sentry init
│   ├── ai/                        router.js · ki-gateway.js · ki-config.js · ki-jeton.js ·
│   │                              azureClient.js · pii-mask.js · audit.js
│   │   ├── validators/            Rezept doğrulama (blankoRules, validate)
│   │   ├── catalogs/  tasks/
│   ├── billing/                   ★ §302 SGB V zinciri
│   │   ├── dta/                   EDIFACT üretimi (SLGA/SLLA/SLEZ/SLAU/SLEK)
│   │   ├── zaa/                   Kasa geri bildirim (Absetzung) parser
│   │   ├── kostentraeger/         IK / Kostenträgerdatei
│   │   ├── zuzahlung/ belegliste/ pdf/ codes/ utils/ api/
│   ├── lib/phi-encrypt.js         Hasta verisi şifreleme
│   ├── dsgvo/                     Auskunft/Löschung/kilit — klassifikation.js tek kaynak
│   ├── routes/                    dsgvo · mitarbeiter-zugang · status · ueber
│   ├── setup/                     ★ Kutu kurulum uçları (router.js, kapi.js) — SETUP_TOKEN kapısı
│   ├── merkez-istemci/            Kutunun merkez VPS'e konuşan tarafı
│   ├── db/migrations/             ★ Çalıştırılabilir şema zinciri (bkz. Kurallar)
│   ├── Dockerfile · docker-compose.yml
│
├── merkez/                        Merkez VPS servisi (ad, jeton, IP) — ayrı süreç, hasta verisi girmez
├── installieren/                  Kutu kurulum betikleri (install.sh · install.ps1)
├── onprem/                        Kutu paketi + sicil (REGISTER.md) — sahibi `onprem` ajanı
│
├── db/                            ★ Şema + tablo kaydı — SQL yazmadan ÖNCE oku
│   ├── README.md                  Yönelim + tuzaklar + tazeleme kuralı
│   ├── SCHEMA.sql + SCHEMA-RLS.sql  NE var — üretilir; sayılar dosyaların kendi başlığında
│   ├── REGISTER.md                ★ NİYE açıldı — her tablo, elle bakımlı (db-ustasi)
│   └── NUTZUNG.json/.md           KİM okuyor/yazıyor — üretilir (tools/tabellenkarte.mjs)
│
├── module/                        ★ YENİ FRONTEND KODUNUN YERİ (Konsey 2026-08-13) —
│                                  `dashboard.js` büyümesin diye. `*.test.js` → `npm test`
│
├── vendor/ + tools/vendor/        ★ CANLI: yerelleştirilmiş supabase-js · node-forge ·
│                                  fullcalendar · cropperjs. CDN'e geri dönmek YASAK
│                                  (Konsey 2026-08-13 S3). Üretim + airgap testi:
│                                  vendor/README.md
├── tools/                         Kapılar (`check-*.sh`) ve üreticiler: funktionskarte.mjs ·
│                                  tabellenkarte.mjs · schema-dokumente.mjs · plz-orte.mjs ·
│                                  onprem-manifest.mjs · browser-probe/ (`npm run probe`)
├── .githooks/pre-commit           Bütün kapıları çalıştırır — liste dosyanın kendisinde
│                                  (kurulum: bkz. Kurallar)
│
├── funktionen/                    Fonksiyon haritası (üretilir) — INDEX.json + INDEX.md
├── canli-test/                    ★ Ekran/akış sicili (elle) — REGISTER.md, bkz. Kurallar
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
│   ── Belge arşivi: kodda sadece KAYNAK olarak alıntılanır, runtime'da YÜKLENMEZ ──
├── wissensbank/                   ★ İNDİRİLEN RESMÎ BELGELERİN TEK ADRESİ (05.09.2026).
│                                  Eski `Handbücher/` ve `verordnung rezept/` buraya
│                                  taşındı ve kaldırıldı.
│   ├── README.md                  Klasör kuralı — yeni belge nereye gider
│   ├── REGISTER.md                ★ Herkunft · sürüm · geçerlilik · kaynak→kod→DB zinciri
│   ├── INDEX.md                   Belgenin İÇİNDE ne var + okuma protokolü
│   ├── SPEC-RULES.md              Süzülmüş §302 kuralları
│   ├── gemeinsam/                 Birden fazla alanı ilgilendiren: 302-tp5 · kostentraeger
│   │                              heilmittel-richtlinie · positionsnummern · icd-10-gm
│   ├── podologie/ physiotherapie/ ergotherapie/ logopaedie/    alana özel
│   ├── sitzungen/                 ⚠️ belge DEĞİL — kendi oturum notlarımız (tek istisna, README)
│   └── _archiv/                   düşmüş · kapsam dışı · mükerrer
├── Podoloji/                      ⚠️ Artık BELGE yok — yalnız kendi ürettiğimiz iş:
│                                  prototip, ürün kararı, loop promptu, HPNR referansı
├── Physio/                        Podoloji/ karşılığı (26.10.2026): ürün kararları +
│                                  PARTNER-FRAGEN.md (partnersiz girildi, sorular birikir)
├── .claude/agents/ + skills/konsey/  ★ Ajanlar ve /konsey (aşağıya bak) — git'te İZLENİR,
│                                  depo public: hassas satır yazma. `.claude/` geri kalanı ignore'lu
├── praxissoftware-*.html          SEO landing sayfaları (4 Fachbereich + TI)
├── komponenten.html               Elle bakımlı bileşen envanteri (dark dev sayfası).
│                                  ⚠️ Elle yazıldığı için DRIFT EDER — iddialarını koda
│                                  karşı doğrula, kaynak funktionen/INDEX.json
└── archive/                       Eskimiş rapor/kod/medya — güncel bilgi için BAKMA.
                                   Alt klasörler: kod/ · medya/ · rapor/ · denetim/ · recherche/
```

### 🗺️ Koda bağlı olmayan klasörler

Aşağıdakiler **runtime'da yüklenmez ve yayına gitmez** (`.vercelignore`). Kod ararken
buralara bakma.

| Klasör / dosya | Ne | Durum |
|---|---|---|
| `sql-melih/` | ⛔ **CANLI KANAL — ARŞİVLİK DEĞİL.** Melih'in SQL bıraktığı yer; `db/REGISTER.md` → `rechnung_zahlungen` kaynağı olarak gösteriyor. Burada bekleyen SQL = açık iş kuyruğu (09.09.2026: SQL beklerken backend deploy edildi, fatura akışı bloke oldu) | Melih ile koordine etmeden dokunma |
| `supabase/functions/` | ⛔ **CANLI** — Fahrtenbuch Edge Functions (`dashboard.js` → `invokeFahrtenbuchFn`). `supabase/migrations/` ise arşivde, kaynak değil | Karıştırma |
| `assets/` · `fonts/` · `images/` | ★ **CANLI.** `assets/img/fn/` = Funktionen-walkthrough, `assets/img/fn/_raw/` = ham PNG kaynağı, `img/foot/` = podoloji ayak haritası; `fonts/` = self-hosted Inter/Outfit | CANLI |
| `onprem/supabase-docker/` · `onprem/schema/` | upstream vendor kopyası · 2026-07-06 pg_dump (dondu). **Şema gerçeği `db/` + `api-backend/db/migrations/`** | REFERANS |
| `.planning/` · `.plans/` | GSD handoff'u (2026-05, kapandı) · 4 eski plan | ARŞİVLİK — açık iş Ops-Dashboard'a |
| kök `*.py` | `qa_credentials.py` = ortak import · `qa_crawl_*.py` = prod QA (`app.praxura.de`, çalışır) · `capture_flows.py`/`capture_funktionen.py` = `assets/img/fn/_raw/` üretimi (korumalı, bkz. isim kuralı) · `capture_mobile*.py` = `mobil-ui` protokolü · `ui_audit_shots.py`. ⚠️ `qa_visual_verify*` kırık (`app.infinitymade.de` hedefli) | Karışık |
| kök `*.md` | Yaşayan planlar kökte durur; kapananlar `archive/rapor/`. ⛔ **`PODOLOGIE_ORCHESTRATOR_PROMPT.md` kökte kalır, taşınmaz, dokunulmaz** — satır 333'te canlı bir hesap şifresi var, `guvenlik/REGISTER.md` → A-08 buna dokunulmamasını kayda geçmiş | — |

**Taşınmış yollar** (eski yolu arama): `ui-audit/` · `mobile-audit/` → `archive/denetim/` ·
`competitor-research/` → `archive/recherche/` · kök `database_v*.sql`, ölü `.py`/`.js` →
`archive/kod/` · `supabase/migrations/` → `archive/supabase-migrations-vor-baseline/` ·
`Logo/` `web foto/` `app ss/` `demo rezept/` `voice demo/` `demo slayt/` → `archive/medya/` ·
kök `lib/` → `archive/lib-orphan/` (⚠️ **`api-backend/lib/` ile KARIŞTIRMA** — o canlı).
Taşımaların gerekçesi: `archive/rapor/CLAUDE_MD_TARIHCE_2026-10-11.md`.

> **Yayın yüzeyi kuralı:** `.vercelignore` **klasör bazlı** tutulur. **Yeni klasör
> eklerken:** yayına girmesi gerekiyor mu? Gerekmiyorsa aynı commit'te `.vercelignore`'a
> yazılır. Ölçüt **runtime**'dır — yorumdaki kaynak atfı sayılmaz. (Bir kez
> `funktionen/INDEX.json` ve `tools/.namen-hashes` bu delikten `praxura.de`'de yayına çıktı.)

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
- `calendar-api` container'ı `node start.mjs` ile açılır (2 worker, `node:cluster`; pm2
  08.10.2026'da çıktı, O-179). Host'ta da container'da da PM2 **yok**.
- Traefik: `n8n.infinitymade.de/api/*` → calendar-api

> ⚠️ **"Calendar API" adı yanıltıcı — artık takvim servisi değil.** İsim eskiden kaldı;
> bugün içinde Rezept OCR, attendance, §302 billing, booking-request, hasta arama var.
> Backend'in tamamı odur.

**3. Supabase** → `njvuclullotbksskpwgk.supabase.co`
- Auth + PostgreSQL + Vault
- **Vault bugün TEK iş yapıyor:** onboarding'in geçici şifresini şifreli saklamak
  (`api/onboarding/pending.js`).

---

## 🔌 Backend API (`api-backend/server.js`)

**Base:** `https://n8n.infinitymade.de/api` — `server.js`'te doğrudan tanımlı route'lar;
geri kalanı `billing/api/*`, `ai/router.js`, `routes/*` (dsgvo · mitarbeiter-zugang ·
status · ueber) ve `setup/router.js` alt-router'larında. Sayı burada yazılmaz, kaynak kodun
kendisi (`grep -rnE "(app|router)\.(get|post|patch|put|delete)\(" server.js billing/api/
ai/router.js routes/ setup/ | wc -l`). Aşağıdaki tablo yalnız `server.js` ailelerini özetler:

| Aile | Route'lar | Auth |
|---|---|---|
| **Rezept / KI** | `POST /rezept/upload` (⚠️ OCR kapalı: 503 `AI_OCR_DISABLED`) · `/rezept/confirm` · `/rezept/save` · `/prescription/lookup-by-phone` | `requireAuthAI` |
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

- **Plans — ⚠️ FİYAT HENÜZ BELİRLENMEDİ (Kemal, 10.09 + 11.10.2026).** Paketler ve
  içerikleri ürün "hazır" sayıldığında belirlenecek. Stripe'ta ve `pricing.js`'te duran
  rakamlar **yer tutucudur**; belgelere, metinlere ve analizlere fiyat rakamı **yazılmaz**,
  "fiyat henüz belirlenmedi" denir. Fiyata dayanan hesap (birim ekonomi, destek maliyeti,
  başabaş) yapılmaz. Eski dosyalarda dolaşan hiçbir fiyat seti geçerli değildir.
- **Trial:** 14 gün · **Customer Portal:** aktif · **Checkout domain:** `pay.praxura.de`
- **Enterprise price ID hâlâ YOK** — `pricing.js`/`stripe-live-setup.cjs`'te geçmiyor (Ops-Dashboard → **Launch**)
- **Webhook:** `https://app.praxura.de/api/stripe/webhook`. Kodun fallback'i de aynı
  (`create-checkout-session.js`, `portal-session.js`), yani `NEXT_PUBLIC_URL` boş olsa bile
  doğru domain'e gider. ⚠️ Ama env **yanlış** bir değere set edilmişse fallback devreye
  girmez — Vercel'de `NEXT_PUBLIC_URL` varsa `https://app.praxura.de` olmalı.

LIVE ürün/fiyat scripti: **`stripe-live-setup.cjs`** — `.cjs` uzantısı şart
(`package.json` `"type": "module"`). Env var **adları**: `archive/rapor/STRIPE_SETUP.md`
(⚠️ Test Mode döneminde yazıldı).

### Profile alanları
```
plan, plan_status (pending/trial/active/past_due/canceled/expired),
trial_ends_at, stripe_customer_id, stripe_subscription_id,
stripe_price_id, billing_interval, current_period_end
```

---

## 🤖 n8n

Azure çağrısı n8n'den geçmiyor. Kodda kalan **gerçek** n8n bağı tek satır, env-guard'lı:
- `server.js` — `N8N_WEBHOOK_URL`, booking bildirimi (env yoksa sessizce atlanır; sabit
  fallback yok, PII taşımaz, kutu paketinde bu env hiç yok — onprem/REGISTER.md O-13).
  Satır numarası yazılmıyor, kayıyor: `grep -n "process.env.N8N_" api-backend/server.js`.

Seri planlayıcı 12.09.2026'da n8n'den çıktı (O-02): `ai/tasks/series-scheduler.js` üzerinden
doğrudan Azure'a gidiyor, `N8N_AI_SERIES_URL` okunmuyor. Kalan satır playbook Faz 1.2'de
Express'e taşınacak; kabul kriteri `grep N8N_` → sıfır. Ayrıca `gkv-datenaustausch.de`
izleme workflow'u Telegram bildirimi atıyor (merkez tarafı, kutuya girmez).

⛔ n8n **on-prem pakete konmaz** (playbook K8 — Sustainable Use License ücretli müşteriye
dağıtımı yasaklıyor). Bu `onprem` ajanının sert veto konularından biri (G3).

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
- `PUBLIC_API_BASE` — ⛔ **SET ETME.** `api/config.js`'in `apiBase` alanı (O-01,
  11.09.2026) bu env yoksa doğru varsayılana (`https://n8n.infinitymade.de/api`)
  zaten düşüyor. Yanlış/eksik bir değer burada **bütün SaaS trafiğini** yanlış
  backend'e gönderir, `NEXT_PUBLIC_URL` ile aynı risk sınıfı ama fallback'i yok
  (env set edilmişse olduğu gibi kullanılır) — onprem/REGISTER.md O-54

**VPS (`/opt/calendar-api/.env.calendar`):**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URL`
- `N8N_WEBHOOK_URL`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`
- `SETUP_TOKEN` — ⛔ **SET ETME.** On-prem kutunun `install.sh`'ının ürettiği tek
  kullanımlık kurulum jetonu (Faz 2.1c/2.2, O-62). Aynı kod SaaS VPS'inde de
  çalışıyor; burada set edilirse `api-backend/setup/router.js`'in owner-yaratma
  ucu **canlıda** açılır. Kapı bunu göremez (uzak env, repo'da iz bırakmaz) —
  tek koruma bu satırın hiç yazılmamış olması. onprem/REGISTER.md O-66/O-67

> ⚠️ **Doğru anahtar adı `SUPABASE_SERVICE_ROLE_KEY`.** `SUPABASE_SERVICE_KEY` yazmak
> prod'da crash-loop yaratmıştı — Watchtower bozuk image'ı 60 saniyede canlıya alır.

---

## 📐 Kurallar

### 🗄️ Şema dökümü protokolü (2026-08-10)

**SQL yazmadan / tablo-kolon varsayımı yapmadan önce `db/README.md` okunur.**
Orada tuzaklar yazılı (en önemlisi: hasta tablosu `patients` değil **`leads`**).

#### ⛓️ Şema değişikliği artık ÖNCE DOSYA, SONRA CANLI (10.09.2026)

**`mcp__supabase__apply_migration` tek başına yeterli değildir.** Çalıştırılabilir zincir
`api-backend/db/migrations/` altındadır ve müşteri kutusuna giden **tek** yol odur; canlıya
elle uygulanan bir değişiklik kutuya asla ulaşmaz.

Sıra bağlayıcıdır:

1. `api-backend/db/migrations/NNNN_ad_alt_cizgili.sql` dosyasını yaz (sıradaki numara)
2. Aynı commit'te `db/SCHEMA.sql` + `SCHEMA-RLS.sql` dökümünü tazele
3. Canlıya uygula (MCP)

- **Kapı var:** döküm staged ama zincire yeni dosya girmediyse `tools/check-onprem.sh`
  commit'i reddeder. Yalnız biçimsel döküm tazelemesi için: `SKIP_MIGRATION_GATE=1`.
- **Temel:** `0000_baseline.sql` (10.09.2026, canlıdan üretildi). Canlıda **çalıştırılmaz** —
  defter `praxura_migrations`'a "uygulanmış" diye kayıtlıdır; dosya yalnız yeni kutularda koşar.
- **Uygulanmış dosya değiştirilmez** — runner SHA-256 tutar, değişirse kutu açılmaz.
  Düzeltme her zaman **yeni dosyayla**.
- Kolon silme/yeniden adlandırma **tek adımda yapılmaz** (`:beta` ve `:stable` aynı anda
  canlı). Kurallar: `api-backend/db/migrations/README.md` · tasarım: `onprem/SCHEMA-VERTEILUNG.md`

- **Her şema değişikliğinden sonra döküm aynı commit'te tazelenir.**
  `mcp__supabase__apply_migration` çalıştırdıysan, iş bitmedi — `db/SCHEMA.sql` ve
  `db/SCHEMA-RLS.sql` yeniden üretilir, iki dosyanın başındaki tarih + son migration
  satırı güncellenir. Tetikleyici cümle: **"şema güncelle"**.
- **Eski döküm hiç dökümden kötüdür** — okuyan ona inanır. Bu yüzden tazeleme
  ertelenmez, "sonra yaparım" denmez.
- `supabase/migrations/` **kaynak değildir** (arşivde). Şema gerçeği `db/` +
  `api-backend/db/migrations/`. ⛔ `supabase/functions/` (Fahrtenbuch Edge Functions)
  CANLI, karıştırma.
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
  taraması (`codeStumm`) + ham grep + `SCHEMA-RLS.sql` (trigger/policy/RPC) + `api-backend/dsgvo/klassifikation.js`.
  Kanıtlanmış tuzaklar: `nummernkreise` yalnız trigger'dan beslenir · `icd10_titles`
  yalnız `search_diagnosen()` RPC'sinden okunur · `demo_bookings` `.from()` değil PostgREST
  yolu kullanır · `heilmittel_position` aynı zamanda bir **kolon** adıdır (ham grep onu
  canlı sanır) · `"fußstatus"` ASCII değildir.
- **Yeni tablo kişisel veri taşıyorsa `api-backend/dsgvo/klassifikation.js`'e yazılır** (tek kaynak:
  kategori → saklama süresi → Auskunft/Löschung/kilit). Bu adım 2026-08-28'de atlandı ve Auskunft
  eksik döndü; artık `klassifikation.test.js` sınıflandırılmamış tabloda `npm test`'i kırar.
  Silme yerine **kilit** modeli (K1.4, 02.10.2026): aufbewahrungspflichtige veri `aufbewahrung_sperre`
  ile kilitlenir, Auth kullanıcısı **asla silinmez** (CASCADE kilitli veriyi götürür) — banlanır.

### 🗺️ Fonksiyon haritası protokolü (2026-08-12)

**"Böyle bir fonksiyon var mı" sorusu okuyarak değil `funktionen/INDEX.json` okunarak
cevaplanır.** Projede binlerce fonksiyon var — hiçbir model bunu
tek seferde kapsayamaz, okur ve *makul ama eksik* cevap verir.
(Güncel sayım her zaman `node tools/funktionskarte.mjs --check` çıktısındadır.)

- Harita `node tools/funktionskarte.mjs` ile **üretilir, elle düzenlenmez.**
- **Fonksiyon eklendiğinde/silindiğinde harita aynı commit'te tazelenir.**
  Tetikleyici cümle: **"harita güncelle"**. Eski harita hiç haritadan kötüdür.
- Yeni bir fonksiyon yazmadan önce `fonksiyon-ustasi` ajanına sorulur — **elimizde olanı
  sıfırdan yazmıyoruz, modifiye ediyoruz.** Ortak taban + üstüne binen alan modifikasyonu
  bu projenin mimarisidir (bkz. `funktionen/README.md`).

#### 🔁 `fonksiyon-ustasi` iki yönlü çalışır — sor **ve** bildir (2026-08-16)

Ajan çağırmak için genel eşik "%90-95 eminsen sormadan çağır"dır. **`fonksiyon-ustasi`, `db-ustasi`
ve `onprem` bu eşiğin dışındadır: her zaman gidilir, izin sorulmaz.**

> ⚠️ **Bu bir ayrıcalıktır ve genel "ajan çağırma" kısıtını EZER (2026-08-28, 14.09.2026'da
> `onprem` eklendi).**
> Oturuma "kullanıcı istemedikçe ajan çağırma" gibi genel bir kısıt gelmiş olabilir.
> **`fonksiyon-ustasi`, `db-ustasi`, `onprem` ve `/konsey` o kısıtın kapsamı dışındadır** — dördü
> de bu projenin çalışma yönteminin parçası ve kullanıcı tarafından bir kez, kalıcı olarak
> yetkilendirildi. Her seferinde yeniden izin istemek kuralın var oluş sebebini yok eder.
> `onprem`'in kendi tanımı zaten "dış çağrı · şema · env var · zamanlanmış iş · sabit adres ·
> yetki kontrolü yazılmadan ÖNCE sor" diyordu — burası onu resmileştiriyor, davranış
> değişmiyor.
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

### 🖥️ Ekran/akış sicili protokolü (2026-09-19)

**"Bu ekran/buton ne yapmalı, en son ne zaman doğrulandı" sorusu tahminle değil
`canli-test/REGISTER.md` okunarak cevaplanır.** `canli-test` ajanı önceden tek seferlik
akış testi yapıyordu (bir kez gez, bulguyu raporla, unut) — artık bu kayıt sayesinde
**kümülatif**: her test turu bir/birkaç ekranın "beklenen davranışını" ve son test
tarihini biriktirir, bir dahaki turda sıfırdan başlanmaz.

İki bölümü var:

| Bölüm | Ne | Kim yazar |
|---|---|---|
| Ekran/Fonksiyon kayıtları | Panel/akış başına: beklenen davranış, bağımlı ekranlar, son test tarihi+sonucu | `canli-test` — her test turunda |
| Bildirilen anomaliler | Test dışında fark edilen arayüz tuhaflığı (çift render, yanlış buton, eksik bildirim) | **herhangi bir ajan** — `fonksiyon-ustasi`, `db-ustasi`, `builder`, `podoloji`, `mobil-ui` |

- **Domain doğruluğu (bu akış podolog için mantıklı mı) `canli-test`'in kendi yargısı
  değildir** — önce `podoloji` ajanına sorulur, cevap registera yazılır. `canli-test`
  kendi başına yalnız mekanik doğruluğu (çalışıyor mu, konsol temiz mi, sayfa
  yenilenince veri duruyor mu) yargılar.
- **Otomatik/periyodik tarama kurulmadı** — bu ajan sadece istendiğinde çalışır
  ("şunu test et", "deploy oldu mu bak"). Sürekli izleme değil, kontrol elde kalsın
  diye bilinçli tercih (2026-09-19).
- Kayıt **elle tutulur, üretilmez** ve **kümülatif** doldurulur — 23 panelin tamamını
  tek seferde katalogla**ma**, `fonksiyon-ustasi`'nin "okuyarak kapsama iddiası etme"
  ilkesiyle aynı gerekçe (bkz. yukarıdaki fonksiyon haritası protokolü).
- Ajan/kod ilişkisi: `canli-test` mekanik test altyapısını (Playwright, üç kapı, devir
  paketi) zaten tutuyordu — bu, o altyapıya eklenen bir **hafıza katmanı**, ayrı bir
  agent değil. Gerekçe ve alternatiflerin değerlendirmesi kullanıcıyla netleştirildi
  (2026-09-19): ayrı agent açmak aynı browser-test mekaniğini iki yerde tekrar ederdi.

### 📚 Belge arşivi protokolü (2026-08-04 · genişletildi 2026-09-05)

**İki dosya, iki ayrı soru — karıştırma:**

| Dosya | Soru | Bakımı |
|---|---|---|
| `wissensbank/INDEX.md` | Belgenin **içinde ne var**, hangi bölüm nerede | elle — okundukça |
| `wissensbank/REGISTER.md` | **Nereden geldi**, hangi sürüm, ne zaman düşer, **neyi besler** | `wissensbank` ajanı — "bilgi bankası güncelle" |

- **Yeni belge indirildiğinde `wissensbank` ajanına gidilir** — giriş protokolü onda
  (kimlik çıkarma, format kararı, iki kayda birden yazma). "Bunu indirmiş miydik" sorusu
  da ona sorulur; aynı dosya iki kez indirilmez.
- **Sayı taşıyan tablo (fiyat, pozisyon numarası, IK, Schlüssel, ICD) YZ ile çevrilmez** —
  ne `agy`, ne başka model. Deterministik araç + orijinale karşı örnekleme. Gerekçe
  ölçülmüş: `api-backend/preise_pruefen.mjs` başlığı, ve Anlage 2 PDF'inde bir fiyatın
  kendi kodunun bir satır üstünde durduğu gerçek olay.
- **Türev asla otorite değildir.** md/csv/json okumayı ucuzlatır; fatura veya hukuk
  iddiası her zaman orijinal + bölüm + sürüm üçlüsüne dayanır.

Belgeye dokunan her iş şu sırayı izler:
1. **Önce `wissensbank/INDEX.md`** — her belgenin kaydı, sürümü ve bölüm haritası orada
2. **Hedefli oku** — kayıttaki "Anahtar bölümler"den `Grep` ile ilgili kısmı bul, sadece onu oku.
   Belgenin tamamını okumak neredeyse her zaman hatadır (`Anlage_1_TP5_V21` tek başına ~130k token)
3. **Sonra kaydet** — INDEX'te kaydı olmayan bir belge okunduysa kaydı INDEX'e eklenir
4. Okuma her zaman `.txt` üzerinden; `.pdf` açılmaz (`pdftotext -enc UTF-8 -layout` ile üretilir)

Süzülmüş kurallar: `wissensbank/SPEC-RULES.md` (kaynak + sürüm + kod satırı üçlüsü zorunlu).
Geçerli sürüm: **Anlage 1 ve 3 TP5 = V21**. V22/V10 → 01.02.2027, erken geçiş dosya reddi demektir.

### 🚨 Vercel serverless limiti — en fazla 12, yeni fonksiyon AÇILMAZ

Vercel planımız **en fazla 12 serverless fonksiyona** izin veriyor; `api/` sınırda
(sayım aşağıdaki komutla). Boş slot olsa bile harcama — yeni uç `api-backend/server.js`'e (G8).

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
  ⚠️ **Bugün hiçbir alanda açık değil** (26.10.2026 doğrulandı): eskiden açık olduğu
  `podNewIcd10` alanı podolojik hızlı yol kodu ile birlikte silindi (`2ae131c3`).
  Kalan alan `rzIcd` mandanten-bağımlı — `strict` bugün sabit bool, alan bazlı açmak
  için küçük bir modül değişikliği gerekir. Açmadan önce o alanın `icd_sector_ranges`
  kapsamı doğrulanmalı (eksikse doğru kodlar da gizlenir)
- Örnek: Ergotherapie Blankoverordnung sözleşmesi 01.04.2024'ten beri yürürlükte ve kodumuz
  onu blokluyor. Gelir etkisi var ama **bilinçli olarak beklemede** (Ops-Dashboard → **Teknik**)

### Frontend

#### 🚧 Yeni kod yeni dosyaya — `dashboard.js` BÜYÜMEZ (Konsey 2026-08-13)

**`dashboard.js` bir satır daha büyümeyecek** (taban: `tools/.dashboard-baseline`). Yeni bir modül/ekran/akış
yazılacaksa `module/<alan>.js` olarak **ayrı dosya** açılır ve `dashboard.js`'e tek `import`
satırıyla bağlanır. Örnek: `dashboard.js`'in en üstündeki import bloğu.

- Bu bir tavsiye değil **kapı**: pre-commit hook `dashboard.js` satır sayısı artarsa commit'i
  reddeder (`tools/check-dashboard-size.sh`, taban `tools/.dashboard-baseline`).
  **Kurulum — her geliştirici bir kez:** `git config core.hooksPath .githooks`
  (dosya küçülürse taban otomatik sıkışır, kazanım geri alınamaz.)
- Mevcut bir fonksiyonu düzeltmek serbest — dosyayı **büyütmemek** şartıyla.
- Eski kod yeniden yazılmaz; **kuşatma** yöntemiyle dokunuldukça ayrı modüle göç eder.
  Göç tek yönlüdür: modülden `dashboard.js`'e geri taşıma yasak.

> Gerekçe ve ölçüm: `konsey/tutanak/2026-08-13-frontend-mimari-katman.md`.
> Kararın özeti: React'a geçilmeyecek, `dashboard.js` yeniden yazılmayacak; eksik katmanlar
> (olay/sinyal, tip kontrolü, veri katmanı) vanilla kalınarak eklenir.

- **Ortak modülleri yeniden yazma.** Yeni seçici/arama/takvim gerekiyorsa önce bak:
  `katalog-suche.js` (ICD/Diagnosegruppe/Heilmittel) · `patient-suche.js` · `calendar-widget.js`
- **`<datalist>` kullanma** — bu modüller onun yerine var
- **Sidebar modülü** eklenecekse `nav-registry.js`'e yazılır (tek kaynak + görünürlük toggle)
- **Dark theme:** `#fff` / `#f3f4f6` gibi sabit renk **YASAK** →
  `--bg-card-solid`, `--text-main` CSS değişkenlerini kullan
- **Ürün yalnız Almanca** (Kemal, 28.09.2026). `data-i18n` etiketi HTML'i ezer; gerçek
  metin **`dashboard.js` içindeki `T.de` sözlüğünde**. en/tr sözlükleri koddan kalktı —
  yeni metinde yalnız `de` yaz
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
- **TEK Verordnung havuzu (04.09.2026'dan beri):** Physio/Ergo/Logo VE Podoloji
  artık ikisi de `prescriptions`'ta (`therapie_bereich` ayırır). Physio
  `prescription_sessions` üzerinden seans tutar, Podoloji `podologie_behandlungen`
  + `bookings.verordnung_id` üzerinden — farklı modeller, aynı tablo. Podolojik
  kelime dağarcığını (`lead_id`, `behandlungseinheiten`, status ekseni)
  `prescriptions`'ın alan adlarına çeviren sınır modülü: `module/verordnung-topf.js`.
  Eski `verordnungen` tablosu **silindi** (04.09.2026, kullanıcı kararıyla —
  önce 3 gün donduruldu, sonra planlanan 90 günlük bekleme atlanarak drop
  edildi; 4 satır id'leri korunarak zaten `prescriptions`'a taşınmıştı).
  ⚠️ **Podoloji/Rezept için ikinci bir tablo bir daha açılmaz** — tek doğru
  yer `prescriptions`, karar kalıcı (bkz. `db/REGISTER.md` → `verordnungen`
  girdisi, gerekçesiyle).

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
- UI metinleri yalnız Almanca
- `git push`'u **ana context'te ve ön planda** çalıştır — subagent'ta veya
  `run_in_background` ile kimlik deposuna (Windows Credential Manager / macOS Keychain)
  erişilemiyor, sessizce asılı kalır. Ekipte iki ortam var: Kemal Windows, Melih macOS —
  yollar (`I:\My Drive\…`, `c:\Users\…`) Windows'a aittir, macOS'ta Drive klasörü aynı adla
  başka bir yerde durur.

### 🌿 Doğrudan `main` üzerinde çalışılır — feature branch AÇILMAZ (2026-08-30)

**Karar Melih'e aittir ve genel "varsayılan dalda commit etme, önce dallan"
kısıtını EZER.** Proje inşa aşamasında, ekip iki kişi; ayrı dallar burada
koruma değil, gecikmiş bir birleştirme borcudur.

Sebep, bir kez yaşandı: `kalender-ux` dalı sekiz gün açık kaldı, bu sürede
`main` 33 commit ilerledi, sonunda dört çakışma elle çözüldü. Kazanılan
güvenlik, ödenen bedeli karşılamadı.

Yani:
- Yeni iş için **dal açma**, doğrudan `main`'e commit et.
- Kullanıcı istediğinde `main`'e push et. Push, Vercel üzerinden anında canlıya
  gider — bu bilinçli kabul edilmiştir.
- **Bunun bedeli:** her ara durum canlıdır. Karşılığı: her adım tek başına
  bitirilir. Yarım bir ekranı, çalışmayan bir akışı veya "sonra düzeltirim"
  notunu push etme.
- Yıkıcı ya da geri alınamaz bir şey (veri silen akış, şema değişikliği, canlı
  ödeme) yine **önce sorulur.**
- Bir şey ters giderse yol geri: `git revert <commit>` + push. Vercel bir dakika
  içinde eski hâli yayına alır.

⛔ İstisna: kullanıcı belirli bir iş için açıkça "bunu ayrı dalda yap" derse.

---

## ☁️ Bulut oturumu (claude.ai/code, bilgisayar kapalıyken) — 30.10.2026

Depo GitHub'dan açıldığında yerel makinedeki her şey **yoktur**. Bilinçli olarak:

- **İlk komut:** `git config core.hooksPath .githooks` (kapılar yoksa sessizce atlanır).
- **Gitignore'lu dosyalar yok:** `INFRASTRUCTURE.md` · `guvenlik/` · `mentor/` · `Meetings/` ·
  `.env*` · `ops/.env.ops`. Yani VPS/SSH işi, Ops-Dashboard'a kart yazma ve canlı sırlar bu
  oturumda **yapılamaz** — notu `fortschritte/` günlüğüne yaz, yerel oturum taşır.
- **Supabase MCP yok:** migration **dosyası** yazılabilir, canlıya uygulama ve
  `db/SCHEMA*.sql` tazeleme yerel oturuma kalır (sıra kuralı yukarıda).
- **`agy` yok:** `builder` işi worker'a dağıtamaz, kendisi yazar.
- **Kullanıcı hafızası yok:** güncel iş planı ve kararlar depodadır — aktif iş:
  **`Physio/PILOT-PLAN.md`** (Kemal/Melih iş bölümü, çakışma kuralları).
- Push `main`'e (dal açma kuralı aynen geçerli).

## 🧪 Yerel test ve tarayıcı probları

**`node dev_server.cjs` → http://localhost:8081** — `/api/config`'i de yanıtlar
(`.env.local` ya da ortam değişkenlerinden; iki değer `https://app.praxura.de/api/config`'te
durur ve sır değildir — anon key, koruma RLS'ten gelir). Bu olmadan yerelde login çalışmaz.

**`npm run probe`** — gerçek tarayıcıda, **login'siz** problar (`tools/browser-probe/`,
Playwright; liste `package.json` → `probe`). `node --test` (DOM yok) ile tıklama turu
(login ister) arasındaki boşluğu kapatır: takvim geometrisini ölçer, `dashboard.js`'in
import ettiği modülleri yükler, renderer'ları uydurma veriyle çizer.

Kurulum (bir kez): `npm i -D playwright && npx playwright install chromium --only-shell`.
⚠️ `npm install` npm cache'inde yetki hatasına düşerse: `--cache /tmp/npm-cache-praxura`.

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

## 🤖 Ajanlar ve /konsey

`.claude/agents/` altında uzman ajanlar var (her dosya bir ajan). Kendin araştırmaya başlamadan önce **doğru
ajana sor** — hepsi kendi alanının belgelerini zaten biliyor.

| Ajan | Ne için | Kod yazar mı |
|---|---|---|
| `builder` | ★ Orkestra şefi. İşi parçalar, `agy` (Antigravity/Gemini) worker'larına dağıtır, dönen kodu doğrulatır. Çok adımlı feature/refactor/toplu düzeltme | ✅ |
| `fonksiyon-ustasi` | ★ Fonksiyon ve veri akışı haritası. "Böyle bir fonksiyon var mı", kopya kod yolları. Yazmadan ÖNCE sor, yazdıktan SONRA "niye + nerede" bildir (bkz. Kurallar). Kaynak `funktionen/INDEX.json` | ❌ |
| `db-ustasi` | ★ Veritabanının kurumsal hafızası. Hangi tablo niye/ne zaman açıldı, kim yazıyor, hâlâ gerekli mi. MCP ile canlı DB'ye bağlı. Şema/SQL işinden ÖNCE sor | ✅ (yalnız migration) |
| `gkv-302` | §302 SGB V, EDIFACT/DTA, Kostenträger/IK, Heilmittel-Richtlinie, Diagnosegruppen, Korrekturverfahren. **"Para gelir mi?"** | ❌ |
| `legal-de` | DSGVO/BDSG, §203 StGB, MDR, EU AI Act, AGB/Impressum/UWG. Startup bütçesine kalibreli. **"Başımız derde girer mi?"** | ❌ |
| `guvenlik` | ★ Güvenlik sorumlusu + kurumsal güvenlik hafızası. Sızıntı, mandant sınırı, açık yüzey. Sicili `guvenlik/REGISTER.md` tutar — neyin ÇÜRÜTÜLDÜĞÜNÜ de bilir. Konseyin daimi üyesi, dört konuda sert veto | ❌ |
| `podoloji` | Podolog'un gerçek iş günü, Fußbefund/Wagner-Armstrong, HPNR 78xxx, tık-ekonomisi | ❌ |
| `physio` | ★ Physio vertikalinin "sanal praxis ortağı" (26.10.2026, partner yokken). Empfang/terapist günü, Rezeptprüfung, Serienplanung, Zertifikatsleistungen, tık-ekonomisi; kendiliğinden eksik/öneri listesi çıkarır. Belgeden çıkmayanı `Physio/PARTNER-FRAGEN.md`'ye biriktirir, kararlar `Physio/PRODUKT-ENTSCHEIDUNGEN.md` | ❌ |
| `wissensbank` | ★ Dışarıdan indirilen resmî verinin kütüphanecisi. Her PDF/XML/XLSX nereden geldi, hangi sürüm, ne zaman düşer, **hangi kod satırını ve hangi tabloyu besler**. "Bu bilgi nerede", "bunu indirmiş miydik", "yeni sürüm var mı", "bu PDF'i neye çevirelim" sorularının cevabı. Sicili `wissensbank/REGISTER.md`. Konsey üyesi, vetosu yok | ❌ (sicil + türev üretimi hariç) |
| `onprem` | ★ İki dağıtım bekçisi + on-prem geçişin kurumsal hafızası. Tek soru: "bu değişiklik müşterinin kutusunda ne yapar, merkezden oraya nasıl varır?" Sicili `onprem/REGISTER.md`. Dış çağrı · şema · env var · zamanlanmış iş · sabit adres · yetki kontrolü yazılmadan ÖNCE sor. Dört korkulukta sert veto (G1/G2/G3/G8) | ❌ (sicil + kapı hariç) |
| `mobil-ui` | Küçük ekran: üst üste binme, yatay taşma, dokunma hedefi, breakpoint çakışması. Playwright ile **ölçer**, sonra sadece CSS'te düzeltir | ✅ (yalnız CSS) |
| `canli-test` | ★ Canlı ortam test pilotu. Deploy indi mi, akış uçtan uca çalışıyor mu, konsol/ağ hatası var mı — gerçekten tarayıcıda gezerek doğrular. Sicili `canli-test/REGISTER.md`: ekranların beklenen davranışı + diğer ajanların bildirdiği anomaliler, kümülatif. Domain doğruluğunu kendi yargılamaz, `podoloji`'ye sorar. Otomatik çalışmaz, sadece istendiğinde | ❌ |
| `muhalif` | Yapıcı muhalif — fikir nerede kırılır, gizli maliyet ne. Alternatifsiz itiraz yasak | ❌ |
| `todo-maker` | Ham girdiyi (toplantı dökümü, transkript, hata raporu) zengin pano kartlarına çevirir — hangi ekran, hangi dosya, kim istedi, bitti sayılır ölçütü, gerekirse kopyala-yapıştır Fix-Prompt | ❌ (JSON üretir) |
| `deger-mi` | Efor/değer, fırsat maliyeti, daha küçük sürüm yeterli mi | ❌ |
| `mentor` | ★ Kurucu danışmanı + şirket hafızası. "Bu kararı neye göre vereceğim", "yol haritam doğru mu", "bu tavsiye bize uyar mı". İlk-kez-kurucu hatalarını önceden işaretler, dış tavsiyeyi kanıt katmanına göre süzer. Sicili `mentor/REGISTER.md` (gitignore'lu) — hedefler, stratejik kararlar, **tahmin defteri**. Konseye ticari/stratejik kararlarda katılır, vetosu yok | ❌ |

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
  Fikir**. **Yeni iş çıkarsa
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
  ⚠️ **09.09.2026'da bu tam olarak yaşandı:** depo kökünde git'e commit edilmiş bir
  `.tmp.driveupload/` klasörü bulundu (origin/main'de de vardı) — birinin Google Drive
  masaüstü istemcisi depo klasörünü senkronluyormuş. İçerik hassas değildi (bir HTML
  sayfasının senkron kopyası), git'ten çıkarıldı ve `.gitignore`'a eklendi, ama asıl
  düzeltme Drive senkron kapsamından bu depo klasörünün çıkarılmasıdır — kimde ise.
- `INFRASTRUCTURE.md` — SSH/VPS erişimi, deploy pipeline, sık operasyonlar.
  Depoda (gitignore'lu) **ve** paylaşılan klasörün `infra/` altında. Ön koşul olan koruyucu
  belgeler 2026-08-06'da imzalandı (Datengeheimnis · Nutzungsrechte · §203 kapsanıyor).
- `ONPREM_MIGRATION_PLAYBOOK.md` — ★ on-premise geçiş rehberi; "bu dosyayı uygula" tetikleyici.
  Arka plan: `ON_PREMISE_ANALYSE.md`
- `wissensbank/REGISTER.md` — ★ indirilen resmî belgelerin sicili: nereden geldi, hangi sürüm,
  ne zaman düşer, hangi kod/tabloyu besler. **Geçerlilik takvimi burada** (V22 → 01.02.2027,
  Anhang 03 V10 → 01.02.2027, HPNR 2027 → 01.01.2027)
- `wissensbank/INDEX.md` — GKV/§302 belgelerinin haritası + okuma protokolü
- `wissensbank/SPEC-RULES.md` — süzülmüş §302 kuralları (kaynak + sürüm + kod satırı)
- `konsey/KARARLAR.md` — konsey kararlarının dizini
- `compliance/LEGAL_DECISIONS.md` — kapatılmış hukuki kararlar
- `Podoloji/PRODUKT-ENTSCHEIDUNGEN.md` — podoloji ürün kararları
- `archive/rapor/STRIPE_SETUP.md` — env var adları (⚠️ Test Mode döneminde yazıldı)

### 🗄️ Arşiv
Eskimiş rapor/plan/kod/medya `archive/` altında — **silinmedi.** Neden eskidikleri ve
içlerinden neyin kurtarıldığı `archive/README.md`'de. Oradaki audit bulguları **iddiadır**,
aksiyon almadan önce koda/DB'ye karşı doğrula. Bu dosyadan çıkarılan tarihçe:
`archive/rapor/CLAUDE_MD_TARIHCE_2026-10-11.md`.

---

*Son güncelleme: 11.10.2026 (bayat sayılar ve kapanmış tarihçe temizlendi). Bu dosyaya sayı
yazılmaz — güncel sayımlar üreticilerde: `funktionskarte.mjs --check`, `tabellenkarte.mjs`,
`db/SCHEMA*.sql` başlıkları, `npm test`.*
