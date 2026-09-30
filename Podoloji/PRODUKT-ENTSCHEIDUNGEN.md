# Podoloji — Ürün Kararları

> Podoloji vertikalinde verilen ürün/klinik kararların kaydı. Sahibi: `podoloji` ajanı.
>
> **Amaç:** iki ay sonra "bunu neden böyle yaptık" sorusunun cevabı. Bu bilgi başka hiçbir
> yerde yazmıyor — koddan da git geçmişinden de çıkarılamaz.
>
> Kapatılmış bir karar, yeni bir olgu olmadan yeniden açılmaz.

---

### Randevu slotu = Regelleistungszeit (35/50) — asıl kusur ızgara adımıydı
- **Karar:** Podoloji randevu slotu **Regelleistungszeit** kadar bloke eder: 78010 → 35 dk,
  78020 → 50 dk. `GKV_LEISTUNGSKATALOG.podologie`'deki `duration` değerleri **değişmiyor**,
  `therapiezeit` (20/35) yalnızca kart etiketi olarak kalıyor ("davon X Min am Patienten").
- **Neden:** Anlage 1a Teil 1 Nr. 4 (i.d.F. 17.06.2024; aynı cümle Anlage 1c 01.07.2025):
  *"Die notwendige Vor- und Nachbereitung … ist in der Regelleistungszeit enthalten und mit
  der Vergütung abgegolten. Sie darf … nicht innerhalb der Therapiezeit durchgeführt werden."*
  Yani hazırlık/dokümantasyon tanım gereği tedavi süresinin **dışında** — slotu Therapiezeit'e
  indirmek bu ayrımı takvimden siliyor ve solo podologda gün ortasında birikmiş gecikme üretiyor.
- **Asıl bulgu — sorulan soru yanlış soruymuş:** Podoloji takviminin kapasite kaybı slot
  süresinden değil **ızgara çözünürlüğünden** geliyor. `step=30` her yerde sabit ve hiçbir
  çağıran başka değer göndermiyor; 35 dk'lık randevu 09:00–09:35 olunca 09:30 adayı çakışma
  testinde eleniyor, sıradaki teklif 10:00 → **her hastada 25 dk boşa gidiyor.**
  Yapılacak iş `step` 30→15, süreye dokunmak değil.
- **Tarih:** 2026-08-16
- **Etkilenen:** `api-backend/server.js` (`getAvailableSlots` step, `503/749-760/775/810/1521`),
  `dashboard.js:2428`, `booking.js:328`, `api-backend/booking/from-request.js:27`;
  P2 için `booking.js:219/221/327`
- **Reddedilen alternatifler:**
  - *Slot = Therapiezeit + ayrı buffer alanı (B):* `services.buffer_time` kolonu **yok**,
    `booking.js` olmayan kolonu okuyor (daima 0), backend `buffer` parametresi hiç beslenmiyor.
    Buffer bloğun içindeyse zaten Regelleistungszeit'tir; dışındaysa `no_overlapping_bookings`
    EXCLUDE GIST korumasının dışına düşer ve sıradaki hasta dokümantasyon zamanına randevu alır.
  - *Slot = Therapiezeit, buffer yok (C):* yukarıdaki sözleşme cümlesine aykırı.
  - *Serbest süre girişi:* 50 müşteride 50 farklı takvim = destek yükü. Yerine preset (P3).
  - *Takvimde 20+15 taralı görsel ayrımı:* `podoloji` gürültü buldu; mevcut alt metin yeterli.
- **Bilinçli kabul edilen risk:** Süre chip'i `locked: true` kalıyor. `podoloji`'nin
  *"hastam 50 dk sürüyor, sistem 35 diyor — ilk gün şikayet konusu olur"* uyarısı biliniyor;
  şikayet gelirse P3 tetiklenir ve elimizde talep kanıtı olur.
- **Kalıcı kural (`gkv-302` şartı):** Slot uzunluğu 78010 ↔ 78020 seçimini **asla** belirlemez.
  Kod seçimi terapistin belirlediği Therapiezeit'e bağlıdır (*"Die Therapiezeit wird … vom
  Leistungserbringer ermittelt"*, Podologie-FAK 2023 Nr. 24). Slot 50 dk diye otomatik 78020
  seçilirse **üretilmiş Therapiezeit iddiası** doğar. Bugün zaten sağlanıyor: `therapiezeit`
  yalnız etiket, seçim elle checkbox (`dashboard.js:24628`).
- **Yan teyit (FAK 2023 Nr. 25):** klein/groß ayrımı yalnız Komplexbehandlung'da geçerli;
  salt Nagel- veya Hornhautbearbeitung her zaman 78010 + 78030 — kodda doğru
  (`dashboard.js:23689-23694`).
- **Test senaryosu:** DF-b hastası, 78010 + 78030, sağ ayak, 09:00 randevu → ikinci hasta için
  ilk teklif **09:45** olmalı (bugün 10:00). Aynı gün ikinci 78010 randevusu 35 dk sonra
  çakışmasız kurulabilmeli.
- **Doğrulanmadı:** Regelleistungszeit'in altına düşmenin denetimde (Plausibilitätsprüfung)
  nasıl karşılandığı — §125 Rahmenvertrag'da yaptırım hükmü bulunamadı. Takvim süresi §302
  dosyasına girmiyor (SLLA:B yalnız `Datum der Leistungserbringung` taşır, Anlage 1 TP5 V21
  §5.5.3.3), yani doğrudan Absetzung riski yok; Verlaufsdokumentation ise delildir.
- **Beta sorusu (kurucunun işi):** *"Takviminde bir 78010 hastası için kaç dakika ayırıyorsun —
  ve bu süre temizlik/belgelemeyi kapsıyor mu?"* · *"Hangi hasta tipinde bu süre yetmiyor?"* ·
  *"Vor-/Nachbereitung'u sen mi yapıyorsun, asistan mı?"* — üçüncüsü praxis genelinde sabit
  cevaplı kadro sorusudur, P3 preset'ini belirler.
- **Tutanak:** `konsey/tutanak/2026-08-16-podoloji-slot-suresi.md`

---

### Podologie Blankoverordnung desteklenmeyecek — net ret mesajı verilecek
- **Karar:** Blanko motoruna Podologie desteği eklenmeyecek. Bunun yerine podoloji rezepti
  Blanko akışına düştüğünde **tek ve anlaşılır** bir mesajla reddedilecek:
  *"Blankoverordnung derzeit nur Physiotherapie (Schulter). Für Podologie besteht kein
  §125a-Vertrag — bitte als Standardverordnung / Muster 13 ausstellen."*
- **Neden:** Podologie için §125a Blankoverordnung sözleşmesi **yok** (KBV Praxiswissen 2026;
  Diagnoseliste 01.01.2026 Bölüm 2 sadece Ergo 04/2024 + Physio 11/2024). Podologda Blanko
  bugün fiilen sıfır — her şey Muster 13 üzerinden yürüyor.
  **Asıl sorun kural değil, mesaj:** bugün podolog ekranda *"ICD ist nicht auf der
  Blanko-Schulterliste"* ve *"nur Diagnosegruppe EX zulässig"* görüyor. Elinde DF/NF tanı grubu
  var, omuz listesinden haberi yok — kendi tanı grubunu yanlış sanıp veriyi bozmaya veya destek
  aramaya yöneliyor. **Yanlış hata mesajı, hata olmamasından pahalıdır.**
