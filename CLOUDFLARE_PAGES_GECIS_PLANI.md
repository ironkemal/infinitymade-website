# Cloudflare Pages Geçiş Planı — `praxura.de` Vercel'den çıkıyor

> **Durum:** plan · **Karar:** Kemal, 12.10.2026 — tanıtım sitesi Cloudflare Pages'e,
> **SaaS (`app.praxura.de`) kapandıktan sonra** (playbook K1, depo bölme günü).
> Bağlı konsey kararı: `konsey/tutanak/2026-10-12-merkez-site-musteri-kaydi.md` (Nachtrag).
> Araştırma 12.10.2026, kaynaklar en altta. Fiyat rakamı yazılmaz.

## 1. Neden

- Vercel'in bedava paketi (Hobby) **ticari kullanıma kapalı** ("Hobby teams are restricted to
  non-commercial personal use only") — `praxura.de` ürün sattığı için kapsam dışı. Uygun
  kalmanın yolu ücretli Pro (kişi başı aylık ücret).
- Hobby sınırları bizi zaten vurdu: günde 100 deploy (10.10 "rate limited — retry in 24 hours"),
  en fazla 12 fonksiyon.
- Cloudflare Pages bedava pakette ticari kullanım yasağı yok (Developer Platform şartlarında
  yalnız içerik kuralları var), statik trafik ve bant genişliği sınırsız. Alan adı zaten
  Cloudflare'de (`ezra`/`olga.ns.cloudflare.com`).

## 2. Bedava paket bize yetiyor mu — ölçüldü (12.10.2026)

| Sınır (Free) | Bizde | |
|---|---|---|
| Statik istek / bant genişliği: sınırsız | — | ✅ |
| 20.000 dosya / site | ~430 yayın dosyası (SaaS dosyaları düşünce daha az) | ✅ |
| 25 MiB / dosya | en büyük 2,6 MB (`assets/img/hero-praxura.png`) | ✅ |
| 500 build / ay, aynı anda 1 | son 30 günde siteye dokunan 13 commit; build watch paths ile yalnız site dosyaları build tetikler | ✅ |
| `_redirects` 2.000 statik + 100 dinamik | SaaS sonrası ~5 | ✅ |
| `_headers` 100 kural | bugün 13 | ✅ |
| Özel alan adı 100 / proje | 2 (`praxura.de`, `www`) | ✅ |
| CAA engeli | `praxura.de`'de CAA kaydı yok | ✅ |

## 3. Pages'in farklı davrandığı yerler — bilinen tuzaklar

| # | Tuzak | Ne yapılır |
|---|---|---|
| T-a | **`.html` uzantısı otomatik atılır**: `/praxis.html` → `/praxis` yönlendirmesi. Kapatma ayarı yok. | Geçiş günü sitemap (25 adres), 36 sayfadaki `rel="canonical"` ve iç linkler uzantısız adrese çevrilir. Eski `.html` linkleri kırılmaz, yönlendirilir. Tek seferlik SEO değişikliği. |
| T-b | **`404.html` yoksa her olmayan adres ana sayfayı 200 ile döner** (SPA davranışı) — `curl …/install.sh` yanlış yolda HTML alırdı. | Kökte `404.html` var; yayın klasörüne girdiği build betiğinde kontrol edilir. |
| T-c | **Alan adına göre yönlendirme yok** (`_redirects` yalnız yol bakar). | Bugünkü host yönlendirmelerinin hepsi `app.`/`admin.`/`infinitymade.de` içindir ve SaaS ile kalkar. Gerekirse Cloudflare Single Redirects (Free: 10 kural). |
| T-d | **`.ps1`/`.sh` için Content-Type belgede yazmıyor.** | `_headers` ile `text/plain; charset=utf-8` + `no-store` zorlanır. Dosya zaten saf ASCII (O-200). **Adım 1'de ölçülür** — geçmeden önce. |
| T-e | **Varsayılan başlıklar**: `Access-Control-Allow-Origin: *`, `Cache-Control: max-age=0, must-revalidate`. | CSP, HSTS (`max-age=63072000; includeSubDomains`), `X-Frame-Options` vb. `vercel.json`'dan `_headers`'a çevrilir. |
| T-f | **Fonksiyon yok**: `/api/*` (iletişim, ön kayıt, demo randevu) çalışmaz. Pages Functions kullanılmaz (G8 + nodemailer orada çalışmaz). | Bkz. §5. |
| T-g | **500 build dolarsa ne olur** belgede yazmıyor; atlanan build'in sayılıp sayılmadığı da. | Watch paths ile beklenen ~15/ay. Panelden ilk ay izlenir. |
| T-h | **`.vercelignore` Pages'te yok.** Yayın yüzeyi kuralı (CLAUDE.md) aynen geçerli. | Build betiği **izin listesiyle** `dist/` kurar (yalnız sayılan klasör/dosya). `funktionen/`-sızıntısının tekrarı imkânsız olur. |

