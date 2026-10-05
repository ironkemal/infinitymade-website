# SPEC-RULES — Süzülmüş §302 / Heilmittel kuralları

> Kaynak belgelerden çıkarılmış, koda uygulanan/uygulanması gereken kurallar.
> **Amaç:** yüzlerce sayfalık spesifikasyonu her seferinde yeniden okumamak.
>
> Bu dosya kaynağın yerini **tutmaz**, ona **işaret eder.** Her kural üç şeyi taşımak zorunda:
> **kaynak + sürüm + kod satırı.** Bu üçlü olmadan kural yazılmaz — belge güncellendiğinde
> neyin yeniden kontrol edileceği belli olmaz.
>
> Sahibi: `gkv-302` ajanı · Arşiv haritası: `wissensbank/INDEX.md`
> Son güncelleme: 2026-09-29 (Reform S1.12 + S2 — `gkv-302` bulguları, `wissensbank` orijinallere
> karşı okudu. 3 yeni kural: Hausbesuch yalnız „Ja" ile (S2.6) · Abrechnung Verordnung bitince,
> VKZ 02 sonradan yapılan seans için DEĞİL (S2.3) · Datenaustausch durum terimleri (S2.1) ·
> IK des Leistungserbringers Muss (S2.7). **1 kayıt düzeltildi:** „Teilabrechnung normaldir;
> kalan birimler VKZ 02" — kaynağa aykırıydı, eski metin üstü çizili duruyor. „Testdatei ödeme
> tetiklemez" netleşti (yalnız Testindikator 0; Erprobung için kaynak yok). 78040/78030 seri
> sonucuna S1.12 eklendi, yeni kural açılmadı.)
> Önceki: 2026-09-29 (Reform S1.9, commit `dbd79f0` — 2 yeni kural: Podologie'de
> Behandlungsunterbrechung Verordnung'u geçersiz kılmaz (HeilM-RL § 16 Abs. 4 S. 5; FAK Nr. 11
> ters okunmuştu) · Behandlungsbeginn-Frist 28/14 gün (HeilM-RL § 15, Podologie Anlage 3 lit. e).
> Tüm alıntılar `wissensbank` tarafından orijinal .txt'lere karşı okundu. Açık: `frequenz-pruefung.js:66`
> yanlış § 16 Abs. 4 S. 5 atfı — Physio dalı.)
> Önceki: 2026-09-27 (Ops #303 Nachtrag — „Muster 13 en fazla 3 vorrangiges + 1
> ergänzendes" kuralı 3 noktada düzeltildi: § 12 Abs. 2 S. 1'in "katalog birden çok vorrangiges
> öngörüyorsa" koşulu eklendi, Logopädie'nin S. 2'si ayrı/farklı konulu kural olarak
> netleştirildi (ergänzendes Heilmittel Logo katalogunda yok), KVN Ausfüllhilfe Stand 10/2024
> kaynağı arşivde bulunamadığı için ⚠️ işaretlendi. gkv-302 bulgusu 21.09.2026, wortlaut
> 27.09.2026 orijinale karşı yeniden okundu.)
> Önceki: 2026-09-25 (Ops #304 — ICD→Diagnosegruppe, Podologie: 4 yeni kural
> (DG yalnız arztseitig · ZHE DG/„9999" · Diagnose Pflicht, ICD Klartext ile ikame edilebilir ·
> Diagnose düzeltmesi Einreichung'dan önce). `gkv-302` bulguları `wissensbank` vekili tarafından
> orijinal .txt'lere karşı okundu. Açık: `PFLICHT_ICD` Blocker'ı + „Anlage 3 k der HeilM-RL"
> kaynak atfı kod yorumlarında yanlış.)
> Önceki: 2026-09-21 (Ops #302 — „Komplexbehandlung" 78020'nin adı değil, verordnete
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
  girmeden önce § 15'ten teyit edilmeli. → ✅ 29.09.2026 teyit edildi: HeilM-RL § 15 Abs. 1 (`:678`), bkz. kural „Behandlungsbeginn-Frist". Blanko için ayrı kod yolu yok, `behandlungsbeginnFrist` ortak.

### Muster 13 en fazla 3 vorrangiges + 1 ergänzendes Heilmittel taşır — Podologie'de bölme hakkı yok
- **Kural:** Physio/Ergo'da Verordnungseinheiten je Verordnung max **3** farklı vorrangiges
  Heilmittel'e bölünebilir — **ama yalnızca** Heilmittelkatalog ilgili Diagnosegruppe'de zaten
  birden çok vorrangiges Heilmittel öngörüyorsa (§ 12 Abs. 2 S. 1 koşulu; katalogda tek
  vorrangiges varsa bölme diye bir şey yok). **Logopädie'de (Stimm-/Sprech-/Sprach-/
  Schlucktherapie) bu, ayrı ve farklı konulu bir kuraldır** (S. 2): orada bölünen "vorrangiges
  Heilmittel" değil, max 3 farklı Behandlungszeit veya Einzel-/Gruppenbehandlung
  kombinasyonudur — S. 1'in "sinngemäß" uzantısı değil. Buna ek olarak Physio/Ergo'da max **1**
  ergänzendes Heilmittel verordnet edilebilir (Abs. 3) → Muster 13 formunda toplam 4 satır.
  Logopädie'nin katalogunda ergänzendes Heilmittel **hiç yok** (0 Stelle — Physio 12, Ergo 6,
  nachgezählt 21.09.2026), yani Abs. 3 metin olarak Logopädie'yi dışlamasa da pratikte hiç
  uygulanmaz. **Podologie'de bölme hakkı YOKTUR** (§ 12 Abs. 2 Podologie'yi saymıyor) ve
  ergänzendes Heilmittel alanı (Anlage 3 g2) *"entfällt"* — Podologie = 1 vorrangig, 0 ergänzend.
- **Kaynak:** HeilM-RL 15.05.2025 (iK 05.08.2025) § 12 Abs. 2 Satz 1 — *"Bei Maßnahmen der
  Physiotherapie und der Ergotherapie können die Verordnungseinheiten je Verordnung auf
  maximal drei unterschiedliche vorrangige Heilmittel aufgeteilt werden, soweit der
  Heilmittelkatalog in der Diagnosegruppe mehrere vorrangige Heilmittel vorsieht."*; Satz 2 —
  *"In der Stimm-, Sprech-, Sprach- und Schlucktherapie können maximal drei verschiedene
  Behandlungszeiten oder Einzel- und Gruppenbehandlungen miteinander kombiniert werden."*; und
  Abs. 3 Satz 1 — *"Soweit medizinisch erforderlich, kann zu ‚vorrangigen Heilmitteln' maximal
  ein … ‚ergänzendes Heilmittel' verordnet werden."*
  (`wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt:555-568`,
  wortlaut 27.09.2026 erneut gegen Original gelesen); Podologie Anlage 3 i.d.F. 16.06.2025 Feld g2
  (`wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung.txt:465-473`). Ergänzendes'in
  Höchstmenge'si vorrangig'lerin toplamına bağlıdır: HeilM-RL § 7 Abs. 5 Satz 2-3 (`:419-426`).
  ⚠️ "Formteyidi KVN Ausfüllhilfe Muster 13, Stand 10/2024, Nr. 5" önceden ikincil kaynak olarak
  anılmıştı — bu belge `wissensbank`'ta YOK (21.09.2026 aranmış, bulunamamış), doğrulanmamış
  sayılır, üstteki HeilM-RL alıntısı tek bağlayıcı kaynaktır.
- **Geçerlilik:** 05.08.2025
- **Kodda:** uygulanmamış — `dashboard.html:3621/3625` tek `rzHm` + tek `rzHmErg` alanı;
  `prescriptions.heilmittel_items` (`db/SCHEMA.sql:2256`) liste taşıyabilir ama sayı kapısı yok.
  Ops #202 (Kategorie Physiotherapie — önceki "Podoloji" etiketi yanlıştı, bu kural onu düzeltti).
- **Kapsam:** Physiotherapie, Ergotherapie — vorrangige+ergänzende Heilmittel, Muster 13.
  Logopädie — yalnız Behandlungszeit/Einzel-Gruppe kombinasyonu (S. 2), ergänzendes Heilmittel
  kapsam dışı (katalogda yok). Podologie ve Blankoverordnung hariç (Blanko'da alana
  "BLANKOVERORDNUNG" basılır, Heilmittel/Einheit girilmez).
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
  (Migration `0039_seed_heilmittel_katalog_podo_komplex_suche.sql`); Verordnung tarafı
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

### Podologie: Behandlungsunterbrechung macht die Verordnung NICHT ungültig — keine 12-Wochen-Grenze
- **Kural:** Podolojide seanslar arasındaki kesinti — süresi ne olursa olsun — Verordnung'u
  **geçersiz kılmaz.** HeilM-RL § 16 Abs. 4'ün genel kuralı (Satz 1: gerekçesiz >14 Kalendertage
  kesinti → Verordnung düşer; Satz 2: gerekçeli kesinti Verordnung'a yazılır) Podologie'ye
  **uygulanmaz** (Satz 5). Kesinti Verordnung'a dokümante edilmek zorunda da değildir.
  Yazılım podolojide kesinti yüzünden ne blok ne "ungültig" uyarısı üretir; ±2 Werktage
  frekans sapması uyarısı (FAK Nr. 11 ilk cümlesi) bundan ayrıdır ve uyarı olarak kalır.
- **Kaynak:** HeilM-RL i.d.F. 15.05.2025 (iK 05.08.2025) § 16 Abs. 4 Satz 5 — *„Abweichend von
  Satz 1 und 2 führen Behandlungsunterbrechungen bei Maßnahmen der Podologischen Therapie sowie
  der Ernährungstherapie nicht zur Ungültigkeit der Verordnung."*
  (`wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt:698-704`,
  S. 17 — Satz 1/2 `:698-700`, Satz 5 `:702-704`; kapak „in Kraft getreten am 5. August 2025"
  `:14`). Tamamlayıcı, norm değil: GKV-SV FAK Podologie Stand 24.05.2023 Nr. 11 — *„Wird die
  Behandlung kürzer als 12 Wochen unterbrochen (z.B. wegen Krankheit oder Urlaub), bleibt die
  Verordnung gültig. Unterbrechungen brauchen nicht auf der VO dokumentiert werden. (vgl. § 16
  Abs. 4 Satz 5 Heilmittel-Richtlinie)"* (`wissensbank/podologie/20230524_Podologie_FAK_bf.txt:92-110`)
  · Nr. 34 (Therapiefrequenz Nagelspangenbehandlung) — *„Verliert eine Verordnung auch dann ihre
  Gültigkeit, wenn zwischen zwei Spangenanlagen zwar mehr als 12 Wochen liegen, in der
  Zwischenzeit (z. B. nach 6 Wochen) aber eine Kontrolle stattfand? …"* → *„Nein"* (`:295-303`).
  Tüm satırlar 29.09.2026'da orijinale karşı okundu.
