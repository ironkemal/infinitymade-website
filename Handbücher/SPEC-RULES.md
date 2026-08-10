# SPEC-RULES — Süzülmüş §302 / Heilmittel kuralları

> Kaynak belgelerden çıkarılmış, koda uygulanan/uygulanması gereken kurallar.
> **Amaç:** yüzlerce sayfalık spesifikasyonu her seferinde yeniden okumamak.
>
> Bu dosya kaynağın yerini **tutmaz**, ona **işaret eder.** Her kural üç şeyi taşımak zorunda:
> **kaynak + sürüm + kod satırı.** Bu üçlü olmadan kural yazılmaz — belge güncellendiğinde
> neyin yeniden kontrol edileceği belli olmaz.
>
> Sahibi: `gkv-302` ajanı · Arşiv haritası: `Handbücher/INDEX.md`
> Son güncelleme: 2026-08-04

---

## Kayıt formatı

```markdown
### <kısa kural başlığı>
- **Kural:** <tek cümle, net>
- **Kaynak:** <belge + bölüm/§ + sürüm>
- **Geçerlilik:** <tarih>
- **Kodda:** <dosya:satır — uygulanmışsa; "uygulanmamış" — değilse>
- **Kapsam:** <hangi Leistungserbringergruppe / Verordnungsart>
```

---

# Verordnung / Heilmittel-Richtlinie

### Blankoverordnung geçerlilik süresi meslek grubuna göre değişir
- **Kural:** Blankoverordnung, Verordnungsdatum'dan itibaren Physiotherapie, Ergotherapie,
  Stimm-/Sprech-/Sprach-/Schlucktherapie ve Ernährungstherapie için **max 16 hafta**;
  **Podologische Therapie için max 40 hafta** geçerlidir.
- **Kaynak:** HeilM-RL § 13a Abs. 2 Satz 2 — *"Verordnungen nach Absatz 1 sind bei Maßnahmen der
  Physiotherapie, … maximal 16 Wochen, bei Maßnahmen der Podologischen Therapie maximal
  40 Wochen, ab Verordnungsdatum gültig."* — Abs. 1 = *"Verordnungen aufgrund von Indikationen
  nach § 125a SGB V"*, yani **Blankoverordnung**. Genel Verordnung geçerliliği § 15'tedir.
  (2026-08-05 doğrulandı — `verordnung rezept/HeilM-RL_2025-05-15_iK-2025-08-05.txt` s. 15–16)
- **Geçerlilik:** 05.08.2025 (Fassung 15.05.2025)
- **Kodda:** `api-backend/ai/validators/blankoRules.js:15` → `const GUELTIG_WOCHEN = 16;`
- **Kapsam:** Blankoverordnung

### ⚠️ Blankoverordnung SADECE Ergotherapie ve Physiotherapie için yürürlükte
- **Kural:** §125a SGB V Blankoverordnung fiilen yalnızca **Ergotherapie (ab 01.04.2024)** ve
  **Physiotherapie (ab 01.11.2024)** için mümkündür. **Podologie için sözleşme YOKTUR** —
  HeilM-RL'deki 40 hafta ileriye dönük bir hükümdür, bugün faturalanabilir değildir.
- **Kaynak:** KBV Praxiswissen Heilmittel, Ausgabe 2026 — *"Möglich ist dies derzeit für
  Ergotherapie und Physiotherapie."* (s. 1144) · KBV Diagnoseliste Stand 01.01.2026, Bölüm 2
  başlıkları: `ERGOTHERAPIE AB 1. APRIL 2024`, `PHYSIOTHERAPIE AB 1. NOVEMBER 2024` — Podologie
  başlığı yok
