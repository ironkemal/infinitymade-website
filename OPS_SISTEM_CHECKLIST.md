# Praxura — Dış operasyon sistemi: ihtiyaç listesi + checklist

> **Yazan:** Kemal + Claude, 20.11.2026. **Durum:** taslak — karar verilmedi, hiçbir şey kurulmadı.
> **Kapsam:** uygulamanın *dışındaki* işler: satış, teklif, sözleşme, fatura, destek, hata/izleme,
> otomatik mail, kutu filosu, finans, hukuk-ops. Ürün kodu bu belgenin konusu değil.
> **Fiyat yok:** CLAUDE.md gereği hiçbir araç/paket fiyatı veya ürün fiyatı yazılmadı.
> Açık iş kartları Ops-Dashboard'a gider; bu dosya plan metnidir (ID'ler `#NNN` = Ops kartı).

İşaretler: ✅ hazır · 🟡 yarım / lokal hazır, canlıda değil · ⬜ yok
Öncelik: **P0** = ilk ödeyen kutu müşterisinden ÖNCE · **P1** = ilk 10 müşteri · **P2** = sonra

---

## 0. Özet — tek ekranda

| # | Alan | Bugün | Önerilen yol | Öncelik |
|---|---|---|---|---|
| 1 | Yönetim paneli (komuta merkezi) | ✅ Ops-Dashboard (7 sekme) | Aynı panele **Kunden/Pipeline** + **KPI** sekmesi ekle — yeni araç değil | P0 |
| 2 | Satış / CRM (lead→demo→teklif→kutu) | 🟡 demo-booking + kontakt formu var, pipeline yok | Ops-Dashboard'a pipeline tablosu; harici CRM şimdilik gereksiz | P0 |
| 3 | Teklif (Angebot) + fatura + E-Rechnung | ⬜ | **Hazır muhasebe yazılımı** (Lexware Office veya sevDesk) — kendimiz yazmıyoruz | P0 |
| 4 | Sözleşme + AVV + e-imza | 🟡 compliance belgeleri var, imza akışı yok | AVV/Lizenzvertrag şablonu + **DocuSeal** (self-host) | P0 |
| 5 | Otomatik mail (transaksiyonel + yaşam döngüsü) | 🟡 nodemailer/SMTP var; DKIM/DMARC açık | SMTP aynen; şablon seti; bülten için **Listmonk** (P2) | P0 / P2 |
| 6 | Destek / ticket | ⬜ (mail + TeamViewer) | **FreeScout** (hafif, mail-merkezli) veya başlangıçta ortak posta kutusu | P1 |
| 7 | Hata takibi | 🟡 Sentry frontend+backend var; serverless #33 açık | Sentry kalsın; alarm kuralı + haftalık bakış | P0 |
| 8 | Uptime + status sayfası + alarm | 🟡 disk-check lokal hazır, Kuma #334 açık | **Uptime Kuma** (status.praxura.de) + dış ikinci kontrol | P0 |
| 9 | Kutu filosu (sürüm, lisans, heartbeat, yedek) | 🟡 `merkez/` servis + `/api/status` tasarımı | Merkez verisini Ops-Dashboard'da "Kutular" görünümü | P1 |
| 10 | Finans / EÜR / Mahnung | ✅ Finanzen sekmesi + n8n fatura akışı | Muhasebe yazılımı gelince bunu ona bağla; Steuerberater #11 | P1 |
| 11 | Analytics | ✅ Umami (onay kapısı arkasında) | Değişiklik yok | — |
| 12 | Hukuk-ops (DSGVO talepleri, SLA, Impressum) | 🟡 VVT/TOM/DSFA var; SLA #30 açık | Talep defteri + SLA metni (legal-de) | P0 |
| 13 | Erişim / parola / offboarding | 🟡 | Parola kasası (Bitwarden/Vaultwarden) + 2FA listesi + #125 | P0 |
| 14 | Yedek (ops tarafı) | ⬜ ölçülmedi | Ops-Supabase + VPS yedeği + geri yükleme provası | P1 |
| 15 | Otomasyon yapıştırıcısı | ✅ n8n (VPS) | Yalnız merkez/ops tarafı — **G8 kararı gerekli** (aşağıda) | P0 karar |
| 16 | Claude plugin/skill | ⬜ etkin değil | Anthropic Directory: Sales · Customer Support · Operations · Finance | P1 |

