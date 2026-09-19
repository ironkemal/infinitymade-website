# §302 Echtbetrieb — Gerçek gönderime geçiş planı

> **Bu dosya ne:** "Müşteri gerçekten kasaya fatura gönderip para alabilsin" hedefine giden
> yolun planı. Bir sonraki oturumda doğrudan açılıp uygulanmak üzere yazıldı.
>
> **v2 — 2026-09-20.** Dört uzman ajan (`gkv-302`, `onprem`, `guvenlik`, `legal-de`) v1'i
> denetledi. **v1 ciddi biçimde eksikti** — özellikle kâğıt yol ve şifrelemenin zorunluluğu.
> Bu sürüm onların bulgularıyla baştan yazıldı.
>
> **Öncül:** `ONPREM_MIGRATION_PLAYBOOK.md` (aynı biçim) · `wissensbank/SPEC-RULES.md` (kural kaynağı)
> · `compliance/LEGAL_DECISIONS.md` (hukuki kararlar)

---

## 0. Bugün neredeyiz

19–20.09.2026'da §302 **dosya formatı** uçtan uca düzeltildi, canlıda gerçek dosya üretilerek
doğrulandı ve **`gkv-302` tarafından onaylandı** ✅ (yedi düzeltme tek tek Anlage 1/3 TP5 V21'e
karşı denetlendi, canlı çıktı segment segment okundu, aritmetik tutuyor, 88 test yeşil).

Düzeltilenler: GES Summenstatus · UNT/UNZ 6 hane dolgu · virgül kaçırma · her tanı ayrı DIA ·
podolojide Therapiefrequenz `0` · NAD adresi · `UNA` kaldırıldı · ZAA parser kaçış-duyarlılığı ·
Muster-13'te ikinci ICD alanı · preflight gerekçesinin ekranda gösterilmesi · iki ICD'li reçetede
yanlış "ICD eksik" · gelecek tarihli Behandlung engeli · kayıtlı seansların görünmesi.

**Ama dosya doğru olmak, para gelmek demek değil.** Denetim şunu ortaya çıkardı: §302'de bir
Abrechnung **altı bileşenden** oluşuyor ve v1 planı yalnız birini (veri dosyası) ele alıyordu.

### ⚠️ Bu planı uygularken tek altın kural

**Hafızaya, eski notlara ve ajan iddiasına değil — koda bak.** v1'i yazarken hafızada
"Auftragsdatei üretilmiyor" yazıyordu; kodda baktım, **yanlıştı** (dosya 17.09'da yazılmış,
sadece route kaydetmiyor). Aynı şekilde bu plandaki her "durum" satırı 20.09.2026'da kodda
doğrulandı — ama dokunmadan önce ilgili dosyayı bir kez daha aç.

---

## 1. Kapanmış kararlar — yeniden açma

Bunlar dört ajanın verdiği, gerekçeli ve kapalı kararlar. Uygulama sırasında "acaba şöyle mi
yapsak" diye geri dönülmez.

| # | Karar | Kim verdi | Kısa gerekçe |
|---|---|---|---|
| K1 | **Şifreleme backend'de çalışacak**, tarayıcıda değil | `guvenlik` (veto yetkisi onda) | Tarayıcıdaki sertifika doğrulaması manipüle edilmiş client'la atlanabilir; düz metin zaten sunucuda üretiliyor, tarayıcı bunu azaltmıyor. `gkv-302` ve `legal-de` itiraz etmedi |
| K2 | **Özel anahtar sunucuya ASLA gelmez** — imza tarayıcıda, kullanıcının `.p12`'siyle | `legal-de` + `guvenlik` | Dört ayak: §203 StGB sorusu hiç doğmuyor · beyan sahibi tartışmasız praxis · yeni Art. 32 varlık sınıfı doğmuyor · ITSG CPS anahtar korumasını şart koşuyor. **Kalıcı kilitli karar** |
| K3 | **`podologie_behandlungen`: fiziksel DELETE yasak, INSERT anından itibaren.** Düzeltme = Storno + yeni satır | `legal-de` | § 630f Abs. 1 S. 2 BGB saati **kayıt anında** başlar (fatura beklemez). BGH VI ZR 84/19: değişikliği görünür kılmayan elektronik dokümantasyonun delil değeri yok. "Durchstreichen statt Radieren" |
| K4 | **"Tool, kein Abrechnungsdienstleister" konumlandırması geçerli kalıyor** — `echt`'e geçmek çizgiyi geçmez | `legal-de` | Çizgi `kind` değerinde değil, **"dosyayı kim gönderiyor"**da. Kodda doğrulandı: DAS'a giden tek çağrı yok, `mark-sent` terapistin elle işaretlemesi |
| K5 | **Şifreleme opsiyonel bir iyileştirme DEĞİL** — Faz 2'nin ön koşulu | `gkv-302` | GGT Anlage 2 §2.1 yalnız `00+00` ve `03+03`'e izin veriyor; `03+00` açıkça yasak. **İmzalı dosya şifresiz gönderilemez** — imza ve şifreleme tek bir özellik |

### ⛔ Çizgiyi geçirecek üç şey — yapılırsa `legal-de`'ye tekrar gidilir

1. **Dosyayı bizim sunucumuzdan göndermek** (DAS portalına/AS4/SFTP push) → § 302 Abs. 2 S. 2
   anlamında Rechenzentrum oluruz; kendi IK'mız, kendi DAS sözleşmemiz, §203 Abs. 4 riski,
   Berufshaftpflicht kapsam dışı. On-prem'de K6'nın kardeşi bir ihlal.
2. **Özel anahtarı sunucuya almak** (K2).
3. **Kemal'in müşterinin ITSG hesabıyla işlem yapması** — 17.09.2026'da zaten ⛔ koşullu
   kapatıldı (`guvenlik` S-29), aynen duruyor.

### ⛔ K6 — Teslim kanalı: §302 dosyası merkezden proxy'lenmez (`onprem` sert veto, G1 · O-119)

Planda teslim kanalı hiç yazmıyordu; `onprem` bu boşluğun en cazip yanlış cevabı davet ettiğini
söyledi ve önden kapattı. §302 dosyası **ürettiğimiz en yoğun PHI'li çıktıdır** (hasta adı +
doğum tarihi + KVNR + ICD + tedavi tarihleri, tek dosyada, her hasta için). Merkezden
proxy'lemek on-prem geçişinin **bütün amacını iptal eder.**

**İzin verilen:** dosya kutudan iner, **müşterinin kendi kanalıyla** gider.
**İleride otomatik gönderim istenirse yol açık ama şartlı:** kutudan **doğrudan** DAS'a,
müşterinin kendi kimlik bilgileriyle — merkez üzerinden asla. O gün ayrı bir tip-A maddesi açılır.

---

## 2. Faz 1 — Kod işleri

Sıra önerilen sıradır; 1.A grubu birbirinden bağımsız, paralel gidebilir.

### 🔴 Adım 1.1 — Auftragsdatei kaydedilsin ve indirilebilsin

