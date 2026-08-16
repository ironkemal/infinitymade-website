# 🧠 Praxura Ops — Finanz-, EÜR- & GoBD-Hafıza ve Kural Kılavuzu (Memory File)
> **Zorunlu Referans Belgesi:** Bu dosya, `ops` ve n8n otomasyon sisteminin tüm muhasebe, vergi, mükerrer kontrol ve yapay zeka kurallarını kalıcı olarak tanımlar. Her çalışma ve güncellemede bu kurallara harfiyen uyulur.

---

## 1. 🏢 Vergi Tüzel Kişiliği ve Yasal Çerçeve
* **Yasal Mükellef:** `Einzelunternehmen Yavuz Kemal Demir`
* **Vergi Beyan Şekli:** **Anlage EÜR (§ 4 Abs. 3 EStG)** — Gelir-Gider Farkı (Nakit Esası / § 11 EStG Zufluss-Abfluss-Prinzip).
* **Melih Demir:** Şirket ortağı veya hissedarı DEĞİLDİR (`role: "other"`). Melih'in kişisel özel harcamaları Kemal'in EÜR'sine **asla gider yazılamaz** (`is_deductible = false`, `tax_category = "private_expense"`).
* **Kemal'in Özel Hesabından Şirket Harcaması Ödemesi:**
  - `funding_source = "kemal_private"`
  - `capital_movement = "private_contribution"` (Privateinlage / Şahsi Sermaye Katkısı)
  - `economic_purpose = "business"`
  - `is_deductible = true` (Tamamen vergiden düşülebilir işletme gideri).

---

## 2. ↩️ Gutschrift (İade & Alacak Dekontu) Muhasebe Kuralı
* **Temel Kural:** Bir satıcıdan para iadesi (*Refund / Gutschrift / Erstattung*) geldiğinde bu tutar **GİDERİ AZALTIR (Negatif Gider / - Netto & - Brutto)**.
* Asla yeni bir pozitif gider olarak eklenemez!
* `document_type = "credit_note"` olan tüm kayıtlar:
  - Toplam EÜR Netto giderinden düşülür (`- net`).
  - Toplam Brütodan düşülür (`- gross`).
  - Vorsteuer (§ 15) matrahından düşülür.
  - Firma bazlı harcama kartlarında satıcının toplam harcamasını düşürerek net bakiyeyi gösterir.
  - Tabloda **`- 15,46 €`** şeklinde yeşil renkte gösterilir.

---

## 3. 💳 Asıl Fatura vs. PayPal / Stripe Ödeme Dekontu (Mükerrerlik Koruması)
* Bir siparişte hem satıcı faturası (*Rechnung*) hem de ödeme aracı dekontu (*PayPal Receipt / Stripe Notification*) gelebilir.
* **GoBD Kuralı:** Gider **yalnızca 1 kez (asıl fatura üzerinden)** yazılır.
* PayPal / Stripe ödeme onayları e-postadan geldiğinde:
  - `document_type = "payment_receipt"` olarak etiketlenir.
  - `is_deductible = false` yapılır (EÜR'de mükerrer düşülmez).
  - Asıl faturaya ödeme kanıtı (*Zahlungsnachweis*) olarak bağlanır.
  - Satıcı harcama kartlarında toplam tutarı ikiye katlamaz.

---

## 4. 🔄 Abonelik Türleri & Aylık Sabit Maliyet (Fixkosten) Hesabı
* **Yıllık Abonelikler (`recurring_interval = "yearly"`):**
  - GoDaddy alan adı / hosting yenilemeleri gibi yıllık ödemeler **12'ye bölünerek (`gross / 12`)** aylık sabit gider KPI'ına yansıtılır.
  - Asla tüm yıllık tutar tek bir ayın fixcost'u gibi gösterilmez.
* **Aylık Abonelikler (`recurring_interval = "monthly"`):**
  - Anthropic, OpenRouter, Codeium, Hetzner vb. aylık tutarlarıyla fixcost'a eklenir.
* **Tek Seferlik Alışverişler (`is_recurring = false`):**
  - Aylık fixcost listesine dahil edilmez.

---

## 5. ⚡ Reverse Charge (§ 13b UStG / Yurt Dışı B2B SaaS)
* Yurt dışından alınan SaaS hizmetleri (Anthropic IE, OpenAI US, Google IE, Supabase, Vercel, GitHub, Adobe IE, Microsoft IE):
  - `reverse_charge = true`
  - `invoice_vat_rate = 0.00%` (Faturada Alman KDV'si %0 görünür)
  - `reverse_charge_tax_rate = 19.00%`
  - EÜR ve USt-Voranmeldung'da hem hesaplanan KDV hem indirilecek KDV olarak nötrlenir.

---

## 6. 🚗 Fahrtenbuch (Seyir Defteri & 0,30 €/km Kilometre Hesabı)
* Şahsi araçla yapılan işle ilgili sürüşler: **0,30 €/km** (BMF Kilometersatz nach § 9 EStG) olarak EÜR'de işletme gideri yazılır.
* Paneldeki `#fahrtenbuch` modülünde GoBD formatında CSV olarak dışa aktarılır.
* Modal pencereleri dışarıya tıklandığında veri kaybını önlemek için kapanmaz.

---

## 7. 🤖 n8n ve Yapay Zeka Hata Dayanıklılığı (Zero Drop Architecture)
* Google Gemini API geçici olarak yoğun (`503`) veya kota aşımı (`429`) verse bile:
  - n8n `continueOnFail: true` ve 3x otomatik yeniden deneme ile çalışır.
  - Normalizer'daki akıllı yedek motor (*Fallback Regex*), satıcıyı ve tutarı e-posta başlığından çekerek faturayı Google Drive ve Supabase'e **kayıpsız yazar**.
  - Hiçbir fatura e-postası asla havada kalmaz veya silinmez.

---

*Bu belgedeki tüm kurallar kod tabanında (`ops/finance.js`, `ops/fahrtenbuch.js`, `ops/n8n-finance-invoice-workflow.json`) kalıcı olarak kodlanmıştır.*