---

## 1. Yönetim paneli — Ops-Dashboard (`ops/`, `ops.infinitymade.de`)

**Hazır olan (koddan doğrulandı, `ops/index.html` sekmeleri):** Aufgaben (Kemal | Gemeinsam | Melih,
Realtime) · Wissensbank · Entscheidungen · Meetings · Finanzen (EÜR, Vorsteuer, CSV/JSON export) ·
Fahrtenbuch · Dateien. Ayrı Supabase projesi (`farkaejociddtgqkusvm`), signup kapalı, RLS.

Karar önerisi: **yeni bir "yönetim aracı" kurma, bunu büyüt.** İki kişilik ekip için ikinci panel =
iki yerde güncellenen veri.

- [ ] **Kunden/Pipeline sekmesi** (bkz. §2) — `ops` Supabase'ine tablo + `ops/kunden.js`
- [ ] **KPI şeridi** (Aufgaben üstünde): açık demo · bekleyen teklif · aktif kutu · açık ticket ·
      son 7 gün Sentry olayı · uptime. Kaynaklar: ops DB + Sentry API + Kuma API (okuma)
- [ ] **Kutular görünümü** (bkz. §9)
- [ ] Haftalık "Montag-Review" ritüeli: KPI + açık kartlar, 30 dk — araç değil, alışkanlık
- ⚠️ Ops-Dashboard'a **hasta verisi girmez** (müşteri = praxis, hasta değil). Praxis iletişim kişisi
  kişisel veridir → ops için VVT girdisi `compliance/VVT.md`'ye eklenmeli

## 2. Satış / CRM — lead → demo → teklif → sözleşme → kurulum → canlı

**Hazır:** `api/demo-booking.js` (demo randevusu), `api/contact.js` (iletişim formu),
`api/apify/search.js` (praxis arama/lead bulma), `praxissoftware-*.html` SEO sayfaları, blog.
**Eksik:** lead'in nerede durduğunu gösteren tek liste.

Araştırma: açık kaynak CRM'ler (Twenty, EspoCRM, Dolibarr — teklif+fatura ile birlikte tek olan Dolibarr)
self-host edilebilir, fakat hepsi ayrı bakım, ayrı kullanıcı, ayrı yedek ister. Twenty ve Odoo AGPL.
Bizim hacmimizde (onlarca praxis) gereksiz. **Öneri: Ops-Dashboard'da tek tablo**, 20-30 kutu
müşterisinden sonra yeniden bak.

- [ ] Aşama listesini sabitle: `Lead → Kontakt → Demo → Angebot → Vertrag/AVV → Installation → Live → (Churn)`
- [ ] Tablo alanları: praxis adı, Fachbereich, şehir, kişi, kaynak (Website/Apify/Empfehlung/Messe),
      aşama, sonraki adım + tarih, sahibi (Kemal/Melih), teklif no, kutu seri no
