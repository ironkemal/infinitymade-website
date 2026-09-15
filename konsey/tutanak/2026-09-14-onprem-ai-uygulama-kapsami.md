# Konsey Kararı — On-prem AI (Rezept-Scan): 2026-09-12 kararının uygulama kapsamı

Tarih: 2026-09-14 · Oturan üyeler: legal-de, onprem, gkv-302, guvenlik, muhalif, deger-mi, fonksiyon-ustasi

> **Not — bu bir yeniden açma DEĞİL.** Kemal, amiral özelliği (AI Rezept-Scan) on-prem'de
> kaybetmek istemediğini söyleyerek 2026-09-12 kararını (Seçenek E) sorguladı. Konsey
> araştırdı ve `muhalif`'in bulduğu şey belirleyici oldu: kararın kendi yeniden-açma
> koşulları (IONOS C5 Typ-2 / Microsoft C5 kapsam teyidi / ölçülmüş açık model) **hiçbiri
> bugün sağlanmadı** — `legal-de` doğruladı, Microsoft'un sayfası hâlâ "müstakil C5 raporu
> Temmuz 2026'da yayımlanacak" diyor (Kasım 2025 tarihli, güncellenmemiş). **Karar E aynen
> geçerli.** Ama E'nin kendisi zaten BYO-key'i içeriyordu ("K4 iptal değil, TETİKLENMEMİŞ,
> env satırı olarak kâğıtta kalır") — bugün yapılan şey yeni bir seçim değil, E'nin daha
> önce yazılmamış bir parçasının uygulama netliğe kavuşturulmasıdır.

## KARAR

Sağlayıcı seçimi (hangi AI, hangi model) **ertelenmeye devam eder.** Ama E kararının izin
verdiği sağlayıcı-bağımsız env katmanı **şimdi inşa edilir** — bu bir sağlayıcı kararı
değil, gecikmiş bir altyapı adımıdır:

1. `azureClient.js:36-43`'teki production hard-`throw` kaldırılır — AI anahtarı olmadan
   kutu açılabilir hale gelir, uyarı loglar (O-07'nin bugün sağlanmayan şartı).
2. `api-backend/ai/llmClient.js` yazılır: `AI_PROVIDER`/`AI_ENDPOINT`/`AI_API_KEY`/
   `AI_MODEL_*` env değerlerini okur (bu değerler `.env.template` ve `docker-compose.yml`'de
   zaten tanımlı, kodda **sıfır okuyucu** — `onprem` ve `fonksiyon-ustasi` birbirinden
   bağımsız aynı boşluğu buldu). `azureClient.js` geçiş boyunca ince sarmalayıcı kalır.
3. `gkv-302`'nin dört kapısından **bugün ihlal edilen** kapı 4 düzeltilir:
   `requires_manual_review` ve `rezept-normalize` eşleşmesi modelin kendi confidence
   skorundan değil, katalog/string-mesafe eşleşmesinden türetilir. Bu, BYO-key'den
   bağımsız, SaaS'ta da geçerli, aktif bir sessiz-yanlış-kabul riski.
4. `ai_audit_log` üzerinden Beta-1/Beta-2'nin gerçek OCR kullanım oranı ölçülür — "amiral
   özellik" iddiası varsayım değil, sayı ile konuşulsun.

**Ayar ekranı, kurulum sihirbazı, çoklu dil metni, "AI sağlayıcınızı seçin" satış vaadi
YAZILMAZ.** Tetikleyici: ilk ödeyen on-prem müşteri imzalar VEYA somut bir satış görüşmesi
AI'ı sorar ve kayda geçer.

## Gerekçe

`legal-de`'nin araştırması yeniden açma koşullarının sağlanmadığını gösterdi. `muhalif`'in
gözlemi doğru çıktı: BYO-key zaten E kararının bir parçasıydı — bugünkü baskı yeni bir olgudan
değil sıralama sabırsızlığından geliyordu (henüz tek canlı müşteri yok, `podoloji` AI'ı zaten
"konfor, satış argümanı değil" diye sınıflandırmıştı). Ama `onprem` + `fonksiyon-ustasi`'nin
bağımsız olarak bulduğu ölü kablolama (env tanımlı, okunmuyor) gerçek bir kusurdu ve AI
tartışmasından bağımsız düzeltilmeliydi — bu yüzden K1+K2 şimdi yapılır, UI ertelenir.

## Ödün verilenler

On-prem müşteriler bugünden itibaren hâlâ AI OCR'ı "kur ve kullan" şeklinde alamayacak —
ilk müşteriye/talebe kadar özellik kutuda pasif kalır. "AI OCR on-prem'de de çalışır" satış
vaadi hâlâ verilemez.

## Uzlaşma

Tüm 7 üye K1+K2'nin şimdi yapılmasında hemfikir. `deger-mi`, `muhalif`, `guvenlik` birbirinden
bağımsız olarak ayar ekranı/sihirbazın **şimdi yazılmaması** sonucuna vardı. `legal-de` +
`onprem` + `guvenlik` + `gkv-302` BYO-key mimarisinin (istek müşterinin kutusundan doğrudan
sağlayıcıya, Praxura sunucusuna hiç uğramadan) hukuken/teknik olarak temiz olduğunda hemfikir.

## Anlaşmazlık

Yok. `gkv-302`'nin "kapılar llmClient'ın üstünde olmalı" koşulu zaten K2 kapsamına alındı.

## Kör noktalar

- `muhalif`'in açtığı, kimsenin sormadığı soru: **SaaS'taki mevcut Azure zinciri kendisi
  §393 kapsamında mı?** Eğer kapsamdaysa "on-prem'e AI koyamıyoruz" değil "SaaS'ta zaten
  koymuşuz" sorunu var — ayrı, acil bir `legal-de` sorusu, bu karara dahil değil.
- `guvenlik`: `Authorization` başlığının Sentry/`ai/audit.js`'te scrub edildiği
  doğrulanmadı — kontrol edilmeli.
- `fonksiyon-ustasi`: `calendar_integrations` tablosunda Google OAuth token'ları
  (`access_token`/`refresh_token`) düz metin (`text` kolon) tutuluyor. Bu karara ait değil
  (farklı sır, farklı akış) ama ayrı bir bulgu olarak not edildi.

## Uygulama — builder'a

- [ ] `azureClient.js:36-43` production throw kaldır, warning'e çevir — K1
- [ ] `api-backend/ai/llmClient.js` yaz (env-tabanlı, `AI_PROVIDER`/`AI_ENDPOINT`/
      `AI_API_KEY`/`AI_MODEL_*` okur), `azureClient.js` geçiş boyunca ince sarmalayıcı — K2
- [ ] `gkv-302` kapı 4: `requires_manual_review` + `rezept-normalize` eşleşmesi model
      confidence'ından değil katalog/string-mesafe eşleşmesinden türesin
      (`rezept-ocr.js`, `rezept-normalize.js`) — K2, SaaS'ta da geçerli, öncelik yüksek
- [ ] `ai_audit_log`'da Beta-1/Beta-2 OCR kullanım oranı sorgusu — K0
- [ ] `onprem/REGISTER.md`: **O-105** (ölü `AI_*` env kablolaması, tanımlı ama okunmuyor)
- [ ] `guvenlik/REGISTER.md`: **S-28** (BYO-key gelince: dosya-bazlı anahtar saklama —
      `AI_API_KEY_FILE`, `chmod 600`, yedek kapsamı dışı; `DATA_ENCRYPTION_KEY`/`phi-encrypt`
      KULLANILMASIN, aynı güven sınırında sır taşır) — ileri referans, kod yazılmıyor

> K = karmaşıklık sınıfı, `TODO.md` §1'deki T-hafta numaralarıyla karıştırılmaz.

## Backlog (karara dahil DEĞİL)

- Ayar ekranı + sihirbaz + 3 dil + anahtar dosyası UI — ilk ödeyen on-prem müşteri veya
  somut satış talebi tetikler
- SaaS'ın kendi Azure zincirinin §393 kapsamı sorusu (`muhalif`'in açtığı ayrı soru)
- `calendar_integrations` düz metin token sorunu — ayrı incelenmeli
- IONOS AI Model Hub / Microsoft C5 belgesi takibi devam eder (mevcut yeniden açma
  koşulları değişmedi)
- `legal-de`: sihirbaz yazılmadan ÖNCE §203 StGB "mitwirkende Person" sorusu için 1 saatlik
  avukat danışması

## Sert veto

`legal-de` ⛔ **Seçenek A** (merkezi Azure relay, on-prem'de de SaaS'taki gibi) üzerinde
aynen duruyor — Azure'ın C5 raporu ne çıkarsa çıksın, merkezi relay olduğu sürece testat
**bizim** olmalı, Azure'ınki değil. Dolanma yolu: BYO-key — istek müşterinin kutusundan
doğrudan sağlayıcıya gider, Praxura sunucusuna hiç uğramaz.
