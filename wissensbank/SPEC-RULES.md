# SPEC-RULES — Süzülmüş §302 / Heilmittel kuralları

> Kaynak belgelerden çıkarılmış, koda uygulanan/uygulanması gereken kurallar.
> **Amaç:** yüzlerce sayfalık spesifikasyonu her seferinde yeniden okumamak.
>
> Bu dosya kaynağın yerini **tutmaz**, ona **işaret eder.** Her kural üç şeyi taşımak zorunda:
> **kaynak + sürüm + kod satırı.** Bu üçlü olmadan kural yazılmaz — belge güncellendiğinde
> neyin yeniden kontrol edileceği belli olmaz.
>
> Sahibi: `gkv-302` ajanı · Arşiv haritası: `wissensbank/INDEX.md`
> Son güncelleme: 2026-09-21 (Ops #302 — „Komplexbehandlung" 78020'nin adı değil, verordnete
> Heilmittel c)'nin adıdır; 78010 ve 78020 ikisi de c)'den faturalanır. 1 yeni kural, tüm
> Fundstellen orijinallere karşı okundu; açık madde: >20 dk şartı c) için uygulanmıyor.)
> Önceki (aynı gün): 2026-09-21 (DAVASO/IQVIA HSS derinlemesine araştırması — TA-Validator
> ücretsiz format-doğrulama aracı (Zulassung/Testverfahren yerine geçmez), Zulassung'u
> Krankenkasse verir Datenannahmestelle değil, test dosyasındaki IK DAS ile kararlaştırılır,
> BARMER'in Heilmittel-DAS'ı ayrı bir şirket (DDG GmbH). 4 yeni kural.)
> Önceki: 2026-09-18 (Ops #202 — Muster 13 Heilmittel-Limit: max 3 vorrangiges + 1
> ergänzendes für Physio/Ergo/Logo, Podologie ohne Aufteilung/Ergänzung. 1 yeni kural.)
> Önceki: 2026-09-18 (Ops #211 — `gkv-302`'nin Podologie Höchstmenge araştırması:
> je Verordnung DF/NF/QF 6 · UI1 8 · UI2 4; orientierende Menge yalnız UI'da ve 8. 1 yeni
> kural, `wissensbank` tarafından HeilM-RL s. 73-77 + § 7 Abs. 2/5 ve Podologie Anlage 3
> Ziffer 3 f)'ye karşı doğrulandı. Kod bunu zaten uyguluyor — zincir `REGISTER.md` Z-11.)
> Önceki: 2026-09-17 (Ops #290 — DTA alan araştırması: Muster 13 → ZHE 7/8/9, Arbeitsunfall
> kapsam dışı, LHB/SKZ § 8 Abs. 3; 3 yeni kural, kod uygulaması Podoloji sonrasına ertelendi)
> · 2026-09-16 (eGK kart okuyucu araştırması — Versichertenstatus kaynağı + SMC-B'siz eGK
> okuma, 2 yeni kural)

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
  (2026-08-05 doğrulandı — `wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt` s. 15–16)
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

### Muster 13 en fazla 3 vorrangiges + 1 ergänzendes Heilmittel taşır — Podologie'de bölme hakkı yok
- **Kural:** Physio/Ergo'da Verordnungseinheiten je Verordnung max **3** farklı vorrangiges
  Heilmittel'e bölünebilir; Logopädie'de max 3 farklı Behandlungszeit/Einzel-Gruppe
  kombinasyonu. Buna ek olarak max **1** ergänzendes Heilmittel verordnet edilebilir → Muster 13
  formunda toplam 4 satır. **Podologie'de bölme hakkı YOKTUR** (§ 12 Abs. 2 Podologie'yi
  saymıyor) ve ergänzendes Heilmittel alanı (Anlage 3 g2) *"entfällt"* — Podologie = 1
  vorrangig, 0 ergänzend.
- **Kaynak:** HeilM-RL 15.05.2025 (iK 05.08.2025) § 12 Abs. 2 Satz 1 — *"…können die
  Verordnungseinheiten je Verordnung auf maximal drei unterschiedliche vorrangige Heilmittel
  aufgeteilt werden…"* und Abs. 3 Satz 1 — *"…kann zu ‚vorrangigen Heilmitteln' maximal ein
  … ‚ergänzendes Heilmittel' verordnet werden."*
  (`wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt:555-568`);
  Podologie Anlage 3 i.d.F. 16.06.2025 Feld g2
  (`wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung.txt:465-473`); Formteyidi
  KVN Ausfüllhilfe Muster 13, Stand 10/2024, Nr. 5. Ergänzendes'in Höchstmenge'si vorrangig'lerin
  toplamına bağlıdır: HeilM-RL § 7 Abs. 5 Satz 2-3 (`:419-426`).
- **Geçerlilik:** 05.08.2025
- **Kodda:** uygulanmamış — `dashboard.html:3621/3625` tek `rzHm` + tek `rzHmErg` alanı;
  `prescriptions.heilmittel_items` (`db/SCHEMA.sql:2256`) liste taşıyabilir ama sayı kapısı yok.
  Ops #202 (Kategorie Physiotherapie — önceki "Podoloji" etiketi yanlıştı, bu kural onu düzeltti).
- **Kapsam:** Physiotherapie, Ergotherapie, Logopädie — Muster 13. Podologie ve Blankoverordnung
  hariç (Blanko'da alana "BLANKOVERORDNUNG" basılır, Heilmittel/Einheit girilmez).
- ⚠️ DTA tarafında üst sınır yok (Anlage 1 TP5 V21 § 5.5.3.3: `EHE` 1-n) — sınır aşılırsa hata
  Prüfstufe 1-3'te yakalanmaz, ancak kasanın Fachprüfung'unda (Prüfstufe 4) Absetzung olarak
  geri gelir. UI kapısı bu yüzden tek koruma.

### Podologie: Einzelmaßnahme immer 78010, nie 78020
- **Kural:** Hornhautabtragung veya Nagelbearbeitung **tek başına** verordnet edilmişse her zaman
  **78010 + 78030** ile faturalanır — Therapiezeit 20 dakikayı aşsa bile. **78020**
  („Podologische Behandlung (groß)") **yalnızca** verordnete Podologische Komplexbehandlung
  **ve** >20 dk Therapiezeit birlikte varsa abrechenbar.
- **Kaynak:** FAK Podologie Q25 (Stand 24.05.2023, `wissensbank/podologie/20230524_Podologie_FAK_bf.txt`
  Z.199-207) — *"Die Nagelbearbeitung oder Hornhautabtragung sind immer mit 78010 zzgl. 78030
  abzurechnen."*; Anlage 1a Leistungsbeschreibung i.d.F. 17.06.2024 Teil 1 Z.167-171 + Teil 2
  Ziff. 1/2/3
- **Geçerlilik:** 17.06.2024 (HPNR-Verzeichnis gültig ab 01.01.2026'da değişmedi)
- **Kodda:** `Podoloji/podologie-hpnr-reference.js` → `VALIDIERUNGS_REGELN`
  `78020_nur_komplexbehandlung` (2026-08-10 eklendi). Canlı katalog
  `api-backend/billing/codes/podologie_positions.js:22-23,64-65` etiket/fiyat olarak doğru,
  ama Maßnahme bazlı kısıt **uygulanmamış**.
- **Kapsam:** Podologie, Diagnosegruppen DF/NF/QF, Standard-Verordnung (Muster 13)

### Podologie: Maßnahme (Verordnung) ≠ Leistung (Abrechnung) — „Komplexbehandlung" 78020'nin adı değildir
- **Kural:** „Podologische Komplexbehandlung" Heilmittelkatalog'daki **verordnete Heilmittel c)**'nin
  adıdır (Maßnahme düzlemi, Muster 13'te doktorun yazdığı). Abrechnung düzleminde adlar
  „Podologische Behandlung (klein)" = **78010** ve „Podologische Behandlung (groß)" = **78020**'dir.
  c) verordnet edilmişse Therapiezeit ≤ 20 dk → 78010, > 20 dk → 78020; a)/b) her zaman 78010.
  Bu yüzden 78020'ye „Komplexbehandlung" etiketi **yazılmaz**, ve „Komplex" araması 78020'yi
  **tek başına** bulmaz — 78010 ve 78020 birlikte bulunur. Ek çarpışma: „Podologische
  Komplexbehandlung" aynı zamanda abrechenbar olmayan **78003**'ün resmî adıdır (bkz. sonraki kural).
- **Kaynak:** HeilM-RL 15.05.2025 (iK 05.08.2025) § 27a Abs. 4 Nr. 3 (`wissensbank/gemeinsam/
  heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt` Z.1130-1142) + Heilmittelkatalog
  DF/NF/QF c) (Z.3381 / 3434 / 3483); Anlage 1a i.d.F. 17.06.2024 Teil 1 Nr. 4 (Z.167-171) +
  Teil 2 Ziff. 3 (Z.358-366) (`wissensbank/podologie/20240725_Anlage_1a_…lesefassung_b.txt`);
  Anlage 2 i.d.F. 01.07.2025 § 2 Z.82 + § 3 Z.332 (`…/20250617_Podologie_Anlage_2.txt`);
  HPNR-Verzeichnis gültig ab 01.01.2026 Z.21/24 (`…/Podologie_Positionsnummern_2026_Filtered.csv`);
  FAK Podologie Q25 Z.199-207 (`…/20230524_Podologie_FAK_bf.txt`). Alle Zeilen am 21.09.2026
  gegen die Originale gelesen.
- **Geçerlilik:** 05.08.2025 (HeilM-RL) · 01.07.2025 / 01.07.2026 (Anlage 2 Preisfenster).
  ⚠️ Anlage 1a Z.136 verweist noch auf „§ 28 HeilM-RL" (alt); der Inhalt steht in der
  aktuellen HeilM-RL in § 27a Abs. 4 — Kodun `§ 27a Abs. 4 Nr. 3` atfı **doğru**, Anlage 1a'ya
  bakıp „düzeltilmemeli".
- **Kodda:** `api-backend/billing/codes/podologie_positions.js:33-34,75-76` — `label` amtlich
  wortgleich, `kat: 'Podologische Komplexbehandlung'` yalnız arama çapası →
  `api-backend/sync_heilmittel_katalog.js:94` (`kategorie: p.kat`) → `heilmittel_katalog.kategorie`
  (Migration `0038_seed_heilmittel_katalog_podo_komplex_suche.sql`); Verordnung tarafı
  `module/verordnung-regeln.js:73-76` `POD_KATALOG.c`. Çapa == `POD_KATALOG.c`,
  `module/heilmittel-suche-komplex.test.js` ile zorlanıyor.
- ⛔ **Açık (gkv-302 bulgusu, 21.09.2026 repo-genelinde grep ile teyit edildi):** >20 dk şartı
  yalnız a)/b) için uygulanıyor (`module/podologie-abrechnung.js:907-913`). c) + Therapiezeit
  ≤ 20 dk için kontrol **yok**: Therapiezeit hiçbir yerde değer olarak alınmıyor — DB'de sütun
  yok, formda alan yok; yalnız Hinweis metinleri (`dashboard.js:237`, `verordnung-podo.js:339`)
  ve Regelleistungszeit özelliği (`dashboard.js:9403-9406`). Etki: ~15,39 € (2025) / ~15,82 €
  (2026) seans başına sessiz fazla faturalama, Prüfstufe 4'te geri alınır. Ayrı Ops kartı gerekir.
- **Kapsam:** Podologie, Diagnosegruppen DF/NF/QF, Standard-Verordnung (Muster 13)

### Podologie: HPNR 78001–78006 abrechenbar değildir
- **Kural:** Maßnahmen-pozisyonları 78001 (Hornhautabtragung), **78002 (Nagelbearbeitung)**,
  78003 (Komplexbehandlung) ve 78004–78006 („an einem Fuß") GKV-SV
  Heilmittelpositionsnummernverzeichnis'te **vardır**, ancak §125-Podologie-Vertrag Anlage 2'de
  **fiyatları yoktur** → SLLA'ya konursa Absetzung/Nullretaxation. Ayırt edici işaret:
  Verzeichnis'te `Grundlage` ve `Eigentümer` sütunları **boş**.
- **Kaynak:** `wissensbank/podologie/Podologie_Positionsnummern_2026_Filtered.csv` Z.2-19 (gültig ab
  01.01.2026); `wissensbank/podologie/20250617_Podologie_Anlage_2.txt` i.d.F. 01.07.2025 —
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
- **Kodda:** `module/verordnung-podo.js` `leitsymptomatikAnwenden()` — Leitsymptomatik-Kreuz
  a/b/c yazıyor `prescriptions.heilmittel` alanına metni (`verordnung-maske.js:525`).
  18.09.2026'dan beri `prescriptions.heilmittel_position`'ı da dolduruyor (bkz. aşağıdaki
  iki yeni kural).
- **Kapsam:** Podologie, Diagnosegruppen DF/NF/QF

### Podologie: HPNR auf der Verordnung — a/b determiniert, c erst am Behandlungstag
- **Kural:** Muster 13 Feld g1 kendisi Positionsnummer bilmez (Pflicht olan Katalog-metnidir).
  Buna rağmen `prescriptions.heilmittel_position` a) Hornhautabtragung ve b) Nagelbearbeitung'ta
  **78010** ile önceden doldurulabilir — ikisi FAK Q25'e göre HER ZAMAN 78010'dur, 78020 orada
  hiçbir zaman abrechenbar değildir. c) Podologische Komplexbehandlung'ta alan BOŞ kalır:
  78010 mü 78020 mi olacağı Therapiezeit'e (>20 Min) bağlıdır ve Behandlungstag'da belli olur.
- **Kaynak:** Podologie Anlage 3 i.d.F. 16.06.2025 § g1 (Z.443-454) · FAK Podologie Q25
  (Stand 24.05.2023, Z.199-207) · Anlage 3 TP5 V21 § 8.2.1 (5 haneli)
- **Geçerlilik:** 16.06.2025 (Anlage 3) / 24.05.2023 (FAK)
- **Kodda:** `module/verordnung-podo.js:220-232` (`leitsymptomatikAnwenden()`, 18.09.2026'da
  gkv-302 onayıyla eklendi — önceden hepsi boş bırakılıyordu)
- **Kapsam:** Podologie, Diagnosegruppen DF/NF/QF, standart Verordnung (Muster 13)

