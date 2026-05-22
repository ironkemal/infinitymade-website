# Multi-Business + RBAC + Advanced Calendar — Implementation Plan

> Kaynak gereksinimler: [MULTI_BUSINESS_SUPPORT.md](MULTI_BUSINESS_SUPPORT.md) v4.0
> Plan tarihi: 2026-05-22
> Status: Karar verildi, implementasyon başlamaya hazır

---

## 🔍 Canlı DB Keşifleri (Supabase MCP, 2026-05-22)

Plan yazıldıktan sonra canlı DB taranınca ortaya çıkanlar — bunlar plana entegre edildi:

| Bulgu | Sonuç |
|-------|-------|
| **`business_id` kolonu adı çakışıyor**: `business_services`, `conversations`, `messages`, `wa_contacts` tablolarında zaten `business_id UUID` var ama içeride `profiles.id` (owner UUID) tutuyor — eski WhatsApp multi-tenant migration'ından kalma. | WhatsApp rafta → `conversations`, `messages`, `wa_contacts` DROP edilir (0/0/1 satır, ölü). `business_services` (50 satır) ise satır-satır gerçek business UUID'ye migrate edilir. |
| **`profiles.booking_slug` UNIQUE, 26 owner'da dolu** | Migration sırasında `businesses.booking_slug`'a taşınır; `profiles.booking_slug` legacy alias olarak kalır (geçiş süresi için). |
| **`prescription_sessions` / `prescription_validations`** business_id'siz, sadece `prescription_id` var; RLS prescription'a nested | Aynı kalsın — business_id eklemek gereksiz, mevcut nested RLS modeli zaten doğru. |
| **`fahrten_monthly_summary` bir VIEW** | base table değil, ALTER yok. Underlying `fahrten`'e business_id eklenince view otomatik görür. |
| **`profiles_public` bir VIEW**, public booking sayfası kullanıyor | booking_slug businesses'a taşınınca view yeniden kurulur. |
| **RLS deseni tutarlı**: `auth.uid() = owner_id OR auth.uid() IN (SELECT profiles.id WHERE profiles.owner_id = X.owner_id)` | Yeni RLS bunu `business_id` üzerinden çözecek — `employee_business_assignments` ile genişler. |
| **Owner sayıları**: 21 owner, 9 employee, 4 owner'ın çalışanı var, 15 owner'da business_name dolu, 6 owner default "Mein Geschäft" alacak | Backfill stratejisi doğru, riski düşük (test fazı + 6 boş isim sorun değil). |
| **0 enterprise kullanıcı** | Gating güvenli — kimseyi etkilemez, beta'da elle `plan='enterprise'` set edilir. |

---

## ✅ Anahtar Kararlar (kullanıcı onayı: 2026-05-22)

| # | Karar | Etki |
|---|-------|------|
| K1 | **Migration otomatik**: her mevcut owner için `businesses` tablosunda 1 satır oluşturulur, tüm legacy veriler bu default business'a bağlanır. Kullanıcı hiçbir şey yapmaz. | Backfill SQL'i migration'ın parçası. Owner ilk girişte değişikliği fark etmez. |
| K2 | **Paket 3 (Enterprise) yok — bu sprintte yaratılacak**: Stripe'da yeni plan + price ID'leri, `profiles.plan = 'enterprise'` değeri, gating mantığı. UI'da feature flag ile mock olarak başlar, prod'a Stripe live key + price ID ile çıkar. | Stripe setup adımı eklenir. Beta test owner'lara `plan_status='trial'` + `plan='enterprise'` manuel atanarak doğrulama yapılır. |
| K3 | **Owner UX**: Aktif business switcher (her zaman tek business görür). Employee ile aynı paradigma. Aggregated raporlar v2'ye ertelendi. | Switcher seçimi `user_preferences.selected_business` veya localStorage'a kaydedilir. Tüm sorgulara `business_id` filtresi girer. |
| K4 | **Services + hours per-business**, "Diğer işletmemden kopyala" wizard'ı ile yeni business kurarken 1 tıkla import. | `services`, `working_hours`, `appointments`, `customers`, `prescriptions`, `abrechnung`, `notes` — hepsine `business_id NOT NULL` kolonu. RLS basit, override katmanı yok. |

---

## 🎯 Faz Sıralaması (4 faz, geliştirme sırası bu)

