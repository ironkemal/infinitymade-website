# Konsey Kararı — Betriebshandbuch: iç runbook mu, müşteri sürümü mü
Tarih: 2026-10-10 · Oturan üyeler: muhalif, deger-mi, mentor, fonksiyon-ustasi (olgu) · ön raporlar: legal-de, guvenlik, onprem, podoloji

SORU: Depo dışında hazırlanan "Praxura-Betriebshandbuch" (tek dosya HTML; Windows-PC/WSL2 · kiralık
sunucu · yerel sunucu; 12 bölüm, ~119 adım) hangi sürümlere ayrılsın? A) herkes için tek sürüm ·
B) tek kaynak, iki build (iç + müşteri) · C) şimdilik yalnız iç runbook.
ON-PREM ETKİSİ: hayır (belge; hasta verisi akmıyor).

## KARAR
**C.** Yalnız iç runbook üretilir ve belgenin başında "Internes Runbook, nicht an Praxen
weitergeben" olarak damgalanır. İkinci build hattı şimdi kurulmaz. Her adım kaynakta pozitif bir
`kunde` alanı taşır, varsayılanı `false`; ayrıca `role` (praxis/technik/beide) alanı doldurulur.
Müşteri sürümü ilk imzalı Abnahmeprotokoll'dan sonra beyaz listeden üretilir.

**Müşteri sürümüne giriş ölçütü:** adım ancak (1) o dağıtım yolunda en az bir gerçek kurulumda
uçtan uca kabul edilip tarihiyle kaydedilmişse ve (2) dayandığı adımlar da aynı şartı sağlıyorsa
girer. İşaretsiz adım dışarıda kalır.

## Gerekçe
legal-de: durum etiketleri ve "kein Freigabesiegel" cümlesi korumaz; verilen kılavuz edimin
parçasıdır, "ungeklärt" çekirdek adım bilinen kusuru belgeler. muhalif: B'nin süzgeci negatif
("ungeklärt olmayan girer") — kabul edilmemiş iki grubu ve etiketi unutulmuş her yeni adımı yayına
sokar. deger-mi: C'den B'ye geçiş ucuz, müşteriye verilmiş belgeyi geri almak pahalı.

## Ödün verilenler
İlk pilotta müşteriye verilecek hazır bir kılavuz yok. Karşılığı: Notfallkarte ve
Abnahmeprotokoll çıktıları runbook'tan basılabiliyor.

## Uzlaşma
Üç üye de C. Üçü de aynı darboğazı gösterdi: belge değil, hiçbir yolun gerçek makinede kabul
edilmemiş olması.

## Anlaşmazlık
deger-mi adım düzeyinde aramayı ve Praxis/Technik görünümünü "değmez" buldu; ikisi de yeniden
tasarımda zaten yazılmıştı, bırakıldı (ek bakım maliyeti yok, `role` alanını kullanıyor).

## Kör noktalar
- fonksiyon-ustasi: `onprem/KURULUM.md` (834 satır, müşteriye dönük) aynı üç yolu zaten kapsıyor —
  iki belge sürüklenir. Hangisinin kaynak olduğu kararlaştırılmadı.
- fonksiyon-ustasi: "Diagnosepaket" kodda yok (yalnız tasarım, `onprem/RELEASE-STANDARD.md`).
  K10'a göre destek yolu buna dayanıyor; runbook bunu "noch nicht im Paket" diye işaretliyor.
- mentor: üç yolu eşit derinlikte belgelemek kapsam şişmesi; bir yol birincil seçilmeli.

## Uygulama
- [x] Runbook "intern" damgalı, `kunde:false` + `role` alanları kaynakta — yapıldı (10.10.2026)
- [x] Bölüm 09 K10'a çekildi: SSH/VPN yalnız praxis'in kendi IT'si; Praxura = Diagnosepaket veya
      eşlik edilen ekran oturumu, öncesinde AVV + §203 yükümlülüğü — yapıldı
- [ ] Bir yolu gerçek makinede baştan sona kur, açık adımları orada kapat

## Backlog (karara dahil DEĞİL)
- `onprem/KURULUM.md` ile runbook arasında tek kaynak kararı
- Diagnosepaket (Faz 2.5)
- Ayrı bir zafiyet bildirim adresi (bugün yalnız destek adresi var)
- Birincil dağıtım yolunun seçimi (mentor: beta müşterisine tek soru)

## Sert veto
legal-de ⛔ (ön rapor): kiralık sunucuda sözleşme + AVV praxis'in kendi adına; her uzaktan
erişimden önce AVV Art. 28 + §203 yükümlülüğü. İkisi de runbook metnine işlendi.
