# FEATURE REQUEST: InfinityMade - Hausbesuch & Fahrtenbuch Modülü Entegrasyonu

Mevcut InfinityMade fizyoterapi yazılımımıza kapsamlı bir "Ev Ziyareti (Hausbesuch) ve Sürüş Seyir Defteri (Fahrtenbuch)" modülü eklemek istiyoruz. Kod tabanına ve mimariye hakimsin, bu yüzden kodun nereye ekleneceğine veya component yapısına sen karar vereceksin. Aşağıda sadece kullanıcı deneyimi (UX) ve iş mantığı (Business Logic) gereksinimleri listelenmiştir.

Lütfen bu özelliği aşağıdaki 4 aşamalı mantığa göre sisteme entegre et:

## 1. Hasta Kayıt ve OCR (Rezept Scannen) Güncellemesi
- **Adres Zorunluluğu:** Hasta kayıt formunda "Hausbesuch" (Ev Ziyareti) seçeneği işaretlenmişse, adres alanı kesinlikle zorunlu (required) olmalıdır.
- **AI OCR Güncellemesi:** Şu anki sistemde reçete tarandığında (Rezept Scannen) adres bloğu okunmuyor. Yapay zeka OCR promptuna/mantığına adres bloğunu da okuyup ilgili alanlara doldurması için gerekli güncellemeyi ekle.

## 2. Rota Hesaplama ve Randevu Planlama (Termin Planen)
Hasta kaydı onaylanıp "Termin Planen" (Randevu Planla) aşamasına geçildiğinde:
- **Hesapla Butonu:** "Hausbesuch" checkbox'ının altına hastanın adresini gösteren bir alan ve "Hesapla" (Berechnen) butonu ekle.
- **API Çağrısı:** Bu butona basıldığında harita servisinden kliniğin adresi ile hastanın adresi arasındaki mesafe (KM) ve varış süresi (Dakika) hesaplanıp ekranda gösterilmeli.
- **Kullanıcı Onayı:** Çalışan bu süreyi hastaya teyit ettirip "Kaydet"e bastığında, bu KM ve Süre bilgisi hastanın verilerine (adresle birlikte) kalıcı olarak kaydedilmeli.
- **Dinamik Randevu Süresi (Buffer Logic):** Hausbesuch randevuları takvime eklenirken şu formüle göre zaman bloğu ayrılmalıdır:
  `Gidiş Süresi` + `Fizyoterapi Süresi (Örn: 30 dk)` + `Dönüş Süresi` + `10 Dakika Buffer (Arabaya binme, eşya toplama, kapı çalma vs. payı)`
  *(Örnek: 15dk gidiş + 30dk seans + 15dk dönüş + 10dk buffer = Toplam 70 dakikalık takvim bloğu).*

## 3. Çalışan / Terapist İş Akışı (Randevu Günü)
Randevu saati geldiğinde terapistin ekranında normal randevulardan farklı bir akış olmalıdır:
- **Fahrt Starten:** Ev ziyareti olan bir hastada "Termin Starten" yerine "Fahrt Starten" butonu görünmelidir.
- **Sürüş Başlangıç Akışı:** 
  1. "Fahrt Starten"a basıldığında sistem terapiste "Hangi aracı kullanıyorsunuz?" diye sormalıdır (Son seçilen araç default olarak seçili gelmelidir).
  2. Araç seçildikten sonra "Aktüel Kilometreyi (Başlangıç KM) Giriniz" şeklinde bir input çıkmalıdır.
  3. KM girilip onaylandıktan sonra ekranda hastanın adresi ve yanında "Tek Tıkla Kopyala" (Copy to Clipboard) butonu çıkmalıdır (Terapistin adresi kendi harita uygulamasına yapıştırabilmesi için).
