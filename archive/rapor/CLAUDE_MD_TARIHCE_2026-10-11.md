# CLAUDE.md'den çıkarılan tarihçe blokları (11.10.2026)

Bu bloklar CLAUDE.md'den çıkarıldı, çünkü kapanmış işleri anlatıyorlardı ve her oturumda yükleniyorlardı.
Buradaki satır numaraları ve sayılar yazıldıkları günün değeridir — **güncel bilgi için bakma.**
Tam eski sürüm: `git show 2c65a15e:CLAUDE.md`

## Klasör sınıflandırma tablosu + yayın yüzeyi kuralı (eski satır 163,192)

### 🗺️ Haritasız değil, sınıflandırılmış: geri kalan klasörler (2026-08-27)

Aşağıdakiler **koda bağlı değildir** — hiçbiri runtime'da yüklenmez, hiçbiri yayına
gitmez (`.vercelignore`). Kod ararken buralara bakma; ne oldukları burada yazılı ki
bir daha "bu klasör neydi" diye açılmasın.

| Klasör / dosya | Ne | Durum |
|---|---|---|
| ~~`ui-audit/` · `mobile-audit/`~~ | ✅ **ÇÖZÜLDÜ 09.09.2026** — `archive/denetim/`'a taşındı. Üretici script'ler (`ui_audit_shots.py`, `capture_mobile*.py`) ve `mobil-ui` ajanının protokol dosyası aynı commit'te yeni path'e güncellendi | Path değişti — `archive/denetim/ui-audit/` · `archive/denetim/mobile-audit/` |
| ~~`competitor-research/`~~ | ✅ **ÇÖZÜLDÜ 09.09.2026** — `archive/recherche/`'a taşındı. `archive/competitor-research-optica/` içindeki 36 kırık atıf (zaten farklı makine kullanıcı adına yazılıydı) yeni path'e çekildi, `tools/tabellenkarte.mjs` SKIP_DIRS'ten temizlendi | Path değişti — `archive/recherche/competitor-research/` |
| `onprem/` | (a) `supabase-docker/` = **upstream vendor kopyası**, bizim kodumuz değil (b) `schema/` = 2026-07-06 pg_dump (c) `poc-frontend-server.mjs` = Faz 0 | REFERANS — playbook Faz 2 girdisi. ⚠️ **Şema gerçeği `db/` altındadır**; `onprem/schema` Temmuz'da dondu (70 tablo) |
| ~~kök `database_v*.sql` (39)~~ | ✅ **ÇÖZÜLDÜ 09.09.2026** — `archive/kod/`'a taşındı. Numaralar çakışıyordu (v28/v29/v31 ikişer kez, v13/v14 yok), DB'de 195 migration kayıtlı, çalışma zamanında hiçbiri okunmuyordu (db-ustasi + fonksiyon-ustasi doğruladı). Gerçek şema: `db/SCHEMA.sql` | Path değişti — atıf veriyorsan `archive/kod/` önekiyle |
| ~~`supabase/migrations/`~~ | ✅ Zaten 04.09.2026'da `archive/supabase-migrations-vor-baseline/`'a taşınmış (14 dosya). ⛔ `supabase/functions/` (Fahrtenbuch Edge Functions, `dashboard.js:5745` vd.) CANLI, karıştırma | — |
| `sql-melih/` | ⛔ **CANLI KANAL — ARŞİVLİK DEĞİL.** Melih SQL bırakıyor (son: 07-08.09.2026), `db/REGISTER.md` `rechnung_zahlungen` tablosunun kaynağı olarak doğrudan gösteriyor. 09.09.2026'da SQL üç gün burada beklerken backend deploy edilmiş, fatura akışı bloke olmuştu (`db/REGISTER.md:517`) — **açık iş kuyruğu, arşive gitmez.** Yalnız `SUPABASE-JETZT-AUSFUEHREN.sql` (kök kopyası zaten silindi, buradaki kalıyor) ve bayat `OFFEN.md` kapanmış | Melih ile koordine etmeden dokunma |
| `assets/` · `fonts/` · `images/` | ★ **CANLI.** `assets/img/fn/` = Funktionen-walkthrough (`index.html:1485`), `assets/img/fn/_raw/` = ham PNG kaynağı (eski `funktionen-shots/raw/`), `img/foot/` = podoloji ayak haritası; `fonts/` = self-hosted Inter/Outfit; `images/` sadece `kemal-demir-v4.png` | CANLI |
| ~~`Logo/` · `web foto/` · `app ss/` · `demo rezept/` · `voice demo/` · `demo slayt/`~~ | ✅ **ÇÖZÜLDÜ 09.09.2026** — `archive/medya/`'a taşındı (wissensbank ile doğrulandı, sıfır kod referansı — `Logo/` istisna: `dashboard-vorschau.html`'in iki ikon path'i güncellendi, ama sayfa zaten `.vercelignore`'daki `Logo/` kuralı yüzünden prod'da 404 alıyordu, taşıma bunu değiştirmedi) | — |
| ~~`pakete/` · `cache/`~~ | ✅ **SİLİNDİ 09.09.2026** (arşive değil) — `pakete/pakete.css` ve `cache/projects.json` tam metin aramada sıfır referans, ikisi de kazara girmiş | — |
| `.planning/` · `.plans/` | İki **farklı** sistem: `.planning/` = GSD `pause-work` handoff'u (2026-05-19, sprint-6 kapandı) · `.plans/` = 4 eski plan | ARŞİVLİK — açık iş **Ops-Dashboard'a** yazılır |
| ~~kök `lib/`~~ | ✅ **ÇÖZÜLDÜ 28.08.2026** — `archive/lib-orphan/`'a taşındı. Hiçbir yerden import edilmiyordu (`admin.js` dahil kontrol edildi). Gerekçe ve içinden ne kurtarılabileceği: `archive/README.md` | **`api-backend/lib/` ile KARIŞTIRMA** — o canlı ve dokunulmadı |
| ~~`ai chatbot proje/`~~ | ✅ **ÇÖZÜLDÜ 09.09.2026** — kod (`index.html`) `archive/ai-chatbot-proje/`'ye taşındı, artık belgeleriyle aynı yerde. Taşıma tamamlandı | — |
| kök `*.py` (17, önce 26'ydı) | `qa_credentials.py` = 10 script'in ortak import'u · `qa_crawl_*.py` = prod QA (`app.praxura.de`, çalışır) · `capture_flows.py`/`capture_funktionen.py` = `assets/img/fn/_raw/` üretimi (korumalı, bkz. isim kuralı) · `capture_mobile*.py` = `mobil-ui` ajanının protokol altyapısı · `ui_audit_shots.py` = `ui-audit/` üretici. ⚠️ `qa_demo_prep.py` **KIRIK DEĞİL** (09.09.2026 düzeltildi — hedefi `app.praxura.de`, sadece rapor metninde kozmetik bir `infinitymade` geçiyor). `qa_visual_verify*` gerçekten kırık (`app.infinitymade.de` hedefli). 9 gerçek atık (`dash_test`, `fix_encoding`, `scratch_live_demo`, `scratch_screenshot`, `ui_diag`, `ui_montage`, `verify_changes`, `verify_funktionen`, `write_icd`) 09.09.2026'da `archive/kod/`'a taşındı | Karışık — bu ayrım geçerli |
| ~~kök `*.md` raporları (arşivlik kısım)~~ | ✅ **ÇÖZÜLDÜ 09.09.2026** — `SEO_AKTIONSPLAN` · `KONTRAST_AUDIT` · `DUPLICATION_AUDIT` · `ITSG_EMAIL_DRAFT` · `STRIPE_SETUP` → `archive/rapor/`. **GÜNCEL** olanlar kökte kaldı: `ONPREM_MIGRATION_PLAYBOOK` · `TYPECHECK` · `REBRANDING_GUARDRAILS` · `ARBEITSZEITEN_PRO_STANDORT` (uygulanmamış açık plan) · `LEGAL_ONPREM_REQUIREMENTS` · `UMAMI_SETUP` (⚠️ 29.08.2026 düzeltildi — burada "hiç kurulmadı" yazıyordu, **yanlıştı**: Umami kurulu ve çalışıyor. `cookie-consent.js` → `injectUmami()`, `analytics.infinitymade.de` HTTP 200, 19 blog sayfasının 18'inde (tek istisna ölü `component-lab.html`) + 10 pazarlama sayfasında, `datenschutz.html:121'de ilan edilmiş. ⚠️ `datenschutz.html:146` "onay gerekmez" diyor ama kod yalnız onaydan sonra yüklüyor — Mayıs metni, Haziran kararı; hukuk metni geride kalmış). ⛔ **`PODOLOGIE_ORCHESTRATOR_PROMPT.md` kökte kalıyor, taşınmaz** — satır 333'te canlı bir hesap şifresi var, `guvenlik/REGISTER.md:506` (A-08) bu dosyaya dokunulmamasını kayda geçmiş, taşınırsa o satır atfı kırılır | — |

> **Yayın yüzeyi kuralı (2026-08-27):** `.vercelignore` artık **klasör bazlı** tutulur,
> yalnızca dosya uzantısı bazlı değil. 2026-06-03 denetimi uzantıları kapatmıştı; sonradan
> eklenen her klasör aynı delikten geçip `praxura.de` üzerinde HTTP 200 döndü —
> `ui-audit/`, `onprem/supabase-docker/docker-compose.yml`, `funktionen/INDEX.json`
> (990 KB, uygulamanın tam fonksiyon haritası), `tools/.namen-hashes`, `dashboard.js.bak`.
> **Yeni klasör eklerken:** yayına girmesi gerekiyor mu? Gerekmiyorsa aynı commit'te
> `.vercelignore`'a yazılır. Ölçüt **runtime**'dır — yorumdaki kaynak atfı sayılmaz.

## db/ ve module/ ağaç yorumları (eski satır 100,112)

├── db/                            ★ Şema + tablo kaydı — SQL yazmadan ÖNCE oku
│   ├── README.md                  Yönelim + 7 tuzak + tazeleme kuralı
│   ├── SCHEMA.sql                 82 tablo · 1210 kolon, constraint'ler, view'lar
│   ├── SCHEMA-RLS.sql             155 RLS policy · 63 fonksiyon · 62 trigger · 295 index
│   │                              (rakamlar dökümün kendi başlığından — orası kaynaktır.
│   │                               30.08.2026: burada iki kez ve yanlış duruyorlardı —
│   │                               mükerrer blok silindi, sayılar canlıya karşı sayıldı)
│   ├── REGISTER.md                ★ NİYE açıldı — 82/82 tablo, elle bakımlı (db-ustasi)
│   └── NUTZUNG.json/.md           KİM okuyor/yazıyor — üretilir (tools/tabellenkarte.mjs)
│
├── module/                        ★ YENİ FRONTEND KODUNUN YERİ (Konsey 2026-08-13)
│                                  78 dosya · `dashboard.js` büyümesin diye burası var.
│                                  `*.test.js` → `npm test` (node --test, 250 test)

## Stripe webhook + stripe-live-setup hikâyesi (eski satır 267,279)

- **Webhook:** `https://app.praxura.de/api/stripe/webhook` — ✅ 2026-08-05'te panelden
  doğrulandı. Kodun fallback'i de aynı (`create-checkout-session.js:10`,
  `portal-session.js:8`), yani `NEXT_PUBLIC_URL` boş olsa bile doğru domain'e gider.
  ⚠️ Ama env **yanlış** bir değere set edilmişse fallback devreye girmez — Vercel'de
  `NEXT_PUBLIC_URL` varsa `https://app.praxura.de` olmalı.

