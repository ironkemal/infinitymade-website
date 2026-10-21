# Konsey Kararı — Merkez: tanıtım sitesi + müşteri kaydı
Tarih: 2026-10-12 · Oturan üyeler: onprem, guvenlik, legal-de, db-ustasi, fonksiyon-ustasi, muhalif, deger-mi

Çerçeve: Kemal kararı verdi — `praxura.de` Vercel'den merkeze taşınacak, müşteri kaydı merkezde ve arayüzlü olacak. Konsey NASIL'ı ve SIRAYI söyler. ON-PREM ETKİSİ: hasta verisi geçmiyor (onprem doğruladı), ama merkezin sır yükü büyüyor.

## KARAR
**Müşteri kaydı** merkezin mevcut SQLite'ında (`merkez/db.js`) iki yeni tabloyla tutulur: `kunden` (işletme, iletişim, not) ve `lizenzen` (kunde → `boxes.box_id`, paket, `stripe_customer_id`/`stripe_subscription_id`, durum, süre). Ops'un Supabase'i ve hazır CRM kullanılmaz. Stripe'tan yalnız kimlikler tutulur; abonelik ayrıntısı Stripe'ta kalır. Tek otorite merkez: SaaS kapanınca Stripe webhook'u merkeze taşınır, Vercel kopyası kapatılır (iki webhook aynı anda yazmaz). Kutudaki `profiles.plan*` kolonları imzalı lisanstan türetilir, sonra iki adımda kalkar. **Arayüz:** v0 = CLI komutları (`kunde-neu`, `lizenz-…`, `kunden`) + **salt-okunur, bakımlı ve okunaklı tek liste sayfası**; sayfa internete hiç açılmaz, yalnız WireGuard (`wg0`) ya da SSH tüneli ile açılır. Düzenlenebilir arayüz v1. **Lisans imza anahtarı** web'e açık hiçbir süreçte durmaz (ayrı süreç/kullanıcı ya da çevrimdışı). **Tanıtım sitesi** aynı merkez VPS'e taşınır, ama ayrı Unix kullanıcısıyla, yalnız statik dosya olarak Caddy'den, salt-okunur web kökü; önünde Cloudflare proxy. Ad/jeton/lisans servisi kendi süreci ve kendi env dosyasıyla kalır (05.10 ayrımı). **Deploy:** GitHub Actions'a merkeze yetkili SSH anahtarı konmaz. Kontroller (yayın yüzeyi, O-200 ASCII/BOM kapısı) CI'da koşar; sunucu yeşil commit'i kendisi çeker ve yalnız web köküne yazar (depo public, salt-okunur erişim yeter). **Sıra:** kayıt v0 → lisans v0 → Windows kurulum sihirbazı → ilk müşteri kurulumu → site taşıma → düzenlenebilir arayüz.

## Gerekçe
Lisans `boxes` satırına bağlanacağı için kayıt, lisans ve kutu kimliği aynı veritabanında olmalı. Başka yerde durursa her gece lisans yenilemesi ikinci bir buluta bağlanır (onprem, db-ustasi, guvenlik, deger-mi hemfikir). Merkez Cloudflare zon token'ını taşıyor, yakında lisans anahtarını da taşıyacak. Bu yüzden internete açık bir giriş ekranı, bütün kutuların adını/sertifikasını/lisansını tek açıkla düşürür (guvenlik). Statik sitenin yüzeyi ise küçük. Sıra deger-mi'den: kayıt ve lisans ilk ücretli kutunun önünde duruyor, site taşıma kimsenin önünde durmuyor.

## Ödün verilenler
- Kemal "güzel, kullanılabilir arayüz" istedi; v0'da arayüz salt-okunur, düzenleme CLI'da. Kemal bunu bilinçli kabul etmeli ya da v1 tetiğini öne çekmeli.
- Vercel'in bedava verdikleri (CDN, otomatik TLS, uptime, preview, `vercel.json`'daki header/redirect/rewrite kuralları) bizim bakım borcumuz olur. Preview ortamı kaybolur, yerelde `dev_server.cjs` kalır.
- Site ile merkez aynı makinede: disk dolması veya hatalı bir deploy, kutu ad/jeton servisini de etkileyebilir. Disk/bellek sınırı ile azaltılır, sıfırlanmaz.

## Uzlaşma
- Ops Supabase olmaz (7/7). Hasta verisi bu kayda girmez. Merkez SQLite ile başlanır, Postgres ancak gerçek ihtiyaçta.
- Admin arayüzü internete açık olmaz.
- `/install.sh` ve `/install.ps1` URL'leri ve başlıkları (`text/plain; charset=utf-8`, `no-store`, `nosniff`) aynen korunur, taşımadan sonra `curl -I` ile ölçülür.

