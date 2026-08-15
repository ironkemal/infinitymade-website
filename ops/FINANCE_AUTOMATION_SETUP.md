# Praxura Ops — Finans & Fatura Otomasyonu Kurulum Kılavuzu

Bu modül, gelen e-posta faturalarını otomatik olarak ayrıştırıp Google Drive'a arşivler, Gemini AI ile Alman vergi mevzuatına (Anlage EÜR / Kleingewerbe) uygun JSON formatına dönüştürür ve `Ops Praxura` dashboard'una işler.

---

## 1. Neler Hazırlandı?

1. **Veritabanı (`finance_schema.sql`):**
   - `Ops Praxura` (`farkaejociddtgqkusvm`) projesinde `ops_finance_expenses` tablosu oluşturuldu, RLS politikaları ve Supabase Realtime yayını açıldı.
2. **Dashboard UI (`finance.js`, `index.html`, `app.css`, `app.js`):**
   - **Finanzen & EÜR** sekmesi eklendi.
   - **KPI Kartları:** Brüt Harcama, Net Harcama, İndirilebilir Vorsteuer (KDV), Aylık Abonelikler.
   - **Anlage EÜR Kategori Grafiği:** Alman vergi mevzuatına uygun 9 resmi kategoriye göre otomatik yüzdelik ve tutar dağılımı.
   - **Fatura Tablosu & Arama:** Yıl, kategori, durum, abonelik filtreleri, hızlı arama, Google Drive PDF doğrudan açma butonu, düzenleme ve silme.
   - **Manuel Ekleme/Düzenleme Modalı:** Brüt ve KDV oranı girildiğinde Net ve KDV tutarını otomatik hesaplayan akıllı form.
   - **Elster EÜR Dışa Aktarma:** Tek tıkla resmi vergi beyannamesine uygun CSV (Almanca noktalı virgül ve ondalık virgül formatlı) ve JSON dışa aktarma.
3. **n8n İş Akışı Şablonu (`n8n-finance-invoice-workflow.json`):**
   - Doğrudan n8n'e aktarılmaya hazır hazır workflow.

---

## 2. n8n Kurulum ve Yapılandırma Adımları

`https://n8n.infinitymade.de/` adresindeki n8n panelinize gidin:

### Adım 2.1: Workflow'u İçe Aktarma
1. n8n'de **Workflows** → sağ üstteki **Add Workflow** veya `...` menüsünden **Import from File / URL** seçin.
2. `ops/n8n-finance-invoice-workflow.json` dosyasını seçin veya içeriğini yapıştırın.

---

### Adım 2.2: Kimlik Bilgilerini (Credentials) Tanımlama

Workflow içindeki servislerin durumu:

#### 1. Gmail Trigger
- **Durum:** ✅ **Hazır & Bağlı** (n8n kimlik ID: `0vQAwFOJNYOnYXEK`).

#### 2. Google Gemini AI (Beleg OCR & Vergi Sınıflandırma)
- **Durum:** ✅ **Hazır & Bağlı** (n8n kimlik ID: `mc4ec6EnNvsIEivD`).
- **Model:** `models/gemini-flash-latest` (Google AI Studio).

#### 3. Google Drive OAuth2
- **Kullanım:** PDF eklerini belirttiğiniz Google Drive fatura klasörüne (`1WaSt_q7X7cfD8YL7u5D1mQJ_YyljBwxO`) yükler.
- **n8n'de:** `Google Drive Yükle` node'unda Google Drive OAuth2 hesabınızı seçin.

#### 4. Supabase Kayıt
- **Durum:** ✅ **Hazır & Bağlı** (`Ops Praxura` / `farkaejociddtgqkusvm` REST API).

---

## 3. Test ve Canlıya Alma

1. n8n'de sağ üstteki **Test workflow** veya **Execute Workflow** butonuna basın.
2. Fatura e-posta kutunuza örnek bir PDF fatura gönderin (veya gelen kutusundaki mevcut bir faturayı tetikleyin).
3. Node'ların sırasıyla yeşile döndüğünü, Drive linkinin oluştuğunu ve `https://ops.infinitymade.de/#ausgaben` ekranında faturanın belirdiğini görün.
4. Test başarılı olduktan sonra n8n workflow sayfasındaki **Active** anahtarını `ON` (Aktif) konumuna getirin.
