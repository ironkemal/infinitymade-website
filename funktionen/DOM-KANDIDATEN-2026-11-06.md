# Çift render adayları: ayıklama, 06.11.2026

> Kaynak: `funktionen/INDEX.json` → `domKandidaten` (38 aday, harita 06.11.2026).
> Yöntem: önce her yol için mekanik bir ön sınıflama yapıldı. Soru şuydu: HTML basma işlemi
> gerçekten bu id'nin öğesine mi gidiyor (doğrudan ya da `const x = getElementById(id)`
> değişkeni üzerinden), yoksa gövdede başka bir öğeye mi? Sonra render eden yolların
> gövdeleri okundu. Canlıda henüz doğrulanmadı (Faz 3 yapılmadı).
>
> Sınıflar: **A** gerçek kopya · **B** bilinçli katmanlama, ayrı mod ya da sıfırlama ·
> **C** yanlış alarm (id yalnız okunuyor ya da değeri set ediliyor, HTML başka öğeye basılıyor).

**Sonuç:** A = 3 (iki küme) · B = 4 · C = 31. Toplam 38.

| # | Aday | Sınıf | Gerekçe | dosya:satır |
|---|---|---|---|---|
| 1 | `#gapsList` | **A** | `renderGaps` (bugün+yarın) ile `renderGapsForDate` aynı mantığın kopyala-yapıştırı. İkisi de init'te art arda çağrılıyor, ikincisi birincinin çıktısını hemen eziyor | dashboard.js:1149, :1229, init :14256-14257 |
| 2 | `#gapsTotal` | **A** | 1 ile aynı küme: aynı toplam süreyi iki kopya ayrı ayrı yazıyor | dashboard.js:1202, :1265 |
| 3 | `#zaaResult` | **A** | Aynı modalda ZAA hata tablosunun iki bağımsız çizimi var, kolonları farklı. Yükleme sonrası Code/Beleg/Fehler/Lösung, "Beheben" bağlantısı yok. Kayıtlı hatalarda Code/Status/Fehler/Lösung/Aktion, "Beheben" var. `openZaaModal` yalnız temizliyor | module/podologie-abrechnung.js:1426 · dashboard.js:14866, :14896 |
| 4 | `#bkGroupParticipantsList` | B | DB'deki kayıtlı grup (iptal, Nachrücker) ile yeni grupta yerel seçim iki ayrı mod. Yalnız `<li>` şablonu tekrar ediyor | dashboard.js:3812, :3891 |
| 5 | `#invLineBody` | B | `resetInvEditor` yalnız boşaltıyor, çizim `renderInvLines`'ta | dashboard.js:12727, :12807 |
| 6 | `#messChartArea` | B | Hasta kartı açılırken sıfırlanıyor, çizim `refreshMessreihen`'de | dashboard.js:6928, :7360 |
| 7 | `#zygoteWrap` | B | `loadBeispielmodus_SVG` hiç çağrılmıyor. Bu, bilinçli saklanan SVG vücut haritası (canlandırılmayacak). Router yalnız `loadBeispielmodus`'u çağırıyor | dashboard.js:11770, :11951, router :818 |
| 8 | `#invPatientSelect` | C | Doldurmayı yalnız `loadInvPatients` yapıyor, diğer üçü `.value` ya da `onchange` set ediyor | dashboard.js:12717 |
| 9 | `#bk-id` | C | Üç yol da yalnız `.value` okuyor | dashboard.js:3980 · module/raum-auswahl.js:253 · module/termin-verordnung.js:261 |
| 10 | `#bkService` | C | `zeichneZeilen` id'nin `innerHTML`'ini **okuyup** klonluyor (`sel.innerHTML = quelle.innerHTML`), yazan yalnız `populateSrvSelect` | dashboard.js:4461 · module/termin-leistungen.js:538 |
| 11 | `#scheduleDateLabel` | C | Gün, hafta ve ay görünümü yalnız `textContent` yazıyor, HTML başka öğeye | dashboard.js:1310, :12376, :12459 |
| 12 | `#zaaErr` | C | yalnız `textContent` | dashboard.js:14823, :14835, :14891 |
| 13 | `#zaaFileInput` | C | `.value` ya da `.files` | dashboard.js:14822, :14837, :14890 |
| 14 | `#zaaRunBtn` | C | metin ve `onclick` | dashboard.js:14825, :14834, :14930 |
| 15 | `#zaaTitle` | C | `textContent`, moda göre başlık | dashboard.js:14829, :14889 |
| 16 | `#bkEmployee` | C | `renderDayView` okuyor, `populateEmpSelects` başka select'e basıyor | dashboard.js:2035, :4422 |
| 17 | `#bkGroupCount` | C | `textContent`. Yapı 4'teki çift modun parçası | dashboard.js:3814, :3893 |
| 18 | `#bkGroupMaxDisplay` | C | aynı | dashboard.js:3815, :3894 |
| 19 | `#bkLeistungExtra` | C | Çizim yalnız `zeichneZeilen`'de, `mountTerminmaske` öğeyi yalnız alıyor | module/termin-leistungen.js:529 · module/raum-auswahl.js:332 |
| 20 | `#bkStart` | C | iki yol da `.value` okuyor | module/raum-auswahl.js:243 · module/termin-verordnung.js:205 |
| 21 | `#blFilterFrom` | C | DATEV ile Zahlungsjournal aynı filtreyi okuyor, bu kasıtlı | module/datev-einstellungen.js:115 · module/zahlungsjournal-laden.js:15 |
| 22 | `#blFilterTo` | C | aynı | module/datev-einstellungen.js:116 · module/zahlungsjournal-laden.js:16 |
| 23 | `#btnFormSpeichern` | C | `speichern`, `renderFormular`'ın **içine gömülü**; harita aynı satırı iki kez sayıyor | module/physio-befund.js:906-1001 ⊂ 669-1005 |
| 24 | `#btnFormSpeichernUnten` | C | aynı gömülü fonksiyon | module/physio-befund.js:926 |
| 25 | `#pdBefundFehlerBox` | C | aynı gömülü fonksiyon | module/physio-befund.js:907 |
| 26 | `#pdBefundFehlerListe` | C | aynı gömülü fonksiyon: tek render, iki kez sayılmış | module/physio-befund.js:910 |
| 27 | `#dayViewDateLabel` | C | Normal gün görünümü ile oda modu etiket yazıyor, HTML başka öğeye | dashboard.js:1961 · module/raum-tagesansicht.js:352 |
| 28 | `#fbFahrtenFrom` | C | Panel açılışı varsayılan değeri set ediyor, `loadFbFahrten` okuyor | dashboard.js:15169, :15210 |
| 29 | `#fbFahrtenTo` | C | aynı | dashboard.js:15170, :15211 |
| 30 | `#fbFahrtenUser` | C | Doldurmayı yalnız panel açılışı yapıyor, `loadFbFahrten` okuyor | dashboard.js:15192, :15212 |
| 31 | `#fbReportMonth` | C | set/okuma | dashboard.js:15171, :15512 |
| 32 | `#hoursGrid` | C | **Farklı HTML belgeleri**: `dashboard.html:674` ile `onboarding.html:296`, aynı id iki ayrı sayfada. Veri biçimleri de farklı (`working_hours` tablosu / `profile.working_hours` JSON) | dashboard.js:8757 · onboarding.js:791 |
| 33 | `#invDmrzBtn` | C | sıfırlama + olay bağlama | dashboard.js:12813, :12951 |
| 34 | `#invEigenPct` | C | `.value` + `oninput` | dashboard.js:12809, :13076 |
| 35 | `#invKasse` | C | aynı | dashboard.js:12810, :13077 |
| 36 | `#invPrintBtn` | C | `disabled` + `onclick` | dashboard.js:12812, :12942 |
| 37 | `#invSaveBtn` | C | metin + `onclick` | dashboard.js:12815, :12941 |
| 38 | `#messLoading` | C | `hidden` | dashboard.js:6929, :7361 |

