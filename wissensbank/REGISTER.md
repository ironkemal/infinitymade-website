# Wissensbank — Dış Kaynaklı Resmî Verinin Sicili

> **Bu dosya "o belge nereden geldi, hâlâ geçerli mi, neyi besliyor" sorusuna bakar.**
> İçinde ne yazdığı sorusuna `wissensbank/INDEX.md` bakar. İkisi farklı sorulardır;
> biri diğerinin yerine geçmez.
>
> Sahibi: `wissensbank` ajanı · Elle bakımlı · Tetikleyici: **"bilgi bankası güncelle"**
> İlk kurulum: 05.09.2026 · Son güncelleme: 30.09.2026 (**W-01: Q4/2026 Kostenträgerdateien indirildi** —
> 4 dosya `curl` ile yayıncıdan byte-exact, sha256 kayıtlı, parser sayımı + öncül farkı ölçüldü;
> düşenlerin bitiş tarihi 30.09.2026. DB'ye YÜKLENMEDİ. Yeni açık maddeler W-01 #9-#12.)
> Önceki: 29.09.2026 (**Z-18 açıldı** — Reform S3.6/S3.7, ICD-Endständigkeit + Arzt-Nr./Unterschrift, 2 SPEC-RULES kaydı doğrulanıp düzeltildi. Önce **Z-17 açıldı** — Podologie Reform S1.12 + S2:
> Hausbesuch „Ja", Abrechnung nach Beendigung / VKZ 02, Test vs. Erprobung, Datenaustausch-Status,
> IK des LE. `SPEC-RULES.md`'de 1 kayıt düzeltildi (Teilabrechnung/VKZ 02), 1 kayıt netleşti (Testdatei).
> `Richtlinien-Text_061120` artık teyitli: Anlage 1 V21 kapağı „Stand der Richtlinien: 20.11.2006".)
> Önceki: 29.09.2026 (**Z-16 açıldı** — Podologie Behandlungsunterbrechung/Behandlungsbeginn-Frist, Reform S1.9 `dbd79f0`; HeilM-RL § 15/§ 16 Abs. 4, Anlage 3 lit. e, FAK Nr. 11/34 orijinale karşı okundu.)
> Önceki: 28.09.2026 (**Microsoft C5 raporu kaydedildi — depo
> DIŞINDA.** Kart **W-06**, zincir **Z-15**, açık madde **W-A12**. İlk depo-dışı kayıt: belge dağıtım
> kısıtlı olduğu için Drive'da durur, sicil yalnız kimliğini ve neyi beslediğini tutar. Kayıt
> sırasında istisna sayısı düzeltildi: 2 değil, 7 kontrol-seviyesi istisna / 20 C5 kriteri.)
> Önceki: 27.09.2026 (**Z-14 açıldı** — Muster 13
> Heilmittel-Limit § 12 Abs. 2/3, Ops #202/#303 zinciri: kural doğru kaydedildi, kod hâlâ
> uygulanmamış. `SPEC-RULES.md` kural metni aynı gün 3 noktada düzeltildi — bkz. Z-14.)
> Önceki: 21.09.2026 (**GGT Anlage 16 (SECON) indirildi**
> — `ABRECHNUNG_ECHTBETRIEB_PLAN.md` Adım 1.3’ün „bu belge olmadan başlanmaz" kaydı üzerine.
> Kart **W-04**, zincir **Z-12**. Aynı gün ikinci tur: Ops #302 — „Komplexbehandlung" = verordnete
> Heilmittel c), 78020'nin adı değil; zincir **Z-13**, kural `SPEC-RULES.md`'de. Aynı turda **ana GGT belgesinin sürüm düşümü yakalandı**:
> arşivdeki Fassung `ab 01.01.2026` idi, yayıncıda 01.09.2026’dan beri yenisi var — eskisi
> `_archiv/`’e alındı, yenisi indirildi, farkı deterministik `diff` ile ölçüldü (kart **W-05**).
> Yeni açık maddeler: **W-A11** (GGT § 4.2.5.1 XML yönelimi, `gkv-302`’ye) ve Z-12 altındaki
> `.p7m` uzantı çelişkisi. W-A09 kısmen kapandı.)
> Önceki: 18.09.2026 (Ops #211 — Podologie Höchstmenge
> je Verordnung kuralı `SPEC-RULES.md`'ye kaydedildi, zinciri **Z-11** olarak açıldı:
> HeilM-RL Heilmittelkatalog + Podologie Anlage 3 Ziffer 3 f) → `verordnung-regeln.js` →
> `verordnung-podo.js` / `verordnung-pruefung.js` / `diagnosegruppen.json`. Alıntılar
> HeilM-RL s. 73-77 ve § 7 Abs. 2/5'e karşı doğrulandı; `gkv-302`'nin verdiği kod atfında
> iki düzeltme yapıldı — `diagnosegruppen.json` podologie bloğu **:162-279** (:162-271
> değil) ve sayının asıl adresi `verordnung-regeln.js:91/:97`. Yeni açık madde: **W-A10**.)
> Önceki: 17.09.2026 (Ops #290 — `gkv-302`'nin üç DTA
> alanı araştırması `SPEC-RULES.md`'ye kaydedildi: Muster 13 → ZHE 7/8/9, Arbeitsunfall
> kapsam dışı, LHB/SKZ § 8 Abs. 3. Kaynaklar orijinallere karşı doğrulandı; kod uygulaması
> **yok** ve vertikal sıralama gereği ertelendi. Zincir notları Z-01/Z-02'ye işlendi.)
> Aynı gün, önceki tur: 17.09.2026 (Ops #285 — Z-08/W-A02 `wissensbank`
> ajanı tarafından doğrulandı: `builder`'ın bulguları git log + dosya karşılaştırmasıyla
> teyit edildi, boşluk penceresi **01.07.–10.08.2026**'ya daraltıldı — bkz. Z-08.)
> Önceki: 10.09.2026 (W-02 + W-03 girdi — Anhang 1 Kap. 4 ve Anhang 2 Kap. 9) ·
> 10.09.2026 (kök temizliği sonrası atıf tazeleme) · 07.09.2026 (W-01 zinciri, W-A08)

---

## Bir bakışta

| | Sayı |
|---|---|
| Kayıtlı kaynak belge (INDEX'te) | 39 (38 depoda + 1 depo dışı, W-06) |
| Arşivdeki PDF | 49 (16'sının `.txt`'si yok — 5'i karantina, 11'i bilinçli kapsam dışı) |
| Arşiv boyutu | ~44 MB (taşıma öncesi kaynak klasörlere göre: `Handbücher` 8,3 · `Podoloji` 9,0 · `verordnung rezept` 27 — üçü de bugün `wissensbank/` altında) |
| Kaynak→kod zinciri kayıtlı | 18 (Z-01…Z-18) |
| Tam kimlik kartı yazılmış kaynak | 6 (**W-01** Kostenträgerdatei · **W-02** Anhang 1 Kap. 4 · **W-03** Anhang 2 Kap. 9 · **W-04** GGT Anlage 16 SECON · **W-05** GGT · **W-06** Microsoft C5 — ⛔ depo dışı) |
| Depo **dışında** duran kayıtlı kaynak | 1 (W-06 — dağıtım kısıtlı, Drive'da) |
| **Herkunft (indirme URL'i) kayıtlı** | **6 / 38** ← asıl boşluk, W-A01 |
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
| **01.10.2026** | Kostenträgerdatei **Q4/2026** yürürlüğe girer: `AO05Q426_KE0` · `BK05Q426_KE0` · `IK05Q426_KE0` · `EK05Q426_KE1` GEÇERLİ olur; `AO05Q326_KE3` · `BK05Q326_KE1` · `IK05Q326_KE1` · `EK05Q226_KE0` · `EK05Q426_KE0` DÜŞER (son gün 30.09.2026). `BN050526` + `LK05Q226` geçerli kalır. ✅ 4 dosya **30.09.2026'da indirildi** (byte-exact). ⛔ DB yüklemesi yapılmadı — `db-ustasi`; önce W-01 #9 (kodlama) | Z-09 → W-01 → `kostentraeger` + `kostentraeger_annahmestellen` | ⏳ dosyalar hazır, **DB yüklemesi açık** (madde 6, 9, 10) |
| **her çeyrek başı** (01.01 / 01.04 / 01.07 / 01.10) | Kostenträgerdatei güncellenir; yayın **en geç çeyrek başından 4 hafta önce** (Anhang 03 §2, satır 185-187). Yani kontrol günü: **03.03 · 03.06 · 03.09 · 03.12** | Z-09 | 🔁 tekrar eden, **elle** — W-01'deki kontrol yordamı |
| **01.01.2027** | HPNR-Verzeichnis 2026 penceresi kapanır, 2027 sürümü gelir | Z-05 → `podologie_positions.js`, `physio_positions.js` | ⏳ hazırlık yok |
| **01.02.2027 öncesi** | Geçiş paketinin tam kapsamı **bilinmiyor**: Anlage 1 TP5 **V22** (21.05.2026) arşivde yok, `Anzuwenden ab` tarihi bizde yazılı değil. Aynı tarihteyse Anlage 3 V22 + Anhang 03 V10 ile **tek pakettir** | Z-01 · Z-02 · Z-09 | ⏳ **W-A09**, indirilmedi |
| **01.02.2027** | **Anlage 3 TP5 V21 → V22** yürürlüğe girer | Z-02 → `anlage3_v22.js` (dosya hazır, açılmayı bekliyor) | ⏳ dosya var, geçiş planı yok |
| **01.02.2027** | **Anhang 03 Anlage 1 TP5 V10** (Kostenträgerdatei) yürürlüğe girer | Z-09 → `billing/kostentraeger/parser.js` | ⏳ parser 05.09.2026'da yazıldı |
| açık uçlu | Anlage 1 TP5 V21 geçerli (01.10.2025'ten) | Z-01 → `billing/dta/*`, `legs.js` | ✅ geçerli |
| açık uçlu | HeilM-RL 15.05.2025 değişikliği (05.08.2025'ten) | Z-07 · **Z-11** · **Z-16** | ✅ geçerli |
| **~Temmuz 2027** | Microsoft C5 raporunun **sonraki dönemi** (01.04.2026–31.03.2027) Service Trust Portal'da beklenir. Gelene kadar Azure OpenAI için C5 Typ-2 kapsamı **31.12.2025'te biter** (dipnot 6) — 01.01.2026 sonrası boşluk büyüyor. Geldiğinde: W-06 `DÜŞMÜŞ`, yeni rapor kaydedilir, Azure OpenAI satırı + dipnotları yeniden okunur, KARARLAR 2026-09-12/09-28'e bildirilir | Z-15 → W-06 → on-prem AI kararı · `azureClient.js` | ⏳ **elle**, portal oturumlu — W-A12 |
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

📌 **17.09.2026 (Ops #290) — bu zincirden üç kural daha süzüldü, kod tarafı boş:**
Anlage 1 V21 Kap. 5.5.3.3 (s. 70, SLLA-B ZHE alan listesi) ve s. 72-73 (SKZ segmenti)
→ `SPEC-RULES.md` § „Muster 13 Kopfteil → ZHE alan 7/8/9" · „Arbeitsunfall … girmez" ·
„LHB Genehmigungskennzeichen (SKZ) …". Üçünün de **yazıcı tarafı hazır**
(`billing/dta/builder.js:192-194` ve `:210-216` → `segments.js:267-269,318-328`),
**besleyen tarafı yok** — ne DB kolonu ne maske, yani alanlar bugün her dosyada boş
gidiyor. Bu bir hata değil **durum tespiti**: uygulama Podoloji bitene kadar bilinçli
ertelendi (Ops #290). Kaynak atıfları `wissensbank` tarafından orijinal `.txt`'lere karşı
satır satır doğrulandı (17.09.2026), `gkv-302`'nin raporu olduğu gibi devralınmadı.

**Z-01 iki ek dala sahip (10.09.2026'dan beri)** — Anlage 1'in kendisi değil, ona bağlı Anhang'lar:
```
wissensbank/gemeinsam/302-tp5/Anhang_01_…_Kapitel_4_Datenuebermittlung_20170831   (ab 01.09.2017)  → W-02
wissensbank/gemeinsam/302-tp5/Anhang_02_…_Kapitel_9_Pruefverfahren_20031110       (Stand 10.11.2003) → W-03
  → wissensbank/SPEC-RULES.md § „Datenübermittlung · Test- / Erprobungsverfahren · Verschlüsselung"  (8 kural)
  → api-backend/billing/dta/filename.js      ⛔ ÇELİŞKİ: 16 haneli, Anhang 1 §4.2 11 hane diyor
  → api-backend/billing/dta/builder.js:375   ✅ testIndikator eşlemesi doğru
  → api-backend/billing/api/abrechnung.routes.js  (kind:'test' ×3 · SignedData OID · cert_valid_to)
  → Auftragsdatei üreten kod                 ⛔ YOK — zincirin eksik halkası
```
⚠️ Bu iki dal bugün ağırlıkla **„uygulanmamış"** raporluyor. Bu bir hata değil bir **durum
tespiti**: canlı gönderim henüz yapılmıyor, kod yalnız Testdatei üretiyor. Ama zincir artık
yazılı — canlıya geçiş kararı verildiğinde neyin eksik olduğu yeniden araştırılmayacak.

### Z-02 · §302 Schlüsselverzeichnisse
```
wissensbank/gemeinsam/302-tp5/Anlage_3_TP5_V21_20250919.pdf/.txt      (V21, ab 01.10.2025)  ← BUGÜN GEÇERLİ
wissensbank/gemeinsam/302-tp5/Anlage_3_TP5_V22_20260218.pdf/.txt    (V22, ab 01.02.2027)  ← GELECEK
  → api-backend/billing/codes/anlage3_v22.js
```
⚠️ **Dikkat:** kod dosyasının adı `anlage3_v22` ve baş yorumu V22 PDF'ini kaynak
gösteriyor, ama bugün geçerli olan **V21**. Baş yorum "gültig ab 01.02.2027" diyerek
dürüst davranıyor; yine de dosya adı yanıltıcı. → açık madde W-A03.

⚠️ **Atıf tuzağı (17.09.2026'da ölçüldü, Ops #290): Anlage 3'ün İÇİNDEKİLER'i gövdeyle
uyuşmuyor.** İçindekiler §8.1.2 = „BVG/SER", §8.1.10 = „Verordnungsbesonderheiten",
§8.1.16 = „Art der Genehmigung" derken **gövdede** aynı başlıklar §8.1.2.1, §8.1.11,
§8.1.17'de duruyor (V21 `.txt` satır 103-122 ↔ 316-343 / 1009 / 1279). `SPEC-RULES.md`
ve kod yorumlarındaki bütün § atıfları **gövde numaralandırmasına** göredir. İçindekiler
sayfasından atıf verilmez — verilirse bir sonraki okuyan yanlış bölüme bakar ve „kural
belgede yok" sonucuna varır.

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

### Z-08 · ICD-10-GM 2026 ⚠️ **dar boşluk, tarihen sınırlı: 01.07.–10.08.2026** (17.09.2026 `wissensbank` doğrulaması)
```
wissensbank/gemeinsam/icd-10-gm/Klassifikationsdateien/icd10gm2026syst_kodes.txt   (4,2 MB, DIMDI)
  → archive/supabase-migrations-vor-baseline/20260701000000_icd10_titles.sql   ✅ BULUNDU
    (commit 7eb7a56, 01.07.2026: Filter Feld2=T ∧ Feld13=P, nur Endkodes, 4 Spalten,
     13.041 Zeilen — Quelle+Filter im Dateikopf dokumentiert)
  → ??? (nicht committeter Zwischenschritt)   ← WEITERHIN OFFEN, siehe unten
  → DB icd10_titles  HEUTE: 7 Spalten (+ terminal, code_plain, gruppe), ≥16.905 Zeilen,
    inkl. Gruppen-/Kapitelköpfe — gelesen nur über search_diagnosen() RPC
  → tools/seed-generieren.mjs (icd10_titles-Eintrag, O-38 12.09.2026)
    → api-backend/db/migrations/0013_seed_icd10_titles.sql   ✅ On-Prem-Box-Seed, mit
      Rechtsgrundlage (legal-de 12.09.2026, § 5 Abs. 2 UrhG „amtliches Werk") + Assert
      (`n >= 16905`, sonst bricht die Migration ab)
```
**17.09.2026 — was neu belegt ist (Ops #285, Grep + `git log -S` gegen den Code, keine
Live-DB-Abfrage in dieser Sitzung):**
- Der **ursprüngliche** Import (13.041 Endkodes, 4 Spalten) ist doch dokumentiert — nur
  nicht mehr im aktiven Migrationsordner, sondern archiviert
  (`archive/supabase-migrations-vor-baseline/`, seit der 04.09.2026-Baseline dort). Quelle,
  Filterregel und Erzeugungsdatum stehen im Dateikopf. Der alte Satz „kein Import-/
  Seed-Script existiert im Repo" war für DIESEN Schritt falsch.
- Der **On-Prem-Box-Weg** (heutige Box bekommt eine Kopie von `icd10_titles`) ist seit
  O-38 (12.09.2026) vollständig automatisiert und rechtlich geprüft — `tools/seed-generieren.mjs`
  liest die LIVE-Tabelle und erzeugt eine neue, versionierte Migrationsdatei. Das ist ein
  reines Repackaging der bereits gefüllten Tabelle, **keine** Quelle für „wie kam die Zeile
  ursprünglich rein".
- **Was WEITERHIN fehlt** — die eigentliche Lücke ist enger als W-A02 sie 2026-09-XX
  beschrieben hatte: zwischen dem 01.07.2026-Import (13.041 Zeilen, 4 Spalten, nur
  Endkodes) und heute (≥16.905 Zeilen, 7 Spalten, inkl. Gruppen-/Kapitelköpfe) liegt ein
  zweiter Umbau — neue Spalten `terminal`/`code_plain`/`gruppe`, erweiterter Zeilenumfang.
  Dafür gibt es **keinen** committeten Migrationsschritt (`git log -S` auf `code_plain` und
  `search_diagnosen` findet in `*.sql`/`*.js`/`*.mjs` nur die drei oben genannten Dateien,
  keine vierte) und **keinen** `fortschritte/`-Eintrag. Er muss direkt gegen die Live-DB
  gefahren worden sein, aus der Zeit vor der Datei-zuerst-Migrationsdisziplin
  (die erst am 10.09.2026 eingeführt wurde, siehe CLAUDE.md). Insbesondere `gruppe` lässt
  sich nicht rein aus dem Feld `code` ableiten (Beispiel: `Z99.3` → `gruppe='Z80'`, dem
  Beginn des amtlichen Gruppenbereichs `Z80–Z99` — das braucht die volle Hierarchie der
  Systematik, nicht nur die Endkode-Zeile) — der zweite Import muss also erneut die rohe
  DIMDI-Datei (oder eine gleichwertige Quelle mit Gruppen-/Kapitelstruktur) gelesen haben,
  nicht nur `icd10_titles` erweitert haben.
- **Für 2027:** der On-Prem-Repackaging-Weg (`seed-generieren.mjs`) funktioniert unverändert,
  SOBALD die Live-Tabelle die 2027er Daten trägt. Der fehlende Teil ist ausschließlich der
  Schritt „2027er DIMDI-Datei → vollständige 7-Spalten-Tabelle in der Live-DB" — dafür gibt
  es kein wiederholbares Skript. Nicht dringend (Termin laut §1-Kalender: 01.01.2027), aber
  wer immer den zweiten Umbau im Sommer 2026 gefahren hat, sollte das vor 2027 rekonstruieren
  oder das Vorgehen aus der Erinnerung aufschreiben, solange es noch möglich ist. → **W-A02**
  (Text unten entsprechend geschärft, Status bleibt `offen`, aber nicht mehr „kritischste").

**17.09.2026 — `wissensbank`-Doğrulaması (Ops #285, ikinci oturum; bu ajanın kendisi bu
sefer çağrıldı, MCP/canlı-DB erişimi bu oturumda yoktu — kod ve git geçmişine karşı
bağımsız doğrulama yapıldı):**
- **Pencere daha da daraltıldı: 01.07.2026 → 10.08.2026 (21:18).** `git show 9c93292 --
  db/SCHEMA.sql` (10.08.2026, ilk schema dump commit'i) `icd10_titles`'ı **zaten 7 sütunlu**
  gösteriyor (`code, titel, kapitel, ebene, terminal, code_plain, gruppe`). Yani ikinci
  dönüşüm 01.07 (4 sütun, 13.041 satır, commit `7eb7a56`) ile 10.08.2026 arasındaki
  **~40 günlük pencerede** yapılmış — önceki oturumun "01.07 ile bugün arası" tarifinden
  çok daha dar.
- **`git log -S "code_plain"` ve `git log --follow -- '*icd10_titles*'` her ikisi de
  temiz** — üç commit dönüyor (`7eb7a56` orijinal import, `c94c7af` eski migration'ların
  arşivlenmesi, `62aedd2` O-38 seed) ve hiçbiri ikinci dönüşümün kaynağı değil. **Doğrulama:
  önceki oturumun "committeten Skript yok" bulgusu teyit edildi, çürütülmedi.**
- **`db/REGISTER.md` (db-ustasi sicili) satır sayısını bağımsız olarak doğruluyor:**
  `icd10_titles` girdisi "16.905 Kodes" ve "Seit: 01.07.2026 · `icd10_titles_ddl`" diyor —
  `icd10_titles_ddl` repoda **hiçbir dosyaya karşılık gelmiyor** (yalnız `db/REGISTER.md` ve
  `db/NUTZUNG.json`'da geçiyor), yani muhtemelen canlı DB'nin kendi migration defterindeki
  bir isim — bu da "doğrudan canlıya, dosyasız" tezini destekliyor. Bu oturumda MCP ile canlı
  DB'ye ayrıca sorgu **atılmadı** (araç bu oturumda yoktu); db-ustasi'nin kendi kaydı ikinci,
  bağımsız bir kaynak olarak kullanıldı.
- **`api-backend/db/migrations/0013_seed_icd10_titles.sql` başlığı ve `RAISE EXCEPTION`
  eşiği doğrulandı** (satır ~17064: `n < 16905` → migration durur) — önceki oturumun
  aktardığı sayıyla birebir eşleşiyor.
- **2027 süreci zaten kısmen yazılı:** aynı dosyanın başlığında *"⚠️ Jährliche
  Aktualisierung … die 2027er Fassung braucht eine NEUE Migrationsdatei
  (tools/seed-generieren.mjs), niemals eine Änderung dieser hier"* notu var. Yani
  **repackaging** adımı (canlı tablo → on-prem seed dosyası) zaten tarif edilmiş ve
  tekrarlanabilir. Eksik olan **hâlâ ve yalnızca** şu: canlı `icd10_titles` tablosunun
  kendisini 2027 DIMDI verisiyle **kim, nasıl** dolduracak — `seed-generieren.mjs` bunu
  yapamaz, yalnız zaten dolu olanı paketler (`tools/seed-generieren.mjs` içindeki sorgu
  `SELECT * FROM public.icd10_titles` — kaynağı canlı tablo, ham DIMDI dosyası değil).
- **Sonuç:** Z-08/W-A02'nin 17.09.2026 (ilk oturum) tarafından bırakılan tarifi doğru VE
  eksiksizdi; bu oturum onu **daraltarak** ve **bağımsız kaynaklarla teyit ederek**
  kapattı. "Belgesiz" etiketi artık yanlış genelleme değil — tek, tarihen sınırlı, adı
  konmuş bir boşluk: *"2027 DIMDI ham dosyasını 7-sütunlu tam hiyerarşiye çeviren adım
  bilinmiyor ve tekrarlanabilir değil."* Aciliyet yok (takvim: 01.01.2027, bkz. §1).

### Z-09 · Kostenträgerdatei / IK  → tam kart **W-01**
```
FORMAT SPEC:
wissensbank/gemeinsam/302-tp5/Anhang_03_Anlage_1_TP5_V09_20260414.pdf/.txt   (V09, GEÇERLİ ab 01.06.2026 — kapaktan)
wissensbank/gemeinsam/302-tp5/Anhang_03_Anlage_1_TP5_V10_20260414.pdf/.txt   (V10, ab 01.02.2027)

VERİ (dış kaynaklı, resmî) — 11 ayrı dosya, her biri kendi sürümü:
wissensbank/gemeinsam/kostentraeger/{AO05Q326_KE3, BK05Q326_KE1, IK05Q326_KE1,
                                     BN050526_KE0, LK05Q226_KE0,
                                     EK05Q226_KE0, EK05Q426_KE0}.txt      <- 05.09 kopyala-yapıştır, UTF-8/LF
  = 22.436 satır · 660.087 bayt · 1.329 KOTR kaydı · 1.043 tekil IK · 12.133 VKG satırı
wissensbank/gemeinsam/kostentraeger/{AO05Q426_KE0, BK05Q426_KE0, IK05Q426_KE0,
                                     EK05Q426_KE1}.txt                    <- 30.09 curl, byte-exact, ISO-8859-1/CRLF
  01.10.2026'dan geçerli küme (bu 4 + BN050526 + LK05Q226) = 1.067 kayıt · 1.042 tekil IK · 11.411 VKG
  → api-backend/billing/kostentraeger/parser.js       ✅ gerçek dosyalara karşı koşuyor
  → api-backend/billing/kostentraeger/parser.test.js  ✅ 1.329 / 1.043 regresyon testi
  → tools/kostentraeger-annahmestellen-laden.mjs      (tekrarlanabilir yükleyici, --write)
  → DB kostentraeger                  1.052 satır (1.043 gerçek IK + 9 mock_unbestaetigt)
  → DB kostentraeger_annahmestellen  11.409 satır (6 dosyanın VKG'si — EK Q2 hariç)
  ↔ DB krankenkassen.ik_number (94 kasadan 76'sı dolu) — Ops kartı #264
  → kutu (on-prem) seed zinciri, tools/seed-generieren.mjs ile üretilmiş (30.09.2026'da sicile eklendi):
      api-backend/db/migrations/0006_seed_kostentraeger.sql
      api-backend/db/migrations/0007_seed_kostentraeger_annahmestellen.sql   (vdek = EK05Q426_KE0 ⛔ düşmüş)
      api-backend/db/migrations/0036_seed_kostentraeger_anschriften.sql      (ANS → ladePapierannahmestelle, Begleitzettel)
      api-backend/db/migrations/0037_seed_kostentraeger_annahmestellen_quelle_stand.sql (vdek = EK05Q226_KE0 ⛔ 30.09 düşer)
    Uygulanmış migration değiştirilmez → her çeyrek geçişi YENİ bir seed dosyası demektir (db-ustasi + onprem).
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
için yapı olarak kullanılabilir. V10 **01.02.2027'de** yürürlüğe giriyor; bugün
geçerli V09 01.10.2026'da indirildi (aşağıda W-01 #3 ✅).

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

### Z-11 · Podologie Höchstmenge / Verordnung kuralları (HeilM-RL Heilmittelkatalog)
```
wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.pdf/.txt
    (iK 05.08.2025 — Heilmittelkatalog II. Podologische Therapie s. 73-77; § 7 Abs. 2/5)
wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung.pdf/.txt
    (i.d.F. 16.06.2025, Ziffer 3 f) — Höchstmenge aşılırsa ne olur)
  → module/verordnung-regeln.js:91   POD_HOECHSTMENGE {DF:6,NF:6,QF:6,UI1:8,UI2:4}  [Q1/Q2 etiketli]
                             :97   POD_ORIENTIEREND {UI1:8, UI2:8}
                             :189-204  regelnFuerBereich() — DB kazanır, bunlar Rückfall
                             :250-257  REGELSTAND — yeni Richtlinie geldiğinde gözden geçirme listesi
    → module/verordnung-pruefung.js:220-234  UEBER_HOECHSTMENGE (uyarı, blok değil)
    → module/verordnung-podo.js:72/:75 → :365-395 einheitenPruefen()   ⚠ kendi kopyası (W-A10)
    → api-backend/ai/validators/diagnosegruppen.json:162-279           (backend kopyası)
  → DB diagnosegruppen.hoechstmenge (db/SCHEMA.sql:1240) — physio'da dolu, **podolojide boş**
```
📌 Runtime sırası tersinden okunur: DB doluysa **DB kazanır**, koddaki değerler yalnız
boşluğu doldurur (`verordnung-regeln.js:198-204`). Yani podolojide bugün geçerli olan sayı
kodun içindedir; `diagnosegruppen.hoechstmenge` podoloji için doldurulduğu gün Rückfall
kendiliğinden devre dışı kalır — **o gün DB'deki değerin bu kaynağa uyduğu doğrulanmalıdır.**
⚠️ Aynı sayı üç dosyada duruyor (18.09.2026'da üçü de sayıldı, tutarlı). HeilM-RL veya
Anlage 3 güncellenirse üçü birden yürünür; biri unutulursa sistem *kısmen* güncel olur.
Kural metni, alıntılar ve satır numaraları: `SPEC-RULES.md` → „Podologie Höchstmenge je
Verordnung — UI2 dörttür, sekiz değil".

---

### Z-12 · Şifreleme / imzalama profili (SECON) — ⏳ **kod tarafı henüz yok**
```
wissensbank/gemeinsam/302-tp5/GGT.pdf/.txt                              (Fassung ab 01.09.2026)
  → § 5.1  sıra: önce imzala, sonra alıcının açık anahtarıyla şifrele
  → § 5.2  → GGT Anlage 16
wissensbank/gemeinsam/302-tp5/GGT_Anlage_16_Security_Schnittstelle_SECON.pdf/.txt
    (Stand 02.09.2025 · Gültig ab 01.01.2026 · 94 s.)
  → api-backend/billing/dta/filename.js:80  buildEncryptedFilename()   ⛔ ÇELİŞKİ (aşağıda)
  → api-backend/billing/api/abrechnung.routes.js   (SignedData OID · cert_valid_to)
  → DB terapeut_zertifikat (cert_subject/thumbprint/serial/valid_from/valid_to — yalnız metadata)
  → ⛔ EnvelopedData üreten kod              YOK — zincirin eksik halkası, plan Adım 1.3
  → ⛔ Alıcı açık anahtarı (annahme-rsa4096.key) çeken/pinleyen yol   YOK — plan O-116
```
📌 **Bu zincir 21.09.2026'da açıldı**, `ABRECHNUNG_ECHTBETRIEB_PLAN.md` Adım 1.3'ün „bu belge
olmadan başlanmaz" kaydı üzerine. Belge indirildi, **kod tarafı bilinçli olarak boş** — bu bir
hata değil durum tespiti.

⛔ **Belgenin hemen doğurduğu bir çelişki var (`gkv-302` + `builder` karar vermeli):**
`filename.js:80` şifreli dosyaya `.dta.p7m` uzantısı veriyor; Anlage 16 § 3.2.3.1 ise
*„Eine verschlüsselte Nachricht als PKCS#7-Datenobjekt wird in einer Datei abgelegt, die
**keine Dateiendung** aufweist. Physikalisch handelt es sich um eine Binärdatei"* diyor.
Aynı belgenin Abkürzungsverzeichnis'i `.p7m`'i „PKCS#7 **MIME**-Nachricht" uzantısı olarak
tanımlıyor — yani `.p7m` bu profilin dosya adı değil, e-posta dünyasının adı. Bugün zararsız
(canlı gönderim yok), ama **1.3 yazılmadan önce kapanmalı**; sonradan kapatılırsa üretilmiş
dosya adları da değişir.

⚠️ Sayılar YZ ile okunmadı: OID'ler, anahtar uzunlukları ve alan adları
`GGT_Anlage_16_…SECON.txt` § 2.1.3 / 2.1.4 / 2.2.4 / 3.2.2 satırlarından birebir alındı
(bkz. `INDEX.md` anahtar bölümler listesi).

---

### Z-13 · Podologie: Heilmittelname ≠ Leistungsname — „Komplex" araması (Ops #302)
```
wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt
    (§ 27a Abs. 4 Nr. 3 Z.1130-1142 · Heilmittelkatalog DF/NF/QF c) Z.3381/3434/3483)
      = „Podologische Komplexbehandlung" → verordnetes HEILMITTEL c)
wissensbank/podologie/20240725_Anlage_1a_Leistungsbeschreibung_lesefassung_b.pdf/.txt
    (Teil 1 Nr. 4 Z.167-171 · Teil 2 Ziff. 3 Z.358-366)
wissensbank/podologie/20250617_Podologie_Anlage_2.pdf/.txt   (§ 2 Z.82 · § 3 Z.332)
wissensbank/podologie/Podologie_Positionsnummern_2026_Filtered.csv   (Z.21 · Z.24)
      = „Podologische Behandlung (klein/groß)" → LEISTUNG 78010 / 78020
  → api-backend/billing/codes/podologie_positions.js:33-34,75-76   label (amtlich) + kat (Suchanker)
    → api-backend/sync_heilmittel_katalog.js:94   kategorie: p.kat
      → DB heilmittel_katalog.kategorie   (Migration 0039 · ✅ SaaS'a uygulandı 27.09.2026, MCP)
        → RPC search_heilmittel()  LIKE code/kuerzel/label/kategorie
  → module/verordnung-regeln.js:73-76   POD_KATALOG.c   (Heilmittel c) metni)
      ↔ Çapa == POD_KATALOG.c, module/heilmittel-suche-komplex.test.js ile zorlanıyor
```
📌 Etiket **bilinçli olarak değişmedi**: 78020'yi „Komplexbehandlung" diye adlandırmak yanlış
kuralı öğretir (78010 de c)'nin pozisyonu) ve abrechenbar olmayan 78003'ün resmî adıyla çarpışır
(SPEC-RULES → „Maßnahme ≠ Leistung"). `kuerzel` podolojide **boş kalmalı**: `katalog-suche.js`
`kuerzel || code` gösterir, doldurulursa HPNR seçicide kaybolur.
⚠️ Yeni Preisfenster eklerken (her 01.07.) `kat` alanı yeni pencerenin 78010/78020 satırlarına
taşınmalı (`preise_autoupdate.mjs` alanı jenerik kopyalar, doğrulandı) — unutulursa
`heilmittel-suche-komplex.test.js` her pencerede kırmızı olur (fensterzahl-unabhängig). ⚠️ Anlage 1a Z.136 hâlâ eski „§ 28 HeilM-RL" diyor; kodun § 27a atfı doğru.
Açık iki madde (bu turda **yapılmadı**, karar kullanıcıda): a) Hornhautabtragung/Nagelbearbeitung ve
„gross"↔„groß" arama boşlukları (`kategorie` tek değer taşır; çoklu terim için `suchbegriffe`
sütunu gerekir), b) c) için >20 dk şartı (SPEC-RULES'ta ⛔).

---

### Z-14 · Muster 13 Heilmittel-Limit (§ 12 Abs. 2/3 HeilM-RL) — Physio/Ergo/Logo, Podologie ohne (Ops #202/#303)
```
wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt
    (§ 12 Abs. 2 S.1-3, Abs. 3 S.1-3 · Z.555-568)
      = Physio/Ergo: max 3 vorrangige Heilmittel, NUR wenn Katalog in der Diagnosegruppe
        mehrere vorsieht (S.1) + max 1 ergänzendes Heilmittel (Abs.3)
      = Logopädie (S.2): eigene, andersartige Regel — max 3 Behandlungszeiten/Einzel-Gruppe-
        Kombinationen, KEINE Aufteilung auf vorrangige Heilmittel, kein ergänzendes Heilmittel
        (Katalog hat dort 0 Stellen, nachgezählt 21.09.2026)
wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung.txt   (Feld g2, Z.465-473)
      = Podologie: Aufteilung entfällt komplett (§ 12 Abs. 2 zählt Podologie nicht)
  → SPEC-RULES.md „Muster 13 en fazla 3 vorrangiges + 1 ergänzendes …" (Kural-Text)
  → Kodda: ⛔ UYGULANMAMIŞ — dashboard.html:3621/3625 tek rzHm + tek rzHmErg alanı,
    prescriptions.heilmittel_items (db/SCHEMA.sql:2256) liste taşır ama sayı kapısı yok
  → module/verordnung-maske.js:~525-533, module/verordnung-podo.js  (Code-Kommentare,
    korrigiert Commit 3c0f04e — nur Kommentartext, kein Verhalten)
```
📌 **Ops #202/#303 zinciri:** #202 önce yanlış Podoloji kategorisindeydi ve `.pod-hm-row`/
`heilmittel_items`'ın iki tabloda olduğunu iddia ediyordu (her ikisi de veraltet — `verordnungen`
04.09.2026'da silindi). 21.09.2026'da `gkv-302` kaynağa karşı doğruladı, #200/#202 kategorisi
Physiotherapie'ye çekildi, kod yorumları düzeltildi. 27.09.2026'da `SPEC-RULES.md`'deki kural
metninin kendisi de 3 noktada düzeltildi (S.1 koşulu eksikti, Logo yanlış ergänzendes-Heilmittel
kapsamındaydı, KVN Ausfüllhilfe kaynağı arşivde yok). Detay:
`wissensbank/sitzungen/2026-09-21_ops-303_heilmittel-aufteilung-nur-physio-ergo.md`.
⚠️ **Hâlâ uygulanmamış** — bu bir kod zinciri değil, yalnız doğru kaydedilmiş bir kural. Sayı
kapısı (max 3 + 1) UI'da yok, DTA tarafında da yok (Anlage 1 TP5 V21 § 5.5.3.3 EHE 1-n sınırsız).
⛔ Board-tarafı hâlâ açık (Ops-Dashboard, repo dışı): #302 kartı eski "Alias für 78020" metnini
taşıyor, #209 hâlâ #200 altında asılı duruyor (aidiyeti #302).

---

### Z-15 · Bulut AI sağlayıcısının §393 SGB V kanıtı (Microsoft C5) → tam kart **W-06**
```
Microsoft C5:2020 Report „Azure + Dynamics 365 + Online Services" (01.04.2025–31.03.2026)
    ⛔ DEPODA YOK — Drive: I:\My Drive\Ops Praxura gitnogo\ (dağıtım kısıtlı, W-06)
    (Section 1 s.8-11 görüş · Section 3 s.19 kapsam tablosu „Azure OpenAI Service" dipnot 6
     · s.45 Foundry kapsam cümlesi · Executive Summary s.5 datacenter listesi)
  → konsey/KARARLAR.md  2026-09-12 Seçenek E  +  2026-09-28 olgu güncellemesi
      → on-prem AI sağlayıcı kararı (bugün: ertelendi, E yeniden AÇILMADI)
  → api-backend/ai/azureClient.js   SaaS'ın Azure OpenAI istemcisi
      EU_DATA_BOUNDARY_REGIONS (… 'swedencentral' …) + bölge assert'i
      → api-backend/ai/router.js (Rezept OCR, b2c-draft)
  → DB: yok (hiçbir tablo beslenmiyor)
```
📌 Bu zincir **kod sabiti taşımıyor** — belge bir sayı değil, bir **hukuki kanıt** besliyor:
„sağlayıcının §393'ün istediği C5 Typ-2 testatı var mı, hangi dönem, hangi servis". Rapor
düştüğünde (bkz. §1 takvimi) koddaki hiçbir şey kırılmaz; kırılan şey **iddianın dayanağıdır**.
⚠️ `azureClient.js`'teki `swedencentral` satırı ile rapordaki „Sweden Central" **aynı iddia
değil**: rapor datacenter'ı listeliyor, **servis↔bölge eşlemesi vermiyor** (Azure OpenAI'nin
Sweden Central'da denetim kapsamında koştuğu raporda yazmıyor — KARARLAR 2026-09-28 açık
madde 1). Zincir okunurken bu bir doğrulama değil, bir **boşluk** olarak okunmalı.

---
### Z-16 · Podologie: Behandlungsunterbrechung + Behandlungsbeginn-Frist (HeilM-RL § 15 / § 16 Abs. 4) — Reform S1.9
```
wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt
    § 15 Abs. 1-2 (Z.677-682)      = 28 Kalendertage / dringlich 14 → sonst Verordnung ungültig
    § 16 Abs. 4 S.1-2 (Z.698-700)  = >14 KT ohne Begründung → ungültig   (Physio/Ergo/Logo)
    § 16 Abs. 4 S.5 (Z.702-704)    = Podologie: Unterbrechung → NICHT ungültig
wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung.txt  lit. e (Z.390-414)
    = 14/28 wiederholt; Ungültigkeit dort explizit nur für dringlich
wissensbank/podologie/20230524_Podologie_FAK_bf.txt  Nr. 11 (Z.92-110) · Nr. 34 (Z.295-303)
    = Auslegung, kein Norm — "<12 Wochen bleibt gültig", Nagelspange ">12 Wochen: Nein"
  → module/heilmittel-fristen.js:41 BEHANDLUNGSBEGINN_TAGE · :52 behandlungsbeginnFrist
      → prescriptions.gueltig_bis (dashboard.js:15834)
      · :80 pruefeBehandlungsbeginn
  → module/frequenz-pruefung.js:361 pruefeErsttermin  (nur podo, erster Termin → BLOCK)
      ← dashboard.js:5805 (Termin-Fenster) · :6776 (KI-Serienbestätigung)
  → module/frequenz-pruefung.js:263 pruefeFrequenz → :325 bewerteAbstand(…, !istPodo)
      (podo: keine Unterbrechungsprüfung)
  → Tests: module/heilmittel-fristen.test.js · module/frequenz-pruefung.test.js:317-419
  → SPEC-RULES.md „Podologie: Behandlungsunterbrechung …" + „Behandlungsbeginn-Frist …"
```
📌 Commit `dbd79f0` (29.09.2026). Vorher: FAK Nr. 11 falsch herum gelesen → 84-Tage-Ungültigkeit
auch für Podologie; und keine Beginn-Frist-Prüfung beim Verplanen.
⚠️ **offen — Sahip `builder` (Physio-Feinabstimmung, Ops → Teknik):** `module/frequenz-pruefung.js:66`
`UNTERBRECHUNG_TAGE = 12 * 7` trägt die Quellenangabe „§ 16 Abs. 4 Satz 5" — Satz 5 enthält keine
Frist; für Physio/Ergo/Logo gilt Satz 1 (14 Kalendertage ohne Begründung). Die 84 Tage sind
unbelegt. Podologie unberührt.
**Bei neuer HeilM-RL-Fassung:** § 15 und § 16 Abs. 4 neu lesen → `BEHANDLUNGSBEGINN_TAGE` und
den `!istPodo`-Schalter prüfen. Bei neuer Anlage 3 Podologie: lit. e. Neuer FAK: Nr. 11/34.

### Z-17 · Podologie Reform S1.12 + S2 — Abrechnungszeitpunkt, Hausbesuch, Test/Erprobung, Status, IK
```
wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung.txt  (i.d.F. 16.06.2025)
    lit. c (Z.357-370)  = Hausbesuch nur bei „Ja"; leer/Nein → nicht abrechenbar, VO gültig
    lit. p (Z.689-705)  = Rechnungsdaten „nach Beendigung der Verordnung"; IK LE
    lit. q (Z.708-721)  = Behandlungsabbruch-Datum (konditionelle Pflicht); Nagelspange = reg. Ende
wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_…txt  Anlage 3 (Z.2315-2349) · § 11 (Z.516-537)
wissensbank/gemeinsam/positionsnummern/Positionsnummernverzeichnis_2026_Full.csv:1814,1823  (79933/79934)
wissensbank/gemeinsam/302-tp5/Richtlinien-Text_061120.txt  § 7 Abs. 1 (Z.249-255) · § 9 Abs. 2 (Z.306-309)
wissensbank/gemeinsam/302-tp5/Gemeinsame_Umsetzungsempfehlungen_…_20250213.txt  Frage 1/2 (Z.77-103)
wissensbank/gemeinsam/302-tp5/Anhang_02_…_20031110.txt  § 5 (Z.137-154) · § 6 (Z.156-166)
wissensbank/gemeinsam/302-tp5/Anlage_1_TP5_V21_20260115.txt
    Kap. 3 (2)(4)(6) (Z.353-372) · Kap. 6.1-6.4 (Z.7958-8004) · UNB S002 (Z.830-848)
    SLGA-FKT (Z.1427-1437) · SLLA-FKT (Z.1875-1885) · UNB 0035 (Z.913-917)
wissensbank/podologie/20240725_Anlage_1a_…txt  Teil 1 Nr. 2 (Z.80-84) · 4.1 (Z.458-462) · 4.2 (Z.491-493)
  → S2.6 Hausbesuch-Sperre · S2.3 Abrechnungs-Bestätigungsmodal · S2.1 Testdatei sperrt VO nicht
  → S2.7 IK-Pflicht vor Dateierzeugung · S1.12 Serie erbt 78040 nicht
  → Kodzeilen: ALLE OFFEN (noch nicht umgesetzt) — nach Umsetzung hier + in SPEC-RULES eintragen
  → SPEC-RULES.md: „Hausbesuch (79933/79934) …" · „Abrechnung Verordnung bittikten sonra …"
     · „Testdatei ödeme tetiklemez" (netleşti) · „Datenaustausch durum terimleri …"
     · „IK des Leistungserbringers Muss'tur …" · „6 seanslık serinin …" (S1.12 satırı)
```
⚠️ **offen — Sahip `builder` (Reform S2):** Kod satırları beş maddenin hiçbirinde henüz yok. Uygulandıkça
bu kart ve SPEC-RULES `Kodda:` satırları doldurulur; dolmadan sprint maddesi kapanmış sayılmaz.
⚠️ **offen — Sahip DAS-Termin (`project_das_ik_registrierung`):** Erprobungsdatei (UNB 0035 = 1) ödeme
tetikler mi — Anhang 2 § 6 sessiz, çıkarım: zweigleisig (§ 9 Abs. 2) → konvansiyonel fatura paralel.
⚠️ **offen — elle indirme:** Podologie Rahmenvertrag § 125 ana metni (i.d.F. 30.11.2020 / 20.10.2023)
arşivde yok — § 7 Abs. 1 „soweit in Verträgen nichts anderes" istisnası ve 78040 § 3a buna bağlı.
**Bei neuer Anlage 3 Podologie:** lit. c/p/q neu lesen. **Bei neuem Korrekturverfahren-Stand:** Frage 1/2.
**Bei Anlage 1 V22-Nachfolger (TA):** Kap. 3, Kap. 6, UNB S002, FKT-IK-Felder.

### Z-18 · Podologie Reform S3.6 + S3.7 — ICD-Endständigkeit, Arzt-Nr./Stempel/Unterschrift, BSNR
```
wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung.txt  (i.d.F. 16.06.2025)
    Ziffer 3 (Z.69-83, S.3)         = Beginn nur mit Personalien, Diagnose, Heilmittel, Stempel+Unterschrift
    Ziffer 4 Abs. 2 (Z.102-112)     = nachträgl. Korrektur: Absetzung + einmalig, 3 Monate
    Ziffer 4 Abs. 4/5 (Z.122-140)   = Arztkorrektur mit Unterschrift+Datum / per Fax
    Ziffer 5 a (Z.257-308, S.8-9)   = Arzt-Nr. fehlt → kein Beginn; BSNR aus Stempel, Korrektur nach Abr.
    Ziffer 5 k (Z.531-577, S.15-16) = therapierelevant a/b/c; Korrektur nur Arzt, vor Einreichung
    Ziffer 5 n (Z.618-626, S.17)    = ohne Unterschrift+Arztstempel ungültig
wissensbank/gemeinsam/302-tp5/Anlage_1_TP5_V21_20260115.txt  (Stand 15.01.2026)
    ZHE BSNR (Z.3237-3250, S.68) · ZHE LANR (Z.3266-3295, S.69) = 9 Ziffern, Ersatzwert 999999999
    DIA (Z.3492-3505, S.72) · Kap. 6.3/6.4 (Z.7985-8003, S.162)
wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt  Anlage 3 Zeile k (Z.2374-2375)
wissensbank/gemeinsam/icd-10-gm/Klassifikationsdateien/icd10gm2026syst_kodes.txt  Feld 2 T/N
    (Liesmich Z.144-146) — E11.7- N · E11.74/E11.75 T · G62.9 T · L60.0 T
wissensbank/podologie/20230524_Podologie_FAK_bf.txt  Nr. 28 (Z.232-244) — Auslegung
  → S3.6 Endständigkeit: Kodda AÇIK — heute api-backend/billing/dta/preflight.js:99-102
       isValidIcd10 (nur Format) · Ziel laut Sprint: katalog-suche.js + preflight
       ← icd10_titles / search_diagnosen() (DB, Z-08) müsste Feld 2 (T/N) tragen — db-ustasi fragen
  → S3.7 LANR/Stempel/Unterschrift: Kodda AÇIK — Formular heute confirm()-Override;
       DTA-Seite schon konform: preflight.js:297-310 (D:01001 Fehler, D:01003/Prüfziffer Warnung)
  → SPEC-RULES.md „Podologie: ICD-Endständigkeit ist kein §302-Datei-Abweisungsgrund …"
     · „Podologie: Arzt-Nr. oder Arztstempel/Unterschrift fehlt …"
```
📌 Kurallar `gkv-302` 29.09.2026; `wissensbank` aynı gün orijinale karşı doğruladı ve düzeltti
(n) S. 16 değil S. 17; Unterschrift-Beginn-Sperre Ziffer 3'ten; E11.7- örneği therapierelevanz
açısından şüpheli; „BSNR nur Warnung" ve „Anlage 3 a = anderweitige Regelung" çıkarım işaretlendi).
⚠️ **offen — Sahip `builder` (Reform S3.6/S3.7):** kod satırları yok; uygulandıkça burası + SPEC-RULES
`Kodda:` doldurulur.
⚠️ **offen — Sahip `gkv-302`, S3.6 başlamadan önce:** Sprint tablosu (`PODOLOGIE_REFORM_SPRINT.md:155`)
endständig olmayan ICD'de **blok** diyor, SPEC-RULES **Warnung** diyor — hangisi uygulanacak.
Aynı turda: `E11.7-` gibi DFS/Neuropathie deklare etmeyen N-kod „erkennbar nicht therapierelevant" mi.
**Bei neuer Anlage 3 Podologie:** Ziffer 3, 4, 5 a/k/n neu lesen. **Bei ICD-10-GM 2027 (01.01.2027):**
T/N-Status der E1x.7-/E1x.4-Kodes neu prüfen (Z-08). **Bei TA-Nachfolger:** ZHE LANR/BSNR-Feldregel, Kap. 6.

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
| `wissensbank/gemeinsam/302-tp5/Anhang_03_Anlage_1_TP5_V09_20260414` | V09 | **01.06.2026** (kapaktan) | ✅ GEÇERLİ (01.02.2027'de V10 devralır → V09 DÜŞER) | Z-09 | ⬜ |
| `wissensbank/gemeinsam/302-tp5/Anhang_03_Anlage_1_TP5_V10_20260414` | V10 | 01.02.2027 | ⏳ GELECEK | Z-09 | ⬜ |
| `wissensbank/gemeinsam/302-tp5/Anhang_01_…_Kapitel_4_Datenuebermittlung_20170831` | — (Stand 31.08.2017) | 01.09.2017 | ✅ GEÇERLİ | Z-01 dalı | **✅ kart W-02** |
| `wissensbank/gemeinsam/302-tp5/Anhang_02_…_Kapitel_9_Pruefverfahren_20031110` | — (Stand 10.11.2003) | belirtilmemiş | ✅ GEÇERLİ | Z-01 dalı | **✅ kart W-03** |
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
| `Richtlinien-Text_061120` | i.d.F. 20.11.2006 | 01.06.1996 | ✅ GEÇERLİ — teyit 29.09.2026: `Anlage_1_TP5_V21_20260115.txt:14` „Stand der Richtlinien: 20.11.2006". § 7 Abs. 1 / § 9 Abs. 2 → **Z-17** |

### §125 SGB V sözleşmeleri ve ücret anlaşmaları

| Dosya | Sürüm / Stand | Durum | Besler |
|---|---|---|---|
| `20251201_Physiotherapie_Vertrag_125_Anlage_2_barrierefrei` | Lesefassung, ab 01.01.2026 | ✅ GEÇERLİ | Z-03 |
| `wissensbank/podologie/20250617_Podologie_Anlage_2` | i.d.F. 01.07.2025 | ✅ GEÇERLİ | Z-04 |
| `wissensbank/podologie/20250617_Podologie_Anlage_1c_Leistungsbeschreibung` | i.d.F. 01.07.2025 | ✅ GEÇERLİ | podoloji akışı |
| `wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung` | i.d.F. 16.06.2025 | ✅ GEÇERLİ | podoloji akışı · **Z-11** · Z-14 (g2) · **Z-16** (lit. e) · **Z-17** (lit. c/p/q) |
| `wissensbank/podologie/20250617_Podologie_Aenderungsvereinbarung` | 16.06.2025 | ✅ GEÇERLİ | — |
| `wissensbank/podologie/20240725_Anlage_1a` + `1b_Leistungsbeschreibung` | i.d.F. 17.06.2024 | ✅ GEÇERLİ | — |
| `wissensbank/podologie/20230524_Podologie_FAK_bf` | Stand 24.05.2023 | ✅ GEÇERLİ | HPNR referansı · **Z-16** (Nr. 11/34, yorum — norm değil) |
| `20260212_Vertrag_125_sssst_Anlage_2_Verguetungsvereinbarung` | i.d.F. 12.02.2026 | ✅ GEÇERLİ | Logo/Stimme — ⬜ koda girmedi |
| `20240531_Ergo_Anlage_2_Vertrag_nach_125…` | Stand 01.06.2024 | ✅ GEÇERLİ | Ergo — ⬜ koda girmedi |
| `20220421_Lesefassung_Anlage_3_Ernaehrungstherapie` | 25.04.2022 | 🚫 KAPSAM DIŞI (Ernährungstherapie) | — |
| `wissensbank/gemeinsam/302-tp5/GGT` | Fassung ab **01.09.2026** (Stand 29.06.2026) | ✅ GEÇERLİ | Z-12 · **kart W-05** |
| `wissensbank/_archiv/GGT_Fassung_ab_01.01.2026_Stand_06.11.2025` | ab 01.01.2026 | 🚫 DÜŞMÜŞ (21.09.2026) | — |
| `wissensbank/gemeinsam/302-tp5/GGT_Anlage_16_Security_Schnittstelle_SECON` | Stand 02.09.2025, ab 01.01.2026 | ✅ GEÇERLİ | Z-12 · **kart W-04** |
| `wissensbank/gemeinsam/302-tp5/GGT_Anlage_02_Auftragsdatei` | Auftragssatz V1.0 (Stand 10.10.2024), ab 01.01.2025 | ✅ GEÇERLİ | `dta/auftragsdatei.js` · ⬜ Herkunft yok |
| `wissensbank/gemeinsam/302-tp5/GGT_Anlage_04_Verfahrenskennungen` | Feldbeschreibung V1.1 (Stand 06.11.2025), ab 01.01.2026 | ✅ GEÇERLİ | `dta/auftragsdatei.js` · ⬜ Herkunft yok |
| `wissensbank/physiotherapie/anlage2.txt` | — | 01.01.2026 | ⬜ hangi Fachbereich, netleştirilmeli |
| `Podoloji/…HPNR…_2026.xlsx` + 2 CSV | Stand 15.12.2025, ab 01.01.2026 | ✅ GEÇERLİ | Z-05 |

### Heilmittel-Richtlinie, Diagnoseliste, ICD

| Dosya | Sürüm / Stand | Durum | Besler |
|---|---|---|---|
| `wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05` | değişiklik 15.05.2025, iK 05.08.2025 | ✅ GEÇERLİ | Z-07 dolaylı · **Z-11 doğrudan** (Höchstmenge) · **Z-14** (Heilmittel-Limit) · **Z-16** (§ 15 Beginn-Frist, § 16 Abs. 4 Unterbrechung) |
| `wissensbank/gemeinsam/heilmittel-richtlinie/heilmittel-diagnoseliste` | Stand 01.01.2026 | ✅ GEÇERLİ | **Z-07** |
| `wissensbank/gemeinsam/icd-10-gm/` (ICD-10-GM 2026) | Klassifikation 12.09.2025 | ✅ GEÇERLİ | **Z-08 — dar boşluk 01.07.–10.08.2026, doğrulandı** (17.09.2026 `wissensbank`) |
| `wissensbank/gemeinsam/heilmittel-richtlinie/praxiswissen-heilmittel` | Ausgabe 2026 | 📎 REFERANS | — |
| `wissensbank/physiotherapie/NOVENTI-Leitfaden-Blankoverordnung-Physiotherapie` | Stand 03.2026 | 📎 REFERANS (ticari kaynak, otorite değil) | — |
| `wissensbank/_archiv/Zusatzdateien/*.pdf` (11 adet) | 2026 | 🚫 KAPSAM DIŞI (Barthel, MMSE, FIM…) | — |
| `wissensbank/_archiv/_duplikate_2026-08-04/` (5 PDF) | — | 🗄 KARANTİNA | — |

### Bulut sağlayıcı testatları — ⛔ depo dışı (dağıtım kısıtlı)

| Belge | Dönem | Durum | Besler | Nerede | Herkunft |
|---|---|---|---|---|---|
| Microsoft C5:2020 Report — Azure inkl. Dynamics 365 (Public & Government), Deloitte | 01.04.2025–31.03.2026 (Azure OpenAI: yalnız –31.12.2025) | 📎 REFERANS | Z-15 | Drive `I:\My Drive\Ops Praxura gitnogo\` | **✅ kart W-06** (STP, oturumlu) |

---

## 3b. Tam kimlik kartları

### W-01 · Kostenträgerdatei Sonstige Leistungserbringer (TP05) — IK/DAS yönlendirme verisi

- **Dosya:** `wissensbank/gemeinsam/kostentraeger/` — **11 ayrı `.txt`**, yayıncının kendi
  adlarıyla. 05.09 partisi: `AO05Q326_KE3` · `BK05Q326_KE1` · `IK05Q326_KE1` · `BN050526_KE0` ·
  `LK05Q226_KE0` · `EK05Q226_KE0` · `EK05Q426_KE0` (22.436 satır · 660.087 bayt). 30.09 partisi:
  `AO05Q426_KE0` · `BK05Q426_KE0` · `IK05Q426_KE0` · `EK05Q426_KE1` (byte-exact). Türev yok.
  • ⚠️ **İki parti farklı kodlamada:** 05.09 = UTF-8 + LF (tarayıcıdan kopyala-yapıştır);
  30.09 = **yayıncının orijinali, ISO-8859-1 + CRLF** (`UNB+UNOC:3` = Latin-1). Klasördeki
  `.gitattributes` (`*.txt -text`) git'in CRLF'i LF'e çevirmesini engeller — yoksa sha256 tutmaz.
  • 06.09.2026'da bölündü; 07.09.2026'da ham tek parça `Krankenkassen IK nummern .md`
  **silindi** (W-A08 (c) — bölünme byte-exact doğrulandı, aşağıya bak)
- **Herkunft:** https://www.gkv-datenaustausch.de/leistungserbringer/sonstige_leistungserbringer/kostentraegerdateien_sle/kostentraegerdateien.jsp
  (eski sürümler: `…/kostentraegerdateien_archiv.jsp`) — login/lisans yok, açık indirme
  · **İndirme:** 05.09.2026 · **İndiren:** Kemal (tarayıcıdan dosya indirilemedi, içerik kopyala-yapıştır ile alındı)
  · **İndirme 2:** 30.09.2026 ~12:14 MESZ · **İndiren:** `wissensbank` ajanı, `curl -f` (engel yok, HTTP 200,
  `Content-Length` = dosya boyu). Doğrudan dosya URL'i (RSS `<guid>`):
  `https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/sonstige_leistungserbringer/kostentraegerdateien_1/<DATEINAME>.<keN>`
  (ör. `…/AO05Q426.ke0`). Sunucu `Last-Modified: Tue, 29 Sep 2026 23:05:26 GMT` — dört dosyada aynı:
  sunucunun yeniden yayımlama zamanı, belge tarihi DEĞİL (belge tarihi UNB'de, tabloya bak)
- **Yayıncı:** GKV-Spitzenverband / kasa birlikleri (AOK-BV · BKK · IKK · Knappschaft · SVLFG · vdek)
- **Sürüm / Stand:** tek bir sürümü **yok** — 6 kasa birliğinin 7 ayrı dosyası, her birinin kendi tarihi (tablo aşağıda)
- **Anzuwenden ab:** dosya başına ayrı · **Düşer:** her dosya kendi Kassenart'ının bir sonraki sürümüyle
- **Durum (30.09.2026):** 6 dosya ✅ **GEÇERLİ** (4'ü bugün son gün) · 4 yeni dosya ⏳ **GELECEK**
  (ab 01.10.2026) · `EK05Q426_KE0` ⛔ **DÜŞMÜŞ** — yürürlüğe girmeden yerini `KE1` (18.09.2026) aldı.
  **01.10.2026'dan:** 6 GEÇERLİ (#8-#11 + #4 + #5) · 5 DÜŞMÜŞ (#1 #2 #3 #6 #7 — silinmez, arşivde kalır)
  ✅ **01.10.2026 ~01:10 Berlin: Q4 SaaS DB'ye yüklendi** (madde 9-11), kutu seed'i `0045`.
- **Neyi besler:** Z-09 → `parser.js` (+ `parser.test.js`) → `tools/kostentraeger-annahmestellen-laden.mjs`
  → DB `kostentraeger` (1.052 satır) + DB `kostentraeger_annahmestellen` (11.409 satır
    — ⛔ Ersatzkassen tarafında **yanlış sürüm**, bkz. açık madde 6)
  ↔ DB `krankenkassen.ik_number` 76/94 (Ops #264). **06.09.2026'dan beri zincirin tamamı gerçek veriyle besleniyor.**
  **01.10.2026'dan (Q4 yüklemesi):** #8 · #9 · #10 · #11 + #4 · #5 → `datei-lesen.js` (Latin-1/UTF-8 okuyucu)
  → `parser.js` → `lade-plan.js` (Stichtag'a göre dosya seçimi; + `lade-plan.test.js`)
  → `tools/kostentraeger-annahmestellen-laden.mjs --write` → SaaS DB `kostentraeger` (1.043 `echt`, 18'i
  `valid_to 2026-09-30`) · `kostentraeger_annahmestellen` (11.411) · `kostentraeger_anschriften` (1.586)
  → **kutu:** `api-backend/db/migrations/0045_seed_kostentraeger_q4_2026.sql` (O-38 / O-139; 0006/0007/0036/0037
  SHA-kilitli, üstüne 0045 biner). ⚠️ Bir sonraki çeyrekte bu zincirin **iki** ucu tazelenir: SaaS yüklemesi
  **ve** yeni bir seed migration'ı (0045 değiştirilmez).
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
- **Yedek:** ✅ git izliyor (ilk giriş `d4982fb` 05.09.2026, bölme `cceb528` 06.09.2026; Q4 partisi 30.09.2026).
  30.09 partisi **sha256 ile orijinale karşı doğrulanabilir** (tabloda) — 05.09 partisi doğrulanamaz.
  `.gitignore` yalnız `*.pdf` kapatıyor, bu dosyalar metin. Silinen ham `.md`'nin içeriği
  git geçmişinde duruyor (`git show d4982fb:...`), ayrıca 7 parçanın toplamı birebir aynı.
  Yayın yüzeyi kapalı: `.vercelignore:79` → `wissensbank/` (satır no 09.09.2026 kök
  temizliğinden sonra tazelendi — o gün 11 ölü kural silinince liste yukarı kaydı).

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
| 7 | `EK05Q426.KE0` | EK = Ersatzkassen (vdek) | **01.10.2026** | 109979990 | 14.08.2026 18:00 | 261 | 726 | 19787–22442 | ⛔ **DÜŞMÜŞ** — yürürlüğe girmeden KE1 ile değişti |

**Toplam (05.09 partisi):** 1.329 KOTR kaydı · 1.043 tekil IK · 12.133 VKG · 1.916 ANS · 133 ASP · 104 DFU.

**Düşme tarihleri (30.09.2026'da yazıldı):** #1 `AO05Q326_KE3` · #2 `BK05Q326_KE1` · #3 `IK05Q326_KE1` ·
#6 `EK05Q226_KE0` → **son geçerli gün 30.09.2026**. #7 `EK05Q426_KE0` → hiç geçerli olmadı.
#4 `BN050526` · #5 `LK05Q226` → açık uçlu (yayıncıda halef yok, 30.09.2026 kontrolü).

#### 30.09 partisi — Q4/2026, yayıncıdan byte-exact (`curl`, YZ yok)

| # | Dosya (bizde) | Yayıncı adı | gültig ab (RSS) | Absender-IK | Dateidatum (UNB) | Bayt | sha256 | Kayıt | Tekil IK | VKG | Öncül |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 8 | `AO05Q426_KE0.txt` | `AO05Q426.ke0` | **01.10.2026** | 109910000 | 01.07.2026 12:30 ⚠ | 68.030 | `fe62147e4601636015039e8892326e22cdcbfc8fb21dec555188b061a9d6212b` | 186 | 186 | 764 | #1 |
| 9 | `BK05Q426_KE0.txt` | `BK05Q426.ke0` | **01.10.2026** | 104027544 | 16.09.2026 11:00 | 180.609 | `9a4dba6a9b3660267447ff6977bbca8f233af711a28699fc9eeb3e22062d3b22` | 365 | 365 | 3.234 | #2 |
| 10 | `IK05Q426_KE0.txt` | `IK05Q426.ke0` | **01.10.2026** | 109900019 | 11.09.2026 11:14 | 66.944 | `0532a24de677e3ef9be5bf27057c75a97f6c43d300468057d54f72f2904b8dd6` | 207 | 207 | 477 | #3 |
| 11 | `EK05Q426_KE1.txt` | `EK05Q426.ke1` | **01.10.2026** | 109979990 | 18.09.2026 12:00 | 74.189 | `9c03ce64afb96dbe83d2bc2b1d0703132228acc55975b4d0c898217e5f9df227` | 261 | 261 | 726 | #6 (+#7) |

⚠ AOK #8'in UNB tarihi öncülü #1 ile **aynı** (`260701:1230`) — yalnız Dateinummer 00401→00402 ve ad
değişmiş; yayıncı dosyayı Q3 zemininden türetmiş. "gültig ab" RSS'ten alındı (kural 6), UNB'den değil.

**Doğrulama (30.09.2026, deterministik):** her dosyada UNZ sayacı = UNH = UNT = IDK = parser kaydı
(186 · 365 · 207 · 261); parser VKG = ham `VKG+` segment sayısı; 9 haneli olmayan IK: 0.
`parseKostentraegerDatei()` metni `latin1` ile alınca U+FFFD: 0, umlaut doğru (`TBK Thüringer BKK`).
**Rastgele 8 VKG satırı** (dosya başına 2) parser çıktısından geri kurulup ham dosyadaki satıra karşı
birebir bulundu. `parser.test.js` 19/19 geçti (ama yeni dosyaları henüz okumuyor — açık madde 10).

**Öncüle göre fark** (satır bazında `diff`, yeni dosya UTF-8/LF'e çevrilerek; UNB/UNZ/UNT sayaçları hariç):

| Geçiş | Kayıt | VKG | Fark | Bizim kodlar (20 · 71 · 72) |
|---|---|---|---|---|
| #1 → #8 AOK | 187 → 186 | 764 → 764 | IK `108916709` (AOK Bayern DLZ Schwandorf) **çıktı**; ona bağlı 9 VKG (Verknüpfungsart 09, Art der Datenlieferung 21/26/27/28) `108910008` (AOK Bayern **SCD Ebermannsdorf**, VDT artık 01.10.2026) üstüne taşındı. Etkilenen Kasse-kaydı: `108310400` AOK Bayern. 23/16 satır | ⚠ **71 ve 20 dahil** — madde 11 |
| #2 → #9 BKK | 365 → 365 | 3.234 → 3.234 | **İçerik birebir aynı** — yalnız UNB tarihi/Dateinummer | — |
| #3 → #10 IKK | 207 → 207 | 475 → 477 | +2 VKG `VKG+09+107436557+5++28++++30` (AZE Emmendingen, kod 30) — IKK Brandenburg u. Berlin Ost/West; **17 IKK Nordrhein IK'sına** `VDT+19950801+20260930` (bitiş) eklendi. 21/23 satır | kod yok (yalnız 30) — ama 17 IK 30.09.2026'da biter |
| #7 → #11 vdek | 261 → 261 | 726 → 726 | TK `101575519` altında kod 30'lu 4 VKG'de Tarifkennzeichen **bir alan sağa** (`30+HHH` → `30++HHH`); 1 ASP metni `DAVASO GmbH` → `IQVIA HSS GmbH`. 7/7 satır | yok — madde 12 |
| #6 → #11 vdek | 261 → 261 | 724 → 726 | yukarıdaki + #6↔#7 arasındaki bilinen 2 TK/kod-30 satırı. 10/13 satır | yok |

**Podoloji'ye dokunan tek değişiklik AOK Bayern (#8).** BKK'da içerik hiç değişmedi.

⛔ **7. dosya bugün koda/DB'ye girmez.** vdek Q4 ile Q2 dosyasının IK kümesi **birebir aynı**
(261 = 261) ama içerik farklı (724 ↔ 726 VKG satırı). Yani tek seferde ikisi de yüklenirse biri
diğerinin üstüne sessizce yazar. 01.10.2026'dan önce Q4'ü yüklemek, o tarihe kadar **yanlış
Datenannahmestelle'ye yönlendirme** demektir — §302'de bu, dosya reddi sınıfıdır.

Ayrıca **263 IK birden fazla dosyada geçiyor**; 261'i bu vdek Q2/Q4 çiftinden, kalanı
Kassenart'lar arası ortak Verband/DAS kayıtları (ör. BKK ∩ vdek = 16 IK). Yükleyicinin
"son yazan kazanır" davranışı burada **yanlış** sonuç verir — birleştirme kuralı geçerlilik
tarihine göre olmalı, dosya sırasına göre değil.

#### Tazelik taraması 30.09.2026 (Q4/2026 geçişinden bir gün önce — yalnız gözlem, indirme/yükleme YAPILMADI)

Kaynak: yayıncı sayfası + sayfanın kendi RSS'i (aşağıda), 30.09.2026 ~12:10 MESZ okundu.
"gültig ab" ve yayın tarihi (RSS `pubDate`) yayıncıdan; dosya içi Dateidatum okunmadı (dosya indirilmedi).

| Kassenart | Sayfada yayımlı | gültig ab | RSS pubDate | Bizde | Sonuç |
|---|---|---|---|---|---|
| AOK | `AO05Q326.ke3` | 27.07.2026 | 31.07.2026 | ✅ aynı | 30.09'da düşer |
| AOK | `AO05Q426.ke0` | **01.10.2026** | 29.09.2026 | ⛔ yok | **indirilecek** |
| BKK | `BK05Q326.ke1` | 01.07.2026 | 31.07.2026 | ✅ aynı | 30.09'da düşer |
| BKK | `BK05Q426.ke0` | **01.10.2026** | 28.09.2026 | ⛔ yok | **indirilecek** |
| IKK | `IK05Q326.ke1` | 01.07.2026 | 25.08.2026 | ✅ aynı | 30.09'da düşer |
| IKK | `IK05Q426.ke0` | **01.10.2026** | 28.09.2026 | ⛔ yok | **indirilecek** |
| Knappschaft | `BN050526.ke0` | 01.05.2026 | 27.04.2026 | ✅ aynı | yeni sürüm yok, geçerli kalır |
| SVLFG | `LK05Q226.ke0` | 01.04.2026 | 22.04.2026 | ✅ aynı | yeni sürüm yok, geçerli kalır |
| vdek | `EK05Q226.ke0` | 01.04.2026 | 21.04.2026 | ✅ aynı | 30.09'da düşer |
| vdek | `EK05Q426.ke1` | **01.10.2026** | 18.09.2026 | ⚠ bizde **KE0** (Nachtrag 0) | **KE1 indirilecek** — KE0 artık sayfada yok, yerini KE1 aldı |

✅ **Aynı gün:** 4 dosyanın dördü de 30.09.2026 ~12:14'te indirildi (#8-#11, yukarıdaki tablo).

**01.10.2026 için gereken:** 4 dosya — `AO05Q426.ke0` · `BK05Q426.ke0` · `IK05Q426.ke0` ·
`EK05Q426.ke1`. Yüklendikten sonra düşenler: `AO05Q326_KE3` · `BK05Q326_KE1` · `IK05Q326_KE1` ·
`EK05Q226_KE0` · `EK05Q426_KE0` (arşivde kalır, silinmez). `BN050526` ve `LK05Q226` geçerli kalır.

**Açık madde 6'ya etkisi:** "01.10.2026'da kendiliğinden çözülür" beklentisi **artık doğru değil** —
DB'deki vdek satırları `EK05Q426_KE0`'dan, ama 01.10'dan itibaren geçerli yayın `KE1`. KE0↔KE1
farkı ölçülmedi (dosya indirilmedi). Madde 01.10'da da açık kalır, ta ki KE1 yüklenip fark ölçülene kadar.
↳ **Aynı gün ölçüldü:** KE0↔KE1 = 7 satır, hepsi TK kod 30 + bir ASP metni — 20/71/72 için karakter karakter aynı.

**Takvim gözlemi:** AOK/BKK/IKK Q4 dosyaları çeyrek başından **2-3 gün önce** yayımlandı
(Anhang 03 §2'nin "spätestens 4 Wochen vorher" beklentisinin tersine). Yani **03.09 kontrol günü
bunları yakalayamazdı** — elle kontrol tarihi tek başına yetmez; çeyrek başına kadar izlenmeli.

**Makine okunur kaynak (otomasyon için):**
- **RSS 2.0 var:** `https://www.gkv-datenaustausch.de/leistungserbringer/sonstige_leistungserbringer/kostentraegerdateien_sle/rss_kostentraegerdateien_sonstige_leistungserbringer.xml`
  — sayfadaki listenin birebir aynısı: her `<item>` = bir dosya, `<guid>`/`<link>` = doğrudan dosya
  URL'i, `<description>` = "gültig ab dem TT.MM.JJJJ", `<pubDate>` = yayın zamanı. HTTP `ETag` +
  `Last-Modified` başlıkları dönüyor (koşullu GET mümkün). Genel RSS listesi: `/rss_feeds/rssfeeds.jsp`.
- **API / bildirim servisi / newsletter: yok** (sayfada görülmedi).
- **URL'ler dosya bazında sabit ama sürüm bazında değişken:** `/media/dokumente/leistungserbringer_1/sonstige_leistungserbringer/kostentraegerdateien_1/<DATEINAME>.<keN>`.
  Yeni çeyrek/Nachtrag = yeni ad = yeni URL; eskisi listeden düşer (`EK05Q426.ke0` örneği).
  Yani "aynı URL'i yokla" yaklaşımı çalışmaz; **RSS'teki guid kümesini sicille karşılaştırmak** çalışır.
- Otomasyon önerisi (uygulama `builder`/`onprem`'e ait, G8: yeni n8n workflow'u değil):
  `.github/workflows/preise-check.yml` desenine bir adım — RSS'i çek, guid kümesi W-01 tablosundan
  farklıysa Telegram. İndirme ve DB yükleme **elde kalır** (sürüm zamanlaması insan kararı, madde 6).

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
3. ✅ **KAPANDI 01.10.2026 (indirme).** **Anhang 03 V09** indirildi: `wissensbank/gemeinsam/302-tp5/Anhang_03_Anlage_1_TP5_V09_20260414.pdf/.txt`.
   Herkunft: https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/sonstige_leistungserbringer/technische_anlagen_aktuell_4/Anhang_03_Anlage_1_TP5_V09_20260414.pdf
   (yayıncı sayfasında "aktuell" bölümünde, etiket "Anlage 1 - Anhang 3 Version 09 vom 14.04.2026", 352 KB) · curl -f, byte-exact ·
   sha256 `127444448df4f2c85d01f0def9f85b38eb0a8536229e1c8f339130ab57fc255e` · Kapak: Stand 14.04.2026 · Version 09 · **Anzuwenden ab 01.06.2026**
   (Änderungshistorie: "Inkrafttreten Version 09 auf 01.06.2026 vorgezogen"). Yayın: git'te PDF ignore'lu (`.gitignore *.pdf`), .txt izleniyor;
   Yeniden dağıtım: GKV-SV kamu spec'i, serbest. V09↔V10 (yalnız metinde görülen, YZ çevirisi yok): gövde aynı, §7.2 VKG/Stichtag-Gültigkeit
   alan sırasında metin farkı görülmedi (yalnız sayfa-düzeni farkı); tek içerik farkı §8.14 Abrechnungscode: V10'da Haushaltshilfe
   Gruppenschlüssel `C0` eklenmiş (V09'da yok). Kesin karar `gkv-302`. V10 kaydı: Durum GELECEK, 01.02.2027.
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
   ↳ **30.09.2026 gözlemi:** vdek Q4 yayını artık `EK05Q426.ke1` (18.09.2026) — DB'deki KE0 da
   geçersiz sürüm. 01.10'da kendiliğinden çözülmez; KE1 yüklenmeli + KE0↔KE1 farkı ölçülmeli.
   Sahip: `db-ustasi` (yükleme) · tarih 01.10.2026 · ayrıntı yukarıda "Tazelik taraması 30.09.2026".
   ↳ **30.09.2026 ölçüm:** KE0↔KE1 farkı 7 satır, yalnız TK kod 30 + bir ASP metni — 20/71/72
   etkilenmiyor. Madde **Q4 dosyaları DB'ye yüklenene kadar** açık (sahip `db-ustasi`, 01.10.2026; önce madde 9).
   ↳ **01.10.2026 ~01:10:** Q4 yüklendi (madde 9-11 kapanışına bak); `quelle = EK05Q226_KE0` satırı **0**,
   vdek artık `EK05Q426_KE1`'den. Bu maddenin kapanışı `db-ustasi`'nin ZEITFEHLER kaydının kapanışına bağlı.
7. ✅ **KAPANDI 30.09.2026 (indirme kısmı).** 4 dosya `curl` ile byte-exact indirildi; sha256 + parser
   sayımı + öncül farkı yukarıda (#8-#11). **Kalan:** DB yüklemesi → madde 6 + 9 + 10, `db-ustasi`, 01.10.2026.
8. **`offen` — tazelik kontrolü hâlâ elle.** RSS var (yukarıda); otomatik kontrol kurulmadı. Sahip:
   `builder` + `onprem` onayı. Kurulana kadar kontrol günü 03.09 değil **çeyrek başına kadar haftalık**.
9. ✅ **KAPANDI 01.10.2026** (kod: commit `aaccead` 30.09.2026; canlı yükleme 01.10.2026 ~01:10 Berlin).
   Yükleyici ve test artık `datei-lesen.js` → `dekodiereKostentraegerDatei()` ile okuyor: UTF-8 geçerliyse
   UTF-8, UNB `UNOC:3` ise `latin1`, başka kodlamada hata fırlatır (`parser.test.js:276-280`). Test
   (`parser.test.js:253`) **sayıyla değil U+FFFD ile** kontrol ediyor — sayım testinin kör noktası kapandı.
   Canlı yüklemede U+FFFD **0**; umlaut örneği DB'de doğru (AOK Aschendorf-Hümmling · Göttingen · Münden).
   Orijinal madde metni:
   ~~**KODLAMA TUZAĞI, DB yüklemesinden ÖNCE kapanmalı** (30.09.2026).~~ Yeni 4 dosya
   ISO-8859-1; `tools/kostentraeger-annahmestellen-laden.mjs:111` ve `parser.test.js:238`
   `readFileSync(…, 'utf8')` ile okuyor. Ölçüldü: utf8 okununca kayıt/IK/VKG sayısı **aynı** çıkıyor
   (sayım testi yakalamaz!) ama isimlerde dosya başına 189–356 `U+FFFD` oluşuyor → DB'ye bozuk kasa adı
   gider. Öneri: UNB `UNOC:3` ise `latin1` oku (ya da `TextDecoder('utf-8',{fatal:true})` dene, düşerse
   latin1). Sahip: `builder` (kod) · `db-ustasi` (yükleme) · tarih **01.10.2026**.
10. ✅ **KAPANDI 01.10.2026** (commit `aaccead`). `parser.test.js:21-22` `ECHT_DATEIEN` = #8 · #9 · #10 · #11 ·
    #4 · #5 (düşmüş dosyalar yalnız U+FFFD taramasında, `:257`). Yükleyici artık sabit liste değil
    **tarih güdümlü**: tüm dosyalar `gueltigAb` ile listeli (`kostentraeger-annahmestellen-laden.mjs:49-61`),
    `lade-plan.js` Stichtag'a (varsayılan: bugün, Berlin) göre her Kassenart için geçerli olanı seçer — yani
    madde 6'daki "gelecek sürüm erken yüklendi" hatası artık kapıyla önleniyor. 01.10.2026 koşusu Stichtag
    2026-10-01 (`--stichtag` verilmeden) şunları seçti: AO05Q426_KE0 (186) · BK05Q426_KE0 (365) ·
    IK05Q426_KE0 (207) · EK05Q426_KE1 (261) + BN050526_KE0 (37) · LK05Q226_KE0 (11) = 1.067 ✅ beklentiyle aynı.
    Sonuç: `kostentraeger` 998 satır güncellendi, 18'ine `valid_to 2026-09-30` (17 IKK Nordrhein + `108916709`);
    `kostentraeger_annahmestellen` 11.407 → **11.411** (+13 / −9); `kostentraeger_anschriften` 1.588 → **1.586**
    (+1 / −3). Kontrol: `quelle = EK05Q226_KE0` 0 satır. Orijinal madde metni:
    ~~`parser.test.js` ve yükleyicinin `ECHT_DATEIEN` listesi hâlâ 05.09 partisini okuyor.~~
    01.10.2026'dan geçerli küme #8 · #9 · #10 · #11 · #4 · #5 = **1.067 kayıt / 1.042 tekil IK /
    11.411 VKG** (30.09.2026, parser + latin1 ile sayıldı). Regresyon beklentisi bu olmalı; düşmüş
    dosyalar listeden çıkar (dosya arşivde kalır). Sahip: `builder` · 01.10.2026.
11. ✅ **KAPANDI 01.10.2026.** SaaS DB'de AOK Bayern Papierannahmestelle (VKG 09) artık `108910008` SCD
    Ebermannsdorf; eski partner `108916709` için VKG satırı **0**, IK kaydı `valid_to 2026-09-30` ile duruyor
    (silinmedi — eski Absetzung itirazı için). Kodlar 71 / 72 / 20 için VKG 03 çözümlemesi **tekil** (çift adres yok).
    Kutu tarafı: `0045_seed_kostentraeger_q4_2026.sql` aynı durumu taşıyor (0006/0007/0036/0037 dokunulmadı).
    Kalan tek iş kutunun migration'ı çalıştırması — sahibi `onprem` (O-38 / O-139), bu kartın maddesi değil.
    Orijinal madde metni:
    ~~**AOK Bayern Annahmestelle değişimi Podologie'ye dokunuyor.**~~ #1→#8: `108916709` (DLZ
    Schwandorf) kaldırıldı, VKG'leri (Verknüpfungsart 09, kodlar 20/61/62/66/67/68/71) `108910008` (SCD
    Ebermannsdorf, ab 01.10.2026) üstüne geçti. Verknüpfungsart 09 = Papierannahmestelle (0036 seed
    başlığı: Urbelege zarfı, `ladePapierannahmestelle()` → Begleitzettel adresi). Yani AOK Bayern
    Podologie Urbelege adresi 01.10'dan **Schwandorf → 92263 Ebermannsdorf, Untere Zell 7**. Kodda
    `108916709` sabit atıf yok; yalnız seed'lerde (0006/0007/0036/0037) duruyor. Yorum/onay `gkv-302`,
    yükleme + yeni seed `db-ustasi` (+ `onprem`). Tarih 01.10.2026.
12. **`unkritisch` (bizim için) — vdek KE1'de VKG 11. alan.** TK kod 30 satırları `…+30++HHH`; Anhang 03
    V10 §7.2 VKG'de 10 alan tanımlıyor, `parser.js` 11. alanı sessizce atar → `tarifkennzeichen` boş.
    KE0'da `30+HHH` idi. Yalnız kod 30 (bizim değil). Kod 30 bir gün kullanılırsa yeniden açılır;
    yayıncı hatası mı yeni konum mu sorusu `gkv-302`'nin.

---

### W-02 · Anhang 1 zur Anlage 1 TP5 — Kapitel 4 „Datenübermittlung"

- **Dosya:** `wissensbank/gemeinsam/302-tp5/Anhang_01_Anlage_1_TP5_Kapitel_4_Datenuebermittlung_20170831.pdf`
  + `.txt` (8 sayfa · PDF 82.240 bayt · txt 11.014 bayt · 223 satır) · başka türev yok
- **Herkunft:** https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/sonstige_leistungserbringer/technische_anlagen_aktuell_4/Anhang_1_Anlage_1_TP5_20170831.pdf
  · **İndirme:** 10.09.2026 · **İndiren:** `gkv-302` (canlı-gönderim hazırlık denetimi)
- **Yayıncı:** GKV-Spitzenverband (her sayfa altbilgisi: „Anhang 1 zur Technischen Anlage ·
  anzuwenden ab 01.09.2017 · GKV-Spitzenverband")
- **Sürüm / Stand:** sürüm numarası **yok** — kapak yalnız `Stand des Anhangs 1: 31.08.2017`
  diyor. Änderungshistorie üç giriş taşıyor: 31.08.2017 (§4.1 Dokumentnamen), 12.09.2012 ×3
  (layout, §4.1 Verweise, §4.3 physikalischer Dateiname eklendi).
- **Anzuwenden ab:** **01.09.2017** (kapaktan, „Anzuwenden ab:" satırı) · **Düşer:** açık uçlu —
  halefi yayımlanmamış
- **Durum:** ✅ **GEÇERLİ**
- **Neyi besler:** Z-01 dalı → `wissensbank/SPEC-RULES.md` § „Datenübermittlung · Test- /
  Erprobungsverfahren · Verschlüsselung" (§4.2 → *Logischer Dateiname*, §4.3 → *Physikalischer
  Dateiname*, §3.1'le birlikte *Nutzdatendatei + Auftragsdatei çift gider*)
  → `api-backend/billing/dta/filename.js` ⛔ **çelişki, aşağıya bak**
  → Auftragsdatei üreten kod: **yok**
- **Tazelik kontrolü:** ⛔ otomatik yok. Elle:
  https://www.gkv-datenaustausch.de/leistungserbringer/sonstige_leistungserbringer/sonstige_leistungserbringer.jsp
  → „Technische Anlagen (aktuell)" listesinde `Anhang_1_Anlage_1_TP5_*.pdf` satırının tarihi
  `20170831`'den farklıysa yeni sürüm çıkmıştır. Anlage 1 TP5 **V22** ile birlikte kontrol
  edilir (aynı sayfa, aynı bakış) — W-A09.
- **Yeniden dağıtım:** **serbest** — GKV-SV'nin kamuya açık teknik anlage'si, login/lisans yok,
  hasta verisi yok, ücretsiz indirilebiliyor. W-A07'nin şüphesi ICD-10-GM ve GKV
  **Lesefassung**'larıyla ilgili; §302 teknik anlagenler o kapsamda değil. Yine de yayın yüzeyi
  kapalı: `.vercelignore` → `wissensbank/` satırı (bugün :79).
- **Yedek:** `.txt` ✅ git izliyor · `.pdf` ⛔ izlenmiyor (`.gitignore` ilk satırı `*.pdf`) →
  W-A05 kapsamında, orijinal PDF yalnız bu makinede.
- **Format kararı:** `.txt` + INDEX bölüm haritası, **md üretilmedi.**
  Gerekçe: 8 sayfalık düzyazı spec; iki kritik yeri (§4.2 / §4.3) tablo, ama **sayı taşımıyorlar**
  — hane *tanımı* taşıyorlar, fiyat/kod değil. `grep` ile 1–2k token'da bulunuyor; md'ye çevirmek
  „§ 4.2" atfını kaydırır, kazanç sıfır (ajan §4, uzun düzyazı spec satırı). Sayı taşımadığı için
  §0.2 yasağı bu belgede devreye girmiyor, yine de dönüşüm `pdftotext -enc UTF-8 -layout` ile
  deterministik yapıldı ve kapak + §4.2 + §4.3 orijinale karşı elle örneklendi.

⛔ **Bu kartın taşıdığı asıl bulgu — çözülmeden koda dokunulmaz.**
`api-backend/billing/dta/filename.js` **16 haneli** `EHK…`/`EHM…` üretiyor
(`E` + `HK`/`HM` + IK'nın son 5 hanesi + 8 haneli laufende Nummer). Anhang 1 §4.2 ise
**11 haneli** `SL` + IK 3.–8. + `S`/`A` + ay istiyor. İki ad birbirine benzemiyor bile.
**Ama `filename.js` baş yorumu kendi kaynağı olarak „GKV-DA Anlage 17 (Nutzdatendateien)"
gösteriyor** — yani §302 Anhang 1'e değil, başka bir spesifikasyona dayanıyor. **Anlage 17
arşivde yok** (→ W-A09). Yani bugün elimizde iki farklı ad kuralı ve birinin belgesi eksik.
Hangisinin geçerli olduğu `gkv-302`'nin kararıdır; sicil yalnız çelişkiyi kaydeder.
Kart yazılırken kod okundu ve ölçüldü (10.09.2026), tahmin edilmedi.

### W-03 · Anhang 2 zur Anlage 1 TP5 — Kapitel 9 „Prüfverfahren"

- **Dosya:** `wissensbank/gemeinsam/302-tp5/Anhang_02_Anlage_1_TP5_Kapitel_9_Pruefverfahren_20031110.pdf`
  + `.txt` (5 sayfa · PDF 18.598 bayt · txt 8.362 bayt · 169 satır) · başka türev yok
- **Herkunft:** https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/sonstige_leistungserbringer/technische_anlagen_aktuell_4/ANHANG2_TAV5.pdf
  · **İndirme:** 10.09.2026 · **İndiren:** `gkv-302` (canlı-gönderim hazırlık denetimi)
- **Yayıncı:** Spitzenverbände der Krankenkassen (belgenin kendi ifadesi; 2003 tarihli, GKV-SV
  kurulmadan önce). Belgenin iç dosya adı: `ANHANG2_TAV5.DOC`.
- **Sürüm / Stand:** sürüm numarası **yok** — kapakta iki satır:
  `Stand der Technischen Anlage: 10.11.2003` · `Stand des Anhang 2: 10.11.2003`
- **Anzuwenden ab:** **belirtilmemiş** — kapakta „Anzuwenden ab" satırı **yok** (W-02'de var,
  burada yok; tahmin yazılmadı) · **Düşer:** açık uçlu — halefi yayımlanmamış
- **Durum:** ✅ **GEÇERLİ** — 23 yıllık olması düşmüş olduğu anlamına gelmez; yayıncı sayfasında
  „Technische Anlagen (**aktuell**)" başlığı altında duruyor ve Anlage 1 V21 § 2 Abs. 2 hâlâ
  Erprobungsverfahren'e atıf yapıyor.
- **Neyi besler:** Z-01 dalı → `wissensbank/SPEC-RULES.md` § „Datenübermittlung · Test- /
  Erprobungsverfahren · Verschlüsselung" (§5 → *Testdatei ödeme tetiklemez*, §3.1/§4/§6 →
  *Echt'e geçiş kasadan Zulassung gerektirir*, §3.1 → *Nutzdatendatei + Auftragsdatei çift gider*)
  → `api-backend/billing/api/abrechnung.routes.js:700 · :2810 · :3242` (`kind:'test'`)
  → `api-backend/billing/dta/builder.js:375` (`testIndikator` `'2'`/`'1'`/`'0'`) ✅ eşleme doğru
  → Erprobung/Echt sürecinin **durumunu tutan DB alanı: yok** ⛔
- **Tazelik kontrolü:** ⛔ otomatik yok. Elle: W-02 ile **aynı sayfa ve aynı bakışta** —
  „Technische Anlagen (aktuell)" listesinde `ANHANG2_TAV5.pdf` satırı. Dosya adı sürüm/tarih
  taşımadığı için sayfadaki „Stand" sütununa bakılır; PDF adı değişmeden içerik değişebilir,
  bu yüzden şüphede kapak sayfası yeniden okunur (`Stand des Anhang 2:` satırı ≠ 10.11.2003).
- **Yeniden dağıtım:** **serbest** — gerekçe W-02 ile aynı (kamuya açık §302 teknik anlage,
  login yok, hasta verisi yok). Yayın yüzeyi kapalı: `.vercelignore` → `wissensbank/` satırı.
- **Yedek:** `.txt` ✅ git izliyor · `.pdf` ⛔ izlenmiyor (`.gitignore` `*.pdf`) → W-A05.
- **Format kararı:** `.txt` + INDEX bölüm haritası, **md üretilmedi.**
  Gerekçe: 5 sayfa, tamamı düzyazı, tek tablo bile yok; sayı taşımıyor. Ajan §4'ün „tek seferlik
  okunacak" satırına en yakın belge — ama tek seferlik değil: canlıya geçiş kararında ve her
  Absetzung tartışmasında yeniden bakılacak, o yüzden bölüm haritası INDEX'e yazıldı.
  Dönüşüm `pdftotext -enc UTF-8 -layout`; kapak ve §5/§6 orijinale karşı elle örneklendi.

⚠️ **Belgenin iki tuzağı, atıf verirken bilinmeli:**
1. Numaralandırmada **iki kez „3.3"** var (Prüfstufe 3 ve Prüfstufe 4). Orijinaldeki dizgi
   hatası, metin dönüşümü hatası değil — PDF'te de öyle. Atıf „§ 3.3 Prüfstufe 4" biçiminde
   verilmeli, yoksa okuyan yanlış bölüme bakar.
2. §5 başlığı „bei Wechsel auf die **Version 04** der Nachrichtentypen SLGA/SLLA" diyor; bugün
   SLGA/SLLA **Version 21**. Bölümün Prüfstufe ve Test-işaretleme hükümleri geçerli, içindeki
   sürüm numarası **tarihsel bir örnektir**, uygulanacak değer değil.

---

### W-04 · GGT Anlage 16 — Security Schnittstelle (SECON)

- **Dosya:** `wissensbank/gemeinsam/302-tp5/GGT_Anlage_16_Security_Schnittstelle_SECON.pdf`
  + `.txt` (94 sayfa · PDF 5.170.155 bayt · txt 180.034 bayt · 3.550 satır) · başka türev **yok**
  (gerekçe: §4 format kararı — tek seferlik değil ama *düzyazı spec*; `.txt` + INDEX bölüm
  haritası yeterli, md'ye çevirmek § atıflarını bozar ve kazanç sıfırdır)
- **Herkunft:** https://www.gkv-datenaustausch.de/media/dokumente/standards_und_normen/technische_spezifikationen/Anlage_16_-_Security_Schnittstelle.pdf
  · liste sayfası: https://www.gkv-datenaustausch.de/technische_standards_1/technische_standards.jsp
  · login/lisans yok, açık indirme · **İndirme:** 21.09.2026 · **İndiren:** `wissensbank`
  (kaynak: `ABRECHNUNG_ECHTBETRIEB_PLAN.md` Adım 1.3 + §10 „Kalan Faz 0 işi")
- **Yayıncı:** GKV-Spitzenverband · Deutsche Rentenversicherung Bund · DRV Knappschaft-Bahn-See ·
  Bundesagentur für Arbeit · DGUV (GGT'nin ortak yayıncı kurulu, § 95 SGB IV)
- **Sürüm / Stand:** **sürüm numarası yok** — kapak ve her sayfa altbilgisi yalnız
  `Stand: 02.09.2025` diyor. Atıf biçimi: „Anlage 16 GGT, Stand 02.09.2025, § x.y"
- **Anzuwenden ab:** **01.01.2026** (altbilgi `Gültig ab:01.01.2026`, 94 sayfanın hepsinde —
  deterministik sayıldı, 94/94) · **Düşer:** açık uçlu
- **Durum:** ✅ **GEÇERLİ**
- **Neyi besler:** **Z-12** → bugün yalnız `filename.js` + `abrechnung.routes.js` (imza tarafı) ·
  EnvelopedData üreten kod **henüz yok**, plan Adım 1.3'ün girdisi. DB tarafında
  `terapeut_zertifikat` (yalnız metadata — özel anahtar sisteme hiç girmiyor, `guvenlik` K2)
- **Tazelik kontrolü:** ⛔ otomatik yok. Elle: yukarıdaki liste sayfası açılır, „Anlage 16 -
  Security Schnittstelle (SECON)" satırının dosya boyutu (bugün **5,2 MB**) ve indirilen PDF'in
  kapak `Stand:` tarihi karşılaştırılır. ⚠️ **Sayfa Anlagen için ayrı „gültig ab" tarihi
  vermiyor** — tarih yalnız belgenin kendi altbilgisinden okunur, ana GGT'ninkinden
  türetilmez. **Kontrol anı:** ana GGT her değiştiğinde Anlagen de gözden geçirilir
  (21.09.2026 bunun canlı örneği: GGT düşmüştü, Anlagen'e bakılmamıştı)
- **Yeniden dağıtım:** ⚠️ **şüpheli — dağıtılmıyor.** `.gitignore:1` → `*.pdf`, yani PDF git'te
  değil; `.txt` git'te izleniyor ama yayın yüzeyi kapalı (`.vercelignore` → `wissensbank/`).
  Kutuya (on-prem image) **girmiyor** ve girmesi gerekmiyor — kodun ihtiyacı belgenin metni
  değil, ondan süzülen sabitler. `legal-de`'ye sorulması gereken bir durum bugün **yok**;
  soru ancak belge müşteriye dağıtılmak istenirse doğar. W-A07 kapsamında (GKV Lesefassung)
- **Yedek:** ⚠️ PDF **git izlemiyor** (`*.pdf` ignore) — W-A05 kapsamında, tek kopya bu makinede.
  `.txt` git'te.

#### 1.3 için kritik olan altı satır (kaynağa karşı doğrulandı, YZ çevirisi değil)

| Ne | Değer | Nerede yazıyor |
|---|---|---|
| İçerik şifrelemesi | AES-256, **CBC** — `id-aes256-CBC`, OID `2.16.840.1.101.3.4.1.42` | § 2.1.3 · § 2.2.1 |
| Nachrichtenschlüssel şifrelemesi | **RSAES-OAEP** (EME-OAEP, RFC 8017), OID `1.2.840.113549.1.1.7`, hash SHA-256 + MGF1 | § 2.1.4 · § 2.1.4.1 |
| RSA anahtar uzunluğu | **4096 Bit** (Teilnehmer, CA, PCA) · açık üs `65537` | § 2.1.4 · § 2.2.4 · § 2.2.5 |
| Sıra | önce `SignedData`, sonra `EnvelopedData` (SignedData objesi şifrelemenin **girdisi**) | § 3.1 · § 3.2 |
| Alıcı kimliği | yalnız `KeyTransRecipientInfo`; `rid` için **yalnız** `issuerAndSerialNumber` (CA adı + seri no), `subjectKeyIdentifier` **yasak** | § 3.2.2.3 · § 3.2.2.3.2 |
| Sertifika ömrü | Teilnehmer **azami 1 yıl** · CA 5 yıl · PCA 7 yıl (Schalenmodell) | § 4.5 |

Ayrıca zorunlu boşaltılan alanlar: `version` = 0, `originatorInfo` **entfällt**,
`unprotectedAttrs` **entfällt** (§ 3.2.2.1, § 3.2.2.2, § 3.2.2.5) · `contentType` = `id-data`
(`1.2.840.113549.1.7.1`, § 3.2.2.4.1) · sertifika kodlaması **DER**, X.509v3 (§ 2.2.7).

Alıcının açık anahtarı **Kostenträgerdatei'den gelmez** (o IK ve adres taşır): § 4.6.1'e göre
ITSG'nin yayımladığı `annahme-rsa4096.key` listesinden (Datenannahmestelle anahtarları,
base64) veya § 4.6.2 LDAP dizininden alınır; ayrıca `sperrliste-le-rsa4096.crl`. Listeler
**iş günleri** güncelleniyor. Bu, plan O-116'nın „kaynak belli" satırının belge tarafındaki
karşılığıdır.

---

### W-05 · Gemeinsame Grundsätze Technik (GGT) — § 95 SGB IV

- **Dosya:** `wissensbank/gemeinsam/302-tp5/GGT.pdf` + `.txt` (16 sayfa · PDF 241.027 bayt ·
  txt 33.603 bayt) · türev yok
  · **Düşmüş sürüm arşivde:** `wissensbank/_archiv/GGT_Fassung_ab_01.01.2026_Stand_06.11.2025.pdf/.txt`
- **Herkunft:** https://www.gkv-datenaustausch.de/media/dokumente/standards_und_normen/gg_technik/GGT.pdf
  · liste sayfası: https://www.gkv-datenaustausch.de/technische_standards_1/technische_standards.jsp
  · Änderungshistorie: `…/standards_und_normen/gg_technik/Aenderungshistorie.pdf`
  · **İndirme:** 21.09.2026 (güncel Fassung) · **İndiren:** `wissensbank`
  · önceki Fassung indirme tarihi: belirtilmemiş (arşivdeki dosya 18.05.2026'dan beri diskte)
- **Yayıncı:** GKV-Spitzenverband · DRV Bund · DRV Knappschaft-Bahn-See · BA · DGUV
- **Sürüm / Stand:** `in der vom 01.09.2026 an geltenden Fassung`, kapak tarihi **29.06.2026**,
  BMG/BDA onayı 03.08.2026
- **Anzuwenden ab:** **01.09.2026** · **Düşer:** açık uçlu
- **Durum:** ✅ **GEÇERLİ** (önceki Fassung `ab 01.01.2026` → 🚫 **DÜŞMÜŞ**, arşivde)
- **Neyi besler:** **Z-12** (§ 5.1 imzala-sonra-şifrele sırası) · dolaylı olarak Z-01 dalı
  (Anhang 1 Kap. 4.1, DFÜ yolları) · Anlagen listesi üzerinden W-04, GGT Anlage 2, GGT Anlage 4
- **Tazelik kontrolü:** ⛔ otomatik yok. Elle: liste sayfasındaki „Gemeinsame Grundsätze
  Technik" satırının **„gültig ab" tarihi** okunur ve buradaki tarihle karşılaştırılır. Bu
  sayfa, ana belge için tarih **veriyor** (Anlagen için vermiyor) — yani en ucuz tazelik
  sinyali burada. **Kontrol anı:** yılda en az iki kez, ayrıca §302 teknik anlagen turlarında
- **Yeniden dağıtım:** W-04 ile aynı — PDF git'te değil, `.txt` izleniyor, yayın yüzeyi kapalı
- **Yedek:** ⚠️ PDF git izlemiyor (W-A05)

#### 21.09.2026 sürüm geçişi — ne değişti, ne değişmedi

Deterministik `diff` ile ölçüldü (sayfa numarası ve satır kaydırmaları elenerek), YZ
kullanılmadı. Belge 15 → 16 sayfa:

| | Sonuç |
|---|---|
| **Tek esaslı ekleme** | **§ 4.2.5.1 „Nutzung von XML in den Datenaustauschverfahren"** (yeni) |
| § 5.1 Verschlüsselung und Signatur | **değişmedi** — planın Adım 1.3'te alıntıladığı cümle aynen duruyor |
| § 5.2 → Anlage 16 atfı | değişmedi |
| Anlagen listesi (1–17) | değişmedi |
| Datenaustauscharten tablosu (§ 4.1) | yalnız dizgi/hizalama farkı, içerik aynı |

⚠️ **§ 4.2.5.1 `gkv-302`'ye gidiyor, `wissensbank`'ın yorumlayacağı bir madde değil.** Metnin
söylediği: XML standart formattır; **01.01.2027'den önce** uygulanmış verfahren'ler, *esaslı
bir fachlich/teknik revizyon* geçirdiklerinde ve ekonomiklik ilkesi elverdiğinde XML'e
çevrilecektir. Bu, §302 EDIFACT zincirini bugün **kaldırmıyor** ve bir tarih dayatmıyor — ama
uzun vadeli yönü işaretliyor. → açık madde **W-A11**.

---

### W-06 · Microsoft C5:2020 Report — Azure inkl. Dynamics 365 (Public & Government), 01.04.2025–31.03.2026

- **Dosya:** ⛔ **DEPODA YOK — kasıtlı (dağıtım kısıtlı, aşağıya bak).** Kalıcı saklama yeri:
  `I:\My Drive\Ops Praxura gitnogo\` (Kemal taşıyacak). 28.09.2026 itibarıyla geçici olarak
  Kemal'in masaüstünde: `Azure + Dynamics 365 + Online Services – Public & Government C5 Report
  (04-01-2025 to 3-31-2026).pdf` (1.868.335 bayt · 208 sayfa). **Türev yok** — `.txt` de depoya
  girmez (metin de raporun kendisidir). Okuma gerekirse `pdftotext -enc UTF-8 -layout` ile
  **depo dışında** (scratch/temp) üretilir, iş bitince atılır. Bölüm haritası:
  `INDEX.md` → „Depo dışı belgeler".
- **Herkunft:** Microsoft Service Trust Portal — https://servicetrust.microsoft.com/ ·
  **oturum gerektirir**, belgenin kalıcı açık URL'i yok (belge URL'i: belirtilmemiş).
  Portaldaki başlık birebir: *„Azure + Dynamics 365 + Online Services – Public & Government C5
  Report (04-01-2025 to 3-31-2026)"* · **İndirme:** 28.09.2026 · **İndiren:** Kemal
- **Yayıncı:** Microsoft Corporation (rapor sahibi) · **Denetçi:** Deloitte & Touche LLP
  (Section 1 „Independent Accountant's Examination Report", rapor tarihi **07.07.2026**, s.11)
- **Sürüm / Stand:** BSI C5:2020 raporu, inceleme dönemi **01.04.2025 – 31.03.2026** (kapak +
  Executive Summary). Belgenin kapak başlığı: „Microsoft Corporation – Azure Including Dynamics 365
  (Azure & Azure Government) · Cloud Computing Compliance Criteria Catalogue (C5) Report".
  STP'de yayın **09.07.2026** — portal beyanı, belgenin kendisinde yazmıyor (belgede yalnız
  07.07.2026 rapor tarihi var)
- **Anzuwenden ab:** belirtilmemiş (testat belgesi, yürürlük tarihi taşımaz) · **Düşer:** resmî
  düşme tarihi yok; **dönem 31.03.2026'da bitti** ve boşluk o günden beri büyüyor. Sonraki dönem
  raporu (01.04.2026–31.03.2027) **~Temmuz 2027** bekleniyor — geldiğinde bu kart `DÜŞMÜŞ` olur
- **Durum:** 📎 **REFERANS** — koda sabit/sayı vermiyor; bir kararın hukuki kanıtı
- **Neyi besler:** **Z-15** → §393 SGB V C5 Typ-2 kanıtı → `konsey/KARARLAR.md` 2026-09-12
  Seçenek E + 2026-09-28 olgu güncellemesi (on-prem AI sağlayıcı kararı) ·
  `api-backend/ai/azureClient.js` (SaaS'ın Azure OpenAI istemcisi, `EU_DATA_BOUNDARY_REGIONS`
  kontrolü) · DB: **yok**
- **Tazelik kontrolü:** ⛔ otomatik yok, olamaz (portal oturumlu). Elle: Service Trust Portal →
  „C5" araması → Azure raporları; başlığında `(04-01-2026 to 3-31-2027)` geçen raporun çıkıp
  çıkmadığına bakılır. **Kontrol anı:** Temmuz 2027 başından itibaren ayda bir; ayrıca her AI
  sağlayıcı kararı tartışmasından **önce**. ⚠️ 14.09.2026 turunda yalnız Microsoft Learn
  sayfasına bakılıp „yayımlanmadı" denmişti — yanlıştı. **Kaynak Learn değil, STP'nin kendisi.**
- **Yeniden dağıtım:** ⛔ **depoya: yasak.** Kapak (s.1) kısıtı: rapor üçüncü taraflara
  dağıtılamaz; **istisna** — Azure bizim müşteriye verdiğimiz hizmetin bileşeniyse *mevcut ve
  aday müşterilerimize* verilebilir, **şartlarıyla**: (a) alıcıya Microsoft'un hizmetimizdeki
  işlevi yazılı açıklanır, (b) raporu alan kurumların **ve kişilerin** tam kaydı tutulur,
  Microsoft/Deloitte isterse derhal verilir, (c) kısıt paragrafı (veya eşdeğeri) alıcıya iletilir.
  Public depo (b)'yi imkânsız kılar → depoya, Vercel'e, on-prem image'a **girmez**. Bir praxis'e /
  müşteriye verilmek istenirse bu üç şart **`legal-de`'ye** gider, burada karar verilmez.
  (Not: KARARLAR 2026-09-28'deki „NDA şartlı" ifadesi tam değil — belge bir NDA değil,
  **koşullu dağıtım izni** veriyor; müşteriye verme yolu şartlarla açık.)
- **Yedek:** git izlemiyor (depoda yok; olsaydı da `.gitignore` → `*.pdf`). Drive'a taşınana
  kadar **tek kopya** Kemal'in makinesinde. Kaybolursa STP'den yeniden indirilebilir (oturumla),
  ama Microsoft eski dönem raporunu yenisi gelince portaldan kaldırabilir — Drive kopyası
  o gün tek kaynak olur (Absetzung itirazının eski-sürüm mantığı burada da geçerli).

#### Bizim için kritik satırlar (pdftotext ile belgeye karşı doğrulandı, YZ okuması değil · „s." = PDF sayfası, basılı sayfa no değil)

| Ne | Değer | Nerede |
|---|---|---|
| Görüş | **Şartsız** — „In our opinion, in all material respects" … „suitability of the design and operating effectiveness … throughout the period April 1, 2025 to March 31, 2026" → **Typ 2** | Section 1, s.8–11 |
| Azure OpenAI Service | Kapsam tablosunda Azure ✓ (Government –), H1 ✓ H2 ✓ — **ama dipnot 6:** „Examination period for this offering / service was from April 1, 2025 to **December 31, 2025**" → 01.01.–31.03.2026 **incelenmedi** | Section 3 kapsam tablosu s.19 („AI + Machine Learning"); dipnot 6 metni s.17 |
| Microsoft Foundry | Tam dönem ✓; „the scope of certification for Microsoft Foundry Models is limited to **Azure Direct Models**. All components operated by third-party model providers … are excluded from scope" | s.19 tablo · s.45 servis açıklaması |
| Azure OpenAI ↔ Foundry | OpenAI'nin 2026'da Foundry kapsamına taşındığı **raporda yazmıyor** — çıkarımdır | — |
| Sweden Central | Executive Summary datacenter listesinde EMEA altında var („Sweden Central", „Sweden South") | s.5 |
| Servis ↔ bölge | Rapor **eşleme vermiyor** — hangi servisin hangi bölgede denetlendiği yazmıyor | — |
| H1 / H2 | H1 = 01.04.–30.09.2025 · H2 = 01.10.2025–31.03.2026 | s.16, dipnot 5 |
| Complementary User Entity Controls | Görüş, müşteri tarafı tamamlayıcı kontrollerin uygulandığı varsayımına dayanıyor; denetim onları kapsamıyor | Section 1, s.9 |

⚠️ **İstisna sayısı düzeltmesi (28.09.2026).** Kayıt talebiyle „Section 4'te 2 istisna (SDL review
cadence)" diye geldi — **eksik.** Deterministik sayım: Section 4'te **20** C5 kriterinde
„Exception(s) Noted" var; bunlar **7 kontrol-seviyesi istisnaya** dayanıyor (Section 5
„Management's Response to Exceptions Noted", s.200 vd.):
**SDL-1** (9/23 serviste SDL review yıllık döngüde yapılmamış — DEV-01, PSS-02 vd.) · **SDL-2** ·
**DS-1** (1/35 secret rotasyonu gecikmiş + bazı iç platform anahtarları — IDM-08, CRY-03, CRY-04) ·
**PE-4** (2/20 datacenter'da fiziksel erişim, arızalı kilit — PS-01, PS-03, PS-04) · **VM-6**
(2/27 serviste — OPS-18, PSS-03, PSS-09) · **BC-8** · **SOC2-1** (1/25 serviste varlık
sınıflandırması — AM-01). „2 istisna", SDL-1'in iki kriterde (DEV-01, PSS-02) görünen çoğul
„Exceptions Noted" başlığıdır; diğerleri tekil „Exception Noted" başlığıyla yazılı.
**Görüş yine de şartsız** — hiçbir istisna görüşü niteliklendirmiyor ve Azure OpenAI'nin kapsamını
daraltmıyor. İstisnaların §393 açısından önemsiz olduğu yorumu **`legal-de`'nindir**; sicil yalnız
sayıyı düzeltir.

---

## 4. Açık maddeler

Her madde ya bir sahibe, ya bir tarihe, ya `unkritisch` gerekçesine bağlanır. Üçü de
yoksa `offen` kalır ve her raporda tekrar görünür.

### W-A01 · Herkunft (indirme URL'i) 35 kaydın 31'inde yok — `offen`
Belgelerin nereden indirildiği hiçbir yerde yazılı değil. Bir sürüm düştüğünde yenisinin
nereden alınacağı her seferinde yeniden araştırılıyor. Tek istisna Z-06 (fiyat XML'i,
URL script başlığında).
10.09.2026'da 2 kayıt daha kapandı (W-02, W-03 — tam indirme URL'i kartlarında).
Kalan: 31.
**Yapılacak:** her kayda Herkunft eklenir. Bilinen yayıncı kökleri:
`gkv-datenaustausch.de` (§302 teknik anlagenler) · `gkv-heilmittel.de` (fiyat) ·
`gkv-spitzenverband.de` (§125 Verträge, HPNR) · `bfarm.de` (ICD-10-GM) · `kbv.de`
(Diagnoseliste) · `g-ba.de` (HeilM-RL).
**Ölçüt:** bir belge silinse, kayıttan bakıp 2 dakikada yerine yenisi indirilebilmeli.

### W-A02 · ICD-10-GM 2027: canlı tabloyu ham DIMDI'den 7-sütuna çeviren adım tekrarlanabilir değil — `offen`, acil değil
**17.09.2026, iki oturumda araştırıldı ve `wissensbank` tarafından doğrulandı (Ops #285) —
bkz. Z-08 için tam kanıt zinciri.** Eski, geniş tanım ("2. Umbau belgesiz") geri çekildi;
gerçek boşluk artık şu kadar dar: 01.07.2026 (13.041 satır, 4 sütun, `7eb7a56`) ile
10.08.2026 21:18 (schema dump `9c93292` — tabloda o an zaten 7 sütun + ≥16.905 satır)
arasında, canlı DB'ye doğrudan uygulanmış ve **hiçbir committeten script'te izi olmayan**
bir dönüşüm var. `git log -S`/`git log --follow` iki oturumda da temiz çıktı; `db/REGISTER.md`
(db-ustasi, bağımsız kaynak) satır sayısını (16.905) teyit ediyor ama yöntemi açıklamıyor.
On-prem tarafı **W-A02'nin kapsamında değil**: `tools/seed-generieren.mjs` +
`api-backend/db/migrations/0013_seed_icd10_titles.sql` (O-38, 12.09.2026) canlı tabloyu
**olduğu gibi** paketler (`SELECT * FROM public.icd10_titles`) — zaten dolu bir tabloyu
kutuya taşır, boş bir soruyu (2027 verisi canlıya nasıl girer) cevaplamaz. O migration
dosyasının kendi başlığı zaten 2027 için yeni bir dosya gerektiğini yazıyor — süreç o
kadarıyla tarif edilmiş.
**Yapılacak — tek gerçek eksik:** 2027 DIMDI dosyası yayımlandığında (Klassifikation, tipik
olarak yaz sonu/sonbahar), birisi onu 01.07.2026'daki gibi filtrelenmiş Endkode importuna
değil, **`terminal`/`code_plain`/`gruppe` dahil tam hiyerarşiye** çeviren bir adım çalıştırmalı
— bunun **hiçbir hazır script'i yok**, 2026 yazında kim yaptıysa elle veya kayıt dışı bir
araçla yapmış olmalı. `db-ustasi` ile birlikte ya (a) o kişi hatırlıyorsa yöntemi yazdırmak,
ya da (b) DIMDI ham dosyasından 7-sütunlu tabloyu üreten **yeni, tekrarlanabilir bir script**
yazmak (`gruppe` alanı `code`'dan türetilemez — amtliche Gruppenbereiche gerekiyor, tam
Systematik-Datei okunmalı). **Aciliyet yok** — takvim 01.01.2027 (§1), bugünden ~3,5 ay önce
yeterli. Bu madde **büyütülmedi, daraltıldı**; ikinci bir genişletici araştırma gerekmiyor,
gerekli olan tek şey sürecin yazılı hale getirilmesi.

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
`.gitignore` ilk satırı → `*.pdf`. **49** PDF (~44 MB) yalnızca bu makinede
(10.09.2026'da 2 yeni PDF eklendi: Anhang 1 Kap. 4, Anhang 2 Kap. 9 — ikisi de izlenmiyor). `.txt` karşılıkları git'te
(70 dosya izleniyor), yani metin kayıp değil — ama **imzalı/orijinal PDF** kayıp olur.
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

### W-A07 · Yeniden dağıtım hakları — Kostenträgerdatei ✅ + ICD-10-GM ✅, GKV Lesefassung `offen`
`.vercelignore:72-73` şüpheyi yazılı olarak kaydediyor: *"fraglich, ob ICD-10-GM- und
GKV-Lesefassungen ueberhaupt weiterverbreitet werden duerfen"*. Yayın yüzeyi kapalı
(klasörler ignore'da ✅) ama **depo public** ve `.txt` karşılıkları git'te izleniyor.

> **Kullanıcı kararı 05.09.2026 — Kostenträgerdatei için kapandı.** Kemal: *"public kalsın
> sıkıntı yok, zaten public bilgiler bunlar."* `wissensbank/gemeinsam/kostentraeger/` git'te
> izlenmeye devam eder (kasa IK numaraları — resmî, kamuya açık veri, hasta verisi yok).

> ✅ **ICD-10-GM için de kapandı (12.09.2026, `legal-de`).** Soru bu kez daha ağırdı: repoda
> public kalması değil, **ticari on-prem ürününün Docker image'ına gömülüp müşteriye
> dağıtılması** (O-38, `api-backend/db/migrations/0013_seed_icd10_titles.sql`).
> `downloadbedingungen-2025.txt:67-71` bunu açıkça "anderes amtliches Werk" (§ 5 Abs. 2 UrhG)
> diye tanımlıyor — telif koruması yok, ticari dağıtım dahil yeniden dağıtım öngörülmüş,
> lisans ücreti yok. İki şart: Änderungsverbot (§ 62 — kod başlıkları aynen) ve
> Quellenangabe (§ 63 — atıf metni, bkz. migration başlığı; ayrı bir `NOTICE-QUELLEN.txt`
> + Dashboard satırı **hâlâ eklenmedi**, açık kalem `onprem/REGISTER.md` O-38'de).
> Band 2 (Alphabetisches Verzeichnis) **kapsam dışı** — Zi'nin ayrı hakları var, hiç
> dokunulmadı ve dağıtılmıyor. `compliance/LEGAL_DECISIONS.md`'ye tek satır düştü.
>
> **Hâlâ `offen`:** GKV Lesefassung'ları — ayrı yayıncı, ayrı soru, henüz sorulmadı.

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

### W-A09 · Eksik belgeler — **kısmen kapandı**, biri hâlâ `offen` ⚠️
10.09.2026’da `gkv-302`’nin canlı-gönderim hazırlık denetiminde ortaya çıktı.

✅ **GGT Anlage 2 (Auftragsdatei) 17.09.2026’da indirildi** (`GGT_Anlage_02_Auftragsdatei.pdf/.txt`,
yanında Anlage 4 Verfahrenskennungen) — INDEX’te kaydı var, kod tarafı
`api-backend/billing/dta/auftragsdatei.js`. Bu satır **sicilde güncellenmemişti**; 21.09.2026’da
düzeltildi. ⬜ İkisinin de **Herkunft’u yazılmadı** → W-A01.

✅ **Üçüncü satır (GKV-DA Anlage 17) yanlış hedefliydi.** GGT’nin Anlage 17’si
„KomServer RV"dir (Rentenversicherung), „Nutzdatendateien" değil — bkz. `GGT.txt` § 4.2.7.
Ayrıca `filename.js`’in iddia ettiği kaynak artık Anlage 17 değil: dosya 20.09.2026’dan beri
**11 haneli** logischer + **8 haneli** physikalischer ad üretiyor ve kaynak olarak Anhang 1
Kap. 4 § 4.2 / § 4.3’ü gösteriyor (başlığı okundu, doğrulandı). W-02’deki „16 hane" çelişkisi
bu yüzden **belge eksikliğiyle değil, kodun düzeltilmesiyle** kapanmış.

⏳ **Kalan tek eksik: Anlage 1 TP5 V22.** İndirilmedi (kullanıcı kararı: acil değil).

| Eksik belge | Niye lazım | Nereden |
|---|---|---|
| **Anlage 1 TP5 V22** (21.05.2026) | Bugün geçerli olan V21; V22'nin `Anzuwenden ab` tarihi **bizde yazılı değil** ve §1 takviminde yeri yok. Anlage 3 V22 ve Anhang 03 V10 01.02.2027'de giriyor — Anlage 1 V22 de aynı tarihteyse geçiş **tek pakettir**, ayrı ayrı planlanamaz | `gkv-datenaustausch.de` → Sonstige Leistungserbringer → Technische Anlagen (aktuell) |
| ~~GGT Anlage 2 (Auftragsdatei)~~ | ✅ **KAPANDI 17.09.2026** — indirildi, INDEX kaydı açıldı, `dta/auftragsdatei.js` ondan yazıldı | ✅ elimizde |
| ~~GKV-DA Anlage 17 (Nutzdatendateien)~~ | ✅ **KAPANDI 21.09.2026 — yanlış hedefti**, gerekçe yukarıda | — |

**Sahibi:** `wissensbank` (indirme + kayıt) → `gkv-302` (yorum + karar).
**Tarih bağı:** kalan tek belge (Anlage 1 TP5 V22) **01.02.2027 geçiş paketinden önce**
indirilmeli — `Anzuwenden ab` tarihi bizde yazılı olmadığı için geçişin tek paket mi yoksa
ayrı ayrı mı olduğu bugün bilinmiyor. **Ölçüt:** V22’nin kapak sayfası okunduğunda §1
takvimine ya yeni bir satır girer ya da mevcut 01.02.2027 satırına eklenir.

### W-A10 · Podologie Höchstmenge sayısı üç dosyada ayrı ayrı duruyor — `offen`, bugün `unkritisch`
`module/verordnung-regeln.js` kendini „eine Zahl, ein Ort" diye tarif ediyor ve baş yorumunda
*„`verordnung-podo.js` liest sie von hier"* yazıyor — **ama okumuyor**:
`module/verordnung-podo.js:72/:75` `POD_HOECHSTMENGE`/`POD_ORIENTIEREND` sabitlerini import
etmek yerine yeniden tanımlıyor. Üçüncü kopya backend'de:
`api-backend/ai/validators/diagnosegruppen.json` (DG başına `hoechstmenge` +
`orientierende_menge`).
18.09.2026'da **üçü de aynı** (DF/NF/QF 6 · UI1 8 · UI2 4 · orientierend 8/8), yani bugün
yanlış bir sayı üretmiyor — bu yüzden `unkritisch`. Risk ileride: HeilM-RL'nin
Heilmittelkatalog'u değişirse ikisi güncellenip biri unutulabilir ve kimse fark etmez
(kapı yok, test yalnız `verordnung-pruefung` yolunu sayıyor).
**Yapılacak (sahibi: `builder`, aciliyet yok):** `verordnung-podo.js` sabitleri
`verordnung-regeln.js`'ten import etsin (`verordnung-pruefung.js` zaten oradan besleniyor);
JSON kopyası için `diagnosegruppen.json`'un `_note`'unda anılan drift kontrolü
(`node api-backend/check_diagnosegruppen_icd.js --check`) `hoechstmenge`'yi de kapsasın.
**Ölçüt:** sayı tek dosyada değiştirilip `npm test` koşulduğunda diğer iki yolun da
değişmesi — ya da kapının bağırması.
**Tarih bağı yok**; bir sonraki HeilM-RL/Anlage 3 değişikliğinde Z-11'in ilk satırı olarak
okunur.

### W-A11 · GGT § 4.2.5.1 — „XML standart formattır" — `offen`, karar `gkv-302`’nin
21.09.2026’da GGT’nin yeni Fassung’uyla (ab 01.09.2026) **tek esaslı yenilik** olarak geldi.
Metin: XML standart formattır; **01.01.2027 öncesi** uygulanmış verfahren’ler, *esaslı bir
fachlich veya teknik revizyon* geçirdiklerinde ve Wirtschaftlichkeitsgebot elverdiğinde XML’e
çevrilecektir.
**Niye burada duruyor:** bu bir sicil yorumu değil, §302 zincirinin **yönü** hakkında bir soru.
Bugün §302 EDIFACT (SLGA/SLLA V21) ile çalışıyor ve metin ona **tarih dayatmıyor** — ama
TP6/HKP tarafında XML şemaları zaten var (`0_Änderungen.txt`), yani yön belli.
**Yapılacak (sahibi: `gkv-302`):** tek soru — „§302 Heilmittel-DTA için ilan edilmiş bir XML
geçiş takvimi var mı, yoksa bu yalnızca genel bir ilke mi?" Cevap „takvim yok" ise madde
`unkritisch` olarak kapanır ve bir daha açılmaz; „takvim var" ise §1 takvimine satır girer.
**Aciliyet yok** — canlı gönderim başlamadı ve ilkenin kendisi revizyon şartına bağlı.
**Kaynak:** `wissensbank/gemeinsam/302-tp5/GGT.txt` § 4.2.5.1 (Fassung ab 01.09.2026).

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

- **Sicil ilk kez „belge indirildi → aynı gün üç dosyaya birden kaydedildi" turunu tamamladı
  — 10.09.2026.** `gkv-302` iki belgeyi indirdi ve yola koydu; kimlik (sürüm, `Anzuwenden ab`)
  **kapak sayfalarından** okundu (dosya adına güvenilmedi — Anhang 2'de „anzuwenden ab" satırı
  **hiç yok**, „belirtilmemiş" yazıldı), INDEX'e bölüm haritası, REGISTER'a iki tam kimlik
  kartı, SPEC-RULES'a 8 kural girdi. **Delege çıktısı olduğu gibi kabul edilmedi:** 8 kuralın
  kod satırı atıfları tek tek ölçüldü, **üçü kaymıştı** (`kind:'test'` 710/2820/3252 → gerçekte
  **700/2810/3242**; SignedData OID :989 → **:983**; `cert_valid_to` :1021 → **:1011**) ve
  düzeltilerek yazıldı. Bir iddia da **fazla keskindi**: „`cert_valid_to` hiçbir yerde
  okunmuyor" — gerçekte iki yerde `SELECT` ediliyor (`:534`, `:2598`), ama hiçbir yerde
  **tarihle karşılaştırılmıyor**; kural o hâliyle yazıldı. Ajan §3'ün „en az bir iddiasını
  orijinale karşı örnekle" kuralının niye var olduğunun ölçülmüş örneği.

- **Kök temizliği sonrası atıflar tazelendi — 10.09.2026.** 09.09.2026'da beş klasör
  arşive taşındı ve `.vercelignore`'dan 11 ölü kural silindi; silinme listeyi yukarı
  kaydırdığı için bu sicildeki iki satır-numarası atfı yalan söylemeye başlamıştı.
  Düzeltilenler: `.vercelignore:82 → :79` (W-01 yayın yüzeyi satırı) ve
  `.vercelignore:73-75 → :72-73` (W-A07 ICD/Lesefassung şüphesi). Ayrıca ajan
  tanımındaki (`.claude/agents/wissensbank.md`, kural 5) aynı atıf çekildi ve
  `archive/README.md`'deki ölü `Handbücher/INDEX.md` işareti `wissensbank/INDEX.md`
  yapıldı. `wissensbank/README.md` ve W-A05'teki `.gitignore:1` → `*.pdf` atıfları
  **kontrol edildi, doğru** — `.gitignore`'un ilk satırı değişmedi.
  ⚠️ **Ders:** bir dosyaya satır numarasıyla atıf vermek ucuz ama **bakım borcu yaratır.**
  O dosya bu depoda her temizlikte kısalıyor. Yeni atıflarda satır numarasının yanına
  aranacak metin de yazılır (örn. „`.vercelignore` → `wissensbank/` satırı"), ki numara
  kaydığında atıf yine bulunabilsin.
  **Wissensbank'a dokunmayan taşımalar:** `wissensbank/` altındaki hiçbir belge
  taşınmadı, hiçbir türev zinciri kırılmadı — temizlik kök dizini hedefledi.

### W-A12 · Microsoft C5 raporu (W-06): Drive'a taşıma + tazelik takibi — `offen`
Üç ayrı iş, üç ayrı sahip:
1. **Taşıma** (sahibi: **Kemal**) — PDF masaüstünden `I:\My Drive\Ops Praxura gitnogo\`'e.
   Taşınınca W-06 „Dosya“ alanındaki geçici masaüstü yolu silinir, tam Drive yolu yazılır.
   Taşınana kadar tek kopya. ⛔ Depoya kopyalanmaz — `Desktop\claude\website\` altına
   düşürülürse `*.pdf` ignore'u korur ama bilerek girmesi de yasak (W-06 Yeniden dağıtım).
2. **Tazelik** (tarih: **~Temmuz 2027**, §1 takvimi) — sonraki dönem raporu STP'de aranır.
   Otomatik takip mümkün değil (portal oturumlu). Ops kartı yok — **açılması önerilir**
   (kategori Teknik, tarih 01.07.2027, „C5 raporu yeni dönem — W-06/Z-15 zincirini yürü“).
3. **Boşluk sorusu** (sahibi: `legal-de` + Microsoft ticket, KARARLAR 2026-09-28 açık madde 1)
   — Azure OpenAI'nin 01.01.2026 sonrası C5 kapsamı ve Sweden Central eşlemesi. Sicilin işi
   yalnız cevap geldiğinde kaynağını W-06'ya eklemek; cevabın hukuki değeri `legal-de`'nin.
   Microsoft'tan gelen teyit (ör. bridge letter) **ayrı bir belgedir** → ayrı kart açılır.

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
