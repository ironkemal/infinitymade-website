# 🔧 Infrastructure & Tooling Guide

> Bu dosya: Windsurf/Cascade'in (Sonnet/Opus/K2.6) önceki Claude Code gibi infrastructure işlerini halledebilmesi için detaylı rehber. n8n MCP, VPS SSH, deploy operasyonları, debug komutları.

---

## 1. n8n MCP Kurulumu

### Neden gerek?
- Production workflow `xccY2rWaswRM7ZoZ` ("PraxisAI v2 — multi_tenant") düzenlemek için
- Tool body'de hardcoded Siido UUID dinamikleştirme işi geldiğinde
- Yeni endpoint (cancel/reschedule) için tool eklerken
- Workflow execution loglarını görüp debug etmek için

### n8n API key oluşturma (VPS'te bir kerelik)
1. Browser'da `https://n8n.infinitymade.de` aç
2. Sağ üst → kullanıcı menüsü → **Settings** → **n8n API**
3. **Create API Key** → ad ver (örn. "windsurf-mcp"), expire süresi seç (no-expire en pratik)
4. Key'i kopyala (bir kez gösterilir, kaybetme — kaybedersen yeni oluştur)

### Windsurf MCP config (`%APPDATA%\Windsurf\mcp.json` veya UI'dan Settings → MCP)

```json
{
  "mcpServers": {
    "n8n-mcp": {
      "command": "npx",
      "args": ["-y", "n8n-mcp"],
      "env": {
        "N8N_API_URL": "https://n8n.infinitymade.de",
        "N8N_API_KEY": "<API_KEY_BURAYA>",
        "MCP_MODE": "stdio",
        "LOG_LEVEL": "error",
        "DISABLE_CONSOLE_OUTPUT": "true"
      }
    }
  }
}
```

> **Not:** `n8n-mcp` paketi npm'de var (czlonkowski/n8n-mcp). Node.js gerekli (Windows'ta `node --version` ile kontrol et).

### Doğrulama
Windsurf'te bir konuşma aç ve şunu sor: "n8n workflow listesini ver". MCP doğru kurulduysa `n8n_list_workflows` aracını kullanır ve `xccY2rWaswRM7ZoZ` görünür.

### Sık kullanılan MCP araçları
| Araç | Ne yapar |
|---|---|
| `n8n_list_workflows` | Tüm workflow'ları listeler |
| `n8n_get_workflow` | Tek workflow'ın tam JSON'u |
| `n8n_update_partial_workflow` | Sadece değişen node'ları günceller (büyük workflow'larda zorunlu — partial olmadan timeout) |
| `n8n_executions` | Son çalıştırma loglarını gör (debug için kritik) |
| `n8n_validate_workflow` | Push'tan önce doğrula |
| `search_nodes` | Node tipi ararken (örn. `lmChatOpenAi`) |
| `get_node` | Node'un property/operation şemasını getir |

### Production workflow'u düzenlerken kurallar
1. **Önce `n8n_get_workflow` ile mevcut state'i al**, JSON'u oku
2. **`n8n_update_partial_workflow` kullan** — full update production'ı keser
3. **Değişiklikten sonra `n8n_executions` ile bir test execution kontrol et**
4. **Twilio sandbox'tan WhatsApp mesajı atıp e2e doğrula**

---

## 2. VPS SSH Erişimi

