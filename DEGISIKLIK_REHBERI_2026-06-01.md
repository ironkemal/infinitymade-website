# Değişiklik Rehberi — Tarife Kitabı

> **Tarih:** 2026-06-01
> **Kapsam:** Bu oturumda yapılan tüm düzeltme ve yeni özellikler.
> **Her madde:** *Ne değişti · Neden / hangi fonksiyon · Nasıl test edilir.*

## Test ön koşulları (hepsi için ortak)

- **Dashboard:** https://app.infinitymade.de/login.html → giriş → `dashboard.html`
- **Test hesabı:** `fizyo6@gmail.com` (fizyoterapi / physio sektörü)
- Fizyo/§302 özellikleri yalnız **physiotherapy sektörü + klinik/enterprise plan**da görünür.
- Backend değişiklikleri (`api-backend/`) CI + Watchtower ile ~3 dk içinde canlıya iner; frontend (`dashboard.js/html`) Vercel'e push ile anında.
- Tarayıcıda **Hard Reload** yap (Ctrl+Shift+R) — cache busting var ama garanti olsun.

---

## 0. ACİL: Backend çökmesini düzelten kök fix (en kritik)

**Ne değişti:** `api-backend/billing/api/warteliste.routes.js` yanlış ortam değişkeni kullanıyordu (`SUPABASE_SERVICE_KEY` → tanımsız). Doğrusu `SUPABASE_SERVICE_ROLE_KEY` yapıldı. *(commit `4cfef84`)*

**Neden / hangi fonksiyon:** Bu typo, `createClient()`'ı import anında patlatıp **tüm calendar-api backend container'ını crash-loop'a** sokuyordu. Container ayağa kalkamayınca Traefik trafiği n8n'e yönlendiriyor, dashboard'da **Statistik ve Mahnwesen'de "failed to fetch"** çıkıyordu. Aslında tüm `/api/*` çağrıları (booking-slot, takım, vb.) etkileniyordu.

**Nasıl test edilir:**
1. Dashboard → **Statistik** paneli aç → grafikler/KPI'lar yükleniyor mu (hata yok).
2. Dashboard → **Mahnwesen** aç → liste/özet yükleniyor (kırmızı "failed to fetch" yok).
3. (Teknik) `https://n8n.infinitymade.de/api/billing/statistik?monate=6` → JSON `{"error":"..."}` dönmeli (n8n HTML değil).

---

## 1. "failed to fetch" sınıfı: opsiyonel sorgularda 406 → `maybeSingle()`

**Ne değişti:** `calendar_integrations` (Google Takvim) sorgularında `.single()` → `.maybeSingle()` (4 frontend + 1 backend `/api/booking/create`). *(commit `30686bc`)*

**Neden / hangi fonksiyon:** Kullanıcının Google Takvim bağlantısı yoksa sorgu 0 satır döner; `.single()` bunu **HTTP 406** hatasıyla cezalandırıyordu (Settings panelinde + booking akışında console hatası). `.maybeSingle()` yoksa `null` döner.

**Nasıl test edilir:**
1. Google Takvim **bağlı olmayan** bir hesapla **Settings** panelini aç.
2. Tarayıcı Konsolu (F12) → kırmızı `406` / `PGRST116` hatası **olmamalı**.
3. Settings sorunsuz render olmalı.

---

## 2. Hasta sigorta verisi yapılandırılmış kolona yazılıyor

**Ne değişti:** Hasta (Kunde) kayıt/düzenleme formu Krankenkasse + sigorta numarasını artık `leads.krankenkasse` ve `leads.versichertennummer` **kolonlarına** yazıyor (önceden sadece `metadata` JSONB'sine yazıyordu). Düzenlemede de kolondan okuyor (eski kayıtlar için metadata fallback'i korunuyor). *(commit `3f21470`)*

**Neden / hangi fonksiyon:** §302 faturalama yapılandırılmış kolonları arıyor. Veri sadece `metadata`'da kalınca **"Krankenkasse fehlt"** zinciri kırılıyordu (kostentraeger eşleşmiyordu).

