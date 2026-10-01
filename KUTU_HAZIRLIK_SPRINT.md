# Kutu Hazırlık Sprinti (KHS) — Ekim 2026

> **Bu dosya ne:** 01.10.2026'ya kadar birikmiş BÜTÜN açık kod işlerinin tek planı.
> Sprint bitince: Praxura podolojide uçtan uca tam (GKV · Privat · Selbstzahler · BG),
> on-prem kutusu **hem Linux sunucuya hem bir Windows bilgisayara** temiz kurulup çalışıyor.
> Ardından **kutu testi** (§7) yapılır; onay gelince Ops'taki launch işlerine geçilir.
>
> **Nasıl doğdu:** 01.10.2026 akşam — Ops'taki 110 açık kart + planlar + siciller + günlükler
> agy (Gemini) ile tarandı, `guvenlik` ve `onprem` ajanları kendi sicillerini değerlendirdi,
> ana oturum kritik iddiaları kodda/canlı DB'de bizzat doğruladı (agy'nin hükümlerinin önemli
> kısmı yanlış çıktı — bu plandaki her madde doğrulanmış olandır). Kararlar Kemal'in (§1).
> Ops'ta yalnız bu sprintin DIŞINDA kalanlar açık bırakıldı (§8).
>
> İki hat paralel yürür: **Hat K = Kemal**, **Hat M = Melih**. Kimse diğerinin ne zaman
> çalıştığını bilmiyor — bu yüzden hatlar **dosya alanına göre ayrıldı** (§2) ve her aşama
> tek başına bitirilebilir. Bütün iş yapay zekâ oturumlarıyla yapılır; her aşamanın sonunda
> **yeni oturumda** devam edilir (bağlam dolmasın diye) ve hazır prompt bu dosyada (§6).

---

## 0. Durum tablosu — her aşama bitince BURASI güncellenir

| Aşama | Hat | Konu | Durum | Commit'ler / not |
|---|---|---|---|---|
| K1 | Kemal | Güvenlik + DB temizliği + DSGVO Express'e | ⬜ | |
| K2 | Kemal | Kutu kurulumu: Linux + Windows, güncelleme, KI katmanı, kılavuz | ⬜ | |
| K3 | Kemal | Kutu testi (§7) — EN SON, bütün aşamalar ✅ olunca | ⬜ | |
| M1 | Melih | Podoloji + §302 küçük düzeltmeler, Zuzahlungsforderung, honeypot | ⬜ | |
| M2 | Melih | Reçete türleri (Privat/Selbstzahler/BG) + fatura + Branding sayfası | ⬜ | |
| M3 | Melih | Yerel PDF417 barkod okuma | ⬜ | |
| ORG | Kemal | Organizasyon listesi (§5) — kod değil, her an yapılabilir | ⬜ | |

Sıra: K1 → K2 ve M1 → M2 → M3 kendi içinde sırayla. **İki hat birbirini beklemez.**
Tek bağımlılık: K3 (kutu testi) hepsi bittikten sonra.

---

## 1. Kararlar (Kemal, 01.10.2026) — yeniden açılmaz

