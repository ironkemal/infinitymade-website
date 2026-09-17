# Hukuki Karar Kaydı (Legal Decisions Register)

> Kapatılmış hukuki kararlar. `legal-de` ajanı bu dosyayı her görevde okur ve buradaki kararları
> **yeni bir olgu olmadan yeniden tartışmaya açmaz** (yasa değişikliği, mimari değişiklik,
> eşik aşımı = yeni olgu sayılır).
>
> Format: `| Tarih | Karar | Gerekçe / Fundstelle | Durum | Yeniden değerlendirme tetiği |`

| Tarih | Karar | Gerekçe / Fundstelle | Durum | Yeniden değerlendirme tetiği |
|---|---|---|---|---|
| 2026-09-17 | **Kassenbuch/TSE: § 146a AO muafiyeti KAPATILMADI (🔧 koşullu). Ödenmemiş fatura Kassenbuch'a girmez. Export hedefi DATEV EXTF, Elster DEĞİL.** | Beta-1'in "silinemez + export = TSE gerekmez" gerekçesi yanlış: GoBD (§ 146 Abs. 4, § 147 AO) ile § 146a AO ayrı raylar. Ölçüt AEAO zu § 146a Nr. 1.2 "Kassenfunktion" = *Erfassung und Abwicklung zumindest teilweise barer Zahlungsvorgänge*, **yetenek testi** ("auf die Funktionsweise ... nicht was tatsächlich erfasst wird"), Kassenlade gerekmez; § 1 S. 2 KassenSichV'nin Buchhaltungsprogramm istisnası yalnız Tagesendsummen içindir. `dashboard.html:1553` "GoBD-Kassenbuch" + `:1556` "Barverkauf eintragen" + Kassieren-Dialog + storno + Beleg → Kassenfunktion lehine. Bize özel risk müşteride değil bizde: § 146a Abs. 1 S. 5 AO (gewerbsmäßig bewerben/in Verkehr bringen yasağı) + § 379 Abs. 1 Nr. 6 i.V.m. Abs. 6 AO, **bis 25.000 €**. Gerçekçi sonuç: Bußgeld değil, Steuerberater onayı alamayan satışın kapanmaması. Seçilen yol (B+C): kapsam dışına çıkma — "Kasse/Kassenbuch" dili kaldırılır, serbest "Barverkauf" gözden geçirilir, Kassenbon basılmaz, Verfahrensdokumentation'da offene Ladenkasse praxiste kalır + Steuerberater'dan tek soruluk yazılı teyit. TSE satın alma reddedildi: Cloud-TSE 8–20 €/ay/praxis + DSFinV-K/TR-03153, üstelik on-prem kutudan zorunlu dış çağrı (G8/K6 çatışması). GoBD tarafı: ödeme anında kayıt **doğru** (§ 146 Abs. 1 AO Kassensturzfähigkeit) — Ops #223 "jede Rechnung muss einfließen" Kassenbuch'a uygulanmaz, ayrı Umsatz/Offene-Posten görünümü olur. Tespit edilen GoBD kusuru: `api-backend/billing/api/abrechnung.routes.js:2234-2249` + `:2152-2168` mock-fallback uydurma satırları `gobd_kassenbuch.csv` adıyla veriyor → kaldırılacak. Elster export hedefi değildir (import yok); § 146a Abs. 4 Kassenmeldung praxisin ödevi, Praxura yapmaz (§ 5 StBerG, 05.09.2026 kararıyla aynı çizgi). | **Açık — 🔧 koşullu:** B (dil/kapsam düzeltmesi) + C (Steuerberater yazılı teyidi) tamamlanınca kapanır | Steuerberater teyidi gelmesi · "Barverkauf"/Bondruck özelliklerinin genişletilmesi · TSE'li bir müşteri talebi · AEAO/KassenSichV'de Kassenbuch tanımının netleşmesi |
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
| 2026-09-17 | **`prescriptions_festschreibung()` trigger'ı (Ops #167): NULL-istisnası SADECE `patient_name`/`versichertennummer`/`patient_id` için — `icd10`/`icd10_2`/`diagnosegruppe`/Heilmittel-/Betragsfelder istisnasız kilitli kalır** | `fn_abrechnung_zeile_festschreibung()` deseni tekrarlanır: kimlik alanları NULL'a çekilebilir, değiştirilemez; tanı/Heilmittel-içerik alanları §302 Anlage-1-TP5 Pflichtangabe'dir, `invoices`'taki hatanın (Personenfeld nullen = Pflichtangabe'yi yok etme) tersten tekrarını önlemek için içerik kilitli kalmalı. **Ayrıca tespit edildi, ayrı kart açıldı:** `prescriptions` bugün `api/dsgvo.js` `DELETE_TABLES`'ta (hard DELETE), `ANONYMIZE_TABLES`'ta değil — BEFORE-UPDATE trigger'ı DELETE'i bloklamaz, dolayısıyla trigger Löschungskette'yi kırmaz, ama billed (`belegnummer` dolu) Verordnung'lar bugün retention'sız komple silinebiliyor; bu `db/SCHEMA-RLS.sql:904-914`'te zaten "OFFENE LUECKE" olarak işaretli ve ayrı bir gkv-302+legal-de kararı gerektiriyor. → `compliance/legal-reviews/2026-09-17-prescriptions-festschreibung-dsgvo.md` | Trigger tasarım kararı kapalı / dsgvo.js-taşıma kararı **açık** (ayrı kart) | dsgvo.js `prescriptions`'ı ANONYMIZE_TABLES'a taşıma kararı verildiğinde bu kayıt güncellenir |

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
- `prescriptions`'ın `api/dsgvo.js`'te hard-DELETE yerine billed satırlar için ANONYMIZE_TABLES'a
  taşınması gerekip gerekmediği — gkv-302 + legal-de birlikte → `db/SCHEMA-RLS.sql:904-914`,
  `compliance/legal-reviews/2026-09-17-prescriptions-festschreibung-dsgvo.md`

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