**Durum (doğrulandı):** `buildDtaFile()` Auftragsdatei'yi **üretiyor** ve dönüş nesnesinde
`auftragsdatei` alanı olarak veriyor (`dta/builder.js:625-638`). Üç create route'unun hiçbiri
almıyor — `grep -rn "uftragsdatei" api-backend/billing/api/` → **sıfır sonuç.** Üretilip çöpe
atılıyor.

**Neden blocker:** Anhang 2 Kap. 9 §3.1 — *"Prüfung ob die Dateien **paarweise**, d.h.
Auftragsdatei und zugehörige Nutzdatei übermittelt"*. Prüfstufe 1 kriteri; eksikse dosya içeriğe
bakılmadan reddedilir.

**Yapılacak:**
1. Üç create route'unda (`abrechnung.routes.js` ~694 / ~2778 / ~3211) `dta.auftragsdatei`'yi al,
   `.dta`'nın yanına yükle (mevcut desen: satır ~791 / ~2849 / ~3255).
2. Yolu saklayacak kolon gerekiyor mu bak (`storage_path`, `begleitzettel_path`,
   `signed_storage_path` var). Gerekirse **şema protokolü** (aşağıdaki kutu) + `db-ustasi`.
3. İndirme ucu + frontend düğmesi (`module/abrechnung-detail.js`).

**⚠️ İçerikte de üç sorun var (`gkv-302` buldu) — aynı işte çözülmeli:**
- **VERSCHLÜSSELUNGSART/ELEKTRONISCHE_UNTERSCHRIFT sabit `00`/`00`** (`auftragsdatei.js:170-171`).
  Bugün doğru (hiçbiri gönderilmiyor), ama Adım 1.3 bitince `03`/`03` olmalı ve **gönderilen
  dosyanın gerçek hâlini yansıtmalı.** Kodun kendi yorumu kuralı zaten biliyor.
- **`DATEIGRÖSSE_ÜBERTRAGUNG`** ham boyutu yazıyor; spec *"nach eventueller Verschlüsselung"*
  diyor. `uebertragungByteLength` parametresi var, beslenmiyor.
- **`TRANSFER_NUMMER` yanlış kaynaktan** (`builder.js:427`, `rechnung.datennummer`'dan modulo).
  Spec açıkça *"keinen Bezug zur lfd. Nr. des Vorlaufsatzes"* diyor. → Adım 1.2'ye dahil.
  *(Not: kodun kendi yorumu bunu zaten biliyor ve "Konsey 2026-09-17'de bilinçli ertelendi"
  diyor — yeni bir hata değil, **vadesi gelmiş borç.**)*

**Bitti ölçütü:** Bir Abrechnung oluşturulduğunda Storage'da `.dta` **ve** Auftragsdatei yan yana;
ikisi de indirilebiliyor; Auftragsdatei'nin 207-210 alanları gönderilen dosyanın gerçek hâlini
yansıtıyor; `canli-test` canlıda doğruluyor.

> ✅ **`onprem` onayı:** kutuda Supabase Storage **var**, `abrechnungen` bucket'ı şema zincirinde
> geliyor (`0000_baseline.sql:12498`) → `supabase.storage.from('abrechnungen').upload(...)` deseni
> iki dağıtımda da aynı kodla çalışır, ek iş yok.
> ⚠️ **Sıralama notu:** 1.3 inince VERSCHLÜSSELUNGSART/ELEKTRONISCHE_UNTERSCHRIFT `00/00` →
> `03/03` olur ve **1.1'de kaydedilmiş eski Auftragsdatei'ler geçersizleşir** — yeniden
> üretilmeleri gerekir.

---

### 🔴 Adım 1.2 — İKİ kalıcı sayaç (Datenaustauschreferenz + Transfernummer)

**Durum (doğrulandı):** Üç route da `const datennummer = (weekCount || 0) + 1;`
(~685, ~2772, ~3205).

**Spec'e göre üç ayrı hata var (`gkv-302`):**
1. **Kapsam yanlış.** Spec (Anlage 1 V21 Kap. 5.4 UNB 0020 + Kap. 7.2): sayaç
   **(Absender-IK, Empfänger-IK) çifti başına** — yani **DAS başına.** Kod `owner_id` başına
   sayıyor. Bir praxis iki DAS'a gönderdiğinde ikisi de "fortlaufend" olmaz.
2. **Yıllık sıfırlanıyor.** `gte(created_at, '{year}-01-01')` → her 1 Ocak'ta `00001` tekrar
   gider. Spec yalnız `99999` taşmasında sıfırlamaya izin veriyor.
3. **`COUNT(*)`** — silme numarayı geri alır, eşzamanlılıkta çakışır.

**Ve ikinci bir sayaç lazım:** `TRANSFER_NUMMER` ayrı bir şeydir — başarılı **aktarım** başına
artar, `0..999` döner, **başarısız aktarımda aynı numara korunur.** Bugün `datennummer`'dan
türetiliyor, yani spec'in "ilgisizdir" dediği şey yapılıyor.

> ⚠️ **v1'deki "kasa 'bereits eingereicht' der" cümlesi kaynaksızdı, düzeltildi.** Spec böyle bir
> ret gerekçesi tanımlamıyor. Belgelenmiş zarar: **Korrekturverfahren sırası bozulur** — bir
> düzeltme, ilgili Erstrechnung'dan önce işlenirse reddedilir (Kap. 7.2) ve teşhisi zordur.

> ⚖️ **Bu adım hukuki olarak da zorunlu.** `legal-de`: çifte gönderim bir **Fehlfunktion**tır,
> kullanıcı hatası değil → AGB § 9(2) Kardinalpflicht üzerinden **sorumluluk bizde.**
> Faz 2.2'den önce bitmeli.

**Yapılacak:** `db-ustasi`'ya sor (nummernkreise deseni mi, yeni tablo mu), atomik olsun
(sequence ya da `UPDATE … RETURNING`), **DAS-IK başına**, yıllık sıfırlama yok. İkinci sayaç
(Transfernummer) aktarım başına, başarısızlıkta korunacak şekilde. `onprem`'e göç senaryosunu
sor (aşağıya bak).

**Bitti ölçütü:** `grep "weekCount\|jahresCount"` sıfır; art arda iki Abrechnung farklı numara;
silme sonrası numara **geri gitmiyor**; yılbaşında sıfırlanmıyor; iki sayaç birbirinden bağımsız;
migration zincirde, döküm tazelenmiş.

> ⚠️ **`onprem` — planda eksik olan üç senaryo (O-115):**
> 1. **SaaS→kutu göçü:** kutunun `abrechnung` tablosu boş → sayaç 1'den başlar → SaaS'ın
>    gönderdiği referanslar **ikinci kez** üretilir. Aynı numaradan `buildSammelRechnungsnummer()`
>    ile **fatura numarası** da türüyor, yani GoBD tarafı da ısırır.
> 2. **`restore.sh` ile geri dönüş** sayacı geri sarar — O-26 çözüldükten sonra doğan, hiçbir
>    yerde yazılı olmayan yeni bir sonuç.
> 3. **Yılbaşı sıfırlamasının** "fortlaufend" beklentisine uyup uymadığı `gkv-302`'nin sorusu —
>    sayaç yazılmadan sorulmalı.
>
> **Şart:** sayaç **monoton**, yalnız **ileri** alınabilen bir yönetim yolu (kutuda owner'ın
> erişebileceği bir ekranda — orada bunu biz yapamayız), göç + `restore.sh` runbook'una
> "sayaç ileri alındı mı" adımı.
> ⛔ **Numarayı merkezden dağıtan tasarım DUR** — yeni tip A bağımlılık, offline kutu fatura
> kesemez hâle gelir.

---

### 🔴 Adım 1.3 — CMS EnvelopedData şifrelemesi (K5: zorunlu, opsiyonel değil)

**Durum:** İmzalama var (tarayıcıda node-forge → `/upload-signed` → `.p7m`). Şifreleme **yok**.
`buildEncryptedFilename()` (`filename.js:78`) hazır, çağıran yok.

**Sıra kesin** (GGT §5.1): *"zunächst mit seinem privaten Schlüssel signiert und bei der
folgenden Verschlüsselung unter Nutzung des öffentlichen Schlüssels des Empfängers"* —
önce imzala, sonra **alıcının açık anahtarıyla** şifrele.

#### 🔒 K2 — bozulmayacak tasarım
`terapeut_zertifikat` **sadece metadata** tutuyor (`cert_subject`, `cert_thumbprint`,
`cert_serial`, `cert_valid_from/to`) — özel anahtar ve sertifika blob'u sistemimize **hiç
girmiyor**, imza kullanıcının kendi `.p12`'siyle tarayıcıda. `guvenlik` ve `legal-de` bunu
doğruladı ve **kalıcı karar** seviyesine çıkarılmasını istedi. Çözüm "anahtarı sunucuya alalım"
olamaz — sert veto.

#### ⛔ Önce: GGT Anlage 16 (SECON) indirilmeli
Şifrelemenin tam profili (algoritma, anahtar uzunluğu, sertifika profili, ITSG dizin erişimi)
**GGT Anlage 16'da** ve o belge arşivde **yok**. `gkv-302` "PKCS#7" dışında bir iddiada
bulunamadı. → `wissensbank` ajanına indirtilecek. **Bu belge olmadan 1.3'e başlanmaz** —
algoritma tahminle seçilmez.

#### `guvenlik` kısıtları — V1–V8, plana aynen giriyor

**V4 — her şifreleme çağrısından önce, istisnasız:**
1. `notBefore` ≤ şimdi ≤ `notAfter`
2. Zincir, birlikte dağıttığımız **pinlenmiş** ITSG trust anchor'a kadar doğrulanır
3. `keyUsage` içinde `keyEncipherment` var
4. Sertifikadaki IK = hedef Annahmestelle'nin IK'sı
5. Anahtar uzunluğu spec'in asgarisinin altında değil *(kesin rakam `gkv-302`'den alınacak)*

