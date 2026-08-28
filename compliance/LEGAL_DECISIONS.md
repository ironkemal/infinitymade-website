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
