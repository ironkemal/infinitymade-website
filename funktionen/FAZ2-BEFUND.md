# Faz 2 — Eleme ve Karar Kartları

**Kapsam:** `prescriptions` (9 yol) · `prescription_sessions` (6) · `zuzahlung_befreiung` (4)
**Kaynak:** `funktionen/INDEX.json` (erzeugt 2026-08-12, son commit 8113ff4 ile aynı gün) +
kod okuması (`dashboard.js`, `api-backend/server.js`, `api-backend/billing/api/abrechnung.routes.js`,
`db/SCHEMA.sql`, `db/SCHEMA-RLS.sql`).
**Tetikleyen:** Beta müşteri Nausad — "faturada çift kayıt oluşuyor".

> Bu belgede kod değiştirilmedi. Canlı doğrulama (Faz 3) yapılmadı — aşağıdaki
> "canlıda görülmesi gereken" satırları `canli-test`'e devredilecek iddialardır.

---

## A) Elenenler — kopya DEĞİL

| Küme / fonksiyon | Neden elendi |
|---|---|
| `prescriptions` · `flipAbrechnungStatus` (dashboard.js:8770) | Tek amaçlı el kumandası: `abrechnung_status` bereit↔offen. Kendi ön koşulu var (Therapiebericht kontrolü). Başka hiçbir yol bu işi yapmıyor. |
| `prescriptions` · `renderAbrechnungReady` → "Kostenträger zuweisen" (20904) | Sadece `kostentraeger_ik` yazıyor, `owner_id` filtresi var. Ayrı iş, kopya değil. |
| `prescriptions` · `renderAbrechnungHistory` → "Korrigieren & erneut vorbereiten" (21005) | Reddedilen DTA'yı geri alma (`abrechnung_status:'bereit'`, `abrechnung_id:null`), `owner_id` + `abrechnung_id` filtreli. Tek sahibi olan bir geri-alma yolu. |
| `prescriptions` · `triggerStorno` (22065) | Belegliste storno'sunun yan etkisi: `zuzahlung_kassiert_*` temizleme. Ödeme alanlarına dokunuyor, abrechnung/status alanlarına değil. Ayrı kavram. |
| `prescription_sessions` · `handleSessionDrop` (4032) | **Doğru katmanlama.** Yeni satır AÇMIYOR — var olan boş seansa `booking_id` yazıyor. Placeholder tasarımının doğru kullanıcısı. |
| `prescription_sessions` · `handlePatientNichtErschienen` (4666) | Tek yazan: `status:'no_show'`. Başka yolda karşılığı yok. |
| `prescriptions`/`sessions` · Podoloji tarafı (`verordnungen`, `podologie_behandlungen`) | **İki havuz ayrımı.** Bu turda hiç bakılmadı, birleştirme önerilmiyor (CLAUDE.md + MEMORY: birleştirme kırar). |
| `zuzahlung_befreiung` · `wireBefreiungCard` delete (8845) vs modal delete (4603) | Aynı işin iki yerde silinmesi ama gerekçesi farklı: biri karttaki satırın `id`'si elde, diğerinde sadece patient+jahr biliniyor. Tek satırlık iş, birleştirme kazancı yok. **Yalnız** filtre farkı C4'te not edildi. |

**Elenen: 8 yol.** Kalan aday: **4 karar kartı.**

---

## B) Karar kartları

### KART 1 — Aynı randevu §302 faturasına iki kez düşebiliyor (seans satırı çoğalması)

> Nausad'ın "faturada çift kayıt" şikâyetinin en olası kaynağı budur.

**Yol 1 · Verordnung elle girilir**
Sidebar → **Verordnungen** → "Neue Verordnung" → kaydet
(`saveRezept`, dashboard.js:17923)
Kaydederken `anzahl_einheiten` kadar **boş seans** (booking_id = NULL) açıyor:

```js
// dashboard.js:18038
if (anzahl && anzahl > 0) {
  const sessions = Array.from({ length: anzahl }, (_, i) => ({
    prescription_id: rx.id, session_number: i + 1, status: 'planned'
  }));
  await supabase.from('prescription_sessions').insert(sessions);
}
```

