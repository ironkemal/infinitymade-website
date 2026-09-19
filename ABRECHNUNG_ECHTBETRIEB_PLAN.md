# §302 Echtbetrieb — Gerçek gönderime geçiş planı

> **Bu dosya ne:** "Müşteri gerçekten kasaya fatura gönderip para alabilsin" hedefine
> giden yolun adım adım planı. Bir sonraki oturumda (Sonnet) doğrudan açılıp uygulanmak
> üzere yazıldı — her adım kendi başına anlaşılır, her adımın "bitti" ölçütü var.
>
> **Oluşturuldu:** 2026-09-20 (Opus) · **Durum:** Faz 0 onayları bekliyor
> **Öncülü:** `ONPREM_MIGRATION_PLAYBOOK.md` (aynı biçim), `wissensbank/SPEC-RULES.md` (kural kaynağı)

---

## 0. Bu planı okuyan Sonnet için: nerede duruyoruz

19–20.09.2026 gecesi §302 **dosya formatı** uçtan uca düzeltildi ve canlıda doğrulandı.
Üretilen DTA dosyası artık Anlage 1/3 TP5 V21'e uygun. Düzeltilenler (hepsi push'landı,
hepsi canlı Podologie Nord hesabında gerçek dosya üretilerek doğrulandı):

| Ne | Commit |
|---|---|
| GES Summenstatus geçersiz değer üretiyordu (`01` → `11/31/51/99`) | `1c93760` |
| UNT/UNZ sayaçları 6 hane sıfır dolgulu değildi | `1c93760` |
| Virgül serbest metinde kaçırılmıyordu (tutarları bozmadan) | `1c93760` |
| İki ICD kodu tek DIA alanına sıkıştırılıyordu → ayrı segmentler | `1c93760` |
| Podolojide Therapiefrequenz `0` olmalıyken gerçek frekans gidiyordu | `1c93760` |
| Hasta adresi NAD'a hiç yazılmıyordu | `1c93760` |
| Gereksiz `UNA` segmenti kaldırıldı | `1c93760` |
| ZAA parser kaçış-duyarsız `split("'")` kullanıyordu | `d8249d6` |
| Muster-13'te ikinci ICD alanı yoktu (çoklu-DIA erişilemezdi) | `50f45f9` |
| Preflight hata gerekçesi ekranda görünmüyordu | `4c3ce6e` |
| İki ICD'li reçetede yanlış "ICD eksik" + atlanan ICD⇄DG kontrolü | `272d980` |
| Gelecek tarihli Behandlung tüm dosyayı reddettiriyordu | `c4332d5` |
| Kayıtlı seanslar kaydedildikleri ekranda görünmüyordu | `1201618` |

**Ama dosya doğru formatta olmak, gönderilebilir olmak demek değil.** Bugün hiçbir müşteri
gerçek bir §302 dosyasını kasaya gönderip para alamaz. Bu planın konusu o boşluk.

### ⚠️ Eskimiş bilgiye dikkat

Hafızada ve eski notlarda **"Auftragsdatei üretilmiyor"** yazıyor — **bu artık YANLIŞ.**
`api-backend/billing/dta/auftragsdatei.js` 17.09.2026'da yazıldı (Konsey kararı), testleri
var, `buildDtaFile()` onu üretip döndürüyor. Gerçek eksik çok daha küçük: **route onu
hiç almıyor, kaydetmiyor** (bkz. Adım 1.1).

Bu planı uygularken aynı dersi uygula: **hafızaya ve ajan iddiasına değil, koda bak.**
Bu plandaki her "eksik" maddesi 20.09.2026'da kodda doğrulandı; yine de dokunmadan önce
ilgili dosyayı aç ve hâlâ öyle mi diye bak.

---

## Faz 0 — Ajan onayları (ÖNCE BU, ucuz ve hızlı)