### Faz 1 — Temel Multi-Business Altyapısı
**Hedef:** Veriler işletme bazında izole, mevcut owner'lar farkı hissetmeden çalışmaya devam ediyor.

1.0 **Önce ölü WhatsApp tabloları DROP** (`conversations`, `messages`, `wa_contacts`) — `business_id` adı serbest kalır, isim çakışması bitter.

1.1 SQL migration: `v24_multi_business` (Supabase apply_migration ile)
  - `CREATE TABLE businesses (id, owner_id, business_name, address_*, phone, email, created_at)`
  - Mevcut tablolara `business_id UUID` kolonu ekle (nullable başlangıçta):
    `services`, `working_hours`, `appointments`, `customers/patients`, `prescriptions`, `abrechnung_*`, `notes`, `anamnese`, `fahrtenbuch`, `team_members`
  - Backfill: her owner için 1 business satırı, tüm child kayıtların `business_id`'sini set et
  - `business_id NOT NULL` constraint
  - `user_preferences` tablosu (selected_business, calendar_view vs.)

1.2 RLS politikaları güncelle: tüm tablolarda `business_id` üzerinden filter, eski `owner_id` filter'ı kaldır

1.3 Backend (`api-backend/server.js` + Vercel API): tüm endpoint'ler request'te `business_id` bekler, validate eder

1.4 Frontend — Business Switcher component:
  - Dashboard header'a dropdown
  - Seçim `localStorage` + `user_preferences`'a yazılır
  - Sayfa yenilenmeden tüm widget'lar yeniden fetch eder
  - **Paket 1&2:** dropdown gizli (tek business var)

1.5 Plan gating altyapısı:
  - `lib/plan.js` helper: `hasFeature(user, 'multi_business')` → plan kontrolü
  - "Yeni işletme ekle" butonu sadece Paket 3'te görünür
  - Stripe'da Enterprise plan ID + fiyat (ay/yıl) kurulumu, `STRIPE_SETUP.md`'ye eklenir

**Çıkış kriterleri:** Mevcut test owner girer, hiçbir şey değişmemiş gibi çalışır. Paket 3 test owner'ı 2. business ekleyebilir, switcher ile geçiş yapar, veriler karışmaz.

---

### Faz 2 — RBAC (Çalışan Grupları + Scope)
**Hedef:** Owner çalışanlarının hangi modülleri göreceğini kontrol edebilir.

2.1 SQL: `database_v23_rbac.sql`
  - `employee_groups (id, business_id, name, is_default)`
  - `group_scopes (group_id, module, has_access)` — UNIQUE(group_id, module)
  - `employee_business_assignments (employee_id, business_id, group_id)` — UNIQUE(employee_id, business_id)
  - `employee_scope_overrides (employee_id, business_id, module, has_access)` — bireysel override

2.2 Default seed: her business için "Mitarbeiter" + "Sekreter" gruplarını ve scope'larını oluştur (trigger ya da business insert RPC)
  - **Mitarbeiter:** dashboard, calendar, customers, services, notes, anamnese, prescriptions ✓ — abrechnung, fahrtenbuch, team, settings ✗
  - **Sekreter:** dashboard, calendar, customers, b2c ✓ — notes, anamnese, prescriptions, abrechnung, team, settings ✗

2.3 Backend: `GET /api/me/permissions?business_id=...` → resolved scope listesi döner (group default + override merge)

2.4 Frontend:
  - Tüm modül sayfaları sayfa açılışında permissions kontrolü yapar, yoksa 403
  - Dashboard sidebar'da kullanıcının erişimi olmayan menü item'ları gizlenir
  - `permissions.js` shared helper

2.5 Owner UI:
  - **Personel** sayfasında her çalışan satırına "Yetkilendirme" butonu → modal:
    - Grup dropdown (Mitarbeiter / Sekreter / custom / "Özel")
    - Modül checkbox grid
    - "Özel" seçilince override'lara yazılır
  - **Yeni:** "Grup Yönet" sayfası (Settings altında) — custom hybrid grup oluşturma

**Çıkış kriterleri:** Owner Mitarbeiter'a abrechnung kapatır, o employee giriş yapınca abrechnung menüsü ve sayfası görünmez.

---

### Faz 3 — Cross-Employment (Multi-Business Employee)
**Hedef:** Bir fizyoterapist 2 farklı kliniğin sahibi tarafından eklenebilir, ikisinde de çalışabilir.

