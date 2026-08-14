# vendor/ — yerel kopyalar, CDN yok

Buradaki dosyalar tarayıcıya **kendi sunucumuzdan** gider. Daha önce
`https://esm.sh/...` üzerinden çekiliyorlardı; Konsey 2026-08-13 kararıyla
(S3) yerelleştirildi.

## Neden

`legal-de`, Art. 32(1)(b)+(c) DSGVO gerekçesiyle bunu **bu haftaya** çekti:

- **Verfügbarkeit** — CDN düşerse dashboard hiç açılmaz. Hasta verisi işleyen
  bir uygulamanın çalışabilirliği üçüncü tarafa bağlı olamaz.
- **Integrität** — CDN ele geçirilirse tarayıcıda keyfi kod çalışır ve
  oturumdaki **tüm hasta verisine** erişir. Klasik tedarik zinciri riski.
- İkincil: LG München I, 20 O 14368/19 (Google Fonts) analojisi — yerel
  barındırma mümkünken üçüncü tarafa IP aktarımı `berechtigtes Interesse`
  ile örtülemez.

Ayrıca **on-premise için sert şart**: müşterinin kendi sunucusunda çalışan
imajda tek bir dış runtime çağrısı kalamaz, yoksa "Ihre Daten bleiben auf
Ihrem Server" iddiası UWG §5 ve §434 BGB açar.

## Dosyalar

| Dosya | Kaynak | Nerede kullanılıyor |
|---|---|---|
| `supabase-js.js` | `@supabase/supabase-js@2.112.3` | 14 sayfa/modül (`createClient`) |
| `node-forge.js` | `node-forge@1.3.1` | `dashboard.js` → `loadForge()`, §302 PKCS#7 imzalama (tembel yüklenir) |
| `fullcalendar/index.global.min.js` | `fullcalendar-scheduler@6.1.11` | `kalender.html` |
| `fullcalendar/locales-all.global.min.js` | `@fullcalendar/core@6.1.11` | `kalender.html` |

FullCalendar dosyaları global (UMD) script'tir, ESM değil — paketlemeye gerek
yok, jsDelivr'deki dosyanın birebir kopyasıdır. Dış referans içermedikleri
doğrulandı.

> ⚠️ **`esm.sh` aramak yetmez.** `attendance.js` Supabase'i
> `cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm` üzerinden çekiyordu ve ilk
> taramada bu yüzden kaçtı. Yeni bir CDN aramasında **host adı değil kalıp**
> aranır: `grep -rnE "https?://[a-z0-9.-]+/.*\.(js|mjs)"`.

`ops/vendor/supabase-js.js` bunun kopyasıdır — Ops-Dashboard **ayrı bir Vercel
projesi** olduğu için `../vendor` yolunu göremez.

## Nasıl üretildi / nasıl güncellenir

Bu bir build adımı **değildir** — çıktı depoda durur, tarayıcı doğrudan onu
alır. Aşağıdaki komutlar yalnızca sürüm yükseltirken elle çalıştırılır.

```bash
npm install --save-dev @supabase/supabase-js@<sürüm> node-forge@<sürüm> esbuild

npx esbuild tools/vendor/supabase-entry.js \
  --bundle --format=esm --platform=browser --target=es2020 \
  --minify --legal-comments=none --outfile=vendor/supabase-js.js

npx esbuild tools/vendor/forge-entry.js \
  --bundle --format=esm --platform=browser --target=es2020 \
  --minify --legal-comments=none --outfile=vendor/node-forge.js

cp vendor/supabase-js.js ops/vendor/supabase-js.js
```

Sonra çağrı yerlerindeki `?v=YYYYMMDD` sürümünü **yükselt** (cache busting).

### ⚠️ Düz indirme çalışmaz

`curl https://esm.sh/@supabase/supabase-js@2 -o vendor/supabase-js.js` **kırık
bir dosya üretir.** esm.sh 178 baytlık bir yönlendirme parçası döner; içindeki
`/node/process.mjs` gibi göreli import'lar zincirleme devam eder
(`process → events → tty`). Bu yüzden npm paketinden esbuild ile paketliyoruz.

## Doğrulama

Yükseltmeden sonra ikisi de çalıştırılır:

```bash
# 1) Dış import kalmamış olmalı — çıktı BOŞ olmalı
grep -oE 'from"[^"]+"|import\("[^"]+"\)' vendor/supabase-js.js | sort -u

# 2) Duman testi
node -e "import('./vendor/supabase-js.js').then(m=>console.log(typeof m.createClient))"
node -e "import('./vendor/node-forge.js').then(m=>console.log(typeof (m.default||m).pkcs7))"
```

Son olarak **airgap testi**: ağı kes, `app.praxura.de` açılmalı (giriş ekranı
gelene kadar). Bu, on-prem release checklist'inin zorunlu maddesidir.

## Kapsam dışı kalanlar

Kapatılanlar: **esm.sh** (supabase-js, node-forge) ve **jsDelivr**
(FullCalendar, `attendance.js`'in Supabase'i).

Hâlâ dışarıdan gelenler — ayrı kartları var:

| Ne | Nerede | Not |
|---|---|---|
| **Cropper.js** | `dashboard.html:26-27` (cdnjs) | Sıradaki. `dashboard.html` başka çalışmanın altındaydı, ertelendi |
| **Sentry loader** | her sayfa (`js-de.sentry-cdn.com`) | On-prem'de yerelleştirme değil **kapatma** doğru olabilir — ayrı karar |
| **Google Fonts** | `fonts.googleapis.com` / `gstatic` | Aynı hukuki gerekçe (LG München I), aynı sweep'te kapatılabilir |
| **Wistia** | pazarlama sayfaları | Hasta verisi bağlamı değil, önceliği düşük |
| **Stripe** | ödeme | **Yerelleştirilemez ve gerekmez** — PCI gereği Stripe'ın kendi alanından yüklenmek zorunda |