19.09 gecesi dört ajan da oturum limitine takıldı, onaylar alınamadı. Kodun kendisi
doğrulandı (ana oturumda diff'ler elle okundu, testler geçti, canlıda çalıştığı görüldü)
ama **uzman onayı eksik.** Sonraki oturumda ilk iş bunlar — her biri kısa.

| # | Ajan | Ne soracak | Neden önce |
|---|---|---|---|
| 0.1 | `gkv-302` | (a) Yukarıdaki 13 düzeltmeyi bağımsız onayla (b) Bu plandaki eksik listesini spec'e karşı doğrula/tamamla | Plan onun alanına dayanıyor; yanlışsa Faz 1 boşa gider |
| 0.2 | `onprem` | 19.09 gecesi yapılan işi sicile geçir + Faz 1'in müşteri kutusunda ne yapacağını değerlendir | Adım 1.2 ve 1.3 şema/dağıtım etkisi taşıyor, onun vetosuna tabi |
| 0.3 | `guvenlik` | Adım 1.3'ün (şifreleme) tasarım kısıtları — anahtar nerede durur, PHI nereye yazılır | Şifreleme yazılmadan ÖNCE kısıt konmalı, sonradan değil |
| 0.4 | `legal-de` | Storno-mu-DELETE-mi (bkz. Açık Karar 1) + gerçek gönderimin hukuki önkoşulları | Açık Karar 1'i kapatır; Faz 2'yi bloke etmez, paralel gidebilir |

**Bitti ölçütü:** Dördünden de yazılı yanıt var; `gkv-302` "ONAYLANDI" veya gerekçeli
"ONAYLANMADI" demiş; `onprem` sicile işlemiş; `guvenlik` şifreleme için yazılı kısıt
vermiş; `legal-de` Storno/DELETE sorusunu karara bağlamış.

> ⚠️ Bu ajanlar Opus ile çalışıyor ve oturum limitine takılabiliyor. Takılırsa: bekle ve
> tekrar dene, **kendi başına karar verip geçme.** Onların alanı senin alanın değil.

---

## Faz 1 — Kod işleri (bizim elimizde)

Sıra bağlayıcı değil ama 1.1 → 1.2 → 1.3 mantıklı (küçükten büyüğe, riski artan).

### Adım 1.1 — Auftragsdatei kaydedilsin ve indirilebilsin ⭐ küçük, hemen yapılabilir

**Durum (20.09.2026'da doğrulandı):** `buildDtaFile()` Auftragsdatei'yi üretiyor ve
dönüş nesnesinde `auftragsdatei` alanı olarak veriyor (`dta/builder.js:625-638`). Ama
üç create route'unun (`abrechnung.routes.js`, satır ~694 / ~2778 / ~3211) hiçbiri bu
alanı almıyor — `grep -n "uftragsdatei" api-backend/billing/api/` **sıfır sonuç.**
Yani üretilip çöpe atılıyor.

Spec: Anhang 2 zur Anlage 1 TP5, Kap. 9 §3.1 — Nutzdatendatei asla tek başına gitmez,
dosyalar **"paarweise"** (çift) ulaşmak zorundadır. Bu Prüfstufe 1 kriteridir; eksikse
dosya daha içeriğe bakılmadan reddedilir.

**Yapılacak:**
1. Üç create route'unda `dta.auftragsdatei`'yi al, `.dta` dosyasının yanına yükle
   (mevcut desen: `supabase.storage.from('abrechnungen').upload(dtaPath, ...)`,
   satır ~791 / ~2849 / ~3255). Dosya adı kuralını `dta/filename.js` ve
   `auftragsdatei.js` başlığından doğrula — uydurma.
2. `abrechnungen` tablosuna yolu yazacak bir kolon gerekiyor mu bak: bugün
   `storage_path`, `begleitzettel_path`, `signed_storage_path` var. Yeni kolon
   gerekiyorsa **şema değişikliği protokolü** geçerli (bkz. aşağıdaki kutu).
3. İndirme ucu: mevcut `.dta` indirme route'unun (satır ~933) yanına Auftragsdatei
   indirmesi ekle, ya da ikisini birlikte veren bir uç. Frontend'de indirme düğmesi
   (`module/abrechnung-detail.js`) buna göre güncellensin.

**Bitti ölçütü:** Bir Abrechnung oluşturulduğunda Storage'da `.dta` **ve** Auftragsdatei
yan yana duruyor; kullanıcı ikisini de indirebiliyor; `node --test` yeşil; `canli-test`
ajanı canlıda bir Abrechnung üretip iki dosyayı da indirebildiğini doğruluyor.

> **⛓️ Şema değişikliği yaparsan (yeni kolon):** sıra bağlayıcıdır —
> (1) `api-backend/db/migrations/NNNN_ad.sql` yaz, (2) aynı commit'te `db/SCHEMA.sql` +
> `SCHEMA-RLS.sql` dökümünü tazele, (3) canlıya MCP ile uygula. Kapı var
> (`tools/check-onprem.sh`). Detay: `CLAUDE.md` → "Şema değişikliği artık ÖNCE DOSYA".
> Ayrıca `db-ustasi`'ya sor (kolon mu yeter, var olan alan kullanılabilir mi).

---

### Adım 1.2 — Datenaustauschreferenz kalıcı sayaca bağlansın 🔶 orta, şema işi

**Durum (doğrulandı):** Üç route da `datennummer`'ı **sayarak** üretiyor:
`const datennummer = (weekCount || 0) + 1;` (satır ~685, ~2772, ~3205).

**Sorun:** Bir Abrechnung silinirse veya bir hafta içinde eşzamanlı iki oluşturma olursa
aynı numara iki kez üretilir. Kasa tarafında Datenaustauschreferenz **mükerrer teslimat**
tespitinde kullanılır — aynı numara ikinci kez gelirse dosya reddedilir ("bereits
eingereicht"), ve bu ret dosyanın içeriğiyle ilgili olmadığı için teşhisi zordur.

**Yapılacak:**
1. `db-ustasi`'ya sor: bu iş için `nummernkreise` tablosu (zaten var, trigger'dan
   besleniyor) uygun mu, yoksa ayrı bir sayaç mı gerekir. **Ona sormadan tablo açma.**
2. Sayacı atomik hale getir (aynı anda iki istek gelse bile aynı numarayı vermesin —
   Postgres sequence ya da `UPDATE ... RETURNING` deseni).
3. Üç route da yeni sayacı kullansın; `COUNT(*)` tamamen kalksın.
4. **`onprem`'e sor:** aynı kod hem SaaS'ta hem müşteri kutusunda çalışacak. İki
   dağıtımda çakışan numara üretme riski var mı, sayaç kutuya nasıl gidiyor?

**Bitti ölçütü:** `grep -n "weekCount\|jahresCount" api-backend/billing/api/abrechnung.routes.js`
sıfır sonuç (ya da yalnız sayaç dışı kullanımlar); art arda iki Abrechnung farklı
Datenaustauschreferenz alıyor; biri silinip yenisi yapıldığında numara **geri gitmiyor**;
migration dosyası zincirde, döküm tazelenmiş.

---

### Adım 1.3 — CMS EnvelopedData şifrelemesi 🔴 en büyük, guvenlik onayı şart

**Durum (doğrulandı):**
- İmzalama **var**: tarayıcıda node-forge ile PKCS#7/CMS SignedData üretiliyor,
  `POST /abrechnung/:id/upload-signed` (satır ~957) ile alınıp `.p7m` olarak
  Storage'a yazılıyor (satır ~1000).
- Şifreleme **yok**: kodda hiçbir yerde EnvelopedData üretimi yok.
  `buildEncryptedFilename()` (`dta/filename.js:78`) hazır duruyor ama çağıran yok.
- Spec (GGT §5.1): **önce imzala, sonra alıcının açık anahtarıyla şifrele.**

**🔒 Korunması gereken mevcut kazanım — bunu bozma:**
`terapeut_zertifikat` tablosu **sadece metadata** tutuyor (`cert_subject`,
`cert_thumbprint`, `cert_serial`, `cert_valid_from/to`) — **özel anahtar ve sertifika
blob'u bizim sistemimize hiç girmiyor.** İmzalama kullanıcının kendi `.p12` dosyasıyla,
kendi tarayıcısında oluyor. Bu tesadüf değil, doğru tasarım: anahtar bize gelmediği
sürece sızdıramayız, §203 StGB ve sorumluluk açısından da lehimize. **Şifreleme
eklenirken bu bozulmamalı** — yani çözüm "özel anahtarı sunucuya alalım" olamaz.

**Yapılacak — ama önce KARAR (bkz. Açık Karar 2):**
1. `guvenlik`'ten yazılı kısıt al (Faz 0.3): şifreleme nerede çalışacak (tarayıcı mı
   backend mi), şifrelenmemiş ara ürün nerede ne kadar duracak.
2. `gkv-302`'den netleştir: hangi CMS profili, hangi algoritma, alıcının sertifikası
   **nereden** geliyor (ITSG Trust Center mı, Kostenträgerdatei mi, elle mi).
3. Uygula. Şifrelenmiş dosya adı `buildEncryptedFilename()` ile üretilsin (hazır).
4. Doğrulama: ürettiğin şifreli dosyanın gerçekten açılabildiğini **kendi** özel
   anahtarınla test et (round-trip testi), yoksa "şifreledim" demek anlamsız.

**Bitti ölçütü:** İmzalı + şifreli dosya üretiliyor; round-trip testi (şifrele → çöz →
orijinalle byte-byte aynı) otomatik testte; `guvenlik` tasarımı onaylamış; özel anahtar
hâlâ sunucuya hiç gelmiyor.

---

### Adım 1.4 — `kind` sabiti yapılandırılabilir olsun (ama `echt`'e ÇEVİRME) 🟢 küçük

**Durum:** Üç route'ta `kind: 'test'` sabit (satır 705, 2783, 3216).

**Yapılacak:** Değeri sabit olmaktan çıkar — ama **varsayılan `'test'` kalsın.**
`'echt'`'e geçiş bir kod satırı değil, Faz 2'nin sonunda kasadan alınan resmî
**"Zulassung zum Echtverfahren"** iznine bağlı. Yapılandırma per-tenant olmalı (bir
praxis Zulassung alırken diğeri almamış olabilir) — `db-ustasi` + `onprem`'e sor:
`profiles`'da bir alan mı, ayrı tablo mu, kutuda nasıl set ediliyor.

**Bitti ölçütü:** Zulassung alan bir praxis için `echt` moda geçmek **kod değişikliği
gerektirmiyor**; Zulassung almamış praxis hiçbir şekilde `echt` dosya üretemiyor
(varsayılan güvenli taraf).

> ⛔ **Bu adım tamamlansa bile hiçbir tenant `echt`'e alınmaz** — Faz 2.4 bitmeden.

---

### Adım 1.5 — Küçük kalemler (istendiğinde, blocker değil)

| Ne | Nerede | Not |
|---|---|---|
| `diagnose_freitext` DTA'ya hiç geçmiyor | `abrechnung.routes.js` mapper'ları — `grep -n "diagnosetext"` sıfır sonuç veriyor; `builder.js` DIA metin alanını destekliyor | Kann-Feld, ama kullanıcının girdiği veri sessizce kayboluyor |
| `podoFixture` gerçekçi değil | `dta/fixtures.js:116-117` — `heilmittelBereich:'5'` (podoloji `2` olmalı), `therapiefrequenz:'1'` (`0` olmalı) | Sadece birim test verisi, üretim yolu doğru; ama yanlış güven veriyor. `gkv-302`'ye sor (Faz 0.1'de soruldu) |
| Üç kopya: "hastanın tüm podo Behandlungen'i" | `podologie-abrechnung.js:219`, `verordnung-podo.js:823`, `podo-einheiten.js:243` | `fonksiyon-ustasi` buldu. Einmaligkeitssperre'yi besliyorlar — kurala istisna eklenince üçüne birden yazmak gerekir, biri unutulursa sperre sessizce açılır |