3.1 Employee invite akışı:
  - Owner çalışan ekler → 6-haneli `company_code` yerine **kalıcı employee email/ID lookup** veya **invite link**
  - Mevcut employee başka bir owner tarafından da davet edilebilir → `employee_business_assignments`'a yeni satır

3.2 Employee girişte business switcher: çalıştığı tüm işletmeler listede

3.3 `employee-signup.html` akışı güncellenir: ilk kayıt sırasında grup seçim ekranı (Mitarbeiter/Sekreter)

3.4 Employee için per-business working_hours yönetimi

**Çıkış kriterleri:** Employee A, Berlin kliniğine sabah, Hamburg kliniğine öğleden sonra atanmış, ikisinde de farklı saatlerle görünüyor.

---

### Faz 4 — Gelişmiş Takvim Görünümleri
**Hedef:** Übersicht'te haftalık + aylık görünüm.

4.1 Übersicht header: `[Günlük | Haftalık | Aylık]` toggle + tarih navigator

4.2 Haftalık view:
  - X ekseni: günler (Mo-Sa veya Mo-So profile setting)
  - Y ekseni: çalışanlar (sütun grid)
  - Responsive: `window.innerWidth / 180px` = visible employee count, sağda `▶` slide
  - Renk kodlaması her employee_id için stable hash

4.3 Aylık view:
  - Üstte tek-fizyoterapist dropdown (zorunlu)
  - Klasik takvim grid (Mo-So × 4-6 hafta)
  - Her hücrede randevu sayısı, tıklayınca günün listesi

4.4 View preference: `user_preferences.calendar_view` (`daily`/`weekly`/`monthly`)

4.5 Seamless geçiş: SPA tarzı, tarih state korunur

**Çıkış kriterleri:** Paket 3 owner haftalık görünüme geçer, 5 fizyoterapistin haftası grid'de, slide çalışıyor.

---

## 🔒 Plan Gating Matrisi

| Özellik | Paket 1 (Basic) | Paket 2 (Pro) | Paket 3 (Enterprise) |
|---------|-----------------|---------------|----------------------|
| Multi-business switcher | gizli | gizli | ✓ |
| "Yeni işletme ekle" | ✗ | ✗ | ✓ |
| RBAC grup yönetimi | ✗ | ✗ | ✓ |
| Custom grup oluşturma | ✗ | ✗ | ✓ |
| Cross-employment | ✗ | ✗ | ✓ |
| Haftalık takvim | ✗ | ✗ | ✓ |
| Aylık takvim | ✗ | ✗ | ✓ |

**Gating noktası:** `lib/plan.js` → `hasFeature(profile, 'enterprise')`. Hem frontend (UI gizleme) hem backend (403 dönüşü) kontrol eder.

---

## ⚠️ Bilinen riskler ve dikkat noktaları

1. **Migration geri dönüşsüz**: backfill sonrası `business_id NOT NULL` koyunca rollback zor. Önce staging Supabase branch'inde test, sonra prod. Test fazında olduğumuz için canlı veri kaybı riski düşük ([test fazı](../C:/Users/Test/.claude/projects/c--Users-Test-Desktop-claude-website/memory/project_infinitymade_test_data.md)).
2. **Calendar-api (VPS) RLS bypass riski**: service_role key kullanıyor. Tüm calendar endpoint'leri request'teki `business_id`'yi owner ile karşılaştırmadan kabul ederse cross-tenant veri sızar. → Her endpoint'in başında `business belongs to user?` kontrolü zorunlu.
3. **Stripe Enterprise plan ID** prod'da yoksa, beta owner'lar için elle DB update (`UPDATE profiles SET plan='enterprise', plan_status='trial' WHERE id=...`) ile test yapılır.
4. **Existing employee invite akışı** (`company_code`) Faz 3'te değiştirilecek — geçişte mevcut kodlar geçerli kalmalı (backward compat shim 1 milestone tutulur).
5. **n8n workflow** business_id'siz çalışıyor — Faz 1 sonrası WhatsApp ileride dönerse n8n'in hangi business'a yazacağını bilmesi gerekir (şimdilik [rafa kaldırıldı](../C:/Users/Test/.claude/projects/c--Users-Test-Desktop-claude-website/memory/project_infinitymade_whatsapp_shelved.md), endişe yok).

---

## 📝 Açık kalan (Faz başında karar verilecek) mikro sorular