**Nasıl test edilir (Resepsiyonist):**
1. **Kunden** → **+ Neuer Lead** → fizyo alanları görünür (sektör physio).
2. Krankenkasse seç + Versichertennummer gir + kaydet.
3. Hastayı tekrar aç → bu iki alan **dolu geliyor** (kayboluyorsa hata).
4. (Teknik) Supabase `leads` tablosunda ilgili satırda `krankenkasse` ve `versichertennummer` **kolonları** dolu olmalı.

---

## 3. Tekil randevu artık `lead_id` kaydediyor

**Ne değişti:** Manuel tekil booking payload'ına `lead_id` eklendi. *(commit `3f21470`)*

**Neden / hangi fonksiyon:** Tekil randevular hastaya yalnızca isim/telefonla bağlanıyordu; hasta adı/telefonu değişince geçmiş randevular kopuyordu. (Grup randevuları zaten `lead_id` set ediyordu.)

**Nasıl test edilir (Resepsiyonist):**
1. **Kalender** → **+ Termin** → bir hasta seç → kaydet.
2. (Teknik) Supabase `bookings` → yeni satırda `lead_id` **dolu** olmalı (null değil).

---

## 4. Fahrtenbuch mesafesi (`distance_km`) kaydediliyor

**Ne değişti:** Hausbesuch/Fahrt bitirilince `distance_km = end_km − start_km` artık DB'ye yazılıyor (önceden sadece ekranda hesaplanıp gösteriliyordu). *(commit `3f21470`)*

**Neden / hangi fonksiyon:** Fahrtenbuch raporu/toplamları `distance_km` okuyor; bu alan boş kalınca raporlar 0/null gösteriyordu.

**Nasıl test edilir (Resepsiyonist/Owner):**
1. Bir Hausbesuch randevusunda Fahrt başlat (start_km) → bitir (end_km gir).
2. **Fahrtenbuch** panelinde kayıt → **km mesafesi** doğru görünmeli (0 değil).

---

## 5. Doktor (Arzt) — otomatik tamamlama + hastaya atama

**Ne değişti:** *(commit `bc48ab4`)*
- Rezept-onay ve Anamnese formlarındaki doktor adı alanına kayıtlı Ärzte'den **autocomplete (datalist)** eklendi (yine serbest yazılabilir).
- Hasta (Kunde) modalına **doktor seçici** eklendi → `leads.arzt_id` kaydediliyor (önceden UI yoktu).

**Neden / hangi fonksiyon:** Kayıtlı doktorlar formlarda tekrar tekrar elle yazılıyordu; hastaya doktor atamak hiç mümkün değildi.

**Nasıl test edilir (Therapeut/Resepsiyonist):**
1. **Settings/Ärzte**'de bir doktor ekle.
2. **Kunden** → hasta aç/düzenle → "Arzt" seçicisinde o doktor görünmeli → seç + kaydet → tekrar açınca dolu gelmeli.
3. **Rezept** onay ekranında doktor adı alanına yazmaya başla → kayıtlı doktorlar öneri olarak çıkmalı.

---

## 6. §302 `leitsymptomatik` — uçtan uca (en önemli compliance)

**Ne değişti:** *(commits `6a6e069`, `9a009a0`, `f084e86` + DB migration)*
- `prescriptions` tablosuna **`leitsymptomatik` kolonu** eklendi (migration).
- Rezept-onay modalına **giriş alanı** (`a/b/c/d`, örn. `1010`) eklendi; OCR çıkardıysa otomatik dolar.
- Rezept-onay backend'i (`/api/rezept/confirm`) değeri **kolona kaydediyor**.
- §302 DTA mapping'i `rx.leitsymptomatik` okuyor (önceden sabit `''`).
- Kayıtlı reçete düzenlenince alan tekrar doluyor.

**Neden / hangi fonksiyon:** `leitsymptomatik` §302 **zorunlu alanı**; sabit boş kaldığında preflight **her abrechnung'da `V:01006 Leitsymptomatik fehlt`** veriyordu → faturalama bloke.

