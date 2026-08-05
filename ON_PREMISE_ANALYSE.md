# Praxura — On-Premise / Self-Hosted Model Analizi

**Tarih: 2026-07-06 | Soru: SaaS yerine müşterinin kendi sunucusunda çalışan paket satarsak regülasyon yükümüz ne kadar azalır, teknik olarak mümkün mü?**

---

## KISA CEVAP

**Evet, regülasyon farkı çok büyük — ama "her şeyden kurtulma" değil.**

- En pahalı yük olan **§393 SGB V / BSI C5-Testat (~€200k'ya varan maliyet) tamamen düşer.** Kanun yalnızca "Cloud-Computing-Dienste" için geçerli; müşterinin kendi sunucusunda çalışan yazılım kapsam dışı.
- **DSGVO'da rolümüz değişir:** SaaS'ta Auftragsverarbeiter'iz (AVV, Art. 28 zinciri, TOM'lar, veri ihlali sorumluluğu). On-prem'de sadece **yazılım tedarikçisiyiz** — hasta verisine hiç dokunmayız, Auftragsverarbeiter rolü prensipte düşer. Tek istisna: veriye erişebilen **Fernwartung/destek** — o varsa rol geri gelir.
- **Değişmeyenler:** MDR konumlandırması, EU AI Act "Anbieter" yükümlülükleri, §302/ITSG Systemuntersuchung, ürün sorumluluğu (Produkthaftung), kendi muhasebemiz için GoBD. Bunlar ürünü takip eder, hosting'i değil.
- **Kötüleşenler:** n8n pakete konamaz (lisans ihlali), destek/update yükü artar, ve en önemlisi: **hedef müşterimiz (küçük physio praxis) sunucu işletemez.** Pazar lideri Theorg bunu "Windows'a lokal kurulan masaüstü uygulama" ile çözüyor — sektörde kanıtlanmış model.

---

## 1. REGÜLASYON KARŞILAŞTIRMASI: SaaS vs. On-Premise

