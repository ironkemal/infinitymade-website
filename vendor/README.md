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
| `cropperjs/cropper.min.js` + `.css` | `cropperjs@1.6.1` (cdnjs → 27.08.2026) | `dashboard.html:26-27` → Logo/Profilbild zuschneiden (`dashboard.js:11935`, `13141`) |

Cropper.js de global (UMD) script'tir. cdnjs'ten indirilen iki dosyanın
sha256'sı **bağımsız ikinci bir kaynakla** (unpkg, yani npm artefaktının kendisi)
karşılaştırıldı ve birebir aynı çıktı — indirilen şeyin gerçekten yayınlanmış
sürüm olduğu böyle doğrulandı, "indirdim, çalışıyor" ile değil:

```
sha256  cropper.min.js   b20765dff4a5c832a07a5e86d2f46d429ba60024b2c8a0a746d7f5ef5eaad33c
sha256  cropper.min.css  f7f61b6cc4219716618f8295502eadf36f9612f4a4a8fadfce9d165bd58dbac4
```

MIT lisans başlığı iki dosyada da **korundu** — silinmesi UrhG/MIT NOTICE
yükümlülüğünü ihlal ederdi. Aynı işlemde `cdnjs.cloudflare.com`
`vercel.json`'daki CSP'nin **hem `script-src` hem `style-src`** yönergesinden
çıkarıldı; yoksa kapı açık kalır ve yerelleştirme yalnız kâğıt üzerinde olurdu.

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

Son olarak **airgap testi**: tüm üçüncü-parti host'lar bloklanıp uygulama yine
de açılmalı. Bu, on-prem release checklist'inin zorunlu maddesidir.

```bash
for h in "https://esm.sh/**" "https://cdn.jsdelivr.net/**" \
         "https://cdnjs.cloudflare.com/**" "https://js-de.sentry-cdn.com/**" \
         "https://browser.sentry-cdn.com/**" "https://fonts.googleapis.com/**" \
         "https://fonts.gstatic.com/**" "https://fast.wistia.net/**"; do
  playwright-cli -s=praxura route "$h" --status=404
done
playwright-cli -s=praxura goto "https://app.praxura.de/login.html"
playwright-cli -s=praxura console          # ölçüt: uygulamayı durduran hata YOK
```

### Sonuç — 2026-08-14

| | |
|---|---|
| `login.html` | ✅ açıldı, giriş formu render oldu |
| `dashboard.html` | ✅ `dashboard.js` çalıştı, oturumsuz olduğu için login'e yönlendirdi |
| `vendor/supabase-js.js` | ✅ `createClient: function` |
| `vendor/node-forge.js` | ✅ `pkcs7 · pki · asn1` |
| `vendor/fullcalendar/…` | ✅ `FullCalendar.Calendar: function` |
| Konsol | **tek hata:** Sentry loader 404 |

**Bulgu:** Sentry loader artık açılış yolundaki **son dış runtime bağımlılığı.**
Bloklandığında uygulama çalışmaya devam ediyor (ölümcül değil), ama on-prem
imajında bu satırın da gitmesi gerekiyor — `legal-de`'nin sert şartı "tek bir
dış runtime çağrısı kalamaz" diyor. Ayrı kart: *"Sentry CDN loader — on-prem'de
kapatılmalı."*

## Kapsam dışı kalanlar

Kapatılanlar: **esm.sh** (supabase-js, node-forge) ve **jsDelivr**
(FullCalendar, `attendance.js`'in Supabase'i).

Hâlâ dışarıdan gelenler — ayrı kartları var:

| Ne | Nerede | Not |
|---|---|---|
| **Sentry loader** | her sayfa (`js-de.sentry-cdn.com`) | On-prem'de yerelleştirme değil **kapatma** doğru olabilir — ayrı karar |
| ~~**Google Fonts**~~ | — | ✅ **KAPANDI.** Fontlar `fonts/system-fonts.css` ile self-hosted; 27.08.2026'da CSP'den de çıkarıldı (`style-src`/`font-src`). Kodda tek referans kalmadı — tarandı. |
| **Wistia** | `index.html:1202/1211/1220` | ⛔ **Önceliği yükseldi.** `legal-de` 27.08.2026: Wistia player boot'ta **localStorage okuyor** → § 25 Abs. 1 TDDDG Einwilligung gerektiriyor (cookie olmaması kurtarmıyor). Ayrıca `datenschutz.html`'de hiç adı geçmiyor (Art. 13 lit. e) ve `cookie-consent.js` banner'ı "cookie-frei, keine personenbezogenen Daten" diyor — Wistia yüklenince bu beyan yanlış olur (UWG § 5). Fix: Zwei-Klick-Lösung ya da videoyu kendi alanımızdan servis et. |
| **Stripe** | ödeme | **Yerelleştirilemez ve gerekmez** — PCI gereği Stripe'ın kendi alanından yüklenmek zorunda |
