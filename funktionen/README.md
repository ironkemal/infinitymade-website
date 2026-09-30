# Funktionskarte — projedeki her fonksiyonun haritası

`db/` klasörünün koda uygulanmış hâli. `db/` "hangi tablo var"ı, burası **"hangi fonksiyon
var, nerede kullanılıyor, neyle besleniyor"**u tutar.

## Neden var

`dashboard.js` 24.000+ satır; projede 1700'den fazla fonksiyon var. "Böyle bir şey zaten var
mı" sorusu okuyarak cevaplanamaz — hiçbir model bu hacmi tek seferde kapsayamaz, okur ve
**makul ama eksik** bir cevap üretir. Bu klasör o soruyu okumaya değil **saymaya** çevirir.

Somut sebep: 12.08.2026 beta görüşmesinde aynı işin iki ayrı yerde ayrı kodla yapıldığı
görüldü (Fußbefund iki yerden kaydediliyor, Zuzahlungsbefreiung dört ayrı yoldan yazılıyor).
Bunlar tek tek bug değil, **bir kalıp**. Kalıbı görmek için envanter gerekiyordu.

## Dosyalar

| Dosya | İçerik |
|---|---|
| `INDEX.json` | Makine okuru. Her fonksiyon: dosya/satır, dokunduğu tablolar, yazma işlemleri, çağırdıkları, **onu çağıranlar**, hangi sidebar modülünden erişilebildiği, tıklama yolu. |
| `INDEX.md` | İnsan okuru. Kopya adayları, en çok yazılan tablolar, çift isimler. |

İkisi de **üretilir, elle düzenlenmez.** Yanlış varsa düzeltilecek yer
`tools/funktionskarte.mjs`, çıktı değil.

## Tazeleme

```bash
node tools/funktionskarte.mjs
```

**Kural:** fonksiyon eklendiğinde, silindiğinde veya taşındığında harita aynı commit'te
tazelenir. Tetikleyici cümle: **"harita güncelle"**.

Eski harita hiç haritadan kötüdür — okuyan ona inanır. `db/README.md`'deki şema tazeleme
kuralıyla aynı gerekçe.

## Kopya adayları nasıl okunur

`INDEX.md`'deki her küme, **aynı tabloya yazan ama birbirini çağırmayan** kod yollarını
gösterir. Bu bir suçlama listesi değil, **inceleme kuyruğu.**

Bu projede bilinçli bir katmanlama var ve script onu ayırt edemez:

- ✅ **Doğru:** ortak taban + üstüne binen alan bloğu (podolojide ayak şeması), ya da tek
  uygulamanın parametreyle daraltılması (`attachDiagnoseSearch(..., { strict: true })`)
- ⚠️ **ARTIK GEÇERSİZ (04.09.2026):** "iki veri havuzu kasıtlıdır, birleştirme kırar"
  maddesi kalktı. Kemal'in kararıyla podoloji `verordnungen`'den `prescriptions`'a taşındı
  (hedef: 9 kolon / 7 satır / 72 kod noktası — 47 / 242 / 168 yerine). Podolojinin kendi
  kelime dağarcığı (`lead_id`, `behandlungseinheiten`, `therapiefrequenz`, `dringend`,
  `icd10` dizisi, aktiv/abrechenbar/abgesetzt durum ekseni) sıfırdan yeniden yazılmadı;
  arada **`module/verordnung-topf.js`** sınır modülü duruyor (`ausTopf`/`inTopf`,
  `statusAusTopf`/`statusInTopf`, `fuehrtSitzungsbuch`). Yani `prescriptions`'a iki farklı
  kelimeyle yazan yolları görürsen bu kopya değil, **çeviri katmanıdır.**
  ⚠️ `api-backend/billing/utils/einreichbar.js` içindeki `statusAusAbrechnungStatus` /
  `abrechnungStatusAusStatus` bu modülün **bilinçli aynasıdır** (`SPIEGEL` yorumlu):
  Docker imajı `module/`'ü içermediği için paylaşılamıyor. Biri değişirse ikisi değişir.
- 🔴 **Kopya:** aynı iş için ikinci kez sıfırdan yazılmış kod
- 🔴 **Veri riski:** aynı tabloya farklı kurallarla yazan yollar (biri `onConflict` kullanıyor,
  diğeri kullanmıyor gibi)

Karar `fonksiyon-ustasi` ajanında; şüpheli olan kullanıcıya **tıklama yoluyla** sorulur,
sessizce birleştirilmez.

## Bilinen sınır

`uiPfad` alanı, `dashboard.js`'teki `if (id === '...')` modül yönlendiricisinden ileriye
doğru çağrı grafiğiyle hesaplanır. Olay dinleyicisiyle bağlanan fonksiyonlar bu zincirin
dışında kalıp "UI yolu çözülemedi" görünebilir; çok yerden çağrılan yardımcılar da
`gemeinsam: true` ile işaretlenir. Kullanıcıya verilecek ekran tarifi bu alandan körü körüne
kopyalanmaz, `canli-test` ile doğrulanır.

### ⚠️ `calledBy: []` "ölü kod" demek DEĞİLDİR (08.09.2026'da ölçüldü)

Express route gövdeleri `router.post('/x', async (req, res) => { … })` biçiminde **isimsiz**
argüman fonksiyonlarıdır; üretici onları hiç kayda almaz. Dolayısıyla **yalnızca bir
route'tan çağrılan backend fonksiyonu haritada `calledBy: []` görünür.**

Ölçülen örnek: `api-backend/billing/api/abrechnung.routes.js` — dosyada 30'dan fazla route
var, haritada 17 kayıt, hiçbiri route gövdesi değil. Bu yüzden `buildDtaFile` (gerçekte 2
çağrı yeri), `ladeAnnahmestelle` (4) ve `annahmestelleFehlt` (3) çağrılmıyor görünür.

**Backend fonksiyonu için "ölü kod / silinebilir" hükmü `calledBy`'a bakılarak verilmez** —
ham grep ile doğrulanır. Frontend tarafında bu sorun yok, import zinciri çözülüyor.

### `endpoints[]` yalnız `fetch()` içindeki düz metni görür

Adres bir değişkende duruyorsa (`const URL = '…'; fetch(URL, …)`) alan **boş** kalır.
Örnek: `module/podologie-dateieinheit.js` → `ladeDateieinheiten()` gerçekte
`POST /billing/abrechnung/annahmestellen` çağırır, haritada `endpoints: []`.

"Bu ekran hangi backend yolunu çağırıyor" sorusu bu alandan tek başına cevaplanmaz;
`grep "n8n.infinitymade.de"` ile tamamlanır.

### `kopieKandidaten` yalnız YAZAN yolları sayar — çizen kopyalar görünmez (18.09.2026'da ölçüldü)

Üretici, kopya adaylarını `writes[]` alanından (tablo başına bağımsız insert/update/upsert/
delete yolu) çıkarır. Bu yüzden **salt-okunur iki render yolu asla kuyruğa girmez**, aynı
DOM'u iki ayrı şablonla doldursalar bile.

