# 🧠 Praxura Ops — Finanz-, EÜR- & GoBD-Hafıza ve Kural Kılavuzu (Memory File)
> **Zorunlu Referans Belgesi:** Bu dosya, `ops` ve n8n otomasyon sisteminin tüm muhasebe, vergi, mükerrer kontrol ve yapay zeka kurallarını kalıcı olarak tanımlar. Her çalışma ve güncellemede bu kurallara harfiyen uyulur.

---

## 1. 🏢 Vergi Tüzel Kişiliği, Mükellefiyet Rejimi & Yasal Çerçeve
* **Yasal Mükellef:** `Einzelunternehmen Yavuz Kemal Demir`
* **Alman KDV Numarası (USt-IdNr):** `DE366103215`
* **Vergilendirme Rejimi (`taxpayer_vat_regime`):**
  - **`standard_taxation` (Regelbesteuerung nach § 16/18 UStG):** Kemal'in işletmesi standart KDV mükellefidir (`input_vat_deduction_eligible = true`). § 13b kapsamındaki ters vergilendirmede hesaplanan KDV kadar indirilecek KDV (Vorsteuer) hakkı vardır (Örn. 3,42 € USt + 3,42 € Vorsteuer = Nakit nötr).
  - **`small_business` (Kleinunternehmer nach § 19 UStG):** Seçilirse Vorsteuer hakkı 0 € olur ve 3,42 € doğrudan net gidere eklenir.
* **Vergi Beyan Şekli:** **Anlage EÜR (§ 4 Abs. 3 EStG)** — Gelir-Gider Farkı (Nakit Esası / § 11 EStG Zufluss-Abfluss-Prinzip).
* **Melih Demir:** Şirket ortağı veya hissedarı DEĞİLDİR (`role: "other"`). Melih'in kişisel özel harcamaları Kemal'in EÜR'sine **asla gider yazılamaz** (`is_deductible = false`, `tax_category = "private_expense"`).
* **Kemal'in Özel Hesabından Şirket Harcaması Ödemesi:**
  - `funding_source = "kemal_private"`
  - `capital_movement = "private_contribution"` (Privateinlage / Şahsi Sermaye Katkısı)
  - `economic_purpose = "business"`
  - `is_deductible = true` (Tamamen vergiden düşülebilir işletme gideri).

---

## 2. 📐 Otomatik KDV & Matematik Tutarlılık Validatörü (VAT Consistency Engine)
* Her faturada zorunlu matematiksel kontroller uygulanır:
  1. `abs(gross_amount - (net_amount + (reverse_charge ? 0 : invoice_vat_amount))) <= 0.02`
  2. Yurt içi faturalarda (%19 USt): `expected_vat = net_amount * 0.19`. Eğer `abs(expected_vat - invoice_vat_amount) > 0.02` ise sistem faturayı otomatik düzeltir veya `needs_review = true` ve `review_codes = ['VAT_AMOUNT_INCONSISTENT']` olarak işaretler.
* **Hetzner Fatura Örnekleri (DE):**
  - **Hetzner #1 (#080000948614):** Net: `4,49 €` + %19 USt: `0,85 €` = Brüt: `5,34 €` (Vorsteuer: `0,85 €`).
  - **Hetzner #2 (#086001034208):** Net: `8,97 €` + %19 USt: `1,71 €` = Brüt: `10,68 €` (Vorsteuer: `1,71 €`).
  - **Toplam Hetzner:** Net: `13,46 €` + Vorsteuer: `2,56 €` = Brüt: `16,02 €`.

---

## 3. ⚡ Standartlaştırılmış Reverse Charge (§ 13b UStG) Veri Modeli
* **Tek ve Tutarlı Standart:** Eski veya çakışan alanlar kaldırılmıştır (`output_vat_13b` yerine tek model kullanılır):
  - `reverse_charge`: `true/false`
  - `reverse_charge_tax_base`: Net matrah (Örn: 18,00 €)
  - `reverse_charge_tax_rate`: `19.00`
  - `reverse_charge_output_vat`: Hesaplanan vergi borcu (Örn: 3,42 €)
  - `reverse_charge_input_vat`: İndirilebilir Vorsteuer (Regelbesteuerung'da 3,42 €, Kleinunternehmer'de 0,00 €)
  - `reverse_charge_reason`: `§ 13b Abs. 1 UStG / B2B EU-Dienstleistung` veya `§ 13b Abs. 2 Nr. 1 UStG / Drittland B2B Leistung`