`archive/rapor/STRIPE_SETUP.md` — env var **adları** geçerli, ama dosya Test Mode
döneminde yazıldı (09.09.2026'da köşeden `archive/rapor/`'a taşındı).
LIVE ürün/fiyat scripti: **`stripe-live-setup.cjs`** — `.cjs` uzantısı şart.
⚠️ Yanındaki `stripe-live-setup.js` **çalışmıyordu**: `package.json`'da `"type": "module"`
var, dosya ise `require()` kullanıyordu → `ReferenceError: require is not defined in ES
module scope`. İki dosya tek kelime farkla aynıydı (hata mesajı DE/TR). ✅ 09.09.2026'da
`archive/kod/stripe-live-setup.js`'e taşındı (silme değil arşivleme — geri alınabilir).

## n8n bölümü (eski satır 290,309)

## 🤖 n8n

⚠️ **04.09.2026 düzeltmesi — burada "Azure AI gateway" yazıyordu, artık doğru değil.**
Azure çağrısı n8n'den geçmiyor; `api-backend/ai/azureClient.js` doğrudan gidiyor.

Kodda kalan **gerçek** n8n bağı iki satır, ikisi de env-guard'lı:
- `server.js:1053` — `N8N_WEBHOOK_URL`, booking bildirimi (env yoksa sessizce atlanıyor)
- `server.js:1806` — `N8N_AI_SERIES_URL`, seri planlayıcı (deterministik fallback var)