Ölçülen olay — Ops #308, sağdaki Termin-Panel'i (`#bkActionModal`) iki giriş doldurur:
`openBookingActionModal` (dashboard.js:3223, 477 satır) ve `zeigePatientOhneTermin`
(module/termin-panel-patient.js:135, 54 satır). İkisi de hiçbir tabloya yazmaz; harita
ikisini de "kopya adayı" saymadı, ikinci yol dokuz ay boyunca birinci yolun bloklarının
çoğunu hiç çizmeden yaşadı. Aynı denetimde `bkVerordnungSection`'ın panelden değil
`#bookingModal`'dan geldiği de yalnız DOM id'lerini elle sayarak bulundu.

**Kural:** "aynı ekranı kaç yol çiziyor" sorusu `kopieKandidaten`'dan cevaplanmaz. Aynı
`getElementById('…')` kimliğine dokunan fonksiyonları say — bugün elle, `INDEX.json`'daki
`start`/`end` aralıklarını dosya gövdesinde tarayarak. Üreticiye bir `domIds[]` boyutu
eklenene kadar bu boşluk açık.

## Niyet kaydı — haritanın göremediği "niye"

Harita bir fonksiyonun *ne* olduğunu tutar, *niye* yazıldığını/değiştirildiğini tutmaz.
Builder/oturumlar yazdıktan sonra bildirir (CLAUDE.md → "sor **ve** bildir"); kısa kayıt buraya.
En yeni üstte. Satır numarası yazılmaz — harita onu tutar.

### 30.09.2026 · 047baab — Podoloji (a)/(b)/(c) + canli-test P3 (Sperrtext, ICD im Speichern-Dialog)
- `sperreTextAusLage(lage)` (`podo-arztangaben.js`). Niye: LANR/Unterschrift-Sperre hatte drei Wortlaute
  (Banner, Speichern-Dialog, Tagesbehandlung); jetzt ein Satz, der das Fehlende nennt (canli-test P3).
  Nerede: `podoArztHinweise().satz` (saveRezept), `behandlungGesperrt().text` (Tagesbehandlung),
  `arztangaben-banner.js` `sperreBannerText`. `SPEICHERN_HINWEIS` / `BEHANDLUNG_GESPERRT_TEXT` entfernt.
- `icdSpeicherHinweise`, `icdHinweiseZusammen` (neu `module/verordnung-speichern-hinweise.js`). Niye: saveRezept-Bestätigung
  soll nicht endständige ICD (z. B. E11.7) nennen, ohne dass `dashboard.js` wächst. Nerede: `dashboard.js` `saveRezept`
  (formatErrors-Zeile). Kein zweiter Wortlaut: nutzt `gespeicherterKodeHinweis` (katalog-suche.js → `nichtEndstaendigHinweis`) + `pruefeVerordnung`.
- `heilmittelGegenLeitsymptomatik` (`verordnung-pruefung.js`). Niye: 78010↔Leitsymptomatik wurde per Freitextvergleich
  geprüft; jetzt positionsbasierte Regel (podoloji (a), Wortlaut gkv-302). Nerede: `pruefeVerordnung`.
- `module/podo-heilmittel-katalog.js` (neu) — `POD_HEILMITTEL_KATALOG` / `POD_HEILMITTEL_DGS` aus `podologie-abrechnung.js`
  hierher, weil jenes Modul im Rumpf einen DOM-Listener hat und nicht importierbar war. Eine Tabelle; Import in
  `podologie-abrechnung.js` + `verordnung-pruefung.js`. Nicht verwechseln mit `POD_KATALOG` (verordnung-regeln.js).
  - **Offener Rest:** `podo-behandlungsposition-regel.js` `DGS_MIT_BEHANDLUNG = ['DF','NF','QF']` ist laut eigenem
    Kommentar ein Spiegel von `POD_HEILMITTEL_DGS` „ohne Import-Kette" — seit dieser Auslagerung wäre der Import
    möglich. Klein, nicht gemeldet als Kopie-Karte; beim nächsten Anfassen importieren statt spiegeln.
- `ohneBehandlungsposition`, `leitsymptomatikNotiz`, `OHNE_BEHANDLUNG_FRAGE`, `LS_FEHLT_NOTIZ`
  (`podo-behandlungsposition-regel.js`). Niye: DF/NF/QF-Tagesbehandlung ohne 78010/78020 rutschte still durch
  (podoloji (b)); jetzt Rückfrage beim Speichern + Notiz bei fehlender Leitsymptomatik. Nerede:
  `podologie-abrechnung.js` Kaydet-Handler + Tagesbehandlung-Kopf. `behandlungspositionVorschlag(massnahme, roh, dg)`
  — 3. Parameter DG → 78010-Vorbelegung bei DF/NF/QF.
- `statusDialogVorgabe` (`abrechnungsstatus.js`). Niye: aktive podo-Verordnung mit 0 Behandlungen → „Bereit" disabled und
  nicht vorgewählt, damit der Server-422 vorher sichtbar ist (podoloji (c)). Nerede: `oeffneStatusDialog` / `oeffneStatusDialogFuer`.

### 01.10.2026 · S3-Reste — ICD nicht endständig, Karten-IK-Prüfung, Sperre-Banner, Fahrt-lead_id
- `passendeUnterkodes(code, rule)` (`icd-dg-match.js`). Niye: „E11.7 passt nicht zur Diagnosegruppe DF" war mechanisch wahr,
  aber irreführend (E11.74/E11.75 passen). Kinder eines nicht endständigen Kodes, die die DG-Regel annimmt → gelbe Warnung
  `ICD_NICHT_ENDSTAENDIG` (gkv-302: V:01016, kein Blocker) statt rotem Mismatch. Nerede: `verordnung-pruefung.js` (Liste/Knopf) +
  `icd-dg-verdrahtung.js` (Formular-Warnzeile). `dgSperrenFuerIcd` unverändert.
- `leadKartenIkFehler(wert)` / `pruefeLeadKartenIk(kasseEl)` (`lead-karten-ik.js`). Niye: ungültige Karten-IK wurde im Patientenformular
  still zu null und überschrieb eine gültige. Nerede: Speichern-Handler `leadSaveBtn` in `dashboard.js` (Inline-Fehler + Abbruch).