### Podologie: `prescriptions.heilmittel_position` DTA'yı BESLEMEZ
- **Kural:** Podolojik dalda §302 dosyası EHE pozisyonlarını `podologie_behandlungen.hpnr_codes`
  tablosundan kurar, `prescriptions.heilmittel_position`'dan DEĞİL. "heilmittel_position eksik"
  422 kilidi yalnız Physio/Ergo/Logo dalı içindir. Bu alanın podolojideki tek — ve hatalı —
  okuyucusu Zuzahlung düzeltmesidir: alan boşken sessizce 0 € hesaplar (mevcut hata, bu
  değişiklikten bağımsız — a/b artık 78010 dolu geldiği için onlarda düzeliyor, c'de hâlâ 0 €).
- **Kaynak:** Kod gerçeği (spec değil) — Anlage 1 TP5 V21 § 5.5.3.3 EHE-Segment
- **Geçerlilik:** 18.09.2026
- **Kodda:** `api-backend/billing/api/abrechnung.routes.js:2411-2434`
  (`mapVerordnungToDtaShape`) · `api-backend/billing/utils/abrechnung-zeilen.js:138-140` ·
  `api-backend/billing/api/zuzahlung.routes.js:106-113` (hatalı okuyucu — düzeltme Ops-Dashboard
  → Teknik, bu değişikliğin kapsamı dışında)
- **Kapsam:** Podologie, tüm Verordnungsart'lar

### Podologie Höchstmenge je Verordnung — UI2 dörttür, sekiz değil
- **Kural:** Höchstmenge je Verordnung: **DF 6 · NF 6 · QF 6 · UI1 8 · UI2 4.**
  Orientierende Behandlungsmenge yalnız UI1/UI2'de vardır (ikisi de **8**) ve birden çok
  Verordnung'a yayılır; DF/NF/QF'de § 7 Abs. 2 Satz 4 gereği **hiç yoktur**. UI2'de 4'ün
  üstü ancak **Wiedervorstellung + yeni Verordnung** ile mümkündür. Höchstmenge'yi aşan
  reçete geçersiz değildir — yalnız fazlası abrechenbar değildir: erbringen edilen ve
  faturalanan miktar zulässig olanla sınırlıdır, arzt bilgilendirilir. Bu yüzden UI'da
  **sert blok değil uyarı** olmalı — 7 einheitli bir Verordnung kâğıt üzerinde vardır ve
  sisteme girilebilmelidir.
- **Kaynak:** HeilM-RL (değişiklik 15.05.2025, iK 05.08.2025), Zweiter Teil,
  Heilmittelkatalog II. Maßnahmen der Podologischen Therapie —
  `wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt`
  s. 73 DF (Z.3383-3393) · s. 74 NF (Z.3436-3446) · s. 75 QF (Z.3485-3495) ·
  s. 76 UI1 (Z.3523-3528) · s. 77 UI2 (Z.3560-3570) — *„Höchstmenge je VO: - bis zu 6 x/VO"*
  (DF/NF/QF, üçünde de ayrıca *„In dieser Diagnosegruppe sind keine orientierenden
  Behandlungsmengen gemäß § 7 Absatz 2 festgelegt."*) · *„- bis zu 8x/VO"* +
  *„Orientierende Behandlungsmenge: - bis zu 8 Einheiten"* (UI1) · *„- bis zu 4x/VO"* +
  *„Die Verordnung weiterer Einheiten bedarf einer Wiedervorstellung beim verordnenden
  Arzt."* + *„Orientierende Behandlungsmenge: - bis zu 8 Einheiten"* (UI2).
  Dayanak maddeler: **§ 7 Abs. 2 Satz 4** (Z.406-409) — *„Abweichend hiervon sind für die
  Podologische Therapie bei Fußschädigungen durch Diabetes mellitus … keine orientierenden
  Behandlungsmengen festgelegt."* · **§ 7 Abs. 5 Satz 1** (Z.419-420) — *„Im
  Heilmittelkatalog ist zudem die zulässige Höchstmenge an Behandlungseinheiten je
  Verordnung festgelegt."*
  Aşım hâlinin sonucu: Vertrag § 125 Abs. 1 SGB V Podologie, **Anlage 3 i.d.F. 16.06.2025,
  Ziffer 3 f) b)** (`wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung.txt:416-431`)
  — *„Sofern auf der ärztlichen Verordnung die Verordnungshöchstmengen überschritten werden,
  kann der zugelassene Leistungserbringer maximal so viele Therapieeinheiten erbringen und
  abrechnen, wie sie nach der HeilM-RL zulässig sind. Die Ärztin oder der Arzt ist darüber
  zu informieren."* + *„Eine Änderung der Verordnung ist nicht erforderlich."*
- **Geçerlilik:** 05.08.2025
- **Kodda:** ✅ uygulanmış, **kasten uyarı seviyesinde** (blok değil). Sayı bugün **üç
  dosyada** duruyor, üçü de tutarlı (18.09.2026'da satır satır sayıldı):
  1. `module/verordnung-regeln.js:91` (`POD_HOECHSTMENGE`) + `:97` (`POD_ORIENTIEREND`) —
     **niyet edilen tek adres**, `[Q1]` (HeilM-RL) / `[Q2]` (Anlage 3) kaynak etiketleriyle;
     `REGELSTAND` listesi (`:250-257`) yeni bir Richtlinie geldiğinde gözden geçirilecek
     satırları sayıyor. Runtime önceliği `regelnFuerBereich()` (`:189-204`): **DB kazanır**,
     bu değerler yalnız `diagnosegruppen.hoechstmenge` boşken devreye girer — podolojide
     dosyanın kendi 03.09.2026 notuna göre boş (canlı DB'ye karşı doğrulanmadı).
  2. `module/verordnung-podo.js:72` / `:75` + `:365-395` (`einheitenPruefen()` — `max`/`min`
     attribute + uyarı metni). ⚠️ **Kendi kopyası**: `verordnung-regeln.js`'in baş yorumu
     „`verordnung-podo.js` liest sie von hier — eine Zahl, ein Ort" diyor ama dosya onu
     **import etmiyor**, sabitleri yeniden tanımlıyor → `REGISTER.md` W-A10.
  3. `api-backend/ai/validators/diagnosegruppen.json:162-279` — backend kopyası; DF `:164` ·
     NF `:187` · QF `:215` · UI1 `:248` · UI2 `:265`, her birinde `hoechstmenge` +
     `orientierende_menge`.

  Uyarı yolu: `module/verordnung-pruefung.js:220-234` (`UEBER_HOECHSTMENGE`,
  `SCHWERE.warnung`). DB tarafı: `diagnosegruppen.hoechstmenge` kolonu **var**
  (`db/SCHEMA.sql:1240`) — physio'da dolu, podolojide boş; dolduğu gün 1. maddedeki
  değerler kendiliğinden devre dışı kalır. Zincirin tamamı: `REGISTER.md` → **Z-11**.
- **Kapsam:** Podologie, Diagnosegruppen DF/NF/QF/UI1/UI2, standart Verordnung.
  § 7 Abs. 6 HeilM-RL (besonderer Verordnungsbedarf / langfristiger Heilmittelbedarf) başka
  bir Höchstmenge tanımlayabilir — Anlage 3 Ziffer 3 f) bunu açıkça anıyor; podolojide bugün
  kullanılmıyor, koda da girmedi.
- ⚠️ **Karıştırma tuzağı — „Nagelspange sekiz gider" doğru değil.** 8 yalnız **UI1**'in
  Höchstmenge'sidir; UI2'de 8 **orientierende Menge**'dir ve birden çok Verordnung'a yayılır.
  UI2'ye pauschal 8 einheit yazmak Absetzung üretir. Kod yorumu
  `module/verordnung-podo.js:66-71` bu ayrımı zaten kayda geçirmiş — silme.
- 📌 **Bezugsgröße farkı:** Höchstmenge **Verordnung** başına, orientierende Menge
  **Verordnungsfall** başınadır (§ 7 Abs. 3: *„Der Verordnungsfall und die orientierende
  Behandlungsmenge beziehen sich auf die jeweilige Verordnerin oder den jeweiligen
  Verordner."*). İkisi aynı sayaçla ölçülmez. 78040 hiçbirine sayılmaz — Anlage 1a Teil 2
  Ziff. 4.1: *„keine Behandlungseinheit im Sinne der Heilmittel-Richtlinie"* (yukarıdaki
  78040 kaydı).

---

### Podologie: 78040 Eingangsbefundung — aynı gün kombinasyonu
- **Kural:** 78040 aynı Behandlungstag'da **78010/78020 ile birlikte abrechenbar'dır** — bu
  normal hâldir, istisna değil. Yasak olan tek kombinasyon **78040 + 78030**'dur.
- **Kaynak:** Anlage 1a Leistungsbeschreibung i.d.F. **17.06.2024** (Vertrag § 125 Abs. 1 SGB V
  Podologie i.d.F. 30.11.2020), Teil 1 Nr. 2 — *"Die podologische Eingangsbefundung erfolgt vor
  der ersten Abgabe einer podologischen Leistung und **kann am gleichen Tag wie die podologische
  Leistung durchgeführt werden**."* (`wissensbank/podologie/20240725_Anlage_1a_Leistungsbeschreibung_lesefassung_b.txt`
  Z.80-84); Teil 2 Ziffer 4.1 „Besonderheiten" — *"**zusätzlich zur podologischen Behandlung**
  einmalig eine podologische Eingangsbefundung … **Die podologische Befundung nach Teil 2
  Ziffer 4.2 ist für diese Behandlung nicht abrechnungsfähig.**"* (Z.458-462). Dışlanan pozisyon
  adıyla anılıyor: Teil 2 Ziff. 4.2 = **78030**. Karşı yönden teyit: ZFD FAK Podologie Stand
  Juli 2024, Bölüm 2 — *"die Befundposition 78030 ist zu jeder der Abrechnungspositionen …
  **- außer an dem Tag der Eingangsbefundung -** abzurechnen"*
- **Geçerlilik:** 01.11.2023'ten beri
- **Kodda:** `module/podologie-abrechnung.js:1184` (78040+78030 bloklu — **doğru, dokunma**);
  78040+78010/78020 serbest bırakılmış — **doğru, dokunma**
- **Kapsam:** Podologie, Diagnosegruppen DF/NF/QF
- ⚠️ Beta-1'in 31.08.2026'daki „Erstbehandlung mit Befundung und Behandlung zusammen" itirazı
  **78030**'u kastediyor, 78010/78020'yi değil. Kod bu ayrımı zaten doğru yapıyordu.

