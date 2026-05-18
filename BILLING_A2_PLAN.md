# § 302 SGB V Direct Billing — Faz A2 Sprint Planı

> **Bu doküman yeni session'da projenin başlangıç noktası.**
> Karar: Faz A2 (manuel upload, ITSG onayı yok). Faz B uzun vade ertelendi (sorumluluk + maliyet uçurum).
> Önceki context: `memory/project_infinitymade_billing_a2.md`

---

## 0. Hedef ve Sınırlar

**Yapılacak:** Fizyoterapistler için Krankenkasse'lara doğrudan faturalandırma — DTA EDIFACT dosyası üreten, müşterinin manuel olarak Datenannahmestelle portal'ına yüklediği yarı-otomatik sistem.

**Yapılmayacak (Faz B):** Sertifika vault, direct DAS submission, ITSG Systemprüfung, otomatik ZAA poll.

**Ticari model:** "DTA-Pro" addon → +29€/ay veya 0.30€/Rezept (hangisi düşükse).

**Sorumluluk:** Cert müşterinin elinde. İmza müşterinin yetkisi. Biz sadece dosya üreticisi + posta evrakı + hata çevirmeni.

---

## 1. Müşteri Akışı (Tek Sayfada)

### Tek seferlik kurulum
1. Müşteri ITSG'den Dakota .p12 sertifikasını alır (~50-100€/yıl, online başvuru, 1-2 hafta)
2. Müşteri InfinityMade dashboard'da "Faturalandırma → Sertifika" sayfasına .p12'yi yükler (PIN ile birlikte, sadece browser memory'de kalır, server'a şifresiz iletilmez)
3. Müşteri ilgili DAS portal'larına kayıt olur (Davaso, DDG, Bitmarck — hangi sigortalarla çalışıyorsa)

