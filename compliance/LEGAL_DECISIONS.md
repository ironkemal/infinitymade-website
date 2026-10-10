# Hukuki Karar Kaydı (Legal Decisions Register)

> Kapatılmış hukuki kararlar. `legal-de` ajanı bu dosyayı her görevde okur ve buradaki kararları
> **yeni bir olgu olmadan yeniden tartışmaya açmaz** (yasa değişikliği, mimari değişiklik,
> eşik aşımı = yeni olgu sayılır).
>
> Format: `| Tarih | Karar | Gerekçe / Fundstelle | Durum | Yeniden değerlendirme tetiği |`

| Tarih | Karar | Gerekçe / Fundstelle | Durum | Yeniden değerlendirme tetiği |
|---|---|---|---|---|
| 2026-09-17 | **Kassenbuch/TSE: § 146a AO muafiyeti KAPATILMADI (🔧 koşullu). Ödenmemiş fatura Kassenbuch'a girmez. Export hedefi DATEV EXTF, Elster DEĞİL.** | Beta-1'in "silinemez + export = TSE gerekmez" gerekçesi yanlış: GoBD (§ 146 Abs. 4, § 147 AO) ile § 146a AO ayrı raylar. Ölçüt AEAO zu § 146a Nr. 1.2 "Kassenfunktion" = *Erfassung und Abwicklung zumindest teilweise barer Zahlungsvorgänge*, **yetenek testi** ("auf die Funktionsweise ... nicht was tatsächlich erfasst wird"), Kassenlade gerekmez; § 1 S. 2 KassenSichV'nin Buchhaltungsprogramm istisnası yalnız Tagesendsummen içindir. `dashboard.html:1553` "GoBD-Kassenbuch" + `:1556` "Barverkauf eintragen" + Kassieren-Dialog + storno + Beleg → Kassenfunktion lehine. Bize özel risk müşteride değil bizde: § 146a Abs. 1 S. 5 AO (gewerbsmäßig bewerben/in Verkehr bringen yasağı) + § 379 Abs. 1 Nr. 6 i.V.m. Abs. 6 AO, **bis 25.000 €**. Gerçekçi sonuç: Bußgeld değil, Steuerberater onayı alamayan satışın kapanmaması. Seçilen yol (B+C): kapsam dışına çıkma — "Kasse/Kassenbuch" dili kaldırılır, serbest "Barverkauf" gözden geçirilir, Kassenbon basılmaz, Verfahrensdokumentation'da offene Ladenkasse praxiste kalır + Steuerberater'dan tek soruluk yazılı teyit. TSE satın alma reddedildi: Cloud-TSE 8–20 €/ay/praxis + DSFinV-K/TR-03153, üstelik on-prem kutudan zorunlu dış çağrı (G8/K6 çatışması). GoBD tarafı: ödeme anında kayıt **doğru** (§ 146 Abs. 1 AO Kassensturzfähigkeit) — Ops #223 "jede Rechnung muss einfließen" Kassenbuch'a uygulanmaz, ayrı Umsatz/Offene-Posten görünümü olur. Tespit edilen GoBD kusuru: `api-backend/billing/api/abrechnung.routes.js:2234-2249` + `:2152-2168` mock-fallback uydurma satırları `gobd_kassenbuch.csv` adıyla veriyor → kaldırılacak. Elster export hedefi değildir (import yok); § 146a Abs. 4 Kassenmeldung praxisin ödevi, Praxura yapmaz (§ 5 StBerG, 05.09.2026 kararıyla aynı çizgi). | **Açık — 🔧 koşullu:** B tamamlandı (17.09.2026, commit `f388ea2` — "Kasse/Kassenbuch" dili kaldırıldı, "Barverkauf eintragen" serbest nakit-satış girişi UI+API'den tamamen silindi, `gobd_kassenbuch.csv` → `zahlungsjournal.csv`). **Kalan tek adım: C (Steuerberater'dan tek soruluk yazılı teyit) — Kemal'in işi, kodla çözülmez.** C tamamlanınca kapanır | Steuerberater teyidi gelmesi · "Barverkauf"/Bondruck özelliklerinin genişletilmesi · TSE'li bir müşteri talebi · AEAO/KassenSichV'de Kassenbuch tanımının netleşmesi |
| 2026-09-17 | **Beta müşterinin kendi ITSG/Trust-Center hesabına Kemal'in girip §302 test dosyası göndermesi YAPILMAZ (koşullu ⛔)** | Praxis'in ITSG Trust-Center sertifikası kendi IK'sına bağlı; Kemal bu hesapla işlem yaparsa GKV'ye karşı kimin beyanda bulunduğu belirsizleşir (gönderen fiilen Praxura, beyan sahibi görünen praxis) — hatalı/test verisi gerçek IK altında giderse § 263 StGB Abrechnungsbetrug şüphesi praxis'e düşer, Praxura "mitwirkende Person" olarak zincire girer. Ayrıca "Tool, kein Abrechnungsdienstleister" konumlandırması (bkz. yukarıdaki kapalı karar) çöker — müşteri adına gönderim yapmak fiilen Abrechnung'a katılmaktır. Testkennzeichen'in EDIFACT dosya adında olması (`TSOL0nnn`) tek başına yetmez — yanlış bayrak = canlı Abrechnung riski kalıcıdır. → `konsey/tutanak/2026-09-17-itsg-datenannahmestelle-test-yolu.md` | **⛔ koşullu — üç şart birlikte sağlanırsa açılır:** (a) praxis'ten yazılı Vollmacht + AVV, (b) praxis'in Trust-Center sözleşmesinin devri yasaklamadığının yazılı teyidi, (c) Datenannahmestelle'ye "Softwarehersteller-Test, IK X üzerinden" önceden bildirim — VE Kemal şifreyle asla girmez, praxis kendi tıklar, Praxura yalnız ekran paylaşımında izler. Bugün üçü de sağlanmıyor → kapalı | Üç şartın hepsi yazılı olarak sağlandığında; veya §302 test süreci için ayrı bir dummy/sandbox-IK mekanizması Datenannahmestelle tarafından teyit edilirse |
| 2026-06-11 | **Externer DSB atanmayacak** | Art. 37 Abs. 1 lit. a–c DSGVO'nun üç kriteri de karşılanmıyor; beta fazı, ErwG 91 anlamında "umfangreich" eşiği altında → `compliance/DSB_PRUEFVERMERK.md` | Kapalı | Aktif müşteri > 50, veri erişimli 2. çalışan, veya Kerntätigkeit değişimi |
| 2026-07-06 | **SaaS → on-premise pivotu** | §393 SGB V / BSI C5 Typ-2 yükümlülüğünden kapsam dışına çıkma; C5 maliyeti >€200k = ⛔ varoluşsal → `ON_PREMISE_ANALYSE.md`, `ONPREM_MIGRATION_PLAYBOOK.md` | Uygulanıyor | C5 denklik kuralının değişmesi; cloud'da hasta verisi işleyen yeni bir zincir eklenmesi |
| 2026-07-06 | **Abonelik tipi = Softwaremiete + entegre Softwarepflege** | BGB Mietvertrag; kullanılabilirlik borcu kira süresince bizde → `LEGAL_ONPREM_REQUIREMENTS.md` §1 | Kapalı | Tek seferlik lisans satış modeline geçiş |
| (öncesi) | **Konumlandırma: "Tool, kein Abrechnungsdienstleister"** | §302 SGB V sorumluluğunu üstlenmemek; metinlerde "abrechnen" değil "vorbereiten"; AGB'de §302 Haftungsausschluss | Kapalı | Abrechnung'u bizim adımıza gönderen bir özellik eklenmesi |
| (öncesi) | **G8 — yeni bulut bağımlılığı yasağı** | On-prem geçiş maliyetini büyütmemek → `CLAUDE.md` | Yürürlükte | On-prem pivotunun iptali |
| 2026-08-06 | **Eş-kurucu Aşama-1 = 2 belge, ıslak imza (Schriftform § 126 BGB), müşteri görüşmesinden önce** | Vertraulichkeit (§ 23 GeschGehG + § 53 BDSG + § 203 Abs. 4 StGB, ayrı paragraflar, nachvertraglich) + Rechteübertragung (§ 31 Abs. 5, § 31a UrhG → e-posta/Textform YETMEZ) **yazılı Gegenleistung ile** (karşılıksız ausschließliche Übertragung § 32 UrhG'ye açık) + **ausdrücklicher GbR-Ausschluss** (§ 705 BGB). Müşteri görüşmesinde katılımcı Erfüllungsgehilfe → ayrı AVV-Unterauftrag gerekmez, ama müşteriye önceden yazılı bilgi + Testmandant → `konsey/tutanak/2026-08-06-esk-kurucu-asama1-belgeleri.md` | Uygulanıyor | Ekim 2026 Beteiligungsvertrag; şirket formunun değişmesi (UG kuruluşu) |
| 2026-08-14 | **Dijital hasta onamı: einfache elektronische Signatur YETER; iki ayrı metin + iki ayrı imza; sürümlü metin saklanır; IP toplanmaz; ayrı `patient_consents` tablosu** | §630d/630e BGB Aufklärung ve Art. 7 DSGVO Schriftform (§126 BGB) **istemez** → QES/fortgeschrittene orantısız; eIDAS Art. 25 basit e-imzayı reddedilemez kılar (freie Beweiswürdigung). §630d Behandlungs-Einwilligung ile Art. 7 rızası (widerruflich, Art. 7 Abs. 3) **birleştirilemez** — Koppelungsverbot. Art. 7 Abs. 1 Nachweispflicht metnin tam sürümünü ister (`text_version`+`text_sha256`), onay bayrağını değil. IP: praxis tabletinde yüz yüze imzada delil değeri sıfır → Art. 5 Abs. 1 lit. c ihlali. İmza **raster PNG**, basınç/dinamik toplanmaz → Art. 4 Nr. 14 biyometrik değil. Saklama 10 yıl (§630f Abs. 3). `consent_log` genişletilmez: başka Betroffener (praxis sahibi, B2B) → RLS/Löschfristen/Art. 15 kapsamı bozulur. VVT'ye yeni işleme faaliyeti + TOM güncellemesi zorunlu, DSFA güncellenir. → `konsey/tutanak/2026-08-14-patienten-uebergabe-einwilligung.md` | Uygulanıyor | Onamın praxis dışında (hasta kendi cihazı/uzaktan) alınması; imza dinamiği toplanması; eIDAS/BGB şekil şartı değişikliği |
| 2026-08-14 | **Onam metinlerinin LAFZI: Ekran 1 Aufklärung belgesi DEĞİLDİR + Ausfallhonorar'da § 309 Nr. 5 lit. b cümlesi ZORUNLU** | (a) Podolojide imza karşılamada, Aufklärung anamnezde → geçmiş zamanlı "Sie wurden aufgeklärt" beyanı olmamış olayı belgeler; § 630e Abs. 2 BGB Aufklärung'u mündlich+rechtzeitig ister, § 630h Abs. 2 ispat yükü praxis'te. Ekran 1 Behandlungsvertrag + ticari şart belgesidir; Aufklärung ileriye dönük anlatılır, § 630f Abs. 2 dokümantasyonu Anamnese'de kalır. (b) Ausfallhonorar vorformulierte Bedingung (§ 305 Abs. 1, § 310 Abs. 3 BGB) → § 309 Nr. 5 lit. b BGB gereği "kein/wesentlich geringerer Schaden" ispatı **açıkça saklı tutulmalı**, yoksa madde tümüyle unwirksam (geltungserhaltende Reduktion yok) ve tahsilat imkânsızlaşır. (c) Hasta bilgilendirmesinde sunucu beyanı "Deutschland" değil **"Europäische Union (DE + SE)"** — Azure Sweden Central, `compliance/VVT.md:63,102-107`. (d) Verordnungsgemäß Therapiebericht yasal yükümlülüktür, opt-in yapılamaz; opt-in sadece bunun ötesindeki Arztkommunikation için. → `compliance/legal-reviews/2026-08-14-einwilligungstexte-wortlaut.md` | Uygulanıyor — düzeltmeler go-live şartı | Aufklärung'un imza anına taşınması; Ausfall tutarının seans ücretini aşması; hosting bölgesinin değişmesi (on-prem = yeni metin sürümü) |
| 2026-08-06 | **Olgu: InfinityMade = Einzelunternehmung (nicht UG/GmbH)** | `agb.html:39`, `datenschutz.html:157` — devredilebilir Geschäftsanteil yok; imzasız birlikte çalışma § 705 BGB GbR karinesi → sınırsız kişisel sorumluluk | Kapalı (olgu) | UG/GmbH kuruluşu yapıldığında |
| 2026-08-14 | **Olgu + açık risk: canlı Kiosk-Modus Art. 32 TOM yetersizliği (Art. 33 bildirimi gerekmiyor)** | `handleKioskPinForgot` (`dashboard.js:22940`) PIN'i doğrulamadan kiosk'tan çıkarıp `tablet_kiosk_pin`'i `null`'a çekiyor; `handleKioskPinConfirm` (`22927`) `!storedPin` kısa devresi PIN yoksa her girişi kabul ediyor; PIN düz metin + client-side karşılaştırma. Biz SaaS'ta Auftragsverarbeiter → Art. 28 Abs. 3 lit. c. **Art. 33 Meldepflicht doğmaz** — fiilî yetkisiz erişim kanıtı yok, sadece risk; ancak kiosk giriş/çıkış loglanmadığı için erişim olsa da kanıtlanamaz. | Açık — P1 paketiyle kapatılacak (imza projesinden bağımsız, önce) | Fiilî yetkisiz erişim kanıtı çıkarsa → Art. 33/34 değerlendirmesi yeniden yapılır |
| 2026-09-08 | **`rechnung_zahlungen` → ⛔-Block in `api/dsgvo.js` (aufbewahren); NICHT löschen, NICHT anonymisieren. Art.-15-Auskunft nachgezogen.** | Grundaufzeichnung des Zahlungsverkehrs, § 147 Abs. 1 Nr. 1 i. V. m. Abs. 3 und Abs. 4 AO (10 Jahre; die 8-Jahres-Verkürzung des BEG IV, BGBl. 2024 I Nr. 323, betrifft nur Buchungsbelege nach Abs. 1 Nr. 4). **Rollenklarstellung:** aufbewahrungspflichtig ist die Praxis als Steuerpflichtige, nicht Praxura — für uns gilt Art. 28 Abs. 3 lit. g DSGVO, nicht Art. 17 Abs. 3 lit. b. Die Abgrenzung zu `zuzahlung_guthaben` trägt nicht: eine Beleglisten-Zeile entsteht nur bei Barzahlung (`gegenkonto_code='1000'`, `sql-melih/2026-09-07-rechnung-zahlungen.sql:457`), bei Bank/EC und bei jeder `ausbuchung` ist diese Tabelle der einzige Nachweis. Anonymisierung ausgeschlossen: keine `patient_id`-Spalte, Patientenbezug nur über `invoices` (dort bereits in ANONYMIZE_TABLES); UPDATE/DELETE ohnehin per `prevent_rechnung_zahlungen_mod()` gesperrt, ein Aufbrechen per SECURITY DEFINER stellte § 158 AO die ganze Buchführung in Frage. `bemerkung` wird nicht rückwirkend geleert (am 08.09. live gezählt: 0 Zeilen), sondern nach vorn verhindert (Art. 5 Abs. 1 lit. c). Art. 9 einschlägig, aber abgeleitet (EuGH v. 04.10.2024, C-21/23) — ändert die Frist nicht, senkt die Meldeschwelle nach Art. 33. Echte Löschung erst über ein Auslagerungspaket nach GoBD Rz. 142 ff. → `db/REGISTER.md` (`rechnung_zahlungen`) | Kapalı (kova kararı) / Export açık | Erster echter Kontolöschungsantrag · Steuerberater stuft die Tabelle als Buchungsbeleg (8 J.) statt als Aufzeichnung ein · `bemerkung` wird in Produktion mit Patientennamen befüllt |
| 2026-09-08 | **Açık eksik: Privatliquidation VVT'de HİÇ yok — yeni Verarbeitung 6 gerekli** | `compliance/VVT.md` beş faaliyetin hiçbiri `invoices` / `belegliste` / `rechnung_zahlungen` / `mahnungen` / `ausfallrechnungen` / `zuzahlung_*` zincirini kapsamıyor (grep: sıfır eşleşme). V-3 lafzı ile **§ 302 SGB V / GKV** ile sınırlı ("Heilmittel-Abrechnung nach § 302 SGB V"), veri kategorilerinde tek bir fatura/ödeme alanı yok; `db/REGISTER.md` `invoices` girdisi de ayrımı açıkça yapıyor ("GKV läuft über `abrechnung`"). Art. 30 Abs. 2 DSGVO ihlali — tablo satırı olarak değil, **Verarbeitungskategorie** olarak yazılmalı. Rechtsgrundlage Art. 6 Abs. 1 lit. b+c + Art. 9 Abs. 2 lit. h i. V. m. § 22 Abs. 1 Nr. 1 lit. b BDSG (Art. 9 mittelbar, C-21/23). Yeni DSFA tetiklenmiyor (Art. 35: yeni teknoloji/amaç/alıcı yok). Yan bulgu: `VVT.md:32` V-1 için "10 Jahre § 147 AO" diyor — BEG IV sonrası Buchungsbelege **8 yıl**, fazladan saklama ilanı Art. 5 Abs. 1 lit. e karşısında açık yüzey. | **Açık** — VVT/DSB Kemal'de | VVT 1.3 yayımlanınca kapanır |
| 2026-09-05 | **Behandlungsbestätigung PDF: keine Einwilligung, kein Speichern, kein Versand** | Aushändigung an den Betroffenen selbst → kein „Offenbaren" § 203 StGB, geschuldet nach § 630g Abs. 1/2 BGB + Art. 15 Abs. 3 DSGVO; Einwilligung wäre Scheinrechtsgrundlage (Art. 7 Abs. 3). Dokument **bleibt** Gesundheitsdatum (Art. 4 Nr. 15, EuGH C-21/23 Lindenapotheke v. 04.10.2024) — unschädlich, da Rechtsgrundlage nicht Einwilligung ist. Auflagen: nur wahrgenommene Termine (`hausbesuch=false`, `no_show=false`, `status IN (confirmed,completed)`, keine Zukunft) · keine km-/Betragsberechnung im PDF (§ 5 StBerG unbefugte Steuerhilfe, § 5 UWG) · keine Diagnose/ICD/Verordnung/Kasse · client-seitig wie `module/termin-druck.js`, kein Server, kein Speichern, kein Mailversand (G8). GoBD/§147 AO nicht einschlägig, da kein Rechnungs-/Zahlungsbeleg. → `module/behandlungsbestaetigung.js`, Ops-Kart #272 | Uygulandı | Praxis versendet das Dokument selbst an Dritte; km-/Betragsberechnung wird gewünscht; serverseitige Erzeugung oder Ablage geplant |
| 2026-09-11 | **`get_gmail_token`/`set_`/`clear_` anon-EXECUTE açığı (11.06–11.09.2026): keine Meldung nach Art. 33/34 — bereits weil kein realer Betroffener existiert** | **Entscheidender Punkt (Kemal, 12.09.2026 bestätigt): Praxura hatte zu diesem Zeitpunkt keinen einzigen realen Kunden.** Die 5 `vault`-Einträge (`gmail_token:*`) sind Test-/Entwicklungskonten, kein Data Subject betroffen — die DSGVO-Meldeschwelle (Art. 4 Nr. 12: „Verletzung" mit Personenbezug) ist damit gar nicht erst berührt. Nachrichtlich zusätzlich geprüft, für den Tag, an dem dieselbe Funktionsklasse mit realen Kunden wiederkehrt: keine nachweisbare „Verletzung" i. S. d. Art. 4 Nr. 12 (Zugänglichkeit ohne belegten Zugriff; Art. 5 Abs. 2 Darlegungslast, EDSA Leitlinien 9/2022 v2.0 v. 28.03.2023: Kenntnis setzt „hinreichenden Grad an Gewissheit" einer Kompromittierung voraus); zudem Ausnahme Art. 33 Abs. 1 Hs. 2, gestützt auf **ein Google-Refresh-Token ist für einen confidential Client ohne `GOOGLE_CLIENT_SECRET` nicht einlösbar** (Secret nie im Repository; Leak v. 05.08.2026 betraf Fal-AI-Key, n8n-Key, Testpasswort, nicht Google). Scope ausschließlich `gmail.send` (`api-backend/server.js:468`) — kein Postfachzugriff, **Art. 9 nicht einschlägig**, **§ 203 StGB nicht berührt**. Kein Token-Widerruf/Kundeninformation nötig — kein Kunde vorhanden, Testdaten werden ohnehin geleert. Nebenbefund: Kenntnis lag seit `fortschritte/2026-08-29.md:183` vor, die dort selbst verlangte legal-de-Bewertung erfolgte erst am 11.09. — folgenlos hier, künftig 72-h-Regel für Credential-/PHI-Funde, **relevant sobald reale Kunden existieren**. → `compliance/incidents/2026-09-11-gmail-token-rpc.md` | Kapalı | Erster realer Kunde mit Gmail-Anbindung + dieselbe Funktionsklasse erneut offen · Refresh-Test ohne Secret liefert `200` statt `401 invalid_client` · `GOOGLE_CLIENT_SECRET` taucht in der Git-Historie auf |
| 2026-09-12 | **ICD-10-GM (Band 1, Systematik) ticari on-prem Docker image'ına gömülebilir** | § 5 Abs. 2 UrhG "anderes amtliches Werk" — BfArM Downloadbedingungen (Stand 01.08.2025) § 1 Nr. 3/4 yeniden dağıtımı, ticari kullanım dahil, açıkça öngörüyor; telif ücreti/izin yok. Şartlar: Quellenangabe (§ 63 UrhG — image + Dashboard'a atıf metni) ve Änderungsverbot (§ 62 — kod başlıkları aynen). Band 2 (Alphabetisches Verzeichnis) **kapsam dışı** — Zi'nin ayrı hakları var. `wissensbank/REGISTER.md` W-A07 (ICD-10-GM kısmı) → `api-backend/db/migrations/0013_seed_icd10_titles.sql` | **Kapalı — atıf metni de eklendi (12.09.2026, O-78):** `onprem/NOTICE-QUELLEN.txt`, BfArM'ın kendi Anhang metni birebir | Band 2/Alphabet'in de dağıtılması istenirse; BfArM koşullarının değişmesi |
| 2026-09-12 | **Kostenträgerdatei (GKV-Spitzenverband) ve Anlage 2 §125 SGB V Physiotherapie-Vergütung ticari on-prem image'ına gömülebilir** | Kostenträgerdatei: **Werkschutz yok** (IK/Kasse/DAS-Zuordnung = Tatsachen, § 2 Abs. 2 UrhG Schöpfungshöhe yok; Dizilim normatif dayatılmış → § 4 Abs. 2 Datenbankwerk de değil). Taşıyan gerekçe **bestimmungsgemäße Nutzung**: dosya yalnız §302-Verfahren'in Datenannahmestelle-yönlendirmesi için yayımlanıyor, Anhang 03 zaten yazılım üreticileri için bir format-spec. Anlage 2 §125: GKV-SV + Leistungserbringer-Spitzenorganisationen arası normsetzender Vertrag, § 5 Abs. 2 UrhG kapsamında ICD-10-GM'den zayıf değil; ayrıca Positionsnummer/Preis tablosunun kendisi Schöpfungshöhe taşımıyor. → `onprem/NOTICE-QUELLEN.txt` bölüm 2+3, `api-backend/db/migrations/0006/0007/0008_seed_*.sql` | Uygulanıyor (Risikoakzeptanz, bkz. aşağıdaki tablo — §§ 87a ff. UrhG sui-generis Datenbankherstellerrecht sorusu EuGH'de karara bağlanmamış) | EuGH'nin § 5 UrhG'nin §§ 87a ff.'e analog uygulanabilirliğine karar vermesi; GKV-Spitzenverband'ın kendi sitesinde açık bir yasak/lisans yayımlaması |
| 2026-08-29 | **Umami einwilligungspflichtig — Schranke BLEİBT, yanlış olan metindi. Ayrıca Widerruf eksikti ve eklendi.** | § 25 Abs. 1 TDDDG **teknoloji-nötrdür**: yalnız çerez saklamayı değil, uç cihazda zaten kayıtlı bilgiye **erişimi** de kapsar. Umami script'i `screen`, `navigator.language`, `document.referrer` alanlarını aktif okur → Zugriff (EDSA Leitlinien 2/2023 v2.0, 07.10.2024). DSK'nın daha yumuşak çizgisi de kurtarmıyor: onun istisnası **sunucu tarafında pasif** okumadır, JS ile aktif Auslesen değil — iki görüş burada aynı sonuca varıyor. § 25 Abs. 2 Nr. 2 uymuyor (reichweitenmessung sayfanın sunulması için zorunlu değil; Almanya'da CNIL benzeri bir ölçüm istisnası yok — yasa koyucu tartıştı, koymadı). **Kritik nokta:** § 25 kişisel veri işlenip işlenmediğinden **bağımsız** işler → `datenschutz.html:146`'daki „keine Einwilligung erforderlich, **da** keine personenbezogenen Daten" cümlesi bir *non sequitur*; DSGVO gerekçesiyle TDDDG yükümlülüğü savuşturulamaz. Metnin asıl hatası buydu, eskimişliği değil. **Bağımsız ve daha ağır bulgu:** Widerruf **hiç yoktu** — bir kez `accepted` yazıldıktan sonra banner bir daha görünmüyor ve hiçbir yerde ayar bağlantısı yoktu → Art. 7 Abs. 3 S. 4 DSGVO („so einfach wie die Erteilung") ihlali; geçerli bir rıza rejiminin zorunlu parçası eksikti. **Uygulandı 29.08.2026:** banner'daki „Keine personenbezogenen Daten" beyanı kaldırıldı (Umami IP+UA+günlük salt'tan `session_id` üretir → ErwG 26 anlamında **pseudonym**, anonym değil; yanıltıcı beyana dayanan rıza Art. 4 Nr. 11 uyarınca angreifbar) · Datenschutz linki eklendi · Widerruf üç yoldan erişilebilir (`#cookie-einstellungen` ankası, `[data-cookie-einstellungen]` özniteliği, global fonksiyon) · rıza **12 ay** sonra yeniden sorulur · zaman damgasız eski rızalar **devralınmaz** (yanıltıcı metin altında verildiler) · iki düğme eşit genişlikte. `datenschutz.html:121` ve `:146` `legal-de` taslağıyla yeniden yazıldı, `UMAMI_SETUP.md` başına düzeltme notu kondu. Bauart-Test: `module/cookie-consent.test.js` (11 test; kapı kaldırılınca 9'u kırmızıya döner — gegenprobe yapıldı). **SEO-ROI sorusunun doğru aracı Umami değil:** Google Search Console + Bing Webmaster Tools, **DNS-TXT** doğrulamasıyla — sitede tek satır kod yok, Endeinrichtung'a erişim yok, § 25 hiç doğmuyor, €0 ve G8'e uygun. Umami consent'lilerde kalır; mutlak sayı vermez, göreli trend için kullanılır. | Uygulandı — GSC/Bing kurulumu açık | Digital Omnibus (Art. 88a/88b DSGVO-E, öneri 19.11.2025) yürürlüğe girip Reichweitenmessung istisnası getirirse; Umami sunucu konfigürasyonunun hash+salt rotasyonu doğrulanamazsa (o zaman `datenschutz.html:122` lafzı düzeltilir) |
| 2026-09-17 | **`prescriptions_festschreibung()` trigger'ı (Ops #167): NULL-istisnası SADECE `patient_name`/`versichertennummer`/`patient_id` için — `icd10`/`icd10_2`/`diagnosegruppe`/Heilmittel-/Betragsfelder istisnasız kilitli kalır** | `fn_abrechnung_zeile_festschreibung()` deseni tekrarlanır: kimlik alanları NULL'a çekilebilir, değiştirilemez; tanı/Heilmittel-içerik alanları §302 Anlage-1-TP5 Pflichtangabe'dir, `invoices`'taki hatanın (Personenfeld nullen = Pflichtangabe'yi yok etme) tersten tekrarını önlemek için içerik kilitli kalmalı. **Ayrıca tespit edildi, ayrı kart açıldı:** `prescriptions` bugün `api/dsgvo.js` `DELETE_TABLES`'ta (hard DELETE), `ANONYMIZE_TABLES`'ta değil — BEFORE-UPDATE trigger'ı DELETE'i bloklamaz, dolayısıyla trigger Löschungskette'yi kırmaz, ama billed (`belegnummer` dolu) Verordnung'lar bugün retention'sız komple silinebiliyor; bu `db/SCHEMA-RLS.sql:904-914`'te zaten "OFFENE LUECKE" olarak işaretli ve ayrı bir gkv-302+legal-de kararı gerektiriyor. → `compliance/legal-reviews/2026-09-17-prescriptions-festschreibung-dsgvo.md` | Trigger tasarım kararı kapalı / dsgvo.js-taşıma kararı **açık** (ayrı kart) — ⚠️ legal tarafı 02.10.2026 K1.4 kaydıyla cevaplandı (behandelte/abgerechnete VO = Behandlungsdoku, silinmez, gesperrt) | dsgvo.js `prescriptions`'ı ANONYMIZE_TABLES'a taşıma kararı verildiğinde bu kayıt güncellenir |
| 2026-09-21 | **Klass-68 Softwarehersteller-IK bei der ARGE·IK wird beantragt — drei Auflagen, kein Freibrief** | § 293 SGB V regelt das IK als **Kennzeichen**, nicht als Statusnachweis; Klassifikation 68 ("Softwarehersteller im Sozialversicherungswesen für zertifikatsbasierte Testverfahren") ist **nicht** Klassifikation 66 (§ 302 Abs. 2 SGB V, Leistungserbringer-IK) — die beantragte IK trägt keine Abrechnungsbefugnis. Zweck: Praxura (Kleingewerbe, keine Rechtsformvoraussetzung) kann damit selbst am Softwarehersteller-Test nach Anhang 2 Kap. 9 (Schritt 2.2, optional) teilnehmen, **ohne** eine Praxis-IK zu benötigen — das **Erprobungsverfahren** (Schritt 2.3, zwingend) läuft unverändert unter der IK/dem Zertifikat der jeweiligen Praxis. Drei Auflagen (`legal-de`, 21.09.2026): (1) die IK wird **niemals** als Absender-/Rechenzentrums-IK in einer echten Abrechnungsdatei verwendet — als Korkuluk im Code umgesetzt: `api-backend/billing/dta/software-hersteller-ik.js` (`SOFTWARE_HERSTELLER_IK`, heute `null`) + `assertNichtSoftwareHerstellerIkAlsAbsender()` in `builder.js`, wirft sobald `kind==='echt'` UND Absender-IK == der konfigurierten IK ist; (2) der Antrag läuft auf "InfinityMade, Inh. Yavuz Kemal Demir", nicht auf die Privatperson; (3) keine öffentliche Formulierung à la "wir sind bei der ARGE·IK registriert" — Standardtext, falls je gebraucht: *"Softwarehersteller-IK (Klassifikation 68) — ausschließlich für das zertifikatsbasierte Testverfahren nach Anhang 2 zur Anlage 1 (TP5). Die Abrechnung nach § 302 SGB V erfolgt durch die Praxis unter ihrem eigenen IK."* → `ABRECHNUNG_ECHTBETRIEB_PLAN.md` Adım 2.0 | **Kapalı — Antrag offen** (kostenlos, schriftlich bei der ARGE·IK: dguv.de/arge-ik/downloads/ → „Erfassungsbeleg IK", info@arge-ik.de; Bearbeitungsdauer nicht angegeben) | Die IK wird real in einer `kind==='echt'`-Datei als Absender-IK verwendet · eine öffentliche Formulierung suggeriert Abrechnungsbefugnis · die Sperre in `software-hersteller-ik.js` wird entfernt/umgangen |
| 2026-09-29 | **KI-Rezept-OCR über STACKIT AI Model Serving (statt Azure): 🔧 KOŞULLU freigabefähig — kein Veto. §203 durch NB Ziff. 18 getragen, §393 für den KI-Anteil erfüllt (C5 Typ 2), vor Aktivierung 6 Pflichtpunkte (alle 🟢 €0).** · **Nachtrag (2) gleicher Tag: Geschäftsmodell B′ (ein Praxura-Konto, je Praxis eigenes STACKIT-Projekt/Key, Daten direkt Box/App → STACKIT) — legal-de-Veto vom 12.09.2026 gegen „B" für diese Variante in 🔧 KOŞULLU umgewandelt; Reselling R als Alternative geprüft.** | Details, Quellen, offene Fragen und Mail an STACKIT: Abschnitt „2026-09-29 — KI-Rezept-OCR über STACKIT" + „Nachtrag (2)" am Ende dieser Datei. | **Ruht — STACKIT hat am 01.10.2026 abgelehnt (Nachtrag 3)** · vorher: wartet auf STACKIT-Antwort (inkl. Ziff. 13.2-Freigabe) + Doku-Updates; `onprem`-G2- und `guvenlik`-Veto zu B sind NICHT von legal-de aufhebbar → Konsey** | STACKIT-Antwort widerspricht „kein Inhalt in Logs/keine menschliche Prüfung" · STACKIT ändert NB Ziff. 18 (Änderungsmitteilung Ziff. 19.2, 8 Wochen) · AI Model Serving fällt aus dem C5-Typ-2-Scope · STACKIT verweigert Per-Praxis-Projekte nach Ziff. 13.2 · Request-Daten laufen doch über Praxura-Server |
| 2026-10-02 | **K1.8 / K-12 — Zwei-Faktor-Authentifizierung ist gesetzlich NICHT vorgeschrieben. Box: kein 2FA (K-12 bestätigt). SaaS: kein Gesetzesverstoß, aber eigene Zusage in TOM/DSFA muss vor ersten realen Patientendaten im SaaS entweder eingelöst oder korrigiert werden.** | Keine Norm nennt MFA: Art. 32 DSGVO ist risikobasiert (Stand der Technik, kein Maßnahmenkatalog); § 203 StGB regelt das Offenbaren, keine Technik; **§ 390 SGB V** (Wortlaut gelesen 02.10.2026) bindet nur „die an der vertragsärztlichen und vertragszahnärztlichen Versorgung teilnehmenden Leistungserbringer" (Richtlinie der KBV/KZBV) → **Heilmittelerbringer sind nicht Adressat**; BSI-Grundschutz unverbindlich, BSI TR-03161 gilt nur für DiGA/DiPA. Box: LAN-only, Praxis = Verantwortliche, Praxura ohne Rolle → Art. 32 trifft allein die Praxis. SaaS (Praxura = Auftragsverarbeiter): **Selbstbindung** — `compliance/TOM.md:24` sagt „Zwei-Faktor-Authentifizierung (TOTP) verpflichtend für Praxisinhaber-Konten ab Go-Live", `compliance/DSFA.md:52` R4 (Kontoübernahme, Score 16) „P0 vor Go-Live (MFA-Pflicht)". TOM ist AVV-Anlage (Art. 28 Abs. 3 lit. c) = vertragliche Zusage; eine Zusage, die das Produkt nicht einlöst, ist derselbe Mangel wie das TOM-Audit-Log am 03.09.2026. Details: Abschnitt „2026-10-02" unten. | Kapalı — Doku-Korrektur TOM.md:24 + DSFA R4 offen (Kemal, 🟢 €0, ~30 min) | Erste reale Patientendaten im SaaS (dann: Supabase-TOTP für Owner, 🟢 €0, ~1 Tag, läuft auch im self-hosted GoTrue — G8-neutral) · Box wird aus dem Internet erreichbar gemacht · Aufsichtsbehörde/DSK veröffentlicht MFA-Erwartung für Gesundheitsdaten-Software · § 390 SGB V o. ä. Norm wird auf Heilmittelerbringer erstreckt |
| 2026-10-02 | **K1.8 / K-6 — Festplattenverschlüsselung der Box ist NICHT Praxuras Rechtspflicht, sondern die der Praxis. Im Kurulum-Kılavuzu nur Empfehlungssatz.** | Art. 24, 32 DSGVO adressieren Verantwortliche/Auftragsverarbeiter; Hersteller ist kein Normadressat (Art. 25 Abs. 1 = Verantwortlicher; ErwG 78 S. 4 „ermutigt" Hersteller nur). In der Box verarbeitet Praxura nichts (K-6, Playbook K6/K10) → Praxis trägt Art. 32 und § 203 StGB allein. Produktseitig heute keine Pflicht (Softwaremiete: Mangelfreiheit, keine Verschlüsselungszusage). **Künftige Herstellerpflicht, nicht Disk-spezifisch:** CRA (EU) 2024/2847 Anhang I Teil I Nr. 2 lit. e (Vertraulichkeit gespeicherter Daten, „z. B. durch Verschlüsselung relevanter Daten im Ruhezustand") ab **11.12.2027** — erfüllbar durch App-seitige Verschlüsselung relevanter Daten (`api-backend/lib/phi-encrypt.js`), Vollverschlüsselung nicht zwingend; Prüfung im CRA-Paket, nicht jetzt. Empfehlungssatz (Almanca) im Abschnitt unten. | Kapalı | CRA-Vorbereitung (spätestens Mitte 2027) · Praxura übernimmt Betrieb/Fernwartung der Box (K10 bricht) · Praxura liefert eigene Hardware aus |
| 2026-10-02 | **K1.8 / S-31 — Klartext der §302-Datei NICHT ersatzlos löschen. Aufbewahrungsobjekt = signierte `.p7m` (SignedData, enthält Nutzdaten lesbar), 8 Jahre. Unsignierte `.dta` nach erfolgreicher Signatur löschen; verschlüsseltes `.enc.p7m` nach Annahme/Quittung löschen; SHA-256 aller Stufen bleibt.** | Das verschlüsselte Artefakt (EnvelopedData an das Zertifikat der Datenannahmestelle) kann die Praxis **nie wieder öffnen** → als einzige Kopie verstößt es gegen § 147 Abs. 2 Nr. 2 AO (jederzeit verfügbar, unverzüglich lesbar, maschinell auswertbar) und § 147 Abs. 6 AO (Datenzugriff); GoBD verlangen bei Kryptografie die Verfügbarkeit in entschlüsselter Form (genaue Rz. nicht verifiziert). Die Signatur läuft mit `detached: false` (`dashboard.js:16289`) → die `.p7m` enthält die vollständige Nutzdatei **plus** Signatur der Praxis = bester Nachweis, was eingereicht wurde; die unsignierte `.dta` ist danach inhaltsgleiches Duplikat. Frist: Abrechnung an die Kasse = Rechnung/Buchungsbeleg → **8 Jahre** ab Ende des Kalenderjahres der Einreichung (§ 147 Abs. 1 Nr. 4, Abs. 3 S. 1, Abs. 4 AO i. d. F. BEG IV; § 14b Abs. 1 UStG ebenso 8 J.); TP5-Übermittlungsdokumentation (≥ 2 J., Anlage 1 TP5 Kap. 3(2)) ist damit mit abgedeckt. Nie übermittelte Entwürfe (storniert/neu erzeugt) sind kein Beleg → sofort löschbar. **Korrigiert `guvenlik` S-31 Vorgabe V7** („nur das verschlüsselte Artefakt behalten") — dessen Vorbehalt war genau diese Frage. Gilt SaaS und Box gleich (Box: Pflicht der Praxis, Code-Default identisch). | Kapalı — Code (V7 umbauen) + Bucket-Lebenszyklus offen | Spezifikation verlangt Aufbewahrung des verschlüsselten Artefakts · Signatur wird auf `detached: true` umgestellt (dann bleibt die `.dta` Aufbewahrungsobjekt) · Steuerberater stuft die Sammelabrechnung als Aufzeichnung (10 J.) ein |
| 2026-10-02 | **K1.4 / S-10 / S-32 — Löschung↔Aufbewahrung: Kemals Modell (aufbewahrungspflichtiges sperren, Rest löschen, „teilweise gelöscht … gesperrt bis <Datum>") ist RICHTIG — mit drei Korrekturen: (1) SaaS: vorher Pflicht-Export + AVV-Klausel als Weisung, (2) mehrere heute gelöschte Tabellen sind Behandlungsdoku und müssen in den Sperrbestand, (3) Fristen je Kategorie, nicht pauschal 10 J.** | Box/Patientenantrag (Praxis = Verantwortliche): Art. 17 Abs. 3 lit. b DSGVO → Löschung entfällt, Ersatz Einschränkung (Art. 18-Logik; § 35 Abs. 3 BDSG nur für satzungs-/vertragliche Fristen). SaaS-Kontoende (Praxura = Auftragsverarbeiter): Art. 28 Abs. 3 lit. g → Löschen **oder** Rückgabe „nach Wahl des Verantwortlichen"; die Aufbewahrungspflicht trifft die Praxis, nicht uns (Eintrag 08.09.2026) → gesperrte Verwahrung bei uns braucht eine **Weisung** = AVV-Klausel. Fristen: Behandlungsdoku/Einwilligungen **10 J.** (§ 630f Abs. 3 BGB, ab Behandlungsabschluss); Rechnungen/Abrechnungsdateien **8 J.** (§ 147 Abs. 1 Nr. 4, Abs. 3 AO, § 14b UStG, BEG IV, gilt für alle am 01.01.2025 noch laufenden Fristen); Grundaufzeichnungen/Zahlungen/Kassen-Belegliste/Fahrtenbuch **10 J.** (§ 147 Abs. 1 Nr. 1 AO); Beginn jeweils 31.12. (§ 147 Abs. 4 AO), Ende „frühestens" wegen Ablaufhemmung § 147 Abs. 3 S. 5 AO. Storage folgt der Zeile, zu der die Datei gehört. `data_access_log`: nicht im Art.-17-Lauf, 12 Monate rollierend; DSGVO-Vorgangseinträge 3 J.; gehört in die Art.-15-Auskunft (EuGH C-579/21 v. 22.06.2023). Details, Tabelle, „gesperrt"-Definition und Texte: Abschnitt „2026-10-02" unten. Schließt den offenen Punkt `prescriptions` (Eintrag 17.09.2026) auf der Rechtsseite. | Kapalı (Rechtsfrage) — Umsetzung K1.4 offen; Purge bei Fristablauf (frühestens 31.12.2034) später mit `guvenlik` | Erster realer Löschantrag · Steuerberater widerspricht einer Kategorie (Fahrtenbuch, `abrechnung_zahlung`) · Gesetzgeber ändert § 630f Abs. 3 BGB oder § 147 Abs. 3 AO · Praxis verlangt Herausgabe + Volllöschung vor Fristablauf (→ Purge-Pfad nach Export nötig) |
| 2026-10-02 | **K1.4 Nachtrag — Fall B: automatischer Lauf bei Fristablauf (Rest löschen + Pflichtbestand sperren) ist auch OHNE nachgewiesenen Export zulässig, wenn die AVV ihn als Standardweisung festlegt. `mahnungen` → Sperrbestand, 6 J.** | Art. 28 Abs. 3 lit. g DSGVO: Löschen/Rückgabe nach Wahl des Verantwortlichen, die AVV darf eine Standardregel setzen; Rückgabe = Bereitstellung zum Abruf. Bedingungen: (a) die Klausel in Abschnitt „2026-10-02" §4 Satz 2 wird ersetzt durch: *„Vor der Sperrung wird dem Auftraggeber für 30 Tage eine vollständige Kopie in einem gängigen, maschinell auswertbaren Format zum Abruf bereitgestellt; nach Ablauf dieser Frist werden nicht aufbewahrungspflichtige Daten gelöscht. Die Herausgabe gesperrter Daten kann der Auftraggeber bis zum Fristablauf jederzeit verlangen."* — dazu im Antworttext Fall B „haben Sie vor der Löschung erhalten" → „wurde Ihnen vor der Löschung zum Abruf bereitgestellt"; (b) Hinweis per Kündigungsmail + Erinnerung ~7 Tage vor dem Termin; (c) der Sperrbestand bleibt herausgebbar. „Kein Auto-Lauf, unbegrenzt gesperrt" nur als Übergang ohne reale Kunden (K-14), auf Dauer gegen Art. 5 Abs. 1 lit. e. 24-h-Pflicht-Export im manuellen Weg = interne Absicherung, keine Rechtspflicht. `mahnungen`: § 257 HGB nicht anwendbar (keine Kaufleute), aber § 147 Abs. 1 Nr. 3, Abs. 3 S. 1, Abs. 4 AO (Geschäftsbrief, 6 J. ab 31.12. des Versandjahres) → aus „sofort löschen" in den Sperrbestand. Dashboard-Satz statt „§ 257 HGB 10 Jahre": *„Unterlagen mit gesetzlicher Aufbewahrungspflicht – Behandlungsdokumentation 10 Jahre (§ 630f BGB), Rechnungen 8 Jahre, Zahlungsaufzeichnungen 10 Jahre (§ 147 AO) – bleiben bis Fristablauf gesperrt erhalten."* | Kapalı — AVV-/dpa.html-Text + Cron-Neubau vor dem ersten realen Kunden offen (🟢 €0) | Erster realer Kunde vor Neubau des Crons · Mahngebühren werden als Erlös gebucht (dann Buchungsbeleg, 8 J.) · Steuerberater widerspricht |
| 2026-10-05 | **Online-Terminanfrage für die Box (Y3): zulässig; TI wird nicht umgangen. Praxura = Auftragsverarbeiter NUR für Portal + Chiffrat-Postfach; die Box selbst bleibt rollenlos (K6 unberührt).** | Heutiges SaaS-Modell (Patient gibt Verordnungsangaben selbst ein) ist zulässig: Art. 9 Abs. 2 lit. h DSGVO + § 22 Abs. 1 Nr. 1 lit. b BDSG (Anbahnung Behandlungsvertrag), Einwilligung als Rückfall. Y3 (Browser verschlüsselt mit Praxis-Schlüssel, wir sehen nur Chiffrat): Inhalt für uns ohne Schlüssel voraussichtlich kein Personenbezug (EuGH C-413/23 P, nicht erneut verifiziert), aber Metadaten (IP + Praxis + Zeit) = Art.-9-nah (C-582/14, C-184/20, C-21/23) → schmale **Portal-AVV** mit § 203-Abs.-3/4-Schweigepflichtklausel. TI: keine Pflicht für Patient→Praxis-Kommunikation (§ 360 Abs. 7/8/9 SGB V verifiziert: eVO-Pflicht Ärzte 01.01.2027, TI-Anbindung Heilmittelerbringer 01.10.2027, Token Papier/elektronisch). Bedingungen: Hosting Hetzner DE (nicht Vercel), SRI + Schlüssel-Fingerprint in der Box, IP ≤ 7 Tage gekürzt, Postfach-Löschung bei Abholung/max. 14 Tage, Foto optional + eigene Einwilligung + EXIF-Strip im Browser, Löschung bei Ablehnung. Box im eigenen Hetzner der Praxis kann die Seite selbst ausliefern (dann keine Rolle). Gleiche AVV-Logik für einen zentralen KI-Relay (maskierter Text bleibt personenbezogen, legal-de 02.10) → `/konsey` (KUTU_HAZIRLIK_SPRINT §3b). | Bewertung — Umsetzung offen (Konsey) | Anwalt (1–2 h): Metadaten unter § 393 SGB V? · eVO-Token über diesen Kanal → Zuweisungs-/Makelverbot? · Portal-AVV ausreichend oder „Transportdienst“ vertretbar? |
| 2026-10-05 | **B6 — Proprietäre `LICENSE` (Alle Rechte vorbehalten) für Repo + Box; Drittkomponenten ausgenommen; THIRD-PARTY-NOTICES vor erster Box-Auslieferung. FullCalendar-Premium mit NonCommercial-Schlüssel kommerziell genutzt → am selben Tag auf Standard-Bundle (MIT) umgestellt.** | Inhaber-Vermerk „Yavuz Kemal Demir, Inhaber der ausschließlichen Nutzungsrechte“ (nicht „Urheber“, § 29 UrhG; Grundlage Rechteübertragung 06.08.2026 — Abdeckung künftiger Beiträge Melihs von Kemal zu prüfen). §§ 69d/69e UrhG ausdrücklich unberührt (§ 69g Abs. 2). GitHub-ToS-Rechte (Ansehen/Forken) solange Repo public nicht abbedingbar. Box: Datei im Image + `install.sh`-Hinweis; Clickwrap erst mit K-11-Nutzungsvertrag. esbuild `--legal-comments=none` entfernte MIT/BSD-Hinweise aus `vendor/` → `eof` bzw. NOTICES. FullCalendar: `kalender.html` nutzte `resourceTimeGridDay` mit `CC-Attribution-NonCommercial-NoDerivatives` → Premium-Bundle durch `fullcalendar@6.1.11` Standard ersetzt (sha256 jsDelivr = unpkg), Ansicht „Team-Tag“ entfällt. | Kapalı (Text + FullCalendar) — LICENSE/NOTICES-Dateien offen (K2b.16) | Beteiligungsvertrag/UG überträgt Rechte · Repo-Split (public Teil eigene LICENSE) · Images werden selbst gebündelt statt vom Kunden gezogen (GPL-Quellangebot) |
| 2026-10-05 | **K-20 — KI über EIN Praxura-Azure-Konto + kurzlebige Entra-Token (Box → Azure direkt, kein Relay): legal-de-Veto vom 05.10.2026 („zentraler KI-Relay") für diese Variante AUFGEHOBEN → 🔧 KOŞULLU.** | Kein Praxura-System im Inhaltspfad → Einwand „Relay = Cloud-System i. S. d. § 393 Abs. 3 Nr. 2 SGB V" entfällt nach Wortlaut; Rolle Praxura = Auftragsverarbeiter (KI-Ausschnitt, opt-in), Microsoft = Unterauftragsverarbeiter; nur pseudonymisierte Strukturfelder, kein Freitext → § 203 „Offenbaren" weitgehend ausgeschlossen, Abuse Monitoring für diese Datenklasse tragbar. 7 Auflagen, 2 Anwaltsfragen, 3 Microsoft-Anfragen: Abschnitt „Nachtrag (4)" unten. | 🔧 Koşullu — v1 klein (fester Deckel, kein Stripe/Kredit, Beta gratis, opt-in, Betas starten mit KI aus); zuerst Serienplanung + Heilmittel-Normalisierung, Mail-Entwürfe erst nach Anwaltsantwort | Anwalt verneint Frage 1 oder 2 · Microsoft bestätigt C5-Scope/Bridge Letter nicht · Product Terms verbieten Token an Endkunden · Freitext/Namen/Geburtsdatum gelangen in den Prompt · ein Praxura-Server tritt in den Inhaltspfad · zustandsbehaftete Azure-Features werden aktiviert |

---

## Bilinçli risk kabulleri (Risikoakzeptanz)

Bilinen ama şu an düzeltilmeyen riskler. Ajan bunları tekrar tekrar uyarı olarak gündeme getirmez —
sadece durum değişirse veya yeni bir bulgu bunları ağırlaştırırsa değinir.

| Tarih | Risk | Neden şimdilik kabul | Gözden geçirme |
|---|---|---|---|
| 2026-09-12 | **§§ 87a ff. UrhG (sui generis Datenbankherstellerrecht) sorusu Kostenträgerdatei için EuGH'de açık — GKV-Spitzenverband'ın "wesentliche Investition"ı olabilir, biz kayıtların ~%100'ünü alıyoruz (§ 87b Abs. 1 "wesentlicher Teil" eşiği).** BGH (*Sächsischer Ausschreibungsdienst*, I ZR 261/03, 28.09.2006) § 5 UrhG'nin §§ 87a ff.'e analog uygulanacağı görüşünde, OLG Köln tersini savunuyor; EuGH bu soruyu hiç karara bağlamadı. | GKV-SV verinin bizzat kendi altyapısının (§302-Verfahren) çalışması için yayımlanan veriyi bir Abrechnungssoftware'e karşı §87b ile kovalaması sektörde görülmüş bir senaryo değil (negatif kanıt — doğrulanamadı, ama emare de yok). Site üzerinde açık bir yasak/lisans şartı yok, yalnız `© GKV-Spitzenverband`. On-prem'de kopya müşteriye ulaşıyor (SaaS'ta ulaşmıyordu) — fark var ama küçük, çünkü kullanım amacı aynı (§302-Verfahren). | **EuGH'nin bu soruyu karara bağlaması; GKV-Spitzenverband'ın kendi sitesinde açık bir yeniden-dağıtım yasağı/lisans şartı yayımlaması; bir Abmahnung/talep gelmesi.** Karar ve kaynaklar: `onprem/REGISTER.md` O-78 |
| 2026-08-28 | **Standort ayrımı podolojide veritabanı seviyesinde değil, uygulama seviyesinde.** `verordnungen`, `podologie_behandlungen`, `prescription_sessions`, `pat_fussbefund` tablolarında `business_id` kolonu yok; Standort hastadan türetiliyor (`lead_id → leads.business_id`) ve zuschnitt istemci tarafında yapılıyor. RLS yalnız **Mandantentrennung**'u (Auftraggeber A ≠ B) zorluyor — o duruyor. | İhlal riski bizde değil sorumluda doğar (Art. 32 Abs. 4: praxis içi erişim düzeni Verantwortlicher'ın organizasyon kararı; §203 StGB kapsamaz, aynı praxis çalışanı „berufsmäßig tätiger Gehilfe"). Bizim kusurumuz Art. 28 Abs. 3 lit. c olurdu — sorumluya kendi kararını uygulayacak tekniği vermemek — ve **o kapatıldı**: inhaber `data_sharing_settings.patients`'ı „ayrı" yaparsa liste artık ayrılıyor. Bugün çok-Standort'lu müşteri **yok** → Art. 33 bildirim yükümlülüğü doğmadı. Migration'ın 2–4 günlük Katman-4 maliyeti mevcut riskle orantısız. | **İlk çok-Standort'lu podoloji müşterisi sözleşme imzaladığında, onboarding'inden ÖNCE.** O anda dört tablo + 12 owner-geniş çağrı yeri + IK/LEGS Standort ekseni **tek parça** ele alınır. Karar ve kapsam: `konsey/tutanak/2026-08-28-podologie-standort-zuschnitt.md` |

---

## Açık hukuki maddeler (karara bağlanmamış)

`legal-de` ajanının çalışma listesi. Karara bağlananlar yukarıdaki tabloya taşınır.

- Google Fonts CDN → TDDDG § 25 / Art. 6 DSGVO (2026-06-02 audit'te açıldı)
- UStG § 19 Kleinunternehmer beyanı ile fiyat/fatura metinleri arasındaki tutarsızlık
- B2C Widerruf akışı (`widerruf.html` ile fiili akışın örtüşmesi)
- AVV / `dpa.html` Art. 28 boşlukları — alt işleyici zincirinin eksiksizliği
- n8n Sustainable Use License'ın ticari SaaS kullanımıyla uyumu
- BFSG Kleinstunternehmen istisnası — belgelenmedi, varsayılıyor
- EU AI Act Art. 50 şeffaflık işaretleri (UI'da "KI-generiert") — kapsam kontrolü
- MDR eşiği: mevcut KI özellikleri (rezept-validate, rezept-ocr) klinik karar desteği sayılır mı
- Onam şablonunda `praxis_kontakt` + `datenschutzbeauftragter` alanları praxis'ten beslenmiyor
  (Art. 13 Abs. 1 lit. a/b) → `compliance/legal-reviews/2026-08-14-einwilligungstexte-wortlaut.md`
- ~~`prescriptions`'ın `api/dsgvo.js`'te hard-DELETE yerine billed satırlar için ANONYMIZE_TABLES'a
  taşınması gerekip gerekmediği~~ → **Rechtsseite entschieden 02.10.2026 (K1.4):** behandelte oder
  abgerechnete Verordnungen sind Behandlungsdokumentation (§ 630f Abs. 3 BGB, 10 J.) → weder
  löschen noch anonymisieren, sondern **sperren**; unbehandelte/abgelehnte Verordnungen löschen.
  Technische Ausgestaltung (Feldkatalog) bleibt bei `gkv-302` + `db-ustasi`.
- **(29.09.2026, neu)** Praxuras eigene AVV (`compliance/AVV.md` §5.2, `dpa.html` §8) enthält
  **keine § 203-Abs.-3/4-StGB-Verpflichtung Praxuras selbst** und keine Weitergabepflicht an
  Unterauftragnehmer — unabhängig von STACKIT, betrifft das ganze SaaS. Textvorschlag im
  Abschnitt 2026-09-29 unten.
- **(29.09.2026, neu)** `compliance/VVT.md:64` und `AVV.md:161` behaupten für Azure einen
  „Zero-Data-Retention-Vertrag" — der wurde nie erteilt (Modified Abuse Monitoring abgelehnt).
  Überzogene Zusicherung → beim STACKIT-Update mit korrigieren.
- **(02.10.2026, neu)** `compliance/TOM.md:24` + `DSFA.md:52/85` versprechen MFA-Pflicht ab
  Go-Live, die laut K-12 nicht gebaut wird → Text auf „SaaS: vor ersten realen Patientendaten;
  Box: Verantwortung der Praxis" ändern, R4 neu bewerten (siehe Abschnitt 2026-10-02).

## 2026-08-27 — Beta-Kunden-Klarnamen im öffentlichen Repository

**Sachverhalt.** Das Repository ist öffentlich. In 34 Dateien (Quellcode-Kommentare,
Fortschrittsnotizen, Billing-Vorlagen, eine Migration) sowie in **4 Commit-Nachrichten**
standen die Klarnamen zweier Beta-Kunden mit Berufsangabe und Gesprächsdatum.
Keine Patientendaten, keine Gesundheitsdaten.

**Einordnung (legal-de).** Personenbezogene Daten nach Art. 4 Nr. 1 DSGVO.
**Art. 9 nicht einschlägig** — „Podologe" ist Berufsangabe, kein Gesundheitsdatum.
**§ 203 StGB nicht einschlägig** — geschützt ist das Patientengeheimnis, nicht der Name
der Praxisinhaber. Art. 6 Abs. 1 lit. f trägt die *interne* Dokumentation, **nicht die
öffentliche Veröffentlichung**: die Erforderlichkeit entfällt, weil ein Pseudonym
denselben Zweck erfüllt. Namentliche öffentliche Nennung wäre zudem Referenzwerbung
und bräuchte eine Einwilligung.

**Meldung.** Es handelt sich um eine unbefugte Offenlegung i. S. d. Art. 33.
Risikobewertung: keine Gesundheitsdaten, zwei betroffene Personen, die ohnehin eine
öffentlich auftretende Praxis führen → **voraussichtlich kein Risiko**, daher
**keine Meldung an die LDI NRW** (Ausnahme Art. 33 Abs. 1) und **keine Benachrichtigung**
der Betroffenen nach Art. 34. **Art. 33 Abs. 5: interne Dokumentation ist Pflicht** —
dieser Eintrag erfüllt sie.

**Entschieden.** Vollständige Entfernung aus Arbeitsbaum, Historie und Commit-Nachrichten;
Pseudonyme (Beta-1/Beta-2) ab sofort, Zitat und Datum bleiben erhalten; Zuordnung nur im
Drive-Ordner `meetings/`. Repository bleibt vorerst öffentlich (Vercel-Bruch vom
2026-06-10 ungelöst). Zusätzlich wird von beiden Kunden eine **schriftliche
Referenz-Einwilligung** eingeholt — liegt sie vor, entfällt die Rechtsfrage vollständig.

**Kein Vertragsbruch feststellbar:** unter `vertraege/` liegt keine
Vertraulichkeitsvereinbarung mit den Beta-Kunden (nur zwei Dokumente mit dem
Mitgründer). Das Fehlen einer schriftlichen Vereinbarung mit Beta-Kunden ist
separat zu prüfen.

Tutanak: `konsey/tutanak/2026-08-27-klarnamen-public-repo.md`

## 2026-09-03 — Angestellte dürfen Verordnungen und Behandlungsdokumentation lesen

**Ausgangslage.** Angestellte (`profiles.role = 'employee'`, verknüpft über
`profiles.owner_id`) durften die Termine ihrer Praxis lesen, die Verordnungen
(`verordnungen`) und die Behandlungsdokumentation (`podologie_behandlungen`) dagegen
nicht — die Policies verglichen `owner_id = auth.uid()`. Das war **keine Entscheidung**,
sondern eine nie geschlossene Lücke: der Menüpunkt „Verordnungen" ist in
`nav-registry.js` seit jeher auch für `employee` freigegeben, die Seite blieb für sie
aber leer. Der Physio-Verordnungstopf (`prescriptions`, `prescription_sessions`,
`prescription_documents`) arbeitet seit jeher mit Team-Zugriff; nur der Podologie-Topf
war der Ausreißer.

**Einordnung (legal-de).**
- **Art. 9 Abs. 2 lit. h i. V. m. Abs. 3 DSGVO, § 22 Abs. 1 Nr. 1 lit. b BDSG** tragen
  die Verarbeitung: der behandelnde Therapeut ist Personal unter Geheimhaltungspflicht,
  die Behandlung ist der Zweck selbst. Eine gesonderte Einwilligung ist nicht nötig.
- **§ 203 Abs. 3 S. 1 StGB:** kein Offenbaren, wenn Geheimnisse den „berufsmäßig tätigen
  Gehilfen" zugänglich gemacht werden. Physio-, Ergo-, Logopädie- und Podologie-Berufe
  sind über ihr jeweiliges Berufsgesetz (MPhG, ErgThG, LogopG, PodG) darüber hinaus
  **selbst** Geheimnisträger nach § 203 Abs. 1 Nr. 1. Die Lage des Inhabers verschlechtert
  sich durch den Zugriff nicht. Die bereits unterschriebene Verpflichtung auf das
  Datengeheimnis genügt.
- **§ 630f Abs. 2, § 630h Abs. 3 BGB:** die bisherige Sperre war rechtlich das größere
  Risiko. Wer nicht schreiben darf, dokumentiert nicht zeitnah und nicht aus erster Hand;
  eine unzureichende Dokumentation kehrt im Streitfall die Beweislast um.
- **AVV/DPA bleibt unberührt** — die Rollenverteilung innerhalb der Praxis ist eine
  Organisationsentscheidung des Verantwortlichen (Art. 32 Abs. 4 DSGVO), keine Frage der
  Auftragsverarbeitung.

**Entschieden.** Angestellte bekommen **Leserecht** auf `verordnungen` und
`podologie_behandlungen` ihres Inhabers, umgesetzt als zusätzliche SELECT-Policy nach dem
bestehenden `bookings`-Muster (Vergleich gegen `profiles.owner_id`, strikt innerhalb
desselben Mandanten). **Schreiben bleibt beim Inhaber**, aus drei Gründen:
1. `podologie_behandlungen` führt keine Spalte, die die behandelnde Person benennt — ein
   Schreibrecht ließe sich heute nur praxisweit erteilen, jeder könnte die Dokumentation
   jedes Kollegen ändern. Bei einer Dokumentation nach § 630f BGB die falsche Granularität.
2. Es gibt dafür keinen Bildschirm: die Podologie-Abrechnung ist owner-only.
3. `verordnungen.status` steuert die § 302-Kette und hat serverseitig eine
   Übergangsprüfung, an der ein Direktschreiben vorbeiginge.
Das Schreibrecht wird nachgezogen, sobald eine Spalte für die behandelnde Person
existiert (als Aufgabe erfasst).

**Sicherheitsvotum (guvenlik).** Kein Veto — die Mandantengrenze bleibt unberührt, es ist
eine Grenze *innerhalb* eines Auftraggebers. Registereintrag A-06 („fünf Tabellen ohne
Team-Zugriff") ist damit für zwei der fünf Tabellen geschlossen; `fußstatus`,
`patient_notes` und `warteliste` bleiben offen.

**Nebenbefund, mitentschieden.** Bei der Prüfung stellte sich heraus, dass `TOM.md` mit
„Audit-Log jedes Patient-Datenzugriffs" mehr zusicherte, als das Produkt leistet:
protokolliert werden die Zugriffe über die Backend-API und die DSGVO-Vorgänge, **nicht**
die Direktzugriffe des Dashboards auf die Datenbank. Der Umfang ist in TOM.md §1.3
richtiggestellt und als Risiko R17 in der DSFA erfasst. Eine zu weit gefasste Zusicherung
in einem TOM-Dokument ist selbst ein Mangel — deshalb korrigiert und nicht stehen gelassen.

**Mitlaufende Dokumentation.** `TOM.md` §1.3 (Rollen + Protokollumfang), `VVT.md`
Verarbeitung 3 (Zeile „Zugriff innerhalb der Praxis"), `DSFA.md` R16 und R17.
Eine neue DSFA nach Art. 35 wird nicht ausgelöst: weder neue Technologie noch neuer
Zweck noch neue Empfänger.

**Neubewertung ausgelöst durch:** ersten Kunden mit mehreren Standorten (die
Standorttrennung ist keine RLS-Zusicherung), oder wenn die Rolle `employee` auch an
nicht-klinisches Personal (Empfang) vergeben wird. Beide Auslöser sind identisch mit
denen des Eintrags vom 28.08.2026.

## 2026-09-17 — Team-Zugriff: `warteliste` und `patient_notes` freigegeben, `fußstatus` gegenstandslos (A-06 geschlossen)

**Fortsetzung des Eintrags vom 03.09.2026** (direkt darüber). Dort blieben drei der fünf
Tabellen aus Registereintrag A-06 offen; sie werden hier einzeln entschieden. Ops-Karte #253.

**1. `fußstatus` — keine Freigabe, die Frage stellt sich nicht.**
Die Tabelle ist **veraltet** (`db/REGISTER.md` → `fußstatus`: „niemand mehr im Code");
sie wird von keiner Stelle gelesen oder geschrieben und steht nur noch in der
Löschreihenfolge (`api/dsgvo.js:136,271`), damit Altbestände mitverschwinden. Der im
Ticket beschriebene Widerspruch ist eine **Namensverwechslung**: der Menüpunkt
„Fußbefund" (`nav-registry.js:110`, bereits `roles: ['owner','employee']`) hat die
Panel-Id `fussstatus`, seine Datenquelle ist aber `pat_fussbefund`
(`module/fussbefund.js`) — und die trägt mit `pat_fussbefund_owner_access [ALL] owner +
Team` längst vollen Team-Zugriff, lesend **und** schreibend. Angestellte Therapeuten
sehen und dokumentieren den Fußbefund heute schon. **Entschieden: keine Policy-Änderung.**
Stattdessen Altbestand zählen und die Tabelle löschen — Aufräumarbeit, keine Rechtsfrage;
der `api/dsgvo.js`-Eintrag bleibt bis zum Drop stehen.

**2. `warteliste` — Team bekommt SELECT, INSERT, UPDATE.**
Inhalt sind Kontaktdaten und Wunschzeiten, kein Befund; der Gesundheitsbezug entsteht nur
mittelbar über den Umstand der Behandlung bei einem Heilmittelerbringer (Art. 9 Abs. 1
DSGVO in der Auslegung des EuGH v. 04.10.2024, C-21/23 — deshalb wie ein Gesundheitsdatum
behandelt, aber die Erforderlichkeit ist hier am deutlichsten von allen drei Tabellen).
Rechtsgrundlage wie am 03.09.: **Art. 9 Abs. 2 lit. h i. V. m. Abs. 3 DSGVO, § 22 Abs. 1
Nr. 1 lit. b BDSG** — Terminorganisation ist Teil der Behandlungsorganisation;
**§ 203 Abs. 3 S. 1 StGB** — berufsmäßig tätiger Gehilfe, die Lage des Inhabers
verschlechtert sich nicht. **Schreibrecht wird hier — anders als am 03.09. —
mitentschieden**, weil die drei damaligen Gegengründe sämtlich entfallen: wer einen Termin
absagt, muss den frei werdenden Platz auch nachbesetzen dürfen (genau die im Ticket
beschriebene Reibung); ein Wartelisteneintrag ist **keine Dokumentation nach § 630f BGB**,
sondern eine Organisationsnotiz, also kein Granularitätsproblem; es gibt keine
Statusmaschine wie bei `verordnungen.status`, an der ein Direktschreiben vorbeiliefe.
**DELETE bleibt beim Inhaber** (Art. 5 Abs. 1 lit. d — ein fremder Wunsch soll nicht
unbemerkt verschwinden; Stornieren geschieht über `status`, nicht über Löschen).
⚠️ Ohne Oberfläche bleibt die Policy wirkungslos: `nav-registry.js` Zeilen 63, 92 und 126
führen `warteliste` heute als `roles: ['owner']` und müssen `employee` bekommen.

**3. `patient_notes` — Team bekommt SELECT, Schreiben bleibt beim Inhaber.**
Dieselbe nie geschlossene Lücke wie bei den Verordnungen: der Menüpunkt „Notizen" ist in
`nav-registry.js:65,95,128` seit jeher für `employee` frei, die Seite bleibt leer.
Zusätzlich liest das Terminfenster die Zeile (`module/termin-panel-patient.js:169`) — der
behandelnde Angestellte sieht dort heute stillschweigend ein leeres Notizfeld und weiß
nicht, dass eine Notiz existiert. Der Freitext ist die sensibelste der drei Tabellen; die
Freigabe trägt trotzdem, weil der Zweck identisch ist (Behandlung durch genau diese
Person, Art. 9 Abs. 2 lit. h) und die Alternative das größere Risiko wäre: der Therapeut
behandelt, ohne den Hinweis zu kennen, den der Inhaber notiert hat.
**Kein Schreibrecht**, aus zwei Gründen, die den drei Gründen vom 03.09. entsprechen:
(a) die Tabelle führt **keine Verfasserspalte**; (b) sie wird **pro Patient als genau eine
Zeile geführt und an Ort und Stelle überschrieben** (`dashboard.js:13825-13828`:
`.maybeSingle()` + UPDATE, zusätzlich `ai_summary` in `:13856`). Ein Team-Schreibrecht
hieße heute: jeder Kollege überschreibt die Notiz des Inhabers spurlos. Soweit die Notiz
überhaupt Behandlungsdokumentation ist, verlangt § 630f Abs. 1 S. 2 BGB, dass
Berichtigungen und der ursprüngliche Inhalt erkennbar bleiben. Das Schreibrecht wird
nachgezogen, sobald Verfasserspalte + Versionierung existieren — das Muster liegt mit
`pat_fussbefund` (`eintrag_id`/`version`/`ist_aktuell`) fertig vor.

**Umsetzung (für `db-ustasi`, eine Migration in `api-backend/db/migrations/`).**
Additive SELECT-/Schreib-Policies nach dem Muster `Employees can view team
podologie_behandlungen`; bestehende Owner-Policies bleiben unverändert (PERMISSIVE
Policies werden ODER-verknüpft, es wird nichts entzogen). Mandantenbezug strikt über
`profiles.owner_id`, nie über `business_id`:
- `patient_notes` (heute: `owner_only [ALL] USING (auth.uid() = owner_id)`) → **eine**
  neue Policy `Employees can view team patient_notes` [SELECT] USING
  `EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.owner_id = patient_notes.owner_id)`.
  Kein INSERT/UPDATE/DELETE.
- `warteliste` (heute: `Owner zugriff auf warteliste [ALL] USING (owner_id = auth.uid())`)
  → **drei** neue Policies mit demselben `EXISTS`-Ausdruck gegen `warteliste.owner_id`:
  `Employees can view team warteliste` [SELECT] USING …,
  `Employees can insert team warteliste` [INSERT] WITH CHECK … (der `EXISTS`-Ausdruck im
  WITH CHECK ist die Mandantensperre — ohne ihn könnte ein Angestellter Zeilen unter
  fremder `owner_id` anlegen), `Employees can update team warteliste` [UPDATE] USING …
  WITH CHECK …. **Kein DELETE.**
- `fußstatus`: **keine Änderung.** In SQL immer quoten (`"fußstatus"`).
- Danach `db/SCHEMA-RLS.sql` + `db/SCHEMA.sql` im selben Commit auffrischen; der
  HINWEIS-Block zu den „drei verbleibenden ⚠️ ohne Team-Zugriff"-Tabellen
  (`db/SCHEMA-RLS.sql:723-730`) ist gegenstandslos und wird ersetzt, ebenso die
  „Achtung"-Zeilen in `db/REGISTER.md` bei `warteliste` und `patient_notes`.

**AVV/DPA unberührt** — die Rollenverteilung innerhalb der Praxis ist eine
Organisationsentscheidung des Verantwortlichen (Art. 32 Abs. 4 DSGVO), keine Frage der
Auftragsverarbeitung. **Keine neue DSFA** nach Art. 35 (weder neue Technologie noch neuer
Zweck noch neue Empfänger). Mitlaufend: `VVT.md` Verarbeitung 3 (Zeile „Zugriff innerhalb
der Praxis") und `TOM.md` §1.3 um die beiden Tabellen ergänzen.

**Sicherheitsseite.** Kein Veto zu erwarten: die Mandantengrenze bleibt unberührt, es ist
eine Grenze *innerhalb* eines Auftraggebers, und in allen vier Policies steht der
`profiles.owner_id`-Vergleich. Registereintrag **A-06 ist mit diesem Eintrag vollständig
geschlossen**: zwei Tabellen am 03.09.2026, zwei hier freigegeben, eine gegenstandslos.

**Neubewertung ausgelöst durch:** die Rolle `employee` wird auch an **nicht-klinisches
Personal (Empfang)** vergeben — dann ist `patient_notes` der Punkt, an dem nachgeschärft
werden muss (Freitext ohne Behandlungsbezug beim Empfang ist von Art. 9 Abs. 2 lit. h
nicht mehr gedeckt), **nicht** `warteliste`, die für den Empfang gerade der richtige
Bildschirm ist; erster Kunde mit mehreren Standorten (die Standorttrennung ist keine
RLS-Zusicherung). Beide Auslöser identisch mit den Einträgen vom 03.09.2026 und
28.08.2026. Zusätzlich: sobald `patient_notes` eine Verfasserspalte und Versionierung
bekommt, wird das Schreibrecht ohne neue Grundsatzentscheidung nachgezogen.

## 2026-09-29 — KI-Rezept-OCR über STACKIT AI Model Serving (Ersatz für Azure)

**Anlass.** Azure praktisch zu: „Modified Abuse Monitoring" abgelehnt (nur Kunden mit
Microsoft Account Team); Microsofts §203-Zusatzvereinbarung setzt laut innFactory genau
diese Freigabe voraus. IONOS nur C5 Typ 1 + §203 unbeantwortet (Antwort 15.09.2026).
SaaS-KI ist aus; Beta-1 wurde am 18.09.2026 „KI aus bis C5 Typ 2" gesagt.
Anbieter: Schwarz Digits Cloud GmbH & Co. KG, Am Campus 1, 74177 Bad Friedrichshall,
HRA 741347 (NB Ziff. 2.1). Modelle Region EU01 (DE), OpenAI-kompatibel.

**Rollen.** SaaS: Praxura = Auftragsverarbeiter der Praxis, STACKIT = Unterauftrags-
verarbeiter Praxuras und „weitere mitwirkende Person" (§ 203 Abs. 4 S. 2 Nr. 2 StGB).
On-Prem BYO-Key: Praxis ↔ STACKIT direkt, Praxura **ohne Rolle** (K6 gewahrt, solange der
Aufruf direkt Box → STACKIT läuft und der Key in der Box liegt).

**Primärquellen (gelesen 29.09.2026).**
- § 393 SGB V, gesetze-im-internet.de: Abs. 1 (Leistungserbringer „sowie ihre jeweiligen
  Auftragsdatenverarbeiter"), Abs. 2 (Inland/EU + Niederlassung im Inland), Abs. 3 Nr. 2/3
  (C5-Testat der datenverarbeitenden Stelle + „korrespondierende Kriterien für Kunden"),
  Abs. 4 S. 2 (ab 01.07.2025 Typ 2), S. 3 (neu in Verkehr gebrachte Systeme: 18 Monate Typ 1
  genügt), S. 4/5 (vergleichbarer Standard, RVO BMG).
- § 203 Abs. 3, Abs. 4 S. 2 Nr. 1/2 StGB, gesetze-im-internet.de — **keine Formvorschrift,
  keine Belehrungspflicht** im StGB. Textform + Belehrung über strafrechtliche Folgen sind
  nur berufsrechtlich für bestimmte Berufe angeordnet (§ 43e Abs. 3 BRAO wörtlich geprüft;
  vergleichbar § 62a StBerG — nicht separat geprüft). Für Heilmittelerbringer existiert
  keine entsprechende Berufsnorm → Belehrung = Best Practice.
- STACKIT Nutzungsbedingungen v1.3.2, gültig ab 04.05.2026 (lokal `C:/tmp/stackit_nb.txt`):
  Ziff. 1.2 (nur Unternehmer § 14 BGB), 4.7 (Subunternehmer zulässig), 17.3/17.4
  (Konzernklausel Schwarz Gruppe = D. Schwarz Beteiligungs-KG, gilt für Ziff. 17), **18**
  (Verschwiegenheit über Inhaltsdaten mit Bezug auf § 203, Mitarbeiter + Subunternehmer-
  kette, Need-to-know), 19.2 (einseitige Änderung mit 8 Wochen Vorlauf, Schweigen =
  Zustimmung), 20 (Reselling). **Kein** Hinweis auf AVV/DPA in den NB.
- stackit.com/en/why-stackit/benefits/certificates: C5 Typ 2, AI Model Serving in der
  Produktliste (Hauptkontext verifiziert).
- docs.stackit.cloud AI Model Serving FAQ: „We do not store any customer data from the
  requests"; nichts zu Logs/Metadaten/menschlicher Prüfung.
- stackit.com/en/learn/knowledge/cloud-act: Selbstaussage „not subject" — keine
  unabhängige Prüfung.
- **Nicht lesbar (PDF-Binär, Werkzeuggrenze):** Leistungsschein AI Model Serving
  (V1.3, gültig ab 18.09.2025) und Servicebeschreibung v1.4. **Sekundärquelle** (neuost.ai,
  ex gewusst-ki.de) behauptet aus dem Leistungsschein: E-Mail-Adressen und User-IDs 30 Tage
  in Logdateien — **nicht verifiziert**, in der Mail abgefragt.

**Bewertung pro Frage.**
1. **§ 203 — 🟢 trägt.** Ziff. 18 ist eine Verpflichtung zur Geheimhaltung i. S. d. § 203
   Abs. 4 S. 2 StGB, inkl. Kette. Einbeziehung per Click-Through wirksam (B2B, § 310 Abs. 1
   BGB — § 305 Abs. 2 gilt nicht), Textform (§ 126b BGB) durch abrufbares/speicherbares
   Dokument (Ziff. 1.3) erfüllt, obwohl das StGB sie nicht einmal verlangt. Fehlende
   Strafbarkeitsbelehrung ist für Heilmittelerbringer **kein Mangel**; wir holen sie trotzdem
   kostenlos nach (Absatz in der Mail = dokumentierte Belehrung in Textform). Restrisiko:
   Ziff. 19.2 — STACKIT kann Ziff. 18 mit 8 Wochen Vorlauf ändern → Änderungsmails lesen.
   **Eigentliche Lücke liegt bei uns:** Praxuras AVV/DPA verpflichtet Praxura selbst nicht
   nach § 203 und regelt die Weitergabe an Subunternehmer nicht (siehe offene Punkte).
2. **AVV/DPA — 🟡 offen.** In NB kein AVV-Verweis; Standard-DPA von STACKIT im Portal
   üblich, aber **nicht verifiziert**; Subunternehmerliste nicht gefunden. Schwarz-Gruppe:
   Konzernspitze deutsch (NB 17.4, D. Schwarz Beteiligungs-KG, Neckarsulm) — kein US-Mutter-
   konzern. Die Gruppe hat allerdings US-Töchter (Lidl US); CLOUD-Act-Restexposition über
   Konzernkontrolle gilt als gering, ist aber nur durch STACKIT-Selbstaussage belegt → in
   Mail bestätigen lassen. Blocker bis DPA + Subunternehmerliste vorliegen.
3. **§ 393 — (a) SaaS 🟡 / (b) On-Prem 🟢.**
   (a) KI-Anteil: datenverarbeitende Stelle für den Modellaufruf ist STACKIT → C5 Typ 2,
   Inland-Niederlassung, Region DE = Abs. 2/3 für dieses Glied erfüllt. **Aber:** Praxura
   ist nach Abs. 1 selbst „Auftragsdatenverarbeiter" mit eigenem Cloud-System (Hetzner-VPS
   als Proxy, Supabase) und hat **kein eigenes C5**. Diese Lücke ist **nicht neu** — sie
   besteht für das gesamte SaaS seit 01.07.2025 und ist der Grund des On-Prem-Pivots
   (Eintrag 2026-07-06, Playbook K1). Die KI-Aktivierung **erweitert sie nicht**
   (derselbe Backend-/DB-Pfad trägt die Patientendaten ohnehin), sie **schließt sie aber
   auch nicht**. Folge: Gegenüber Beta-1 darf **nicht** „Praxura ist C5-testiert" gesagt
   werden, nur „der KI-Anbieter hat C5 Typ 2".
   (b) Praxis ↔ STACKIT direkt: Abs. 1 Leistungserbringer nutzt Cloud, STACKIT erfüllt
   Abs. 2/3. Praxis muss die „korrespondierenden Kriterien für Kunden" (Abs. 3 Nr. 3) selbst
   umsetzen → wir liefern eine Einseiter-Checkliste. **Kein Reselling** (Ziff. 20) und kein
   Key „von uns" — sonst Rolle + § 393 zurück (K6). *(→ durch Nachtrag (2) für die Variante
   B′ präzisiert: Rolle kommt zurück, § 393-C5-Pflicht Praxuras nach heutiger Auslegung
   nicht.)*
4. **„Nicht gespeichert" — 🟡.** Lücken: technische Logs (Inhalt bei Fehlern/Debug?),
   Metadaten, 30-Tage-Log-Behauptung, Abuse/Content-Filter, menschliche Prüfung, vorgelagerte
   WAF/CDN/DDoS-Dienstleister im Requestpfad (US-Anbieter?), Support-Zugriff, C5-Scope-
   Zeitraum, Prüfbericht mit Kundenkriterien. → Mail (Text in der Übergabe vom 29.09.2026).
5. **Sonstiges.** Keine Patienteneinwilligung nötig (Art. 9 Abs. 2 lit. h, § 22 BDSG;
   Auftragsverarbeitung; § 203 Abs. 3 S. 2 soweit erforderlich — nur Rezeptbild, nichts
   Zusätzliches senden). DSFA **aktualisieren**, nicht neu (DSFA.md:121 nennt Anbieter-
   wechsel selbst als Trigger). AI Act: kein Hochrisiko (Anhang III nicht einschlägig),
   Art. 50 Abs. 2 greift für reine Feldextraktion voraussichtlich nicht (Ausnahme
   unterstützende Funktion/keine wesentliche Veränderung — nicht abschließend geprüft);
   Art. 4 KI-Kompetenz (seit 02.02.2025) + UI-Hinweis „KI-Vorschlag, bitte prüfen" als
   billiger Nachweis. MDR-Frage bleibt eigener offener Punkt (unverändert durch
   Anbieterwechsel).

**Vor Aktivierung zwingend (alle 🟢 €0, Eigenarbeit):**
1. STACKIT-DPA im Portal abschließen/ablegen + Subunternehmerliste erhalten.
2. Schriftliche STACKIT-Antwort auf die Log/Abuse/Human-Review/WAF-Fragen; Ergebnis hier
   nachtragen. Solange „Inhalte können in Logs landen" nicht ausgeschlossen ist → nicht
   aktivieren.
3. § 203-Klausel in Praxuras AVV (`compliance/AVV.md` §5.2 + `dpa.html`) ergänzen.
4. Subunternehmerliste AVV §6 / `dpa.html` / `datenschutz.html:117-118` Azure → STACKIT;
   ZDR-Behauptung für Azure streichen; jede Beta-Praxis mit unterschriebenem AVV 30 Tage
   vorher informieren (AVV §5.4 Widerspruchsrecht).
5. VVT V-3 Empfänger/Drittland (VVT.md:63-65, :106), TOM.md:76, DSFA.md:27/R10 anpassen;
   Region jetzt „Deutschland (EU01)" statt „Sweden Central" — Patienten-Infotext der
   Einwilligung (Eintrag 2026-08-14 lit. c) entsprechend neue Textversion.
6. Beta-1 ehrlich informieren: KI-Anbieter mit C5 Typ 2 in DE, nicht „Praxura C5".

**Nice-to-have:** Einseiter „§ 393-Kundenkriterien" für On-Prem-Praxen; Kalender-Erinnerung
C5-Testat-Erneuerung (Typ-2-Berichte jährlich); UI-Hinweis „KI-Vorschlag"; optional 1 h
Anwalt (~€150–300, 🟢/🟡) nur zur Frage „§ 203-Kette SaaS ohne eigenes C5".

**Neubewertung ausgelöst durch:** STACKIT-Antwort mit Inhaltslogging oder menschlicher
Prüfung · Änderung NB Ziff. 18 · AI Model Serving nicht (mehr) im C5-Typ-2-Scope ·
Reselling-/„Key von uns"-Modell · Modellwechsel auf Nicht-EU01-Region · RVO nach § 393
Abs. 4 S. 5.

### Nachtrag (2), 29.09.2026 — Geschäftsmodell: ein Praxura-Konto, Projekt/Key je Praxis (B′) vs. STACKIT-Reselling (R)

**Vom Nutzer festgelegtes Modell B′.** Ein STACKIT-Konto von InfinityMade; je Praxis ein
eigenes STACKIT-Projekt mit projektgebundenem Token (eigenes Rate-Limit, eigene Kosten-
zeile, einzeln widerrufbar). Die Praxis eröffnet **kein** STACKIT-Konto. Request-Daten
laufen **direkt** Box/App → STACKIT-API, nie über Praxura-Server. Praxura rechnet mit
Marge gegenüber der Praxis ab.

**Wiedereröffnung — neue Tatsachen gegenüber 12.09.2026** (`konsey/tutanak/2026-09-12-onprem-ai-modeli.md`,
„B (anahtar bizden) ölü"): (i) der KI-Dienst selbst liegt im C5-Typ-2-Scope (damals IONOS
Typ 1 / Azure unbekannt); (ii) § 203-Klausel Ziff. 18 liegt vor; (iii) die Architektur ist
neu präzisiert: Praxura betreibt **kein** eigenes System im Datenpfad.

**1. Rolle in B′ — Auftragsverarbeiter, obwohl Praxura die Daten nie sieht.**
Vertragspartner und damit Weisungsgeber STACKITs ist InfinityMade (NB Ziff. 2.1, 4.5),
nicht die Praxis. Für die Praxis verarbeitet damit STACKIT *über uns*: Praxura ist
Auftragsverarbeiter (Art. 28 DSGVO, „Hauptauftragnehmer" ohne eigene Verarbeitungs-
handlung), STACKIT Unterauftragsverarbeiter (Art. 28 Abs. 2, 4). Das ist die Rolle, die
der On-Prem-Pivot vermeiden wollte — sie kommt für den KI-Ausschnitt **zurück**, aber
ohne Datenzugriff, also mit geringem tatsächlichem Risiko. § 203: Praxis verpflichtet
Praxura (Abs. 4 S. 2 Nr. 1), Praxura hat STACKIT verpflichtet (Nr. 2 — NB Ziff. 18,
gegenüber InfinityMade als Kunde).

**2. § 393 in B′ — keine eigene C5-Pflicht Praxuras nach Wortlaut, aber nicht
behördlich bestätigt.** § 393 Abs. 3 Nr. 2 knüpft das Testat an die „im Rahmen des
Cloud-Computing-Dienstes eingesetzten Cloud-Systeme". In B′ ist das **ausschließlich**
STACKIT AI Model Serving — C5 Typ 2. Praxura setzt kein Cloud-System ein (keine
Verarbeitung, kein Proxy, keine Speicherung; Projektanlage und Abrechnung sind keine
Verarbeitung von Gesundheitsdaten). Mein Veto vom 12.09. („Vertrag über uns → § 393
kommt zu uns zurück") stützte sich darauf, dass das **eingesetzte System** nicht testiert
war und dass wir als Direktanbieter der Leistung gelten — ersteres ist entfallen,
letzteres führt nach Wortlaut nur dann zur Testatpflicht, wenn wir ein eigenes Cloud-
System einsetzen. **Veto für B′ daher aufgehoben → 🔧 KOŞULLU.** Restunsicherheit: Die
Literatur (activeMind, Rödl) ordnet die Pflicht „dem, der die Leistung dem
Leistungserbringer direkt erbringt" zu — dort ging es um SaaS-Anbieter mit eigenem
System; unser Fall (reiner Vertragsmittler ohne System) ist nirgends behandelt. →
kurzes schriftliches Anwaltsvotum vor erstem bezahltem Rollout. Zusätzlich gilt für
Praxura als STACKIT-Kunde § 393 Abs. 3 Nr. 3: die **„korrespondierenden Kriterien für
Kunden"** aus STACKITs C5-Bericht (z. B. Key-/IAM-Verwaltung) muss **Praxura** umsetzen →
Prüfbericht anfordern.

**Neuer Blocker, gefunden in NB Ziff. 13.2 (wörtlich gelesen):** Der Kunde darf die
Services nicht „von Dritten nutzen lassen oder sie Dritten zugänglich machen", **erlaubt**
ist aber, sie „als Grundlage für eigene Produkte zu verwenden (z.B. Software as a Service
Dienste) und diese wiederum Endkunden des Kunden anzubieten"; Handeln der Endkunden wird
Praxura zugerechnet. Dazu Ziff. 9.4: Zugangsdaten nicht an unberechtigte Dritte. Ein Key,
der nur von Praxura-Software für die OCR-Funktion benutzt wird, ist vertretbar „eigenes
Produkt"; ein Key, den die Praxis aus der `.env` lesen und frei verwenden kann, ist
faktisch „Überlassung". → **schriftliche Freigabe STACKITs für „Projekt/Token je
Endkunde, eingebettet in unsere Software"** einholen (Frage 10 der Mail). Ohne sie: R.

**3. Model R (Reselling, Ziff. 20, vollständig gelesen).** Vertragspartner für das
Abonnement ist der Reselling-Partner (20.1), aber die NB gelten zwischen STACKIT und
Endkunde (20.3) → Ziff. 18 und DPA gelten **direkt** für die Praxis; Praxura =
Vertriebspartner mit Abrechnung (20.3 b) und **First-Level-Support** (20.3 c). Folgen:
- Die Praxis bleibt STACKIT-**Kunde** und muss sich im Portal **registrieren** (Ziff. 2.1
  zwingend; 2.2 erlaubt Einladungslink) inkl. Adresse, Rechnungsdaten und **USt-IdNr** —
  praktische Hürde: viele Heilmittelpraxen sind nach § 4 Nr. 14 UStG steuerfrei und haben
  keine USt-IdNr (ob Steuernummer genügt, unbekannt → Frage 12). **Der Wunsch „Praxis
  registriert sich nicht" ist mit R nicht erfüllbar**, nur auf einen Einladungslink
  reduzierbar.
- Rolle: Praxura bleibt aus Art. 28/§ 393 heraus, **solange** Support ohne Inhaltszugriff
  läuft und Praxura das Praxis-Konto nicht administriert. Ziff. 20.4 erlaubt STACKIT,
  „vertrauliche Informationen" des Kunden mit dem Reseller zu teilen — Inhaltsdaten
  (Ziff. 18) dürfen davon nicht erfasst sein → Frage 11.
- Partnerprogramm-Voraussetzungen (Mindestumsatz, Zertifizierung, Rechtsform):
  **nicht verifiziert** → Frage 13. Für einen Einzelunternehmer ungewiss.

**4. Empfehlung: B′ (mit Auflagen); R nur als Rückfallebene** — B′ erfüllt das Geschäfts-
modell, die Rolle ist beherrschbar (AVV-Vorlage existiert, kein Datenzugriff), R
verfehlt das Kernziel (Praxis muss sich registrieren) und hängt an unbekannten
Partnerbedingungen.
**Auflagen für B′ (vor erstem bezahltem Rollout):**
1. STACKIT schriftlich: Per-Praxis-Projekte/-Token in unserer Software sind nach
   Ziff. 13.2 zulässig (🟢 €0).
2. Datenpfad bleibt direkt Box/App → STACKIT; **nichts** (Inhalt, Antwort, Logs mit
   Inhalt) läuft über Praxura-Systeme — sonst setzt Praxura ein eigenes Cloud-System ein
   und § 393 kommt voll zurück. Für SaaS (app.praxura.de) gilt das **nicht**, siehe unten.
3. AVV Praxis ↔ Praxura als „KI-Zusatzmodul" inkl. § 203-Klausel (Text in der Übergabe
   vom 29.09.) und STACKIT als Unterauftragsverarbeiter; STACKIT-DPA ↔ InfinityMade im
   Portal; Weiterreichung der Pflichten Art. 28 Abs. 4 (🟢 €0).
4. C5-Prüfbericht mit Kundenkriterien anfordern und selbst umsetzen (🟢 €0, ~0,5–1 Tag).
5. Pro Projekt Quota/Kostenlimit (Zurechnung Ziff. 13.2 letzter Satz: Missbrauch des Keys
   durch die Praxis geht auf unsere Rechnung).
6. Anwaltsvotum, eine Frage: „Ist ein Vertragsmittler ohne eigenes System
   ‚datenverarbeitende Stelle' i. S. d. § 393 Abs. 3 Nr. 2 SGB V?" — ca. 1–2 h,
   **€300–600, 🟡**.
7. **Nicht von legal-de entscheidbar:** `onprem`-Veto G2 und `guvenlik`-Veto (Klartext-Key
   in der Box) aus dem 12.09.-Konsey stehen weiter; Projekt-Scope + Quota + Einzel-
   widerruf mindern das Schadensbild (Key-Leck = Kosten, kein Datenzugriff, da STACKIT
   nichts speichert) → **Konsey muss B′ neu verhandeln.**

**SaaS-Variante (app.praxura.de).** Browser → STACKIT direkt mit Praxis-Key: nein (Key im
Browser = Überlassung Ziff. 9.4/13.2 + Sicherheit). Also Aufruf über das Praxura-Backend
= klassisches „eigenes SaaS-Produkt" (Ziff. 13.2 ausdrücklich erlaubt), Praxura
Auftragsverarbeiter wie bisher, § 393-Lücke Praxuras eigenes System **wie bisher** (nicht
neu, nicht durch KI vergrößert). Per-Praxis-Projekte sind dort nur Kosten-/Limit-
Trennung, rechtlich egal.

**Kosten gesamt:** Vertrags-/Doku-Arbeit 🟢 €0 (~1–2 Tage Eigenarbeit); Anwaltsvotum 🟡
€300–600 einmalig; STACKIT-Nutzung tokenbasiert, bei heutigem Volumen vernachlässigbar.

**Neubewertung ausgelöst durch:** STACKIT lehnt Per-Praxis-Projekte nach Ziff. 13.2 ab
(→ R prüfen) · Anwalt verneint die Auslegung zu § 393 Abs. 3 Nr. 2 · ein Praxura-System
tritt in den Datenpfad · Behörden-/GKV-Äußerung zur Testatpflicht von Vermittlern.

### Nachtrag (3), 01.10.2026 — STACKIT hat abgelehnt

STACKIT hat sowohl den Startup-Vertrag als auch das reguläre Kundenkonto **nicht
freigegeben** (Grund nicht mitgeteilt, nicht nachgefragt). Die obige Bewertung bleibt als
Prüfstand erhalten, ist aber **gegenstandslos, solange kein Konto besteht**; Modell B′ ruht.
Produktiv bleibt Azure (Sweden Central). Web- und Rechtstexte nennen STACKIT nirgends —
keine Korrektur nötig. **Unabhängig von STACKIT weiter offen:** die zwei Punkte oben unter
„Offene Punkte" vom 29.09.2026 (§ 203-Verpflichtung in Praxuras eigener AVV; überzogene
Azure-„Zero-Data-Retention"-Aussage in `VVT.md`/`AVV.md`).

### Nachtrag (4), 05.10.2026 — Azure Token-Modell (K-20)

**Anlass / neue Tatsachen.** Der Konsey vom 05.10.2026 (`konsey/tutanak/2026-10-05-merkezi-praxura-servisi.md`,
KARARLAR Z. 11) hat den zentralen KI-Relay mit legal-de-Veto abgelehnt; der dort gewiesene
Ausweg („Schlüssel je Praxis") ist faktisch gescheitert (STACKIT 01.10.2026 abgelehnt,
eigenes Azure-Konto je Praxis unrealistisch). Neues Modell, rechtlich = B′ (Nachtrag 2) mit
Azure statt STACKIT: EIN Azure-OpenAI-Ressource im Praxura-Abo (Sweden Central, Standard,
gpt-4.1-mini); Backend stellt nur ein ~1-h-Entra-Token aus (Prüfung: Praxis aktiv, Kontingent);
die Box ruft Azure **direkt**; Backend erhält nur Zählwerte (Datum, Aufgabe, Token in/out).
Kein Inhalt über Praxura-Server. KI-Aufgaben nur Text: Serienplanung, Heilmittel-
Normalisierung, Terminbestätigungs-/Patienten-/Arzt-Mail-Entwurf. Rezeptfoto-OCR entfällt.
Konsey-Entscheidung: `konsey/tutanak/2026-10-05-ki-tek-hesap-jeton.md`.

**Bewertung.**
1. **Rolle — Auftragsverarbeiter (nur KI-Modul, opt-in), Microsoft Unterauftragsverarbeiter.**
   Praxura ist Vertragspartner/Weisungsgeber Microsofts; Datenzugriff fehlt, die Rolle bleibt
   (wie B′ Nr. 1). Praxen ohne aktiviertes Modul: Box bleibt rollenlos (K6).
2. **§ 393 SGB V — Einwand „Cloud-System" entfällt nach Wortlaut.** Eingesetztes Cloud-System
   ist allein Azure OpenAI; Token-Ausgabe/Kontingent/Zählung ist keine Verarbeitung von
   Gesundheits-/Sozialdaten. Restlücken: C5-Bericht 04/2025–03/2026, Azure OpenAI Fußnote 6
   (nur 01.04.–31.12.2025), Foundry-Zeile ganzer Zeitraum (Zuordnung = Schluss, nicht
   bestätigt); Berichtszeitraum endete 31.03.2026 → Bridge Letter. Abs. 3 Nr. 3:
   Kundenkriterien (CUEC) setzt **Praxura** um.
3. **Art. 9 / § 203 / Abuse Monitoring.** Pseudonymisierte Strukturfelder bleiben aus Sicht
   von Praxis/Praxura personenbezogen (Art. 9-Kontext); für Microsoft ohne Zuordnungsschlüssel
   ggf. nicht (EuGH C-413/23 P, relativer Ansatz) → AVV bleibt nötig, Risiko deutlich gesenkt.
   § 203: ohne Namen/Geburtsdatum/Kennnummern/Freitext und ohne Zuordnungsmöglichkeit beim
   Empfänger liegt nach h. M. kein „Offenbaren" vor (nicht gesichert → Anwaltsfrage 2).
   Abuse Monitoring (Learn „Data, privacy, and security", Stand 18.05.2026: Speicherung nur
   markierter Prompts in der Ressourcen-Geografie, menschliche Prüfung durch EWR-Mitarbeiter,
   SAW + JIT) ist für diese Datenklasse **tragbar** — dokumentierte Risikoakzeptanz.
   Rest: Box-IP + Terminzeit; ohne Praxiskalender kein vernünftiges Mittel zur Re-Identifikation.
4. **Veto-Gründe 05.10.:** Klartext beim Relay — entfällt · § 393 Cloud-System — entfällt
   (Wortlaut, Anwalt bestätigt) · AV-Rolle — bleibt, akzeptiert · Abuse Monitoring/§ 203 —
   weitgehend entfallen (Datenklasse) · guvenlik Freitext-Leck 13 % — entfällt (kein Freitext;
   guvenlik hat sein Veto für dieses Modell selbst aufgehoben, Register S-45) · K6 — gewahrt.
   **→ Veto aufgehoben, 🔧 KOŞULLU.**

**Auflagen (vor erster Aktivierung bei einer Praxis).**
1. Maskierung in der Box (M4) per **Allowlist, fail-closed**: nur freigegebene Strukturfelder;
   Freitext in diesem Modus technisch ausgeschlossen; Namen nur als Platzhalter (`{NAME}`),
   Alter statt Geburtsdatum, IK/LANR/Adresse/Versichertennummer/PLZ nie; Tests; Protokoll nur
   über die **Form** des Requests, nie den Inhalt.
2. Azure-Ressource: nur stateless `chat/completions`; **aus**: Stored Completions, Responses
   API mit `store`, Assistants/Threads, Files, Batch, Fine-Tuning (sonst Mandantenleck über
   gemeinsame Ressource). Deployment **Standard Sweden Central** (nicht Global/DataZone).
   Token: eigene RBAC-Rolle nur mit Inferenz-Datenaktion, eine Deployment, TTL ≤ 1 h.
3. Microsoft schriftlich: C5-Scope + Bridge Letter (s. u.); Professional Secrecy Amendment
   beantragt — bei Ablehnung Risikoakzeptanz hier nachtragen.
4. Dokumente (s. u.) vor Aktivierung fertig.
5. Schriftliches Anwaltsvotum (2 Fragen) vor erstem bezahlten Einsatz; Mail-Entwürfe erst
   nach Antwort (Konsey).
6. Microsoft Product Terms prüfen: Token-Ausgabe an Endkunden-Box = „Customer Solution"
   oder unzulässige Überlassung? Kontingent zusätzlich auf Azure-Seite begrenzen
   (Missbrauch innerhalb der Token-Laufzeit geht auf Praxuras Rechnung).
7. AI Act / MDR: UI-Hinweis „KI-Entwurf — bitte vor Versand prüfen", Mensch prüft vor
   Versand; Serienplanung setzt nur die ärztlich verordnete Frequenz um — schlägt sie je eine
   Therapiefrequenz vor, MDR-Neubewertung.

**Anwaltsfragen (ORG-Briefing, ca. 1–2 h, €300–600 🟡).**
1. „Ist ein Softwareanbieter, der als Vertragspartner von Microsoft lediglich kurzlebige
   Zugriffstoken ausstellt und selbst keine Inhaltsdaten verarbeitet, ‚datenverarbeitende
   Stelle' bzw. Einsetzender eines Cloud-Systems i. S. d. § 393 Abs. 3 Nr. 2 SGB V — und
   genügt Microsofts C5-Bericht (Azure OpenAI Fn. 6 / Foundry) samt Bridge Letter für
   Verarbeitungen ab 01.01.2026?"
2. „Liegt ein ‚Offenbaren' i. S. d. § 203 StGB vor, wenn ausschließlich pseudonymisierte
   Strukturfelder ohne Namen, Geburtsdatum, Kennnummern und Freitext an Microsoft gehen, das
   keinen Zuordnungsschlüssel besitzt, aber markierte Prompts durch EWR-Mitarbeiter prüfen
   lassen kann?"

**Microsoft-Anfragen (Support-Ticket, 🟢 €0).**
- C5: Bestätigung, dass gpt-4.1-mini Standard in Sweden Central im Scope „Microsoft Foundry /
  Azure Direct Models" liegt, und Bridge Letter für die Zeit nach 31.03.2026.
- Professional Secrecy Amendment (Deutschland) / Zusatzvereinbarung für Berufsgeheimnisträger
  zur MCA — inkl. Frage, ob sie Modified Abuse Monitoring voraussetzt.
- Product Terms: Zulässigkeit, Endkunden-Installationen per kurzlebigem Entra-Token auf die
  eigene Ressource zugreifen zu lassen („Customer Solution").

**Dokumente (nur vermerkt — Texte in VVT/AVV jetzt NICHT ändern).**
- Portal-AVV: Anlage „KI-Zusatzmodul" (Gegenstand = Allowlist-Felder, Microsoft Ireland als
  Unterauftragsverarbeiter, Art. 28 Abs. 4 Weitergabe, Art. 33-Meldekette, § 203-Abs.-3/4-
  Klausel Praxuras selbst).
- Art. 13-Baustein für die Patienteninformation der Praxis (Empfänger Microsoft, EU/Schweden,
  pseudonymisiert).
- VVT (neue/angepasste Tätigkeit KI-Modul), DSFA-Aktualisierung (Risiko gesenkt), TOM
  (Token-/RBAC-Maßnahmen, CUEC).
- „Zero-Data-Retention"-Behauptung in `VVT.md`/`AVV.md` streichen (offener Punkt 29.09.2026).
- TIA kurz: Microsoft-US-Mutter, DPF + SCC im Microsoft-DPA, pseudonymisierte Daten.

**Marketing-/Vertragssprache.**
Zulässig: „Optionales KI-Modul, standardmäßig deaktiviert" · „Übertragen werden nur
pseudonymisierte Strukturdaten — keine Namen, kein Geburtsdatum, keine Adresse, keine
Versicherten- oder IK-Nummer, kein Freitext" · „Die Inhalte laufen nicht über Server von
Praxura" · „Verarbeitung bei Microsoft Azure in Schweden (EU), Unterauftragsverarbeiter gemäß
AVV" · „KI-Entwurf — vor dem Versand prüfen" · „Der KI-Dienst ist vom Anbieter nach BSI C5
testiert" (**erst nach** Microsoft-Bestätigung).
Unzulässig: „anonymisiert" · „Keine Patientendaten verlassen die Praxis" (bei aktivem Modul
falsch; „100 % lokal"-Aussagen der Box mit „ohne optionales KI-Modul" einschränken) ·
„Praxura ist C5-zertifiziert" · „Zero Data Retention" / „keine Speicherung" / „Microsoft
sieht nichts" · „DSGVO-konform garantiert" · „KI prüft die Verordnung".

**Kosten.** Eigenarbeit 🟢 €0 (~2–3 Tage) · Anwalt 🟡 €300–600 einmalig · Azure tokenbasiert,
beim heutigen Volumen vernachlässigbar.

**Neubewertung ausgelöst durch:** siehe Tabellenzeile K-20.

## 2026-10-02 — Kutu-Hazırlık-Sprint K1.8 (2FA · Disk · S-31) und K1.4 (Löschung↔Aufbewahrung)

Anlass: `KUTU_HAZIRLIK_SPRINT.md` K1.8 und K1.4. Kurzfassungen in der Tabelle oben (vier
Zeilen vom 02.10.2026). Hier nur, was die Umsetzung braucht. Reale Patientendaten gibt es
nicht (K-14) — keine Altlast, alles wirkt nach vorn.

### 1. 2FA (K-12) — Was konkret zu tun ist

- **Box:** nichts. Kein 2FA, Kurulum-Kılavuzu erwähnt es nicht als Pflicht.
- **SaaS:** zwei billige Wege, einer muss vor ersten realen Patientendaten im SaaS gewählt sein:
  (a) Supabase-Auth-TOTP für `role='owner'` erzwingen (🟢 €0, ~1 Tag, kein neuer Dienst,
  GoTrue self-hosted kann es auch → G8-neutral); oder (b) `TOM.md:24` und `DSFA.md:52/85`
  ehrlich umschreiben: „MFA nicht umgesetzt; Ausgleich: Rate-Limit auf Login, Mindestlänge
  Passwort, Sitzungsablauf; Restrisiko R4 bewusst getragen bis <Auslöser>". Heute **(b)**,
  weil SaaS keine realen Patientendaten trägt und die Box das Zielprodukt ist.
- Kein Anwalt nötig.

### 2. Festplattenverschlüsselung (K-6) — Empfehlungssatz für `onprem/KURULUM.md`

> **Datensicherheit des Rechners.** Für die Sicherheit des Rechners, auf dem Praxura läuft,
> ist Ihre Praxis als Verantwortliche verantwortlich (Art. 32 DSGVO). Wir empfehlen dringend,
> die Festplatte vollständig zu verschlüsseln (Windows: BitLocker bzw. Geräteverschlüsselung,
> Linux: LUKS) und Sicherungskopien nur verschlüsselt abzulegen – sonst sind die
> Patientendaten bei Diebstahl oder Verlust des Geräts oder der Sicherungsplatte lesbar.

(Hinweis für den Kılavuz-Autor: Windows 11 **Home** hat kein volles BitLocker, nur
„Geräteverschlüsselung" auf geeigneter Hardware — deshalb „bzw.".)

### 3. S-31 — Lebenszyklus der Dateien im Bucket `abrechnungen`

| Stufe | Datei | Was passiert | Wann |
|---|---|---|---|
| Entwurf | `.dta` (unsigniert) | löschen, wenn neu erzeugt/storniert (kein Beleg) | sofort |
| signiert | `.p7m` (SignedData, Inhalt eingebettet) | **behalten — Aufbewahrungsobjekt** | 8 J. ab 31.12. des Einreichungsjahres |
| signiert | `.dta` daneben | löschen (inhaltsgleich in `.p7m`), SHA-256 in `abrechnung` | nach erfolgreicher Signatur |
| verschlüsselt | `.dta.enc.p7m` | löschen, SHA-256 + Übermittlungsprotokoll bleiben | nach Annahme/Quittung der DAS |

Für `guvenlik`: V7 wird so umgebaut; der Rest von S-31 (V1–V6, V8) bleibt. Der Klartext im
Bucket ist damit befristet statt unbefristet — das schließt S-31 (b).

### 4. K1.4 — Löschung↔Aufbewahrung

**Zwei verschiedene Fälle — nicht vermischen:**

| Fall | Wer ist Verantwortlicher | Norm für „nicht löschen" |
|---|---|---|
| A. Patient verlangt Löschung bei seiner Praxis (Box **und** SaaS) | Praxis | Art. 17 Abs. 3 lit. b DSGVO → Einschränkung statt Löschung |
| B. Praxis löscht ihr Praxura-Konto (nur SaaS, = Vertragsende) | Praxis für Patientendaten (wir: Art. 28 Abs. 3 lit. g); **wir** für Inhaber-/B2B-Daten | Patientendaten: nur auf Weisung der Praxis → AVV-Klausel; unsere eigenen Rechnungen an die Praxis: unsere § 147 AO / § 14b UStG-Pflicht (8 J.) |

**AVV-Klausel (Almanca, für `compliance/AVV.md` / `dpa.html`, Abschnitt Vertragsende) — macht
das Sperren in Fall B zur Weisung der Praxis:**

> Nach Beendigung des Vertrags werden personenbezogene Daten, für die den Auftraggeber
> gesetzliche Aufbewahrungspflichten treffen (insbesondere § 630f Abs. 3 BGB, § 147 AO,
> § 14b UStG), auf Weisung des Auftraggebers bis zum Ablauf der jeweiligen Frist gesperrt
> verwahrt und anschließend gelöscht. Vor der Sperrung erhält der Auftraggeber eine
> vollständige Kopie in einem gängigen, maschinell auswertbaren Format. Der Auftraggeber
> kann jederzeit die erneute Herausgabe oder – nach Herausgabe – die vollständige Löschung
> verlangen.

**Fristen (Fristbeginn immer 31.12. des maßgeblichen Jahres; Ende „frühestens", weil die
Ablaufhemmung nach § 147 Abs. 3 S. 5 AO Sache der Praxis ist):**

| Kategorie | Tabellen / Storage | Frist | Fundstelle | Maßgebliches Jahr |
|---|---|---|---|---|
| Behandlungsdokumentation | `podologie_behandlungen`, `anamnese`, `pat_fussbefund`, `messreihen`, `patient_notes`, behandelte/abgerechnete `prescriptions` + `prescription_sessions` + `prescription_documents`; Storage: Rezept-Scans (`prescriptions`) behandelter VO, `patient-documents` mit Behandlungsbezug | 10 J. | § 630f Abs. 3 BGB | letzte Behandlung des Patienten |
| Einwilligungen | `patient_consents` | 10 J. | § 630f Abs. 3 BGB, Art. 7 Abs. 1 DSGVO (Eintrag 14.08.2026) | letzte Behandlung |
| Rechnungen / Buchungsbelege | `invoices`, `ausfallrechnungen`, `abrechnung`, `abrechnung_zeile`, `abrechnung_uebermittlung`; Storage: Rechnungs-/Beleg-PDFs in versandter Form, signierte `.p7m` | 8 J. | § 147 Abs. 1 Nr. 4, Abs. 3 S. 1 AO; § 14b Abs. 1 UStG (je i. d. F. BEG IV) | Ausstellung/Einreichung |
| Grundaufzeichnungen | `rechnung_zahlungen`, `abrechnung_zahlung`, `belegliste`, `zuzahlung_korrekturen`, `fahrten` **+** `fahrten_aenderungen` (Fahrtenbuch, konservativ) | 10 J. | § 147 Abs. 1 Nr. 1, Abs. 3 AO | letzte Eintragung |
| Patienten-Stammsatz | `leads` — **nur** auf das reduziert, was die gesperrten Unterlagen zuordenbar hält (Name, Geburtsdatum, Versichertennummer, Anschrift soweit in Rechnung/Abrechnung); Telefon, E-Mail, Notizen, Tags u. ä. löschen | wie längste abhängige Kategorie | Art. 5 Abs. 1 lit. c, e DSGVO | — |
| alles andere | `bookings`, `warteliste`, `booking_requests`, `email_logs`, `mahnungen`, Kalender-/Stammdaten usw.; Scans unbehandelter/abgelehnter VO | sofort löschen | Art. 17 Abs. 1 | — |

**Korrekturen am heutigen `api/dsgvo.js`:**
1. `anamnese`, `pat_fussbefund`, `messreihen`, `patient_notes`, `prescription_documents`,
   `prescription_sessions`, `prescriptions` (behandelt/abgerechnet) stehen in `DELETE_TABLES`
   (`api/dsgvo.js:283-289`) — das sind Behandlungsdokumentation → in den Sperrbestand.
   Löschen wäre Verstoß gegen § 630f Abs. 3 BGB der Praxis (für uns: Weisungsverstoß), und
   das schwerere Risiko als Überaufbewahrung (Beweislastumkehr § 630h Abs. 3 BGB).
   Tabellenzuordnung im Detail mit `db-ustasi` bestätigen.
2. `fahrten` wird gelöscht, `fahrten_aenderungen` bleibt — ein Änderungsprotokoll ohne
   Fahrtenbuch ist sinnlos. Beide zusammen in den Sperrbestand.
3. `leads` nicht löschen, solange abhängige gesperrte Unterlagen existieren — auf den
   Minimalsatz reduzieren (siehe Tabelle).
4. Antwort: ein Ergebnis, bei dem **nur** der Sperrbestand stehen bleibt, ist ein
   **Erfolg** („teilweise gelöscht", 200 + Liste + Daten), kein 500. 500 bleibt für
   unerwartete Reste (das ehrliche Verhalten vom 28.08.2026 bleibt erhalten).
5. Storage (S-32): je Bucket `list` + `remove` im Mandantenordner, **ausgenommen** Objekte
   des Sperrbestands. Dafür muss jede Datei ihrer Zeile zuordenbar sein (Pfad mit ID
   oder Pfad-Spalte) — wo nicht, `db-ustasi` fragen.
6. Eine einzige Klassifizierungsquelle (Tabelle → Kategorie → Frist → Fundstelle), aus der
   Löschkette, Antworttext und Auskunft lesen — damit die Liste nicht dreimal driftet.
7. Fall B / Stripe: `api/dsgvo.js:460-467` löscht den Stripe-Customer. **Vorher prüfen**
   (Kemal, 15 min im Stripe-Dashboard), ob Praxuras eigene Rechnungen an die Praxis danach
   abrufbar bleiben; wenn nicht, Rechnungs-PDFs vorher exportieren oder den
   Customer-Delete streichen — das sind **unsere** Buchungsbelege (8 J.).

**„Gesperrt" heißt technisch (Art. 18-Logik, Art. 4 Nr. 3 DSGVO):**
1. Kennzeichen je Datensatz bzw. je Patient: `gesperrt_am`, `gesperrt_bis`, Grundlage
   (Fundstelle). Ob Spalte oder eigene Tabelle: `db-ustasi`.
2. Aus **allen** operativen Wegen ausgeblendet: Listen, Suche, Kalender, Warteliste,
   Erinnerungen/Mails, KI, Statistik, Abrechnungsvorschläge, Exporte für andere Zwecke.
3. Keine Änderung (die bestehenden GoBD-/§ 630f-Trigger leisten das schon — **nicht
   anfassen**).
4. Lesen nur über einen ausdrücklichen Weg mit Zweckangabe (Betriebsprüfung, Haftungsfall,
   Auskunft) und Protokolleintrag; in Fall B nur auf Anforderung der Praxis über Support.
5. Art.-15-Auskunft enthält gesperrte Daten weiterhin (mit Sperrvermerk).
6. Bei Fristablauf: Löschung je Datensatz. Dafür braucht es später einen engen Purge-Weg
   („DELETE nur wenn `gesperrt_bis` < heute") — berührt die GoBD-Sperre, daher **mit
   `guvenlik`** und erst bei Bedarf: frühester denkbarer Ablauf ist der 31.12.2034
   (8 J. für Belege aus 2026). Nicht Teil von K1.4. Zeitgesteuerte Jobs in der Box →
   vorher `onprem`.

**Antworttexte (Almanca):**

*Fall B — Konto gelöscht (SaaS, an die Praxis):*
> Ihr Konto wurde gelöscht – mit einer Ausnahme: Für die folgenden Unterlagen bestehen für
> Ihre Praxis gesetzliche Aufbewahrungspflichten. Wir verwahren sie in Ihrem Auftrag
> gesperrt (kein Zugriff, keine weitere Verarbeitung) und löschen sie nach Fristablauf
> automatisch:
> • Behandlungsdokumentation, Verordnungen und Einwilligungen (§ 630f Abs. 3 BGB) – gesperrt bis frühestens 31.12.JJJJ
> • Rechnungen und Abrechnungsdateien (§ 147 Abs. 1 Nr. 4 AO, § 14b UStG) – gesperrt bis frühestens 31.12.JJJJ
> • Zahlungsaufzeichnungen und Fahrtenbuch (§ 147 Abs. 1 Nr. 1 AO) – gesperrt bis frühestens 31.12.JJJJ
> Eine vollständige Kopie dieser Unterlagen haben Sie vor der Löschung erhalten. Auf
> Anforderung (z. B. bei einer Betriebsprüfung) stellen wir sie erneut bereit oder löschen
> sie nach Herausgabe vollständig.

*Fall A — Patient (die Praxis antwortet, Art. 12 Abs. 4 DSGVO):*
> Ihre Daten wurden gelöscht, soweit keine gesetzliche Aufbewahrungspflicht besteht. Ihre
> Behandlungsdokumentation müssen wir nach § 630f Abs. 3 BGB zehn Jahre nach Abschluss der
> Behandlung aufbewahren, Rechnungen nach § 147 AO acht Jahre. Diese Daten sind bis dahin
> gesperrt und werden ausschließlich zur Erfüllung dieser Pflichten verwendet; danach
> werden sie gelöscht.

**`data_access_log`:**
- **Nicht** Teil des Art.-17-Laufs: es ist Nachweis nach Art. 5 Abs. 2 / Art. 32 und
  dient selbst der Löschkette (Sperre gegen Doppelantrag, `api/dsgvo.js:436-441`).
- Eigene Frist, keine gesetzliche: **Zugriffsprotokolle 12 Monate rollierend**, dann löschen
  (Art. 5 Abs. 1 lit. e; Wert praxisüblich, nicht normiert). **Einträge zu DSGVO-Vorgängen**
  (`dsgvo_deletion`, `dsgvo_export`) **3 Jahre** ab Jahresende (Regelverjährung §§ 195, 199
  BGB — Nachweis, dass der Antrag bearbeitet wurde); Inhalt minimal, keine Patientendaten
  in `metadata`.
- In die **Art.-15-Auskunft aufnehmen** (heute bewusst ausgelassen, `api/dsgvo.js:172-174`):
  Protokolldaten über Zugriffe auf die eigenen Daten gehören dazu (EuGH C-579/21,
  *Pankki S*, 22.06.2023) — Datum, Aktion, Ressourcentyp; Identität einzelner Mitarbeiter
  nur, wenn zur Rechtswahrnehmung nötig.
- Rollierende Löschung ist ein zeitgesteuerter Job → in der Box vorher `onprem`.

**Kosten:** alles 🟢 €0 (Eigenarbeit; K1.4-Code ~1–2 Tage, Doku ~1 h). Kein Anwalt nötig.
Optional eine Frage an den Steuerberater (im Rahmen der ohnehin offenen Kassenbuch-Frage vom
17.09.2026, kein Zusatzhonorar zu erwarten): „Fahrtenbuch und Zahlungseingänge zur
GKV-Sammelabrechnung — 8 oder 10 Jahre?"

**Neubewertung ausgelöst durch:** siehe Tabellenzeilen oben.

---

## 2026-10-05 · KHS M2 — BG, Praxisstempel, Praxis-Datenschutztext, Rechnungsangaben (legal-de, Sitzung Hat M)

> Einschätzung, keine Rechtsberatung. Kein Veto. Kosten 0 € (Eigenarbeit); Anwalt nur für die zwei Fragen aus Nachtrag (4).
> Geprüft (Primärtext): § 201 SGB VII, § 100 SGB X, § 14 UStG, §§ 33/34a UStDV. EuGH C-413/23 P über Sekundärquellen.

### F1 — BG / Arbeitsunfall (Podologie)
- Kein DGUV-Vertrag für Podologie gefunden (Sekundärquelle + DGUV-Vergütungsseite, Negativbefund — **nicht verifiziert**); UV-Träger zahlt nach **Kostenzusage im Einzelfall**. Keine Abrechnung über § 302/DTA. Rechnungsempfänger = UV-Träger.
- Praxura baut **keine Unfallmeldung** (Arbeitgeber/Arzt-Sache; § 201 SGB VII gilt nicht für Heilmittelerbringer).
- Offenbarung an UV-Träger: Art. 9 Abs. 2 lit. h DSGVO + § 22 BDSG; **§ 203 StGB** braucht eigene Befugnis → **ausdrückliches, dokumentiertes Einverständnis** (§ 100 Abs. 1 SGB X). Wortlaut: „Ich bin damit einverstanden, dass die Praxis die für die Abrechnung erforderlichen Angaben zu meiner Behandlung (Name, Geburtsdatum, Unfalltag, Behandlungsdaten und -leistungen) an den zuständigen Unfallversicherungsträger übermittelt und diesem auf Anforderung die zur Prüfung erforderlichen Auskünfte erteilt (§ 100 SGB X). Ohne dieses Einverständnis kann die Behandlung nur privat abgerechnet werden."
- Einschränkungen: **keine** Diagnose/Befunde/Fotos auf der BG-Rechnung (außer Träger fordert im Einzelfall), **keine** festen BG-Preise, Patientenanschrift standardmäßig aus, ohne Kostenzusage nur Warnung (warnen, nicht blockieren). Produktentscheidung: `Podoloji/PRODUKT-ENTSCHEIDUNGEN.md` PE-006 B.
- Abweichung legal-de ↔ podoloji (Kostenzusage/Unfalltag Pflicht vs. weich) entschieden in PE-006: Pflicht erst beim Rechnungserstellen für UV-Träger + Unfalltag; Kostenzusage + Einverständnis = Warnung.

### F4 — Digitaler Praxisstempel
- Rechtlich **optional** (weder UStG noch GoBD verlangen ihn; Name/Anschrift als **Text**). Gefahr: Stempel mit eingescannter Unterschrift → UI-Hinweis „Bitte laden Sie einen Stempel ohne Unterschrift hoch. Eine eingescannte Unterschrift ersetzt keine Unterschrift und erhöht das Missbrauchsrisiko."
- Privater Speicherort (nicht `avatars`), beim Erzeugen des Belegs **eingebettet** (GoBD: alte Rechnungen bleiben reproduzierbar). Logo darf öffentlich bleiben. Technik: `guvenlik/REGISTER.md` S-47-Bedingungen / PE-006.

### F6 — Praxis-Datenschutztext für Patienten (`module/einwilligung-texte.js`, v2 `datenschutz-v2-2026-10-01`)
- Fehler heute: „Server in Deutschland" für die Box falsch; „nicht an Dritte weitergegeben" falsch bei KI/BG/Abrechnungsstelle/Steuerberater; Microsoft fehlt als Empfänger bei aktivem KI-Modul (EuGH C-413/23 P: Empfänger sind aus Sicht des Verantwortlichen zu nennen, auch bei Pseudonymisierung); Tippfehler „außchliesslich"; DSB-Kontakt und „Pflicht zur Bereitstellung" (Art. 13 Abs. 2 lit. e) fehlen.
- Wortlaut-Bausteine je Konfiguration (Box / SaaS / KI aktiv / BG) — Entwurf in der Sitzung von legal-de, Umsetzung M2.8 mit **neuer `version`** (Hash = Nachweis). Vorläufig bis Anwaltsantwort (Nachtrag 4, Auflage 5): **keine Mail-Entwürfe** im KI-Baustein, **kein C5-Satz**, § 203-Halbsatz im SaaS-Absatz nur wenn die Klausel in Praxuras AVV steht, verboten: „anonymisiert", „keine Patientendaten verlassen die Praxis", „keine Speicherung", „Zero Data Retention". `{{saas_hosting_satz}}` offen (aus AVV/Unterauftragsverarbeiter-Liste, „Server in Deutschland" für Supabase nicht geprüft).
- Bestandspatienten v2: bei späterer KI-Aktivierung Aushang genügt (Rechtsgrundlage nicht Einwilligung).

### F7 — Angaben auf Rechnungen (Grundlage Fortschrittsring M2.6)
- **Pflicht:** Praxisname + vollständige Anschrift · Inhabername (bürgerlich, Einzelpraxis) · Steuernummer **oder** USt-IdNr. · Steuerstatus **gewählt** (nie automatisch, Konsey 10.08.) · Hinweistext zur Steuerbefreiung (`tax_exempt_note`, § 4 Nr. 14 lit. a UStG bzw. § 19 UStG).
- **Soll (Ring „empfohlen", blockiert nie):** IBAN/BIC/Bankname · Zahlungsziel · Telefon/E-Mail · IK (**bei BG-Rechnung Pflicht**). „Podologin/Podologe" nie als Vorbelegung (geschützte Berufsbezeichnung, PodG).
- **Optional:** Logo, Stempel, Fußzeile. **Nicht im Ring:** E-Rechnung/XRechnung/ZUGFeRD.
- Von der Software selbst erzeugt (Tests, nicht Ring): Rechnungsnummer, Ausstellungs-/Leistungsdatum, Menge/Art, Entgelt nach Steuersatz, Empfänger.
- Rechnungstexte einmal vom Steuerberater der Pilotpraxis gegenlesen lassen (~0,5 h, Praxis).

### 2026-10-06 · KHS M2.8 umgesetzt — Praxis-Datenschutztext v3 (`module/einwilligung-texte.js`)
- **Version:** `datenschutz-v3-2026-10-06` (v2 `…-2026-10-01` bleibt als Nachweis der früheren Einwilligungen; der Text wird je Einwilligung in `patient_consents.text_snapshot` eingefroren). `foto-v2-2026-10-06` nur wegen des Tippfehlers „außchliesslich“.
- **Umgesetzt nach F6 (legal-de 05.10.):** „Server in Deutschland“ und „nicht an Dritte weitergegeben“ entfernt; Absatz **Praxissoftware** je Betrieb (`betrieb: 'kutu'` = Box, Praxis allein verantwortlich, Hersteller ohne Zugriff / `'saas'` = Auftragsverarbeiter nach Weisung, **ohne** § 203-Halbsatz — der steht erst, wenn die Klausel in Praxuras eigener AVV steht — und **ohne** Hosting-Ort, den niemand geprüft hat); **Empfänger** (Kasse, UV-Träger, Arzt, Steuerberater, „andere nur mit Einwilligung/Gesetz“); **Pflicht zur Bereitstellung** (Art. 13 Abs. 2 lit. e); Datenschutzbeauftragte(r) nur wenn `dsb_kontakt` gesetzt.
- **KI-Absatz (Microsoft als Empfänger, EuGH C-413/23 P)** ist im Text, aber **aus**: `kiAktiv` steht im Aufrufer (`patienten-einwilligung.js`) fest auf `false`, bis das KI-Modul pro Praxis einschaltbar ist (K-20 / M4.11, Opt-in, Standard aus). Beim Einschalten genügt für Bestandspatienten ein Aushang (legal-de: Rechtsgrundlage ist nicht die Einwilligung). Vorläufig bis zur Anwaltsantwort (Nachtrag 4, Auflage 5): keine Mail-Entwürfe im Text, kein C5-Satz. Test sperrt „anonymisiert“, „keine Patientendaten verlassen die Praxis“, „keine Speicherung“, „Zero Data Retention“.
- **Offen:** `{{saas_hosting_satz}}` (Ort/Anbieter des SaaS-Hostings) aus der Unterauftragsverarbeiter-Liste; DSB-Kontakt hat noch keine Einstellung (Parameter vorhanden, kein Feld); Rechnungstexte (F7) einmal vom Steuerberater der Pilotpraxis gegenlesen lassen.

### 2026-10-06 · KHS M2 — Gegenlesung (legal-de) und Folgen
- **BG „warnen statt blockieren“** ist als Risikoakzeptanz zulässig, wenn **beim Erstellen der Rechnung** auf fehlendes Einverständnis (und fehlende Kostenzusage) hingewiesen wird — umgesetzt (`bgHinweiseBeiRechnung`, Toast, nicht blockierend). **Nachweis:** zu `bg_einverstaendnis_am` wird die Wortlaut-Version `bg-einverstaendnis-v1-2026-10-05` gespeichert (`bg_einverstaendnis_version`, Migration 0070). **Offen:** ausdrückliche Protokollierung der Risikoakzeptanz („trotzdem fortgefahren“) — es gibt noch keinen Protokollweg dafür.
- **Datenschutztext v3 korrigiert:** Steuerberater-Satz („Rechnungen, jedoch ohne Befunde und Diagnosen … ebenfalls zur Verschwiegenheit verpflichtet“), EWR einheitlich, Box+KI-Satz zur AV-Rolle (greift erst bei `kiAktiv`, Test). Setup-Schritt: Label/Platzhalter zur Umsatzsteuer neutral (§ 4 Nr. 14 **oder** § 19 UStG).
- **GoBD `invoice_festschreibung()`** (§ 146 Abs. 4 AO, § 14 Abs. 4/§ 14c UStG): sieben Spalten nach Ausstellung gesperrt (steuernummer_snapshot, ust_id_snapshot, steuer_status, leistung_von/-bis, patient_name, invoice_type) — Migration 0070; zusätzlich (guvenlik S-50) kein Rücksetzen auf `draft` und DELETE einer ausgestellten Rechnung für Browser-Rollen gesperrt — Migration 0071. Frontend schreibt bei ausgestellten Rechnungen nur noch erlaubte Spalten (`module/rechnung-festschreibung.js`).
- **Offen (nicht verifiziert):** (a) Praxisname/Anschrift/Bank auf der gedruckten Rechnung werden live aus dem Profil gelesen, nicht festgehalten — gleicher GoBD-Mangel wie oben, eigener Schritt (Snapshot beim Ausstellen); (b) BG-Empfänger wird live aus `prescriptions.bg_*` gelesen, geschützt durch 409 im Backend + Browser-Sperre 0071 (Änderung nur nach Storno); (c) Steuerberater der Pilotpraxis soll die Rechnungstexte gegenlesen (~0,5 h).


## 2026-10-08 · M4 — technischer Umsetzungsstand, keine externe Rechtsfreigabe

**Lokale technische Umsetzung und Tests abgeschlossen, Aktivierung weiter offen.** Dieser Nachtrag dokumentiert bestehende Projektauflagen aus Nachtrag (4) / K-20. Er trifft keine neue rechtliche Bewertung, bestätigt weder Microsoft- noch Anwaltsantwort und gibt keinen ersten bezahlten Einsatz oder Mailbetrieb frei.

- Nachweis: `wissensbank/sitzungen/2026-10-08_m4-qa-bericht.md`, Plan 2 und `konsey/tutanak/2026-10-08-m4-optin-lokal.md`. Owner-Entscheidung in eigenem privaten Named Volume `ki_freigaben`; `kimlik` bleibt read-only. Keine neue profiles-Spalte. Operator-/Mailgates bleiben unabhängig, standardmäßig aus. Der Ownerentscheid ist freiwillige Praxisaktivierung; er ersetzt keine Rechtsgrundlage für Patientendaten und keine externe Anbieterfreigabe.
- Jeton ausschließlich freigegebene pseudonymisierte A-Strukturfelder. B standardmäßig gesperrt, Ausnahme nur im freigegebenen direkt-Taskvertrag mit Rückfrage/Prüfung; C/OCR weiter gesperrt. Kein Inhaltsrelay und kein automatischer Mailversand. Aussagen zur realen Ressource erst nach tatsächlicher Prüfung.
- NER-Kandidat nicht übernommen: 4/139 effektive Restlecks und 6/7 negative Fehlalarme; unverändertes Alpine ARM64/AMD64 scheitert am ONNX-Import. Die sichere Fortsetzung schließt unfreigegebenen Freitext aus; synthetische Testwerte sind keine allgemeine Schutzgarantie.
- Regelbasierte Runtime: Korpus2 15/139, unabhängiger dritter Korpus 36/156 effektive Restlecks (23,08 %, Qualitätsgate FAIL). Lokale A- und Jeton-Sperrtests begründen keine Freitextfreigabe. Aus diesem Test wird kein Risiko für echten Freitext rechtswirksam akzeptiert.
- Pseudonymisierung ist keine Anonymisierung. Lokale Maps/Provider-Tokens nur im RAM; persistiert werden Freigabemetadaten und kurzlebige verbrauchte HMAC-/Expiry-Marker, keine Patientendaten/Prompts/Maps/Provider-Tokens. `store:false` ist keine Zusage über ZDR, Abuse Monitoring oder alle Anbieter-Speicherwege.
- Clientseitige Grenze TTL ≤1 h bestätigt nicht das Ablauf-/Widerrufsverhalten des externen Ausstellers. Echte Azure-Ressource/Region/Host/Deployment/RBAC/Retention, Hat-K-Vertrag, Microsoft C5-Scope/Bridge Letter/Product Terms/Professional-Secrecy-Nachweis und Anwaltsvotum bleiben **nicht geprüft**. Finale lokale Testergebnisse stehen im QA-Bericht.
- VVT/AVV werden in dieser technischen Ergänzung nicht vorzeitig geändert. Die Dokumente/Patienteninformation müssen vor echter Aktivierung gemäß Nachtrag (4) fertig und geprüft sein; Mail-Entwürfe bleiben bis zur vorgesehenen Anwaltsantwort gesperrt. Keine uneingeschränkte Rechts-/Produktionsfreigabe.

## 2026-10-09 · Box: Patientenseiten `booking.html` / `booking-request.html` — Impressum, Datenschutz, Cookie (Fortsetzung O-178)
- Vorentscheidung 08.10.2026 (O-178): In der Box kein Praxura-Impressum; Box-Login/-Konto-Seiten verlinken „Über diese Software" (`ueber.html`, umgesetzt `ff7e29a6`).
- Rolle: Betreiber und Verantwortlicher ist die Praxis; Praxura nur Hersteller. 0 €, kein Veto.
- **Datenschutzhinweis (Art. 13 DSGVO):** Link nie ausblenden. Reihenfolge `praxis_datenschutz_url` (nur https) → sonst generierte Seite „Datenschutzhinweise zur Terminanfrage" aus M2.8-Bausteinen (Verantwortlicher, Software-Satz Box) mit eigenem Zweck „Terminvereinbarung" (Art. 6 Abs. 1 lit. b, ggf. Art. 9 Abs. 2 lit. h i.V.m. § 22 Abs. 1 Nr. 1 lit. b BDSG), Speicherdauer, Empfänger, Rechte, Aufsichtsbehörde. Formular nur sperren, wenn Praxisname oder Anschrift im Profil fehlen („Online-Terminanfrage ist noch nicht eingerichtet").
- **Pflicht-Checkbox „Ich stimme … zu"** (`booking-request.html:655-660`) durch Hinweissatz ersetzen — Einwilligung ist nicht die Rechtsgrundlage, eine Pflicht-Einwilligung ist nicht freiwillig. Box und SaaS, niedrige Priorität.
- **Impressum (§ 5 DDG, Wortlaut geprüft 09.10.2026):** Pflicht der Praxis bei öffentlich erreichbarer Seite (inkl. Nr. 5 reglementierter Beruf: Berufsbezeichnung, Staat, Berufsregeln — nicht automatisch erzeugbar). Mit `praxis_impressum_url` → Link „Impressum"; ohne → kein „Impressum"-Link, nur Klartext „Praxisname · Anschrift". „Über diese Software" zusätzlich, nie als Impressum-Ersatz. Reine LAN-Seite: praktisch kein Risiko.
- **Cookie-Einstellungen** in der Box entfernen (kein Umami, kein Banner); Voraussetzung: nur technisch notwendige Speicherung (§ 25 Abs. 2 Nr. 2 TDDDG).
- **Hinweis im Owner-Setup:** „Ihre Online-Terminseite betreiben Sie als Praxis selbst: Tragen Sie die Adressen Ihres Impressums und Ihrer Datenschutzerklärung ein – ohne Eintrag erscheint ein automatisch aus Ihren Praxisdaten erzeugter Datenschutzhinweis, aber kein Impressum, für das Sie bei einer öffentlich erreichbaren Seite selbst verantwortlich sind."
- Offen (niedrig): SaaS-Patientenseiten verlinken heute Praxuras `datenschutz.html`, obwohl die Praxis verantwortlich ist.

## 2026-10-09 — Datenpanne S-56: `profiles` anonym lesbar (22.06.–09.10.2026)
Rolle: Verantwortlicher (Kontodaten Inhaber) + Auftragsverarbeiter (Mitarbeiterdaten, AVV Ziff. Betroffene „Mitarbeiter")
Sachverhalt: 18 Zeilen (booking_slug + accepts_bookings) ohne Login über Anon-Key lesbar, alle Spalten inkl. IBAN (1×), company_code. Geschlossen durch Migration 0072, live verifiziert (42501). Zugriff nicht feststellbar (Edge-Logs ~24 h, gesampelt).
Entscheidung:
- Art. 33: MELDEN an LDI NRW bis 12.10.2026 (ggf. schrittweise, Art. 33(4)). Begründung: Zugriff nicht ausschließbar, 3,5 Monate, trivial ausnutzbar, Mitarbeiterkontaktdaten nicht öffentlich, IBAN, company_code = mittelbarer Weg zu Patientendaten bis Gegenprüfung.
- Art. 33(2)/AVV §-Meldung (24 h): Inhaber aller betroffenen Beta-Praxen bis 10.10.2026 informieren.
- Art. 34: nicht erforderlich (kein hohes Risiko); freiwillige Information an betroffene Personen, insb. IBAN-Inhaber.
- Bedingung: Prüfung aller im Zeitraum angelegten Mitarbeiterkonten + Rotation company_code. Findet sich ein unbekanntes Konto → Neubewertung (Patientendaten betroffen, Art. 33 Nachtrag, Praxis prüft Art. 34).
Dokumentation Art. 33(5): Runbook-Register + diese Zeile; LDI-Aktenzeichen: ____.

## 2026-10-09 · K2b.15 Rest — Patientenseiten: Einwilligungs-Checkboxen, Hinweisseite, Herstellername, Adresse
Rolle: Praxis = Verantwortliche; Praxura Hersteller (Box) bzw. AV (SaaS). 0 €, kein Veto.
- **dsgvo1 UND dsgvo2 entfallen** (`booking-request.html:653-671`). Rechtsgrundlage Art. 6(1)(b) + Art. 9(2)(h), (3) i.V.m. § 22 Abs. 1 Nr. 1 lit. b BDSG; Pflicht-Einwilligung ist nicht freiwillig (Art. 7(4)), dsgvo2 war in sich widersprüchlich. Ersetzt durch Hinweissatz mit Link: „Ihre Angaben verarbeitet {{praxis_name}} zur Vereinbarung Ihres Termins und zur Vorbereitung Ihrer Behandlung. Angaben zu Ihrer Gesundheit (z. B. Diagnose oder Verordnung) werden nur hierfür verwendet und unterliegen der beruflichen Schweigepflicht. Näheres in den Datenschutzhinweisen." Notizfeld-Platzhalter ohne „Allergien".
- **Backend:** `dsgvo_consent`-Pflicht (server.js:3952) entfernt; neue Zeilen schreiben **kein** `true` mehr (Default false, `consent_at` null) — sonst wird eine nie eingeholte Einwilligung dokumentiert. Altzeilen unverändert. Erst Backend, dann Frontend deployen. Spalte bleibt vorerst (Entfernen später zweistufig).
- **Erzeugte Seite** „Datenschutzhinweise zur Online-Terminvereinbarung" (gilt für booking.html + booking-request.html), Wortlaut legal-de 09.10. (in `module/` hinterlegt). Keine feste Löschfrist versprochen, solange `booking_requests` keine automatische Löschung hat (offen, niedrig: unangenommene Anfragen nach ~6 Monaten löschen).
- **Herstellername:** In Patiententexten steht der bürgerliche Name „Yavuz Kemal Demir (Siegburg)", nicht „InfinityMade". M2.8 → `datenschutz-v4-2026-10-09`; zusammen mit der Adresskorrektur (ctxFor: `zip`/`house_number`). Unterschriebene v2/v3-Snapshots bleiben unverändert, keine Neuunterzeichnung (inhaltlich zutreffend; Adresse bestimmbar, Art. 13 Abs. 4).
- **Anschrift für anon** (Fußzeile, Hinweisseite, Sperre „noch nicht eingerichtet") nur über RPC `public_praxis_angaben` (0073, guvenlik: Sicht+Spaltenrecht hätte Mitarbeiterzeilen mit geöffnet).

### 2026-10-09 · Nachtrag S-56 — Entscheidung des Verantwortlichen: keine Meldung (Variante B)
- **Entscheidung (Yavuz Kemal Demir, 09.10.2026):** keine Meldung an die LDI NRW nach Art. 33 und keine gesonderte Datenpanne-Meldung an die Beta-Praxen. Die Beta-Praxen werden später formlos informiert (Zeitpunkt offen).
- **Begründung des Verantwortlichen:** sehr geringes Zugriffsvolumen, Zugriff durch Dritte nicht anzunehmen; die Angaben sind überwiegend auf den Webseiten der Praxen ohnehin öffentlich; Beta-Teilnahme mit bekanntem Risiko.
- **Hinweis (dokumentiert, vom Verantwortlichen zur Kenntnis genommen):** legal-de hatte Meldung empfohlen (Block oben). Nicht öffentlich waren u. a. eine IBAN (1×) und `company_code`. Risiko: eine spätere Feststellung des Vorfalls ohne Meldung (Art. 33 Abs. 5 Dokumentationspflicht bleibt — diese Einträge sind die Dokumentation).
- Technisch geschlossen durch 0072 (09.10.2026), Rückfall-Tor `check-anon-grants`.

### 2026-10-09 · Rechnungs-Snapshot Aussteller/Empfänger — schließt „Offen (a)/(b)" vom 06.10.
Rolle: Praxis = Verantwortliche/Rechnungsausstellerin; Praxura AV (SaaS) bzw. Hersteller (Box). 0 €, kein Veto.
- **Pflicht vor der ersten echten Rechnung** (nicht für Demo): § 147 Abs. 2 Nr. 1 AO (Buchungsbelege „bildlich" übereinstimmend, Wortlaut geprüft 09.10.2026), Abs. 3 S. 1 (8 J.), § 146 Abs. 4 AO; § 14 Abs. 4, § 14b UStG.
- `invoices.aussteller_snapshot jsonb` + `empfaenger_snapshot jsonb`, beim Ausstellen geschrieben, in `invoice_festschreibung()` gesperrt. Inhalt = **nur was gedruckt wird** (Art. 5 Abs. 1 lit. c): Aussteller wie gkv-302-Liste + Zahlungsbedingungen, Logo/Stempel-Referenz (versioniert), tatsächlich gedruckte Standort-Anschrift; Empfänger inkl. BG-Angaben, Geburtsdatum/Versichertennr. nur wenn gedruckt. Praxis-IBAN zulässig (ohnehin gedruckt); Patienten-IBAN nicht.
- **Zusätzlich sperren:** `invoice_number`, `rechnung_nr` (§ 14 Abs. 4 Nr. 4 UStG — fehlen heute im Trigger), ferner `eigenanteil_*`/`kassenzuzahlung`, soweit betragsrelevant.
- Gilt gleich für Zuzahlungsquittung, Privat- und BG-Rechnung (alle Buchungsbelege, § 147 Abs. 1 Nr. 4 AO). § 302-DTA: eigener Weg (`abrechnung_uebermittlung`).
- DSGVO-Löschung: Snapshots bleiben gesperrt (Art. 17 Abs. 3 lit. b, K1.4), Purge nach 8 J.; Anonymisierung von `leads` darf Snapshots nicht berühren.
- Altbelege ohne Snapshot: Fallback live + Kennzeichnung „Altbeleg ohne Snapshot" = Risikoakzeptanz (keine Live-Kunden).
- Folgeschritt (niedrig): Layout-Version im Snapshot oder PDF beim Ausstellen einfrieren („bildlich"). Steuerberater-Durchsicht (≈0,5 h) um dieses Thema ergänzen.
- **Nachtrag 09.10.2026 (Kemal):** Umsetzung Variante (a) — Snapshot bei jedem Speichern des Entwurfs, gesperrt sobald die Rechnung den Entwurf verlässt (heute: bezahlt). Ein eigener Schritt „Rechnung ausstellen" (Variante b, rechtlich sauberer: Sperre ab Übergabe) kommt vorerst nicht. Restrisiko akzeptiert: zwischen Druck/Übergabe und Zahlung ist die Rechnung noch änderbar.

## 2026-10-10 · Zuzahlungsbeleg (ZU), Privat- und Ausfallrechnung — Nummer, Aufbewahrung, Storno
Rolle: Praxis = Ausstellerin/Verantwortliche; Praxura AV (SaaS) bzw. Hersteller (Box). 0 €, kein Veto. (legal-de 10.10.2026, Frage aus KHS §4)
- ZU, Privat-/Selbstzahlerrechnung, Ausfallrechnung = Buchungsbelege (§ 147 Abs. 1 Nr. 4 AO), 8 J. (Abs. 3 S. 1, Wortlaut geprüft 10.10.2026), bildlich reproduzierbar (Abs. 2 Nr. 1; § 146 Abs. 4 AO).
- ZU heute GoBD-widrig (`ZU-<uuid8>` + `new Date()` bei jedem Öffnen). Plan „ZU in `invoices`, Typ `zuzahlung`, Nummernkreis + Snapshot + Sperre" ist erforderlich und ausreichend — Nummer/Datum einmalig bei erster Ausgabe vergeben und sperren (nicht erst „bezahlt").
- Lückenlosigkeit nicht zwingend (UStAE 14.5 Abs. 10; BFH X B 79/16), Einmaligkeit je Nummernkreis zwingend. Nummer erst bei Ausstellung, nicht im Entwurf.
- Eigener Nummernkreis `ZU-JJJJ-nnnn`; Privat und AF-n bleiben getrennt (AF = nicht steuerbarer Schadensersatz, aber Beleg; 0076 genügt).
- Storno: kein Löschen/Ändern; Gegenbeleg mit eigener Nummer + Verweis, Original „storniert"; technische Lücken protokollieren.
- Steuerberater-Durchsicht (≈0,5 h) um die ZU-Frage ergänzen.
- Grenzen: UStAE-Text nur aus Sekundärquellen (Stand 2010) geprüft; § 14 Abs. 2-Fundstelle zur fehlenden Rechnungspflicht bei § 4 Nr. 14 nicht verifiziert.