## 4. Mimari (SaaS kapandıktan sonra)

```
praxura.de, www  ──►  Cloudflare Pages (statik, dist/)    ← git push, Cloudflare GitHub entegrasyonu
/install.sh, /install.ps1  ─►  aynı Pages (rewrite 200 → /installieren/…)
formlar (kontakt, vorregistrierung, demo-booking)  ──►  merkez (bkz. §5)
müşteri kaydı + lisans  ──►  merkez, yalnız WireGuard (konsey 12.10)
Ops panosu  ──►  ayrı Pages projesi (statik, fonksiyonsuz) — opsiyonel, aynı gün
Vercel  ──►  kapanır
```

- Deploy: Cloudflare'in GitHub entegrasyonu `main`'i çeker → **GitHub'a Cloudflare sırrı konmaz**.
  Build komutu: `node tools/pages-build.mjs` (izin listesi → `dist/`, `_headers`, `_redirects`,
  `404.html` kontrolü, install dosyalarının ASCII/BOM kontrolü — O-200 kapısı build'de de).
- Build watch paths: yalnız site dosyaları (`index.html`, `praxis*.html`, `praxissoftware-*`,
  `blog/`, `assets/`, `fonts/`, `images/`, `installieren/`, yasal sayfalar, `sitemap.xml`,
  `robots.txt`, `_headers`, `_redirects`).

## 5. Formlar — açık karar (geçişten önce)

Üç sayfa sunucu programı istiyor: `kontakt.html` + `vorregistrierung.html` → `/api/contact`
(SMTP), `demo-booking.html` → `/api/demo-booking` (SMTP + Google Takvim).

| Seçenek | Artı | Eksi |
|---|---|---|
| **A) Merkezde ayrı küçük süreç** (ayrı Unix kullanıcısı, yalnız `SMTP_*` + Google sırları, rate limit) | Kendi sunucumuz, yeni dış servis yok | Merkezde internete açık bir uç doğar → **guvenlik + onprem onayı şart** (konsey: admin arayüzü açılmaz; form ucu ayrı değerlendirilir) |
| **B) Formsuz**: iletişim = e-posta adresi + telefon, demo = e-postayla randevu | Sıfır kod, sıfır yüzey | Dönüşüm kaybı olabilir |

Öneri: A, guvenlik/onprem şartlarıyla. Geçiş gününden önce karara bağlanır.

## 6. Vercel env'leri — ne olur