Biri düşerse: **hata, dosya üretilmez.** Fallback yok, "uyar ve devam et" yok. Ayrıca bitişe
**30 gün kala UI uyarısı.**

**Alıcı sertifikasının kaynağı — kabul sırası:**
1. ✅ Elle yüklenen, fingerprint'i ITSG'nin yayımladığıyla karşılaştırılmış, kaynak+tarih+onaylayan
   kaydedilmiş tek depo *(ilk sürüm için en küçük ve en güvenli)*
2. ✅ Müşterinin yüklediği — **aynı doğrulamalardan geçmek şartıyla**
3. ⚠️ ITSG'den otomatik indirme — pinlenmiş anchor, fingerprint değişiminde **otomatik kabul yok**,
   `onprem` G1 onayı şart
4. ⛔ **ASLA:** request body'den, env'deki serbest URL'den, doğrulanmadan

**Kimin sertifikası (`gkv-302`):** Hangi IK'nın açık anahtarıyla şifreleneceği
**Kostenträgerdatei'den** belirlenir (Verknüpfungsart 02/03) — kodumuz bunu zaten yapıyor
(`kostentraeger/annahmestelle.js`). Ama Kostenträgerdatei IK/adres taşır, **açık anahtar
taşımaz** — sertifikalar ITSG Trust Center dizininden gelir.

#### 📦 Anahtarın kutuya ulaşması — `onprem` dönüşüm şartı (O-116), tip A → tip B

**Kaynak belli:** ITSG Trust Center Annahmeliste → `annahme-rsa4096.key` (PKCS#7,
`trustcenter-data.itsg.de/dale/annahme-rsa4096.key`), yayıncının tarifiyle *"i.d.R. alle 3 Jahre
oder auch bei Änderungen"*, bugünkü liste **31.12.2027**'ye kadar geçerli.

**Kutu bu adrese hiç çıkmaz.** Çözüm `preise-check.yml` deseni (O-34): GitHub Actions çeker →
repoya commit → image → Watchtower. **Üç şart:**
- **(a)** Elle yükleme yolu (airgap kutu, plan dışı rotasyon).
- **(b)** **Yerel son-kullanma kapısı** — üretimden önce `notAfter` kontrolü, 60 gün kala uyarı,
  dolmuşsa anlaşılır mesajla DUR. *Süresi geçmiş anahtarla şifrelemek en kötüsü: dosya gider,
  kasa açamaz, ret haftalar sonra döner.*
- **(c)** Liste `onprem/NOTICE-QUELLEN.txt`'e **altıncı kaynak** olarak (O-78 deseni,
  `legal-de`'den tek cümle).

**G1/G2 hükmü:** liste **açık anahtar** taşır, sır değil → G2 temiz, image'a gömülebilir.
**`onprem`'den veto yok**, tek şartı **G7: tek kod yolu.** Bu, K1'i (backend) ayrıca destekliyor —
tarayıcı seçeneği listeyi tarayıcıya indirmeyi + ikinci bir kripto yolunu gerektirirdi.

**⚠️ Sertifikalar yılda bir yenileniyor.** SECON Teilnehmer-Zertifikat azami süresi 3 yıldan
**1 yıla** indirildi. v1 sertifikayı "bir kez alınır" gibi ele alıyordu — **yıllık bir iştir.**
`terapeut_zertifikat.cert_valid_to` var ama **uyarı mekanizması yok.**