- **Termin Starten:** Adres kopyalanıp uygulamadan çıkıldıktan sonra, terapist hedefe varıp uygulamayı tekrar açtığında sistem sürüşün yapıldığını varsaymalı ve ekranda artık asıl seansı başlatacak olan "Termin Starten" butonu görünmelidir. Normal randevu akışı devam eder.
- **Fahrt Beenden:** Seans bitip randevu sonlandırılırken ekranda "Fahrt Beenden" adımı olmalıdır. Sistem terapisten tekrar "Bitiş KM"sini girmesini istemelidir. Başlangıç, bitiş ve araç verileri alınarak log tamamlanır.

## 4. Fahrtenbuch (Sürüş Seyir Defteri) Sayfası
Sol ana menüye yeni bir "Fahrtenbuch" sekmesi eklenmelidir. Bu sayfanın özellikleri:
- **Araç Yönetimi (Araba Ekle):** Kliniğe veya personele ait araçlar eklenebilmelidir. 
  - Gerekli alanlar: Kullanım Türü ("Privat" veya "Gewerblich") ve Plaka (Kennzeichen).
- **Log Listeleme:** Terapistlerin girdiği tüm sürüş kayıtları (Tarih, Hasta, Plaka, Kullanım Türü, Başlangıç KM, Bitiş KM, Toplam Yapılan KM ve Süre) bu ekranda bir tablo halinde listelenmelidir.
- **Özet Raporlar:** Ay sonunda hangi araçla veya hangi personelin toplam kaç KM ve kaç dakika yol yaptığı bu sayfada açıkça raporlanabilmelidir.



web sitesinde : cok fazla dokumantasyon var :driections,Export,isochrones,matrix,snapping,pois,optimiyation,elevation,geocode gibi ihtiyacin olanlari kullanicidan iste 




Lütfen bu gereksinimleri mevcut veritabanı şemamıza (Supabase vb.) ve UI mimarimize en uygun şekilde entegre etmek için adım adım çalışmaya başla. Nereden başlamak istersin?

---

## 📌 KARAR KAYDI (2026-05-22)

Aşağıdaki kararlar kullanıcıyla doğrulandı ve uygulamanın temelini oluşturur.

### 1. Klinik (başlangıç) adresi
- **Karar:** `profiles` tablosuna strukturlu adres kolonları eklenecek.
- **Şema:** `clinic_street`, `clinic_plz`, `clinic_city`, `clinic_lat`, `clinic_lng`.
- **UI:** Settings panelinde owner bir kez doldurur; geocode otomatik yapılır.

### 2. Hasta adresi
- **Karar:** `leads` tablosuna strukturlu kolonlar eklenecek (metadata JSON değil).
- **Şema:** `street`, `plz`, `city`, `lat`, `lng`, `distance_km` (numeric), `duration_min` (integer), `route_calculated_at` (timestamptz).
- **Geçiş:** Eski `metadata.adresse` değerini bir kerelik backfill ile (best effort) yeni alanlara taşıma — yoksa boş bırakıp owner tekrar girer.
- **OCR:** `rezept-ocr.js` zaten `patient.adresse` çekiyor; kayıt akışına entegre edilecek.

### 3. OpenRouteService modülleri
- **Aktif:** Directions (mesafe + süre) — klinik↔hasta rotası için.
- **Aktif:** Matrix — **zincirleme Hausbesuch** planı için (bir terapistin arka arkaya hasta ziyaretlerinde A→B→C rotası KM/süresi). MVP'de hazır altyapı, UI ilk sürümde devreye alınmayabilir.
- **Geocoding:** ORS'un Pelias tabanlı `/geocode/search` endpoint'i (aynı API key ile ücretsiz) adres metnini lat/lng'e çevirmek için kullanılacak. Bu zorunlu (Directions koordinat ister, adres string kabul etmez) — eklendi.

### 4. Fahrtenbuch sekmesi RBAC
- **Karar:** Sidebar'da hem `owner` hem `employee` görür.
- **Görünüm:**
  - **Owner:** Tüm araçlar (privat+gewerblich), tüm çalışanların logları, klinik geneli özet raporlar.
  - **Employee:** Gewerblich araçlar (klinik filosu, owner ekler) + kendi eklediği Privat araçlar. Sadece kendi sürüş logları + kendi raporu.
