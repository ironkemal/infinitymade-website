# InfinityMade — Manuel Yapilacaklar Listesi

> Bu liste, sitenin SEO, DSGVO (GDPR) uyumlulugu ve production deploy oncesi tamamlanmasi gereken adimlari icerir.
> Dashboard/booking UI degisiklikleri senin su anki calisman, onlara dokunma.

---

## 1. Google Fonts Self-Hosting — KALAN 13 DOSYA

**Durum:** `fonts/` klasorune Inter fontlari indirildi (`inter-0.ttf` ... `inter-5.ttf`) ve `fonts/inter.css` olusturuldu. Ancak ilk PowerShell scripti sadece `wght@400;500;600;700;800;900` linkini yakaladi. Su anki dosyalarda farkli weight kombinasyonlari var.

**Henuz guncellenmemis dosyalar:**
- `admin.html`
- `booking.html`
- `dashboard.html`
- `employee-signup.html`
- `kalender.html`
- `login.html`
- `onboarding.html`
- `pakete/coming-soon.html`
- `pakete/fitness.html`
- `pakete/gastro.html`
- `pakete/handwerker.html`
- `pakete/physio.html`
- `pakete/salon.html`

**Ne yapacaksin:**
1. Her dosyada su satiri bul:
   ```html
   <link href="https://fonts.googleapis.com/css2?family=Inter:wght@..." rel="stylesheet" />
   ```
2. Karsisina bunu yaz:
   ```html
   <link href="fonts/inter.css" rel="stylesheet" />
   ```
3. Hemen altinda varsa sunlari sil:
   ```html
   <link rel="preconnect" href="https://fonts.googleapis.com" />
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
   ```
4. Not: `dashboard.html` su an aktif olarak calisiyorsun, conflict olmamasi icin onu en son yap. Veya CSS link versiyonunu (`?v=...`) senin mevcut versiyonuna gore ayarla.

---

## 2. Cookie Consent Manager (CMP) Kurulumu

**Durum:** Datenschutz sayfasinda "Cookies & Consent" bolumu yazili, ama gercek bir cookie banner/cmp yok.

**Secenekler:**
- **Cookiebot** (Usercentrics) — Ucretsiz plan: 1 domain, 1 subpage, 100+ sayfa gosterim. Aylik ~60 EUR degil, temel plan ucretsiz basliyor ama smirli. DSGVO uyumlu.
- **Osano** — Basit, ucretsiz plan var.
- **Complianz** (WordPress icin degil, ama entegrasyonu kolay).
- **Kendi basit bannerin** — Hizli cozum, sadece GA4 icin.

**En pratik (hizli) cozum — kendi banner:**
1. `script.js` veya ayri bir `cookie-consent.js` olustur.
2. Banner HTML'i ekle (sayfanin altinda sabit, `position:fixed; bottom:0;`).
3. Butonlar: "Alle akzeptieren", "Nur notwendige", "Einstellungen".
4. Kullanici "Statistik" kabul ederse GA4 scripti dinamik olarak yuklensin. Etmezse GA4 hic yuklenmemeli.
5. Kullanicinin secimi `localStorage`‘a yaz: `localStorage.setItem('cookie_consent', JSON.stringify({necessary:true, analytics:true}))`.
6. Sayfa yuklenirken bu key'i kontrol et, eger yoksa banner goster, varsa ona gore GA4 yukle.

**Datenschutz guncellemesi:** CMP kurduktan sonra `datenschutz.html` > "7. Cookies & Consent" bolumune gercek CMP ismini yaz (ornegin "Wir verwenden Cookiebot als Consent-Management-Plattform...").

---

## 3. 2FA (Zwei-Faktor-Authentifizierung) Tum Platformlarda

**Supabase:**
1. Supabase Dashboard'a gir (supabase.com).
2. Authentication > Policies & 2FA veya Settings > Security.
3. "Enforce MFA for all users" veya benzer secenegi aktif et.
4. Kendi hesabin icin MFA kur (TOTP, Google Authenticator / Authy).

**Vercel:**
1. vercel.com > Team Settings > Security.
2. "Require Two-Factor Authentication" aktif et.
3. Kendi hesabinda 2FA kur.

**Stripe:**
1. dashboard.stripe.com > Settings > Security.
2. "Two-step verification" aktif et (SMS veya TOTP).

**Hetzner (VPS):**
1. Hetzner Robot/Robot2 paneline gir.
2. Account > Security > Two-Factor Authentication.
3. Aktif et.

**Twilio:**
1. console.twilio.com > Settings > 2FA.
2. Aktif et.

---

## 4. Rechtliche Seiten — Impressum, AGB, Widerruf, DPA