**Bitti ölçütü:** İmzalı+şifreli dosya üretiliyor; round-trip testi (şifrele→çöz→byte-byte aynı)
otomatik testte, **ayrı üretilmiş test anahtar çiftiyle** (müşterinin `.p12`'siyle değil, `Ö4`);
V1–V8 uygulanmış; `guvenlik` onaylamış; özel anahtar hâlâ sunucuya gelmiyor.

---

### 🔴 Adım 1.4 — Kâğıt yol: Urbelege + Begleitzettel adresi

> **v1'in en büyük boşluğu buydu.** `gkv-302`: *"DTA kusursuz olsa bile, orijinal Verordnungen
> doğru numaralanmış ve doğru sırayla Papierannahmestelle'ye ulaşmazsa para gelmez."*

**Spec (Richtlinien-Text §2(1)):** Abrechnung **altı** bileşen: a) Abrechnungsdaten ·
b) **Urbelege im Original** · c) ggf. Images · d) ggf. Leistungszusagen · e) Gesamtaufstellung ·
f) **Begleitzettel nach Anlage 4**.

**§4(1)-(2):** Her Urbeleg'in **ön yüz sağ üstüne Rechnungsnummer**, ayrıca **Belegnummer**;
Belegnummer veri setindekiyle **aynı** olmalı ve Urbelege **Belegnummer sırasıyla** teslim
edilmeli.

**Durum:** `billing/pdf/begleitzettel.template.js` Gesamtrechnung başına bir sayfa üretiyor ✅
(Anlage 4'ün 7 zorunlu alanının 7'si de var), ama **alıcı adresi bilerek boş** — çünkü Urbelege
**Papierannahmestelle'ye** (Verknüpfungsart **09**) gider, Datenannahmestelle'ye (02/03) değil,
ve o çözümleme yazılmamıştı. Test döneminde doğru karar; **Echtbetrieb'de müşteri zarfı nereye
göndereceğini bilmek zorunda.**

**Yapılacak:** Kostenträgerdatei'den VKG 09 (Papierannahmestelle) çözümlensin — parser onu zaten
tanıyor (`kostentraeger/annahmestelle.test.js:116,163`) ama `ANS` adres segmenti atlanıyor
(`kostentraeger/parser.js:202`, "Faz A2 ignore"). `ANS` parse edilip Begleitzettel'e pencere-zarf
adresi yazılsın. Ayrıca **doğrulanacak:** Belegnummer + Rechnungsnummer gerçekten kâğıda basılıyor
mu (`rezeptvorderseite.template.js`), ve Belegliste sırası DTA içindeki sırayla aynı mı.

**Bitti ölçütü:** Begleitzettel doğru Papierannahmestelle adresini taşıyor; Urbelege çıktısı
Belegnummer sırasında; bir podolog eline alıp zarfa koyabiliyor.

---

### 🔴 Adım 1.5 — Storno (K3) — hukuki zorunluluk

`legal-de`'nin tasarımı, aynen uygulanacak:

**1) Üç additive kolon** `podologie_behandlungen`'e:
```
storniert_am    timestamptz
storniert_von   uuid  FK profiles(id) ON DELETE SET NULL
storno_grund    text
```

**2) `podologie_behandlungen_festschreibung()` trigger'ı** — `prescriptions_festschreibung()`
deseni (`0020`):
- **`BEFORE DELETE` → koşulsuz `RAISE EXCEPTION`.** `invoice_id`'ye bağlamak §630f deliğini
  açık bırakır.
- **İçerik alanları koşulsuz kilitli:** `behandlungsdatum`, `hpnr_codes`, `diagnosegruppe`,
  `lokalisation`, `notizen`, `betrag_gkv`, `owner_id`, `created_at`.
- **Serbest yalnız dört alan:** `storniert_*` (yalnız NULL→değer, geri dönüş yok) ·
  `invoice_id` · `employee_id` (yalnız NULL→değer).

**3) ⚠️ İki FK tuzağı — atlanırsa canlı patlar:** `verordnung_id` ve `invoice_id` FK'ları
`ON DELETE SET NULL`. Postgres bunu **UPDATE olarak** yürütür ve BEFORE UPDATE trigger'ı ateşler.
`verordnung_id` koşulsuz kilitlenirse `DELETE FROM prescriptions` bundan sonra hata verir.
→ `verordnung_id` **yalnız NULL'a** çekilebilsin.

**4) ⛔ AYNI COMMIT'te `api/dsgvo.js`:** `podologie_behandlungen` `DELETE_TABLES` (satır 270)
listesinden çıkarılıp **⛔-Bloğa** taşınacak. Yapılmazsa `BEFORE DELETE` trigger'ı atar ve
**her praxis için hesap silme 500 döner.**

**5) 🔴 En büyük risk — dokuz okuma yeri `storniert_am IS NULL` filtresi almalı:**
`podo-einheiten.js:248` · `eingangsbefundung-regel.js` (78040/78100) · `behandlungsbeginn.js:32` ·
`abrechnung-auswahl.js:479` (**§302 seçimi!**) · `rechnung-bruecke.js:66,184,200` ·
`patientenkarte.js:182` · `podologie-abrechnung.js:237,271` · `rechnung-verordnung.js:167` ·
`sitzungsfortschritt.js` · `podo-geplant.js`.
Biri unutulursa ya Einmaligkeitssperre sessizce açılır ya **storniert bir Behandlung §302
dosyasına girer.** → tek bir `fonksiyon-ustasi` turunda toplu yapılsın, dağıtık değil.

**6) UI:** "Stornieren" düğmesi + **zorunlu gerekçe** (gerekçe, §630f'in "warum/wann erkennbar"
gereğinin kendisi). Storno'lu satır **gizlenmez** — üstü çizili, gerekçe+tarih+kim ile gösterilir.
`module/podologie-abrechnung.js` ~655-680'deki devir yorumu bu kararla değiştirilir.

**⚠️ Grace-window yapma.** "5 dakika içinde silinebilsin" bile §630f'te dayanaksız ve BGH VI ZR
84/19'un tam olarak eleştirdiği şey.

**Yan düzeltme, aynı işte:** `api/dsgvo.js:479` ve `:306`'daki **`§ 304 SGB V` yanlış Fundstelle**
(muhatabı Krankenkassen/KVen, Leistungserbringer değil) → **`§ 630f Abs. 3 BGB`**. Kullanıcıya
giden metin, 10 dakikalık iş.

**Bitti ölçütü:** DELETE denemesi hata veriyor; Storno çalışıyor ve gerekçe zorunlu; dokuz okuma
yeri filtreli; hesap silme akışı 500 dönmüyor; migration zincirde.

---

### 🟠 Adım 1.6 — Korrekturverfahren canlıda bir kez koşturulsun

**Neden:** Anlage 1 V21 Kap. 7.1 — Heilmittel için **01.07.2020'den**, Physiotherapie (VKZ 10
dahil) **01.10.2025'ten** beri **verpflichtend**. Ve Kap. 7.2 (§303 Abs. 3 SGB V atfıyla):
elektronik gönderilmeyen düzeltmelerde kasa, **faturanın %5'ine kadar** pauschal kesinti
yapabilir.

**Durum:** Temel var (`abrechnung.routes.js` ~3033+ URI eşlemesi, ZAA parser, `GZF` segmenti) —
ama uçtan uca hiç koşturulmadı.

