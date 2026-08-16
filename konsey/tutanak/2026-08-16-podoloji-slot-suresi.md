# Konsey Kararı — Podoloji randevu slot süresi
Tarih: 2026-08-16 · Oturan üyeler: gkv-302, podoloji, muhalif, deger-mi, fonksiyon-ustasi, dış göz (Gemini)

## KARAR

**Slot süresi Regelleistungszeit olarak kalır (Seçenek A): 78010 → 35 dk, 78020 → 50 dk.**
Bu konu kapanmıştır; beş üyenin tamamı A'da birleşti ve hiçbiri itiraz etmedi. Seçenek C
(Therapiezeit'i tek sayı yapmak) reddedildi — Anlage 1a Teil 1 Nr. 4 Vor-/Nachbereitung'un
Therapiezeit **içinde** yapılmasını açıkça yasaklıyor, C bu ayrımı takvimden siliyor.
Seçenek B (ayrı buffer alanı) reddedildi — `services.buffer_time` kolonu yok, `booking.js`
olmayan kolonu okuyor, backend `buffer` parametresi hiç beslenmiyor; buffer bloğun içindeyse
zaten A'dır, dışındaysa `no_overlapping_bookings` korumasının dışına düşer.

**Ama sorulan soru yanlış soruymuş.** Konseyin asıl bulgusu: podoloji takviminin kapasite
kaybı slot süresinden değil **slot ızgarasının çözünürlüğünden** geliyor. `step=30` her yerde
sabit ve hiçbir çağıran başka değer göndermiyor; 35 dk'lık randevu 09:00–09:35 olduğunda
09:30 adayı çakışma testinde eleniyor ve sıradaki teklif 10:00 oluyor — **her hastada 25 dk
boşa gidiyor.** Bu turda yapılacak iş budur, süreye dokunmak değil.

**Sıra:** (P1) ızgara adımını hizmet süresinden türet · (P2) ölü `buffer_time` okumasını
temizle · (P3) süre preset'leri — beta cevabına bağlı, koşullu.

**Yapılmayacak:** takvim kartında 20+15 taralı görsel ayrımı (podoloji: gürültü, mevcut
"davon X Min am Patienten" alt metni yeterli) · serbest sayı girişi (destek yükü) ·
kaynak bazlı planlama (backlog).

## Gerekçe

Belirleyici görüş `fonksiyon-ustasi`'nın olgusu oldu: `step=30` ızgarası ve `price_config.durations`
mekanizmasının zaten var olması. Bu iki olgu kör nokta turunda üç üyenin de pozisyonunu
değiştirdi — `muhalif` kendi preset önerisini geri çekti, `deger-mi` "önce sor, sonra yap"
duruşunu bıraktı ("hiç-yapmama seçeneğini bedava sanmıştım"), `podoloji` sabit ızgaranın
yanlış olduğunu ekledi. Chairman `muhalif`'in "preset'ler hiçbir fark üretmez" sonucunu
**düzeltti**: `step=30` altında 25 dk ile 35 dk arasında gerçek fark var (25 dk randevu
09:30 adayını hayatta bırakır), ama kazanç ızgara düzeltilmeden küçük ve koşullu kalıyor —
bu yüzden preset'ler P1'in arkasına alındı, iptal edilmedi.

## Ödün verilenler

- Podolog bu turda hâlâ kendi slot uzunluğunu ayarlayamıyor (`locked: true` kalıyor).
  `podoloji`'nin "ilk gün şikayet konusu olur" uyarısı bilinçli olarak kabul ediliyor —
  şikayet gelirse P3 tetiklenir, elimizde talep kanıtı olur.
- `step=15`'e inince slot listesi iki katına çıkar; `booking.html`'de daha uzun liste.
- 35/50 blok 15'lik ızgarada hâlâ 10 dk artık bırakır (35 dk → sonraki aday 09:45).
  Tam verim ancak süre preset'leriyle (P3) gelir.
- Beta sorusu artık kararı bloklamıyor, sadece P3'ü tetikliyor — cevap gecikirse P3 gecikir.

## Uzlaşma

- Slot = Regelleistungszeit (A): **beş üyenin tamamı**, itirazsız
- `step=30` ızgarası asıl kusur: kör nokta turunda üç üye de bu sonuca vardı
- Serbest sayı girişi istenmiyor; preset/sebep-sorusu tercih ediliyor
- Ölü `buffer_time` yolu temizlenmeli
- Takvim süresi §302 dosyasına girmiyor → doğrudan Absetzung riski yok

## Anlaşmazlık

- **Preset'ler ne zaman:** `deger-mi` "şimdi, 0,5 gün" dedi; `muhalif` "bu turda süreye hiç
  dokunma" dedi. Chairman `muhalif` lehine karar verdi — ızgara düzeltilmeden preset'in
  ölçülebilir kazancı yok, ve iki değişikliği aynı anda yapmak hangisinin işe yaradığını
  ölçülemez kılar.
- **Ayar katmanı:** `podoloji` hasta bazında süre seçimi istiyor (randevu anında radio),
  `muhalif` praxis bazında preset istiyor. Bunlar çelişmiyor — `price_config.durations`
  ikisini de veriyor (praxis preset'i varsayılanı belirler, radio hasta bazında sapmayı).
  P3'te ikisi birlikte açılır.

## Kör noktalar

- **`step=30` her hastada 25 dk yakıyor** — kimse ilk turda görmedi, sorunun kendisi buymuş
  (`server.js:503, 749-760, 775`; çağıranlar `dashboard.js:2428`, `booking.js:328`,
  `from-request.js:27`, `server.js:810, 1521`)
- **`services.buffer_time` kolonu yok ama okunuyor** — `booking.js:219/221/327` daima 0
  alıyor; B seçeneğinin yarısı yazılıp unutulmuş
- **`dashboard.js:10149` ve `10354` süreyi katalogdan yeniden yazıyor** — kilit kalksaydı
  podoloğun ayarı sessizce ezilirdi; P3'ten önce susturulmalı
- **`price_config.durations` çoklu süre mekanizması hazır ve çalışıyor** ama GKV formu
  `price_config: null` ile kapatıyor (`dashboard.js:10570`)
- **Takvim tıklama hedefleri 30 dk sabit** (`dashboard.js:2637-2638`, `2679-2681`, `2820`) —
  `step` düzelse bile manuel randevu oluşturma 30'luk kalır, ayrı iş
- **FAK Nr. 25 (gkv-302):** klein/groß ayrımı sadece Komplexbehandlung'da; salt Nagel-/
  Hornhautbearbeitung her zaman 78010 + 78030 — kodda bu zaten doğru
  (`dashboard.js:23689-23694`), teyit edildi

## Uygulama — builder'a

- [ ] **P1** Slot ızgara adımını hizmetten türet: `getAvailableSlots` `step` varsayılanı 30 →
      15; beş çağıranı da hizala (`dashboard.js:2428`, `booking.js:328`,
      `from-request.js:27`, `server.js:810`, `server.js:1521`). Kabul ölçütü: 35 dk'lık
      78010 randevusundan sonraki ilk teklif 09:45, 10:00 değil. — karmaşıklık: **K2**
- [ ] **P2** Ölü `buffer_time` okumasını `booking.js:219/221/327`'den kaldır (kolon yok,
      daima 0). Kolon **eklenmez** — buffer bloğun içinde yaşar. — karmaşıklık: **K0**
- [ ] **P3 (koşullu)** GKV podoloji kalemlerinde `price_config.durations`'ı aç: preset
      "Solo 35/50" · "mit Assistenz 25/40", varsayılan Solo. Kaynak: onboarding/ayarlarda
      tek soru — *"Wird die Vor-/Nachbereitung von einer Assistenz übernommen?"*
      `dashboard.js:10570` `price_config: null`'ı kaldır, `10149`/`10354` üzerine-yazmasını
      sustur. **Tetik: beta cevabı** (aşağı bak). — karmaşıklık: **K2**
- [ ] **Kural (kalıcı):** slot uzunluğu 78010 ↔ 78020 seçimini **asla** belirlemez.
      Bugün zaten sağlanıyor (`therapiezeit` yalnız etiket, seçim elle checkbox
      `dashboard.js:24628`) — kod yorumu olarak sabitle. `gkv-302` şartı. — karmaşıklık: **K0**

## Beta sorusu (kurucunun işi, kod değil)

`podoloji`'nin düzelttiği hâliyle sorulur — podolog "boşluk" değil "randevuya yazdığı süre"
üzerinden düşünür:

1. *"Takviminde bir 78010 hastası için kaç dakika ayırıyorsun — ve bu süre temizlik/
   belgelemeyi kapsıyor mu?"*
2. *"Hangi hasta tipinde bu süre yetmiyor?"*
3. *"Vor-/Nachbereitung'u sen mi yapıyorsun, asistan mı?"* (praxis genelinde sabit cevap —
   kadro sorusu, hasta bazında değişmez)

## Backlog (karara dahil DEĞİL)

- **Kaynak bazlı planlama** (dış göz, Seçenek D): terapist 20 dk + oda 35 dk ayrı bloke.
  Doğru mimari, ama tek-aralık şemasını değiştirir. Tetik: 2+ odalı / asistanlı bir
  Enterprise praxis müşterisi.
- Takvim tıklama hedeflerinin 30 dk sabitliği (`dashboard.js:2637-2638`, `2679-2681`, `2820`)
- `dashboard.js:10149`/`10354` üzerine-yazma davranışı GKV kalemlerinin tamamını etkiliyor,
  yalnız podolojiyi değil

## Sert veto

Yok. `gkv-302` 🔧 koşullu onay verdi; tek şartı (slot ↔ pozisyon seçimi bağımsızlığı)
bugün zaten sağlanıyor ve yukarıda kalıcı kural olarak sabitlendi. `legal-de` oturmadı —
hasta verisi bizim tarafımızdan geçmiyor, şema değişmiyor, kamuya giden metin yok.

## Yeniden değerlendirme tetiği

**P3 (süre preset'leri)** şu ikisinden biri gerçekleşirse açılır:
(a) beta podologlarından en az biri "35/50 bana uymuyor / kendim ayarlamak istiyorum" derse,
(b) 3. aktif podoloji müşterisine ulaşılırsa.
**P1 ve P2 bu tetiğe bağlı değildir — koşulsuz ve önce yapılır.**

**Kaynak bazlı planlama (D)** ancak 2+ tedavi odası olan bir praxis müşteriye dönüşürse açılır.
