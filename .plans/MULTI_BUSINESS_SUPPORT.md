# Çoklu İşletme Desteği, Çalışan Yetkilendirme ve Gelişmiş Takvim Görünümü - Gereksinim Dokümanı

## 📋 Genel Bakış

Bu doküman, mevcut sistemin:
1. **Çoklu işletme (multi-business)** desteğine geçişini
2. **Çalışan grubu bazlı yetkilendirme (Role-Based Access Control - RBAC)** sistemini
3. **Gelişmiş Takvim/Genel Bakış Görünümlerini** (Günlük, Haftalık, Aylık)

tanımlar. Claude Code bu dokümanı okuyarak gerekli değişiklikleri planlayacak ve uygulayacaktır.

---

## 📦 Paket Yapısı ve Özellik Karşılaştırması

| Özellik | Paket 1 (BASIC) | Paket 2 (PRO) | Paket 3 (ENTERPRISE) |
|---------|-----------------|---------------|---------------------|
| İşletme sayısı | **1** | **1** | **Sınırsız** |
| Çalışan sayısı | 1-2 | 1-5 | Sınırsız |
| Çalışan grupları (RBAC) | ✗ | ✗ | **✓** |
| Haftalık/Aylık takvim | ✗ | ✗ | **✓** |
| Çapraz işletme çalışan | ✗ | ✗ | **✓** |
| Faturalandırma | ✓ | ✓ | ✓ |
| Randevu sistemi | ✓ | ✓ | ✓ |
| Hasta yönetimi | ✓ | ✓ | ✓ |

**Önemli Not:** Çoklu işletme desteği, çalışan grupları (RBAC), ve gelişmiş takvim görünümleri **sadece Paket 3 (Enterprise)** için geçerlidir. Paket 1 ve Paket 2'de sadece tek işletme desteği bulunur.

---

## 🔴 Mevcut Durum (Problem)

### Sınırlamalar:
- Her kullanıcı hesabı yalnızca **tek bir işletmeye** bağlı
- `owner_id` sütunu sadece employee'lar için kullanılıyor ve **tek bir owner'a** işaret ediyor
- Bir işletme sahibinin (owner) **birden fazla klinigi/dükkanı** varsa, her biri için ayrı hesap oluşturması gerekiyor
- Fizyoterapist gibi çalışanlar **birden fazla klinikte** çalışabiliyor ama sistem bunu desteklemiyor
- Tüm veriler (randevular, hizmetler, hastalar, faturalar vb.) **hesap düzeyinde** tutuluyor, işletme bazında ayrılmıyor
- Tüm çalışanlar **tüm modülleri** görüyor (dashboard, randevular, notlar, faturalar vb.)
- Owner çalışanların erişimini **modül bazında kısıtlayamıyor**
- **Übersicht sayfası sadece günlük görünüm sunuyor**, haftalık/aylık görünüm yok

### Etkilenen Alanlar:
- `profiles` tablosu
- Row Level Security (RLS) politikaları
- Dashboard ve tüm modüller
- Randevu sistemi
- Fatura/abrechnung sistemi
- Hasta kayıtları

---

## 🟢 Hedeflenen Durum (Gereksinimler)

### 1. İşletme (Business/Clinic) Kavramı (Paket 3)

- **İşletme**, sistemde birincil organizasyon birimi olacak
- Her işletmenin kendine ait:
  - İşletme adı (`business_name`)
  - Adres bilgileri
  - Çalışma saatleri
  - Hizmet listesi
  - Personel listesi
  - Randevular
  - Müşteriler/Hastalar
  - Faturalar

### 2. Yeni Veritabanı Yapısı (Paket 3 için)

#### 2.1 İşletmeler Tablosu (`businesses`)
- Yeni bir `businesses` tablosu oluşturulacak
- Bu tablo, işletme sahiplerinin her bir işletmesini temsil edecek
- İşletme sahibi (owner) bu tablodaki kayıtların sahibi olacak

#### 2.2 Profil Güncellemesi
- `profiles` tablosundaki mevcut işletme bilgileri (`business_name`, adres, vs.) **ya taşınacak ya da bağlanacak**
- `owner_id` mantığı değişecek:
  - **Owner**: `businesses` tablosundaki kendi işletmelerine sahip olacak
  - **Employee**: Birden fazla işletmede çalışabilecek (cross-employment)