- `kasseZuKartenIk({...})` (`krankenkasse-suche.js`). Niye: Kassenname passte nicht zur Karten-IK (DAK-IK bei „AOK…"), kein Hinweis.
  Amber-Warnung `#<ik-id>Abweichung`, kein Blocker; nutzt den vorhandenen Resolver `kartenIkStatus` (kein zweiter). Nerede: Patientenformular + Muster-13-Maske.
- `sperreBannerText` / `aktualisiereArztSperreBanner` / `installiereArztSperreBanner` (neu `module/arztangaben-banner.js`). Niye: die
  Behandlungssperre (LANR/Unterschrift, S3.7) erschien nur im Speichern-Dialog. Live-Banner `#rzSperreBanner` in der Maske (podo),
  Speichern blockiert weiterhin nicht. Nerede: `dashboard.js` (Maske öffnen/Arzt-Vorbelegung), `verordnung-maske.js` `fuelleMuster13`; `arzt-register.js` sendet nach LANR-Übernahme `input`.
- `leadIdFuerFahrt(sb, b)` (`fahrt-beenden.js`). Niye: erste `fahrten`-Zeile hatte `lead_id` nur über Telefon → leer bis „Beenden".
  `bookings.lead_id` zuerst, dann Telefon. Nerede: Fahrtstart in `dashboard.js`.
- Neue Verordnung → `emit('verordnungen:changed')` (statt nur bei `activePanel==='verordnungen'`): Liste/Akte zogen nicht nach.

### 30.09.2026 · gkv-302 Auflagen zu B1 — Rückschreiben, valid_from, Preflight je Zeile
- `kostentraegerIkZurueckschreiben(supabase, zeilen, warnungen, ownerId)` (`kostentraeger-frisch.js`). Niye: Arbeitsliste
  (`abrechnung-auswahl.js`) gruppiert nach gespeicherter IK; ohne Rückschreiben hing eine Verordnung mit geändertem
  Kostenträger für immer im 409 `KOSTENTRAEGER_GEAENDERT`. Schreibt nur `abrechnung_status='bereit'` + `belegnummer IS NULL`
  (GoBD-Tor `prescriptions_festschreibung`), Bedingung zusätzlich im WHERE, best effort. Nerede: `/abrechnung/create` und
  `/abrechnung/create-podologie`, direkt nach `kostentraegerFrischAbleiten`. ⚠ 8. `prescriptions`-Schreibweg (nur diese eine Spalte).
- `kostentraegerGeaendertAntwort(id, alt, neu, zurueckgeschrieben)` — 409-Text; „Liste neu laden" nur wenn wirklich gespeichert.
- `kostentraegerFrischAbleiten(..., {preflight:true})` liefert zusätzlich `fehler` (je Zeile, kein Abbruch) + `aufgeloest`;
  `/abrechnung/preflight` richtet die Kasse/DAS-Auflösung an der ersten aufgelösten Zeile aus. `kostentraegerAbfrage` filtert jetzt auch `valid_from`.

### 30.09.2026 · gkv-302 B1 — Kostenträger-IK DTA anında taze; kayıtlı ICD'de S3.6 uyarısı
- 79e1556 — yeni `api-backend/billing/utils/kostentraeger-frisch.js` → `kostentraegerFrischAbleiten(supabase, zeilen, {aufloeser})`.
  Niye: §302 dosyası üretilirken `prescriptions.kostentraeger_ik`'deki saklı değere güvenilmiyor; Karten-IK'dan
  o anki Kostenträgerdatei'ye göre yeniden türetiliyor (birleşme / yeni `abrechnender_kt_ik` sonrası dosya eski
  IK'ya gitmesin). Çözülemezse 422 `KOSTENTRAEGER_NICHT_AUFLOESBAR`, değiştiyse uyarı `KOSTENTRAEGER_IK_NEU`.
  **Yeni çözümleyici değil** — S3.8a'nın tek kaynağı `kostentraegerIkAufloesen`'i sarar; isim geri düşüşü bilerek
  kapalı (yalnız `krankenkasse_ik` geçer). Nerede: `abrechnung.routes.js` → `/abrechnung/create`,
  `/abrechnung/preflight`, `/abrechnung/create-podologie`. Haritada `calledBy` boş görünür (route gövdeleri
  anonim) — kullanım bu üç route'tur.
  - **Açık not:** `/abrechnung/korrektur` bu yardımcıya bağlı **değil**; IK'yı orijinal dosyanın
    `abrechnung.kostentraeger_ik`'sinden alıyor. Korrektur'un orijinal alıcıya gitmesi bilinçli olabilir — karar
    gkv-302'nin. Taze türetme oraya da gerekirse ikinci kural yazılmaz, bu fonksiyon bağlanır.
- 30.09 (canli-test P3) — `katalog-suche.js` → `gespeicherterKodeHinweis(sb, feldwert, bereich)`.
  Niye: kayıtlı, endständig olmayan ICD reçete yeniden açıldığında da S3.6 uyarısını göstersin. Metni kendisi
  üretmez, `nichtEndstaendigHinweis`'i yeniden kullanır; katalog araması `searchDiagnosen` üzerinden.
  Nerede: `attachDiagnoseSearch` içindeki `katalog:gespeichert` dinleyicisi; olayı `module/verordnung-maske.js`
  `rzIcd`/`rzIcd2` doldurulunca atar. `attachDiagnoseSearch`'in tek bağlandığı yer `DIAGNOSE_FIELDS`
  (`rzIcd`, `rzIcd2`, `rzDg`) — başka ICD giriş yolu yok, kapsama tam.
- 30.09 (canli-test P1/P3) — ICD sondaki "-" kodun parçası değil (gkv-302). Yeni: `api-backend/billing/utils/icd-code.js`
  → `icdOhneStrich` (tek ortak backend normalizer; frontend karşılığı `icd-dg-match.js` `normalizeIcd`), `icdAbfrageKodes`
  (icd10_titles için k ve k- birlikte), `icdTerminalMap` (tiresiz anahtarlı harita, terminal=false kazanır). Nerede: preflight
  `isValidIcd10`/V:01016, `builder.js` DIA listesi, `abrechnung.routes.js` mapper + terminal sorgusu. Ayrıca `katalog-suche.js`
  → `setzeNichtEndstaendigHinweis` (hint DOM, eskiden `attachDiagnoseSearch` içinde kapalıydı) + `hinweisFuerGespeichertenKode`
  (dinleyici bağlı olmasa da çalışır; `verordnung-maske.js` `fuelleMuster13` doğrudan çağırır — taze yüklemede focusin yoktu).

### 30.09.2026 · Reform S3.8a — Karten-IK ≠ Kostenträger-IK; yerel "bugün"
- e665aca — Reform S3.8a (gkv-302, Anlage 1 TP5 V21 §5.5.2 / §5.5.3.1). Niye: Karten-IK (kartta
  basılı) `prescriptions.krankenkasse_ik`'ye yazılır; Kostenträger-IK **her zaman ondan türetilir**,
  DTA'daki sessiz geri düşüş kaldırıldı. Yeni:
  - `kartenIkNormalisieren` — **bilinçli ayna**: `module/krankenkasse-suche.js` ↔
    `api-backend/lib/rezept-felder.js`. Sunucu karar verir, ikisi birlikte değişir.
  - `kartenIkHinweise`, `kartenIkStatus`, `kasseAbrechnungsbereit` (`krankenkasse-suche.js`).
  - `kostentraegerAbfrage` (`rezept-felder.js`) — `kostentraeger_auswahl` view'ının filtre aynası
    (echt/active/gkv/valid_to). View'ın filtresi değişirse bu da değişir.
  - `kartenIkPflicht` (`dta/builder.js`), yeni `api-backend/billing/utils/karten-ik.js` →
    `kartenIkFehler`, `istKartenIk`; preflight kuralı `V:01017`.
  - Nerede: Muster-13 maskesi, OCR, `/rezept/confirm`, DTA mapper'ları, §302 liste "bereit" rozeti
    (`dashboard.js` + `abrechnung-auswahl.js`).
  - ⛔ **İkinci IK çözümleyici yazılmaz.** Tek kaynak: `kostentraegerIkAufloesen` (sunucu, karar) /
    `aufgeloesteIk` (istemci, yalnız gösterim).
- d92e422 — `dashboard.js`'te 7 "bugün" varsayılanı `toISODate` (= `alsISODatum`) ile yerel güne.
  Kural: "bugün" için `toISOString().slice(0,10)` yazılmaz (akşam saatinde ertesi güne kayar).
  - **Kalan örnekler (30.09 sayımı, dokunulmadı — karar sahibi builder/Kemal):** `dashboard.js`
    3 yer (biri dosya adı, zararsız); `module/` altında `abrechnung-detail`, `behandlungsbestaetigung`,
    `rechnung-zahlungseingang`, `termin-leistungen`, `zuzahlung-befreiung`; ve **S3.8a'nın kendi
    `kostentraegerAbfrage` varsayılan parametresi** (sunucu, UTC konteynerde gece 00–02 arası
    `valid_to` filtresi bir gün geride kalır — küçük ama aynı kural).

### 30.09.2026 · Podoloji reform sprinti — tarih biçimleyici birleşimi, S2.3b onay geçerliliği
- f30f407 — `module/datum.js` yeni `datumDe(wert, leer='')`. Niye: `eingangsbefundung-regel.js` ve
  `fussbefund-archiv.js`'teki iki farklı davranışlı kopya tek yere indi (Kemal onayı). Saf
  YYYY-MM-DD regex'le (saat dilimi kayması yok), zaman damgası `alsISODatum` ile yerel güne.
  Nerede: `befundungFuerLeistung` (regel dosyası `datumDe`'yi re-export ediyor, eski importlar
  kırılmıyor) ve `renderFussbefundArchiv` (`leer='—'`). 29.09 kaydındaki regel-içi `datumDe` artık
  buraya taşındı.
  - **Bilinçli dokunulmayan kopya adayları** (karar Kemal'in, INDEX'te aday olarak kalır):
    `verordnung-aus-ocr` → `alsDeutschesDatum`, `verordnung-pruefung` / `heilmittel-fristen` →
    `deDatum` ve benzerleri. Yeni tarih biçimleyici yazılmaz — `datumDe` kullanılır.
- f8ea2aa — Reform S2.3b: `bestaetigungNochGueltig` + `gueltigBestaetigteIds`, ayna çifti
  `api-backend/billing/utils/offene-einheiten.js` ↔ `module/offene-einheiten.js` (S2.3'ün devamı).
  Niye: Bereit'te açık birimle onaylanan reçete Erstellen'de ikinci kez sorulmasın; offen sayısı
  değiştiyse veya ileri tarihli Termin varsa onay düşer, yeniden sorulur. Nerede: sunucu kapısı
  `abrechnung.routes.js` → `create-podologie`; istemci `module/abrechnung-auswahl.js` (ön seçim +
  onay diyaloğundan hariç tutma). ⚠️ `prescription_validations`'ı **okuyan ilk yer** (önceden
  yalnız yazılıyordu) — tablonun kolon/anlam değişikliği artık bu iki kapıyı da etkiler.
  Ayna kuralı S2.3 ile aynı: sunucu otorite, ikisi birlikte değişir.

### 29.09.2026 · Podoloji reform sprinti S1.12 + S2 + S3 — Befundpauschale önerisi, Test dosyası, Abrechnung/Termin/Fahrtenbuch
- S2.1 (13d4351) — `api-backend/billing/api/betriebsart.js` yeni `verordnungFestschreiben(betriebsart)`.
  Niye: §302 Test dosyası (Anhang 2 Kap. 9 §5, keine Zahlung) reçeteye `belegnummer` yazıp GoBD
  kilidini tetikliyordu, reçete bir daha faturalanamıyordu. Nerede: `abrechnung.routes.js` →
  `create-podologie` — test'te `prescriptions` güncellemesi ve belegnummer döngüsü atlanır.
  ⚠️ Physio `/abrechnung/create` ve Korrektur yolunda aynı hata **bilerek bırakıldı** (fizyo
  ertelendi) — o yollara dokunulduğunda bu yardımcı oraya da bağlanmalı, ikinci kural yazılmamalı.
- S1.12 (ee51827) — `module/termin-leistungen.js`: `mitBefundungsvorschlag()` artık satır eklemiyor,
  `vorschlag` döndürüyor; yeni `vorschlagText()`, `zeilenFuerTermin()`, `raeumeAngenommenenVorschlag()`,
  iç `zeichneVorschlag()`/`serieAktiv()`. Niye: 05.09 kararı ("Befundpauschale önerilir, işaretsiz")
  arayüzde uygulanmamıştı; öneri otomatik satır olarak kaydediliyor, S1.10'dan beri her seri
  randevusuna 78030 (yeni hastada 78040) kopyalanıyordu. Nerede: Terminmaske (tekli + seri,
  "Serie verteilen" dahil), `speichereLeistungen`. `module/eingangsbefundung-regel.js` yeni
  `datumDe()` (ISO→TT.MM.JJJJ), ipucu metni "eingeplant/dokumentiert".
  `api-backend/billing/dta/befundpauschale-regeln.js` (d)+(e) iki sert kural; frontend aynası
  `module/abrechnung-auswahl.js` → `podoBefundOhneBehandlung()`. Kural iki yerde bilinçli (sunucu
  otorite, istemci ön uyarı) — ayna değişirse ikisi birlikte değişir.
  - **Kopya adayı notu:** `eingangsbefundung-regel.js` artık iki farklı `?v=` ile import ediliyor
    (`termin-leistungen` → 20260929, diğerleri → 20260920s). Tarayıcı iki ayrı modül örneği yükler.
    Saf modül olduğu için bugün zararsız; modüle durum (state) eklenirse iki kopya ayrışır.
    Bir sonraki dokunuşta `?v` birleştirilmeli.
- S2.2 (36fb9ff) — `module/abrechnung-detail.js` yeni `etikettFuer()`, `istTestDatei()`. Niye: dosya
  detayında karışık dil + test dosyası gerçek dosyadan ayırt edilmiyordu. Nerede: Abrechnung → dosya detayı.
- S2.3 (2c3fc45) — `api-backend/billing/utils/offene-einheiten.js` + ayna `module/offene-einheiten.js`.
  Niye: açık birim = `anzahl_einheiten` − iptal edilmemiş `podologie_behandlungen`; açık birimle
  faturalamada 428 `OFFENE_EINHEITEN`, bilinçli onay `prescription_validations`'a yazılır. Kural iki
  yerde bilinçli (sunucu kural sahibi). ⚠️ Ham satırda `anzahl_einheiten`, `verordnung-topf`'ta
  `behandlungseinheiten` — ayna değişirse ad çevirisine dikkat.
- S2.4 (9a71119) — `module/abrechnung-auswahl.js` yeni `ansichtNachErstellung()`: Erstellen sonrası
  "Bisherige"ye geçiş kararı; boş durumda protokol çizimi. Nerede: Abrechnung → Erstellen.
- S2.6 (8486dee) — `api-backend/billing/dta/hausbesuch-regeln.js` `hausbesuchRegeln()` + ayna
  `podoHausbesuchSperren()` (`abrechnung-auswahl.js`) + yeni `module/podo-hausbesuch.js`
  (Tagesbehandlung). Niye: 79933/79934 yalnız Hausbesuch=Ja iken faturalanabilir (Podo Anlage 3 c)).
