# Hukuki Karar Kaydı (Legal Decisions Register)

> Kapatılmış hukuki kararlar. `legal-de` ajanı bu dosyayı her görevde okur ve buradaki kararları
> **yeni bir olgu olmadan yeniden tartışmaya açmaz** (yasa değişikliği, mimari değişiklik,
> eşik aşımı = yeni olgu sayılır).
>
> Format: `| Tarih | Karar | Gerekçe / Fundstelle | Durum | Yeniden değerlendirme tetiği |`

| Tarih | Karar | Gerekçe / Fundstelle | Durum | Yeniden değerlendirme tetiği |
|---|---|---|---|---|
| 2026-06-11 | **Externer DSB atanmayacak** | Art. 37 Abs. 1 lit. a–c DSGVO'nun üç kriteri de karşılanmıyor; beta fazı, ErwG 91 anlamında "umfangreich" eşiği altında → `compliance/DSB_PRUEFVERMERK.md` | Kapalı | Aktif müşteri > 50, veri erişimli 2. çalışan, veya Kerntätigkeit değişimi |
| 2026-07-06 | **SaaS → on-premise pivotu** | §393 SGB V / BSI C5 Typ-2 yükümlülüğünden kapsam dışına çıkma; C5 maliyeti >€200k = ⛔ varoluşsal → `ON_PREMISE_ANALYSE.md`, `ONPREM_MIGRATION_PLAYBOOK.md` | Uygulanıyor | C5 denklik kuralının değişmesi; cloud'da hasta verisi işleyen yeni bir zincir eklenmesi |
| 2026-07-06 | **Abonelik tipi = Softwaremiete + entegre Softwarepflege** | BGB Mietvertrag; kullanılabilirlik borcu kira süresince bizde → `LEGAL_ONPREM_REQUIREMENTS.md` §1 | Kapalı | Tek seferlik lisans satış modeline geçiş |
| (öncesi) | **Konumlandırma: "Tool, kein Abrechnungsdienstleister"** | §302 SGB V sorumluluğunu üstlenmemek; metinlerde "abrechnen" değil "vorbereiten"; AGB'de §302 Haftungsausschluss | Kapalı | Abrechnung'u bizim adımıza gönderen bir özellik eklenmesi |
| (öncesi) | **G8 — yeni bulut bağımlılığı yasağı** | On-prem geçiş maliyetini büyütmemek → `CLAUDE.md` | Yürürlükte | On-prem pivotunun iptali |
| 2026-08-06 | **Eş-kurucu Aşama-1 = 2 belge, ıslak imza (Schriftform § 126 BGB), müşteri görüşmesinden önce** | Vertraulichkeit (§ 23 GeschGehG + § 53 BDSG + § 203 Abs. 4 StGB, ayrı paragraflar, nachvertraglich) + Rechteübertragung (§ 31 Abs. 5, § 31a UrhG → e-posta/Textform YETMEZ) **yazılı Gegenleistung ile** (karşılıksız ausschließliche Übertragung § 32 UrhG'ye açık) + **ausdrücklicher GbR-Ausschluss** (§ 705 BGB). Müşteri görüşmesinde katılımcı Erfüllungsgehilfe → ayrı AVV-Unterauftrag gerekmez, ama müşteriye önceden yazılı bilgi + Testmandant → `konsey/tutanak/2026-08-06-esk-kurucu-asama1-belgeleri.md` | Uygulanıyor | Ekim 2026 Beteiligungsvertrag; şirket formunun değişmesi (UG kuruluşu) |
| 2026-08-06 | **Olgu: InfinityMade = Einzelunternehmung (nicht UG/GmbH)** | `agb.html:39`, `datenschutz.html:157` — devredilebilir Geschäftsanteil yok; imzasız birlikte çalışma § 705 BGB GbR karinesi → sınırsız kişisel sorumluluk | Kapalı (olgu) | UG/GmbH kuruluşu yapıldığında |

---

## Bilinçli risk kabulleri (Risikoakzeptanz)

Bilinen ama şu an düzeltilmeyen riskler. Ajan bunları tekrar tekrar uyarı olarak gündeme getirmez —
sadece durum değişirse veya yeni bir bulgu bunları ağırlaştırırsa değinir.

| Tarih | Risk | Neden şimdilik kabul | Gözden geçirme |
|---|---|---|---|
| — | *(henüz kayıt yok)* | | |

---

## Açık hukuki maddeler (karara bağlanmamış)

`legal-de` ajanının çalışma listesi. Karara bağlananlar yukarıdaki tabloya taşınır.

- Google Fonts CDN → TDDDG § 25 / Art. 6 DSGVO (2026-06-02 audit'te açıldı)
- UStG § 19 Kleinunternehmer beyanı ile fiyat/fatura metinleri arasındaki tutarsızlık
- B2C Widerruf akışı (`widerruf.html` ile fiili akışın örtüşmesi)
- AVV / `dpa.html` Art. 28 boşlukları — alt işleyici zincirinin eksiksizliği
- n8n Sustainable Use License'ın ticari SaaS kullanımıyla uyumu
- BFSG Kleinstunternehmen istisnası — belgelenmedi, varsayılıyor
- EU AI Act Art. 50 şeffaflık işaretleri (UI'da "KI-generiert") — kapsam kontrolü
- MDR eşiği: mevcut KI özellikleri (rezept-validate, rezept-ocr) klinik karar desteği sayılır mı