#### 2.3 Employee-İşletme İlişkisi (Paket 3)
- Employee'ler birden fazla işletmede çalışabilmeli
- Bu ilişki için yeni bir tablo gerekebilir: `employee_businesses` veya benzeri
- Her employee-işletme ilişkisi için:
  - Çalışma saatleri (işletmeye özel olabilir)
  - Verdiği hizmetler
  - Randevu durumu

### 3. Çalışan Grubu Bazlı Yetkilendirme (RBAC) (Paket 3)

#### 3.1 Çalışan Grubu Kavramı

Owner, çalışanları **gruplara** atayabilecek. Her grubun **kendi scope'u** (erişim hakları/modüller) olacak.

**Default Gruplar:**
| Grup | Açıklama | Varsayılan Scope |
|------|----------|------------------|
| **Mitarbeiter** | Fizyoterapistler, uzmanlar | Randevular, Hastalar, Notlar, Reçeteler, Hizmetler |
| **Sekreter** | Resepsiyonist, ön ofis | Randevular, Müşteriler, İletişim |

**Owner Tanımlı Gruplar:**
- Owner isterse **yeni "hybrid" gruplar** oluşturabilir
- Örnek: "Hem Terapist Hem Sekreter" grubu → her iki grubun yetkilerini birleştirir

#### 3.2 Grup Scope Tanımları

Her modül için görünürlük ayarlanır:

| Modül | Açıklama |
|-------|----------|
| `dashboard` | Genel Bakış |
| `calendar` | Randevular/Terminplanung |
| `customers` | Müşteriler/Hastalar |
| `services` | Hizmetler |
| `hours` | Çalışma Saatleri |
| `team` | Personel Yönetimi |
| `notes` | Notlar/Patientennotizen |
| `anamnese` | Anamnese Formları |
| `prescriptions` | Reçeteler |
| `abrechnung` | Kassenabrechnung/Faturalar |
| `fahrtenbuch` | Fahrtenbuch |
| `b2b` | B2B İletişim |
| `b2c` | B2C Mailings |
| `feedback` | Geri Bildirim |
| `settings` | Ayarlar |

#### 3.3 Hesap Açılışı Akışı (Paket 3)

```
1. Owner, employee hesabı oluşturur
2. Sistem, çalışan türü seçim ekranı gösterir:
   ┌─────────────────────────────────────┐
   │ Çalışan Türü Seçin:                  │
   │                                     │
   │ ○ Mitarbeiter (Fizyoterapist)       │
   │ ○ Sekreter (Resepsiyonist)           │
   │ ○ [Owner'ın oluşturduğu gruplar...]  │
   │                                     │
   │ [Özel: Manuel Yetkilendirme]         │
   └─────────────────────────────────────┘
3. Seçilen gruba göre otomatik scope'lar atanır
4. Hesap oluşturulur
```

#### 3.4 Owner Override Yetkisi (Paket 3)

Owner her çalışan için **bireysel yetkilendirme** yapabilmeli:

```
Owner Dashboard → Personel → [Çalışan Seç] → Yetkilendirme
┌─────────────────────────────────────────────────────────────┐
│ [Çalışan Adı] Yetkileri                                   │
│                                                         │
│ Grup: [Mitarbeiter ▼]  (veya "Özel")                     │
│                                                         │
│ Modül Erişimi:                                           │
│ [✓] Dashboard      [✓] Randevular      [ ] Notlar       │
│ [✓] Hastalar       [✓] Reçeteler       [ ] Fahrtenbuch   │
│ [✓] Hizmetler      [ ] Faturalar       [ ] B2B          │
│ ...                                                     │
│                                                         │
│ [Kaydet]                                                │
└─────────────────────────────────────────────────────────────┘
```

**Kural:**
- Grup değiştiğinde scope'lar otomatik güncellenir
- "Özel" seçildiğinde manuel olarak her modül açılır/kapalır
- Owner override yapabilir, grup varsayılanını değiştirebilir

#### 3.5 Scope Örnekleri

**Sekreter Grubu (Sadece gerekli olanlar):**
- ✓ Dashboard
- ✓ Randevular (calendar)
- ✓ Müşteriler (customers)
- ✓ B2C Mailings
- ✗ Notlar (hastayla ilgilenmiyor)
- ✗ Fahrtenbuch (gerekli değil)
- ✗ Reçeteler
- ✗ Abrechnung