- S2.7 (e2144ac) — `api-backend/billing/utils/ik-fehlt.js` `ikFehltAntwort()` + ön yüz `zeigeIkKnopf()`
  (`abrechnung-auswahl.js`). Niye: IK yoksa anlaşılır metin + Einstellungen'e düğme.
  - **Kopya notu (bilinçli bırakıldı):** IK çözümlemesi 3 yerde (physio upsert, podo, korrektur) —
    birleştirilmedi; fizyo ertelendiği için. O yollara dokunulduğunda tek yardımcıya indirilmeli.
- S3.1 (1fb3a7e) — yeni `module/lead-felder.js`: `leadGeburtsdatum`, `leadHausbesuch`,
  `leadMetadataZusammenfuehren`. Niye: `leads` sütunu kaynak, metadata üzerine yazılmaz birleştirilir.
- S3.2 (f117668) — yeni `module/vorlagen-seed.js` (`DEFAULT_VORLAGE_SEEDS`, `fehlendeSeedZeilen`,
  `seedeVorlagen`): tek toplu insert yerine satır satır fallback; migration 0043. `seedMissingVorlagen`
  `dashboard.js`'te ince sarmalayıcı olarak duruyor, gövdesi bu modüle indi.
- S3.3/S3.4 (cc6f346) — Fahrtenbuch: `window.__fb`, `saveQuickVehicleHandler`, `openQuickVehicleModal`
  **SİLİNDİ** (araç hızlı-ekleme ikinci yolu). Yerine `openVehicleEditModal(v, { zurueckZuFahrtStart })`;
  `saveVehicleEdit` → çekirdek `saveVehicleEditCore`. Kopya kapandı: araç kaydı tek yoldan.