İkisi de playbook Faz 1.2'de Express'e taşınacak; kabul kriteri `grep N8N_` → sıfır.
Ayrıca `gkv-datenaustausch.de` izleme workflow'u Telegram bildirimi atıyor (merkez tarafı,
kutuya girmez).

⛔ n8n **on-prem pakete konmaz** (playbook K8 — Sustainable Use License ücretli müşteriye
dağıtımı yasaklıyor). Bu `onprem` ajanının sert veto konularından biri (G3).

WhatsApp / Twilio / AI resepsiyonist **2026-05-20'de raflandı ve geri gelmiyor** — tablolar
DROP'lu. Pazarlama metinlerinde kullanma, `business_lookup_for_twilio` RPC'sine dokunma.

⛔ G8: **yeni n8n workflow'u açılmaz** (aşağıya bak).

## Ekran/akış sicili protokolü (uzun hâli) (eski satır 467,495)

### 🖥️ Ekran/akış sicili protokolü (2026-09-19)

**"Bu ekran/buton ne yapmalı, en son ne zaman doğrulandı" sorusu tahminle değil
`canli-test/REGISTER.md` okunarak cevaplanır.** `canli-test` ajanı önceden tek seferlik
akış testi yapıyordu (bir kez gez, bulguyu raporla, unut) — artık bu kayıt sayesinde
**kümülatif**: her test turu bir/birkaç ekranın "beklenen davranışını" ve son test
tarihini biriktirir, bir dahaki turda sıfırdan başlanmaz.