- Faz 1: `team_members` tablosu zaten owner-employee linkini tutuyor — bunu `employee_business_assignments`'a mı dönüştürelim yoksa ek tablo mu? (Faz 3 başında netleştir)
- Faz 2: "Settings" modülü RBAC'ta var mı? Owner-only mi yoksa sekreter'e ayar yetkisi verilebilir mi? — default Owner-only
- Faz 4: Haftalık görünümde Pazar dahil mi? — owner'ın `working_hours`'da hangi günler aktifse onları göster

---

## 🚀 İlerleme Takibi

### ✅ Faz 1.1 — DB Foundation (TAMAM, 2026-05-22)

Uygulanan migration'lar:
- **v24_multi_business_foundation** — businesses tablosu + 27 child tabloya business_id + backfill + user_preferences + get_default_business helper
- **v24b_fix_orphans_and_secure_helper** — services/working_hours legacy orphan fix (employee adına yazılmış kayıtlar owner'a bağlandı) + helper SECURITY INVOKER

**Sonuç:**
- 21 default business oluşturuldu (21 owner için 1:1)
- WhatsApp ölü tabloları (`conversations`, `messages`, `wa_contacts`) DROP edildi
- `business_services.business_id` eski FK (profiles→businesses) yenilendi
- 0 orphan satır, RLS yeni businesses + user_preferences tablolarında aktif

### ✅ Faz 1.2 — Business Switcher UI (TAMAM, 2026-05-22)

- `lib/business.js` helper (getActiveBusiness, setActiveBusiness, listMyBusinesses, clearBusinessCache)
- `lib/plan.js` (PLAN_FEATURES matrisi, hasFeature, canHaveMultipleBusinesses)
- `lib/supabase.js` güncellendi (ölü tablolar çıkarıldı, BUSINESSES + USER_PREFERENCES eklendi)
- Dashboard header'a switcher (`#bizSwitcher`) + dropdown menüsü
- `dashboard.css` switcher stilleri
- `dashboard.js` `bootBusinessSwitcher()`, `renderBizSwitcher()`, `wireBizSwitcherEvents()`, `switchBusiness()`
- Switcher görünürlük kuralı: birden fazla business varsa VEYA Enterprise + owner ise göster
- Cache-bust: v=20260522g

### ✅ Faz 1.4 — Settings > Geschäfte (TAMAM, 2026-05-22)

- Settings'e "Geschäfte" bölümü (sadece Enterprise + owner için açık)
- Liste + Bearbeiten + Löschen butonları
- Business ekleme/düzenleme modal'ı (`#businessModal`)
- **"Dienstleistungen kopieren von"** seçeneği yeni business eklerken (kararda söz verdiğimiz wizard)
- Default business silinemez (UI'da buton gizli)
- Aktif business silinirse otomatik reload

### ✅ Faz 1.5 — Query safety net (TAMAM, 2026-05-22)

**Tercih edilen yaklaşım:** 10k satır query refactor yerine **BEFORE INSERT trigger** ile auto-default.

- Migration `v24c_business_id_default_triggers`: 26 tabloya `trg_set_business_id` trigger eklendi
- Trigger mantığı: `business_id IS NULL` ise `NEW.owner_id` veya `auth.uid()` üzerinden default business çözer ve doldurur
- Sonuç: legacy kod yolları çalışmaya devam ediyor + yeni data doğru tag'leniyor
- Aktif business switcher seçimi için INSERT'te `business_id` manuel set edilebilir (yapılacak query'ler için)

### ✅ Faz 2 — RBAC (TAMAM, 2026-05-22)

**DB (v25_rbac_employee_groups):**
- 4 yeni tablo: `employee_groups`, `group_scopes`, `employee_business_assignments`, `employee_scope_overrides`
- 21 business × 2 default grup = **42 grup** seed edildi (Mitarbeiter + Sekreter)
- 336 scope satırı (her grup için varsayılan modül erişimi)
- 9 mevcut employee otomatik Mitarbeiter olarak atandı (default business + group)
- `get_my_permissions(business_id)` RPC: owner→hepsi TRUE; employee→grup default + override merge

**Frontend:**
- `loadModulePermissions()` her business switch'inde çağrılır
- `renderSidebar()` employee için scope kontrol eder, erişimi olmayan modülleri gizler
- `SIDEBAR_TO_MODULE` map ile sidebar item'larını RBAC modüllerine eşler
- **Personel → Detay → "Berechtigungen"** tab'ı eklendi (sadece owner görür)
- Grup dropdown + modül checkbox grid + override mantığı tam
- Override marker UI'da gösterilir

### ⏳ Faz 1.3 — Stripe Enterprise plan kurulumu (BEKLEMEDE)
Kullanıcı kararı gerekli: fiyat noktası (€149 / €199 / başka), aylık + yıllık price ID'leri.

### ⏳ Faz 3 — Cross-employment (BEKLEMEDE)
Employee invite akışını güncelle: 1 employee birden fazla business'a (`employee_business_assignments` üzerinden) atanabilsin. Mevcut `company_code` akışı korunur.

### ✅ Faz 4 — Haftalık/Aylık takvim görünümleri (TAMAM, 2026-05-22)

- Übersicht panelinde **Tag / Woche / Monat** toggle (sadece Enterprise için görünür)
- **Haftalık görünüm**: 7 gün × çalışan grid, hücrelerde randevu listesi (saat + servis), bugün vurgu, aktif business filter
- **Aylık görünüm**: tek terapist seçimi dropdown, klasik Mo-So × 6 hafta grid, her hücrede gün numarası + randevu sayısı, bugün/ay-dışı stilleri, ay toplamı summary
- Aylık hücreye tıklayınca o günün **günlük görünümüne** geçer
- Prev/Next butonları aktif görüşe göre gün/hafta/ay sıçar
- View tercihi + monthly_employee `user_preferences` tablosunda kaydedilir, refresh'te kalır
- Tüm UI **koyu tema uyumlu** (`--bg-card-solid`, `--primary-dim`, `--text-main` tokenleri)

### 🟡 Faz 5 — Onboarding güncelleme (KISMEN TAMAM, 2026-05-22)

**Tamamlanan:**
- ✅ WhatsApp adımı (Step 5) komple kaldırıldı — `onboarding.html` + `onboarding.js`'den temizlik
- ✅ Adım sayısı 8 → 7 (tüm Schritt X / 8 → X / 7, stepNum güncellendi)
- ✅ Eski profillerin `onboarding_step='whatsapp'` değeri otomatik `'templates'`'e remap edilir
- ✅ Sektör dropdown daraltıldı: berber/beauty/physiotherapy aktif; diğerleri "Bald verfügbar" optgroup'unda disabled
- ✅ Plan kartlarından WhatsApp mesaj limiti referansları çıkarıldı
- ✅ Klinik plan kartından "Mehrere Standorte" çıkarıldı (artık Enterprise'a ait)
- ✅ **Enterprise kart** eklendi (€149/€127 placeholder — onaya gerek)
- ✅ Stripe entegrasyonu güncellendi: `priceIdFor()` enterprise destekliyor, webhook + checkout validation 'enterprise' kabul ediyor
- ✅ `STRIPE_SETUP.md` Enterprise price ID kayıt notu eklendi (TODO işaretli)

**Kalan (Faz 3 ile birlikte):**
- ⏳ Employee onboarding'inde grup seçim adımı (Mitarbeiter / Sekreter)
- ⏳ Cal.com kalıntıları (varsa) temizlik
- ⏳ DTA-Pro add-on koşulu (sadece physio, praxis sektörü kaldırıldı — kod otomatik halletti)
- ⏳ Onboarding bitince `businesses` tablosuna gerçek satır oluştur (şu an profiles trigger ile default business backfill devam ediyor — yeni onboarding'lerde test edilmeli)

---

## 📋 Faz 5 — Onboarding Güncellemesi (Birikmiş + Yeni)

> Onboarding (`onboarding.html` + `onboarding.js`) son aylarda yapılan birçok scope değişikliğini hâlâ yansıtmıyor. Bu faz **multi-business çalışmasının sonuna** koyulur çünkü Faz 1–4 tamamlanmadan yeni alanlar boşa çıkar.

### 5.1 Geçmişten kalan (bayat) düzeltmeler

**a) WhatsApp adımını komple çıkar (Step 6 — Schritt 6/8)**
- Memory: WhatsApp 2026-05-20 rafa kaldırıldı, pazarlamada bile kullanılmıyor
- `onboarding.html:203-212` → `<section data-step="whatsapp">` bloğu sil
- `onboarding.js:7` → `STEPS` dizisinden `'whatsapp'` çıkar (8 adım → 7 adım)
- `onboarding.js:589-616` → whatsappForm submit handler sil
- `onboarding.js:226-228, 608-610, 753-756` → `whatsapp_*` field okuma/yazma temizliği
- Progress bar `1/8` → `1/7` güncelle (tüm `Schritt X / 8` etiketleri)

**b) Sektör dropdown'unu hedef kitleye daralt**
- Memory: scope 2026-05-16'da daraltıldı — **SADECE berber/güzellik + fizyoterapi**
- `onboarding.html:70-82` arası option'lar: sadece `barber`, `beauty` (varsa), `physiotherapy` kalır
- `praxis`, `restaurant`, `salon`, `klinik` ve diğerleri kaldırılır (ya da `disabled` + "Bald verfügbar" rozeti)
- `onboarding.js` `SERVICE_TEMPLATES` içinde sadece bu 2 sektör için template kalır

**c) Cal.com kalıntılarını temizle**
- Memory: Cal.com tamamen kaldırılıyor
- `cal_username` veya cal.com referansları onboarding'de varsa sil
- Profile field'ı DB'de hâlâ varsa Faz 1 migration ile drop

