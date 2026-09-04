# SÜRÜM VE DAĞITIM STANDARDI — "Praxura Lokal"

> **Bu dosya nedir:** Müşterinin kendi sunucusunda çalışan Praxura'nın **nasıl
> sürümlendiği, nasıl yükseltildiği, nasıl kurulduğu ve nasıl ayakta tutulduğu.**
> Kullanıcının cümlesiyle ihtiyaç: *"her müşteri kendisi lokalde çalıştıracak, bizim için
> kurulumun kolay ve sistemin stabil olduğu bir senaryo… belli bir kalitede, standartlara
> bağlı kalarak yap."*
>
> **Bu dosya kod değildir.** Araçları `builder` yazar. Burada yazan şey: neyin yapılması
> gerektiği, hangi sektör pratiğine yaslandığı, hangi kısmının bize **uymadığı**, ve hangi
> kararın kullanıcıya ait olduğu.
>
> **Sahibi:** `onprem` ajanı · **Yazıldı:** 2026-09-04
> **Girdi:** `ONPREM_MIGRATION_PLAYBOOK.md` (K1-K14, G1-G8, Faz 0-6) · `onprem/REGISTER.md` ·
> `onprem/SCHEMA-VERTEILUNG.md` (özellikle §4 runner, §6 kanal disiplini, §7 yedek bağı,
> §11 kilitli üç karar) · `LEGAL_ONPREM_REQUIREMENTS.md` §6 (CRA) ·
> `.github/workflows/publish-calendar-api.yml` · `api-backend/Dockerfile` ·
> `api-backend/docker-compose.yml`
>
> **Kilitli kararlar bu belgenin girdisidir, konusu değildir.** K8/G3 (n8n pakete girmez),
> K10 (kutuya erişimimiz yok), K11 (`:beta`/`:stable`), G1 (hasta verisi bize akmaz),
> G2 (sır image'a gömülmez), G7 (fork yok) yeniden açılmaz. Bu belgede bir yerde
> **kullanıcı kararı** gerekiyorsa açıkça öyle yazar (§11).
>
> **Depo public:** bu dosyada sır, anahtar, gerçek IP/host, hasta verisi, beta müşteri adı
> yoktur ve olmayacaktır.

---

## 0. Bir sayfada özet

| Soru | Cevabımız |
|---|---|
| **Sürüm numarası** | `MAJOR.MINOR.PATCH`. MINOR = aylık `:stable` yayını (migration içerebilir). PATCH = ara düzeltme, **migration İÇEREMEZ** (bu yüzden her PATCH geri alınabilir). MAJOR = elle adım gerektiren sürüm — hedef: yılda sıfır |
| **Kanallar** | `:beta` (her main push, yalnız bizim sponsor kutularımız) · `:stable` (yayın, ücretli müşteri) · değişmez `X.Y.Z` ve digest her zaman var. `latest` **kullanılmaz** |
| **`:stable` ne zaman ilerler** | Sürüm çıkar → `X.Y.Z` basılır → bizim staging + en az bir sponsor kutuda **72 saat** sorunsuz → ancak o zaman `:stable` etiketi yeni digest'e taşınır. Etiket taşınana kadar hiçbir müşteri kutusu görmez |
| **Kaç sürüm geriden yükseltme** | Sınır yok — **atlanamayan durak (Pflichtstation) yoksa.** Duraklar `releases.json`'da ilan edilir ve runner atlamayı reddeder. Hedef: durak listesi **boş kalsın** (§3.3 kuralı bunu mümkün kılıyor) |
| **Yedek** | Migration çalışmadan **önce** kutu kendisi yedek alır (`vor-<sürüm>`); yedek alınamıyorsa migration **çalışmaz** |
| **Geri alma** | PATCH: eski digest'e geri sabitle, biter. MINOR: şema ileri gitti → geri dönüş yalnız göç-öncesi yedekten. Bu sınır dürüstçe yazılır, gizlenmez |
| **Kurulum başarılı sayılır** | §5.4'teki **14 kontrolün 14'ü** yeşilse. Biri kırmızıysa kurulum "bitti" demez, kurulum modunda kalır |
| **En büyük tekil risk** | Bozuk image'ın Watchtower ile 20 kutuya aynı anda gitmesi. Bu bir kez yaşandı (SaaS, `SUPABASE_SERVICE_KEY` yazım hatası → crash-loop, 60 sn'de canlı). Önlem üç katmanlı: CI'da **gerçek CMD ile smoke-test** · 72 saat soak · kutuda **crash-loop yerine bakım modu** (§6.3) |
| **Bugün karara bağlanması gereken** | Lisans yenileme çağrısının sağlık durumu taşıyıp taşımayacağı (G1'in lafzını genişletir) — §11.1 |

---

## 1. Hangi kaynaklara baktım

Aşağıdakiler **pazarlama sayfası değil, kurulum/yükseltme dokümanının kendisidir**;
2026-09-04'te doğrudan çekildi. Alıntılanan davranışlar o günkü hâlleridir.

| Ürün | Baktığım belge | Bize niye benziyor / benzemiyor |
|---|---|---|
| **Sentry self-hosted** | `develop.sentry.dev/self-hosted/`, `/releases/`, `/backup/` | Docker-compose + `install.sh` düzeni bizimkiyle **birebir aynı sınıf**. Ama Sentry müşteriden ücret almıyor, destek vermiyor ("that's where our involvement ends") — bizde ücretli müşteri var |
| **GitLab Self-Managed** | `docs.gitlab.com/update/upgrade_paths/`, `/policy/maintenance/` | Kurumsal, ekipli, admin'i olan müşteri. **Yükseltme durakları** ve **bakım penceresi** kavramları doğrudan alınabilir; aylık üç sürüm hattı bizim ölçeğimizde saçma olur |
| **Metabase** | `docs/installation-and-operation/upgrading-metabase.md` | Migration'ı **açılışta otomatik** uygulaması bizim runner tasarımımızla aynı (`SCHEMA-VERTEILUNG.md` §4.2). "`latest` kullanma, sürümü sabitle" uyarısı bize doğrudan geçer |
| **Zammad** | `docs.zammad.org` → Updating Zammad, Backup & Restore | **Alman pazarı, KOBİ müşteri profili** — bize en yakın müşteri kitlesi. Yedek script'i ürünle birlikte geliyor; "eski sürüme geri yükleme mümkün değil" sınırını açıkça yazıyorlar |
| **Discourse** | `docs/INSTALL-cloud.md` | Terminal görmeyen kullanıcı hedefi ve **kurulum ön-kontrolleri** (port, DNS, RAM, swap) bizim Faz 2.1'imizin aynısı. Panelden tek tık yükseltme + yeni sürüm e-postası |
| **Supabase self-host** | `guides/self-hosting/docker`, `/updating`, `docker/upgrades.json` | **Zaten bizim tabanımız.** Kırıcı değişiklikleri makine-okunur bir manifestte tutmaları (`upgrades.json`) bu belgenin en somut devşirmesi |

**Genel bulgu:** altısında da ortak olan üç şey var — (1) yükseltmeden önce yedek,
(2) sürümü sabitleme (`latest` yasak), (3) kırıcı değişikliğin **ilan edilmiş** olması.
Ayrıştıkları yer: **kimin yükselttiği.** Beşinde de yükseltmeyi müşterinin admin'i
başlatıyor. Bizde admin yok — bizde podolog var. Bu tek fark, aşağıdaki kararların
çoğunu belirliyor.

---

## 2. Sürüm numaralandırma ve kanallar

### 2.1 Sektör pratiği

| Ürün | Şema | Ritim | Not |
|---|---|---|---|
| Sentry | **CalVer** `25.7.0` | Ayın **15'i**, aylık | Kendi belgesindeki uyarı aynen şu: *"CalVer is optimized for continuous deployment, not long-term stability."* Eski sürüme yama **yok** |
| GitLab | `MAJOR.MINOR.PATCH` | Aylık minor + ayda iki patch | Bakımdaki sürümler: güncel minor (hata+güvenlik) + önceki **iki** minor (yalnız güvenlik) |
| Metabase | major/minor ayrımı | düzensiz | Docker imajında **`latest` kullanmayın, tag sabitleyin** diyor |
| Zammad | major.minor | düzensiz | **Major atlanamaz**: 2.4 → 3.0 → 4.0 → 5.0 → 5.1 |
| Supabase self-host | `self-hosted/vX.Y.Z` | ayda bir "birlikte test edilmiş" yığın anlık görüntüsü | Servislerin tag'ini tek tek değiştirebilirsin ama **uyumluluk garanti edilmez** |

Devşirilecek olan: **sürüm numarası bir söz vermelidir.** CalVer hiçbir şey vaat etmiyor
(Sentry bunu dürüstçe yazıyor). SemVer "public API" vaat ediyor — bizim public API'miz yok,
o yüzden saf SemVer de yanlış çeviri olur.

### 2.2 Bizim kararımız

**Şema: `MAJOR.MINOR.PATCH`. Sayının anlamı bizde farklı tanımlanır ve tanımı budur:**

| Basamak | Ne demek | Migration | Örnek |
|---|---|---|---|
| **PATCH** (`1.4.2` → `1.4.3`) | Yalnız kod düzeltmesi. Şema **değişmez** | ⛔ **yasak** | Hesaplama hatası, UI kırığı, güvenlik yaması |
| **MINOR** (`1.4.x` → `1.5.0`) | Normal aylık yayın. Yeni özellik, yeni kolon/tablo/RPC olabilir | ✅ serbest (ileri-yönlü, §4) | Yeni Diagnosegruppe alanı, yeni ekran |
| **MAJOR** (`1.x` → `2.0.0`) | Kutuda **elle** ya da otomatik ön-adım gerektiren sürüm; ya da atlanamayan durak | ✅ + ön-adım | Postgres majör yükseltmesi, veri modeli kırılması |

**"Kırıcı değişiklik" bizim için ne demek — üç ölçüt, hepsi müşterinin gördüğü şeyle ölçülür:**

1. **Şema kırıcı:** bir önceki `:stable` sürümünün kodu yeni şemada çalışmaz
   (kolon silme/yeniden adlandırma). → Zaten yasak, iki adıma bölünür
   (`SCHEMA-VERTEILUNG.md` §6.1 Kural 2). Bu kural sayesinde **bu sınıf hiç MAJOR üretmez.**
2. **Kurulum kırıcı:** yeni bir zorunlu env var, yeni bir servis, değişen port, değişen
   varsayılan. Kutuda `.env` müşterinin elinde; biz onu **uzaktan dolduramayız** (K10).
   → MAJOR, ve `releases.json`'da `gerekli_adimlar` ile ilan edilir.
3. **Davranış kırıcı:** müşterinin bildiği bir akış kayboluyor/değişiyor
   (örn. bir modül lisans kapsamından çıkıyor, bir rapor formatı değişiyor).
   → En az MINOR + panelde sürüm notu + §302 tarafını ilgilendiriyorsa `gkv-302`'ye sorulur.

> **Kritik alt kural — PATCH migration içeremez.** Bu tek satır, geri-alma hikâyesinin
> tamamını taşıyor: bir PATCH bozuksa çözüm "eski digest'e geri sabitle"dir, veri
> kaybı yok, yedek gerekmez, dakikalar sürer. Bir düzeltme migration istiyorsa o
> düzeltme PATCH değildir, MINOR'dur — ve MINOR'un ağır makinesini (yedek, soak)
> hak eder. Sentry'nin "biz eski sürüme yama yapmıyoruz" pratiğinin bize uyan hâli budur.

**Neden CalVer değil:** CalVer bize ay bilgisi veriyor, **risk bilgisi vermiyor.** Bizim
kutuda karar veren kişi bir podolog; ona lazım olan "bu güncelleme bende bir şey değiştirir
mi" cevabı. `1.5.0` ile `1.4.3` arasındaki fark bu soruyu cevaplıyor, `26.09.0` cevaplamıyor.

**Neden saf SemVer de değil:** SemVer'in MAJOR'u "API sözleşmesi kırıldı" der; bizim
sözleşmemiz API değil, **kutunun kendi kendine yükselebilmesi**. Bu yüzden MAJOR'u yeniden
tanımladık: *"kutu bunu kendi başına atlayamaz"*. Tanım yukarıda yazılı, tahmine bırakılmadı.

### 2.3 Kanallar ve etiketler (K11'in somut hâli)

Bugün `publish-calendar-api.yml:64-65` iki etiket basıyor: `latest` ve kısa sha
(`type=sha,prefix=,format=short`). Yani **digest'e sabitleme imkânı bugün bile var** —
kullanılmıyor, ama var. Hedef düzen:

| Etiket | Kim izler | Ne zaman hareket eder |
|---|---|---|
| `X.Y.Z` (örn. `1.5.0`) | kimse doğrudan | **Değişmez.** Bir kez basılır, bir daha üstüne yazılmaz |
| `sha-<kısa>` | kimse doğrudan | Bugün de basılıyor; olay anında "hangi commit canlıydı" cevabı |
| `:beta` | **yalnız bizim sponsor kutularımız** (K12) + staging | Her `main` push'unda |
| `:stable` | **ücretli müşteri kutuları** | Yayın + 72 saat soak sonrası, elle taşınır (§3.4) |
| ~~`:latest`~~ | — | **Kullanılmaz.** Metabase'in uyarısının aynısı: kutu neyi çalıştırdığını bilmeli |

⛔ **Kural:** `:beta` ve `:stable` **hareketli** etiketlerdir; `X.Y.Z` ve digest
**değişmezdir.** Bir kutunun panelinde her zaman ikisi birden görünür:
`Sürüm 1.5.0 (stable) · Şema 0042 · Image sha256:ab12…`. Destek çağrısının ilk üç satırı
bu (§7).

> **G7 kontrolü:** kanal ayrımı **tek codebase** üzerinden yürüyor — aynı `main`, aynı
> Dockerfile, aynı runner. Fark yalnız hangi etiketin hangi digest'i gösterdiğidir. Fork yok.

---

## 3. Yükseltme yolu ve destek penceresi

### 3.1 Sektör pratiği

- **Sentry — "Hard Stops".** Belgesindeki liste aynen: `9.1.2 · 21.5.0 · 21.6.3 · 23.6.2 ·
  23.11.0 · 24.8.0 · 25.5.1 · 26.5.0 · 26.7.0`. Gerekçe: *"one must upgrade to each hard stop
  to pick up significant database changes."* Ayrıca **"upgrade edilmemesi gereken sürümler"**
  listesi tutuyorlar (`23.7.0`, `25.6.0`, `25.6.1`, `25.9.0`, `25.12.0`, `26.3.0`, `26.4.0` —
  çoğu migration hatası). Yani: yayınlanmış ama bozuk sürümler var ve müşteri onları
  **kendi okuyup** atlamak zorunda.
- **GitLab — "Required upgrade stops".** 17.5'ten beri duraklar **öngörülebilir yerlerde**:
  `x.2`, `x.5`, `x.8`, `x.11`. Bakım penceresi: güncel minor (hata+güvenlik) + iki önceki
  (yalnız güvenlik) — yani pratikte **~3 ay**. Ayrıca müşteri için bir "Upgrade Path" hesap
  aracı yayınlıyorlar; yol elle hesaplanamayacak kadar karmaşık olduğu için.
- **Zammad — major atlanamaz.** `2.4 → 3.0 → 4.0 → 5.0 → 5.1`.
- **Metabase — v40 altındaysan sürüm sürüm çık**, v40'tan sonra doğrudan güncele atla.
- **Supabase — `upgrades.json`.** Kırıcı sürümler makine-okunur bir manifestte:
  `breaking` (onay iste), `gate` (önce şu script), `requires[]` (kullanıcıya gösterilecek
  adımlar), `migration_guide_url`. `update.sh` **hiçbir dosyaya dokunmadan önce** aradaki
  sürümlerin kayıtlarını okuyup onay istiyor.

### 3.2 Bize uyan ve uymayan kısım

**Uymayan:** Sentry ve GitLab'ın duraklarının sebebi, migration'larının **arka plan
işlerine ve uygulama koduna** bağımlı olması (GitLab bunu açıkça "allow the background
migrations to finish" diye yazıyor). Durak, aslında "şu sürümün kodu şu veriyi dönüştürmek
zorunda" demek. Bizde 20 kutu var, her birinde gece yarısı, kimse başında değil —
**bu sınıf hatayı yönetemeyiz, ondan kaçınmalıyız.**

**Uyan:** Supabase'in manifest fikri. Durağı ilan etmek için bir yer olmalı — olmazsa
gerektiğinde uydurulur.

### 3.3 ★ Kural: migration yalnız SQL'e dayanır

> **Bir migration, çalışması için aradaki bir sürümün uygulama koduna bağımlı olamaz.**
> Veri dönüşümü gerekiyorsa ya migration'ın kendi SQL'i içinde yapılır, ya da
> **idempotent bir açılış görevi** olarak yazılır ve o görev sonraki sürümlerde de
> çalışmaya devam eder.

Bu tek kural, Sentry ve GitLab'ın "hard stop" sınıfını **bizde tümden ortadan kaldırır.**
Sebep basit ve `SCHEMA-VERTEILUNG.md` §4.1'de zaten var: migration dosyaları **image'ın
içinde** gelir. `0005`'te duran bir kutu, `0000..0042` içeren bir image aldığında runner
`0006`'dan `0042`'ye kadar sırayla uygular. Aradaki hiçbir sürümün kodu çalışmamış olsa
bile sonuç aynıdır — çünkü hiçbir migration o koda bakmıyor.

Bedeli: bir kolonu doldurmak için JavaScript yazmak isteyen geliştirici (yani biz) bunu
SQL'e çevirmek ya da idempotent bir açılış görevi yazmak zorunda. Kazancı: **kutuyu ne
kadar geriden gelirse gelsin tek adımda yükseltebilmek.** Tek kişilik ekipte bu takas
tartışmasız.

### 3.4 Bizim kararımız — yükseltme yolu

**Kural 1 — MINOR atlamak serbesttir.** `1.2.0`'daki bir kutu doğrudan `1.9.0`'a çıkabilir.
Runner aradaki tüm migration'ları sırayla uygular (`SCHEMA-VERTEILUNG.md` §4).

**Kural 2 — durak (Pflichtstation) ancak ilan edilirse vardır.** Duraklar
`onprem/releases.json` dosyasında, image'ın içinde taşınır. Şeması (Supabase'inkinin bize
uyarlanmış hâli):

| Alan | Anlamı |
|---|---|
| `sürüm` | `1.5.0` — anahtar |
| `durak` | `true` ise: bu sürümden **önceki** bir kutu, doğrudan sonrasına geçemez |
| `otomatik_adim` | Kutunun kendi çalıştıracağı ön-script (varsa). **Müşteri terminal görmez** — bu, Supabase'in `gate` alanının bizde otomatikleşmiş hâli |
| `elle_adim[]` | Müşteriye panelde gösterilecek metin (DE). Boş olmalı; dolu olması bir tasarım hatasının itirafıdır |
| `not_url` | Sürüm notu — kutu offline olabilir, metin de dosyada bulunur |

**Kural 3 — durak listesi boş kalmalı.** §3.3 sayesinde teknik olarak mümkün. Bir durak
ilan etmek zorunda kalıyorsak bu, tasarımın bir yerde kaydığının işaretidir; ilan etmeden
önce `onprem` ajanına ön kontrol (`§3` tanım) sorulur.

**Kural 4 — runner atlamayı reddeder.** Kutu `0005`'te, image'ın manifestinde arada
`durak: true` bir sürüm varsa runner **durur** ve panelde şunu yazar: *"Bu kurulum önce
`1.5.0` sürümüne geçmelidir."* Sessizce devam etmek yasak — `SCHEMA-VERTEILUNG.md` §6.3'ün
"defterde bilmediğim kayıt var" kontrolüyle aynı refleks.

### 3.5 Destek penceresi — iki ayrı kavram, karıştırılmaz

Bu ayrım yazılmazsa AGB metni yanlış yazılır:

| Kavram | Ne | Bizim değerimiz |
|---|---|---|
| **Güvenlik destek süresi** (CRA Art. 13, `LEGAL_ONPREM_REQUIREMENTS.md` §6/E8) | Ürünün piyasada olduğu süre boyunca açık kapatma taahhüdü | ⚠️ **Rakam hukukçunun** — CRA'nın beklentisi ürün ömrü, tipik olarak 5 yıl. AGB'ye yazılacak sayı `legal-de`'ye sorulur; teknik taraf bunu kısıtlamaz |
| **Yükseltme penceresi** | Hangi sürümden **doğrudan** güncele çıkılabilir | **Sınırsız** (durak yoksa, §3.4). GitLab'ın 3 aylık penceresi bize gerekmez, çünkü yükselten müşteri değil kutu |
| **Yamalanan sürüm** | Hangi sürüme geriye dönük düzeltme basarız | **Yalnız güncel `:stable`.** Sentry'nin pratiği: eski sürüme yama yok. Kutular otomatik güncellendiği için geriye yama ihtiyacı doğmaz |

### 3.6 Altı ay kapalı kalmış kutu — senaryo

Bu senaryo normalde **oluşmaz**: Watchtower gecelik çeker (§6.4). Oluştuğu tek gerçek yol
Faz 3'te yazılı: **lisans pasifken registry pull-credential'ı iptal edilir** (Faz 3.4), yani
ödemesi kesilmiş kutu güncelleme çekemez. Ödeme dönünce ne olur:

1. Lisans yenilenir → pull-credential geri verilir.
2. Watchtower bir sonraki turda `:stable`'ı çeker — arada 6 MINOR olabilir.
3. Runner **göç-öncesi yedeği alır** (§4.3), sonra `0031..0042`'yi sırayla uygular.
4. Durak yoksa (§3.4 Kural 3) kutu açılır. Durak varsa runner durur ve panelde adı yazılır.
5. Panelde ne olduğu yazılır: *"Yazılım 1.3.0'dan 1.9.0'a güncellendi, 12 veritabanı
   değişikliği uygulandı, güncelleme öncesi yedek alındı."* — müşteri sabah gelip ekranın
   değiştiğini görmemeli; **ne olduğunu okumalı.**

⚠️ **Bu senaryonun asıl riski teknik değil:** ödeme kesintisi + salt-okunur mod (K9) +
büyük atlama aynı güne denk gelir. Yani kutu **tam da müşterinin sinirli olduğu gün**
uzun bir güncelleme yapar. Bu yüzden §4.3'teki "yedek alınamıyorsa migration çalışmaz"
kuralı burada en çok işe yarar: en kötü ihtimalle kutu eski şemasıyla salt-okunur çalışır,
veri hiç kaybolmaz.

---

## 4. Yükseltme güvenliği

### 4.1 Sektör pratiği

- **Metabase:** yükseltme adımlarının **1. maddesi** yedek. Sonra imajı değiştir; migration
  **açılışta otomatik** uygulanır.
- **Zammad:** yedek, adım 3 — durdur, yedekle, güncelle. Ayrıca üç sınırı açıkça yazıyor:
  yedek **tam dump**'tır (artımlı yok), **eski sürüme geri yükleme mümkün değildir**, ve
  **sistem ayarları (env değişkenleri) yedeğe girmez**.
- **Supabase:** `update.sh` yapılandırma dosyalarını yedekliyor ama **kutunun içindeki
  Postgres ve Storage verisini yedeklemiyor** ve bunu tehlike kutusuyla yazıyor:
  *"Back those up separately first."*
- **Sentry:** geri yüklemeyi *"same version, on a fresh install (empty database but
  migrations are run)"* şartına bağlıyor; aksi hâlde *"you may corrupt your database."*

