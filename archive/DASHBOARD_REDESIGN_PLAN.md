# InfinityMade — Unified Dashboard Yeniden Yapılanması

> Oluşturulma: 2026-05-10 | Durum: Planlandı, henüz uygulanmadı

---

## 🎯 Hedef

Şu an iki ayrı sayfa olarak çalışan `dashboard.html` ve `kalender.html` tek bir
unified dashboard'a birleştirilecek. Kullanıcı login olduktan sonra her şeyi tek
sayfadan yönetebilecek, sayfa yenilemesi olmayacak.

---

## 📁 Etkilenen Dosyalar

| Dosya | İşlem | Açıklama |
|-------|--------|----------|
| `dashboard.html` | **SIFIRDAN YAZ** | Tüm 8 panel bu dosyada |
| `dashboard.css` | **SIFIRDAN YAZ** | Unified dark theme |
| `dashboard.js` | **SIFIRDAN YAZ** | Tüm logic, FullCalendar dahil |
| `kalender.html` | **DOKUNMA** | Yedek olarak kalır |
| `kalender.js` | **DOKUNMA** | Yedek olarak kalır |
| `login.html` | **DOKUNMA** | Değişmez |
| `supabase-config.js` | **DOKUNMA** | Değişmez |

---

## 🗂️ Sidebar Menüsü — Friseur Sektörü

Sidebar her zaman sabit sol tarafta (260px). Mobilde/tablette hamburger menüye dönüşür.
Sektöre göre gösterilen menü öğeleri değişir — bu önce Friseur için yapılır.

| # | İkon | Label | Kimin Görür | Açıklama |
|---|------|-------|-------------|----------|
| 1 | 🏠 | Übersicht | owner + employee | KPI kartları, bugünkü randevular |
| 2 | 📅 | Kalender | owner + employee | FullCalendar gömülü |
| 3 | 👥 | Kunden Info | owner + employee | Müşteri listesi (eski: Leads) |
| 4 | ✂️ | Dienstleistungen | owner only | Hizmet yönetimi |
| 5 | ⏰ | Arbeitszeiten | owner + employee | Çalışma saatleri |
| 6 | 👤 | Mitarbeiter | owner only | Çalışan yönetimi |
| 7 | 🤝 | B2B | owner only | İşletmeler arası iletişim + AI şablonu |
| 8 | ⚙️ | Einstellungen | owner + employee | Profil, şifre, abonelik |

---

## 📋 Panel Detayları

### Panel 1: Übersicht
- 4 KPI kart: Bugünkü Randevular / Haftalık Gelir / Aktif Müşteriler / WhatsApp Mesajları
- "Heute" bölümü: bugünkü randevuların kompakt listesi (saat, müşteri, hizmet, personel)
- WhatsApp bot durum özeti (aktif/pasif, son 7 gün istatistik)
- Stripe plan bilgisi + trial/pastdue banner (mevcut koddan korunur)
- Supabase: `bookings`, `profiles` tabloları

---

### Panel 2: Kalender

#### Görünüm Kontrolleri
- `Mein Kalender` — sadece giriş yapan kişinin takvimi
- `Gesamtes Team` — tüm çalışanlar FullCalendar `resourceTimeGridDay` ile yan yana
- `Mitarbeiter wählen` — dropdown ile tek çalışan seç, onun takvimini göster

#### Gün Tıklama Davranışı (YENİ)
Şu anki davranış: Gün tıklanınca direkt "Neuer Termin" modalı açılıyor.
Yeni davranış:
1. Aylık görünümde bir güne tıklanınca sağ tarafta **Slot Panel** kayar
2. Slot Panel içeriği:
   - Seçili tarihin başlığı (örn. "Mittwoch, 14. Mai")
   - Dolu slotlar (kırmızı): saat - müşteri adı - hizmet
   - Boş slotlar (yeşil): saat aralığı "Verfügbar"
   - En altta: `+ Neuer Termin` butonu → bu butona tıklayınca manuel booking modalı açılır
3. Haftalık/günlük görünümde sürükle-seç davranışı aynı kalır