## Anlaşmazlık
- **Site: aynı VPS mi, ayrı küçük VPS mi.** onprem ayrı VPS'i tercih ediyor (veto değil); muhalif ve deger-mi aynı VPS + ayrı kullanıcı diyor. guvenlik statik siteyi sorun görmüyor, sorunu internete açık giriş ekranında görüyor. Chairman: Kemal'in tercihine uygun olarak **aynı VPS**. Ayrı VPS'e geçiş tek yönlü bir kapı değil; merkez ilk kez sıkışınca açılır.
- **Deploy: push mu pull mu.** onprem push istiyor (kapı boru hattına girsin); guvenlik root/sudo SSH anahtarını reddediyor. Çözüm: kapı CI'da koşar, sunucu çeker. Push şart olursa yalnız web köküne `rsync` yapabilen forced-command kullanıcısı.

## Kör noktalar
- `kontakt.html`, `demo-booking.html`, `vorregistrierung.html` `/api/*` çağırıyor; statik taşımada bu formlar kırılır. Merkezde ayrı küçük bir sürece alınır ya da kapatılır; yeni bulut zinciri açılmaz. Taşımadan önce karar (onprem, fonksiyon-ustasi).
- `vercel.json` kurallarının hepsi (rewrite, header, host-redirect) Caddyfile'a çevrilir; sitemap'teki her URL curl ile denenir. Bu taşımanın kabul ölçütüdür (muhalif).
- Merkez tabloları `db/REGISTER.md`'nin kapsamı dışında kalıyor → kayıt yeri `merkez/README.md` (db-ustasi).
- Lisans eklenince SQLite yedeği kritikleşir: `VACUUM INTO`/`.backup` ile tutarlı anlık görüntü, sunucu dışına kopya.
- Yarım kalan kurulumların `aktiv` kalan adları (O-203) kayıtta "satıldı / kuruldu / iptal" durumuyla görünür olur.

## Uygulama — builder'a
- [ ] `merkez/db.js`: `kunden` + `lizenzen` tabloları (FK `boxes.box_id`), not alanı uyarısı „Keine Patientendaten eintragen", serbest metin yok — karmaşıklık: K2
- [ ] `merkez/admin.js`: `kunde-neu`, `kunde-bearbeiten`, `kunden`, `lizenz-zuordnen` komutları; adminlog'a yazar — K1
- [ ] Tutarlı SQLite yedeği (`VACUUM INTO`) + sunucu dışı kopya — K1
- [ ] Salt-okunur liste sayfası, yalnız WireGuard/SSH tüneli; ayrı kullanıcı, yalnız kayıt tablolarına okuma — K2
- [ ] Lisans v0 (Faz 3.1/3.2'nin küçük hâli: imzalı dosya + süre uyarısı; salt-okunur kill-switch v1) — K3, ayrı plan
- [ ] Site taşıma (sırası gelince): ayrı kullanıcı + statik Caddy + Cloudflare proxy, `vercel.json` → Caddyfile, install URL/başlıkları, CI kapısı + sunucu tarafı çekme, formların kaderi, `curl` kabul listesi — K3
- [ ] legal-de metinleri: VVT Verarbeitung 1 (Empfänger Hetzner-Merkez, saklama süresi 8 yıl teyidi), Datenschutzerklärung Hosting + Caddy log süresi (site taşınınca), hasta verisi kuralı (5 madde) `compliance/LEGAL_DECISIONS.md`'ye — K1

## Backlog (karara dahil DEĞİL)
- Merkez sıkışınca siteyi ayrı VPS'e almak.
- Düzenlenebilir kayıt arayüzü (tetik: 2. müşteri ya da Melih CLI'siz bakmak istediğinde).
- Salt-okunur kill-switch (tetik: ilk ödeme gecikmesi ya da 5. kutu).
- Saklama süresi (8 yıl) için vergi danışmanına tek e-posta.

## Sert veto varsa
Yok. Ön koşul (guvenlik S-52 Bed. 11, açık): Hetzner, Cloudflare, registrar, GitHub'da 2FA + registrar kilidi — ilk ücretli kutudan önce.

## Nachtrag (Kemal, 12.10.2026 öğleden sonra) — site hedefi değişti
Tanıtım sitesi merkeze **değil, Cloudflare Pages'e** taşınır; **SaaS (`app.praxura.de`) kapandıktan sonra**. Gerekçe: Vercel Hobby ticari kullanıma kapalı; Pages bedava pakette ticari kullanım yasağı yok, statik trafik sınırsız, alan adı zaten Cloudflare'de; merkezde internete açık site yüzeyi doğmaz (guvenlik'in asıl kaygısı). Kararın "Site aynı merkez VPS'e … Actions'a yetkili SSH anahtarı YOK, sunucu çeker" kısmı bununla düşer: deploy Cloudflare'in GitHub entegrasyonuyla, GitHub'a sır konmaz. Müşteri kaydı + lisans kararı aynen geçerli. Formlar (`/api/contact`, `/api/demo-booking`) için açık karar ve bütün adımlar: `CLOUDFLARE_PAGES_GECIS_PLANI.md`.
