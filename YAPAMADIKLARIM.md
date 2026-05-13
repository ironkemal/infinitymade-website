# Yapamadiklarim / Manuel Cozum Gereken Konular

## 1. Booking Modal — Yeni Lead Kaydettikten Son Hasta Secimi

**Tarih:** 2026-05-13

**Problem:** Fizyoterapi sektorunde booking modal'da hasta (lead) arayip bulamayinca "+ Neuer Lead" butonuna basiliyor. Lead kaydedildikten sonra sayfa yenilenmeden o yeni hasta booking modal'da secili olarak gelmiyor. Sadece isim input'a kopyalaniyor ama gercek bir "secim" (autocomplete dropdown'dan secilmis gibi) olmuyor. Sayfa yenilenmedikce yeni hasta dropdown listesinde gorunmuyor.

**Denenen cozum:**
- `initBkCustomerAutocomplete()` icerisindeki `loadLeads()` fonksiyonu ile Supabase'den taze lead listesi cekiliyor.
- `+ Neuer Lead` butonuna basinca booking modal state'i (`bkStart`, `bkEnd`, `bkEmployee`, `bkService`, `bkNotes`, `bkHausbesuch`, `bkSeriesToggle`) `window._bkModalState`'e kaydediliyor.
- Lead kaydedildikten sonra (`leadSaveBtn` listener'inda) eger `window._returnToBkModal === true` ise booking modal geri aciliyor.
- `savedLead` objesi ile `bkCustomer` input'una `displayName(savedLead)` yazilip `bkCustomerId`'ye `savedLead.id` ataniyor.
- Telefon numarasi otomatik `bkPhone`'a dolduruluyor.

**Neden calismiyor:**
- `initBkCustomerAutocomplete()` her cagrildiginda yeni bir closure icerisinde `allLeads` array'i olusturuluyor. `loadLeads()` async calistigi icin, yeni lead henuz array'e yuklenmemis olabiliyor.
- `openBookingModal()` veya `prefillBookingModal()` icinde `initBkCustomerAutocomplete()` cagrildiginda, `allLeads` array'i hemen bos oluyor ve yeni lead kaydedilmis olsa bile dropdown listesinde gorunmuyor.
- Event listener'lar (`dataset.bkAutoBound`) bir kere baglandigi icin, `initBkCustomerAutocomplete()` tekrar cagrilsa bile `loadLeads()` yeniden calismiyor.
- Telefon input'u (`bkPhoneGroup`) fizyoterapi icin gizleniyor ama bu sadece UI katmaninda; backend'e kaydederken hala telefon alani bos kalabiliyor.

**Beklenen davranis:**
1. Kullanici booking modal'da hasta aratir.
2. Hasta bulunamaz, "+ Neuer Lead" tiklar.
3. Lead modal acilir, hasta bilgileri girilir, kaydedilir.
4. Lead modal kapanir.
5. Booking modal OTOMATIK olarak geri acilir.
6. Yeni kaydedilen hasta:
   - `bkCustomer` input'unda isim olarak gorunur.
   - `bkCustomerId` hidden input'unda ID olarak atanmis olur (gercek secim).
   - Dropdown listesinde aratildiginda anunda gorunur (sayfa yenilenmeden).
   - Telefon numarasi `bkPhone`'a otomatik doldurulur.

**Gereken gercek cozum:**
- `initBkCustomerAutocomplete()` icerisindeki `allLeads` array'ini closure'dan cikarip global scope'a veya module-level'e tasimak, ya da en azindan `loadLeads()`'i her modal acilisinda zorunlu kilmak.
- `initBkCustomerAutocomplete()`'nin `loadLeads()` fonksiyonunu public (return veya global export) yapmak, lead kaydedildikten sonra manuel olarak cagirabilmek icin.
- Veya `loadLeads()`'i global scope'da tanimlayip, hem booking modal hem lead kaydetme tarafindan ayni array'i paylasmak.
- Bir diger yol: Lead kaydedildikten sonra, booking modal geri acilmadan once, `allLeads`'in gercekten yuklenmis oldugundan emin olmak icin `await` ile beklemek ve `selectLead()` fonksiyonunu dogrudan cagirmak.
- `bkCustomer` ve `bkCustomerId` degerlerini dogrudan DOM'a yazmak yerine, `selectLead(savedLead.id)` fonksiyonunu cagirmak — ama bunun icin `allLeads` array'i o ID'yi icermeli.
- En temiz cozum: `window.allLeadsBk` gibi bir global array olusturmak, `loadLeads()` bunu doldursun, `initBkCustomerAutocomplete()` ve `selectLead()` bu global array'i kullansin. Lead kaydedildikten sonra bu array'e yeni lead'i push edip `selectLead(newId)` cagirmak.

**Dosyalar:** `dashboard.js`, `dashboard.html`

---

## 2. Physio Dienstleistungen — 5-Min Einheitspreis Fiyat Hesaplama

**Tarih:** 2026-05-13

**Problem:** Fizyoterapi sektorunde `Dienstleistungen` panelinde her sure karti (10dk, 15dk, 20dk...) icin fiyat elle giriliyor. `5-Min Einheitspreis` alanina birim fiyat yazilinca otomatik hesaplama calismiyor. Enter'a basinca veya `input` event'i ile `renderPhysioServiceCards()` yeniden cagrildiginda onceki elle yazilmis fiyatlar kayboluyor.

**Denenen cozum:**
- `calculatePhysioPrices()` fonksiyonu eklendi, sadece bos olan `dur-price` input'larini dolduruyor.
- HTML'e `Übernehmen` butonu (`srvCalcPriceBtn`) eklendi.
- Enter key ve buton click event listener'lari eklendi.
- `srvUnitPrice`'daki `input` event listener kaldirildi.

**Neden calismiyor:**
- Kullanici "hic biri olmamis" diyor. Muhtemel sebepler:
  - Tarayici cache (`dashboard.js` eski versiyon yukleniyor).
  - Veya `dashboard.js` syntax hatasi var (ama `node --check` geciyor).
  - Veya `getSector() !== 'physiotherapy'` kontrolu `false` donuyor (sector degeri farkli olabilir).
  - Veya `srvPhysioFields` hala `hidden`, yani fizyoterapi sektoru tanimli degil veya yanlis tanimli.
  - Kullanici `dashboard.js`'i kendi edit'leriyle birlikte kullaniyor ve conflict olmus olabilir.

**Beklenen davranis:**
1. 5-Min Einheitspreis'e ornegin `12` yazilir.
2. Enter veya `Übernehmen` butonuna basilir.
3. Bos olan tum sure kartlarinin fiyatlari otomatik hesaplanir (12 x dk/5).
4. Daha sonra elle yazilan fiyatlar korunur, sadece bos olanlar hesaplanir.

**Gereken gercek cozum:**
- Cache temizleyip (Ctrl+F5) tekrar test etmek.
- `getSector()` fonksiyonunun gercekten `'physiotherapy'` dondugunu console.log ile kontrol etmek.
- Buton ve Enter event'lerinin dogru elementlere baglandigini `console.log` ile dogrulamak.
- Eger hala calismazsa, `calculatePhysioPrices()` fonksiyonunu `window` objesine export edip console'dan manuel cagirmak (`window.calculatePhysioPrices()`) — bu sayede fonksiyonun calisip calismadigi anlasilir.

**Dosyalar:** `dashboard.js`, `dashboard.html`

---

## 3. Booking Modal — Otomatik End Time (bkEnd Kaldirma)

**Tarih:** 2026-05-13

**Problem:** Booking modal'da `Bis` (end time) input'u manuel giriliyor. Kullanici bu input'u kaldirmak ve otomatik olarak `start_time + service_duration` ile hesaplamak istiyor.

**Yapilan:**
- `dashboard.html`'den `bkEnd` input kaldirildi.
- `dashboard.js`'te `document.getElementById('bkEnd')` referanslari kaldirildi (`openBookingModal`, `prefillBookingModal`).
- `saveBooking()` icinde `endIso`'nun `startIso + duration` ile hesaplandigi kod kullanici tarafindan eklendi (bkEnd olmadigi icin).

**Kalan riskler:**
- `dashboard.js`'te hala baska yerlerde `document.getElementById('bkEnd')` referansi olabilir. Her yer temizlenmemis olabilir.
- `saveBooking()` icinde `const endV = document.getElementById('bkEnd').value;` satiri var — bu element artik HTML'de olmadigi icin `endV` her zaman bos string olur. Bu durum `endIso` hesaplamasini tetikliyor, yani aslinda calisiyor olabilir.
- Ancak `endV` alani baska yerlerde kullaniliyorsa (ornegin `bkMoveBtn`, drag-drop islemleri, vb.) orada hata verebilir.
- `window._bkModalState`'e `end: document.getElementById('bkEnd').value` ataniyor — bu da bos string olur.

**Beklenen davranis:**
- Kullanici sadece `Von` (start time) secer.
- `Bis` otomatik olarak secilen servis suresine gore hesaplanir.
- Manuel duzeltme yapilmasi gerekiyorsa (ornegin ozel sure), bunun icin ayri bir yol olmali.

**Gereken gercek cozum:**
- Tum `dashboard.js`'te `bkEnd` referanslarini bulup temizlemek.
- `openBookingModal()`'da `end_time` parametresi hala varsa nasil handle edildigini kontrol etmek.
- `saveBooking()`'te `endIso` hesaplamasini dogrulamak.
- Drag-drop ve move islemlerinde end time hesaplamasinin calistigindan emin olmak.

**Dosyalar:** `dashboard.js`, `dashboard.html`

---

## 4. Anamnese PDF Yazdirma

**Tarih:** 2026-05-13

**Problem:** "Anamnese als PDF" butonuna basinca sayfa yazdirma penceresi aciliyor ama yanlis icerik cikiyor — hem rechnungen paneli hem anamnese formu karisik sekilde, hasta secili degilmis gibi gorunuyor.

**Denenen cozum:**
- `printAnamnese()` fonksiyonu eklendi. Yeni sekme acip temiz bir tablo halinde anamnese verilerini gosteriyor.
- `pdfBtn.onclick` referansi `printAnamnese`'ye degistirildi.

**Neden calismiyor:**
- Kullanici hala eski bozuk goruntuyu aliyor.
- Muhtemel sebep: Tarayici cache (`dashboard.js` eski versiyon yukleniyor).
- Alternatif: `printAnamnese` fonksiyonu sonradan yapilan baska edit'lerle uzerine yazilmis olabilir.

**Gereken gercek cozum:**
- `dashboard.js`'in browser'da gercekten yeni versiyon oldugunu dogrulamak (network tab'da `dashboard.js` boyutunu veya icerigini kontrol etmek).
- `window.print()` yerine `printAnamnese` fonksiyonunun cagrildigindan emin olmak: console'da `document.getElementById('anamPdfBtn').onclick` yazip kontrol etmek.
- Eger `printAnamnese` yoksa, fonksiyonu tekrar eklemek ve buton referansini guncellemek.

**Dosyalar:** `dashboard.js`