### Haftalık/aylık döngü
1. Hasta gelir → reçete fotoğraflanır → AI OCR doldurur (zaten var)
2. Seanslar yapılır, hasta her seans için reçete arkasına imza atar
3. Tüm seanslar bittiğinde reçete "Abrechnungsbereit"
4. Dashboard → "Abrechnung" → bu dönem hazır reçeteleri seç → "Faturayı Oluştur"
5. Sistem 3 çıktı üretir:
   - `rechnung_YYYY_KKWW.dta.p7m` (şifrelenmiş EDIFACT, müşteri cert'iyle imzalı)
   - `begleitzettel_KKWW.pdf` (posta refakat belgesi)
   - `zuzahlungsrechnung_<hasta>.pdf` (varsa hasta katkı payı faturası)
6. Müşteri `.dta.p7m`'i indirir → DAS portal'ına manuel upload
7. Müşteri imzalı kağıt reçeteleri + Begleitzettel'i postala
8. 2-7 gün sonra portal'dan ZAA cevabını indir → InfinityMade'e yükle → hata varsa düzelt
9. 2-4 hafta sonra para terapistin hesabına

---

## 2. Veritabanı Şeması (yeni tablolar)

```sql
-- Krankenkasse + Datenannahmestelle haritası (haftalık ITSG güncelleme)
public.kostentraeger (
  ik          text primary key,        -- 9 haneli Institutionskennzeichen
  name        text not null,
  das_ik      text,                    -- bağlı olduğu Datenannahmestelle IK
  payer_type  text,                    -- 'gkv' | 'sonst' | 'privat'
  region      text,
  active      boolean default true,
  valid_from  date,
  valid_to    date,
  updated_at  timestamptz default now()
)

-- Heilmittel Tarif tablosu (Bundesland × Krankenkasse × Heilmittel-Positionsnummer)
public.heilmittel_tarif (
  id             bigserial primary key,
  bundesland     text not null,         -- 'NW', 'BY', vs.
  kostentraeger_ik text references kostentraeger(ik),
  position_nr    text not null,         -- '1021', '1010', vs.
  heilmittel_code text,                 -- 'KG', 'MT', 'MLD'
  preis_eur      numeric(10,2),
  zuzahlung_pflicht boolean default true,
  gueltig_ab     date,
  gueltig_bis    date
)

-- Müşteri Dakota sertifika public bilgisi (private key müşteride, biz sadece public + IK saklarız)
public.terapeut_zertifikat (
  owner_id       uuid primary key references profiles(id),
  ik_nummer      text not null,         -- terapistin kendi IK'sı
  cert_subject   text,                  -- public subject info
  cert_valid_to  date,
  cert_thumbprint text,                 -- doğrulama için
  uploaded_at    timestamptz default now()
)

-- Reçete + faturalandırma durumu (mevcut referral_drafts üzerine inşa)
public.verordnung (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references profiles(id),
  patient_id      uuid references patients(id),
  doctor_lanr     text,
  doctor_bsnr     text,
  ausstellungsdatum date,
  icd10           text,
  diagnosegruppe  text,
  heilmittel      text,
  heilmittel_position text,             -- tarif'ten lookup
  anzahl_einheiten int,
  is_blanko       boolean default false,
  is_lhb_bvb      boolean default false,
  is_dringend     boolean default false,
  hausbesuch      boolean default false,
  zuzahlung_eur   numeric(10,2),
  zuzahlung_befreit boolean default false,
  status          text default 'in_behandlung',  -- in_behandlung | bereit | in_abrechnung | gesendet | accepted | rejected | paid
  abrechnung_id   uuid references abrechnung(id),
  created_at      timestamptz default now()
)

-- Bir submission batch = bir DTA dosyası
public.abrechnung (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references profiles(id),
  kostentraeger_ik text not null,
  dateiname       text,                  -- 'EHK1234500000023'
  rechnungsnummer text,                  -- 'R2026-W20-001'
  total_eur       numeric(10,2),
  zuzahlung_total numeric(10,2),
  status          text default 'erstellt',  -- erstellt | heruntergeladen | gesendet | accepted | rejected | paid
  dta_file_size   int,
  dta_segment_count int,
  rejected_count  int default 0,
  zaa_uploaded_at timestamptz,
  created_at      timestamptz default now()
)

-- ZAA hata kayıtları (her reddedilen reçete bir satır)
public.zaa_fehler (
  id              bigserial primary key,
  abrechnung_id   uuid references abrechnung(id),
  verordnung_id   uuid references verordnung(id),
  fehler_code     text,                  -- '04', '101', vs.
  fehler_text     text,                  -- standart ITSG hata mesajı
  uebersetzung    text,                  -- bizim anlaşılır türkçe/almanca çevirimiz
  loesung_hint    text,                  -- "ICD-10 kodu eksik, hasta dosyasından ekleyin"
  status          text default 'offen',
  created_at      timestamptz default now()
)

-- Hasta katkı payı muafiyet kaydı (her takvim yılı için)
public.zuzahlung_befreiung (
  id              bigserial primary key,
  patient_id      uuid references patients(id),
  jahr            int,
  befreit_ab      date,
  beleg_url       text,
  created_at      timestamptz default now()
)
```

---

## 3. Modül / Dosya Listesi

```
api-backend/
├── billing/                    ← yeni klasör
│   ├── dta/
│   │   ├── builder.js          DTA dosya üretici (segment-by-segment)
│   │   ├── segments.js         SLGA, SLLA, SLEZ, SLAU, SLEK segment definisyonları
│   │   ├── encoding.js         EDIFACT karakter setı + escape kuralları
│   │   └── filename.js         EHK / EHM dosya isimlendirme (KSTR-ID + cycle)
│   ├── crypto/
│   │   ├── pkcs7.js            PKCS#7 signed-and-encrypted dosya üretimi
│   │   └── browser-sign.js     Browser-side imzalama yardımcısı (cert browser'da)
│   ├── kostentraeger/
│   │   ├── parser.js           Kostenträgerdatei (KOTR) parser
│   │   └── updater.cron.js     Haftalık ITSG'den indirip DB güncelleyici
│   ├── tarif/
│   │   ├── lookup.js           Bundesland + IK + Heilmittel → Preis lookup
│   │   └── seed.sql            Başlangıç tarif tablosu (NRW + sık sigortalar)
│   ├── zuzahlung/
│   │   ├── calculator.js       %10 + 10€ + muafiyet kontrolü
│   │   └── rechnung.pdf.js     Hasta katkı payı faturası PDF
│   ├── begleitzettel/
│   │   └── builder.pdf.js      Posta refakat belgesi PDF
│   ├── zaa/
│   │   ├── parser.js           ZAA hata dosyası parser
│   │   └── error-translations.js Hata kodu → anlaşılır metin sözlük (~100 kod)
│   └── api/
│       ├── verordnung.routes.js
│       ├── abrechnung.routes.js
│       └── zaa.routes.js

website/
├── dashboard.html              ← yeni "Abrechnung" sekmesi
├── abrechnung.js               ← yeni
├── verordnung-modal.js         ← reçete detay/düzenleme
└── zaa-upload.js               ← ZAA dosya yükleyici + hata UI
```

---

## 4. Sprint Planı (12 Hafta MVP)

### Sprint 1-2: Veri katmanı + dosya generator iskeleti
- Supabase migration: yukarıdaki 6 tablo
- `dta/segments.js`: SLGA + SLLA + SLEZ segment definisyonları (referans: GKV Spitzenverband § 302 Technische Anlage)
- `dta/builder.js`: ilk geçerli dosya (sahte veriyle, byte-exact format)
- Test: GKV test araçlarıyla syntax doğrulama (`dakota-pruef` veya AOK test portal)

### Sprint 3-4: Kostenträger + Tarif
- ITSG Kostenträgerdatei indirilen ve parse edilen cron
- Tarif tablosu seed (NRW + en sık 10 Krankenkasse — AOK, TK, Barmer, DAK, IKK, KKH, hkk, Knappschaft, Hanseatische, Securvita)
- `tarif/lookup.js` test edilir
- Admin UI: "Tarif tablosu yönet" (geç gelen güncellemeler manuel ekleme)

### Sprint 5-6: Verordnung modülü + Zuzahlung
- Verordnung CRUD API (mevcut referral_drafts'tan migrasyon scripti)
- OCR sonucunu Verordnung tablosuna kaydetme (mevcut workflow güncellemesi)
- Zuzahlung calculator + muafiyet kayıt UI
- Zuzahlungsrechnung PDF (puppeteer veya pdfkit)
- Patient details ekranında "Befreiung yükle" alanı

### Sprint 7-8: Abrechnung kullanıcı akışı
- Dashboard "Abrechnung" sekmesi
- Hazır reçeteleri listele, seç, "Fatura Oluştur" butonu
- DTA dosyası üretimi + Begleitzettel PDF
- İndirme linkleri + müşteriye DAS portal talimatları
- Cert yükleme akışı (client-side PKCS#12 parse, sadece imzalama için kullanılır, key server'a gitmez)

### Sprint 9-10: PKCS#7 şifreleme + ZAA döngüsü
- Browser-side imzalama (Web Crypto API + node-forge fallback)
- .dta.p7m oluştur ve indir
- ZAA dosyası upload + parser
- Hata kodları sözlüğü (en az 50 kod ile başla)
- Reddedilen reçeteleri "Düzelt" UI'yle yeniden işleme

### Sprint 11: DTA-Pro ticari paketleme
- Stripe addon: +29€/ay
- Plan UI'da gözükür yapma
- Onboarding'de "DTA-Pro aktif et" akışı
- Rate limit: aylık 0 reçete = 0€ (paket bedavaya hazır)

### Sprint 12: Test + Pilot
- 3 pilot terapistle gerçek DTA üretip portal upload testleri
- ZAA hata yönetimi gerçek veriyle stres testi
- Belgelendirme + müşteri rehberi (Dakota cert alma + DAS portal kayıt)
- Production launch

---

## 5. Kritik Referans Kaynaklar

- **GKV Spitzenverband § 302 Technische Anlage** — DTA dosya formatı resmi spec (PDF, ~200 sayfa)
- **ITSG Kostenträgerdatei** — https://www.gkv-datenaustausch.de
- **dakota.de** — Dakota sertifika başvuru ve test araçları
- **Datenannahmestellen portalları:**
  - Davaso: https://daten.davaso.de
  - DDG: https://www.ddg.de
  - Bitmarck: https://www.bitmarck.de

---

## 6. Sorumluluk Sınırı (Sözleşmede)

- Müşteri kendi sertifikası ile imzalar → imza geçerliliği müşterinin
- Yazılım sadece dosya hazırlar → içerik doğruluğu müşteri sorumluluğunda (review akışı zorunlu)
- ZAA çevirileri "best effort" — son hata yorumu Krankenkasse'nındır
- ToS güncellemesi: "DTA-Pro modülü için ek koşullar" eklenecek

---

## 7. Yeni Session'da Başlama Komutu

```
Bu projeye başlayalım — BILLING_A2_PLAN.md dosyasını oku ve Sprint 1'den başlayalım.
İlk adım: 6 yeni Supabase tablosu için migration dosyasını hazırla.
```
