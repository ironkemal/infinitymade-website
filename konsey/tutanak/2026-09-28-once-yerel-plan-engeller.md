# Konsey Kararı — "Önce yerel, kimlik asla gitmez" planında engel var mı?
Tarih: 2026-09-28 · Oturan üyeler: legal-de, guvenlik, onprem, gkv-302, podoloji, muhalif, deger-mi, fonksiyon-ustasi
Durum: **YALNIZ KAYIT, UYGULANMIYOR.** Kemal önce birkaç test daha yapacak.

## KARAR
Plan onaylandı, ama aşağıdaki şartlarla birlikte. Barkod yolunu hiçbir üye veto etmedi.

**1. Barkod okuma: ilk ve en değerli parça (3–5 gün).** Şartlar:
- **Barkod bir öneridir, kâğıdın yerine geçmez** (gkv-302, muhalif). Podologie Anlage 3 §4(4)'e göre düzeltmeler kâğıtta, imza ve tarihle yapılır; fatura basılı ve imzalı kâğıda dayanır. Bu yüzden kaydetmeden önce onay ekranı zorunlu:
  - Faturaya etki eden 5 alan büyük gösterilir: Diagnosegruppe, ICD, Heilmittel/Anzahl, Ausstellungsdatum, Hausbesuch.
  - Altında "Papier handschriftlich geändert?" kutusu olur. İşaretlenirse alanlar elle düzenlenebilir.
  - Kayda kaynak işareti yazılır: `quelle = barcode` ya da `barcode+korrigiert`.
  - Bu adım atlanamaz.
- **Üç giriş yolu, tek çözümleyici** (podoloji, guvenlik):
  - (a) Görsel ya da PDF yükleme. Masaüstünde birincil yol bu.
  - (b) Telefon kamerası, yalnız `getUserMedia` ile. Barkod modunda `openNativeCameraInput` yedeği kapalı kalır, çünkü bazı telefonlar bu yoldan çekilen fotoğrafı galeriye kaydediyor.
  - (c) USB el tarayıcısı, sonra.
