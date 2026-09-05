# Hukuki Karar Kaydı (Legal Decisions Register)

> Kapatılmış hukuki kararlar. `legal-de` ajanı bu dosyayı her görevde okur ve buradaki kararları
> **yeni bir olgu olmadan yeniden tartışmaya açmaz** (yasa değişikliği, mimari değişiklik,
> eşik aşımı = yeni olgu sayılır).
>
> Format: `| Tarih | Karar | Gerekçe / Fundstelle | Durum | Yeniden değerlendirme tetiği |`

| Tarih | Karar | Gerekçe / Fundstelle | Durum | Yeniden değerlendirme tetiği |
|---|---|---|---|---|
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
| 2026-09-05 | **Behandlungsbestätigung PDF: keine Einwilligung, kein Speichern, kein Versand** | Aushändigung an den Betroffenen selbst → kein „Offenbaren" § 203 StGB, geschuldet nach § 630g Abs. 1/2 BGB + Art. 15 Abs. 3 DSGVO; Einwilligung wäre Scheinrechtsgrundlage (Art. 7 Abs. 3). Dokument **bleibt** Gesundheitsdatum (Art. 4 Nr. 15, EuGH C-21/23 Lindenapotheke v. 04.10.2024) — unschädlich, da Rechtsgrundlage nicht Einwilligung ist. Auflagen: nur wahrgenommene Termine (`hausbesuch=false`, `no_show=false`, `status IN (confirmed,completed)`, keine Zukunft) · keine km-/Betragsberechnung im PDF (§ 5 StBerG unbefugte Steuerhilfe, § 5 UWG) · keine Diagnose/ICD/Verordnung/Kasse · client-seitig wie `module/termin-druck.js`, kein Server, kein Speichern, kein Mailversand (G8). GoBD/§147 AO nicht einschlägig, da kein Rechnungs-/Zahlungsbeleg. → `module/behandlungsbestaetigung.js`, Ops-Kart #272 | Uygulandı | Praxis versendet das Dokument selbst an Dritte; km-/Betragsberechnung wird gewünscht; serverseitige Erzeugung oder Ablage geplant |
| 2026-08-29 | **Umami einwilligungspflichtig — Schranke BLEİBT, yanlış olan metindi. Ayrıca Widerruf eksikti ve eklendi.** | § 25 Abs. 1 TDDDG **teknoloji-nötrdür**: yalnız çerez saklamayı değil, uç cihazda zaten kayıtlı bilgiye **erişimi** de kapsar. Umami script'i `screen`, `navigator.language`, `document.referrer` alanlarını aktif okur → Zugriff (EDSA Leitlinien 2/2023 v2.0, 07.10.2024). DSK'nın daha yumuşak çizgisi de kurtarmıyor: onun istisnası **sunucu tarafında pasif** okumadır, JS ile aktif Auslesen değil — iki görüş burada aynı sonuca varıyor. § 25 Abs. 2 Nr. 2 uymuyor (reichweitenmessung sayfanın sunulması için zorunlu değil; Almanya'da CNIL benzeri bir ölçüm istisnası yok — yasa koyucu tartıştı, koymadı). **Kritik nokta:** § 25 kişisel veri işlenip işlenmediğinden **bağımsız** işler → `datenschutz.html:146`'daki „keine Einwilligung erforderlich, **da** keine personenbezogenen Daten" cümlesi bir *non sequitur*; DSGVO gerekçesiyle TDDDG yükümlülüğü savuşturulamaz. Metnin asıl hatası buydu, eskimişliği değil. **Bağımsız ve daha ağır bulgu:** Widerruf **hiç yoktu** — bir kez `accepted` yazıldıktan sonra banner bir daha görünmüyor ve hiçbir yerde ayar bağlantısı yoktu → Art. 7 Abs. 3 S. 4 DSGVO („so einfach wie die Erteilung") ihlali; geçerli bir rıza rejiminin zorunlu parçası eksikti. **Uygulandı 29.08.2026:** banner'daki „Keine personenbezogenen Daten" beyanı kaldırıldı (Umami IP+UA+günlük salt'tan `session_id` üretir → ErwG 26 anlamında **pseudonym**, anonym değil; yanıltıcı beyana dayanan rıza Art. 4 Nr. 11 uyarınca angreifbar) · Datenschutz linki eklendi · Widerruf üç yoldan erişilebilir (`#cookie-einstellungen` ankası, `[data-cookie-einstellungen]` özniteliği, global fonksiyon) · rıza **12 ay** sonra yeniden sorulur · zaman damgasız eski rızalar **devralınmaz** (yanıltıcı metin altında verildiler) · iki düğme eşit genişlikte. `datenschutz.html:121` ve `:146` `legal-de` taslağıyla yeniden yazıldı, `UMAMI_SETUP.md` başına düzeltme notu kondu. Bauart-Test: `module/cookie-consent.test.js` (11 test; kapı kaldırılınca 9'u kırmızıya döner — gegenprobe yapıldı). **SEO-ROI sorusunun doğru aracı Umami değil:** Google Search Console + Bing Webmaster Tools, **DNS-TXT** doğrulamasıyla — sitede tek satır kod yok, Endeinrichtung'a erişim yok, § 25 hiç doğmuyor, €0 ve G8'e uygun. Umami consent'lilerde kalır; mutlak sayı vermez, göreli trend için kullanılır. | Uygulandı — GSC/Bing kurulumu açık | Digital Omnibus (Art. 88a/88b DSGVO-E, öneri 19.11.2025) yürürlüğe girip Reichweitenmessung istisnası getirirse; Umami sunucu konfigürasyonunun hash+salt rotasyonu doğrulanamazsa (o zaman `datenschutz.html:122` lafzı düzeltilir) |

---

## Bilinçli risk kabulleri (Risikoakzeptanz)

Bilinen ama şu an düzeltilmeyen riskler. Ajan bunları tekrar tekrar uyarı olarak gündeme getirmez —
sadece durum değişirse veya yeni bir bulgu bunları ağırlaştırırsa değinir.

| Tarih | Risk | Neden şimdilik kabul | Gözden geçirme |
|---|---|---|---|
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
