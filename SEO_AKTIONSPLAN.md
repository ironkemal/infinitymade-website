# Praxura SEO — Aktionsplan (Stand 2026-06-02)

Bu dosya: kodda yapılanlar + **senin yapman gereken hesap/off-page işleri** (öncelik sırasıyla).

---

## ✅ Kodda yapıldı (canlı)
- **6 keyword landing sayfası** (özgün içerik + SoftwareApplication/FAQPage/BreadcrumbList schema):
  - `praxissoftware-physiotherapie.html`, `-ergotherapie`, `-logopaedie`, `-podologie`
  - `heilmittelabrechnung-software.html` (§302 selbst abrechnen, kommissionsfrei)
  - `ti-anbindung-heilmittel.html` (TI-Pauschale, GKV-refinanziert)
- Anasayfa: görünür **FAQ bölümü + FAQPage schema** (rich snippet), Organization `sameAs`.
- Anasayfa footer'dan tüm yeni sayfalara **iç link** (keşif + otorite).
- `sitemap.xml` güncellendi (10 URL). `robots.txt` sitemap'i gösteriyor.
- Tüm sayfalar: canonical `praxura.de`, OG/Twitter, hreflang de.

---

## 🔴 SEN yapacaksın — ÖNCELİK 1 (hemen, en yüksek etki)

### 1. Google Search Console (GSC) — en kritik
1. https://search.google.com/search-console → **Domain-Property ekle** → `praxura.de`.
2. Doğrulama: Google bir **TXT kaydı** verir → **Cloudflare** DNS'e ekle (praxura.de, TXT, değeri yapıştır) → GSC'de "Verify".
3. **Sitemap gönder**: Search Console → Sitemaps → `https://praxura.de/sitemap.xml` → Senden.
4. **URL Inspection** ile şu sayfalar için tek tek "Indexierung beantragen": anasayfa, praxis.html, 6 landing sayfası.
5. 1-2 hafta sonra: Leistung (queries/clicks) + Abdeckung (indexlenmeyen sayfa) takip et.

### 2. Bing Webmaster Tools
- https://www.bing.com/webmasters → site ekle → **"Import from Google Search Console"** (en hızlı) → sitemap otomatik gelir. (Bing + ChatGPT/Copilot aramaları için önemli.)

---

## 🟠 ÖNCELİK 2 (bu hafta)

### 3. Google Business Profile (GBP) — marka + local
- https://business.google.com → işletme oluştur: **Praxura** (veya "Praxura – InfinityMade"), Kategorie **„Softwareunternehmen"**, Adres Siegburg (veya service-area), Web `https://praxura.de`, Tel +49 152 28033834.
- Marka aramalarında sağda "knowledge panel" çıkmasını sağlar.

### 4. sameAs için marka profilleri (knowledge graph)
Aç ve tutarlı doldur (hepsi `praxura.de`'yi göstersin):
- **LinkedIn** Unternehmensseite "Praxura"
- (opsiyonel) X/Twitter, Instagram, YouTube, Facebook
- Bana profil URL'lerini ver → koddaki Organization `sameAs`'e eklerim (şu an sadece Wikidata var).

### 5. Wikidata
- Şu an `sameAs` eski **InfinityMade** item'ına (Q139764488) işaret ediyor.
- Seçenek A (kolay): O item'a "Produkt: Praxura" + offizielle Website `praxura.de` ekle.
- Seçenek B (daha iyi, ama notability gerekir): **Praxura** için ayrı Wikidata item oluştur (instance of: Software/SaaS, Hersteller: InfinityMade, official website praxura.de). Wikidata bağımsız kaynak ister — basın/inceleme linki olunca daha kolay.
- Yeni item Q-numarasını bana ver → koda eklerim.

---

## 🟡 ÖNCELİK 3 (süreklilik — asıl sıralamayı bunlar belirler)

### 6. Backlink / Listelenme (off-page otorite = en büyük ranking faktörü)
Praxura'yı şu tip yerlere ekle (çoğu ücretsiz, "Anbieter eintragen"):
- **Software-Vergleichsportale**: OMR Reviews, Capterra DE, GetApp DE, Trusted.de, softguide.de, physiosoftware-vergleich.de, physio.de/produkte.
- **Heilmittel/Branchen-Verzeichnisse** ve Verbände-Listen.
- **Lokale Verzeichnisse**: Gelbe Seiten, 11880, Das Örtliche (NAP tutarlı: aynı isim/adres/tel).
- Rakipler (THEORG, thevea, Optica, appointmed, Henara, DMRZ) bu portallarda var — sen de olmalısın.

### 7. İçerik / Blog (topical authority)
- Mevcut blog güçlü. Düzenli yeni yazı ekle (ör. "TI-Anbindung Schritt für Schritt", "Absetzungen vermeiden", "Blankoverordnung 2026", "Abrechnungszentrum vs. selbst abrechnen"). Her yazı ilgili landing sayfasına link versin.
- İstersen ben yeni blog yazıları + her landing'e özel OG-görseli üretebilirim.

### 8. Teknik (çoğu hazır)
- ✅ Hızlı (WebP, lean), mobil uyumlu, HTTPS, sitemap, schema.
- Core Web Vitals'ı GSC'de izle.
- `www.praxura.de` → `praxura.de` tek canonical'a yönlensin (Vercel ayarı; genelde otomatik).

---

## Ne istersen ben de yapabilirim (kodda)
- praxis.html + blog'a da bu landing sayfalarına iç link.
- Her landing için ayrı OG-görseli.
- Blog yazılarına Article/BlogPosting schema (eksikse).
- sameAs/Wikidata Q-no güncelleme (sen verince).
- Landing sayfalarına "Kostenlos starten → app.praxura.de" CTA ekleme (şu an Analysegespräch modeli).

**Özet öncelik:** 1) GSC + sitemap, 2) Bing, 3) GBP + LinkedIn, 4) Vergleichsportallere kayıt. İlk üçü 1 saatlik iş, en büyük farkı yaratır.
