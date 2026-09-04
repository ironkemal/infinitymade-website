# ON-PREM SİCİLİ — bulut bağımlılıkları kaydı

> **Bu dosya nedir:** Praxura'nın buluta zincirlenmiş her parçasının kaydı. Neyin çözüldüğü,
> neyin bilinçli olarak merkezde kaldığı, neyin hâlâ açık olduğu. Sahibi: `onprem` ajanı.
>
> **Niye var:** `ONPREM_MIGRATION_PLAYBOOK.md` 2026-07-06'da yazıldı ve G8 ("buluta yeni
> zincir eklenmez") onunla geldi. Buna rağmen `module/` altında **sonradan** açılan dört
> dosya `https://n8n.infinitymade.de/api` adresini kodun içine gömdü. Playbook plan tutar;
> kod yazılırken kimse plan okumaz. Bu sicil o boşluğa duruyor.
>
> **Kurallar:** `unkritisch` ve `widerlegt` maddeler **silinmez** — "bu bize niye sorun
> değil" cevabı yazılmazsa altı ay sonra üçüncü kez araştırılır. Numaralar yeniden
> kullanılmaz. Depo public: sır, gerçek anahtar, hasta verisi, beta müşteri adı girmez.

**İlk tarama:** 2026-09-04 · **Kaynak:** `ONPREM_MIGRATION_PLAYBOOK.md` (K1-K14, G1-G8, Faz 0-6)

## Taksonomi kısaltmaları

| Tip | Anlamı |
|---|---|
| A | Runtime dış çağrı (kutu çalışırken dışarı çıkıyor) |
| B | Build-zamanı dış çağrı (merkez çeker, koda/image'a gömer) — **tercih edilen desen** |
| C | Sabit adres (kodda gömülü host) |
| D | Şema değişikliği |
| E | Sır (env var bizim anahtarımızı taşıyor) |
| F | Zamanlanmış iş (cron / trigger / Actions) |
| G | Merkez mi kutu mu |
| H | Yetkilendirme (plan/limit/lisans) |

**Durum değerleri:** `offen` · `geplant` (faz no.) · `gelöst` (commit) · `unkritisch` · `widerlegt`

---

## 1. Sabit adresler (tip C)

### O-01 — `n8n.infinitymade.de/api` frontend'in API tabanı olarak koda gömülü

| Alan | İçerik |
|---|---|
| **Ne** | Backend'in adresi 12 frontend dosyasında sabit yazılı; kutuda müşterinin tarayıcısı bizim VPS'imize gider |
| **Nerede** | **26 satır / 13 dosya** (kapı kapsamı: `*.js` `*.html` `*.mjs`; `archive/` `vendor/` `funktionen/` `onprem/` `.claude/` `index-old.html` `ai chatbot proje/` hariç).<br>`dashboard.js` 9 (`:86` `:6059` `:6566` `:6567` `:11900` `:11908` `:12046` `:12184` `:17951`) · `kalender.js` 5 (`:114` `:242` `:459` `:619` `:765`) · `employee-signup.js` 2 (`:116` `:261`) · `booking-request.js` 2 (`:4` yorum, `:11`) · `module/abrechnungsstatus.js:50` · `module/podologie-positionen.js:39` · `module/podologie-abrechnung.js:407` · `module/beleg-druck.js:11` (yorum) · `booking.js:5` · `attendance.js:4` · `index.html:2179` (chatbot DATA bloğu, pazarlama) · `api-backend/server.js:1806` (bkz. O-02) |
| **Tip** | C |
| **Kutuda ne olur** | Müşterinin kutusundaki dashboard açılır, ama her randevu/rezept/abrechnung çağrısı **bizim** VPS'imize gider. Bizim VPS'imiz kapalıysa müşterinin praxis'i durur. Daha kötüsü: kutudaki hasta verisi bizim sunucumuza akar → **G1 ihlali**, geçişin bütün amacı boşa çıkar. Müşteri kendi Supabase'inde oturum açtığı için JWT bizim backend'de doğrulanmaz — pratikte 401 duvarı |
| **Çözüm** | Tek `API_BASE` kaynağı: `/api/config`'in verdiği değer (bugün Supabase URL'i için zaten yapılan şey — bkz. O-05). Kutuda `window.location.origin + '/api'`, SaaS'ta bugünkü host. Fork değil, tek config satırı. **Faz 1.1** kapsamına bağlandı; paketleme öncesi **Faz 2.0** ile kesişir |
| **Durum** | `geplant` (Faz 1.1) — kapı tabanı: **26** |