- **RLS:** Buna göre policy yazılacak.

### 5. Fahrt → Termin geçişi
- **Karar:** Manuel "Ich bin angekommen → Termin Starten" butonu.
- **State machine:** Booking için `fahrt_status` alanı eklenecek: `null → fahrt_started → fahrt_arrived → in_progress (Termin) → fahrt_return_pending → completed`.
  - `null`: Hausbesuch değil veya henüz başlamamış.
  - `fahrt_started`: Başlangıç KM girildi, adres kopyalandı.
  - `fahrt_arrived`: Terapist "Hedefteyim" tıkladı, Termin Starten butonu görünür.
  - `in_progress`: Termin başlatıldı (mevcut bookings.status='in_progress' ile aynı).
  - `fahrt_return_pending`: Termin bitirildi, "Fahrt Beenden" + Bitiş KM input görünür.
  - `completed`: Bitiş KM kaydedildi, log finalize edildi.

### 6. Araç sahipliği
- **Karar (hibrit model):**
  - `vehicles.kind = 'gewerblich'` → klinik filosu. `owner_id` (klinik sahibi) ile bağlı. **Tüm çalışanlar görür ve seçer**. Sadece owner ekleyip/düzenleyebilir.
  - `vehicles.kind = 'privat'` → kişiye özel. `owner_id` (klinik sahibi) + `created_by` (ekleyen kullanıcı). **Sadece `created_by` kullanıcısı görür/seçer**. Owner görmez (gizlilik).
- **Vergi/Fahrtenbuch açısından doğru:** Privat araçlar kişiye özel kalır; gewerblich araçlar firma defterinde ortak.

### 7. Buffer süresi
- **Formül (Fahrtenbuch.md §2):** `Gidiş + Seans + Dönüş + 10 dk buffer`
- **Karar:** 10 dk buffer hardcoded başlar; ileride `profiles.hausbesuch_buffer_min` ile konfigüre edilebilir (V2).

---

## 🗺️ UYGULAMA PLANI (Wave'ler)

### Wave 1a — Database (Supabase)
**Migration `database_v21_fahrtenbuch.sql`:**
- `CREATE EXTENSION IF NOT EXISTS postgis;`
- `profiles` ALTER: `clinic_street, clinic_plz, clinic_city, clinic_location geography(Point, 4326)`
- `leads` ALTER: `street, plz, city, location geography(Point, 4326), distance_km, duration_min, route_calculated_at`
- `bookings` ALTER: `fahrt_status, vehicle_id (FK), start_km, end_km, fahrt_started_at, fahrt_arrived_at, fahrt_ended_at`
- `vehicles` CREATE: `id, owner_id, created_by, kind('privat'|'gewerblich'), kennzeichen, label, is_default, created_at` — RLS:
  - SELECT: gewerblich → owner+all employees; privat → only created_by
  - INSERT: kind=gewerblich → owner-only; kind=privat → any team member
  - UPDATE/DELETE: same as INSERT scope
- `fahrten` CREATE: `booking_id (unique), user_id, owner_id, vehicle_id, lead_id, start_km, end_km, distance_km (GENERATED ALWAYS AS end_km-start_km), duration_min, fahrt_started_at, fahrt_ended_at` — RLS:
  - SELECT: owner görür hepsi; employee sadece user_id=auth.uid()
  - INSERT/UPDATE: employee kendi user_id'siyle
- Indexes: `idx_leads_location GIST`, `idx_fahrten_user_owner`, `idx_vehicles_owner_kind`

### Wave 1b — Supabase Edge Functions (ORS proxy)
**Rasyonel:** GDPR/DSGVO Art. 9 sağlık verisi işliyoruz. ORS_API_KEY Vault'ta, JWT-auth otomatik, audit log built-in.

