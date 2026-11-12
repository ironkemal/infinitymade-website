# Praxura — Çapraz Bağlam ve Senkronizasyon Denetim Raporu (Claude İçin Eylem ve Doğrulama Planı)

**Tarih:** 30.10.2026 (Son commit baz noktası: `0f3bf0c0`)  
**Kapsam:** Tüm depo (`dashboard.html/.js`, `module/*.js`, `api-backend/**`, `api/**`, `db/SCHEMA*.sql`, `kalender.*`, `onboarding.*`, `merkez/**`, `tools/**`, `CLAUDE.md`, `AGENTS.md`, `.vercelignore`, `package.json`)  
**Amaç:** Tek oturumluk bağlama sığmadığı için bir tarafı güncellenirken diğer tarafı unutulmuş, eski kalmış veya birbirinden habersiz çalışan noktaların tam dosya/satır kanıtlarıyla listelenmesi.

---

## 🧭 CLAUDE İÇİN DOĞRULAMA PROTOKOLÜ (Düzeltmeye Başlamadan Önce Oku)

1. **`CLAUDE.md` Kuralı Geçerlidir:** *"Audit bulguları iddiadır, aksiyon almadan önce koda/DB'ye karşı doğrula."* Buradaki her madde gerçek kod ve `db/SCHEMA*.sql` okunarak çıkarılmıştır; ancak tek satır bile değiştirmeden önce ilgili dosyayı ve satırı kendin oku ve doğrula.
2. **Ajan Protokolünü Atlamadan İlerle:**
   - **Bölüm 1.1 – 1.4 (DB / RLS / DSGVO):** Şema veya RLS migration'ı yazmadan önce **`db-ustasi`**, **`guvenlik`** ve **`onprem`** ajanlarına sor. Unutma: Şema değişikliği sırası **`1. api-backend/db/migrations/NNNN_...sql` → `2. db/SCHEMA.sql + SCHEMA-RLS.sql` → `3. MCP apply_migration` + `db/REGISTER.md`**.
   - **Bölüm 1.5, 2 ve 3 (Frontend / Modül / Backend Uçları):** Fonksiyon değiştirmeden/silmeden önce **`fonksiyon-ustasi`** ajanına sor, bitince niyet bildir ve `node tools/funktionskarte.mjs` + `node tools/tabellenkarte.mjs` çalıştır. `dashboard.js` satır sayısını büyütme (`tools/check-dashboard-size.sh`).
   - **Bölüm 5 (`.vercelignore` / Fiyat / UWG):** Pazarlama/hukuk iddialarında **`legal-de`**, yayın yüzeyi değişikliklerinde **`onprem` / `guvenlik`** kontrolünü uygula.
3. **Önerilen İlerleme Sırası:**
   - **Faz A (Kritik Çalışma Zamanı Kırılmaları):** Bölüm 1.1 (`leads.dob`), Bölüm 1.2 (`loeschen.js` içinde `therapieberichte`), Bölüm 1.3 (`loeschen.js` içinde `empIds`), Bölüm 4.1 (`@sentry/node` sürüm çatışması).
   - **Faz B (RLS ↔ Frontend Uyuşmazlıkları):** Bölüm 1.4 (`working_hours`, `breaks`, `profiles`, `podologie_behandlungen`).
   - **Faz C (Yayın Yüzeyi & Yan Sayfalar):** Bölüm 5.1 (`.vercelignore`), Bölüm 5.2 (`onboarding.html` fiyat/OCR ve blog UWG), Bölüm 1.5 (`kalender.js` ve `onboarding.js`).
   - **Faz D (DOM / Sözlük / `?v=` / Ölü Kod Temizliği & Dokümantasyon):** Bölüm 2, Bölüm 3 ve Bölüm 6 (`AGENTS.md` ↔ `CLAUDE.md` senkronizasyonu).

---

## 🚨 BÖLÜM 1: Çalışma Zamanında Kırılan Noktalar (Kritik Kod ↔ DB / RLS / API Kopuklukları)

### 1.1 DMRZ XML İhracında Var Olmayan `leads.dob` Kolonunun Sorgulanması (`HTTP 400` + Boş Hasta Verisi)
- **Nerede:** `module/rechnung-dmrz.js:134-136` ve `buildDmrzXml` (`module/rechnung-dmrz.js:58`)
- **Ne oluyor:**
  ```js
  const { data: patient } = await supabase
      .from('leads')
      .select('id,first_name,last_name,title,dob,versichertennummer,krankenkasse,email,phone')
      .eq('id', invoice.patient_id)
      .maybeSingle();
  ```
