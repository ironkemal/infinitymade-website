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
| K1 | Kemal | Güvenlik + DB temizliği + DSGVO Express'e | ✅ 02.10.2026 — K1.1–K1.8 (K1.8 S-31 kodu → M1.16, Hat M) | 0053–0057 · ecbf871 7d75f09 ae999fa 16a7aef fdf25dd 9a0e18f 1f2ecb1 3fecef1 975dd2a 6141be8 bb65f0b 94bac87 2804b99 59c3ea1 · fortschritte/2026-10-02.md |
| K2 | Kemal | Kutu kurulumu: Linux + Windows, güncelleme, kılavuz (KI katmanı → M4) | ✅ 02.10.2026 — K2.1–K2.12, sürüm 0.2.0. ⚠️ Windows adım 7–10 (autostart/firewall/sertifika/powercfg) + LAN/tablet + O-144(b) yönetici ile Kemal'de, K3'ten önce | 18ad39a c880ad1 d807c3e e4c7703 67dbe9d 6d50e3d 56cb6a7 a4634f7 6a5cd1f acc51d5 ebe318c f033be0 3684ef8 · fortschritte/2026-10-02.md |
| K3 | Kemal | Kutu testi (§7) — EN SON, bütün aşamalar ✅ olunca | ⬜ | |
| M1 | Melih | Podoloji + §302 küçük düzeltmeler, Zuzahlungsforderung, honeypot | 🟨 | M1.1 Code geprüft+gepusht 0260612 (0.3.0,0058SaaS); M1.2 bestehenderStorno20Tests+LiveRLSbestätigt, LiveUIoffen; nächsterCode M1.3. GesamtM1offen; fortschritte/2026-10-03.md |
| M2 | Melih | Reçete türleri (Privat/Selbstzahler/BG) + fatura + Branding sayfası | ⬜ | |
| M3 | Melih | Yerel PDF417 barkod okuma | ⬜ | |
| M4 | Melih | KI katmanı: merkezi maskeleme + sağlayıcı/env katmanı (eski K2.7, M1.10, M3.6 dahil) | ⬜ | ölçüm 02.10: `spike/ki-maske/` |
| ORG | Kemal | Organizasyon listesi (§5) — kod değil, her an yapılabilir | ⬜ | |

Sıra: K1 → K2 ve M1 → M2 → M3 → M4 kendi içinde sırayla. **İki hat birbirini beklemez.**
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
| K-17 | *(02.10.2026)* **KI'ya giden her çağrı tek kapıdan geçer ve kapı maskeler** (M4, Melih). Yeni bir KI özelliği = yeni task + alan şeması; maskeleme kendiliğinden gelir. Maskeleme **ek korumadır, hukuki dayanak değildir**: Azure EU + AVV kalır, müşteriye "pseudonymisiert" denir, "anonymisiert" denmez (`legal-de`). Merkezi tek anahtar/relay bu sprintte **yok** (playbook K6 kilitli; açılacaksa ayrı `/konsey`). |

---

## 2. Çakışma kuralları — İKİ HAT AYNI ANDA `main`'de

1. **Oturum başında:** `git pull --rebase`. **Her commit'ten önce:** yine `git pull --rebase`.
   Paralel oturum kuralı: `git diff --cached` kontrol et, `git commit -- <dosyalar>` ile yalnız kendi dosyalarını commit'le.
2. **Dosya sahipliği:**

