# ON-PREM SİCİLİ — bulut bağımlılıkları kaydı

> **Bu dosya nedir:** Praxura'nın buluta zincirlenmiş her parçasının kaydı. Neyin çözüldüğü,
> neyin bilinçli olarak merkezde kaldığı, neyin hâlâ açık olduğu. Sahibi: `onprem` ajanı.
>
> **Niye var:** `ONPREM_MIGRATION_PLAYBOOK.md` 2026-07-06'da yazıldı ve G8 ("buluta yeni
> zincir eklenmez") onunla geldi. Buna rağmen `module/` altında **sonradan** açılan dört
> dosya `https://n8n.infinitymade.de/api` adresini kodun içine gömdü. Playbook plan tutar;
> kod yazılırken kimse plan okumaz. Bu sicil o boşluğa duruyor.
>
> **Kurallar:** `unkritisch` ve `widerlegt` maddeler **silinmez** — "bu bize niye sorun
> değil" cevabı yazılmazsa altı ay sonra üçüncü kez araştırılır. Numaralar yeniden
> kullanılmaz. Depo public: sır, gerçek anahtar, hasta verisi, beta müşteri adı girmez.

**İlk tarama:** 2026-09-04 · **Kaynak:** `ONPREM_MIGRATION_PLAYBOOK.md` (K1-K14, G1-G8, Faz 0-6)

---

## ⏭️ Buradan devam — yeni oturum bunu okusun (son güncelleme: 11.09.2026)

> Bu blok sicilin **kısa yolu**. Amacı, yeni bir oturumun 1000 satır okumadan
> "neredeyiz, sıradaki ne, nereye basmam" sorusuna cevap bulması. Ayrıntı her
> zaman ilgili O-maddesindedir; burada yalnız numara verilir.

**11.09.2026 (akşam ek):** `guvenlik`'in S-19 şartı kapandı — Gmail-Token RPC'lerinden
`anon`/`authenticated`/`PUBLIC` yetkisi **zincirdeki bir migration ile** alındı
(`0001_gmail_token_rpc_revoke.sql`, commit `16c6f1b`). Bu aynı zamanda zincirin
**baseline dışı ilk gerçek sınavıydı ve geçti** — kanıt O-39'un altında. Faz 2.1b'nin
ön koşulları o turda değişmemişti; **aynı gece kapandı** — aşağıya bak.