| Env | Ne için | Geçişte |
|---|---|---|
| `STRIPE_*`, `NEXT_PUBLIC_URL` | SaaS ödeme / portal / webhook | Webhook merkeze (konsey 12.10), geri kalan SaaS ile kalkar |
| `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | SaaS uygulaması | SaaS ile kalkar |
| `SMTP_HOST/PORT/USER/PASS` | Formların maili | §5-A ise merkezdeki form sürecine |
| `GOOGLE_CLIENT_ID/SECRET`, `SETUP_SECRET`, `GOOGLE_DEMO_CALENDAR_REFRESH_TOKEN` | Demo randevu → Google Takvim | §5-A ise merkezdeki form sürecine |
| `APIFY_TOKEN` | Uygulamadaki aday arama (`module/lead-suche.js`) | SaaS ile kalkar (aynı uç `api-backend`'de de var) |
| `PUBLIC_API_BASE` | — | set edilmemiş, dokunulmaz |

## 7. Adımlar

**Ön hazırlık (SaaS kapanmadan, canlıya dokunmadan):**
1. **Deneme projesi** `praxura-deneme.pages.dev` (Kemal Cloudflare'de proje açar ya da yetki verir):
   `dist/` yüklenir, ölçülür: `curl -I /install.ps1` başlıkları (T-d), Windows PS 5.1'de
   `& ([scriptblock]::Create((irm …/install.ps1)))` yükleniyor mu, `.html` yönlendirmeleri,
   olmayan adres 404 mü (T-b), başlıklar CSP/HSTS. Bulgu → bu plana.
2. `tools/pages-build.mjs` + `_headers` + `_redirects` yazılır, testleri `npm test`'e girer.
3. §5 form kararı (guvenlik + onprem), seçenek A ise merkezde form süreci kurulur ve formlar
   yeni adrese yönlendirilir — bu adım SaaS kapanmadan da yapılabilir (Vercel fonksiyonları
   böylece erkenden boşalır).
4. legal-de: Datenschutzerklärung'da hosting Vercel → Cloudflare (+ merkez, form verisi için),
   Cloudflare DPA kontrolü, `dpa.html` alt işleyen listesi.
5. onprem: O-176 (i) yayın yolu kaydı + `check-onprem.sh` başlatıcı bloğu (`.vercelignore`
   yerine izin listesine bakacak).

**Geçiş günü (SaaS kapandıktan sonra):**
6. Kanonik/sitemap/iç link uzantısız (T-a) — aynı commit'te.
7. Pages projesi `praxura` → custom domain `praxura.de` + `www` (Cloudflare kaydı kendi yazar;
   Vercel'in A kaydı `216.198.79.1` değişir).
8. Ölçüm: ana sayfa, 17 blog yazısı, sitemap'teki her adres (curl), `install.sh`/`install.ps1`
   başlık + içerik SHA, 404, HSTS. Temiz Windows'ta tek satır kurulum başlatılır.
9. Vercel: projeler silinmeden önce 1 hafta durur (geri dönüş = DNS kaydını geri almak).
   Sonra Vercel projeleri + env'ler silinir.

**Geri dönüş:** DNS kaydını Vercel'e geri çevirmek (dakikalar). Bu yüzden Vercel projesi bir
hafta silinmez.

## 8. Doğrulanmadı — Adım 1'de ölçülecek

- Pages'in `.ps1`/`.sh` için gönderdiği Content-Type ve `_headers`'ın onu ezip ezmediği.
- 500 build sınırı dolunca ne olduğu; atlanan build'in sayılıp sayılmadığı.
- Cloudflare DPA'nın bedava pakette kapsamı (legal-de).

## Kaynaklar

- Pages limits — https://developers.cloudflare.com/pages/platform/limits/
- Serving Pages (route matching, 404, varsayılan başlıklar) — https://developers.cloudflare.com/pages/configuration/serving-pages/
- Redirects — https://developers.cloudflare.com/pages/configuration/redirects/
- Headers — https://developers.cloudflare.com/pages/configuration/headers/
- Build watch paths — https://developers.cloudflare.com/pages/configuration/build-watch-paths/
- Custom domains — https://developers.cloudflare.com/pages/configuration/custom-domains/
- Developer Platform şartları — https://www.cloudflare.com/service-specific-terms-developer-platform/
- URL forwarding (Free: 10 Single / 15 Bulk) — https://developers.cloudflare.com/rules/url-forwarding/
- Vercel Fair Use (Hobby ticari değil) — https://vercel.com/docs/limits/fair-use-guidelines
- Vercel Hobby — https://vercel.com/docs/plans/hobby
