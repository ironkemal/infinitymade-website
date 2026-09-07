# Wissensbank — Dış Kaynaklı Resmî Verinin Sicili

> **Bu dosya "o belge nereden geldi, hâlâ geçerli mi, neyi besliyor" sorusuna bakar.**
> İçinde ne yazdığı sorusuna `wissensbank/INDEX.md` bakar. İkisi farklı sorulardır;
> biri diğerinin yerine geçmez.
>
> Sahibi: `wissensbank` ajanı · Elle bakımlı · Tetikleyici: **"bilgi bankası güncelle"**
> İlk kurulum: 05.09.2026 · Son güncelleme: 07.09.2026 (W-01 zinciri kapandı, W-A08 kapandı)

---

## Bir bakışta

| | Sayı |
|---|---|
| Kayıtlı kaynak belge (INDEX'te) | 33 |
| Arşivdeki PDF | 47 (16'sının `.txt`'si yok — 5'i karantina, 11'i bilinçli kapsam dışı) |
| Arşiv boyutu | ~44 MB (`Handbücher` 8,3 · `Podoloji` 9,0 · `verordnung rezept` 27) |
| Kaynak→kod zinciri kayıtlı | 10 |
| Tam kimlik kartı yazılmış kaynak | 1 (**W-01** Kostenträgerdatei — zincir uçtan uca bağlı, 2 açık madde) |
| **Herkunft (indirme URL'i) kayıtlı** | **2 / 34** ← asıl boşluk, W-A01 |
| Otomatik tazelik kontrolü olan | 1 (sadece fiyat: `preise-check.yml`) |
| Çeyreklik ritmi olan kaynak | 1 (Kostenträgerdatei — W-01, §1 takviminde) |

## Arşiv düzeni (05.09.2026'dan beri)

Belgeler **tek yerde**: `wissensbank/`. Bölme ölçütü tek soru — *kaç Fachbereich'ı
ilgilendiriyor?* Kararsız kalınca `gemeinsam/`. Detay: `README.md`.

```
wissensbank/
├── README.md · REGISTER.md · INDEX.md · SPEC-RULES.md     ← yönetim dosyaları
├── gemeinsam/          302-tp5/ · kostentraeger/ · heilmittel-richtlinie/
│                       positionsnummern/ · icd-10-gm/
├── podologie/          Anlage 1a–3, FAK, filtrelenmiş HPNR
├── physiotherapie/     Vertrag §125 Anlage 2, Blanko-Leitfaden
├── ergotherapie/       Anlage 2 Vergütungsvereinbarung
├── logopaedie/         sssst Anlage 2
└── _archiv/            düşmüş · kapsam dışı · mükerrer
```

**05.09.2026 taşıması:** `Handbücher/` ve `verordnung rezept/` kaldırıldı, içerikleri
buraya taşındı (`git mv`, geçmiş korundu). `Podoloji/` duruyor ama artık yalnız **kendi
ürettiğimiz** işi taşıyor — prototip, ürün kararı, loop promptu, `podologie-hpnr-reference.js`.
Taşımada 22 dosyadaki 155 atıf yönlendirildi; `fortschritte/`, `archive/`, `.plans/`,
`ops/ingest/`, `compliance/legal-reviews/` **bilinçli olarak dokunulmadı** — o gün o
yoldaydı, geçmiş düzeltilmez.

---

**Üç dosya, üç ayrı soru:**

| Dosya | Soru | Bakımı |
|---|---|---|
| `wissensbank/INDEX.md` | Belgenin **içinde ne var**, hangi bölüm nerede | elle — okundukça zenginleşir |
| `wissensbank/REGISTER.md` | **Nereden geldi**, hangi sürüm, ne zaman düşer, **neyi besler** | elle — "bilgi bankası güncelle" |
| `wissensbank/SPEC-RULES.md` | Belgeden **süzülmüş kural** (kaynak+sürüm+kod satırı) | elle — kural çıkarıldıkça |

---

## 1. Geçerlilik takvimi — kritik tarihler

Bu tablo sicilin en çok bakılan yeridir. Bir tarih geldiğinde iş sadece "yeni dosyayı
indir" değil, **zincirin tamamını yürümektir** (§2).

| Tarih | Ne olur | Etkilenen zincir | Durum |
|---|---|---|---|
| **01.10.2026** | Kostenträgerdatei **Q4/2026** yürürlüğe girer. `EK05Q426KE0` (vdek) o gün GEÇERLİ olur, `EK05Q226KE0` DÜŞER. Diğer Kassenart'lar Q4 yayımlarsa onlar da o gün geçerlidir. ⛔ **Ayrıca:** DB'de bugün zaten Q4 yüklü (sürüm zamanlama hatası, W-01 madde 6) — bu tarih o maddeyi de kapatır | Z-09 → W-01 → `kostentraeger_annahmestellen` | ⏳ kayıtlı, **madde 6 buna bağlı** |
| **her çeyrek başı** (01.01 / 01.04 / 01.07 / 01.10) | Kostenträgerdatei güncellenir; yayın **en geç çeyrek başından 4 hafta önce** (Anhang 03 §2, satır 185-187). Yani kontrol günü: **03.03 · 03.06 · 03.09 · 03.12** | Z-09 | 🔁 tekrar eden, **elle** — W-01'deki kontrol yordamı |
| **01.01.2027** | HPNR-Verzeichnis 2026 penceresi kapanır, 2027 sürümü gelir | Z-05 → `podologie_positions.js`, `physio_positions.js` | ⏳ hazırlık yok |
| **01.02.2027** | **Anlage 3 TP5 V21 → V22** yürürlüğe girer | Z-02 → `anlage3_v22.js` (dosya hazır, açılmayı bekliyor) | ⏳ dosya var, geçiş planı yok |
| **01.02.2027** | **Anhang 03 Anlage 1 TP5 V10** (Kostenträgerdatei) yürürlüğe girer | Z-09 → `billing/kostentraeger/parser.js` | ⏳ parser 05.09.2026'da yazıldı |
| açık uçlu | Anlage 1 TP5 V21 geçerli (01.10.2025'ten) | Z-01 → `billing/dta/*`, `legs.js` | ✅ geçerli |
| açık uçlu | HeilM-RL 15.05.2025 değişikliği (05.08.2025'ten) | Z-07 | ✅ geçerli |
| **her fiyat turu** | Heilmittelpreisstammdatei yeni `Stand_TT-MM-JJ` | Z-06 → otomatik, Telegram bildirimi | ✅ **tek otomatik kontrol** |

> ⚠️ **Erken geçiş dosya reddi demektir.** V22 ve V10 dosyaları repoda duruyor ve kod
> dosyası (`anlage3_v22.js`) yazılmış olsa bile **01.02.2027'ye kadar V21 esastır.**
> Bu, `wissensbank/INDEX.md`'nin de yazılı kuralıdır.

---

## 2. Zincirler — kaynak belge → türev → kod → DB

**Sicilin asıl değeri burasıdır.** Bir kaynak güncellendiğinde iş, zincirin son halkasına
kadar yürünmeden bitmez. Zincirin ortasında kalan eski bir halka, sistemin *kısmen* güncel
olması demektir — ki bu tamamen eski olmaktan tehlikelidir, çünkü kimse şüphelenmez.

### Z-01 · §302 teknik spesifikasyon (EDIFACT)
```
wissensbank/gemeinsam/302-tp5/Anlage_1_TP5_V21_20260115.pdf/.txt   (V21, ab 01.10.2025)
  → wissensbank/SPEC-RULES.md                     (süzülmüş kurallar)
  → api-backend/billing/dta/*                    (SLGA/SLLA/SLEZ/SLAU/SLEK üretimi)
  → api-backend/billing/codes/legs.js            (§5.5.3.3 EHE-Segment'e dayanır)
```
Durum: ✅ geçerli. `legs.js` belgeye satır düzeyinde atıf yapıyor — **istenen desen bu.**

### Z-02 · §302 Schlüsselverzeichnisse
```
wissensbank/gemeinsam/302-tp5/Anlage_3_TP5_V21_20250919.pdf/.txt      (V21, ab 01.10.2025)  ← BUGÜN GEÇERLİ
wissensbank/gemeinsam/302-tp5/Anlage_3_TP5_V22_20260218.pdf/.txt    (V22, ab 01.02.2027)  ← GELECEK
  → api-backend/billing/codes/anlage3_v22.js
```
⚠️ **Dikkat:** kod dosyasının adı `anlage3_v22` ve baş yorumu V22 PDF'ini kaynak
gösteriyor, ama bugün geçerli olan **V21**. Baş yorum "gültig ab 01.02.2027" diyerek
dürüst davranıyor; yine de dosya adı yanıltıcı. → açık madde W-A03.

### Z-03 · Physiotherapie fiyatları
```
wissensbank/physiotherapie/20251201_Physiotherapie_Vertrag_125_Anlage_2_barrierefrei.pdf/.txt
  → api-backend/billing/codes/physio_positions.js   (ab 01.01.2026, bundeseinheitlich)
  → sync_heilmittel_katalog.js                       → DB heilmittel_katalog
  ↔ preise_pruefen.mjs                               (GKV XML ile çapraz doğrulama)
```
Not: PDF pozisyonları baştaki `X` yer tutucusuyla listeliyor; ilk hane
Leistungserbringergruppe'ye göre değişiyor (2 = Physiotherapeut, bizim varsayılan).
Bu kural kod dosyasının başında yazılı — **belgeden koda taşınan yorumun örneği.**

### Z-04 · Podologie fiyatları
```
wissensbank/podologie/20250617_Podologie_Anlage_2.pdf/.txt   (i.d.F. 01.07.2025)
  → api-backend/billing/codes/podologie_positions.js       (PODOLOGIE_PREISFENSTER)
  → sync_heilmittel_katalog.js                             → DB heilmittel_katalog
  ↔ preise_pruefen.mjs
```
⚠️ PDF layout güvenilmez: `wissensbank/podologie/*.txt` içinde bir fiyat kendi kodunun
**bir satır üstünde** duruyor. Bu, "sayı taşıyan tabloyu YZ/parser çevirmez" kuralının
(ajan §0.2) doğduğu gerçek olay.

### Z-05 · Heilmittelpositionsnummernverzeichnis (GKV-SV)
```
wissensbank/gemeinsam/positionsnummern/20251215_Heilmittelpositionsnummernverzeichnis_gueltig_ab_01.01.2026.xlsx
  → wissensbank/gemeinsam/positionsnummern/Positionsnummernverzeichnis_2026_Full.csv       ⚠ üretim yolu belgesiz
  → wissensbank/podologie/Podologie_Positionsnummern_2026_Filtered.csv    ⚠ üretim yolu belgesiz
  → Podoloji/podologie-hpnr-reference.js  (⛔ dosyanın kendisi "NICHT AUTORITATIV" diyor)
```
→ açık madde W-A04 (XLSX→CSV dönüşümü hangi araçla yapıldı, tekrarlanabilir mi).

### Z-06 · Heilmittelpreisstammdatei — **tek otomatik zincir**
```
https://www.gkv-heilmittel.de/.../Hoechstpreise-Alle-Heilmittelbereiche-Stand_TT-MM-JJ.zip
  → api-backend/preise_pruefen.mjs      (indirir, XML'i bizim sayılarımıza karşı sayar)
  → api-backend/preise_autoupdate.mjs   (yalnız kesin güvenli durumda yazar)
  → api-backend/preise_ci_extract.mjs   → .github/workflows/preise-check.yml → Telegram
```
✅ **Bu zincir, sicilin geri kalanı için model.** Kaynak URL yazılı, ne yapabildiği ve
**ne yapmayacağı** başlıkta gerekçeli. XML'in kendi Haftungsausschluss'u "nicht zu
Abrechnungszwecken" dediği için fatura kaynağı değil — **ikinci bağımsız doğrulama**.
Anlage 2 maßgeblich kalır.

### Z-07 · KBV Diagnoseliste (LHB / BVB / Blanko)
```
wissensbank/gemeinsam/heilmittel-richtlinie/heilmittel-diagnoseliste.pdf/.txt      (Stand 01.01.2026)
  → api-backend/ai/validators/data/diagnoseliste-raw.txt  (16.05.2026)
  → api-backend/ai/validators/heilmittel-catalog.json     (_meta ile, 238 LHB/BVB kaydı)
```
✅ `heilmittel-catalog.json` içinde `_meta` bloğu var (source, edition, generated_at_utc,
sayımlar) — **türev dosyada olması gereken şeyin örneği.**

### Z-08 · ICD-10-GM 2026 ⚠️ **zincir kopuk**
```
wissensbank/gemeinsam/icd-10-gm/Klassifikationsdateien/icd10gm2026syst_kodes.txt   (4,2 MB)
  → ???                                       ← BESLEME SCRIPT'İ BULUNAMADI
  → DB icd10_titles  (yalnız search_diagnosen() RPC'sinden okunur)
```
Repoda hiçbir import/seed script'i yok. Tablo dolu ama nasıl dolduğu yazılı değil. ICD-10-GM
2027 çıktığında bu iş sıfırdan çözülecek. → açık madde **W-A02, en ciddi madde.**

### Z-09 · Kostenträgerdatei / IK  → tam kart **W-01**
```
FORMAT SPEC:
wissensbank/gemeinsam/302-tp5/Anhang_03_Anlage_1_TP5_V10_20260414.pdf/.txt   (V10, ab 01.02.2027)

VERİ (dış kaynaklı, resmî) — 7 ayrı dosya, her biri kendi sürümü:
wissensbank/gemeinsam/kostentraeger/{AO05Q326_KE3, BK05Q326_KE1, IK05Q326_KE1,
                                     BN050526_KE0, LK05Q226_KE0,
                                     EK05Q226_KE0, EK05Q426_KE0}.txt
  = 22.436 satır · 660.087 bayt · 1.329 KOTR kaydı · 1.043 tekil IK · 12.133 VKG satırı
  → api-backend/billing/kostentraeger/parser.js       ✅ gerçek dosyalara karşı koşuyor
  → api-backend/billing/kostentraeger/parser.test.js  ✅ 1.329 / 1.043 regresyon testi
  → tools/kostentraeger-annahmestellen-laden.mjs      (tekrarlanabilir yükleyici, --write)
  → DB kostentraeger                  1.052 satır (1.043 gerçek IK + 9 mock_unbestaetigt)
  → DB kostentraeger_annahmestellen  11.409 satır (6 dosyanın VKG'si — EK Q2 hariç)
  ↔ DB krankenkassen.ik_number (94 kasadan 76'sı dolu) — Ops kartı #264
```
✅ **Zincir 06.09.2026'da uçtan uca kapandı** (commit `cceb528`). Parser artık mock'a
değil gerçek veriye dayanıyor; VKG alan sırası Anhang 03 V10 §7.2'ye göre düzeltildi —
eski 3 alanlı hâli yanlış pozisyonlara eşliyordu (`fields[0]` "art_datenlieferung"
sanılıyordu, gerçekte "verknüpfungsart"), hiç gerçek veriye karşı koşmadığı için
fark edilmemişti. Bütünlük iddiası artık `parser.test.js` içinde **regresyon testi**:
7 dosya okunur, 1.329 kayıt / 1.043 tekil IK sayılır — dosyalar değişirse test düşer.

⛔ **AMA: DB'de bugün YANLIŞ SÜRÜM yüklü.** `kostentraeger_annahmestellen` 6 dosyanın
VKG'sini taşır (12.133 − 724 = 11.409), ama Ersatzkassen tarafında yüklü olan
**`EK05Q426_KE0`** — yani **01.10.2026'da yürürlüğe girecek olan**. Bugün geçerli olan
`EK05Q226_KE0` yüklenmedi. Gerekçe olarak *"Q4, Q2'nin halefi"* yazılmıştı — bu,
**"en yeni her zaman doğrudur"** düşünce hatasıdır ve çeyreklik tarihli Stammdaten'de
yanlıştır. → W-01 açık madde 6.

**Format uyumu doğrulandı (05.09.2026):** dosyaların mesaj kimliği `KOTR:02:001:KV`,
Anhang 03 V10 satır 634'ün beklediği değerin aynısı. Yani V10 spec'i bu dosyaları okumak
için yapı olarak kullanılabilir. ⚠ Ama V10 **01.02.2027'de** yürürlüğe giriyor; bugün
geçerli olan (bir önceki) Anhang 03 sürümü arşivde **yok** → W-01 açık maddesi.

**Buluş notu (05.09.2026) — kapandı, tarihsel kayıt olarak duruyor:** o gün
`kostentraeger/Krankenkassen IK nummern .md` diye tek parça duran dosyanın aslında markdown
**olmadığı** anlaşıldı — EDIFACT `KOTR:02:001:KV` formatında **gerçek Kostenträgerdatei**'ydi.
Sicil kurulana kadar hiçbir yerde kayıtlı değildi ve `parser.js` yanı başında mock ile
çalışıyordu — **veri elimizdeydi, kimse bilmiyordu.** 06.09.2026'da 7 parçaya bölündü,
07.09.2026'da ham dosya silindi. → W-A08 ✅ kapalı.

### Z-10 · PLZ → Bundesland ✅ **altın standart**
```
zauberware/postal-codes-json-xml-csv (GeoNames), CC BY 4.0
  → tools/plz-orte.mjs  (dönüştürücü, kaynak URL'i başlıkta)
  → api-backend/billing/codes/plz-bundesland.json  {quelle, erzeugt: 2026-09-04, hinweis}
  → module/plz-orte.json
```
✅ Kaynak + lisans + üretim tarihi + üretim aracı + "elle düzenleme" uyarısı, hepsi
dosyanın içinde. **Diğer türevlerin ulaşması gereken standart budur.**

---

## 3. Kaynak envanteri

`wissensbank/INDEX.md`'deki 33 kayıt, sicil gözüyle. **Herkunft sütunu neredeyse tamamen
boş** — bu bir kayıt eksikliği, belgelerin şüpheli olduğu anlamına gelmez (hepsi resmî
yayıncıdan indirildi), ama bir sürüm düştüğünde yenisinin nereden alınacağı her seferinde
yeniden araştırılıyor demektir.

### §302 TP5 — çekirdek teknik anlagen

| Dosya | Sürüm | Ab | Durum | Besler | Herkunft |
|---|---|---|---|---|---|
| `wissensbank/gemeinsam/302-tp5/Anlage_1_TP5_V21_20260115` | V21 | 01.10.2025 | ✅ GEÇERLİ | Z-01 | ⬜ |
| `wissensbank/gemeinsam/302-tp5/Anlage_3_TP5_V21_20250919` | V21 | 01.10.2025 | ✅ GEÇERLİ | Z-02 | ⬜ |
| `wissensbank/gemeinsam/302-tp5/Anlage_3_TP5_V22_20260218` | V22 | 01.02.2027 | ⏳ GELECEK | Z-02 | ⬜ |
| `wissensbank/gemeinsam/302-tp5/Anhang_03_Anlage_1_TP5_V10_20260414` | V10 | 01.02.2027 | ⏳ GELECEK | Z-09 | ⬜ |
| `wissensbank/_archiv/Anhang_05_Anlage_1_TP5_20260401` | 1.0 | 01.04.2026 | 🚫 KAPSAM DIŞI (Rettungsdienst) | — | ⬜ |
| `wissensbank/gemeinsam/kostentraeger/*.txt` (7 dosya) — **veri, spec değil** | 7 dosya, ayrı ayrı | 01.04–01.10.2026 | ✅ 6 GEÇERLİ + ⏳ 1 GELECEK | Z-09 | **✅ kart W-01** |
| `wissensbank/gemeinsam/302-tp5/…Anhang_04b…xsd` + `SLP_BAS_1.2.0.xsd` | — | — | 📎 REFERANS (XML şema) | — | dosya adında ✅ |

### §302 — yan belgeler

| Dosya | Sürüm | Ab | Durum |
|---|---|---|---|
| `Gemeinsame_Umsetzungsempfehlungen_zum_Korrekturverfahren_Heilmittel_20250213` | — | 01.10.2025 | ✅ GEÇERLİ |
| `Anhang_04c…Verfahrensdokumentation-Erlaeuterungen_zum_Formular` | — | 24.09.2025 | ✅ GEÇERLİ |
| `Anhang_04c…Formular_Verfahrensbeschreibung_Image-Link-Verfahren (1)` | — | — | ✅ GEÇERLİ |
| `2024_09_01_Empfehlungen_zur_Umsetzung_der_Beschaeftigtennummer` | — | 01.09.2024 | ✅ GEÇERLİ |
| `TP5_Infoschreiben_BAHN-BKK_…_01.01.2026` | — | 01.01.2026 | 📎 REFERANS (tek kasa duyurusu) |
| `Aenderungshistorie` · `0_Änderungen` | — | — | 📎 REFERANS (değişiklik geçmişi) |
| `Anlage_4_061101` | 2.0 | 01.12.2006 | 📎 REFERANS (çok eski, teyit edilmeli) |
| `Richtlinien-Text_061120` | — | 01.06.1996 | 📎 REFERANS (çok eski, teyit edilmeli) |

### §125 SGB V sözleşmeleri ve ücret anlaşmaları

| Dosya | Sürüm / Stand | Durum | Besler |
|---|---|---|---|
| `20251201_Physiotherapie_Vertrag_125_Anlage_2_barrierefrei` | Lesefassung, ab 01.01.2026 | ✅ GEÇERLİ | Z-03 |
| `wissensbank/podologie/20250617_Podologie_Anlage_2` | i.d.F. 01.07.2025 | ✅ GEÇERLİ | Z-04 |
| `wissensbank/podologie/20250617_Podologie_Anlage_1c_Leistungsbeschreibung` | i.d.F. 01.07.2025 | ✅ GEÇERLİ | podoloji akışı |
| `wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung` | i.d.F. 16.06.2025 | ✅ GEÇERLİ | podoloji akışı |
| `wissensbank/podologie/20250617_Podologie_Aenderungsvereinbarung` | 16.06.2025 | ✅ GEÇERLİ | — |
| `wissensbank/podologie/20240725_Anlage_1a` + `1b_Leistungsbeschreibung` | i.d.F. 17.06.2024 | ✅ GEÇERLİ | — |
| `wissensbank/podologie/20230524_Podologie_FAK_bf` | Stand 24.05.2023 | ✅ GEÇERLİ | HPNR referansı |
| `20260212_Vertrag_125_sssst_Anlage_2_Verguetungsvereinbarung` | i.d.F. 12.02.2026 | ✅ GEÇERLİ | Logo/Stimme — ⬜ koda girmedi |
| `20240531_Ergo_Anlage_2_Vertrag_nach_125…` | Stand 01.06.2024 | ✅ GEÇERLİ | Ergo — ⬜ koda girmedi |
| `20220421_Lesefassung_Anlage_3_Ernaehrungstherapie` | 25.04.2022 | 🚫 KAPSAM DIŞI (Ernährungstherapie) | — |
| `wissensbank/gemeinsam/302-tp5/GGT` | ab 01.01.2026 | ✅ GEÇERLİ | — |
| `wissensbank/physiotherapie/anlage2.txt` | — | 01.01.2026 | ⬜ hangi Fachbereich, netleştirilmeli |
| `Podoloji/…HPNR…_2026.xlsx` + 2 CSV | Stand 15.12.2025, ab 01.01.2026 | ✅ GEÇERLİ | Z-05 |

### Heilmittel-Richtlinie, Diagnoseliste, ICD

| Dosya | Sürüm / Stand | Durum | Besler |
|---|---|---|---|
| `wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05` | değişiklik 15.05.2025, iK 05.08.2025 | ✅ GEÇERLİ | Z-07 dolaylı |
| `wissensbank/gemeinsam/heilmittel-richtlinie/heilmittel-diagnoseliste` | Stand 01.01.2026 | ✅ GEÇERLİ | **Z-07** |
| `wissensbank/gemeinsam/icd-10-gm/` (ICD-10-GM 2026) | Klassifikation 12.09.2025 | ✅ GEÇERLİ | **Z-08 ⚠ kopuk** |
| `wissensbank/gemeinsam/heilmittel-richtlinie/praxiswissen-heilmittel` | Ausgabe 2026 | 📎 REFERANS | — |
| `wissensbank/physiotherapie/NOVENTI-Leitfaden-Blankoverordnung-Physiotherapie` | Stand 03.2026 | 📎 REFERANS (ticari kaynak, otorite değil) | — |
| `wissensbank/_archiv/Zusatzdateien/*.pdf` (11 adet) | 2026 | 🚫 KAPSAM DIŞI (Barthel, MMSE, FIM…) | — |
| `wissensbank/_archiv/_duplikate_2026-08-04/` (5 PDF) | — | 🗄 KARANTİNA | — |

---

## 3b. Tam kimlik kartları

### W-01 · Kostenträgerdatei Sonstige Leistungserbringer (TP05) — IK/DAS yönlendirme verisi

- **Dosya:** `wissensbank/gemeinsam/kostentraeger/` — **7 ayrı `.txt`**, yayıncının kendi
  adlarıyla (`AO05Q326_KE3` · `BK05Q326_KE1` · `IK05Q326_KE1` · `BN050526_KE0` ·
  `LK05Q226_KE0` · `EK05Q226_KE0` · `EK05Q426_KE0`) · 22.436 satır · 660.087 bayt · türev yok
  • 06.09.2026'da bölündü; 07.09.2026'da ham tek parça `Krankenkassen IK nummern .md`
  **silindi** (W-A08 (c) — bölünme byte-exact doğrulandı, aşağıya bak)
- **Herkunft:** https://www.gkv-datenaustausch.de/leistungserbringer/sonstige_leistungserbringer/kostentraegerdateien_sle/kostentraegerdateien.jsp
  (eski sürümler: `…/kostentraegerdateien_archiv.jsp`) — login/lisans yok, açık indirme
  · **İndirme:** 05.09.2026 · **İndiren:** Kemal (tarayıcıdan dosya indirilemedi, içerik kopyala-yapıştır ile alındı)
- **Yayıncı:** GKV-Spitzenverband / kasa birlikleri (AOK-BV · BKK · IKK · Knappschaft · SVLFG · vdek)
- **Sürüm / Stand:** tek bir sürümü **yok** — 6 kasa birliğinin 7 ayrı dosyası, her birinin kendi tarihi (tablo aşağıda)
- **Anzuwenden ab:** dosya başına ayrı · **Düşer:** her dosya kendi Kassenart'ının bir sonraki sürümüyle
- **Durum:** 6 dosya ✅ **GEÇERLİ** · 1 dosya ⏳ **GELECEK** (vdek Q4/2026, ab 01.10.2026)
- **Neyi besler:** Z-09 → `parser.js` (+ `parser.test.js`) → `tools/kostentraeger-annahmestellen-laden.mjs`
  → DB `kostentraeger` (1.052 satır) + DB `kostentraeger_annahmestellen` (11.409 satır
    — ⛔ Ersatzkassen tarafında **yanlış sürüm**, bkz. açık madde 6)
  ↔ DB `krankenkassen.ik_number` 76/94 (Ops #264). **06.09.2026'dan beri zincirin tamamı gerçek veriyle besleniyor.**
- **Tazelik kontrolü:** ⛔ otomatik yok. Elle: yukarıdaki sayfa açılır, oradaki satırların
  "gültig ab" tarihleri aşağıdaki tabloyla karşılaştırılır. **Kontrol günleri: 03.03 · 03.06 ·
  03.09 · 03.12** — Anhang 03 §2 (satır 185-187): *"Die Aktualisierung der Kostenträgerdatei
  erfolgt jeweils zum 1. eines jeden Kalendervierteljahres. Die aktualisierte Fassung wird
  spätestens 4 Wochen vor Beginn des jeweiligen Kalendervierteljahres bereitgestellt."*
  Yani her çeyrek başından 4 hafta önce yeni dosya **olmalı**; o gün sayfada yoksa o Kassenart
  değişiklik yayımlamamıştır ve eski dosya geçerli kalır — bu da kayda yazılır.
- **Yeniden dağıtım:** serbest — kullanıcı kararı 05.09.2026 (W-A07 altında): *"public kalsın
  sıkıntı yok, zaten public bilgiler bunlar."* Kasa IK'ları, adresleri ve DAS bağlantıları
  resmî ve kamuya açık veridir; hasta verisi yok (yalnız kurumsal Ansprechpartner adları var).
- **Yedek:** ✅ git izliyor (ilk giriş `d4982fb` 05.09.2026, bölme `cceb528` 06.09.2026).
  `.gitignore` yalnız `*.pdf` kapatıyor, bu dosyalar metin. Silinen ham `.md`'nin içeriği
  git geçmişinde duruyor (`git show d4982fb:...`), ayrıca 7 parçanın toplamı birebir aynı.
  Yayın yüzeyi kapalı: `.vercelignore:82` → `wissensbank/`.

#### İçindeki 7 dosya

Dosya adı Anhang 03 §6'ya göre çözülür: **1-2** Kassenart · **3-4** Verfahren (`05` = Sonstige
Leistungserbringer) · **5-6** geçerlilik (`Q1`-`Q4` çeyrek **veya** `01`-`12` ay) · **7-8** yıl ·
uzantı **K**=Kostenträgerdatei · **E**=EDIFACT · **0-9**=Nachtrag.

⚠️ **"gültig ab" sütunu dosya adından değil yayıncı sayfasından alındı** (ajan kuralı 6). AOK
örneği niye önemli: adı `Q3` diyor ama gerçek tarih **27.07.2026** — Nachtrag 3 çeyrek ortasında
çıkmış. Dosya adına bakıp "01.07.2026" demek yanlış olurdu.

| # | Dosya | Kassenart | gültig ab (yayıncı) | Absender-IK | Dateidatum | Kayıt | VKG | Satır aralığı | Durum |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `AO05Q326.KE3` | AO = AOK-Bundesverband | **27.07.2026** | 109910000 | 01.07.2026 12:30 | 187 | 764 | 1–2343 | ✅ |
| 2 | `BK05Q326.KE1` | BK = Betriebskrankenkassen | 01.07.2026 | 104027544 | 31.07.2026 09:44 | 365 | 3.234 | 2345–8415 | ✅ |
| 3 | `IK05Q326.KE1` | IK = Innungskrankenkassen | 01.07.2026 | 109900019 | 05.08.2026 09:00 | 207 | 475 | 8417–10540 | ✅ |
| 4 | `BN050526.KE0` | BN = Knappschaft-Bahn-See | 01.05.2026 (**aylık**, çeyrek değil) | 109905003 | 24.04.2026 14:45 | 37 | 6.183 | 10542–17012 | ✅ |
| 5 | `LK05Q226.KE0` | LK = Landwirtschaftliche KK (SVLFG) | 01.04.2026 | 109908701 | 26.08.2025 10:30 | 11 | 27 | 17014–17131 | ✅ |
| 6 | `EK05Q226.KE0` | EK = Ersatzkassen (vdek) | 01.04.2026 | 109979990 | 20.04.2026 18:46 | 261 | 724 | 17133–19785 | ✅ **bugün geçerli** |
| 7 | `EK05Q426.KE0` | EK = Ersatzkassen (vdek) | **01.10.2026** | 109979990 | 14.08.2026 18:00 | 261 | 726 | 19787–22442 | ⏳ **GELECEK** |

**Toplam:** 1.329 KOTR kaydı · 1.043 tekil IK · 12.133 VKG · 1.916 ANS · 133 ASP · 104 DFU.

⛔ **7. dosya bugün koda/DB'ye girmez.** vdek Q4 ile Q2 dosyasının IK kümesi **birebir aynı**
(261 = 261) ama içerik farklı (724 ↔ 726 VKG satırı). Yani tek seferde ikisi de yüklenirse biri
diğerinin üstüne sessizce yazar. 01.10.2026'dan önce Q4'ü yüklemek, o tarihe kadar **yanlış
Datenannahmestelle'ye yönlendirme** demektir — §302'de bu, dosya reddi sınıfıdır.

Ayrıca **263 IK birden fazla dosyada geçiyor**; 261'i bu vdek Q2/Q4 çiftinden, kalanı
Kassenart'lar arası ortak Verband/DAS kayıtları (ör. BKK ∩ vdek = 16 IK). Yükleyicinin
"son yazan kazanır" davranışı burada **yanlış** sonuç verir — birleştirme kuralı geçerlilik
tarihine göre olmalı, dosya sırasına göre değil.

#### Bütünlük doğrulaması (05.09.2026 — deterministik sayım, YZ kullanılmadı)

| Kontrol | Sonuç |
|---|---|
| UNZ sayaçları toplamı (187+365+207+37+11+261+261) | **1.329** |
| Sayılan UNH / UNT / IDK segmenti | **1.329 / 1.329 / 1.329** ✅ eşleşiyor → yapıştırma eksiksiz, kesilme yok |
| Yayıncı sayfasındaki dosya sayısı | **7** ✅ hepsi elimizde; eksik Kassenart yok (`GK`/`SB` sayfada sunulmuyor) |
| Yayıncı boyutları toplamı (68+181+67+214+3+74+74 KB) | **681 KB** ≈ elimizdeki 682,5 KB ✅ |
| Mesaj kimliği | `KOTR:02:001:KV` — Anhang 03 V10 satır 634'ün beklediği değerin aynısı ✅ |
| EDIFACT dışı / bozuk satır | **yok** (yalnız 6 boş ayraç satırı) ✅ |

#### Bölme doğrulaması (07.09.2026 — byte-exact, YZ kullanılmadı)

Ham tek parça dosya silinmeden önce 7 parça ona karşı doğrulandı. Kanıt YZ değil,
ölçüm — satır sonu (CRLF) ve 6 boş ayraç satırı normalize edilerek:

| Kontrol | Ham dosya | 7 parça birleştirilmiş | Sonuç |
|---|---|---|---|
| Satır | 22.436 | 22.436 | ✅ |
| Bayt | 660.087 | 660.087 | ✅ |
| MD5 | `661e2602a2bd6976ef6570f18292e8bb` | `661e2602a2bd6976ef6570f18292e8bb` | ✅ **birebir aynı** |
| `diff` çıktısı | — | boş | ✅ |

Parça başına segment sayıları da tek tek tutuyor (UNB/UNZ 1'er; UNH=UNT=IDK: 187 · 365 ·
207 · 37 · 11 · 261 · 261 = **1.329**; VKG: 764 · 3.234 · 475 · 6.183 · 27 · 724 · 726 =
**12.133**; UNA 7 dosyanın 6'sında — `BN050526`'da orijinalinde de yok).

Ayrıca her parça **doğru adlandırılmış**: dosya adı, dosyanın kendi UNB segmentindeki
Dateiname referansıyla ve Absender-IK/tarih ile birebir eşleşiyor (ör. `LK05Q226_KE0.txt`
→ `UNB+UNOC:3+109908701+999999999+250826:1030+00001++LK05Q226KE0`). Yani içerik yalnız
eksiksiz değil, **doğru dosyaya** düşmüş.

⚠️ **Bu bire-bir indirme değil, kopyalamadır.** Orijinal dosyalar segment akışı olarak gelir;
elimizdeki kopyada her segment ayrı satırda ve 4. dosyanın (`BN050526`) `UNA` satırı kaybolmuş
(6 UNA / 7 UNB). Sonuç: **checksum ile orijinale karşı doğrulama yapılamaz.** Bir Absetzung
itirazında orijinaline başvurulacaksa dosyalar yayıncıdan yeniden indirilmelidir.

#### Format kararı — ara md/csv/json **üretilmez**

| Soru | Cevap |
|---|---|
| Kaynak tipi | Zaten **makine formatı** (EDIFACT). Ajan §4: makine formatı olduğu gibi bırakılır |
| Kaç kez insan okuyacak | **Sıfır.** Sorulan soru "IK 101575519 hangi DAS'a gider" — bu bir **sorgu**, okuma değil |
| Türev | **DB tablosu `kostentraeger`** (+ `krankenkassen.ik_number` eşlemesi). Arada dosya yok |
| Neden CSV/JSON ara katman yok | Sayı taşıyan (IK) bir tabloda **ikinci bir otorite** yaratır. Kaynak çeyreklik güncellenir; ara dosya güncellenmezse **sessizce yalan söylemeye başlar** — ajan §4'ün "en pahalı türev" tanımı tam olarak budur. Doğrudan DB'ye yazmak zincirden bir halka **eksiltir** |
| Neden md değil | `.md` uzantısı zaten yanlış — içerik markdown değil, ham EDIFACT |
| Doğrulama (ajan §0.2 zorunlu) | Parser çıktısı **1.329 kayıt / 1.043 tekil IK** sayısını tutturmalı; ayrıca rastgele **5 kayıt** ham dosyadaki IDK/VKG satırlarına karşı elle karşılaştırılır. Tutmazsa hata parser'dadır, veride değil |
| YZ kullanımı | ⛔ Bu dosyanın hiçbir satırı modele çevirtilmedi ve çevirtilmeyecek — IK numarası sayı taşır (ajan §0.2) |

#### W-01 açık maddeleri

1. ✅ **KAPANDI 06.09.2026 (commit `cceb528`).** `parser.js` artık gerçek dosyalara karşı
   koşuyor. Yalan söyleyen başlık düzeltildi (artık *"Seit 05.09.2026 liegt uns die echte
   Datei vor … KEIN ITSG-Portal-Zugang nötig"*), ölü `/handbücher` yolu kaldırıldı. VKG alan
   sırası Anhang 03 V10 §7.2'ye (s. 18) göre düzeltildi ve gerçek bir satıra karşı doğrulandı
   (`parser.js:173-181`). Kabul ölçütü — **1.329 kayıt / 1.043 tekil IK** — artık tek seferlik
   bir kontrol değil, `parser.test.js`'te **kalıcı regresyon testi** (07.09.2026'da yeniden
   koşturuldu: 11/11 geçti).
2. ✅ **KAPANDI 06.09.2026.** Mock gerçek veriye karşı tutuldu; DB `kostentraeger` bugün
   **1.052 satır** — 1.043'ü dosyadan gelen gerçek IK, kalan 9 satır `mock_unbestaetigt`
   olarak **işaretli** duruyor (silinmedi, ama artık otorite de değil).
   ↳ **Kalan (küçük, `offen`):** `KOSTENTRAEGER_MOCK` sabiti kodda duruyor ve
   `routeToDatenannahmestelle()` hâlâ onu okuyor. Zincirin gerçek halkası DB; kod bir gün
   DB'ye geçmelidir. → Ops #264 altında, `builder`.
3. **`offen` — bugün geçerli Anhang 03 sürümü arşivde yok.** Elimizdeki V10 01.02.2027'de
   yürürlüğe giriyor. Mesaj kimliği aynı olduğu için yapı riski düşük (ve VKG alan sırası
   artık gerçek veriyle doğrulandı, yani V10 bu dosyaları doğru tarif ediyor), ama
   Schlüsselverzeichnis (Art der Datenlieferung, DFÜ-Protokoll) değişmiş olabilir. → arşiv
   sayfasından bir önceki sürüm indirilir, `gkv-302` teyit eder. **Bu madde açık kalan tek
   veri maddesidir.**
4. ✅ **KAPANDI 07.09.2026.** Dosya 7 parçaya bölündü (06.09.2026) ve ham tek parça
   `Krankenkassen IK nummern .md` silindi (07.09.2026). Kanıt: yukarıdaki bölme
   doğrulaması tablosu — MD5 birebir aynı. Detay: W-A08 (c).
5. ✅ **KAPANDI 06.09.2026 (Ops #264).** `krankenkassen.ik_number` artık **76/94** dolu
   (önceden 12/93). 4 yanlış değer gerçek dosyaya karşı düzeltildi, 59 yeni değer isim
   eşleşmesiyle dolduruldu; ayrıntı ve eşleştirme yöntemi `db/REGISTER.md`'de (`db-ustasi`
   sahibi — sicil tarafı kapandı, veri kalitesi takibi orada sürüyor).
   ↳ **Kalan (`offen`, db-ustasi'de):** 18 kasanın IK'ı hâlâ boş — dosyada isim eşleşmesi
   bulunamayanlar. **Tahmin yazılmadı**, boş bırakıldı (doğru davranış).
6. ⛔ **`offen` — SÜRÜM ZAMANLAMA HATASI: DB'ye gelecek sürüm yüklendi** (06.09.2026'da
   oluştu, 07.09.2026'da `db-ustasi` ölçtü). `kostentraeger_annahmestellen` Ersatzkassen
   satırlarını **`EK05Q426_KE0`**'dan alıyor — o dosya **01.10.2026'da** yürürlüğe giriyor.
   Bugün geçerli olan `EK05Q226_KE0` yüklenmedi.
   **Bu, bu kartın kendi yazılı kuralının ihlalidir** (yukarıda: *"⛔ 7. dosya bugün koda/DB'ye
   girmez"*). Kural sicilde duruyordu ama yükleyiciye geçmemişti — **sicilin kendi başına
   yetmediği**, kuralın koda kapı olarak konması gerektiği bir örnek.
   · **Bugünkü zarar: yok, ölçüldü.** Q2 ile Q4 satır satır karşılaştırıldı (724 ↔ 726):
   fark **tam iki satır**, ikisi de TK (`101575519`) ve ikisi de **Abrechnungscode 30**
   altında. Bizim kodlarımız **20 / 71 / 72** için iki sürüm **karakter karakter aynı**.
   Yani podoloji/Heilmittel yolu bugün doğru çalışıyor — **şansla**, tasarımla değil.
   · **Neden yine de kapatılmıyor:** bir sonraki çeyrek teslimatı farkı pekala 71/72'ye
   koyabilir; o zaman kimse yeniden ölçmez. Ayrıca tablo henüz hiçbir kod tarafından
   okunmuyor (`codeStumm`) — yani düzeltmenin **şu an maliyeti en düşük.**
   · **Çıkış (ikisinden biri, karar `gkv-302` + `builder`):** ya `EK05Q226_KE0` yüklenir ve
   `EK05Q426_KE0` 01.10.2026'ya kadar çıkarılır; ya da ikisi birden tutulup sorgu tarih
   duyarlı yapılır (`quelle_stand <= current_date` + bir `gueltig_bis` kolonu).
   ⏳ **01.10.2026'da bu madde kendiliğinden çözülür** — o tarihten sonra yüklü olan sürüm
   zaten doğru sürümdür; yalnız `EK05Q226`'nın uzak tutulması yeter. §1 takviminde kayıtlı.
   Ayrıntılı ölçüm ve DB tarafı: `db/REGISTER.md` → `kostentraeger_annahmestellen`,
   **ZEITFEHLER** bölümü (sahibi `db-ustasi`).

---

## 4. Açık maddeler

Her madde ya bir sahibe, ya bir tarihe, ya `unkritisch` gerekçesine bağlanır. Üçü de
yoksa `offen` kalır ve her raporda tekrar görünür.

### W-A01 · Herkunft (indirme URL'i) 33 kaydın 32'sinde yok — `offen`
Belgelerin nereden indirildiği hiçbir yerde yazılı değil. Bir sürüm düştüğünde yenisinin
nereden alınacağı her seferinde yeniden araştırılıyor. Tek istisna Z-06 (fiyat XML'i,
URL script başlığında).
**Yapılacak:** her kayda Herkunft eklenir. Bilinen yayıncı kökleri:
`gkv-datenaustausch.de` (§302 teknik anlagenler) · `gkv-heilmittel.de` (fiyat) ·
`gkv-spitzenverband.de` (§125 Verträge, HPNR) · `bfarm.de` (ICD-10-GM) · `kbv.de`
(Diagnoseliste) · `g-ba.de` (HeilM-RL).
**Ölçüt:** bir belge silinse, kayıttan bakıp 2 dakikada yerine yenisi indirilebilmeli.

### W-A02 · ICD-10-GM → `icd10_titles` besleme zinciri belgesiz — `offen` ⚠️ **en ciddi**
Tablo dolu, ama repoda hiçbir import/seed script'i yok (Z-08). ICD-10-GM her yıl
güncelleniyor; 2027 sürümü çıktığında iş sıfırdan çözülecek ve o an kimse bugün ne
yapıldığını hatırlamayacak.
**Yapılacak:** ya script bulunup kayda bağlanır, ya bir kereye mahsus yapıldıysa bu
yazılır ve 2027 için tekrarlanabilir yol tarif edilir. `db-ustasi` ile birlikte.

### W-A03 · `anlage3_v22.js` dosya adı bugün geçerli olmayan sürümü taşıyor — `offen`
Baş yorumu dürüst ("gültig ab 01.02.2027") ama dosya adı okuyanı yanıltıyor; bugün
geçerli olan V21. Kodun hangi sürümü uyguladığı `gkv-302` ile teyit edilmeli.
**Karar kullanıcınındır** — sicil sadece işaretler.

### W-A04 · XLSX → CSV dönüşümünün üretim yolu belgesiz — `offen`
`Positionsnummernverzeichnis_2026_Full.csv` ve `…Filtered.csv` hangi araçla üretildi
yazılı değil (Z-05). 2027 sürümü geldiğinde tekrarlanabilir değil.
**Ölçüt:** Z-10'daki (PLZ) desen — dönüştürücü script + türev dosyada `quelle`/`erzeugt`
alanları.

### W-A05 · Resmî belge arşivi yedeksiz — `offen`
`.gitignore:1` → `*.pdf`. 47 PDF (~44 MB) yalnızca bu makinede. `.txt` karşılıkları git'te
(68 dosya izleniyor), yani metin kayıp değil — ama **imzalı/orijinal PDF** kayıp olur.
Absetzung itirazında orijinaline başvurulan belge budur.
**Yapılacak:** `I:\My Drive\Ops Praxura gitnogo\` altına bir kopya (kod değil belge, kural
uygun). Karar kullanıcınındır — depoyu şişirmemek bilinçli bir tercihti.

### W-A06 · Tazelik kontrolü tek bir kaynakta var — `offen`
`.github/workflows/preise-check.yml` yalnız fiyatı izliyor. §302 anlagenleri, HeilM-RL,
ICD, HPNR için otomatik sinyal yok; §1'deki takvim elle bakılıyor.
**Yapılacak:** önce en ucuz adım — takvimdeki üç 2027 tarihi Ops kartına yazılır. Tam
otomasyon (yayıncı sayfası izleme) ayrı bir karar, `deger-mi` ile.
05.09.2026 kısmi ilerleme: **Kostenträgerdatei** artık yazılı bir elle kontrol yordamına sahip
(W-01 — sabit kontrol günleri 03.03 / 03.06 / 03.09 / 03.12 + yayıncı sayfası). Bu, kaynakların
tazelik kontrolünde ikinci belgeli yordam; ama hâlâ **otomatik değil**, madde açık kalır.

### W-A07 · Yeniden dağıtım hakları netleştirilmedi — `offen`
`.vercelignore:73-75` şüpheyi yazılı olarak kaydediyor: *"fraglich, ob ICD-10-GM- und
GKV-Lesefassungen ueberhaupt weiterverbreitet werden duerfen"*. Yayın yüzeyi kapalı
(klasörler ignore'da ✅) ama **depo public** ve `.txt` karşılıkları git'te izleniyor.
**Yapılacak:** `legal-de`'ye sorulur. `wissensbank/gemeinsam/icd-10-gm/downloadbedingungen-2025`
zaten arşivde — cevabın bir kısmı orada.

> **Kullanıcı kararı 05.09.2026 — Kostenträgerdatei için kapandı.** Kemal: *"public kalsın
> sıkıntı yok, zaten public bilgiler bunlar."* `wissensbank/gemeinsam/kostentraeger/` git'te
> izlenmeye devam eder (kasa IK numaraları — resmî, kamuya açık veri, hasta verisi yok).
> **Madde bu kadarıyla kapandı, tamamıyla değil:** ICD-10-GM (BfArM'ın kendi
> `downloadbedingungen-2025` metni var) ve GKV Lesefassung'ları hâlâ `offen` — onlar için
> `legal-de` sorusu duruyor.

### W-A08 · Kostenträgerdatei kayıtsızdı — ✅ **KAPANDI 07.09.2026**

05.09.2026'da bulunmuştu: o zaman `kostentraeger/Krankenkassen IK nummern .md` adıyla tek
parça duran dosya, gerçek resmî Kostenträgerdatei verisiydi — 7 dosya, 1.329 kayıt. `parser.js` bu dosya dururken
mock ile çalışıyordu. **Sicilin niye kurulduğunun canlı kanıtı:** veri indirilmiş, elde, ama
kayıtsız olduğu için yok sayılmış.

- ✅ (a) Dosya `Podoloji/` altından `wissensbank/gemeinsam/kostentraeger/`'e taşındı (05.09.2026).
  Doğru klasör: bu veri **tek bir Fachbereich'a ait değil** — podoloji, physio, ergo ve logo
  aynı kasa/DAS yönlendirmesini kullanır, ölçüt `README.md`'deki "kaç Fachbereich" sorusu.
- ✅ (d) Herkunft, sürüm, geçerlilik ve tazelik yordamı yazıldı → **kart W-01**, takvim §1.
- ✅ (b) `parser.js` gerçek dosyalara karşı koşturuldu (06.09.2026, commit `cceb528`).
  Kabul ölçütü **1.329 kayıt / 1.043 tekil IK** tutturuldu ve tek seferlik kontrol olarak
  bırakılmadı — `parser.test.js` içine regresyon testi olarak kondu (7 dosyayı okur, sayar).
  Ayrıca VKG alan sırası gerçek bir satıra karşı doğrulandı ve bir **hata bulundu**: eski
  3 alanlı eşleme yanlış pozisyonlara yazıyordu. Mock'la hiç fark edilemezdi — bu madde
  neden açıldıysa tam olarak onun kanıtı.
- ✅ (c) **Bölme + adlandırma yapıldı** — 7 parça, aşağıdaki tabloda önerilen adlarla,
  06.09.2026. Ham tek parça **07.09.2026'da silindi**; önce byte-exact doğrulandı
  (MD5 `661e2602…`, 22.436 satır / 660.087 bayt, `diff` boş — kanıt tablosu W-01'de).
  Silinen dosyanın içeriği ayrıca git geçmişinde duruyor. Uygulanan öneri:

  **Neden bölündü:** tek dosya = tek sürüm demektir, ama içinde **7 ayrı sürüm** var ve
  bunlardan biri (`EK05Q426`) bugün **GELECEK** statüsünde. Tek parça hâlde bu ayrım sicilde
  yazılabilir ama dosya sisteminde ve git'te görünmez; yükleyici de ayıramaz. Ayrıca çeyreklik
  güncelleme **dosya başına** gelir (AOK Nachtrag 3'te, SVLFG hâlâ Ağustos 2025'te) — tek blob
  her güncellemede baştan yapıştırılmak zorunda kalır ve `git diff` hangi kasanın değiştiğini
  söyleyemez.

  **Uygulanan bölme:** `wissensbank/gemeinsam/kostentraeger/` altında 7 ayrı dosya, yayıncının kendi
  adıyla, `.txt` uzantısıyla (arşivin okunur-metin kuralı; `.md` yanlış çünkü markdown değil,
  ham `.KEv` uzantısı Windows'ta ve git'te sorun çıkarır):

  | Yeni ad | Kaynak satır aralığı |
  |---|---|
  | `AO05Q326_KE3.txt` | 1–2343 |
  | `BK05Q326_KE1.txt` | 2345–8415 |
  | `IK05Q326_KE1.txt` | 8417–10540 |
  | `BN050526_KE0.txt` | 10542–17012 (⚠ `UNA` satırı eksik, eklenmez — orijinali öyle geldi) |
  | `LK05Q226_KE0.txt` | 17014–17131 |
  | `EK05Q226_KE0.txt` | 17133–19785 |
  | `EK05Q426_KE0.txt` | 19787–22442 |

  `_` ayracı bilinçli: yayıncının 8+3 adı **birebir geri kurulabilir** (`_` öncesi = dosya adı,
  sonrası = uzantı), ad tek bir noktaya sahip olduğu için araçlar şaşırmaz. Bölme mekaniktir —
  satır aralıkları yukarıda, kesme noktaları `UNB`/`UNZ` sınırları.

  ✅ Hepsi uygulandı. **Kazanım ölçüldü:** `EK05Q426_KE0.txt` artık dosya sisteminde ve
  git'te tek başına duruyor, yani "01.10.2026'ya kadar yükleme" kuralı sicilde yazılı
  olmakla kalmıyor — `tools/kostentraeger-annahmestellen-laden.mjs` onu dosya adıyla
  ayırabiliyor (`ECHT_DATEIEN` listesi). Tek blob hâlindeyken bu mümkün değildi.

⚠️ Depo public: W-A07 altındaki kullanıcı kararıyla bu veri için yeniden dağıtım sorusu
**kapandı** (kamuya açık kurum verisi, hasta verisi yok).

### ✅ Kapalı / doğrulanmış

- **W-01 zinciri (Z-09) artık gerçek veriyle çalışıyor** — 06.09.2026 (`cceb528`) + 07.09.2026.
  Kaynak → parser → test → yükleyici → iki DB tablosu, hepsi dolu ve tekrarlanabilir.
  Sicilin var oluş sebebinin en net kanıtı: veri 05.09.2026'da kayıtsız halde elimizdeydi,
  `parser.js` yanında mock ile çalışıyordu ve VKG alan sırası **yanlıştı** — hiçbir mock bunu
  gösteremezdi. Kayıt açıldı, hata iki gün içinde bulundu.
  ⚠️ **"Kapandı" demiyoruz:** zincir bağlı ama iki maddesi açık — bugün geçerli Anhang 03
  sürümü arşivde yok (madde 3) ve DB'ye **gelecek sürüm** yüklendi (madde 6). İkincisi
  bu sicilin kendi kuralının ihlali: kural yazılıydı, ama yalnız sicilde duruyordu.

- **Yayın yüzeyi temiz.** Eski üç klasör 27.08.2026'da `.vercelignore`'a alınmıştı; taşımadan
  sonra yerlerini `wissensbank/` tek satırı aldı (05.09.2026). `Podoloji/` de listede kalmaya
  devam ediyor. Runtime kontrolü yapıldı: hiçbir belge tarayıcıya yüklenmiyor.
- **PDF→TXT zinciri tam.** 47 PDF'in 31'inin `.txt`'si var; eksik 16'nın tamamı bilinçli:
  5'i `_duplikate_2026-08-04/` karantinası, 11'i `Zusatzdateien/` klinik ölçekleri
  (INDEX'te kapsam dışı yazılı). **Boşluk yok.**
- **Fiyat verisi çift kaynaklı.** Anlage 2 (maßgeblich) + GKV XML (bağımsız doğrulama).
  PDF-parser ve YZ bilinçli olarak reddedildi — Ops kartı #213, 04.09.2026.

---

## 5. Kayıt formatı

Yeni bir kaynak girdiğinde ajanın §3 giriş protokolüyle açtığı kart:

```
### W-<no> · <kısa ad>
- **Dosya:** <repo yolu> (+ türevleri)
- **Herkunft:** <indirildiği tam URL> · **İndirme:** <TT.AA.YYYY> · **İndiren:** <kim>
- **Yayıncı:** <GKV-SV / BfArM / ITSG / Vertragspartner …>
- **Sürüm / Stand:** <belgenin kapağından — dosya adından DEĞİL>
- **Anzuwenden ab:** <TT.AA.YYYY> · **Düşer:** <TT.AA.YYYY veya "açık uçlu">
- **Durum:** GEÇERLİ | GELECEK | DÜŞMÜŞ | REFERANS | KAPSAM DIŞI
- **Neyi besler:** <Z-no zinciri veya "koda girmedi">
- **Tazelik kontrolü:** <URL + nasıl bakılır + otomatik mi elle mi>
- **Yeniden dağıtım:** serbest | şüpheli | yasak — <gerekçe>
- **Yedek:** git izliyor mu?
- **Format kararı:** <ne üretildi ve NEDEN — "neden md yapmadık" altı ay sonra sorulur>
```

Bilinmeyen alana **"belirtilmemiş"** yazılır, tahmin edilmez.
