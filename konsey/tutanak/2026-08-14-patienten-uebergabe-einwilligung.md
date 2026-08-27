# Konsey Kararı — "Patienten übergeben": kilitli hasta ekranı + dijital Einwilligung
Tarih: 2026-08-14 · Oturan üyeler: legal-de, muhalif, deger-mi, podoloji, fonksiyon-ustasi

## Tetikleyen

Ops-Dashboard kartı (Gemeinsam · Bereich: Patienten · Anamnese). Beta müşterisi Beta-2 kâğıt
onam arşivinden şikâyetçi — *"ich habe so einen Stapel Papier"* (transkript 444-451). İstenen:
tablet hastaya uzatılır, ekran kilitlenir, hasta kendi onam metnini imzalar, terapist PIN ile
geri alır.

Konseye giden soru: **bu mod yapılmalı mı, yapılırsa hangi kapsamda ve kilit hangi katmanda
garanti edilir?** Seçenekler A (tam kapsam kilit+imza+PIN), B (kilitsiz sadece imza),
C (oturumsuz tek-kullanımlık token'lı ayrı sayfa), D (yapılmaz).

## Konseyi ters yüz eden olgu

`fonksiyon-ustasi` ilk turda kritik olguyu getirdi: **kilitli mod zaten yazılmış ve canlıda.**
Diğer dört üye "yapalım mı" sorusunu bunu bilmeden tartıştı.

| | Bulgu |
|---|---|
| Buton | `dashboard.html:1943` — `title="Tablet an Patient übergeben"` |
| Overlay | `dashboard.html:5747` — z-index 99999, `requestFullscreen()`, `body.overflow=hidden` |
| PIN modalları | `dashboard.html:5766` (giriş) · `5787` (kurulum) |
| Fonksiyonlar | `dashboard.js:22783-22960` — `initKioskMode` · `handleKioskStart` · `handleKioskPinSetup` · `enterKioskMode` · `exitKioskMode` · `showKioskPinModal` · `handleKioskPinConfirm` · `handleKioskPinForgot` |
| Mekanizma | `#panel-anamnese` DOM'dan `appendChild` ile overlay'e taşınır, çıkışta geri konur |
| PIN | `profiles.tablet_kiosk_pin` — 4 hane, **düz metin**, karşılaştırma **client-side** (`dashboard.js:22927`) |

**Yani kiosk bugün hastaya onam metnini değil, Anamnese formunu uzatıyor.** İmza alanı yok,
hasta onamı için tablo yok.

### Canlıdaki üç delik (kodda doğrulandı)

1. **`handleKioskPinForgot` (`dashboard.js:22940-22948`) PIN'i hiç doğrulamadan
   `exitKioskMode()` çağırıyor** ve üstüne `tablet_kiosk_pin`'i `null`'a çekiyor. Hastanın
   elindeki tablette "PIN vergessen?" tıklaması hem tam dashboard'a düşürüyor hem kilidi
   kalıcı olarak kaldırıyor.
2. **`handleKioskPinConfirm` (`dashboard.js:22927`): `if (!storedPin || entered === storedPin)`**
   — PIN kurulmamışsa girilen her şey kabul; karşılaştırma client-side, DevTools'ta aşılır.
3. Terapistin Supabase oturumu cihazda **açık**, aynı origin, aynı token → kilit bir güvenlik
   sınırı değil, kaza önleyicidir.

### Mevcut altyapı — yeniden yazılmayacak olanlar

- `patient-documents` private Storage bucket'ı **var** (`database_v16_patient_documents.sql`);
  bugün sadece Zuzahlung-Befreiung eki yazıyor, okuma `createSignedUrl` 300 s.
- `consent_log` tablosu var (`db/SCHEMA.sql:453`) — `consent_type` + `version` deseni hazır,
  **ama `user_id -> profiles`, yani praxis sahibinin AVV/AGB onayı.** Hastaya ait değil.
- `document_vorlagen` (`db/SCHEMA.sql:558`) — `vorlage_type` CHECK'i 8 fatura tipiyle kapalı,
  onam tipi yok.
- `prescription_documents` (`db/SCHEMA.sql:1074`) — `prescription_id` zorunlu, hasta dosyası değil.
- Hasta tablosu `leads`; `anamnese.patient_id -> leads(id)`. İkisinde de onam/imza kolonu yok.
- Projede **hiç** canvas/pointer tabanlı imza alanı yok. `renderSignatureStatus`
  (`dashboard.js:19492`) KI-OCR'ın "Arzt-Unterschrift erkannt" göstergesidir, imza almaz.
  Browser PKCS#7 (`dashboard.js:21252`) §302 DTA imzalamasıdır — adında PIN geçer, **karıştırma**.

## KARAR

**Yeni bir kilitli mod YAPILMAYACAK — var olan kiosk sertleştirilecek ve onam/imza onun içine
bindirilecek. Seçenek C (oturumsuz ayrı sayfa) RAFA KALDIRILDI, tetiğe bağlandı.** İş iki
bağımsız pakete ayrılır ve **P1 önce, P2'yi beklemeden** gider:

**P1 — Güvenlik borcu (imzadan bağımsız, önce).** `handleKioskPinForgot` artık kiosk'tan
çıkarmaz → `supabase.auth.signOut()` + login ekranı. PIN düz metin olmaktan çıkar, hash'lenir;
doğrulama `api-backend/server.js`'te yeni bir route'ta yapılır (G8 temiz — Vercel'e dokunulmaz),
denemeye rate limit. `!storedPin` kısa devresi kaldırılır: PIN yoksa kiosk hiç başlamaz.
`fullscreenchange` dinlenir, ESC/F11 ile çıkışta yeniden tam ekran istenir, olmazsa PIN modalı
zorlanır. `bookings-realtime` aboneliği (`dashboard.js:18732`) kiosk açıkken kapatılır.
`appendChild` taşıması `try/finally`'e alınır — kiosk içinde hata atarsa `#panel-anamnese`
overlay'de yetim kalıp dashboard boş görünüyor.

**P2 — Onam + imza.** Kiosk'a onam ekranı bindirilir: **tek akış, iki ekran, iki imza** —
ekran 1 `Behandlungsvertrag + Ausfallgebühr` (§630d tarafı), ekran 2 `Datenschutz-Einwilligung`
(Art. 7 tarafı). Birleştirme **yasak** (Koppelungsverbot). İmza raster PNG olarak
`patient-documents` bucket'ına yazılır; kayıt **yeni `patient_consents` tablosuna** gider —
`consent_log` genişletilmez. Onam metni sürümlü ve değişmez saklanır (`text_version` +
`text_sha256`). Hastaya kopya (PDF indir/yazdır) ve hasta dosyasından belge tipi+tarihle geriye
dönük arama **v1 kapsamındadır** — ikisi yoksa podolog yine kâğıt basar, iş amacına ulaşmaz.

**Yeni kod `dashboard.js`'e YAZILMAZ** → `module/patienten-einwilligung.js` (2026-08-13 kararı,
pre-commit kapısı). Kiosk metinleri bugün i18n sözlüğünde hiç yok (sabit Almanca,
`dashboard.html:5769-5805` + `dashboard.js:22843,22930,22944`) — dokunulan metinler de/en/tr
üçüne birden eklenir.

## Gerekçe

Kör nokta turu belirleyici oldu: `fonksiyon-ustasi`'nın "kilit zaten var" olgusu dört üyeden
üçünde pozisyon değiştirdi. `legal-de` ve `muhalif` C'yi bıraktı — mevcut kiosk varken C
**ikinci** bir kod yolu, ikinci oturum modeli ve on-prem'de ikinci dağıtım hedefi demek;
"imza hangisinde alındı" sorusu destek borcuna dönüşür. `deger-mi` "kilidi çıkar" önerisini
geri aldı (silmek de iş + regresyon) ama asıl düzeltmesi şuydu: kilit **güvenlik değil kaza
önleyicidir**, çünkü terapistin oturumu cihazda açık kalıyor. Hukuken zorunlu olan kilit değil,
**imza + sürümlü onam metni** — değerin taşıyıcısı orada.

## Ödün verilenler

- **Kilit güvenlik sınırı olmuyor, olmayacak.** P1'den sonra bile hastaya uzatılan tablette
  terapistin oturumu açık; kararlı bir saldırgan için kiosk aşılabilir. Bunu bilerek kabul
  ediyoruz — karşılığında C'nin token/expiry/tek-kullanım altyapısını ve yeni public yüzeyi
  ödemiyoruz.
- Kartın "mod aktifken navigasyon, arama, diğer hasta verisi erişilemez" maddesi **tam olarak
  garanti edilmiyor** — kaza önleyici seviyede karşılanıyor. Kartın "bitti sayılır" ölçütü bu
  yönüyle daraltıldı.
- `podoloji`'nin "her hastada tek imza, tek paket" önerisi hukuki şart yüzünden düştü — 1 yerine
  2 imza.
- Ekran görüntüsü hiçbir senaryoda engellenmiyor.
- `profiles.tablet_kiosk_pin` düz metin kolonu migrasyon gerektiriyor; mevcut PIN'ler geçersiz
  kılınacak, kullanıcılar yeniden PIN kuracak.

## Uzlaşma

- Kilit **kaza önleyicidir, güvenlik sınırı değildir** — dört üye ayrı ayrı aynı yere geldi.
- İmzalanan metnin **sürümü + hash'i** saklanmalı; "Häkchen" yetmez.
- Podolojide onam anı **karşılama/Erstanamnese**; tablet hasta gelmeden hazırlanır, podolog
  eldivenliyken ekrana dönmez. Sıra: karşılama → onam imzası → anamnez podologla birlikte.
- `handleKioskPinForgot` deliği karar konusu değil, **ayrı ve acil** bir hata.
- C bugün yapılmaz ama silinmez — tetiğe bağlanır.

## Anlaşmazlık

- **`podoloji` kör nokta turunda C'yi destekledi** (yanlış okumasını düzeltince: "aynı tablette
  oturumsuz sayfa ise hasta için fark yok"), tam da diğer üçü C'yi bırakırken. Chairman C'yi
  rafa kaldırdı: `podoloji`'nin gerekçesi "hasta için fark yok" (nötr), diğerlerininki "ikinci
  kod yolu maliyeti" (negatif) — nötr, negatifi yenmez.
- `podoloji` tek imza istedi, `legal-de` iki ayrı imza şart koştu. **Sert veto tarafı kazandı**;
  `podoloji`'nin "tek akış, iki ekran, tek Weiter" biçimi uzlaşma olarak alındı.

## Kör noktalar

- **Kiosk bugün hastaya Anamnese formunu uzatıyor** — kimse bunu sormamıştı. `podoloji`:
  podolojide anamnez ilk seansta **podologla birlikte** doldurulur (diyabet, Marcumar,
  Durchblutung soruları hasta tarafından yanlış anlaşılıyor), hastanın tek başına doldurması
  riskli varsayım. Yani kiosk'un bugünkü içeriği muhtemelen yanlış; doğru içeriği onamdır.
- `handleKioskPinConfirm`'deki `!storedPin` kısa devresi ikinci bir bypass — ilk turda kimse
  görmedi, kod okumasında çıktı.
- `bookings-realtime` toast'ları kiosk açıkken hastaya görünüyor (bugün de öyle) — başka
  hastanın randevu bilgisi hastanın gözü önünde.
- ESC/F11 fullscreen'den çıkarır; overlay kalır ama tarayıcı çubuğu geri gelir.
- `appendChild` taşıması hata durumunda paneli yetim bırakır — kiosk'la ilgisiz bir istisna
  dashboard'ı boşaltabilir.
- `consent_log`'da `ip_address` kolonu var; hasta onamına aynı deseni taşımak
  Art. 5 Abs. 1 lit. c ihlali olurdu. Praxis tabletinde IP = praxis router'ı → delil değeri sıfır.
- Kiosk metinleri i18n sözlüğünde hiç yok → üç dil kuralı **bugün ihlal durumunda**.

## Uygulama — builder'a

**P1 — güvenlik (önce, P2'yi beklemez)**
- [ ] `handleKioskPinForgot` (`dashboard.js:22940`) → kiosk'tan çıkarmak yerine `signOut()` + login — karmaşıklık: K1
- [ ] `handleKioskPinConfirm` (`dashboard.js:22927`) `!storedPin` kısa devresi kaldırılır; PIN yoksa kiosk başlamaz — karmaşıklık: K1
- [ ] `profiles.tablet_kiosk_pin` → hash'e migrasyon (`db/README.md` okunur, migration sonrası **"şema güncelle"**); mevcut PIN'ler geçersiz — karmaşıklık: K2
- [ ] PIN doğrulama route'u `api-backend/server.js` + rate limit (yeni Vercel fonksiyonu YOK) — karmaşıklık: K2
- [ ] `fullscreenchange` guard + `bookings-realtime` unsubscribe + `appendChild` `try/finally` — karmaşıklık: K2
- [ ] Kiosk giriş/çıkış audit kaydı — karmaşıklık: K1

**P2 — onam + imza**
- [ ] `patient_consents` tablosu: `patient_id -> leads(id)`, `consent_type`, `text_version`, `text_sha256`, `signature_path`, `consented_at`, `captured_by_user_id`, `device_label`. **`ip_address` YOK.** RLS + 10 yıl saklama — karmaşıklık: K3
- [ ] Onam metinleri sürümlü kaynak (`document_vorlagen`'ın `vorlage_type` CHECK'i genişletilir **veya** ayrı kaynak — `fonksiyon-ustasi`'na sorulur, kopya yol açılmaz) — karmaşıklık: K2
- [ ] `module/patienten-einwilligung.js`: iki ekran / iki imza akışı + canvas imza (raster PNG, **basınç/dinamik toplanmaz**) — karmaşıklık: K3
- [ ] İmza PNG → `patient-documents` bucket; hasta dosyasında belge tipi+tarihle listelenir ve geriye dönük aranır — karmaşıklık: K2
- [ ] Hastaya kopya: PDF indir/yazdır — karmaşıklık: K2
- [ ] Yaşlı/diyabetik hasta uyarlaması: ≥18px, kısa bloklar, ekran genişliğinde imza alanı, tablet masaya düz konur — karmaşıklık: K1
- [ ] Dokunulan tüm kiosk/onam metinleri i18n sözlüğüne de/en/tr — karmaşıklık: K1
- [ ] `compliance/VVT.md`'ye yeni işleme faaliyeti (Einwilligungserfassung) + `compliance/TOM.md` güncellemesi; DSFA güncellenir, yeniden yapılmaz — karmaşıklık: K1

**Kabul testi (`podoloji`'nin senaryosu):** DF-b tanılı 74 yaşında diyabetik hasta, ilk randevu,
78030 + 78001 sağ ayak; ikinci senaryo Nagelspange (Selbstzahler onamı) + Foto-Einwilligung.

## Backlog (karara dahil DEĞİL)

- Foto-Einwilligung (Fußbefund görseli), Schweigepflichtentbindung (Hausarzt'a Therapiebericht),
  Hausbesuch onamı — v1'den sonra, aynı motorda ek `consent_type`
- Yeni Verordnung'da süresi dolan/değişen belgenin otomatik tetiklenmesi (baştan imzalatma değil)
- Kiosk'un bugün Anamnese formunu göstermesinin doğru olup olmadığı — ayrı ürün sorusu
- `document_vorlagen` `vorlage_type` CHECK'inin genel olarak açılması

## Sert veto

`legal-de` ⛔ vermedi — 🔧 KOŞULLU. Aşağıdakiler **bağlayıcı şart**, pazarlık konusu değil:

1. **Einfache elektronische Signatur yeterlidir.** Ne §630d/630e BGB ne Art. 7 DSGVO Schriftform
   (§126 BGB) ister; QES/fortgeschrittene Signatur orantısız. eIDAS Art. 25: basit e-imza
   mahkemede reddedilemez, freie Beweiswürdigung'e tabidir.
2. **İki ayrı metin, iki ayrı imza.** §630d BGB Behandlungs-Einwilligung (Behandlung şartı) ile
   Art. 7 DSGVO rızası (widerruflich, Art. 7 Abs. 3 önceden bilgilendirme zorunlu) birleştirilemez
   — Koppelungsverbot riski.
3. **Metnin tam sürümü değişmez saklanır** (`text_version` + `text_sha256`), sadece onay bayrağı
   değil — Art. 7 Abs. 1 Nachweispflicht.
4. **IP adresi toplanmaz.** Praxis tabletinde yüz yüze imzada IP = praxis router'ı, delil değeri
   sıfır → Art. 5 Abs. 1 lit. c (Datenminimierung) ihlali. `consent_log`'daki `ip_address` deseni
   hasta tarafına taşınmaz.
5. **İmza raster PNG olarak saklanır; basınç/hız/dinamik verisi toplanmaz.** Raster görüntü
   Art. 4 Nr. 14 anlamında biyometrik veri değildir (tekil kimliklendirmeye yönelik teknik işleme
   yok); dinamik toplanırsa Art. 9 tartışması açılır — gereksiz risk.
6. **Saklama 10 yıl** (§630f Abs. 3 BGB, Behandlungsdokumentasyonu ile birlikte).
7. **Ayrı tablo zorunlu** — `consent_log` genişletilmez. O tablo başka bir Betroffener'a ait
   (praxis sahibi, B2B); hastayı oraya karıştırmak RLS'i, Löschfristen ayrımını (§630f 10 yıl vs.
   B2B AVV) ve Art. 15 Auskunft kapsamını bozar.
8. **`compliance/VVT.md`'ye yeni işleme faaliyeti + `compliance/TOM.md` güncellemesi zorunlu.**
   DSFA güncellenir, yeniden yapılmaz.
9. **Bugünkü kiosk durumu Art. 32 Abs. 1 TOM yetersizliğidir** (biz SaaS'ta Auftragsverarbeiter
   → Art. 28 Abs. 3 lit. c). **Art. 33 bildirimi gerekmez** — fiilî yetkisiz erişim kanıtı yok,
   sadece risk. Ancak loglama olmadığı için erişim olsa da kanıtlanamaz; asıl sorun budur.
   → P1'in P2'yi beklememesinin gerekçesi.

## Yeniden değerlendirme tetiği (Seçenek C)

Oturumsuz ayrı sayfa + tek kullanımlık token şu üçünden **biri** gerçekleşirse açılır:
1. Bir müşteri tableti hastayla gözetimsiz bıraktığını bildirirse
2. "Tablet terapistin değil, hastanın kendi cihazı" gerçek bir talep olarak gelirse
3. 5. aktif praxis'e ulaşılırsa