- ⚠️ **Ters okuma tuzağı (eski hata, `dbd79f0`'da düzeltildi):** FAK Nr. 11 yalnız "<12 hafta →
  geçerli kalır" der; **">12 hafta → geçersiz"** demez. Bunu çıkarımla 84 günlük geçersizlik
  sınırına çevirmek HeilM-RL Satz 5'e aykırıdır — FAK'ın kendisi Satz 5'e atıf yapıyor ve
  Satz 5'te süre yok. Nr. 34 ">12 hafta"da da geçersizliği reddediyor; ancak soru araya
  Kontrolle girmiş vakayı soruyor, "Kontrolle olmadan da Nein" diye **ayrıca** yazmıyor —
  dayanak her durumda FAK değil Satz 5'tir.
- **Geçerlilik:** 05.08.2025 (HeilM-RL Fassung 15.05.2025) · FAK Stand 24.05.2023
- **Kodda:** ✅ `module/frequenz-pruefung.js:263` `pruefeFrequenz` → `:273` `istPodo` →
  `:325` `bewerteAbstand(kt, wt, soll, !istPodo)`; `bewerteAbstand` `:230-231`
  (`pruefeUnterbrechung=false` iken `'unterbrechung'` hükmü hiç verilmez). Commit `dbd79f0`
  (Reform S1.9, 29.09.2026). Test: `module/frequenz-pruefung.test.js`.
  - ⚠️ **Yanlış atıf kaldı (`offen`, sahip `builder` — Physio ince ayarı, Ops → Teknik):**
    `module/frequenz-pruefung.js:66` `UNTERBRECHUNG_TAGE = 12 * 7; // § 16 Abs. 4 Satz 5 HeilM-RL`
    — Satz 5 süre içermez (podoloji istisnasıdır), 84 gün **hiçbir** HeilM-RL satırında yok.
    Sabit bugün yalnız Physio/Ergo/Logo dalında çalışıyor; oranın dayanağı Satz 1 =
    **14 Kalendertage ohne angemessene Begründung**'dur (`:698-699`), 12 hafta değil. Kod
    yorumu (`:43-51`) bunu "Physio-Feinabstimmung'a ertelendi" diye kaydetmiş; `:66`'daki
    atıf düzeltilmemiş. Podolojiyi etkilemez.
- **Kapsam:** Podologie (DF/NF/QF/UI1/UI2 — Nagelspange dahil). Ernährungstherapie de Satz 5
  kapsamında (bizim kapsam dışı). Physio/Ergo/Logo: **§ 16 Abs. 4 Satz 1-2 geçerli**, bu kural
  onlara taşınmaz.

### Behandlungsbeginn-Frist: 28 Kalendertage, dringlich 14 — kaçarsa Verordnung geçersiz
- **Kural:** Tedavi Verordnungsdatum'dan itibaren **28 Kalendertage** içinde başlamalıdır;
  Verordnung'da **dringlicher Behandlungsbedarf** işaretliyse **en geç 14 Kalendertage**.
  Süre içinde başlanamazsa Verordnung **Gültigkeit'ini kaybeder**. Dringlich işaretini yalnız
  hekim, yeni imza + tarihle kaldırabilir; o zaman 28 gün geçerlidir.
- **Kaynak:** HeilM-RL i.d.F. 15.05.2025 (iK 05.08.2025) § 15 Abs. 1-2 — *„(1) 1Die Behandlung
  hat innerhalb von 28 Kalendertagen nach Verordnung zu beginnen. 2Liegt ein dringlicher
  Behandlungsbedarf vor, hat die Behandlung spätestens innerhalb von 14 Kalendertagen zu
  beginnen. 3Dies ist auf der Verordnung kenntlich zu machen. (2) Kann die
  Heilmittelbehandlung in den genannten Zeiträumen nach Absatz 1 nicht aufgenommen werden,
  verliert die Verordnung ihre Gültigkeit."*
  (`wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt:677-682`,
  S. 17) · Podologie Anlage 3 i.d.F. 16.06.2025 lit. e „Dringlicher Behandlungsbedarf"
  (`wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung.txt:390-414`, S. 11) —
  *„Ist das Feld dringlicher Behandlungsbedarf angekreuzt, muss die Behandlung innerhalb von
  14 Kalendertagen beginnen. In allen anderen Fällen muss die Behandlung innerhalb von 28
  Kalendertragen* [sic] *nach dem Verordnungsdatum begonnen werden. Wird der ärztlicherseits
  angegebene dringliche Behandlungsbedarf nicht beachtet, verliert die Verordnung ihre
  Gültigkeit. Der dringliche Behandlungsbedarf kann nur von der Ärztin oder dem Arzt mit
  erneuter Arztunterschrift und Datumsangabe aufgehoben werden, es gilt dann der
  Behandlungsbeginn von 28 Kalendertagen."* Tüm satırlar 29.09.2026'da orijinale karşı okundu.
- ⚠️ **İnce fark — "wortgleich" değil:** Anlage 3 lit. e geçersizlik sonucunu **açıkça yalnız
  dringlich** için yazıyor; 28 günlük normal süre için yalnız „muss" diyor. 28 gün aşımında
  geçersizliğin dayanağı **HeilM-RL § 15 Abs. 2**'dir. Sonuç aynı, ama itirazda atıf
  HeilM-RL'ye yapılır. (`module/heilmittel-fristen.js:26-28` yorumu Anlage 3'ün § 15'i
  "wortgleich" tekrarladığını söylüyor — tam doğru değil, davranışı etkilemez.)
- **Geçerlilik:** 05.08.2025 (HeilM-RL) · 16.06.2025 (Anlage 3 Podologie)
- **Kodda:** ✅ `module/heilmittel-fristen.js:41` `BEHANDLUNGSBEGINN_TAGE = { dringend: 14,
  normal: 28 }` · `:52` `behandlungsbeginnFrist(ausstellungsdatum, istDringend)` (→
  `prescriptions.gueltig_bis`, `dashboard.js:15834`) · `:80` `pruefeBehandlungsbeginn` (saf,
  Europe/Berlin gün sayımı) · `module/frequenz-pruefung.js:361-374` `pruefeErsttermin` —
  **yalnız podo, yalnız ilk vergeben Termin'de, `behandlungsbeginn` boşken** → blok
  (`dashboard.js:5805-5808` Termin-Fenster, `:6776` KI-Serienbestätigung). Commit `dbd79f0`
  (Reform S1.9). Diğer okuyucular (uyarı/gösterim): `module/verordnung-podo.js:615`,
  `module/verordnung-pruefung.js:304`, `module/podologie-abrechnung.js:574,1036`,
  `dashboard.js:7973,19659`. Test: `module/heilmittel-fristen.test.js`,
  `module/frequenz-pruefung.test.js:317-419`.
  - 📌 `pruefeErsttermin` `ownerId` yoksa (`:367`) sessizce `ok:true` döner — iki çağıran da
    `getOwnerId()` veriyor, bugün zararsız (`unkritisch`); yeni çağıran eklenirse bakılmalı.
  - 📌 Frist (gueltig_bis hesabı) tüm Fachbereich'lerde, **blok** yalnız podolojide —
    Physio/Ergo/Logo'da blok, vertikal sıralama gereği bilinçli olarak ertelendi.
- **Kapsam:** § 15 genel kısımdadır → **tüm Heilmittel-Bereiche**. Blok uygulaması bugün:
  Podologie. Blankoverordnung için de aynı § 15 geçerlidir (yukarıdaki NOVENTI kuralının
  bağlayıcı teyidi budur).

### Podologie: Arzt-Nr. oder Arztstempel/Unterschrift fehlt → Behandlung darf nicht beginnen; BSNR fehlt → übernehmbar, Warnung
- **Kural:**
  - **Arzt-Nr.** (Ziffer 5 a): fehlen Versichertenangaben, Kostenträger, *„Angaben zur
    verordnenden Ärztin oder zum verordnenden Arzt (Arzt-Nr.) oder das Ausstellungsdatum"*,
    *„kann die Behandlung nicht begonnen werden."* Korrektur *„ausschließlich arztseitig mit
    erneuter Arztunterschrift und Datumsangabe"*; Muster 13E: *„eine nachträgliche Korrektur
    nicht möglich, es ist eine neue Verordnung auszustellen"*; *„vor Einreichung"*.
  - **Stempel + Unterschrift:** Die Behandlungsbeginn-Sperre dafür steht in **Ziffer 3**, nicht
    in n): Behandlung *„kann jedoch begonnen werden, wenn"* u. a. *„Stempel und Unterschrift der
    Ärztin oder des Arztes"* vorhanden sind. Ziffer 5 n) regelt die **Gültigkeit**: *„nur
    gültig, wenn sie … unterschrieben und mit ihrem oder seinem Arztstempel versehen ist"*,
    Korrektur *„ausschließlich ärztlicherseits"*, vor Einreichung. Stempel gehört dazu, nicht
    nur die Unterschrift.
  - **BSNR:** *„Für die Felder ‚Status' und ‚Betriebsstättennummer' sind nachträgliche
    Korrekturen gemäß Ziffer 4 Absatz 2 möglich. Eine fehlende Betriebsstättennummer … kann vom
    zugelassenen Leistungserbringer für die Abrechnung aus dem Stempel … übernommen werden."*
    BSNR steht in der Beginn-Liste von a) **nicht** → kein Beginn-Hindernis.
  - **TA-Feld LANR** (ZHE, S. 69): zwingend aus der Verordnung, *„Das Auffüllen des Feldes auf
    9 Stellen ist unzulässig. Es sind nur die Ziffern 0 - 9 zu verwenden. Ist kein Wert
    vorhanden, ist das Feld mit ‚999999999' zu übermitteln, sofern keine anderweitigen
    Regelungen bestehen"*; Zahnarzt-Nr. bei zahnärztlicher VO. **BSNR** (ZHE, S. 68): ebenso
    Ersatzwert 999999999. Eine LANR-Prüfziffernprüfung verlangt die TA nicht („Prüfziffer" =
    0 Treffer im Volltext V21) → Prüfziffer-Fehler = Warnung.
- ⚠️ **Çıkarım (norm değil):**
  - „BSNR fehlt → **nur** Warnung": Ziffer 4 Abs. 2 heißt: Kasse *„setzt die Verordnung ab"*,
    gibt einmalig Korrekturmöglichkeit, 3 Monate. Beginn-Hindernis yok, ama **Absetzung-Risiko
    var** — uyarı „aus Arztstempel übernehmen" önerisiyle verilmeli, sessiz geçilmemeli.
  - „Podo Anlage 3 a) ist eine *anderweitige Regelung* zum Ersatzwert": metin bunu söylemez.
    Doğru okuma: a) Beginn'i engeller, TA-Feldregeli değiştirmez; pratikte Arzt-Nr.'siz bir
    Podo-VO hiç tedavi edilmeyeceği için Ersatzwert'e gelinmemeli. Ersatzwert'in Podo'da
    görünmesi = Urbeleg kontrolü uyarısı (bugünkü D:01003 davranışı).
