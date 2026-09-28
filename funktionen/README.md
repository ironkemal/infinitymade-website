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
