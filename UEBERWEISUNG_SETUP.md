# Überweisung Automation - Kurulum Rehberi (VPS Storage)

## ⚠️ Önemli Değişiklik - n8n Üzerinden Dosya Servisi

Artık Traefik routing yerine, fotoğrafları n8n webhook üzerinden servis ediyoruz.
Bu yaklaşım daha güvenilirdir ve n8n üzerinden tüm trafiği kontrol eder.

## Workflow'lar

### 1. referral-automation-workflow-vps.json (POST - Fotoğraf Yükleme)
- **Webhook**: `POST https://n8n.infinitymade.de/webhook/referral-upload`
- **İşlev**: Fotoğrafı alır, VPS'e kaydeder, AI vision ile parse eder, Supabase'e kaydeder
- **Depolama**: `/home/n8n/referrals/{business_id}/referral_YYYYMMDD_UUID.jpg`

### 2. referral-image-server-workflow.json (GET - Fotoğraf Servis)
- **Webhook**: `GET https://n8n.infinitymade.de/webhook/referral-image`
- **Parametreler**: `?business_id=XXX&filename=YYY.jpg`
- **İşlev**: Fotoğrafı okuyup binary response olarak döner
- **Header'lar**: GDPR uyumlu no-cache header'ları

## Önceki Kurulum (Artık Kullanılmıyor)

### Traefik Routing (Kullanımdan Kaldırıldı)
- `/referrals/` path'i artık Traefik üzerinden route edilmiyor
- Bunun yerine n8n webhook kullanılıyor

## Dosya URL Formatı

```javascript
// Eski format (artık çalışmıyor):
`/referrals/${business_id}/${filename}`

// Yeni format:
`https://n8n.infinitymade.de/webhook/referral-image?business_id=${business_id}&filename=${filename}`
```

## Kurulum Adımları

### 1. VPS'te Dizini Oluştur
```bash
ssh root@85.10.142.252
mkdir -p /home/n8n/referrals
chown -R n8n:n8n /home/n8n/referrals
```

### 2. n8n Workflow'larını İçe Aktar
1. `n8n/referral-automation-workflow-vps.json` - Fotoğraf yükleme workflow'u
2. `n8n/referral-image-server-workflow.json` - Fotoğraf servis workflow'u

### 3. Environment Variables
```bash
OPENROUTER_API_KEY=sk-or-v1-...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
```

## Test Komutları

### Manuel Dosya Kaydetme Testi
```bash
ssh root@85.10.142.252
# Test dosyası oluştur
echo "test file" > /home/n8n/referrals/test.txt
# Okuma testi
cat /home/n8n/referrals/test.txt
```

### Workflow Test
```bash
# Fotoğraf yükleme testi
curl -X POST https://n8n.infinitymade.de/webhook/referral-upload \
  -F "image=@/path/to/foto.jpg" \
  -F "business_id=test-business-id"

# Fotoğraf okuma testi
curl "https://n8n.infinitymade.de/webhook/referral-image?business_id=test-business-id&filename=test.jpg" -o output.jpg
```

## GDPR Uyumluluğu

- Tüm fotoğraflar local VPS'te saklanır (Supabase Storage kullanılmıyor)
- `no-store, no-cache` header'ları ile tarayıcı önbelleğe alınmaz
- Her business_id için ayrı klasör ile izolasyon
- AI vision için OpenRouter Gemini (Zero Retention)

---

# Überweisung Automation - Kurulum Rehberi (Eski - Arşiv)

## Genel Bakış

Bu sistem Almanya'daki fizyoterapi/sağlık merkezleri için hasta sevk belgelerini (Überweisung) otomatik olarak işler:

1. **Fotoğraf Yükleme**: Hasta/sekreter sevk belgesinin fotoğrafını çeker ve yükler
2. **AI Parse**: OpenRouter/Gemini görselden metin çıkarır
3. **Veritabanı**: Parse edilen veriler Supabase'e kaydedilir
4. **Sekreter Onayı**: Dashboard'dan belgeler incelenir ve onaylanır
5. **Randevu Oluşturma**: Onay sonrası otomatik randevu serisi oluşturulur

---

## 1. Supabase Kurulumu

### 1.1 Veritabanı Tabloları

Aşağıdaki SQL migration'ı çalıştırın:

```sql
-- database_v10_ueberweisung_automation.sql dosyasını çalıştırın
```

Bu tabloları oluşturur:
- `referral_drafts`: AI parse edilmiş sevk belgeleri
- `find_patient_by_name_and_birth()`: Hasta arama fonksiyonu
- `confirm_referral_and_create_series()`: Onay ve randevu oluşturma fonksiyonu

### 1.2 Storage Bucket

1. Supabase Dashboard > Storage
2. "New Bucket" tıklayın
3. Ayarlar:
   - **Name**: `referrals`
   - **Public**: `false` (güvenlik için)
   - **File size limit**: 10MB
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp, application/pdf`

### 1.3 Environment Variables

```bash
# Supabase
SUPABASE_URL=https://njvuclullotbksskpwgk.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenRouter (AI Vision)
OPENROUTER_API_KEY=your_openrouter_api_key
```

---

## 2. n8n Workflow Kurulumu

### 2.1 Workflow Import