- **Kaynak:** Podologie Anlage 3 i.d.F. 16.06.2025
  (`wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung.txt`) Ziffer 3 (`:69-83`, S. 3) ·
  Ziffer 5 a) (`:257-280`, S. 8; Korrekturzeitpunkt + BSNR `:284-308`, S. 9) ·
  Ziffer 5 n) (`:618-626`, **S. 17** — ilk taslakta „S. 16" yanlıştı) · Ziffer 4 Abs. 2 (`:102-112`) ·
  Anlage 1 TP5 V21 (Stand 15.01.2026) Kap. 5.5.3.3 SLLA B ZHE: BSNR S. 68
  (`wissensbank/gemeinsam/302-tp5/Anlage_1_TP5_V21_20260115.txt:3237-3250`), LANR S. 69 (`:3266-3295`)
- **Geçerlilik:** 16.06.2025 (Podo Anlage 3) / 01.10.2025 (TA V21)
- **Kodda:** açık — Reform **S3.7** (Formular-/„Bereit"-Sperre bei fehlender LANR oder
  Stempel/Unterschrift; bugün `confirm()`-Override). DTA-Seite bereits TA-konform:
  `api-backend/billing/dta/preflight.js:297-310` (Format = Fehler D:01001, Ersatzwert = Warnung
  D:01003, Prüfziffer = Warnung). Zincir: `REGISTER.md` Z-18.
- **Kapsam:** Beginn-Sperre Podologie (Anlage 3); TA-Feldregel alle Heilmittel

---

### Podologie: Hausbesuch (79933 / 79934) yalnız Verordnung'da „Ja" işaretliyse faturalanır
- **Kural:** Hausbesuch-Position yalnız Muster 13'teki Hausbesuch alanında **„Ja"** işaretliyse
  abrechenbar'dır. **„Nein" işaretli ya da alan boş** → Hausbesuch faturalanamaz (**sert blok**).
  Verordnung'un kendi geçerliliği bundan **etkilenmez** — Behandlung'lar normal faturalanır.
  „Ja"'ya düzeltme **yalnız hekim** yapar, **yeni imza + tarih** ile, ve **Einreichung'dan
  önce**. Praxis bu alanı kendisi düzeltemez, „Information an den Arzt" yolu yoktur.
- **Kaynak:** Podologie Anlage 3 i.d.F. **16.06.2025** lit. c) „Hausbesuch"
  (`wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung.txt:357-370`, S. 10) —
  *„Art der Angabe: Konditionale Pflichtangabe · Erläuterung: Ein Hausbesuch kann nur
  abgerechnet werden, wenn das Feld „Ja" angekreuzt ist. · Korrekturmöglichkeit: Ist das Feld
  „Nein" angekreuzt oder fehlt die Angabe, ist die Abrechnung eines Hausbesuches nicht möglich;
  die Gültigkeit der Verordnung ist nicht berührt. · Korrekturzeitpunkt: Eine Änderung auf „Ja"
  kann ausschließlich arztseitig mit erneuter Arztunterschrift und Datumsangabe erfolgen. Die
  Korrektur muss vor Einreichung der Verordnung zur Abrechnung erfolgt sein."*
  Teyit: HeilM-RL i.d.F. 15.05.2025 (iK 05.08.2025) Anlage 3 „Anforderungen zur Änderung von
  Heilmittelverordnungen" — satır *„c. Hausbesuch bei Änderung auf „ja" X"* sütun „Änderung nur
  mit erneuter Unterschrift des Verordners und Datumsangabe"
  (`wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt:2315-2349`).
  Verordnungsfähigkeit: HeilM-RL § 11 Abs. 1 S. 2-3 (`:523-528`) — yalnız tıbbi gerekçeyle;
  *„Die Behandlung in einer Einrichtung … allein ist keine ausreichende Begründung"*.
- **HPNR:** 79933 = *„Hausbesuch, ärztlich verordnet, inkl. Wegegeld"* · 79934 = *„Hausbesuch
  in soz. Einrichtung, inkl. Wegegeld"* — HPNR-Verzeichnis gültig ab 01.01.2026
  (`wissensbank/gemeinsam/positionsnummern/Positionsnummernverzeichnis_2026_Full.csv:1814,1823`;
  `wissensbank/podologie/Podologie_Positionsnummern_2026_Filtered.csv:68-69`). Anlage 2 i.d.F.
  16.06.2025 lit. e) „Hausbesuche" (`20250617_Podologie_Anlage_2.txt:298-306`) — ⚠️ orada
  pdftotext tabloyu kaydırmış, **fiyatı bu .txt'den okuma** (kural 2; fiyat zinciri
  `preise_pruefen.mjs`).
- ⚠️ **Çıkarım — 79934:** Anlage 3 c) HPNR ayırmadan *„ein Hausbesuch"* diyor, 79934'ü ayrıca
  anan cümle arşivde **yok**. 79934 adıyla bir Hausbesuch olduğu için aynı kurala girdiği
  **çıkarımdır**. Ters okumaya da dayanak yok: HeilM-RL § 11 Abs. 2'nin *„ohne Verordnung eines
  Hausbesuches außerhalb der Praxis"* istisnası (`:529-537`) yalnız Tageseinrichtung'daki
  çocuk/gençler içindir ve Behandlungsort'u düzenler, Hausbesuch-Vergütung'unu değil.
- **Geçerlilik:** 16.06.2025 (Anlage 3 Podologie) · 05.08.2025 (HeilM-RL)
- **Kodda:** açık — Reform **S2.6** (sprint kaydı `PODOLOGIE_REFORM_SPRINT.md`). Kod satırı
  uygulanınca buraya yazılır.
- **Kapsam:** Podologie (Anlage 3 LEGS 71/72). HeilM-RL Anlage 3 satırı tüm Heilmittel-Bereiche
  için aynı.

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

### Podologie: 78030/78040 tedavisiz faturalanamaz (Reform S1.6, 28.09.2026)
- **Kural:** DF/NF/QF'te (a) 78030 içeren ama **aynı gün** 78010/78020 içermeyen tedavi günü →
  **sert blok**; (b) 78040 içeren ama reçetenin **hiçbir** gününde 78010/78020 olmayan reçete →
  blok, „Trotzdem übernehmen" ile atlanabilir; (c) 78040 tek başına bir günde, başka günde
  78010/78020 varsa → serbest. Tedavi listesi yalnız `['78010','78020']`. UI1/UI2 hariç.
- **Kaynak:** (a) FAK Podologie 24.05.2023 Nr. 6/7 (`wissensbank/podologie/20230524_Podologie_FAK_bf.txt`
  Z.42-47) — *"die Befundposition 78030 ist zu jeder der Abrechnungspositionen „Behandlung groß"
  oder „Behandlung klein" abrechenbar"*. (b) Anlage 1a i.d.F. 17.06.2024 Z.458-462
  (*"zusätzlich zur podologischen Behandlung"*) + Z.83-84 — **çıkarım**, açık yasak cümlesi yok;
  GKV-SV/ZFD teyidi gelene kadar atlanabilir tutuldu (gkv-302).
- **Kodda:** `api-backend/billing/dta/befundpauschale-regeln.js` (saf kural + test) →
  `api-backend/billing/api/abrechnung.routes.js` `create-podologie` sperren döngüsü;
  ön yüz aynası `module/abrechnung-auswahl.js` `podoBefundOhneBehandlung()`.
- **Kapsam:** Podologie, DF/NF/QF

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
- **Seri Termin'leri 78040'ı devralmaz (29.09.2026, Reform S1.12):** ilk Termin'in maskesinde
  78040 seçiliyse, seri üretimi onu Termin 2-6'ya **kopyalamaz**; Termin 2-6 78030 +
  78010/78020 alır. Dayanak yukarıdaki üç alıntının toplamıdır — *„einmalig"* (Z.460),
  *„vor der ersten Abgabe"* (Z.83) ve 78030'un *„im Vorfeld jeder Behandlung"* (Z.491-493) —
  „seri" kelimesi kaynakta geçmez, bu satır **sonuçtur**, ayrı bir hüküm değil. 78030'un
  UI1/UI2'de hiç olmaması: GKV-SV FAK Podologie Stand 24.05.2023 Nr. 6
  (`wissensbank/podologie/20230524_Podologie_FAK_bf.txt:42-49` — *„Ja, die Befundposition 78030
  ist zu jeder der Abrechnungspositionen „Behandlung groß" oder „Behandlung klein" abrechenbar.
  Eine Abrechnung ist bei Nagelspangenbehandlungen (Diagnosegruppen UI1 und UI2) nicht
  möglich."*; pdftotext Nr. 6/7 sütunlarını iç içe basmış, cevap Nr. 6 sorusuna aittir).
- **Kaynak:** Anlage 1a i.d.F. 17.06.2024 Teil 1 Nr. 2 (Z.80-84) + Teil 2 Ziff. 4.1 (Z.458-462)
  / 4.2 (Z.491-493) — 29.09.2026'da satırlar yeniden okundu
- **Geçerlilik:** 01.11.2023'ten beri
- **Kodda:** `module/podologie-abrechnung.js:396-420` (otomatik işaretleme) +
  `:1198-1246` (doğrulama). Seri devri: açık — Reform **S1.12** (bulgu 1.12: 78030 seride
  önceden seçili geliyordu; kod satırı uygulanınca buraya yazılır)
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

### Podologie: Diagnosegruppe yalnız hekim tarafından değiştirilir — yazılım yalnız boş alanı doldurur
- **Kural:** Diagnosegruppe Muster 13'te **Pflichtangabe**'dir ve *„kann nur arztseitig mit
  erneuter Arztunterschrift und Datumsangabe ergänzt oder geändert werden."* Praxis/yazılım
  hekimin yazdığı DG'yi ICD'den türetilen bir DG ile **ezemez**; ICD→DG otomatiği yalnız boş
  alan için bir **öneridir**, Verordnung'da ne yazıyorsa o esastır. Korrektur zamanı (DG):
  *„Nachträgliche Korrekturen sind gemäß Ziffer 4 Absatz 2 möglich"* — yani Abrechnung'dan
  **sonra** da: kasa absetzt eder, bir kez düzeltme imkânı verir, 3 ay içinde gelmezse Absetzung
  kalır (Ziffer 4 Abs. 2). ⚠️ ICD/Diagnose (Ziffer 5 k) için bu **geçmez** — bkz. aşağıdaki kural.
- **Kaynak:** Podologie Anlage 3 i.d.F. 16.06.2025 Ziffer 5 j
  (`wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung.txt:512-519`, S. 14;
  Korrekturzeitpunkt `:528-529`, S. 15) + Ziffer 4 Abs. 2 (`:102-112`) · HeilM-RL 15.05.2025
  (iK 05.08.2025) Anlage 3 Zeile *„j. Diagnosegruppe"* — Kreuz in Spalte *„Änderung nur mit
  erneuter Unterschrift des Verordners und Datumsangabe"*
  (`wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt:2373`,
  S. 58) · § 13 Abs. 1 Satz 3 (`:608-609`)
- **Geçerlilik:** 16.06.2025 (Anlage 3) / 05.08.2025 (HeilM-RL)
- **Kodda:** ✅ `module/icd-dg-verdrahtung.js:73` `verdrahteIcdDg` (26.09.2026'ya kadar `dashboard.js` `_wireDgIcdPair`) → `_setDgProgrammatically` (`:92`)
  yalnız boş alanı veya kendi önceki önerisini (`dataset.dgAuto`) değiştirir ·
  `icd-dg-match.js:243` `dgVorschlag` — birden çok DG adayı varsa `auto = null` (yorum `:266-269`).
  Ops #304, 25.09.2026 (çalışma kopyasında, commit edilmemiş haliyle okundu).
- **Kapsam:** Podologie, tüm Diagnosegruppen; HeilM-RL kısmı tüm Heilmittel-Bereiche

### Podologie: Diagnose Pflichtangabe'dir — ICD-Kode değil, Klartext yeterli (UI1/UI2: L60.0 maßgeblich, Klartext ungeklärt)
- **Kural:** Behandlungsrelevante Diagnose **Pflichtangabe**'dir; *„Die Angabe der
  therapierelevanten Diagnose muss in Form eines oder mehrerer ICD-10-Schlüssel und/oder als
  Klartext erfolgen. Der ICD-10-Klartext kann ergänzt oder durch einen Freitext ersetzt
  werden."* Yani podolojide **ICD-Kode tek başına zorunlu değil, Diagnose zorunlu.**
  Therapierelevanz: a) DF → Diabetisches Fußsyndrom veya diabetische Neuropathie; b) NF/QF →
  sensible/sensomotorische Neuropathie veya Querschnittsyndrom; c) *„In den Diagnosegruppen UI1
  und UI2 ist ausschließlich der ICD-Schlüssel L60.0 maßgeblich, bei anderen Diagnosen ist eine
  Korrektur erforderlich."* Ek ICD/Freitext *„für die Gültigkeit der Verordnung unschädlich."*
  DTA: ICD yoksa `DIA.Diagnosetext` doldurulur.