| # | Karar |
|---|---|
| K-1 | Test kutusu `:beta` kanalından kurulur; `:stable` bu testin 72 saatlik çalışma kanıtıyla sonra basılır. |
| K-2 | Kutu sahibi `professional` + `active` doğar. Yön: **her pakette Abrechnung olacak** (paket/fiyat sonra konuşulacak — kolay değiştirilebilir kalmalı, tek yerde dursun). |
| K-3 | KI için env katmanı yazılır: anahtar yoksa 503 + Almanca mesaj. İlk kutu testi KI'sız. |
| K-4 | **Yerel PDF417 barkod okuma bu sprintte.** KI gelse bile kalıcı ikinci yol; KI'ya kadar tek yol. |
| K-5 | Fahrtenbuch mesafe hesabı (openrouteservice, Supabase Edge Function) kutuda **gizlenir**; kalıcı çözüm sonra. |
| K-6 | Disk şifrelemesi: bizim hukuki sorumluluğumuz değilse **yapılmaz**. On-prem'de praksis sorumlu (biz veri işlemiyoruz) → kılavuzda yalnız tavsiye cümlesi. `legal-de` K1'de tek cümleyle teyit eder. |
| K-7 | Kutu **hem Linux sunucuda hem praksisin Windows bilgisayarında** çalışabilmeli ("Yol C" artık kapsamda). |
| K-8 | Kutu testi = **her şey hazır**: GKV, Privat, Selbstzahler, BG — uçtan uca. Kısmi test yok. Kapsam: **yalnız Podoloji** (Physio/Ergo/Logo ince ayarı ayrı sprint). |
| K-9 | Fatura görünümü bu sprintte: tek **Branding** ayar sayfası (logo, banka, alt bilgi, kaşe) — kurulum sihirbazının sonunda atlanabilir adım + Ayarlar'da; "Kurulum %85 tamamlandı" halkası (engel değil, teşvik). |
| K-10 | BG/İş kazası reçetesi: Kemal alanı bilmiyor → `gkv-302` + `legal-de` + `podoloji` araştırır, yapıyı kurar, uygulanır. |
| K-11 | Praksis kaydı artık SaaS onboarding değil, merkezde "satın alma hesabı" (mail+isim+fatura adresi, mail onayı) → lisans → kurulum. **Bu sprint dışı** (launch öncesi). Kutu testinde lisans/kurulum kodu elle verilir. |
| K-12 | İki adımlı doğrulama (owner + admin) **yok** — yasal zorunluluk değilse (`legal-de` K1'de teyit). İleride güncellemeyle gelebilir. |
| K-13 | Kod borcu birleştirmeleri sprint dışı. İstisna: Berlin-günü kopyalarının birleştirilmesi (M1). |
| K-14 | **Gerçek hasta/müşteri verisi yok.** Test ve beta verisi, beta hesapları dahil, migration'larda korunmaz; silinebilir. |
| K-15 | Bot koruması: Google captcha YOK (G8). Hız sınırı + görünmez honeypot alanı. |
| K-16 | Demo-Modus her alanda kalabilir; Zygote kullanım/telif şartı `legal-de`'ye sorulur (M1). |

---

## 2. Çakışma kuralları — İKİ HAT AYNI ANDA `main`'de

1. **Oturum başında:** `git pull --rebase`. **Her commit'ten önce:** yine `git pull --rebase`.
   Paralel oturum kuralı: `git diff --cached` kontrol et, `git commit -- <dosyalar>` ile yalnız kendi dosyalarını commit'le.
2. **Dosya sahipliği:**

| Alan | Sahibi |
|---|---|
| `onprem/**`, `api-backend/setup/**`, `api-backend/ai/**`, `api-backend/routes/mitarbeiter-zugang*`, `api/admin/**`, `api/dsgvo.js` + yeni Express DSGVO route'u, `confirm.html`, `.githooks/`, `tools/check-*` | **K** |
| `module/**` (yeni modüller), `api-backend/billing/**`, `booking*.html/.js`, `setup.html` (Branding adımı + metin düzeltmesi dahil), `kalender*`, `vercel.json` | **M** |
| `dashboard.js`, `dashboard.html`, `api-backend/server.js`, `db/*` dökümleri | **ORTAK** — küçük, bölge-sınırlı değişiklik; yeni kod `module/`'e; aynı fonksiyona iki hat dokunmaz |

3. **Migration numarası çakışması** (en tehlikeli nokta): migration yazmadan hemen önce `git pull`,
   sıradaki numarayı al (bugün son: `0052`), dosyayı yaz ve **hemen ayrı bir commit olarak push et**
   ("numarayı rezerve et"), sonra canlıya uygula + döküm tazele. Aynı numarayı iki hat alırsa
   sonra push eden yeniden numaralar (uygulanmamışsa).
4. **K1 profiles kilidi (S-39)** yalnız `owner_id`, `role`, `plan`, `plan_status`, `stripe_*` kolonlarını kilitler.
   M2'nin Branding alanları owner tarafından yazılabilir kalmalı — M2 yeni kolonları `profiles`'a
   eklerse K1 sonrası test eder.
5. Yeni tablo kişisel veri taşıyorsa `api/dsgvo.js` (K1'den sonra: Express DSGVO route'u) güncellenir — sahibi kim olursa olsun.
6. Proje kuralları aynen geçerli: `fonksiyon-ustasi`/`db-ustasi`/`onprem` yazmadan ÖNCE sorulur, SONRA bildirilir ·
   `dashboard.js` büyümez · yalnız Almanca metin · koyu tema değişkenleri · cache-bust `?v=` ·
   şema = önce dosya sonra canlı · "harita güncelle" · `fortschritte/` günlüğü · `canli-test` ile canlı doğrulama.

---

## 3. Hat K — Kemal (güvenlik, kutu, organizasyon; karar gerektiren mimari)

### K1 · Güvenlik + DB temizliği + DSGVO Express'e  (~3 gün, alt parçalar sırayla)

| # | İş | Kaynak | Bitti sayılır |
|---|---|---|---|
| K1.1 | **S-39 KRİTİK:** `profiles` kendi satırını kısıtsız UPDATE ediyor (`owner_id`, `role`, `plan`, `plan_status`) → kolon yetkisi geri al veya koruma trigger'ı (yalnız `service_role`). `confirm.html:166-187` client yazma yolu kaldır. Eski self-signup: `pending_employee_registrations` anon INSERT `CHECK(true)` policy'si kaldır (S-38 şart 8) | guvenlik S-39/S-38, `db/SCHEMA-RLS.sql:1135,1092` | `authenticated` ile kendi `owner_id`'ni değiştirme denemesi reddedilir (test) |
| K1.2 | **S-07** `employee_services` + `time_offs` policy'leri owner'a bağla · **S-18** Verordnung↔hasta aynı owner trigger'ı | `SCHEMA-RLS.sql:972,1170` | başka praksisin satırına yazma reddedilir |
| K1.3 | **S-38 kalanları:** yeni Einrichtungscode verilince açık oturumlar düşer (`mitarbeiter-zugang.js:329-335`) · çalışan açma kaydı kalıcı tabloya (audit) · plan limiti atomik (`:113-130`) · `?token=` URL kabulü (`ai/auth.js:19`) — kullananları bul, kaldır | guvenlik S-38 | testler yeşil |
| K1.4 | **DSGVO Express'e (O-16 + S-32):** `/api/dsgvo` mantığı `api-backend`'e taşınır (kutuda 404 dönüyor), Vercel fonksiyonu silinir (bir slot boşalır) · Storage bucket silme eklenir · eksik 6 tablo: `booking_status_korrekturen`, `praxura_setup`, `employee_scope_overrides`, `pending_employee_registrations`, `pending_signups`, `zaa_fehler` · silme↔saklama tartımı (GoBD, S-10, DB-4) **önce `legal-de`** | onprem O-16, guvenlik S-32/S-10 | Export + Löschung kutuda ve SaaS'ta çalışır; GoBD kilidi ve `patient_consents` RESTRICT dokunulmadı |
| K1.5 | **#319** `api/admin/data.js` `type=bookings` ucunu sil | Ops #319 | uç yok |
| K1.6 | **DB temizliği (K-14):** `fußstatus` + `visibility_reports` tabloları DROP · `aerzte_owner_id_arzt_name_key` kaldır · 9 `mock_unbestaetigt` kostentraeger satırı sil · 4-kaynak kuralı `db-ustasi` ile | db/REGISTER W-07, DB-7..9 | `db/REGISTER.md` + döküm güncel |
| K1.7 | **Kapılar:** `npm test` glob'una `api-backend/routes/**` (S-11) · pre-commit sır tarama kapısı + bütün izlenen dosyalarda tek seferlik tarama (S-05/S-16) · SECURITY DEFINER EXECUTE referans listesi (S-04b) | guvenlik | kapılar çalışıyor |
| K1.8 | `legal-de`'ye üç kısa soru: 2FA zorunlu mu (K-12) · disk şifrelemesi bizim sorumluluğumuz mu (K-6) · S-31 şifrelenmiş §302 ara dosyalarının şifresiz kopyası silinsin mi → cevaba göre küçük kod | | cevap `compliance/LEGAL_DECISIONS.md`'de |

Sicil işleri: `guvenlik/REGISTER.md` (S-39 yeni kayıt, kapananlar §4'e; S-03/S-28/S-33 de taşınır) — guvenlik ajanına bildir.

### K2 · Kutu kurulumu — Linux + Windows  (~4 gün)

`onprem` ajanının 01.10 denetimi (Y1–Y7 → sicilde O-143'ten itibaren numaralanır). Öncelik sırası:

| # | İş | Bitti sayılır |
|---|---|---|
| K2.1 | **Y2** GHCR'de `:stable` yok → `install.sh` adım 13'te düşer: kanal seçimi (beta/stable), hata metni, `VERSION` 0.2.0 + yayın | taze makinede `compose pull` geçer |
| K2.2 | **Y3** `manifest.json` bayat → `update.sh` "konflikt" ile durur: yeniden üret + kapı ("manifest SHA = staged dosya") | kurulumdan sonra iki `update.sh` koşusu temiz |
| K2.3 | **Y1** kurulum sihirbazı owner'ı `professional`+`active` yazar (K-2; tek yerde, sonra lisansa bağlanacak) | §302 menüsü kutuda görünür |
| K2.4 | **O-107** `onprem/reset-owner-passwort.sh` (host betiği, HTTP ucu değil) | owner şifresi mailsiz sıfırlanır |
| K2.5 | **O-142 artıkları:** `install.sh` adım 11 SMTP sorusu/metni, compose GoTrue SMTP + `MAILER_URLPATHS` bloğu, `.env.template` (O-30). (`setup.html:239` metni → M2) | kurulum hiç mail sormaz |
| K2.6 | **S-21** DB rolleri tek şifre → kendi init dosyamız, `install.sh` rol başına şifre üretir (`roles.sql` vendor kopyasına dokunma) | her rol ayrı şifre |
| K2.7 | **KI env katmanı (Y5/O-07/O-135/O-136):** kod `AZURE_*` okuyor, compose `AI_*` geçiriyor → sağlayıcıdan bağımsız `AI_*` okunur; anahtar yoksa 503 + Almanca mesaj (bugün `azureClient.js:41` ham 500) | anahtarsız kutuda Rezept-Scan düzgün mesaj verir |
| K2.8 | **Sabit adresler (O-03/Y4):** `dashboard.js:19328`, `server.js:4415`, `routes/mitarbeiter-zugang.js:169` + kapının `app_host` sayacı `api-backend/routes/`'u da saysın | kutuda hiçbir link `app.praxura.de`'ye gitmez |
| K2.9 | Kutuda gizle: B2B-AI kartı (O-09b) + Fahrtenbuch mesafe hesabı (O-11, K-5) — `IST_KUTU` | kırık düğme yok |
| K2.10 | `restore.sh` referans sayacını gösterir (O-123) · "SaaS'a uygulandı mı" migration kapısı (O-129) · `caddy_data` (yerel kök CA) yedeğe girer (Y7) | |
| K2.11 | **Windows kurulumu (K-7, yeni):** tek PowerShell başlatıcı → WSL2 + Ubuntu 24.04 + systemd + WSL'in kendi Docker Engine'i (Docker Desktop DEĞİL) → `install.sh`. Bilgisayar açılınca kutu kendiliğinden kalkar; uyku/kapanma uyarısı; yedek hedefi harici disk/NAS; LAN'daki diğer cihazların erişimi (port yönlendirme WSL→Windows) + kök sertifika kurulumu. `onprem` ajanıyla tasarla | Windows laptopta sıfırdan kurulum, ikinci cihazdan (tablet) tarayıcıyla giriş |
| K2.12 | **Kurulum kılavuzu (Y6)** `onprem/KURULUM.md`: Linux sunucu yolu + Windows yolu, klonlama/indirme, hosts/ad (`praxis.home.arpa`), kök sertifikanın Windows/Chrome/tablet'e alınması, `SETUP_TOKEN`, disk şifrelemesi tavsiyesi (K-6), owner şifre sıfırlama | Kemal kılavuzla tek başına kurabiliyor |

Sicil: `onprem/REGISTER.md` §9 tablosu + playbook §10 aynı turda düzeltilir (onprem ajanı söyledi: O-105/106/130/133/06/140 kapalı ama tabloda açık).

### K3 · Kutu testi — en son (§7)

### ORG · Kemal'in kod dışı listesi → §5

---

## 4. Hat M — Melih (kod; ne yapılacağı belli işler)

### M1 · Podoloji + §302 düzeltmeleri  (~2–3 gün)

| # | İş | Kaynak / yer |
|---|---|---|
| M1.1 | **#320 VKZ 03 Zuzahlungsforderung:** route yok + zuzahlung hesabı VKZ yerine kennzeichen'e bağlı (sessiz sıfır). `gkv-302` ile | Ops #320, `api-backend/billing/` |
| M1.2 | **Bozuk satırın arayüzden onarımı** (faturalanmamış satırı owner storno/silebilsin; kutuda SQL yok) | plan 1.9d / O-114 |
| M1.3 | **DTA tarihleri UTC** → Berlin günü (`encoding.js:84`, `auftragsdatei.js:63`; gece 00–02 önceki gün). `gkv-302` teyidi | canli-test P1 |
| M1.4 | **Yanlış .p12** → ham İngilizce forge hatası: `dashboard.js:16245` `asn1.fromDer` try içine, Almanca mesaj | canli-test P2 |
| M1.5 | **Alıcı sertifikası bilgisi** Faz-3 ekranında (Ö7) + sertifika bitiş hatırlatması kontrolü (#315; banner `dashboard.js:1062` var — eksikse tamamla) | plan Ö7, Ops #315 |
| M1.6 | Görsel hatalar: `gesendet` → "Unbekannter Status" (`module/abrechnung-status.js`, `abrechnungsstatus.js`) · Fußstatus termin seçici tarih sırası (`module/fussbefund.js`) · ZAA modal + anamnez kartı sabit renk (`dashboard.js:16134`, `dashboard.html:2108`) · Demo-Modus görünürlüğü (K-16: her alanda kalabilir — registry ile `module_visibility` çelişkisini düzelt) | canli-test |
| M1.7 | `vercel.json` CSP `font-src 'self'` → `data:` ekle (kalender) | sprint S6 kalanı |
| M1.8 | ICD'den gelen Diagnosegruppe'ye "aus ICD — mit Verordnung abgleichen" öneri etiketi + L4 uyarısı | PRODUKT-ENTSCHEIDUNGEN PE-005 |
| M1.9 | **#295** 78040 Empfangsbestätigung yakalanmıyor — önce koda karşı doğrula, `podoloji`+`gkv-302` | Ops #295 |
| M1.10 | **#322** `series-scheduler.js:75-76` `prefs.notes` + `userFeedback` Azure'a gitmesin (veri minimizasyonu) | Ops #322 |
| M1.11 | **#293** fatura ekranı donması — iki iyileştirme yapılmıştı, tekrar üretilemedi; kısa inceleme, bulunamazsa kart kapanır (not ile) | Ops #293 |
| M1.12 | **Honeypot** (K-15): `booking.html` + Termin-Anfrage formuna görünmez tuzak alan, sunucuda kontrol (`server.js` booking/booking-request route'ları) | guvenlik S-06 |
| M1.13 | **Berlin-günü kopyaları** (K-13): frontend'deki 5 kopya (`heuteIso()`/`alsISODatum()` vb.) tek modüle; `fonksiyon-ustasi` listesi | fortschritte 01.10 |
| M1.14 | Demo-Modus Zygote: `legal-de`'ye kullanım/telif şartı (K-16) → gerekiyorsa gizle | |
| M1.15 | `.p7m` dosya adı: kod yorumu bilinçli diyor (`filename.js:80-87`) — `gkv-302` tek cümle teyit, sonra wissensbank Z-12 kapanır | WB-Z12 |

### M2 · Reçete türleri + fatura + Branding  (~4–5 gün)

| # | İş | Not |
|---|---|---|
| M2.1 | **Reçete türü seçimi** Muster-13 maskesinde: GKV / Privat / Selbstzahler / BG (bugün `verordnung-maske.js:149,392` sabit `kassen`); seçime göre GKV zorunlu alanları gizlenir, `nutzlastAusMaske()` yazar | PE-006 (Ops #313 QA notu) |
| M2.2 | **BG/İş kazası (K-10):** önce `gkv-302` + `legal-de` + `podoloji` → DGUV'nin istediği alanlar (Unfalltag, Aktenzeichen, UV-Träger…), fatura yolu (BG'ye §302 değil, ayrı fatura?), sonra maske + DB + fatura | Ops #135, wissensbank Z-01 |
| M2.3 | **Selbstzahler/Privat zinciri:** Behandlung → Rechnung köprüsü (`podologie_behandlungen`'de hasta bağı yok → `db-ustasi`), KDV/MwSt seçimi, Preisstufen, fatura numarası GoBD kilidiyle; hasta tipine göre otomatik ön seçim | Ops #133, #134, #138, KARARLAR 10.08 Faz 3 |
| M2.4 | **Branding sayfası (K-9):** tek ayar ekranı — logo, praksis adı/adresi, banka (IBAN/BIC), alt bilgi, dijital kaşe yükleme; bütün faturalar/belgeler buradan beslenir (Hauptvorlage) | Ops #114, #68, #80 |
| M2.5 | **Kurulum sihirbazının sonuna** atlanabilir "Branding" adımı (`setup.html`) + aynı adımda `setup.html:239` "Einladungs-/Passwort-Reset" metni O-142'ye göre düzeltilir | K-9, O-142 |
| M2.6 | **"Kurulum %X tamamlandı" halkası** (dashboard + Ayarlar): logo, banka, IK, Praxis-Adresse, Annahmestelle, Mitarbeiter… eksikse yüzde düşer, tıklayınca ilgili ayara gider; engel değil | K-9 |
| M2.7 | **"Podologische Behandlung groß" adı** (#209): `podoloji` ajanına sor — ekranda/faturada hangi ad | Ops #209 |
| M2.8 | Praksis Datenschutz şablonuna Microsoft/Azure alıcı olarak (EuGH C-413/23 P) — metin `legal-de` | Ops #331 |

### M3 · Yerel PDF417 barkod okuma  (~3 gün) — K-4

Konsey 28.09 kararı (`konsey/KARARLAR.md`) ve Ops #321–329. Bu sprintte **yalnız yerel yol** (buluta hiçbir şey gitmez):

| # | İş |
|---|---|
| M3.1 | `zxing` (WASM/JS) **`vendor/`'e yerel** (CDN yasak — `vendor/README.md` üretim kuralı) + Bild/PDF yükleme + kamera (`getUserMedia`, HTTPS gerekir — kutuda `tls internal` var) (#326) |
| M3.2 | `module/rezept-barcode.js`: Muster-13 PDF417 ayrıştırıcı, KBV BFB V4.80 (#323) — `wissensbank` belgesi önce |
| M3.3 | Onay maskesi: faturaya giren 5 alan + "Papier handschriftlich geändert?" kutusu (#324) |
| M3.4 | Podoloji Heilmittel serbest metni → HPNR 78xxx deterministik eşleme (`api-backend/lib/rezept-felder.js` `heilmittelPositionAufloesen`) (#325) |
| M3.5 | Barkod alanlarında EDIFACT özel karakter kaçışı (`' : ? +`) (#327) |
| M3.6 | Mail taslaklarında Leistung/Termin yer tutucu, yerelde doldurma (`pii-mask.js`) (#328) |
| M3.7 | PHI'siz sayaçlar `barcode_ok` / `fallback_manuell` (#329) |

---

## 5. ORG — Kemal'in kod dışı listesi (her an, sıra serbest)

- [ ] **n8n API anahtarı:** n8n → Settings → n8n API: Haziran 2026'dan önce oluşturulmuş anahtar varsa sil/yenile (eski anahtar public repo geçmişinde duruyor — guvenlik S-08). Kod tarafının yenisini kullandığını kontrol et (`n8n` MCP, VPS env).
- [ ] **Kutu test ortamı:** canlı VPS'e (n8n/backend, 2 vCPU / 3,7 GB, swap yok) **kurma** — ayrı küçük bir Hetzner sunucu (CX22, ~6 €/ay, Ubuntu 24.04) + Windows laptop.
- [ ] **Steuerberater:** Kassenbuch/TSE yeterli mi (#223) · Fahrtenbuch'ta ayrı "Patientenverzeichnis" yeterli mi · saklama 6 mı 8 yıl mı.
- [ ] **78040 Änderungsvereinbarung 20.10.2023** GKV-SV'den indir → `wissensbank` ajanına ver (#243).
- [ ] **GoDaddy mail DPA** / VVT (#179) — `legal-de` ile.
- [ ] **Beta-1'e bilgi:** barkod kart okuyucunun yerini tutmaz (#330). Ayrıca `PODOLOGIE_REFORM_SPRINT.md` S0'daki bekleyen sorular.
- [ ] **Melih için erişim** (#10): ortak parola kasası, Stripe restricted key.
- [ ] **IKK Nordrhein** (104001441) yeni IK — sıradaki Kostenträger dosyası çözerse gerek yok (`gkv-302`).

---

## 6. Aşama sonu protokolü + yeni oturum prompt'ları

**Her alt parça bitince:** testler (`npm test`, ilgili `node --test`) → commit (`git pull --rebase` önce) → push (ana bağlamda, ön planda).
**Bağlam doluyorsa** (uzun konuşma, çok dosya okundu): alt parça sınırında DUR, `fortschritte/` + §0'a devir notu yaz, aşağıdaki prompt'u "kaldığın yer: Kx.y" ekiyle ver, **yeni oturumda** devam et.

**Her aşama bitince (temiz bitiş):**
1. `npm test` yeşil · `npm run probe` · `canli-test` ajanıyla değişen ekranlar canlıda doğrulanır
2. `node tools/funktionskarte.mjs` ("harita güncelle") + `fonksiyon-ustasi`'na niyet bildirimi · şema değiştiyse döküm + `db/REGISTER.md` + `db-ustasi`
3. Kutuya dokunduysa `onprem` ajanına bildir; güvenliğe dokunduysa `guvenlik`'e
4. `fortschritte/JJJJ-MM-TT.md` (o günün dosyasına ekle)
5. Bu dosyada §0 durum satırını ✅ + commit'ler
6. Kullanıcıya şu cümleyi söyle: **"Aşama Xn temiz bitti. Bağlam dolu — yeni bir oturum aç ve aşağıdaki prompt'u yapıştır."** ve sıradaki aşamanın prompt'unu ver.

### Prompt'lar (yeni oturuma aynen yapıştırılır)

**K1 başlat:**
```
KUTU_HAZIRLIK_SPRINT.md'yi baştan sona oku (özellikle §1 kararlar, §2 çakışma kuralları, §6 aşama sonu protokolü).
Hat K, aşama K1'i uygula: K1.1'den K1.8'e sırayla. Önce git pull --rebase.
Her şema/tablo işinden önce db-ustasi'na, güvenlik kararından önce guvenlik'e, hukuki sorudan önce legal-de'ye sor.
Ağır kod işini agy worker'larına (builder protokolü) ver, soğuk ikinci worker'la denetlet, diff'i kendin oku.
Alt parça bitince commit+push. Bağlam dolarsa alt parça sınırında dur ve §6'ya göre devir yap.
Aşama bitince §6 adımlarını uygula ve bana K2 prompt'unu ver.
```

**K2 başlat:**
```
KUTU_HAZIRLIK_SPRINT.md'yi oku (§1, §2, §6). Hat K, aşama K2'yi uygula (K2.1 → K2.12).
Önce git pull --rebase. onprem ajanı bu aşamanın bekçisi: her adımdan önce sor, sonra bildir; sicilde Y1–Y7'yi O-143'ten itibaren numaralat.
K2.11 (Windows kurulumu) için önce onprem ile tasarımı yaz, sonra uygula. Test: WSL2'de gerçek kurulum (docker PATH notu: hafıza reference_lokal_onprem_testortami).
Aşama bitince §6 adımlarını uygula; kalan aşama yoksa bana K3 (kutu testi) prompt'unu ver, varsa hangi aşamaların beklendiğini söyle.
```

**K3 başlat (yalnız §0'da K1, K2, M1, M2, M3 hepsi ✅ ise):**
```
KUTU_HAZIRLIK_SPRINT.md §7 kutu testini yürüt. Önce §0'daki bütün aşamaların ✅ olduğunu doğrula; değilse dur ve söyle.
onprem/KURULUM.md'yi izleyerek bana adım adım kurulum yaptır (Linux test sunucusu + Windows laptop), her senaryoyu canli-test ajanı ile birlikte işaretle.
Bulguları builder'a devredilecek pakete çevir; düzeltme sonrası aynı senaryoyu tekrarla.
```

**M1 başlat:**
```
KUTU_HAZIRLIK_SPRINT.md'yi baştan sona oku (§1 kararlar, §2 çakışma kuralları — sen Hat M'sin, §6 aşama sonu).
Hat M, aşama M1'i uygula: M1.1 → M1.15. Önce git pull --rebase.
Fonksiyon yazmadan önce fonksiyon-ustasi'na, §302 kuralından önce gkv-302'ye, podoloji akışından önce podoloji ajanına sor.
Ağır kod işini agy worker'larına (builder protokolü) ver, soğuk ikinci worker'la denetlet, diff'i kendin oku.
Alt parça bitince commit+push. Bağlam dolarsa alt parça sınırında dur ve §6'ya göre devir yap.
Aşama bitince §6 adımlarını uygula ve bana M2 prompt'unu ver.
```

**M2 başlat:**
```
KUTU_HAZIRLIK_SPRINT.md'yi oku (§1, §2, §6). Hat M, aşama M2'yi uygula (M2.1 → M2.8). Önce git pull --rebase.
M2.2 (BG) için önce gkv-302 + legal-de + podoloji'den gereksinimleri topla, Podoloji/PRODUKT-ENTSCHEIDUNGEN.md'ye yaz, sonra uygula.
Yeni kolon/tablo öncesi db-ustasi; migration numarası için §2 madde 3 (önce rezerve et, ayrı push).
Aşama bitince §6 adımlarını uygula ve bana M3 prompt'unu ver.
```

**M3 başlat:**
```
KUTU_HAZIRLIK_SPRINT.md'yi oku (§1, §2, §6). Hat M, aşama M3'ü uygula (M3.1 → M3.7) — yalnız yerel yol, buluta hiçbir şey gitmez.
Önce wissensbank'a KBV BFB / PDF417 belgesini sor (yoksa indirme protokolü), zxing vendor/'e yerel (vendor/README.md).
onprem ajanına: yeni vendor dosyası + kamera/HTTPS kutuda.
Aşama bitince §6 adımlarını uygula; Hat M bitti — §0'ı güncelle ve K3'ün başlayıp başlayamayacağını söyle.
```

---

## 7. Kutu testi — kabul senaryoları (K3)

İki ortam: **(L)** ayrı Hetzner test sunucusu, **(W)** Windows laptop (WSL2). Her senaryo ikisinde de.

1. Kılavuzla sıfırdan kurulum (`:beta`), kurulum sihirbazı, Branding adımı (atla + sonra doldur), "%X tamamlandı" halkası
2. Owner girişi · çalışan açma (Einrichtungscode, mailsiz) · çalışan girişi · owner şifre sıfırlama betiği
3. İkinci cihazdan (tablet) LAN üzerinden giriş, kök sertifika uyarısız
4. Hasta + anamnez + Einwilligung (kiosk) · randevu (tekli/seri) · online randevu + Termin-Anfrage formu
5. **GKV** reçetesi: elle + **barkod** (foto/PDF/kamera) → Tagesbehandlung, Fußbefund → §302 dosyası (test), Zuzahlung, Zuzahlungsforderung
6. **Privat** ve **Selbstzahler**: reçete/tedavi → fatura (logo, banka, kaşe ile) → ödeme kaydı
7. **BG** reçetesi → BG faturası
8. Storno, bozuk satır onarımı, Korrektur yolu
9. Fahrtenbuch (mesafe hesabı gizli), Kassenbuch, DSGVO export + silme
10. Rezept-Scan KI'sız: düzgün Almanca mesaj · (opsiyonel ikinci tur: Kemal'in kendi test anahtarıyla)
11. Yedek al → başka klasöre/makineye `restore.sh` → veriler + sayaç doğru
12. `update.sh` iki kez (konflikt yok), yeniden başlatma sonrası kutu kendiliğinden kalkar
13. Ölçülecekler: O-141 iki `curl -I`, O-109 kamera, O-128 migration süreleri, O-55, O-140 check-in

72 saat sorunsuz çalışma → `:stable` basılır (K-1). Onaydan sonra Ops'taki launch kartlarına geçilir.

---

## 8. Ops eşlemesi (01.10.2026)

**Bu sprinte alındı → Ops'ta kapatıldı (sprint bitirecek):** #10, #36 (karar: 2FA yok), #38 (→ honeypot), #68, #80, #114, #119'un S-39/S-07 kısmı, #133, #134, #135, #138, #179, #209, #223, #243, #293, #295, #315, #318 (karar: 2FA yok), #319, #320, #321, #322–#331.

**Bitmiş / eskimiş → kapatıldı:** #4, #7, #13, #27, #32, #37, #42, #45, #53 (Impressum doğru: resmî taraf Yavuz Kemal Demir), #54, #59, #69, #76, #157, #162, #250, #255, #258, #259, #286.

**Ops'ta kalan (kutu testinden sonra / launch / diğer alanlar):** #109 ortaklık + alt kartlar · #121 Stripe · #123 launch · #124 ertelenenler · #116 eGK/TI · #122 görünürlük/mail · #119'dan #33/#34/#41 · #120'den #29/#30 · #115'ten #8/#31 · #242 test hesapları · #248 sigorta · #150 Beta-1 canlı deneme · #117/#26 mobil (podoloji dışı)/PWA · #168/#170 veri katmanı · #184 · Physio/Ergo/Logo (#127, #128, #131, #132, #202, #251, #290, #291) · #214 · #125 · K-11 satın alma hesabı + lisans (launch öncesi, yeni kart).
