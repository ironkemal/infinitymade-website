# §302 Değerlendirme — Bozuk seans verisi temizliği + iki §302 çıkışı
Tarih: 2026-08-12 · Spesifikasyon: Anlage 1 TP5 V21 (Stand 15.01.2026) / Anlage 3 TP5 V21 /
Gemeinsame Umsetzungsempfehlungen zum Korrekturverfahren Heilmittel (13.02.2025, anzuwenden ab 01.10.2025) /
Anhang 04c Anlage 1 TP5 (24.09.2025)
Leistungserbringergruppe: Physio · Ergo · Logopädie (`prescriptions` + `prescription_sessions` havuzu).
Podologie (`verordnungen` + `podologie_behandlungen`) bu bulgudan **etkilenmiyor** — ayrı havuz, ayrı kod yolu.

## Özet

Soru 1: Temizlik yapılabilir, ama **tek bir migration ile değil — iki sınıfa ayrılarak.** Henüz hiçbir
Abrechnung'a girmemiş reçetelerin fazla/yetim seans satırları silinebilir; bunlar hiçbir zaman
"rechnungsbegründende Unterlage" olmadı. Buna karşılık `abrechnung_id` dolu veya
`abrechnung_status IN ('in_abrechnung','gesendet','accepted','paid')` olan reçetelerin seansları
**silinmez** — çünkü gönderilen DTA dosyasının satırları birebir bu satırlardan üretildi; silinirse
depodaki DTA dosyası ile veritabanı bir daha uzlaştırılamaz ve kasanın Kontrollrecht'i (Anhang 04c
Ziff. 7) karşılanamaz. Orada tek doğru yol `status='cancelled'` + `notes` ile annüle işaretlemek.

Kasaya fazla tutar gitmişse: **§302'de storno/Gutschrift diye bir DTA yolu yok.** Korrekturverfahren
yalnızca eksik/ödenmemiş tutarları geri getirir (VKZ 02/04). Fazla faturalama açıkça Korrekturverfahren
kapsamı **dışında** bırakılmış ve kasaya **bildirim yükümlülüğü** getirilmiş; düzeltme kasanın
Rechnungskürzung'u ile olur.

Soru 2: İki §302 çıkışı **bilinçli bir mimari değil.** `downloadDmrzForInvoice` gerçek bir DMRZ/§302
arayüzü üretmiyor; kendi uydurduğumuz bir XML namespace'i üretiyor (`https://infinitymade.de/dmrz/v1`,
`format="§302-vereinfacht-v1"`). Bu dosya hiçbir Datenannahmestelle'ye ve hiçbir Abrechnungszentrum'a
girmez. Yani **çift ödeme talebi riski bugün yok**; asıl risk tersi — kullanıcı "abgerechnet" yazısını
görüp gerçek DTA'yı hiç göndermiyor, para gelmiyor.

---

## Bulgular

| # | Konu | Kaynak (belge + bölüm) | Etki | Durum |
|---|---|---|---|---|
| 1 | Faturalanmış reçetenin seans satırı silinemez | Anhang 04c Ziff. 2.2 + Ziff. 7 (Kontrollrecht) | Kasa denetiminde belge uzlaştırılamaz | Açık |
| 2 | Fazla faturalama Korrekturverfahren'e dahil değil, bildirim şart | Umsetzungsempfehlungen Korrekturverfahren, Frage 5 | Bildirilmezse Rückforderung + Auffälligkeit | Açık |
| 3 | Yetim boş slot reçeteyi `bereit`e hiç geçirmiyor | kod: `dashboard.js:7571-7588` | **Sessiz gelir kaybı** (fatura hiç oluşmuyor) | Açık |
| 4 | Aynı `booking_id`'ye bağlı çift satır → aynı gün çift pozisyon | kod: `api-backend/billing/api/abrechnung.routes.js:200-206` | Doppelabrechnung → Absetzung | Açık |
| 5 | `cancelled` satır `openCount`'ta hâlâ "açık" sayılıyor | kod: `dashboard.js:7574-7577` | Soft-delete uygulanırsa reçete kilitlenir | Açık |
| 6 | `downloadDmrzForInvoice` §302 formatı üretmiyor | kod: `dashboard.js:16481` | Kullanıcı faturalandığını sanıyor, para gelmiyor | Açık |
| 7 | Fatura reçeteye bağlı değilse "en yeni reçete" damgalanıyor | kod: `dashboard.js:16549-16554` | Yanlış reçete `billed` → o reçete gözden düşer | Açık |