- **Kaynak:** Podologie Anlage 3 i.d.F. 16.06.2025 Ziffer 5 k
  (`wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung.txt:531-537` Pflicht + Form,
  `:539-555` a–c, `:557-562` „unschädlich", S. 15) · HeilM-RL 15.05.2025 (iK 05.08.2025)
  § 13 Abs. 2 Satz 3 k (`…/HeilM-RL_2025-05-15_iK-2025-08-05.txt:625-628`, S. 15) ·
  Anlage 1 TP5 V21 Kap. 5.5.3.3 SLLA B, DIA, S. 72
  (`wissensbank/gemeinsam/302-tp5/Anlage_1_TP5_V21_20260115.txt:3492-3505`: *„Ist im Feld
  ‚Behandlungsrelevante Diagnose(n)' bzw. ‚ICD-10-Code' kein ICD-10-Code eingetragen, ist der
  Diagnosetext anzugeben."*) · FAK Podologie Stand 24.05.2023 Nr. 1
  (`wissensbank/podologie/20230524_Podologie_FAK_bf.txt:5-8`: Neuropathie *„in der Diagnose
  oder per ICD-10 Code"* yeterli) — FAK Vertragspartner yorumudur, norm değil.
- ⚠️ **HeilM-RL ile ince fark:** § 13 Abs. 2 k *„Die Diagnose ist grundsätzlich als
  ICD-10-Code anzugeben"* der; oradaki Freitext izni ICD'nin **Klartext'ini** değiştirir, kodun
  kendisini değil. ICD'siz, yalnız Klartext'li Verordnung'u geçerli kılan dayanak **Podologie
  Anlage 3 Ziffer 5 k**'dır („und/oder als Klartext"), HeilM-RL değil. UI1/UI2'de L60.0 dışındaki
  tanı düzeltme gerektirir; L60.0'ın yalnız Klartext'le („eingewachsener Nagel") karşılanıp
  karşılanmadığı metinde **açık değil** — ungeklärt.
- **Geçerlilik:** 16.06.2025 (Anlage 3) / 05.08.2025 (HeilM-RL) / 01.10.2025 (Anlage 1 V21)
- **Kodda:**
  - ✅ `api-backend/billing/dta/preflight.js:324-345` — ICD **veya** Diagnosetext (V:01015 ikisi
    de yoksa) · `api-backend/billing/dta/builder.js:222-235` — ICD yoksa DIA yalnız Diagnosetext ile
  - ❌ **Çelişki (Befund, düzeltilmedi):** `module/verordnung-pruefung.js:181-184` Podologie'de
    ICD yoksa **Blocker** `PFLICHT_ICD` üretir (profil `pflichtIcd: true`,
    `module/verordnung-regeln.js:129,143`). Klartext-Diagnose'lu geçerli bir Verordnung'u bloke
    eder; sözleşmeye göre en fazla UI1/UI2 için savunulabilir.
  - ⚠️ **Korrekturbedürftige Prämisse in Kommentaren:** `icd-dg-match.js:60` + `:193`,
    `api-backend/ai/validators/icdDgRules.js:10-11` + `:71`, `api-backend/billing/api/abrechnung.routes.js:3012-3013`
    + `:3247-3248`, `preflight.js:331` — hepsi *„ICD nicht Pflicht (Anlage 3 k der HeilM-RL)"* der.
    Sonuç (kod zorunlu değil) Podologie için doğru, ama **kaynak yanlış** (HeilM-RL Anlage 3 k
    yalnız „Änderung nur mit Unterschrift" der; doğru yer Podologie-Vertrag Anlage 3 Ziffer 5 k)
    ve eksik: **Diagnose** Pflicht'tir, UI1/UI2'de L60.0 maßgeblich.
- **Kapsam:** Podologie (DF/NF/QF/UI1/UI2); DTA-DIA kuralı tüm Heilmittel

### Podologie: Diagnose/ICD düzeltmesi yalnız hekimle ve Einreichung'dan ÖNCE
- **Kural:** Diagnose eksikse veya *„erkennbar nicht therapierelevant"*se *„mit einer erneuten
  Arztunterschrift und Datumsangabe zu ergänzen oder zu korrigieren"*; *„Erforderliche
  Korrekturen und/oder Ergänzungen müssen vor Einreichung der Verordnung zur Abrechnung mit der
  Krankenkasse erfolgt sein."* DG'den (Ziffer 5 j) farklı olarak Ziffer 4 Abs. 2'deki
  Abrechnung-sonrası düzeltme yolu **yok** — hata DTA'dan önce yakalanmalı.
- **Kaynak:** Podologie Anlage 3 i.d.F. 16.06.2025 Ziffer 5 k
  (`wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung.txt:563-566`, S. 15;
  Korrekturzeitpunkt `:575-577`, S. 16) · HeilM-RL 15.05.2025 (iK 05.08.2025) Anlage 3 Zeile
  *„k. konkrete(n) behandlungsrelevante(n) Diagnose(n)"* — Spalte „nur mit erneuter
  Unterschrift … und Datumsangabe" (`…/HeilM-RL_2025-05-15_iK-2025-08-05.txt:2374-2375`, S. 58)
- **Auslegung (Norm değil):** FAK Podologie Stand 24.05.2023 Nr. 28
  (`wissensbank/podologie/20230524_Podologie_FAK_bf.txt:232-244`): ICD Indikation'u yeterince
  göstermiyor veya yanlışsa Verordnung *„nur dann gültig, wenn eine gemäß Heilmittel-Richtlinie
  einschlägige therapierelevante Diagnose im Freitext angegeben ist."* — **Zamanlama hakkında
  değil**, Freitext'in yanlış ICD'yi „kurtarabildiği" hakkındadır.
- **Geçerlilik:** 16.06.2025 (Anlage 3) / 24.05.2023 (FAK)
- **Kodda:** Einreichung-öncesi kapı `api-backend/billing/dta/preflight.js:324-345` (ICD veya
  Diagnosetext var mı) — **therapierelevanz** (ICD↔DG uyumu) yalnız uyarı:
  `api-backend/ai/validators/icdDgRules.js` (Warnungen, `hard_before_dta` opsiyonel), frontend
  `module/icd-dg-verdrahtung.js:73` `verdrahteIcdDg`. Uyumsuzluğun DTA'dan önce sert kesilip kesilmeyeceği
  ürün kararıdır (Ops #304).
- **Kapsam:** Podologie

### Podologie UI1/UI2: L60.0 varsa ek ICD zararsızdır — düzeltme yalnız L60.0 YOKSA
- **Kural:** *„In den Diagnosegruppen UI1 und UI2 ist ausschließlich der ICD-Schlüssel L60.0
  maßgeblich, bei anderen Diagnosen ist eine Korrektur erforderlich."* ile aynı Ziffer'in
  Korrekturmöglichkeit'i birlikte okunur: *„Weitere Angaben zur Schädigung in Form eines oder
  mehrerer ICD-10-Schlüssel oder eines Freitextvermerkes sind für die Gültigkeit der Verordnung
  unschädlich."* → „maßgeblich" belirleyici kodu söyler; **L60.0 + E11.74 (UI1/UI2) geçerlidir**,
  düzeltme gerekmez. Düzeltme (hekim, yeni imza + tarih, Einreichung'dan önce) yalnız L60.0 hiç
  yoksa. Sıra kuralı yok — L60.0'ın ilk sırada olması istenemez (`gkv-302`, 26.09.2026).
- **Kaynak:** Podologie Anlage 3 i.d.F. 16.06.2025 Ziffer 5 k c) + Korrekturmöglichkeit
  (`wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung.txt:552-562`, S. 15)
- **Geçerlilik:** 16.06.2025
- **Kodda:** ✅ `icd-dg-match.js:78` `matchIcdToDg` — kümede bir kod `icd_accept` tutarsa `ok`
  (L60.0 + E11.74 → UI1 `ok`, `dgSperrenFuerIcd` UI'yi kapatmaz; E11.74 tek başına → UI1/UI2 kapalı) ·
  ayna `api-backend/ai/validators/icdDgRules.js` `checkIcdDg` aynı sonucu verir (26.09.2026 denendi).
  Kod değişikliği gerekmedi.
- **Kapsam:** Podologie UI1/UI2

### Birden çok ICD: her biri ayrı DIA; Muster-13 maskesi iki kod saklar, üçüncüsü yalnız uyarılır
- **Kural:** Diagnose *„in Form eines oder mehrerer ICD-10-Schlüssel"* verilir; DTA'da DIA
  *„1 mal je Diagnose"*, *„immer der im Feld ‚Behandlungsrelevante Diagnose(n)' bzw. ‚ICD-10-Code'
  eingetragene ICD-10-Code"*. Orijinalde olup dosyada eksik ICD, Korrekturverfahren'de *„Fehlende
  Daten, die auf den Originalunterlagen vorhanden sind (z.B. ICD-10 Code)"* sayılır → üçüncü kodun
  iletilmemesi küçük ama gerçek bir Beanstandung riskidir. Verordnung yine de **geçerlidir** →
  kayıt engellenmez.
- **Kaynak:** Podologie Anlage 3 i.d.F. 16.06.2025 Ziffer 5 k (`…/20250617_Podologie_Anlage_3_Lesefassung.txt:533-537`)
  · HeilM-RL 15.05.2025 (iK 05.08.2025) § 13 Abs. 2 k (`…/HeilM-RL_2025-05-15_iK-2025-08-05.txt:625-628`)
  · Anlage 1 TP5 V21 Kap. 5.5.3.3 DIA (`wissensbank/gemeinsam/302-tp5/Anlage_1_TP5_V21_20260115.txt:3492-3500`)
  · Kap. 7 dipnot 2, S. 171 (`…:8318`)
- ⚠️ **Belgelenemedi:** Muster 13'teki ICD kod kutusu sayısı. Vordruck metni `praxiswissen-heilmittel.txt:2192`
  yalnız „Behandlungsrelevante Diagnose(n) / ICD-10 - Code" başlığını verir, kutu sayısını değil;
  KBV Vordruck-Erläuterungen Muster 13 `wissensbank/`'ta yok.
- **Karar (26.09.2026):** Saklama iki kodla kalır (`prescriptions.icd10`, `icd10_2`, DIA listesi
  `[icd10, icd10_2]`). Prod: 67 Verordnung'ta ikinci ICD 2 kez, üç+ kod hiç (26.09.2026 sayıldı).
  Üçüncü kod → kaydederken uyarı + Diagnosetext'e yazma önerisi. **Yeniden açma tetiği:** ilk gerçek
  3-kodlu Verordnung ya da bir kasanın eksik ICD Beanstandung'u → `db-ustasi` (dizi kolonu).
- **Kodda:** `module/icd-dg-verdrahtung.js:56` `icdAufZweiFelder` + `:137` `aufteilen` (iki kod →
  ikinci alana) · `:76` `icdMehrAlsEinKodeJeFeld` (`dashboard.js` `saveRezept` → „Trotzdem
  speichern?") · `api-backend/billing/api/abrechnung.routes.js:537` `icd10Liste` ·
  `api-backend/billing/dta/preflight.js` V:01002 / V:01014.
- **Kapsam:** tüm Heilmittel (DIA), Maske: Muster 13

### Podologie: ICD-Endständigkeit ist kein §302-Datei-Abweisungsgrund — maßgeblich ist „therapierelevant"
- **Kural:** DIA übernimmt *„immer der im Feld ‚Behandlungsrelevante Diagnose(n)' bzw.
  ‚ICD-10-Code' eingetragene ICD-10-Code"* — so, wie er auf der Verordnung steht. Die TA prüft
  in Prüfstufe 3 Schlüsselausprägungen *„im Hinblick auf das Schlüsselverzeichnis (Anlage 3)"*;
  ICD ist dort kein Schlüssel. Eine Endständigkeitsanforderung steht in **keinem** der Texte
  (Volltext-grep 29.09.2026: „endständig" = 0 Treffer in TA V21, Anlage 3 V21, HeilM-RL, Podo
  Anlage 3, FAK; „ICD" = 0 Treffer in Anlage 3 V21). Maßstab für Podologie ist Anlage 3
  Ziffer 5 k: therapierelevant = a) DFS oder diabetische Neuropathie, b) sensible/sensomotorische
  Neuropathie bzw. Querschnittsyndrom, c) UI1/UI2 ausschließlich L60.0. Fehlt die Diagnose oder
  ist sie *„erkennbar nicht therapierelevant"* → nur der Arzt, erneute Unterschrift + Datum,
  **vor Einreichung**.
- ⚠️ **Çıkarım (norm değil):** „nicht endständig → Warnung, kein harter Fehler" metnin
  **sessizliğinden** çıkarılan ürün sonucudur. Ve yalnız Prüfstufe 1-3 (Datei-Abweisung) için
  geçerli: Prüfstufe 4 *„kassenspezifisch"*, kassenübergreifend geregelt değil — tek bir kasa kendi
  Fachverfahren'inde endständig olmayan kodu yine bemängeln edebilir. „Kein Abweisungsgrund" ≠
  „keine Absetzung möglich".
- ⚠️ **Düzeltme (29.09.2026, `wissensbank`):** İlk taslaktaki örnek `E11.7-` sorunluydu.
  `E11.7-` başlığı *„Mit multiplen Komplikationen"* — ne DFS'yi ne diabetische Neuropathie'yi
  **deklare eder**; Ziffer 5 k a) tam olarak bunu ister (*„zumindest entweder das Diabetische
  Fußsyndrom oder eine diabetische Neuropathie deklariert"*). Yani `E11.7-` tek başına yalnız
  „nicht endständig" değil, therapierelevanz'ı da koddan **okunamaz**. „Erkennbar nicht
  therapierelevant" sayılıp sayılmadığı metinde açık değil — **ungeklärt, `gkv-302`'ye.**
  Uyarı metni hekime „E11.74 / E11.75 gemeint?" sorusunu yönlendirmeli; Freitext'te DFS/Neuropathie
  yazıyorsa FAK Nr. 28 (Auslegung, norm değil) Verordnung'u geçerli sayar.
- **ICD-10-GM 2026 olguları** (`icd10gm2026syst_kodes.txt` Feld 2: T = terminal, N = nicht
  terminal — `icd10gm2026syst_metadaten_liesmich.txt:144-146`): `E11.4-` N (`:2310`) ·
  `E11.7-` N (`:2319`) · `E14.7-` N (`:2412`) · `E11.74` T (`:2322`) · `E11.75` T (`:2323`) ·
  `E14.74` T (`:2415`) · `G62.9` T (`:3650`) · `L60.0` T (`:6260`).
- **Kaynak:** Anlage 1 TP5 V21 (Stand 15.01.2026) Kap. 5.5.3.3 SLLA B, DIA, S. 72
  (`wissensbank/gemeinsam/302-tp5/Anlage_1_TP5_V21_20260115.txt:3492-3505`) · Kap. 6.3
  Prüfstufe 3, S. 162 (`:7985-7994`) · Kap. 6.4 Prüfstufe 4 (`:7996-8003`) ·
  Podologie Anlage 3 i.d.F. 16.06.2025 Ziffer 5 k (`wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung.txt:531-566`,
  S. 15; Korrekturzeitpunkt `:575-577`, S. 16) · Ziffer 4 Abs. 4 (Arztkorrektur, `:122-131`) +
  Abs. 5 (per Fax, `:137-140`), S. 3-4 · HeilM-RL 15.05.2025 (iK 05.08.2025) Anlage 3 Zeile k,
  S. 58 (`wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt:2374-2375`) ·
  FAK Podologie 24.05.2023 Nr. 28 (`wissensbank/podologie/20230524_Podologie_FAK_bf.txt:232-244`, Auslegung)
- **Geçerlilik:** 01.10.2025 (TA V21) / 16.06.2025 (Podo Anlage 3) / ICD-10-GM 2026
- **Kodda:** Reform **S3.6** uygulandı — `api-backend/billing/dta/preflight.js:381-389` (V:01016 **uyarı**, tiresiz anahtar),
  seçimde yalnız **Hinweis** (`katalog-suche.js` `nichtEndstaendigHinweis`). Format kuralı: aşağıdaki ICD-tire girdisi.
  ✅ **Çelişki ÇÖZÜLDÜ 30.09.2026:** `PODOLOGIE_REFORM_SPRINT.md:155` S3.6 için **blok** diyordu; `gkv-302` kararı: **Warnung, blok değil** (V:01016). Blok yalnız V:01002 format hatasıdır ve tiresiz kod onu tetiklemez.
  Zincir: `REGISTER.md` Z-18.
- **Kapsam:** Ziffer 5 k Podologie'ye özgü; DIA-Übernahmeregel ve Prüfstufe-Aussage tüm Heilmittel

### Podologie DF/NF/QF: ICD-Satz ohne therapierelevanten Kode (terminal, z. B. L60.0 + DF) = Blocker vor Bereit/DTA — nicht beim Speichern
- **Kural:** Enthält der ICD-Satz einer DF/NF/QF-Verordnung **keinen** Kode, der die Indikation der
  DG deklariert (Status `mismatch`, nicht `unsicher`), und ist **kein Diagnosetext/Freitext**
  vorhanden, ist die Diagnose *„erkennbar nicht therapierelevant"* → Arztkorrektur (neue
  Unterschrift + Datum) **vor Einreichung** Pflicht; eine Nachkorrektur nach Ziffer 4 Abs. 2 gibt
  es für Ziffer 5 k nicht. → **Blocker** in Bereit + Server-Preflight; Speichern bleibt erlaubt
  (Verordnung muss erfassbar sein, um die Korrektur beim Arzt anzustoßen), Behandlung: Warnung.
  Mit Diagnosetext → nur Warnung + Bestätigung (FAK Nr. 28: Freitext kann einen unpassenden
  ICD heilen; Software kann Freitext nicht bewerten). `unsicher` (E1x.72/73) und nicht endständige
  Kodes (E11.7, S3.6/V:01016) bleiben Warnung. Mindestens ein passender Kode im Satz
  (L60.0 + E11.74 bei DF) = `ok`, Zusatzkodes *„unschädlich"*.
- **Kaynak:** Podologie Anlage 3 i.d.F. 16.06.2025 Ziffer 5 k a)/b) + Korrekturmöglichkeit +
  Korrekturzeitpunkt (`wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung.txt:531-577`,
  S. 15-16) · HeilM-RL 15.05.2025 (iK 05.08.2025) § 27 Abs. 1 Nr. 1/2
  (`…/HeilM-RL_2025-05-15_iK-2025-08-05.txt:1076-1091`) — ⚠️ Anlage 3 zitiert „§ 27 Absatz 1/2",
  gemeint ist inhaltlich Abs. 1 Nr. 1/2 · FAK Podologie 24.05.2023 Nr. 28 (`…FAK_bf.txt:232-244`,
  Auslegung) · Anlage 1 TP5 V21 Kap. 6.3/6.4 (`…Anlage_1_TP5_V21_20260115.txt:7985-8003`):
  kein Prüfstufe-1-3-Abweisungsgrund, Folge ist Prüfstufe-4-Absetzung der Verordnung.
- **Geçerlilik:** 16.06.2025 (Anlage 3) / 05.08.2025 (HeilM-RL) / 01.10.2025 (TA V21)
- **Kodda (30.09.2026, Oturum C):** ✅ DB `diagnosegruppen.icd_enforcement` DF/NF/QF =
  `hard_before_dta` (Migration `0047`) + Spiegel `api-backend/ai/validators/diagnosegruppen.json`.
  ✅ Server-Preflight `V:01018` (`api-backend/billing/dta/preflight.js`, Regel
  `icdDgPreflightBefund()` in `ai/validators/icdDgRules.js`): Fehler nur bei `mismatch` ohne
  Diagnosetext; DF/NF/QF mit Diagnosetext → Warnung; UI1/UI2 ohne Freitext-Ausweg — damit ist
  auch UI1/UI2 serverseitig erstmals gesperrt. ✅ Validator (`checkIcdDg`): Diagnosetext →
  weiche Warnung. ⏳ Frontend `module/verordnung-pruefung.js:238-242` Diagnosetext-Ausnahme +
  Bereit-Sperre: Oturum A.
- **Kapsam:** Podologie DF/NF/QF (UI1/UI2: bereits `hard_before_dta`, dort kein Freitext-Ausweg)

### Podologie: Leitsymptomatik ↔ Heilmittel-Abweichung = Warnung (Praxis korrigiert, ohne Arztunterschrift)
- **Kural:** Passt das verordnete Heilmittel zur DG (Katalog: DF a→Hornhautabtragung, b→Nagelbearbeitung, c→Komplexbehandlung), aber nicht zur angekreuzten Leitsymptomatik, ist die Leitsymptomatik „erkennbar falsch" → Praxis korrigiert im Einvernehmen mit dem Arzt ohne neue Unterschrift, auch nachträglich (Ziffer 4 Abs. 2). Kein Blocker; Position (78010) und Preis unverändert. Fehlende Leitsymptomatik = Blocker vor Bereit/DTA (TA: „0000" ohne Freitext = Dateiabweisung), außer UI1/UI2 (a/b aus DG ableiten).
- **Kaynak:** Podologie Anlage 3 i.d.F. 16.06.2025 Ziffer 5 g1 (:443-462) + l (:579-597) · HeilM-RL 15.05.2025 (iK 05.08.2025) Heilmittelkatalog DF (:3363-3381) + Anlage 3 Zeile l (:2376) · Anlage 1 TP5 V21 Kap. 5.5.3.3 S. 71 (:3412-3448) · Anlage 1a i.d.F. 17.06.2024 Z.198/280
- **Geçerlilik:** 16.06.2025 / 05.08.2025 / 01.10.2025
- **Kodda:** Preflight ✅ `api-backend/billing/dta/preflight.js` (V:01006/V:01011); Bereit-Sperre ✅ 30.09.2026 `fehlendeVerordnungsangaben()` in `api-backend/billing/api/verordnung-status.routes.js` (über `leitsymptomatikAlsBitmaske()`, UI1/UI2 ausgenommen); Leitsymptomatik↔Heilmittel-Warnung ✅ Frontend (`module/verordnung-pruefung.js` `heilmittelGegenLeitsymptomatik`, 047baab)
- **Kapsam:** Podologie DF/NF/QF

### Podologie: je Tag eine Behandlung; Nagelspange 78610 bis 2× je Tag
- **Kural:** Je Verordnung und Kalendertag ist nur EINE Behandlung (78010/78020) abrechenbar (HeilM-RL § 12 Abs. 8). Nagelspange UI1/UI2 (VO ab 01.10.2025): Einheit = 78610, max. 2 je Tag; 78620 ist Aufschlag (max. 2 je Termin), keine Einheit. „Bereit" setzt ≥ 1 abrechenbaren Behandlungstag voraus (nicht storniert UND 78010/78020/78610, gleicher Tag einmal) — Befund (78030/78040) oder Zuschlag allein zählt nicht. Die alten Nagelspangen-Kodes (78210/78220/78230/78300/78400) richten sich nach dem **Verordnungsdatum ≤ 30.09.2025**, nicht nach dem Behandlungsdatum (Anlage 2 § 2 b / § 3 b gibt ihnen sogar Preise ab 01.07.2026).
- **Kaynak:** HeilM-RL § 12 Abs. 8 · Podologie Anlage 2 § 2 b/c, § 3 b (gkv-302, 30.09.2026)
- **Geçerlilik:** 01.10.2025
- **Kodda:** ✅ 30.09.2026 Preflight `S:01013` + Bereit-Zählung, Regel `api-backend/billing/utils/behandlungstage.js` (Spiegel von `module/podo-behandlungstag-regel.js`). ⏳ Alt-Kodes: `api-backend/billing/codes/podologie_positions.js:41-49, 80-89` schließen noch per `ungueltig_ab` (Behandlungsdatum) — Umstellung auf Verordnungsdatum offen (niedrige Priorität). ⚠️ `billing/dta/befundpauschale-regeln.js` `TEDAVI_POSITIONEN` = 78010/78020 ohne 78610 — ob gewollt, klärt gkv-302.
- **Kapsam:** Podologie

### ICD sondaki "-" kodun parçası değildir — kaydederken ve DTA'da tiresiz
- **Kural:** ICD-10-GM katalogunda nicht endständige kodlar `E11.7-` gibi tireyle gösterilir; bu **tire kodun parçası DEĞİLDİR**.
  Verordnung'a (`prescriptions.icd10` / `icd10_2`) ve DTA'ya (DIA segmenti) **tiresiz** yazılır: `E11.7-` → `E11.7`. Dreistellige Kategorie: `E11.-` → `E11` (Punkt + Strich, Feld 7).
  Nicht endständig olması yalnız uyarıdır (V:01016) — asla format hatası (V:01002/V:01014). Katalogda arama için tireli form kalır (`icd10_titles.code`).
- **Kaynak:** ICD-10-GM 2026 Metadaten `icd10gm2026syst_metadaten_liesmich.txt:152-153` (Feld 6/7, Schlüsselnummer ohne Strich) ·
  `icd10gm2026syst_kodes.txt:2319` (`E11.7-` N) · Anlage 1 TP5 V21 Kap. 5.5.3.3 DIA, S. 72
  (`wissensbank/gemeinsam/302-tp5/Anlage_1_TP5_V21_20260115.txt:3478-3500`)
- **Geçerlilik:** ICD-10-GM 2026 / TA V21 ab 01.10.2025
- **Kodda:** kayıt: `icd-dg-match.js:40` `normalizeIcd` + `module/verordnung-maske.js` `nurIcdKode` (:615-621, `nutzlastAusMaske` :631) ·
  DTA savunma katmanı (eski tireli satırlar için): `api-backend/billing/utils/icd-code.js` (`icdOhneStrich`, tek ortak normalizer),
  `api-backend/billing/dta/preflight.js:99-104` `isValidIcd10` + `:381-389`, `api-backend/billing/dta/builder.js:237-242`,
  `api-backend/billing/api/abrechnung.routes.js:541-547, 2451, 3045-3074, 3369-3371` (mapper) ve `:3458-3462` (terminal sorgusu: `k` ve `k-` birlikte sorgulanır,
  harita tiresiz anahtarlı — yoksa V:01016 sessizce kaybolur).
- **Kapsam:** tüm Fachbereich; bugün yalnız podolojide tetikleniyor (`strict` ICD seçici). DB'deki eski tireli satırlar taşınmadı — DTA katmanı karşılıyor.

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

### ~~Podolojik DTA'da kısmi (Teilabrechnung) normaldir; kalan birimler VKZ 02 Nachforderung ile~~ — ⛔ korrigiert 29.09.2026
> **YANLIŞ — silinmedi, iz kalsın diye üstü çizili.** Gösterdiği kaynak (UE Korrekturverfahren
> Frage 1) bunun **tersini** söylüyor: VKZ 02 yalnız Ursprungsrechnung anında *zaten*
> Vergütungsanspruch doğmuş Leistung içindir. „Teilabrechnung" kelimesi arşivdeki hiçbir .txt'de
> geçmiyor. Doğrusu hemen aşağıdaki kayıtta.
- ~~**Kural:** Podolojik §302 dosyasının bir Verordnung'un TÜM birimlerini değil, o ana kadar
  dokümante edilmiş birimlerini içermesi (Teilabrechnung) normal ve beklenen bir durumdur —
  hata değildir. Kalan/sonradan erbracht edilen birimler ayrı bir dosyada
  **VKZ 02 (Nachforderung)** ile gönderilir.~~
- ~~**Kaynak:** Gemeinsame Umsetzungsempfehlungen zum Korrekturverfahren Heilmittel
  (13.02.2025), Frage 1~~
- ~~**Geçerlilik:** 01.10.2025~~
- ~~**Kodda:** `api-backend/billing/api/abrechnung.routes.js:2945-2963` Teilabrechnung'ı zaten
  üretiyor (yalnız storno edilmemiş, o ana kadar dokümante edilmiş Behandlungen'i topluyor),
  ama VKZ 02 ikinci-tur (Nachforderung) yolu **HENÜZ YOK** — açık iş, Adım 1.6/sonrası.~~
- ~~**Kapsam:** Podologie~~

### Podologie: Abrechnung Verordnung bittikten sonra — VKZ 02 fatura SONRASI yapılan seans için DEĞİL
- **Kural:** Bir Verordnung **bittikten sonra, bir kez** faturalanır. „Bitti" = verordnete
  Behandlungsmenge tamamlandı, **ya da** erken bitirildi: o zaman Verordnung'a
  **Behandlungsabbruch tarihi** yazılır (konditionelle Pflichtangabe). Nagelspange'de
  Therapieziel erken ulaşılırsa bu Abbruch **değil**, reguläres Ende'dir. VKZ 02
  (Nachforderung) yalnız, Ursprungsrechnung (VKZ 01) kesildiği anda **zaten Vergütungsanspruch
  doğmuş ama faturada unutulmuş** Leistung içindir (tipik örnek: unutulmuş Hausbesuch).
  Faturadan **sonra** yapılan seans o anda anspruch'suzdu → VKZ 02 ile **istenemez**. Yani
  „şimdiye kadarki seansları faturala, kalanı sonra VKZ 02 ile" akışının kaynakta dayanağı yok.
- **Kaynak:**
  - Richtlinien nach § 302 Abs. 2 SGB V i.d.F. **20.11.2006** § 7 Abs. 1
    (`wissensbank/gemeinsam/302-tp5/Richtlinien-Text_061120.txt:249-255`) — *„Soweit die
    Leistung/en gemäß der vertragsärztlichen Verordnung … vollständig erbracht wurde/n,
    ist/sind sie - soweit in Verträgen nichts anderes geregelt ist - einmal monatlich je
    Leistungserbringer-Institutionskennzeichen mit der Krankenkasse abzurechnen"*
  - Podologie Anlage 3 i.d.F. **16.06.2025** lit. p) „Rechnungsdaten"
    (`wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung.txt:689-694`) — *„Hier sind
    vom Leistungserbringer nach Beendigung der entsprechenden Verordnung die notwendigen
    Angaben zur Abrechnung der jeweiligen Verordnung einzutragen."*
  - aynı belge lit. q) „Behandlungsabbruch" (`:708-721`) — *„Konditionelle Pflichtangabe ·
    Wird die Behandlung vor Erreichen der verordneten Behandlungsmenge abgebrochen, ist dies
    mit dem Datum des Behandlungsabbruches zu vermerken. Wird im Verlauf einer
    Nagelspangenbehandlung das angestrebte Therapieziel vor der vollständigen Inanspruchnahme
    der verordneten Behandlungsmenge je Verordnung erreicht, ist die Therapie nach § 7 Abs. 2
    des Vertrags zu beenden. Die Behandlung ist dann regulär beendet, dies stellt keinen
    Therapieabbruch dar."* (pdftotext sütunları iç içe basmış; Korrekturmöglichkeit/-zeitpunkt
    = „Entfällt")
  - Gemeinsame Umsetzungsempfehlungen zum Korrekturverfahren Heilmittel Stand **13.02.2025**
    (in Kraft 01.10.2025) Frage 1
    (`wissensbank/gemeinsam/302-tp5/Gemeinsame_Umsetzungsempfehlungen_zum_Korrekturverfahren_Heilmittel_20250213.txt:77-91`)
    — *„darf immer dann eine Nachforderung (VKZ 2) stellen, wenn bei einer Ursprungsrechnung
    (VKZ 1) Leistungen nicht berechnet worden sind, für die jedoch bereits ein Anspruch auf
    Vergütung bestand. Dies schließt eine Ergänzung/Änderung rechnungsbegründender Unterlagen
    im Rahmen einer Nachforderung aus."* · Frage 2 (`:93-103`) — *„Fälle, bei denen die
    Originalverordnungen der Krankenkasse bereits vorliegen, da sie bei der Ursprungsrechnung
    bereits mit angeliefert wurden"* · Grundsatz-örneği (`:17`) *„Nachforderung (z.B.
    Hausbesuch wurde bei der Erstrechnung versehentlich vergessen)"*
