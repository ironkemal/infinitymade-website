# Hukuki Değerlendirme — `prescriptions_festschreibung()` trigger'ı ve DSGVO-Löschkette (Ops #167)
Tarih: 2026-09-17 · Rol: Auftragsverarbeiter (hasta verisi tarafı, praxis adına)
Rechtsstand doğrulandı: kısmen — §302/§304 SGB V retention mantığı koddaki mevcut
`invoices`/`abrechnung_zeile` kararlarından türetildi (analoji), yeni bir dış kaynak
araştırılmadı; bu iki karar zaten `compliance/LEGAL_DECISIONS.md` ve `db/REGISTER.md`'de
belgeli ve kapalı.

## Özet
Trigger tasarımı (BEFORE UPDATE, `belegnummer` seti sonrası içerik kilidi) doğru yönde,
ama sorulan üç soru cevaplanmadan önce **daha kritik bir bulgu** var: bugün `prescriptions`
`api/dsgvo.js`'te `DELETE_TABLES`'ta (satır 276) — yani **hard DELETE**, `abrechnung_zeile`/
`invoices` gibi `ANONYMIZE_TABLES`'ta değil. BEFORE UPDATE trigger'ı `DELETE` ifadesini hiç
görmez, dolayısıyla planlanan trigger **Löschungskette'yi bloklamaz** — ama bunun nedeni
istisna eklenmiş olması değil, DELETE yolunun triggerdan bağımsız çalışmasıdır. Asıl açık
soru budur: gönderilmiş (belegnummer dolu) bir Verordnung, `invoices`/`abrechnung_zeile`
ile aynı kategoride bir §302-Abrechnungsnachweis'tir, ve bugün Art.-17 talebiyle **hiçbir
kilit olmadan komple silinebiliyor** — bu, `db/SCHEMA-RLS.sql:904-914`'te zaten "OFFENE
LUECKE" olarak işaretlenmiş ve "Vor der Umsetzung: gkv-302 UND legal-de" notuyla
bekletilmiş.

## Bulgular

### 1. NULL-istisnası eklenmeli mi (versichertennummer + PII)?
**Evet, prensipte eklenmelidir** — `fn_abrechnung_zeile_festschreibung()` deseni doğru ve
tekrarlanmalı: kimlik alanlarının **sadece NULL'a çekilmesine** izin ver, başka değere
değiştirilmesine değil. Ama şu an bu istisna **UPDATE-yolu üzerinden çağrılmayacak ölü
kod** olur, çünkü `dsgvo.js` `prescriptions`'ı UPDATE ile anonimleştirmiyor, DELETE ile
siliyor. İstisnayı yine de ekle — iki sebep: (a) uygulama kodundaki manuel bir "hastayı
anonimleştir" düzeltmesi/edge-case'i ileride bu yolu kullanabilir, (b) aşağıdaki 2 numaralı
öneri (prescriptions'ı ANONYMIZE_TABLES'a taşımak) kabul edilirse istisna zaten hazır olur.

### 2. `patient_id` (FK → leads) — Löschung akışını kırar mı?
Kırmaz, çünkü bugün ilişki DELETE üzerinden çözülüyor: `DELETE_TABLES` sırasında
`prescriptions` **leads'ten önce** silinir (satır 276 vs. 278) — çocuk satır zaten yok
olduğu için `patient_id`'nin `ON DELETE` davranışı (CASCADE/SET NULL/NO ACTION) bu akışta
hiç devreye girmiyor. `leads` satırı kendisi anonimleştirilmiyor, o da hard-delete
listesinde.
**Teyit:** `patient_id` bir FK'dır (`leads(id)`), `db/SCHEMA.sql:2197`. Planlanan BEFORE
UPDATE trigger bunu kilitlese bile DELETE akışını etkilemez — yalnızca ileride biri
`PATCH prescriptions SET patient_id=...` yaparsa devreye girer, ki bu zaten GoBD açısından
istenen davranıştır (kimlik değiştirilemesin).