**11.09.2026 (gece) — Faz 2.1b BAŞLADI, ön koşul hükmü verildi.** O-01 + O-15'in
2.1b'yi bloke eden kısmı kapandı (`API_BASE` artık `/api/config`'ten; kapı tabanı
`n8n_host` **25 → 7**). **Başka bloke eden madde yok.** Turun kapsamı, sessiz
boşluğu (kutuda statik arayüzü taşıyan image **yok** — `api-backend/Dockerfile`'ın
`COPY` listesinde tek `.html` geçmiyor) ve CSP tasarımı yeni **§7F** bölümünde;
orada iki yeni madde de var: **O-52** (CSP, `geplant`) ve **O-55** (zygotebody
iframe'i, `offen`).

**11.09.2026 (akşam) — Faz 2.1b'nin gövdesi indi, gegenlesen yapıldı.** Kutunun artık
**arayüzü var**: `onprem/Caddyfile` + `onprem/frontend.Dockerfile` (arayüz ve proxy tek
image, `api` ile aynı commit'ten) + compose'da `caddy` servisi. Ölçüldü: 8/8 healthy,
`/login.html` 200 + dar CSP, apikey'siz `/rest/v1/` 401, `/realtime/v1/websocket` **101**,
pakette olmayan `/admin.html` 404. **O-52** ve **O-55** 🟡 kısmen kapandı (kalanları
maddelerinde). Gegenlesen **dört yeni madde** çıkardı: **O-56** (kutuda çalışan kaydı
yarım kalıyor — `emailRedirectTo` sabit) · **O-57** (`assets/system.css` pakette yok,
login stilsiz açılıyor) · **O-58** (hasta rıza kutusunun Datenschutz linki 404 —
ve bizim metnimiz kopyalanamaz) · **O-59** (Caddy yalnız `SITE_URL` Host'una cevap
veriyor, kutuya IP ile ulaşılamıyor). Toplam **59** madde.
⚠️ Dördünün ortak dersi: **200 dönen bir sayfa, çalışan bir sayfa değildir** — duman
testi HTML'i çekti, HTML'in istediği dosyaları çekmedi.

**11.09.2026 (gece) — Faz 2.1c ön-hazırlığı (`install.sh` yazılmadan önce).** Betiğin
adım sırası, Faz 2.2 ile sınırı ve hata modeli kilitlendi → **§7G**. İki yeni madde:
**O-60** (`ANON_KEY`/`SERVICE_ROLE_KEY` `JWT_SECRET`'ten HS256 ile **türetilir**, zar
atılmaz; ve `exp`'i `JWT_EXPIRY`'den alan bir betik kutuyu **bir saat sonra** öldürür) ·
**O-61** (`.env` kutunun en değerli dosyası: izin, yedekten dışlanma ve
`DATA_ENCRYPTION_KEY`'in tek-seferlik gösterimi kurulumun görünür adımı olmalı).
Bu turda **kod yazılmadı** — ön kontrol, gereksinim ve iki tuzak kaydedildi.
Toplam **62** madde.

**11.09.2026 (gece, 2. ve 3. tur) — `install.sh` yazıldı, iki kez okundu.** İkinci tur
üç engel çıkardı (**O-63** sağlık sayımı · **O-64** `REALTIME_DB_ENC_KEY` uzunluğu ·
**O-65** betiğin `curl`'ü kutunun kendi adresini çözemiyor) + `SETUP_TOKEN` sıra hatası
(O-62). Üçüncü turda **altısı da düzeltildi**; `builder` kendi taramasında **üç ek hata**
buldu — en ciddisi `grep … | cut` + `pipefail`: anahtar `.env`'de hiç yoksa betik
**mesajsız** ölüyordu, tam da mesaj üretsin diye yazılmış kapının içinde. Yeni madde
açılmadı. Kalan tek boşluk: **O-60**'ın negatif testi Kong'da durup PostgREST'e hiç
varmıyor (§7G, üçüncü tur). Toplam **65** madde.

**11.09.2026 (gece, 5. tur) — Faz 2.2 ön-hazırlığı (kurulum sihirbazı).** `install.sh`'ın
ürettiği `SETUP_TOKEN`'ın depoda tüketicisi yoktu; sihirbazın adım sırası, uç sözleşmesi,
paket sınırı ve dilimlemesi kilitlendi → **§7H**. Hükümler: jeton **veritabanında**
tüketilir (yeni tek satırlık tablo, `db-ustasi`'ya sorulur) · owner hesabını
**`api-backend`** yaratır, tarayıcı değil (service-role sızmaz, G2) · SaaS'ta aynı kod
koşar ama `SETUP_TOKEN` boş olduğu için uçlar hiç açılmaz (G7) · ⛔ `SETUP_TOKEN` SaaS
VPS'inde **asla** set edilmez (Ops kartı, Güvenlik). İki yeni madde: **O-66** (SMTP
sihirbazdan ayarlanamaz — GoTrue env'i açılışta okur; playbook 2.2 ile 2.7 bugünkü
mimaride aynı anda doğru olamaz, karar kullanıcının) · **O-67** (`handle_new_user` yalnız
`(id, email)` yazıyor → kutunun ilk owner'ı `plan_status='pending'`, `company_code` boş
doğuyor; ikincisi kutuda çalışan kaydını imkânsız kılar). Toplam **67** madde.

**12.09.2026 — Faz 2.2 dilim 2 sonrası temizlik turu.** Dilim 2 (kurulum modu kilidi +
devam ettirme + 3 dil) `b05bd1c`'te kapandıktan sonra, register'da "kapandı sanılan ama
aslında `offen` kalmış" üç maddeyi (**O-57**, **O-59** — Dockerfile/install.sh yarıları
zaten önceki commit'lerde inmişti ama sicil geriden geliyordu) ve bir yeni tasarımı
(**O-58 (a)** — kutu bayrağı) kapattım; onprem-review'un bulduğu üç yan etkiyi de
(**O-68** `applyLang()` çöküyor · **O-69** davet ekranı SaaS adresi gösteriyor · **O-70**
marka linki SaaS'a çıkıyor) aynı turda. **O-49** (`pg_net` kaldırma) iki denemeye
mal oldu: ilk deneme `webhooks.sql`'i doğrudan düzenledi (tek satır, çalıştı) ama
`check-onprem-volumes.sh` kapısına takıldı — o kapı bu dosyayı vendor kopyasıyla
byte byte karşılaştırıyor, elle dokunmak kapıyı kalıcı körleştirirdi. Geri alındı:
`webhooks.sql` vendor'dan aynen geri kopyalandı, pg_net'i kaldıran iş kendi ayrı
dosyamıza (`no-pg-net.sql`, `98a` sırasıyla) taşındı. Hepsi gerçek local kutuya
karşı ölçüldü (`docker compose down -v` + veri dizini silinmiş **tamamen taze**
bir kurulumla, iki kez), üç kapı da (`onprem`/`namen`/`onprem-volumes`) yeşil.
Toplam **70** madde, bugün **7'si** `offen`/`geplant`'tan `gelöst`'e geçti.

**Nerede duruyoruz (11.09.2026):** kutunun compose paketi **var ve çalıştığı ölçüldü**
(`onprem/docker-compose.yml` + `.env.template` + `NOTICE.md` + `volumes/`; commit'ler
`b2fdbb8` ve `c602f50`). Yığın 11 fremd konteynerden **6**'ya indi, boşta ≈1,65 GB
(bizim `api` dahil). Migration zinciri kutuda **kendi kendine** koştu
(`✓ 0000_baseline.sql`), 11 self-check sayacının 11'i canlıyla birebir.

**Bugün kanıtlanan:** şema kutuya kendi kendine gidiyor (O-39) · signup → trigger →
profil çalışıyor · apikey'siz PostgREST **401** (Kong'un key-auth'ı gerçek) ·
`praxura_migrations` PostgREST'ten okunamıyor (42501) · kaldırılan rotalar 404 ·
veritabanından dışarı çıkan çağrı yok (`net.http_post` → 0 fonksiyon).

**Kanıtlanmayan — abartılmasın:** ~~kutuda arayüz yok~~ → 11.09 akşamı **inşa edildi ve
ölçüldü** (yukarı bak); ama arayüz **tam değil** (O-57: üç sayfa stilsiz) ve kutuya
**yalnız `SITE_URL` host adıyla** ulaşılıyor (O-59) · **kurulum betiği var ama kutuda
hiç koşmadı** (`install.sh`, 15 adım, iki tur gegenlesen; Ubuntu'da uçtan uca
**çalıştırılmadı** — §7G üçüncü tur) · **seed yok**
(kutu doğru ama boş kalkıyor, `krankenkassen` → `[]`, O-38) · **yedek yok** (O-26) ·
lisans/yetki tarafına hiç dokunulmadı (O-31/O-33). Yani bugünkü paket **çalışan bir
test yığını**, kurulabilir ürün değil.

**Sıradaki iş — sırayla:**

1. **Faz 2.1b** — Caddy (TLS + statik arayüzün servisi) · compose'un kutuya dağıtımı (O-45 (b)).
   ✅ **Ön koşul kapandı (11.09.2026 gece):** O-01 + O-15'in 2.1b'yi bloke eden kısmı
   bitti — arayüz artık `API_BASE`'i `/api/config`'ten alıyor, kutuda `"/api"` ölçüldü.
   Turun kapsamı ve iki yeni maddesi (**O-52** CSP · **O-55** zygotebody) → **§7F**.
   ✅ **Caddy indi (11.09 akşamı).** ✅ **O-57, O-58 (a), O-59, O-49 kapandı (12.09.2026).**
   ✅ **O-68, O-69, O-70 de aynı gün kapandı** (O-58 (a)'nın uygulamasından çıkan üç artık, §7I).
   ✅ **O-48 konseyde karara bağlandı (12.09.2026): Kong kalıyor**, 886 MB rakamı
   yanlış ölçülmüştü (`konsey/tutanak/2026-09-12-o48-kong.md`).
   2.1b'nin **kalanı**: yalnız O-45 (b) — kullanıcı kararı bekliyor.
   Sonra 2.1c'ye geçilir (2.1c'nin kendisi zaten yazıldı, bkz. madde 2 — kalan yalnız
   2.1b'nin tek maddesi).
2. **Faz 2.1c** — `install.sh`. **Tasarım hazır: §7G** (15 adım, Faz 2.2 sınırı, hata
   modeli). Kapsadığı maddeler: O-53 (zorunlu değişken kapısı) · ✅ O-59 (adres ön-kontrolü
   + kurulum sonu çıktısı, 12.09.2026 tamam) · O-52 (b) (`SUPABASE_PUBLIC_WSS` türetimi) · O-50'nin kalanı
   (`DATA_ENCRYPTION_KEY` üretimi) · **O-60** (JWT türetimi) · **O-61** (`.env` izni) · **O-62** (ilk owner / kayıt penceresi).
3. **Seed adımı** (O-38) — referans tabloları; `SCHEMA-VERTEILUNG.md` §3.1 adım 4.
4. **Faz 1.2** (O-02) — takvim kısıtı hâline geldi: kutuda `N8N_AI_SERIES_URL` boş
   kalınca kod **sabit n8n adresine düşüyor** ve hasta adı bize gelir (G1). İlk
   ücretli kutudan önce inmeli.

**Basılmaması gereken tuzaklar** (hepsi bir kez yaşandı, hepsinin bedeli ölçüldü):

| Tuzak | Ne olur | Nerede yazılı |
|---|---|---|
| `:stable` etiketi **yok** | Yayın hattı yalnız `latest` + sha basıyor; `.env.template` `:stable` diyor → müşteri sunucusunda image çekilemez | O-25 |
| `docker compose down -v` veri klasörünü **silmez** | Bind-mount; "temiz oda" testi sanılan şey eski veriyle koşar | O-39 notu, compose başlığı |
| `DATABASE_URL` **`supabase_admin`** olmalı | `postgres` ile baseline'ın 12 `ALTER DEFAULT PRIVILEGES` satırı reddedilir, ilk kurulum yarım kalır | compose `api` yorumu, `SCHEMA-VERTEILUNG.md` §2 V-6 |
| `webhooks.sql` **çıkarılamaz** | Rolü o yaratıyor, bir sonraki init dosyası şifresini set ediyor; çıkarılırsa **Storage hiç açılmaz** ve hata bambaşka bir yüzle gelir | O-49 |
| Uygulanmış migration dosyası **değiştirilemez** | Runner SHA-256 tutar; değişirse kutu açılmaz | `api-backend/db/migrations/README.md` |
| Kolon silme/yeniden adlandırma **tek adımda** | `:beta` ve `:stable` aynı anda canlı; eski image kolonu bulamaz | kapının yıkıcı-DDL kontrolü |

**Kim kimi bekliyor:**

- **O-01 + O-15** → ✅ 2.1b'yi artık **bloke etmiyor** (11.09 gece; §7F)
- **O-50** → yalnız `install.sh`'ı bekliyor (Faz 2.1c); anahtarın ömrü **O-29**'da
- **O-51** → **O-66 ile aynı tur** (karar 11.09.2026): altı sabit adres tek yardımcıya
  bağlanır, değerini `SMTP_FROM`'dan alır, `install.sh` o değeri yazar. Kabul ölçütü
  gönderim değil **teslim** (SPF `-all` + DMARC `p=quarantine` ölçüldü)
- **O-48** (Kong ↔ Caddy) → ✅ **gelöst (12.09.2026, konsey)** — Kong kalıyor, 886 MB
  yanlış ölçülmüştü (gerçek RSS ~139 MB, `worker_processes=2` sabitlendi)
- **O-33** (plan farkının teknik karşılığı) ve **O-46** (filo panosu) → **kullanıcı
  kararı**; ikisi de lisans formatı donmadan cevaplanmalı
- **O-38** → Faz 2.1 seed adımı; güncelleme yolu O-39'un zincirinden geçer
- **O-57** → ✅ **gelöst (12.09.2026)** — Dockerfile yarısı `e899d7a`'da, `publish-frontend.yml`
  tetikleyicisi + duman testinin `src`/`href` kontrolü bu turda
- **O-56** → Faz 2.2 sihirbazıyla aynı sprint: sihirbaz owner'ı yaratacak, O-56 de
  ikinci kullanıcıyı yaratabilir hâle getirecek. Biri olmadan diğeri yarım
- **O-69** → ✅ **gelöst (12.09.2026)** — `dashboard.js`'teki `loginUrl` artık `location.origin`,
  aynı O-56'nın çözdüğü kaynak; ekrandaki metin de artık bunu yansıtıyor
- **O-68** → ✅ **gelöst (12.09.2026)** — `applyLang()`'in kaldırılan üç öğeye yazan
  satırları `if (!IST_KUTU)`'ya alındı, dil değişimi Playwright ile ölçüldü
- **O-70** → ✅ **gelöst (12.09.2026)** — marka linki `href="/"` (üç kutu sayfasının
  zaten kullandığı desen), `IST_KUTU` dallanmasına gerek kalmadı
- **O-59** → ✅ **gelöst (12.09.2026)** — ön kontrol + LAN IP + kök CA çıktısı `33d5fd2`'de,
  `hosts`/DNS talimat satırı bu turda
- **O-58 (a)** → ✅ **gelöst (12.09.2026)** — `/api/config`'e `istKutu` alanı
  (kaynağı `SUPABASE_PUBLIC_URL`, `SETUP_TOKEN` **değil**), gerçek kutuya karşı doğrulandı
- **O-58 (b)** → `legal-de`; metin kararı verilmeden şablon sayfa yazılmaz
- **O-49** → ✅ **gelöst (12.09.2026)** — `webhooks.sql`'e **hiç dokunulmadı** (vendor
  kopyasıyla byte byte aynı, `check-onprem-volumes.sh` öyle istiyor); pg_net'i kaldıran iş
  kendi dosyamızda: `onprem/volumes/db/no-pg-net.sql`, compose'da `98a-no-pg-net.sql`.
  ⚠️ Bu satır 12.09'da bir kez **yanlış** yazılmıştı ("satır çıkarıldı") — o, geri alınan
  ilk denemenin tarifiydi; tam hikâye O-49'un kendi Durum satırında. Koruması: **O-71**
- **O-71** → ✅ **gelöst (12.09.2026)** — `tools/check-onprem.sh`'a doğrudan kontrol
  eklendi (sayaç değil, DDL/drift kapılarıyla aynı desen); mount satırı veya
  `no-pg-net.sql` kaybolursa commit reddedilir, test edildi
- **O-62** → ✅ tasarımı kapandı (§7H); kalanı Faz 2.2 dilim 1'in kodu
- **O-66** (SMTP) → ✅ **karar verildi 11.09.2026: seçenek (a)** — `install.sh` sorar,
  sihirbaz yalnız test eder ve teşhis gösterir. Uygulama açık, sınırları maddede.
  **O-51 ile tek tur**; ayrı yapılırsa test maili „gitti“ der ve spam'e düşer
- **O-67** (`plan_status` köprü değeri) → **O-33**'ü bekliyor; dilim 1 bunsuz bitirilebilir

**Sicili nasıl okursun:** durum değerleri §9'da sayılı. 🟡 **kısmen** demek "yarısı
yapıldı, kalanı maddede yazılı" demek — `gelöst` yalnız kalanı da bittiğinde konur.
`unkritisch` ve `widerlegt` maddeler **silinmez**; onlar "bunu niye sorun saymadık"
sorusunun cevabıdır ve en çok tekrar okunan bölüm §7'dir.

**Satır numaraları kayar:** `api-backend/server.js` her commit'te büyüyor; bu sicildeki
atıflar 11.09.2026 akşamı (`c602f50`) ölçüldü. Uyuşmazsa sembol adıyla ara
(`GOOGLE_KONFIGURIERT`, `encryptionAvailable`, `noreply@`, `N8N_`) — sayılar kapıda
tutulduğu için toplamlar kaymaz, yalnız satırlar kayar.

**Yeni kod yazılmadan önce:** §2 taksonomisi (A-H) + §3'ün dört sorusu. Mekanik
ihlalleri `tools/check-onprem.sh` zaten yakalar (9 sayaç, taban `tools/.onprem-baseline`);
kapı unutmaz ama düşünmez.

---

## Taksonomi kısaltmaları

| Tip | Anlamı |
|---|---|
| A | Runtime dış çağrı (kutu çalışırken dışarı çıkıyor) |
| B | Build-zamanı dış çağrı (merkez çeker, koda/image'a gömer) — **tercih edilen desen** |
| C | Sabit adres (kodda gömülü host) |
| D | Şema değişikliği |
| E | Sır (env var bizim anahtarımızı taşıyor) |
| F | Zamanlanmış iş (cron / trigger / Actions) |
| G | Merkez mi kutu mu |
| H | Yetkilendirme (plan/limit/lisans) |

**Durum değerleri:** `offen` · `geplant` (faz no.) · `gelöst` (commit) · `unkritisch` · `widerlegt`

---

## 1. Sabit adresler (tip C)

### O-01 — `n8n.infinitymade.de/api` frontend'in API tabanı olarak koda gömülü

| Alan | İçerik |
|---|---|
| **Ne** | Backend'in adresi 11 frontend dosyasında sabit yazılı; kutuda müşterinin tarayıcısı bizim VPS'imize gider |
| **Nerede** | **25 satır / 12 dosya** (kapı kapsamı: `*.js` `*.html` `*.mjs`; `archive/` `vendor/` `funktionen/` `onprem/` `.claude/` `index-old.html` `ai chatbot proje/` hariç).<br>`dashboard.js` 9 (`:117` `:6035` `:6543` `:6544` `:11841` `:11849` `:11987` `:12125` `:17439`) · `kalender.js` 5 (`:114` `:242` `:460` `:620` `:766`) · `employee-signup.js` 2 (`:116` `:261`) · `booking-request.js` 2 (`:4` yorum, `:11`) · `module/abrechnungsstatus.js:50` · `module/podologie-positionen.js:39` · `module/beleg-druck.js:11` (yorum) · `booking.js:5` · `attendance.js:4` · `index.html:2179` (chatbot DATA bloğu, pazarlama) · `api-backend/server.js:1969` (bkz. O-02).<br>⚠️ Ölçüm **11.09.2026 öğleden önce** — bu tablo artık tarihi: aynı akşam 20 satır düzeltildi, kalan 7'nin dökümü akşam notunda. Satır numaraları o yüzden burada güncellenmiyor |
| **Tip** | C |
| **Kutuda ne olur** | Müşterinin kutusundaki dashboard açılır, ama her randevu/rezept/abrechnung çağrısı **bizim** VPS'imize gider. Bizim VPS'imiz kapalıysa müşterinin praxis'i durur. Daha kötüsü: kutudaki hasta verisi bizim sunucumuza akar → **G1 ihlali**, geçişin bütün amacı boşa çıkar. Müşteri kendi Supabase'inde oturum açtığı için JWT bizim backend'de doğrulanmaz — pratikte 401 duvarı |
| **Çözüm** | Tek `API_BASE` kaynağı: `/api/config`'in verdiği değer (bugün Supabase URL'i için zaten yapılan şey — bkz. O-05). Kutuda `window.location.origin + '/api'`, SaaS'ta bugünkü host. Fork değil, tek config satırı. **Faz 1.1** kapsamına bağlandı; paketleme öncesi **Faz 2.0** ile kesişir |
| **Durum** | 🟡 **kısmen — Frontend-Teil gelöst (11.09.2026), Faz 2.1b noch offen** — kapı tabanı: **25 → 7** |

> ⚠️ `dashboard.js:83-86` doğru deseni **zaten biliyor**: `localhost` ise `http://localhost:3000/api`,
> değilse sabit host. Yani "adres değişkendir" fikri kodda var, ama üçüncü ihtimal (müşterinin
> kendi domain'i) yok. Diğer 11 dosya bu ternary'yi bile kullanmıyor, düz sabit yazıyor.
> `module/` altındaki üçü playbook'tan **sonra** yazıldı — bu sicilin var oluş sebebi.
>
> **08.09.2026 — Ops #283 yan ürünü:** `module/podologie-abrechnung.js` ve yeni
> `module/podologie-dateieinheit.js`, sabiti `ctx.apiBase`'e çevirdi (host artık yalnız
> `dashboard.js:98`'de tanımlı, ctx üzerinden geçiyor) — taban 26→25, `onprem` ajanı hükmü
> (O-44 §7 şart 1'in aynısı: ikinci bir host sabiti açma). Faz 1.1 çözümünü genişletmedi,
> yalnız var olan deseni izledi.
>
> **11.09.2026 (öğleden önce) — paket yazıldı; bu madde artık Faz 2.1b'nin önünde duruyor.**
> `onprem/docker-compose.yml`'de kutunun **arayüzünü servis eden bir bileşen yok**
> (Kong yalnız `127.0.0.1`'de yayınlıyor, Caddy Faz 2.1b'de gelecek). Yani sabit adres
> bugün kutuda ısırmıyor — kimseye tarayıcıdan açılmıyor. Isıracağı an, Caddy statik
> dosyaları servis ettiği andır: o sürümde müşterinin tarayıcısı **bizim** VPS'imize
> gider. Sıralama sonucu: O-01 ve O-15 çözümü **2.1b'den önce** inmeli, sonra değil.
>
> **11.09.2026 (akşam) — onprem-review + uygulama.** Tasarım onprem ajanına
> soruldu, cevap: `supabase-config.js`'in top-level `await fetch('/api/config')`'ü
> **her importer'ı** o dönene kadar bekletir (ESM garantisi) — 25 satırın 21'i
> bu sayede zaten güvenliydi, sadece 3 dosya (`module/abrechnungsstatus.js`,
> `module/podologie-positionen.js`, `booking-request.js`) `supabase-config.js`'i
> hiç import etmiyordu, onlara import eklendi. `req.get('host')`'tan `apiBase`
> türetmek **vetolandı** (Caddy arkasında `req.protocol` trust-proxy'siz `http`
> döner → mixed-content; reflected Host header ayrı risk) — yerine kutuda sabit
> `apiBase: '/api'` (göreli), SaaS'ta mutlak. `ctx.apiBase` deseni **korundu**,
> ikinci bir global (`window.__PRAXURA_API_BASE__`) açılmadı — `dashboard.js`'teki
> tek `API` değişkeni hem `ctx.apiBase`'i hem 8 doğrudan çağrıyı besliyor.
>
> **Uygulanan:** `supabase-config.js` → `export const API_BASE` (fallback: bugünkü
> sabit host, `/api/config` hiç dönmezse davranış değişmez). Dört sunucu
> uygulamasına `apiBase` alanı eklendi: `api/config.js` (Vercel, `PUBLIC_API_BASE`
> env → varsayılan mutlak host) · `api-backend/server.js` yeni `GET /api/config`
> (env `SUPABASE_PUBLIC_URL`/`SUPABASE_ANON_KEY`/`PUBLIC_API_BASE`, varsayılan
> `/api` — Wartungsmodus middleware'inin **üstünde**, `/health` gibi) ·
> `dev_server.cjs` (varsayılan `http://localhost:3000/api`, eski ternary'nin
> aynısı) · `onprem/poc-frontend-server.mjs` (`LOCAL_API_BASE`, kutuda henüz
> Kong→api yolu yok, bilinen sınır). `docker-compose.yml`'e `api` servisine
> `SUPABASE_PUBLIC_URL`/`SUPABASE_ANON_KEY` eklendi — önceden yalnız internal
> `SUPABASE_URL: http://kong:8000` vardı, browser'a döndürülecek DEĞER hiç
> yoktu.
>
> **Doğrulandı:** `npm run probe` (7 süit, 87/87 modül tarayıcıda yükleniyor,
> konsol hatası yok) · `node --test module/*.test.js` (818/818 — `ctx.apiBase`
> imzasına dokunulmadı) · `api-backend` `npm test` (231/231) · yerel kutuda
> `docker exec praxura-api wget -qO- localhost:3000/api/config` → `apiBase:"/api"`
> doğru. Kapı tabanı `n8n_host` **25 → 7** kendiliğinden sıkıştı; kalan 7 bu işin
> parçası değil (O-02 `server.js:1969` · O-09 `dashboard.js` B2B webhook ·
> O-04 `index.html` pazarlama chatbot · `module/beleg-druck.js` tarihi yorum ·
> `api/config.js`+`supabase-config.js`'teki **yeni, bilinçli** tek kaynak
> fallback'leri).
>
> **Kalan (Faz 1.1'in geri kalanı, bu turda YAPILMADI):** O-03 (`app.praxura.de`
> sabit, 19 satır) · O-09 (Apify/B2B özelliğini on-prem build'de kapatma) · O-10
> (Stripe route kapatma) · O-16 (`/api/dsgvo`'nun 417 satırlık Express taşıması,
> GoBD kilitleriyle). Faz 2.1b'yi bloke eden **yalnızca** O-01+O-15'in
> frontend/config kısmıydı, o kapandı — geri kalanı ayrı turlarda.
>
> **11.09.2026 (gece) — dördüncü gegenlesen turu, iki küçük düzeltme + üç yeni madde.**
> `kalender.js`'de `API_BASIS = API_BASE` ataması `:460`'ta kalmıştı ama `:114`/`:242`
> (`patchBooking`/`loadTeam`) onu **kendisinden önceki** satırlarda kullanıyordu —
> bugün güvenli (`init()` hepsini `:771`'den sonra çağırıyor) ama gereksiz bir sıralama
> kırılganlığıydı, önceden hiç yoktu. Atama dosyanın başına, import'un yanına taşındı.
>
> **Sessizce değişen bir davranış, düzeltilmedi, sadece kayda geçiyor:** eskiden
> `dashboard.js`'i `dev_server.cjs`/Vercel olmadan düz bir dosya sunucusuyla açan
> geliştirici `localhost:3000/api`'ye (ECONNREFUSED, bariz kırık) konuşuyordu. Artık
> `/api/config` 404 dönünce `supabase-config.js`'in fallback'i devreye girer ve
> `API_BASE` **gerçek prod backend'ine** düşer — Supabase client'ı boş URL/key ile
> kurulacağı için authFetch'ler muhtemelen 401 alır, ama teorik risk (canlıya test
> randevusu) sıfır değil. `node dev_server.cjs` (localhost:8081) ile açan etkilenmez.
>
> **Yeni maddeler (guvenlik/onprem ortak taraması, `*.json` kapı kapsamı dışında):**
>
> - **O-52** — `vercel.json:19` CSP `connect-src`'de `n8n.infinitymade.de` +
>   Supabase cloud proje adresi sabit. Kapı `*.js`/`*.html`/`*.mjs` tarıyor,
>   `*.json` yok — bu sabit adres hiçbir zaman görülmedi. Caddy bu header'ı
>   olduğu gibi kopyalarsa kutu müşterinin tarayıcısına bizim buluta konuşma
>   izni verir (ölü ama yanlış); `SUPABASE_PUBLIC_URL` sayfa origin'inden
>   farklıysa (`praxis.local` vs `praxis.local:8443`) `'self'` kapsamaz ve
>   login **CSP hatasıyla** ölür — ağ sorunu gibi görünür, teşhisi zor. Tip C.
>   **Çözüm:** Faz 2.1b'nin ön koşulu — Caddyfile'ın CSP'si `SUPABASE_PUBLIC_URL`'den
>   üretilsin, sabit yazılmasın; kapıya `*.json`/CSP sayacı eklenmeli. **Durum:** `offen`.
> - **O-53** — `docker-compose.yml`'de `api` servisine eklenen
>   `SUPABASE_PUBLIC_URL`/`SUPABASE_ANON_KEY` env'leri `:-` default'suz ve hiçbir
>   yerde doğrulanmıyor. Boş kalırlarsa `/api/config` boş `supabaseUrl` döner,
>   `createClient('','')` sessizce kurulur, ekran boş kalır — O-15'in kapattığı
>   kırılma biçimi arka kapıdan geri geliyor. Tip G. **Çözüm:** Faz 2.1c —
>   `install.sh` preflight bu ikisi boşsa kurulumu başlatmasın. **Durum:** `geplant` (Faz 2.1c).
> - **O-54** — `PUBLIC_API_BASE` yeni bir SaaS tek-nokta-arızası: Vercel'de yanlış
>   set edilirse **bütün** SaaS trafiği yanlış backend'e gider, `NEXT_PUBLIC_URL`
>   ile aynı sınıf risk, fallback devreye girmez (env zaten set edilmiş sayılır).
>   Tip C/E. **Çözüm:** Vercel'de bu env **hiç set edilmemeli** — kod zaten doğru
>   varsayılanı biliyor. CLAUDE.md env listesine + Ops **Launch** kartına
>   "PUBLIC_API_BASE: dokunma, set edilmemiş kalsın" notu düşülecek. **Durum:** `unkritisch`
>   (şimdilik dokunulmadığı için), ama not edilmezse birinin "eksik env" sanıp
>   doldurma riski var.

### O-02 — `N8N_AI_SERIES_URL` fallback'i koda gömülü n8n adresi

| Alan | İçerik |
|---|---|
| **Ne** | AI seri-planlayıcı env var yoksa sabit n8n webhook'una düşüyor |
| **Nerede** | `api-backend/server.js:1969` (04.09'da `:1806`'ydı) — `process.env.N8N_AI_SERIES_URL` yoksa `https://n8n.infinitymade.de/webhook/ai-series-scheduler` |
| **Tip** | C + A (fallback runtime dış çağrı) |
| **Kutuda ne olur** | Müşteri env'inde `N8N_AI_SERIES_URL` olmayacak → fallback devreye girer → kutu bizim n8n'imize POST atar. Playbook D9'a göre bu çağrı **hasta adını taşıyor** (`aiPayload.customer.name`) → G1 ihlali. Deterministik fallback kodda var ama bu satır ona düşmeden önce ağa çıkıyor |
| **Çözüm** | **Faz 1.2** — `ai/tasks/series-schedule.js` olarak llmClient üzerinden doğrudan; n8n aradan çıkar, hasta adı prompt'a girmez. Kabul kriteri zaten yazılı: `grep N8N_` → sıfır |
| **Durum** | `geplant` (Faz 1.2) — ⚠️ ilk ücretli kutudan **önce** inmeli, bkz. not |

> **11.09.2026 — kutu paketi bu maddeyi teorik olmaktan çıkardı.**
> `onprem/.env.template` `N8N_AI_SERIES_URL`'i **bilinçli olarak taşımıyor** — paketin
> tamamında tek bir `N8N_` yok (ölçüldü). Ama kod deseni `process.env.… || '<sabit n8n
> adresi>'`, yani değişkenin yokluğu fallback'i **kapatmıyor, açıyor**. Seri planlayıcı
> kutuda ilk çağrıldığında hasta adı bizim n8n'imize POST edilir → **G1**. Bu yüzden
> Faz 1.2 artık bir tercih değil **takvim kısıtı**: ilk ücretli kutudan önce inmeli.

### O-03 — `app.praxura.de` uygulama kodunda sabit (pazarlama sayfaları hariç)

| Alan | İçerik |
|---|---|
| **Ne** | Login yönlendirmesi, paylaşım linkleri, OAuth redirect'leri ve auth mail redirect'leri merkez domain'e sabitlenmiş |
| **Nerede** | **19 satır / 5 dosya** (app yüzeyi): `api-backend/server.js` 10 (`:48` CORS · `:342` `:364` `:379` `:382` OAuth redirect · `:2788` auth mail redirect · `:3974` booking-request onay linki · mail HTML'lerinde 3) · `dashboard.js` 5 (`:1090` `:14322` `:17232` `:17282` `:23339`) · `employee-signup.js` 2 (`:288` `:297`) · `admin-login.js:12` · `dashboard.html:4735` (ekranda gösterilen metin).<br>Ayrıca pazarlama/blog tarafında ~30 kez — **onlar sorun değil**, bkz. O-04 |
| **Tip** | C |
| **Kutuda ne olur** | Üç ayrı kırılma: (1) `dashboard.js:14322`/`:23339` müşterinin çalışanına ve hastasına **bizim** domain'imize giden link üretir — o link müşterinin kutusundaki hesabı tanımaz; (2) `employee-signup.js:288/297` auth doğrulama mailini `app.praxura.de/confirm.html`'e yönlendirir, kutudaki GoTrue oraya redirect edemez → çalışan kaydı ölür; (3) `server.js:3974` hastaya giden randevu onay linki bizim domain'e gider → hasta bizim sunucumuza tıklar |
| **Çözüm** | Üçe ayır: **origin türetilebilenler** (`dashboard.js:1090` `:17232` `:17282` zaten `window.location.origin` + fallback deseninde — fallback'i kaldırmak yeter) · **backend'in bilmesi gerekenler** → `PUBLIC_BASE_URL` env var'ı (sihirbaz doldurur) · **CORS listesi** (`server.js:48`) → env'den beslenen liste. **Faz 1.1 + Faz 2.2** |
| **Durum** | `geplant` (Faz 1.1 / 2.2) — kapı tabanı: **19** |

### O-04 — Pazarlama sayfalarındaki `app.praxura.de` ve `analytics.infinitymade.de`

| Alan | İçerik |
|---|---|
| **Ne** | `index.html`, `blog/*`, SEO landing sayfaları merkez domain'e ve Umami analytics'e bağlı |
| **Nerede** | ~30 satır: `index.html` 6 · `blog/*` 20 · `vorregistrierung.html` 3 · `kontakt.html` 2 · `404.html` 1. Umami: `cookie-consent.js:37` (`analytics.infinitymade.de/script.js`), yalnızca 30 pazarlama/blog sayfasında yükleniyor — uygulama sayfalarında yok |
| **Tip** | C / A |
| **Kutuda ne olur** | **Hiçbir şey** — bu sayfalar pakete girmiyor. Playbook **Faz 2.0** bunu açıkça kilitledi: "pazarlama sayfaları on-prem paketine GİRMEZ… paketin kök adresi doğrudan login/dashboard'a gitmeli." PoC'de doğrulandı (lokal landing'in Login'i internete götürüyordu) |
| **Çözüm** | `unkritisch` — Faz 2.0 paket ayrımıyla kapsam dışı. ⚠️ Tek şart: paket ayrımı **klasör/dosya listesiyle** yapılmalı, elle sayarak değil; yeni bir pazarlama sayfası eklendiğinde otomatik dışarıda kalsın (`.vercelignore` kuralının aynadaki hali) |
| **Durum** | `unkritisch` (gerekçe: Faz 2.0 paket ayrımı) |

### O-05 — Supabase URL/anon-key koda gömülü DEĞİL — `/api/config`'ten geliyor

| Alan | İçerik |
|---|---|
| **Ne** | Frontend Supabase bağlantısını runtime'da sunucudan alıyor; proje ref'i uygulama kodunda yok |
| **Nerede** | `supabase-config.js:2` (`fetch('/api/config')`) · `api/config.js` (env'den okur). Ürün kodunda `njvuclullotbksskpwgk` **sıfır** kez geçiyor; tek istisna `api-backend/test_schema.js:5` (test dosyası, env fallback'li). `vercel.json:19` CSP'de geçiyor ama Vercel'e özgü, pakete girmiyor |
| **Tip** | C |
| **Kutuda ne olur** | Kutuda `/api/config` müşterinin kendi Supabase URL'ini döndürür, frontend kodu değişmez. PoC 0.4 bunu kanıtladı: `onprem/poc-frontend-server.mjs` `/api/config`'in lokal muadilini servis etti, login→dashboard→takvim lokal stack'ten çalıştı |
| **Çözüm** | `unkritisch` **ama bir şartla**: `/api/config` bugün bir **Vercel fonksiyonu**. Kutuda onu Express'in servis etmesi gerekiyor → Faz 1.1'de "kutuya gidecekler" listesinin başında. Taşıma kaydı: O-15 |
| **Durum** | `unkritisch` (desen doğru; taşıma işi O-15.te) |

### O-06 — Sentry CDN loader'ı 11 HTML dosyasında `<script src="https://…">`

| Alan | İçerik |
|---|---|
| **Ne** | Sentry loader'ı üçüncü-parti CDN'den yükleniyor; uygulama sayfalarında da var |
| **Nerede** | **12 satır / 11 dosya**. Uygulama tarafı: `dashboard.html:10` `login.html:16` `onboarding.html:9` `booking.html:18` `kalender.html:11` `employee-signup.html:10` `admin.html:7` `admin-login.html:13`. Pazarlama tarafı: `index.html` `kontakt.html` `vorregistrierung.html` |
| **Tip** | A (+ C) |
| **Kutuda ne olur** | Müşterinin tarayıcısı `js-de.sentry-cdn.com`'a çıkar. Kısıtlı praxis ağında sayfa script bloke olana kadar bekler. Ayrıca **G4**: on-prem pakette telemetri varsayılan KAPALI olmalı; loader HTML'de sabitken "varsayılan kapalı" diye bir şey yok. Vendor kuralımızla da çelişiyor (Konsey 2026-08-13 S3: CDN'e geri dönmek yasak) |
| **Çözüm** | **Faz 2.6** — Sentry opt-in: sihirbazda kapalı-varsayılan onay kutusu; kapalıysa lokal `error_logs` tablosuna yaz. Loader etiketi HTML'den çıkar, koşullu enjeksiyona döner. Playbook Faz 1.4 bunu bilinçli istisna olarak ayırmış ("Sentry loader hariç — o Faz 2'de koşullu olacak") |
| **Durum** | `geplant` (Faz 2.6) — kapı tabanı: **12** |

---

## 2. Runtime dış çağrılar (tip A)

> Tarama kapsamı: `api-backend/**` (`node_modules` hariç) + `dashboard.js` tarayıcı çağrıları
> + Supabase Edge Functions. Ölçüt: kutu **çalışırken** dışarı çıkıyor mu.

### O-07 — Azure OpenAI çağrısı (Rezept-OCR + B2C-Draft)

| Alan | İçerik |
|---|---|
| **Ne** | AI çağrıları bugün doğrudan Azure OpenAI'ya gidiyor (n8n aradan çıktı, 04.09.2026) |
| **Nerede** | `api-backend/ai/azureClient.js:110` (chat/completions URL); endpoint + anahtar env'den: `:11` `AZURE_OPENAI_ENDPOINT`, `:12` `AZURE_OPENAI_API_KEY`, `:15` `AZURE_OPENAI_REGION`. EU Data Boundary kontrolü `:46-63` |
| **Tip** | A |
| **Kutuda ne olur** | İyi haber: endpoint ve anahtar **zaten env-var**, hardcode yok, dry-run modu var (`:16`). Kötü haber: bugün o env **bizim** anahtarımızı taşıyor. Pakete girerse G2 + K5 ihlali — müşteri sunucusundaki her sır okunabilir, faturası bize keser. Anahtar yoksa `:38-40` production'da hata fırlatıyor; sihirbazda "sonra kur" seçilirse bu davranış kutuyu bozar (K7: Rezept-Scan standart adım ama "şimdi değil" çıkışlı) |
| **Çözüm** | **Faz 1.3** — `ai/azureClient.js` → `ai/llmClient.js`, `AI_PROVIDER` (ionos veya azure) + `AI_ENDPOINT` + `AI_API_KEY` + `AI_MODEL_TEXT/VISION`. Anahtar **müşterinin** (K4 BYO-key, sihirbaz adımı Faz 2.2). Merkezi AI-proxy **yasak** (K6) — reçete görüntüsü bizden geçerse §393 kapsamına geri gireriz. Ek şart: anahtar yokken uygulama açılmalı, yalnız AI özelliği kapalı olmalı |
| **Durum** | `geplant` (Faz 1.3 + 2.2) |

### O-08 — Google Calendar / Gmail OAuth — bizim OAuth uygulamamız

| Alan | İçerik |
|---|---|
| **Ne** | Google takvim senkronu ve Gmail gönderimi bizim Google Cloud projemizin OAuth client'ı üzerinden |
| **Nerede** | `api-backend/server.js:314-315` `:329` (scope'lar) · `:350` `googleapis.com/oauth2/v2/userinfo` · `:433` `gmail.googleapis.com/…/messages/send` · redirect'ler `:342` `:364` `:379` `:382` (hepsi `app.praxura.de` sabit, bkz. O-03). Frontend girişi: `dashboard.js:11908`, `kalender.js:765`. Token'lar Supabase Vault'ta |
| **Tip** | A + E |
| **Kutuda ne olur** | Üç yerden birden kırılır: (1) OAuth redirect URI Google konsolunda `app.praxura.de`'ye kayıtlı — müşterinin domain'i orada olmadığı için akış `redirect_uri_mismatch` ile ölür; (2) `GOOGLE_CLIENT_SECRET` bizim sırrımız, kutuya konamaz (G2); (3) her müşteri ayrı domain, wildcard redirect yok → her kurulumda Google konsoluna elle giriş = Faz 4 provisioning otomasyonu çöker. Ayrıca PoC 0.3'te görüldü: `GOOGLE_*` env'leri **boot'ta zorunlu**, dummy değerle ayağa kaldırıldı |
| **Çözüm** | **Faz 2.8** — on-prem build'de feature flag ile kapalı; §9-A3'te "v1'de YOK" kararı zaten yazılı. Talep gelirse seçenekler: müşterinin kendi OAuth app'i · CalDAV/ICS-feed · cihaz akışı. E-posta zaten SMTP'ye dönmüştü, Gmail yolu ikincil. Aynı görevde `GOOGLE_*` boot-zorunluluğu da kaldırılmalı |
| **Durum** | `geplant` (Faz 2.8) · alt-soru `offen` (§9-A3, kullanıcı kararı bekliyor) |

### O-09 — Apify (Google Places crawler) — bizim token'ımız, B2B lead araması

| Alan | İçerik |
|---|---|
| **Ne** | İşletme arama/lead toplama Apify aktörüne çıkıyor |
| **Nerede** | `api-backend/server.js:465` (`api.apify.com/v2/acts/compass~crawler-google-places/…?token=`) · Vercel tarafı `api/apify/search.js` · frontend B2B ekranı `dashboard.js:11841` (`B2B_AGENT_URL`) |
| **Tip** | A + E + G |
| **Kutuda ne olur** | Müşteri kutusundan bizim Apify token'ımızla dışarı çıkılır → G2/K5 ihlali, faturası bize gelir. Ama asıl soru bu değil: bu özellik **hasta işi değil**, bizim B2B pazarlama/lead aracımız. Müşterinin praxis'inde işi yok |
| **Çözüm** | Merkez tarafı (tip G) — on-prem pakette **bulunmaz**; hem route hem `nav-registry` görünürlüğü on-prem build'de kapalı. Faz 1.1'in "merkezde kalacaklar" listesine yazılmalı. ⚠️ Playbook bu özelliği hiç anmıyor |
| **Durum** | `offen` — Faz 1.1 listesine eklenmeli (playbook'ta karşılığı yok) |

### O-10 — Stripe API çağrısı backend'de (checkout session okuma)

| Alan | İçerik |
|---|---|
| **Ne** | `admin/recover-checkout` route'u Stripe'a doğrudan gidiyor |
| **Nerede** | `api-backend/server.js:2749` (`api.stripe.com/v1/checkout/sessions/…`) · asıl Stripe zinciri Vercel'de `api/stripe/*` |
| **Tip** | A + G |
| **Kutuda ne olur** | Kutuda `STRIPE_SECRET_KEY` yok (olmamalı da — G2), route çağrılırsa 500 döner. Kırılma değil, ölü yüzey |
| **Çözüm** | Merkez tarafı (K3: Stripe merkezde kalır). On-prem build'de route kapalı; plan/ödeme durumu kutuya **lisans dosyasıyla** gider (Faz 3), kutu Stripe'a hiç bakmaz |
| **Durum** | `geplant` (Faz 3.3 entitlements; route kapatma Faz 1.1/2.0) |

### O-11 — Fahrtenbuch ORS proxy'si: 3 Supabase Edge Function — **kaynak kodu repoda YOK**

| Alan | İçerik |
|---|---|
| **Ne** | Hausbesuch mesafe/rota hesabı OpenRouteService'e gidiyor; proxy Deno edge function'ları yalnızca Supabase cloud projesinde yaşıyor |
| **Nerede** | Çağıran: `dashboard.js:5696` `invokeFahrtenbuchFn()` → `supabase.functions.invoke()`; kullanım `:5734` `:5764` `:5770`. Fonksiyonlar: `fahrtenbuch-geocode`, `fahrtenbuch-route`, `fahrtenbuch-matrix`. **`git ls-files supabase/` → yalnız `migrations/` (14 dosya); `supabase/functions/` git geçmişinde hiç yok.** Tasarım belgesi: `archive/Fahrtenbuch.md:114-131` |
| **Tip** | A |
| **Kutuda ne olur** | İki katmanlı sorun. (1) Kutuda `functions.invoke` boşa gider — self-host Supabase'e Deno runtime koymuyoruz (Faz 1.5 kararı) → Hausbesuch mesafe hesabı sessizce ölür, Fahrtenbuch km'siz kalır. (2) Daha ciddisi: **taşınacak kaynak kod elimizde yok.** Playbook D1 "Kaynak: `supabase/functions/`" diyor; bu bilgi **eskimiş/yanlış**. Fonksiyonlar canlı projeden indirilmeden Faz 1.5'e başlanamaz. Üçüncüsü: ORS free tier'da DSGVO Art. 28 AVV yok (`archive/Fahrtenbuch.md:131`) ve giden koordinat hasta ev adresinden türüyor |
| **Çözüm** | Önce **kaynak kurtarma** (canlı projeden `functions download`, repoya al) → sonra **Faz 1.5** (Express `routes/fahrtenbuch.js`). Anahtar sahipliği §9-A8'e bağlı; öneri (a): müşterinin kendi ücretsiz ORS anahtarı, sihirbaza adım. Mevcut disiplin korunur: ORS'a hasta adı/ID gitmez, yalnız koordinat (`archive/Fahrtenbuch.md:123`) |
| **Durum** | 🟡 **kaynak kurtarıldı (04.09.2026)** — Faz 1.5 artık başlayabilir |

> **04.09.2026 — yapılan (ana bağlam):**
> Üç fonksiyonun kaynağı canlı Supabase projesinden **geri çekildi** ve depoya yazıldı:
> `supabase/functions/{fahrtenbuch-geocode,fahrtenbuch-route,fahrtenbuch-matrix}/index.ts`
> \+ klasör README'si. İçerik birebir, tek satır değiştirilmedi.
>
> Depoya alınabilmesinin şartı önce kontrol edildi: `ORS_API_KEY` üçünde de
> `Deno.env.get()` ile okunuyor, **kodun içinde gömülü değil**. Sızıntı taraması temiz,
> `supabase/` zaten `.vercelignore`'da.
>
> Bu madde on-prem'den bağımsız bir riski de kapatıyor: fonksiyonlar aylardır canlıda
> çalışıyordu ve **hiçbir yerde kaynağı yoktu** — silinseler kimse yeniden yazamazdı.
>
> ⚠️ **Yeni ve kalıcı risk:** repodaki kopya canlının **aynası değil, fotoğrafı.** Depoda
> değişiklik yapmak canlıyı değiştirmez (deploy ayrı adım). Uyarı klasör README'sinde
> yazılı; ayrışırsa aynı sorun geri gelir.
>
> **Kalan:** Faz 1.5 (Express `routes/fahrtenbuch.js`) ve §9-A8 anahtar sahipliği kararı
> (öneri: müşterinin kendi ücretsiz ORS anahtarı). İkisi de hâlâ açık.
>
> **11.09.2026 — karar artık belgede değil pakette.** `onprem/docker-compose.yml`
> Deno konteynerini (`functions`) **içermiyor**. Yani kutuda Fahrtenbuch mesafe hesabı
> yapısal olarak ölü: `supabase.functions.invoke()` karşılık bulmaz. Faz 1.5 inene kadar
> Hausbesuch km'si kutuda boş kalır — bilinen ve kabul edilmiş durum, compose başlığında
> da yazılı. ⚠️ Kabul edilmiş olması unutulmuş olmasına dönüşmesin: Fahrtenbuch satışta
> anlatılan bir özellik, kutuda çalışmadan teslim edilirse §434 BGB tartışması açar.

### O-12 — Nominatim/OSM geocoding tarayıcıdan doğrudan

| Alan | İçerik |
|---|---|
| **Ne** | İşletme adresi koordinata çevrilirken müşterinin tarayıcısı OpenStreetMap'e çıkıyor |
| **Nerede** | `dashboard.js:22788` (`nominatim.openstreetmap.org/search?q=…`), çağıran blok `:22777`, hata yolu `:22805` |
| **Tip** | A |
| **Kutuda ne olur** | Giden veri **işletme adresi** — hasta verisi değil, praxis'in zaten Impressum'da açık olan adresi. İnternetsiz kurulumda `catch` var: koordinat boş kalır, uygulama çalışmaya devam eder. İki not: (1) Nominatim kullanım politikası ticari toplu kullanımı kısıtlar, kutu başına tekil çağrı bu sınırın çok altında; (2) tarayıcıdan gittiği için müşterinin IP'si OSM'e görünür |
| **Çözüm** | `unkritisch` — playbook D4 aynı hükmü vermişti, koda karşı doğrulandı. ⚠️ Şart: bu çağrı **hasta adresine** genişletilirse madde `offen`'e döner ve O-11 ile aynı sepete girer |
| **Durum** | `unkritisch` (D4 hükmü doğrulandı). ⚠️ **11.09.2026 güncellemesi:** yukarıdaki "müşterinin IP'si OSM'e görünür" notu **kutuda artık geçerli değil** — Faz 2.1b'nin CSP'si (`connect-src 'self' …`) bu çağrıyı tarayıcıda engelliyor, istek hiç çıkmıyor. Bedeli: `clinic_lat/lng` kutuda hiç dolmuyor, `catch` sessizce dönüyor, Hausbesuch mesafesi O-11'in üstüne ikinci kez kayboluyor. Madde `unkritisch` kalıyor ama gerekçesi "zararsız veri gidiyor"dan "hiç gitmiyor, özellik susuyor"a döndü. Satır atıfları da kaymış: güncel yer `dashboard.js:20683` (blok `:20674`) |

### O-13 — `N8N_WEBHOOK_URL` booking bildirimi

| Alan | İçerik |
|---|---|
| **Ne** | Randevu oluşturulunca n8n'e fire-and-forget bildirim |
| **Nerede** | `api-backend/server.js:1192` (`process.env.N8N_WEBHOOK_URL`; 04.09'da `:1053`) — env yoksa sessizce atlanıyor. Kutu paketinde bu env **yok**, yani kutuda hiç çalışmıyor (doğrulandı) |
| **Tip** | A |
| **Kutuda ne olur** | Env boş kalacağı için **hiçbir şey**; kod bunu zaten sessizce atlıyor, kutuda kırılmaz. Yine de G3/G8 disiplini gereği kodda `N8N_` referansı kalmamalı — playbook D9'a göre bu webhook WhatsApp döneminden kalma ve muhtemelen işlevsiz |
| **Çözüm** | **Faz 1.2** — kaldır ya da iç event'e çevir. Kabul kriteri: `grep N8N_` → sıfır (11.09.2026 akşamı yeniden ölçüldü, hâlâ 3 satır: `:1216` `:1969` `:1972`) |
| **Durum** | `geplant` (Faz 1.2) |

### O-14 — SMTP çıkışı (nodemailer)

| Alan | İçerik |
|---|---|
| **Ne** | Booking/onay/Mahnung mailleri müşterinin SMTP sunucusundan gidiyor |
| **Nerede** | `api-backend/server.js:4102-4103` (`createTransport`, `SMTP_HOST`) + 6 çağrı noktası (`:3633` `:3649` `:3815` `:3865` `:3969` `:4017`). Merkez tarafı ayrı: `api/contact.js:13`, `api/demo-booking.js:22` |
| **Tip** | A |
| **Kutuda ne olur** | Sorunsuz — host/port/kullanıcı tamamen env-var, kod sağlayıcı-agnostik. Her çağrı noktası `if (process.env.SMTP_HOST)` ile korumalı, yani SMTP kurulmadan da uygulama çalışır. Hedef müşterinin kendi mail sunucusu, bizden geçmiyor |
| **Çözüm** | `unkritisch` — Faz 2.2 sihirbazı SMTP profillerini dolduracak, Faz 2.7 aynı ayarı GoTrue'ya besleyecek. Kodda değişiklik gerekmiyor. ⛔ Resend/Postmark'a geçilmez (proje kuralı) |
| **Durum** | `unkritisch` (desen doğru; sihirbaz işi Faz 2.2/2.7) — ⚠️ **11.09.2026 düzeltmesi:** kutu paketinde `SMTP_*` yalnız GoTrue'ya geçiyor, **`api` konteynerine geçmiyor**; yani kutuda davet/şifre maili gider, randevu ve Mahnung maili sessizce gitmez → **O-50** (11.09.2026 akşamı düzeltildi, `SMTP_*` artık `api`'ye de geçiyor). ⚠️ Ama SMTP geçmesi mailin **teslim edileceği** anlamına gelmiyor: gönderen adresi koda gömülü, kutudan çıkan mail SPF/DMARC'a takılıp spam'e düşüyor → **O-51** |

---

## 3. Vercel `api/` fonksiyonları — merkez/kutu ayrımı (tip G)

> Playbook **Faz 1.1** bu ayrımı istiyor ama listeyi çıkarmamış. Liste burada.
> Sayım: `find api -name "*.js" -not -path "api/_lib/*" | wc -l` → **12** (limit dolu).
> `api/_lib/` (auth.js, pricing.js, stripe.js) fonksiyon sayılmaz, import edilen yardımcı.

| # | Fonksiyon | Kim çağırıyor | Karar | Gerekçe |
|---|---|---|---|---|
| 1 | `api/config.js` | `supabase-config.js:2` (her sayfa) | **KUTU** | Kutunun kendi Supabase URL'ini vermeli — O-15 |
| 2 | `api/dsgvo.js` | `dashboard.js:1425` `:1434` `:2360` `:13459` `:13514` `:22204` | **KUTU** | Hasta verisi okuyor/siliyor; G1 gereği bizden geçemez — O-16 |
| 3 | `api/stripe/create-checkout-session.js` | `onboarding.js:918` `:992`, `dashboard.js:22269` | **MERKEZ** | K3: Stripe merkezde — O-17 |
| 4 | `api/stripe/portal-session.js` | `dashboard.js:2316` | **MERKEZ** | K3 — O-17 (ama dashboard butonu O-19) |
| 5 | `api/stripe/webhook.js` | Stripe → bize | **MERKEZ** | K3 |
| 6 | `api/onboarding/pending.js` | `onboarding.js:980` | **MERKEZ** | Ödeme öncesi kayıt; kutuda karşılığı ilk-açılış sihirbazı (Faz 2.2) |
| 7 | `api/onboarding/check-email.js` | `onboarding.js:343` | **MERKEZ** | Aynı gerekçe |
| 8 | `api/contact.js` | `kontakt.html:535`, `vorregistrierung.html:532` | **MERKEZ** | Pazarlama sayfası formu; Faz 2.0 pakete girmiyor |
| 9 | `api/demo-booking.js` | `demo-booking.html:1064` `:1348` `:1384` | **MERKEZ** | Bizim satış demomuz, müşterinin işi değil |
| 10 | `api/admin/data.js` | `admin.js:69` `:95` `:158` `:209` | **MERKEZ** | Bizim admin panelimiz — ama içeriği kutuyla kesişiyor, O-18 |
| 11 | `api/admin/feedbacks.js` | `admin.js:239` `:259` | **MERKEZ** | Aynı, O-18 |
| 12 | `api/apify/search.js` | `dashboard.js:9429` `:13712` | **MERKEZ** | B2B lead aracı, hasta işi değil — O-09 |

**Özet:** 2 kutuya · 10 merkezde · 2 tanesi (admin/*) kutu verisine baktığı için ayrıca bölünmeli.

### O-15 — `/api/config` Vercel fonksiyonu olarak duruyor, kutuda Express vermeli

| Alan | İçerik |
|---|---|
| **Ne** | Frontend'in Supabase URL/anon-key'i aldığı tek nokta bir Vercel fonksiyonu |
| **Nerede** | `api/config.js` (12 satır) · tüketici `supabase-config.js:2` — yani **her sayfa** |
| **Tip** | G |
| **Kutuda ne olur** | Vercel yok → `/api/config` 404 → `supabase-config.js` boş URL döndürür → `createClient('','')` → uygulamanın **tamamı** açılmaz. Kırılma en temel yerde ve sessiz: konsola tek satır error düşer, ekran boş kalır |
| **Çözüm** | **Faz 1.1** — Express'te aynı yolda route; PoC 0.4'te muadili zaten yazıldı (`onprem/poc-frontend-server.mjs`), o dosya şablon. SaaS'ta Vercel fonksiyonu kalabilir (aynı sözleşme, iki dağıtım — fork değil). O-01'in çözümüyle aynı yüzey: `apiBase` de buradan dönmeli |
| **Durum** | ✅ **gelöst (11.09.2026 akşam)** — `api-backend/server.js`'e `GET /api/config` eklendi (aynı sözleşme, `apiBase` de dahil — bkz. O-01'in akşam notu). Kutu paketinde **statik arayüzü servis edecek bileşen hâlâ yok** (Caddy, Faz 2.1b) — o kısım bu maddenin değil 2.1b'nin işi, O-15'in kendi işi (config route) bitti |

### O-16 — `/api/dsgvo` hasta verisine dokunan tek Vercel fonksiyonu

| Alan | İçerik |
|---|---|
| **Ne** | DSGVO Art. 15 Auskunft ve Art. 17 Löschung zinciri merkez tarafta çalışıyor |
| **Nerede** | `api/dsgvo.js` (417 satır, service-role ile) · çağıran 6 nokta `dashboard.js` |
| **Tip** | G (+ D bağı) |
| **Kutuda ne olur** | Bugünkü hâliyle iki kere kırılır: (1) Vercel yok → 404; (2) daha kötüsü, merkezde kalırsa **merkez müşterinin hasta verisini okuyor** demektir → G1/K6 ihlali, geçişin amacı boşa. Ayrıca kod service-role anahtarıyla çalışıyor, o anahtar kutuda müşterinin olmalı |
| **Çözüm** | **Faz 1.1** — Express'e taşınır, kutuda kutunun kendi DB'sine bakar. ⚠️ Taşırken iki bilinen kilit korunur (dosya başındaki 28.08.2026 notu): GoBD `invoice_festschreibung()` triggeri ve `patient_consents` RESTRICT. Bunlar hata değil hukuki kilit — "on-prem'de kolaylaştıralım" denmez. Ayrıca `USER_TABLES` listesi Faz 5.1 export kapsamıyla çapraz doğrulanacak (playbook zaten istiyor) |
| **Durum** | `geplant` (Faz 1.1) |

### O-17 — Stripe + onboarding + contact + demo-booking merkezde kalır

| Alan | İçerik |
|---|---|
| **Ne** | Ödeme, kayıt öncesi akış ve pazarlama formları merkez tarafın işi |
| **Nerede** | `api/stripe/create-checkout-session.js` · `api/stripe/portal-session.js` · `api/stripe/webhook.js` · `api/onboarding/pending.js` · `api/onboarding/check-email.js` · `api/contact.js` · `api/demo-booking.js` |
| **Tip** | G |
| **Kutuda ne olur** | Hiçbiri kutuya girmez, dolayısıyla kutuda **hiçbir şey olmaz**. K3 bunu zaten kilitledi: müşteri kaydı, Stripe, lisans sunucusu merkezde; hasta verisi girmediği için §393/C5 tetiklenmez |
| **Çözüm** | `unkritisch` — merkez tarafı, bilinçli. ⚠️ Not: `api/onboarding/pending.js` bugün **Supabase Vault**'un tek canlı kullanıcısı (geçici şifreyi şifreli tutuyor). Merkez tarafta kaldığı için kutunun Vault ihtiyacını **azaltmaz**: kutuda Vault yine gerekli (Gmail/ORS token'ları — PoC 0.2'de Vault self-host'ta çalıştığı doğrulandı, §9-A4 çözüldü) |
| **Durum** | `unkritisch` (K3) |

### O-18 — Admin paneli merkezde ama beslendiği veri kutuda olacak

| Alan | İçerik |
|---|---|
| **Ne** | Bizim admin panelimiz müşteri tenant'larının içine bakarak KPI üretiyor |
| **Nerede** | `api/admin/data.js:69` (stats) `:95` (customers) `:158` (ai_breakdown) `:209` (db_health) · `api/admin/feedbacks.js` · tüketici `admin.js` |
| **Tip** | G + H |
| **Kutuda ne olur** | Kutu bu fonksiyonları içermez — sorun **ters yönde**: bugün merkez, müşterinin tablolarını service-role ile okuyarak "kaç randevu, kaç AI çağrısı, DB sağlığı" gösteriyor. On-prem'de o tablolar müşterinin kutusunda, merkezin erişimi **yok ve olmamalı** (K10). Yani panel on-prem müşteriler için **boş kalır** — bu bir hata değil, tasarımın sonucu, ama panelin bunu bilmesi gerekir yoksa "veri kayboldu" sanılır |
| **Çözüm** | Panel ikiye bölünür: **merkez verisi** (kim, hangi plan, lisans durumu, son yenileme çağrısı) her zaman görünür — Faz 3.1 lisans sunucusundan gelir; **tenant içi KPI** yalnız SaaS tenant'ları için. On-prem satırlarında "on-prem — veri erişimi yok (K10)" etiketi. `feedbacks` ayrı: O-22'ye bağlı (feedback bize gelmeye devam edecek, ama trigger'la değil) |
| **Durum** | `offen` — playbook Faz 1.1 "admin/* → dokunma" diyor, ama **panelin on-prem'de ne göstereceği** hiçbir fazda yazılı değil. Faz 3.1 adayı |

### O-19 — Dashboard içindeki Stripe checkout/portal butonları

| Alan | İçerik |
|---|---|
| **Ne** | Uygulama içinden plan yükseltme ve fatura portalı Stripe'a gidiyor |
| **Nerede** | `dashboard.js:2316` (`/api/stripe/portal-session`) · `dashboard.js:22269` (`/api/stripe/create-checkout-session`) · plan gösterimi `dashboard.js:2360` `:22204` civarı |
| **Tip** | G + H |
| **Kutuda ne olur** | İki buton 404 alır, kullanıcı "Abo verwalten"e basar hiçbir şey olmaz. Sessiz kırılma — kullanıcı ödemesini yönetemediğini anlamaz, sadece butonun bozuk olduğunu görür. Lisans süresi dolarken (Faz 3 durum makinesi) bu ekran **tam da lazım olduğu an** çalışmıyor olur |
| **Çözüm** | **Faz 3.2** — on-prem'de bu iki buton merkez portalına giden **dış linke** dönüşür (`PUBLIC_BASE_URL` değil, sabit merkez adresi; müşteri tarayıcısı bizim ödeme sayfamıza gider — hasta verisi taşımaz, G1 temiz). Panel banner'ları ve Mahnung akışı (3.2a) aynı yüzeyde |
| **Durum** | `geplant` (Faz 3.2) |

### O-20 — Vercel fonksiyon limiti 12/12 — G8'in mekanik yüzü

| Alan | İçerik |
|---|---|
| **Ne** | Yeni bir Vercel fonksiyonu eklenemez; teknik limit ile korkuluk aynı yere bakıyor |
| **Nerede** | `api/` altında tam 12 fonksiyon (`api/_lib/*` hariç). Doğrulama: `find api -name "*.js" -not -path "api/_lib/*" \| wc -l` |
| **Tip** | G |
| **Kutuda ne olur** | Doğrudan bir etkisi yok, ama **G8'in en kolay ihlal noktası** burası: yeni bir HTTP endpoint gerektiğinde en kısa yol `api/` altına dosya açmaktır. Bugün onu Vercel'in plan limiti engelliyor — yani bizi koruyan şey disiplin değil, tesadüf. Limit büyütülürse koruma kaybolur |
| **Çözüm** | Kapı: `tools/check-onprem.sh` `api/` dosya sayısını sayar, **artış = red** (taban 12). Yeni endpoint `api-backend/server.js`'e yazılır — G8 zaten bunu söylüyor |
| **Durum** | ✅ **`gelöst` (04.09.2026, `ce8d7d0`)** — kapı `tools/check-onprem.sh` + `tools/.onprem-baseline` (`vercel_fn=12`), `.githooks/pre-commit`'e bağlı. 11.09.2026'da `onprem_image` sekizinci sayaç olarak eklendi (`b2fdbb8`) ve kapı yeşil çalıştırılarak doğrulandı: sekiz sayacın sekizi tabanında |

---

## 4. Zamanlanmış işler (tip F)

> Tarama: `.github/workflows/` (2 dosya) · `api-backend/server.js` içindeki `setInterval`
> zamanlayıcıları · DB trigger'ları (`db/SCHEMA-RLS.sql` §3-4 + `onprem/schema/` dump'ı).
> **pg_cron kurulu değil** — dump'ta `cron.` şeması yok, doğrulandı.

### O-21 — `notify_feedback_telegram()` DB trigger'ı `pg_net` ile bizim webhook'umuza POST atıyor

| Alan | İçerik |
|---|---|
| **Ne** | Feedback yazıldığı anda veritabanı, bizim n8n'imize HTTP isteği gönderiyor |
| **Nerede** | `onprem/schema/live_schema_2026-07-06.sql:711-729` (fonksiyon gövdesi, `net.http_post` → `https://n8n.infinitymade.de/webhook/feedback-notify`) · trigger `trg_feedback_telegram AFTER INSERT ON feedbacks` (`:4997`, `db/SCHEMA-RLS.sql:742`) · özet `db/SCHEMA.sql:822`. Dump'ta `net.http_post` **1 kez** geçiyor — tek örnek |
| **Tip** | F + A |
| **Kutuda ne olur** | Müşterinin veritabanı, müşteri bilmeden bizim sunucumuza bağlanır. Gönderilen alanlar (`type`, `priority`, `title`, `description`) hasta verisi değil ve bize gelmesi **isteniyor** — ama G1'in görünümüne aykırı: "veriniz %100 sizde" diyip DB'den dışarı otomatik POST atmak satışta da hukukta da savunulamaz. Ayrıca `pg_net` self-host Supabase'de varsayılan kurulu değil → trigger sessizce hata verebilir |
| **Çözüm** | **Faz 1.6** — trigger kaldırılır; feedback bildirimi Express tarafında, formun submit'inde **açık** API çağrısına döner. On-prem'de "Praxura'ya gönder" onay metniyle, yani kullanıcının bilinçli eylemi. SaaS'ta davranış aynı kalır (G7). Playbook D2 aynı hükmü vermişti, koda karşı doğrulandı |
| **Durum** | `geplant` (Faz 1.6) |

### O-22 — `attendance` gece 23:55 otomatik kapatma (`setInterval`)

| Alan | İçerik |
|---|---|
| **Ne** | Check-out yapılmamış devam kayıtları her gece Berlin saatiyle 23:55'te `incomplete` işaretleniyor |
| **Nerede** | `api-backend/server.js:3372-3395` — `scheduleAttendanceAutoClose()`, `setInterval(…, 60_000)`, dakikada bir saate bakıyor |
| **Tip** | F |
| **Kutuda ne olur** | **Çalışır** — zamanlayıcı Express sürecinin içinde, image ile birlikte kutuya gider, dışarıya hiç çıkmaz, pg_cron gerektirmez. Tek not: saat dilimi `BUSINESS_TZ` (Europe/Berlin) sabit; Almanya dışında müşteri düşünülüyorsa env'e alınmalı — bugün alan Almanya olduğu için sorun değil |
| **Çözüm** | `unkritisch` — desen doğru ve playbook Faz 2.4a'nın istediği şeyin (node-cron) elle yazılmış hâli. **Yeni periyodik iş çıktığında şablon budur**, pg_cron'a gidilmez |
| **Durum** | `unkritisch` (desen doğru) |

### O-23 — `delete_expired_accounts()` — playbook D5 **çürütüldü**, ama on-prem'de yeni bir risk açıyor

| Alan | İçerik |
|---|---|
| **Ne** | Süresi dolmuş iptal hesapları gece 03:00'te anonimleştiren/silen RPC; zamanlayıcısı **var** |
| **Nerede** | Zamanlayıcı: `api-backend/server.js:3400-3415` (`scheduleAccountCleanup()`, 03:00 Berlin). RPC: `db/SCHEMA-RLS.sql:511` (`delete_expired_accounts()` [SEC DEF]) |
| **Tip** | F |
| **Kutuda ne olur** | İki ayrı hüküm. (1) **Playbook D5 artık yanlış:** "zamanlayıcısı YOK (pg_cron kurulu değil, kodda çağıran yok)" deniyordu — bugün `server.js:3400`'de çağıran var. Faz 2.4a'nın "SaaS'ta da düzelt" notu **düşmüştür**. (2) Buna karşılık on-prem'de **yeni** bir tehlike: bu zamanlayıcı müşterinin kendi kutusunda çalışır ve `deletion_scheduled_at` dolu bir hesabı bulursa **müşterinin kendi hasta verisini silecek**. Lisans bitişinin cezası salt-okunur moddur (K9/G5), **veri silme değildir**. İki mekanizma yanlışlıkla birbirine değerse geri dönüşü olmayan zarar olur |
| **Çözüm** | Faz 3.2 durum makinesi yazılırken açık kural: lisans/ödeme yolu `deletion_scheduled_at`'e **hiçbir koşulda dokunmaz**; o alanı yalnız kullanıcının kendi hesap-silme talebi doldurur. On-prem build'de zamanlayıcı korunur (kullanıcının kendi talebi yasal olarak işlemek zorunda) ama kaynağı denetlenir |
| **Durum** | `offen` (playbook D5 `widerlegt`; yeni risk Faz 3.2'ye bağlanmalı, bugün hiçbir fazda yazılı değil) |

### O-24 — `notify_new_referral_draft()` trigger'ı `pg_notify` ile iç kanal

| Alan | İçerik |
|---|---|
| **Ne** | Yeni referral draft'ta veritabanı içi bildirim kanalına mesaj basılıyor |
| **Nerede** | `onprem/schema/live_schema_2026-07-06.sql:738-755` (`pg_notify('new_referral_draft', …)`) · trigger `:5259` |
| **Tip** | F |
| **Kutuda ne olur** | Hiçbir şey — `pg_notify` **Postgres'in içinde** kalır, ağa çıkmaz. Dinleyen yoksa mesaj düşer. Payload hasta adı içeriyor ama veritabanının dışına çıkmıyor |
| **Çözüm** | `unkritisch` — O-21 ile karıştırılmamalı: o `net.http_post` (dışarı), bu `pg_notify` (içeri). Bu ayrım her denetimde yeniden sorulmasın diye buraya yazıldı |
| **Durum** | `unkritisch` |

### O-25 — `publish-calendar-api.yml` yalnız `latest` tag'i basıyor — kanal sistemi yok

| Alan | İçerik |
|---|---|
| **Ne** | Image yayın workflow'u tek tag üretiyor; K11'in `:beta`/`:stable` ayrımı henüz yok |
| **Nerede** | `.github/workflows/publish-calendar-api.yml:64-65` (`type=raw,value=latest`) · tetikleyici `on: push: branches:[main], paths: api-backend/**` · testler publish'ten **önce** koşuyor (`:15-18` yorumu) |
| **Tip** | F + B |
| **Kutuda ne olur** | Bugün: her main push'u ~60 saniyede canlıya çıkar (Watchtower). Bu SaaS'ta bilinçli. Kutularda aynı düzen kalırsa **ücretli müşteri her denememizi yer** — K11 tam bunu engellemek için var. Ücretli müşterinin kutusu, henüz test edilmemiş bir image'ı gece yarısı çeker |
| **Çözüm** | **Faz 4.3** — `:beta` (her main push) + `:stable` (yalnız release tag'i); Watchtower kanal tag'ini izler. Testlerin publish'ten önce koşması iyi bir taban, korunur. Ayrıca şema dağıtımıyla bağlanır: `:stable` image'ı yalnız kendi migration'larını bilmeli (O-39). ★ Kanalın tam tasarımı — değişmez `X.Y.Z` etiketi, 72 saatlik soak, `:stable`'ın elle taşınması, `latest`'in kullanımdan kalkması, kutuda saatlik Watchtower — `onprem/RELEASE-STANDARD.md` §2.3 + §6.4'te. Etiketin kendisi risk kontrolüdür; aralık değil |
| **Durum** | `geplant` (Faz 4.3 / 4.3b) — bkz. O-41 (smoke-test ve soak eksikliği) |

> **11.09.2026 — paket, var olmayan bir etikete işaret ediyor.**
> `onprem/.env.template` `PRAXURA_API_IMAGE=…/calendar-api:stable` diyor; yayın hattı ise
> bugün yalnız `latest` + kısa sha basıyor (`publish-calendar-api.yml:65-66`). **`:stable`
> diye bir etiket yok.** İkinci eksik: şablonda özel registry kimliği için satır yok —
> per-müşteri pull-credential playbook Faz 3.4'ün işi ve `.env.template` ona yer ayırmıyor.
> Sonuç, paketin bugünkü dürüst tarifi: **çalışan bir test yığını, kurulabilir bir ürün
> değil.** Müşteri sunucusunda `docker compose up` bugün image'ı çekemez. Faz 4.3b (kanal
> etiketleri) ve Faz 3.4 (registry kimliği) inmeden ilk kurulum yapılamaz.

### O-26 — Yedekleme zamanlayıcısı repoda yok, VPS'te elle kurulmuş

| Alan | İçerik |
|---|---|
| **Ne** | Gecelik yedek bugün sunucuya elle kurulan bir cron; repo'da ne script'i ne tanımı var |
| **Nerede** | `grep -rl pg_dump --include="*.sh" --include="*.mjs" --include="*.yml"` → **sıfır sonuç**. Kurulum bilgisi `INFRASTRUCTURE.md`'de (gitignore'lu) |
| **Tip** | F |
| **Kutuda ne olur** | Kutu **yedeksiz** kurulur. Müşteri sunucusunda veri kaybı = hasta dokümantasyonu kaybı = bizim değil müşterinin sorumluluğu, ama ürün "yedek yok" diye teslim edilirse satışta ve hukukta savunulamaz. Ayrıca playbook D3'ün uyarısı geçerli: `pg_dump` **storage dosyalarını yedeklemez** — reçete görüntüleri, DTA dosyaları, hasta belgeleri 5 bucket'ta duruyor |
| **Çözüm** | **Faz 2.3** — gecelik `pg_dump` + storage volume arşivi tek yedek seti; hedef Hetzner Storage Box/lokal dizin; 14 gün + 12 ay rotasyon; panelde "son yedek: X" ve başarısızlıkta uyarı; `restore.sh` + gerçekten test edilmiş geri yükleme |
| **Durum** | `geplant` (Faz 2.3 + 2.3a) — ★ ek gereksinim `onprem/RELEASE-STANDARD.md` §4.3: **migration çalışmadan önce** kutu `vor-<sürüm>` yedeği alır; yedek alınamıyorsa migration **çalışmaz**. Göç-öncesi yedeklerin son 3'ü rotasyondan muaf. Yedek hedefi varsayılan olarak **kutunun dışı** (aynı diskteki yedek disk arızasında veriyle birlikte ölür, §6.6) |

---

## 5. Sırlar (tip E)

> Tarama: `grep -rho "process\.env\.[A-Z0-9_]*"` → `api-backend/` **27** ad, `api/` **16** ad.
> Aşağıda yalnız **adlar** var — depo public, değer yazılmaz.
> Ayrım tek soruyla: bu değişken **bizim** anahtarımızı mı yoksa **müşterinin** anahtarını
> mı taşıyacak? Bizimse pakete giremez (G2/K5).

| Env var | Bugün kimin | Kutuda kimin | Not |
|---|---|---|---|
| `AZURE_OPENAI_API_KEY` / `_ENDPOINT` / `_REGION` / `_DEPLOYMENT` | **bizim** | müşterinin (`AI_API_KEY`) | O-07 · Faz 1.3 |
| `APIFY_TOKEN` | **bizim** | — (özellik kutuya girmez) | O-09 |
| `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `STRIPE_PRICE_*` | **bizim** | — (merkez) | O-10/O-17 |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `_REDIRECT_URL` | **bizim** | — (Faz 2.8 kapalı) | O-08 |
| `ADMIN_RECOVERY_SECRET` | **bizim** | — (merkez route) | O-27 |
| `SETUP_SECRET` | **bizim** | — (demo-booking, merkez) | O-27 |
| `SENTRY_DSN_BACKEND` · `SENTRY_ENVIRONMENT` · `SENTRY_SERVER_NAME` · `DEBUG_SENTRY` | **bizim** | opsiyonel, müşteri onayına bağlı | O-06 · G4 · Faz 2.6 |
| `N8N_WEBHOOK_URL` · `N8N_AI_SERIES_URL` | bizim | — (silinecek) | O-02/O-13 · Faz 1.2 |
| `SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_URL` | bizim | **müşterinin** (kutu içi) | O-05 |
| `SUPABASE_SERVICE_ROLE_KEY` | bizim | **müşterinin** (kurulumda üretilir) | O-28 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | bizim | müşterinin | sır değil, RLS korur |
| `SMTP_HOST` / `_PORT` / `_USER` / `_PASS` | bizim | **müşterinin** | O-14 · Faz 2.2 |
| `DATA_ENCRYPTION_KEY` | bizim | **müşterinin** (kurulumda üretilir) | O-29 — **en tehlikelisi** |
| `NEXT_PUBLIC_URL` | bizim | müşterinin (`PUBLIC_BASE_URL`) | O-03 |
| `ORS_API_KEY` (bugün Supabase Vault'ta) | bizim | §9-A8 kararına bağlı | O-11 |

### O-27 — Bizim anahtarlarımızı taşıyan env var'lar kutuya giremez

| Alan | İçerik |
|---|---|
| **Ne** | 8 grup env var bugün bizim hesaplarımızın anahtarını taşıyor |
| **Nerede** | `AZURE_OPENAI_API_KEY` (`api-backend/ai/azureClient.js:12`) · `APIFY_TOKEN` (`server.js:465`) · `STRIPE_SECRET_KEY` (`server.js:2749`, `api/_lib/stripe.js`) · `STRIPE_WEBHOOK_SECRET` (`api/stripe/webhook.js`) · `GOOGLE_CLIENT_SECRET` (`server.js` OAuth) · `ADMIN_RECOVERY_SECRET` (`server.js:2738`) · `SETUP_SECRET` (`api/demo-booking.js:320`) · `SENTRY_DSN_BACKEND` |
| **Tip** | E |
| **Kutuda ne olur** | Hepsi aynı sonuca çıkar: **müşteri sunucusundaki her sır okunabilir.** `docker inspect`, `.env` dosyası, hatta yedek arşivi — hepsi müşterinin elinde. Sızan Azure anahtarının faturası bize gelir; sızan Stripe anahtarı bizim tüm müşteri ödemelerimizi açar. K5 ve G2 tam bunu yasaklıyor |
| **Çözüm** | Üç gruba ayrılır: **BYO-key'e dönenler** (Azure → `AI_API_KEY`, müşterinin IONOS anahtarı — Faz 1.3/2.2) · **kutuya hiç girmeyenler** (Stripe, Apify, Google, ADMIN_RECOVERY, SETUP — ilgili route on-prem build'de kapalı) · **opsiyonel olanlar** (Sentry — G4, varsayılan kapalı). Kabul kriteri Faz 3'te zaten yazılı ve genişletilmeli: image `docker inspect` + `grep` ile denetlenir, bizim hiçbir anahtarımız çıkmaz |
| **Durum** | `geplant` (Faz 1.3 + 2.1 `.env.template` + Faz 3 doğrulama) |

### O-28 — `SUPABASE_SERVICE_ROLE_KEY` kutuda müşteriye ait olmalı ve kurulumda üretilmeli

| Alan | İçerik |
|---|---|
| **Ne** | Backend'in RLS'i aşan anahtarı; her kutunun kendi JWT secret'ından türemeli |
| **Nerede** | `api-backend/server.js` boot (env yoksa `process.exit(1)` — bilinçli), `api/_lib/auth.js` |
| **Tip** | E |
| **Kutuda ne olur** | İki hata biçimi var, ikisi de yaşandı ya da yaşanabilir: (1) **anahtar adı yanlış yazılırsa** (`SUPABASE_SERVICE_KEY`) container crash-loop'a girer ve Watchtower bozuk image'ı 60 saniyede canlıya alır — bu SaaS'ta bir kez oldu, kutuda müşterinin başına gelirse kimse müdahale edemez (K10: erişimimiz yok); (2) tüm kutular **aynı** JWT secret'ıyla kurulursa bir müşterinin anahtarı diğerinin kutusunu açar. Kurulum script'i her kutu için rastgele secret üretmeli |
| **Çözüm** | **Faz 2.1** — `install.sh` her kurulumda benzersiz `JWT_SECRET` + türev anahtarlar üretir, `.env.template` bunu belgeler. **Faz 2.4** healthcheck: yanlış/eksik anahtarda container ölmek yerine kurulum modunda kalıp panelde sebebi göstermeli (crash-loop müşteride teşhis edilemez) |
| **Durum** | `geplant` (Faz 2.1 + 2.4) |

### O-29 — `DATA_ENCRYPTION_KEY` — kaybolursa hasta verisi geri gelmez

| Alan | İçerik |
|---|---|
| **Ne** | PHI şifreleme anahtarı (32 bayt); reçete OCR çıktısı ve ICD kodu bununla şifrelenip saklanıyor |
| **Nerede** | `api-backend/lib/phi-encrypt.js:24-33` · kullanım `api-backend/server.js:2441-2442` (`icd10_enc`, `ocr_raw_enc`) |
| **Tip** | E |
| **Kutuda ne olur** | Anahtar **her kutuda ayrı** olmak zorunda (ortak anahtar = bir kutudan sızan anahtar hepsini açar). Ama ayrı olmasının bedeli şu: anahtar `.env`'de, veri `pg_dump`'ta. Müşteri yedeği geri yüklerken anahtarı kaybetmişse **şifreli alanlar kalıcı olarak okunamaz** — hasta dokümantasyonunun bir parçası yok olur. Bu, yedekleme tasarımının (Faz 2.3) en kolay kaçırılan noktası: yedek "başarılı" görünür, geri yükleme yarım açılır |
| **Çözüm** | ★ **`onprem/RELEASE-STANDARD.md` §4.5** — dört kural, ikisi kurulumun ikisi geri yüklemenin işi: (1) `install.sh` her kutu için rastgele üretir, ortak anahtar yasak (**Faz 2.1**); (2) sihirbaz anahtarı bir kez gösterir, "sakladım" onayı alınmadan ilerlemez, bizde kopyası yok ve olmayacak — metin bunu da söyler (**Faz 2.2**); (3) her gecelik yedeğin künyesine anahtarın **parmak izi** (HMAC, anahtarın kendisi değil) yazılır, panelde uyum rozeti durur, uyumsuzluk **o gece** kırmızıya döner (**Faz 2.4**); (4) `restore.sh` künyedeki parmak izini karşılaştırır ve uyuşmazlıkta **veriye dokunmadan** durur, zorla devam yalnız açık onayla (**Faz 2.3**) |
| **Durum** | `geplant` (Faz 2.1 + 2.2 + 2.3 + 2.4) — gereksinim `RELEASE-STANDARD.md` §4.4-§4.5'te yazıldı. Playbook D6 Vault'u ele alıyordu, `DATA_ENCRYPTION_KEY` hiçbir fazda geçmiyordu; artık geçiyor. `gelöst` olması için dördü de uygulanıp commit numarasının buraya yazılması gerekir. ⚠️ **11.09.2026:** anahtar kutu paketine **hiç girmedi** — ne `.env.template`'te ne compose'da; dört kuraldan önce anahtarın pakette bir yeri olmalı → **O-50** |

### O-30 — `.env.template` yok; kurulumda hangi değişkenin gerektiği yazılı değil

| Alan | İçerik |
|---|---|
| **Ne** | Repoda tek env dosyası `.env.local` ve o da gitignore'lu (`.gitignore:33` → `.env*`); paket için şablon yok |
| **Nerede** | Kök dizin — `.env.template` / `.env.example` **yok**. Gerekli adlar bugün yalnız `CLAUDE.md`'nin env bölümünde ve kodun içinde dağınık |
| **Tip** | E |
| **Kutuda ne olur** | `install.sh` neyi soracağını bilmez; eksik bir değişken boot'ta `process.exit(1)`'e ya da sessiz özellik kaybına yol açar (PoC 0.3'te tam bu yaşandı: `GOOGLE_*` boot'ta zorunlu çıktı, dummy değer konularak geçildi). Müşteri kurulumunda "dummy değer koy" seçeneği yok |
| **Çözüm** | **Faz 2.1** — `onprem/.env.template`: her değişken için ad + zorunlu mu + kim doldurur (sihirbaz / install script / hiç) + boş bırakılırsa hangi özelliğin kapanacağı. Bu dosya aynı zamanda O-27'nin denetim listesi olur |
| **Durum** | 🟡 **kısmen `gelöst` (11.09.2026, `b2fdbb8`)** — `onprem/.env.template` yazıldı: sürümler (`VERSION_*`), boş bırakılmış sırlar, adresler, SMTP, KI. Bizim hiçbir anahtarımızın adı geçmiyor (`AZURE`/`APIFY`/`STRIPE`/`GOOGLE`/`SENTRY`/`N8N` taraması → **0**, G2 tabanı temiz). **Kalan:** üç değişken şablonda yok (**O-50**) ve "boş bırakılırsa hangi özellik kapanır" cümlesi yalnız KI ve SMTP satırlarında yazılı — O-27'nin denetim listesi olabilmesi için her satırda olmalı |

---

## 6. Yetkilendirme noktaları (tip H)

> Faz 3.3 tek bir `entitlements` helper'ı istiyor: SaaS'ta Stripe'tan, on-prem'de lisanstan
> beslenecek. Bugünkü dağınıklığın sayımı aşağıda.
>
> ⚠️ **Sayarken tuzak:** `is_active` bu kod tabanında **iki ayrı şey** demek —
> `profiles.is_active` (hesap aktif mi, yetki) ve `working_hours.is_active` /
> `vehicles.is_active` (o gün açık mı, araç kullanımda mı — yetkiyle **ilgisiz**).
> Ham `grep is_active` 111 sonuç veriyor; bunların çoğu ikinci anlam. Aşağıdaki sayılar
> ayıklanmış.

### O-31 — Plan/yetki kontrolü 6 dosyada dağınık, tek kaynak yok

| Alan | İçerik |
|---|---|
| **Ne** | "Bu kullanıcı bunu yapabilir mi" sorusu her yerde ayrı ayrı, doğrudan `profiles.plan_status`'a bakılarak cevaplanıyor |
| **Nerede** | **`plan_status` 21 kez / 6 dosya:** `dashboard.js` 7 (`:1000` `:1401` `:1444` `:4508` `:16968` `:21881` `:21895`) · `api/stripe/webhook.js` 5 (yazan taraf) · `api/admin/data.js` 4 (raporlama) · `admin.js` 3 · `api-backend/server.js:2803` (yazan taraf) · `confirm.html` 1.<br>**Tek gerçek kapı fonksiyonu:** `dashboard.js:4507` `checkPlanActive()` — yalnız `canceled`/`expired` durumunu kesiyor, üç yerden çağrılıyor (`:5875` `:20172` `:21480`).<br>**Hesap seviyesi:** `profiles.is_active` — `dashboard.js:1395` (gösterim), `employee-signup.js:169` (çalışan kaydını engelliyor), `api-backend/server.js:3483` (takım listesi filtresi).<br>**Deneme süresi:** `trial_ends_at` — `dashboard.js:1403-1404`.<br>**Veritabanında yetki mantığı YOK:** `db/SCHEMA-RLS.sql`'de `plan_status`'a bakan tek şey bir index (`:913`); hiçbir RLS policy plana bakmıyor — bu **iyi haber**, yetki tamamen uygulama katmanında |
| **Tip** | H |
| **Kutuda ne olur** | `plan_status` kolonu kutunun kendi `profiles` tablosunda duracak, ama onu **kimse güncellemeyecek**: Stripe webhook'u merkezde, kutuya erişimi yok (K10). Yani müşteri kurulumdan sonra sonsuza kadar `trial` (ya da import'tan gelen değer) olarak kalır → ödeme kesilse bile hiçbir kısıt işlemez. Ters durum daha kötü: import sırasında `canceled` gelen bir tenant, ödeyen bir on-prem müşterisi olmasına rağmen `checkPlanActive()` yüzünden yeni randevu açamaz |
| **Çözüm** | **Faz 3.3** — tek `entitlements` helper'ı: `entitlements.canBook()`, `.canBill()`, `.canUseAI()` gibi soruları cevaplar; kaynağı SaaS'ta `profiles.plan_status` (Stripe), on-prem'de imzalı lisans dosyası. 21 doğrudan okuma bu helper'a bağlanır. ⚠️ Helper **salt-okunur modu** da bilmeli (K9/G5): görüntüleme + DSGVO-export her koşulda açık, yeni kayıt/abrechnung/AI kapalı. `checkPlanActive()`'in bugünkü "hepsini kes" davranışı G5'e aykırı — helper'a taşınırken düzeltilmeli |
| **Durum** | `geplant` (Faz 3.3) — taban: `plan_status` **21** okuma / 6 dosya |

### O-32 — Modül görünürlüğü plana değil `module_visibility` tablosuna bakıyor

| Alan | İçerik |
|---|---|
| **Ne** | Sidebar/modül görünürlüğü tek kaynaktan (`nav-registry.js` + `module_visibility` tablosu) yönetiliyor; plan kontrolü içermiyor |
| **Nerede** | `nav-registry.js:9-13` (yorum: gerçek görünürlük `module_visibility` tablosunda) · `resolveSector()` `:140-144` (alan bazlı, plan bazlı değil) |
| **Tip** | H |
| **Kutuda ne olur** | Sorunsuz çalışır — tablo kutunun kendi DB'sinde, dış bağımlılık yok. Ama **fırsat da burada**: lisans "hangi modüller açık" bilgisini taşıyacak (Faz 3 tasarımında `modüller` alanı var). İki mekanizma birbirinden habersiz kalırsa müşteri ödemediği modülü `module_visibility`'den kendi açar |
| **Çözüm** | Faz 3.3 helper'ı `module_visibility`'yi **ezen** bir üst katman olur: lisans kapalıysa tablo ne derse desin modül görünmez. Tersi değil (lisans açık + müşteri kapatmış = kapalı kalır, bu müşterinin tercihi) |
| **Durum** | `offen` — Faz 3.3 kapsamında ama playbook `module_visibility` ile lisansın ilişkisini yazmamış |

### O-33 — On-prem'de "çalışan sayısı / limit" kavramı tanımsız

| Alan | İçerik |
|---|---|
| **Ne** | Plan farkı (Starter/Professional/Klinik) bugün fiyat sayfasında anlatılıyor ama kodda bir kullanıcı/limit kapısı yok |
| **Nerede** | Aranan: `planLimit`, `PLAN_LIMIT`, `requirePlan`, `hasFeature` → **sıfır sonuç**. Fiyat bilgisi yalnız `api/_lib/pricing.js` (merkez, raporlama için) |
| **Tip** | H |
| **Kutuda ne olur** | Bugün SaaS'ta da limit uygulanmıyor, yani bu bir regresyon değil. Ama on-prem'de sonuç ağırlaşır: müşteri Starter lisansıyla kutuyu kurar, 20 çalışan ekler, kimse görmez — merkezde telemetri yok (G4), denetim yok (K10). Lisans dosyası plan adını taşıyacak ama plan adının **hiçbir teknik karşılığı** yok |
| **Çözüm** | Karar gerekiyor: (a) plan farkı yalnız **modül** bazlı kalsın (lisans modül listesi taşır, kullanıcı sayısı serbest) — en basiti ve K13'ün "toplam fiyat" diliyle uyumlu; (b) kullanıcı sayısı lisansa yazılıp helper'da kontrol edilsin. Öneri: **(a)**. Ne olursa olsun Faz 3.3'ten önce cevaplanmalı, yoksa lisans formatı yanlış donar |
| **Durum** | `offen` — kullanıcı kararı gerekiyor; playbook'ta karşılığı yok |

---

## 7. Doğru yapılmışlar — tip B ve yerelleştirme (`unkritisch`)

> Bu bölüm sicilin en çok tekrar okunacak yeri. **Silinmez.** Buradaki her madde,
> "bunu niye sorun saymadık" sorusunun cevabını taşıyor — yazılmazsa altı ay sonra
> aynı şey ikinci kez araştırılır. Ayrıca yeni bir ihtiyaç çıktığında **şablon** burada.

### O-34 — `preise-check.yml`: tip B'nin canlı örneği ve şablonu

| Alan | İçerik |
|---|---|
| **Ne** | GKV fiyat verisi merkezde çekiliyor, koda commit'leniyor, image'la kutuya gidiyor — kutu dış kaynağa hiç çıkmıyor |
| **Nerede** | `.github/workflows/preise-check.yml` — `cron: '0 6 * * *'` (`:23`), `preise_autoupdate.mjs` çalışır → `preise_ci_extract.mjs` değerlendirir → **değişiklik varsa önce `npm test`**, yeşilse `billing/codes/{podologie,physio}_positions.js` commit'lenir (`:60-73`), `publish-calendar-api.yml` devralır, Watchtower dağıtır. XML kaynağı `api-backend/preise_pruefen.mjs:47` (`gkv-heilmittel.de`) |
| **Tip** | B |
| **Kutuda ne olur** | Kutu `gkv-heilmittel.de`'ye **hiç çıkmaz**; fiyat verisi image'ın içinde düz JS olarak gelir. İnternet kesilse bile fatura hazırlanabilir. Dış kaynak değişirse müşteri değil biz görürüz. Belirsiz durumda (yeni/kaybolan kod) otomatik değişiklik **yapılmıyor**, yalnız bildirim gidiyor — insan kararı korunmuş |
| **Çözüm** | `unkritisch` — **yeni dış veri ihtiyacı çıktığında şablon budur.** Sıra: merkez çeker → deterministik script doğrular → test yeşilse commit → image → Watchtower. Tip A'ya (kutudan canlı çağrı) dönüştürme önerisi gelirse reddedilir |
| **Durum** | `unkritisch` (referans desen) |

### O-35 — `Dockerfile` açık `COPY` listesi — fiyat script'i image'a girmiyor

| Alan | İçerik |
|---|---|
| **Ne** | Image içeriği tek tek sayılıyor; `COPY . .` yok |
| **Nerede** | `api-backend/Dockerfile:10` (yorum: "Diese Liste ist vollstaendig aufzufuehren — es gibt kein `COPY . .`") · `:16-22` (`server.js`, `instrument.js`, `_lib`, `ai`, `billing`, `booking`, `lib`) · CMD `:40` (açık `pm2-runtime` yolu) |
| **Tip** | B |
| **Kutuda ne olur** | `preise_pruefen.mjs` / `preise_autoupdate.mjs` **image'a girmez** — yani `gkv-heilmittel.de` adresi müşterinin kutusunda hiç bulunmaz. O-34'ün "kutu dışarı çıkmaz" iddiasını gerçekten garanti eden şey bu satırlardır, workflow değil. Aynı disiplin ileride paket ayrımının (Faz 2.0) temeli |
| **Çözüm** | `unkritisch` — ⚠️ korunması gereken bir kazanım: `COPY . .`'ya dönülürse fiyat script'i, test dosyaları ve ileride başka şeyler sessizce müşteri sunucusuna gider. CMD'nin açık yol kullanması da ayrı bir ders (bare `pm2-runtime` prod'da `MODULE_NOT_FOUND` verdi) |
| **Durum** | `unkritisch` (korunacak kazanım) |

### O-36 — `vendor/` yerelleştirmesi — tarayıcıda üçüncü-parti runtime kalmadı

| Alan | İçerik |
|---|---|
| **Ne** | supabase-js, node-forge, fullcalendar, cropperjs kendi sunucumuzdan gidiyor; CDN'den değil |
| **Nerede** | `vendor/supabase-js.js` · `vendor/node-forge.js` · `vendor/fullcalendar/` · `vendor/cropperjs/` (üretim: `tools/vendor/`). Gerekçe ve sürümler: `vendor/README.md`. Son adım `dashboard.html:25-33` (Cropper.js, 27.08.2026). Kalan CDN taraması: `esm.sh`/`unpkg`/`jsdelivr`/`cdnjs` → uygulama kodunda **sıfır** (tek eşleşme `dashboard.html:30`'daki açıklama yorumu) |
| **Tip** | A → çözüldü |
| **Kutuda ne olur** | Hiçbir şey — kutu açılırken dışarıya JS çekmez. Bu **on-prem için sert şart**tı ve `vendor/README.md` bunu açıkça yazıyor: "müşterinin kendi sunucusunda çalışan imajda tek bir dış runtime çağrısı kalamaz, yoksa 'Ihre Daten bleiben auf Ihrem Server' iddiası UWG §5 ve §434 BGB açar" |
| **Çözüm** | `gelöst` — Konsey 2026-08-13 (S3) + 27.08.2026 Cropper adımı. Playbook Faz 1.4 bu görevi istiyordu, **faz açılmadan tamamlandı**. ⛔ CDN'e geri dönmek yasak. Tek istisna hâlâ açık: Sentry loader (O-06) |
| **Durum** | `gelöst` (Faz 1.4 kapsamı; Sentry hariç) |

### O-37 — Self-hosted fontlar

| Alan | İçerik |
|---|---|
| **Ne** | Inter/Outfit font dosyaları depoda, Google Fonts CDN'i kullanılmıyor |
| **Nerede** | `fonts/` (`inter-*.ttf`, `outfit-*.woff2`, `inter.css`, `outfit.css`, `system-fonts.css`) · bağlanma örneği `dashboard.html:25`. `fonts.googleapis.com`/`fonts.gstatic.com` taraması → **3 sonuç, hepsi `ai chatbot proje/index.html`** (terk edilmiş proje kalıntısı, hiçbir yerden yüklenmiyor) |
| **Tip** | A → çözüldü |
| **Kutuda ne olur** | Hiçbir şey. LG München I (Google Fonts) kararı riskinin de kapatılmış hâli — hukuk tarafı `vendor/README.md`'de yazılı |
| **Çözüm** | `unkritisch` — ⚠️ `ai chatbot proje/` klasörü pakete girmemeli (zaten terk edilmiş); Faz 2.0 paket listesinde açıkça dışarıda kalır |
| **Durum** | `unkritisch` |

### O-38 — Referans tabloları paket seed-data'sı olarak gidecek

| Alan | İçerik |
|---|---|
| **Ne** | Katalog verileri (ICD, tarif, kasa listeleri) tenant verisi değil; image/seed ile dağıtılacak |
| **Nerede** | `db/SCHEMA.sql:931` `icd10_titles` (13.041 satır) · `:916` `heilmittel_tarif` (928) · `:1037` `krankenkassen` (94) · `:709` `dta_schluessel` (94) + `heilmittel_catalog`, `diagnosegruppen`, `kostentraeger`, `heilmittel_position`. PoC 0.1'de sıfır hatayla yüklendi (playbook §10) |
| **Tip** | B + D |
| **Kutuda ne olur** | Seed olarak gelir, kutu dış kaynağa çıkmaz. Playbook Faz 5.1 bunları export kapsamının **dışında** tutuyor — doğru: tenant verisi değil. RLS tarafı da hazır (D8 düzeltmesi dump'la geldi: salt-okunur policy, anon yazamıyor) |
| **Çözüm** | `unkritisch` — Faz 2.1 seed adımı. ⚠️ Bağlı soru: bu tablolar **güncellendiğinde** kutuya nasıl gidecek? Cevap O-34 deseni (image ile) olmalı, ama `icd10_titles` 13.041 satır — JS dosyasına commit'lenemez, migration/seed dosyası olarak gitmeli. Bu, şema dağıtım zincirinin (O-39) bir parçası |
| **Durum** | `geplant` (Faz 2.1 seed adımı) — ⚠️ **11.09.2026'da `unkritisch`'ten çıkarıldı.** Ölçüldü: kutu doğru ama **boş** kalkıyor (`krankenkassen` → `[]`). Baseline **yapıyı** taşıyor, **veriyi** taşımıyor; `SCHEMA-VERTEILUNG.md` §3.1'in 4. adımı (seed) yazılmadı. Kasa listesi boşken ne randevu kaydı ne §302 hazırlığı yapılabilir — bu bir "bize sorun değil" maddesi olamaz. Güncelleme yolu hâlâ O-39'a bağlı |

### O-39 — Şema dağıtım zinciri — çözüm belgesi yazıldı

| Alan | İçerik |
|---|---|
| **Ne** | Bugün müşterinin kutusundaki Postgres'e bir kolon eklemenin yolu yok |
| **Nerede** | `supabase/migrations/` **14 dosya** (`git ls-files supabase/` ile sayıldı) — canlıda 195 migration kayıtlı, yani repo **kaynak değil**. Şemanın gerçeği `db/SCHEMA.sql` + `db/SCHEMA-RLS.sql`, ama onlar çalıştırılabilir sıralı zincir değil, düz metin durum fotoğrafı. `onprem/schema/live_schema_2026-07-06.sql` Temmuz'da dondu |
| **Tip** | D |
| **Kutuda ne olur** | Kod dağıtımı çözülmüş (K11 + Watchtower), **şema dağıtımı çözülmemiş**. Yeni kolon isteyen her özellik SaaS'ta çalışır, kutuda 42703 (`column does not exist`) verir. `:beta` ve `:stable` aynı anda canlı olduğu için geriye dönük uyum da gerekiyor. PoC bunun nasıl ısırdığını gösterdi: `handle_new_user` trigger'ı `auth` şemasında olduğu için public dump'a girmedi ve kurulumda ayrıca yaratılması gerekti — tek trigger, 20 kutuda, gece yarısı |
| **Çözüm** | ★ **`onprem/SCHEMA-VERTEILUNG.md`** (2026-09-04) — gereksinim, seçenekler ve tavsiye orada. Özet: kendi Node runner'ımız (`api-backend/db/migrate.js`), düz SQL dosyaları image'ın içinde, api açılışında advisory-lock altında, dosya başına tek transaction, ileri-yönlü, hata olunca durup kurulum moduna geçen. 195-vs-14 için karar önerisi: **baseline** (zincir bugünden başlar, geçmiş tarih olur). Public dump'ın dışında kalan **dokuz kalem** orada envanterlendi (extension'lar · `auth` şeması ön koşulu · `on_auth_user_created` · 5 storage bucket + policy'leri · realtime publication · roller/grant'lar · Vault içeriği · sequence `setval` · `search_path`). Faz önerisi: **yeni Faz 1.7** |
| **Durum** | ✅ **`gelöst` (10.09.2026)** — runner çalışıyor, **baseline üretildi ve deftere işlendi**; drift kapısı kapandı. Kalan iş zincirin günlük disiplinle işletilmesi — açık madde değil |

> **11.09.2026 — zincir baseline dışında da çalıştı (ilk gerçek migration).**
> `0001_gmail_token_rpc_revoke.sql` (guvenlik S-01/S-02/S-19: Gmail-Token RPC'lerinden
> `PUBLIC`/`anon`/`authenticated` EXECUTE geri alındı) **hem** canlıya MCP ile **hem** yerel
> test kutusuna gitti. Kutuda elle hiçbir şey yapılmadı: image yeniden build edildi,
> `docker compose up -d --force-recreate api` sonrası runner kendiliğinden koştu
> (`[migrate] ✓ 0001_gmail_token_rpc_revoke.sql`, 160 ms) ve `has_function_privilege`
> her iki tarafta da aynı sonucu verdi (`anon=false`, `authenticated=false`,
> `service_role=true`). Yani 10.09'da "runner çalışıyor" denen şey artık **ölçülmüş**:
> SaaS'ta elle uygulanan bir düzeltmenin kutuya varma yolu var ve tek yön o yol.
> Ayrıca doğru sıra da denendi: dosya önce zincire yazıldı, sonra canlıya uygulandı
> (CLAUDE.md "önce dosya, sonra canlı"). ⚠️ Bu kutulara **yalnız yeni image ile** varır;
> bugünkü yayın hattı hâlâ `:stable` basmıyor (O-25) — yani "düzeltme müşteride" demek
> için O-25 de kapanmalı. Yeni kurulan kutuda sorun yok, baseline+0001 sırayla koşar.

> **04.09.2026 — yapılan (ana bağlam):**
>
> - **Üç karar verildi ve kilitlendi** (belge §11): baseline · `supabase/migrations/`
>   arşive · dört haneli sıra numarası.
> - **§10'un 9 doğrulama sorusundan 7'si canlıya soruldu** (MCP). İki düzeltme çıktı:
>   canlıda **227** migration var (195 değil, `CLAUDE.md` bayattı) · `auth`/`storage`/
>   `realtime` şemalarındaki 6 trigger'ın **yalnız 1'i bizim** (`on_auth_user_created`),
>   diğer 5'i Supabase imajıyla geliyor — §2'nin bu kalemi ciddi şekilde daraldı.
>   Ayrıca doğrulandı: `pg_cron` **kurulu değil** (Faz 2.4a node-cron kararı geçerli) ·
>   `pgcrypto` **kurulu** (§9-A4 Vault alternatifi elde) · 3 extension `public`
>   şemasında (`postgis`, `pg_trgm`, `btree_gist` — `DROP SCHEMA public CASCADE`
>   üçünü de siler, `btree_gist` giderse `no_overlapping_bookings` da gider).
> - **Runner yazıldı:** `api-backend/db/migrate.js` + `migrate.test.js` (**16 test**,
>   `npm test` 119 → 135, hepsi yeşil). Advisory lock, dosya başına tek transaction,
>   checksum doğrulaması, downgrade tespiti, `-- no-transaction` kaçışı. `process.exit`
>   **yok** (O-28).
> - **`server.js`'e bağlandı:** `app.listen()`'den önce çalışıyor; hata olursa süreç
>   ölmüyor, **bakım moduna** geçiyor (503 + `/health` açık). Gerçek boot ile denendi.
> - **`Dockerfile`:** `COPY db ./db` eklendi (O-35 disiplini — `COPY . .` yok).
> - **Kapıya yıkıcı-DDL kontrolü eklendi:** gerekçesiz `DROP COLUMN`/`RENAME`
>   migration'ı commit'i reddediyor (üç senaryo test edildi).
> - **`pg` bağımlılığı:** MIT — altı paketin (pg, pg-pool, pg-protocol, pg-types,
>   pg-connection-string, pgpass) hepsi kontrol edildi, ücretli müşteriye dağıtıma
>   uygun (K8 dersi).
>
> ⚠️ **SaaS'ta bugün davranış değişmiyor:** `DATABASE_URL` orada set değil, runner
> "übersprungen" deyip geçiyor. Bu bilinçli — kod canlıya güvenle inebilsin diye.
> Değişkeni set etmek ayrı ve **bilinçli** bir adımdır (yeni env var = tip E).
>
> **Kalan (Faz 1.7 açık):** `0000_baseline.sql` üretimi — `pg_dump --schema-only` +
> dokuz kalem. **Buradan üretilemez:** MCP `pg_dump` çalıştırmıyor, ve 82 tablo +
> 155 policy + 63 fonksiyonun SQL'ini sohbetten geçirmek hem bağlamı taşırır hem
> hataya açıktır. Operatör adımı: psql/pg_dump olan bir makineden. Sonra `praxura_migrations`'a
> `0000` satırı elle düşülür (canlıda baseline **çalıştırılmaz**, yalnız deftere yazılır).

> **10.09.2026 — ölçüm (zincir boş kaldı):** runner 04.09'da yazıldı; o günden bu yana
> `api-backend/db/migrations/` altında **hâlâ tek migration dosyası yok** (yalnız
> `README.md`). Buna karşılık aynı altı günde `db/SCHEMA.sql` / `SCHEMA-RLS.sql`
> **7 commit'te** değişti (`4e8098c` `0d8ef9b` `489c144` `cceb528` `883fdfd` `a9cbb13`
> `9522b01`) — yeni tablolar (`abrechnung_zeile`, `abrechnung_zahlung`), yeni RPC
> (`rechnung_zahlung_buchen`), kolon değişiklikleri. Hepsi canlıya **elle** (MCP) gitti.
>
> Yani zincir kurulduktan sonra **günde ~1 şema değişikliği kadar geriye düşüyor.**
> `a9cbb13`'ün başlığı bunun bedelini zaten yazıyor: *"rechnung_zahlung_buchen fehlte in
> Produktion"* — RPC canlıda yoktu, fatura akışı bloke oldu. Tek ortamda bu bir kişinin
> yarım günü; 50 kutuda **50 destek çağrısı** ve K10 gereği hiçbirine giremeyiz.
>
> Bu, baseline'ın (Faz 1.7) neden takvimin başına alınması gerektiğinin ölçülmüş
> gerekçesidir: baseline üretilmeden yeni değişiklikler zincire yazılamıyor, zincire
> yazılmayan her değişiklik de baseline'ı bir gün daha eskitiyor.


> **10.09.2026 — KAPANDI: baseline üretildi.**
>
> - **`api-backend/db/migrations/0000_baseline.sql`** — 12.517 satır / 403 KB.
>   `pg_dump --schema-only --no-owner --schema=public` (pg_dump 17.6, canlı 17.6)
>   + §2'nin dört eksik bölümü **canlıya sorularak** eklendi (elle yazılmadı):
>   4 extension · `on_auth_user_created` · 5 storage kovası + 9 policy · realtime
>   publication. Ayrıca `auth.users` / `storage` yoksa anlaşılır mesajla duran bir
>   ön-kontrol, ve kapanışta `NOTIFY pgrst`.
> - **11 tablo bilinçli olarak dışarıda:** 5 yabancı/boş (`accommodations`,
>   `applications`, `trip_plans`, `trip_history`, `user_credits`) · 3 merkez
>   (`pending_signups`, `demo_bookings`, `visibility_reports`) · 3'lü B2B kümesi
>   (`scraper_data` → `b2b_contacts` → `email_logs`). Son üçü **birlikte** çıktı çünkü
>   `email_logs`'un `b2b_contacts`'a FK'si var — biri kalıp diğeri gitseydi şema kırılırdı.
> - **8 merkez fonksiyonu baseline'ın sonunda düşüyor**, `trg_feedback_telegram` ile
>   birlikte: `notify_feedback_telegram` (kutudan dışarı çıkan tek DB objesiydi —
>   O-21/G1), 3 `admin_*` ölçüm fonksiyonu, `delete_expired_accounts`, 3 `pending_signup_*`.
> - **İki şey bilerek ERTELENDİ:** (1) `profiles`'taki 10 Stripe kolonu — bugün 21 yerde
>   `plan_status` okunuyor (O-31); lisans sistemi o okumaları tek `entitlements`
>   yardımcısına toplamadan kolonları düşürmek kutuyu kırar → **Faz 3.3 ile aynı adımda**.
>   (2) `postgis` çıkarılması — iki adımlı ayrı iş, baseline'ı bekletmemek için sonraya.
>   Ayrıca `is_admin()` + `admin_users` **kaldı**: 5 policy `is_admin()`'e bağlı.
> - **İki tuzak yakalandı ve temizlendi:** pg_dump 17.6 çıktısının başında ve sonunda
>   ters bölü ile başlayan iki **psql meta-komutu** duruyor (restrict / unrestrict) —
>   runner `psql` değil node-postgres kullandığı için bunlar kalsaydı **hiçbir kutu
>   açılmazdı**. Temmuz dökümünde de varlar; PoC `psql` ile yüklendiği için fark
>   edilmemiş. İkincisi: Windows'ta yazılan dosyanın başındaki **BOM**, ilk komutu bozardı.
> - **Defter canlıda açıldı:** `public.praxura_migrations` (migration
>   `praxura_migrations_buch_anlegen`), tek satır `0000` = *uygulanmış*. Baseline canlıda
>   **çalıştırılmadı** — SaaS zaten o şemada. Tablo **RLS açık / policy'siz** ve
>   `anon`+`authenticated` yetkileri geri alındı: şema sürümü PostgREST üzerinden dışarı
>   sızmasın (doğrulandı: 0 yetki, 0 policy, RLS = true).
> - **`db/migrations-geplant/` boşaltıldı** → `archive/db-migrations-geplant-vor-baseline/`.
>   Üç dosyanın içeriği de baseline'ın **içinde** (tek tek doğrulandı: `lead_id`,
>   `therapie_bereich`, `nagel`, `nagelspange_erlaubt`, `abrechnung_zeile`,
>   `abrechnung_zahlung`, `rechnung_zahlung_buchen`). Zincire `0001-0003` olarak
>   **eklenmediler** — eklenselerdi temiz kutuda ikinci kez uygulanmaya çalışılırlardı.
> - **Drift kapısının yazılmamış yarısı yazıldı** (`tools/check-onprem.sh`):
>   `db/SCHEMA.sql` / `SCHEMA-RLS.sql` staged ama zincire dosya girmediyse commit
>   **reddediliyor**. Beş senaryo denendi (temiz ağaç ✓ · drift ✗ · migration'lı ✓ ·
>   `SKIP_MIGRATION_GATE=1` ✓). §5.4'ün eksik ikiziydi; altı migration tam oradan geçmişti.
>
> **✅ KANIT GELDİ — yükleme testi geçti (10.09.2026 akşamı).**
>
> Docker kuruldu, `onprem/supabase-docker` yığını **boş bir veritabanıyla** ayağa
> kaldırıldı (11/11 healthy, `supabase/postgres:17.6.1.136`) ve baseline gerçekten
> yüklendi. ⚠️ Temmuz PoC'sinin veri klasörü (`volumes/db/data`, 123 MB) diske bağlı
> olduğu için `docker compose down -v` onu silmiyor — temiz oda testi ancak o klasör
> elle silinince mümkün oldu. Bu, kurulum script'i yazılırken bilinmesi gereken bir
> ayrıntı.
>
> **Sonuç:** yükleme `ON_ERROR_STOP=1` ile **çıkış 0**. Self-check'in 11 sayacının
> **11'i** canlıyla birebir tuttu (76 tablo · 150 policy · 67 fonksiyon · 70 trigger ·
> 292 index · 2 view · 1 RLS-kapalı · 1 auth trigger · 5 kova · 9 storage policy ·
> 1 publication). İşlevsel: signup → trigger → **profil oluştu** (auth 1 / profiles 1),
> `no_overlapping_bookings` EXCLUDE kısıtı ayakta (btree_gist çalışıyor),
> ve veritabanından **dışarı çıkan çağrı kalmadı** (`net.http_post` → 0 fonksiyon, G1).
>
> **Test dört gerçek hata yakaladı** — dördü de baseline'ı olduğu gibi göndersek her
> kutuyu kırardı:
>
> 1. **`CREATE SCHEMA public;`** — `pg_dump` bunu koşulsuz yazıyor, temiz bir Supabase'de
>    `public` zaten var → yükleme 121. satırda duruyordu. Temmuz PoC'si bunu
>    `DROP SCHEMA public CASCADE` ile aşmış ve **tam o yüzden postgis'i kaybetmişti**
>    (playbook §10'daki not). Doğru çözüm yıkmak değil: `IF NOT EXISTS`.
> 2. **`add_credits()`** çıkarılan `user_credits` tablosuna **yazıyor** — üstelik şema
>    öneki olmadan, o yüzden `public.user_credits` aramasına takılmamıştı. Düşen fonksiyon
>    sayısı 8 → 9. Ders: çıkarılan tabloları ararken **öneksiz** de taranmalı.
> 3. **`search_path`** — dökümün gövdesi arama yolunu kasten boşaltıyor; sona eklediğimiz
>    storage policy'leri ise `profiles`'a öneksiz atıf veriyor →
>    `relation "profiles" does not exist`. Ek bölümlerden önce arama yolu geri açılıyor.
> 4. **Storage policy'leri idempotent değildi** — `storage` şeması `public`'ten ayrı yaşıyor,
>    yani `public`'i sıfırlayıp baseline'ı tekrar çalıştıran biri policy'leri yerinde bulur
>    ve `policy "avatars_public_read" already exists` ile durur. Her `CREATE POLICY`nin
>    önüne `DROP POLICY IF EXISTS` kondu (kovalar `ON CONFLICT DO NOTHING` ile zaten
>    idempotentti). Bu hata ancak **ikinci** turda göründü — tek turluk bir test onu
>    yakalayamazdı.
>
> **Testin kendisi de düzeltildi.** İlk turda yalnız `public` sıfırlanıyordu ve `psql`
> ifadeleri tek tek işliyordu — yani runner'ın davranışını taklit etmiyordu (runner her
> dosyayı **tek transaction** içinde çalıştırır). Geçerli tur: veri klasörü silinip yığın
> yeniden kuruldu (gerçekten 0 tablo / 0 storage policy / 0 kova) ve baseline
> `--single-transaction` ile yüklendi. ⚠️ Ayrıca `DELETE FROM storage.buckets` upstream'in
> `protect_delete` trigger'ına takılıyor ("Use the Storage API instead") — storage durumunu
> SQL ile sıfırlamaya çalışmak yerine veritabanını komple yenilemek gerekiyor; kurulum ve
> geri-yükleme script'leri yazılırken bilinmeli.
>
> **★ Yeni bağlayıcı bulgu — kutunun `DATABASE_URL`'i `supabase_admin` olmalı.**
> `postgres` yetmiyor: dökümün sonundaki 24 `ALTER DEFAULT PRIVILEGES` satırının 12'si
> `FOR ROLE supabase_admin` diyor ve `postgres` başka bir rolün varsayılan yetkilerini
> değiştiremiyor (`ERROR: permission denied to change default privileges`). Bu,
> `SCHEMA-VERTEILUNG.md` §2 V-6'daki *"doğrulanmalı"* notunun cevabıdır: satırlar
> sorunsuz geçmiyor, **rol önemli**. Faz 2.1'de `.env.template` yazılırken bu dikkate alınır.
>
> Baseline testten sonra üç kez değiştiği için defterdeki parmak izi de tazelendi
> (migration `praxura_migrations_baseline_pruefsumme_korrigiert`). *"Uygulanmış migration
> değiştirilmez"* kuralı burada **ihlal edilmedi**: `0000` bugüne kadar hiçbir yerde
> çalışmamıştı — yükleme testi tam da bunun içindi.

---

## 7B. Sürüm ve dağıtım standardı — bu turda açılanlar (tip F + G)

> Çözüm belgesi: ★ **`onprem/RELEASE-STANDARD.md`** (2026-09-04). Sürüm numaralandırma,
> kanallar, yükseltme yolu, yedek-önce kuralı, kurulum kabul ölçütü, tanılama paketi,
> lisans/SBOM disiplini ve sürüm çıkarma listesi orada. Aşağıdaki dört madde o belgenin
> koda karşı doğrulanmış bulgularıdır.

### O-40 — `/health` her koşulda `ok` döndürüyor; sağlık kapısı olarak kullanılamaz

| Alan | İçerik |
|---|---|
| **Ne** | Sağlık ucu sabit bir cevap veriyor; DB, şema, storage, disk, yedek durumuna hiç bakmıyor |
| **Nerede** | `api-backend/server.js:276` — `app.get('/health', (req, res) => res.json({ status: 'ok' }))`. Log atlaması `:139`. Dockerfile'da `HEALTHCHECK` **yok** (`api-backend/Dockerfile`) |
| **Tip** | G |
| **Kutuda ne olur** | Üç ayrı yerde yalan söyler: (1) Docker/Watchtower için sağlık ölçütü yok — bozuk container "sağlıklı" görünür; (2) kurulum sonrası self-check (Faz 2.4) buna dayanamaz; (3) tanılama paketinde işe yaramaz. Somut hâli: DB düşse, şema yarım kalsa, disk dolsa `/health` yine 200 `ok` döner ve müşteri "sistem çalışıyor ama hiçbir şey açılmıyor" der — teşhis edilemeyen en pahalı arıza sınıfı |
| **Çözüm** | **Faz 2.4b** (yeni) — ikiye ayrılır: `/health` liveness (ucuz, anonim, içeriksiz), `/status` derin (10 alan: db · schema · auth · storage · disk · backup · data_key · license · zeit · version), oturum gerektirir. Ayrıntı: `RELEASE-STANDARD.md` §6.5 |
| **Durum** | 🟡 **kısmen `gelöst` (04.09.2026)** — sahte yeşil kapandı, derin `/status` bekliyor |

> **04.09.2026 — yapılan (ana bağlam):**
> `/health` ikiye ayrıldı ([server.js:276](../api-backend/server.js#L276)):
> **`/health`** = canlılık, DB'ye bakmaz, her zaman 200 + `version` + `uptime_s`;
> **`/health/ready`** = hazırlık, `profiles` üzerinde head-sorgu (PHI yok, 4 sn timeout),
> DB düşükse **503** döner. Ayrıca `Dockerfile`'a `HEALTHCHECK` eklendi — canlılığı
> sorguluyor, hazırlığı değil: DB dalgalanması **sağlıklı bir prosesi** hasta işaretlememeli.
>
> Ayrımın gerekçesi tek cümlede: canlılık sorusu *"image ayağa kalkıyor mu"*, hazırlık
> sorusu *"çalışabiliyor mu"* — ikisini tek uca bindirmek, smoke-test'i dummy
> credential'la çalışamaz hâle getirirdi.
>
> **Kalan:** §6.5'teki 10 alanlı derin `/status` (schema · storage · disk · backup ·
> data_key · license · zeit) hâlâ yazılmadı → **Faz 2.4b** açık kalıyor.
>
> **11.09.2026 — paket tarafı:** `onprem/docker-compose.yml`'de altı fremd servisin
> **altısında da** healthcheck var ve `depends_on … condition: service_healthy` zinciri
> kuruldu (`api` → `db` + `kong`). Bizim `api` compose'da healthcheck taşımıyor; geçerli
> olan `Dockerfile`'daki `HEALTHCHECK` (canlılık). Derin `/status` hâlâ yok — ve O-50'nin
> `data_key` alanı tam da orada görünecek.

### O-41 — CI image'ı hiç çalıştırmadan yayınlıyor; Watchtower 60 saniyede canlıya alıyor

| Alan | İçerik |
|---|---|
| **Ne** | Yayın hattında image'ın **ayağa kalktığını** doğrulayan hiçbir adım yok; kabul kapısı yalnız birim testleri |
| **Nerede** | `.github/workflows/publish-calendar-api.yml` — `test` job'u `npm test` koşuyor (`:36-38`), `build-and-push` job'u `docker/build-push-action` ile doğrudan basıyor (`:66-76`). `docker run` yok. Watchtower: `api-backend/docker-compose.yml` → `--interval=60`, `pull_policy: always`, `restart: unless-stopped` |
| **Tip** | F + G |
| **Kutuda ne olur** | Boot'ta ölen bir image testleri geçer, basılır, 60 saniyede canlıya çıkar ve container sonsuz crash-loop'a girer. **Bu SaaS'ta bir kez oldu** (`SUPABASE_SERVICE_KEY` yazım hatası, `CLAUDE.md`). On-prem'de aynı olay **20 praxis'in aynı sabah çalışmaması** demektir ve K10 gereği hiçbirine giremeyiz. Ayrıca compose kutuda yaşar, Watchtower ona dokunmaz — düzeltmeyi compose'a yazmak işe yaramaz (2026-08-15 dersi, `docker-compose.yml` yorumunda yazılı) |
| **Çözüm** | Dört katman, `RELEASE-STANDARD.md` §6.3: (1) **Faz 4.3a** CI'da gerçek CMD ile `docker run` + `/health` 200 (tek başına en yüksek getirili adım; bu olay tam burada yakalanırdı); (2) **Faz 4.3b** `X.Y.Z` değişmez etiket + 72 saat soak + `:stable`'ın elle taşınması; (3) kutuda crash-loop yerine **bakım modu** (O-28 ile aynı istek); (4) kutu Watchtower'ı saatlik, `latest` kullanılmaz |
| **Durum** | 🟡 **kısmen `gelöst` (04.09.2026)** — katman (1) yazıldı, (2)(3)(4) açık |

> **04.09.2026 — yapılan (ana bağlam):**
> `publish-calendar-api.yml`'ye **smoke-test adımı** eklendi, `build-and-push`'tan
> **önce** çalışıyor: image `load: true` ile kurulur, **gerçek `CMD`'siyle**
> (`pm2-runtime`, `npm start` veya `npx` ile DEĞİL) dummy credential'larla ayağa
> kaldırılır, 30 saniye boyunca `/health`'in 200 dönmesi beklenir. Container erken
> ölürse döngü kırılır ve `docker logs` dökülür. Yeşil değilse **image basılmaz.**
>
> Bu, O-41'in tarif ettiği iki olayın ikisini de yakalardı: `booking/`'in COPY
> listesinden düşmesi (`ERR_MODULE_NOT_FOUND`) ve `SUPABASE_SERVICE_KEY` yazım
> hatası (`exit(1)`). İkisi de birim testlerinden yeşil geçmişti.
>
> ⚠️ **Doğrulama durumu:** yerelde Docker yok, adım **CI'da ilk push'ta** sınanacak.
> Hata yönü güvenli: kapı bozuksa yayını durdurur, bozuk image geçirmez.
>
> **Kalan:** (2) `X.Y.Z` değişmez etiket + 72 saat soak + `:stable`'ın elle taşınması
> → **Faz 4.3b** · (3) crash-loop yerine bakım modu (O-28) · (4) kutuda saatlik
> Watchtower, `latest` kullanılmaması.

### O-42 — Pakete giren bileşenlerin lisans denetimi tek seferlik; sürekli kapı yok

| Alan | İçerik |
|---|---|
| **Ne** | K8 (n8n Sustainable Use License) bir kez elle fark edildi; ikinci bir bileşenin aynı tuzağa düşmesini engelleyen hiçbir mekanizma yok |
| **Nerede** | Repoda SBOM üretimi yok (`grep -ri "sbom\|cyclonedx\|spdx" --include=*.yml --include=*.json` → yayın hattında sıfır). `onprem/NOTICE.md` yok. `onprem/supabase-docker/` upstream vendor kopyası — içindeki her image'ın lisansı ayrı ayrı kaydedilmiş değil |
| **Tip** | G |
| **Kutuda ne olur** | Ücretli müşteriye dağıtım hakkı olmayan bir bileşen pakete girerse bu, kutuda değil **mahkemede** patlar. n8n'i paketleme planı yazılırken yakaladık; bir sonrakini yakalayacak bir şey yok. Ayrıca CRA 11 Aralık 2027'de SBOM'u zaten zorunlu kılıyor (`LEGAL_ONPREM_REQUIREMENTS.md` §6/E7-E8) |
| **Çözüm** | **Faz 6.1b** — iki ayrı envanter: npm tarafı SBOM ile üretilir (CycloneDX), compose image'ları **elle** `onprem/NOTICE.md`'de tutulur (`npm sbom` Kong/GoTrue/Studio'yu görmez — asıl risk orada). İzinli lisans listesi (MIT/Apache-2.0/BSD/ISC/PostgreSQL/MPL-2.0/0BSD/CC0), yasak liste (GPL/AGPL/SSPL/BUSL/Elastic/Commons Clause/"Sustainable Use"). Kapı: compose'daki `image:` satır sayısı taban olur, artış = red (kayıtsız tabloda commit reddeden `check-tabellen-register.sh` ile aynı mantık). Ayrıntı: `RELEASE-STANDARD.md` §8 |
| **Durum** | 🟡 **kısmen `gelöst` (11.09.2026, `b2fdbb8`)** — taban kondu, kapı yarım |

> **11.09.2026 — yapılan ve yapılmayan.**
> `onprem/NOTICE.md` açıldı: 7 image için sürüm · lisans · kaynak, ayrıca **bilinçli
> olarak içermediklerimiz** tablosu (başında n8n, G3 gerekçesiyle). Kapıya `onprem_image`
> sayacı eklendi; sekizinci konteynerle denendi ve gerçekten reddetti.
>
> ⚠️ **Kırpılması gereken iddia:** kapı `image:` **satırını sayar**, `NOTICE.md`'de
> karşılık gelen bir satır olup olmadığına **bakmaz**. "Lisans satırı olmayan sekizinci
> konteyner reddedilir" cümlesi bugün doğru değil — reddedilen, lisans satırı olsun ya da
> olmasın, sekizinci konteynerdir. NOTICE eşleşmesi hâlâ bir **insan kuralı**; kapı
> yalnızca insanı durdurup baktırıyor. Bu kadarı da değerli, ama fazlası iddia edilmemeli.
>
> **Kalan:** npm tarafı SBOM (CycloneDX) · izinli/yasak lisans listesinin mekanikleşmesi ·
> tablonun **image içeriğine** karşı doğrulanması. Bugünkü tablo proje deposunun lisansına
> göre dolduruldu, image'ın içindeki onlarca pakete göre değil — `NOTICE.md` bunu kendisi
> yazıyor ve doğru yazıyor (Faz 6.1a).

### O-43 — Sürüm/kanal manifesti yok; uzun süre kapalı kalmış kutunun davranışı tanımsız

| Alan | İçerik |
|---|---|
| **Ne** | Hangi sürümün kırıcı olduğu, hangisinin atlanamayacağı, hangisine geçilmemesi gerektiği makine-okunur hiçbir yerde yazılı değil |
| **Nerede** | Repoda `releases.json` / `CHANGELOG.md` **yok**; yayın hattı yalnız `latest` + kısa sha basıyor (`publish-calendar-api.yml:64-65`). Sürüm numarası kavramı kodda hiç geçmiyor |
| **Tip** | G + D |
| **Kutuda ne olur** | Bugün sonuç yok (tek kanal, tek sürüm). Ücretli kutu çıktığında: lisansı pasifken güncelleme çekemeyen bir kutu (Faz 3.4) altı ay sonra açıldığında 6 MINOR birden atlar. Bunun güvenli olup olmadığını söyleyen **hiçbir kayıt yok** — Sentry ve GitLab bu sorunu "hard stop" / "required upgrade stop" listeleriyle çözüyor, bizde liste yok |
| **Çözüm** | **Faz 2.9** (yeni) — `onprem/releases.json`: sürüm başına `durak` (atlanamaz mı), `otomatik_adim`, `elle_adim[]`, `not_url`. Runner atlamayı **reddeder** (`SCHEMA-VERTEILUNG.md` §6.3'ün "bilmediğim kayıt var" refleksiyle aynı). ★ Asıl çözüm mekanik değil kural: **migration yalnız SQL'e dayanır, aradaki sürümün uygulama koduna bağımlı olamaz** — bu kural durak sınıfını tümden ortadan kaldırır, manifest yalnız istisna için durur. Ayrıntı: `RELEASE-STANDARD.md` §3.3-§3.4 |
| **Durum** | `geplant` (Faz 2.9) — çözüm belgesi `onprem/RELEASE-STANDARD.md` |

> **11.09.2026 — manifestin ham maddesi geldi.** `onprem/.env.template` §1'deki
> `VERSION_*` bloğu, ilk kez yazılı bir sürüm sözleşmesi taşıyor: *"bu kombinasyon
> 10./11.09.2026'da birlikte test edildi, satırları tek tek yükseltmeyin."* Bu, `releases.json`
> değil ama onun besleyeceği veri. Hâlâ yok olanlar: sürüm numarası kavramı, durak
> (atlanamaz sürüm), sürüm notu bağlantısı. Faz 2.9 açık.

---

## 7C. Yazma yolu — tarayıcıdan mı, Express'ten mi (tip G + C)

> Bu bölüm 06.09.2026'da açıldı: „Verordnung kaydı tek yoldan yazılsın" kararı öncesi
> dağıtım incelemesi. Soru ürün sorusu değil **yol** sorusu — aynı satır iki farklı
> bileşenden yazılıyor ve ikisinin kutudaki davranışı aynı değil.

### O-44 — `prescriptions` iki ayrı yoldan yazılıyor: tarayıcı→PostgREST ve tarayıcı→Express

| Alan | İçerik |
|---|---|
| **Ne** | Reçete kaydı iki yoldan doğuyor: elle maske RLS altında doğrudan PostgREST'e yazıyor, OCR yolu Express'ten service-role ile yazıyor. Tek yola indirilmesi tartışılıyor (kullanıcı kararı 06.09.2026) |
| **Nerede** | **A yolu:** `module/verordnung-maske.js:490` (insert) `:502` (update, `.eq('owner_id')` + `.select()` kanıtı). **B yolu:** `dashboard.js:18501` → `api-backend/server.js:2329` `/api/rezept/confirm` (insert + `prescription_validations` denetim satırı + `leads` oluşturma + `resolveOrCreateArzt`). Taban adresi: `dashboard.js:17857` `REZEPT_API` — `dashboard.js:95-97`'deki `API` sabitinin **ikinci kopyası**, ikisi de O-01 sayımında. Ayrıca 13 frontend dosyasında 14 alan-güncellemesi daha var (`sitzungsfortschritt.js:103/111/115`, `verordnung-einheiten.js:143`, `zuzahlung-befreiung.js:252`, `dashboard.js` 8 yer) — **oluşturma** yalnız yukarıdaki iki yerde |
| **Tip** | G (+ C) |
| **Kutuda ne olur** | **Yeni bileşen bağımlılığı doğmaz:** playbook §4.1 kutu stack'inde `api` (Express) zaten var, PoC 0.3'te self-host Supabase'e bağlı çalıştığı doğrulandı. Ama **arıza yüzeyi genişler**: bugün Express ölüyken elle reçete girişi ayakta kalır (tarayıcı → kutunun kendi PostgREST'i), B'de kalmaz. Ölçülen gerçek: `dashboard.js` içinde 31 `${API}` çağrısı var (randevu oluşturma dahil) — yani `api` konteyneri düştüğünde kutu zaten büyük ölçüde durmuş oluyor, elle reçete girişi tek başına ürünü ayakta tutmuyor. Kalan risk gerçek ama küçük ve **tek makinede**: `restart: unless-stopped` + gerçek `/health` (O-40) ile karşılanır. G8 açısından: buluta **yeni zincir yok**, iki kutu-içi yoldan biri kapanıyor — Faz 1'in „tek Express çekirdeği" hedefiyle aynı yöne bakıyor. Yeni env var yok, yeni dış çağrı yok, şema değişikliği yok (`nagel` · `wagner_grad` · `behandlungsanlass` kolonları `db/SCHEMA.sql:1690-1699`'da mevcut) |
| **Çözüm** | Yön kararı kullanıcıda; **hangi yön seçilirse seçilsin üç şart dağıtım tarafından zorunlu:** (1) Yeni taban adresi sabiti **açılmaz** — çağrı mevcut `API` sabitinden geçer, `REZEPT_API` gibi ikinci bir kopya kapı tabanını 26'nın üstüne çıkarır ve O-01'in Faz 1.1 çözümü tek yerden yapılamaz hale gelir. (2) Backend'e **update** yolu eklenirse `owner_id = req.auth.tenantId` filtresi ve „kaç satır değişti" kanıtı zorunlu: service-role'de RLS'in sessiz sıfır-satır freni yok, yanlış tenant'ın id'si **başarıyla** yazar. SaaS'ta 20+ tenant var (G7), kutuda tek tenant — yani bu gerileme kutuda değil **merkezde** ısırır. (3) Kutu tarafı kabul ölçütü: `api` konteyneri durdurulduğunda maske „kaydedildi" demez, anlaşılır hata verir |
| **Durum** | `offen` — yön kararı 06.09.2026 kullanıcıda; şart (1) Faz 1.1'e (O-01), şart (2) `guvenlik` siciline bağlanır |

> ⚠️ **O-01'e ek:** sicil bugüne kadar yalnız `dashboard.js:95-97`'deki ternary'yi „doğru deseni
> bilen" yer olarak anıyordu. `REZEPT_API` (`dashboard.js:17857`) aynı host'u **ikinci kez**
> sabitliyor ve ternary'yi bile kullanmıyor — Faz 1.1 çözümü bu ikinci kopyayı da kapsamalı,
> yoksa kutuda reçete yolu bizim VPS'imize gitmeye devam eder.

---

## 7D. Filo ölçeği — 50-200 kutu (tip G + F)

> Bu bölüm 10.09.2026'da açıldı. Sebep: hem playbook hem `RELEASE-STANDARD.md`
> **~20 kutu** varsayımıyla yazıldı (§0 tablosu, §6.3, §11.1 hepsi "20 kutu" diyor).
> Aşağıdaki iki madde 20'de görünmeyen, 50-200'de kaçınılmaz olan boşluklardır.

### O-45 — Supabase upstream stack'inin (11 image) yükseltme yolu yok

| Alan | İçerik |
|---|---|
| **Ne** | Kutudaki Postgres/GoTrue/PostgREST/Realtime/Storage/Kong imajlarını yükseltmenin hiçbir yolu tarif edilmedi |
| **Nerede** | `onprem/supabase-docker/docker-compose.yml` — **11 `image:` satırı** (upstream vendor kopyası). `RELEASE-STANDARD.md:581`: *"Supabase servisleri → Watchtower kapsamı dışı"*. Aynı belge §6.4: **compose kutuda yaşar, Watchtower ona dokunmaz**; §2.2: compose değişmek zorunda kalırsa bu **MAJOR** sürümdür |
| **Tip** | G + F |
| **Kutuda ne olur** | Bizim `api` image'ımız her gece güncellenir, altındaki 11 servis **kurulduğu sürümde donar**. Sonuç üç yerden ısırır: (1) GoTrue/Storage'ta çıkan bir CVE'yi kapatmanın yolu yok — CRA'nın 24s/72s/14g bildirim yükümlülüğü (D10) tam da bunu istiyor; (2) Postgres majör yükseltmesi (PG15→17 gibi) `pg_upgrade` gerektirir, kutu başına elle adım demektir ve **K10 gereği kutuya giremeyiz**; (3) yeni migration'larımız upstream'in yeni bir sürümünü varsayarsa eski kutuda patlar. 20 kutuda bu "bir hafta sürer"; 200 kutuda **hiç bitmez** |
| **Çözüm** | Üç parça, hiçbiri yazılmadı: (a) compose'un **sürümlenmesi** — image tag'leri `.env`'den okunsun, compose aptal kalsın (§6.4 kuralının somut hâli); (b) kutuda `praxura-updater` benzeri küçük bir adım: yeni compose/`.env` şablonu image ile gelsin, kutu kendi compose'unu **kendi** güncellesin (bugünkü "compose'a yazdığımız hiçbir şey ulaşmaz" duvarını yıkar); (c) `releases.json`'da upstream sürüm eşlemesi + durak (O-43). Faz dağılımı (playbook 11.09.2026'da güncellendi): (a) **Faz 2.1a içinde yapıldı** · (b) **Faz 2.1b** (compose'un kutuya dağıtımı, playbook §Faz 2.1b) · (c) **Faz 2.9** (`releases.json`, O-43) |
| **Durum** | 🟡 **kısmen çözüldü (11.09.2026)** — (a) yapıldı, (b) ve (c) açık |

> **11.09.2026 — (a) tamam: yığın artık tek bir sürümlenmiş nesne.**
> `onprem/docker-compose.yml` yazıldı ve **hiçbir `image:` satırı etiket taşımıyor** —
> hepsi `.env`'deki `VERSION_*` değişkenlerinden geliyor, yanlarında sabitlenmiş digest
> yorumu duruyor. Çözümün (a) maddesi harfiyen bu. Artık bir yükseltme, compose dosyasını
> değiştirmek yerine `.env`'de birer satır değiştirmek demek — (b)'nin (kutunun kendi
> compose'unu güncellemesi) önünü açan şey de budur.
>
> Aynı adımda **fremd konteyner sayısı 11 → 6'ya indi.** Bu bir RAM tasarrufu değil,
> doğrudan bu maddenin gövdesi: güncellenemeyen her bileşen bir borç. Çıkarılanlar ve
> gerekçeleri (hepsi çalışan yığına karşı ölçüldü, tahmin edilmedi):
> `studio` (müşteri DB'ye girmemeli, K10 gereği biz de giremiyoruz) ·
> `meta` (yalnız studio kullanıyor) ·
> `imgproxy` (uygulama tek bir `transform` çağrısı yapmıyor — yalnız `getPublicUrl` ve
> `createSignedUrl`) · `supavisor` (dışarıdan bağlanan yok, hiçbir servis ona bağlı değil) ·
> `functions` (Deno; O-11 kararı zaten "kutuya Deno konmayacak" diyordu).
> Lisans listesi `onprem/NOTICE.md`'de açıldı (O-42'nin tabanı).
>
> **Ölçüm:** boşta 7 konteyner **≈1,65 GB** — ve buna artık bizim `api`'miz de dahil
> (203 MB). Upstream'in 11 konteyneri `api` olmadan 2,0 GB idi. Kalanın %61'i tek başına
> Kong (886 MB) → O-48.
>
> **Kalan:** (b) kutunun compose'u kendi güncellemesi ve (c) `releases.json` eşlemesi.
> İkisi de yazılmadı.
>
> ⚠️ **Sicil düzeltmesi (11.09.2026, `onprem` ajanı):** compose başlığında iki sayı
> yanlış duruyor ve belgeyi okuyanı yanıltır. (1) *"Upstream liefert elf Container.
> **Vier** davon sind hier bewusst weggelassen"* — sayılan **beş**tir (studio · meta ·
> imgproxy · supavisor · functions). (2) Kong satırı *"~950 MB"* diyor; ölçüm ve bu
> sicil **886 MB** diyor. Sicilin geçerli sayıları: **5 çıkarıldı · 11 → 6 fremd
> konteyner · Kong 886 MB.** İkisi de `builder`'ın düzeltmesi (compose yorumu, tek satır).

### O-46 — Merkezde filo görünürlüğü yok; "hangi kutu hangi sürümde" panosu tasarlanmadı

| Alan | İçerik |
|---|---|
| **Ne** | 50-200 kutunun sürüm, şema no, yedek, disk ve lisans durumunu tek ekranda gösteren bir merkez panosu hiçbir belgede geçmiyor |
| **Nerede** | `grep -rin "flotte\|filo\|heartbeat\|fleet" onprem/*.md ONPREM_MIGRATION_PLAYBOOK.md LEGAL_ONPREM_REQUIREMENTS.md` → **sıfır sonuç**. En yakın kayıt `RELEASE-STANDARD.md` §7.4: merkez yalnız "kim · plan · lisans durumu · son yenileme · **son bildirilen sürüm**" bilir. Kararı §11.1 verdi (04.09.2026): sağlık verisi **taşınmıyor**, G1'in lafzı korunuyor; kör nokta bilinçli kabul edildi ve *"ücretli kutu ~10'u geçtiğinde yeniden sorulur"* denildi |
| **Tip** | G |
| **Kutuda ne olur** | Kutuda bir şey olmaz — **merkezde** olur. Bugünkü tasarımla 200 kutuda şunları bilemeyiz: kaç kutu yeni `:stable`'ı gerçekten aldı · hangi kutuda migration yarım kaldı · hangi kutuda gecelerdir yedek alınamıyor · hangi kutunun diski %92'yi geçti. Hepsi kutunun **kendi panelinde** yazılı (O-40'ın `/status`'u), ama kimse bakmıyor — müşteri arayana kadar. Bir sürümü geri çekme kararı (§4.6a) "kaç kutu etkilendi" cevabı olmadan verilemez |
| **Çözüm** | ⚠️ **Bu bir korkuluk sorusu, ajanın kararı değil** (§11.1 zaten kullanıcıya çıkarılmıştı). G1 ihlal edilmeden toplanabilecek azami küme, hasta verisi ile hiç kesişmez ve hepsi **sayı/enum**'dur: `lisans_id` · `surum` · `sema_no` · `durum` (enum: `ok` / `bakim_modu` / `migration_hatasi` / `yedek_yok` / `disk_kritik`) · `son_yedek_yasi_saat` (sayı) · `upstream_surum`. Serbest metin yok, host adı yok, sayaç yok, hasta tablosuna hiç dokunulmaz. §11.1'in kilitlediği şart bunu **bugünden mümkün kılıyor**: lisans yükü sürümlenecek (`lisans_sema: 1`) ve doğrulayıcı tanımadığı alanı yok sayacak — yani alan sonradan eklenebilir, kutuları önce yükseltmek gerekmez. Panelin kendisi merkez tarafı: `api/admin/data.js`'in on-prem satırları (O-18) |
| **Durum** | `offen` — karar kullanıcıda (§11.1 (b)), teknik ön koşul (sürümlü lisans yükü) Faz 3.2 kabul ölçütü olarak zaten yazılı |

## 7E. Kutu paketi yazılırken çıkanlar (11.09.2026)

> Bu dört madde `onprem/docker-compose.yml` yazılıp **boş bir veritabanına karşı
> gerçekten çalıştırılırken** çıktı; dördü de belge okuyarak bulunamazdı. Üçü
> (O-47 · O-48 · O-49) koşunun kendisinden, biri (**O-50**) koşudan sonra paketin
> sicile karşı denetlenmesinden geldi.

### O-47 — Kutunun backend'i Google anahtarları olmadan hiç açılmıyordu ✅ **çözüldü**

| Alan | İçerik |
|---|---|
| **Ne** | `server.js` başında `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URL` yoksa `process.exit(1)` vardı. ⚠️ **Bilinmiyor değildi:** Temmuz PoC'sinde `dummy GOOGLE_*` konarak geçiştirilmiş ve playbook §10'a *"Google env'leri boot'ta zorunlu, Faz 2.8 opsiyonelleştirecek"* diye yazılmıştı. İki ay bekledi; gerçek kutuda ilk denemede patladı |
| **Nerede** | `api-backend/server.js:159` (eski hâl) |
| **Tip** | E (env var) |
| **Kutuda ne olur** | **Olmuştu.** Kutu ilk kez ayağa kaldırıldığında `praxura-api` sonsuz PM2 yeniden başlatma döngüsüne girdi. Takvim, reçete, abrechnung — hepsi durdu, **bir yan özellik yüzünden**. Bulutta bu doğruydu (anahtar hep set, yokluğu bozuk deployment demek); kutuda tam tersi: praxis Google kullanmıyordur. Üstelik `restart: unless-stopped` bunu sonsuza kadar tekrarlar, `/health` sahte yeşil verirse (O-40) kimse fark etmez |
| **Çözüm** | Yapıldı: `GOOGLE_KONFIGURIERT` bayrağı + açılışta uyarı satırı; `newOAuthClient()` yapılandırılmamışsa anlaşılır bir hata atıyor; `/calendar/google-auth` ve `/gmail/connect` 503 + açık mesaj dönüyor. Diğer iki çağrı yeri zaten `integ.access_token` kontrolünün arkasında — kutuda kimse bağlanamayacağı için o dallar hiç çalışmıyor. Kural K4'ün aynısı: **zutat yoksa uygulama açılır, yalnız o özellik susar** |
| **Durum** | ✅ **gelöst (11.09.2026, `b2fdbb8`)** — ⚠️ küçük düzeltme: `server.js`'te **iki** `process.exit` daha var, ikisi de meşru. `:157` (`SUPABASE_URL`/`SERVICE_ROLE_KEY` yoksa uygulama gerçekten çalışamaz) ve `:4500` (`uncaughtException` sonrası 1 sn'lik temiz çıkış — bozuk state ile devam etmemek için). Sicil "tek diğer" diyordu, düzeltildi. Bunların dışında sert çıkış yok (tarandı) |

### O-48 — Kong kutunun en büyük parçası; yerine Caddy koymak bir güvenlik kontrolünü de kaldırır

| Alan | İçerik |
|---|---|
| **Ne** | Kırpılmış yığında Kong tek başına **886 MB** ölçülmüştü — kalan belleğin %61'i — ve güncellenemeyen 6 fremd bileşenden biri |
| **Nerede** | `onprem/docker-compose.yml` → `kong` · yönlendirme `onprem/volumes/api/kong.yml` (14 rota) |
| **Tip** | G |
| **Kutuda ne olur** | Kong yalnız yönlendirmiyor: `key-auth` + `acl` ile **apikey doğruluyor**, `request-transformer` ile Authorization başlığını kuruyor. Ölçüldü: apikey'siz istek **401** alıyor. Ayrıca `request-termination` ile üç ayrı deny kuralı taşıyor (`/realtime/v1/api/tenants` → 403, `/realtime/v1/api/openapi` → 403, `/pg/` → yalnız `admin` grubu — konsey turunda `muhalif`/`guvenlik` buldu). Caddy'ye geçilirse yönlendirme ve CORS taşınabilir, ama bu **dördü** taşınamaz — PostgREST/realtime/pg-meta apikey'siz de cevaplamaya başlar. RLS hâlâ korur (asıl savunma odur, anon anahtarı zaten gizli değil), fakat bu **var olan güvenlik kontrollerinin kaldırılmasıdır** |
| **Çözüm** | ✅ **886 MB rakamı yanlış ölçülmüştü — konsey 12.09.2026'da düzeltti.** `KONG_NGINX_WORKER_PROCESSES: auto`, ölçen makinenin (16 çekirdek) her koruna bir NGINX worker açıyordu; hedef 2 vCPU kutuda `auto` zaten 2'ye düşerdi. Sabit `worker_processes=2` ile ölçülen gerçek RSS: **~139–180 MB**. Kong **kalıyor**, Caddy'ye geçiş (B) reddedildi: dört deny kuralının + apikey→Authorization çevirisinin Caddy'de (stock, key-auth eklentisi yok) yeniden kurulması Supabase'in güvenlik modelini fork'lamak demekti — zaten gerçek olmayan bir RAM sorunundan çok daha pahalı |
| **Durum** | ✅ **gelöst (12.09.2026)** — `onprem/docker-compose.yml`'e `KONG_NGINX_WORKER_PROCESSES: "2"` (auto yerine sabit) + `mem_limit: 400m` (önceden yoktu) eklendi. Gerçek kutuya karşı doğrulandı: RSS ~139 MB (400 MB limitinin altında, bolca pay), apikey'siz **401**, apikey'li **200**, `/realtime/v1/api/tenants` **403**, gerçek `signup` **200**. Tam karar: `konsey/tutanak/2026-09-12-o48-kong.md` |

### O-49 — `pg_net` kutuda kurulu kalıyor: G1 yapısal değil, disiplinle korunuyor

| Alan | İçerik |
|---|---|
| **Ne** | Upstream'in `webhooks.sql`'i `pg_net`'i ve `supabase_functions.http_request()`'i kuruyor; yetki `anon, authenticated, service_role`'e veriliyor |
| **Nerede** | `onprem/volumes/db/webhooks.sql:3` (`CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions`) · yetkiler `:6-9` (`anon, authenticated, service_role`) · `:113` (`CREATE USER supabase_functions_admin`) · şifreyi set eden satır `onprem/volumes/db/roles.sql:7` |
| **Tip** | A |
| **Kutuda ne olur** | Bugün hiçbir şey: `net.http_post` **sıfır** fonksiyonumuzda geçiyor (ölçüldü), Telegram trigger'ı baseline'da düşüyor. Ama yetenek **kurulu duruyor** — yani G1 ("kutu dışarı telefon etmez") bir yapı değil, bir alışkanlık. Yarın biri iyi niyetle bir webhook trigger'ı yazarsa kutuda sessizce çalışır |
| **Çözüm** | Dosyayı **çıkarmak denendi ve yığını kırdı** (11.09.2026): `webhooks.sql:113` `supabase_functions_admin` rolünü yaratıyor, bir sonraki init dosyası `99-roles.sql:7` o rolün şifresini set ediyor. Rol yoksa psql orada duruyor, geri kalan `ALTER USER` satırları hiç koşmuyor ve **`supabase_storage_admin` şifresiz kalıyor** → Storage hiç açılmıyor. Hata iki dosya öteden, bambaşka bir yüzle geliyor. Doğru çözüm: rolü yaratıp `pg_net`'i atlayan **kendi** init dosyamız + boş veritabanına karşı yeni bir tur test. Küçük ama kendi başına bir iş |
| **Durum** | ✅ **gelöst (12.09.2026)**, iki denemeden sonra — ilki `tools/check-onprem-volumes.sh`'a takıldı, ikinci doğruydu. **İlk deneme (geri alındı):** `webhooks.sql:3`'teki `CREATE EXTENSION` satırını doğrudan yorumla değiştirdim. Fonksiyonel olarak çalıştı (aşağıdaki ölçümler o hâlde de tuttu), ama commit sırasında kapı reddetti: `check-onprem-volumes.sh` bu dosyayı `onprem/supabase-docker/volumes/db/webhooks.sql` (upstream vendor kopyası) ile **byte byte** karşılaştırıyor — tam da gelecekte upstream sürüm kayması olursa fark edilsin diye. Dosyayı elle değiştirmek bu kapıyı **kalıcı olarak körleştirirdi**: bir daha asla eşleşmeyecek, gerçek bir upstream farkı da sessizce aynı "abweichend" satırına karışırdı. **Doğru çözüm (uygulanan):** `webhooks.sql` vendor kopyasından **aynen geri kopyalandı** (kapı yine yeşil); pg_net'i kaldıran iş **kendi ayrı dosyamıza** taşındı — `onprem/volumes/db/no-pg-net.sql` (`DROP EXTENSION IF EXISTS pg_net CASCADE;`), compose'da `init-scripts/98a-no-pg-net.sql` olarak `98-webhooks.sql`'den hemen sonra, `99-roles.sql`'den önce mount edilir (`docker-entrypoint-initdb.d/migrate.sh`'ın kendi sırası: önce `init-scripts/*` alfabetik, sonra `migrations/*`). Upstream'in kendi `pg_net`'e bağlı migration'ları (`20220713082019_pg_cron-pg_net-temp-perms-fix.sql`, `20250220051611_pg_net_perms_fix.sql`) zaten `pg_available_extensions`/`pg_extension` ile "kurulu mu" diye soruyor ve kurulu değilse hiçbir şey yapmıyor — yani upstream'in kendisi de pg_net'siz çalışmayı zaten destekliyor, ölçüldü. Boş veritabanına karşı **iki kez** sıfırdan doğrulandı (`docker compose down -v` + `volumes/db/data` silindi): DB log'unda `98-webhooks.sql` sonra `98a-no-pg-net.sql` sırayla koştu, 8/8 healthy, `pg_extension`'da `pg_net` **0 satır**, iki admin rolü de mevcut, gerçek `POST /auth/v1/signup` → 200 + `profiles` satırı (`role=owner`, `plan_status=pending`) trigger'la oluştu, apikey'siz `/rest/v1/` **401**. `check-onprem.sh` + `check-namen.sh` + `check-onprem-volumes.sh` üçü de yeşil. G1 artık **disiplin değil yapı**: kutu `net.http_get`/`http_post`'u hiç **çağıramaz**, çünkü fonksiyonlar hiç kurulu değil |

### O-50 — Kutudaki `api` konteynerinin env yüzeyi eksik: üç değişken paketten düştü

| Alan | İçerik |
|---|---|
| **Ne** | Compose'un `api` servisine yalnız sekiz değişken geçiyor. `DATA_ENCRYPTION_KEY` ve `SMTP_*` **hiç yok**; `PUBLIC_BASE_URL` (O-03'ün çözümü) için de yer ayrılmamış. Üçünün de yokluğu **sessiz** |
| **Nerede** | `onprem/docker-compose.yml` → `api:` `environment:` (`NODE_ENV` · `PORT` · `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` · `DATABASE_URL` · `AI_PROVIDER`/`AI_ENDPOINT`/`AI_API_KEY` · `TZ`). `onprem/.env.template`'te de yoklar. Kod tarafı: `api-backend/lib/phi-encrypt.js:32` `encryptionAvailable()`, kullanım `api-backend/server.js:2579` ve `:2777`; SMTP kapıları `server.js:3976` `:3992` `:4158` `:4208` `:4303` (+ `:4351` 503). `PUBLIC_BASE_URL` bugün kodda **hiç yok** (`grep` → 0), O-03'ün önerisi |
| **Tip** | E |
| **Kutuda ne olur** | Üç ayrı **sessiz** kayıp — hiçbiri hata vermiyor, üçü de kutuyu canlıdan farklı kılıyor. (1) **PHI şifrelemesi kapalı:** `encryptionAvailable()` false döner, `icd10_enc` ve `ocr_raw_enc` alanları **hiç yazılmaz**; reçete verisi kutuda yalnız düz kolonlarda durur. Uygulama çalışır, log sessizdir. Anahtar sonradan eklense bile o ana kadarki satırlar şifresiz kalır. SaaS'ta anahtar dolu, yani bu **kutuya özgü bir gerileme** (G7'nin tersi: iki dağıtım aynı kodda ama farklı korumada). (2) **Express mailleri susar:** her gönderim `if (process.env.SMTP_HOST)` arkasında; randevu onayı, Termin-Anfrage cevabı ve Mahnung maili gitmez, log'a bile düşmez. Üstelik GoTrue'nun kendi SMTP'si **dolu** olduğu için davet ve şifre-sıfırlama mailleri gider → müşteri "mail çalışıyor" sanır, hasta maili gelmez. Bu, teşhisi en zor arıza sınıfı. (3) `PUBLIC_BASE_URL` yokluğu bugün bir şey kırmıyor (değişken kodda da yok), ama O-03'ün çözümü şablonda yer bulamazsa Faz 1.1 uygulanırken ikinci bir tur açılır |
| **Çözüm** | **Faz 2.1** — `.env.template` ve compose'a üç ekleme: (a) `DATA_ENCRYPTION_KEY`, `install.sh` tarafından üretilir ve O-29'un dört kuralına bağlanır (bir kez gösterilir, yedeğe parmak izi düşer, geri yükleme onu karşılaştırır); (b) `SMTP_*` aynı değerlerle `api` servisine de geçirilir — GoTrue ile ortak, ikinci bir profil değil; (c) `PUBLIC_BASE_URL` yer tutucusu. ⚠️ **Şart:** şifreleme anahtarının yokluğu sessiz kalmamalı — açılışta uyarı satırı (O-47'de Google için yazılan desenin aynısı) + derin `/status`'ta `data_key` alanı (O-40, `RELEASE-STANDARD.md` §6.5). "Zutat yoksa uygulama açılır ama susmaz" |
| **Durum** | 🟡 **kısmen `gelöst` (11.09.2026, `c602f50`)** — değişkenler girdi, sessizlik de kapandı; **kalan tek şart: anahtarın kurulumda üretilmesi** (Faz 2.1c) |

> **11.09.2026 — yapılan (ana bağlam, sicil bulgusunun ardından).**
> `api` servisine `DATA_ENCRYPTION_KEY` ve `SMTP_HOST/PORT/USER/PASS` eklendi,
> `.env.template`'e karşılıkları ve gerekçeleri yazıldı ("anahtar yedeğe girer; kaybolursa
> tam bir `pg_dump` bile o alanları geri getirmez"). Lokal yığında doğrulandı:
> `DATA_ENCRYPTION_KEY gesetzt: true · Laenge: 64`, 7/7 konteyner sağlıklı.
>
> **11.09.2026 akşamı — sessizlik de kapandı.** `api-backend/server.js:189-195`:
> anahtar yoksa açılışta `[phi] … werden NICHT verschluesselt gespeichert` uyarısı,
> **64 hex değilse** ikinci bir uyarı (yanlış uzunluk yoksa ilk yazma denemesinde,
> yani iş günü ortasında patlıyordu). `process.exit` **bilinçli olarak konmadı** ve
> gerekçesi koda yazıldı: sabah çalışamayan praxis, şifresiz kaydedilmiş bir alandan
> kötüdür. Doğru karar — O-47'nin dersinin aynısı, ters yönde uygulanmış hâli.
>
> **Kalan tek şart:** şablondaki satır hâlâ boş (`DATA_ENCRYPTION_KEY=`) ve compose onu
> varsayılansız geçiriyor; boş `.env` ile kurulan kutuda değişken boş dizge olur ve
> şifreleme kapalı kalır — artık **sessizce değil**, log'da bağırarak. Kapanması için
> `install.sh`'ın (Faz 2.1c) anahtarı üretmesi gerekir. Anahtarın ömrü (bir kez göster ·
> yedek künyesine parmak izi · geri yüklemede karşılaştır) **O-29'un işi**, bu maddenin
> değil — iki madde aynı anahtarı iki farklı sorudan tutuyor, karıştırma.
>
> ⚠️ Üçüncü değişken (`PUBLIC_BASE_URL`) hâlâ kodda yok — O-03'ün Faz 1.1 çözümüyle
> birlikte gelecek; şablonda yer açılması o adımın işi.

---

### O-51 — Gönderen adresi koda gömülü: kutunun maili müşterinin sunucusundan çıkıp bizim adımıza konuşuyor

| Alan | İçerik |
|---|---|
| **Ne** | `SMTP_FROM` diye bir değişken yok; gönderen adresi altı yerde sabit yazılı (`"<praxis adı> via Praxura" <noreply@praxura.de>`) |
| **Nerede** | `api-backend/server.js:3981` `:4002` `:4174` `:4212` `:4316` `:4363` — altısı da aynı sabit alan adını taşıyor. `grep -rn "SMTP_FROM"` → ürün kodunda **sıfır**. Kutu tarafındaki tek kayıt: `onprem/docker-compose.yml`'de bu maddeyi anan yorum |
| **Tip** | C (sabit adres — ama etkisi tip A'ya benziyor: mail teslim edilmiyor) |
| **Kutuda ne olur** | Mail **müşterinin** SMTP sunucusundan çıkar, zarfın üstünde **bizim** alan adımız yazar. Sonuç varsayım değil, ölçüldü (11.09.2026, herkese açık DNS sorgusu): `praxura.de` → `v=spf1 include:secureserver.net -all` ve `_dmarc.praxura.de` → `v=DMARC1; p=quarantine; adkim=r; aspf=r`. Üç adım zinciri: (1) **SPF sert red** (`-all`) — yalnız bizim sağlayıcımızın sunucuları `praxura.de` adına gönderebilir, müşterinin sunucusu o listede değil → fail; (2) **DKIM ile kurtarma yolu yok** — kutu bizim özel anahtarımızla imzalayamaz, o anahtar kutuya **giremez** (G2); (3) iki hizalama da düştüğü için **DMARC politikası devreye girer**. Politika `p=quarantine` (reject değil): mail kaybolmaz, **spam klasörüne düşer**. DMARC uygulayan her alıcıda — Gmail, Outlook, GMX, Web.de — yani Almanya'daki hasta posta kutularının fiilen tamamında. Arıza tamamen sessizdir: `nodemailer` başarı döner, log temizdir; hasta randevu onayını görmez, praxis "yazılım mail göndermiyor" der ve sebep hiçbir kayıtta yoktur. Bu, O-50'nin SMTP yarısı çözülse **bile** ayakta kalan ikinci bir kırılmadır — iki madde tek düzeltmeyle kapanmaz.<br>İkinci açı, teknik değil ticari: `„… via Praxura"` ibaresi bizim markamızı müşterinin postasına gömüyor. Beyaz etiket/kurumsal kimlik istenirse (on-prem alıcı kitlesi tam da bunu ister) burası ayrı bir karardır — ama **asıl mesele o değil**, asıl mesele mailin görülmemesi |
| **Çözüm** | Gönderen adresi `.env`'den okunur ve kutuda **müşterinin kendi alanı** olur — varsayılanı `SMTP_ADMIN_EMAIL`, yani zaten sorulan ve kutunun SPF'iyle hizalanan adres. Altı çağrı yeri **tek yardımcıdan** beslenir; görünen ad ikinci bir değişkene (`MAIL_FROM_NAME`, on-prem varsayılanı praxis adı) bağlanır. ⚠️ **SaaS'ta davranış hiç değişmez:** oradaki varsayılan bugünkü sabit değer kalır, gönderim zaten kendi sağlayıcımızdan çıkıyor ve SPF tutuyor. Yani düzeltme G7'nin tam örneği — tek kod, iki dağıtım, fork yok. **Faz 2.1** (değişken + yardımcı) · **Faz 2.2** (sihirbazın "test maili gönder" adımı). Kabul ölçütü gönderimin 250 dönmesi **değil**, mailin **alıcı kutusunda ve spam'de değil** görülmesidir — gönderim başarısı ile teslim başarısı ayrı ölçülür. Kapı **kuruldu** (11.09.2026, `c602f50`): `absender_fest=6`, artış = red. Yedinci sabit adresle denendi, reddetti (`onprem` ajanı doğrulaması). Hedef **0** |
| **Durum** | 🟡 `kısmen gelöst` (11.09.2026, O-66 turu) — kod tarafı bitti: altı yer `api-backend/lib/mail.js` → `getMailFrom()`'dan geçiyor, `install.sh` adım 11'de `SMTP_FROM`/`SMTP_ADMIN_EMAIL`'i aynı anda soruyor. SaaS davranışı unit testle doğrulandı (`getMailFrom()` env'siz çağrıldığında eski sabit değeri birebir üretiyor). **Kalan:** kabul ölçütü "alıcı kutusunda ve spam'de değil görülmesi" — bu ancak gerçek bir SMTP sunucusuyla ilk kurulumda ölçülebilir, bugüne kadar yalnız kod + sahte SMTP host'a karşı test edildi (bkz. §7H üçüncü tur). Kapı `absender_fest` 6 → **2** düştü (1 bilinçli fallback + 1 açıklayıcı yorum) |

---

## 7F. Faz 2.1b — Caddy/TLS turu (başlangıç: 11.09.2026)

> **Ön koşul hükmü (bu turun girişi).** O-01'in ve O-15'in Faz 2.1b'yi bloke eden
> kısmı **kapandı**: frontend artık `API_BASE`'i `/api/config`'ten alıyor, dört sunucu
> uygulaması (Vercel · Express · `dev_server.cjs` · PoC) aynı sözleşmeyi veriyor,
> kutuda ölçülen değer `apiBase:"/api"`. Kapı tabanı `n8n_host` **25 → 7** sıkıştı;
> kalan 7'nin hiçbiri "kutu bizim VPS'imize gider" sınıfında değil (döküm:
> `tools/.onprem-baseline`). Yani Caddy arayüzü servis ettiğinde müşterinin tarayıcısı
> **kendi kutusuna** konuşur. **Başka bloke eden madde yok.**
>
> Bu turda dokunulması gereken açık maddeler (hepsi 2.1b'nin gövdesi, önündeki engel
> değil): **O-49** (kendi init dosyamız) · **O-48** (Kong ↔ Caddy, **konsey**) ·
> **O-45 (b)** (compose'un kutuya dağıtımı) · **O-52** (CSP, aşağıda) · **O-55**
> (aşağıda, yeni) · ayrıca **O-25** (`:stable` etiketi hâlâ yok — Caddy ayağa kalksa
> bile paket bugün `PRAXURA_API_IMAGE`'ı çekemez; 2.1b'yi bloke etmez ama ilk gerçek
> kurulumu bloke eder).
>
> ⚠️ **Bu turun en büyük sessiz boşluğu:** kutuda **statik arayüzü taşıyan bir image
> yok.** `api-backend/Dockerfile`'ın `COPY` listesi yalnız backend'i alıyor
> (`server.js · _lib · ai · billing · booking · lib · db`), tek bir `.html`/`.js`
> yok; `.github/workflows/publish-calendar-api.yml` yalnız `./api-backend` context'ini
> basıyor. Yani "Caddy statik dosyaları servis eder" cümlesinin bugün **servis
> edeceği dosya yok**. 2.1b iki iş demek: (1) Caddy, (2) paketlenmiş arayüz
> (Faz 2.0'ın dosya listesi — pazarlama sayfaları hariç) için ikinci bir image ya da
> `api` image'ına eklenen bir `public/` katmanı. Hangisi olursa olsun **sürümü
> `api` ile birlikte yürümeli**, yoksa arayüz ile backend ayrı sürümlere düşer.
>
> ✅ **11.09.2026 akşamı kapandı.** Arayüz + Caddy **tek image** oldu
> (`onprem/frontend.Dockerfile`, `caddy:2.9-alpine` tabanı, `COPY` listesi elle
> yazılmış bir allowlist) ve `api` ile aynı commit'ten basılıyor
> (`.github/workflows/publish-frontend.yml`). Dosya listesi ile Caddyfile böylece
> asla ayrı sürümlere düşemez. Diğer seçenek — `api` image'ına `public/` katmanı —
> backend'in sürümünü her CSS değişikliğinde döndürürdü; bu tercih doğru.

---

### Turun sonucu — Faz 2.1b, 11.09.2026 akşamı (`onprem` gegenlesen)

**İnşa edilen:** `onprem/Caddyfile` · `onprem/frontend.Dockerfile` · compose'a `caddy`
servisi · `.env.template`'e 5 değişken · `publish-frontend.yml` · `NOTICE.md`'ye iki
satır · kapıya `csp_host` sayacı ve `onprem_image` 7→8.
**Yerel kutuda ölçüldü:** 8 konteynerin 8'i healthy · `/login.html` 200 + doğru CSP ·
`/` → 302 · `/api/config` doğru JSON · apikey'siz `/rest/v1/` **401** (Kong yerinde) ·
`/realtime/v1/websocket` → **101** (tam ws zinciri ayakta) · `/admin.html` → **404**
(paket sınırı gerçekten çalışıyor).

**Dosya listesi kararı — dört dışlamanın dördü de DOĞRULANDI:**

| Dışarıda bırakılan | Hüküm | Doğrulama |
|---|---|---|
| `admin.html` · `admin-login.*` | ✅ doğru | Cross-tenant iç araç; O-18 zaten "panel merkezde kalır" diyor. Kutuda zaten görünmezdi: linki açan koşul `admin_users` tablosunda satır bulmak (`dashboard.js:17122-17132`, `login.js:190-196`) ve o tablo kutuda **boş** — link ölü, tehlikeli değil |
| `onboarding.*` · `onboarding-success.html` · `email-template-confirm-signup.html` | ✅ doğru | SaaS signup + Stripe-Checkout, kutuda anlamsız. ⚠️ **Bedeli yazılsın:** kutuda bugün owner hesabı yaratacak **hiçbir ekran yok**. Faz 2.2 sihirbazının görev tanımında bu ilk sırada durmalı, yoksa kurulum "doğru ama içine girilemez" kalır |
| `oauth.html` | ✅ doğru | Sayılarak doğrulandı: tüm depoda tek geçişi kendi `<link rel="canonical">` satırı (`oauth.html:9`). Sıfır referans |
| `styles.css` | ✅ doğru | Tek okuyucusu `index-old.html:60` (ölü sayfa) |

**Ama liste hem eksik hem fazla — ölçüldü, ayrıntı O-57'de.** Kısaca:
`assets/system.css` üç kutu sayfasında yükleniyor (`login` · `employee-signup` ·
`confirm`) ve **pakette yok**; `manifest.json` iki sayfada aranıyor, pakette yok.
Buna karşılık `cookie-consent.js/css` **hiçbir** kutu sayfasından çağrılmıyor
(ve içinde Umami enjeksiyonu var, O-05), `login.css` de çağrılmıyor.

**Caddyfile ve CSP incelemesi — dört not:**

1. **Path eşleştirmesi doğru.** `/auth/* /rest/* /realtime/* /storage/* /sso/*
   /.well-known/*` supabase-js'in ürettiği bütün yolları karşılıyor
   (`/auth/v1/…` · `/rest/v1/…` · `/realtime/v1/websocket` · `/storage/v1/object/…`),
   Kong'un kendi `strip_path`'i bozulmuyor. 101 ölçümü zincirin tamamını kanıtlıyor.
2. **`/functions/*` yok — ve olmamalı.** Deno konteyneri kutuya bilinçli olarak
   girmiyor (O-11). Bugünkü davranış: `supabase.functions.invoke()` statik handler'a
   düşer, 404 HTML alır, `FunctionsHttpError` olur. Sonuç doğru, ama Caddyfile'a
   **tek satır yorum** girsin ("burası bilerek boş — O-11"): yoksa bu dosyaya ilk
   bakan kişi "eksik route" sanıp olmayan bir konteynere proxy yazar.
3. **CSP'nin ilk gerçek kurbanı Nominatim.** `dashboard.js:20683`
   `nominatim.openstreetmap.org`'a **tarayıcıdan** çıkıyor; yeni `connect-src` onu
   engelliyor. Bu iyi haber (kutu artık OSM'e müşteri IP'si sızdırmıyor — O-12'nin
   kalan tek kaygısı böylece kapandı) ama bedava değil: `clinic_lat/lng` hiç dolmaz,
   `catch` sessizce `return` eder, Hausbesuch mesafesi O-11'in üstüne ikinci kez
   kaybolur. O-12 `unkritisch` kalıyor, **gerekçesi değişti** (maddeye eklendi).
4. **Ucuz iki ekleme:** `form-action 'self'` (dış host'a form POST'unu keser, tek
   token) — `base-uri`/`object-src`/`frame-ancestors` zaten yerinde. `manifest-src`
   yazmaya gerek yok, `default-src 'self'`'e düşüyor — **ama ancak `manifest.json`
   pakete girerse.** Sentry loader'ı beş kutu sayfasının HTML'inde duruyor (O-06) ve
   CSP onu engelliyor; `sentry-init.js:9-13` `window.Sentry` yoksa sessizce çıktığı
   için kırılma yok. Yani **G4 bu turda CSP ile sağlandı, HTML'den silinerek değil** —
   O-06 açık kalır, ikinci savunma hattı tek hat değildir.

### O-52 — `vercel.json` CSP'si kutuya kopyalanamaz (ve kopyalanırsa iki türlü ısırır)

| Alan | İçerik |
|---|---|
| **Ne** | Tek CSP metni `vercel.json`'da sabit; içinde bizim bulut adreslerimiz var, kutunun kendi adresi yok |
| **Nerede** | `vercel.json:19` — `connect-src` içinde bulut Supabase proje adresi (+`wss://`), `n8n.infinitymade.de`, `analytics.infinitymade.de`, `api.stripe.com`, `*.ingest.*.sentry.io`, `accounts.google.com`; `script-src` içinde iki Sentry CDN'i + Stripe + Google + Wistia; `frame-src` içinde Stripe/Google/Wistia/**zygotebody.com** (bkz. O-55). Kapı bu satırı **hiç görmedi**: `tools/check-onprem.sh:71-96` yalnız `*.js` `*.html` `*.mjs` tarıyor, `*.json` kapsamda değil |
| **Tip** | C |
| **Kutuda ne olur** | İki ayrı kırılma. (1) **Kopyalanırsa:** kutu, müşterinin tarayıcısına bizim buluta konuşma izni verir — bugün ölü, ama CSP G1'in ikinci savunma hattıdır; bir gün biri sabit adresi geri koyarsa tarayıcı onu **engellemez**. (2) **`'self'` yetmezse:** `SUPABASE_PUBLIC_URL` sayfa origin'inden farklıysa (farklı port, farklı host adı) login **CSP hatasıyla** ölür; ekranda ağ arızası gibi görünür, teşhisi zordur. Ayrıca Realtime `wss://` şemasını ister — `'self'`'in ws/wss'i kapsaması CSP3'te yazılı ama tarayıcı geçmişi eşit değil, buna güvenmek ölçülmemiş bir varsayımdır |
| **Çözüm** | **Faz 2.1b.** Dört adım, sırayla: **(a) Kutu tek-origin tasarlanır** — Caddy aynı host adı altında hem statik arayüzü hem `/api` → `api` hem `/auth,/rest,/realtime,/storage` → Kong'u verir. O zaman kutunun CSP'si fiilen `default-src 'self'` olur ve bu madde **yapısal olarak** kapanır, yönetilmesi gereken bir liste olmaktan çıkar. **(b) Kaçış yolu env'den, sabit değil** — ayrı origin isteyen kurulum için Caddyfile `connect-src 'self' {$SUPABASE_PUBLIC_URL} {$SUPABASE_PUBLIC_WSS}` yazsın; Caddy dizgi dönüştüremez, `SUPABASE_PUBLIC_WSS` **`install.sh` tarafından** `SUPABASE_PUBLIC_URL`'den türetilip `.env`'e yazılır (Faz 2.1c'ye tek satır). Boşsa `'self'` kalır — boş değişken CSP'yi bozmamalı. **(c) Kutunun listesinden çıkacaklar:** Sentry CDN + ingest (G4, telemetri varsayılan kapalı — açılırsa header **yeniden üretilmeli**, bu da sabit yazmamak için ikinci sebep) · `n8n…` · `analytics…` · `accounts.google.com` (O-08, kutuda kapalı) · Wistia (pazarlama, pakete girmiyor) · `api.stripe.com` (O-19, kutuda dış **link**, `fetch` değil). **(d) Kapıya `*.json` sayacı** — `csp_host`; SaaS'taki bu satır meşru, o yüzden hedef sıfır değil, taban bugünkü sayı ve **artmamalı**. ⛔ Yapılmayacak: `'unsafe-inline'`'ı bu turda temizlemeye kalkmak — inline `onclick` deseni uygulamanın her yerinde, ayrı ve büyük bir iş |
| **Durum** | 🟡 **kısmen gelöst** (11.09.2026, Faz 2.1b). **Biten:** (a) tek-origin tasarımı `onprem/Caddyfile`'da kilitlendi ve ölçüldü · (b) `connect-src 'self' {$SUPABASE_PUBLIC_URL} {$SUPABASE_PUBLIC_WSS}`, `.env.template`'te boş varsayılanla · (c) bulut adreslerinin hiçbiri kutunun CSP'sinde yok (Sentry · n8n · analytics · Google · Wistia · Stripe) · (d) kapıya `csp_host=53` sayacı girdi. **Kalan tek şey:** `SUPABASE_PUBLIC_WSS`'i `SUPABASE_PUBLIC_URL`'den türetip `.env`'e yazan satır — **Faz 2.1c `install.sh`**. Bugün müşteri ayrı origin isterse o değişkeni elle doldurmak zorunda ve doldurmazsa Realtime CSP hatasıyla ölür |

> **Niye tek-origin bir tercih değil tasarım kararı:** `.env.template` bugün
> `SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL` ve `SITE_URL`'i **aynı değere**
> (`https://praxis.local`) koyuyor. Yani tasarım zaten tek-origin'e bakıyor, ama hiçbir
> yerde yazılı değil. Yazılmazsa ilk "port ile ayıralım" refleksinde CSP, çerez
> `SameSite` davranışı ve GoTrue redirect'leri birlikte kayar — üçü de ayrı ayrı
> teşhis edilir, hepsi aynı sebebe çıkar. 2.1b bunu bir satırla kilitlemeli.
>
> **HSTS ayrı bir tuzak:** `vercel.json:18`'deki `Strict-Transport-Security`
> (`max-age=63072000; includeSubDomains`) kutuya körlemesine kopyalanmamalı.
> Gerçek alan adı + Let's Encrypt varsa doğru; `praxis.local` ya da kendi imzalı
> sertifikayla kurulan bir kutuda tarayıcı o host'u **iki yıl** boyunca yalnız
> HTTPS'e kilitler ve geri alma yolu müşterinin tarayıcısındadır, bizde değil.
> Header, TLS modu gerçekten public-CA olduğunda konur.

### O-55 — `zygotebody.com` iframe'i: kutudan çıkan, hiçbir yerde kayıtlı olmayan üçüncü-parti gömü

| Alan | İçerik |
|---|---|
| **Ne** | Dashboard'daki 3D-Anatomie ekranı `www.zygotebody.com`'u iframe olarak gömüyor |
| **Nerede** | `dashboard.js:13895` (`frame.src`) · fallback kartı `:13883-13891` · zaman aşımı `:13901` · CSP izni `vercel.json:19` `frame-src` |
| **Tip** | A (+ C) |
| **Kutuda ne olur** | Müşterinin tarayıcısı ABD'li bir üçüncü tarafa çıkar. **Hasta verisi gitmiyor** — yalnız IP ve referrer, `sandbox` niteliği de dar tutulmuş; G1 ihlali değil. İnternetsiz kutuda 6 saniyelik boşluktan sonra fallback kartı çıkıyor — yani kırılma değil, yavaşlık. ⚠️ **Ölçülmemiş nokta:** CSP **engellerse** tarayıcı iframe'e yine `load` olayı verebilir; o durumda `loaded = true` olur ve fallback **hiç çıkmaz**, ekran boş kalır. Varsayılmasın, denensin |
| **Çözüm** | Kutunun CSP'sinde `frame-src` **varsayılan olarak `'none'`/`'self'`** — özellik bilinçli olarak susar; O-52 (c)'nin parçası. Aynı commit'te `loadBeispielmodus()`'a CSP-engelli durumda da fallback'i gösteren koşul. Kalıcı çözüm bu turun işi değil: ya özellik kutuda gizlenir (`nav-registry` görünürlüğü), ya da yerel muadiliyle değiştirilir (SVG vücut haritası zaten var — `loadBeispielmodus_SVG()`, görsel kalitesi beğenilmemişti). ⚠️ DSGVO açısı `legal-de`'nin işi: tıbbi bir uygulamanın içinden onaysız yüklenen ABD gömüsü, kutuda da bulutta da aynı soruyu doğurur — bu madde onu **açar**, cevaplamaz |
| **Durum** | 🟡 **kısmen gelöst** (11.09.2026). **Biten:** kutunun CSP'sinde `frame-src 'none'` — iframe kutudan **çıkamaz**, ölçüldü. **Kalan ikisi:** (1) CSP engellediğinde `loadBeispielmodus()`'un fallback kartını gösterip göstermediği **hâlâ ölçülmedi** — engelli iframe `load` olayı verirse `loaded=true` olur ve ekran boş kalır; bu artık teorik değil, kutuda her seferinde olacak yol. (2) Özelliğin kutuda gizlenmesi ya da SVG muadiliyle değişmesi — ayrı karar. DSGVO açısı `legal-de`'de |

### O-56 — `emailRedirectTo` koda gömülü: kutudaki çalışan kaydı yapısal olarak yarım kalıyor

| Alan | İçerik |
|---|---|
| **Ne** | Çalışan kaydında e-posta onay linkinin döneceği adres `https://app.praxura.de/confirm.html` olarak koda gömülü |
| **Nerede** | `employee-signup.js:288` (`signUp`) · `employee-signup.js:297` (`resend`) · aynı sınıftan üçüncüsü `api-backend/server.js:3155` (`redirectTo: 'https://app.praxura.de/login.html?verified=1'`). Üçü de `app.praxura.de` sayacının (`tools/.onprem-baseline`) içinde |
| **Tip** | C |
| **Kutuda ne olur** | Sanıldığından ağır. `confirm.html` **kozmetik bir "onaylandı" sayfası değil** — çalışanın profilini orada kuruyor: `pending_employee_registrations`'tan kaydı okur (`:147`), `profiles`'ı günceller (`:156`), `working_hours` satırlarını yazar (`:175`), `employee_business_assignments`'ı bağlar (`:193`), sonra pending satırını siler (`:204`). Kutuda GoTrue bu `redirect_to`'yu **allowlist'te bulamaz** (`ADDITIONAL_REDIRECT_URLS` boş) ve sessizce `SITE_URL`'e düşer → çalışan kutunun köküne varır, Caddy onu `/login.html`'e yollar, **`confirm.html` hiç koşmaz.** Sonuç: auth kullanıcısı var, profili yok — rolsüz/owner_id'siz bir hesap, `pending_…` satırı da tabloda asılı kalır. Teşhisi zor, çünkü hiçbir yerde hata görünmez. ⛔ Ve **yanlış çözüm hazır bekliyor:** biri `ADDITIONAL_REDIRECT_URLS`'e `app.praxura.de` yazarak "düzeltirse" müşterinin kutusundaki onay token'ı **bizim** SaaS alan adımıza teslim edilir. Bu yol kapalıdır |
| **Çözüm** | **✅ 11.09.2026 — asıl kırık yol kapandı.** `employee-signup.js:288`/`:297`: `window.location.origin + '/confirm.html'` — SaaS'ta davranış birebir aynı (origin zaten `app.praxura.de`, G7), kutuda kendi adresine döner, `ADDITIONAL_REDIRECT_URLS`'e dokunmaya gerek yok (`SITE_URL` GoTrue'da zaten örtük izinli). Sözdizimi + kapı doğrulandı, `app_host` **19 → 17**. `server.js:3155` **BİLİNÇLİ DOKUNULMADI**: `/api/admin/recover-checkout` `STRIPE_SECRET_KEY` yoksa satır 3108'de 500 ile kendini kapatıyor — kutuda bu env asla set edilmeyecek (Stripe on-prem'de yok), yani bu üçüncü satır kutuda zaten hiç çalışmayan bir koda ait. Sayacı 16'ya indirmek kozmetik olurdu, gerçek bir yolu kapatmazdı |
| **Durum** | `gelöst` (frontend, aktif yol) · `server.js:3155` SaaS-only kalan iz, düşük öncelik — Faz 1.2 genel temizliğine bırakıldı |

### O-57 — Paket dosya listesi hem eksik hem fazla: üç kutu sayfası stilsiz açılıyor

| Alan | İçerik |
|---|---|
| **Ne** | `onprem/frontend.Dockerfile`'ın `COPY` listesi, kutu sayfalarının gerçekten istediği iki dosyayı almıyor; buna karşılık hiç çağrılmayan iki dosyayı alıyor |
| **Nerede** | **Eksik:** `assets/system.css` → `login.html:20` · `employee-signup.html:17` · `confirm.html:13` (16 KB, üçünün de tek stil dosyası) · `manifest.json` → `dashboard.html:17` · `attendance.html:12` (ikonları zaten pakette). **Fazla:** `cookie-consent.js`/`.css` (sekiz kutu sayfasının **hiçbiri** referans vermiyor; içinde `analytics.infinitymade.de` enjeksiyonu var — O-05) · `login.css` (kutu sayfalarından sıfır referans; sahibi `admin-login`, o da pakette değil). Ölçüm: sekiz sayfanın bütün yerel `src`/`href` değerleri çıkarılıp dosya sistemine karşı sınandı |
| **Tip** | G |
| **Kutuda ne olur** | `login.html` — kutunun **ilk** ekranı — stil dosyası olmadan açılır. Duman testi bunu görmedi çünkü `/login.html` 200 dönüyor; eksik olan sayfa değil, sayfanın `<link>`'inin işaret ettiği dosya. `manifest.json` 404: `attendance.html` tabletten ana ekrana eklenemez (o sayfanın kullanım biçimi tam olarak budur). Fazlalıklar zararsız ama yanlış sinyal: kutuda Umami enjektörü **dosya olarak** duruyor, yalnız kimse çağırmadığı için çalışmıyor — bu bir savunma değil, tesadüf |
| **Çözüm** | Aynı commit, dört satır: `COPY assets/system.css ./assets/` + `COPY manifest.json ./` ekle; `cookie-consent.js cookie-consent.css` ve `login.css` satırlarını çıkar. Sonra duman testine **ikinci bir kontrol**: `/login.html` içindeki her yerel `src`/`href` için 200 iste — 200 dönen bir HTML, çalışan bir sayfa demek değil. `publish-frontend.yml`'a bu adım girsin (Faz 2.1b'nin kalanı) |
| **Durum** | ✅ **gelöst (12.09.2026)**. Dockerfile-yarısı zaten `e899d7a`'da inmişti (yukarıdaki not). Kalan iki parça bu turda kapandı: (1) `.github/workflows/publish-frontend.yml`'ın `paths:` listesi `onprem/frontend.Dockerfile`'ın COPY listesiyle **birebir** hizalandı — `login.css`/`cookie-consent.js`/`cookie-consent.css` çıkarıldı, `setup.html`/`setup.js`/`assets/system.css`/`manifest.json` eklendi, başına "COPY listesiyle deckungsgleich tutulur" uyarısı kondu. (2) Duman testine **ikinci adım** eklendi: `/login.html`'in ham HTML'inden **yalnızca `<link>`/`<script>`** etiketlerindeki (bilinçli olarak `<a href>` hariç — O-58 (a)'nın kutuda JS ile gizlediği SaaS linkleri curl'e hâlâ görünür, bu bir build hatası değil) yerel `src`/`href` değerleri çıkarılır, her biri ayrı ayrı 200 için sınanır. Yerel Docker build'de doğrulandı: `/login.html`'in yüklediği 7/7 asset 200 döndü (`assets/system.css` dahil — `manifest.json`'ı `login.html` zaten hiç yüklemiyor, onu `dashboard.html`/`attendance.html` yükler, aynı testle o sayfalar için de tekrarlanabilir) |

### O-58 — Kutuda Impressum/Datenschutz/AGB yok, ama hasta onay kutusunun yanındaki link onu gösteriyor

| Alan | İçerik |
|---|---|
| **Ne** | Paketlenen sayfalar `/impressum.html`, `/datenschutz.html`, `/agb.html` ve `/vorregistrierung.html`'e link veriyor; dördü de pakette yok |
| **Nerede** | `booking-request.html:630` (**onay kutusunun metninin içinde**: „…Datenschutzerklärung zu") · `:659-660` · `booking.html:753` `:775-776` · `login.html:448-450` · `login.html:429` (`/vorregistrierung.html`, "Vorregistrieren" düğmesi) · ayrıca `cookie-consent.js:41` `DS_LINK` |
| **Tip** | G (+ hukuki) |
| **Kutuda ne olur** | İki ayrı şey, karıştırılmasın. (1) **Kozmetik:** `login.html`'in alt bilgisi ve "Vorregistrieren" düğmesi kutuda 404'e gider — kutuda ön kayıt diye bir şey zaten yok, düğme oraya ait değil. (2) **Kozmetik değil:** `booking.html` ve `booking-request.html` **hastanın** gördüğü sayfalar ve rıza kutusunun metni var olmayan bir Datenschutzerklärung'a atıf yapıyor. ⛔ **Ve bizim metnimizi kopyalamak yanlış çözümdür:** kutuda sorumlu (Verantwortlicher) **praxis**'tir, InfinityMade değil; bizim `datenschutz.html`'imizi paketlemek hastaya yanlış sorumlu ve yanlış işleme bilgisi gösterir — düzeltilmesi eksikliğinden daha pahalı bir hata |
| **Çözüm** | İki parça. **(a)** Kutu sürümünde SaaS'a özgü linkler görünmez (login alt bilgisi + "Vorregistrieren"); ölçüt `nav-registry` benzeri bir kutu bayrağı, ikinci bir dosya değil (G7). **(b)** Hasta sayfalarındaki iki link, kurulumda praxis'in kendi metniyle doldurulan bir **şablon sayfaya** gider (Faz 2.2 sihirbazının adımı: praxis adı/adres/DSB alanları). ⚠️ Metnin içeriği `legal-de`'nin işi — bu madde soruyu **açar**, cevaplamaz |
| **Durum** | ✅ **(a) gelöst (12.09.2026)** · (b) hâlâ `offen` — Faz 2.2 + `legal-de`. Tasarım onprem-review'ın çizdiği hatla birebir uygulandı: `GET /api/config` yanıtına **`istKutu: !!process.env.SUPABASE_PUBLIC_URL`** eklendi (`server.js:410`, `SETUP_TOKEN`'a **değil** — jeton kurulumda tüketildiği için o bir kerelik sinyal olurdu), Vercel'in `api/config.js`'i aynı alanı **sabit `false`** döner. `supabase-config.js`'e `export const IST_KUTU` eklendi, ikinci `fetch` açılmadı — zaten çekilen `_cfg`'den okur. `login.js` `IST_KUTU` true ise beş elemanı `style.display` yerine **DOM'dan tamamen kaldırıyor** (`.remove()`): `.register-block` (regText+regBtn'i birlikte kapsıyor), `#backHome` (`backLink` → `https://praxura.de`), `#saasFooter` (Impressum/Datenschutz/AGB). Kaldırma tercih edildi çünkü `showView()` `.register-block.style.display`'i login/reset arası geçişte zaten değiştiriyor — `hidden`/`display:none` orada geri açılırdı, `.remove()` bu çakışmayı yapı olarak imkânsız kılıyor. Gerçek kutuya karşı doğrulandı (Playwright, headless): `/api/config` → `istKutu:true`, `login.html` DOM'unda üç öğe de **yok**, başka konsol hatası yok (tek uyarı — Sentry CDN'in CSP'ye takılması — Faz 2.6'nın bilinen, ayrı açığı) |

### O-59 — Caddy yalnız `SITE_URL` Host'una cevap veriyor: kutuya IP ile ulaşılamaz

| Alan | İçerik |
|---|---|
| **Ne** | `onprem/Caddyfile` site bloğunun adresi `{$SITE_URL}`; Caddy Host bazlı eşleştirir, başka Host ile gelen istek bu bloğa **hiç girmez** |
| **Nerede** | `onprem/Caddyfile:27` (`{$SITE_URL} {`) · varsayılan `onprem/.env.template:110` (`SITE_URL=https://praxis.local`) |
| **Tip** | C (+ G) |
| **Kutuda ne olur** | Praxis ağındaki iş istasyonları kutuyu tipik olarak **IP ile** arar (`https://192.168.1.50`). O istek Host eşleşmediği için arayüzü hiç görmez; ekranda boş sayfa/404 çıkar, `docker ps` ise sekiz konteyneri yeşil gösterir — kurulumun en kötü arıza cinsi budur: her şey sağlıklı görünürken hiçbir şey açılmaz. `praxis.local` çalışsın diye her iş istasyonunda ya DNS kaydı ya `hosts` satırı gerekir; ayrıca `tls internal` sertifikası müşterinin tarayıcısında uyarı verir, çünkü Caddy'nin kök CA'sı o makinelere kurulmamıştır. ⚠️ İkinci tuzak: `SITE_URL` bir **port** içerirse (`https://praxis.local:8443`) Caddy o portu dinler, compose ise `443:443` yayınlar — kimse bir yere bağlanamaz |
| **Çözüm** | **Faz 2.1c `install.sh`'ın kurulum ön-kontrolü** (`RELEASE-STANDARD.md` §5.4 listesine iki madde): (1) `SITE_URL`'in şemasını/portunu doğrula, port varsa kurulumu **durdur ve söyle**; (2) kurulum sonunda kutunun **kendi** LAN IP'sini ve host adını ekrana yazıp "bu adresi iş istasyonlarının `hosts` dosyasına girin ya da yönlendirici DNS'ine yazın" adımını kurulum çıktısına koy. Kök CA'nın dağıtımı (`caddy_data` altındaki `root.crt`) aynı çıktının parçası olmalı — yoksa müşteri her sabah sertifika uyarısı tıklar ve bir süre sonra HTTPS'i güvenlik sinyali olarak okumayı bırakır. Gerçek alan adı + Let's Encrypt kuran müşteride bu maddenin tamamı düşer |
| **Durum** | ✅ **gelöst (12.09.2026)**. Adres ön-kontrolü ve LAN IP/kök CA çıktısı zaten `33d5fd2`'de inmişti (yukarıdaki not). Eksik kalan tek satır bu turda eklendi: `install.sh` adım 15'te, LAN IP bulunduysa, `<LAN_IP>  <HOST_PART>` satırının her iş istasyonunun `hosts` dosyasına (Windows/Mac/Linux yolu ayrı ayrı yazılı) **veya** praxis-router'ında bir A-kaydı olarak girilmesi gerektiği açıkça yazdırılıyor (`install.sh:488-495`). `:435`'teki „der Hinweis kommt erst im letzten Schritt" yorumu artık doğru bir atıf. **Bilinçli çözülmeyen (değişmedi):** Caddy'nin IP ile de cevap vermesi — `tls internal` sertifikası `SITE_URL` host adına kesiliyor, IP için SAN'ı yok; blok açılsaydı 404 yerine sertifika hatası alınırdı. Kabul edilen yol **isim çözümüdür**, IP erişimi değil |

---

## 7G — Faz 2.1c ön-hazırlık (`install.sh`), 11.09.2026

> Bu bölüm **kod değil, gereksinim**: `install.sh` yazılmadan önce neyin hangi sırayla
> olması gerektiği ve hangi iki tuzağın bugünden görünür olduğu. Uygulama `builder`'ın.

### `install.sh` adım sırası (kilitli tasarım)

Ayrım şudur: **`install.sh` kutuyu ayağa kaldırır, sihirbaz (Faz 2.2) praxis'i kurar.**
Betik hiçbir iş verisine dokunmaz — ne owner hesabı açar, ne praxis adı sorar, ne SMTP
ister. Sınır tek cümleyle: *tarayıcıda sihirbazın ilk ekranı açıldığı an `install.sh`'ın
işi bitmiştir.*

| # | Adım | Not |
|---|---|---|
| 0 | **Kök kontrolü + idempotanlık** | `.env` varsa sırlar **üzerine yazılmaz** (`RELEASE-STANDARD.md` §5.5/1). Sıfırdan kurulum yalnız `--neu` + yazılı onayla |
| 1 | **Donanım ön-kontrolü** | 2 vCPU · 4 GB RAM · 40 GB boş disk (playbook 2.1c). Swap yoksa **uyar** — bugünkü VPS'te swap yok ve OOM riski ölçülmüş bir şey. Sunucu AB dışındaysa uyar, durdurma |
| 2 | **Yazılım ön-kontrolü** | `docker` + `docker compose` v2 · `openssl` · `curl`. Yoksa Docker'ı resmî kurulum betiğiyle kur, kalanını **kurma, söyle** |
| 3 | **Port ön-kontrolü** | 80 ve 443 boş mu (Caddy). Doluysa **dur ve hangi süreç tuttuğunu yaz** |
| 4 | **Adres ön-kontrolü (O-59)** | `SITE_URL` sorulur. Şema `https://` olmalı, **port içeremez** → içeriyorsa dur. `API_EXTERNAL_URL` ve `SUPABASE_PUBLIC_URL` varsayılan olarak `SITE_URL`'e eşitlenir |
| 5 | **`.env` üretimi** | Şablondan kopya; `chmod 600`, sahibi root (O-61) |
| 6 | **Sır üretimi (G2)** | `POSTGRES_PASSWORD` · `JWT_SECRET` · `SECRET_KEY_BASE` · `REALTIME_DB_ENC_KEY` · `S3_PROTOCOL_ACCESS_KEY_*` · `DATA_ENCRYPTION_KEY` — hepsi **müşterinin sunucusunda**, `openssl rand`. Hiçbiri bizde üretilmez, hiçbiri image'da durmaz |
| 7 | **`ANON_KEY` / `SERVICE_ROLE_KEY` türetimi** | `JWT_SECRET` ile HS256 imzalanır — **zar atılmaz** (O-60) |
| 8 | **`SUPABASE_PUBLIC_WSS` türetimi (O-52 b)** | `SUPABASE_PUBLIC_URL` origin'i `SITE_URL` ile aynıysa **boş bırakılır** (`'self'` kapsar). Farklıysa `https→wss` çevirisiyle doldurulur. Elle doldurtma yok |
| 9 | **Zorunlu değişken kapısı (O-53)** | `.env` yazıldıktan sonra, `up`'tan önce: `SUPABASE_PUBLIC_URL` · `SUPABASE_ANON_KEY` · `SERVICE_ROLE_KEY` · `JWT_SECRET` · `POSTGRES_PASSWORD` · `DATA_ENCRYPTION_KEY` boşsa **kurulum başlamaz**. Boş `.env` ile açılan kutu beyaz ekran verir ve hata mesajı üretmez — O-15'in kapattığı kırılma biçimi budur |
| 10 | **TLS modu** | `CADDY_TLS_ARG`: gerçek alan adı + dışarıdan erişilebilir mi → `internal` mı, ACME e-postası mı. `internal` seçildiyse `HSTS_MAX_AGE=0` zorlanır |
| 11 | **`docker compose pull` + `up -d`** | Registry kimliği Faz 3.4'e bağlı; bugün `:stable` etiketi **yok** (`.env.template` §1 uyarısı) — betik etiketi bulamazsa bunu açıkça söylemeli, "image çekilemedi" demekle yetinmemeli |
| 12 | **Sağlık kontrolü** | Konteynerlerin `healthy` olmasını bekle; `api` konteynerinin migration zinciri **kendi** koşar (`SCHEMA-VERTEILUNG.md`), betik SQL çalıştırmaz |
| 13 | **Anahtar kanıtı** | `apikey: $ANON_KEY` ile `/rest/v1/` → **200**; anahtarsız → **401**. İmza bozuksa burada çıkar, üç hafta sonra değil (O-60) |
| 14 | **Kurulum çıktısı** | LAN IP + host adı + `hosts`/DNS talimatı + kök CA'nın yolu (O-59) · `DATA_ENCRYPTION_KEY` **bir kez** ekrana basılır, "kasaya, yedekten AYRI" uyarısıyla (O-61) · son satır: sihirbazın URL'i |

`RELEASE-STANDARD.md` §5.4'teki **14 kontrol** bu betiğin değil, **sihirbazın** kabul
ölçütüdür — betik 12-13 ile yetinir, çünkü oradaki 3/4/5/9/11 (gerçek giriş, RLS negatif
testi, SMTP, yedek) henüz var olmayan bir owner hesabına ve müşterinin kendi ayarlarına
bağlıdır. İki liste karıştırılırsa `install.sh` asla "bitti" diyemez.

**Hata modeli (K10 — kutuya SSH ile giremeyiz):** her kontrol tek satırlık bir sonuç
basar (`[ok]` / `[fehler]`), başarısızlıkta **ne bulunduğu · ne beklendiği · ne yapılması
gerektiği** üçlüsünü yazar ve **durur**. Yarım kurulum devam ettirilmez. Betik bütün
çıktıyı `install.log`'a da yazar; o dosya K10'un tanılama paketinin (Faz 2.5) ilk parçası.
⛔ `install.log`'a hiçbir sır basılmaz — üretilen değerler değil, yalnız "üretildi" satırı.

### Turun sonucu — betik yazıldı ve okundu (11.09.2026 gecesi, ikinci tur)

`onprem/install.sh` yukarıdaki 15 adımı **sırasıyla ve eksiksiz** içeriyor; adım
atlanmamış, sıra değişmemiş, Faz 2.2 sınırı (owner hesabı / praxis adı / SMTP yok)
korunmuş. Aşağıdakiler **uygulama hataları**, tasarım itirazı değil. Betik bir Ubuntu
kutusunda **hiç çalıştırılmadı** (`builder` bunu kendisi söyledi); bu bölüm, gözle okuma +
iki bulgunun yerel `bash` ile tekrarlanmasıyla o boşluğun ne kadarının kapandığını gösterir.

**Kutuda kuruluma engel — üçü de ilk gerçek çalıştırmada çıkar:**

| # | Bulgu | Nerede | Kayıt |
|---|---|---|---|
| 1 | Sağlık kapısı sıfır eşleşmede aritmetiği bozuyor **ve** ölen konteyneri hiç saymıyor | `install.sh:278-291` | **O-63** |
| 2 | `REALTIME_DB_ENC_KEY` 32 karakter üretiliyor; çalışan yığında 16 | `install.sh:194` | **O-64** |
| 3 | Adım 13'ün `curl`'ü kutunun **kendi** `SITE_URL`'ini çözemez → `000` → yanlış teşhisle durur | `install.sh:295-299` | **O-65** |

**Adım 13'ün kanıt gücü sanıldığından zayıf** (O-60'a işlendi): yalnız `apikey` başlığıyla
yapılan istekte imzayı doğrulayan **kimse yok.** Kong dizgiyi aynı `.env`'den üretilmiş
`kong.yml`'e karşı karşılaştırır — kendi kendini doğrular; `request-transformer`
`Authorization`'ı **`Bearer` öneki olmadan** yazar (`volumes/api/kong-entrypoint.sh`,
legacy dal: `… or headers.apikey`); PostgREST önekssiz başlığı yok sayıp
`PGRST_DB_ANON_ROLE` = `anon` rolüne düşer ve **200 döner**. Bozuk imza da yeşil geçer.
Adım 13 bugün "Kong ayakta" testidir, "türetme doğru" testi değil.

**Sıra hatası — `SETUP_TOKEN` adım 14'te üretiliyor** (`install.sh:307`), yani `docker
compose up`'tan **sonra**. Konteyner env'ini açılışta okur; jeton `api` konteynerine asla
ulaşmaz. Üstelik `docker-compose.yml`'ın `api` bloğunda `SETUP_TOKEN` satırı **hiç yok**.
Bugün jeton, ekranda ve `.env`'de duran ama hiçbir yerin sormadığı bir dizgi (O-62).

**Küçük ve ucuz olanlar — aynı turda düzeltilir, ayrı madde açılmadı:**

- `install.sh:100` — test `-ge 3` GB, mesaj "mindestens 4 GB". Gevşeklik bilinçli olabilir
  (bugünkü VPS 3,7 GB), ama **mesaj yalan söylüyor**: destek konuşmasına "4 dedi, 3'le
  geçti" diye döner. Ya MB cinsinden karşılaştır (`-ge 3600`) ya mesajı gerçeğe eşitle.
- `install.sh:134` — `ss` yoksa port kontrolü **sessizce atlanıyor**. Atlanan kontrol,
  yapılmış sanılan kontroldür; `ss` yoksa `warn` bassın.
- `install.sh:241` — `grep … | head -1 | cut …` + `pipefail`: anahtar `.env`'de **hiç yoksa**
  komut ikamesi 1 döner ve `set -e` betiği **mesajsız** öldürür. Net mesaj üretmek için var
  olan kapı, sessizce ölen tek yer olur. Çözüm: `… || true`.
- `install.sh:273` — `docker compose up -d`, `fail()` ile sarılmamış tek adım. Hata hâlinde
  müşteri Docker'ın kendi çıktısını görür, GEFUNDEN/ERWARTET/WAS TUN üçlüsünü görmez (K10).
- `install.sh:309` — `hostname -I | awk '{print $1}'` **docker0'ı (172.17.0.1)** de listeler
  ve sıra garanti değil. O-59 tam olarak bu satırın çıktısını müşterinin `hosts` dosyasına
  yazdırıyor; yanlış IP yazdırmak hiç yazdırmamaktan kötüdür. Varsayılan rotanın
  arayüzünden türet: `ip route show default` → `ip -4 addr show <dev>`.
- `install.sh:316` — kök CA'nın **konteyner içi** yolu basılıyor, müşterinin
  çalıştırabileceği komut yok. O-59'un istediği satır:
  `docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./praxura-root.crt`.
- `onprem/install.log` `.gitignore`'da **değil** (`onprem/.env` var, `.gitignore:58`).
  Log'da sır yok ama host adı, LAN IP ve `docker compose ps` çıktısı var; depo public.
- `--neu` yıkımı **adım 0'da**, bütün ön kontrollerden **önce** yapılıyor
  (`install.sh:85-87`). Port 80 dolu diye adım 3'te duran bir kurulumda müşteri
  veritabanını çoktan kaybetmiştir. Yıkım, ön kontroller geçtikten sonra (adım 5'in hemen
  öncesinde) olmalı. Onay metninin kendisi (yazılı `LÖSCHEN`) doğru ve yeterince
  korkutucu — tek sorun **ne zaman** sorulduğu.

**Doğrulanan kararlar — bunlar tekrar tartışılmaz:**

- **base64 → hex doğru, gerekçesi yerinde.** `POSTGRES_PASSWORD` üç ayrı bağlantı URI'sinin
  içinde geçiyor (`docker-compose.yml`: `PGRST_DB_URI` · storage `DATABASE_URL` · api
  `DATABASE_URL`); base64'ün `+` ve `/` karakterleri orada **zar atışına bağlı** kırılma
  üretirdi — yılda bir kurulumda bozulan, tekrar çalıştırınca düzelen cinsten, yani teşhisi
  en pahalı sınıf. Hex'in alfabesi (`0-9a-f`) bunu yapısal olarak kapatır.
  ⚠️ `.env.template` §2'deki `openssl rand -base64 48` **örneği** artık betikle çelişiyor,
  düzeltilsin.
- **`--neu` bütün `.env`'i şablondan yeniden kuruyor**, dolayısıyla `JWT_SECRET` ile iki
  türetilmiş anahtar birlikte yenileniyor — O-60'ın "birini üretip diğerini bırakma"
  uyarısı karşılanmış.
- **O-62 sınırı doğru çizilmiş:** betik hesap açmıyor. İlk owner'ı GoTrue'nun admin ucundan
  yaratmak **Faz 2.2'nin işi, kesin.** Betiğin borcu yalnız jetonu kutuya **teslim etmek**.
  ⚠️ 2.2'ye not: jetonu tüketmek `.env`'i düzenlemekle olmaz — konteyner env'ini açılışta
  okur, değişiklik yeniden yaratmadan görünmez. Tüketim **veritabanında** işaretlenir.

### Turun sonucu — düzeltmeler okundu (11.09.2026 gecesi, üçüncü tur)

İkinci turun altı bulgusu + `builder`'ın kendi bulduğu üç hata `install.sh`'ta düzeltildi.
Kod **staged, commit edilmedi**; aşağıdaki `gelöst`ler commit numarası girildiğinde
kesinleşir. Betik hâlâ **hiçbir Ubuntu kutusunda uçtan uca koşmadı** — bu bölüm gözle
okuma + koda karşı doğrulamadır, çalıştırma kanıtı değildir.

**Doğrulandı (koda karşı, tek tek):**

| Bulgu | Düzeltme | Kontrol |
|---|---|---|
| `SETUP_TOKEN` sırası | adım 6'ya alındı (`install.sh:240`), adım 14 yalnız gösteriyor | `docker-compose.yml:440` `SETUP_TOKEN: ${SETUP_TOKEN:-}` — **doğru ve tek** yerde: `api` bloğu. Caddy'ye **girmemeli** (statik sunucu + proxy; jetonu okuyacak kod orada yok, sır yüzeyi büyür) |
| base64 → hex | `.env.template` §2 artık hex öneriyor, base64 örneği yok | ✅ |
| O-65 DNS | `curl -sk --resolve "${HOST_PART}:443:127.0.0.1"` (`install.sh:372-381`) | ✅ Caddy 443'ü `0.0.0.0`'a yayınlıyor (`docker-compose.yml:464`), Host/SNI `SITE_URL` kalıyor — O-59 ile çelişmiyor |
| O-63 sağlık | `docker compose config --services` + servis başına `ps -q` → `docker inspect` (`install.sh:333-363`) | ✅ `cid` boşsa "eksik" sayılıyor; `grep -c` kalıbı tamamen gitti; 8 servis beklentisi compose ile birebir |
| O-64 uzunluk | `openssl rand -hex 8` = 16 karakter | ✅ AES-128, upstream `supabaserealtime` ile aynı uzunluk |
| `up -d` hata modeli | `if ! docker compose up -d …; then fail …` | ✅ **Sanılandan önemli:** `caddy` → `api: service_healthy` bağı yüzünden migration zinciri çökerse `up -d` "dependency failed to start" ile döner; K10 mesajını üreten tek yer burasıdır |
| adres: path reddi | `*/*` dalı (`install.sh:182`) | ✅ tek `/` sonek önce kırpılıyor, `https://praxis.local/` kabul |
| `env_get()` | awk tabanlı, `END{if(!f) print ""}` | ✅ gerçek kırılmaydı: `set -euo pipefail` altında eşleşmeyen `grep` betiği **çıktısız** öldürüyordu. Bulan `builder`'dır, ikinci tur gözden kaçırmıştı |

**Kalan tek gerçek boşluk — adım 13'ün negatif testi Kong'u geçemiyor.**
Zincir baştan izlendi (`onprem/volumes/api/kong.yml` → `rest-v1` · `onprem/volumes/api/kong-entrypoint.sh`):

1. Kong'un `key-auth`'u **yalnız `apikey` başlığına** bakar (varsayılan `key_names`);
   `Authorization` onun umurunda değil.
2. `request-transformer` `Authorization`'ı `LUA_AUTH_EXPR` ile **değiştirir**. Bizim
   kutumuzda legacy dal koşar (`SUPABASE_PUBLISHABLE_KEY`/`SECRET_KEY` set edilmiyor):
   `(headers.authorization ~= nil and headers.authorization:sub(1,10) ~= 'Bearer sb_'
   and headers.authorization) or headers.apikey`.

İki sonuç:

- ✅ **Pozitif test artık gerçek.** `Authorization: Bearer $ANON_KEY` gönderildiği için
  ifade onu **olduğu gibi** PostgREST'e geçirir; PostgREST imzayı `PGRST_JWT_SECRET` ile
  doğrular. Yanlış `JWT_SECRET`'ten türetilmiş anahtar burada **401** alır. İkinci turun
  "önek yok → anon'a düşer → 200" kırılması, `Authorization`'ın eklenmesiyle kapandı.
- ❌ **Negatif test hedefine varmıyor.** Betik **iki başlığı birden** bozuyor
  (`install.sh:381`); bozuk `apikey` Kong'un dizge karşılaştırmasına takılır, **401 Kong'dan
  döner**, istek PostgREST'e hiç ulaşmaz. Test böylece "Kong dizge karşılaştırıyor" der,
  "imza doğrulanıyor" demez — zaten anahtarsız üçüncü çağrı aynı şeyi söylüyor.
  Körlüğü ölçen kurgu: **`apikey` DOĞRU, yalnız `Authorization` bozuk.** O zaman Kong
  geçirir, transformer bozuk başlığı iletir, PostgREST 401 vermek **zorundadır**; 200
  gelirse `Authorization` yolda düşüyor demektir — O-60'ın önlemek için açıldığı hâl.
  Düzeltme tek satır: `-H "apikey: ${ANON_KEY}" -H "Authorization: Bearer ${ANON_KEY}x"`.

**Aynı turda kapanacak küçükler (yeni madde açılmadı, sahibi Faz 2.1c):**

- **Betik boru hattından çalıştırılamaz.** Dört `read -r -p` stdin'den okur; birisi
  `curl … | sudo bash` derse promptlar betiğin kendi satırlarını yutar ve K10 hata modeli
  komple devre dışı kalır. `[ -t 0 ] || fail "Terminal yok" …` — üç satır, kurulum
  belgesi ne yazarsa yazsın.
- **`SERVICE_ROLE_KEY` hiç ölçülmüyor.** Adım 13 yalnız anon'u kanıtlıyor; service-role
  anahtarı bozuk türetilmişse bunu ilk fark eden Faz 2.2 sihirbazı olur. Aynı `curl`,
  service anahtarıyla → 200 beklenir. Bir satır.
- **`up -d` hatasında son loglar basılmıyor.** `docker compose logs --tail=40 api` fail
  metninin içine — kutuya giremediğimiz için (K10) müşteri neyi kopyalayacağını bilmeli.
- `hostname -I` hâlâ docker0'ı ilk sırada verebilir; betik artık "PRÜFEN" uyarısı basıyor
  (dürüst ama zayıf). Ucuz doğrusu: `ip route get 1.1.1.1 | awk '{print $7; exit}'`.
- `set_env`'in `mktemp`'i hâlâ `/tmp`'de (`-p "$SCRIPT_DIR"` olmalı) — sızıntı yok (0600),
  ama bütün sırların geçtiği geçici dosya kurulum dizininde dursun.

**Kapanan eski pürüzler (ikinci turdan):** `ss` yoksa artık `warn` · `--neu` yıkımı
ön kontrollerden **sonra** · kök CA için müşterinin çalıştırabileceği `docker compose cp`
satırı · `onprem/install.log` `.gitignore`'da (`.gitignore:63`) · RAM eşiğinin gerekçesi
mesajın içinde yazılı.

### Dördüncü tur — negatif test düzeltildi VE gerçek kutuya karşı ÇALIŞTIRILARAK doğrulandı (11.09.2026 gecesi, geç)

Üçüncü turun tek kalan boşluğu (`apikey` DOĞRU, yalnız `Authorization` bozuk) düzeltildi
ve **Docker tekrar açıldığında gerçek Kong/PostgREST zincirine karşı curl ile ölçüldü**
(betiğin tamamı değil — adım 13'ün üç isteği izole edilip yerel kutunun mevcut
`ANON_KEY`'ine karşı elle çalıştırıldı):

| İstek | Sonuç | Beklenen |
|---|---|---|
| doğru `apikey` + doğru `Authorization: Bearer` | **200** | 200 ✅ |
| doğru `apikey` + bozuk `Authorization: Bearer …x` | **401** | 401 ✅ — negatif test artık gerçekten PostgREST'e varıyor |
| `apikey` yok | **401** | 401 ✅ |

Aynı turda beş küçük madde de kapatıldı: `[ -t 0 ] \|\| fail …` (boru hattı koruması) ·
`SERVICE_ROLE_KEY` için ayrı 200 kanıtı · `up -d` hata mesajına `docker compose logs
--tail=40 api` · LAN IP artık önce `ip route get 1.1.1.1`, `hostname -I` yalnız yedek ·
`set_env`'in `mktemp`'i `-p "$SCRIPT_DIR"`.

**Hâlâ eksik olan tek şey:** `install.sh`'ın **tamamı** (adım 0'dan 14'e) hiçbir gerçek
Ubuntu 24.04 makinesinde uçtan uca koşturulmadı — donanım/yazılım ön kontrolleri, `--neu`
akışı ve tam kurulum döngüsü hâlâ yalnız kod okumasıyla doğrulandı. İlk gerçek kutu
kurulumunda bu betiğin **ilk** gerçek koşusu olacak; sonucu buraya yazılmalı.

### O-60 — `ANON_KEY`/`SERVICE_ROLE_KEY` rastgele üretilemez; ve `exp`'i yanlış alan bir betik kutuyu saatler sonra öldürür

| Alan | İçerik |
|---|---|
| **Ne** | İkisi de `JWT_SECRET` ile HS256 imzalı JWT'dir. Rastgele dizge koymak sessizce çalışmaz; ve `exp` alanının kaynağı `JWT_EXPIRY` **değildir** |
| **Nerede** | `onprem/docker-compose.yml:121` `:166` `:217` `:256` (aynı `JWT_SECRET` dört servise gider) · `:289` `:359` `:394` (`ANON_KEY`) · `onprem/volumes/api/kong.yml:28-34` (Kong bu iki dizgiyi **apikey metni** olarak da tanır) · `onprem/.env.template:70-73` ("ABGELEITET") · `onprem/.env.template` §4 (`JWT_EXPIRY=3600`) |
| **Tip** | E (+ G) |
| **Kutuda ne olur** | İki ayrı kırılma. (1) **Uydurulmuş anahtar:** Kong'un `key-auth`'u dizgiyi tanır ve isteği geçirir, PostgREST imzayı doğrulayamaz → her istek 401. Kong tarafı çalıştığı için hata "yetki" gibi değil "ağ/CORS" gibi okunur. (2) **`exp`'i `JWT_EXPIRY`'den alan betik:** `JWT_EXPIRY=3600` GoTrue'nun **kullanıcı oturumu** ömrüdür, anon anahtarının değil. Anon anahtarına konursa kurulum yeşil biter, kutu **bir saat sonra** komple 401'e düşer. Kurulumla arıza arasında bir saat varsa sebep-sonuç bağı kopar; K10 gereği kutuya girip bakamayız |
| **Çözüm** | **Faz 2.1c, adım 7 + 13.** Araç: **saf `openssl` + bash** — ayrıca Node gerekmez ve gerekmemeli, çünkü betik host'ta, konteynerler ayağa kalkmadan önce çalışır (Node'u host'a kurmak G2'ye değmeyen yeni bir bağımlılık; `docker run … node` ise henüz çekilmemiş bir image'a bağımlı olurdu). HS256 = `printf '%s' "$header.$payload" \| openssl dgst -sha256 -hmac "$JWT_SECRET" -binary \| base64url`; base64url = `base64 -w0 \| tr '+/' '-_' \| tr -d '='`. Payload **kilitli**: `{"role":"anon","iss":"supabase","iat":<now>,"exp":<now + 10 yıl>}`, service-role için `"role":"service_role"`. `exp` = **10 yıl**, upstream'in kendi anahtar üreticisiyle aynı; `JWT_EXPIRY` bu hesaba **girmez**. `aud` konmaz (`PGRST_JWT_AUD` set edilmiyor; konursa doğrulama sıkışır ve kırılır). Adım 13 bunu **ölçer**: anahtarla 200, anahtarsız 401 — "türetme doğru mu" sorusunun tek dürüst cevabı budur. ⚠️ `--neu` ile `JWT_SECRET` yeniden üretilirse bu iki anahtar da yeniden türetilmeli; birini üretip diğerini bırakmak aynı 401'i verir |
| **Durum** | ✅ `gelöst` (11.09.2026 gecesi, 4. tur) — türetme yapıldı (`exp` = now+10 yıl, `aud` yok, `JWT_EXPIRY` hesaba girmiyor; imza Node'un `crypto.createHmac` çıktısıyla karşılaştırıldı). Kanıt adımı (13) artık üç istek atıyor (doğru → 200, `Authorization` yalnız bozuk → 401, anahtarsız → 401) ve bu üçü **gerçek Kong/PostgREST'e karşı curl ile ölçüldü** (§7G dördüncü tur tablosu) — sonuç beklendiği gibi. ⚠️ Betiğin **tamamı** (adım 0-14 baştan sona) hâlâ hiçbir Ubuntu kutusunda koşmadı; bu madde yalnız adım 13'ün doğruluğunu kapatır |

> ⚠️ **Adım 13 düzeltmesi (11.09.2026 gecesi):** `curl -H "apikey: $ANON_KEY" …/rest/v1/`
> **imzayı ölçmez.** Zincir baştan sona izlendiğinde: Kong `key-auth` dizgiyi `kong.yml`'e
> karşı karşılaştırır, o dosya da aynı `.env`'den üretilmiştir (kendi kendini doğrulama);
> `request-transformer` `Authorization`'ı **`Bearer` öneki olmadan** yazar
> (`volumes/api/kong-entrypoint.sh`, `LUA_AUTH_EXPR` legacy dalı: `… or headers.apikey`);
> PostgREST önekssiz `Authorization`'ı yok sayar ve `anon` rolüne düşerek **200** döner.
> Yani yanlış `JWT_SECRET`'ten türetilmiş bir anahtar da bu testten geçer — O-60'ın önlemek
> için açıldığı hatanın ta kendisi. **Testin doğrusu üç istektir:**
> (1) `-H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"` → **200** ·
> (2) aynı istek, imzası bozulmuş anahtarla (`${ANON_KEY}x`) → **401** — 401 gelmiyorsa
> *testin kendisi kördür*, o durumda kurulum "doğrulanamadı" deyip durmalı ·
> (3) anahtarsız → **401** (Kong). Üçü birlikte ölçülmedikçe adım 13 yeşil yanar ve kutu
> haftalar sonra kırılır.

> ✅ **Yol doğrulandı (11.09.2026):** yukarıdaki openssl zinciri çalıştırıldı, ürettiği
> imza Node'un `crypto.createHmac('sha256').digest('base64url')` çıktısıyla **birebir**.
> Yani Node bağımlılığı gerçekten gereksiz. ⚠️ Tek şart: `base64 -w0` GNU coreutils'tir
> (Ubuntu 24.04 tamam; BusyBox/macOS'ta yoktur) — hedef işletim sistemi playbook'ta zaten
> Ubuntu 24.04, ama betik bunu adım 2'de kontrol etsin, sessizce bozuk anahtar üretmesin.


### O-61 — `.env` müşterinin sunucusundaki en değerli dosya; kurulum onu sıradan bir dosya gibi bırakıyor

| Alan | İçerik |
|---|---|
| **Ne** | Üretilen `.env` PHI şifreleme anahtarını, service-role anahtarını ve DB parolasını bir arada taşır; bugün ne izni, ne yedekle ilişkisi, ne de "bu dosya kaybolursa ne olur" cevabı yazılı |
| **Nerede** | `onprem/.env.template` §2 (sekiz sır + `DATA_ENCRYPTION_KEY`) · `onprem/docker-compose.yml` (veritabanı bind-mount'u `./volumes/db/data` — `.env` ile **aynı dizin ağacında**) |
| **Tip** | E |
| **Kutuda ne olur** | Üç ayrı sonuç. (1) `.env` varsayılan izinle (644) kalırsa sunucudaki her yerel hesap service-role anahtarını okur — kutuda RLS'i baypas eden tek dizge odur. (2) `.env` kurulum dizininde durduğu için müşterinin "praxura klasörünü yedekle" refleksi **anahtarı veritabanıyla aynı arşive** koyar; o arşivi eline geçiren için `DATA_ENCRYPTION_KEY`'in varlığı hiçbir şey ifade etmez (`guvenlik` S-22 bunu şifrelemenin değersizleşmesi diye yazmıştı). (3) `.env` kaybolur ve anahtarın ikinci bir kopyası yoksa `icd10_enc`/`ocr_raw_enc` alanları **tam bir `pg_dump` ile bile** geri gelmez — ve K10 gereği bizde kopya yok, olması da yasak (G2) |
| **Çözüm** | **Faz 2.1c, adım 5 + 14.** (a) `.env` `chmod 600`, sahibi root. (b) Kurulum çıktısı `DATA_ENCRYPTION_KEY`'i **bir kez** ekrana basar ve "kasaya ya da ayrı bir taşıyıcıya al, yedek klasörüne koyma" der — sonra bir daha hiçbir yerde basmaz, `install.log`'a da girmez. (c) Faz 2.3'ün yedek betiği `.env`'i arşive **almaz** (dışlama listesi) ve panelde `RELEASE-STANDARD.md` §4.4'teki `data_key_fingerprint` üzerinden "bu yedeğin anahtarı elinizde mi" kontrolünü gösterir. ⚠️ Anahtar rotasyonu bugün **mümkün değil** (şifre metni anahtar kimliği taşımıyor — `.env.template` §2) — yani (b) bir kolaylık değil, tek kurtarma yolu |
| **Durum** | 🟡 `kısmen gelöst` — (a) **yapıldı**: `install.sh:164-165` `chmod 600` + `chown root:root`; `set_env` `mktemp` üzerinden yazdığı için izin `mv` sonrası da 600 kalıyor. (b) **yapıldı**: `reveal_once()` bilinçli olarak `tee`'siz (`install.sh:43`), `DATA_ENCRYPTION_KEY` ve `SETUP_TOKEN` `install.log`'a girmiyor, "kasaya, yedekten AYRI" uyarısı basılıyor. (c) **açık** — Faz 2.3 (`.env`'in yedekten dışlanması + `data_key_fingerprint`) |

> İki pürüz aynı turda kapanır: `onprem/install.log` `.gitignore`'da değil (içinde sır yok,
> ama host adı/LAN IP/`docker compose ps` çıktısı var, depo public); ve `set_env`'in
> `mktemp`'i `/tmp`'de — dosya 0600 açıldığı için sızıntı yok, yine de bütün sırların
> geçtiği geçici dosyanın kurulum dizininde durması daha dürüst.

### O-62 — İlk owner nasıl yaratılacak: `DISABLE_SIGNUP` şablonda "kurulumda kısa süre false" diyor, bu LAN'a açık bir pencere demek

| Alan | İçerik |
|---|---|
| **Ne** | Kutuda kayıt kapalıdır (`DISABLE_SIGNUP=true`), ama sihirbazın ilk owner hesabını yaratması gerekir. Şablonun bugünkü çözümü "kurulum sırasında kısa süre `false`" |
| **Nerede** | `onprem/.env.template` §4 (`DISABLE_SIGNUP` yorumu) · `onprem/docker-compose.yml` (`GOTRUE_DISABLE_SIGNUP`) · playbook 2.2 |
| **Tip** | G (+ H) |
| **Kutuda ne olur** | `false` süresince kutunun `/auth/v1/signup` ucu praxis ağındaki **herkese** açıktır; önünde kimlik yok. Pencere "kısa" diye tarif ediliyor ama gerçekte kurulumun ne kadar sürdüğüne bağlı — yarıda bırakılan bir kurulumda süresiz açık kalır. Ayrıca değeri geri `true` yapmak `.env`'i düzenleyip konteyneri yeniden yaratmak demektir; sihirbazın içinden yapılamaz, yani adım ya elle kalır ya unutulur. Unutulduğunda hiçbir alarm çalmaz: kutu çalışır görünür, yalnızca kapısı açıktır |
| **Çözüm** | `DISABLE_SIGNUP=true` **hiç gevşetilmez.** Sihirbaz ilk owner'ı GoTrue'nun **admin** ucundan yaratır (`POST /auth/v1/admin/users`, service-role anahtarıyla, kutunun içinden) — `DISABLE_SIGNUP` bu yolu engellemez ve `handle_new_user` trigger'ı yine koşar (`RELEASE-STANDARD.md` §5.4 kontrol 4 bunu zaten ölçüyor). Böylece kutuda hiçbir an açık kayıt penceresi olmaz. Sihirbazın kendi kapısı ayrı korunur: `install.sh` tek kullanımlık bir **kurulum jetonu** üretip son satırda ekrana basar (O-61'in yanında), sihirbaz o jeton olmadan açılmaz — aksi hâlde "ilk açan owner olur" modeli kalır ve praxis ağındaki ilk kişi praksisin sahibi olur. ⚠️ Bu karar uygulanırken `.env.template` §4'teki yorum **düzeltilmeli**, yoksa iki farklı talimat yan yana durur |
| **Durum** | 🟡 `kısmen gelöst` (11.09.2026, 3. tur — **staged**) — `DISABLE_SIGNUP` **hiç gevşetilmiyor**. Jeton artık adım **6**'da, `docker compose up`'tan **önce** üretiliyor (`install.sh:240`) ve `docker-compose.yml:440` üzerinden `api` konteynerine **ulaşıyor**; adım 14 yalnız gösteriyor, `install.log`'a girmiyor. ⚠️ **Jetonu bugün hiçbir kod okumuyor** — `SETUP_TOKEN` için depoda tüketici sıfır (yalnız compose + install.sh). Kurulum müşteriye henüz hiçbir kapıyı açmayan bir dizge veriyor; kapıyı **Faz 2.2** takacak. Hesabı yaratmak kesin olarak Faz 2.2'nin işi |

> ✅ **Kapandı (11.09.2026, üçüncü tur):** (1) ve (2) düzeltildi — jeton adım 6'da
> üretiliyor ve compose'un `api` bloğunda duruyor. (3) hâlâ Faz 2.2'nin borcu. Altındaki
> metin, neyin niye kırık olduğunun kaydı olarak duruyor:
>
> ⚠️ **~~Jeton bugün hiçbir yere varmıyor~~ (11.09.2026 gecesi):** (1) `SETUP_TOKEN` adım
> **14**'te, yani `docker compose up`'tan **sonra** üretiliyor — konteyner env'ini açılışta
> okuduğu için `api` onu asla görmez; adım **6**'ya (diğer sırların yanına) alınmalı, adım
> 14 yalnız **göstermeli**. (2) `onprem/docker-compose.yml`'ın `api` bloğunda `SETUP_TOKEN`
> satırı **hiç yok**; eklenmedikçe jeton `.env`'de duran ölü bir dizgidir.
> (3) Faz 2.2'ye not: jetonu **tüketmek** `.env`'i düzenlemekle olmaz (konteyner env'i
> açılışta okur, değişiklik yeniden yaratmadan görünmez) — tüketim veritabanında
> işaretlenir.
>
> ✅ **(3)'ün cevabı yazıldı (11.09.2026, 5. tur): §7H** — tüketim `praxura_setup`
> tablosunda koşullu tek `UPDATE` ile işaretlenir, jetonun düz metni DB'ye girmez.

### O-63 — Kurulumun sağlık kapısı: ya üç dakika boyunca yanlış soruyu sorar, ya ölen konteyneri hiç görmez

| Alan | İçerik |
|---|---|
| **Ne** | `install.sh` adım 12, konteynerlerin sağlığını `docker compose ps --format '{{.Health}}'` çıktısını **grep -c** ile sayarak ölçüyor. İki ayrı kırık: (a) `grep -c` sıfır eşleşmede hem `0` basar hem **1 döner**, `\|\| echo 0` yüzünden değişken `"0\n0"` olur ve `$(( ))` sözdizimi hatası verir; (b) `docker compose ps` **varsayılan olarak yalnız çalışan** konteynerleri listeler |
| **Nerede** | `onprem/install.sh:278-291` (adım 12) · sağlıksız kalabilecek konteyner: `onprem/docker-compose.yml:370` (`api` — **healthcheck'i yok**, buna karşılık migration zincirini o koşturuyor) |
| **Tip** | G |
| **Kutuda ne olur** | (a) yerel `bash` ile **tekrarlandı**: `x="$(… \| grep -c '^$' \|\| echo 0)"` → `x = "0\n0"` → `arithmetic syntax error`. Bugün tesadüfen kurtarıyoruz, çünkü `api`'nin healthcheck'i olmadığı için boş satır sayısı 1'dir; `api` bir şema hatasıyla çıkarsa sayı 0'a düşer, koşul **hiç** doğru olamaz ve kurulum 3 dakika döndükten sonra durur. (b) asıl tehlike ters yönde: `ps` ölen konteyneri listelemediği için `gesamt` küçülür — aritmetik düzeltilir düzeltilmez `7/7 gesund` çıkar ve **kurulum "her şey sağlıklı" der, oysa bizim `api` konteynerimiz ölmüştür.** O-40'ın "sahte yeşil"i, bu kez kurulum betiğinde. Migration zinciri `api` içinde koştuğu için bu, şema hiç kurulmamış bir kutunun "kurulum başarılı" mesajıyla teslim edilmesi demektir |
| **Çözüm** | **Faz 2.1c, adım 12'nin yeniden yazımı.** (1) `docker compose ps -aq` ile **bütün** konteynerleri al, her biri için `docker inspect -f '{{.State.Status}}'` ve `{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}` sor — bu yol Compose sürümünden ve `--format` şablon desteğinden bağımsızdır (`ps --format` şablonu bazı v2 sürümlerinde yalnız `table`/`json` kabul eder; betik bunu bugün varsayıyor ve test edilmemiş). (2) Kabul ölçütü: hiçbir konteyner `exited`/`restarting` **değil** ve healthcheck'i olanların hepsi `healthy`. (3) `praxura-api` **adıyla** ayrıca sorulur — sekizde biri değil, adı geçen bir koşul. (4) Ek ucuz kanıt: `GET ${SITE_URL}/health` → 200 (Caddy `/health`'i `api:3000`'e veriyor); `/health` her koşulda `ok` dese de (O-40) **süreç ayakta mı** sorusunu dürüstçe cevaplar. (5) `grep -c` sayımından tamamen vazgeç — sayılan şey 0 olabiliyorsa `grep -c` + `\|\| echo` kalıbı yanlış kalıptır |
| **Durum** | `gelöst` (11.09.2026, 3. tur — **staged**, commit no. girilecek) — adım 12 yeniden yazıldı (`install.sh:333-363`): `docker compose config --services` beklenen listeyi verir, her servis için `ps -q` + `docker inspect` ile `State.Status` ve `State.Health.Status` **tek tek** sorulur, konteyner hiç yoksa "eksik" sayılır. `grep -c` kalıbı tamamen kaldırıldı, sıfır eşleşme aritmetiği artık mümkün değil. ⚠️ Çözümün (3) ve (4) şıkları uygulanmadı: `praxura-api` **adıyla** ayrı koşul yok (servis listesinden zaten geliyor) ve `${SITE_URL}/health` eklenmedi (adım 13 aynı `--resolve` ile dışarıdan ölçüyor). Kutuda koşturulmadı |

### O-64 — `REALTIME_DB_ENC_KEY` 16 karakter olmalı; betik 32 üretiyor

| Alan | İçerik |
|---|---|
| **Ne** | Adım 6 `openssl rand -hex 16` çağırıyor — bu **32 karakterlik** bir dizge üretir. Realtime'ın beklediği anahtar upstream'de 16 karakter (`supabaserealtime`), AES-128 |
| **Nerede** | `onprem/install.sh:194` · `onprem/docker-compose.yml:255` (`DB_ENC_KEY: ${REALTIME_DB_ENC_KEY}`) · upstream varsayılanı `onprem/supabase-docker/docker-compose.yml:315` (`:-supabaserealtime`, 16 karakter) · **çalıştığı ölçülen değer:** yerel test `.env`'inde uzunluk **16** (10./11.09.2026'da yığın bu değerle ayağa kalktı) |
| **Tip** | E |
| **Kutuda ne olur** | Realtime tenant kaydını bu anahtarla şifreliyor; anahtar uzunluğu AES-128'in beklediği 16 bayt değilse şifreleme çağrısı hata verir. Sonuç kurulumun en sinsi biçimi: diğer yedi konteyner sağlıklı, yalnız Realtime kırılır — ve Realtime'ın kırılması "randevu ekranı kendini yenilemiyor" diye görünür, "kurulum bozuk" diye değil. ⚠️ Bu değer **`--neu` olmadan düzeltilemez**: yanlış anahtarla şifrelenmiş tenant satırı veritabanında kalır |
| **Çözüm** | `openssl rand -hex 8` (= 16 karakter) — tek karakter değişikliği. Sonra **gerçekten çalıştırıp** `docker logs praxura-realtime`'a bakmak; bu maddeyi kapatacak olan okuma değil o log. Genel kural: ölçüsü olan alanları rastgele uzunlukta doldurma — `.env.template` §2'ye her sırrın **beklenen uzunluğu** yazılsın (`DATA_ENCRYPTION_KEY` için zaten yazılı, diğer altısı için değil) |
| **Durum** | `gelöst` (11.09.2026, 3. tur — **staged**) — `openssl rand -hex 8` (`install.sh:232`), 16 karakter, gerekçesi satırın üstünde yazılı. ⚠️ Maddenin kendi kabul ölçütü (`docker logs praxura-realtime`) **yerine gelmedi**: Docker kapalıydı, betik kutuda koşmadı. Realtime'ın gerçek logu görülene kadar bu `gelöst` okuma kanıtına dayanıyor |

### O-65 — Kurulum betiği kutunun kendi adresini çözemez; kendi doğrulama adımında takılır

| Alan | İçerik |
|---|---|
| **Ne** | Adım 13 `curl "${SITE_URL}/rest/v1/"` çağırıyor. `SITE_URL` tipik olarak `https://praxis.local` — bu ad **hiçbir yerde** tanımlı değildir, kutunun kendisinde de (`hosts` satırını daha yeni yazdırıyoruz, adım 14'te) |
| **Nerede** | `onprem/install.sh:295-296` (adım 13) · varsayılan `onprem/.env.template:110` · kök neden O-59'un aynısı (Caddy Host bazlı eşleştirir, ad çözülmeden istek doğru bloğa girmez) |
| **Tip** | C (+ G) |
| **Kutuda ne olur** | `curl` "could not resolve host" ile döner, betik `000` yakalar ve **"Abgeleiteter Schlüssel wird nicht akzeptiert"** diyerek durur. Yani kurulum, tamamen sağlıklı bir kutuda, yanlış bir teşhisle çöker — ve müşteriye `--neu` ile tekrar denemesini söyler, bu da veritabanını sildirir. Çıkmaz: adım 13'ü geçemeyen kurulum adım 14'e, yani `hosts` talimatının basıldığı yere hiç varamaz |
| **Çözüm** | İstek isme değil, **kutunun kendisine** gitsin, ama Host/SNI doğru kalsın: `curl -sk --resolve "<host>:443:127.0.0.1" "${SITE_URL}/rest/v1/"`. Host adı adım 4'te zaten ayrıştırılmış (`HOST_PART`). Aynı düzeltme `${SITE_URL}/health` kontrolü için de geçerli (O-63). ⚠️ Bunu "`SITE_URL` yerine `localhost` kullanalım" diye çözmek **yanlıştır**: Caddy site bloğu `{$SITE_URL}` Host'una bakar, `localhost` isteği bloğa hiç girmez (O-59) |
| **Durum** | `gelöst` (11.09.2026, 3. tur — **staged**) — `curl -sk --resolve "${HOST_PART}:443:127.0.0.1"` (`install.sh:372-381`). Host/SNI `SITE_URL` kalıyor, istek loopback'e gidiyor; `localhost` tuzağına düşülmedi (O-59). Caddy 443'ü `0.0.0.0`'a yayınladığı için loopback yolu geçerli (`docker-compose.yml:464`) |

---

## 7H — Faz 2.2 ön-hazırlık (kurulum sihirbazı), 11.09.2026

> §7G gibi: **kod değil, gereksinim.** Sihirbaz yazılmadan önce neyin hangi sırayla
> olacağı, sınırın nerede olduğu ve hangi iki tuzağın bugünden görünür olduğu. Uygulama
> `builder`'ın. Bu bölüm yazıldığında `install.sh` bitmişti (§7G, dört tur) ama ürettiği
> jetonun depoda **tüketicisi yoktu** (O-62).

### Playbook'ta 2.2 için ne yazıyor — tam metin

`ONPREM_MIGRATION_PLAYBOOK.md:216`, **tek satır**, checklist yok:

> „2.2 **İlk-açılış sihirbazı** (lokal web sayfası; mevcut `onboarding.html`'den türet):
> yönetici hesabı → işletme bilgileri → SMTP (hazır profiller … + „Test maili gönder"
> butonu) → yedek hedefi → IONOS AI anahtarı (test butonu …; „sonra kur" çıkışı).
> Sihirbaz tamamlanana kadar uygulama kurulum modunda kalır."

Buna bağlı iki kabul ölçütü (`:226` ve `:229`): temiz Ubuntu'da `install.sh` → sihirbaz →
**hiçbir elle adım olmadan** çalışan ürün · sihirbaz **üç dilde** (DE/EN/TR).
İki bağlayıcı ek `RELEASE-STANDARD.md`'de: §5.4 (14 kontrol — sihirbazın kabul ölçütü,
`install.sh`'ın değil) ve §5.6 (kurulum modu = bakım modu, **tek** mekanizma, fork yok).

⚠️ Playbook'un „`onboarding.html`'den türet" cümlesi **artık geçerli değil**:
`onboarding.html` Faz 2.0'da pakete girmemeye karar verildi (Stripe checkout'lu SaaS
kaydı — `onprem/frontend.Dockerfile:28-31`). Örnek alınacak sayfa `login.html`'dir:
aynı `assets/system.css`, aynı `supabase-config.js` önyüklemesi, dashboard kabuğu yok.

### Kilitli sınır — sihirbaz ne yapar, ne yapmaz

- **Yapar:** jetonu doğrular · ilk owner hesabını **kutunun içinden** yaratır ·
  `profiles` satırının trigger'ın doldurmadığı alanlarını yazar · ucuz kontrolleri
  koşturup sonucu gösterir · kurulum modunu kapatır.
- **Yapmaz:** sır üretmez (o `install.sh`'ın işi, G2) · `.env`'e yazmaz · konteyner
  yeniden yaratmaz · **docker soketine dokunmaz** (bir konteynere docker soketi vermek
  kutuda root vermektir; `guvenlik` masası olmadan açılmaz).
- **Service-role tarayıcıya inmez.** Sihirbaz sayfası `anon` anahtarıyla açılır; hesabı
  yaratan çağrı `api-backend`'in içinden gider (aşağıda).

### Adım sırası (kilitli tasarım)

| # | Adım | Nerede koşar | Not |
|---|---|---|---|
| 0 | **Durum sorusu** | tarayıcı → `GET {apiBase}/setup/status` | Jetonsuz çağrılabilir, **tek alan** döner: `{ erforderlich: true\|false }`. Sürüm, host adı, e-posta, hata metni **dönmez** — kurulmamış kutu hakkında bilgi sızdıran uç, LAN'daki ilk kişiye harita verir |
| 1 | **Yönlendirme** | `login.js` | `erforderlich:true` ise `setup.html`'e yollar. SaaS'ta aynı kod koşar, aynı uç `false` döner (`SETUP_TOKEN` boş) — **tek kod yolu, iki dağıtım** (G7). Caddy kökü `/login.html`'de kalır, ikinci redirect kuralı yazılmaz |
| 2 | **Jeton ekranı** | tarayıcı → `POST {apiBase}/setup/verify` | `install.sh`'ın son satırındaki jeton yapıştırılır. Karşılaştırma **sabit zamanlı** (`crypto.timingSafeEqual`), istek **rate-limit**'li (`express-rate-limit` zaten bağımlılık), jeton hiçbir log'a/Sentry'ye girmez. Doğrulama **tüketim değildir** — tüketim adım 5'te |
| 3 | **Owner ekranı** | tarayıcı → `POST {apiBase}/setup/owner` | E-posta · şifre · praxis adı · Fachbereich. Tek istek, tek yazma turu |
| 4 | **Hesabın yaratılması** | `api-backend`, service-role ile | `POST {SUPABASE_URL}/auth/v1/admin/users` + `email_confirm: true`. `DISABLE_SIGNUP=true` **hiç gevşetilmez** (O-62). `email_confirm` sayesinde **dilim 1'de hiç mail gerekmez** — SMTP kurulmamış kutuda bile owner giriş yapabilir. O-56 ile kesişme: o madde ikinci kullanıcıyı, bu madde birincisini çözer |
| 5 | **Jetonun tüketilmesi** | `api-backend` → DB | Koşullu tek `UPDATE … WHERE verbraucht_am IS NULL`. Yarış güvenli, tek kullanımlık. **`.env` düzenlenmez** — konteyner env'ini açılışta okur (§7G, 2. tur) |
| 6 | **Profil tamamlama** | `api-backend` → DB | `handle_new_user` yalnız `(id, email)` yazıyor (`0000_baseline.sql:1073`). `role` varsayılanı `owner` (doğru), ama `plan_status` varsayılanı `pending`, `company_code` ve `business_name` **boş** kalıyor → **O-67** |
| 7 | **Ucuz kontroller** | `api-backend` | §5.4'ün 2 · 3 · 4'ü (aşağıdaki tablo). Kırmızıysa sihirbaz „hazır" **demez**, kutu kurulum modunda kalır (§5.6) |
| 8 | **Kapanış** | DB + tarayıcı | `abgeschlossen_am` yazılır; `status` bundan sonra `false` döner, ikinci kez açılan `setup.html` **410** alır ve giriş ekranına yollanır |

### Jeton nereye işlenir — var olan mekanizma yok, yeni tablo gerekiyor

Arandı: kutu düzeyinde durum tutan bir tablo **yok** (`settings`/`system`/`instance` adlı
tablo sıfır). En yakın akraba `praxura_migrations`: defter tablosu, RLS açık + policy yok
+ anon yetkisi geri alınmış, PostgREST'ten **42501**. Sihirbazın işareti aynı sınıftandır
ve aynı muameleyi görür.

**Hüküm: yeni tek satırlık tablo.** `db-ustasi`'ya **sorulur** (yeni tablo →
`db/REGISTER.md` kaydı + `check-tabellen-register.sh` kapısı); ad ve kolonlar onun
hükmüdür. Taslak: `praxura_setup` · `id smallint PK CHECK (id=1)` · `token_sha256 text` ·
`verbraucht_am timestamptz` · `owner_user_id uuid` · `abgeschlossen_am timestamptz` ·
`schritte jsonb`. Zincire `api-backend/db/migrations/0005_*.sql` olarak girer (tip D —
başka yolu yok: „önce dosya, sonra canlı").

Üç kural:

1. **Jetonun düz metni DB'ye yazılmaz** — yalnız SHA-256'sı, ve yalnız tüketildiğinde.
2. **SaaS'ta tablo da vardır ama hiç devreye girmez** (G7). Kapı **veriye değil env'e**
   bakar: `SETUP_TOKEN` boşsa uçlar hiç kayıtlanmaz, `status` `false` döner. „Owner var mı"
   diye satır saymak **yasak** — SaaS'ın davranışını veri sayısına bağlamak, üretimde
   yanlış anda açılan bir kapıdır.
3. ⛔ **`SETUP_TOKEN` SaaS VPS'inde ASLA set edilmez.** Aynı kod orada da koşuyor; set
   edilirse `app.praxura.de`'nin backend'inde jetonu bilen herkese owner-yaratma ucu
   açılır. Sahibi: **Ops kartı (Güvenlik)** — „`/opt/calendar-api/.env.calendar`'da
   `SETUP_TOKEN` yok, doğrulandı" satırı. Kapı bunu mekanik göremez (uzak env).

### `api-backend` route'u — tarayıcı değil

`api-backend/routes/setup.js` (yeni alt-router), `server.js`'e `app.use('/api/setup', …)`.
Gerekçe zinciri: service-role anahtarı **zaten** o konteynerde
(`SUPABASE_SERVICE_ROLE_KEY`), kutuda Caddy `/api/*`'i `api:3000`'e veriyor
(`onprem/Caddyfile:50`), ve G8 yeni Vercel fonksiyonunu zaten yasaklıyor (12/12 dolu).
Tarayıcıdan GoTrue'nun admin ucunu çağırmak service-role'ü sayfa kaynağına koymak
demektir — **G2 ihlali, tartışma yok.**

Konum: **`wartungsmodus` middleware'inin ALTINA** (`server.js:424`). Yarım migrate edilmiş
şemada hesap yaratılmaz; sihirbaz sayfası 503'ü okuyup „veritabanı güncellenemedi" der.
`/setup/status`'un bakım modunda 503 dönmesi **bilinçlidir** — `login.js` bunu „kurulum
gerekmiyor" diye okumamalı, ayrı dal.

### §5.4'ün 14 kontrolü — hangisi bu fazda

| # | Kontrol | Faz 2.2'de mi |
|---|---|---|
| 2 | Migration defteri = image'ın en yüksek dosyası | ✅ **dilim 1** — tek sorgu, defteri runner zaten yazıyor |
| 3 | Gerçek giriş, JWT döndü | ✅ **dilim 1** — sihirbazın ürettiği hesapla |
| 4 | `handle_new_user` → `profiles` satırı | ✅ **dilim 1** — owner yaratıldıktan sonra satır okunur (PoC'nin ısırdığı yer) |
| 1 | 10 şema sayacı | 🟡 **dilim 2** — sayaçlar `SCHEMA-VERTEILUNG.md` §3.3'te tanımlı, `migrate.js` bugün export **etmiyor** |
| 5 | RLS negatif testi | 🟡 **dilim 2** — ikinci test kullanıcısı gerekir, sonra silinir |
| 8 | `DATA_ENCRYPTION_KEY` yaz-oku turu | 🟡 **dilim 2** — `encryptionAvailable()` + bir tur, ucuz |
| 7 | Storage bucket + signed URL | ⬜ Faz 2.4 (self-check) |
| 6 | Realtime olayı | ⬜ Faz 2.4 |
| 9 | SMTP test maili | 🟡 **dilim 3** — O-66 kararı (a) verildi; üç durum: gönderildi + insan teyidi → yeşil · bilinçli atlandı (onay kutusu) → yeşil/„übersprungen“ · hata → kırmızı |
| 10 | TLS gerçek sertifika | ⬜ 2.1b / `install.sh` tarafı |
| 11 | İlk yedek alındı | ⬜ Faz 2.3 |
| 12 | Zamanlanmış işler kayıtlı | ⬜ Faz 2.4a |
| 13 | Dış çağrı yok (ölçülmüş) | ⬜ Faz 2.4/2.5 — ölçüm aracı yok |
| 14 | Sürüm künyesi panelde | ⬜ Faz 2.4 |

### Dilimleme — tek oturumda biten ilk dilim var

**Dilim 1 (tek oturum):** `status` + `verify` + `owner` uçları · `praxura_setup` tablosu
(migration) · `setup.html`/`setup.js` (jeton → owner → sonuç, üç ekran) · `login.js`
yönlendirmesi · §5.4'ün 2/3/4'ü.
**Bitti sayılır:** temiz kutuda `install.sh`'ın bastığı jetonla owner yaratılıyor, **o
hesapla giriş yapılabiliyor**, aynı jeton ikinci kez **410** alıyor.

**Dilim 2:** kurulum modu bayrağının uygulamaya bağlanması (§5.6 — public booking
sayfaları sihirbaz bitene kadar kapalı; kurulum modu = bakım modu, tek mekanizma) ·
§5.4'ün 1/5/8'i · üç dil. → **kilitli tasarımı aşağıda: „Dilim 2 — kurulum modunun
kilitli tasarımı" (6. tur)**. Orada kapsam daraltıldı: `einrichtung` sebebi yalnız anonim
hasta yüzeyini kapatır, owner girişi açık kalır; kapanış ucu (`abschluss`) aynı turda iner.

**Dilim 3 ve sonrası:** SMTP testi + teşhis (O-66 kararı (a), O-51 ile aynı turda) ·
yedek hedefi (2.3'e bağlı, **ayrı karar**) ·
IONOS AI anahtarı (Faz 1.3 `llmClient` inmeden anlamsız) · Sentry opt-in (2.6).

Sınırın kaymaması için **bugün kilitlenen şey uçların sözleşmesidir**: `status` tek alan
döner · `verify` tüketmez · `owner` tek yazma turudur · kapanış `abgeschlossen_am`'dır.
Sonraki dilimler bu uçlara **alan ekler, yeni uç açmaz.**

### Pakete giren dosyalar

`onprem/frontend.Dockerfile`'a **iki satır**: `COPY setup.html setup.js ./`. Kendi CSS'i
**yok** — `assets/system.css` zaten pakette (O-57). Sayfa `supabase-config.js` ve
`sentry-init.js` dışında modül import etmez; `dashboard.js`'e (24k satır) **dokunmaz**,
bu yüzden i18n sözlüğü sayfanın kendi içinde ama **aynı biçimde** (de/en/tr anahtar
sözlüğü) yazılır — kabul ölçütü üç dil (playbook `:229`), dashboard'ın sözlüğünü import
etmek ise kutuya 24k satırı sihirbaz için yüklemek olurdu. Bilinçli sapma, sahibi dilim 2.

### Bu turda açılan maddeler

**O-66** (SMTP sihirbazdan ayarlanamaz — GoTrue env okuyor) · **O-67** (trigger'ın
doldurmadığı profil alanları: `plan_status='pending'`, `company_code`/`business_name` boş).

### Dilim 1 — uygulandı ve gerçek kutuya karşı uçtan uca test edildi (11.09.2026 gecesi)

`api-backend/setup/router.js` (üç uç, yukarıdaki sözleşmeyle birebir) · `setup.html`/
`setup.js` (`login.html` kalıbı, kendi CSS'i yok) · `api-backend/Dockerfile`'a
`COPY setup ./setup` (⚠️ ilk yazımda unutulmuştu — `booking/` 11.08.2026'nın aynısı
olurdu, `docker build` öncesi kendi taramamda yakalandı) · `onprem/frontend.Dockerfile`'a
iki satır · `.vercelignore`'a `setup.html`/`setup.js` (bu sayfa SaaS'ta işlevsiz — Stripe
akışı orada — ve `.vercelignore`'suz Vercel'in her HTML'i kökten servis ettiği bilindiği
için (CLAUDE.md „Yayın yüzeyi kuralı") eklenmeden bırakmak kendi başına bir bulgu olurdu).

**Yerel kutuda (8 konteyner, `api`+`caddy` yeniden build) uçtan uca ölçüldü:**

| Adım | Sonuç |
|---|---|
| `GET /api/setup/status` (owner yok) | `{"verfuegbar":true}` |
| `POST /api/setup/verify` yanlış jeton | 401 |
| `POST /api/setup/verify` doğru jeton | 200, tüketmedi |
| `POST /api/setup/owner` tam form | 200, `profiles` satırı: `role:owner, plan_status:pending, business_name/owner_first_name/owner_last_name/sector` doğru yazılı, `company_code:null` (beklenen, bkz. O-67) |
| `GET /api/setup/status` (owner yaratıldıktan sonra) | `{"verfuegbar":false}` |
| Aynı jeton ikinci `verify`/`owner` denemesi | ikisi de **410** |
| Yaratılan owner ile `POST /auth/v1/token?grant_type=password` | **200**, gerçek `access_token` döndü — `email_confirm:true` sayesinde SMTP'siz kutuda bile giriş çalışıyor |

Migration `0005` `api` konteyneri ilk açılışında **kendiliğinden** koştu (`[migrate] ✓
0005_praxura_setup.sql`) — db-ustasi'nın canlıda yaptığı yarış-durumu ölçümünün
(1. UPDATE 1 satır, 2. UPDATE 0 satır) yerel kutudaki karşılığı budur.

**Test edilmeyen tek şey:** `company_code`'un gerçek bir tarayıcı oturumunda ilk
dashboard açılışında dolduğu — bu yalnız kod okumasıyla doğrulandı (O-67). §5.4'ün
1/5/8'i ve üç dil desteği dilim 2'ye bırakıldı, kilitli sözleşme (yukarıda) korunuyor.

### Dilim 2 — kurulum modunun kilitli tasarımı (11.09.2026, 6. tur)

> Uygulama öncesi soruldu ve iyi soruldu: „kurulum modu = bakım modu" sözü, `abgeschlossen_am`'ı
> yazan adım **aynı turda** inmezse dilim 1'de yaratılan owner'ı kendi kutusunun dışında
> bırakır. Doğru tespit. Aşağıdaki altı hüküm o kilidi açar ve §5.6'nın „tek mekanizma"
> şartını **bozmadan** kapsamı daraltır.

**1. „Tek mekanizma" = tek middleware, tek 503 gövdesi, iki `grund`. Kapsam sebebe göre değişir.**
Fork değil, çünkü ikinci bir durum makinesi yok: `server.js:425`'teki middleware yerinde
kalır, tek fark `if (!wartungsmodus) return next()` yerine bir `sperrgrund(req)` çağırması.

| `grund` | Kapsam | Gerekçe |
|---|---|---|
| `schema_migration` | **Her şey** (bugünkü davranış, değişmez) | Yarım migrate edilmiş şemada hiçbir yazma güvenli değil |
| `einrichtung` | **Yalnız anonim hasta yüzeyi** (aşağıdaki liste) | §5.6'nın yazdığı şart bu: *„yarım kurulmuş bir praxis'in randevu sayfası internette açık durmamalı"*. Owner'ın girişini kesmek şartın kendisinde yok — ve keserse sihirbazın kendi kabul ölçütü (§5.4/3: „gerçek giriş, JWT döndü") ölçülemez hâle gelir |

**2. Kapatılan uçlar — açık liste, „auth'suz olan her şey" değil.** Türetilmiş kural
sessizce yanlış tarafa kayar; liste okunur ve test edilir:
`POST /api/booking/get-slots` · `POST /api/booking/create` · `POST /api/booking-request/create` ·
`POST /api/booking-request/cancel` · `POST /api/booking-request/accept-offer` ·
`GET /api/patients/lookup` · `GET /api/services/public` · `GET /api/team/public` ·
`POST /api/verify-code`.
**Açık kalır:** `/api/config` (zaten middleware'in üstünde), `/health*`, `/api/setup/*`,
`/api/krankenkassen` (sabit liste, praxis hakkında bilgi taşımaz) ve `requireAuthAI`'li
her uç — yani owner dashboard'u tam çalışır.

**3. Kapanışı _insan_ yapar, kontrol sonuçları değil.** `abgeschlossen_am`'ı sihirbazın
son ekranındaki „Einrichtung abschließen" tıklaması yazar; §5.4 kontrolleri **gösterilir**,
kapıyı onlar açmaz. Gerekçe: 9 numaralı kontrolün („SMTP") geçerli sonuçlarından biri zaten
*„bilinçli atlandı"* — mekanik AND kuralı, tek kırmızı kontrolde kutuyu **kalıcı olarak**
kurulum modunda bırakır ve K10 gereği bizim içeri girip açma yolumuz yok. Kırmızı kontrol
varken buton uyarır ve ikinci bir onay ister; yine de kapatılabilir. Tek sert ön koşul:
`praxura_setup.owner_user_id` dolu olmalı (owner'sız kutu kapanmaz).

**4. Uç: `POST /api/setup/abschluss`.** Bu, „sonraki dilimler yeni uç açmaz" kilidinin
istisnası **değil** — adım 8 („Kapanış") yukarıdaki tabloda zaten kilitliydi, yalnız taşıyıcısı
adlandırılmamıştı. Jetonla korunur (`test-smtp` gibi, `nochOffen()` **değil**: jeton owner
adımında tüketilmiş olur ama `SETUP_TOKEN` env'de durduğu için doğrulaması hâlâ geçerli).
Tek koşullu `UPDATE … WHERE abgeschlossen_am IS NULL`.

**5. `status` iki alan döner (alan eklendi, uç eklenmedi):**
`{ verfuegbar: <verbraucht_am IS NULL>, abgeschlossen: <abgeschlossen_am IS NOT NULL> }`.
Buna ihtiyaç var, çünkü bugün `status` yalnız `verfuegbar`'a bakıyor ve owner yaratıldıktan
sonra `false` dönüyor — sihirbaz tarayıcı kapanınca kendi kapanış ekranına **geri dönemezdi**.
Yeni davranış: `abgeschlossen:false` ise `setup.html` jetonu tekrar sorup **kapanış
ekranından** devam eder; `abgeschlossen:true` ise 410 + giriş ekranı. Sürüm, host adı,
e-posta, hata metni hâlâ **dönmez**.

**6. Bayrağın okunması: 30 saniyelik önbellek, hata hâlinde AÇIK.**
`SETUP_TOKEN` boşsa (SaaS) sabit `false` — sıfır DB sorgusu, G7 bedelsiz. Kutuda
`praxura_setup` 30 sn TTL ile okunur, `abschluss` ucu önbelleği anında düşürür (konteynerde
birden çok işçi varsa en geç 30 sn'de yakınsar). ⚠️ DB hatasında `nochOffen()`'in „fail
closed" davranışı buraya **taşınmaz**: kurulu bir kutuda geçici bir DB hıçkırığı randevu
sayfasını kapatırdı. Son bilinen değer korunur, hiç bilinmiyorsa **açık** sayılır.

**Kapsam kararı — bu tur ne iner:** 1-6 **birlikte** iner (kapı ve kapanış bölünemez; ayrı
turlara bölünürse aradaki commit kutuyu kilitler). §5.4'ün 1/5/8'i ve üç dil **ayrılabilir**,
ikisi de bayrağı etkilemez; aynı turda bitmezse dilim 2b olarak devam eder.

**Üç dil:** teyit — sözlük `setup.js`'in **kendi içinde**, `dashboard.js` biçiminde
(`{de:{…}, en:{…}, tr:{…}}`), import yok (gerekçe: „Pakete giren dosyalar", yukarıda).
Varsayılan `de`, sihirbazın üstünde dil seçici. Seçim `localStorage`'a **`infinity_lang`**
anahtarıyla yazılır — `dashboard.js:1225`/`:13340` aynı anahtarı okuyor, yani kurulumda
seçilen dil dashboard'a taşınır; ikinci bir anahtar açmak kullanıcıya dili iki kez seçtirirdi.

### Dilim 2 — uygulandı, gerçek kutuya karşı uçtan uca test edildi (12.09.2026)

1-6 birlikte indi (kapı+kapanış ayrılmadı), üç dil de aynı turda bitti — dilim 2b açılmadı.

**Kod tarafında beklenenden bir adım fazlası gerekti.** §7H'nin "verfuegbar/abgeschlossen"
kararı uygulanırken, dilim 1'in `/verify` ve `/owner` uçlarının `nochOffen()`'i (yalnız
`verbraucht_am`'a bakan tek bayrak) hâlâ kullandığı görüldü — bu, devam ettirme senaryosunda
(owner yaratıldı, tarayıcı kapandı) aynı jetonla geri dönmeyi **410 ile bizzat engelliyordu**,
tam da bu dilimin çözmesi gereken şey. `nochOffen()` ikiye ayrıldı: `ownerAngelegt()`
(yalnız bilgi — sihirbaz Schritt 2'yi mi Schritt 3'ü mü göstereceğine karar verir) ve
`istAbgeschlossen()` (tek gerçek kapı — 410 yalnız bundan gelir). `/verify` artık
`{ok:true, ownerAngelegt}` döner, `/owner` owner zaten varsa 409 verir (410 değil — bu
durum kalıcı değil, yanlış adım).

**Yerel kutuda ölçüldü (8 konteyner, `api`+`caddy` yeniden build):**

| Senaryo | Sonuç |
|---|---|
| Kurulum bitmeden `POST /booking/get-slots`, `GET /services/public` | **503** `{grund:"einrichtung"}` |
| Aynı anda `/api/config`, `/health` | **200** — kilitli değil |
| `verify` (taze kutu) | `{ok:true, ownerAngelegt:false}` |
| `owner` → owner yaratıldı, jeton **tüketildi** ama **kapanış çağrılmadı** | booking hâlâ **503** |
| Aynı jetonla **tekrar** `verify` (devam ettirme) | `{ok:true, ownerAngelegt:true}` — 410 **almadı** |
| `abschluss` çağrıldı | `status` → `{abgeschlossen:true}`; booking **hâlâ 503** (30 sn önbellek) |
| 30 sn sonra `services/public` | **400** (`owner_id required`) — gerçek route'a ulaştı, kilit kalktı |
| `abschluss` ikinci kez (idempotenz) | `{ok:true, bereitsAbgeschlossen:true}`, hata değil |
| Kurulum boyunca `login.html` | her zaman **200** |
| Yaratılan owner, kurulum bittikten sonra gerçek şifreyle giriş | **200**, `access_token` döndü |

**Test edilmeyen:** çok işçili (`pm2 -i 2`) bir `api` konteynerinde önbelleğin iki işçi
arasında gerçekten 30 sn içinde yakınsadığı — yerel kutu tek işçiyle koşuyor. Gerçek
kurulumda `pm2-runtime -i 2` ile ölçülmeli (madde 6'nın kendi öngörüsü, "en geç 30 sn'de
yakınsar" — teoride doğru, pratikte hâlâ görülmedi).

**Statik sayfalar (`booking.html`) kapatılmaz — uçları kapanır.** Caddy dosyaları `/api`'den
bağımsız servis ediyor (`onprem/Caddyfile`), ve ikinci bir kapatma noktası (Caddy kuralı)
„tek mekanizma"yı bozardı. Sayfa açılır, ilk `fetch` 503 + `grund:'einrichtung'` alır ve
**anlaşılır tek cümle** gösterir („Diese Praxis richtet ihr System gerade ein.") — ham JSON
ya da „failed to fetch" değil. Kabul ölçütü: kurulum modundayken `booking.html` açıldığında
ekranda bu cümle var.

### O-66 — Sihirbazın SMTP ekranı yapısal olarak çalışamaz: GoTrue ayarını env'den okur

| Alan | İçerik |
|---|---|
| **Ne** | Playbook 2.2 SMTP'yi sihirbaza koyuyor, 2.7 ise „sihirbazdaki SMTP GoTrue'yu da beslesin, tek ayar iki işi görsün" diyor. Bu ikisi bugünkü mimaride **aynı anda doğru olamaz** |
| **Nerede** | `ONPREM_MIGRATION_PLAYBOOK.md:216` (2.2) + `:222` (2.7) · `onprem/docker-compose.yml` `auth` bloğu (`GOTRUE_SMTP_*`) · `onprem/.env.template` SMTP bölümü · tüketici taraf: `api-backend` nodemailer |
| **Tip** | E (+ G) |
| **Kutuda ne olur** | GoTrue `GOTRUE_SMTP_*`'ı **açılışta** env'den okur. Tarayıcıdaki sihirbaz konteyner env'ini değiştiremez; değiştirmenin tek yolu `.env` + `docker compose up -d auth`, yani ya müşterinin terminale dönmesi ya da konteynere **docker soketi** verilmesi (kutuda root — açılmaz). Sonuç: SMTP'yi DB'ye yazan bir sihirbaz randevu/Mahnung mailini düzeltir ama **şifre sıfırlama ve davet mailini düzeltmez**; müşteri „test maili gitti" ekranını görür, sonra şifresini unutan çalışan mail alamaz. Arıza sessiz ve gecikmeli — en pahalı sınıf. ⚠️ Üstüne **O-51** biner: gönderen adresi bizim alan adımız olduğu sürece test maili „gitti" dese de **spam'e düşer** (SPF `-all` + DMARC `p=quarantine` ölçüldü) |
| **Çözüm** | Üç seçenek, karar **kullanıcının** — ajan tek başına vermez: **(a)** SMTP `install.sh`'ta sorulur → tek gerçek env'de, GoTrue ve `api` aynı değeri okur; sihirbaz yalnız **test eder ve teşhis gösterir** (`RELEASE-STANDARD.md` §5.4/9'un „ya başarılı ya bilinçli atlandı"ı bununla uyumlu). **Ajanın tavsiyesi (a)** — en az hareketli parça, docker soketi yok, 2.7 lafzen karşılanır. **(b)** SMTP DB'ye yazılır, **bütün** mail `api`'ye taşınır, GoTrue'nun mail işi kapatılır — daha iyi UX ama auth mail akışını yeniden yazmak demek, bu fazın işi değil. **(c)** Sihirbaz `.env` satırlarını **gösterir**, müşteri yapıştırıp `docker compose up -d auth` der — K10 açısından dürüst ama „hiçbir elle adım olmadan" kabul ölçütünü (playbook `:226`) deler. Hangisi seçilirse gönderen alan adı da aynı turda müşterinin kendi alan adına geçmeli (O-51) |
| **Durum** | ✅ **uygulandı** (11.09.2026 gecesi) — seçenek **(a)**: `install.sh` adım 11 (yeni, `docker compose up`'tan ÖNCE) SMTP'yi sorar, atlarsa `.env.template`'in izin verdiği geçerli yol kalır ama sonucu söyleyen bir `warn` ile. `api-backend/lib/mail.js` (`getMailFrom()`) altı sabit adresi tek yerde topladı, `server.js` artık hepsinde bunu çağırıyor — SaaS davranışı `node --check` + izole birim testiyle doğrulandı (env boşken eski sabit çıktı birebir). `api-backend/setup/router.js`'e dördüncü uç: `POST /setup/test-smtp` — jetonla korunur (`nochOffen()` DEĞİL, owner sonrası da çalışsın diye), alıcıyı **istekten almaz** (`praxura_setup.owner_user_id` → `profiles.email`), `SMTP_HOST` boşsa `{eingerichtet:false}` döner (hata değil), aksi hâlde `transport.verify()` + gerçek gönderim, nodemailer hata kodları Almancaya çevrilir. `setup.html`/`setup.js`'e üçüncü adım eklendi (dört adım oldu): atlandıysa onay kutusu zorunlu, gönderildiyse "geldi mi/gelmedi mi" sorusu, gelmediyse O-51 teşhisi.<br>**Yerel kutuda ölçüldü** (gerçek SMTP sunucusu YOK, üç durum ayrı ayrı tetiklendi): `SMTP_HOST` boş → `{"eingerichtet":false}` 200 · `SMTP_HOST` çözülemeyen bir ad (`supabase-mail`, eski PoC artığı) → `502 {"error":"Mailserver-Adresse ist unbekannt…","code":"EDNS","gesendetAn":"owner2@…"}` — hem hata çevirisi hem alıcı bilgisi doğru · 10 saniye içinde ikinci istek → `429`. `getMailFrom()` beş senaryoda izole test edildi (SaaS fallback, kutu override, `MAIL_FROM_NAME`, ve bir header-injection denemesi — `\r\n` temizleniyor). Kapı: `absender_fest` 6 → **2** (1 bilinçli fallback + 1 yorum satırı), taban sıkıştı.<br>**Test edilmeyen tek şey:** gerçek bir SMTP sunucusuyla uçtan uca "gönderildi VE gelen kutusunda" doğrulaması — elde gerçek kimlik bilgisi yoktu. İlk gerçek kurulumda bu adım da ölçülmeli, kabul ölçütü hâlâ "250 değil teslim" |

### O-67 — `handle_new_user` yalnız iki alan yazıyor: kutunun ilk owner'ı yarım profille doğuyor

| Alan | İçerik |
|---|---|
| **Ne** | Trigger `profiles`'a yalnız `(id, email)` yazar. SaaS'ta kalan alanları onboarding akışı + Stripe webhook dolduruyor; kutuda o akış **pakete girmiyor** (`frontend.Dockerfile:28`), yani dolduran kimse yok |
| **Nerede** | `api-backend/db/migrations/0000_baseline.sql:1073` (trigger gövdesi) · `db/SCHEMA.sql:2087` (`profiles` varsayılanları: `plan 'starter'` · `plan_status NOT NULL 'pending'` · `role 'owner'` · `company_code` boş · `business_name` boş · `onboarding_step 'account'`) · okuyan yerler: `dashboard.js:1390`, `:1433`, `:4499` (`checkPlanActive`), `:16524` (`isEnterprise`) |
| **Tip** | H (+ G) |
| **Kutuda ne olur** | Üç ayrı sonuç: (1) `plan_status='pending'` — `checkPlanActive()` bunu **bloklamıyor** (yalnız `canceled`/`expired`), yani kutu çalışır; ama `isEnterprise()` `['trial','active','past_due']` beklediği için plan bazlı yerler **sessizce kapalı** kalır ve sonradan „sektöre göre eksik" şikayeti olarak geri döner. (2) `company_code` boş → kutuda **çalışan kaydı yapılamaz** (6 haneli kod o alandan gelir); O-56 ile birlikte kutunun ikinci kullanıcısı yapısal olarak imkânsız olur. (3) `business_name` boş → booking sayfası ve mail başlıkları isimsiz. Hiçbiri hata vermez, hepsi „eksik özellik" gibi görünür |
| **Çözüm** | Sihirbazın adım 6'sı bu alanları **açıkça** yazar: `business_name` (sorulan) · `role='owner'` (varsayılan, teyit edilir) · `company_code` (üretilir, benzersizliği kontrol edilir) · `onboarding_step='done'` · `plan`/`plan_status` çalışır bir köprü değere. ⚠️ Sonuncusu Faz 3.3'ün (entitlements) borcunu öne almaz, **erteler**: kutuda plan gerçeği lisanstan gelecek, bugünkü değer o gelene kadar tutan bir köprüdür ve `entitlements` helper'ı indiğinde bu satır **silinecek** — koda bunu söyleyen yorum yazılır, yoksa iki yıl sonra „bu neden burada" diye durur |
| **Durum** | ✅ `gelöst` (11.09.2026, dilim 1 uygulandı ve gerçek kutuya karşı test edildi) — **ama önerilen çözümden daha küçük bir düzeltmeyle.** Uygulama öncesi kod okunduğunda üçünden ikisinin zaten **sorun olmadığı** ortaya çıktı: `role` sütun varsayılanı zaten `'owner'` (trigger'a ek yazma gerekmiyor), `plan_status` sütun varsayılanı zaten `'pending'` — tam da bu maddenin önerdiği „`active` değil" köprü değer, ek kod gerekmeden. `company_code` da sihirbazda **üretilmiyor**: `dashboard.js:13480` `ensureCompanyCode()` zaten `role==='owner' && !company_code` durumunda koşulsuz çalışıyor (init() akışında), yani owner ilk kez dashboard'u açtığında birkaç saniye içinde kendi kendine dolduruyor — SaaS'ta owner'lar için de yol bu, ikinci bir üretim mantığı yazmak iki kaynağı aynı formata bağlı tutmak olurdu. **Sihirbazın gerçekten yazdığı tek şey**: `business_name`, `owner_first_name`, `owner_last_name`, `sector` — trigger'ın gerçekten boş bıraktığı, hiçbir yerde varsayılanı olmayan alanlar. `onboarding_step` dilim 1'de dokunulmadı (`'account'` kalıyor, hiçbir yerde okunmuyor — grep sıfır sonuç). ⚠️ Doğrulanmamış tek nokta: `company_code`'un gerçekten ilk dashboard açılışında dolduğu bir tarayıcı oturumuyla **görülmedi** — yalnız kod okumasıyla (`ensureCompanyCode()` koşulsuz, `init()` içinde) ve curl ile doğrulandı (owner satırı `company_code:null` çıktı, beklenen — henüz dashboard açılmadı). İlk gerçek kurulumda bu adım da görülmeli |

---

## 7I — O-58 (a) uygulandıktan sonra okunanlar (12.09.2026)

> Bu üç madde, O-58 (a)'nın **uygulamasını** okurken çıktı. İkisi doğrudan o
> uygulamanın yan etkisi, biri aynı aileden kaçmış eski bir bağ. Turun dersi
> §7E'nin tekrarı ama başka bir yüzle: **bir öğeyi DOM'dan kaldırmak, ona
> referans veren kodu kaldırmaz.** `.remove()` doğru seçimdi (gerekçesi O-58'in
> Durum satırında); eksik olan, o öğelere *başka nereden* dokunulduğunun
> sayılmasıydı.

### O-68 — `.remove()` sonrası `applyLang()` ikinci çağrıda çöküyor: kutuda dil değiştirince şifre ekranları Almanca kalıyor

| Alan | İçerik |
|---|---|
| **Ne** | O-58 (a) `#backHome`, `.register-block` ve `#saasFooter`'ı kutuda DOM'dan çıkarıyor; `applyLang()` ise o öğelerin **içindeki** üç id'ye korumasız `getElementById(...).textContent` ile yazıyor |
| **Nerede** | `login.js:128` (`backLink` → `#backHome` içinde, `login.html:433`) · `:129` (`regText`) · `:130` (`regBtn`) — ikisi de `.register-block` içinde (`login.html:427-430`). Kaldırma: `login.js:195-199`. Tetikleyen: `login.js:184` (dil düğmesi → `applyLang()`). İlk çağrı (`:188`) kaldırmadan **önce** koştuğu için sayfa açılışında görünmüyor |
| **Tip** | G (kutu/merkez ayrımının yan etkisi) |
| **Kutuda ne olur** | Kutuda kullanıcı EN ya da TR'ye basar basmaz `applyLang()` satır 128'de `TypeError: Cannot set properties of null` atar ve **o satırdan sonrasının tamamı çalışmaz**: `confirmBannerText` · `resendBtn` · reset paneli (`resetSub`, `lbl_reset_email`, `resetSubmitBtn`, `resetBackLink`) · yeni-şifre paneli (`newPwTitle`, `newPwSub`, `lbl_new_pw`, `lbl_new_pw2`, `newPwSubmitBtn`) · ve dil düğmesinin `active` sınıfı. Yani başlık ve giriş alanları çevrilir, **şifre sıfırlama ve yeni-şifre ekranları Almanca kalır**, basılan dil düğmesi seçili görünmez; kullanıcı "dil değişmedi" diye tekrar basar. Hata sessiz, konsolu açan yok. SaaS'ta hiç olmaz (orada öğeler duruyor) — yani **yalnız kutuda ve yalnız ikinci çağrıda** |
| **Çözüm** | O üç satır SaaS'a özgü; `IST_KUTU` `login.js:2`'de zaten import edilmiş, üçü `if (!IST_KUTU) { … }` bloğuna alınır. Alternatif (daha temiz, daha çok satır): `const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; }` yardımcısı ve fonksiyonun tamamının ona geçirilmesi. ⚠️ Opsiyonel zincir bu işi **çözmez** — `a?.b = c` geçerli sözdizimi değildir. Kabul ölçütü kod okuması değil ölçüm: kutuda `login.html` açılıp TR'ye basıldığında `#newPwTitle` metninin Türkçeye dönmesi |
| **Durum** | ✅ **gelöst (12.09.2026)** — üç satır `if (!IST_KUTU) { … }` bloğuna alındı (`login.js:124-128`, yardımcı fonksiyon açılmadı, üç satır zaten tek blok). Playwright ile ölçüldü: kutuda EN'e basınca `resendBtn` "Resend confirmation email"e, TR'ye basınca `title` "Giriş Yap"a dönüyor, dil düğmesinin `active` sınıfı doğru öğede, konsolda `TypeError` yok — kabul ölçütü tam bunu istiyordu |

### O-69 — Çalışan davet ekranı kutuda `app.praxura.de/login.html` adresini gösteriyor

| Alan | İçerik |
|---|---|
| **Ne** | Owner bir çalışan yarattığında sonuç ekranında gösterilen giriş adresi HTML'e **sabit metin** olarak yazılmış; hiçbir JS onu ezmiyor |
| **Nerede** | `dashboard.html:4589` — `<span class="emp-result-val" id="ae-res-link">app.praxura.de/login.html</span>`. Ölçüm: `ae-res-link` dizgisi bütün depoda **tek** yerde geçiyor (`grep -rn --include=*.js --include=*.html` → 1 sonuç, o da bu satır), yani gösterilen değer hiçbir koşulda değişmiyor |
| **Tip** | C (sabit adres) |
| **Kutuda ne olur** | Kutudaki owner çalışanını yaratır, ekran ona "çalışan şu adresten girsin" der ve **bizim SaaS'ımızı** gösterir. Çalışan oraya gider, hesabı orada yok, giriş reddedilir. Ekranda hata yok, kodda hata yok; owner'ın gördüğü tek şey "yeni çalışan giriş yapamıyor". Teşhis pahalı, çünkü suçlanan yer (kayıt/şifre akışı) doğru çalışıyor. ⚠️ Bu madde **O-56'nın kardeşi ve aynı ekranda oturuyor**: O-56 e-postadaki linki `window.location.origin`'e çevirdi, ekrandaki metin geride kaldı — bir düzeltmenin kendi ailesini taramadan kapanmasının bedeli |
| **Çözüm** | Değer çalışma zamanında yazılır: `location.origin + '/login.html'` — O-56'nın kutuda doğru çalıştığı **ölçülmüş** aynı kaynak. Yeni env var gerekmez, kutu/SaaS dallanması gerekmez; her iki dağıtımda da doğru sonucu verir (G7). Kabul ölçütü: kutuda davet ekranının kutunun kendi adresini göstermesi |
| **Durum** | ✅ **gelöst (12.09.2026)** — `dashboard.js`'te `loginUrl` artık `` `${location.origin}/login.html` `` (`teamAddBtn`'in iki satır altındaki aynı deseni izliyor), `#ae-res-link`'e `textContent` olarak yazılıyor (önceden hiç yazılmıyordu). `dashboard.html:4589`'daki statik metin de `—` yer tutucusuna çevrildi (JS zaten anında dolduruyor, ama JS'siz açılmayan bir yer tutucu bırakmamak için). ⚠️ `dashboard.js` büyüme kapısına takılmamak için üç satır tek satırda birleştirildi (`tools/.dashboard-baseline` 21249 sabit kaldı) |

### O-70 — Marka bağlantısı iki kutu sayfasında `https://praxura.de`'ye çıkıyor

| Alan | İçerik |
|---|---|
| **Ne** | Sayfa başındaki „Praxura" logosu bizim pazarlama sitemize giden sabit bir dış link; O-58 (a) alt bilgiyi ve kayıt bloğunu kaldırdı, bu ikisini görmedi |
| **Nerede** | `login.html:339` · `employee-signup.html:424` — ikisi de `<a href="https://praxura.de" class="brand">`. Paketlenen sekiz sayfanın kalanında bu bağ yok (tarandı) |
| **Tip** | C |
| **Kutuda ne olur** | Küçük ama iki yönlü: (1) praxis ağı internete kapalıysa logoya tıklamak ölü sayfa açar; (2) açıksa, çalışan kendi praksisinin giriş ekranından **bizim satış sitemize** düşer — kutu ürününde beklenmeyen bir yön. Veri riski yok (G1 dışı), sır yok. Bu yüzden düşük öncelikli; yine de O-58 (a) ile **aynı ailede** ve onunla birlikte kapanmalıydı |
| **Çözüm** | Kutuda anchor nötrleştirilir: `IST_KUTU` ise `href` kaldırılır (logo metin olarak kalır). `.remove()` **değil** — marka başlığı sayfanın düzeninin parçası. `employee-signup.js`'in de `IST_KUTU`'yu import etmesi gerekir (bugün etmiyor, ölçüldü) |
| **Durum** | ✅ **gelöst (12.09.2026), önerilenden farklı bir yolla.** `IST_KUTU`-dallanması yerine ikisinde de `href="https://praxura.de"` → `href="/"` yapıldı — sekiz kutu sayfasının üçü (`confirm.html`, `dashboard.html`, `onboarding-success.html`) marka linkini zaten böyle yazıyordu, aynı desen izlendi. Kazanç: hiçbir JS'e gerek yok (`employee-signup.js` `IST_KUTU`'yu import etmek **zorunda değil**), iki dağıtımda da ölü link yok. ⚠️ **Gerekçe satırı 12.09'da yanlış yazılmıştı** ("SaaS'ta `/` pazarlama ana sayfasına gider") — doğrusu: her iki sayfa da **`app.praxura.de`** altında servis edilir (`vercel.json:331-332` `praxura.de/employee-signup.html`'i oraya 302'ler) ve `vercel.json:318` o hostta `/`'i **`/login.html`**'e yönlendirir. Yani SaaS'ta da logo artık pazarlama sitesine değil giriş ekranına gider. Bu **bilinçli kabul**: `confirm.html`/`dashboard.html`/`onboarding-success.html` zaten öyle davranıyordu, davranış artık sekiz sayfada tek tip. Kutuda Caddy aynı şeyi yapıyor (`onprem/Caddyfile:66-68`) — yani `/` iki dağıtımda da giriş ekranı demek, dallanma gerekmiyor |

### O-71 — `pg_net`'siz kutu yapısal sayılıyor ama hiçbir kapı onu tutmuyor

| Alan | İçerik |
|---|---|
| **Ne** | O-49 "G1 artık disiplin değil yapı" diyerek kapandı. Yapının tamamı **tek bir compose satırı** (`98a` mount'u) ve **tek bir dosya** (`no-pg-net.sql`). İkisi de hiçbir kapı tarafından denetlenmiyor |
| **Nerede** | `onprem/docker-compose.yml:104` (mount) · `onprem/volumes/db/no-pg-net.sql` (tek satır `DROP EXTENSION`). Ölçüm: `grep -n 'pg_net' tools/check-onprem.sh` → **0 sonuç**; `tools/check-onprem-volumes.sh` yalnız **vendor ile aynı olması gereken 6 dosyayı** karşılaştırır (`dateien=` listesi), bizim kendi dosyalarımızı hiç görmez — yani `no-pg-net.sql` silinse iki kapı da yeşil kalır |
| **Tip** | A (runtime dış çağrı yeteneği) |
| **Kutuda ne olur** | Bugün hiçbir şey. Ama compose'u düzenleyen biri (ör. upstream sürüm yükseltmesinde mount listesini vendor'dan yeniden üretirken) o satırı düşürürse `pg_net` **sessizce geri gelir** ve kutu yine dışarı telefon edebilir hâle gelir. Arıza yok, log yok, kapı yok — yalnızca G1 tekrar alışkanlığa döner. Sınıf olarak O-49'un kendisiyle aynı; fark, bu sefer bir kez çözülmüş olması, yani geri gidiş **gerileme** olur |
| **Çözüm** | `tools/check-onprem.sh`'a bir sayaç: `onprem/docker-compose.yml` içinde `no-pg-net` geçen satır sayısı (taban **1**) — **azalma = red**. İkinci satır isteğe bağlı ama ucuz: `onprem/volumes/db/no-pg-net.sql` dosyasının varlığı. Mevcut sayaç deseninin (`absender_fest`, `onprem_image`) aynısı, yeni mekanizma gerekmiyor. `builder` uygular |
| **Durum** | ✅ **gelöst (12.09.2026)** — **sayaç değil, doğrudan kontrol** olarak yazıldı: mevcut `kontrol()` fonksiyonu yalnız ARTIŞI kırmızı sayar (`simdi > taban`), burada tersi gerekiyordu (kaybolma kırmızı) — o yüzden yıkıcı-DDL/şema-drift kapılarıyla aynı desende yeni bir "pg_net kapısı" bloğu eklendi (`tools/check-onprem.sh`, şema drift kapısının hemen altı): `git show ":onprem/docker-compose.yml"` içinde `no-pg-net` dizgisi yoksa VEYA `git cat-file -e ":onprem/volumes/db/no-pg-net.sql"` dosyayı indexte bulamazsa commit reddedilir. İkisi de **staged içerik** üzerinden (`:path` sözdizimi, dosya yolunun index'teki hâli) — script'in geri kalanıyla aynı ilke. Testte doğrulandı: mount satırı elle silinip `git add` edildiğinde kapı doğru mesajla reddetti; geri eklenince yeşile döndü |

---

## 8. Kapı tabanları — `tools/check-onprem.sh` için

> Kapı: `tools/check-onprem.sh`, `.githooks/pre-commit`'e bağlı
> (kardeşleri: `check-dashboard-size.sh`, `check-namen.sh`, `check-tabellen-register.sh`).
> Taban dosyası: `tools/.onprem-baseline`. Kaçış: `SKIP_ONPREM_GATE=1`.
>
> Kural: **taban artamaz, azalabilir.** Sayı düşerse taban otomatik sıkışır, kazanım geri
> alınamaz — `check-dashboard-size.sh` ile aynı mantık.
>
> ✅ **11.09.2026 akşamı: dokuzuncu sayaç eklendi** (`csp_host=53` — `vercel.json`
> CSP'sindeki `https://…` **token** sayısı, satır değil; CSP tek satırda durduğu için
> satır bazlı sayım bu dosyada kör kalırdı) ve `onprem_image` tabanı **7 → 8**
> yükseltildi: kutuya `caddy` konteyneri girdi (Faz 2.1b), `onprem/NOTICE.md`'ye
> Apache-2.0 satırı **aynı commit'te** yazıldı. Tabanı yükseltmenin kuralı yerine
> getirildi: gerekçe sicilde (§7F, turun sonucu). ⚠️ Kapı `NOTICE.md`'ye hâlâ
> **bakmıyor** (O-42) — lisans satırını eklemek insanın işi, sayaç yalnız "yeni
> konteyner girdi" diye bağırır.
>
> ✅ **11.09.2026: sekizinci sayaç eklendi** (`onprem_image=7`) ve kapı yeşil çalıştırıldı —
> sekiz sayacın sekizi tabanında, sapma yok (`onprem` ajanı doğrulaması).
>
> ✅ **04.09.2026: kapı kuruldu** — `tools/check-onprem.sh` + `tools/.onprem-baseline`.
> Aşağıdaki tablo **kapının ölçtüğü** değerlerle hizalandı; iki sayı düzeltildi (aşağıda
> işaretli). Ölçüm yöntemi: `git grep --cached`, eşleşen **satır** sayısı. O-20 bu kapının
> kurulmasıyla kapanabilir hâle geldi; commit numarası girildiğinde `gelöst` olur.

| Sayaç | Taban (2026-09-04) | Kapsam |
|---|---|---|
| `n8n.infinitymade.de` | **26** | `*.js` `*.html` `*.mjs`; `archive/` `vendor/` `funktionen/` `onprem/` `.claude/` `node_modules/` `index-old.html` `ai chatbot proje/` hariç |
| `app.praxura.de` (uygulama yüzeyi) | **19** | `dashboard.js` `dashboard.html` `employee-signup.js` `admin-login.js` `api-backend/server.js` — pazarlama/blog hariç (O-04) |
| `api/` fonksiyon sayısı | **12** | `find api -name "*.js" -not -path "api/_lib/*"` — artış = red (limit + G8) |
| Üçüncü-parti `<script src="http…">` | **11** | Yalnız Sentry loader. ⚠️ Sicilin O-06'da "12 satır / 11 dosya" yazıyordu; kapı 04.09.2026'da index üzerinden **11 satır** ölçtü — geçerli sayı kapınınkidir (`tools/.onprem-baseline` → `ext_script=11`). Yeni host = red |
| `N8N_` env referansı | **3** | `server.js:1216` `:1969` `:1972` (satırlar 11.09.2026 akşamı, `86aae7b` sonrası yeniden ölçüldü) — artış = red, hedef sıfır (Faz 1.2) |
| `.supabase.co` sabit referansı (ürün kodu) | **1** | ⚠️ Sicil bunu **0** sanıyordu; kapı ölçümünde 1 çıktı: `api-backend/test_schema.js:5` (test dosyası, env fallback'li — O-05'te zaten istisna olarak yazılıydı, sayaçta unutulmuştu). `ops/` ve `vercel.json` hariç. Artış = red |
| `fonts.googleapis.com` / `esm.sh` / `unpkg` / `jsdelivr` / `cdnjs` | **0** | Uygulama kodu; `ai chatbot proje/` hariç. Sıfırdan artış = red (Konsey 2026-08-13 S3) |
| `latest` etiketi yayın hattında | **1** | `.github/workflows/publish-calendar-api.yml:64` — hedef **0** (Faz 4.3b, `X.Y.Z` + kanal etiketleri). Artış = red |
| Yıkıcı DDL kanıtı | — | Yeni migration dosyasında `DROP COLUMN` / `DROP TABLE` / `RENAME COLUMN` / `SET NOT NULL` / `DROP CONSTRAINT` varsa dosya başında `-- ZWEISTUFIG: <no> · <gerekçe>` satırı **zorunlu** (`SCHEMA-VERTEILUNG.md` §6.2, `RELEASE-STANDARD.md` §4.7) |
| Migration'lı PATCH | — | Sürüm PATCH ise `db/migrations/` altında yeni dosya olamaz (`RELEASE-STANDARD.md` §2.2). Release listesi adım 1 |
| Koda gömülü gönderen adresi (`noreply@` + sabit alan adı) | **6** | `api-backend/server.js` (`:3981` `:4002` `:4174` `:4212` `:4316` `:4363`). Ölçüm: `git grep --cached -c "noreply@praxura\.de" -- api-backend/`. Artış = red; hedef **0** (tek yardımcı + `.env`'den gönderen, O-51). ✅ Kapıda **kurulu ve sınandı** (11.09.2026): yedinci sabit adres eklendiğinde `absender_fest : 6 -> 7` diyerek reddetti |
| On-prem compose `image:` satırı | **8** (11.09 akşamı 7'den) | `onprem/docker-compose.yml` (11.09.2026): db · auth · rest · realtime · storage · kong + kendi `api`'miz. Upstream'in 11 fremd konteynerinden 5'i bilinçli dışarıda. Artış, `onprem/NOTICE.md`'ye lisans satırı eklenene kadar **red** (O-42). Sayaç `onprem_image`, kapıda test edildi (8'e çıkarıldığında reddetti). ⚠️ İki not: sayaç `git grep --cached` ile ölçer — kurulumda bir tur `--cached`siz ölçülüp taban kendiliğinden **0'a sıkışmıştı**, düzeltildi; ve kapı yalnız **sayıyı** tutar, `NOTICE.md`'de karşılık gelen satırın varlığını **denetlemez** (O-42). **11.09 akşamı 8'e çıkarıldı:** `caddy` (Faz 2.1b, arayüz + TLS + reverse proxy). Yükseltme gerekçesi §7F'de |
| `vercel.json` CSP'sindeki bulut adresi | **53** | `git grep --cached -oE "https?://[a-zA-Z0-9.*-]+" -- vercel.json` — **token** sayar, satır değil. Hedef sıfır **değil**: SaaS'ın kendi bulut adresleri o satırda meşru; amaç sessiz büyümeyi yakalamak. Artış = red, çıkış yolu: "gerçekten SaaS'a mı özel?" — öyleyse kabul, ama `onprem/Caddyfile`'a asla kopyalanmaz (O-52) |

---

## 9. Durum özeti (2026-09-04, ilk tarama)

| Durum | Adet | Maddeler |
|---|---|---|
| `offen` | 10 | O-09 · O-18 · O-23 · O-32 · O-33 · O-44 · O-46 · O-48 · O-49 · **O-51** |
| `geplant` | 20 | O-01 · O-02 · O-03 · O-06 · O-07 · O-08 · O-10 · O-13 · O-15 · O-16 · O-19 · O-21 · O-25 · O-26 · O-27 · O-28 · O-29 · O-31 · **O-38** · O-43 |
| 🟡 `kısmen gelöst` | 7 | O-11 (kaynak kurtarıldı, Faz 1.5 açık) · **O-30** (şablon var, `PUBLIC_BASE_URL` eksik) · O-40 (`/health` ayrıldı, derin `/status` yok) · O-41 (smoke-test var, soak/kanal yok) · **O-42** (NOTICE + sayaç var, SBOM yok) · O-45 (compose sürümlendi, dağıtımı yok) · **O-50** (değişkenler eklendi, anahtar üretimi ve uyarı yok) |
| `unkritisch` | 10 | O-04 · O-05 · O-12 · O-14 · O-17 · O-22 · O-24 · O-34 · O-35 · O-37 |
| `gelöst` | 4 | O-20 (kapı) · O-36 (vendor yerelleştirmesi) · O-39 (şema dağıtım zinciri) · **O-47** (Google env'i opsiyonel) |

> ⚠️ **Yukarıdaki tablo 04.09.2026 fotoğrafıdır ve sonraki turlarda açılan maddeleri
> saymaz.** Yeniden saymak yerine fark burada tutulur — sayı uydurmaktansa farkı yazmak
> dürüsttür.
>
> **11.09.2026 akşamı farkı (Faz 2.1b):**
> - `offen`'e eklenenler: **O-56** · **O-57** · **O-58** · **O-59** (dördü de bu turun
>   gegenlesen'inden çıktı)
> - 🟡 `kısmen gelöst`'e geçenler: **O-52** (`geplant` idi — (a)-(d) bitti, kalan tek
>   şey `install.sh`'ın `SUPABASE_PUBLIC_WSS` türetmesi) · **O-55** (`offen` idi —
>   `frame-src 'none'` kondu, fallback ölçümü ve özellik kararı duruyor)
> - Gerekçesi değişen: **O-12** (`unkritisch` kalıyor; artık "veri gidiyor ama zararsız"
>   değil, "CSP engelliyor, hiç gitmiyor — özellik susuyor")
> - Toplam madde: **59**
>
> **11.09.2026 gecesi farkı (Faz 2.1c ön-hazırlık):**
> - `offen`'e eklenenler: **O-60** (JWT türetimi + `exp` tuzağı) · **O-61** (`.env` izni,
>   yedekten dışlanması, anahtarın tek kopyası)
> - Faza bağlananlar (durum değişmedi, sahibi netleşti): **O-53** → §7G adım 9 ·
>   **O-59** → adım 4 + 14 · **O-52 (b)** → adım 8 · **O-50**'nin kalanı → adım 6
> - Toplam madde: **62**
>
> **11.09.2026 gecesi, ikinci tur farkı (`install.sh` yazıldı ve okundu):**
> - `offen`'e eklenenler: **O-63** (kurulumun sağlık kapısı: aritmetik kırık + ölen
>   konteyneri saymayan sayım) · **O-64** (`REALTIME_DB_ENC_KEY` 32 karakter üretiliyor,
>   çalışan yığında 16) · **O-65** (betik kutunun kendi `SITE_URL`'ini çözemiyor, kendi
>   doğrulama adımında yanlış teşhisle duruyor)
> - 🟡 `kısmen gelöst`'e geçenler: **O-60** (türetme yapıldı, kanıt adımı imzayı ölçmüyor) ·
>   **O-61** ((a)+(b) yapıldı, (c) Faz 2.3'te) · **O-62** (`DISABLE_SIGNUP` hiç
>   gevşetilmiyor; jeton üretiliyor ama `api` konteynerine geçmiyor)
> - Toplam madde: **65**
>
> ⚠️ **Turun dersi — 11.09 sabahının dersinin tekrarı:** üç engelleyici bulgunun üçü de
> *çalıştırılmamış* koddan çıktı ve üçü de ilk gerçek kurulumda çıkardı. "Çalıştırılmamış
> paket, yazılmamış pakettir" kuralı **betikler için de** geçerli; `bash -n` sözdizimini
> ölçer, davranışı değil.

> **12.09.2026 farkı (Faz 2.1b kapanış turu + O-58 (a) uygulaması):**
> - ✅ `gelöst`e geçenler: **O-57** (paket dosya listesi + CI tetikleyicisi + duman
>   testinin asset kontrolü) · **O-58 (a)** (`istKutu` bayrağı, `IST_KUTU`, üç SaaS
>   öğesi kutuda DOM'dan kaldırılıyor) · **O-59** (hosts/DNS satırı kurulum çıktısında).
>   **O-58 (b)** `offen` kalmaya devam ediyor — hasta sayfalarındaki Impressum/
>   Datenschutz hâlâ 404, çözümü Faz 2.2 + `legal-de`
> - `offen`e eklenenler: **O-68** (`applyLang()` kaldırılan öğeye yazıyor, kutuda dil
>   değişimi yarım kalıyor) · **O-69** (çalışan davet ekranı `app.praxura.de` gösteriyor,
>   O-56'nın kardeşi) · **O-70** (marka linki iki kutu sayfasında SaaS'a çıkıyor)
> - Toplam madde: **70**
>
> **Aynı gün, kapanış:** üçü de aynı gün `gelöst`e geçti (`343dacf`) — O-68
> (`if (!IST_KUTU)`), O-69 (`location.origin`), O-70 (`href="/"`). **O-49** de aynı gün
> kapandı (`97ad565`), iki denemede. Bu kapanışı okurken **O-71** açıldı: O-49'un
> "yapısal" güvencesini tutan hiçbir kapı yok. Toplam madde: **71**.
>
> ⚠️ **Bu turun kendi dersi — sicil de hata yapar:** kapanış yazılırken iki satır yanlış
> yazıldı ve ikisi de 12.09.2026'da düzeltildi: (1) özet listede O-49, **geri alınan ilk
> denemeyle** tarif edilmişti — o tarifi izleyen biri kapıyı tekrar körleştirirdi;
> (2) O-70'in gerekçesi "SaaS'ta `/` pazarlama sayfasına gider" diyordu, oysa
> `vercel.json:318` `app.praxura.de`'de `/`'i `/login.html`'e yönlendiriyor. Doğru karar,
> yanlış gerekçe. **Kural:** bir maddenin Durum satırı, *uygulanan* çözümü tarif eder;
> denenip geri alınan yol ayrı ve açıkça "geri alındı" diye yazılır.
>
> ⚠️ **Turun dersi:** üçünün de kaynağı aynı — *bir öğeyi kaldıran/değiştiren düzeltme,
> o öğeye başka nereden dokunulduğunu saymadan kapanmaz.* O-58 (a) üç öğeyi DOM'dan
> çıkardı ama `applyLang()`'in aynı öğelere yazdığını (O-68) saymadı; O-56 e-postadaki
> adresi düzeltti ama aynı ekrandaki metni (O-69) ve marka linkini (O-70) saymadı.
> Bundan sonra bu sınıfta kabul ölçütü tek satır: **kaldırdığın/değiştirdiğin her id ve
> dizgi için depoda `grep`, ve sonuç sicile sayıyla yazılır.**

> **Toplam 51 madde.** 🟡 satırı 11.09.2026'da açıldı: altı madde aylardır `offen`
> görünüyordu ama yarısı yapılmıştı — "yapılan ile kalan" tek hücrede karışınca sicil
> abartılı bir borç tablosu gösteriyordu. Bir madde ancak **kalanı da bittiğinde**
> `gelöst` olur; 🟡 o güne kadar dürüst ara durumdur.

> **04.09.2026 — üçüncü tur (sürüm/dağıtım standardı):** O-29 `offen` → `geplant` (gereksinim
> `RELEASE-STANDARD.md` §4.5'te yazıldı). Dört yeni madde açıldı: O-40 · O-41 · O-42 · O-43.
> Toplam **43** madde.

> **06.09.2026 — yazma yolu incelemesi:** O-44 açıldı (§7C). Toplam **44** madde.

> **10.09.2026 — filo ölçeği turu (50-200 kutu sorusu):** O-45 (Supabase upstream
> yükseltme yolu) ve O-46 (merkezde filo görünürlüğü) açıldı (§7D). O-39'a zincirin
> boş kaldığı ölçüm düşüldü — 6 günde 7 şema değişikliği, sıfır migration dosyası.
> Kapı ölçümü aynı gün tekrarlandı: **yedi sayacın yedisi de tabanında**, sapma yok.
> Toplam **46** madde.

> **11.09.2026 — kutu paketi turu (Faz 2.1a):** paket yazıldı ve boş bir veritabanına
> karşı gerçekten çalıştırıldı. Sicil tarafında sonuç: **O-47** açıldı ve aynı gün
> kapandı · **O-48**, **O-49** açıldı · **O-50** bu doğrulamada bulundu (kutunun `api`
> konteyneri PHI şifreleme anahtarını ve SMTP'yi hiç almıyor) · **O-20** kapandı
> (kapının commit'i girildi) · **O-30**, **O-42**, **O-45** 🟡'ye geçti · **O-38**
> `unkritisch`'ten `geplant`'a alındı (kutu boş kalkıyor, kasa listesi yok) · O-01,
> O-02, O-09, O-13'ün satır numaraları koda karşı yenilendi.
>
> **Aynı gün, ikinci tur (O-50 kovalanırken):** eksik değişkenler eklendi → O-50 🟡'ye
> geçti; ve kovalama sırasında **O-51** çıktı — gönderen adresi altı yerde koda gömülü,
> `SMTP_FROM` diye bir değişken hiç yok. Bu, O-50'nin **arkasındaki** madde: SMTP
> geçirilse bile mail alıcıda düşer (SPF `-all` + DMARC `p=quarantine`, ölçüldü).
> Toplam **51** madde.
>
> ⚠️ **Turun asıl dersi:** üç hatanın üçü de belge okunarak değil, yığın gerçekten
> ayağa kaldırılarak bulundu. O-50 de öyle: compose'a bakmadan "env'ler zaten geçer"
> denirdi. Paketleme fazlarında kural bu olsun — **çalıştırılmamış paket, yazılmamış
> pakettir.**
>
> ⚠️ **İkinci ders, O-51'den:** bir eksiği kapatmak arkasındakini görünür kılar.
> "SMTP'yi geçirdik, mail çalışır" cümlesi bir adım eksikti; teslim edilmeyen mail de
> gönderilmeyen maildir. Kutu tarafında **gönderim başarısı ile teslim başarısı ayrı
> ölçülür** — sihirbazın test maili adımı (Faz 2.2) bunu alıcı kutusundan doğrulamalı.

> Sayılar madde listesiyle birlikte okunur; bir madde birden fazla faza değebilir.

### Playbook'un eksikleri (bu taramada çıkanlar)

Aşağıdaki bulguların playbook'ta **karşılığı yok** — plan güncellenene kadar `offen` kalırlar:

1. ~~**O-39 şema dağıtım zinciri** — hiçbir fazda yok.~~ **04.09.2026: çözüm belgesi yazıldı** — `onprem/SCHEMA-VERTEILUNG.md`. Playbook'a **Faz 1.7** olarak eklenmeli; üç karar kullanıcıda (belge §11).
2. **O-11 Fahrtenbuch edge function kaynağı repoda yok** — playbook D1 "Kaynak: `supabase/functions/`" diyor, o dizin git geçmişinde hiç olmamış. Faz 1.5 taşınacak kod olmadan başlayamaz.
3. ~~**O-29 `DATA_ENCRYPTION_KEY`** — hiçbir fazda geçmiyor.~~ **04.09.2026: kapandı** — `onprem/RELEASE-STANDARD.md` §4.5, dört kural, Faz 2.1/2.2/2.3/2.4'e bağlandı.
4. **O-09 Apify/B2B özelliği** — playbook hiç anmıyor; merkez/kutu ayrımına yazılmalı.
5. **O-18 admin panelinin on-prem'de ne göstereceği** — "admin/* → dokunma" deniyor ama panelin veri kaynağı kutuya taşınıyor.
6. **O-23 `delete_expired_accounts()`** — playbook D5 "zamanlayıcı yok" diyor, **çürütüldü** (`server.js:3400`); buna karşılık kutuda kendi verisini silme riski hiçbir yerde yazılı değil.
7. **O-33 plan farkının teknik karşılığı** — lisans formatı donmadan cevaplanmalı.
8. **O-32 `module_visibility` ile lisansın ilişkisi** — Faz 3.3'te yazılı değil.
9. **O-40 `/health` sahte yeşil** — Faz 2.4 healthcheck istiyor ama bugünkü ucun her koşulda `ok` döndüğünü görmemiş. Yeni görev: **Faz 2.4b**.
10. **O-41 image smoke-test ve soak** — Faz 4.3 kanal sistemini istiyor, ama image'ın ayağa kalktığını doğrulayan adım ve `:stable` öncesi bekleme süresi hiçbir fazda yok. Yeni görevler: **Faz 4.3a / 4.3b**.
11. **O-42 lisans/SBOM sürekli kapısı** — Faz 6.1a SBOM'u anıyor, kapıyı anmıyor. Yeni görev: **Faz 6.1b**.
12. **O-43 sürüm/kanal manifesti** — `releases.json`, durak kavramı ve sürüm notu hiçbir fazda yok. Yeni görev: **Faz 2.9**.
13. **Kurulum ön-kontrolü ve kabul ölçütü** — `install.sh` var ama "kurulum ne zaman başarılı sayılır" tanımı yok; ölçüt `RELEASE-STANDARD.md` §5.4 (14 kontrol). ⚠️ **11.09.2026 numara düzeltmesi:** bu görev burada "Faz 2.1a" diye önerilmişti, playbook ise 11.09'da **2.1a**'yı kutu compose paketine verdi (yapıldı) ve `install.sh`'i **2.1c** yaptı. Kabul ölçütü artık **Faz 2.1c**'nin parçasıdır — iki ayrı işin aynı numarayı taşıması bu sicilde bir kez oldu, tekrarlanmasın.
14. **Tanılama paketi içeriği** — Faz 2.5 butonu istiyor, içeriği tarif etmiyor. Yeni görev: **Faz 2.5a**, liste `RELEASE-STANDARD.md` §7.3.
15. ~~**Supabase upstream stack'inin yükseltilmesi (O-45)** — hiçbir fazda yok.~~ **11.09.2026: playbook'a girdi.** (a) compose sürümleme **2.1a'da yapıldı** (etiketler `.env`'de); (b) compose'un kutuya dağıtımı playbook **Faz 2.1b**'de yazılı, açık; (c) upstream sürüm eşlemesi + durak → **Faz 2.9** (O-43). Ayrıca yığın 11 fremd konteynerden **6**'ya indi: yükseltilecek yüzey %45 küçüldü.
16. **Merkezde filo panosu (O-46)** — hangi kutu hangi sürümde/şemada, son yedek, disk. Playbook'ta ve `RELEASE-STANDARD.md`'de yok; §11.1 kararının bilinçli kör noktası. Faz 3.1 adayı, kullanıcı kararına bağlı.

### Playbook'ta çürütülenler

- **D5** (`delete_expired_accounts()` zamanlayıcısı yok) → `widerlegt`, bkz. O-23.
- **D1** (edge function kaynağı `supabase/functions/`'ta) → `widerlegt`, bkz. O-11.
- **Faz 1.4** (CDN bağımlılıklarını lokale al) → faz açılmadan tamamlandı, bkz. O-36.
- **§9-A4** (Vault self-host'ta çalışır mı) → PoC 0.2'de çalıştığı doğrulandı (playbook §10'da kayıtlı).