- 📌 **Çıkarım (kaynakta tek cümle değil):** Frage 2'ye göre Originalverordnung Ursprungsrechnung
  ile kasaya gider; kâğıt Verordnung artık praxis'te olmadığından aynı Verordnung'a sonradan
  seans eklemek pratikte de mümkün değildir. Frage 1'in *„Ergänzung … rechnungsbegründender
  Unterlagen … ausgeschlossen"* cümlesi de sonradan imzalatılmış Bestätigungsfeld satırını
  dışlar.
- ⚠️ **Açık:** § 7 Abs. 1 *„soweit in Verträgen nichts anderes geregelt ist"* diyor. Podologie
  Rahmenvertrag § 125 Abs. 1 **ana metni** (i.d.F. 30.11.2020) arşivde **yok** — yalnız
  Anlagen + Änderungsvereinbarung var. Anlage 3 p) aynı yönde, ters hüküm görülmedi, ama ana
  metin okunmadan „Vertrag bunu değiştirmiyor" kesin değil. → Doğrulama kuyruğu (78040 § 3a
  için de aynı belge gerekli).
- **Geçerlilik:** 20.11.2006 (Richtlinien) · 16.06.2025 (Anlage 3) · 01.10.2025 (UE)
- **Kodda:** açık — Reform **S2.3** (Abrechnung onay modalı: Verordnung bitmediyse ya
  Behandlungsabbruch tarihi ya da bekle). Eski kaydın gösterdiği
  `api-backend/billing/api/abrechnung.routes.js:2945-2963` Teilabrechnung üretiyordu — bu turda
  satır **ölçülmedi**, S2.3'te builder doğrulasın. VKZ 02 yolu yazılırsa kapsamı yalnız
  „unutulmuş, anspruch'u fatura anında var olan" Leistung olmalı.