---

## Faz 2 — Dış / idari (Kemal yapar, kodla çözülmez)

Bu fazın hiçbir adımı yazılımla kısaltılamaz. Faz 1 ile **paralel** yürüyebilir —
hatta 2.1 mümkün olan en erken başlatılmalı, çünkü randevu beklemesi var.

| # | Ne | Kaynak | Bitti ölçütü |
|---|---|---|---|
| 2.1 | Bir Datenannahmestelle ile **Softwarehersteller-Test** randevusu al | Anhang 2 zur Anlage 1 TP5, Kap. 9 §1 | Randevu tarihi var, karşı tarafın teknik irtibatı belli |
| 2.2 | **Testverfahren** — Prüfstufe 1/2/3'ten hatasız geçiş | Anhang 2, §3.1–3.3 | DAS "test başarılı" yazılı bildirimi. Prüfstufe 1 = dosyalar çift geldi mi (Adım 1.1!), 2 = Feldart/Feldtyp/Feldlänge, 3 = Schlüsselausprägung |
| 2.3 | **Erprobungsverfahren** — UNB Testindikator `1` ile gerçek veri | Anhang 2, §6 | Kasa "zum Echtverfahren zugelassen" diyene kadar sürer |
| 2.4 | **Zulassung zum Echtverfahren** | Anhang 2, §6 | Yazılı izin elde. **Ancak bundan sonra** Adım 1.4'teki anahtar o tenant için `echt`'e çevrilir |