| Yükümlülük | SaaS (bugün) | On-Premise | Fark |
|---|---|---|---|
| **§393 SGB V / BSI C5-Testat** | 🔴 Zorunlu (Temmuz 2025'ten beri); ISO 27001 köprüsüyle bile €15–40k + 24 ayda gerçek C5 | ✅ **Uygulanmaz** — kanun sadece cloud hizmetleri kapsar | **EN BÜYÜK KAZANÇ** |
| **DSGVO Auftragsverarbeiter (Art. 28)** | 🔴 Biz processor'üz: AVV, TOM, sub-processor zinciri (Supabase/Vercel/Azure), ihlal bildirimi | ✅ Düşer — veri müşteride kalır. ⚠️ İstisna: veriye erişimli Fernwartung → AVV yine gerekir | Büyük kazanç |
| **DSFA (Art. 35)** | 🔴 Bizde (sağlık verisi büyük ölçekli işleme) | ✅ Müşterinin sorumluluğu (zaten her praxis'in var olan yükümlülüğü) | Kazanç |
| **Externer DSB (Art. 37)** | 🟠 Muhtemelen zorunlu (€1.5–4k/yıl) | 🟡 Büyük ölçüde düşer (hasta verisi işlemiyoruz) | Kazanç |
| **Veri ihlali sorumluluğu (Art. 33/34, Haftung)** | 🔴 Bizde | ✅ Müşteride (kendi sunucusu) | Kazanç |
| **10 yıl §302 arşiv saklama (§§84–85 SGB X)** | 🔴 Müşteri ayrılsa bile bizde | ✅ Müşterinin diski, müşterinin sorumluluğu | Kazanç |
| **MDR (Medizinprodukt sınırı)** | Aynı | Aynı — OCR "Verwaltungstool" konumlandırması her iki modelde şart | Fark yok |
| **EU AI Act (Anbieter rolü)** | Aynı | Aynı — piyasaya AI özellikli ürün süren "Anbieter" biziz, deployment modeli rolü değiştirmez. Art. 6(3) non-high-risk gerekçelendirmesi her iki modelde lazım | Fark yok |
| **§302 / ITSG Systemuntersuchung** | Gerekli | Gerekli — yazılım ürünü test edilir, nerede çalıştığı önemsiz | Fark yok |
| **GoBD (kendi faturalarımız)** | Gerekli | Gerekli | Fark yok |
| **TI/gematik (2027+)** | Gerekli | Gerekli (konnektor entegrasyonu lokalde hatta daha doğal) | Fark yok |
| **n8n Sustainable Use License** | 🟠 İç kullanım OK | 🔴 **Pakete koymak = ücretli müşteriye dağıtım = lisans ihlali.** n8n on-prem paketten çıkmak zorunda | **Kötüleşir** |

### Kritik nüanslar

1. **Fernwartung tuzağı:** Hâkim görüşe göre, kişisel veriye erişimi dışlanamayan uzak bakım/destek erişimi varsa on-prem'de bile Auftragsverarbeiter oluruz. Çözüm: (a) destek erişimi yalnızca müşteri personeli ekran başındayken + oturum bazlı onay, (b) loglara/DB'ye erişimsiz "update-only" mekanizması, (c) yine de küçük bir "Fernwartungs-AVV" şablonu hazır tutmak (sektör standardı).
2. **"Müşterinin kiraladığı sunucu" durumu:** Praxis kendisi Hetzner'den sunucu kiralayıp paketimizi kurarsa, cloud kullanan **müşteridir**, biz değiliz. Hetzner **Aralık 2025'te BSI C5 Typ-2 testatı aldı** — yani müşteri §393 yükümlülüğünü Hetzner'in testatıyla karşılar; bizim hiçbir testat yükümüz olmaz. Bu, "praxis'te fiziksel sunucu yok" problemine en temiz çözüm.
3. **Bizim yönettiğimiz per-müşteri VM kaçış DEĞİL:** "Her müşteriye ayrı VM açarız, biz yönetiriz" (managed private cloud) modelinde hâlâ cloud hizmeti sunan/processor olan biziz → §393 + AVV aynen geçerli. Bu yol regülasyondan kurtarmaz.
4. **Stripe kalabilir:** Stripe yalnızca **bizim B2B lisans faturalarımızı** işler (praxis sahibinin ödeme verisi, hasta verisi değil). Sağlık-verisi regülasyonlarının hiçbiri buna dokunmaz. On-prem modelde de lisans aboneliği Stripe üzerinden alınır.

---

## 2. AI ÖZELLİKLERİ ON-PREM'DE NASIL ÇALIŞIR?

Bugün: Rezept-OCR, B2C draft, rezept-validate, AI series scheduling → `ai/router.js` → Azure OpenAI (Sweden Central, EU Data Boundary), bir kısmı n8n üzerinden.

| Seçenek | Nasıl | Regülasyon | Değerlendirme |
|---|---|---|---|
| **A. BYO-Key (önerilen)** | Müşteri kendi Azure OpenAI aboneliğini açar (veya biz reseller onboarding'i kolaylaştırırız); on-prem uygulama müşterinin key'iyle direkt Azure'a gider | Müşteri ↔ Microsoft direkt sözleşme; Azure'un C5 Typ-2 testatı var → §393 uyumlu; biz veri akışının dışındayız. AI Act'te müşteri "Deployer", biz "Anbieter" (ürün yükümlülükleri bizde ama hafif — Art. 50 şeffaflık + Art. 6(3) gerekçe) | En temiz. `azureClient.js` zaten env-var tabanlı, kod değişikliği minimal |
| **B. Lokal LLM (Ollama vb.)** | Paketle birlikte lokal model | Sıfır dış veri akışı | Gerçekçi değil: praxis donanımı yetmez, OCR kalitesi düşer |
| **C. AI'yı bizim cloud hizmetimiz olarak tutmak** | On-prem uygulama bizim gateway'imize çağrı yapar | O dilim için yeniden Auftragsverarbeiter + muhtemelen §393 kapsamına gireriz → kazanımın yarısı gider | Kaçınılmalı; ancak "AI'sız baz paket + opsiyonel cloud-AI modülü (ayrı AVV ile)" ara ürün olabilir |

**Sonuç:** AI Act yükümlülüğünden on-prem kurtarmıyor ama mevcut konumlandırma (idari OCR, minimal/limited risk, Art. 6(3) yazılı gerekçe) zaten yönetilebilir. Kritik olan MDR/AI Act değil, veri akışı — o da BYO-Key ile çözülüyor.

---

## 3. TEKNİK FİZİBİLİTE (kod envanteri özeti)

Tam envanter için ayrıca çıkarılan rapora bakınız; karar için önemli olanlar:

| Bileşen | Bugün | On-prem'de | Efor |
|---|---|---|---|
| **Supabase (Auth+Postgres+Vault+Realtime)** | Cloud, tüm hasta/işletme verisi burada | **Self-hosted Supabase** (Docker, drop-in — RLS/Auth/Realtime kodu aynen çalışır) veya sade Postgres + kendi JWT auth | Self-hosted Supabase: ~1–2 hafta entegrasyon-test; sade Postgres: 4–8 hafta |
| **Vercel serverless (api/)** | config, stripe, onboarding, dsgvo, admin | Stripe/onboarding **bizim SaaS tarafımızda kalır** (lisans satışı); geri kalanı Express'e taşınır | 2–4 hafta |
| **api-backend/server.js (Express)** | VPS'te, zaten Docker'lı | Paketin çekirdeği — neredeyse hazır | Düşük |
| **n8n** | Azure AI gateway + webhook | Paketten çıkar; AI çağrıları zaten `ai/router.js`'te direkt Azure'a gidiyor, n8n'e kalan webhook akışları Express route'a taşınır | 2–3 hafta |
| **Google Calendar/Gmail OAuth** | Bizim OAuth app + Vault'ta token | Sorunlu: lokal kurulumda public redirect URL yok. Seçenek: on-prem'de Google sync'i düşür, CalDAV ekle veya müşteri kendi OAuth app'ini kaydeder | Düşürmek: 0; CalDAV: 2–3 hafta |
| **Email** | GoDaddy SMTP | Müşteri kendi SMTP bilgisini girer (nodemailer zaten provider-agnostik) | ~0 |
| **Sentry** | Cloud, PII-scrub'lı | Opsiyonel telemetri: müşteri onayıyla açık kalabilir (hasta verisi gitmiyor) veya lokal error-log tablosu | 2–3 gün |
| **Stripe** | Plan gating `profiles.plan` | **Lisans anahtarı sistemi**: imzalı lisans dosyası (plan, süre, modüller) → mevcut plan-gating kodu lisans okumaya bağlanır | 1–2 hafta |
| **§302/DTA + PKCS#7** | Zaten browser/lokal-ağırlıklı | On-prem'e doğal uyar — imzalama zaten client'ta | ~0 |
| **Deploy/update** | Vercel + Watchtower/GHCR | Versiyonlu Docker Compose paketi + imzalı lisansla private registry'den `docker compose pull` (opsiyonel otomatik update) | 2–3 hafta + dokümantasyon |

**Toplam gerçekçi efor: ~2,5–4 ay** (self-hosted Supabase yolu seçilirse alt bant). Kod tabanının işimizi kolaylaştıran özellikleri: backend zaten tek Express + Docker; AI client zaten env-var/endpoint soyutlamalı; §302 imzalama zaten lokal; e-posta zaten SMTP.

**Multi-tenant kod tek müşteride sorunsuz çalışır** — `owner_id`/RLS overhead'i zararsız, kod ikiye çatallanmaz (tek codebase, iki dağıtım). Bu kritik: SaaS'ı öldürmeden on-prem SKU eklenebilir.

---

## 4. İŞ MODELİ GERÇEKLERİ (regülasyon dışı riskler)

1. **Hedef müşteri sunucu işletemez.** 1–5 kişilik physio praxis'te IT personeli yok. Theorg bunu "resepsiyon PC'sine kurulum + lokal ağ" ile çözüyor. Bizim paketimiz Docker istiyor → ya **tek-tık Windows installer** (Docker Desktop gömülü / tek binary) ya da "müşterinin kendi Hetzner hesabına 1-tık kurulum scripti" gerekir. Bu UX işi, teknik migrasyondan daha belirleyici.
2. **Yedekleme sorumluluğu müşteriye geçer** — bu bizim için kazanç ama satışta risk: "diskim yandı, 10 yıllık abrechnung verim gitti" durumunda sözleşmesel olarak sorumluluğun müşteride olduğu AGB'de net yazılmalı + pakete otomatik lokal yedek (ör. gecelik dump + USB/NAS hedefi) konmalı.
3. **Update dağıtımı:** SaaS'taki "günde 3 deploy" rahatlığı biter; versiyonlama, migration script'leri, sürüm destek penceresi (ör. son 2 minor) disiplini gerekir.
4. **Pazar sinyali çift yönlü:** Pazar cloud'a kayıyor (Optica Viva, MD Therapie) ama Theorg'un on-prem tabanı hâlâ en büyük. "Verileriniz praxis'inizde kalır, hiçbir bulut yok" mesajı veri-hassas Almanya pazarında **güçlü bir satış argümanıdır** ve bizi C5 maliyetinden kurtarırken rakiplere karşı farklılaştırır.

---

## 5. ÖNERİLEN YOL: İKİ SKU'LU HİBRİT STRATEJİ

**SKU 1 — "Praxura Lokal" (yeni, regülasyon kaçışı):**
Docker Compose paketi (self-hosted Supabase + Express + nginx + frontend). Müşteri kendi donanımında **veya kendi Hetzner hesabında** (Hetzner C5'li) çalıştırır. Lisans anahtarıyla plan gating; Stripe'la lisans aboneliği bizde. AI = BYO Azure key veya kapalı. Google sync yerine CalDAV/ICS. Destek = update-only, veriye erişimsiz; opsiyonel oturum-bazlı Fernwartung ayrı mini-AVV ile.
→ **Bizim regülasyon yükümüz: pratikte sadece ürün regülasyonları (MDR konumlandırma, AI Act Anbieter, ITSG). C5 yok, AVV yok, DSFA yok, ihlal sorumluluğu yok.**

**SKU 2 — mevcut SaaS (devam):**
C5 sorunu için: Hetzner'in yeni C5 testatı + Supabase'in AWS Frankfurt altyapısı scope'u daraltıyor; kendi app katmanımız için ISO 27001 köprüsü (~€15–25k) hâlâ gerekli. SaaS'tan tamamen çıkılırsa bu da düşer — ama mevcut müşteriler ve düşük-friction onboarding SaaS'sız zor.

**Sıralama önerisi:** Önce SKU 1'i Hetzner-self-managed varyantıyla çıkar (installer UX'i en kolay olan), praxis-içi Windows kurulumu ikinci faz. İlk 2 hafta: self-hosted Supabase PoC + lisans-anahtarı tasarımı — bu ikisi tüm planın en büyük iki bilinmeyeni.

---

## Kaynaklar

- [Rödl & Partner — C5-Testatpflicht nach §393 SGB V](https://www.roedl.com/insights/c5-testatpflicht-nach-paragraph-393-sgb-v/)
- [activeMind — Datenverarbeitende Stelle nach §393 SGB V](https://www.activemind.de/magazin/c5-datenverarbeitende-stelle/)
- [SRD Rechtsanwälte — Cloud im Gesundheitswesen: §393 SGB V und C5-Testat](https://www.srd-rechtsanwaelte.de/blog/cloud-nutzung-im-gesundheitswesen-393-sgb-v-und-c5-testat)
- [BVMed — Infoblatt C5-Testat / §393 SGB V](https://www.bvmed.de/themen/recht/infoseite-c5-testat-393-sgb-v-cloud-einsatz-im-gesundheitswesen)
- [digital-recht.at — Müssen Softwareanbieter einen AVV abschließen?](https://www.digital-recht.at/blog/muessen-softwareanbieter-einen-dsgvo-auftragsverarbeitervertrag-abschliessen)
- [regina-stoiber.com — Wann handelt es sich um einen Auftragsverarbeiter?](https://regina-stoiber.com/2018/04/12/wann-handelt-es-sich-um-einen-auftragsverarbeiter-auftragsdatenverarbeiter-dsgvo/)
- [Hetzner — BSI C5-Testat (Dez 2025)](https://www.hetzner.com/de/news/hetzner-receives-bsi-c5-certification/)
- [ai-risk-check — Provider oder Deployer? EU AI Act Rollen-Guide](https://ai-risk-check.com/ratgeber/provider-oder-deployer)
- [artificialintelligenceact.eu — Art. 50 Transparenzpflichten](https://artificialintelligenceact.eu/article/50/)
- [ITSG — Systemuntersuchung](https://www.itsg.de/produkte/systemuntersuchung/)
- [FitPro Tools — Physiotherapie Software Vergleich 2026 (Theorg on-prem vs. Cloud-Markt)](https://fitprotools.de/physiotherapie-software/)
- Repo: `REGULATORY_AUDIT.md` (Haziran 2026 landmine audit'i), kod envanteri (Explore agent, 2026-07-06)