- **Kapsam:** Podologie (Anlage 3 p/q); § 7 Abs. 1 tüm „Sonstige Leistungserbringer"; UE tüm
  Heilmittel


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

### IK des Leistungserbringers Muss'tur, 9 hane — yoksa dosya üretilmez
- **Kural:** Leistungserbringer'in IK'sı (9 hane, numerik) SLLA-FKT ve SLGA-FKT'de **Muss**
  alanıdır; Selbstabrechner'da UNB S002 „Absender Datei" de aynı IK'dır (Abrechnungsstelle
  varsa UNB'ye onun IK'sı girer). IK yoksa ya da 9 hane değilse dosya **üretilmez** — Muss
  alan eksikliği Prüfstufe 2'de dosyanın tamamını düşürür (bkz. „Format hatası … DOSYANIN
  TAMAMINI düşürür").
- **Kaynak:** Anlage 1 TP5 **V21** (Stand 15.01.2026, anzuwenden ab 01.10.2025)
  (`wissensbank/gemeinsam/302-tp5/Anlage_1_TP5_V21_20260115.txt`):
  - § 5.4 UNB S002 (`:830-848`, S. 20) — *„Absender Datei · M · IK des Absenders
    (Abrechnungsstelle mit oder ohne Inkassobefugnis oder LE). Genutzt werden die ersten 9
    Stellen; einzutragen ist das IK der absendenden Stelle. Diese Angabe muss übereinstimmen
    mit SLGA.FKT.IK Absender der Datei."*
  - § 5.5.3.1 SLLA-FKT (`:1875-1885`, S. 41) — *„IK des Leistungserbringers · 9 · N · M ·
    Einzutragen ist das IK des Leistungserbringers."* (pdftotext tip/art sütununu „NM" olarak
    birleştirmiş)
  - § 5.5.2 SLGA-FKT (`:1427-1437`) — *„IK des Rechnungsstellers/Leistungserbringers · 9 · N ·
    M · Es ist das IK des Leistungserbringers anzugeben"* (Abrechnungsstelle mit
    Inkassovollmacht istisnası: Sammelrechnungs-SLGA'da onun IK'sı)
  - Podologie Anlage 3 i.d.F. 16.06.2025 lit. p) (`20250617_Podologie_Anlage_3_Lesefassung.txt:696-705`)
    — IK Verordnung'un arka yüzüne (Rechnungsdaten) yazılır; ön yüzde eksikliği *„unschädlich"*.
