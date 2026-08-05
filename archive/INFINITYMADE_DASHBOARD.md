# InfinityMade — Müşteri Dashboard Geliştirme Planı

## Proje Özeti

Mevcut infinitymade.de landing page'ine (vanilla HTML/CSS/JS, Vercel) müşteri giriş sistemi ve kişisel dashboard ekliyoruz. Satın alan her müşteri mail + şifre ile giriş yapıp kendi paketine özel paneli görüyor.

---

## Mevcut Yapı

```
infinitymade-website/ (GitHub: ironkemal/infinitymade-website)
├── index.html       ← landing page (DEĞİŞMEYECEK)
├── styles.css
└── script.js
```

## Hedef Yapı

```
infinitymade-website/
├── index.html           ← mevcut landing page (değişmez)
├── styles.css           ← mevcut (değişmez)
├── script.js            ← mevcut (değişmez)
├── login.html           ← YENİ: giriş sayfası
├── login.css            ← YENİ
├── login.js             ← YENİ
├── dashboard.html       ← YENİ: müşteri paneli
├── dashboard.css        ← YENİ
└── dashboard.js         ← YENİ
```

---

## Teknoloji Seçimi

**Auth + Veritabanı: Supabase**
- Ücretsiz plan yeterli (başlangıç için)
- Vanilla JS SDK'sı var, framework gerektirmez
- Mail/şifre auth dahil
- CDN üzerinden import edilir, build step yok

```html
<script type="module">
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
</script>
```

---

## Supabase Kurulumu

### 1. Supabase'de Tablo Yapısı

```sql
-- Müşteri profilleri tablosu
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT,
  business_name TEXT,
  plan TEXT CHECK (plan IN ('starter', 'professional', 'klinik')),
  billing TEXT CHECK (billing IN ('monthly', 'annual')),
  cal_link TEXT,                -- Cal.com embed linki
  airtable_link TEXT,           -- Airtable embed linki
  whatsapp_number TEXT,         -- WhatsApp bot numarası
  vapi_assistant_id TEXT,       -- Vapi assistant ID (Klinik paket)
  vapi_public_key TEXT,         -- Vapi public key (Klinik paket)
  language TEXT DEFAULT 'de',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);

-- RLS: Kullanıcı sadece kendi profilini görür
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kendi profilini gör" ON profiles
  FOR ALL USING (auth.uid() = id);
```

### 2. Supabase'de Environment

`dashboard.js` ve `login.js` dosyalarının en başına:
```javascript
const SUPABASE_URL = 'https://xxxxx.supabase.co';       // Supabase project URL
const SUPABASE_ANON_KEY = 'eyJhbGci...';                // Supabase anon public key
```

---

## Dosya 1: login.html + login.js

### Davranış
- Ziyaretçi `infinitymade.de/login.html` adresine gider
- Mail + şifre formu görür
- Giriş başarılıysa → `dashboard.html`'e yönlendirilir
- Zaten giriş yapmışsa → direkt `dashboard.html`'e yönlendirilir

### login.html Yapısı
```
+----------------------------------+
|  Logo: InfinityMade              |
|                                  |
|  [ E-Mail                    ]   |
|  [ Passwort                  ]   |
|                                  |
|  [ Anmelden / Login / Giriş  ]   |
|                                  |
|  Passwort vergessen?             |
+----------------------------------+
```

### login.js Mantığı
```javascript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Zaten giriş yapmış mı kontrol et
const { data: { session } } = await supabase.auth.getSession()
if (session) window.location.href = '/dashboard.html'

// Giriş formu
async function handleLogin(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) showError(error.message)
  else window.location.href = '/dashboard.html'
}

// Şifre sıfırlama
async function handleReset(email) {
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://infinitymade.de/login.html'
  })
  showSuccess('E-Mail gesendet / Email sent / Mail gönderildi')
}
```