---

## SORU 1 — Bozuk seans verisinin temizliği

### Bulgu 1 — Silme sınırı: hangi satır "rechnungsbegründend" oldu?

**Spesifikasyon der ki (Anhang 04c Anlage 1 TP5, Ziff. 2.2):**
> „Nach der Digitalisierung und Integritätssicherung der Belege entsprechend Ziffer 4.1. bis 4.4.
> dieser Verfahrensdokumentation erhält das entstandene digitale Image den Beweiswert eines Originals.
> Die ursprünglichen Papierdokumente sind ab diesem Zeitpunkt keine rechnungsbegründenden Unterlagen
> mehr …"

ve (Ziff. 7 Ermöglichung des Kontrollrechts):
> „Sofern und soweit die Kranken- und Pflegekasse z. B. aufgrund von Auffälligkeiten von Ihrem Recht
> zur Kontrolle der Verfahrensabläufe Gebrauch macht und z. B. ein Audit oder Stichprobenprüfungen
> durchführt, werden ihr diese Kontrollen ermöglicht und unterstützt."

**Kodda:** `api-backend/billing/api/abrechnung.routes.js:200-206` — DTA pozisyonları **doğrudan**
`prescription_sessions` satırlarından üretiliyor:
```js
const doneSessions = (rx.prescription_sessions || []).filter(s => s.status === 'done');
const sessions = doneSessions.map(s => { … datumLeistung: s.done_at.slice(0,10), anzahl: 1 … });
```
Her `done` satır = SLLA'da bir Abrechnungsposition (Leistungstag + HPNR + anzahl 1).

**Fark:** Gönderilmiş DTA dosyası (`abrechnung.storage_path`, imzalı hâli `signed_storage_path`)
depoda duruyor; ama gönderilen pozisyonların ayrı bir tablosu **yok** (şemada `abrechnung_positionen`
diye bir tablo yok — `db/SCHEMA.sql:31-59`). Yani gönderilmiş faturanın satır bazlı tek iç kaydı
`prescription_sessions`'tır. Silinirse kasa "şu Beleg'in 4. seansını gösterin" dediğinde kaynak yok.

**Etki:** Kasa denetiminde (Stichprobenprüfung / Absetzungswiderspruch) belge sunulamaz →
Nullretaxation riski + Nachvollziehbarkeit kaybı. Ayrıca ZAA/Absetzung parser'ı geri dönen kaleme
karşılık gelen satırı bulamaz → Korrekturrechnung (VKZ 04) üretilemez, çünkü VKZ 04 için
"nicht zuvor vergütete(n) Position(en)" tekrar fatura edilmelidir (Anlage 1 V21, 7.4.3).

**Düzeltme (karar):**

