# 🔄 Context Handoff — Claude Code → Windsurf

> Oluşturma: 2026-05-10 | Önceki sistem: Claude Opus 4.7 (Claude Code)
> Bu dosya Windsurf/Cascade'in (Sonnet/Opus/K2.6) projeye sıfırdan değil, kaldığımız yerden devam edebilmesi için yazıldı. CLAUDE.md ile birlikte oku.

---

## 🟢 Production'da çalışan ve ELLENMEMESİ gerekenler

### 1. Auto-deploy pipeline (çalışıyor — kurulumu yeniden yapma)
- `git push main` → GitHub Actions (`.github/workflows/publish-calendar-api.yml`) → GHCR'a image push → VPS'teki Watchtower 60 saniyede bir poll → calendar-api otomatik restart
- VPS'te manuel iş YOK (PM2 yok, WinSCP yok, SSH yok)
- Total lag: ~4 dakika
- DEPLOY_BOOTSTRAP.md kurulum tamamlandı, bir daha çalıştırma

### 2. VPS Docker stack (Hetzner — `n8n.infinitymade.de`)
- `/opt/n8n/docker-compose.yml`: traefik + n8n
- `/opt/calendar-api/docker-compose.yml`: calendar-api + watchtower (image: `ghcr.io/ironkemal/infinitymade-website/calendar-api:latest`)
- Eski self-host Cal.com (`/opt/calcom/`) silindi — projeye gerek yoktu
- Eski PM2 calendar-api durduruldu — Docker'da çalışıyor
- Traefik routing scope edilmiş: `/api/booking|calendar|team|verify-code|health` → calendar-api, geri kalan (`/api/v1/*` dahil) → n8n