### Bağlantı bilgisi
- **Host:** `n8n.infinitymade.de` (veya direkt Hetzner IP'si)
- **User:** `root`
- **Auth:** SSH key (passwordless), key tipi: ed25519
- **Public key path:** `C:\Users\Test\.ssh\id_ed25519.pub`
- **Private key path:** `C:\Users\Test\.ssh\id_ed25519`

### Test komutu (Windows PowerShell)
```powershell
ssh root@n8n.infinitymade.de "uptime"
```

İlk seferde `known_hosts`'a fingerprint sorar — `yes` de.

### Eğer Windsurf'ten SSH çalışmıyorsa
1. SSH key public kısmını kopyala: `cat ~/.ssh/id_ed25519.pub`
2. VPS'te `~/.ssh/authorized_keys` zaten var, yeni key ekle:
   ```bash
   echo "<public_key>" >> ~/.ssh/authorized_keys
   ```
3. Permission'lar: `chmod 600 ~/.ssh/authorized_keys`

### VPS'te dosya yapısı
```
/opt/n8n/
├── docker-compose.yml      # traefik + n8n
├── .env                    # DOMAIN, ACME_EMAIL, TZ, N8N_ENCRYPTION_KEY
├── n8n_data/               # n8n persisted state (workflows, credentials)
└── letsencrypt/            # SSL cert storage

/opt/calendar-api/
├── docker-compose.yml      # calendar-api + watchtower
└── .env.calendar           # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
                            # GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
                            # GOOGLE_REDIRECT_URL, N8N_WEBHOOK_URL
```

> **DİKKAT:** İki ayrı `docker-compose.yml` var, iki ayrı stack. Aynı `web` external network'ünde haberleşiyorlar. Yan yana çalışıyorlar — birini değiştirirken diğerine dokunma.

---

## 3. Sık Yapılacak VPS Operasyonları

### Calendar API logları (canlı izle)
```bash
ssh root@n8n.infinitymade.de "docker logs calendar-api -f --tail 100"
```
Ctrl+C ile çık.

### Bir kerelik son 50 satır
```bash
ssh root@n8n.infinitymade.de "docker logs calendar-api --tail 50"
```

### Tüm container'ların durumu
```bash
ssh root@n8n.infinitymade.de "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
```

### Calendar API force restart (env değiştiyse)
```bash
ssh root@n8n.infinitymade.de "cd /opt/calendar-api && docker compose pull && docker compose up -d --force-recreate calendar-api"
```

### `.env.calendar` güncelleme
```bash
# Önce mevcut değeri gör
ssh root@n8n.infinitymade.de "cat /opt/calendar-api/.env.calendar"

# Tek satır ekle/değiştir (örnek)
ssh root@n8n.infinitymade.de "sed -i 's|^OLD_KEY=.*|OLD_KEY=newvalue|' /opt/calendar-api/.env.calendar"

# Sonra restart
ssh root@n8n.infinitymade.de "cd /opt/calendar-api && docker compose up -d --force-recreate calendar-api"
```

### Watchtower'ı manuel tetikle (deploy beklemeden image pull)
```bash
ssh root@n8n.infinitymade.de "docker exec watchtower /watchtower --run-once calendar-api"
```

### n8n logları
```bash
ssh root@n8n.infinitymade.de "docker logs n8n --tail 50"
```

### Traefik routing kontrolü
```bash
ssh root@n8n.infinitymade.de "docker logs traefik --tail 30"
```

---

## 4. Auto-Deploy Pipeline (zaten kurulu, akış böyle)

```
1. Local: dosya değiştir → git add api-backend/server.js → git commit → git push
2. GitHub Actions: .github/workflows/publish-calendar-api.yml tetiklenir
   - api-backend/Dockerfile ile image build (Node 22 alpine)
   - GHCR'a push: ghcr.io/ironkemal/infinitymade-website/calendar-api:latest
   - Süre: ~3 dakika
3. VPS Watchtower: 60 saniyede bir GHCR'ı poll eder
4. Yeni image varsa: pull → eski container'ı durdur → yenisini başlat
5. Total: ~4 dakika sonra production'da
```

### Pipeline'ın çalıştığını doğrulama
```bash
# 1. GitHub Actions çalıştı mı?
gh run list --workflow=publish-calendar-api.yml --limit 5

# 2. GHCR'da yeni image var mı? (sha tag'i son commit ile eşleşmeli)
ssh root@n8n.infinitymade.de "docker images ghcr.io/ironkemal/infinitymade-website/calendar-api"

# 3. Watchtower son ne zaman güncelledi?
ssh root@n8n.infinitymade.de "docker logs watchtower --tail 30 | grep -i 'found new\|updating'"
```

### Pipeline çalışmazsa hangi hatalar olabilir
| Belirti | Sebep | Çözüm |
|---|---|---|
| GH Actions kırmızı | Dockerfile syntax veya `npm install` patladı | Action loglarını oku, lokal `docker build` ile tekrarla |
| Action yeşil ama image güncel değil | Cache sorunu | Workflow'u `workflow_dispatch` ile manuel tetikle |
| Image güncel ama VPS eskisini kullanıyor | Watchtower label eksik | docker-compose'da `com.centurylinklabs.watchtower.enable=true` label var mı kontrol et |
| GHCR pull error | Image private oldu | GitHub → Packages → calendar-api → Settings → Public yap |

---

## 5. Supabase Operasyonları

### Project info
- **Project ref:** `njvuclullotbksskpwgk`
- **URL:** `https://njvuclullotbksskpwgk.supabase.co`
- **Dashboard:** `https://supabase.com/dashboard/project/njvuclullotbksskpwgk`

### MCP üzerinden SQL çalıştırma (önerilen)
Supabase MCP `.mcp.json`'da kurulu. Windsurf'te MCP'yi tetikleyince OAuth flow açılır, bir kez login → çalışır. Sonra:
- "Bookings tablosunda owner_id null olan kayıt var mı?" → MCP `execute_sql` çağırır
- "b2b_contacts tablosu oluştur" → MCP migration uygular

### Service role key
- Backend (`api-backend/server.js`) içinde `SUPABASE_SERVICE_ROLE_KEY` env var olarak kullanılıyor
- VPS'te `/opt/calendar-api/.env.calendar` dosyasında
- **ASLA frontend'e geçirme** — RLS bypass yetkisi var

### Anon key
- Frontend için: `supabase-config.js` içinde
- RLS uygulanır, güvenli

### Önemli RLS politikaları
```sql
-- Tek tek kontrol etmek için Supabase SQL editor'de:
SELECT policyname, tablename, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

`bookings` tablosunda mevcut policy: `auth.uid() = user_id` (FOR ALL).
Public insert için ayrı policy: `Public insert bookings` (FOR INSERT WITH CHECK (true)).

### Önemli RPC fonksiyonu
- `business_lookup_for_twilio(phone TEXT)` — n8n workflow'u Twilio webhook'unda kullanıyor, service_role gerekli

---

## 6. Stripe Operasyonları

### Webhook URL
`https://www.infinitymade.de/api/stripe/webhook` (www zorunlu, naked domain çalışmaz)

### Vercel env vars (production'da kurulu)
- `STRIPE_SECRET_KEY` (sk_test_...)
- `STRIPE_WEBHOOK_SECRET` (whsec_...)
- `STRIPE_PRICE_*` price ID'leri (STRIPE_SETUP.md'de liste var)
- `SUPABASE_SERVICE_ROLE_KEY`

