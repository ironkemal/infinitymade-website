# Pre-Launch Checklist — İlk Müşteriden Önce

> Bu liste **canlıya geçmeden önce** baştan sona yapılacak. Test fazındayken yapılması zorluk çıkaracak şeyler (MFA enforcement, column encryption, sandbox→live geçişler) buraya not edildi. Test fazında yapılabilenler ayrı; bkz. ana TODO.
>
> **Beklenen tamamlama süresi:** ~3-5 iş günü (ufak işler) + 1-2 gün hukuki review.

Son güncelleme: 2026-06-11
Status: 🟡 P0 tamamlandı, P1 büyük ölçüde tamamlandı

---

## ✅ P0 — Yasal / Hukuki (TAMAMLANDI 2026-06-11)

- [x] **AVV onboarding adımı zorunlu** — ✅ checkbox + IP/timestamp kaydı aktif
- [x] **TOM** — ✅ `compliance/TOM.md`
- [x] **VVT** — ✅ `compliance/VVT.md` (Art. 30)
- [x] **DSFA** — ✅ `compliance/DSFA.md` (Art. 35)
- [x] **Cookie consent banner** — ✅ `cookie-consent.js` aktif
- [x] **Datenpannen-Runbook** — ✅ `compliance/DATENPANNEN_RUNBOOK.md`
- [x] **Recht auf Löschung** — ✅ `api/dsgvo/delete.js` (Stripe cancel/delete dahil, cascading)
- [x] **Recht auf Auskunft (DSAR)** — ✅ `api/dsgvo/export.js` (47 tablo JSON export)

---

## 🟠 P1 — Güvenlik (büyük ölçüde tamamlandı 2026-06-11)

- [ ] **MFA zorunluluğu (owner)** — Supabase Auth `enrollMfa` flow'u. Owner login'inde AAL2 zorunlu. ⏸️ Ayrı sprint.
- [x] **VPS Hardening (n8n.infinitymade.de)** — ✅ 2026-06-11
  - [x] `PermitRootLogin prohibit-password` (parola auth kapalı, key-only)
  - [x] `PasswordAuthentication no`
  - [ ] SSH portu değişikliği — ⏸️ lockout riski, ertelendi
  - [x] `fail2ban` kurulu + sshd jail aktif (3 IP banlıydı)
  - [x] UFW: 22/80/443 açık, geri kalanı kapalı
  - [x] Unattended-upgrades zaten kuruluydu
- [x] **TLS / Security headers** — ✅ 2026-06-11
  - [x] `praxura.de` (Vercel): HSTS + CSP + tüm headerlar ✅
  - [x] `n8n.infinitymade.de`: Traefik middleware ile HSTS/X-Frame/X-Content eklendi ✅