- **Kopukluk:** `db/SCHEMA.sql:2097` içinde `public.leads` tablosundaki doğum tarihi kolonu `dob` değil **`geburtsdatum`**. PostgREST bu sorguyu `400 Bad Request (column leads.dob does not exist)` ile reddediyor. `error` yakalanmadığı için `patient` sessizce `null` dönüyor ve `buildDmrzXml` (satır 58'de de `patient?.dob` okuyor) tüm `<Versicherter>` alanlarını boş üretiyor.
- **Nasıl kontrol etmeli / düzeltmeli:** `module/rechnung-dmrz.js` satır 58 ve 135'i oku; `dob` → `geburtsdatum` olarak düzelt ve birim testi ekle.

---

### 1.2 DSGVO Hesap Silmede (`loeschen.js`) Yeni `therapieberichte` Tablosunun Unutulması (`FK 23503` Çökmesi)
- **Nerede:** `api-backend/dsgvo/loeschen.js:291-328` ve `db/SCHEMA.sql:3441`
- **Kopukluk:** 22.10.2026'da `0087_therapieberichte.sql` ile açılan `therapieberichte` tablosu `api-backend/dsgvo/klassifikation.js:73` içine eklendi (`npm test` kapısını geçti), **ancak `api-backend/dsgvo/loeschen.js` içindeki iki yerde unutuldu:**
  1. **Adım 2 (`pruefeRelation`, satır 294–301):** Reçetelerin `behandelteVoIds` / `unbehandelteVoIds` ayrımında `prescription_sessions`, `abrechnung_verordnung`, `heilmittel_genehmigungen`, `podologie_empfangsnachweise` kontrol ediliyor ama **`therapieberichte` kontrol edilmiyor**. Faturalanmamış bir reçeteye bağlı `therapieberichte` kaydı varsa reçete `unbehandelteVoIds` içine düşüyor; Adım 4a'da (`loeschen.js:394`) `DELETE FROM prescriptions` çalıştığında `therapieberichte_prescription_id_fkey ON DELETE RESTRICT` yüzünden PostgreSQL `23503` hatası fırlatıp silme işlemini yarıda bırakıyor (`HTTP 500`).
  2. **Adım 3 (`KATEGORIE_TABELLEN.behandlung`, satır 325):** Listede `['behandlungsdokumentation', 'podologie_befunde', 'podologie_ws_karten', 'podologie_behandlungen']` var; hem `'therapieberichte'` hem `'podologie_empfangsnachweise'` eksik.
- **Nasıl kontrol etmeli / düzeltmeli:** `api-backend/dsgvo/loeschen.js:290-335` aralığını ve `klassifikation.js:50-80` aralığını karşılaştır; Adım 2'ye `await pruefeRelation('therapieberichte', 'prescription_id')`, Adım 3'e `'therapieberichte'` ve `'podologie_empfangsnachweise'` ekle.

---

### 1.3 DSGVO Hesap Silmede (`loeschen.js`) Banlanan Çalışanların (`empIds`) Verilerinin Silinmemesi
- **Nerede:** `api-backend/dsgvo/loeschen.js:507-545` ve `loeschen.js:646-736`
- **Kopukluk:** K1.4 / `S-40` kararıyla `hatSperrbestand = true` olduğunda `auth.users` silinmeyip süresiz banlanıyor (`ban_duration: '876000h'`). Bu yüzden `user_id -> auth.users(id) ON DELETE CASCADE` çalışanlar (`empIds`) için tetiklenmiyor. Ancak Adım 5'teki `einfacheLoeschTabellen` (`loeschen.js:512-527`) `user_id` filtreli tabloları **yalnızca `.eq('user_id', ownerId)`** ile siliyor:
  - Çalışanlara (`empIds`) ait `calendar_integrations` (Google OAuth `access_token` / `refresh_token` / `google_email` dahil!), `breaks`, `kiosk_pins`, `user_preferences`, `feedbacks` **hiç silinmiyor**.
  - Çalışanların `working_hours` satırları `api-backend/routes/mitarbeiter-zugang.js:225-245` tarafından `owner_id = NULL, user_id = empId` ile açıldığı için `.eq('owner_id', ownerId)` silmesinden de kaçıyor (ve `klassifikation.js:360` `export: { filter: 'user_id' }` dediği için Art. 15 dışa aktarımında da çıkmıyor).
  - Ayrıca Adım 9'da (`hatSperrbestand` minimizasyonu): `loeschen.js:732-736` `public.businesses` üzerinde sadece `{ booking_slug, email, phone }` sıfırlıyor; `business_name`, `street`, `house_number`, `zip`, `city`, `clinic_lat`, `clinic_lng` açık kalıyor. Çalışan `profiles` satırlarında (`loeschen.js:721-726`) `booking_slug`, `anrede`, `street`, `house_number`, `zip`, `city`, `plz` sıfırlanmıyor; owner `profiles` satırında (`loeschen.js:683-716`) `ust_id`, `kim_adresse`, `telematik_id`, `clinic_location`, `deletion_consent_ip`, `datev_einstellungen` temizlenmiyor.
- **Nasıl kontrol etmeli / düzeltmeli:** `loeschen.js` Adım 5 ve Adım 9'u `guvenlik` ve `legal-de` ajanlarıyla birlikte gözden geçir; `user_id` tablolarında `[ownerId, ...empIds]` kapsamını uygula.

---

### 1.4 RLS ↔ Frontend Kopuklukları (4 Ayrı Tabloda Yetki Hatası veya Sessiz Sıfır Güncelleme)

1. **`working_hours` — Owner çalışan saati kaydederken `owner_id` göndermiyor (`RLS 42501`):**
   - **Kod:** `dashboard.js:9118-9125` (`hoursSaveBtn`), `dashboard.js:10362-10369` (`empHoursSaveBtn`), `kalender.js:749-757` ve `api-backend/routes/mitarbeiter-zugang.js:225-245` satır eklerken yalnızca `user_id: empId` yazıyor, `owner_id` göndermiyor.
   - **DB/RLS:** `db/SCHEMA-RLS.sql:6271` (`trg_working_hours_set_business_id`) sadece `business_id` dolduruyor, `owner_id` doldurmuyor. Oysa `working_hours_owner_modify` politikası (`db/SCHEMA-RLS.sql:1490-1495`) `auth.uid() = user_id OR auth.uid() = owner_id` şartı arıyor. Owner bir çalışanın saatini kaydettiğinde `owner_id = NULL` olduğu için PostgreSQL `42501` ile reddediyor.
2. **`breaks` — Owner'ın çalışan molalarını görme/ekleme/silme RLS politikası hiç yok (`RLS 42501`):**
   - **Kod:** `dashboard.js:9043, 9099, 9108` ve `10286, 10345, 10352` üzerinden Owner seçili çalışanın (`empId`) molalarını okuyor/ekliyor/siliyor.
   - **DB/RLS:** `db/SCHEMA-RLS.sql:657-670` içinde sadece `"Users can manage own breaks"` ve `"Employees can see owner breaks"` var. Owner'ın kendi çalışanlarının (`profiles.owner_id = auth.uid()`) molalarını okuyup yönetmesine izin veren politika **yok**.
3. **`profiles` — Owner'ın çalışan `anrede` ve `avatar_url` güncellemesi sessizce `0` satır güncelliyor:**
   - **Kod:** `dashboard.js:10013, 10088, 10106` (`supabase.from('profiles').update(...).eq('id', empId)`).
   - **DB/RLS:** `db/SCHEMA-RLS.sql:1229-1234` içindeki tek `UPDATE` politikası `profiles_update_own` (`auth.uid() = id`). Owner bir çalışanın profil fotoğrafını veya hitabını değiştirdiğinde PostgREST `0` satır güncelleyip `200 OK` dönüyor; arayüz `"Gespeichert!"` diyor ama DB'ye hiçbir şey yazılmıyor.
4. **`podologie_behandlungen` — Çalışana (`employee`) ekran açık ama tabloda `INSERT`/`UPDATE` RLS politikası yok:**
   - **Kod:** `nav-registry.js:101` `podologie-billing` panelini `roles: ['owner', 'employee']` olarak açıyor; `module/podologie-abrechnung.js:1226`, `module/podo-storno.js:142` ve `module/rechnung-bruecke.js:202` doğrudan `podologie_behandlungen` tablosuna yazıyor.
   - **DB/RLS:** `db/SCHEMA-RLS.sql:1162-1174` içinde `podologie_befunde`, `podologie_ws_karten` ve `podologie_empfangsnachweise` tablolarının aksine `podologie_behandlungen` için çalışanlara sadece `FOR SELECT` verilmiş, `INSERT`/`UPDATE` politikası unutulmuş.

---

### 1.5 `kalender.js` ve `onboarding.js` İçinde Ana Uygulamadan Kopuk Kalmış Akışlar

1. **`kalender.js` Google Calendar Bağlantısı Her Zaman `HTTP 401` Veriyor:**
   - `api-backend/server.js:626` `GET /api/calendar/google-auth` ucu `requireAuthAI` (`?token=<jwt>`) kullanacak şekilde güncellendi ve `dashboard.js:11066` buna uyarlandı; ancak `kalender.js:781` hâlâ eski `?userId=${session.user.id}` ile yönlendiriyor (`Missing bearer token` 401).
2. **`kalender.js` Diğer 5 Kopukluk:**
   - `kalender.js:140-146, 164-165`: Hâlâ eski `'INF-'` önekiyle `profiles.company_code` üretiyor (çalışan daveti `module/mitarbeiter-zugang.js` ile `employee_setup_codes` tablosuna geçti).
   - `kalender.js:623-624`: Manuel randevu oluştururken yerel saatin sonuna doğrudan `.000Z` (UTC) ekliyor; randevular 1–2 saat kayıyor.
   - `kalender.js:517-524` & `566-603`: Randevuyu `completed` veya `cancelled` yaparken `module/booking-status-korrektur.js` (`pruefeAbrechnungssperre`), `module/sitzung-abgleich.js` (`loeseSitzungVonTermin`) ve `module/podo-storno.js` kilit/seans çözme adımlarını tamamen atlıyor.
   - `kalender.js:243, 261, 657-659`: `s.title` ve `t.business_name` alanlarını escape etmeden `innerHTML`'e basıyor.
3. **`onboarding.js` `SERVICE_TEMPLATES` Şema Uyuşmazlığı (Fiyatlar Boş Geliyor) + GKV İsim Çakışması:**
   - `onboarding.js:14-45` içindeki tüm şablonlar `{ name, code, price_config: { durations: { 30: 42, ... } } }` yapısına geçirildi, fakat `renderServices` (`onboarding.js:571-572`) hâlâ eski `t.duration` ve `t.price` alanlarını okuyor (`t.price` her zaman `undefined` → fiyat kutuları boş geliyor!).
   - Üstteki yorum (`onboarding.js:11-13`) *"SERVICE_TEMPLATES yalnız Selbstzahler/Privat kalemleri içerir; GKV katalog hizmetleriyle isim çakışması yaratmamalı"* dediği halde `logopaedie` (`satır 22-25`) ve `ergotherapie` (`satır 30-33`) şablonlarında hâlâ GKV Heilmittel isimleri (`Motorisch-funktionelle Behandlung`, `Sprachtherapie` vb.) duruyor.

---

## 🖥️ BÖLÜM 2: Frontend (`dashboard.html` ↔ `dashboard.js` ↔ `module/*.js`) Senkronizasyon Kopuklukları

### 2.1 `dashboard.js` İçinde `window.*` Üzerinden Okunan Ama `window`'a Hiç Atanmamış Değişkenler
- **`window.ownerServices` her zaman `undefined`:**
  - `ownerServices` (`dashboard.js:474`) modül içi `let` değişkenidir, `window.ownerServices` ataması yoktur.
  - Ancak `openGroupBookingModal` (`dashboard.js:4031`) ve grup randevusu kaydı (`dashboard.js:5334`) `(window.ownerServices || []).find(...)` okuyor; bu yüzden grup randevularında seçilen hizmetin süresi/fiyatı hiç bulunamıyor ve başlık her zaman `'Gruppe: Gruppentermin'` oluyor.
- **`window.calendar` her zaman `undefined`:**
  - `dashboard.js:4151, 4299, 3832, 6854` `window.calendar` okuyor ama `calendar` (`dashboard.js:471`) `window`'a atanmadığı gibi eski FullCalendar (`#calendarEl`) kaldırıldığı için `calendar` da her zaman `null`.
- **Mükerrer `window.*` atamaları:** `window.switchPanel` (`765` ve `15953`), `window.editAerzte` (`13657` ve `15958`), `window.deleteAerzte` (`13658` ve `15959`) ikişer kez atanıyor.

---

### 2.2 `dashboard.html`'den Silinmiş/Değiştirilmiş Ama JS'de Hâlâ Aranan DOM ID'leri
1. **`#calMainWrap` (`dashboard.html`'den silindi, JS'de 4 yerde aranıyor):**
   - `dashboard.js:1712-1755` (`setupCalTimeTooltip` IIFE): Her `mousemove` olayında `document.getElementById('calMainWrap')` arıyor; `null` döndüğü için takvim saat ipucu (tooltip) tamamen çalışmıyor.
   - `dashboard.js:917, 3121, 3163`: Sağ panel (`#bkActionModal`) açıldığında `#calMainWrap` kaydırılmaya çalışılıyor (`null`).
2. **`#bkRezeptartGroup` ve `#bkHeilmittelBlock` (`#bookingModal` içinde `#bkVerordnungSection` ile değiştirildi):**
   - `handleRxSessionDropToModal` (`dashboard.js:2541-2544`) hâlâ eski `#bkRezeptartGroup` ve `#bkHeilmittelBlock` ID'lerini gizlemeye çalışıyor (`null`).
3. **`#bkPaymentMethod` (`#bookingModal` içinden kaldırıldı):**
   - `dashboard.js:4352` ve `5389` hâlâ `document.getElementById('bkPaymentMethod')` okuyor.
4. **`#calendarEl`, `#calEmpList`, `#calRpUnverga` (`dashboard.html`'den kaldırıldı, JS fonksiyonları ölü kaldı):**
   - `initCalendar` (`dashboard.js:2037-2154`), `renderCalEmpList` (`dashboard.js:1920-1953`, `#calEmpList` yerine `#calEmpChips` geldi) ve `loadCalRpUnverga` (`dashboard.js:3213-3250`, `#calRpUnverga` kaldırıldı) her çağrıda erken dönüyor.
5. **`#rzPruefErgebnis` (`dashboard.html`'de yok):**
   - `module/verordnung-maske.js:168` `document.getElementById('rzPruefErgebnis')` arıyor.

---

### 2.3 `dashboard.html` İçinde Unutulmuş Ölü Bölümler ve WhatsApp Kalıntısı
1. **`#addEmpResultStep` ve WhatsApp Paylaşım Butonu (`dashboard.html:4778-4805`):**
   - Çalışan ekleme akışı `employeeSetupCodeModal`'a geçtiği için `#aeCopyEmailBtn`, `#aeCopyPwBtn`, `#aeCopyLinkBtn` ve `<a id="aeShareWaBtn">Via WhatsApp teilen</a>` (`satır 4800`) tamamen ölü durumda (ve WhatsApp yasağını ihlal ediyor).
2. **`#urlaubSection` (`dashboard.html:763-794`) ve `saveUrlaub` (`dashboard.js:9609-9677`):**
   - İzin yönetimi `#tab-urlaub` (`loadEmpUrlaubSection`) altına taşındı; ancak eski `hidden` `#urlaubSection` DOM bloğu ve `dashboard.js:9609-9677` arasındaki `saveUrlaub` / `loadUrlaubListe` / `deleteUrlaub` fonksiyonları silinmeden bırakılmış.

---

### 2.4 Ortak Modül (`patient-suche.js` & `calendar-widget.js`) Bypass'ları ve Dinleyici Birikmesi (Listener Leak)
- **Grup randevusu hasta arama (`#bkGroupPatientSearch`, `dashboard.js:4208-4280`):** `patient-suche.js` (`attachPatientSearch`) kullanmak yerine kendi özel arama kodunu (`initBkGroupPatientAutocomplete`) yazmış. Üstelik `dataset` koruması olmadığı için `4027`, `4399` ve `4444` satırlarından her çağrıldığında `<input id="bkGroupPatientSearch">` üzerine **yeni bir `'input'` event listener üst üste ekleniyor**.
- **Notizen hasta arama (`#notesPatientInput`, `dashboard.js:12327-12420`), Rechnungen (`#invPatientSelect`, `dashboard.html:1294`) ve Anamnese (`#anamPatientSelect`, `module/anamnese.js:244`):** `patient-suche.js` yerine özel dropdown veya düz `<select>` kullanıyor.
- **`calendar-widget.js` (`mountCalendar`):** Sadece `dashboard.js:19`'da import ediliyor ve yalnız ulaşılamayan `initCalendar()` (`#calendarEl` yok) içinde çağrılıyor; üretimde tamamen ölü durumda.

---

### 2.5 `data-i18n` ↔ `T.de` Sözlük Çakışmaları (`dashboard.html`'deki Yeni Metni Eski Sözlük Eziyor)
- `dashboard.html:381`: Beta-2 tablo tasarımında başlık `<th data-i18n="lead_city">Ort</th>` olarak güncellendi, ancak `dashboard.js:187` içindeki `T.de.lead_city: 'Stadt'` bunu çalışma zamanında tekrar `"Stadt"` yapıyor.
- `dashboard.html:4693`: Modal başlığı `<span id="b2bModalTitle" data-i18n="b2b_add">Neuer Kontakt</span>`, fakat `T.de.b2b_add` (`dashboard.js:202`) buton metni olan `"+ Kontakt"` olduğu için modal başlığını eziyor.
- `dashboard.html:139` (`Bugünkü randevularınız`) ve `dashboard.html:2428` (`Anatomie-Haritas für Patientengespräche`): HTML kaynağında Türkçe/melez metin kalmış.
- `dashboard.js:171-378` içindeki `T.de` sözlüğünde hâlâ eski CRM terimleri (`kunden_sub: 'Leads & Kundeninformationen'`, `leads_empty: 'Noch keine Leads.'`, `lead_modal_edit: 'Lead bearbeiten'`) ve hiç kullanılmayan **83 ölü anahtar** duruyor.

---

### 2.6 Cache-Busting (`?v=YYYYMMDD`) Tutarsızlıkları (Aynı Modül İki Farklı Sürümle Yükleniyor)
Tarayıcı aynı ES modülünü farklı `?v=` parametresiyle gördüğünde **iki ayrı modül örneği (instance)** olarak indirip çalıştırır:
- `module/termin-nicht-erschienen.js`: `dashboard.js:62` `?v=20261027p` kullanırken `kalender.js:6` `?v=20260914` kullanıyor.
- `module/kalender-raster.js`: `dashboard.js:115` `?v=20261021p` kullanırken `kalender.js:7` `?v=20260928` kullanıyor.
- `module/ueber.js`: `module/termin-rechtstexte.js:15` `?v=20261009k15` kullanırken `login.js:4`, `employee-signup.html:441`, `confirm.html:139`, `ueber.html:99` `?v=20261008` kullanıyor.
- `cookie-consent.js`: 14 sayfada `?v=20261021widerruf3` iken `pvs-heilmittelerbringer.html:1181` içinde `?v=20260829` kalmış.
- Ayrıca 26–30.10.2026'da değiştirilen modüllerin (`patienten-import.js`, `verordnung-import.js`, `booking-status-korrektur.js`, `verordnung-liste.js`, `verordnung-detail.js`, `rezept-in-maske.js`, `termin-aktionen.js`, `datev-einstellungen.js`, `arzt-register.js`, `fax-deckblatt.js`, `termin-folge.js`, `therapiebericht.js`) import satırlarındaki `?v=` tarihleri eski kalmış.

---

### 2.7 Kuşatma Sonrası `dashboard.js` ve `module/*.js` İçinde Unutulan Ölü Importlar ve Kopya Fonksiyonlar
- **`dashboard.js` içinde import edilip hiç kullanılmayan 8 sembol:**
  - `searchHeilmittel`, `heilmittelOptionsHtml` (`satır 20`) · `statusBadge as abrStatusBadge` (`satır 47`) · `belegnummerRosette` (`satır 72`) · `zuzahlungFuerRezept` (`satır 79`) · `leistungOptionen` (`satır 84`) · `ZAHLARTEN` (`satır 88`) · `rechnungButtonHtml` (`satır 90`) · `terminZeitLabel` (`satır 115`).
- **`dashboard.js` içinde 0 çağrılı ölü fonksiyonlar (~250 satır):**
  - `loadBeispielmodus_SVG` (`12132-12311`, 180 satırlık eski SVG haritası, `loadBeispielmodus` ile değiştirildi), `closeCalRightPanel` (`3158-3165`, `closeBkActionPanel` kopyası), `seedDefaultVorlagen` (`11888-11892`), `buildVorlagenPreview` (`11374-11379`), `shiftColorForTime` (`1130-1137`), `getActiveBusinessId` (`14540-14542`), `_binStrToUint8` (`15316-15320`).
- **Modüller arası birebir kopya fonksiyon/sabitler:**
  - `erstePositionAusItems` ve `heilmittelAusItems`: Hem `module/verordnung-pruefung.js:440-460` hem `module/verordnung-maske.js:401-420` içinde tanımlı.
  - `pruefTitel`: Hem `module/verordnung-liste.js:210` hem `module/verordnung-uebersicht.js:512` içinde tanımlı.
  - `LANR_ERSATZWERT`: Hem `module/lanr-pruefung.js:14` hem `module/podo-arztangaben.js:22` içinde export ediliyor.
  - `STANDARD_DAUER_MIN`: Hem `module/termin-dauer.js:44` hem `module/termin-leistungen.js:42` içinde export ediliyor.

---

## 🔌 BÖLÜM 3: Backend'de Yazılmış Ama Frontend'e Bağlanmamış (veya Bypass Edilen) Uçlar

1. **Frontend'in Backend Validasyonunu Bypass Edip Doğrudan DB'ye Yazdığı Akış — `warteliste`:**
   - `api-backend/billing/api/warteliste.routes.js:86, 121, 254` içinde tenant doğrulamalı (`validateLead`, `validateAuthenticatedService`) ve yalnız `owner` silme yetkili (`satır 260`) `GET / POST / DELETE /api/warteliste` uçları yazılmış.
   - Ancak `dashboard.js:16694, 16747, 16872, 16885` bu uçları hiç çağırmayıp doğrudan `supabase.from('warteliste')` kullanıyor! Üstelik RLS'te `warteliste_employee_all` (`FOR ALL`) açık olduğu için backend'in "yalnız owner silebilir" kuralı da bypass ediliyor.
2. **Backend'de Tamamlanmış Ama Frontend'de Hiç Çağrılmayan (0 Caller) Yeni Uçlar:**
   - `POST /api/billing/abrechnung/zuzahlungsforderung` (`api-backend/billing/api/zuzahlungsforderung.routes.js:154` — 1.582 satırlık §302 VKZ 03 modülü, frontend'de butonu/çağrısı yok).
   - `POST /api/billing/abrechnung/:id/artefakte/:versionId/ausmustern-wiederholen` (`api-backend/billing/api/abrechnung.routes.js:1383` — `module/abrechnung-artefakte.js` içinde çağrılmıyor).
   - `GET /api/billing/verordnung/abrechnungsstatus/uebersicht` (`api-backend/billing/api/verordnung-status.routes.js:366` — yorumunda *"die Filterleiste der Patientenliste haengt daran"* yazıyor ama frontend hiç çağırmıyor).
   - `POST /api/billing/abrechnung/preflight` (`api-backend/billing/api/abrechnung.routes.js:3550`).

---

## 🧪 BÖLÜM 4: Test Paketi, Paket Sürümleri ve Windows/macOS Ortam Kopuklukları

1. **Kök `package.json` vs `api-backend/package.json` `@sentry/node` Sürüm Çatışması (`npm test` Kırılıyor):**
   - `ee953e47` commit'inde (`fix(deps): @sentry/node 10.76.2 statt 11.9 — Lizenztor blockierte das api-Image`) `api-backend/package.json:18` içinde `@sentry/node` `10.76.2`'ye geri çekildi.
   - Ancak kök `package.json:19` içinde `"@sentry/node": "11.9.0"` unutuldu!
   - `@sentry/node` v11'de `Scope.prototype.clear()` kaldırıldığı için `tools/serverless-telemetry.test.js:57` (`global.clear(); isolated.clear();`) `TypeError: global.clear is not a function` hatasıyla patlıyor.
2. **`package.json` İçinde `test:merkez` Unutulmuş:**
   - `package.json:10-14`: `"test": "npm run test:frontend && npm run test:backend && npm run test:tools"` satırına `"test:merkez"` eklenmemiş; `npm test` çalıştığında 107 merkez testi hiç koşmuyor.
3. **`api-backend/package.json` Başlatma Scripti Eski:**
   - `CLAUDE.md:220` ve `api-backend/Dockerfile` `node start.mjs` (cluster worker) kullanırken `api-backend/package.json:8` hâlâ `"start": "node server.js"` diyor.
4. **`tools/onprem-readiness.test.js` Windows Path Hatası:**
   - `tools/onprem-readiness.test.js:8` `new URL('../onprem/lib-health.sh', import.meta.url).pathname` kullanıyor. Windows'ta boşluklu kullanıcı adında (`Kemal Demir`) bu ifade `'C:\C:\Users\Kemal%20Demir\...'` üretip `ENOENT` ile kırılıyor (`fileURLToPath` kullanılmalı).

---

## 🛡️ BÖLÜM 5: Yayın Yüzeyi (`.vercelignore`), Fiyatlandırma, Marka ve UWG İhlalleri

### 5.1 `.vercelignore` Delikleri (`praxura.de` Üzerinden Dışarı Sızan Dosyalar)
`CLAUDE.md:201-204` yayın yüzeyi kuralına rağmen şu klasör ve dosyalar `.vercelignore` içinde **yok** ve her deploy'da `praxura.de` statik sunucusuna yükleniyor:
1. **`ops/` klasörü (KRİTİK):** Ayrı bir proje olan Ops-Dashboard'un tüm `.js`, `.html`, `.css`, `.json` dosyaları (`ops/config.js`, `ops/ingest/*.json`, `ops/n8n-finance-invoice-workflow.json`, `ops/board.js`) `.vercelignore`'da listelenmemiş (`vercel.json`'daki redirect sadece `/ops/*` yolunu yönlendirir ama kaynak paketinde durur; `.vercelignore`'a `ops/` eklenmelidir).
2. **`dev_server.cjs`, `stripe-live-setup.cjs`, `package.json`, `package-lock.json`:** `.vercelignore`'da `*.cjs` kuralı yok; `praxura.de/stripe-live-setup.cjs` ve `praxura.de/dev_server.cjs` doğrudan indirilebilir durumda!
3. **`komponenten.html`, `dashboard-vorschau.html`, `demo-dashboard.html`:** Geliştirici/iç sayfalar `.vercelignore`'da değil. (Ayrıca `komponenten.html:678` `dashboard.js` içinden silinmiş olan `fmtEur` fonksiyonunu çekmeye çalıştığı için tarayıcıda kırılıyor ve `komponenten.html:340-425` silinmiş `podNewIcd10` alanını anlatıyor.)
4. **`sql-codex/`, `docs/`, `updates_todos/`:** Kök dizinde takip edilen bu klasörler ne `.vercelignore`'da ne de `CLAUDE.md` klasör tablosunda kayıtlı.

---

### 5.2 Fiyatlandırma ("Fiyat Henüz Belirlenmedi"), OCR ve §5 UWG Pazarlama Çelişkileri
1. **`onboarding.html` Canlıda Eski SaaS Fiyatlarını ve Kapalı OCR'ı Gösteriyor:**
   - `CLAUDE.md:36, 55, 267` kurallarına (*"Fiyat henüz belirlenmedi"*, *"SaaS satılmaz"*, *"Rezept OCR kapalı: 503 AI_OCR_DISABLED"*) rağmen `onboarding.html:325-369` canlıda **29 € / 49 € / 99 €** paketlerini ve *"KI-Rezeptprüfung (OCR)"* maddesini (`satır 346`) gösteriyor.
   - Aynı tablo `index.html:1800-1911` içinde HTML yorum satırı (`<!-- PREISE VORÜBERGEHEND AUSGEBLENDET -->`) içinde sayfa kaynağında duruyor.
2. **Blog Sayfasında §5 UWG İhlali (`konsey/KARARLAR.md:38` Kararına Rağmen Kalan İfade):**
   - `blog/praxissoftware-vergleich-physiotherapie-2026.html:174` içinde hâlâ `"eVO-Annahme, KIM-Postfach, ePA-Anbindung, eHBA-Signatur eingebaut."` yazıyor (aynı sayfanın 327. satırında *"Geplant"* denmesine rağmen 174. satır unutulmuş).

---

## 📚 BÖLÜM 6: Dokümantasyon ve Kurumsal Hafıza (`AGENTS.md`, `CLAUDE.md`, `REGISTER.md`) Kopuklukları

### 6.1 `AGENTS.md` Tam 51 Gün Geride Kalmış (`09.09.2026` vs `30.10.2026`)
Codex ve Antigravity (`agy` worker'ları dahil) projeyi açtığında otomatik olarak `AGENTS.md` dosyasını okuyor. Ancak `AGENTS.md` **09.09.2026** tarihinde donmuş ve `CLAUDE.md` ile tamamen çelişiyor:
- `AGENTS.md` hâlâ *"Starter 29 € · Professional 49 € · Klinik 99 € — TEK GEÇERLİ SET"* diyor (`CLAUDE.md`: *"FİYAT HENÜZ BELİRLENMEDİ"*).
- `AGENTS.md` hâlâ *"i18n: üç dili de (de / en / tr) güncelle"* diyor (`CLAUDE.md`: *"Ürün yalnız Almanca, en/tr sözlükleri kalktı"*).
- `AGENTS.md` hâlâ `api/dsgvo.js` dosyasının var olduğunu söylüyor (`api-backend/dsgvo/klassifikation.js`'e taşındı).
- `AGENTS.md` içinde `api-backend/db/migrations/` çalıştırılabilir migration zinciri kuralı (10.09.2026), `PUBLIC_API_BASE` ve `SETUP_TOKEN` env tuzakları, `ki-gateway.js` / `AI_OCR_DISABLED`, `merkez/`, `installieren/`, `Physio/`, `canli-test/`, `fonksiyon-ustasi` / `physio` / `mentor` ajanları **hiç yok**.
- **Çözüm:** `AGENTS.md`, `CLAUDE.md` ile birebir senkronize edilmeli.

### 6.2 `CLAUDE.md` ve Sicil Dosyalarındaki (`db/`, `onprem/`, `fortschritte/`) Güncel Kopukluklar
1. **`CLAUDE.md` vs `Physio/PILOT-PLAN.md` (30.10.2026 kararları ve K4 `0f3bf0c0`):**
   - `CLAUDE.md:545-548` hâlâ *"Önce Podoloji, uçtan uca bitene kadar. Bir alanın ince ayarı bitmeden o alanda müşteri alınmaz"* diyor; oysa 30.10.2026'da `Physio/PILOT-PLAN.md:21` ile **P1 Physio pilot istisnası** başladı.
   - `CLAUDE.md:58` hâlâ *"Jeton modu yazıldı ama AÇILMADI — O-169"* diyor; `Physio/PILOT-PLAN.md:22, 52` ve `0f3bf0c0` commit'i ile kutuda KI (Jeton + Freitext + Mail-Assistent) açıldı.
   - `CLAUDE.md` klasör ağacında Ekim ayında eklenen `widget/`, `sosyal/`, `redesign/` klasörleri ve `pvs-heilmittelerbringer.html` sayfası yok.
2. **`db/REGISTER.md` (`satır 13`) ve `db/README.md` (`satır 18`):**
   - `db/REGISTER.md:13` başlığı hâlâ `Stand: 2026-10-11 · 96/96 Tabellen (letzte Migration 0078)` diyor (gerçekte `97/97` tablo ve son migration `0090_physio_kg_zns_zertifikat`).
   - `0088_datev_einstellungen.sql` (`profiles.datev_einstellungen`) `db/REGISTER.md` içinde hiç işlenmemiş.
   - `db/README.md:18, 249-253` hâlâ son migration olarak `0080` ve eski taslak isimlerini gösteriyor.
   - `sql-melih/OFFEN.md` içindeki 4 SQL de canlı şemaya uygulanmış durumda ama `OFFEN.md` güncellenmemiş.
3. **`onprem/REGISTER.md` (`satır 19`):**
   - Satır 19'daki "Buradan devam" özeti `20.09.2026`'da kalmış, §9 sayımı `O-204` diyor (dosya sonunda `O-225`'e ulaştı).
4. **`fortschritte/` "Bir Gün = Bir Dosya" Kuralı İhlali:**
   - `2026-10-05_M1_CLAUDE_HANDOFF.md`, `2026-10-06_M2_LIVE_ABNAHME.md` ve `2026-10-07-M3-ABNAHME.md` aynı günlerin ana dosyalarının yanında ikinci dosya olarak duruyor.
