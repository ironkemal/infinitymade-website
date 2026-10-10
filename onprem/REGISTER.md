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

## ⏭️ Buradan devam — yeni oturum bunu okusun (son güncelleme: 20.09.2026)

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

**12.09.2026 (akşam) — doğrulama turu, sicilin kendisi sayıldı.** Gün içinde
**14 commit** indi; sicilin gövdesi (O-maddeleri) hepsini doğru taşıyordu, ama
**üst blok ve §9 tablosu geriden geliyordu** — üçüncü kez aynı hata. Bu turda
sayılarak düzeltildiler. Günün kapanışları: **O-25** (kanal/etiket, R0-R12 +
SaaS host geçişi) · **O-38** (8 referans tablosu seed edildi, `0006`-`0013`) ·
**O-41** · **O-45 (b)** · **O-48** (konsey: Kong kalıyor) · **O-49** · **O-50** ·
**O-52** · **O-53** · **O-57** · **O-58 (a)** · **O-59** · **O-62** · **O-63** ·
**O-64** · **O-65** · **O-68**-**O-74** · **O-76**.

**Dört yeni madde açıldı** (§7K) — hepsi bu turun işlerinin **kendi yazılı açık
kalemlerinden** çıktı, yani zaten biliniyorlardı ama **sahipsizdiler**:
**O-77** (gece otomatik güncelleme migration'ları **yedeksiz** koşturuyor — kurulu
kutuda bugün canlı, `RELEASE-STANDARD.md` §4.3'ün açık ihlali) · **O-78**
(ICD-10-GM'in § 63 UrhG Quellenangabe'si pakette yok) · **O-79**
(`heilmittel_katalog`'un besleme zinciri kapısız, SEED-11) · **O-80**
(`dta_schluessel` seed dışında). O-77 dar kapsamıyla aynı akşam **gelöst** oldu
(gerçek kutuda doğrulandı) ve onu kapatırken **beşinci** bir madde daha çıktı —
**O-81** (`update.sh` kendi kendini güncelledikten sonra kendi sapma-kontrolüne
takılıp otomatik güncellemeyi kalıcı durdurabiliyordu; bu da **gelöst**, gerçek
kutuda hem hata hem düzeltme doğrulandı). onprem'in bildirim-sonrası denetimi
O-77(3)'ün kendi numarası olmadığını fark etti (sicil kuralı 5) — **O-82**
olarak ayrıldı (`update.sh`'ın hiçbir `dur` dalının kutu dışına bildirimi yok;
O-77(3) ve O-81'in ortak deseni). O-26'nın 13.09.2026 kapanışı sırasında
**O-83** de çıktı (`api` konteynerinde `mem_limit` yok — O-48 yalnız Kong'a
vermişti). Toplam **83** madde.

⚠️ **Turun dersi:** "açık kalem" diye commit mesajına ya da bir maddenin içine
yazılan iş, **O-numarası almadığı sürece yok sayılır** — §9'da görünmez, sıradaki
iş listesine giremez, altı ay sonra yeniden keşfedilir. Sicil kural 5 (her bulgunun
bir sahibi olur) tam olarak bunun için yazılmıştı.

**Nerede duruyoruz (12.09.2026 akşamı):** kutu **kurulabilir**. `install.sh` ilk kez
gerçek bir Ubuntu 24.04'te (WSL2, kendi systemd'si + kendi Docker Engine'i, GHCR'den
çekilen gerçek `:beta` image'ları) uçtan uca koştu ve **16/16 adım geçti**. Kutunun
artık şunları var: paketi (`onprem/docker-compose.yml` + `.env.template` + `NOTICE.md`) ·
arayüzü (`Caddyfile` + `frontend.Dockerfile`, tek origin, dar CSP) · kurulum betikleri
(`install.sh`, 16 adım) · kurulum sihirbazı (Faz 2.2 dilim 1+2 — ilk owner + 3 dil) ·
kendi şema zinciri (`0000`-`0013`, artık **veriyle birlikte**) · kendi güncelleme yolu
(`update.sh` + `praxura-update.timer`) · sürüm/kanal sistemi (`VERSION` + `:beta`/`:stable`
+ `promote-stable.yml`, 72 s soak).

**Bugüne kadar kanıtlanan:** şema kutuya kendi kendine gidiyor (O-39) · referans verisi
de gidiyor (O-38 — sekiz tablo gerçek Postgres'e karşı, satır satır, iki kez) · signup
→ trigger → profil çalışıyor · apikey'siz PostgREST **401** · `pg_net` kutuda **hiç
kurulmuyor** ve bunu bir **kapı** tutuyor (O-49/O-71) · veritabanından dışarı çıkan
çağrı yok · kurulu kutu kendi compose'unu kendi güncelliyor ve başarısız güncellemede
**dosya bazında geri dönüyor** (O-45 (b), gerçek kutuda ölçüldü).

**Kanıtlanmayan — abartılmasın:** **O-26'nın istediği kapsamlı yedekleme yok** (storage
volume arşivi, kutu dışı hedef, 14 gün + 12 ay rotasyon, `restore.sh`) — ✅ **O-77'nin dar
kapsamı kapandı (12.09.2026 akşamı, gerçek kutuda doğrulandı):** `update.sh` artık her
migration'dan önce `pg_dump` alıyor, başarısızsa image'a/konteynerlere dokunmadan durup
dosyaları (Gegenlesen'de bulunan bir eksikle birlikte, `.env` dahil) geri alıyor. Kutunun
kendi diskinde son 5 dump — kapsamlı bir strateji değil, yalnız bir güvenlik ağı. ·
kutunun Impressum/Datenschutz sayfaları henüz yok (O-58 (b), `legal-de` bekliyor) ·
ICD-10-GM atıf satırı
pakette yok (O-78, § 63 UrhG) · mailin gerçek bir SMTP ile **teslim** edildiği hiç
ölçülmedi (O-51) · lisans/yetki tarafına hiç dokunulmadı (O-31/O-33) ·
`N8N_AI_SERIES_URL` hâlâ 3 yerde (O-02, G1). Yani bugünkü paket **kurulabilir bir beta
kutusu**, teslim edilebilir ürün değil.

**Sıradaki iş — sırayla (12.09.2026 akşamı, doğrulama turunda yeniden sıralandı — 1. madde değişti, bkz. altındaki not):**

✅ **Faz 2.1b tamamen kapalı** (O-45 (b) dahil tüm maddeleri — bkz. yukarıdaki 12.09.2026
girdileri). ✅ **Faz 2.1c (`install.sh`) de fiilen kapalı** — O-50/O-52 (b)/O-53/O-60/
O-62 hepsi kodda zaten inmişti, yalnız sicil geride kalmıştı (12.09.2026 sicil düzeltmesi,
onprem-review). Kalan gerçek boşluklar: O-51 (mailin gerçek bir SMTP ile teslim edildiğinin
ölçülmesi) ve O-61 (c) (`.env`'in yedekten dışlanması, Faz 2.3'ün işi) — ikisi de yalnız
gerçek bir kurulumla/Faz 2.3 ile kapanabilir, `install.sh`'ın kendisinde eksik değil.
✅ **Faz 2.2 tamamı kapalı (12.09.2026 gecesi, dilim 2b dahil)** — kurulum sihirbazı, ilk
owner, SMTP test ucu, 3 dil, kurulum modu kilidi, VE §5.4'ün 1/5/8 kontrolleri (10 şema
sayacı, RLS negatif testi, `DATA_ENCRYPTION_KEY` yaz-oku turu) — gerçek kutuda hem yeşil
hem kırmızı yollar ölçüldü. Ayrıntı: §7H'nin "Dilim 2b" alt-bölümü.
✅ **O-25 (kanal/etiket sistemi) tam kapsamıyla uygulandı VE SaaS host geçişi (R9) dahil
tamamlandı (12.09.2026)** — R0-R12, onprem-review ile tasarım kilitlendi, host doğrulandı.
Ayrıntı: O-25'in kendi maddesi + **O-74** + **O-75**.
✅ **`install.sh`'ın ilk gerçek uçtan uca koşusu yapıldı ve geçti (12.09.2026)** — gerçek
Ubuntu 24.04 (WSL2'ye kurulan ayrı bir dağıtım, kendi systemd'si + Docker Engine'iyle),
GHCR'den çekilen gerçek `:beta` image'ları. 16 adımın 16'sı da tamamlandı; yol boyunca
**gerçek, tekrarlanabilir bir kurulum-engelleyici hata bulundu ve düzeltildi: O-76**
(Schritt 14'ün anahtar-kanıt testi PostgREST'in kök yoluna sorup büyük şemamızda her
zaman Supabase'in kendi 3 saniyelik `anon` zaman aşımına çarpıyordu — gerçek bir kutuda
kurulum ASLA bitmezdi). O-63/O-64/O-65 de bu koşuda gerçek kanıtla kapandı (önceden
"okuma kanıtı"ydılar). Kalıcı test ortamı: `wsl -d Ubuntu-24.04` yerelde kuruldu, kalıcı.

✅ **O-77'nin dar kapsamı kapandı (12.09.2026 akşamı, aynı tur içinde) — `update.sh` artık
migration-öncesi `pg_dump` almadan `up -d`'ye hiç geçmiyor**, başarısızsa dosyalar/`.env`
geri alınıyor (Gegenlesen: ilk sürüm bunu unutmuştu, düzeltildi). Gerçek kutuda: sağlıklı
db'de 3× başarılı yedek, durdurulmuş db'de 1× başarısızlık+tam geri alma (`.env` sha256
byte-özdeş doğrulandı), 1× tam başarı yolu (`sonuc=ok`). Kanıt ve commit'ler: kendi
maddesinde (O-77).

✅ **O-26 artık TAM kapalı (12.09.2026, `restore.sh` yazıldı ve gerçek kutuda
uçtan uca doğrulandı)** — `onprem/backup.sh` storage+DB+künye+rotasyon+kota
alıyor, `onprem/restore.sh` geri yüklüyor: üç parmak izi konteynerler
durdurulmadan ÖNCE karşılaştırılıyor (DEK uyuşmazlığı sert DUR, force yok),
şema-sürümü kapısı `update.sh`'ın tekniğiyle aynı, veritabanı SİLİNMEDEN
yeniden adlandırılıp boş bir kopyaya restore ediliyor (yarıda kalırsa eski
veri kaybolmuyor). Gerçek kutuda: nokta-kurtarma senaryosu uçtan uca çalıştı
(bozulma satırı silinip orijinal geri geldi), iptal yolu güvenli, DEK
uyuşmazlığı hiçbir servise dokunmadan sert durdu. Kalan gerçek boşluk:
SSH/rsync hedef sürücüsü (yalnız dizin/mount var), kendi O-numarasını
bekliyor. Kanıt ve commit'ler: kendi maddesinde (O-26).

✅ **O-83 kapandı (12.09.2026, O-26 bildirim-sonrası denetiminden çıktı, aynı
gün kapatıldı) — `api` konteynerine üç katman: `--max-old-space-size=256`
(V8 heap, işçi başına) · PM2 `--max-memory-restart 500M` (RSS, işçi başına,
aşılırsa yalnız o işçi temiz yeniden başlar) · `mem_limit: 1200m` (konteyner,
son çare).** Onprem'in uyardığı gibi tek başına `mem_limit` koymak yanlış
katmandı (Node cgroup sınırını görmez, SIGKILL'i önlemez sadece rastgele
zamanlar). Gerçek kutuda ölçüldü (işçi tepe RSS ~295 MB, `/api/rezept/upload`'a
eşzamanlı ~15 MB gövdelerle) ve yerel build ile doğrulandı (10×2 eşzamanlı ağır
istek sonrası işçiler 221-252 MB'ta kaldı, ↺=0, `OOMKilled=false`, `/health`
sağlıklı). Kanıt ve commit'ler: kendi maddesinde (O-83).

✅ **O-84 kapandı (12.09.2026, kullanıcı onayıyla gerçek VPS'te uygulandı)** — SaaS
`calendar-api`'nin repo'dan habersiz, git'e hiç girmemiş bir `command:` override'ı O-83'ün
iki yeni bayrağını (imaj güncellenmiş olsa bile) sessizce eziyordu; ayrı bir `mem_limit: 700m`
de gerçek ölçümün (~295 MB/işçi) altında kalıyordu. İkisi de düzeltildi, `docker inspect`
ile bayraklar ve yeni limit (1200m) doğrulandı, `/api/services/public` ve n8n'in kendi
`/api/v1/workflows`'u sağlam. Repo ve VPS artık senkron. Kendi maddesinde tam detay.

✅ **`restore.sh` yazıldı ve doğrulandı (12.09.2026)** — eski 1. madde buydu, artık
O-26'nın kendi kapanış notunda. "Yedek var" ile "yedekten gerçekten dönebiliyoruz"
arasındaki fark artık kapalı.

✅ **O-85 + O-86 + O-89 kapandı (12.09.2026, aynı gece)** — yapılamayan parmak-izi
kontrolü artık "uyuşuyor" demiyor (gerçek kutuda `api` durdurulmuşken ve DEK
tamamen boşken test edildi), şema kapısı internetsiz kutuda restore'u artık
komple engellemiyor, onaydan sonraki iki korumasız adım artık kılavuzlu. O-87/
O-88 yalnız kısmen (acil kısımları kapandı, genel çözümleri açık) — detay §7L.

✅ **Faz 2.2 dilim 2b tamamlandı (12.09.2026 gecesi)** — §5.4'ün 1/5/8 kontrolleri
(10 şema sayacı, RLS negatif testi, `DATA_ENCRYPTION_KEY` yaz-oku turu) kodlandı VE
gerçek kutuda hem yeşil hem kırmızı yollar ölçüldü (DEK bozulunca kırmızı, şemaya elle
tablo eklenince kırmızı, temizlik sonrası yeşil). Ayrıntı: §7H "Dilim 2b". Faz 2.2 artık
tamamen kapalı.

✅ **O-78 — ICD-10-GM atıf satırı tamamlandı (12.09.2026 gecesi).** `onprem/NOTICE-QUELLEN.txt`
yazıldı — yol boyunca `legal-de` bir hata yakaladı (bu maddenin ilk yazımı "Heilmittel-
Preisstammdatei" diyordu, gerçek kaynak Anlage 2 §125 SGB V imiş) ve kapsamı ikiden beşe
çıkardı (ICD-10-GM · Kostenträgerdatei · Physiotherapie-Vergütung · Heilmittel-Richtlinie/
Diagnosegruppen · Podologie-Katalog). Dashboard satırı `dashboard.html`'e statik blok olarak
indi (`fonksiyon-ustasi`'nın önerisiyle — yeni modül/fonksiyon yok, `dashboard.js` büyümedi).
Ayrıntı: kendi maddesi.

✅ **Faz 1.2 / O-02 kısmen kapandı (12.09.2026 gecesi)** — G1 riski taşıyan satır
(`N8N_AI_SERIES_URL` fallback'i) tamamen kaldırıldı, n8n workflow'u (`AI Series
Scheduler`) MCP ile okunup birebir Express'e taşındı (`api-backend/ai/tasks/
series-scheduler.js`). İkinci, risksiz n8n satırı (booking bildirimi) henüz
taşınmadı — ayrıntı kendi maddesinde.

✅ **O-29 madde (2) kapandı (12.09.2026 gecesi)** — `install.sh`'ın son adımına (DEK
gösteriminin hemen ardı) `GESICHERT` yazmadan geçilemeyen bir onay döngüsü eklendi,
izole test edildi. O-29 artık dört kuraldan dördü tamam, tam kapalı.

✅ **O-09 (a) — Apify/Google-Maps kutudan kapatıldı (12.09.2026 gecesi)** —
`module/lead-suche.js` + mevcut `IST_KUTU` sinyaliyle hem UI (b2b arama barı +
Ärzte "In der Nähe finden" sekmesi) hem `server.js:675` route'u kutuda kapatıldı.
Manuel Zuweiser-Arzt kaydı (Register sekmesi) etkilenmedi. **O-09 (b)**
(`B2B_AGENT_URL`, n8n) ayrı madde olarak açık kaldı — aşağıya bak.

⏸️ **O-51 (SMTP teslim ölçümü) kullanıcı kararıyla sona bırakıldı (12.09.2026)** —
belki hiç yapılmaz ya da yaklaşım değişir, ilk beta kutusunda karar verilecek.
⏸️ **n8n'e dokunan işler şimdilik ertelendi (12.09.2026)** — OCR/Rezept-Scan AI
sağlayıcı kararı netleşmeden bu alana yakın hiçbir şey yapılmayacak (bkz. memory
`project_ocr_scan_ai_saglayici.md`). Bu kapsamda **O-09 (b)** de bekliyor —
kutu hâlâ müşterinin Zuweiser CRM verisini yetkisiz şekilde n8n'e POST'luyor,
ucuz bir ara-çözüm biliniyor (kendi maddesine bak) ama n8n kararına kadar
uygulanmayacak.

✅ **O-79 — seed-besleme kapısı yazıldı (13.09.2026)** — `tools/check-onprem.sh`'a
insan-commit yolu için bir kapı eklendi (`billing/codes/*_positions.js` migrationsuz
staged edilirse red), gerçek testle doğrulandı. Kazı sırasında iki yeni madde çıktı,
aynı gün ikisi de sonuçlandı:
**O-95** (`preise-check.yml`'in otomatik CI commit'i bu kapıyı görmüyordu — aynı gün
`sync_heilmittel_katalog.js --sql` moduyla kapatıldı, kendi maddesine bak) ve **O-96**
(⚠️ `gkv-302` doğruladı, ciddi çıktı: `heilmittel_tarif`, elle beslenen ve süresiz bir
tablo, resolver'da §302 tutarını katalog fiyatının önüne geçiriyordu — 01.01.2027'de
sessiz eksik ödemeye dönüşecek bir zaman bombasıydı. **Aynı gün kapatıldı**: override
koddan tamamen kaldırıldı, kendi maddesine bak).

✅ **13.09.2026 gece — ikinci-göz turu (kullanıcı isteği, dört ajan paralel):** bu
oturumun sekiz maddesi (O-09(a)/O-79/O-96/O-82/O-44/O-33/O-80/O-95) `onprem`/`gkv-302`/
`db-ustasi`/`guvenlik` tarafından bağımsızca yeniden koda karşı denetlendi. Sonuç: hepsi
doğrulandı, ama denetim dört YENİ madde buldu (**O-97/O-98/O-99/O-100**, hepsi aynı gece
kapatıldı — detay kendi maddelerinde, özet §9'da) ve O-95'in düzyazısının (bu blok dahil)
bir yerde hâlâ `offen` dediğini yakaladı — tablo doğruydu, metin bayattı, düzeltildi.

🟡 **O-82 — bildirim kanalı yazıldı (13.09.2026)** — `update.sh`'ın "ok" dışındaki her
sonucu artık kutunun kendi SMTP'siyle owner'a mail atıyor (durum değişince hemen, aynı
durum sürerse 7 günde bir, `ok`'a dönüşte Entwarnung). Kod + izole mantık testi (8/8)
tamam, **gerçek kutuda henüz denenmedi** ve `SMTP_HOST` boş kutularda kanal yok — bu
yüzden kısmen. Detay kendi maddesinde.

✅ **O-44 — sicil güncellendi, iş zaten bitmişti (13.09.2026)** — kod incelenince
`prescriptions`'ın iki yazma yolu sorununun 06.09.2026'da zaten çözüldüğü ortaya çıktı
(`module/verordnung-an-backend.js`, "Server kazanır" kararı + Ops #289'da PATCH yolu
tamamlandı) — register bunu hiç işlememişti, yeni iş yapılmadı, yalnız üç şartın
(taban adresi tekilliği, owner_id+satır-kanıtı, ağ hatası sessiz geçmiyor) kodda
gerçekten karşılandığı doğrulanıp sicil `gelöst`e çekildi.

🟡 **O-33 — karar verildi (13.09.2026)**: plan farkı yalnız modül bazlı olacak, çalışan
sayısı hiç sayılmayacak (b seçeneği kapandı). Uygulaması (lisans dosyası formatı) Faz
3.3'ün kapsamı, o faz açılmadan gündeme dönmez.

Bağımsız açık madde kalmadı — bu turun kolayca çözülebilir listesi tükendi. Geriye
kalanlar (O-18/O-23/O-32/O-46/O-75) ya büyük fazlara bağlı ya da başka bir kararı
bekliyor; kendi maddelerine bakılmalı. (O-80/O-95 aynı gün kapandı — bkz. yukarı.)

✅ **14.09.2026 — üçüncü tur, /konsey ile.** Kullanıcı isteğiyle bu oturumun 12 maddesi
(O-09a/O-79/O-96/O-82/O-44/O-33/O-80/O-95/O-97/O-98/O-99/O-100) yedi üyeli bir konsey
turunda (dört alan uzmanı + `muhalif`/`deger-mi`/`fonksiyon-ustasi`) tekrar denetlendi.
Hepsi doğrulandı, dört YENİ ve gerçek sorun bulundu (**O-101…O-104**, hepsi aynı gece
kapatıldı — özet §9'da, detay kendi maddelerinde). En ciddisi O-101 (Zuzahlungskennzeichen
ters yazılıyordu, Anlage 3 §8.1.3'e karşı doğrulandı) ve O-102 (CI botunun push'u
`publish-calendar-api.yml`'i hiç tetiklemiyordu — otomatik fiyat güncellemesi main'e
iniyordu ama muhtemelen hiç canlıya çıkmamıştı). `guvenlik`/`gkv-302`/`db-ustasi`/
`fonksiyon-ustasi` bulguları için sırasıyla `guvenlik/REGISTER.md` (S-28), O-101, ve
`db/migrations/README.md`'nin yeni "SaaS'a hangi migration'lar uygulandı" bölümü.

⚠️ **14.09.2026 (akşam) — yerel kutu testinden iki yeni madde.** Kullanıcının
kendi on-prem yığınında çalıştırdığı tur: **O-105** (CORS beyaz listesi kutunun kendi
adresini tanımıyor → kutuda POST/PATCH/DELETE'in tamamı ölüyor) ve **O-106** (Ayarlar'daki
„Abonnement verwalten"/„Upgrade" butonları kutuda bizim SaaS kayıt akışımıza götürüyor;
on-prem owner'ın `stripe_subscription_id`'si hiçbir zaman olmayacak, çözüm §7H'deki
maddede). ⚠️ O-106'nın kenarında bir **kapı dersi** var: `tools/check-onprem.sh`
`git grep --cached` ile sayar, yani **stage edilmemiş** bir ihlali göremez —
`app_host` çalışma ağacında **16**, taban **15**; `git add dashboard.js` anında
commit reddedilecek.

⚠️ **16.09.2026 — Faz 2.1b'nin header'ından iki madde: O-109 (kapandı) + O-110 (açıldı).**
Kullanıcının „kart okuyucu için Secure Context var mı" sorusu Caddy'nin
`Permissions-Policy` satırına bakılmasına yol açtı. Cevap: **Caddy/TLS tarafı sağlam** —
kutu HTTPS veriyor, kök sertifika kurulduğunda `isSecureContext` true, Web Serial açılabilir.
Ama aynı satır `camera=()` ile kamerayı kutunun **kendi** sayfasına da kapatmıştı ve
Rezept-Scan'in webcam yolu kutuda sessizce kırıktı (**O-109**, aynı gün kapatıldı;
doğrulama borcu: çalışan kutuya karşı ölçülmedi). Kart okuyucunun kendisi **O-110**
olarak `offen` açıldı — bugünkü tek iş `serial=(self)` izniydi, entegrasyon ORGA 930 care
Mini-SDK dokümantasyonunu bekliyor. ⚠️ Faz 2.1b **kapalıdır** (12.09.2026'dan beri);
bu iki madde onu yeniden açmıyor.

⚠️ **14.09.2026 (gece) — kullanıcı sorusundan bir yeni madde: O-107.** „Sihirbazda
girilen owner şifresi nereye yazılıyor, sıfırlamak isterse ne olacak?" Birinci yarısı
temiz (şifre müşterinin kendi kutusundaki `auth.users`'ta, bize hiçbir şey gitmiyor),
ikinci yarısı **açık**: SMTP kurulmamış kutuda şifre unutulursa kurtarma yolu yok,
sihirbaz tek kullanımlık, ve tek görünür seçenek olan `install.sh --neu` veritabanını
siliyor. Çözüm bir host betiği (`reset-owner-passwort.sh`) — ⛔ **HTTP ucu değil**.

> ⚠️ **12.09.2026 — bu blok neden yeniden yazıldı:** önceki hâli (11.09.2026 gece)
> Faz 2.1c'yi hâlâ "yapılacak" gösteriyordu, oysa `install.sh` o gece zaten yazılmıştı —
> yalnız O-numaralarının Durum satırları güncellenmemişti. Bir onprem-review turu
> (12.09.2026) sicili koda karşı sayıp beş maddeyi (O-50/O-52 (b)/O-53/O-62 + bu blok)
> düzeltti. Ders, O-58/O-68 turunun dersinin aynısı: **bir şeyi kapatan iş, onu
> kapatan her yeri saymadan bitmez** — bu kez "her yer" kod değil sicilin kendisiydi.

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

**18.09.2026 — konsey: on-prem şema reformu REDDEDİLDİ (O-111, §7O).** Çoklu-kiracı
deseni (`owner_id`/`business_id`/RLS) **her iki dağıtımda aynen kalır** — tek şema gerçeği,
tek migration zinciri. ⛔ Kapanmış karar, yeniden açılmaz. İki yanlış öncül de orada
kayıtlı: **(1)** baseline **donmuş durumda** (10.09.2026; 0001…0025 üzerinde koşuyor,
`migrate.js` SHA-256 tutuyor) — "baseline'ı değiştirelim" artık **DUR** alır, düzeltme her
zaman yeni dosyayla; **(2)** `owner_id` ayrıştırılabilir iki eksen değil, kutuda da
employee↔owner bağını taşıyor. Açık kalan tek iş: 5 ölü tablo + 5 ölü kolonun ayrı
DROP migration'ı (**Faz 5.1**, bu hafta değil).

⚠️ **20.09.2026 — §302 Echtbetrieb turu: bir geriye dönük denetim, bir ön kontrol (§7P).**
19–20.09 gecesi `api-backend/billing/*` altına **12 commit** indi ve push'landı; tetikleyici
kural işlemedi, `onprem` çağrılmadı. Geriye dönük denetim: **yeni bulut zinciri yok**
(ölçüldü — eklenen satırlarda `process.env`/`fetch(`/`http://`/cron/n8n **0**, migration
dosyası **0**, kapı exit **0**; **O-112** `unkritisch`). Ama tur iki kutu sonucu doğurdu:
**O-113** (preflight artık sert `throw` ediyor — yanlış tek bir kural, kutuda **günlerce**
düzeltilemeyecek bir abrechnung durması demek; SaaS'ta aynı hata 60 saniyede kapanıyor) ve
**O-114** (19.09'da iki bozuk satır canlıda SQL ile silindi — kutuda o yol yok, satırı
kaldıran ekran da yok). Aynı gece yazılan `ABRECHNUNG_ECHTBETRIEB_PLAN.md`'nin her adımına
ön kontrol uygulandı → **O-115** (Datenaustauschreferenz sayacı göç/geri-yüklemede geri
sarar) · **O-116** (alıcı sertifikası: kutudan runtime indirme **DUR**, tip B + son-kullanma
kapısı) · **O-117** (`kind` env değil **DB**, ve kutuda anahtarı müşteri çevirmeli) ·
**O-118** (Kostenträger/Annahmestellen seed'i Mayıs 2026'da dondu, besleme kapısı yok) ·
**O-119** (⛔ §302 dosyası merkezden proxy'lenmez — G1, şimdiden konan kısıt) · **O-120**
(özel anahtar bize gelmez: kalıcı kısıt; eksik olan sertifika son-kullanma uyarısı).

⭐ **20.09.2026 akşamı — aynı planın Faz 1'i: beş migration, canlıya uygulanmadan önce
denetlendi (§7Q).** Bu sefer tetikleyici **doğru zamanda** işledi — `0026`–`0030` henüz
dosyada, yani düzeltme hala ucuz. Hüküm: **GEÇER, KAYITLA — tek sert şartla (O-122:
sayacın `ON DELETE CASCADE`'i onu silinebilir, yani geri sarabilir yapıyor).** Tur dört
madde daha açtı: **O-121** (kutuda şema-önce/kod-sonra garantili, **SaaS'ta değil** —
bu beşi için sıra bağlayıcı: önce migration, sonra push) · **O-123** (O-115'in kalan
yarısı: `vorstellen()` yazıldı ama üç anın üçünde de çağıran yok) · **O-124**
(reddedilen her deneme bir referans numarası yakıyor — `gkv-302`'ye soru) · **O-125**
(henüz yazılmamış `0031`/`0032`/`0033` ve O-118 kapı genişletmesinin ön kontrolü).
⭐ Turun kazanımı: `module/podo-storno.js` **O-114'ün kutu gerekçesini kapattı**.

⭐ **20.09.2026 gecesi — aynı Faz'ın ikinci yarısı: `0031`–`0037` (§7R).** Bu sefer
denetim uygulama **sonrası** oldu ama zamanında: hüküm **GEÇER, KAYITLA — sert şart yok**.
§7Q'nun tek sert şartı (**O-122**, sayacın silinebilmesi) uygulamadan önce ve istenenden
iyi kapandı (`SET NULL` + üç RPC'de kendini onaran `coalesce()`). Aynı gece **dört madde
kapandı** — O-114 (kutuda onarım yolu), O-117 (Betriebsart per Empfänger + kutuda owner
arayüzü), O-122, O-124 (`gkv-302`: spec "fortlaufend" ister, "lückenlos" değil) — ve
**dört yenisi açıldı**: **O-126** (seed gövdesi script'le değil elle üretildi; kanıt
sunuldu, kural yazılı değil) · **O-127** (⛔ `verwerfungsgrund` ve `fehlertext` hiçbir
tanılama paketine/filo panosuna girmez — G1) · **O-128** (seed migration'ları birikiyor,
taze kurulum her çeyrekte bir tam kopya daha koşacak) · **O-129** (`-- SaaS: uygulandı`
satırı 10 dosyanın 10'unda da yok — 14.09'da konan disiplin iki dosya sonra sustu).
İki eski madde ilerledi: **O-118** (besleme yürüdü, kapı hâlâ yok) · **O-125** (şart 1
tam, kapı yazılmadı).

⭐ **21.09.2026 — Adım 1.3: ITSG Trust-Anchor zinciri, push'tan ÖNCE (§7S).** Üç commit
(`9cafbc9`/`981f1b7`/`b39222e`) main'de ama origin'de değil; denetim yine ucuz anda.
Hüküm: **GEÇER, KAYITLA — sert şart yok, push bloklanmıyor.** O-116'nın üç şartı da
gerçekten uygulanmış ve kutu ITSG'ye **hiç çıkmıyor** (tek `curl` merkezde, Actions'ta);
yeni secret yok (`TELEGRAM_*` + `GITHUB_TOKEN`, hepsi eskiden var). Ama tur **üç sessiz
kırılma** buldu: **O-130** (runtime'da düzeltilen "tek bitmiş anker her şeyi durdurur"
hatasının ikizi CI'da duruyor — 06.01.2027'de otomatik güncelleme zinciri kalıcı olarak
ölüyor, tarih ölçüldü) · **O-131** (şifreli dosya üretiliyor ama kimse okumuyor; müşteri
hâlâ şifrelenmemiş `.p7m`'i indiriyor, ve `verschluesselt:false` hiç gösterilmiyor) ·
**O-132** (alıcı sertifikası kutuya hiç varmıyor — tabloyu dolduran tek yol bizim yönetici
makinemiz, K10). Bu üçü yüzünden **O-116** 🟠 → 🟡, `gelöst` değil.
Toplam **132** madde.

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
> **12.09.2026 — fallback kutuya da giriyor: G1 açısından niye sorun değil.**
> (Bir kez yazılıyor ki üçüncü kez araştırılmasın.) `supabase-config.js` kutunun
> frontend image'ına **giriyor** (`onprem/frontend.Dockerfile:83`), yani `API_BASE`'in
> `'https://n8n.infinitymade.de/api'` fallback'i müşterinin sunucusundaki dosyada
> **var**. İlk bakışta G1 ihlali gibi durur: `/api/config` bir an cevap vermezse
> tarayıcı hasta verisini bizim VPS'imize gönderir. **Göndermez** — kutunun Caddy'si
> `connect-src 'self' {$SUPABASE_PUBLIC_URL} {$SUPABASE_PUBLIC_WSS}` diyor
> (`onprem/Caddyfile:45`); tarayıcı o isteği **hiç yapmaz**, CSP ile düşer.
> ⚠️ Ama koruma **yapısal değil, tek katmanlı**: CSP satırı gevşetilirse fallback
> sessizce canlanır — `no-pg-net.sql`↔O-71 ikilisinin aynısı, orada kapı kondu,
> burada henüz yok. Kalıcı çözüm Faz 2.0/2.6'da: fallback kutu build'inde boş
> string'e düşsün — o zaman CSP **ikinci** katman olur, tek katman değil.
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
>   `install.sh` preflight bu ikisi boşsa kurulumu başlatmasın.
>   **Durum:** ✅ `gelöst` (12.09.2026, sicil düzeltmesi — kod zaten `install.sh`
>   yazıldığı turda inmişti, sicil geride kalmıştı) — `install.sh:311-317` Schritt 9,
>   yedi zorunlu alanı (`SUPABASE_PUBLIC_URL` · `ANON_KEY` · `SERVICE_ROLE_KEY` ·
>   `JWT_SECRET` · `POSTGRES_PASSWORD` · `DATA_ENCRYPTION_KEY` · `SETUP_TOKEN`) `fail`
>   ile kapatıyor, `docker compose up`'tan önce. ⚠️ Bu maddenin kendi `###` girdisi
>   hiç olmadı, hep bu not bloğunda kaldı — kaybolmaya açık, ileride kendi girdisine
>   terfi etmeli.
> - **O-54** — `PUBLIC_API_BASE` yeni bir SaaS tek-nokta-arızası: Vercel'de yanlış
>   set edilirse **bütün** SaaS trafiği yanlış backend'e gider, `NEXT_PUBLIC_URL`
>   ile aynı sınıf risk, fallback devreye girmez (env zaten set edilmiş sayılır).
>   Tip C/E. **Çözüm:** Vercel'de bu env **hiç set edilmemeli** — kod zaten doğru
>   varsayılanı biliyor. CLAUDE.md env listesine + Ops **Launch** kartına
>   "PUBLIC_API_BASE: dokunma, set edilmemiş kalsın" notu düşülecek. **Durum:** `unkritisch`
>   (şimdilik dokunulmadığı için), ama not edilmezse birinin "eksik env" sanıp
>   doldurma riski var.

### O-02 — `N8N_AI_SERIES_URL` fallback'i koda gömülü n8n adresi 🟡 **kısmen gelöst (12.09.2026)**

| Alan | İçerik |
|---|---|
| **Ne** | AI seri-planlayıcı env var yoksa sabit n8n webhook'una düşüyor |
| **Nerede** | ✅ **Düzeltildi** — eski `api-backend/server.js:2032` (`process.env.N8N_AI_SERIES_URL || 'https://n8n.infinitymade.de/webhook/ai-series-scheduler'`) tamamen kaldırıldı |
| **Tip** | C + A (fallback runtime dış çağrı) |
| **Kutuda ne olur** | Artık hiçbir şey — dış çağrı yok, sabit adres yok |
| **✅ Yapılan (12.09.2026)** | n8n workflow'unun kendisi (`Q7u38AtRd4JIdolD` "AI Series Scheduler", MCP ile okundu: Webhook → Build Prompt → Azure OpenAI → Parse Response) birebir Express'e taşındı: `api-backend/ai/tasks/series-scheduler.js` — aynı prompt metni (satır satır aynı, davranış değişmesin diye), aynı model (`gpt-4.1-mini`, `azureClient.js`'in zaten kullandığı varsayılan deployment — `rezept-ocr.js` da aynısını kullanıyor, aynı Azure kaynağı). `server.js` artık `seriesSchedulerRun()` çağırıyor, hata/dry-run'da (Azure yapılandırılmamışsa) `{selected:[], report:''}` dönüyor ve mevcut deterministik seçim aynen devreye giriyor — n8n çökmesiyle davranışsal fark yok, sadece dış bağımlılık gitti. Dry-run modda test edildi (yerel, Azure kimlik bilgisi yokken `{selected:[],report:''}` döndü, doğru). |
| **Kalan** | İkinci n8n satırı (`server.js:1279`, `N8N_WEBHOOK_URL`, booking bildirimi) **taşınmadı** — bu satır zaten PII taşımıyor (yorum: "customerName/Email/Phone omitted") ve sabit fallback'i yok (env yoksa sessizce atlanıyor), yani **G1 riski yok**. Hangi n8n workflow'unu tetiklediği doğrulanmadı (33 workflow arasında adı koddan belli değil) — Faz 1.2'nin kendi kabul kriteri ("`grep N8N_` → sıfır") tam olarak bu yüzden henüz karşılanmıyor. Risk düşük, acil değil |
| **Durum** | 🟡 `kısmen gelöst` — G1 riski taşıyan satır kapandı, ikinci (risksiz) satır açık kaldı |

> **11.09.2026 — kutu paketi bu maddeyi teorik olmaktan çıkardı.**
> `onprem/.env.template` `N8N_AI_SERIES_URL`'i **bilinçli olarak taşımıyor** — paketin
> tamamında tek bir `N8N_` yok (ölçüldü). Ama kod deseni `process.env.… || '<sabit n8n
> adresi>'`, yani değişkenin yokluğu fallback'i **kapatmıyor, açıyor**. Seri planlayıcı
> kutuda ilk çağrıldığında hasta adı bizim n8n'imize POST edilir → **G1**. Bu yüzden
> Faz 1.2 artık bir tercih değil **takvim kısıtı**: ilk ücretli kutudan önce inmeli.
>
> **12.09.2026 — kapandı.** Yukarıya bak.

### O-03 — `app.praxura.de` uygulama kodunda sabit (pazarlama sayfaları hariç) ✅ **gelöst (02.10.2026, KHS K2)**

| Alan | İçerik |
|---|---|
| **Ne** | Login yönlendirmesi, paylaşım linkleri, OAuth redirect'leri ve auth mail redirect'leri merkez domain'e sabitlenmiş |
| **Nerede** | **19 satır / 5 dosya** (app yüzeyi): `api-backend/server.js` 10 (`:48` CORS · `:342` `:364` `:379` `:382` OAuth redirect · `:2788` auth mail redirect · `:3974` booking-request onay linki · mail HTML'lerinde 3) · `dashboard.js` 5 (`:1090` `:14322` `:17232` `:17282` `:23339`) · `employee-signup.js` 2 (`:288` `:297`) · `admin-login.js:12` · `dashboard.html:4735` (ekranda gösterilen metin).<br>Ayrıca pazarlama/blog tarafında ~30 kez — **onlar sorun değil**, bkz. O-04 |
| **Tip** | C |
| **Kutuda ne olur** | Üç ayrı kırılma: (1) `dashboard.js:14322`/`:23339` müşterinin çalışanına ve hastasına **bizim** domain'imize giden link üretir — o link müşterinin kutusundaki hesabı tanımaz; (2) `employee-signup.js:288/297` auth doğrulama mailini `app.praxura.de/confirm.html`'e yönlendirir, kutudaki GoTrue oraya redirect edemez → çalışan kaydı ölür; (3) `server.js:3974` hastaya giden randevu onay linki bizim domain'e gider → hasta bizim sunucumuza tıklar |
| **Çözüm** | Üçe ayır: **origin türetilebilenler** (`dashboard.js:1090` `:17232` `:17282` zaten `window.location.origin` + fallback deseninde — fallback'i kaldırmak yeter) · **backend'in bilmesi gerekenler** → `PUBLIC_BASE_URL` env var'ı (sihirbaz doldurur) · **CORS listesi** (`server.js:48`) → env'den beslenen liste. **Faz 1.1 + Faz 2.2** |
| **Durum** | `gelöst` (`56cb6a7`, K2.8 / O-150). Kapı `app_host` 19→15→**7** ve kapsamı artık `api-backend/routes/` + `module/`'ü de sayıyor (`tools/check-onprem.sh:79-80`). Kalan 7 satırın 7'si de zararsız (`git grep --cached`, 02.10.2026): `admin-login.js:12` (admin paneli merkezde, kutuda yok) · `server.js:61` (CORS listesi; kutuda aynı-origin, O-105) · `dashboard.js:704` `:14899` `:14949` (`window.location.origin ||` fallback'i — tarayıcıda origin hep dolu) · `module/mitarbeiter-zugang.js:191` (yalnız `window` yoksa) · `module/subscription-ui.js:8` (yorum) — Önceki: `geplant` (Faz 1.1 / 2.2) — kapı tabanı: **19** |

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
| **Çözüm** | **Faz 2.6** — Sentry opt-in: sihirbazda kapalı-varsayılan onay kutusu; kapalıysa lokal `error_logs` tablosuna yaz. Loader etiketi HTML'den çıkar, koşullu enjeksiyona döner. Playbook Faz 1.4 bunu bilinçli istisna olarak ayırmış ("Sentry loader hariç — o Faz 2'de koşullu olacak") | Mekanizma **O-58 ile aynı** — yeni bir build target/paketleme script'i değil, mevcut çalışan desen: `/api/config`'e bir alan daha eklenir (örn. `telemetryEnabled`, SaaS'ta hep `true`, kutuda kurulum sihirbazının onay kutusuna bağlı env), `supabase-config.js` onu okur, **statik `<script src="https://js-de.sentry-cdn.com/...">` etiketi 11 HTML dosyasından çıkar**, `sentry-init.js` (ya da önüne konan küçük bir yükleyici) flag true ise script elemanını runtime'da `document.createElement` ile ekler. Flag false ise DOM'a hiç script etiketi girmez — DNS/network isteği doğmaz. CSP'nin bugün bunu bloke ediyor olması (O-52) yeterli **değil**, o kendi notunda da "ikinci savunma hattı tek hat değildir" diyor; asıl kapanış statik etiketin HTML'den çıkmasıdır.
| **Durum** | ✅ **gelöst (17.09.2026, `1935d73`)** — mekanizma O-58'in `istKutu`/`IST_KUTU` deseniyle aynı: `/api/config`'e `telemetryEnabled` eklendi (`server.js:429` kutuda `!process.env.SUPABASE_PUBLIC_URL` → varsayılan **KAPALI**; `api/config.js:16` Vercel'de sabit `true` → SaaS davranışı değişmedi). 11 HTML dosyasından statik `<script src="https://js-de.sentry-cdn.com/...">` + `index.html`'deki `<link rel=preconnect>` çıkarıldı. `sentry-init.js` artık kendi `fetch('/api/config')` çağrısını yapıp flag `true` değilse loader'ı hiç `document.createElement` ile eklemiyor — kutuda (flag false) sayfa hiçbir zaman `sentry-cdn.com`'a DNS isteği atmıyor, CSP tek savunma hattı olmaktan çıktı (O-52'nin uyarısı karşılandı). Kapı tabanı aynı commit'te otomatik sıkıştı: `ext_script` **11→0** (`tools/.onprem-baseline`). Setup-Wizard opt-in ekranı (müşteri isterse açabilsin) hâlâ Faz 2.6'nın kalan parçası — bugünkü hedef (varsayılan kapalı, G4) karşılandı, açma arayüzü henüz yok. Kod tarafı bende doğrulanmadı canlıda; canlı doğrulama `canli-test` görevine bırakıldı |

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

> **Nachtrag 28.09.2026 (bildirim, kod değişmedi):** SaaS Azure kaynağı işletme aboneliğine taşındı — Sweden Central, Standard (Global değil) deployment, `gpt-4.1-mini` 2025-04-14, otomatik sürüm yükseltme kapalı. VPS `.env.calendar`’da yalnız 4 `AZURE_OPENAI_*` **değeri** değişti, yeni env adı yok; boot’ta EU Data Boundary kontrolü `region=swedencentral` ile geçti. Kutuya etkisi yok (AI kutuda varsayılan kapalı, E kararı). **Faz 1.3 için yeni girdi:** Microsoft Modified Abuse Monitoring başvurusu “managed customer” şartı taşıyor ve **her praxis kendi adına** başvurmak zorunda — yani `AI_PROVIDER=azure` BYO-key seçeneğinde abuse-monitoring muafiyeti bizim tarafımızdan sağlanamaz, her müşteriye ayrı iş yükü. K4’ün IONOS varsayılanını güçlendirir; Azure seçeneği sihirbazda sunulacaksa bu şart ekranda yazılmalı. C5 (dipnot 6) ve §203 ticket’ları açık, sonuç gelince buraya.

> **Nachtrag 29.09.2026:** Azure fiilen kapandı (Modified Abuse Monitoring reddi, `compliance/LEGAL_DECISIONS.md:270` vd.); aday sağlayıcı **STACKIT AI Model Serving** (EU01, C5 Typ 2, OpenAI-uyumlu). "Anahtar bizden" varyantının ön kontrolü → **O-134** (G2 vetosu yok, 10 şart), anahtar kaynağı/rotasyon → **O-135**, eksik `AI_MODEL_*` → **O-136**, limit/maliyet kapsamı → **O-137**. Bu maddenin kendi şartı hâlâ açık: `azureClient.js:38-40` üretimde anahtar yokken `throw` ediyor (29.09 tekrar okundu) — hangi sağlayıcı seçilirse seçilsin ilk iş bu.

### O-08 — Google Calendar / Gmail OAuth — bizim OAuth uygulamamız

| Alan | İçerik |
|---|---|
| **Ne** | Google takvim senkronu ve Gmail gönderimi bizim Google Cloud projemizin OAuth client'ı üzerinden |
| **Nerede** | `api-backend/server.js:314-315` `:329` (scope'lar) · `:350` `googleapis.com/oauth2/v2/userinfo` · `:433` `gmail.googleapis.com/…/messages/send` · redirect'ler `:342` `:364` `:379` `:382` (hepsi `app.praxura.de` sabit, bkz. O-03). Frontend girişi: `dashboard.js:11908`, `kalender.js:765`. Token'lar Supabase Vault'ta |
| **Tip** | A + E |
| **Kutuda ne olur** | Üç yerden birden kırılır: (1) OAuth redirect URI Google konsolunda `app.praxura.de`'ye kayıtlı — müşterinin domain'i orada olmadığı için akış `redirect_uri_mismatch` ile ölür; (2) `GOOGLE_CLIENT_SECRET` bizim sırrımız, kutuya konamaz (G2); (3) her müşteri ayrı domain, wildcard redirect yok → her kurulumda Google konsoluna elle giriş = Faz 4 provisioning otomasyonu çöker. Ayrıca PoC 0.3'te görüldü: `GOOGLE_*` env'leri **boot'ta zorunlu**, dummy değerle ayağa kaldırıldı |
| **Çözüm** | **Faz 2.8** — on-prem build'de feature flag ile kapalı; §9-A3'te "v1'de YOK" kararı zaten yazılı. Talep gelirse seçenekler: müşterinin kendi OAuth app'i · CalDAV/ICS-feed · cihaz akışı. E-posta zaten SMTP'ye dönmüştü, Gmail yolu ikincil. Aynı görevde `GOOGLE_*` boot-zorunluluğu da kaldırılmalı |
| **Durum** | `geplant` (Faz 2.8) · alt-soru `offen` (§9-A3, kullanıcı kararı bekliyor) |

### O-09 (a) — Apify (Google Places crawler) — bizim token'ımız, B2B/Ärzte lead araması

| Alan | İçerik |
|---|---|
| **Ne** | İşletme arama/lead toplama Apify aktörüne çıkıyor — İKİ ayrı UI girişi: "Zuweiser" (b2b) sekmesindeki Google-Maps arama barı VE "Ärzte" sekmesinin "In der Nähe finden" alt-sekmesi (ikisi de aynı `/api/apify/search`'e gidiyor) |
| **Nerede** | `api-backend/server.js:675` (`api.apify.com/v2/acts/compass~crawler-google-places/…?token=`) · Vercel tarafı `api/apify/search.js` (SaaS'ta kalıyor, dokunulmadı) · frontend: `module/lead-suche.js` (12.09.2026 öncesi `dashboard.js:9349`+`13613`'teydi) |
| **Tip** | A + E + G |
| **Kutuda ne olur** | Müşteri kutusundan bizim Apify token'ımızla dışarı çıkılır → G2/K5 ihlali, faturası bize gelir. Ama asıl soru bu değil: bu özellik **hasta işi değil**, bizim B2B pazarlama/lead aracımız. Müşterinin praxis'inde işi yok |
| **Çözüm** | Nav-registry'ye ikinci bir görünürlük sistemi eklenmedi (konsey/onprem/fonksiyon-ustasi üçü de: özel durum için ikinci liste = altı ay sonra "hangi liste doğru" sorunu). Bunun yerine mevcut `IST_KUTU`/`istKutu` sinyali (zaten vardı: `supabase-config.js:24` frontend, `server.js:416` backend, `login.js:200`'de aynı `.remove()` deseni) kullanıldı: `module/lead-suche.js` içinde `IST_KUTU` ise dört düğüm (`.apify-bar` b2b'de · `#panel-doctors .tabs` · `#arztTabSuche`) DOM'dan sökülüyor, listener'lar hiç bağlanmıyor. "Ärzte → Register" alt-sekmesi (manuel Zuweiser-Arzt kaydı, `module/arzt-register.js`, Apify'dan bağımsız) kutuda tam işlevsel kalıyor. Backend: `server.js:675` aynı `SUPABASE_PUBLIC_URL` sinyaliyle (`istKutu`'nun kaynağı) 404 dönüyor |
| **Durum** | ✅ **gelöst (12.09.2026)** — `node --check` ile syntax doğrulandı, `dashboard.js` 21249→21014 satıra indi (baseline'ı büyütmedi, aksine sıkıştırdı). Gerçek tarayıcıda IST_KUTU=true görünüm testi henüz YAPILMADI (sıradaki onprem-review turunda doğrulanmalı) |

### O-09 (b) — B2B_AGENT_URL (n8n mail-agent) — Zuweiser panelinin AI-mail özelliği ✅ **gelöst (02.10.2026, KHS K2)**

| Alan | İçerik |
|---|---|
| **Ne** | "Zuweiser" panelinin Gmail-bağlantılı AI mail-taslağı özelliği, n8n workflow'una POST atıyor |
| **Nerede** | `dashboard.js:11784` (`B2B_AGENT_URL = 'https://n8n.infinitymade.de/webhook/b2b-mail-agent'`) · kullanım `dashboard.js:12004` · UI: b2b panelindeki `.ai-chat-card` (Gmail connect + config modal) |
| **Tip** | A + G (n8n) |
| **Kutuda ne olur** | Kutu hâlâ POST atıyor — `dashboard.js:12004`'teki istek Authorization başlığı olmadan müşterinin gerçek Zuweiser CRM verisini (≤30 kişi + praxis kimliği) bizim n8n webhook'umuza gönderiyor. On-prem'in vaat ettiği "hasta/praxis verisi bize hiç akmaz" garantisinin **tersi** — G1 sınıfı bir risk, Apify'dan (token/maliyet sorunu) daha ciddi (veri sorunu) |
| **Çözüm** | Kullanıcı talimatıyla (12.09.2026) bu turda **ertelendi** — n8n'e dokunan hiçbir iş bu oturumda yapılmıyor. Ucuz bir ara-adım biliniyor ve uygulanmadı: aynı `IST_KUTU` deseniyle `dashboard.html`'deki `.ai-chat-card` girişini de kutudan kaldırmak (SaaS'a dokunmadan, n8n workflow'una dokunmadan, sadece kutunun UI'ının POST atma yolunu kapatarak) — bu yapılırsa O-09(b) tek adımda kapanır |
| **Durum** | `gelöst` (kutu tarafı, `a4634f7`, K2.9): `module/lead-suche.js` kutu dalında „KI Mail-Assistent" kartını `.remove()` ile **siler** (gizlemez) — kutuda Zuweiser verisini n8n webhook'una POST'layan tetik kalmadı, G1/G3 temiz. SaaS'taki n8n bağı merkez işi; `n8n_host` sayacında duruyor, Faz 1.2 ile gider — Önceki: `offen` — n8n kararı netleşene kadar bilinçli olarak beklemede (bkz. §"Sıradaki iş"). Register'daki ilk O-09 maddesi bunu Apify ile aynı kalemde saymıştı, bu yanlıştı — ikisi bağımsız özellikler, ayrı satırlarda takip edilmeli |

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
| **Durum** | 🟡 kısmen, **kutu tarafı güvenli** (`a4634f7`, K2.9 / K-5): `module/hausbesuch-route.js` kutuda `#bkHbBerechnenBtn`'ı açıklama metniyle değiştiriyor. Edge Function'a giden tek yol o düğme: `invokeFahrtenbuchFn` çağrıları (`dashboard.js:5141` `:5171` `:5177`) yalnız `:5149`'daki tek dinleyiciden ve `ensureClinicLocation()`'dan (o da yalnız bu dinleyiciden) geliyor — düğme yoksa yol ölü. Elle km girişi duruyor. Kalıcı çözüm (Express proxy) hâlâ Faz 1.5 — Önceki: 🟡 **kaynak kurtarıldı (04.09.2026)** — Faz 1.5 artık başlayabilir |

> **01.10.2026 — kolon silme iki adımı uçtan uca işletildi (Reform 3.12).**
> Adım a/b: `e9d0286` (kod PHI-Spalten'e yazmayı bıraktı) + `0049`/`0050` (Festschreibung
> `icd10_enc`'siz, PHI kalıntıları boşaltıldı). Adım c: `0051_phi_spalten_entfernen.sql`
> (commit `33ae965`) sütunları düşürdü; dosyada `-- zweistufig:` gerekçesi var, kapı onu
> istedi. Önkoşul: kurulu müşteri kutusu yok (Kemal teyit etti, 01.10.2026) + SaaS image
> >= `e9d0286`. Kontroller: bağımlı view/fonksiyon 0, kalan sütun/index 0, eingereichte
> Verordnung UPDATE'i kilit trigger'ından geçti (rollback testi). ⚠️ 0049-0051'i taşıyan
> ilk sürüm **MINOR** olmalı; `:stable`'a terfide kutu yoksa sorun yok, kutu varsa önce
> kutunun image'ı >= `e9d0286` olmalı (yoksa eski kod düşmüş sütuna yazar, 42703).
> `:beta` ve `:stable` aynı anda canlı olduğundan, kutu çıktıktan sonra bu desen şarttır.

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
| **Durum** | `unkritisch` (D4 hükmü doğrulandı). ⚠️ **11.09.2026 güncellemesi:** yukarıdaki "müşterinin IP'si OSM'e görünür" notu **kutuda artık geçerli değil** — Faz 2.1b'nin CSP'si (`connect-src 'self' …`) bu çağrıyı tarayıcıda engelliyor, istek hiç çıkmıyor. Bedeli: `clinic_lat/lng` kutuda hiç dolmuyor, `catch` sessizce dönüyor, Hausbesuch mesafesi O-11'in üstüne ikinci kez kayboluyor. Madde `unkritisch` kalıyor ama gerekçesi "zararsız veri gidiyor"dan "hiç gitmiyor, özellik susuyor"a döndü. Satır atıfları da kaymış: güncel yer `dashboard.js:20683` (blok `:20674`). **30.09.2026:** güncel yer `dashboard.js:19353` (fonksiyon `:19343`); kırılan tüketici Anwesenheit GPS kontrolü çıktı, Hausbesuch değil. Çözüm kararı **O-140** (çağrı silinir, konum cihazdan) |

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
| 12 | `api/apify/search.js` | `module/lead-suche.js` (SaaS'ta; kutuda IST_KUTU ile kaldırılıyor) | **MERKEZ** | B2B lead aracı, hasta işi değil — O-09 (a) ✅ |

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
| **Durum** | ✅ **gelöst (02.10.2026, `59c3ea1` + `0057` in `94bac87`/`2804b99`)** — koda karşı doğrulandı: `api/dsgvo.js` silindi (Vercel 12→11, `tools/.onprem-baseline` `vercel_fn=11`) · tek box sinyali `api-backend/lib/dagitim.js` `istKutu()`, `server.js:413` (`/api/config`) ve `:685` (Apify) ona bağlandı · `routes/dsgvo.js:100` Fall B kutuda 404 · `dsgvo/klassifikation.js:541` `NUR_SAAS`, `:558` `BUCKETS` · Stripe anahtarı yoksa `dsgvo/loeschen.js:83` **silmeden önce** iptal eder (fail-closed, sessiz atlama yok) · yeni `aufbewahrung_sperre` klasifikasyonda (`:489`) ve `db/REGISTER.md:1148`. **Kalan tek doğrulanmamış nokta:** VPS `.env.calendar`'da `STRIPE_SECRET_KEY` var mı (SSH ister, §8). Yoksa SaaS'ta abonelikli hesabın silinmesi hata verir — veri kaybı yok, fail-closed; ilk VPS dokunuşunda `check-vps-drift.sh` ile birlikte bakılır. 1.-6. ön kontrol şartlarının hepsi karşılandı (5. → O-145, cron tamamen kapatıldı) |

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
| **Durum** | `geplant` (Faz 3.2) — kutudaki **bugünkü** kırık hâli ve ara çözümü **O-106**'da (14.09.2026): `subPortalBtn` kutuda her zaman `/onboarding.html`'a düşüyor, `subUpgradeBtn` ise merkezin **SaaS kayıt** akışına götürüyor |

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
| **Durum** | `unkritisch` (desen doğru) — **05.10.2026 (`b54cb42`, K2b.15/D3-5):** yer artık `server.js:3833-3874`. İki gerçek kusur kapandı: (1) PM2 `-i 2` işi iki kez koşuyordu → yalnız `NODE_APP_INSTANCE` 0 (değişken yoksa tek süreç, koşar); (2) kutu PC'si 23:55'te kapalıysa iş hiç koşmuyordu → açılıştan 30 sn sonra ve her gün değişiminde `date < bugün` + `status='present'` + check-out yok satırlar da `incomplete`. Güncelleme idempotent, kilit gerekmez. Bilinen etki: ilk deploy'da geçmişte açık kalmış bütün `present` satırlar bir kez topluca kapanır (SaaS'ta da) — istenen davranış. Desen hâlâ şablon; O-146 aynı iki kuralı (tek instance + açılışta telafi) almalı |

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
| **Durum** | ✅ **gelöst (12.09.2026, tam kapsam — R0-R12 hepsi dahil, R9'un SaaS host geçişi de tamamlandı)** — bkz. O-41 (smoke-test artık var), O-74, O-75 |

> **11.09.2026 — paket, var olmayan bir etikete işaret ediyor.**
> `onprem/.env.template` `PRAXURA_API_IMAGE=…/calendar-api:stable` diyor; yayın hattı ise
> bugün yalnız `latest` + kısa sha basıyor (`publish-calendar-api.yml:65-66`). **`:stable`
> diye bir etiket yok.** İkinci eksik: şablonda özel registry kimliği için satır yok —
> per-müşteri pull-credential playbook Faz 3.4'ün işi ve `.env.template` ona yer ayırmıyor.
> Sonuç, paketin bugünkü dürüst tarifi: **çalışan bir test yığını, kurulabilir bir ürün
> değil.** Müşteri sunucusunda `docker compose up` bugün image'ı çekemez. Faz 4.3b (kanal
> etiketleri) ve Faz 3.4 (registry kimliği) inmeden ilk kurulum yapılamaz.

> **12.09.2026 — tam kapsam uygulandı, onprem ajanıyla tasarım kilitlendi (R0-R12).**
> Tutanak: `onprem-review`'un kendi cevabı (bu maddenin altına özetlendi, ayrı dosya
> açılmadı — konsey değil, ikili tasarım kilidi).
>
> **R0 (blokaj, önce bulundu, ayrı commit — `f0bd0af`):** `publish-calendar-api.yml`'in
> bundle-smoke-test'i kendi kendini reddediyordu (`manifest.json` kendi adını listeleyemez,
> kontrol bunu arıyordu) — `6347071`'den beri hiçbir `calendar-api` image'ı yayınlanmamış
> olabilir. Ayrıntı: **O-74**.
>
> **R1/R2/R7 — sürüm kaynağı:** kök `VERSION` dosyası (tek satır, `X.Y.Z`) tek kaynak.
> `api-backend/package.json`'daki `1.0.0` **dokunulmadı** — o npm'in kendi alanı, ürün
> sürümü değil. `tools/onprem-manifest.mjs` artık kendi `naechstesPatch()` sayacını
> tutmuyor, `surum`'u doğrudan kök `VERSION`'dan okuyor (VERSION yoksa/biçimsizse hata
> verir). Böylece iki paralel sürüm kavramı riski (bundle'ın kendi sayacı vs. ürünün
> sürümü) yapısal olarak kapandı.
>
> **R3/R4/R5/R6/R6b — iki workflow (`publish-calendar-api.yml`, `publish-frontend.yml`):**
> her ikisi de artık "Sürüm bilgisi" adımıyla açılıyor — `VERSION`'ın içeriğine karşılık
> gelen `v$VERSION` git tag'i **henüz yoksa** bu bir "yayın koşusu" (X.Y.Z de basılır),
> **varsa** yalnız `:beta` + kısa sha (durum ölçülüyor, diff değil — R3: yeniden koşturma/
> `workflow_dispatch`/force-push diff'i yanıltır, durumu yanıltmaz). Yayın koşusunda iki
> mekanik kapı: **R6** (PATCH sürümü `api-backend/db/migrations/` içinde yeni dosya
> taşıyamaz — RELEASE-STANDARD.md §2.2'nin makineleşen tek parçası) ve **R6b** (MAJOR
> sürüm `onprem/manifest.json`'da `durak:true` + dolu `elle_adim[]` taşımak zorunda).
> İkisi de her iki workflow'da aynı (frontend-only bir değişiklik bile aynı `X.Y.Z`'yi
> paylaştığı için aynı kapıdan geçmeli — R5). Etiketler: `latest` (kalıyor, aşağıya bak) ·
> `sha-<kısa>` · `beta` (her koşuda, hareketli) · `X.Y.Z` (yalnız yayın koşusunda,
> değişmez). `org.opencontainers.image.version` etiketi `VERSION`'dan yazılıyor. Yayın
> koşusunda git tag'i **CI kendisi** basıyor (R4) — idempotent: iki workflow paralel aynı
> tag'i basmaya çalışır, hangisi önce biterse; ikincisi "already exists" görüp sessizce
> geçiyor (ilk yazımda bu kontrol `git push | tee` üzerinden pipefail olmadan yanlış
> yazılmıştı — kendi kendini her zaman "başarılı" sanırdı; command-substitution'a
> çevrilerek düzeltildi, elle test edildi).
>
> **R8 — yeni dosya `.github/workflows/promote-stable.yml`:** yalnız `workflow_dispatch`,
> elle tetiklenir. İki girdi: `surum` (X.Y.Z) ve `soak_kanit` (serbest metin — boşsa iş
> reddedilir, "kanıt yok" sessizce geçilemez). 72 saatlik kapı mekanik: `v$surum` tag'inin
> işaret ettiği commit'in tarihiyle şimdiki zaman arasındaki fark ölçülür, 72'den azsa
> reddedilir. **Yeniden build YOK** — `docker buildx imagetools create` ile salt retag;
> yeni build farklı digest üretir ve soak edilen artefaktla yayınlanan artefaktı ayırırdı.
> İki image (api+frontend) **aynı koşuda** taşınır.
>
> **R9 — SaaS host geçişi — ✅ tamamlandı (12.09.2026, kullanıcı onayıyla).** Push sonrası
> CI'ın gerçekten `v0.1.0` git tag'ini bastığı doğrulandı (`git fetch --tags` → `v0.1.0`
> var) ve `docker pull` ile hem `calendar-api` hem `frontend` image'larının `:0.1.0` ve
> `:beta` etiketlerinin **aynı digest**'i gösterdiği ölçüldü. Ardından: (1) host'ta
> `/opt/calendar-api/docker-compose.yml` yedeklendi (`docker-compose.yml.bak-20260912-112144`),
> (2) tek `:latest` satırı `:beta`'ya çevrildi (dosyada başka `:latest` yoktu — kontrol
> edildi), (3) `docker compose config -q` + `pull` + `up -d --force-recreate calendar-api`,
> (4) `docker inspect` → `Config.Image = …calendar-api:beta`, container `healthy`, gerçek
> domainden `https://n8n.infinitymade.de/health` → **200**. Repo'daki
> `api-backend/docker-compose.yml` de aynı satırla güncellendi (drift'i önlemek için —
> 2026-08-15'in dersi). Ancak bundan sonra iki workflow'dan `latest` düşürüldü. Gözlenen
> bir uyumsuzluk: host'taki gerçek dosyanın servis sırası repo kopyasından farklıydı
> (image satırı repo'da 56, host'ta 3) — bu, dosyanın daha önce elle düzenlendiğinin
> kanıtı, davranışı etkilemedi ama repo'nun "host'un aynası" olmadığını bir kez daha
> doğruladı.
>
> **R12 — üç yeni kapı, `tools/check-onprem.sh`:** (1) `VERSION` staged ve `v<değer>`
> zaten bir git tag'iyse → red (sürüm yeniden kullanımı). (2) `VERSION` staged, MAJOR
> artmış, `onprem/manifest.json` `durak:true`+dolu `elle_adim[]` taşımıyorsa → red.
> (3) `onprem/manifest.json` staged ve `surum` ≠ `VERSION` içeriği → red. Üçü de ayrı bir
> scratch clone'da (`git clone` + sahte tag'ler) hem pozitif hem negatif senaryolarla elle
> doğrulandı; ilk denemede test kurulumunda bir hata (eski `onprem-manifest.mjs`'in scratch
> clone'a kopyalanmamış olması) yanlış bir "geçti" sonucu üretmişti — düzeltilip tekrar
> koşturuldu.
>
> **R10/R11 — bu maddenin kapsamı DIŞINDA, dokunulmadı:** `onprem/releases.json`
> (durak/`gerekli_adimlar` geçmiş listesi) ayrı kalır, O-43/Faz 2.9'un işi. R11 yeni bir
> bulgu olarak **O-75** açıldı (aşağıya bak) — J5'in durak-kapısı bugün yalnız hedef
> manifesti görüyor, aradaki durakları hiç göremiyor; `X.Y.Z` var olduğu için artık ifade
> edilebilir ama uygulaması 2.9.
>
> ⚠️ **Henüz gerçek bir yayın koşusu bu kod üzerinden geçmedi** (push edilmeden önce
> yazılıyor) — CI'ın gerçekten yeşil çıkıp `:beta`/`0.1.0` etiketlerini bastığı, `gh`
> olmadığı için `git ls-remote --tags` ve GHCR üzerinden push sonrası doğrulanacak.

### O-26 — Yedekleme zamanlayıcısı repoda yok, VPS'te elle kurulmuş

| Alan | İçerik |
|---|---|
| **Ne** | Gecelik yedek bugün sunucuya elle kurulan bir cron; repo'da ne script'i ne tanımı var |
| **Nerede** | `grep -rl pg_dump --include="*.sh" --include="*.mjs" --include="*.yml"` → **sıfır sonuç**. Kurulum bilgisi `INFRASTRUCTURE.md`'de (gitignore'lu) |
| **Tip** | F |
| **Kutuda ne olur** | Kutu **yedeksiz** kurulur. Müşteri sunucusunda veri kaybı = hasta dokümantasyonu kaybı = bizim değil müşterinin sorumluluğu, ama ürün "yedek yok" diye teslim edilirse satışta ve hukukta savunulamaz. Ayrıca playbook D3'ün uyarısı geçerli: `pg_dump` **storage dosyalarını yedeklemez** — reçete görüntüleri, DTA dosyaları, hasta belgeleri 5 bucket'ta duruyor |
| **Çözüm** | **Faz 2.3** — gecelik `pg_dump` + storage volume arşivi tek yedek seti; hedef Hetzner Storage Box/lokal dizin; 14 gün + 12 ay rotasyon; panelde "son yedek: X" ve başarısızlıkta uyarı; `restore.sh` + gerçekten test edilmiş geri yükleme |
| **Durum** | ✅ **gelöst (12.09.2026) — `restore.sh` yazıldı, gerçek kutuda uçtan uca doğrulandı. Madde artık TAM kapalı, bkz. aşağıdaki 12.09.2026 kapanış notu** |

> **Ne yapıldı:** `onprem/backup.sh` — paylaşılan rutin ("aynı kod, farklı tetikleyici", onprem'in madde 2'si). Adımlar: storage arşivi (`tar`, DB'den ÖNCE — madde 3) → `pg_dump -Fc` → `pg_restore -l` bütünlük testi (O-77'den taşındı) → `backup.meta.json` künyesi (`schema_version`, `app_version`, `image_digest`, `dump_bytes`/`storage_bytes`, `ziel_ausserhalb`, **üç** parmak izi — DEK + JWT_SECRET + POSTGRES_PASSWORD, madde 4 — hiçbiri host'un argv'sine düşmez: DEK `api` konteynerinde node'un `crypto` modülüyle, JWT/PGPW `db` konteynerinde `pgcrypto`'nun `hmac()`'iyle, `psql -f` üzerinden çünkü `-c`/`-tAc`'de `:'var'` ilintileme ÇALIŞMIYOR — gerçek kutuda bulundu) → atomik yazım (`.tmp-*/` → tek `mv`) → ad uzayı ayrılmış rotasyon (`vor-migration-*`: son 3 · `nightly-*`/`manuel-*`: 14 gün + her takvim ayının en eski gecelik yedeği 12 ay — madde 6) → `BACKUP_MAX_GB` kotası (§6.6).
>
> **Hedef (madde 1):** bu turda YALNIZ dizin sürücüsü — `BACKUP_ZIEL` (lokal ya da önceden mount edilmiş NAS/SMB/NFS). onprem'in kendi hükmü: "mount edilmiş NAS gerçekten kutu dışıdır — SSH yalnız konforu artırır." SSH/rsync sürücüsü **ayrı bir madde, kendi O-numarasıyla açılacak** (henüz açılmadı).
>
> **`update.sh` entegrasyonu:** O-77'nin gömülü pg_dump bloğu SİLİNDİ. Schritt 8 artık: (a) bundle'daki migration dosya adları ↔ `praxura_migrations` karşılaştırması (checksum yok, kasıtlı kaba — `migrate.js`'in ikinci bir kopyası değil, her belirsizlikte "bekleyen var" sayılır, bkz. `api-backend/db/migrations/README.md`), (b) bekleyen VARSA `PRAXURA_LOCK_HELD=1 bash backup.sh --sebep vor-migration` (update.sh zaten kilidi tutuyor), (c) yoksa doğrudan `up -d`'ye geç. `install.sh`: yeni Schritt 12 (BACKUP_ZIEL sorusu) + Schritt 16 `praxura-backup.timer`'ı da kuruyor (01:00, `update.timer`'ın 02:00+2h penceresinden ÖNCE, dar jitter, aynı `.praxura-update.lock`'u paylaşıyor — madde 6'nın zamanlayıcı çakışması notuyla aynı gerekçe).
>
> **Doğrulama (WSL2 Ubuntu-24.04, gerçek Docker, gerçek GHCR image'ları):**
> - Gerçek bir `install.sh --neu` koşusu **17/17 adımı tamamladı** — yeni Schritt 12 (BACKUP_ZIEL sorusu, var olmayan yol için doğru uyarı) ve Schritt 16'nın yeni `praxura-backup.timer`'ı (`[ok] praxura-backup.timer aktiv`) dahil.
> - `backup.sh --sebep manuel`, off-box hedefe (`/root/backup-target-fresh`) karşı: storage arşivlendi, DB yedeklendi + doğrulandı, künye doğru yazıldı (`ziel_ausserhalb: true`, üç parmak izi de dolu, `schema_version: "0014"`).
> - **Migration-gate mantığı temiz bir kutuda iki yönde de doğrulandı:** (a) bekleyen migration yokken → `[ok] Bekleyen migration yok — bu gece yedek atlandı`, hiç `backup.sh` çağrılmadı (birden fazla kez tekrarlandı). (b) `0014`'ü elle sildikten sonra (bekleyen migration simülasyonu) → `(bundle: 14 dosya · uygulanan: 13 satır · eksik: 0014)` → `backup.sh --sebep vor-migration` doğru çağrıldı, `vor-migration-*` dizini off-box hedefte oluştu.
> - ⚠️ **Bir test tuzağı, kök sebebiyle birlikte çözüldü (onprem, bildirim-sonrası denetim):** bu tur sırasında, SAATLERCE test edilmiş ESKİ bir kutuda aynı senaryo TUTARSIZ sonuç verdi (bazen 0014 update.sh'tan bağımsız olarak saniyeler içinde yeniden beliriyordu). Kök sebep bulundu: `api-backend/server.js` her süreç açılışında `runMigrations()`'ı çalıştırıyor, `api-backend/Dockerfile` ise `pm2-runtime -i 2` ile **konteyner başına değil, süreç başına** iki işçi koşturuyor. **Herhangi bir** işçinin yeniden başlaması (OOM-kill, çökme, `docker restart`, Watchtower) runner'ı tekrar tetikler ve eksik bir migration'ı sessizce yeniden uygular. Eski kutu saatlerce yük altındaydı ve `api` konteynerinde `mem_limit` yok, VPS'te swap yok (OOM riski zaten ölçülüydü, bkz. §… disk/bellek notları) — temiz, boştaki kutuda yeniden başlayan bir şey olmadığı için anomali hiç görünmedi. **"Bir satırı elle `DELETE` edip bekleyen migration simüle etme" testi, ancak arada HİÇBİR süreç yeniden başlamazsa geçerlidir** — bir dahaki sefere bu not okunmadan "mantık mı yanlış" diye üçüncü kez araştırılmasın.
> - ✅ **Bu denetim ayrıca gerçek bir bug buldu ve kapattı** (aynı gün, commit `88ec23c`): `backup.sh`'ın künyesi `schema_version`'ı dump'tan SONRA okuyordu — yukarıdaki pencerede bir işçi migration uygularsa künye, dump'ın içindekinden bir sürüm **ileri** bir sayı iddia ederdi. Artık dump'tan ÖNCE ve SONRA okunup karşılaştırılıyor; farklıysa yedek "güvenilmez" sayılıp iptal ediliyor.
>
> ⚠️ **12.09.2026'ya kadar kapsam bilinçli dar idi** — `restore.sh` yoktu (§4.5 madde 4, O-29'un tam kapanışı buna bağlıydı). SSH/rsync hedef sürücüsü hâlâ yok (kendi O-numarası bekliyor). O-82 (bildirim kanalı) hâlâ ayrı, açık. Panelde "son yedek: X" göstergesi yok (Faz 2.4).
>
> **`restore.sh` için iki tasarım şartı, onprem'in O-26 bildirim-sonrası denetiminden (13.09.2026):**
> 1. **`praxura_migrations` defteri ve veri, restore'da ATOMİK gelmeli** — biri diğerinden ileri/geri kalırsa (dolu bir veritabanı + eski bir defter, ya da tam tersi), konteyner açılışında `runMigrations()` kimseye sormadan migration uygulamaya (ya da atlamaya) başlar. `backup.sh` zaten `db.dump`'ın İÇİNDE `praxura_migrations` tablosunu taşıyor (tam dump, ayrı tutulmuyor) — `restore.sh` bunu KORUMALI, defteri ayrı bir adımda geri yüklememeli.
> 2. **Künye karşılaştırması konteyner BAŞLAMADAN ÖNCE yapılmalı, sonra değil.** Yeni bir dump (ör. şema 0014) eski bir image'a (ör. yalnız 0011'i bilen) yüklenirse, runner "bekleyen yok" der ve mutlu açılır — kod gelecekten bir şemaya karşı çalışır, sessizce. `restore.sh` geri yüklemeden önce künyedeki `schema_version`'ı hedef image'ın bildiği migration'larla karşılaştırıp uyuşmazlıkta durmalı.
>
> Commit'ler: `903a7a2` (backup.sh + wiring) · `ee84568`→`9a340c6` (migration-check teşhis + temizlik).
>
> ---
>
> ### ✅ Kapanış (12.09.2026) — `restore.sh` yazıldı ve gerçek kutuda doğrulandı
>
> **Tasarım onprem'le önceden onaylandı** (üçüncü konsültasyon): künye kontrolü
> (üç parmak izi) `api`/`db` HENÜZ durdurulmadan, konteynerlerin kendi ortamından
> — DEK uyuşmazlığı **sert DUR** (force yok, çözüm eski DEK'i `.env`'e geri
> koymak) · JWT_SECRET uyuşmazlığı **DUR + `--force`** (Realtime tenant sırrı
> kırılma riski uyarısı) · POSTGRES_PASSWORD uyuşmazlığı yalnız **uyarı**
> (restore sonrası `99-roles.sql` yeniden uygulanınca kendiliğinden düzeliyor).
> Şema-sürümü kapısı `update.sh`'ın **aynı** `docker create` (başlatmadan) +
> migration dosya listesi tekniğini kullanıyor. Onay kelimesi `WIEDERHERSTELLEN`.
> `--von` asla uzak/URL kabul etmiyor (G1).
>
> **Gerçek kutuda test edilirken plan İKİ kez, iki gerçek Postgres bulgusuyla değişti:**
> 1. **`postgres` bu kutuda gerçek superuser DEĞİL, `supabase_admin`.** İlk
>    `pg_restore -U postgres --clean` denemesi "must be owner of event trigger
>    pgrst_drop_watch" ile durdu. Aynı ayrım zaten `api-backend/docker-compose.yml`'in
>    `DATABASE_URL` yorumunda var ("postgres darf fremde Vorgaberechte nicht
>    aendern") — ama `restore.sh` ilk yazımda bunu tekrar keşfetmek zorunda
>    kaldı. `-U supabase_admin`'e geçildi (pg_restore, roller/JWT yeniden
>    uygulama, pg_terminate_backend — hepsi).
> 2. **Supabase Realtime'ın günlük partisyonladığı `realtime.messages_*`
>    tabloları `pg_restore --clean` ile uyumsuz** — miras kısıt (`_pkey`)
>    partisyon çocuğunda tek başına DROP edilemiyor (bilinen bir pg_dump/
>    `--clean` sınırı). Çözüm cerrahi temizlik yerine: mevcut veritabanını
>    **SİLMEDEN yeniden adlandır** (`postgres` → `postgres_onceki_<zaman>`),
>    **boş** bir `postgres` yarat, dump'ı oraya restore et. İki kazanç: (a) hiç
>    `--clean` sürprizi kalmıyor (b) restore YARIDA KALIRSA eski veritabanı
>    kaybolmuyor, adı değişmiş hâlde duruyor — `storage.tar.gz`'nin `.alt-<zaman>`
>    deseniyle aynı mantık, kullanıcı elle `ALTER DATABASE ... RENAME TO` ile
>    geri dönebiliyor. Eski veritabanı restore sonrası da SİLİNMİYOR — admin'e
>    "memnun olunca elle temizle" komutu logda bırakılıyor.
>
> **Doğrulama (WSL2 Ubuntu-24.04, gerçek Docker, gerçek kutu):**
> - **Gerçek nokta-kurtarma senaryosu uçtan uca çalıştı:** test tablosuna bir
>   satır yazıldı → `backup.sh --sebep manuel` ile yedeklendi → yedek SONRASI
>   satır silinip yerine başka bir satır eklendi ("bozulma" simülasyonu) →
>   `restore.sh --von <yedek>` → `WIEDERHERSTELLEN` onayıyla çalıştı → tablo
>   TAM olarak yedek anındaki hâline döndü (bozulma satırı yok, orijinal satır
>   geri geldi) — genuine point-in-time restore kanıtlandı, sadece "dosya var"
>   değil.
> - **İptal yolu güvenli:** yanlış onay kelimesi (`nope`) → `iptal edildi,
>   hiçbir şey değiştirilmedi`, hiçbir servis durdurulmadı, hiçbir veri
>   değişmedi.
> - **DEK uyuşmazlığı — asıl kritik test:** `.env`'e bilerek FARKLI bir
>   `DATA_ENCRYPTION_KEY` konup `api` yeniden yaratıldıktan sonra `restore.sh`
>   çalıştırıldı — **onay istemine hiç ulaşmadan**, künye kontrolünde sert
>   durdu, hiçbir servis dokunulmadı (`docker compose ps` — hepsi hâlâ ayakta,
>   önceki durumdan değişmemiş). Force bayrağı bu kontrolü atlamıyor (kasıtlı).
> - Restore sonrası: `api` sağlıklı, `praxura_migrations` satır sayısı doğru,
>   roller/JWT `99-roles.sql`/`99-jwt.sql` ile yeniden senkronlandı, storage
>   eski hâli `.alt-<zaman>` olarak korunarak değiştirildi.
> - Geçersiz/bulunamayan yedek adı → temiz `exit 1`, açıklayıcı mesaj, hiçbir
>   yan etki.
>
> **Bilinçli bırakılan boşluk:** JWT_SECRET uyuşmazlığında `--force` yolunun
> fiilen kullanılması bu turda test edilmedi (DEK yolu — daha kritik olan —
> test edildi). Şema-sürümü kapısının "yedek image'dan yeni" DUR dalı da bu
> turda tetiklenmedi (mantığı `update.sh`'ın zaten kanıtlanmış tekniğinin
> birebir aynısı, ayrıca doğrulanmadı).
>
> **Bundle/paket:** `restore.sh`, `backup.sh`'ın izlediği yoldan bundle'a
> eklendi — `tools/onprem-manifest.mjs`, `api-backend/Dockerfile` COPY listesi,
> `.github/workflows/publish-calendar-api.yml` smoke test listesi (sayaç
> dinamik kaldı, O-25/R0 dersi tekrarlanmadı), `install.sh`'a `chmod +x`
> satırı (systemd birimi YOK — elle çağrılan bir araç, zamanlanmış değil).
>
> Commit(ler): bu turda, `onprem/restore.sh` (yeni dosya) + yukarıdaki bundle
> dosyaları.

> **onprem'in O-26'ya başlamadan önce onaylanmasını istediği 6 tasarım noktası (12.09.2026, O-77 bildirim turunda):**
> 1. **Hetzner Storage Box'ı koda yazma.** §4.3 onu varsayılan diye adlandırıyor ama bu bizim rahatımıza yazılmış bir varsayım. Kutu-agnostik iki sürücü yeter: **(a) bir dizin yolu** (lokal disk veya müşterinin NAS'ının SMB/NFS mount'u — kod farkı sıfır) ve **(b) rsync/SFTP over SSH** (host+anahtar müşteriden). Storage Box ikisinin de bir örneği olur. Kimlik bilgisi her zaman **müşterinin** (K4/K5), bizim altyapımız hiçbir zaman geçerli hedef değil — **G1 sert veto**, bir "Praxura bulutuna yedek" seçeneği asla gündeme gelmemeli.
> 2. **Paylaşılan rutin, ikinci uygulama değil.** §4.3 "aynı kod, farklı tetikleyici" diyor. `onprem/backup.sh` çıkacak ve `update.sh`'ın bugünkü Schritt 8'i **yeniden yazılıp** onu çağıracak — bugünkü blok genişletilmeyecek, yerini bırakacak.
> 3. **DB'den ÖNCE storage arşivi.** Sıra ters olursa DB satırı henüz var olmayan bir dosyayı gösterebilir (bozuk reçete görüntüsü referansı); doğru sırada en fazla sahipsiz dosya kalır (zararsız).
> 4. **Künye `data_key_fingerprint`'ten ibaret olmasın.** `pg_dump` rol/cluster nesnelerini almaz; geri yükleme `.env`'deki `POSTGRES_PASSWORD`/`JWT_SECRET` ile uyuşmazsa "restore başarılı ama hiçbir şey açılmıyor" hâli çıkar (`volumes/db/jwt.sql` `app.settings.jwt_secret`'i DB seviyesinde set ediyor, dump eski değeri taşıyabilir). `restore.sh` geri yükledikten sonra `roles.sql`+`jwt.sql`'i güncel `.env` değerleriyle yeniden uygulamalı; künye **üç** parmak izi taşımalı (DEK + JWT_SECRET + POSTGRES_PASSWORD), yalnız DEK değil.
> 5. **`_supabase` veritabanı kapsam dışı** (analytics/realtime) — bilinçli, ama künyede/dokümantasyonda yazılsın; yoksa geri yüklemede "eksik" sanılır.
> 6. **Rotasyon çakışması.** Gecelik yedekler ve göç-öncesi yedekler aynı dizine düşerse basit "son N'i tut" kuralı §4.3'ün "göç-öncesi son 3'e asla dokunma" kuralını ezebilir. Ad uzayı ayrılsın (`vor-migration-*` / `nightly-*`), rotasyon iki havuzu ayrı saysın.

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
| **Durum** | ✅ **gelöst (12.09.2026, dört kuraldan dördü tamam)** — (1) ✅ `install.sh:267` her kutu için `openssl rand -hex 32` ile ayrı üretiyor. (2) ✅ **12.09.2026 kapandı** — `install.sh`'ın son adımına (`[17/17]`, DEK gösterimi hemen sonrası) bir `read -r -p` döngüsü eklendi: operatör tam olarak `GESICHERT` yazmadan script ilerlemiyor (yanlış girişte döngü tekrar sorar, script'i İPTAL ETMEZ — kurulum o noktada zaten tamamlanmış durumda, iptal edilecek bir şey yok, sadece onay bekleniyor). İzole test edildi (yanlış girişler + doğru giriş, boş girdi, küçük harf — hepsi doğru reddedildi/kabul edildi). (3) ✅ `backup.sh` künyeye `data_key_fingerprint` yazıyor (O-26). (4) ✅ `restore.sh` künyedeki parmak izini karşılaştırıyor, uyuşmazlıkta veriye HİÇ dokunmadan (servisler bile durdurulmadan) sert duruyor, force bayrağı bu kontrolü ATLAMIYOR (O-26 kapanışı — kasıtlı olarak §4.5'in "açık onayla zorla devam" seçeneğinden bile daha katı: force yok, tek çözüm doğru DEK'i geri koymak). ⚠️ **11.09.2026:** anahtar kutu paketine **hiç girmedi** — ne `.env.template`'te ne compose'da; bu ayrı madde olarak **O-50**'de takip ediliyor |

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

### O-33 — On-prem'de "çalışan sayısı / limit" kavramı tanımsız 🟡 **karar verildi (13.09.2026), uygulama Faz 3.3'te**

| Alan | İçerik |
|---|---|
| **Ne** | Plan farkı (Starter/Professional/Klinik) bugün fiyat sayfasında anlatılıyor ama kodda bir kullanıcı/limit kapısı yok |
| **Nerede** | Aranan: `planLimit`, `PLAN_LIMIT`, `requirePlan`, `hasFeature` → **sıfır sonuç**. Fiyat bilgisi yalnız `api/_lib/pricing.js` (merkez, raporlama için) |
| **Tip** | H |
| **Kutuda ne olur** | Bugün SaaS'ta da limit uygulanmıyor, yani bu bir regresyon değil. Ama on-prem'de sonuç ağırlaşır: müşteri Starter lisansıyla kutuyu kurar, 20 çalışan ekler, kimse görmez — merkezde telemetri yok (G4), denetim yok (K10). Lisans dosyası plan adını taşıyacak ama plan adının **hiçbir teknik karşılığı** yok |
| **Çözüm** | ✅ **Karar (kullanıcı, 13.09.2026): (a) — plan farkı yalnız modül bazlı.** Lisans dosyası hangi modüllerin (§302 faturalandırma, Fahrtenbuch vb.) açık olduğunu taşır; çalışan/kullanıcı sayısı serbesttir, hiç sayılmaz, kutuda bir sayaç/kapı YAZILMAZ. Register'ın kendi önerisiyle aynı yön — en basit, K13'ün "toplam fiyat" mantığıyla uyumlu |
| **Durum** | 🟡 **Karar verildi, uygulama henüz yok** — bugün ne SaaS'ta ne kutuda bir sayaç/kapı mekanizması var, kararla birlikte artık AÇILMAYACAĞI da netleşti (b seçeneği kapandı, tekrar gündeme gelmez). Gerçek kod işi (lisans dosyası formatı + modül listesi okuma) Faz 3.3'ün kapsamı — o faz açılmadan bu maddeye dönülmez |

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
| **Durum** | ✅ **gelöst (12.09.2026)** — 8 seed migration'ı yazıldı ve gerçek Postgres'e karşı test edildi (`api-backend/db/migrations/0006`-`0013`). Ayrıntı aşağıda |

> **12.09.2026 — uygulandı. Tasarım onprem + db-ustasi ile kilitlendi (SEED-1…SEED-11),
> ICD-10-GM'in dağıtım hakkı legal-de ile doğrulandı.**
>
> **Orijinal 9-tablo listesi yanlıştı — ölçülerek düzeltildi:**
> - **Eksikti, eklendi:** `kostentraeger_annahmestellen` (11.409 satır — DTA'nın kime
>   gideceğini belirliyor, yoksa §302 dosya üretimi hiç çalışmaz) · `heilmittel_katalog`
>   (94 satır — `search_heilmittel()`'in tek kaynağı, olmadan **hiçbir** Heilmittel
>   seçilemez; listede yanlışlıkla eskimiş `heilmittel_catalog` (C ile) yazıyordu)
> - **Listedeydi, bilinçli olarak ÇIKARILDI:** `heilmittel_catalog` (C ile, eskimiş,
>   `db/REGISTER.md`: "Status: veraltet, Wer: niemand", abgelöste fiyatları sınırsız
>   geçerli gösteriyor) · `heilmittel_position` (aynı sınıf, okuyan yok)
> - **Ertelendi (bu turda YAZILMADI):** `dta_schluessel` — içeriği doğru ama
>   `source_version` alanı yanlış ("Anlage 3 V22", geçerli sürüm V21) ve tablo hiçbir
>   kod yolundan okunmuyor; yanlış sürüm etiketini checksum-kilitli bir dosyaya
>   gömmek yerine düzeltilmesi bekleniyor
> - **`kostentraeger` artık mock DEĞİL** (CLAUDE.md'deki satır 06.09.2026'dan beri
>   bayattı, düzeltildi) — 1052 satırın 1043'ü gerçek (GKV Kostenträgerdatei,
>   `parser.js`), 9'u mock kalıntı; seed yalnız `datensatz_status='echt'` filtresiyle
>
> **Mekanizma (SEED-1):** ayrı bir seed-runner YOK. Seed dosyaları normal migration'dır
> (`api-backend/db/migrations/0006`-`0013`), aynı `migrate.js` zincirinden geçer —
> `migrate.js`'e tek satır kod eklenmedi. `onprem/SCHEMA-VERTEILUNG.md`'nin önerdiği
> `db/seed/*.sql` yolu **yanlıştı** (Docker build context `./api-backend`, kök `db/`
> image'a giremez) — belge düzeltildi.
>
> **Idempotent upsert (SEED-2/3), checksum kilidi değil:** her dosya
> `INSERT ... ON CONFLICT (<doğal_anahtar>) DO UPDATE`. Gerekçe G7: bu veri SaaS'ta
> **zaten var**, düz `INSERT` orada PK çakışmasıyla patlardı. `DELETE` hiçbir yerde
> yok — `kostentraeger`'ın `ON DELETE CASCADE` zinciri + `prescriptions` FK'si bir
> satırın silinmesini başka tabloları da götüren/patlatan bir işleme çevirirdi.
>
> **Format (SEED-5):** düz çok-satırlı `INSERT`, `COPY FROM stdin` DEĞİL —
> `node-postgres` COPY protokolünü desteklemiyor, `migrate.js` zaten `client.query()`
> ile tek seferde gönderiyor. Escaping **elle yazılmadı**: her dosya Postgres'in kendi
> `format('%L', ...)` fonksiyonuyla üretildi (bkz. `tools/seed-generieren.mjs`) —
> `diagnosegruppen`'in jsonb+regex içeren sütunları elle escape edilseydi sessizce
> bozulabilirdi.
>
> **Doğrulama — gerçek, atılabilir bir Postgres container'ında (12.09.2026):**
> sekiz tablonun **hepsi** ayrı ayrı gerçek şemalarıyla (PK/FK/sequence/identity
> eşleşecek şekilde) kuruldu, seed dosyaları uygulandı, satır sayıları canlıyla
> **birebir** karşılaştırıldı (`kostentraeger` 1043 · `kostentraeger_annahmestellen`
> 11409 · `heilmittel_tarif` 928 · `krankenkassen` 94 · `icd_sector_ranges` 45 ·
> `diagnosegruppen` 57 · `heilmittel_katalog` 94 · `icd10_titles` 16905, 14370'i
> terminal). Hepsi **ikinci kez** uygulanıp satır sayısının değişmediği (idempotent)
> doğrulandı. `diagnosegruppen`'in regex'leri **fonksiyonel olarak** test edildi:
> `DF` kodunun ilk deseni gerçekten `'E10.74' ~ desen` → `true`. En büyük dosya
> (`0013`, ~1,8 MB) `migrate.js`'in **gerçek** çağrı yoluyla (`pg.Client.query()`,
> tek çağrıda BEGIN+INSERT'ler+DO-blok+COMMIT) 346 ms'de sorunsuz uygulandı —
> `migrate.js`'in kendisi hiç değiştirilmedi, yalnız gerçekten çalıştığı doğrulandı.
>
> **`krankenkassen.ik_number` bilinçli olarak NULL (SEED-10):** canlıdaki 16/94 dolu
> değerin hepsi aynı doğrulanmamış kaynaktan, en az 4'ü kanıtlanmış yanlış
> (`db/REGISTER.md`, 06.09.2026 — ör. DAK-Gesundheit satırında HEK'in IK'sı
> duruyordu). Düzeltme ayrı bir migration + `gkv-302` kararı ister, bu maddenin
> kapsamı dışında — ama yanlış veriyi 20 kutuya dağıtmaktansa boş dağıtmak
> tek savunulabilir yoldu.
>
> **ICD-10-GM'in hukuki durumu (`legal-de`, 12.09.2026): dağıtılabilir.** BfArM'ın
> Downloadbedingungen'i (Stand 01.08.2025) bunu açıkça "anderes amtliches Werk"
> (§ 5 Abs. 2 UrhG) diye tanımlıyor — telif koruması yok, ticari dağıtım dahil
> yeniden dağıtım öngörülmüş. İki şart: Änderungsverbot (§ 62 — kod başlıkları
> aynen, uyuldu) ve Quellenangabe (§ 63 — atıf metni migration başlığında + bir
> `NOTICE-QUELLEN.txt` + Dashboard'da tek satır gerekiyor, **henüz eklenmedi, açık
> kalem**). Band 2 (Alphabetisches Verzeichnis) kapsam DIŞI, hiç dokunulmadı.
> Tüm satırlar (terminal + terminal-olmayan/grup başlıkları) dahil edildi —
> `search_diagnosen()` `terminal`'e göre filtrelemiyor, yalnız sıralama ipucu
> olarak kullanıyor.
>
> **Yeni bulgu, ayrı madde adayı (SEED-11):** `heilmittel_katalog`'un besleme
> zinciri kopuk — `billing/codes/*.js` değişip `sync_heilmittel_katalog.js` SaaS'ta
> elle koşturulduğunda, bu seed dosyası **otomatik güncellenmez**. `tools/
> check-onprem.sh`'a bir kapı eklenmesi gerekiyor (kod değişirse aynı commit'te
> yeni seed migration'ı da gelsin) — bu turda **yapılmadı**, açık kalem.
>
> **Açık kalemler:** (1) NOTICE-QUELLEN.txt + Dashboard atıf satırı · (2) SEED-11'in
> kapı kuralı · (3) `dta_schluessel`'in `source_version` düzeltmesi, sonra seed'i ·
> (4) `krankenkassen.ik_number` düzeltmesi (`gkv-302`) · (5) `onprem/.env.template`
> ve `Dockerfile`'ın bu 8 yeni migration dosyasını image'a almak için değişiklik
> GEREKTİRMEDİĞİ doğrulandı — `api-backend/Dockerfile` zaten `COPY db ./db` ile
> tüm `migrations/` klasörünü alıyor.

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
| **Durum** | ✅ **gelöst (12.09.2026)** — (1) 04.09.2026'da yazıldı (aşağıya bak) · (2) O-25'in R1-R8'i ile 12.09.2026'da tamamlandı (`X.Y.Z` + 72 saatlik soak kapısı + `promote-stable.yml`) · (3) bakım modu `update.sh`'ın rollback yoluyla dolaylı sağlanıyor (O-45 (b)); ayrı bir "bakım sayfası" hâlâ yok, ama kutu artık asla crash-loop'a düşmeden eski sürüme dönüyor · (4) kutu `update.sh` + systemd timer ile **gecede bir** güncelleniyor (Watchtower değil, §6.4 12.09.2026 revizyonu — J8), "saatlik Watchtower" fikri kutu için terk edildi, bilinçli olarak daha güvenli bir aralık (gece, tek sefer) seçildi |

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

### O-44 — `prescriptions` iki ayrı yoldan yazılıyor: tarayıcı→PostgREST ve tarayıcı→Express ✅ **gelöst (06.09.2026, sicile 13.09.2026'da işlendi)**

| Alan | İçerik |
|---|---|
| **Ne** | Reçete kaydı iki yoldan doğuyordu: elle maske RLS altında doğrudan PostgREST'e yazıyordu, OCR yolu Express'ten service-role ile yazıyordu |
| **Nerede** | `module/verordnung-an-backend.js` (yeni sınır modülü) · `module/verordnung-maske.js:551-604` (`sendeAnServer`/`schreibeVerordnung`) · `api-backend/server.js:2474` (`POST /api/rezept/confirm`, ANLEGEN) · `:2741` (`PATCH /api/rezept/:id`, DEĞİŞTİRME — Ops #289'da eklendi) |
| **Tip** | G (+ C) |
| **Kutuda ne olur** | Kutu tarafında olumlu: iki ayrı arıza-yüzeyi tek Express çekirdeğine indi, playbook §4.1'in "tek Express çekirdeği" hedefiyle uyumlu. `restart: unless-stopped` + `/health` (O-40) ile karşılanan küçük, tek-makinelik bir risk kaldı — yeni değil |
| **Çözüm** | 06.09.2026'da karar verildi: **Server kazanır.** Getippte Verordnung artık fotoğraflanan ile AYNI yoldan (`sendeAnServer`) geçiyor — aynı Prüfung, aynı Patient-Anlage, aynı Foto-Bağlama. ANLEGEN 06.09.2026'da, DEĞİŞTİRME (PATCH) sonradan Ops #289'da taşındı |
| **Durum** | ✅ **gelöst.** Üç şart da koda gömülü, kod okunarak doğrulandı (13.09.2026): **(1)** yeni taban adresi yok — `dashboard.js:16859` `apiBasis: API` satırında birebir yorum: `// KEINE zweite Adresskonstante (onprem O-44)`. `REZEPT_API` (`dashboard.js:17203`) de artık `API + '/rezept'` — ikinci sabit değil, `API`'nin türevi. **(2)** `server.js:2476` `owner_id: tenantId` (JWT'den, gövdeden değil) + PATCH'te `.eq('id', id).eq('owner_id', tenantId)` + `if (!upd || !upd.length) return 404` (satır ~2879) — kaç satır değişti kanıtı var. Ayrıca `patient_id` her iki yolda da `owner_id` ile çapraz doğrulanıyor (guvenlik S-18). **(3)** `sendeAnServer()`'ın kendi yorumu: "Ein Netzfehler MUSS durchschlagen... (onprem O-44, Auflage 3.)" — ağ hatası/başarısız yanıt `throw` ediyor, sessiz "kaydedildi" yok. Frontend'de `.from('prescriptions').insert(` için grep **sıfır sonuç** — oluşturma yolu tamamen kapandı. Sicil bu kapanışı yakalamamıştı, bu turda düzeltildi |

> ⚠️ **O-01'e ek (kapandı):** `REZEPT_API`'nin `API`'den ayrı ikinci bir sabit olduğu uyarısı
> artık geçersiz — `dashboard.js:17203`'te `const REZEPT_API = API + '/rezept';`, `API`'nin
> türevi, ayrı bir host değil.

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
| **Durum** | 🟡 **kısmen çözüldü** — (a) yapıldı (11.09.2026); ✅ **(b) uygulandı ve gerçek kutuya karşı test edildi (12.09.2026) → §7J**; (c) açık (Faz 2.9) |

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
| **Kutuda ne olur** | Kong yalnız yönlendirmiyor: `key-auth` + `acl` ile **apikey doğruluyor**, `request-transformer` ile Authorization başlığını kuruyor. Ölçüldü: apikey'siz istek **401** alıyor. Ayrıca `request-termination` ile iki ayrı deny kuralı taşıyor (`/realtime/v1/api/tenants` → 403, `/realtime/v1/api/openapi` → 403). Caddy'ye geçilirse yönlendirme ve CORS taşınabilir, ama bu **üçü** taşınamaz — PostgREST/realtime apikey'siz de cevaplamaya başlar. RLS hâlâ korur (asıl savunma odur, anon anahtarı zaten gizli değil), fakat bu **var olan güvenlik kontrollerinin kaldırılmasıdır** |
| **Çözüm** | ✅ **886 MB rakamı yanlış ölçülmüştü — konsey 12.09.2026'da düzeltti.** `KONG_NGINX_WORKER_PROCESSES: auto`, ölçen makinenin (16 çekirdek) her koruna bir NGINX worker açıyordu; hedef 2 vCPU kutuda `auto` zaten 2'ye düşerdi. Sabit `worker_processes=2` ile ölçülen gerçek RSS: **~139–180 MB**. Kong **kalıyor**, Caddy'ye geçiş (B) reddedildi: üç deny kuralının + apikey→Authorization çevirisinin Caddy'de (stock, key-auth eklentisi yok) yeniden kurulması Supabase'in güvenlik modelini fork'lamak demekti — zaten gerçek olmayan bir RAM sorunundan çok daha pahalı |
| **Durum** | ✅ **gelöst (12.09.2026)** — `onprem/docker-compose.yml`'e `KONG_NGINX_WORKER_PROCESSES: "2"` (auto yerine sabit) + `mem_limit: 400m` (önceden yoktu) eklendi. Gerçek kutuya karşı doğrulandı: RSS ~139 MB (400 MB limitinin altında, bolca pay), apikey'siz **401**, apikey'li **200**, `/realtime/v1/api/tenants` **403**, gerçek `signup` **200**. Tam karar: `konsey/tutanak/2026-09-12-o48-kong.md`. ⚠️ **Nachtrag 14.09.2026 (fonksiyon-ustasi, ikinci-göz):** yukarıdaki ve `docker-compose.yml`'deki yorum bloğu "üç/dört deny kuralı, `/pg/` dahil" diyordu — yanlıştı. Kırpılmış `onprem/volumes/api/kong.yml`'de `/pg/` route'u **hiç yok** (pg-meta Studio ile birlikte tamamen çıkarıldı, dosyanın kendi başlık yorumu bunu söylüyor). Gerçek sayı **iki** deny kuralı (yalnız Realtime tenants/openapi). Kararın kendisini etkilemiyor, yalnız gerekçe metni düzeltildi |

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
| **Durum** | ✅ **`gelöst` (12.09.2026, sicil düzeltmesi)** — değişkenler `c602f50`'de girdi, sessizlik kapandı; kalan şart olan anahtar üretimi de `install.sh:264` + `:277`'de zaten inmişti (`DATA_ENCRYPTION_KEY="$(openssl rand -hex 32)"` + `set_env`), sicil geride kalmıştı | |

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
| **Durum** | ℹ️ 01.10.2026 (O-142): auth mailleri kalktığı için kapsam **yalnız hasta/termin/Mahnung maili**; SMTP opsiyonel, kurulumda sorulmaz, teknisyen bağlar. 🟡 `kısmen gelöst` (11.09.2026, O-66 turu) — kod tarafı bitti: altı yer `api-backend/lib/mail.js` → `getMailFrom()`'dan geçiyor, `install.sh` adım 11'de `SMTP_FROM`/`SMTP_ADMIN_EMAIL`'i aynı anda soruyor. SaaS davranışı unit testle doğrulandı (`getMailFrom()` env'siz çağrıldığında eski sabit değeri birebir üretiyor). **Kalan:** kabul ölçütü "alıcı kutusunda ve spam'de değil görülmesi" — bu ancak gerçek bir SMTP sunucusuyla ilk kurulumda ölçülebilir, bugüne kadar yalnız kod + sahte SMTP host'a karşı test edildi (bkz. §7H üçüncü tur). Kapı `absender_fest` 6 → **2** düştü (1 bilinçli fallback + 1 açıklayıcı yorum) |

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

   ⚠️ **Güncelliğini yitirdi (17.09.2026) — O-06 artık `gelöst` (`1935d73`).** Statik
   loader etiketi HTML'den tamamen çıktı, CSP burada artık tek savunma hattı **değil**
   (yukarıdaki üçüncü nokta gibi bir CSP-yan-etkisi yok) — kutuda flag varsayılan kapalı
   olduğu için script hiç eklenmiyor, DNS isteği doğmuyor. Ayrıntı: O-06 girdisi.

### O-52 — `vercel.json` CSP'si kutuya kopyalanamaz (ve kopyalanırsa iki türlü ısırır)

| Alan | İçerik |
|---|---|
| **Ne** | Tek CSP metni `vercel.json`'da sabit; içinde bizim bulut adreslerimiz var, kutunun kendi adresi yok |
| **Nerede** | `vercel.json:19` — `connect-src` içinde bulut Supabase proje adresi (+`wss://`), `n8n.infinitymade.de`, `analytics.infinitymade.de`, `api.stripe.com`, `*.ingest.*.sentry.io`, `accounts.google.com`; `script-src` içinde iki Sentry CDN'i + Stripe + Google + Wistia; `frame-src` içinde Stripe/Google/Wistia/**zygotebody.com** (bkz. O-55). Kapı bu satırı **hiç görmedi**: `tools/check-onprem.sh:71-96` yalnız `*.js` `*.html` `*.mjs` tarıyor, `*.json` kapsamda değil |
| **Tip** | C |
| **Kutuda ne olur** | İki ayrı kırılma. (1) **Kopyalanırsa:** kutu, müşterinin tarayıcısına bizim buluta konuşma izni verir — bugün ölü, ama CSP G1'in ikinci savunma hattıdır; bir gün biri sabit adresi geri koyarsa tarayıcı onu **engellemez**. (2) **`'self'` yetmezse:** `SUPABASE_PUBLIC_URL` sayfa origin'inden farklıysa (farklı port, farklı host adı) login **CSP hatasıyla** ölür; ekranda ağ arızası gibi görünür, teşhisi zordur. Ayrıca Realtime `wss://` şemasını ister — `'self'`'in ws/wss'i kapsaması CSP3'te yazılı ama tarayıcı geçmişi eşit değil, buna güvenmek ölçülmemiş bir varsayımdır |
| **Çözüm** | **Faz 2.1b.** Dört adım, sırayla: **(a) Kutu tek-origin tasarlanır** — Caddy aynı host adı altında hem statik arayüzü hem `/api` → `api` hem `/auth,/rest,/realtime,/storage` → Kong'u verir. O zaman kutunun CSP'si fiilen `default-src 'self'` olur ve bu madde **yapısal olarak** kapanır, yönetilmesi gereken bir liste olmaktan çıkar. **(b) Kaçış yolu env'den, sabit değil** — ayrı origin isteyen kurulum için Caddyfile `connect-src 'self' {$SUPABASE_PUBLIC_URL} {$SUPABASE_PUBLIC_WSS}` yazsın; Caddy dizgi dönüştüremez, `SUPABASE_PUBLIC_WSS` **`install.sh` tarafından** `SUPABASE_PUBLIC_URL`'den türetilip `.env`'e yazılır (Faz 2.1c'ye tek satır). Boşsa `'self'` kalır — boş değişken CSP'yi bozmamalı. **(c) Kutunun listesinden çıkacaklar:** Sentry CDN + ingest (G4, telemetri varsayılan kapalı — açılırsa header **yeniden üretilmeli**, bu da sabit yazmamak için ikinci sebep) · `n8n…` · `analytics…` · `accounts.google.com` (O-08, kutuda kapalı) · Wistia (pazarlama, pakete girmiyor) · `api.stripe.com` (O-19, kutuda dış **link**, `fetch` değil). **(d) Kapıya `*.json` sayacı** — `csp_host`; SaaS'taki bu satır meşru, o yüzden hedef sıfır değil, taban bugünkü sayı ve **artmamalı**. ⛔ Yapılmayacak: `'unsafe-inline'`'ı bu turda temizlemeye kalkmak — inline `onclick` deseni uygulamanın her yerinde, ayrı ve büyük bir iş |
| **Durum** | ✅ **`gelöst` (12.09.2026, sicil düzeltmesi — `install.sh` Schritt 8 `33d5fd2`'de zaten inmişti).** (a) tek-origin tasarımı `onprem/Caddyfile`'da kilitlendi ve ölçüldü · (b) `connect-src 'self' {$SUPABASE_PUBLIC_URL} {$SUPABASE_PUBLIC_WSS}`, `.env.template`'te boş varsayılanla · (c) bulut adreslerinin hiçbiri kutunun CSP'sinde yok (Sentry · n8n · analytics · Google · Wistia · Stripe) · (d) kapıya `csp_host=53` sayacı girdi. **Schritt 8 `SUPABASE_PUBLIC_WSS`'i türetmiyor — bilinçli olarak boş bırakıyor** (`install.sh:304-309`): tek-origin varsayımında `'self'` zaten kendi `wss://`'ini kapsıyor, türetme gereksiz. ⚠️ **Kapanmayan artık, ayrı bir kısıt olarak yazılsın:** bu, "türetildi" değil **"tek origin desteklenir, çok origin desteklenmez"** demektir — müşteri sonradan `.env`'de `SUPABASE_PUBLIC_URL`'i ayrı bir origin'e çevirirse `SUPABASE_PUBLIC_WSS` boş kalır ve Realtime CSP hatasıyla ölür, teşhisi zor. `install.sh` bunu bugün ne engelliyor ne uyarıyor — çok-origin kurulum senaryosu (§7G'nin kapsamadığı) çıkarsa bu köşe yeniden açılır |

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
| **Durum** | ✅ **`gelöst` (12.09.2026, sicil düzeltmesi — Faz 2.2 dilim 1, `e899d7a`/`fdf4658`)** — `DISABLE_SIGNUP` **hiç gevşetilmiyor**. Jeton adım **6**'da, `docker compose up`'tan **önce** üretiliyor ve `api` konteynerine ulaşıyor; adım 14 yalnız gösteriyor, `install.log`'a girmiyor. Jeton artık **tüketiliyor**: `api-backend/setup/router.js:48` okuyor, `:166` `praxura_setup`'ta koşullu `UPDATE ... .is('verbraucht_am', null)` ile işaretliyor (yarış durumu güvenli — `db-ustasi` doğruladı), owner GoTrue'nun admin ucundan (`POST /auth/v1/admin/users`, service-role, `email_confirm:true`) yaratılıyor. Sicil geride kalmıştı, kod zaten inmişti |

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
| **Durum** | ✅ **gelöst (12.09.2026, gerçek Ubuntu 24.04 kutusunda doğrulandı — O-76'nın testi)** — adım 12/13 (`lib-health.sh`) gerçek bir koşuda 8/8 konteyneri doğru saydı ve doğru "gesund" raporladı, aritmetik hatası hiç çıkmadı. ⚠️ Çözümün (3) ve (4) şıkları hâlâ uygulanmadı: `praxura-api` **adıyla** ayrı koşul yok (servis listesinden zaten geliyor) ve `${SITE_URL}/health` eklenmedi (adım 13/14 aynı `--resolve` ile dışarıdan ölçüyor) — bu ikisi eksik ama zarar vermiyor |

### O-64 — `REALTIME_DB_ENC_KEY` 16 karakter olmalı; betik 32 üretiyor

| Alan | İçerik |
|---|---|
| **Ne** | Adım 6 `openssl rand -hex 16` çağırıyor — bu **32 karakterlik** bir dizge üretir. Realtime'ın beklediği anahtar upstream'de 16 karakter (`supabaserealtime`), AES-128 |
| **Nerede** | `onprem/install.sh:194` · `onprem/docker-compose.yml:255` (`DB_ENC_KEY: ${REALTIME_DB_ENC_KEY}`) · upstream varsayılanı `onprem/supabase-docker/docker-compose.yml:315` (`:-supabaserealtime`, 16 karakter) · **çalıştığı ölçülen değer:** yerel test `.env`'inde uzunluk **16** (10./11.09.2026'da yığın bu değerle ayağa kalktı) |
| **Tip** | E |
| **Kutuda ne olur** | Realtime tenant kaydını bu anahtarla şifreliyor; anahtar uzunluğu AES-128'in beklediği 16 bayt değilse şifreleme çağrısı hata verir. Sonuç kurulumun en sinsi biçimi: diğer yedi konteyner sağlıklı, yalnız Realtime kırılır — ve Realtime'ın kırılması "randevu ekranı kendini yenilemiyor" diye görünür, "kurulum bozuk" diye değil. ⚠️ Bu değer **`--neu` olmadan düzeltilemez**: yanlış anahtarla şifrelenmiş tenant satırı veritabanında kalır |
| **Çözüm** | `openssl rand -hex 8` (= 16 karakter) — tek karakter değişikliği. Sonra **gerçekten çalıştırıp** `docker logs praxura-realtime`'a bakmak; bu maddeyi kapatacak olan okuma değil o log. Genel kural: ölçüsü olan alanları rastgele uzunlukta doldurma — `.env.template` §2'ye her sırrın **beklenen uzunluğu** yazılsın (`DATA_ENCRYPTION_KEY` için zaten yazılı, diğer altısı için değil) |
| **Durum** | ✅ **gelöst (12.09.2026, gerçek Ubuntu 24.04 kutusunda doğrulandı)** — `openssl rand -hex 8` (`install.sh:232`), 16 karakter. Maddenin kendi kabul ölçütü artık yerine geldi: `realtime-dev.supabase-realtime` konteyneri gerçek koşuda `healthy` oldu ve `REALTIME_DB_ENC_KEY` uzunluk hatasıyla çökmedi (8/8 konteyner sağlıklı, O-76'nın testi) |

### O-65 — Kurulum betiği kutunun kendi adresini çözemez; kendi doğrulama adımında takılır

| Alan | İçerik |
|---|---|
| **Ne** | Adım 13 `curl "${SITE_URL}/rest/v1/"` çağırıyor. `SITE_URL` tipik olarak `https://praxis.local` — bu ad **hiçbir yerde** tanımlı değildir, kutunun kendisinde de (`hosts` satırını daha yeni yazdırıyoruz, adım 14'te) |
| **Nerede** | `onprem/install.sh:295-296` (adım 13) · varsayılan `onprem/.env.template:110` · kök neden O-59'un aynısı (Caddy Host bazlı eşleştirir, ad çözülmeden istek doğru bloğa girmez) |
| **Tip** | C (+ G) |
| **Kutuda ne olur** | `curl` "could not resolve host" ile döner, betik `000` yakalar ve **"Abgeleiteter Schlüssel wird nicht akzeptiert"** diyerek durur. Yani kurulum, tamamen sağlıklı bir kutuda, yanlış bir teşhisle çöker — ve müşteriye `--neu` ile tekrar denemesini söyler, bu da veritabanını sildirir. Çıkmaz: adım 13'ü geçemeyen kurulum adım 14'e, yani `hosts` talimatının basıldığı yere hiç varamaz |
| **Çözüm** | İstek isme değil, **kutunun kendisine** gitsin, ama Host/SNI doğru kalsın: `curl -sk --resolve "<host>:443:127.0.0.1" "${SITE_URL}/rest/v1/"`. Host adı adım 4'te zaten ayrıştırılmış (`HOST_PART`). Aynı düzeltme `${SITE_URL}/health` kontrolü için de geçerli (O-63). ⚠️ Bunu "`SITE_URL` yerine `localhost` kullanalım" diye çözmek **yanlıştır**: Caddy site bloğu `{$SITE_URL}` Host'una bakar, `localhost` isteği bloğa hiç girmez (O-59) |
| **Durum** | ✅ **gelöst (12.09.2026, gerçek Ubuntu 24.04 kutusunda doğrulandı)** — `curl -sk --resolve "${HOST_PART}:443:127.0.0.1"`. Host/SNI `SITE_URL` kalıyor, istek loopback'e gidiyor; `localhost` tuzağına düşülmedi (O-59). Gerçek koşuda dört `curl` çağrısının hepsi doğru şekilde çözüldü (yalnız hedef yol O-76'da değişti, `--resolve` mekanizması aynen çalıştı) |

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
| 1 | 10 şema sayacı | ✅ **dilim 2b, 12.09.2026** — `db/schema-zaehler.js` + `db/erwartete-zaehler.json`, `migrate.js` içinde ölçülüyor |
| 5 | RLS negatif testi | ✅ **dilim 2b, 12.09.2026** — `setup/pruefungen.js`, gerçek JWT ile, iki-yarımlı test |
| 8 | `DATA_ENCRYPTION_KEY` yaz-oku turu | ✅ **dilim 2b, 12.09.2026** — `phi-encrypt.js`'e `rundlaufTest()`/`keyFingerprint()` eklendi |
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

### Dilim 2b — uygulandı, gerçek kutuya karşı uçtan uca test edildi (12.09.2026 gecesi)

§5.4'ün son üç kontrolü (1: 10 sayaç · 5: RLS negatif testi · 8: DEK rundlaufu) kapandı.
Onprem-konsültasyonuyla tasarlandı (aşağıdaki dört karar onun): sayaçlar `migrate.js`'te,
açık `pg`-bağlantısında, kilit bırakılmadan HEMEN önce bir kez ölçülür — router'ın elindeki
`service_role` istemcisi `pg_catalog`/`auth`/`storage.buckets`/`pg_publication_tables`'ı
göremez, migrate.js zaten görüyor. RLS + DEK kontrolleri ise `/verify`'a `{pruefungen:true}`
bayrağıyla bağlandı — **yeni uç açılmadı** (dilim 2'nin kilidi: "sonraki dilimler alan
ekler"), ve bilinçli olarak `/status`'a değil (jetonsuz uç + oradan dönen sonuç ikisi de
"kutunun krokisi" sınıfına girerdi, aynı gerekçe `0005`'in "şema geçmişi ağda durmasın"
ilkesiyle).

**Yeni dosyalar:** `api-backend/db/schema-zaehler.js` (10 katalog sorgusu + karşılaştırma) ·
`api-backend/db/erwartete-zaehler.json` (beklenen değerler + `bis_version`) ·
`api-backend/setup/selbstpruefung.js` (server.js↔router.js arası küçük tutucu, zirkelimport
önler) · `api-backend/setup/pruefungen.js` (`rlsNegativTest`, `verschluesselungsTest`) ·
`api-backend/lib/phi-encrypt.js`'e `keyFingerprint()` + `rundlaufTest()` eklendi
(`encryptionAvailable()` sadece "değişken var mı" diyordu, 63 haneli bozuk bir anahtarı bile
yeşil geçerdi — gerçek `encrypt→decrypt` turu şart).

**⚠️ Bulgu: "beklenen değerler" SaaS'tan DEĞİL, taze bir on-prem kutusundan alınmalı.**
`db/SCHEMA.sql` başlığı 89 tablo diyor (SaaS canlı sayımı) — ama on-prem paketi bilinçli
olarak 11 tabloyu dışarıda bırakıyor (5 yabancı/boş + 3 merkez + 3'lü B2B zinciri, bu
sicilde zaten satır ~1351'de kayıtlı, YENİ bir bulgu değil, sadece bu turda ilk kez pratik
sonuç doğurdu). Taze kutuda (`wsl` test kutusu, `install.sh` sonrası, `praxura_migrations`
0014'e kadar doğrulandı) gerçek sayım: **78 tablo · 150 policy · 67 fonksiyon · 70 trigger ·
295 index · 1 RLS-kapalı · 1 auth-trigger · 5 bucket · 1 publication-üyesi · 8 extension**.
SaaS sayısını (89 vb.) kullanmış olsaydım her yeni kurulum ilk açılışta kırmızı yanardı —
bozuk olan kutunun kendisi değil, yanlış beklentiydi. `erwartete-zaehler.json` bu yüzden
`bis_version` alanı taşıyor: kutunun defteri bu sürümden ileriyse sonuç kırmızı değil
**gri** ("erwartung veraltet") — ileride yeni migration eklenip beklenti tazelenmeden bir
kutu güncellenirse müşteri "kurulumum bozuk" diye aramaz.

**Onuncu sayaç (extension) onprem-konsültasyonunun önerisiyle geri eklendi** —
`SCHEMA-VERTEILUNG.md` §3.3 ve `RELEASE-STANDARD.md` §5.4/1 "10 sayaç" diyordu ama tabloda
9 satır vardı (12.09'da `icd10_titles` satır sayımı bilinçli çıkarılmıştı, ama metin
düzeltilmemişti). PoC'nin gerçek yarası tam buydu (`DROP SCHEMA public CASCADE` postgis'i
de götürmüştü) — ucuz kontrol, iki belgeyi de tekrar doğru hale getirir.

**RLS negatif testi iki-yarımlı** (onprem'in ısrarı): yalnız "sonuç boş" yeterli değil —
taze kutuda `leads` zaten boş, kırık bir sorgu da `[]` dönerdi. Test hem (a) kendi
`profiles` satırının GÖRÜNÜR olduğunu hem (b) owner'ın satırının GÖRÜNMEZ olduğunu ölçüyor;
gerçek anon-key + gerçek JWT ile (service_role RLS'i atlar, hiçbir şey ölçmezdi). Test
hesabı sabit `@…invalid` alan adında, rastgele şifreli, HER ZAMAN silinir — silme
başarısız olursa (kendi başına) kırmızı, "elle silin" notuyla.

**Gerçek kutuda dört senaryo da ölçüldü:**

| Senaryo | Sonuç |
|---|---|
| Baştan sona sihirbaz (owner yaratıldı, sonra pruefungen:true) | `schema/rls/sifreleme` üçü de **gruen**, `praxura_setup.schritte.billige_pruefungen`'e yazıldı, RLS test hesabı silindi (auth.users'ta iz yok) |
| `DATA_ENCRYPTION_KEY` bozuk (8 haneli, geçersiz hex) ama SET | `sifreleme: kirmizi`, "must be 64 hex chars" — `encryptionAvailable()` bunu yeşil geçerdi, `rundlaufTest()` yakaladı |
| Şemaya elle bir tablo eklendi (RLS'siz) | `schema: kirmizi`, hem `public_tablo` hem `rls_kapali_tablo` sapması tek satırda raporlandı; `migrate.js` başlangıç logunda da `warn` düştü |
| Temizlik sonrası tekrar `abschluss` | `abgeschlossen:true`, `verfuegbar:false` — sihirbaz normal bitirdi |

**Kapanış butonu tasarımı (Dilim-2 kilidine sadık):** üç kontrolden biri kırmızıysa
`setup.js` "Ich möchte trotzdem abschließen" onay kutusunu gösterir, buton onaysız devre
dışı — ama **hiçbir kontrol `abschluss`'u mekanik olarak bloklamıyor** (K10: içeri girip
açma yolumuz yok). "gri" (ölçülemedi/beklenti bayat) hiçbir zaman engel değil.

**Açık bırakılan:** RLS'in gerçekten kırık olduğu (bir policy'nin silindiği) senaryo canlı
test edilmedi — üretim RLS'ini test amacıyla kapatmak riski kazancından büyüktü, mantık
kod incelemesiyle doğrulandı (aynı iki-yarımlı desen restore.sh'ın parmak-izi mantığıyla
aynı). "Veraltet" (gri, `bis_version` aşımı) yolu da canlı tetiklenmedi, yalnız kod okuması.

**Bu bölümün post-hoc denetimi (aynı gece, onprem-audit) beş yeni madde çıkardı:**
O-90 (bakım kapısı yok) · O-91 (SaaS drift riski) · O-92 (`schritte` replace-not-merge) ·
O-93 (iki ölçüm boşluğu) · O-94 (kontroller kurulumdan sonra hiç koşmuyor). Üçü (O-90/
O-92/O-93) aynı turda kapatıldı, ikisi (O-91/O-94) Faz 2.4'e bırakıldı — hepsi aşağıda.

### O-90 — `erwartete-zaehler.json` tazelenmezse §5.4/1 sessizce griye düşer ✅ **gelöst**

Onprem-audit'in en ciddi bulgusu (dilim 2b'nin post-hoc incelemesi, 12.09.2026 gecesi):
yeni bir migration tablo/policy/index sayısını değiştirdiğinde bu dosya tazelenmezse
sonuç **kırmızı değil gri** olur ("erwartung veraltet") — yani kontrol sessizce söner,
tam da playbook'un ilk dersinin (kural yazılıydı, kimse yorumu okumadan yeni kod
eklemişti) aynısı. Çözüm mekanik: `tools/check-onprem.sh`'a yeni bir kapı — yeni bir
migration dosyası eklendiyse, `erwartete-zaehler.json`'ın `bis_version`'ı o dosyanın
sürüm numarasına eşit olmak ZORUNDA, aksi hâlde commit reddedilir
(`SKIP_ZAEHLER_GATE=1` bilinçli istisna). Sayıları kapı doğrulayamaz (yalnız gerçek
bir kutuda ölçülür), ama tazelemeyi unutmayı imkânsız hâle getirir.

### O-91 — Sayaç beklentisi tek dağıtıma göre yazıldı; SaaS `DATABASE_URL` set ederse kalıcı alarm 🟡 **geplant (Faz 2.4)**

`erwartete-zaehler.json` on-prem'in 78 tablosuna göre yazıldı, SaaS'ın 89'una göre
DEĞİL (bilinçli — bkz. yukarıdaki "Dilim 2b" bölümü). Bugün zararsız çünkü SaaS'ta
`DATABASE_URL` set edilmemiş (`server.js:4530` yorumu), runner sayaçları hiç
çalıştırmıyor. Ama zincirin asıl amacı SaaS'ın da aynı runner'ı koşması (G7) — o gün
her restart'ta `console.warn` + kalıcı `abweichung` yanar, birkaç hafta sonra kimse
bakmaz olur (alarm yorgunluğu). Çözüm: dağıtım tipine göre iki beklenti bloğu (ya da
bir `PRAXURA_DEPLOYMENT` işaretiyle SaaS'ta sabit `gri`) — fork yok, tek dosyada iki
blok. Faz 2.4'ün (self-check + panel) doğal parçası, şimdi acil değil.

### O-92 — `praxura_setup.schritte` merge değil replace ediliyordu ✅ **gelöst**

`/verify`'ın `pruefungen:true` dalı `schritte`'yi doğrudan `{billige_pruefungen:...}`
ile eziyordu — yorum "sadece bu alanı mergeliyor" diyordu ama PostgREST'te jsonb
merge yok, bir `UPDATE` sütunun tamamını değiştirir. Bugün zararsız (tek yazar), ama
dilim 3 SMTP sonucunu aynı sütuna yazınca sessizce silinirdi. Düzeltme: read-modify-
write (`select schritte` → JS'te yay → `update`) — `api-backend/setup/router.js`.
Gerçek kutuda doğrulandı: `schritte`'ye elle konan alakasız bir anahtar (`
future_dilim3_test`), `billige_pruefungen` yeniden yazıldıktan sonra da yerinde kaldı.

### O-93 — Dilim 2b'nin iki ölçüm boşluğu ✅ **gelöst**

(a) RLS negatif testi `owner_user_id` NULL ise ikinci yarıyı (owner'ın satırı
GÖRÜNMEZ) hiç ölçmeden sessizce yeşil dönüyordu (`!ownerUserId || ...` kısa devresi)
— iki-yarımlı tasarımın var oluş sebebi tam bu deliği kapatmaktı. Artık `owner_user_id`
yoksa sonuç `atlandi` (gri), asla sessiz yeşil değil.
(b) `rls_kapali_tablo` sayı olarak tutuluyordu; bir migration X tablosunun RLS'ini
açıp Y'ninkini kapatsa sayaç yine aynı sayıyı verir ve **yeşil kalırdı** — tam
yakalaması gereken şeyi kaçırırdı. `rls_kapali_tablolar` (isim listesi, küme farkı)
oldu. Gerçek kutuda doğrulandı: `spatial_ref_sys`'i RLS'e aldım, `warteliste`'nin
RLS'ini kapattım (sayı sabit 1 kaldı) — sayaç doğru şekilde `kirmizi` yandı
(`soll:["spatial_ref_sys"] ist:["warteliste"]`).

### O-94 — §5.4/5 ve /8 yalnız kurulumda bir kez koşuyor; sonrasında hiçbir panel yok 🟡 **geplant (Faz 2.4)**

DEK parmak izi (`keyFingerprint()`) ve RLS negatif testi bugün yalnız sihirbaz
ekranında görünüyor — kurulum bitince bir daha hiç çalışmıyor/gösterilmiyor. O-29'un
asıl senaryosu (müşteri yanlış anahtarla yedekten döner) tam olarak kurulumdan SONRA
olur; sihirbaz o an çalışmıyor. Aynı şekilde bir yükseltme bir RLS policy'sini bozarsa
kimse görmez (şema sayacı her açılışta koşuyor, bu ikisi koşmuyor). Çözüm Faz 2.4'ün
(self-check + sürüm künyesi paneli) işi — orada randevu-düzeyi bir RLS negatif testi
de eklenebilir (taze kutuda `bookings` boş, orada ölçmek daha az müdahaleci).

### O-95 — `preise-check.yml`'in otomatik commit'i seed-besleme kapısını (O-79) hiç görmüyor ✅ **gelöst (13.09.2026)**

| Alan | İçerik |
|---|---|
| **Ne** | `.github/workflows/preise-check.yml` (Ops-Karte #213) günlük cron'la `billing/codes/{podologie,physio}_positions.js`'i otomatik günceleyip commit+push ediyor — çıplak bir CI checkout'ta, `.githooks` hiç konfigüre edilmeden. O-79'un pre-commit kapısı (`tools/check-onprem.sh`) bu commit'i hiç görmüyordu |
| **Nerede** | `.github/workflows/preise-check.yml` (yeni "Seed-Migration für die Box mitschreiben" adımı) · `api-backend/sync_heilmittel_katalog.js` (yeni `--sql` modu) |
| **Tip** | B + D |
| **Kutuda ne olur** | Düşük etkiliydi zaten (`heilmittel_katalog` §302 tutarını üretmiyor, yalnız seçici/rozet metni), ama artık hiç sapma yok — CI'nın kendi commit'i artık seed migration'ı da taşıyor |
| **Çözüm** | `sync_heilmittel_katalog.js`'e DB'siz çalışan bir `--sql` modu eklendi (`physioRows()`/`podoRows()`'u kullanır, `0012_seed_heilmittel_katalog.sql` ile AYNI çıktıyı üretir — ikinci bir üretim yolu değil, ikinci bir çıkış). CI'nın "Commit + Push"'tan hemen önceki yeni adımı bu modu çağırıp bir sonraki migration numarasıyla (`NNNN_seed_heilmittel_katalog_preisrunde_<tarih>.sql`) dosyaya yazıyor, `db/erwartete-zaehler.json`'ın `bis_version`'ını da mitzieht (saf veri-UPSERT olduğu için yapısal sayaçlar değişmiyor — güvenle otomatik) |
| **Durum** | ✅ **gelöst.** `node sync_heilmittel_katalog.js --sql` çıktısı 0012 migration'ıyla satır satır karşılaştırıldı: 94/94 satır aynı kimlik, yalnız 2 satırda (78040'ın iki fiyat penceresi) `notiz` metni farklı çıktı — 0012'nin kendisi bayatmış (kod daha kesin bir hukuki atıfla güncellenmiş). Bu sapma da aynı turda `0015_update_heilmittel_katalog_notiz.sql` ile düzeltildi (--sql'in ürettiği TAM çıktı, 92 satır zaten aynıydı). CI adımı izole bash simülasyonuyla test edildi (doğru sıradaki migration numarasını buluyor, doğru dosyayı yazıyor, `bis_version`'ı doğru güncelliyor). 231/231 test + `tools/check-onprem.sh` yeşil |

### O-96 — `heilmittel_tarif` (elle beslenen, süresiz) §302 tutarını katalog fiyatının ÖNÜNE geçiriyordu ✅ **gelöst (13.09.2026)**

| Alan | İçerik |
|---|---|
| **Ne** | O-79/O-95 araştırılırken bulundu: `resolvePreis()` fiyatı ÖNCE `heilmittel_tarif`'te arıyordu (`resolver.js:81-86`, `quelle='heilmittel_tarif'`), varsa katalog/pozisyon fiyatının yerine onu kullanıyordu. Tablo `0008_seed_heilmittel_tarif.sql` (928 satır, 16 Bundesland × physio pozisyonu) ile açılmıştı, beslemesi `api-backend/seed_tarifs.js` — aynı `PHYSIO_POSITIONS`'tan ama **elle**, `gueltig_bis = NULL` (süresiz) |
| **Nerede** | `api-backend/billing/preise/resolver.js` · `api-backend/seed_tarifs.js` (→ `archive/kod/`) · `api-backend/db/migrations/0008_seed_heilmittel_tarif.sql` · eski okuma: `abrechnung.routes.js` (3 yer) |
| **Tip** | D + G |
| **Kutuda ne olur** | Kutuya özgü değildi — **SaaS'ta da** geçerliydi. `gkv-302` doğruladı (canlı DB sorgusu): bugün 928 satırın **0'ı** katalogdan sapıyordu (16 Bundesland'a hep aynı fiyat yazılmış, gerçek regionalizasyon hiç yoktu — Anlage 2 §125 Physio zaten bundeseinheitlich, Bundesland ekseni fiilen yok) ve `seed_tarifs.js` 26.05.2026'dan beri hiç çalışmamıştı. Yani bugün 0€ hasar, ama bir sonraki gerçek Physio fiyat penceresinde (en erken 01.01.2027, Anlage 2 Teil B kündigung hükümleri) donmuş 2026 fiyatı sessizce DÜŞÜK fatura üretecekti — kasa reddetmez, sessiz eksik ödeme, VKZ 02 Nachforderung'la ancak geriye dönük düzeltilebilir |
| **Çözüm** | (a) seçildi — `heilmittel_tarif` tamamen kaldırıldı, resolver yalnız katalog/pozisyon fiyatına düştü (Bundesland ayrımı zaten gerçek değildi, kayıp yok) |
| **Durum** | ✅ **gelöst (13.09.2026)** — `resolver.js`'ten override mantığı, `abrechnung.routes.js`'ten üç okuma noktası + `bundeslandDerPraxis()`/`bundeslandFehler()` gate'i kaldırıldı; `seed_tarifs.js` `archive/kod/`'a taşındı; `preise_autoupdate.mjs`'in Physio `autoWrite`'ı artık güvenle `true` (Ops-Karte #213 physio'yu da kapsıyor). `db-ustasi`: `db/REGISTER.md` kaydı `veraltet` işaretlendi, harita tazelendi. Tüm testler yeşil (231/231, `resolver.test.js`/`legs.test.js`/`plz-bundesland.test.js`/`preise_autoupdate.test.js` güncellendi). Tablonun kendisi (DROP) bilinçli olarak **ayrı bırakıldı** — `db-ustasi`'nin tavsiyesi: aciliyet yok (hasta verisi/trigger/view/gelen-FK yok), diğer üç ölü referans tablosuyla (`heilmittel_catalog`, `heilmittel_position`, `dta_schluessel`) birlikte tek bir temizlik migration'ında, `onprem` ile ortak karar. `wissensbank/SPEC-RULES.md`'ye kural eklendi: "Physio-Vergütung bundeseinheitlich" |

### O-97 — §302 fiyatı 4 basılı belge yolunda Ausstellungsdatum'a göre çözülüyordu, Leistungsdatum'a göre değil ✅ **gelöst (13.09.2026)**

| Alan | İçerik |
|---|---|
| **Ne** | `gkv-302`'nin O-96 ikinci-göz turunda bulundu: DTA yolu (`mapPrescriptionToDtaShape`, `mapVerordnungToDtaShape`) `resolvePreis()`'i her seans için KENDİ `done_at`'iyle çağırıyordu — doğru. Ama basılı Zuzahlungsrechnung, rzg-Quittung, `rechnung_privat`/`selbstzahler`/`sonder`/`bg` çıktıları, Begleitzettel (physio) ve Zuzahlung-Korrektur (`betragFuerEinheiten()`) tek bir `resolvePreis()` çağrısını `rx.ausstellungsdatum` (Verordnung'un yazıldığı tarih) ile yapıp o TEK fiyatı tüm seanslara uyguluyordu |
| **Nerede** | `api-backend/billing/api/abrechnung.routes.js` (Zuzahlungsrechnung-print, `/prescription/:id/rechnung`, physio-Begleitzettel `belege`-map) · `api-backend/billing/api/zuzahlung.routes.js` (`betragFuerEinheiten()`) |
| **Tip** | D |
| **Kutuda ne olur** | Kutuya özgü değil — SaaS'ta da geçerli, kutuya aynen taşınır. Anlage 2 Podologie § 3 Abs. 2 ve Anlage 2 §125 Physio Teil A: fiyat, tedavinin **yapıldığı** tarihe göre belirlenir. Bir Verordnung iki Preisfenster'e yayılan seanslar içerdiğinde (ör. 30.06.2026'dan önce yazılmış, Temmuz'da uygulanmış podoloji Verordnung'u — bugün canlı) DTA ile basılı fatura FARKLI tutar üretiyordu. Physio'da bugüne kadar tek pencere olduğu için etkisi sıfırdı, ama 01.01.2027'de ikinci physio penceresi açılınca O-96'nın kapattığı "iki yol farklı tutar veriyor" deliği başka bir kapıdan geri gelecekti |
| **Çözüm** | Her 4 yol da artık `prescription_sessions`'ı (gerekirse sorguya eklendi: `zuzahlung.routes.js`'in Korrektur sorgusu) okuyup HER seansı kendi `done_at`'i ile ayrı `resolvePreis()` çağrısından geçiriyor; physio-Begleitzettel podoloji-Begleitzettel'in zaten doğru yaptığı deseni (`prescriptions[i].sessions`'tan toplama) izliyor |
| **Durum** | ✅ **gelöst (13.09.2026)** — 4 çağrı sitesi düzeltildi, `wissensbank/SPEC-RULES.md`'ye kural eklendi ("Heilmittel fiyatı Leistungsdatum'a göre çözülür"), 231/231 test yeşil. `betragFuerEinheiten()`'in Korrektur senaryosu (`neue_einheiten` verordnete'den küçük olabilir) için: ilk N erbrachte Sitzung (tarihe göre sıralı) kendi tarihini taşır, sitzung verisi yoksa eskisi gibi Ausstellungsdatum'a düşer |

### O-98 — CI'nın otomatik migration commit'i ile bir insanın migration commit'i aynı numarayı seçebilirdi ✅ **gelöst (13.09.2026)**

| Alan | İçerik |
|---|---|
| **Ne** | `onprem`'in O-95/O-96 ikinci-göz turunda bulundu: `preise-check.yml`, sıradaki migration numarasını checkout ANINDAKİ dosyalardan hesaplıyordu, ama `git pull --rebase origin main` bundan SONRA geliyordu. Aynı gün bir insan da migration eklerse (O-96 ile physio `autoWrite` açıldığı için bot artık HER GÜN commit atma ihtimali taşıyor), rebase dosya adları farklı olduğu için çakışma göstermez — iki farklı `0016_*.sql` sessizce oluşabilirdi |
| **Nerede** | `.github/workflows/preise-check.yml` |
| **Tip** | B |
| **Kutuda ne olur** | Mükerrer versiyon numarası `api-backend/db/migrate.js`'in `pruefeVersionen()`'ında SERT hata olarak yakalanır (`art: 'reihenfolge'`) — ama ancak kutu açılışında, kapı bunu göremez (yerel pre-commit hook, CI'da hiç koşmuyor). Sonuç: yeni kurulan HER müşteri kutusu, mükerrer numara commit'ten sonra açılırsa, migration runner hatasıyla `/health` bakım moduna düşerdi |
| **Çözüm** | İş akışı ikiye bölündü (bkz. O-99): migrasyon numarası artık `git pull --rebase`'DEN SONRA, push'tan hemen önce hesaplanıyor; push başarısız olursa (gerçek bir yarış oldu demektir) `git reset --hard` ile tamamen temizlenip numara yeniden hesaplanıyor ve en fazla 5 kez yeniden denenıyor |
| **Durum** | ✅ **gelöst (13.09.2026)** — yeni `commit-und-push` job'ı, lokal bash simülasyonuyla doğrulandı (bir "insan migration'ı" senaryosu taklit edilip yeniden hesaplamanın doğru boş numarayı bulduğu ölçüldü) |

### O-99 — CI botunun `contents: write` yetkisi `npm ci`'nin çalıştırdığı bağımlılık koduna kadar yayılıyordu ✅ **gelöst (13.09.2026)**

| Alan | İçerik |
|---|---|
| **Ne** | `guvenlik`'in ikinci-göz turunda bulundu: `preise-check.yml` tek bir job'da hem `npm ci` (lifecycle-skriptleri açık) hem de `git push` (workflow-seviyesinde `contents: write`) çalıştırıyordu, `actions/checkout`'ta `persist-credentials: false` yoktu. Bağımlılık ağacındaki (transitif dahil) herhangi bir paketin kötü niyetli bir install-skripti, iş boyunca kalıcı olan push token'ını okuyup doğrudan `main`'e yazabilirdi — ve `main` bitiş noktası değil: `publish-calendar-api.yml` onu image'a çevirir, Watchtower 60 saniyede canlıya alır, migration zinciriyle her müşteri kutusuna gider |
| **Nerede** | `.github/workflows/preise-check.yml` · `api-backend/preise_autoupdate.mjs` (yan bulgu: XML'den gelen tarih hiç doğrulanmadan JS string'ine enjekte ediliyordu) |
| **Tip** | B + G |
| **Kutuda ne olur** | Tedarik-zinciri sınıfı, kutuya dolaylı yoldan ulaşır (yukarıdaki zincir üzerinden) — doğrudan bir kutu değişkeni değil |
| **Çözüm** | İş akışı iki job'a bölündü: `preise-check` (SADECE `contents: read` + `actions: write`, `npm ci --ignore-scripts`, `persist-credentials: false`) test eder ve değişen dosyaları artifact olarak yükler; `commit-und-push` (SADECE `contents: write` + `actions: read`, **`npm ci` YOK**) artifact'i indirip commit+push yapar — yazma yetkisi olan job hiçbir üçüncü-parti kodu çalıştırmıyor (`sync_heilmittel_katalog.js --sql` yalnız kendi Codedateien'i import ediyor, bağımlılık yok). Ayrıca `preise_autoupdate.mjs`'e iki emniyet supapı eklendi: XML'den gelen tarih `JJJJ-AA-GG` formatına uymuyorsa red, ve bilinen bir kodda %15'ten büyük fiyat sıçraması otomatik yazmayı durdurup insana bırakıyor |
| **Durum** | ✅ **gelöst (13.09.2026)** — YAML `js-yaml` ile ayrıştırma-doğrulandı, iki job'un izin kapsamları (`actions: read/write` dahil — GitHub'da bir `permissions` bloğu tanımlanınca listelenmeyen her scope `none` olur, bu tuzağa düşülmedi) tek tek kontrol edildi. `preise_autoupdate.mjs`'e 2 yeni test eklendi (Preissprung >15%, kaputtes Datumsformat), 235/235 (bu dosyanın kendi sayacıyla) yeşil |

### O-100 — `.praxura-stand/` (owner e-postası + `.env` anlık görüntüleri) umask'tan `0755` miras alıyordu ✅ **gelöst (13.09.2026)**

| Alan | İçerik |
|---|---|
| **Ne** | `guvenlik`'in O-82 ikinci-göz turunda bulundu: `install.sh`/`update.sh`'taki `mkdir -p "$STAND_DIR"`/`mkdir -p "$SNAPSHOT_DIR"` çağrılarının hiçbirinde `chmod` yoktu → umask 022'de dizin `0755` (herkes okuyabilir/listeleyebilir). Bu dizinde `owner-bilgi.json` (owner e-postası + praksis adı, O-82) VE her update denemesinde bir `.env` anlık görüntüsü (POSTGRES_PASSWORD, SERVICE_ROLE_KEY, JWT_SECRET, DATA_ENCRYPTION_KEY, SMTP_PASS düz metin) duruyor |
| **Nerede** | `onprem/install.sh` (`.praxura-stand` ilk oluşturma) · `onprem/update.sh` (`$STAND_DIR`, `$SNAPSHOT_DIR`, `.env` kopyası) |
| **Tip** | G |
| **Kutuda ne olur** | Ağdan/container'dan yol yok (compose'da mount edilmemiş, `guvenlik` ölçtü) — risk yalnız praksis sunucusundaki İKİNCİ bir yerel hesaptan (praksis IT'si, uzak bakım hesabı, aynı makinedeki başka bir servis) gelir. `backup.sh` kendi hedef dizinlerinde zaten `chmod 700` kullanıyor — aynı standart burada eksikti |
| **Çözüm** | `install.sh`'ın ilk `mkdir -p "$SCRIPT_DIR/.praxura-stand"`'ına ve `update.sh`'ın hem `$STAND_DIR` hem her yeni `$SNAPSHOT_DIR`'ına `chmod 700`; `.env` anlık görüntüsüne ayrıca `chmod 600` |
| **Durum** | ✅ **gelöst (13.09.2026)** — 3 nokta düzeltildi (`install.sh` 1, `update.sh` 2), `bash -n` ile sözdizimi doğrulandı, `onprem/manifest.json` tazelendi |

### O-101 — Zuzahlungskennzeichen ters yazılıyordu ('0' yerine '3' gerekiyordu) + DTA'da U18 muafiyeti eksikti ✅ **gelöst (14.09.2026)**

| Alan | İçerik |
|---|---|
| **Ne** | Kullanıcı isteğiyle 13.09.2026 gecesi çalışılan O-97'nin ikinci konsey turunda `gkv-302` bağımsızca buldu: Anlage 3 TP5 §8.1.3 `Zuzahlungskennzeichen` şöyle tanımlar — `0`=keine gesetzliche Zuzahlung, `1`=Zuzahlungsbefreit, `3`=Zuzahlungspflichtig. Kod normal (zuzahlungspflichtig) hastaya `'0'` yazıyordu — hem yanlış rechtsbegriff hem DTA dosyasının kendisiyle çelişmesi (Zuzahlung tutarı dolu, kennzeichen "yok" diyor). Aynı turda `fonksiyon-ustasi` bağımsız ikinci bir boşluk buldu: DTA mapper'lar (physio + podoloji) yalnız elle işaretlenen `zuzahlung_befreit`'i kontrol ediyordu, **yaş bazlı U18 muafiyeti hiç yoktu** (`calcAbrechnungsfallZuzahlung()`'un `isUnter18()`'i yalnız basılı yollarda çağrılıyordu) — aynı reçete DTA'da ve kağıtta farklı Zuzahlung üretebilirdi. Üçüncü, küçük bulgu: `doneSessions[doneSessions.length-1].done_at` (behandlungsende/U18 referans tarihi için) sıralanmamış diziden alınıyordu — kronolojik son değil, DB'den son okunan satır |
| **Nerede** | `api-backend/billing/api/abrechnung.routes.js` (2 DTA mapper + 3 dahili toplam hesaplayıcı + 2 print route), `api-backend/billing/dta/builder.js` (`calcAbrechnungsfallTotals`), `api-backend/billing/dta/preflight.js` (plausibilite kontrolü), `api-backend/billing/utils/abrechnung-zeilen.js` (`betraegeFuerVerordnung`) — toplam **5 bağımsız kopya** aynı `zuzahlungskennzeichen === '0'` kontrolünü taşıyordu |
| **Tip** | D |
| **Kutuda ne olur** | Kutuya özgü değil — SaaS'ta da aynen geçerli, kutuya birebir taşınır. Etki iki eksende: (1) her normal hastanın DTA dosyasında yanlış kennzeichen karakteri (kasa Prüfstufe 3/4'te reddedebilir veya Zuzahlung'u yanlış yorumlayabilir) — bugün canlı; (2) minör bir hastanın (18 yaş altı) `zuzahlung_befreit` elle işaretlenmediği her durumda DTA'da yanlışlıkla Zuzahlung hesaplanması — sessiz, nadir (çoğu minör kaydı muhtemelen elle işaretleniyor ama garanti değil) |
| **Çözüm** | 5 kopyanın hepsinde `==='0'` → `==='3'` (ve üretici tarafında `'1':'0'` → `'1':'3'`), DTA mapper'lara `isUnter18(lead?.geburtsdatum, <son seans/behandlung tarihi>)` eklendi, `doneSessions`/`behandlungen` referans-tarih hesapları sıralamalı hale getirildi. Golden-dosya testleri (`gesamtrechnung.test.js` T8 physio/podo, T1) gerçek builder çıktısına karşı **yeniden üretildi** (fixture'lardaki `zuzahlungskennzeichen` de aynı gerekçeyle düzeltildi — `fixtures.js` başlığında gerekçe kayıtlı) |
| **Durum** | ✅ **gelöst (14.09.2026)** — spec metni (`wissensbank/gemeinsam/302-tp5/Anlage_3_TP5_V21_20250919.txt:357-372`) doğrudan okunarak doğrulandı. 231/231 test yeşil (golden-dosyalar bilinçli, gerekçeli olarak yeniden üretildi — `physio.edi` yalnız 1 karakter değişti, tutar aynı kaldı; `podo.edi`'nin tutarları değişti çünkü fixture zaten doğru `'3'` taşıyordu ama eski kontrol hiç eşleşmiyordu, yani bu fixture'ın testi o güne kadar Zuzahlung'u hiç hesaplamıyordu). `wissensbank/SPEC-RULES.md`'ye kayıt düşülmedi — bu kural zaten Anlage 3'ün kendi tablosu, ayrı süzülmüş kural gerektirmiyor. **Ek düzeltme (aynı gün):** `gkv-302`'nin ayrıca işaret ettiği `positionFrei`'nin "ilk seanstan al, tüm Verordnung'a uygula" kısayolu da düzeltildi — bir pozisyon iki Preisfenster arasında zuzahlungsfrei durumunu değiştirirse (nadir ama mümkün) artık her seans kendi `position_frei`'sini taşıyor, ilk seansınkini değil (`abrechnung.routes.js`, Zuzahlungsrechnung + rzg-Quittung yolları) |

### O-102 — CI botunun push'u `publish-calendar-api.yml`'i hiç tetiklemiyordu — otomatik fiyat güncellemesi asla canlıya çıkmamış olabilirdi ✅ **gelöst (14.09.2026)**

| Alan | İçerik |
|---|---|
| **Ne** | İkinci konsey turunda `muhalif` VE `onprem` birbirinden bağımsız aynı bulguya vardı: `preise-check.yml`'in `commit-und-push` job'ı varsayılan `GITHUB_TOKEN` ile push ediyor — GitHub, sonsuz döngüleri önlemek için `GITHUB_TOKEN` ile atılan push'ların **yeni bir workflow çalıştırmasını başlatmasını engeller.** `publish-calendar-api.yml` (`on: push, paths: api-backend/**`) bu yüzden bu commit'ler için **hiç koşmamış olabilir** — dosyanın kendi başlık yorumu ve Telegram mesajı ("live ausgerollt") ise bunun otomatik olduğunu iddia ediyordu |
| **Nerede** | `.github/workflows/preise-check.yml` |
| **Tip** | B |
| **Kutuda ne olur** | Kutuya özgü değil — SaaS'ın backend image'ının güncel kalması bu zincire bağlı. Etki: her otomatik fiyat commit'i main'de duruyor ama image hiç yeniden basılmıyor, Watchtower hiçbir şey çekmiyor — yeni fiyat SaaS'ta hiç canlıya çıkmıyor, sistem "başarılı" diye rapor ediyor |
| **Çözüm** | Başarılı push'tan hemen sonra `gh workflow run "Build and Publish calendar-api image" --ref main` (workflow_dispatch, GITHUB_TOKEN kuralının istisnası — döngü değil açık bir tetikleme). Job'ın izinlerine `actions: write` eklendi. Telegram mesajı da "live ausgerollt" yerine "main aktualisiert, Build+Deploy ausgelöst" olarak düzeltildi (gerçek deploy hâlâ ayrı workflow'un kendi test+smoke-test zincirine bağlı) |
| **Durum** | ✅ **gelöst (14.09.2026)** — YAML `js-yaml` ile doğrulandı. **Doğrulanmadı:** gerçek bir CI koşusunda `gh workflow run`'ın GITHUB_TOKEN ile başarılı olduğu — GitHub dokümantasyonuna göre `workflow_dispatch` tetiklemesi bu token için açıkça izinlidir (yalnız otomatik `push`/vb. olayları engellenir), ama ilk gerçek koşu doğrulama sayılmalı. Yan not (`onprem` bulgusu, henüz aksiyon alınmadı, register'a not düşüldü): bot `VERSION`'ı hiç bump'lamıyor — bir sonraki insan yayını PATCH olarak işaretlenirse ve bu arada bot bir migration eklediyse, `publish-calendar-api.yml`'in R6 kapısı (PATCH migration içeremez) o yayını reddeder; commit mesajına bir hatırlatma satırı eklendi ama otomatik bir kapı değil — ileride ayrı bir madde olabilir |

### O-103 — CI'nın yazma-yetkili job'ı, npm ortamında üretilmiş bir dosyayı hâlâ `import` ediyordu (S-28) ✅ **gelöst (14.09.2026)**

| Alan | İçerik |
|---|---|
| **Ne** | `guvenlik`'in O-99 ikinci-göz turunda bulduğu S-28 (bkz. `guvenlik/REGISTER.md`, bu depoya girmez): O-99'un iki-job bölünmesi push-token'ı `npm`'li job'tan aldı ama veri akışını tam ayırmadı — `commit-und-push` hâlâ `node sync_heilmittel_katalog.js --sql` çalıştırıyordu, bu da `preise-check`'te (tam `npm ci` ortamında) üretilmiş iki kod dosyasını **statik olarak import ediyordu**. İçe aktarma sırasında kod çalıştıran (yalnız kurulum betiği değil) kötü niyetli bir paket, bu dar pencerede dosyaları değiştirip yazma-yetkili job'da sessizce çalıştırılabilirdi |
| **Nerede** | `.github/workflows/preise-check.yml` |
| **Tip** | B |
| **Kutuda ne olur** | O-99 ile aynı zincir (main → image → Watchtower → her kutu) — bu madde O-99'un kapatmadığı son adımı kapatıyor |
| **Çözüm** | `sync_heilmittel_katalog.js --sql`'in çağrılma yeri `preise-check` (yazma yetkisi yok) job'ına taşındı, çıktısı (`preise-seed.sql`) düz metin olarak artefakta eklendi; `commit-und-push` artık bu metni yalnız `cat` ile migration dosyasına yazıyor — hiçbir Repo kodu import etmiyor. Kalan tek `node` çağrısı (`erwartete-zaehler.json` bump'ı) yerleşik `fs` dışında hiçbir şey içermiyor |
| **Durum** | ✅ **gelöst (14.09.2026)**, aynı gün bulunup kapatıldı — detaylı gerekçe `guvenlik/REGISTER.md`'de (S-28, bu depoya girmiyor, `.gitignore`) |

### O-104 — `.praxura-stand/` chmod'u yalnız İLERİYE dönük çalışıyordu, eski anlık görüntüler 0755 kalıyordu ✅ **gelöst (14.09.2026)**

| Alan | İçerik |
|---|---|
| **Ne** | `onprem`'in O-100 ikinci-göz turunda bulduğu ek: O-100'ün `chmod 700 "$STAND_DIR"` düzeltmesi tek düzey, tek dizin çalışıyordu — O-100'den ÖNCE zaten oluşmuş eski `$SNAPSHOT_DIR` alt klasörleri (son-3 rotasyonuyla hâlâ diskte duran) `0755` kalıyordu |
| **Nerede** | `onprem/update.sh` |
| **Tip** | G |
| **Kutuda ne olur** | O-100 ile aynı sınıf, daha dar: üst dizin `700` olduğu için erişim yolu zaten kapalı, ama alt klasörlerin kendisi hâlâ açık kalıyordu — savunma derinliği eksikti |
| **Çözüm** | `chmod 700 "$STAND_DIR"` → `chmod -R go-rwx "$STAND_DIR"`, her `update.sh` çalışmasında (yani periyodik olarak, mevcut kutularda da) tüm alt ağacı geriye dönük düzeltiyor |
| **Durum** | ✅ **gelöst (14.09.2026)**, `bash -n` ile doğrulandı |

### O-107 — Owner şifresi unutulursa kutuda **geri dönüş yolu yok**: SMTP opsiyonel, sihirbaz tek kullanımlık, `--neu` veritabanını siliyor ✅ **gelöst (02.10.2026, KHS K2)**

| Alan | İçerik |
|---|---|
| **Ne** | Kutunun tek yöneticisi (owner) şifresini unutursa hesabını kurtaracak hiçbir yol yok — ne self-servis, ne elle. Kutu çalışmaya devam eder ama sahibi kendi hasta verisinden kalıcı olarak dışarıda kalır |
| **Nerede** | Şifrenin yeri: `api-backend/setup/router.js:199-203` (`supabase.auth.admin.createUser({ email, password, email_confirm: true })`) → `SUPABASE_URL: http://kong:8000` (`onprem/docker-compose.yml:417`), yani **müşterinin kendi** `praxura-db`'sindeki `auth.users`, GoTrue'nun bcrypt'iyle. Tek self-servis kurtarma: `login.js:316` `resetPasswordForEmail` — mail gerektirir. Diğer iki şifre değiştirme yeri **oturum** gerektirir, kilitlenmiş owner'a fayda etmez (`login.js:342` recovery-link sonrası · `dashboard.js:13318` Ayarlar). Kanalın kapalı olduğu yer: `onprem/install.sh:344-353` (SMTP adımı opsiyonel, „n" → `set_env SMTP_HOST ""`) + `onprem/docker-compose.yml:181-190` (GoTrue'nun SMTP'si o env'den gelir). Sihirbaz ikinci kez açılmaz: `api-backend/setup/router.js:77` `istAbgeschlossen()` → `/owner` ve `/verify` 410. Break-glass aracı **yok**: `onprem/*.sh` = install · update · backup · restore; `grep -i "passwor" onprem/*.sh` yalnız `POSTGRES_PASSWORD` (backup/restore) döner, `grep -i "passwor\|reset" onprem/REGISTER.md` bu maddeden önce sıfır ilgili sonuç veriyordu |
| **Tip** | **G** (merkez mi kutu mu: hesap kurtarma yeteneği kutuda kalmalı, bugün hiçbir tarafta yok). Bizim anahtarımız ya da yetkimiz işin içinde olmadığı için E/H değil |
| **Kutuda ne olur** | SMTP kurulmamış bir kutuda owner şifresini unuttuğu an: (1) `resetPasswordForEmail` çağrısı GoTrue'da mail gönderemez — kullanıcı arayüzde „mail gönderildi" benzeri bir cevap görür, mail hiç çıkmaz (yine sessiz arıza sınıfı); (2) `DISABLE_SIGNUP=true` (`onprem/.env.template:191`) olduğu için yeni hesap açılamaz; (3) kurulum sihirbazı kapalı, jeton tüketilmiş; (4) **biz giremeyiz — K10 bunu bilinçli olarak yasaklıyor**, yani „destek hattını arar, biz resetleriz" diye bir yol yok ve olmayacak. Geriye tek görünür seçenek `install.sh --neu` kalır ve **o veritabanını siler** (`install.sh:111-122`, `:210-216`). Yani bugün kutunun sahibi için „şifremi unuttum" ile „bütün hasta verimi kaybettim" arasında tek bir yanlış komut var. ⚠️ Bunu ağırlaştıran ikinci bulgu: `install.sh:353`, SMTP'yi atlayan müşteriye „sonradan **`bash install.sh --neu`** ile ya da elle .env'de ekleyebilirsin" diyor — yıkıcı olanı **önce** sayıyor. Silme öncesinde `LÖSCHEN` yazdıran onay var, yani sessiz değil; ama „mail kurayım" diye yola çıkan bir insanı, üstelik tam da paniklediği anda, veri silen komuta yönlendiren bir metin yanlıştır. SMTP kurulu kutularda maddenin ilk yarısı çalışır — ama O-51 ayakta olduğu sürece kurtarma maili de SPF/DMARC yüzünden spam'e düşebilir, yani kanal „var" ile „güvenilir" arasında |
| **Çözüm** | **Faz 2.1c — `onprem/reset-owner-passwort.sh`** (host betiği ailesi: install · update · backup · restore'un yanı). Müşteri **kendi** sunucusunda, **kendi** root'uyla çalıştırır; biz ne çalıştırırız ne erişiriz → K10 bozulmaz. Tasarım sınırları: (1) **CLI, rota değil** — aşağıdaki kırmızı çizgi; (2) uygulama `docker compose exec -T api node setup/reset-owner-passwort.mjs` ile, O-82'nin `update-alarm-mail.mjs` deseninin aynısı, `api` sağlıksızsa aynı maddedeki `docker compose run --rm --no-deps --pull never api …` yedeği (`--pull never` şart: internetsiz kutu) ; (3) **şifre argv'ye düşmez** — `read -r -s` ile sorulur (backup.sh'ın parmak izi kuralıyla aynı gerekçe: argv host'ta `ps`'te ve shell history'de görünür); (4) hedef hesap `praxura_setup.owner_user_id`'den çözülür — `/test-smtp`'nin zaten kullandığı zincir — yani betik „istediğin kullanıcının şifresini değiştir" aracına dönüşmez, yalnız owner'ı kurtarır; (5) `auth.admin.updateUserById()` kullanılır, `auth.users`'a elle bcrypt **yazılmaz** (GoTrue'nun kendi invariant'ları ve oturum iptali korunur); (6) iz bırakır: `.praxura-stand/` altına zaman damgası + „owner şifresi elle sıfırlandı" satırı, şifre yazılmadan (dizin rejimi O-100/O-104 ile zaten `go-rwx`). **Ek, aynı görevde:** `install.sh:353` cümlesi ters çevrilir — doğru yol („elle `.env` + `docker compose up -d auth api`, HER İKİ konteyner") önce ve tek başına; `--neu` o satırda **hiç anılmaz**. Üçüncü parça belge: kurulum el kitabına „şifre kurtarma" maddesi (`RELEASE-STANDARD.md` destek bölümü) — aracın var olduğunu bilmeyen müşteri için araç yoktur |
| **Durum** | `gelöst` (`e4c7703`; paket listesi `acc51d5`). `onprem/reset-owner-passwort.sh:36/:43` `read -r -s` (argv'ye düşmez) → `api-backend/setup/owner-passwort-reset.mjs:43-45` hedef yalnız `praxura_setup.owner_user_id`, `:50` `plan_status='deleted'` reddi, ardından `auth_sitzungen_beenden`. HTTP ucu yok (hüküm 2 korundu). **Kutuda ölçüldü (WSL, 02.10.2026):** eski şifre `invalid_credentials`, yeni şifre token alıyor, eski refresh token `refresh_token_not_found`, şifre log'da yok. Belge: `onprem/KURULUM.md` (K2.12) — Önceki: `geplant (KHS K2.4)` — 02.10.2026 sahibi atandı. Tasarım bu maddenin Çözüm hücresindeki gibi kalır (hedef `praxura_setup.owner_user_id`, `docker compose exec -T api node setup/…mjs`, şifre argv'ye düşmez); ek: `auth_sitzungen_beenden(owner_id)` çağrılır (`0055`, EXECUTE yalnız service_role), `plan_status='deleted'` hesapta reddeder, betik `BUNDLE_DATEILER` + Dockerfile COPY'ye girer (O-149). Önceki not: `offen` — **01.10.2026: O-142 ile öncelik yükseldi, mail kanalı hiç olmayacağı için betik her kutuda tek kurtarma yolu (Faz 2.1c şart).** 14.09.2026'da açıldı, henüz uygulanmadı. Karar kullanıcıda (Faz 2.1c'ye alınsın mı, hangi turda) |

> **Üç hüküm, 14.09.2026 (`onprem`):**
>
> **1. Korkuluk ihlali yok, veto konusu değil.** G1 nötr (kutudan dışarı hiçbir şey
> çıkmaz), G2 nötr (kullanılan sırlar müşterinin kendi sunucusunda üretilmiş kendi
> sırları; bizim hiçbir anahtarımız yok), G7 temiz (SaaS davranışı hiç değişmez — betik
> kutu paketinin parçası, merkez VPS'inde çalıştırılmaz), K10 korunur. Bu bir
> **erişilebilirlik/kilitlenme** açığı, gizlilik açığı değil. Yeni bir yetki de
> yaratmıyor: bu betiği çalıştırabilen kişi host'ta zaten root'tur ve `.env`'deki
> `POSTGRES_PASSWORD` + `DATA_ENCRYPTION_KEY` ile veritabanının tamamını halihazırda
> okuyabilir. Yani yeni saldırı yüzeyi değil, **var olan yeteneğin ergonomik
> sarmalayıcısı**. Yine de tasarım inmeden `guvenlik` bir kez okumalı (hesap ele
> geçirme yolu + iz bırakma).
>
> **2. ⛔ Bu HTTP ucu olarak çözülmez.** `SETUP_TOKEN` ile korunan bir
> `/api/setup/reset-password` rotası cazip görünür ve **yanlıştır**: praxis ağındaki
> herkese açık, kalıcı bir hesap-ele-geçirme yüzeyi olur, ve **aynı kod SaaS'ta da
> koşar** — O-66/O-67'nin dersi tam buydu, `SETUP_TOKEN` merkez VPS'inde asla set
> edilmez çünkü set edilirse owner-yaratma ucu canlıda açılır (CLAUDE.md'ye de o yüzden
> yazıldı). Kurtarma yeteneği **host'ta duran bir komut** olmalı, ağdan erişilebilen bir
> uç değil. Fark şu: host'a erişebilen zaten her şeye erişebilir; ağa açılan uç ise
> erişemeyene erişim verir.
>
> **3. „SMTP'yi zorunlu yapalım" (seçenek a) doğru cevap değil — iki ayrı sebeple.**
> Birincisi yetki: SMTP'nin opsiyonel olması 11.09.2026'da **kullanıcının verdiği**
> O-66 kararıdır (seçenek (a): `install.sh` sorar, atlanabilir); ben onu geri açmam,
> gerekirse kullanıcıya çıkarırım. İkincisi yetersizlik: zorunlu SMTP bu maddeyi
> **kapatmaz**. Mail tabanlı kurtarma on-prem'de yapı gereği kırılgan bir kanaldır —
> sağlayıcı şifresi süresi dolar, kutu internetsiz kalır, ve O-51 ayakta olduğu sürece
> kurtarma maili alıcının spam klasörüne düşer. İkisi birbirinin yerine geçmez: SMTP
> kurulu kutuda kurtarma **rahatlar**, betik ise **her** kutuda son çare olarak durur.
> Doğru cevap (b)'dir; (a) ayrıca gerekli değildir.

### O-105 — CORS beyaz listesi yalnız SaaS domain'lerini tanıyor: kutuda **aynı-origin** POST'lar reddediliyor

| Alan | İçerik |
|---|---|
| **Ne** | `ALLOWED_ORIGINS` sekiz SaaS domain'ine sabit-kodlu. Kutunun kendi adresi (`SITE_URL`) listede yok ve `api` konteyneri o değeri **hiç almıyor** — bilmesinin bir yolu da yok |
| **Nerede** | `api-backend/server.js:55-71` (global `app.use(cors(...))`, tüm route'lardan önce) · `onprem/docker-compose.yml:394-480` (`api` servisinin `environment:` bloğunda `SITE_URL` yok; `auth` `:160` ve `caddy` `:516` alıyor) |
| **Tip** | C (sabit adres) |
| **Kutuda ne olur** | ⚠️ **Bu bir "cross-origin" sorunu değil — asıl mesele bu.** Kutuda Caddy hem frontend'i hem `/api/*`'ı **aynı origin'de** sunuyor (`onprem/Caddyfile:50` → `reverse_proxy api:3000`), `GET /api/config` de `apiBase: '/api'` göreli döndürüyor (`server.js:411`). Yani tarayıcı zaten aynı origin'e konuşuyor; ama tarayıcı **aynı-origin POST'ta da `Origin` başlığı gönderir**. `ALLOWED_ORIGINS` onu tanımayınca middleware `Error` atıyor → istek daha route'a varmadan ölüyor. Sonuç: kutuda **GET çalışır, POST/PATCH/DELETE çalışmaz** — kurulum sihirbazının jeton doğrulaması (`/api/setup/verify`), login sonrası her yazma işlemi, randevu oluşturma, Rezept yükleme. Hata tarayıcıda "genel hata" gibi görünür, sebebi görünmez. Ölçüldü 14.09.2026, yerel on-prem yığınında (`SITE_URL=https://localhost`) |
| **Çözüm** | İki satır: **(1)** `onprem/docker-compose.yml`'de `api` servisine `SITE_URL: ${SITE_URL}` (install.sh zaten `.env`'e yazıyor, yeni soru yok). **(2)** `server.js`'te liste `process.env.SITE_URL` doluysa onu da içersin (trim + boşsa ekleme). SaaS'ta `SITE_URL` hiç set edilmemiş → dizi byte-eşdeğer kalır (G7). ⛔ **"Kutuda CORS'u tamamen atla" reddedildi** — bkz. aşağıdaki not. Bu, **O-03**'ün CORS alt-kalemini kapatır; O-03'ün kalan 18 satırı açık kalır |
| **Durum** | ✅ **gelöst (`5fbfd81`)** — 02.10.2026 koda karşı doğrulandı: `server.js:73-74` `SITE_URL` doluysa `ALLOWED_ORIGINS`'e ekliyor, `onprem/docker-compose.yml:430` `api`'ye `SITE_URL` geçiriyor. Önceki not: „düzeltme 14.09.2026'da yazılıyor" |

> **Niye "SETUP_TOKEN varsa CORS'u kapat" değil** (14.09.2026, `onprem` hükmü): (a) `SETUP_TOKEN`
> tek kullanımlıktır ve kurulum bitince tükenir — CORS'un kutunun **tüm ömrü boyunca**
> çalışması gerekir, yalnız kurulum penceresinde değil; (b) var olan bir güvenlik kontrolünü
> kaldırmak demektir (kutu tek-kiracı olabilir ama tarayıcı hâlâ internete bakıyor, CSRF
> yüzeyi açılır); (c) SaaS ile kutu arasında **davranış ayrımı** yaratır — G7'nin yasakladığı
> şeyin ta kendisi. Doğru yol tek kod yolu + tek env var.
>
> **Niye `PUBLIC_BASE_URL` değil `SITE_URL`:** O-03'ün çözüm sütununda `PUBLIC_BASE_URL` yazıyordu.
> Bugün `SITE_URL` zaten `install.sh:248`'de üretiliyor, `.env`'de duruyor, `auth` ve `caddy`
> onu okuyor. İkinci bir ad = aynı değerin iki gerçeği; ilk yanlış kurulumda hangisinin
> geçerli olduğunu kimse bilmez. **`SITE_URL` kullanılır**, O-03'ün önerisi bu noktada düzeltildi.
>
> **Sessiz bağımlılık (kayda geçsin):** eşleşme dizge-eşitliğidir. `install.sh` adım 4 (O-59)
> `SITE_URL`'i `https://host` biçimine zorluyor — port yok, yol yok, sondaki `/` yok. Tarayıcının
> `Origin` başlığı tam olarak bu biçimdedir, bu yüzden eşleşir. **O-59'un ön-kontrolü
> gevşetilirse bu madde sessizce geri gelir** (örn. sonda `/` kabul edilirse eşleşme kırılır).
> İki madde birbirine bağlıdır.

### O-106 — Kutuda „Abonnement verwalten" / „Upgrade" müşteriyi **bizim SaaS kayıt akışımıza** götürüyor

| Alan | İçerik |
|---|---|
| **Ne** | Ayarlar → „Konto & Abonnement" bölümündeki iki buton kutuda da render ediliyor. `onboarding.html` pakete girmediği için (`frontend.Dockerfile:28`, Faz 2.0) ikisi de kutunun içinde var olmayan bir sayfaya gidiyordu; 14.09.2026'da `subUpgradeBtn`'e `IST_KUTU ? 'https://app.praxura.de' : ''` öneki konarak dış linke çevrildi, `subPortalBtn` **dokunulmadan kaldı** |
| **Nerede** | `dashboard.html:2843-2844` (iki buton) · `dashboard.js:13323` (`subPortalBtn` → `_doStripePortalRedirect`) · `dashboard.js:13324` (`subUpgradeBtn`, yeni sabit adres) · `dashboard.js:2304-2312` (`_doStripePortalRedirect`: `/onboarding.html?step=plan` fallback'i + `/api/stripe/portal-session`) · ayrıca `dashboard.js:1444` (`pastdue-fix-btn`, aynı fonksiyonu çağırıyor) |
| **Tip** | G + H (+ C: yeni sabit adres) |
| **Kutuda ne olur** | **On-prem owner'ın `stripe_subscription_id`'si hiçbir zaman olmayacak** — lisans Stripe'tan geçmiyor (K3, Faz 3.1). Yani `_doStripePortalRedirect()` kutuda **her zaman** ilk satırdaki fallback'e düşer: `/onboarding.html?step=plan` → paketin içinde yok → 404. Yönlendirme merkeze çevrilse sonuç daha da kötü: **zaten müşterimiz olan birine „yeni SaaS hesabı aç + kart gir" akışını göstermiş oluruz.** `subUpgradeBtn` bugün tam olarak bunu yapıyor. Üstüne O-67 biner: kutuda `plan_status` `'pending'` kalıyor, yani aynı panelde „Status: pending" ile „Upgrade" yan yana durur — müşteri ödemesinin geçmediğini sanır |
| **Çözüm** | **İki adım, ayrı zamanlarda.** **(a) Bugün — kaldır, yönlendirme.** Bu depodaki yerleşik desen bu: `login.js:200` (kayıt bloğu + SaaS footer `remove()`) ve `module/lead-suche.js:22` (Apify/B2B çubuğu `remove()`). Aynısı: `IST_KUTU` ise iki buton DOM'dan **çıkarılır**, yerine statik bir satır — „Lizenz & Vertrag: läuft direkt über Praxura · kontakt@praxura.de". İnternet gerektirmez, dış adres gerektirmez, 404 üretmez. ⚠️ Etiket **„Lizenz"** olmalı, „Abrechnung" **değil** — bu üründe „Abrechnung" §302 GKV demektir, aynı ekranda iki anlama gelemez. **(b) Faz 3.2 — O-19'un dış linki.** Lisans sunucusu (Faz 3.1) ayağa kalkınca bu satır merkezdeki lisans sayfasına giden dış linke döner. O-19 bunu zaten kilitledi ve hedefini **sabit merkez adresi** olarak yazdı (env değil) — aşağıdaki not |
| **Durum** | ✅ **gelöst (`5fbfd81`)** — 02.10.2026 koda karşı doğrulandı: `module/subscription-ui.js:14-20` `istKutu` iken `subPortalBtn`'i kaldırıyor, `subUpgradeBtn`'i lisans metniyle değiştiriyor. Önceki not: „(a) uygulanmadı; `subPortalBtn` hâlâ kırık" |

> **Üç hüküm, 14.09.2026 (`onprem`):**
>
> **1. Sabit `https://app.praxura.de` doğru, env'e taşınmaz — ama bu satırda değil.**
> O-19 bunu zaten karara bağlamıştı: „`PUBLIC_BASE_URL` değil, sabit merkez adresi".
> Gerekçe: bu değer **bizim** adresimiz, müşterinin değil. `.env`'e konursa kutunun
> sahibi (ya da hatalı bir kurulum) owner'ı sahte bir ödeme sayfasına yönlendirebilir;
> `SITE_URL`/`API_BASE` müşterinin kendi adresleridir, bu değildir. Yani **tip C'nin
> bilinçli istisnası**: „sabit adres yasak" kuralı kutunun **gideceği** adresler içindir,
> merkezin kendi kimliği için değil. ⛔ Ama (a) uygulanınca bu satır zaten **silinir** —
> kutuda gidilecek bir yer yok. Sabit adres (b) ile, Faz 3.2'de geri gelir.
>
> **2. Kapı bu satırı bugün görmüyor, yarın reddedecek.** `tools/check-onprem.sh`
> `git grep --cached` kullanıyor, yani **index** üzerinden sayıyor. `dashboard.js` henüz
> stage edilmediği için kapı yeşil geçti; çalışma ağacındaki gerçek sayı **16**, taban
> `app_host=15`. `git add dashboard.js` yapıldığı anda commit reddedilir. Doğru çıkış yolu
> tabanı yükseltmek **değil**, (a)'yı uygulamak — o zaman sayı 15'te kalır, kazanılmış
> taban korunur. (Kapının bu özelliği genel: çalışma ağacındaki yeni ihlal, stage
> edilene kadar görünmez.)
>
> **3. `portal.praxura.de` — G8/K10 ihlali değil, ama bu turun işi değil.** Kutunun
> yalnızca **link verdiği** (tarayıcı gezinmesi, `fetch` değil) bir merkez yüzeyi yeni bir
> bulut zinciri sayılmaz: kutu ona bağımlı çalışmaz, hasta verisi taşımaz (G1 temiz),
> K10 bozulmaz. Asıl engel teknik değil: **on-prem owner'ın merkezde hesabı yok.**
> Kullanıcısı yalnız kendi kutusunun Supabase'inde var; merkezdeki bir portalın onu
> tanıyabilmesi için Faz 3.1'in lisans kimliği (lisans-ID + imza) gerekir — o inmeden
> portal boş bir kabuktur. Ayrıca **Stripe'ın barındırdığı Customer Portal SaaS tarafını
> zaten çözüyor** (`api/stripe/portal-session.js` → Stripe'ın kendi sayfası); ona ayrı bir
> custom domain bağlamak kozmetiktir ve on-prem'in hiçbir sorununa dokunmaz (on-prem
> müşterinin Stripe müşterisi yok). Tavsiye: **ayrı portal stack'i açma.** Lisans yüzeyi
> Faz 3.1/3.2 ile birlikte, var olan merkez yüzeyinde (app.praxura.de altında bir rota ya
> da ops) doğar; 20-200 kutuluk filo için ikinci bir TLS + auth + deploy yüzeyi bugünkü
> ekiple ödenmeyecek bir borçtur. Karar kullanıcınındır, fiyat etiketi budur.

### O-66 — Sihirbazın SMTP ekranı yapısal olarak çalışamaz: GoTrue ayarını env'den okur

| Alan | İçerik |
|---|---|
| **Ne** | Playbook 2.2 SMTP'yi sihirbaza koyuyor, 2.7 ise „sihirbazdaki SMTP GoTrue'yu da beslesin, tek ayar iki işi görsün" diyor. Bu ikisi bugünkü mimaride **aynı anda doğru olamaz** |
| **Nerede** | `ONPREM_MIGRATION_PLAYBOOK.md:216` (2.2) + `:222` (2.7) · `onprem/docker-compose.yml` `auth` bloğu (`GOTRUE_SMTP_*`) · `onprem/.env.template` SMTP bölümü · tüketici taraf: `api-backend` nodemailer |
| **Tip** | E (+ G) |
| **Kutuda ne olur** | GoTrue `GOTRUE_SMTP_*`'ı **açılışta** env'den okur. Tarayıcıdaki sihirbaz konteyner env'ini değiştiremez; değiştirmenin tek yolu `.env` + `docker compose up -d auth`, yani ya müşterinin terminale dönmesi ya da konteynere **docker soketi** verilmesi (kutuda root — açılmaz). Sonuç: SMTP'yi DB'ye yazan bir sihirbaz randevu/Mahnung mailini düzeltir ama **şifre sıfırlama ve davet mailini düzeltmez**; müşteri „test maili gitti" ekranını görür, sonra şifresini unutan çalışan mail alamaz. Arıza sessiz ve gecikmeli — en pahalı sınıf. ⚠️ Üstüne **O-51** biner: gönderen adresi bizim alan adımız olduğu sürece test maili „gitti" dese de **spam'e düşer** (SPF `-all` + DMARC `p=quarantine` ölçüldü) |
| **Çözüm** | Üç seçenek, karar **kullanıcının** — ajan tek başına vermez: **(a)** SMTP `install.sh`'ta sorulur → tek gerçek env'de, GoTrue ve `api` aynı değeri okur; sihirbaz yalnız **test eder ve teşhis gösterir** (`RELEASE-STANDARD.md` §5.4/9'un „ya başarılı ya bilinçli atlandı"ı bununla uyumlu). **Ajanın tavsiyesi (a)** — en az hareketli parça, docker soketi yok, 2.7 lafzen karşılanır. **(b)** SMTP DB'ye yazılır, **bütün** mail `api`'ye taşınır, GoTrue'nun mail işi kapatılır — daha iyi UX ama auth mail akışını yeniden yazmak demek, bu fazın işi değil. **(c)** Sihirbaz `.env` satırlarını **gösterir**, müşteri yapıştırıp `docker compose up -d auth` der — K10 açısından dürüst ama „hiçbir elle adım olmadan" kabul ölçütünü (playbook `:226`) deler. Hangisi seçilirse gönderen alan adı da aynı turda müşterinin kendi alan adına geçmeli (O-51) |
| **Durum** | ⚠️ **01.10.2026: karar O-142 ile devralındı** — auth maili kutudan kalktı, `install.sh` SMTP sorusu auth için gereksiz; aşağıdaki uygulama tarihçe olarak kalır. ✅ **uygulandı** (11.09.2026 gecesi) — seçenek **(a)**: `install.sh` adım 11 (yeni, `docker compose up`'tan ÖNCE) SMTP'yi sorar, atlarsa `.env.template`'in izin verdiği geçerli yol kalır ama sonucu söyleyen bir `warn` ile. `api-backend/lib/mail.js` (`getMailFrom()`) altı sabit adresi tek yerde topladı, `server.js` artık hepsinde bunu çağırıyor — SaaS davranışı `node --check` + izole birim testiyle doğrulandı (env boşken eski sabit çıktı birebir). `api-backend/setup/router.js`'e dördüncü uç: `POST /setup/test-smtp` — jetonla korunur (`nochOffen()` DEĞİL, owner sonrası da çalışsın diye), alıcıyı **istekten almaz** (`praxura_setup.owner_user_id` → `profiles.email`), `SMTP_HOST` boşsa `{eingerichtet:false}` döner (hata değil), aksi hâlde `transport.verify()` + gerçek gönderim, nodemailer hata kodları Almancaya çevrilir. `setup.html`/`setup.js`'e üçüncü adım eklendi (dört adım oldu): atlandıysa onay kutusu zorunlu, gönderildiyse "geldi mi/gelmedi mi" sorusu, gelmediyse O-51 teşhisi.<br>**Yerel kutuda ölçüldü** (gerçek SMTP sunucusu YOK, üç durum ayrı ayrı tetiklendi): `SMTP_HOST` boş → `{"eingerichtet":false}` 200 · `SMTP_HOST` çözülemeyen bir ad (`supabase-mail`, eski PoC artığı) → `502 {"error":"Mailserver-Adresse ist unbekannt…","code":"EDNS","gesendetAn":"owner2@…"}` — hem hata çevirisi hem alıcı bilgisi doğru · 10 saniye içinde ikinci istek → `429`. `getMailFrom()` beş senaryoda izole test edildi (SaaS fallback, kutu override, `MAIL_FROM_NAME`, ve bir header-injection denemesi — `\r\n` temizleniyor). Kapı: `absender_fest` 6 → **2** (1 bilinçli fallback + 1 yorum satırı), taban sıkıştı.<br>**Test edilmeyen tek şey:** gerçek bir SMTP sunucusuyla uçtan uca "gönderildi VE gelen kutusunda" doğrulaması — elde gerçek kimlik bilgisi yoktu. İlk gerçek kurulumda bu adım da ölçülmeli, kabul ölçütü hâlâ "250 değil teslim" |

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

## 7J — Faz 2.1b son maddesi: kutu kendi compose'unu nasıl günceller (O-45 (b)), 12.09.2026

> §7G gibi: **kod değil, gereksinim.** Uygulama `builder`'ın. Aşağıdaki on madde
> kilitlidir; biri değişecekse önce burası değişir, sonra betik.
>
> Sorunun bugünkü hâli tek cümle: `onprem/docker-compose.yml`'e yazdığımız hiçbir şey
> kurulmuş bir kutuya ulaşmıyor (`RELEASE-STANDARD.md` §6.4). Bugün O-49'da eklediğimiz
> `98a-no-pg-net.sql` mount'u bunun canlı örneği — repoda var, kutuda olmazdı.

### J1 — Kanal: host'ta bir betik + systemd zamanlayıcı. Konteyner **değil**

| Seçenek | Niye reddedildi |
|---|---|
| `api` konteyneri host'taki compose'u bind-mount üzerinden yazsın | (1) Dosyayı yazmak **uygulamaz** — compose'u okuyan host'taki Docker daemon'ıdır, birinin `docker compose up -d` çalıştırması gerekir; (2) `api` konteyneri `USER app` ile koşuyor, root'a ait `.env`/compose'u yazamaz; (3) uygulamaya docker soketi vermek, **internete bakan** konteyneri host root'una çevirir (bir RCE = kutunun tamamı) |
| Compose'da `praxura-updater` diye bir servis | Kendi tanımını yeniden yazan servis, `docker compose up -d`'yi çalıştırdığı anda **kendini** öldürür (komut yarıda kalır). Kaçış yolu var (kardeş bir tek-atımlık konteyner doğurmak) ama yine docker soketi gerektirir ve yukarıdaki (3) aynen geçerli |
| ✅ **Host'ta `update.sh` + `praxura-update.timer`** | Root olarak host'ta koşar: dosyayı yazabilir, `docker compose up -d` çalıştırabilir, **kendini yeniden başlatabilir** (konteyner değil, süreç). Hiçbir konteynere soket vermez. `install.sh` zaten root olarak host'ta koşuyor — kurulumu oradan yapılır |

⛔ Yan sonuç, bilinçli: **kutuda Watchtower olmayacak.** Bkz. J8.

### J2 — Paket (`bundle`): image'ın içinde gelen host dosyaları

`api` image'ında `/app/onprem-bundle/` altında taşınır (aynı commit'ten, `praxura/api`'ye
sabitlenir — `frontend` image'ına konmaz, iki kaynak olmaz). İçindekiler **manifest'te
tek tek sayılır**, dizin kopyalanmaz:

```
/app/onprem-bundle/manifest.json
                   docker-compose.yml
                   .env.template
                   install.sh · update.sh · lib-health.sh
                   volumes/api/kong.yml · kong-entrypoint.sh
                   volumes/db/*.sql
```

`manifest.json` alanları: `surum` (`X.Y.Z`) · `dateien[]` (yol + sha256) ·
`durak` (bool) · `elle_adim[]` (DE metin) · `not_url`.

- **Dizin kopyalama yasak, sebebi somut:** `onprem/volumes/db/data` **canlı Postgres veri
  dizinidir**, kurulum ağacının içinde durur. Naif bir `cp -r`/`rsync` veritabanını
  yedeğe kopyalar, diski doldurur (§6.6) ve sırları çoğaltır. Güncelleyici yalnız
  `dateien[]`'de yazan yolları okur ve yazar; başka hiçbir dosyaya dokunmaz.
- Çıkarma yöntemi: `docker create` + `docker cp` + `docker rm`. Konteyner **çalıştırılmaz**,
  image'da shell/entrypoint aranmaz.
- ⛔ Pakette **hiçbir sır yoktur** (G2). `.env.template` boş değerlerle gelir; gerçek
  `.env` müşterinin sunucusunda, `install.sh`'ın ürettiği hâliyle kalır.
- Paket **yeni bir dış çağrı açmaz** (G8): tek giden bağlantı zaten var olan registry
  pull'u. Taksonomide bu **tip B'nin host tarafındaki kardeşi** — veri merkezde
  derlenir, image'la iner, kutu kimseye telefon etmez.

### J3 — Dosya sahipliği: üç sınıf, üç ayrı kural

| Sınıf | Dosyalar | Kural |
|---|---|---|
| **Bizim** | `docker-compose.yml` · `volumes/**` · `update.sh` · `install.sh` · `lib-health.sh` | Byte byte değiştirilir. Müşteri bunları düzenlemez |
| **Müşterinin** | `.env` | **Asla komple değiştirilmez.** Yalnız anahtar bazında birleştirilir (J4) |
| **Kimsenin** | `.env` dışındaki her şey, `volumes/db/data`, yedekler, loglar | Güncelleyici bunlara **hiç bakmaz** |

**"Bizim" dosyalar için sapma kontrolü:** durum dosyası her dosyanın *bizim yazdığımız*
sha256'sını tutar. Diskteki dosya o özetten farklıysa biri elle düzenlemiştir →
**üzerine yazılmaz**, yeni sürüm yanına `<dosya>.neu` olarak bırakılır, güncelleme
**tümden durur** ve panelde dosya adıyla gösterilir. Yarım uygulanmış paket, hiç
uygulanmamış paketten kötüdür.

> Bu kural, §6.4'ün *"compose'da davranış tutulmaz"* cümlesini **denetlenebilir** hâle
> getirir: müşterinin değiştirmek isteyebileceği her şey `.env`'de olmak zorundadır,
> yoksa ilk özelleştirmede kutu güncelleme alamaz hâle gelir.

### J4 — `.env` birleştirme: üç-yollu, ama **anahtar bazında** (metin merge değil)

Üç girdi: `taban` = en son uyguladığımız `.env.template` kopyası (durum dizininde
saklanır) · `bizim` = paketteki yeni `.env.template` · `onun` = kutudaki `.env`.

| Durum | Karar |
|---|---|
| Anahtar yalnız `bizim`'de (yeni) | `.env` sonuna eklenir, üstüne `# neu in X.Y.Z` yorumu |
| `bizim == taban` (biz değiştirmedik) | **Dokunulmaz.** Sırlar, `SITE_URL`, TLS modu, SMTP buraya düşer |
| `bizim != taban` **ve** `onun == taban` | Bizimki yazılır. `VERSION_*` / `PRAXURA_*_IMAGE` yükseltmesi buradan yürür — O-45 (a)'nın karşılığı |
| `bizim != taban` **ve** `onun != taban` (müşteri kendi sabitlemiş) | **Onunki kalır**, çakışma kaydedilir, panelde uyarı — ama güncelleme **devam eder** |
| Anahtar `taban`+`onun`'da var, `bizim`'de yok | Dokunulmaz. Kullanılmayan env anahtarı zararsızdır; **silme yok** |

Asimetri bilinçli: **bizim dosyamızda çakışma durdurur, `.env`'de durdurmaz.** `.env`
tanım gereği müşterinindir; orada bir satır yüzünden kutuyu sonsuza kadar eski sürümde
bırakmak, çözdüğümüzden büyük bir sorun olurdu.

Yazma biçimi: satır yerinde değiştirilir (dosya baştan üretilmez — müşterinin kendi
yorumları ve satır sırası korunur), geçici dosyaya yazılıp `mv` ile yerine konur,
`chmod 600` + root sahipliği korunur. ⛔ Hiçbir değer log'a yazılmaz (§7G hata modeli).

### J5 — Bir koşunun adım sırası (kilitli)

| # | Adım | Not |
|---|---|---|
| 0 | `flock` + ön kontrol | Aynı anda ikinci koşu yok. Disk %92'nin üstündeyse hiç başlama (§6.6) |
| 1 | `docker compose pull api` | Yalnız kendi image'ımız. Başarısızsa **hiçbir şey değişmedi**, sessizce bir sonraki geceye |
| 2 | Paketi çıkar (`docker create`/`cp`), `manifest.json`'ı oku | Ağa ikinci bir çıkış yok |
| 3 | **Durak kapısı** | `durak: true` ya da `elle_adim[]` doluysa: hiçbir dosyaya dokunma, panelde metni göster, dur (`RELEASE-STANDARD.md` §3.4 Kural 4) |
| 4 | Diskteki hâlle karşılaştır | Fark yoksa → adım 8'e atla (image yenilenmiş olabilir) |
| 5 | Sapma kontrolü (J3) + `.env` birleştirme (J4) | Sapma varsa dur, `.neu` bırak |
| 6 | **Anlık görüntü** | `dateien[]` + `.env` → `.praxura-stand/<zaman>/`. Son **3** tutulur |
| 7 | Yeni dosyaları yaz → **iki kapı** | (a) `docker compose config -q` geçmeli; (b) compose'daki **her bind-mount kaynağı diskte dosya olarak var mı** (O-72). İkisi de konteynerlere dokunmadan, bedava |
| 8 | `docker compose pull` + `up -d --remove-orphans` | `.env`'i host'taki Docker okur; yeni `VERSION_*` burada devreye girer |
| 9 | **Sağlık kapısı** | `lib-health.sh` — `install.sh` adım 12'nin O-63'te sertleştirilmiş hâli, **ortak dosya** (iki betik aynı kodu kullanır, sürüklenme olmaz) + Caddy üzerinden `/api/health` 200. Süre sınırı 5 dk |
| 10 | Durum dosyasını yaz | `praxura-stand.json`: sürüm, her dosyanın sha256'sı, sonuç (`ok`/`konflikt`/`durak`/`geri_alindi`), zaman, çakışan `.env` anahtarları. `api`'ye `:ro` mount edilir → panel (Faz 2.4 `/status`) bunu gösterir |

`update.log`: `install.log` ile aynı disiplin — sır yok, 5 MB'ta budanır.

**Kendi kendini güncelleme:** `update.sh` de pakettedir. Koşan sürüm önce paketi
senkronlar; kendi dosyası değiştiyse **bir kez** yeni hâlini `exec` eder (döngü koruması:
ortam değişkeni bayrağı). Konteyner olmadığı için bu sorun olmaktan çıkar — J1'in asıl
kazancı budur.

### J6 — Hata ve geri dönüş: **dosya** geri alınır, **sürüm** alınmaz

- Adım 7'nin kapıları başarısız → hiçbir konteyner yeniden yaratılmadı, dosyalar anlık
  görüntüden geri yüklenir. Kutu koşu hiç olmamış gibi çalışmaya devam eder.
- Adım 9 başarısız → dosyalar geri yüklenir, `up -d` tekrar koşar, sağlık **yeniden**
  ölçülür; o da olmazsa kutu bakım moduna düşer ve panelde sebep + son iyi sürüm yazar.
- ⛔ **Güncelleyici image sürümünü geri almaz.** `:stable` hareketli bir etikettir;
  migration koştuysa eski kod + yeni şema = §4.6'nın ikinci satırı, yani yedek işidir.
  Geri alma bizim merkezden yaptığımız iş olarak kalır (§4.6a) — bu betik onu taklit
  etmez. Tek istisna `VERSION_*` satırlarıdır ve onlar da dosya geri alımıyla birlikte
  geri döner; Postgres majör yükseltmesi gibi **geri dönülemez** olanlar zaten adım
  3'ün durak kapısına takılır.
- §4.3'ün göç-öncesi yedeği bu betiğin işi **değildir** — migration runner'ın
  sözleşmesidir (`SCHEMA-VERTEILUNG.md`). İki yerde yapılırsa iki kez alınır.

### J7 — Sıra sorunu yok: **image N, paket N-1 ile çalışmak zorundadır**

Güncelleyici geceleyin tek sırayla koşar, ama yine de bir koşu yarıda kalabilir (elektrik,
disk, çakışma). Kural, expand/contract'ın (§4.7) host tarafındaki karşılığıdır:

> **Bir sürümün image'ı, bir önceki sürümün compose/`.env`'i ile de açılmak zorundadır.**
> Yeni bir env var eklenirse kodda varsayılanı olur; yeni bir mount eklenirse kod onsuz
> da çalışır. Zorunlu hâle gelmesi en erken **bir sonraki** MINOR'dadır.

Bu kural sayesinde "önce image mi geldi, önce paket mi" sorusu ortadan kalkar ve §6.4'ün
*"compose değişirse MAJOR"* cümlesi gevşer: **compose değişikliği artık MINOR'dur**;
MAJOR yalnız J5 adım 3'ün durak listesi için kalır.

### J8 — Kutuda Watchtower yok

Watchtower konteyneri compose'a **hiç girmedi** (bugün yalnız iki `watchtower.enable`
etiketi var, onları izleyen kimse yok — O-73). Girmeyecek de:

- İki güncelleyici = yarış. `up -d` sırasında Watchtower aynı konteyneri yeniden
  yaratabilir; hangi yapılandırmanın kazandığı belirsizdir.
- Watchtower konteyneri **compose'u okumaz** — çalışan konteynerin mevcut yapılandırmasını
  kopyalayıp image'ı değiştirir. Yani yeni compose satırlarını zaten hiçbir zaman
  uygulayamaz. O-45 (b)'nin var oluş sebebi tam olarak budur.
- Docker soketi tutan bir konteyner eksilir → saldırı yüzeyi küçülür.

SaaS VPS'i **değişmez** (orada Watchtower kalır, `api-backend/docker-compose.yml`). G7
ihlali değil: tek codebase, tek image; farklı olan yalnız host'un çalıştırma biçimi.
K11 Watchtower'ı isim olarak şart koşmaz — kanal (`:beta`/`:stable`) korunuyor.
`RELEASE-STANDARD.md` §6.4 tablosu buna göre güncellenecek.

**Zamanlama:** `praxura-update.timer`, `OnCalendar=*-*-* 02:00` + `RandomizedDelaySec=7200`
+ `Persistent=true`. Gece penceresi bilinçli — §6.3'ün "saatlik" önerisi bir praxis için
yanlıştır: kötü bir sürümün **iş saatinde** inmesi, düzeltmenin bir gün gecikmesinden
pahalıdır; kötü sürüme karşı asıl koruma zaten 72 saatlik soak'tur (§6.3 katman 2).
`Persistent=true`: hafta sonu kapalı kalan kutu açılışta telafi eder.
Elle: `bash update.sh --jetzt`. (İleride lisans yanıtına `sofort_aktualisieren` bayrağı
konabilir — Faz 3, **bugün kilitlenmiyor**; G1 açısından temiz, çünkü yük yalnız lisans-ID
+ sürüm + imza taşır.)

### J9 — Faz konumu: **Faz 2.1b'de kalır, `releases.json`'u beklemez**

- Mekanizmanın sürüm listesine ihtiyacı yok: hangi sürüme çıkacağını `.env`'deki kanal
  etiketi (`:stable`) söyler, ne uygulanacağını **image'ın kendi içindeki** `manifest.json`
  söyler. `releases.json` (Faz 2.9 / O-43) **geçmişin** listesidir; durak kararı için
  gereken tek alan (`durak`) paketin kendi manifestinde taşınır. Bağımlılık tek yönlü ve
  gevşek: 2.9 geldiğinde manifest o dosyadan üretilir, betik değişmez.
- ⛔ **Asıl gerekçe zamanlama:** bu betik, **ilk kutu kurulmadan önce** inmek zorunda.
  Bugün kurulu kutu sayısı sıfır. Sonraya bırakılırsa, güncelleyicinin kendisini kutulara
  taşıyacak bir mekanizma olmaz — K10 gereği içeri giremediğimiz makinelerde elle adım
  demektir. Yani bu madde 2.1b'nin **son** maddesi olmakla kalmıyor, 2.1c/2.2'nin de
  önünde duruyor.
- Sonraki fazlara bağı: Faz 2.4 (`/status`) durum dosyasını okur · Faz 2.3 (yedek)
  §4.3'ü runner tarafında sağlar · Faz 3.4 (registry kimliği) ve 4.3b (`:stable`
  etiketi) **olmadan gerçek koşu yapılamaz** — geliştirme ve test yerel image ile
  yapılır, bu bir eksiklik değil, sıralamadır.

### J10 — ★ Kullanıcı kararı: `install.sh` de paketten mi gelsin?

Bugün `install.sh` deponun `onprem/` ağacının müşteri sunucusuna indirilmiş olmasını
varsayıyor (`.env.template` bulunamazsa *"Repository vollständig auschecken"* diyor).
Paket mekanizması kurulduğunda daha temiz bir düzen mümkün:

> Müşteri **tek bir dosya** indirir (`install.sh`). Betik Docker'ı doğruladıktan sonra
> paketi image'dan çıkarır (J2) ve compose/`volumes/`/`.env.template`'i oradan yazar.

Kazancı somut: kurulum ağacı ile image **hiçbir zaman** sürüm kaymasına düşemez (bugün
Temmuz'da indirilmiş bir tarball ile Eylül image'ı yan yana gelebilir), ve `update.sh`
ilk saniyeden itibaren kurulu olur. Bedeli: §7G'nin adım sırası değişir (paket çıkarma
adım 2 ile 5 arasına girer) ve kurulum artık registry erişimine **daha erken** bağlanır.

§7G kilitli bir tasarım olduğu için **bunu ajan tek başına açmaz** — karar kullanıcıda.
Kararın kendisi J1-J9'u değiştirmez; yalnız ilk kurulumun nereden beslendiğini değiştirir.

**Kullanıcı kararı (12.09.2026):** Şimdilik dokunulmadı — `install.sh` bugünkü gibi
`onprem/` ağacından çalışmaya devam ediyor, yalnız `update.sh`/`lib-health.sh`'ı kurma
adımı eklendi. J10 açık kalıyor, ayrı bir karar.

### J1-J9 uygulandı ve gerçek kutuya karşı test edildi (12.09.2026)

**Yazılanlar:** `onprem/lib-health.sh` (install.sh'ın sağlık döngüsünden çıkarıldı,
iki betik de `source` eder — J5 adım 9) · `onprem/update.sh` (~350 satır, J1-J9'un tam
uygulaması) · `onprem/manifest.json` + üretici `tools/onprem-manifest.mjs` (elle
düzenlenmez, sha256'lar diskten hesaplanır) · `api-backend/Dockerfile`'a bundle COPY'leri
(ek build-context `onprem=./onprem`, `docker/build-push-action`'ın `build-contexts`
girdisiyle — `.github/workflows/publish-calendar-api.yml` güncellendi, O-57'nin dersiyle
aynı: bundle dosyaları da o workflow'un `paths:` tetikleyicisine eklendi) · `install.sh`
Schritt 15 (chmod + `.praxura-stand/env.taban.template` + systemd birimleri yazma +
`enable --now`) · `tools/check-onprem.sh`'a O-72 doğrudan kontrolü · iki Watchtower
etiketi kaldırıldı · `RELEASE-STANDARD.md` §6.4 baştan yazıldı.

**Test yöntemi:** gerçek Docker kutusuna karşı, dört sürüm üretilip zincirleme
uygulanarak (yerel registry `localhost:5000`, gerçek `docker pull`/`push` — image'ın
İÇİNDEN bundle'ın çıkıp çıkmadığı sahte değil gerçekten sınandı):

| Senaryo | Sonuç |
|---|---|
| V1 kutu kaldırılıyor, 8/8 healthy | ✅ |
| V1→V2: `docker-compose.yml` değişti, `.env` dokunulmadı | ✅ diff doğru tespit edildi, iki kapı geçti, `up -d`, sağlık, `sonuc:"ok"` |
| V2→V3: yalnız `.env.template`'te `VERSION_KONG` yükseltildi + müşterinin `SITE_URL`'i özelleştirilmiş | ✅ `VERSION_KONG` yükseltildi, `SITE_URL` **dokunulmadan** kaldı (J4 satır 2 ve 3 birlikte) |
| V3→V4: `docker-compose.yml`'e müşteri elle bir satır eklemiş, V4 de aynı dosyayı değiştiriyor | ✅ sapma tespit edildi, `.neu.bekliyor` bırakıldı, güncelleme durdu, kutu **dokunulmadan** sağlıklı kaldı, `sonuc:"konflikt"` |
| `update.sh`'ın kendisi değişince | ✅ tek re-exec, döngü yok |

**Test sırasında bulunan ve düzeltilen dört gerçek hata** (hiçbiri kod okuyarak
bulunamazdı):

1. **`env_wert()`'in awk alan-temizleme hilesi baştaki boşluğu silmiyordu** —
   `$1=""` sonrası `print`, OFS ile `" degeri"` üretiyor (`sub(/^=/,"")` bunu
   yakalayamıyor çünkü artık baştaki karakter `=` değil boşluk). Sonuç: `docker pull`
   `" praxura/api:stable"` gibi geçersiz bir referansla çağrılıyordu, sessizce
   "pull başarısız" diye çıkıyordu. Düzeltme: install.sh'ın zaten kanıtlanmış
   `env_get()` deseni (`sub(/^[^=]*=/,"")`, $0 üzerinde doğrudan) — iki dosyada
   artık aynı desen.
2. **update.sh kendi kendini yazıp çöktü.** İlk sürümde kendi-kendini-güncelleme
   kontrolü Schritt 7'nin (dosya yazma) SONRASINDA duruyordu — ama `update.sh`
   `degisen_dosyalar` listesindeyse Schritt 7 onu zaten yazmış oluyordu, yani o an
   çalışan bash süreci kendi betiğinin baytlarını ayaklarının altından değiştiriyordu
   (`kendi_sha: unbound variable` diye çöktü, betiğin geri kalanı bozuk okundu).
   Düzeltme: kendi-kendini-güncelleme kontrolü artık HER ŞEYDEN ÖNCE (manifest
   okunur okunmaz) — update.sh farklıysa yazılır ve HEMEN `exec` edilir, geri kalan
   her şey (diff, `.env` birleştirme, diğer dosyalar) tamamen YENİ süreçte baştan
   çalışır.
3. **O-72'nin kapısı (hem `check-onprem.sh`'ta hem `update.sh`'ta) canlı veri
   dizinlerini "eksik dosya" sanıyordu** — `volumes/db/data` ve `volumes/storage`
   uzantısız bind-mount'lar, gerçek dosyalar değil dizinler (J2: "dizin kopyalama
   yasak"). İlk yazımda ikisi de `./volumes/...` deseniyle HER kaynağı yakalıyordu;
   düzeltme yalnız bir uzantısı olan (`.sql`/`.yml`/`.sh`) kaynakları sayıyor.
4. **Caddy'nin healthcheck'i kutuda ASLA sağlıklı olamıyordu — O-45 (b)'den bağımsız,
   Faz 2.1b'den (11.09.2026) beri var olan bir hata.** `docker-compose.yml`'in
   `caddy` healthcheck'i `wget http://localhost:2019/config/` çağırıyordu. Container
   içinde `/etc/hosts` "localhost"u ÖNCE `::1`'e (IPv6) çözüyor, Caddy'nin admin
   API'si ise yalnız `127.0.0.1:2019`'a (IPv4) bağlanıyor — wget `::1`'e bağlanmayı
   dener, "connection refused" alır ve IPv4'e **düşmez**. Sonuç: `FailingStreak`
   sınırsız artar, Caddy hep "unhealthy" görünür — ama gerçekte çalışıyordur, isteklere
   cevap veriyordur. Bu bugüne kadar fark edilmedi çünkü compose grafiğinde hiçbir
   servis Caddy'nin sağlığını `depends_on: condition: service_healthy` ile beklemiyor;
   `update.sh`'ın `lib-health.sh` kontrolü bunu gerçekten bekleyen **ilk** mekanizma.
   Düzeltme: healthcheck'te `localhost` → `127.0.0.1`. Gerçek kutuda doğrulandı: V1
   (düzeltmesiz) temiz açılışta gerçekten "unhealthy" kaldı, V2 (düzeltmeli) 8/8
   healthy'e geçti.

**Sonuç:** J1-J9 artık `offen` değil — sicilin yukarısındaki O-45 satırı ve aşağıdaki
O-72/O-73 buna göre güncellendi. Gerçek koşu için hâlâ dışarıda olan iki ön koşul
(§ J9'da yazılı): `:stable` etiketi (Faz 4.3b) ve registry kimliği (Faz 3.4) — o güne
kadar `update.sh` bir kutuda **koşabilir** (test edildi) ama bir customer'ın gerçekten
`docker pull`'layabileceği bir `:stable` etiketi henüz yok.

### Gegenlesen — uygulama okundu, beş eksik bulundu ve kapatıldı (12.09.2026)

> Yukarıdaki testler ileri gitme yolunu (başarı, `.env` birleştirme, sapma tespiti,
> kendi-kendini-güncelleme) doğruladı ama **geri alma yolunu gerçek bir başarısızlıkla
> hiç tetiklemedi** — üç senaryonun hiçbiri gerçekten `sonuc:"geri_alindi"` yaşamadı.
> onprem ajanına ikinci bir okuma turu yaptırıldı, beş gerçek eksik bulundu; hepsi
> düzeltildi ve bu kez **gerçek bir geri almayla** (Kong'a bilinçli bozuk bir eklenti
> adı yazılıp `docker compose up -d`'nin doğrudan başarısız olması sağlanarak) yeniden
> test edildi.

1. **Geri alma yalnız kök dosyaları geri yüklüyordu, alt dizinleri değil.** İlk sürüm
   `for f in "$SNAPSHOT_DIR"/*` + `[ -f "$f" ]` kullanıyordu — anlık görüntü alt dizin
   yapısını koruyordu (`volumes/api/kong.yml` → `$SNAPSHOT_DIR/volumes/api/kong.yml`),
   döngü `[ -f ]` testinde dizini eleyip **atlıyordu**. Sağlık kapısı düşerse compose
   eskiye dönerdi ama Kong'un `kong.yml`'i **yeni (bozuk) hâlinde kalırdı** — J3'ün
   "yarım uygulanmış paket hiç uygulanmamıştan kötüdür" cümlesinin tam yasakladığı hâl.
   Düzeltme: `geri_yukle()` artık `degisen_dosyalar` listesi üzerinden yürüyor (glob
   değil), her yol için snapshot'ta varsa geri kopyalıyor, yoksa (dosya bu turda yeni
   eklenmişse) siliyor.
2. **`.env` anlık görüntüsü birleştirmeden SONRA alınıyordu.** J5'in kendi sırası
   (adım 5 = birleştir, adım 6 = anlık görüntü) bunu yapısal olarak imkânsız
   kılıyordu — bir geri alma zaten YÜKSELTİLMİŞ `.env`'i "eski" diye geri yazardı,
   `up -d` aynı bozuk `VERSION_*`'ı tekrar çeker, ikinci sağlık kontrolü de düşerdi.
   Kusur betikte değil **tasarımdaydı**; düzeltme J5'in sırasını tersine çevirdi:
   anlık görüntü artık `.env` birleştirmesinden ÖNCE alınıyor.
3. **Yeni `.env` tabanı (`env.taban.template`) kapılardan önce yazılıyordu.** Geri
   alma sonrası taban "bunu uyguladık" derdi, oysa uygulanmamıştı — ertesi gece
   `bizim == taban` eşleşir, yükseltme bir daha **hiç** denenmezdi, kutu sessizce
   eski sürümde kalırdı. Düzeltme: `env.taban.template` (ve aşağıdaki 5. maddeyle
   birlikte `dateien-sha.json`) YALNIZ gerçek bir `sonuc:"ok"`'ta güncelleniyor.
4. **`durak`/`konflikt` çıkışları sapma tabanını siliyordu.** Durum dosyası her
   çıkışta küçük, `dateien` alanı olmayan bir JSON'la yeniden yazılıyordu — bir
   sonraki koşu tabanı boş bulur, sapma kontrolünü **atlar**, müşterinin elle
   düzenlediği dosyayı sessizce ezerdi. En ciddi bulgu buydu: bir çakışma, bir
   sonraki koşuda J3'ün asıl korumasını kapatıyordu. Düzeltme, yapısal: sapma
   tabanı artık `praxura-stand.json`'ın İÇİNDE değil **ayrı bir dosyada**
   (`.praxura-stand/dateien-sha.json`) tutuluyor ve YALNIZ `sonuc:"ok"`'ta
   yeniden yazılıyor; `praxura-stand.json` (panel/insan için durum anlık görüntüsü)
   her koşuda yazılır ama `dateien` alanını bu ayrı dosyadan **okuyarak** gömer —
   asla kendi başına üretmez.
5. **`lib-health.sh` `fail()` çağırıyordu, `update.sh` yalnız `fehler()` tanımlıyordu.**
   İsim uyuşmazlığı: `docker compose config --services` boş dönerse
   `fail: command not found` + `set -e` ile, hiçbir log/rollback olmadan çöküş.
   Düzeltme: `update.sh`'a `fail()` eklendi (`fehler()`'i çağırıp `exit 1` eder —
   bu özel durumda geri alınacak bir şey yok zaten, sert çıkış doğru).

**Ayrıca (aynı turda, robustluk):** `docker compose up -d` artık `set -e`'ye
bırakılmıyor — bozuk bir image/etiket komutu doğrudan başarısız kılarsa (yalnız
sağlık kontrolü zaman aşımına uğraması değil), script artık çökmeden aynı
geri-alma+yeniden-dene yoluna düşüyor. **install.sh Schritt 15** artık
`dateien-sha.json`'ı kurulum anında committen `manifest.json`'dan **sağıyor** —
yoksa ilk `update.sh` koşusu hiçbir taban bulamaz (`ilk_kosu=1`), sapma kontrolü o
turda atlanır ve kurulumla ilk güncelleme arasında müşterinin elle yaptığı bir
değişiklik fark edilmeden ezilebilirdi.

**Doğrulama:** Kong'un `kong.yml`'ine bilinçli bozuk bir eklenti adı + aynı anda
`docker-compose.yml`/`.env.template` değişikliği içeren bir "vbad" image üretilip
gerçek kutuya uygulandı: `docker compose up -d` **doğrudan başarısız oldu**
(çökme yerine doğru şekilde yakalandı), geri alma çalıştı — `docker-compose.yml`
**ve** `volumes/api/kong.yml` (alt dizin!) ikisi de doğru geri yüklendi, `.env`'in
`VERSION_KONG`'u yükseltme-ÖNCESİ değerine döndü, `dateien-sha.json`/
`env.taban.template` hiç oluşmadı (ilk koşu olduğu için), kutu 8/8 healthy'e geri
döndü, `sonuc:"geri_alindi"`. Ayrı bir turda gerçek bir başarı da yeniden
doğrulandı: `dateien-sha.json` ve `env.taban.template` yalnız o zaman yazıldı.

### O-72 — Compose'da bind-mount kaynağı yoksa Docker **dizin** yaratır; hata bambaşka yerden gelir

| Alan | İçerik |
|---|---|
| **Ne** | `docker-compose.yml`'deki `./volumes/...` kaynağı host'ta yoksa Docker onu sessizce **boş bir dizin** olarak yaratıp mount eder — dosya beklenen yere dizin olarak girer |
| **Nerede** | `onprem/docker-compose.yml` — 9 bind-mount (`:82`, `:103-107`, `:111`, `:314`, `:363-364`). Bugünkü canlı örnek: O-49'un eklediği `:104` `./volumes/db/no-pg-net.sql` |
| **Tip** | D + G |
| **Kutuda ne olur** | Yeni bir mount satırı taşıyan compose, dosyası henüz yazılmamış bir kutuya varırsa Postgres init `98a-no-pg-net.sql` adında bir **dizin** görür. Hata Postgres'ten, iki dosya öteden ve bambaşka bir yüzle gelir — O-49'un `webhooks.sql` dersinin aynısı. Kurulumun ilk gecesinde, kimsenin bakmadığı saatte |
| **Çözüm** | İki yerde: (1) güncelleyicinin **adım 7 (b) kapısı** — `up -d`'den önce her bind-mount kaynağının diskte **dosya** olarak var olduğu doğrulanır, yoksa geri al ve dur; (2) `tools/check-onprem.sh`'a yeni sayaç: compose'daki her `./volumes/...` kaynağı `manifest.json`'ın `dateien[]` listesinde olmalı — eşleşmezse commit reddedilir. Mekanik, kapının işi (§7) |
| **Durum** | ✅ **gelöst (12.09.2026)** — ikisi de yazıldı ve gerçek kutuya karşı test edildi. ⚠️ İlk yazımda ikisi de **aynı** hatayı yaptı: kaynak listesini uzantısız-dizin ayrımı yapmadan aldılar, `volumes/db/data` ve `volumes/storage` (canlı veri dizinleri) "eksik dosya" sayılıp geri alma tetiklendi — düzeltme: yalnız bir uzantısı olan (`.sql`/`.yml`/`.sh`) kaynaklar sayılır. `tools/check-onprem.sh`'da bu O-72 sayacı olarak, `update.sh`'da adım 7(b) olarak duruyor; ikisi de manuel test edilip doğru dosyayı/dizini ayırt ettiği doğrulandı |

### O-73 — Kurulmuş kutunun **hiçbir** güncelleme yolu yok: Watchtower etiketleri var, izleyen yok

| Alan | İçerik |
|---|---|
| **Ne** | `onprem/docker-compose.yml`'de iki konteynerde `com.centurylinklabs.watchtower.enable=true` etiketi var, ama compose'da **watchtower servisi yok** ve host'ta zamanlanmış hiçbir iş yok |
| **Nerede** | `onprem/docker-compose.yml:466` (`api`) · `:506` (`caddy`) — etiketler. `grep -c watchtower onprem/docker-compose.yml` → 2, ikisi de etiket |
| **Tip** | F |
| **Kutuda ne olur** | Bugün kurulan bir kutu **hiç güncellenmez**: ne compose (O-45 (b)), ne image, ne şema (şema image ile gelir, image gelmezse o da gelmez). Güvenlik yaması dahil hiçbir şey varmaz. Etiketlerin varlığı bunu daha da tehlikeli yapar — belgeye bakan "Watchtower var" sanır. Kurulu kutu sayısı bugün sıfır olduğu için henüz bir müşteriyi etkilemiyor; **ilk kurulumdan sonra etkileyecek** |
| **Çözüm** | §7J — host'ta `update.sh` + systemd timer. Watchtower kutuya **girmez** (J8); etiketler compose'dan çıkarılır ki yanlış izlenim kalmasın. SaaS VPS'i bu maddenin dışında |
| **Durum** | ✅ **gelöst (12.09.2026)** — iki etiket `docker-compose.yml`'den çıkarıldı, `update.sh` + `praxura-update.service`/`.timer` `install.sh`'ın yeni Schritt 15'inde kuruluyor (gece 02:00 + 2 saate kadar rastgele gecikme). SaaS VPS'i (`api-backend/docker-compose.yml`) dokunulmadı, Watchtower orada duruyor |

---

### O-74 — `publish-calendar-api.yml`'in bundle-smoke-test'i kendi kendini reddediyordu: `6347071`'den beri hiçbir `calendar-api` image'ı yayınlanmamış olabilir

| Alan | İçerik |
|---|---|
| **Ne** | İkinci smoke-test adımı 14 dosyalık bir listede dönüyor (13 bundle dosyası + `manifest.json`'ın kendisi) ve her biri için `manifest.json`'ın **içeriğinde** o dosya adının bir dizgi olarak geçtiğini arıyordu (`grep -q "\"$datei\""`). Ama `manifest.json` kendi kendini listelemez — `tools/onprem-manifest.mjs`'in ürettiği `dateien[]` **13** kayıt taşır, `manifest.json` bunlardan biri değildir. Yani döngü `manifest.json` sırasına geldiğinde `grep -q "\"manifest.json\""` **her zaman** başarısız oluyordu |
| **Nerede** | `.github/workflows/publish-calendar-api.yml` — "Smoke test — onprem-Bundle ist im Image" adımı, O-45 (b)'nin (`6347071`, 12.09.2026) parçası olarak eklendi |
| **Tip** | F (yayın hattı) |
| **Kutuda ne olur** | `set -e` altında adım kırmızı çıkıyor, `Build and push` adımı hiç çalışmıyor — yani **hiçbir** `calendar-api` image'ı `6347071`'den bu yana yayınlanmamış olabilir (Actions ekranından doğrulanmadı, kod okumasıyla kesin). En tehlikeli kısmı: hata mesajı doğru göründüğü için ("13/13 dosyayı listeliyor" beklenirken kırmızı çıkması) fark edilmesi CI günlüğüne bakmayı gerektiriyordu, kimse bakmadıysa haftalarca sürebilirdi |
| **Çözüm** | Kontrol ikiye bölündü. (a) **Bundle'da var mı** — `docker cp` ile `/app/onprem-bundle` **tamamı** çekilir (tek dosya değil), 14 dosyanın 14'ü de diskte var mı diye bakılır (bu, Dockerfile COPY listesinin eksikliğini yakalayan O-57 sınıfı kontrol). (b) **Manifest doğru mu** — `manifest.json` **hariç** kalan 13 dosyanın hepsi `dateien[]`'de var mı (`grep`), **ve tersi**: `dateien[]`'de kaç kayıt var, beklenen sayıyla (13) eşleşiyor mu (`grep -oE '"yol"...' \| wc -l`). Ters yön daha önce hiç kontrol edilmiyordu — manifest'te yazıp bundle'da olmayan ya da fazladan/hayalet bir kayıt olsa hiç yakalanmazdı, ve tam da bu sınıf hata `update.sh`'ı kutuda sessizce yanlış bir dosya kümesiyle çalıştırırdı |
| **Durum** | ✅ **gelöst (12.09.2026, O-25 turu, onprem-review'un R0 bulgusu)** — yerelde gerçek bir image build edilip (`docker build --build-context onprem=./onprem`) yeni kontrol mantığı bizzat çalıştırıldı: pozitif yol geçti (14/14 + 13/13); üç negatif senaryo da doğru yakalandı — (1) bundle'dan bir dosya silindiğinde (a) doğru reddetti, (2) manifest'e hayalet bir `"yol"` eklendiğinde sayaç 13→14 farkını yakaladı, (3) manifest'ten gerçek bir kaydı sildiğimde (orijinal hatanın ayna senaryosu) `grep` doğru reddetti. Windows/Git Bash'te `docker cp` dizin kopyalamada sessizce boş sonuç verdi (bilinen ortam kısıtı, gerçek Ubuntu CI'da geçerli değil) — doğrulama PowerShell'e geçilerek tamamlandı |

---

### O-75 — Durak kapısı yalnız hedef sürümü görüyor, aradaki duraklar hiç kontrol edilmiyor

| Alan | İçerik |
|---|---|
| **Ne** | §7J J5 adım 3'ün durak-kapısı (`update.sh`) yalnız **hedef** `manifest.json`'ın `durak` alanına bakıyor. `1.2.0`'daki bir kutu `1.9.0`'a atlarken, aradaki `1.5.0`'da ilan edilmiş bir durak **hiç görülmez** — o bilgi kutunun okuduğu hiçbir dosyada yok, çünkü kutu yalnız hedef image'ın bundle'ını çeker, aradaki sürümlerin manifestlerini görmez |
| **Nerede** | `onprem/update.sh` (durak kontrolü) · `onprem/RELEASE-STANDARD.md` §3.4 Kural 4 ("runner atlamayı reddeder") — bu kural bugün fiilen **uygulanamıyor**, çünkü uygulaması gereken bilgi (aralıktaki duraklar) hiçbir yerde toplanmıyor |
| **Tip** | E |
| **Kutuda ne olur** | Bugün zararsız — §3.4 Kural 3 zaten durak listesinin **boş kalmasını** istiyor (mimarinin kendisi migration'ları sürüm-bağımsız tutuyor, §3.3). Ama bir gün gerçekten bir durak ilan etmek zorunda kalınırsa (istisnai, kabul edilen bir tasarım kırılması), bugünkü mekanizma o duraği **atlar** — kutu sessizce geçer, tam da kuralın önlemeye çalıştığı şey |
| **Çözüm** | O-43/Faz 2.9'un işi: `onprem/releases.json` (geçmiş sürümlerin durak listesi, image'la değil **ayrı bir kanaldan** — ya da bundle'a şimdiye kadarki tüm sürümlerin özet durak bilgisini taşıyan küçük bir ek dosya olarak eklenir). `X.Y.Z`'nin artık var olması (O-25) bu gereksinimi ilk kez **ifade edilebilir** kılıyor — önceden "hangi aralık" sorusunun bile bir cevabı yoktu |
| **Durum** | `offen` (O-43/Faz 2.9'a bağlı, R11 — onprem-review, 12.09.2026). Uygulanana kadar **hiçbir sürüm `durak:true` ilan edilemez** — zaten §3.4 Kural 3'ün istediği şey, burada yalnız mekanik bir hatırlatmaya döndü |

---

### O-76 — `install.sh`'ın kendi anahtar-kanıt testi (Schritt 14) PostgREST'in kök yoluna sorup her zaman 500 alıyordu

| Alan | İçerik |
|---|---|
| **Ne** | Schritt 14, ANON_KEY/SERVICE_ROLE_KEY'in kabul edildiğini kanıtlamak için `${SITE_URL}/rest/v1/` (kök, kaynak belirtilmemiş) yoluna sorguluyordu. PostgREST bu yolda **tüm şemayı** (bizim boyutumuzda: 92 relation, 108 ilişki, 292 RPC) tarayan bir OpenAPI-belge-üretim sorgusu çalıştırıyor — bu, Supabase'in `anon` rolüne **fabrika ayarı olarak gömdüğü** `statement_timeout=3s`'i her seferinde aşıyor |
| **Nerede** | `onprem/install.sh` Schritt 14 (dört `curl` çağrısı — `ohne_key`/`mit_key`/`mit_kaputtem_key`/`mit_service_key`, hepsi aynı kök yolu kullanıyordu) |
| **Tip** | G |
| **Kutuda ne olur** | **`install.sh` gerçek bir kutuda ASLA 16. adıma ulaşamaz** — Schritt 14'te her zaman "Abgeleiteter Schlüssel wird nicht akzeptiert / HTTP 500" hatasıyla durur, hâlbuki anahtar türetmesi (O-60) tamamen doğrudur. Kurulum, doğru çalışan bir kutuyu "anahtar reddedildi" sanıp bloke ediyordu — bu sınıfta en tehlikeli hata türü, çünkü mesaj (`fail()`'in önerdiği "JWT_SECRET değişti mi") teşhisi **yanlış yöne** gönderiyor: gerçek sebep anahtarla hiç ilgili değil, test hedefinin seçimiyle ilgili |
| **Çözüm** | Test hedefi kök yol yerine gerçek, her kurulumda var olan, hafif bir tabloya (`profiles?limit=1`) çevrildi. `anon` RLS nedeniyle boş liste (`[]`) döndürse de HTTP durum kodu (200/401) O-60'ın kanıtlamak istediği şeyi (Kong'un apikey kontrolü + PostgREST'in imza doğrulaması) aynen kanıtlıyor, ama sorgu tek bir tabloyu hedeflediği için OpenAPI-belge-üretimini hiç tetiklemiyor |
| **Durum** | ✅ **gelöst (12.09.2026) — gerçek bir Ubuntu 24.04 + gerçek systemd + gerçek Docker + GHCR'den çekilen gerçek `:beta` image'larıyla kurulan bir kutuda bulundu ve doğrulandı.** İlk tam uçtan uca koşu (WSL2 üzerinde `Ubuntu-24.04` dağıtımı kurularak, `expect` ile gerçek TTY etkileşimi sürülerek) adım 0-13'ü sorunsuz geçti, adım 14'te 500 aldı. Aynı sürekli oturumda beş kez tekrarlanan kök-yol sorgusu **her seferinde tam 3.0 saniyede** aynı `57014`/"statement timeout" hatasını verdi (`pg_roles.rolconfig` ile doğrulandı: `anon` → `statement_timeout=3s`, `authenticator` → `8s`); aynı anda `profiles?limit=1` **~15ms'de HTTP 200** döndü. Düzeltme sonrası **temiz bir `--neu` koşusu 16 adımın 16'sını da tamamladı** — `praxura-update.timer` gerçek systemd'de etkinleşti (`systemctl status` ile doğrulandı), `/login.html` 200, `/api/config` → `istKutu:true`, `/api/setup/status` → `{"verfuegbar":true}`. Bu, §7G'nin baştan beri açık bıraktığı "betiğin tamamı hiçbir Ubuntu kutusunda uçtan uca koşmadı" boşluğunu kapatan ilk gerçek koşudur |

> **Test altyapısı notu:** Bu turda WSL2'ye gerçek bir `Ubuntu-24.04` dağıtımı kuruldu (Docker Desktop'ın kendi iç dağıtımından ayrı, kendi systemd'si + kendi Docker Engine'i ile) — kalıcı, yeniden kullanılabilir bir yerel test ortamı olarak bırakıldı. Ayrıca bu turda öğrenilen bir ortam tuzağı: ayrı `wsl -d ... -- ...` çağrıları arasında dağıtım boşta kalırsa (varsayılan systemd/WSL boşta kapanması) tüm docker compose yığını sessizce yeniden başlıyor — teşhis ve testler bundan sonra TEK bir sürekli oturumda yapılmalı, ayrı komutlara bölünmemeli.

## 7K — Sahipsiz kalmış açık kalemler madde oluyor (12.09.2026 akşamı)

> **Niye bu bölüm var:** aşağıdaki dört işin dördü de 12.09.2026'nın commit
> mesajlarında ya da bir maddenin içinde "açık kalem" diye zaten yazılıydı. Hiçbiri
> gizli değildi — ama hiçbirinin **numarası** yoktu, dolayısıyla §9'da görünmüyor,
> "sıradaki iş" listesine giremiyor ve bir sonraki oturum için **yokturlar**.
> Sicil kural 5: her bulgunun bir sahibi olur — ya faz numarası, ya Ops kartı, ya
> `unkritisch` gerekçesi. Üçü de yoksa madde açılır.

### O-77 — Gece otomatik güncelleme migration'ları yedeksiz koşturuyor; kurulu kutuda **bugün canlı**

| Alan | İçerik |
|---|---|
| **Ne** | `install.sh` Schritt 15 `praxura-update.service`/`.timer`'ı kuruyor (gece 02:00 + 2 saate kadar rastgele gecikme). Zamanlayıcı `update.sh`'ı çağırıyor, o yeni image'ı çekip konteyneri yeniliyor, `api` açılırken `server.js:4536` `runMigrations()`'ı `app.listen()`'den **önce** koşturuyor. Zincirin hiçbir yerinde yedek alınmıyor |
| **Nerede** | `onprem/update.sh` + `onprem/install.sh` — ölçüm: `grep -n "backup\|yedek\|Sicherung\|pg_dump\|dump" onprem/update.sh onprem/install.sh` → **0 eşleşme**. Karşı gereksinim: `onprem/RELEASE-STANDARD.md` §4.3 — "migration çalışmadan önce kutu `vor-<sürüm>` yedeği alır; yedek alınamıyorsa migration **çalışmaz**" |
| **Tip** | F + D |
| **Kutuda ne olur** | Bozuk ya da yarım uygulanan bir migration gecenin bir yarısında, kimse bakmadan koşar. `migrate.js` hata alırsa kutu **bakım moduna** geçiyor (iyi) — ama veri o noktada zaten değişmiş olabilir ve **geri dönülecek bir kopya yok**. O-45 (b)'nin geri alma yolu **dosya** geri alır, **veri** geri almaz (J6, bilinçli tasarım). Hasta verisi kaybolursa § 630f BGB (dokumentasyon yükümlülüğü) ve DSGVO Art. 32 (bütünlük) tarafında da sorun çıkar |
| **Çözüm** | **Faz 2.3** — `update.sh`'a migration-öncesi `pg_dump` adımı + başarısızsa **dur** (image'ı çekme, konteyneri yenileme). O-26 (yedekleme zamanlayıcısı), O-61 (c) (`.env`'in yedekten dışlanması) ve O-29 (c) (`DATA_ENCRYPTION_KEY` olmadan yedeğin işe yaramadığı uyarısı) aynı turun parçası. ⚠️ Ara çözüm olarak zamanlayıcıyı varsayılan kapalı yapmak düşünülebilir ama tercih değil — o zaman kutu hiç güncellenmez (O-73'e geri dönüş) |
| **Durum** | ✅ **gelöst (12.09.2026, dar kapsam — bkz. not) — gerçek kutuya karşı doğrulandı** |

> **Ne yapıldı:** `update.sh`'a yeni bir zorunlu adım (Schritt 8/11, `docker compose up -d`'den hemen önce): `db` konteynerinden `pg_dump -Fc`, `backups/vor-<sürüm>-<zaman>.dump` olarak, 600 izinle, son 5'i tutan rotasyonla. Dump başarısız ya da boşsa `fehler()` + `exit 1` — **ve** (Gegenlesen'de bulunan bir eksik: ilk sürüm burada `geri_yukle()` çağırmıyordu, yani Schritt 7'nin zaten yazdığı/birleştirdiği dosyalar ve `.env` geri alınmıyordu — betiğin kendi "yalnız dosyalar geri alınır" sözü ihlal ediliyordu; düzeltildi, commit `e8160dc`). O-61 (c) tasarım gereği sağlanıyor (pg_dump yalnız DB'yi kapsar, `.env`'e hiç dokunmaz); O-29 (c) başarılı yedek sonrası log satırına eklendi.
>
> **Doğrulama (WSL2 Ubuntu-24.04, gerçek Docker, gerçek GHCR `:beta` image'ı, tek sürekli oturum):**
> - Sağlıklı kutuda: pg_dump başarılı, 1.7 MB dump, `[ok]`/`[warn]` logları doğru — **3 kez** tekrarlandı.
> - `db` durdurulmuşken: pg_dump başarısız, `fehler()` tetiklendi, image'a/konteynerlere hiç dokunulmadı, `sonuc=yedek_basarisiz`.
> - **Gegenlesen fix'i özel olarak doğrulandı:** yedek başarısız olmadan önce `.env`'in sha256'sı alındı, `db` durduruldu, `update.sh --jetzt` çalıştırıldı (`yedek_basarisiz`), sonra `.env`'in sha256'sı tekrar alındı — **byte-özdeş**, `geri_yukle()` doğru çalışıyor.
> - Tam başarı yolu bir kez uçtan uca koşturuldu: yedek alındı → `pull && up -d` → sağlık kontrolü → `sonuc=ok`, 8/8 konteyner sağlıklı.
>
> ⚠️ **Kapsam bilinçli dar — bu O-77'yi TAM kapatmıyor, yalnız en acil parçasını:** yalnız migration-öncesi TEK bir DB dump'ı. **O-26 hâlâ `geplant`**: storage volume arşivi (reçete görüntüleri/DTA/hasta belgeleri `pg_dump`'a hiç girmez), kutu dışı hedef, 14 gün + 12 ay rotasyon, panelde "son yedek", gerçekten test edilmiş `restore.sh` — bunların hiçbiri bu turda yapılmadı. "Son 5 dump, kutu içi" yalnız bir güvenlik ağıdır, kapsamlı bir yedekleme stratejisi değil.
>
> Commit'ler: `0c7c1bc` (backup adımı) · `e8160dc` (Gegenlesen — geri alma eksiği).
>
> ⚠️ **Sonradan fark edilen, itiraf edilmesi gereken bir eksiklik:** bu O-77 turu `onprem/RELEASE-STANDARD.md` §4.3-4.7'yi **koda yazmadan önce OKUMADAN** yapıldı — orada Faz 2.3 için zaten çok daha ayrıntılı bir tasarım kilitliydi ve şimdi yazdığım kod ondan **birkaç yönde sapıyor**:
> 1. **Tetikleyici yanlış.** §4.3: yedek yalnız *"bekleyen migration varsa"* alınmalı — "Bekleyen migration yoksa → doğrudan `listen`... hiç yedek alınmaz, gecikme yok." Benim kodum HER `up -d`'den önce yedek alıyor (bekleyen migration olsun olmasın). Güvenli yönde bir hata (fazla yedek, eksik değil) ama spesifikasyona uymuyor ve gereksiz gecikme/disk yazımı yaratıyor.
> 2. **`backup.meta.json` künyesi yok.** §4.4 beş alan istiyor (`schema_version`, `app_version`+`image_digest`, `taken_at`/`dump_bytes`/`storage_bytes`, `data_key_fingerprint`, `sebep`) — benim kodum yalnız çıplak bir `.dump` dosyası bırakıyor.
> 3. **`data_key_fingerprint` yok.** §4.5 O-29'un TAM kapanışını buna bağlıyor (künyede DEK'in HMAC'i, panelde uyumluluk rozeti, `restore.sh`'ın karşılaştırması). Benim kodum yalnız bir log satırında **uyarıyor**, doğrulanabilir bir künye alanı üretmiyor — yani **O-29 hâlâ kapanmadı**, yalnız insan-okur bir hatırlatma eklendi.
> 4. **Storage arşivi yok.** §4.3 migration-öncesi yedek setinin `pg_dump` + storage arşivini **birlikte** içermesini istiyor; benim kodum yalnız DB.
> 5. **Mimari sapma en önemlisi:** §4.3 açıkça "Faz 2.3'ün gecelik yedeğiyle **aynı kod**, farklı tetikleyici" diyor — yani nightly (O-26) ve migration-öncesi (O-77) yedek AYNI paylaşılan rutini çağırmalı. Benim kodum `update.sh` içine gömülü, tek-kullanımlık bir blok; O-26 düzgün yazıldığında bu blok **genişletilmeyecek, YENİDEN YAZILACAK/yerini paylaşılan bir script'e (`onprem/backup.sh` gibi) bırakacak.**
>
> **Neden yine de commit edildi, geri alınmadı:** zamanlayıcı bugün gerçekten canlı ve yedeksiz migration riski gerçekti — hiç yedek almayan koddan, dar ama çalışan bir yedek alan koda geçmek net bir iyileşme. Ama "O-77 gelöst" etiketi yanıltıcı okunmasın diye buraya açıkça yazıyorum: **gerçek hedef §4.3-4.7'nin tamamı, ve O-26 bunu "ekleme" değil "değiştirme" işi olarak ele almalı.** Bir sonraki oturum bu notu okumadan O-26'ya başlamasın.
>
> **onprem'in bildirim üzerine yaptığı bağımsız denetim (aynı gün) — üç pürüz, ikisi kapatıldı:**
> 1. ✅ **Disk yeri ön-kontrolü eklendi** (`40ffa3b`) — §4.3 madde 4.1: yedekten önce yer kontrolü yoktu, dolu diskte `pg_dump` denemesi Postgres'i de durdurabilirdi (§6.6, yedeksiz migration'dan DAHA KÖTÜ bir sonuç). `pg_database_size` + `df` karşılaştırması, yetersizse migration'a hiç geçmeden dur.
> 2. ✅ **`pg_restore -l` bütünlük testi eklendi** (`40ffa3b`) — "boş değil" testi yarım/kesilmiş bir dump'ı yakalamıyordu. Dosya konteynerin içine kopyalanıp orada listeleniyor (custom-format arşivler stdin'den `-l` çalışmıyor — gerçek kutuda denendi, doğrulandı).
> 3. ⚠️ **`yedek_basarisiz` bugün kimseye görünmüyor — kendi maddesi O-82'ye taşındı** (sicil kuralı 5: sahipsiz madde bırakılmaz). `praxura-stand.json`'ı okuyacak panel Faz 2.4'te, yani henüz yok. Sonuç: `db` sağlıksızsa kutu **her gece sessizce güncellenmeyi bırakır** ve kimse fark etmez (O-73'ün başka bir kapıdan geri dönüşü — tıpkı O-81 gibi). onprem bunu "kalanların en ciddisi" diye işaretledi.
>
> onprem G1/G2/G3/G8 denetimi: **dördü de geçti** (`docker compose exec -T db pg_dump ...` — dump kutu içinde kalıyor, sır komut satırında yok, dış zincir yok). İleriye dönük not: O-26'da "Praxura bulutuna yedek" seçeneği gündeme gelirse o **G1 sert vetodur**, tartışılmaz.

---

### O-78 — ICD-10-GM pakete girdi ama § 63 UrhG'nin istediği atıf satırı hiçbir yerde yok ✅ **gelöst (12.09.2026)**

| Alan | İçerik |
|---|---|
| **Ne** | `0013_seed_icd10_titles.sql` 16.905 satır ICD-10-GM başlığını image'a koyuyor. `legal-de` dağıtım hakkını doğruladı (BfArM Downloadbedingungen, § 5 Abs. 2 UrhG "anderes amtliches Werk" — ticari yeniden dağıtım dahil), **iki şartla**: § 62 Änderungsverbot (uyuldu, başlıklar aynen) ve **§ 63 Quellenangabe**. İkincisi bugün yalnız migration dosyasının başlık yorumunda — müşterinin **hiçbir zaman görmediği** bir yerde |
| **Nerede** | `api-backend/db/migrations/0013_seed_icd10_titles.sql` (başlık yorumu) + ✅ `onprem/NOTICE-QUELLEN.txt` (yeni, 12.09.2026). Eksik kalan: Dashboard'da tek satırlık atıf |
| **Tip** | G (paket içeriği) |
| **Kutuda ne olur** | Bugün hiçbir şey — ihlal **teslimatla** doğar, ve henüz canlı müşteri yok (memory: `project_no_live_customer_yet`). Dashboard satırı olmadan ilk teslimatta doğardı |
| **✅ Yapılan (12.09.2026)** | `onprem/NOTICE-QUELLEN.txt` yazıldı — `NOTICE.md`'nin (yazılım lisansları) **veri** kardeşi. `legal-de`'ye danışıldı, iki düzeltme çıktı: **(a)** bu maddenin ilk yazımı "Heilmittel-Preisstammdatei" diyordu — **YANLIŞ**. `heilmittel_tarif`'in gerçek kaynağı zinciri sürüldü (`seed_tarifs.js` → `billing/codes/physio_positions.js` başlığı): **Anlage 2 zum Vertrag § 125 SGB V Physiotherapie** (Stand 01.12.2025). Heilmittelpreisstammdatei (wissensbank Z-06) yalnız **çapraz doğrulama** — kendi Haftungsausschluss'u "nicht zu Abrechnungszwecken" diyor; kaynak olarak gösterilseydi hem yanlış Herkunft hem "bu amaçla kullanılamaz" diyen bir kaynağı kaynak gösterme hatası olurdu. **(b)** iki kaynak yerine paketin gerçekte gömdüğü **beş** kaynağın hepsi eklendi (O-38'in 8 seed tablosunun kapsadığı): ICD-10-GM (BfArM) · Kostenträgerdatei (GKV-Spitzenverband) · Physiotherapie-Vergütung (Anlage 2 §125) · Heilmittel-Richtlinie/Diagnosegruppen (G-BA) · Podologie-Katalog (Anlage 2 Podologie + HeilM-RL). `krankenkassen` bilinçli dışarıda — verisi "doğrulanmamış" kaynaktan, resmî bir eser/veritabanı değil. Kostenträgerdatei + Anlage 2 §125'in ticari ürüne gömme hakkı hiç analiz edilmemişti — `legal-de` şimdi yaptı: Werkschutz yok (Kostenträgerdatei, salt Tatsachen) + bestimmungsgemäße-Nutzung savunması; Anlage 2 §125 ICD-10-GM'yle aynı § 5 Abs. 2 UrhG sınıfında. §§ 87a ff. sui-generis Datenbankherstellerrecht sorusu EuGH'de açık (BGH evet, OLG Köln hayır) — bilinçli risk kabulü olarak `compliance/LEGAL_DECISIONS.md`'ye işlendi (12.09.2026 satırı + Risikoakzeptanz tablosu) |
| **✅ Dashboard satırı de eklendi** | `fonksiyon-ustasi`'ya soruldu: settings ekranının alt-sekmesi yok, tek düz sayfa (`dashboard.html:2487`, `loadSettings()`). Öneri: yeni modül/fonksiyon YOK, `dashboard.html`'e statik blok yeter (durağan metin, veri çekmiyor) — "Integrationen & Datenschutz" grubuna, DSGVO bölümünün hemen ardına (`dashboard.html:2887-2907` civarı), yeni `#settingsQuellenSection` kartı. `dashboard.js` BÜYÜMEZ kapısı yalnız `.js`'i sayıyor (`tools/check-dashboard-size.sh`), `.html`'e dokunmak ihlal değil. i18n YOK — güncel desen (06-09.09.2026'da eklenen tüm settings kartları) sabit Almanca, ayrıca özel adlar (BfArM/G-BA/GKV-Spitzenverband) çevrilirse atıf zayıflardı. ⚠️ Ayrıca **O-42'nin kapsamı genişledi**: lisans yüzeyi artık yalnız konteyner image'ları değil **dağıttığımız veri**; `onprem_image` sayacı bunu görmez (ayrı madde, bu turda açılmadı) |
| **Durum** | ✅ `gelöst` (12.09.2026) — `onprem/NOTICE-QUELLEN.txt` + `dashboard.html` satırı ikisi de indi. Kaynağı: O-38 turunun kendi açık kalem listesi (1) |

---

### O-79 — `heilmittel_katalog`'un besleme zinciri kapısız: kod değişir, kutudaki veri değişmez ✅ **gelöst (13.09.2026)**

| Alan | İçerik |
|---|---|
| **Ne** | `heilmittel_katalog` (94 satır) `search_heilmittel()`'in **tek** kaynağı ve `billing/codes/*.js`'ten `sync_heilmittel_katalog.js` ile besleniyor — ama o betik SaaS'ta **elle** koşuyor. Kod değişip betik koştuğunda `0012_seed_heilmittel_katalog.sql` **otomatik güncellenmez**, ve uygulanmış migration dosyası **değiştirilemez** (runner SHA-256 tutar). Kutuya varmanın tek yolu **yeni** bir seed migration'ı — ama bunu hatırlatan hiçbir şey yoktu |
| **Nerede** | `api-backend/billing/codes/*.js` → `sync_heilmittel_katalog.js` → `api-backend/db/migrations/0012_seed_heilmittel_katalog.sql`. Kapı: `tools/check-onprem.sh` (yeni "Seed-besleme kapısı") |
| **Tip** | B + D |
| **Kutuda ne olur** | Sessiz sapma: SaaS'ta düzeltilen bir Heilmittel kodu/fiyatı kutuda eski kalır. `onprem-review` (13.09.2026) ölçtü: bu tablo **resolvePreis()'te hiç okunmuyor** (`resolver.js:72-87`), yalnız seçici/rozet metni besliyor — etkisi düşük (fatura yine doğru çıkar, sadece rozet eski görünür). Asıl yüksek-etkili fiyat otoritesi ayrı bir tabloda çıktı, bkz. **O-96** |
| **Çözüm** | `tools/check-onprem.sh`'a insan-commit yolu için bir kapı eklendi: `billing/codes/*_positions.js` staged ise ve aynı commit'te `api-backend/db/migrations/` altına yeni bir seed dosyası girmediyse commit reddedilir (kaçış: `SKIP_SEED_GATE=1`). `preise-check.yml`'in otomatik CI commit'i bu kapıyı görmüyor — bu ayrı bir madde: **O-95** (düşük etkili olduğu için ayrı, ertelenebilir) |
| **Durum** | ✅ **gelöst (13.09.2026)** — kapı yazıldı ve gerçek testle doğrulandı: pozisyon dosyası migrationsuz staged edilince reddediyor, migrationlıyken geçiyor, `SKIP_SEED_GATE=1` ile geçiyor. `onprem` ajanı koda karşı doğruladı (heilmittel_katalog'un para yoluna girmediğini teyit etti). CI-yolu boşluğu (O-95) ve kazı sırasında bulunan asıl fiyat-otorite sorunu (O-96) ayrı maddeler olarak açıldı |

---

### O-80 — `dta_schluessel` seed dışında kaldı: bilinçli, ama süresiz ✅ **gelöst (13.09.2026) — plan gkv-302 doğrulamasıyla değişti**

| Alan | İçerik |
|---|---|
| **Ne** | O-38'in sekiz tablosuna `dta_schluessel` (94 satır) **girmedi**: `source_version` alanı "Anlage 3 V22" diyor, geçerli sürüm **V21**. Orijinal plan: (1) etiketi düzelt, (2) seed migration'ı yaz. `gkv-302` her ikisini de sorguladı |
| **Nerede** | `db/SCHEMA.sql` → `dta_schluessel` (bilinçli olarak migration zincirinde yok) · gerçek DTA-üretim kodu: `api-backend/billing/codes/anlage3_v22.js` |
| **Tip** | D |
| **Kutuda ne olur** | Hiçbir zaman bir şey olmadı ve olmayacak — `gkv-302` V21↔V22 tam metin karşılaştırmasıyla doğruladı: **tüm Anlage 3'te tek içerik farkı** §8.1.5.1 (Haushaltshilfe C1–C4), Heilmittel'e hiç dokunmuyor. Yani seed'in 94 satırı V21 VE V22 altında aynı anda doğru — "yanlış etiketle yanlış veri" riski hiç var olmamış. `dta_schluessel` tablosu zaten hiçbir kod yolundan okunmuyor (O-38'de doğrulanmıştı, bu turda tekrar doğrulandı) |
| **Çözüm** | **Plan değişti: seed YAZILMAYACAK.** `gkv-302`'nin gerekçesi: okuyan hiçbir kod yolu yok, `source_version` unique key'in parçası — yanlış/gereksiz bir etiketi checksum-kilitli bir migration'a gömmek yerine tabloyu migration zincirinin dışında bırakmak (mevcut, bilinçli karar) doğru duruyor. Bunun yerine **gerçek bulgu** başka yerdeydi: DTA'yı fiilen üreten `anlage3_v22.js`'in dosya adı/başlığı yanıltıcıydı ("V22, gültig ab 01.02.2027" diyordu, ama içerik her iki sürümde geçerli) ve bir yorum satırı var olmayan `anlage3_v22_full.json`'a atıf yapıyordu |
| **Durum** | ✅ **gelöst.** `anlage3_v22.js`'in başlığı + `ABRECHNUNGSCODE`'un kısaltma yorumu + `TARIFBEREICH`'in eksik `50-64` aralığı hakkındaki yorum düzeltildi (dosya adı bilinçli olarak DEĞİŞTİRİLMEDİ — 4 import + `legs.test.js` ona bağlı, içerik zaten her iki sürümde doğru olduğu için aciliyet yok). `billing/codes/README.md`'nin aynı yanıltıcı atfı da düzeltildi. `wissensbank/SPEC-RULES.md`'ye iki kalıcı kural eklendi: "Anlage 3 V21→V22 tek fark Haushaltshilfe" ve "`dta_schluessel` DTA üretimini beslemez". Canlı DB'deki `source_version` etiketi bilinçli olarak DÜZELTİLMEDİ — kimse okumuyor, düzeltmenin riski (yanlışlıkla iyi durumda bir kaydı bozma ihtimali) faydasından yüksek |

---

### O-81 — `update.sh` kendi kendini güncelledikten SONRA aynı gece kendi sapma-kontrolüne takılıyordu — otomatik güncellemeyi KALICI olarak durdurabilirdi

| Alan | İçerik |
|---|---|
| **Ne** | `update.sh`'ın "Kendi kendini güncelleme" bloğu (§7J/J5 sonu) dosyayı KOŞULSUZ yazıp re-exec ediyor — bu doğru ve bilinçli. Ama hemen ardından çalışan genel sapma-kontrolü (Schritt 4/5, J3) `update.sh`'ı da **aynı** "bizim dosyalar" listesine dahil ediyordu. Bu döngü `mevcut_sha`'yı (disk'te, self-update SONRASI — yani her zaman YENİ) `taban_sha`'yla (bir önceki BAŞARILI koşudan kalma — yani her zaman ESKİ) karşılaştırıyor; `update.sh`'ın içeriği iki başarılı koşu arasında değiştiği HER durumda ikisi farklı çıkıyor ve "müşteri elle değiştirmiş" sanılıyordu — oysa kimse dokunmamıştı, tam tersine biz KENDİMİZ az önce güncellemiştik |
| **Nerede** | `onprem/update.sh` — Schritt 4/5 döngüsü (`.env.template` için zaten var olan istisnaya benzer bir istisna `update.sh` için YOKTU) |
| **Tip** | F (fonksiyonel — otomatik güncelleme mekanizmasının kendisi) |
| **Kutuda ne olur** | `update.sh`'ın kendi içeriği iki gece arasında değişen HER sürümde (ki bu hafta içinde üç kez oldu) o gece `sonuc=konflikt` çıkar, güncelleme **tümden durur**, kutu eski sürümde kilitli kalır. En kötüsü: sonraki gece de aynı şey — çünkü hiçbir "ok" koşusu olmadan taban hiç güncellenmiyor. **Kutuyu asla güncellemeyen** bir sonsuz döngü (O-73'ün "kutu hiç güncellenmez" sorununun farklı bir kapıdan geri dönüşü), tamamen sessiz — panelde görünmüyor (O-82 ile aynı görünürlük boşluğu) |
| **Çözüm** | `update.sh`'ı, `.env.template` gibi, genel sapma-kontrolü ve sha-kaydı döngülerinin **her ikisinden de** hariç tut — kendi içeriği zaten yukarıdaki özel mekanizmayla korunuyor/güncelleniyor, ikinci bir (ve çelişen) kontrole ihtiyacı yok. Bilinçli sonuç: `update.sh` artık **geri alınmaz** (`geri_yukle()` dokunmaz) — bu istenen davranış, çünkü bu gecenin arızası `update.sh`'ın kendisindeyse yarınki deneme yine YENİ (düzeltilmiş) koddan koşmalı, eskiye dönmemeli |
| **Durum** | ✅ **gelöst (12.09.2026, aynı tur — O-77'nin disk/pg_restore eklerini gerçek kutuda test ederken bulundu) — gerçek kutuda hem hata hem düzeltme doğrulandı** — commit `58aa6cb` |

> **Doğrulama (WSL2 Ubuntu-24.04, gerçek Docker, gerçek GHCR image'ları, tek sürekli oturum):**
> - **Hata, gerçek kutuda tetiklendi:** `e8160dc`→`40ffa3b` geçişinde (update.sh içeriği gerçekten değişti) `sonuc=konflikt`, `catisma_dosyalari: update.sh` — güncelleme tümden durdu.
> - **Düzeltme sonrası aynı sınıf geçiş (`40ffa3b`→`58aa6cb`, update.sh yine değişti) temiz çalıştı:** self-update tetiklendi ("update.sh kendisi değişti — yazılıp yeniden başlatılıyor"), ardından **hiçbir sapma uyarısı yok**, doğrudan `[4-7/11] Değişen dosyalar: install.sh` → backup (O-77'nin yeni disk-kontrolü + `pg_restore -l` bütünlük testi ikisi de sessizce geçti, 1.7 MB yedek) → `pull && up -d` → sağlık → **`sonuç: ok`, 8/8 healthy**. Tek koşuda üç ayrı düzeltmenin (O-81 + O-77'nin iki eki) birlikte doğru çalıştığının kanıtı.

---

### O-82 — `update.sh`'ın hiçbir `dur` dalının kutu dışına bildirimi yok — sicil kuralı 5'in kendisi bunu istiyor 🟡 **kısmen gelöst (13.09.2026)**

| Alan | İçerik |
|---|---|
| **Ne** | Bu turda **iki bağımsız örnek** aynı arıza sınıfını gösterdi: O-77(3) (`yedek_basarisiz` panelde görünmüyor) ve O-81 (eski hâliyle `konflikt`, kalıcı sessiz kilitlenme). İkisinin de ortak deseni: `update.sh` doğru kararı veriyor (dur, dokunma) ama bu kararı **hiç kimseye söylemiyor**. Faz 2.4'e (panel) kadar `praxura-stand.json`'ı okuyan hiçbir şey yok — kutu, gecelerce sessizce güncellenmeyi bırakabilir ve müşteri de biz de fark etmeyiz |
| **Nerede** | `onprem/update.sh` — `durumu_yaz()`'ın yazdığı her `sonuc` (`durak`/`konflikt`/`geri_alindi`/`bakim_modu`/`yedek_basarisiz`) yalnız `update.log` + `praxura-stand.json`'a düşüyor, ikisini de bugün kimse okumuyor |
| **Tip** | F (görünürlük — panel yokluğunda tek gerçek kanal) |
| **Kutuda ne olur** | Faz 2.4'e kadar yazılacak her yeni "dur" dalı aynı sessiz-arıza sınıfına katılır — üçüncüsü, dördüncüsü de aynı şekilde görünmez kalır. İki örnek zaten bir desen: bu numara olmadan bir sonraki "dur" dalı yazan kişi aynı boşluğu üçüncü kez keşfeder (sicilin kendi "sahipsiz madde" dersi, bugün başka üç maddede zaten yaşandı — §7K) |
| **Çözüm** | onprem'in önerisiyle **ucuz ara kanal** uygulandı: `durumu_yaz()`'ın her çağrısında `bildirim_degerlendir()` çalışıyor. `update.sh` zaten `docker compose exec -T db psql ...` deseniyle konteyner içine giriyordu (migration kontrolü, satır ~467); aynı desen `api` konteynerine uygulandı: yeni `api-backend/setup/update-alarm-mail.mjs`, `docker compose exec -T api node setup/update-alarm-mail.mjs <sonuc> <email> <isim>` ile çağrılıyor, `lib/mail.js`'in `createSMTPTransport()`/`getMailFrom()`'unu ve O-66'nın `praxura_setup.owner_user_id → profiles.email` zincirini (setup/router.js'in `/test-smtp`'iyle BİREBİR aynı desen) kullanıyor. Yeni env var yok, yeni dış servis yok, yeni network endpoint yok (HTTP değil, `docker exec`/`docker run`) — G1/G2/G8 temiz. Üç açık tasarım kararı onprem'le netleşti: (1) **sıklık** — durum değiştiğinde hemen, aynı durum sürerse 7 günde bir hatırlatma, `ok`'a dönüşte Entwarnung; başarısız gönderim denemesi zamanlayıcıyı ilerletmiyor (bir sonraki koşuda hemen tekrar dener) — 8 senaryoluk izole bash testiyle doğrulandı, bu süreçte bir gerçek mantık hatası da yakalandı ve düzeltildi (durum değişiminde eski zaman damgası sıfırlanmıyordu, yanlışlıkla susturuyordu). (2) **owner adresi** — `.env` değil `profiles` (kutu tek kiracılı, DB her zaman güncel); psql ile okunup `$STAND_DIR/owner-bilgi.json`'a önbelleklenir — mail script'i DB'ye hiç bağlanmaz, hep önbelleği kullanır (`bakim_modu`'da DB de düşmüş olabilir). ⚠️ **Onprem-Gegenlesen bulgusu (13.09.2026):** ilk sürümde önbellek yalnız `sonuc=ok` sonrasında dolduruluyordu — kutunun İLK gecelik koşusu başarısız olursa (`konflikt`/`yedek_basarisiz`) önbellek hiç yaratılmamış olurdu, alarm hiç kuramaz, kutu takılı kaldıkça bir daha `ok` da gelmez → kısır döngü, tam O-82'nin önlemeye çalıştığı sınıf. Düzeltildi: `owner_bilgisini_guncelle` artık Schritt 3'ten (ilk `durumu_yaz` çağrısı) hemen ÖNCE de çağrılıyor, DB henüz dokunulmamışken. (3) **metin** — sabit şablon + sonuç + sürüm + zaman, log kuyruğu/dosya içeriği yok (G1 hijyeni). `exec` başarısız olursa (api container sağlıksız, tam da `bakim_modu`'da beklenen durum) `docker compose run --rm --no-deps --pull never api ...` ile imajdan tek seferlik konteyner denenir — `--pull never` şart: `run` varsayılan olarak önce dışarı çıkmayı dener, internetsiz kutu (bakim_modu'nun en olası eşlikçisi) bu yüzden burada da takılırdı |
| **Bilinen iki sınır (düzeltme değil, bilinçli kayıt)** | (a) `timeout 30` tetiklenirse `--rm` temizliği istemci tarafında kalır — geride çıkmış (exited) tek-seferlik bir konteyner birikebilir, `docker compose up`'ın `--remove-orphans`'ı bunu temizlemez (`api` tanımlı bir servis). Zararsız ama altı ay sonra "bu konteynerler ne" diye sorulur. (b) Başarısız bir Entwarnung (sonuc=ok mail atamazsa) tekrar denenmiyor — bir sonraki koşuda `eski_sonuc=="ok"` olduğu için sessiz kalınır. Hata yönü güvenli (owner gereksiz yere endişelenmez, yanlış huzur da duymaz) — bilinçli kabul edildi |
| **Durum** | 🟡 **kısmen gelöst (13.09.2026)** — kod yazıldı, `bash -n` + izole mantık testi (8/8 senaryo) + `update-alarm-mail.mjs`'in üç davranışı (SMTP yok→sessiz çık, kötü SMTP→hata yakala exit 1, eksik argüman→sessiz çık) gerçek çalıştırmayla doğrulandı, `onprem/manifest.json` yeniden üretildi (bu arada `install.sh`/`restore.sh`'ın da hash'lerinin bayat olduğu ortaya çıktı — içerik değişmemiş, önceki manifest hiç güncellenmemiş, bu regen düzeltti). **Gerçek kutuda henüz test edilmedi** (gerçek SMTP + gerçek `bakim_modu` senaryosu gerektirir — WSL test kutusunda bir sonraki turda yapılmalı). **Kapsam sınırı, sicile bilerek yazılıyor:** `SMTP_HOST` boş bırakılan kutularda (install.sh SMTP adımını atlamaya izin veriyor, O-66) bu kanal da yok — o kutularda O-82 hâlâ tam anlamıyla açık, tek gerçek kapanışı Faz 2.4'ün paneli |

---

### O-83 — `api` konteynerinde `mem_limit` yok; VPS'te swap da yok — OOM kill migration'ın ortasında yakalayabilir ✅ **gelöst**

| Alan | İçerik |
|---|---|
| **Ne** | O-48 (Kong konsey kararı) yalnız Kong'a `mem_limit` verdi (886 MB ölçüm tartışmasının konusu oydu). `api` konteyneri (`pm2-runtime -i 2`, iki işçi) hâlâ sınırsız — sınırsız bir konteyner bellek basıncında kernel'in OOM-killer'ı tarafından **beklenmedik bir anda** öldürülebilir, tam bir migration'ın ya da `backup.sh`'ın `pg_dump`'ının ortasında olabilir |
| **Nerede** | `onprem/docker-compose.yml` → `api` servisi · `api-backend/Dockerfile` → CMD |
| **Tip** | F (dayanıklılık) |
| **Kutuda ne olur** | O-26 bildirim-sonrası denetiminin bulduğu şey tam bu: bir PM2 işçisi (OOM-kill dahil) yeniden başlarsa `runMigrations()` sessizce tekrar tetiklenir. `backup.sh`'ın önce/sonra `schema_version` kontrolü (O-26 turunda eklendi) bu durumu yakalar ve yedeği iptal eder — ama asıl kararlılık sorunu (neden bir işçi hiç yeniden başlıyor) o başlı başına çözülmüş olmuyordu |
| **Onprem-danışma (13.09.2026) — plan değişti** | İlk plan tek `mem_limit` koymaktı; onprem sert şekilde düzeltti: **Node kendi başına Docker'ın cgroup sınırını görmez** — `mem_limit` tek başına koyulursa V8 varsayılan heap'i host RAM'ine göre büyür, kernel'in SIGKILL'i **rastgele bir anda** vurur, önlenmiş olmaz. Doğru sıra üç katman: (1) `--max-old-space-size` — V8 heap, işçi başına (2) PM2 `--max-memory-restart` — RSS, işçi başına, aşılırsa PM2 SADECE o işçiyi temiz yeniden başlatır (3) `mem_limit` — son çare, günlük işte hiç tetiklenmemeli. Ayrıca: `docker inspect`'in `OOMKilled` alanı bu arıza sınıfında **kör** — OOM-killer konteyneri değil cgroup içindeki en şişman süreci (bir PM2 işçisini) seçer, PM2 sessizce yeniden doğurur, container hiç yeniden başlamaz, `OOMKilled` hep `false` kalır. Kanıt aranacaksa `pm2 list`'in ↺ sütunu veya kernel `dmesg`/`journalctl -k` — konteynerin kendi durumu değil |
| **Ölçüm (gerçek kutu, tahmin değil)** | WSL-Testbox (Ubuntu 24.04, gerçek Docker Engine), tek sürekli oturumda (ayrı komutlar arası WSL'in VM'i boşta kapatıp bir sonraki çağrıda soğuk açtığını — ve bunun konteynerleri `restart: unless-stopped` ile sıfırdan başlatıp yanlış "her ölçümde restart oluyor" izlenimi verdiğini — bu turda keşfettik, script tek `wsl` çağrısına toplanarak düzeltildi). İlk deneme yanlış path'e (`/rezept/upload`, `/api` öneki eksik) POST attı — `server.js:83-86`'daki 256 KB ön-kapı `/api/rezept/` dışındaki her yolu Content-Length'e bakarak erkenden 413'lüyor, gerçek gövde hiç parse edilmedi. Doğru path (`/api/rezept/upload`, `requireAuthAI` arkasında ama body-parse ondan ÖNCE global `express.json` ile oluyor, o yüzden 401 alınsa da gövde tam işleniyor) + gerçek üst sınır (~15 MB, `server.js:89`) ile: boşta konteyner ~200-296 MB (cgroup `memory.current`/`.peak`), 2 işçiye eşzamanlı 15 MB istek dalgalarıyla işçi başına RSS **~295 MB**'a çıktı, konteyner tepesi **544 MB** |
| **Uygulanan üç katman** | `api-backend/Dockerfile` CMD: `pm2-runtime start server.js -i 2 --max-memory-restart 500M --node-args "--max-old-space-size=256 --import ./instrument.js"` · `onprem/docker-compose.yml` → `api`: `mem_limit: 1200m`. 500M (işçi RSS) ölçülen 295 MB tepenin ~1,7 katı — günlük işte tetiklenmemeli ama gerçek bir sızıntıyı yakalar. 1200m (konteyner) iki işçinin aynı anda 500M'a yaklaşması + pm2 daemon + page cache payını kapsar. Hedef donanım `install.sh`/`RELEASE-STANDARD.md`'nin ilan ettiği **2 vCPU/4 GB** müşteri kutusu — bizim 3,7 GB'lık VPS'imiz değil |
| **Doğrulama (gerçek kutu)** | Değişiklik `api-backend/Dockerfile`'ı da etkilediği için (aynı imaj SaaS VPS'inde de koşuyor) push'tan önce yerel build ile test edildi: WSL'de `docker build` (onprem-bundle build-context olmadan, sadece runtime davranışı için — buildx bu kutuda yok), imaj `docker compose up -d --force-recreate api`'ye geçici olarak bağlandı. `ps aux` içeride üç bayrağın da gerçekten `pm2-runtime`'a ulaştığını doğruladı. `docker inspect` → `MemLimit=1258291200` (1200 MiB, doğru). 10 dalga × 2 eşzamanlı ~15 MB istek (ölçümdekinden daha ağır) sonunda: işçi RSS'leri 221-252 MB (500M eşiğinin altında, ↺=0 — yanlış-pozitif restart yok), konteyner tepesi 588 MB (1200m limitinin yarısı, bol pay), `OOMKilled=false`, `RestartCount=0`, ardından `/health` normal cevap verdi. Guardrail'lerin normal (hatta ağır) trafiği bozmadığı, gerçek pay bıraktığı doğrulandı |
| **Bilinçli sınır** | PM2'nin `--max-memory-restart`'ının fiilen tetiklendiği (500M'ı gerçekten aşan bir işçi) bu turda üretilmedi — 20 isteklik ağır test bile 252 MB'da kaldı, yani eşiğin gerçek trafikte bol payı var. PM2'nin kendi bayrağının çalıştığını ayrıca kanıtlamak (üçüncü parti, köklü bir özellik) kapsam dışı bırakıldı. Ayrıca bu ölçüm WSL'de (swap'li) yapıldı — footprint/eşik kararı için geçerli (onprem onayladı), ama "gerçekten ölür mü" testi swap'siz gerçek donanım gerektirir, yapılmadı |
| **Onprem bildirim-sonrası denetimi (12.09.2026) — iki ek bulgu** | (1) **Eşik "işçi başına aynı anda 1 ağır istek" varsayımına bağlı, sicilde yazılı değildi.** Ölçüm 2 eşzamanlı istek / 2 işçiydi. Gerçekte bir işçiye aynı anda 2 ağır gövde düşerse RSS kabaca ikiye katlanıp ~500M'a, yani tam eşiğe gelir — PM2 o işçiyi yeniden başlatır, aynı işçideki diğer meşru isteği de düşürür (yanlış-pozitif). Kapatması ucuz (aynı kutuda 6-8 eşzamanlı bir tur, tepe 350 MB'ı aşarsa eşik 500M→700M), ilk **ücretli** kutudan önce, `restore.sh`'tan sonra yapılacak. (2) **Katman sırası saf-JS büyümede tersine dönüyor.** Dockerfile yorumu "2. katman 1.'nin göremediğini yakalar" diyor — doğru, ama eksik olan tersi: 1. katman **yumuşak değil**. Saf JS heap sızıntısında heap 256'ya dayanır → `FATAL ERROR: Reached heap limit` → SIGABRT; o an RSS tipik olarak 350-400 MB, yani 500M eşiğinin altında — PM2'nin temiz restart'ı **hiç devreye girmez**, worker sert biçimde ölür (yine de kernel SIGKILL'inden iyi, `pg_advisory_lock`+SHA arkada korur). Destek tanısı için: `docker logs`'ta `Reached heap limit` satırı, `pm2 list` ↺ sütunu — `OOMKilled=false` ve konteyner restart'ı YOK göreceksin, bu normal, OOM sanma |
| **Yan bağ** | Bu maddenin çözümü O-26'nın tetikleyicisini artırır (her PM2 yeniden başlatması `runMigrations()`'ı tekrar koşturur) — güvenlik `migrate.js:197-201`'deki `pg_advisory_lock` + SHA kontrolünden geliyor, yarış korunuyor (onprem doğruladı) |
| **Durum** | ✅ **gelöst (12.09.2026)** — `api-backend/Dockerfile`, `onprem/docker-compose.yml`, `onprem/manifest.json` (yeniden üretildi). SaaS tarafının aynı korumayı almadığı bulgusu ayrı bir madde oldu → **O-84**. Kaynağı: O-26 bildirim-sonrası denetimi (onprem, 13.09.2026) — künye tutarlılık bug'ını (`88ec23c`) ararken bulundu |

| **Tanı notu (09.10.2026, O-179)** | pm2 artık yok (`d1a0bf70`). Yukarıdaki "`pm2 list` ↺ sütunu" ve "PM2 o işçiyi yeniden başlatır" ifadelerinin karşılığı bugün `api-backend/start.mjs`: RSS > 500 MB → `[start] … Worker N RSS … MB > 500 MB — kontrollierter Neustart (O-83)` (`:73`), her çıkış → `[start] … Worker N beendet (code …, signal …) — Neustart in N s` (`:58`, artan bekleme). Kanıt `docker logs calendar-api | grep '\[start\]'` ile aranır; `OOMKilled=false` + konteyner restart'ı yok gözlemi aynen geçerli |
---

### O-84 — SaaS `calendar-api` konteynerinde `mem_limit` yok; ayrıca `command:` override O-83'ün bayraklarını sessizce eziyordu ✅ **gelöst**

| Alan | İçerik |
|---|---|
| **Ne** | İlk tahmin: O-83, `api`/`calendar-api` imajına iki iç katman kazandırdı (`--max-old-space-size`, PM2 `--max-memory-restart`) ve bunlar imajla otomatik SaaS'a da ulaşır sanılıyordu — yalnız dış katman (`mem_limit`) eksik zannedildi. **VPS'e ilk dokunulduğunda gerçek daha karmaşık çıktı:** VPS'in kendi `/opt/calendar-api/docker-compose.yml`'i zaten `mem_limit: 700m` + `mem_reservation: 256m` + `cpus: 1.5` **ve** ayrı bir PM2 `command:` override'ı taşıyordu — hiçbiri repo'ya hiç yansımamıştı (yorumdaki "commit 7e7366c" bu repo geçmişinde yok, muhtemelen git'e hiç girmeden elle eklenmiş). **Kritik olan şu:** Compose'da `command:` varsa image'ın `CMD`'si TAMAMEN göz ardı edilir — yani Watchtower yeni image'ı çekmiş olsa bile, VPS'teki eski `command:` satırı O-83'ün iki yeni bayrağını (`--max-memory-restart`, `--max-old-space-size`) sessizce eziyordu. O-83'ün SaaS'taki gerçek koruması bu düzeltmeye kadar **sıfırdı** |
| **Nerede** | `api-backend/docker-compose.yml` → `calendar-api` servisi (repo kopyası) · `/opt/calendar-api/docker-compose.yml` (VPS'teki gerçek dosya, Watchtower'ın hiç dokunmadığı) |
| **Tip** | F (dayanıklılık) + repo/canlı drift |
| **Kutuda ne olur** | Kutuda bir şey olmaz — bu **merkez** (SaaS VPS) tarafı. Risk kutununkinden büyük: VPS 3,7 GB, swap yok, aynı host'ta Traefik + n8n + Umami + umami-db + birkaç başka servis (mail-db, uptime-kuma, referrals-server — `docker ps` ile görüldü, hiçbiri repo'da/INFRASTRUCTURE.md'de yok, ayrı bir drift, bu maddenin kapsamı dışı ama not düşülüyor) paylaşımlı |
| **Çözüm** | 700m eski varsayımı ("~120MB/işçi") O-83'ün gerçek ölçümüyle (~295MB/işçi tepe RSS) güncellendi: `mem_limit: 1200m`. `command:` satırı yeni iki bayrakla senkronlandı. `mem_reservation: 256m`/`cpus: 1.5` olduğu gibi bırakıldı (üzerlerine ayrı bir ölçüm yapılmadı) |
| **Uygulama (12.09.2026, gerçek VPS'te)** | SSH erişimi ilk denemede oturumun auto-mode sınıflandırıcısı tarafından reddedildi ("Production Reads") — kullanıcı kendi SSH oturumunu açtı, birlikte ilerlerken bir `sed` denemesi PowerShell'in tırnak/backslash ayrıştırmasıyla çakışıp dosyayı geçici olarak bozdu (container etkilenmedi, yalnız disk dosyası). Kullanıcının onayıyla SSH erişimi tekrar denendi ve bu kez **izin verildi** — yedek alındı (`docker-compose.yml.bak-20260912-164235`), düzeltilmiş dosya `scp` ile ayrı bir `.new` yoluna yüklenip `docker compose config` ile **önce** doğrulandı, sonra `mv` ile yerine alındı (canlı dosya hiçbir ara adımda geçersiz durumda kalmadı), `docker compose up -d calendar-api` ile uygulandı |
| **Doğrulama (gerçek VPS)** | `docker inspect --format '{{.Config.Cmd}}'` → her iki bayrak da görünüyor · `MemLimit=1258291200` (1200 MiB) · container `Health=healthy` (Docker'ın kendi internal healthcheck'i) · `curl /api/services/public` → 400 (gerçek Express cevabı, n8n'in SPA fallback'i değil — Traefik yönlendirmesi sağlam) · `curl /api/v1/workflows` → 401 (n8n'in kendi API'si etkilenmemiş) |
| **Durum** | ✅ **gelöst (12.09.2026)** — hem repo (`api-backend/docker-compose.yml`) hem VPS'in gerçek dosyası güncel ve senkron. Kaynağı: O-83'ün onprem bildirim-sonrası denetimi (12.09.2026) |
| **Yapısal önlem (12.09.2026, kullanıcı talebiyle)** | Bu sınıf hatanın tekrarını yakalamak için `tools/check-vps-drift.sh` yazıldı — repo'daki `calendar-api` bloğu ile VPS'teki gerçek dosyayı karşılaştırır (yorumlar hariç), fark varsa gösterir. Pre-commit kapısı DEĞİL (SSH ister), VPS'e elle dokunmadan önce/sonra elle çağrılır. `onprem` ajanının mandası bu turda genişletildi (§8, "Merkez VPS drift'i") — artık yalnız müşteri kutusu değil, SaaS VPS'inin kendi elle-değişen dosyaları da onun izlediği yüzey. İlk çalıştırmada script gerçek bir ikinci bug daha buldu: repo'daki Traefik kuralı `${DOMAIN}` kullanıyordu ama `/opt/calendar-api/`'nin kendi `.env.calendar`'ında `DOMAIN` hiç tanımlı değil (Compose değişken ikamesini yalnız aynı dizindeki `.env`'den okur, `env_file:` değil) — deploy edilseydi `Host(\`\`)`'a düşer, rota hiç çalışmazdı. Repo'da VPS'in hâlihazırda doğru olan sabit değerine (`n8n.infinitymade.de`) düzeltildi, script `OK` döndü |
| **Bilinçli bırakılan boşluk** | `docker ps`'te `mail-db`, `uptime-kuma`, `referrals-server` gibi ne repo'da ne `INFRASTRUCTURE.md`'de geçen konteynerler görüldü — ayrı bir drift, bu maddenin kapsamı dışında bırakıldı, kendi numarasını hak ediyor. Ayrıca `api-backend/docker-compose.yml`'in traefik/n8n/umami blokları hâlâ VPS'in gerçek `/opt/n8n/` ayrımıyla birebir örtüşmüyor (tek dosya vs. iki ayrı dizin) — `check-vps-drift.sh` şimdilik yalnız `calendar-api` bloğunu karşılaştırıyor, bu daha geniş belge/repo tutarlılığı sorununun tamamını kapsamıyor |

---

## 7L — `restore.sh` bildirim-sonrası denetimi (12.09.2026 gecesi)

> **Niye bu bölüm var:** `restore.sh` yazıldı, gerçek kutuda üç senaryo uçtan uca
> koştu ve O-26 kapandı — hepsi doğru. Aşağıdaki beş madde o kapanışı **geri
> almıyor**: geri yükleme yolu artık VAR ve çalışıyor. Bunlar o yolun, mutlu
> senaryonun dışındaki dallarında bulunan boşluklar. Ortak desenleri tek cümleyle:
> **test edilen üç senaryonun üçünde de kutu sağlıklıydı.** Oysa `restore.sh` tam
> olarak kutunun sağlıklı OLMADIĞI gün çalıştırılır — `api` ayakta değildir,
> internet yoktur, disk doludur. Beşinin de tetiklendiği an aynı andır.
>
> ✅ **Aynı gece kapatıldı (12.09.2026):** O-85/O-86/O-89 tam, O-87/O-88 kısmen
> (acil/kritik kısımları — JWT doğrulama sert DUR, disk-yeri kapısı — kapandı;
> genel/yapısal çözümleri henüz değil). O-85'in `api` durdurulmuşken ve
> `DATA_ENCRYPTION_KEY` tamamen boşken davranışı gerçek kutuda ayrıca test
> edildi. Detay her maddenin kendi "Durum" satırında.
>
> ⚠️ **Karar notu (onprem, bu tur): `--clean` yerine RENAME'e geçiş DOĞRU karardır
> ve geri alınmamalıdır.** Gerekçe: boş hedefe restore'un davranışı upstream
> Postgres sürümünden, Realtime'ın günlük partisyon düzeninden ve sahiplikten
> **bağımsızdır**; `--clean`'inki değildir — `messages_2026_09_15` bugün patladı,
> yarın başka bir upstream nesnesi patlardı ve bunu önceden ölçmenin yolu yoktu.
> Üstelik RENAME "yarıda kalırsa eski veri kaybolmaz" garantisini `--clean`'in
> asla veremeyeceği bir yerden veriyor. Bu geçişin bedeli iki yeni maddedir
> (O-87 DB-seviyesi ayarların kaybı · O-88 iki kat disk) — ikisi de ölçülebilir
> ve kapatılabilir. `--clean`'in bedeli ise ölçülemezdi.

### O-85 — `restore.sh`'ın üç parmak-izi kontrolü, **hesaplanamadığında** "uyuşuyor" diyor ✅ **gelöst**

| Alan | İçerik |
|---|---|
| **Ne** | DEK/JWT/PGPW karşılaştırmalarının üçü de `elif [ -n "$GUNCEL_..." ] && [ "$GUNCEL" != "$M" ]` kalıbında. Güncel parmak izi **boş** dönerse (yani kontrol hiç yapılamadıysa) koşul yanlış olur ve akış `else` dalına, yani `ok "... parmak izi uyuşuyor"` satırına düşer. Yapılamayan kontrol, geçmiş kontrol gibi raporlanıyor |
| **Nerede** | `onprem/restore.sh:184` · `:195` · `:209` (dallar) — kaynak fonksiyonlar `:156-176`. `parmak_izi_dek()` ayakta bir `api` ister, `parmak_izi_db_taraf()` ayakta bir `db` ister |
| **Tip** | E (sır) + F (dayanıklılık) |
| **Kutuda ne olur** | Geri yükleme, `api`'nin ayakta olmadığı bir günde çalıştırılır — crash-loop, bozuk disk, yeni sunucuya taşıma. O anda `exec` başarısız olur, parmak izi boş kalır ve ekranda **"DATA_ENCRYPTION_KEY parmak izi uyuşuyor"** yazar. Admin en kritik kontrolün geçtiğini sanıp `WIEDERHERSTELLEN` yazar. DEK gerçekten farklıysa hasta verisi geri gelir ama **hiçbir zaman çözülemez** — O-29 (4)'ün sattığı garanti tam da en çok ihtiyaç duyulduğu anda yok. Kontrolün kendisi doğru yazılmış; yalnız "cevap alamadım" hâli "cevap iyi" ile aynı dala düşüyor |
| **Çözüm** | Üç dalın da **üçüncü** bir hâli olmalı: künyede parmak izi VAR ama güncel hesaplanamadı → DEK'te sert `fehler` + `exit` (force yok, O-29'un çizgisi korunur), JWT/PGPW'de açık `warn "hesaplanamadı — kontrol ATLANDI"`. Ayrıca DEK, `api` durmuşken de ölçülebilir: `docker compose run --rm --no-deps -T api node -e '...'` — compose ortamından okur (sır yine argv'ye düşmez), durdurulmuş servis için de çalışır |
| **Yan öneri (aynı sınıf, ayrı madde değil, HÂLÂ AÇIK)** | Restore'un **tam** olduğu bugün hiçbir yerde ölçülmüyor; yalnız `praxura_migrations` satır sayısı basılıyor, veri sayılmıyor. Ucuz kapatma: `backup.sh` künyeye üç-beş sayaç yazsın (ör. `leads`, `prescriptions`, `bookings`), `restore.sh` sonunda aynı sayıları okuyup karşılaştırsın. Sessiz kısmi restore'u yakalayabilecek tek mekanizma bu — bu madde kapanmadı, ayrı küçük bir iş olarak bekliyor |
| **Durum** | ✅ **gelöst (12.09.2026, gerçek kutuda doğrulandı)** — üç kontrol de artık üçüncü hâli ayırt ediyor (künyede FP yok / güncel hesaplanamadı / uyuşmuyor, üçü de farklı davranıyor, hiçbiri "uyuşuyor" yazmıyor). DEK, `docker compose run --rm --no-deps` ile `api` DURMUŞKEN de doğru hesaplanıyor — gerçek kutuda `api` durdurulup test edildi, doğru şekilde eşleşti. `DATA_ENCRYPTION_KEY` tamamen boşaltılıp test edildiğinde "doğrulanamadı" ile sert durdu, onay istemine hiç ulaşmadan, hiçbir servise dokunmadan. Yukarıdaki "yan öneri" (satır-sayısı sağlaması) hâlâ açık, ayrı küçük iş |

---

### O-86 — Şema kapısı, internetsiz kutuda geri yüklemeyi **tamamen** engelliyor ✅ **gelöst**

| Alan | İçerik |
|---|---|
| **Ne** | `restore.sh` şema-sürümü kapısı için `.env`'deki `PRAXURA_API_IMAGE`'ı istiyor; image lokalde yoksa `docker pull` deniyor, o da başarısızsa `fehler` + `exit 1`. Yani **danışma amaçlı** bir kontrol, geri yüklemenin ön koşulu hâline gelmiş |
| **Nerede** | `onprem/restore.sh:219-231` |
| **Tip** | A (dış çağrı) + F |
| **Kutuda ne olur** | Felaket senaryosunun tarifi zaten budur: yeni/temiz sunucu, image'lar yok, ya da internet/GHCR erişimi yok. O anda kutuda geçerli bir yedek, çalışan bir Postgres ve `restore.sh` var — ama betik **hiç başlamıyor**, çünkü ölçmek istediği şey "yedek image'dan yeni mi" idi. Geri yüklemenin kendisi o image'a muhtaç değil. Kutu bizim sunucumuz olmadan ayakta kalmalı (K10) — bu satır tam tersini yapıyor |
| **Çözüm** | Image yoksa **ve** çekilemiyorsa: `warn "şema-sürümü kontrolü yapılamadı — image yok, internet yok"` + kapıyı ATLA, devam et. İkinci kaynak denenebilir: çoğu felakette `praxura-api` konteyneri hâlâ tanımlıdır, `docker inspect praxura-api --format '{{.Image}}'` kullanılabilir bir image verir. Sert `DUR` yalnız **image VAR ve yedek gerçekten ondan yeni** dalında kalsın |
| **Durum** | ✅ **gelöst (12.09.2026)** — image yoksa/çekilemezse artık yalnız şema-sürümü kontrolü `warn` ile atlanıp restore'un geri kalanı devam ediyor; sert DUR yalnız "image lokalde VAR ve yedek ondan yeni" dalında kaldı. `docker inspect praxura-api` üzerinden ikinci kaynak denemesi (onprem'in önerdiği ek iyileştirme) uygulanmadı — mevcut düzeltme ana riski (restore'un hiç başlamaması) zaten kapatıyor, ikinci kaynak ayrı küçük bir iyileştirme olarak bekleyebilir |

---

### O-87 — RENAME yaklaşımının yeni bağımlılığı: boş veritabanı, eskisinin **DB-seviyesi ayarlarını** miras almıyor 🟡 **kısmen gelöst**

| Alan | İçerik |
|---|---|
| **Ne** | `pg_dump -Fc` (`--create` yok) veritabanı seviyesindeki ayarları **taşımaz**: `ALTER DATABASE postgres SET "app.settings.jwt_secret"` `pg_db_role_setting` kataloğunda durur, dump'ın içinde değildir. `--clean` yolunda bu ayarlar yerinde kalıyordu; RENAME + boş `CREATE DATABASE` yolunda **kayboluyorlar**. Bugün onları kurtaran tek şey restore sonrası `99-jwt.sql`/`99-roles.sql`'in yeniden uygulanması — yani geri yüklemenin doğruluğu artık iki compose **mount yoluna** bağlı ve bu bağ hiçbir yerde yazılı değildi |
| **Nerede** | `onprem/restore.sh:309-322` (RENAME + CREATE) · `:345-348` (yeniden uygulama, ikisi de `\|\| warn` ile geçiliyor) · `onprem/volumes/db/jwt.sql:4-5` · mount'lar: `onprem/docker-compose.yml:105-106` |
| **Tip** | D |
| **Kutuda ne olur** | Üç ayrı sessiz sapma: (1) mount yolu bir gün değişirse `psql -f` başarısız olur, betik `warn` ile geçer ve sonunda **"Bitti — sonuç: ok"** der; kutu `app.settings.jwt_secret` olmayan bir veritabanıyla açılır. (2) `jwt.sql`'in hedefi **literal `postgres`** — `POSTGRES_DB` bir gün başka bir değere alınırsa ayar yanlış veritabanına gider (bugün `.env.template:136` = `postgres`, yani bugün zararsız; kırılma sessiz olacağı için yazılıyor). (3) Yeni veritabanı kodlama/collation'ı `template1`'den, sahipliği `supabase_admin`'den alır — eskisininkiyle aynı olduğu **ölçülmedi**. Collation farkı sıralamayı ve metin indekslerini sessizce değiştirir |
| **Çözüm** | (a) `CREATE DATABASE`'i eski veritabanının `pg_database` satırından üret — `TEMPLATE template0` + eskisinin `encoding`/`datcollate`/`datctype`/`datdba`'sı. (b) `pg_db_role_setting`'i eski veritabanından okuyup `ALTER DATABASE … SET` olarak yeniden oyna: `jwt.sql`'e olan örtük bağ tamamen kalkar, çözüm genel olur. (c) Asgari ve beş dakikalık hâli: yeniden uygulamadan sonra **doğrula** — `SELECT current_setting('app.settings.jwt_secret', true)` boş dönerse `warn` değil `fehler` |
| **Yan bulgu** | Rol asimetrisi: `backup.sh:166` dump'ı `-U postgres` ile alıyor, `restore.sh` `-U supabase_admin` ile yüklüyor. Bugün çalışıyor (gerçek kutuda kanıtlandı), ama yedeğin **kapsamını** belirleyen rol ile geri yüklemeyi yapan rol farklı kaldığı sürece "yedekte her şey var mı" sorusunun cevabı role bağlı kalır. İkisini de `supabase_admin`'e çekmek tek satır, ama yeni bir yedek turu gerektirir |
| **Durum** | 🟡 **kısmen gelöst (12.09.2026) — (c) yapıldı, (a)/(b) hâlâ açık.** `app.settings.jwt_secret` restore sonrası boş dönerse artık `warn` değil **sert `fehler` + `exit 1`** — veritabanı zaten güvende geri yüklenmiş durumda kalıyor, servisler BİLEREK açılmıyor (kırık kimlik doğrulamayla ayağa kalkmasınlar diye). Gerçek kutuda mutlu yolda doğrulandı (JWT kontrolü geçti, servisler normal açıldı). (a) `CREATE DATABASE`'i eskisinin `pg_database` satırından üretme ve (b) `pg_db_role_setting`'i genel olarak taşıma **yapılmadı** — düzeltme hâlâ yalnız `jwt.sql`/`roles.sql`'in kapsadığı iki ayara özel, genel bir DB-seviyesi ayar kaybına karşı korumasız |

---

### O-88 — `restore.sh`'ta disk yeri kapısı yok; RENAME + `.alt-` deseni yeri iki katına çıkarıyor, eski kopyaları kimse toplamıyor 🟡 **kısmen gelöst**

| Alan | İçerik |
|---|---|
| **Ne** | `backup.sh` yer kontrolü yapıyor (`:123-132`, `2×(db+storage)+pay`), `restore.sh` **hiç** yapmıyor — oysa geri yükleme diskin daha dar olduğu anda çalışır ve seçilen tasarım bilinçli olarak yeri iki katına çıkarır |
| **Nerede** | `onprem/restore.sh` (`df` hiç geçmiyor — ölçüldü, 0 eşleşme) · yer tüketen adımlar: `:309` (RENAME — eski DB diskte kalır) · `:324` (`docker compose cp` — dump'ın üçüncü kopyası, konteynerin yazılabilir katmanında) · `:355-367` (`.alt-` + geçici çıkarma dizini) |
| **Tip** | F |
| **Kutuda ne olur** | Tepe kullanım ≈ 2× veritabanı + 2× storage + bir dump kopyası. Disk ortada dolarsa `pg_restore` patlar — tesellisi `--single-transaction` ve eski veritabanının duruyor olması, yani kutu kurtarılabilir ama gece uzar. Daha sinsisi: her geri yükleme bir `postgres_onceki_*` veritabanı ve bir `storage.alt-*` dizini bırakıyor; silen yok, sayan yok, uyaran yok. Üçüncü denemede kutu sessizce dolar ve bu kez **Postgres'in kendisi** durur |
| **Çözüm** | (a) `backup.sh`'takinin aynısı bir `df -k` kapısı, gereken = mevcut DB boyutu + storage arşivi + pay; onay isteminden **önce**. (b) `docker compose cp` yerine `docker compose exec -T db pg_restore … < db.dump` — özel biçimli arşiv stdin'den okunabilir (`backup.sh` zaten ters yönde aynısını yapıyor), üçüncü kopya tamamen ortadan kalkar; gerçek kutuda bir kez sınanmalı, kâğıt üzerinde kabul edilmemeli. (c) Betiğin başında mevcut `*_onceki_*` veritabanlarını ve `storage.alt-*` dizinlerini boyutlarıyla listeleyip uyar — **silme yok**, karar admin'in |
| **Durum** | 🟡 **kısmen gelöst (12.09.2026) — (a) yapıldı, (b)/(c) hâlâ açık.** `df -k` kapısı eklendi (`backup.sh`'takiyle aynı desen, arşiv bütünlük kontrolünden hemen sonra, onay isteminden önce), gerçek kutuda çalıştığı doğrulandı. (b) `docker compose cp` yerine stdin pipe ile üçüncü dump kopyasını ortadan kaldırma **yapılmadı** (onprem'in kendi notu: gerçek kutuda sınanmadan girmemeli, bu turun kapsamına alınmadı). (c) eski `*_onceki_*`/`storage.alt-*` artıklarını listeleyip uyarma **yapılmadı** — script bunları hâlâ sessizce biriktiriyor, temizlik tamamen admin'in inisiyatifinde ve hatırlamasına bağlı |

---

### O-89 — Onaydan sonraki iki korumasız adım: yarıda kalırsa kutu kılavuzsuz kalıyor ✅ **gelöst**

| Alan | İçerik |
|---|---|
| **Ne** | Onay verildikten sonra betiğin her yıkıcı adımının bir `fehler()` dalı var — **ikisi hariç** |
| **Nerede** | `onprem/restore.sh:324` (`docker compose cp`, `\|\|` yok, `set -e` altında) · `:359-368` (storage takasındaki iki `mv`) |
| **Tip** | F |
| **Kutuda ne olur** | (1) `:324` başarısız olursa (konteyner `/tmp`'i dolu, `db` yeniden başlamış) `set -e` betiği o satırda keser. O an: veritabanı yeniden adlandırılmış, yeni `postgres` **boş**, beş servis **durdurulmuş**, ekranda tek satır kılavuz **yok**. `:329`'daki örnek alınası kurtarma metni yalnız `pg_restore` dalında duruyor. (2) Storage takasında arşiv beklenen `storage/` kökünü taşımıyorsa ikinci `mv` başarısız olur — ama canlı dizin bir satır önce `.alt-` adına taşınmıştır: kutu storage dizinsiz kalır ve betik yine kılavuzsuz çıkar |
| **Çözüm** | (a) Onay adımından sonrası için tek bir `trap … EXIT`: beklenmedik çıkışta "eski veritabanı `X` adıyla duruyor · geri almak için şu komut · servisleri açmak için şu komut" satırlarını bassın (metin zaten `:329`'da yazılı, yalnız tek dala hapsolmuş). (b) Takastan **önce** `[ -d "$TMP_STORAGE/storage" ]` kontrolü — yoksa canlı dizine hiç dokunma; taşımadan sonraki ikinci `mv` başarısız olursa eskisini geri al |
| **Durum** | ✅ **gelöst (12.09.2026)** — genel bir `trap` yerine (onprem'in önerdiği (a) değil) her iki nokta **ayrı ayrı** korumaya alındı, aynı sonucu veriyor: `docker compose cp` artık kontrol ediliyor, başarısızsa "eski DB hâlâ '${ESKI_DB_ADI}' adıyla duruyor, geri dönme komutu şu" mesajıyla `exit 1`. Storage takasında ikinci `mv` başarısız olursa script eskiyi OTOMATİK geri koymayı dener (`mv "$ESKI_YEDEK" "$STORAGE_DIR"`), böylece kutu storage'sız kalmıyor. İkisi de kod incelemesiyle doğrulandı (gerçek kutuda bu iki başarısızlık senaryosu ayrıca tetiklenmedi — disk/izin hatası simüle etmek bu turun kapsamına alınmadı) |

---

## 7M — Kural 6'nın üçüncü hâli: sayaç-nötr DDL (16.09.2026)

### O-108 — Kural 6 yalnız "salt veri-UPSERT"i tanıyor; sayacı gerçekten değiştirmeyen DDL için kategori yok 🔴 **offen**

| Alan | İçerik |
|---|---|
| **Ne** | `api-backend/db/migrations/README.md` Kural 6 iki hâl tanıyor: (1) salt veri-UPSERT (`public`, hiç DDL) → `bis_version` ölçmeden yükseltilebilir, (2) DDL var → taze kutuda ölç. Üçüncü hâl eksik: **DDL var ama on sayacın hiçbirini değiştirmiyor.** İlk örneği 0017 — bir index DROP, bir index CREATE, `pg_indexes` sayısı aynı |
| **Nerede** | `api-backend/db/migrations/README.md` (Kural 6 metni) · `api-backend/db/schema-zaehler.js:16-27` (sayaç sorguları) · örnekler: `0017_prescription_sessions_kombi_termin.sql:58-59` (index takası, netto 0) · `0018_leads_podologie_altbestand.sql:24-25` ve `0019_podologie_behandlungen_employee_id.sql:13-14` (17.09.2026, saf `ADD COLUMN` — biri FK'li, ikisi de aynı `ZAEHLER: unveraendert` biçimini kullanıyor) |
| **Tip** | D |
| **Kutuda ne olur** | Kapı `bis_version != en yüksek migration` deyip commit'i reddediyor (doğru davranış, O-90). Ama kuralın tanıdığı tek çıkış "taze kutu kur ve ölç" — index takası gibi sık ve ispatlanabilir sayaç-nötr değişikliklerde bu, her seferinde bir tam kurulum turu demek. Ucuz alternatif `SKIP_ZAEHLER_GATE=1`'dir ve **iz bırakmaz**: neden atlandığı hiçbir yerde yazmaz, bir sonraki sefer gerçekten sayacı değiştiren bir migration'da da refleksle kullanılır. Yani kaçış yolu, O-90'ın kapattığı deliği geri açar |
| **Çözüm** | Kural 6'ya üçüncü hâl yazılsın: migration'da `-- ZAEHLER: unveraendert (<gerekçe>)` satırı varsa **ve** gerekçe on sayacın hiçbirine dokunmadığını gösteriyorsa (`storage.*`/`auth.*` yok; tablo/policy/fonksiyon/trigger yok; index değişimi net sıfır ve silinen index taze kutuda **gerçekten var**), `bis_version` ölçmeden yükseltilebilir; `zaehler`/`gemessen_am` olduğu gibi kalır. Karşılığında `SKIP_ZAEHLER_GATE` kullanımı sicile gerekçe yazmadan yasaklanır — iki yol yerine tek yol. İleri adım (Faz 2.4 adayı): kapı `ZAEHLER:` satırını makine-okunur hâle getirip `unveraendert` iddiasını en azından "DDL kelimeleri var mı" düzeyinde çapraz sorgulasın (Kural 6'nın kendi önerdiği yön) |
| **Durum** | 🔴 **offen** — 0017 turunda bulundu. 0017 için verilen hüküm: `bis_version="0017"`, `zaehler`/`gemessen_am` dokunulmadı, `SKIP_ZAEHLER_GATE` kullanılmadı. Gerekçe dosyaya karşı doğrulandı: silinen index `0000_baseline.sql:7242`'de duruyor (yani taze kutuda mevcut, `DROP … IF EXISTS` gerçekten bir index düşürüyor), yenisi `IF NOT EXISTS` ile ekleniyor, `index` sayacı `SELECT count(*) FROM pg_indexes WHERE schemaname='public'` (`schema-zaehler.js:27`) → net 0. Diğer dokuz sayaç: tablo/policy/fonksiyon/trigger/extension/publication/storage/auth hiç geçmiyor. Kural metninin kendisi **henüz yazılmadı**, sahibi yok. 17.09.2026: **üçüncü ve dördüncü örnek** — 0018/0019, `bis_version` "0017"→"0019" olarak iki dosya birden atlanarak yükseltildi, `zaehler`/`gemessen_am` yine dokunulmadı. İkisi de yalnız kolon ekliyor (0019'daki `REFERENCES` dahil) — Postgres kolon eklemede otomatik index/trigger üretmez, FK'nin RI-trigger'ları `tgisinternal=true` olduğu için zaten `trigger` sayacının sorgusu (`schema-zaehler.js:23-26`, `NOT t.tgisinternal`) onları saymıyor — gerekçe koda karşı doğrulandı, sayaçlara gerçekten dokunmuyorlar. 18.09.2026: **beşinci örnek** — `0025_abrechnung_status_manuell.sql` (Ops #310), `prescriptions`'a iki nullable kolon, biri `REFERENCES auth.users(id) ON DELETE SET NULL`. Aynı hüküm: `bis_version` "0024"→"0025", `zaehler`/`gemessen_am` dokunulmadı, `SKIP_ZAEHLER_GATE` kullanılmadı. Bu kez `auth_trigger` sayacı ayrıca sorgulandı, çünkü `ON DELETE SET NULL`'ın RI-eylem trigger'ı **referans edilen** tabloda (yani `auth.users`'ta) yaratılır: o da `tgisinternal=true`'dur ve `schema-zaehler.js`'in `auth_trigger` sorgusundaki `NOT t.tgisinternal` süzgecinden geçmez. Fiziksel kanıt tahminden güçlü — `0000_baseline.sql`'de `auth.users(id)`'ye **44** FK var ve aynı taze kutuda ölçülen `auth_trigger` değeri **1** (yalnız `handle_new_user`); 45'inci FK bu sayıyı değiştiremez. Ayrıca `index` sayacı: Postgres FK için otomatik index yaratmaz (yalnız referans edilen taraftaki PK gerekir, o zaten var), `UNIQUE` yok → net 0. Kalıcı çözüm hâlâ yazılmadı; her yeni ADD-COLUMN turu aynı riski taşımaya devam ediyor. **22.09.2026 — onuncu örnek, ve bu kez fiziksel kanıtla:** `0042_abrechnung_verschluesselung` (Kemal önce `0039` yazdı, Melih'in paralel oturumda origin/main'e aynı gün landırdığı `0039_seed_heilmittel_katalog_podo_komplex_suche`/`0040_kostentraeger_auswahl_view`/`0041_krankenkassen_ik_nachtrag` ile çakışınca — yalnız Kemal'inki gerçek DDL taşıdığı için — `0042`'ye kaydırıldı, merge sırasında) `abrechnung`'a beş nullable kolon ekliyor (`encrypted_storage_path`, `encrypted_sha256`, `verschluesselt_am`, `verschluesselt_fuer_fingerprint`, `verschluesselung_hinweis`) + beş `COMMENT ON COLUMN`. Aynı hüküm: `bis_version` "0041"→"0042" (Melih'in kendi üç migrasyonu zaten counter-neutral olarak "0038"→"0041" yükseltmişti), `zaehler`/`gemessen_am` dokunulmadı, `SKIP_ZAEHLER_GATE` kullanılmadı. Bu turda gerekçe **tahmin edilmedi, ölçüldü** — canlıdan aynı gün yeniden üretilen `db/SCHEMA-RLS.sql` bir **NULL-değişiklik** (policy/fonksiyon/trigger/index yok, yalnız künye satırı), `db/SCHEMA.sql`'in gövde diff'i ise künye dışında tam **beş kolon satırı**. Yani "on sayacın hiçbirine dokunulmadı" iddiası dökümün kendisiyle doğrulanabilir hâlde. Bu örnek `0025`'ten de basit: **hiç FK yok** — `verschluesselt_fuer_fingerprint` fachlich `empfaenger_zertifikate.fingerprint_sha256`'ya bakıyor ama bilerek serbest `text` (sertifika rotasyonundan sonra tarihsel değer durmalı), dolayısıyla `tgisinternal` tartışmasına bile gerek kalmıyor. Türetme `erwartete-zaehler.json` → `_hinweis_0042`'de satır satır yazılı. ⚠️ **Onuncu örnekte kural hâlâ yazılı değil:** bu artık "sırası gelmedi" değil, **kalıcı bir sözlü gelenek** — her turda aynı türetme sıfırdan yapılıyor ve her turda doğru yapılacağına güveniliyor. Bir tur bunu atlayıp `SKIP_ZAEHLER_GATE=1` dediğinde fark edilmeyecek. Sahibi atanmalı: kural metni `db-ustasi` + ben, makine-okunur `ZAEHLER:` kapısı `builder`. **29.09.2026 düzeltme (S3.2 ön kontrolü, `0043_vorlagen_rechnung_ausfall`):** yukarıdaki "kural hâlâ yazılı değil" cümlesi 22.09'da zaten **yanlıştı** — `api-backend/db/migrations/README.md` Kural 6'da "Üçüncü yol — türetilmiş sayaç-nötrlüğü (21.09.2026, `db-ustasi`)" paragrafı var ve CHECK değişikliğini açıkça sayıyor. Yani maddenin **kural metni yarısı çözüldü**; açık kalan yalnız makine-okunur `ZAEHLER:` kapısı (`tools/check-onprem.sh:173-183` bugün yalnız `bis_version == en yüksek migration` eşitliğine bakıyor). `0043` (CHECK genişletme, DROP+ADD CONSTRAINT) bu yolun on birinci uygulaması — `_hinweis_0043` ile, ölçümsüz. Durum `offen` kalıyor, kapsam daraldı: yalnız kapı yarısı, sahibi `builder` · **06.10.2026 (KHS M2.1, `8967ecc`):** `0067_prescriptions_rezeptart_bg` (CHECK `prescriptions_rezeptart_check` +`bg`, DROP+ADD CONSTRAINT) aynı yolun bir uygulaması daha — `_hinweis_0067`, ölçümsüz, `bis_version="0067"`. Dosyada yine `-- ZAEHLER:` satırı yok (0060-0067 sekizinde de 0) — kapı yarısı açık kaldıkça bu iz yalnız serbest metinde durur |

---

## 7N — Kutunun `Permissions-Policy`'si: kapattığı ve açtığı özellikler (16.09.2026)

> **Bu bölüm niye var:** Faz 2.1b'nin Caddy turunda (11.09.2026) üç direktiflik bir
> `Permissions-Policy` header'ı yazıldı ve o gün kimse "bu header kutuda hangi ÖZELLİĞİ
> kapatıyor" diye sormadı. CSP satır satır incelendi (O-52), kardeşi incelenmedi. Sonuç
> aşağıdaki O-109: SaaS'ta çalışan bir ekran kutuda sessizce kırıldı. Ders genel —
> `Caddyfile`'ın `header {}` bloğuna giren her direktif, kutu ile SaaS arasında bir
> **davranış ayrımı** yaratma adayıdır (G7).

### O-109 — Kutunun `Permissions-Policy`'si kamerayı kendi origin'ine de kapatıyordu: Rezept-Scan webcam yolu kutuda sessizce kırık ✅ **gelöst (16.09.2026)**

| Alan | İçerik |
|---|---|
| **Ne** | `onprem/Caddyfile`'ın `Permissions-Policy` header'ında `camera=()` duruyordu — **boş** allowlist, yani kamera kutunun kendi sayfasına da yasak. SaaS tarafında böyle bir header hiç yok |
| **Nerede** | `onprem/Caddyfile:40` (11.09.2026'daki hâli: `Permissions-Policy "camera=(), microphone=(), geolocation=()"`) · kırılan akış `dashboard.js:17226-17233` (`startWebcamCapture`) · tetiklenmeyen geri düşüş `dashboard.js:17220-17225` (`openNativeCameraInput`, `<input capture>`) |
| **Tip** | G (dağıtım ayrımı — SaaS'ta olmayan bir header kutuda davranışı değiştiriyor; G7 sapması) |
| **Kutuda ne olur** | ⚠️ **Geri düşüş kodu vardı ama tetiklenmiyordu — asıl mesele bu.** `startWebcamCapture` şunu soruyor: `if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) → openNativeCameraInput()`. Caddy arkasında HTTPS var, yani `isSecureContext` **true** ve `navigator.mediaDevices` **mevcut** — koşul sağlanmıyor, kod native kamera girişine düşmüyor, doğrudan `getUserMedia`'ya gidiyor ve `NotAllowedError` alıyor. Podolog ekranda hata görüyor, telefon/webcam ile reçete çekemiyor, elle dosya yüklemekten başka yolu kalmıyor. Koddaki yorum (`dashboard.js:17220-17221`) "HTTP'de Secure Context yok" senaryosuna göre yazılmıştı; Caddy geldikten sonra o varsayım değişti, kontrol değişmedi. Hata **yalnız müşterinin kutusunda** ve ancak kurulumdan sonra görünür |
| **Çözüm** | Header açıkça yazıldı: `camera=(self), microphone=(), geolocation=(), serial=(self)` + `Caddyfile`'a gerekçe yorumu (niye `(self)`, niye `serial` şimdiden). `microphone`/`geolocation` bilinçli olarak kapalı kalıyor — kutuda ikisini kullanan kod yok, kapalı tutmak yüzeyi küçültür. ⚠️ **01.10.2026 düzeltmesi:** `geolocation` için bu cümle **o gün de yanlıştı** — `attendance.js` GPS check-in'i zaten `navigator.geolocation` kullanıyordu; §7N'in kendi "kapatılan her direktif için grep zorunlu" kuralı bu maddede uygulanmadı. Şimdi ikinci kullanıcı da var (`module/praxis-standort.js`). Devamı → **O-141** |
| **Durum** | ✅ **gelöst (16.09.2026)** — `onprem/Caddyfile:36-44`; Caddyfile + bu sicil aynı commit'te. Ürün kararı kullanıcıya (Kemal) soruldu ve onaylandı: kutuda kamera **istiyoruz**. ⚠️ **Doğrulama borcu:** değişiklik çalışan kutuya karşı ölçülmedi (Docker Desktop kapalıydı). Açılışta iki kontrol: (1) `curl -skI https://<SITE_URL host>/login.html | grep -i permissions-policy` yeni değeri döndürüyor mu, (2) Rezept-Scan'de webcam bir kez gerçekten açılıyor mu. Bu borç kapanmadan "kutuda kamera çalışıyor" denmez |

> ⚠️ **Numara çakışması — düzeltilecek tek kelime:** `onprem/Caddyfile`'ın yeni yorum bloğu bu
> maddeye **`(O-108)`** diye atıf veriyor. O numara aynı gün başka bir tur tarafından §7M'e
> (sayaç-nötr DDL) verildi; doğru atıf **`(O-109)`**. Çalışma zamanına etkisi yok, ama
> düzeltilmezse altı ay sonra okuyan yanlış maddeye gider. Sicil numarası yeniden kullanılmaz
> (§4) — düzelen taraf kod yorumudur.
>
> **Niye bu madde 11.09'da bulunmadı** (kayda geçsin): o turun gegenlesen'i CSP'yi satır satır
> okudu (dört not, O-52/O-55), `Permissions-Policy`'yi "üç standart kapatma" diye geçti.
> Oysa `camera=()` ile `camera=(self)` arasındaki fark tam olarak "kutuda bir ekran çalışır /
> çalışmaz" farkıydı. **Kontrol listesine giren kural:** kutuya bir özellik-kapısı header'ı
> eklenirken/değiştirilirken, kapatılan her direktif için "bunu kullanan kod var mı" grep'i
> zorunlu.

### O-110 — eGK/Kartenleser Web Serial üzerinden: izin hazır, entegrasyonun kendisi yok 🔴 **offen**

| Alan | İçerik |
|---|---|
| **Ne** | Kart okuyucu (ORGA 930 care, USB-CDC) tarayıcıdan **Web Serial API** ile okunacak. Bugün elde yalnız izin hazırlığı var: `serial=(self)`. Protokol, kod, cihaz testi — hiçbiri yok |
| **Nerede** | `onprem/Caddyfile:40` (`serial=(self)`, bugün **kullanılmıyor**) · `wissensbank/SPEC-RULES.md:273` (kuralın kaydı) · kodda `navigator.serial` **hiç geçmiyor**: `grep -rn "navigator.serial" --include=*.js .` → 0 sonuç (16.09.2026) |
| **Tip** | G (merkez mi kutu mu) — ⚠️ tip **A değil**: tarayıcı ↔ USB cihaz yerelde kalıyor, dışarı çağrı yok, **G1 temiz** (kart verisi kutuya gider, bize değil). Entegrasyon yazılırken bu yeniden doğrulanacak: kart verisini bizim sunucumuza uğratan herhangi bir tasarım **DUR** alır |
| **Kutuda ne olur** | Üç ön koşul — bugün hiçbiri engel değil, ama hiçbiri de kurulum belgesinde yazılı değil: **(a) Secure Context** — Web Serial `[SecureContext]` gerektirir (MDN/W3C: origin `https` şemasıyla "potentially trustworthy" olmalı). `CADDY_TLS_ARG=internal` kutularında kutunun kök sertifikası (`caddy:/data/caddy/pki/authorities/local/root.crt`, `install.sh:633`, uyarı `install.sh:340`) **her praxis bilgisayarına** kurulu olmalı; kurulmazsa sertifika hatası kalır ve "uyarıyı tıklayıp geç" yolu bu iş için güvenilir değil. Kök sertifika `caddy_data` **named volume**'unda (`docker-compose.yml:528`) — `docker compose down -v` yeni CA üretir ve dağıtılmış sertifikayı çöpe atar. **(b) Tarayıcı** — yalnız Chromium masaüstü (Chrome/Edge); Firefox ve Safari bu API'yi **hiç** desteklemiyor, yani özellik kutuda bir "tarayıcı seçimi" ürün kararına dönüşür. **(c) Topoloji** — kutu Hetzner RZ'de olabilir, okuyucu ise praxiste; köprü **tarayıcıdır**. "Kutudan USB'ye" diye kurgulanan hiçbir tasarım çalışmaz (aynı topolojik hata 2026-08-30 TI konseyinde bir kez yapıldı ve orada düzeltildi) |
| **Çözüm** | ORGA 930 care Mini-SDK dokümantasyonu geldiğinde ayrı tur. O turda cevaplanacaklar: veri yolu (okuyucu → tarayıcı → kutu, başka durak yok) · `legal-de`/`gkv-302` tarafı (KVK/eGK okuma yetkisi, SMC-B gereksinimi) · kurulum belgesine "kök sertifika + Chrome/Edge" ön koşulunun yazılması (`install.sh` çıktısı + `onprem/RELEASE-STANDARD.md`) · SaaS'ta aynı kodun koşması (G7: `app.praxura.de` public CA ile zaten Secure Context, ek iş yok). Faz ataması **yok** — sırası kullanıcı kararı |
| **Durum** | 🔴 **offen** — 16.09.2026'da açıldı. Bugün yapılan tek iş izin hazırlığı (O-109 ile aynı commit), o da "engellemiyoruz" demekten ibaret |

---

## 7O — Şema multi-tenancy reformu: konsey kararı (18.09.2026)

### O-111 — On-prem'de `owner_id`/`business_id`/RLS deseni **sadeleştirilmez** — tek şema gerçeği ⚪ **unkritisch**

| Alan | İçerik |
|---|---|
| **Ne** | "Kutu tek praxis'e hizmet ediyor, çoklu-kiracı sütunları on-prem'de fazlalık; baseline donmadan sadeleştirelim" önerisi konseye geldi (18.09.2026). Karar **A**: desen her iki dağıtımda da **aynen kalır**, şema tek gerçek olarak sürer. Bu madde kararı ve **niye tekrar açılmayacağını** kaydeder |
| **Nerede** | `db/SCHEMA.sql` — 51 `owner_id`, 40 `business_id`, 18 `user_id` kolonu · `db/SCHEMA-RLS.sql` — 86 `auth.uid()` policy · `owner_id`'yi okuyan 66 dosya (`module/` + `api-backend/`) · 42 `bizScope` atfı · zincir: `api-backend/db/migrations/0000_baseline.sql` (12.570 satır) + `0001`…`0025` · tutanak: `konsey/tutanak/2026-09-18-onprem-sema-multi-tenant-reform.md` |
| **Tip** | D (şema değişikliği) — reddedilen bir tip-D önerisi. Kayda geçiyor ki altı ay sonra üçüncü kez araştırılmasın |
| **Kutuda ne olur** | **Bugünkü hâliyle: hiçbir şey.** Kutu tek praxis'e hizmet eder ama `owner_id` orada da boş durmaz — `profiles.owner_id` employee→owner bağıdır, yani "müşteri ayrımı" ile "praxis-içi rol ayrımı" **ayrı kolonlar değil, aynı eksen**. Tek-kiracılı kutuda bile RLS'in ~%95'i bu eksene dayanıyor (konsey ölçümü: 172 policy'nin 115'i, 699 kod referansı); sökülürse çalışan ile owner arasındaki sınır düşer. `business_id` ise Standort ekseni (2026-08-28 podologie-standort-zuschnitt kararının taşıyıcısı) ve RLS'te zaten izolasyon sağlamıyor — yalnız 4 tabloda 7 policy + `bizScope()` yumuşak filtresi; yani "fazlalık gibi duran şey" korunmak istenen eksenin **yarım kurulmuş** hâli. **Sadeleştirilseydi ne olurdu:** dağıtıma göre farklı kolon → `0000_baseline.sql`'in iki hâli → koşullu SQL → **zincir çatallanması**. Bu doğrudan **G7** ihlali ve `onprem/SCHEMA-VERTEILUNG.md` §5.2'nin ("kutuda 0000'dan, SaaS'ta 0001'den — aynı defter, aynı dosyalar, fork yok") tersi |
| **Çözüm** | ⚪ `unkritisch` — üç gerekçeyle: **(1)** kolonlar iki dağıtımda da işlevli, kaldırılacak bir şey yok. **(2)** Okunabilirlik isteği ("tabloya bakınca ne olduğunu anlayayım") şemayla değil **dokümanla** karşılanıyor → `db/REGISTER.md`'ye kolon-anlamı notu (`db-ustasi` işi). **(3)** Gerçek dağınıklık ölü tablo/kolondur, desen değil: 5 tablo (`accommodations`, `applications`, `trip_history`, `trip_plans`, `user_credits`) + 5 kolon (3× `whatsapp_*`, `has_dta_pro`, `dta_pro_subscription_item_id`) → **ayrı DROP migration'ı** (zincirin üstüne, `0026…`), playbook **Faz 5.1** (D7), bu hafta değil. Ön koşul: `db-ustasi` dört-kaynak doğrulamasını tazeler; sonrası: `guvenlik`'in standart şartı — her DROP sonrası GRANT/ACL karşılaştırması (DROP+CREATE `EXECUTE`'u PUBLIC'e sıfırlar, S-03/S-04 emsali) |
| **Durum** | ⚪ **unkritisch** — konsey kararı 18.09.2026, `konsey/KARARLAR.md`. ⛔ **Kapanmış karar, yeniden açılmaz** |

> **⚠️ Bu turda düzelen iki yanlış öncül** — maddenin asıl değeri bunlar, ikisi de sicile bu yüzden giriyor:
>
> 1. **"Baseline henüz dondurulmadı, bedelsiz değiştirebileceğimiz tek pencere."** Yanlış.
>    `api-backend/db/migrations/0000_baseline.sql` 10.09.2026'da üretildi, üstünde
>    **0001…0025** koşuyor, `api-backend/db/migrate.js:68` + `:113` her uygulanmış dosyanın
>    SHA-256'sını tutuyor ve değişirse kutuyu açmıyor, canlının `praxura_migrations`
>    defterinde baseline satırı yazılı. Pencere bir hafta önce kapandı.
>    **Genel kural:** "baseline'ı değiştirelim" cümlesi bundan sonra **DUR** alır; şema
>    düzeltmesi her zaman **yeni dosyayla** (`CLAUDE.md` şema protokolü zaten bunu diyor).
> 2. **"`owner_id` iki işi birden yapıyor, birini ayırıp atarız."** Ayrılabilir iki kolon
>    yok — `profiles.owner_id` zaten praxis-içi eksenin kendisi. Öneriye konu küme **boş**.
>
> **Belge statüsü sorusu — cevap:** `ONPREM_MIGRATION_PLAYBOOK.md:135`'teki
> "Multi-tenancy | Her tabloda `owner_id` + RLS | AYNEN KALIR" satırı **§5 MEVCUT DURUM
> ENVANTERİ** tablosundadır, §2'deki K1-K14'te **değil** — yani biçimsel olarak kilitli
> karar değil, envanter notu. Ama bağlayıcılığı oradan gelmiyor: taşıyıcısı **G7** ve
> tek-zincir kararı (`onprem/SCHEMA-VERTEILUNG.md` §5). Bugünden sonra bu satırın arkasında
> ayrıca bir **konsey kararı** var (18.09.2026) — statü sorusu kapandı.

---

## 7P — §302 Echtbetrieb yolu: 19–20.09 turunun kutu denetimi + planın ön kontrolü (20.09.2026)

> **Bu bölüm niye var:** iki ayrı iş aynı gün buraya düştü. **(1)** 19–20.09.2026 gecesi
> `api-backend/billing/*` altında 12 commit indi ve push'landı — yani **müşterinin kutusuna
> giden kod** — ama tetikleyici kural işlemedi, `onprem` çağrılmadı; bu bölüm o turu
> geriye dönük denetler (O-112 ve ondan çıkan iki madde). **(2)** Aynı gece yazılan
> `ABRECHNUNG_ECHTBETRIEB_PLAN.md` (commit `39d7d34`) gerçek §302 gönderimine giden yolu
> tarif ediyor; planın her adımına §3'ün dört sorusu uygulandı (O-115…O-120).
>
> ⚠️ **Turun dersi (ve niye bu sefer ucuz atlatıldı):** bildirim gecikti ama **bedeli
> çıkmadı** — tur saf hesaplama koduydu, yeni zincir açmadı (ölçüm O-112'de). Bir sonraki
> tur böyle olmayacak: aynı planın Adım 1.2/1.3/1.4'ü şema, dış bağımlılık ve yetki
> kontrolüne dokunuyor. **Kod yazıldıktan sonra durdurmak on kat pahalıdır** — bu yüzden
> plan daha uygulanmadan altı madde açıldı.

### O-112 — 19–20.09.2026 §302 turu: kutuya giden 13 düzeltme, **yeni bulut zinciri yok** ⚪ **unkritisch**

| Alan | İçerik |
|---|---|
| **Ne** | §302 DTA dosya formatının altı biçim hatası (GES Summenstatus · UNT/UNZ 6-hane dolgu · serbest metinde virgül kaçışı · iki ICD tek DIA'da · podolojide Therapiefrequenz · NAD'da hasta adresi) + gereksiz `UNA` kaldırıldı · yeni üretim-sonrası öz-denetim (`pruefeDatenstrom()`) · ZAA parser'ın kaçış-duyarsız `split("'")`'ı · dört frontend düzeltmesi. Hepsi image ile kutuya gider. `onprem` çağrılmadı, tur **geriye dönük** denetlendi |
| **Nerede** | `1c93760` (15 dosya, `billing/dta/*` + `billing/api/abrechnung.routes.js`) · `d8249d6` (`billing/zaa/parser.js`) · `50f45f9` · `4c3ce6e` · `272d980` · `c4332d5` · `1201618` · `4fecec7` · `bdff16f` · `39d7d34` (plan) · `fa52c71`+`eb168c6` (harita tazelemesi) · tur boyunca eklenen yeni dosya yalnız iki tane: `api-backend/billing/dta/datenstrom-form.test.js` ve `ABRECHNUNG_ECHTBETRIEB_PLAN.md` |
| **Tip** | Hiçbiri (A-H'nin hiçbir kutusuna girmiyor) — image ile giden saf hesaplama kodu |
| **Kutuda ne olur** | Düzeltmeler kutuda **aynen** geçerli; yol image → `update.sh` gecesi. Ölçüm (dokuz kod commit'inin birleşik diff'inde, yalnız eklenen satırlar): `process.env` **0** · `fetch(` **0** · `http(s)://` **0** · `cron`/`setInterval` **0** · `n8n`/`supabase.co`/`app.praxura` **0** · `api-backend/db/migrations/` altında dosya **0** · yeni `api/` fonksiyonu **0**. Dokunulan frontend modülleri taban adresini `ctx.apiBase`'den alıyor (`module/abrechnung-auswahl.js:1125-1126, 1195`), koda gömülü host eklenmedi. Kapı: `sh tools/check-onprem.sh` → **exit 0**, dokuz sayaç tabanında. `preflight.js` dış bağımlılık **almıyor** (yalnız `codes/legs.js` + `leitsymptomatik.js`) |
| **Çözüm** | ⚪ `unkritisch` — G1/G2/G3/G8'in hiçbirine dokunulmadı. Kullanıcının kendi değerlendirmesi (yeni env yok · yeni dış servis yok · yeni sabit adres yok · yeni zamanlanmış iş yok · şema/DDL yok · yeni yetki kontrolü yok) **doğrulandı, altısı da doğru** |
| **Durum** | ⚪ **unkritisch** — ama tur **iki gerçek kutu sonucu** doğurdu, ikisi de kendi numarasını aldı: **O-113** (sert `throw` eden bir kural filoyu durdurabilir) ve **O-114** (bozuk satırın onarım yolu kutuda yok). İkisi de turun kodundan değil, turun **ortaya çıkardığı desenden** geliyor |

### O-113 — Preflight'ın sert `throw`'u: yanlış tek bir kural bütün filonun abrechnung'unu durdurur, kutuda geri dönüş yolu yok 🔴 **offen**

| Alan | İçerik |
|---|---|
| **Ne** | `buildDtaFile()` artık çıktısını üretim sonrası denetliyor ve uyuşmazlıkta **throw** ediyor; route bunu 422'ye çeviriyor. Doğru tasarım (yanlış dosya üretmektense üretmemek), ama kural kümesi **image ile** dağıtılıyor: bir kuralın yanlış olması, o kuralın kapsadığı **her** müşterinin §302 dosyasının üretilememesi demek |
| **Nerede** | `api-backend/billing/dta/preflight.js` (`pruefeDatenstrom()`, `V:`/`S:` kural kimlikleri) · çağrı `api-backend/billing/dta/builder.js` · 422 dönüşü `api-backend/billing/api/abrechnung.routes.js:713` ve iki kardeş route · **kanıt, varsayım değil:** `c4332d5` tam bu sınıftı — gelecek tarihli **tek** bir Behandlung tüm dosyayı reddettiriyordu; `4c3ce6e` de ret gerekçesinin ekranda hiç görünmediğini düzeltti |
| **Tip** | G (merkez mi kutu mu — image ile giden iş kuralının dağıtım sonucu) |
| **Kutuda ne olur** | SaaS'ta yanlış kural **60 saniyede** düzelir (push → build → Watchtower). Kutuda: en iyi ihtimalle **ertesi gece** (`praxura-update.timer`), `:stable` kanalındaki müşteride **günler** sonra, GHCR'ye çıkamayan kutuda **hiç**. O süre boyunca müşteri fatura kesemez — parası gelmez. Üstüne bunu **göremeyiz** (O-46: filo görünürlüğü yok, telemetri yok); müşteri arayana kadar haberimiz olmaz |
| **Çözüm** | Üç parça: **(a)** her preflight hatası kural kimliği + hangi satır olduğu ile gösterilsin — frontend yarısı `4c3ce6e`'de yapıldı, kalıcı kural olarak yazılsın. **(b)** Kural sınıflaması: "spec'in kesin reddedeceği" hatalar sert `throw`, bizim türettiğimiz/heuristik kurallar **uyarı** olsun; sert listeye yeni kural eklemek bilinçli karardır ve `gkv-302` onayı ister (spec maddesi gösterilmeden sert kural eklenmez). **(c)** Hızlandırılmış yama yolu **belgelensin**: kutu sahibi destek çağrısında `update.sh`'ı elle tetikleyebilmeli, bu `onprem/RELEASE-STANDARD.md`'nin destek bölümünde yazılı olmalı. ⛔ Çözüm "kutuya bağlanıp düzeltiriz" **olamaz** (K10) |
| **Durum** | 🔴 **offen** — 20.09.2026'da açıldı. (b) plan Adım 1.3/1.5'ten **önce** kararlaştırılmalı: plan yeni kurallar ekliyor (bu turda `V:01014` eklendi), sınıflama yazılmadan her yeni kural filo riskini büyütür |

### O-114 — Bozuk veri satırının onarımı: canlıda SQL bizim ayrıcalığımız, müşterinin kutusunda **kimsenin değil** ✅ **gelöst (20.09.2026, `7911f91`)**

| Alan | İçerik |
|---|---|
| **Ne** | 19.09.2026'da `podologie_behandlungen`'de gelecek tarihli iki test satırı oluştu; preflight `S:01005`/`S:01006` ile o Kostenträger'in **tüm** §302 dosyasını reddetti. Canlıda çözüm: `db-ustasi` iki satırı MCP ile sildi. Kutuda o yol **yok** — ve satırı gösteren/düzelten bir ekran da yok |
| **Nerede** | `api-backend/billing/dta/preflight.js:408` ve `:412` (iki kural) · önleme `module/podologie-abrechnung.js` (`c4332d5`, artık gelecek tarihte soruyor) · gösterim `module/podologie-abrechnung.js` "Bereits dokumentiert" bloğu (`1201618` — **sadece gösteriyor, silmiyor**) · şema tarafı `db/REGISTER.md` → `podologie_behandlungen` (19.09.2026 notu: ne GoBD kilidi ne tarih kısıtı var, tabloya gelen FK yok) |
| **Tip** | G |
| **Kutuda ne olur** | Tek bozuk satır → o kasanın dosyası üretilemez. Müşteri satırı kendi arayüzünden silemez; biz kutuya giremeyiz (K10); uzaktan SQL koşacak bir kanal **bilinçli olarak yok**. Sonuç: destek çağrısı, ve verecek bir yol yok. `c4332d5`'in önlemesi yalnız **yeni** satırlar için geçerli — kurulu kutuda satır zaten varsa iş görmez |
| **Çözüm** | Planın **Açık Karar 1**'i (dokümante edilmiş seans: DELETE mi Storno mu) kapandığında ekran gelir; bu madde o kararın **kutu gerekçesidir**: SaaS'ta karar ertelenebilir (biz düzeltiriz), kutuda ertelenemez. Asgari yeterli hâli: faturaya girmemiş (`invoice_id IS NULL`) satırı owner kendisi kaldırabilsin — 19.09'daki iki satır tam olarak bu sınıftaydı. Planın Faz 3 "durum ekranı" maddesiyle aynı yere düşer |
| **Durum** | ✅ **gelöst (20.09.2026, `7911f91`)** — `module/podo-storno.js` + migration `0026` kutudaki onarım yolunu açtı (owner kendi ekranından Storno; satır faturaya girmişse önce fatura stornosu), migration aynı gece canlıya uygulandı ve push indi. Kutuda bozuk satırı düzeltmek için bizim SQL erişimimize ihtiyaç kalmadı (K10 karşılandı). Detay §7Q + §7R |

### O-115 — Datenaustauschreferenz sayacı: göç ve geri yükleme numarayı **geri sarar**, kasa mükerrer teslimat sanar 🟡 **kısmen (0029 yazıldı)**

| Alan | İçerik |
|---|---|
| **Ne** | Plan sayacı `COUNT(*)`'tan kalıcı/atomik bir sayaca taşıyor (doğru iş). Kutu tarafında planın **yazmadığı** risk: sayaç DB'de yaşayacağı için, veritabanının geri gitmesi numaranın da geri gitmesi demektir |
| **Nerede** | `api-backend/billing/api/abrechnung.routes.js:679-686` · `:2769-2773` · `:3202-3206` (üçü de `abrechnung` tablosunda `owner_id` + o yılın satırlarını sayıyor) · alan `api-backend/billing/dta/envelope.js:36` (UNB 0020, 5 hane) · `api-backend/billing/dta/builder.js:427` (fiziksel dosya adının Transfernummer'ı, `mod 999`) · geri yükleme `onprem/restore.sh` (O-26) |
| **Tip** | D (+G) |
| **Kutuda ne olur** | Üç senaryo, üçü de gerçek: **(1) SaaS → kutu göçü.** Aynı praxis, aynı Absender-IK, ama kutunun `abrechnung` tablosu boş → sayaç **1'den** başlar ve SaaS'ın zaten gönderdiği referansları ikinci kez üretir. DAS "bereits eingereicht" der; ret dosyanın içeriğiyle ilgisiz olduğu için teşhisi zordur. Aynı numaradan `buildSammelRechnungsnummer()` ile fatura numarası da türüyor → mükerrer Rechnungsnummer (GoBD tarafı ayrıca ısırır). **(2) `restore.sh` ile dünkü yedeğe dönüş** — sayaç da o güne döner, aradaki gönderimler tekrar numaralanır. Bu, O-26 çözüldükten **sonra** doğan yeni bir sonuç ve bugün hiçbir yerde yazılı değil. **(3) Yılbaşı sıfırlaması** — bugünkü sorgu `gte(<yıl>-01-01)`, yani her 1 Ocak'ta referans `00001`'e döner; bu davranışın spec'in "fortlaufend" beklentisine uyup uymadığı **`gkv-302`'nin sorusu** ve sayaç yazılmadan cevaplanmalı |
| **Çözüm** | Sayaç **monoton** olsun: (a) hiçbir koşulda azalmaz; (b) yalnız **ileri** alınabilen bir yönetim yolu olsun (göç ve geri yükleme sonrası), kutuda owner'ın kendi erişebileceği bir ekranda — çünkü orada bunu bizim yapmamız mümkün değil (K10); (c) göç ve `restore.sh` runbook'una "sayaç ileri alındı mı" adımı eklensin, `restore.sh`'ın onay ekranına uyarı satırı düşsün. Tablo mu sequence mi `db-ustasi`'nın kararı; **tek dağıtım kısıtı:** değer kutunun kendi veritabanında üretilsin — numarayı merkezden dağıtan her tasarım yeni bir tip A'dır ve **DUR** alır (kutu offline'ken fatura kesilemez hâle gelir) |
| **Durum** | 🟡 **kısmen** — 20.09.2026 akşamı: `0029` sayacın kendisini doğru kurdu (monoton · atomik · yıl-sıfırlamasız · merkezden değil). İki şarttan biri aynı gece kapandı: **O-122** ✅ (`ON DELETE SET NULL` + üç RPC'de `coalesce()` ile öksüz satırın kendini onarması). Kalan tek şart **O-123** — `vorstellen()` hâlâ hiçbir yerden çağrılmıyor ve `restore.sh`'ta adımı yok. Detay §7Q + §7R |

### O-116 — Alıcı sertifikası (ITSG Annahmeliste): kutudan runtime indirme **DUR**; tip B zorunlu + yerel son-kullanma kapısı 🟡 **kısmen (21.09.2026, `9cafbc9`+`981f1b7`+`b39222e`)**

| Alan | İçerik |
|---|---|
| **Ne** | CMS EnvelopedData için Datenannahmestelle'nin **açık** anahtarı gerekiyor. Kaynağı ITSG Trust Center'ın Annahmeliste'si: Leistungserbringer tarafı `annahme-rsa4096.key` (PKCS#7 liste, `https://trustcenter-data.itsg.de/dale/annahme-rsa4096.key`), yayıncının kendi tarifiyle "i.d.R. alle 3 Jahre oder auch bei Änderungen" güncelleniyor, bugünkü liste **31.12.2027**'ye kadar geçerli (Gesamtlisten iş günleri ~15:00 tazeleniyor). Planın Açık Karar 2'si "nereden gelecek" diye soruyordu — dağıtım cevabı burada |
| **Nerede** | Plan Adım 1.3 + Açık Karar 2 · bugün kodda **yok**: `api-backend/billing/dta/filename.js:78` `buildEncryptedFilename()` çağrısız duruyor · `api-backend/billing/dta/auftragsdatei.js` VERSCHLÜSSELUNGSART/ELEKTRONISCHE_UNTERSCHRIFT'i sabit `00`/`00` yazıyor (şifreleme gelince bu iki alan **ve** Adım 1.1'de kaydedilmiş eski çiftler değişir — sıralama notu) |
| **Tip** | A → **B'ye çevrilecek**. ⚠️ Tip E **değil**: liste açık anahtar taşır, sır değil — image'a gömülmesi G2'ye dokunmaz |
| **Kutuda ne olur** | Runtime indirme seçilirse dört şey birden: **(1)** internetsiz/kısıtlı kutu §302 üretemez; **(2)** koda yeni bir sabit host girer (tip C, kapı sayacı artar); **(3)** ITSG'nin erişilebilirliği bizim dosya üretimimizin ön koşulu olur; **(4)** hangi praxis ne zaman fatura kesiyor bilgisi kutu dışına sızar. Tip B'ye çevrildiğinde dördü de yok olur: kutu bu adrese **hiç** çıkmaz |
| **Çözüm** | `preise-check.yml` şablonu (O-34, tip B'nin canlı örneği): bir Actions işi listeyi çeker → repoya commit'ler → image build → Watchtower dağıtır. Üç ek şart: **(a) elle yükleme yolu** — airgap kutu ve plan dışı rotasyon için (liste "bei Änderungen" de değişebiliyor, biz o gün image basamayabiliriz); **(b) yerel geçerlilik kapısı** — dosya üretilmeden önce alıcı sertifikasının `notAfter`'ı kontrol edilir, **60 gün kala** panelde uyarı, dolmuşsa **anlaşılır bir mesajla** DUR. Sessizce başarısız olmak ya da süresi geçmiş anahtarla şifrelemek en kötü sonuçtur: dosya gider, kasa açamaz, ret haftalar sonra döner; **(c)** listenin pakete gömülmesi `onprem/NOTICE-QUELLEN.txt`'e **altıncı kaynak** olarak yazılır (O-78 deseni; `legal-de` tek cümleyle dağıtım hakkını onaylar) |
| **Durum** | 🟠 **geplant** — plan Adım 1.3. ⚠️ **Şifrelemenin nerede koşacağı (Açık Karar 2) `guvenlik`'in kararı;** dağıtım tarafının tek şartı G7: **tek kod yolu**, iki dağıtımda da aynı. Backend seçilirse kutuda PHI yeni bir yere gitmez (orası zaten müşterinin kendi sunucusu), SaaS'ta da dosya zaten bizim Storage'ımızda — yani backend seçeneği yeni bir PHI yeri **açmıyor**. Tarayıcı seçeneği listeyi tarayıcıya indirmeyi ve ikinci bir kripto yolunu gerektirir (G7 riski), ama G1'i ihlal etmez. `onprem` tarafından **veto yok** — kısıt var. ⭐ **21.09.2026: 🟡 kısmen.** Üç şartın üçü de uygulandı (airgap yolu `tools/itsg-trust-anchor-laden.mjs` · yerel son-kullanma kapısı `pruefeTrustAnchorFrische()` · NOTICE §6) ve kutudan runtime indirme hiç yazılmadı (ölçüldü: 0 çağrı, tek `curl` merkezde). `gelöst` **değil**, çünkü zincirin ikinci yarısı eksik: **alıcı** sertifikası kutuya hiç varmıyor (**O-132**) ve şifrelenmiş dosyanın teslim yolu yok (**O-131**); ayrıca besleme zinciri 06.01.2027'de sessizce ölüyor (**O-130**). Detay §7S |

### O-117 — `kind` (Test/Erprobung/Echt) anahtarı env var'a **değil** DB'ye; ve kutuda anahtarı **müşteri** çevirebilmeli ✅ **gelöst (20.09.2026, `0028` + `0031`)**

| Alan | İçerik |
|---|---|
| **Ne** | Plan `kind: 'test'` sabitini yapılandırılabilir yapıyor ve "per-tenant olmalı" diyor. Doğru, ama mekanizma sorusu açık kalmış: env var mı DB mi. Cevap **DB**, ve bir ek şart var — kutuda o anahtarı çevirebilecek tek kişi müşteridir |
| **Nerede** | `api-backend/billing/api/abrechnung.routes.js:705` · `:2783` · `:3216` (üçünde de `kind: 'test'` sabit) · `api-backend/billing/dta/builder.js:403` (`kind` → UNB 0035 Testindikator `0`/`1`/`2`) · `api-backend/billing/dta/filename.js` (fiziksel dosya adının `E`/`T` harfi) |
| **Tip** | H (yetkilendirme) + E'nin reddi |
| **Kutuda ne olur** | Env var çözümü **iki yerden birden** kırılır: SaaS çok kiracılı, tek env bütün tenant'ları birden çevirir → Zulassung'u olmayan bir praxis `echt` dosya üretir (kasaya geçersiz gönderim, geri dönüşü idari). Kutuda ise env'i değiştirmek `.env`'i düzenleyip konteyneri yeniden yaratmak demek — müşteri bunu yapmaz, biz de kutuya giremeyiz (K10). Yani env: SaaS'ta yanlış, kutuda ulaşılamaz. DB alanı ikisinde de çalışır ve yedek/`restore.sh` ile birlikte taşınır |
| **Çözüm** | Per-tenant **DB alanı**, varsayılan `'test'`, owner'ın kendi arayüzünden çevirdiği bir ayar; çevirirken Zulassung referansı + tarihi girilsin, kim/ne zaman çevirdi kaydedilsin (kutuda bu kaydın tek sahibi müşteri). ⚠️ **`gkv-302`'ye eksen sorusu:** Zulassung praxis başına mı, yoksa praxis × Datenannahmestelle başına mı? İkincisiyse tek boolean **yanlış** olur — bir DAS'ta zugelassen olan praxis, onay vermemiş başka bir DAS'a `echt` gönderir. Alanın yeri `db-ustasi`'nın kararı (aday: `terapeut_zertifikat` — zaten owner + IK taşıyor; alternatif `profiles`, owner-seviyesi ayar kuralına uygun). ⛔ Kutu-özel bir yer (`praxura_setup`) **kullanılmaz** — o tablo kuruluma ait, SaaS'ta karşılığı yok (G7) |
| **Durum** | ✅ **gelöst (20.09.2026)** — iki adımda: `0028` + `module/abrechnung-einstellungen.js` kararı aynen uyguladı (DB alanı, varsayılan `test`, owner'ın kendi arayüzü, Zulassung referansı + tarihi CHECK ile zorunlu, `praxura_setup` kullanılmadı — G7 korundu); aynı gece `0031` (`5c0a276`) `gkv-302`'nin eksen sorusunu kapattı: Zulassung **praxis × Datenannahmestelle** başına, `betriebsart_empfaenger` istisna tablosu + kutuda owner'ın kendi yönetebildiği arayüz (`module/abrechnung-einstellungen.js:408/:658/:836`). Planın "⛔ bu adım bitse bile hiçbir tenant `echt`'e alınmaz" kilidi **duruyor ve korunmalı**. Detay §7Q + §7R |

### O-118 — Kostenträger/Annahmestellen seed'i Mayıs 2026'da dondu: güncelleme zinciri de kapısı da yok 🟡 **kısmen (besleme yürüdü, kapı yok)**

| Alan | İçerik |
|---|---|
| **Ne** | DTA'nın **kime** gideceği `kostentraeger_annahmestellen`'den çözülüyor. Kutudaki kopya bir seed migration'ı ve kaynağı **`BN050526_KE0.txt`** — Mayıs 2026 yayını. GKV Kostenträgerdatei düzenli yenileniyor; yeni sürümü kutuya taşıyan bir mekanizma **yok**, hatırlatan bir kapı da yok (O-79'un kapısı yalnız `billing/codes/*_positions.js`'i izliyor) |
| **Nerede** | `api-backend/db/migrations/0006_seed_kostentraeger.sql` · `0007_seed_kostentraeger_annahmestellen.sql` (11.409 satır, `quelle='BN050526_KE0.txt'`) · çözücü `api-backend/billing/kostentraeger/annahmestelle.js` (`ladeAnnahmestelle`) · okuyan üç route (`abrechnung.routes.js:587, 2332, 2596`) · parser `api-backend/billing/kostentraeger/parser.js` · kapı `tools/check-onprem.sh` (seed-besleme bloğu — bu tabloları **kapsamıyor**) |
| **Tip** | B (besleme zinciri) + D |
| **Kutuda ne olur** | Bayat liste iki türlü ısırır: **(1)** IK/Annahmestelle değişmişse dosya **yanlış alıcıya** gider — Echtbetrieb'te doğrudan gecikmiş/kayıp para; **(2)** yeni bir kasa/Verknüpfung eklenmişse `ladeAnnahmestelle()` bilinçli olarak üretimi **durdurur** (`annahmestelleFehlt`) — müşteri o kasaya hiç fatura kesemez ve sebebini anlamaz. SaaS'ta fark edip aynı gün elle düzeltebiliriz; kutuda kimse fark etmez, biz de göremeyiz (O-46) |
| **Çözüm** | O-79/O-95 deseni: kaynak dosya güncellendiğinde **yeni seed migration'ı** zorunlu olsun (kapı), üretimi `tools/` altındaki bir script yapsın (11k satır elle yazılmaz). Ek iki şart: arayüzde verinin **Stand** tarihi görünsün (müşteri "bu liste ne kadar eski" sorusunu kendi cevaplayabilsin) ve sürümün geçerlilik takvimi `wissensbank/REGISTER.md`'ye girsin (orası bu işin doğal yeri) |
| **Durum** | 🟡 **kısmen (20.09.2026 gecesi)** — **besleme yarısı yürüdü:** `tools/kostentraeger-annahmestellen-laden.mjs` yazıldı, Q3/Q4 2026 dosyaları `wissensbank/gemeinsam/kostentraeger/` altında (7 dosya), seed üreticiye yeni tablo eklendi, ve `0036`/`0037` ile veri kutuya giden zincire kondu. "Mayıs 2026'da dondu" öncülü artık **eskidi**. **Kalan iki şey:** (1) ⛔ **kapı hâlâ yok** — `grep -n "kostentraeger" tools/check-onprem.sh` → **0 satır**; kaynak dosya güncellenip seed migration'ı yazılmadığında hiçbir şey bağırmıyor. Bunun teorik olmadığını bu tur kanıtladı: `0007` kutuya `quelle_stand = NULL` yazarak 08.09–20.09 arası **on iki gün** dağıtıldı ve fark eden şey bir kapı değil, başka bir işin yan bulgusu oldu (`0037` o düzeltmedir). Boşluk artık **iki** tabloda: `kostentraeger_annahmestellen` + yeni `kostentraeger_anschriften`. (2) Stand tarihinin **arayüzde** görünmesi — veri tarafı tamam, ekran tarafı borç. Kapı yarısı O-125/O-129 ile aynı commit'e sığar; ikisi de **plan Faz 2.2'den önce** |

### O-119 — §302 dosyası kutudan çıkarken **bizim sunucumuza uğramaz** — şimdiden konan kısıt 🔴 **offen**

| Alan | İçerik |
|---|---|
| **Ne** | Plan dosyanın **üretimini** uçtan uca tarif ediyor, **teslimini** tarif etmiyor (Faz 2.1'in randevu sorularına bırakılmış). O boşluk doldurulurken en cazip ürün fikri şudur: "gönderimi merkezden yapalım, müşteri tek tıkla göndersin." Bu madde o cümleyi **bugünden** kapatıyor |
| **Nerede** | Plan Faz 2.1 (randevuda sorulacaklar: "test dosyası hangi kanaldan gönderiliyor") · bugünkü tasarım: dosya Storage'dan indirilir, müşteri kendi kanalıyla gönderir (`module/abrechnung-detail.js` indirme yolu) |
| **Tip** | A — ve **G1**'in tam merkezi |
| **Kutuda ne olur** | §302 dosyası hasta adı, doğum tarihi, KVNR, ICD kodları ve tedavi tarihlerini taşır — ürettiğimiz **en yoğun PHI'li çıktı**. Bunu merkezden proxy'lemek kutuya geçişin bütün amacını tek adımda iptal eder; üstelik bizi §203 StGB ve AVV tarafında yeni bir role sokar. ⛔ **Sert veto (G1).** Yalnız kutu için değil: aynı proxy SaaS'ta yazılırsa kutuda ikinci bir kod yolu doğar (G7) |
| **Çözüm** | Kısıt şöyle yazılsın (plan metnine ve Faz 2.1 randevu notlarına): dosya müşterinin kendi kutusundan iner ve **müşterinin kendi kanalıyla** (DAS portalı / kendi KIM-maili / kendi SFTP'si) gider. İleride otomatik gönderim istenirse yol açıktır ama şartlıdır: **kutudan doğrudan** DAS'a, **müşterinin kendi** kimlik bilgileriyle, bizim sunucumuza uğramadan — o gün ayrı bir tip-A maddesi açılır (kimin anahtarı, offline davranışı, hangi host, hata görünürlüğü) |
| **Durum** | 🔴 **offen** — 20.09.2026'da açıldı. Kapanışı ucuz: plan metni bu cümleyi taşıdığı anda `unkritisch`'e döner. Mekanik kapısı **yok**, yargı işi — bu yüzden yazılı olması şart |

### O-120 — Özel anahtar hiçbir dağıtımda bize gelmez (kalıcı kısıt); ama kutuda sertifika süresini **kimse izlemiyor** 🟡 **kısmen**

| Alan | İçerik |
|---|---|
| **Ne** | İmzalama tarayıcıda, müşterinin kendi `.p12`'siyle yapılıyor; `terapeut_zertifikat` yalnız **metadata** tutuyor. Bu tesadüf değil, korunacak bir kazanım — ve **her iki dağıtımda da** böyle kalmalı. Eksik olan taraf: sertifikanın süresi dolmadan uyaran bir yer yok |
| **Nerede** | `db/SCHEMA.sql:2638` `terapeut_zertifikat` (`cert_subject`, `cert_thumbprint`, `cert_serial`, `cert_valid_from`, `cert_valid_to` — **blob ve anahtar kolonu yok**) · imzalı dosyanın alındığı uç `api-backend/billing/api/abrechnung.routes.js` (`/abrechnung/:id/upload-signed`) · tarayıcı tarafı `vendor/node-forge` (yerelleştirilmiş, O-36 — kutuda internetsiz çalışır) |
| **Tip** | E (sır) + G |
| **Kutuda ne olur** | Bugünkü tasarım kutuda **olduğu gibi** çalışır ve orada ayrıca değerlidir: anahtar müşterinin kendi makinesinde kalır, kutuya bile girmez. ⛔ Tersi bir tasarım ("anahtarı sunucuya alalım, imzalamayı backend yapsın") kutuda "zaten müşterinin kendi sunucusu" diye savunulur ama SaaS'ta savunulamaz → iki kod yolu, **G7 ihlali**. **Eksik:** `cert_valid_to` şemada duruyor, onu okuyup uyaran hiçbir ekran yok. ITSG sertifikaları 3 yıl geçerli; kutuda bunu fark edecek ikinci bir insan yok — sertifika dolduğu gün abrechnung durur ve sebebi görünmez |
| **Çözüm** | Kısıt kayıtlı ve korunuyor: ⛔ `terapeut_zertifikat`'a özel anahtar/PKCS#12 blob'u ekleyen her tasarım **DUR** alır. Kalan iş: yerel son-kullanma uyarısı (60 gün kala panelde, dolmuşsa net mesaj) — **O-116'nın alıcı-sertifikası kapısıyla aynı ekranda** olmalı, ikisi tek kontrol listesi. Planın Faz 3 "müşteriye durumunu gösteren ekran" maddesi tam olarak burasıdır; o ekran ayrıca `kind` anahtarının (O-117) ve Kommunikationspartner kaydının da yeridir |
| **Durum** | 🟡 **kısmen** — kısıt sağlam ve doğrulandı (şemada anahtar kolonu yok, 20.09.2026); uyarı tarafı yazılmadı. Planın Faz 3'üne bağlandı |

---

## 7Q — Faz 1'in beş migration'ı: uygulama ÖNCESİ kutu denetimi (20.09.2026)

> **Bu bölüm niye var:** §302 Echtbetrieb planının Faz 1 kod işi bitti, `0026`–`0030`
> yazıldı ama **canlıya uygulanmadı** — yani bu sefer tetikleyici **doğru zamanda**
> işledi (bir önceki tur geriye dönük denetlenmişti, O-112). Beş dosya da okundu,
> kutu sonuçları tek tek çıkarıldı.
>
> **Toplu hüküm: GEÇER, KAYITLA — bir ŞART ile (O-122).** Beş migration da
> `api-backend/db/migrations/` zincirinde, yani kutuya varan tek doğru yoldalar;
> hiçbiri yeni dış çağrı · env var · zamanlanmış iş · sabit adres açmıyor
> (ölçüm aşağıda). Kapı yeşil: `sh tools/check-onprem.sh` → **exit 0**.
>
> ⭐ **Turun en iyi haberi:** `module/podo-storno.js` **O-114'ün kutu gerekçesini
> kapatıyor.** Kutuda bozuk bir Behandlung satırını kimse düzeltemiyordu (bizim SQL
> yolumuz orada yok, K10); artık owner kendi ekranından Storno yapıyor ve satır
> `.is('storniert_am', null)` ile **11 okuma yerinden birden** düşüyor. Planın
> Açık Karar 1'i kapandı ve doğru yönde kapandı.

### Turun ölçümü (iddia değil, sayım)

| Ne | Ölçüm | Sonuç |
|---|---|---|
| Yeni dış çağrı | `fetch(` / `https?://` — beş `.sql` + `module/abrechnung-einstellungen.js` | **0** |
| Yeni env var | `process.env` — aynı küme | **0** |
| Yeni zamanlanmış iş | `cron` / `setInterval` / `pg_cron` | **0** |
| Yeni sabit host | `n8n.` / `supabase.co` / `app.praxura` | **0** |
| Yeni `api/` fonksiyonu | `find api -name "*.js" -not -path "api/_lib/*"` | **12** (değişmedi) |
| Kapı | `sh tools/check-onprem.sh` | **exit 0**, dokuz sayaç tabanında |
| Yıkıcı DDL | `DROP COLUMN`/`DROP TABLE`/`RENAME`/`SET NOT NULL`/`DROP CONSTRAINT` | **0** — beşi de saf additiv, `-- ZWEISTUFIG:` satırı gerekmiyor |
| Kutuda sıra | `0000_baseline.sql:12498` bucket'ı yaratıyor, `0030` onu güncelliyor | ✅ doğru sırada; taze kutuda `UPDATE` boşa düşmüyor |

### O-121 — Şema-önce/kod-sonra sırası **kutuda garantili, SaaS'ta değil**: bu beş migration için sıra bağlayıcı 🟠 **geplant (bu tur elle)**

| Alan | İçerik |
|---|---|
| **Ne** | Kutuda runner `api` açılışında koşar (`api-backend/server.js:35` → `runMigrations`), yani **kod servis vermeden önce** şema yerindedir — sıra mimari olarak garantili. SaaS'ta aynı runner `DATABASE_URL` set olmadığı için **hiç koşmuyor** (O-91, `migrate.js:177` → `'keine DATABASE_URL'`), şema elle MCP ile uygulanıyor. Sonuç: SaaS'ta kod ile şema arasındaki sırayı tutan tek şey **insanın hangi düğmeye önce bastığı** |
| **Nerede** | Runner: `api-backend/db/migrate.js:177` · çağrı `api-backend/server.js:4562` · SaaS'ta set edilmemiş olduğu zaten kayıtlı (O-91). Bu turda yeni kolonları **zaten sorgulayan** yerler — migration uygulanmadan canlıya çıkarsa hepsi PostgREST 42703 verir: `storniert_am` → `api-backend/billing/api/abrechnung.routes.js:2916` `:3426` · `api-backend/billing/api/verordnung-status.routes.js:212` · `module/abrechnung-auswahl.js:484` · `module/behandlungsbeginn.js:35` · `module/patientenkarte.js:185` · `module/podo-einheiten.js:251` · `module/podo-storno.js:120,129` · `module/eingangsbefundung-regel.js:69,324,445`; `betriebsart` → `module/abrechnung-einstellungen.js` + `abrechnung.routes.js` (`betriebsartAus(cert)`); sayaç RPC'leri → `abrechnung.routes.js:113-114` |
| **Tip** | D (+G) |
| **Kutuda ne olur** | Kutuda **hiçbir şey** — image açılışında migration'lar koşar, sonra servis verir. Asıl risk **SaaS'ta**: `git push` Vercel'i saniyeler içinde, Watchtower'ı 60 saniye içinde yeni koda geçirir; şema henüz eskiyse Podoloji ekranları ve §302 üretimi aynı anda kırılır. Bu, kutunun SaaS'tan **daha güvenli** olduğu ilk somut durum — kaydedilmeye değer |
| **Çözüm** | Bu tur için sıra **bağlayıcı**: (1) MCP ile `0026` → `0030` sırayla canlıya, (2) `db/SCHEMA.sql` + `SCHEMA-RLS.sql` tazele, (3) **sonra** `git push`. Ters sıra = canlı kırılması. Kalıcı çözüm O-91'e ait (SaaS'ta runner'ı açmak); bu madde onun **ikinci kanıtı** ve aciliyet gerekçesi |
| **Durum** | 🟠 **geplant** — kalıcısı O-91 (Faz 2.4). Bu turda elle disiplinle karşılanıyor |

### O-122 — ⛔ **ŞART:** `datenaustausch_zaehler.owner_id` `ON DELETE CASCADE` — sayaç silinebiliyor, yani **geri sarabiliyor** ✅ **gelöst (20.09.2026, uygulama öncesi)**

| Alan | İçerik |
|---|---|
| **Ne** | `0029` sayacı doğru kurguluyor: monoton, yıl-sıfırlamasız, atomik, merkezden vermiyor — O-115'in şartlarının çoğu karşılandı. Ama tablonun `owner_id` kolonu `NOT NULL REFERENCES public.profiles(id) **ON DELETE CASCADE**`. Yani bir profil silindiğinde sayaç satırı **tamamen kaybolur** ve bir sonraki dosya `1`'den başlar — `greatest()` ile kurulan bütün "asla geri gitmez" garantisi tek bir profil silmesiyle düşer |
| **Nerede** | `api-backend/db/migrations/0029_datenaustausch_zaehler.sql:62` · silme yolu `api/dsgvo.js` `handleDelete` (hesap silme profili de siler; `datenaustausch_zaehler` orada **hiç geçmiyor**, yani sessizce cascade olur) · `nummernkreise`'de aynı desen var (`0000_baseline.sql:8608`) ama orada **doğru**: anahtarı `(owner_id, kreis, jahr)`, sayaç o owner'a ait. Burada anahtar `(absender_ik, empfaenger_ik)` ve `owner_id` **anahtarın parçası değil** — dosyanın kendi yorumu da böyle diyor (`:76`, "Nicht Teil des Schluessels") |
| **Tip** | D (+G) |
| **Kutuda ne olur** | İki senaryo: **(1)** SaaS'ta aynı Absender-IK'yı paylaşan iki hesap (praxis birliği, ikinci Standort hesabı, ya da aynı test IK'sı) — birinin hesabı silinince **diğerinin** sayacı sıfırlanır; §302'ye göre onlar tek göndericidir, yani numaralar gerçekten çakışır. **(2)** Kutuda owner hesabını silerse ya da göç sırasında profil yeniden yaratılırsa sayaç kaybolur ve **kutuda bunu fark edecek kimse yok** (O-46). Zarar O-115'in tarif ettiğinin aynısı: kasa "bereits eingereicht" der, teşhis dosyanın içeriğiyle ilgisiz olduğu için zordur, üstüne `buildSammelRechnungsnummer()` üzerinden mükerrer Rechnungsnummer doğar (GoBD tarafı da ısırır) |
| **Çözüm** | Migration **henüz uygulanmadı**, yani dosya hâlâ düzeltilebilir ("uygulanmış dosya değiştirilmez" kuralı daha devreye girmedi). İstenen: `owner_id uuid REFERENCES public.profiles(id) **ON DELETE SET NULL**` (NOT NULL kalkar). Gerekçe kolonun kendi yorumunda zaten yazılı — `owner_id` burada **bilgi**, kimlik değil; sayacın kimliği IK çiftidir. Ek olarak `api/dsgvo.js`'e tek satır gerekçe: `datenaustausch_zaehler` **bilinçli olarak silinmiyor** (kişisel veri taşımıyor — iki IK + iki tamsayı; orada zaten aynı mantıkla duran GoBD blokları var). ⚠️ `0029` içinde düzeltilmezse **ikinci bir migration** gerekir ve o `DROP CONSTRAINT` içerir — yani `-- ZWEISTUFIG:` disiplinine girer; şimdi düzeltmek on kat ucuz |
| **Durum** | ✅ **gelöst (20.09.2026)** — şart **uygulamadan önce** ve istenenden iyi karşılandı: `0029:74` `owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL` (NOT NULL kalktı), **artı** üç RPC'nin üçünde de `owner_id = coalesce(datenaustausch_zaehler.owner_id, excluded.owner_id)` (`:120` `:157` `:189`) — öksüz kalan satır bir sonraki kullanımda kendini onarıyor. `api/dsgvo.js` tarafındaki gerekçe satırı da yazıldı. İkinci migration gerekmedi, `-- ZWEISTUFIG:` disiplinine hiç girilmedi |

### O-123 — `datenaustausch_zaehler_vorstellen()` var ama **ulaşılabilir değil**: üç anın üçünde de çağıracak kimse yok 🟡 **kısmen (02.10.2026, (a) `6a5cd1f`)**

| Alan | İçerik |
|---|---|
| **Ne** | O-115'in şartı üç parçaydı: (a) monoton sayaç, (b) yalnız ileri alan bir yönetim yolu, (c) göç ve `restore.sh` runbook'una adım. **(a) ✅ yapıldı.** (b) fonksiyon olarak yazıldı ama **hiçbir yerden çağrılmıyor** ve owner'a kapalı: `REVOKE … FROM PUBLIC` + `GRANT … TO service_role` — yani tarayıcıdaki owner çağıramaz. **(c) hiç yapılmadı:** `onprem/restore.sh` içinde `zaehler`/`referenz` geçmiyor (`grep` → **0 satır**) |
| **Nerede** | Fonksiyon `api-backend/db/migrations/0029_datenaustausch_zaehler.sql:145-172` · çağıran kod **yok** (`grep -rn "vorstellen" --include=*.js` → **0**) · eksik yerler: `onprem/restore.sh` · göç runbook'u (henüz yok, Faz 5.1) · `module/abrechnung-einstellungen.js` (494 satır; `betriebsart`'ı gösteriyor, sayacı göstermiyor) |
| **Tip** | D (+G) |
| **Kutuda ne olur** | Fonksiyonun gerektiği **üç an** var ve üçü de yakın: **(1) SaaS'ın kendisi.** `0029` bilinçli olarak backfill yapmıyor ("ein automatischer Backfill waere geraten, nicht gewusst") — yani migration uygulandığı anda canlı sayaç **0**'dan başlıyor, oysa `abrechnung` tablosunda eski `COUNT(*)` mantığıyla verilmiş numaralar duruyor. Bugün zararsız (henüz hiçbir dosya bir DAS'a gitmedi, `kind` hâlâ `test`), ama **ilk `erprobung` dosyasından önce** bu adım atılmazsa O-115'in tarif ettiği hasar kutuda değil **SaaS'ta** olur. **(2) SaaS → kutu göçü.** **(3) `restore.sh`.** İkisinde de sayaç geriye gider ve düzeltecek çağrı yok |
| **Çözüm** | Üç parça, üçü de ucuz: **(a)** `onprem/restore.sh`'a **görünür** bir adım: geri yükleme bittikten sonra mevcut `letzte_referenz`/`letzte_transfernummer` değerlerini ekrana bas, "yedek alındıktan sonra gönderim yapıldı mı? yapıldıysa şu komutla ileri al" satırıyla birlikte (script'in DB erişimi `supabase_admin`, GRANT'a takılmaz). **(b)** Göç runbook'u yazıldığında (Faz 5.1) aynı adım oraya da — bu madde o runbook'un kontrol listesine giren ilk satırdır. **(c) Ekran şartı — O-115'teki hâlinden yumuşatıldı, gerekçesiyle:** owner'ın sayacı **çevirmesi** gerekmiyor, çünkü çevirmenin gerektiği iki an (göç, restore) **script'in elinde**, owner'ın değil. Gereken şey **görünürlük**: Faz 3 durum ekranında (O-116/O-117/O-120'nin buluştuğu ekran) "son verilen Datenaustauschreferenz: N, Stand …" satırı dursun. Owner sayıyı **görebilirse** kasa "bereits eingereicht" dediğinde telefonda söyleyebilir; göremezse kutuda teşhis imkânsızdır (O-46: biz bakamıyoruz). Değiştirme eylemi script'lerde kalır — owner'ın elinde yalnız-ileri bile olsa bir numara kolu, yanlış kullanıldığında sessizce 99999'a sıçratır ve geri dönüşü yoktur |
| **Durum** | 🟡 kısmen — **(a) yapıldı** (`6a5cd1f`): `onprem/restore.sh:524` geri yüklemeden sonra `datenaustausch_zaehler`'ı (`owner_id` dahil) gösterir, `:533` `datenaustausch_zaehler_vorstellen(...)` komutunu psql/`supabase_admin` ile verir (RPC değil, GRANT'a takılmaz). (b) göç runbook'u Faz 5.1, (c) durum ekranı Faz 3 — değişmedi. ⚠️ Restore'un bu kolu kutuda **çalıştırılmadı**, yalnız backup tarafı ölçüldü — Önceki: `geplant (KHS K2.10)` — 02.10.2026: (a) bu sprintte. `restore.sh` sonunda `datenaustausch_zaehler`'ın `absender_ik, empfaenger_ik, letzte_referenz, letzte_transfernummer, aktualisiert_am` satırlarını gösterir + "son gönderilen referanstan küçükse `datenaustausch_zaehler_vorstellen()`" talimatı (psql, db konteyneri içinden; RPC değil). (b)/(c) değişmedi. Önceki not: 🔴 offen — (a) `restore.sh` adımı **plan Faz 2.2'den (Testverfahren) önce**, çünkü ilk gerçek numara orada verilir. (b) Faz 5.1'e bağlı. (c) Faz 3 ekranına bağlı. ⚠️ **Ayrı bir iş maddesi açılmasına gerek yok** — bu madde o iştir; sahibi `onprem`, uygulaması `builder`. ⚠️ **20.09.2026 gecesi yeniden ölçüldü, hiçbiri değişmedi ve bir tanesi keskinleşti:** `grep -rn "vorstellen" --include=*.js --include=*.sh` → ürün kodunda **0 çağıran**; `grep -c "zaehler\|referenz" onprem/restore.sh` → **0**. Üstelik `0035` fonksiyonu artık `anon`/`authenticated`'dan da revoke etti (doğru karar, S-24 sınıfı açık kapatıldı) — yani `service_role` dışında **hiç kimse** çağıramaz. `0035`'in kendi başlığı bu durumu "von Hand bzw. vom Migrationslauf benutzt" diye tarif ediyor, ama **öyle bir el yolu da migration yolu da bugün yok**: fonksiyon var, kapısı yok. Sayaç `0029` ile canlıda **0'dan** başladı ve backfill bilinçli yapılmadı, yani bu kol **ilk `erprobung` dosyasından önce** gerekli olacak |

### O-124 — Sayaç dosya üretilmeden **önce** tüketiliyor: reddedilen her deneme bir referans numarası yakıyor ✅ **gelöst (20.09.2026, `0033` + `f2b5325`)**

| Alan | İçerik |
|---|---|
| **Ne** | `vergebeNummern()` üç üretim yolunda da `buildDtaFile()`'dan **önce** çağrılıyor; preflight ise `buildDtaFile()`'ın **içinde** patlıyor (O-113). Yani başarısız her deneme bir Datenaustauschreferenz ve bir Transfernummer tüketiyor, sayaç yalnız ileri gittiği için geri alınamıyor → DAS'a giden seride **boşluklar** oluşur |
| **Nerede** | `api-backend/billing/api/abrechnung.routes.js:829` (`vergebeNummern`) → `:838` (`buildDtaFile` try bloğu) · aynı desen `:3007` ve `:3468` · fonksiyonun kendisi `:110-125` |
| **Tip** | G |
| **Kutuda ne olur** | Yön **güvenli tarafta**: boşluk oluşuyor, tekrar değil — ve tehlikeli olan tekrardı. Ama O-113 ile birleşince kutuda şöyle görünür: inatçı bir preflight kuralı yüzünden müşteri altı kez dener, altı numara yanar, spec'in "fortlaufend" beklentisiyle arasında fark açılır ve bunu kimse görmez. SaaS'ta biz sayabiliriz, kutuda sayamayız (O-46) |
| **Çözüm** | İki adım: **(1) `gkv-302`'ye tek soru:** Anlage 1 TP5 V21 Kap. 5.4/7.2 boşluklu (lückenhaft) bir Datenaustauschreferenz serisini kabul ediyor mu? Cevap "hayır" ise numara vergisi preflight'tan **sonraya** alınmalı — ama `datennummer` `buildSammelRechnungsnummer()` üzerinden build'e girdiği için bu düz bir yer değiştirme değil, `builder`'ın çözeceği bir sıralama işi. **(2)** Cevap "evet, boşluk sorun değil" ise madde `unkritisch`'e döner ve gerekçesi burada kalır — altı ay sonra üçüncü kez araştırılmasın diye |
| **Durum** | ✅ **gelöst (20.09.2026)** — `gkv-302` cevapladı: spec **"fortlaufend"** ister, **"lückenlos"** değil; üç denetim kademesinin hiçbiri boşluk aramıyor, yani boşluk **spec ihlali değil**. Sıra (önce numara, sonra preflight) bu yüzden **bilinçli olarak korundu** — ters çevrilseydi `F:03001`–`F:03004` kuralları körleşirdi, çünkü onlar `datennummer`'ın kendisini denetliyor. Kalan GoBD şartı (boşluk **açıklanabilir** olmalı) `abrechnung.status='verworfen'` + yeni `verwerfungsgrund` kolonuyla karşılandı; yazma yolu `api-backend/billing/api/verworfen.js` ve **bloklayıcı değil** (protokol yazımı başarısızsa route'un cevabı değişmiyor). ⚠️ Bu alanın artık PHI riski **O-127**'ye devredildi |

### O-125 — Ön kontrol: `0031`/`0032` (kostentraeger_anschriften) · `0033` (abrechnung_uebermittlung) · O-118 kapı genişletmesi 🟡 **kısmen (migration'lar indi, KAPI yazılmadı)**

| Alan | İçerik |
|---|---|
| **Ne** | `db-ustasi`'nın planladığı üç migration + kapı önerisi, **yazılmadan önce** §3'ün dört sorusuyla denetlendi. **Üçü de GEÇER, iki şartla.** Kapı önerisi **kabul** ve O-118'in mekanik yarısını kapatıyor |
| **Nerede** | Önerilen: `0031`/`0032` `kostentraeger_anschriften` + seed (`tools/seed-generieren.mjs`'in `quelle_stand` boşluğu düzeltilerek) · `0033` `abrechnung_uebermittlung` (Anhang 1 §4.5 defteri, yalnız `service_role` yazar) · kapı `tools/check-onprem.sh:185-204` (O-79 seed-besleme bloğu) · izlenecek yeni kaynaklar `wissensbank/gemeinsam/kostentraeger/*.txt` (**bugün 7 dosya:** `BN050526_KE0` · `AO05Q326_KE3` · `BK05Q326_KE1` · `EK05Q226_KE0` · `EK05Q426_KE0` · `IK05Q326_KE1` · `LK05Q226_KE0`) + `tools/kostentraeger-annahmestellen-laden.mjs` |
| **Tip** | D (0031/0032/0033) + B (besleme zinciri, kapı) |
| **Kutuda ne olur** | **Kapı genişletmesi — evet, aynen istendiği gibi.** O-118'in iki yarısı vardı: besleme zinciri + hatırlatan kapı. Bu, kapı yarısının tamamı. Ayrıca O-118'in "Mayıs 2026'da dondu" öncülü **artık eskimiş**: `wissensbank/gemeinsam/kostentraeger/` altında Q3 ve **Q4 2026** dosyaları duruyor ve `kostentraeger-annahmestellen-laden.mjs` yazılmış — yani besleme yarısı da yürümüş. O-118 bu iki migration + kapı indiğinde kapanabilir hâle gelir. **`quelle_stand` düzeltmesi O-118'in "Stand tarihi görünsün" şartının veri tarafıdır** — arayüz tarafı hâlâ borç |
| **Çözüm** | **Şart 1 (`0033`):** "yalnız `service_role` yazar" doğru, ama **okuma** tarafı boş bırakılmasın. Kutuda müşteri kasadan "bu dosyayı ne zaman gönderdiniz" sorusunu alır ve cevabı yalnız bu defterdedir; bizim bakma imkânımız yok (K10/O-46). İstenen: owner'ın kendi satırlarını **okuyabildiği** bir RLS policy (`owner_id = auth.uid()`) + Faz 3 durum ekranında görünür olması. Yazma `service_role`'da kalsın — defterin değeri değiştirilememesinde. ⛔ Tam kapalı (`nummernkreise` deseni, policy'siz) **olmasın**: `nummernkreise` bir sayaçtır, kimse bakmaz; bu bir **belgedir**, bakılsın diye var. **Şart 2 (`0031`/`0032`):** seed elle yazılmasın, `tools/seed-generieren.mjs` üretsin (11k satırlık `0007` zaten bu yüzden öyle üretildi) ve üretilen dosyanın başına kaynak dosya adı + `quelle_stand` yazılsın — kutuda "bu liste ne kadar eski" sorusunun cevabı orada başlar. **Kapı:** önerildiği gibi genişletilsin; tek ek istek, ret mesajı **hangi migration numarasının beklendiğini** söylesin (O-79 bloğunun bugünkü mesajı yalnız dosyayı listeliyor) |
| **Durum** | 🟡 **kısmen (20.09.2026)** — ⚠️ **numaralar kaydı** (ön kontrolde tahmin edilenden farklı çıktılar): `kostentraeger_anschriften` → **`0032`** (+seed `0036`), `abrechnung_uebermittlung` → **`0034`**; araya `0031` (betriebsart je Empfänger) ve `0033` (abrechnung verworfen) girdi. **Şart 1 ✅ tam:** `0034`'ün SELECT policy'si aynı migration'da geldi ve gerekçesi dosyanın içine yazıldı. **Şart 2 🟡:** üretici (`seed-generieren.mjs`) düzeltildi ve yeni tabloyu tanıyor, ama bu turun gövdeleri elle üretildi — bkz. **O-126**. **Kapı ❌ yapılmadı:** `tools/check-onprem.sh`'ın seed-besleme bloğu (`:185-204`) hâlâ yalnız `billing/codes/*_positions.js` izliyor, `grep -n "kostentraeger" tools/check-onprem.sh` → **0 satır**; ret mesajı da hâlâ beklenen migration numarasını söylemiyor. Kapı yarısı **O-129 ile aynı commit'te** yazılabilir. Detay §7R |

### Bu turda durumu değişen üç eski madde

- **O-114** 🔴 offen → 🟡 **kısmen**: `module/podo-storno.js` + `0026` kutudaki onarım yolunu açtı (owner kendi ekranından Storno; satır faturadaysa önce fatura stornosu). Tam `gelöst` için migration canlıya uygulanmalı ve push inmeli — o an gelince commit numarasıyla kapanır.
- **O-115** 🟠 geplant → 🟡 **kısmen**: sayacın kendisi doğru yapıldı (monoton · atomik · yıl-sıfırlamasız · merkezden değil). Kalan iki şart **O-122** (cascade) ve **O-123** (erişim + runbook) olarak kendi numaralarını aldı.
- **O-117** 🟠 geplant → 🟡 **kısmen**: `0028` + `module/abrechnung-einstellungen.js` kararı aynen uyguladı — DB alanı, varsayılan `test`, owner'ın kendi arayüzünden, Zulassung referansı + tarihi CHECK ile zorunlu, `praxura_setup` kullanılmadı (G7 korundu). Modülde dış çağrı/env/sabit host **0** (ölçüldü). Kalan: `gkv-302`'nin eksen sorusu (praxis mı, praxis × DAS mı) — `0028`'in kendi başlığında açıkça yazılı ve additiv olarak düzeltilebilir, bu yüzden **adımı bloklamıyor**.

> ⏭️ **Bu bölüm 20.09.2026 AKŞAMININ fotoğrafıdır ve burada durur (silinmez).** Aynı
> gecenin devamı §7R'dedir ve yukarıdaki üç satırın üçünü de ileri taşıdı: **O-114 ve
> O-117 ✅ gelöst**, **O-122 ✅ gelöst** (uygulamadan önce, istenenden iyi), **O-124 ✅
> gelöst** (`gkv-302` cevapladı). Açık kalan tek §7Q maddesi **O-123**. Bu bölümün
> durum satırlarını güncel sanma — güncel hâl her zaman maddenin kendi girdisindedir.

---

## 7R — Faz 1'in ikinci yarısı: `0031`–`0037` + güvenlik düzeltmesi `0035` (20.09.2026 gecesi)

> **Bu bölüm niye var:** §7Q, `0026`–`0030`'u **uygulanmadan önce** denetlemiş ve tek sert
> şart koymuştu (O-122). O şart kapandı, migration'lar canlıya uygulandı, ve aynı gece
> zincire yedi dosya daha girdi: `0031`–`0034` (plan Adım 1.4/1.7/1.10 + GoBD), `0035`
> (güvenlik), `0036`/`0037` (seed). Bu bölüm o yedisinin kutu denetimi.
>
> **Toplu hüküm: GEÇER, KAYITLA — sert şart yok.** Yedi dosya da
> `api-backend/db/migrations/` zincirinde; hiçbiri yeni dış çağrı · env var · zamanlanmış
> iş · sabit adres · yeni `api/` fonksiyonu açmıyor (ölçüm aşağıda). Kapı yeşil:
> `sh tools/check-onprem.sh` → **exit 0**.
>
> ⭐ **Turun en iyi haberi — O-122 uygulanmadan önce kapandı ve fazlasıyla.** İstenen
> `ON DELETE SET NULL`'dı; gelen ondan iyisi: `0029:74` `SET NULL` **artı** üç RPC'nin
> üçünde de `owner_id = coalesce(datenaustausch_zaehler.owner_id, excluded.owner_id)`
> (`:120` `:157` `:189`) — yani öksüz kalan satır bir sonraki kullanımda **kendini
> onarıyor**. Sayaç artık ne silinebiliyor ne geri sarabiliyor. §7Q'nun tek sert şartı
> bu turda tamamen düştü.
>
> ⭐ **İkinci iyi haber — `0031` O-117'yi kapattı ve kutu tarafı eksiksiz.** `gkv-302`'nin
> eksen sorusu ("Zulassung praxis başına mı, praxis × DAS başına mı") cevaplandı: **çift
> başına**. `betriebsart_empfaenger` tablosu (`0031`) bunu kurdu, **ve owner'ın kendi
> ekranından yönetebildiği bir arayüz de var** — `module/abrechnung-einstellungen.js:408`
> `:658` `:836`. Yani kutuda müşteri "DAK bana Zulassung verdi, AOK vermedi" durumunu
> kendisi kaydedebiliyor. Bizim SQL'imize ihtiyaç yok (K10 karşılandı).

### Turun ölçümü (iddia değil, sayım)

| Ne | Ölçüm | Sonuç |
|---|---|---|
| Yeni dış çağrı (ürün kodu) | `fetch(` / `https?://` — yedi `.sql` + `uebermittlung.js` + `verworfen.js` + `annahmestelle.js` + `betriebsart.js` + `abrechnung.routes.js` | **0** |
| Yeni env var | `process.env` — aynı küme | **0** (yalnız var olan `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`) |
| Yeni zamanlanmış iş | `cron` / `setInterval` / `pg_cron` | **0** |
| Yeni sabit host | `n8n.` / `supabase.co` / `app.praxura` | **0** |
| Yeni `api/` fonksiyonu | `find api -name "*.js" -not -path "api/_lib/*"` | **12** (değişmedi) |
| Kapı | `sh tools/check-onprem.sh` | **exit 0**, dokuz sayaç tabanında |
| Yıkıcı DDL | `DROP COLUMN`/`DROP TABLE`/`RENAME` | **0**. `0033` bir `DROP CONSTRAINT IF EXISTS` içeriyor ama **genişletme** (aynı CHECK tam listeyle + `verworfen` olarak geri konuyor) — `:beta`/`:stable` ikilisini kırmıyor, iki adım gerekmiyor |
| `bis_version` ↔ zincir | `erwartete-zaehler.json` → `"0037"` = en yüksek migration | ✅ hizalı |
| Merkez aracının dış çağrısı | `tools/kostentraeger-annahmestellen-laden.mjs:213` `:240` | **merkez tarafı** — yerel `wissensbank/*.txt` okur, SaaS'a PostgREST ile yazar. Kutuda **hiç çalışmaz**, image'a girmez. Tip B'nin doğru hâli |

### Kutu davranışı — üç yeni okuma yolu tek tek kontrol edildi

| Yol | Veri kutuda yoksa ne olur | Hüküm |
|---|---|---|
| `ladePapierannahmestelle()` → adres | `annahmestelle.js:310-319`: `console.warn` + `anschrift = null`, **akış devam eder** — Begleitzettel adressiz basılır, elektronik dosya etkilenmez | ✅ nazik düşüş |
| `ladeBetriebsart()` → `betriebsart_empfaenger` | `betriebsart.js:91`: `42P01` (tablo yok) yakalanıyor, `terapeut_zertifikat`'ın varsayılanına düşüyor | ✅ nazik düşüş |
| `verworfeneNummerFesthalten()` | `verworfen.js` başlık kural 4: protokol yazımı başarısızsa **route'un cevabı değişmez** ("bir protokol denemesi bir hatayı başka bir hataya çeviremez") | ✅ doğru öncelik |

> ⭐ Bu üç `42P01`/warn kalkanı **O-121'in kendiliğinden gelen panzehiridir** ve
> kaydedilmeye değer: SaaS'ta kod şemadan önce inerse ekran kırılmıyor, özellik
> susuyor. Desen adlandırıldı — bundan sonra yeni kolon okuyan her yol bunu taşımalı.

### O-126 — Seed gövdesi bu turda script'le değil elle üretildi; **kanıt sunuldu, ama kural yazılı değil** 🟡 **kısmen**

| Alan | İçerik |
|---|---|
| **Ne** | `tools/seed-generieren.mjs` `DATABASE_URL` ister, SaaS'ta bilinçli set edilmemiş (O-91) — yani araç SaaS veritabanına buradan hiç ulaşamıyor. `0036`/`0037`'nin gövdesi bu yüzden PostgREST'ten okunup lokal formatlandı. **Kaçamak yapılmadı:** aynı `format('%L')` sorgusu canlıda koşturuldu ve md5'ler karşılaştırıldı — `0036: e8b99eff…`, `0037: e9be545d…`, iki tarafta da aynı. Gövde **byte-identik**. Ayrıca iki tablonun da tüm kolonları `text`/`date` (jsonb/`text[]`/regex yok), yani kuralın korktuğu escaping sınıfı bu dosyalarda **hiç yok** |
| **Nerede** | `0036_seed_kostentraeger_anschriften.sql:28-50` (gerekçe + md5) · `0037_…quelle_stand.sql:38-52` · araç `tools/seed-generieren.mjs:159` `:165` (`DATABASE_URL`) · kural `api-backend/db/migrations/README.md` |
| **Tip** | D |
| **Kutuda ne olur** | **Bu iki dosya için hiçbir şey** — gövde kanıtlanmış şekilde aynı, kutuya doğru veri gider. Risk **bu turda değil, bir sonrakinde**: kanıt adımı kuralda yazılı olmadığı için, bu tur bir **emsal** oldu. Bir dahaki sefere "geçen sefer de elle yapmıştık" denip md5 adımı atlanırsa, kutuya SaaS'takinden farklı escaping'li bir seed gider ve bunu **hiçbir şey yakalamaz** (kutu sessizce farklı veriyle çalışır — O-46: biz bakamıyoruz). `jsonb`/`text[]` içeren bir tabloda aynı yöntem bugün de tehlikeli olurdu |
| **Çözüm** | İkisi birden, ikisi de ucuz: **(a)** `migrations/README.md`'ye kural yazılsın — *seed gövdesi `seed-generieren.mjs` ile üretilir; araç ulaşamıyorsa gövde elle üretilebilir **ama** aynı `format('%L')` sorgusu hedef veritabanında koşturulup md5 eşitliği dosyanın başlığına yazılmadan commit edilemez.* Bu turun yaptığı tam olarak budur; yazılı olmayan tek şey kuralın kendisi. **(b)** Kalıcı çözüm O-91'e ait ve bu madde onun **üçüncü kanıtıdır**: `DATABASE_URL` olmadan SaaS tarafında ne runner koşuyor (O-121), ne seed üretilebiliyor (bu madde). ⛔ Çözüm "SaaS'a `DATABASE_URL` koyalım" diye **acele edilmez** — o env doğrudan Postgres bağlantısı demektir, `guvenlik`'in masasıdır; araca salt-okunur bir PostgREST modu eklemek (a)'nın yanında daha küçük bir iştir |
| **Durum** | 🟡 **kısmen** — bu turun uygulaması **doğru**, itiraz yok. Açık olan tek şey kuralın yazılması: (a) sıradaki seed migration'ından **önce** |

### O-127 — `verwerfungsgrund`'da kalan artık PHI riski: alan kutuda kalır, **tanılama paketine ve filo panosuna asla girmez** 🔴 **offen**

| Alan | İçerik |
|---|---|
| **Ne** | `0033` `abrechnung.verwerfungsgrund` kolonunu açtı; `formatiereVerwerfungsgrund()` preflight hatalarında yalnız kural kodlarını yazıyor (`Preflight [F:03001, …]`), KVNR ve tarih desenlerini maskeliyor. Ama kodun kendisi 4. dalda artık riski **dürüstçe adlandırıyor**: beklenmedik bir runtime mesajı düz ad taşıyabilir, ve bir ad her kelimeye benzediği için maskelenemez |
| **Nerede** | `api-backend/billing/api/verworfen.js:85-105` (4. dal, maskeleme + 200 karakter kırpma) · kolon `0033_abrechnung_verworfen.sql:45` · DSGVO tarafı: `abrechnung` zaten `api/dsgvo.js`'te |
| **Tip** | G (merkez mi kutu mu) |
| **Kutuda ne olur** | **Bugün hiçbir şey** — alan kutuda, müşterinin kendi sunucusunda, kendi hastasının verisiyle; SaaS'ta da `abrechnung` zaten PHI taşıyor. Yani bu **yeni bir PHI yeri değil** ve G1 ihlali değil. Asıl risk **ileride ve tam bizim tarafımızda**: iki planlı özellik bu satırları kutudan **bize** taşımaya aday — **Faz 2.5a tanılama paketi** (playbook: müşteri butona basıyor, paket bize geliyor) ve **O-46 filo panosu** (merkezde kutu durumu). İkisinden biri `abrechnung` satırlarını ya da hata metinlerini toplarsa, maskelenememiş tek bir hasta adı bizim sunucumuza geçer — **G1 ihlali, K6'nın tam ortasından** |
| **Çözüm** | Şimdiden konan kısıt, tıpkı O-119 gibi: **`abrechnung.verwerfungsgrund` ve `abrechnung_uebermittlung.fehlertext`/`verarbeitungshinweise` hiçbir tanılama paketine, hiçbir telemetriye, hiçbir filo panosu alanına girmez.** Tanılama paketinin içerik listesi (`RELEASE-STANDARD.md` §7.3) yazılırken bu üç alan **açık dışlama** olarak yazılsın — "unutulmasın" değil, "yazılı olarak yasak". `0034`'ün kendi başlığı zaten aynı şeyi tablonun içi için söylüyor (⛔ PHI-VERBOT); bu madde onu **dışarı çıkış yolu** için tekrarlıyor, çünkü orada kimse söylemiyor |
| **Durum** | 🔴 **offen** — Faz 2.5a (tanılama paketi) ve O-46 (filo panosu) yazılmadan **önce** kapanmalı; ikisi de henüz yazılmadı, yani bugün ucuz |

### O-128 — Seed migration'ları birikiyor: taze kutu kurulumu her çeyrekte bir tam kopya daha koşacak 🔴 **offen**

| Alan | İçerik |
|---|---|
| **Ne** | Kutunun referans verisi yalnız seed migration'larından gelir, ve uygulanmış dosya değiştirilemediği için **her güncelleme tam bir yeniden kopyadır**. `0037` bunun ilk örneği: `0007`'nin 11.407 satırını tek bir kolon eklemek için **baştan** yazdı. Zincir bugün **59.166 satır / 4,6 MB**, ve en büyük altısının beşi seed: `0013` (17.065 satır, 1,7 MB) · `0037` (11.550 / 988 KB) · `0007` (11.537 / 840 KB) · `0006` (1.083 / 208 KB) · `0036` (1.652 / 144 KB) |
| **Nerede** | `api-backend/db/migrations/` — ölçüm `cat *.sql \| wc -l` = 59166, `du -sh .` = 4.6M · runner `api-backend/db/migrate.js`, açılışta `server.js:35` |
| **Tip** | D |
| **Kutuda ne olur** | Kostenträger dosyaları **çeyrek dönemlik** yayınlanıyor. Her tazelemede iki tablo için ~13k satırlık yeni bir çift dosya girerse, taze bir kutu kurulumu **eski çeyreklerin hepsini sırayla tekrar oynatmak** zorunda: bugün 2 tam kopya, bir yıl sonra ~10, üç yıl sonra ~26 — hepsi `ON CONFLICT DO UPDATE` ile aynı satırları üst üste yazarak. Sonuç iki yerden birden ısırır: **(1)** image büyür (bugün 4,6 MB'ın 4 MB'ı seed), **(2)** kurulum/`update.sh` süresi uzar ve runner servis vermeden önce koştuğu için (O-121) bu süre doğrudan **kutunun ayakta olmadığı süredir**. ⚠️ Bu sürenin bugünkü değeri **ölçülmedi** — iddia satır ve bayt sayısıdır, saniye değil |
| **Çözüm** | Üç adım, üçü de bugün acil değil ama sıralı: **(a) Ölç.** Bir sonraki temiz WSL kutusu kurulumunda `migrate.js`'in dosya başına süresini yazdır; `0007`+`0037`+`0013`'ün toplamı bilinmeden büyüklük tartışılamaz (sicil kuralı 4). **(b) Karar noktasını şimdiden tanımla:** seed zinciri şu eşiği geçtiğinde baseline tazelenir ve seed geçmişi `0000_baseline.sql`'e katlanır — eşik `onprem/SCHEMA-VERTEILUNG.md`'ye yazılsın (belge zaten baseline kararının sahibi). **(c)** Katlama **yalnız** kurulu kutu kalmadığında ya da tüm kutular baseline'ın üstünde bir sürümdeyken yapılabilir — bugün kurulu kutu **yok**, yani bu işin en ucuz anı yaklaşıyor, ve o an kaçarsa bir daha gelmez |
| **Durum** | 🔴 **offen** — (a) bir sonraki kutu kurulumunda, (b) `SCHEMA-VERTEILUNG.md`'ye, (c) Faz 2.x. Bugün hiçbir şeyi bloklamıyor; kaydedilme sebebi tam olarak **bloklamadan büyümesi** |

### O-129 — "Bu migration SaaS'a uygulandı mı" satırı **10 dosyanın 10'unda da yok** — 14.09'da konan disiplin iki dosya sonra sustu ✅ **gelöst (02.10.2026, KHS K2)**

| Alan | İçerik |
|---|---|
| **Ne** | `migrations/README.md:122` (14.09.2026, `db-ustasi`) şunu kural yaptı: *bir migration'ı SaaS'a MCP ile uyguladığında, bunu migration dosyasının kendi başlık yorumuna bir satırla yaz* (`-- SaaS: uygulandı 14.09.2026, MCP`). Sebep somuttu: `praxura_migrations` defterini yalnız runner yazıyor, runner SaaS'ta hiç koşmuyor (O-91/O-121), yani SaaS'a neyin uygulandığı **hiçbir yerde kayıtlı değil** — `0015`'in SaaS'a hiç uygulanmamış olduğu bu yüzden 13.09'a kadar fark edilmemişti. **Ölçüm:** kural konduktan sonra yazılan migration'ların yalnız **üçünde** satır var (`0015`, `0016`, `0023`), ve bu turda canlıya uygulanan **10 dosyanın (0026–0035) 10'unda da yok** |
| **Nerede** | `api-backend/db/migrations/0026…0035_*.sql` — `grep -l "SaaS: uygulandı"` → **0/10** · kural `api-backend/db/migrations/README.md:113-125` · tek karşı örnek: `0036`/`0037` başlıkları "SaaS'a uygulanmaz, kutu içindir" diye **açıkça** yazıyor (doğru davranış, yanlış yön: yapılmayan yazıldı, yapılan yazılmadı) · uygulandığının tek izi `api-backend/db/erwartete-zaehler.json:10` içindeki `_hinweis_0035` — migration dosyasında değil, başka bir dosyada |
| **Tip** | D |
| **Kutuda ne olur** | Kutuda hiçbir şey; hasar **merkez ile kutu arasındaki hesabın kaybolmasıdır**. Altı ay sonra "SaaS'ta `betriebsart_empfaenger` var mı" sorusunun cevabı yine canlıya bakmak olur, ve bakmayan biri `0031`'i ikinci kez uygular ya da hiç uygulamaz. `0015` dersinin aynısı: **kayıt tutulmayan uygulama, uygulanmamış sayılır.** Bu turun kendi ironisi kayda değer — `0035` başlığı "iki hafta sonra sessizce geri açılan kural, kural değildir" diye yazıyor; aynı gün, aynı klasörde, 14.09'un kuralı tam olarak bunu yapmış durumda |
| **Çözüm** | ⚠️ Bu **mekanik**, yani bana değil **kapıya** ait (§7). Önerilen kural, tek satırlık `grep`: *`api-backend/db/migrations/` altına staged yeni bir `.sql` girdiyse, dosya başlığında ya `-- SaaS: uygulandı …` ya da `-- SaaS: uygulanmaz — <gerekçe>` satırı bulunmalı; ikisi de yoksa commit reddedilir.* Kapı hangi düğmeye basıldığını göremez (uzak MCP, repoda iz yok) ama **kararın yazılmış olmasını** zorlayabilir — ve zaten eksik olan karar değil, yazısıdır. Geriye dönük: `0026`–`0035`'in başlıklarına satır **elle** eklenir. ⚠️ Uygulanmış bir dosyanın **yorumunu** değiştirmek bile SHA-256'yı bozar, yani bu düzeltme yalnız **henüz hiçbir kutuya gitmemiş** dosyalar için yapılabilir — `0026`–`0035` bugün o durumda, **ilk kutu kurulduktan sonra değil**. Kapının kendisi `builder`'ın işi; taban ve metin burada |
| **Durum** | `gelöst` (insan yolu, `6a5cd1f`): `tools/check-onprem.sh` yeni eklenen (`--diff-filter=A`) migration'ın ilk 40 satırında `-- SaaS: angewandt TT.MM.JJJJ` ya da `-- SaaS: nicht angewandt (box-only): …` ister, `ausstehend` yok, kaçış `SKIP_SAAS_ZEILE_GATE=1`. ⚠️ **İki açık uç:** (1) CI fiyat botu kapıyı hiç görmüyor ve ürettiği seed migration'da satır yok → **O-156**; (2) sprint §2 madde 3'ün "numarayı rezerve et = dosyayı uygulamadan önce push et" kuralıyla çelişki → çözüm §7X — Önceki: `geplant (KHS K2.10)` — 02.10.2026 kapı biçimi belirlendi: yeni eklenen (`--diff-filter=A`) migration dosyasının ilk 40 satırında tam bir satır `^-- SaaS: (angewandt|angewendet) [0-9]{2}\.[0-9]{2}\.[0-9]{4}` **ya da** `^-- SaaS: nicht angewandt \(box-only\): .+`. ⛔ `ausstehend` kabul edilmez: uygulanmış dosya değiştirilemez (runner SHA-256), satır commit anında son hâlinde olmalı. 11 eski dosya (`0030`–`0038`, `0044`, `0047`) **elle düzeltilmez** — yerel test kutusu onları uygulamış durumda; SaaS durumları `erwartete-zaehler.json` `_hinweis_*` satırlarında kayıtlı. Önceki not: 🔴 offen — geriye dönük düzeltmenin penceresi **ilk kutu kurulumuna kadar** açık. Kapı kuralı O-125'in kapı yarısıyla **aynı commit'te** yazılabilir |

### Bu turda durumu değişen yedi eski madde

- **O-114** 🟡 kısmen → ✅ **gelöst (`7911f91`)**: `module/podo-storno.js` + `0026` canlıya indi. Kutuda bozuk bir Behandlung satırını artık owner kendi ekranından storno ediyor; bizim SQL erişimimize ihtiyaç kalmadı (K10 karşılandı). §7Q'nun kapanma şartı ("migration uygulanmalı ve push inmeli") yerine geldi.
- **O-117** 🟡 kısmen → ✅ **gelöst (`5c0a276`, `0031`)**: `gkv-302`'nin eksen sorusu cevaplandı — Zulassung **praxis × Datenannahmestelle** başına. `betriebsart_empfaenger` bunu kurdu, ve kutuda owner'ın kendi yönetebildiği arayüz var (`module/abrechnung-einstellungen.js:408/:658/:836`). Env var'a hiç düşülmedi, `praxura_setup` kullanılmadı, `terapeut_zertifikat` varsayılan olarak korundu (G7). Planın "hiçbir tenant `echt`'e alınmaz" kilidi hâlâ yerinde.
- **O-122** 🔴 offen → ✅ **gelöst (`0029:74`)**: `ON DELETE SET NULL` + üç RPC'de `coalesce()` ile kendi kendini onarma. §7Q'nun **tek sert şartı**, uygulamadan önce ve istenenden iyi kapandı. `api/dsgvo.js` tarafı da yazıldı.
- **O-124** 🟡 kısmen → ✅ **gelöst (`0033` + `f2b5325`)**: `gkv-302` sorulan soruyu cevapladı — spec **"fortlaufend"** ister, **"lückenlos"** değil; üç denetim kademesinin hiçbiri boşluk aramıyor. Sıra (**önce numara, sonra preflight**) bilinçli olarak **korundu**, çünkü ters çevrilseydi `F:03001`–`F:03004` kuralları körleşirdi. Kalan GoBD şartı (boşluk **açıklanabilir** olmalı) `abrechnung.status='verworfen'` + `verwerfungsgrund` ile karşılandı, yazma yolu `verworfen.js` ve **bloklayıcı değil** (protokol yazımı başarısızsa route'un cevabı değişmiyor). Artık riski O-127 devraldı.
- **O-118** 🔴 offen → 🟡 **kısmen**: besleme yarısı **yürüdü** — `tools/kostentraeger-annahmestellen-laden.mjs` + Q3/Q4 2026 dosyaları + `0036`/`0037`, ve `quelle_stand` artık hem üreticide (`seed-generieren.mjs`) hem veride var. "Mayıs 2026'da dondu" öncülü resmen **eskidi**. Kalan: **kapı yarısı** (aşağıda) + Stand tarihinin arayüzde görünmesi.
- **O-125** 🟠 geplant → 🟡 **kısmen**: **Şart 1 tam karşılandı** — `0034`'ün SELECT policy'si yazıldı **ve gerekçesi migration'ın içine** istenen cümleyle kondu ("kutuda müşteri 'bu dosya ne zaman gitti' sorusunu kendi ekranında cevaplayabilmeli, biz oraya giremeyiz"). **Şart 2 kısmen** — üretici düzeltildi ve yeni tabloyu tanıyor, ama gövdeler bu turda elle üretildi (O-126). **Kapı isteği yapılmadı:** `tools/check-onprem.sh`'ın seed-besleme bloğu (`:185-204`) hâlâ yalnız `billing/codes/*_positions.js` izliyor; `wissensbank/gemeinsam/kostentraeger/*.txt` ve `kostentraeger-annahmestellen-laden.mjs` **hiçbir sayaçta geçmiyor** (`grep -n "kostentraeger" tools/check-onprem.sh` → **0 satır**), ve ret mesajı hâlâ beklenen migration numarasını söylemiyor.
- **O-121** 🟠 geplant → **geplant kalıyor, ama iki yeni gerçekle**: (1) bu turda sıra **doğru** işletildi (önce migration, sonra döküm, sonra push) — disiplin tuttu; (2) daha önemlisi, kodun kendisi artık `42P01`'e karşı kalkan taşıyor (`betriebsart.js:91`, `abrechnung-einstellungen.js:665`) — şema geç kalırsa ekran kırılmıyor, özellik susuyor. Bu desen O-121'in **hasarını küçültüyor**, sebebini değil; kalıcı çözüm hâlâ O-91.

> ⚠️ **Turun kapı yarısı iki maddede birden açık kaldı ve ikisi aynı commit'e sığar:**
> O-125 (Kostenträger seed-besleme kapısı) ve O-129 (`-- SaaS: uygulandı` satırı kapısı).
> Birincisinin niye acil olduğunu **bu tur kanıtladı**: `0007` kutuya `quelle_stand = NULL`
> yazarak 08.09'dan 20.09'a kadar **on iki gün** sessizce dağıtıldı, ve bunu fark eden
> şey bir kapı değil, başka bir işin yan bulgusu oldu. Aynı boşluk şimdi **iki** tabloda
> birden duruyor (`kostentraeger_annahmestellen` + yeni `kostentraeger_anschriften`).

---

## 7S — Adım 1.3: ITSG Trust-Anchor zinciri + `/upload-signed` şifrelemesi (21.09.2026)

> **Bu bölüm niye var:** §302 Echtbetrieb planının Adım 1.3'ü üç commit'te indi
> (`9cafbc9` · `981f1b7` · `b39222e`), **main'de commitli ama push'lanmadı** — yani
> denetim yine ucuz anda yapıldı. Turu yürüten worker'ın bu oturumda `onprem`'i çağırma
> aracı yoktu ve **O-116'daki onayı gerçek diff'i görmeden varsaydı**; bu bölüm o
> varsayımın doğrulamasıdır.
>
> **Toplu hüküm: GEÇER, KAYITLA — push bloklanmıyor, sert şart yok.**
> O-116'nın üç şartının **üçü de** gerçekten uygulanmış:
> **(a) elle/airgap yükleme yolu** → `tools/itsg-trust-anchor-laden.mjs` (kendi parser'ını
> yazmıyor, modülün `parseAnnahmeliste()`'sini kullanıyor — G7);
> **(b) yerel son-kullanma kapısı** → `pruefeTrustAnchorFrische()`, 60 gün uyarı +
> tükenmişse net mesajla dur;
> **(c) altıncı kaynak** → `onprem/NOTICE-QUELLEN.txt` §6, ve "Regel für neue Quellen"
> paragrafı dosya-tabanlı artefaktları da kapsayacak şekilde genişletilmiş (O-78 deseni).
>
> **Ölçülen kutu sonuçları:**
> - Kutu ITSG'ye **hiç çıkmıyor**: `grep -rn "trustcenter"` runtime kodunda **3 satır**,
>   üçü de veri değil metin (`itsg-trust-anchor.js:189` provenance varsayılanı,
>   iki test satırı) + `dashboard.html:4178` insanın tıklayacağı bağlantı. Gerçek
>   `fetch`/`curl` **yalnız** `.github/workflows/itsg-trust-anchor-check.yml:55`'te,
>   yani merkezde. **Tip B doğrulandı.**
> - **G7 tek kod yolu:** ankerler `api-backend/billing/dta/trust-anchors/` altında ve
>   `Dockerfile:20 COPY billing ./billing` ile image'a giriyor — SaaS konteyneri ile kutu
>   konteyneri **aynı dizini aynı fonksiyonla** okuyor (`ladeItsgTrustAnchors()`).
>   İkinci yol yok.
> - **G2:** 65 dosyanın tamamı açık X.509; `terapeut_zertifikat`'a özel anahtar kolonu
>   eklenmemiş (O-120 kısıtı korundu), `empfaenger_zertifikate` yalnız açık sertifika
>   DER'i tutuyor.
> - **G1:** yeni günlük satırlarında PHI yok — yalnız IK, abrechnung-ID, SHA-256 ve hata
>   metni (Ö5 kuralı kodun içine yazılmış).
> - **Yeni secret yok** (soru 2'nin cevabı, sayıldı): bütün workflow'larda geçen secret
>   kümesi `TELEGRAM_BOT_TOKEN` · `TELEGRAM_CHAT_ID` · `GITHUB_TOKEN` — üçü de zaten
>   `preise-check.yml`/`publish-*.yml`'de kullanılıyordu. Yetki bölünmesi O-99/O-103
>   dersine uygun: job 1 `contents: read` + `npm ci --ignore-scripts`, job 2 `contents:
>   write` ve **hiçbir repo dosyasını node ile import etmiyor** (sadece `cp`/`git`).
> - **Paketleme yüzeyi:** `.vercelignore:45 api-backend/` → 65 `.der` pazarlama sitesine
>   çıkmıyor. `.dockerignore` yalnız `node_modules`/`.env`/`*.test.js` eliyor, ankerler
>   image'a giriyor.
> - **Bağımlılık tuzağı yok:** `asn1js`/`pkijs` `dependencies`'te (devDependencies'te
>   **değil**) — `33f502c`'nin `node-forge` hatasının tekrarı olmamış. Runtime import
>   eden dört dosya da prod image'da çalışır.
> - Testler: `node --test` → **17/17 geçti**.
>
> Tur **üç yeni madde** açtı (O-130 · O-131 · O-132). Üçü de push'u bloklamıyor,
> ama üçü de **ilk gerçek Echtbetrieb gönderiminden önce** kapanmalı.

### O-130 — CI'ın tazelik doğrulaması, 06.01.2027'de otomatik güncelleme zincirini **kalıcı olarak** öldürüyor ✅ **gelöst (`7472fe2`)**

| Alan | İçerik |
|---|---|
| **Ne** | `b39222e` soğuk denetimde **runtime** tarafını doğru düzeltti: tek bir erken biten anker artık bütün kasalar için şifrelemeyi durdurmuyor, yalnız uyarıyor (`pruefeTrustAnchorFrische`). **Aynı hatanın ikizi CI tarafında olduğu gibi duruyor** ve kimse düzeltmedi: indirilen listede **bir tane** bile süresi geçmiş sertifika varsa iş `needs_review=true, changed=false` verip commit'i tamamen iptal ediyor |
| **Nerede** | `tools/itsg-trust-anchor-ci-abrufen.mjs:55` (`certs.filter(c => c.notAfter < jetzt)`) → `:61-68` (`needs_review`, `changed=false`) · tetiklediği dal `.github/workflows/itsg-trust-anchor-check.yml:78-85` (yalnız Telegram) · karşılaştır: doğru yapılmış hâli `api-backend/billing/dta/itsg-trust-anchor.js:337` (`pruefzeit > spaetestesNotAfter`, yani **hepsi** bitmişse) |
| **Tip** | B (besleme zinciri) + F (zamanlanmış iş) |
| **Kutuda ne olur** | Tarih **sayıldı, tahmin değil**: `meta.json`'daki 65 ankerin notAfter dağılımı → **1 adet 2027-01-05**, 60 adet 2027-12-31, 4 adet 2029–2033. Yani **06.01.2027'den itibaren her haftalık koşu** listeyi indirir, o tek bitmiş sertifikayı görür, `changed=false` der ve **bir daha asla commit atmaz.** Görünen tek şey haftalık bir Telegram uyarısıdır — ve 11 ay boyunca her hafta gelen, hiçbir şeyi değişmeyen bir uyarının okunmayı bırakacağını varsaymak gerekir. Sonra **31.12.2027**: ankerlerin %92'si biter, `pruefeTrustAnchorFrische` sert `throw` eder ve **bütün kutularda** §302 şifrelemesi durur. Tam o sırada ITSG'nin yeni listesi yayında olacaktır; onu kutuya taşıyacak zincir ise 11 aydır ölüdür. Kutuda bunu fark edecek ikinci bir insan yok (O-46) ve biz kutuya giremeyiz (K10) — tek çıkış, her kutuya elle yeni image basmaktır |
| **Çözüm** | Runtime ile **aynı** kuralı CI'a taşı: sert dur **yalnız** `certs.every(c => c.notAfter < jetzt)` olduğunda (liste tamamen çürük = gerçekten indirme/parse hatası). Tek bir bitmiş anker → **commit yine atılır**, Telegram mesajına "N anker süresi geçmiş, bilgi" satırı eklenir. İkinci şart: `needs_review` dalı bugün `changed`'ı da bastırdığı için **hiçbir şey** olmuyor; ayrıştırılsın — inceleme gereği ile güncelleme reddi iki ayrı karardır. `builder`'ın işi, tek dosya, ~10 satır |
| **Durum** | ✅ **gelöst (`7472fe2`)** — 02.10.2026 koda karşı doğrulandı: `tools/itsg-trust-anchor-ci-abrufen.mjs:53-70` sert durma artık yalnız `abgelaufene.length === certs.length`. Önceki not: 🔴 offen — 21.09.2026'da açıldı. **Bugün zararsız** (henüz bitmiş anker yok, bu yüzden push'u bloklamıyor), **06.01.2027'den sonra sessiz.** Düzeltme bugün ucuz; kapanış tarihi olarak **2026-12-01**'den geç olmamalı |

### O-131 — Şifrelenmiş dosya üretiliyor ama **hiçbir yerden ulaşılamıyor**: müşteri hâlâ şifrelenmemiş `.p7m`'i indiriyor ✅ **gelöst (22.09.2026)**

| Alan | İçerik |
|---|---|
| **Ne** | `verarbeiteVerschluesselungsSchritt()` CMS EnvelopedData'yı üretip Storage'a yazıyor ve `{verschluesselt, encryptedPath, encryptedSha256, verschluesselungHinweis}` döndürüyor. **Bu dört alanı okuyan hiç kimse yok.** Ne DB'ye yazılıyor, ne ekranda gösteriliyor, ne de indirilebiliyor |
| **Nerede** | Üretim: `api-backend/billing/api/abrechnung.routes.js:1308-1325` · cevabı alan tek yer `dashboard.js:17653-17657` — `upJson`'dan yalnız hata okunuyor, ardından **sabit** metin: „Signiert ✓ Lade Sie die .p7m-Datei jetzt im DAS-Portal hoch." · indirme düğmesi `module/abrechnung-detail.js:456`/`:483` → `ab.signed_storage_path`, yani `<ad>.dta.p7m` = **imzalı ama şifrelenmemiş** dosya. `grep -rn "encryptedPath"` → yalnız üreten dosya + testler |
| **Tip** | G (merkez mi kutu mu — burada: özellik yarım) + O-116'nın (b) şartının ruhu |
| **Kutuda ne olur** | İki katmanlı ve ikisi de sessiz. **(1)** Şifreleme başarısız olduğunda (`verschluesselt:false` — en sık hâli "bu IK için sertifika yok", Fall A) kullanıcı **hiçbir şey görmez**: ekran „Signiert ✓" der, `verschluesselungHinweis` metni çöpe gider. SaaS'ta biz günlüğe bakıp yakalarız; kutuda günlüğe bakan yok. **(2)** Şifreleme başarılı olsa bile müşteri yanlış dosyayı indirir ve DAS portalına **şifrelenmemiş** olanı yükler; ret haftalar sonra kasadan döner. O-116 bunu kelimesi kelimesine yazmıştı: *"Sessizce başarısız olmak ya da süresi geçmiş anahtarla şifrelemek en kötü sonuçtur: dosya gider, kasa açamaz, ret haftalar sonra döner."* ⚠️ **Ek mayın:** `buildEncryptedFilename(base)` = `` `${base}.dta.p7m` `` ve `basePath` = `storage_path`, o da zaten `.dta` ile bitiyor (`abrechnung.routes.js:986`) — bugünkü sonuç `<ad>.dta.dta.p7m`, yani çirkin ama **çakışmıyor**. Biri bu çift uzantıyı "temizlemek" için `.dta`'sız bir taban geçirirse yol `signedPath` ile **birebir aynı** olur ve `upsert:true` yüzünden şifreli dosya **imzalı dosyanın üstüne yazar** — kutuda geri dönüşü olmayan, görünmeyen bir kayıp |
| **Çözüm** | Üç parça, hiçbiri şema gerektirmiyor: **(a)** `verschluesselungHinweis` ekranda gösterilsin (`verschluesselt:false` ise toast „Signiert ✓" **olmasın**, eksik ne ise o yazsın) · **(b)** indirme düğmesi `verschluesselt` olduğunda şifreli dosyayı sunsun — yolu aynı `buildEncryptedFilename()` ile **türetilsin**, kolon eklenmesin (soru 3'ün cevabı: türetme doğru tercih) · **(c)** ⛔ yüklemeden önce tek satırlık koruma: `encryptedPath === signedPath` ise **yükleme yapılmaz, hata döner** — çift uzantı mayınını kalıcı olarak etkisizleştirir. (a)+(c) bir commit'lik iş |
| **Durum** | ✅ **gelöst (22.09.2026)** — üç parçanın üçü de kapandı. **(a)** `dashboard.js:17651-17654` artık `upJson.verschluesselt` false ise "Signiert ✓" demiyor, `verschluesselungHinweis`'i `warning` tonuyla gösteriyor; ayrıca `module/abrechnung-detail.js:470` ve `module/abrechnung-verlauf.js:247` detayda/listede „⚠️ Nicht verschlüsselt" rozetini hinweis metnini `title` yaparak basıyor. **(b)** İndirme `module/abrechnung-detail.js:464`/`:498`/`:729` üzerinden şifreli dosyayı **öncelikli** sunuyor, imzalı dosya artık açıkça „Signierte Datei (unverschlüsselt)" etiketli (`:456`). Bu maddeye eklenen ikinci tur (aynı gün, dashboard.js büyüme kapısı yüzünden): `dgDownloadBtn`'in eski inline mantığı `module/abrechnung-detail.js:759 dasGuideVersandKlick()`'e taşındı, `dashboard.js` tarafında tek satırlık çağrıya indi — ve indirme ayrıca `createSignedUrl(..., { download: ab.dateiname })` ile Content-Disposition zorluyor (gkv-302 22.09.2026: SECON §3.2.3.1, şifreli dosya yerelde uzantısız gitmeli). **(c)** Çift uzantı mayını runtime kontrolüyle değil **yapısal olarak** etkisizleştirildi: `buildEncryptedFilename()` (`api-backend/billing/dta/filename.js:93-96`) `.dta`'yı kırpıp `.dta.enc.p7m` üretiyor, `signedPath` ise `.dta.p7m` (`abrechnung.routes.js:1448`) — iki yol artık **hiçbir girdi için** eşitlenemez, `upsert:true` ile üstüne yazma senaryosu ortadan kalktı. Önerdiğim guard'dan iyisi: kontrol edilecek bir şey bırakmamak. ⚠️ **Önerimden bilinçli sapma, kayda geçsin:** yukarıdaki **(b)** „kolon eklenmesin, yol türetilsin" diyordu; uygulama tersini yaptı ve `0042` ile (merge öncesi `0039`, çakışma yüzünden kaydırıldı) beş kolon ekledi (`db-ustasi` onayladı). Gerekçe benimkinden güçlü, kabul ediyorum: türetilmiş yol yalnız „dosya nerede" sorusunu cevaplar; „denendi mi, başarısız mıydı, **hangi alıcı sertifikasıyla** şifrelendi" sorularını cevaplayamaz. Üçüncüsü belirleyici — Annahmestellen sertifikalarını rotasyona sokuyor ve rotasyondan sonra eski bir dosyanın hangi anahtarla şifrelendiği türetmeyle **geri getirilemez**. Kolon grubu `signed_*` deseninin aynısı, yani aynı kavramın dördüncü yazım biçimi de doğmadı. ⚠️ **Doğrulama borcu:** bu hüküm **koda karşı okundu, çalışan bir akışta tetiklenmedi.** İki kontrol: (1) sertifikası olmayan bir IK ile `/upload-signed` koşunca ekranda gerçekten uyarı çıkıyor mu, (2) başarılı şifrelemeden sonra inen dosya gerçekten `.dta.enc.p7m` mi. ⛔ Bu iki kontrol yapılmadan **hiçbir tenant `echt`'e alınmaz** — planın kilidi kendi gerekçesiyle yerinde kalıyor. Ayrıca O-131 kapandı diye **kutuda** şifreleme çalışır hâle gelmedi: kutuda `empfaenger_zertifikate` hâlâ boş doğuyor (**O-132**, açık), yani kutuda her gönderim (a)'nın uyarı yoluna düşer — doğru davranış, ama özellik yok |

### O-132 — `empfaenger_zertifikate`'yi dolduran tek yol bizim yönetici makinemiz: kutuda tablo **hep boş kalır** 🔴 **offen**

| Alan | İçerik |
|---|---|
| **Ne** | Şifreleme, alıcının sertifikasını `public.empfaenger_zertifikate`'den okuyor. O tabloya yazan tek şey `tools/empfaenger-zertifikat-laden.mjs`; script `api-backend/.env`'den `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` okuyup PostgREST'e POST atıyor — yani **bizim elimizden, bizim projemize.** Kutuda ne bu script koşar, ne biz koşabiliriz (K10). Ne seed migration'ı var, ne owner'ın kendi ekranından yükleyebileceği bir yer, ne de kurulum adımı |
| **Nerede** | Yazan: `tools/empfaenger-zertifikat-laden.mjs:25-39` (`.env` okuma) · `:154-168` (service_role ile POST) · Okuyan: `api-backend/billing/api/abrechnung.routes.js:1240` · Tablo: `api-backend/db/migrations/0038_empfaenger_zertifikate.sql` (RLS: okuma herkese, yazma yalnız `service_role` — "Kein öffentlicher HTTP-Upload-Endpunkt (G8-Regel)") · `grep -rn "empfaenger_zertifikate"` → kutuda çalışan **hiçbir** yazma yolu yok |
| **Tip** | D (şema/veri kutuya nasıl varacak) + G |
| **Kutuda ne olur** | Kutu kurulur, migration koşar, tablo **boş** doğar. Her şifreleme denemesi Fall A'ya düşer (`verschluesselt:false`) — ve O-131 yüzünden müşteri bunu **göremez** bile. Yani §302 şifrelemesi kutuda **hiç** çalışmaz, ve bunun sebebi bir hata değil, eksik bir dağıtım yoludur. İroni kayda değer: alıcıların sertifikaları **zaten image'ın içinde** — `annahme-rsa4096.key` Annahmeliste'sinin ta kendisi 65 dosya olarak `billing/dta/trust-anchors/` altında duruyor. Aynı veri iki mekanizmayla taşınıyor; biri (dosya artefaktı, tip B) kutuda çalışıyor, diğeri (DB tablosu, elle) çalışmıyor |
| **Çözüm** | Sıralı iki seçenek, ikisi de G7'ye uygun (tek kod yolu): **(1) tercih edilen —** çözücü önce `empfaenger_zertifikate`'ye baksın (override/istisna için), satır yoksa **image'daki listeden IK'ya göre** alıcı sertifikasını seçsin. Böylece kutu da SaaS da aynı dosyadan beslenir, elle adım kalmaz. ⚠️ Ön şart `gkv-302`'ye tek soru: Annahmeliste'deki sertifikanın Subject'i IK'yı taşıyor mu, taşımıyorsa eşleme neye göre yapılır. **(2) yedek —** liste bir **seed migration**'a dönüştürülsün (O-79/O-118 deseni, üretici `tools/` altında, elle 65 satır yazılmaz) — ama bu O-128'i (seed migration'larının birikmesi) büyütür ve her rotasyonda yeni migration ister; bu yüzden ikinci sırada. ⛔ **Üçüncü bir seçenek olarak "kutu listeyi kendisi indirsin" DUR alır** — O-116'nın kapattığı kapı odur |
| **Durum** | 🔴 **offen** — 21.09.2026'da açıldı. Bu, O-116'nın **çözülmeyen yarısıdır**: anker (CA) tarafı tip B ile kutuya vardı, **alıcı sertifikası** tarafı varmadı. Bu yüzden O-116 `gelöst` değil 🟡 `kısmen` |

### O-133 — "SaaS'a uygulandı mı" kaydı artık **kendi kendisiyle çelişiyor**: `0036`/`0037` iki dosyada iki farklı cevap veriyor ✅ **gelöst (22.09.2026)**

| Alan | İçerik |
|---|---|
| **Ne** | O-129 "kayıt **yok**" diyordu. Bu turda bir seviye kötüsü çıktı: kayıt **var ve iki yerde birbirinin tersini söylüyor.** `0036_seed_kostentraeger_anschriften` ve `0037_seed_kostentraeger_annahmestellen_quelle_stand` için `erwartete-zaehler.json` "**BEWUSST NICHT** auf die SaaS-Datenbank angewendet — BOX-ONLY" derken, aynı depoda `db/SCHEMA.sql` + `db/SCHEMA-RLS.sql`'in 22.09 künyesi "✅ **Alle drei** im SaaS angewendet 20./21.09.2026 (MCP)" diyor. Üçüncü dosyada (`0038`) ikisi hemfikir; çelişki yalnız iki seed dosyasında |
| **Nerede** | `api-backend/db/erwartete-zaehler.json` → `_hinweis_0036_0037` ("BOX-ONLY", gerekçesi de yazılı: SaaS'ta aynı veri `tools/kostentraeger-annahmestellen-laden.mjs` ile zaten var, 20.09.2026'da canlıda sayıldı — 1588 + 11407 satır) · `db/SCHEMA.sql` künyesi (22.09.2026 tazelemesi, "Alle drei im SaaS angewendet") · aynı cümle `db/SCHEMA-RLS.sql` künyesinde de var |
| **Tip** | D |
| **Kutuda ne olur** | Kutuda hiçbir şey — ikisi de idempotent UPSERT, iki kez koşsa zarar vermez. Hasar yine **merkez ile kutu arasındaki hesapta**, ve O-129'dan beter: eksik kayıt "bak ve öğren" ile kapanır, **çelişkili kayıt kapanmaz** — okuyan hangisine inanacağını bilemez, ikisi de yazılı olduğu için ikisi de savunulabilir görünür. Somut sonuç: biri "SaaS'ta yok" deyip tekrar uygularsa zarar yok, ama biri "SaaS'ta var" deyip `tools/kostentraeger-annahmestellen-laden.mjs`'i bir daha hiç koşturmazsa referans veri (Annahmestellen/Anschriften) sessizce bayatlar ve §302 dosyası yanlış adrese gider. ⚠️ **Ölçümle çözülemez:** iki senaryo da aynı DB durumunu bırakıyor (veri her hâlükârda orada, iki farklı yoldan gelmiş olabilir) — yani burada yazılı kayıt tek gerçek kaynak, ve tam o kaynak bozuk |
| **Çözüm** | Tek cümlelik düzeltme, ama **yönü** bilgiyi tutan kişiye ait (Kemal / `db-ustasi`): `0036`/`0037` MCP ile canlıya gerçekten uygulandıysa `_hinweis_0036_0037`'deki "BEWUSST NICHT angewendet" cümlesi düşer ve BOX-ONLY iddiası geri alınır; uygulanmadıysa iki dökümün künyesindeki "Alle drei" → "0038" olur. ⛔ **Tahminle kapatılmaz** — maddenin varlık sebebi tam olarak "birinin makul görünen tarafı seçip yazması". Kalıcı çözüm O-129'un kapısıdır: yeni migration staged ise başlıkta `-- SaaS: uygulandı …` veya `-- SaaS: uygulanmaz — <gerekçe>` aranması. O kapı kurulu olsaydı bu çelişki doğamazdı, çünkü **tek** yazım yeri olurdu |
| **Durum** | ✅ **gelöst (22.09.2026, bu turda)** — `0039` turunda bulundu (o sırada dosya `0039_abrechnung_verschluesselung.sql`, merge sırasında `0042`'ye kaydırıldı, bkz. O-108). İlk yazımda migration dosyasının kendi başlığında "✅ Im SaaS angewendet" satırı yoktu, sadece döküm künyesinde ve `_hinweis_0039`'daydı — düzeltme penceresi hâlâ açıkken (ilk kutu kurulmadı) `api-backend/db/migrations/0042_abrechnung_verschluesselung.sql`'in başına `-- SaaS: angewendet 22.09.2026, MCP.` satırı eklendi. Bu artık kuralın istediği yerde duruyor. |

### Bu turda durumu değişen madde

- **O-116** 🟠 geplant → 🟡 **kısmen (`9cafbc9` + `981f1b7` + `b39222e`)**: üç şartın üçü de
  uygulandı (airgap yolu · yerel son-kullanma kapısı · NOTICE §6), kutudan runtime indirme
  **hiç yazılmadı** (ölçüldü: 0 çağrı), G7 tek kod yolu korundu. `gelöst` sayılmıyor,
  çünkü zincirin ikinci yarısı (**alıcı** sertifikasının kutuya varması) O-132 olarak açık
  ve teslim yolu O-131 olarak eksik.

> **Küçük notlar (kendi numarasını hak etmeyen, ama kaydı düşülen):**
> - `.github/workflows/itsg-trust-anchor-check.yml:117` `cp -r` ile kopyalıyor, **silmiyor** —
>   listeden düşen bir anker `.der` dosyası olarak repoda kalır. Güven sorunu **değil**:
>   `ladeItsgTrustAnchors()` dizini taramıyor, yalnız `meta.json`'daki listeyi okuyor
>   (`itsg-trust-anchor.js:277-288`), yani düşmüş anker yüklenmez. Yalnız çöp birikir.
> - `.gitignore`'da `api-backend/_staging_trust_anchors/` ve
>   `api-backend/trust-anchors-telegram-message.txt` yok — CI'da zararsız (o job commit
>   atmıyor), ama script'i yerelde çalıştıran biri bu iki artığı yanlışlıkla commit'leyebilir.

---

## 7T — Ön kontrol: STACKIT AI Model Serving, "anahtar bizden" modeli (29.09.2026)

> **Soru (Kemal, 29.09.2026):** Praxura tek STACKIT hesabı açar, her praxis için ayrı
> STACKIT projesi + proje-bazlı token üretir. Praxis STACKIT hesabı açmaz; istek
> kutudan/app'ten doğrudan STACKIT'e gider (K6 metni korunur); faturayı praxise biz keseriz.
> Token image'a/repo'ya/pakete gömülmez — kurulumda ve sonra lisans kanalıyla (imzalı lisans
> dosyasının yanında, gecelik yenilemede) teslim edilir, rotasyon/iptal merkezden.
> Bu, 12.09'da ⛔ düşen ve 28.09'da "şartlı mümkün" diye yeniden açılan **Seçenek B**'nin
> STACKIT sürümü (`konsey/tutanak/2026-09-12-onprem-ai-modeli.md`,
> `konsey/tutanak/2026-09-28-onprem-ai-secenek-b-yeniden.md`).
>
> **Doğrulanan kod durumu (29.09.2026):** `ai/llmClient.js` **yok** (`ls api-backend/ai/`);
> `azureClient.js:38-40` üretimde anahtar yokken hâlâ `throw`; lisans mekanizması **yok**
> (`grep -rln "lizenz\|license" api-backend` → yalnız `validators/standardRules.js`, alakasız);
> `onprem/docker-compose.yml:470-472` yalnız `AI_PROVIDER/AI_ENDPOINT/AI_API_KEY` geçiriyor.
>
> **STACKIT tarafı (docs.stackit.cloud, 29.09.2026 okundu):** token proje başına, oluşturmada
> TTL verilir (`validUntil`), `DELETE /v1/projects/{id}/regions/eu01/tokens/{tokenId}` ile tek
> tek silinir, bir kez gösterilir. Rate limit'ler **model başına sabit fair-use** değerleri
> (ör. Qwen3-VL 235B: 350.000 TPM / 30 RPM; Gemma 4 31B: 200.000 TPM / 80 RPM) —
> **proje mi, token mı, organizasyon mu bazında sayıldığı yazılı değil**, müşterinin limiti
> düşürebildiği yazılı değil, **harcama tavanı (spend cap) yazılı değil.**

### O-134 — Yönetilen AI token'ı (STACKIT, anahtar bizden, lisans kanalıyla): G2 vetosu yok, ama model K4'ü açıyor ve teslim kanalı henüz yok ⚪ **widerlegt (05.10.2026, K-20 → O-169)**

| Alan | İçerik |
|---|---|
| **Ne** | Bizim STACKIT hesabımızdan üretilen, praxis başına ayrı projeye bağlı AI token'ının müşteri kutusunda çalışması |
| **Nerede** | Henüz kod yok. Dokunacağı yerler: `api-backend/ai/azureClient.js` (→ `llmClient`, Faz 1.3) · lisans modülü (Faz 3.1/3.2, yazılmadı) · `onprem/install.sh` (aktivasyon) · `onprem/docker-compose.yml:470-472` |
| **Tip** | **E** (bizim sırrımız müşteri sunucusunda) + **A** (kutu → STACKIT) + **F** (merkezde rotasyon + maliyet bekçisi) + **G** (merkezde provisioning) + **H** (AI yetkisi lisanstan) |
| **Kutuda ne olur** | Token kutuda **okunabilir** — müşteri sunucunun sahibi, root'u var; dosya, env, DB fark etmez. Yani K5'in gerekçesi ("her sır okunabilir → sızar → faturası bize keser") **hâlâ doğru**; değişen, zararın sınırlandırılabilir olması: token tek praxise ve tek projeye bağlı, TTL'li, merkezden silinebilir. İnternet yoksa: token TTL'i dolana kadar AI çalışır (STACKIT'e çıkış zaten internet ister), sonra AI sessizce kapanır — uygulama açık kalmalı (O-07 şartı, bugün `azureClient.js:40` bunu bozuyor). Bizim sunucumuz kapalıysa: rotasyon durur, TTL içinde AI çalışmaya devam eder |
| **Çözüm** | Aşağıdaki **hüküm + şartlar**. Playbook'ta bu iş için görev yok → **Faz 3.5 önerisi** ("yönetilen AI anahtarı: provisioning + lisans yükü + rotasyon + maliyet bekçisi") — Faz 3.1/3.2'ye bağımlı |
| **Durum** | `offen` — **iki karar sahibinde:** (1) **Kemal K4'ü açıkça açar** (K4 = "müşterinin kendi hesabı/anahtarı"; bu model onu doğrudan tersine çeviriyor — konsey açamaz, ben açamam; açılırsa playbook §2'ye yazılır). (2) `legal-de`'nin 29.09 hükmü (`compliance/LEGAL_DECISIONS.md:348-349`): *on-prem'de "kein Reselling (Ziff. 20) und kein Key von uns — sonst Rolle + §393 zurück (K6)"* + 28.09 memosu F1 (Auftragsverarbeiter'in kendi C5'i). **Bu modelin bugünkü gerçek engeli benim vetom değil, bu ikisi** — **05.10.2026: `widerlegt`.** Öncül düştü: STACKIT hesap açmadı (01.10), model yerine K-20 geldi (tek Praxura Azure kaynağı + kısa ömürlü Entra jetonu, O-169). Engel (1) kalktı: Kemal K4'ü K-20 ile değiştirdi. Engel (2) (legal-de, rol/§393) jeton modeliyle **kalkmadı** — O-169'da açılış sırasına bağlandı. Şartlar silinmedi, O-169'a devredildi (aşağıdaki sapma notu) — Önceki: `offen` |

**Hüküm — G2: veto YOK (şartlı).** G2'nin metni *image'a, repo'ya, kurulum paketine gömme*yi
yasaklar. Token çalışma zamanında, kutuya özel, lisans kanalıyla gelir → metin ihlal edilmiyor.
Bu 28.09'daki Azure-B hükmümle tutarlı (orada da veto vermedim). K5'in metni ("pakete
gömülmez") da ihlal edilmiyor; K5'in **gerekçesi** ise ancak aşağıdaki şartlar sağlanırsa
karşılanıyor. Şartlardan biri eksikse model G2/K5 ruhunu çiğner ve ⛔ geri gelir.

> **05.10.2026 sapma notu (K-20, O-169):** Bu şartların K-20'ye devri: **1–2** (token diske/yedeğe/tanılama paketine girmez) jeton **yalnız bellekte** tutulduğu için kendiliğinden karşılanıyor; kalıcı sır artık yalnız kutu kimliği (Ed25519 özel anahtarı) — aynı yer kuralı onun için geçerli. **3'ten bilinçli sapma:** "kullanım kutudan merkeze raporlanmaz" STACKIT'in proje bazlı faturasına dayanıyordu; tek Azure kaynağında praksis başına ayrım yok. K-20'de kutu jeton isteğine **toplu** kullanım ekler (görev adı + token in/out, son jetondan beri; tek tek çağrı zamanı yok, hasta verisi yok) — ama bu **yalnız bilgi**: sınır merkezin **verdiği jeton sayısına** dayanır, kutunun beyanına değil (kurcalanmış kutu eksik bildirir). G1 temiz kalır: istek kutu kimliği + sürüm + toplu sayaç taşır. **4** (TTL/rotasyon) 60–90 dk Entra ömrüyle değişti. **5–7, 9–10** aynen geçerli. **8** (maliyet tavanı) Azure'da TPM + budget alert ile karşılanıyor (O-137).

**Şartlar (hepsi, uygulama öncesi):**

1. **Token asla image/repo/paket/`.env.template`'e girmez; `.env`'e de yazılmaz.** `.env`
   `docker inspect` ile düz okunur, `backup.sh` ile kopyalanır, elle düzenlenir, rotasyonu
   container yeniden yaratmayı ister. Yer: lisans dosyasının yanındaki kalıcı volume'da ayrı
   dosya (`0600`, yalnız `api` konteynerine mount), ya da lisans yükünün içinde. **DB'ye
   yazılmaz** (DB dökümü yedeğe ve — Faz 2.5a — tanılama paketine gider).
2. **Tanılama paketi (Faz 2.5a) bu dosyayı hariç tutar.** Paket bize gelir; içinde kendi
   token'ımızı görmek zararsız görünür ama aynı paket müşterinin e-postasında durur.
3. **Teslim yalnız lisans kanalıyla, iki anda:** (a) ilk aktivasyon cevabı (`install.sh`
   token'ı **sormaz**, 28.09 şartı aynen), (b) gecelik `/license/renew` cevabı. **İstek
   genişlemez** — G1: istek yalnız lisans-ID + sürüm taşır; token yalnız **cevapta**. Kullanım
   sayısı/token tüketimi kutudan merkeze **raporlanmaz**; maliyet STACKIT'in proje bazlı
   faturasından okunur (bunun proje bazlı ayrıştığı **doğrulanmadı** → O-137).
4. **Token TTL'li üretilir ve üst üste binen rotasyonla yenilenir.** Öneri: TTL 14 gün,
   her gece yeni token, eski token 48 saat sonra merkezden silinir. TTL, lisansın 30 günlük
   penceresinden **kısa** tutulur: merkez ulaşılamasa bile sızan token en geç TTL sonunda
   ölür. Sonuç: 14 günden uzun offline kalan kutuda AI kapanır — kabul edilebilir, çünkü
   G5 yalnız görüntüleme + dışa aktarmayı korur, AI'yı değil.
5. **Kill-switch ile birleşme (K9):** AI, K9 durum makinesinde zaten salt-okunur modda
   kapanıyor (playbook Faz 3, "yeni randevu/abrechnung/AI kapalı"). Merkez aynı anda
   (`valid_until` + 14 gün tolerans) o praxisin **bütün token'larını siler** ve yenileme
   cevabına token koymaz. İki kilit: kutu yerelde lisans durumundan AI'yı kapatır (internet
   yokken de çalışır), merkez STACKIT'te token'ı öldürür (kutu kurcalanmışsa da çalışır).
   **Bilinçli maliyet penceresi:** uyarı + tolerans boyunca (en fazla ~44 gün) AI açık kalır,
   ödenmemiş kullanımı biz öderiz — daha erken kesmek ticari karardır, K9'u değiştirmez.
6. **Merkezdeki STACKIT hesap kimliği (service account / proje ve token üretme yetkisi)
   yalnız merkezde yaşar** — lisans imzalama private key'iyle aynı sınıf (G2 ikinci cümlesi).
   Kutuya giden tek şey tek-proje, TTL'li inference token'ı; proje/token **üretme** yetkisi
   asla.
7. **Merkez tarafı `api/`'ye yeni dosya olarak yazılamaz** (12/12, G8). Provisioning,
   rotasyon ve maliyet bekçisi lisans sunucusunun evine gider; o ev henüz seçilmedi (Faz 3.1).
8. **Maliyet tavanı merkezde kurulur** (O-137): STACKIT'te harcama tavanı ve ayarlanabilir
   limit belgelenmediği için, 28.09'daki Azure şartının ("kaynak başına düşük TPM kotası")
   karşılığı **yok**. Yerine: merkezde günlük iş, proje bazlı tüketimi okur, eşik aşılırsa
   token'ı siler + Kemal'e bildirir. Bu doğrulanmadan model canlıya çıkmaz.
9. **BYO her zaman öncelikli.** Müşteri kendi `AI_API_KEY`'ini girdiyse lisans token'ı
   kullanılmaz (bize maliyet yok, K4 yolu açık kalır).
10. **Ara çözüm YOK:** Faz 3.1/3.2 yazılmadan "ilk müşteriye token'ı elle `.env`'e
    yapıştıralım" = **DUR** (şart 1, 3, 4, 5'in hepsini çiğner). Lisans kanalı yoksa ilk
    müşteri ya AI'sız (E kararı) ya kendi hesabıyla (C, 14.09 kararı) başlar.

**SaaS tarafı (`app.praxura.de`) — öneri: TEK token.** SaaS'ta çağrı zaten bizim VPS'imizden
çıkıyor, anahtar hiçbir müşteri sunucusuna gitmiyor — G2/K5'in korktuğu senaryo yok. Praxis
başına token SaaS'ta yalnız **sır yönetimi yükü** getirir (tenant başına şifreli sır, DB'de).
Maliyet ayrımı zaten var: `ai_audit_log` owner başına token tutuyor (28.09 tutanağı,
`fonksiyon-ustasi`). Praxis başına AI'yı kapatmak token'la değil yetki bayrağıyla yapılır
(Faz 3.3 `entitlements`). **G7 korunur:** kod yolu aynı `llmClient`; değişen yalnız anahtarın
kaynağı (SaaS: env · yönetilen kutu: lisans dosyası · BYO kutu: env) — O-135.
SaaS için ayrı bir STACKIT projesi ("saas") yeterli; praxis başına proje gerekmez.

### O-135 — Anahtar modül yüklenirken okunuyor: gecelik rotasyon restart ister; "anahtar kaynağı" soyutlaması Faz 1.3 planında yok 🟠 **geplant (Faz 1.3)**

| Alan | İçerik |
|---|---|
| **Ne** | Bugünkü istemci anahtarı ve endpoint'i import anında sabitliyor; llmClient bu deseni kopyalarsa lisans kanalından gelen gecelik rotasyon ancak restart ile devreye girer |
| **Nerede** | `api-backend/ai/azureClient.js:11-12` (`const ENDPOINT = process.env…`, `const API_KEY = process.env…` — modül seviyesinde) · 12.09 tutanağı "Uygulama" maddesi yalnız env adlarını sayıyor |
| **Tip** | E + H |
| **Kutuda ne olur** | Gece yeni token gelir, eski 48 saat sonra silinir; restart olmazsa (Watchtower yeni image yoksa restart yapmaz) 48. saatte AI sessizce 401 alır |
| **Çözüm** | Faz 1.3'e gereksinim: (1) `getAiCredential()` — sıra: env `AI_API_KEY` (BYO/SaaS) → lisans token dosyası → yok = AI kapalı; (2) çağrı başına ya da dosya `mtime`'ı değiştiğinde okur, süresiz cache'lemez; (3) 401 gelirse bir kez dosyayı yeniden okuyup tekrar dener, yine 401 ise AI "kapalı" durumuna düşer, uygulama çökmez. Endpoint ve model adları da lisans yükünden gelebilmeli (sağlayıcıyı image çıkarmadan değiştirmek için); sağlayıcı-bazlı bölge kontrolü STACKIT için host'un `eu01` bölgesinde olmasını ister. **Yeni env var gerekmez**; STACKIT host'u koda sabit yazılmaz (tip C'den kaçınma: host lisans yükünden ya da `AI_ENDPOINT`'ten gelir) |
| **Durum** | `geplant` (Faz 1.3) |

### O-136 — `AI_MODEL_TEXT` / `AI_MODEL_VISION` kutu compose'unda ve `.env.template`'de yok ✅ **gelöst (02.10.2026, KHS K2)**

| Alan | İçerik |
|---|---|
| **Ne** | 12.09 ve 28.09 kararlarının saydığı `AI_MODEL_*` değişkenleri kutuya geçirilmiyor |
| **Nerede** | `onprem/docker-compose.yml:470-472` (yalnız üç `AI_*`) · `onprem/.env.template:223-225` |
| **Tip** | E (env yüzeyi) — O-50'nin aynı sınıfı: değişken planda var, paketten düşmüş |
| **Kutuda ne olur** | BYO müşteri model adını giremez; llmClient varsayılana düşer. Model adı sağlayıcıya özel (Azure deployment adı ≠ STACKIT model kimliği) — varsayılan yanlış modele gider ya da 404 alır |
| **Çözüm** | llmClient yazıldığı commit'te compose + `.env.template`'e eklenir (Faz 1.3). Yönetilen modelde değerler lisans yükünden gelir; env boşsa lisans değeri kullanılır |
| **Durum** | `gelöst` (`67dbe9d`, K2.7): `onprem/docker-compose.yml:477-478` + `onprem/.env.template:216-217`. Kodun bu adları okuması O-151/M4.1'de — Önceki: `geplant` (Faz 1.3) |

### O-137 — STACKIT'te harcama tavanı ve limit kapsamı belgelenmemiş: "praxis başına ayrı limit, ayrı maliyet satırı" iddiası doğrulanmadı ⚪ **widerlegt (05.10.2026, STACKIT düştü)**

| Alan | İçerik |
|---|---|
| **Ne** | Modelin iki vaadi (ayrı rate limit, ayrı maliyet satırı) STACKIT belgelerinde yok |
| **Nerede** | docs.stackit.cloud → AI Model Serving "Available shared models" (limitler model başına, kapsam yazılmamış) · FAQ (spend cap yok) · 29.09.2026 okundu |
| **Tip** | F (merkezde maliyet bekçisi gerekecek) + G |
| **Kutuda ne olur** | (a) Limit **organizasyon** bazındaysa tek praxisin yükü (ya da sızan bir token) bütün praxislerin **ve SaaS'ın** AI'sını 429'a düşürür. (b) Harcama tavanı yoksa sızan token'ın maliyeti yalnız bizim silme hızımızla sınırlı. (c) Maliyet proje bazında raporlanmıyorsa O-134 şart 3'ün "kullanım kutudan raporlanmaz" çözümü çöker — o zaman kutudan merkeze kullanım kanalı gerekir, bu da G1'e dokunur |
| **Çözüm** | STACKIT'e yazılı soru (Kemal, 29.09 mailine ek): limit proje/token/org bazında mı · proje başına kota düşürülebiliyor mu · harcama tavanı/bütçe kesmesi var mı · maliyet proje bazında API ile okunabiliyor mu · organizasyon başına proje sınırı kaç. Cevaba göre merkezde günlük maliyet bekçisi (O-134 şart 8). **Ops kartı açılmalı** (Launch) — kart no. buraya yazılana kadar `offen` |
| **Durum** | `widerlegt` (05.10.2026) — soru STACKIT'e özeldi; STACKIT hesap açmadı (01.10), K-20 ile sağlayıcı Azure. Azure karşılığı O-169'da: tek deployment'ın **TPM kotası** = en kötü saatlik maliyetin üst sınırı (Azure'da sert harcama tavanı yok) + budget alert → merkezde otomatik jeton kesme. (c) maddesinin korktuğu "kutudan merkeze kullanım kanalı" K-20'de açıldı, G1 sınırıyla (O-134 sapma notu) — Önceki: `offen` |

---

## 7U — Ön kontrol: `0044_leads_krankenkasse_ik` (Reform S3.8, 30.09.2026)

Hüküm **GEÇER**, yeni madde açılmadı. Gerekçe tekrar araştırılmasın diye:

- **Tip D**, tek nullable `text` kolon + CHECK + COMMENT. G1/G2/G3/G8'e dokunmuyor: Karten-IK
  hasta verisidir ama `leads`'te, kutunun kendi Postgres'inde kalır; dış çağrı, sır, n8n, yeni
  bulut zinciri yok. Sayaç-nötr (O-108'in on ikinci uygulaması, `_hinweis_0044`).
- **SaaS sırası:** önce MCP ile kolon, **sonra** ön yüz push'u. Ters sıra = PostgREST
  "column not found" → `leads` insert/update'in **tamamı** düşer, yalnız alan değil.
  SaaS'ta runner koşmuyor (`DATABASE_URL` yok, `migrations/README.md:118`) — MCP'den sonra
  runner'ın aynı dosyayı ikinci kez denemesi (ve `ADD CONSTRAINT`'in IF NOT EXISTS'siz
  çakışması) riski yok.
- **CHECK tuzağı:** 9 hane dışı her değer (boşluklu OCR çıktısı, `''`) `23514` ile **bütün
  kaydı** reddeder. Üç yazma yolu (leadSaveBtn, Schnellerfassung, OCR abgleich) yazmadan önce
  rakam dışını ayıklamalı, boşu `null` yapmalı, 9 hane değilse alanı göndermemeli.
- **`:beta`/`:stable`:** additive, eski image kolonu bilmez, zararsız. Kutuda ön yüz ile
  migration aynı image'da gelir; runner açılışta uygular, `pgrst_ddl_watch` (Supabase image'ının
  event trigger'ı) PostgREST cache'ini tazeler. Migration düşerse kutu bakım moduna girer
  (`server.js:4574`), yeni ön yüz kolonsuz DB'ye yazmaz.
- **Kayıt disiplini (O-129/O-133):** MCP'den sonra aynı commit'te dosya başlığındaki
  "SaaS: NOCH NICHT angewendet" → "SaaS: angewendet <tarih>, MCP", `_hinweis_0044`'teki
  aynı cümle ve döküm künyesi. 0041 için `db-ustasi` 27.09 uygulamasını doğruladı; başlık satırı zaten
  doğru (`0041_krankenkassen_ik_nachtrag.sql:43`), yanlış olan yalnız sprint notuydu.

---

## 7V — Ön kontrol: Kostenträgerdatei RSS izleyicisi + geçerlilik tarihli yükleme (30.09.2026)

Oturum B sordu, kod yazılmadan önce. Neden: Q4/2026'da AOK/BKK/IKK dosyaları çeyrek
başından yalnız 2-3 gün önce yayınlandı, Kemal elle takip edemiyor. İki ayrı öneri, iki madde:
izleyici (O-138) ve şema (O-139). İkisi de O-118'in açık kalan yarısına dokunuyor.

### O-138 — Kostenträgerdatei RSS izleyicisi: merkez tarafı, tip B+F, yalnız rapor 🟠 **geplant (hüküm GEÇER, KAYITLA)**

| Alan | İçerik |
|---|---|
| **Ne** | GitHub Actions'ta günlük iş: gkv-datenaustausch.de'nin "Kostenträgerdateien sonstige Leistungserbringer" RSS'i çekilir, entry ID'ler (doğrudan dosya linki) `tools/kostentraeger-annahmestellen-laden.mjs:48` `AUSGABEN` listesi + `wissensbank/REGISTER.md` W-01 ile karşılaştırılır. Yeni dosya varsa indirilir (sha256), `parser.js` + `datei-lesen.js` ile ayrıştırılır, fark kontrolleri Telegram'a gider. **Otomatik commit yok, otomatik DB yazımı yok** |
| **Nerede** | Önerilen: ayrı `.github/workflows/kostentraeger-check.yml` (henüz yazılmadı). Emsal: `itsg-trust-anchor-check.yml` (ayrı feed = ayrı workflow) · `preise-check.yml` (O-34 şablon). İçe aktarılacak kod: `api-backend/billing/kostentraeger/parser.js` → `../dta/encoding.js` (hiç import'u yok) · `datei-lesen.js` → yalnız `node:fs`. **Zincirde tek bir npm paketi yok** (30.09.2026'da import satırları sayıldı) |
| **Tip** | B (dış veriyi merkez çeker) + F (zamanlanmış iş, merkezde) |
| **Kutuda ne olur** | **Hiçbir şey. Kutu gkv-datenaustausch.de'ye hiç çıkmaz.** İş image'a girmez, kutuya yeni kod/şema/env eklemez. Kutunun kazancı dolaylı: yeni dosya 2-3 gün önceden haber verilir, seed migration (`0045` sınıfı) çeyrek başından **önce** image'a girebilir. G1: hasta verisi yok (kamu dosyası). G2: tek sır Telegram token'ı, GitHub secret'ta duruyor, image'da değil. G3/G8: n8n yok, Vercel yok, runtime bulut zinciri yok, O-34'ün aynısı. **Veto yok** |
| **Çözüm** | Hüküm **GEÇER, KAYITLA**, dört şartla: **(1)** Ayrı workflow, **tek job**, `permissions: contents: read`, **`npm ci` hiç koşmasın** (zincir yalnız yerel dosya + `node:fs`; bağımlılık kurmamak S-28/O-99 sınıfı riski kökten siler). DB secret'ı yok. **(2)** Telegram token'ı yalnız son `curl` adımının `env:`'inde durur; parse adımı token'ı görmez. Mesaj metni dosya olarak son adıma geçer. **(3)** RSS entry ID / dosya adı Telegram metnine ve shell'e **doğrulanmadan** girmesin: beklenen dosya adı kalıbı dışında kalan (ör. `^[A-Z]{2}[0-9A-Z]{6}_KE[0-9]\.txt$` benzeri, kesin kalıbı mevcut 11 dosya belirler) her giriş yalnız "tanımsız giriş" uyarısı üretir (O-99 yan bulgusu: dışarıdan gelen tarih doğrulanmadan koda enjekte ediliyordu). İndirme yalnız `https://www.gkv-datenaustausch.de/` önekli linklerden yapılır. **(4)** O-130 dersi: tek bir anormal kontrol (ör. U+FFFD) yalnız **o dosyanın** raporunu "incele" diye işaretlesin, diğer yeni dosyaların haberini yutmasın. Ayrıca RSS 3 gün üst üste inmezse "izleyici kör" uyarısı gelsin; sessiz ölüm burada da mümkün |
| **Durum** | 🟠 **geplant**, uygulayan `builder`. Kapanış ölçütü: workflow indi ve ilk `workflow_dispatch` koşusunda Q4 dosyaları "zaten biliniyor" çıktı (commit no. ile `gelöst`) |

### O-139 — `kostentraeger_annahmestellen` / `_anschriften`'e geçerlilik penceresi: kutuya iki adımda varır 🟠 **geplant — Adım 1 SaaS'ta uygulandı (01.10.2026), commit bekliyor; Adım 3 ayrı karar**

| Alan | İçerik |
|---|---|
| **Ne** | Öneri: iki tabloya geçerlilik kolonları + okuyucu filtresi (`annahmestelle.js:71` `waehleAnnahmestelle`, ayrıca `ladePapierannahmestelle`). Böylece gelecek çeyreğin verisi önceden yüklenir, geçiş gece yarısı kendiliğinden olur. Bugün yükleme 01.x günü elle koşmak zorunda, kutu da seed gelene kadar eski alıcıda kalıyor |
| **Nerede** | `db/SCHEMA.sql` `kostentraeger_annahmestellen` (UNIQUE `kostentraeger_ik, verknuepfungsart, partner_ik, abrechnungscode, …`, **geçerlilik kolonu içermiyor**) · `kostentraeger_anschriften` · okuyucu `api-backend/billing/kostentraeger/annahmestelle.js:71` · yükleyici `tools/kostentraeger-annahmestellen-laden.mjs:48` (`AUSGABEN`; "neueste Ausgabe mit gültig-ab <= Stichtag" kuralı **zaten burada**, ama yalnız yükleme anında uygulanıyor) · seed üretici `tools/seed-generieren.mjs` |
| **Tip** | D (şema), `:beta`/`:stable` dağıtım etkisiyle |
| **Kutuda ne olur** | Doğru kurulursa en büyük kazanç **kutuda**: seed çeyrek başından haftalar önce image ile gelir, kutu 01.x gecesi kimse dokunmadan doğru alıcıya geçer (O-46: kutuda bunu fark edecek kimse yok). **Yanlış sırayla kurulursa** tehlike de kutuda: gelecek tarihli satırlar filtresi olmayan bir okuyucuya ulaşırsa (`:stable` hâlâ eski kodu çalıştırıyorsa) aynı IK için iki sürüm yan yana görünür. O zaman `waehleAnnahmestelle` ya belirsizlikte durur ya da **yeni alıcıyı erken** seçer. Yani filtreyi bilen kod bütün kanallarda canlı olmadan veri gelemez |
| **Çözüm** | **Expand/contract, üç adım (G7, `SCHEMA-VERTEILUNG.md` disiplini).** **Adım 1 (migration A + kod, aynı image):** `gueltig_von date NULL`, `gueltig_bis date NULL` (adlandırma `heilmittel_tarif` ile aynı olsun, `valid_from/to` değil). NULL = sınırsız, yani mevcut satırların anlamı değişmez. UNIQUE'e `gueltig_von` eklenir. ⚠️ Eski UNIQUE'i düşürmek `ON CONFLICT (eski kolonlar)` kullanan her yazıcıyı kırar. Yazıcılar yalnız merkezde (yükleyici + seed üretici) ve uygulanmış seed'ler yeniden koşmaz; yine de yükleyici ile seed üretici **aynı commit'te** yeni anahtara çekilir. Okuyucu filtresi: `(gueltig_von IS NULL OR gueltig_von <= d) AND (gueltig_bis IS NULL OR gueltig_bis >= d)`, burada `d` **Berlin tarihidir** (`Intl`, UTC değil). Hangi tarih olduğu (dosya oluşturma günü mü, Leistungszeitraum mı) `gkv-302`'nin sorusu, konseyde sorulsun. **Adım 2:** Adım 1'in image'ı `promote-stable.yml` ile `:stable`'a geçene kadar **gelecek tarihli satır yüklenmez**, ne SaaS'a (`--write`) ne seed'e. Bunun mekanik kontrolü: seed üretici, `:stable` etiketinin commit'i filtreyi içermiyorsa gelecek `gueltig_von`'lu satır üretmeyi reddetsin. **Adım 3:** o andan sonra her çeyreğin seed'i önceden gelir; önceki sürümün satırları `gueltig_bis = yeni.gueltig_von - 1` ile kapatılır. Silinen IK'lar da böylece kendiliğinden düşer (yalnız `gueltig_von` tutmak bunu yapamazdı, silinen IK sonsuza kadar geçerli kalırdı). **O-128 şartı:** seed, süresi bir çeyrekten daha önce dolmuş satırları `DELETE` etsin ki tablo her çeyrek büyümesin. **Adım 1 ile Adım 3 aynı sürümde birleştirilmez** |
| **Durum** | 🟠 **geplant.** Konsey 30.09.2026 (Kemal onayı). Adım 1 = `0046` + okuyucu, 01.10.2026'da SaaS'ta (aşağıdaki 01.10 notu). Kolon adları `valid_from/valid_to` oldu, UNIQUE değişmedi. Adım 2 kilidi yükleyicide ve seed üreticide. Adım 3 açık. Kapanış ölçütü: Adım 1 image'ı `:stable`'da ve önceden yüklenmiş ilk çeyrek kendiliğinden geçti |

**O-118'e etkisi:** O-138 "hatırlatan" yarının dış yüzünü kapatır (yeni dosya çıktı haberi).
İç yüzü hâlâ açık: dosya repoya girip seed yazılmazsa hiçbir şey bağırmıyor
(`tools/check-onprem.sh`'da `kostentraeger` hâlâ 0 satır). O-118 durum değiştirmiyor, 🟡 kalıyor.

> **01.10.2026 gecesi (Oturum B) — Q4/2026 kutuya yazıldı: `0045_seed_kostentraeger_q4_2026.sql`
> (henüz commit'lenmedi, bildirim üzerine kaydedildi).** O-139'un geçerlilik penceresi
> henüz olmadığı için bu çeyrek geçişi **eski yoldan** yapıldı: 01.10'da SaaS'a
> `laden.mjs --write` ile yüklendi, sonra canlıdan seed üretildi. İçerik: 18 `kostentraeger`
> satırına `valid_to = 2026-09-30` (17 IKK Nordrhein + `108916709` AOK Bayern DLZ Schwandorf),
> AOK Bayern Papierannahmestelle `108916709` → `108910008`; 0 yeni IK. Alt tablolar
> 11.411 / 1.586 satır. Tek transaction, sonda `DO` öz-kontrolü (başarısızsa dosyanın tamamı
> geri alınır).
>
> **onprem hükmü: GEÇER.** Tip B + D (veri, DDL yok). Kontrol edilenler:
> - **Sıra dışı numara sorun değil.** `api-backend/db/migrate.js:103-121` (`planErstellen`)
>   yüksek-su işareti değil **küme farkı** kullanıyor: defterde olmayan her dosya `offen`,
>   `:50` dosya adına göre sıralı. Yani `0047`'yi almış bir kutu `0045`'i bir sonraki
>   açılışta uygular; yeni kutu `0045`'i `0047`'den önce koşar. `pruefeVersionen` (`:83`)
>   yalnız **çift** numarayı reddeder, boşluğu değil. `onprem/update.sh:611-612` de dosya adı
>   kümesini defterle karşılaştırıyor → `0045`'i bekleyen olarak görür ve **migration öncesi
>   yedeği alır.** Sayaç öz-kontrolü `max(version)` = `0047` alıyor (`migrate.js:205`),
>   `bis_version` değişmez. İki dosya ortak nesneye dokunmuyor (`0047` başlığı `:11`), yani
>   hangi sırayla koşsalar aynı sonuç
> - **DELETE istisnası güvenli.** İki alt tablo uygulama kodunda **yalnız okunuyor**
>   (`api-backend/billing/kostentraeger/annahmestelle.js:144, 266, 300`,
>   `module/abrechnung-einstellungen.js:650` — hiçbirinde insert/update/delete yok). Kutuda
>   müşterinin yazdığı bir satır olamaz, silinen her satır bizim eski seed'imizdir
> - **SaaS/kutu tutarlılığı (G7):** veri SaaS'a yükleyiciyle, kutuya migration'la gidiyor;
>   eşitlik üç tabloda `format('%L')` md5 ile kanıtlanmış (başlıkta). Başlıktaki
>   `-- SaaS: NICHT angewandt` satırı O-129/O-133'ün istediği tek yazım yeri
> - G1/G2/G3/G8: hiçbiri tetiklenmiyor (kamu verisi, sır yok, dış çağrı yok)
>
> **Şartlar (commit'e kadar):** (1) `api-backend/db/erwartete-zaehler.json`'daki
> `_hinweis_0045` satırı (çalışma ağacında zaten var, commit'lenmemiş) **aynı commit'e**
> girer. Bildirimdeki "json'a dokunulmadı" ifadesi yanlış; içerik doğru, yalnız bu satır
> eklendi. (2) Bu migration'ı taşıyan sürüm **MINOR** olur, PATCH olamaz
> (`RELEASE-STANDARD.md:90`). (3) `0045`, `0046`'dan (alt tablolara geçerlilik kolonu +
> UNIQUE değişikliği) **önce ya da onunla aynı** image'a girer, numarası bir daha
> değişmez. `0045`'in `ON CONFLICT` anahtarları ve mutlak satır sayısı kontrolleri bugünkü
> UNIQUE'e bağlı; dosya sıralaması bunu zaten garanti ediyor, ama `0046` önce yayına
> girerse garanti kalkar.
>
> **O-118/O-139 durumu değişmiyor.** O-118: besleme bu çeyrek de çalıştı, kapı hâlâ yok
> (`grep -c kostentraeger tools/check-onprem.sh` → 0). O-139: bu tur elle yapılan geçişin
> son örneği olmalı; `0046` bildirimi geldiğinde adlandırma (O-139 metni `gueltig_*`
> öneriyor, `kostentraeger` ana tablosu `valid_from/valid_to` kullanıyor, bildirim de
> `valid_*` diyor) ve "Adım 1 ile Adım 3 aynı sürümde birleşmez" şartı orada kontrol edilir.

> **01.10.2026 gecesi (Oturum B) — O-139 Adım 1: `0046_kostentraeger_gueltigkeit_annahmestellen.sql`
> SaaS'a MCP ile uygulandı. Okuyucu, yükleyici ve seed kilidi aynı commit'te (henüz
> commit'lenmedi, bildirim üzerine kaydedildi).**
>
> **Ne geldi (koda karşı doğrulandı):**
> - Şema: iki tabloya `valid_from date NULL`, `valid_to date NULL`, iki sınır da dahil.
>   DEFAULT/CHECK/FK yok, **UNIQUE değişmedi**, backfill yok. View `kostentraeger_auswahl`
>   `CREATE OR REPLACE` ile yenilendi, kolon listesi aynı, `current_date` yerine
>   `(now() AT TIME ZONE 'Europe/Berlin')::date`. Canlıda 893 → 876 satır: tam 17 süresi
>   dolmuş IK (0045'in IKK Nordrhein kapanışları), yani view artık doğru sayıyor. Grants ve
>   COMMENT `CREATE OR REPLACE` ile korunuyor, dosya bilerek onlara dokunmuyor
> - Okuyucu: `annahmestelle.js:44` `giltAm()`. `ladeAnnahmestelle` (`:171-178`) ve
>   `ladePapierannahmestelle` (`:297-304`, anschriften `:338`) valid_* kolonlarını seçip JS'te
>   süzüyor. Stichtag varsayılanı `lib/berlin-tag.js` `berlinHeute()` (`Intl`, DST'ye
>   dayanıklı). Bozuk Stichtag hata fırlatmıyor, `{ok:false}` dönüyor. `lib/rezept-felder.js:143`
>   aynı kurala çekildi. Çağıranların hiçbiri (`abrechnung.routes.js:281, 643, 758, 2883,
>   3181, 3897`, `server.js:2630, 2836`) bugün `stichtag` vermiyor, yani fiilen "Berlin bugünü"
>   kullanılıyor. Rechnungsdatum mu, Übermittlungstag mı sorusu `gkv-302`'nin, burada değil
> - Yükleyici: `tools/kostentraeger-annahmestellen-laden.mjs` artık **silmiyor**. Yeni anahtar
>   INSERT edilir (`valid_from` = gültig-ab). Kalan anahtar UPDATE edilir (`valid_from`'a
>   dokunulmaz). Düşen anahtara PATCH ile `valid_to` = gültig-ab − 1 yazılır. Geri dönen
>   anahtarda `valid_to = NULL` olur. `--write` + gelecek Stichtag → exit 4 (Adım-2 kilidi,
>   `adim2Sperre`)
> - Seed üretici: `tools/seed-generieren.mjs` iki tabloya `valid_from/valid_to` ekledi.
>   `keepOnConflict: ['valid_from']` kutudaki mevcut satırın başlangıcını ezmez.
>   `zukunftSperre`: kaynakta `valid_from > Berlin bugünü` olan satır varsa exit 4, seed
>   üretilmez
>
> **Adlandırma: `valid_*` kabul, O-139'daki `gueltig_*` önerisi geri çekildi.** Gerekçe
> doğru: aynı zincirin ana tablosu `kostentraeger.valid_from/valid_to` kullanıyor, okuyucu ve
> view aynı ifadeyi üç tabloda tekrarlıyor. Tek ad ailesi, `heilmittel_tarif` ile uyumdan
> daha değerli (o tablo seed'den bilerek çıkarıldı, O-96, ortak kodu yok).
>
> **UNIQUE'in değişmemesi: kabul, ama Adım 3'ün tasarımını değiştiriyor.** O-139'un özgün
> planı `gueltig_von`'u UNIQUE'e ekleyip aynı anahtarın iki sürümünü yan yana tutmaktı.
> Seçilen model şu: "bir anahtar = en çok bir kesintisiz pencere; kapat, silme". Bu modelde
> **önceden yükleme şunları taşıyabilir:** yeni anahtar (gelecek `valid_from`) ve düşen anahtar
> (gelecek `valid_to`). **Taşıyamaz:** aynı anahtarın içeriği değişirse (ör.
> `leistungserbringergruppe`, `quelle` ya da `anschriften`'te UNIQUE dışı bir kolon), UPDATE
> bunu **hemen** yazar, çeyrek başını beklemez. Q4/2026'da böyle bir değişiklik yoktu
> (AOK Bayern değişimi `partner_ik` üzerinden oldu, yani yeni anahtar). Adım 3 tasarlanırken
> bu ya kabul edilir ya da yükleyici o durumda değişikliği ertelemeli. Migration dosyası bunu
> zaten söylüyor ("Expand/Contract des Schluessels ... dann Adim 3, eigene Migration"). Yani
> Adım 1'de UNIQUE'e dokunmamak doğru. Eski UNIQUE'i düşürme riski (`ON CONFLICT` kullanan
> yazıcılar, 0045'in anahtarları) böylece hiç doğmadı.
>
> **Sıra ve dağıtım kontrolü:**
> - Kutu: `0045` → `0046` dosya adı sırasıyla koşar (`migrate.js:103-121` küme farkı
>   kullanıyor), `0047`'yi almış kutuda da. `0045` veri, `0046` DDL, ortak anahtar yok.
>   0045'in DELETE'i 0046'dan önce koştuğu için kutuda ilk sürümde kapanmış satır hiç oluşmaz
> - SaaS: `migrate.js` SaaS'ta koşmuyor (`migrations/README.md:118-133`). Yani dosya
>   başlığındaki commit-öncesi değişiklik ("SaaS: angewandt") hiçbir checksum'ı kırmaz. Dosya
>   henüz hiçbir image'da değil, kutu defterine ilk kez **son hâliyle** girecek
> - Okuyucu ile veri aynı image'da gidiyor: kutuda `0046`'yı ya da ondan sonraki bir seed'i
>   taşıyan her image filtreli okuyucuyu da taşır. Adım-2 kilidi bunun üstüne ikinci emniyet
>   (geri alma senaryosu: eski image + yeni DB). ⚠️ Kilit yalnız **gelecek `valid_from`**'u
>   tutuyor. Simetrik tehlike olan **geçmiş `valid_to`'lu kapanmış satır** kilide takılmıyor,
>   filtresiz eski okuyucu kapanmış satırı da görür. Bugün sorun değil: SaaS'ta henüz kapanmış
>   satır yok (0045 silme yoluyla geçti), kutuda da yok. Ama **SaaS'ta bu commit push edilip
>   yeni backend ayağa kalkmadan `laden.mjs --write` koşulmamalı**. Şu an SaaS'ta 0046
>   uygulanmış DB'ye karşı **eski** backend (filtresiz okuyucu) çalışıyor
> - İkinci okuyucu: `module/abrechnung-einstellungen.js:650` (`_loeseEmpfaengerNameAuf`)
>   `partner_ik`'ten ad çözüyor, valid_* süzmüyor. **unkritisch**: yalnız görüntülenen ad,
>   kendi yorumu "kein Sperrgrund" diyor, `limit(1)`. Kapanmış bir satır en kötü ihtimalle
>   eski kasanın adını gösterir, alıcıyı değiştirmez
>
> **O-128 şartı bilerek düştü:** "süresi bir çeyrekten önce dolmuş satırları DELETE et"
> şartı DELETE'siz modelde uygulanmadı. Tablo yalnız düşen anahtar kadar büyüyor (Q4/2026:
> 18 IK), yani yavaş. Açık bırakıldı, Adım 3 ile birlikte karar verilecek.
>
> **Şartlar (commit'e kadar):**
> 1. `0046` dosyası çalışma ağacında **staged sürümünden farklı** (`git status` → `AM`):
>    "SaaS: angewandt 01.10.2026" satırı stage'de değil. Commit öncesi yeniden `git add`
> 2. `db/SCHEMA.sql` + `db/SCHEMA-RLS.sql` 0046 künyesiyle tazelenmiş ama **stage'de değil**
>    (` M`). CLAUDE.md kuralı gereği aynı commit'e girmeli
> 3. `erwartete-zaehler.json` `_hinweis_0046` kendi içinde çelişiyor: "bis_version ohne neue
>    Messung hochgezogen" ile "bis_version bleibt 0047" aynı metinde. İkincisi doğru, birincisi
>    `_hinweis_0044`'ten kopya kalmış. Silinmeli
> 4. Sürüm: `0045` + `0046`'yı taşıyan sürüm **MINOR** olur (`RELEASE-STANDARD.md:90`, PATCH
>    migration içeremez). `0045` önce girdi (`adb6f91`), `0046` onunla aynı ya da sonraki
>    image'da. 01.10 notunun 3. şartı karşılandı
> 5. **Adım 3 ayrı sürümde**, ancak Adım 1'in image'ı `promote-stable.yml` ile `:stable`'a
>    geçtikten sonra (O-139 özgün metni, değişmedi)
>
> G1/G2/G3/G8: hiçbiri tetiklenmiyor (kamu verisi, sır yok, dış çağrı yok, yeni zincir yok).

### O-140 — Nominatim çağrısı: (a) CSP açma ve (b) sunucuya taşıma reddedildi, (c) çağrıyı kaldır + konumu cihazdan al ✅ **gelöst (kod: `1f1ef45`/`853ea99`)**

| Alan | İçerik |
|---|---|
| **Ne** | S6 konsol temizliğinde (30.09.2026) sorulan: Nominatim CSP ihlali nasıl kapansın. `ensureBusinessCoords()` her ekip ayarları açılışında, `businesses.clinic_lat/lng` boşsa işletme adresini tarayıcıdan OSM'e yolluyor; CSP hem SaaS'ta (`vercel.json:19` `connect-src`'de nominatim yok) hem kutuda (`onprem/Caddyfile:49`) engelliyor |
| **Nerede** | `dashboard.js:19343` (`ensureBusinessCoords`), fetch `:19353`, `catch` `:19370`; çağıran `:10314` (Team/Einladungs-Panel içinde, `loadAnwesenheitSidePanel()`'in yanında). Tüketici **tek**: `api-backend/server.js:3609-3621` (`POST /attendance/check-in`, `haversineMeters` ≤ `CHECKIN_RADIUS_M = 150` `:3575`) + `:3684` (`gps_checked`). Rapor görünümü `dashboard.js:19457` |
| **Tip** | A (bugün) → çözümde hiçbiri: yerel cihaz konumu, dış host yok |
| **Kutuda ne olur** | **Bugün bozuk olan özellik: Anwesenheit GPS doğrulaması.** Koordinatı olmayan her `businesses` satırında `checkInValid` `false`'ta kalır (`server.js:3618`), owner raporunda **her** check-in ⚠ görünür (`dashboard.js:19457-19458`: `check_in_valid ? '✓' : '⚠'`) — çalışan doğru yerde olsa bile. Hata sessiz: `catch` yalnız `console.warn`. Fahrtenbuch bununla ilgili **değil** — o `profiles.clinic_lat`'ı ayrı bir geocoder'la (`fahrtenbuch-geocode` Edge Function, `dashboard.js:5567`, O-11) dolduruyor; aynı kavram için iki tablo, iki geocoder |
| **Çözüm** | **(a) `connect-src`'e nominatim eklemek — DUR.** Yalnız `vercel.json`'u düzeltir; kutunun Caddyfile CSP'si ayrı kalır → iki dağıtımda iki davranış (G7). Kutuya da eklenirse tarayıcıdan üçüncü tarafa yeni runtime zinciri (G8) ve müşteri IP'si OSM'e gider (O-12'nin 11.09'da CSP ile kapanan kaygısı geri açılır). **(b) Sunucuya taşımak — DUR.** Tip A'yı tarayıcıdan kutunun kendisine taşır: kutu `nominatim.openstreetmap.org`'a çıkar, internetsiz kurulumda yine ölü, OSM kullanım politikası ticari ürün için kendi User-Agent'ı + rate limit ister, 20 kutu × IP = bizim sorumluluğumuz olmayan bir üçüncü taraf ilişkisi. Veri işletme adresi (PHI değil, G1 tetiklenmiyor) ama G8 tetikleniyor. **(c) PLZ merkezi — bu tüketici için YETMEZ.** `tools/plz-orte.mjs`'in kaynağı (zauberware/GeoNames CSV) lat/lng kolonu taşıyor, yani tip B olarak PLZ→merkez noktası üretilebilir; ama PLZ alanı kilometrelerce, 150 m yarıçaplı check-in onunla her zaman ya yanlış ⚠ ya (yarıçap büyütülürse) anlamsız ✓ verir. PLZ merkezi Fahrtenbuch km tahmini için (O-11 alternatifi) değerlendirilebilir, geofence için değil. **Seçilen (c'): Nominatim çağrısını sil, konumu owner'ın cihazından al.** Ayarlarda "Praxisstandort = mein aktueller Standort" düğmesi, `navigator.geolocation.getCurrentPosition` — aynı API `attendance.js:203-207`'de çalışanın check-in'i için zaten kullanılıyor, yani ölçüm iki uçta aynı cihaz tipinden gelir (geofence için adres geocoding'inden daha doğru). SaaS'ta ve kutuda birebir aynı, CSP değişmez, dış host sıfır. Ek olarak elle lat/lng girişi (masaüstü tarayıcısında konum izni yoksa). Koordinat yokken UI ⚠ değil "GPS nicht eingerichtet" göstermeli — sunucu zaten `gps_checked:false` dönüyor, rapor onu okumuyor |
| **Durum** | ✅ **gelöst (kod, 02.10.2026 doğrulandı)** — `git grep -i nominatim -- '*.js'` ürün kodunda yalnız iki yorum satırı (`dashboard.js:9872`, `module/praxis-standort.js:5`); konum cihazdan (`module/praxis-standort.js`). Runtime ölçümü (koordinatlı check-in ✓) K3 kutu testinde. Önceki not: 🟠 geplant — S6 (PODOLOGIE_REFORM_SPRINT konsol temizliği). Kapanış ölçütü: `git grep -c nominatim -- '*.js'` → 0 ürün kodunda; koordinatlı bir `businesses` satırında doğru yerde yapılan check-in raporda ✓. O-12 bu maddeyle birlikte `gelöst` olur. **30.09.2026 (Oturum C) sunucu yarısı bitti:** check-in `business_id` yoksa/boşsa `profiles.clinic_lat/lng`'e düşer (tek-praxis owner), koordinat yoksa ya da lat/lng gelmezse `check_in_valid = NULL` ("nicht geprüft", artık 400 yok), kontrol owner ayarı `profiles.gps_checkin_pruefen` ile (varsayılan kapalı) — `0047` + `api-backend/lib/gps-checkin.js`. Dış host yok, kutuda aynı. Açık: A'nın düğmesi `profiles.clinic_lat/lng`'e yazmalı; `Permissions-Policy` (A-19) Kemal onayı bekliyor. **01.10.2026:** A-19 SaaS'ta `96afd7d` ile açıldı, kutu yarısı → O-141 |

### O-141 — `geolocation` SaaS'ta iki sayfaya açıldı (A-19), kutunun Caddyfile'ı kapalı tuttu: Praxisstandort düğmesi + GPS check-in kutuda ölü 🟠 **geplant — düzeltme yazıldı, commit + kutu ölçümü bekliyor (01.10.2026)**

| Alan | İçerik |
|---|---|
| **Ne** | `96afd7d` `vercel.json`'da `/dashboard.html` ve `/attendance.html` için `geolocation=(self)` verdi; `onprem/Caddyfile` global `geolocation=()` ile kaldı. O-109'un aynı sınıftan tekrarı (header kutu ile SaaS arasında davranış ayrımı, G7) |
| **Nerede** | `navigator.geolocation` kullanan ürün kodu: 2 dosya — `attendance.js` · `module/praxis-standort.js`. SaaS: `vercel.json:22-32`. Kutu: `onprem/Caddyfile:59-62` (yeni) |
| **Tip** | G (dağıtım ayrımı) — dış host yok, A/C/E değil |
| **Kutuda ne olur** | Düzeltme olmadan: `getCurrentPosition` izin istemi göstermeden `PERMISSION_DENIED` döner; owner Praxisstandort'u cihazdan alamaz, çalışan check-in'i konumsuz gider (O-140 sonrası `check_in_valid = NULL`, yani kırılma sessiz). Yalnız kutuda, yalnız kurulumdan sonra görünür |
| **Çözüm** | `Caddyfile`: global `header {}` bloğundan Permissions-Policy çıkarıldı, iki ayrık matcher (`@geo path /dashboard.html /attendance.html` · `@nogeo not path …`) ile her yanıtta tek değer. Gözden geçirme (onprem, 01.10): sözdizimi geçerli; `header` direktifi Caddy'nin direktif sırasında `handle`'dan önce gelir, `-`/`defer` olmadığı için anında yazılır ve `file_server`/`reverse_proxy` yanıtlarının hepsine biner. `/api/*` ve Kong yanıtlarının `@nogeo` alması zararsız — Permissions-Policy yalnız belge (HTML) yanıtında etkilidir; Express (`api-backend/server.js:84-90`) bu alanı yazmıyor, çift değer oluşmaz. Path matcher query string'e bakmaz (`?v=…` sorun değil). Uzantısız `/dashboard` kutuda zaten servis edilmiyor (`file_server`, `try_files` yok → 404) ve kodda o yola giden link yok (`login.js:138`, `onboarding.js:104`, `confirm.html:216` hepsi `.html`). Kalan bilinçli fark: kutuda `serial=(self)`, SaaS'ta yok — O-110'a ait, bu maddeye değil |
| **Durum** | 🟠 **geplant** — commit bekliyor (Caddyfile + bu sicil aynı commit'te). **Doğrulama borcu (O-109'unkiyle birlikte kapanır):** çalışan kutuda (1) `curl -skI https://<host>/dashboard.html` → `geolocation=(self)`, (2) `/login.html` → `geolocation=()`, (3) `caddy validate` temiz. Üçü görülünce `gelöst` |

### O-142 — Hesap/giriş işleri MAİLSİZ (kullanıcı kararı 01.10.2026): O-66'nın "install.sh SMTP sorar" ve playbook 2.7'nin "GoTrue SMTP sihirbazdan" kararları **devralındı** 🟡 **kısmen (02.10.2026, kutu tarafı `67dbe9d`)**

| Alan | İçerik |
|---|---|
| **Ne** | Kemal 01.10.2026: owner çalışanı panelden açar ve ilk şifreyi verir (backend `auth.admin.createUser`, `email_confirm:true`), owner çalışan şifresini sıfırlar, ilk girişte şifre değişimi zorunlu. Auth akışı hiçbir yerde mail beklemez. Hasta/termin maili **isteğe bağlı** ve ayrı: "E-Mail-Konto verbinden" (adres+şifre, host/port otomatik algılama), kurulumda teknisyen bağlar. Sebep: SaaS'ta Supabase onay maili 20.08'den beri gitmiyor (signUp 504); kutuda praxis sahibine SMTP kurdurulmaz |
| **Nerede** | Değişen karar: O-66 (`install.sh:344-380` adım 11, SMTP sorusu) · playbook `:216`/`:222` · `onprem/.env.template:144-199` · `onprem/docker-compose.yml:174-190` (`auth` bloğu) ve `:455-465` (`api` SMTP env'leri). Zaten mailsiz çalışan parça: `api-backend/setup/router.js:199` (owner `createUser`, `email_confirm:true`). Mailli kalan parça: `api-backend/server.js:3195-3204` (SaaS onboarding `email_confirm:false` + `generateLink`) |
| **Tip** | G (+ E: kutuda müşteri SMTP sırrı kalmaz) |
| **Kutuda ne olur** | (1) **Veto yok:** G1 nötr (daha az dış çağrı), G2 nötr (anahtar yok), G3/G8 nötr (yeni zincir yok). G7 şartı: aynı çalışan-açma/şifre-sıfırlama kodu SaaS'ta da çalışmalı — iki ayrı akış (mailli SaaS / mailsiz kutu) fork olur. (2) **GoTrue ayarı:** `ENABLE_EMAIL_AUTOCONFIRM` **dokunulmaz, `false` kalır** — `admin.createUser`+`email_confirm:true` autoconfirm'e bakmaz; `true` yapmak "kayıt olan herkes onaylı" demektir ve `DISABLE_SIGNUP=true` zaten tek kapıdır. `GOTRUE_EXTERNAL_EMAIL_ENABLED` (`ENABLE_EMAIL_SIGNUP`) **`true` kalır** — kapatmak e-posta+şifre girişini de öldürür. `DISABLE_SIGNUP=true` kalır. (3) **SMTP env'leri GoTrue'dan düşer:** `docker-compose.yml:178-190` `GOTRUE_SMTP_*` + `MAILER_URLPATHS_*` bloğu kutuda gereksiz; `install.sh` adım 11 (`:344-380`) ve `.env.template` §4 SMTP satırları **auth** için silinir. SMTP yalnız `api` için (hasta/termin maili, `SMTP_FROM`, O-51) kalır ve **kurulumda sorulmaz** — teknisyen sonradan arayüzden bağlar. (4) **Sessiz tuzak:** GoTrue mail yolunu hâlâ çağıran her yer (`resetPasswordForEmail` `login.js:316`, `generateLink`) kutuda mail beklenip gelmeyen sessiz arıza üretir — kutuda bu düğmeler **gizlenmeli/değiştirilmeli** (O-58'in `.remove()` deseni ama `applyLang` tuzağına (O-68) düşmeden) |
| **Çözüm** | **Owner şifre kurtarma — mevcut mekanizma YOK, O-107 zaten bunu açık işaretlemişti** (`router.js:77` sihirbaz tek kullanımlık, `/owner` 410; `install.sh` reset komutu yok; `--neu` DB siler). Karar mailsiz olunca O-107 **zorunluya döner**: `onprem/reset-owner-passwort.sh` (host CLI, `read -r -s`, hedef `praxura_setup.owner_user_id`, `auth.admin.updateUserById`, iz `.praxura-stand/`) — **Faz 2.1c, ertelenemez**. ⛔ HTTP/`SETUP_TOKEN` ucu olarak çözülmez (O-107 hüküm 2: kalıcı ağ yüzeyi + aynı kod SaaS'ta). SaaS'ta owner şifre kurtarma = bizim destek (`admin.updateUserById`, merkez yetkisi, K10 ihlali değil çünkü SaaS bizim). **Çalışan akışı:** `POST` owner-yetkili uç (owner JWT zorunlu, hedef `profiles.owner_id = çağıran`), `admin.createUser`+`email_confirm:true`, `app_metadata`/profil bayrağı `must_change_password=true`, ilk girişte zorunlu değişim ekranı; sıfırlama aynı uç ailesinden `admin.updateUserById`. Yeri `api-backend/server.js` (G8: Vercel/n8n değil). O-56 (`emailRedirectTo` kutuda kırık) ve O-69 (davet ekranı SaaS adresi gösteriyor) **bu karar ile yapısal olarak kapanır** (davet maili yok, link yok) |
| **Durum** | 🟡 kısmen — kutu tarafı yapıldı (`67dbe9d`, K2.5): `install.sh` SMTP adımı kalktı, GoTrue `SMTP_*`/`MAILER_URLPATHS_*` compose'dan çıktı (`onprem/docker-compose.yml:186-192` gerekçe yorumu), `ENABLE_EMAIL_AUTOCONFIRM=false` kaldı (`.env.template:184`), `api` SMTP'si opsiyonel ve sorulmuyor (`docker-compose.yml:457-464`), `login.js` „Passwort vergessen" kutu dalında reset betiğini anıyor. Owner kurtarma O-107 ile kapandı. **Kalan:** `setup.html` Schritt 3 (SMTP testi) — Hat M, M2.5; backend `/test-smtp` SMTP yokken düzgün cevap veriyor, yani kırık değil, gereksiz bir adım — Önceki: `geplant` — kod yok. Sicil güncellemeleri: O-66 → "devralındı O-142" notu, O-51 → kapsam daraldı notu (aşağıda), O-107 → "zorunlu, öncelik yükseldi". İlk müşteri kutusundan önce **Faz 2.1c reset betiği** şart; çalışan-açma ucu SaaS'ta da test edilmeli (G7). ⚠️ SaaS onboarding'in (`server.js:3195`) 504'lü `generateLink` mail yolu ayrı bir SaaS arızası, bu kararın kapsamı değil — mailsiz çalışan akışı ona dokunmaz |

---

### O-143 — `0053` profiles kilit-trigger'ı `current_user` rol adına dayanıyor + `pending_employee_registrations` tek adımda DROP 🟢 **gelöst (hüküm 02.10.2026, commit 0053 ile)**

| Alan | İçerik |
|---|---|
| **Ne** | guvenlik S-39 (K1.1): `profiles` ayrıcalıklı kolonları (owner_id, role, plan*, stripe_*, is_active …) yalnız `current_user IN ('authenticated','anon')` iken kilitleyen SECURITY INVOKER trigger; aynı migration'da eski mailli self-signup tablosu `pending_employee_registrations` DROP. |
| **Nerede** | `api-backend/db/migrations/0053_profiles_privilegierte_spalten.sql` · tablo kaynağı `0000_baseline.sql:4161` (yani kutu paketinde VAR) · kutu rolleri `onprem/docker-compose.yml:215` (PostgREST `authenticator`) ve `:219` (`PGRST_DB_ANON_ROLE: anon`) · kutu backend'i `onprem/docker-compose.yml:418` (`SUPABASE_SERVICE_ROLE_KEY`) · kurulum sihirbazı `api-backend/setup/router.js:37-41` (service-role istemcisi), `:199` (`auth.admin.createUser`), `:216` (profiles update) |
| **Tip** | D (şema) + H (plan/plan_status yazım yolu) |
| **Kutuda ne olur** | (1) **Rol adları aynı:** kutu upstream Supabase imajlarını kullanıyor; PostgREST `authenticator` ile bağlanıp JWT `role` claim'ine göre `SET ROLE anon/authenticated/service_role` yapar, GoTrue `authenticated` token'ı basar — SaaS ile birebir. Trigger iki dağıtımda aynı davranır (G7 ✅). (2) **Serbest kalan yollar:** backend (`api` konteyneri service_role JWT → `current_user=service_role`), `migrate.js` (DATABASE_URL, süper kullanıcı), `handle_new_user` (SECURITY DEFINER → `current_user` = fonksiyon sahibi). (3) **Kurulum sihirbazı engellenmez:** `setup/router.js` service_role ile yazıyor; K2.3'teki `plan='professional', plan_status='active'` de **aynı service_role update'ine** eklenirse geçer. ⚠️ Tarayıcıdan (sihirbaz HTML'i, dashboard) yazılırsa 42501 ile reddedilir — doğru davranış bu, kaçış açılmaz. (4) **DROP:** kutu tabloyu baseline'dan alıyor; eski image'larda tek okuyucu `confirm.html` `.maybeSingle()` + `if(!pending) return` → sessiz. `:stable` hiç basılmadı (sprint Y2/K2.1), müşteri kutusu yok → tabloyu arayan çalışır image yok. |
| **Çözüm** | Tek adımlı DROP için `-- zweistufig:` gerekçe satırı **yeterli** (emsal `0051`): adım 1 = `01c57cf` (01.10.2026, yazma/okuma kesildi), adım 2 = bu migration. Gerekçe satırı bir satırın **başında** `-- zweistufig:` ile durmalı (`tools/check-onprem.sh:133`; emsal gibi 1. satıra koymak okunurluk için önerilir). Policy DROP'ları kapıyı tetiklemez (regex yalnız `DROP COLUMN|TABLE` ve `RENAME`). Sayaç: `bis_version 0053`, public_tablo 84→83, rls_policy 162→157, fonksiyon 78→79, trigger 80→81, index 305→305 (pending PK −1, `profiles_company_code_upper_key` +1); `profiles_company_code_key` UNIQUE yerinde kalıyor, sayım değişmez. ⚠️ Migration başlığındaki `ZAEHLER: … index +1` **yanlış** — net 0; düzeltilmeli (dosya henüz uygulanmamış sayılır mı: SaaS'ta MCP ile uygulandı, kutularda hiç koşmadı → yorum düzeltmesi SHA'yı değiştirir; SaaS defterinde SHA kayıtlıysa yorum düzeltmesi yapılmaz, doğru rakam `_hinweis_0053`'te durur). |
| **Durum** | `gelöst` — hüküm GEÇER, KAYITLA. Açık kalan tek bağ: K2.3 yazılırken plan/plan_status **sunucu tarafında** (`setup/router.js`) yazılacak. Yan bulgu (onprem kapsamı dışı, iki dağıtımda aynı): `dashboard.js:10510` "Mitarbeiter entfernen" başka kullanıcının satırını client'tan güncelliyor — RLS (`auth.uid()=id`) zaten 0 satır döndürüyordu, 0053 öncesi de sessiz no-op'tu; düğme iki dağıtımda da çalışmıyor → backend ucu gerekir (builder/guvenlik). |

### O-144 — `0054`/`0055`/`0056` (KHS K1, 02.10.2026): mandant sınırı, çalışan erişimi sertleştirme, DB temizliği — `auth.sessions`'a dokunan DEFINER fonksiyon kutuda doğrulanmadı 🟡 **kısmen (02.10.2026, (a)+(c) kutuda ölçüldü, (b) açık)**

| Alan | İçerik |
|---|---|
| **Ne** | Üç migration: (0054) `employee_services`/`time_offs` policy'leri mandanta bağlandı, `time_offs` "Public read" kalktı, `prescriptions_mandant_pruefen` trigger'ı (DEFINER, üç REVOKE) · (0055) `auth_sitzungen_beenden(uuid)` (public şemada, DEFINER, `search_path public, auth`, `auth.sessions`'tan DELETE) + `mitarbeiter_zuordnen` RPC (advisory lock) + `profiles_public` görünümüne WHERE · backend ucu `POST /team/mitarbeiter/:id/entfernen` (`auth.admin` `ban_duration`) · (0056) `"fußstatus"` DROP, `visibility_reports` DROP IF EXISTS, `aerzte_owner_id_arzt_name_key` DROP, mock `kostentraeger` DELETE |
| **Nerede** | `api-backend/db/migrations/0054_mandantengrenze_team_und_verordnung.sql:83-109` · `0055_mitarbeiter_zugang_haertung.sql` (fonksiyon gövdesi `DELETE FROM auth.sessions`) · `0056_db_aufraeumen.sql:1` (`-- zweistufig:`) · `api-backend/routes/mitarbeiter-zugang.js:313-318` · kutu migrator rolü `onprem/docker-compose.yml:438` (`DATABASE_URL` = `supabase_admin`) · GoTrue `onprem/.env:5` (`v2.189.0`) · `"fußstatus"` kaynağı `0000_baseline.sql:3411` · sayaç `api-backend/db/erwartete-zaehler.json` (`bis_version 0056`, `gemessen_am 2026-09-17`) |
| **Tip** | D (şema) + H (çalışan limiti `mitarbeiter_zuordnen`'e parametreyle gidiyor, kaynak `PLAN_EMPLOYEE_LIMITS`) |
| **Kutuda ne olur** | (1) **`auth.sessions` hakkı — kâğıt üstünde sorun yok:** kutuda migration'ları `migrate.js` `supabase_admin` (süper kullanıcı) ile koşturuyor → DEFINER fonksiyonun sahibi `supabase_admin` olur, `auth.sessions`'ta DELETE hakkı RLS/GRANT'tan bağımsız vardır. SaaS'ta sahip `postgres` (MCP) ve orada çalıştığı bildirildi. Yani iki dağıtımda **sahip farklı, sonuç aynı** olmalı — ama bu **ölçülmedi**. `auth.sessions` GoTrue'nun kendi şeması; tablo adı/kolonu (`user_id`) GoTrue sürümüne bağlı, kutunun `v2.189.0`'ında aynı olmalı (refresh_tokens→sessions CASCADE dahil) — yine ölçülmedi. (2) **`ban_duration`:** GoTrue admin API'sinde 2022'den beri var; `v2.189.0` destekler. Ölçülmedi ama risk düşük. (3) **`time_offs` Public read kalkması:** kutuda anonim okuyan yol yok — public slot hesabı backend'den service_role ile okuyor (`server.js:931`, `:1756`), RLS'ten etkilenmez. İki dağıtımda aynı. (4) **0056:** `"fußstatus"` kutuda baseline'dan geliyor, DROP gerçek iş yapar; `visibility_reports` kutuda hiç yok, `IF EXISTS` sessiz geçer; mock `kostentraeger` DELETE kutuda FK'si olmayan satırları siler (idempotent) — ama kutuda bu satırlara bağlı test faturası varsa DELETE FK'ye takılır ve runner **durur**. Kutu yok (`:stable` basılmadı) → bugün takılacak kutu yok. GoBD trigger'ı dosyada kapatılmıyor, doğru. (5) **Sayaç:** `bis_version 0056`, zaehler 82/155/82/82/303 — dört migration (0053-0056) **hesapla** çıkarıldı, son fiziksel ölçüm 17.09. Ara toplamlar tutarlı (0053→83/157/79/81/305, 0054→policy 156, fonk 80, trig 82; 0055→fonk 82; 0056→82/155/303). |
| **Çözüm** | Yeni Y2/K2.1 kutu ölçümünde (WSL test kutusu, `install.sh` sıfırdan) şu üçü **ayrıca** koşturulur: (a) `SELECT public.auth_sitzungen_beenden('<test-çalışan-uuid>')` → >0 döner, sonra o çalışanın refresh token'ı reddedilir; (b) `POST /team/mitarbeiter/:id/entfernen` → GoTrue 200, ardından girişte `user banned`; (c) runner'ın `0053-0056`'yı hatasız geçmesi ve selbstcheck sayaçlarının `erwartete-zaehler.json` ile birebir tutması (tutmazsa `gemessen_am` güncellenir, rakam düzeltilir). `:stable` basılmadan önce yapılır; kutu yokken başka iş gerekmiyor. `0056`'nın `-- zweistufig:` gerekçesi yeterli (O-143 emsali, `:stable` hiç basılmadı). |
| **Durum** | 🟡 kısmen — WSL test kutusunda (02.10.2026, `install.sh` sıfırdan, `:beta`/`acc51d5`, 8/8 healthy) ölçüldü: **(a) ✅** `auth_sitzungen_beenden` 2 oturumlu kullanıcıda `2` döndü, refresh reddedildi — `supabase_admin` sahipliği + GoTrue `v2.189.0` `auth.sessions` şeması tuttu. **(c) ✅** runner `0000`–`0057` (58 dosya) temiz, sihirbaz `/verify` schema/rls/şifreleme yeşil → `erwartete-zaehler.json` `gemessen_am` 2026-10-02 (`ebe318c`). **(b) ❌ ölçülmedi:** `POST /team/mitarbeiter/:id/entfernen` → `ban_duration` → girişte `user banned`. `:stable` terfisinden önce koşulmalı — Önceki: `geplant` (KHS K2.11 kutu ölçümü — 02.10.2026: ölçüm K2.11 WSL kurulum testinde koşar; (c) `0053`–`0057`'yi kapsar. `erwartete-zaehler.json` `bis_version=0057`, `_hinweis_0057` var, ama `gemessen_am=2026-09-17` — `0038`–`0057` arası hep nachgerechnet; bu test fiziksel ölçümdür, tutarsa `gemessen_am` tazelenir). Önceki: (Y2/K2.1 kutu ölçümü). O-143'teki yan bulgu ("Mitarbeiter entfernen" client'tan no-op) bu turda backend ucuyla (`mitarbeiter-zugang.js:318`) kapandı. ⚠️ Bildirimde geçen `api/dsgvo.js` hâlâ Vercel'de — O-16 değişmedi, `geplant` (Faz 1.1, K1.4 oturumu); `"fußstatus"`'un oradan çıkarılması (`3fecef1`) O-16'nın kapsamını daraltır, çözmez. Yeni kapı `tools/check-secrets.sh` (`onprem/supabase-docker/` hariç) — kutuya etkisi yok, G2'yi destekliyor; hariç tutma doğru (upstream vendor kopyası, örnek anahtarları zaten upstream'in demo değerleri). |


### O-145 — Gece 03:00 hesap temizliği kutuda her gece hata loglar (RPC kutuda yok)

| Alan | İçerik |
|---|---|
| **Ne** | `scheduleAccountCleanup` (`api-backend/server.js:3843-3860`) her iki dağıtımda koşuyor ve `supabase.rpc('delete_expired_accounts')` çağırıyor; fonksiyon kutu baseline'ında bilinçli olarak düşürülmüş (`0000_baseline.sql:12461`) |
| **Nerede** | `api-backend/server.js:3853` · `api-backend/db/migrations/0000_baseline.sql:12461` |
| **Tip** | F (zamanlanmış iş) + G (merkez işi: Fall B = SaaS sözleşme sonu) |
| **Kutuda ne olur** | Her gece 03:00'te PM2'nin iki instance'ı da "function not found" loglar; veri kaybı yok (try/catch). Asıl risk ileriye dönük: cron JS silme zincirine çevrildiğinde kutuda da koşarsa, kutuda `deletion_scheduled_at` dolu bir satır bulursa **müşterinin kendi kutusunda hasta verisi siler** — K9/G5 (lisans sonu salt-okunur, silme değil) ihlali |
| **Çözüm** | KHS K1.4 — cron, O-16 ile aynı box sinyaliyle (`SUPABASE_PUBLIC_URL`) **yalnız SaaS'ta** kurulur; kutuda hiç zamanlanmaz. RPC DROP'u iki adımda: K1.4 sürümünde kod RPC çağrısını bırakır, DROP bir sonraki migration'da (`:stable` image hâlâ eski kodu koşar, `-- zweistufig:` satırı) |
| **Durum** | `geplant` — 02.10.2026 (`94bac87`/`2804b99`): cron **tamamen kapatıldı** (kutu dahil — gece hatası bitti), RPC `0057:47`'de aynı commit'te düşürüldü. Tavsiyem iki adımdı; tek adım kabul edilebilir çünkü kutu baseline'ı fonksiyonu hiç taşımadı (`0000_baseline.sql:12461`) ve SaaS yalnız en son image'ı koşar — `:stable` RPC'yi çağıran bir sürümle hiçbir kutuya gitmedi. `-- zweistufig:` gerekçesi dosyada (`0057:16`). **Açık kalan:** yeniden yapım (ilk gerçek müşteriden önce) — şartlar değişmedi: yalnız SaaS (`istKutu()` false), çift PM2 instance için satır-claim/advisory-lock, JS zinciri `kontoLoeschen` tek kaynak. ⚠️ Kapalı olduğu sürece SaaS'ta süresi dolan hesaplar otomatik silinmiyor — legal-de'nin süre beklentisiyle çakışıyorsa sahibi orası |

### O-146 — `data_access_log` 12 aylık rotasyonu zamanlanmış iş olarak yok

| Alan | İçerik |
|---|---|
| **Ne** | `compliance/LEGAL_DECISIONS.md` „2026-10-02" §4'ün öngördüğü 12 aylık rotasyon için job yok; K1.4'te bilinçli olarak yapılmıyor (yalnız export'a dahil ediliyor) |
| **Nerede** | yok (yazılmadı) — tablo: `db/SCHEMA.sql` `data_access_log` |
| **Tip** | F (zamanlanmış iş) |
| **Kutuda ne olur** | Bugün: tablo iki dağıtımda da süresiz büyür, saklama süresi hukuki metinle uyuşmaz. Kurulduğunda: kutuda da koşmalı (Praxis = Verantwortlicher, kendi logu) — **O-145'in tersine SaaS-only değil.** Desen: `server.js:3845` `setInterval` + Berlin saati (Faz 2.4a node-cron ile aynı yer), çift-instance'ta idempotent `DELETE … WHERE created_at < now() - interval '12 months'` olduğu için kilit gerekmez. pg_cron **kullanılmaz** (kutuda garantisi yok) |
| **Çözüm** | O-182 ile aynı mekanizma: `klassifikation.js:510` `loeschfrist: { monate: 12, feld: 'occurred_at' }` (kolon `db/SCHEMA.sql:1339`), `dsgvo/fristen.js` siler — ikinci iş yazılmadı |
| **Durum** | `gelöst` — `b1ce69bb` (09.10.2026). Ayrıntı ve doğrulama O-182'de |

---

## 7W — KHS K2 ön kontrolü: 01.10 denetiminin Y1–Y7'si + iki yeni bulgu (02.10.2026)

> 01.10.2026 denetiminde Y1–Y7 diye adlanan yedi bulgu sprint planına (`KUTU_HAZIRLIK_SPRINT.md` §3 K2) girdi ama sicile hiç yazılmamıştı. O-143…O-146 başka işlere verildiği için **Y1=O-147 … Y7=O-153** olarak numaralandı. O-154/O-155 bu ön kontrolde çıktı. GHCR ölçümü bu turda yapıldı (anonim token, 02.10.2026).

### O-147 (Y1) — Kurulum sihirbazı owner'ı `starter` + `pending` doğuruyor: §302 menüsü kutuda görünmüyor ✅ **gelöst (02.10.2026, KHS K2)**

| Alan | İçerik |
|---|---|
| **Ne** | Sihirbaz owner profiline yalnız ad/sektör yazıyor; `plan`/`plan_status` kolon varsayılanından geliyor |
| **Nerede** | `api-backend/setup/router.js:207-216` (service_role `update`, plan alanı yok) · varsayılanlar `db/SCHEMA.sql:2906` (`plan DEFAULT 'starter'`) ve `:2927` (`plan_status DEFAULT 'pending'`) |
| **Tip** | H (yetki) |
| **Kutuda ne olur** | Kurulumdan çıkan owner, Stripe'ı olmayan bir kutuda hiç yükseltilemeyen `starter/pending` hesapla kalır; Professional'a bağlı modüller (§302) görünmez. K-2 kararıyla çelişir |
| **Çözüm** | KHS K2.3: aynı service_role `update`'ine `plan`/`plan_status` girer, değer **tek sabitten** gelir. Sabitin yeri `api-backend/lib/dagitim.js` (`istKutu()`'nun yanı — kutuya özgü her karar tek dosyada; Faz 3.3 `entitlements` helper'ı (O-31) buradan devralır). `0053`'ün kilit trigger'ı service_role'ü serbest bırakıyor (O-143 (3)) — tarayıcıdan yazılırsa 42501 doğru davranıştır |
| **Durum** | `gelöst` (`d807c3e`): `api-backend/lib/dagitim.js:10` `KUTU_OWNER_PLAN` (professional/active), `setup/router.js:224` service_role update'inde. Kutuda ölçüldü: owner `professional/active` — Önceki: `geplant (KHS K2.3)` |

### O-148 (Y2) — GHCR'de `:stable` yok, `.env.template` ise `:stable` istiyor: taze kurulum adım 13'te düşüyor ✅ **gelöst (02.10.2026, KHS K2)**

| Alan | İçerik |
|---|---|
| **Ne** | Şablon iki image'ı da `:stable` etiketiyle istiyor; o etiket hiç basılmadı (yalnız `promote-stable.yml` basar, 72 saatlik soak kanıtıyla — K-1) |
| **Nerede** | `onprem/.env.template:46` ve `:52` · `onprem/install.sh:404-410` (hata metni hâlâ O-25'e atıf yapıyor, O-25 gelöst) · ölçüm 02.10.2026, anonim GHCR token: `calendar-api:beta` 200 · `:0.1.0` 200 · `:stable` **404**; `frontend` aynı üçlü, aynı sonuç |
| **Tip** | F (dağıtım kanalı) |
| **Kutuda ne olur** | `docker compose pull` 404 → kurulum adım 13'te durur; kutu hiç kalkmaz |
| **Çözüm** | KHS K2.1: `install.sh` kanal sorar (varsayılan beta, K-1), seçimi `.env`'e yazar. ⚠️ Şablonun varsayılanı **`:stable` kalır** — şablonu `:beta`'ya çevirmek, `update.sh`'ın .env birleştirmesinde (`update.sh:509-528`: müşteri değeri = taban ise bizimki uygulanır) her `:stable` kutuyu sessizce beta kanalına taşır. Kanal geçişi yalnız yukarı serbest: beta→stable, `:stable` kutunun sürümünden eskiyse runner `downgrade` ile durur (`api-backend/db/migrate.js:244-257`); `update.sh`'ın geri alması aynı `.env`'i geri yüklediği için kutu ayağa kalkmaz → kılavuza (O-152) yazılır |
| **Durum** | `gelöst` (`67dbe9d` + `3684ef8` VERSION 0.2.0): `install.sh` adım 11 kanal sorar (beta varsayılan), `:383` `docker manifest inspect` ön kontrolü, `:stable` yoksa beta'ya düşme sorusu; şablon `:stable` kaldı (`.env.template:46/:52`). Kutuda ölçüldü: 17/17 adım `:beta`. ⚠️ Küçük artık: `.env.template:38-39` yorumu hâlâ kanalların "nicht gebaut" olduğunu söylüyor — bayat, bir sonraki şablon dokunuşunda düzeltilir (davranışa etkisi yok) — Önceki: `geplant (KHS K2.1)` |

### O-149 (Y3) — `manifest.json` bayat; ilk `update.sh` koşusu "Sapma" ile kalıcı durur. Paket listesi üç yerde elle tutuluyor ✅ **gelöst (02.10.2026, KHS K2)**

| Alan | İçerik |
|---|---|
| **Ne** | Manifest iki dosyanın eski hash'ini taşıyor; ayrıca paketin dosya listesi üç ayrı yerde, birbirinden habersiz duruyor |
| **Nerede** | Hash farkı (02.10.2026, `git show :onprem/<dosya> \| sha256sum` ↔ manifest): `docker-compose.yml` index `7471651…` ↔ manifest `57e25f3…` · `update.sh` `f33a1d1…` ↔ `83efb2f…` (diğer 5 kök dosya uyuşuyor). Tohum: `install.sh:516-532` sapma tabanını manifest'ten yazar. Üç liste: `tools/onprem-manifest.mjs:37-53` (`BUNDLE_DATEILER`) · `api-backend/Dockerfile:37-39` (`COPY --from=onprem`) · `.github/workflows/publish-calendar-api.yml:12-20` (tetik yolları — `backup.sh`/`restore.sh` **yok**) |
| **Tip** | F |
| **Kutuda ne olur** | git'ten kurulan kutuda disk = yeni dosya, taban = eski manifest hash'i → ilk gece `update.sh:418-433` "elle değiştirilmiş" sanar, `konflikt` yazar, `exit 1`. Her gece aynı → kutu güncelleme almaz. Listeler ayrışırsa: yeni dosya manifest'te olup Dockerfile'da yoksa `update.sh` onu sessizce atlar (`[ -f "$kaynak" ]`); bind-mount ise Docker'ın açtığı boş dizine düşer (O-72 dersi) |
| **Çözüm** | KHS K2.2: manifest yeniden üretilir + kapı. Kapı tek liste kaynağına (`BUNDLE_DATEILER`) bakar: `node tools/onprem-manifest.mjs --check` içeriği **index'ten** (`git show :onprem/<yol>`) hash'ler, diskten değil (kısmi stage + CRLF tuzağı); üretici de aynı yerden okur. `--check` ayrıca her `BUNDLE_DATEILER` girdisinin Dockerfile COPY satırlarında geçtiğini doğrular. Workflow tetik boşluğu kapı sayesinde dolaylı kapanır: paket dosyası değişince manifest de değişmek zorunda, manifest tetik listesinde |
| **Durum** | `gelöst` (`c880ad1` + `acc51d5`): `node tools/onprem-manifest.mjs --check` index'ten hash'liyor ve **dört** elle listeyi bağlıyor — manifest SHA · Dockerfile COPY · workflow `paths` · smoke test `BUNDLE_DATEIEN` (dördüncü liste ön kontrolümde yoktu; `e4c7703`'ten sonra API image'ı üç push kırmızı kaldı, `acc51d5` kapıya ekledi). 02.10.2026: `--check` → "17 dosya tutarlı". Kutuda `update.sh` iki koşu `ok`, konflikt yok — Önceki: `geplant (KHS K2.2)` |

### O-150 (Y4) — `app.praxura.de` uygulama kodunda hâlâ sabit; kapı `api-backend/routes/` ve `module/`'ü saymıyor ✅ **gelöst (02.10.2026, KHS K2)**

| Alan | İçerik |
|---|---|
| **Ne** | Hastaya/çalışana giden link ve yönlendirmeler sabit SaaS adresine gidiyor; kapının `app_host` sayacı bu dosyaların bir kısmını hiç görmüyor |
| **Nerede** | `dashboard.js:19237` (Termin-Anfrage linki) · `api-backend/server.js:4081` `:4101` `:4274` `:4404` (hasta/owner mailleri, iptal/kabul linkleri) · `:575` `:597` `:612` `:615` (Google OAuth dönüşü — SaaS'a özgü, O-08) · `:3211` (`recover-checkout`, merkez) · `api-backend/routes/mitarbeiter-zugang.js:191` (`APP_BASE_URL`, compose'da yok) · `module/mitarbeiter-zugang.js:189-191` (yalnız `window` yoksa). Kapı: `tools/check-onprem.sh:75-76` listesi `dashboard.js dashboard.html employee-signup.js admin-login.js api-backend/server.js` — `employee-signup.js` arşivde (`b72d020`), `routes/` ve `module/` yok. Bugün listede 15 (= taban); ikisi eklenince 18 |
| **Tip** | C |
| **Kutuda ne olur** | Kutudan çıkan iptal/kabul linki hastayı SaaS'a götürür (orada kayıt yok → hata); istek kimliği + jeton bizim sunucumuzun loguna düşer (G1'in ruhuna aykırı) |
| **Çözüm** | KHS K2.8. Backend tek kaynak: `lib/dagitim.js` içinde `appBaseUrl()` = `SITE_URL` → yoksa `APP_BASE_URL` → yoksa `https://app.praxura.de` (SaaS VPS'te ikisi de yok, davranış değişmez — G7). Kutuda `SITE_URL` zaten `api`'ye geçiyor (`onprem/docker-compose.yml:430`). ⛔ İsteğin `Origin`/`Host` başlığından kurulmaz: mail linki başlıkla zehirlenir (host-header injection). Frontend: `window.location.origin`. Kapı listesine `api-backend/routes/` + `module/` girer, taban aynı commit'te yeniden ölçülür ve gerekçesi `tools/.onprem-baseline`'a yazılır |
| **Durum** | `gelöst` (`56cb6a7`): `lib/dagitim.js:17` `appBaseUrl()` = `SITE_URL` → `APP_BASE_URL` → SaaS (istek başlığından değil — host-header injection kapalı); `server.js` 9 satır + `routes/mitarbeiter-zugang.js:191`; `dashboard.js` Termin-Anfrage linki `location.origin`. Kapı listesi `routes/` + `module/`'ü sayıyor, `employee-signup.js` çıktı, taban 15→7 (`tools/.onprem-baseline`). O-03 bununla kapandı. Hasta linkinin LAN dışından açılamaması ayrı: O-155 — Önceki: `geplant (KHS K2.8)` |

### O-151 (Y5) — Kutu compose'u `AI_*` geçiriyor, kod `AZURE_OPENAI_*` okuyor: teknisyen anahtar girse de KI açılmaz 🟡 **kısmen (02.10.2026, env sözleşmesi `67dbe9d`)**

| Alan | İçerik |
|---|---|
| **Ne** | İki ad kümesi birbirini görmüyor |
| **Nerede** | `api-backend/ai/azureClient.js:11-16` (`AZURE_OPENAI_ENDPOINT/_API_KEY/_DEPLOYMENT/…`) · `onprem/docker-compose.yml:470-472` (`AI_PROVIDER/AI_ENDPOINT/AI_API_KEY`) · `onprem/.env.template:223-225` |
| **Tip** | E (BYO-key, K4) |
| **Kutuda ne olur** | `.env`'e anahtar yazılsa bile kod boş okur; Rezept-Scan sessizce kapalı ya da ham hata (`azureClient.js:41`) |
| **Çözüm** | Sözleşme adları (K2.7): `AI_MODE` (kutuda varsayılan `aus`) · `AI_PROVIDER` · `AI_ENDPOINT` · `AI_API_KEY` · `AI_MODEL_TEXT` · `AI_MODEL_VISION`. Okuma + `AZURE_*` geri düşüşü M4.1'de (SaaS VPS bugün `AZURE_*` ile çalışıyor). Kutu compose'una `AZURE_*` **girmez** — tek ad kümesi. O-135/O-136 bununla kapanır |
| **Durum** | 🟡 kısmen — compose/şablon yarısı yapıldı (`67dbe9d`, K2.7): `AI_MODE` (`${AI_MODE:-aus}`), `AI_MODEL_TEXT`, `AI_MODEL_VISION` (`docker-compose.yml:473-478`), şablonda `AI_MODE=aus`. **Kalan:** kodun bu adları okuması + `AZURE_*` geri düşüşü — M4.1 (Hat M). O zamana kadar kutuda KI kapalı; bu doğru varsayılan — Önceki: `geplant (KHS K2.7 + M4.1)` |

### O-152 (Y6) — Kurulum kılavuzu yok ✅ **gelöst (02.10.2026, KHS K2)**

| Alan | İçerik |
|---|---|
| **Ne** | Kutuyu kuracak kişinin okuyacağı tek belge yok; bilgi `install.sh` çıktısına, bu sicile ve `RELEASE-STANDARD.md`'ye dağılmış |
| **Nerede** | `onprem/KURULUM.md` yok (02.10.2026) |
| **Tip** | G |
| **Kutuda ne olur** | Kurulum yalnız Kemal'in kafasındaki sırayla yapılabilir; kök sertifika, hosts/DNS, yedek hedefi ve owner şifre kurtarma her kurulumda yeniden keşfedilir |
| **Çözüm** | KHS K2.12. Dil: **Almanca** (ürün yalnız Almanca kararı; okuru sonunda praxis/teknisyen). İçerik: sprint tablosu + O-148'in kanal kuralı + O-154'ün yedek-hedef işareti + Windows yolu (K2.11) + O-107 betiği |
| **Durum** | `gelöst` (`f033be0`): `onprem/KURULUM.md` (Almanca, 250 satır) — Linux + Windows, `home.arpa` + FRITZ!Box rebind, cihaz başına kök sertifika, kurulum jetonu, kanal kuralı (yalnız ileri), yedek hedefi + işaret (O-154), owner şifre sıfırlama (O-107), şifreleme tavsiyesi (K-6). ⚠️ Kurulum adımı `main`'den klonluyor → O-157 — Önceki: `geplant (KHS K2.12)` |

### O-153 (Y7) — `caddy_data` (yerel kök CA) yedeğe girmiyor ✅ **gelöst (02.10.2026, KHS K2)**

| Alan | İçerik |
|---|---|
| **Ne** | Caddy'nin `tls internal` kök CA'sı adlandırılmış volume'de; yedek yalnız `pg_dump` + `volumes/storage` alıyor |
| **Nerede** | `onprem/docker-compose.yml:528` (`caddy_data:/data`), `:537` · kök sertifika yolu `onprem/install.sh:633` · `onprem/backup.sh:141-166` (storage tar + pg_dump, caddy yok) |
| **Tip** | F (yedek) |
| **Kutuda ne olur** | Disk/WSL kaybından sonra geri yükleme veriyi getirir ama Caddy yeni bir kök CA üretir → praksisteki her PC/tablet sertifikayı yeniden içe aktarana kadar tarayıcı uyarısı |
| **Çözüm** | KHS K2.10: `backup.sh`, `docker compose cp caddy:/data/caddy/pki <tmp>` ile **yalnız PKI'yi** alır (volume adı compose proje adına bağlı — sabit volume adı yazılmaz). İçinde özel anahtar var → yedek dizininin `0700`'ü yeterli, künyeye parmak izi. `restore.sh` caddy durmuşken geri koyar |
| **Durum** | `gelöst` (`6a5cd1f`): `backup.sh:170-174` `docker compose cp caddy:/data/caddy/pki` → `caddy-pki.tar.gz`; `restore.sh:486-496` geri koyar + caddy restart, eski yedekte dosya yoksa dokunmaz. Kutuda ölçüldü: yedekte `caddy-pki.tar.gz` var. ⚠️ Restore kolu kutuda çalıştırılmadı — Önceki: `geplant (KHS K2.10)` |

### O-154 — Yedek hedefi bağlı değilse `backup.sh` yedeği sessizce **aynı diske** yazıyor ✅ **gelöst (02.10.2026, KHS K2)**

| Alan | İçerik |
|---|---|
| **Ne** | `BACKUP_ZIEL` dizini yoksa betik onu yaratıyor; NAS/USB disk bağlı değilken o yol, kök dosya sisteminde boş bir dizindir |
| **Nerede** | `onprem/backup.sh:94-106` (`ZIEL_DISI=true`, ardından `mkdir -p "$HEDEF_DIR"`) |
| **Tip** | F |
| **Kutuda ne olur** | NAS düşmüşken ya da USB disk takılı değilken yedek "harici hedefe başarıyla" yazılır ama kutunun kendi diskindedir; disk ölünce yedek de ölür. Windows'ta (K2.11) daha olası: WSL çıkarılabilir USB diski kendiliğinden bağlamaz, `/mnt/e` boş bir dizin olabilir |
| **Çözüm** | İşaret dosyası: `install.sh` adım 12 hedefe `.praxura-backup-ziel` yazar; `backup.sh` dosyayı görmezse yazmaz, `fehler` + O-82 bildirim kanalıyla durur. `mountpoint` yerine işaret, çünkü hedef bir bağlama noktasının alt dizini olabilir |
| **Durum** | `gelöst` (`6a5cd1f`): `backup.sh:109` dış hedefte `.praxura-backup-ziel` yoksa `mkdir`'den (`:113`) **önce** `fehler` + çıkış; `install.sh` adım 12 işareti yazar; Windows betiği adım 11 aynı komutu tarif ediyor. Kutuda ölçüldü: işaret yokken `rc=1`, dizin yaratılmadı — Önceki: `offen` — önerilen sahip: KHS K2.10 (aynı dosya, aynı tur) |

### O-155 — Hastaya giden linkler LAN'daki kutuya dışarıdan ulaşamaz 🟡 **kısmen gelöst (08.10.2026, K2b.10) — kalan: Kemal kararı KHS §5b T13**

| Alan | İçerik |
|---|---|
| **Ne** | Termin iptal/kabul linkleri ve public booking sayfaları internetten erişilebilir bir sunucu varsayıyor; tipik kutu yalnız praksis ağında |
| **Nerede** | `api-backend/server.js:4081` `:4274` `:4404` (hasta maillerindeki linkler) · `booking.html` · `booking-request.html` |
| **Tip** | G |
| **Kutuda ne olur** | O-150 düzeltilince link doğru host'a (`SITE_URL`) gider ama hasta evinden `praxis.home.arpa`'ya ulaşamaz → link açılmaz. Düzeltmeden önce SaaS'a gidiyor (O-150) |
| **Çözüm** | Kemal kararı: (a) kutuda bu maillerde link olmaz, metin "bitte Praxis anrufen" der; (b) özellik `IST_KUTU`'da gizlenir; (c) müşteri gerçek alan adı + port yönlendirme kurar (kılavuzda isteğe bağlı yol). Merkezden proxy **yok** (G1/K6). K3 testinden önce seçilmeli, yoksa test senaryosunda kırık link çıkar |
| **Durum** | `geplant` (KHS K2b, K-18, 05.10.2026) — **yalnız yarısı çözülüyor, bkz. §7Z.** Gerçek ad (`praxis-XXXX.praxura.de`) host sorununu kapatır: link doğru ada gider, praksis içinde, praksis VPN'inde ve Hetzner varyantında açılır. **Ama hasta praksisin VPN'inde değil:** LAN/PC kutusunda ad iç IP'yi gösterir, hasta evden linki yine açamaz. Kalan kısım: kutu internetten erişilebilir değilse hasta maillerinde link yerine "bitte Praxis anrufen" metni (seçenek a/b, bayrak env'den — iki dağıtımda tek kod). Sahibi: K2b.10, karar Kemal. Merkezden proxy hâlâ **yok** (G1/K6) — Önceki: `offen`. **05.10 öğle (K-19 j):** online randevuda Y1 (yok) ve Y2 (mail ile talep) **düştü**; yön Y3 (hasta formu tarayıcıda praksisin anahtarıyla şifrelenir, bizde yalnız chiffrat postakutusu, kutu çeker) → `/konsey` §3b, bkz. O-166 (O-167 KI relay, O-168 km). Konsey kararına kadar kutuda hasta maillerinde link yerine "Mail vorbereiten" (mailto, K2b.15 ⬜) — **07.10.2026 (K2b.15 ön kontrol):** link bayrağı (env) hâlâ yok, (a)/(b)/(c) kararı Kemal'de açık. O kararı verene kadar kutudaki `mailEntwurf` metninde iptal/kabul linki **olmaz**, yerine telefon cümlesi gelir (seçenek a). Sebebi: LAN kutusunda link hastaya kırık gider, K3 testinde de kırık link çıkmamalı. Link açık olduğunda dönüş tek satır: bayrak gelir, `istKutu() && !bayrak` iken link çıkarılır. SaaS metni değişmez. Soru §5b'de. **07.10 akşam:** K2b.15 kodu bu kararla hazır (commit bekliyor). `mailEntwurf` yalnız `istKutu() && !SMTP_HOST` iken üretiliyor, kutuda SMTP varsa eski gönderim aynen kalıyor. Metinde link yok. Dört uç da owner auth arkasında · **08.10.2026 (K2b.10, onprem sicil turu):** `geplant`→🟡 `kısmen gelöst`. Doğrulanan yarı: gerçek ad (K2b.3, `hafer-turm-9.box.praxura.de` LE sertifikalı) host sorununu kapattı; K2b.15 `69e6d42c` push'ta — `api-backend/lib/mail-entwurf.js` kutuda (`istKutu() && !SMTP_HOST`) linksiz taslak üretiyor, SaaS metni değişmedi. Kalan yarı: internete açık kutuda (Hetzner, Weg C) linkin env bayrağıyla geri gelip gelmeyeceği — Kemal kararı KHS §5b T13. Karar gelene kadar kutu linksiz kalır (güvenli varsayılan); karar "link yok" ise madde kod değişmeden `gelöst` olur, "bayrak" ise tek env + `istKutu() && !bayrak` satırı. Merkezden proxy yine **yok** (G1/K6) |

---

## 7X — KHS K2 kapanışı: sonra-bildir turu (02.10.2026)

> Commit'ler (hepsi `main`, push'lu): `18ad39a` (ön kontrol) · `c880ad1` K2.2 · `d807c3e` K2.3 · `e4c7703` K2.4 · `67dbe9d` K2.5+K2.7+K2.1 kanal · `6d50e3d` K2.6 · `56cb6a7` K2.8 · `a4634f7` K2.9 · `6a5cd1f` K2.10 · `acc51d5` CI düzeltmesi · `ebe318c` K2.11 · `f033be0` K2.12 · `3684ef8` VERSION 0.2.0.
>
> **Kapanan (12):** O-03 · O-09 · O-107 · O-129 · O-136 · O-147 · O-148 · O-149 · O-150 · O-152 · O-153 · O-154. **Kısmen (4):** O-123 (restore kolu) · O-142 (setup.html M2.5) · O-144 ((b) ölçülmedi) · O-151 (kod M4.1). O-11 kutuda güvenli, kalıcı çözüm Faz 1.5. Kanıtlar her maddenin Durum hücresinin başında.
>
> **guvenlik S-21 (K2.6, `6d50e3d`)** — onprem açısından: rol başına şifre (`onprem/volumes/db/praxura-rollen.sql` → `99a-…`, `docker-compose.yml:109/:129/:218`, `${X:-${POSTGRES_PASSWORD}}` geri düşüşü eski `.env` için), `restore.sh:416` 99a'yı yeniden uygular. Kutuda ölçüldü: her rol kendi şifresiyle bağlanıyor, `POSTGRES_PASSWORD` ve yanlış şifre **ağ üzerinden** reddediliyor (127.0.0.1 upstream `pg_hba` trust — konteyner içi test yanıltıcıdır, ölçüm ağdan yapılmalı). Sicil maddesi açılmadı: kendi sicili guvenlik'te; buradaki tek bağ O-157'nin geri-düşüş tehlikesi.
>
> **Ders:** O-149'un "üç elle liste" sayımı eksikti — dördüncüsü smoke test'in `BUNDLE_DATEIEN`'iydi ve üç push boyunca API image'ını kırmızıda tuttu. Elle tutulan liste sayılırken CI'ın kendi listeleri de sayılır.

### Migration numarası rezervasyonu ↔ O-129 kapısı — çelişkinin çözümü

`KUTU_HAZIRLIK_SPRINT.md:76-79` "numarayı rezerve et = dosyayı uygulamadan **önce** ayrı commit'le push et" diyor; O-129 kapısı satırın commit anında **son hâlinde** olmasını istiyor. İkisi birlikte yaşayamaz ve **kapı haklı**: uygulanmamış bir `.sql` `main`'e girdiği anda CI onu `:beta` image'ına koyar, `:beta` kutusu SaaS'tan **önce** uygular (O-121'in ters hâli) ve dosya sonra düzeltilirse SHA değişir, kutu açılmaz. Rezervasyonu `.sql` olarak yapmak (boş/yer tutucu dosya) daha kötü: runner onu uygular ve SHA'sını kilitler (`migrate.js:34` her `NNNN_*.sql`'i alır).

**Tavsiye — rezervasyonu kaldır, çakışmayı push anında çöz:** çakışmanın maliyeti sanıldığından düşük, çünkü SaaS'ta runner koşmuyor (`praxura_migrations` defteri SaaS'ta dosya adı tutmuyor) — yani SaaS'a MCP ile uygulanmış ama henüz push edilmemiş bir dosyanın **numarası değiştirilebilir**, hiçbir yerde kırılmaz. Sıra:

1. `git pull` → sıradaki numara → dosyayı yaz
2. MCP ile SaaS'a uygula → başlığa `-- SaaS: angewandt TT.MM.JJJJ` → döküm tazele → commit
3. `git pull --rebase`; numara bu arada alındıysa `git mv` ile bir sonrakine kaydır (içerik değişmez, yalnız ad), `--amend`, push
4. İki dosya **aynı nesneye** dokunuyorsa (sıra anlamlıysa) ikinci gelen kendi dosyasını yeniden okur — bu insan kararıdır, kapı değil

Sprint §2 madde 3 bu dört adımla değiştirilir (`builder`/Kemal; belge işi). Kapıya dokunulmaz. `SKIP_SAAS_ZEILE_GATE=1` **rezervasyon için kullanılmaz** — kaçış, box-only satırın yazılamadığı gerçek istisnalar içindir. CI fiyat botu aynı "en büyük + 1" mantığını rebase döngüsüyle zaten uyguluyor (`preise-check.yml:210-218`), yani bot bu sırayla uyumlu — ama satır eksik: O-156.

### O-156 — CI fiyat botunun ürettiği seed migration'da `-- SaaS:` satırı yok; bot kapıyı hiç görmüyor 🔴 **offen**

| Alan | İçerik |
|---|---|
| **Ne** | `preise-check.yml` fiyat turunda `db/migrations/NNNN_seed_heilmittel_katalog_preisrunde_*.sql` yazıp push ediyor; CI checkout'unda hook yok, O-129 kapısı koşmuyor ve başlıkta satır yok |
| **Nerede** | `.github/workflows/preise-check.yml:216-218` (numara + dosya adı) · `:225-232` (başlık `echo`'ları — `SaaS:` geçmiyor; `grep -n "SaaS:" .github/workflows/preise-check.yml` → 0) · aynı dosya `:306` bu migration'ın SaaS'a **uygulanmadığını** kendisi söylüyor |
| **Tip** | D |
| **Kutuda ne olur** | Kutuda hiçbir şey (dosya doğru uygulanır). Hasar O-129'un aynısı: ilk otomatik fiyat turunda zincire satırsız bir dosya girer, ve bot dosyası değiştirilemez (SHA) — "SaaS'a uygulandı mı" sorusunun cevabı yine kayıtsız kalır. Kural insanlar için konup bot için açık kaldı |
| **Çözüm** | Tek `echo` satırı, bot için **sabit cevap**: `-- SaaS: nicht angewandt (box-only): Preisquelle der SaaS-Abrechnung sind die Codedateien; heilmittel_katalog-Anzeige nur per sync_heilmittel_katalog.js von Hand`. Sahibi: `builder`, KHS K2 artığı (bir satır, `:226` civarı). Bir sonraki fiyat turundan (çeyrek başı, 01.01.2027 öncesi) önce şart |
| **Durum** | `offen` — sahibi önerildi (builder, KHS K2 artığı), atanmadı |

### O-157 — Kurulum paketi `main`'den klonlanıyor, kanalın sürümünden değil: `:stable` kutu ileri sürümün compose'uyla kalkar 🟡 **kısmen gelöst (08.10.2026, kod `e93c86ab` + `6dd3b2ce`) — kalan: temiz kurulum KHS §5b T17 (a)(b)**

| Alan | İçerik |
|---|---|
| **Ne** | Hem Windows betiği hem Linux kılavuzu `onprem/`'u `git clone --branch main` ile alıyor; image ise seçilen kanaldan (`:beta`/`:stable`) geliyor. Dosya seti ile image farklı sürümlerden |
| **Nerede** | `onprem/windows/praxura-installieren.ps1:44` (`$Zweig = 'main'`) ve adım 5 (`git clone --depth 1 … --branch $Zweig`) · `onprem/KURULUM.md:33-35` · `update.sh:157-170` paketi **image'tan** çıkarıyor (doğru kaynak) · etiketler var: `git tag` → `v0.1.0`, `v0.2.0` |
| **Tip** | F (dağıtım kanalı) |
| **Kutuda ne olur** | Bugün zararsız (`:stable` yok, `:beta` ≈ `main`). `:stable` terfi ettikten sonra `main` ilerlediğinde: `:stable` seçen yeni kutu, **ileri** sürümün compose/install.sh'ıyla kurulur; ilk gece `update.sh` image'taki (eski) paketi diske yazar — yani dosyalar **geriye** gider. O-148'de "kanal yalnız ileri" dedik; burada kurulumun kendisi bir geri adım üretiyor. Somut örnek sınıfı: ileri compose `99a-praxura-rollen.sql` ile rol şifrelerini ayırır (K2.6), geri giden compose bu env'leri tanımıyorsa servisler `POSTGRES_PASSWORD` ile bağlanmayı dener → DB rolü artık farklı şifrede → `rest`/`auth`/`storage` düşer. (0.2.0'dan sonraki her sürüm geri düşüşü taşıdığı için bu belirli örnek ileride kendini korur; sınıf korumaz) |
| **Çözüm** | Paket, image ile **aynı sürümden** alınır. En ucuzu: kanal sorusu klondan önce sorulur, `docker manifest inspect` ile kanalın `org.opencontainers.image.version` etiketi okunur, `--branch v<sürüm>` klonlanır (etiketler zaten basılıyor). Daha sağlamı: klon hiç yapılmaz, `install.sh`'ın kendisi image'tan alınır (`docker create` + `docker cp /app/onprem-bundle`, `update.sh:157`'nin aynısı) — tek kaynak image olur. Sahibi: Faz 2.1c/KHS K3 öncesi, `:stable` ilk terfisinden **önce** |
| **Durum** | `geplant` (K2b.14, 05.10.2026) — indirme sayfasının [08.10.2026: tasarım ön kontrolü + şartlar O-176] [08.10.2026: tasarım ön kontrolü + uygulama şartları → O-176] başlatıcıları (`install.ps1`/`install.sh`, praxura.de'de statik) **yayınlanmış sürüm paketini** indirir, `main`'i değil. Kabul ölçütüm: paket ile image aynı sürüm etiketinden (tercihen paket image'ın içinden ya da `v<sürüm>` etiketli sürüm varlığından); `irm … \| iex` satırı yalnız başlatıcıyı çeker, başlatıcının kendisi sürümü sabitler. Statik dosya → yeni Vercel fonksiyonu yok (G8 temiz). `:stable` terfisi hâlâ bu maddeye bağlı — Önceki: `offen` · **08.10.2026 (K2b.10, onprem sicil turu):** `geplant`→🟡 `kısmen gelöst`. Doğrulandı: `installieren/install.sh` + `installieren/install.ps1` paketi `git clone` ile değil image'tan (`docker create` + digest) alıyor — iki dosyada `git clone`/`github`/`Zweig` sıfır (grep), eski `onprem/windows/praxura-installieren.ps1` kalktı (`git mv`), KURULUM'da `git clone` sıfır. `6dd3b2ce` install.ps1 son işareti (yarım indirme koşmaz, guvenlik S-52 Nr. 1). T17 (c) canlı yayın ✅ (`497ebea8`: `text/plain`, `no-store`, SHA-256 = depo). **Nerede** satırındaki `onprem/windows/praxura-installieren.ps1:44` artık tarihsel. Kalan: T17 (a) temiz Ubuntu + (b) temiz Windows 11 PS 5.1 tek satır kurulum → O-176 ile birlikte `gelöst`. `:stable` terfisi hâlâ buna bağlı |

### O-158 — WSL'de disk-yeri kapıları kör: `df` sanal diski ölçüyor, `C:` dolarken hiçbir betik durmuyor 🔴 **offen**

| Alan | İçerik |
|---|---|
| **Ne** | Kutunun üç disk kontrolü dağıtımın içinden `df` okuyor; WSL'de bu, `ext4.vhdx`'in sanal boyutudur (varsayılan üst sınır ~1 TB), gerçek `C:` boşluğu değil. vhdx büyür ama kendiliğinden küçülmez |
| **Nerede** | `onprem/backup.sh:136` · `onprem/update.sh:118` · `onprem/install.sh:137` · Windows ön kontrolü yalnız kurulum anında: `praxura-installieren.ps1` adım 1 (`Get-PSDrive C`, ≥50 GB) · vhdx yeri `C:\ProgramData\Praxura\wsl` |
| **Tip** | F |
| **Kutuda ne olur** | `BACKUP_ZIEL` boşsa (betik "başlangıçta boş bırakılabilir" diyor) her gece yedek **aynı vhdx'e** yazılır, vhdx büyür; `backup.sh` "yer var" sanar. `C:` dolduğunda vhdx yazamaz → Postgres yazma hatası/bozulma riski **ve** Windows'un kendisi (praksis PC'si) bozulur. Linux sunucuda O-88'in disk kapısı bunu yakalıyordu; Windows'ta yakalamıyor |
| **Çözüm** | (1) Windows tarafında gecelik bir Windows görevi ya da Autostart görevinin içinde `C:` boşluğu `C:\ProgramData\Praxura\` altına bir dosyaya yazılır, `backup.sh`/`update.sh` o dosyayı `/mnt/c/...` üzerinden okuyup eşik altında durur (`fehler` + O-82 kanalı). (2) Kurulumda `wsl --manage Praxura --set-sparse true` (WSL 2.x; boşalan alan geri verilir). (3) Windows kurulumunda `BACKUP_ZIEL` boş bırakmak **önerilmez** — betik metni "leer lassen geht auch" yerine harici hedef ister. Sahibi: KHS K3 (Windows kutusu ilk müşteriye gitmeden önce) |
| **Durum** | `offen` — sahibi önerildi (KHS K3), atanmadı |

### K2.11 WSL testinde ölçülmeyen, ilk müşteri Windows kutusundan önce ölçülmesi gerekenler

Madde açılmadı (ölçüm listesi; sonuç olumsuzsa madde olur). Kemal'in yönetici koşusunda:

1. **Oturumsuz açılış:** yeniden başlat, **kimse oturum açmadan** tabletten `:443` → 200? Görev `Password` logon'da `wsl.exe`'yi session 0'dan başlatıyor; bu, WSL'in kullanıcıya bağlı olduğu için en kırılgan adım. Microsoft hesabı + yalnız PIN kullanan PC'de (Windows Home'da yaygın) parola girilemez → `ONLOGON`'a düşer → Windows Update gece yeniden başlatınca kutu **sabaha kadar kapalı**, 01:00 yedek ve 02:00 güncelleme kaçar. Ölçülecek: Windows Update yeniden başlatmasından sonra kutu kendiliğinden kalkıyor mu.
2. **Kurulumu yapan hesap = kutunun sahibi hesap:** `.wslconfig` (`%UserProfile%`), dağıtım kaydı ve Autostart görevi yöneticiyi çalıştıran kullanıcıya yazılıyor. Teknisyen kendi yönetici hesabıyla yükseltirse kutu **teknisyenin** profiline kurulur. Test aynı kullanıcıyla yapıldı. Kılavuza tek cümle: "Betik, PC'nin günlük kullanıcısı olan hesapta sağ-tık → yönetici olarak çalıştırılır."
3. **Uyku sonrası saat kayması:** WSL VM'i host uykusundan sonra saati geride tutabilir (JWT `exp`, TLS, yedek damgası). Standby kapalı olduğu için olasılık düşük; ölçüm: hazırda bekletme→uyanma sonrası `wsl -d Praxura date` ↔ Windows saati.
4. **Dinlenmede şifreleme:** vhdx (hasta verisi) `C:`'de; Windows **Home**'da BitLocker yok (yalnız TPM+Microsoft hesabı şartlı "Geräteverschlüsselung"), USB yedek diskinde drvfs üzerinden `chmod 700` etkisiz (NTFS). K-6 tavsiyesi Home PC'de uygulanamayabilir — `legal-de`/`guvenlik`'e gider, bu sicilin vetosu değil (G1 ihlali yok: veri dışarı çıkmıyor).
5. **(b) O-144:** çalışan çıkarma → `user banned`.

---

## 7Y — M1.9: Papier-Empfangsnachweis 78040 (03.10.2026)

Die additive Migration `0059_podologie_empfangsnachweise` nutzt die bestehende Schema-Verteilung O-39/Faz 1.7 (Typ D). Sie speichert unveränderliche Vollständigkeits-Prüfvermerke zum originalen Papiernachweis für HPNR 78040; sie ersetzt weder Patientenunterschrift noch technische DAS-Quittung. Kein neuer externer Dienst und keine neuen On-prem-Umgebungsvariablen; Auslieferung erfolgt über die bestehende Image-/Migrationskette.

Root hat den Übergang 0058→0059 auf einer frischen isolierten lokalen Box physisch gemessen: 84 Tabellen, 156 Policies, 85 eigene Funktionen, 84 Trigger und 309 Indizes; zusätzlich 1 Authtrigger, 5 Buckets, 1 Publication-Mitglied und 8 Extensions. Manifest-Zähler gelten bis0059; RLS bleibt nur für `spatial_ref_sys` deaktiviert. SaaS-Anwendung ist tatsächlich `20261003193551`; die vollständigen SaaS-Dumps haben einen anderen Bestand und werden nicht als Box-Sollwerte verwendet.

Lokale Produktversion `0.4.0` (MINOR wegen neuer Tabelle); Bundle-Manifest wird mit dem vorhandenen Erzeuger synchronisiert. Gesamttests 1574 Frontend/730 Backend/98 Tools bestanden. Kundenbox-Auslieferung, Live-UI-Abnahme und 72 Stunden Betrieb für `:stable` sind damit nicht nachgewiesen.

## 7AB — K-19 / K2b.15 sonra-bildir (05.10.2026 öğle, `b54cb42` kod · `26662ae` plan)

> Koda karşı bakıldı, kapı `tools/check-onprem.sh` exit 0, tabanlar değişmedi (`n8n_host=8`, `app_host=7`).
>
> - **`supabase-config.js:22` API_BASE yedeği** — `/api/config` düşerse mutlak SaaS adresi yalnız `hostname === 'app.praxura.de'`'de, başka her yerde `/api`. Tip C, doğru yön: kutuda token artık hiçbir koşulda SaaS'a gitmez (G1). Sabit host satırı zaten tabanda sayılıydı (O-01 notu), yeni satır yok. Yan etki: Vercel preview / `localhost` da `/api`'ye düşer — ikisi de `/api/config`'i sunuyor, yedek yalnız o da düşerse devreye girer; kabul.
> - **IST_KUTU koşulları (`dashboard.js`)** — Bezahlwand, `checkPlanActive`, past_due bandı, admin linki, Google Takvim kartı kutuda gizli. Tip H + G. Kutuda bugün **hiç** plan/yetki kapısı kalmadı; bu bilinçli (K-19 f: çalışan sınırı da kalkıyor, lisans K-11 gelince tek `entitlements` noktasına bağlanır — Faz 3.3). Görüş, veto değil: lisans bağlanırken bu `!IST_KUTU` dalları aynı helper'a toplanmalı, yoksa iki yetki gerçeği olur. Google: backend rotaları (`/calendar/google-*`) kutuda duruyor, yalnız UI gizli — redirect kutu başına kaydedilemediği için çağrılamaz, zararsız.
> - **Belegliste/CSV `new URL(…, location.origin)`** — göreli `/api`'de `ERR_INVALID_URL` kapandı. Kapı bu sınıfı saymıyor; `new URL(\`${API}…` deseni başka yerde çıkarsa aynı düzeltme.
> - **FullCalendar Premium → Standard MIT 6.1.11** — Premium NonCommercial anahtarla ticari müşteri kutusuna dağıtılıyordu; kalktı. K8/n8n'in kuzeni bir dağıtım-lisans riski bu commit'le kapandı. THIRD-PARTY-NOTICES satırı K2b.16 / O-42. Vendor dosyası image'a `frontend.Dockerfile` COPY ile giriyor, ayrı iş yok.

> **§3b merkezi servis** (Y3 postakutusu · KI relay · km) bu notta madde açmıyor — konsey turunda O-166/O-167/O-168 olarak açıldı (§7AA-Konsey, dosya sonu).

## 8. Kapı — sayaçlar ve tabanlar

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
| `n8n.infinitymade.de` | ~~26~~ → **7** | `*.js` `*.html` `*.mjs`; `archive/` `vendor/` `funktionen/` `onprem/` `.claude/` `node_modules/` `index-old.html` `ai chatbot proje/` hariç |
| `app.praxura.de` (uygulama yüzeyi) | ~~19~~ → **15** | `dashboard.js` `dashboard.html` `employee-signup.js` `admin-login.js` `api-backend/server.js` — pazarlama/blog hariç (O-04) |
| `api/` fonksiyon sayısı | **12** | `find api -name "*.js" -not -path "api/_lib/*"` — artış = red (limit + G8) |
| Üçüncü-parti `<script src="http…">` | ~~11~~ → **0** | Sentry loader statik olarak kaldırılmıştı, 17.09.2026'da (`1935d73`, O-06) runtime-koşullu yükleyiciye çevrildi — statik etiket 11 HTML dosyasından da çıktı. `tools/.onprem-baseline` → `ext_script=0`. Yeni host = red |
| `N8N_` env referansı | **3** | `server.js:1216` `:1969` `:1972` (satırlar 11.09.2026 akşamı, `86aae7b` sonrası yeniden ölçüldü) — artış = red, hedef sıfır (Faz 1.2) |
| `.supabase.co` sabit referansı (ürün kodu) | **1** | ⚠️ Sicil bunu **0** sanıyordu; kapı ölçümünde 1 çıktı: `api-backend/test_schema.js:5` (test dosyası, env fallback'li — O-05'te zaten istisna olarak yazılıydı, sayaçta unutulmuştu). `ops/` ve `vercel.json` hariç. Artış = red |
| `fonts.googleapis.com` / `esm.sh` / `unpkg` / `jsdelivr` / `cdnjs` | **0** | Uygulama kodu; `ai chatbot proje/` hariç. Sıfırdan artış = red (Konsey 2026-08-13 S3) |
| `latest` etiketi yayın hattında | ~~1~~ → **0** | ✅ **12.09.2026'da hedefe ulaştı** (O-25/R9, `f69accc`): `:latest` her iki publish workflow'undan da düştü, SaaS host'u `:beta`'ya geçti. Bu bir **sayaç değil**, O-25'in kabul ölçütüydü; yerini `VERSION`/`manifest.json` eşitlik kapısı aldı (R12) |
| Yıkıcı DDL kanıtı | — | Yeni migration dosyasında `DROP COLUMN` / `DROP TABLE` / `RENAME COLUMN` / `SET NOT NULL` / `DROP CONSTRAINT` varsa dosya başında `-- ZWEISTUFIG: <no> · <gerekçe>` satırı **zorunlu** (`SCHEMA-VERTEILUNG.md` §6.2, `RELEASE-STANDARD.md` §4.7) |
| Migration'lı PATCH | — | Sürüm PATCH ise `db/migrations/` altında yeni dosya olamaz (`RELEASE-STANDARD.md` §2.2). Release listesi adım 1 |
| Koda gömülü gönderen adresi (`noreply@` + sabit alan adı) | ~~6~~ → **2** | `api-backend/server.js` (`:3981` `:4002` `:4174` `:4212` `:4316` `:4363`). Ölçüm: `git grep --cached -c "noreply@praxura\.de" -- api-backend/`. Artış = red; hedef **0** (tek yardımcı + `.env`'den gönderen, O-51). ✅ Kapıda **kurulu ve sınandı** (11.09.2026): yedinci sabit adres eklendiğinde `absender_fest : 6 -> 7` diyerek reddetti |
| On-prem compose `image:` satırı | **8** (11.09 akşamı 7'den) | `onprem/docker-compose.yml` (11.09.2026): db · auth · rest · realtime · storage · kong + kendi `api`'miz. Upstream'in 11 fremd konteynerinden 5'i bilinçli dışarıda. Artış, `onprem/NOTICE.md`'ye lisans satırı eklenene kadar **red** (O-42). Sayaç `onprem_image`, kapıda test edildi (8'e çıkarıldığında reddetti). ⚠️ İki not: sayaç `git grep --cached` ile ölçer — kurulumda bir tur `--cached`siz ölçülüp taban kendiliğinden **0'a sıkışmıştı**, düzeltildi; ve kapı yalnız **sayıyı** tutar, `NOTICE.md`'de karşılık gelen satırın varlığını **denetlemez** (O-42). **11.09 akşamı 8'e çıkarıldı:** `caddy` (Faz 2.1b, arayüz + TLS + reverse proxy). Yükseltme gerekçesi §7F'de |
| `vercel.json` CSP'sindeki bulut adresi | **53** | `git grep --cached -oE "https?://[a-zA-Z0-9.*-]+" -- vercel.json` — **token** sayar, satır değil. Hedef sıfır **değil**: SaaS'ın kendi bulut adresleri o satırda meşru; amaç sessiz büyümeyi yakalamak. Artış = red, çıkış yolu: "gerçekten SaaS'a mı özel?" — öyleyse kabul, ama `onprem/Caddyfile`'a asla kopyalanmaz (O-52) |

---

## 7AI — T14 bildirimi + fatura snapshot (v) ön kontrolü + 0076 (09.10.2026 gece, Hat K)

**(1) T14 → O-175 `gelöst`** (ölçüm O-175 Durum'unda). Yan bulgu yeni madde: O-185.

### O-185 — SMTP'siz kutuda alarm maili "gönderildi" sayılıyor: log yanlış söylüyor, 7 gün sayacı ilerliyor ✅ **gelöst (`045b70cb`)**

| Alan | İçerik |
|---|---|
| **Ne** | `update-alarm-mail.mjs` SMTP yokken exit 0 veriyor; çağıranlar 0'ı "gönderildi" diye okuyor |
| **Nerede** | `api-backend/setup/update-alarm-mail.mjs:19` (`if (!process.env.SMTP_HOST) process.exit(0)`) · çağıranlar: `onprem/update.sh:141-156` (`mail_gonder_container`), `:403-405` (`bildirim_degerlendir` → `ok "Bildirim maili gönderildi"` + `yeni_epoch=simdi`), `:180` / `:202` (sertifika uyarısı, `ZERT_STAND` yazılıyor) · `onprem/backup.sh:125-128` (gece yedeği alarmı, kopya) |
| **Tip** | G (kutu işletimi, alarm kanalı) |
| **Kutuda ne olur** | O-142'den beri `install.sh` SMTP'yi **sormuyor**. Yani SMTP'siz kutu istisna değil, **varsayılan**. O kutularda her alarm (`yedek_basarisiz`, `bakim_modu`, sertifika bitişi, gece yedeği) `update.log`/`backup.log`'a "[ok] … gönderildi" diye düşüyor, kimseye gitmiyor ve `son_basarili_gonderim_epoch` ilerliyor. Owner SMTP'yi sonradan kurarsa takılı durum için 7 gün tekrar mail gelmiyor (sertifikada da aynı). Teşhis eden kişi (destek, owner) logda "gönderildi" görür ve kanalın çalıştığını sanır. O-82'nin "SMTP'siz kutuda kanal yok" sınırı biliniyordu; **logun bunu gizlediği** bilinmiyordu. Hasta verisi yok, G1-G8'e değmiyor |
| **Çözüm** | Hat K'nin önerisi doğru: **GEÇER, şu şartlarla.** (1) `update-alarm-mail.mjs` SMTP yokken **exit 3**. (2) `mail_gonder_container` rc'yi yakalasın: 3 ise **`run --rm` fallback'ine düşmesin** (konteyner sağlıklı, SMTP yok; ikinci deneme anlamsız), 3 döndürsün. `set -e` altında `cmd \|\| rc=$?` biçimi; `timeout`'un 124'ü "başarısız" kalır. (3) `bildirim_degerlendir`: rc 3 → `warn "Bildirim atlandı: SMTP kurulu değil (sonuc=…)"`, epoch **ilerlemez**, `son_sonuc` yine yazılır (SMTP sonradan gelince aynı durumda epoch 0 → ilk koşuda gönderir). Sertifika dalı (`:180`, `:202`) rc 3'te `ZERT_STAND` yazmaz. (4) `backup.sh:125-128` kopyası **aynı commit'te** aynı mantıkla (kopya sözleşmesi `backup.sh:91-93`: argv'ye çıkış kodu da eklendi, yorum güncellensin). (5) Karışık sürüm kabul: yeni `update.sh` + eski imajın mjs'i → eski 0 = bugünkü davranış (gerileme yok); eski `update.sh` + yeni mjs → 3 "başarısız" sayılır, her koşu bir warn + tekrar deneme. Zararsız ve geçici (Schritt 7 `update.sh`'ı yeniler). (6) `manifest.json` yeniden üretilir. Test: mjs'in çıkışları (SMTP yok → 3, kötü SMTP → 1) + `bildirim_degerlendir` için rc 0/1/3 senaryosu (epoch ilerliyor mu). **Kalıcı sınır değişmiyor:** SMTP'siz kutuda alarm kanalı yine yok, tek gerçek kapanış Faz 2.4 paneli (O-82). Bu madde yalnız logun ve sayacın doğruyu söylemesini sağlar |
| **Durum** | ✅ `gelöst` — `045b70cb` (09.10.2026, Hat K). Beş şartın beşi: `update-alarm-mail.mjs` SMTP yok → exit 3 · `mail_gonder_container` `\|\| rc=$?`, rc 3'te `run --rm` fallback yok, log "Bildirim atlandı: SMTP kurulu değil (sonuc=…)", return 3 · `bildirim_degerlendir` rc 3'te epoch ilerlemez, `son_sonuc` yazılır · sertifika yolları rc≠0'da `ZERT_STAND` yazmıyor (zaten öyleydi) · `backup.sh` kopyası aynı mantık, kopya-sözleşme yorumu Exit 3'ü anıyor; manifest yeniden üretildi. Test: `tools/onprem-alarm-mail.test.js` (mjs 3/1 · rc 0/1/3 → epoch+son_sonuc · rc 3'te fallback yok). Önceki: `geplant` |

### O-186 — KI günlük raporu günü hiç kapatmıyor: günün son jeton yenilemesinden sonraki kullanım merkeze hiç bildirilmiyor ✅ **gelöst (`11c539e5`)**

| Alan | İçerik |
|---|---|
| **Ne** | Kutunun raporu her zaman **o anki** UTC gününü sayar ve yalnız jeton yenilemesine binerek gider; önceki günün son hâli hiçbir zaman gönderilmez |
| **Nerede** | `api-backend/ai/audit.js:119-123` (`windowStart` = `currentDate`'in UTC günü, supplier çağrıldığı an) · `api-backend/ai/ki-jeton.js:280-287` (supplier yalnız `performRefresh` içinde, `pendingReport` boşken çağrılıyor) · `reportUsage` (`ki-jeton.js:459`) için üretim kodunda çağıran yok (grep: yalnız test) |
| **Tip** | **H** (KI sayacı) + **G** (merkez rapor defteri) |
| **Kutuda ne olur** | Jeton ömrü 60–90 dk. D gününün son raporu D'deki son yenilemenin anındaki toplamdır; o jetonla gece yarısına (UTC) kadar yapılan çağrılar D'ye hiç yazılmaz, D+1'in ilk yenilemesi zaten D+1 penceresini sayar. **Beklemek çözmez** — D+2'de de D'nin son hâli gelmez. Kutu başına günde en çok bir jeton ömrü kadar kullanım sistematik olarak eksik kalır. Yoğun kutuda bu %10'u rahat aşar → O-169 şart 7'nin otomatik kapatması her gece yanlış alarmla `ki_global=aus` yapar (fail-closed ama kör: ürün KI'sız kalır) ya da eşik gevşetilip körleşir. Hasta verisi yok (yalnız sayaç), G1'e değmez |
| **Çözüm** | Kutu tarafı küçük iş: supplier, son **onaylanan** raporun `windowStart`'ı bugünden eskiyse önce o günün **kapanış** raporunu üretir (aynı `reportId`, aynı pencere, monoton büyüme — O-183'ün `'aktualisiert'` yolu bunu zaten kabul eder, sözleşme değişmez), ack gelince bugünün raporuna geçer. Kalıcılık: son onaylanan pencere bellekte yeterli; restart'ta kaybolursa en kötü ihtimal tek gün eksik kapanır (bilinen sınır, yazılsın). Test: 23:30Z'de rapor + 23:50Z'de çağrı + 00:10Z'de yenileme → merkezde D satırı 23:50 çağrısını içerir. ~~Bu kapanmadan O-169 şart 7 yalnız raporlar, kapatmaz~~ → 10.10.2026: kapandı, `ki-abgleich --abschalten` artık **kod açısından** serbest. Gece timer'ı yine T23 + ORG tarafı (O-169 (4)/(5)) sonrası kurulur |
| **Durum** | ✅ `gelöst` — `11c539e5` (10.10.2026, Hat K). Beş şartın beşi: (1) sınır `jetzt − windowStart < 2*86_400_000` (merkezin kabul sınırı), D+2 00:10'da D raporu gönderilmiyor, sözleşme testli · (2) ret sonrası da bugüne geçiliyor, testli · (3) kapanış raporu aynı `reportId`/`windowStart` (O-183 `aktualisiert` yolu), testte karşılaştırılıyor · (4) rapor aynı jeton isteğine biniyor, yenileme bloklanmıyor · (5) **bilinen kalıntı:** son bildirilen gün yalnız RAM'de (`sonBildirterTagMs`) — gece yarısından sonraki ilk yenilemeden önce restart olursa önceki günün kuyruğu kaybolur; tek gün, ki-abgleich toleransı içinde kalmazsa o gece yanlış alarm olabilir. Kod: `api-backend/ai/ki-jeton.js` (`performRefresh`, `abschlussLaeuft`, `handleReportOutcome`) · `api-backend/ai/audit.js` `makeUsageAggregateSupplier(at)`. Test: `merkez/test/ki-jeton-vertrag.test.js` iki O-186 testi (düzeltmesiz kırmızı) + `api-backend/ai/audit.test.js` `at` testi; merkez 107/107. Önceki: `geplant` |

**(2) Fatura snapshot (v) sunucu tarafı — GEÇER.** `billing/api/abrechnung.routes.js` (ZU-/RE- PDF), `ausfall.routes.js`, `mahnwesen.routes.js` aussteller bloğunu `api-backend/lib/rechnung-snapshot.js` `ausstellerSnapshot`'tan kuruyor. Bu saf render: lib yerel, import/env/dış çağrı yok (`rechnung-snapshot.js:18`), üç route'ta sabit host yok (grep). Şema yok, image ile gider, iki dağıtımda aynı kod. Kutu dışı bir not (G1 değil, tutarlılık): faturanın `invoices.aussteller_snapshot`'ı varsa sunucu PDF'i **onu** kullanmalı, canlı profili değil. Yoksa kilitli fatura ile yeniden basılan PDF birbirinden ayrılır. Frontend aynı deseni izliyor (`module/rechnung-ansicht.js:168`). Bu GoBD/`db-ustasi` konusu, kutu vetosu değil.

**(3) `0076` (snapshot NULL ise draft'tan çıkış reddi) — bugün yazılmaz. Hat K'nin okuması doğru, iki düzeltmeyle.** Draft'tan çıkışın **iki** yolu var, tek değil: (a) RPC `rechnung_zahlung_buchen` (`0000_baseline.sql:1721-1723`, `status='paid'`). Tek transaction; trigger reddederse defter satırı da geri alınır, temiz. (b) **İstemci UPDATE** `module/rechnung-zahlung.js:69-74` (`markiereRechnungBezahlt`, Zuzahlung yolu). Kassieren beleği **önce** ayrı yazılıyor, sonra bu UPDATE geliyor ve hata kontrolü yok. 0076 burada reddederse kasa beleği var, fatura draft'ta kalır, kullanıcı hiçbir şey görmez: sessiz yarım durum. Ayrıca `invoice_festschreibung()` kilidi `current_user IN ('authenticated','anon')` ile sınırlı (0075 `:46`). 0076'nın kuralı RPC/service_role yolunu da kapsayacaksa bu koşula bağlanmamalı. **`:beta`/`:stable` açısından:** kutuda ön yüz ve şema aynı sürümden gelir. Ama `:stable` 0075 öncesi koddaysa (snapshot yazmayan `saveInvoice`), 0076 o kanalda **bütün yeni faturaları** ödenemez yapar. Bu, zincir kuralının yasakladığı "migration eski image'ı bozuyor" durumudur. **Şartlar (sıra bağlayıcı):** (i) snapshot yazan kod (0075 + `module/rechnung-snapshot.js` + sunucu (v)) **`:stable`'a çıkmış** olmalı; `:beta`'da olması yetmez. (ii) Backfill migration'ı: 0075 öncesi draft'lara snapshot doldurulur (draft olduğu için kilit yok; SQL karşılığı mı, açılışta tek seferlik betik mi, `db-ustasi` seçer). Draft olmayanlar NULL kalır (Altbeleg, zaten kilitli, kural onlara dokunmaz). (iii) `markiereRechnungBezahlt` UPDATE hatasını kontrol etsin (0076'dan bağımsız olarak da doğru). (iv) 0076 ayrı numara, (i)+(ii) sonrası. Bugün sahada müşteri kutusu yok, pratik risk SaaS + WSL. Kural yine de kanal sırasına göre uygulanır. Madde açılmadı; şartlar 0076 ön kontrolünde (önce sor) yeniden kontrol edilir.

## 9. Durum özeti (son sayım: 08.10.2026, K2b.10)

> ⚠️ **Bu tablo 12.09.2026 akşamı madde madde yeniden sayıldı.** Önceki hâli
> 04.09.2026 fotoğrafıydı ve altına "fark" notları yığılıyordu — dokuz tur sonra o
> yöntem çöktü: tablo O-48/O-49'u hâlâ `offen`, O-25/O-38'i hâlâ `geplant`
> gösteriyordu, oysa dördü de kapanmıştı. **Kural değişti:** bundan sonra tablonun
> kendisi güncellenir; tarihsel fark notları altında **kayıt olarak** durur
> (silinmezler — "o gün neredeydik" sorusunun cevabı onlar).

> **29.09.2026:** O-134…O-137 (§7T, STACKIT "anahtar bizden" ön kontrolü) eklendi → 21 + 18 + 22 + 63 + 13 = **137**, en yüksek numara **O-137**. Uyuşuyor. (Aşağıdaki "132" cümlesi 21.09 fotoğrafıdır; O-133 sonradan eklenmişti.)

**Toplam 132 madde** (O-01 … O-132) — son üçü (**O-130…O-132**, §7S) 21.09.2026'da, §302 planının **Adım 1.3**'ünün (ITSG Trust-Anchor zinciri + `/upload-signed` şifrelemesi) **push'tan önce** yapılan denetiminden çıktı: biri merkezdeki besleme zincirinin 06.01.2027'de sessizce ölmesi (**O-130** — runtime'da düzeltilen hatanın ikizi CI'da duruyor), biri üretilen şifreli dosyanın hiçbir yerden ulaşılamaması (**O-131**), biri de alıcı sertifikasının kutuya hiç varmaması (**O-132**, O-116'nın çözülmeyen yarısı). Aynı tur **O-116**'yı 🟠 → 🟡 taşıdı. Ondan önceki dördü (**O-126…O-129**, §7R) 20.09.2026
**gecesi**, §302 Faz 1'in ikinci yarısının (`0031`–`0037` + güvenlik düzeltmesi `0035`)
kutu denetiminden çıktı: biri seed üretim yolunun yazısız kalan kanıt kuralı (**O-126**),
biri şimdiden konan bir G1 kısıtı (**O-127**: `verwerfungsgrund`/`fehlertext` kutudan bize
gelen hiçbir pakete girmez), biri sessizce büyüyen paketleme borcu (**O-128**: seed
migration'ları her çeyrekte bir tam kopya daha ekliyor), biri de iki hafta önce konup
sessizce geri açılmış bir disiplin (**O-129**). Aynı tur **dört maddeyi kapattı**
(O-114 · O-117 · O-122 · O-124) ve ikisini ilerletti (O-118 · O-125 → 🟡).
Ondan önceki beşi (**O-121…O-125**, §7Q) aynı gün akşamı,
§302 Faz 1'in beş migration'ı **canlıya uygulanmadan önce** yapılan kutu denetiminden çıktı:
biri sert şart (**O-122**, sayaç `ON DELETE CASCADE` ile silinebiliyor), biri O-115'in
kalan yarısı (**O-123**), biri SaaS'a özgü sıra riski (**O-121**), biri `gkv-302`'ye
soru (**O-124**), biri de henüz yazılmamış üç migration'ın ön kontrolü (**O-125**).
Aynı tur üç eski maddeyi ilerletti: **O-114**, **O-115**, **O-117** → 🟡 `kısmen`.
Ondan önceki dokuz madde (**O-112…O-120**, §7P) aynı gün
açıldı: 19–20.09 §302 turunun **geriye dönük** kutu denetimi (tetikleyici işlemedi, ajan
çağrılmadı) + `ABRECHNUNG_ECHTBETRIEB_PLAN.md`'nin adım adım ön kontrolü. Ondan önceki
(**O-111**, §7O) 18.09.2026 konsey
turundan çıktı: on-prem'de çoklu-kiracı deseninin (`owner_id`/`business_id`/RLS)
sadeleştirilmesi **reddedildi** (karar A), `unkritisch` kapandı; aynı tur "baseline henüz
dondurulmadı" öncülünü de çürüttü. Beşi (O-85…O-89) 12.09.2026 gecesi `restore.sh`'ın
bildirim-sonrası denetiminden çıktı, §7L; aynı gece üçü (O-85/O-86/O-89) tam, ikisi
(O-87/O-88) kısmen kapatıldı — detay kendi maddelerinde. Beş yenisi daha (O-90…O-94)
aynı akşam Faz 2.2 dilim 2b'nin kendi post-hoc denetiminden çıktı — üçü (O-90/O-92/
O-93) aynı turda kapatıldı, ikisi (O-91/O-94) Faz 2.4'e bırakıldı. İki yenisi daha
(O-95/O-96) 13.09.2026'da O-79'un kazısından çıktı — ikisi de **aynı gün kapandı**
(O-96: `gkv-302` doğruladı, `heilmittel_tarif`'in Physio §302 fiyatını sessizce
ezme riski koddan tamamen kaldırıldı; O-95: CI'nın otomatik commit'ine seed-migration
üretimi eklendi). ⚠️ Bu paragrafın önceki hâli O-95'i hâlâ `offen` gösteriyordu —
tablo (aşağıda) hep doğruydu, yalnız düzyazı bayattı; 13.09.2026 gecesi bir ikinci-göz
turu (kullanıcı isteğiyle, dört ajan paralel — `onprem`/`gkv-302`/`db-ustasi`/`guvenlik`)
bunu ve dört yeni maddeyi (O-97…O-100) birden buldu:
- **O-97** — §302 fiyatı 4 basılı belge yolunda `rx.ausstellungsdatum`'a göre değil
  `Leistungsdatum`'a göre çözülmeliydi (DTA yolu zaten doğruydu); aynı gün düzeltildi.
- **O-98** — `preise-check.yml`'in CI-commit'i ile bir insanın migration commit'i aynı
  numarayı seçebilirdi (rebase, numara hesaplamasından SONRA geliyordu); iş akışı
  yeniden sıralandı + retry döngüsü eklendi, aynı gün düzeltildi.
- **O-99** — CI botunun `contents: write` yetkisi TÜM adımlara (dolayısıyla `npm ci`'nin
  çalıştırdığı bağımlılık kodu dahil) yayılıyordu; iş iki job'a bölündü (yazma yetkisi
  yalnız `npm ci` çalıştırmayan job'da), + `preise_autoupdate.mjs`'e tarih-format ve
  %15 preis-sıçraması emniyet supapları eklendi, aynı gün düzeltildi.
- **O-100** — `.praxura-stand/` (owner e-postası + `.env` anlık görüntüleri, sırlar dahil)
  umask'tan `0755` miras alıyordu; `backup.sh`'ın kendi `chmod 700` standardı buraya
  uygulanmamıştı; aynı gün düzeltildi.

✅ **14.09.2026 — ÜÇÜNCÜ tur, kullanıcı isteğiyle:** yukarıdaki 12 maddenin TAMAMI (O-09a,
O-79, O-96, O-82, O-44, O-33, O-80, O-95, O-97, O-98, O-99, O-100) yedi üye paralel (dört
alan uzmanı + üç daimi: `muhalif`/`deger-mi`/`fonksiyon-ustasi`) bir konsey turunda tekrar
gerçek koda karşı denetlendi — "yaptıklarımızda gözden kaçan var mı, yapılması gerekip
yapılmamış bir şey var mı". Sonuç: 12 madde doğrulandı, ama tur DÖRT yeni ve gerçek sorun
buldu (**O-101…O-104**, hepsi aynı gece kapatıldı):
- **O-101** — `gkv-302` + `fonksiyon-ustasi`: Zuzahlungskennzeichen ters yazılıyordu
  (Anlage 3 §8.1.3: `0`≠pflichtig, doğrusu `3`), DTA'da U18 muafiyeti hiç yoktu (yalnız
  basılı yollarda), `behandlungsende` referans tarihi sıralanmamış diziden alınıyordu.
  5 bağımsız kod kopyası + 2 golden-test dosyası düzeltildi.
- **O-102** — `muhalif` + `onprem` bağımsızca aynı bulguya vardı: CI botunun
  `GITHUB_TOKEN` ile push'u `publish-calendar-api.yml`'i **hiç tetiklemiyordu** (GitHub'ın
  döngü-önleme kuralı) — otomatik fiyat güncellemesi main'e iniyordu ama asla image'a/
  canlıya çıkmamış olabilirdi, sistem "live ausgerollt" diye yanlış rapor veriyordu.
  Açık `gh workflow run` dispatch'i eklendi.
- **O-103** — `guvenlik`'in S-28 bulgusu: O-99'un iki-job bölünmesi tamamlanmamıştı,
  yazma-yetkili job hâlâ npm-ortamında üretilmiş bir dosyayı import ediyordu. SQL üretimi
  salt-okunur job'a taşındı.
- **O-104** — `onprem`: O-100'ün chmod'u yalnız ileriye dönük çalışıyordu, eski `.praxura-
  stand` anlık görüntüleri 0755 kalıyordu. `chmod -R go-rwx`'e çevrildi, her `update.sh`
  koşusunda geriye dönük düzeltiyor.

Ayrıca üç küçük dokümantasyon düzeltmesi (kod değişikliği değil): `db-ustasi` SaaS'a elle
uygulanan migration'ların hiçbir yere iz bırakmadığını buldu (`migrations/README.md`'ye
disiplin notu eklendi, 0015'in başlığına "SaaS: uygulandı" satırı düşüldü); `db/REGISTER.md`
`heilmittel_tarif` girdisindeki "Podologie Preisquelle = heilmittel_katalog" iddiası
düzeltildi (doğrusu `podologie_positions.js`); `erwartete-zaehler.json`'ın `_kommentar`'ı
belirli bir migration numarasına ("0015") sabitliydi, versiyon-bağımsız hale getirildi.

⚠️ O-53 ve O-54'ün kendi `###` girdisi yok; O-01'in not bloğunda yaşıyorlar —
kaybolmaya açıklar, ileride kendi girdilerine terfi etmeliler.

| Durum | Adet | Maddeler |
|---|---|---|
| `offen` | 19 | **O-189** (10.10.2026) · O-18 · O-23 · O-32 · O-46 · O-75 · O-108 · O-110 · O-113 · O-119 · O-127 · O-128 · O-132 · O-156 · O-158 · **O-166** · **O-168** · **O-170** (06.10.2026) · **O-174** |
| `geplant` | 20 | O-07 · O-08 · O-10 · O-13 · O-19 · O-21 · O-27 · O-28 · O-31 · O-43 · O-91 · O-94 · O-121 · O-135 · O-138 · O-139 · O-141 · O-145 · **O-159** · **O-169** (K-20) |
| 🟡 `kısmen gelöst` | 37 | **O-187** (`40491962` + `ac1504d0`, kalan promote 13.10) · O-01 · O-02 · O-11 · O-30 · O-33 · O-40 · O-42 · O-45 · O-51 · O-55 · O-58 · O-61 · O-82 · O-87 · O-88 · O-115 · O-116 · O-118 · O-120 · O-125 · O-126 · **O-123** · **O-142** · **O-144** · **O-151** · **O-155** (T13) · **O-157** + **O-176** (T17) · **O-161** (izleme + T7/T8/T15) · **O-162** (T16) · **O-163** (T17 b) · **O-172** (`6aac145c`, kalan şart i) · **O-177** (`45268912`, kalan T19) · **O-178** (K2b.16 kodu, 08.10 gece; kalan T21 + K2b.15) · **O-181** (S-56/S-57, kalan businesses sayaçları + T25 kutu ölçümü) · **O-183** (`01c99769`, deploy bekliyor) |
| `gelöst` | 95 | O-06 · O-15 · O-16 · O-20 · O-25 · O-26 · O-29 · O-36 · O-38 · O-39 · O-41 · O-44 · O-47 · O-48 · O-49 · O-50 · O-52 · O-53 · O-56 · O-57 · O-59 · O-60 · O-62 · O-63 · O-64 · O-65 · O-66 · O-67 · O-68 · O-69 · O-70 · O-71 · O-72 · O-73 · O-74 · O-76 · O-77 · O-78 · O-79 · O-80 · O-81 · O-83 · O-84 · O-85 · O-86 · O-89 · O-90 · O-92 · O-93 · O-95 · O-96 · O-97 · O-98 · O-99 · O-100 · O-101 · O-102 · O-103 · O-104 · O-105 · O-106 · O-109 · O-114 · O-117 · O-122 · O-124 · O-130 · O-131 · O-133 · O-140 · O-143 · **O-03** · **O-09** · **O-107** · **O-129** · **O-136** · **O-147** · **O-148** · **O-149** · **O-150** · **O-152** · **O-153** · **O-154** · **O-160** · **O-171** (`004fc537`) · **O-173** (`1736768f`) · **O-164** (`293ac5be`) · **O-165** (K2b.10, 08.10) · **O-180** (08.10) · **O-179** (`d1a0bf70`, 09.10) · **O-146** + **O-182** (`b1ce69bb`, 09.10) · **O-175** (`63abe5f1`, T14 09.10) · **O-185** (`045b70cb`, 09.10) · **O-186** (`11c539e5`, 10.10) |
| `unkritisch` | 15 | **O-188** (10.10.2026) · O-04 · O-05 · O-12 · O-14 · O-17 · O-22 · O-24 · O-34 · O-35 · O-37 · O-54 · O-111 · O-112 · **O-184** |
| `widerlegt` | 3 | **O-134** · **O-137** · **O-167** (05.10.2026, K-20) |

> ✅ **10.10.2026 14:30 sonrası (promote kapısı bildirimi, §7AN):** yeni O-189 `offen`; O-187 `kısmen gelöst` kalıyor (kapanış şartı değişmedi). 19 + 20 + 37 + 95 + 15 + 3 = **189**, en yüksek **O-189**. Uyuşuyor.

> ✅ **10.10.2026 13:40 sonrası (0.5.2 + sabitleme bildirimi, §7AM):** O-187 `offen`→`kısmen gelöst`, yeni O-188 `unkritisch`. 18 + 20 + 37 + 95 + 15 + 3 = **188**, en yüksek **O-188**. Uyuşuyor.

> ✅ **10.10.2026 öğleden sonra (0.5.0 yayın + soak bildirimi, §7AL):** O-187 yeni, `offen` (karar Kemal'de). 19 + 20 + 36 + 95 + 14 + 3 = **187**, en yüksek **O-187**. Uyuşuyor.

> ✅ **10.10.2026 (`11c539e5` O-186 bildirimi):** O-186 yeni → `gelöst`; ayrıca O-185 tabloda `geplant` kalmıştı, gövdesi `045b70cb` ile `gelöst` — düzeltildi. 18 + 20 + 36 + 95 + 14 + 3 = **186**, en yüksek **O-186**. Uyuşuyor.

> ✅ **09.10.2026 gece (T14 bildirimi, §7AI):** O-175 `geplant`→`gelöst`, yeni O-185 `geplant`. 18 + 21 + 36 + 93 + 14 + 3 = **185**, en yüksek **O-185**. Uyuşuyor.

> ✅ **09.10.2026 gece (`1eee64f0` WSL kutu bildirimi):** O-184 yeni, `unkritisch`. O-181 🟡 kalır (kalan daraldı). 18 + 21 + 36 + 92 + 14 + 3 = **184**, en yüksek **O-184**. Uyuşuyor.

> ✅ **09.10.2026 gece (`01c99769` O-183 bildirimi):** O-183 `offen` → 🟡 (kalan: merkez VPS deploy). 18 + 21 + 36 + 92 + 13 + 3 = **183**, en yüksek **O-183**. Uyuşuyor.

> ✅ **09.10.2026 gece (`faccf4b9` M4.11 bildirimi):** O-183 yeni, `offen`. O-169 `geplant` kalır (M4.11 kalemi kapandı, §7AH). 19 + 21 + 35 + 92 + 13 + 3 = **183**, en yüksek **O-183**. Uyuşuyor.

> ✅ **09.10.2026 akşam (T20/T22/0074 bildirimi):** O-179 🟡 → `gelöst`. 19 + 21 + 35 + 90 + 13 + 3 = **181**, en yüksek **O-181**. Uyuşuyor.

> ✅ **09.10.2026 (S-56 / 0072 bildirimi):** O-181 yeni, 🟡. 19 + 21 + 36 + 89 + 13 + 3 = **181**, en yüksek **O-181**. Uyuşuyor.

> ✅ **08.10.2026 (`45268912` bildirimi):** O-177 `geplant` → 🟡. 19 + 21 + 33 + 88 + 13 + 3 = **177**, en yüksek **O-177**. Uyuşuyor.

> ✅ **08.10.2026 (`6aac145c` bildirimi):** O-172 `geplant` → 🟡; O-177 → K2b.19. 19 + 22 + 32 + 88 + 13 + 3 = **177**, en yüksek **O-177**. Uyuşuyor.

> ✅ **08.10.2026 (O-172 HSTS + S-43 ön kontrol):** yeni O-177 `geplant` → 19 + 23 + 31 + 88 + 13 + 3 = **177**, en yüksek **O-177**. Uyuşuyor.

> ✅ **08.10.2026 gece (O-178 uygulama denetimi):** O-178 `geplant` → 🟡. 19 + 21 + 35 + 89 + 13 + 3 = **180**, en yüksek **O-180**. Uyuşuyor.

> ✅ **08.10.2026 gece (O-179 Faz 1):** 19 + 22 + 34 + 89 + 13 + 3 = **180**.

> ✅ **08.10.2026 gece (O-178–O-180):** 20 + 22 + 33 + 89 + 13 + 3 = **180**, en yüksek **O-180**. Uyuşuyor.

> ✅ **08.10.2026 akşam (K2b.10 commit):** O-165 `kısmen gelöst` → `gelöst` → 19 + 22 + 31 + 88 + 13 + 3 = **176**.

> ✅ **08.10.2026 (K2b.10, sicil turu) — yeniden toplandı:** 19 + 22 + 32 + 87 + 13 + 3 = **176**, en yüksek **O-176**. Uyuşuyor. O-176 (08.10 ön kontrol) tabloya hiç girmemişti, eklendi. `geplant`→🟡: O-155 · O-157 · O-161 · O-162 · O-163 · O-165 · O-176 — hepsinde kod/belge commit'li, kalan iş KHS §5b Kemal testleri (T7/T8/T13/T15/T16/T17) ya da tek belge düzeltmesi; her maddenin kalanı başlığında yazılı. `geplant`→✅: O-164. Ders: 07.10 notları tabloyu 175'te bırakmıştı, O-176 açılışında tablo tazelenmedi — madde açan tur tabloyu da sayar.

> ✅ **07.10.2026 (K2b.18 d ön kontrol) — yeniden toplandı:** 19 + 29 + 25 + 86 + 13 + 3 = **175**, en yüksek **O-175**. Uyuşuyor. O-175 `offen`→`geplant` (karar Durum hücresinde).

> ✅ **07.10.2026 (O-173 commit `1736768f`) — yeniden toplandı:** 20 + 28 + 25 + 86 + 13 + 3 = **175**, en yüksek **O-175**. Uyuşuyor. O-173 `geplant`→`gelöst`.

> ✅ **07.10.2026 (K2b.18 O-173 uygulama bildirimi) — yeniden toplandı:** 20 + 29 + 25 + 85 + 13 + 3 = **175**, en yüksek **O-175**. Uyuşuyor. O-173 `offen`→`geplant` (kod yazıldı, commit bekliyor). Yeni: O-175 (şifrelemeden önceki kutu güncellemeyle kurtulamaz, geri alma eski `install.sh`'ı geri koyar).

> ✅ **07.10.2026 (K2b.8 kısım 2 ön sorusu) — yeniden toplandı:** 20 + 28 + 25 + 85 + 13 + 3 = **174**, en yüksek **O-174**. Uyuşuyor. Yeni: O-173 (Hetzner yedeği şifresiz — kılavuz tek başına S-50 şart 5'i karşılayamaz), O-174 (imajlar yalnız amd64, mimari ön kontrolü yok; CX23 disk kontrolüne takılır).

> ✅ **06.10.2026 (K2b.4 commit `004fc537` / L10 `ec37573a`) — yeniden toplandı:** O-171 `geplant`→`gelöst`. 18 + 28 + 25 + 85 + 13 + 3 = **172**, en yüksek **O-172**. Uyuşuyor.

> ✅ **06.10.2026 (K2b.4 ön kontrol) — yeniden toplandı:** 18 + 29 + 25 + 84 + 13 + 3 = **172**, en yüksek madde numarası **O-172**. Uyuşuyor. Yeni: O-171 (acmedns.json yoksa Caddy açılmaz), O-172 (merkez bağımlı yenileme + HSTS = kilit), ikisi `geplant` K2b.4. O-161'e K2b.4 ön kontrol notu (10 şart) eklendi.

> ✅ **06.10.2026 (K2b.5b) — sayılar değişmedi:** 169 madde. O-161 ve O-163 `geplant` kaldı (kod var, commit + gerçek kutu doğrulaması açık); ayrıntı iki maddenin Durum hücresinde.

> ✅ **05.10.2026 akşam (K-20) — yeniden toplandı:** 17 + 27 + 25 + 84 + 13 + 3 = **169**, en yüksek madde numarası **O-169**. Uyuşuyor. O-134/O-137/O-167 `offen`→`widerlegt` (STACKIT düştü, relay reddedildi; şartlar O-169'a devredildi). Yeni: O-169 (§7AC, dosya sonu). O-161'e tek kutu kimliği bağı eklendi.

> ✅ **05.10.2026 öğle (K-19 / K2b.15) — yeniden toplandı:** 20 + 26 + 25 + 84 + 13 = **168**, en yüksek madde numarası **O-168**. Uyuşuyor. O-157 `offen`→`geplant` (K2b.14). Yeni: O-166/O-167/O-168 (§3b merkezi servis, konsey turu — dosya sonundaki §7AA). O-22/O-155/O-165 durum notu: §7AB.

> ✅ **05.10.2026 (K-18 / K2b) — yeniden toplandı:** 18 + 25 + 25 + 84 + 13 = **165**, en yüksek madde numarası **O-165**. Uyuşuyor. O-159 (`geplant`) ve O-160 (`gelöst`) tabloya hiç girmemişti, eklendi. O-155 `offen`→`geplant` (K2b; yalnız yarısı — hasta linki LAN kutusunda hâlâ açılmaz). Yeni: O-161…O-165 (K-18'in açtığı merkez zinciri, internetsiz ad çözümü, Windows hairpin, şifresiz autostart, playbook sapması). Detay §7Z.

> ✅ **02.10.2026 akşamı (KHS K2 kapanışı) — yeniden toplandı:** 19 + 18 + 25 + 83 + 13 = **158**, en yüksek madde numarası **O-158**. Uyuşuyor. 12 madde kapandı, 4'ü 🟡'ye geçti (O-123/O-142/O-144/O-151), üç yeni madde `offen` (O-156 bot satırı · O-157 paket kaynağı · O-158 WSL disk kapısı). Detay §7X.

> ✅ **20.09.2026 gecesi — toplam satır satır toplandı (12.09'un dersi uygulandı):**
> 16 + 17 + 21 + 62 + 13 = **129**, ve en yüksek madde numarası **O-129**. Uyuşuyor.
>
> ✅ **21.09.2026 — yeniden toplandı:** 19 + 16 + 22 + 62 + 13 = **132**, en yüksek madde
> numarası **O-132**. Uyuşuyor. (O-116 `geplant`→🟡 taşındı, üç yeni madde `offen` açıldı.)
>
> ✅ **02.10.2026 (KHS K2 ön kontrolü) — yeniden toplandı:** 17 + 32 + 22 + 71 + 13 = **155**, en yüksek madde numarası **O-155**. Uyuşuyor. Altı madde kapalıydı ama tabloda açık duruyordu — her biri koda karşı doğrulanıp taşındı: O-06 (`1935d73`) · O-105 + O-106 (`5fbfd81`) · O-130 (`7472fe2`) · O-133 (22.09) · O-140 (`1f1ef45`/`853ea99`). O-107 · O-123 · O-129 `offen`→`geplant` (KHS K2.4/K2.10). Yeni: O-147…O-153 (01.10 denetiminin Y1–Y7'si, `geplant`), O-154/O-155 (`offen`).
>
> ✅ **02.10.2026 — yeniden toplandı:** 21 + 24 + 22 + 64 + 13 = **144**, en yüksek madde
> numarası **O-144**. Uyuşuyor. (O-138…O-143 tabloya hiç girmemişti — eklendi; O-144 yeni.)
>
> ✅ **22.09.2026 — yeniden toplandı:** 19 + 16 + 22 + 63 + 13 = **133**, en yüksek madde
> numarası **O-133**. Uyuşuyor. (O-131 `offen`→✅ `gelöst` taşındı, O-133 `offen` açıldı —
> `offen` satırının adedi bu yüzden 19'da kaldı, içindekiler değişti.)
>
> ⚠️ **20.09.2026 — tabloda bir madde eksikti:** **O-106** (kutudaki „Abonnement
> verwalten"/„Upgrade" butonları SaaS kayıt akışına götürüyor, 14.09.2026'da açıldı)
> hiçbir satırda geçmiyordu; toplam 111 diyordu ama satırların toplamı 110 çıkıyordu.
> `offen` satırına eklendi. Ders, 12.09'un dersinin aynısı: **tablo da sayılmadan
> doğru sayılmaz** — bundan sonra her tur toplamı satır satır toplanarak doğrulanır.

> ✅ **O-26 artık TAM kapalı (12.09.2026)** — `restore.sh` yazıldı ve gerçek kutuda
> doğrulandı (kendi maddesindeki kapanış notuna bak). Kalan tek gerçek boşluk:
> SSH/rsync hedef sürücüsü (yalnız dizin/mount destekleniyor), kendi O-numarasını
> bekliyor — henüz açılmadı.
>
> ✅ **O-26 `gelöst` kalıyor ve yolun dayanıklılığı da aynı gece büyük ölçüde
> kapandı (O-85…O-89, §7L).** Beş maddeden en kritiği **O-85** (yapılamayan
> parmak-izi kontrolünün "uyuşuyor" yazması) **gelöst** — üç kontrol de artık
> künyede-parmak-izi-yok / güncel-hesaplanamadı / uyuşmuyor hâllerini ayırt
> ediyor, hiçbiri "uyuşuyor" yazmıyor, gerçek kutuda hem `api` durdurulmuşken
> hem DEK tamamen boşken test edildi. **O-86** (internetsiz kutuda restore'un
> hiç başlamaması) ve **O-89** (yarıda kalırsa kılavuzsuz kalma) de **gelöst**.
> Kalan iki madde (**O-87** DB-seviyesi ayarların genel taşınması · **O-88**
> ikinci/üçüncü kopyanın kaldırılması + eski artıkların uyarılması) yalnız
> **kısmen** — acil kısımları (JWT doğrulama sert DUR, disk-yeri kapısı)
> kapandı, genel çözümleri henüz değil.
>
> ⚠️ **O-77 `gelöst` yazıyor ama dar kapsamlı** (yalnız migration-öncesi tek bir DB
> dump'ı) — geniş yedekleme O-26'da (artık tam kapalı) çözüldü. O-77'nin kendi
> maddesine bak.
>
> 🟡 **O-09 ikiye bölündü (12.09.2026), toplam sayı değişmedi.** İlk kaydı Apify
> (bizim token'ımız, B2B lead-gen) ile `B2B_AGENT_URL` (n8n mail-agent) tek
> maddede toplamıştı — ikisi bağımsız özellikler. **(a) Apify/Google-Maps ✅
> gelöst**: `module/lead-suche.js` + `IST_KUTU` ile hem UI hem `server.js:675`
> route'u kutuda kapatıldı, "Ärzte → Register" (manuel Zuweiser kaydı) etkilenmedi.
> **(b) B2B_AGENT_URL offen kaldı** — kullanıcı talimatıyla n8n'e dokunulmadı, ama
> kazı sırasında ciddi bir bulgu çıktı: kutu hâlâ müşterinin Zuweiser CRM verisini
> yetkisiz şekilde bizim n8n webhook'umuza POST'luyor (`dashboard.js:12004`) — bu
> on-prem'in "praxis verisi bize akmaz" sözünün tam tersi. Ucuz bir ara-adım
> (aynı `IST_KUTU` deseniyle `.ai-chat-card`'ı kutudan kaldırmak, n8n workflow'una
> dokunmadan) biliniyor ama bilinçli olarak uygulanmadı — n8n kararı bekliyor.

> **Nasıl okunur — 31 `gelöst` yanıltıcıdır.** Bunların büyük bölümü (O-56 … O-76
> aralığı) **paketleme** işiydi: 11-12.09'da açıldılar ve aynı hafta kapandılar, yani
> hiçbir zaman uzun süreli borç olmadılar. Asıl borç `geplant` 16 + `offen` 12'de:
> orada **Faz 1.x** (merkezden kopma — O-02/O-03/O-09/O-10/O-16/O-21) ve **Faz 3.x**
> (lisans/yetki — O-31/O-32/O-33/O-46) hâlâ **hiç dokunulmamış** duruyor.
> Özetle: kutu artık **kuruluyor**, ama hâlâ **SaaS'ın varsayımlarıyla** çalışıyor.
>
> ⚠️ Bu paragraf artık eski sayılara dayanıyor (yazıldığı an 31/16/12'ydi, bugün
> 44/15/10) — düzeltilmeden bırakıldı çünkü kapsamı bu turun dışında, ama O-09
> özelinde yanıltıcı: **(a) Apify artık dokunuldu ve kapandı**, yalnız **(b)
> (n8n) hâlâ hiç dokunulmadı** — yukarıdaki O-09 notuna bak.

<details>
<summary><b>Tarihsel kayıt — 04.09.2026 ilk taraması ve sonraki fark notları (silinmez)</b></summary>

**İlk tarama tablosu (2026-09-04):**

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

</details>

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

### O-159 — SaaS VPS disk doldu (03-04.10.2026): yedek betiği n8n binaryData'yı 8 gün tutuyordu, alarm yok 🟡 **geplant (Ops kartı)**

| Alan | İçerik |
|---|---|
| **Ne** | Host cron `praxura-backup.sh` `/opt/n8n/n8n_data`'yı (binaryData 2,4 GB dahil) 8 gün tutup 20 GB üretti → disk %100 → calendar-api healthcheck "no space left" → Traefik `/api/*`'i n8n'e düşürdü, API HTML döndü. Repo dışı host düzeltmesi 04.10.2026 (betik yeniden yazıldı: binaryData hariç, 5 gün, eski önce silinir, disk >=%85 ise yedek atlanır; journald 300M). Kaynak: `wissensbank/sitzungen/2026-10-03_live-api-liefert-html-statt-json.md` |
| **Nerede** | SaaS VPS host (repo dışı, `/usr/local/bin/praxura-backup.sh`); kutu tarafı: `onprem/backup.sh:136-141` |
| **Tip** | F (zamanlanmış iş) |
| **Kutuda ne olur** | `backup.sh` yer kontrolünü zaten yapıyor (`df` + 2x(DB+storage) eşiği, `:136-141`) ve BACKUP_ZIEL ayrı mount — o yönden ders uygulanmış. Açık kalan: yedek dışı doluluk (Postgres/log/image) için kutuda sürekli alarm yok; O-158 (WSL'de `df` sanal diski ölçer) bu kapıyı Windows kurulumunda zaten körleştiriyor. Bkz. O-94 (kontroller kurulumdan sonra koşmuyor) — kutu panelinde disk doluluğu eşiği (>=%85 uyarı) orada eklenmeli |
| **Çözüm** | SaaS: Ops kartı „VPS: Alarm bei voller Platte + uptime-kuma reparieren" (Teknik, hoch, Kemal, 04.10.2026 açıldı) · Kutu: Faz 2.4 (O-94 kapsamına disk doluluğu eklenir) |
| **Durum** | `geplant` — Ops kartı 04.10.2026 açıldı (yukarıda); kart kapanınca `gelöst` · host düzeltmesi repo'da yok → `tools/check-vps-drift.sh` kapsamı dışı (yalnız compose'a bakar) |

> **07.10.2026 akşam — merkez VPS (ayrı Hetzner projesi `praxura-merkez`, CX23) açıldı; bu maddenin dersi oraya baştan uygulanır:** journald `SystemMaxUse=300M`, SQLite yedeği yerel + boyut sınırlı, disk eşiği izlemesi. Merkez düşerse kutular adres/sertifika yenileyemez (O-161, O-172) → SaaS VPS'teki bozuk uptime-kuma'ya bağlanmaz, ayrı dış kontrol (Kemal kararı, açık). Durum değişmez: `geplant` (Ops kartı SaaS VPS içindir).

> **07.10.2026 gece:** merkez VPS'te journald 300M uygulandı ✓. Dış izleme Kemal kararıyla ertelendi — açık kalan risk: merkez/disk düşerse alarm yok. Durum değişmez.

### O-160 — VKZ03-Trigger (0058) sahip rolünü adıyla beyaz listeye alıyordu: SaaS'ta `postgres`, kutuda `supabase_admin` → kutuda ZAA/artefakt RPC'leri 42501 ✅ **gelöst (`5f8739a`, 05.10.2026) — kutu doğrulaması açık**

| Alan | İçerik |
|---|---|
| **Ne** | `pruefe_abrechnung_zuzahlungsforderung()` SECURITY INVOKER; `current_user NOT IN ('service_role','postgres')` ile korunuyordu. SECURITY DEFINER RPC'lerden (`artefakt_publish`, `zaa_fehler_anwenden`) çağrıldığında `current_user` fonksiyon sahibidir — SaaS'ta `postgres` (geçer), kutuda `supabase_admin` (reddedilir). Aynı migration iki dağıtımda iki farklı davranış: G7'nin tam tarif ettiği sapma sınıfı |
| **Nerede** | Kaynak: `api-backend/db/migrations/0058_abrechnung_zuzahlungsforderung.sql:137` · düzeltme: `0062_vkz03_trigger_rollenunabhaengig.sql:52` (`IF current_user IN ('authenticated','anon')`, gövde tek koşul dışında aynı, canlı md5 = dosya md5 — commit raporu) · emsal desen: `0053_profiles_privilegierte_spalten.sql:58` · zincirde başka sahip-rolü-adı kontrolü yok (`grep -nE "current_user[^;]{0,60}'(postgres\|supabase_admin)'" migrations/*.sql` → yalnız 0058:137, 0062'de geçersiz kılındı) |
| **Tip** | D (şema) + G (merkez/kutu rol farkı) |
| **Kutuda ne olur** | 0062 öncesi: kutuda ZAA geri bildirimi ve artefakt yayını her seferinde `42501` ile düşerdi; SaaS'ta hiç görünmezdi çünkü orada sahip `postgres`. 0062 sonrası: tarayıcı rolleri (authenticated/anon) bloklanır, sahip rolünün adı ne olursa olsun DEFINER yolu geçer — iki dağıtımda aynı davranış. Yan düzeltmeler aynı commit'te: 0060/0061'de `BEGIN/COMMIT` yok (runner zaten transaction açıyor; iç COMMIT atomikliği kırardı), üç dosyada `-- SaaS:` satırı var, `erwartete-zaehler.json` `bis_version` 0062 → 86/157/95/87/313 (önceki beklenti 84/156/85/84/309 + yerel ölçülen delta +2/+1/+10/+3/+4; yerel taban `spatial_ref_sys` yüzünden kutudan −1 tablo/−1 index, bu yüzden mutlak değil delta taşındı) |
| **Çözüm** | Kod: `5f8739a` (0062). **Kural (sınıf için):** trigger/policy'de sahip rolü **adıyla** beyaz listeye alınmaz (`postgres`/`supabase_admin` dağıtıma göre değişir); bloklanacak tarayıcı rolleri adıyla kara listeye alınır (0053 deseni). Kapı adayı: yukarıdaki grep `tools/check-onprem.sh`'a mekanik kural olarak girebilir (`builder`, düşük öncelik). **Açık kalan iki doğrulama** — sahibi KHS M1 §6 kutu kabulü: (1) taze gerçek kutuda kurulum sonrası Selbstcheck (sayaçlar delta ile türetildi, kutuda ölçülmedi); (2) kutuda ZAA yüklemesi VKZ-03 başlıklı bir Abrechnung'a karşı uçtan uca (42501 gerçekten gitti mi) |
| **Durum** | `gelöst` (kod, `5f8739a`) · iki kutu doğrulaması M1 §6 kabulüne bağlı; o kabulde biri kırmızıysa bu madde yeniden açılır |

---

## 7Z — K-18 kutu erişim modeli: konsey + 05.10 Kemal kararı (05.10.2026)

> Kaynak: `KUTU_HAZIRLIK_SPRINT.md` K-18 + aşama K2b (`ebd0e50`) · `konsey/tutanak/2026-10-04-kutu-erisim-modeli.md` (`9517917`, 05.10 eki dahil). Konsey varsayılanı A idi (praksisin kendi Hetzner hesabı); Kemal 05.10'da bunu **her ortamda tek yöntem** olarak değiştirdi: kurulum kodu → `praxis-XXXX.praxura.de` → LE DNS-01 (kutu başına `acme-dns` delegasyonu) → ad kutunun **iç** IP'sini gösterir. Uzaktan erişim praksisin kendi VPN'i, Hetzner yalnız bir barındırma yeri. **Tünel/relay yok** — bu sicilin G8/G1 itirazı karara girdi (B seçeneği: dış erişim bizim VPS'imize bağlanırdı, hasta trafiği şifreli de olsa bizden geçerdi; Cloudflare Tunnel TLS'i kendinde açtığı için doğrudan G1 ihlali).
>
> Ölçümler (04.10, Kemal, Windows test kutusu): Telekom Speedport Smart 2 iç IP gösteren genel adı engellemiyor (`192-168-2-111.sslip.io`). Kurulum betiği adım 1–11 yönetici olarak geçti (`1127a3d`, `4b9a554`). Bu PC kendi LAN IP'sine bağlanamıyor (mirrored WSL), hosts'a `127.0.0.1` gerekti. Boş Windows şifresinde autostart yalnız oturum açınca.
>
> **Bu modelle kapanan:** S-43 (iç CA'nın özel anahtarı yedekteydi; CA kalkınca yedekte yalnız tek alt adın LE anahtarı kalır) — kapanış `guvenlik` sicilinde, K2b.4. **Değişmeyen:** O-157 (paket kaynağı) erişim modelinden bağımsız, `:stable` terfisinden önce yine çözülmeli.
>
> **Bu sicilin K2b.2/K2b.3 öncesi ön kontrol hakkı:** merkezdeki iki yeni servis (ad servisi + acme-dns) yazılmadan önce bu sicile gelinir (koordinatör 05.10'da teyit etti). Aşağıdaki O-161 o ön kontrolün çerçevesidir.

### O-161 — Kutu, sertifikası ve adresi için merkeze bağlanıyor: ad servisi + `acme-dns` yeni bir dış zincir 🟡 **kısmen gelöst (08.10.2026: merkez canlı, ilk gerçek kutu LE sertifikalı) — kalan: dış izleme (S-46 Bed. 7) + KHS §5b T7/T8/T15**

| Alan | İçerik |
|---|---|
| **Ne** | K-18 ile kutu üç iş için merkezdeki servislere çıkar: (1) kurulumda kurulum kodu → alt ad + kısıtlı kimlik, (2) 60–90 günde bir LE DNS-01 için kendi `_acme-challenge` TXT kaydını `acme-dns`'e yazar, (3) iç IP değişince kendi A kaydını günceller (K2b.6, zamanlanmış iş). Kod henüz yok |
| **Nerede** | Kod (`07fab61`): `merkez/` (server.js, admin.js, cloudflare.js, acmedns.js, db.js, namen.js, ip.js) + kutu istemcisi `api-backend/merkez-istemci/` (kimlik.js, signatur.js, merkez-fetch.js, kayit.js). İlk plan: merkezde ayrı klasör (`merkez/`, `api-backend/`'e değil — kutu da `api-backend` koşturuyor) · kutuda Caddy `caddy-dns/acmedns` modülü (K2b.4) + IP güncelleme işi (K2b.6) |
| **Tip** | A (runtime dış çağrı) + F (IP güncelleme zamanlanmış iş) + G (merkez tarafı servis) |
| **Kutuda ne olur** | Taşınan veri yalnız alt ad, TXT doğrulama dizgisi, iç IP. Hasta verisi yok, G1 temiz (lisans yenileme ile aynı sınıf). **Merkez kapalıyken:** ad çözümü sürer (kayıtlar DNS sağlayıcısında durur, bizim VPS'te değil — K2b.2'de bu şart). Sertifika ≤90 gün geçerli kalır, yenileme tekrar dener. IP değişirse adres merkez dönene kadar kırık kalır. **Biz tamamen ortadan kalkarsak:** ≤90 günde her kutunun sertifikası düşer, alt adlar da bizim zone'da. Bu K9'un ruhuna değiyor (veriye erişim rehin olmamalı) |
| **Çözüm** | K2b.2/K2b.3/K2b.6. Şartlar: (a) merkez adresleri kutuda **env'den** (`ACME_DNS_URL` vb.), koda sabit `praxura.de` girmez — kapı sayacına takılır (tip C) · (b) `praxura.de` zone anahtarı kutuya **asla** (G2) — kutu başına yalnız kendi TXT/A kaydını yazabilen kimlik; bu kimlik kutuda sır sayılır, ayrı dosyada durur, image'a **ve yedeğe** girmez (**05.10.2026 akşam düzeltme:** ilk yazımda "yedeğe girer" diyordu — K2b.17 ile çelişiyordu; yedekten dönüş = yeniden bağlama kodu, aşağıda) · (c) DNS kayıtları bizim VPS'te değil, DNS sağlayıcısında (VPS çökmesi = adres çökmesi olmasın; O-159 dersi) · (d) **çıkış yolu** kılavuzda (K2b.8): praksis kendi alan adını ve kendi DNS-01 sağlayıcısını girebilir, son çare `tls internal`. Çıkış yolu yazılmadan K3'e çıkılmaz |
| **Durum** | `geplant` — **05.10.2026 gece: kod var, dağıtım yok (`07fab61`).** K2b.17 kutu kimliği (`api-backend/merkez-istemci/`: Ed25519, `box.key` 0600 `wx` bayrağıyla — sessiz üzerine yazma yok, değişim `*.neu` üzerinden; imzalı istek `praxura-v1` host+yol+gövde+zaman+nonce) + K2b.2 ad servisi (`merkez/`: öneri 10 dk rezerve, kayıt, IP, CAA, admin yalnız CLI, `iptal` A kaydını bırakır / `adresse-loeschen` ayrı adım, mezar taşı). Ön kontrol (1)-(9) ile **çelişki yok**; doğrulananlar: kutu tarafında sabit host 0 (`MERKEZ_URL`, `https://` zorunlu), Cloudflare jetonu yalnız `merkez/` (Dockerfile build bağlamı `api-backend/`, `merkez/` image'a girmez — G2), CAA `validationmethods=dns-01` + alt ad başına, apex'e yok, TTL 600, `merkez/` `.vercelignore`'da, `merkez-istemci` SaaS'ta hiçbir yerden import edilmiyor (iki dağıtımda da etkisiz, G7 temiz), `check-onprem.sh` OK. **Kalan şartlar (açık):** (i) `merkez/*.sqlite` `.gitignore`'da yok — varsayılan `./merkez.sqlite` yerelde koşturulursa ad↔kutu eşlemesi public repoya girebilir · (ii) `kayit.js` acme-dns kimliğini `api` içinden `ACMEDNS_DIR`'e yazıyor → o volume yalnız kurulumdaki `docker compose run --rm api`'ye bağlanır, kalıcı `api` servisine **değil**; okuyan yalnız `caddy` — tasarım (2) böyle korunur (K2b.5) · (iii) `kimlik` + `acmedns` volume, `MERKEZ_URL`, yedek-dışı testi, Caddy acmedns image'ı, IP timer henüz yok (K2b.4/5/6) · (iv) `merkez/` için dağıtım yolu (image/CI) yok — merkez VPS kararı K3 öncesine ertelendi (Kemal 05.10). Önceki not: K2b.2/K2b.3 kodu yazılmadan önce bu sicilde ön kontrol. **05.10.2026 (K-20) bağı:** kutu kimliği **tek**: K-18 kurulumunda kutuda üretilen Ed25519 anahtar çifti; merkez yalnız açık anahtarı tutar. Ad servisi (A kaydı), Y3 postakutusu çekme (O-166) ve KI jetonu (O-169) **aynı kimliği** kullanır — üç ayrı kutu kimliği icat edilmez. acme-dns'in kendi TXT kimliği teknik zorunluluksa ayrı kalabilir, ama kayıt ve iptal aynı kutu kaydına bağlanır (kutu iptal = hepsi birden kapanır) · **K2b.1 elle denendi ✅ (05.10.2026):** `praxura.de` yetkili DNS'i = **Cloudflare** (`ezra/olga.ns.cloudflare.com`), API var → K2b.2'nin "önce" sorusunun cevabı. Kayıtlar yalnız DNS-only (gri bulut) — 04.10 Cloudflare vetosu TLS sonlandırma/tünel içindi, DNS-only'yi kapsamaz (G1 temiz; legal-de'ye tek cümle bildirildi). Cloudflare API jetonu kayıt bazında kısıtlanamaz, zone geneline yetki verir → jeton yalnız `merkez/`'de, kutuya asla (G2); Cloudflare hesabında 2FA şart (K2b.3). acme-dns için `_acme-challenge.praxis-XXXX` CNAME + acme-dns alt bölgesi NS kaydı, ikisi de gri. CAA kaydı yok (LE serbest). Deneme: A `praxis-test` → 192.168.2.111 + elle TXT, `lego` v5 (`exec` sağlayıcı) ile LE sertifikası (`CN=praxis-test.praxura.de`, YE2), Caddy'ye geçici `docker-compose.override.yml` (gitignore'lu) + `CADDY_TLS_ARG` dosya yolu; Kemal'in telefonu (Wi-Fi, hiçbir şey yüklenmeden) kilitli sayfayı uyarısız açtı. Deneme sertifikasının anahtarı bilinçli olarak **yedek dışında** (`/root/praxura-test-certs/`, WSL ext4, 700/600) — asıl yol K2b.4'te Caddy'nin kendi `/data`'sı. A kaydı K2b.2'ye kadar durur, TXT silinir · **Ön kontrol K2b.2/K2b.3/K2b.17 (05.10.2026 akşam) — `GEÇER, KAYITLA`:** (1) anahtar çifti kurulumda `api` imajının kendi kodu (`docker compose run --rm api`) ile üretilir, `install.sh`'ta openssl yok — tek kripto uygulaması; dosya `kimlik` volume'u, yalnız `api`'ye mount, `0600`; `backup.sh` izin listesiyle çalıştığı için (db + storage + caddy pki) kendiliğinden dışarıda — test ile sabitlenir. (2) acme-dns kimliği **ayrı kalır** (Caddy `caddy-dns/acmedns` onu ister), kutu kaydına bağlı, `caddy`'ye mount, o da yedek dışı. (3) **Yedekten dönüş/yeni donanım:** iki kimlik de yok → merkez admin'i aynı ada bağlı **yeniden bağlama kodu** verir, eski açık anahtar + eski acme-dns hesabı aynı anda iptal. (4) **İptal ≠ adres silme** (K9): iptal imzalı istekleri ve acme-dns hesabını kapatır, A kaydı ayrı admin adımıyla silinir — sözleşme biterken praksis LAN'da adresini kaybetmez, sertifika ≤90 günde düşer, çıkış yolu (d) devreye girer. (5) **Ad praksis tarafından yazılmaz** (Kemal + legal-de 05.10 akşam: CT kayıtları herkese açık ve kalıcı, praksis/kişi adından türeyen ad kişisel veri) — merkez seçilmiş kısa Almanca kelime listesinden (umlaut/ß yok, küçük harf) + 1–2 hane üretir, ör. `sonne-tal-42`; ekranda yalnız „Neuen Namen vorschlagen", serbest metin yok; öneri kurulum koduna 10 dk rezerve, kod başına öneri sınırlı. Alt ad ↔ praksis eşlemesi merkezde bizim B2B verimiz (VVT V-1). **Ad sonradan değişmez** (v1, self-servis yok); admin yeniden adlandırması eski adı **kalıcı mezar taşına** alır, ad asla yeniden verilmez (hasta mailindeki link + CT kaydı başka praksise gitmesin). (6) **Zone jetonu yarıçapı:** Cloudflare jetonu tüm `praxura.de`'ye yazar (MX, `app`, `pay`) — jeton yalnız DNS:Edit + tek zone + **istemci IP filtresi = merkez VPS IP'si**, admin HTTP ucu yok (CLI). Merkez bu yüzden n8n VPS'inde **olmaz** (O-159 + jeton yarıçapı), K3'ten önce ayrı küçük VPS. (7) **K2b.6 tuzağı:** `api` konteyneri ev sahibinin LAN IP'sini göremez (bridge ağı) — IP'yi ev sahibi tarafı (Linux timer / Windows başlatıcı görevi) dosyaya yazar, `api` okur + imzalar; Hetzner varyantında merkez isteğin kaynak IP'sini kullanır. (8) **TTL çelişkisi:** K2b.6 ≤15 dk ister (kısa TTL), O-162 internetsiz önbellek ister (uzun TTL) → v1 TTL 600 sn, K2b.9 ölçümü karar verir. (9) CAA: kayıtta alt ad başına `issue "letsencrypt.org; validationmethods=dns-01"`; `accounturi` Caddy'nin LE hesabı oluştuktan sonra imzalı ayrı uçla (K2b.4) — LE hesap anahtarı yedekte olmadığından dönüşte yeni hesap = CAA yeniden yazılmalı, sıra K2b.4'te test edilir. Apex'e CAA **konmaz** (Vercel/Stripe `pay.` sertifikaları). acme-dns upstream: joohoi/acme-dns v2.0.2 (02.2025), MIT — K8 tipi lisans riski yok; `/register` yalnız merkez içinden, dışa yalnız `/update` · **Ön kontrol K2b.5 (06.10.2026) — `GEÇER, KAYITLA`, şartlarla:** (K1) Ayrı `kayit` servisi, `profiles: [kurulum]`, aynı `${PRAXURA_API_IMAGE}` — `run -v` yerine (görünür, test edilebilir). Bu servis: `depends_on` YOK (yoksa `run` db+kong'u kaldırır), port yok, `restart: "no"`, env yalnız `MERKEZ_URL`/`KIMLIK_DIR`/`ACMEDNS_DIR`/`TZ` — `SERVICE_ROLE_KEY`, `DATABASE_URL`, `DATA_ENCRYPTION_KEY` **girmez** (kayıt hasta verisine dokunmaz, en az yetki). `kimlik` + `acmedns` ikisi rw. Uzun yaşayan `api`: yalnız `kimlik`, **`:ro`** (imzalar, yazmaz; anahtar değişimi yalnız `kayit`'tan). `caddy`: yalnız `acmedns:ro`, `/data` altına değil ayrı yola (`backup.sh` `/data/caddy/pki`'yi kopyalıyor, karışmasın). (K2) **Volume sahipliği tuzağı:** `api` imajı `USER app`; boş named volume mount noktasının sahibini imajdaki dizinden alır — dizin imajda yoksa root olur, `kayit.js` EACCES ile düşer. `api-backend/Dockerfile`'da `USER`'dan önce iki dizin yaratılıp `app`'e chown edilir. `caddy` root koştuğu için `0600` dosyayı okur; caddy ileride root-dışı koşarsa bu kırılır (K2b.4'te not). (K3) **`install.sh --neu` kimliği yakıyor:** `install.sh:217` `docker compose down -v` → `kimlik` + `acmedns` de silinir; kurulum kodu tek kullanımlık, ad merkezde eski açık anahtara bağlı kalır → her `--neu` destek talebi (`kod-rebind`) üretir. `--neu` yalnız veri volume'larını silmeli (db/storage/caddy), iki kimlik volume'u kalır; adım 0'da kimlik `ad` taşıyorsa kayıt atlanır, `SITE_URL` kimlikten okunur. (K4) **İlk A kaydı kurulumda:** merkez `/v1/register` A kaydı yazmıyor (yalnız CNAME+CAA, `merkez/server.js:151-152`), A yalnız `/v1/ip`'den. K2b.6 timer'ı gelene kadar kayıtlı ad **hiç çözülmez**. İlk `/v1/ip` (modus `lan`, IP'yi host tarafı `install.sh` bulur — O-161 (7)) K2b.5 akışının parçası; timer K2b.6. (K5) **`MERKEZ_URL` değeri `.env.template`'te durur, `install.sh` yazmaz:** `update.sh` J4 üç-yollu birleştirme yapıyor (`update.sh:507-530`) — `install.sh` değeri `.env`'e yazarsa sonradan şablonda değişen merkez adresi her kutuda "ikisi de değiştirdi" çakışmasına düşer. Bugün boş (merkez VPS'i yok, K3 öncesi); VPS gelince tek yer şablon. `ACME_DNS_URL` kutu `.env`'ine **eklenmez**: merkez onu `/v1/register` cevabında `server_url` olarak veriyor (`merkez/server.js:166`), `acmedns.json`'a yazılıyor — ikinci kaynak sürüklenir. (K6) **Kapı kör noktası:** `check-onprem.sh` `onprem/`'u tümden hariç tutuyor ve yalnız `n8n.infinitymade.de`/`app.praxura.de`/`*.supabase.co` sayıyor; `merkez.praxura.de` gibi yeni bir host ne `api-backend/merkez-istemci/`'de ne şablonda sayılır. Bugün `merkez-istemci`'de `praxura.de` = 0 (06.10 ölçüm). Kapıya sayaç: `praxura\.de` in `api-backend/merkez-istemci/` taban 0 (builder). Şablondaki değer config'tir, sayılmaz — çıkış yolu (d) override eder. (K7) Kurulum kodu `--code` argv yerine env/stdin ile verilir — `install.sh` çıktıyı `install.log`'a tee'liyor ve argv `ps`'te görünür (tek kullanımlık, 10 dk; düşük risk ama bedava). (K8) Geçiş: kod yolu + `CADDY_TLS_ARG=internal` K2b.4'e kadar (Caddy ad için iç sertifika verir; Windows adım 9'un kök-sertifika dalı zaten `CADDY_TLS_ARG=internal`'a koşullu, kendiliğinden çalışır, K2b.4'te kendiliğinden ölür). Boş Enter = eski yol (elle adres + TLS sorusu) = K2b.8 çıkış yolu — iki yol **aynı betik**, fork değil. K2b.4 geçişinde `CADDY_TLS_ARG` `.env`'de install'un yazdığı değer olduğu için J4 onu taşımaz → test kutuları yeniden kurulur (canlı müşteri yok); `:stable`'a çıkmadan önce bu göç yolu yazılı olmalı. (K9) Sıra: kod adım 4'te yalnız kabuk değişkenine alınır (`.env`'e değil); kanal (adım 11) → `docker compose pull api` → `kayit` (öneri döngüsü + kayıt + ilk `/v1/ip`) → `SITE_URL`/`API_EXTERNAL_URL`/`SUPABASE_PUBLIC_URL` `set_env` → `SITE_URL` Pflichtfeld-Tor'a girer, `up`'tan (adım 13) önce. (K10) Yedek-dışı testi `tools/onprem-kimlik-yedek.test.js` (`npm test` → `test:tools` glob'u `tools/**/*.test.js`): compose blok-okuma ile K1 mount/env kuralları + `backup.sh`'ın kaynak listesi **izin listesi olarak** (yalnız `volumes/storage`, `caddy:/data/caddy/pki`, db dump) + `install.sh --neu` iki kimlik volume'unu silmiyor. YAML bağımlılığı eklenmez. (K11) `kayit` servisi yeni bir `image:` satırı → `onprem_image` 8→9; kapı reddeder. Yabancı konteyner değil, aynı imaj — taban bilinçli yükseltilir, gerekçe `tools/.onprem-baseline`'a, NOTICE değişmez. (K12) Yerel test: `MERKEZ_DEV=1` Cloudflare/acme-dns'i **sahtelemiyor** (yalnız host/proxy zorunluluğunu kaldırıyor, `merkez/server.js:248-260`; `cloudflare.js:6` gerçek API). Sahteler yalnız `merkez/test/helper.js`. Yerel uçtan uca için helper sahteleriyle `127.0.0.1`'e bağlanan ayrı dev başlatıcı (test klasöründe, `MERKEZ_DEV=1` yoksa reddeder); prod `server.js`'e sahte anahtarı **konmaz**. Konteynerden `localhost` konteynerin kendisi — `merkez-fetch.js:10` http'yi yalnız localhost'a izin veriyor, bu gevşetilmez; test için gitignore'lu `docker-compose.override.yml`'de `kayit: network_mode: host`. (i) `.gitignore` şartı kapandı (`merkez/*.sqlite`, `.gitignore:106`) · **K2b.5a bitti (06.10.2026, commit bekliyor):** K1 (`kayit` servisi, `profiles: ["kurulum"]`, depends_on/port yok, `restart: "no"`, env yalnız `MERKEZ_URL`/`KIMLIK_DIR`/`ACMEDNS_DIR`/`KAYIT_CODE`/`TZ`; `api` → `kimlik:ro` + `MERKEZ_URL: ${MERKEZ_URL:-}`; `caddy` → `acmedns:/etc/praxura/acmedns:ro`) · K2 (Dockerfile iki dizin, `app`, 700) · K3 (`--neu` artık `down` + yalnız `db-config`/`caddy_data`/`caddy_config` silinir, proje adı compose `^name:`'den) · K5 (`MERKEZ_URL=` şablonda boş, install yazmıyor, `ACME_DNS_URL` yok) · K7 (kod `KAYIT_CODE` env'den) · K4'ün istemci yarısı (`--lan-ip`/`--internet` → kayıttan sonra tek imzalı `/v1/ip`, başarısızsa kayıt geçerli kalır) · K10 (`tools/onprem-kimlik-yedek.test.js` + `kayit.test.js`) · K11 (`onprem_image` 8→9 gerekçeli) ✅. `merkez-istemci`'de `praxura.de` = 0 (06.10 tekrar sayıldı), `check-onprem.sh` rc=0. **K2b.5b'ye devreden:** K9 (install.sh akışı: kod → pull → `kayit` → `set_env` → `up`), K8, K6 kapı sayacı. **Açık risk (soğuk denetim, K2b.5b'de kapanacak):** boş named volume'u **ilk mount eden** konteyner sahipliği belirler. `kimlik` ilk kez `api` (`:ro`) ile yaratılırsa sahiplik api imajındaki dizinden kopyalanmalı (`:ro` mount'ta da copy-up olduğu **ölçülmedi**, testte doğrulanacak). Daha keskin olan `acmedns`: `up` önce koşarsa onu `caddy` yaratır, caddy imajında `/etc/praxura/acmedns` **yok** → volume `root:root` → sonraki `kayit` (USER app) EACCES. Kodsuz kurulup (çıkış yolu d) sonradan kod giren her kutuda olur. Şart (K13): `install.sh` **her iki yolda da** ilk `up`'tan önce volume'ları `kayit` imajıyla hazırlar (`docker compose --profile kurulum run --rm --no-deps --entrypoint true kayit` — idempotent, kod gerektirmez); `kayit.js` EACCES'te dizini ve "install.sh'ı yeniden çalıştır" çaresini söyleyen anlaşılır hata basar. Bugün bozuk volume'lu kutu yalnız test kutusu (canlı müşteri yok) → göç adımı gerekmez, yeniden kurulum yeter · **K2b.5b bitti (06.10.2026, commit bekliyor; `git diff --cached` okundu):** K9 akışı `install.sh`'ta: adım 4 önce `kayit --durum --json` (kodsuz, ağsız; kayıtlıysa `vorhanden`, `SITE_URL` kimlikteki fqdn'den, fqdn yoksa fail + destek), sonra `MERKEZ_URL` (env > şablon) doluysa kod `read -r -s` ile (`install.sh:246`), `.env`/argv/log'a girmez, yalnız `run -e KAYIT_CODE` sürecine, iki yolda da `unset` (`:573`, `:617`) — K7 ✅. Adım 13: K13 hazırlık `run --rm --no-deps --entrypoint true kayit` her iki yolda ilk `up`'tan önce (`:549`) ✅; kod yolunda ikinci `--durum` (`:559`), öneri döngüsü (`rebind:true` → soru yok), `--lan-ip <RFC1918> | --internet` ile kayıt + ilk `/v1/ip` (K4 kutu yarısı) ✅, sonra `set_env` üçlüsü + `up` öncesi ikinci tor (boş / `https://praxis.local` reddi, `:647-650`) ✅. K8: kod/vorhanden yolunda `CADDY_TLS_ARG=internal`, TLS sorulmaz; boş Enter = eski yol (aynı betik, fork yok) ✅. K6: kapı sayacı `merkez_istemci_host` (`check-onprem.sh:122`, taban 0, `.onprem-baseline:87`) ✅; `check-onprem.sh` rc=0 (06.10 ölçüm). `kayit.js` EACCES/EPERM'de Almanca çare mesajı (`kayit.js:38`) — K13'ün ikinci yarısı ✅. K12: `merkez/test/dev-server.js` (`MERKEZ_DEV=1` şart, `127.0.0.1`, sahte Cloudflare/acme-dns, geçici SQLite) — prod `server.js`'e sahte girmedi ✅; yerel uçtan uca öneri → kayıt → sahte A → durum geçti, ikinci kayıt reddedildi. **Yalnız gerçek Linux+Docker kutusunda doğrulanacak (açık):** volume sahipliği/copy-up (K13 — özellikle kodsuz kurulup sonradan kod giren kutu), interaktif döngü, `ip route` çoklu arayüz seçimi, Caddy internal sertifika + fqdn. **İki küçük not:** (a) adım 4'teki ön `--durum` kanal seçiminden (adım 11) önce koşuyor; imaj yoksa `docker compose run` sessizce **çeker** (stderr `/dev/null`) — yanlış kanal imajı inebilir ya da adım gereksiz uzar. `--pull never` eklenmeli: imaj yoksa `--durum` boş döner, adım 13'teki ikinci `--durum` zaten kapsıyor. (b) **Yeniden bağlama kodu `install.sh`'tan girilmiyor** (kayıtlı kutu `vorhanden`'e düşer) — kabul: yedekten dönüş/yeni donanımda iki kimlik volume'u da yok, kutu kod yoluna düşer ve merkez `rebind:true` verir, yani asıl dönüş senaryosu install.sh'tan çalışıyor; elle yol yalnız kimliği yerinde duran ama anahtarı değişecek kutu (ele geçirilme şüphesi, admin kararı) için. K2b.8 kılavuzuna yazılır, iki şartla: komut kodu kabuk geçmişine bırakmaz (`read -rs KAYIT_CODE; export KAYIT_CODE; docker compose --profile kurulum run --rm --no-deps -e KAYIT_CODE kayit --neuer-schluessel; unset KAYIT_CODE` — `KAYIT_CODE=… docker …` biçimi **yazılmaz**), ve `--neuer-schluessel` O-161 (3) gereği eski acme-dns hesabını da yeniler — merkez tarafında eski açık anahtar + eski acme-dns hesabı **aynı anda** iptal; K2b.8'de test edilir. Durum değişmez: `geplant` — K2b.4 (Caddy acmedns/gerçek sertifika), K2b.6 (IP timer), (iv) merkez VPS dağıtımı açık · **Ön kontrol K2b.6 (06.10.2026) — `GEÇER, KAYITLA`, şartlarla.** Tasarım (host timer → `volumes/ip/lan-ip` dosyası → `api` okur + imzalı `/v1/ip`) O-161 (7)'yi doğru karşılıyor; tip F, G1 temiz (yalnız özel IP), G7 temiz (SaaS'ta `MERKEZ_URL` yok → iş hiç kurulmaz, interval açılmadan döner). Şartlar: (L1) **Mod tick'te yeniden türetilmez.** `lan`/`internet` kurulumda seçilir (`install.sh:610-614`) ve host tarafında ayrı dosyada sabitlenir (ör. `volumes/ip/modus`, install yazar). Timer yalnız IP raporlar. Gerekçe: her 5 dk "RFC1918 değilse `internet`" kuralı, açılışta ağ henüz yokken (`ip route get` boş) ya da VPN/Tailscale (100.64/10) rotası 1.1.1.1'i alınca LAN kutusunun A kaydını kutunun **genel** IP'sine çevirir — tüm praksis LAN'da adresini kaybeder. LAN modunda RFC1918 dışı ya da boş sonuç = **dosyaya dokunma**, yalnız log uyarısı (son iyi değer kalır). (L2) **Fallback `hostname -I` timer'da kullanılmaz:** Docker kurulu her hostta ilk adres `172.17.0.1`/`br-*` olabilir, RFC1918 olduğu için süzgeçten geçer ve A kaydı docker köprüsüne gider. Varsayılan rota cihazının (`ip -4 route show default` → `dev`) adresi alınır; bulunamazsa dokunma. Aynı düzeltme `install.sh`'ın kurulumdaki ilk `/v1/ip`'si için de geçerli. (L3) **Tek kaynak `onprem/lib-ip.sh`** (`lib-health.sh` kalıbı): `install.sh` ve `ip-melden.sh` aynı fonksiyonu `source` eder. Kopya olursa kurulumda bildirilen IP ile ilk tick'teki IP farklı yöntemle bulunur → A kaydı ilk 5 dakikada çırpınır. `windows/praxura-installieren.ps1:387` (Get-NetIPConfiguration) yalnız ekrana yazar, otorite değildir — ikisinin farklı IP göstermesi K2b.9 testinde bakılacak not. (L4) **Paket dört liste + manifest:** `lib-ip.sh` ve `ip-melden.sh` ikisi de → `api-backend/Dockerfile:39` COPY · `publish-calendar-api.yml` `paths:` · aynı workflow'daki Smoke-Test `BUNDLE_DATEIEN` (dördüncü liste, 02.10 dersi, `onprem-manifest.mjs:131`) · `BUNDLE_DATEILER` · sonra `node tools/onprem-manifest.mjs` ile manifest yenilenir. `--check` eksik olanı commit'te söyler. (L5) **Mount = dizin, dosya değil** (`./volumes/ip:/var/lib/praxura/ip:ro`): tek-dosya bind mount'ta `tmp+mv` yeni inode yaratır, konteyner eski dosyayı görmeye devam eder. Dizin mount'u bunu çözer — bu yüzden dizin olarak kalır. Dizin + ilk değer `install.sh` tarafından **ilk `up`'tan önce** yazılır (yoksa Docker dizini root:root boş yaratır, `api` ilk tick'te boş okur); dosya modu `0644` (api `USER app`). Dosya `ip-melden.sh` yazarken `tmp` aynı dizinde (aynı dosya sistemi → atomik `mv`). (L6) **Kapı/ignore:** O-72 mount-kaynak regex'i (`check-onprem.sh:248`) uzantı istiyor, `./volumes/ip` dizini eşleşmez → manifest'e girmez, doğru (canlı durum dizini, `volumes/db/data` sınıfı). `.gitignore`'a `onprem/volumes/ip/` **eklenir** (yerel test kutusu dosyayı yazar, public repoya LAN IP girmesin). `.vercelignore` zaten `onprem/` (satır 42) — iş yok. `backup.sh` izin listesi almaz — doğru, dönüşte timer 5 dk'da yeniden yazar. `onprem_image` sayacı değişmez (yeni servis yok). (L7) **Süre bütçesi ≤15 dk tutmuyor:** host 5 dk + api tick 5 dk (senkronsuz) + TTL 600 sn = en kötü **20 dk**. Çözüm: host timer **2 dk** (`ip route` bedava) + api dosyayı **60 sn**'de bir okur, yalnız değişince/6 saatte gönderir → 2+1+10 = 13 dk. Merkez tarafı uyumlu: `/v1/ip` aynı IP'yi 6 saat içinde Cloudflare'e yazmıyor (`merkez/server.js:207`), imzalı limit 60/dk/IP (`:44`) — 60 sn okuma ağ isteği üretmez, yalnız değişim üretir. TTL 600 O-161 (8) gereği değişmez. Mobil işletim sistemlerinin TTL'i aşan önbelleği ölçütün dışında, K2b.9'da ölçülür. (L8) **Hata davranışı:** ağ/5xx/429 → bir sonraki tick (60 sn) yeterli, ama başarısız gönderimler arası en az 5 dk (sabit bekleme, üstel gerekmez — 20 kutu × 1/dk merkez limitine yaklaşmaz; NAT arkasındaki kutular ayrı IP). 401/403 (kutu iptal / anahtar değişti) → 6 saatte bir dener, her denemede değil **ilk seferde** uyarı log'u. Hiçbir durumda kutunun açılışını/route'larını bloklamaz (tamamen arka plan, try/catch). (L9) **Log:** LAN IP kutunun kendi log'unda yazılabilir (Sentry'ye gitmez — kutuda `SENTRY_DSN` yok), ama **yalnız değişimde** ("IP 192.168.1.20 → 192.168.1.35 gemeldet"), her tick'te değil. (L10) **update.sh:** canlı müşteri yok → test kutuları yeniden kurulur, şimdilik yeter. Ama `:stable`'a çıkmadan önce unit yazımı `install.sh` içinde fonksiyona (ör. `lib-ip.sh` içinde `ip_timer_kur`) çekilir ve `update.sh` onu idempotent çağırır — yoksa yeni compose eski kutuya mount'u getirir, Docker boş dizin yaratır, api sessizce hiçbir şey yapmaz ve IP değişince adres kırık kalır (kimse fark etmez). (L11) **Windows:** ek görev gerekmez. Mirrored ağda WSL'in `ip route get` sonucu Windows'un LAN IP'sidir; WSL kapalı = kutu yok = adres zaten anlamsız. `OnBootSec=1min` WSL'in başlatıcı görevle açılmasını da kapsar (systemd adım 4'te açık). Not: kurumsal VPN istemcisi (tam tünel) açıkken rota VPN'e döner ve 10.x verebilir — L2 ile varsayılan rota cihazı seçilir, yine de K2b.9 testine yazılır. (L12) Test: `ip-abgleich.test.js` — dosya yok/boş/`internet`/RFC1918 dışı, değişmemiş + 6 saat, 401 seyrekleşmesi, `MERKEZ_URL` boşken interval açılmıyor (SaaS kanıtı) **06.10.2026 (K2b.6) — kod var, commit + gerçek kutu doğrulaması açık:** `onprem/lib-ip.sh` (varsayılan rota cihazı, `scope global` IPv4, `hostname -I` yok; `ist_rfc1918`) install.sh ve `onprem/ip-melden.sh` tarafından ortak source edilir (L2/L3 — tek mantık, drift yok). install.sh modu kurulumda bir kez `volumes/ip/modus` + `lan-ip` olarak atomik (tmp+mv, 0644) yazar, boş IP'de `internet`'e sessizce düşmez, kod harcanmadan durur; `praxura-ip.timer` OnBootSec=1min / OnUnitActiveSec=2min (L7). ip-melden.sh yalnız `lan`'da, RFC1918 değilse dosyaya dokunmaz (L1/L5). Compose `api`: `./volumes/ip:/var/lib/praxura/ip:ro` (dizin mount; `.gitignore` `onprem/volumes/ip/`). `api-backend/merkez-istemci/ip-abgleich.js` + `server.js` tek import + tek çağrı: `MERKEZ_URL` boş ya da instance≠0 → timer yok (SaaS'ta `null` ölçüldü — G7 temiz), ilk 30 sn sonra 60 sn tick, 5 dk / 6 saat geri çekilme, log yalnız değişimde (L8/L9). Bundle + manifest (19 dosya) `--check` temiz, `check-onprem.sh` rc=0. Soğuk denetimde `ip_modus` hiç atanmıyordu (`set -u` → kayıttan sonra çökme) — düzeltildi, yapı testi mutasyonla doğrulandı. **Açık kalan tek şart L10:** `ip_timer_einrichten` hâlâ install.sh içinde; `:stable`'dan önce lib'e taşınır ve update.sh'tan idempotent çağrılır. Ek olarak update.sh, K2b.6 öncesi kurulmuş kutuda `volumes/ip/modus` yoksa install.sh'ın `vorhanden` dalındaki (satır ~653) mod yazımını da aynı fonksiyondan yapmalı — yoksa timer guard'ı (`[ -f modus ] || return 0`) sessizce çıkar ve eski kutu hiç IP bildirmez. Canlı müşteri yok → bugün engel değil, `:stable` kapısında engel. · **K2b.8 kısım 1 kontrolü (06.10.2026, KURULUM.md diff, commit yok) — şart (d) içerikçe karşılanıyor, altı düzeltmeyle:** (d1) `.env` + `up -d` teknik olarak yeter: URL'yi okuyan dört servis (`auth` GOTRUE_SITE_URL/JWT_ISSUER, `storage`, `api`, `caddy`) env değişince compose tarafından yeniden yaratılır; `ADDITIONAL_REDIRECT_URLS` boş, ek değer yok; `update.sh` J4 elle değiştirilen `SITE_URL`'yi korur. Caddy internal'da yeni ad aynı kökten imzalanır → kökü zaten güvenen cihaz yeniden import etmez. Ama tarayıcı oturumu origin'e bağlı → herkes **bir kez yeniden giriş** yapar; „Logins bleiben gültig" = parolalar geçerli diye yazılmalı. (d2) **Windows:** `wsl … up -d` yetmez — box PC'nin hosts satırı (O-163, `127.0.0.1`) eski adda kalır, box PC kendini açamaz. Çare: `praxura-installieren.ps1` yeniden çalıştırılır (`.env` varken install.sh'ı atlıyor, `SITE_URL`'yi okuyup hosts'u yeniden yazıyor, ps1:252/268/339). (d3) Weg 1 + `internal` = §4 kök sertifika importu **gerekir** ve FRITZ!Box rebind istisnası kendi ad için de gerekir — ikisi Weg 1'de yazılmamış. LE seçeneği yalnız gerçekten dışarıdan erişilen kutu (Hetzner) için; LAN kutusu için port açılmaz (HTTP-01 özel IP'de zaten başarısız). (d4) „Neuinstallation mit Enter ohne Code führt auf diesen Weg" kimlik volume'u duran kutuda **yanlış**: `install.sh:215-225` `vorhanden` dalı kod sorusunu hiç sormaz ve `SITE_URL`'yi eski merkez adına geri yazar (`:332`); K3 gereği `--neu` kimliği silmiyor. Yalnız yeni donanımda doğru. Builder adayı (açık): `vorhanden` dalında `.env` yoksa da çıkış yolunu seçtirecek bir bayrak (ör. `--eigene-adresse`) ya da kılavuzda „nach `--neu` `.env` erneut anpassen". (d5) „Name bleibt im DNS stehen" garanti değil (K9 iptal A'yı bırakır, ama Praxura yoksa `praxura.de` zone'u da gider) ve ad servisi düşünce **IP takibi de durur** → DHCP rezervasyonu tavsiyesi eklenmeli. „90 Tage" yalnız K2b.4'ten sonra doğru; bugün sertifika internal, süre düşmez — kılavuz bunu §2.2 notundaki gibi koşullu söylemeli. „Umstieg bei Kündigung planen, nicht bei Ablauf". (d6) Fall B komutu verilen biçimle birebir (`read -rs`/`export`/`unset`, argv'de kod yok) ✅; Fall A rebind akışıyla uyumlu ✅. Merkez tarafında eski açık anahtar + eski acme-dns hesabının aynı anda iptali hâlâ K2b.8 testi (açık). (d) bu altı nokta yazılınca kapanır; Durum değişmez (`geplant`). · **08.10.2026 (K2b.10, onprem sicil turu):** `geplant`→🟡 `kısmen gelöst` — zincir canlı ve uçtan uca ölçüldü: merkez VPS (K2b.2, 07.10 gece; ayrı Hetzner projesi, `13223e8b`) · ilk gerçek kutu kayıt + LE sertifikası (K2b.3, `99ada660`) · CAA `accounturi` + `caddy_data` kaybında kendini onarma (K2b.4b, `ca95492f` + `1d53596e`) · IP eşitleme (K2b.6) ve L10 eski kutuda timer/mod (`ec37573a`, `update.sh` adım 7c — **L10 kapalı**) · çapraz kutu yazamama (K2b.3). **Kalan, sahipli:** (1) merkez için dış izleme (guvenlik S-46 Bed. 7) — Kemal erteledi, **ilk gerçek müşteri kutusundan önce** şart; merkez düşerse kutu çalışır ama yenileme/IP takibi sessizce durur (O-172 ile birleşir) · (2) KHS §5b T7 (06.10 devir listesi), T8 (Hetzner'de gerçek istemci IP'si), T15 (telefon, praksis Wi-Fi, uyarısız sertifika). Üçü + izleme gelince `gelöst` |

> **06.10.2026 — K2b.4 ön kontrolü (Caddy DNS-01 / `caddy-dns/acmedns`): GEÇER, KAYITLA.** G1/G2/G3/G8 ihlali yok: Caddy'nin merkeze çıkışı O-161'in zaten kayıtlı (2) zinciridir, adres `acmedns.json`'daki `server_url`'den gelir (koda host girmez, kapı sayaçları değişmez); LE `dir` URL'si üçüncü taraf sabiti, sayılan desenlerde değil. G7: Caddy yalnız kutuda koşar, tek Caddyfile + env seçimi fork değildir. Şartlar (builder): **(1)** Caddyfile içinde varsayılanlı yer tutucu `import tls_{$CADDY_TLS_MODUS:klassisch}` — compose varsayılanı yetmez, `publish-frontend.yml` smoke testi env'siz `docker run` yapıyor ve yeni imaj eski compose ile de kalkabilmeli · **(2)** builder ve runtime aşamasının caddy etiketi **aynı tam sürüme** sabitlenir (ör. `2.10.x-builder-alpine` / `2.10.x-alpine`, tek ARG); `.env.template:46 VERSION_CADDY=2.9-alpine` hiçbir yerde okunmuyor (ölü, yanıltıcı) — kaldırılır ya da 2.10'a çekilir · **(3)** smoke testine ikinci koşu: `CADDY_TLS_MODUS=acmedns` + sahte `acmedns.json` ile `caddy validate`, ve klassisch modda dosya **yokken** Caddy'nin kalktığı (snippet import edilmezse modül provision edilmez — ölçülmeli) → O-171 · **(4)** `issuer acme` yalnız LE (CAA letsencrypt.org; kısa `tls { dns … }` biçimi ZeroSSL'i de dener, CAA'ya takılır) · **(5)** `install.sh` acmedns'e geçmeden önce dosyanın volume'da varlığını doğrular; yoksa klassisch'e düşer ve söyler (O-171) · **(6)** HSTS acmedns modunda **şimdilik 0** (O-172) · **(7)** `ps1` adım 9 ve `install.sh:947` root.crt dalı `MODUS=klassisch` **ve** `ARG=internal` koşuluna bağlanır; acmedns modunda `CADDY_TLS_ARG` şablondaki `internal` olarak kalacağı için tek başına ARG'ye bakmak yanlış dala girer · **(8)** `backup.sh` pki'yi acmedns modunda **açıkça** atlar (bugün başarısızlıkla atlıyor; Caddy yerel CA'yı lazy yaratır, kutuya göre var/yok olabilir); `restore.sh:486` zaten "arşivde varsa" — değişiklik gerekmez. S-43 kapanışı `guvenlik`'in kararı · **(9)** `NOTICE.md:24` caddy satırı 2.10'a + `caddy-dns/acmedns` ve `libdns/acmedns` lisans satırları (O-42; K8 dersi — lisans builder'da kaynağından okunur) · **(10)** compose yorumu: acmedns.json'u okuyabilmesi Caddy'nin root koşmasına bağlı (0600 `app`); imaj non-root'a çevrilirse kırılır. **J4:** yeni anahtar `CADDY_TLS_MODUS=klassisch` eski `.env`'e sona eklenir → eski kutu aynen davranır; mevcut kod-modu kutular (K2b.5, `internal`) otomatik acmedns'e **geçmez**, geçiş `install.sh` yeniden koşusuyla — sahada canlı kutu yok, kabul. **accounturi (9):** K2b.4'ten **ayrılır**, VPS ile K2b.4b — ilk LE hesabı ilk sertifika siparişinde doğar (accounturi ondan önce bilinemez), restore/yeni donanımda yeni hesap + merkez kapalıysa sertifika hiç alınamaz; acme-dns kimliği zaten asıl kapı, accounturi ek savunma. K2b.4b'de: `users/*/` glob'la okunur (e-posta girilirse dizin adı `default` olmaz). **Manifest:** `docker-compose.yml`, `.env.template`, `install.sh`, `backup.sh` değişeceği için `tools/onprem-manifest.mjs` + sürüm artışı; geriye uyumlu, `durak` gerekmez. `.onprem-baseline`: etkisiz.

> **06.10.2026 — K2b.4 kod karşılığı (commit öncesi, koordinatör beyanı + bu sicilin sondajı):** şart 1-5, 7-10 karşılandı (Caddyfile:35-53 · frontend.Dockerfile:52-59 tek `ARG VERSION_CADDY=2.11.6`, builder+runtime aynı — 2.10 yerine 2.11.6, modül ≥2.10 istiyor, kabul · `.env.template` ölü `VERSION_CADDY` silindi · `install.sh:972-974` kök sertifika yalnız `klassisch && internal` · `backup.sh:171` acmedns'te pki açıkça atlanır · NOTICE: caddy 2.11.6, `caddy-dns/acmedns` v0.7.0 MIT, `libdns/acmedns` v0.5.0 MIT). Şart 6 (HSTS) farklı uygulandı: 86400 — O-172'de. Yeni env `CADDY_ACMEDNS_DATEI` yalnız Caddyfile içinde varsayılanlı yer tutucu (test için), compose/şablonda yok, sır değil — kabul. `check-onprem.sh` rc=0. Manifest 0.4.0'da yeniden üretildi, sürüm artmadı (K2b.5/K2b.6 ile aynı paket turu). **Açık:** gerçek LE uçtan uca (VPS) · restore sonrası sertifika (VPS) · accounturi → K2b.4b (`users/*/` glob) · eski kod-modu test kutusu `install.sh` yeniden koşusuyla geçer.


> **06.10.2026 — L10 (`ip_modus_yaz`/`ip_timer_kur` → `lib-ip.sh`, `update.sh` adım 7c): ön kontrol GEÇER, KAYITLA → ✅ kapandı `ec37573a`.** Tip F + G; G1/G2/G3/G8 temiz (yeni host/sır yok, O-161 (3) zinciri). Ön kontrol cevapları: update timer'ı root koşar (`praxura-update.service` `User=` yok); WSL'de başlatıcı `systemd=true` + `default=root` yazıp PID 1'i doğruluyor (`praxura-installieren.ps1:209-229`), `install.sh` `-u root` (`:263`) — L11 ile tutarlı; `lib-ip.sh` bundle'da (`manifest.json`), `ip-melden.sh` onu source ediyor. Şartlar ve karşılığı (koordinatör beyanı): (1) `ip_timer_kur` her adım `|| return 4` — `|| warn` bağlamında errexit kapandığı için sahte `ok` riski kapandı ✓ · (2) root değil → 3, systemctl yok → 1, modus yok → 2 ✓ · (3) L1: `ip_modus_yaz` boş IP'de yazmaz, 1 döner; `install.sh` vorhanden yolu artık boş IP'de `internet` yazmıyor, iki kopya + `ip_timer_einrichten` kalktı ✓ · (4) `kayit --durum` başarısız/yok = kayıtsız, atla ✓ · (5) iki katlı kapı `MERKEZ_URL` → `registriert:true` (şablona ileride adres yazılırsa J4 onu kodsuz kutulara da taşır; asıl kapı `registriert`) ✓ · (6) rollback yorumu ✓ · (7) test `tools/onprem-ip-timer.test.js` (yapı + gerçek bash, mutasyonla doğrulandı) ✓. **Bilinen sınır — kabul:** 7c `kayit`'ı Schritt 9 pull'undan önce eski imajla koşar; K2b.5 öncesi imajda `kayit` yok → o tur atlanır, ertesi update'te yeni imajla kurulur. `registriert:true` olabilen kutu zaten K2b.5+ imajla kurulmuş olmak zorunda, yani gerçekte etkilenen kutu yok denecek kadar az; gecikme en fazla bir update turu, IP bildirimi update başarısından küçük. Sahada canlı kutu yok.

> **06.10.2026 — K2b.11 ön kontrolü (kurulum jetonu URL fragment'inde: `setup.html#<jeton>`, `module/setup-fragment.js`, `PRAXURA_BROWSER_OEFFNEN`): GEÇER, KAYITLA.** Tip G (kurulum akışı); dış çağrı/şema/sabit host/zamanlanmış iş yok. **G1** temiz (hasta verisi yok). **G2** temiz: `SETUP_TOKEN` kutunun kendi ürettiği tek kullanımlık jeton (`install.sh:359`), bizim sır değil, imaja girmez; fragment sunucuya ve Referer'a hiç gitmez. **G7** temiz: `setup.html`/`setup.js` yalnız kutuda (`.vercelignore:76-77`, `frontend.Dockerfile:85`, `module/` `:101`'de kopyalanıyor). **G8** temiz. **Env:** `PRAXURA_BROWSER_OEFFNEN` kabul — yalnız süreç env'i, `.env`/şablona girmediği için J4'e değmez; kapının env sayacı yalnız `N8N_` sayıyor, `.onprem-baseline` etkisiz. **Manifest:** `install.sh` bundle'da → yeniden üretilir; `praxura-installieren.ps1` manifestte **yok** (bundle dışı, update.sh tazelemez — bugünkü durum, değişmiyor). **Headless Linux:** linki `reveal_once` ile basmak doğru — bugün çıplak jeton zaten aynı yoldan basılıyor, risk sınıfı aynı; tarayıcı açma denemesi (`xdg-open`) eklenmesin (sunucuda masaüstü yok, SSH oturumunda yanlış makinede açar). **Şartlar:** (1) `module/setup-fragment.js` kutu-only → aynı commit'te `.vercelignore`'a (`setup.js` gibi; yayın yüzeyi kuralı, zararsız saf fonksiyon olsa da) · (2) ps1 `Start-Process`'ten önce `https://<ad>/health`'i bekler (≤120 sn, hosts zaten `127.0.0.1`): acmedns modunda LE sertifikası kurulum bitiminde henüz alınmamış olabilir; Caddy sertifikasız TLS el sıkışmasını keser, tarayıcıda 'devam et' bile yoktur ve jetonlu bağlantı hata sayfasında kalır. Süre dolarsa yine aç + `Log` 'Seite nicht erreichbar → in 1-2 Minuten neu laden' (fragment adres çubuğunda kalır, yeniden yükleme çalışır) · (3) gerçek Windows'ta (varsayılan tarayıcı Edge) `Start-Process` ile `#` fragment'inin tarayıcıya ulaştığı **bir kez ölçülür** — ShellExecute bazı ilişkilendirmelerde fragment düşürebiliyor; düşerse manuel yol çalışır ama K2b.11'in amacı kaçar · (4) jeton `Start-Process` komut satırında süreç listesinde görünür — `guvenlik` kabul etti (tek kullanımlık), kayda geçti · (5) `BoxEnv 'SETUP_TOKEN'` değeri hiçbir `Log`/`Warn`/`Fehler` dizgisine girmez (catch dalı dahil; plan zaten öyle). Commit sonrası durum notu bu satıra eklenir. · ✅ **`85d463e7` (06.10.2026):** şart 1, 2, 4, 5 karşılandı (5 testle kilitli). Ek: soğuk denetim `supabase-config.js`'in üst seviye `fetch`'ini yakaladı — okuma + `replaceState` artık `setup.js`'in **ilk import'u** `module/setup-fragment.js`'te (modül değerlendirme sırası `supabase-config.js`'ten önce); Playwright ölçümü: her `/api` isteğinde URL temiz. Manifest yeniden üretildi. **Açık:** (3) gerçek Windows + Edge'de `Start-Process` ile fragment'in ulaştığı ölçümü → gerçek kutu test listesinde.

> **06.10.2026 — K2b.12 (şifre kuralı 12) onprem görüşü (ön kontrol, kod yok): GEÇER, KAYITLA.** Tip G + H-benzeri (politika iki dağıtımda aynı olmalı). (1) `reset-owner-passwort.sh:45` bugün `-ge 8` → 12'ye çekilir, mesaj aynı satırda; üretilen şifre zaten 20 karakter (`:40`). Ama **kural tek yerde yaşamalı:** asıl kontrol imajdaki `setup/owner-passwort-reset.mjs`'e (ve `routes/setup.js` owner yaratma ucuna) `mitarbeiter-zugang.js:543`'teki 12 ile **aynı sabitten** girer; kabuk kontrolü yalnız erken UX. Sebep: script bundle ile (`update.sh`), kontrol imajla (pull) güncellenir — iki yerde ayrı sayı = bir update turunda farklı kurallar · (2) `onprem/docker-compose.yml` auth servisinde `GOTRUE_PASSWORD_MIN_LENGTH` bugün **yok** → GoTrue varsayılanı 6. 12 yapılması mevcut 8 karakterli şifreleri **kilitlemez**: GoTrue uzunluğu yalnız şifre koyarken/değiştirirken (signup, `updateUser`, admin create/update) denetler, girişte denetlemez — yerel yığında bir kez ölçülür (8 karakterli mevcut kullanıcı değişiklik sonrası girebiliyor mu). Değer compose'a **sabit** yazılır (`GOTRUE_PASSWORD_MIN_LENGTH: "12"`), `.env`/şablona değil: politika müşteri ayarı değil, J4'e girmez · (3) **G7:** SaaS'ta karşılığı Supabase panelindeki Auth 'Minimum password length' — repo'da iz bırakmaz; 12'ye aynı gün çekilmezse iki dağıtımda iki kural olur. Panel değişikliği K2b.12'nin bitti ölçütüne yazılır · (4) GoTrue'yu 12'ye çekmeden önce backend'in admin API ile şifre koyduğu her yol ≥12 olmalı (yoksa admin update GoTrue'dan reddedilir — istenen davranış ama hata mesajı kullanıcıya düzgün dönmeli). Manifest: compose + reset script değişir → yeniden üretilir. `.onprem-baseline` etkisiz. · ✅ **`4e691ae2` (06.10.2026)** — **düzeltme:** (2)'deki `"12"` önerim **yanlıştı**: GoTrue tek alt sınır bilir, rol bilmez; 12 çalışanların 8–11 karakterli şifre koymasını/değiştirmesini reddederdi. Compose'a sabit `GOTRUE_PASSWORD_MIN_LENGTH: "8"` (= `MIN_MITARBEITER`, her yolun alt sınırı; `guvenlik` S-49), test kilitliyor; 12'yi rolü bilen backend/frontend uygular. Reset `.sh` 12 (erken uyarı) + `.mjs` `MIN_INHABER` (bağlayıcı) ✓. SaaS paneli (G7) Kemal'de — **açık**. Manifest yeniden üretildi.

> **06.10.2026 — K2b.7 (kutu sertleştirme) ön kontrolü: GEÇER, KAYITLA.** G1/G2/G3/G8 temiz (yeni dış çağrı/sır yok). **(b) SETUP_TOKEN'ı kim siler:** asıl kapı jeton silinmesi **değil**, DB durumu (`abgeschlossen_am`) olmalı — jeton silmek derinlemesine savunma. Bugün `api-backend/setup/router.js`: `/verify` `:163`, `/owner` `:181`, `/branding` `:363` 410 dönüyor; **`/test-smtp` `:262-268` yalnız jetona bakıyor** (bilinçli: owner→abschluss arası mail testi) → abschluss sonrası da jetonla mail tetiklenebilir. Şart 1: `/test-smtp` de `istAbgeschlossen()` ise 410 (abschluss sonrası test gerekmez); `/status` dışında her uç 410. Silme: `api` konteynerinin `.env`'e yazamaması **doğru, korunur**. `update.sh` (root, zaten J4 ile `.env` yazıyor) ve `install.sh` yeniden koşusu ortak lib fonksiyonuyla: abgeschlossen ise `SETUP_TOKEN=` boşaltır; Schritt 9 `up -d`'den **önce** (env değişince `api` yeniden yaratılır → `server.js:502` router'ı hiç bağlamaz). **J4 çakışmaz:** şablon `SETUP_TOKEN=` boş (`.env.template:240`), taban da boş → J4 bu anahtarı hiç yazmaz; kutu değeri boşa inince şablonla eşitlenir, sonraki turda da sessiz. Şartlar: 2) abgeschlossen bilgisi kutu içinden okunur (`docker compose exec -T api` ile iç `/api/setup/status` ya da `db` psql), dış adres/Caddy üzerinden değil; okunamazsa **dokunma** (warn) — belirsizlikte jeton silinmez, kurulumu yarıda kalan kutu kilitlenmesin · 3) rollback notu: snapshot eski `.env`'i (jetonlu) geri koyar — zararsız, kapı DB'de; yorum yazılsın · 4) router bağlı değilken `setup.html` `/api/setup/status` 404'ünü 'bereits eingerichtet → login' olarak göstermeli (bugün hata gibi görünebilir). **(c) Rate limit katmanı:** Öneri **GoTrue yerleşik `GOTRUE_RATE_LIMIT_*` + mevcut `express-rate-limit`** (backend, `server.js:55` `trust proxy 1` — kutuda Caddy→api tek sekme, doğru); Caddy modülü ve Kong **şimdi değil**. Gerekçe: GoTrue limitleri upstream bakımlı, imaja kod eklemez, SaaS'taki Supabase Auth ile aynı mekanizma (G7 paritesi); `mholt/caddy-ratelimit` sürümlü release yayınlamıyor (pseudo-version) → tedarik zinciri + her Caddy yükseltmesinde ikinci derleme riski; Kong `rate-limiting` `kong.yml`'de SaaS'ta karşılığı olmayan ikinci yapılandırma. **Kritik şart 5:** GoTrue Kong'un arkasında; `GOTRUE_RATE_LIMIT_HEADER` ayarlanmazsa bütün istemciler Kong'un IP'si olarak tek kovada sayılır → **tek saldırgan bütün praksisin girişini kilitler.** Başlık Caddy'nin yazdığı ve istemciden geleni **ezdiği** bir başlık olmalı (Caddy `reverse_proxy` gelen `X-Forwarded-For`'u güvenilmeyen kaynaktan kabul etmez; Kong eklediği için GoTrue'ya hangi değerin ulaştığı yerel yığında **ölçülür**). 6) `/auth/v1/admin*` ve `/auth/v1/signup`'ı Caddy'de dışarıya kapatmak güvenli: `api` GoTrue'ya içeriden gider (`docker-compose.yml:432` `SUPABASE_URL: http://kong:8000`), tarayıcı tarafında `signUp(` kalmadı (yalnız `api-backend/` — mailfreier Zugang backend üzerinden). `/auth/v1/recover|verify` kapatılmaz. Değerler compose'a sabit, `.env`'e değil (politika). **(e) Ayrım doğru, bir düzeltmeyle:** Hetzner firewall → KURULUM Hetzner sayfası (K2b.8 kısım 2). SSH sertleştirme + `unattended-upgrades` Hetzner'e özgü değil, her Linux kutusu için **genel** KURULUM bölümüne; iki not: Docker paketleri otomatik yükseltmeden hariç tutulsun ya da yeniden başlatma gece penceresine bağlansın (`docker-ce` yükseltmesi praksis saatinde bütün konteynerleri yeniden başlatır), `Automatic-Reboot` gece + `update.sh`/`backup.sh` saatleriyle çakışmasın. WSL kutusunda karşılığı Windows Update — ayrı satır. İsteğe bağlı: `install.sh` ön-kontrolünde yalnız **uyarı** (SSH parola girişi açık mı) — K10 gereği biz düzeltmeyiz, söyleriz.

> **07.10.2026 — K2b.7a kod karşılığı (commit öncesi, çalışma ağacı): kod bitti, gerçek kutu testi bekliyor → O-161 `geplant` kalır.** K2b.7 ön kontrolündeki 6 şartın karşılığı: (1) `api-backend/setup/kapi.js` `setupKapisi` `router.js`'te ilk katman (`router.use`), abgeschlossen → `GET /status` dışı 410, `/test-smtp` dahil; `tools/onprem-setup-kapi.test.js` router stack'ini dolaşıyor · (2) 14 gün: `install.sh` `SETUP_TOKEN_SEIT=$(date +%s)`, compose `api` env'i, `.env.template` boş anahtar (J4 eski kutulara boş ekler → süre yok, bilinçli) · (3) `install.sh --neuer-jeton` (ps1 `-NeuerJeton`): DB `nein` ise yeni jeton + SEIT + `up -d api`, `ja`/`unbekannt` → fail, `--neu` ile birlikte red · (4) hijyen `onprem/lib-setup-jeton.sh` `setup_jeton_aufraeumen` (manifest'te): `update.sh` Schritt 8b + `install.sh` yeniden koşusu; okuma kutu içinden `docker compose exec -T db psql -U postgres` (backup.sh ile aynı desen), `ja`/`nein` dışı → `unbekannt` → dokunmaz; rollback notu lib yorumunda · (5) `setup.js` 404 → "Bereits eingerichtet" + Login, abgelaufen ayrı metin · (6) `Caddyfile` `@authgesperrt` (`/auth/v1/admin*` `signup*` `invite*` → 404) `@supabase`'den önce. **Sondaj:** 3 test dosyası 37/37 yeşil, `tools/check-onprem.sh` temiz (yeni host/`N8N_`/`api/` yok); SaaS'ta `SETUP_TOKEN` yok → router hiç bağlanmaz, kapı ölü kod (G7 temiz). **8b konumu doğru:** Schritt 6 snapshot'ından ve 7'deki J4 birleştirmesinden **sonra** (SEIT anahtarı eklenmiş, rollback jetonu geri getirir — zararsız, kapı DB'de), Schritt 9 `up -d`'den **önce** (env hash değişir → `api` yeniden yaratılır → `server.js:502` router'ı bağlamaz). **Gerçek kutu testinde ölçülecekler:** (a) `--neuer-jeton` WSL'de: eski jeton 401, yeni jeton çalışır, `api` gerçekten yeniden yaratıldı (`docker inspect` StartedAt + `docker compose exec api printenv SETUP_TOKEN_SEIT`) · (b) `update.sh` hijyeni: abgeschlossen kutuda `.env`'de iki satır boş, `/api/setup/status` 404, setup.html "Bereits eingerichtet" · (c) Caddy canlı curl: `/auth/v1/admin/users`, `/auth/v1/signup`, `/auth/v1/invite` → 404; **ek:** `//auth/v1/admin/users`, `/auth/v1/%61dmin/users`, `/AUTH/v1/admin/users` de 404 (Caddy yol temizleme/escape davranışı burada kanıtlanır, varsayılmaz); `/auth/v1/recover` ve `/auth/v1/token` açık kalır. **Küçük notlar (veto değil):** `--neuer-jeton` ve install yeniden koşusundaki `docker compose up -d api` `--no-deps`'siz — bağımlılıkların config'i sapmışsa (ör. yarım kalmış update) `db`/`kong`'u da yeniden yaratabilir; kurulum ortasında yalnız `api` hedefleniyorsa `up -d --no-deps api` daha dar (DB o noktada zaten okunabilir durumda, `nein` cevabı bunu kanıtlıyor). **→ 07.10 uygulandı: iki yerde `up -d --no-deps api`.** Kapı DB hatasında fail-open (bilinçli, yorumda); o durumda `/test-smtp` yalnız jetona bakar — eski davranış, jeton gerektirir, kabul. Install yeniden koşusunda hijyen başarılı olsa bile ".env existiert" fail'i (exit≠0) basılır — UX, işlev değil. `DISABLE_SIGNUP=true` (`.env.template:193`) olduğu için `/auth/v1/otp` üzerinden kullanıcı yaratma da kapalı; ayrıca Caddy'de kapatmaya gerek yok.

> **07.10.2026 — K2b.7b ölçümü + rate-limit yolu ön kontrolü: GEÇER, KAYITLA (Caddy modülüne geçiş ertelendi, önce GoTrue ikinci ölçüm).** **Ölçüm** (WSL test kutusu `acc51d5`, betik depo dışı `gotrue-messung.sh`): 60 hatalı `POST /auth/v1/token?grant_type=password` → sıfır 429; `GOTRUE_RATE_*` env yok; GoTrue `remote_addr` hep `172.18.0.1` (docker ağ geçidi, `docker-proxy`/userland-proxy açık); sahte `X-Forwarded-For` GoTrue'ya sızmadı (Caddy eziyor); LAN'dan gelen istekte Caddy'nin gerçek IP'yi görüp görmediği **ölçülemedi** (mirrored modda Windows→kendi LAN IP'si 000, O-163). **Ölçüm "GoTrue sınırlamıyor" demez — kaynak koda karşı okundu (`supabase/auth` `v2.189.0` = `.env.template:28`):** `token.go` password/refresh/id_token/pkce grant'ları `limiterOpts.Token` ile `performRateLimiting`'e sokar; `middleware.go:123-133` önce `Sb-Forwarded-For` (`GOTRUE_SECURITY_SB_FORWARDED_FOR_ENABLED`, varsayılan `false`), yoksa `performRateLimitingWithHeader` `:72-78`: **`GOTRUE_RATE_LIMIT_HEADER` boşsa hiç sınırlamaz** (`return nil`). Yani ölçülen şey "başlık ayarlı değil" durumuydu, sonuç koddan beklenendi. Başlık ayarlıysa anahtar başlığın **ilk virgül öncesi değeri** (`:101-104`); `apilimiter.go:197` Token kovası = `GOTRUE_RATE_LIMIT_TOKEN_REFRESH`/300 sn (varsayılan 150/5 dk), **burst sabit 30** (env ile değişmez). **Karar sırası:** (1) GoTrue ikinci ölçüm (ucuz, compose'a 2 sabit satır) → geçerse Caddy modülü **açılmaz**; (2) yalnız GoTrue ölçümü düşerse Caddy modülü. **İkinci ölçüm tarifi:** compose `auth` env'ine sabit `GOTRUE_RATE_LIMIT_HEADER` + `GOTRUE_RATE_LIMIT_TOKEN_REFRESH: "30"` (politika, `.env`'e değil — K2b.12 deseni). Başlık tercihi: Caddy `@supabase` `reverse_proxy kong:8000` içinde `header_up X-Praxura-Client-IP {remote_host}` (Caddy istemciden geleni ezer, Kong dokunmaz) ve `GOTRUE_RATE_LIMIT_HEADER: X-Praxura-Client-IP`; `X-Forwarded-For` de çalışabilir (Caddy ezip yazar, Kong arkasına ekler → ilk değer istemci) ama Kong'un XFF davranışı bu kutuda ölçülmedi, özel başlık o belirsizliği kaldırır. Beklenen: A koşusu ~31. istekte 429; B/C (farklı sahte XFF ve sahte `X-Praxura-Client-IP`) **yine 429** — sahte başlık kovayı sıfırlarsa sınırlama sahtelenebilir demektir → DUR, Caddy yoluna geçilir. Kong→api iç çağrıları (`SUPABASE_URL: http://kong:8000`) başlıksız gelir → GoTrue sınırlamaz (log'da warn) — doğru, backend'in kendi admin çağrıları kovaya girmemeli. **G7:** SaaS'taki Supabase Auth aynı limiter'ı kullanır (panelde "token refresh" limiti) — aynı mekanizma, fork yok. **Caddy modülü yoluna G1/G2/G3/G8 engeli yok** (build-zamanı bağımlılık, tip B benzeri; kutudan dış çağrı yok, sır yok). Açılırsa şartlar: (a) `xcaddy --with github.com/mholt/caddy-ratelimit@<40 hane commit>` — Go bunu pseudo-version'a çözer ve `sum.golang.org` ile doğrular; `GOSUMDB`/`GOPROXY` kapatılmaz, `GOFLAGS=-insecure` yok. xcaddy go.sum'u depoya bıraktırmaz; daha sıkı isteniyorsa kendi `main.go` + `go.mod`/`go.sum` depoda, `go build -mod=readonly` (acmedns de aynı yola alınır, tek yöntem) · (b) CI smoke'a `caddy list-modules | grep -qx 'http.handlers.rate_limit'` (acmedns satırının yanına) · (c) commit hash + tarih Dockerfile yorumunda, `NOTICE-QUELLEN.txt`'e lisansıyla · (d) her `VERSION_CADDY` yükseltmesinde modül derlemesi CI'da kırılırsa yayın durur — sürüm yükseltme kontrol listesine satır · (e) Caddy kuralı yalnız `/auth/v1/token` (+ `recover`, `otp`), anahtar `{remote_host}`. **Tek kova sorunu iki yolda da aynı** (anahtar Caddy'nin gördüğü IP): Linux/Hetzner'de dış trafik iptables DNAT ile gelir, kaynak IP korunur — `docker-proxy` yalnız loopback/hairpin trafiğini taşır; ölçülmedi, K2b.8'de bir dış istekle Caddy log'undaki `remote_ip` bakılır. WSL kutusunda herkes `172.18.0.1` görünürse IP-başı kova = **tek praksis kovası**: LAN içi bir saldırgan (zaten iç ağda) devam ettiği sürece herkesin girişini 429'a sokar, durunca 0,5 istek/sn ile dolar. **`userland-proxy:false` install.sh ile yazılmaz:** `/etc/docker/daemon.json` host-genel ayar (müşterinin başka konteynerleri de etkilenir, mevcut dosya ezilir, dockerd yeniden başlar), Linux'ta zaten gerekmiyor, WSL mirrored modda ise localhost yayınını (`127.0.0.1` hosts girişi, O-163) kırma ihtimali ölçülmemiş. WSL'de tek kova bilinçli kabul edilir ve KURULUM'a yazılır; install.sh ön kontrolüne yalnız **ölçüm + uyarı** (Caddy log'unda LAN cihazından gelen istek `172.18.*` mi). **Sahip:** ikinci ölçüm + `header_up` → K2b.7b (builder); Hetzner IP doğrulaması → K2b.8; WSL tek kova notu → K2b.5 KURULUM. Durum: O-161 `geplant` kalır. **Ölçüm 2 (07.10.2026, test kutusu, Kong'a doğrudan, `auth` geçici env; sonra eski hâle döndü, `GOTRUE_RATE_LIMIT_HEADER` 0 satır doğrulandı):** A 40× `10.0.0.1` → 31. istekte 429 · B `10.0.0.2` → 5×400 (ayrı kova) · C `10.0.0.1` → 5×429 · D başlıksız → 400 (sınırlama yok, iç çağrı davranışı) · E `"10.0.0.1, 9.9.9.9"` → 429 (ilk değer anahtar). Kod okumasıyla birebir. **Karar: GoTrue yolu, Caddy modülü açılmadı** (tedarik zinciri riski hiç doğmadı). Uygulama (commit öncesi): `docker-compose.yml` `auth` → `GOTRUE_RATE_LIMIT_HEADER: X-Praxura-Client-IP` + `GOTRUE_RATE_LIMIT_TOKEN_REFRESH: "30"` sabit · `Caddyfile` `@supabase` → `reverse_proxy kong:8000 { header_up X-Praxura-Client-IP {remote_host} }` (Caddyfile'da tek kong proxy'si, başka giriş yok) · `caddy adapt` geçerli. **Kutu testi (açık, gerçek kutuda):** Caddy **üzerinden** sahte `X-Praxura-Client-IP` gönderen istek kovayı değiştirmemeli (ölçüm 2 Kong'a doğrudan yapıldı, Caddy'nin ezmesi henüz ölçülmedi — test edilmemiş tek halka bu). **Kutu testi ✅ (07.10.2026, WSL test kutusu, geçici mount, sonra eski hâl doğrulandı):** Caddy üzerinden 70× → 31.'de 429; sahte `X-Praxura-Client-IP` (tek ve virgüllü) kovayı değiştirmedi (3×429); `@authgesperrt` aşma varyantları dahil 404, `recover`/`verify`/`settings` açık. **Test talimatı:** Caddyfile imaja gömülü (`frontend.Dockerfile:63`) — kutuda dosyayı değiştirmek etkisizdir; imaj yeniden kurulmadan Caddyfile denemek için compose ekinde geçici `./Caddyfile:/etc/caddy/Caddyfile:ro` mount gerekir, test sonunda kaldırılır.

> **07.10.2026 akşam — merkez VPS açıldı (şart (iv)'ün ilk yarısı):** Hetzner Cloud, **ayrı proje** `praxura-merkez` (S-46 Bed. 8: n8n projesinde değil ✓), fsn1, CX23 (x86, 2 vCPU/4 GB/40 GB), Ubuntu 24.04, IPv4 + IPv6, root yalnız ed25519 anahtar, Hetzner Backups açık, Cloud Firewall inbound 22/80/443/tcp + 53/tcp+udp. Üzerinde henüz hiçbir şey yok; kurulum Kemal'in elinde (Claude bu sprintte VPS'e bağlanmaz), tarif onprem'den (systemd, konteyner yok: merkez `node` + acme-dns v2.0.2 ikili + Caddy, her biri ayrı kullanıcı + ayrı env dosyası — S-46 Bed. 8'in "ayrı konteyner" şartını ayrı systemd birimi + ayrı kullanıcı ile karşılar, `guvenlik` teyidi açık). Adlar (öneri, Kemal onayı bekliyor): `MERKEZ_HOST=merkez.<zone>`, acme-dns `/update` = `acme.<zone>`, acme-dns bölgesi `auth.<zone>` NS → `ns1.<zone>`. **Kurulumda bulunan iki tuzak:** (T1) `merkez.<zone>` için **AAAA kaydı açılmaz** — `/v1/ip` `internet` modu kaynak IP'yi A kaydına yazar ve yalnız IPv4 kabul eder (`merkez/ip.js:1`, `server.js:203`); IPv6'yla gelen Hetzner kutusu 400 `ip_nicht_oeffentlich` alır. (T2) `admin.js` root olarak koşturulursa SQLite WAL/shm dosyaları root'a geçer → servis yazamaz; admin yalnız `merkez` kullanıcısıyla (sarmalayıcı). Builder adayları (açık): merkezde `GET /health` yok (izleme kör), `admin.js` aktörü `os.userInfo()` → sudo altında hep `merkez` yazar (S-46 Bed. 6 append-only log'u kimin yaptığını kaybeder; `SUDO_USER` önceliği), `[ALARM]` satırı yalnız journal'a düşüyor — kimse görmez. **Durum değişmez: `geplant`** — kurulum + uçtan uca ilk gerçek kayıt (K2b.9 test kutusu) bitince (iv) kapanır.

> **07.10.2026 gece — Kemal kararları + sertleştirme bitti:** (1) `BOX_DOMAIN=box.praxura.de` — kutu adı `kelime-kelime-NN.box.praxura.de`, ilk gerçek kutudan sonra kalıcı (CT + mezar taşı). Zone yine `praxura.de` (Cloudflare alt-zone Enterprise ister; gerek de yok): kayıtlar zone içinde tam adla yazılıyor (`merkez/server.js:33` `${name}.${boxDomain}`, `cloudflare.js` `name`=FQDN), `box.praxura.de` için ayrı kayıt gerekmez; CAA `<ad>.box.praxura.de`'de bulunur, apex'e çıkılmaz; `_acme-challenge.<ad>.box.praxura.de` CNAME → `<uuid>.auth.praxura.de` değişmez. **Kod değişikliği yok.** Kutu tarafında `BOX_DOMAIN` yok — ad merkezin `/v1/vorschlag`/`register` cevabındaki `fqdn`'den gelir, `SITE_URL` ondan yazılır; `merkez-istemci`/`install.sh`/ps1'de `praxura.de` = 0. Değişecek yalnız belge örneği: `onprem/KURULUM.md:245` ve `:331` (`sonne-tal-42.praxura.de` → `.box.praxura.de`, builder). K2b.1 deneme kaydı `praxis-test.praxura.de` (A) Cloudflare'dan silinir. A-21 yarıçapı değişmez (jeton yine bütün zone'a yazar). (2) Alt adlar: `merkez` / `acme` / `ns1` / `auth` (NS→`ns1`), hepsi gri, `merkez` için AAAA yok (T1). (3) Hetzner Backups açık, jetonlu disk yedeği kabul edilmiş risk (`guvenlik` S-51). (4) Dış izleme ertelendi (Kemal) — merkez düşerse bugün kimse fark etmez, açık. **Yapıldı (Kemal onayıyla, adım adım doğrulandı):** ayrı yönetici kullanıcı (yalnız anahtar), sshd root/parola/klavye-etkileşimli kapalı + kullanıcı beyaz listesi, journald 300M, unattended-upgrades + 05:30 yeniden başlatma, NTP senkron, 53 yalnız resolved'un loopback adreslerinde (acme-dns genel IP'ye bağlanabilir). Erişim ayrıntısı: `INFRASTRUCTURE.md` §2b (gitignore'lu). Sıradaki: Node + merkez kodu, acme-dns, Caddy, DNS kayıtları. Durum: `geplant`.

> **07.10.2026 gece — merkez canlı, şart (iv) "merkez VPS'te dağıtım" karşılandı (ilk uçtan uca kayıt).** Kurulu ve ölçüldü: acme-dns 2.0.2 (sha256 doğrulandı; DNS yalnız genel IPv4:53, API loopback; dışarıdan `auth` bölgesine yetkili cevap, rekürsiyon yok — google.com çözülmüyor) · Caddy 2.11.7 (access log kapalı; merkez + acme için LE sertifikası) · merkez systemd birimi (ayrı servis kullanıcısı, `ProtectSystem=strict`) · Cloudflare jetonu Kemal girdi (doğrulama 200; argv/kabuk geçmişine düşmeyen yardımcı) · cron SQLite yedeği. Dış kabul: acme `/health` 200, `/register` 404, imzasız `/v1/vorschlag` 401. **E2E:** `kod-neu` → PC'den `kayit.js` (`MERKEZ_URL`) → `salat-kuchen-56.box.praxura.de` A (özel IP) + `_acme-challenge` CNAME → `<uuid>.auth.praxura.de`; `/v1/ip` ok; acme-dns `/update` 200, TXT genel çözücüden okundu; sonra `iptal` + `adresse-loeschen` → yetkili DNS'te NXDOMAIN (K9 iki adımlı silme sahada çalıştı). Erişim: `INFRASTRUCTURE.md` §2b. **onprem tarifindeki hata (düzeltildi `a5b412ba`):** "sparse yalnız `merkez/`" yanlıştı — `merkez/server.js`/`admin.js` `api-backend/routes/mitarbeiter-zugang-code.js` ve `api-backend/merkez-istemci/signatur.js`'i import ediyor, `ERR_MODULE_NOT_FOUND`. Desen genişletildi (`--no-cone`; cone modu kök dosyalarını da çekiyordu), `merkez/README.md`'ye yazıldı. **Sonucu:** merkez ↔ kutu imza kodu tek dosya (iyi — G7, iki imza uygulaması yok), ama `signatur.js`'e dokunan her commit **iki yere** dağıtılır: kutuya image ile, merkeze elle `git checkout`. Merkez commit'i geride kalırsa imza uyuşmazlığı → tüm kutularda 401. Kural: `signatur.js` değişikliği önce merkeze, sonra image'a; geriye uyumsuz biçim değişikliği `praxura-v2` önekiyle. **Ölçülmedi (açık):** CAA (deneme kutusu silindi, sorgu yapılamadı) · gerçek kutu sertifikası (acmedns modüllü Caddy imajı + kutuda `MERKEZ_URL`) → K2b.4b/K2b.3 kabulü. Durum: **`geplant` kalır** — (iv) ✅, kalan: K2b.4b accounturi + CAA ölçümü, gerçek kutuda LE sertifikası, dış izleme (ertelendi), KURULUM örnek adları (`.box.`).

> **08.10.2026 — K2b.3 gerçek kutu ölçümü (WSL test kutusu, commit öncesi bildirim): kod → merkez → `hafer-turm-9.box.praxura.de` kaydı ✅, gerçek LE sertifikası (YE2, notAfter 06.01.2027) ✅.** Üç düzeltme, onprem hükmü **GEÇER, KAYITLA**: (1) `onprem/Caddyfile` `tls_acmedns`: `propagation_delay 20s` + `propagation_timeout -1` — certmagic'in kendi yayılım kontrolü CNAME→acme-dns zincirinde hep zaman aşımına düşüyordu; acme-dns yetkili ve anında yazdığı için kontrolü kapatmak güvenli, doğrulamayı LE yapıyor. Image yoluyla gider (frontend imajı, workflow `paths` kapsıyor) — G7 temiz, `klassisch` modu etkilenmez. (2) `install.sh` adım 15: acmedns'te anahtar testinden önce ≤5 dk TLS beklemesi, gelmezse net fail — yarım kutu (timer/GESICHERT yok) önlenir ✓. (3) `--neu`: `NEU_BESTAETIGT=1` + kendi caddy'si çalışıyor + portu tutan `docker-proxy` → port kontrolü atlanır ✓ (şart: yalnız **bu compose projesinin** konteyneri; başka konteyner 80/443 tutuyorsa yine düşmeli). **Yeni bulgu (açık, K2b.4b'den önce karar):** K3 gereği `--neu` `caddy_data`'yı siliyor ama ad (kimlik) duruyor → her `--neu` aynı ad için **yeni LE hesabı + yeni sertifika**. (a) LE "duplicate certificate" sınırı (aynı ad kümesi 5/hafta) test kutusunda ve destek senaryosunda dolar → kutu 168 saate kadar sertifikasız (HSTS 86400 ile birleşince O-172). (b) K2b.4b CAA `accounturi` hesaba bağlanınca `--neu` sonrası yeni hesap CAA'ya takılır → yenileme de, ilk sertifika da reddedilir, ta ki kutu `/v1/caa`'yı yeniden yazana kadar (sıra: hesap oluştu → CAA güncelle → sertifika; K2b.4b testi). Öneri: acmedns modunda `--neu` `caddy_data`'yı **korur** (sertifika + LE hesap anahtarı kimlikle aynı sınıf: yedek dışı, kutuya bağlı; S-47 Bed. 1 yalnız yedek/restore'u kapsıyor, `--neu` silmesini değil — `guvenlik` teyidi) ya da testlerde LE staging. Not: `read -s` TCSAFLUSH pipe girdisini siliyor → otomatik kurulum yalnız `expect` ile; ürün sorunu değil. Durum: `geplant` — tam `--neu` turu sonucu bekleniyor.

> **08.10.2026 — `--neu` yeni bulgusu kapandı (`99ada660`, guvenlik S-47 Nachtrag "KORU"):** `KAYIT_MODUS != adresse` iken `--neu` yalnız `db-config` + `caddy_config` siler, `caddy_data` (sertifika + LE hesap anahtarı) kalır → aynı ad için yeni hesap/sertifika yok, K2b.4b `accounturi` `--neu`'dan sonra da geçerli kalır. Port atlaması onprem şartıyla: yalnız `docker compose port caddy $port` bu projeyi gösterirse. WSL ölçümü: ikinci `--neu` rc 0, logda "Port 80/443 gehört der laufenden Box" + "caddy_data bleibt", sertifika seri no değişmedi, yeni LE sertifikası çıkmadı (`hafer-turm-9` bu hafta 2/5). Açık not: test kutusunda yeni Caddyfile override ile mount'lu — frontend imajı CI'da yeniden basılıp override kaldırılınca imajdaki Caddyfile ile bir tur daha doğrulanmalı. Durum: `geplant` (K2b.4b CAA/accounturi kaldı).

> **08.10.2026 — K2b.4b (CAA `accounturi`) ön kontrolü: GEÇER, KAYITLA — karar.** Tip A (mevcut O-161 (2) zinciri, yeni host yok) + F (mevcut IP timer'ına adım). G1/G2/G3/G8 temiz. **Kim okur:** `api` konteyneri `caddy_data`'yı **görmez** — yeni mount yok (o volume LE hesap + sertifika özel anahtarlarını taşır; PHI'ye dokunan, internete açık sürece anahtar okuma hakkı verilmez; S-47 Bed. 7 "yalnız `location`, `.key` asla"). Host tarafı `ip-melden.sh` (systemd, 2 dk) `docker compose exec -T caddy cat /data/caddy/acme/acme-v02.api.letsencrypt.org-directory/users/*/*.json`'dan **yalnız** `location`'ı çıkarır, prod regex'iyle süzer (`^https://acme-v02\.api\.letsencrypt\.org/acme/acct/[0-9]+$`), `volumes/ip/le-konto`'ya atomik (tmp+mv, 0644) yazar — `api` o dizini zaten `:ro` mount ediyor (L5). Birden çok hesap dosyası / staging dizini / regex dışı → yazma, log uyarısı. `api` (`ip-abgleich.js`, aynı 60 sn tick) dosya son başarıyla gönderilenden farklıysa imzalı `/v1/caa` atar; açılışta bir kez gönderir (merkez değeri bilmiyoruz, istek ucuz), değişmezse istek yok; hata davranışı L8 ile aynı. **Merkez üzerine yazar, iki `issue` satırı yok:** eski hesabı yetkili bırakmak (ör. çalınmış `caddy_data`) accounturi'nin tek amacını boşa çıkarır; `setze()` zaten tek kaydı değiştiriyor, merkez prod önekini zaten zorluyor (`merkez/server.js:222`) → staging hesabı CAA'ya giremez. **Kilitlenme yok, kendini onarır:** Caddy hesabı sipariş öncesi kaydeder (`default.json` siparişten önce yazılır) → yeni hesap CAA'ya takılır → ≤2 dk timer + ≤60 sn api + CAA TTL 600 → Caddy'nin sonraki denemesi geçer (en kötü ~15 dk). Bu yol yalnız `caddy_data` kaybında koşar (`--neu` artık korur, `99ada660`); o anda eski sertifika da yok, yani ek kayıp yok. Merkez kapalıysa sertifika merkez dönene kadar gelmez — O-161 (2) ile aynı bağımlılık, yeni risk değil. Sıra: ilk kurulumda `register` CAA'yı accounturi'siz yazar (bugünkü gibi), hesap oluşunca timer bağlar — "sertifikadan sonra" şartı gerekmez, "hesap dosyası var" yeter. **Eski kutuya varış:** `ip-melden.sh` (bundle + manifest, L4 dört liste) + `api` imajı; `update.sh` L10 ile timer zaten kurulu → yeni mount/servis yok, `onprem_image` değişmez. Test: hesap yok / staging / iki hesap / regex dışı → istek yok; değişince tek istek; `MERKEZ_URL` boş → hiçbir şey (SaaS, G7). Kabul: test kutusunda `dig CAA` → `accounturi=` görünür, `caddy_data` silinip yeniden kurulunca yeni hesapla ≤15 dk'da sertifika.

> **08.10.2026 — K2b.4b uygulandı (`ca95492f`; merkez VPS önce aynı commit'e alındı — "önce merkez" kuralı tuttu):** test kutusunda `/v1/caa` → 200, CAA `issue "letsencrypt.org; validationmethods=dns-01; accounturi=…/acme/acct/<n>"`, ikinci gönderim `unveraendert`. **Bulgu: `MERKEZ_URL` hiçbir kutunun `api` konteynerinde dolu değildi** — K5 kararı (değer yalnız `.env.template`'te, install yazmaz) şablonu boş bıraktığı için K2b.6 IP eşitleme ve CAA eşitleme **hiçbir kutuda koşmuyordu**; G7 kapısı (boş = SaaS davranışı) bunu sessizce örttü, E2E testleri `MERKEZ_URL`'yi elle export ettiği için yakalamadı. Düzeltme (onprem: **itiraz yok**): `.env.template` `MERKEZ_URL=https://merkez.praxura.de` — config, kod değil (K6: şablon sayılmaz, `merkez-istemci` sayacı 0 kalır); eski kutulara J4 ile gelir (taban boş + müşteri boş → yeni değer). Kod yolu dışında kurulmuş kutu (K2b.8 çıkış yolu) etkilenmez: kimlikte `ad` yoksa `ip-abgleich.js:71` sessizce döner. SaaS etkilenmez (şablon yalnız kutuda). **Şart (builder):** yapı testi — şablonda `MERKEZ_URL` boş değil ve `https://` ile başlıyor; bir dahaki "değer boş kaldı" sessizce geçmesin. Sırada: yeni `api` imajıyla `caddy_data` silinip ≤15 dk kendini onarma ölçümü (K2b.4b kabulü). Durum: `geplant`.

> **08.10.2026 — K2b.4b kabulü ✅ ölçüldü (`1d53596e`, bu düzeltmeyle):** `caddy_data` silindi → yeni LE hesabı 30 sn'de `le-konto`'da, CAA ~90 sn'de yeni hesaba bağlandı (gerçek timer + `ca95492f` api imajı). **onprem varsayımı yanlıştı:** "kilitlenme yok, Caddy'nin sonraki denemesi geçer" demiştim — certmagic ilk başarısızlıktan (CAA 403) sonra yeniden denemeleri **LE staging**'e yapıyor; staging hesabı CAA `accounturi`'ye hiç giremez (merkez prod önekini zorluyor) → sonsuz döngü, kutu sertifikasız. Düzeltme: `onprem/Caddyfile` `tls_acmedns` issuer'a `test_dir https://acme-v02.api.letsencrypt.org/directory` (yeniden denemeler de prod) → override ile sertifika 40 sn'de; yapı testi staging'i yasaklıyor. **Bedeli (kabul):** yeniden denemeler artık prod sınırlarına sayılır (LE başarısız doğrulama sınırı hesap+ad başına saatlik); merkez uzun süre kapalıyken ve hesap yeniyken kutu bu sınıra takılabilir, certmagic geri çekilmesi bunu yumuşatır — O-172 izlemesinin (notAfter alarmı) kapsamına girer. Ders: Caddy/certmagic'in örtük geri dönüş davranışı (staging, ZeroSSL) varsayılmaz, ölçülür. `hafer-turm-9` bu hafta 3/5. Test kutusu frontend imajı yeniden basılana kadar override'lı — imajla bir tur daha (önceki madde ile aynı açık). Durum: `geplant` — K2b.4b ✅; kalan: imajdan doğrulama, dış izleme (ertelendi), KURULUM örnek adları.

### O-162 — İnternet kesilince praksis içinde ad çözülmeyebilir: kutu LAN'da ayakta, cihazlar adresi bulamıyor 🟡 **kısmen gelöst (08.10.2026, `aa2f4d22`) — kalan: router serve-stale ölçümü KHS §5b T16**

| Alan | İçerik |
|---|---|
| **Ne** | `praxis-XXXX.praxura.de` genel DNS'te durur. Cihaz adı router üzerinden internetten çözer. İnternet kesilince TTL dolduğunda çözüm durur |
| **Nerede** | K-18 modelinin kendisi · ölçüm görevi `KUTU_HAZIRLIK_SPRINT.md` K2b.9 |
| **Tip** | G (kutu internete bağımlı hale gelir) |
| **Kutuda ne olur** | Eski modelde (router DNS / hosts) kutu internetsiz çalışırdı. Yeni modelde internet kesintisi → TTL + cihaz önbelleği dolunca tablet/telefon "adres bulunamadı" der, kutu ayakta olsa bile praksis hasta dosyasını açamaz. Ölçülmedi |
| **Çözüm** | K2b.9 ölçümü: Speedport + FRITZ!Box'ta internet kesikken önbellek ne kadar dayanıyor. Gerekirse: uzun TTL (iç IP nadiren değişir) + router'da yerel kayıt imkânı olan yerde aynı adın yerel kaydı (FRITZ!Box yapabilir, Speedport yapamaz) + kılavuzda acil yol (kutu PC'sinde `localhost`) |
| **Durum** | `geplant` (K2b.9) · **K2b.1 ölçümü (05.10.2026):** Telekom Speedport Smart 2 `praxis-test.praxura.de` → `192.168.2.111` cevabını **düşürmedi** (`nslookup … 192.168.2.1`), telefon router DNS'i üzerinden çözdü — rebind engeli yok. İnternet kesintisi ölçümü hâlâ açık (K2b.9) · **K2b.9 ön kontrol (08.10.2026, kısım 1 — ölçüm + karar, kod yok):** Ölçüm (Speedport, Windows istemci): `merkez/server.js:26` `DNS_TTL = 600`; 1.1.1.1 → TTL 600, router (192.168.2.1) → 546 geri sayıyor, Windows önbelleği 545 → zincir **düz TTL önbelleği**, serve-stale görülmedi (internet kesmeden ölçülemez → KHS §5b Kemal testi: Speedport + FRITZ!Box, kesinti 15/60 dk, önceden çözmüş + yeni açılmış cihaz). **Karar önerisi:** (T1) A kaydı TTL **600 → 3600**; `_acme-challenge` CNAME **ayrılır ve 600'de kalır** (yalnız LE doğrulayıcısı okur, LAN kesintisiyle ilgisi yok; değiştirmek fayda getirmez) → `server.js`'te iki sabit (`DNS_TTL_A`, `DNS_TTL_CNAME`), `/v1/ip` cevabındaki `ttl` A'nınki. Gerekçe: 3600 ile son 1 saatte uygulamayı açmış her cihaz kısa (Telekom tipik) kesintileri atlatır; bedeli IP değişiminde en kötü bayatlık 2+1+60 ≈ **63 dk** (O-161 L7'nin ≤15 dk bütçesi bilinçli gevşer — bu bir sprint ölçütü, K/G değil; Kemal'e bildirilir). **86400 önerilmez (şimdilik):** router değişimi = alt ağ değişimi (Speedport 192.168.2.x ↔ FRITZ!Box 192.168.178.x) → praksis internet varken bile bir gün kilitli kalır, çaresi router + tüm cihazları yeniden başlatmak = destek çağrısı; ayrıca hiçbir TTL **yeni açılan/önbelleği boş** cihazı kurtarmaz, yani 86400'ün ek kazancı yalnız "dün açılmış, bugün açılmamış" cihaz. §5b ölçümü router'ın serve-stale yaptığını gösterirse TTL'in önemi zaten düşer; yapmadığını gösterirse 86400 ancak (T2) zorunlu hale geldikten sonra yeniden konuşulur. (T2) **DHCP rezervasyonu kod yolunun ana akışına girer** — bugün yalnız çıkış yolunda (`KURULUM.md:359`, `:573`); uzun TTL'in ön şartı. (T3) **Çözüm sütunundaki "FRITZ!Box yerel kayıt yapabilir" düzeltilir:** FRITZ!OS keyfi ad için A kaydı sunmuyor, yalnız `<gerät>.fritz.box` — sertifikadaki `*.box.praxura.de` adıyla eşleşmez, bu yol **widerlegt**. (T4) Reddedilen seçenekler: kutunun kendi DNS'i (praksisin bütün DNS'i kutuya bağlanır, kutu/WSL kapalı = praksis interneti kapalı; G-ihlali değil ama invazif ve destek yükü — v1'de hayır) · istemci hosts (iOS/Android'de yok, IP değişince sessiz kırılır — yalnız Windows kutu PC'sinde, O-163). (T5) Kılavuz §„Verhalten bei Internetausfall": "Messung folgt" yerine ölçülen sonuç + çare sırası: cihazı **kapatmayın/yeniden başlatmayın** (önbellek kaybolur) → kutu PC'sinde aç (hosts) → router'da LTE-yedek varsa o. **Korkuluk:** G1 temiz (A kaydı yalnız özel IP, hasta verisi yok), G2 temiz (Cloudflare jetonu merkezde), G3/G8 temiz (yeni zincir yok, mevcut kaydın parametresi). **Dağıtım:** yalnız merkez sabiti → yalnız VPS deploy, kutu imajı gerekmez (istemci `ttl`'i okumuyor — `ip-abgleich.js` kullanmıyor). **Mevcut kayıtlar:** `unveraendert` (`server.js:208`) yalnız IP + 6 saat penceresine bakar, TTL'e bakmaz; istemci 6 saatte bir yeniden gönderir (`ip-abgleich.js:12/116`) → pencere dolunca `setzeA` PUT'u yeni TTL'i yazar. Mevcut kutu (hafer-turm-9) en geç ~6 saat (+ 60 sn tick) içinde kendiliğinden 3600'e geçer, takılı kalmaz; acil gerekmez. `_acme-challenge` CNAME yalnız `/v1/register`'da yazılıyor (`:151`) — 600'de kalacağı için önemsiz. `merkez/test/cloudflare.test.js:30` `cloudflare.js`'in varsayılanını (600) test ediyor, `server.js` sabitinden bağımsız — kırılmaz; `/v1/ip` testine `ttl: 3600` beklentisi eklenmeli. Durum değişmez: `geplant` (K2b.9 — T1/T2/T5 builder, §5b ölçümü Kemal) · **K2b.9 kısım 2 (08.10.2026, uygulandı):** T1 `merkez/server.js` `DNS_TTL_A = 3600` / `DNS_TTL_CNAME = 600`, test `server.test.js` (A 3600 + CNAME 600 beklentisi), `test:merkez` 49/49; T2 + T5 `KURULUM.md` 0.4.1 §3 (DHCP-Reservierung ana akışta, Routertausch → cihazları yeniden başlat; Internetausfall çare sırası). **Kutu internetsiz ölçüldü** (WSL test kutusu, iptables ile dış trafik + DNS kesildi, sonra geri açıldı, zincir 0/0 doğrulandı): `/` 302, `/dashboard.html` 200, `/auth/v1/health` 200 internetsiz ve internetsiz `restart caddy api` sonrası da aynı; Caddy log'unda ACME/OCSP hatası yok; sayfalarda yüklenen dış kaynak yok (yalnız `href` dış linkler). Router serve-stale testi KHS §5b T16. Durum: `geplant` → kod kısmı bitti, T16 bekliyor · **08.10.2026 (K2b.10, onprem sicil turu):** `geplant`→🟡 `kısmen gelöst`. `aa2f4d22` doğrulandı (TTL A 3600 / CNAME 600, merkez deploy; KURULUM 0.4.1 DHCP rezervasyonu + Internetausfall). Kutu internetsiz ölçüldü. Kalan tek iş KHS §5b T16 (Speedport + FRITZ!Box serve-stale); sonucu TTL kararını ya teyit eder ya yeniden açar |

### O-163 — Windows kutusu: PC kendi LAN IP'sine bağlanamıyor (mirrored WSL), hosts'ta `127.0.0.1` gerekiyor 🟡 **kısmen gelöst (kod `1a0147a9`, bugün `installieren/install.ps1:430-445`) — kalan: gerçek Windows'ta PC'nin kendisinden açma ölçümü (KHS §5b T17 b)**

| Alan | İçerik |
|---|---|
| **Ne** | Mirrored ağ modunda Windows host kendi LAN IP'sine giden bağlantıyı WSL'deki Caddy'ye ulaştırmıyor. Ad iç IP'yi gösterdiğinde kutu PC'sinin kendisi adresi açamıyor |
| **Nerede** | `onprem/windows/praxura-installieren.ps1` (adım 9 bugün hosts + kök sertifika yazıyor; K2b.5'te sertifika kısmı kalkar) |
| **Tip** | G (Windows'a özgü dağıtım farkı) |
| **Kutuda ne olur** | Einzelplatz kurulumda (tek PC) kullanıcı kutuyu tam o PC'den açmaya çalışır ve açamaz. Diğer cihazlar sorunsuz. Gerçek sertifika ada bağlı olduğu için hosts'ta `127.0.0.1 praxis-XXXX.praxura.de` sertifikayı bozmaz — geçici çözüm kalıcı çözüme dönüşebilir |
| **Çözüm** | K2b.5: başlatıcı kendi adını hosts'a `127.0.0.1` olarak yazar (bugünkü adım 9'un sertifikasız hali), alternatif olarak WSL hairpin ayarı denenir. IP değişikliğinden etkilenmez (O-161 (3) yalnız DNS'i günceller) |
| **Durum** | `geplant` (K2b.5) · **K2b.1 (05.10.2026):** gerçek sertifika ada bağlı, iç IP'ye değil — kutu içinden `--resolve …:127.0.0.1` ile doğrulama geçti (`ssl_verify_result=0`), yani hosts'ta `127.0.0.1` gerçek sertifikayı bozmuyor; K2b.5 çözümü ölçümle desteklendi · **06.10.2026 ön kontrol:** başlatıcı zaten `install.sh`'ı WSL'de çağırıyor (`praxura-installieren.ps1:262`), adı `.env` `SITE_URL`'den okuyor (`:267-269`), adım 9 hosts satırını koşulsuz, kök sertifikayı yalnız `CADDY_TLS_ARG=internal`'da yazıyor (`:321-340`). K2b.5'te değişen yalnız adım 6'nın yönlendirme metni (adres yerine kod). Açık: yeniden kurulumda eski adın hosts satırı kalıyor (`# Praxura Box` işaretli satır değiştirilmeli, eklenmemeli) · **K2b.5b bitti (06.10.2026, commit bekliyor):** adım 9 artık bütün eski `# Praxura Box` hosts satırlarını süzüp tek `127.0.0.1 <ad>` satırı yazıyor (`praxura-installieren.ps1:335-349`), ANSI kodlama korunuyor (geçici dosyada denendi), BOM korundu; adım 6 metni kod öncelikli. Önceki açık ("eski adın satırı kalıyor") kod tarafında kapandı. **Açık:** gerçek Windows + mirrored WSL'de PC'nin kendisinden açma ölçülmedi; kök sertifika dalı `CADDY_TLS_ARG=internal`'a bağlı kalıyor, K2b.4'te kendiliğinden ölür. Gerçek kutuda doğrulanınca + commit ile `gelöst` · **08.10.2026 (K2b.10, onprem sicil turu):** `geplant`→🟡 `kısmen gelöst`. Kod `1a0147a9`'da girdi, K2b.14 ile `installieren/install.ps1:430-445`'e taşındı: bütün `# Praxura Box` satırları süzülüp tek `127.0.0.1 <ad>` yazılıyor. Kalan: gerçek Windows + mirrored WSL'de kutu PC'sinin kendi adını tarayıcıda açması **ölçülmedi** (K2b.3 ölçümleri WSL içinden). En ucuz yer KHS §5b T17 (b): temiz Windows kurulumunun sonunda ps1'in açtığı tarayıcı sayfası bu ölçümün kendisidir — T17 (b) listesine bu cümle eklenmeli (koordinatöre bildirildi) |

### O-164 — Boş Windows şifresinde kutu açılışta değil, yalnız oturum açınca kalkıyor ✅ **gelöst (`293ac5be`, 07.10.2026)**

| Alan | İçerik |
|---|---|
| **Ne** | Autostart görevi şifresiz hesapta "oturum açmadan çalıştır" kipine geçemiyor. Fallback (oturum açınca başlat) 04.10'da çalıştı |
| **Nerede** | `onprem/windows/praxura-installieren.ps1` (Autostart adımı) |
| **Tip** | F (zamanlanmış iş/başlatma) |
| **Kutuda ne olur** | PC açılır ama kimse oturum açmazsa kutu yok. Tabletler randevu ekranını açamaz, gece `backup.sh`/`update.sh` koşmaz (O-158 ile birlikte Windows kutusunun ikinci gece-işi körlüğü) |
| **Çözüm** | K2b.8 kılavuzu: Box-PC hesabına Windows şifresi konur (yoksa sınır açık yazılır: "kutu yalnız oturum açıkken çalışır"). Betik şifresiz hesabı saptayıp uyarı basar. Kod gerekmeden kapanabilir |
| **Durum** | `geplant` (K2b.8) · **08.10.2026 (K2b.10, onprem sicil turu):** `geplant`→✅ `gelöst`. Kod: `installieren/install.ps1:378-385` şifreyi `Get-Credential` ile ister, kayıt başarısızsa (boş şifre) uyarı basıp oturum-açınca-başlat'a düşer (`ebe318cc`'den beri). Belge: KURULUM 0.4.0 (`293ac5be`) adım 6 şifre sorusu + şifre değişince betiği yeniden çalıştır (`KURULUM.md:76-80`, `:790`) ve §Grenzen "Windows-Passwort zwingend" — şifresizken kutu, gece yedeği (01:00) ve güncellemesi (02:00) yalnız oturum açıkken koşar (`:101-104`). Çözüm sütununun "kod gerekmeden kapanabilir" öngörüsü tuttu |

### O-165 — Playbook K-18 ile çelişiyor: K1 (iki SKU) düştü, §393 cümlesi ve K12 sponsorlu Hetzner dönemi yeniden yazılmalı ✅ **gelöst (08.10.2026, K2b.10)**

| Alan | İçerik |
|---|---|
| **Ne** | Kurucu kararı 04.10.2026: SaaS satılmaz. Playbook hâlâ eski durumu yazıyor: (1) K1 "iki SKU", (2) satır 28 "§393 uygulanmaz", ama Hetzner varyantında veri praksisin **bulut** sunucusunda durur ve §393 praksis için tetiklenebilir, (3) K12 aşama 2: sponsorlu Hetzner instance'ları **bizim** hesabımızda olursa hasta verisi bizim bulut sözleşmemizde durur — bu Auftragsverarbeiter + §393'e geri giriş, yani K6'nın kapattığı kapı |
| **Nerede** | `ONPREM_MIGRATION_PLAYBOOK.md:28` · `:42` (K1) · `:53` (K12) |
| **Tip** | G (merkez/kutu sınırı) — playbook sapması |
| **Kutuda ne olur** | Kod etkisi yok. Belge etkisi var: playbook'u okuyan biri SaaS'ın yaşadığını ve Hetzner kutusunun §393 dışı olduğunu sanır. K12-2 olduğu gibi uygulanırsa beta kutuları G1 çizgisini bizim hesabımızda aşar |
| **Çözüm** | K2b.10: playbook düzeltmesi + `legal-de` notu (Hetzner C5 Typ-2'nin Cloud Server'ı kapsayıp kapsamadığı K2b.9'da ölçülür; K12 sponsorlu dönemde sunucu ya praksisin hesabında olur ve biz yalnız ödemeyi üstleniriz, ya AVV). Kilitli kararlar bu sicilde açılmaz — K1 kurucu kararıyla zaten düştü, K12 için karar Kemal'in |
| **Durum** | `geplant` (K2b.10) — **05.10 öğle, K-19 (k)(l) = C7 kararı:** beta kutuları praksisin **kendi** Hetzner hesabında ya da kendi PC'sinde; bizim hesapta sponsorlu instance yok. (3) numaralı G1 riski bununla karar düzeyinde kapandı. `app.praxura.de` depo bölme günü kapanır (sprint sonu, Kemal'in kendi kutu testinden sonra, betalardan önce). Kalan iş yalnız belge: playbook K1/K12/satır 28 metni (K2b.10). ⚠️ Bölme günü notu: `supabase-config.js:22`'deki SaaS yedeği ve `api/config.js` o gün ölü koda döner — silinirken `tools/.onprem-baseline` `n8n_host`/`app_host` tabanları birlikte düşer · **08.10.2026 (K2b.10, onprem sicil turu):** `geplant`→🟡 `kısmen gelöst`. Çalışma ağacındaki playbook okundu: satır 28 §393 notu (07.10) ✅ · K1 → tek ürün = kutu, SaaS satılmaz, eski metin üstü çizili ✅ · K12 → K-19 (k), sponsorlu instance bizim hesapta yok ✅ · 5.3 aynı ✅. **İki satır kaçmış:** `ONPREM_MIGRATION_PLAYBOOK.md:289` Faz 5 kabul kriteri "gerçek beta müşterisi **sponsor instance**'da 2 hafta" ve `:324` maliyet tablosu "Biz \| Beta sponsor sunucuları (geçici) \| ~€6 × müşteri" — ikisi de K12'nin eski hâli; okuyan sponsor dönemini hâlâ plan sanır. Düzeltme: `:289` → "praksisin kendi kutusunda", `:324` satırı üstü çizilir (iade/indirim istenirse ayrı satır, sözleşme praksiste). Bu iki satır + commit → `gelöst`. Yan not (O-165 kapsamı dışı, K4 artığı): aynı tabloda `:322` "IONOS AI kullanımı" K-20'den beri yanlış · **→ `gelöst` (08.10.2026, Claude):** `:289` Faz 5 kabul kriteri "kendi kutusunda (kendi PC/kendi Hetzner, K12)" ve `:324` maliyet satırı "yok — praksisin kendi hesabı" düzeltildi; ayrıca `:322` KI satırı K4/K-20'ye (Azure + jeton) çekildi, `:323` fiyat "henüz belirlenmedi" (10.09 kararı). Playbook'ta "sponsor" yalnız üstü çizili geçmişte kalıyor |

---

## 7AA — Konsey 05.10.2026: merkezi "Praxura servisi" (online termin postakutusu · KI relay · km) — onprem görüşü

> Kaynak: konsey turu 05.10.2026 (K-19 / K2b.11-16 adayları). Bu bölüm yalnız sicil tarafını tutar; karar tutanakta.

### O-166 — Online termin + reçete ön elemesi için merkezde şifreli postakutusu 🟡 **offen (karar bekliyor)**

| Alan | İçerik |
|---|---|
| **Ne** | Hasta formu + isteğe bağlı reçete fotoğrafı tarayıcıda praksisin açık anahtarıyla şifrelenir, merkezde yalnız chiffrat durur, kutu çeker (yalnız giden bağlantı) |
| **Nerede** | Planlı: `merkez/` + kutuda çekme işi (tip F) · O-155'in kalan yarısını kapatır |
| **Tip** | A + F + G |
| **Kutuda ne olur** | Chiffrat + metadata (praksis kimliği, zaman, IP) bizden geçer → **G1'in bilinçli istisnası**, Kemal kararıyla kayda geçmeli (legal-de: dar AV, Portal-AVV). Asıl açık: formu sunan JS'i biz sunuyoruz; JS değişirse şifreleme öncesi düz metin alınabilir — SRI + parmak izi bunu azaltır, sıfırlamaz. Merkez düşerse: yeni talep gelmez, kutu içi her şey çalışır. Biz kalkarsak: özellik ölür → O-155 bayrağıyla "bitte Praxis anrufen" metnine düşmeli |
| **Çözüm** | Şartlar: URL env'den (tip C yok) · varsayılan KAPALI bayrak · degrade yolu K3'ten önce yazılı · merkez n8n VPS'inde DEĞİL (O-159, 2vCPU/3.7GB swapsız) — `merkez/` ayrı küçük VPS'te ad servisi ile birlikte · n8n workflow'u olarak yazılmaz (G3/G8) · teslimde silme + IP ≤7 gün kodda zorlanır |
| **Durum** | `offen` — Kemal kararı + K2b görev no. bekliyor |

### O-167 — KI relay: maskeli metin merkeze, bizim Azure anahtarı ile ⚪ **widerlegt (05.10.2026 — konsey reddetti, yerine K-20 / O-169)**

| Alan | İçerik |
|---|---|
| **Ne** | Kutuda M4 maskeleme → maskeli metin merkeze → Azure → cevap kutuda geri çevrilir. Reçete görüntüsü hariç |
| **Tip** | A + E + G |
| **Kutuda ne olur** | G2 açısından iyi (bizim anahtar kutuya girmez). Ama maskeli metin pseudonim kişisel veri: K6 + 09-28 konsey "merkezi gateway kapalı" kararlarını açar; bu sicil açamaz. Maskelemenin kaçırdığı her alan doğrudan G1 ihlali olur. Merkez düşerse/biz kalkarsak: KI ölür → BYO-key (O-151 env sözleşmesi) ya da KI kapalı yoluna düşmeli |
| **Çözüm** | Sprintte değil. Açılırsa: llmClient'ta ikinci sağlayıcı (aynı kod, env seçer), BYO-key yolu silinmez. Karar Kemal'in |
| **Durum** | `widerlegt` (05.10.2026) — konsey relay'i reddetti (legal-de ⛔: maskeli metni merkezde açık okuruz → Art. 9 AV + §393 "Cloud-System"; guvenlik: serbest metinde %13 sızıntı). Yerine K-20: içerik merkezden **hiç geçmez**, merkez yalnız jeton + sayaç verir (O-169). Yeniden açılma koşulu konsey kaydında (avukat "stateless relay Cloud-System değil" + relay'e yalnız A sınıfı alanlar) — Önceki: `offen` |

### O-168 — Hausbesuch km için ORS relay 🟡 **offen — öneri: relay yok**

| Alan | İçerik |
|---|---|
| **Ne** | Kutu A→B koordinatını merkeze sorar, ORS anahtarı merkezde |
| **Tip** | A + G |
| **Kutuda ne olur** | B koordinatı hasta ev adresinden türer → G1 konusu, O-11'deki AVV sorunu bize taşınır. Kazanç küçük |
| **Çözüm** | O-11 öneri (a): praksisin kendi ücretsiz ORS anahtarı (kutudan doğrudan, bizden geçmez) + yoksa elle km. Relay yazılmaz |
| **Durum** | `offen` — Faz 1.5 / O-11'e bağlı |

---

## 7AC — K-20 (05.10.2026, konsey + Kemal): KI = tek Praxura Azure kaynağı + kısa ömürlü Entra jetonu

> Kaynak: konsey 05.10.2026 + Kemal onayı (K-20; tutanak ve KHS görev numaraları koordinatörde). Bu bölüm yalnız sicil tarafını tutar.
> **Değişen kilitli karar:** K4 (müşterinin kendi IONOS hesabı) → K-20. `direkt` (BYO) yolu **silinmez**, istisna olarak kalır. **K6 açılmadı:** jeton modeli proxy değildir — içerik merkezden geçmez (playbook §2'ye not düşüldü).
> **Değişmeyen:** 28.09 B kararının hukuki ön şartları (Microsoft yazılı cevapları, Modified Abuse Monitoring, avukat, AVV/Sub-AV/DSFA). Jeton anahtarın **güvenliğini** çözer, **rolü** (Microsoft bizim alt işleyicimiz, biz AI için Auftragsverarbeiter) değiştirmez. Bu yüzden serbest metne en yakın görevler (mail taslakları) avukat cevabından sonra açılır.
> **Onprem hükmü:** GEÇER, KAYITLA — G1/G2/G3/G8'de veto yok, aşağıdaki şartlarla.

### O-169 — KI jeton modu: kutu, merkezden aldığı 60–90 dk'lık Entra jetonuyla tek Praxura Azure kaynağına doğrudan gider 🟡 **geplant (K-20; Faz 3.5 + Faz 1.3/O-135 + M4.1)**

| Alan | İçerik |
|---|---|
| **Ne** | `AI_MODE=jeton`: kutu, kutu kimliğiyle imzalı istekle merkezden kısa ömürlü Entra access token alır ve Azure OpenAI'ya (Sweden Central, Standard) **doğrudan** gider; içerik merkezden geçmez, merkez yalnız jeton + sayaç tutar. Sözleşme: `AI_MODE=aus\|direkt\|jeton` (kutuda varsayılan `aus`) |
| **Nerede** | Henüz kod yok. Dokunacağı yerler: `api-backend/ai/azureClient.js:11-16` (endpoint/anahtar modül seviyesinde sabitleniyor → O-135 `getAiCredential()`) · `:38-40` (üretimde anahtar yokken `throw` — O-07/O-151) · `:46-63` (bölge kontrolü → tam host izin listesi) · `:127` (`'api-key'` başlığı → jeton modunda `Authorization: Bearer`) · merkezde `merkez/` jeton ucu (ileride Faz 3.1 lisans sunucusunun ucu) · kutu kimliği K-18 kurulumunda (O-161) |
| **Tip** | **A** (kutu → Azure) + **E** (merkezde SP sırrı; kutuda kutu kimliği) + **F** (merkezde budget alert + gece karşılaştırması) + **G** (merkez tarafı jeton ucu) + **H** (KI yetkisi = kutu başına aylık sınır) |
| **Kutuda ne olur** | **Normal:** jeton bellekte; ömrü dolunca ya da restart'ta yenisi alınır. **İnternet yok:** Azure'a zaten çıkılamaz → KI düğmeleri pasif, kutunun geri kalanı çalışır. **Merkez kapalı:** eldeki jetonun ömrü kadar (≤90 dk) KI çalışır, sonra pasif. **Sınır doldu / kutu iptal / lisans salt-okunur (K9):** merkez jeton vermez → ≤90 dk'da KI pasif. **429 (TPM):** istek kuyruğa, kullanıcıya açık mesaj. Entra jetonu süresi dolmadan **geri çekilemez** (doğrulanmalı) → sızan jetonun zarar penceresi ömrü kadar, maliyeti TPM ile sınırlı. ⚠️ Bugün `azureClient.js:38-40` jeton/anahtar yokken üretimde `throw` ediyor → düzeltilmeden jeton modu kutuyu bozar |
| **Çözüm** | **Şartlar (K-20'nin uygulama kapısı):** (1) **Jeton yalnız süreç belleğinde** — disk, `.env`, DB, yedek ve tanılama paketine girmez. (2) **Kutu kimliği = K-18'in tek Ed25519 çifti** (O-161); özel anahtar kalıcı volume'da ayrı dosya, `0600`, yalnız `api`'ye mount; `.env`/DB/tanılama paketine girmez. Merkez yalnız açık anahtarı tutar; istek imzalı + zaman damgalı. (3) **Endpoint TAM host adıyla, image'daki izin listesine karşı denetlenir** (joker yok) — jeton cevabı endpoint taşısa bile; ele geçirilmiş merkez maskeli metni başka hosta yönlendiremez. Merkez URL'si env'den (tip C yok). (4) **Kutular için ayrı service principal**, rolü yalnız o tek Azure OpenAI kaynağında **özel rol** (yalnız chat/completions data action); SaaS VPS'teki mevcut KI ayrı kimlik. (5) **`store:false`**; Responses/Assistants/Files/Batch/stored completions kullanılmaz, kaynakta stateful özellikler kapalı. Paylaşılan kaynakta bir kutunun başka praksisin saklanmış içeriğini okuması (mandant sınırı) böyle kapanır. (6) **Sınır merkezin verdiği jeton sayısına dayanır**; kutunun bildirdiği toplu kullanım (görev + token in/out, jeton isteğine eklenir, hasta verisi yok) yalnız bilgi. v1: kutu başına sabit aylık sınır, Stripe/kredi yok, beta süresince ücretsiz. (7) **TPM düşük + budget alert → merkezde otomatik jeton kesme**; gece Azure toplamı ile verilen jeton/bildirilen kullanım karşılaştırılır. (8) SP sırrı yalnız merkezde (G2 ikinci cümlesi); kutu Entra'ya hiç çıkmaz. (9) Jeton ucu `merkez/` VPS'inde — SaaS VPS'te değil (O-159), Vercel `api/`'de değil (G8), n8n'de değil (G3). (10) `direkt` (BYO) önceliklidir ve silinmez. (11) Açılış sırası: series-scheduler + rezept-normalize önce; mail taslakları (appointment-confirm, b2c, b2b) avukat cevabından sonra. Betalar kutuya `AI_MODE=aus` ile geçer. **Görev:** Faz 3.5 (yönetilen AI: jeton ucu + sınır + bekçi) · Faz 1.3 / O-135 (anahtar kaynağı soyutlaması) · M4.1 (`AI_*` okuma + `throw` kaldırma). **KHS:** 3b.4 (merkez jeton ucu, Hat K) · M4.11 (kutu jeton modu, Hat M) · K2b.17 (tek kutu kimliği, Hat K) · §5 ORG (avukat, Microsoft, Azure kurulumu, belgeler); tutanak `konsey/tutanak/2026-10-05-ki-tek-hesap-jeton.md` |
| **Durum** | `geplant` (K-20, 05.10.2026). Uygulama öncesi Microsoft belgesinden doğrulanacak: Entra jeton ömrü ve erken iptal edilemezliği · özel rolün yalnız chat/completions'a kısıtlanabildiği · diagnostic loglarda çağıran kimliğinin görünüp görünmediği · **08.10.2026 ön kontrol 3b.4 (merkez jeton ucu, spec, kod yok): GEÇER, ŞARTLI** — yazılabilir, **açılamaz** (`ki-global an` gerçek kaynakla). Karşılanan: (2) `signiert` · (6) sayaç = verilen jeton, rapor yalnız bilgi · (8) sır yalnız merkez env · (9) `merkez/` · varsayılan kapalı (global + `boxes.ki_status` ikisi de `aus`, ALTER DEFAULT mevcut kutuları da `aus` yapar). Kod şartları: (a) bu yolda **hiç 429 yok** — istemci `ki-jeton.js:356` 429'u kota sayıp KI'yı restart'a kadar kapatıyor; `/v1/caa` deseni (`merkez/server.js:236-239` 429) kopyalanmayacak, önündeki proxy de 429 dönmemeli. Ayrıca istemci (M4.11): 429 = geçici; kota kilidi süreli olmalı (402 gövdesine `resetAt`, Berlin ay başı) — yoksa ay dönümünde ve `ki-limit` artırımında kutu restart'a kadar KI'sız kalır. (b) tek SP + merkez önbelleği (4) ile uyumlu: (4) 'kutular SaaS VPS'ten ayrı SP' diyor, kutu başına SP değil; `KI_ENTRA_CLIENT_ID` SaaS kimliğiyle aynı olmamalı. Kutu iptali = vermeyi kesmek; zarar penceresi bizim `exp`'imiz değil **Entra'nın gerçek exp'i** (≤~90 dk) — `ki_ausgabe`'ye gerçek Entra exp yazılır. Önbellek eşiği 10 dk → kısa ömürlü jeton = fazla istek = kota hızlı erir: eşik ≥45 dk, ve aynı kutuya geçerli aynı jeton tekrar verilirse sayaç artmaz (2 worker çift saymasın). (c) ay = **Europe/Berlin**, `monat` verilişte bir kez hesaplanıp saklanır; 600 kalibre değil, beta yer tutucu. (d) env eksik → yalnız bu uç 503, servis başlar (O-07 dersi: açılışta throw yok); `KI_REGION` AB listesine, `KI_ENDPOINT` https-yalnız-host'a açılışta denetlenir. G1: geçersiz rapor **payload'ı loglanmaz/saklanmaz**, `ki_bericht.daten` yalnız doğrulanmış normalize nesne; jeton ne DB'de ne logda (1). Açık kalan, açılış kapısı: (7) otomatik kesme + gece karşılaştırması (spec bilinçli erteledi) · (4)/(5) ORG/kutu tarafı (özel rol, `store:false` M4.11) · (11) merkez jetonu görev bazlı kısıtlayamaz → görev kapısı kutu image'ında (M4.11). Durum değişmez: `geplant` · **09.10.2026 sonraki denetim 3b.4 (kod var, commit yok): GEÇER — kod kısmı tamam, açılış kapısı KAPALI kalır.** 08.10 şartlarının hepsi kodda: (a) yolda 429 yok — kendi limiti `statusCode: 503` (`merkez/server.js:53`), `signiertLimit`/`/v1/caa` deseni bu uca bağlı değil, global hata işleyicisi 413/400/500 döner (`:381-385`) · 402 `{code:'AI_QUOTA_EXCEEDED', resetAt}` (`:344-350`), `resetAt` = Berlin ay başı, DST'ye karşı düzeltmeli (`merkez/ki-jeton.js:264-291`) · (b) Entra önbellek eşiği 45 dk (`ki-jeton.js:7`, `:209`), singleflight (`:212-225`); aynı kutuya aynı geçerli jeton → sayaç artmaz (`server.js:327-339`, parmak izi yalnız RAM'de, `kiLetztes`); `ki_ausgabe.entra_exp` saklanıyor (`db.js:65-72`, `server.js:354-360`) · (c) `monat` Berlin, verilişte bir kez saklanıyor (`server.js:342`, `ki-jeton.js:235-237`) · (d) env eksik/bozuk → yalnız uyarı satırı, servis açılır, uç 503 `ki_aus` (`server.js:420-425`, `:275-277`); `kiConfigAusEnv` hiç throw etmez, `KI_REGION` AB listesine, `KI_ENDPOINT` https + yalnız host + 443'e açılışta denetleniyor (`ki-jeton.js:52-139`); SP sırrı enumerable değil (`:38-44`), hata mesajları sabit metin (`:164-199`) · varsayılan kapalı: global `ki_global` yoksa kapalı (`server.js:275`), `boxes.ki_status` DEFAULT `'aus'` + ALTER ile eski kutular da `aus` (`db.js:21`, `:94-101`) · G1: geçersiz raporda yalnız kutu adı + sabit `grund` loglanıyor (`server.js:303`, `ki-bericht-schema.js:40`), `ki_bericht.daten` = doğrulanmış normalize nesne (görev adları beyaz liste, yalnız 4 sayısal alan — `ki-bericht-schema.js:20-32`, `:136-188`); jeton ne DB'de ne logda. **Builder sapmaları — üçü de kabul:** (1) rapor + Entra çağrısı limit kontrolünden önce: Entra önbelleği tüm kutularda ortak, limit üstü kutu ayrı Entra çağrısı üretmez (önbellek bayatsa en fazla 1, singleflight); rapor kaydı içerik değil sayı → G1'e değmiyor; yararı limit dolu kutunun kullanım raporunun da gelmesi. (2) `boxRebind` `ki_ausgabe`/`ki_bericht`'i yeni `box_id`'ye taşıyor, çağıranın `tx()`'i içinde (`db.js:153-165`, `server.js:170-171`) — doğru. (3) `.catch` → 503 (`server.js:373-378`) — doğru, 500 değil; istemci 5xx'te eldeki jetonu tutuyor. Testler: `merkez` 94/94, `ki-bericht-schema.test.js` geçti; `check-onprem.sh` rc=0. Sparse-checkout: eklenen 3 dosyanın (`ki-bericht-schema.js`, `lib/berlin-tag.js`, `ai/ki-config.js`) kendi `api-backend` import'u yok → desen 6 dosyada kapanıyor; VPS'te uygulamak KHS §5b. **Gözlemler (veto değil):** (i) merkez restart'ında `kiLetztes` boşalır → her kutu o saat bir kez fazladan sayılır; kabul, `ki_ausgabe` zaten gerçek sayaç. (ii) client-credentials jetonu ~60-90 dk → 45 dk eşiği yüzünden önbellek çoğu zaman 15-45 dk yaşar; sayım birimi pratikte 'kutu başına saatte ~1 jeton', 600 = günde ~20 saat KI açık kutu — yer tutucu, beta'da kalibre edilir. (iii) `kod-rebind` `ki_status`'u korur: iptal edilmiş kutu rebind'le geri gelirse KI de kendiliğinden döner (rebind bilinçli admin eylemi, kabul; ama `ki-stand` ile bakılmalı). (iv) `merkez/README.md` 402 satırı 'Box-Client schaltet KI bis zum Neustart ab' diyor — bu bugünkü **hatayı** davranış diye belgeliyor; M4.11 kapanınca 'bis resetAt' olarak düzeltilir. **Açılış kapısı (değişmedi, kod dışı):** 7. şart (TPM düşük + budget alert → merkezde otomatik `ki-global aus` + gece Azure toplamı ↔ `ki_ausgabe` karşılaştırması) yok · ORG: kutu SP'si SaaS kimliğinden ayrı (4), özel rol yalnız chat/completions (4), kaynakta stateful özellikler kapalı (5), Microsoft belgesinden jeton ömrü/iptal edilemezlik doğrulaması. **M4.11 boşlukları (kutu istemcisi, `api-backend/ai/ki-jeton.js`):** (α) `:356` 429'u kota sayıyor → 429 **geçici** sayılmalı (eldeki jetonu tut, geri çekil), kota yalnız 402 + `code` ile; (β) 402'de `tokenDisabled` süresiz (`:359-365`, `:292-297`, `:430-436`) → gövdedeki `resetAt`'e kadar kilit, sonra kendiliğinden yeniden dene (yoksa ay dönümünde ve `ki-limit` artırımında kutu restart'a kadar KI'sız); `resetAt` yoksa/bozuksa makul tavan (örn. 6 saat); (γ) merkez raporu `abweichend`/`bericht_ungueltig` sayıp onaylamazsa istemcinin tek `pendingReport`'u (`:527-535`) hiç temizlenmez ve sonraki her rapor 'Bereits eine ausstehende' ile düşer → kullanım raporu restart'a kadar durur. Rapor yalnız bilgi (6) olduğu için kota bozulmaz, ama gece karşılaştırması (7) körleşir: istemci N denemede onaysız raporu bırakmalı ya da merkez kalıcı reddi ayrı alanla bildirmeli (`rejectedReportId`). Durum değişmez: `geplant` (kod kısmı 3b.4 tamam, açılış 7. şart + ORG + M4.11'e bağlı) · **09.10.2026 ön kontrol şart 7 (`merkez/ki-abgleich.js` + `admin.js ki-abgleich`): GEÇER, KAYITLA** — gün **UTC** (rapor penceresi `audit.js:119-123` UTC; Berlin değil), Azure toplamı yalnız kutu SP'sinin kapsamı (SaaS çağrıları dahilse karşılaştırma anlamsız), eşikler CLI bayrağı + koddaki sabit (env yok, §8), otomatik kapatma O-186 kapanana kadar kapalı (yalnız rapor + exit 2) |

---

## 7AD — KHS M2 (06.10.2026): Migrationen 0067–0069 + Einrichtungsschritt „Praxisangaben"

> Nachträgliche Prüfung (Commits `8967ecc` · `d2da247` · `e14697a` · `9726ebc`). Ergebnis
> insgesamt GEÇER: 0067/0068 nur nullable Spalten + erweiterte CHECKs (Expand, `:stable`
> schreibt die neuen Werte nie); 0069 läuft auf der Box (`storage.foldername` und
> `storage.objects`-Policies stehen schon 13×/18× in `0000_baseline.sql`, `public.auth_tenant_id()`
> in `0000_baseline.sql:257`, `storage.buckets(file_size_limit, allowed_mime_types)` nutzt die
> Baseline bereits in Zeile 12498-12502 mit demselben `ON CONFLICT`); DSGVO-Löschkette kennt den
> Bucket (`api-backend/dsgvo/klassifikation.js:610`, kein PHI). `POST /api/setup/branding`:
> Typ G (Box-Seite), kein A/C/E/F; G1/G2/G3/G8 unberührt — neue Route in Express, nicht Vercel;
> im SaaS tot, weil `tokenGueltig()` ohne `SETUP_TOKEN` immer `false` liefert
> (`api-backend/setup/router.js:54-56`, Regel aus CLAUDE.md „SETUP_TOKEN — SET ETME" gilt weiter).
> Kollision mit Kemals K2b am Router: keine sichtbare — letzter fremder Commit `d807c3e`
> (02.10.) ist Vorfahre, `origin/main` hat nichts Neues unter `api-backend/setup/`. Einziger Fund:

### O-170 — `_hinweis_0069` nennt 0069 zählerneutral, aber `storage_bucket` zählt `storage.buckets`: frische Box zeigt Selbstcheck rot 🔴 **offen**

| Alan | İçerik |
|---|---|
| **Ne** | 0069 legt den Bucket `praxis-stempel` an. Der Zähler `storage_bucket` ist `SELECT count(*) FROM storage.buckets` — **nicht** auf `public` beschränkt. Erwartet bleibt 5, die Box hat danach 6 |
| **Nerede** | `api-backend/db/schema-zaehler.js` (`storage_bucket`-Abfrage) · `api-backend/db/erwartete-zaehler.json` (`"storage_bucket": 5`, `_hinweis_0069`: „nur public gezählt … alle Zaehler unveraendert") · `api-backend/db/migrations/0069_praxis_stempel_branding.sql` (INSERT INTO storage.buckets) · Anzeige `api-backend/setup/router.js:113` |
| **Tip** | D |
| **Kutuda ne olur** | Jede frisch installierte oder auf 0069 aktualisierte Box meldet im Einrichtungs-/Statuspanel `kirmizi`: „Abweichung: storage_bucket soll=5 ist=6". Blockiert nicht (Dilim-2-Regel: Kontrollen zeigen, sperren nicht), aber ein roter Selbstcheck auf **jeder** Box ist Falschalarm — und lehrt Kunden und uns, Rot zu ignorieren. SaaS merkt nichts (dort läuft der Selbstcheck nicht gegen diese Erwartung) |
| **Çözüm** | `builder`: in `erwartete-zaehler.json` `zaehler.storage_bucket` 5 → **6**, `_hinweis_0069` korrigieren (Bucket +1, `ON CONFLICT (id)` macht es auf frischer **und** aktualisierter Box genau +1; Policies in `storage` bleiben für `rls_policy` neutral — der Teil stimmt). `gemessen_am` bleibt, Wert ist nachgerechnet. Vor dem nächsten Release (0.5.0) erledigen. Lehre: genau die Falle, vor der Kural 6 seit 13.09.2026 warnt („`storage.buckets`-INSERT ist Daten, ändert aber den Zähler") — Argument für die offene Kapı-Hälfte von **O-108** (maschinenlesbares `-- ZAEHLER:` + Prüfung, dass bei `storage.buckets` im Diff der Wert sich ändert) |
| **Durum** | 🔴 **offen** — gefunden 06.10.2026 in der Nachprüfung KHS M2 |

### O-171 — `acmedns.json` yoksa Caddy hiç açılmaz: tek dosya bütün arayüzü düşürür ✅ **gelöst (`004fc537`)**

| Alan | İçerik |
|---|---|
| **Ne** | `caddy-dns/acmedns` kimlik dosyasını Provision anında okur; dosya yoksa ya da bozuksa Caddy config'i reddeder ("Failed to read config file") — sertifika değil, **proxy'nin kendisi** kalkmaz |
| **Nerede** | K2b.4 tasarımı: `onprem/Caddyfile` (`tls_acmedns` snippet) · volume `acmedns` (`onprem/docker-compose.yml`, `:ro`) · yazan `api-backend/merkez-istemci/kayit.js:34` |
| **Tip** | G (kutu içi tek nokta arızası) + A'nın yan etkisi |
| **Kutuda ne olur** | `MODUS=acmedns` iken volume boşsa (`docker compose down -v`, yanlış restore sırası, kayıt yarıda kaldı) Caddy crash-loop'a girer: tablet/PC giriş ekranını bile açamaz, `/api`, `/auth` dahil her şey kapalı. Hasta verisi sağlam ama praksis kör. `update.sh` sağlık kontrolü caddy'yi bekler → güncelleme geri alınır ama sebep "caddy sağlıksız" olarak görünür |
| **Çözüm** | K2b.4: (a) Caddyfile `{$CADDY_TLS_MODUS:klassisch}` varsayılanı · (b) `install.sh` acmedns'i yalnız dosya volume'da doğrulandıktan sonra yazar, yoksa klassisch+internal'a düşer ve söyler · (c) smoke test iki modu da `caddy validate` ile dener, klassisch'te dosya yokken kalkmayı ölçer · (d) K2b.8 kılavuzuna kurtarma satırı: `.env`'de `CADDY_TLS_MODUS=klassisch` + `CADDY_TLS_ARG=internal` → `up -d caddy` |
| **Durum** | `geplant` (K2b.4) — 06.10.2026 ön kontrolde bulundu · **aynı gün kod var, commit bekliyor:** (a) `Caddyfile:53` `import tls_{$CADDY_TLS_MODUS:klassisch}` · (b) `install.sh:673-691` ilk `up`'tan önce `kayit --durum --json` → `acmedns:true` ise acmedns, değilse klassisch+internal+uyarı · (c) `publish-frontend.yml`: `list-modules`, acmedns+sahte dosya `validate` geçer, dosyasız düşer; eski smoke klassisch-dosyasız'ı kapsıyor (yerelde Caddy 2.11.6 ile ölçüldü, koordinatör beyanı) · (d) KURULUM §9 `Failed to read config file` satırı, §8 Weg1/Weg2 `CADDY_TLS_MODUS=klassisch`. `check-onprem.sh` rc=0 (bu turda koşturuldu). Commit ile `gelöst` · ✅ **`gelöst` — `004fc537` (06.10.2026).** Ek (`guvenlik` itirazı): `restore.sh:486-489` acmedns modunda caddy-pki'yi geri yüklemiyor, test eklendi. Açık kalan risk: elle `docker compose down -v` ile `acmedns` volume kaybı → kurtarma KURULUM §9 satırı; gerçek kutuda gözlem K2b.4b ile |

### O-172 — Sertifika yenilemesi merkeze bağlı; HSTS ile birleşince süresi dolan sertifika geçilemez kilide döner 🟡 **kısmen gelöst (`6aac145c`: bitiş uyarısı + klassisch 2 yıl → 1 gün) — kalan: şart (i) + 1 yıl adımı**

| Alan | İçerik |
|---|---|
| **Ne** | acmedns modunda yenileme merkezdeki acme-dns'e bağlı (O-161 (2)). HSTS açıkken tarayıcı süresi dolmuş/geçersiz sertifikada "yine de devam et" seçeneğini **kaldırır** |
| **Nerede** | `onprem/Caddyfile:44` (`Strict-Transport-Security max-age={$HSTS_MAX_AGE}; includeSubDomains`) · `onprem/install.sh:441` (LE e-posta yolunda bugün 63072000) · K2b.4 adım 10 |
| **Tip** | G (kullanılabilirlik) — K9 ruhu (veriye erişim rehin olmamalı) |
| **Kutuda ne olur** | Merkez >~60 gün kapalı kalırsa ya da biz ortadan kalkarsak sertifika ≤90 günde düşer. HSTS=0: kullanıcı uyarıyı tıklayıp geçer, praksis çalışır. HSTS=1 yıl: o adı bir kez görmüş **her** cihaz kutuyu açamaz, kaçış yalnız kutu PC'sinde `localhost` / çıkış yoluna geçiş. Aynı şey K2b.8 son çaresinde (aynı ada `tls internal`) CA'yı henüz içe aktarmamış cihazlarda da olur. HSTS'nin LAN'daki kazancı (SSL-strip) gerçek ama küçük; adres yer imi/kısayolla `https://` açılıyor |
| **Çözüm** | **06.10.2026 güncelleme — uygulanan: 86400** (koordinatör + `guvenlik` S-47 şart 5; bu sicilin 0 önerisi görüşüldü, kabul edildi: kilit en fazla 24 saat sürer, aynı adın LAN'da başka cihaza gitmesine karşı koruma kazanılır). Asıl öneri (0) tarihî kayıt olarak aşağıda: K2b.4: acmedns modunda `HSTS_MAX_AGE=0`. 31536000'e yükseltme (includeSubDomains kalabilir, preload yok) **iki şartla:** (i) gerçek bir kutuda en az bir otomatik yenileme gözlendi, (ii) panelde/selbstcheck'te "sertifika <21 gün" uyarısı var — yoksa merkez kesintisi sessizce kilide döner. ⚠️ **Yükseltme J4 ile GİTMEZ (06.10.2026 düzeltme):** 86400'ü şablon değil `install.sh:680` yazıyor; şablon `HSTS_MAX_AGE=0`. J4'te kutunun değeri (86400) tabandan (0) farklı → "müşteri değiştirdi" sayılır, yeni şablon değeri uygulanmaz, çakışma uyarısı çıkar. 1 yıla geçiş için `update.sh`'a mod-koşullu ayrı adım (yalnız `CADDY_TLS_MODUS=acmedns` **ve** değer tam `86400` ise yükselt) ya da ayrı bir anahtar gerekir — yükseltme turunun işi. `guvenlik` görüşü alınır; veto konusu değil |
| **Durum** | `geplant` — 06.10.2026: 86400 kodda (`install.sh:680`, `.env.template:142` açıklaması), commit bekliyor. 31536000'e geçiş açık: iki şart + yukarıdaki J4 tuzağı (1 yıl yükseltmesi J4 ile gitmez, `update.sh`'ta mod-koşullu adım gerekir) · **`004fc537` ile commit'lendi.** · **06.10.2026 ek (`guvenlik` yan bulgusu):** `install.sh:~445` klassisch+e-posta yolu (müşterinin kendi alan adı, LE HTTP-01/TLS-ALPN) HSTS'i bitiş izlemesi **olmadan** 63072000 (2 yıl) yapıyor. Orada yenileme bizim zincirimize bağlı değil (K9 argümanı zayıf) ama kilit sınıfı aynı: port 80/443 dışa kapanır ya da alan adı düşerse sertifika biter, adı görmüş her cihaz 2 yıl geçemez. **Öneri (bu turda kod değişmedi):** iki mod tek kural — '<21 gün' uyarısı yazılana kadar 86400, sonra 31536000; 63072000/preload gereksiz. Aynı J4 tuzağı: değeri `install.sh` yazıyor, düşürmek de `update.sh`'ta mod-koşullu adım ister (yalnız değer tam `63072000` ise 86400'e çek). Sahada canlı kutu yok; HSTS turuna bağlandı · **08.10.2026 ön kontrol (HSTS turu, kod yok) — tasarım:** (1) Şart (ii) kanalı = **`update.sh`** (yeni zamanlanmış iş yok): `praxura-update.timer` her kutuda kurulumda açılır; `praxura-backup.timer` ise anahtar onayına bağlı (`install.sh:1232/1314`), panel bandı ayrı UI işi. Yer: `owner_bilgisini_guncelle || true` (`update.sh:365`) sonrası, Durak-Tor'dan (`:367`) önce — re-exec'ten sonra, tek koşu; pull düşerse (`:149`) o gece atlanır, kabul (internet yoksa mail de gitmez). Okuma: `openssl s_client -connect 127.0.0.1:443 -servername <SITE_URL host>` → `openssl x509 -noout -checkend 1814400` — tarayıcının gerçekten aldığı sertifika; `caddy_data` içindeki yol Caddy'nin iç düzeni, ona bağlanılmaz. openssl host'ta zaten şart (`install.sh:430`). **Yalnız LE modlarında** (acmedns · klassisch+e-posta) çalışır — `internal`'da Caddy yaprağı ~12 saatlik, 21 gün eşiği her gece alarm verirdi. Boş/okunamayan cevap 'bitiyor' sayılmaz (caddy kapalı ≠ sertifika bitiyor) — yalnız log. Mail: `mail_gonder_container` yeniden kullanılır (üçüncü kopya yok), ama **kendi durum dosyası** (`.praxura-stand/son-zertifikat-bildirim.json`, 7 gün tekrar = 21/14/7 gün kala); `NOTIFY_FILE`/`bildirim_degerlendir` kullanılmaz — güncellemenin `ok`'u sertifika alarmını 'Entwarnung' ile ezerdi. `update-alarm-mail.mjs`'e sabit metinli yeni anahtar + kendi konu satırı (log/ad/tarih yok). (2) 63072000→86400: `install.sh:742` + `update.sh`'ta J4 bloğundan sonra, Schritt 7'den önce mod-koşullu adım (`CADDY_TLS_MODUS`≠acmedns, `CADDY_TLS_ARG`≠internal, değer **tam** `63072000`) — snapshot Schritt 6'da alındığı için geri alma `.env`'i tutarlı geri koyar; `HSTS_MAX_AGE` compose `environment:`'ta (`docker-compose.yml:589`) olduğundan Schritt 9 `up -d` caddy'yi yeniden yaratır. Aynı commit'te `.env.template:143-146` ve `Caddyfile:74-76` yorumları ('63072000 bei klassisch mit E-Mail') düzeltilir. (3) 1 yıl adımı **şimdi yazılmaz** — şart (i) bir gözlem, bayrakla kapalı ölü kod test edilmeden sürüklenir; (i) gelince aynı mod-koşullu desenle (yalnız tam 86400 ise). Şart (ii) metni bundan sonra 'panel/selbstcheck **ya da owner'a alarm maili**' okunur — `guvenlik` S-47 Bed. 5 sahibi, bildirilecek. Durum değişmez: `geplant` · **08.10.2026 `6aac145c` — (1)+(2) tasarıma birebir uygulandı:** `update.sh` `zertifikat_pruefen` (yer, mod koşulu, boş cevap = yalnız log, kendi durum dosyası, `zertifikat_laeuft_ab` sabit anahtarı, `NOTIFY_FILE`'a dokunmuyor); `install.sh` 86400; `update.sh` J4 sonrası mod-koşullu 63072000→86400; yorumlar + manifest + statik test. WSL'de gerçek kutuya karşı ölçüldü (normal: sessiz · eşik 100 gün: 1 mail · ikinci koşu: 7 gün kilidiyle sessiz). Not: `CADDY_TLS_ARG` boş eski kutu internal sayılır, kontrol atlanır — kabul (sahada canlı kutu yok; e-posta yolu her kurulumda CADDY_TLS_ARG yazar, install.sh:741). **Şart (ii) bununla karşılandı.** Kalan: şart (i) (gerçek kutuda gözlenmiş otomatik yenileme) + 1 yıl adımı (yalnız tam 86400 ise, aynı desen). Durum → 🟡 `kısmen gelöst` |

## 7AE — K2b.8 kısım 2 ön sorusu (07.10.2026): Hetzner sayfası + genel Linux sertleştirme

### O-173 — `backup.sh` arşivi düz yazar: internete açık (Hetzner) kutuda "şifreli yedek" şartını kılavuz tek başına karşılayamaz ✅ **gelöst (`1736768f`)**

| Alan | İçerik |
|---|---|
| **Ne** | `backup.sh` storage'ı `tar -czf` (`:151`) ve DB'yi pg_dump ile **şifresiz** yazar; arşiv seviyesinde şifreleme yok (grep `gpg`/`age`/`openssl enc` → 0). Hasta alanlarının bir kısmı DEK ile şifreli (O-29), geri kalan PHI dökümde düz |
| **Nerede** | `onprem/backup.sh:94-101` (hedef), `:148-155` (storage), DB dökümü aynı dosyada · şart kaynağı: `guvenlik/REGISTER.md` S-50 şart 5 (S-22/S-43 öneri 2) |
| **Tip** | G (kutu işletimi) — dış çağrı yok; G1/G2 temiz (yedek praksisin hedefinde) |
| **Kutuda ne olur** | Praksis/LAN kutusunda kılavuzun "BitLocker/LUKS ile şifreli disk" tavsiyesi (KURULUM §6) yeterli. Hetzner kutusunda hedef pratikte bir Hetzner Volume ya da Storage Box olur; disk-seviyesi şifreleme anahtarı aynı sunucuda durduğu için kılavuz "şifreli yedek" diye bir adım **tarif edemez** — yazılırsa yanlış güvence olur |
| **Çözüm** | İki parça: (1) **kod (builder, KHS'e yeni satır önerisi):** `backup.sh` istemci tarafı arşiv şifrelemesi — açık anahtar kutuda, özel anahtar DEK gibi kutu dışında (kurulumda bir kez gösterilir); `restore.sh` simetriği. Araç seçimi (`age` vs. `openssl`) `guvenlik` kararı. (2) **kılavuz (K2b.8 kısım 2, şimdi):** Hetzner sayfasında hedef = ayrı Hetzner Volume, sınır açık yazılır ("Volume derselben Firma — schützt vor Serverausfall, nicht vor Zugriff beim Anbieter; verschlüsselte Sicherung folgt"); Hetzner'in kendi "Backups/Snapshots" özelliği ek katman olarak anılabilir ama `.env` (DEK) dahil tüm diski içerdiği **yazılır** |
| **Durum** | `gelöst` — `1736768f` (07.10.2026, push edildi). Kutuda tam tur testi KHS §5b T10/T11'de: tam restore, install keygen akışı, `update.sh` anahtarsız durma. Ek (`guvenlik` uyarısı): `install.sh` `praxura-backup.timer`'ı artık GESICHERT onayından **sonra** `enable --now` ediyor; anahtar saklandığı onaylanmadan ilk yedek alınmıyor. Yan etkisi O-175'te, o madde açık |
| **Uygulama (07.10.2026, builder bildirimi)** | Ön kontrolden iki sapma, ikisi de kabul: (a) adlar `BACKUP_EMPFAENGER` / `install.sh --sicherungsschluessel`; (b) anahtarsız kutu **fail-closed** (`backup.sh:96-104`, exit 1) — `guvenlik` kararı, benim "şifresiz devam + uyarı" önerimin yerine. Gerekçe: sahada kutu yok, sessiz şifresiz yedek kapatılan açığın ta kendisi. Sorun değil, benim vetom yok (G1/G2/G3/G8 değmiyor). Yan etkisi O-175'te. Uygulanan şartlar: host'ta `age`, `install.sh` Schritt 2'de apt, `update.sh` apt yapmaz, şifresiz ara dosya yalnız `$SCRIPT_DIR/.backup-tmp` (700, trap), hedefe yalnız `.age` + künye, iki yer kontrolü, BUNDLE listesi değişmedi (yalnız manifest hash'leri), `.env.template` `BACKUP_EMPFAENGER=` boş, restore iki biçim (düz metin yalnız `--altsicherung`). WSL ölçümü: anahtarsız → exit 1 ve hedefte 0 dosya; anahtarlı → hedefte düz iz 0; restore red yolları yıkıcı adımdan önce |
| **Ön kontrol (07.10.2026, K2b.18 kod öncesi — kutu tarafı; araç/anahtar modeli `guvenlik`'te)** | **(1) Nerede koşar: host.** `backup.sh`/`restore.sh` zaten root olarak host'ta, tüm G/Ç host yollarında (`backup.sh:151,192`); boru hattı + restore'da kimlik dosyası (`/dev/shm`) host'ta önemsiz. Konteyner yolu (`docker compose run --rm api age`) 01:00'de/`update.sh` Schritt 8'de (`update.sh:673`) api imajının durumuna bağlanır ve kimliği konteynere sokmayı gerektirir — kazancı (eski kutuya imajla varır) boş, çünkü eski kutu zaten etkileşimli anahtar adımı ister. Araç `age` (Ubuntu 24.04 universe — WSL dağıtımı da `Ubuntu-24.04`, `windows/praxura-installieren.ps1:51`; Debian 12 de var). `openssl` kutu açısından zayıf: akışlı açık-anahtar dosya şifrelemesi yok (`cms` büyük dosyada bellekle açar) — nihai seçim `guvenlik`. `install.sh` Schritt 2: `age` yoksa ve `apt-get` varsa kur, yoksa `fail` (Gefunden/Erwartet/Was tun). `update.sh` **apt çalıştırmaz** (gözetimsiz gece). ps1'e ayrı liste eklenmez (tek kaynak `install.sh`). **(2) Eski kutu:** `BACKUP_PUBKEY` boş → şifresiz devam + her gece `backup.log` uyarısı (`sudo bash install.sh --yedek-anahtari`) + künyede `verschluesselung:null`. Gerekçe: canlı müşteri yok, Hetzner yolu 0.4.0'la yeni → eski kutuların hepsi LAN; yeni kurulumda adım **zorunlu**. `BACKUP_PUBKEY` dolu ama `age` yok → `fehler`+exit 1, **sessiz düz yazıya düşüş yok** (yalnız elle kurcalamayla erişilir). `--yedek-anahtari` deseni `--neuer-jeton` (`install.sh:100-118`, çakışma kontrolü dahil): [1] kutuda üret — `age-keygen` çıktısı değişkende, diske/`install.log`'a yazılmaz, `reveal_once` (`install.sh:66`) ile DEK yanında bir kez · [2] praksisin kendi `age1…` açık anahtarını yapıştır (özel anahtar kutuya hiç değmez). Yeniden anahtarlamada uyarı: eski yedekler ESKİ anahtarla açılır. **(3) restore:** `db.dump` → eski yol değişmeden; `db.dump.age` → anahtar gerekir. Giriş: `--schluessel <dosya>` ya da `read -rs` → `/dev/shm` 600 + trap rm; argv/log'a asla. Erken kontrol: `age-keygen -y` çıktısı == künyedeki `backup_pubkey`, değilse `pg_restore`'dan önce dur. `restore.sh:103` kontrolü iki adı da kabul etmeli; `:134` boyut kontrolü dosya düzeyinde kalır (künyede `dump_bytes` = diskteki dosya), bütünlüğü age AEAD + mevcut `pg_restore -l` (`:141-142`) taşır. storage/caddy-pki: `age -d | tar -x` akışla. **Yeni bundle dosyası önerilmez** — mantık `backup.sh`/`restore.sh`/`install.sh` içinde; yardımcı dosya açılırsa dört liste (BUNDLE_DATEILER · Dockerfile COPY · workflow `paths` · smoke `BUNDLE_DATEIEN`, `tools/onprem-manifest.mjs:37,73-79`) birlikte. `.env.template`'e `BACKUP_PUBKEY=` **boş**, `BACKUP_ZIEL=` (`.env.template:255`) yanına: J4 (`update.sh:513-516`) eski kutuya boş ekler, `install.sh` doldurur, sonraki güncellemeler dokunmaz (taban=bizim=boş). Açık anahtar sır değil (G2 temiz) ama kutuya özgü → şablona değer yazılmaz. Biçim: `^age1[0-9a-z]{58}$`. **(4) Disk:** bugün geçici dizin HEDEF'in içinde (`backup.sh:122`) → düz ara dosya hedefe (Storage Box/Volume) yazılır, **bu yasaklanmalı.** Kural: düz ara ürün yalnız kutunun kendi diskinde (`$SCRIPT_DIR/.yedek-arbeit`, 700 — canlı DB zaten orada düz, yeni maruziyet yok), hedefe yalnız `.age`. storage: `tar -cz … \| age` tam akış. db: yerel geçiciye `pg_dump` → mevcut `pg_restore -l` (`:204-205`) aynen → `age -o hedef/db.dump.age` → rm (SSD'de `shred` anlamsız). caddy-pki (CA özel anahtarı!) bugün `docker compose cp` ile hedefe düz iniyor (`:173`) → yerel geçiciye. Yer kontrolü (`:136-138`) ikiye: hedef ≥ 2×(db+storage)+pay (değişmez), **yerel** ≥ db+pay (yeni). age ek yükü ihmal edilebilir. Künye (`backup.meta.json`) düz kalır (sır yok, HMAC parmak izleri) + `verschluesselung`, `backup_pubkey` alanları. **Bedel (KURULUM'a yazılmalı):** göç-öncesi yedekten geri dönüş de özel anahtar ister — `restore.sh` zaten elle + ONAY'lı (`restore.sh:315`), yani insan orada; anahtar kaybı = tüm yedek kaybı (DEK ile aynı sınıf, aynı Notfallblatt) |

### O-175 — Şifrelemeden önceki sürümden gelen kutu `update.sh` ile kendi kendini kurtaramaz: geri alma `--sicherungsschluessel` bilmeyen eski `install.sh`'ı geri koyar ✅ **gelöst (`63abe5f1`; KHS §5b T14 WSL'de ölçüldü 09.10.2026)**

| Alan | İçerik |
|---|---|
| **Ne** | O-173'ün fail-closed kararının yan etkisi. Anahtarı olmayan eski kutuda iki yol var. (i) Getirilen sürümde bekleyen migration **varsa**: Schritt 8 yeni `backup.sh`'ı çağırır, o exit 1 verir, `geri_yukle` (`update.sh:475-487`) Schritt 7'de yazılan **bütün** dosyaları geri koyar, eski `install.sh` ve eski `backup.sh` dahil (`update.sh:673-684`). Hata mesajı `backup.log`'a ve oradan `--sicherungsschluessel`'e yönlendiriyor (`backup.sh:97-98`). Ama kutudaki `install.sh` bu bayrağı tanımıyor. Kutu her gece aynı yerde durur, eski `backup.sh` düz yedeğe devam eder, bir daha hiç güncellenmez. Fail-closed burada tam tersine döner. (ii) Bekleyen migration **yoksa**: güncelleme geçer, sonra gece yedeği her gece exit 1 verir. Gece yedeği için alarm maili yok (mail yalnız `update.sh`'ın `durumu_yaz` yolunda), tek iz `backup.log` |
| **Nerede** | `onprem/update.sh:475-487` (`geri_yukle`), `:673-684` (Schritt 8) · `onprem/backup.sh:96-104` |
| **Tip** | G (kutu işletimi, güncelleme zinciri) |
| **Kutuda ne olur** | Bugün **0 kutu** (sahada müşteri yok, beta verisi silinebilir). Etki, şifrelemeden önceki bir paketle kurulmuş ilk gerçek kutuda ortaya çıkar. (i)'de kutu sessizce eski sürümde kalır, güvenlik düzeltmeleri dahil hiçbir güncelleme gelmez. (ii)'de kutunun yedeği olmaz ve kimse bunu görmez |
| **Çözüm** | Bu sürümle kurulan bütün kutular anahtarlı doğar (`install.sh:605-624`, `PFLICHTFELDER` `:664`), yani sorun yalnız bundan önceki paketlerle kurulmuş kutuları vurur. Seçenekler: (a) **en ucuz, tavsiyem:** `update.sh` Schritt 8 `backup.sh`'tan ÖNCE `BACKUP_EMPFAENGER`'i okusun. Boşsa kendi `fehler` mesajını versin: "Box vor Sicherungsverschlüsselung eingerichtet — `sudo bash install.sh --sicherungsschluessel` erst nach manuellem Holen des aktuellen Pakets" ya da `--neu` (KURULUM'a bir paragraf). Yani yanlış bayrağa yönlendirmesin. (b) Bu tek durumda `geri_yukle` yeni `install.sh`'ı yerinde bıraksın ki bayrak kutuda bulunsun. Daha dürüst bir çözüm ama geri almanın "hepsi ya da hiçbiri" sözünü deler, ancak 1 kutu bile sahaya çıkarsa değer. (ii) için: gece yedeği hatası `update.sh`'ın mevcut alarm maili kanalına (`mail_gonder_container`) bağlansın. Panel O-82 ile ayrıca bekliyor |
| **Durum** | ✅ `gelöst` — **09.10.2026 gece, KHS §5b T14 (WSL `hafer-turm-9`, 0.4.0+773f9ea; yerel registry'de işaretli `install.sh` + `0999` noop migration'lı test imajı):** (A) anahtarsız → `update.sh` rc 1, `install.sh` yazıldı ve geri alındı (SHA = önce), `install-sicherungsschluessel.sh` 700 root ve **yeni** paketten, durum `yedek_basarisiz` + `grund=sicherungsschluessel_fehlt`, api imajı ve DB değişmedi. (B) kopya `--sicherungsschluessel` (PTY ile; pipe'ı TTY kontrolü reddediyor, doğru) rc 0 → `update.sh` rc 0, `vor-migration` yedeği yalnız `*.age`, `0999` uygulandı, kopya silindi, 8/8 sağlıklı, anahtar hiçbir logda yok. (C) kutu temizlendi (0999 defterden silindi, gerçek `:beta`'ya geri). Yan bulgu: alarm maili SMTP'siz kutuda "gönderildi" sayılıyor → **O-185**. Önceki: `geplant` — **07.10.2026 akşam: kod `63abe5f1` (push edildi) → `gelöst` adayı.** Ek (kalter agy): ilk güncellemede J4 `BACKUP_EMPFAENGER`'i bir kez çakışma diye loglar (taban yok, bizim boş, müşteri dolu) — değer korunur, sonraki ok koşusunda kaybolur; kabul. Commit gelince ve §5b T14 (update.sh zinciri kutuda) ölçülünce kapanır. WSL'de ölçülen: nightly anahtarsız rc 1 ve 1 alarm, ikinci koşu sessiz; kopya betik lib'siz kutuda anahtarı kurdu (rc 0); lib'siz `--neuer-jeton` yine rc 1. **Ön kontroldeki varsayımım yanlıştı:** "eski lib'ler source edilir" demiştim. `lib-ip.sh` (06.10) ve `lib-setup-jeton.sh` (07.10) şifreleme öncesi kutuların çoğunda yok. Düzeltme: `install.sh` yalnız `--sicherungsschluessel` modunda lib'leri varsa source ediyor, diğer modlar eskisi gibi düşüyor; test anahtar dalının lib çağırmadığını kilitliyor. Ön kontrol `backup.sh:89-104` ile aynı (age + biçim; guvenlik şartı). **Kabul edilen kalıntı:** (i)'nin maili eski imajdan `yedek_basarisiz` metniyle gider. "Düz yedek devam ediyor" uyarısı mailde yok, yalnız update.log `fehler` satırında ve KURULUM §5'te. Bunu kabul ettik çünkü bugün etkilenen kutu sayısı 0, mail 7 günde bir tekrar ediyor, log yolunu gösteriyor. Ön kontrol kararı: K2b.18 (d), 07.10.2026. **(i) kararı:** "aktuelles Paket holen, install.sh ersetzen" mesajı **tuzaktır**: elle değiştirilen `install.sh` bir sonraki koşuda J3 sapma kontrolüne (`update.sh:404-409`) takılır, kutu `konflikt`'te kalır. `.praxura-stand/` kopyası da çalışmaz: `SCRIPT_DIR` (`install.sh:58`) stand dizini olur, `source lib-ip.sh` (`:118`) düşer. Seçilen yol: anahtar boşsa Schritt 8 `geri_yukle`'den ÖNCE bundle'ın `install.sh`'ını **kutu kökünde** `install-sicherungsschluessel.sh` (root, 700) olarak bırakır. Manifest dışı olduğu için J3 görmez, geri alma bu dosyaya dokunmaz, `SCRIPT_DIR` doğru, eski lib'ler source edilir. Şart: `--sicherungsschluessel` dalı (`:221`'den sonra) lib fonksiyonu ya da `:221`'den sonra tanımlanan fonksiyon çağırmamalı (builder doğrular). Başarılı ilk güncellemede Schritt 11 dosyayı siler. Durum `yedek_basarisiz` + `"grund":"sicherungsschluessel_fehlt"` yazılır, yeni sonuc adı kullanılmaz: kutu eski imajda takılı ve eski `update-alarm-mail.mjs` yeni adı yalnız "unbekannter Status" olarak gösterir (`:34`). **(ii) kararı:** (C) `backup.sh` içinde EXIT trap, yalnız `--sebep nightly` + exit≠0, trap age/anahtar kontrollerinden (`:88`) ÖNCE kurulur. Ayrı durum dosyası `son-sicherung-bildirim.json`, 7 günde bir tekrar. (A) reddedildi: `update.sh` bildirim fonksiyonlarını Schritt 7'den önce kullanıyor, ilk koşuda henüz yazılmamış bir lib'i source edemez (bootstrap). (B) reddedildi: birim yine aynı mail kodunu ister, üstüne systemd kurulumu ekler. Kopya kabul edildi, iki yerde `mail_gonder_container` tek arayüz (`update-alarm-mail.mjs` argv), README notu ile |

### O-174 — Imajlar yalnız amd64; `install.sh` mimari kontrolü yapmıyor, ve CX23 (40 GB) disk ön kontrolüne takılır 🟡 **offen**

| Alan | İçerik |
|---|---|
| **Ne** | Yayın workflow'larında `platforms:` yok (`grep -rn platforms .github/workflows/` → 0; `publish-frontend.yml:171`, `publish-calendar-api.yml:197/296` `build-push-action`, runner `ubuntu-latest`) → `api`/`frontend` imajları yalnız amd64. `install.sh`'ta `uname -m` kontrolü yok. Ayrıca `install.sh:234` **boş** alan ≥ 40 GB ister; 40 GB diskli sunucuda (Hetzner CX23) boş alan ~36 GB kalır |
| **Nerede** | `.github/workflows/publish-*.yml` · `onprem/install.sh:224-235` |
| **Tip** | G (kurulum ön kontrolü) |
| **Kutuda ne olur** | Hetzner CAX (ARM) seçen praksiste kurulum `docker compose pull`'da "no matching manifest" ile ortada düşer, mesaj "Was tun" vermez. CX23 seçen praksis ön kontrolde "Zu wenig freier Speicher" alır |
| **Çözüm** | Kılavuz (K2b.8 kısım 2, şimdi): öneri **CX33** (4 vCPU · 8 GB · 80 GB, x86), "kein CAX/ARM". Kod (küçük, builder): `install.sh` ön kontrolüne `uname -m` = `x86_64` değilse `fail` (Gefunden/Erwartet/Was tun). Çoklu mimari yayın şimdilik gerekmez (`unkritisch` adayı, mini-PC/ARM müşterisi gelirse yeniden) |
| **Durum** | `offen` — kılavuz kısmı K2b.8 kısım 2, kod kısmı sahipsiz (L-listesine küçük iş) |
| **Not (07.10.2026)** | `install.sh:228-233` kontrolü yazıldı (K2b.18 b, commit bekliyor). Kalan boşluk: `windows/praxura-installieren.ps1`'de mimari kontrolü yok (`grep -i PROCESSOR_ARCH\|arm64` → 0) — Windows-on-ARM dizüstünde WSL + Docker kurulur, ancak sonra `install.sh` reddeder. Küçük iş: ps1'in başında `$env:PROCESSOR_ARCHITECTURE -ne 'AMD64'` → `Fehler`. Kod tamamlanınca madde `gelöst` |


### O-176 — K2b.14 başlatıcı tasarımı (ön kontrol 08.10.2026): tek kaynak image, ama başlatıcının kendisi `main`'den gelir — arayüz sözleşmesi ve üç tuzak 🟡 **kısmen gelöst (08.10.2026, kod `e93c86ab` + `6dd3b2ce`) — kalan: KHS §5b T17 (a)(b)**

| Alan | İçerik |
|---|---|
| **Ne** | O-157'yi kapatacak tasarım: `praxura.de/install.sh` (Linux) ve `/install.ps1` (Windows) statik başlatıcıları paketi git'ten değil kanal image'ından (`docker create` + `docker cp /app/onprem-bundle`, `update.sh:153-160` deseni) alır, sonra paketteki `install.sh`'ı çalıştırır. Hüküm: **GEÇER, KAYITLA** — G1/G2/G3/G8 temiz, ama aşağıdaki şartlar olmadan O-157'nin sınıfı başka bir kapıdan geri gelir |
| **Nerede** | Ölçümler 08.10.2026: anonim GHCR token ile `calendar-api:beta` 200 · `:stable` 404 · `frontend:beta` 200 · `:stable` 404 → paketler **public**, kutuya pull jetonu gerekmez (G2 temiz). `.vercelignore:42` `onprem/`'u bütünüyle dışlıyor, `vercel.json`'da `buildCommand` yok → `/install.sh` → `/onprem/...` rewrite'ı **404 verir**. `onprem/install.sh:167-171` pipe'tan gelen stdin'i reddediyor (`[ ! -t 0 ]` → fail, metni hâlâ "Repository klonen"). `install.sh:444` Docker kurulum teklifi, `:761` ve `:777` kanal sorusu + beta'ya düşme. `onprem/windows/praxura-installieren.ps1:1` UTF-8 BOM + `#Requires -RunAsAdministrator`, `:46` `$Zweig`, `:263` `git clone`. ps1 yolu 4 testte sabit (`tools/onprem-setup-jeton.test.js`, `onprem-setup-kapi.test.js`, `onprem-tls-modus.test.js`, `funktionskarte-shell.test.js`). `publish-calendar-api.yml:171` / `publish-frontend.yml:158` `org.opencontainers.image.version` etiketini basıyor; `manifest.json` `surum` taşıyor |
| **Tip** | F (dağıtım kanalı) + C (yayın yüzeyi) |
| **Kutuda ne olur** | Şartsız uygulanırsa: (1) başlatıcı `main`'den, `install.sh` image'tan → başlatıcının `install.sh`'a geçirdiği bayrak eski `:stable` paketinde yoksa kurulum düşer (O-157'nin ters yönü). (2) Başlatıcı kanalı seçer, `install.sh` adım 11'de tekrar sorar → kullanıcı farklı seçerse paket bir kanaldan, image öbüründen (O-157 aynen). (3) `docker cp` ile `compose pull` arasında `:stable` terfi ederse paket N, image N+1. (4) Var olan kutuda başlatıcı yeniden çalıştırılırsa paket dosyalarını `update.sh`'ın manifest/stand mantığını (`.praxura-stand`, J3) atlayarak ezer. (5) PowerShell 5.1 `irm` charset'siz yanıtı ISO-8859-1 çözer → BOM `ï»¿#Requires` olur, umlautlar bozulur; `irm\|iex`'te `param()` bayrak alamaz, `#Requires` dosyasız bağlamda güvenilmez |
| **Çözüm** | K2b.14 şartları (builder): **(a) Sözleşme:** başlatıcı → `install.sh` arayüzü yalnız `--kanal <beta\|stable>` (+ isteğe bağlı `--surum`); `install.sh` bu bayrakla adım 11 sorusunu **atlar**. Bayrak `:stable`'ın ilk terfisinden önce pakete girmeli (bugün `:stable` yok → eski paket sorunu yok; O-157 zaten "terfiden önce" diyordu). **(b) Kendi tutarlılık kontrolü:** `install.sh` compose pull sonrası `api` ve `frontend` image'larının `org.opencontainers.image.version` etiketini kendi `manifest.json` `surum`'uyla karşılaştırır; fark → `fail` ("Kanal wurde während der Einrichtung aktualisiert — erneut starten"). Bu (2)'yi ve (3)'ü bir arada kapatır, O-157'nin asıl kabul ölçütüdür. (builder `:beta` image'ında etiketin dolu olduğunu ölçer — `publish-calendar-api.yml:304` ikinci iş `meta` etiketini kullanıyor.) **(c) Yalnız boş hedef:** `/opt/praxura/onprem/.env` varsa başlatıcı paketi açmaz, durur: "Box bereits eingerichtet — Aktualisierung: `sudo bash /opt/praxura/onprem/update.sh`, Neuaufbau: `install.sh --neu`". **(d) stdin:** başlatıcı `exec bash install.sh --kanal "$K" "$@" </dev/tty`; `/dev/tty` açılamazsa (cloud-init, CI) Gefunden/Erwartet/Was tun ile durur. `install.sh:167` kontrolü kalır, yalnız metni "Repository klonen" yerine başlatıcı satırını gösterir. **(e) Docker:** başlatıcıda yaşar (tavuk-yumurta: `docker create` için Docker gerekir; ortak lib olamaz çünkü başlatıcı paketten önce, tek başına iner). `install.sh:444` kurulum dalı çıkar, yerine yalnız kontrol + başlatıcı satırına yönlendirme (Docker + compose v2). ps1 WSL içinde kendi kurulumunu (`ps1:247`) sürdürür — aynı `get.docker.com`, iki kopya kabul (biri PowerShell, biri bash; ortaklaştırılamaz). **(f) Mimari:** başlatıcı `uname -m` = `x86_64` kontrolünü Docker kurmadan **önce** yapar (O-174); ps1'e `$env:PROCESSOR_ARCHITECTURE -ne 'AMD64'` (O-174'ün kalan işi). **(g) Kanal:** varsayılan `stable`; 404 ise **sessiz düşme yok** — açık soru `[J/n]` ve ekrana tek cümle: "Beta-Kanal; Wechsel zu stable später erst, wenn stable Ihre Version erreicht hat" (O-148: kanal yalnız ileri, `migrate.js` downgrade'de durur). `/dev/tty` yoksa ve `--kanal` verilmemişse düşmez, durur. **(h) Windows:** yayınlanan dosya `#Requires`'a dayanmaz; yönetici değilse kendini `%TEMP%`'e yazar, `Start-Process powershell -Verb RunAs -ArgumentList '-ExecutionPolicy Bypass -File …'` ile yeniden başlar. Bayrak için kılavuz satırı `& ([scriptblock]::Create((irm https://praxura.de/install.ps1))) -Kanal beta`. Adım 5: WSL içinde aynı docker-cp; `$Zweig`/`$Repo` ve `git` paketi kalkar. **(i) Yayın yolu:** rewrite **değil** (onprem/ dışlı, build adımı yok). Tek kaynak yayınlanan klasörde: `installieren/install.sh` + `installieren/install.ps1` (ps1 `git mv` ile oradan taşınır, 4 test yolu aynı commit'te) + `installieren.html`; `vercel.json` `rewrites` `/install.sh` → `/installieren/install.sh`, `/install.ps1` → `/installieren/install.ps1` (statik, fonksiyon değil — G8 temiz) ve `headers` iki dosyaya `Content-Type: text/plain; charset=utf-8`. ps1 BOM'u kalabilir (charset verilince 5.1 doğru çözer) — builder 5.1'de `irm\|iex` ile ölçer. Kopya + sürüklenme kapısı reddedildi: ikinci kopya, kapanan sorunun (iki kaynak) aynısı. Başlatıcı **paket listesine girmez** (BUNDLE_DATEILER/Dockerfile COPY/workflow `paths`/smoke değişmez; yalnız `install.sh` değiştiği için manifest hash'i) — kutuda başlatıcıya iş düşmez, `update.sh` onu bakımla yüklenmemeli. **(j) Kapı (`tools/check-onprem.sh`, yeni sayaçlar, taban 0):** `installieren/` altında `git clone\|github.com\|--branch` = 0 (O-157 geri dönüş koruması) · başlatıcıdaki image adı = `onprem/.env.template:41` image adı (iki yerde duran tek dize) · başlatıcının geçirdiği her `--bayrak` `install.sh` argüman ayrıştırıcısında var · `installieren/` `.vercelignore` kurallarına takılmıyor · `bash -n installieren/install.sh`. **Güvenlik notu (`guvenlik`'e, vetom değil):** `curl\|sudo bash` → `main`'e her push yeni kutuların root'unda koşan dosyayı anında değiştirir; image imza doğrulaması (cosign) ayrı karar |
| **Durum** | `geplant` (K2b.14) — kod ve iki temiz kurulum ölçümü (Windows 5.1 + Linux) gelince O-157 ile birlikte `gelöst`. `:stable` terfisi hâlâ buna bağlı · **08.10.2026 kod:** `installieren/install.sh` (yeni, agy + soğuk denetçi; `main()` + son satır çağrı, x86_64, `/dev/tty`, `.env` varsa dur, Docker apt+GPG, `stable` yoksa açık soru, digest ile `docker create`, `exec … --kanal=`) · `installieren/install.ps1` (= eski `onprem/windows/praxura-installieren.ps1`, `git mv`; kendi kopyası `%ProgramData%\Praxura\install.ps1`, yönetici değilse RunAs ile yeniden başlar, `-Kanal` (`-Zweig`/`-Repo` kalktı), adım 4 Docker apt+GPG, adım 5 digest ile image'tan, `.env` varsa dosyalara dokunmaz, adım 6 `--kanal=`) · `onprem/install.sh` (`--kanal=` adım 11'i atlar, Docker kurulum dalı kalktı, pull sonrası api+frontend etiketi = `manifest.json` `surum` değilse dur, pipe hata metni başlatıcıyı gösterir) · `vercel.json` rewrite + `text/plain; charset=utf-8` + `no-store` · `check-onprem.sh` başlatıcı bloğu (git/github 0, image tabanı = `.env.template`, `--kanal=` var, `bash -n`, `.vercelignore`) — negatif test yakaladı · `funktionskarte.mjs` `installieren/`'ı da tarar · `installieren.html` (noindex, OS tanıma, Kopieren, "önce doğrula" yolu). **Küçük karar (Claude):** guvenlik S-52 Nr. 6'daki digest yalnız paket çıkarmada kullanılır; `.env`'e tag yazılır (Watchtower kanalı izler) — aynı-sürüm güvencesi install.sh'taki etiket kontrolünden gelir. **WSL ölçümü (yönlendirilmiş hedef, kutuya dokunmadan):** kurulu kutuda dur ✅, yanlış kanal ✅, açık `stable` yok → dur ✅, `stable` yok + `n` → dur ✅, `beta` digest ile çekildi + 0.4.0 paketi çıktı + `--kanal=beta --foo` geçti ✅, geçici konteyner kalmadı ✅. Açık: temiz Linux + temiz Windows (5.1) tek satır → KHS §5b T17 · **08.10.2026 (K2b.10, onprem sicil turu):** `geplant`→🟡 `kısmen gelöst`; commit'ler doğrulandı: `e93c86ab` (başlatıcılar + kapı + `vercel.json`) · `6dd3b2ce` (install.ps1 son işareti) · `497ebea8` (T17 c canlı ✅). O-157 ile aynı kalan: T17 (a)(b) |

### O-177 — S-43 kalanı: eigene-Adresse/`tls internal` yolunda yerel kök CA'ya Name Constraints (ön kontrol 08.10.2026) 🟡 **kısmen gelöst (`45268912`, K2b.19) — kalan: KHS §5b T19 (şart 7 ölçümü)**

| Alan | İçerik |
|---|---|
| **Ne** | `install.sh` klassisch+internal yolunda kökü kendisi üretir (`CA:true, pathlen:1`, ad kısıtlı), Caddy'ye `pki { ca local { root … } }` ile verir; ara sertifikayı Caddy bu kökten üretir. Kök anahtarı ele geçse bile yalnız kutunun adı için sertifika basılabilir (`guvenlik` S-43 öneri 1) |
| **Nerede** | `onprem/install.sh:744-748` (internal dalı), `:1002-1006` (acmedns'ten internal'a düşüş), `:1283` (kök yolu ipucu) · `onprem/Caddyfile` (global blok yok) · `onprem/docker-compose.yml:550-606` (caddy) · `onprem/backup.sh:287-305` · `onprem/restore.sh:799-825` · `installieren/install.ps1:418-422` · `onprem/KURULUM.md:669` |
| **Tip** | G (kutu tarafı, yerel) + E benzeri (yerel sır — **müşterinin**, image'a girmez) |
| **Kutuda ne olur** | Şartsız uygulanırsa beş kırılma: **(a)** kök açıkça verilince Caddy kökü kendi deposuna (`/data/caddy/pki/authorities/local/root.crt`) **yazmaz** (Caddy kaynağına göre beklenen, ölçülecek) → `install.ps1:420`, `KURULUM.md:669`, `install.sh:1283` olmayan dosyayı kopyalar, cihazlar kökü alamaz. **(b)** Eski kutuda depodaki otomatik kökün **anahtarı** (`…/local/root.key`) yerinde kalır, `backup.sh` `/data/caddy/pki`'yi aynen yedekler → S-43 anahtarı kısıtsız haliyle yaşamaya devam eder. **(c)** Depodaki eski ara sertifika eski köke imzalı kalırsa zincir kırılır (Caddy'nin bunu kendisi yenileyip yenilemediği ölçülmedi). **(d)** Yalnız `DNS:` kısıtı konursa RFC 5280'e göre IP tipi kısıtsız kalır → anahtarla herhangi bir IP adresine (yönlendirici arayüzü vb.) sertifika basılır. Kısıt `fritz.box`/`home.arpa` gibi üst ada verilirse aynı ağdaki başka cihazlar (FRITZ!Box arayüzü) kapsama girer. **(e)** `pki` global seçeneği acmedns kutusunda da yüklenirse pki uygulaması yerel CA'yı yaratır — S-47 Bed. 2 ruhuna aykırı |
| **Çözüm** | Şartlar (builder): **1. Yer:** bind mount `./volumes/caddy-ca:/etc/praxura/ca:ro` (acmedns'in `/etc/praxura/acmedns` deseni, `/data` altında değil) — `--neu` `caddy_data`'yı siler (`install.sh:579`), kök ise aynı adla yeniden kurulumda **kalmalı** ki cihazlar yeniden içe aktarmasın. Dosyalar root:root, anahtar 600. **2. Kısıt:** `nameConstraints=critical,permitted;DNS:<HOST_PART tam>,excluded;IP:0.0.0.0/0.0.0.0,excluded;IP:::/0` — üst ad değil tam ad; IP adresi girilmişse bu yolda **red** (DHCP'de zaten kayar). Geçerlilik 10 yıl, ECDSA P-256. **3. Caddyfile:** dosyanın en başına global blok `{ import /etc/praxura/ca/*.caddy }`; `pki.caddy`'yi yalnız klassisch+internal'da `install.sh` yazar. Eşleşmeyen glob Caddy'de hata değil (ölçülecek: `caddy adapt` iki modda). acmedns'e geçen kurulum (`install.sh` code/vorhanden dalı) `pki.caddy`'yi **siler**. Tek Caddyfile, fark dosyada — G7 temiz. **4. Kök değişimi** (ilk kez · ad değişti — `openssl x509 -ext nameConstraints` tam adı içermiyor · dosya yok): yeni kök yazılmadan önce `caddy_data` içindeki `pki/authorities/local/` (otomatik kök + anahtarı + ara) silinir — (b)+(c) ikisini kapatır; kurulum sonunda 'tüm cihazlarda eski kökü kaldırıp yenisini içe aktarın' uyarısı. **5. Dağıtım yolları:** kök artık host'ta `volumes/caddy-ca/root.crt` — `install.ps1` adım 9 WSL'den oradan okur (yoksa eski `docker compose cp` yolu, eski kutu için), `KURULUM.md:669` ve `install.sh:1283` aynı yolu gösterir. `Import-Certificate` kendisi değişmez. **6. Yedek:** `backup.sh` klassisch+internal dalında `volumes/caddy-ca`'yı **aynı** `caddy-pki.tar.gz.age` arşivine ekler (yeni dosya türü yok, manifest sözleşmesi aynı), `restore.sh` geri koyar — KURULUM §8.3 'geri yüklemeden sonra yeniden içe aktarma yok' sözü korunur. acmedns dalı değişmez (yedeklemez). **7. Ölçüm (guvenlik'in 'nicht geprüft'ü):** Windows'ta Edge/Chrome + Firefox + iOS'ta kısıt dışı ad (ör. `test.invalid`) için basılan yaprak **reddediliyor** mu; kısıtlı kökle Caddy açılıyor ve ara sertifikayı üretiyor mu. Ölçülmeden 'S-43 kapandı' yazılmaz. **Göç:** sahada eigene-Adresse kutusu yok (canlı müşteri yok, ilk gerçek kutu acmedns) → `update.sh` göç adımı **yazılmaz**; cihaz başına yeniden içe aktarma sessiz yapılamaz, eski test kutusunda yol `install.sh`'ı yeniden çalıştırmak. **Korkuluk:** G1 yok (her şey kutuda) · G2 yok, **şartıyla**: kök ve anahtar kurulumda kutuda üretilir, image'a/pakete/repoya asla girmez · G3 yok · G8 yok (dış zincir eklemiyor). Kapsam dışı, `guvenlik`'e not: ad kısıtı kod imzalamayı sınırlamaz — kökü içe aktarılmış Windows'ta anahtar Authenticode'a da yarar; köke `extendedKeyUsage=serverAuth` eklemek Windows'ta EKU zinciriyle bunu keser (ölçülecek), karar onların |
| **Durum** | `geplant` — **KHS K2b.19** (08.10.2026, koordinatör). ⚠️ **`guvenlik` S-53 şartları bu tasarımdan sıkı ve onları ezer:** kök anahtarı üretimden sonra **silinir**; Caddy'ye anahtarsız kök + 5 yıllık ara sertifika/anahtar verilir (Caddy ara sertifikayı yenilemez → 5 yıl sonra elle yenileme, bir sonraki ön kontrolde takvimi sorulacak); kısıt kökte **ve** arada, IP excluded, EKU `serverAuth`. Bu yüzden şart 6'daki 'kökü yedekle' kısmı kök anahtarı için geçersiz (yedekte yalnız ara anahtar + kök sertifikası kalır), şart 4'teki kök yenileme mantığı ara sertifika için de geçerli. Şart 1/3/5/7 ve (a)-(e) kırılmaları aynen duruyor. Koordinatör kodu yazmadan önce yeniden soracak. Kapanış: kod + şart 7 ölçümü; `guvenlik` S-43'ü ayrıca kapatır · **08.10.2026 `45268912` (K2b.19) — kırılmalar tek tek kapandı:** (a) kök `volumes/caddy-ca/root.crt`; `install.sh` son mesajı, KURULUM §8.3 ve `install.ps1` adım 9 oradan okur, eski kutu için ps1'de `docker compose cp` geri düşüşü kalır. (b) üretimde caddy_data içindeki `pki/authorities/local` silinir (`|| true`). (c) ara sertifika bizden, Caddy deposuna CA yazmıyor (ölçüldü). (d) IP excluded + erken ad kontrolü (adres yolu adım 10). (e) `pki.caddy` yalnız klassisch+internal'da yazılır, aksi hâlde `install.sh` ve `restore.sh` (acmedns dalı) siler; boş glob = yalnız uyarı (`caddy adapt` rc 0, ölçüldü). Bind mount `./volumes/caddy-ca:/etc/praxura/ca:ro`, root:root, anahtar 600. Üretim, son modun belli olduğu yerde ilk `up -d`'den hemen önce — kod yolunun internal'a düşüşünde de (ad `*.box.praxura.de`, kısıt o tam ada). Yedek `pki_sammeln` (caddy_data/pki + `_praxura-ca`), geri yükleme `pki_zurueckspielen`. Göç adımı yok (sahada eigene-Adresse kutusu yok). **5 yıl sorusu cevaplandı:** `update.sh` `zertifikat_pruefen` internal modda `volumes/caddy-ca/intermediate.crt`'yi 90 gün kala uyarır (sabit anahtar `lokale_ca_laeuft_ab`, 7 gün tekrar); yenileme `install.sh` (ad aynı, ara CA <90 gün → yeni çift), ps1 eski kökü parmak iziyle kaldırır — cihazlar yeniden içe aktarır, bu bilinçli bedel (kök anahtarı yok). manifest yenilendi, `check-onprem` geçti. Durum → 🟡 `kısmen gelöst`; kalan yalnız T19 (tarayıcıların kısıt dışı adı reddettiği ölçüm). T19 geçince `gelöst`, S-43'ü `guvenlik` kapatır |

### O-178 — K2b.16 „Über diese Software" + K2b.15 kalanı (ön kontrol 08.10.2026): tasarım geçer, beş şartla 🟡 **kısmen gelöst (08.10 gece, commit bekliyor) — kalan: bağlantı listesi düzeltmeleri (a-c), NOTICE OS satırı, Rechtevermerk/LICENSE (KHS §5b T21), K2b.15 praksis URL'leri**

| Alan | İçerik |
|---|---|
| **Ne** | legal-de kararı (08.10): kutu arayüzündeki 404 veren Impressum/Datenschutz linkleri yerine internetsiz çalışan statik `ueber.html` (üretici, sürüm, LICENSE, üçüncü parti lisanslar, kutunun dış bağlantı listesi) + ayarlarda isteğe bağlı praksis Impressum/Datenschutz URL'si. O-58 (b)'nin ve O-42'nin npm yarısının ortak çözümü |
| **Nerede** | Bugünkü durum ölçüldü: depo kökünde `LICENSE` **yok** (`ls LICENSE*` → yok) · `IMAGE_VERSION` hiçbir yerde set edilmiyor (`grep IMAGE_VERSION onprem/ .github/workflows/ api-backend/Dockerfile` → 0) → kutuda `/health` hep `version:"dev"` (`server.js:353`) · sürümün tek kaynağı kök `VERSION` (0.4.0, `publish-calendar-api.yml:90`) · `api-backend/Dockerfile:7` `npm install --omit=dev` (ci **değil** — yani lockfile değil, imajdaki ağaç gerçektir) · `fonts/` (Inter/Outfit, SIL OFL 1.1) frontend imajına giriyor (`frontend.Dockerfile` `COPY fonts`) |
| **Tip** | G (paket içeriği). Yeni sabit host yok — dış adresler yalnız düz metin |
| **Kutuda ne olur** | Doğru kurulursa: kutu dışarı çıkmaz, sayfa LAN'da açılır. Şartsız kurulursa: (1) elle yazılmış bağlantı listesi kutunun gerçek ayarıyla (TLS modu, AI_MODE, SMTP) uyuşmaz → praksise yanlış şeffaflık beyanı, eksikliğinden kötü; (2) yasak-lisans kapısı ilk build'de pm2 (AGPL-3.0) yüzünden kırılır (O-179); (3) sürüm alanı "dev" gösterir |
| **Çözüm** | **Şartlar (builder):** **(1) Lisans dosyası imajda üretilir** — taslak doğru; `npm install` sonrası `RUN node …` (commit'li kopya yok, `--check` yok). Aynı `RUN`'da `npm sbom --omit=dev --sbom-format cyclonedx > /app/sbom.cdx.json` — O-42'nin CRA yarısı bedavaya kapanır. Kural: lisans ifadesi normalize edilir (`Apache-2` → `Apache-2.0`), `OR` içeren ifadede izinli bir dal yeterli, **lisans alanı boş/UNKNOWN = build kırılır** (yasak kadar tehlikeli). Kapı CI build'inde koşar; pre-commit kapısı node_modules'u görmez. **(2)** `vendor/LICENSES.txt` commit'li sabit dosya — **fontlar da içine** (OFL 1.1 metni dağıtımda zorunlu). **(3)** Kutu imajları `onprem/NOTICE.md`'den; taban imajların işletim sistemi paketleri (alpine busybox GPL-2.0 vb.) için tek satır "Quellcode: upstream" — npm script'i bunları görmez. **(4) Sürüm:** iki workflow'a `build-args: IMAGE_VERSION=<VERSION>+<sha7>`, Dockerfile'larda `ARG`→`ENV`; `/health` zaten gösteriyor, yeni alan açılmaz. **(5) Bağlantı listesi env'den üretilir, sabit metin değil:** `api`'de tek tablo (ör. `lib/verbindungen.js`) `MERKEZ_URL`, `CADDY_TLS_MODUS` (api'ye geçirilmeli — bugün geçmiyor), `AI_MODE`, `SMTP_HOST`'tan satır seçer; sabit satırlar: ghcr.io (Watchtower + update), Docker Hub (install/update, upstream imajlar). Host işletim sistemi (NTP, apt) "nicht Praxura" notuyla. api ulaşılamazsa sayfa statik kısımları gösterir, liste yerine "nicht abrufbar". **Rota:** `GET /api/ueber` (JSON: sürüm + bağlantılar) + `GET /api/ueber/lizenzen` (text/plain, imajdaki dosya) tek dosyada (`routes/`); Vercel `api/` değil → G8'e değmez. Caddy imajı api imajındaki dosyayı göremez, rota doğru yol. **Pakete girenler:** `ueber.html` (+ varsa `ueber.js`) → `frontend.Dockerfile` COPY **ve** `publish-frontend.yml` `paths:` (aynı sırayla, O-57). `vendor/LICENSES.txt` → `COPY vendor` zaten alıyor; `paths:`'ta vendor kalıbı var mı builder doğrulasın. Üretici script `api-backend/` build bağlamının **içine** konmalı (`api-backend/tools/…` + Dockerfile'a `COPY` satırı) — kök `tools/`'u api build'i görmez; `publish-calendar-api.yml` `paths:`'a eklenir. **manifest.json / BUNDLE_DATEIEN / `onprem-manifest.mjs`: hiçbiri değişmez** — onlar `onprem-bundle/` (compose + kabuk betikleri) içindir, uygulama dosyası değil (istisna: O-180'in compose satırı). **SaaS (G7):** `ueber.html` `setup.html` emsaliyle `.vercelignore`'a; SaaS'taki çalışan Impressum/Datenschutz linkleri O-58 (a)'nın `IST_KUTU` dalında aynen kalır, kutuda link `ueber.html`'e gider — tek kod, bayrak dalı. `/api/ueber*` SaaS VPS'inde de var, zararsız. **K2b.15 kalanı (praksis URL'leri):** owner ayarı → `profiles`'a kolon (owner seviyesi kuralı), migration zinciri yolu (tip D: `api-backend/db/migrations/` + döküm + tablo kaydı), önce `db-ustasi`; boşsa link yok. **Açık sorular:** (a) Ürünün kendi `LICENSE`'ı yok — sayfanın "LICENSE kısa metni" yazılmadan sayfa eksik; metin legal-de/Kemal. (b) `guvenlik`'e: internete açık (Hetzner) kutuda tam bağımlılık sürüm listesi + SMTP host'u login'siz mi? Önerim: lisans metni ve bağlantı listesi oturum açmış kullanıcıya, üretici + sürüm herkese açık — lisans bildirimi lisans sahibine (praksise) borçludur, kamuya değil |
| **Durum** | `geplant` (K2b.16) — G1/G2/G3/G8 vetosu **yok** · **08.10.2026 gece — uygulama denetimi (commit öncesi, `git diff` + yeni dosyalar):** Şart **(1)** karşılandı: `api-backend/tools/lizenzen-erzeugen.mjs` Dockerfile'da `npm install` hemen sonrası, gerçek ağaç, boş/UNKNOWN/`SEE LICENSE` = kırılır (`:82`), OR/AND/WITH doğru (`:85-91`), `npm sbom` aynı RUN'da. İzin listesine eklenenler (MIT-0, BlueOak-1.0.0, Python-2.0, Unlicense, Public-Domain, OFL-1.1) **kabul** — hepsi izin verici, copyleft yok. pm2/@pm2/agent istisnası isimle ve "veraltet" kırılmasıyla (`:43-50`, `:174-176`) — istisna paket çıkınca kendiliğinden düşer, doğru desen. Küçük not: çıplak `BSD` (`:31`) türü belirsiz (4-clause olabilir); bugün ağaçta varsa sorun değil, ileride listeden çıkarılabilir. Şart **(2)** karşılandı (`vendor/LICENSES.txt`, 5 font OFL metniyle). Şart **(3)** yarım: `COPY --from=onprem NOTICE.md` + `paths:` tamam, **taban imaj OS paketleri satırı yok** → builder `onprem/NOTICE.md`'ye ekler, metin: *„Die Container-Images enthalten außerdem Betriebssystem-Pakete ihrer Basis-Images (z. B. Alpine Linux: busybox, musl; Debian/Ubuntu in den Supabase-Images). Diese stehen unter ihren eigenen Lizenzen, teils GPL-2.0. Praxura verändert sie nicht; der Quellcode ist beim jeweiligen Upstream-Projekt erhältlich (alpinelinux.org, debian.org, ubuntu.com) bzw. über die Quell-Links der Basis-Images."* Şart **(4)** api'de karşılandı (build-arg smoke **ve** push'ta, ARG en sonda, smoke kontrol ediyor). Frontend'e build-arg yok — **kabul**, ama sayfadaki sürüm yalnız api imajının sürümüdür; `paths:` filtreleri yüzünden iki imaj farklı commit'ten olabilir, `ueber.html` bunu "Server-Version" diye etiketlemeli (tanı paketi imaj digest'lerini zaten tutuyorsa yeterli). Şart **(5)** yapı doğru (env'den, `lib/verbindungen.js`), **üç içerik hatası** — koda karşı ölçüldü: **(a)** merkez sıklığı yanlış: „alle 2 Minuten" **host** timer'ının (`lib-ip.sh:123`, yalnız yerel dosya yazar) sıklığı; merkeze çıkan `merkez-istemci/ip-abgleich.js` 60 sn'de bir bakar ama **yalnız IP değişince ya da 6 saatte bir** gönderir (`ip-abgleich.js:114-119`). İçerik de eksik: `/v1/caa` ile **Let's-Encrypt-Kontokennung** de gidiyor (`:207`). **(b)** Docker Hub „wenn sich deren Version ändert" yanlış: `update.sh:811` her gece `docker compose pull` → her gece manifest sorgusu. Ayrıca güvenlik duvarı listesi için gerçek alan adları eksik: Docker Hub = `registry-1.docker.io` + `auth.docker.io` + `production.cloudflare.docker.com`; ghcr = `ghcr.io` + `pkg-containers.githubusercontent.com`. **(c)** kurulum anı eksik: starter (`installieren/install.sh:32,67`) `praxura.de` + `download.docker.com`'a çıkıyor — yalnız ilk kurulumda, host tarafında, ama listede yok. Doğrulandı ve **doğru olanlar:** Stripe (`server.js:3231`, `dsgvo/loeschen.js:212`) ve Google kutuda ölü — kutu compose'unun `api` env'inde `STRIPE_*`/`GOOGLE_*`/`APIFY`/`SENTRY_DSN`/`N8N_*` yok (`onprem/docker-compose.yml:416-530` sayıldı); GoTrue'da SMTP yok (`:200`, O-142). ⚠️ AI satırları bugün **ileri tarihli**: kod `AI_MODE`'u henüz okumuyor (`grep -rn AI_MODE api-backend` → yalnız `verbindungen.js`; `azureClient.js:11` hâlâ `AZURE_OPENAI_*`) — M4.1/M4.11 inince `direkt`/`jeton` adları o sözleşmeyle aynı kalmalı; o turda bu dosya kontrol listesine. Rota + sayfa + `.vercelignore` + `data-rechtslinks` dalı G7'ye uygun (tek kod, `IST_KUTU` dalı), `module/ueber.js`/`ueber.html`'de sabit host yok. **Kalan:** (a)-(c) + NOTICE OS satırı (builder, commit öncesi) · Rechtevermerk + ürün LICENSE (K2b.16 hak devri cevabı, KHS §5b T21) · K2b.15 praksis Impressum/Datenschutz URL'leri (`profiles` kolonu, tip D, önce `db-ustasi`) · hasta sayfaları (booking/booking-request) footer'ı K2b.15 ile |

### O-179 — `pm2` kutudan her 24 saatte `version.pm2.io`'ya çıkıyor; ayrıca AGPL-3.0, O-42 yasak listesiyle çakışıyor ✅ **gelöst (`67b0cab5` Faz 1 · `d2f5dcd9` T20 · `d1a0bf70` pm2 çıktı, 09.10.2026)**

| Alan | İçerik |
|---|---|
| **Ne** | İmajdaki `pm2@5.4.3` (AGPL-3.0) ve `@pm2/agent@2.0.4` (AGPL-3.0). Agent anahtarsız kapalı, ama pm2'nin kendi sürüm denetimi kapalı **değil** — beyan edilmemiş bir tip A dış çağrı |
| **Nerede** | `api-backend/node_modules/pm2/lib/Worker.js:201-206` (`setInterval(vCheck, 24h)`; `God.js:74` her modda başlatır, `pm2-runtime` dahil) → `lib/VersionCheck.js` → `@pm2/pm2-version-check/index.js` (`host:'version.pm2.io'`, `rejectUnauthorized:false`; gönderilen: pm2 sürümü, `os.type()`, uptime, node sürümü, docker evet/hayır). İlk-açılış ping'i `PM2_DISCRETE_MODE` ile atlanıyor (`lib/binaries/Runtime4Docker.js:14`, `lib/Client.js:163-171`), günlük olan atlanmıyor. Kapatma env'i 5.4.3'te yok (`grep -r "DISABLE_VERSION\|PM2_DISABLE" lib` → 0). Agent: `@pm2/agent/src/InteractorClient.js:371-386` — `PM2_PUBLIC_KEY`/`PM2_SECRET_KEY` yoksa başlamaz (bugün yok). SaaS VPS: `api-backend/docker-compose.yml:73` `command:` pm2-runtime'ı **açık yolla** çağırıyor |
| **Tip** | A (+ G lisans) |
| **Kutuda ne olur** | Hasta verisi gitmez (G1 temiz), ama her kutu günde bir kez üçüncü bir firmaya kendi IP'sini + yazılım parmak izini bildiriyor, TLS doğrulamasız. "Kutunun dışarıya kurduğu bağlantılar" listesi bunu yazmazsa beyan yanlış, yazarsa savunulamaz. İnternetsiz kutuda 1,2 sn zaman aşımıyla sessizce düşer — işlev kaybı yok. Lisans: değiştirilmemiş AGPL paketini kaynağıyla (npm paketi zaten JS kaynağı) dağıtmak SUL/n8n gibi bir **yasak değil**, ama O-42'nin kendi listesi AGPL'yi yasak sayıyor → K2b.16 kapısı ilk build'de kırılır. Ayrıca `PM2_PUBLIC_KEY` bir gün set edilirse agent süreç log'larını pm2.io'ya taşır — log'da PHI riski (G1) |
| **Çözüm** | **Tavsiye: pm2'yi bırak, ~40 satırlık `node:cluster` başlatıcısı** (`api-backend/start.mjs`). Bedel listesi: **(1) 2 instance:** `cluster.fork({ NODE_APP_INSTANCE: String(i) })` → `server.js:3833-3874`'teki D3-5 kapısı ve O-146 aynen çalışır (değişken adı korunur). **(2)** `--max-old-space-size` + `--import ./instrument.js` primary'nin `execArgv`'ından işçilere miras kalır (cluster varsayılanı) — Sentry her işçide. **(3) O-83 2. katman (RSS 500M):** işçi 30 sn'de bir `process.memoryUsage().rss` bakar, aşarsa `server.close()` + çıkış; primary `exit`'te geri çekilmeli yeniden fork'lar (sıkı döngü yok). **(4) Sinyal:** node PID 1'de SIGTERM'i kendiliğinden işlemez — primary SIGTERM'i işçilere iletip beklemeli, ya da compose'a `init: true`; yoksa her güncelleme 10 sn SIGKILL bekler. **(5)** İsteğe bağlı kazanç: `runMigrations()` yalnız primary'de bir kez → O-26'nın "her işçi yeniden doğuşunda migration" tetikleyicisi kalkar (advisory lock yine kalsın). **(6) Destek tanısı değişir:** O-83'teki "`pm2 list` ↺ sütunu" yerine primary'nin yeniden-fork log satırı; Dockerfile `PM2_HOME` satırı ve O-83/O-26 notları güncellenir. **⚠️ Sıra (SaaS'ı düşürmemek için, §8):** adım 1 — `start.mjs` + CMD değişir, pm2 bağımlılığı **kalır**; aynı turda VPS'te `check-vps-drift.sh` → `/opt/calendar-api` `command:` override'ı **silinir** (O-84 dersi: image CMD'si kural olsun) → repo kopyası senkron → drift OK. Adım 2 — ancak ondan sonra `pm2` `package.json`'dan çıkar. Ters sırada Watchtower ilk pull'da SaaS'ı crash-loop'a sokar. **Alternatif (önermiyorum):** pm2 kalır, AGPL için O-42'de gerekçeli istisna (legal-de onayıyla) + `version.pm2.io` bağlantı listesine yazılır — ping'i kapatmanın yolu yok, yalnız beyan edilir |
| **Durum** | `offen` — sahibi K2b.16'nın önkoşulu olarak builder; AGPL istisna yolu seçilecekse karar Kemal + legal-de · **08.10.2026 gece, Faz 1 (Claude):** `api-backend/start.mjs` (node:cluster, 2 worker, NODE_APP_INSTANCE 0/1, execArgv Sentry+heap, /proc VmRSS > 500 MB → yalnız o worker, artan bekleme, SIGTERM iletimi) + Dockerfile `CMD ["node","start.mjs"]` + `COPY start.mjs`; pm2 bağımlılığı ve PM2_HOME **kaldı** (SaaS VPS `command:` override hâlâ pm2-runtime). Ölçüldü (WSL, gerçek `calendar-api:beta` imajı, stub server.js): istekler iki worker'a dağıldı, `docker stop` 0,4 s, çökme backoff 2/4/8 s, 660 MB worker ≤30 s içinde yeniden, diğeri ayakta. CI smoke testi gerçek CMD ile push'tan önce. **Faz 2 (Kemal onayı, KHS §5b T20):** VPS `/opt/calendar-api` compose `command:` → `["node","start.mjs"]` (ya da satırı sil) + repo kopyası `api-backend/docker-compose.yml:73` + `check-vps-drift.sh` OK; ardından pm2 + PM2_HOME + `start:cluster` package.json'dan çıkar · **09.10.2026 kapanış (onprem, koda karşı):** Sıra §8'deki gibi doğru yapıldı — önce VPS override (`d2f5dcd9`: `/opt/calendar-api` `command: ["node","start.mjs"]`, yedek `.bak-20261009-pm2`, force-recreate healthy, drift OK; repo `api-backend/docker-compose.yml:75` aynı), sonra bağımlılık (`d1a0bf70`). Doğrulandı: `package-lock.json`'da `pm2` geçişi **0** (`@pm2/*` dahil), `package.json`'da 0, Dockerfile'da `PM2_HOME` yok, `tools/lizenzen-erzeugen.mjs:44` AGPL istisna listesi boş → O-42/K2b.16 lisans kapısı istisnasız. Watchtower `0.4.0+d1a0bf7` healthy (bildirim). Kalan `pm2` geçişleri yalnız tarihsel yorum (Dockerfile:30/72/92, `server.js:211/3770/4606`, `publish-calendar-api.yml:186`) — zararsız. Tanı notu O-83'e eklendi (`pm2 list` ↺ yerine `[start] … Worker N beendet … Neustart` satırı). Gözlem (veto değil): `runMigrations()` hâlâ her işçide (`server.js:4559`) — Çözüm (5)'teki isteğe bağlı kazanç alınmadı, advisory lock koruyor, O-26 tetikleyicisi aynı kaldı. Durum: `gelöst` |

### O-180 — Kong `anonymous_reports` varsayılanı açık: kutu `kong-hf.konghq.com`'a kullanım raporu gönderiyor ✅ **gelöst (08.10.2026)**

| Alan | İçerik |
|---|---|
| **Ne** | Kong Gateway 3.9'da `anonymous_reports` varsayılanı `on` (Kong yapılandırma referansı, docs.jp.konghq.com/gateway/3.9.x/production/kong-conf); kutunun compose'unda kapatan satır yok |
| **Nerede** | `onprem/docker-compose.yml:360-400` (kong servisi, `KONG_*` env'leri; `grep -i ANONYMOUS onprem/docker-compose.yml onprem/.env.template` → 0) · `onprem/.env.template:32` `VERSION_KONG=3.9.1` |
| **Tip** | A |
| **Kutuda ne olur** | Kong her kutudan Kong Inc.'e anonim kullanım/hata verisi yollar (istek içeriği değil; G1 ihlali değil). Beyan edilmemiş bir bağlantı daha — O-179 ile aynı sınıf. İnternetsiz kutuda sessizce düşer |
| **Çözüm** | Tek satır: kong servisine `KONG_ANONYMOUS_REPORTS: "off"`. Compose `onprem-bundle`'da → `manifest.json` sha tazelenir (`node tools/onprem-manifest.mjs`), kapı zaten zorluyor. K2b.16 ile aynı turda; bağlantı listesi bu satır inmeden doğru olamaz. Genel kural O-42'nin insan kuralına eklenir: yeni upstream imaj = NOTICE satırı **+ "telemetrisi kapatıldı mı"** sorusu |
| **Durum** | `offen` — sahibi K2b.16 (builder) · **→ `gelöst` (08.10.2026, Claude):** `onprem/docker-compose.yml` kong → `KONG_ANONYMOUS_REPORTS: "off"`, manifest yenilendi. Ölçüldü (WSL, `kong/kong:3.9.1`, `kong prepare` → `.kong_env`): satırsız `anonymous_reports = true`, satırla `false`. Kurulu kutuya `update.sh` (compose bundle) ile gider |

> **08.10.2026 — K2b.16 ön kontrolü:** yeni O-178 (`geplant`), O-179 + O-180 (`offen`). En yüksek madde numarası **O-180**. Bağlantı sayımı (koddan): kutu bugün **beyan edilebilir** olarak ghcr.io · Docker Hub · merkez (`MERKEZ_URL`: kayıt, `ip-melden.sh`) · acme-dns + Let's Encrypt (TLS moduna göre) · KI (`AI_MODE`, varsayılan `aus`) · praksis SMTP (`SMTP_HOST`, varsayılan boş) adreslerine çıkıyor; **beyan edilmemiş** iki tane bulundu (O-179 pm2, O-180 Kong). ITSG kutudan çıkmıyor (O-116, tip B), Google kutuda kapalı (O-08), Sentry DSN kutu compose'unda yok.

## M3 ön kontrolü — 07.10.2026 (uygulama öncesi)

**Hüküm: GEÇER, KAYITLA.** Yerel PDF417 okuma için npm'den üretilip depoya konan
ZXing JS + PDF renderer/worker, tip **B + G**: yalnız geliştirme sırasında bağımlılık
indirilir; görüntü/PDF/kamera verisi tarayıcıdan çıkmaz. Yeni env, şema, cron ve dış
host gerekmiyor. Sahip: **Hat M, M3.1–M3.7**; uygulama ve gerçek kutu testi henüz yok.

- Dağıtım: `onprem/frontend.Dockerfile:101,104` `module/` ve `vendor/` dizinlerini
  bütünüyle kopyalar; `.github/workflows/publish-frontend.yml:39-40` değişiklikte image
  üretimini tetikler. Yeni frontend vendor/modül için ek COPY gerekmez.
- CSP: `onprem/Caddyfile:66` ve `vercel.json:19` eval/WASM izni vermez. **Saf JS ZXing**
  seçilir; CSP gevşetilmez. PDF worker aynı origin'deki yerel `vendor/` dosyasından
  açılır (`worker-src` yok: mevcut `script-src`/`default-src` fallback'i); blob-worker,
  CDN worker ve çalışma anında dış font/CMap/model indirmesi kullanılmaz. PDF renderer
  eval kapalı çalışır; gerekiyorsa ek font/CMap/WASM kaynakları da yerel paketlenir.
- Kamera: O-109 zaten çözüldü; `onprem/Caddyfile:82-83` ve `vercel.json:18` kamera için
  `self` izni verir. `KUTU_HAZIRLIK_SPRINT.md:190-192`: K2b gerçek sertifika getirmeden
  kutu testi güvenilen kök sertifikalı cihazla yapılır; sertifika uyarısını geçmek
  Secure Context kanıtı değildir. HTTPS/izin/cihaz yoksa görüntü/PDF ve manuel yol kalır.
- Kabul: yerel dosyalar + decoder + PDF worker üçüncü parti host'lar engellenirken
  çalışmalı; kamera durdurulunca tüm track'ler kapanmalı; payload/PHI log, Sentry,
  analytics veya sayaçlara yazılmamalı. Lisans metinleri korunur ve yeni vendor
  bileşenleri `vendor/README.md` + `THIRD-PARTY-NOTICES`'a kaydedilir (K2b.16).

**M3.4 paketleme eki (07.10.2026, uygulama planı): GEÇER, KAYITLA.** Ortak podoloji
Heilmittel → HPNR mantığının asıl kaynağı `module/podologie-heilmittel-position.js`;
`tools/vendor/build-barcode.mjs` bunun byte-identik türevini
`api-backend/lib/podologie-heilmittel-position.js`'e üretir. Backend yalnız kendi
`lib/` yolundan import eder. Neden: API image build context'i `./api-backend`
(`.github/workflows/publish-calendar-api.yml:198,297`); `../../module` runtime import'u
image içinde bulunmaz. `api-backend/Dockerfile:22` `lib/` dizinini zaten kopyalar ve
API workflow `api-backend/**` değişince çalışır (`:7`). Yeni context/COPY/env/şema
gerekmiyor, aynı mantık iki dağıtımda çalışır (G7). Türev elle düzenlenmez; senkronizasyon
testi iki dosyanın byte eşitliğini denetler ve sapmada başarısız olur. Sahip **Hat M,
M3.4**; üretici ve senkronizasyon testinin geçmesi uygulama kabul şartıdır.

**M3 uygulama bildirimi — 07.10.2026 (yerel, tam kutu kabulü değil):** Koordinatör
bildirimi: ZXing **0.21.3** saf JS ve PDF.js **4.10.38** + worker/lisanslar `vendor/`
altında; CSP değiştirilmedi. Kaynak sondajı: `module/rezept-barcode-scan.js:38,96-99`
yerel decoder + yerel worker, PDF eval kapalı; `:6-7` 20 MiB/12 MP sınırları.
PDF taraması ilk 5 sayfayla sınırlı. Görüntü/PDF tarayıcıda kalır; native capture
fallback yok. `tools/vendor/build-barcode.mjs:22` ortak mapping kaynağını byte-identik
olarak backend `lib/` dizinine kopyalar; `api-backend/lib/rezept-felder.js:21` yerel
kopyayı import eder. Koordinatörün yerel doğrulaması: `npm test` **2864**, typecheck ve
`tools/browser-probe/rezept-barcode-probe.mjs` **ilk koşu 21/21** başarılı; browser probe tüm
yabancı origin'leri bloklar, ağ üzerinden write yapmaz. Kamera cancel/stale-permission
senaryoları sentetik olarak doğrulandı. **Açık:** fiziksel telefon/tablet kamerası,
gerçek HTTPS kutusu, canlı kaydetme, gerçek kutu image/airgap kabulü. **Push/deploy yok.**
O-171'in acmedns/Caddy kabul durumu bu M3 bildirimiyle değişmez. Tam M3/kutu kabulü
yapılmadı; kalan saha doğrulamalarının sahibi **Hat M / K3**.

**PDF font review eki (07.10.2026):** Eksik standard-font uyarısı üzerine PDF.js'in
14 fontu + `LICENSE_FOXIT`/`LICENSE_LIBERATION` yerel `vendor/pdfjs/standard_fonts/`
dizinine alındı; bu sicilin karşılaştırması **16/16 dosya npm kaynağıyla byte-identik**.
`module/rezept-barcode-scan.js:102` same-origin `standardFontDataUrl`; mevcut CSP/COPY
değişmez. Font lisansları vendor kaydında ayrı belirtiliyor. Koordinatörün T3 browser
probe sonrası sonucu **29/29**, PDF metin piksel kontrolü dahil. Bu, ilk 21/21 koşunun
üstüne gelen yerel review doğrulamasıdır; yukarıdaki fiziksel kamera/HTTPS kutusu/
canlı kaydetme/gerçek image-airgap kabulü hâlâ açık.


## M4-Nachtrag — 08.10.2026: lokale KI-Umsetzung geprüft, Aktivierung offen

**NACHWEIS:** `wissensbank/sitzungen/2026-10-08_m4-qa-bericht.md`; Plan 2 und Konsey `2026-10-08-m4-optin-lokal.md`. Dieser Nachtrag ergänzt die historischen Einträge; er erklärt keinen externen Nachweis für erledigt.

| Bezug | Lokaler Stand | Separat offene Grenze |
|---|---|---|
| O-151 / O-135 | AI_MODE/AI_* mit AZURE-Legacy-Kompatibilität, explizit aus priorisiert; lokale Gateway-/Transporttests PASS, Start ohne KI-Schlüssel im echten isolierten Backend geprüft | Reale SaaS-/Box-Konfiguration, Rotation und Providerfunktion nicht geprüft; historischer Token-Datei-Vorschlag aus O-135 wird für Jeton nicht übernommen |
| O-136 | ENV-Oberfläche bereits durch K2 geschlossen; nicht wieder geöffnet | Aktuelle Runtime-/Compose-Vertragsprüfung im M4-Bericht |
| O-169 | Box-Jetonadapter lokal mit Fakeaussteller abnahmefähig; merkezFetch/Boxidentität wiederverwendet, Token RAM-only, Hostliste im Image leer bis geprüfte Ressource vorliegt | Echter Hat-K-Endpoint, Ausgabe-/TTL-/Quoten-/Budgetvertrag, minimaler Azure-RBAC/Region/Deployment und realer Ausfalltest offen; clientseitiges ≤1-h-Gate ist kein Ausstellerbeweis |
| O-105 | Bestehender CORS-Abschluss wird nicht wieder geöffnet | M4-Auth-/Config-Abnahme separat, keine neue CORS-Behauptung |
| M4.2 | NO_NER: 4/139 Restlecks, 6/7 negative Fehlalarme; ONNX-Import Alpine ARM64/AMD64 FAIL | Zwei PM2-Worker im NER-Zielimage nicht ausführbar, keine Änderung von Basisimage/Limits, kein Runtime-Modell |

### Lokale Persistenz ohne Schreibrecht auf kimlik

Beschluss/Compose-Vertrag: eigenes Named Volume **ki_freigaben**, nur API-Mount `/var/lib/praxura/ki-freigaben`; Identität `kimlik` unverändert read-only. Runtime-Defaultpfad und Compose geprüft. Nur Owner-/Praxis-/Box-/Textversionsmetadaten und verbrauchte HMAC-/Expiry-Marker, keine Patientendaten, Prompts, Maps oder Provider-Tokens. Verzeichnis 0700, Datei 0600, atomare Ersetzung. Frischer Widerruf, konkurrierender Einmalverbrauch und Neustart-Replay in je zehn Kindprozessläufen lokal und unter Node 22 Alpine ARM64 PASS; produktive PM2-/Boxprüfung offen. Beschädigt/fremd/fehlend = aus. Keine Sicherung des boxgebundenen Opt-ins; neue Box verlangt erneute Entscheidung.

Frisches Named Volume im lokal gebauten ARM64-Image: nicht privilegierter Benutzer unter Node 22.23.3/Alpine kann Entscheidung schreiben und widerrufen, Verzeichnis 0700 und Datei 0600; Schreibversuch auf read-only gemountetes `kimlik` abgewiesen — PASS. Nachweis: lokales Prüfartefakt `.local-m4-work/fresh-volume-result.json`; ausschließlich für diesen Test erzeugte Volumes anschließend entfernt. Kein Nachweis für AMD64-Runtime oder reale Box.

Box `AI_MODE=aus`; Betreiberflags `AI_ACTIVATION_READY` / `AI_MAIL_READY` / `AI_ALLOW_FREETEXT` sind getrennte Gates und standardmäßig aus. Jeton A-only, B standardmäßig gesperrt, C/OCR gesperrt. Freitextqualität des dritten Korpus FAIL (36/156); keine Freigabe daraus. Lokale Gesamtsuite 3117/3117, M4-Probe 22/22, isolierte Vollbackend-API 14/14 PASS. Lokales ARM64-Image gebaut; Paketmanifest mit 19 Dateien und Größenprüfung über isolierten Git-Testindex PASS. Reale isolierte Boxabnahme und CI offen; keine pauschale M4-/Betriebsfreigabe. Vollständige Grenzen im QA-Bericht.


### M3/M4-Integration auf aktuellen Hat-K-Stand — 08.10.2026

Die Integration erhält den auf `71dce32` vorhandenen Hat-K-Stand: API-Image startet
weiter über **`node start.mjs`** mit zwei `node:cluster`-Workern; `NODE_APP_INSTANCE`
bleibt 0/1. Die M4-Dateiverträge für frischen Widerruf und atomaren Replay-Verbrauch
teilen das eigene Volume `ki_freigaben`; der API-Mount von `kimlik` bleibt read-only.
Die zuvor dokumentierten lokalen M4-Messungen sind Nachweise des damaligen Images,
keine Abnahme des nun integrierten Starters oder einer Kundenbox.

Das Paketmanifest wird aus dem aktuellen Generator neu erzeugt: **20 Dateien**,
inklusive `lib-setup-jeton.sh`. Kong `KONG_ANONYMOUS_REPORTS: "off"` bleibt erhalten.
O-173 bis O-180 und die weiteren Hat-K-Änderungen werden durch M3/M4 nicht zurückgesetzt.
O-179 Phase 2 (SaaS-VPS-Override/PM2-Abhängigkeit), O-178/ORG und reale Boxprüfungen
bleiben beim jeweiligen Hat-K-Auftrag offen. Kein Providerzugriff und keine
KI-Aktivierung durch Integration; Default `AI_MODE=aus`, alle drei Betreiberflags 0.

### O-181 — S-56: `profiles` anon'a tablo bazında açıktı, kutuda da (baseline) — 0072 kapattı; geri dönüşü bekleyen kapı yok 🟡 **kısmen gelöst (`712640df`; kapı + sayaçlar + ilk kutu ölçümü `1eee64f0`) — kalan: kutuda hasta sayfası açılıyor mu (T25, K3 kurulumundan sonra)**

| Alan | İçerik |
|---|---|
| **Ne** | `Public booking lookup profiles` policy'si tabloya bağlıydı ve anon tablo hakkıyla 87 kolonun hepsini okuyabiliyordu (IBAN, e-posta, telefon, Steuernummer). `profiles_public` sicili yalnız bir kuraldı, sınır değildi. 0072: anon'dan tablo hakkı REVOKE, 11 kolona kolon bazında GRANT (görünümün 10 kolonu + `is_active`), policy aynı adla yeniden ve `is_active` koşulu eklendi |
| **Nerede** | Açığın kutu kaynağı `api-backend/db/migrations/0000_baseline.sql:12191` (`GRANT ALL ON TABLE public.profiles TO anon`) · düzeltme `0072_profiles_anon_spaltenrechte.sql:29-45` · kutuda yol: Caddy `/rest/*` → Kong → PostgREST `anon` · sayaç `api-backend/db/erwartete-zaehler.json:32` (`bis_version` 0072), `:60` (`_hinweis_0072`) |
| **Tip** | D (ACL, şema zinciri) + G (kutu tarafı yüzey) |
| **Kutuda ne olur** | **0072'den önce:** anon anahtarı kutunun ön yüzünde zaten açık. LAN'daki her cihaz, Hetzner/Weg C kutusunda internetteki herkes, `GET /rest/v1/profiles?select=iban,…` ile booking_slug'ı olan praksisin owner kaydını okuyabiliyordu. **0072'den sonra:** yeni kutuda baseline ALL verir, 0072 hemen ardından geri alır (sıra doğru, aynı runner koşusu). Mevcut test kutuları sonraki `update.sh`'ta alır (canlı müşteri yok). Sayaçlara etkisi yok: yalnız ACL değişiyor, policy aynı adla. **Ölçülmedi:** kutudaki anon'un gerçekten 11 kolon gördüğü, `booking.html`'in kutuda çalıştığı. SaaS'ta canli-test T9 geçti (`5e364319`). Kırılma riski: kutunun Supabase sürümü ile SaaS'ın kolon GRANT + `security_invoker` görünüm davranışı farklıysa randevu sayfası kutuda sessizce "Unternehmen nicht gefunden" der |
| **Çözüm** | Kod: `712640df` (guvenlik S-56). **Kalan iki iş:** **(a) Geri dönüş kapısı (statik, pre-commit, builder):** `tools/check-security-definer-grants.mjs` desenini izler, `0000` hariç migration dosyalarını tarar. Kurallar: (1) `GRANT … ON ALL TABLES IN SCHEMA public … TO … anon` → red. (2) `GRANT (ALL\|SELECT\|…) ON (TABLE )?public.profiles TO … anon` kolon listesi olmadan → red. (3) `profiles_public`'e dokunan bir dosyada (`CREATE OR REPLACE VIEW public.profiles_public`) aynı dosyada `GRANT SELECT (` … `) ON public.profiles TO anon` yoksa → red. Bu S-56'nın iki geri dönüş yolunu da yakalar: toplu GRANT ve "görünüme kolon eklendi, GRANT unutuldu" (bu ikincisi güvenlik açığı değil, randevu sayfasını kırar). Kaçış: `SKIP_ANON_GRANT_GATE=1`. **(b) Çalışma zamanı kontrolü (kutu):** guvenlik'in T7 önerisi doğru ama smoke test yalnız CI'da ve tek kutuda koşar. Daha iyisi aynı sorgunun kutunun kendi selbstcheck'ine girmesi (`api-backend/db/schema-zaehler.js`): `has_table_privilege('anon','public.profiles','SELECT') = false` + anon'un `profiles` üzerindeki SELECT kolon sayısı (`information_schema.column_privileges`, bugün 11). Böylece her kutu her açılışta ölçer, ve `erwartete-zaehler.json`'da bir alan olur. Bu alan 0073 ile 13 olur: kolon eklendiğinde beklenti de güncellenir, `_hinweis` kuralı aynı. Sayaç eklemek tabanı değiştirir, yani kutuda ilk ölçüm (KHS §5b) bununla birlikte yapılır. Sahip: builder (a+b), ölçüm Kemal §5b |
| **Durum** | 🟡 `kısmen gelöst` (09.10.2026) — SaaS'ta canlı ve doğrulandı, zincirle kutuya gidiyor. (a) ve (b) açık, kutuda ölçüm yok. **K2b.15 / 0073 ön görüşü (aynı gün):** `GEÇER, KAYITLA`. Plan: `profiles.praxis_impressum_url` + `praxis_datenschutz_url` (https CHECK), görünümün **sonuna** eklenir (`CREATE OR REPLACE VIEW` yalnız sona eklemeye izin verir, doğru), aynı dosyada `GRANT SELECT (2 kolon) … TO anon`. Expand-only: nullable kolon + CHECK + görünüm yeniden; `:stable` etkilenmez. Sayaçlara etkisi yok (`_hinweis_0042/0046` emsali). SaaS ve kutu aynı dosya (G7). Tip A **değil**: kutu bu adrese hiç çıkmaz, hastanın tarayıcısı link olarak açar. **Şartlar:** (i) CHECK yalnız `^https://` değil, uzunluk (≤ 500) ve boşluk/kontrol karakteri yok. Kullanıcı arayüzü de `new URL()` + `protocol === 'https:'` ile tekrar doğrular (DB CHECK `javascript:` gibi şemaları keser, ama önyüz değeri `href`'e koyuyor). (ii) Link `rel="noopener noreferrer"` ile açılır: hasta sayfasının yolu (randevu slug'ı) praksisin kendi sitesine Referer olarak sızmasın. (iii) Görünümün `security_invoker` olması nedeniyle GRANT unutulursa `select('*')` yapan her hasta sayfası tümden kırılır. Bu yüzden (a)(3) kapısı 0073'ten **önce** gelirse 0073 onunla doğrulanır. (iv) (b) varsa beklenen kolon sayısı 11 → 13. Hukuki içerik legal-de 09.10 kararında (`compliance/LEGAL_DECISIONS.md`), bu sicilin konusu değil. O-178'in "K2b.15 praksis URL'leri" kalanı bu tasarımla ilerler · **K2b.15-Rest ön kontrolü (09.10.2026, uygulama öncesi):** **(a) GEÇER, üç düzeltmeyle:** (1) kural (3) `0055_mitarbeiter_zugang_haertung.sql:92` yüzünden mevcut zincirde kırılır (görünümü yeniden yazıyor, o gün tablo hakkı vardı, kolon GRANT'ı yok) → ya `BEKANNTE_ALTLASTEN` (SECDEF kapısının emsali) ya da kural (3) yalnız `> 0072`; 'tüm 0001-0072 geçer' testi ancak böyle yeşil. (2) yorumlar taranmadan önce silinir: `0072:26-27` yorumda tam bu kalıpları taşıyor. (3) hedef rol listesi `anon` **ve** `PUBLIC` (PUBLIC'e verilen hak anon'a geçer), şema öneki/tırnak opsiyonel (`ON profiles`, `ON TABLE "public"."profiles"`), çok rollü `TO authenticated, anon`; kural (2)'ye `ALTER DEFAULT PRIVILEGES … TO anon` de eklenir (yeni tabloları otomatik açar, kutu Supabase imajında varsayılan zaten açık — ayrı bulgu değil, ama migration'la genişletilmesi red). **(b) GEÇER, şu biçimde:** `schema-zaehler.js:15-35` `SORGULAR`'a iki satır — `anon_profiles_tablo_hakki`: `has_table_privilege('anon','public.profiles','SELECT,INSERT,UPDATE,DELETE')` (beklenen `false`) ve `anon_profiles_kolon`: `pg_attribute` üzerinden `has_column_privilege('anon', a.attrelid, a.attnum, 'SELECT')` sayısı (beklenen 11). `information_schema.column_privileges` **değil**: yalnız bağlanan rolün üyesi olduğu hakları gösterir ve tablo hakkını kolon satırına çevirmez; `has_column_privilege` tablo hakkını da sayar, yani S-56'nın geri dönüşü 11 → ~88 olarak görünür. Karşılaştırma `:77-81` `!==` ile boolean'ı da doğru işler, `setup/router.js:122` `fmt` değişmeden gösterir. Bozulan: hiçbir test yok (`schema-zaehler` için test dosyası yok — yazılmalı, sahte client ile), SaaS etkilenmez (`DATABASE_URL` SaaS'ta yok, sayaç yalnız kutuda koşar, `migrate.js:190-213`). `anon` rolü olmayan düz Postgres'te sorgu hata verir → `migrate.js:207-211` yakalar, tüm selbstcheck 'gri' olur, migration durmaz — kabul. `erwartete-zaehler.json`: `bis_version` 0072'de kalır, iki değer `zaehler`'e, `gemessen_am` **değişmez**, `_hinweis_anon_zaehler`: 'SaaS katalog sayımından (0072 başlığı), kutuda ilk ölçüm KHS §5b'. Unutulursa kutu 'veraltet'/gri gösterir (`schema-zaehler.js:74,91`), kırmızı değil. **(3) 0073 tercihi (görüş, veto değil):** adres de girecekse görünüm + kolon GRANT yerine **dar RPC** (`public_praxis_sector` emsali, `check-security-definer-grants.mjs:67` AUSNAHMEN) — slug/owner_id alır, tek praksisin Art.13 bloğunu (ad, adres, iki URL) döner. Kutu için iki yol eşit taşınır (ikisi de migration), fark: RPC'de anon kolon yüzeyi 11'de kalır, `profiles.zip`/`plz` ikilisi (`db/SCHEMA.sql` profiles, iki posta kodu kolonu — hangisi gerçek: db-ustasi) RPC içinde çözülür, SaaS'ta `select=street,…` ile tüm praksis adreslerinin toplu listelenmesi açılmaz (kutuda tek praksis, önemsiz; SaaS'ta guvenlik'in yargısı). Bedel: `fonksiyon` sayacı 99 → 100, AUSNAHMEN'e gerekçeli satır. Görünüm yolu seçilirse yukarıdaki şart (iii) ve sayaç 11 → 13+adres kolonları. **(4) Hasta sayfaları:** üretilen Art.13 metni **ayrı HTML değil**, `module/` altında bir modül (her iki sayfa da import eder; `frontend.Dockerfile:106` `COPY module` ve `publish-frontend.yml:40` `module/**` zaten alır — yeni COPY/paths/`.vercelignore` satırı yok; `manifest.json` (`Dockerfile:105`, PWA) ve onprem-bundle manifest'i ilgisiz). Veri zaten yüklenmiş praksis kaydından, ikinci sorgu yok. Bayrak ayrımı: yalnız Cookie-Einstellungen ve 'Über diese Software' `IST_KUTU` dalında (`module/ueber.js:95` `rechtslinksFuerKutu` deseni — ama o fonksiyon bütün `[data-rechtslinks]` bloğunu ezer, hasta sayfasında praksis linklerini de silmemesi için ayrı işaret gerekir). Praksis URL'leri / Art.13 bölümü **bayraksız**, iki dağıtımda aynı: sorumlu her iki yerde praksis — SaaS'ın bugün `booking.html:752,775-777` ve `booking-request.html:659,689-691`'de Praxura'nın `/datenschutz.html`'ine bağlaması legal-de'nin sorusu, bu sicilin değil; ama SaaS'a ayrı dal açılırsa G7 sapması olur. Kutuda `/datenschutz.html` ve `/impressum.html` imajda yok → bugün 404 (O-58 (b) ile aynı kök) · **09.10.2026 gece (`1eee64f0`):** (a) kapı `tools/check-anon-grants.sh` pre-commit'te (`.githooks/pre-commit:15`). (b) sayaçlar `schema-zaehler.js:39-45` (profiles + businesses). WSL kutusu `hafer-turm-9` `update.sh` ile 0072–0075'i aldı, **ilk kutu ölçümü**: `anon_profiles` f/11, `anon_businesses` f/6 (selbstcheck + psql), `profiles?select=iban` ve `businesses?select=phone` → 42501, 6 kolonlu select 200; `gemessen_am` 2026-10-09 (`_hinweis_box_messung_0075`). Açık güvenlik kanıtı tamam. **Kalan tek iş kırılma tarafı:** kutuda owner yok → `booking.html?u=<slug>` / `rpc/public_praxis_angaben` satır testi / T25 (a)–(c), (e) yapılamadı → Kemal, K3 kurulumundan sonra. O kapanınca `gelöst` |

## 7AF — K2b.15-Rest sonra-bildir (09.10.2026, commit öncesi `git diff`; O-178 · O-181)

Commit'liler: `9c8280dd` (O-181 (a) kapı) · `b7064f87` (O-181 (b) sayaçlar) · `131e8233` (0073 + RPC `public_praxis_angaben`, canlıda; `profiles_public` değişmedi, anon kolon 11'de kaldı, `fonksiyon` 100). Bekleyen: `module/termin-rechtstexte.js` (yeni), `module/praxis-rechtslinks-einstellungen.js` (yeni), `module/ueber.js`, `module/branding.js`, `booking*.html/.js`, `server.js` `/booking-request/create`. Yeni env/host/cron/klasör yok — G1/G2/G3/G8 vetosu **yok**. Seçilen yol 7Q-sonrası O-181 görüşündeki dar RPC (görünüm değil) → O-181 şart (iv) düşer: beklenen anon kolon **11**, 13 değil.

**Karışık sürüm (`:beta`/`:stable`, frontend ↔ api imajı farklı commit'ten) — koda karşı:**

| Durum | Sonuç |
|---|---|
| Yeni frontend + eski api | Kırılmaz. `booking-request.js:1231` hâlâ `dsgvo_consent: true` gönderiyor, eski `server.js` bunu şart koşuyordu → geçer. Yan etki: eski api `dsgvo_consent:true, consent_at` yazar = hiç alınmamış bir onay kaydedilir. Geçici (eski api yaşadıkça); kutuda iki imaj aynı kanaldan aynı gece çekilir, pencere kısa. Hukuki ağırlığı legal-de'nin, bu sicilin değil |
| Eski frontend + yeni api | Kırılmaz. Eski sayfa `dsgvo_consent` gönderir, yeni api yok sayar (`server.js:3946-3956`) |
| Yeni frontend + DB'de 0073 yok | **Fail-closed.** RPC hatası `termin-rechtstexte.js:89` yakalanır → `angaben=null` → `vollstaendig:false` → `booking.js:100` / `booking-request.js:1451` formu kilitler, `NICHT_EINGERICHTET` metni. Kutuda bu yalnız runner 0073'te durursa olur (runner durursa api zaten açılmaz — kutu kırmızı, sessiz değil). SaaS'ta DB önde, olmaz. **Görüş (veto değil):** RPC hatası ile "praksis adresini girmemiş" aynı metni gösteriyor; hata yolunda farklı bir sebep (ör. `data-grund="rpc"` + konsol) ayırt etmeyi kolaylaştırır — tanı paketi/Kemal "neden kilitli" sorusunu tek bakışta cevaplar. Fail-closed kendisi doğru (Art.13 metni yoksa form yok) |
| Mevcut kiracılar | Adres alanları boş her praksisin hasta sayfası deploy anında kilitlenir (SaaS + kutu, bilinçli, legal-de). Canlı müşteri yok (12.09 kaydı); beta kiracıların adresi dolu mu → canli-test/Kemal |

**Doğrulananlar:** `<dialog>` metni sayfa içinde üretiliyor, dış istek yok (kutuda internetsiz çalışır) · praksis linki `httpsUrl` (`new URL` + `https:`) + `rel="noopener noreferrer"` → O-181 şart (i)(ii) karşılandı · `IST_KUTU` dalı yalnız "Über diese Software" için, praksis bloğu bayraksız (G7) · Cookie-Einstellungen'in iki sayfadan kalkması doğru (iki sayfa `cookie-consent.js` yüklemiyordu, düğme ölüydü) · `module/**` iki imaj yoluna da zaten giriyor (`publish-frontend.yml:40`), yeni COPY/paths yok · PLZ: ayar `plz`+`zip` ikisine yazıyor, RPC'nin hangisini okuduğu `0073`'te — çift kolon borcu db-ustasi'nin (`db/REGISTER.md` profiles).

**KHS §5b — kutuda ölçüm satırları (Kemal, test kutusu, 0073'lü imaj):**
1. Kurulum/selbstcheck sayfası: `bis_version` 0073 yeşil · `fonksiyon` 100 · `anon_profiles_tablo_hakki` = false · `anon_profiles_kolon` = 11 (O-181 (b) ilk ölçümü, `gemessen_am` bununla güncellenir).
2. Kutunun anon anahtarıyla: `POST /rest/v1/rpc/public_praxis_angaben` (`p_owner_id`) → tek satır, yalnız ad/sahip/adres/iki URL · `GET /rest/v1/profiles?select=iban` → izin hatası (boş liste değil).
3. `booking.html` + `booking-request.html`, LAN'dan: adresi boş praksis → kilit metni · adres dolu, URL yok → bilgi satırı linki `<dialog>` açar, praksis adı doğru · URL dolu → yeni sekme, Referer yok · alt bilgide "Über diese Software" var, Cookie-Einstellungen yok.
4. Aynı test WAN kablosu çekiliyken (ya da DNS kapalı): 3. adım aynen çalışır; tarayıcı ağ sekmesinde kutu dışı istek **sıfır**.
5. Bir randevu talebi gönder → `booking_requests` satırında `dsgvo_consent=false`, `consent_at` NULL (yeni api).

**Durum:** O-178 "K2b.15 praksis URL'leri" kalanı → kod tamam, commit bekliyor, kutu ölçümü §5b 1-5. O-181 (a)(b) kod `gelöst` (`9c8280dd`, `b7064f87`); madde kutu ölçümüne (§5b 1-2) kadar 🟡 kalır. O-178'in diğer kalanları (bağlantı listesi a-c, NOTICE OS satırı, LICENSE/T21) bu turla **değişmedi**, açık.


## 7AG — T20 · T22 · 0074 sonra-bildir (09.10.2026 akşam; O-179 · O-169 · O-181)

**(1) T20 + pm2 çıkışı → O-179 `gelöst`.** Gerekçe ve doğrulama O-179 Durum satırında. Sıra (önce VPS override, sonra bağımlılık) §8'e uygun; ters sırada Watchtower SaaS'ı crash-loop'a sokardı, olmadı.

**(2) T22 merkez `d2f5dcd`, 3b.4.** Kod kısmı zaten 7-öncesi denetimde tamamdı (O-169). İmzasız istek 401 = şart (2) canlıda doğrulandı. Açılış kapısı **kapalı kalır** ve değişmedi: 7. şart (otomatik `ki-global aus` + gece Azure↔`ki_ausgabe` karşılaştırması), ORG (ayrı kutu SP'si, özel rol, stateful kapalı), M4.11 (α)(β)(γ). O-169 `geplant` kalır.

**(3) 0074 (`e5c47547`) — GEÇER.** G1/G2/G3/G8'e değmiyor; şema zinciriyle iki dağıtıma aynı dosya (G7). Koda karşı: `REVOKE ALL` → `GRANT SELECT (6 kolon)` sırası doğru (`0074:33-36`); `demo_bookings` bloğu `to_regclass` korumalı (`:40-48`) ve baseline'da tablo yok (`0000_baseline.sql` içinde `demo_bookings` geçişi 1, CREATE değil) → kutuda no-op doğru; `_hinweis_0074` sayaç-nötr gerekçesi doğru (ACL'i hiçbir eski sayaç okumaz), `gemessen_am` değişmedi — doğru; kapı `tools/check-anon-grants.mjs:21` `ANON_SPALTEN_TABELLEN = ['profiles','businesses']`. **Kutuda ölçülmedi** — ve bugün ölçecek bir sayaç da yok: kapı yalnız 0000-sonrası migration **metnini** tarar; kutunun gerçek ACL'i (baseline ALL + Supabase imajının default privileges'ı + 0074) yalnız çalışma zamanında görülür. Bu S-56 için O-181 (b)'nin verdiği gerekçenin aynısı.

**Tavsiye — ikisi birden, ucuz:**
- **(a) Selbstcheck'e iki satır (builder):** `api-backend/db/schema-zaehler.js` `SORGULAR`'a `anon_profiles_*` deseniyle `anon_businesses_tablo_hakki` (`has_table_privilege('anon','public.businesses','SELECT,INSERT,UPDATE,DELETE')`, beklenen `false`) + `anon_businesses_kolon` (`pg_attribute` üzerinden `has_column_privilege('anon', a.attrelid, a.attnum, 'SELECT')`, `attnum > 0 AND NOT attisdropped`, beklenen **6**). `erwartete-zaehler.json`: iki değer `zaehler`'e, `bis_version` 0074'te kalır, `gemessen_am` **değişmez**, `_hinweis_0074`'e 'anon_businesses_* SaaS katalog sayımından, kutuda ilk ölçüm T25' eklenir. Sahte client'lı test `anon_profiles_*` testinin yanına. Etki: S-57'nin geri dönüşü kutuda 6 → ~26 olarak her açılışta görünür; SaaS etkilenmez (sayaç yalnız kutuda koşar). Selbstcheck **olmadan** T25'e satır eklemek tek seferlik ölçümdür, sonraki sürümde geri dönüşü kimse görmez.
- **(b) T25'e satır (Kemal):** (d) adımına ekle — kutu anon anahtarıyla `GET /rest/v1/businesses?select=phone` → izin hatası (42501, boş liste değil) · `select=id,owner_id,business_name,booking_slug,is_default,closed_days` → çalışır · `booking.html?u=<Standort-Slug>` kutuda açılır (anon'un `closed_days` + `public-owner.js:57` yolu). Selbstcheck satırı (a) gelirse: `anon_businesses_tablo_hakki=false`, `anon_businesses_kolon=6`.

**Sahip:** (a) builder — O-181 (b)'nin kapsamı `profiles` → `profiles + businesses` olarak genişler, ayrı madde açılmadı (aynı sınıf, aynı kapı, aynı sayaç dosyası). (b) Kemal, KHS §5b T25. O-181 🟡 kalır: kalan = (a) businesses sayaçları + T25 kutu ölçümü (profiles + businesses).

### O-182 — `booking_requests` (+ `patients`-Interessenten) 6-Monats-Löschfrist: zamanlanmış iş yok (legal-de 09.10.2026)

| Alan | İçerik |
|---|---|
| **Ne** | legal-de 09.10: kabul edilmeyen Termin-Anfrage'lar ~6 ay sonra silinmeli (Art.13 metnine "spätestens nach sechs Monaten" bundan sonra girer). Bugün iki dağıtımda da satırlar süresiz duruyor |
| **Nerede** | tablo `db/SCHEMA.sql` `booking_requests` (status CHECK `:1024` = `pending/approved/declined/cancelled` — **`expired` yok**), `patient_id` FK → `patients` NO ACTION (`:1012`); klasifikasyon `api-backend/dsgvo/klassifikation.js:294` + `:301` (`kategorie: 'loeschen'`, **süre alanı yok** — `KATEGORIEN` `:12` yalnız yasal saklama `jahre` taşır); silme sırası örneği `dsgvo/loeschen.js:513-514` (önce requests, sonra patients); yer `server.js:3774-3808` (23:55 + açılış telafisi) |
| **Tip** | F (zamanlanmış iş) — dış çağrı yok, şema değişikliği yok |
| **Kutuda ne olur** | İş yoksa: talep verisi (ad, e-posta, Kasse, ICD, Arzt) kutuda süresiz kalır, Art.13 metni ile çelişir. İş varsa: kutu internetsiz de çalışır (yerel Postgres DELETE), PC gece kapalıysa açılış telafisiyle ertesi açılışta koşar. `approved` dışarıda kalmalı: onaylı talep `bookings`'e yalnız `customer_name` ile döner (`booking/from-request.js:58-61`, `lead_id` yok, `bookings`→`booking_requests` FK yok) — yani silmek takvimi kırmaz ama onaylı talep bu işin konusu değil (legal-de kararı "kabul edilmeyen"). Silinen talebin e-posta HMAC linki `404 Anfrage nicht gefunden` döner (`server.js:4327-4329`) — kabul edilebilir |
| **Çözüm** | (1) Süre **`klassifikation.js`'te** tek kaynak: `booking_requests` girdisine `loeschfrist: { monate: 6, feld: 'created_at', status: ['declined','cancelled','pending'] }`; `patients` girdisine "referanssız ve > 6 ay" kuralı. (2) Genel küçük modül (`dsgvo/fristen.js`) `TABELLEN`'den `loeschfrist` taşıyanları okur, idempotent `DELETE` atar; sıra: önce `booking_requests`, sonra hiçbir `booking_requests` satırının göstermediği eski `patients`. (3) Çağrı `server.js:3794` gün-değişimi dalında (açılış + her gün bir kez), aynı `NODE_APP_INSTANCE` kapısı; kilit gerekmez. `istKutu()` dalı **yok** — iki dağıtımda aynı yol (Praxis = Verantwortlicher kutuda). pg_cron yok. (4) O-146 (`data_access_log` 12 ay) aynı mekanizmaya `loeschfrist: { monate: 12 }` olarak biner — ikinci iş yazılmaz. (5) `klassifikation.test.js`: `loeschfrist` yalnız `kategorie: 'loeschen'` girdilerinde olabilir (yasal saklama altındaki tablo yanlışlıkla süreli silinmesin) |
| **Durum** | `gelöst` — `b1ce69bb` (09.10.2026), O-146 ile birlikte. Doğrulandı: süreler yalnız `klassifikation.js:301` (booking_requests, declined/cancelled/pending 6 ay, `approved` dışarıda) · `:309` (patients 6 ay, yalnız `booking_requests.patient_id` göstermiyorsa; sıra önce talepler) · `:510` (data_access_log 12 ay, `occurred_at`). Başlatıcı `server.js:3813` `starteFristen({ supabase })`, `fristen.js:93` `NODE_APP_INSTANCE` 0 kapısı, ilk deneme 45 sn, Berlin günü başına bir kez, hata → ertesi dakika. `fristen.js`'te `istKutu()` dalı, dış çağrı, sabit host, pg_cron **yok** — iki dağıtımda aynı yol (G7). Test: yasal saklama kategorisinde `loeschfrist` olamaz. Canlı ilk koşu 0/0/0. Dockerfile `COPY dsgvo` mevcut. Kapı `check-onprem.sh` temiz. **O-145 notu:** hesap silme cron'u yeniden yapılırsa ayrı başlatıcı kalır ama aynı modüle "konto-fristen" olarak eklenebilir — yalnız SaaS (`istKutu()` false) şartı orada geçerli, burada değil |

> ✅ **09.10.2026 (`b1ce69bb` bildirimi):** O-182 + O-146 `offen` → `gelöst`. 18 + 21 + 35 + 92 + 13 + 3 = **182**, en yüksek **O-182**. Uyuşuyor. Aynı bildirimde `76daf84d`: `/services/public` (`server.js:3866`) artık `gkv_position_nr, kostentraeger_typ` döndürüyor — yerel DB okuması, dış çağrı/şema/env yok → GEÇER, kayıt gerekmez. (Public uca yeni alan açılması güvenlik sorusu ise `guvenlik`'in; katalog numarası hasta verisi değil.)

> ✅ **09.10.2026 (booking_requests Löschfrist ön kontrolü):** O-182 yeni, `offen`. 20 + 21 + 35 + 90 + 13 + 3 = **182**, en yüksek **O-182**. Uyuşuyor.

---

## 7AH — M4.11 sonra-bildir + rapor kimliği bulgusu (09.10.2026 gece; O-169 · O-183)

**(1) M4.11 (α)(β)(γ) → kapandı, `faccf4b9`.** 09.10 ön kontrolündeki 7 şartın hepsi bildirildi: 402'de önce ack/reject, sonra kilit · 429, JSON'suz cevap ve kodsuz 402 geçici sayılır (kilit yok) · kilit istek anında `isLocked()` ile çözülür, timer yok, `nowFn` enjekte · restart kilidi sıfırlar (kabul: kota otoritesi merkez `merkez/server.js:357`, kutudaki kilit yalnız istek azaltır) · merkez 402'ye `acknowledgedReportId`/`rejectedReportId` ek alan olarak koydu, iki yön uyumlu (eski istemci yok sayar, eski merkez = bugünkü davranış) · (γ) logu yalnız `reportId` · commit'te sahiplik notu (Melih'in dosyası, Kemal 09.10 izni). Testler: `api-backend/ai/ki-jeton-m411.test.js` (9) + `merkez/test/ki-jeton-vertrag.test.js`'e γ uçtan uca (merkez değişikliği geri alınınca kırıldığı ölçüldü), merkez 96/96. **O-169 `geplant` kalır** — açılış kapısında hâlâ açık: 7. şart (otomatik `ki-global aus` + gece Azure↔bildirilen karşılaştırması) ve ORG kalemleri. 7. şart artık O-183'e de bağlı.

### O-183 — KI kullanım raporu: `reportId` gün boyu sabit, içerik kümülatif → günün ilk raporundan sonraki her güncelleme merkezde reddediliyor 🟡 **kısmen gelöst (`01c99769`, merkez VPS deploy bekliyor)**

| Alan | İçerik |
|---|---|
| **Ne** | Kutu günlük raporuna gün boyu aynı kimliği veriyor ama içerik gün içinde büyüyor; merkez aynı kimlikte farklı içeriği "abweichend" sayıp reddediyor |
| **Nerede** | `api-backend/ai/audit.js:127-130` (`reportId = rep_<UTC-gün>_<hmac(tenant:box)>`, sabit) + aynı fonksiyondaki `taskTotals` (sayfalı DB okuması, gün başından kümülatif) · `merkez/db.js:192` (`payload_hash` farklı → `'abweichend'`) · `merkez/server.js:309-311` (→ `rejectedReportId`) |
| **Tip** | **H** (KI yetkisi/sayaç) + **G** (merkez tarafı rapor defteri) |
| **Kutuda ne olur** | Günün ilk raporu kabul edilir, sonraki her güncelleme reddedilir. M4.11 öncesi bu reddedilen rapor tek bekleyen rapor olarak kuyruğu restart'a kadar tıkıyordu; `faccf4b9`'dan sonra kutu onu düşürüyor ve her jeton yenilemesinde bir warn satırı yazıyor. Merkezde günün **ilk** ara toplamı kalıyor. Jeton sayacı (`ki_ausgabe`, şart 6) etkilenmez — kota bu yüzden doğru işler. Ama O-169 **şart 7** (gece Azure toplamı ↔ bildirilen toplam) bu hâliyle anlamsız: bildirilen toplam sistematik olarak eksik kalır, karşılaştırma her gece yanlış alarm verir ya da eşik gevşetilip körleşir. Hasta verisi yok (rapor yalnız görev başına sayaç) → G1'e değmiyor |
| **Çözüm** | **Tavsiye (a):** merkez aynı `(box_id, reportId)` için **monoton artan** güncellemeyi kabul eder ve satırı günceller. Her metrik ≥ önceki ise yeni sonuç `'guncellendi'` (ack döner); herhangi bir metrik azalıyorsa, `windowStart` değişiyorsa ya da yeni görev anahtarı dışında yapı farklıysa `'abweichend'` (red). İstemci değişmez. Gerekçe: `taskTotals` RAM'den değil kutunun DB'sindeki audit kayıtlarından sayfalanarak hesaplanıyor, yani restart'tan sonra da monoton; şişirme ancak imzalı kutunun **kendi** sayacını büyütmesi olur, zararsız. (b) (sıra numarası + merkez pencere başına max) istemci + merkez + sözleşme değişikliği ister, (a)'nın verdiğinden fazlasını vermiyor. Şartlar: monoton karşılaştırma sözleşme testinde hem kabul hem azalma reddi için ölçülsün · gece karşılaştırması gün başına **son** satırı okusun · ±2 gün pencere kontrolü (`server.js:294`) aynen kalsın. Sahip: Hat M uygular; (a)/(b) seçimi Hat M/Kemal. O-169 şart 7'nin ön koşulu |
| **Durum** | 🟡 `kısmen gelöst` — kod `01c99769` (09.10.2026): `merkez/db.js` `kiBerichtSpeichern` aynı `reportId` + aynı `window_start` + hiçbir sayaç düşmüyor + hiçbir görev kaybolmuyorsa satırı günceller → `'aktualisiert'` → ack (`merkez/server.js:307`); düşen/kaybolan → `'abweichend'`, log aynen; ±2 gün kontrolü dokunulmadı. Şart 1 ölçüldü (sözleşme testi: artış kabul + görev kaybı red; route testi: sayaç düşüşü red; merkez 97/97). Şart 2 (gece karşılaştırması son satırı okusun) yapı gereği sağlanıyor — gün başına tek satır; okuyan kod yok, O-169 7. şart yazılırken bakılacak. **Kalan: merkez VPS deploy** (Kemal izniyle oturum sonu). Deploy olunca `gelöst`. Neden şimdi `gelöst` değil: O-45(b) dersi — "repoda düzeltildi, sunucuya uygulanmadı" kapalı sayılırsa unutulur. Önceki: `offen` |


**(2) `0075_rechnung_aussteller_empfaenger_snapshot` (`a2772dbe`, sonra-bildir) — GEÇER, madde açılmadı.** Tip D, expand-only: `invoices`'a 2 nullable `jsonb` (DEFAULT/CHECK/FK yok) + var olan `invoice_festschreibung()` için CREATE OR REPLACE (INVOKER kalır, yeni trigger/fonksiyon yok). Sayaç-nötr (`_hinweis_0075`, `bis_version` 0075). Kilit sıkılaşması (`eigenanteil_pct/_eur`, `kassenzuzahlung`, numara, iki snapshot) eski ön yüzü kırmıyor: bu üç alan zaten `FESTGESCHRIEBENE_SPALTEN`'deydi (`module/rechnung-festschreibung.js`, `payloadFuerUpdate` draft olmayan faturada siliyor), `markiereRechnungBezahlt` (`module/rechnung-zahlung.js:69`) kilitli kolonlara dokunmuyor; kutuda ön yüz ve şema aynı image ile geliyor. Yeni `api-backend/lib/rechnung-snapshot.js` yerel, dış çağrı/env yok. Snapshot hasta verisi taşıyabilir ama kutunun kendi Postgres'inde kalıyor → G1 temiz. Süreç notu: ön kontrol atlandı, bildirim sonradan geldi (db-ustasi önceden GEÇER vermişti). Sonuç değişmedi, ama Tip D'de sıra "önce sor" — 0076'da (zorunlu snapshot = NOT NULL benzeri kural) **önce** sorulmalı: o adım `:stable`'ın snapshot yazmayan yolunu kırabilir.

**(3) WSL kutusu `hafer-turm-9` → 0.4.0+773f9ea (`1eee64f0`).** `update.sh` önce "sapma" deyip durdu: kutudaki `install.sh` (=`99ada660`) ve `ip-melden.sh` önceki test oturumlarından elle kopyalanmıştı. Taban sürümler (`63abe5f1` / `10e0e51b`, `dateien-sha.json` ile aynı) geri konunca geçti. **Bu doğru davranış ve ilk gerçek kanıtı:** elle değiştirilmiş kutu dosyası yükseltmeyi sessizce ezmiyor, durduruyor (§8'in kutu tarafındaki karşılığı). Migration öncesi şifreli yedek alındı, 0072–0075 uygulandı, 8/8 healthy, selbstcheck uyarısız. T4 ✅ (eski jeton 401 / yeni 200, `.env` = konteyner, logda jeton yok) · T6 ✅ 404 · T10 yedek→restore ✅ (sayılar aynı, anahtar logda yok). O-181 güncellendi (yukarıda).

### O-184 — `restore.sh` onayı borudan verilemiyor: `docker compose exec -T` stdin'i yutuyor ⚪ **unkritisch**

| Alan | İçerik |
|---|---|
| **Ne** | `printf '…' \| restore.sh` ile verilen onay satırı `read` (`onprem/restore.sh:189`, `:345`) ona ulaşmadan önceki bir `docker compose exec -T …` (örn. `:298`, `:404`) tarafından okunuyor |
| **Nerede** | `onprem/restore.sh` — stdin'i kapatılmamış `docker compose exec -T` çağrıları; WSL T10'da ölçüldü (`1eee64f0`) |
| **Tip** | G (kutu tarafı operasyon aracı) |
| **Kutuda ne olur** | Onay boru ile verilirse `read` boş/EOF görür → "Abbruch", rc 1, **hiçbir değişiklik yok**. Terminalde elle yazıldığında sorun yok. Güvenli yöne düşüyor |
| **Çözüm** | `unkritisch` — gerekçe: onay satırı (`KLARTEXT-WIEDERHERSTELLEN`, anahtar sorusu) **bilerek** bir insanın yazması için var; borudan verilebilmesi o korumayı boşa çıkarırdı. Bugün restore'u otomatik çağıran bir yol yok. **Yeniden açılma koşulu:** panel (Faz 2.5) ya da destek aracı restore'u etkileşimsiz çağıracaksa onay borudan **değil**, açık bir bayrakla verilir (`--onay=…`) ve stdin'e ihtiyacı olmayan `exec -T` çağrılarına `</dev/null` eklenir (aynı yutma başka bir `read`'i de bozmasın). Builder'a o gün tek satırlık iş |
| **Durum** | `unkritisch` (09.10.2026) |


---

## 7AJ — `0076_ausfallrechnung_snapshot_festschreibung` ön kontrolü (10.10.2026, Hat K, uygulama öncesi)

**Numara notu:** 7AI (3)'te "0076" diye anılan invoices zorunlu-snapshot migration'ı **artık 0076 değil**; ayrı, daha sonraki bir numara alacak. 7AI (3)'ün şartları (i)-(iv) o migration'a aynen bağlı, yeni numaraya taşınır. `0076` bu bölümdeki dosyadır.

**HÜKÜM: GEÇER.** Tip D, expand + sıkılaştırma. 2 nullable jsonb (DEFAULT/CHECK yok), yeni INVOKER fonksiyon + BEFORE UPDATE trigger, `REVOKE ALL ON ausfallrechnungen FROM anon`. Sayaç `erwartete-zaehler.json`: fonksiyon 100→101, trigger 92→93, `bis_version` 0076 (nachgerechnet).
- **`:stable` kırılıyor mu: hayır.** Trigger kuralı (b) "offen'a dönüş yok": tek yazma yolu `PATCH /ausfall/:id/status` (`api-backend/billing/api/ausfall.routes.js:442`) yalnız `bezahlt|storniert|abgeschrieben` kabul ediyor, `offen` yazan yol yok. Kural (a/c): aynı route `bezahlt` satırda zaten 409 dönüyor (`:461`). Mahnwesen (`mahnwesen.routes.js:249`) yalnız okuyor. `loeschen.js:420` yalnız okuyor; lead/booking silme FK SET NULL → trigger (d) NULL'a izin veriyor. Snapshot yazmayan eski kod sorun değil: kolonlar nullable, kilit yalnız bezahlt satırda "değişmez" diyor, "dolu olmalı" demiyor. 7AI'daki invoices tuzağı burada yok.
- **Trigger service_role'u da kapsıyor** (`invoice_festschreibung`'un `current_user` koşulu yok). Bugün service_role'un bezahlt satıra yazan yolu yok → sorun değil; ileride anonimleştirme/düzeltme betiği bezahlt satırda `notes` dışında kolon yazarsa reddedilir. Bilinçli tercih olarak not edildi.
- **Kutu:** runner dizini sırayla okur, manifest dosyası yok (`api-backend/db/` altında yalnız `migrate.js` + sayaç). Kutuda `anon` rolü Supabase yığınında var, REVOKE idempotent. Selbstcheck `ausfallrechnungen` anon hakkını saymıyor → yeni sayaç gerekmez. Kutuda kod ve şema aynı image ile geldiği için Hat M'nin create'te snapshot yazan kodu 0076 ile aynı ya da sonraki image'da olabilir; tersi sırada da kırılmaz (nullable).
- **Kalan tek şart (süreç):** aynı commit'te `db/SCHEMA.sql` + `SCHEMA-RLS.sql` tazelenir; `db/REGISTER.md` `ausfallrechnungen` girdisine iki kolon + trigger yazılır. Madde açılmadı.
- **Durum: `gelöst` (f9a7dd74, 10.10.2026).** Şart karşılandı: 0076 + iki döküm + `db/REGISTER.md` (`ausfallrechnungen` satır 730) + sayaç aynı commit'te; SaaS'a 20261010002216 ile uygulandı.

## 7AK — `0077_ausfallrechnung_sperre_ab_anlage` + `0078_zuzahlungsbeleg_invoices` ön kontrolü (10.10.2026, Hat K, uygulama öncesi)

**HÜKÜM: GEÇER, ŞARTLI** (üç süreç şartı, veto yok). Tip D, ikisi de expand + sıkılaştırma; G1/G2/G3/G8'e değmiyor (yeni dış çağrı, env, sır, Vercel fonksiyonu yok).

- **`:stable` kod + yeni şema kırılmıyor.** 0077: AF'ye `INSERT` sonrası içerik yazan kod yolu yok (`ausfall.routes.js` tek yazma yolu `PATCH /ausfall/:id/status`, yalnız status/bezahlt_at); `storniert` için kod zaten 409 dönüyor (`ausfall.routes.js:473-474`), DB'ye "storniert → başka durum yok" eklemek kodla aynı kural. FK SET NULL yolu (patient_id/booking_id → NULL) açık kalıyor, DSGVO zinciri bloklanmıyor. 0078: `set_invoice_nummer()`'ın ZU-dışı dalı canlıdakiyle (`db/SCHEMA-RLS.sql:4992-5017`) birebir; `invoice_festschreibung`'un yeni bloğu yalnız `invoice_type='zuzahlung'` satırlarda tetikleniyor, eski kod o satırı hiç yazmıyor. Yeni CHECK'ler mevcut satırları etkilemiyor (`storno_von` boş, ZU satırı yok). Eski kod ZU satırı yazmadığı sürece hiçbir yeni kural devreye girmiyor.
- **`nummernkreise`:** `kreis` üzerinde CHECK yok (`db/SCHEMA.sql:2324-2329`), PK `(owner_id, kreis, jahr)`; `naechste_nummer()` upsert (`SCHEMA-RLS.sql:3055-3070`) → `zuzahlung` kreis satırı ilk ZU'da kendiliğinden doğar, mevcut `rechnung`/AF satırlarına dokunulmuyor. Kutuda geçiş verisi gerekmez.
- **`update.sh` sırası:** `[8/11]` bekleyen migration görür → `vor-migration` yedeği → `[9/11]` `up -d` → api açılışta `migrate.js` sırayla, her dosya kendi transaction'ında (`migrate.js:271-279`; iki dosyada da `-- no-transaction` yok) → 0078 yarıda kalırsa tamamı geri alınır. Geri alma (sağlıksız) sonrası eski image `downgrade` diye durur (`migrate.js:244-257`) — bilinen, yedekle karşılanan yol, bu iki dosyaya özgü değil. Europe/Berlin tz kutudaki Supabase Postgres'te var.
- **Selbstcheck:** `erwartete-zaehler.json` `bis_version 0078`, index 313→315 (iki partial UNIQUE), diğer sayaçlar nötr — kendi saydığım nesnelerle uyuşuyor. `zaehlerPruefen` (`schema-zaehler.js:87`) yalnız kutu sürümü bis_version'dan **yeniyse** griye düşer; eskiyse kırmızı.
- **Şart 1 — tek commit:** 0077 + 0078 + `erwartete-zaehler.json` aynı commit'te (aynı image). Ayrılırsa 0077'de kalan bir kutu `bis_version 0078 / index 315` beklentisiyle 313 ölçer → selbstcheck `schema` kırmızı.
- **Şart 2 — 0077'ye storniert kuralı canlıdan ÖNCE:** dosya MCP ile uygulanmadan düzenlenir; uygulandıktan sonra SHA değişirse kutu açılmaz (değişiklik ancak yeni dosyayla).
- **Şart 3 — kod sırası:** ZU yazan route **migration commit'inden sonra** gelir (önce gelirse CHECK `invoice_type` 'zuzahlung'u reddeder → ZU baskısı 500). SaaS'ta Vercel (frontend) ile Watchtower (backend) ayrı anlarda iner: ZU satırını yazan backend, liste filtrelerini + "Zahlung" düğmesinden ZU'yu çıkaran frontend ile **aynı push'ta** olmalı; arada eski frontend ZU'yu "Rechnung" sanıp `rechnung_zahlung_buchen()` ile ikinci belegliste kaydı açabilir (0078 başlığı "Zahlung"). Kutuda frontend+backend aynı image → pencere yok. Canlı müşteri yok, risk düşük; yine de sıra bu.
- **Gözlem (veto değil):** 0078 başlığındaki "Bekannte Berührungspunkte" listesi (6 kod yeri) dağıtım değil ürün işi — `fonksiyon-ustasi`. Sayaçlar nachgerechnet; fiziksel ölçüm bir sonraki WSL kutu turunda. Madde açılmadı.
- **Durum: `gelöst` (bf34ac97 + 7bfc04ea, 10.10.2026).** Üç şart koda karşı doğrulandı. Şart 1: 0077 + 0078 + `erwartete-zaehler.json` (`bis_version 0078`, index 315) + iki döküm aynı commit'te (bf34ac97). Şart 2: storniert kuralı 0077'nin içinde (`0077_…sql:59-62`), route 409'u aynı commit'te (`ausfall.routes.js:472`); SaaS'a dosyanın son hâli uygulandı (20261010005233), sonradan SHA değişikliği yok. Şart 3: ZU yazan backend route (`abrechnung.routes.js`, `billing/zuzahlung/zu-beleg.js`) ile liste/Zahlung filtreleri (`module/rechnung-*.js`, `selbstzahler-stufen.js`) tek commit ve tek push'ta (7bfc04ea), migration commit'inden sonra. Yeni env, dış çağrı, zamanlanmış iş yok. Açık kalan tek şey zaten yazılı: sayaçların fiziksel ölçümü bir sonraki WSL kutu turunda (KHS §5b).

---

## 7AL — Release 0.5.0 + soak bildirimi (10.10.2026, sonra-bildir)

**(1) Yayın kaydı.** `v0.5.0` = `c0c0231b` (tag 10.10.2026 11:38:42 +0200, origin'de var). MINOR; migration 0060–0078 (v0.4.0 = `52012569`, 03.10.2026'dan beri). Zincirde 79 dosya (0000–0078). Kemal kararı: `:stable` henüz taşınmaz, önce 0.5.0 soak. §7AI (3) şart (i) ("snapshot yazan kod `:stable`'da") bu promote ile kapanır; (ii) backfill + (iv) migration ondan sonra, yine ön kontrolle.

**(2) Yayından sonraki dört commit — HÜKÜM: GEÇER.** `fc8b307b` · `46350155` · `81f9aa60` · `b6151dc6` (`c0c0231b..HEAD`): `api-backend/db`, `onprem/`, `db/`, `VERSION` altında diff **boş** (şema, paket, manifest, sürüm değişmedi). Yeni dosya `api-backend/billing/zuzahlung/erbrachte-sitzungen.js` yalnız `.from('podologie_behandlungen')` okuyor (`:24`); eklenen satırlarda `fetch(`, `process.env`, sabit host, `.rpc(`, zamanlayıcı yok (grep, 0 eşleşme). Image ile gider, iki dağıtımda aynı kod. Sicile ayrı madde gerekmez.

### O-187 — Soak edilen image ile `:stable`'a taşınacak image aynı değil: kutu `:beta` (0.5.0+81f9aa6) çalıştırıyor, `promote-stable.yml` `:0.5.0`'ı (`c0c0231b` build'i) taşır 🟡 **kısmen gelöst (`40491962`: kutu `:0.5.2`'ye sabit, soak 10.10.2026 13:36:44'ten; `ac1504d0`: promote kapısı digest doğruluyor; kalan: promote 13.10 — KHS §6 Punkt 2)**

| Alan | İçerik |
|---|---|
| **Ne** | 72 saatlik soak bir artefaktın üzerinde sayılıyor, promote başka bir artefaktı yükseltecek. Arada 3 kod commit'i var (frontend'de 4) |
| **Nerede** | `.github/workflows/promote-stable.yml` (retag adımı: kaynak `…/{calendar-api,frontend}:${SURUM}`, yani `:0.5.0`) · `publish-calendar-api.yml:172-175` + `publish-frontend.yml:155-158` (`X.Y.Z` etiketi **yalnız** yayın koşusunda basılır; sonraki push'lar yalnız `:beta` + sha alır) · `git tag`: `v0.5.0 → c0c0231b` · kutu: `0.5.0+81f9aa6` (KHS `:474`) · `onprem/install.sh:1260-1279` (`praxura-update.timer`, her gece 02:00 + 2 saate kadar gecikme) |
| **Tip** | G (yayın süreci) — korkuluk değil, `RELEASE-STANDARD.md` §6.3 Katman 2 / R8 |
| **Kutuda ne olur** | (a) 13.10'da `surum=0.5.0` ile promote edilirse `:stable` kutuları `c0c0231b` build'ini çeker: **hiçbir kutuda 72 saat çalışmamış** bir image, ve bugünkü dört düzeltme (Podologie-Zuzahlung, ZU-Beleg, Rechnungsentwurf) içinde **yok**. R8'in yazdığı durum tam bu: "soak edilen ile yayınlanan ayrışırsa 72 saat hiçbir şey kanıtlamaz". (b) Kutu `:beta`'da ve gece timer'ı açık: bu gece 02:00–04:00 arası o anki `:beta`'yı çeker. `b6151dc6` yalnız frontend dosyalarına dokunuyor → `frontend:beta` şimdiden `81f9aa6`'dan ileride olabilir (13:03'te kutunun hangi frontend digest'ini çektiği ölçülmedi; `/health` yalnız api sürümünü gösterir). Yani "81f9aa6 üzerinde 72 saat" bugünkü kurulumla zaten tutulamaz: her main push'u kutuyu taşır. (c) İş akışının saat kapısı tag commit zamanını ölçer (`git log -1 --format=%ct v0.5.0` → 11:38:42), kutunun güncellendiği anı değil: kapı 13.10 **11:38**'de açılır, gerçek soak 13:03'te doluyor. Kapı hangi image'ın soak edildiğini de bilmez; tek koruma `soak_kanit` metni |
| **Çözüm** | **Öneri: 0.5.1 (PATCH) bas, kutuyu ona sabitle, saati oradan say.** PATCH şartı tutuyor: `c0c0231b`'den beri yeni migration yok. Adımlar: (1) `VERSION` 0.5.1 + `onprem/manifest.json` `surum` (kapı O-25/R12 eşitliği ister) → yayın koşusu iki image'a `:0.5.1` basar; bu etiket o commit'in `:beta` + sha'sı ile **aynı build, aynı digest**. (2) Kutunun `.env`'inde `PRAXURA_API_IMAGE` ve `PRAXURA_FRONTEND_IMAGE` `:beta` yerine `:0.5.1` (update.sh image adını `.env`'den olduğu gibi okur, `update.sh:132`) → `update.sh --jetzt`. Değişmez etiket olduğu için gece timer'ı ve sonraki main push'ları kutuyu **taşımaz**; soak sırasında main'e yazmak serbest kalır, saat sıfırlanmaz. (3) Saat kutunun 0.5.1'e geçtiği andan sayılır; `soak_kanit`'a kutu adı + başlangıç anı + iki image'ın digest'i (`docker image inspect … RepoDigests`) yazılır. (4) Promote `surum=0.5.1`. Bedel: saat birkaç saat geriye gider. **Alternatif:** kutuyu `:0.5.0`'a sabitle ve onu soak et; o zaman bugünkü dört düzeltme `:stable`'a girmez ve §7AI sonrası ilk iş yine bir PATCH olur — daha uzun yol. **Yapılmaması gereken:** kutu `:beta`'dayken 13.10'da `surum=0.5.0` promote etmek. Soak'tan sonra kutu tekrar `:beta`'ya alınır (K-1: test kutusu beta kanalında). Sabitlemenin `update.sh`'ın `.env` birleştirmesinden sağ çıktığı kutuda bir kez görülmeli (koddan okundu, ölçülmedi). **Kalıcı düzeltme uygulandı (`ac1504d0`, 10.10.2026, §7AN (1)): saat soak başlangıcından sayılıyor, iki digest retag'den önce doğrulanıyor ve özete yazılıyor.** Eski metin, aday (builder, ayrı iş): `promote-stable.yml` saat kapısı için girdi olarak soak başlangıcını alsın ya da en azından taşıdığı iki digest'i özet'e yazsın; bugün "hangi image taşındı" kaydı tutulmuyor |
| **Durum** | 🟡 `kısmen gelöst` (10.10.2026, `40491962`) — öneri uygulandı, sürüm 0.5.1 değil **0.5.2** (sebep ve ölçüm: §7AM). Kapanış şartı: `promote-stable.yml surum=0.5.2`, en erken **13.10.2026 13:37**, digest karşılaştırmasını artık iş akışı kendi yapıyor (`ac1504d0`; girdiler §7AN (2)'de yazılı iki değerdir, 13.10'da kutudan yeniden okunmaz), sonra kutunun `.env`'i tekrar kanala. Eski metin: `offen` (10.10.2026) — karar Kemal'de: 0.5.1 mi, `:0.5.0`'a sabitleme mi. Sahibi KHS §6 Punkt 2 (`KUTU_HAZIRLIK_SPRINT.md:468`). Not: §9 B adım 10/11 "staging + en az bir sponsor kutu, gerçek kullanım" ister; bugün tek kutu var (WSL hafer-turm-9, test verisi). Sahada müşteri kutusu olmadığı için risk düşük, ama `soak_kanit`'a "tek kutu, test kullanımı" diye **olduğu gibi** yazılır |

## 7AM — 0.5.2 + kutu sabitleme bildirimi (10.10.2026, sonra-bildir) — O-187 onayı

**(1) Ne yapıldı.** O-187 önerisi uygulandı, tek farkla: 0.5.1 (`dfb3358d`) yerine **0.5.2** (`40491962`). Sebep: 0.5.1 koşusunda frontend workflow'u `v0.5.1` git tag'ini önce bastı, calendar-api workflow'u (önce `test` job'u, `publish-calendar-api.yml:70`) tag'i görünce `release=false` dedi; `calendar-api:0.5.1` hiç çıkmadı. Düzeltme iki publish workflow'unda: tag **aynı commit'i** gösteriyorsa koşu yayın koşusudur; `ONCEKI` güncel `VERSION`'ı dışlar (`publish-calendar-api.yml:103-112`, `publish-frontend.yml:90-99`). PATCH şartı tutuyor: `v0.5.0`'dan beri yeni migration yok.

**(2) Registry'ye karşı ölçüldü (onprem ajanı, 10.10.2026, GHCR anonim manifest sorgusu).** `calendar-api:0.5.2` = `sha256:641f4392…4dbeac`, `frontend:0.5.2` = `sha256:7509159d…63e37f`. Kutunun bildirdiği iki image id bu iki digest ile **birebir aynı**: soak edilen = promote edilecek artefakt. `:beta` şu an ikisinde de aynı digest (`3d0d0267` yalnız belge, image üretmedi). `:stable` iki image'da da **404**: kanal henüz hiç basılmadı, ilk promote onu yaratır.

**(3) Soak kaydı (`soak_kanit`'a olduğu gibi yazılır).** Kutu `hafer-turm-9` (WSL, **tek kutu, test kullanımı**; staging + sponsor kutu yok). `.env`: `PRAXURA_API_IMAGE` ve `PRAXURA_FRONTEND_IMAGE` `:0.5.2`'ye sabit; `update.sh --jetzt` sabitlemeyle geçti (O-187'de "koddan okundu, ölçülmedi" denen nokta **kutuda ölçüldü**). Başlangıç kutu saatiyle 10.10.2026 13:36:44, `IMAGE_VERSION=0.5.2+4049196`, 78/78 migration, 8/8 healthy. Ek ölçüm: sabit etiket registry'de yokken (`:0.5.1` denemesi) `update.sh` „Pull fehlgeschlagen — nichts wurde verändert" deyip durdu; kutu bozulmadı.

**(4) Açık kalan risk — promote öncesi tek kontrol.** `:0.5.2` etiketi değişmez **değil**: düzeltmeden sonra `40491962` koşusu yeniden çalıştırılırsa ("Re-run jobs") tag aynı commit'te olduğu için yine `release=true` olur, image yeniden build edilir ve `:0.5.2` **yeni bir digest** ile üzerine yazılır; kutu etikete sabit, digest'e değil, gece 02:00 timer'ı yenisini çeker ve soak sessizce başka artefakta geçer. Koruma: 13.10'da promote'tan hemen önce registry digest'leri (2)'deki iki değerle karşılaştırılır; farklıysa saat sıfırlanır. Soak bitene kadar `40491962` koşusu yeniden çalıştırılmaz. Sahibi: KHS §6 Punkt 2 (promote adımı). Küçük not: saat kapısı tag commit zamanını ölçer (13:32:03), kutunun geçiş anını değil; kapı gerçek soak'tan 4 dk 41 sn önce açılır: 13:37'den önce basılmaz. Kalıcı düzeltme (kapı digest'i kaydetsin, çifti önceden doğrulasın) O-187'nin "kalıcı düzeltme adayı"nda duruyor, **sahibi hâlâ yok** (builder işi, Ops kartı açılmalı). → ✅ `ac1504d0` ile yapıldı (§7AN); iş akışında kalan üç açık O-189.

### O-188 — `calendar-api:0.4.0` ve `calendar-api:0.5.1` registry'de yok, `frontend` karşılıkları var: iki sürümün image çifti yarım ⚪ **unkritisch**

| Alan | İçerik |
|---|---|
| **Ne** | Git tag'i ve frontend image'ı olan iki sürümün api image etiketi hiç basılmadı (yarış: O-187 §7AM (1)) |
| **Nerede** | GHCR, 10.10.2026 ölçümü: `calendar-api:0.4.0` 404 · `calendar-api:0.5.1` 404 · `frontend:0.4.0` 200 · `frontend:0.5.1` 200 · `calendar-api:0.5.0` + `:0.5.2` 200 · git: `v0.4.0`, `v0.5.1` var |
| **Tip** | G (yayın süreci), R5 (çift birlikte gider) |
| **Kutuda ne olur** | Hiçbir kutu etkilenmez: `:stable` hiç basılmadı, tek kutu `:0.5.2`'de. Biri yanlışlıkla `surum=0.4.0` ya da `0.5.1` promote ederse tag var ve 72 saat kapısı geçer, ama retag döngüsü `calendar-api` ile başlar (`promote-stable.yml`, `for IMAGE in calendar-api frontend`), kaynak bulunmaz, `set -e` durdurur: `frontend:stable` **taşınmaz**, yarım çift kanala çıkmaz. Kutuyu bu etiketlere sabitlemek de zararsız: `update.sh` çekemez ve hiçbir şeyi değiştirmeden durur (ölçüldü, §7AM (3)) |
| **Çözüm** | `unkritisch`: iki sürüm de **promote edilmeyecek** (0.4.0 eski, 0.5.1'in yerini 0.5.2 aldı), geriye dönük image basılmaz. Sebep `40491962` ile kapandı. ⚠️ Koruma döngü **sırasına** dayanıyor: sıra `frontend calendar-api` olsaydı yarım çift `:stable`'a çıkardı. `promote-stable.yml` elden geçirilirken iki kaynağın varlığı retag'den önce doğrulanmalı (O-187 kalıcı düzeltme adayıyla aynı iş). ✅ `ac1504d0` (10.10.2026): iki kaynak retag'den önce doğrulanıyor, biri yoksa hiçbiri taşınmıyor; koruma artık döngü sırasına dayanmıyor. Kalan artık (iki kaynak da var, ikinci retag yarıda düşerse): O-189 (b) |
| **Durum** | `unkritisch` (10.10.2026) |

## 7AN — `promote-stable.yml` digest kapısı bildirimi + invoices zorunluluk migration'ı ön sorusu (10.10.2026 öğleden sonra, sonra-bildir + önce-sor)

**(1) Ne yapıldı (`ac1504d0`, `.github/workflows/promote-stable.yml`, +65/−6).** O-187'nin "kalıcı düzeltme adayı" ve O-188'in uyarısı uygulandı. Niye: soak edilen artefakt ile `:stable`'a taşınanın aynı olduğunu bir insanın hatırlaması değil iş akışı zorlasın; yarım çift kanala çıkmasın. Üç yeni zorunlu girdi (`soak_baslangic`, `api_digest`, `frontend_digest`; biçim kontrolü `:61-70`). Saat kapısı `max(tag commit zamanı, soak_baslangic)`'tan sayıyor (`:90-91`). Retag'den önce iki kaynak `imagetools inspect …:SURUM` ile okunup beklenen digest ile karşılaştırılıyor; biri yoksa ya da farklıysa hiçbiri taşınmıyor (`:124-135`). Retag kaynağı etiket değil `IMAGE@digest` (`:142`); taşıma sonrası `:stable` yeniden okunuyor (`:143-147`). Özet'e soak başlangıcı + iki digest yazılıyor (`:158-163`).

**(2) 13.10'da girilecek iki değer — soak BAŞINDA ölçülen (10.10.2026 14:24, kutu `RepoDigests` = registry = `:beta`):**

- `api_digest` = `sha256:641f43921abea5f2bae1ee8222c02962a3aa34cdb327910a8ea31f193a4dbeac`
- `frontend_digest` = `sha256:7509159ddff23b27b3f062b79fe250436ff3fb0b8022c5eb904b794fa563e37f`
- `soak_baslangic` = `2026-10-10T13:36:44+02:00` (13.10 hâlâ yaz saati; saat dilimi yazılmazsa runner UTC sayar, kapı 2 saat **geç** açılır: güvenli yön)

⚠️ Bu iki değer 13.10'da kutudan **yeniden okunmaz**, buradan kopyalanır. Sebep: `:0.5.2` etiketi üzerine yazılabilir (§7AM (4)); arada yayın koşusu yeniden çalıştırılmışsa kutu gece timer'ıyla yeni digest'e geçmiş olur, o gün kutudan okunan değer registry ile yine uyuşur ve kapı **geçer**: 72 saat soak etmemiş artefakt `:stable`'a çıkar. Kapı "registry = girdi" eşitliğini ölçer, "girdi = 72 saat önceki" eşitliğini ölçemez; onu bu kayıt taşır. 13.10'da ek kontrol: kutuda `docker image inspect` hâlâ bu iki digest'i gösteriyor mu, api/caddy restart sayısı 0 mı.

**(3) Diff okuması — sorulan üç nokta, üçü de temiz.**

- **Index digest'i / platform manifest'i:** iki publish workflow'unda `platforms`/`provenance` ayarı yok (grep, 0 eşleşme) → `build-push-action` varsayılanıyla image bir OCI index'tir (platform manifest'i + attestation). `imagetools inspect --format '{{.Manifest.Digest}}'` **en üst** digest'i verir; kutunun `RepoDigests`'i de etiketle çekilen en üst digest'tir. İkisinin aynı olduğu ölçüldü ((2)). `imagetools create` tek kaynakla index'i olduğu gibi kopyalar; digest korunduğu `:143-147`'de zaten yeniden ölçülüyor. İleride `platforms: linux/amd64,linux/arm64` eklenirse de aynı kalır (yine en üst digest).
- **`GITHUB_TOKEN`:** `packages: write` var (`:39`). Paketleri aynı deponun workflow'ları yarattığı için yetki bağlı olmalı; **ölçülmedi**: `:stable` iki image'da 404, yani bu iş akışı bugüne kadar hiç başarıyla koşmadı. İlk gerçek koşu 13.10.
- **`date -d`:** GNU date ISO + `+02:00`'ı okur. Gelecekteki an → fark negatif → red. Tag'den eski an → tag zamanına kırpılır (eski davranış). Tam saat aşağı yuvarlanır (71 sa 59 dk → red). "3 days ago" gibi serbest metin de okunur ama tag zamanından geriye gidemez: kapı eskisinden gevşek değil.

**(4) Görülen açıklar** → O-189 (aşağıda). Hiçbiri 13.10 promote'unu durdurmaz; (a) o gün girdi yazarken dikkat ister.

### O-189 — `promote-stable.yml`: `soak_kanit` kabuğa ham giriyor · iki retag atomik değil · iş akışı hiç uçtan uca koşmadı 🟠 **offen**

| Alan | İçerik |
|---|---|
| **Ne** | `ac1504d0` sonrası iş akışında kalan üç açık. Üçü de bu commit'in getirdiği şey değil; (a) eskiden beri var, (b) doğrulamanın kapatamadığı artık, (c) ilk koşunun riski |
| **Nerede** | `.github/workflows/promote-stable.yml:57` ve `:167` (`${{ github.event.inputs.soak_kanit }}` doğrudan `run:` metninin içinde; üç yeni girdi `:30-32`'de `env` üzerinden, doğru desen orada) · `:138-148` (retag döngüsü) · GHCR: `calendar-api:stable` + `frontend:stable` 404 (§7AM (2)) |
| **Tip** | G (yayın süreci), R5 (çift birlikte gider) |
| **Kutuda ne olur** | **(a)** Kanıt metninde `"`, ters tırnak ya da `$(` varsa: `:57` adımı sözdizimi hatasıyla düşer (hiçbir şey taşınmaz, zararsız) **ya da** metin sessizce kısalır/komut olarak çalışır; `:167` ise retag'den **sonra** koşar: `:stable` taşınmış, "Kayıt" adımı kırmızı, özet (hangi digest taşındı) kayıp. Sicilin kendisi kanıta ``docker image inspect … RepoDigests`` yazılmasını öneriyordu (O-187), yani bu metin ters tırnakla yazılmaya yatkın. Tetikleyebilen yalnız yazma yetkili kişi; güvenlik değil, doğruluk açığı. **(b)** İki kaynak doğrulandıktan sonra `calendar-api:stable` taşınır, ardından `frontend:stable`. İkincisi registry hatasıyla düşerse kanalda yeni api + eski frontend durur. Registry'de iki etiketi tek işlemde taşımak yok. 13.10'da zararsız: `:stable`'da kutu yok, `frontend:stable` henüz hiç yok ve olmayan etikette `update.sh` hiçbir şeyi değiştirmeden durur (§7AM (3), ölçüldü). Ücretli kutular `:stable`'a bağlandığında saatlik çekme (§6.4) yarım çifti yakalayabilir. Aynı girdilerle yeniden çalıştırmak düzeltir (kaynak digest, işlem tekrarlanabilir). **(c)** Giriş, `inspect --format` çıktısı ve `create` runner'ın buildx sürümünde hiç denenmedi (kutuda denendi, runner'da değil); bir uyumsuzluk 13.10'da çıkar ve promote'u geciktirir, yanlış bir şey taşımaz |
| **Çözüm** | Üçü de `builder`, tek küçük iş. **(a)** `soak_kanit` ve `surum` da `env` üzerinden okunsun (`"$SOAK_KANIT"`). O zamana kadar kural: kanıt metninde `"`, ters tırnak, `$` **yok**. **(b)** Retag'den önce iki `:stable`'ın eski digest'i okunsun; ikinci taşıma düşerse birincisi eskiye geri alınsın, en azından "YARIM ÇİFT, aynı girdilerle yeniden çalıştır" yazsın. Son tarih: ilk ücretli kutu `:stable`'a bağlanmadan önce. **(c)** Salt-okur doğrulama (giriş + iki `inspect` + karşılaştırma) saat kapısının **önüne** alınırsa iş akışı bugün gerçek girdilerle çalıştırılabilir: runner'da her şeyi dener, 72 saat kapısında durur, hiçbir şey taşımaz. Sahibi: KHS §6 Punkt 2 (promote adımı) — Ops kartı henüz yok, o yüzden `offen` |
| **Durum** | 🟠 `offen` (10.10.2026) |

**(5) Ön soru — invoices zorunluluk migration'ı (§7AI (3) (i)(ii)(iv), §7AJ numara notu): promote beklenmeden ne hazırlanır.**

**HÜKÜM: zincire bugün dosya girmez — ne (ii) ne (iv). Hazırlık serbest.** Tip D.

- **(i) bugünkü durum:** snapshot yazan kod `v0.5.2`'nin içinde (`a2772dbe` `module/rechnung-snapshot.js` + `api-backend/lib/rechnung-snapshot.js`, `c1d4a113` (iii); üçü de `git merge-base --is-ancestor … v0.5.2` ile doğrulandı). Yani (i) 13.10 promote'u ile kapanır, başka iş gerektirmez.
- **(ii) teknik olarak (i)'ye bağlı değil, ama bugün zincire girmemeli.** Bağlı değil: backfill yalnız `status='draft'` + snapshot NULL satırlara yazar; draft'ta kilit yok (`0075`, `IF OLD.status = 'draft' THEN RETURN NEW`), kolonlar 0075'ten beri var, eski kodu kıracak bir şey yok. Kutuda kod ve şema aynı image ile gelir: backfill'i taşıyan image snapshot yazan kodu da taşır. Bugün girmemesinin sebebi başka: **soak sırasında main'e migration girerse PATCH kaçış yolu kapanır.** 0.5.2'de 13.10'a kadar bir hata çıkarsa çözüm 0.5.3 PATCH'tir ve PATCH şartı "yeni migration yok"tur (`RELEASE-STANDARD.md` §2.2, §9 adım 1). Zincirde 0079 varsa o düzeltme MINOR olur (göç-öncesi yedek, yükseltme provası, yeni şemayla sıfırdan soak) ya da dosya geri çekilmek zorunda kalır; SaaS'a uygulanmış dosya ise geri çekilemez. 72 saat bekleyerek alınan şey tam bu kaçış yolu. Bugün `v0.5.2..HEAD` arasında `api-backend/db`, `VERSION`, `onprem/manifest.json` diff'i **boş**: yol açık, öyle kalsın.
- **"SaaS'ta tek seferlik veri düzeltmesi + kutu için migration" reddedildi.** Aynı veri hâli iki ayrı yoldan üretilir (elle SQL ve zincir dosyası): iki şema gerçeğinin veri karşılığı, G7'nin yasakladığı şey. Kazancı da yok: SaaS'ta canlı müşteri yok, eski draft'lar test verisi. Tek yol zincir dosyası; SaaS'a da o dosya uygulanır.
- **(iv)'ü şimdi zincire koymak neden yanlış:** (1) yukarıdaki PATCH gerekçesi aynen. (2) Runner dizini sırayla okur, manifest yok (§7AJ): zincire giren dosya bir sonraki `:beta` image'ında **koşar**, "hazır dursun" diye bir ara durum yok. (3) Kural gereği dosya SaaS'a da uygulanır; backfill'siz uygulanırsa eski NULL draft'lar ödenemez olur ((iii) sayesinde artık sessiz değil, ama yine kırık). (4) Sıkılaştırma iki adımdır: yazan kod bir sürümde kanala çıkar (0.5.2), zorunluluk **sonraki** sürümde gelir. İkisi aynı ilk `:stable` sürümüne sıkışırsa "snapshot yazmayan bir yol kaldı mı" sorusunu soak değil müşteri cevaplar.
- **Şimdi yapılabilir (zincir dizininin dışında, canlıya dokunmadan):** (1) `db-ustasi` ile (ii)+(iv) taslağı; dosya `api-backend/db/migrations/` altına **konmaz**. (2) SaaS'ta salt-okur sayım: draft + snapshot NULL kaç satır, draft olmayan + NULL (Altbeleg) kaç satır. (3) Yazma yolu envanteri, bu turda çıkarıldı: draft yaratan tek yol `dashboard.js:13593-13594` (snapshot yazıyor); draft'tan çıkaran iki yol `rechnung_zahlung_buchen` (`db/SCHEMA-RLS.sql:4725`) ve `module/rechnung-zahlung.js:72`, ikisi de snapshot **yazmaz**; `api-backend/billing/zuzahlung/zu-beleg.js:138-147` ZU beleğini doğrudan `status='sent'` ile snapshot'lı INSERT ediyor. (4) Taslağın denemesi atılabilir bir Postgres'te; **soak kutusunda değil** (hafer-turm-9'a elle SQL = soak kanıtı kirlenir). (5) Migration içermeyen kod commit'leri serbest: kutu `:0.5.2`'ye sabit, main'e yazmak saati sıfırlamaz.
- **Taslak için iki not (`db-ustasi`'ye):** kural yalnız "draft'tan çıkış"ı (UPDATE) değil, **draft olmayan INSERT**'i de kapsamalı (ZU beleği o yoldan giriyor; bugün snapshot'lı, ama kural onu da tutmalı). Düz `CHECK … NOT VALID` **olmaz**: `NOT VALID` yalnız mevcut satırların taranmasını atlar, sonraki her UPDATE'te yine uygulanır; snapshot'sız eski bir `sent` faturanın ödemesi (`sent`→`paid`) reddedilir. Trigger geçiş anına bakmalı. §7AI'daki `current_user` notu geçerli: kural `authenticated/anon` koşuluna bağlanırsa RPC ve service_role yolu dışarıda kalır.
- **Promote sonrası:** (ii) ve (iv) **aynı commit**, ardışık numara (sıradaki boş: 0079, 0080), önce backfill; iki döküm + `erwartete-zaehler.json` + `db/REGISTER.md` aynı commit'te (§7AK şart 1 ile aynı sebep). Sürüm MINOR (0.6.0), kendi 72 saat soak'ı. Canlı şema Kemal'e sorulur. Dosya yazılmadan önce bu ön kontrol yeniden çalışır.
- Madde açılmadı; sahibi KHS §6 Punkt 2.