**Yol 2 · KI-Rezept-Scan → Terminserie**
Sidebar → **Verordnungen** (KI-Scan) → onayla → takvim → KI-Terminvorschlag → "Bestätigen"
(`linkBookingsToPrescriptionSessions`, dashboard.js:7610, tetikleyici 7063)
Bu yol **yeni satır insert ediyor**, var olan boş seansı doldurmuyor:

```js
// dashboard.js:7647 — mevcut seansların üstüne numara devam ettiriyor
let next = (existing?.[0]?.session_number || 0) + 1;
const rows = bookingIds.map((bid, i) => ({ prescription_id, booking_id: bid,
                                           session_number: next + i, status: 'planned' }));
await supabase.from('prescription_sessions').insert(rows);
```

İki yol aynı reçete üzerinde buluşursa 10 birimlik bir Verordnung'da
**10 boş + 10 randevulu = 20 seans** olur. Sınır uyarısı çıkar ama
"Trotzdem eintragen" ile geçilebiliyor (7634-7643).

Fatura tarafında her `done` seans **bir DTA pozisyonu**:

```js
// api-backend/billing/api/abrechnung.routes.js:200
const doneSessions = (rx.prescription_sessions || []).filter(s => s.status === 'done');
const sessions = doneSessions.map(s => ({ ..., anzahl: 1, einzelbetrag, ... }));
```

DB'de `prescription_sessions.booking_id` üzerinde **unique yok**
(`db/SCHEMA.sql:1105` → yalnız `UNIQUE (prescription_id, session_number)`), ve
seansı kapatan kod booking_id'ye eşit **bütün** satırları birden kapatıyor:

```js
// dashboard.js:7561 — markPrescriptionSession
.from('prescription_sessions').update(patch).eq('booking_id', bookingId)
```

Yani aynı randevuya bağlı iki satır varsa tek "Sitzung abschließen" tıklaması
iki `done` satırı → **aynı tarihli iki pozisyon** üretir.

