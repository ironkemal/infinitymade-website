# Umami Analytics — Self-Host Kurulum

DSGVO-dostu, cookie-free analytics. Cookie banner gerektirmez.

## VPS'te yapılacaklar (SSH ile n8n.infinitymade.de'ye bağlan)

### 1. DNS kaydı

Cloudflare/Hetzner DNS panelinde:
```
A record: analytics.infinitymade.de → <VPS_IP>  (proxy: off → Traefik LE için)
```

### 2. Env vars (`/var/www/calendar-api/.env` veya stack root)

```bash
UMAMI_DB_PASSWORD=$(openssl rand -hex 24)
UMAMI_APP_SECRET=$(openssl rand -hex 32)
```

`.env` dosyasına ekle (docker-compose root'ta).

### 3. Deploy

```bash
cd /var/www/calendar-api
docker compose pull umami umami-db
docker compose up -d umami umami-db
docker compose logs -f umami   # "Listening on port 3000" gör
```

### 4. İlk login

- `https://analytics.infinitymade.de` → default admin: `admin` / `umami`
- **İLK İŞ:** Şifreyi değiştir (Settings → Profile)
- Website ekle: Name=`infinitymade.de`, Domain=`infinitymade.de`
- Tracking code'u kopyala (Settings → Websites → Edit → Tracking code)

### 5. Tracking script'i siteye ekle

`index.html` ve diğer public sayfaların `</head>` öncesine:

```html
<script defer src="https://analytics.infinitymade.de/script.js"
        data-website-id="YOUR_WEBSITE_ID"></script>
```

**Önemli:** `app.infinitymade.de` (dashboard) ve `admin.infinitymade.de`'ye **eklemiyoruz** — sadece public marketing pageleri ölç.

### 6. Doğrulama

- Tarayıcıda incognito → `infinitymade.de` aç
- Network tab: `/script.js` 200 dönmeli, sonra `/api/send` POST'u gitmeli
- Umami dashboard 1-2 dakika içinde ziyaret göstermeli

## Notlar

- Umami cookie kullanmaz → **cookie banner gerekmez** (TTDSG/DSGVO uyumlu)
- IP adresleri anonimleştirilir (hash + günlük rotation)
- Veri **bizim VPS'imizde** → US'e gitmiyor, AVV ile gerekmiyor (own-controller)
- Datenschutzerklärung'a kısa not ekle: "Wir nutzen Umami (self-hosted) für anonyme Reichweitenmessung. Keine Cookies, keine personenbezogenen Daten."