- **Sınıf A — dokunulabilir.** `p.abrechnung_id IS NULL AND (p.abrechnung_status IS NULL OR
  p.abrechnung_status = 'bereit')`. Bu satırlar hiçbir DTA'ya girmedi, hiçbir kasaya gitmedi;
  planlama artığıdır. **Silme serbesttir.** Yine de: migration'dan önce silinecek satırların tam
  dökümü (id, prescription_id, booking_id, session_number, status, done_at) bir dosyaya alınmalı ve
  migration'ın kendisi `supabase/migrations` + `db/SCHEMA.sql` tazelemesiyle kayda geçmeli.
  Hasta verisi içermediği için bu döküm depo dışı bir yere konmalı (id'ler yeterli).
- **Sınıf B — dokunulmaz.** `p.abrechnung_id IS NOT NULL OR p.abrechnung_status IN
  ('in_abrechnung','gesendet','accepted','paid')`. **Silme yok.** Yapılacak:
  `UPDATE prescription_sessions SET status='cancelled', notes = coalesce(notes||' | ','') ||
  'annulliert 2026-08-12: Doppelzeile aus Verknüpfungsfehler, nicht abgerechnet'` — sadece
  **hiç faturalanmamış** (yani `status <> 'done'`) fazlalık satırlar için. `status='done'` olan bir
  satır Sınıf B'de **hiç değiştirilmez**, çünkü o satır gönderilen DTA'nın bir kalemidir; içeriği
  değişirse dosya ile veritabanı çelişir.
- **Üçüncü seçenek (hiç dokunmamak) yeterli değil**, çünkü Bulgu 3 aktif gelir kaybı üretiyor
  (aşağıya bak) — ileriye dönük düzeltme geçmişteki kilitli reçeteleri açmıyor.

**Doğrulanamayan:** GoBD'nin kendisi (BMF-Schreiben) arşivde **yok**; "Unveränderbarkeit" ilkesini
birebir alıntılayamıyorum. Yukarıdaki gerekçe §302 tarafındaki Nachvollziehbarkeit/Kontrollrecht
hükmüne dayanıyor. GoBD'nin vergi hukuku boyutu (10 yıllık saklama, Verfahrensdokumentation
zorunluluğu) `legal-de`'nin alanıdır — ondan ayrı teyit alınmalı.

---

### Bulgu 2 — Kasaya fazla tutar gittiyse: DTA'da storno yok

**Spesifikasyon der ki (Gemeinsame Umsetzungsempfehlungen zum Korrekturverfahren Heilmittel,
Frage 5 — anzuwenden ab 01.10.2025):**
> „Wie muss mit Fällen umgegangen werden, bei denen für eine Verordnung zu viel abgerechnet wurde?
> Greift hier auch das neue Korrekturverfahren?" → „**Diese Fallkonstellation ist nicht vom
> Korrekturverfahren umfasst.** In diesen Fällen muss der Leistungserbringer bzw. das
> Abrechnungszentrum bei der jeweiligen Krankenkasse bzw. dessen Dienstleister die falsche
> Abrechnung melden (schriftlich oder telefonisch). Danach erfolgt eine Rechnungskürzung von Seiten
> der Krankenkasse."

Frage 6 (Mischkorrektur) aynı ayrımı doğruluyor: eksik faturalanan kalem VKZ 02 ile **DTA üzerinden**
yeniden gönderilir (yalnız fark tutarı), fazla faturalanan kalem ise "wie bei Frage 5" kasaya
**bildirilir** ve kasa kesinti yapar.

Ve Anlage 1 TP5 V21, 7.4.3 (VKZ 04) fazla değil, **eksik** ödeme içindir:
> „Nachdem der von der Krankenkasse bemängelte Sachverhalt durch den Leistungserbringer geheilt wurde
> …, ist/sind die **nicht zuvor vergütete(n) Position(en)** erneut mit dem Verarbeitungskennzeichen
> „04" in Rechnung zu stellen."

**Sonuç — §302'de düzeltme yolu (kesin):**

| Durum | Yol | Kaynak |
|---|---|---|
| Eksik faturalandı (unutulan Hausbesuch vb.) | VKZ **02** Nachforderung, DTA, URI segmenti zorunlu | Anlage 1 V21 §7.4.1, §7.3 |
| Kasa kesti, sebep giderildi | VKZ **04** Korrekturrechnung, DTA | Anlage 1 V21 §7.4.3 |
| Zuzahlung sorunu | VKZ **03** | Anlage 1 V21 §7.4.2 |
| Blanko rezidiv, 16 hafta içinde | VKZ **10** + imzalı Anhang A Urbeleg | Anlage 1 V21 §7.4.4 |
| **Fazla faturalandı (bizim vakamız)** | **DTA yolu YOK.** Kasaya/Dienstleister'e yazılı veya telefonla bildirim → kasa Rechnungskürzung yapar | Umsetzungsempfehlungen, Frage 5 |

**Kendiliğinden bildirim gerekiyor mu:** Evet, kaynak "muss … melden" diyor — takdir değil,
yükümlülük. Bildirim yapılmazsa bu bir Doppelabrechnung olarak kasada kalır; ceza hukuku boyutu
(§263 StGB) benim alanım değil → `legal-de`.