## A sınıfı: risk sırasıyla karar soruları

Hiçbiri tabloya yazmıyor, yani veri bozma riski yok. Risk, bakım riski: birinde
düzeltilen hata öbüründe kalır.

**1. Freie Zeiten (`#gapsList` / `#gapsTotal`)**: `renderGaps` ile `renderGapsForDate`
- Ne oluyor: Dashboard açılışında önce "bugün+yarın" listesi çiziliyor (working_hours +
  bookings, 2 sorgu), hemen ardından seçili günün listesi onu eziyor. Birinci çıktı hiç
  görünmüyor, sorgular boşa gidiyor. `renderGaps`'in tek çağrıldığı yer init.
- Ekran (doğrulanmadı): Übersicht → "Freie Zeiten" kutusu.
- **Soru:** `renderGaps` kaldırılsın ve init yalnız `renderGapsForDate`'i çağırsın mı?
  [birleştir] / [bırak] / [ertele]. Görünüş değişmez, zaten ikincisi görünüyor.

**2. ZAA-Fehler tablosu (`#zaaResult`)**: yükleme sonrası `renderZaaUploadResult` ile
"Fehler ansehen" yolundaki `showZaaErrors` satır içi tablosu
- Ne oluyor: Aynı modal aynı kavramı (ZAA-Absetzungen) iki ayrı şablonla gösteriyor.
  Yükleme sonrasında "Beheben" bağlantısı ve Status kolonu yok, sonradan açınca var,
  ama Beleg kolonu yok. Veri kaynakları farklı (yükleme yanıtı / `zaa_fehler` tablosu).