- S3.5 (a541ae3) — yeni `module/termin-fehler.js`: Terminmaske hata kutusu (Speichern düğmesi yanında),
  `confirm()` yerine kendi dialog.
- S3.6 (5e764a8) — `katalog-suche.js` yeni `nichtEndstaendigHinweis()`; preflight `icdTerminal` → V:01016
  uyarısı. Nerede: ICD seçimi + Podologie-Preflight.
- S3.7 (22480aa) — yeni `module/podo-arztangaben.js`, `module/lanr-pruefung.js` (preflight `isValidLanr`
  aynası), `api-backend/billing/utils/arztangaben.js` `fehlendeArztangaben()`. Niye: Arzt-Nr./imza
  yoksa ne Behandlung ne "Bereit". LANR kuralı iki yerde bilinçli (sunucu otorite).
- S3.9 (0418566) — `katalog-suche.js` closeDropdown/Escape: liste güvenilir kapanır, Escape yalnız listeyi kapatır.
- S3.10 (410cc6f) — `customer_name` yalnız ad; okuyucular eski veriyi `parseNameMitGeburt` ile tolere eder.
- S3.11 (7331d46) — `termin-leistungen.js` yeni `zeilenMinuten()` (süresiz Befundpauschale = 0 dk);
  `schlageBefundungVor` export edildi (Folgetermin yolu kullanıyor).
- S3.13 (46faff6) — yeni `module/fahrt-beenden.js`: Tagesbehandlung'dan "Fahrt beenden";
  `openFahrtEndModal` opsiyonel bağlam alır (ikinci modal yazılmadı).

### 28-29.09.2026 · Podoloji reform sprinti S1 — Termin ↔ Verordnung, Tagesbehandlung
- S1.11 (24d751b) — yeni `module/termin-mail-angebot.js`: `mailAngebotZustand` (saf),
  `istPodoOhneRechnung`, `oeffneMailAngebotModal`. `openMailOfferModal` `dashboard.js`'ten buraya
  **taşındı** (kuşatma, -52 satır). `meldePodoSerienBindung` artık `_physioFlow.podo = true` koyuyor;
  `proceedToRechnungForPhysio` podo'da erken çıkıyor. Niye: podo serisinden sonra, henüz tek seans
  yokken fatura adımı açılıyordu (podoloji kararı). Nerede: `maybeOfferAppointmentConfirmEmail`.
  Ayrıca `zeigeVerordnungenFuerTermin` artık `sb/ownerId/leadId`'yi `rendereVeroKarten`'a geçiyor —
  maskedeki Verordnung sayacı podo'da 0/3 gösteriyordu (S1.3 podo dalı maskeye de bağlandı).
- S1.10 (32f1a4d) — `module/termin-leistungen.js`: `speichereLeistungen` artık tek id YA DA dizi
  alıyor; yeni `speichereLeistungenFuerErstellte(created, {showToast})`. Niye: seri randevuları
  (`batch-create`, `batch-create-explicit`) `booking_leistungen` yazmıyordu, KI yolu süreyi
  katalogdan alıyordu (canli-test P1: 65 dk yerine 35 dk). Nerede: `bkSaveBtn` manuel seri dalı,
  `aiSuggestConfirm`; `aiPrefSubmit` ve onay payload'ı `duration: leseDauer()`. Backend
  `ai-suggest-series` isteğe bağlı `duration` (1-480) alıyor, yeni route yok. Tekil ve seri
  kayıt aynı yazıcıdan geçiyor — `booking_leistungen` için ikinci yazan yol açılmadı.