- **Geçerlilik:** 01.10.2025 (V21) — V22'de bu alanlar için değişiklik kaydı bu turda okunmadı
- **Kodda:** açık — Reform **S2.7** (IK boşsa üretim reddi). Kod satırı uygulanınca buraya.
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
- **Kodda:** ✅ uygulandı (30.09.2026, gkv-302 B1) — `api-backend/billing/utils/kostentraeger-frisch.js`
  (`kostentraegerFrischAbleiten`) + `api-backend/lib/rezept-felder.js` (`kostentraegerIkAufloesen`,
  `abrechnender_kt_ik` zincirini takip eder).
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

### ZHE.Diagnosegruppe = Verordnung'daki DG; yoksa „9999"
- **Kural:** `ZHE` Diagnosegruppe/Indikationsgruppe `..4 AN M`: *„Die auf der
  Heilmittelverordnung angegebene Diagnosegruppe ist hier anzugeben. Es sind nur Ziffern 0-9 und
  Buchstaben (ohne Umlaute) zugelassen. Die Übermittlung von Leer- und Sonderzeichen ist nicht
  zulässig."* (Beispiel: `ZN`, `PS2`) · *„Sofern keine Diagnosegruppe angegeben wurde, ist das
  Feld mit "9999" zu füllen soweit keine anderweitigen Regelungen bestehen."* Zahnärzte:
  Indikationsgruppe (z.B. `CD2a`). Buna göre `DF-c` gibi Leitsymptomatik ekli değer gönderilmez;
  ve gönderilen DG **Verordnung'daki** DG'dir, ICD'den türetilen değil.
- ⚠️ „9999" bir **DTA dolgu değeridir**, geçerlilik izni değildir: podolojide DG Pflichtangabe
  (Anlage 3 Ziffer 5 j) — `9999` giden Verordnung kasada Ziffer 4 Abs. 2 yoluyla absetzt
  edilebilir.
- **Kaynak:** Anlage 1 TP5 V21 (Stand 15.01.2026, anzuwenden ab 01.10.2025) Kap. 5.5.3.3
  SLLA: B, Segment ZHE, S. 69 (`wissensbank/gemeinsam/302-tp5/Anlage_1_TP5_V21_20260115.txt:3296-3330`)
- **Geçerlilik:** 01.10.2025
- **Kodda:** ✅ `api-backend/billing/dta/builder.js:190` (`|| '9999'`) ·
  `api-backend/billing/api/abrechnung.routes.js:551` (Physio) + `:3015` (Podo) —
  `.replace(/-[abc]$/i, '') || '9999'`
- **Kapsam:** tüm Heilmittel (SLLA B)

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