**Bitti ölçütü:** Sahte bir ZAA (Absetzung) dosyası yüklendiğinde sistem doğru URI'li bir VKZ 04
Korrekturrechnung üretiyor; VKZ 03 Zuzahlungsforderung akışı da bir kez yürütülmüş.

---

### 🟠 Adım 1.7 — `kind` ÜÇ değerli olsun (test / erprobung / echt)

**v1 hatası:** "test ↔ echt" ikili anahtarı tarif ediyordum. `kind` **üç** değer alıyor ve
**Faz 2.3 (Erprobung) tam olarak ortadakine ihtiyaç duyuyor** — ikili anahtar Erprobung'u
imkânsız kılar.

| Faz | UNB Testindikator | Physikalischer Dateiname |
|---|---|---|
| Testverfahren | `0` | `TSOL0nnn` |
| **Erprobung** | `1` | **`TSOL0nnn`** ← `T` kalır! |
| Echtbetrieb | `2` | `ESOL0nnn` |

> ⚠️ **Erprobung'da dosya adı `T` kalır.** Sezgiye aykırı; birinin "gerçek veri gönderiyoruz,
> E yapalım" demesi çok muhtemel. `filename.js:73` ve `auftragsdatei.js:142` bunu **zaten doğru
> yapıyor** — planda yazılı olsun ki kimse "düzeltmeye" kalkmasın.

Varsayılan **`test`** kalır.

