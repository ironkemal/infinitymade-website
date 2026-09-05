# SPEC-RULES — Süzülmüş §302 / Heilmittel kuralları

> Kaynak belgelerden çıkarılmış, koda uygulanan/uygulanması gereken kurallar.
> **Amaç:** yüzlerce sayfalık spesifikasyonu her seferinde yeniden okumamak.
>
> Bu dosya kaynağın yerini **tutmaz**, ona **işaret eder.** Her kural üç şeyi taşımak zorunda:
> **kaynak + sürüm + kod satırı.** Bu üçlü olmadan kural yazılmaz — belge güncellendiğinde
> neyin yeniden kontrol edileceği belli olmaz.
>
> Sahibi: `gkv-302` ajanı · Arşiv haritası: `Handbücher/INDEX.md`
> Son güncelleme: 2026-09-05

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

### Podologie: 78040 Eingangsbefundung — aynı gün kombinasyonu
- **Kural:** 78040 aynı Behandlungstag'da **78010/78020 ile birlikte abrechenbar'dır** — bu
  normal hâldir, istisna değil. Yasak olan tek kombinasyon **78040 + 78030**'dur.
- **Kaynak:** Anlage 1a Leistungsbeschreibung i.d.F. **17.06.2024** (Vertrag § 125 Abs. 1 SGB V
  Podologie i.d.F. 30.11.2020), Teil 1 Nr. 2 — *"Die podologische Eingangsbefundung erfolgt vor
  der ersten Abgabe einer podologischen Leistung und **kann am gleichen Tag wie die podologische
  Leistung durchgeführt werden**."* (`Podoloji/Leistungen/20240725_Anlage_1a_Leistungsbeschreibung_lesefassung_b.txt`
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
  **24.05.2023** Nr. 5 (`Podoloji/20230524_Podologie_FAK_bf.txt` Z.38-41)
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
  Kalenderjahr** beschränkt."* (`Podoloji/Leistungen/20250617_Podologie_Anlage_1c_Leistungsbeschreibung.txt`
  Z.236-239); Änderungsvereinbarung vom **16.06.2025** Nr. 5, yeni **§ 3b lit. a)** — *"Die
  Leistung nach Anlage 1c Teil 2 Ziffer I.1 (Erstbefundung) kann **einmalig zu Beginn einer
  Nagelspangenbehandlungsserie** erfolgen. Eine Behandlungsserie bezieht sich stets auf einen
  zu behandelnden Nagel und **kann mehrere Verordnungen umfassen**."*
  (`Podoloji/Leistungen/20250617_Podologie_Aenderungsvereinbarung.txt` Z.57-59); tek başına
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

# §302 Abrechnung / Korrekturverfahren

### Verarbeitungskennzeichen (VKZ) değerleri
- **Kural:** `01` = Erstrechnung · `02` = Nachforderung · `03` = Zuzahlungsnachforderung ·
  `04` = Korrekturrechnung · `10` = Wiederaufnahme einer bereits beendeten Blankoverordnung
- **Kaynak:** Gemeinsame Umsetzungsempfehlungen zum Korrekturverfahren Heilmittel (13.02.2025)
- **Geçerlilik:** 01.10.2025
- **Kodda:** doğrulanmadı — `api-backend/billing/dta/` ve `billing/codes/` kontrol edilmeli
- **Kapsam:** tüm Heilmittel Abrechnung


### Abrechnungscode 71 = Podologen (72 = med. Fußpfleger)
- **Kural:** Podoloji Verordnung/DTA ekranlarında görünen sabit **„71"** Anlage 3'ün
  **Abrechnungscode**'udur: `71 = Podologen`, `72 = Med. Fußpfleger (gemäß § 10 Abs. 4 bis 6 PodG)`.
  LEGS'in ilk iki hanesidir (`7100501` / `7200501`) ve aynı değer §8.1.14
  Leistungserbringer-Sammelgruppenschlüssel'de **Leistungsbereich B (Heilmittel)** altında geçer.
  Diagnosegruppe **değildir**, Positionsnummer **değildir**.