- S1.9 (dbd79f0) — `module/heilmittel-fristen.js` yeni `pruefeBehandlungsbeginn` (saf; 28/14 gün,
  Berlin günü). `module/frequenz-pruefung.js` yeni `pruefeErsttermin` (yalnız podo, yalnız ilk
  randevu → BLOK); `bewerteAbstand` 4. parametre `pruefeUnterbrechung`; `pruefeFrequenz` podo'da
  `ladePodoTermine`'den okuyor, kesinti kuralı yok, UI1/UI2 muaf. Niye: `gkv-302`, HeilM-RL §16
  Abs. 4 S. 5 ve §15 — eski kod FAK Nr. 11'i ters okuyordu (podolojiye 12-hafta kesinti kuralı
  uyguluyordu); podo frekans kontrolü `prescription_sessions` üzerinden sayıldığı için fiilen
  ölüydü. Nerede: `bkSaveBtn`, `aiSuggestConfirm` (KI seri yolu, `batch-create-explicit` öncesi).
  **Tek kaynağa inen hesaplar:** `podologie-abrechnung.js` `vordAlerts` / `podSaveBehBtn` ve
  `dashboard.js` `computeRxDeadlineAlerts` / `loadUeberblickDeadlines` artık ortak
  `behandlungsbeginnFrist` kullanıyor (dringlich önceden atlanıyordu). 14/28 hesabının ön yüzde
  ikinci bir kopyası kalmadı. Bilinçli ayna: `api-backend/ai/validators/standardRules.js`
  (`DEFAULT_/DRINGEND_GUELTIG_TAGE`) — ayrı deploy yüzeyi, kopya adayı sayılmaz; kural değişirse ikisi.
- S1.8 (72e56cb) — `module/podo-einheiten.js`: yeni `bindePodoSerie`, `bindePodoSerieVonRezept`,
  `meldePodoSerienBindung`; `zeichnePodoEinheiten` yeni `aufSerie` enjeksiyonu; `ladeVerordnung`
  select'ine `frequenz`, `hausbesuch`. Niye: podolojide seri düğmesi gizliydi; KI seri yolu podo
  reçetesinde `prescription_sessions` üretiyordu (tuzak — podolojide seans tablosu yok). Nerede:
  `linkBookingsToPrescriptionSessions` başı (karar `rx.therapie_bereich`'e göre) + manuel
  `batch-create` yolu. Aşımda bağlama yapılmaz, fazla randevular bağsız kalır (`podoloji` +
  `gkv-302`, Anlage 3 lit. f).
  `module/termin-aktionen.js`: yeni `frequenzErkannt`, `normalisierePodoFrequenz`;
  `uebernimmSerienfrequenzAusRx` + `setFreqValue` `dashboard.js`'ten buraya **taşındı** (kuşatma).
  Niye: boş/tanınmayan podo frekansı sessizce haftalığa düşüyordu; "alle N Wochen"da eski hafta
  günü kutuları işaretli kalıp batch-create'te fazla randevu üretiyordu (**Physio'yu da
  etkileyen** hata). Nerede: `verteileOffeneSitzungen` (yalnız podo dalı), `openBookingFromRxPreset`.
- S1.4 (45d91c3) — yeni `module/podo-behandlungen-oeffnen.js`: `oeffnePodoBehandlungen`
  `dashboard.js`'ten buraya **taşındı** (kuşatma; `dashboard.js`'te ince sarmalayıcı +
  `podoBehandlungenDeps()` enjeksiyonu). İkinci parametre `{ vordId, datum, mehrdeutigFragen }`
  — niye: tarihsiz `setPodVorwahl` çağrısı Tagesbehandlung ön seçimini eziyordu; eski
  çağıranlar yalnız `leadId` ile çağırıyor, davranışları değişmedi. Yeni yardımcılar
  `terminIstPodo`, `terminDatum`, `terminInZukunft`, `terminStartenPodo`. Nerede:
  `handleTerminStarten` (normal + Hausbesuch dalı) — podoloji randevusu artık Physio'nun
  `markPrescriptionSession` yolunu değil Tagesbehandlung'u açar (reçete + randevu günü).
  Gelecek tarihli randevuda onay sorulur; bağsız randevu + 2 laufend reçetede ön seçim
  yapılmaz (`podoloji` ajanı önerisi). Bu, `podBehandlungsdatumVorschlag`/`setPodVorwahl
  { datum }` için beklenen ilk çağıranı bağladı (aşağıdaki 2d8aea5 maddesi).
- S1.3 (2a596dc) — `TERMIN_SELECT` ve `loadScheduleBookings` select'ine `verordnung_id`;
  `openBookingActionModal` `wunschRx` zincirine `booking.verordnung_id`;
  `module/termin-verordnung.js` `rendereVeroKarten` opsiyonel `sb/ownerId/leadId` + podo dalı
  (`ladePodoTermine` + `terminZaehler`, sayaç `[data-vero-zaehler]` asenkron dolar). Niye:
  panel podolojide aynı anda "0/3" ve "keine aktive Verordnung" gösteriyordu (podolojide
  `prescription_sessions` yok, sayım `bookings.verordnung_id` üzerinden). Nerede:
  Termin-Aktionen paneli.
- `module/termin-verordnung.js` `waehleVerordnung` podo dalı (b41d31d) — niye: kartla
  kaydedilen podoloji randevusu `bookings.verordnung_id` almıyordu. Nerede: Terminmodal kart
  seçimi (`dashboard.js` `selectVerordnung`).
- `module/termin-verordnung.js` `zeigeVerordnungenFuerTermin`, `resetVerordnungFelder`,
  `verdrahteAbwahl`, `aktualisiereBindungBeimSpeichern` (2db4146) — niye: düzenleme penceresi
  Verordnung kartlarını gizliyordu, UPDATE kolu bağlamıyor/çözmüyordu; `loadBkVerordnungen` ile
  `openBookingModal`'ın **ortak** kart-yükleme yolu (ikinci bir yükleyici yazılmasın diye).
  Nerede: `openBookingModal`, `loadBkVerordnungen`, `bkSaveBtn` UPDATE kolu.
- Yeni `module/podo-behandlungsposition-regel.js` `behandlungspositionVorschlag` +
  `podologie-abrechnung.js` `podVordBehandlungsposition`; `erstePositionAusItems` artık
  `verordnung-pruefung.js`'ten export (65a1b9e) — niye: Tagesbehandlung reçetedeki tedaviyi
  önseçmiyordu (a/b → 78010, c → 78010 öneri); export, 3. kopya yazılmasın diye. Nerede:
  `loadPodologieBilling` Leistung kutuları.
- Yeni `api-backend/billing/dta/befundpauschale-regeln.js` `befundpauschaleRegeln` + ön yüz
  aynası `module/abrechnung-auswahl.js` `podoBefundOhneBehandlung` (0520c3f) — niye: 78030 aynı
  gün tedavisiz = sert blok, 78040 reçetede hiç tedavi yoksa = atlanabilir blok (`gkv-302`).
  Nerede: `create-podologie` sperren döngüsü; Neue Abrechnung listesi.
  **BİLİNÇLİ AYNA** (backend/frontend ayrı deploy yüzeyi) — kopya adayı sayılmaz; biri
  değişirse ikisi.
