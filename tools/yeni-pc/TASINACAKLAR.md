# Yeni PC'ye geçiş — ne taşınır, nasıl

İki betik var:

| Betik | Nerede çalışır | Ne yapar |
|---|---|---|
| `eski-pc-paketle.ps1 -Hedef E:\praxura-tasima` | **eski** PC | Aşağıdaki her şeyi tek klasöre toplar (USB/harici disk) |
| `kurulum.ps1 -Yedek E:\praxura-tasima` | **yeni** PC, Yönetici PowerShell | winget ile araçları kurar, yedeği yerine koyar, `npm install`, hook'lar. Yeniden başlatmadan sonra kendiliğinden devam eder; tekrar çalıştırmak zararsız |

> ⛔ Taşıma klasörü **USB / harici disk** olur, Google Drive **değil** — içinde `.env`,
> SSH anahtarları, Azure/Supabase/Stripe sırları var.

## Sıra

1. **Eski PC:** depoda `git status -sb` → mümkünse commit + push (yine de klasör bütünüyle kopyalanır).
2. **Eski PC:** `eski-pc-paketle.ps1 -Hedef <USB>`
3. **Yeni PC:** Windows kullanıcı adını **`Kemal Demir`** yap (aşağıya bak), sonra
   `Set-ExecutionPolicy -Scope Process Bypass -Force; & <USB>\website\tools\yeni-pc\kurulum.ps1 -Yedek <USB>`
   (Android işi için `-Android` ekle.)
4. Betiğin sonunda yazan "ELLE YAPILACAKLAR" listesi (Docker'ı aç, Antigravity'ye gir, `claude` → `/login`, `gh auth login`, Drive'a gir).

## Taşınanlar ve nedenleri

### Depo — `Desktop\claude\website` (node_modules hariç, ~2 GB)
Git'ten klonlamak **yetmez**, çünkü şunlar gitignore'lu:

| Dosya / klasör | Ne |
|---|---|
| `.env.local` · `api-backend/.env` · `api-backend/.env.poc` · `onprem/.env` · `onprem/supabase-docker/.env` · `ops/.env.ops` · `sosyal/yayinci/.env` | Sırlar |
| `azure-credentials.local.txt` · `.mcp.json` | Azure, proje MCP ayarı |
| `INFRASTRUCTURE.md` · `PARTNERSHIP_NOTES.md` | SSH/VPS erişimi, ortaklık notları |
| `guvenlik/` · `mentor/` · `Meetings/` · `legal/` | Siciller ve toplantılar |
| `onprem/praxura-local-root.crt` · `onprem/docker-compose.override.yml` | Lokal kutu |
| `*.pdf` (wissensbank) · gitignore'lu `.txt` türevleri | Resmî belgeler |
| `sosyal/ausgabe/` · `sosyal/musik/stimme/` · `sosyal/musik/*.wav` · `sosyal/yayinci/.daten/` | Video üretimi |
| Commit edilmemiş iş (bugün: `sosyal/_muster/F*.json`, `sosyal/foto/*`, `konsey/tutanak/2026-10-28-…`) | Kaldığın yer |

### Ev klasörü — `C:\Users\Kemal Demir\`

| Klasör | Ne | Not |
|---|---|---|
| `.claude\` | Claude Code: **hafıza** (`projects\…\memory\`), skills, agents, hooks, settings.json, oturum geçmişi | `plugins\cache` + `plugins\marketplaces` kopyalanmaz (15 GB) → yeni PC'de `/plugin` ile yeniden kur |
| `.claude.json` | MCP sunucuları (n8n, supabase…), proje ayarları | |
| `.claude-mem\` | claude-mem hafızası + work_state | ~1 GB |
| `.gemini\` · `.antigravitycli\` · `.antigravity-ide\` | Antigravity / agy ayar + geçmiş | `bin`, `logs` hariç |
| `AppData\Local\agy\` | `agy` CLI ikilisi | IDE kurulunca gelmezse betik geri koyar + PATH'e ekler |
| `.ssh\` | `id_ed25519`, `praxura_merkez`, `infinitymade_kobi`, `config`, `known_hosts` | VPS + merkez erişimi |
| `.n8n-mcp\` · `.mcp-auth\` · `.azure\` · `.docker\` | MCP anahtarları, Azure CLI, Docker girişi | |
| WSL `Praxura` dağıtımı | Lokal on-prem test kutusu | Betik sorar, `wsl --export` ile |

### Taşınmayan / yeniden giriş yapılan
- Windows Credential Manager (GitHub girişi) → ilk `git push`'ta tarayıcı açılır
- Google Drive (`I:\My Drive\Ops Praxura gitnogo\`) → Drive'a giriş yapınca kendisi gelir
- Tarayıcı oturumları (Play Console, Supabase, Vercel, Stripe), parola kasası
- Playwright oturumları (`-s=praxura-qa` vb.) → ilk testte yeniden giriş
- Desktop'taki diğer projeler (`InfinityMuslim-Play-Gorseller`, `praxura-devir`, …) — gerekenleri elle kopyala

## Kullanıcı adı farklıysa
Claude hafızası yol adına bağlı: `.claude\projects\c--Users-Kemal-Demir-Desktop-claude-website\`.
Yeni kullanıcı adı başka ise (ör. `kemal`), depoyu yine `Desktop\claude\website`'e koy ve
o klasörü yeni yola göre yeniden adlandır (`c--Users-kemal-Desktop-claude-website`).
`settings.json`'daki hook yolları da (`C:/Users/Kemal Demir/...`) elle düzeltilmeli.