### 4.2 Bize uyan ve uymayan kısım

**Uymayan:** hepsinde yedeği **insan** alıyor. Bizde alacak insan yok. "Yedeğinizi almayı
unutmayın" cümlesi 20 podoloji praxis'inde ortalama sıfır kez okunur. Uyarı, kontrol değildir.

**Uyan:** Zammad'ın üç sınırı bizim de sınırlarımız ve **aynı dürüstlükle yazılmalı** —
özellikle "env yedeğe girmez", çünkü bizde o env `DATA_ENCRYPTION_KEY`'i taşıyor (O-29).
Zammad'da bunun bedeli bir ayarı yeniden girmek; bizde bedeli **hasta dokümantasyonunun
şifreli kısmının kalıcı kaybı.** Aynı sınır, farklı ağırlık — bu yüzden bizde uyarı
yetmez, kontrol gerekir.

### 4.3 Yedek-önce kuralı (Faz 2.3 ile birleşik)

> **Bekleyen migration varsa, uygulanmadan önce kutu bir yedek seti alır. Yedek
> alınamıyorsa migration çalışmaz.**

Açılış sırası (`SCHEMA-VERTEILUNG.md` §4.2'deki runner akışının tamamlanmış hâli):

1. api container kalkar, `app.listen()` **henüz çağrılmaz**.
2. Runner advisory-lock alır, `praxura_migrations` defterini okur.
3. **Bekleyen migration yoksa** → doğrudan `listen`. (Normal gün: PATCH güncellemeleri
   buradan geçer, hiç yedek alınmaz, gecikme yok.)
4. **Bekleyen migration varsa:**
   1. Yer kontrolü: boş disk `2 × (db_boyutu + storage_boyutu)`'ndan azsa **dur**,
      bakım moduna geç, panelde sebebi yaz. (Disk dolu bir sunucuda migration denemek,
      yarım kalmış bir veritabanı üretmenin en kısa yoludur.)
   2. **Yedek seti:** `pg_dump` + storage arşivi + `backup.meta.json` künyesi (§4.4),
      ad: `vor-1.5.0-<tarih>`. Faz 2.3'ün gecelik yedeğiyle **aynı kod**, farklı tetikleyici.
   3. Yedek başarısızsa → **dur**, bakım modu, panelde sebep. Migration **çalışmaz**,
      veritabanına dokunulmaz. (Bu durumda kutu yeni kodla açılmaz; ama veri sağlamdır
      ve §4.6'daki geri alma temizdir.)
   4. Yedek başarılıysa → migration'lar sırayla, dosya başına tek transaction.
   5. Hata → o dosyada dur, defteri bozma, bakım modu, panelde **dosya adı + SQLSTATE**.
5. Hepsi geçtiyse → self-check sayaçları (§5.4) → `listen`.

**Saklama:** göç-öncesi yedekler normal rotasyondan (14 gün + 12 ay) **ayrı** tutulur;
en az **son 3 tanesi** her koşulda saklanır. Sebebi: bir migration'ın sonucunun yanlış
olduğu üçüncü günde anlaşılır, ikinci gecenin rotasyonu onu çoktan silmiş olur.

**Hedef:** yedeğin varsayılan hedefi **kutunun dışı** (Hetzner Storage Box, Faz 2.2
sihirbaz adımı). Lokal dizin seçilirse sihirbaz uyarır ve panelde kalıcı bir rozet durur:
*"Yedekleriniz veritabanıyla aynı diskte — disk arızasında ikisi birden kaybolur."*
Bu uyarı satılabilir bir şey değil ama yazılmazsa bir gün pahalıya patlar.

### 4.4 Yedek künyesi (`backup.meta.json`)

`SCHEMA-VERTEILUNG.md` §7.1'de tarif edilmişti; burada alanları kilitleniyor.

| Alan | Niye |
|---|---|
| `schema_version` | Hangi migration'a kadar (defterden) |
| `app_version` + `image_digest` | Hangi sürüm aldı |
| `taken_at` · `dump_bytes` · `storage_bytes` | Arşivi açmadan sağlık kontrolü |
| `data_key_fingerprint` | Anahtarın **kendisi değil**, ondan türeyen HMAC. O-29'un çözümü |
| `sebep` | `nightly` / `vor-migration` / `manuell` |

Yedek seti **anahtarın kendisini içermez** (G2). Künye yalnız parmak izini taşır.

### 4.5 O-29 burada kapanıyor — `DATA_ENCRYPTION_KEY` disiplini

Sicildeki O-29 ("anahtar kaybolursa şifreli hasta alanları kalıcı okunamaz") bu belgede
**dört somut kurala** bağlanıyor; ikisi kurulumun, ikisi geri yüklemenin işi:

1. **Üretim (Faz 2.1):** `install.sh` her kutu için rastgele üretir. Ortak anahtar yasak.
2. **Teslim (Faz 2.2):** sihirbaz anahtarı **bir kez** gösterir, yazdırma/kopyalama
   butonuyla; "sakladım" onayı alınmadan sihirbaz ilerlemez. Bizde kopyası **yoktur ve
   olmayacaktır** (K10). Metin bunu da söyler — müşteri "kaybedersem sizden isterim"
   sanmamalı.
3. **Sürekli kontrol (Faz 2.4):** her gecelik yedekte künyeye parmak izi yazılır; panelde
   *"Şifreleme anahtarınız `a4f1…` — yedeklerinizle uyumlu"* rozeti durur. Anahtar
   değişmişse rozet **o gece** kırmızıya döner, altı ay sonra değil.
4. **Geri yükleme (Faz 2.3):** `restore.sh` künyedeki parmak izini mevcut `.env`'deki
   anahtarla karşılaştırır. **Uyuşmuyorsa veriye dokunmadan durur** ve şunu yazar:
   *"Bu yedek başka bir şifreleme anahtarıyla alındı. Geri yükleme yapılırsa reçete
   taramaları ve şifreli tanı alanları okunamaz. Doğru anahtar olmadan devam etmeyin."*
   Zorla devam seçeneği vardır (müşterinin verisi, müşterinin kararı) ama **açık onayla**.

> **Sicil durumu:** O-29 `offen` → `geplant` (Faz 2.1 + 2.2 + 2.3). Gereksinim artık
> yazılı; `gelöst` olması için dördü de uygulanıp commit numarasının sicile geçmesi gerekir.

### 4.6 Geri alma (rollback) hikâyesi — dürüst hâli

Sektörde geri alma hikâyesi zayıf: Zammad "eski sürüme geri yükleme mümkün değil" diyor,
Sentry "aynı sürüm + boş DB" şartı koyuyor, GitLab ayrı bir geri-alma sayfası tutuyor ama
ön koşulu yine yedek. **Kimse "tek tık geri al" vaat etmiyor. Biz de etmeyeceğiz.**
Bizim üç durumumuz:

| Durum | Geri alma | Süre |
|---|---|---|
| **PATCH bozuk** (migration yok, §2.2) | Eski `X.Y.Z` digest'ine geri sabitle. Veri el değmemiş | dakikalar |
| **MINOR bozuk, migration geçti** | Yalnız göç-öncesi yedekten (§4.3). Yedek geri yüklenir, image eski digest'e sabitlenir | ~30 dk; veri kaybı = yedekten sonraki iş |
| **MINOR bozuk, migration hata verdi** | Hiçbir şey uygulanmadı (dosya başına transaction) → yalnız image geri sabitlenir | dakikalar |

**Bu tablo satış metnine ve AGB'ye aynen girer.** "Her şey geri alınabilir" demek, ikinci
satırda müşteriye yalan söylemek olur.

**Kim geri sabitler:** K10 gereği kutuya giremiyoruz. Yani geri alma iki yoldan biriyle
olur ve ikisi de **bugün tasarımda yok** (§11.2 kararı):
(a) `:stable` etiketini merkezde eski digest'e geri taşırız → kutular bir sonraki Watchtower
turunda eski sürüme döner (şema ileri gittiyse bu **çalışmaz**, runner durur);
(b) bakım modu sayfasında "önceki sürüme dön" düğmesi — son-iyi digest'i saklayan küçük bir
yardımcı gerektirir.
**Öneri: (a) + PATCH kuralı.** (b)'nin karmaşıklığı tek kişilik ekipte kendini ödemez;
PATCH'lerin migration'sız olması (a)'yı vakaların çoğunda yeterli kılar.

### 4.7 Expand/contract'ın sürüm politikasındaki karşılığı

`SCHEMA-VERTEILUNG.md` §6.1 iki adımlı silmeyi zaten kural yapmıştı. Sürüm politikasındaki
karşılığı tek cümledir:

> **Bir sürümde yalnız `expand` (ekle) yapılır; `contract` (sil/daralt) en erken bir
> sonraki MINOR'da yapılır** ve o migration'ın başına `-- ZWEISTUFIG: <ilk adım no> · <gerekçe>`
> satırı yazılır (kapı bunu arıyor, `SCHEMA-VERTEILUNG.md` §6.2).

Pratik takvim: `1.5.0` kolonu ekler ve çift yazar → `1.6.0` eski kolonu okumayı bırakır →
`1.7.0` kolonu düşürür. **En az iki MINOR arayla.** Sebep: bir kutu `1.5.0`'da takılı
kalmışsa (lisans pasif, §3.6) `1.7.0`'a çıkarken arada `1.6.0`'ın kodu hiç çalışmamış olur.
§3.3 kuralı sayesinde bu sorun değil — ama contract'ı erkene almak o güvenceyi bozar.
---

## 5. Kurulum kalite çıtası

Faz 2.1 (`install.sh`), 2.2 (sihirbaz) ve 2.4 (healthcheck) zaten planda var. Bu bölüm
onların yerini almaz — **kabul ölçütünü** verir: *kurulum ne zaman "başarılı" sayılır.*

### 5.1 Sektör pratiği

- **Discourse** (bize en yakın kullanıcı profili — terminal görmeyen forum sahibi):
  kurulum sihirbazı **ön-kontrolleri kendisi yapıyor** — public IP tespiti, **80/443
  portlarının boş olduğunun doğrulanması**, **DNS'in bu sunucuya çözümlendiğinin
  doğrulanması**, az bellekli sunucuda **swap oluşturma teklifi**, donanıma göre worker
  sayısı ayarı. Ayrıca SMTP'yi **atlanabilir** yapmışlar — kurulum e-posta yüzünden
  tıkanmasın diye.
- **Sentry:** `install.sh` tek giriş noktası; asgari donanım belgede net
  (4 çekirdek / 16 GB RAM + 16 GB swap / 20 GB disk) ve *"iowait > CPU zamanının %10'u
  muhtemelen sisteminizin yükü kaldıramadığını gösterir"* gibi **ölçülebilir** eşikler
  veriyorlar. Dağıtım uyumluluğunu tek tek yazmışlar (Debian/Ubuntu tercih, RHEL sorunlu,
  Alpine desteklenmiyor).
- **Supabase:** kurulumdan sonra sürümü `.supabase-version` dosyasına yazıyorlar; sonraki
  `update.sh` bu dosya olmadan **güvenli birleştirme yapamıyor** ve sınırlı rapor moduna
  düşüyor. Yani: **kurulumun kendisi bir kayıt bırakmak zorunda.**

### 5.2 Bize uyan ve uymayan kısım

**Uyan:** Discourse'un ön-kontrol listesi neredeyse birebir bizim listemiz; DNS ve port
kontrolü Let's Encrypt yüzünden bizde daha da kritik (§5.3). Supabase'in "kurulum kayıt
bırakır" prensibi bizde zaten var: `praxura_migrations` defteri + `0000_baseline`
(`SCHEMA-VERTEILUNG.md` §4.5) — ayrı bir sürüm dosyası tutmamıza gerek yok.

**Uymayan:** Sentry'nin donanım eşikleri bizim ölçeğimizin çok üstünde (onlarda ClickHouse,
Kafka, Snuba var). Playbook §4.1'deki **2 vCPU / 4 GB / 40 GB** geçerli kalır — ama artık
bir şey ekliyoruz: **disk eşiği yedeği de kapsamalı** (§4.3 yer kontrolü), yani 40 GB
"veri + yedek" için değil, yalnız "veri" için asgari.

### 5.3 Kurulum ön-kontrolü (`install.sh`, Faz 2.1)

Sıra önemli: **hiçbir şey kurulmadan önce** çalışır, bir madde kırmızıysa açıklayıp durur.

| # | Kontrol | Kırmızıysa ne denir |
|---|---|---|
| 1 | CPU çekirdek ≥ 2 · RAM ≥ 4 GB · boş disk ≥ 40 GB | Somut sayı ve önerilen Hetzner tipi |
| 2 | Docker ≥ sürüm X + `docker compose` v2 var mı | Kurulum komutu gösterilir (ya da otomatik kurar) |
| 3 | **80 ve 443 boş mu** | "Bu sunucuda başka bir web sunucusu çalışıyor" — Caddy sessizce başlamaz |
| 4 | **DNS bu sunucuya çözümleniyor mu** | Let's Encrypt DNS'siz sertifika vermez; A-kaydı beklenir |
| 5 | Sunucu **AB'de mi** (sağlayıcı/bölge tespiti + kullanıcı onayı) | DSGVO gereği; Yol B'de ("zaten sunucum var") özellikle |
| 6 | Saat senkronu (NTP) çalışıyor mu, sapma < 60 sn | Lisans `valid_until` kontrolü ve zamanlanmış işler (O-22/O-23) saate bağlı |
| 7 | Giden 443 erişimi var mı (registry + lisans sunucusu) | Tamamen kapalı ağ desteklenmiyor — §6.6'daki hava boşluğu notu |
| 8 | Aynı dizinde önceki kurulum var mı | Varsa **üzerine yazmaz**, "devam et / sıfırdan kur" sorar (§5.5) |

⚠️ **Let's Encrypt oran sınırı — kurulum otomasyonunun gizli tuzağı.** Bütün müşteri
kutuları tek bir kayıtlı alan adının alt alanlarını kullanacak (`praxisadi.praxura.app`,
playbook §4.3). Let's Encrypt oran sınırları **kayıtlı alan adı başına** işler. Faz 4
provisioner'ı test sırasında aynı alt alanı defalarca kurup silerse üretim kurulumları
bloke olabilir. Faz 4.5'e not: sertifika oran sınırı hesabı yapılmalı, testlerde LE
**staging** ortamı kullanılmalı. (`doğrulanmalı`: güncel LE sınır değerleri Faz 4'te
kaynağından okunacak — bu belge sayı vermiyor, çünkü sayı değişiyor.)

### 5.4 Kabul ölçütü — "kurulum başarılı sayılır ancak şu 14 kontrol yeşilse"

`SCHEMA-VERTEILUNG.md` §3.3 zaten **on şema sayacı** tanımlıyor (tablo/policy/fonksiyon/
trigger/bucket/publication/extension/seed satırları vb.). Burada tanımlanan, onların
üstündeki **kurulum düzeyi** kontrolüdür. Kurulum sonrası self-check bu 14'ü sırayla
çalıştırır; hepsi yeşil değilse sihirbaz "hazır" demez, kutu **kurulum modunda kalır**.

| # | Kontrol | Ölçüt |
|---|---|---|
| 1 | Şema sayaçları | `SCHEMA-VERTEILUNG.md` §3.3'teki **10 sayacın 10'u** beklenen değerde |
| 2 | Migration defteri | `praxura_migrations` son kaydı = image'ın en yüksek dosyası |
| 3 | Auth | Sihirbazda oluşturulan yönetici hesabıyla **gerçek giriş** yapıldı, JWT döndü |
| 4 | `handle_new_user` | Test kaydı `profiles` satırı üretti, sonra geri alındı (PoC'nin ısırdığı yer) |
| 5 | RLS | İkinci bir kullanıcı birincinin randevusunu **göremiyor** (tek satırlık negatif test) |
| 6 | Realtime | `bookings` aboneliği bir olay aldı |
| 7 | Storage | 5 bucket var, private bucket'a yazma + signed-URL ile okuma çalıştı |
| 8 | Şifreleme | `DATA_ENCRYPTION_KEY` ile yaz-oku turu başarılı; parmak izi panelde görünüyor (§4.5) |
| 9 | SMTP | "Test maili gönder" başarılı **ya da** müşteri bilinçli olarak atladı (Discourse deseni) |
| 10 | TLS | `https://<alan>` geçerli sertifikayla 200 döndü (kendinden imzalı değil) |
| 11 | Yedek | **Bir kez gerçekten yedek alındı** ve künyesi yazıldı — kurulum bittiğinde elde bir yedek var |
| 12 | Zamanlanmış işler | Zamanlayıcılar kayıtlı, bir sonraki çalışma zamanı panelde görünüyor (O-22/O-23) |
| 13 | Dış çağrı yok | Kutu, kendi domain'i dışında **hiçbir** hosta çıkmıyor — lisans sunucusu ve (varsa) müşterinin AI sağlayıcısı hariç. Bu, "veriniz sizde" iddiasının **ölçülmüş** hâli |
| 14 | Sürüm künyesi | Panel `Sürüm X.Y.Z · Şema NNNN · digest` üçlüsünü gösteriyor |

> **13. maddeyi hafife alma.** `vendor/README.md` bunun hukuki tarafını zaten yazmıştı
> (UWG §5 / §434 BGB). Kurulum sonrası bu kontrolü **ölçerek** yapmak, on-prem satış
> vaadinin tek kanıtıdır. Ölçüm yolu: kurulum sırasında container'ların giden bağlantıları
> kaydedilir (ya da basitçe `tools/check-onprem.sh` kapı sayaçlarının kutu içi karşılığı
> çalıştırılır) ve panelde liste olarak gösterilir.

### 5.5 Idempotanlık — yarım kalan kurulum

Discourse ve Sentry'nin `install.sh`'i yeniden çalıştırılabilir; bizimki de olmalı, çünkü
kurulum en çok **ağ hatasında** yarım kalır (image çekilirken kopan bağlantı).

Üç kural:

1. **Üretilen sırlar bir kez üretilir.** `.env` varsa ve içinde `JWT_SECRET` /
   `DATA_ENCRYPTION_KEY` doluysa **üzerine yazılmaz.** Yeniden üretmek, var olan veriyi
   okunamaz hâle getirmenin en hızlı yoludur (O-28 + O-29).
2. **Şema tarafı zaten idempotent** — runner defterine bakar, uygulanmışı tekrar uygulamaz
   (`SCHEMA-VERTEILUNG.md` §4.5). Kurulum script'inin şemayla ilgili özel bir işi yok.
3. **"Sıfırdan kur" ayrı ve tehlikeli bir yoldur.** Var olan veriyi silecekse
   `install.sh --neu` gibi ayrı bir bayrak ve yazılı onay ister; varsayılan asla değildir.

### 5.6 Kurulum modu — sihirbaz bitene kadar

Playbook 2.2 zaten "sihirbaz tamamlanana kadar uygulama kurulum modunda kalır" diyor.
Buraya iki şart ekleniyor:

- **Kurulum modu dışarıya kapalıdır:** sihirbaz tamamlanmadan public booking sayfaları
  (`booking.html`, `booking-request.html`) yayında olmamalı. Yarım kurulmuş bir praxis'in
  randevu sayfası internette açık durmamalı.
- **Kurulum modu ile bakım modu aynı mekanizmadır** (§6.3): ikisi de "uygulama dinlemiyor,
  panelde sebep yazılı" hâlidir. Tek kod, iki sebep. Fork yok, ikinci bir durum makinesi yok.
---

## 6. Çalışırken stabilite

### 6.1 Sektör pratiği

- **Discourse:** yeni sürüm çıkınca **e-posta gönderiyor**, yükseltme panelden tek tık.
  Yani güncelleme kararı müşteride ama bilgi müşteriye **itiliyor**.
- **Sentry:** kutu, açıkça onay verilirse merkezle konuşan bir "beacon" çalıştırıyor —
  taşıdığı şey: kurulum kimliği, sürüm, isteğe bağlı teknik iletişim e-postası, kaba
  istatistik. Amaç: *"getting information about the current version"* ve *"retrieving
  important system notices"*. **Varsayılan davranış açıkça seçtiriliyor** (opt-in/opt-out).
- **Supabase self-host:** Docker Compose kurulumu **hiç telemetri göndermiyor** —
  belgede net: *"does not phone home or collect any telemetry."*
- **Metabase:** `latest` yerine belirli tag önerisi — yani "otomatik en yeniye atlama"yı
  üretimde tavsiye etmiyorlar.
- **Ortak:** hiçbiri ücretli self-hosted müşterisinin kutusuna **kendi kararıyla** yeni
  sürüm itmiyor.

### 6.2 Bize uyan ve uymayan kısım

**Uymayan — ve bilinçli olarak.** Biz otomatik güncellemeyi bırakamayız. Sebep teknik değil
düzenleyici: §302 fiyat ve Kostenträger verileri sürekli değişiyor (bkz. `preise-check.yml`,
O-34), güncel olmayan bir abrechnung yazılımı Almanya'da para kazandırmaz. 20 podoloji
praxis'inin panelden "Aktualisieren" tuşuna basmasını beklemek, altı ay sonra 20 farklı
sürümle uğraşmak demektir — tek kişilik ekipte bu ölümcül.

**Uyan:** Metabase'in "sabit tag" uyarısı ve Sentry'nin "varsayılanı açıkça seçtir"
disiplini. Bizim çözümümüz ikisinin birleşimi: **otomatik güncelleme kalır, ama kutu
hareketli bir etiketi değil, bizim taşıdığımız ve önce kendi kutularımızda pişirdiğimiz
bir etiketi izler** (§2.3 + §6.4).

### 6.3 En büyük risk: bozuk image 20 kutuya aynı anda gider

**Bu bir varsayım değil, yaşandı.** SaaS'ta `SUPABASE_SERVICE_KEY` (doğrusu
`SUPABASE_SERVICE_ROLE_KEY`) yazım hatası container'ı crash-loop'a soktu ve Watchtower
bozuk image'ı ~60 saniyede canlıya aldı (`CLAUDE.md`, O-28). SaaS'ta bunun bedeli bir
kişinin fark edip düzeltmesiydi. On-prem'de aynı olay **20 praxis'in aynı sabah
çalışmaması** demektir ve K10 gereği hiçbirine giremeyiz.

Bugünkü durumda bunu engelleyen **hiçbir şey yok.** Ölçülmüş gerçekler:

| Gerçek | Nerede | Sonucu |
|---|---|---|
| CI image'ı **hiç çalıştırmadan** yayınlıyor | `.github/workflows/publish-calendar-api.yml` — `test` job'u `npm test` koşuyor, sonra `build-and-push`. `docker run` yok | Boot'ta ölen bir image testleri geçer |
| Watchtower `--interval=60` | `api-backend/docker-compose.yml` | Bozuk image 60 sn'de canlı |
| `restart: unless-stopped` | aynı dosya | Crash-loop sonsuza kadar döner |
| `/health` **her zaman** yeşil | `api-backend/server.js:276` → `res.json({ status: 'ok' })` | Sağlık kapısı olarak kullanılamaz; DB ölse bile 200 döner |
| Compose dosyası kutuda, image'da değil | aynı dosyadaki 2026-08-15 notu: repo kopyası dört gün canlıda değildi | Compose'a yazdığımız hiçbir düzeltme otomatik gitmez |

**Dört katmanlı önlem** — hiçbiri tek başına yetmez, dördü birlikte yeter:

**Katman 1 — CI'da gerçek CMD ile smoke-test (en yüksek getirili tek adım).**
Publish'ten **önce** image build edilir, `docker run` ile **Dockerfile'ın kendi CMD'siyle**
başlatılır (`npx`/`npm run` ile **değil** — bu ders bir kez alındı: bare `pm2-runtime`
prod'da `MODULE_NOT_FOUND` verdi, `api-backend/Dockerfile:40` yorumunda yazılı), sahte ama
eksiksiz bir env verilir, `/health` 200 dönene kadar en fazla 60 sn beklenir. Dönmezse
**hiçbir etiket basılmaz.** `SUPABASE_SERVICE_KEY` olayı tam olarak burada yakalanırdı.

**Katman 2 — soak (72 saat) ve etiketin elle taşınması.** §2.3: `X.Y.Z` basılır, `:beta`
hareket eder; `:stable` **yalnız** staging + en az bir sponsor kutu 72 saat sorunsuz
çalıştıktan sonra taşınır. Sponsor kutular K12 gereği **bizim** makinelerimizdir — yani
bu soak müşteri verisine hiç dokunmadan yapılır, G1 temiz.

**Katman 3 — kutuda crash-loop yerine bakım modu.** Uygulama, yapılandırma/şema hatasında
`process.exit(1)` yapmaz (O-28 + `SCHEMA-VERTEILUNG.md` §4.4). Bunun yerine dinlemeye
başlar ama yalnız iki şey servis eder: bakım sayfası (sebep + sürüm + şema no) ve
`/health` (derin, §6.5). Fark kritik: crash-loop'ta müşteride **hiçbir bilgi yok**, bakım
modunda müşterinin ekranında bizim okuyabileceğimiz bir cümle var.

**Katman 4 — bir gecede bir sürüm.** Watchtower `:stable` kutularında **saatlik** çalışır
(60 sn değil). Risk kontrolü aralıkta değil **etikette**; ama saatlik aralık, kötü bir
sürümü geri çektiğimizde (§4.6a) düzeltmenin de bir saat içinde yayılmasını sağlar.

### 6.4 Watchtower ayarları — kutu için

| Ayar | SaaS bugün | On-prem kutu | Gerekçe |
|---|---|---|---|
| İzlenen etiket | `latest` | `:stable` (sponsor: `:beta`) | K11 |
| `--interval` | 60 | 3600 | §6.3 katman 4 |
| `--cleanup` | var | var | disk (§6.6) |
| `--label-enable` | var | var | yalnız api container'ı güncellenir |
| Supabase servisleri | — | **Watchtower kapsamı dışı** | Upstream'i biz sürüm sürüm seçeriz; Supabase'in kendi uyarısı: servis tag'lerini tek tek değiştirmek **uyumluluk garantisi vermez** |

⚠️ **Compose dosyası kutuda yaşar ve Watchtower ona dokunmaz.** 2026-08-15 dersinin
on-prem'deki karşılığı ağır: compose'a yazdığımız bir düzeltme **hiçbir müşteriye
ulaşmaz.** Sonuç kural: **compose'da davranış tutulmaz.** Port, label, healthcheck gibi
kaçınılmaz olanlar dışında her ayar image'ın içinde ya da `.env`'de olmalı; compose
mümkün olduğunca aptal ve değişmez kalmalı. Compose'un kendisi değişmek zorunda kalırsa
bu bir **MAJOR** sürümdür (§2.2 "kurulum kırıcı") ve `releases.json`'da ilan edilir.

### 6.5 Healthcheck — neyi kapsamalı

Bugünkü `/health` bir *liveness* kontrolü bile değil, sabit bir cevap. İkiye ayrılır:

**`/health` (liveness — Docker `HEALTHCHECK` bunu kullanır, ucuz, sık):**
süreç ayakta mı, event loop tıkalı mı. Tek DB sorgusu bile yapmaz.

**`/status` (derin — panel ve tanılama bunu kullanır, dakikada bir):**

| Alan | Yeşil ölçütü | Kırmızı olduğunda ne olur |
|---|---|---|
| `db` | `SELECT 1` < 500 ms | Bakım modu |
| `schema` | defter son kaydı = image'ın en yüksek dosyası | Bakım modu + dosya adı |
| `auth` | GoTrue sağlık ucu 200 | Panelde uyarı, giriş çalışmaz |
| `storage` | private bucket'a yaz-sil turu | Panelde uyarı |
| `disk` | boş yer > %15 **ve** > 2× (db+storage) | %85'te uyarı, %92'de yedek+migration durur |
| `backup` | son başarılı yedek < 36 saat | Panelde kalıcı kırmızı rozet |
| `data_key` | parmak izi son yedeğinkiyle aynı | Kırmızı rozet (§4.5) |
| `license` | durum + `valid_until` | Faz 3 durum makinesi |
| `zeit` | NTP sapması < 60 sn | Uyarı |
| `version` | `X.Y.Z` + digest + şema no | — (bilgi) |

`/status` **kimlik doğrulaması ister** (kutu sahibinin oturumu) — dışarıya sürüm ve şema
numarası sızdırmak gereksiz saldırı yüzeyi. `/health` anonim ve içeriksiz kalır.

### 6.6 Disk dolma senaryosu — yedek ve Postgres aynı diskte

Playbook §4.1'in tek makine tasarımında `db`, `storage` **ve** (lokal hedef seçilmişse)
yedek aynı diski paylaşır. Bu, bilinen ve sık görülen ölüm biçimidir: yedekler diski
doldurur, Postgres yazamaz, praxis durur, **ve yedekler de kurtarılamaz.**

Üç önlem, üçü de ucuz:

1. **Varsayılan hedef kutunun dışı** (§4.3). Lokal seçilirse panelde kalıcı uyarı.
2. **Kota:** yedek dizini için sabit üst sınır (örn. diskin %40'ı); rotasyon önce
   **en eski gecelik** yedeği siler, göç-öncesi yedeklerin son 3'üne asla dokunmaz.
3. **Eşikler `/status`'ta** (§6.5): %85 uyarı, %92'de yedek ve migration durur.
   Ayrıca Docker log rotasyonu (`max-size`/`max-file`) compose'da sabitlenir —
   sınırsız büyüyen `json-file` logu, disk dolmasının en sık sebeplerinden biri.

### 6.7 Çevrimdışı / kısıtlı ağ

Sentry'nin dürüst cevabı: hava boşluklu kurulum için `docker save` / `docker load` ile
image taşıma öneriyorlar, ama *"we don't provide any further help for this use case."*

**Bizim kararımız: tam hava boşluğu (air-gap) v1'de desteklenmiyor.** Gerekçe: lisans
yenileme (Faz 3), güncelleme çekme ve — müşteri isterse — AI çağrısı giden 443 gerektiriyor.
Bunu kurulum ön-kontrolü (§5.3 madde 7) zaten söyler.

**Buna karşılık kısa internet kesintisi tam desteklenir ve bu satılabilir bir özelliktir:**

- Lisans 30 gün geçerli imzalıdır → gecelik yenileme çağrısının başarısız olması **hiçbir
  kısıt tetiklemez** (Faz 3 tasarımı).
- Fiyat/katalog verisi image'ın içinde gelir (O-34/O-38) → internet olmadan da abrechnung
  hazırlanır.
- Tarayıcıda üçüncü-parti çağrı yok (O-36/O-37) → uygulama açılır.
- AI ve e-posta dışarı gider; ikisi de yoksa uygulama çalışmaya devam eder, yalnız o
  özellikler kapalıdır (O-07 ve O-14'teki koruma desenleri).

Kabul ölçütü (Faz 2 kabul kriterlerine eklenmeli): **kutunun giden ağı tamamen kesilir;
randevu açma, hasta dosyası, §302 hazırlığı ve yedek alma çalışmaya devam eder.**
Bu test, "veriniz sizde" iddiasının çalışan kanıtıdır.
---

## 7. Destek ve tanılama — kutuyu görmeden teşhis

K10 kilitli: **veriye uzak erişim yok.** Yani bir arızayı, arızalı makineye hiç bakmadan
çözmek zorundayız. Bu, ürünün en sık küçümsenen tarafı: erişimi olmayan destek, ancak
**kutunun kendi anlattığı kadarını** bilir.

### 7.1 Sektör pratiği

- **Sentry:** self-hosted için taahhüt ettikleri şey açık — *"Sentry engineers will do their
  best… but that's where our involvement ends"*, gerisi topluluk. Kurulum log'unu ve çalışma
  hatalarını (opt-in) kendi sunucularına gönderiyorlar; amaç *"providing a more seamless
  installation process"*.
- **GitLab:** müşteri için hesaplayıcı araçlar ve sürüm-özel yükseltme notları yayınlıyor —
  desteğin bir kısmını **belgeye** yıkma stratejisi.
- **Zammad:** yedek/geri yükleme script'lerini üründe veriyor ve sınırlarını yazıyor;
  ayrıca "sorun giderme" sayfasını doğrudan yedek akışına bağlamış.

### 7.2 Bize uyan ve uymayan kısım

**Uymayan:** Sentry'nin "gerisi topluluk" modeli bizde yok — ücret alıyoruz, AGB'de destek
taahhüdü olacak (`LEGAL_ONPREM_REQUIREMENTS.md` E1). Topluluk da yok.

**Uyan:** desteğin bir kısmını belgeye yıkmak (Faz 6.4 runbook) ve **kutunun kendini
anlatması**. Bizim farkımız: Sentry bunu ağ üzerinden yapıyor, biz **dosya üzerinden**
yapacağız — çünkü G4 telemetriyi varsayılan kapalı tutuyor ve K10 erişimi yasaklıyor.

### 7.3 Tanılama paketi (Faz 2.5) — içerik listesi

Panelde tek buton: *"Diagnosepaket erstellen"* → tek `.zip` → müşteri bize gönderir.
**Müşteri göndermeden önce içeriği ekranda görür** (DSGVO şeffaflığı ve güven).

| Bölüm | İçerik | Niye |
|---|---|---|
| `versionen.json` | `X.Y.Z` · image digest · şema no · Supabase servis tag'leri · Docker sürümü · OS | Destek çağrısının ilk üç satırı |
| `migrations.json` | `praxura_migrations` defterinin **tamamı** (ad + zaman + checksum) | "Hangi migration'da kaldı" sorusunun cevabı; veri içermez |
| `status.json` | `/status` çıktısının aynısı (§6.5) | Hangi bileşen kırmızı |
| `logs.txt` | api container'ının son N satırı, **PII-mask'ten geçmiş** (`api-backend/ai/pii-mask.js` + Sentry scrub kuralları) | Asıl teşhis buradan çıkar |
| `env-keys.txt` | Env değişkenlerinin **yalnız adları** ve dolu/boş bilgisi — **hiçbir değer yok** | En sık arıza sınıfı: yanlış yazılmış anahtar adı (O-28). Değer yazmak G2 ihlali olurdu |
| `backup.meta.json` | Son 3 yedeğin künyesi (§4.4) | Yedek var mı, anahtar uyumlu mu |
| `system.txt` | Disk/RAM/CPU kullanımı, container durumları, saat sapması | Disk dolma ve OOM |
| `lizenz.json` | Lisans-ID, plan, `valid_until`, son yenileme sonucu | Faz 3 durum makinesi |

⛔ **Pakete girmeyecekler:** hasta verisi, tablo içerikleri, `.env` **değerleri**, JWT/anahtar,
e-posta adresleri, praxis müşterilerinin adları. Kabul kriteri mekanik olmalı:
tanılama paketi üretildikten sonra bir kontrol, arşivde `leads`/`prescriptions`/`bookings`
tablolarından **tek satır** bulunmadığını doğrular.

### 7.4 Merkezin gördüğü — ve göremediği

O-18 bunu zaten işaretlemişti: bugün admin panelimiz müşteri tablolarını service-role ile
okuyup KPI üretiyor. On-prem'de bu **imkânsız ve istenmiyor.** Panelin on-prem satırında
görünecekler:

- **Merkezden bilinenler** (Faz 3.1 lisans sunucusundan): kim, hangi plan, lisans durumu,
  son yenileme zamanı, **son bildirilen sürüm** (yenileme çağrısı zaten sürüm taşıyor).
- **Bilinmeyenler:** randevu sayısı, AI kullanımı, DB sağlığı, hata sayısı.
  Panelde bunların yerinde boşluk değil **etiket** durmalı: *"On-Prem — kein Datenzugriff
  (K10)"*. Boşluk bırakılırsa altı ay sonra "veri kayboldu" diye araştırılır.

### 7.5 Sürüm bilgisini müşteriye gösterme

Discourse yeni sürümü **e-postayla** haber veriyor; bize de gerekli, ama farklı sebeple:
bizde güncelleme otomatik olduğu için müşteriye söylenmesi gereken şey *"güncelleme var"*
değil, ***"güncellendiniz ve şunlar değişti"***.

- Panelde kalıcı künye: `Sürüm 1.5.0 · Şema 0042 · Son güncelleme: 12.09.2026 03:14`.
- MINOR güncellemeden sonra panelde bir kez kapatılabilir bilgi kutusu: değişiklik özeti
  (DE), 3-5 madde, `releases.json`'daki `not_url` ile birlikte — **metin dosyada da
  gelir**, internet gerekmez.
- Davranış kırıcı bir değişiklik varsa (§2.2 ölçüt 3) bu kutu kapatılamaz, "okudum" ister.
- ⚠️ Sürüm notu metni G6 disiplinine tabidir ("KI erkennt Diagnose" tarzı ifade yasak).

---

## 8. Lisans ve SBOM disiplini

### 8.1 Niye ayrı bir bölüm: n8n dersi

K8 bir kez ödendi: n8n'in Sustainable Use License'ı ücretli müşteriye dağıtımı yasaklıyor,
bu **paketleme planı yazılırken** fark edildi — kod yazıldıktan sonra fark edilseydi
bedeli çok daha yüksek olurdu. İkinci kez yaşamamanın tek yolu, lisans kontrolünü
**bir kereye mahsus bir denetim değil, sürekli bir kapı** yapmaktır.

### 8.2 Sektör pratiği

- **CRA** (`LEGAL_ONPREM_REQUIREMENTS.md` §6) SBOM'u 11 Aralık 2027'de zaten zorunlu
  kılıyor; makine-okunur SBOM (CycloneDX/SPDX) sektör standardı.
- Olgun self-hosted ürünlerin hepsi pakete bir **NOTICE / third-party licenses** dosyası
  koyuyor (bizde E7 olarak zaten listede).
- Supabase self-host yığını bileşen bileşen açık kaynak listeliyor — ama **her bileşenin
  lisansı aynı değil**; hangi image'ı stack'e koyduğumuz bizim sorumluluğumuz.

### 8.3 Bizim kararımız

**Kural: pakete giren her şey iki listeden birinde olmak zorunda.**

| Liste | Ne | Sonuç |
|---|---|---|
| **İzinli** | MIT · Apache-2.0 · BSD-2/3 · ISC · PostgreSQL · MPL-2.0 · 0BSD · Unlicense · CC0 | Girer; NOTICE'a yazılır |
| **Yasak / incelemeli** | GPL/AGPL/SSPL/BUSL/Elastic License · Commons Clause · "Sustainable Use" · "source-available" her türü | **Girmez.** İstisna ancak `legal-de` yazılı görüşüyle |

**İki ayrı envanter tutulur — biri diğerinin yerine geçmez:**

1. **npm bağımlılıkları** → `npm sbom --sbom-format cyclonedx` (ya da syft) ile üretilir,
   release'te dosya olarak saklanır. Bu **kolay olan** taraf.
2. **Compose'daki image'lar** → asıl risk burada. `npm sbom` Supabase'in Studio'sunu,
   Kong'u, GoTrue'yu, imgproxy'yi **görmez.** Her image için ad + sürüm + lisans + kaynak
   elle bir tabloda tutulur (`onprem/NOTICE.md`), ve **yeni image eklendiğinde aynı commit'te
   satır eklenir.**

**Kapı (mekanik, `tools/check-onprem.sh`):** on-prem compose dosyası yazıldığında
`image:` satırlarının sayısı taban olur; **artış = red** — ta ki `onprem/NOTICE.md`'de
karşılık gelen satır eklenene kadar. Bu, `check-tabellen-register.sh`'in aynı mantığıdır
(kayıtsız tabloda commit reddi) ve tek kişilik ekipte işleyen tek disiplin biçimidir.

**Release öncesi kontrol (insan, §9 listesi madde 9):** SBOM üretildi mi, yeni bağımlılık
var mı, yeni bağımlılığın lisansı izinli listede mi. Yeni bağımlılık yoksa bu adım
saniyeler sürer; varsa zaten durup düşünmek gerekiyordu.

⚠️ `doğrulanmalı` — playbook Faz 0 notu Supabase self-host'ta **analytics/Logflare
bileşenini kurmamayı** zaten söylüyor (üretim için önerilmiyor + bize gereksiz). Lisans
açısından da ayrıca doğrulanmalı: stack'e giren **her** image'ın lisansı Faz 2.1'de tek tek
kaydedilir. Bu belge tahmin yürütmüyor, kalemi işaretliyor.
---

## 9. Sürüm çıkarma listesi (release checklist)

> **Kural: bu 14 adımın 14'ü yeşil değilse `:stable` etiketi taşınmaz.** Liste bilinçli
> olarak kısa — tek kişinin bir öğleden sonrada yapabileceği kadar. Uzun liste
> uygulanmayan listedir.
>
> Adım 1-9 sürümü basar (`X.Y.Z` + `:beta`). Adım 10-14 üç gün sonra `:stable`'ı taşır.
> Aradaki 72 saat **soak**tır ve kısaltılmaz (§6.3 katman 2).

### A — Sürümü basmadan önce (aynı gün)

| # | Adım | Yeşil ölçütü |
|---|---|---|
| 1 | **Sürüm türü belirlendi** | PATCH ise: `db/migrations/` altında **yeni dosya yok** (§2.2 kuralı). MINOR/MAJOR ise gerekçesi CHANGELOG'da |
| 2 | **Migration disiplini** | Yeni migration'lar ileri-yönlü, `expand` cinsinden; yıkıcı DDL varsa `-- ZWEISTUFIG:` satırı ve önceki adımın numarası yerinde (§4.7) |
| 3 | **Şema dökümü tazelendi** | `db/SCHEMA.sql` + `SCHEMA-RLS.sql` aynı commit'te güncel (proje kuralı — eski döküm hiç dökümden kötüdür) |
| 4 | **Testler** | `npm test` (kök `module/`) ve `api-backend` testleri yeşil — CI zaten publish'ten önce koşuyor |
| 5 | **Kapılar** | `tools/check-onprem.sh` · `check-dashboard-size.sh` · `check-namen.sh` · `check-tabellen-register.sh` yeşil; on-prem taban sayaçları **artmadı** |
| 6 | **Image smoke-test** | Gerçek CMD ile `docker run`, sahte-eksiksiz env, `/health` 200 ≤ 60 sn (§6.3 katman 1) |
| 7 | **Temiz kurulum** | Boş makinede `install.sh` → sihirbaz → §5.4'teki **14 kontrol yeşil** |
| 8 | **Yükseltme provası** | Bir önceki `:stable` şemasına sahip yedek geri yüklenir, yeni image bağlanır: göç-öncesi yedek alındı, migration'lar geçti, veri sağlam |
| 9 | **SBOM + lisans** | SBOM üretildi; yeni npm bağımlılığı / yeni compose image'ı varsa lisansı izinli listede ve `onprem/NOTICE.md`'de (§8.3) |

→ Yeşilse: `X.Y.Z` etiketi basılır, `:beta` taşınır, `releases.json`'a satır eklenir
(durak mı, sürüm notu URL'i, elle adım var mı — normalde yok).

### B — `:stable` etiketini taşımadan önce (72 saat sonra)

| # | Adım | Yeşil ölçütü |
|---|---|---|
| 10 | **Staging soak** | Staging kutu 72 saat `X.Y.Z`'de; `/status` sürekli yeşil; hata log'unda yeni sınıf hata yok |
| 11 | **Sponsor kutu soak** | En az bir sponsor (K12) kutu aynı sürümde 72 saat; gerçek kullanım gördü |
| 12 | **Sürüm notu** | DE metni hazır (3-5 madde), davranış kırıcı değişiklik varsa "okudum" gerektiren biçimde (§7.5); G6 diline uygun |
| 13 | **Geri alma yolu hazır** | Bir önceki `X.Y.Z` digest'i not edildi; MINOR ise "geri dönüş yedekten" olduğu biliniyor (§4.6) |
| 14 | **Yayın penceresi** | Cuma öğleden sonra ve resmî tatil arifesi **değil**. Praxis'ler sabah 07:00'de açılır; sorun çıkarsa müdahale edebileceğimiz bir gün olmalı |

→ Yeşilse: `:stable` yeni digest'e taşınır. Kutular bir saat içinde çeker (§6.4).

### C — Taşıdıktan sonra (ilk 24 saat)

- Sponsor kutuların `/status`'u ve lisans yenileme çağrılarının bildirdiği sürüm izlenir
  (bugün yenileme çağrısı sürümü **zaten taşıyor** — Faz 3 tasarımı).
- Destek kutusuna gelen tanılama paketlerinde `versionen.json` bakılır.
- Kötü sürüm tespit edilirse: `:stable` bir önceki digest'e geri taşınır (§4.6a) **ve**
  `releases.json`'a "bu sürüme geçmeyin" kaydı düşülür — Sentry'nin "versions to avoid"
  listesinin bizdeki karşılığı, ama makine-okunur.

---

## 10. Playbook'a eklenmesi gereken faz görevleri

Şema turu **Faz 1.7**'yi önermişti (`SCHEMA-VERTEILUNG.md` §9.2). Bu turun çıkardıkları:

| Yeni görev | Faz | Ne | Kaynak |
|---|---|---|---|
| **2.1a — Kurulum ön-kontrolü** | 2 | §5.3'teki 8 kontrol; AB lokasyonu, port, DNS, NTP, idempotanlık | §5.3 / §5.5 |
| **2.4b — Gerçek healthcheck** | 2 | `/health` (liveness) + `/status` (derin, 10 alan). Bugünkü `server.js:276` sabit `ok` döndürüyor — sağlık kapısı olarak kullanılamaz | §6.5 · **O-40** |
| **2.3a — Göç öncesi otomatik yedek** | 2 | Runner migration'dan önce `vor-<sürüm>` yedeği alır; alınamıyorsa migration çalışmaz; künye + parmak izi | §4.3 / §4.4 · O-26 · **O-29** |
| **2.5a — Tanılama paketi içerik listesi** | 2 | §7.3'teki 8 bölüm + "hasta verisi yok" mekanik kontrolü | §7.3 |
| **2.9 — Sürüm ve kanal manifesti** | 2 | `onprem/releases.json` (durak, otomatik adım, sürüm notu) + runner'ın atlama reddi + panel künyesi | §3.4 · **O-43** |
| **4.3a — CI image smoke-test** | 4 | Publish'ten önce gerçek CMD ile `docker run` + `/health`. Tek başına en yüksek getirili adım | §6.3 · **O-41** |
| **4.3b — `:stable` soak ve etiket taşıma** | 4 | `X.Y.Z` değişmez etiket + 72 saat soak + elle taşıma; `latest` kullanımdan kalkar; kutu Watchtower'ı saatlik | §2.3 / §6.4 · O-25 |
| **6.1b — SBOM + NOTICE + lisans kapısı** | 6 | İki envanter (npm + image), izinli/yasak lisans listesi, compose image sayacı kapısı | §8.3 · **O-42** · CRA E7/E8 |
| **6.4a — Destek runbook'u** | 6 | "Tanılama paketini nasıl okurum" + en olası 10 arıza; §7.3'ün dosya adlarına göre yazılır | §7 |

Ayrıca **mevcut fazlara eklenecek kabul kriterleri:**

- Faz 2: *"kutunun giden ağı tamamen kesilir; randevu, hasta dosyası, §302 hazırlığı ve
  yedek çalışmaya devam eder"* (§6.7).
- Faz 2: *"tanılama paketi üretilir; arşivde hasta tablolarından tek satır yoktur"* (§7.3).
- Faz 4: *"bozuk bir image kasten yayınlanır; CI smoke-test onu yakalar ve hiçbir etiket
  basılmaz"* (§6.3 katman 1).
- Faz 3: *"lisans pasifken 6 ay kapalı kalmış kutu yeniden açılır; 12 migration uygulanır,
  göç öncesi yedek alınır, kutu açılır"* (§3.6).

---

## 11. Kullanıcı kararı bekleyenler

Aşağıdaki üçü **ajanın kararı değil.** İlki kilitli bir korkuluğun lafzını genişletiyor;
ikisi lisans formatını dondurmadan önce cevaplanmalı.

### 11.1 ★ Lisans yenileme çağrısı sağlık durumu taşısın mı? (G1/G4'ün lafzı)

**Durum:** G1 aynen şöyle diyor: *"lisans yenileme çağrısı dahil — o çağrı yalnızca
lisans-ID + sürüm + imza taşır, başka hiçbir şey."* G4 telemetriyi varsayılan kapalı ve
onaya bağlı tutuyor.

**Sorun:** bu iki kural birlikte, sahadaki 20 kutunun sağlığı hakkında bize **hiçbir şey**
bırakmıyor. Bir migration üç kutuda hata verdiğinde bunu ancak müşteri arayınca öğreniriz.

**İki yol:**

- **(a) Genişletme yok — önerilen, bugün için.** Sağlık kapısı yalnız **bizim** kutularımızla
  kurulur: staging + sponsor kutular (K12 — onlar bizim makinelerimiz, müşteri kutusu değil).
  72 saatlik soak bunun üzerine oturur. G1'e hiç dokunulmaz. Bedeli: 20 ücretli kutu
  büyüdükçe kör nokta büyür.
- **(b) Tek alan eklenir:** yenileme çağrısına `durum` (enum: `ok` / `bakim_modu` /
  `migration_hatasi` / `yedek_yok`) ve `sema_no`. Serbest metin yok, sayaç yok, host adı yok,
  hasta verisi ile ilgisi yok. Bu, G1'in lafzını genişletir — **kullanıcı açmadan yapılmaz.**

**Ajanın tavsiyesi:** şimdi **(a)**; (b) ancak ücretli kutu sayısı ~10'u geçtiğinde ve
**Faz 3 lisans formatı donmadan önce** yeniden sorulur. Lisans formatı donduktan sonra alan
eklemek sürüm uyumluluk sorunu üretir (O-33'ün aynı uyarısı).

---

#### ✅ KARAR (04.09.2026, ana bağlam) — (a), ama tuzağı kapatarak

**Sağlık verisi gönderilmiyor.** G1'in lafzına dokunulmuyor: yenileme çağrısı
lisans-ID + sürüm + imzadan ibaret kalıyor. Gerekçe ajanınkiyle aynı — soak testi
bizim sponsor kutularımızda yapılıyor (K12), ücretli kutudan veri çekmenin bugün
karşılığı yok. Kör noktayı kabul ediyoruz, kayda geçiyor.

**Ama ajanın iki seçeneği bir tuzak bırakıyor:** ikisi de "sonra yeniden sorulur"
diyor, ve o "sonra" geldiğinde format çoktan donmuş olacak. Bu, kararı ertelemek
değil, gelecekteki kendimize kapalı bir kapı bırakmak olur.

**Bu yüzden üçüncü bir şart ekliyorum — Faz 3.2'nin kabul ölçütüdür:**

> Lisans yükü (payload) **sürümlenir** (`lisans_sema: 1`) ve doğrulayıcı,
> **tanımadığı alanları yok sayarak** imzayı doğrular. Yani yarın `durum` alanı
> eklenirse, bugünkü `:stable` kutuları o lisansı **reddetmez**, sadece görmezden gelir.

Maliyeti bugün birkaç satır; olmadığında bedeli, alan eklemek için sahadaki her kutuyu
önce yükseltmek zorunda kalmak. G1 bugün korunuyor, kapı açık kalıyor — ikisi
birbirinin alternatifi değil.

Bu şart sağlandığı sürece (b) kararı **ne zaman gerekirse o zaman** alınır; bir
tarihe bağlamıyoruz.

### 11.2 Geri alma yolu: merkezden etiket mi, kutuda düğme mi?

§4.6'daki (a)/(b) seçimi. **Tavsiye: (a) + PATCH'lerin migration'sız olması.** (b) küçük bir
yardımcı servis ve docker soket erişimi gerektirir — güvenlik yüzeyi büyür, tek kişilik
ekipte bakımı pahalı. Karar Faz 4.3 yazılmadan önce verilmeli.

### 11.3 CRA "destek süresi" beyanındaki rakam

§3.5'teki tablo bunu teknik taraftan **kısıtlamıyor**, ama AGB'ye bir sayı yazılacak
(`LEGAL_ONPREM_REQUIREMENTS.md` E8). Sayı `legal-de`'nin işi; burada yalnız şu not
düşülüyor: **teknik olarak yükseltme penceremiz sınırsız** (§3.4), yani hukuk tarafı
teknik bir engelle karşılaşmıyor.

---

## 12. Bu dosyanın sicildeki yeri

`onprem/REGISTER.md`'de bu belgeyle **kapanan** madde: **O-29** (`DATA_ENCRYPTION_KEY`) —
`offen` → `geplant`, gereksinim §4.5'te dört kurala bağlandı.

Bu belgeyle **açılan** maddeler: **O-40** (`/health` sahte yeşil) · **O-41** (CI image'ı
çalıştırmadan yayınlıyor + Watchtower 60 sn) · **O-42** (lisans/SBOM sürekli kapısı yok) ·
**O-43** (sürüm/kanal manifesti ve durak kavramı yok).

Bu belgeye **referans veren** mevcut maddeler: **O-25** (kanallar) · **O-26** (yedekleme) ·
**O-28** (crash-loop yasağı) · **O-33** (lisans formatı donmadan cevaplanacaklar) ·
**O-34/O-35** (image içeriği disiplini) · **O-39** (şema zinciri — bu belgenin kardeşi).

Kardeş belge: `onprem/SCHEMA-VERTEILUNG.md`. İkisi birlikte okunur — **o "şema kutuya nasıl
varır", bu "sürüm kutuya nasıl varır" sorusunun cevabıdır.** Çelişki bulunursa
`SCHEMA-VERTEILUNG.md` §11'deki üç kilitli karar (baseline · arşiv · dört haneli sıra no.)
üstündür.

*Yazıldı: 2026-09-04 · `onprem` ajanı · kod yazılmadı, standart yazıldı.*