- Yeni `module/podo-behandlungsdatum-vorwahl.js` `podBehandlungsdatumVorschlag`,
  `setPodVorwahl(id, { datum })` genişledi (2d8aea5 + hotfix 94c753c) — niye: Tagesbehandlung
  tarihi hep "heute" idi. Nerede: **henüz çağıran yok**; S1.4 "Termin Starten"
  `setPodVorwahl(vordId, { datum: randevu günü })` ile bağlayacak.
- `tools/check-syntax.sh` (pre-commit, 90c5652) — niye: 2d8aea5'teki template-literal backtick
  hatası canlı dashboard'u boşalttı; `npm test` o modülü yükleyemiyor.

### 26.09.2026 · Ops #304 Nachtrag — iki ICD alanı, DG'ye tek yazan
- **Yeni modül `module/icd-dg-verdrahtung.js`** (`verdrahteIcdDg`, `icdAufZweiFelder`,
  `icdKodesAusFeld`) — `dashboard.js` `_wireDgIcdPair` buraya taşındı (kuşatma). Niye: test
  edilebilsin (`module/icd-dg-verdrahtung.test.js` 19 test + `tools/browser-probe/icd-dg-probe`
  gerçek maskede klavye/Tab ile 15 kontrol) ve kurallar: (1) `rzIcd` **ve** `rzIcd2` birlikte
  sayılır; (2) ilk alanda iki kod + ikinci boş → çıkışta ikinci kod `rzIcd2`'ye (`icd10` tek kod:
  `preflight.js` V:01002); ≥3 kod → taşınmaz, ipucu + kaydederken `formatErrors` (sperre yok —
  `gkv-302`: 3+ kodlu Verordnung geçerli); (3) Fachbereich **maskeninki** (`rzTherapieBereich`),
  yoksa mandantınki — `praxis` mandantında kural yoktu, otomatik susuyordu; (4) DG elle
  boşaltılınca hemen yeni öneri; (5) "passt nicht" ipucu uygun grupları da söyler.
  Fachlich: `podoloji` + `gkv-302` 26.09.2026. İlk kullanım: Muster 13.
- **Kopya kararı verildi (26.09.2026, kullanıcı devretti):** `rzDg`'ye otomatik yazan artık
  yalnız `verdrahteIcdDg`. `module/verordnung-podo.js` `dgAuswahlEingrenzen` yalnız seçim
  listesini daraltır (`data-pod-erlaubt`), DG yazmaz, "passt nicht / zulässig" satırlarını da
  basmaz. Niye: iki yazan + iki kriter = ağ yarışı; işaretsiz DF hiç geri alınmıyordu (d/d2
  canlıda bu yüzden kaldı) ve aynı ipucu iki yerde çıkıyordu.
- `api-backend/billing/dta/preflight.js` — `icd10` boş + `icd10_2` dolu: V:01002 boş alanda
  yanlış alarm veriyordu ve tek kod hiç denetlenmiyordu (`gkv-302` buldu). `preflight.test.js` +1.
- `dashboard.js` `podoCtx()` — ölü `_wireDgIcdPair` aktarımı silindi. `wireM13Toggles` —
  Fachbereich değişince ICD yeniden değerlendirilir.
- i18n `pod_icd_nach_feld2`, `pod_icd_je_feld` (de/en/tr) · cache `dashboard.js` ve
  `verordnung-podo.js` `?v=20260926a` · `modul-probe.html` listesi · `npm run probe` +`icd-dg-probe`.

### 25.09.2026 · Ops #304 — DG-Automatik nimmt nur Eindeutiges, Papierwert gewinnt
Yeni fonksiyon yok, silinen yok; davranış değişikliği.
- `icd-dg-match.js` `dgVorschlag()` — `auto` artık yalnız başka hiçbir grup `icd_accept` ile
  eşleşmiyorsa döner (`kandidaten.every(k => k === auto)`). Niye: E11.74 + L60.0 `auto:'DF'`
  veriyordu, oysa DF/UI1/UI2 hepsi mümkün; DG kâğıttan gelmeli (Podologie-Vertrag Anlage 3
  Ziffer 5 j). **`autoSelectDg` bilinçli olarak değişmedi** — `api-backend/ai/validators/icdDgRules.js`
  ile parite (ayna çifti, biri değişirse ikisi). Tek tüketici: `dashboard.js` `_wireDgIcdPair`.
- `dashboard.js` `_wireDgIcdPair` — `dataset.manualOverride` kalktı, yerine `dataset.dgAuto`
  (otomatiğin kendi koyduğu değer). `_setDgProgrammatically` yalnız boş alanı ya da kendi
  değerini değiştirir; `''` kendi önerisini geri alır (ICD alanından çıkışta: belirsiz ya da ICD
- `module/icd-dg-verdrahtung.js` `icdMehrAlsEinKodeJeFeld` (26.09.2026 akşam) — `saveRezept`'teki
  „Trotzdem speichern?" kuralı modüle alındı. Niye: canlı turda yerel `confirm()` otomasyonla
  doğrulanamadı; kural artık testli. Tek kullanım: `dashboard.js` `saveRezept`.
  silindi). `markManual` yalnız `change`'i dinler, `dgAuto`'yu siler → focusin/`input` dürtüsü
  ve `verordnung-podo.js:schreibe()` otomatiği artık kapatmaz. >1 aday → aday ipucu her zaman.
- `dashboard.js` köprü `ensureDgIcdWiring` (tek çağıran `module/verordnung-maske.js`
  `fuelleMuster13`) — yüklemeden önce `dgAuto` silinir: tarama/düzenleme/Folgeverordnung ile
  gelen DG kâğıt değeridir, üzerine yazılmaz.
- i18n `pod_icd_mismatch` (de/en/tr) yeniden yazıldı · cache `?v=20260925a` · `module/icd-dg-vorschlag.test.js` +2 test.
- İlk kullanım: Rezept-Maske Muster 13 (`rzIcd` → `rzDg`), podoloji.
- **Açık kalan:** DG alanına ikinci yazan yol `module/verordnung-podo.js` `dgAuswahlEingrenzen` /
  `podRegelnLaden` — kopya kartı Melih'te, karar bekliyor. Bu değişiklik onu çözmedi, yalnız
  `schreibe()`'nin otomatiği kapatmasını engelledi.