### Podologie: 78040 — hak koşulu Erstinanspruchnahme, Verordnung başına DEĞİL
- **Kural:** 78040 **„einmalig"**'dir ve dayanağı **Verordnung değil, hastanın podolojiyi ilk
  kez kullanması**dır: yalnızca **01.11.2023 tarihinde veya sonrasında** ilk kez podolojik
  leistung alan hastaya verilir. Her yeni Verordnung'da yeniden alınmaz — ne seri başına,
  ne takvim yılı başına. Ayrıca 78040 **Behandlungseinheit sayılmaz**: Höchstmenge/seans
  sayımına katılmaz, ve Muster 13 arkasına „Eing. Bef." olarak yazılıp hastaya imzalatılır
  (78030 ise Verordnung'a **yazılmaz**).
- **Kaynak:** Anlage 1a i.d.F. **17.06.2024**, Teil 1 Nr. 2 + Teil 2 Ziffer 4.1 — *"Bei Patienten
  die **ab dem 01.11.2023 erstmalig** eine podologische Leistung … in Anspruch nehmen … ist
  ohne gesonderte Verordnung … **einmalig** eine podologische Eingangsbefundung … durchzuführen"*
  (Z.80-82, 458-460); *"Die Eingangsbefundung ist: - **keine Behandlungseinheit im Sinne der
  Heilmittel-Richtlinie** - eine eigenständige Leistung und ist somit vom Versicherten zu
  bestätigen."* (Z.463-466). 78030'un Verordnung'a yazılmaması: GKV-SV FAK Podologie Stand
  **24.05.2023** Nr. 5 (`wissensbank/podologie/20230524_Podologie_FAK_bf.txt` Z.38-41)
- **Negatif kanıt:** „je Verordnung" / „je Behandlungsserie" / „Kalenderjahr" ifadeleri 78040
  bağlamında Anlage 1a, Anlage 2 (i.d.F. 01.07.2025), Anlage 3, Änderungsvereinbarung 16.06.2025,
  GKV-SV FAK 24.05.2023, ZFD FAK Juli 2024 ve HeilM-RL'de **hiç geçmiyor**. HeilM-RL § 27b'deki
  „Eingangsdiagnostik" **hekimin** işidir, 78040 değildir — karıştırma.
- **Geçerlilik:** 01.11.2023'ten beri
- **Kodda:** `module/podologie-abrechnung.js:1198-1246` — önceki 78040 kaydı **ve** önceki
  herhangi bir Behandlung kontrolü uygulanmış (2026-08-31). **01.11.2023 öncesi Altbestand
  kapısı hâlâ UYGULANMAMIŞ** — aşağıya bak.
  Terminmaske tarafı: `module/eingangsbefundung-regel.js` → `befundungFuerLeistung()`
  (2026-09-03) — hangi Leistung seçilirse hangi Befundung önerilir. Altbestand sorusunu
  kapatmaz ama `rueckfrage` alanıyla **görünür** kılar, sessizce „hayır" saymaz.
- **Kapsam:** Podologie, DF/NF/QF (UI1/UI2'de 78040 yoktur)
- 🔴 **Açık — para kaybettiren boşluk:** 01.11.2023'ten **önce** podolojiye başlamış hasta
  78040 hakkı **kazanmaz**. Yeni kurulan bir praxis'te bu geçmiş veritabanında yoktur, yani
  kod bunu kendi başına bilemez → hastaya sorulup **kalıcı olarak** işaretlenmesi gerekir
  (uçucu diyalog yetmez, kasa karşısında belge odur). Şema gerektirdiği için ayrı iş.
- ⚠️ **Belgelenemedi — praxis mi, hasta mı:** Sözleşme metni *"bei einem zugelassenen
  Leistungserbringer"* diyor; bu hem „her praxis'te bir kez" hem „hayatta bir kez" okunabilir.
  Arşivde ve erişilebilir kaynaklarda karar veren metin **yok**; cevabı **20.10.2023 tarihli
  Änderungsvereinbarung / konsolide sözleşme § 3a** taşır (GKV-SV sunucusu otomatik indirmeye
  PDF vermiyor, elle indirilmeli). Kod bugün `owner_id` kapsamında kilitliyor — iki okumanın
  **temkinli** olanı, bu açıklığa kavuşana kadar böyle kalmalı. Yazılımla çözülemeyen artık
  risk: hasta 78040'ı **başka** bir praxis'te almışsa bunu göremeyiz; Absetzung riski
  abrechnung yapan Leistungserbringer'dedir (itiraz süresi 9 ay, § 45 SGB I hâlinde 4 yıl).

### Podologie: 78030 her Behandlung'un öncesinde, seri başına değil
- **Kural:** DF/NF/QF'te 78030 **her** Behandlungstag'da 78010/78020 yanında abrechenbar'dır —
  tek istisna 78040'ın işaretlendiği gündür. Seri başına bir kez **değildir**. UI1/UI2'de
  78030 hiç abrechenbar değildir.
- **Kaynak:** Anlage 1a i.d.F. **17.06.2024**, Teil 2 Ziffer 4.2 „Besonderheiten" — *"Bei
  Maßnahmen der Podologie in den Diagnosegruppen DF, NF, und QF **im Vorfeld jeder Behandlung**
  (mit Ausnahme der Regelungen zur podologischen Eingangsbefundung in Teil 2 Nr. 4.1)."*
  (Z.490-493); GKV-SV FAK Stand **24.05.2023** Nr. 6 (Z.42-47) — UI1/UI2 yasağı orada
- **Geçerlilik:** yürürlükte
- **Kodda:** `dashboard.js:9753` (hinweis metni doğru); `module/podologie-abrechnung.js:1178`
  (UI1/UI2 bloğu) + otomatik işaretleme `module/podologie-abrechnung.js:396-420`
- **Kapsam:** Podologie, DF/NF/QF

### Podologie: 6 seanslık serinin hangi Termin'ine hangi befundung
- **Kural:** Yukarıdaki üç kuralın seri üzerindeki sonucu:

  | Durum | Termin 1 | Termin 2-6 |
  |---|---|---|
  | Hasta podolojiye **ilk kez** geliyor (ve ilk kez 01.11.2023+) | **78040** + 78010/78020 — **78030 YOK** | 78030 + 78010/78020 |
  | Hasta zaten hastaysa / 78040 alınmışsa | 78030 + 78010/78020 | 78030 + 78010/78020 |

  78040 **yalnız ilk serinin ilk Behandlungstag'ında** olur; „nasılsa hiç almadık" diye 3.
  Termin'e sonradan konması sözleşmeye aykırıdır (*"erfolgt **vor der ersten Abgabe** einer
  podologischen Leistung"*).
- **Kaynak:** Anlage 1a i.d.F. 17.06.2024 Teil 1 Nr. 2 (Z.80-84) + Teil 2 Ziff. 4.1/4.2
- **Geçerlilik:** 01.11.2023'ten beri
- **Kodda:** `module/podologie-abrechnung.js:396-420` (otomatik işaretleme) +
  `:1198-1246` (doğrulama)
- **Kapsam:** Podologie, DF/NF/QF

### Podologie: 78100/78110 Erstbefundung (Nagelspange) — 78040'tan FARKLI bezugsgröße
- **Kural:** Üç ayrı ölçü var, karıştırılmaz: **(1)** Erstbefundung (78110 klein / 78100 groß)
  **her Nagel-Behandlungsserie'nin başında bir kez** — bir seri **birden çok Verordnung**
  kapsayabilir, yani Verordnung başına sıfırlanmaz. **(2)** 78100 „groß" ayrıca **hasta başına
  takvim yılında 1×** ile sınırlıdır. **(3)** 78040 ise ne seriye ne yıla bağlıdır, ilk
  kullanıma bağlıdır. Ayrıca her Zehennagel **kendi Verordnungsfall'ıdır**; Erstbefundung
  tedavi çıkmazsa **tek başına** da abrechenbar'dır.
- **Kaynak:** Anlage 1c Leistungsbeschreibung i.d.F. **01.07.2025**, Teil 1 Nr. 5 I.1 — *"Die
  Erbringung der „Erstbefundung groß" ist auf eine **einmalige Abgabe je Patient im
  Kalenderjahr** beschränkt."* (`wissensbank/podologie/20250617_Podologie_Anlage_1c_Leistungsbeschreibung.txt`
  Z.236-239); Änderungsvereinbarung vom **16.06.2025** Nr. 5, yeni **§ 3b lit. a)** — *"Die
  Leistung nach Anlage 1c Teil 2 Ziffer I.1 (Erstbefundung) kann **einmalig zu Beginn einer
  Nagelspangenbehandlungsserie** erfolgen. Eine Behandlungsserie bezieht sich stets auf einen
  zu behandelnden Nagel und **kann mehrere Verordnungen umfassen**."*
  (`wissensbank/podologie/20250617_Podologie_Aenderungsvereinbarung.txt` Z.57-59); tek başına
  abrechenbar: ZFD FAK Juli 2024 Bölüm 2
- **Geçerlilik:** 01.07.2025; § 3b yalnız **01.10.2025'ten itibaren verordnet** edilmiş NSB'ler için
- **Kodda:** katalog `api-backend/billing/codes/podologie_positions.js:83-84` ve
  `dashboard.js:9759-9763`. Frekans denetiminin **iki yarısından biri uygulandı**
  (2026-09-03):
  - ✅ **takvim yılı sınırı** — `module/eingangsbefundung-regel.js` → `darf78100()`,
    kapı `module/podologie-abrechnung.js` → `podErstbefundungGrossLage()`; aynı yıl
    ikinci bir 78100 kaydedilemiyor, mesaj 78110'a yönlendiriyor.
  - ✅ **seri/nagel sınırı** — kapandı 04.09.2026. Nagel artık Verordnung'un
    alanı (`prescriptions.nagel`, on değerli CHECK, § 3b Satz 5 yazımı
    „U1 links" … „U5 rechts"), çünkü § 3b Satz 3-4 bir Zehennagel'i **kendi
    Verordnungsfall'ı** sayıyor. Kural
    `module/eingangsbefundung-regel.js` → `darfErstbefundungNagel()`, kapı
    `module/podologie-abrechnung.js` → `podErstbefundungSerieLage()`. Seri
    sınırı **78520** (Behandlungsabschluss): ondan sonra aynı nagel'de yeni
    seri başlar. Sperre 78100 **ve** 78110 için geçerli ve Verordnung
    sınırlarını aşıyor. Nagel bilinmiyorsa (OCR'den doğan Verordnung henüz
    tamamlanmamış) **sperre kurulmuyor** — `grund: 'nagel_unbekannt'`; tahmin
    eden bir sperre haklı kazanılmış leistungu keserdi.
    ⚠️ Açık kalan: aynı zorunluluk Abrechnung'a freigabe adımında yok.
  Ayrıca `befundungFuerLeistung()` (2026-09-03) Nagel zweiginde **hiçbir şey önermez**,
  sadece hinweis döner — Serie ve hangi Nagel olduğu Termin maskesinde bilinmiyor.
- **Kapsam:** Podologie, Diagnosegruppen UI1/UI2
- ⚠️ `dashboard.js:9761`'deki „auch bei Wiedervorstellung" ibaresi **hiçbir sözleşme metninde
  geçmiyor** — içerik olarak yanlış değil ama alıntılanabilir değil, 2026-08-31'de sözleşme
  lafzıyla değiştirildi.

### Versichertenstatus kaynağı Verordnung'dur, kart değil
- **Kural:** SLLA'ya yazılan 5 haneli Versichertenstatus Verordnung'daki basımdan alınır;
  7 haneli basımda 1-5. haneler kullanılır. KVNR için KV-Karte de meşru kaynaktır. Kart
  okuması hasta kaydını doldurabilir/doğrulayabilir ama Verordnung alanlarını **ezemez** —
  çelişkide kullanıcıya fark gösterilir, sessizce üzerine yazılmaz.
- **Kaynak:** Anlage 1 TP5 V21, § 5.5.3.1 (SLLA Basis-Segmente) —
  *"Krankenversichertennummer ist zwingend gemäß KV-Karte bzw. ärztlicher Verordnung
  anzugeben. … Anzugeben ist der Versichertenstatus von der Verordnung."*
  (`wissensbank/gemeinsam/302-tp5/Anlage_1_TP5_V21_20260115.txt:2059-2081`)
- **Geçerlilik:** 01.10.2025'ten beri
- **Kodda:** uygulanmamış — `api-backend/billing/api/abrechnung.routes.js:361` ve `:2551`
  alan boşsa sessizce `'1'` varsayıyor (kart okuma özelliği yazılınca bu da düzeltilmeli)
- **Kapsam:** tüm Leistungserbringergruppen, tüm Verordnungsart'lar

### eGK Versichertenstammdaten SMC-B'siz okunabilir
- **Kural:** eGK'nın EF.PD (kimlik: ad/soyad/doğum tarihi/adres/KVNR), EF.VD (sigorta:
  Kostenträger-IK/kasa adı/Versichertenart), EF.StatusVD konteynerleri **hiçbir kimlik
  doğrulaması olmadan** okunur — Konnektor/SMC-B/eHBA/TI gerekmez. Yalnız EF.GVD
  (Zuzahlungsstatus, besondere Personengruppe, DMP) C2C-Authentisierung (SMC-B veya
  eHBA) ister.