İki bölümü var:

| Bölüm | Ne | Kim yazar |
|---|---|---|
| Ekran/Fonksiyon kayıtları | Panel/akış başına: beklenen davranış, bağımlı ekranlar, son test tarihi+sonucu | `canli-test` — her test turunda |
| Bildirilen anomaliler | Test dışında fark edilen arayüz tuhaflığı (çift render, yanlış buton, eksik bildirim) | **herhangi bir ajan** — `fonksiyon-ustasi`, `db-ustasi`, `builder`, `podoloji`, `mobil-ui` |

- **Domain doğruluğu (bu akış podolog için mantıklı mı) `canli-test`'in kendi yargısı
  değildir** — önce `podoloji` ajanına sorulur, cevap registera yazılır. `canli-test`
  kendi başına yalnız mekanik doğruluğu (çalışıyor mu, konsol temiz mi, sayfa
  yenilenince veri duruyor mu) yargılar.
- **Otomatik/periyodik tarama kurulmadı** — bu ajan sadece istendiğinde çalışır
  ("şunu test et", "deploy oldu mu bak"). Sürekli izleme değil, kontrol elde kalsın
  diye bilinçli tercih (2026-09-19).
- Kayıt **elle tutulur, üretilmez** ve **kümülatif** doldurulur — 23 panelin tamamını
  tek seferde katalogla**ma**, `fonksiyon-ustasi`'nin "okuyarak kapsama iddiası etme"
  ilkesiyle aynı gerekçe (bkz. yukarıdaki fonksiyon haritası protokolü).
- Ajan/kod ilişkisi: `canli-test` mekanik test altyapısını (Playwright, üç kapı, devir
  paketi) zaten tutuyordu — bu, o altyapıya eklenen bir **hafıza katmanı**, ayrı bir
  agent değil. Gerekçe ve alternatiflerin değerlendirmesi kullanıcıyla netleştirildi
  (2026-09-19): ayrı agent açmak aynı browser-test mekaniğini iki yerde tekrar ederdi.

## Lokal testen (Almanca blok) (eski satır 688,708)

## 🧪 Lokal testen und Browser-Proben (2026-08-25)

**`node dev_server.cjs` → http://localhost:8081** — der Entwicklungsserver
beantwortet seit 25.08.2026 auch `/api/config` (aus `.env.local` oder
Umgebungsvariablen). Vorher scheiterte der Login lokal immer, weil
`supabase-config.js` die Schlüssel über diese Route holt und ein reiner
Dateiserver 404 lieferte. Die zwei Werte stehen unter
`https://app.praxura.de/api/config` und sind kein Geheimnis (Anon-Key, Schutz
kommt von RLS).

**`npm run probe`** — drei Prüfungen im echten Browser, **ohne Login**
(`tools/browser-probe/`, Playwright). Sie messen Kalendergeometrie, laden alle
in `dashboard.js` importierten Module und zeichnen die Renderer mit erfundenen
Daten. Sie schliessen die Lücke zwischen `node --test module/*.test.js` (kein
DOM) und einem Klickdurchgang (braucht Login). Beim ersten Lauf haben sie
sofort einen Fehler gefunden, der sonst ausgeliefert worden wäre.