- Ekran (doğrulanmadı): Abrechnung → bir abrechnung satırı → "ZAA hochladen" ya da "Fehler".
- Domain: hangi kolonların gerektiği `gkv-302` ajanının yargısı, burada verilmedi.
- **Soru:** Yükleme sonrası da `showZaaErrors` tablosuna (Beheben bağlantısıyla) inilsin mi?
  [birleştir] / [bırak] / [ertele].

## Harita için daraltma önerileri (`tools/funktionskarte.mjs`, satır 236-244)

C'lerin hepsi aşağıdaki beş kalıptan çıkıyor:

1. **`domRender`'ı hedefe bağla.** Bugün "gövdede herhangi bir innerHTML var mı" bakılıyor.
   Bunun yerine bir `renderIds[]` alanı üret. Bu alana bir id ancak doğrudan
   `getElementById('x').innerHTML =` biçiminde ya da `const v = getElementById('x')` ardından
   `v.innerHTML =` / `v.insertAdjacentHTML(` / `v.replaceChildren(` biçiminde yazılıyorsa girsin.
   `domKandidaten` yalnız `renderIds` üzerinden kurulsun. Ön sınıflamada bu tek adım
   85 yolun 63'ünü eledi.
2. **Yalnız sol taraf sayılsın.** `/\b([\w$]+)\.innerHTML\s*=(?!=)/` ile değişkeni yakala.
   `sel.innerHTML = quelle.innerHTML`'deki sağ taraf okuması render değildir (#10).
3. **Gömülü fonksiyonları çıkar.** Bir fonksiyonun aralığı başkasının içindeyse
   (`speichern` 906-1001 ⊂ `renderFormular` 669-1005), dıştakinin gövdesinden içteki
   aralık düşülsün ya da biri öbürünü kapsayan çiftler aday sayılmasın (#23-26).
4. **Belgeye göre grupla.** `onboarding.js` ile `dashboard.js` farklı HTML'e bağlı. Aday
   kümesi yalnız aynı giriş sayfasının yüklediği dosyalar arasında kurulsun (#32).
5. **`innerHTML = ''`'yi ayrı işaretle.** Tek başına boşaltma, sıfırlamadır (B).
   `renderIds` yerine `clearIds` alanına yazılsın (#5, #6).