- **Kaynak:** gematik gemSpec_eGK_Fach_VSDM V1.2.1, VSDM-A_2971 / VSDM-A_2972
- **Geçerlilik:** güncel
- **Kodda:** uygulanmamış — kart okuma özelliği henüz yazılmadı (bkz. `onprem/Caddyfile`
  `Permissions-Policy: serial=(self)`, 2026-09-16'da Web Serial için önceden açıldı)
- **Kapsam:** tüm Leistungserbringergruppen — VSDM-Pflicht (§291 Abs.2b) yalnız
  Vertragsärzte'yi bağlar, bizi değil; bu kural onlardan bağımsız çalışır

# §302 Abrechnung / Korrekturverfahren

### Verarbeitungskennzeichen (VKZ) değerleri
- **Kural:** `01` = Erstrechnung · `02` = Nachforderung · `03` = Zuzahlungsnachforderung ·
  `04` = Korrekturrechnung · `10` = Wiederaufnahme einer bereits beendeten Blankoverordnung
- **Kaynak:** Gemeinsame Umsetzungsempfehlungen zum Korrekturverfahren Heilmittel (13.02.2025)
- **Geçerlilik:** 01.10.2025
- **Kodda:** doğrulanmadı — `api-backend/billing/dta/` ve `billing/codes/` kontrol edilmeli
- **Kapsam:** tüm Heilmittel Abrechnung

### LE'nin kendi keşfettiği aşırı faturalama Korrekturverfahren kapsamı dışıdır
- **Kural:** Leistungserbringer'in (LE) kendi fark ettiği bir aşırı faturalama/hatalı
  Abrechnung, resmi Korrekturverfahren'in kapsamına girmez — bu yalnız Kasa'nın
  geri bildirimine (Absetzung/ZAA) dayalı düzeltmeler için tanımlıdır. LE kendi hatasını
  Kasa'ya elle (yazılı veya telefonla) bildirmek zorundadır; sistem bunu otomatik bir
  VKZ 04 Korrekturrechnung akışına sokamaz.
- **Kaynak:** Gemeinsame Umsetzungsempfehlungen zum Korrekturverfahren Heilmittel
  (13.02.2025), Frage 5
- **Geçerlilik:** 01.10.2025
- **Kodda:** `module/podo-storno.js`'e 20.09.2026'da eklendi (Meldepflicht-Hinweis bei
  Storno einer bereits eingereichten Verordnung)
- **Kapsam:** tüm Heilmittel Storno/Korrektur

### Podolojik DTA'da kısmi (Teilabrechnung) normaldir; kalan birimler VKZ 02 Nachforderung ile
- **Kural:** Podolojik §302 dosyasının bir Verordnung'un TÜM birimlerini değil, o ana kadar
  dokümante edilmiş birimlerini içermesi (Teilabrechnung) normal ve beklenen bir durumdur —
  hata değildir. Kalan/sonradan erbracht edilen birimler ayrı bir dosyada
  **VKZ 02 (Nachforderung)** ile gönderilir.
- **Kaynak:** Gemeinsame Umsetzungsempfehlungen zum Korrekturverfahren Heilmittel
  (13.02.2025), Frage 1
- **Geçerlilik:** 01.10.2025
- **Kodda:** `api-backend/billing/api/abrechnung.routes.js:2945-2963` Teilabrechnung'ı zaten
  üretiyor (yalnız storno edilmemiş, o ana kadar dokümante edilmiş Behandlungen'i topluyor),
  ama VKZ 02 ikinci-tur (Nachforderung) yolu **HENÜZ YOK** — açık iş, Adım 1.6/sonrası.
- **Kapsam:** Podologie


### Abrechnungscode 71 = Podologen (72 = med. Fußpfleger)
- **Kural:** Podoloji Verordnung/DTA ekranlarında görünen sabit **„71"** Anlage 3'ün
  **Abrechnungscode**'udur: `71 = Podologen`, `72 = Med. Fußpfleger (gemäß § 10 Abs. 4 bis 6 PodG)`.
  LEGS'in ilk iki hanesidir (`7100501` / `7200501`) ve aynı değer §8.1.14
  Leistungserbringer-Sammelgruppenschlüssel'de **Leistungsbereich B (Heilmittel)** altında geçer.
  Diagnosegruppe **değildir**, Positionsnummer **değildir**.
- **Kaynak:** `wissensbank/gemeinsam/302-tp5/Anlage_3_TP5_V21_20250919.txt` §8.1.5.1 S.15 Z.559 (*„71 = Podologen"*)
  ve §8.1.14 S.30 Z.1137 (aynı değer, Sammelgruppe B)
- **Geçerlilik:** 01.10.2025 (Anlage 3 V21)
- **Kodda:** `api-backend/billing/codes/legs.js:88-92` (`podologe: '7100501'`) ·
  `api-backend/billing/codes/anlage3_v22.js:85` · `module/typen/gkv.js:42`
- **Kapsam:** Podologie (71) / med. Fußpfleger (72), tüm Verordnungsart'lar

### FKT: „IK des Kostenträgers" ile „IK der Krankenkasse von der KV-Karte" AYRI alanlardır
- **Kural:** SLGA-FKT ve SLLA-FKT iki ayrı IK taşır. „IK des Kostenträgers" alanına
  *Kostenträgerdatei'de KV-Kart IK'sının işaret ettiği* Kostenträger-IK yazılır; „IK der
  Krankenkasse von der KV-Karte bzw. der ärztlichen Verordnung" alanına kartın üstündeki IK
  yazılır. İkisi Ersatzkassen'de ve füzyon geçirmiş kasalarda **birbirinden farklıdır**.
- **Kaynak:** `wissensbank/gemeinsam/302-tp5/Anlage_1_TP5_V21_20260115.txt` §5.5.2 (SLGA-FKT, Z.1440-1446) ve
  §5.5.3.1 (SLLA-FKT, Z.1885-1898) — *„Einzutragen ist das IK des Kostenträgers auf den das IK
  der KV-Karte in der Kostenträgerdatei verweist"*
- **Geçerlilik:** 01.10.2025 (Anlage 1 V21)
- **Kodda:** ❌ **uygulanmamış.** `api-backend/billing/api/abrechnung.routes.js:353` ve `:2123`
  her iki alana aynı değeri (`rx.kostentraeger_ik`) veriyor; `billing/dta/builder.js:106,234`
  `krankenkasseIk || kostentraegerIk` ile bunu maskeliyor. Şemada da tek alan var
  (`prescriptions.kostentraeger_ik`, `db/SCHEMA.sql:1485`) — ikinci IK saklanacak yer yok.
- **Kapsam:** tüm Leistungserbringergruppen, tüm Verordnungsart'lar

### Kostenträgerdatei: birden çok KV-Kart-IK → tek Kostenträger (n:1)
- **Kural:** Bir Kostenträger'e birden çok „IK der Versichertenkarte" bağlanabilir; bağ
  VKG segmenti + Verknüpfungsart `01` üzerinden kurulur. **Ersatzkassen'de her Kostenträger için
  23 IK** tahsis edilir; füzyon geçirmiş diğer kasa türlerinde de aynı durum vardır. Yön tek
  taraflı benzersizdir: IK → Kostenträger tekil, Kostenträger → IK **çoğuldur**.
- **Kaynak:** `wissensbank/gemeinsam/302-tp5/Anhang_03_Anlage_1_TP5_V10_20260414.txt` §5.1 —
  *„Bilden mehrere IK der Versichertenkarte auf einen Kostenträger ab … für jeden Kostenträger
  23 IK's bereitgestellt … Verknüpfungsart 01"*
  ⚠️ Bu belge **V10 = ab 01.02.2027**; V10 Änderungshistorie'sine göre §5.1 V09'da
  değiştirilmedi (değişiklikler 5.2/7.2/8.2/8.3), yani kural bugün de geçerli — ama geçerli
  sürüm (V09) arşivde YOK, indirilip INDEX'e kaydedilmeli.
- **Geçerlilik:** yapı kuralı, sürümler arası değişmedi
- **Kodda:** ❌ **uygulanmamış.** `krankenkassen.ik_number` tek bir metin alanı
  (`db/SCHEMA.sql:1043`), `kostentraeger` ile FK bağı yok, VKG/Verknüpfungsart kavramı hiç yok.
- **Kapsam:** tüm Leistungserbringergruppen

### Dosya ve Gesamtaufstellung granülaritesi
- **Kural:** (1) *„Je Datenannahmestelle mit Entschlüsselungsbefugnis ist je Kassenart eine
  Nutzdatendatei zu erstellen."* (2) *„Die Gesamtaufstellung (Gesamtrechnung, Sammelrechnung)
  muss pro Kostenträger und je Leistungsbereich erstellt werden. Dies gilt für alle
  Rechnungsarten."* (3) Sammelrechnung opsiyoneldir ve yalnız farklı Krankenkassen-IK'ların
  gesamtrechnungları tek Kostenträger-IK altında toplanacaksa gerekir. (4) *„Das Mischen von
  Einzel- und Sammelrechnungen in einer Datei ist nicht zulässig."*
- **Kaynak:** `wissensbank/gemeinsam/302-tp5/Anlage_1_TP5_V21_20260115.txt` §5.3.1 (Z.566-573) ve §5.3.2 (Z.575-578)
- **Geçerlilik:** 01.10.2025 (Anlage 1 V21)
- **Kodda:** ⚠️ **kısmen.** `abrechnung.routes.js:515` ve `:2225` her Abrechnung'u **tek**
  Kostenträger-IK'ya kilitliyor → dosya birimi „1 Kostenträger = 1 dosya". Spesifikasyonun
  istediği birim **DAV × Kassenart**; yani aynı DAV'a giden birden çok Kostenträger tek dosyada
  olmalıydı. Einzel/Sammel karışım yasağı kodda hiç yok (Sammelrechnung yolu da yok).
- **Kapsam:** tüm DTA üretimi

### GES: Gesamtrechnungsbetrag = Gesamtbruttobetrag − Zuzahlung
- **Kural:** VKZ `01`, `02`, `04` için `GES.Gesamtrechnungsbetrag` = `GES.Gesamtbruttobetrag`
  eksi „Gesamtbetrag Zuzahlung und/oder Eigenanteil und/oder Pauschale Korrekturbetrag".
  VKZ `03` (Zuzahlungsnachforderung) için Rechnungsbetrag = Zuzahlung toplamı, Bruttobetrag
  `0,00` verilir. Brutto her zaman Zuzahlung **dahil** BES toplamıdır.
- **Kaynak:** `wissensbank/gemeinsam/302-tp5/Anlage_1_TP5_V21_20260115.txt` §5.5.2, GES segmenti (Z.1660-1690)
- **Geçerlilik:** 01.10.2025 (Anlage 1 V21)
- **Kodda:** `api-backend/billing/dta/segments.js:73-85` alanları taşıyor; hesaplama
  `abrechnung.routes.js:600-615` (brutto ve zuzahlung ayrı toplanıyor). VKZ 03 özel kuralı
  (Brutto = 0,00) **doğrulanmadı**.
- **Kapsam:** tüm Leistungserbringergruppen

### Heilmittel fiyatı Leistungsdatum'a göre çözülür, Ausstellungsdatum'a göre değil
- **Kural:** Bir pozisyonun fiyatı ve Zuzahlung'u, tedavinin **yapıldığı** tarihin
  içine düştüğü Preisfenster'den okunur; Verordnung'un yazıldığı tarihten değil.
- **Kaynak:** Anlage 2 Podologie (i.d.F. 01.07.2025) § 3 Abs. 2 — *„für Behandlungen, die
  ab dem 01.07.2026 stattfinden"* · Anlage 2 §125 Physio (Lesefassung ab 01.01.2026) Teil A —
  *„für Behandlungen, die ab dem 01.01.2026 durchgeführt werden"*
- **Geçerlilik:** 01.07.2026 (Podo) · 01.01.2026 (Physio)
- **Kodda:** ✅ **13.09.2026'da tamamlandı (O-97).** DTA yolu zaten doğruydu
  (`billing/api/abrechnung.routes.js:317`, podoloji karşılığı `:2461`) — basılı fatura,
  Zuzahlungsrechnung, rzg-Quittung, Begleitzettel ve Zuzahlung-Korrektur yolları
  (`abrechnung.routes.js` Zuzahlungsrechnung + `/prescription/:id/rechnung` route'ları,
  `zuzahlung.routes.js:betragFuerEinheiten()`) tek bir `rx.ausstellungsdatum` ile çözüp bu tek
  fiyatı tüm seanslara uyguluyordu; artık her biri kendi `done_at`'ine göre seans başına
  çözüyor (gkv-302'nin ikinci-göz denetiminde bulundu — bir Verordnung iki Preisfenster'e
  yayılırsa DTA ile diğer belgeler farklı tutar üretiyordu; Podolojide bugün canlı, Physio'da
  01.01.2027'de ikinci pencere açılınca aynı hata orada da açığa çıkardı).
- **Kapsam:** Physio + Podologie, standart ve Korrektur Verordnung

### „Absetzung" §302 teknik spesifikasyonunun kavramı DEĞİLDİR
- **Kural:** Anlage 1 TP5 V21 metninde `Absetzung`, `Buchung`, `Kontonummer`, `Zahlungsavis`
  kelimeleri **hiç geçmez** (0 eşleşme). Kasa geri bildirimi teknik tarafta Fehlerverfahren
  (Prüfstufe 1–4) olarak düzenlenir; parasal kesinti ise Absetzungsschreiben ile kâğıt/portal
  üzerinden gelir ve içeriği standart değildir. Korrekturverfahren belgesi Nr. 7 bunu açıkça
  söyler: kesilen Termin/Positionsnummer Absetzungsschreiben'de yoksa **VKZ 4 Korrekturrechnung
  üretilemez**, Leistungserbringer bilgiyi kasadan sormak zorundadır.
- **Kaynak:** `wissensbank/gemeinsam/302-tp5/Gemeinsame_Umsetzungsempfehlungen_zum_Korrekturverfahren_Heilmittel_20250213.txt`
  Frage 7 (Z.186-196) — *„Sofern die Termine bzw. die Positionen nicht aus dem
  Absetzungsschreiben hervorgehen, muss der Leistungserbringer … diese Informationen erfragen"*
- **Geçerlilik:** 01.10.2025
- **Kodda:** `api-backend/billing/zaa/parser.js` yalnız `code / belegnummer / text` çıkarır;
  `zaa_fehler` tablosunda (`db/SCHEMA.sql:1955-1967`) kasa tarafı **Vorgangs-/Absetzungsnummer**
  alanı yok. Muhasebe hesap numarası (SKR03/04) §302 kapsamı dışıdır.

---


### ZHE Leitsymptomatik dört haneli bitmaskedir, harf değildir
- **Kural:** SLLA-B `ZHE` segmentindeki **Leitsymptomatik** alanı `an4`'tür: dört hane,
  her hane `0` veya `1`, sıra **a-b-c-patientenindividuell**. Kimse kutu işaretlememişse
  `0000` gönderilir. Harf (`"a"`, `"ab"`) veya Diagnosegruppe önekli değer (`"DF-c"`)
  bu alana **yazılamaz**.
- **Kaynak:** Anlage 1 TP5 V21, Kap. 5.5.3.3, s. 71 — *"1. Stelle: Leitsymptomatik a …
  4. Stelle: patientenindividuelle Leitsy., je Stelle: '0' = nein, '1' = ja … Wenn kein
  Kreuz gesetzt ist, ist '0000' zu übermitteln."*
- **Geçerlilik:** 01.10.2025 (V21, Stand 15.01.2026)
- **Kodda:** `api-backend/billing/dta/leitsymptomatik.js` → `leitsymptomatikAlsBitmaske()`;
  çağrıldığı yer `api-backend/billing/api/abrechnung.routes.js` (Physio + Podoloji mapper'ları);
  son emniyet `api-backend/billing/dta/segments.js` içindeki `LEITSYMPTOMATIK_MUSTER` guard'ı.
  Frontend aynası: `module/verordnung-pruefung.js` → `leitsymptomatikListe()`.
- **Kapsam:** tüm Heilmittel Verordnung'ları
- 📌 **06.09.2026 ölçümü:** canlı `prescriptions` tablosunda `"DF-c"` × 3 ve `"c"` × 1 duruyordu.
  Kaynağı `abrechnung.routes.js`'teki `vord.leitsymptomatik || vord.diagnosegruppe` geri
  dönüşüydü — Diagnosegruppe'yi Leitsymptomatik alanına yazıyordu. Geri dönüş kaldırıldı.
- ⚠️ **Önek tuzağı:** `"DF-c"` içindeki `d` harfi, saf `[abcd]` filtresiyle 4. haneyi
  (patientenindividuell) yanlışlıkla `1` yapar. Önek önce kesilmelidir.

### Format hatası tek Verordnung'u değil, DOSYANIN TAMAMINI düşürür
- **Kural:** Alan tipi/uzunluğu ihlali **Prüfstufe 2**'de, geçersiz Schlüssel değeri
  **Prüfstufe 3**'te yakalanır. **İkisi de dosyanın tamamını reddettirir** — hatalı satır
  ayıklanıp gerisi işlenmez. Bu yüzden tek bir eski kayıt bütün ayın abrechnung'unu geri
  getirebilir.
- **Kaynak:** Anlage 1 TP5 V21, Kap. 6.2, s. 161 — *"Wenn die Syntax verletzt ist, z.B. bei
  zu großer Feldlänge oder alphanumerischen Inhalten in numerisch definierten
  Datenelementen ist die gesamte Datei zurückzuweisen."* · Kap. 6.3, s. 162 —
  *"Schlüsselausprägungen müssen korrekt sein im Hinblick auf das Schlüsselverzeichnis
  (Anlage 3) … Bei Abweisung der Datei erfolgt die Benachrichtigung unter Angabe des Fehlers."*
- **Geçerlilik:** 01.10.2025
- **Kodda:** `api-backend/billing/dta/preflight.js` (V:01010 format · V:01011 zorunlu freitext ·
  V:01012 uzunluk) + `segments.js` guard'ı. Preflight **tavsiye değil kapıdır**: dosya
  üretilmeden önce koşar.
- **Kapsam:** tüm DTA gönderimi
- 📌 Sonuç: sıkı `throw` burada doğru davranıştır. Üretim sırasında düşmek saniye kaybettirir,
  reddedilen dosya bir gönderim döngüsü kaybettirir.

### Patientenindividuelle Leitsymptomatik iki durumda zorunludur
- **Kural:** `..70 AN` uzunluğundaki serbest metin alanı, **4. hane `1` ise** ya da
  **Leitsymptomatik `0000` ise** zorunludur. `0000` + serbest metin geçerli bir kombinasyondur
  (podolojide sözleşme bunu açıkça sayar), `0000` + boş metin değildir.
- **Kaynak:** Anlage 1 TP5 V21, Kap. 5.5.3.3, s. 71 — *"zwingend anzugeben falls 4. Stelle bei
  'Leitsymptomatik' = '1' oder falls im Feld 'Leitsymptomatik' der Wert '0000' übertragen
  wird."* · Podologie Anlage 3 l) (Lesefassung 17.06.2025) — *"Alternativ kann eine
  patientenindividuelle Leitsymptomatik … als Freitext angegeben werden."*
- **Geçerlilik:** 01.10.2025 · Podologie 17.06.2025
- **Kodda:** `api-backend/billing/dta/preflight.js` → `V:01011` (zorunluluk), `V:01012`
  (70 hane sınırı), `V:01013` (uyarı: hiç kutu yok, sadece metin)
- **Kapsam:** tüm Heilmittel Verordnung'ları
- ⚠️ **Kart #143'ten sapma, bilinçli:** kart `0000`'ı her hâlükârda hata saymayı öneriyordu.
  Uygulanmadı — podoloji sözleşmesi salt-serbest-metin hâlini açıkça meşru sayıyor, o kural
  hukuken geçerli bir dosyayı reddederdi. Uyarıya indirildi.

### Verordnungsart: 01/02/10/11 „nicht belegt" — yalnız 03/04/05
- **Kural:** `ZHE` Verordnungsart alanı yalnız üç değer alır:
  **03** = § 7 Abs. 1-5 HeilM-RL (Regelfall) · **04** = § 7 Abs. 6 (besonderer
  Verordnungsbedarf / langfristiger Heilmittelbedarf) · **05** = § 13a (Blankoverordnung).
  Blanko kaydı aynı anda LHB de olsa **05 kazanır**.
- **Kaynak:** Anlage 3 TP5 V21 § 8.1.12, s. 29 — *"01 = nicht belegt · 02 = nicht belegt ·
  … 10 = nicht belegt · 11 = nicht belegt"*
- **Geçerlilik:** 01.10.2025 (V21, Stand 19.09.2025)
- **Kodda:** `api-backend/billing/dta/zhe-kennzeichen.js` → `verordnungsartFuer()`;
  Schlüssel tablosu `api-backend/billing/codes/anlage3_v22.js:46` (`VERORDNUNGSART_HEILMITTEL`)
- **Kapsam:** tüm Heilmittel Verordnung'ları
- 📌 **06.09.2026 öncesi durum, iki ayrı hata sınıfı:**
  Physio yolu `is_blanko ? '04' : (is_lhb_bvb ? '02' : '01')` yazıyordu → Blanko sessizce
  „langfristiger Heilmittelbedarf" diye gidiyordu (**gürültüsüz yanlış beyan**).
  Podoloji yolu sabit `'01'` yazıyordu → Preflight V:01004 kesiyordu, yani **podoloji hiç
  abrechnung yapamıyordu** (gürültülü ama dürüst).

### Heilmittel-Bereich Schlüssel'i — podoloji 2, 5 değil
- **Kural:** `ZHE` Heilmittel-Bereich alanı: **1** Physiotherapie · **2** Podologische
  Therapie · **3** Stimm-/Sprech-/Sprach-/Schlucktherapie · **4** Ergotherapie ·
  **5** Ernährungstherapie.
- **Kaynak:** Anlage 1 TP5 V21, Kap. 5.5.3.3, s. 71
- **Geçerlilik:** 01.10.2025
- **Kodda:** `api-backend/billing/dta/zhe-kennzeichen.js` → `heilmittelBereichFuer(sector)`;
  `profiles.sector` sözcük dağarcığı `api-backend/billing/codes/legs.js` → `LEGS_BY_FACHBEREICH`
- **Kapsam:** tüm Heilmittel Verordnung'ları
- 📌 **06.09.2026 öncesi:** podoloji **`'5'`** gönderiyordu — o Ernährungstherapie'dir.
  Ortak mapper ise `sector` parametresini zaten alıyor olmasına rağmen herkes için `'1'`
  yazıyordu, yani Ergo ve Logo da „Physiotherapie" diye gidiyordu.

### Muster 13 Kopfteil → ZHE alan 7/8/9 (Verordnungsbesonderheiten · Unfall · BVG/SER)
- **Kural:** Muster 13'ün baş kısmındaki üç kutu doğrudan üç ZHE alanına gider:
  - **„Unfallfolgen"** işaretliyse → `ZHE` alan 8 **Unfallkennzeichen** = **`2`**
    (sonstige Unfallfolgen). ⛔ Değer **`1`** (Arbeitsunfall/Wegeunfall/Berufskrankheit)
    §302 akışına **hiç girmez** — ayrı kural, aşağıda. Değer **`3`** = Sonstiges
    (BVFG, BEG, HHG, OEG, IfSG, SVG) belgede vardır, bugün kapsam dışı tutuldu.
  - **„BVG/SER"** işaretliyse → `ZHE` alan 9 **Kennzeichen BVG/Sonstiges/SER** = **`6`**.
    Tek değerdir. 01.07.2024'ten itibaren KBV muster'ları „BVG"den „SER"e geçiyor;
    `6` bu geçiş boyunca **her ikisini birden** karşılar (Anlage 3 §8.1.2.1 Hinweis).
  - `ZHE` alan 7 **Verordnungsbesonderheiten** Feldart **K**'dır ama koşullu bağlayıcıdır:
    *„Sofern ein Sachverhalt aus 8.1.11 zutrifft, ist der entsprechende Schlüssel zwingend
    anzugeben."* Heilmittel'de pratikte **üç değer** uygulanır: **`1`** Zahnarzt-/KFO-
    Verordnung · **`2`** Schwangerschaft/Entbindung · **`4`** Entlassmanagement
    (hastane, taburculuktan sonra **7 takvim gününe kadar** reçete eder — HeilM-RL § 16a
    Abs. 1/3).
- **Kaynak:** `wissensbank/gemeinsam/302-tp5/Anlage_1_TP5_V21_20260115.txt:3348-3393`
  (Kap. 5.5.3.3 „SLLA: B (Heilmittel)", s. 70 — alan sırası ve Feldart'lar) ·
  `wissensbank/gemeinsam/302-tp5/Anlage_3_TP5_V21_20250919.txt:316-343` (§8.1.2
  Unfall/Sonstiges + §8.1.2.1 BVG/SER) ve `:1009-1030` (§8.1.11
  Verordnungsbesonderheiten) · `wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt:736-757`
  (§ 16a, 7 gün)
- **Geçerlilik:** 01.10.2025 (Anlage 1 V21 / Anlage 3 V21) · HeilM-RL iK 05.08.2025
- **Kodda:** ⛔ **alanlar var, veri yok.** `api-backend/billing/dta/builder.js:192-194`
  (`verordnung.verordnungsbesonderheiten || ''` · `unfallkennzeichen || ''` ·
  `bvgSonstigesSer || ''`) → `api-backend/billing/dta/segments.js:267-269,297-299`
  (ZHE alan 7/8/9 — sıra 17.09.2026'da segment dizisine karşı doğrulandı). Üçünü de
  dolduran **hiçbir mapper yok**: ne `abrechnung.routes.js`, ne DB kolonu, ne Muster-13
  maskesi — bugün her Verordnung'da **her zaman boş** gidiyor (grep 17.09.2026, `db/` +
  `api-backend/` + `module/` + `dashboard.js`).
- **Kapsam:** tüm Heilmittelerbringer (Physio · Ergo · Logo · Podologie). `gkv-302`
  değerlendirmesi: pratikte neredeyse yalnız Physio/Ergo/Logo'da karşılaşılır — bu yüzden
  uygulama vertikal sıralama kuralı gereği **ertelendi** (Ops #290, podoloji bitene kadar).
- ⚠️ **Anlage 3'ün Inhaltsverzeichnis'i gövdeyle uyuşmuyor** — içindekilerde §8.1.2 =
  „BVG/SER", §8.1.10 = „Verordnungsbesonderheiten", §8.1.16 = „Art der Genehmigung"
  yazıyor; **gövdede** aynı başlıklar §8.1.2.1, §8.1.11 ve §8.1.17'de duruyor. Bu dosyadaki
  bütün § atıfları **gövde numaralandırmasına** göredir (mevcut „Verordnungsart §8.1.12"
  kaydıyla da tutarlı). İçindekilerden atıf verilmez.
- ⚠️ **7 / 8 / 9 değerleri Heilmittel'e uygulanmaz** — `8` için gerekçe belgede yazılı
  (*„nur Hilfsmittel"*, §8.1.11). `7` (Terminservicestellen) ve `9` (Modellvorhaben
  § 64d SGB V) için belge bir Leistungsbereich kısıtı **yazmıyor**; bunlar `gkv-302`'nin
  değerlendirmesidir, kaynaktan alıntı değildir. Koda girerken bu ayrım korunur.
- 📌 Yan bulgu, aynı sayfadan: ZHE alan **10 „Behandlungsbeginn" artık doldurulmaz**
  (*„Dieses Feld wird nicht mehr gefüllt. Das Feld wird als Leerfeld übermittelt."*,
  Anlage 1 V21 s. 70). Kod bunu zaten doğru yapıyor — `segments.js:300` sabit `''`.

### Arbeitsunfall (Unfallkennzeichen `1`) §302 akışına girmez
- **Kural:** `ZHE` Unfallkennzeichen = **`1`** (Arbeitsunfall / Wegeunfall /
  Berufskrankheit) GKV §302 DTA akışında **kullanılmaz ve kullanıcıya sunulmaz**. Bu vaka
  Berufsgenossenschaft / DGUV'nin ayrı sözleşme ve fatura sistemine aittir; GKV'ye
  Arbeitsunfall olarak fatura kesmek ret ve karışıklık riski taşır. Değer teknik olarak
  Schlüssel'de vardır (Anlage 3 onu tanımlar) — **teknik varlığı, bizim akışımızda
  meşruluğu anlamına gelmez.**
- **Kaynak:** `wissensbank/gemeinsam/302-tp5/Anlage_3_TP5_V21_20250919.txt:325`
  (§8.1.2, *„1 = Arbeitsunfall / Wegeunfall / Berufskrankheit"*) · Ops kartı **#135**
  (BG/DGUV ayrı Vertragswesen notu — kapsam kararı orada)
- **Geçerlilik:** 01.10.2025 (Anlage 3 V21)
- **Kodda:** henüz ilgili bir maske/seçenek **yok**. İleride Unfallkennzeichen alanı
  yazıldığında `1` seçenek listesine **hiç konmaz**; yine de bir yoldan girerse DTA
  üretiminden önce kesilmeli (preflight'ın işi — `api-backend/billing/dta/preflight.js`).
- **Kapsam:** tüm Heilmittelerbringer

### LHB Genehmigungskennzeichen (SKZ) yalnız § 8 Abs. 3 vakasında dolar
- **Kural:** Langfristiger Heilmittelbedarf'ta (LHB/BVB) **kural, SKZ'nin boş olmasıdır.**
  HeilM-RL **§ 8 Abs. 2**: Anlage-2 listesindeki tanı + ilgili Diagnosegruppe birleşiminde
  langfristiger Heilmittelbedarf **varsayılır** ve *„Ein Antrags- und Genehmigungsverfahren
  findet nicht statt."* → Genehmigungskennzeichen boş kalır ve bu **doğrudur**; vakaların
  ezici çoğunluğu budur. SKZ segmenti yalnız **§ 8 Abs. 3** istisnasında zorunludur:
  tanı Anlage 2'de **yok**, hasta kasaya **kendi** başvurmuş ve kasa genehmigung vermiştir.
  O hâlde `SKZ` üç alanını taşır — Genehmigungskennzeichen (..20 AN), Datum der Genehmigung
  (8 N), Art der Genehmigung (2 AN). **Art der Genehmigung Heilmittel'de sabit `B2`'dir**
  („Genehmigung gem. § 8 Abs. 3 HeilM-RL"); aynı Leistungsbereich'te **`B1` nicht belegt**,
  yani Heilmittel'de asla yazılmaz.
- **Kaynak:** `wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt:453-461`
  (§ 8 Abs. 2 ve Abs. 3) · `wissensbank/gemeinsam/302-tp5/Anlage_1_TP5_V21_20260115.txt:2876-2881`
  (Kap. 5.5.3.3, SKZ segmenti, s. 72-73 — *„Das Segment ist je Abrechnungsfall einmal zu
  übermitteln, wenn eine Kostenzusage/Genehmigung vorliegt."*) ·
  `wissensbank/gemeinsam/302-tp5/Anlage_3_TP5_V21_20250919.txt:1279-1305` (§8.1.17
  Art der Genehmigung: `B1 = nicht belegt`, `B2 = Genehmigung gem. § 8 Abs. 3`)
- **Geçerlilik:** 01.10.2025 (Anlage 1/3 V21) · HeilM-RL iK 05.08.2025
- **Kodda:** ⚠️ **yazıcı taraf hazır, veri kaynağı yok.** `api-backend/billing/dta/builder.js:210-216`
  (`if (verordnung.genehmigung) { buildSLLA_SKZ(...) }`) →
  `api-backend/billing/dta/segments.js:318-328`. Ama `verordnung.genehmigung`'u kuran
  **hiçbir yer yok** → SKZ bugün hiç üretilmiyor. Eksik olan iki DB kolonu:
  `genehmigungsnummer`, `genehmigungsdatum` (`art` sabit `B2` olduğu için üçüncü kolon
  gerekmez). `prescription_documents.art='lhb_genehmigung'` bu vakayı **zaten tanıyor**
  (`db/SCHEMA.sql:2055` CHECK · yükleyen yol `module/verordnung-nachweis.js:116,128`) —
  yani belge ekleniyor, ama numarası DTA'ya taşınmıyor.
- **Kapsam:** tüm Heilmittelerbringer, Verordnungsart `04` (§ 7 Abs. 6 HeilM-RL)
- 🟠 **Önerilen kapı (uygulanmadı, Ops #290):** `rezept_typ='lhb_bvb'` **ve** ekli bir
  `lhb_genehmigung` belgesi var **ve** SKZ boşsa → DTA üretiminden **önce uyarı**. Sert ret
  değil uyarı, çünkü § 8 Abs. 2 vakasında boş SKZ doğrudur — sert ret meşru dosyayı
  keserdi. Amaç sessiz Absetzung riskini görünür kılmak.

### Abrechnungscode 20 Podologie'yi kapsamaz
- **Kural:** Kostenträgerdatei-Routing'inde Gruppenschlüssel 20 yalnız Abrechnungscode 21-29'u
  (Masseur/Physio/Logo/Ergo/Krankenhaus/Kurbetrieb) temsil eder. Podologie (71) ve Med.
  Fußpflege (72) 20'nin altında DEĞİLDİR; onların fallback'i doğrudan 99 → 00'dır.
- **Kaynak:** Anhang 03 zur Anlage 1 TP5, §8.14 + Fußnote 4 (Stand 14.04.2026)
- **Geçerlilik:** yapı spec'i; Anlage 1 TP5 V21 Kap. 11 üzerinden atıflı
- **Kodda:** `api-backend/billing/kostentraeger/annahmestelle.js` → `abrechnungscodeKette()`
- **Kapsam:** Podologie · Kostenträgerdatei-Empfängerauflösung

### UNB.Empfänger yalnız Verknüpfungsart 03'ten gelir, 02 yalnız rückfall
- **Kural:** DTA dosyasının alıcısı ve şifreleme sertifikası, Kostenträgerdatei'de
  Verknüpfungsart **03** (Datenannahmestelle MIT Entschlüsselungsbefugnis) ile işaretli IK'dır.
  Verknüpfungsart 02 (Netzbetreiber, şifre çözme yetkisi yok) yalnız 03 hiç yoksa denenir.
- **Kaynak:** Anhang 03 §8.3 · Anlage 1 TP5 V21 §5.4 UNB Feld 0010 · Kap. 8 Datenannahmestellen
- **Geçerlilik:** 01.10.2025 (Anlage 1 V21)
- **Kodda:** `api-backend/billing/kostentraeger/annahmestelle.js` → `VERKNUEPFUNGSART_KETTE`
- **Kapsam:** tümü

### Bundesland-Filtresi: boş dize = "tüm eyaletler", NULL değil
- **Kural:** `kostentraeger_annahmestellen.bundesland` kolonu `NOT NULL DEFAULT ''` —
  eyalet-bağımsız satırlar boş dize (`''`) taşır, bazıları `'99'`. Sorgu
  `bundesland IN (praxisBundesland, '99', '')` olmalı; yalnız exact-match yapılırsa
  ~220 çözülebilir Kostenträger ~12'ye düşer (ölçülmüş, `db-ustasi` 07.09.2026).
- **Kaynak:** Anhang 03 §8.4 (`99 = Alle Bundesländer`) + canlı veri ölçümü
- **Geçerlilik:** veri gözlemi, sürüme bağlı değil
- **Kodda:** `api-backend/billing/kostentraeger/annahmestelle.js` → `waehleAnnahmestelle()`
- **Kapsam:** tümü

### Physio-Vergütung bundeseinheitlich — fiyatta Bundesland ekseni yok
- **Kural:** § 125 Abs. 1 SGB V Physiotherapie fiyatları federal düzeyde tektir;
  Bundesland veya Kostenträger başına fiyat farkı yoktur. Ayırt edici tek eksen
  Leistungserbringergruppe'dir, pozisyon numarasının ilk hanesiyle çözülür
  (21→1, 22→2, 27→6, 28→8). Yukarıdaki "Bundesland-Filtresi" kuralıyla
  KARIŞTIRILMASIN — o Kostenträger/Annahmestelle seçimi içindir (orada Bundesland
  gerçekten bir eksendir), bu kural FİYAT için geçerlidir.
- **Kaynak:** Anlage 2 zum Vertrag nach § 125 Abs. 1 SGB V für Physiotherapie,
  Teil A (Lesefassung gültig ab 01.01.2026) — tek "Preis in Euro" sütunu;
  belgede "Bundesland"/"regional"/"Landesverband" hiç geçmiyor (grep, 0 eşleşme)
- **Geçerlilik:** 01.01.2026 — Teil B (7): en erken 31.12.2026 kündbar, (9):
  kündigung sonrası eski fiyatlar yeni Anlage yürürlüğe girene dek devam eder
  → bir sonraki fiyat penceresi en erken 01.01.2027
- **Kodda:** `billing/codes/physio_positions.js` (PHYSIO_PREISFENSTER) — kaynak.
  `billing/preise/resolver.js` eskiden `heilmittel_tarif`'ten bölgesel bir
  override okuyordu (16 eyalet, hepsi aynı fiyat — gerçek regionalizasyon
  yoktu); 13.09.2026'da kaldırıldı (O-96, onprem/REGISTER.md)
- **Kapsam:** Physio, tüm Verordnungsart'lar (standart / Blanko / LHB / BVB)

### Anlage 3 V21 → V22: tek fark Haushaltshilfe, Heilmittel'e dokunmuyor
- **Kural:** Anlage 3 TP5 V21 ile V22 arasındaki tek içerik farkı §8.1.5.1'dir: V22
  Haushaltshilfe'ye kendi Abrechnungscode'larını verir (C1–C4) ve Leistungsbereich C
  başlığından "und Haushaltshilfe" ibaresini çıkarır. Heilmittel (Leistungsbereich B)
  ile ilgili tüm Schlüssel listeleri iki sürümde AYNIDIR — dolayısıyla bu listeleri
  taşıyan kod bugün V21 altında geçerlidir, 01.02.2027'de de geçerli kalacaktır.
- **Kaynak:** Anlage 3 TP5 V21 (Stand 19.09.2025) ↔ V22 (Stand 18.02.2026),
  Änderungshistorie + tam metin karşılaştırması, §8.1.5.1
- **Geçerlilik:** 01.10.2025 – süresiz (V22 geçişi bu listelerde değişiklik getirmiyor)
- **Kodda:** `api-backend/billing/codes/anlage3_v22.js` (tamamı) —
  dosya adı yanıltıcı, içerik her iki sürümde geçerli
- **Kapsam:** tüm Heilmittelerbringer (Physio · Ergo · Logo · Podo)

### `dta_schluessel` tablosu DTA üretimini beslemez
- **Kural:** §302 Schlüssel değerleri yalnız `api-backend/billing/codes/*.js`'ten okunur;
  `dta_schluessel` tablosu hiçbir kod yolundan okunmaz ve migration zincirinde seed'i yoktur
  (bilinçli — db/REGISTER.md). Bir Schlüssel değişikliği yalnız kod dosyasında yapılır —
  tabloya yazmak sessizce etkisizdir.
- **Kaynak:** `db/REGISTER.md` (`dta_schluessel` kaydı) · `db/NUTZUNG.md` · grep doğrulaması 13.09.2026
- **Geçerlilik:** 13.09.2026
- **Kodda:** `billing/dta/builder.js` · `billing/dta/preflight.js` · `billing/dta/zhe-kennzeichen.js`
- **Kapsam:** tümü

### Çözülemeyen Kostenträger: sert 412, sessiz fallback yok
- **Kural:** Bir Kostenträger için elektronik Datenannahmestelle (Verknüpfungsart 02/03 +
  art_datenlieferung 07/30) hiçbir Abrechnungscode kademesinde bulunamazsa, DTA üretimi
  412 ile reddedilir. `kk.das_ik` veya `kostentraegerIk`'nin kendisine sessiz fallback YASAK —
  o IK'nın şifreleme sertifikası olmadığından dosya zaten açılamaz, fallback erken/okunur
  hatayı geç/okunmaz hataya çevirir.
- **Kaynak:** mantıksal sonuç (yukarıdaki iki kural) + ölçüm: 07.09.2026 itibariyle 302
  abrechnender Kostenträger'den 82'si çözülemiyor, ama gerçek reçete etkisi ölçüldü: sıfır
  (`db-ustasi`, `prescriptions.kostentraeger_ik` taraması)
- **Geçerlilik:** veri gözlemi, sürüme bağlı değil
- **Kodda:** `api-backend/billing/api/abrechnung.routes.js` (`annahmestelleFehlt` → 412)
- **Kapsam:** tümü

### Begleitzettel: Gesamtrechnung başına bir adet, Karten-IK ile
- **Kural:** Her Gesamtrechnung (= her Karten-IK grubu) için ayrı bir Begleitzettel üretilir.
  „IK der Krankenkasse" alanı Karten-IK'dır (KV-Karte / ärztliche Verordnung), Kostenträger-IK
  değil. „Rechnungsnummer" o Gesamtrechnung'un Einzel-Rechnungsnummer'idir. Adres bloğunda
  Datenannahmestelle DEĞİL, Papierannahmestelle (Verknüpfungsart 09) hedeflenmeli — bugün
  kodda bu blok tamamen kaldırıldı.
- **Kaynak:** Anlage 4 V2.0 (ab 01.12.2006), Allgemeines Abs. 2 + Inhalte Abs. 1 ·
  terim tanımı: Anlage 1 TP5 V21 Kap. 5.5.2 (SLGA.FKT) · Richtlinien-Text 20.11.2006 § 4 ·
  Urbelege→Papierannahmestelle: Anhang 03 §5.3
- **Geçerlilik:** 01.12.2006 — hâlâ yürürlükte
- **Kodda:** `api-backend/billing/api/abrechnung.routes.js` (Begleitzettel-Bau, `dta.gruppen`
  üzerinden) · şablon `api-backend/billing/pdf/begleitzettel.template.js`
- **Kapsam:** tümü

### Sammel-Rechnungsnummer ..14, Einzel-Rechnungsnummer ..6, Zeichenvorrat
- **Kural:** REC segmentinde Sammel-Rechnungsnummer en fazla **14**, Einzel-Rechnungsnummer
  en fazla **6** hanedir (`..n` = höchstmögliche Stellenbelegung), ikisi de AN/Muss.
  Sonderzeichen ve boşluk kabul edilmez; ayraç olarak yalnız `-` ve `/`, asla ardışık, asla
  başta veya sonda. Numara **tüm fatura yılları boyunca her Krankenkasse için tekil** olmalıdır.
  Uzunluk ihlali Prüfstufe 2'de yakalanır (Anhang 2 Kap. 9 § 3.2) — **dosyanın tamamı** reddedilir.
- **Kaynak:** Anlage 1 TP5 V21 Kap. 5.5.2 (SLGA REC, S. 34) ve Kap. 5.5.3.1 (SLLA REC, S. 44);
  notasyon Kap. 5.1 (8)
- **Geçerlilik:** 01.10.2025
- **Kodda:** uzunluk `F:03002` (`api-backend/billing/dta/preflight.js`); Zeichenvorrat `F:03006`
  ve Einzel-uzunluk `F:03007` — ikisi 20.09.2026'da eklendi, `gkv-302` onayıyla sert kural
  (`api-backend/billing/dta/regel-schwere.js` · `REGELN.md`)
- **Kapsam:** tüm Leistungserbringergruppen, SLGA + SLLA

---


# Datenübermittlung · Test- / Erprobungsverfahren · Verschlüsselung

> Kaynağı: **Anhang 1 zur Anlage 1 TP5** (Kap. 4 Datenübermittlung, Stand 31.08.2017,
> anzuwenden ab 01.09.2017) ve **Anhang 2 zur Anlage 1 TP5** (Kap. 9 Prüfverfahren,
> Stand 10.11.2003). İkisi de 10.09.2026'da arşive girdi → sicil `wissensbank/REGISTER.md`
> W-02 / W-03. Bloklar `gkv-302`'nin 10.09.2026 canlı-gönderim hazırlık denetiminden çıktı;
> kod satırı atıfları `wissensbank` tarafından aynı gün ölçüldü (üçü kaymıştı, düzeltildi).

### Logischer Dateiname — 11 hane, UNB Anwendungsreferenz ve Auftragsdatei'de aynı
- **Kural:** `SL` + Absender-IK'nın 3.–8. haneleri + `S` (Selbstabrechner) veya `A`
  (Abrechnungsstelle) + 2 haneli Abrechnungsmonat. Toplam 11 hane, UNB Feld 0026'ya ve
  Auftragsdatei'nin „Dateiname" alanına birebir aynı yazılır, tüm aktarım ortamları için aynıdır.
- **Kaynak:** Anhang 1 zur Anlage 1 TP5, Kapitel 4, § 4.2 (Stand 31.08.2017)
- **Geçerlilik:** 01.09.2017 — hâlâ geçerli
- **Kodda:** ⛔ uygulanmamış — `api-backend/billing/dta/filename.js` → `buildDtaFilename()`,
  dönüş satırı ``return `E${anwendung}${ikSuffix}${seq}` `` **16 haneli `EHK…`/`EHM…`** üretiyor.
- ⚠️ **Çelişki, çözülmeden koda dokunulmamalı:** `filename.js` baş yorumu kendi kaynağı olarak
  „GKV-DA Anlage 17 (Nutzdatendateien)" gösteriyor — yani §302 Anhang 1 §4.2'ye değil **başka bir
  spesifikasyona** dayanıyor. Anlage 17 arşivde **yok**. Hangisinin geçerli olduğuna `gkv-302`
  karar verir; „16 haneyi 11 haneye çevir" işi o karardan önce yapılmaz.
- **Kapsam:** tüm Leistungserbringergruppen, tüm Verordnungsarten

### Physikalischer Dateiname — 8 hane, Test/Echt ayrımı BURADA
- **Kural:** `E` (Echtdaten) veya `T` (Testdaten) + `SOL` (Sonstige Leistungserbringer) +
  `0` (Versionsangabe) + 3 haneli laufende Nummer (Transfernummer). Auftragsdatei'de belirtilir.
- **Kaynak:** Anhang 1 zur Anlage 1 TP5, Kapitel 4, § 4.3 (Stand 31.08.2017)
- **Geçerlilik:** 01.09.2017 — hâlâ geçerli
- **Kodda:** ⛔ uygulanmamış — Auftragsdatei üreten kod yok (aşağıdaki kurala bak)
- **Kapsam:** tüm gruplar

### Transfernummer 0..999 arasında döner ve 999'dan sonra 0'a atlar
- **Kural:** Auftragsdatei'nin `TRANSFER_NUMMER` alanı (25.–27. haneler, 3 N, Muss) 000–999
  değerlerini alır. *„Sie wird ab '999' wieder auf '0' gesetzt."* Her **başarılı** aktarımda
  +1; **başarısız** aktarımda numara korunur ve aynı dosyanın bir sonraki denemesinde tekrar
  kullanılır. Vorlaufsatz'ın lfd. Nr.'si (Datenaustauschreferenz) ile **hiçbir ilgisi yoktur**.
  Sayaç Absender↔Empfänger çifti başına yürür.
- **Kaynak:** GGT Anlage 2 „Auftragsdatei", Auftragssatz V1.0 Stand 10.10.2024, geçerlilik
  01.01.2025, alan `TRANSFER_NUMMER`. ⚠️ Anhang 1 zur Anlage 1 TP5 Kap. 4.3 yalnız **konumu**
  (6.–8. hane) verir, **hiçbir değer aralığı vermez** — kodda 20.09.2026'ya kadar duran
  „1–999" **kaynaksızdı**.
- **Geçerlilik:** 01.01.2025
- **Kodda:** aralık `[0, 999]` → `api-backend/billing/dta/filename.js` ·
  `dta/auftragsdatei.js` · `dta/builder.js`; sayaç `datenaustausch_zaehler` içinde `% 1000`
  ile döner (`api-backend/db/migrations/0029_datenaustausch_zaehler.sql`)
- **Kapsam:** her DTA aktarımı

### Testdatei ödeme tetiklemez
- **Kural:** UNB Feld 0035 = `0` (Test) veya `1` (Erprobung) olan dosyaların işlenmesi
  hiçbir ödeme tetiklemez.
- **Kaynak:** Anhang 2 zur Anlage 1 TP5, Kapitel 9, § 5 — *„Die Verarbeitung der unter den
  zuvorgenannten Kriterien gemeldeten Testdaten löst keine Zahlungen aus."*
- **Geçerlilik:** 10.11.2003 — hâlâ geçerli
- **Kodda:** `api-backend/billing/api/abrechnung.routes.js` — üç çağrının üçü de `kind: 'test'`
  (satır **700 · 2810 · 3242**; ilkinin yanında *„Faz A2 starts in test mode; flip to 'echt'
  once DAS portal acks"* yorumu duruyor) → `api-backend/billing/dta/builder.js:375`
  `testIndikator = kind === 'echt' ? '2' : kind === 'erprobung' ? '1' : '0'`
- **Kapsam:** tüm gruplar
- ⚠️ Bu kural „yanlışlıkla Echt gönderme" riskine değil, **„Test gönderip para bekleme"**
  hatasına karşı duruyor — bugün kod zaten yalnız Test üretiyor.

### Echt'e geçiş kasadan Zulassung gerektirir
- **Kural:** Erprobungsphase ancak Leistungserbringer kasa tarafından „zum Echtverfahren
  zugelassen" edildiğinde biter. Öncesinde Prüfstufe 1–3'ü hatasız geçmiş Testdateien ve
  Datenannahmestelle'ye Kommunikationspartner olarak kayıt şarttır.
- **Kaynak:** Anlage 1 TP5 V21 § 2 Abs. 2 · Anhang 2 zur Anlage 1 TP5 Kap. 9, § 3.1, § 4, § 6
- **Geçerlilik:** 01.10.2025 (Anlage 1 V21) / 10.11.2003 (Anhang 2)
- **Kodda:** ⛔ uygulanmamış — `kind` kodda sabit, sürecin hangi aşamada olduğunu tutan DB
  alanı yok. „Test → Erprobung → Echt" geçişi bugün bir kod düzenlemesi gerektiriyor.
- **Kapsam:** tüm gruplar

### Zulassung zum Echtverfahren praxis başına değil, Absender×Empfänger çifti başına geçerlidir
- **Kural:** Erprobung ve Echtverfahren-Zulassung „Absender ile Empfänger arasında" yürür;
  Zulassung'u **Krankenkasse** verir, ayrıntılar ilgili **Datenannahmestelle** ile mutabık
  kalınır. UNB-Testindikator (0 Test · 1 Erprobung · 2 Echt) Nutzdatendatei başına **TEK**
  değerdir ve dosya birimi „je Datenannahmestelle mit Entschlüsselungsbefugnis je Kassenart"
  olduğundan ifade edilebilir en ince granülarite (DAS × Kassenart)'tır. Praxis genelinde tek
  bir bayrak **yanlıştır**: erken `echt` → Zulassung'suz bir DAS'a gerçek veri gider; geç
  `echt` → „keine Zahlungen auslösen" diyen Testdatei gider, yani **para sessizce gelmez.**
- **Kaynak:** Anlage 1 TP5 V21 Kap. 2 (1)(2) (S. 8) · Kap. 3 (1) + Kap. 8 (S. 175) ·
  Kap. 5.4 UNB 0035 · Anhang 2 zur Anlage 1 Kap. 9 § 1, § 5, § 6
- **Geçerlilik:** 01.10.2025 (Anlage 1 V21) / Anhang 2 Stand 10.11.2003
- **Kodda:** Betriebsart `(owner_id, empfaenger_ik)` başına → `betriebsart_empfaenger`
  (`api-backend/db/migrations/0031_betriebsart_je_empfaenger.sql`);
  `terapeut_zertifikat.betriebsart` Vorgabewert olarak kalır
- **Açık (belgelenmemiş):** Krankenkasse'nin Zulassung'u **Kassenart** bazında mı yoksa
  **tek tek Krankenkasse** bazında mı verdiği hiçbir kaynakta yazmıyor — DAS randevusunda
  (plan Abschnitt 2.1) sorulacak
- **Kapsam:** tüm Leistungserbringergruppen, tüm Verordnungsarten

### Nutzdatendatei + Auftragsdatei çift gider
- **Kural:** Prüfstufe 1'de dosyaların **çift hâlinde** (Auftragsdatei + zugehörige Nutzdatei)
  geldiği kontrol edilir. Nutzdaten şifreli, Auftragsdatei şifresizdir.
- **Kaynak:** Anhang 2 zur Anlage 1 TP5 Kap. 9, § 3.1 — *„Prüfung ob die Dateien paarweise,
  d.h. Auftragsdatei und zugehörige Nutzdatei übermittelt"* · Auftragsdatei yapısı için
  Anhang 1 zur Anlage 1 TP5 § 4.3 → Anlage A (GGT) · GGT § 2.3 (Fassung 01.01.2026)
- **Geçerlilik:** hâlâ geçerli
- **Kodda:** ⛔ uygulanmamış — projede `Auftragsdatei` üreten hiçbir kod yok
  (`grep -rn "Auftragsdatei" --include=*.js --include=*.mjs` → sıfır sonuç, 10.09.2026'da ölçüldü)
- **Kapsam:** tüm gruplar; DFÜ'de zorunlu, portal yüklemesinde bilateral
- ⚠️ **Auftragsdatei'nin tam alan yapısı arşivde YOK** — GGT Anlage 2 indirilmeli
  (`wissensbank/REGISTER.md` → W-A09).

### Önce imzala, sonra alıcının açık anahtarıyla şifrele
- **Kural:** Nutzdaten önce **göndericinin özel anahtarıyla imzalanır**, ardından **ALICININ
  açık anahtarıyla şifrelenir**. Sertifikalar SECON (GGT Anlage 16) kapsamındadır; nitelikli
  elektronik imza (qeS) DTA için gerekli **DEĞİLDİR** — qeS yalnız Imageverfahren'de
  (Anhang 04c) istenir.
- **Kaynak:** GGT § 5.1 · § 2.3 (Fassung 01.01.2026) · Anhang 04c § 4 (qeS kapsamı)
- **Geçerlilik:** 01.01.2026
- **Kodda:** ⚠️ **yarı uygulanmış** — `dashboard.js:18085` (`forge.pkcs7.createSignedData()`)
  CMS SignedData üretiyor, **EnvelopedData yok**; `api-backend/billing/api/abrechnung.routes.js`
  yalnız SignedData OID'ini doğruluyor (satır **977** yorum `contentType OID 1.2.840.113549.1.7.2`
  + satır **983** ret mesajı „Ungültige PKCS#7-Struktur — Datei ist kein gültiges CMS SignedData").
  Yani bugün üretilen dosya **imzalı ama şifresiz**.
- **Kapsam:** tüm gruplar

### Teilnehmer-Zertifikat azami geçerlilik 1 yıl
- **Kural:** SECON teilnehmer sertifikalarının azami geçerlilik süresi üç yıldan **bir yıla**
  indirildi. „Die Teilnehmer-Zertifikate haben grundsätzlich eine Gültigkeitsdauer von
  maximal einem Jahr. Für die PCA … 7 Jahre und für die CA 5 Jahre." Geçiş: 31.12.2025'e
  kadar tamamlanan başvurular eski süreyi (3 yıl) korudu, **02.01.2026'dan itibaren** yalnız
  1 yıllık sertifika veriliyor (ITSG duyurusu, post-quantum gerekçeli).
- **Kaynak:** GGT Anlage 16 – Security Schnittstelle (SECON) §4.5, satır 1889-1891
  (gültig ab 01.01.2026, Stand 02.09.2025) · ITSG duyurusu „Warum Zertifikate bald nur
  noch ein Jahr lang gültig sind"
- **Geçerlilik:** 02.01.2026 (21.09.2026'da `gkv-302` tarafından doğrulandı, önceki
  "belirtilmemiş" notu kapatıldı)
- **Kodda:** `cert_valid_to` **yazılıyor** (`abrechnung.routes.js:1011`) ve iki yerde **SELECT
  ediliyor** (`:534`, `:2598` — ikisi de `.select('ik_nummer, cert_subject, cert_valid_to')`),
  ama hiçbir yerde bugünün tarihiyle **karşılaştırılmıyor**: süresi dolmuş sertifikayla gönderim
  engellenmiyor. Ayrıca iki pazarlama sayfası yanlış bilgi veriyordu, 21.09.2026'da düzeltildi:
  `blog/heilmittel-selbst-abrechnen-vs-abrechnungszentrum.html` ("einmalig für drei Jahre")
  ve `blog/paragraph-302-dakota-zertifikat-datenannahmestellen.html` ("100–180 €, 2 Jahre" →
  doğrusu 79 €/49 €, 1 Jahr).
- **Kapsam:** tüm gruplar

### §302 gönderimi belirli bir ürüne bağlı değildir
- **Kural:** Aktarım ortamı ve şifreleme prosedürü Anlage A–F'de (GGT, SECON, FTAM, X.400,
  E-Mail, http/https) standart olarak tanımlıdır; hiçbir spesifikasyon belirli bir yazılım
  ürününü (ör. ITSG'nin `dakota.le`'si) zorunlu kılmaz. SECON'a uygun PKCS#7/PKCS#10 üreten
  her yazılım meşrudur — ITSG'nin kendi sitesi sertifikanın "Abrechnungssoftware für
  Leistungserbringer" (yani bizim yazılımımız) üzerinden de alınabileceğini açıkça yazıyor.
  38 resmi belgenin tam metin taramasında "dakota" kelimesi **hiç geçmiyor**.
- **Kaynak:** Anhang 1 zur Anlage 1 TP5, Kap. 4.1 (Stand 31.08.2017, anzuwenden ab
  01.09.2017), satır 60-83 · GGT Anlage 16 SECON §3.2, §5.4 (gültig ab 01.01.2026) ·
  itsg.de Trust-Center „Zertifikat beantragen" + FAQ
- **Geçerlilik:** açık uçlu
- **Kodda:** `api-backend/billing/dta/` dosya üretimini uyguluyor; şifreleme katmanı henüz
  yok (Adım 1.3, iptal edilmedi — bu bulgu mimariyi DEĞİL, yalnız 21.09.2026'da
  `REGULATORY_AUDIT.md`'deki yanlış "dakota zorunlu" iddiasını kapatıyor)
- **Kapsam:** tüm gruplar

### http/https ile gönderim bilateral anlaşma gerektirir
- **Kural:** Anlage F (http/https) üzerinden aktarım için gönderen ile Datenannahmestelle
  arasında **bilaterale Vereinbarung** şarttır: „Zur Übermittlung auf Grundlage dieser
  Anlage bedarf es der bilateralen Vereinbarung zwischen …" — tek taraflı bir HTTPS POST
  yeterli değildir, önce DAS ile yazılı/sözlü mutabakat kurulmalı.
- **Kaynak:** Anhang 1 zur Anlage 1 TP5, Kap. 4.1, Anlage F, satır 82-83
- **Geçerlilik:** 01.09.2017'den beri
- **Kodda:** uygulanmamış — gönderim adaptörü henüz yazılmadı. `ABRECHNUNG_ECHTBETRIEB_PLAN.md`
  Adım 2.1 soru listesine eklendi (21.09.2026): DAS'a hangi Austauschart'ı kabul ettiği ve
  https için bilateral anlaşma şart olup olmadığı sorulmalı.
- **Kapsam:** tüm gruplar

### Bir Nutzdatendatei birden çok SLGA ve SLLA taşıyabilir
- **Kural:** „Sie beinhaltet die Nachrichten SLGA und SLLA, die mehrfach wiederholbar sind."
  N adet SLLA mesajı spesifikasyona uygundur.
- **Kaynak:** Anlage 1 TP5 V21 § 5.4 (Dateiaufbau, Servicesegmente tablosu, UNB satırı)
- **Geçerlilik:** 01.10.2025
- **Kodda:** ✅ uygun — `api-backend/billing/dta/builder.js:5-22` baş yorumundaki dosya yapısı
  şeması („… SLLA je Abrechnungsfall dieser Gesamtrechnung … naechste Gesamtrechnung")
- **Kapsam:** tüm gruplar
- ✅ Bu kural **26.08.2026 tarihli „bir dosyada 1 SLGA + 1 SLLA olmalı" bulgusunu çürütür.**

---

### GES.Summenstatus yalnız 00/11/31/51/99 — Versichertenstatus'un ilk hanesi değildir
- **Kural:** SLGA'daki GES segmentinin Status alanı yalnız `00` (Gesamtsumme), `11` (Mitglieder),
  `31` (Angehörige), `51` (Rentner), `99` (nicht zuzuordnen) olabilir. INV.Versichertenstatus'un
  ilk hanesi (1/3/5) **doğrudan yazılmaz**, `11`/`31`/`51`'e çevrilir; 2.–5. haneler dikkate alınmaz.
- **Kaynak:** Anlage 3 TP5 V21 § 8.1.6 (Schlüssel Summenstatus) + Anlage 1 TP5 V21 Kap. 5.5.2 S. 35
- **Geçerlilik:** 01.10.2025
- **Kodda:** ❌ **uygulanmamış** — `api-backend/billing/dta/builder.js:431` ilk haneyi alıyor,
  `:275` fallback `'1'` yazıyor, `dta/segments.js:108` `padStart(2,'0')` ile `01` üretiyor.
  Doğru tablo `billing/codes/anlage3_v22.js:64` (`SUMMENSTATUS`) zaten var ama **hiç kullanılmıyor**.
- **Kapsam:** tüm gruplar, tüm Verordnungsart'lar

### UNT.Anzahl Einheiten ve UNZ.Anzahl Nachrichten 6 hane, führende Nullen ile
- **Kural:** UNT alan 0074 ve UNZ alan 0036 sabit **6 hane, Feldtyp N**, „mit führenden Nullen".
  `UNT+000008+00001'` doğrudur, `UNT+8+00001'` değildir.
- **Kaynak:** Anlage 1 TP5 V21 Kap. 5.4 (Nachrichtentypendesegment / Endesegment der Nutzdatendatei)
- **Geçerlilik:** 01.10.2025
- **Kodda:** ❌ **uygulanmamış** — `api-backend/billing/dta/envelope.js:56` ve `:64`
  `String(...)` kullanıyor, `padStart(6,'0')` yok. Golden fixture'lar da hatayı sabitlemiş
  (`dta/__golden__/physio.edi`, `podo.edi`).
- **Kapsam:** tüm gruplar

### Virgül de bir Steuerzeichen'dir — serbest metinde `?` ile kaçırılmalı
- **Kural:** `:` `+` `,` `?` `'` beşi birden Steuerzeichen'dir. Bunlardan biri bir alanın
  **metin içeriği** olarak geçecekse önüne Aufhebungszeichen `?` konur. (Sayısal
  Betragsfeld'lerdeki virgül Dezimalzeichen'dir, kaçırılmaz — ayrım alan tipine göredir.)
- **Kaynak:** Anlage 1 TP5 V21 Kap. 5.1 (11) + hemen ardındaki „Ein Beispiel: … +D?'Angelo+Luigi+"
- **Geçerlilik:** 01.10.2025
- **Kodda:** ❌ **eksik** — `api-backend/billing/dta/encoding.js:14-19` `RESERVED` listesinde
  `,` yok. `DIA.Diagnosetext` (..70 AN, serbest metin) veya virgüllü bir soyad dosyayı böler.
  ⚠️ Düzeltme `escapeEdifact`'e körlemesine `,` eklemekle yapılamaz: `fmtAmount` çıktısı
  (`51,92`) aynı yoldan geçiyor, `51?,92` olurdu. Metin alanı / sayı alanı ayrımı gerekir.
- **Kapsam:** tüm gruplar

### DIA her tanı için ayrı segment — iki ICD tek alana yazılmaz
- **Kural:** „Das Segment ist 1 mal je Diagnose zu übermitteln." İki ICD varsa iki DIA
  segmenti gider; Diagnoseschlüssel alanı ..12 AN'dir.
- **Kaynak:** Anlage 1 TP5 V21 Kap. 5.5.3.3 S. 72 (DIA)
- **Geçerlilik:** 01.10.2025
- **Kodda:** ❌ **uygulanmamış** — `api-backend/billing/api/abrechnung.routes.js:2444`
  `[vord.icd10, vord.icd10_2].join(',')` ile tek alana koyuyor; `dta/builder.js:205` tek DIA basıyor.
- **Kapsam:** tüm gruplar

### ZHE.Therapiefrequenz Podolojide her zaman „0"
- **Kural:** „Bei Podologie, Ernährungstherapie oder Verordnungen ohne Frequenzangabe ist
  ‚0' anzugeben." Podolojide reçetedeki frekans DTA'ya taşınmaz.
- **Kaynak:** Anlage 1 TP5 V21 Kap. 5.5.3.3 S. 72 (Therapiefrequenz)
- **Geçerlilik:** 01.10.2025
- **Kodda:** ❌ **uygulanmamış** — `api-backend/billing/api/abrechnung.routes.js:2480`
  `therapiefrequenz: frequenzToDigit(vord.frequenz)`. Gerçek, kasadan geçmiş bir podoloji
  DTA'sında bu alan `0`; bizim test dosyamızda `1`.
- **Kapsam:** Podologie (ve Ernährungstherapie)

### NAD adresi Kann-Feld'dir — Versichertennummer + Status biliniyorsa zorunlu değil
- **Kural:** NAD'ın Straße/PLZ/Ort/Länderkennzeichen alanları Feldart **K**'dir.
  „Die Anschrift ist zwingend anzugeben, sofern die Versichertennummer/Versichertenstatus
  nicht bekannt ist." INV tarafı da aynısını söylüyor: KVNR bilinmiyorsa adres + doğum
  tarihi NAD ile gider.
- **Kaynak:** Anlage 1 TP5 V21 Kap. 5.5.3.1 S. 47-48 (NAD) + S. 45 (INV)
- **Geçerlilik:** 01.10.2025
- **Kodda:** ⚠️ builder destekliyor (`dta/segments.js:181-199`), ama route mapper'ları alanı
  hiç doldurmuyor (`billing/api/abrechnung.routes.js:360-367` physio, `:2446-2453` podo) —
  veri `leads.street/plz/city`'de var ve aynı dosyada `:1725-1727`'de zaten okunuyor.
- **Kapsam:** tüm gruplar — **dosya reddi sebebi değil**, 2026-09-19'da böyle iddia edilmişti, çürütüldü

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
- **Kaynak:** `wissensbank/gemeinsam/icd-10-gm/icd10gm2026syst_metadaten_liesmich.txt`,
  bölüm DATENSATZBESCHREIBUNG (tam 28 alanlık liste `wissensbank/INDEX.md` içinde kayıtlı)
- **Geçerlilik:** ICD-10-GM Version 2026, Stand 12.09.2025
- **Kodda:** doğrulanmadı — `katalog-suche.js` ve `sync_heilmittel_katalog.js` kontrol edilmeli
- **Kapsam:** ICD arama ve doğrulama
- ⚠️ Dosya **4.2 MB** — asla tamamı okunmaz, `grep` ile tek kod çekilir.

### Diagnosegruppe kod formatı
- **Kural:** Diagnosegruppe kodları 2–3 karakterli kısaltmalardır (ör. `ZN`, `EN1`, `EX`).
  Diagnoseliste iki bölümden oluşur: (1) LHB/BVB tabloları, (2) Blankoverordnung tabloları —
  sütun yapıları **farklıdır**.
- **Kaynak:** `wissensbank/gemeinsam/heilmittel-richtlinie/heilmittel-diagnoseliste.txt` (KBV, Stand 01.01.2026)
- **Geçerlilik:** 01.01.2026
- **Kodda:** `api-backend/ai/validators/diagnosegruppen.json`
- **Kapsam:** LHB / BVB / Blankoverordnung tanı eşlemesi

---

# DAVASO / IQVIA HSS — Testverfahren araçları (21.09.2026 araştırması)

### Testverfahren: Zulassung'u Krankenkasse verir, Datenannahmestelle değil
- **Kural:** §302'de Echtverfahren'e geçiş izni Krankenkasse'den gelir; Datenannahmestelle
  yalnız Prüfstufe 1–3 sonucunu bildirir, Zulassung vermez.
- **Kaynak:** Anhang 2 zur Anlage 1 TP5, Kap. 9 §4 + §6 (Stand 10.11.2003)
- **Geçerlilik:** bugün geçerli (halefi yok)
- **Kodda:** `kind` üç değerli alanı — Adım 1.7, uygulandı (betriebsart_empfaenger)
- **Kapsam:** tüm Leistungserbringergruppen, tüm Verordnungsarten

### Test dosyasında kullanılacak IK, DAS ile kararlaştırılır
- **Kural:** Softwarehersteller-Test'te hangi IK'nın Absender olacağı spec'te sabit değildir;
  „die Angabe von IKs" açıkça Datenannahmestelle ile mutabakata bırakılmıştır.
- **Kaynak:** Anhang 2 zur Anlage 1 TP5, Kap. 9 §5 son paragraf
- **Geçerlilik:** bugün geçerli
- **Kodda:** `api-backend/billing/dta/software-hersteller-ik.js` (korkuluk, `SOFTWARE_HERSTELLER_IK = null`)
- **Kapsam:** yalnız Testverfahren (`UNB Testindikator 0`) — Echtbetrieb'te asla

### BARMER'in Heilmittel-Datenannahmestelle'si DDG GmbH (Essen), IK 660510336
- **Kural:** BARMER (IK 104940005) Abrechnungscode 20/68/71/72 için DAS olarak 660510336'yı
  gösterir; IQVIA HSS (661430035) BARMER için DAS DEĞİLDİR.
- **Kaynak:** Kostenträgerdatei `EK05Q226_KE0.txt:1072 ff.` (vdek, gültig ab 01.04.2026),
  VKG+03 satırları; DAS adı `EK05Q226_KE0.txt:2589`
- **Geçerlilik:** 01.04.2026 – (Q4 dosyası 01.10.2026'da devralır)
- **Kodda:** `kostentraeger_annahmestellen` tablosu üzerinden `ladeAnnahmestelle()`
- **Kapsam:** tüm Heilmittel-Fachbereiche

### DAVASO = IQVIA Health System Services (19.03.2026'dan beri)
- **Kural:** `edi302@davaso.de` ve `edi302@iqvia-hss.de` aynı kurumun adresleridir;
  Kostenträgerdatei'de kurum adı dosya sürümüne göre `DAVASO` ya da `IQVIA HSS` görünebilir —
  IK `661430035` değişmedi ve eşleştirmede **IK esas alınır, ad değil.**
- **Kaynak:** kvbawue.de / kvn.de duyuruları (Mart–Mayıs 2026) + Kostenträgerdatei IDK satırları
- **Geçerlilik:** 19.03.2026'dan itibaren
- **Kodda:** `api-backend/billing/kostentraeger/parser.js` — ad üzerinden eşleştirme yapılmamalı
- **Kapsam:** tüm Fachbereiche

---

## Doğrulama kuyruğu

`gkv-302` ajanının ilk turlarında kapatılacak açık noktalar:

- [x] ~~Podologie Blankoverordnung 40 hafta — §125a sözleşmesi yürürlükte mi?~~ **KAPANDI 2026-08-05:**
      sözleşme yok, 40 hafta ileriye dönük hüküm. Konsey kararı → guard eklenecek, tablo yapılmayacak.
- [ ] 🔴 **Ergotherapie Blanko desteklenmiyor** — sözleşme 01.04.2024'ten beri var, kod reddediyor.
      `heilmittel-diagnoseliste.txt` Bölüm 2 Ergo listesi + Diagnosegruppe'ler okunmalı. **Gelir kaybı.**
- [ ] 🔴 **Podologie 78040 — 01.11.2023 Altbestand kapısı yok.** O tarihten önce podolojiye
      başlamış hasta 78040 hakkı kazanmaz; kod bunu bilmiyor ve izin veriyor → seri hâlinde
      Absetzung (22,48 € / 23,11 €). Yeni praxis'te geçmiş DB'de olmadığı için hastaya sorulup
      kalıcı işaretlenmeli (şema işi → db-ustasi).
- [ ] 🔴 **78040 praxis mi hasta mı — sözleşme metni iki okumaya açık.** Cevap 20.10.2023
      tarihli Änderungsvereinbarung / konsolide sözleşme § 3a'da; GKV-SV sunucusu PDF'i
      otomatik indirmeye vermiyor, **elle indirilip arşive konmalı.** O gelene kadar kod
      owner_id kapsamında (temkinli okuma) kalır.
- [x] 🟠 ~~**78100 takvim yılı sınırı uygulanmamış**~~ — **kapandı 03.09.2026.**
      `darf78100()` + `podErstbefundungGrossLage()`; 9 test.
- [x] 🟠 ~~**Erstbefundung seri/nagel sınırı yok**~~ — **kapandı 04.09.2026.**
      `prescriptions.nagel` (10 değerli CHECK) + `darfErstbefundungNagel()` +
      `podErstbefundungSerieLage()`; 13 test. Seri sonu 78520.
- [x] 🟡 ~~**Nagel, Abrechnung freigabe'sinde zorunlu değil**~~ — **kapandı 06.09.2026.**
      Kapı `api-backend/billing/api/verordnung-status.routes.js` →
      `fehlendePflichtangaben()`, `aktiv → abrechenbar` geçişinde. Backend'de, çünkü
      tarayıcıdaki riegel riegel değildir; DB CHECK'i olarak değil, çünkü o taramayı
      daha INSERT'te reddederdi (Unterschriftsfeld'deki aynı tuzak).
- [ ] 🟡 **Verordnungsbesonderheiten `2` (Schwangerschaft) ↔ Zuzahlungsbefreiung bağı
      doğrulanmadı** (Ops #290, 17.09.2026). §24c/§24d SGB V gebelik/doğum bağlamında
      Zuzahlung muafiyeti getiriyor mu, ve getiriyorsa `ZHE` alan 7 = `2` ile
      Zuzahlungskennzeichen (Anlage 3 §8.1.3) arasında zorunlu bir tutarlılık var mı —
      bu turda kaynaktan **hiç bakılmadı**. Koda girmeden önce SGB V + Anlage 1 Kap. 7
      (Zuzahlung) okunmalı; yanlış eşleme sessiz Absetzung üretir.
- [ ] 🟡 **Zahnärztliche Heilmittelverordnung (Verordnungsbesonderheiten `1`) hangi
      Muster'la geliyor?** (Ops #290, 17.09.2026) Muster 13 zahnärztlich değildir; Anlage 1
      V21 birkaç yerde „Bei Verordnungen durch Zahnärzte …" diyor ve Diagnosegruppe yerine
      **Indikationsgruppe** (ör. `CD2a`) istiyor. Hangi formun tarandığı ve OCR/maskenin
      bunu nasıl ayırt edeceği **incelenmedi**. Podoloji/Physio akışını bugün etkilemiyor.
- [ ] 28 gün başlama süresi — HeilM-RL § 15'ten teyit (şu an kaynak NOVENTI = ticari yayın)
- [ ] `blankoRules.js:124-132` — `ok !== true` iken bonuslar yine hesaplanıyor (`total_bonuses_eur`
      dolu dönüyor). Sessiz yanlış fatura riski.
- [ ] VKZ değerlerinin `billing/dta/` ve `billing/codes/` içinde doğru uygulanması
- [ ] `sync_heilmittel_katalog.js` ICD alan indekslerinin 28 alanlık yapıya uyumu
- [ ] Zuzahlung hesabının Anlage 1 V21 bölüm 7 ile uyumu
- [ ] Kostenträgerdatei/IK eşleme kuralları (Anhang 03 — dikkat: geçerli sürüm V10 değil, 01.02.2027'ye kadar önceki sürüm)