> ✅ **`onprem` kararı (O-117): DB alanı, env var DEĞİL.** Env iki yerden birden kırılır —
> SaaS çok kiracılı (tek env **bütün** tenant'ları çevirir, Zulassung'suz praxis `echt` üretir),
> kutuda ise env'i değiştirmek `.env` düzenleyip konteyner yeniden yaratmak demek: müşteri yapmaz,
> biz giremeyiz (K10).
>
> **Per-tenant DB alanı, varsayılan `'test'`, ve anahtarı `owner` kendi arayüzünden çevirir**
> (Zulassung referansı + tarih + kim/ne zaman kaydıyla). ⚠️ Planın "biz tenant'ı echt'e alırız"
> örtük varsayımı **kutuda çalışmaz** — oraya giremiyoruz.
> Alan yeri `db-ustasi`'nın (aday: `terapeut_zertifikat`, zaten owner+IK taşıyor).
> ⛔ `praxura_setup` kullanılmaz (kutu-özel, SaaS'ta karşılığı yok → G7).
>
> ⚠️ **`gkv-302`'ye eksen sorusu:** Zulassung **praxis başına mı, praxis × Datenannahmestelle
> başına mı?** İkincisiyse tek boolean yanlış olur.

**Bitti ölçütü:** Üç mod da seçilebiliyor; Zulassung almamış tenant hiçbir şekilde `echt` dosya
üretemiyor; geçiş kod değişikliği gerektirmiyor; **owner kutuda kendisi çevirebiliyor.**

---

### 🟡 Adım 1.8 — Gelir kapısını açan küçük düzeltme: ICD **veya** Diagnosetext

**`gkv-302`: bugün doğrudan gelir kaybı var.** Spec (Kap. 5.5.3.3 S.72):
*"Ist im Feld 'ICD-10-Code' kein ICD-10-Code eingetragen, **ist der Diagnosetext anzugeben**."*
Yani ICD'siz reçete spec'te öngörülmüş.

Ama `preflight.js:261` geçerli bir ICD'yi **zorunlu** kılıyor (`V:01002`) → **ICD'siz gelen bir
reçete bugün hiç faturalanamıyor.** `builder.js:221-224`'te ICD'siz dal zaten doğru yazılmış,
ona ulaşan yol kapalı.

Ve mapper'lar `diagnosetext`'i hiç beslemiyor (`grep diagnosetext api-backend/billing/api/` → 0),
yani (1)'i açsak bile boş bir Muss-Segment (`DIA'`) üretilir → Prüfstufe 2'de **tüm dosya reddi.**

**İkisi birlikte çözülecek:** mapper `diagnose_freitext` → `verordnung.diagnosetext`; preflight
kuralı "ICD **veya** Diagnosetext, ikisi de yoksa hata".

---

### 🟡 Adım 1.9 — Sessiz tuzaklar (küçük, her biri gerçek)

| # | Ne | Nerede | Neden önemli |
|---|---|---|---|
| a | `davIk`/`kassenart` builder'a geçirilmiyor → "DAS × Kassenart başına bir dosya" kontrolü **etkisiz** | Üç create route; `builder.js:383-401` kontrolü yazmış ama besleme yok. `POST /abrechnung/annahmestellen:448` zaten hesaplıyor | Kullanıcı iki kasayı tek seferde seçtiği anda tek dosyada iki DAS → Prüfstufe 1'de tüm dosya reddi |
| b | `Rechnungsart '1'` sabit | `abrechnung.routes.js` ~702, ~2781, ~3216 | Kap. 5.3.2: sertifika-IK ≠ ödeme-IK ise Rechnungsart 1 **kullanılamaz**, 2 olmalı. Bu tam olarak hedef kitlemiz (çok IK'lı interdisipliner praxis). En azından **farklıysa üretimi reddet** |
| c | `podoFixture` spec'e aykırı | `dta/fixtures.js:116-117` (`heilmittelBereich:'5'`, `therapiefrequenz:'1'`) | Golden dosya **yanlış bir çıktıyı "doğru" diye donduruyor**. Üretim mapper'ı bozulsa golden test **yeşil kalır**. → `'2'`/`'0'` + golden yeniden üret |
| d | Alan uzunluğu denetimi yok | `preflight.js` yalnız 4 alanda bakıyor | `business_name` 30 karakteri aştığı anda Prüfstufe 2'de **tüm dosya** reddedilir — kullanıcı verisinden gelen, bugün yakalanamayan ret |
| e | ZAA parser'da aynı sınıf hata bir seviye aşağıda | `zaa/parser.js:41` — `raw.split('+')` kaçış-duyarsız | `d8249d6` segment ayırmayı düzeltti, **alan** ayırma hâlâ naif. `felderTrennen()` yazılıp iki yerde kullanılsın |
| f | `application/pkcs7-mime` bucket allowlist'inde yok | `abrechnung.routes.js:1002`; bucket `allowed_mime_types = {octet-stream, text/html, pdf}` | İmza yüklemesi 500 verir. **Sessiz değil** (`if (up.error) return res.status(500)`), ama şifreleme de aynı duvara çarpar. Üç boyut limiti de hizasız: express 15 MB / route 20 MB / bucket 10 MB |
| g | Sertifika metadatası `UPDATE`, satır yoksa 0 satır etkilenir | `abrechnung.routes.js:1007-1015` | İmza başarılı görünür, metadata sessizce kaydedilmez. `upsert` olmalı |

---

### 🔴 Adım 1.9b — Kostenträger/Annahmestellen verisi bayat (O-118) — Faz 2.2'DEN ÖNCE

Dosyanın **kime** gideceği `kostentraeger_annahmestellen`'den çözülüyor. Kutudaki kopya
`0007_seed_kostentraeger_annahmestellen.sql`, kaynağı `BN050526_KE0.txt` — **Mayıs 2026'da
dondu.** Yeni sürümü kutuya taşıyan bir mekanizma yok, hatırlatan kapı da yok (O-79'un kapısı
yalnız `billing/codes/*_positions.js`'i izliyor).

**Bayat liste = ya yanlış alıcıya giden dosya** (Echtbetrieb'te kayıp para) **ya da
`ladeAnnahmestelle()`'nin sessiz blokajı.**

⚠️ **Faz 2.2'den (Testverfahren) önce kapanmalı** — bayat alıcı listesiyle girilen bir test,
testin kendisini geçersiz kılar.

---

### 🟠 Adım 1.9c — Preflight'ın sert `throw`'u sınıflandırılsın (O-113)

`pruefeDatenstrom()` ve preflight kuralları artık sert `throw` ediyor — **doğru tasarım**, ama
kural kümesi image ile gidiyor: **yanlış tek bir kural, o kuralın kapsadığı HER müşterinin
abrechnung'unu durdurur.** SaaS'ta 60 saniyede kapanır (Watchtower); kutuda en iyi ihtimalle
ertesi gece, `:stable`'da günler sonra, GHCR'ye çıkamayan kutuda hiç — **ve biz bunu göremeyiz**
(O-46, telemetri yok).

Bu varsayım değil: `c4332d5` tam bu sınıftı (gelecek tarihli tek bir Behandlung tüm dosyayı
reddettiriyordu).

**İstenen:** sert/uyarı kural sınıflaması (**sert listeye kural eklemek `gkv-302` onayına tabi**)
+ hızlandırılmış yama yolunun belgelenmesi. **Adım 1.3 ve 1.5'ten ÖNCE kararlaştırılmalı** —
ikisi de yeni kural ekliyor (`V:01014` bu turda geldi).

---

### 🟠 Adım 1.9d — Kutuda bozuk satırın onarım yolu yok (O-114)

19.09'daki iki gelecek tarihli satır canlıda `db-ustasi` tarafından SQL ile silindi.
**Kutuda o yol yok** (K10): satırı kaldıran ekran yok, uzaktan SQL kanalı **bilinçli olarak** yok.
`c4332d5`'in önlemesi yalnız **yeni** satırlar için.

→ **Adım 1.5 (Storno) SaaS'ta ertelenebilir, kutuda ertelenemez.** Asgari yeterli hâli:
`invoice_id IS NULL` olan bir satırı **owner'ın kendisi** kaldırabilsin (K3'e uygun biçimde:
Storno, DELETE değil).

---

### 🟡 Adım 1.10 — Übermittlungsdokumentation (yasal, 2 yıl)

Anlage 1 Kap. 3(2): *"Über den Datenaustausch ist eine Dokumentation zu führen… mindestens
**2 Jahre** aufzubewahren… **alle Schritte von der Initiierung bis ggf. zur Quittierung**."*
Anhang 1 §4.5(2) asgari **10 alan** sayıyor (physikalischer Dateiname, Erstellungsdatum, lfd. Nr.,
Kommunikationspartner, Beginn/Ende, Dateigröße, Verarbeitungshinweise, Senden/Empfangen,
Verarbeitungskennzeichen, Fehlerstatus).

**Gönderim adımı eklenirken aynı anda kaydedilmeli — sonradan geriye dönük üretilemez.**
`db-ustasi`'ya sor: yeni tablo mu, mevcut kolonlar mı. On-prem'de bu defter **müşterinin
kutusunda** tutulmalı.

Ek: Kap. 3(4) — *"Eine **Sicherungskopie** der Daten ist durch den Absender **bis zur Bezahlung**
vorzuhalten"*. On-prem'de müşterinin yedekleme politikasına bağlanıyor → `onprem` ile ele alınsın.

---

### 🟡 Adım 1.11 — `guvenlik`'in ek maddeleri

| # | Ne |
|---|---|
| Ö1 | **Her aşamanın SHA-256'sı DB'ye.** Bugün hiçbir yerde dosya hash'i yok; altı ay sonra "gönderilen dosya bu muydu" sorusuna cevap veremezsin. Hash PHI değil, maliyeti sıfır |
| Ö3 | **Şifreleme/gönderim ucu `owner`-only olmalı.** Bugün `upload-signed` ve `dta-bytes` çalışanı owner'ın mandantına çözüp geçiriyor, rol ayrımı yok. Kasaya dosya göndermek Inhaber işidir |
| Ö5 | **Log kuralı:** imza/şifreleme yollarında dosya içeriği, base64 payload veya PIN **hiçbir koşulda** loglanmaz |
| Ö7 | Faz 3 ekranına **alıcı sertifikasının** geçerlilik sonu + fingerprint'i de girsin (V4/V5'in kullanıcı yüzü) |

---

> **⛓️ Şema değişikliği yaparsan (Adım 1.1, 1.2, 1.5, 1.7, 1.10 muhtemel):** sıra bağlayıcıdır —
> (1) `api-backend/db/migrations/NNNN_ad.sql`, (2) **aynı commit'te** `db/SCHEMA.sql` +
> `SCHEMA-RLS.sql` dökümü, (3) canlıya MCP ile uygula. Kapı var (`tools/check-onprem.sh`).
> `db-ustasi`'ya sormadan tablo/kolon açma.

---

## 3. Faz 2 — Dış / idari (Kemal yapar, kodla çözülmez)

> **v1'in sırası yanlıştı, `gkv-302` düzeltti.** Testverfahren **opsiyonel**, Erprobung
> **zorunlu** ve "jederzeit" başlanabilir — 2.2'yi beklemez. Zulassung'u **Krankenkasse** verir,
> Datenannahmestelle değil.

| # | Ne | Kim | Zorunlu mu | UNB 0035 | Ne alınır |
|---|---|---|---|---|---|
| 2.1 | Datenannahmestelle ile mutabakat + randevu | **Praxura** (Softwarehersteller) | Testverfahren için şart | — | Randevu + teknik irtibat |
| 2.2 | **Testverfahren** — Prüfstufe 1-3 | Praxura | **Opsiyonel**, şiddetle önerilir | `0` | DAS'tan yazılı test sonucu. Ödeme tetiklemez |
| 2.3 | **Erprobungsverfahren** | **Praxis**, kendi IK'sıyla | **Zorunlu** · "jederzeit" başlanabilir | `1` | — |
| 2.4 | **Zulassung zum Echtverfahren** | **Krankenkasse** verir | — | sonra `2` | Yazılı izin. Ancak bundan sonra `kind='echt'` |

**2.1 randevusunda sorulacaklar:**
- Auftragsdatei'nin tam beklenen biçimi nedir?
- Şifrelemeyi portal mı yapıyor, biz mi?
- **Alıcı sertifikasının fingerprint'ini nereden/hangi kanaldan yayımlıyorsunuz, değiştiğinde
  nasıl haber veriyorsunuz?** (V5'in çalışması için doğrulanabilir bir kaynak şart)
- Test dosyası hangi kanaldan gönderiliyor?
- **"Softwarehersteller-Test hangi IK altında koşuyor — bize Test-IK mı veriliyor, yoksa bir
  Praxis-IK'sı mı gerekiyor?"** (İkincisi ise praxis kendi tıklamak zorunda — S-29/17.09 kararı)
- Erprobung (Testindikator `1`) ödeme tetikliyor mu? (Spec yalnız Testverfahren için "tetiklemez"
  diyor, Erprobung için sessiz)
- Logischer Dateiname'deki "Abrechnungsmonat" hizmet ayı mı, oluşturma ayı mı? (Kod oluşturma
  ayını kullanıyor, spec açık yazmıyor)

⛔ **Prüfstufe 1/2/3 testleri sentetik veriyle yapılır** (`guvenlik` sert veto). Erprobung
spec gereği gerçek veriyle yapılır ve o meşrudur — ama müşterinin AVV/Vollmacht durumu
netleşmeden test kanalına gerçek veri gitmez.

---

## 4. Faz 3 — Müşterinin kendi yükümlülüğü

| # | Ne | Not |
|---|---|---|
| 3.1 | Praxis kendi **ITSG sertifikasını** alır | Ücretli, praxis adına. Canlıda 3 praxis IK girmiş, **üçünün de** `cert_subject`/`cert_thumbprint` boş — hiçbiri gerçek sertifika yüklememiş. **Yılda bir yenilenir** |
| 3.2 | DAS'a **Kommunikationspartner** kaydı | Prüfstufe 1 kriteri: kayıtlı olmayan göndericinin dosyası okunmadan reddedilir |

**Ürün tarafında gereken (bugün yok):** Bu iki adımı anlatan ve durumunu gösteren bir ekran —
"Sertifikanız yüklü değil, §302 gönderemezsiniz", adım adım ne yapması gerektiği, sertifika
bitişine 30 gün kala uyarı (V4), ve alıcı sertifikasının durumu (Ö7).

> ✅ **`onprem` (O-120): bugünkü tasarım iki dağıtımda da aynen kalabilir.**
> `terapeut_zertifikat`'ta anahtar/blob kolonu yok (doğrulandı), imzalama tarayıcıda,
> `node-forge` yerelleştirilmiş → kutuda internetsiz çalışır.
> ⛔ Kalıcı kısıt: anahtarı sunucuya alan tasarım **DUR** — kutuda "zaten müşterinin sunucusu"
> diye savunulur, SaaS'ta savunulamaz, sonuç **iki kod yolu** olur (G7).
>
> **Eksik:** `cert_valid_to` şemada duruyor ama süresi dolmadan uyaran hiçbir ekran yok —
> **kutuda bunu fark edecek ikinci bir insan yok.**
>
> 🎯 **Bu ekran tek ekrandır:** O-116'nın alıcı-sertifikası kapısı + O-120'nin süre uyarısı +
> O-117'nin `kind` anahtarı — üçü ayrı ekran değil, biri.

---

## 5. Hukuk / uyumluluk — paralel hat (hepsi 🟢 bedava, Faz 2.2'den önce)

`legal-de`'nin bulguları. Kod işlerinden bağımsız, paralel yürür.

| # | Ne | Nerede | Neden |
|---|---|---|---|
| 5.1 | **Canlı AVV'de §302 hiç geçmiyor** | `dpa.html` §2 — `302`/`EDIFACT` kelimesi sıfır kez | Art. 28 Abs. 3 S. 1 "Art und **Zweck**" ister. Metin `compliance/AVV.md:46`'da hazır, canlıya geçirilmemiş. Hazır madde metni `legal-de` raporunda |
| 5.2 | **AVV bir söz veriyor, kod tutmuyor** | `AVV.md:197`: "EDIFACT-Rohdateien 90 Tage nach DMRZ-Bestätigung" — kodda **hiç temizlik işi yok** | `.dta`/`.p7m` süresiz Storage'da; her dosyada o gönderimdeki **her hastanın** adı/KVNR/doğum tarihi/ICD'si var. Art. 5 Abs. 1 lit. e + Art. 28 Abs. 3 lit. e/g. Ayrıca "DMRZ" bir sağlayıcı adı → konumlandırmayla çelişiyor, "Datenannahmestelle" olmalı |
| 5.3 | **`dpa.html` ↔ `AVV.md` çelişiyor** | Datenpanne 72h vs 24h · Sentry yalnız birinde · Google yalnız diğerinde · SMTP hiçbirinde | Art. 28 Abs. 2/4. Bir müşteri DSB'si karşılaştırdığı anda ikisinin de güvenilirliği düşer. **24 saat doğru olan** |
| 5.4 | **AGB § 2(3) muhtemelen unwirksam** | `agb.html` | Tam Gewährleistungsausschluss gibi yazılmış → §307 Abs. 2 Nr. 2'ye açık. Düşerse **§536a Abs. 1 Alt. 1 BGB kusursuz garanti sorumluluğu** devreye girer (abonelik = Softwaremiete) ve bu hiçbir yerde dışlanmamış. `legal-de` hazır madde metni verdi: §2(3) Leistungsbeschreibung'a çevrilir + §2(4)(5) + §9(5) |
| 5.5 | `mark-sent` UI metni | "Einreichen/Senden" değil **"Als eingereicht markieren"** | Konumlandırmanın kullanıcının gördüğü yüzü. 5 dakika |
| 5.6 | Hesap silmeden önce Art.-15 export indirtme + log | `api/dsgvo.js` | Art. 28 Abs. 3 lit. g'nin *zurückgeben* bacağı; GoBD "Auslagerungspaket"in ucuz sürümü |
| 5.7 | K2'yi karar seviyesine çıkar | `LEGAL_DECISIONS.md` + playbook K-serisi | "Geri düşme tuzağı" sınıfı, K6/K10 kardeşi |

**Avukat turu** (tek seansta, 🟡 ~€250–450): AGB §2(3)-(5) Leistungsbeschreibung sayılır mı ·
§9(5) ile §536a Alt. 1 dışlaması B2B-AGB'de wirksam mı · §302 Abs. 2 S. 2 Rechenzentrum eşiği
(bizim değerlendirmemiz: aşmıyoruz, teyit) · §8(1)'deki %99 SLA taahhüdü tutulabilir mi.
`legal-de`: §9(5) maddesi tek başına bu harcamayı birkaç kat karşılar.

---

## 6. Bu planın dışında ama açık: `guvenlik` S-32

**DSGVO silme hiç Storage'a dokunmuyor.** `api/` klasörünün tamamında `supabase.storage`
**sıfır** geçiyor. Bir hesap silindiğinde `prescriptions` bucket'ındaki **98 reçete taraması**
(hasta adı, doğum tarihi, teşhis içeren fotoğraf/PDF), `patient-documents`, `abrechnungen` ve
`avatars` **yerinde kalıyor**.

"Yeni tablo → `api/dsgvo.js`" kuralının **bucket karşılığı hiç yazılmamış** ve bu yüzden düştü.
Bu §302 planının parçası değil — **ayrı ve açık bir uyumluluk açığı**, kendi kartını hak ediyor.

---

## 7. Doğrulanması gereken tek olgu (Kemal)

`legal-de`'nin "geriye dönük sorunumuz yok" hükmü **tek bir olguya** dayanıyor: canlıda **gerçek
bir hastanın gerçek bir tedavisi** hiç dokümante edilmedi mi?

Destekleyen kanıt: MEMORY (Kemal, 12.09.2026: tüm DB test verisi) + üç praxis'in de
`cert_subject` alanı boş + hiç dosya gönderilmemiş.

Hayır ise hüküm aynen durur. **Evet ise karar değişmez ama gerekçesi değişir** — ihlal praxis'in
olur, bizim maruziyetimiz Art. 28 Abs. 3 lit. c'ye kayar. Her hâlükârda **Art. 33 bildirimi
doğmaz, LDI NRW'ye gidilmez.**

Kontrol: `SELECT count(*) FROM podologie_behandlungen` + satırların test hastalarına mı ait
olduğu.

---

## 8. Sıralama (bir bakışta)

```
ŞİMDİ, paralel:
  2.1 DAS randevusu (Kemal)        ← EN ERKEN başlat, beklemesi var, kodu beklemez
  0.5 wissensbank → GGT Anlage 16  ← 1.3 bu belge olmadan başlamaz
  5.1–5.7 hukuk hattı              ← bedava, kod işlerinden bağımsız
  7.  Kemal: gerçek hasta verisi var mı?

Faz 1 kod, önerilen sıra:
  1.1 Auftragsdatei kaydet   ──┐
  1.2 İki kalıcı sayaç         ├─→ hepsi Faz 2.2'nin ön koşulu
  1.4 Kâğıt yol (Begleitzettel)│
  1.5 Storno (hukuki zorunlu)  │
  1.3 Şifreleme  ──────────────┘   ← Anlage 16 + guvenlik V1-V8 olmadan başlama
  1.7 kind üç değerli          ←   Faz 2.3 buna muhtaç
  1.6 Korrekturverfahren testi ←   Faz 2.3'ten önce
  1.8 ICD veya Diagnosetext    ←   gelir kapısı, küçük
  1.9 Sessiz tuzaklar (a-g)
  1.10 Übermittlungsdokumentation ← gönderim eklenirken AYNI anda
  1.11 guvenlik Ö1/Ö3/Ö5/Ö7

Faz 2:  2.1 → (2.2 opsiyonel) → 2.3 Erprobung → 2.4 Zulassung → ancak sonra kind='echt'
Faz 3:  müşteri sertifikası — 2.3'ten önce en az bir praxis'te tamam olmalı
```

**Kritik yol:** 2.1 randevusu → 1.1 + 1.2 + 1.3 + 1.4 → **2.3** → 2.4.
(v1'de 2.2'yi zorunlu sanmıştım; opsiyonel olduğu için kritik yol daha kısa.)

---

## 9. Uyulacak proje kuralları

- **`dashboard.js` BÜYÜMEZ** — yeni frontend kodu `module/<alan>.js`'e. Pre-commit kapısı var.
- **Şema değişikliği:** önce migration dosyası, aynı commit'te döküm, sonra canlı.
  `db-ustasi`'ya sormadan tablo/kolon açma.
- **`fonksiyon-ustasi`:** yeni fonksiyon yazmadan ÖNCE sor, yazdıktan SONRA "niye + nerede"
  bildir. İzin gerektirmez, iş akışının parçası.
- **`onprem`:** dış çağrı · şema · env var · **zamanlanmış iş** · sabit adres · yetki kontrolü
  yazılmadan ÖNCE sor. (5.2'deki Storage temizliği zamanlanmış iştir → G1/G2 kapsamında.)
- **Doğrudan `main`'e commit**, feature branch açma. Her adım tek başına bitirilir — yarım iş
  push'lanmaz, push anında canlıya gider.
- **`git push` ana context'te ve ön planda** — subagent'ta Credential Manager çalışmıyor.
- **G8:** yeni Vercel fonksiyonu yok, yeni n8n workflow'u yok, yeni üçüncü-parti CDN yok.
- **Her adımdan sonra `canli-test`.** Lokal test yetmiyor — 19.09 gecesi bunun üç örneği yaşandı,
  üç bug yalnız canlı akışta ortaya çıktı.

---

## 10. Ajan onayları (Faz 0 — TAMAMLANDI 20.09.2026)

| Ajan | Hüküm |
|---|---|
| `gkv-302` | ✅ **ONAYLANDI.** 7 format düzeltmesi spec'e karşı tek tek doğrulandı, canlı çıktı segment segment denetlendi, 88 test yeşil. Planda 11 eksik/düzeltme bildirdi — hepsi bu sürüme işlendi. `wissensbank/SPEC-RULES.md`'ye 11 yeni kural önerdi |
| `guvenlik` | ✅ Kısıtlar verildi (V1–V8, Ö1–Ö8), sicile S-31 + S-32 yazıldı. K1 kararı onun. Beş sert veto konusu netleştirildi |
| `legal-de` | ✅ K3 ve K4 karara bağlandı, 7 uyumluluk maddesi (§5) çıkarıldı, `LEGAL_DECISIONS.md` için hazır satırlar verildi |
| `onprem` | ✅ Sicile geçti (**O-112 … O-120**, toplam 120). **Veto yok**, bir sert kısıt (K6/O-119: merkezden proxy yasak) ve bir dönüşüm şartı (O-116: sertifikanın kutuya ulaşması). Planda eksik 4 madde bildirdi — hepsi işlendi. Turun kendisi `unkritisch`: yeni env/dış çağrı/sabit adres/cron/migration **sıfır**, `tools/check-onprem.sh` exit 0 |

**Kalan Faz 0 işi:** `wissensbank` → GGT Anlage 16 (SECON) indirilsin.

### `onprem`'in sicil dışı acil bulgusu — ✅ KAPATILDI 20.09.2026

Depo kökündeki `gitignore/` klasörü (gerçek beta müşteri DTA'sı + Begleitzettel) **`.gitignore`'da
değildi.** `.dta` ve `.txt` hiç ignore edilmiyordu (PDF yalnız tesadüfen, genel bir `*.pdf`
kuralıyla). DTA'nın NAD segmenti gerçek bir hastanın **adını, adresini ve tanısını** taşıyor ve
depo **public** — tek bir `git add -A` onu yayına basardı. `.gitignore`'a `gitignore/` satırı
eklendi, üç dosya da doğrulandı.

---

*v2, 2026-09-20. Dört ajan denetimi sonrası. Uygulamaya başlamadan önce her adımın "Durum"
satırını koda karşı bir kez daha kontrol et — bu depoda notlar eskiyebiliyor, kod eskimiyor.*
