# Praxura Lokal — Hukuki Gereksinimler ve Evrak İçerikleri

> **Amaç:** On-premise modele geçişte değişmesi/yazılması gereken tüm hukuki evrakın listesi + her birinin içerik iskeleti. Bu doküman avukata gidecek brifingin temelidir — **nihai metinleri healthcare-IT avukatı yazmalı/onaylamalı**, buradakiler içerik gereksinimleridir, hukuki tavsiye değildir.
>
> Hazırlayan: Claude Fable 5, 2026-07-06. Bağlantılı: `ONPREM_MIGRATION_PLAYBOOK.md` (Faz 6), `ON_PREMISE_ANALYSE.md`.

---

## 1. VERTRAGSTYP: Neden önemli, ne seçiyoruz

Alman hukukunda yazılım sözleşmesinin BGB tipi, yükümlülüklerimizi belirler:

| Model | BGB tipi | Sonuç |
|---|---|---|
| Süresiz devir + tek ödeme | Kaufvertrag | Gewährleistung 2 yıl (B2B'de 1 yıla indirilebilir); update yükümlülüğü sınırlı |
| **Süreli kullanım + aylık ödeme (bizim model)** | **Mietvertrag (Softwaremiete)** | **Kullanılabilirliği kira süresi boyunca BİZ sağlamak zorundayız** (Gebrauchstauglichkeit) — yani bug-fix/uyumluluk güncellemeleri sözleşmesel BORÇ, opsiyon değil |
| Destek/bakım hizmetleri | Dienstvertrag (ayrı bölüm) | Support SLA'sız "makul çaba" olarak tanımlanabilir |

**Karar (kilitli):** Abonelik = Softwaremiete + entegre Softwarepflege (tek sözleşme, ayrı bölümler). Bu, mevcut SaaS fiyat modeliyle uyumlu ve §302 için zorunlu sürekli güncelleme gerçeğiyle örtüşüyor.

---

## 2. YAZILACAK/DEĞİŞECEK EVRAK LİSTESİ

| # | Evrak | Durum | Öncelik |
|---|---|---|---|
| E1 | **AGB / Softwaremietvertrag "Praxura Lokal"** (B2B) | YENİ — içerik iskeleti §3'te | 🔴 go-live blocker |
| E2 | **Sperrklausel** (lisans/salt-okunur mod maddesi) | YENİ — E1'in içinde, hukuken en hassas madde, §4'te | 🔴 go-live blocker |
| E3 | **Fernwartungs-AVV şablonu** (opsiyonel destek erişimi için) | YENİ — §5'te | 🟠 hazır dursun |
| E4 | **Mevcut SaaS-AVV** | on-prem müşterileri için GEÇERSİZ — SaaS'ta kalanlar için sürer | 🟢 dokunma |
| E5 | **Datenschutzerklärung (praxura.de)** | GÜNCELLE: on-prem müşterisi için işlenen veri = yalnızca B2B hesap/fatura/lisans verisi; hasta verisi işlemediğimiz açıkça yazılmalı (satış argümanı da) | 🟠 |
| E6 | **Muster-Datenschutzhinweise** (praxis'in kendi hastalarına vereceği örnek metin) | GÜNCELLE: "Verarbeitung erfolgt lokal auf praxiseigenem Server; kein Cloud-Dienstleister" varyantı — müşteriye değer katan ek | 🟢 |
| E7 | **Lizenzbedingungen içinde açık-kaynak bileşen listesi** (Supabase Apache-2.0, PostgreSQL, Caddy vb. lisans bildirimleri) | YENİ — pakete NOTICE dosyası + AGB'de atıf | 🟠 |
| E8 | **CRA uyum dokümanları** (§6): güvenlik güncelleme taahhüdü, destek süresi beyanı, koordineli açık bildirim (CVD) politikası sayfası | YENİ | 🟠 Eylül 2026 (bildirim), Aralık 2027 (tam) |
| E9 | **EU AI Act Art. 6(3) gerekçe dokümanı** + Art. 50 şeffaflık metinleri (UI'da "KI-generiert" işaretleri) | YENİ/kontrol | 🟠 Ağustos 2026 |
| E10 | **Impressum** | değişmez | 🟢 |
| E11 | AGB'de **yedekleme sorumluluğu + Mitwirkungspflichten** maddesi | YENİ — E1 içinde kritik bölüm | 🔴 |

Mevcut hukuki açık maddeler (2026-06-02 audit: Google Fonts CDN, USt tutarsızlığı, B2C Widerruf, DPA Art. 28 boşlukları) ayrıca duruyor — on-prem bunlardan DPA/AVV boşluğunu çözer, diğerleri bağımsız.

---

## 3. E1 — AGB "Praxura Lokal" İÇERİK İSKELETİ

1. **Vertragsgegenstand:** Süreli yazılım kullanım hakkı (Softwaremiete); yazılım müşterinin kendi altyapısında çalışır; Praxura hasta/işletme verilerine erişmez ve bunları işlemez (kein Auftragsverarbeitungsverhältnis — açıkça yaz).
2. **Nutzungsrechte:** Basit, devredilemez, süreli lisans; Standort/kullanıcı kapsamı plan bazlı; alt-lisans/yeniden satış yasağı YOK yazılamaz ama süreli mietmodell'de devir doğal olarak sınırlı (avukat formüle etsin — "Weiterverkaufsverbot" AGB'de kaufmodell için geçersizdi, miet'te farklı).
3. **Updates & Softwarepflege:** Güncellemelerin kapsamı (bug-fix, güvenlik, yasal uyumluluk — özellikle §302/Kostenträger sürümleri); müşterinin update'leri makul sürede kurma YÜKÜMLÜLÜĞÜ (otomatik kanal açık tutma); eski sürüm destek penceresi (örn. son 2 minor); update kurulmazsa Gewährleistung sınırlaması.
4. **Mitwirkungspflichten des Kunden (kritik bölüm):**
   - Asgari sistem gereksinimleri (2 vCPU/4GB/40GB, AB lokasyonu, internet erişimi)
   - **Yedekleme:** paket otomatik yedek aracı sunar; yedeklerin çalıştığını düzenli doğrulamak ve saklamak MÜŞTERİNİN sorumluluğu; veri kaybında Praxura sorumluluğunun sınırı
   - Sunucu/OS güvenliği, erişim yönetimi, kendi DSGVO yükümlülükleri (Verantwortlicher sıfatıyla)
   - Üçüncü-taraf hesapları (Hetzner, IONOS AI, SMTP) müşterinin kendi sözleşmeleri
5. **Verfügbarkeit:** SaaS-tipi uptime taahhüdü YOK (yazılım müşterinin altyapısında) — sadece yazılımın kararlılığı için Gewährleistung; lisans/update sunucumuz için makul erişilebilirlik.
6. **Gewährleistung & Haftung:** B2B standart sınırlamalar; kasıt/ağır ihmal + Kardinalpflichten istisnaları (AGB'de tamamen dışlanamaz); veri kaybı için sorumluluk "müşteri düzgün yedek alsaydı oluşmayacak zararla" sınırlı (yaygın ve geçerli formül); §302 içerik sorumluluğu: "Tool, kein Abrechnungsdienstleister" konumlandırması (mevcut AGB'deki Haftungsausschluss taşınır).
7. **Sperrklausel:** bkz. §4 — ayrı, şeffaf, vurgulu.
8. **Vertragsende:** Salt-okunur mod süresiz mü / ne kadar; **veri ihracı her durumda mümkün** (DSGVO + BGH'nin veri-rehin içtihatlarına uyum); yazılımı silme yükümlülüğü; hasta dokümantasyonu saklama süreleri müşterinin sorumluluğunda (10 yıl §§ 84-85 SGB X — yazılım salt-okunur modda buna erişim vermeye devam eder).
9. **Preise/Zahlung:** Stripe; fiyat değişikliği bildirimi; USt %19.
10. **Schlussbestimmungen:** Almanya hukuku, Gerichtsstand, salvatorische Klausel.

---

## 4. E2 — SPERRKLAUSEL (kill-switch) HUKUKİ ÇERÇEVESİ

**İçtihat özeti (araştırma 2026-07-06):**
- Gizli/sözleşmede bildirilmemiş program kilidi → yazılım ayıbı sayılabilir ve **widerrechtliche Drohung** riski (BGH Programmsperre içtihadı; LG München I 7 O 115/00).
- **Her gecikmede otomatik toptan kilit** AGB maddesi → §307 BGB'ye aykırı, GEÇERSİZ (OLG Koblenz webhosting; OLG Schleswig-Holstein 6 U 41/08 paralel).
- Geçerlilik koşulları: (a) sözleşmede açık ve şeffaf bildirim, (b) önce **Mahnung** + makul ödeme süresi, (c) orantılılık (küçük gecikme ≠ tam kilit), (d) verilere erişim kesilmemeli.

**Bizim tasarımın hukuki eşlemesi (playbook Faz 3 ile birebir uyumlu — bu tesadüf değil, tasarım buna göre yapıldı):**

| Teknik adım | Hukuki karşılık |
|---|---|
| Lisans 30 gün geçerli + gecelik yenileme | Sözleşmede açıkça tanımlı mekanizma (şeffaflık koşulu) |
| Ödeme başarısız → panelde uyarı ("X gün kaldı") | Mahnung işlevi — AGB'de "elektronische Zahlungserinnerung" olarak tanımlanmalı + E-POSTA ile de Mahnung gönderilmeli (yalnız panel uyarısı yetmez — ödeme yapmayan panele girmiyor olabilir) |
| +14 gün tolerans | Makul Nachfrist (orantılılık) |
| Salt-okunur mod: görüntüleme + export AÇIK | Verilere erişim kesilmiyor → içtihadın ana itirazı bertaraf |
| Tam silme YOK | Hasta dokümantasyonu saklama yükümlülüğü ihlal edilmiyor |

**Faz 3'e eklenen teknik gereksinim:** uyarı yalnızca panel banner'ı değil — tolerans başlangıcında ve bitmeden 7 gün önce **e-posta Mahnung** da gönderilmeli (merkezi sistemden, Stripe fatura e-postasından bağımsız). Playbook'a işlendi.

---

## 5. E3 — FERNWARTUNGS-AVV (opsiyonel)

Varsayılan destek modeli veriye erişimsiz (tanılama paketi) → AVV gerekmez. AMA müşteri ekran paylaşımıyla canlı destek isterse ve ekranda hasta verisi görünecekse hâkim görüş processor ilişkisi görür. Hazır dursun:
- Kapsam: yalnızca destek oturumu süresince, müşteri personeli hazır bulunurken
- Art. 28 standart içerik (talimat bağlılığı, gizlilik, TOM'lar, alt-işleyici yok, silme)
- Oturum bazlı onay + log
- Alternatif (AVV'siz kalmak için): destek oturumunda müşteri test/demo verisine geçer veya PII maskelenir — destek runbook'una yazılacak.

---

## 6. CYBER RESILIENCE ACT (CRA) — on-prem'in getirdiği YENİ yükümlülük

**Dürüst denge:** On-prem bizi §393/AVV'den kurtarır ama piyasaya "digitales Produkt" sürdüğümüz için CRA kapsamına sokar (saf SaaS CRA değil NIS2 tarafında; lokal bileşenli yazılım ürünü CRA'da).

| Tarih | Yükümlülük |
|---|---|
| **11 Eylül 2026** (yakın!) | Aktif sömürülen açık + ciddi olaylar için bildirim: 24h ilk bildirim → 72h detay → 14 gün final rapor (ENISA/BSI kanalı) |
| **11 Aralık 2027** | Tam uygulama: secure-by-design temel gereksinimleri, ürün yaşam döngüsü boyunca açık yönetimi, SBOM, kullanıcıya şeffaflık, **CE işareti** |

**Praxura sınıflandırması:** Praxis-yönetim yazılımı CRA'nın "important/critical products" (Annex III/IV) listelerinde DEĞİL → varsayılan kategori → **öz-değerlendirme yeterli, notified body gerekmez.** Maliyet yönetilebilir.

**Yapılacaklar (playbook Faz 6'ya eklendi):**
1. CVD (coordinated vulnerability disclosure) politikası + security@praxura.de + web sayfası
2. SBOM üretimi build pipeline'a (`npm sbom` / syft, CycloneDX formatı) — Faz 2 paketine
3. Destek süresi beyanı ("ürün en az X yıl güvenlik güncellemesi alır") — AGB + ürün sayfası
4. Bildirim süreç runbook'u (24h/72h/14g zinciri kim-ne-nasıl)
5. Aralık 2027 öncesi: temel gereksinim öz-değerlendirmesi + teknik dokümantasyon + CE beyanı

---

## 7. AVUKAT BRİFİNG PAKETİ (hazır olunca verilecek)

1. Bu doküman + `ON_PREMISE_ANALYSE.md`
2. İş modeli özeti: fiyatlar, kanallar, beta→ücretli geçiş planı
3. Sperrklausel teknik akış şeması (Faz 3 tasarımı)
4. Sorulacak net sorular: (a) Sperrklausel formülasyonu, (b) Mietrecht'te update yükümlülüğü kapsam sınırı, (c) veri kaybı sorumluluk sınırlaması formülü, (d) CRA destek süresi beyanının asgari süresi, (e) açık-kaynak NOTICE yeterliliği
5. Tahmini bütçe: AGB seti €1.500–3.000 (2026-06 audit tahminiyle uyumlu)

---

## Kaynaklar

- [IHK Stuttgart — Überlassung von Standardsoftware: Regeln](https://www.ihk.de/stuttgart/fuer-unternehmen/recht-und-steuern/it-recht/ueberlassung-von-standardsoftware-das-sind-die-regeln-4368114)
- [Schutt Waetke — Lizenzierung von Software: Vertragstypen](https://schutt-waetke.de/aktuelles/lizenzierung-von-software-die-tuecken-der-vertragstypen/)
- [Liesegang & Partner — Softwarelizenzvertrag AGB B2B örnekleri](https://www.liesegang-partner.de/mustervertraege/software-vertraege/softwarelizenzvertraege/softwarelizenzvertrag-agb-b2b)
- [BGH Programmsperre — JurPC 0069/2000](https://www.jurpc.de/jurpc/show?id=20000069)
- [LG München I, 7 O 115/00 — Programmsperre](https://www.flick-sass.de/programmsperre.html)
- [IT-Recht Kanzlei — Zahlungsverzug & Sperre (OLG Koblenz)](https://www.it-recht-kanzlei.de/zahlungsverzug-webhosting-vertrag.html)
- [OLG Schleswig-Holstein 6 U 41/08 — Sperrklausel unwirksam](https://aufrecht.de/urteile/telekommunikation/unzulaessige-agb-klauseln-eines-mobilfunkanbieters-der-bei-verzug-das-handy-sperrt-olg-schleswig-holstein-beschluss-vom-14052009-az-6-u-4108)
- [BSI — Cyber Resilience Act](https://www.bsi.bund.de/DE/Themen/Unternehmen-und-Organisationen/Informationen-und-Empfehlungen/Cyber_Resilience_Act/cyber_resilience_act_node.html)
- [EU Kommission — Cyber Resilience Act](https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act)
- [BOS — CRA Pflichten & Fristen](https://www.bos-kg.de/cyber-resilience-act/)
- [Hogan Lovells — CRA Vulnerability & Incident Reporting](https://www.hoganlovells.com/en/publications/eu-cyber-resilience-act-preparing-for-vulnerability-and-incident-reporting)

*2026-07-06 — bu doküman avukat onayından geçene kadar taslak statüsündedir.*