- [ ] **Column-level encryption** — ⏸️ Ertelendi (tüm SELECT/INSERT değiştirilmesi gerekiyor, büyük sprint)
- [ ] **Backup + Restore drill**
  - [ ] Hetzner günlük snapshot — ⏸️ 5. aktif müşteriye ertelendi (~€2/ay)
  - [x] VPS cron backup — ✅ `/usr/local/bin/praxura-backup.sh`, her gece 02:00 UTC, 7 gün saklanır
  - [ ] Supabase PITR — ⏸️ Pro plan gerekli
  - [x] Restore tatbikatı — ✅ 2026-06-11 (54MB sqlite + env dosyaları /tmp'ye kopyalanıp doğrulandı)
- [x] **Sentry production** — ✅ 2026-06-11
  - [x] Frontend: hostname bazlı auto-detect, tüm 7 sayfa kapsanmış
  - [x] Backend (VPS): `SENTRY_ENVIRONMENT=production` yapıldı
  - [ ] Vercel serverless Sentry — ⏸️ opsiyonel
  - [x] Sentry alert kuralları — ✅ aktif (2 proje: JS + Node)
- [x] **reCAPTCHA v3** — ✅ DSGVO sprint'te yapıldı
- [x] **Supabase function güvenliği** — ✅ 2026-06-11
  - [x] `delete_expired_accounts()` anon/authenticated erişimi kapatıldı

---

## 🟡 P2 — Stripe Production'a Geçiş

- [ ] **Stripe Production hesap aktivasyon**
  - [ ] Almanya işletme bilgileri (USt-ID, ticari sicil)
  - [ ] Banka hesabı doğrulama
  - [ ] Aktivasyon onayı bekleme (genelde 1-3 iş günü)
- [ ] **Production fiyat ID'leri oluştur** (test'te kullandıklarımızın aynısı)
  - [ ] Starter monthly + yearly
  - [ ] Professional monthly + yearly
  - [ ] Klinik monthly + yearly
  - [ ] **Enterprise monthly + yearly** (test'te de yoktu, ilk burada lazım)
- [ ] **Vercel env vars** — `STRIPE_SECRET_KEY` ve fiyat ID'lerini production değerleriyle güncelle. Test key'leri `STRIPE_TEST_*` ile koru.
- [ ] **Webhook endpoint** — Production endpoint Stripe Dashboard'a kayıt + secret env'e
- [x] **End-to-end test live mode'da** — ✅ Kullanıcı test etti, çalışıyor (2026-06-11)
- [ ] **Customer Portal** — Production'da aktif, return_url doğru
- [ ] **Stripe Tax** (opsiyonel ama tavsiye) — Otomatik USt hesaplama, B2B reverse-charge için VATtest
- [ ] **Stripe Radar rules** — En azından default fraud kuralları aktif

---

## 🟢 P3 — Operasyonel

- [x] **Email confirmation sistemi** — Müşteri self-servis booking özelliği kaldırıldı (2026-06-11). Demo booking (`api/demo-booking.js`) SMTP/nodemailer ile müşteri+owner'a e-posta gönderiyor. ✅
- [x] **DSB (Datenschutzbeauftragter)** — ✅ Prüfvermerk yazıldı (2026-06-11): Beta aşamasında bestellpflicht yok, Art. 37 Abs. 1 kriterler karşılanmıyor. `compliance/DSB_PRUEFVERMERK.md`. Datenschutz.html'e §9 eklendi.
- [x] **Status page** — ✅ Uptime Kuma kuruldu (2026-06-11). `status.praxura.de` Traefik+Let's Encrypt. ⚠️ DNS CNAME bekliyor: Cloudflare'de `status.praxura.de` → `n8n.infinitymade.de` (proxy OFF)
- [ ] **Onboarding video / Hilfe-Center** — En az 5 dakikalık intro video, sıkça sorulan sorular
- [ ] **Support kanal** — `support@infinitymade.de` veya Crisp/Intercom widget. Response time SLA'sı ekle AGB'ye.
- [x] **Pricing page** — ✅ Enterprise kartı dolu (Mehrere Standorte, Individuell fiyat, 10 özellik, mailto CTA)
- [x] **DNS + Email auth** — ✅ SPF aktif, DKIM CNAME yayıldı (selector1+2), Microsoft 365 toggle bekliyor (2026-06-11)
- [x] **DSGVO delete → Stripe abonelik iptali** — `api/dsgvo/delete.js` subscription cancel + customer delete tamamen implementli (2026-06-11 doğrulandı). ✅

---

## 🟢 P4 — Süreç Geliştirmeleri (canlıdan sonra yapılabilir ama not)

- [ ] **Per-business working_hours** — şu an employee saatleri global
- [ ] **Multi-currency** — şu an sadece EUR
- [ ] **Çoklu dil** UI — DE/EN/TR aktif, dashboard'da seçici
- [ ] **PWA / mobile installer**
- [ ] **Mitarbeiter-Verpflichtung** — İleride çalışan alırsan "Verpflichtung auf das Datengeheimnis" imzası (§ 28 Abs. 3 lit. b DSGVO)
- [ ] **ISO 27001 hazırlığı** — Enterprise müşteriler talep ettiğinde

---

## 🟠 P5 — Test fazından sonra yapılacaklar (UX bozar)

> Bu maddeler şu an eklenirse test akışını yavaşlatır/kırar. Launch öncesi son 1 hafta açılacak.

- [ ] **reCAPTCHA v3** — Public booking + employee-signup. (Test sırasında her seferinde captcha çözmek istemiyoruz)
- [ ] **Cookie banner TTDSG strict-review** — Umami eklendikten sonra: reddet butonu eşit görünür mü? Pre-consent hiçbir script yüklenmiyor mu?
- [ ] **Email rate limit + SPF/DKIM/DMARC** — Resend eklendikten sonra DNS kayıtları + production'da rate limit
- [ ] **DSB (Datenschutzbeauftragter) iletişim bilgisi datenschutz.html'e** — Atama yapıldıktan sonra
- [ ] **Status page subdomain DNS** — Cloudflare: `status.praxura.de` CNAME → `n8n.infinitymade.de` (proxy OFF) ← **KULLANICI YAPACAK**
- [ ] **Umami production domain** — Test fazında `analytics.infinitymade.de`'de kalır, launch'tan önce gerçek subdomain'e bağlı doğrula

---

## Launch Day Checklist (D-0)

- [ ] Tüm P0 tamamlandı
- [ ] Tüm P1 tamamlandı
- [ ] Stripe live mode aktif, test transaction başarılı
- [ ] Production smoke test: signup → onboarding → booking → abrechnung
- [ ] DMRZ ile bir gerçek müşteri için Echtbetrieb dosyası ack alındı
- [ ] Status page açık
- [ ] Sentry alerts yapılandırıldı
- [ ] Backup drill 1 kez tamamlandı
- [ ] DSB iletişim bilgisi datenschutz.html'de