- [ ] `demo-booking` ve `contact` formundan gelen kaydı **otomatik** "Lead" olarak düşür (n8n veya
      VPS'te küçük iş — G8 kararına bağlı, §15)
- [ ] Demo sonrası otomatik takip maili (24 s sonra) — şablon §5
- [ ] Satış materyali: tek sayfa PDF (Fachbereich başına), demo senaryosu (`VIDEO_DEMO_DATEN.md` var),
      itiraz-cevap listesi
- ⚠️ Vertikal kuralı: Podoloji ince ayarı bitmeden başka alanda müşteri alınmaz — pipeline'da
  Fachbereich filtresi bu yüzden zorunlu alan

## 3. Teklif (Angebot) + fatura + E-Rechnung

Satış modeli = kutu ("Praxura Lokal"), yani tek seferlik ve/veya dönemsel fatura — Stripe aboneliği
değil (K1). Teklif → sipariş → fatura → ödeme takibi → Mahnung zinciri lazım.

Araştırma bulguları:
- **E-Rechnung:** B2B'de alma zorunluluğu 01.01.2025'ten beri herkes için geçerli. Gönderme
  zorunluluğu: önceki yıl cirosu 800.000 € üzeri olanlara 2027, **herkese 2028**. Kabul edilen biçim
  EN 16931 (XRechnung veya ZUGFeRD ≥ 2.0.1); düz PDF yetmez. Kleinunternehmer (§19 UStG) için
  kaynaklar çelişiyor → **Steuerberater'a sorulacak** (#11). Kamu kurumuna fatura = bugün de XRechnung.
- **Lexware Office:** Angebot → Rechnung tek tıkla, Public API **XL paketinden itibaren** var
  (`api.lexware.io`, 2 istek/sn sınırı). n8n'de resmi node yok, HTTP Request ile bağlanır.
  Bir MCP sunucusu da var (topluluk yapımı, güven denetimi yapılmadı).
- sevDesk aynı sınıfta alternatif; ikisi de GoBD + E-Rechnung + DATEV aktarımı veriyor.

**Öneri: fatura/teklif yazılımını kendimiz yazmıyoruz.** GoBD, numara aralığı, E-Rechnung, arşiv
yükümlülüğü hazır yazılımda çözülmüş. Ops-Finanzen gider tarafını tutmaya devam eder.

- [ ] Lexware Office **veya** sevDesk seç (Steuerberater'ın kullandığına göre — DATEV aktarımı)
- [ ] Angebot şablonu: Leistungsumfang (kutu, kurulum, eğitim, destek, güncelleme), Laufzeit,
      Zahlungsbedingungen. **Fiyat alanı boş kalır** — fiyat henüz belirlenmedi
- [ ] Fatura şablonu ZUGFeRD çıktısı ile; Kleingewerbe/§19 ibaresi Steuerberater onayıyla
- [ ] Ödeme takibi + otomatik Zahlungserinnerung (yazılımın kendi özelliği)
- [ ] Teklif kabulü → pipeline aşaması "Vertrag" (API veya elle)
- [ ] Stripe: kutu satışında rolü ne? (kart ödemesi linki mi, hiç mi) — #333 kaufmodell kararı
- [ ] Hesabı silinmiş müşteriye fatura erişimi (#336) muhasebe yazılımının portalı ile çözülebilir mi bak

## 4. Sözleşme, AVV, e-imza

Kutu praxis'te çalışsa da biz uzaktan destek/güncelleme veriyorsak **AVV (Art. 28 DSGVO)** gerekir ve
§203 StGB kapsamı (mitwirkende Person) sözleşmeye yazılmalı — bunu `legal-de` doğrular.

- [ ] Belge seti (legal-de ile): Lizenz-/Kaufvertrag · AGB (B2B) · AVV + TOM eki · Support-SLA (#30) ·
      §203 Verpflichtung (#29) · Onboarding-Checkliste (praxis tarafı)
- [ ] e-imza: **DocuSeal** self-host (Docker, AGPL, veriler bizim sunucuda) veya OpenSign.
      Basit e-imza (EES) bu sözleşmeler için genelde yeterli — legal-de onaylar
- [ ] İmzalı belge → `I:\My Drive\Ops Praxura gitnogo\vertraege\` (depoya girmez)
- [ ] Sözleşme bitiş/yenileme tarihleri pipeline tablosunda alan olarak

## 5. Otomatik mail

**Hazır:** nodemailer + SMTP (Resend/Postmark yasak — kural aynen), kontakt maili escape + instance
throttle (#40 kısmi). **Açık:** DKIM (#23), DMARC (#40), lisans maili (#333), praxis SMTP (#335, ürün
tarafı — `AUFTRAG-MAILVERSAND.md`).

İki ayrı tür, karıştırma:

| Tür | Örnek | Araç |
|---|---|---|
| Transaksiyonel (tetiklenen) | demo onayı, demo hatırlatma, teklif gönderimi, sözleşme imza linki, lisans/kurulum maili, fatura, ödeme hatırlatma, ticket cevabı | mevcut SMTP + şablonlar; muhasebe yazılımı kendi fatura mailini atar |
| Yaşam döngüsü / bülten | demo sonrası takip dizisi, sürüm notları, Fachbereich haberleri | **Listmonk** (self-host, double opt-in) — P2 |

- [ ] **P0: SPF + DKIM + DMARC** (`praxura.de` ve gönderen alan) — teslim edilebilirliğin ön şartı
- [ ] Gönderen adresleri sabitle: `kontakt@`, `support@`, `rechnung@`, `noreply@`
- [ ] Şablon seti (yalnız Almanca), Impressum alt bilgili, Yavuz Kemal Demir – InfinityMade imzası
- [ ] UWG §7: reklam maili yalnız açık onayla (double opt-in), B2B'de de; transaksiyonel serbest
- [ ] Gönderim günlüğü (kime, hangi şablon, ne zaman) — ops DB'de veya SMTP loglarında

## 6. Destek / ticket

Araştırma: **FreeScout** (PHP/Laravel, hafif, ortak posta kutusu mantığı, AGPL, çekirdek ücretsiz,
bazı modüller ücretli) ve **Zammad** (daha kapsamlı, 2 çekirdek / 6 GB RAM ister, AGPL) en çok
önerilen iki self-host çözüm; ikisi de 2026'da aktif geliştiriliyor. Chatwoot canlı sohbet odaklı.

**Öneri:** ilk müşteriye kadar `support@` ortak posta kutusu + Ops kartı; ilk 3-5 kutu müşterisiyle
**FreeScout** (Hetzner, aynı Traefik arkasında). Zammad bizim hacmimiz için ağır.

- [ ] Kanallar: mail (`support@`), telefon saatleri, uzaktan bağlantı
- [ ] Uzaktan bağlantı aracı: TeamViewer (bugün) → lisans/ticari kullanım durumu kontrol;
      alternatif **RustDesk** self-host (veri bizde)
- [ ] ⛔ **Kural: ticket'a hasta verisi girmez** (ekran görüntüsü dahil). Praxis'e bunu söyleyen
      otomatik cevap metni; girerse silme prosedürü. (guvenlik + legal-de)
- [ ] SLA metni (#30): erişim saatleri, cevap süresi, kritik arıza tanımı — taahhüt olduğu için önce karar
- [ ] Hilfe-Center / SSS (#25): en sık 20 soru; FreeScout'un knowledge base modülü veya statik sayfa
- [ ] Ticket → hata ise Ops kartı / Sentry bağlantısı (elle, sonra otomatik)

## 7. Hata takibi

**Hazır:** Sentry frontend (`sentry-init.js`) + backend (`api-backend/instrument.js`);
serverless için veri-minimize helper lokal yazıldı, canlıda kapalı (#33). Kutuda Sentry yok (bilinçli).

- [ ] Sentry alarm kuralları: yeni hata türü → mail/Telegram; ani artış → alarm
- [ ] PII scrubbing ayarı Sentry projesinde doğrulanmış mı (DSN, `sendDefaultPii=false`) — guvenlik
- [ ] #33 aç/aç-ma kararı (DSN ve sözleşme kapsamı)
- [ ] Haftalık bakış: Montag-Review'da "yeni 5 hata"
- [ ] Kutudan hata bildirimi nasıl gelecek? (müşteri ticket'ı + `/api/status` özeti; otomatik telemetri
      yok kararı onprem'de) — onprem'e sor
- Alternatif not: GlitchTip (Sentry-uyumlu self-host) — yalnız Sentry sözleşmesi sorun olursa

## 8. Uptime, status sayfası, alarm

Araştırma: **Uptime Kuma** (MIT, tek container, kullanıcı dostu public status sayfası) ve **Gatus**
(Apache-2.0, tek YAML dosyası, git'te tutulabilir). Her kaynak aynı uyarıyı yapıyor: izleyici izlediği
makinede çalışırsa makineyle birlikte düşer → **ikinci, dış kontrol şart.**

- [ ] #334: Uptime Kuma'yı onar/kur, disk-check'i bağla (lokal test edilmiş)
- [ ] İzlenecekler: `praxura.de`, `app.praxura.de`, `n8n.infinitymade.de/api/health`, `/health/ready`,
      Supabase, SMTP, `ops.infinitymade.de`, sertifika bitişleri, disk
- [ ] **Public status sayfası** `status.praxura.de` (Kuma'nın kendi sayfası)
- [ ] Dış ikinci kontrol: Kuma'yı izleyen bağımsız bir dış ping (farklı sağlayıcı)
- [ ] Alarm kanalı tek: Telegram (gkv-datenaustausch izlemesi zaten Telegram'a atıyor) + mail
- [ ] Zamanlanmış işler için "dead man's switch" (yedek, katalog senkronu çalıştı mı) — Kuma push monitor yeter

## 9. Kutu filosu (on-prem'e özgü — hazır paket yok)

Kutu modelinde en büyük ops işi bu: kaç kutu var, hangisi hangi sürümde, lisansı ne zaman bitiyor,
son yedek ne zaman, kim kurdu. **Hazır:** `merkez/` servisi (ad, jeton, IP), `/api/status` tasarımı
(onprem/REGISTER.md), `installieren/`, `onprem/RELEASE-STANDARD.md`.

- [ ] Kutu sicili: seri no · praxis (pipeline kaydına bağ) · kurulum tarihi · kanal (`:stable`/`:beta`) ·
      sürüm · lisans bitişi · son heartbeat · son yedek · sorumlu
- [ ] Ops-Dashboard "Kutular" görünümü — merkezden **yalnız teknik meta** (hasta verisi asla) — onprem + guvenlik onayı
- [ ] Alarm: heartbeat 24 s yok · yedek 48 s yok · lisans 30 gün içinde bitiyor
- [ ] Kurulum runbook'u + kabul protokolü (praxis imzalar) → `KUTU_HAZIRLIK_SPRINT.md` ile birleştir
- [ ] Güncelleme duyurusu maili (sürüm notları) — §5 şablonu

## 10. Finans

**Hazır:** Ops-Finanzen (EÜR kategorileri, Vorsteuer, Abo listesi, Elster CSV), n8n Gmail → Gemini →
Drive fatura akışı (`ops/FINANCE_AUTOMATION_SETUP.md`), `ops/FINANCE_MEMORY.md`, Verfahrensdokumentation.

- [ ] Muhasebe yazılımı seçilince: gelir tarafı orada, gider tarafı Ops-Finanzen'de mi yoksa hepsi orada mı? —
      **çift kayıt yapma**, birini otorite seç
- [ ] Steuerberater (#11): §19 durumu, E-Rechnung, DATEV aktarımı
- [ ] Stripe Tax / Radar (#19/#20) — kutu modelinde hâlâ gerekli mi
- [ ] Abonelik listesi (kullandığımız SaaS'lar) + yenileme tarihleri → Finanzen'de zaten "Abo" alanı var

## 11. Analytics — ✅

Umami self-host, `cookie-consent.js` onay kapısı arkasında (legal karar 29.08.2026). Değişiklik önerilmiyor.
Pipeline dönüşüm oranı (Lead→Demo→Angebot→Vertrag) KPI şeridinden gelir, Umami'den değil.

## 12. Hukuk-ops (süreç olarak)

**Hazır:** `compliance/` VVT · TOM · DSFA · LEGAL_DECISIONS; Impressum; DSGVO Auskunft/Löschung kodu (`api-backend/dsgvo/`).

- [ ] DSGVO talep defteri (gelen Auskunft/Löschung talebi, tarih, 1 ay süre, cevap) — Ops'ta küçük tablo
- [ ] Veri ihlali (Art. 33, 72 saat) runbook'u: kim karar verir, kime bildirilir — guvenlik + legal-de
- [ ] Alt işleyen listesi (Hetzner, Supabase, Microsoft, Sentry, muhasebe yazılımı…) — AVV ekine
- [ ] Versicherung (#15): Cyber + Vermögensschaden-Haftpflicht

## 13. Erişim, parola, offboarding

- [ ] Ortak parola kasası (Bitwarden veya self-host Vaultwarden) — `.env`/SSH anahtarı Drive'da değil, burada
- [ ] Hesap envanteri: hangi serviste kimin hesabı var, 2FA açık mı (Vercel, Supabase×2, Stripe, Hetzner,
      DNS, Microsoft, GitHub, Sentry, muhasebe)
- [ ] #125 Admin hesabı + #242 test hesabı temizliği
- [ ] Offboarding checklisti (biri ayrılırsa / çalışan gelirse)

## 14. Yedek — ops tarafı

- [ ] Ops-Supabase (Free plan → otomatik yedek kapsamı sınırlı) için düzenli `pg_dump` → Hetzner Storage Box
- [ ] VPS (`/opt/n8n`, `/opt/calendar-api`, Kuma, FreeScout, DocuSeal verileri) restic/borg yedeği
- [ ] Çeyrekte bir **geri yükleme provası** (yedek, geri yüklenmeden yedek sayılmaz)

## 15. Otomasyon yapıştırıcısı — ⚠️ karar gerekli

n8n VPS'te zaten çalışıyor ve iç kullanımda (kendi süreçlerimiz) lisans sorun değil; K8 yalnız müşteri
kutusuna dağıtımı yasaklıyor. **Ama CLAUDE.md G8 "yeni n8n workflow'u açılmaz" diyor** ve bu cümle
ürün/ops ayrımı yapmıyor. Ops otomasyonları (form→lead, demo takip maili, teklif kabul→aşama, alarm
yönlendirme) için üç yol:

1. G8'i "ürün zinciri" ile sınırla, ops/merkez tarafında n8n'e izin ver → **/konsey kararı** (onprem + muhalif)
2. Aynı işleri `merkez/` servisinde küçük zamanlanmış Node işleri olarak yaz (G8 ile uyumlu, kod bakımı bizde)
3. Activepieces (MIT) — yeni araç, aynı soru; önerilmez

Öneri: **1.** — ama karar konseyin, bu belge onu vermiyor.

## 16. Claude plugin / skill'ler

Araştırma (bu hesabın plugin kataloğu, Anthropic Directory) — hiçbiri şu an **etkin değil**:

| Plugin | İşe yarayacak skill'ler | Not |
|---|---|---|
| **Sales** | draft-outreach, call-prep, call-summary, lead-triage, pipeline-review, weekly-wrap, handle-objection | HubSpot/Salesforce gibi konnektörlere göre yazılmış; bizde dosya/mail ile de çalışır |
| **Customer Support** | ticket-triage, draft-response, kb-article, customer-escalation | Hilfe-Center (#25) ve SSS üretimi için iyi |
| **Operations** | runbook, process-doc, vendor-review, risk-assessment, status-report, compliance-tracking | Runbook'lar (kurulum, ihlal, yedek) için doğrudan |
| **Finance** | reconciliation, journal-entry, variance-analysis | ABD muhasebe dili; EÜR için sınırlı fayda |

- Bu oturumda **Microsoft 365** konnektörü bağlı (Outlook taslak/gönderim, takvim) — demo takip maili
  taslakları için kullanılabilir. Lexware Office için topluluk MCP sunucusu var — güven denetimi yapılmadı.
- ⛔ Hiçbir konnektöre/plugin'e hasta verisi verilmez; müşteri (praxis) iletişim verisi ancak VVT'ye yazıldıktan sonra.
- Kendi skill'imiz: "angebot-vorbereiten" ve "demo-nachbereitung" gibi proje skill'leri `.claude/skills/`
  altına yazılabilir (depo public — müşteri adı yazılmaz).

---

## Sıra önerisi (P0 → ilk ödeyen müşteriden önce)

1. **Karar oturumu (/konsey):** §15 G8 kapsamı · muhasebe yazılımı · destek aracı · e-imza
2. **Teslim edilebilirlik:** SPF/DKIM/DMARC (#23, #40)
3. **İzleme:** Uptime Kuma + status sayfası + dış kontrol + Sentry alarmı (#334, #33)
4. **Belge seti:** AVV, Lizenzvertrag, AGB, SLA, §203 (legal-de) + DocuSeal
5. **Teklif/fatura:** yazılım hesabı + Angebot/Rechnung şablonu (fiyatsız) + Steuerberater (#11)
6. **Pipeline sekmesi** + form→lead bağlantısı
7. **Erişim:** parola kasası + 2FA envanteri
8. P1: FreeScout, Kutular görünümü, yedek provası, Claude plugin'leri
9. P2: Listmonk bülteni, Hilfe-Center genişletme, CRM'e geçiş yeniden değerlendirme

## Danışılması gereken ajanlar (bu taslakta çağrılmadı)

`legal-de` (§4, §5 UWG, §6 PHI-kuralı, §12) · `guvenlik` (§6, §7 scrubbing, §9, §13) ·
`onprem` (§7 kutu hatası, §9, §15 G8) · `mentor` + `deger-mi` (§2/§3 öncelik) · `muhalif` (§15).

---

## Kaynaklar (20.11.2026'da arandı; çoğu satıcı/blog kaynağı — kurmadan önce resmî belgeye karşı doğrula)

- Helpdesk: [selfhosting.sh FreeScout vs Zammad](https://dev.to/selfhostingsh/freescout-vs-zammad-3kg9) ·
  [WZ-IT karşılaştırma](https://wz-it.com/en/blog/zammad-freescout-osticket-chatwoot-helpdesk-comparison/) ·
  [eesel.ai Open-Source-Ticketsysteme](https://www.eesel.ai/de/blog/open-source-ticketsystem) ·
  [Featurebase self-hosted help desk](https://featurebase.app/blog/self-hosted-help-desk-software)
- E-Rechnung: [IHK Rhein-Neckar](https://www.ihk.de/rhein-neckar/recht/steuerrecht/umsatzsteuer/e-rechnungspflicht-5931752) ·
  [Lexware E-Rechnung](https://www.lexware.de/e-rechnung/) · [sevDesk ab wann Pflicht](https://sevdesk.de/ratgeber/buchhaltung-finanzen/rechnungen/e-rechnung/ab-wann-pflicht/) ·
  [Sage Versandpflicht 2027](https://www.sage.com/de-de/blog/e-rechnung-versandpflicht-2027-erp/) ·
  [Finom Kleinunternehmer](https://finom.co/de-de/blog/e-rechnung-pflicht-kleinunternehmer/) ·
  [Spendesk Leitfaden](https://www.spendesk.com/de/blog/elektronische-rechnung/) · [ZDH](https://www.zdh.de/ueber-uns/fachbereich-steuern-und-finanzen/elektronische-rechnung/)
- Teklif/fatura: [Lexware Office Public API](https://www.lexware.de/funktionen/public-api/) ·
  [Lexware Angebote](https://www.lexware.de/funktionen/angebote-schreiben/) ·
  [nordflux: Lexoffice mit n8n](https://nordflux.de/anleitungen/lexoffice-n8n-automatisieren) ·
  [nordflux: sevDesk/Lexoffice/DATEV](https://nordflux.de/wissen/sevdesk-api-lexoffice-datev-vergleich) ·
  [Lexware Office MCP Server](https://mcpservers.org/servers/cotlet-dev-integrations-lexware-office-api-mcp-server)
- CRM: [marmelab benchmark 2026](https://marmelab.com/blog/2026/01/09/open-source-crm-benchmark-2026) ·
  [Twenty vs EspoCRM](https://dev.to/iurii_rogulia/best-headless-crm-in-2026-twenty-vs-espocrm-vs-custom-build-501c) ·
  [hackceleration small business](https://hackceleration.com/labs/best/open-source-crm-small-business)
- Uptime: [Bitdoze Kuma vs Gatus](https://www.bitdoze.com/uptime-kuma-vs-gatus/) ·
  [Product Compass](https://www.productcompass.pm/p/open-source-uptime-monitoring) ·
  [Better Stack Kuma alternatives](https://betterstack.com/community/comparisons/uptime-kuma-alternative/) ·
  [OneUptime status page comparison](https://oneuptime.com/blog/post/2026-04-14-self-hosted-status-page-comparison/view)
- e-imza: [DocuSeal on-premises](https://www.docuseal.com/on-premises) ·
  [DocuSeal vs OpenSign](https://openalternative.co/compare/docuseal/vs/opensign) ·
  [Verdocs OpenSign alternatives](https://verdocs.com/opensign-alternatives/)
- Claude plugin'leri: hesabın plugin kataloğu (Anthropic Directory; kaynak repo `anthropics/knowledge-work-plugins`)