**Nasıl test edilir (Therapeut):**
1. **Rezept** yükle/aç (OCR veya manuel) → onay ekranında **"Leitsymptomatik"** alanına `1010` gir → kaydet.
2. Reçeteyi tekrar aç → alan `1010` dolu gelmeli.
3. **Abrechnung** → bu reçeteyi "Validieren" → artık `V:01006 Leitsymptomatik fehlt` hatası **çıkmamalı**.
4. (Teknik) Supabase `prescriptions` → `leitsymptomatik='1010'`.

---

## 7. Mahnung mektubu banka bilgisini profilden alıyor

**Ne değişti:** `mahnwesen.routes.js` artık `praxisProfile`'dan `bank_name/iban/bic` okuyup `bankverbindung`'u kuruyor (önceden sabit `''`). *(commit `9a009a0`)*

**Neden / hangi fonksiyon:** Mahnung mektubunda banka satırı boş çıkıyordu → hasta ödeme yapamıyordu. Banka bilgisi zaten **Settings → Rechnungsdaten**'de kaydediliyordu ama mektup okumuyordu.

**Nasıl test edilir (Owner):**
1. **Settings → Rechnungsdaten**'de IBAN/BIC/Banka adı dolu olsun (kaydet).
2. **Mahnwesen** → açık bir Zuzahlung için **Mahnung erstellen** → açılan baskı önizlemesinde **banka satırı dolu** görünmeli.

---

## 8. `ik_number` Rechnungsdaten ile de kaydediliyor

**Ne değişti:** "Rechnungsdaten speichern" (`billingSaveBtn`) artık `ik_number`'ı da kaydediyor. *(commit `400f008`)*

**Neden / hangi fonksiyon:** IK yalnız ayrı bir butonla kaydediliyordu; kullanıcı IK alanını doldurup "Rechnungsdaten speichern"e basınca IK **sessizce kayboluyordu**. IK §302/DMRZ için kritik.

**Nasıl test edilir (Owner):**
1. **Settings** → IK alanını doldur → **Rechnungsdaten speichern**'e bas.
2. Sayfayı yenile → IK **dolu** gelmeli (kaybolmamalı).

---

## 9. Fatura numarası tekilliği (invoice_number)

**Ne değişti:** `invoices` tablosuna `UNIQUE(owner_id, invoice_number)` constraint eklendi (DB migration).

**Neden / hangi fonksiyon:** Eşzamanlı fatura oluşturma aynı numarayı üretip GoBD ardışık-tekillik kuralını bozabiliyordu. Artık çakışan numara DB seviyesinde reddedilir.

**Nasıl test edilir (Owner):**
1. Normal kullanımda fatura oluştur → sorun olmamalı (mevcut çakışma yoktu).
2. (Teknik doğrulama) Aynı `owner_id`+`invoice_number` ile ikinci kayıt denenirse DB hata verir (constraint: `invoices_owner_invoice_number_unique`).

---

## 10. Warteliste eşleştirme (match) UI'ı

**Ne değişti:** Bir randevu **iptal edilince**, boşalan slota uyan bekleyen hastalar `/api/warteliste/match` ile bulunup listeleniyor (isim/telefon/email + iletişim linkleri). *(commit `9676df0`)*

**Neden / hangi fonksiyon:** Backend match endpoint'i vardı ama UI'da çağıran yoktu — boş slotu bekleyen hastayla doldurma akışı görünmüyordu. (Match, randevu silinmeden **önce** tetiklenir; aksi halde slot bilgisi kaybolurdu.)

**Nasıl test edilir (Resepsiyonist):**
1. **Warteliste**'ye servis + tercih edilen gün/saat ile bir hasta ekle.
2. Aynı servis/güne uyan bir randevuyu **iptal et**.
3. Eşleşen aday(lar) bir liste/modalda gösterilmeli; eşleşme yoksa "Keine passenden Warteliste-Patienten." toast'ı.

---

## 11. Plan limitleri (employee + Standort)

**Ne değişti:** *(commit `79ed610`)*
- **Çalışan limiti:** starter=2, professional=8, klinik=15, enterprise=sınırsız. Limit dolunca yeni çalışan eklenemiyor.
- **Standort (business) limiti:** birden çok şube yalnız **Enterprise** planında.