> ⚠️ `dashboard.js:83-86` doğru deseni **zaten biliyor**: `localhost` ise `http://localhost:3000/api`,
> değilse sabit host. Yani "adres değişkendir" fikri kodda var, ama üçüncü ihtimal (müşterinin
> kendi domain'i) yok. Diğer 12 dosya bu ternary'yi bile kullanmıyor, düz sabit yazıyor.
> `module/` altındaki dördü playbook'tan **sonra** yazıldı — bu sicilin var oluş sebebi.

### O-02 — `N8N_AI_SERIES_URL` fallback'i koda gömülü n8n adresi

| Alan | İçerik |
|---|---|
| **Ne** | AI seri-planlayıcı env var yoksa sabit n8n webhook'una düşüyor |
| **Nerede** | `api-backend/server.js:1806` — `process.env.N8N_AI_SERIES_URL` yoksa `https://n8n.infinitymade.de/webhook/ai-series-scheduler` |
| **Tip** | C + A (fallback runtime dış çağrı) |
| **Kutuda ne olur** | Müşteri env'inde `N8N_AI_SERIES_URL` olmayacak → fallback devreye girer → kutu bizim n8n'imize POST atar. Playbook D9'a göre bu çağrı **hasta adını taşıyor** (`aiPayload.customer.name`) → G1 ihlali. Deterministik fallback kodda var ama bu satır ona düşmeden önce ağa çıkıyor |
| **Çözüm** | **Faz 1.2** — `ai/tasks/series-schedule.js` olarak llmClient üzerinden doğrudan; n8n aradan çıkar, hasta adı prompt'a girmez. Kabul kriteri zaten yazılı: `grep N8N_` → sıfır |
| **Durum** | `geplant` (Faz 1.2) |

### O-03 — `app.praxura.de` uygulama kodunda sabit (pazarlama sayfaları hariç)

| Alan | İçerik |
|---|---|
| **Ne** | Login yönlendirmesi, paylaşım linkleri, OAuth redirect'leri ve auth mail redirect'leri merkez domain'e sabitlenmiş |
| **Nerede** | **19 satır / 5 dosya** (app yüzeyi): `api-backend/server.js` 10 (`:48` CORS · `:342` `:364` `:379` `:382` OAuth redirect · `:2788` auth mail redirect · `:3974` booking-request onay linki · mail HTML'lerinde 3) · `dashboard.js` 5 (`:1090` `:14322` `:17232` `:17282` `:23339`) · `employee-signup.js` 2 (`:288` `:297`) · `admin-login.js:12` · `dashboard.html:4735` (ekranda gösterilen metin).<br>Ayrıca pazarlama/blog tarafında ~30 kez — **onlar sorun değil**, bkz. O-04 |
| **Tip** | C |
| **Kutuda ne olur** | Üç ayrı kırılma: (1) `dashboard.js:14322`/`:23339` müşterinin çalışanına ve hastasına **bizim** domain'imize giden link üretir — o link müşterinin kutusundaki hesabı tanımaz; (2) `employee-signup.js:288/297` auth doğrulama mailini `app.praxura.de/confirm.html`'e yönlendirir, kutudaki GoTrue oraya redirect edemez → çalışan kaydı ölür; (3) `server.js:3974` hastaya giden randevu onay linki bizim domain'e gider → hasta bizim sunucumuza tıklar |
| **Çözüm** | Üçe ayır: **origin türetilebilenler** (`dashboard.js:1090` `:17232` `:17282` zaten `window.location.origin` + fallback deseninde — fallback'i kaldırmak yeter) · **backend'in bilmesi gerekenler** → `PUBLIC_BASE_URL` env var'ı (sihirbaz doldurur) · **CORS listesi** (`server.js:48`) → env'den beslenen liste. **Faz 1.1 + Faz 2.2** |
| **Durum** | `geplant` (Faz 1.1 / 2.2) — kapı tabanı: **19** |

### O-04 — Pazarlama sayfalarındaki `app.praxura.de` ve `analytics.infinitymade.de`

| Alan | İçerik |
|---|---|
| **Ne** | `index.html`, `blog/*`, SEO landing sayfaları merkez domain'e ve Umami analytics'e bağlı |
| **Nerede** | ~30 satır: `index.html` 6 · `blog/*` 20 · `vorregistrierung.html` 3 · `kontakt.html` 2 · `404.html` 1. Umami: `cookie-consent.js:37` (`analytics.infinitymade.de/script.js`), yalnızca 30 pazarlama/blog sayfasında yükleniyor — uygulama sayfalarında yok |
| **Tip** | C / A |
| **Kutuda ne olur** | **Hiçbir şey** — bu sayfalar pakete girmiyor. Playbook **Faz 2.0** bunu açıkça kilitledi: "pazarlama sayfaları on-prem paketine GİRMEZ… paketin kök adresi doğrudan login/dashboard'a gitmeli." PoC'de doğrulandı (lokal landing'in Login'i internete götürüyordu) |
| **Çözüm** | `unkritisch` — Faz 2.0 paket ayrımıyla kapsam dışı. ⚠️ Tek şart: paket ayrımı **klasör/dosya listesiyle** yapılmalı, elle sayarak değil; yeni bir pazarlama sayfası eklendiğinde otomatik dışarıda kalsın (`.vercelignore` kuralının aynadaki hali) |
| **Durum** | `unkritisch` (gerekçe: Faz 2.0 paket ayrımı) |

### O-05 — Supabase URL/anon-key koda gömülü DEĞİL — `/api/config`'ten geliyor

| Alan | İçerik |
|---|---|
| **Ne** | Frontend Supabase bağlantısını runtime'da sunucudan alıyor; proje ref'i uygulama kodunda yok |
| **Nerede** | `supabase-config.js:2` (`fetch('/api/config')`) · `api/config.js` (env'den okur). Ürün kodunda `njvuclullotbksskpwgk` **sıfır** kez geçiyor; tek istisna `api-backend/test_schema.js:5` (test dosyası, env fallback'li). `vercel.json:19` CSP'de geçiyor ama Vercel'e özgü, pakete girmiyor |
| **Tip** | C |
| **Kutuda ne olur** | Kutuda `/api/config` müşterinin kendi Supabase URL'ini döndürür, frontend kodu değişmez. PoC 0.4 bunu kanıtladı: `onprem/poc-frontend-server.mjs` `/api/config`'in lokal muadilini servis etti, login→dashboard→takvim lokal stack'ten çalıştı |
| **Çözüm** | `unkritisch` **ama bir şartla**: `/api/config` bugün bir **Vercel fonksiyonu**. Kutuda onu Express'in servis etmesi gerekiyor → Faz 1.1'de "kutuya gidecekler" listesinin başında. Taşıma kaydı: O-15 |
| **Durum** | `unkritisch` (desen doğru; taşıma işi O-15.te) |

### O-06 — Sentry CDN loader'ı 11 HTML dosyasında `<script src="https://…">`

| Alan | İçerik |
|---|---|
| **Ne** | Sentry loader'ı üçüncü-parti CDN'den yükleniyor; uygulama sayfalarında da var |
| **Nerede** | **12 satır / 11 dosya**. Uygulama tarafı: `dashboard.html:10` `login.html:16` `onboarding.html:9` `booking.html:18` `kalender.html:11` `employee-signup.html:10` `admin.html:7` `admin-login.html:13`. Pazarlama tarafı: `index.html` `kontakt.html` `vorregistrierung.html` |
| **Tip** | A (+ C) |
| **Kutuda ne olur** | Müşterinin tarayıcısı `js-de.sentry-cdn.com`'a çıkar. Kısıtlı praxis ağında sayfa script bloke olana kadar bekler. Ayrıca **G4**: on-prem pakette telemetri varsayılan KAPALI olmalı; loader HTML'de sabitken "varsayılan kapalı" diye bir şey yok. Vendor kuralımızla da çelişiyor (Konsey 2026-08-13 S3: CDN'e geri dönmek yasak) |
| **Çözüm** | **Faz 2.6** — Sentry opt-in: sihirbazda kapalı-varsayılan onay kutusu; kapalıysa lokal `error_logs` tablosuna yaz. Loader etiketi HTML'den çıkar, koşullu enjeksiyona döner. Playbook Faz 1.4 bunu bilinçli istisna olarak ayırmış ("Sentry loader hariç — o Faz 2'de koşullu olacak") |
| **Durum** | `geplant` (Faz 2.6) — kapı tabanı: **12** |

---

## 2. Runtime dış çağrılar (tip A)

> Tarama kapsamı: `api-backend/**` (`node_modules` hariç) + `dashboard.js` tarayıcı çağrıları
> + Supabase Edge Functions. Ölçüt: kutu **çalışırken** dışarı çıkıyor mu.

### O-07 — Azure OpenAI çağrısı (Rezept-OCR + B2C-Draft)

| Alan | İçerik |
|---|---|
| **Ne** | AI çağrıları bugün doğrudan Azure OpenAI'ya gidiyor (n8n aradan çıktı, 04.09.2026) |
| **Nerede** | `api-backend/ai/azureClient.js:110` (chat/completions URL); endpoint + anahtar env'den: `:11` `AZURE_OPENAI_ENDPOINT`, `:12` `AZURE_OPENAI_API_KEY`, `:15` `AZURE_OPENAI_REGION`. EU Data Boundary kontrolü `:46-63` |
| **Tip** | A |
| **Kutuda ne olur** | İyi haber: endpoint ve anahtar **zaten env-var**, hardcode yok, dry-run modu var (`:16`). Kötü haber: bugün o env **bizim** anahtarımızı taşıyor. Pakete girerse G2 + K5 ihlali — müşteri sunucusundaki her sır okunabilir, faturası bize keser. Anahtar yoksa `:38-40` production'da hata fırlatıyor; sihirbazda "sonra kur" seçilirse bu davranış kutuyu bozar (K7: Rezept-Scan standart adım ama "şimdi değil" çıkışlı) |
| **Çözüm** | **Faz 1.3** — `ai/azureClient.js` → `ai/llmClient.js`, `AI_PROVIDER` (ionos veya azure) + `AI_ENDPOINT` + `AI_API_KEY` + `AI_MODEL_TEXT/VISION`. Anahtar **müşterinin** (K4 BYO-key, sihirbaz adımı Faz 2.2). Merkezi AI-proxy **yasak** (K6) — reçete görüntüsü bizden geçerse §393 kapsamına geri gireriz. Ek şart: anahtar yokken uygulama açılmalı, yalnız AI özelliği kapalı olmalı |
| **Durum** | `geplant` (Faz 1.3 + 2.2) |

### O-08 — Google Calendar / Gmail OAuth — bizim OAuth uygulamamız

| Alan | İçerik |
|---|---|
| **Ne** | Google takvim senkronu ve Gmail gönderimi bizim Google Cloud projemizin OAuth client'ı üzerinden |
| **Nerede** | `api-backend/server.js:314-315` `:329` (scope'lar) · `:350` `googleapis.com/oauth2/v2/userinfo` · `:433` `gmail.googleapis.com/…/messages/send` · redirect'ler `:342` `:364` `:379` `:382` (hepsi `app.praxura.de` sabit, bkz. O-03). Frontend girişi: `dashboard.js:11908`, `kalender.js:765`. Token'lar Supabase Vault'ta |
| **Tip** | A + E |
| **Kutuda ne olur** | Üç yerden birden kırılır: (1) OAuth redirect URI Google konsolunda `app.praxura.de`'ye kayıtlı — müşterinin domain'i orada olmadığı için akış `redirect_uri_mismatch` ile ölür; (2) `GOOGLE_CLIENT_SECRET` bizim sırrımız, kutuya konamaz (G2); (3) her müşteri ayrı domain, wildcard redirect yok → her kurulumda Google konsoluna elle giriş = Faz 4 provisioning otomasyonu çöker. Ayrıca PoC 0.3'te görüldü: `GOOGLE_*` env'leri **boot'ta zorunlu**, dummy değerle ayağa kaldırıldı |
| **Çözüm** | **Faz 2.8** — on-prem build'de feature flag ile kapalı; §9-A3'te "v1'de YOK" kararı zaten yazılı. Talep gelirse seçenekler: müşterinin kendi OAuth app'i · CalDAV/ICS-feed · cihaz akışı. E-posta zaten SMTP'ye dönmüştü, Gmail yolu ikincil. Aynı görevde `GOOGLE_*` boot-zorunluluğu da kaldırılmalı |
| **Durum** | `geplant` (Faz 2.8) · alt-soru `offen` (§9-A3, kullanıcı kararı bekliyor) |

### O-09 — Apify (Google Places crawler) — bizim token'ımız, B2B lead araması

| Alan | İçerik |
|---|---|
| **Ne** | İşletme arama/lead toplama Apify aktörüne çıkıyor |
| **Nerede** | `api-backend/server.js:465` (`api.apify.com/v2/acts/compass~crawler-google-places/…?token=`) · Vercel tarafı `api/apify/search.js` · frontend B2B ekranı `dashboard.js:11900` (`B2B_AGENT_URL`) |
| **Tip** | A + E + G |
| **Kutuda ne olur** | Müşteri kutusundan bizim Apify token'ımızla dışarı çıkılır → G2/K5 ihlali, faturası bize gelir. Ama asıl soru bu değil: bu özellik **hasta işi değil**, bizim B2B pazarlama/lead aracımız. Müşterinin praxis'inde işi yok |
| **Çözüm** | Merkez tarafı (tip G) — on-prem pakette **bulunmaz**; hem route hem `nav-registry` görünürlüğü on-prem build'de kapalı. Faz 1.1'in "merkezde kalacaklar" listesine yazılmalı. ⚠️ Playbook bu özelliği hiç anmıyor |
| **Durum** | `offen` — Faz 1.1 listesine eklenmeli (playbook'ta karşılığı yok) |

### O-10 — Stripe API çağrısı backend'de (checkout session okuma)

| Alan | İçerik |
|---|---|
| **Ne** | `admin/recover-checkout` route'u Stripe'a doğrudan gidiyor |
| **Nerede** | `api-backend/server.js:2749` (`api.stripe.com/v1/checkout/sessions/…`) · asıl Stripe zinciri Vercel'de `api/stripe/*` |
| **Tip** | A + G |
| **Kutuda ne olur** | Kutuda `STRIPE_SECRET_KEY` yok (olmamalı da — G2), route çağrılırsa 500 döner. Kırılma değil, ölü yüzey |
| **Çözüm** | Merkez tarafı (K3: Stripe merkezde kalır). On-prem build'de route kapalı; plan/ödeme durumu kutuya **lisans dosyasıyla** gider (Faz 3), kutu Stripe'a hiç bakmaz |
| **Durum** | `geplant` (Faz 3.3 entitlements; route kapatma Faz 1.1/2.0) |

### O-11 — Fahrtenbuch ORS proxy'si: 3 Supabase Edge Function — **kaynak kodu repoda YOK**

| Alan | İçerik |
|---|---|
| **Ne** | Hausbesuch mesafe/rota hesabı OpenRouteService'e gidiyor; proxy Deno edge function'ları yalnızca Supabase cloud projesinde yaşıyor |
| **Nerede** | Çağıran: `dashboard.js:5696` `invokeFahrtenbuchFn()` → `supabase.functions.invoke()`; kullanım `:5734` `:5764` `:5770`. Fonksiyonlar: `fahrtenbuch-geocode`, `fahrtenbuch-route`, `fahrtenbuch-matrix`. **`git ls-files supabase/` → yalnız `migrations/` (14 dosya); `supabase/functions/` git geçmişinde hiç yok.** Tasarım belgesi: `archive/Fahrtenbuch.md:114-131` |
| **Tip** | A |
| **Kutuda ne olur** | İki katmanlı sorun. (1) Kutuda `functions.invoke` boşa gider — self-host Supabase'e Deno runtime koymuyoruz (Faz 1.5 kararı) → Hausbesuch mesafe hesabı sessizce ölür, Fahrtenbuch km'siz kalır. (2) Daha ciddisi: **taşınacak kaynak kod elimizde yok.** Playbook D1 "Kaynak: `supabase/functions/`" diyor; bu bilgi **eskimiş/yanlış**. Fonksiyonlar canlı projeden indirilmeden Faz 1.5'e başlanamaz. Üçüncüsü: ORS free tier'da DSGVO Art. 28 AVV yok (`archive/Fahrtenbuch.md:131`) ve giden koordinat hasta ev adresinden türüyor |
| **Çözüm** | Önce **kaynak kurtarma** (canlı projeden `functions download`, repoya al) → sonra **Faz 1.5** (Express `routes/fahrtenbuch.js`). Anahtar sahipliği §9-A8'e bağlı; öneri (a): müşterinin kendi ücretsiz ORS anahtarı, sihirbaza adım. Mevcut disiplin korunur: ORS'a hasta adı/ID gitmez, yalnız koordinat (`archive/Fahrtenbuch.md:123`) |
| **Durum** | 🟡 **kaynak kurtarıldı (04.09.2026)** — Faz 1.5 artık başlayabilir |

> **04.09.2026 — yapılan (ana bağlam):**
> Üç fonksiyonun kaynağı canlı Supabase projesinden **geri çekildi** ve depoya yazıldı:
> `supabase/functions/{fahrtenbuch-geocode,fahrtenbuch-route,fahrtenbuch-matrix}/index.ts`
> \+ klasör README'si. İçerik birebir, tek satır değiştirilmedi.
>
> Depoya alınabilmesinin şartı önce kontrol edildi: `ORS_API_KEY` üçünde de
> `Deno.env.get()` ile okunuyor, **kodun içinde gömülü değil**. Sızıntı taraması temiz,
> `supabase/` zaten `.vercelignore`'da.
>
> Bu madde on-prem'den bağımsız bir riski de kapatıyor: fonksiyonlar aylardır canlıda
> çalışıyordu ve **hiçbir yerde kaynağı yoktu** — silinseler kimse yeniden yazamazdı.
>
> ⚠️ **Yeni ve kalıcı risk:** repodaki kopya canlının **aynası değil, fotoğrafı.** Depoda
> değişiklik yapmak canlıyı değiştirmez (deploy ayrı adım). Uyarı klasör README'sinde
> yazılı; ayrışırsa aynı sorun geri gelir.
>
> **Kalan:** Faz 1.5 (Express `routes/fahrtenbuch.js`) ve §9-A8 anahtar sahipliği kararı
> (öneri: müşterinin kendi ücretsiz ORS anahtarı). İkisi de hâlâ açık.

### O-12 — Nominatim/OSM geocoding tarayıcıdan doğrudan

| Alan | İçerik |
|---|---|
| **Ne** | İşletme adresi koordinata çevrilirken müşterinin tarayıcısı OpenStreetMap'e çıkıyor |
| **Nerede** | `dashboard.js:22788` (`nominatim.openstreetmap.org/search?q=…`), çağıran blok `:22777`, hata yolu `:22805` |
| **Tip** | A |
| **Kutuda ne olur** | Giden veri **işletme adresi** — hasta verisi değil, praxis'in zaten Impressum'da açık olan adresi. İnternetsiz kurulumda `catch` var: koordinat boş kalır, uygulama çalışmaya devam eder. İki not: (1) Nominatim kullanım politikası ticari toplu kullanımı kısıtlar, kutu başına tekil çağrı bu sınırın çok altında; (2) tarayıcıdan gittiği için müşterinin IP'si OSM'e görünür |
| **Çözüm** | `unkritisch` — playbook D4 aynı hükmü vermişti, koda karşı doğrulandı. ⚠️ Şart: bu çağrı **hasta adresine** genişletilirse madde `offen`'e döner ve O-11 ile aynı sepete girer |
| **Durum** | `unkritisch` (D4 hükmü doğrulandı) |

### O-13 — `N8N_WEBHOOK_URL` booking bildirimi

| Alan | İçerik |
|---|---|
| **Ne** | Randevu oluşturulunca n8n'e fire-and-forget bildirim |
| **Nerede** | `api-backend/server.js:1053` (`process.env.N8N_WEBHOOK_URL`) — env yoksa sessizce atlanıyor |
| **Tip** | A |
| **Kutuda ne olur** | Env boş kalacağı için **hiçbir şey**; kod bunu zaten sessizce atlıyor, kutuda kırılmaz. Yine de G3/G8 disiplini gereği kodda `N8N_` referansı kalmamalı — playbook D9'a göre bu webhook WhatsApp döneminden kalma ve muhtemelen işlevsiz |
| **Çözüm** | **Faz 1.2** — kaldır ya da iç event'e çevir. Kabul kriteri: `grep N8N_` → sıfır (bugün 3 satır: `:1053` `:1806` `:1809`) |
| **Durum** | `geplant` (Faz 1.2) |

### O-14 — SMTP çıkışı (nodemailer)

| Alan | İçerik |
|---|---|
| **Ne** | Booking/onay/Mahnung mailleri müşterinin SMTP sunucusundan gidiyor |
| **Nerede** | `api-backend/server.js:4102-4103` (`createTransport`, `SMTP_HOST`) + 6 çağrı noktası (`:3633` `:3649` `:3815` `:3865` `:3969` `:4017`). Merkez tarafı ayrı: `api/contact.js:13`, `api/demo-booking.js:22` |
| **Tip** | A |
| **Kutuda ne olur** | Sorunsuz — host/port/kullanıcı tamamen env-var, kod sağlayıcı-agnostik. Her çağrı noktası `if (process.env.SMTP_HOST)` ile korumalı, yani SMTP kurulmadan da uygulama çalışır. Hedef müşterinin kendi mail sunucusu, bizden geçmiyor |
| **Çözüm** | `unkritisch` — Faz 2.2 sihirbazı SMTP profillerini dolduracak, Faz 2.7 aynı ayarı GoTrue'ya besleyecek. Kodda değişiklik gerekmiyor. ⛔ Resend/Postmark'a geçilmez (proje kuralı) |
| **Durum** | `unkritisch` (desen doğru; sihirbaz işi Faz 2.2/2.7) |

---

## 3. Vercel `api/` fonksiyonları — merkez/kutu ayrımı (tip G)

> Playbook **Faz 1.1** bu ayrımı istiyor ama listeyi çıkarmamış. Liste burada.
> Sayım: `find api -name "*.js" -not -path "api/_lib/*" | wc -l` → **12** (limit dolu).
> `api/_lib/` (auth.js, pricing.js, stripe.js) fonksiyon sayılmaz, import edilen yardımcı.

| # | Fonksiyon | Kim çağırıyor | Karar | Gerekçe |
|---|---|---|---|---|
| 1 | `api/config.js` | `supabase-config.js:2` (her sayfa) | **KUTU** | Kutunun kendi Supabase URL'ini vermeli — O-15 |
| 2 | `api/dsgvo.js` | `dashboard.js:1425` `:1434` `:2360` `:13459` `:13514` `:22204` | **KUTU** | Hasta verisi okuyor/siliyor; G1 gereği bizden geçemez — O-16 |
| 3 | `api/stripe/create-checkout-session.js` | `onboarding.js:918` `:992`, `dashboard.js:22269` | **MERKEZ** | K3: Stripe merkezde — O-17 |
| 4 | `api/stripe/portal-session.js` | `dashboard.js:2316` | **MERKEZ** | K3 — O-17 (ama dashboard butonu O-19) |
| 5 | `api/stripe/webhook.js` | Stripe → bize | **MERKEZ** | K3 |
| 6 | `api/onboarding/pending.js` | `onboarding.js:980` | **MERKEZ** | Ödeme öncesi kayıt; kutuda karşılığı ilk-açılış sihirbazı (Faz 2.2) |
| 7 | `api/onboarding/check-email.js` | `onboarding.js:343` | **MERKEZ** | Aynı gerekçe |
| 8 | `api/contact.js` | `kontakt.html:535`, `vorregistrierung.html:532` | **MERKEZ** | Pazarlama sayfası formu; Faz 2.0 pakete girmiyor |
| 9 | `api/demo-booking.js` | `demo-booking.html:1064` `:1348` `:1384` | **MERKEZ** | Bizim satış demomuz, müşterinin işi değil |
| 10 | `api/admin/data.js` | `admin.js:69` `:95` `:158` `:209` | **MERKEZ** | Bizim admin panelimiz — ama içeriği kutuyla kesişiyor, O-18 |
| 11 | `api/admin/feedbacks.js` | `admin.js:239` `:259` | **MERKEZ** | Aynı, O-18 |
| 12 | `api/apify/search.js` | `dashboard.js:9429` `:13712` | **MERKEZ** | B2B lead aracı, hasta işi değil — O-09 |

**Özet:** 2 kutuya · 10 merkezde · 2 tanesi (admin/*) kutu verisine baktığı için ayrıca bölünmeli.

### O-15 — `/api/config` Vercel fonksiyonu olarak duruyor, kutuda Express vermeli

| Alan | İçerik |
|---|---|
| **Ne** | Frontend'in Supabase URL/anon-key'i aldığı tek nokta bir Vercel fonksiyonu |
| **Nerede** | `api/config.js` (12 satır) · tüketici `supabase-config.js:2` — yani **her sayfa** |
| **Tip** | G |
| **Kutuda ne olur** | Vercel yok → `/api/config` 404 → `supabase-config.js` boş URL döndürür → `createClient('','')` → uygulamanın **tamamı** açılmaz. Kırılma en temel yerde ve sessiz: konsola tek satır error düşer, ekran boş kalır |
| **Çözüm** | **Faz 1.1** — Express'te aynı yolda route; PoC 0.4'te muadili zaten yazıldı (`onprem/poc-frontend-server.mjs`), o dosya şablon. SaaS'ta Vercel fonksiyonu kalabilir (aynı sözleşme, iki dağıtım — fork değil). O-01'in çözümüyle aynı yüzey: `apiBase` de buradan dönmeli |
| **Durum** | `geplant` (Faz 1.1) |

### O-16 — `/api/dsgvo` hasta verisine dokunan tek Vercel fonksiyonu

| Alan | İçerik |
|---|---|
| **Ne** | DSGVO Art. 15 Auskunft ve Art. 17 Löschung zinciri merkez tarafta çalışıyor |
| **Nerede** | `api/dsgvo.js` (417 satır, service-role ile) · çağıran 6 nokta `dashboard.js` |
| **Tip** | G (+ D bağı) |
| **Kutuda ne olur** | Bugünkü hâliyle iki kere kırılır: (1) Vercel yok → 404; (2) daha kötüsü, merkezde kalırsa **merkez müşterinin hasta verisini okuyor** demektir → G1/K6 ihlali, geçişin amacı boşa. Ayrıca kod service-role anahtarıyla çalışıyor, o anahtar kutuda müşterinin olmalı |
| **Çözüm** | **Faz 1.1** — Express'e taşınır, kutuda kutunun kendi DB'sine bakar. ⚠️ Taşırken iki bilinen kilit korunur (dosya başındaki 28.08.2026 notu): GoBD `invoice_festschreibung()` triggeri ve `patient_consents` RESTRICT. Bunlar hata değil hukuki kilit — "on-prem'de kolaylaştıralım" denmez. Ayrıca `USER_TABLES` listesi Faz 5.1 export kapsamıyla çapraz doğrulanacak (playbook zaten istiyor) |
| **Durum** | `geplant` (Faz 1.1) |

### O-17 — Stripe + onboarding + contact + demo-booking merkezde kalır

| Alan | İçerik |
|---|---|
| **Ne** | Ödeme, kayıt öncesi akış ve pazarlama formları merkez tarafın işi |
| **Nerede** | `api/stripe/create-checkout-session.js` · `api/stripe/portal-session.js` · `api/stripe/webhook.js` · `api/onboarding/pending.js` · `api/onboarding/check-email.js` · `api/contact.js` · `api/demo-booking.js` |
| **Tip** | G |
| **Kutuda ne olur** | Hiçbiri kutuya girmez, dolayısıyla kutuda **hiçbir şey olmaz**. K3 bunu zaten kilitledi: müşteri kaydı, Stripe, lisans sunucusu merkezde; hasta verisi girmediği için §393/C5 tetiklenmez |
| **Çözüm** | `unkritisch` — merkez tarafı, bilinçli. ⚠️ Not: `api/onboarding/pending.js` bugün **Supabase Vault**'un tek canlı kullanıcısı (geçici şifreyi şifreli tutuyor). Merkez tarafta kaldığı için kutunun Vault ihtiyacını **azaltmaz**: kutuda Vault yine gerekli (Gmail/ORS token'ları — PoC 0.2'de Vault self-host'ta çalıştığı doğrulandı, §9-A4 çözüldü) |
| **Durum** | `unkritisch` (K3) |

### O-18 — Admin paneli merkezde ama beslendiği veri kutuda olacak

| Alan | İçerik |
|---|---|
| **Ne** | Bizim admin panelimiz müşteri tenant'larının içine bakarak KPI üretiyor |
| **Nerede** | `api/admin/data.js:69` (stats) `:95` (customers) `:158` (ai_breakdown) `:209` (db_health) · `api/admin/feedbacks.js` · tüketici `admin.js` |
| **Tip** | G + H |
| **Kutuda ne olur** | Kutu bu fonksiyonları içermez — sorun **ters yönde**: bugün merkez, müşterinin tablolarını service-role ile okuyarak "kaç randevu, kaç AI çağrısı, DB sağlığı" gösteriyor. On-prem'de o tablolar müşterinin kutusunda, merkezin erişimi **yok ve olmamalı** (K10). Yani panel on-prem müşteriler için **boş kalır** — bu bir hata değil, tasarımın sonucu, ama panelin bunu bilmesi gerekir yoksa "veri kayboldu" sanılır |
| **Çözüm** | Panel ikiye bölünür: **merkez verisi** (kim, hangi plan, lisans durumu, son yenileme çağrısı) her zaman görünür — Faz 3.1 lisans sunucusundan gelir; **tenant içi KPI** yalnız SaaS tenant'ları için. On-prem satırlarında "on-prem — veri erişimi yok (K10)" etiketi. `feedbacks` ayrı: O-22'ye bağlı (feedback bize gelmeye devam edecek, ama trigger'la değil) |
| **Durum** | `offen` — playbook Faz 1.1 "admin/* → dokunma" diyor, ama **panelin on-prem'de ne göstereceği** hiçbir fazda yazılı değil. Faz 3.1 adayı |

### O-19 — Dashboard içindeki Stripe checkout/portal butonları

| Alan | İçerik |
|---|---|
| **Ne** | Uygulama içinden plan yükseltme ve fatura portalı Stripe'a gidiyor |
| **Nerede** | `dashboard.js:2316` (`/api/stripe/portal-session`) · `dashboard.js:22269` (`/api/stripe/create-checkout-session`) · plan gösterimi `dashboard.js:2360` `:22204` civarı |
| **Tip** | G + H |
| **Kutuda ne olur** | İki buton 404 alır, kullanıcı "Abo verwalten"e basar hiçbir şey olmaz. Sessiz kırılma — kullanıcı ödemesini yönetemediğini anlamaz, sadece butonun bozuk olduğunu görür. Lisans süresi dolarken (Faz 3 durum makinesi) bu ekran **tam da lazım olduğu an** çalışmıyor olur |
| **Çözüm** | **Faz 3.2** — on-prem'de bu iki buton merkez portalına giden **dış linke** dönüşür (`PUBLIC_BASE_URL` değil, sabit merkez adresi; müşteri tarayıcısı bizim ödeme sayfamıza gider — hasta verisi taşımaz, G1 temiz). Panel banner'ları ve Mahnung akışı (3.2a) aynı yüzeyde |
| **Durum** | `geplant` (Faz 3.2) |

### O-20 — Vercel fonksiyon limiti 12/12 — G8'in mekanik yüzü

| Alan | İçerik |
|---|---|
| **Ne** | Yeni bir Vercel fonksiyonu eklenemez; teknik limit ile korkuluk aynı yere bakıyor |
| **Nerede** | `api/` altında tam 12 fonksiyon (`api/_lib/*` hariç). Doğrulama: `find api -name "*.js" -not -path "api/_lib/*" \| wc -l` |
| **Tip** | G |
| **Kutuda ne olur** | Doğrudan bir etkisi yok, ama **G8'in en kolay ihlal noktası** burası: yeni bir HTTP endpoint gerektiğinde en kısa yol `api/` altına dosya açmaktır. Bugün onu Vercel'in plan limiti engelliyor — yani bizi koruyan şey disiplin değil, tesadüf. Limit büyütülürse koruma kaybolur |
| **Çözüm** | Kapı: `tools/check-onprem.sh` `api/` dosya sayısını sayar, **artış = red** (taban 12). Yeni endpoint `api-backend/server.js`'e yazılır — G8 zaten bunu söylüyor |
| **Durum** | `offen` → kapı 04.09.2026'da yazıldı (`tools/check-onprem.sh` + `tools/.onprem-baseline`, `vercel_fn=12`). **Commit numarası girilince `gelöst`** — bkz. §8 |

---

## 4. Zamanlanmış işler (tip F)

> Tarama: `.github/workflows/` (2 dosya) · `api-backend/server.js` içindeki `setInterval`
> zamanlayıcıları · DB trigger'ları (`db/SCHEMA-RLS.sql` §3-4 + `onprem/schema/` dump'ı).
> **pg_cron kurulu değil** — dump'ta `cron.` şeması yok, doğrulandı.

### O-21 — `notify_feedback_telegram()` DB trigger'ı `pg_net` ile bizim webhook'umuza POST atıyor

| Alan | İçerik |
|---|---|
| **Ne** | Feedback yazıldığı anda veritabanı, bizim n8n'imize HTTP isteği gönderiyor |
| **Nerede** | `onprem/schema/live_schema_2026-07-06.sql:711-729` (fonksiyon gövdesi, `net.http_post` → `https://n8n.infinitymade.de/webhook/feedback-notify`) · trigger `trg_feedback_telegram AFTER INSERT ON feedbacks` (`:4997`, `db/SCHEMA-RLS.sql:742`) · özet `db/SCHEMA.sql:822`. Dump'ta `net.http_post` **1 kez** geçiyor — tek örnek |
| **Tip** | F + A |
| **Kutuda ne olur** | Müşterinin veritabanı, müşteri bilmeden bizim sunucumuza bağlanır. Gönderilen alanlar (`type`, `priority`, `title`, `description`) hasta verisi değil ve bize gelmesi **isteniyor** — ama G1'in görünümüne aykırı: "veriniz %100 sizde" diyip DB'den dışarı otomatik POST atmak satışta da hukukta da savunulamaz. Ayrıca `pg_net` self-host Supabase'de varsayılan kurulu değil → trigger sessizce hata verebilir |
| **Çözüm** | **Faz 1.6** — trigger kaldırılır; feedback bildirimi Express tarafında, formun submit'inde **açık** API çağrısına döner. On-prem'de "Praxura'ya gönder" onay metniyle, yani kullanıcının bilinçli eylemi. SaaS'ta davranış aynı kalır (G7). Playbook D2 aynı hükmü vermişti, koda karşı doğrulandı |
| **Durum** | `geplant` (Faz 1.6) |

### O-22 — `attendance` gece 23:55 otomatik kapatma (`setInterval`)

| Alan | İçerik |
|---|---|
| **Ne** | Check-out yapılmamış devam kayıtları her gece Berlin saatiyle 23:55'te `incomplete` işaretleniyor |
| **Nerede** | `api-backend/server.js:3372-3395` — `scheduleAttendanceAutoClose()`, `setInterval(…, 60_000)`, dakikada bir saate bakıyor |
| **Tip** | F |
| **Kutuda ne olur** | **Çalışır** — zamanlayıcı Express sürecinin içinde, image ile birlikte kutuya gider, dışarıya hiç çıkmaz, pg_cron gerektirmez. Tek not: saat dilimi `BUSINESS_TZ` (Europe/Berlin) sabit; Almanya dışında müşteri düşünülüyorsa env'e alınmalı — bugün alan Almanya olduğu için sorun değil |
| **Çözüm** | `unkritisch` — desen doğru ve playbook Faz 2.4a'nın istediği şeyin (node-cron) elle yazılmış hâli. **Yeni periyodik iş çıktığında şablon budur**, pg_cron'a gidilmez |
| **Durum** | `unkritisch` (desen doğru) |

### O-23 — `delete_expired_accounts()` — playbook D5 **çürütüldü**, ama on-prem'de yeni bir risk açıyor

| Alan | İçerik |
|---|---|
| **Ne** | Süresi dolmuş iptal hesapları gece 03:00'te anonimleştiren/silen RPC; zamanlayıcısı **var** |
| **Nerede** | Zamanlayıcı: `api-backend/server.js:3400-3415` (`scheduleAccountCleanup()`, 03:00 Berlin). RPC: `db/SCHEMA-RLS.sql:511` (`delete_expired_accounts()` [SEC DEF]) |
| **Tip** | F |
| **Kutuda ne olur** | İki ayrı hüküm. (1) **Playbook D5 artık yanlış:** "zamanlayıcısı YOK (pg_cron kurulu değil, kodda çağıran yok)" deniyordu — bugün `server.js:3400`'de çağıran var. Faz 2.4a'nın "SaaS'ta da düzelt" notu **düşmüştür**. (2) Buna karşılık on-prem'de **yeni** bir tehlike: bu zamanlayıcı müşterinin kendi kutusunda çalışır ve `deletion_scheduled_at` dolu bir hesabı bulursa **müşterinin kendi hasta verisini silecek**. Lisans bitişinin cezası salt-okunur moddur (K9/G5), **veri silme değildir**. İki mekanizma yanlışlıkla birbirine değerse geri dönüşü olmayan zarar olur |
| **Çözüm** | Faz 3.2 durum makinesi yazılırken açık kural: lisans/ödeme yolu `deletion_scheduled_at`'e **hiçbir koşulda dokunmaz**; o alanı yalnız kullanıcının kendi hesap-silme talebi doldurur. On-prem build'de zamanlayıcı korunur (kullanıcının kendi talebi yasal olarak işlemek zorunda) ama kaynağı denetlenir |
| **Durum** | `offen` (playbook D5 `widerlegt`; yeni risk Faz 3.2'ye bağlanmalı, bugün hiçbir fazda yazılı değil) |

### O-24 — `notify_new_referral_draft()` trigger'ı `pg_notify` ile iç kanal

| Alan | İçerik |
|---|---|
| **Ne** | Yeni referral draft'ta veritabanı içi bildirim kanalına mesaj basılıyor |
| **Nerede** | `onprem/schema/live_schema_2026-07-06.sql:738-755` (`pg_notify('new_referral_draft', …)`) · trigger `:5259` |
| **Tip** | F |
| **Kutuda ne olur** | Hiçbir şey — `pg_notify` **Postgres'in içinde** kalır, ağa çıkmaz. Dinleyen yoksa mesaj düşer. Payload hasta adı içeriyor ama veritabanının dışına çıkmıyor |
| **Çözüm** | `unkritisch` — O-21 ile karıştırılmamalı: o `net.http_post` (dışarı), bu `pg_notify` (içeri). Bu ayrım her denetimde yeniden sorulmasın diye buraya yazıldı |
| **Durum** | `unkritisch` |

### O-25 — `publish-calendar-api.yml` yalnız `latest` tag'i basıyor — kanal sistemi yok

| Alan | İçerik |
|---|---|
| **Ne** | Image yayın workflow'u tek tag üretiyor; K11'in `:beta`/`:stable` ayrımı henüz yok |
| **Nerede** | `.github/workflows/publish-calendar-api.yml:64-65` (`type=raw,value=latest`) · tetikleyici `on: push: branches:[main], paths: api-backend/**` · testler publish'ten **önce** koşuyor (`:15-18` yorumu) |
| **Tip** | F + B |
| **Kutuda ne olur** | Bugün: her main push'u ~60 saniyede canlıya çıkar (Watchtower). Bu SaaS'ta bilinçli. Kutularda aynı düzen kalırsa **ücretli müşteri her denememizi yer** — K11 tam bunu engellemek için var. Ücretli müşterinin kutusu, henüz test edilmemiş bir image'ı gece yarısı çeker |
| **Çözüm** | **Faz 4.3** — `:beta` (her main push) + `:stable` (yalnız release tag'i); Watchtower kanal tag'ini izler. Testlerin publish'ten önce koşması iyi bir taban, korunur. Ayrıca şema dağıtımıyla bağlanır: `:stable` image'ı yalnız kendi migration'larını bilmeli (O-39). ★ Kanalın tam tasarımı — değişmez `X.Y.Z` etiketi, 72 saatlik soak, `:stable`'ın elle taşınması, `latest`'in kullanımdan kalkması, kutuda saatlik Watchtower — `onprem/RELEASE-STANDARD.md` §2.3 + §6.4'te. Etiketin kendisi risk kontrolüdür; aralık değil |
| **Durum** | `geplant` (Faz 4.3 / 4.3b) — bkz. O-41 (smoke-test ve soak eksikliği) |

### O-26 — Yedekleme zamanlayıcısı repoda yok, VPS'te elle kurulmuş

| Alan | İçerik |
|---|---|
| **Ne** | Gecelik yedek bugün sunucuya elle kurulan bir cron; repo'da ne script'i ne tanımı var |
| **Nerede** | `grep -rl pg_dump --include="*.sh" --include="*.mjs" --include="*.yml"` → **sıfır sonuç**. Kurulum bilgisi `INFRASTRUCTURE.md`'de (gitignore'lu) |
| **Tip** | F |
| **Kutuda ne olur** | Kutu **yedeksiz** kurulur. Müşteri sunucusunda veri kaybı = hasta dokümantasyonu kaybı = bizim değil müşterinin sorumluluğu, ama ürün "yedek yok" diye teslim edilirse satışta ve hukukta savunulamaz. Ayrıca playbook D3'ün uyarısı geçerli: `pg_dump` **storage dosyalarını yedeklemez** — reçete görüntüleri, DTA dosyaları, hasta belgeleri 5 bucket'ta duruyor |
| **Çözüm** | **Faz 2.3** — gecelik `pg_dump` + storage volume arşivi tek yedek seti; hedef Hetzner Storage Box/lokal dizin; 14 gün + 12 ay rotasyon; panelde "son yedek: X" ve başarısızlıkta uyarı; `restore.sh` + gerçekten test edilmiş geri yükleme |
| **Durum** | `geplant` (Faz 2.3 + 2.3a) — ★ ek gereksinim `onprem/RELEASE-STANDARD.md` §4.3: **migration çalışmadan önce** kutu `vor-<sürüm>` yedeği alır; yedek alınamıyorsa migration **çalışmaz**. Göç-öncesi yedeklerin son 3'ü rotasyondan muaf. Yedek hedefi varsayılan olarak **kutunun dışı** (aynı diskteki yedek disk arızasında veriyle birlikte ölür, §6.6) |

---

## 5. Sırlar (tip E)

> Tarama: `grep -rho "process\.env\.[A-Z0-9_]*"` → `api-backend/` **27** ad, `api/` **16** ad.
> Aşağıda yalnız **adlar** var — depo public, değer yazılmaz.
> Ayrım tek soruyla: bu değişken **bizim** anahtarımızı mı yoksa **müşterinin** anahtarını
> mı taşıyacak? Bizimse pakete giremez (G2/K5).

| Env var | Bugün kimin | Kutuda kimin | Not |
|---|---|---|---|
| `AZURE_OPENAI_API_KEY` / `_ENDPOINT` / `_REGION` / `_DEPLOYMENT` | **bizim** | müşterinin (`AI_API_KEY`) | O-07 · Faz 1.3 |
| `APIFY_TOKEN` | **bizim** | — (özellik kutuya girmez) | O-09 |
| `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `STRIPE_PRICE_*` | **bizim** | — (merkez) | O-10/O-17 |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `_REDIRECT_URL` | **bizim** | — (Faz 2.8 kapalı) | O-08 |
| `ADMIN_RECOVERY_SECRET` | **bizim** | — (merkez route) | O-27 |
| `SETUP_SECRET` | **bizim** | — (demo-booking, merkez) | O-27 |
| `SENTRY_DSN_BACKEND` · `SENTRY_ENVIRONMENT` · `SENTRY_SERVER_NAME` · `DEBUG_SENTRY` | **bizim** | opsiyonel, müşteri onayına bağlı | O-06 · G4 · Faz 2.6 |
| `N8N_WEBHOOK_URL` · `N8N_AI_SERIES_URL` | bizim | — (silinecek) | O-02/O-13 · Faz 1.2 |
| `SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_URL` | bizim | **müşterinin** (kutu içi) | O-05 |
| `SUPABASE_SERVICE_ROLE_KEY` | bizim | **müşterinin** (kurulumda üretilir) | O-28 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | bizim | müşterinin | sır değil, RLS korur |
| `SMTP_HOST` / `_PORT` / `_USER` / `_PASS` | bizim | **müşterinin** | O-14 · Faz 2.2 |
| `DATA_ENCRYPTION_KEY` | bizim | **müşterinin** (kurulumda üretilir) | O-29 — **en tehlikelisi** |
| `NEXT_PUBLIC_URL` | bizim | müşterinin (`PUBLIC_BASE_URL`) | O-03 |
| `ORS_API_KEY` (bugün Supabase Vault'ta) | bizim | §9-A8 kararına bağlı | O-11 |

### O-27 — Bizim anahtarlarımızı taşıyan env var'lar kutuya giremez

| Alan | İçerik |
|---|---|
| **Ne** | 8 grup env var bugün bizim hesaplarımızın anahtarını taşıyor |
| **Nerede** | `AZURE_OPENAI_API_KEY` (`api-backend/ai/azureClient.js:12`) · `APIFY_TOKEN` (`server.js:465`) · `STRIPE_SECRET_KEY` (`server.js:2749`, `api/_lib/stripe.js`) · `STRIPE_WEBHOOK_SECRET` (`api/stripe/webhook.js`) · `GOOGLE_CLIENT_SECRET` (`server.js` OAuth) · `ADMIN_RECOVERY_SECRET` (`server.js:2738`) · `SETUP_SECRET` (`api/demo-booking.js:320`) · `SENTRY_DSN_BACKEND` |
| **Tip** | E |
| **Kutuda ne olur** | Hepsi aynı sonuca çıkar: **müşteri sunucusundaki her sır okunabilir.** `docker inspect`, `.env` dosyası, hatta yedek arşivi — hepsi müşterinin elinde. Sızan Azure anahtarının faturası bize gelir; sızan Stripe anahtarı bizim tüm müşteri ödemelerimizi açar. K5 ve G2 tam bunu yasaklıyor |
| **Çözüm** | Üç gruba ayrılır: **BYO-key'e dönenler** (Azure → `AI_API_KEY`, müşterinin IONOS anahtarı — Faz 1.3/2.2) · **kutuya hiç girmeyenler** (Stripe, Apify, Google, ADMIN_RECOVERY, SETUP — ilgili route on-prem build'de kapalı) · **opsiyonel olanlar** (Sentry — G4, varsayılan kapalı). Kabul kriteri Faz 3'te zaten yazılı ve genişletilmeli: image `docker inspect` + `grep` ile denetlenir, bizim hiçbir anahtarımız çıkmaz |
| **Durum** | `geplant` (Faz 1.3 + 2.1 `.env.template` + Faz 3 doğrulama) |

### O-28 — `SUPABASE_SERVICE_ROLE_KEY` kutuda müşteriye ait olmalı ve kurulumda üretilmeli

| Alan | İçerik |
|---|---|
| **Ne** | Backend'in RLS'i aşan anahtarı; her kutunun kendi JWT secret'ından türemeli |
| **Nerede** | `api-backend/server.js` boot (env yoksa `process.exit(1)` — bilinçli), `api/_lib/auth.js` |
| **Tip** | E |
| **Kutuda ne olur** | İki hata biçimi var, ikisi de yaşandı ya da yaşanabilir: (1) **anahtar adı yanlış yazılırsa** (`SUPABASE_SERVICE_KEY`) container crash-loop'a girer ve Watchtower bozuk image'ı 60 saniyede canlıya alır — bu SaaS'ta bir kez oldu, kutuda müşterinin başına gelirse kimse müdahale edemez (K10: erişimimiz yok); (2) tüm kutular **aynı** JWT secret'ıyla kurulursa bir müşterinin anahtarı diğerinin kutusunu açar. Kurulum script'i her kutu için rastgele secret üretmeli |
| **Çözüm** | **Faz 2.1** — `install.sh` her kurulumda benzersiz `JWT_SECRET` + türev anahtarlar üretir, `.env.template` bunu belgeler. **Faz 2.4** healthcheck: yanlış/eksik anahtarda container ölmek yerine kurulum modunda kalıp panelde sebebi göstermeli (crash-loop müşteride teşhis edilemez) |
| **Durum** | `geplant` (Faz 2.1 + 2.4) |

### O-29 — `DATA_ENCRYPTION_KEY` — kaybolursa hasta verisi geri gelmez

| Alan | İçerik |
|---|---|
| **Ne** | PHI şifreleme anahtarı (32 bayt); reçete OCR çıktısı ve ICD kodu bununla şifrelenip saklanıyor |
| **Nerede** | `api-backend/lib/phi-encrypt.js:24-33` · kullanım `api-backend/server.js:2441-2442` (`icd10_enc`, `ocr_raw_enc`) |
| **Tip** | E |
| **Kutuda ne olur** | Anahtar **her kutuda ayrı** olmak zorunda (ortak anahtar = bir kutudan sızan anahtar hepsini açar). Ama ayrı olmasının bedeli şu: anahtar `.env`'de, veri `pg_dump`'ta. Müşteri yedeği geri yüklerken anahtarı kaybetmişse **şifreli alanlar kalıcı olarak okunamaz** — hasta dokümantasyonunun bir parçası yok olur. Bu, yedekleme tasarımının (Faz 2.3) en kolay kaçırılan noktası: yedek "başarılı" görünür, geri yükleme yarım açılır |
| **Çözüm** | ★ **`onprem/RELEASE-STANDARD.md` §4.5** — dört kural, ikisi kurulumun ikisi geri yüklemenin işi: (1) `install.sh` her kutu için rastgele üretir, ortak anahtar yasak (**Faz 2.1**); (2) sihirbaz anahtarı bir kez gösterir, "sakladım" onayı alınmadan ilerlemez, bizde kopyası yok ve olmayacak — metin bunu da söyler (**Faz 2.2**); (3) her gecelik yedeğin künyesine anahtarın **parmak izi** (HMAC, anahtarın kendisi değil) yazılır, panelde uyum rozeti durur, uyumsuzluk **o gece** kırmızıya döner (**Faz 2.4**); (4) `restore.sh` künyedeki parmak izini karşılaştırır ve uyuşmazlıkta **veriye dokunmadan** durur, zorla devam yalnız açık onayla (**Faz 2.3**) |
| **Durum** | `geplant` (Faz 2.1 + 2.2 + 2.3 + 2.4) — gereksinim `RELEASE-STANDARD.md` §4.4-§4.5'te yazıldı. Playbook D6 Vault'u ele alıyordu, `DATA_ENCRYPTION_KEY` hiçbir fazda geçmiyordu; artık geçiyor. `gelöst` olması için dördü de uygulanıp commit numarasının buraya yazılması gerekir |

### O-30 — `.env.template` yok; kurulumda hangi değişkenin gerektiği yazılı değil

| Alan | İçerik |
|---|---|
| **Ne** | Repoda tek env dosyası `.env.local` ve o da gitignore'lu (`.gitignore:33` → `.env*`); paket için şablon yok |
| **Nerede** | Kök dizin — `.env.template` / `.env.example` **yok**. Gerekli adlar bugün yalnız `CLAUDE.md`'nin env bölümünde ve kodun içinde dağınık |
| **Tip** | E |
| **Kutuda ne olur** | `install.sh` neyi soracağını bilmez; eksik bir değişken boot'ta `process.exit(1)`'e ya da sessiz özellik kaybına yol açar (PoC 0.3'te tam bu yaşandı: `GOOGLE_*` boot'ta zorunlu çıktı, dummy değer konularak geçildi). Müşteri kurulumunda "dummy değer koy" seçeneği yok |
| **Çözüm** | **Faz 2.1** — `onprem/.env.template`: her değişken için ad + zorunlu mu + kim doldurur (sihirbaz / install script / hiç) + boş bırakılırsa hangi özelliğin kapanacağı. Bu dosya aynı zamanda O-27'nin denetim listesi olur |
| **Durum** | `geplant` (Faz 2.1) |

---

## 6. Yetkilendirme noktaları (tip H)

> Faz 3.3 tek bir `entitlements` helper'ı istiyor: SaaS'ta Stripe'tan, on-prem'de lisanstan
> beslenecek. Bugünkü dağınıklığın sayımı aşağıda.
>
> ⚠️ **Sayarken tuzak:** `is_active` bu kod tabanında **iki ayrı şey** demek —
> `profiles.is_active` (hesap aktif mi, yetki) ve `working_hours.is_active` /
> `vehicles.is_active` (o gün açık mı, araç kullanımda mı — yetkiyle **ilgisiz**).
> Ham `grep is_active` 111 sonuç veriyor; bunların çoğu ikinci anlam. Aşağıdaki sayılar
> ayıklanmış.

### O-31 — Plan/yetki kontrolü 6 dosyada dağınık, tek kaynak yok

| Alan | İçerik |
|---|---|
| **Ne** | "Bu kullanıcı bunu yapabilir mi" sorusu her yerde ayrı ayrı, doğrudan `profiles.plan_status`'a bakılarak cevaplanıyor |
| **Nerede** | **`plan_status` 21 kez / 6 dosya:** `dashboard.js` 7 (`:1000` `:1401` `:1444` `:4508` `:16968` `:21881` `:21895`) · `api/stripe/webhook.js` 5 (yazan taraf) · `api/admin/data.js` 4 (raporlama) · `admin.js` 3 · `api-backend/server.js:2803` (yazan taraf) · `confirm.html` 1.<br>**Tek gerçek kapı fonksiyonu:** `dashboard.js:4507` `checkPlanActive()` — yalnız `canceled`/`expired` durumunu kesiyor, üç yerden çağrılıyor (`:5875` `:20172` `:21480`).<br>**Hesap seviyesi:** `profiles.is_active` — `dashboard.js:1395` (gösterim), `employee-signup.js:169` (çalışan kaydını engelliyor), `api-backend/server.js:3483` (takım listesi filtresi).<br>**Deneme süresi:** `trial_ends_at` — `dashboard.js:1403-1404`.<br>**Veritabanında yetki mantığı YOK:** `db/SCHEMA-RLS.sql`'de `plan_status`'a bakan tek şey bir index (`:913`); hiçbir RLS policy plana bakmıyor — bu **iyi haber**, yetki tamamen uygulama katmanında |
| **Tip** | H |
| **Kutuda ne olur** | `plan_status` kolonu kutunun kendi `profiles` tablosunda duracak, ama onu **kimse güncellemeyecek**: Stripe webhook'u merkezde, kutuya erişimi yok (K10). Yani müşteri kurulumdan sonra sonsuza kadar `trial` (ya da import'tan gelen değer) olarak kalır → ödeme kesilse bile hiçbir kısıt işlemez. Ters durum daha kötü: import sırasında `canceled` gelen bir tenant, ödeyen bir on-prem müşterisi olmasına rağmen `checkPlanActive()` yüzünden yeni randevu açamaz |
| **Çözüm** | **Faz 3.3** — tek `entitlements` helper'ı: `entitlements.canBook()`, `.canBill()`, `.canUseAI()` gibi soruları cevaplar; kaynağı SaaS'ta `profiles.plan_status` (Stripe), on-prem'de imzalı lisans dosyası. 21 doğrudan okuma bu helper'a bağlanır. ⚠️ Helper **salt-okunur modu** da bilmeli (K9/G5): görüntüleme + DSGVO-export her koşulda açık, yeni kayıt/abrechnung/AI kapalı. `checkPlanActive()`'in bugünkü "hepsini kes" davranışı G5'e aykırı — helper'a taşınırken düzeltilmeli |
| **Durum** | `geplant` (Faz 3.3) — taban: `plan_status` **21** okuma / 6 dosya |

### O-32 — Modül görünürlüğü plana değil `module_visibility` tablosuna bakıyor

| Alan | İçerik |
|---|---|
| **Ne** | Sidebar/modül görünürlüğü tek kaynaktan (`nav-registry.js` + `module_visibility` tablosu) yönetiliyor; plan kontrolü içermiyor |
| **Nerede** | `nav-registry.js:9-13` (yorum: gerçek görünürlük `module_visibility` tablosunda) · `resolveSector()` `:140-144` (alan bazlı, plan bazlı değil) |
| **Tip** | H |
| **Kutuda ne olur** | Sorunsuz çalışır — tablo kutunun kendi DB'sinde, dış bağımlılık yok. Ama **fırsat da burada**: lisans "hangi modüller açık" bilgisini taşıyacak (Faz 3 tasarımında `modüller` alanı var). İki mekanizma birbirinden habersiz kalırsa müşteri ödemediği modülü `module_visibility`'den kendi açar |
| **Çözüm** | Faz 3.3 helper'ı `module_visibility`'yi **ezen** bir üst katman olur: lisans kapalıysa tablo ne derse desin modül görünmez. Tersi değil (lisans açık + müşteri kapatmış = kapalı kalır, bu müşterinin tercihi) |
| **Durum** | `offen` — Faz 3.3 kapsamında ama playbook `module_visibility` ile lisansın ilişkisini yazmamış |

### O-33 — On-prem'de "çalışan sayısı / limit" kavramı tanımsız

| Alan | İçerik |
|---|---|
| **Ne** | Plan farkı (Starter/Professional/Klinik) bugün fiyat sayfasında anlatılıyor ama kodda bir kullanıcı/limit kapısı yok |
| **Nerede** | Aranan: `planLimit`, `PLAN_LIMIT`, `requirePlan`, `hasFeature` → **sıfır sonuç**. Fiyat bilgisi yalnız `api/_lib/pricing.js` (merkez, raporlama için) |
| **Tip** | H |
| **Kutuda ne olur** | Bugün SaaS'ta da limit uygulanmıyor, yani bu bir regresyon değil. Ama on-prem'de sonuç ağırlaşır: müşteri Starter lisansıyla kutuyu kurar, 20 çalışan ekler, kimse görmez — merkezde telemetri yok (G4), denetim yok (K10). Lisans dosyası plan adını taşıyacak ama plan adının **hiçbir teknik karşılığı** yok |
| **Çözüm** | Karar gerekiyor: (a) plan farkı yalnız **modül** bazlı kalsın (lisans modül listesi taşır, kullanıcı sayısı serbest) — en basiti ve K13'ün "toplam fiyat" diliyle uyumlu; (b) kullanıcı sayısı lisansa yazılıp helper'da kontrol edilsin. Öneri: **(a)**. Ne olursa olsun Faz 3.3'ten önce cevaplanmalı, yoksa lisans formatı yanlış donar |
| **Durum** | `offen` — kullanıcı kararı gerekiyor; playbook'ta karşılığı yok |

---

## 7. Doğru yapılmışlar — tip B ve yerelleştirme (`unkritisch`)

> Bu bölüm sicilin en çok tekrar okunacak yeri. **Silinmez.** Buradaki her madde,
> "bunu niye sorun saymadık" sorusunun cevabını taşıyor — yazılmazsa altı ay sonra
> aynı şey ikinci kez araştırılır. Ayrıca yeni bir ihtiyaç çıktığında **şablon** burada.

### O-34 — `preise-check.yml`: tip B'nin canlı örneği ve şablonu

| Alan | İçerik |
|---|---|
| **Ne** | GKV fiyat verisi merkezde çekiliyor, koda commit'leniyor, image'la kutuya gidiyor — kutu dış kaynağa hiç çıkmıyor |
| **Nerede** | `.github/workflows/preise-check.yml` — `cron: '0 6 * * *'` (`:23`), `preise_autoupdate.mjs` çalışır → `preise_ci_extract.mjs` değerlendirir → **değişiklik varsa önce `npm test`**, yeşilse `billing/codes/{podologie,physio}_positions.js` commit'lenir (`:60-73`), `publish-calendar-api.yml` devralır, Watchtower dağıtır. XML kaynağı `api-backend/preise_pruefen.mjs:47` (`gkv-heilmittel.de`) |
| **Tip** | B |
| **Kutuda ne olur** | Kutu `gkv-heilmittel.de`'ye **hiç çıkmaz**; fiyat verisi image'ın içinde düz JS olarak gelir. İnternet kesilse bile fatura hazırlanabilir. Dış kaynak değişirse müşteri değil biz görürüz. Belirsiz durumda (yeni/kaybolan kod) otomatik değişiklik **yapılmıyor**, yalnız bildirim gidiyor — insan kararı korunmuş |
| **Çözüm** | `unkritisch` — **yeni dış veri ihtiyacı çıktığında şablon budur.** Sıra: merkez çeker → deterministik script doğrular → test yeşilse commit → image → Watchtower. Tip A'ya (kutudan canlı çağrı) dönüştürme önerisi gelirse reddedilir |
| **Durum** | `unkritisch` (referans desen) |

### O-35 — `Dockerfile` açık `COPY` listesi — fiyat script'i image'a girmiyor

| Alan | İçerik |
|---|---|
| **Ne** | Image içeriği tek tek sayılıyor; `COPY . .` yok |
| **Nerede** | `api-backend/Dockerfile:10` (yorum: "Diese Liste ist vollstaendig aufzufuehren — es gibt kein `COPY . .`") · `:16-22` (`server.js`, `instrument.js`, `_lib`, `ai`, `billing`, `booking`, `lib`) · CMD `:40` (açık `pm2-runtime` yolu) |
| **Tip** | B |
| **Kutuda ne olur** | `preise_pruefen.mjs` / `preise_autoupdate.mjs` **image'a girmez** — yani `gkv-heilmittel.de` adresi müşterinin kutusunda hiç bulunmaz. O-34'ün "kutu dışarı çıkmaz" iddiasını gerçekten garanti eden şey bu satırlardır, workflow değil. Aynı disiplin ileride paket ayrımının (Faz 2.0) temeli |
| **Çözüm** | `unkritisch` — ⚠️ korunması gereken bir kazanım: `COPY . .`'ya dönülürse fiyat script'i, test dosyaları ve ileride başka şeyler sessizce müşteri sunucusuna gider. CMD'nin açık yol kullanması da ayrı bir ders (bare `pm2-runtime` prod'da `MODULE_NOT_FOUND` verdi) |
| **Durum** | `unkritisch` (korunacak kazanım) |

### O-36 — `vendor/` yerelleştirmesi — tarayıcıda üçüncü-parti runtime kalmadı

| Alan | İçerik |
|---|---|
| **Ne** | supabase-js, node-forge, fullcalendar, cropperjs kendi sunucumuzdan gidiyor; CDN'den değil |
| **Nerede** | `vendor/supabase-js.js` · `vendor/node-forge.js` · `vendor/fullcalendar/` · `vendor/cropperjs/` (üretim: `tools/vendor/`). Gerekçe ve sürümler: `vendor/README.md`. Son adım `dashboard.html:25-33` (Cropper.js, 27.08.2026). Kalan CDN taraması: `esm.sh`/`unpkg`/`jsdelivr`/`cdnjs` → uygulama kodunda **sıfır** (tek eşleşme `dashboard.html:30`'daki açıklama yorumu) |
| **Tip** | A → çözüldü |
| **Kutuda ne olur** | Hiçbir şey — kutu açılırken dışarıya JS çekmez. Bu **on-prem için sert şart**tı ve `vendor/README.md` bunu açıkça yazıyor: "müşterinin kendi sunucusunda çalışan imajda tek bir dış runtime çağrısı kalamaz, yoksa 'Ihre Daten bleiben auf Ihrem Server' iddiası UWG §5 ve §434 BGB açar" |
| **Çözüm** | `gelöst` — Konsey 2026-08-13 (S3) + 27.08.2026 Cropper adımı. Playbook Faz 1.4 bu görevi istiyordu, **faz açılmadan tamamlandı**. ⛔ CDN'e geri dönmek yasak. Tek istisna hâlâ açık: Sentry loader (O-06) |
| **Durum** | `gelöst` (Faz 1.4 kapsamı; Sentry hariç) |

### O-37 — Self-hosted fontlar

| Alan | İçerik |
|---|---|
| **Ne** | Inter/Outfit font dosyaları depoda, Google Fonts CDN'i kullanılmıyor |
| **Nerede** | `fonts/` (`inter-*.ttf`, `outfit-*.woff2`, `inter.css`, `outfit.css`, `system-fonts.css`) · bağlanma örneği `dashboard.html:25`. `fonts.googleapis.com`/`fonts.gstatic.com` taraması → **3 sonuç, hepsi `ai chatbot proje/index.html`** (terk edilmiş proje kalıntısı, hiçbir yerden yüklenmiyor) |
| **Tip** | A → çözüldü |
| **Kutuda ne olur** | Hiçbir şey. LG München I (Google Fonts) kararı riskinin de kapatılmış hâli — hukuk tarafı `vendor/README.md`'de yazılı |
| **Çözüm** | `unkritisch` — ⚠️ `ai chatbot proje/` klasörü pakete girmemeli (zaten terk edilmiş); Faz 2.0 paket listesinde açıkça dışarıda kalır |
| **Durum** | `unkritisch` |

### O-38 — Referans tabloları paket seed-data'sı olarak gidecek

| Alan | İçerik |
|---|---|
| **Ne** | Katalog verileri (ICD, tarif, kasa listeleri) tenant verisi değil; image/seed ile dağıtılacak |
| **Nerede** | `db/SCHEMA.sql:931` `icd10_titles` (13.041 satır) · `:916` `heilmittel_tarif` (928) · `:1037` `krankenkassen` (94) · `:709` `dta_schluessel` (94) + `heilmittel_catalog`, `diagnosegruppen`, `kostentraeger`, `heilmittel_position`. PoC 0.1'de sıfır hatayla yüklendi (playbook §10) |
| **Tip** | B + D |
| **Kutuda ne olur** | Seed olarak gelir, kutu dış kaynağa çıkmaz. Playbook Faz 5.1 bunları export kapsamının **dışında** tutuyor — doğru: tenant verisi değil. RLS tarafı da hazır (D8 düzeltmesi dump'la geldi: salt-okunur policy, anon yazamıyor) |
| **Çözüm** | `unkritisch` — Faz 2.1 seed adımı. ⚠️ Bağlı soru: bu tablolar **güncellendiğinde** kutuya nasıl gidecek? Cevap O-34 deseni (image ile) olmalı, ama `icd10_titles` 13.041 satır — JS dosyasına commit'lenemez, migration/seed dosyası olarak gitmeli. Bu, şema dağıtım zincirinin (O-39) bir parçası |
| **Durum** | `unkritisch` (paketleme Faz 2.1; güncelleme yolu O-39'a bağlı) |

### O-39 — Şema dağıtım zinciri — çözüm belgesi yazıldı

| Alan | İçerik |
|---|---|
| **Ne** | Bugün müşterinin kutusundaki Postgres'e bir kolon eklemenin yolu yok |
| **Nerede** | `supabase/migrations/` **14 dosya** (`git ls-files supabase/` ile sayıldı) — canlıda 195 migration kayıtlı, yani repo **kaynak değil**. Şemanın gerçeği `db/SCHEMA.sql` + `db/SCHEMA-RLS.sql`, ama onlar çalıştırılabilir sıralı zincir değil, düz metin durum fotoğrafı. `onprem/schema/live_schema_2026-07-06.sql` Temmuz'da dondu |
| **Tip** | D |
| **Kutuda ne olur** | Kod dağıtımı çözülmüş (K11 + Watchtower), **şema dağıtımı çözülmemiş**. Yeni kolon isteyen her özellik SaaS'ta çalışır, kutuda 42703 (`column does not exist`) verir. `:beta` ve `:stable` aynı anda canlı olduğu için geriye dönük uyum da gerekiyor. PoC bunun nasıl ısırdığını gösterdi: `handle_new_user` trigger'ı `auth` şemasında olduğu için public dump'a girmedi ve kurulumda ayrıca yaratılması gerekti — tek trigger, 20 kutuda, gece yarısı |
| **Çözüm** | ★ **`onprem/SCHEMA-VERTEILUNG.md`** (2026-09-04) — gereksinim, seçenekler ve tavsiye orada. Özet: kendi Node runner'ımız (`api-backend/db/migrate.js`), düz SQL dosyaları image'ın içinde, api açılışında advisory-lock altında, dosya başına tek transaction, ileri-yönlü, hata olunca durup kurulum moduna geçen. 195-vs-14 için karar önerisi: **baseline** (zincir bugünden başlar, geçmiş tarih olur). Public dump'ın dışında kalan **dokuz kalem** orada envanterlendi (extension'lar · `auth` şeması ön koşulu · `on_auth_user_created` · 5 storage bucket + policy'leri · realtime publication · roller/grant'lar · Vault içeriği · sequence `setval` · `search_path`). Faz önerisi: **yeni Faz 1.7** |
| **Durum** | 🟡 **kısmen `gelöst` (04.09.2026)** — runner çalışıyor, baseline üretilmedi |

> **04.09.2026 — yapılan (ana bağlam):**
>
> - **Üç karar verildi ve kilitlendi** (belge §11): baseline · `supabase/migrations/`
>   arşive · dört haneli sıra numarası.
> - **§10'un 9 doğrulama sorusundan 7'si canlıya soruldu** (MCP). İki düzeltme çıktı:
>   canlıda **227** migration var (195 değil, `CLAUDE.md` bayattı) · `auth`/`storage`/
>   `realtime` şemalarındaki 6 trigger'ın **yalnız 1'i bizim** (`on_auth_user_created`),
>   diğer 5'i Supabase imajıyla geliyor — §2'nin bu kalemi ciddi şekilde daraldı.
>   Ayrıca doğrulandı: `pg_cron` **kurulu değil** (Faz 2.4a node-cron kararı geçerli) ·
>   `pgcrypto` **kurulu** (§9-A4 Vault alternatifi elde) · 3 extension `public`
>   şemasında (`postgis`, `pg_trgm`, `btree_gist` — `DROP SCHEMA public CASCADE`
>   üçünü de siler, `btree_gist` giderse `no_overlapping_bookings` da gider).
> - **Runner yazıldı:** `api-backend/db/migrate.js` + `migrate.test.js` (**16 test**,
>   `npm test` 119 → 135, hepsi yeşil). Advisory lock, dosya başına tek transaction,
>   checksum doğrulaması, downgrade tespiti, `-- no-transaction` kaçışı. `process.exit`
>   **yok** (O-28).
> - **`server.js`'e bağlandı:** `app.listen()`'den önce çalışıyor; hata olursa süreç
>   ölmüyor, **bakım moduna** geçiyor (503 + `/health` açık). Gerçek boot ile denendi.
> - **`Dockerfile`:** `COPY db ./db` eklendi (O-35 disiplini — `COPY . .` yok).
> - **Kapıya yıkıcı-DDL kontrolü eklendi:** gerekçesiz `DROP COLUMN`/`RENAME`
>   migration'ı commit'i reddediyor (üç senaryo test edildi).
> - **`pg` bağımlılığı:** MIT — altı paketin (pg, pg-pool, pg-protocol, pg-types,
>   pg-connection-string, pgpass) hepsi kontrol edildi, ücretli müşteriye dağıtıma
>   uygun (K8 dersi).
>
> ⚠️ **SaaS'ta bugün davranış değişmiyor:** `DATABASE_URL` orada set değil, runner
> "übersprungen" deyip geçiyor. Bu bilinçli — kod canlıya güvenle inebilsin diye.
> Değişkeni set etmek ayrı ve **bilinçli** bir adımdır (yeni env var = tip E).
>
> **Kalan (Faz 1.7 açık):** `0000_baseline.sql` üretimi — `pg_dump --schema-only` +
> dokuz kalem. **Buradan üretilemez:** MCP `pg_dump` çalıştırmıyor, ve 82 tablo +
> 155 policy + 63 fonksiyonun SQL'ini sohbetten geçirmek hem bağlamı taşırır hem
> hataya açıktır. Operatör adımı: psql/pg_dump olan bir makineden. Sonra `praxura_migrations`'a
> `0000` satırı elle düşülür (canlıda baseline **çalıştırılmaz**, yalnız deftere yazılır).

---

## 7B. Sürüm ve dağıtım standardı — bu turda açılanlar (tip F + G)

> Çözüm belgesi: ★ **`onprem/RELEASE-STANDARD.md`** (2026-09-04). Sürüm numaralandırma,
> kanallar, yükseltme yolu, yedek-önce kuralı, kurulum kabul ölçütü, tanılama paketi,
> lisans/SBOM disiplini ve sürüm çıkarma listesi orada. Aşağıdaki dört madde o belgenin
> koda karşı doğrulanmış bulgularıdır.

### O-40 — `/health` her koşulda `ok` döndürüyor; sağlık kapısı olarak kullanılamaz

| Alan | İçerik |
|---|---|
| **Ne** | Sağlık ucu sabit bir cevap veriyor; DB, şema, storage, disk, yedek durumuna hiç bakmıyor |
| **Nerede** | `api-backend/server.js:276` — `app.get('/health', (req, res) => res.json({ status: 'ok' }))`. Log atlaması `:139`. Dockerfile'da `HEALTHCHECK` **yok** (`api-backend/Dockerfile`) |
| **Tip** | G |
| **Kutuda ne olur** | Üç ayrı yerde yalan söyler: (1) Docker/Watchtower için sağlık ölçütü yok — bozuk container "sağlıklı" görünür; (2) kurulum sonrası self-check (Faz 2.4) buna dayanamaz; (3) tanılama paketinde işe yaramaz. Somut hâli: DB düşse, şema yarım kalsa, disk dolsa `/health` yine 200 `ok` döner ve müşteri "sistem çalışıyor ama hiçbir şey açılmıyor" der — teşhis edilemeyen en pahalı arıza sınıfı |
| **Çözüm** | **Faz 2.4b** (yeni) — ikiye ayrılır: `/health` liveness (ucuz, anonim, içeriksiz), `/status` derin (10 alan: db · schema · auth · storage · disk · backup · data_key · license · zeit · version), oturum gerektirir. Ayrıntı: `RELEASE-STANDARD.md` §6.5 |
| **Durum** | 🟡 **kısmen `gelöst` (04.09.2026)** — sahte yeşil kapandı, derin `/status` bekliyor |

> **04.09.2026 — yapılan (ana bağlam):**
> `/health` ikiye ayrıldı ([server.js:276](../api-backend/server.js#L276)):
> **`/health`** = canlılık, DB'ye bakmaz, her zaman 200 + `version` + `uptime_s`;
> **`/health/ready`** = hazırlık, `profiles` üzerinde head-sorgu (PHI yok, 4 sn timeout),
> DB düşükse **503** döner. Ayrıca `Dockerfile`'a `HEALTHCHECK` eklendi — canlılığı
> sorguluyor, hazırlığı değil: DB dalgalanması **sağlıklı bir prosesi** hasta işaretlememeli.
>
> Ayrımın gerekçesi tek cümlede: canlılık sorusu *"image ayağa kalkıyor mu"*, hazırlık
> sorusu *"çalışabiliyor mu"* — ikisini tek uca bindirmek, smoke-test'i dummy
> credential'la çalışamaz hâle getirirdi.
>
> **Kalan:** §6.5'teki 10 alanlı derin `/status` (schema · storage · disk · backup ·
> data_key · license · zeit) hâlâ yazılmadı → **Faz 2.4b** açık kalıyor.

### O-41 — CI image'ı hiç çalıştırmadan yayınlıyor; Watchtower 60 saniyede canlıya alıyor

| Alan | İçerik |
|---|---|
| **Ne** | Yayın hattında image'ın **ayağa kalktığını** doğrulayan hiçbir adım yok; kabul kapısı yalnız birim testleri |
| **Nerede** | `.github/workflows/publish-calendar-api.yml` — `test` job'u `npm test` koşuyor (`:36-38`), `build-and-push` job'u `docker/build-push-action` ile doğrudan basıyor (`:66-76`). `docker run` yok. Watchtower: `api-backend/docker-compose.yml` → `--interval=60`, `pull_policy: always`, `restart: unless-stopped` |
| **Tip** | F + G |
| **Kutuda ne olur** | Boot'ta ölen bir image testleri geçer, basılır, 60 saniyede canlıya çıkar ve container sonsuz crash-loop'a girer. **Bu SaaS'ta bir kez oldu** (`SUPABASE_SERVICE_KEY` yazım hatası, `CLAUDE.md`). On-prem'de aynı olay **20 praxis'in aynı sabah çalışmaması** demektir ve K10 gereği hiçbirine giremeyiz. Ayrıca compose kutuda yaşar, Watchtower ona dokunmaz — düzeltmeyi compose'a yazmak işe yaramaz (2026-08-15 dersi, `docker-compose.yml` yorumunda yazılı) |
| **Çözüm** | Dört katman, `RELEASE-STANDARD.md` §6.3: (1) **Faz 4.3a** CI'da gerçek CMD ile `docker run` + `/health` 200 (tek başına en yüksek getirili adım; bu olay tam burada yakalanırdı); (2) **Faz 4.3b** `X.Y.Z` değişmez etiket + 72 saat soak + `:stable`'ın elle taşınması; (3) kutuda crash-loop yerine **bakım modu** (O-28 ile aynı istek); (4) kutu Watchtower'ı saatlik, `latest` kullanılmaz |
| **Durum** | 🟡 **kısmen `gelöst` (04.09.2026)** — katman (1) yazıldı, (2)(3)(4) açık |

> **04.09.2026 — yapılan (ana bağlam):**
> `publish-calendar-api.yml`'ye **smoke-test adımı** eklendi, `build-and-push`'tan
> **önce** çalışıyor: image `load: true` ile kurulur, **gerçek `CMD`'siyle**
> (`pm2-runtime`, `npm start` veya `npx` ile DEĞİL) dummy credential'larla ayağa
> kaldırılır, 30 saniye boyunca `/health`'in 200 dönmesi beklenir. Container erken
> ölürse döngü kırılır ve `docker logs` dökülür. Yeşil değilse **image basılmaz.**
>
> Bu, O-41'in tarif ettiği iki olayın ikisini de yakalardı: `booking/`'in COPY
> listesinden düşmesi (`ERR_MODULE_NOT_FOUND`) ve `SUPABASE_SERVICE_KEY` yazım
> hatası (`exit(1)`). İkisi de birim testlerinden yeşil geçmişti.
>
> ⚠️ **Doğrulama durumu:** yerelde Docker yok, adım **CI'da ilk push'ta** sınanacak.
> Hata yönü güvenli: kapı bozuksa yayını durdurur, bozuk image geçirmez.
>
> **Kalan:** (2) `X.Y.Z` değişmez etiket + 72 saat soak + `:stable`'ın elle taşınması
> → **Faz 4.3b** · (3) crash-loop yerine bakım modu (O-28) · (4) kutuda saatlik
> Watchtower, `latest` kullanılmaması.

### O-42 — Pakete giren bileşenlerin lisans denetimi tek seferlik; sürekli kapı yok

| Alan | İçerik |
|---|---|
| **Ne** | K8 (n8n Sustainable Use License) bir kez elle fark edildi; ikinci bir bileşenin aynı tuzağa düşmesini engelleyen hiçbir mekanizma yok |
| **Nerede** | Repoda SBOM üretimi yok (`grep -ri "sbom\|cyclonedx\|spdx" --include=*.yml --include=*.json` → yayın hattında sıfır). `onprem/NOTICE.md` yok. `onprem/supabase-docker/` upstream vendor kopyası — içindeki her image'ın lisansı ayrı ayrı kaydedilmiş değil |
| **Tip** | G |
| **Kutuda ne olur** | Ücretli müşteriye dağıtım hakkı olmayan bir bileşen pakete girerse bu, kutuda değil **mahkemede** patlar. n8n'i paketleme planı yazılırken yakaladık; bir sonrakini yakalayacak bir şey yok. Ayrıca CRA 11 Aralık 2027'de SBOM'u zaten zorunlu kılıyor (`LEGAL_ONPREM_REQUIREMENTS.md` §6/E7-E8) |
| **Çözüm** | **Faz 6.1b** — iki ayrı envanter: npm tarafı SBOM ile üretilir (CycloneDX), compose image'ları **elle** `onprem/NOTICE.md`'de tutulur (`npm sbom` Kong/GoTrue/Studio'yu görmez — asıl risk orada). İzinli lisans listesi (MIT/Apache-2.0/BSD/ISC/PostgreSQL/MPL-2.0/0BSD/CC0), yasak liste (GPL/AGPL/SSPL/BUSL/Elastic/Commons Clause/"Sustainable Use"). Kapı: compose'daki `image:` satır sayısı taban olur, artış = red (kayıtsız tabloda commit reddeden `check-tabellen-register.sh` ile aynı mantık). Ayrıntı: `RELEASE-STANDARD.md` §8 |
| **Durum** | `offen` — playbook Faz 6.1a SBOM'u anıyor ama **sürekli kontrol** mekanizması yok |

### O-43 — Sürüm/kanal manifesti yok; uzun süre kapalı kalmış kutunun davranışı tanımsız

| Alan | İçerik |
|---|---|
| **Ne** | Hangi sürümün kırıcı olduğu, hangisinin atlanamayacağı, hangisine geçilmemesi gerektiği makine-okunur hiçbir yerde yazılı değil |
| **Nerede** | Repoda `releases.json` / `CHANGELOG.md` **yok**; yayın hattı yalnız `latest` + kısa sha basıyor (`publish-calendar-api.yml:64-65`). Sürüm numarası kavramı kodda hiç geçmiyor |
| **Tip** | G + D |
| **Kutuda ne olur** | Bugün sonuç yok (tek kanal, tek sürüm). Ücretli kutu çıktığında: lisansı pasifken güncelleme çekemeyen bir kutu (Faz 3.4) altı ay sonra açıldığında 6 MINOR birden atlar. Bunun güvenli olup olmadığını söyleyen **hiçbir kayıt yok** — Sentry ve GitLab bu sorunu "hard stop" / "required upgrade stop" listeleriyle çözüyor, bizde liste yok |
| **Çözüm** | **Faz 2.9** (yeni) — `onprem/releases.json`: sürüm başına `durak` (atlanamaz mı), `otomatik_adim`, `elle_adim[]`, `not_url`. Runner atlamayı **reddeder** (`SCHEMA-VERTEILUNG.md` §6.3'ün "bilmediğim kayıt var" refleksiyle aynı). ★ Asıl çözüm mekanik değil kural: **migration yalnız SQL'e dayanır, aradaki sürümün uygulama koduna bağımlı olamaz** — bu kural durak sınıfını tümden ortadan kaldırır, manifest yalnız istisna için durur. Ayrıntı: `RELEASE-STANDARD.md` §3.3-§3.4 |
| **Durum** | `geplant` (Faz 2.9) — çözüm belgesi `onprem/RELEASE-STANDARD.md` |

---

## 8. Kapı tabanları — `tools/check-onprem.sh` için

> Kapı: `tools/check-onprem.sh`, `.githooks/pre-commit`'e bağlı
> (kardeşleri: `check-dashboard-size.sh`, `check-namen.sh`, `check-tabellen-register.sh`).
> Taban dosyası: `tools/.onprem-baseline`. Kaçış: `SKIP_ONPREM_GATE=1`.
>
> Kural: **taban artamaz, azalabilir.** Sayı düşerse taban otomatik sıkışır, kazanım geri
> alınamaz — `check-dashboard-size.sh` ile aynı mantık.
>
> ✅ **04.09.2026: kapı kuruldu** — `tools/check-onprem.sh` + `tools/.onprem-baseline`.
> Aşağıdaki tablo **kapının ölçtüğü** değerlerle hizalandı; iki sayı düzeltildi (aşağıda
> işaretli). Ölçüm yöntemi: `git grep --cached`, eşleşen **satır** sayısı. O-20 bu kapının
> kurulmasıyla kapanabilir hâle geldi; commit numarası girildiğinde `gelöst` olur.

| Sayaç | Taban (2026-09-04) | Kapsam |
|---|---|---|
| `n8n.infinitymade.de` | **26** | `*.js` `*.html` `*.mjs`; `archive/` `vendor/` `funktionen/` `onprem/` `.claude/` `node_modules/` `index-old.html` `ai chatbot proje/` hariç |
| `app.praxura.de` (uygulama yüzeyi) | **19** | `dashboard.js` `dashboard.html` `employee-signup.js` `admin-login.js` `api-backend/server.js` — pazarlama/blog hariç (O-04) |
| `api/` fonksiyon sayısı | **12** | `find api -name "*.js" -not -path "api/_lib/*"` — artış = red (limit + G8) |
| Üçüncü-parti `<script src="http…">` | **11** | Yalnız Sentry loader. ⚠️ Sicilin O-06'da "12 satır / 11 dosya" yazıyordu; kapı 04.09.2026'da index üzerinden **11 satır** ölçtü — geçerli sayı kapınınkidir (`tools/.onprem-baseline` → `ext_script=11`). Yeni host = red |
| `N8N_` env referansı | **3** | `server.js:1053` `:1806` `:1809` — artış = red, hedef sıfır (Faz 1.2) |
| `.supabase.co` sabit referansı (ürün kodu) | **1** | ⚠️ Sicil bunu **0** sanıyordu; kapı ölçümünde 1 çıktı: `api-backend/test_schema.js:5` (test dosyası, env fallback'li — O-05'te zaten istisna olarak yazılıydı, sayaçta unutulmuştu). `ops/` ve `vercel.json` hariç. Artış = red |
| `fonts.googleapis.com` / `esm.sh` / `unpkg` / `jsdelivr` / `cdnjs` | **0** | Uygulama kodu; `ai chatbot proje/` hariç. Sıfırdan artış = red (Konsey 2026-08-13 S3) |
| `latest` etiketi yayın hattında | **1** | `.github/workflows/publish-calendar-api.yml:64` — hedef **0** (Faz 4.3b, `X.Y.Z` + kanal etiketleri). Artış = red |
| Yıkıcı DDL kanıtı | — | Yeni migration dosyasında `DROP COLUMN` / `DROP TABLE` / `RENAME COLUMN` / `SET NOT NULL` / `DROP CONSTRAINT` varsa dosya başında `-- ZWEISTUFIG: <no> · <gerekçe>` satırı **zorunlu** (`SCHEMA-VERTEILUNG.md` §6.2, `RELEASE-STANDARD.md` §4.7) |
| Migration'lı PATCH | — | Sürüm PATCH ise `db/migrations/` altında yeni dosya olamaz (`RELEASE-STANDARD.md` §2.2). Release listesi adım 1 |
| On-prem compose `image:` satırı | *(dosya henüz yok)* | `onprem/docker-compose.yml` yazıldığında taban belirlenir; artış, `onprem/NOTICE.md`'de karşılık gelen lisans satırı eklenene kadar **red** (O-42) |

---

## 9. Durum özeti (2026-09-04, ilk tarama)

| Durum | Adet | Maddeler |
|---|---|---|
| `offen` | 10 | O-09 · O-11 · O-18 · O-20 · O-23 · O-32 · O-33 · **O-40** · **O-41** · **O-42** |
| `geplant` | 21 | O-01 · O-02 · O-03 · O-06 · O-07 · O-08 · O-10 · O-13 · O-15 · O-16 · O-19 · O-21 · O-25 · O-26 · O-27 · O-28 · **O-29** · O-30 · O-31 · O-39 · **O-43** |
| `unkritisch` | 11 | O-04 · O-05 · O-12 · O-14 · O-17 · O-22 · O-24 · O-34 · O-35 · O-37 · O-38 |
| `gelöst` | 1 | O-36 (vendor yerelleştirmesi) |

> **04.09.2026 — üçüncü tur (sürüm/dağıtım standardı):** O-29 `offen` → `geplant` (gereksinim
> `RELEASE-STANDARD.md` §4.5'te yazıldı). Dört yeni madde açıldı: O-40 · O-41 · O-42 · O-43.
> Toplam **43** madde.

> Sayılar madde listesiyle birlikte okunur; bir madde birden fazla faza değebilir.

### Playbook'un eksikleri (bu taramada çıkanlar)

Aşağıdaki bulguların playbook'ta **karşılığı yok** — plan güncellenene kadar `offen` kalırlar:

1. ~~**O-39 şema dağıtım zinciri** — hiçbir fazda yok.~~ **04.09.2026: çözüm belgesi yazıldı** — `onprem/SCHEMA-VERTEILUNG.md`. Playbook'a **Faz 1.7** olarak eklenmeli; üç karar kullanıcıda (belge §11).
2. **O-11 Fahrtenbuch edge function kaynağı repoda yok** — playbook D1 "Kaynak: `supabase/functions/`" diyor, o dizin git geçmişinde hiç olmamış. Faz 1.5 taşınacak kod olmadan başlayamaz.
3. ~~**O-29 `DATA_ENCRYPTION_KEY`** — hiçbir fazda geçmiyor.~~ **04.09.2026: kapandı** — `onprem/RELEASE-STANDARD.md` §4.5, dört kural, Faz 2.1/2.2/2.3/2.4'e bağlandı.
4. **O-09 Apify/B2B özelliği** — playbook hiç anmıyor; merkez/kutu ayrımına yazılmalı.
5. **O-18 admin panelinin on-prem'de ne göstereceği** — "admin/* → dokunma" deniyor ama panelin veri kaynağı kutuya taşınıyor.
6. **O-23 `delete_expired_accounts()`** — playbook D5 "zamanlayıcı yok" diyor, **çürütüldü** (`server.js:3400`); buna karşılık kutuda kendi verisini silme riski hiçbir yerde yazılı değil.
7. **O-33 plan farkının teknik karşılığı** — lisans formatı donmadan cevaplanmalı.
8. **O-32 `module_visibility` ile lisansın ilişkisi** — Faz 3.3'te yazılı değil.
9. **O-40 `/health` sahte yeşil** — Faz 2.4 healthcheck istiyor ama bugünkü ucun her koşulda `ok` döndüğünü görmemiş. Yeni görev: **Faz 2.4b**.
10. **O-41 image smoke-test ve soak** — Faz 4.3 kanal sistemini istiyor, ama image'ın ayağa kalktığını doğrulayan adım ve `:stable` öncesi bekleme süresi hiçbir fazda yok. Yeni görevler: **Faz 4.3a / 4.3b**.
11. **O-42 lisans/SBOM sürekli kapısı** — Faz 6.1a SBOM'u anıyor, kapıyı anmıyor. Yeni görev: **Faz 6.1b**.
12. **O-43 sürüm/kanal manifesti** — `releases.json`, durak kavramı ve sürüm notu hiçbir fazda yok. Yeni görev: **Faz 2.9**.
13. **Kurulum ön-kontrolü ve kabul ölçütü** — Faz 2.1 `install.sh` diyor ama "kurulum ne zaman başarılı sayılır" tanımı yok. Yeni görev: **Faz 2.1a**, ölçüt `RELEASE-STANDARD.md` §5.4 (14 kontrol).
14. **Tanılama paketi içeriği** — Faz 2.5 butonu istiyor, içeriği tarif etmiyor. Yeni görev: **Faz 2.5a**, liste `RELEASE-STANDARD.md` §7.3.

### Playbook'ta çürütülenler

- **D5** (`delete_expired_accounts()` zamanlayıcısı yok) → `widerlegt`, bkz. O-23.
- **D1** (edge function kaynağı `supabase/functions/`'ta) → `widerlegt`, bkz. O-11.
- **Faz 1.4** (CDN bağımlılıklarını lokale al) → faz açılmadan tamamlandı, bkz. O-36.
- **§9-A4** (Vault self-host'ta çalışır mı) → PoC 0.2'de çalıştığı doğrulandı (playbook §10'da kayıtlı).