**Fizyoterapist (Mitarbeiter) Grubu:**
- ✓ Dashboard
- ✓ Randevular
- ✓ Hastalar
- ✓ Notlar
- ✓ Reçeteler
- ✓ Anamnese
- ✓ Hizmetler
- ✗ Abrechnung (fatura işlemleri genelde sekreter yapar)
- ✗ Fahrtenbuch (eğer klinik hizmeti yoksa)

**Hybrid Örnek (Hem Sekreter Hem Terapist):**
- Tüm sekreter yetkileri + Tüm terapist yetkileri
- Owner manuel olarak birleştirebilir veya yeni grup oluşturabilir

### 4. Gelişmiş Takvim/Genel Bakış Görünümleri (Übersicht) (Paket 3)

Mevcut sadece günlük görünüm yerine **3 farklı görünüm** seçeneği:

#### 4.1 Görünüm Tipleri

| Görünüm | Açıklama |
|---------|----------|
| **Günlük** | Mevcut davranış - sadece bugünün randevuları |
| **Haftalık** | Haftanın tüm günleri, çalışan bazlı sütunlar |
| **Aylık** | Seçili fizyoterapistin tüm ayı |

#### 4.2 Haftalık Görünüm Özellikleri

```
┌──────────────────────────────────────────────────────────────────────┐
│  [◀]  19. Mai - 25. Mai 2026  [▶]       [Günlük | Haftalık | Aylık] │
├──────────────────────────────────────────────────────────────────────┤
│        Mo 20    Di 21    Mi 22    Do 23    Fr 24    Sa 25           │
├──────────────────────────────────────────────────────────────────────┤
│ Thomas   [Rdv 1]  [Rdv 2]          [Rdv 3]                          │
│ Anna           [Rdv 4]  [Rdv 5]                   ▶ (diğerleri)     │
│ Lisa      [Rdv 6]                    [Rdv 7]                        │
│ Max                         [Rdv 8]                                │
├──────────────────────────────────────────────────────────────────────┤
│  [◀ 3 more employees]                                              │
└──────────────────────────────────────────────────────────────────────┘
```

**Özellikler:**
- **Responsive sütun sayısı**: Ekran genişliğine göre kaç çalışan sığacağı hesaplanır
- **Kaydırma (Slide)**: Sığmayan çalışanlar için sağda "▶" butonu ile kaydırma
- **Çalışan seçimi**: Üst kısımda tüm çalışanlar listesi (filtreleme)
- **Renk kodlaması**: Her çalışan için farklı renk
- **Boş zamanlar**: Çalışma saatleri dışındaki alanlar gri

#### 4.3 Aylık Görünüm Özellikleri

```
┌──────────────────────────────────────────────────────────────────────┐
│  [◀]  Juni 2026  [▶]         [Günlük | Haftalık | Aylık]             │
├──────────────────────────────────────────────────────────────────────┤
│  Therapeut auswählen: [Anna Schmidt ▼]                              │
├──────────────────────────────────────────────────────────────────────┤
│        Mo      Di      Mi      Do      Fr      Sa      So           │
├──────────────────────────────────────────────────────────────────────┤
│    1       2       3       4       5       6       7                │
│  [2 Rdv]  [3 Rdv] [1 Rdv]         [4 Rdv]                          │
│                                                                         │
│    8       9      10      11      12      13      14                │
│           [2 Rdv]        [5 Rdv] [1 Rdv]                           │
│   ...                                                                │
└──────────────────────────────────────────────────────────────────────┘
```

**Özellikler:**
- **Fizyoterapist seçimi zorunlu**: Üstte dropdown ile seçim yapılır
- **Tek hesap görünümü**: Sadece seçili kişinin randevuları
- **Gün içi randevu sayısı**: Her günün hücresinde kaç randevu olduğu gösterilir
- **Gün seçimi**: Bir güne tıklayınca o günün detayı görünür
- **Toplam istatistik**: Ay boyunca toplam randevu sayısı

#### 4.4 View Geçişleri