#### Diğer Butonlar
- `+ Neuer Termin` (header'da) → direkt manual booking modal
- `Abwesenheit eintragen` → tatil/izin modal

#### Supabase
`bookings`, `time_offs`, `services`, `profiles` — mevcut kod `kalender.js`'den taşınır

---

### Panel 3: Kunden Info (eski adı: Leads)
- Tablo: Ad Soyad | Telefon | E-Mail | Son Randevu | Toplam Randevu | Durum
- Filtreler: Alle / Aktiv / Inaktiv / Neu
- `+ Neuer Kunde` butonu → modal (ad, telefon, e-mail, notlar)
- Müşteri satırına tıklayınca detay modal: geçmiş randevular, notlar, düzenle/sil
- CSV/JSON import (mevcut kod korunur)
- Supabase: `leads` tablosu (mevcut şema değişmez)

---

### Panel 4: Dienstleistungen
- Mevcut hizmetlerin kart grid'i: Ad | Süre | Fiyat | Hangi personeller sunar
- `+ Neue Dienstleistung` formu:
  - Hizmet adı (text)
  - Süre (dk) + Fiyat (€)
  - Checkbox: Hangi personeller sunar?
- Her kartta: Düzenle / Sil butonları
- **Mevcut `kalender.js` `loadServices()` + `form-service` kodu buraya taşınır**
- Supabase: `services`, `employee_services`

---

### Panel 5: Arbeitszeiten
- Pazartesi → Pazar: her gün için
  - Aktif/Pasif toggle (checkbox)
  - Açılış saati (time input)
  - Kapanış saati (time input)
- Kaydet butonu
- **Owner iken:** varsayılan olarak kendi saatlerini görür, üstte dropdown ile çalışan seçip onun saatlerini de düzenleyebilir
- **Employee iken:** sadece kendi saatlerini görür
- **Mevcut `kalender.js` `loadHours()` + `btn-save-hours` kodu buraya taşınır**
- Supabase: `working_hours`

---

### Panel 6: Mitarbeiter (owner only)
- Çalışan listesi: Avatar (initials) | Ad | Rol | Durum
- `Mitarbeiter einladen` butonu → company_code gösterir
- Bir çalışana tıklanınca **çalışan detay görünümü** açılır:
  - Üst: ad, e-mail, rol bilgisi
  - **Arbeitszeiten** sekmesi: o çalışanın saatlerini düzenle + kaydet
  - **Urlaub** sekmesi:
    - Tatil ekle formu (başlangıç, bitiş, sebep)
    - Mevcut tatil listesi (sil butonu ile)
  - **Termine** sekmesi: o çalışanın yaklaşan randevuları (kompakt liste)
- Supabase: `profiles`, `working_hours`, `time_offs`, `bookings`

---

### Panel 7: B2B (owner only)

**Sol/Üst: İşletme Listesi (tablo)**
- Kolonnlar: Ad | Kategori | Stadt | E-Mail | Telefon | Status
- Filtreler: Alle / Kontaktiert / Interessiert / Partner
- `+ Neues Unternehmen` butonu → modal (ad, kategori, şehir, e-mail, telefon, notlar)
- Satıra tıkla → detay modal
- Supabase: `b2b_contacts` tablosu (YENİ — migration gerekir)

**Sağ/Alt: AI Chatbot Şablonu (görsel)**
- Chat arayüzü (balon tasarımı)
- Input alanı: "Schreiben Sie einen Auftrag an eine Firma..."
- Statik örnek konuşma gösterilir:
  - Kullanıcı: "Schreibe eine E-Mail an Friseurbedarf Müller, wir brauchen 50 Stück XY-Shampoo"
  - AI: "✅ E-Mail erstellt — Bitte überprüfen Sie sie: [e-mail önizlemesi]"
  - Butonlar: `E-Mail senden` | `Bearbeiten`
- **Suan gerçek AI entegrasyonu yok** — şablon/görsel hazır, backend sonra bağlanır

---

### Panel 8: Einstellungen
Mevcut koddan korunur + küçük iyileştirmeler:
- Profil: İşletme adı, dil seçimi
- Şifre değiştir
- Hesap bilgisi (e-mail, plan)
- Abonelik yönetimi (Stripe portal)
- Görünüm: Karanlık / Aydınlık / Sistem
- Google Calendar bağlantısı (mevcut `loadIntegrations()` kodu buraya taşınır)

---

## 🗃️ Supabase — Gerekli Değişiklikler

### Yeni Tablo (tek yeni şey)
```sql
-- B2B işletme rehberi
CREATE TABLE b2b_contacts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id    UUID REFERENCES auth.users NOT NULL,
  name        TEXT NOT NULL,
  category    TEXT,
  city        TEXT,
  email       TEXT,
  phone       TEXT,
  website     TEXT,
  status      TEXT DEFAULT 'new' CHECK (status IN ('new','contacted','interested','partner')),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE b2b_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON b2b_contacts
  FOR ALL USING (auth.uid() = owner_id);
```

### Mevcut Tablolar (değişmez)
`profiles`, `bookings`, `services`, `employee_services`,
`working_hours`, `time_offs`, `leads`, `calendar_integrations`

---

## 🎨 Tasarım Sistemi

```css
/* Renkler */
--bg-main:     #0f1115;
--bg-card:     rgba(25, 28, 36, 0.6);
--bg-sidebar:  rgba(15, 17, 21, 0.9);
--primary:     #22c55e;
--primary-dim: rgba(34, 197, 94, 0.15);
--text-main:   #f8fafc;
--text-muted:  #94a3b8;
--border:      rgba(255, 255, 255, 0.08);
--danger:      #ef4444;
--radius:      14px;

/* Font */
font-family: 'Inter', sans-serif; /* CDN'den */

/* Layout */
Sidebar: 260px sabit (desktop)
Topbar: 60px yükseklik
Main: kalan alan, overflow-y: auto
```

### Responsive Breakpoints
| Ekran | Sidebar | Layout |
|-------|---------|--------|
| > 1024px (Desktop) | 260px sabit | Yan yana |
| 768px–1024px (Tablet) | Collapsible (hamburger) | Yan yana, sidebar overlay |
| < 768px (Mobil) | Gizli, hamburger menü | Tek kolon |

---

## 🔄 Mevcut Koddan Taşınacaklar

| Mevcut Konum | Yeni Konum | Ne |
|---|---|---|
| `kalender.js` → `initCalendar()` | `dashboard.js` → `initCalendar()` | FullCalendar init |
| `kalender.js` → `loadTeam()` | `dashboard.js` → `loadTeam()` | Ekip yükleme |
| `kalender.js` → `loadServices()` | `dashboard.js` → `loadServices()` | Hizmetler |
| `kalender.js` → `loadHours()` | `dashboard.js` → `loadHours()` | Çalışma saatleri |
| `kalender.js` → `loadIntegrations()` | `dashboard.js` → `loadIntegrations()` | Google Cal |
| `dashboard.js` → `loadLeads()` | `dashboard.js` → aynı kalır | Kunden Info |
| `dashboard.js` → `handleCsvFile()` | `dashboard.js` → aynı kalır | CSV import |
| `dashboard.js` → Stripe logic | `dashboard.js` → aynı kalır | Abonelik |
| `dashboard.js` → `PLAN_FEATURES` | `dashboard.js` → aynı kalır | Plan listesi |

---

## 📐 Uygulama Sırası

1. **`dashboard.css`** yaz — design tokens, sidebar, topbar, paneller, responsive
2. **`dashboard.html`** yaz — tüm panel HTML + modaller
3. **`dashboard.js`** yaz — auth guard + tüm logic birleştirilmiş
4. **Supabase SQL** çalıştır — `b2b_contacts` tablosu
5. **Test** — tüm paneller, responsive, FullCalendar, slot panel davranışı

---

## ⚠️ Önemli Notlar

- `kalender.html` ve `kalender.js` **silinmez**, yedek kalır
- Frontend'den `kalender.html`'e link kalmaz (dashboard içinden erişilir)
- B2B panelde şimdilik **gerçek AI yok** — UI şablonu hazır, n8n entegrasyonu sonra
- Tüm API çağrıları `https://n8n.infinitymade.de/api` base URL kullanır
- Timezone: `Europe/Berlin` (mevcut kodda zaten var)
- FullCalendar Scheduler CDN: `cdn.jsdelivr.net/npm/fullcalendar-scheduler@6.1.11`

---

*Son güncelleme: 2026-05-10 | Hazırlayan: Antigravity*