1. n8n'e giriş yapın (https://n8n.infinitymade.de)
2. Workflows > Import > `n8n/referral-automation-workflow.json` dosyasını yükleyin

### 2.2 Webhook URL

Import sonrası webhook node'un URL'ini not alın:
```
https://n8n.infinitymade.de/webhook/referral-upload
```

### 2.3 Environment Variables (n8n)

n8n içinde Settings > Variables:

```bash
OPENROUTER_API_KEY=sk-or-v1-xxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2.4 Workflow Adımları

```
[Webhook] → [Storage Upload] → [AI Vision] → [JSON Parse] → [Database Insert]
```

#### Webhook Node
- Method: POST
- Path: `referral-upload`
- Dosya field name: `file`

#### Storage Upload Node
- Supabase credentials ekleyin
- Bucket: `referrals`
- Path: `{{ $json.body.business_id }}/{{ $json.fileName }}`

#### AI Vision Node (HTTP Request)
- URL: `https://openrouter.ai/api/v1/chat/completions`
- Method: POST
- Headers:
  - `Authorization: Bearer {{ $env.OPENROUTER_API_KEY }}`
  - `Content-Type: application/json`
- Body: JSON ile mesaj gönder

#### Database Insert Node
- Method: POST
- URL: `https://njvuclullotbksskpwgk.supabase.co/rest/v1/referral_drafts`
- Headers:
  - `apikey: {{ $env.SUPABASE_SERVICE_ROLE_KEY }}`
  - `Authorization: Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}`
  - `Content-Type: application/json`
  - `Prefer: return=representation`

---

## 3. Frontend Entegrasyonu

### 3.1 Upload Sayfası

`upload-ueberweisung.html` dosyası kullanıcıların fotoğraf yüklemesini sağlar.

**Webhook URL'ini güncelleyin:**
```javascript
const response = await fetch('https://n8n.infinitymade.de/webhook/referral-upload', {
```

### 3.2 Dashboard Panel

`dashboard.html` içinde "Überweisungen" paneli eklendi:
- Navigation'a "📋 Überweisungen" eklendi
- `dashboard.js` içinde `loadÜberweisung()` fonksiyonu

---

## 4. Kullanım Akışı

### 4.1 Fotoğraf Yükleme

1. Hasta veya sekreter `upload-ueberweisung.html` sayfasını açar
2. Sevk belgesinin fotoğrafını çeker/yükler
3. Business ID girer (örn: kullanıcı UUID)
4. "Hochladen & Parsen" butonuna basar

### 4.2 AI İşleme

1. n8n webhook fotoğrafı alır
2. Supabase Storage'a yükler
3. OpenRouter/Gemini'ye gönderir
4. JSON parse edilir
5. `referral_drafts` tablosuna `pending` status ile kaydedilir

### 4.3 Sekreter Onayı

1. Sekreter dashboard'da "Überweisungen" sekmesini açar
2. Pending belgeler görünür
3. Fotoğraf ile AI verilerini karşılaştırır
4. Hasta seçer (veya yeni oluşturur)
5. "Bestätigen & Termin erstellen" butonuna basar
6. Sistem randevu serisi oluşturur

---

## 5. Güvenlik (Datenschutz)

### 5.1 TLS

- Tüm bağlantılar HTTPS üzerinden
- Supabase zorunlu TLS
- n8n webhook HTTPS

### 5.2 RLS (Row Level Security)

```sql
-- Sadece kendi verilerini görebilir
CREATE POLICY "Users can view own referral drafts" ON referral_drafts
  FOR SELECT USING (owner_id = auth.uid());
```

### 5.3 AI Zero Retention

OpenRouter prompt'unda:
```
WICHTIG: Diese Daten werden NICHT für Training verwendet
```

---

## 6. Troubleshooting

### 6.1 Upload Başarısız
- Business ID'nin doğru olduğunu kontrol edin
- Supabase Storage bucket'ın oluşturulduğunu kontrol edin
- n8n webhook'un aktif olduğunu kontrol edin

### 6.2 AI Parse Hatası
- Fotoğraf kalitesini kontrol edin
- Fotoğrafın okunaklı olduğundan emin olun
- Retry edin

### 6.3 Onay Hatası
- Hasta seçildiğinden emin olun
- `confirm_referral_and_create_series` fonksiyonunun çalıştığını kontrol edin

---

## 7. API Reference

### Webhook Endpoint
```
POST https://n8n.infinitymade.de/webhook/referral-upload
Content-Type: multipart/form-data

file: [binary]
business_id: [uuid]
```

### Database Functions

```sql
-- Hasta ara
SELECT * FROM find_patient_by_name_and_birth(
  'Vorname', 'Nachname', '1990-01-01', 'owner_uuid'
);

-- Überweisung onayla
SELECT * FROM confirm_referral_and_create_series(
  'draft_uuid', 'lead_uuid', 'owner_uuid'
);
```

---

## 8. Todo List

- [x] Supabase tablo ve fonksiyonları oluştur
- [x] n8n workflow JSON hazırla
- [x] Dashboard panel ekle
- [x] Upload sayfası oluştur
- [ ] n8n workflow'u import et ve credentials ekle
- [ ] Storage bucket oluştur
- [ ] Test et