**Pratikte önce şunu tespit edin:** Aşağıdaki Sorgu B fiilen aynı Leistungstag'de birden fazla
pozisyon üretmiş reçeteleri veriyor. **Sorgu B boş dönerse kasaya hiç fazla tutar gitmemiştir ve
bildirim gerekmez** — o zaman bu tamamen bir iç veri temizliği işidir. Bildirim kararı Sorgu B'nin
sonucuna bağlıdır, önden verilmez.

---

### Bulgu 3 — Asıl para kaybı: boş slotlar reçeteyi hiç `bereit`e geçirmiyor

**Kodda** (`dashboard.js:7571-7588`):
```js
const { count: openCount } = await supabase.from('prescription_sessions')
  .select('id', { count: 'exact', head: true })
  .eq('prescription_id', sess.prescription_id).neq('status', 'done');
if ((openCount || 0) === 0) { … abrechnung_status: 'bereit' … }
```
Eski `linkBookings…` mantığı boş slotları doldurmayıp yeni satır eklediği için, 6 birimlik bir reçetede
6 adet `booking_id IS NULL, status='planned'` satır sonsuza kadar açık kalır. `openCount` hiçbir zaman
0 olmaz → `abrechnung_status` hiç `bereit` olmaz → reçete §302 listesine (`dashboard.js:20587`,
`.eq('abrechnung_status','bereit')`) **hiç düşmez**.

**Etki:** Sessiz gelir kaybı. Tedavi yapıldı, seanslar `done`, ama fatura hiç üretilmedi. Ekranda hata
yok. Bu, çift faturalamadan daha sinsi ve tahminen daha yaygın olan sınıf. Zamanaşımı riski var —
§302 fatura süreleri sözleşme bazlıdır (§125 Verträge), bu belgede tek tek doğrulanmadı.

**Düzeltme:** Sınıf A temizliği (yetim boş slotların silinmesi) bu reçeteleri kendiliğinden
`bereit` yapmaz — `markPrescriptionSession` yalnızca bir seans işaretlenirken tetikleniyor.
Migration'dan sonra, artık `done` sayısı ≥ `anzahl_einheiten` olan ve `abrechnung_status IS NULL`
kalan reçeteler için tek seferlik bir backfill gerekir:
`UPDATE prescriptions SET abrechnung_status='bereit' WHERE …` (yalnız `kostentraeger_ik IS NOT NULL`
ve `abrechnung_status IS NULL` — mevcut kodun kendi koşullarının aynısı). Bu backfill kasaya bir şey
göndermez, sadece reçeteyi kullanıcının önüne getirir; karar yine terapistindir.

### Bulgu 5 — `cancelled` satır soft-delete olarak işe yaramıyor (builder'a not)

Yukarıdaki `openCount` sorgusu `.neq('status','done')` kullanıyor. Yani Sınıf B'de bir satırı
`cancelled` yaparsak o satır hâlâ "açık seans" sayılır ve reçete bir daha `bereit` olamaz.
Soft-delete uygulanmadan **önce** bu sorgu `.in('status', ['planned'])` (veya
`.not('status','in','("done","cancelled","no_show")')`) hâline getirilmeli. Aksi halde temizlik,
Bulgu 3'ün aynısını eliyle yeniden üretir.

---

### Etkilenen kayıtları bulan SELECT'ler (çalıştırılmadı — salt okunur)

> Hepsi read-only. Sırayla çalıştırın: **B → A → C → D**. B boş dönerse kasaya fazla tutar gitmemiştir.