- Görünümler arası geçiş **seamless** olmalı (sayfa yenilenmeden)
- Seçili tarih korunmalı (haftalıktan aylığa geçince aynı hafta/ay gösterilmeli)
- View preference **kullanıcı başına kaydedilmeli** (localStorage veya profile'da)

### 5. Hesap İçi İşletme Seçici (Business Switcher) (Paket 3)

Dashboard'da veya hesap menüsünde:
- Kullanıcının erişimi olan tüm işletmeler listelenecek
- Kullanıcı aktif işletmeyi seçebilecek
- Seçilen işletmeye göre tüm veriler filtrelenecek

**Örnek Görünüm:**
```
┌─────────────────────────────────────────┐
│ 🏥 Praxis Berlin  ▼                      │
├─────────────────────────────────────────┤
│ ○ Praxis Berlin (Ana)                   │
│ ○ Praxis Hamburg                        │
│ ○ Fizyoterapi Merkezi                   │
└─────────────────────────────────────────┘
```

### 6. Veri Yalıtımı (Data Isolation) (Paket 3)

- Tüm sorgular **seçili işletmeye** göre filtrelenecek
- RLS politikaları güncellenerek:
  - Owner sadece kendi işletmelerinin verilerini görebilmeli
  - Employee sadece çalıştığı işletmelerin verilerini görebilmeli
  - Veriler arasında sızma olmamalı
- Scope bazlı görünürlük de RLS ile desteklenebilir

### 7. Etkilenecek Modüller

| Modül | Paket 1&2 | Paket 3 |
|-------|-----------|---------|
| Dashboard | Mevcut (günlük görünüm) | İşletme seçici + Scope bazlı görünürlük + Haftalık/Aylık Takvim |
| Randevular (Kalender) | ✓ | ✓ (işletme bazlı filtreleme) |
| Hizmetler | ✓ | ✓ (her işletmenin kendi listesi) |
| Personel (Team) | ✓ | ✓ + Yetkilendirme |
| Müşteriler/Hastalar | ✓ | ✓ (işletme bazlı) |
| Faturalar (Abrechnung) | ✓ | ✓ (işletme bazlı) |
| Çalışma Saatleri | ✓ | ✓ (işletme bazlı) |
| Notlar/Anamnese | ✓ | Scope bazlı görünürlük |

### 8. Owner Yetkileri (Paket 3)

- Owner yeni işletme ekleyebilmeli
- Owner mevcut işletmelerini yönetebilmeli
- Owner çalışanları işletmelere atayabilmeli
- **Owner çalışan grupları oluşturabilmeli**
- **Owner her çalışan için bireysel scope override yapabilmeli**

### 9. Employee Yetkileri

**Paket 1 & 2:**
- Sadece tek işletmede çalışır
- Tüm modüllere erişimi vardır (paket bazlı)

**Paket 3:**
- Birden fazla işletmede çalışabilmeli
- Sadece atandığı işletmelerin verilerini görebilmeli
- Sadece erişim izni olan modülleri görür
- Çalışma saatlerini işletme bazında ayarlayabilmeli

---

## 📊 Özet Gereksinimler

### İşletme Yönetimi (Paket 3):
1. **İşletme (Business) tablosu** oluşturulacak
2. **Employee-İşletme ilişkisi** için tablo oluşturulacak (cross-employment)
3. **İşletme seçici (Business Switcher)** dashboard'a eklenecek
4. **RLS politikaları** güncellenerek veri yalıtımı sağlanacak

### Yetkilendirme Sistemi (Paket 3):
5. **employee_groups** tablosu oluşturulacak (owner'ın tanımladığı gruplar)
6. **group_scopes** tablosu oluşturulacak (her grubun hangi modüllere erişimi var)
7. **employee_group_assignments** tablosu oluşturulacak (çalışan-grup ataması)
8. **employee_scopes** tablosu oluşturulacak (bireysel override için)
9. **Hesap açılışı akışı** güncellenerek grup seçimi eklenecek
10. **Owner dashboard'da** çalışan yetkilendirme sayfası eklenecek
11. **Frontend** scope bazlı modül görünürlüğünü destekleyecek

### Takvim Görünümleri (Paket 3):
12. **Haftalık görünüm** eklenecek (responsive sütunlar, kaydırma)
13. **Aylık görünüm** eklenecek (fizyoterapist seçimi, tek hesap)
14. **View geçişleri** seamless olacak
15. **View preference** kullanıcı başına kaydedilecek

### Veri Taşıma:
16. **Mevcut veriler** korunarak yeni yapıya taşınacak veya bağlanacak

---

## 🔄 Önerilen Uygulama Sıralaması

En mantıklı geliştirme sırası:

### Faz 1: Temel Altyapı (Paket 3 Multi-Business)
1. Veritabanı: `businesses` tablosu oluştur
2. Mevcut tek işletmeyi `businesses` tablosuna taşı
3. RLS politikalarını güncelle
4. İşletme seçici (Business Switcher) ekle
5. Tüm sorguları işletme bazlı filtrele

### Faz 2: Çalışan Grupları ve RBAC (Paket 3)
6. `employee_groups`, `group_scopes`, `employee_scope_overrides` tabloları
7. Default grupları oluştur (Mitarbeiter, Sekreter)
8. Owner: Grup oluşturma/arıtma sayfası
9. Owner: Çalışan yetkilendirme sayfası
10. Frontend: Scope bazlı modül görünürlüğü

### Faz 3: Employee-İşletme İlişkisi (Paket 3)
11. `employee_business_assignments` tablosu
12. Hesap açılışı akışını güncelle (grup seçimi)
13. Cross-employment desteği

### Faz 4: Gelişmiş Takvim Görünümleri (Paket 3)
14. Haftalık görünüm altyapısı
15. Responsive sütun sistemi (ekran boyutuna göre)
16. Çalışan kaydırma (slide) özelliği
17. Aylık görünüm
18. Fizyoterapist seçimi ve filtreleme
19. View preference kaydetme

---

## 📁 Önerilen Veritabanı Şeması

```sql
-- İşletmeler tablosu
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES profiles(id) NOT NULL,
  business_name TEXT NOT NULL,
  -- adres bilgileri...
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Çalışan grupları (owner tanımlı)
CREATE TABLE employee_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) NOT NULL,
  name TEXT NOT NULL, -- 'Mitarbeiter', 'Sekreter', 'Hybrid Terapist'
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grup scope'ları (her grubun erişim hakları)
CREATE TABLE group_scopes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES employee_groups(id) NOT NULL,
  module TEXT NOT NULL, -- 'dashboard', 'calendar', 'notes', etc.
  has_access BOOLEAN DEFAULT TRUE,
  UNIQUE(group_id, module)
);

-- Çalışan-İşletme ataması
CREATE TABLE employee_business_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES profiles(id) NOT NULL,
  business_id UUID REFERENCES businesses(id) NOT NULL,
  group_id UUID REFERENCES employee_groups(id), -- varsayılan grup
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, business_id)
);

-- Bireysel scope override (owner tarafından yapılan manuel ayarlar)
CREATE TABLE employee_scope_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES profiles(id) NOT NULL,
  business_id UUID REFERENCES businesses(id) NOT NULL,
  module TEXT NOT NULL,
  has_access BOOLEAN NOT NULL,
  UNIQUE(employee_id, business_id, module)
);

-- Kullanıcı view tercihleri (calendar view için)
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  preference_key TEXT NOT NULL, -- 'calendar_view', 'selected_business', etc.
  preference_value TEXT,
  UNIQUE(user_id, preference_key)
);
```

---

## ⚠️ Notlar

- Mevcut verilerin kaybolmaması için migration stratejisi belirlenecek
- Geriye dönük uyumluluk sağlanmalı
- Kullanıcı deneyimi (UX) akıcı olmalı
- Performans etkisi değerlendirilmeli
- Default gruplar (Mitarbeiter, Sekreter) sistemde önceden tanımlı olmalı
- Haftalık görünümde çok fazla çalışan varsa scroll/slide performansı önemli
- **Paket kontrolü**: Tüm yeni özellikler (multi-business, RBAC, haftalık/aylık takvim) sadece Paket 3 için aktif olmalı

---

## 🎯 Dışlanan Kapsam (Bu dokümanın dışında)

- Fatura sisteminin yeniden yazılması (sadece işletme bazında filtreleme)
- Ödeme/faturalandırma mantığının değiştirilmesi
- Yeni bir SaaS çoklu tenant mimarisi
- Mobil uygulama değişiklikleri

---

**Hazırlayan:** [Kullanıcı]
**Tarih:** 2026-05-22
**Versiyon:** 4.0