### Karten-IK ≠ Kostenträger-IK — ikisi ayrı Mussfeld, geri düşüş yok
- **Kural:** SLLA-FKT ve Gesamt-SLGA-FKT'deki "IK der Krankenkasse" alanına KV-Karte/Verordnung'daki IK yazılır (Sammel-SLGA'da boş). "IK des Kostenträgers" alanına ise Kostenträgerdatei'de bu Karten-IK'nın işaret ettiği IK yazılır. Karten-IK yoksa dosya üretilmez.
- **Kaynak:** Anlage 1 TP5 V21 §5.5.2 S.32, §5.5.3.1 (alan tipi NK, Pflicht Erläuterung'dan)
- **Geçerlilik:** 01.10.2025
- **Kodda:** billing/dta/preflight.js V:01017 · builder.js kartenIkPflicht() · billing/utils/karten-ik.js · lib/rezept-felder.js kostentraegerIkAufloesen()
- **Kapsam:** tümü (Physio/Ergo/Logo/Podo), GKV

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
- ⛔ **korrigiert 29.09.2026** — eski kural metni: ~~UNB Feld 0035 = `0` (Test) veya `1`
  (Erprobung) olan dosyaların işlenmesi hiçbir ödeme tetiklemez.~~ Kaynak cümlesi yalnız
  Testindikator **0**'ı kapsıyor; Erprobung'u (1) kapsadığı okuması kaynakta yok.
- **Kural:** UNB Feld 0035 = `0` (**Testdatei**, Prüfverfahren § 5) → işlenmesi **ödeme
  tetiklemez**. `1` (**Erprobungsdatei**, § 6) için ödeme hakkında kaynakta **hiçbir cümle
  yok** — ne „ödenir" ne „ödenmez". **Çıkarım:** Richtlinien § 9 Abs. 2'deki *„zweigleisige
  Erprobung mit einer konventionellen und einer maschinellen Datenübermittlung"* nedeniyle
  Erprobung sırasında **konvansiyonel (kâğıt) fatura paralel** yürür ve para o yoldan gelir;
  Erprobungsdatei tek başına ödeme yolu sayılmamalı. **DAS'a açık soru** (aşağıda).
- **Kaynak:** Anhang 2 zur Anlage 1 TP5, Kapitel 9, Stand 10.11.2003
  (`wissensbank/gemeinsam/302-tp5/Anhang_02_Anlage_1_TP5_Kapitel_9_Pruefverfahren_20031110.txt`)
  § 5 (`:137-154`) — *„Die Daten sind wie folgt als Testdateien zu kennzeichnen: •
  Testindikator im Segment UNB = 0 … Die Verarbeitung der unter den zuvorgenannten Kriterien
  gemeldeten Testdaten löst keine Zahlungen aus."* · § 6 Erprobungsverfahren (`:156-165`) —
  *„Testindikator im Segment UNB = 1"*, ödeme cümlesi yok. Anlage 1 TP5 V21 UNB 0035
  (`Anlage_1_TP5_V21_20260115.txt:913-917`) yalnız değerleri tanımlar (0 Test · 1 Erprobung ·
  2 Echt). Richtlinien § 302 i.d.F. 20.11.2006 § 9 Abs. 2
  (`Richtlinien-Text_061120.txt:306-309`) — *„Der Teilnahme geht im Einzelfall eine
  zweigleisige Erprobung mit einer konventionellen und einer maschinellen Datenübermittlung
  im Sinne dieser Richtlinien voraus."*
- **Açık — DAS'a sorulacak:** Erprobungsdatei (`1`) işlenince ödeme tetikler mi, yoksa
  Erprobung boyunca kâğıt Urbeleg + konvansiyonel fatura mı esas? DAS randevusunda (bkz.
  „Zulassung … Absender×Empfänger" kaydının açık maddesi) aynı listede sorulur.
- **Geçerlilik:** 10.11.2003 — hâlâ geçerli
- **Kodda:** `api-backend/billing/api/abrechnung.routes.js` — üç çağrının üçü de `kind: 'test'`
  (satır **700 · 2810 · 3242**; ilkinin yanında *„Faz A2 starts in test mode; flip to 'echt'
  once DAS portal acks"* yorumu duruyor) → `api-backend/billing/dta/builder.js:375`
  `testIndikator = kind === 'echt' ? '2' : kind === 'erprobung' ? '1' : '0'`
- **Kapsam:** tüm gruplar
- ⚠️ Bu kural „yanlışlıkla Echt gönderme" riskine değil, **„Test gönderip para bekleme"**
  hatasına karşı duruyor — bugün kod zaten yalnız Test üretiyor.

### Datenaustausch durum terimleri: Initiierung → Übermittlung → Quittierung / Zurückweisung → Bezahlung
- **Kural:** Bir gönderimin durumu spesifikasyonun kendi kelimeleriyle adlandırılır:
  **Initiierung** (dosya üretildi) → **Übermittlung** → Empfänger Prüfstufe 1-3'ü koşar →
  **Quittierung der Übernahme** ya da **Zurückweisung / Abweisung** (Prüfstufe 1-3'te hata
  **dosyanın tamamını** döndürür) → **Bezahlung**. Prüfstufe 4 (vertrags-, versicherungs-,
  leistungsrechtlich) **kassenspezifisch**tir, kassenartenübergreifend kural yoktur; oradan
  dönen kesintinin teknik adı yok (günlük dildeki „Absetzung" §302 terimi değildir — bkz.
  aşağıdaki kayıt). Absender **Bezahlung'a kadar** Sicherungskopie tutar; Datenaustausch
  dokümantasyonu **en az 2 yıl** saklanır ve Initiierung'dan Quittierung'a + Weiterverarbeitung'a
  kadar her adımı içerir. Zurückgewiesen veri düzeltilip **yeniden** gönderilir.
- **Kaynak:** Anlage 1 TP5 **V21** (Stand 15.01.2026, anzuwenden ab 01.10.2025)
  (`wissensbank/gemeinsam/302-tp5/Anlage_1_TP5_V21_20260115.txt`):
  - Kap. 3 (2) (`:353-356`, S. 9) — *„Über den Datenaustausch ist eine Dokumentation zu führen.
    Die Dokumentation ist mindestens 2 Jahre aufzubewahren. Dabei sind alle Schritte von der
    Initiierung bis ggf. zur Quittierung der Übernahme sowie der Weiterverarbeitung zu
    dokumentieren."*
  - Kap. 3 (4) (`:361-364`) — *„Eine Sicherungskopie der Daten ist durch den Absender bis zur
    Bezahlung vorzuhalten, insbesondere für die Rekonstruktion der Daten im Falle eines
    Dateiverlustes auf dem Transportweg oder einer Dateirückweisung."*
  - Kap. 3 (6) (`:370-372`) — *„Der Absender ist über festgestellte Mängel unverzüglich zu
    unterrichten. Die zurückgewiesenen Daten sind zu berichtigen und die korrigierten Daten
    erneut zu übermitteln."*
  - Kap. 6.1-6.3 (`:7958-7994`, S. 161-162) — 6.1 *„erfolgt eine Abweisung der Datei"* · 6.2
    *„ist die gesamte Datei zurückzuweisen"* · 6.3 *„Bei Abweisung der Datei erfolgt die
    Benachrichtigung unter Angabe des Fehlers."*
  - Kap. 6.4 (`:7996-8004`) — *„Die kassenartenspezifischen vertrags-, versicherungs- und
    leistungsrechtlichen Prüfungen werden individuell bei den einzelnen Krankenkassen
    durchgeführt. Für diesen Bereich werden keine kassenartenübergreifende Regelungen
    vereinbart. Die Art, Schwere und Häufigkeit von Fehlern, die zur Rechnungsabweisung führen,
    werden kassenspezifisch geregelt."*
  - Kap. 7 (`:8054-8056`) — „erfolgreicher Dateieingang" = Ursprungsrechnung Prüfstufe 1-3'ü
    fehlerfrei geçti (Korrekturverfahren süreleri buna bağlanır).
- 📌 Terim sırası kaynakta tek bir liste olarak yazılı değil; **sıralama** yukarıdaki cümlelerin
  birleşimidir. Kelimelerin kendisi (Initiierung, Quittierung der Übernahme, Zurückweisung,
  Bezahlung) birebir kaynaktandır. „Übermittlung" Kap. 3 (1)'de *„Übermittlungsvorgang"*.
- **Geçerlilik:** 01.10.2025 (V21)
- **Kodda:** açık — Reform **S2.1** (bir **Test**dosyası Verordnung'u kilitlememeli: Testindikator
  0 ödeme tetiklemez, yani o Verordnung için Bezahlung hiç gelmeyecek — bkz. „Testdatei ödeme
  tetiklemez"). Kod satırı uygulanınca buraya.
- **Kapsam:** tüm DTA gönderimi

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
  (29.09.2026 notu: bu cümle yalnız Testindikator `0` için kaynaklı; `1` Erprobung'da ödeme
  hakkında kaynak yok — bkz. „Testdatei ödeme tetiklemez".)
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

# Kostenträgerdatei — Stichtag (01.10.2026)

### Annahmestelle-Stichtag = Rechnungsdatum = Übermittlungstag (Berlin), DTA ve Papier aynı
- **Kural:** Datenannahmestelle **ve** Papierannahmestelle, Kostenträgerdatei'den dosyanın
  **gönderildiği Berlin günü** (= Rechnungsdatum) ile çözülür; üretim günü veya Leistungsdatum
  kullanılmaz. Leistungsabgabetag yalnız **Leistungserbringer-IK** için ölçüttür.
  Çeyrek sınırında üretilip sonra gönderilen dosya yeniden çözülmeli / yeniden üretilmelidir.
- **Kaynak:**
  - Anlage 1 TP5 V21 kapak (`Anlage_1_TP5_V21_20260115.txt:21-23`): „die zum Zeitpunkt der
    Datenübermittlung gültige(n) Version(en) anzuwenden" (TA sürümü için; tarih mantığı aynı)
  - Anlage 1 TP5 V21 Kap. 8 (`:8037`): „Die Korrekturrechnungen sind nach der zum Zeitpunkt
    der Übermittlung aktuell gültigen Technischen Anlage zu erstellen" → Korrektur (VKZ 02/03/04)
    da gönderim günüyle çözülür
  - Anhang 3 Anlage 1 TP5 V10 (Stand 14.04.2026, anzuwenden ab 01.02.2027) VDT
    „Gültigkeitsdatum ab / bis" JJJJMMTT (`:706-708`) — satır bazlı geçerlilik penceresi.
    ⚠️ Yürürlükteki V09 arşivde yok; aynı alan yapısı V09'a karşı doğrulanmadı.
    Anhang 3'te açık bir „Stichtag = Übermittlungstag" cümlesi **bulunamadı** (grep: maßgeb/Stichtag).
  - TP5 Infoschreiben BAHN-BKK (Dienstleisterwechsel 01.01.2026) `:13` „ab dem Rechnungsdatum
    01.01.2026 an folgende Adresse" (Papier) · `:38-41` eski adrese geç ulaşan belge
    „an den Rechnungssteller zurückgesandt" · `:32-36` yazılı Einspruch/Korrektur'da
    „Abrechnungsdatum der Ursprungsrechnung maßgebend", ama Heilmittel (AC B)
    Nachberechnungen yeni Dienstleister'e — **tek kasanın mektubu, genel kural değil**
  - Richtlinien-Text (20.11.2006) § 5 Abs. 3 (`Richtlinien-Text_061120.txt:219-221`):
    „das am Leistungsabgabetag gültige Institutionskennzeichen (IK) des Leistungserbringers"
- **Geçerlilik:** V21 (01.10.2025–31.01.2027); V22/Anhang 3 V10 geçişinde yeniden kontrol
- **Kodda:** `api-backend/lib/berlin-tag.js:14` `berlinHeute()` ·
  `api-backend/billing/kostentraeger/annahmestelle.js:44` `giltAm()` (valid_from/valid_to, NULL=offen) ·
  `:170` `ladeAnnahmestelle()` · `:296` `ladePapierannahmestelle()` ·
  `api-backend/db/migrations/0046_kostentraeger_gueltigkeit_annahmestellen.sql` ·
  ❌ View `kostentraeger_auswahl` henüz `valid_from`'a bakmıyor (01.10.2026, migration bekliyor) ·
  ❌ gönderim anında yeniden çözme / çeyrek-uyarısı henüz yok (`/abrechnung/:id/empfaenger-pruefung` planlı)
- **Kapsam:** tüm Fachbereiche · DTA + Papier (Begleitzettel/Urbelege) · VKZ 01/02/03/04/10

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
- [x] ~~28 gün başlama süresi — HeilM-RL § 15'ten teyit~~ — **kapandı 29.09.2026** (`wissensbank`): § 15 Abs. 1-2 HeilM-RL `:677-682` orijinalden okundu, kural „Behandlungsbeginn-Frist" (Verordnung bölümü).
- [ ] 🟠 **Erprobungsdatei (UNB 0035 = 1) ödeme tetikler mi?** (29.09.2026) Anhang 2 § 6 sessiz,
      Richtlinien § 9 Abs. 2 „zweigleisig" → konvansiyonel fatura paralel çıkarımı. DAS
      randevusunda sorulacak (bkz. `project_das_ik_registrierung` — DAS randevusu açık iş).
- [ ] 🟠 **Podologie Rahmenvertrag § 125 Abs. 1 ana metni (i.d.F. 30.11.2020 + 20.10.2023)
      arşivde yok.** İki açık buna bağlı: 78040 praxis mi hasta mı (§ 3a) ve Richtlinien § 7
      Abs. 1'in „soweit in Verträgen nichts anderes geregelt ist" istisnası (Abrechnung
      zamanı). GKV-SV sunucusu otomatik indirmeye vermiyor — elle indirilecek.
- [ ] `blankoRules.js:124-132` — `ok !== true` iken bonuslar yine hesaplanıyor (`total_bonuses_eur`
      dolu dönüyor). Sessiz yanlış fatura riski.
- [ ] VKZ değerlerinin `billing/dta/` ve `billing/codes/` içinde doğru uygulanması
- [ ] `sync_heilmittel_katalog.js` ICD alan indekslerinin 28 alanlık yapıya uyumu
- [ ] Zuzahlung hesabının Anlage 1 V21 bölüm 7 ile uyumu
- [ ] Kostenträgerdatei/IK eşleme kuralları (Anhang 03 — dikkat: geçerli sürüm V10 değil, 01.02.2027'ye kadar önceki sürüm)

---

## BG / Arbeitsunfall — Abgrenzung zu §302 (Ergänzung 05.10.2026, KHS M2)

- **Belegt:** BG-Behandlungen laufen nicht über §302/DTA. Unfallkennzeichen `1` („Arbeitsunfall / Wegeunfall / Berufskrankheit", Anlage 3 TP5 V21 §8.1.2) wird nicht verwendet. Das Muster-13-Kreuz „Unfallfolgen/BVG" ist ein GKV-Feld und **kein** BG-Fall (Podologie Anlage 3 Lesefassung 16.06.2025).
- **Belegt (Analogie Physio/Ergo, nicht Podologie):** DGUV-Verordnung F 2400 hat Kopffeld „Unfallversicherungsträger" und „Unfalltag und ggf. Aktenzeichen"; DGUV-Rechnung: Rechnungsnummer, IK (sonst IBAN).
- **Nicht verifiziert (nichts als Pflichtfeld bauen):** DGUV-Vertrag/Gebührenverzeichnis für Podologie (Negativbefund: DGUV-Vergütungsseite nennt keine Podologie; FAQ Vertragswesen: ohne Vertrag Empfehlung Vergütung nach vdek-Verträgen, nicht verbindlich) · UV-Verordnungsformular Podologie · D-Arzt-Pflicht/Fristen/Preise für Podologie · elektronischer UV-Rechnungsweg.
- Produktfolgen: `Podoloji/PRODUKT-ENTSCHEIDUNGEN.md` PE-006 B. Quelle DGUV Handlungsanleitung Heilmittel (Jan. 2026) noch **nicht** in `wissensbank/` registriert → `wissensbank`-Agent.