### 01.10.2026 · Reform 3.12 — PHI-Schattenspalten aus, Fahrtenbuch ohne Patientendaten
- `module/fahrtenbuch-regeln.js` (neu): `fahrtReferenz` (P-XXXXXXXX aus `booking_id`, keine neue Spalte),
  `fahrtZweckUndZiel`, `fahrtAnzeigeText` (maskiert lead_id-Zeilen + Altzeilen „Hausbesuch <Name>"),
  `fahrtenbuchCsv` (11 Spalten, kein Name/Anschrift), `patientenverzeichnisCsv` (getrennter Export,
  nur auf Anforderung des Finanzamts), `csvHerunterladen`. Niye: S-35, legal-de/OFD Frankfurt 19.01.2011.
  Nerede: `dashboard.js` `saveFahrtEndHandler` (Upsert), `loadFbFahrten`, `openFbFahrtEditModal`,
  `exportFbFahrtenCsv` + neuer `exportFbPatientenverzeichnisCsv` (Knopf `fbFahrtenExportVerz`).
- Backend: `/rezept/confirm` + `PATCH /rezept/:id` schreiben `ocr_raw_response`/`ocr_raw_enc`/`icd10_enc`/
  `phi_encrypted` nicht mehr; `encryptPHI`-Import + Start-Warnung aus `server.js` entfernt
  (`lib/phi-encrypt.js` + Schlüssel-Selbsttest bleiben). Wächter: `api-backend/lib/phi-nicht-schreiben.test.js`.
- `select('*')` auf `prescriptions` im Browser verengt: `rechnung-dmrz.js`, `dashboard.js` `handleSessionDrop`.

### 30.09.2026 · Podologie-Reform S4-1 (commit 8716a3d) — Aktionsleiste, Folgetermin, Vorbelegungsgrund, Behandlungstag
- `module/termin-aktionsleiste.js` (neu): `verdrahteAktionsleiste`, `verordnungsZiel`, `SICHTBARE_AKTIONEN`,
  `MENUE_AKTIONEN`. Niye: Konsey S0 (30.09) — rechtes Terminpanel (`#bkActionModal`) höchstens 6 sichtbare
  Knöpfe, Rest im Menü „Weitere Aktionen". Nerede: Verdrahtungsaufruf in `dashboard.js`.
- `module/termin-folge.js` (neu): `folgeterminStart`, `folgeLeistungen`, `oeffneFolgetermin`, `alsLokalesDatetime`.
  Niye: Folgetermin aus dem rechten Panel — füllt die bestehende Neuer-Termin-Maske (`prefillBookingModal`)
  mit demselben Patienten/Hausbesuch/Verordnung/Leistungen, Datum aus der Verordnungsfrequenz
  (`sollAbstand`). Keine zweite Maske.
- `module/podo-vorbelegung-grund.js` (neu): `tagesVorbelegungGrund`, `befundGrundText`, `verordnetZeile`.
  Niye: Konsey S0 Beschluss 2b — Grundtext zur Vor-/Vorschlagsbelegung + Zeile „Verordnet: 78xxx".
  Keine neue Regel, nur Texte. Nerede: `podologie-abrechnung.js`, `termin-leistungen.js`.
- `module/podo-behandlungstag-regel.js` (neu): `abrechenbareBehandlungstage`, `bestehenderBehandlungstag`,
  `zweiterBehandlungstagFrage`, `datumTTMMJJJJ`, `ABRECHENBARE_BEHANDLUNG`. Niye: gkv-302 30.09
  (HeilM-RL § 12 Abs. 8) — Rückfrage beim zweiten Eintrag am selben Tag (`podologie-abrechnung.js`
  `loadPodologieBilling`) und „Bereit" nur mit ≥1 abrechenbarem Behandlungstag (`abrechnungsstatus.js`
  `oeffneStatusDialogFuer`).
- Signaturänderungen: `setzeAktionsSichtbarkeit(hatTermin, podologie)` (termin-panel.js),
  `vorschlagText(code, {…, grund})` (termin-leistungen.js).
- **Kopya adayları (fonksiyon-ustasi 30.09, karar Kemal'de, birleştirilmedi):**
  `alsLokalesDatetime` ↔ `module/datum.js` `alsDatetimeLocal` (aynı çıktı);
  `datumTTMMJJJJ` + `podo-vorbelegung-grund.js` yerel `datumDe` ↔ `module/datum.js` `datumDe`;
  `abrechenbareBehandlungstage` ↔ `verordnung-uebersicht.js` `istBehandlungseinheit` — iki ayrı soru
  (kasıtlı), ama **78620** iki yerde zıt sınıflanıyor (burada Behandlung, orada Zuschlag) → gkv-302 sorusu.

### 30.09.2026 · Podologie-Reform S4-2 (commit f14b2d8) — Fußbefund in der Tagesbehandlung, Folgetermin-Frage, Patientenpost-Status
- `module/podo-tag-zusatz.js` (neu): `fussbefundKopf`, `fussbefundBoxHtml`, `ladeLetzterBefund`. Niye: Konsey S0
  Beschluss 1a — aufklappbarer Fußbefund-Abschnitt in der Tagesbehandlung; zu nur „zuletzt am …", auf wird die
  vorhandene Karte (`mountFussbefund`) eingesetzt, die selbst nach `pat_fussbefund` schreibt — kein zweiter
  Schreibweg. Nerede: `podologie-abrechnung.js` `loadPodologieBilling`.
- Ebenda `folgeAusgangstermin`, `ladeTagesTermin`, `frageFolgetermin`, `FOLGE_FRAGE` (+ `podologie-abrechnung.js`
  `fragFolgetermin`, Verdrahtung). Niye: S0 Beschluss 1b — nach dem Speichern „Folgetermin jetzt anlegen?", legt
  nichts an, öffnet die vorhandene Maske über `termin-folge.js` `oeffneFolgetermin`. Hausbesuch: erst Fahrt
  beenden, dann fragen (`fahrtBeendenKlick` → `onFertig`).
- `module/lead-status.js` (neu): `LEAD_STATUS_DE`, `leadStatusLabel`. Niye: canli-test 30.09 P3 — Patientenpost-Badge
  zeigte Rohwert (`new`, `contacted`). Nerede: `dashboard.js` `renderB2C`. Unbekannte Werte bleiben roh.
- Signaturänderungen: `mountFussbefund(deps, preset, { wurzel })` (eingebettete Wurzel; Karte bleibt ein Exemplar),
  `oeffneFolgetermin` nimmt Ausgangstermin ohne `id` (dann keine Leistungen gelesen), `zeigeFahrtHinweis` → boolean.
- **Kopya kontrolü (fonksiyon-ustasi 30.09, birleştirilmedi):** `ladeLetzterBefund` — kopya değil; diğer
  `pat_fussbefund` okuyucuları (`fussbefund.js` `ladePatientenkontext`, `fussbefund-archiv.js`
  `renderFussbefundArchiv`, `patientenkarte.js` `ladeVerlauf`) tam liste/zaman çizelgesi çekiyor, aynı
  `ist_aktuell` kuralıyla; tek-tarih okuyucusu başka yok. `leadStatusLabel` — kopya değil, lead status için başka
  etiket haritası yok (`b2bStatusBadge` ayrı tablo, `abrechnungsstatus.js` ayrı eksen). `ladeTagesTermin` ↔
  `termin-laden.js` `ladeTerminVollstaendig` kopya değil (o id ile okur); ama **yakın aday:**
  `podologie-abrechnung.js` `podGeplanteHpnr` aynı soruyu (Verordnung'un o günkü termini) soruyor ve günü
  Berlin'e göre (`alsISODatum`) kesiyor, `ladeTagesTermin` tarayıcı yerel gece yarısıyla — iki gün sınırı kuralı.
