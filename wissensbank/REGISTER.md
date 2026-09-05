# Wissensbank — Dış Kaynaklı Resmî Verinin Sicili

> **Bu dosya "o belge nereden geldi, hâlâ geçerli mi, neyi besliyor" sorusuna bakar.**
> İçinde ne yazdığı sorusuna `Handbücher/INDEX.md` bakar. İkisi farklı sorulardır;
> biri diğerinin yerine geçmez.
>
> Sahibi: `wissensbank` ajanı · Elle bakımlı · Tetikleyici: **"bilgi bankası güncelle"**
> İlk kurulum: 05.09.2026 · Son güncelleme: 05.09.2026

---

## Bir bakışta

| | Sayı |
|---|---|
| Kayıtlı kaynak belge (INDEX'te) | 33 |
| Arşivdeki PDF | 47 (16'sının `.txt`'si yok — 5'i karantina, 11'i bilinçli kapsam dışı) |
| Arşiv boyutu | ~44 MB (`Handbücher` 8,3 · `Podoloji` 9,0 · `verordnung rezept` 27) |
| Kaynak→kod zinciri kayıtlı | 10 |
| **Herkunft (indirme URL'i) kayıtlı** | **1 / 33** ← asıl boşluk, W-A01 |
| Otomatik tazelik kontrolü olan | 1 (sadece fiyat: `preise-check.yml`) |

**Üç dosya, üç ayrı soru:**

| Dosya | Soru | Bakımı |
|---|---|---|
| `Handbücher/INDEX.md` | Belgenin **içinde ne var**, hangi bölüm nerede | elle — okundukça zenginleşir |
| `wissensbank/REGISTER.md` | **Nereden geldi**, hangi sürüm, ne zaman düşer, **neyi besler** | elle — "bilgi bankası güncelle" |
| `Handbücher/SPEC-RULES.md` | Belgeden **süzülmüş kural** (kaynak+sürüm+kod satırı) | elle — kural çıkarıldıkça |

---

## 1. Geçerlilik takvimi — kritik tarihler

Bu tablo sicilin en çok bakılan yeridir. Bir tarih geldiğinde iş sadece "yeni dosyayı
indir" değil, **zincirin tamamını yürümektir** (§2).

| Tarih | Ne olur | Etkilenen zincir | Durum |
|---|---|---|---|
| **01.01.2027** | HPNR-Verzeichnis 2026 penceresi kapanır, 2027 sürümü gelir | Z-05 → `podologie_positions.js`, `physio_positions.js` | ⏳ hazırlık yok |
| **01.02.2027** | **Anlage 3 TP5 V21 → V22** yürürlüğe girer | Z-02 → `anlage3_v22.js` (dosya hazır, açılmayı bekliyor) | ⏳ dosya var, geçiş planı yok |
| **01.02.2027** | **Anhang 03 Anlage 1 TP5 V10** (Kostenträgerdatei) yürürlüğe girer | Z-09 → `billing/kostentraeger/parser.js` | ⏳ parser 05.09.2026'da yazıldı |
| açık uçlu | Anlage 1 TP5 V21 geçerli (01.10.2025'ten) | Z-01 → `billing/dta/*`, `legs.js` | ✅ geçerli |
| açık uçlu | HeilM-RL 15.05.2025 değişikliği (05.08.2025'ten) | Z-07 | ✅ geçerli |
| **her fiyat turu** | Heilmittelpreisstammdatei yeni `Stand_TT-MM-JJ` | Z-06 → otomatik, Telegram bildirimi | ✅ **tek otomatik kontrol** |

> ⚠️ **Erken geçiş dosya reddi demektir.** V22 ve V10 dosyaları repoda duruyor ve kod
> dosyası (`anlage3_v22.js`) yazılmış olsa bile **01.02.2027'ye kadar V21 esastır.**
> Bu, `Handbücher/INDEX.md`'nin de yazılı kuralıdır.

---

## 2. Zincirler — kaynak belge → türev → kod → DB

**Sicilin asıl değeri burasıdır.** Bir kaynak güncellendiğinde iş, zincirin son halkasına
kadar yürünmeden bitmez. Zincirin ortasında kalan eski bir halka, sistemin *kısmen* güncel
olması demektir — ki bu tamamen eski olmaktan tehlikelidir, çünkü kimse şüphelenmez.

### Z-01 · §302 teknik spesifikasyon (EDIFACT)
```
Handbücher/Anlage_1_TP5_V21_20260115.pdf/.txt   (V21, ab 01.10.2025)
  → Handbücher/SPEC-RULES.md                     (süzülmüş kurallar)
  → api-backend/billing/dta/*                    (SLGA/SLLA/SLEZ/SLAU/SLEK üretimi)
  → api-backend/billing/codes/legs.js            (§5.5.3.3 EHE-Segment'e dayanır)
```
Durum: ✅ geçerli. `legs.js` belgeye satır düzeyinde atıf yapıyor — **istenen desen bu.**

### Z-02 · §302 Schlüsselverzeichnisse
```
Podoloji/Anlage_3_TP5_V21_20250919.pdf/.txt      (V21, ab 01.10.2025)  ← BUGÜN GEÇERLİ
Handbücher/Anlage_3_TP5_V22_20260218.pdf/.txt    (V22, ab 01.02.2027)  ← GELECEK
  → api-backend/billing/codes/anlage3_v22.js
```
⚠️ **Dikkat:** kod dosyasının adı `anlage3_v22` ve baş yorumu V22 PDF'ini kaynak
gösteriyor, ama bugün geçerli olan **V21**. Baş yorum "gültig ab 01.02.2027" diyerek
dürüst davranıyor; yine de dosya adı yanıltıcı. → açık madde W-A03.

### Z-03 · Physiotherapie fiyatları
```
Handbücher/20251201_Physiotherapie_Vertrag_125_Anlage_2_barrierefrei.pdf/.txt
  → api-backend/billing/codes/physio_positions.js   (ab 01.01.2026, bundeseinheitlich)
  → sync_heilmittel_katalog.js                       → DB heilmittel_katalog
  ↔ preise_pruefen.mjs                               (GKV XML ile çapraz doğrulama)
```
Not: PDF pozisyonları baştaki `X` yer tutucusuyla listeliyor; ilk hane
Leistungserbringergruppe'ye göre değişiyor (2 = Physiotherapeut, bizim varsayılan).
Bu kural kod dosyasının başında yazılı — **belgeden koda taşınan yorumun örneği.**

### Z-04 · Podologie fiyatları
```
Podoloji/Leistungen/20250617_Podologie_Anlage_2.pdf/.txt   (i.d.F. 01.07.2025)
  → api-backend/billing/codes/podologie_positions.js       (PODOLOGIE_PREISFENSTER)
  → sync_heilmittel_katalog.js                             → DB heilmittel_katalog
  ↔ preise_pruefen.mjs
```
⚠️ PDF layout güvenilmez: `Podoloji/Leistungen/*.txt` içinde bir fiyat kendi kodunun
**bir satır üstünde** duruyor. Bu, "sayı taşıyan tabloyu YZ/parser çevirmez" kuralının
(ajan §0.2) doğduğu gerçek olay.

### Z-05 · Heilmittelpositionsnummernverzeichnis (GKV-SV)
```
Podoloji/20251215_Heilmittelpositionsnummernverzeichnis_gueltig_ab_01.01.2026.xlsx
  → Podoloji/Positionsnummernverzeichnis_2026_Full.csv       ⚠ üretim yolu belgesiz
  → Podoloji/Podologie_Positionsnummern_2026_Filtered.csv    ⚠ üretim yolu belgesiz
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
verordnung rezept/heilmittel-diagnoseliste.pdf/.txt      (Stand 01.01.2026)
  → api-backend/ai/validators/data/diagnoseliste-raw.txt  (16.05.2026)
  → api-backend/ai/validators/heilmittel-catalog.json     (_meta ile, 238 LHB/BVB kaydı)
```
✅ `heilmittel-catalog.json` içinde `_meta` bloğu var (source, edition, generated_at_utc,
sayımlar) — **türev dosyada olması gereken şeyin örneği.**

### Z-08 · ICD-10-GM 2026 ⚠️ **zincir kopuk**
```
verordnung rezept/Zip ICD/Klassifikationsdateien/icd10gm2026syst_kodes.txt   (4,2 MB)
  → ???                                       ← BESLEME SCRIPT'İ BULUNAMADI
  → DB icd10_titles  (yalnız search_diagnosen() RPC'sinden okunur)
```
Repoda hiçbir import/seed script'i yok. Tablo dolu ama nasıl dolduğu yazılı değil. ICD-10-GM
2027 çıktığında bu iş sıfırdan çözülecek. → açık madde **W-A02, en ciddi madde.**

### Z-09 · Kostenträgerdatei / IK
```
Handbücher/Anhang_03_Anlage_1_TP5_V10_20260414.pdf/.txt   (V10, ab 01.02.2027)
  → api-backend/billing/kostentraeger/parser.js + parser.test.js   (05.09.2026)
```
⏳ Parser V10 tarihinden önce yazıldı. Bugün geçerli olan sürüm ile V10 arasındaki farkın
kontrol edilmesi gerekiyor. Ayrıca gerçek Kostenträgerdatei henüz yok (mock ile çalışıyor).

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

`Handbücher/INDEX.md`'deki 33 kayıt, sicil gözüyle. **Herkunft sütunu neredeyse tamamen
boş** — bu bir kayıt eksikliği, belgelerin şüpheli olduğu anlamına gelmez (hepsi resmî
yayıncıdan indirildi), ama bir sürüm düştüğünde yenisinin nereden alınacağı her seferinde
yeniden araştırılıyor demektir.

### §302 TP5 — çekirdek teknik anlagen

| Dosya | Sürüm | Ab | Durum | Besler | Herkunft |
|---|---|---|---|---|---|
| `Handbücher/Anlage_1_TP5_V21_20260115` | V21 | 01.10.2025 | ✅ GEÇERLİ | Z-01 | ⬜ |
| `Podoloji/Anlage_3_TP5_V21_20250919` | V21 | 01.10.2025 | ✅ GEÇERLİ | Z-02 | ⬜ |
| `Handbücher/Anlage_3_TP5_V22_20260218` | V22 | 01.02.2027 | ⏳ GELECEK | Z-02 | ⬜ |
| `Handbücher/Anhang_03_Anlage_1_TP5_V10_20260414` | V10 | 01.02.2027 | ⏳ GELECEK | Z-09 | ⬜ |
| `Handbücher/Anhang_05_Anlage_1_TP5_20260401` | 1.0 | 01.04.2026 | 🚫 KAPSAM DIŞI (Rettungsdienst) | — | ⬜ |
| `Handbücher/…Anhang_04b…xsd` + `SLP_BAS_1.2.0.xsd` | — | — | 📎 REFERANS (XML şema) | — | dosya adında ✅ |

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
| `Podoloji/Leistungen/20250617_Podologie_Anlage_2` | i.d.F. 01.07.2025 | ✅ GEÇERLİ | Z-04 |
| `Podoloji/Leistungen/20250617_Podologie_Anlage_1c_Leistungsbeschreibung` | i.d.F. 01.07.2025 | ✅ GEÇERLİ | podoloji akışı |
| `Podoloji/Leistungen/20250617_Podologie_Anlage_3_Lesefassung` | i.d.F. 16.06.2025 | ✅ GEÇERLİ | podoloji akışı |
| `Podoloji/Leistungen/20250617_Podologie_Aenderungsvereinbarung` | 16.06.2025 | ✅ GEÇERLİ | — |
| `Podoloji/Leistungen/20240725_Anlage_1a` + `1b_Leistungsbeschreibung` | i.d.F. 17.06.2024 | ✅ GEÇERLİ | — |
| `Podoloji/20230524_Podologie_FAK_bf` | Stand 24.05.2023 | ✅ GEÇERLİ | HPNR referansı |
| `20260212_Vertrag_125_sssst_Anlage_2_Verguetungsvereinbarung` | i.d.F. 12.02.2026 | ✅ GEÇERLİ | Logo/Stimme — ⬜ koda girmedi |
| `20240531_Ergo_Anlage_2_Vertrag_nach_125…` | Stand 01.06.2024 | ✅ GEÇERLİ | Ergo — ⬜ koda girmedi |
| `20220421_Lesefassung_Anlage_3_Ernaehrungstherapie` | 25.04.2022 | 🚫 KAPSAM DIŞI (Ernährungstherapie) | — |
| `Handbücher/GGT` | ab 01.01.2026 | ✅ GEÇERLİ | — |
| `Handbücher/anlage2.txt` | — | 01.01.2026 | ⬜ hangi Fachbereich, netleştirilmeli |
| `Podoloji/…HPNR…_2026.xlsx` + 2 CSV | Stand 15.12.2025, ab 01.01.2026 | ✅ GEÇERLİ | Z-05 |

### Heilmittel-Richtlinie, Diagnoseliste, ICD

| Dosya | Sürüm / Stand | Durum | Besler |
|---|---|---|---|
| `verordnung rezept/HeilM-RL_2025-05-15_iK-2025-08-05` | değişiklik 15.05.2025, iK 05.08.2025 | ✅ GEÇERLİ | Z-07 dolaylı |
| `verordnung rezept/heilmittel-diagnoseliste` | Stand 01.01.2026 | ✅ GEÇERLİ | **Z-07** |
| `verordnung rezept/Zip ICD/` (ICD-10-GM 2026) | Klassifikation 12.09.2025 | ✅ GEÇERLİ | **Z-08 ⚠ kopuk** |
| `verordnung rezept/praxiswissen-heilmittel` | Ausgabe 2026 | 📎 REFERANS | — |
| `verordnung rezept/NOVENTI-Leitfaden-Blankoverordnung-Physiotherapie` | Stand 03.2026 | 📎 REFERANS (ticari kaynak, otorite değil) | — |
| `verordnung rezept/Zip ICD/Zusatzdateien/*.pdf` (11 adet) | 2026 | 🚫 KAPSAM DIŞI (Barthel, MMSE, FIM…) | — |
| `Handbücher/_duplikate_2026-08-04/` (5 PDF) | — | 🗄 KARANTİNA | — |

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

### W-A07 · Yeniden dağıtım hakları netleştirilmedi — `offen`
`.vercelignore:73-75` şüpheyi yazılı olarak kaydediyor: *"fraglich, ob ICD-10-GM- und
GKV-Lesefassungen ueberhaupt weiterverbreitet werden duerfen"*. Yayın yüzeyi kapalı
(klasörler ignore'da ✅) ama **depo public** ve `.txt` karşılıkları git'te izleniyor.
**Yapılacak:** `legal-de`'ye sorulur. `verordnung rezept/Zip ICD/downloadbedingungen-2025`
zaten arşivde — cevabın bir kısmı orada.

### ✅ Kapalı / doğrulanmış

- **Yayın yüzeyi temiz.** `Handbücher/`, `Podoloji/`, `verordnung rezept/` üçü de
  `.vercelignore:76-78`'de. 27.08.2026'da eklendi ve runtime kontrolü yapıldı.
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