**d) DTA-Pro add-on koşulunu güncelle**
- `onboarding.js:674-675` → `s === 'praxis'` koşulu kalkar, sadece `physiotherapy`

### 5.2 Multi-business + Paket 3 için yeni adımlar

**e) Plan adımına (Step 8) Enterprise kartı ekle**
- `onboarding.html:295-340` plan grid'ine 4. kart: **Enterprise** (€X/ay, "Mehrere Standorte + Mitarbeitergruppen + Wochen-/Monatsansicht")
- `data-plan="enterprise"` button
- Stripe price ID env'ye eklendiğinde checkout flow otomatik çalışır

**f) Onboarding sırasında ilk business otomatik oluşur**
- Step 2 (Business): mevcut form aynı kalır ama `INSERT INTO profiles` yerine `INSERT INTO businesses` + `profiles` link
- Sonraki adımlar (services, hours) bu yeni business_id'ye yazar
- Owner Faz 1 sonrası dashboard'a girince 2. işletme eklemek için **Settings → İşletmeler → Yeni ekle** yolunu kullanır (onboarding wizard'a 2. business sığdırmıyoruz, gereksiz uzar)

**g) Sektör → varsayılan RBAC grupları**
- Fizyoterapi sektörü seçildiğinde otomatik olarak "Mitarbeiter" ve "Sekreter" grupları seed edilir (Faz 2 ile uyumlu)
- Berber sektöründe sadece "Mitarbeiter" yeterli (sekreter rolü tipik değil), ama her ihtimale karşı her ikisi de eklenir