**Sorgu B — Kasaya fiilen çift pozisyon gitmiş olabilecek reçeteler (ÖNCE BU).**
Aynı reçetede aynı Leistungstag için birden fazla `done` satır = SLLA'da aynı gün iki pozisyon.
```sql
SELECT p.owner_id,
       ps.prescription_id,
       (ps.done_at AT TIME ZONE 'Europe/Berlin')::date AS leistungstag,
       count(*)                          AS done_positionen,
       count(DISTINCT ps.booking_id)     AS distinct_termine,
       p.abrechnung_status,
       p.abrechnung_id,
       a.rechnungsnummer,
       a.status                          AS abrechnung_status_datei,
       a.dateiname
FROM prescription_sessions ps
JOIN prescriptions p ON p.id = ps.prescription_id
LEFT JOIN abrechnung a ON a.id = p.abrechnung_id
WHERE ps.status = 'done' AND ps.done_at IS NOT NULL
GROUP BY p.owner_id, ps.prescription_id, 3, p.abrechnung_status, p.abrechnung_id,
         a.rechnungsnummer, a.status, a.dateiname
HAVING count(*) > 1
ORDER BY p.abrechnung_id NULLS LAST, 3;
```
Yorum: `distinct_termine = 1` olan satırlar **kesin hata** (tek randevu, iki pozisyon).
`distinct_termine > 1` olanlar gerçek çift seans olabilir (aynı gün iki randevu) — elle bakılmalı.
`abrechnung_id IS NOT NULL` olan satırlar Frage 5 kapsamında **bildirim adayıdır**.

**Sorgu A — Aynı `booking_id`'ye bağlanmış birden fazla seans satırı (kök neden izi).**
```sql
SELECT p.owner_id, ps.prescription_id, ps.booking_id,
       count(*)                                          AS zeilen,
       count(*) FILTER (WHERE ps.status = 'done')        AS done_zeilen,
       array_agg(ps.session_number ORDER BY ps.session_number) AS session_nummern,
       p.abrechnung_status, p.abrechnung_id
FROM prescription_sessions ps
JOIN prescriptions p ON p.id = ps.prescription_id
WHERE ps.booking_id IS NOT NULL
GROUP BY p.owner_id, ps.prescription_id, ps.booking_id, p.abrechnung_status, p.abrechnung_id
HAVING count(*) > 1
ORDER BY done_zeilen DESC;
```

**Sorgu C — Fazla satırlı reçeteler + sınıf ayrımı (temizlik iş listesi).**
```sql
SELECT p.owner_id, p.id AS prescription_id, p.anzahl_einheiten,
       count(ps.id)                                                   AS zeilen_gesamt,
       count(ps.id) FILTER (WHERE ps.booking_id IS NULL)              AS leere_slots,
       count(ps.id) FILTER (WHERE ps.status = 'done')                 AS done_zeilen,
       count(ps.id) FILTER (WHERE ps.booking_id IS NULL
                              AND ps.status <> 'done')                AS loeschbare_leerzeilen,
       p.status, p.abrechnung_status, p.abrechnung_id,
       CASE WHEN p.abrechnung_id IS NULL
             AND (p.abrechnung_status IS NULL OR p.abrechnung_status = 'bereit')
            THEN 'A_loeschbar' ELSE 'B_nur_markieren' END             AS klasse
FROM prescriptions p
JOIN prescription_sessions ps ON ps.prescription_id = p.id
GROUP BY p.id
HAVING count(ps.id) > COALESCE(p.anzahl_einheiten, 0)
ORDER BY klasse, p.created_at;
```

**Sorgu D — Sessiz gelir kaybı: tedavi bitmiş ama `bereit`e hiç geçmemiş reçeteler.**
```sql
SELECT p.owner_id, p.id AS prescription_id, p.ausstellungsdatum, p.anzahl_einheiten,
       count(*) FILTER (WHERE ps.status = 'done')                     AS erbrachte,
       count(*) FILTER (WHERE ps.booking_id IS NULL
                          AND ps.status <> 'done')                    AS haengende_leerslots,
       p.status, p.abrechnung_status
FROM prescriptions p
JOIN prescription_sessions ps ON ps.prescription_id = p.id
WHERE p.abrechnung_status IS NULL
  AND p.kostentraeger_ik IS NOT NULL
GROUP BY p.id
HAVING count(*) FILTER (WHERE ps.status = 'done') >= COALESCE(p.anzahl_einheiten, 0)
   AND count(*) FILTER (WHERE ps.booking_id IS NULL AND ps.status <> 'done') > 0
ORDER BY p.ausstellungsdatum;
```

