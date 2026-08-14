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
| `supabase-js.js` | `@supabase/supabase-js@2.112.3` | 13 sayfa/modül (`createClient`) |
| `node-forge.js` | `node-forge@1.3.1` | `dashboard.js` → `loadForge()`, §302 PKCS#7 imzalama (tembel yüklenir) |

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

Bu turda **yalnızca esm.sh** kapatıldı. Hâlâ dışarıdan gelen ve ayrı kartları
olanlar: FullCalendar (`kalender.html`, jsDelivr) · Sentry loader
(`js-de.sentry-cdn.com`) · Google Fonts · Wistia · Stripe.
Stripe ödeme için zorunludur ve yerelleştirilemez.
