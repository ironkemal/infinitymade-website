# Pre-Launch Checklist — İlk Müşteriden Önce

> Bu liste **canlıya geçmeden önce** baştan sona yapılacak. Test fazındayken yapılması zorluk çıkaracak şeyler (MFA enforcement, column encryption, sandbox→live geçişler) buraya not edildi. Test fazında yapılabilenler ayrı; bkz. ana TODO.
>
> **Beklenen tamamlama süresi:** ~3-5 iş günü (ufak işler) + 1-2 gün hukuki review.

Son güncelleme: 2026-05-23
Status: 🔴 Hiçbiri yapılmadı

---

## 🔴 P0 — Yasal / Hukuki (atlanırsa para cezası riski)

- [ ] **AVV onboarding adımı zorunlu** — Müşteri AVV'yi okuyup imzalamadan `kann_abrechnen=true` olmasın. Onboarding'e checkbox + IP+timestamp kaydı.
- [ ] **TOM (Technische und organisatorische Maßnahmen)** — AVV'nin Anhang 2'si. Sunucu yeri, şifreleme, erişim kontrolü, audit, backup, retention liste. Markdown→PDF.
- [ ] **VVT (Verzeichnis von Verarbeitungstätigkeiten)** — Art. 30 DSGVO. Hangi veri, nerede, kim için, ne süre. `compliance/VVT.md`.
- [ ] **DSFA (Datenschutz-Folgenabschätzung)** — Art. 35 DSGVO. **Sağlık verisi için zorunlu.** Risk + mitigation matrisi.
- [ ] **Cookie consent banner** — TTDSG gereği. gtag/analytics opt-in olana kadar yüklenmesin. Tek dosya, ~2 saat.
- [ ] **Datenpannen-Runbook** — Sızıntı durumunda 72h içinde Datenschutzbehörde'ye bildirim akışı (Art. 33). Doc + örnek template.
- [ ] **Recht auf Löschung endpoint** — Müşteri "hesabımı sil" derse cascading silme. RLS + storage cleanup.
- [ ] **Recht auf Auskunft (DSAR) endpoint** — Müşteri "verilerimi ver" derse 30 gün içinde JSON+PDF export.

---

## 🟠 P1 — Güvenlik (canlıda olmadan açıktasın)

- [ ] **MFA zorunluluğu (owner)** — Supabase Auth `enrollMfa` flow'u. Owner login'inde AAL2 zorunlu, employee için opsiyonel.
- [ ] **VPS Hardening doğrulama (n8n.infinitymade.de)**
  - [ ] `PermitRootLogin no`
  - [ ] `PasswordAuthentication no` (sadece SSH key)
  - [ ] SSH portu 22 → custom (örn. 2222)
  - [ ] `fail2ban` kurulu + sshd jail aktif
  - [ ] UFW: sadece SSH-custom + 80 + 443 açık
  - [ ] Unattended-upgrades aktif (security patches)
- [ ] **TLS A+ skor doğrulama** — `ssllabs.com/ssltest` → `n8n.infinitymade.de` ve `infinitymade.de`. HSTS, OCSP stapling açık olmalı.
- [ ] **Column-level encryption** — KVNR, ICD-10, diagnosetext, geburtsdatum için `pgcrypto.pgp_sym_encrypt`. Anahtar Vault'tan çekilsin. (Test fazında atladık çünkü debug zorlaştırıyor.)
- [ ] **Backup + Restore drill**
  - [ ] Hetzner günlük snapshot otomasyonu aktif
  - [ ] Supabase PITR (Point-in-Time Recovery) açık (Pro plan gerekli)
  - [ ] En az 1 kez restore tatbikatı yap, prosedür yaz
- [ ] **Sentry production aktivasyonu** — Kod hazır (`api-backend/instrument.js` + `sentry-init.js`), test fazında DSN aktif. Production'da:
  - [ ] `SENTRY_ENVIRONMENT=production` env vars'a yaz (Vercel + VPS)
  - [ ] Alert kanalı bağla (Email / Slack)
  - [ ] Sample rate'ler doğru mu (frontend 20%, backend 20% prod'da)
  - [ ] Test event üret + PII scrub doğrula (Sentry'de KVNR/IBAN görmemeli)
- [ ] **reCAPTCHA v3** — Public booking + employee-signup. Rate limit yeterli değil bot için.

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
- [ ] **End-to-end test live mode'da** — Bir test müşteri ile gerçek ödeme akışı (sonra iade et)
- [ ] **Customer Portal** — Production'da aktif, return_url doğru
- [ ] **Stripe Tax** (opsiyonel ama tavsiye) — Otomatik USt hesaplama, B2B reverse-charge için VATtest
- [ ] **Stripe Radar rules** — En azından default fraud kuralları aktif

---

## 🟢 P3 — Operasyonel

- [ ] **Email confirmation sistemi** (Resend ile) — booking → müşteri + owner'a e-posta. Şablonlar DE/EN.
- [ ] **DSB (Datenschutzbeauftragter) ata** — Eksternel danışman (~€100-200/ay) veya kendi başına yapacağına dair beyan.
- [ ] **Status page** — `status.infinitymade.de` (Uptime Kuma veya BetterUptime, free tier yeterli)
- [ ] **Onboarding video / Hilfe-Center** — En az 5 dakikalık intro video, sıkça sorulan sorular
- [ ] **Support kanal** — `support@infinitymade.de` veya Crisp/Intercom widget. Response time SLA'sı ekle AGB'ye.
- [ ] **Pricing page** — Enterprise plan kartı doldur (şu an placeholder)
- [ ] **DNS + Email auth** — SPF, DKIM, DMARC kayıtları (Resend tarafına doğru yönlendirme)

---

## 🟢 P4 — Süreç Geliştirmeleri (canlıdan sonra yapılabilir ama not)

- [ ] **Per-business working_hours** — şu an employee saatleri global
- [ ] **Multi-currency** — şu an sadece EUR
- [ ] **Çoklu dil** UI — DE/EN/TR aktif, dashboard'da seçici
- [ ] **PWA / mobile installer**
- [ ] **Mitarbeiter-Verpflichtung** — İleride çalışan alırsan "Verpflichtung auf das Datengeheimnis" imzası (§ 28 Abs. 3 lit. b DSGVO)
- [ ] **ISO 27001 hazırlığı** — Enterprise müşteriler talep ettiğinde

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