**Durum:** Bu sayfalara Organization schema (Wikidata ile) eklendi. Ancak icerik olarak Datenschutz kadar guncel olmayabilir.

**Yapilacaklar:**
1. **Impressum (`impressum.html`):**
   - Hetzner VPS host bilgisi ekle (Art. 5 TMG geregi hosting saglayici).
   - Guncel mi? Adres, Telefon, E-Mail, USt-IdNr, Handelsregister.
2. **AGB (`agb.html`):**
   - Stripe odeme kosullari, Abo iptal sureleri, Widerrufsfrist eklendi mi?
   - Guncel tarih (letztes Update) kontrol et.
3. **Widerruf (`widerruf.html`):**
   - Muster-Widerrufsformular guncel mi?
4. **DPA (`dpa.html`):**
   - Supabase, Vercel, n8n, Hetzner, Twilio, OpenAI, Stripe icin AVV (Auftragsverarbeitungsvertrag) referanslari var mi?
   - Bu sayfada "Wir schliessen AVVs ab mit..." listesi olmali.
5. **Tum legal sayfalar:** En altina "Zuletzt aktualisiert: [TARIH]" ekle.

**Tavsiye:** e-recht24.de veya IT-Recht Kanzlei ile bu sayfalari profesyonel olarak guncelle. Ucretsiz generator yeterli degil, ozellikle SaaS ve Abo modeli icin.

---

## 5. Production Deploy Oncesi Kontrol Listesi

**Vercel `vercel.json`:**
- `"functions": {"api/**/*.js": {"regions": ["fra1"]}}"` eklendi mi? **Evet.**
- Cache headers, redirects, CORS ayarlari dogru mu?

**Supabase:**
- RLS (Row Level Security) politikalari tum tablolarda aktif mi? (`profiles`, `bookings`, `services`, `employee_services`, `b2b_contacts`, etc.)
- `service_role` key sadece `api-backend/server.js`'de env olarak mi kullaniliyor? **Evet.**
- Anon key herkese acik (client-side), bu normal. Ama RLS olmadan tehlikeli. **Kontrol et.**

**API Backend (`api-backend/`):**
- `.env` dosyasi gercekten `.gitignore`'da mi?
- `docker-compose.yml`'de env vars dogru mu?
- SSL/HTTPS zorunlu mu? (n8n.infinitymade.de icin Let's Encrypt aktif mi?)

**n8n:**
- Workflow webhook URL'leri production mi? (Twilio webhook nereye gidiyor?)
- n8n'de basic auth veya API key aktif mi?
- Twilio Sandbox'tan cikilip production numaraya gecildi mi?

**Genel:**
- `robots.txt` guncel mi? (`Sitemap: https://infinitymade.de/sitemap.xml`)
- `sitemap.xml` yeni sayfalari iceriyor mu?
- `og-image.png` mevcut mu?
- 404 sayfasi var mi? (`404.html`)

---

## 6. Diger Hizli Duzeltmeler

**Dashboard/Booking Encoding:**
- `dashboard.html` ve `dashboard.js`'de emoji ve ozel karakterler (ü, ä, ß, —) bozuk gorunebilir. IDE'yi **UTF-8** encoding ile kaydetmeye zorla. VS Code'da sag alt kosede "UTF-8" yazdigindan emin ol. "Save with Encoding" > UTF-8 sec.
- Git commit oncesi `git diff` ile ozel karakterleri kontrol et.

**Cache Busting:**
- `dashboard.css`, `dashboard.js`, `booking.js`, `script.js` gibi dosyalarin `?v=YYYYMMDD[x]` versiyonu deploy'da guncellenmeli. Ayni versiyonu tekrar kullanma, kullanicilar eski CSS/JS'i cache'den yukleyebilir.

**Meta & SEO:**
- `dashboard.html`, `booking.html`, `login.html` gibi arama motorlarinin indexlememesi gereken sayfalarda `<meta name="robots" content="noindex">` var mi? `dashboard.html` ve `booking.html`'de **var**. `login.html`, `onboarding.html`, `employee-signup.html`'de de var mi? **Kontrol et.**

---

## Oncelik Sirasi

| Oncelik | Gorev | Neden |
|---------|-------|-------|
| **P0** | RLS politikalarini kontrol et | Veri sizintisi riski |
| **P0** | 2FA aktif et | Hesap guvenligi |
| **P1** | CMP / Cookie Banner kur | DSGVO uyumu, GA4 yasal kullanim |
| **P1** | Kalan Google Fonts linklerini guncelle | DSGVO (IP disclosure) |
| **P2** | Impressum + DPA guncelle | Yasal zorunluluk |
| **P2** | n8n webhook + Twilio production gecisi | WhatsApp calisirligi |
| **P3** | Cache busting versiyonlari guncelle | Kullanici deneyimi |