- **Çözümleyici kuralları** (muhalif, guvenlik):
  - Alan 01 = `13` olmalı ve 03 sürüm alanı kontrol edilmeli. Bilinmeyen sürümde tahmin yapılmaz, elle girişe düşülür.
  - 33 alanın her biri için izinli karakter listesi ve uzunluk sınırı olur.
  - Değerler ekrana yalnız `textContent` ya da `.value` ile yazılır.
  - EDIFACT'a akan alanlarda `' + : ?` karakterlerinin kaçışlandığı doğrulanır (segment injection).
- **Heilmittel metni** (en fazla 51 karakter) katalogdaki Heilmittel adına deterministik olarak eşlenir, HPNR tarif tablosundan gelir. Eşleşme yoksa alan boş kalır, tahmin yapılmaz (gkv-302). Podoloji için bu eşlemeyi yapan bir fonksiyon yok, yazılması gerekiyor (fonksiyon-ustasi).
- **Bağlantı noktası:** barkod sonucu `parsed` biçimine çevrilir ve `uebernehmeRezeptInMaske` fonksiyonuna verilir (`module/rezept-in-maske.js:85`). İkinci bir form doldurucu yazılmaz. Barkod yolunda `storage_path` null olur, `setzeScanHerkunft` buna göre uyarlanır.
- **Kütüphane** (onprem):
  - Ya saf JS olan `@zxing/library` kullanılır, ya da `'wasm-unsafe-eval'` iki CSP'ye birden aynı commit'te eklenir (`onprem/Caddyfile:49`, `vercel.json:19`).
  - Apache-2.0 lisansı `onprem/NOTICE.md`'ye yazılır. Dosyanın sha256'sı kontrol edilir, airgap testi yapılır.
- **Kutuda telefonla okuma:** Telefonun kamerayı açabilmesi için Caddy'nin iç kök sertifikasına güvenmesi gerekiyor. Kurulum sihirbazına telefon adımı eklenir (Faz 2.2). Telefon sertifikaya güvenmiyorsa yedek yol görsel yükleme ya da PC'nin web kamerası.
- **Ölçüm** (muhalif, deger-mi): Barkodlu ve el yazısı reçete oranı varsayılmaz, ölçülür.
  - Önce Beta-1'den 20–30 reçete: barkod var mı, kaç denemede okundu, hangi sürüm.
  - Canlıda yalnız PHI içermeyen sayaçlar tutulur: `barcode_ok`, `fallback_manuell`.
- **Beta-1'e açık bilgi** (deger-mi): Barkod kart okuyucunun yerini tam tutmaz. eGK güncel sigorta durumunu okur (Kassenwechsel dahil), barkod ise reçetenin yazıldığı andaki durumu taşır. Ops #214 sözü kapanmış sayılmaz.

**2. Yapay zeka fonksiyonlarında veri minimizasyonu (SaaS'ta da hemen geçerli).**
- **`series-scheduler.js`** (guvenlik S-34, ORTA): Bugün hasta adı (`:96`), `prefs.notes` (`:75`) ve `userFeedback` (`:76`) maskesiz gidiyor. Karar:
  - Hasta adı gönderilmez.
  - Serbest metin hiç gönderilmez. Gerekirse yalnız yapılandırılmış seçenekler gider.
  - Çalışan ve servis ID ya da etiketle gider (S1, M1).
  - Ayrıca podoloji randevularının yanlışlıkla "Friseur/Beauty" kurallarına düşmesi düzeltilir: sabit podolog, 4–6 hafta aralık (podoloji).
- **Mail taslakları:** Takma ad var, ama "hizmet + tarih" hâlâ sağlık verisi. Hizmet de yer tutucu olur (`{{leistung}}`), metin kutuda doldurulur (legal-de).
- **`pii-mask.js` yalnız ikinci savunma katmanıdır** (guvenlik). Otomatik olarak yalnız KVNR ve IBAN tanıyor. Başlığındaki "LANR/BSNR" iddiası kodda karşılıksız, düzeltilecek. Asıl güvence veriyi hiç göndermemek.
- DSFA ve TOM "maskeleniyor" diyorsa gerçeğe göre düzeltilir (legal-de).

**3. Barkodsuz reçetede AI (3. yol).**
- SaaS'ta mümkün.
- On-prem kutuda tek Praxura anahtarıyla **VETO** (onprem G2/K5). Kutuda bu yol ya kapalı kalır ya da praxis'in kendi anahtarıyla (BYO-key) açılır. B'nin konuşulması için Kemal'in K5'i açıkça yeniden açması gerekir.
- Açılma tetikleyicisi: ölçülen barkodsuz oranı ≥%15 (deger-mi). Oran bunun altındaysa elle giriş yeterli.
- **Avukat sorusu genişletildi** (legal-de): "Takma adlı, ama praxis tarafından yeniden tanımlanabilir veri üretici aboneliğiyle gönderiliyor. §203 Offenbaren ve §393 AV rolü doğar mı?" Dört AI fonksiyonu örnek olarak verilir. Toplam ~€450–750.

**4. Önceki kararın 4 kod işi:**
- KVNR Prüfziffer **zaten var** (`module/kvnr.js`, `billing/dta/preflight.js`). 09-12'deki "hiç hesaplanmıyor" bulgusu eskidi. Barkod verisi de bu kontrolden geçer.
- Confidence kapısı barkodsuz yol için hâlâ gerekli.
- `llmClient` ve azureClient throw, 3. yol açılana kadar ertelenebilir (gkv-302).

## Gerekçe
Barkod yolu PHI'yi kutudan çıkarmıyor. Bu yüzden hukuk, güvenlik ve on-prem tarafında engel çıkmadı. En büyük gerçek risk faturalama tarafında: elle düzeltilmiş reçetede barkod eski değeri taşıyor. Onay ekranı bunu kapatıyor. AI fonksiyonlarında en önemli bulgu series-scheduler'ın bugün SaaS'ta açık kimlik göndermesi.

## Ödün verilenler
- Her okumadan sonra bir onay adımı (~5 sn).
- Barkod kart okuyucunun yerini tutmuyor.
- Kutuda barkodsuz reçete için AI, BYO-key olmadan yok.

## Anlaşmazlık
Yok. onprem'in 3. yoldaki vetosu 2026-09-28 B kararıyla (K5) tutarlı.

## Backlog (karara dahil DEĞİL)
- Therapieziele için Diagnosegruppe'ye göre hazır metinler, üç dilde (podoloji).
- USB el tarayıcısı ve TAB karakterini yakalayan alan.
- BFB Handbuch V4.80'in wissensbank'a kaydı (INDEX'te yok).

## Uygulama — builder'a (Kemal "başla" deyince)
- [ ] series-scheduler minimizasyonu + podoloji kuralı (SaaS'taki açık, önce bu) — K2
- [ ] `module/rezept-barcode.js`: çözümleyici + testler (sürüm, karakter listesi, Prüfziffer) — K2
- [ ] Podoloji Heilmittel metni → katalog eşlemesi (deterministik) — K2
- [ ] Onay ekranı ("Papier geändert?", kaynak işareti) + `uebernehmeRezeptInMaske` bağlantısı — K2
- [ ] zxing vendor (saf JS ya da CSP), görsel yükleme + getUserMedia; native yedek barkod modunda kapalı — K2
- [ ] Barkod alanları için EDIFACT kaçış kontrolü — K1
- [ ] Mail taslaklarında `{{leistung}}`; pii-mask başlığının düzeltilmesi — K1
- [ ] Kurulum sihirbazına telefon sertifika adımı (Faz 2.2) — K1