### Test mode'dan production'a geçiş (henüz yapılmadı)
1. Stripe dashboard → Live mode
2. Yeni price ID'ler oluştur
3. Vercel env vars güncelle (`sk_live_...`)
4. Webhook secret yenile
5. Customer Portal'ı live mode'da aktive et

---

## 7. Twilio Operasyonları

### Sandbox bilgileri (şu an aktif)
- **WhatsApp number:** `+14155238886`
- **Sandbox keyword:** Twilio console'da görünür ("join <word>" ile kullanıcı sandbox'a join eder)
- **Webhook (incoming):** n8n webhook URL'i (`https://n8n.infinitymade.de/webhook/<id>` — workflow'un `Webhook` node'unda)

### Production'a geçiş (henüz yok)
1. Facebook Business Manager hesabı
2. WhatsApp Business API approval
3. Twilio Senders → WhatsApp number satın al
4. n8n webhook URL'sini Twilio Console'a kayıt et
5. Sandbox'tan production'a workflow'u kopyala

---

## 8. Windsurf'te Yaygın Senaryolar

### "WhatsApp randevu alamadı, debug et"
1. n8n MCP: `n8n_executions(workflowId='xccY2rWaswRM7ZoZ', limit=5)` → son çalıştırmaları gör
2. Hata varsa exception detay → SSH ile calendar-api logları: `docker logs calendar-api --tail 100`
3. Booking gerçekten DB'ye yazıldı mı? Supabase MCP: `select * from bookings where created_at > now() - interval '5 minutes'`