Einmalige Einrichtung: `npm i -D playwright && npx playwright install chromium --only-shell`.

⚠️ `npm install` läuft in diesem Konto in ein Rechteproblem im npm-Cache.
Umgehung: `--cache /tmp/npm-cache-praxura`.

## Paylaşılan belge klasörü + Drive olayı (eski satır 786,802)

  roadmap (T1–T6 plan metni, katman zinciri, DoD) ve §5 kapanmış maddelerin kaydı.
- **Paylaşılan belge klasörü** — `I:\My Drive\Ops Praxura gitnogo\` (Google Drive, 2026-08-08).
  Depoya girmeyen ama Melih'in de görmesi gereken belgeler burada:
  `vertraege/` (imzalı sözleşmeler + üretim script'i) · `meetings/` (toplantı dökümleri,
  beta müşteri ismi içerir) · `partnerschaft/` (`PARTNERSHIP_NOTES.md`) ·
  `infra/` (`INFRASTRUCTURE.md`) · `finanzen/`.
  ⛔ **Kod ve `.git` buraya KONMAZ** — depo 1,1 GB, `.git` 352 MB; senkron istemcisi `.git`'i
  bozar ve iki kişi aynı anda çalışınca çakışan-kopya üretir. Kod GitHub'dan paylaşılır.
  ⛔ Sırlar (`.env`, SSH özel anahtarı, API key) buraya da girmez → parola kasası.
  ⚠️ **09.09.2026'da bu tam olarak yaşandı:** depo kökünde git'e commit edilmiş bir
  `.tmp.driveupload/` klasörü bulundu (origin/main'de de vardı) — birinin Google Drive
  masaüstü istemcisi depo klasörünü senkronluyormuş. İçerik hassas değildi (bir HTML
  sayfasının senkron kopyası), git'ten çıkarıldı ve `.gitignore`'a eklendi, ama asıl
  düzeltme Drive senkron kapsamından bu depo klasörünün çıkarılmasıdır — kimde ise.
- `INFRASTRUCTURE.md` — SSH/VPS erişimi, deploy pipeline, sık operasyonlar.
  Depoda (gitignore'lu) **ve** paylaşılan klasörün `infra/` altında. Ön koşul olan koruyucu
  belgeler 2026-08-06'da imzalandı (Datengeheimnis · Nutzungsrechte · §203 kapsanıyor).

## Arşiv geçmişi + son güncelleme + Codex notu (eski satır 815,836)

### 🗄️ Arşiv (2026-08-05 · genişletildi 09.09.2026)
39 eskimiş rapor/plan `archive/` altına taşındı — **silinmedi.** Neden eskidikleri ve içlerinden
neyin kurtarıldığı `archive/README.md`'de. Oradaki audit bulguları **iddiadır**, aksiyon almadan
önce koda/DB'ye karşı doğrula (2026-08-05'te iki güvenlik iddiası doğrulandı ve çürüdü).

09.09.2026'da büyük bir kök temizliği yapıldı (fonksiyon-ustasi + db-ustasi + wissensbank ile
doğrulanarak): `archive/` altına alt klasörler açıldı — `kod/` (ölü .py/.js/.cjs + 39
database_v*.sql + terk edilmiş "ai chatbot proje/"), `medya/` (Logo/, web foto/, app ss/,
demo rezept/, voice demo/, demo slayt/), `rapor/` (5 arşivlik kök .md raporu). Detay ve
gerekçe: yukarıdaki "Haritasız değil, sınıflandırılmış" tablosu. `pakete/` ve `cache/`
sıfır referans oldukları için arşive değil, doğrudan silindi. Ayrıca kök `.tmp.driveupload/`
(Google Drive senkron artığı, yasak senaryo — bkz. Deployment) git'ten çıkarıldı.

---

*Son güncelleme: 28.09.2026 (yalnız platform notu + Codex-yansıması; rakamlar 09.09.2026'dan —
güncel sayımlar üreticilerde: `funktionskarte.mjs --check`, `tabellenkarte.mjs`, `npm test`) |
Status: Beta, ilk müşteriler test ediyor 🟡*

> **Codex yansıması:** `AGENTS.md` bu dosyanın Codex için kopyasıdır, `.codex/agents/` ise
> `.claude/agents/`'ın kopyasıdır (`.codex/` gitignore'lu). Kaynak **bu dosya**; kopya
> sürüklenir, iki yerde ayrı düzenleme yapma.