- **Kaynak:** `Podoloji/Anlage_3_TP5_V21_20250919.txt` §8.1.5.1 S.15 Z.559 (*„71 = Podologen"*)
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
- **Kaynak:** `Handbücher/Anlage_1_TP5_V21_20260115.txt` §5.5.2 (SLGA-FKT, Z.1440-1446) ve
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
- **Kaynak:** `Handbücher/Anhang_03_Anlage_1_TP5_V10_20260414.txt` §5.1 —
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
- **Kaynak:** `Handbücher/Anlage_1_TP5_V21_20260115.txt` §5.3.1 (Z.566-573) ve §5.3.2 (Z.575-578)
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
- **Kaynak:** `Handbücher/Anlage_1_TP5_V21_20260115.txt` §5.5.2, GES segmenti (Z.1660-1690)
- **Geçerlilik:** 01.10.2025 (Anlage 1 V21)
- **Kodda:** `api-backend/billing/dta/segments.js:73-85` alanları taşıyor; hesaplama
  `abrechnung.routes.js:600-615` (brutto ve zuzahlung ayrı toplanıyor). VKZ 03 özel kuralı
  (Brutto = 0,00) **doğrulanmadı**.
- **Kapsam:** tüm Leistungserbringergruppen

### „Absetzung" §302 teknik spesifikasyonunun kavramı DEĞİLDİR
- **Kural:** Anlage 1 TP5 V21 metninde `Absetzung`, `Buchung`, `Kontonummer`, `Zahlungsavis`
  kelimeleri **hiç geçmez** (0 eşleşme). Kasa geri bildirimi teknik tarafta Fehlerverfahren
  (Prüfstufe 1–4) olarak düzenlenir; parasal kesinti ise Absetzungsschreiben ile kâğıt/portal
  üzerinden gelir ve içeriği standart değildir. Korrekturverfahren belgesi Nr. 7 bunu açıkça
  söyler: kesilen Termin/Positionsnummer Absetzungsschreiben'de yoksa **VKZ 4 Korrekturrechnung
  üretilemez**, Leistungserbringer bilgiyi kasadan sormak zorundadır.
- **Kaynak:** `Handbücher/Gemeinsame_Umsetzungsempfehlungen_zum_Korrekturverfahren_Heilmittel_20250213.txt`
  Frage 7 (Z.186-196) — *„Sofern die Termine bzw. die Positionen nicht aus dem
  Absetzungsschreiben hervorgehen, muss der Leistungserbringer … diese Informationen erfragen"*
- **Geçerlilik:** 01.10.2025
- **Kodda:** `api-backend/billing/zaa/parser.js` yalnız `code / belegnummer / text` çıkarır;
  `zaa_fehler` tablosunda (`db/SCHEMA.sql:1955-1967`) kasa tarafı **Vorgangs-/Absetzungsnummer**
  alanı yok. Muhasebe hesap numarası (SKR03/04) §302 kapsamı dışıdır.

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
- [ ] 🟡 **Nagel, Abrechnung freigabe'sinde zorunlu değil** — Verordnung formu zorunlu
      kılıyor, ama OCR'den doğan UI1/UI2 Verordnung nagel'siz kalabilir; o zaman seri
      sperresi sessizce devre dışı (`nagel_unbekannt`). Anlage 3 o2 „Pflichtangabe" diyor.
- [ ] 28 gün başlama süresi — HeilM-RL § 15'ten teyit (şu an kaynak NOVENTI = ticari yayın)
- [ ] `blankoRules.js:124-132` — `ok !== true` iken bonuslar yine hesaplanıyor (`total_bonuses_eur`
      dolu dönüyor). Sessiz yanlış fatura riski.
- [ ] VKZ değerlerinin `billing/dta/` ve `billing/codes/` içinde doğru uygulanması
- [ ] `sync_heilmittel_katalog.js` ICD alan indekslerinin 28 alanlık yapıya uyumu
- [ ] Zuzahlung hesabının Anlage 1 V21 bölüm 7 ile uyumu
- [ ] Kostenträgerdatei/IK eşleme kuralları (Anhang 03 — dikkat: geçerli sürüm V10 değil, 01.02.2027'ye kadar önceki sürüm)