* **Anthropic Gerçek Kayıt Bilgileri:**
  - Satıcı: `Anthropic Ireland, Limited` (USt-IdNr: `IE4276970QH`)
  - Alıcı: `Yavuz Kemal Demir` (USt-IdNr: `DE366103215`)
  - Fatura Tarihleri: `14.08.2026`, `14.07.2026`, `14.06.2026`
  - Net: 18,00 € | Fatura KDV: 0,00 € | § 13b RC: 3,42 € | Brüt: 18,00 €

---

## 4. 🌐 ABD ve Üçüncü Ülke (Drittland) Güvenlik & Döviz Kuru Kuralı
* ABD ve üçüncü ülke tedarikçilerinde (Anthropic PBC, OpenRouter vb.):
  - Otomatik %19 RC yerine hizmetin B2B SaaS mahiyeti ve ifa yeri (§ 3a Abs. 2 UStG) teyit edilir. Tereddüt halinde `needs_review = true` ve `review_codes = ['US_THIRD_COUNTRY_VAT_VERIFICATION']` verilir.
* **Döviz Kuru Eksiksiz Kaydı:**
  - `original_amount`: Orijinal döviz tutarı (Örn: 12.00)
  - `original_currency`: `USD`
  - `exchange_rate`: 1.08
  - `exchange_rate_date`: Fatura tarihi (Asla `null` bırakılamaz)
  - `exchange_rate_source`: `"EZB-Referenzkurs (ECB)"`
  - `gross_amount`: Euro karşılığı

---

## 5. ↩️ Gutschrift (İade & Alacak Dekontu) Muhasebe Kuralı
* Bir satıcıdan para iadesi (*Refund / Gutschrift / Erstattung*) geldiğinde bu tutar **GİDERİ AZALTIR (Negatif Gider / - Netto & - Brutto)**.
* Asla yeni bir pozitif gider olarak eklenemez!
* `document_type = "credit_note"` olan tüm kayıtlar:
  - Toplam EÜR Netto giderinden düşülür (`- net`).
  - Toplam Brütodan düşülür (`- gross`).
  - Vorsteuer (§ 15) matrahından düşülür.
  - Firma bazlı harcama kartlarında satıcının toplam harcamasını düşürerek net bakiyeyi gösterir.
  - Tabloda **`- 15,46 €`** şeklinde yeşil renkte gösterilir.

---

## 6. 💳 Asıl Fatura vs. PayPal / Stripe Ödeme Dekontu (Mükerrerlik Koruması)
* Bir siparişte hem satıcı faturası (*Rechnung*) hem de ödeme aracı dekontu (*PayPal Receipt / Stripe Notification*) gelebilir.
* **GoBD Kuralı:** Gider **yalnızca 1 kez (asıl fatura üzerinden)** yazılır.
* PayPal / Stripe ödeme onayları e-postadan geldiğinde:
  - `document_type = "payment_receipt"` olarak etiketlenir.
  - `is_deductible = false` yapılır (EÜR'de mükerrer düşülmez).
  - Asıl faturaya ödeme kanıtı (*Zahlungsnachweis*) olarak bağlanır.

---

## 7. 🔄 Abonelik Türleri & Aylık Sabit Maliyet (Fixkosten) Hesabı
* **Yıllık Abonelikler (`recurring_interval = "yearly"`):**
  - GoDaddy alan adı / hosting yenilemeleri gibi yıllık ödemeler **12'ye bölünerek (`gross / 12`)** aylık sabit gider KPI'ına yansıtılır.
* **Aylık Abonelikler (`recurring_interval = "monthly"`):**
  - Anthropic, OpenRouter, Codeium, Hetzner vb. aylık tutarlarıyla fixcost'a eklenir.

---

## 8. 🚗 Fahrtenbuch (Seyir Defteri & 0,30 €/km Kilometre Hesabı)
* Şahsi araçla yapılan işle ilgili sürüşler: **0,30 €/km** (BMF Kilometersatz nach § 9 EStG) olarak EÜR'de işletme gideri yazılır.
* Paneldeki `#fahrtenbuch` modülünde GoBD formatında CSV olarak dışa aktarılır.