### "server.js'e yeni endpoint eklemek istiyorum"
1. Lokal'de düzenle
2. `git add api-backend/server.js && git commit -m "..." && git push`
3. ~4 dakika bekle (GH Actions + Watchtower)
4. SSH ile `docker logs calendar-api --tail 20` → "Calendar API running on port 3000" yeniden görmeli
5. Yeni endpoint'i test et: `curl https://n8n.infinitymade.de/api/...`

### "Yeni Supabase tablo lazım"
1. Supabase MCP üzerinden migration SQL çalıştır
2. RLS politikası ekle (en az `owner_id = auth.uid()`)
3. Frontend'de yeni query'leri yaz
4. Git'e ekle: `database_v4_<isim>.sql` dosyası oluştur (migration history için)

### "n8n workflow tool body'sini değiştirmek istiyorum"
1. n8n MCP: `n8n_get_workflow(id='xccY2rWaswRM7ZoZ')` → mevcut JSON
2. Tool node'unu bul, JSON body'yi düzenle
3. `n8n_update_partial_workflow` ile sadece o node'u gönder
4. n8n.infinitymade.de UI'dan workflow'u açıp manuel test et

---

## 9. Acil Durum Komutları

### Tüm stack'i ayağa kaldır (her şey patladı senaryosu)
```bash
ssh root@n8n.infinitymade.de
cd /opt/n8n && docker compose down && docker compose up -d
cd /opt/calendar-api && docker compose down && docker compose up -d
docker ps  # hepsi healthy olmalı
```

### Calendar API'yi tamamen sıfırla (image cache temizle, fresh pull)
```bash
ssh root@n8n.infinitymade.de "
cd /opt/calendar-api &&
docker compose down &&
docker rmi ghcr.io/ironkemal/infinitymade-website/calendar-api:latest &&
docker compose pull &&
docker compose up -d
"
```

### SSL cert sorunları
```bash
ssh root@n8n.infinitymade.de "ls -la /opt/n8n/letsencrypt/"
# acme.json dosyası varsa cert'ler oradadır. Sıfırlamak için:
# (DİKKAT: bunu yaparsan let's encrypt rate limit'e takılabilirsin!)
```

### n8n credentials kaybolduysa
n8n'in kendi DB'sinde encrypted. `N8N_ENCRYPTION_KEY` env var'ı kaybolduysa veri okunamaz — bu yüzden `/opt/n8n/.env` BACKUP TUT.

---

## 10. Önemli Sırlar Nerede?

| Sır | Konum |
|---|---|
| Supabase service role key | VPS `/opt/calendar-api/.env.calendar` + Vercel env vars |
| Google OAuth client ID/secret | VPS `/opt/calendar-api/.env.calendar` |
| n8n encryption key | VPS `/opt/n8n/.env` |
| n8n API key (yeni oluşturulacak) | Sadece kullanıcının yerel cihazında |
| Stripe secret key | Vercel env vars |
| Twilio auth token | n8n credentials (UI'dan girilir) |
| GitHub PAT | Lokal `gh auth status` |

**ASLA git'e commit etme**, `.gitignore` zaten `.env` ve `.env.*.local`'i hariç tutuyor. Ek dosyalar eklemeden önce `.gitignore`'u kontrol et.

---

*Son güncelleme: 2026-05-10 — Claude Opus 4.7 (Claude Code)*
