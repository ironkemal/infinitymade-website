# 🚀 VPS Bootstrap — TEK SEFERLİK

> Bu adımları **bir kez** yap, sonra git push → 60 saniye içinde production.
> Toplam süre: ~5 dakika.

---

## ŞART: VPS'te bir terminal aç

Hetzner panelinden web terminal yeterli — SSH client kurmana gerek yok.

```bash
ssh root@n8n.infinitymade.de
# (veya Hetzner web console)
```

---

## 1️⃣ Mevcut PM2 calendar-api'yi durdur (artık Docker'da çalışacak)

```bash
pm2 stop calendar-api
pm2 delete calendar-api
pm2 save
```

---

## 2️⃣ Eski stack klasörünü tut, yenisini hazırla

```bash
# Mevcut docker-compose nerede?
docker compose ls
# Çıktıdaki "Config files" kolonu yolu söyler. Genelde /var/www/calendar-api/api-backend/

# Oraya git ve mevcut .env'yi yedekle
cd /var/www/calendar-api/api-backend
cp .env /tmp/calendar.env.backup

# Bu klasörü temizle, tüm repo'yu klonlayacağız
cd /var/www
mv calendar-api calendar-api.old.$(date +%s)
git clone https://github.com/ironkemal/infinitymade-website.git calendar-api
cd calendar-api/api-backend
```

---

## 3️⃣ .env dosyalarını yerleştir

```bash
# Eski calendar-api env'sini yeni yola kopyala
cp /tmp/calendar.env.backup ./.env.calendar

# Stack-level .env (DOMAIN, ACME_EMAIL, TZ, N8N_ENCRYPTION_KEY) — eskisini bul
ls /var/www/calendar-api.old.*/api-backend/.env  # path'ini öğren
cp /var/www/calendar-api.old.*/api-backend/.env ./.env
```

İçeriklerini bir kez kontrol et:
```bash
cat .env           # DOMAIN=n8n.infinitymade.de gibi
cat .env.calendar  # SUPABASE_URL=..., GOOGLE_CLIENT_ID=...
```

---

## 4️⃣ İlk imajın inşa edilmesi (GitHub Actions ile)

GitHub'da ortaya koymak için boş commit at (zaten push'lanmış olabilir):
```bash
# (lokal makinende)
git commit --allow-empty -m "trigger first calendar-api build"
git push
```

GitHub'da [Actions sekmesine](https://github.com/ironkemal/infinitymade-website/actions) git, "Build and Publish calendar-api image" workflow'u tamamlanmasını bekle (~3 dk).

İmaj `ghcr.io/ironkemal/infinitymade-website/calendar-api:latest` olarak yayınlanır.

---

## 5️⃣ GHCR imajını **public** yap (free tier için)

Aksi halde VPS'in pull etmek için auth gerekir.

[GitHub → Profile → Packages](https://github.com/ironkemal?tab=packages) → `calendar-api` → Settings → "Change visibility" → **Public**.

---

## 6️⃣ Docker stack'i aç

```bash
cd /var/www/calendar-api/api-backend
docker compose pull
docker compose up -d
```

Beklenen çıktı:
```
✔ Container traefik       Started
✔ Container n8n           Started
✔ Container calendar-api  Started
✔ Container watchtower    Started
```

Health check:
```bash
docker ps --format 'table {{.Names}}\t{{.Status}}'
docker logs calendar-api --tail 20
# "Calendar API running on port 3000" görmeli
```

---

## 7️⃣ Browser test

```bash
curl -sI "https://n8n.infinitymade.de/api/booking/get-slots" -X POST
# Beklenen: 400 (Missing params) — yani endpoint reachable, body validation çalışıyor
```

---

## ✅ ARTIK BU MEKANİZMA AKTİF

- `git push` → GitHub Actions build (~3 dk) → GHCR'a push
- Watchtower 60 saniyede bir GHCR'ı kontrol → yeni imaj varsa pull → calendar-api'yi restart
- **Toplam lag:** ~4 dakika (build + watchtower polling)

WinSCP yok, PM2 yok, SSH yok. Sadece `git push`.

---

## 🔧 Sorun çıkarsa

```bash
docker logs calendar-api --tail 50    # API hatası mi?
docker logs watchtower --tail 50      # Pull yapamıyor mu?
docker logs traefik --tail 50         # Routing sorunu mu?
docker compose ps                     # Hangi container down?
docker compose pull && docker compose up -d  # Force update
```

**FATAL** hatası verirse `.env.calendar`'da bir env var eksik demektir — eski yedekle karşılaştır.

---

## 📦 Sonraki backend değişikliği

Sen sadece:
```bash
# Lokal makinede
git add api-backend/server.js
git commit -m "fix: ..."
git push
```

GitHub Actions otomatik build eder, Watchtower otomatik deploy eder. Sen 4 dakika sonra production'a yansımış olur.