**h) Employee onboarding akışı (employee-signup.html)**
- Faz 3 ile birlikte: çalışan kayıt sırasında grup seçim ekranı eklenir
- Şu an `company_code` ile owner bulunuyor → owner'ın hangi business'ına bağlanacağı sorulur (1'den fazlaysa)

### 5.3 Tahmini değişen dosyalar

```
onboarding.html       — adım sayısı 8→7, whatsapp section sil, sektör dropdown daralt, Enterprise plan kartı ekle
onboarding.js         — STEPS array, whatsappForm handler, sektör templates, business INSERT business_id link
onboarding.css        — (gerekirse) Enterprise kart vurgu rengi
employee-signup.html  — grup seçim adımı
employee-signup.js    — group_id assignment
```

### 5.4 Çıkış kriterleri (Faz 5)

- Yeni owner onboarding'i 7 adımda tamamlanır, WhatsApp adımı yok
- Sadece berber + fizyo sektörü seçilebilir
- Plan adımında 4 kart (Starter/Pro/Klinik/Enterprise) görünür
- Onboarding bitince `businesses` tablosunda 1 satır, `profiles.role='owner'` ve `selected_business` ayarlı
- Mevcut Paket 1&2 onboarding davranışı bozulmaz (Enterprise seçmeyenler eskisi gibi çalışır)

---

## 🗒️ Faz 5 — Açık mikro sorular

- Enterprise fiyat noktası nedir? (€99/ay Klinik var, Enterprise ondan üstte olmalı — €149/ay? €199/ay?)
- "Klinik" planı kalsın mı yoksa "Klinik" = "Enterprise" mi olsun? (isim çakışması var)
- Eski WhatsApp verisi DB'de duran kullanıcılar olabilir — sadece UI'dan kaldır, kolon DROP etme (geri dönüş ihtimaline karşı)