### 3. Sağlık/tanı alanları (icd10, icd10_2, diagnosegruppe) — NULL-istisnası ister mi?
**Hayır.** Bunlar `abrechnung_zeile`'deki `heilmittel_position`/`leistungen` gibi
**içerik** alanlarıdır, kimlik alanı değil — §302 Anlage 1 TP5'e göre gönderilen
Datensatz'ın Pflichtangabe'sidir (hangi tanı için hangi Heilmittel faturalandı). Bunları
NULL'a çekmek, `invoices`'ta `patient_name`'i nullamanın yarattığı hatanın aynısını
yaratır — burada rolü ters: kimlik değil, **Abrechnungsinhalt** kaybolur, ve bu tam da
Nachweis'in var olma sebebidir (aynı gerekçe `LEGAL_DECISIONS.md:2026-09-08` satırında
`rechnung_zahlungen` için de kullanıldı: "Grundaufzeichnung… entfällt nicht durch
Anonymisierung"). İstisna listesi `abrechnung_zeile` deseniyle tutarlı kalmalı:
**yalnız kimlik alanları** (`patient_name`, `versichertennummer`, ve tutarlılık için
`patient_id` — `invoices`'ın nullify listesinde zaten var) NULL'a çekilebilsin; `icd10`,
`icd10_2`, `diagnosegruppe`, `heilmittel*`, `anzahl_einheiten`, `zuzahlung_eur` vb. **hiç**
istisna almasın, tıpkı finansal alanlar gibi kilitli kalsın.

## Asıl açık soru (bu görevin sorduğundan daha geniş, ama atlanamaz)
`prescriptions` bugün belegnummer'dan bağımsız her durumda hard-DELETE ediliyor. Eğer Ops
#167'nin amacı gerçekten `invoices`/`abrechnung_zeile` ile aynı GoBD/§302 retention
mantığını `prescriptions`'a taşımaksa (ki `SCHEMA-RLS.sql:904-914`'teki not bunu ima
ediyor), o zaman **trigger tek başına yetersiz** — companion bir değişiklik gerekir:
billed (`belegnummer IS NOT NULL`) satırların `dsgvo.js`'te `DELETE_TABLES`'tan çıkarılıp
`ANONYMIZE_TABLES`'a taşınması (nullify: `patient_name`, `versichertennummer`,
`patient_id`), unbilled satırların ise hard-delete'te kalması. Bu, **bu görevin kapsamı
dışında** (ayrı bir dsgvo.js değişikliği + gkv-302 onayı gerektirir) ama db-ustasi'nin
migration'ı yazarken bilmesi gereken bir bağlam: trigger'ı kurmak GoBD boşluğunu **tek
başına kapatmaz**, sadece UPDATE-yoluyla kurcalamayı engeller.

## Tavsiye
1. Trigger'a `fn_abrechnung_zeile_festschreibung()` deseniyle NULL-istisnası ekle:
   `patient_name`, `versichertennummer`, `patient_id` — sadece bu üçü, sadece NULL hedefli.
2. `icd10`/`icd10_2`/`diagnosegruppe`/`heilmittel*`/tutar alanları istisnasız kilitli kalsın.
3. `owner_id`, `business_id`, `created_at` kilitli listede olsun (mandant-taşıma koruması,
   `abrechnung_zeile` deseniyle aynı gerekçe).
4. Ayrı bir Ops kartı aç: "billed prescriptions → ANONYMIZE_TABLES" (gkv-302 + legal-de
   birlikte, `SCHEMA-RLS.sql:913`'teki notun gereği zaten bu).

## Yapılacaklar
- [ ] db-ustasi: migration'a nullify-istisnasını (patient_name/versichertennummer/
      patient_id) ekle — bu görev
- [ ] Ayrı kart: dsgvo.js DELETE_TABLES → ANONYMIZE_TABLES geçişi (billed prescriptions) —
      gkv-302 + legal-de + kod

## Sınırlar
§304 SGB V'nin tam Fundstelle'si ve süresi bu turda doğrulanmadı — analoji `abrechnung_zeile`/
`invoices` için zaten kapatılmış kararlara dayanıyor (`compliance/LEGAL_DECISIONS.md`
2026-09-08, `db/REGISTER.md` §302/GoBD bölümü). Yeni bir dış kaynak taraması yapılmadı.