- **Geçerlilik:** 01.01.2026 (Diagnoseliste Stand)
- **Kodda:** `blankoRules.js` **yalnızca Physio-Schulter** uyguluyor (Diagnosegruppe zorunlu
  `EX`, ICD zorunlu 114'lük omuz listesinde, çıktı `blanko_physio_shoulder`)
- **Kapsam:** tüm Blankoverordnung
- 🔴 **AÇIK BULGU — gelir kaybı:** **Ergotherapie Blanko sözleşmesi VAR ama kod desteklemiyor.**
  Ergo Blanko rezepti bugün `NOT_ON_BLANKO_LIST` ile reddediliyor → faturalanabilir bir vaka
  bloke ediliyor. Podologie'den farklı olarak burada sözleşme mevcut. Ayrı iş kalemi.
- ✅ **Podologie kapatıldı:** Konsey kararı 2026-08-05 — Fachbereich tablosu yapılmayacak,
  `validate.js` guard'ı ile tek anlaşılır mesajla reddedilecek.
  → `konsey/tutanak/2026-08-05-blanko-fachbereich.md`

### Blankoverordnung: tedaviye başlama süresi
- **Kural:** Tedaviye Ausstellungsdatum'dan itibaren **28 gün** içinde başlanmalıdır.
- **Kaynak:** NOVENTI Praxisleitfaden Blankoverordnung Physiotherapie, s. "Was ist die
  Blankoverordnung?" — *"Behandlungsbeginn innerhalb von 28 Tagen"*
- **Geçerlilik:** 01.11.2024 (Stand März 2026)
- **Kodda:** doğrulanmadı
- **Kapsam:** Physiotherapie Blankoverordnung
- ⚠️ **Kaynak niteliği: ticari yayın.** Bağlayıcı metin HeilM-RL § 15'tir — kural koda
  girmeden önce § 15'ten teyit edilmeli.

### Podologie: Einzelmaßnahme immer 78010, nie 78020
- **Kural:** Hornhautabtragung veya Nagelbearbeitung **tek başına** verordnet edilmişse her zaman
  **78010 + 78030** ile faturalanır — Therapiezeit 20 dakikayı aşsa bile. **78020**
  („Podologische Behandlung (groß)") **yalnızca** verordnete Podologische Komplexbehandlung
  **ve** >20 dk Therapiezeit birlikte varsa abrechenbar.
- **Kaynak:** FAK Podologie Q25 (Stand 24.05.2023, `Podoloji/20230524_Podologie_FAK_bf.txt`
  Z.199-207) — *"Die Nagelbearbeitung oder Hornhautabtragung sind immer mit 78010 zzgl. 78030
  abzurechnen."*; Anlage 1a Leistungsbeschreibung i.d.F. 17.06.2024 Teil 1 Z.167-171 + Teil 2
  Ziff. 1/2/3
- **Geçerlilik:** 17.06.2024 (HPNR-Verzeichnis gültig ab 01.01.2026'da değişmedi)
- **Kodda:** `Podoloji/podologie-hpnr-reference.js` → `VALIDIERUNGS_REGELN`
  `78020_nur_komplexbehandlung` (2026-08-10 eklendi). Canlı katalog
  `api-backend/billing/codes/podologie_positions.js:22-23,64-65` etiket/fiyat olarak doğru,
  ama Maßnahme bazlı kısıt **uygulanmamış**.
- **Kapsam:** Podologie, Diagnosegruppen DF/NF/QF, Standard-Verordnung (Muster 13)

### Podologie: HPNR 78001–78006 abrechenbar değildir
- **Kural:** Maßnahmen-pozisyonları 78001 (Hornhautabtragung), **78002 (Nagelbearbeitung)**,
  78003 (Komplexbehandlung) ve 78004–78006 („an einem Fuß") GKV-SV
  Heilmittelpositionsnummernverzeichnis'te **vardır**, ancak §125-Podologie-Vertrag Anlage 2'de
  **fiyatları yoktur** → SLLA'ya konursa Absetzung/Nullretaxation. Ayırt edici işaret:
  Verzeichnis'te `Grundlage` ve `Eigentümer` sütunları **boş**.
- **Kaynak:** `Podoloji/Podologie_Positionsnummern_2026_Filtered.csv` Z.2-19 (gültig ab
  01.01.2026); `Podoloji/Leistungen/20250617_Podologie_Anlage_2.txt` i.d.F. 01.07.2025 —
  `7800x` için **0 eşleşme**
- **Geçerlilik:** 01.01.2026 (pozisyonların kendisi `gültig ab 1900-01-01`, yani yeni değil)
- **Kodda:** `Podoloji/podologie-hpnr-reference.js` → `HPNR_PODOLOGIE_NICHT_ABRECHENBAR`
  (2026-08-10 eklendi)
- **Kapsam:** Podologie, tüm Verordnungsart'lar

### Podologie: Heilmittel a/b/c Pflichtangabe'dir ve HPNR'yi belirler
- **Kural:** Muster 13'te **a) Hornhautabtragung · b) Nagelbearbeitung · c) Podologische
  Komplexbehandlung** verordnete Heilmittel'i gösterir (alan `g1`, Pflichtangabe). Bu bilgi
  78010 ↔ 78020 kararını belirlediği için **persistiert edilmelidir.** Ergänzendes Heilmittel
  (`g2`) Podologie'de tamamen **entfällt**.
- **Kaynak:** HeilM-RL Stand 15.05.2025 (iK 05.08.2025), Heilmittelkatalog Podologische
  Therapie — DF Z.3369-3381 / NF Z.3421-3434 / QF Z.3471-3483; Anlage 3 i.d.F. 16.06.2025
  `g1` (Z.443-454), `g2` (Z.465-472)
- **Geçerlilik:** 05.08.2025
- **Kodda:** **uygulanmamış** — `verordnungen` tablosunda verordnetes Heilmittel için alan yok.
  Önerilen: `heilmittel_massnahme` ∈ {Hornhautabtragung, Nagelbearbeitung, Podologische
  Komplexbehandlung}
- **Kapsam:** Podologie, Diagnosegruppen DF/NF/QF

---

# §302 Abrechnung / Korrekturverfahren

### Verarbeitungskennzeichen (VKZ) değerleri
- **Kural:** `01` = Erstrechnung · `02` = Nachforderung · `03` = Zuzahlungsnachforderung ·
  `04` = Korrekturrechnung · `10` = Wiederaufnahme einer bereits beendeten Blankoverordnung
- **Kaynak:** Gemeinsame Umsetzungsempfehlungen zum Korrekturverfahren Heilmittel (13.02.2025)
- **Geçerlilik:** 01.10.2025
- **Kodda:** doğrulanmadı — `api-backend/billing/dta/` ve `billing/codes/` kontrol edilmeli
- **Kapsam:** tüm Heilmittel Abrechnung

---

# Sürüm yönetimi

### V21 esas alınır, V22 01.02.2027'ye kadar uygulanmaz
- **Kural:** DTA üretimi ve doğrulama **Anlage 1 TP5 V21** ve **Anlage 3 TP5 V21**'e göre yapılır.
  Anlage 3 V22 ve Anhang 03 V10 **01.02.2027** tarihinden itibaren uygulanır; erken geçiş dosyanın
  reddedilmesine yol açar.
- **Kaynak:** İlgili belgelerin kapak sayfaları — `Version:` / `Anzuwenden ab:` satırları
- **Geçerlilik:** Anlage 1 V21 ab 01.10.2025 (V20 31.12.2025'te düştü) · Anlage 3 V21 ab 01.10.2025
- **Kodda:** —
- **Kapsam:** tüm DTA üretimi

---

# ICD-10-GM veri yapısı

### kodes.txt alan yapısı
- **Kural:** `icd10gm2026syst_kodes.txt` 28 alanlı, `;` ayraçlı. Kritik alanlar:
  Feld 6 = Schlüsselnummer (kreuz'suz), Feld 9 = Klassentitel, Feld 13 = §295 kullanımı,
  Feld 14 = §301 kullanımı, Feld 20 = Geschlechtsbezug, Feld 22/23 = alt/üst yaş sınırı,
  Feld 24 = yaş hatası tipi (M = Muss-Fehler, K = Kann-Fehler).
- **Kaynak:** `verordnung rezept/Zip ICD/icd10gm2026syst_metadaten_liesmich.txt`,
  bölüm DATENSATZBESCHREIBUNG (tam 28 alanlık liste `Handbücher/INDEX.md` içinde kayıtlı)
- **Geçerlilik:** ICD-10-GM Version 2026, Stand 12.09.2025
- **Kodda:** doğrulanmadı — `katalog-suche.js` ve `sync_heilmittel_katalog.js` kontrol edilmeli
- **Kapsam:** ICD arama ve doğrulama
- ⚠️ Dosya **4.2 MB** — asla tamamı okunmaz, `grep` ile tek kod çekilir.

### Diagnosegruppe kod formatı
- **Kural:** Diagnosegruppe kodları 2–3 karakterli kısaltmalardır (ör. `ZN`, `EN1`, `EX`).
  Diagnoseliste iki bölümden oluşur: (1) LHB/BVB tabloları, (2) Blankoverordnung tabloları —
  sütun yapıları **farklıdır**.
- **Kaynak:** `verordnung rezept/heilmittel-diagnoseliste.txt` (KBV, Stand 01.01.2026)
- **Geçerlilik:** 01.01.2026
- **Kodda:** `api-backend/ai/validators/diagnosegruppen.json`
- **Kapsam:** LHB / BVB / Blankoverordnung tanı eşlemesi

---

## Doğrulama kuyruğu

`gkv-302` ajanının ilk turlarında kapatılacak açık noktalar:

- [x] ~~Podologie Blankoverordnung 40 hafta — §125a sözleşmesi yürürlükte mi?~~ **KAPANDI 2026-08-05:**
      sözleşme yok, 40 hafta ileriye dönük hüküm. Konsey kararı → guard eklenecek, tablo yapılmayacak.
- [ ] 🔴 **Ergotherapie Blanko desteklenmiyor** — sözleşme 01.04.2024'ten beri var, kod reddediyor.
      `heilmittel-diagnoseliste.txt` Bölüm 2 Ergo listesi + Diagnosegruppe'ler okunmalı. **Gelir kaybı.**
- [ ] 28 gün başlama süresi — HeilM-RL § 15'ten teyit (şu an kaynak NOVENTI = ticari yayın)
- [ ] `blankoRules.js:124-132` — `ok !== true` iken bonuslar yine hesaplanıyor (`total_bonuses_eur`
      dolu dönüyor). Sessiz yanlış fatura riski.
- [ ] VKZ değerlerinin `billing/dta/` ve `billing/codes/` içinde doğru uygulanması
- [ ] `sync_heilmittel_katalog.js` ICD alan indekslerinin 28 alanlık yapıya uyumu
- [ ] Zuzahlung hesabının Anlage 1 V21 bölüm 7 ile uyumu
- [ ] Kostenträgerdatei/IK eşleme kuralları (Anhang 03 — dikkat: geçerli sürüm V10 değil, 01.02.2027'ye kadar önceki sürüm)