> **2.1 randevusunda mutlaka sorulacaklar** (10.09.2026'da not edilmişti, hâlâ geçerli):
> Auftragsdatei'nin tam beklenen biçimi nedir · şifrelemeyi portal mı yapıyor yoksa biz mi ·
> alıcı sertifikası nereden alınıyor ve ne sıklıkla değişiyor · test dosyası hangi kanaldan
> gönderiliyor.

---

## Faz 3 — Müşterinin kendi yükümlülüğü (biz yapamayız)

| # | Ne | Not |
|---|---|---|
| 3.1 | Praxis kendi **ITSG sertifikasını** alır | Ücretli, praxis adına, bizim adımıza değil. Bugün canlıda 3 praxis IK girmiş ama **üçünün de** `cert_subject`/`cert_thumbprint` alanı BOŞ — yani hiçbiri gerçek sertifika yüklememiş |
| 3.2 | DAS'a **Kommunikationspartner** kaydı yaptırır | Prüfstufe 1 kriteri: kayıtlı olmayan göndericinin dosyası okunmadan reddedilir |

**Ürün tarafında yapılacak:** Bu iki adımı müşteriye **anlatan ve durumunu gösteren**
bir ekran gerekiyor (bugün yok). "Sertifikanız yüklü değil, §302 gönderemezsiniz"
uyarısı, adım adım ne yapması gerektiği. Aksi halde müşteri neyi eksik bıraktığını
bilmez ve bizi arar.

---

## Açık kararlar (kapanmadan ilgili adım başlamaz)

### Açık Karar 1 — Dokümante edilmiş seans: DELETE mi Storno mu?

**Neden açık:** `podologie_behandlungen` satırında GoBD-Festschreibung trigger'ı **yok**
(sadece audit log var) — yani bugün RLS owner'a DELETE izni veriyor, kapı teknik olarak
açık ama koruma yazılmamış. `invoice_id` doluysa satır zaten bir faturada. Silmek
`behandlungsstart` türetmesini, Verordnung'un `abrechnung_status`'unu ve 78040/78100
einmaligkeit kurallarını etkiler.

**Kim karar verir:** `legal-de` (GoBD + §630f BGB dokümantasyon yükümlülüğü) +
`gkv-302` (faturaya girmiş kaydın statüsü) + `db-ustasi` (trigger/şema tarafı).
Faz 0.4'te soruldu, yanıt bekleniyor.

**Bu karar verilene kadar:** 19.09.2026'da eklenen ekran **sadece gösteriyor, silmiyor**
(`module/podologie-abrechnung.js`, "Bereits dokumentiert" bloğu). Devir paketi o bloğun
üstündeki yorumda. **Silme düğmesi eklemeden önce bu karar kapanmalı.**

### Açık Karar 2 — Şifreleme nerede çalışacak, alıcı sertifikası nereden gelecek?

**Seçenekler:** (a) tarayıcıda, imzayla aynı yerde — özel anahtar zaten orada, tutarlı
ama alıcı sertifikasının tarayıcıya inmesi gerekir; (b) backend'de — imzalı dosya zaten
sunucuya geliyor, şifreleme orada yapılabilir, ama şifrelenmemiş PHI sunucuda bir süre
durur.

**Alıcı sertifikası:** ITSG Trust Center'dan mı indirilecek (yeni dış bağımlılık → `onprem`
G1/G2 kapsamı), Kostenträgerdatei'den mi geliyor, yoksa elle mi yüklenecek?