> Not: Sorgular tenant filtresi içermiyor; `service_role` ile çalıştırıldığında tüm owner'ları
> kapsar. `owner_id` sütunu her sonuçta var, gruplama/raporlama onun üzerinden yapılmalı.
> Sonuçlar rapora **hasta adı/KVNR olmadan**, yalnız id ve sayı olarak taşınmalıdır.

---

## SORU 2 — İki §302 çıkışı: bilinçli mi, hata mı?

### Bulgu 6 — "DMRZ" yolu bir §302 yolu değil

**Kodda** (`dashboard.js:16481`):
```js
<DMRZExport xmlns="https://infinitymade.de/dmrz/v1" erzeugt="${now}" format="§302-vereinfacht-v1">
```
Bu bizim uydurduğumuz bir namespace. §302 veri değişiminde geçerli tek taşıma biçimi EDIFACT'tir:
Anlage 1 TP5 V21 §5, Nachrichtentypen **SLGA/SLLA** ve Servicesegmentler UNA/UNB/UNH/UNT/UNZ.
"§302-vereinfacht" diye bir format spesifikasyonda **yoktur** ve hiçbir Datenannahmestelle'ye
gönderilemez. Ayrıca gerçek DMRZ (Deutsches Medizinrechenzentrum) bir Abrechnungszentrum'dur; ona
veri verilecekse formatı DMRZ'nin kendi arayüzü belirler — ki bu XML o da değildir.

**Kodda ayrıca** (`dashboard.js:16533-16539`) kullanıcıya şu metin gösteriliyor:
> „Die Rechnung wird als ‚abgerechnet' markiert … Dieser Schritt ist verbindlich und kann nicht
> rückgängig gemacht werden."

Bu ifade **olgusal olarak yanlış**: hiçbir kasaya, hiçbir Abrechnungszentrum'a hiçbir şey gitmiyor;
sadece bir dosya indiriliyor ve reçeteye `status='billed'` yazılıyor.

**Etki:** Sessiz gelir kaybı. Kullanıcı "abgerechnet ✓ / DMRZ ✓" rozetini görüp (`dashboard.js:8619`,
`:16074`) işi bitmiş sayar, gerçek DTA'yı hiç üretmez.

**Çift ödeme talebi riski (soru):** Bugün **yok** — üretilen dosya hiçbir yere iletilemediği için
kasa nezdinde ikinci bir kayıt oluşmaz. Reçetenin `abrechnung_status='bereit'` kalıp DTA listesinde
görünmeye devam etmesi bu nedenle bir hata değil, kazara doğru davranış: gerçek fatura zaten yalnız
DTA yolundan çıkıyor.

### İki yol yan yana var olmalı mı?

**Kural olarak evet, iki yol §302'de meşrudur** — ama bu ikisi bunlar değil:

- **Eigenabrechnung:** Leistungserbringer kendi IK'sı altında gönderir → **Rechnungsart 1**.
  Kodumuz bunu yapıyor, sabit: `api-backend/billing/dta/segments.js:48` (`rechnungsart = '1'`),
  `abrechnung.routes.js:485` ve `:2060`.
- **Abrechnungszentrum üzerinden:** Anlage 1 TP5 V21 §5.3.3 **Rechnungsart 2** (Dienstleister dosyayı
  üretir, **ödeme Leistungserbringer'in IK'sına gider**) veya §5.3.4 **Rechnungsart 3**
  (Abrechnungsstelle **mit Inkassovollmacht**, Kostenträger başına Sammelrechnung zorunlu;
  Richtlinien-Text §7 Abs. 3 ile aynı yönde). DMRZ tipik olarak buraya girer.

Kritik nokta: **Rechnungsart 3'te dosyayı biz üretmeyiz.** O yolda Praxura'nın işi veriyi hazırlamak
ve DMRZ'ye teslim etmektir; bu teslimin formatı §302 belgelerinde değil, DMRZ'nin kendi arayüz
tanımında yazılıdır — bizde o tanım **yok**, dolayısıyla bugünkü XML doğrulanamaz bir uydurmadır.