- **Tarih:** 2026-08-05
- **Etkilenen:** `api-backend/ai/validators/validate.js` (guard), `blankoRules.js` (kapsam
  yorumu), `dashboard.js` i18n sözlüğü (de/en/tr)
- **Reddedilen alternatif:** `GUELTIG_WOCHEN`'i Fachbereich bazlı tabloya çevirmek. Sözleşme
  yokken parametreleştirmek "destekleniyor" izlenimi yaratır; ayrıca podoloji sözleşmesi geldiğinde
  sadece süre değil tanı grupları, Ampel, Vergütung ve bonus tutarları da farklı olacak — doğru
  şekil tablo değil, **ayrı motor** (`blankoPodoRules.js`).
- **Test senaryosu:** DF-b tanılı hasta (ICD E11.7x tabanlı), Diagnosegruppe DF, HPNR 78030 +
  78001, sağ ayak → Blanko akışına sok, **tek** anlaşılır mesaj çıktığını doğrula.
- **Doğrulanmadı:** "Podolog Blanko'yu hiç kullanmıyor" tespiti `podoloji` ajanının varsayımı —
  gerçek bir podologla teyit edilmedi.
- **Tutanak:** `konsey/tutanak/2026-08-05-blanko-fachbereich.md`

---

### Privat/Selbstzahler akışı: GKV alanları gizlenmez, katlanır
- **Karar:** Podoloji Verordnung formunda `rezeptart ≠ kassen` (privat · selbstzahler · bg) iken
  sadece **Abrechnungs** alanları — Krankenkasse, Diagnosegruppe, ICD-10, Zuzahlung-Befreiung —
  varsayılan **kapalı** bir `GKV-Angaben` bölümüne girer. Diagnosegruppe zorunluluğu
  `rezeptart === 'kassen'` koşuluna bağlanır; boş bırakılırsa **NULL** yazılır (boş string
  değil — `verordnungen_diagnosegruppe_fkey` var). Yerine opsiyonel serbest metin
  `behandlungsanlass`, varsayılan `Podologische Komplexbehandlung`.
- **Wagner ve Fußbefund GİZLENMEZ.** Bunlar klinik dokümantasyondur, ödeyiciden bağımsızdır —
  diyabetik ayak PKV hastasında da Wagner ile belgelenir (§630f BGB, 10 yıl saklama).
  İlk çerçeveleme bunları yanlışlıkla "GKV alanı" saymıştı.
- **PKV ≠ Selbstzahler**, ama ayrım Verordnung formunda değil **fatura katmanında** yaşar:
  Selbstzahler çoğunlukla kozmetik Fußpflege → varsayılan **%19 USt**; PKV → varsayılan
  §4 Nr. 14 a UStG muafiyeti + `Steuerbefreiungshinweis`. **Yazılım muafiyeti otomatik
  varsaymaz**, podolog seçer ve seçim loglanır. Zorunlu bir "medizinische Indikation" alanı
  KONMAZ — podoloğu muafiyeti haksız işaretlemeye iter, riski azaltmak yerine üretir.
- **Neden:** Bugün DG zorunlu olduğu için Selbstzahler kaydında uydurma Diagnosegruppe
  giriliyor. Bu red değil **yanlış içerikli kabul** riski doğurur — en tehlikeli sınıf.
  Gizleme yerine katlamanın sebebi geri-çevrilebilirlik: hasta Rezept'i sonradan getirip kayıt
  `kassen`'e çevrildiğinde DG=NULL kayıt **sessizce eksik** kalır ve hata haftalar sonra
  abrechnung gününde çıkar.
- **Tarih:** 2026-08-10
- **Etkilenen:** `dashboard.js:23990-24067` (form), `:24123` (validasyon), `:24174` (insert),
  `api-backend/billing/api/abrechnung.routes.js:1817` (sunucu guard), `verordnungen` CHECK
  constraint, i18n sözlüğü (de/en/tr)
- **Kritik bulgu:** `abrechnung.routes.js`'te `rezeptart` **hiç geçmiyor** — privat kaydın
  §302 DTA'ya sızmasını engelleyen tek şey `kostentraeger_ik` eşitliği (`:1818`). Bu tesadüf,
  güvence değil. Açık guard + DB `CHECK (rezeptart <> 'kassen' OR diagnosegruppe IS NOT NULL)`
  eklenecek.
- **Reddedilen alternatif:** (1) Alanları tamamen kaldırmak — geri-çevrilebilirlik riski.
  (2) PKV + Selbstzahler'ı tek akışa koymak — KDV rejimleri zıt. (3) `insurance_type` ile
  `rezeptart`'ı senkron etmek — farklı sorulara cevap veriyorlar; GKV hastanın privat
  Verordnung'u meşrudur. Doğru şekil **tek yönlü ön seçim + satır içi uyarı**.
- **Ertelendi:** Behandlung → Rechnung köprüsü (Faz 3). Tetikleyici: Faz 1 canlıda **ve**
  haftada ≥5 Privatrechnung. `insurance_type`'a `selbstzahler` değeri Faz 2 —
  Selbstzahler payı %5'in üstünde çıkarsa.