### Stil
- Koyu tema (#0a0a0a) — mevcut site ile uyumlu
- Ortada küçük kart (max-width: 400px)
- Tek vurgu rengi: yeşil (#22c55e) — mevcut site ile uyumlu

---

## Dosya 2: dashboard.html + dashboard.js

### Koruma (Auth Guard)
`dashboard.js` ilk satırda oturumu kontrol eder:
```javascript
const { data: { session } } = await supabase.auth.getSession()
if (!session) window.location.href = '/login.html'
```

### Profil Yükleme
```javascript
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', session.user.id)
  .single()

// profile.plan → hangi paneller görünür
// profile.cal_link → Cal.com iframe src
// profile.airtable_link → Airtable iframe src
// profile.vapi_assistant_id → Vapi widget (sadece klinik)
// profile.vapi_public_key → Vapi widget (sadece klinik)
```

---

## Dashboard Layout

```
+--------------------------------------------------+
|  HEADER                                           |
|  Logo: InfinityMade   [İşletme Adı]  [Çıkış]     |
+--------------------------------------------------+
|                                                    |
|  SIDEBAR (sol, 220px)   |  ANA PANEL (sağ)        |
|                          |                         |
|  > Übersicht            |  Aktif sekmenin içeriği |
|  > Kalender             |                         |
|  > Leads                |                         |
|  > WhatsApp Bot         |                         |
|  > Sesli Asistan 🔒     |  ← sadece Klinik görür |
|  > Einstellungen        |                         |
|                          |                         |
+--------------------------------------------------+
```

---

## Panel 1: Übersicht (Genel Bakış)

**Tüm paketlerde görünür.**

```
+------------+  +------------+  +------------+  +------------+
| Paket      |  | Status     |  | Laufzeit   |  | Support    |
| Starter    |  | ✓ Aktiv    |  | Seit 15.   |  | info@      |
|            |  |            |  | Jan 2026   |  | infinity.. |
+------------+  +------------+  +------------+  +------------+
```

Altında: "Was ist in Ihrem Paket enthalten?" — paketin özelliklerini listele (infinitymade_pricing_prompt.md'deki feature listesinden çek).

---

## Panel 2: Kalender (Cal.com)

**Tüm paketlerde görünür.**

```javascript
// profile.cal_link örn: "https://cal.com/embed/abc123"
if (profile.cal_link) {
  document.getElementById('cal-frame').src = profile.cal_link
}
```

```html
<iframe
  id="cal-frame"
  src=""
  width="100%"
  height="700px"
  frameborder="0"
></iframe>
```

Cal.com embed URL'i her müşteri için Supabase'deki `cal_link` alanından gelir.

---

## Panel 3: Leads (Airtable)

**Professional ve Klinik paketinde görünür. Starter'da "Upgrade" mesajı.**

```javascript
if (profile.plan === 'starter') {
  showUpgradeMessage('Leads-Dashboard ist ab Professional verfügbar.')
  return
}

document.getElementById('airtable-frame').src = profile.airtable_link
```

```html
<iframe
  id="airtable-frame"
  src=""
  width="100%"
  height="700px"
  frameborder="0"
></iframe>
```

---

## Panel 4: WhatsApp Bot

**Tüm paketlerde görünür.**

Gerçek WhatsApp API durumu olmadığı için bu panel şimdilik bilgi kartı gösterir:

```
+--------------------------------------+
|  🟢 Bot Aktiv                        |
|  Nummer: +49 XXX XXXXXXX             |
|                                      |
|  Letzte 7 Tage:                      |
|  • 34 Nachrichten beantwortet        |
|  • 8 Termine vereinbart             |
|  • 2 Stornierungen bearbeitet       |
|                                      |
|  [WhatsApp öffnen]                   |
+--------------------------------------+
```

Veriler şimdilik Supabase'deki statik alandan gelir (haftalık manuel güncelleme veya ileride webhook ile otomatik).

---

## Panel 5: Sesli Asistan (Vapi) ← YENİ

**Sadece Klinik paketinde görünür. Starter ve Professional'da "Upgrade" mesajı.**

### Plan Kontrolü

```javascript
if (profile.plan !== 'klinik') {
  showUpgradeMessage(
    'Der KI-Sprachassistent ist ausschließlich im Klinik-Paket verfügbar.',
    'Jetzt upgraden'
  )
  return
}
```

### Panel Yapısı

```
+--------------------------------------------------+
|  🎙️ KI-Sprachassistent                           |
|  Status: 🟢 Aktiv                                |
|                                                   |
|  +-------------------------------------------+   |
|  |  Wie funktioniert es?                      |   |
|  |  Patienten rufen Ihre Nummer an → der      |   |
|  |  KI-Assistent nimmt ab, bucht Termine,     |   |
|  |  beantwortet Fragen — 24/7, mehrsprachig.  |   |
|  +-------------------------------------------+   |
|                                                   |
|  📊 Diese Woche:                                  |
|  • Anrufe beantwortet: 24                        |
|  • Termine gebucht: 11                           |
|  • Ø Gesprächsdauer: 1:48 min                   |
|  • Erkannte Sprachen: DE, TR, AR                 |
|                                                   |
|  [Widget Testen]   [Einstellungen]               |
+--------------------------------------------------+

+--------------------------------------------------+
|  Live-Widget Vorschau                            |
|  (Vapi widget burada embed edilir)               |
|                                                   |
|  <vapi-widget ... />                             |
+--------------------------------------------------+
```

### Vapi Widget Entegrasyonu

`profile.vapi_public_key` ve `profile.vapi_assistant_id` Supabase'den çekilir, widget dinamik olarak oluşturulur:

```javascript
function renderVapiWidget(profile) {
  if (profile.plan !== 'klinik') return

  // Script yükle (eğer henüz yüklenmemişse)
  if (!document.querySelector('script[src*="vapi-ai"]')) {
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/@vapi-ai/client-sdk-react/dist/embed/widget.umd.js'
    script.async = true
    document.head.appendChild(script)
  }

  // Widget elementini oluştur
  const widget = document.createElement('vapi-widget')
  widget.setAttribute('public-key', profile.vapi_public_key)
  widget.setAttribute('assistant-id', profile.vapi_assistant_id)
  widget.setAttribute('mode', 'voice')
  widget.setAttribute('theme', 'dark')
  widget.setAttribute('base-bg-color', '#0a0a0a')
  widget.setAttribute('accent-color', '#22c55e')        // infinitymade yeşili
  widget.setAttribute('cta-button-color', '#22c55e')
  widget.setAttribute('cta-button-text-color', '#ffffff')
  widget.setAttribute('border-radius', 'large')
  widget.setAttribute('size', 'full')
  widget.setAttribute('position', 'bottom-right')
  widget.setAttribute('title', 'KI-Sprachassistent')
  widget.setAttribute('start-button-text', 'Gespräch starten')
  widget.setAttribute('end-button-text', 'Anruf beenden')
  widget.setAttribute('voice-show-transcript', 'true')
  widget.setAttribute('consent-required', 'true')
  widget.setAttribute('consent-title', 'Datenschutzhinweis')
  widget.setAttribute('consent-content',
    'Mit dem Klick auf „Einverstanden" stimme ich der Aufzeichnung und Verarbeitung meiner Kommunikation zu, wie in unserer Datenschutzerklärung beschrieben.'
  )
  widget.setAttribute('consent-storage-key', 'vapi_widget_consent')

  document.getElementById('vapi-widget-container').appendChild(widget)
}
```

### İstatistik Verisi

Vapi arama istatistikleri Supabase'deki `cagri_kayitlari` tablosundan çekilir (n8n webhook ile her arama sonrası otomatik kaydedilir):

```javascript
async function loadVapiStats(userId) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: calls } = await supabase
    .from('cagri_kayitlari')
    .select('sure, maliyet, transkript')
    .eq('user_id', userId)
    .gte('cagri_tarihi', sevenDaysAgo)

  return {
    totalCalls: calls.length,
    avgDuration: calls.reduce((a, c) => a + parseFloat(c.sure || 0), 0) / calls.length,
    totalCost: calls.reduce((a, c) => a + parseFloat(c.maliyet || 0), 0)
  }
}
```

### Upgrade Mesajı (Starter / Professional için)

```javascript
function showVapiUpgradeMessage() {
  return `
    <div class="upgrade-card">
      <div class="upgrade-icon">🎙️</div>
      <h3>KI-Sprachassistent</h3>
      <p>
        Mit dem Klinik-Paket erhalten Sie einen KI-Sprachassistenten,
        der Patientenanrufe 24/7 entgegennimmt, Termine bucht und
        Fragen in mehreren Sprachen beantwortet.
      </p>
      <ul>
        <li>✓ Verpasste Anrufe werden automatisch übernommen</li>
        <li>✓ Mehrsprachig: DE, TR, AR und weitere</li>
        <li>✓ Gesprächsaufzeichnung & Transkript</li>
        <li>✓ Statistiken im Dashboard</li>
      </ul>
      <a href="mailto:info@infinitymade.de?subject=Upgrade zu Klinik" class="btn-upgrade">
        Jetzt auf Klinik upgraden
      </a>
    </div>
  `
}
```

---

## Panel 6: Einstellungen

**Tüm paketlerde görünür.**

- İşletme adını değiştir
- Dil tercihi (DE / EN / TR)
- Şifre değiştir
- Paketi görüntüle (yükseltme linki)

```javascript
async function updateProfile(updates) {
  await supabase.from('profiles').update(updates).eq('id', session.user.id)
}

async function changePassword(newPassword) {
  await supabase.auth.updateUser({ password: newPassword })
}
```

---

## Plan Bazlı Panel Görünürlüğü (Güncellenmiş)

| Panel | Starter | Professional | Klinik |
|-------|---------|--------------|--------|
| Übersicht | ✓ | ✓ | ✓ |
| Kalender | ✓ | ✓ | ✓ |
| Leads | ✗ (upgrade) | ✓ | ✓ |
| WhatsApp Bot | ✓ | ✓ | ✓ |
| **Sesli Asistan** | **✗ (upgrade)** | **✗ (upgrade)** | **✓** |
| Einstellungen | ✓ | ✓ | ✓ |

```javascript
// dashboard.js içinde
function renderSidebar(plan) {
  const items = [
    { id: 'overview',   label: 'Übersicht',        plans: ['starter', 'professional', 'klinik'] },
    { id: 'calendar',   label: 'Kalender',          plans: ['starter', 'professional', 'klinik'] },
    { id: 'leads',      label: 'Leads',             plans: ['starter', 'professional', 'klinik'] }, // starter'da lock ikonu
    { id: 'whatsapp',   label: 'WhatsApp Bot',      plans: ['starter', 'professional', 'klinik'] },
    { id: 'voice',      label: 'Sesli Asistan 🔒',  plans: ['starter', 'professional', 'klinik'] }, // klinik dışında lock
    { id: 'settings',   label: 'Einstellungen',     plans: ['starter', 'professional', 'klinik'] },
  ]
  // Her plan için sidebar'da görünür ama içerik açılınca upgrade mesajı çıkar
}
```

> **Not:** Sesli Asistan sidebar'da tüm planlarda görünür (upsell amacıyla), ama Klinik dışındaki planlarda tıklanınca upgrade mesajı çıkar. Kilit ikonu (🔒) gösterilir.

---

## Yeni Müşteri Onboarding Akışı

Müşteri satın alınca sen (admin olarak) Supabase'de şunları yaparsın:

1. **Supabase Auth > Users > Invite user** — müşterinin mailine davet gönder
2. **profiles tablosuna kayıt ekle:**

```sql
-- Starter müşteri
INSERT INTO profiles (id, email, business_name, plan, cal_link, whatsapp_number)
VALUES (
  '[user_uuid]',
  'musteri@mail.com',
  'Beispiel Friseur',
  'starter',
  'https://cal.com/embed/xxx',
  '+49 xxx xxxxxxx'
);

-- Klinik müşteri (Vapi bilgileri eklenir)
INSERT INTO profiles (
  id, email, business_name, plan,
  cal_link, airtable_link, whatsapp_number,
  vapi_assistant_id, vapi_public_key
)
VALUES (
  '[user_uuid]',
  'doktor@praxis.de',
  'Dr. Yılmaz Zahnarztpraxis',
  'klinik',
  'https://cal.com/embed/xxx',
  'https://airtable.com/embed/xxx',
  '+49 xxx xxxxxxx',
  'asst_xxxxxxxxxxxxxxxxx',    -- Vapi Dashboard'dan al
  'pk_xxxxxxxxxxxxxxxxx'       -- Vapi Dashboard'dan al
);
```

3. Müşteri maile gelen link ile şifre belirler, giriş yapar.

İleride bu adım otomatize edilebilir (Stripe webhook → Supabase fonksiyon → otomatik kullanıcı oluşturma).

---

## Dashboard Stil Kılavuzu

Mevcut site stiliyle uyumlu:

```css
/* Mevcut siteden alınan değerler */
--bg-primary: #0a0a0a;
--bg-secondary: #111111;
--bg-card: #1a1a1a;
--border: rgba(255,255,255,0.08);
--text-primary: #f5f5f5;
--text-secondary: #a0a0a0;
--accent: #22c55e;          /* Sitenin yeşili */
--accent-hover: #16a34a;
--danger: #ef4444;
--font: 'Inter', sans-serif; /* Mevcut site fontu */

/* Upgrade kartları için */
--upgrade-bg: #1a1a1a;
--upgrade-border: rgba(34, 197, 94, 0.2);   /* yeşil border */
--lock-color: #a0a0a0;
```

Sidebar genişliği: 220px (desktop), mobilde gizlenip hamburger menü olur.

---

## Çok Dil Desteği

Mevcut `script.js`'deki `T` objesi ve `setLanguage()` fonksiyonu dashboard'a da taşınır. Her müşterinin `language` tercihi Supabase'de saklanır, giriş yapınca otomatik uygulanır.

**Sesli Asistan paneli için ek çeviriler:**

```javascript
const T = {
  de: {
    voicePanel: 'KI-Sprachassistent',
    voiceStatus: 'Aktiv',
    voiceCalls: 'Anrufe diese Woche',
    voiceBooked: 'Termine gebucht',
    voiceUpgrade: 'Nur im Klinik-Paket verfügbar',
    voiceUpgradeBtn: 'Jetzt upgraden',
  },
  en: {
    voicePanel: 'AI Voice Assistant',
    voiceStatus: 'Active',
    voiceCalls: 'Calls this week',
    voiceBooked: 'Appointments booked',
    voiceUpgrade: 'Available in Klinik plan only',
    voiceUpgradeBtn: 'Upgrade now',
  },
  tr: {
    voicePanel: 'Yapay Zeka Sesli Asistan',
    voiceStatus: 'Aktif',
    voiceCalls: 'Bu hafta aramalar',
    voiceBooked: 'Alınan randevular',
    voiceUpgrade: 'Yalnızca Klinik paketinde mevcut',
    voiceUpgradeBtn: 'Şimdi yükselt',
  }
}
```

---

## Güvenlik Notları

- `dashboard.html` sayfasının en üstünde her zaman auth guard çalışır
- Supabase RLS açık — kullanıcı sadece kendi profilini okuyabilir/yazabilir
- `vapi_public_key` ve `vapi_assistant_id` Supabase RLS sayesinde sadece ilgili müşteriye görünür
- Anon key frontend'de görünebilir, bu normaldir — RLS koruması yeterli
- Şifre sıfırlama Supabase'in built-in mail sistemi ile yapılır

---

## Geliştirme Sırası (Claude Code için)

1. `login.html` + `login.css` + `login.js` — önce auth
2. Supabase client bağlantısını test et
3. `dashboard.html` iskelet yapısı — header + sidebar + main area
4. `dashboard.css` — mevcut site stiliyle uyumlu
5. `dashboard.js` — auth guard + profil yükleme + panel switching
6. Cal.com panel — iframe gömme
7. Airtable panel — iframe gömme + plan kontrolü
8. WhatsApp panel — statik bilgi kartı
9. **Sesli Asistan paneli — Vapi widget + istatistikler + upgrade mesajı**
10. Einstellungen paneli — şifre + profil güncelleme
11. Mobil responsive — sidebar hamburger menü

---

## Dosya Değişmeyecekler

Mevcut şu dosyalar HİÇ değiştirilmez:
- `index.html`
- `styles.css`
- `script.js`

Sadece `index.html`'deki "Jetzt beraten lassen" / "Kontakt" butonlarına opsiyonel olarak `href="/login.html"` eklenebilir — müşteriler zaten hesap aldıktan sonra login linkini mail ile alacak.

---

## Stripe Entegrasyonu

### Ürün & Fiyat Yapısı

Her paket için Stripe'da 3 price oluşturuldu: kurulum (one-time) + aylık (recurring) + yıllık (recurring).

```
STARTER       → prod_UR8ytOaDTGCV5B
PROFESSIONAL  → prod_UR8ykaQqJ8akfT
KLİNİK        → prod_UR8yQLuf4Gwksx
```

### Price ID'ler (Test Modu)

```env
STRIPE_STARTER_SETUP=price_1TSGgTFzgjhpydMneBtNxX7b
STRIPE_STARTER_MONTHLY=price_1TSGgTFzgjhpydMnav0jqspD
STRIPE_STARTER_ANNUAL=price_1TSGgTFzgjhpydMnDASt2lYD

STRIPE_PRO_SETUP=price_1TSGgUFzgjhpydMnfQxa5kTZ
STRIPE_PRO_MONTHLY=price_1TSGgUFzgjhpydMnY8A7XZNI
STRIPE_PRO_ANNUAL=price_1TSGgVFzgjhpydMn0AHKEc2D

STRIPE_KLINIK_SETUP=price_1TSGgVFzgjhpydMn4lSZmG2I
STRIPE_KLINIK_MONTHLY=price_1TSGgVFzgjhpydMntcyHfLLY
STRIPE_KLINIK_ANNUAL=price_1TSGgWFzgjhpydMn97eDmsAz
```

> ⚠️ Live moda geçince `stripe-setup.js` scripti `sk_live_...` key ile tekrar çalıştır — yeni ID'ler oluşur, buraya güncelle.

### Payment Links (Test Modu)

Her paket için kurulum ücreti + abonelik birlikte tek checkout'ta alınır. Ödeme tamamlanınca müşteri `https://infinitymade.de/dashboard.html` adresine yönlendirilir.

```env
LINK_STARTER_MONTHLY=https://buy.stripe.com/test_...
LINK_STARTER_ANNUAL=https://buy.stripe.com/test_...

LINK_PRO_MONTHLY=https://buy.stripe.com/test_...
LINK_PRO_ANNUAL=https://buy.stripe.com/test_...

LINK_KLINIK_MONTHLY=https://buy.stripe.com/test_...
LINK_KLINIK_ANNUAL=https://buy.stripe.com/test_...
```

> `stripe-links.js` scriptini çalıştırınca gerçek linkler `stripe-payment-links.env` dosyasına kaydedilir — yukarıdaki değerleri oradan güncelle.

### Stripe Webhook → Supabase Akışı

Müşteri ödeyince otomatik hesap açılması için:

```
Stripe checkout tamamlandı
        ↓
Stripe → n8n webhook (checkout.session.completed event)
        ↓
n8n: müşteri mailini + plan bilgisini al
        ↓
Supabase Auth: kullanıcı oluştur (invite)
        ↓
Supabase profiles: plan, cal_link vb. kaydet
        ↓
Müşteriye hoş geldin maili gönder
```

#### n8n Webhook Node Ayarı

```
Event: checkout.session.completed
Stripe Dashboard → Developers → Webhooks → Add endpoint
URL: https://n8n.srv1004425.hstgr.cloud/webhook/stripe-infinitymade
```

#### n8n'de Okunacak Alanlar

```javascript
// Stripe webhook body'den
const email = body.data.object.customer_details.email
const plan  = body.data.object.metadata.plan  // starter / professional / klinik
const mode  = body.data.object.mode           // subscription
```

### Fiyat Tablosu (Referans)

| Paket | Kurulum | Aylık | Yıllık (ay başına) |
|-------|---------|-------|-------------------|
| Starter | €399 | €89 | €74 |
| Professional | €599 | €149 | €124 |
| Klinik | €899 | €219 | €182 |

### Test Kartı

```
Kart no:  4242 4242 4242 4242
Son kul.: 12/29
CVC:      123
```

---

## Değişiklik Özeti (v1 → v2)

| Alan | v1 | v2 (bu versiyon) |
|------|-----|-----------------|
| Sidebar panelleri | 5 panel | 6 panel (+Sesli Asistan) |
| Supabase profiles tablosu | cal_link, airtable_link, whatsapp_number | + vapi_assistant_id, vapi_public_key |
| Plan kısıtlamaları | Leads: Professional+ | + Sesli Asistan: sadece Klinik |
| Vapi widget | Yok | Dinamik olarak profil'den yüklenir |
| İstatistikler | WhatsApp statik kart | + Vapi arama istatistikleri (cagri_kayitlari'ndan) |
| Çok dil | Mevcut T objesi | + voicePanel çevirileri eklendi |
| Stripe | Yok | Ürünler + fiyatlar + payment links + webhook akışı eklendi |