### 3. WhatsApp → calendar API e2e bot çalışıyor
- n8n workflow: **`xccY2rWaswRM7ZoZ` "PraxisAI v2 — multi_tenant"** (bu UUID'yi ezberle, başka workflow yok)
- Tools: `check_availability` ve `create_booking` HTTP Request → `http://calendar-api:3000/api/booking/...` (internal docker URL — NAT loopback'i bypass etmek için)
- **Hardcoded Siido owner UUID:** `a82285cb-48c8-4c6c-b346-5f97343e7691` (tool body'de userId ve ownerId olarak)
- Multi-tenant dinamik geçiş henüz yapılmadı — şimdilik tek tenant (Siido)
- Twilio sandbox: `+14155238886`

### 4. Calendar API P0 fixleri commit'lendi
`api-backend/server.js`'de:
- ✅ Berlin timezone (UTC dönüşüm doğru)
- ✅ Double-booking — Postgres exclusion constraint (`no_overlapping_bookings`) atomik reddediyor
- ✅ OAuth2Client per-request (race condition çözüldü)
- ✅ `customer_email` fallback: `wa<phone>@whatsapp.local` (NOT NULL constraint için)
- ✅ Request logger: tüm `/api/*` istekleri stdout'a düşer

---

## 🟡 Bugün (2026-05-10) yapılan ama TAMAMLANMAMIŞ iş

### Dashboard kalender iframe → widget (geçici çözüm)
Kullanıcı şikayeti: "dashboard'da kalender sekmesi iframe ile kalender.html'i gömüyor, alt alta iki sayfa görünüyor, widget gibi olsun istemiştik".

**Yapıldı:**
- [dashboard.html:120-140](dashboard.html#L120-L140) — iframe kaldırıldı, "yaklaşan randevular listesi + tam kalender butonu" widget'ı eklendi
- [dashboard.js:746-806](dashboard.js#L746-L806) — `renderUpcomingBookings()` Supabase'den direkt çekiyor (next 14 days)
- [dashboard.css](dashboard.css) end — `.upcoming-bookings-card`, `.upcoming-list`, `.upcoming-item` stilleri eklendi
- Cache version: `20260510a`
- `.gitignore` — `*.md` satırı kaldırıldı (Windsurf md okuyabilsin diye)

**Bu geçici** çünkü esas plan: tüm dashboard sıfırdan yazılacak (DASHBOARD_REDESIGN_PLAN.md). Bugünkü widget muhtemelen yeniden yazılırken silinecek.

**Henüz tanılanmamış sorun:**
WhatsApp'tan oluşan booking (id `5262c98e-9d4b-4045-af80-6ea2250ade17`, 12 Mayıs 10:00) Supabase'de var ama `kalender.html` (iframe versiyon) göstermiyordu. Hipotez: iframe içindeki Supabase client oturumu alamıyor olabilir. Yeni widget direkt dashboard.js'den query yaptığı için bu sorunu bypass ediyor — ama doğrulanmadı, kullanıcı widget'ı henüz test etmedi.

**Doğrulama SQL'i** (kullanıcı SQL editor'de çalıştırabilir):
```sql
select id, owner_id, user_id, start_time, customer_name
from bookings where customer_phone like '%4915228033834%';
```
`owner_id` Siido auth user.id'siyle (`a82285cb-48c8-4c6c-b346-5f97343e7691`) eşleşmeliydi.

**Commit edilmedi:** Bugünkü widget değişiklikleri çalışma dizininde, kullanıcı review edip kendisi commit'leyecek (ya da redesign başlarken atılacak).

---

## 🎯 Sıradaki büyük iş — Unified Dashboard Redesign

**Kaynak:** [DASHBOARD_REDESIGN_PLAN.md](DASHBOARD_REDESIGN_PLAN.md) (kullanıcı yazdı, çok detaylı)

**Özet:**
- `dashboard.html` + `kalender.html` → tek unified dashboard, sıfırdan
- 8 panel sidebar (Übersicht, Kalender, Kunden Info, Dienstleistungen, Arbeitszeiten, Mitarbeiter, B2B, Einstellungen)
- Kalender panelinde **yeni davranış:** aylık görünümde gün tıklayınca sağdan Slot Panel kayar (dolu/boş slotlar listesi + Neuer Termin butonu)
- B2B paneli yeni — `b2b_contacts` tablosu migration gerekiyor
- Koyu tema, `#22c55e` primary, Inter font, 260px sabit sidebar
- `kalender.html`/`kalender.js` SİLİNMEZ, yedek kalır

**Uygulama sırası (plan'da yazıyor):** CSS → HTML → JS → Supabase migration → test.

**ÖNEMLİ:** Plan büyük, tek seferde yazılmaz. Kullanıcı parça parça onay vererek ilerlemek isteyecektir. Plan'a göre çalışırken:
- "Bir sürü yol önerme, en iyi yolu seç" — kullanıcı tercih ettiği yaklaşımdır
- "Güzel plan yap, sonra harekete geç" — düşünmeden değişiklik yapma
- TodoWrite kullan, görev görev ilerle

---

## 🚫 Bilinen davranış kuralları

- **Vanilla HTML/JS — Next.js DEĞİL**, framework eklemeyeceksin
- API çağrıları: production base `https://n8n.infinitymade.de/api`, n8n internal: `http://calendar-api:3000`
- Timezone her yerde `Europe/Berlin` (Intl.DateTimeFormat ile, DST-safe)
- Service-role key SADECE backend (`api-backend/server.js`) içinde — frontend'e geçirme
- HTML cache busting: `?v=YYYYMMDD<a/b/c>` formatı
- Almanca UI default, EN/TR çeviri var
- Ödeme: Stripe TEST mode hâlâ — production'a geçmedi
- Twilio SANDBOX hâlâ — production approval bekleniyor

---

## 📋 Bekleyen TODO sıralaması (kullanıcı önceliklendirmedi, tahmini sıra)

1. **🔴 Unified dashboard redesign** (DASHBOARD_REDESIGN_PLAN.md) — büyük iş
2. **🟡 Multi-tenant config dynamics** — n8n tool body'sinde hardcoded Siido UUID dinamik olacak (yeni müşteri eklenince patlamasın)
3. **🟡 Cancel/Reschedule/Find endpoints** — backend'de yok, bot şu an "telefonla arayın" diyor
4. **🟡 Public booking sayfası** — `booking.html` müşteri-yüzlü randevu sayfası mı, owner panel mi karışık (kullanıcı clarify etti: owner için, ama sıfırdan yazılacak ünifield içinde panel olacak)
5. **🟢 Rate limit + captcha** — public endpointler korunmalı (P1)
6. **🟢 Email confirmation** — booking sonrası mail
7. **🟢 Twilio production + Facebook Business approval**
8. **🟢 `cal_username` cleanup** — profiles şemasında Cal.com kalıntısı

---

## 🔑 Önemli sabitler

| İsim | Değer |
|---|---|
| Siido owner UUID | `a82285cb-48c8-4c6c-b346-5f97343e7691` |
| Production n8n workflow ID | `xccY2rWaswRM7ZoZ` |
| Supabase project ref | `njvuclullotbksskpwgk` |
| Production domain | `infinitymade.de` (Vercel) |
| API domain | `n8n.infinitymade.de` (VPS) |
| Twilio sandbox WA number | `+14155238886` |
| Stripe webhook URL | `https://www.infinitymade.de/api/stripe/webhook` |
| GHCR image | `ghcr.io/ironkemal/infinitymade-website/calendar-api:latest` |

---

## 📁 Hızlı dosya rehberi

| Dosya | Ne yapar |
|---|---|
| `api-backend/server.js` | VPS Express API — tüm `/api/*` endpoint'ler |
| `api-backend/Dockerfile` | Node 22 alpine, prod deps, non-root |
| `api-backend/docker-compose.yml` | calendar-api + watchtower stack (VPS'e zaten kopyalandı) |
| `dashboard.html`/`.js`/`.css` | Müşteri dashboard (REDESIGN edilecek) |
| `kalender.html`/`.js` | Şu an aktif kalender (REDESIGN sonrası YEDEK kalır) |
| `booking.html`/`.js` | İşletme sahibi randevu yönetim sayfası (yeniden yorumlanacak) |
| `onboarding.html`/`.js` | 8 adımlı kayıt akışı (dokunma) |
| `employee-signup.html`/`.js` | Çalışan kayıt (company_code ile) |
| `api/_lib/`, `api/stripe/` | Vercel serverless (Stripe çalışıyor, dokunma) |
| `supabase-config.js` | URL + anon key (frontend için) |
| `database_setup.sql`, `database_v2.sql`, `database_v3_concurrency.sql` | Şema migration geçmişi |
| `CLAUDE.md` | Proje master spec — auto-yüklenir |
| `DASHBOARD_REDESIGN_PLAN.md` | Sıradaki büyük iş |

---

## 💬 Kullanıcı tercih ipuçları (önemli!)

- Türkçe konuşur, kod/UI Almanca
- Çok fazla seçenek sunmadan en iyi yolu öner
- Karar vermeden önce planı düşün ("güzelce plan yap ne olabilecegini düsün ondan sonra harakete gec")
- Onay almadan büyük dosyaları sıfırdan yazma — adım adım git
- Gereksiz commit istemiyor, kullanıcı kendisi commit atıyor genelde
- Yorum satırı yazma (CLAUDE.md kuralı)
- Test etmeden "çalışıyor" deme

---

*Son güncelleme: 2026-05-10 — Claude Opus 4.7 (Claude Code) tarafından handoff için hazırlandı*