**Functions:**
- `supabase/functions/fahrtenbuch-geocode/index.ts` — body: `{address: string}` → `{lat, lng, normalized_label, confidence}`. ORS `/geocode/search` proxy. Auth required.
- `supabase/functions/fahrtenbuch-route/index.ts` — body: `{origin: [lng,lat], dest: [lng,lat]}` → `{distance_km, duration_min}`. ORS `/v2/directions/driving-car` proxy.
- `supabase/functions/fahrtenbuch-matrix/index.ts` — body: `{locations: [[lng,lat], ...]}` → `{durations, distances}`. ORS `/v2/matrix/driving-car`. Zincirleme Hausbesuch için.

**Data minimization:**
- ORS'a ASLA patient name, lead_id, booking_id gönderilmez — sadece koordinatlar.
- Frontend ORS'u doğrudan çağırmaz (IP leak + key leak engeli).
- Her invoke audit'lenir (Supabase Logs).

**Secret:**
- `ORS_API_KEY` → Supabase Vault (`select vault.create_secret(...)` veya CLI: `supabase secrets set ORS_API_KEY=...`).

**⚠️ GDPR follow-up (production öncesi):**
- ORS free tier'da Art. 28 DSGVO AVV (DPA) YOK — production'a tam geçmeden ORS commercial plan ile DPA imzalanmalı.
- VPS api-backend'e (calendar+billing) DOKUNULMUYOR; Fahrtenbuch sıfır impact.

### Wave 2 — Frontend: Hasta Kaydı + OCR
3. `dashboard.html`/`.js` Kunden modal:
   - Hausbesuch checkbox işaretliyse Strasse/PLZ/Ort alanları **required**.
   - OCR sonrası `patient.adresse` → bu alanlara dolsun (parse).

### Wave 3 — Frontend: Termin Planen (Booking Modal)
4. Booking modal (`bkHausbesuch`):
   - Checkbox altında hastanın adresi + "Berechnen" butonu.
   - Buton → geocode (gerekirse) + route → KM/süre göster.
   - "Kaydet"e basınca: leads.lat/lng/distance_km/duration_min güncellenir.
   - Bookings INSERT/UPDATE: end_time = start_time + duration_min*2 + service_duration + 10 buffer.

### Wave 4 — Frontend: Terapist Akışı (Calendar / Termin Detay)
5. Hausbesuch randevu detayında durum makinesi:
   - `null` → "Fahrt Starten" butonu.
   - `fahrt_started` → Araç seçim (default = is_default veya son seçilen) + Başlangıç KM input → Adres + "Kopyala" + "Ich bin angekommen".
   - `fahrt_arrived` → "Termin Starten" butonu (normal akış).
   - `in_progress` bitince → "Fahrt Beenden" + Bitiş KM → finalize → fahrten kaydı yazılır.

### Wave 5 — Frontend: Fahrtenbuch Sayfası
6. Yeni sidebar item `fahrtenbuch` (owner+employee):
   - `dashboard.html` → `<section class="panel" id="panel-fahrtenbuch">`
   - Tablar: "Fahrzeuge" | "Fahrten" | "Berichte"
   - **Fahrzeuge:** ekle/düzenle/sil; owner: hepsi; employee: gewerblich (RO) + privat (own RW).
   - **Fahrten:** Datum, Patient, Kennzeichen, Kullanım, Start-KM, End-KM, Total-KM, Dauer. Filtre: tarih aralığı, araç, terapist (owner only).
   - **Berichte:** Aylık özet — araç bazında ve terapist bazında toplam KM + dakika. CSV export.

### Wave 6 — Test & Polish
7. Manuel UAT: tam akış (kayıt → OCR → planen → fahrt → arrive → termin → end → log).
8. Edge case: geocode başarısızsa hata gösterimi, network down davranışı, KM girişi validasyonu (end_km > start_km).

---

*Plan kaydedildi 2026-05-22. Wave 1'den başlıyoruz.*

