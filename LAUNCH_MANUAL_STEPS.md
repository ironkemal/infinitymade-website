# Manuel Adımlar — Bu Oturumda Yapılanların Devamı

> Bu dosyayı **sırayla** yap. Her adımın altında ne yapacağın net yazılı. Toplam tahmini süre: **2-3 saat**, çoğu bekleme.

Son güncelleme: 2026-05-23

---

## 📋 Yapılacaklar Sırası

1. [Git push (5 dk)](#1-git-push) — Vercel otomatik deploy
2. [Email forwarding (10 dk)](#2-email-forwarding-cloudflare) — support@ ve datenschutz@
3. [Google Search Console + Bing (15 dk)](#3-search-console--bing-webmaster)
4. [VPS'te Umami deploy (30 dk)](#4-vpste-umami-deploy)
5. [Umami tracking ID'yi siteye yapıştır (5 dk)](#5-umami-tracking-idyi-siteye-yap%C4%B1%C5%9Ft%C4%B1r)
6. [Test: DSGVO export + delete (10 dk)](#6-test-dsgvo-export--delete)
7. [Datenschutz sayfası DSB kontak (5 dk — opsiyonel)](#7-datenschutz-dsb-kontak)

---

## 1. Git push

Bu oturumdaki tüm değişiklikleri yayınla.

```powershell
cd c:\Users\Test\Desktop\claude\website
git status
git add .
git commit -m "DSGVO endpoints + AVV consent + Umami prep + support page"
git push
```

Sonra **Vercel Dashboard → Deployments** sayfasını aç, deploy bitince:
- https://infinitymade.de/support.html → yeni sayfa açılmalı
- https://app.infinitymade.de/dashboard.html → Einstellungen → "🔐 Datenschutz (DSGVO)" kartı görünmeli

✅ **Başarı kriteri:** Yeni support sayfası canlı, dashboard'da DSGVO kartı var.

---

## 2. Email forwarding (Cloudflare)

`support@infinitymade.de` ve `datenschutz@infinitymade.de` adreslerini kendi mailbox'una yönlendir.

### Eğer DNS Cloudflare'deyse:

1. https://dash.cloudflare.com → **infinitymade.de** seç
2. Sol menü: **Email** → **Email Routing**
3. Aktivasyon → **Enable Email Routing** (Cloudflare DNS kayıtlarını otomatik ekler)
4. **Custom addresses** sekmesi → **Create address**:
   - `support@infinitymade.de` → `ironkemal5@gmail.com`
   - `datenschutz@infinitymade.de` → `ironkemal5@gmail.com`
5. Hedef mail adresini doğrula (gelen kutuna gelen onay linkine tıkla)

### Eğer DNS başka bir registrar'daysa (Hetzner, IONOS, vb.):

Registrar panelinde "Email Forwarding" veya "Catch-all" özelliği ara. Bulamazsan: Cloudflare'a DNS'i taşı, ücretsiz.

✅ **Test:** Telefondan veya başka bir mail'den `support@infinitymade.de`'ye boş bir mail at. 1 dakika içinde Gmail'ine düşmeli.

---

## 3. Search Console + Bing Webmaster

SEO görünürlüğü için arama motorlarına siteyi tanıt.

### Google Search Console

1. https://search.google.com/search-console → **Add property**
2. **Domain** sekmesini seç (daha güçlü, www+app dahil hepsi tek property)
3. `infinitymade.de` yaz → **Continue**
4. Google sana bir TXT kaydı verecek. Örnek: `google-site-verification=abc123...`
5. Cloudflare DNS panelinde: **DNS** → **Add record**:
   - Type: `TXT`
   - Name: `@` (root)
   - Content: yapıştır
6. 1-5 dakika bekle, Google'da **Verify** bas
7. Verify olunca: **Sitemaps** sekmesi → `https://infinitymade.de/sitemap.xml` ekle

### Bing Webmaster Tools

1. https://www.bing.com/webmasters → Google ile giriş yap
2. **Import from Google Search Console** seçeneği var → bir tıkla otomatik aktarır
3. Yoksa: `infinitymade.de` manuel ekle, aynı TXT yöntemini kullan
4. Sitemap submit: `https://infinitymade.de/sitemap.xml`

✅ **Başarı kriteri:** İki panelde de "Ownership verified" yazıyor.

---

## 4. VPS'te Umami deploy

VPS'in n8n.infinitymade.de host'una SSH ile bağlan.

```bash
ssh root@n8n.infinitymade.de   # veya kendi SSH user'ın
cd /var/www/calendar-api       # docker-compose.yml burada
```

### 4a. DNS kaydı (önce!)

Cloudflare DNS → **Add record**:
- Type: `A`
- Name: `analytics`
- IPv4: (VPS IP'si, `n8n.infinitymade.de`'nin gösterdiği IP)
- Proxy status: **DNS only** (gri bulut, Traefik LE için zorunlu)

DNS yayılmasını bekle (~1 dk):
```bash
dig analytics.infinitymade.de +short
```
VPS IP dönmeli.

### 4b. Env vars

```bash
# .env dosyasını aç
nano .env   # veya hangi env file kullanıyorsan
```

Dosyanın sonuna ekle (rastgele güçlü şifreler):
```env
UMAMI_DB_PASSWORD=BURAYA_RANDOM_24_HEX
UMAMI_APP_SECRET=BURAYA_RANDOM_32_HEX
```

Random üret:
```bash
echo "UMAMI_DB_PASSWORD=$(openssl rand -hex 24)"
echo "UMAMI_APP_SECRET=$(openssl rand -hex 32)"
```
Çıkanı yapıştır.

### 4c. Pull + Start

```bash
# Yeni docker-compose.yml zaten git push ile geldi (eğer VPS git pull kullanıyorsa)
# Yoksa: WinSCP ile api-backend/docker-compose.yml dosyasını VPS'e yükle

docker compose pull umami umami-db
docker compose up -d umami umami-db

# Log'u izle, hata var mı bak
docker compose logs -f umami
```

`Listening on port 3000` görmen lazım. `Ctrl+C` ile log'tan çık.

### 4d. İlk login + Website ekle

1. Tarayıcıda: **https://analytics.infinitymade.de**
2. Default kullanıcı: `admin` / şifre: `umami`
3. **HEMEN:** Sağ üst → Profile → Change Password → güçlü şifre
4. **Settings → Websites → Add Website**:
   - Name: `InfinityMade`
   - Domain: `infinitymade.de`
5. Save → website listesine dön → oluşan website satırına tıkla → **Edit** → **Tracking code** sekmesi
6. `data-website-id="xxxxxxxx-xxxx-..."` kısmındaki **UUID'yi kopyala**

✅ **Başarı kriteri:** Umami dashboard'a giriş yapabildin, website ID'yi panoya kopyaladın.

---

## 5. Umami tracking ID'yi siteye yapıştır

Bilgisayarında:

```powershell
cd c:\Users\Test\Desktop\claude\website
```

`index.html` dosyasını aç, ara: `REPLACE_WITH_UMAMI_WEBSITE_ID`

O metni Umami'den kopyaladığın UUID ile değiştir. Örnek:

```html
<!-- ÖNCE -->
<script defer src="https://analytics.infinitymade.de/script.js"
        data-website-id="REPLACE_WITH_UMAMI_WEBSITE_ID"></script>

<!-- SONRA -->
<script defer src="https://analytics.infinitymade.de/script.js"
        data-website-id="a1b2c3d4-e5f6-..."></script>
```

Sonra commit + push:
```powershell
git add index.html
git commit -m "feat(analytics): activate Umami tracking ID"
git push
```

### Diğer public sayfalara da eklemek istersen (opsiyonel)

Aşağıdakilere de aynı `<script>` tag'ini `</head>` öncesine yapıştır:
- `support.html`
- `whatsapp-bot-friseur.html`, `whatsapp-bot-restaurant.html`, `whatsapp-bot-physiotherapie.html`, `whatsapp-bot-fitness.html`
- `webdesign-siegburg.html`, `webdesign-koeln.html`, `webdesign-bonn.html`, `webdesign-troisdorf.html`, `webdesign-hennef.html`
- `pakete/physio.html`, `pakete/coming-soon.html`
- `blog/index.html` ve blog makaleleri

> **Eklemeyeceklerin:** `dashboard.html`, `admin.html`, `onboarding.html`, `login.html`, `kalender.html`, `booking.html` — bunlar login-walled, ölçmüyoruz.

✅ **Test:** Tarayıcıyı incognito aç → `infinitymade.de` git → Umami dashboard'a dön → 1-2 dk içinde 1 visitor görmeli.

---

## 6. Test: DSGVO export + delete

### Export (Art. 15)

1. `https://app.infinitymade.de/dashboard.html` giriş yap
2. Sol menü: **Einstellungen**
3. Aşağı kaydır → **🔐 Datenschutz (DSGVO)** kartı
4. **📥 Meine Daten exportieren (JSON)** → tıkla
5. `infinitymade-daten-2026-05-23.json` indirilmeli

JSON dosyasını aç (Notepad veya VSCode), `profiles`, `bookings`, `consent_log` alanları olmalı.

### Delete (Art. 17) — TEST USER İLE!

> ⚠️ **Önce test bir hesap aç!** Kendi owner hesabını silersen tüm test data gider.

1. Yeni mail ile `/onboarding.html`'den test signup yap (sahte bilgilerle)
2. Login → Dashboard → Einstellungen → **🗑️ Konto & Daten löschen**
3. İlk confirm: OK
4. Prompt: `LÖSCHEN` yaz (büyük harf!)
5. "Konto wurde gelöscht" diyaloğu → tamam → logout
6. Aynı mailden login dene → "Invalid login credentials" hatası almalısın ✅

Sonra Supabase MCP üzerinden:
```sql
select * from profiles where email = 'test@deneme.de';   -- 0 satır
select * from consent_log where user_id = 'silinen-uuid';-- 0 satır
select count(*) from invoices where patient_name is null and owner_id = 'silinen-uuid'; -- anonymize edildi mi
```

✅ **Başarı kriteri:** Test hesabı tamamen silindi.

---

## 7. Datenschutz DSB kontak

Şu an `datenschutz.html`'de bir DSB (Datenschutzbeauftragter) iletişimi yok. Sağlık verisi işlediğin için:

**Seçenek A — Eksternel DSB tut** (önerilir, ~€100-200/ay)
- https://www.activemind.legal/dsb-online
- https://datenschutz.de
- Ata, sözleşme imzala, iletişim bilgisini al

**Seçenek B — Erteleme**
- 20'den az çalışan + sistematik sağlık verisi işliyorsan → DSB zorunlu olabilir
- Tek başına çalışıyorsan ve kendin teknik yapıyorsan, kendin DSB rolü üstlenebilirsin ama hukuki danışmana sor

Şu an için: `datenschutz.html` zaten genel iletişim için yeterli, `datenschutz@infinitymade.de` çalışıyor olacak (Adım 2 sonrası).

PRE_LAUNCH'a "DSB ataması" maddesi zaten ekli, launch öncesi karar verirsin.

---

## ✅ Bittikten Sonra Durum

Bu rehber bitince elinde şunlar olacak:
- ✅ Umami analytics canlı, ziyaretçi sayıyor
- ✅ DSGVO Art. 15 + 17 endpoint'leri dashboard'dan ulaşılabilir
- ✅ AVV consent log her yeni onboarding'de yazılıyor (IP + timestamp)
- ✅ support@ + datenschutz@ mail'leri çalışıyor
- ✅ Google + Bing site'ı tanıyor, sitemap submit edilmiş
- ✅ Datenpannen runbook hazır (yan dolapta dursun, lazım olursa kullanırsın)
- ✅ Public support sayfası var

**Geriye kalan büyük taşlar (PRE_LAUNCH_CHECKLIST.md):**
- 🔴 Email confirmation (Resend) — booking ve welcome mail
- 🔴 Stripe production'a geçiş
- 🔴 VPS hardening + backup drill
- 🔴 reCAPTCHA (launch öncesi son hafta)
- 🟡 DSB ataması (opsiyonel ama önerilir)
- 🟡 MFA enforcement (launch öncesi son hafta)

Bir sonraki büyük iş muhtemelen **Resend ile email confirmation**. Hesap açtığında bana söyle, kodu yazarım.

---

## Sorun Çıkarsa

| Sorun | Çözüm |
|---|---|
| Umami SSL cert error | Traefik LE rate limit'e takıldıysa 1h bekle. DNS'i doğrula: `dig analytics.infinitymade.de` |
| DSGVO export 401 | Session token expired, logout/login yap |
| DSGVO delete 500 | VPS log'a bak: Supabase service-role-key Vercel'de set mi? |
| Umami visitor görmüyor | Browser DevTools → Network → `script.js` 200 mü? `data-website-id` doğru UUID mi? Ad-blocker kapalı mı? |
| Search Console "Couldn't verify" | DNS TXT propagation gerek, 1h sonra tekrar dene |
| Email forwarding gelmedi | Spam klasörüne bak, Cloudflare Email Routing → Activity log'a bak |

Takılırsan ekran görüntüsü + hata mesajı ile bana yaz.