- **Doğrulanmadı:** Podoloji praxisinde PKV/Selbstzahler hasta oranı (`podoloji` ajanı
  varsayımı, Beta-1'e sorulacak). PKV kasalarının Erstattung için Diagnose satırı isteyip
  istemediği kasa bazlıdır. BG/DGUV'nin istediği alanlar (Unfalltag, Aktenzeichen) DGUV
  sözleşmesinden doğrulanmadı — BG şimdilik yarım kova.
- **Tutanak:** `konsey/tutanak/2026-08-10-privat-selbstzahler-akisi.md`

---

### Onam imzası kiosk'ta alınır — onam anı karşılamadır, anamnez değil
- **Karar:** Dijital Einwilligung, var olan Kiosk-Modus'un ("Tablet an Patient übergeben")
  içine bindirilir. Podoloji akışındaki sırası: **karşılama → onam imzası → anamnez podologla
  birlikte.** Tablet hasta gelmeden hazırlanır. Onam **tek akış, iki ekran, iki imza**:
  ekran 1 `Behandlungsvertrag + Ausfallgebühr`, ekran 2 `Datenschutz-Einwilligung`, tek "Weiter".
- **Neden:** Podolog eldivenli/ıslak elle çalışıyor — tedavi sırasında tablete dönmesi gereken
  bir tasarım yanlıştır; onam zaten hasta ayakkabısını çıkarırken, podolog eldiven takmadan
  önce alınır. Kilit+PIN günde ~20 kez +2 tık ekliyor ve podolog zaten hastanın 1 metre yanında
  — kilit **kaza önleyicidir, güvenlik sınırı değildir.**
- **Kaç imza:** 2 tolere edilir, 3 edilmez. Ausfallgebühr sözleşmenin ticari şartıdır,
  §630d tarafına (ekran 1) aittir. Tek pakette tek imza **yapılamaz** — `legal-de` şartı:
  §630d Behandlungs-Einwilligung ile Art. 7 DSGVO rızasının birleştirilmesi Koppelungsverbot
  riski (bkz. `compliance/LEGAL_DECISIONS.md`, 2026-08-14).
- **Kâğıdın gerçekten bitmesi için iki şart:** (a) hastaya kopya — PDF indir + istenirse yazdır,
  (b) hasta dosyasından belge tipi + tarihle geriye dönük bulunabilirlik. İkisi yoksa podolog
  yine kâğıt basar, iş amacına ulaşmaz.
- **Yaşlı/diyabetik hasta uyarlaması:** ≥18px, uzun kaydırma yerine kısa bloklar, imza alanı
  ekran genişliğinde, tablet masaya **düz** konur, büyük özet + tam metin altta.
- **Kör nokta (ayrı ürün sorusu):** Kiosk bugün hastaya **Anamnese formunu** uzatıyor. Podolojide
  anamnez ilk seansta **podologla birlikte** doldurulur — diyabet, Marcumar, Durchblutung
  soruları hasta tarafından yanlış anlaşılıyor. Hastanın tek başına doldurması riskli bir
  varsayım; kiosk'un doğru içeriği onamdır.
- **Belge listesi:** *Her hastada:* Behandlungsvertrag, Datenschutz-Einwilligung, Ausfallgebühr.
  *Sık:* Foto-Einwilligung (Fußbefund görseli), Selbstzahler/Eigenanteil (Nagelspange, kozmetik
  seans), Schweigepflichtentbindung (DFS'te Hausarzt'a Therapiebericht — diyabetiklerde nadir
  değil). *Nadir:* Hausbesuch. **Yeni Verordnung'da baştan imzalatma yok** — sadece süresi
  dolan/değişen belge tetiklenir; anamnez için "değişiklik var mı?" tek soru yeter.
- **Tarih:** 2026-08-14
- **Etkilenen:** `dashboard.html:1943` + `:5747-5805` (kiosk), `dashboard.js:22783-22960`,
  yeni `module/patienten-einwilligung.js`, yeni `patient_consents` tablosu,
  `patient-documents` bucket, i18n sözlüğü (de/en/tr — kiosk metinleri bugün sözlükte hiç yok)
- **Doğrulanmadı:** Yaşlı/diyabetik hastanın tablette imza deneyimi — gerçek beta hastasıyla
  tek denemede görülür. Kabul testi: DF-b tanılı 74 yaş diyabetik, ilk randevu, 78030 + 78001
  sağ ayak; ikinci senaryo Nagelspange (Selbstzahler onamı) + Foto-Einwilligung.
- **Tutanak:** `konsey/tutanak/2026-08-14-patienten-uebergabe-einwilligung.md`

---

### Abrechnung: Kostenträger-Gruppierung ja, aber "toplu" = çok paket tek tık, tek birleşik fatura değil
- **Karar:** Podologie-Abrechnungsseite Kostenträger bazlı accordion olarak yeniden
  tasarlanır. Çoklu kasa seçimi ARKA PLANDA ayrı §302 paketleri + ayrı Begleitzettel
  üretir, tek birleşik fatura üretmez. Accordion başlığına 4. sütun: Zuzahlung-Status
  (bezahlt/nicht bezahlt/befreit, renkli). Hatalı reçete satırlarında "trotzdem
  übernehmen" (gerekçeli kabul) zorunlu.
- **Neden:** Abrechnung podolog için aylık/toplu bir iştir, seans işi değil (Beta-2,
  05.09.2026: *"Sieht abzurechnen, das ist Kopfschmerzen"*). Kasa kasa ayrılık §302'nin
  kendi yapısıdır (Anlage 1 V21 §5.3.1: pro Kostenträger je Leistungsbereich); podologun
  istediği tek fatura değil tek oturuşta bitirme. gkv-302 teyidi: gruplama birimi
  spesifikasyona uygun, hatta bugünkünden daha yakın.
- **Ön koşul (gkv-302, 05.09.2026):** Dosya birimi Kostenträger değil **DAV × Kassenart**
  (§5.3.1) — çoklu seçim yalnız aynı Datenannahmestelle+Kassenart'taki kasalar arasında
  serbest olabilir. Einzel- ve Sammelrechnung aynı dosyada YASAK (§5.3.2) — Sammelrechnung
  yolu bugün kodda yok, önce o yazılmalı. Sıra: (1) Krankenkasse-IK/VKG şema düzeltmesi
  → (2) Sammelrechnung yolu → (3) çoklu seçim UI. Ters sırada yapılırsa yanlış gruplanmış
  dosya üretilir.
- **Tarih:** 2026-09-05
- **Etkilenen:** `module/podologie-abrechnung.js` (bugün tek seçim, satır ~336),
  `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/dta/builder.js`
- **Reddedilen alternatif:** Kasaları tek pakette birleştirmek — §302 yapısına aykırı.
- **Tutanak:** Beta-2 görüşmesi 05.09.2026, `podoloji` + `gkv-302` ajan değerlendirmesi
  (Ops-Dashboard kart notlarında tam metin).
- **Uygulandı: 07.09.2026** (Ops #283). Üç commit: `b6bd17b` (golden-file regresyon
  dondurması) → `c12d2fe` (Karten-IK başına ayrı Gesamtrechnung + GES, `builder.js` +
  `segments.js`) → `b12c6fb` (Empfänger `kostentraeger_annahmestellen`'den, fallback
  71/72→99→00 — 20 Podologie'yi kapsamıyor, Anhang 03 §8.14 dipnot 4 — + Begleitzettel
  Gesamtrechnung başına, Karten-IK ile). Çoklu seçim UI `module/podologie-abrechnung.js`
  + yeni `module/podologie-dateieinheit.js`'te (hangi kasa hangi dosyaya gidiyor, seçim
  öncesi görünür). Sammelrechnung (J-flag) kodda hazır ama kapalı — hiçbir çağıran
  tetiklemiyor, Rechnungsart 3'e geçilirse açılır. 302 kasadan 82'si elektronik yolla
  çözülemiyor (gerçek reçete etkisi ölçüldü: sıfır, yalnız 4 mock-IK kaydı 412 alıyor) —
  bu kasalar için `abrechnung.routes.js` sert 412 döner, sessiz yanlış alıcıya göndermez.
  npm test 210/210.
- **Uygulandı: 2026-09-07 — sıranın (2). adımı, yarısı.** Ops #283.
  - `api-backend/billing/dta/builder.js` — dosya içi iki seviyeli gruplama
    (Kostenträger-IK → Karten-IK). Her Karten-IK artık kendi SLGA'sını ve kendi GES
    toplamlarını alıyor. Önceden `prescriptions[0]`'ın IK'sı tüm dosyaya yazılıyor ve
    GES tüm dosya üzerinden hesaplanıyordu — ikinci bir Karten-IK'da her kasa
    diğerinin tutarını görüyordu. Dosya reddi değil, **sessiz yanlış tutar**.
    Ayrıca DAV × Kassenart karışımı artık reddediliyor (§5.3.1).
  - `api-backend/billing/dta/segments.js` — `buildSLGA_FKT` alan 2 ↔ alan 5 çapraz
    doğrulaması (§5.5.2 s. 31-32).
  - Sammelrechnung yolu **yazıldı ama kapalı** (`sammelrechnung` varsayılan `false`,
    hiçbir üretim çağrısı `true` göndermiyor). Testi var.
  - Testler: `api-backend/billing/dta/gesamtrechnung.test.js` (14 test) +
    `__golden__/` — refactor **öncesi** çıktı ayrı commit'te donduruldu, bugünkü
    tek-kasa senaryosu byte-exact aynı kaldı. `npm test` 180/180.