**Karar sorusu:** seans satırlarının sahibi kim olsun?
`[1]` `saveRezept` boş seansları açmaya devam etsin, `linkBookings…` **insert etmeyi bıraksın**, boş seansları doldursun (drag-drop'un bugün yaptığı gibi)
`[2]` `saveRezept` boş seans açmasın, seanslar sadece randevu ile doğsun (ama o zaman "seansı takvime sürükle" özelliği kaynağını kaybeder)
`[3]` ikisi de kalsın, sebebi şu: …

Görünüş değişmez; değişen tek şey aynı Verordnung altında kaç satır oluştuğu.

---

### KART 2 — `_physioFlow` oturum boyunca yaşıyor: yabancı hastanın randevuları başka reçeteye bağlanabiliyor

Aynı `linkBookingsToPrescriptionSessions` çağrısının tek kapısı bir global:

```js
// dashboard.js:7063
if (json.created?.length && window._physioFlow?.prescription_id) {
  await linkBookingsToPrescriptionSessions(window._physioFlow.prescription_id, json.created);
}
```

`window._physioFlow` **sadece** KI-Rezept onayında set ediliyor (19768) ve **sadece**
`proceedToRechnungForPhysio` içinde temizleniyor (7848) — yani kullanıcı akışın sonundaki
"Rechnung" adımına gitmezse değer sekmede kalıyor. Batch'in hastasıyla akıştaki hastanın
aynı olup olmadığı **hiç kontrol edilmiyor**.

Sonuç: bir KI-Rezept akışından sonra, aynı sekmede başka bir hasta için KI-Terminserie
oluşturursan o randevular **ilk hastanın reçetesine** seans olarak yazılır → o reçete
faturaya fazladan pozisyonla girer.

(Yan bulgu: 19769'daki `sessionStorage.setItem('rxPreset', …)` hiçbir yerde okunmuyor — ölü yazım.)

**Karar sorusu:**
`[1]` `_physioFlow`, patient_id eşleşmiyorsa kullanılmasın + booking modalı kapanınca temizlensin
`[2]` global kalksın, prescription_id booking modalına parametre olarak taşınsın
`[3]` dokunma, sebebi şu: …

---

### KART 3 — §302 aynı reçeteyi iki kez faturalayabiliyor: DMRZ-XML yolu ile DTA yolu birbirini görmüyor

**Yol 1 · Kasse için DTA**
Sidebar → **§302-Abrechnung** (nav-registry.js:51/101, owner-only) → "Validieren & DTA vorbereiten"
Backend `abrechnung.routes.js` reçeteye `abrechnung_id` + `abrechnung_status` yazar.

**Yol 2 · Faturadan DMRZ-XML**
Sidebar → **Rechnungen** (nav-registry.js:28/50/75/100) → fatura aç → DMRZ-Export
(`downloadDmrzForInvoice`, dashboard.js:16497). Yazdığı:

```js
// dashboard.js:16558
await supabase.from('prescriptions')
  .update({ dmrz_exported_at: new Date().toISOString(), status: 'billed' })
  .eq('id', prescription.id);
```

`abrechnung_status`'a **dokunmuyor**. §302 listesi ise yalnız ona bakıyor:

```js
// dashboard.js:20559 — loadAbrechnung
.eq('abrechnung_status', 'bereit')
```

Yani DMRZ ile dışa aktarılmış reçete §302 ekranında hâlâ "Bereit" listesinde durur ve
DTA'ya ikinci kez girer. Modal metni "verbindlich, kann nicht rückgängig gemacht werden"
diyor ama karşı taraf bu işareti okumuyor.

Ek olarak aynı fonksiyonda **yanlış reçeteyi damgalama** riski var:

```js
// dashboard.js:16526 — fatura reçeteye bağlı değilse, hastanın EN YENİ reçetesi seçiliyor
if (!prescription) {
  const { data: prescriptions } = await supabase.from('prescriptions')
    .select('*').eq('patient_id', invoice.patient_id)
    .order('created_at', { ascending: false }).limit(1);
```

Bu, faturayla ilgisi olmayan güncel bir reçeteyi `status:'billed'` yapabilir.

**Karar sorusu:** Bu iki §302 çıkışından hangisi kalsın?
`[1]` sadece §302-Abrechnung (DTA) kalsın, Rechnungen'deki DMRZ-Export kaldırılsın
`[2]` ikisi de kalsın ama tek statü üzerinden konuşsunlar (DMRZ de `abrechnung_status` yazsın, "Bereit" listesi `dmrz_exported_at`/`billed` olanı göstermesin)
`[3]` başka: …

⚠️ Bu kart `gkv-302`'ye de sorulmalı: DMRZ (Abrechnungszentrum) ve doğrudan DTA aynı praksiste
**bilinçli** olarak yan yana isteniyor olabilir. O zaman iş "birini sil" değil, "çift gönderimi engelle" olur.

---

### KART 4 — Zuzahlungsbefreiung üç ayrı yerden, üç ayrı kuralla kaydediliyor

| Yol | Nereden | Kod | Yazdığı |
|---|---|---|---|
| A | Kalender → randevuya tıkla → yan paneldeki hasta bloğu → "+ Befreiungsnachweis eintragen / ändern" | `openZuzahlBefreiungModal` dashboard.js:4544 | `nachweis_art`, `notiz`, `befreit_ab/bis` — **`beleg_url` yok** |
| B | Sidebar → **Patienten** → hasta → Rezepte kartı → "+ Befreiungsbescheinigung" | `openBefreiungModal`→`saveBefreiung` dashboard.js:9468 / 9488 | `beleg_url` (dosya yükler), `jahr` seçilebilir — **`nachweis_art`/`notiz` yok** + ayrıca `prescriptions` günceller |
| C | KI-Rezept-Scan onay modalında "Befreiungsausweis" dosyası eklenirse | `uploadRxNachweise` dashboard.js:19587 | `beleg_url`, yıl reçetenin `ausstellungsdatum`'undan — kullanıcıya sormaz |

Üçü de aynı satırı (patient+jahr) hedefliyor ama **onConflict hedefleri aynı değil** ve
tetiklenen yan etkiler farklı (bkz. C1, C2). Sıfırdan ikinci kez yazılmış bir modal (A ile B)
söz konusu — B dosya yükleyebiliyor, A yükleyemiyor; A not/nachweis_art tutuyor, B tutmuyor.
Kullanıcı hangi ekrandan girdiğine göre eksik veri alıyor.

**Karar sorusu:** Befreiung girişinin tek sahibi hangi ekran olsun?
`[1]` Patienten kartındaki modal (B) tek kalsın; randevu panelindeki bağlantı da onu açsın
`[2]` Randevu panelindeki modal (A) tek kalsın, dosya yükleme ona eklensin
`[3]` ikisi de kalsın, ama alanlar birleştirilsin (tek modal bileşeni, iki yerden çağrı)

Görünüş değişmez: iki yerde de aynı düğme durur, arkasında tek kod çalışır.

---

## C) Veri riski bulguları

### C1 — 🔴 `onConflict` hedefi DB'deki unique kısıta uymuyor (kayıt hiç kaydolmuyor olabilir)

Canlı şema (`db/SCHEMA.sql:1627`):

```
zuzahlung_befreiung: PK (id) · UNIQUE (patient_id, jahr)
```

`db/SCHEMA-RLS.sql:686` → `idx_befreiung_patient_jahr` **unique değil**.
`owner_id`'yi içeren hiçbir unique kısıt/indeks dökümde yok.

Buna karşılık:

```js
// dashboard.js:4629 — openZuzahlBefreiungModal (Yol A)
.upsert(payload, { onConflict: 'owner_id,patient_id,jahr', ignoreDuplicates: false })
```
```js
// dashboard.js:9522 — saveBefreiung (Yol B)
.upsert(row, { onConflict: 'patient_id,jahr' })
```
```js
// dashboard.js:19598 — uploadRxNachweise (Yol C)
.upsert(befRow, { onConflict: 'patient_id,jahr' })
```

Yol A'nın hedefine karşılık gelen unique kısıt yoksa PostgreSQL planlama aşamasında
**42P10** verir ("no unique or exclusion constraint matching the ON CONFLICT specification") —
yani o modal ilk kaydı bile yazamaz, kullanıcı kırmızı "Fehler: …" görür.
**Faz 3'te doğrulanacak ilk şey bu:** takvimdeki yan panelden Befreiung girmeyi dene, kaydediyor mu?
(Dökümde görünmeyen bir unique indeks canlıda varsa iddia çürür — o zaman da döküm bayat demektir.)

### C2 — 🔴 Aynı tabloya yazan üç yoldan yalnız biri reçeteleri güncelliyor

```js
// dashboard.js:9526 — sadece saveBefreiung
await supabase.from('prescriptions')
  .update({ zuzahlung_befreit: true, zuzahlung_eur: 0 })
  .eq('patient_id', leadId).eq('owner_id', ownerId)
  .filter('ausstellungsdatum', 'gte', `${jahr}-01-01`)
  .filter('ausstellungsdatum', 'lte', `${jahr}-12-31`);
```

Bu kural **takvim yılına** göre çalışıyor. DB'deki trigger ise başka kurala göre:

```
-- db/SCHEMA.sql:1628 · SCHEMA-RLS.sql:436
TRIGGER fn_befreiung_backfill_prescriptions() aktualisiert bestehende Rezepte.
-- fn_is_patient_befreit(): befreit_ab <= datum AND (befreit_bis IS NULL OR befreit_bis >= datum)
```

Yani aynı iş iki yerde, iki farklı pencere tanımıyla yapılıyor: yıl ortasında başlayan
bir befreiung'da (`befreit_ab = 2026-07-01`) el yazımı kod **Ocak-Haziran reçetelerini de**
befreit işaretler, trigger işaretlemez. Fatura tarafı `rx.zuzahlung_befreit`'e bakarak
Zuzahlung'u 0'a çekiyor (`abrechnung.routes.js:230`) → hasta payı kaybolur.

**Öneri (uygulanmadı):** kural tek yerde, tercihen trigger'da kalsın; frontend'deki manuel
update kaldırılsın. Karar KART 4 ile birlikte alınmalı.

### C3 — 🟠 Seansı geri almak `abrechnung_status`'u geri almıyor

İleri yön (`markPrescriptionSession`, dashboard.js:7581):

```js
await supabase.from('prescriptions')
  .update({ abrechnung_status: 'bereit' })
  .eq('id', sess.prescription_id)
  .is('abrechnung_status', null)
  .not('kostentraeger_ik', 'is', null);
```

Geri yön (`openBookingActionModal` içindeki "Sitzung zurücksetzen", dashboard.js:3390):

```js
.from('prescription_sessions').update({ status: 'planned', done_at: null }).eq('id', …)
await supabase.from('prescriptions').update({ status: 'in_therapy' })
  .eq('id', …).eq('status', 'completed');
```

`abrechnung_status` **'bereit' olarak kalır.** Bir seans geri alınmış olmasına rağmen reçete
§302 listesinde "Bereit" görünür ve eksik seansla faturaya girer.
Ayrıca bu geri alma bloğu `markPrescriptionSession`'ın tersini elle yeniden yazmış durumda —
tek fonksiyona indirilirse asimetri kendiliğinden kapanır (KART 1 ile aynı bölge).

### C4 — 🟡 Silme yollarında filtre farkı

```js
// dashboard.js:4603 — modal
.delete().eq('patient_id', patientId).eq('owner_id', ownerId).eq('jahr', year)
// dashboard.js:8845 — kart
.delete().eq('id', btn.dataset.id)          // owner_id filtresi yok, RLS'e güveniyor
```

`zuzahlung_befreiung` RLS'te (SCHEMA-RLS.sql:319/491) korunuyor, yani bugün sızıntı
beklemiyorum; yine de aynı tablodan iki farklı sözleşmeyle siliniyor. Düşük öncelik.

### C5 — 🟡 İki reçete oluşturma yolu farklı alan kümesi dolduruyor

`saveRezept` (dashboard.js:17999, elle giriş) ile `/api/rezept/confirm`
(api-backend/server.js:2352, KI-Scan) aynı tabloya **farklı zenginlikte** satır yazıyor:

| Alan | KI-Scan | Elle giriş |
|---|---|---|
| `rezept_typ` (standard/blanko/lhb_bvb) | ✅ hesaplanıyor (server.js:2320) | ❌ **hiç yazılmıyor** |
| `kostentraeger_ik` | `kostentraeger` tablosundan çözülüyor (2325) | forma yazılan ham değer (18031) |
| `heilmittel_position` | `resolvePositionsnummer()` ile kanonik hâle getiriliyor (2340) | ham metin (18010) |
| `prescription_validations` denetim kaydı | ✅ (2415) | ❌ |
| PHI şifreleme (`icd10_enc`, `phi_encrypted`) | ✅ (2401) | ❌ |
| `prescription_sessions` | ❌ açmıyor | ✅ `anzahl` kadar açıyor |

§302 açısından en sert olanı `heilmittel_position`: backend "position fehlt" veya çözümsüz kod
yüzünden reçeteyi reddedebiliyor (`abrechnung.routes.js:196`). Elle girilen reçeteler bu yüzden
KI ile girilenlerden farklı davranır.

Bu **kopya kartı değil** — iki giriş yolu bilinçli. Ama alanların ortak bir normalleştiriciden
geçmesi gerekiyor. Ayrı iş kartı olarak Ops-Dashboard → Teknik'e yazılmalı.

---

## Not — haritanın bu turdaki sınırı

`saveRezept`, `saveBefreiung`, `linkBookingsToPrescriptionSessions`, `openZuzahlBefreiungModal`
ve `downloadDmrzForInvoice` için `INDEX.json`'daki `calledBy` **boş** ve `uiPfad` **boş** —
hepsi `addEventListener` ile bağlanıyor, çağrı grafiğinin dışında kalıyorlar (README'deki
bilinen sınır). Bu belgedeki ekran tarifleri haritadan değil, olay bağlama satırlarından
(3610, 8839, 18726, 7063) ve `nav-registry.js` etiketlerinden çıkarıldı. Yine de kesin
tıklama yolları Faz 3'te `canli-test` ile doğrulanmalı.