**Neden / hangi fonksiyon:** Hiç plan limiti zorlanmıyordu; her plan sınırsız çalışan/şube açabiliyordu (gelir kaybı).

**Nasıl test edilir (Owner):**
1. **Mitarbeiter** → plan limitine kadar çalışan ekle → limit aşımında **"Plan-Limit erreicht: max. N Mitarbeiter…"** hatası çıkmalı.
2. Enterprise olmayan planla **ikinci** Standort eklemeyi dene → **"Mehrere Standorte sind nur im Enterprise-Paket verfügbar."** hatası.

---

## 12. No-show (Patient nicht erschienen) kaydı

**Ne değişti:** "Patient nicht erschienen" butonu artık `bookings.status='no_show'` + bağlı `prescription_sessions.status='no_show'` yazıp takvimi yeniliyor (önceden sadece bir stub bot tetikliyordu, hiçbir şey kaydetmiyordu). *(commit `9adaeea`)*

**Neden / hangi fonksiyon:** No-show hiç kaydedilmediği için no-show oranı / Ausfallhonorar takip edilemiyordu.

**Nasıl test edilir (Resepsiyonist):**
1. **Kalender** → bir randevuya tıkla → **Patient nicht erschienen**.
2. (Teknik) Supabase `bookings` → o randevu `status='no_show'`; varsa bağlı `prescription_sessions` da `no_show`.
3. Takvimde randevu durumunun değiştiği görülmeli.

---

## 13. Reddedilen reçete: düzelt & yeniden faturala

**Ne değişti:** Reddedilen (ZAA rejected) bir Abrechnung'da **"🔄 Korrigieren & erneut abrechnen"** butonu → o reçeteleri `abrechnung_status='bereit'` yapıp `abrechnung_id`'yi temizliyor (reddedilen Abrechnung kaydı audit için durur). *(commit `8014af0`)*

**Neden / hangi fonksiyon:** Kasadan red gelince reçeteler `rejected`'ta sıkışıp kalıyordu; düzeltip yeniden faturalamanın yolu yoktu.

**Nasıl test edilir (Owner):**
1. **Abrechnung** → geçmişte **rejected** bir Abrechnung bul (ya da ZAA ret simüle et).
2. **"🔄 Korrigieren & erneut abrechnen"** → onayla.
3. İlgili reçeteler tekrar **"Bereit"** listesinde görünmeli → düzelt → yeniden Abrechnung oluştur.

---

## Henüz yapılmadı (bilerek ertelenenler)

- **Booking onay/hatırlatma e-postası:** Email provider (Resend) + API key gerekiyor → senin kararınla ertelendi.
- **Derin audit MED/LOW maddeleri:** duplicate hasta birleştirme, seans cap (anzahl_einheiten aşımı), therapist verimlilik/no-show oranı/Mahnung raporları, DATEV export, profil §302 completeness uyarısı, sertifika expiration uyarısı, Stripe past_due enforcement, signed-DTA doğrulama, per-session not, Zuzahlung-Befreiung upload, tel:/mailto: tek-tık, drag-drop reschedule. (Detay: `project_infinitymade_deep_audit_round2.md` hafıza notunda.)

---

## Hızlı commit indeksi

| Konu | Commit |
|------|--------|
| warteliste env crash (acil) | `4cfef84` |
| maybeSingle 406 | `30686bc` |
| bankverbindung + leitsymptomatik map | `9a009a0` |
| krankenkasse kolonu + booking lead_id + distance_km | `3f21470` |
| leitsymptomatik UI | `6a6e069` |
| doktor dropdown + arzt atama | `bc48ab4` |
| warteliste match UI | `9676df0` |
| leitsymptomatik zinciri (backend persist) | `f084e86` |
| ik_number Rechnungsdaten | `400f008` |
| plan limitleri | `79ed610` |
| no-show persist | `9adaeea` |
| rejected re-submit | `8014af0` |
| **DB migration** | prescriptions.leitsymptomatik · invoices unique constraint |