**Karar önerisi:**
1. **Kısa vade:** `downloadDmrzForInvoice`'ı §302 çıkışı gibi sunmayı bırak. Ya tamamen kaldır, ya da
   düğme ve metin "interner Export (kein §302-Versand)" olarak yeniden adlandırılsın; `status='billed'`
   yazması kaldırılsın. Bir Beleg'in "abgerechnet" sayılması yalnız DTA zincirinden gelmelidir.
2. **Tek durum alanı:** Evet, olmalı — ve zaten var: `abrechnung_status`
   (`bereit → in_abrechnung → gesendet → accepted/rejected/paid`, `db/SCHEMA.sql` CHECK).
   `prescriptions.status='billed'` ve `dmrz_exported_at` bunun paraleli olarak ikinci bir gerçeklik
   üretiyor; kodda zaten yazılı olan ilke (`dashboard.js:8814`: „abrechnung_status beschreibt
   ausschließlich den §302-Weg") tek kaynak olarak korunmalı. DMRZ gerçekten bir gün açılırsa doğru
   çözüm ikinci bir liste değil, aynı alana bir **yol** ayrımı eklemektir
   (ör. `abrechnung_weg IN ('dta_eigen','abrechnungszentrum')`), çünkü Rechnungsart farkı (1 vs 2/3)
   aynı reçetenin iki kez gitmesini engellemez — engelleyen tek şey tek bir durum alanıdır.
3. **Gerçek DMRZ entegrasyonu istenirse:** önce DMRZ'nin arayüz belgesi arşive girmeli ve INDEX'e
   kaydedilmeli. O belge olmadan format doğrulanamaz — "doğrulanamadı".

### Bulgu 7 — "En yeni reçete" damgalaması

**Kodda** (`dashboard.js:16549-16554`): fatura `invoice.prescription_id` taşımıyorsa hastanın
`created_at DESC LIMIT 1` reçetesi alınıp ona `status='billed'` + `dmrz_exported_at` yazılıyor.

**Etki:** Çok reçeteli hastada yanlış reçete "faturalandı" görünür. Bugün DTA seçimi
`abrechnung_status`'a baktığı için para akışını doğrudan bozmuyor, ama listelerde ve rozetlerde
(`:8619`, `:16074`) yanlış bilgi üretir ve kullanıcıyı doğru reçeteyi faturalamaktan alıkoyar.

**Düzeltme:** Fallback tamamen kaldırılmalı. Fatura bir reçeteye bağlı değilse **hiçbir reçete
damgalanmaz** — tahmin ederek damgalamak, damgalamamaktan kötüdür.

---

## Doğrulanamayanlar

- **GoBD metninin kendisi arşivde yok.** Unveränderbarkeit/10 yıllık saklama ilkesini birebir
  alıntılayamadım; gerekçem §302 tarafındaki Nachvollziehbarkeit + Kontrollrecht hükmüne dayanıyor
  (Anhang 04c Ziff. 2.2 ve Ziff. 7). Vergi hukuku boyutu → `legal-de`.
- **Fatura gönderim süresi (Abrechnungsfrist).** Bulgu 3'teki "zamanaşımı riski" §125 Verträge'de
  düzenlenir; bu incelemede tek tek doğrulanmadı.
- **DMRZ arayüz spesifikasyonu** arşivde yok. DMRZ'nin bugün hangi formatı kabul ettiğini
  doğrulayamadım; söyleyebildiğim tek kesin şey, üretilen XML'in §302 EDIFACT'i **olmadığı**.
- **Fazla tutarın kasaya gidip gitmediği.** Sorgu B çalıştırılmadan bilinemez. Bildirim yükümlülüğü
  (Frage 5) yalnız Sorgu B'nin `abrechnung_id IS NOT NULL` satır döndürmesi hâlinde doğar.
- **Podologie havuzunda (`verordnungen` + `podologie_behandlungen`) benzer bir çift-satır sorunu var mı**
  — bu incelemenin kapsamı dışındaydı, ayrıca bakılmalı.

---

## SPEC-RULES'a eklenmesi önerilen kurallar

```markdown
### Fazla faturalama Korrekturverfahren'e girmez — bildirim zorunludur
- **Kural:** Bir Verordnung için kasaya fazla tutar faturalandıysa bu DTA ile düzeltilemez;
  Leistungserbringer durumu kasaya (veya Dienstleister'ine) yazılı ya da telefonla bildirmek
  zorundadır, düzeltme kasanın Rechnungskürzung'u ile yapılır. Eksik faturalama ise VKZ 02
  (Nachforderung) ile, kasa kesintisi sonrası düzeltme VKZ 04 ile DTA üzerinden gider.
- **Kaynak:** Gemeinsame Umsetzungsempfehlungen zum Korrekturverfahren Heilmittel (Stand 13.02.2025),
  Frage 5 ve Frage 6 · Anlage 1 TP5 V21 §7.4.1, §7.4.3
- **Geçerlilik:** 01.10.2025'ten itibaren
- **Kodda:** uygulanmamış — `api-backend/billing/` altında "zu viel abgerechnet" için bir akış yok
- **Kapsam:** tüm Heilmittel alanları, tüm Verordnungsart'lar

### §302 çıkışı yalnız EDIFACT SLGA/SLLA'dır
- **Kural:** §302 kapsamında kasaya gönderilebilecek tek format Anlage 1 TP5 V21 §5'te tanımlı
  EDIFACT yapısıdır (UNA/UNB/UNH + SLGA/SLLA + UNT/UNZ). Başka bir dosya biçimi (XML, CSV, PDF)
  "§302 gönderimi" olarak sunulamaz; bir Beleg ancak DTA zincirinden geçtiyse "abgerechnet"
  sayılabilir.
- **Kaynak:** Anlage 1 TP5 V21 §5 Aufbau und Struktur der Nutzdaten
- **Geçerlilik:** 01.10.2025
- **Kodda:** ihlal — `dashboard.js:16481` `format="§302-vereinfacht-v1"` uydurma XML üretiyor ve
  `:16588` reçeteye `status='billed'` yazıyor
- **Kapsam:** tümü

### Abrechnungszentrum yolu = Rechnungsart 2 veya 3, dosyayı biz üretmeyiz
- **Kural:** Bir Dienstleister/Abrechnungsstelle üzerinden faturalamada Rechnungsart 2 (ödeme LE'ye)
  veya Rechnungsart 3 (Inkassovollmacht, Kostenträger başına Sammelrechnung zorunlu) kullanılır;
  Dienstleister'in kendi IK'sı altında Sammelrechnung oluşturmak Rechnungsart 2'de yasaktır.
  Eigenabrechnung Rechnungsart 1'dir.
- **Kaynak:** Anlage 1 TP5 V21 §5.3.3 ve §5.3.4 · Richtlinien-Text 20.11.2006 §7 Abs. 3
- **Geçerlilik:** 01.10.2025 (Anlage 1 V21)
- **Kodda:** `api-backend/billing/dta/segments.js:48` — sabit `rechnungsart='1'` (Eigenabrechnung);
  Rechnungsart 2/3 desteklenmiyor
- **Kapsam:** tümü

### Faturalanmış seans satırı silinmez, yalnız işaretlenir
- **Kural:** Gönderilmiş bir DTA'nın pozisyonlarını üreten `prescription_sessions` satırları
  (`abrechnung_id` dolu veya `abrechnung_status IN ('in_abrechnung','gesendet','accepted','paid')`)
  silinemez; kasanın Kontrollrecht'i ve Absetzung sonrası VKZ 04 üretimi bu satırlara dayanır.
  Fazlalık satırlar yalnız `status='cancelled'` + gerekçe ile annüle edilir; `status='done'` satır
  hiç değiştirilmez.
- **Kaynak:** Anhang 04c Anlage 1 TP5 (24.09.2025) Ziff. 2.2 ve Ziff. 7 · Anlage 1 TP5 V21 §7.4.3
- **Geçerlilik:** 24.09.2025
- **Kodda:** `api-backend/billing/api/abrechnung.routes.js:200-206` — DTA pozisyonları doğrudan
  `prescription_sessions` `done` satırlarından üretiliyor; ayrı bir pozisyon tablosu yok
- **Kapsam:** Physio · Ergo · Logopädie (`prescriptions` havuzu)
```