- **⛔ Hâlâ açık — sıranın (1) ve (3). adımları, bilerek yapılmadı:**
  `abrechnung.routes.js`'in `kk.das_ik` yerine `kostentraeger_annahmestellen`
  okuması ve çoklu seçim UI'ı. Gerekçe: `db/REGISTER.md` →
  `kostentraeger_annahmestellen`, tabloyu bağlamadan **önce** `gkv-302`'nin
  Fallback-Kette (71/72 → 20 → 00) ve auflösemeyen 125 Kostenträger için çıkış
  yolu kararını vermesi gerekiyor. Karar olmadan bağlamak = dosyanın yanlış
  Empfänger'e gitmesi. Detay: bu oturumun raporu.

---

### Selbstzahler-Preisstufen: 3 isimlendirilebilir kademe + hasta bazlı son fiyat, versiyonlama yok
- **Karar:** Sınırsız preset değil, ayarlarda isimlendirilebilir 3 satır (ad + tutar) +
  hasta kartında `standard_preisstufe`/son kullanılan tutar alanı. Kademe geçmişi/
  versiyonlama yapılmaz.
- **Neden:** Gerçek ihtiyaç 2-3 kademe (eski/yeni hasta, Hausbesuch farkı) — Beta-2 örneği
  50€ eski / 68€ yeni. Preset listesi tek başına tık kazandırmaz; kazanç hastanın son
  fiyatının hatırlanmasındadır. Asıl hata riski (aynı hastaya iki farklı fiyat çıkarmak)
  orada — bu yüzden tutar **hastaya yazılan değere** bağlanır, kademe referansına değil
  (fiyat kademesi zamla değişince eski hastanın tutarı geriye dönük değişmemeli).
- **Tarih:** 2026-09-05
- **Reddedilen alternatif:** SB1/SB2 gibi kod adı dayatmak — podolog kendi adını yazsın.

---

### Fazla faturalandırma riski taşıyan Zusatzleistung otomatik işaretlenmez
- **Karar:** Befundpauschale ve benzeri ek/opsiyonel Heilmittel-Positionen otomatik
  eklenmez — önerilir (vurgulu, işaretsiz), podolog kendi tıklar.
- **Neden:** Beta-2, 05.09.2026: *"wäre meine Empfehlung nicht automatisch machen,
  sondern sollen wir selber anklicken"* — gerekçe kasa denetimi riski, sorumluluk
  podologda kalmalı. Tık ekonomisinin bilinçli olarak feda edildiği tek yer budur ve
  öyle kalmalı — otomasyon azaltma yönünde istisna.
- **Tarih:** 2026-09-05
- **Etkilenen:** HPNR seçim bloğu, `module/podologie-abrechnung.js` (~satır 622)

---

### Yüklenmiş Diagnosegruppe = hekim beyanıdır; ICD otomatiği yalnız boş alanı doldurur
- **Karar:** Muster 13'teki Diagnosegruppe (DG) hekimin beyanıdır, yazılımın çıkarımı değil.
  ICD→DG otomatiği bir DG'yi **yalnız boş alana** yazar veya **kendi önceki önerisini**
  değiştirir. Kâğıttan / tarama (Scan) ile / mevcut kayıttan / Folgeverordnung'dan yüklenen
  ya da podologun elle üstlendiği DG **asla üzerine yazılmaz** — ICD ile uyuşmazsa yalnız uyarı.
  - **Belirsizlikte hiçbir şey yazılmaz:** ICD birden fazla gruba uyuyorsa (ör. `E11.74` +
    `L60.0` → DF ve UI1/UI2) DG boş kalır, adaylar gösterilir. Otomatiğin daha önce yazdığı
    değer, ICD alanından çıkılırken (blur/`change`) **geri alınır**.
  - **DG alanını boşaltmak** otomatiği yeniden serbest bırakır.
  - **Alana salt tıklamak "üstlenme" sayılmaz** — üstlenme yalnız katalogdan seçim veya
    değer girip alandan çıkmaktır.
- **Neden:** Podologie-Vertrag Anlage 3 Ziffer 5 j: Verordnung'daki DG yalnız hekim tarafından,
  imza + tarihle değiştirilebilir. TA1 (Anlage 1 TP5 V21) §5.5.3.3: ZHE'deki DG =
  Verordnung'un DG'si. Yani otomatiğin hekim beyanını ezmesi, dosyaya **Verordnung'da olmayan
  bir DG** yazmak demektir — red değil, yanlış içerikli kabul/Absetzung riski. Kaynaklar
  `gkv-302` üzerinden; `wissensbank/SPEC-RULES.md` karşılığını `wissensbank` paralel olarak
  doğruluyor (bu kaydın yazıldığı tarihte doğrulama sonuçlanmamıştı).
- **Melih kararı (2026-09-25):** Boş alan **otomatik doldurulmaya devam eder** (Beta-1 isteği —
  tık ekonomisi), ama değer **öneri olarak işaretlenir**: *„aus ICD – mit Verordnung
  abgleichen"*. İşaret ve L4 uyarısı (fachfremd / belirsiz ICD, ör. `Z99.9`, `E11.72`)
  **sonraki adımda** gelir. Aday butonları / „DF übernehmen" düğmesi **istek, henüz karar
  değil.** (Yeni UI metinleri de/en/tr üç dilde gerekir.)
- **Tarih:** 2026-09-25
- **Durum:** L1–L3 **yerelde uygulandı (2026-09-25), henüz commit edilmedi / canlıda değil.**
  L4 + öneri işareti açık.
- **Etkilenen:** `icd-dg-match.js` (`dgVorschlag`: `auto` yalnız tek aday varsa),
  `dashboard.js` (`_wireDgIcdPair` — 26.09.2026'dan beri `module/icd-dg-verdrahtung.js` `verdrahteIcdDg`: `dataset.dgAuto` sahiplik işareti, geri alma, `change`
  ile üstlenme; `init` → `ensureDgIcdWiring` yüklenen DG'yi hekim beyanı sayar; i18n
  `pod_icd_mismatch` de/en/tr), `module/icd-dg-vorschlag.test.js`, `dashboard.html`
  (import sürümü). Ops #304.
- **Reddedilen alternatif:** (1) Otomatiği tamamen kapatmak — Beta-1'in açık isteği, boş
  alanda tık kazancı gerçek. (2) Yüklenen DG'yi ICD'ye göre "düzeltmek" — hekim beyanını
  yazılım değiştirir, Ziffer 5 j'ye aykırı. (3) Belirsizlikte en olası grubu seçmek — kararı
  Verordnung verir, yazılım değil.
- **Test senaryosu:** (a) Boş form, ICD `E11.74` → DG `DF` otomatik dolar. (b) Aynı formda ICD'ye
  `L60.0` eklenir → alan çıkışında DF geri alınır, adaylar (DF, UI1/UI2) gösterilir. (c) Taranmış
  Muster 13, DG `UI1`, ICD `E11.74` → DG `UI1` kalır, yalnız uyarı. (d) DG alanına tıkla, çık →
  otomatik hâlâ çalışır. (e) DG'yi boşalt, ICD `E11.74` → DF yeniden dolar.
- **İlişkili:** „Fazla faturalandırma riski taşıyan Zusatzleistung otomatik işaretlenmez"
  (2026-09-05) — aynı desen: belirsizlikte **yazma, öner**. O karar burada yeniden açılmıyor.
- **Doğrulanmadı:** Podologun kâğıttaki DG ile ICD uyuşmazlığında pratikte ne yaptığı (hekime
  mi döner, olduğu gibi mi faturalar) — Beta-1'e sorulacak; `podoloji` ajanı varsayımı.
