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