| Alan | Sahibi |
|---|---|
| `onprem/**` (KI env adları dahil — M4 ile sözleşme, aşağıda), `api-backend/setup/**`, `api-backend/routes/mitarbeiter-zugang*`, `api/admin/**`, `api/dsgvo.js` + yeni Express DSGVO route'u, `confirm.html`, `.githooks/`, `tools/check-*` | **K** |
| `module/**` (yeni modüller), `api-backend/ai/**` (02.10'dan beri — M4), `spike/ki-maske/`, `api-backend/billing/**`, `booking*.html/.js`, `setup.html` (Branding adımı + metin düzeltmesi dahil), `kalender*`, `vercel.json` | **M** |
| `dashboard.js`, `dashboard.html`, `api-backend/server.js`, `db/*` dökümleri | **ORTAK** — küçük, bölge-sınırlı değişiklik; yeni kod `module/`'e; aynı fonksiyona iki hat dokunmaz |

3. **Migration numarası çakışması** (en tehlikeli nokta) — *02.10.2026 değişti (onprem O-129):*
   ~~önce dosyayı push edip numarayı rezerve et~~ **YAPILMAZ.** Uygulanmamış bir `.sql` `main`'e
   girerse `:beta` kutusu onu SaaS'tan önce uygular ve SHA'sını kilitler; dosyanın `-- SaaS:` satırı
   sonradan değişemez. Sıra: `git pull` → dosyayı yaz (sıradaki numara) → MCP ile canlıya uygula →
   ilk 40 satıra `-- SaaS: angewandt TT.MM.JJJJ` → döküm tazele → commit → `git pull --rebase` →
   numara bu arada alınmışsa `git mv` ile kaydır + `--amend` → push. (SaaS'ta runner koşmuyor;
   uygulanmış ama push edilmemiş dosyanın adını değiştirmek hiçbir şeyi kırmaz.) Kapı:
   `tools/check-onprem.sh` satırsız yeni migration'ı reddeder; `SKIP_SAAS_ZEILE_GATE` rezervasyon
   için kullanılmaz.
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
| K2.7 | ~~KI env katmanı~~ → **M4.1'e taşındı** (02.10; `api-backend/ai/**` tek elde kalsın). K'nin payı: `onprem/docker-compose.yml`, `.env.template`, `install.sh`'ta env **adları** = M4 sözleşmesi: `AI_MODE` (`aus`\|`direkt`, kutuda varsayılan `aus`), `AI_PROVIDER`, `AI_ENDPOINT`, `AI_API_KEY`, `AI_MODEL_TEXT`, `AI_MODEL_VISION`. K2.5 ile aynı turda | compose yalnız bu adları geçirir; anahtar image/şablonda yok (K5) |
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
| M1.10 | ~~#322 series-scheduler serbest metin~~ → **M4.4'e taşındı** (aynı dosya, kapıyla birlikte çözülür) | Ops #322 |
| M1.11 | **#293** fatura ekranı donması — iki iyileştirme yapılmıştı, tekrar üretilemedi; kısa inceleme, bulunamazsa kart kapanır (not ile) | Ops #293 |
| M1.12 | **Honeypot** (K-15): `booking.html` + Termin-Anfrage formuna görünmez tuzak alan, sunucuda kontrol (`server.js` booking/booking-request route'ları) | guvenlik S-06 |
| M1.13 | **Berlin-günü kopyaları** (K-13): frontend'deki 5 kopya (`heuteIso()`/`alsISODatum()` vb.) tek modüle; `fonksiyon-ustasi` listesi | fortschritte 01.10 |
| M1.14 | Demo-Modus Zygote: `legal-de`'ye kullanım/telif şartı (K-16) → gerekiyorsa gizle | |
| M1.15 | `.p7m` dosya adı: kod yorumu bilinçli diyor (`filename.js:80-87`) — `gkv-302` tek cümle teyit, sonra wissensbank Z-12 kapanır | WB-Z12 |
| M1.16 | **S-31 dosya yaşam döngüsü** (K1.8'den Melih'e devredildi, 02.10 — kod tamamen `billing/api/abrechnung.routes.js` + imza arayüzünde): hukuk kararı `compliance/LEGAL_DECISIONS.md` „2026-10-02" §3 tablosu. (a) imza başarılı → imzasız `.dta` silinir, SHA-256 `abrechnung`'da kalır; **dikkat:** `/upload-signed` tekrarlanabilir ve `/dta-bytes` (~Z.1291) `.dta`'yı indirir — yeniden imza için içerik `.p7m`'den (detached:false, `dashboard.js:16289`) çıkarılmalı ya da silme yalnız `gesendet`'te yapılmalı; `storage_path` kolonu ve `module/abrechnung-detail.js` indirme düğmeleri buna göre. (b) `.dta.enc.p7m` → DAS kabul/Quittung sonrası silinir (M1.9 ile aynı olay). (c) yeniden üretilen/storno taslak `.dta` hemen silinir. (d) `.p7m` 8 yıl kalır (K1.4 kilit modelinde `beleg`). guvenlik S-31 V7 buna göre güncellenir | legal-de 02.10, guvenlik S-31 |

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
| M3.6 | ~~Mail taslaklarında yer tutucu (#328)~~ → **M4.6'ya taşındı** |
| M3.7 | PHI'siz sayaçlar `barcode_ok` / `fallback_manuell` (#329) |

### M4 · KI katmanı: merkezi maskeleme + sağlayıcı katmanı  (~4–5 gün) — K-17

**Neden (ölçüldü, 02.10.2026 — `spike/ki-maske/README.md`):** Bugün 6 KI yolu var, yalnız 2'si
maskeliyor ve maskeleyici (`api-backend/ai/pii-mask.js`) yalnız elle verilen tam adı + KVNR/IBAN
tanıyor. 60 gerçekçi vakada **151 kişisel verinin 114'ü (%75) sızıyor** ("Erika Müller" kayıtlı,
metinde "Frau Müller" → yakalanmıyor; telefon/adres/doğum tarihi hiç). `series-scheduler`,
`rezept-normalize` ve n8n'e giden B2B taslağı hiç maskelemiyor. Kural tabanlı prototip v2
görmediği ikinci sette fail-closed ile bile **%13** sızdırdı → **serbest metin yalnız kurallarla
kapatılamaz.** Plan bu ölçüme göre kuruldu: güvence *maskelemenin iyi olmasından* değil,
*hasta kimliğinin modele hiç gitmemesinden* gelir.

**Üç sınıf — her task alanlarını bildirir, kapı sınıfa göre davranır:**

| Sınıf | Ne | Kapı ne yapar | Sızıntı |
|---|---|---|---|
| **A · Yapısal alan** | `customer.name`, `patient.email`, `employees[].name`, `slots[].employeeName`, `contacts[]`… | Her zaman yer tutucu (`Patient_1`, `Therapeut_A`); model gerçek değeri hiç görmez, cevap yerelde geri çevrilir | **0 — yapı gereği** |
| **B · Serbest metin** | `intent`, `prefs.notes`, `userFeedback`, `contacts[].notes`, `heilmittel_feld_text` | Varsayılan **gönderilmez**; task gerekçelendirirse: kurallar + mandantın isim sözlüğü + (M4.2 tutarsa) yerel NER → çıkış tarayıcısı **fail-closed** → şüphe varsa ekranda tek soru: „„Oma Lisbeth" ein Name? [maskieren] [kein Name]" | ölçülü, eşik M4.9 |
| **C · Görüntü/PDF/barkod** | Rezept fotoğrafı | Kapıdan **geçmez.** Rezept-OCR ayrı kural: yalnız `direkt` modda ve C5 askısı (Beta-1'e 18.09 verilen söz) değişmeden açılmaz. Barkod yereldir (M3) | — |

**Kapının sabit kuralları** (`guvenlik` + `legal-de` şartları, 02.10):
yer tutucu çağrı başına rastgele nonce'lu (`⟦NAME_x7f2_1⟧`) · kullanıcı metninde yer tutucuya benzeyen her şey önce etkisizleşir (injection) · geri çevirme katı: bilinmeyen yer tutucu = hata, tahmin yok · modelin **cevabı da** taranır · eşleme yalnız bellekte, çağrı bitince atılır · prompt hiçbir log/Sentry/audit kaydına girmez · sağlayıcı sürücüsünü **yalnız** kapı import edebilir (test kapısı — bugünkü gibi "unutulan task" olamaz) · `AI_MODE=aus|direkt` (relay yok, K6; enum ileride genişletilebilir).

| # | İş | Bitti sayılır |
|---|---|---|
| M4.1 | **Sağlayıcı/env katmanı (eski K2.7, Y5/O-07/O-135/O-136):** `api-backend/ai/ki-gateway.js` tek giriş; `azureClient.js` altında sürücü olarak kalır. `AI_*` okunur, **`AZURE_*` geri düşüş** (SaaS VPS bugün `AZURE_*` ile çalışıyor — ad değişince canlı KI düşmesin). Anahtar yok → 503 + Almanca mesaj (bugün `azureClient.js:41` üretimde ham hata). `GET /api/ai/_health` `configSummary()`'yi try içine al. Env adları §2/K2.7 sözleşmesi | anahtarsız kutuda Rezept-Scan düzgün Almanca mesaj · SaaS'ta KI canlıda çalışmaya devam ediyor (`canli-test`) |
| M4.2 | **NER ölçümü — İLK İŞ, karar noktası:** `spike/ki-maske/ner-test.mjs` HuggingFace'e erişen bir ağda (Kemal'in ağında bağlantı kesiliyordu). Ölçüt: `korpus2.json`'da fail-closed sonrası sızıntı **≤ %2** ve 7 negatif vakada yanlış alarm ≤ 1. Tutarsa model **image'a gömülür** (çalışırken indirme YOK — `vendor/` kuralının backend karşılığı), RAM ve açılış süresi ölçülür, `onprem`'e sorulur. Tutmazsa NER yok, B sınıfı kural + ekranda soru ile çalışır | ölçüm sonucu ve karar `spike/ki-maske/README.md`'de |
| M4.3 | **Maskeleyici:** `pii-mask.js` **genişletilir, yeniden yazılmaz** (`fonksiyon-ustasi`: `allocate` iki kopya, `maskMessages:104` ölü satır — tek çekirdek, `maskPII` onun özel hâli, mevcut `pii-mask.test.js` yeşil kalır). `spike/ki-maske/maske-v2.mjs`'teki kurallar **satır satır incelenerek** taşınır (agy prototipi, ilk sete ezber yapmıştı). Mandant isim sözlüğü DB'den: hastalar (`leads`), çalışanlar, `aerzte` — hangi kolon, `db-ustasi`'ya sor. Sıradan kelime olan soyadlar (Koch, Weber, Fuchs) yalnız büyük harf/unvan ile. Sentry/access-log'daki üç kopya regex'ten yalnız desen listesi paylaşılır, amaçlar ayrı kalır | v1 testleri + yeni testler yeşil |
| M4.4 | **Bütün task'lar kapıya + A şemaları:** `series-scheduler` (eski M1.10/#322: `prefs.notes`/`userFeedback` B sınıfı, hasta/terapist takma adla) · `appointment-confirm-draft` (`employeeName` bugün açık gidiyor) · `b2c-draft` (`contacts[].notes`, `owner_info`) · `rezept-normalize` (`heilmittel_feld_text` B) · `rezept-ocr` C işaretli. `server.js:2061/:2401` çağrıları kapıdan geçer (ORTAK dosya, bölge sınırlı) | `chat()`'i kapı dışında çağıran dosya yok (test) |
| M4.5 | **B2B taslağı n8n'den çıkar:** `dashboard.js:11072/11292` doğrudan `n8n.infinitymade.de/webhook/b2b-mail-agent`'a, maskesiz gidiyor → `b2b-draft` task'ı (`b2c-draft` kalıbı), kapıdan. n8n bağı azalır (G8/K8 yönü); `onprem`'e sor: K2.9'daki kutu gizlemesi kalkabilir mi. `dashboard.js` büyümez | B2B taslağı backend'den ve maskeli |
| M4.6 | **Eski M3.6 (#328):** mail taslaklarında Leistung/Termin yer tutucu, yerelde doldurma | taslakta gerçek değerler, modelde yok |
| M4.7 | **Ekranda tek soru:** kapı şüpheli kalıntı döndürürse küçük onay (`module/ki-rueckfrage.js`, yalnız Almanca, koyu tema değişkenleri). Tık-ekonomisi için `podoloji`'ye: mail taslağı akışında en fazla 1 ek tık | soru ancak şüphede çıkıyor |
| M4.8 | **İz bırakmama:** `instrument.js` `beforeSend` → istek gövdesi/messages silinir · `ai/auth.js`/`audit.js` hata metinleri kırpılır (sağlayıcı hatası prompt parçası taşıyabilir) · `hashRequest` tuzlu (kısa alanlar kaba kuvvetle çözülmesin) | `guvenlik` teyidi |
| M4.9 | **Testler + kapı:** korpuslar `api-backend/ai/__tests__/`'e fixture olarak taşınır, `npm test`'e girer; eşik **düşebilir, artamaz** (bugün korpus1 0,7 % · korpus2 12,9 % — M4.3 sonrası yeni değer taban olur). Injection testi, katı geri çevirme testi, import kapısı. **Son sınav:** aşama sonunda yeni, soğuk bir agy worker'a **üçüncü** görülmemiş korpus ürettir; sonuç README'ye | `npm test` yeşil, son sınav sonucu yazılı |
| M4.10 | **Belge + sicil:** TOM'a 1 sayfa "Pseudonymisierung vor KI-Aufrufen" — **yalnız ölçüm sonucuyla** (S-17 dersi: TOM gerçekte olandan fazlasını vaat etmişti) · `legal-de` → `compliance/LEGAL_DECISIONS.md` tek satır risk kabulü · DSE metni M2.8 ile birlikte ("pseudonymisiert", asla "anonymisiert") · `guvenlik` yeni S kaydı · `onprem` sicili (`AI_MODE`, O-105 kapanışı) · `fonksiyon-ustasi`'na niyet bildirimi + "harita güncelle" | siciller güncel |

**Ne çözer, ne çözmez — açık konuşalım:**
- ✅ Hasta kimliği KI sağlayıcısına **gitmez**: A sınıfında yapı gereği, B'de ölçülü + fail-closed. Yeni KI özelliği eklemek artık "task + alan şeması"; kimse maskelemeyi hatırlamak zorunda değil. Kutu ve SaaS aynı kod, kutuda yeni dış zincir yok.
- ⚠️ "ZDR/EU/ABD fark etmez" **doğru değil** (`legal-de`): maskeleme ek korumadır. Azure EU + AVV + DSE'de alıcı olarak anılması kalır. Rezept fotoğrafı maskelenemez, C5 askısı aynen sürer.
- ⛔ **Merkezi tek anahtar (relay) bu sprintte yok.** Playbook K6 kilitli ("Merkezi AI-proxy YAPILMAZ") ve `legal-de`: maskeli metin bile bizden geçerse kutu müşterisi için veri yoluna geri gireriz (K-6 "veri işlemiyoruz" çizgisi bulanıklaşır). `guvenlik` şartlı açık ama "önce maskeleme, sonra relay" diyor. Kemal açmak isterse: ayrı `/konsey` + avukat (1–2 saat, `legal-de` soru listesi hazır). Kutuda yol: müşterinin kendi anahtarı (K4), maskeli, doğrudan.

**İleride aynı kapıdan geçebilecek yerler** (bu sprintte yapılmaz — `spike/ki-maske/inventar.md` §5):
§125 terapi raporu (`module/abrechnung-freigabe.js`) · kasa Absetzung'unu açıklama + itiraz taslağı (`module/abrechnung-detail.js`) · ihtar metinleri (`billing/api/mahnwesen.routes.js`) · not → yapılandırılmış Fußbefund/anamnez (`module/fussbefund.js`, `module/anamnese.js`) · iptal mesajından Warteliste önerisi (`module/warteliste-nachruecker.js`).

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

**K1 devam (02.10.2026 devri — kaldığın yer: K1.4):**
```
KUTU_HAZIRLIK_SPRINT.md'yi oku (§1, §2, §6). Hat K, aşama K1 devam: kaldığın yer K1.4, sonra K1.8'in kod kısmı. Önce git pull --rebase.
K1.1-K1.3, K1.5-K1.7 bitti (fortschritte/2026-10-02.md, §0). K1.4 için önce compliance/LEGAL_DECISIONS.md'nin 2026-10-02 bölümünü oku — legal-de silme yerine kilit modelini verdi (Behandlungsdoku 10 J., fatura 8 J., leads minimize, Storage satır kuralına göre, "teilweise gelöscht" yanıtı, data_access_log Auskunft'ta, SaaS'ta AVV maddesi + zorunlu export).
api/dsgvo.js (566 satır) api-backend'e Express route olarak taşınır, Vercel fonksiyonu silinir, dashboard.js'teki 5 çağrı (1032/1041/1969/12558/12613/18220) API_BASE'e döner — dashboard.js büyümez; export linki ?token= ile çalışıyorsa ai/auth.js queryTokenErlaubt allowlist'ine yalnız GET /api/dsgvo export eklenir (guvenlik'e sor).
Şema (gesperrt_bis vb.) öncesi db-ustasi, kilit/purge yolu için guvenlik, kutu için onprem (O-16). GoBD kilidi ve patient_consents RESTRICT'e dokunulmaz.
K1.8 kodu: S-31 (.dta imzadan sonra sil, .p7m 8 yıl) — billing Hat M alanında; dokunmadan önce dosya sahipliğine bak, gerekirse Melih'e not bırak.
Ağır kodu agy worker'larına ver, soğuk ikinci worker'la denetlet, diff'i kendin oku. Alt parça bitince commit+push.
Aşama bitince §6 adımlarını uygula ve bana K2 prompt'unu ver.
```

**K2 başlat:**
```
KUTU_HAZIRLIK_SPRINT.md'yi oku (§1, §2, §6). Hat K, aşama K2'yi uygula (K2.1 → K2.12).
Önce git pull --rebase. onprem ajanı bu aşamanın bekçisi: her adımdan önce sor, sonra bildir; sicilde Y1–Y7'yi O-143'ten itibaren numaralat.
K2.11 (Windows kurulumu) için önce onprem ile tasarımı yaz, sonra uygula. Test: WSL2'de gerçek kurulum (docker PATH notu: hafıza reference_lokal_onprem_testortami).
Aşama bitince §6 adımlarını uygula; kalan aşama yoksa bana K3 (kutu testi) prompt'unu ver, varsa hangi aşamaların beklendiğini söyle.
```

**K3 başlat (yalnız §0'da K1, K2, M1, M2, M3, M4 hepsi ✅ ise):**
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
Aşama bitince §6 adımlarını uygula ve bana M4 prompt'unu ver.
```

**M4 başlat:**
```
KUTU_HAZIRLIK_SPRINT.md'yi oku (§1 özellikle K-17, §2 — api-backend/ai/** artık sende, §6). Hat M, aşama M4'ü uygula (M4.1 → M4.10).
Önce git pull --rebase. Sonra spike/ki-maske/README.md ve inventar.md'yi oku — ölçüm ve bütün KI yolları orada.
M4.2 (NER ölçümü) İLK iş ve karar noktası: ölçütü tutmazsa NER'siz devam et, sonucu README'ye yaz.
Fonksiyon öncesi fonksiyon-ustasi, isim sözlüğü tabloları için db-ustasi, env/image/model boyutu için onprem, log/hash/injection için guvenlik, TOM/DSE metni için legal-de.
Relay/merkezi anahtar YAZILMAZ (K6). SaaS'ta AZURE_* geri düşüşünü canli-test ile doğrula — canlı KI düşmemeli.
Ağır kod işini agy worker'larına (builder protokolü) ver, soğuk ikinci worker'la denetlet, diff'i kendin oku. M4.9'daki üçüncü korpusu yazan worker kodu GÖRMESİN.
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
10. Rezept-Scan KI'sız: düzgün Almanca mesaj · (opsiyonel ikinci tur: Kemal'in kendi test anahtarıyla — mail taslağı + seri planlama; giden istekte gerçek hasta/terapist adı yok, cevapta geri çevrilmiş, şüpheli metinde ekran sorusu çıkıyor)
11. Yedek al → başka klasöre/makineye `restore.sh` → veriler + sayaç doğru
12. `update.sh` iki kez (konflikt yok), yeniden başlatma sonrası kutu kendiliğinden kalkar
13. Ölçülecekler: O-141 iki `curl -I`, O-109 kamera, O-128 migration süreleri, O-55, O-140 check-in

72 saat sorunsuz çalışma → `:stable` basılır (K-1). Onaydan sonra Ops'taki launch kartlarına geçilir.

---

## 8. Ops eşlemesi (01.10.2026)

**Bu sprinte alındı → Ops'ta kapatıldı (sprint bitirecek):** #10, #36 (karar: 2FA yok), #38 (→ honeypot), #68, #80, #114, #119'un S-39/S-07 kısmı, #133, #134, #135, #138, #179, #209, #223, #243, #293, #295, #315, #318 (karar: 2FA yok), #319, #320, #321, #322–#331 (#322 ve #328 02.10'da M4'e geçti).

**Bitmiş / eskimiş → kapatıldı:** #4, #7, #13, #27, #32, #37, #42, #45, #53 (Impressum doğru: resmî taraf Yavuz Kemal Demir), #54, #59, #69, #76, #157, #162, #250, #255, #258, #259, #286.

**Ops'ta kalan (kutu testinden sonra / launch / diğer alanlar):** #109 ortaklık + alt kartlar · #121 Stripe · #123 launch · #124 ertelenenler · #116 eGK/TI · #122 görünürlük/mail · #119'dan #33/#34/#41 · #120'den #29/#30 · #115'ten #8/#31 · #242 test hesapları · #248 sigorta · #150 Beta-1 canlı deneme · #117/#26 mobil (podoloji dışı)/PWA · #168/#170 veri katmanı · #184 · Physio/Ergo/Logo (#127, #128, #131, #132, #202, #251, #290, #291) · #214 · #125 · K-11 satın alma hesabı + lisans (launch öncesi, yeni kart).