- **Nachtrag 26.09.2026 — iki ICD alanı** (`podoloji` + `gkv-302` soruldu):
  - Otomatik **iki ICD alanını birlikte** okur: `E11.74` birinci + `L60.0` ikinci alanda → DG yok,
    adaylar DF, UI1, UI2 (tek alandaki virgüllü girişle aynı sonuç).
  - İlk alana iki kod yazılır, ikinci alan boşsa → çıkışta ikinci kod ikinci alana geçer
    („E11.74, L60.0" veya „E11.74 L60.0"). Kâğıtta da satır başına bir kod; uyarı yerine taşımak
    Podologa ~4 işlem kazandırır. Sebep ayrıca teknik: `icd10` tek kod tutar, virgüllü değer
    abrechnung'da V:01002 ile takılırdı.
  - ≥3 kod veya ikinci alan dolu → taşınmaz, ipucu + kaydederken uyarı; **sperre yok.** `gkv-302`:
    Anlage 3 k „eines oder mehrerer ICD-10-Schlüssel", Anlage 1 V21 DIA „1-n, so oft wiederholbar
    wie Diagnosen vorliegen" — 3 kodlu Verordnung geçerli ve abrechenbar; sperre para getirmez.
    3.+ kod için saklama yeri yok (bugün `icd10`/`icd10_2`). **Karar 26.09.2026: şimdilik yapılmaz** —
    Prod'da 67 Verordnung'ta üç+ kod hiç yok. Tetik: ilk gerçek 3-kodlu Verordnung veya eksik-ICD
    Beanstandung'u → `db-ustasi`. Gerekçe + kaynak: `wissensbank/SPEC-RULES.md` „Birden çok ICD".
  - DG ipucu tek yerde (ICD alanının altında); „passt nicht" ipucu uygun grupları da söyler.
    Podologie kutusundaki ikinci, kırmızı „passt nicht / zulässig" satırı kaldırıldı.
  - Otomatik, maskede işaretli Fachbereich'e göre çalışır (interdisziplinäre `praxis` mandantı dahil).
  - **Sıra kuralı yok** (`gkv-302`): DF için Diabetes kodu, UI için L60.0 herhangi bir sırada yeter.
    ~~Açık: L60.0 + başka kod UI'de „Korrektur erforderlich" sayılır mı~~ → **Hayır (26.09.2026):**
    Anlage 3 Ziffer 5 k „Korrekturmöglichkeit": ek ICD'ler „für die Gültigkeit … unschädlich";
    düzeltme yalnız L60.0 yoksa. Kod zaten böyle (frontend + backend aynası); SPEC-RULES „UI1/UI2: L60.0
    varsa ek ICD zararsızdır".

---

### „Podologische Angaben"-Block: Anlass nur bei Privat/Selbstzahler, nicht bei jeder GKV-Verordnung
- **Karar:** Im Block unter der Heilmitteltabelle der Muster-13-Maske (`module/verordnung-podo.js`,
  `rzPodoFelder`) bleibt „Behandelter Zehennagel" unverändert immer offen sichtbar, sobald die
  Diagnosegruppe UI1/UI2 ist (Pflichtfeld, abrechnungsrelevant). „Behandlungsanlass" wird dagegen
  nur noch bei einer **nicht-GKV**-Verordnung (privat/selbstzahler/bg) eingeblendet. Trifft weder
  das eine noch das andere zu — der weit überwiegende Fall, GKV ohne Nagelspange —, verschwindet
  der ganze Block. Kein „optional angeben"-Einklapp-Link.
- **Neden:** Beta-1-Feedback: „Podologische Angaben — wofür steht das? Wir benutzen das nicht."
  `podoloji`-Agent (28.09.2026) eingeholt: Bei einer Kassenverordnung steht Diagnosegruppe, ICD,
  Leitsymptomatik und Heilmittel bereits auf dem Muster 13 — für einen eigenen „Anlass" gibt es dort
  weder Feld noch Bedarf. Das Feld ist aber nicht zwecklos: Bei Privat-/Selbstzahler-/BG-Verordnungen
  gibt es keine Diagnosegruppe, und der Anlass übernimmt drei Aufgaben — Rechnungstext ohne
  Heilmittel-Positionsnummer (`module/rechnung-bruecke.js:147`), Titel in der Verordnungsübersicht
  (`module/verordnung-uebersicht.js:466`), Kennzeichen in der Abrechnungsliste
  (`module/podologie-abrechnung.js:578`). Ein Einklapp-Link wäre bei GKV toter Platz und würde bei
  Privatrezepten das einzige Feld verstecken, das dort die Diagnosegruppe ersetzt.