**Kim karar verir:** `guvenlik` (veto hakkı var — PHI'yi yeni bir yere taşıyan karar) +
`gkv-302` (spec ne diyor) + `onprem` (kutuda internet kısıtlıysa ne olur).
Faz 0.3'te soruldu.

---

## Sıralama özeti (bir bakışta)

```
Faz 0 (ajan onayları)          ─┬─→ hepsi paralel, hepsi kısa
                                │
Faz 1.1 Auftragsdatei kaydet   ─┤   ← Prüfstufe 1 için ŞART, Faz 2.2'yi bloke eder
Faz 1.2 Kalıcı sayaç           ─┤   ← şema işi, onprem + db-ustasi onayı
Faz 1.4 kind yapılandırılabilir─┤   ← küçük
Faz 1.5 küçük kalemler         ─┘
                                │
Faz 1.3 Şifreleme              ───→ Açık Karar 2 kapanmadan BAŞLAMA
                                │
Faz 2.1 DAS randevusu (Kemal)  ───→ EN ERKEN başlat, beklemesi var, Faz 1'i beklemez
Faz 2.2 Testverfahren          ───→ 1.1 + 1.3 bitmeden anlamsız
Faz 2.3 Erprobung              ───→ 2.2'den sonra
Faz 2.4 Zulassung              ───→ ancak bundan SONRA kind='echt'
                                │
Faz 3 (müşteri: sertifika)     ───→ paralel, ama 2.2'den önce en az bir praxis'te tamam olmalı
```

**Kritik yol:** 2.1 randevusu → 1.1 + 1.3 → 2.2 → 2.3 → 2.4. Gerisi bunu bekletmez.

---

## Bu planı uygularken uyulacak proje kuralları

- **`dashboard.js` BÜYÜMEZ** — yeni frontend kodu `module/<alan>.js`'e. Pre-commit kapısı var.
- **Şema değişikliği:** önce `api-backend/db/migrations/` dosyası, aynı commit'te döküm
  tazelemesi, sonra canlı. `db-ustasi`'ya sormadan tablo/kolon açma.
- **`fonksiyon-ustasi`:** yeni fonksiyon yazmadan ÖNCE sor, yazdıktan SONRA "niye + nerede"
  bildir. Bu izin gerektirmez, iş akışının parçası.
- **`onprem`:** dış çağrı · şema · env var · zamanlanmış iş · sabit adres · yetki kontrolü
  yazılmadan ÖNCE sor.
- **Doğrudan `main`'e commit**, feature branch açma. Her adım tek başına bitirilir —
  yarım iş push'lanmaz, çünkü push anında canlıya gider.
- **`git push` ana context'te ve ön planda** — subagent'ta Windows Credential Manager
  çalışmıyor.
- **G8:** yeni Vercel fonksiyonu yok, yeni n8n workflow'u yok, yeni üçüncü-parti CDN yok.
  Yeni HTTP ucu gerekiyorsa `api-backend/server.js`'e.
- **Her adımdan sonra `canli-test`** ile canlıda doğrula — lokal test yeterli değil,
  bu gece bunun tam üç örneği yaşandı (üç bug sadece canlı akışta ortaya çıktı).

---

*Bu plan 20.09.2026'da mevcut koda karşı doğrulanarak yazıldı. Uygulamaya başlamadan önce
her adımın "Durum" satırını koda karşı bir kez daha kontrol et — bu depoda hafıza ve
notlar eskiyebiliyor, kod eskimiyor.*
