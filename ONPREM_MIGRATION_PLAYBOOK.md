# PRAXURA — On-Premise Geçiş Playbook'u

> **Bu doküman nedir:** Praxura'nın SaaS modelinden self-hosted/on-premise dağıtım modeline ("Praxura Lokal") geçişinin eksiksiz uygulama rehberi. Kullanıcı "bu dosyayı uygula" dediğinde, bu dokümanı uygulayan model başka hiçbir kaynağa ihtiyaç duymadan işe başlayabilmelidir.
>
> **Hazırlayan:** Claude Fable 5, 2026-07-06 (tam bağlamla: kod envanteri + regülasyon araştırması + kullanıcıyla karar tartışması sonrası)
> **Arka plan analizi:** `ON_PREMISE_ANALYSE.md` (regülasyon detayı), `REGULATORY_AUDIT.md` (SaaS landmine audit'i)
> **Durum:** ⬜ BAŞLAMADI — aşağıdaki DURUM TAKİBİ bölümünü güncelleyerek ilerle.

---

## 0. UYGULAYAN MODEL İÇİN TALİMATLAR

1. Önce `CLAUDE.md`'yi ve bu dosyanın tamamını oku. Sonra **§10 Durum Takibi**'ne bak — hangi faz açıksa oradan devam et.
2. **§2'deki kilitli kararları yeniden tartışmaya açma.** Gerekçeleri yazılı; kullanıcı açıkça fikir değiştirmedikçe bunlar sabittir.
3. **§3'teki korkuluklar ihlal edilemez.** Bir görev korkulukla çelişiyorsa dur, kullanıcıya sor.
4. Her fazın sonunda **kabul kriterlerini** tek tek doğrula; geçmeyen kriter varken sonraki faza geçme.
5. Faz bitince §10'daki tabloyu güncelle (tarih + commit hash).
6. Belirsiz kaldığın her yerde: bu dokümanın ilgili bölümündeki gerekçeye dön; hâlâ belirsizse §9 Açık Sorular'a bak; orada da yoksa kullanıcıya sor — tahmin etme.
7. Proje kuralları geçerli: vanilla JS (framework yok), Almanca UI (DE/EN/TR i18n — dashboard.js sözlüğü), API anahtarı hardcode edilmez, e-posta = nodemailer+SMTP (Resend YASAK).

---

## 1. NEDEN BU GEÇİŞ? (özet gerekçe)

Praxura SaaS olarak hasta verisi (randevu, reçete, tanı, KVNR) işliyor. Bu, **§393 SGB V** gereği BSI **C5 Typ-2 testatı** zorunluluğu doğuruyor (Temmuz 2025'ten beri yürürlükte; maliyet köprü çözümle bile €15–40k, tam testatla €200k'ya kadar — mevcut bütçeyle karşılanamaz). Ayrıca DSGVO'da Auftragsverarbeiter rolü (AVV, DSFA, ihlal sorumluluğu) bizde.

**Çözüm:** Yazılım müşterinin kendi sunucusunda çalışırsa:
- §393 uygulanmaz (kanun yalnızca "Cloud-Computing-Dienste"yi kapsar),
- Auftragsverarbeiter rolü düşer (veriye erişimli Fernwartung olmadığı sürece),
- veri ihlali/yedek sorumluluğu müşteriye geçer.

**Değişmeyenler:** MDR konumlandırması (OCR = "Verwaltungstool ohne medizinische Zweckbestimmung"), EU AI Act Anbieter yükümlülükleri (Art. 6(3) non-high-risk gerekçesi yazılı olmalı), §302/ITSG Systemuntersuchung, kendi muhasebemiz için GoBD.

**Pazar doğrulaması:** Pazar lideri Theorg hâlâ on-prem (model kanıtlı); "verileriniz praxis'inizde, hiçbir bulutta değil" Almanya'da güçlü satış argümanı.

---

## 2. KİLİTLİ KARARLAR (yeniden tartışılmaz)

| # | Karar | Gerekçe (kısa) |
|---|---|---|
| K1 | **İki SKU:** "Praxura Lokal" (yeni ana ürün) + mevcut SaaS (beta müşterileri için yaşar, yeni satış on-prem'e) | SaaS şu an §393 açısından yasal açıkta; on-prem tek ödenebilir uyum yolu |
| K2 | **Supabase kaldırılmıyor, self-host ediliyor** — müşteri paketinin içinde görünmez bileşen; müşteri Supabase hesabı AÇMAZ | Açık kaynak (Apache-2.0); Auth+Realtime+PostgREST+RLS+Vault self-host'ta mevcut; kod değişikliği minimal. NOT: Kullanıcının "denemiştik olmamıştı" hatırası leaked-password Pro özelliğiydi (cloud Pro planı), self-host sorunu değil |
| K3 | **Merkezi sistem kalır (praxura.de):** müşteri kaydı, Stripe, lisans sunucusu, provisioning sayfası. **Hasta verisi asla girmez** → sadece normal B2B DSGVO; supabase.com cloud'da kalabilir | Kim ödedi/hangi plan bilgisi bizde olmalı; hasta verisi olmadığından C5/DSFA tetiklenmez |
| K4 | **AI: IONOS AI Model Hub, BYO-key** (müşterinin kendi IONOS hesabı/anahtarı). Azure yalnızca "zaten Azure'um var" istisnası için seçenek kalır | Azure'un vaktiyle seçilme sebebi IONOS'ta vision model olmamasıydı; artık LightOnOCR-2 + Mistral Small 24B (vision) var. IONOS: Alman şirket, OpenAI-uyumlu API, token başı ödeme, müşterilerin çoğu IONOS'u zaten tanıyor (eski 1&1) |
| K5 | **Kendi Azure/IONOS token'ımız pakete GÖMÜLMEZ** | Müşteri sunucusundaki her sır okunabilir → sızar → faturası bize keser |
| K6 | **Merkezi AI-proxy YAPILMAZ** (on-prem uygulama bizim gateway'imiz üzerinden AI'ya gitmez) | Reçete görüntüsü (hasta adı, KVNR) bizden geçerse o dilim için Auftragsverarbeiter + §393 kapsamına geri gireriz — geçişin amacını boşa çıkarır |
| K7 | **Rezept-Scan opsiyonel modül DEĞİL** — sihirbazda standart adım ("şimdi değil, sonra kur" çıkışıyla); satışta ana özellik | Ayırt edici özelliğimiz; "ek modül" konumlandırması satışı zayıflatır |
| K8 | **n8n on-prem pakete KONMAZ** | Sustainable Use License: ücretli müşteriye dağıtım yasak. n8n'e kalan akışlar Express route'a taşınır |
| K9 | **Lisans kill-switch = salt-okunur mod, tam kilit DEĞİL** | Hasta dokümantasyonuna erişim yasal zorunluluk; "iptal edersen verin rehin" Almanya'da satış zehiri |
| K10 | **Destek modeli: veriye uzak erişim YOK** — "Tanılama paketi indir → bize gönder" butonu; opsiyonel ekran-paylaşımlı seans (müşteri başında, veri erişimi yok) | Veriye erişimli Fernwartung = Auftragsverarbeiter rolü geri gelir |
| K11 | **Kanal sistemi:** `:beta` (her push otomatik, beta müşterileri) / `:stable` (yalnızca release'te, ücretli müşteriler). Tek codebase, fork yok | Beta feedback döngüsü (bugünkü "push = anında görürler") korunur; ücretliler denemelerden izole |
| K12 | **Beta müşteri planı 3 aşamalı:** (1) şimdilik mevcut SaaS'ta, değişiklik yok → (2) paket hazır olunca sponsor Hetzner instance'ları (biz öderiz, ~€6/müşteri/ay, `:beta` kanalı) → (3) ücretlendirme anında sunucu kendi Hetzner hesaplarına devredilir | Para almadığımız müşteriye sunucu ödetemeyiz; sponsor dönem migration+kurulum hattının gerçek testidir |
| K13 | **Fiyat iletişimi:** kalem kalem değil toplam — "€49/ay + ~€10 sunucu (kendi hesabınızda), veriniz %100 sizde". AI maliyeti sihirbazda tahminle gösterilir (~50 rezept ≈ €2/ay) | Kalem sayısı psikolojik yük; toplam + kıyas (Theorg/Optica daha pahalı) satışı kolaylaştırır |
| K14 | **Geçiş takvimi:** PoC şimdi → normal geliştirme "buluta yeni zincir ekleme" kuralıyla devam → paketleme sprinti ürün olgunlaşınca (para almadan önce) | Tam paralel çalışma tek kişilik ekipte özellik geliştirmeyi öldürür; sona bırakmak makası açar |

---

## 3. KORKULUKLAR (hiçbir görevde ihlal edilemez)

- 🚫 **G1:** Müşteri kutusundaki hasta verisi hiçbir koşulda bizim kontrolümüzdeki bir sisteme akmaz (lisans yenileme çağrısı dahil — o çağrı yalnızca lisans-ID + sürüm + imza taşır, başka hiçbir şey).
- 🚫 **G2:** Docker image'larına, git repo'ya veya kurulum paketine hiçbir gizli anahtar (bizim API anahtarlarımız, private key'ler) gömülmez. Lisans imzalama private key'i YALNIZCA merkezi lisans sunucusunda yaşar.
- 🚫 **G3:** n8n, on-prem compose stack'ine eklenmez (K8).
- 🚫 **G4:** On-prem pakette telemetri varsayılan KAPALI; açılması müşterinin sihirbazda açık onayına bağlı ve hasta verisi asla içermez (Sentry PII-scrub kuralları — `api-backend/instrument.js` — aynen taşınır).
- 🚫 **G5:** Kill-switch hiçbir aşamada veri görüntüleme + dışa aktarmayı engellemez (K9).
- 🚫 **G6:** MDR/AI Act metin disiplini: UI, doküman ve pazarlama metinlerinde "KI erkennt Diagnose", "optimiert Behandlungsplan", "klinische Entscheidungsunterstützung" tarzı ifadeler YASAK. Doğru dil: "Verwaltungstool zur Dateneingabe".
- 🚫 **G7:** SaaS tarafı bu geçiş sırasında bozulamaz — beta müşterileri orada yaşıyor. Şema değişiklikleri her iki dağıtımla uyumlu olmalı.
- 🚫 **G8:** Yeni özellikler bu dokümanın yürürlüğe girdiği andan itibaren buluta yeni zincir ekleyemez: yeni Vercel fonksiyonu yok (Express'e yaz), Supabase cloud-only özelliği yok, yeni üçüncü-parti CDN script'i yok.

---

## 4. HEDEF MİMARİ

### 4.1 Müşterinin kutusu (tek `docker compose` stack'i)

```
praxisadi.praxura.app  (DNS A-kaydı → müşterinin sunucu IP'si)
│
├── caddy              # reverse proxy + otomatik Let's Encrypt SSL
├── frontend           # mevcut HTML/CSS/JS (nginx veya caddy static)
├── api                # api-backend/server.js (Express) — Vercel fonksiyonlarının
│                      #   müşteriye ait olanları buraya taşınmış halde
├── supabase-*         # self-hosted Supabase: db (Postgres+Vault ext.),
│                      #   auth (GoTrue), rest (PostgREST), realtime, storage,
│                      #   (studio: bağlı ama dışa kapalı, sadece tanılama)
├── backup             # gecelik pg_dump → müşterinin Storage Box'ı / lokal hedef
└── watchtower         # kanal tag'inden (:beta | :stable) otomatik güncelleme
```

- Dış AI çağrıları: `api` → **müşterinin kendi IONOS anahtarıyla** IONOS AI Model Hub (Almanya). Bizden geçmez (K6).
- E-posta: `api` → müşterinin SMTP'si (sihirbazda yapılandırılır).
- Tek makine asgari: **2 vCPU / 4 GB RAM / 40 GB disk** (kurulum scripti ön-kontrol yapar, yetmiyorsa açıklayıp durur).

### 4.2 Merkezi sistem (bizde kalan, hasta verisi YOK)

```
praxura.de (Vercel + supabase.com kalabilir)
├── Pazarlama sitesi + fiyatlandırma
├── Stripe (checkout/webhook/portal — mevcut api/stripe/* yapısı)
├── Müşteri kayıt DB'si (kim, hangi plan, hangi instance)
├── Lisans sunucusu     # POST /license/renew — imzalı lisans üretir
├── Provisioning sayfası # /setup?lizenz=... — Hetzner API + DNS API zinciri
└── Private Docker registry erişim yönetimi (per-müşteri pull credential)
```

### 4.3 Kurulum akışı (müşteri deneyimi, hedef: ~30-40 dk, terminal YOK)

1. praxura.de'de plan seç + Stripe ödeme → mailine lisanslı kurulum linki.
2. Hetzner hesabı aç (resimli rehber) → Cloud API-Token oluştur → kurulum sayfasına yapıştır.
3. Provisioner otomatik: müşterinin hesabında sunucu (cloud-init) → IP → DNS A-kaydı (`praxisadi.praxura.app`) → Caddy SSL → "hazır" maili.
4. İlk-açılış sihirbazı (lokal, tarayıcıda): yönetici hesabı → işletme bilgileri (mevcut onboarding'in lokal versiyonu) → SMTP (hazır profiller: IONOS/GMX/T-Online/GoDaddy + "Test maili gönder" butonu) → yedek hedefi (önerilen: Hetzner Storage Box ~€4/ay, müşterinin hesabında) → IONOS AI anahtarı (standart adım, "sonra kur" çıkışlı, "örnek reçete tara" test butonu).

Alternatif yollar: **Yol B** "zaten sunucum var" (SSH bilgisi veya tek-komut kurulum; AB lokasyonu + asgari donanım ön-kontrolü) ve **Yol C** praxis-içi lokal makine (Faz 2 ürünü — bu playbook kapsamı DIŞI, lansmandan sonra).

---

## 5. MEVCUT DURUM ENVANTERİ (2026-07-06 itibarıyla)

Uygulayan model: dosya konumları değişmiş olabilir — göreve başlamadan doğrula.

| Bileşen | Bugünkü hali | Geçişteki kaderi |
|---|---|---|
| `api-backend/server.js` | Express, VPS'te Docker+Watchtower, ~3000+ satır | Paketin çekirdeği — büyük ölçüde hazır |
| `api-backend/ai/` (router.js, azureClient.js, tasks/*) | Azure OpenAI, env-var tabanlı, dry-run destekli, PII-mask'li | Provider-agnostik hale gelir; IONOS varsayılan (Faz 4) |
| `api-backend/billing/` (dta/, kostentraeger/, codes/) | DTA/EDIFACT üretimi; PKCS#7 imzalama zaten browser'da | Değişiklik YOK — on-prem'e doğal uyar |
| `api/` (Vercel fonksiyonları) | config, contact, dsgvo, demo-booking, stripe/*, onboarding/*, admin/* | Müşteriye ait olanlar Express'e taşınır (Faz 1); stripe/onboarding merkezde kalır |
| Supabase cloud (`njvuclullotbksskpwgk`) | Auth (magic link + Google OAuth), Postgres+RLS, Vault (Gmail/Calendar token'ları), Realtime (bookings) | Müşteri kutusunda self-hosted Supabase'e; merkez için ayrı hafif proje |
| Stripe | Plan gating `profiles.plan/plan_status/is_active` | Merkezde kalır; on-prem'de gating → lisans dosyası (Faz 3) |
| Google Calendar/Gmail OAuth | Bizim OAuth app, token'lar Vault'ta | On-prem v1'de DÜŞER (bkz. §9 A3); e-posta zaten SMTP'ye dönmüştü |
| n8n | Azure gateway + bazı webhook akışları (`N8N_WEBHOOK_URL`, `N8N_AI_SERIES_URL`) | Pakete girmez; kalan akışlar Express'e (Faz 1) |
| Sentry | Frontend+backend, PII-scrub'lı | On-prem'de opt-in telemetri veya lokal error-log (Faz 2) |
| SMTP (GoDaddy) | Booking mailleri nodemailer ile; Supabase auth mailleri de SMTP | Müşterinin SMTP'si; kod zaten agnostik |
| Cropperjs CDN (`dashboard.html`) | Cloudflare CDN'den | Lokale indirilir, paketle servis edilir (Faz 2) |
| CI/CD | GitHub Actions → GHCR → Watchtower | Aynı düzen + `:beta`/`:stable` tag'leri + private registry auth (Faz 3-4) |
| Multi-tenancy | Her tabloda `owner_id` + RLS | AYNEN KALIR — tek müşteride zararsız; tek codebase iki dağıtım |

---

### 5.1 Derin denetim bulguları (2026-07-06 — canlı DB + kod taraması)

Aşağıdakiler ilk envanterde eksikti; her biri fazlara işlendi:

| # | Bulgu | On-prem etkisi | Nerede ele alınıyor |
|---|---|---|---|
| D1 | **3 Supabase Edge Function** (`fahrtenbuch-geocode/route/matrix`, Deno) — **OpenRouteService (ORS)** API proxy'si; Fahrtenbuch/Hausbesuch mesafe hesabı. Frontend `dashboard.js` → `invokeFahrtenbuchFn()` (~5362) ile çağırıyor. Kaynak: `supabase/functions/`, spec: `Fahrtenbuch.md` | Edge function'lar Express route'a taşınmalı (self-host'ta Deno runtime taşımaya değmez; `invokeFahrtenbuchFn` zaten soyutlama noktası). **Dikkat: hasta ev adresleri ORS'a (dış API) gidiyor** — ORS key kimin olacak + DSGVO değerlendirmesi gerekli | Faz 1.5, §9-A8 |
| D2 | **`notify_feedback_telegram`** DB trigger fonksiyonu — `pg_net` ile `n8n.infinitymade.de/webhook/feedback-notify`'a POST atıyor (feedback → Telegram) | Müşteri DB'sinden bizim endpoint'e otomatik HTTP = G1'e aykırı görünüm. Feedback hasta verisi değil ve bize gelmesi isteniyor → trigger yerine Express'te açık "Feedback'i Praxura'ya gönder" çağrısına dönüştür (kullanıcının bilinçli eylemi) | Faz 1.6 |
| D3 | **5 Storage bucket:** `avatars` (public), `referrals`, `prescriptions`, `abrechnungen`, `patient-documents` (private, signed-URL). Reçete görselleri + §302 DTA dosyaları + hasta belgeleri burada | Self-host Storage (dosya backend) çalışır AMA **`pg_dump` storage dosyalarını YEDEKLEMEZ** — yedekleme storage volume'unu da kapsamalı | Faz 0.2, 2.3 |
| D4 | **PostGIS kurulu ve kullanımda** (`sync_leads_location`, `sync_profiles_clinic_location`; `businesses` koordinatları) + frontend **Nominatim/OSM** geocoding çağrısı (`dashboard.js` ~21301, tarayıcıdan) | Supabase postgres image PostGIS içerir → sorun değil, ama şema kurulumunda extension listesine dahil edilmeli. Nominatim tarayıcıdan işletme adresi gönderiyor (hasta verisi değil, düşük risk) — kullanım politikası (rate limit) not edilmeli | Faz 0.1 |
| D5 | **`delete_expired_accounts()` fonksiyonu var ama zamanlayıcısı YOK** (pg_cron kurulu değil, cron.job şeması yok, kodda çağıran yok) — iptal edilen hesapların 30-gün-sonra silinmesi muhtemelen hiç çalışmıyor (SaaS'ta da!) | On-prem'de node-cron ile zamanla; SaaS'ta da düzeltilmeli (bağımsız bug) | Faz 2.4 + SaaS fix |
| D6 | **Vault aktif: 8 secret** (`business_get_secret/save_secret`, gmail token RPC'leri) — pgsodium/supabase_vault extension'ına bağımlı | PoC 0.2'deki Vault doğrulaması ZORUNLU adım; migration scripti vault secret'larını da taşımalı (düz metin export ETME — yeniden şifrele) | Faz 0.2, 5.1 |
| D7 | **Ölü tablolar (2026-07-06, üç turda doğrulandı):** KESİN ÖLÜ = `user_credits`, `applications`, `accommodations`, `trip_plans`, `trip_history` + `business_lookup_for_twilio` RPC (kodda sıfır referans — `from()` çağrıları, string-literal listeler ve admin paneli dahil tarandı). **ÖLÜ OLMAYANLAR (ilk iki liste hatalıydı):** `leads` = HASTA KAYITLARI; `scraper_data` (dashboard aktif); `attendance` (server.js 8 route, GPS check-in altyapısı bilinçli saklanıyor); `vehicles`/`fahrten` (Fahrtenbuch); `chatbot_usage` (admin KPI `api/admin/data.js:67` + DSGVO export/delete listeleri `api/dsgvo.js`). ⚠️ DERS: tablo-ölülüğü kontrolünde string-literal referanslar da taranmalı (`dsgvo.js` tablo listeleri `from()` grep'ine yakalanmaz) | Yalnızca 5 kesin ölü migration/on-prem şeması dışı; SaaS'ta DROP ayrı ve acil olmayan karar. `chatbot_usage` on-prem şemasında kalır (DSGVO export kodu referans veriyor; boş durur) | Faz 5.1 |
| D8 | ✅ **ÇÖZÜLDÜ (2026-07-06):** `heilmittel_catalog`, `diagnosegruppen`, `icd10_titles` RLS kapalıydı (anon yazabiliyordu). Migration `enable_rls_reference_tables_readonly` uygulandı: RLS açık + salt-okunur policy (anon+authenticated SELECT); `spatial_ref_sys`'te yazma yetkileri REVOKE edildi. Doğrulandı: anon okuma çalışıyor, yazma engellendi. Client kodu bu tabloları yalnızca SELECT ile kullandığından hiçbir fonksiyon etkilenmedi | On-prem şemasına bu düzeltilmiş haliyle girer | Tamamlandı |

| D9 | **n8n otomasyon denetimi (2026-07-06):** kodda 2 canlı n8n bağımlılığı — (a) `N8N_WEBHOOK_URL` booking-create bildirimi (`server.js` ~1041, PII'siz, fire-and-forget; WhatsApp döneminden kalma, muhtemelen işlevsiz), (b) `N8N_AI_SERIES_URL` AI seri-randevu planlayıcı (`server.js` ~1567): aday slotları LLM'e sıralatıyor, **hasta ADI n8n'e gidiyor** (aiPayload.customer.name) — diğer webhook'un PII disiplinine aykırı; kodda deterministik fallback zaten var. + D2'deki feedback trigger'ı | (a) kaldır veya iç event yap; (b) `ai/tasks/series-schedule.js` olarak ai-router'a taşı (LLM çağrısı doğrudan, n8n'siz — fallback korunur; PII iyileştirmesi bonus); Faz 1.2 kapsamı netleşti. On-prem pakette n8n'e giden HİÇBİR çağrı kalmaz | Faz 1.2 |
| D10 | **Cyber Resilience Act (CRA):** on-prem model bizi §393'ten çıkarırken CRA'ya SOKAR (piyasaya sürülen lokal yazılım ürünü kapsam içinde; saf SaaS değildi). 11 Eyl 2026: aktif sömürülen açık bildirimi (24h/72h/14g); 11 Ara 2027: secure-by-design + SBOM + CE işareti. Praxis yazılımı Annex III/IV listelerinde değil → varsayılan kategori → öz-değerlendirme yeterli | CVD politikası + security@ adresi, SBOM build adımı (Faz 2), destek süresi beyanı (AGB), bildirim runbook'u. Detay: `LEGAL_ONPREM_REQUIREMENTS.md` §6 | Faz 2.1, 6.1, 6.3 |

Diğer doğrulanan noktalar: Realtime publication yalnızca `public.bookings` (beklenen); `on_auth_user_created` → `handle_new_user` trigger'ı (GoTrue self-host'ta çalışır); `heilmittel_tarif` (928), `dta_schluessel` (94), `icd10_titles` (13.041), `krankenkassen` (94) referans tabloları paket seed-data'sına girecek; toplam ~75 tablo.

---

## 6. FAZLAR

> Sıra bağlayıcıdır. Faz 0 tamamlanmadan hiçbir faza başlanmaz. Faz 1, K14 gereği normal özellik geliştirmeyle paralel yürüyebilir; Faz 2–6 "paketleme sprinti"dir.

### FAZ 0 — PoC: En büyük bilinmeyenleri cevapla (~2 hafta)

**Amaç:** Planın kritik varsayımlarını kanıtla; kanıtlanamayanı bu dokümana işle.

Görevler:
- [ ] 0.1 Self-hosted Supabase'i (resmi docker compose) lokalde ayağa kaldır; mevcut şemayı (migration'lar) içine yükle.
- [ ] 0.2 Doğrula: **Auth** (email/parola girişi; magic link SMTP ile), **RLS** politikaları, **Realtime** (bookings aboneliği — `refreshBookingViews` akışı), **PostgREST** (supabase-js frontend'i sadece URL/anon-key değişikliğiyle çalışıyor mu), **Vault/pgsodium** (token şifreleme RPC'leri: `set_gmail_token`, `business_get_secret/save_secret` — 8 canlı secret var, D6; Vault self-host'ta çalışmazsa alternatif: pgcrypto ile kendi şifreleme fonksiyonlarımız), **Storage** (5 bucket — D3: `avatars/referrals/prescriptions/abrechnungen/patient-documents`; signed-URL akışı `createSignedUrl` çalışıyor mu), **PostGIS** (extension yükleniyor mu — D4).
- [ ] 0.3 `api-backend/server.js`'i self-hosted Supabase'e bağla (`SUPABASE_URL` lokal); temel akışları uçtan uca test et: login → randevu oluştur → takvimde canlı görün → booking maili (test SMTP, örn. Mailpit container'ı).
- [ ] 0.4 Frontend'i lokal servis et (nginx/caddy container); `api/config.js`'in verdiği Supabase URL'sinin lokal muadilini kur.
- [ ] 0.5 **IONOS AI Model Hub testi:** hesap aç, LightOnOCR-2 ve Mistral Small 24B (vision) ile 3–5 gerçek(imsi) reçete fotoğrafı tarat; mevcut Azure çıktısıyla alan-alan karşılaştır (Heilmittel kodları, tarih, tanı). Token maliyetini ölç ve bu dokümanın §9-A1'ine gerçek rakamı yaz. IONOS Cloud'un C5 testat durumunu doğrula (§9-A2).
- [ ] 0.6 Tek `docker-compose.onprem.yml` taslağı: supabase + api + frontend + caddy tek komutla ayağa kalksın.

**Kabul kriterleri:**
- ✅ `docker compose up` → temiz makinede tam ürün; login, randevu CRUD, canlı takvim, e-posta çalışıyor.
- ✅ Frontend kodunda URL/config dışında değişiklik gerekmedi (gerekliyse liste çıkarıldı).
- ✅ IONOS OCR kalitesi Azure'a "yeterince yakın" (alan doğruluğu ≥ Azure'un %90'ı) VEYA fark dokümante edilip kullanıcıya karar soruldu.
- ✅ Vault/token-şifreleme yolu netleşti (Vault çalışıyor VEYA pgcrypto alternatifi seçildi ve yazıldı).
- ✅ Bulgular bu dokümana işlendi (§9 güncellendi).

**Bilinen risk/tuzaklar:** Supabase self-host'ta analytics/Logflare bileşenini KURMA (production için önerilmiyor, bize gereksiz). `docker compose` default'unda backup yok — Faz 2'de biz ekliyoruz. Windows'ta test ediyorsan Docker Desktop dosya-izin sürprizlerine dikkat; nihai hedef Linux.

---

### FAZ 1 — Mimari konsolidasyon (paralel yürüyebilir, ~2-4 hafta)

**Amaç:** Buluta zincirlenmiş parçaları tek Express çekirdeğine topla; makas açılmasını durdur (G8 yürürlüğe girer).

Görevler:
- [ ] 1.1 Vercel `api/` fonksiyonlarını sınıflandır: **müşteri-kutusuna gidecekler** (config, dsgvo-export, müşteri operasyonları) → Express route olarak `api-backend/server.js`'e (veya yeni `api-backend/routes/` modüllerine) taşı; **merkezde kalacaklar** (stripe/*, onboarding/pending, admin/*, contact, demo-booking) → dokunma.
- [ ] 1.2 n8n'e giden akışları Express içine taşı (D9 detayı): (a) `N8N_WEBHOOK_URL` booking bildirimi — işlevi kalmadıysa kaldır; (b) `N8N_AI_SERIES_URL` seri-planlayıcı → `ai/tasks/series-schedule.js` (llmClient üzerinden doğrudan; mevcut deterministik fallback ve `candidateByKey` doğrulaması aynen korunur; hasta adını prompt'a koyma — PII iyileştirmesi); (c) feedback-notify (D2). Sonunda `grep N8N_` sıfır sonuç vermeli. (SaaS'ta n8n şimdilik çalışmaya devam edebilir — taşınan kod her iki ortamda da çalışmalı.)
- [ ] 1.3 AI katmanını provider-agnostik yap: `ai/azureClient.js` → `ai/llmClient.js` (OpenAI-uyumlu genel istemci; `AI_PROVIDER=ionos|azure`, `AI_ENDPOINT`, `AI_API_KEY`, `AI_MODEL_TEXT`, `AI_MODEL_VISION` env-var'ları). Dry-run davranışı korunur. EU-region kontrolü provider-bazlı: Azure'da mevcut EU Data Boundary listesi, IONOS'ta hep Almanya.
- [ ] 1.4 CDN bağımlılıklarını lokale al (Cropperjs → `vendor/` klasörü); HTML'lerde üçüncü-parti script kalmadığını doğrula (Sentry loader hariç — o Faz 2'de koşullu olacak).
- [ ] 1.5 **Edge function'ları Express'e taşı (D1):** `supabase/functions/fahrtenbuch-{geocode,route,matrix}` → `api-backend/routes/fahrtenbuch.js`; frontend'te yalnızca `invokeFahrtenbuchFn()` helper'ı değişir. ORS anahtarı env-var (`ORS_API_KEY`) — kimin anahtarı olacağı §9-A8 kararına bağlı.
- [ ] 1.6 **`notify_feedback_telegram` trigger'ını kaldır (D2):** feedback bildirimi DB trigger'ı + pg_net yerine Express'te, feedback formunun submit'inde açık API çağrısına dönüşsün (on-prem'de "Praxura'ya gönder" onay metniyle). SaaS'ta davranış aynı kalır.

**Kabul kriterleri:**
- ✅ SaaS production'da regresyon yok (mevcut QA crawler `qa_crawl_prod.py` production'da PASS).
- ✅ Kodda `N8N_` referansı kalmadı (veya yalnızca merkez-tarafı, dokümante).
- ✅ `AI_PROVIDER=azure` ile mevcut davranış birebir; `AI_PROVIDER=ionos` ile PoC testleri geçiyor.

---

### FAZ 2 — On-prem paketi (~3-4 hafta)

**Amaç:** Müşteriye giden, kendi kendine yeten kurulum paketi.

Görevler:
- [ ] 2.0 **Paket içeriği ayrımı:** pazarlama sayfaları (index.html, *-stadt.html, pakete/, SEO sayfaları) on-prem paketine GİRMEZ — bunlardaki linkler `app.praxura.de`'ye mutlak (PoC'de doğrulandı: lokal landing'in Login'i internete götürür). Paketin kök adresi doğrudan login/dashboard'a gitmeli.
- [ ] 2.1 `onprem/` klasörü: `docker-compose.yml` (Faz 0 taslağının üretim hali: caddy, frontend, api, supabase servisleri, backup, watchtower), `.env.template`, kurulum scripti (`install.sh`: donanım ön-kontrolü — 2 vCPU/4GB/40GB + AB-lokasyon uyarısı, Docker kurulumu, compose up).
- [ ] 2.2 **İlk-açılış sihirbazı** (lokal web sayfası; mevcut `onboarding.html`'den türet): yönetici hesabı → işletme bilgileri → SMTP (hazır profiller: IONOS/GMX/T-Online/GoDaddy/Ionos-mail + host/port otomatik; "Test maili gönder" butonu) → yedek hedefi → IONOS AI anahtarı (test butonu: örnek görüntüyle OCR çağrısı; "sonra kur" çıkışı). Sihirbaz tamamlanana kadar uygulama kurulum modunda kalır.
- [ ] 2.3 **Yedekleme:** gecelik `pg_dump` **+ storage volume arşivi** (D3 — reçete görselleri/DTA dosyaları/hasta belgeleri pg_dump'a girmez, ikisi birlikte tek yedek seti olmalı); hedefler: Hetzner Storage Box (SFTP/rclone), lokal dizin/NAS. Saklama: 14 günlük + 12 aylık rotasyon. Panelde "son yedek: X" göstergesi + başarısızlıkta panel uyarısı. Geri-yükleme scripti (`restore.sh`) ve test talimatı.
- [ ] 2.4a **Zamanlanmış işler (D5):** `delete_expired_accounts()` ve benzeri periyodik işler için pakette node-cron zamanlayıcısı (pg_cron'a bağımlı olma — self-host'ta ekstra kurulum). NOT: SaaS'ta bu fonksiyonun zamanlayıcısı YOK — bağımsız bug olarak SaaS'ta da düzelt.
- [ ] 2.4 **Healthcheck:** `GET /health` (DB, auth, realtime, disk doluluk) + kurulum/update sonrası self-check; panelde durum sayfası.
- [ ] 2.5 **Tanılama paketi:** panelde buton → PII içermeyen log/config özeti (`docker logs` son N satır PII-mask'ten geçirilmiş, sürümler, healthcheck çıktısı) tek arşiv dosyası olarak indirilir (K10).
- [ ] 2.6 **Telemetri:** Sentry opt-in (sihirbazda kapalı-varsayılan onay kutusu); kapalıysa lokal `error_logs` tablosuna yaz.
- [ ] 2.7 Auth e-postaları: self-hosted GoTrue'nun SMTP ayarları sihirbazdaki SMTP'den beslensin (tek ayar iki işi görür).
- [ ] 2.8 Google Calendar/Gmail OAuth kodunu on-prem build'de devre dışı bırak (feature flag) — v1'de yok (§9-A3).

**Kabul kriterleri:**
- ✅ Temiz Ubuntu 24.04 makinede: `install.sh` → sihirbaz → çalışan ürün, hiçbir manuel adım olmadan.
- ✅ Yedek al → veritabanını sil → `restore.sh` → veri eksiksiz geri geldi (gerçekten test et, varsayma).
- ✅ Docker smoke-test dersi uygulandı: image **gerçek CMD'siyle** `docker run --rm` test edildi (npx/npm run ile DEĞİL — geçmişte prod crash-loop yaşandı).
- ✅ Sihirbaz üç dilde (DE/EN/TR) — dashboard.js i18n sözlüğü düzenine uygun; Almanca ana dil.

---

### FAZ 3 — Lisans sistemi + kill-switch (~2 hafta)

**Amaç:** Stripe-gating'in yerine imzalı lisans; ödeme kesilince kademeli kısıtlama.

Tasarım (kilitli):
- Lisans = JSON (müşteri-ID, plan, modüller, `valid_until` = üretimden +30 gün, instance parmak izi opsiyonel) + **Ed25519 imza**. Public key uygulamaya gömülü; **private key YALNIZCA merkezi lisans sunucusunda** (G2).
- Müşteri kutusu her gece `POST api.praxura.de/license/renew` çağırır — istek yalnızca lisans-ID + mevcut sürüm taşır (G1). Merkez, Stripe aboneliği aktifse yeni 30-günlük imzalı lisans döner.
- Ödeme kesilirse: yenileme reddedilir → `valid_until`'e kadar panelde uyarı ("Zahlung aktualisieren, X Tage verbleibend") → doluşta +14 gün tolerans (uyarı sürer) → sonra **salt-okunur mod**: yeni randevu/abrechnung/AI kapalı; görüntüleme + DSGVO-export AÇIK (G5). Ödeme dönünce ilk yenilemede tam moda döner.
- İnternet kesintisi ceza değildir: 30 günlük imza penceresi sayesinde gecelik çağrının başarısız olması tek başına hiçbir kısıt tetiklemez.
- Private registry: müşteri kutusunun image çekme kimliği lisansa bağlı (lisans pasifse update çekemez). Korsanlık felsefesi: DRM değil — sahte lisans üretilemez (imza), korsan kopya güncelleme alamaz, güncellemesiz abrechnung yazılımı Almanya'da yaşayamaz (Kostenträger/ITSG sürümleri sürekli değişir).

Görevler:
- [ ] 3.1 Merkez: lisans üretim + `/license/renew` endpoint'i (Stripe subscription status kontrolü; mevcut `api/stripe/webhook.js` altyapısına bağlanır).
- [ ] 3.2 Kutu: lisans doğrulama modülü (imza + tarih), gecelik yenileme cron'u, durum makinesi (aktif → uyarı → tolerans → salt-okunur), panel banner'ları (3 dilde).
- [ ] 3.2a **E-posta Mahnung (hukuki zorunluluk — `LEGAL_ONPREM_REQUIREMENTS.md` §4):** yalnızca panel uyarısı YETMEZ; merkez, tolerans başlangıcında ve bitişten 7 gün önce müşterinin kayıtlı e-postasına Mahnung gönderir. Sperrklausel AGB'de şeffaf tanımlanmadan kill-switch canlıya ALINMAZ (Alman içtihadı: gizli/orantısız kilit geçersiz + hukuka aykırı tehdit riski).
- [ ] 3.3 Mevcut plan-gating noktalarını (`profiles.plan`, `is_active` kontrolleri) tek bir `entitlements` helper'ına topla; SaaS'ta Stripe'tan, on-prem'de lisanstan beslensin.
- [ ] 3.4 GHCR/registry per-müşteri pull-credential üretimi + iptali.

**Kabul kriterleri:**
- ✅ Süresi geçmiş/imzası bozuk lisansla salt-okunur mod; veri görüntüleme + export çalışıyor (G5 testi).
- ✅ 30 gün internetsiz simülasyonda uygulama tam çalışıyor; 45. günde (30+14 sonrası) salt-okunur.
- ✅ Ödeme geri gelince tek yenileme çağrısıyla tam mod.
- ✅ Lisans private key'i repo'da/image'da YOK (grep + image inspect ile doğrula).

---

### FAZ 4 — Provisioning otomasyonu (~2-3 hafta)

**Amaç:** Müşteri başına sıfır manuel işle kurulum.

Görevler:
- [ ] 4.1 Merkez: `/setup?lizenz=...` sayfası (Hetzner API-Token kutusu + resimli rehber). Token tek kullanımlık: sunucu oluşturulduktan sonra saklanmaz, silindiği loglanır.
- [ ] 4.2 Provisioner servisi: Hetzner Cloud API → müşterinin hesabında sunucu (Ubuntu + cloud-init: Docker, compose, paket, lisans dosyası gömülü) → IP döner → DNS API (Cloudflare vb.) ile `praxisadi.praxura.app` A-kaydı → hazır-maili. Hata durumlarında anlaşılır mesaj + yeniden deneme.
- [ ] 4.3 Kanal sistemi: GitHub Actions `:beta` (her main push) + `:stable` (yalnızca release tag'i) yayınlar; Watchtower kanal tag'ini izler. Release süreci dokümante (CHANGELOG, migration notları).
- [ ] 4.4 Yol B ("zaten sunucum var"): tek-komut kurulum (`curl ... | bash` yerine indirilen imzalı script önerilir) + ön-kontroller.
- [ ] 4.5 Alan adı: `praxura.app` (veya seçilecek domain) alınır; DNS API entegrasyonu; wildcard DEĞİL — müşteri başına explicit kayıt.

**Kabul kriterleri:**
- ✅ Uçtan uca canlı test: test Hetzner hesabıyla ödeme→link→token→~15 dk içinde `test-praxis.praxura.app`'te SSL'li çalışan ürün.
- ✅ Provisioner müşteri token'ını kalıcı saklamıyor (kod incelemesi + log doğrulaması).
- ✅ `:beta` kanalındaki instance, main'e push'tan ≤5 dk sonra güncelleniyor; `:stable` etkilenmiyor.

---

### FAZ 5 — Migration araçları + beta geçişi (~2 hafta)

**Amaç:** Mevcut SaaS tenant'larını kutulara taşı.

Görevler:
- [ ] 5.1 **Tenant export scripti:** Supabase cloud'dan tek bir `owner_id`'nin TÜM verisini (profiles, bookings, services, businesses, prescriptions, billing kayıtları, **5 bucket'taki storage dosyaları**, **vault secret'ları — düz metin export etme, hedefte yeniden şifrele (D6)** — şemadan tam liste çıkar) tutarlı şekilde çek (FK sırasına dikkat) → taşınabilir arşiv. **Ölü tabloları taşıma (D7, doğrulanmış liste):** yalnızca `user_credits`, `applications`, `accommodations`, `trip_plans`, `trip_history` kapsam dışı. `leads` (hasta kayıtları!), `scraper_data`, `attendance`, `vehicles`, `fahrten`, `chatbot_usage` (DSGVO kodu referanslı) TAŞINIR/şemada kalır. Export kapsamı `api/dsgvo.js`'teki USER_TABLES listesiyle çapraz doğrulanmalı. Referans tabloları (`heilmittel_tarif`, `dta_schluessel`, `icd10_titles`, `krankenkassen`, `heilmittel_catalog`, `diagnosegruppen`, `kostentraeger`, `heilmittel_position`) tenant-verisi değil → paket seed-data'sından gelir, export'a girmez.
- [ ] 5.2 **Import scripti:** arşivi on-prem Postgres'e yükle; auth kullanıcılarını yeniden oluştur (parola sıfırlama maili akışıyla); doğrulama raporu (satır sayıları kaynak=hedef).
- [ ] 5.3 Beta müşterileri için sponsor instance'lar (K12): bizim ödediğimiz Hetzner sunucuları, `:beta` kanalı; her müşteri için export→import→müşteriyle birlikte doğrulama.
- [ ] 5.4 Eski SaaS erişimini müşteri bazında kapatma prosedürü (yönlendirme sayfası + veri silme takvimi, DSGVO-uyumlu).

**Kabul kriterleri:**
- ✅ Bir test tenant'ı uçtan uca taşındı; satır sayıları ve örnek kayıtlar birebir; kullanıcı login olabildi.
- ✅ En az bir gerçek beta müşterisi sponsor instance'da sorunsuz 2 hafta geçirdi.

---

### FAZ 6 — Go-live hazırlığı (~1-2 hafta, hukuki kalemler paralel başlatılabilir)

Görevler:
- [ ] 6.1 Hukuki evrak seti — **içerik iskeletleri hazır: `LEGAL_ONPREM_REQUIREMENTS.md`** (E1-E11 listesi: AGB/Softwaremietvertrag, Sperrklausel, Fernwartungs-AVV şablonu, Datenschutzerklärung güncellemesi, open-source NOTICE, CRA dokümanları). Avukat brifing paketi aynı dosyanın §7'sinde. Healthcare-IT avukatı nihai metinleri yazar (€1.500–3.000).
- [ ] 6.1a CRA hazırlığı (D10): CVD politikası + security@praxura.de + SBOM build adımı + bildirim runbook'u. Bildirim yükümlülüğü 11 Eylül 2026'da başlıyor — go-live'dan bağımsız takvim!
- [ ] 6.2 Fiyatlandırma sayfası (K13 diliyle) + "So funktioniert's" kurulum sayfası + resimli Hetzner/IONOS rehberleri.
- [ ] 6.3 EU AI Act Art. 6(3) non-high-risk gerekçe dokümanı (yazılı, kayıtlı) + MDR metin taraması (G6 ihlali var mı — tüm UI/pazarlama).
- [ ] 6.4 Destek runbook'u: tanılama paketi nasıl okunur, en olası 10 arıza + çözümü.
- [ ] 6.5 `TODO.md` §2 (Launch-Checkliste) ile çapraz kontrol; `CLAUDE.md`'yi yeni mimariye göre güncelle.

**Kabul kriterleri:** hepsi tamam + kullanıcının son onayı.

---

## 7. TEST STRATEJİSİ (tüm fazlarda geçerli)

1. **Lokal:** `docker compose up` = gerçek ürün; geliştirme testinin ana yolu artık bu (SaaS'taki "production'da test" zorunluluğu on-prem pakette geçersiz).
2. **Staging:** bir Hetzner test sunucusu `:beta` kanalında "sahte müşteri" olarak yaşar; Playwright/QA crawler oraya koşar.
3. **Release:** `:stable` tag'i yalnızca staging'de yeşil + smoke-test (gerçek CMD ile `docker run`) sonrası basılır.
4. SaaS regresyonu: Faz 1-2 boyunca her değişiklikten sonra `qa_crawl_prod.py` production'da (G7).

---

## 8. MALİYET ÖZETİ

| Taraf | Kalem | Tutar |
|---|---|---|
| Müşteri | Hetzner sunucu (CX22 sınıfı) | ~€6/ay |
| Müşteri | Storage Box (yedek) | ~€4/ay |
| Müşteri | IONOS AI kullanımı | ~€2–5/ay (kullanıma göre; PoC'de doğrulanacak) |
| Müşteri | Praxura lisansı | mevcut plan fiyatları (€29/49/99) |
| Biz | Beta sponsor sunucuları (geçici) | ~€6 × müşteri sayısı/ay |
| Biz | Merkez (Vercel+Supabase küçük ölçek+domain) | mevcut düzeyde |
| Biz | Geliştirme eforu | ~2,5–4 ay (Faz 0–6 toplamı) |
| Biz | DÜŞEN kalem | C5/ISO 27001 (€15–200k) — uygulanmaz hale gelir |

---

## 9. AÇIK SORULAR (uygulama sırasında cevaplanacak)

- **A1 — IONOS token fiyatları:** Herkese açık net liste yok; PoC'de (0.5) gerçek reçete taramasıyla ölç, buraya yaz. Kabul eşiği: reçete başına ≤ €0,10.
- **A2 — IONOS Cloud C5 durumu:** IONOS'un cloud altyapısının C5 testatı PoC'de doğrulanacak. Varsa: "IONOS VPS + IONOS AI = tek fatura" varyantı (Yol A'ya alternatif provisioner) değerlendirilir — kalem-korkusu çözümü.
- **A3 — Google Calendar sync'in geleceği:** v1'de yok (lokal kurulumda public OAuth redirect sorunu + token yönetimi). Talep gelirse seçenekler: müşterinin kendi Google OAuth app'i, CalDAV/ICS-feed, cihaz-akışı. Kullanıcı kararı gerekir.
- **A4 — Vault self-host:** PoC 0.2'de doğrulanacak; çalışmazsa pgcrypto tabanlı şifreleme fonksiyonlarına geçilir (karar PoC'de).
- **A5 — Alan adı:** `praxura.app` müsaitliği/alternatifi — kullanıcıyla birlikte seçilecek.
- **A6 — SaaS'ın uzun vadesi:** On-prem oturunca SaaS tamamen kapanır mı, yoksa ISO 27001 alınıp premium "managed" seçenek olarak mı kalır? Gelire bağlı, ileride kullanıcı kararı.
- **A8 — ORS (OpenRouteService) anahtarı (D1):** Fahrtenbuch geocoding/routing'de hasta ev adresleri ORS'a gidiyor. Seçenekler: (a) müşterinin kendi ücretsiz ORS anahtarı (sihirbaza adım ekle — 2000 istek/gün ücretsiz), (b) bizim anahtarımız Express'te → adres bizim üzerimizden geçmese de anahtar paylaşımı/kota sorunu, (c) OSRM/Valhalla self-host (ağır). Öneri: (a). DSGVO notu: ev adresi kişisel veri — hangi seçenekte de sihirbazda şeffaflık metni gerekli. Kullanıcı kararı bekliyor.
- **A9 — Ölü tablo temizliği (D7):** ~~teyit bekliyor~~ 2026-07-06 üç turda doğrulandı: gerçek ölüler = `user_credits`, `applications`, `accommodations`, `trip_plans`, `trip_history` (chatbot_usage HARİÇ — admin KPI + DSGVO kodu kullanıyor). On-prem şemasına girmezler. SaaS'tan DROP etmek ayrı ve acil olmayan karar.
- **A7 — §302/ITSG süreci:** Deployment'tan bağımsız yürür (ITSG kaydı, Systemuntersuchung, gerçek Kostenträgerdatei) — ayrı iş kalemi, bu playbook'un kapsamı dışında ama go-live öncesi zorunlu (bkz. `REGULATORY_AUDIT.md` Landmine 5).

---

## 10. DURUM TAKİBİ

| Faz | Durum | Tarih | Commit/Not |
|---|---|---|---|
| 0 — PoC | 🟡 0.1+0.1b+0.2 TAMAM | 2026-07-06 | Stack AYAKTA (11/11 healthy) + **CANLI ŞEMA BİREBİR YÜKLÜ:** pg_dump (pooler `aws-0-eu-west-1`, PG 17.6=17.6) → parite: 71=71 tablo, 136=136 RLS policy, 988=988 fonksiyon; referans verisi sıfır hatayla (icd10=13.041, tarif=928, kk=94); dump dosyaları `onprem/schema/`. Uçtan uca API testleri: anon ICD okuma ✅, bookings RLS bloğu ✅, referans-tablo yazma 401 ✅ (D8 fix'i dump'la geldi), `no_overlapping_bookings` EXCLUDE constraint ✅, Vault yaz/oku ✅ (D6/A4 ÇÖZÜLDÜ), Auth signup+JWT ✅, Storage bucket ✅, realtime publication bookings eklendi. ⚠️ NOTLAR: (1) proje AWS **eu-west-1 (İrlanda)**, Frankfurt DEĞİL — REGULATORY_AUDIT'teki varsayım yanlıştı (yine AB, DSGVO OK); (2) şema yüklemeden önce extension'lar kurulmalı (DROP SCHEMA public CASCADE postgis'i de siler — install script sırası!); (3) DB şifresi chat'te paylaşıldı → PoC bitince ROTATE ET. Yükleme sırası: extensions → schema → NOTIFY pgrst reload. **0.3 TAMAM:** server.js lokal stack'e bağlı çalıştı (`.env.poc`, PORT=3010, dummy GOOGLE_* — Google env'leri boot'ta zorunlu, Faz 2.8 opsiyonelleştirecek); E2E: signup→handle_new_user trigger'ı profil oluşturdu (trigger auth şemasında, public dump'a girmez — kurulumda ayrıca CREATE edilmeli!), get-slots 16 slot döndü, çakışan booking 23P01 ile reddedildi (TZ dönüşümü doğru), slot listesi güncellendi. **0.4 TAMAM (curl):** `onprem/poc-frontend-server.mjs` statik + /api/config lokal muadili; index/login/dashboard 200. **Tarayıcı testi KULLANICI TARAFINDAN GEÇİLDİ (2026-07-06):** login → dashboard → takvim/randevular lokal stack'ten çalışıyor ("her şey çalışıyor"). KALAN: 0.5 IONOS (kullanıcı hesabı) + 0.6 compose taslağı. Not: api-backend node_modules güncel değildi (nodemailer eksikti) → npm install |
| 1 — Konsolidasyon | ⬜ başlamadı | | |
| 2 — Paket | ⬜ başlamadı | | |
| 3 — Lisans | ⬜ başlamadı | | |
| 4 — Provisioning | ⬜ başlamadı | | |
| 5 — Migration | ⬜ başlamadı | | |
| 6 — Go-live | ⬜ başlamadı | | |

G8 kuralı (buluta yeni zincir yok) yürürlük tarihi: ⬜ (Faz 1 başlangıcında işaretle)

---

## 11. KAYNAKLAR

### Regülasyon — §393 SGB V / C5
- Rödl & Partner — C5-Testatpflicht nach §393 SGB V: https://www.roedl.com/insights/c5-testatpflicht-nach-paragraph-393-sgb-v/
- activeMind — Datenverarbeitende Stelle nach §393 SGB V: https://www.activemind.de/magazin/c5-datenverarbeitende-stelle/
- SRD Rechtsanwälte — Cloud im Gesundheitswesen: https://www.srd-rechtsanwaelte.de/blog/cloud-nutzung-im-gesundheitswesen-393-sgb-v-und-c5-testat
- BVMed Infoblatt C5/§393: https://www.bvmed.de/themen/recht/infoseite-c5-testat-393-sgb-v-cloud-einsatz-im-gesundheitswesen
- Kanun metni: https://www.gesetze-im-internet.de/sgb_5/__393.html
- Hetzner BSI C5-Testat duyurusu (Aralık 2025): https://www.hetzner.com/de/news/hetzner-receives-bsi-c5-certification/

### Regülasyon — DSGVO / Auftragsverarbeiter / Fernwartung
- digital-recht.at — Softwareanbieter & AVV: https://www.digital-recht.at/blog/muessen-softwareanbieter-einen-dsgvo-auftragsverarbeitervertrag-abschliessen
- regina-stoiber.com — Wann Auftragsverarbeiter?: https://regina-stoiber.com/2018/04/12/wann-handelt-es-sich-um-einen-auftragsverarbeiter-auftragsdatenverarbeiter-dsgvo/
- Bayerischer LfD — Orientierungshilfe Auftragsverarbeitung (PDF): https://www.datenschutz-bayern.de/technik/orient/oh_auftragsverarbeitung.pdf

### Regülasyon — EU AI Act / MDR
- Provider vs. Deployer rol rehberi: https://ai-risk-check.com/ratgeber/provider-oder-deployer
- Art. 50 şeffaflık yükümlülükleri: https://artificialintelligenceact.eu/article/50/
- AI Act compliance checker: https://artificialintelligenceact.eu/assessment/eu-ai-act-compliance-checker/

### Regülasyon — §302 / ITSG
- ITSG Systemuntersuchung: https://www.itsg.de/produkte/systemuntersuchung/
- dakota Modul für Software-Ersteller: https://www.itsg.de/produkte/dakota-ag-dakota-le/
- GKV-Datenaustausch (sonstige Leistungserbringer): https://www.gkv-datenaustausch.de/

### Teknik — Supabase self-hosting
- Resmi self-hosting rehberi: https://supabase.com/docs/guides/self-hosting
- Docker compose kurulumu: https://supabase.com/docs/guides/self-hosting/docker
- Topluluk deneyimi (neler çalışıyor): https://github.com/orgs/supabase/discussions/39820
- 2026 sınırlamalar değerlendirmesi: https://queryglow.com/blog/supabase-self-hosted

### Teknik — IONOS AI Model Hub
- Ürün sayfası: https://cloud.ionos.com/managed/ai-model-hub
- Model kataloğu (OCR/vision dahil): https://docs.ionos.com/cloud/ai/ai-model-hub/models
- OpenAI-uyumlu API referansı: https://api.ionos.com/docs/inference-openai/v1/
- Multimodal platform duyurusu: https://www.ionos.de/newsroom/news/ionos-startet-erste-deutsche-multimodale-ki-plattform/

### Pazar
- Physio yazılım karşılaştırması 2026 (Theorg on-prem, Optica Viva/MD Therapie cloud): https://fitprotools.de/physiotherapie-software/

### Repo içi
- `ON_PREMISE_ANALYSE.md` — regülasyon analizi (bu playbook'un temeli)
- `REGULATORY_AUDIT.md` — SaaS landmine audit'i (Haziran 2026)
- `INFRASTRUCTURE.md` — mevcut VPS/deploy düzeni
- `TODO.md` §2 (Launch-Checkliste) — go-live çapraz kontrol

---

*Son güncelleme: 2026-07-06 — Claude Fable 5. Bu doküman canlıdır: her faz sonunda §9 ve §10 güncellenir.*