- **Woher die Maske die Rezeptart kennt:** Über dieses Formular ist eine NEUANLAGE immer GKV
  (`module/verordnung-pruefen-knopf.js:89` setzt `rezeptart: 'gkv'` hart für die Prüfung,
  `nutzlastAusMaske()` schreibt die Spalte beim Anlegen gar nicht — Privat-/Selbstzahler-
  Verordnungen entstehen über den separaten podologischen Schnellweg, `podNew*`-Felder in
  `module/podologie-abrechnung.js`, der KEIN Anlass-Feld hat). Relevant wird die tatsächliche
  Rezeptart deshalb nur beim BEARBEITEN einer bestehenden Nicht-GKV-Verordnung. `fuelleMuster13()`
  (`module/verordnung-maske.js`) schreibt sie dafür als Datenattribut auf `#rzMaskeWrap`
  (`dataset.rezeptart`) — kein Import, weil `verordnung-maske.js` bereits aus `verordnung-podo.js`
  importiert (Ringabhängigkeit). `maskeHeimschicken()` setzt das Attribut bei jeder Neuanlage
  („+ Neue Verordnung") defensiv auf `kassen` zurück.
- **Speichern ändert sich nicht:** Ist das Feld leer/versteckt, wird weiterhin der Standardwert
  „Podologische Komplexbehandlung" geschrieben (`podoVerordnungsfelder()`).
- **Reddedilen alternatif:** Ganzer Block/Anlass-Feld standardmäßig eingeklappt statt bedingt
  gerendert — verworfen, weil es beim Privatrezept das einzige echte Feld hinter einem Klick
  versteckt hätte, ohne den GKV-Regelfall wirklich sauberer zu machen (der Block bliebe als leerer
  Rahmen mit nur der Überschrift stehen).
- **Offen (`podoloji`, unbestätigt):** Ob Privatpraxen den Rechnungstext tatsächlich vom Standard
  abweichend ändern, hat noch keine Podologin bestätigt. Wenn nie — könnte auch der Privat-Fall
  auf den Standardwert ohne sichtbares Feld reduziert werden.
- **QA-Nachtrag 28.09.2026 (Claude-in-Chrome-Verifikation, `gkv-302` eingeholt):** Die Nicht-GKV-
  Sichtbarkeit konnte live nicht getestet werden — kein Bug hier, sondern eine seit 06.09.2026
  bestehende, unabhängige Lücke: der podologische Schnellweg (`podNew*`, inkl. Rezeptart-
  Umschalter) wurde bei der Verordnungs-Konsolidierung abgeschafft, die Muster-13-Maske ist
  seitdem der einzige Anlegeweg — ohne Rezeptart-Umschalter. **Per MCP nachgezählt:** alle 24
  Podoloji-Verordnungen in Prod stehen auf `rezeptart` NULL (20) oder `kassen` (4), keine einzige
  privat/selbstzahler/bg. `module/verordnung-pruefen-knopf.js` bereinigt (toter `podNew*`-Code
  entfernt). **Eigenes P2-Ticket nötig** (vor dem ersten PKV-Verordnungsfall): Rezeptart-
  Umschalter in `#rzMaskeWrap` nachbauen, `nutzlastAusMaske()` um `rezeptart` erweitern,
  GKV-Pflichtfelder (Diagnosegruppe/Kasse/Versichertennummer) bei `≠ kassen` zugeklappt statt
  verlangt (Beschluss 10.08.2026 oben), `lesenMuster13()` den echten Wert statt hart `'gkv'`
  übergeben lassen. Bislang **nicht ins Ops-Dashboard eingetragen** — dieser Sitzung fehlte der
  Zugriff (separates Supabase-Projekt, kein MCP, `ops/.env.ops` fehlt lokal).
- **Tarih:** 2026-09-28 (Ops #313)
- **Etkilenen:** `module/verordnung-podo.js` (`podoFelderAktualisieren()`, neue `rezeptart()`-Hilfe),
  `module/verordnung-maske.js` (`fuelleMuster13()`, `maskeHeimschicken()`),
  `module/verordnung-pruefen-knopf.js` (toter Code entfernt, 28.09.2026)

### §302 offene Einheiten — Grund der Rückfrage nennen (Reform S2.3b, canli-test 30.09 P2)
- **Karar:** Der gkv-302-Text („Es sind noch N Einheit(en) offen …") bleibt unverändert. Darunter
  kommt EINE Zusatzzeile, nur wenn ein Grund vorliegt — sowohl im Bereit-Dialog als auch in der
  Erstellen-Rückfrage:
  (a) künftiger Termin: „Für diese Verordnung ist noch ein Termin am TT.MM. geplant." / bei
  mehreren: „Für diese Verordnung sind noch N Termine geplant (nächster am TT.MM.)." (Jahr nur,
  wenn ≠ laufendes Jahr);
  (b) nur Erstellen, offen-Zahl geändert: „Seit der Freigabe am TT.MM. hat sich die Zahl offener
  Einheiten geändert (damals X, jetzt Y)." Bei mehreren Verordnungen im Sammeldialog wird der Grund
  an die jeweilige Listenzeile gehängt („… : 1 offen · Termin am 14.10. geplant").
- **Neden:** Ohne Grund wirkt die zweite Rückfrage wie ein Fehler („hab ich doch schon bestätigt").
  Ein geplanter Termin heißt: die Patientin kommt wieder — genau die Information, mit der die
  Podologin entscheidet, ob sie jetzt abrechnet oder wartet. Keine zusätzlichen Klicks.
- **Tarih:** 2026-09-30
- **Etkilenen:** `module/offene-einheiten.js` (`bestaetigungsText`), Bereit-Dialog (428-Pfad),
  `module/abrechnung-auswahl.js`
- **Reduzierte Alternative verworfen:** Knopf „Termin absagen" im Dialog — nützlich, aber teurer;
  erst wenn die Beta-Praxis das tatsächlich vermisst. Handlungsaufforderung im Text („bitte
  absagen") ebenfalls verworfen — manche wollen genau deshalb warten, der Text informiert nur.
- **Annahme:** nicht mit einer Podologin validiert.

### §302-Liste Einheiten-Spalte zeigt Behandlungen, nicht Positionen
- **Karar:** Die Spalte „Einheiten" zeigt immer `erbracht / verordnet · N offen`, erbracht =
  nicht stornierte Behandlungstage (dieselbe Zahl, aus der „offen" gerechnet wird), z. B.
  „1 / 3 · 2 offen", bei vollständiger Verordnung „3 / 3". Die Positionsanzahl (78010, 78030,
  79933 …) steht NICHT mehr in dieser Spalte — sie ist in „Mittel" bereits sichtbar. Tooltip:
  „Behandlungen erbracht / verordnet".
- **Neden:** „3 · 2 offen" liest die Podologin als „3 gemacht, trotzdem 2 offen?" — sie denkt in
  Behandlungen der Verordnung (Muster 13 „Anzahl"), nicht in HPNR-Zeilen. Befundpauschale und
  Hausbesuch sind keine Behandlungseinheit; eine Zahl, die sie mitzählt, ist klinisch falsch.
  Heute rechnet `einheiten` HPNR-Anzahlen (`abrechnung-auswahl.js:653`), `offen` Behandlungstage
  (`:656`) — zwei Basen in einer Zelle.
- **Tarih:** 2026-09-30
- **Etkilenen:** `module/abrechnung-auswahl.js` (Zeile `einheiten`, Render ~:879)
- **Reduzierte Alternative verworfen:** „1 / 3 Einheiten · 2 offen" — Wort doppelt zur
  Spaltenüberschrift, kostet Breite.

### Leitsymptomatik ⇄ Heilmittel: Maßnahme vergleichen, nicht Positionstext (Reform 6a, canli-test 30.09)
- **Karar:** Die Prüfung `LS_HEILMITTEL_ABWEICHUNG` (`module/verordnung-pruefung.js:307-313`)
  vergleicht die Leitsymptomatik mit der **Maßnahme**, nicht mit dem Klartext der Position:
  (1) Heilmittelfeld = 78010 / „Podologische Behandlung (klein)" → **keine Meldung** (78010 ist die
  Position für a, b UND c — Anlage 1a i.d.F. 17.06.2024, Teil 1 Nr. 1-3 + Teil 2 Ziff. 1-3).
  (2) 78020 / „(groß)" bei Leitsymptomatik a) oder b) → Warnung: „78020 „Behandlung groß" gehört nur
  zur Komplexbehandlung (Leitsymptomatik c). Bei a) oder b) wird 78010 abgerechnet." — dieselbe
  Regel, die beim Speichern der Tagesbehandlung schon sperrt (`podologie-abrechnung.js:975`).
  (3) Heilmittelfeld nennt eine andere Maßnahme (z. B. a) + „Nagelbearbeitung") → Warnung bleibt,
  neuer Text: „Leitsymptomatik a) passt zu „Hornhautabtragung" — auf der Verordnung steht
  „Nagelbearbeitung". Bitte mit der verordnenden Praxis klären."
  Zuordnung Maßnahme↔Position aus `POD_HEILMITTEL_KATALOG` (`podologie-abrechnung.js:157-176`),
  keine zweite Tabelle.
- **Neden:** Heute meldet jede korrekt erfasste Verordnung mit 78010 eine Abweichung („folgt
  Hornhautabtragung"). Eine Warnung, die immer kommt, lernt die Podologin wegzuklicken — und
  übersieht dann die echte.
- **Tarih:** 2026-09-30
- **Etkilenen:** `module/verordnung-pruefung.js` (Abschnitt 5), Verordnungsmaske / Prüfknopf
- **Reddedilen alternatif:** Meldung ganz streichen — verworfen, Fall (2)/(3) sind echte Fehler.
- **Offen (gkv-302):** Schwere von Fall (3) — reicht Warnung, oder ist eine abweichende
  Maßnahme/Leitsymptomatik ein Absetzungsgrund (dann Blocker)?
- **Annahme:** nicht mit einer Podologin validiert.

### Tagesbehandlung ohne Behandlungsposition (Reform 6b, canli-test 30.09, QA `3e256b9a`)
- **Karar:** Drei Teile.
  (1) **Ursache beheben — Vorbelegung:** Bei DF/NF/QF wird 78010 immer vorbelegt, auch wenn die
  Maßnahme unbekannt ist (Leitsymptomatik fehlt, keine `heilmittel_items`).
  `podo-behandlungsposition-regel.js:39-43` gibt heute dann `''` zurück; 78010 ist aber für alle drei
  Maßnahmen die zulässige Position, also auch bei unbekannter die sichere. Braucht die
  Diagnosegruppe als Eingabe. UI1/UI2 unverändert (kein 78010).
  (2) **Speichern ohne 78010/78020 (DF/NF/QF):** vorerst **Rückfrage, keine Sperre**
  (`podologie-abrechnung.js:961` ff.): „Keine Behandlungsposition (78010/78020) gewählt — es wird
  nur die Befundung dokumentiert. Ist das so gewollt?" Knöpfe „Ohne Behandlung speichern" /
  „Zurück". Klinischer Grund: der Befund kann eine Behandlung verbieten (offene Wunde/Ulkus,
  Infektion → an den Arzt verweisen); die Dokumentation dieses Tages muss möglich bleiben.
  (3) **Fehlende Leitsymptomatik** bleibt bei der Erfassung Warnung (`verordnung-pruefung.js:290`,
  Papierrezept, die Podologin kann es nicht selbst korrigieren); zusätzlich im Kopf der
  Tagesbehandlung ein nicht sperrender Hinweis: „Auf der Verordnung fehlt die Leitsymptomatik —
  bitte von der verordnenden Praxis ergänzen lassen, bevor abgerechnet wird."
- **Neden:** Pozisyonsuz kayıt podologun iradesiyle değil, boş önseçimle oluştu. Önseçim düzelince
  normal gün 0 ek tık; istisna (yalnız Befund) 1 ek tık, sessiz kalmaz.
- **Tarih:** 2026-09-30
- **Etkilenen:** `module/podo-behandlungsposition-regel.js`, `module/podologie-abrechnung.js`
  (`podVordBehandlungsposition` :429, Speichern :923-980)
- **Reddedilen alternatif:** Sofort harte Sperre — verworfen bis gkv-302 antwortet (s. u.), weil sie
  den klinisch legitimen „nur Befund, nicht behandelt"-Tag unmöglich machen würde.
- **Offen (gkv-302):** (a) Ist 78030 bzw. 78040 ohne 78010/78020 am selben Tag abrechenbar? (FAK Q6:
  „78030 ist zu jeder der Abrechnungspositionen … abrechenbar" — deutet auf Nein.) Wenn Nein: bleibt
  der Tag dokumentierbar, fällt aber aus der §302-Datei heraus — oder Sperre? (b) Gehört fehlende
  Leitsymptomatik in die Server-Sperre `fehlendeVerordnungsangaben()`
  (`verordnung-status.routes.js:118`)?
- **Annahme:** nicht mit einer Podologin validiert.

### Abrechnungsstatus-Dialog: kein „Bereit" ohne Behandlung (Reform 6c, canli-test 30.09)
- **Karar:** Hat die Verordnung (Status `aktiv`) **keine** nicht-stornierte Behandlung:
  „Bereit zur Abrechnung" bleibt in der Liste sichtbar, aber **deaktiviert** mit Etikett
  „Bereit zur Abrechnung — erst nach der ersten Behandlung"; **keine Vorauswahl** — erste Option
  „Bitte wählen …", „Übernehmen" deaktiviert bis zur Wahl. Hilfezeile: „Für diese Verordnung ist
  noch keine Behandlung dokumentiert." Mit ≥ 1 Behandlung bleibt „Bereit" vorausgewählt
  (Normalfall, unverändert). Zählung wie der Server (`verordnung-status.routes.js:210-218`,
  `storniert_am IS NULL`), geladen in `oeffneStatusDialogFuer()` (`abrechnungsstatus.js:656-669`),
  angewendet bei den Optionen (`:517-519`). Server-422 bleibt als Netz.
- **Neden:** Heute führt der vorausgewählte Weg in eine Fehlermeldung (Klick → 422 → umwählen).
  Wer eine Verordnung ohne Behandlung öffnet, will fast immer stornieren oder archivieren; beides
  ist folgenreich und darf NICHT vorausgewählt sein — deshalb Platzhalter statt „Storniert".
- **Tarih:** 2026-09-30
- **Etkilenen:** `module/abrechnungsstatus.js` (`oeffneStatusDialog`, `oeffneStatusDialogFuer`)
- **Reddedilen alternatif:** „Bereit" ausblenden — verworfen, die Podologin fragt sich dann, wo es
  ist; deaktiviert + Grund erklärt sich selbst. „Storniert" vorwählen — verworfen (destruktiv).
- **Annahme:** nicht mit einer Podologin validiert.

### S0-Konsey 30.09: Behandlungstag, Wagner, Vorbelegung, Menü
- **Karar:** Kein neuer „Behandlung dokumentieren"-Bildschirm — Tagesbehandlung bleibt der einzige Speicherweg, mit einklappbarem Fußbefund-Abschnitt (Standard zu, „Befund unverändert / aktualisieren") und „Folgetermin?"-Dialog nach dem Speichern. Wagner wird im Fußbefund erfasst und als Rozet im Patientenkopf und in der Tagesbehandlung gezeigt (nur DF/E10/E11). Vorbelegung: Planung (Termin/Serie) Befund nur vorgeschlagen; Tagesbehandlung darf nach Regel ankreuzen, mit Begründungstext und Zeile „Verordnet: 78xxx". Menü: Gruppen „Heute · Termine · Patienten · Abrechnung · Praxis · Einstellungen".
- **Neden:** zwei Speicherwege auf `podologie_behandlungen` würden auseinanderlaufen (muhalif, gkv-302); Wagner ist Fußzustand, nicht Rezept.
- **Tarih:** 2026-09-30 · Tutanak: `konsey/tutanak/2026-09-30-podologie-s0-behandlungstag-menue.md`
- **Beta-1'e bağlı:** Befund jede Sitzung? · Tablet oder Telefon beim Hausbesuch? · „Heute" als Startbildschirm? · Therapiezeit am Bildschirm?
- **gkv-302 Antworten auf die offenen Punkte oben (6b):** 78030/78040 ohne 78010/78020 am selben Tag nicht abrechenbar — Tag bleibt dokumentiert, 78030 fällt aus der Datei; fehlende Leitsymptomatik = Bereit-Sperre (außer UI1/UI2), Praxis darf im Einvernehmen mit dem Arzt ohne neue Unterschrift ergänzen; Leitsymptomatik↔Maßnahme-Abweichung = Warnung. Server-Teil → Sitzung B.

### Podologie-Anamnese: eigenes Formular, 20 Felder, 3 Pflichtfelder, Risiko-Rozet statt Wiederholung
- **Karar:** Die Anamnese wird je Fachbereich getrennt (Kemal, 30.09.2026). Für die Podologie gilt
  diese Feldliste in 6 Gruppen:
  **A Diabetes:** Diabetes mellitus (nein/Typ 1/Typ 2/andere, *Pflicht*) · Diabetes seit (Jahr) ·
  Therapie (Diät/Tabletten/Insulin/GLP-1) · HbA1c % + Datum (nie Pflicht).
  **B Fuß-Risiko:** Neuropathie bekannt · pAVK/Durchblutungsstörung · früheres Fußulkus (Seite) ·
  Amputation (Seite + Höhe) · Niereninsuffizienz/Dialyse (+ Dialysetage) — alle mit „unbekannt";
  bei Diabetes ≠ nein *Pflicht* (unbekannt zählt als Antwort).
  **C Medikamente:** Gerinnungshemmung (nein/ASS-Clopidogrel/Phenprocoumon/DOAK/Heparin, *Pflicht*) ·
  weitere relevante (Kortison/Immunsuppressiva/Chemotherapie/keine + Freitext).
  **D Allergien & Hygiene:** Allergien (keine/Latex/Desinfektionsmittel/Pflaster-Kleber/
  Lokalanästhetika/Metall-Nickel/Salicylsäure + Freitext, *Pflicht*, „keine" ist Antwort) ·
  übertragbare Infektion (nein/MRSA/Hepatitis/HIV/andere).
  **E Alltag:** Einschränkungen Selbstpflege/Mobilität (Mehrfach: keine/Sehen/Bücken/Gehhilfe/
  Rollstuhl/Pflegedienst) · Rauchen (nein/ja/früher).
  **F Ärzte & Anliegen:** Hausarzt (arzt-suche, vorbelegt mit verordnendem Arzt) · Diabetologe/
  Fußambulanz (nur bei Diabetes) · Anliegen des Patienten (1 Zeile) · Bemerkungen.
  Meta automatisch: Datum, erfasst von. Folgeverordnung: ein Knopf „Anamnese unverändert
  bestätigt" (1 Tap), versioniert wie `pat_fussbefund` (§ 630f BGB).
- **Warnungen (Patientenkopf + Tagesbehandlung, max. 3 sichtbar + „+n"):** rot — Gerinnungshemmung
  (Phenprocoumon/DOAK/Heparin; ASS nur orange), Latex-/Desinfektions-/Pflaster-/Metallallergie,
  Z. n. Ulkus, Amputation, Dialyse, pAVK. Orange — Neuropathie, Immunsuppression/Kortison,
  Infektion als neutrales „Hygiene" (Diagnose nicht auf dem Bildschirm). Hinweis (kein Block):
  Verordnung DG DF, Anamnese Diabetes „nein"/leer.
- **Keine Doppelerfassung:** Der „Risiken"-Block im Fußbefund (`module/fussbefund.js:1197-1204`,
  diabetes/allergien/infektionskrankheiten/gerinnungshemmer) wird zur Nur-Lese-Anzeige aus der
  Anamnese. Schuhe/Einlagen bleiben im Fußbefund (Anlage 1a 4.1: „Prüfung der Verwendbarkeit
  vorhandener Hilfsmittel" ist Befunderhebung, nicht Anamnese) — dort fehlt noch die Option
  „diabetesadaptierte Fußbettung / orthopädische Maßschuhe". Sensibilität (Monofilament/
  Stimmgabel) und Fußpulse sind gemessene Befunde → Fußbefund, nicht Anamnese.
- **Wer füllt aus:** Selbst ausfüllbar (Name bekannt/einfach): Diabetes Typ + seit + Therapie,
  Amputation, Dialyse, Gerinnungsmittel **per Präparatname**, Allergien, Rauchen, Hausarzt.
  Mit Podologin: Neuropathie, pAVK, früheres Ulkus, HbA1c, Einschränkungen, Infektion. Bestätigt
  den Beschluss vom 14.08.2026 (Anamnese mit Podologin); nur Vorbefüllung wäre denkbar.
- **Tık:** Gesunder Nichtdiabetiker 3 Antworten + Speichern = 4 Taps. Typischer Diabetiker ~11.
  Folgeverordnung ohne Änderung 1 Tap.
- **Neden:** Anlage 1b/1c (Nagelspange, Erstbefundung) nennt als Anamnese-Inhalt Allergien,
  Vorerkrankungen, körperliche Einschränkungen, Medikamente; Anlage 1a 4.1 (78040) verlangt die
  „Erhebung der podologischen Anamnese" ohne Feldliste. Die Fuß-Risikofelder folgen der IWGDF-2023-
  Risikostratifizierung (LOPS/pAVK + Ulkus/Amputation/terminale Niereninsuffizienz = Risiko 3).
  Die fizyo-Felder (Schmerzskala, Sport, Beruf, OP-Liste Meniskus/Wirbelsäule) haben dort keinen Nutzen.
- **Tarih:** 2026-09-30
- **Etkilenen:** `dashboard.html` `#panel-anamnese`, `saveAnamnese` (`dashboard.js`), Tabelle
  `anamnese`, `module/fussbefund.js` (Risiken-Block), Patientenkopf/Tagesbehandlung (Rozet).
  Speichermodell (Kolonnen vs. jsonb je Fachbereich) entscheidet `db-ustasi`.
- **Reddedilen alternatif:** „Alles nein"-Schnellknopf — verworfen, lädt zum Durchklicken ein genau
  bei den Fragen, die eine Verletzung verhindern sollen. HbA1c als Pflicht — verworfen, viele
  Patienten kennen den Wert nicht, Pflicht würde Fantasiewerte erzeugen.
- **Annahme:** nicht mit einer Podologin validiert (Beta-1). Offen: Dialysetage für die
  Terminplanung wirklich genutzt? Nickel/Metall bei Nagelspange klinisch relevant?
- **Führende Quelle (Nachtrag 30.09., `db-ustasi`-Befund):** Dauerhafte Risiken (Diabetes,
  Gerinnungshemmung, Allergien, Infektion, pAVK, Neuropathie, Ulkus/Amputation, Dialyse) führt
  **allein die Anamnese**. Der Fußbefund fragt sie nicht mehr: der Risiken-Block zeigt den
  aktuellen Anamnese-Stand nur lesend (+ Link „Anamnese ändern") und schreibt ihn beim Speichern
  als **Kopie** in `befund.risiken` (mit Anamnese-Version) — der Befund bleibt ein vollständiger
  Schnappschuss, alte Befunde werden nie umgeschrieben. Die Rozets (Patientenkopf,
  Tagesbehandlung) lesen **nur** die gültige Anamnese-Fassung, nie `befund.risiken`.
  Übergang: Hat ein Patient noch keine Podo-Anamnese, aber Fußbefunde mit `risiken`, werden diese
  Werte beim ersten Öffnen der Anamnese **vorgeschlagen** (sichtbar markiert, Bestätigung nötig),
  nicht still übernommen. Begründung: Risiko ist Patienteneigenschaft, Befund ist Zustand am Tag —
  zwei Eingabestellen laufen auseinander, und ein veraltetes „Gerinnungshemmer: nein" im Befund
  ist die gefährlichste Form davon.
- **Kiosk (Kemal-Entscheidung 30.09.):** Kiosk mit voller Anamnese bleibt, die Podologin gibt ihn
  nach Ermessen weiter; zusätzlich neuer Knopf „Nur Einwilligung" (nur Onam-Formulare). Im Kiosk
  tragen die „mit Podologin"-Felder einen Hinweis („Wenn Sie unsicher sind, wählen Sie ‚weiß
  nicht' — wir besprechen das gemeinsam") und „weiß nicht" als Option. Eine im Kiosk ausgefüllte
  Anamnese gilt als „vom Patienten angegeben — ungeprüft" bis die Podologin mit 1 Tap bestätigt;
  Rozets erscheinen trotzdem sofort (lieber eine ungeprüfte Warnung als keine).
