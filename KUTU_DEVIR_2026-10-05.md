# Kutu Devir Dosyası — 04/05.10.2026 oturumu

> **Bu dosya ne:** 04.10.2026 akşam – 05.10.2026 gece süren oturumun **tam devri**. Yeni bir sohbet
> bu dosyayla başlar ve hiçbir şeyi baştan sormadan devam eder. Dört bölüm:
> **(A)** kesinleşmiş ve uygulanmış kararlar · **(B)** onaylandı ama henüz sprinte işlenmedi ·
> **(C)** hâlâ karar bekleyenler · **(D)** "SaaS'ta çalışıp kutuda pürüz çıkaran" araştırma raporu.
> Sonda: ortam durumu, ham kaynaklar, yeni oturum prompt'u.
>
> **Bu dosya sprintin yerini TUTMAZ.** Plan `KUTU_HAZIRLIK_SPRINT.md`'dir. Bu dosya, sprinte henüz
> işlenmemiş kararları ve araştırmayı taşır. (B) ve (C) sprinte işlendikten sonra bu dosya
> `archive/rapor/`'a taşınır.

---

## 0. Yeni sohbette nasıl başlanır

Yeni sohbete aynen yapıştır:

```
KUTU_DEVIR_2026-10-05.md'yi baştan sona oku, sonra KUTU_HAZIRLIK_SPRINT.md'nin §0, §1 (özellikle K-18), §3 K2b ve §4 başındaki 05.10 notunu oku.
Önce git pull --rebase.
Devir dosyasının (C) bölümündeki açık kararları bana TEK TEK sor (AskUserQuestion, önerini ilk seçenek yap).
Cevaplar gelince (B) + (C) + (D)'deki "sprinte girecekler" listesini KUTU_HAZIRLIK_SPRINT.md'ye TOPLU işle, Melih'i etkileyen her şeyi §4 başındaki 05.10 notuna ekle, commit + push.
Kutuya dokunan her şeyi onprem'e, güvenliğe dokunanı guvenlik'e bildir (proje kuralı). Lisans metni için legal-de'yi çalıştır.
```

---

## (A) KESİNLEŞMİŞ VE UYGULANMIŞ — tekrar tartışılmaz

### A1. Ürün kararı
- **SaaS (`app.praxura.de`) satılmayacak. Satılan tek ürün kutu (on-prem).** (Kemal, 04.10.2026)
  SaaS bugün yalnız test/beta ortamı olarak yaşıyor; ona özel yeni iş açılmaz.
- Hafızaya da yazıldı (`project_nur_onprem_verkauf`).

### A2. Windows yönetici testi (04.10 akşam) — yapıldı
- `onprem/windows/praxura-installieren.ps1` yönetici olarak **11/11 adım** geçti.
- Yol üstünde **iki betik hatası** bulundu ve düzeltildi (ikisi de push'lu):
  - `1127a3d`: `BoxEnv` `.env` okurken `wsl.exe --` argümanları Linux kabuğundan geçiriyordu, awk'ın
    `$1`'i siliniyordu → `--exec`.
  - `4b9a554`: `InWsl` `--exec` ile PowerShell 5.1 iç çift tırnakları bozuyordu → komut **base64**
    taşınıyor (`source <(echo … | base64 -d)`); betiğin bütün komutları tek tek denendi.
- Gözlemler (sicilde O-163, O-164):
  - Windows şifresi **boş** hesapta "oturumsuz autostart" kurulamıyor → betik kendiliğinden
    "oturum açınca başlat"a düştü. Gerçek praksiste Box-PC hesabının şifresi olmalı (kılavuza → K2b.8).
  - Windows PC kendi LAN IP'sine bağlanamıyor (WSL mirrored) → kendi adresi için hosts'ta `127.0.0.1`
    gerekiyor (K2b.5).
  - Ağ profili "Öffentlich" idi → "Privat" yapıldı (betik uyardı, doğru çalıştı).

### A3. Bulgu: bugünkü erişim modeli kolay kurulum şartını karşılamıyor
- Caddy iç CA + `praxis.home.arpa` + router DNS kaydı ⇒ **her cihaza kök sertifika** (iPhone'da ek
  gizli güven anahtarı), **Telekom Speedport'ta router DNS kaydı imkânsız**, yalnız LAN erişimi.
- Test kutusu geçici olarak `kemal.speedport.ip` adına çevrildi (Speedport'un PC'ye verdiği ad).

### A4. Konsey 04.10 + Kemal eki 05.10 → **K-18: tek erişim yöntemi**
Tutanak: `konsey/tutanak/2026-10-04-kutu-erisim-modeli.md` (+ 05.10 eki) · `konsey/KARARLAR.md`.
- **Her kutuda aynı:** kurulum kodu → `praxis-XXXX.praxura.de` + **Let's Encrypt (DNS-01, kutu başına
  `acme-dns` delegasyonu)**. Ad, kutunun **iç IP'sini** gösterir. Hiçbir cihaza sertifika yüklenmez.
- Ölçüldü (04.10, Kemal'in Speedport Smart 2'si): iç IP gösteren genel ad (`192-168-2-111.sslip.io`)
  router DNS'inden **geçiyor** → Speedport'ta ek ayar yok. FRITZ!Box'ta tek "DNS-Rebind-Schutz" ayarı.
- **Uzaktan erişim bizim işimiz değil:** praksisin kendi VPN'i (FRITZ!Box WireGuard + QR). Kurulumu biz
  ekran paylaşımıyla yapabiliriz (K10'a uygun, veri erişimi yok). Praksisin **kendi** Hetzner hesabındaki
  kutu zaten her yerden açılır — Hetzner yalnız bir barındırma yeri, varsayılan değil.
- **Tünel/relay YOK** (onprem G8/G1 sert vetosu). **Cloudflare/ngrok YOK** (legal-de + guvenlik vetosu).
- Caddy iç CA kalkar → **S-43 kapanır**.
- Uygulama: `KUTU_HAZIRLIK_SPRINT.md` §3 **K2b** (K2b.1–K2b.10, ~3–5 gün), §0'da yeni satır.
- onprem sicili: **O-161…O-165** (`d721a67`). Önemli şartlar:
  - Ad servisi + acme-dns: merkez adresleri kutuya env'den, zone anahtarı kutuya yok (G2), DNS
    kayıtları **DNS sağlayıcısında** (VPS düşerse adres düşmesin), **çıkış yolu kılavuzda** (biz
    ortadan kalkarsak sertifikalar ≤90 günde düşer → praksis kendi alan adını girebilmeli; son çare iç
    sertifika) — bu yazılmadan K3 yok.
  - O-155 (hasta maillerindeki linkler) yalnız **kısmen** çözülüyor (bkz. C1/D1).
  - O-162: internet kesilince LAN'da ad çözülmeyebilir — ölçülecek (K2b.9).
  - O-165: playbook çelişkileri — K1 "iki SKU" düştü; satır 28 "§393 uygulanmaz" Hetzner varyantında
    tutmuyor (§393 praksiste tetiklenir); K12 sponsorlu Hetzner kutuları **bizim hesabımızda** koşarsa
    AVV gerekir ya da sunucu praksisin hesabında olmalı (Kemal kararı, bkz. C7).

### A5. Praksis adresini kendisi seçer (K2b.2'ye işlendi, `2478efa`)
- Kurulumda "Ihre Adresse: ____.praxura.de" — küçük harf/rakam/tire, dolu/yasak adda öneri, boş =
  otomatik ad. Sertifika kayıtları (CT) herkese açık → kılavuzda "keine Patientennamen".
- Açık alt soru: ad sonradan değişebilir mi → onprem (K2b içinde).

### A6. Erstanmeldung formu düzeltildi (`c27d3cf`, push'lu)
- `#erstPanel` stil kurallarına eklenmemişti (alanlar stilsiz, satır içi) → eklendi.
- "Anmelden" + "Erstanmeldung" çift başlık → Erstanmeldung açıkken üst başlık gizleniyor.
- Playwright ile denendi: tek başlık, düzgün alanlar, konsol hatası 0. `login.js?v=20261005a`.
- Kutuya gece 02:00 güncellemesiyle gelir.

### A7. 2FA — **yok** (K-12 aynen)
- legal-de 02.10'da bağladı (`compliance/LEGAL_DECISIONS.md` 2026-10-02): 2FA yasal zorunluluk değil;
  kutuda sorumlu praksis, Praxura'nın rolü yok. Kemal: "bizim sorumluluğumuz değilse boşver" → yok.
- Hetzner varyantında praksis kontrol listesine yalnız "güçlü şifre" tavsiyesi. Ucuz korumalar
  (rate limit, setup ucunun kapanması) K2b.7'de kalıyor.

### A8. Mail — otomatik gönderme launch sonrasına (Ops kartı açıldı)
- Ops'ta **yeni alan: "Update (nach Launch)"** — launch sonrası güncellemeyle gelecek işler buraya.
- İlk kart (Melih): "Box: E-Mail automatisch senden — eigenes Postfach der Praxis verbinden (SMTP mit
  Anbieter-Vorlagen + Testmail)". Kartta: bizim sunucumuzdan mail YOK (G1), şifre şifreli saklanır,
  env geri düşüş kalır, linkler yalnız internetten erişilebilir kutuda.
- ⚠️ **Teyit bekleyen yorum (C2):** sprintte yalnız "Mail vorbereiten" (mailto) yapılacağı varsayıldı.

### A9. Depo — şimdilik **public kalıyor**
- Sebep: Vercel ücretsiz planı private depoda **yalnız hesap sahibinin** commit'lerini yayınlıyor
  (Melih'inkiler "does not support collaboration" ile duruyor; CLI de aşmıyor) — doğrulandı.
- Karar (Kemal): **sprint kesin bittikten ve Kemal kutuyu kendisi test edip çalıştığını gördükten
  sonra, betalara vermeden önce** bölünür. Bölme yönü (konuşuldu, kesin plan o gün):
  - **Mevcut depo private** olur (backend `api-backend/`, `onprem/`, planlar, konsey, `fortschritte/`,
    `db/`, `wissensbank/`, siciller) — imaj adresleri, Actions, geçmiş, ajanlar yerinde kalır.
  - **Yeni küçük public depo:** tanıtım sitesi (index, blog, SEO sayfaları, indirme sayfası) → Vercel.
  - Tarayıcıya giden ön yüz kodu zaten herkese açık (kutuda da) — onu gizlemek bir şey korumaz.
  - `app.praxura.de` (SaaS test ortamı) betalar kendi test kutularına geçince kapanır.
  - Bilinen: public geçmişte kalan dosyalar silinse de geçmişte açık kalır.
- ⚠️ Docker imajları (`ghcr.io/ironkemal/infinitymade-website/...`) **public kalmalı** — depo private
  olunca imajlar da private'a dönerse kutuların güncellemesi sessizce durur. Bölme günü kontrol et
  (`gh` bu makinede kurulu değil).

### A10. Kurulum dağıtımı — A yolu (tek satır komut), iki komut
- **Windows PC/laptop:** PowerShell (yönetici) → `irm https://praxura.de/install.ps1 | iex`
- **Linux** (kendi sunucusu, mini-PC, Hetzner Cloud — hepsi aynı): `curl -fsSL https://praxura.de/install.sh | sudo bash`
- iPhone/iPad/Android/Mac **kurulum yeri değil**, yalnız tarayıcıyla giriş. Mac kutu yeri olarak
  desteklenmiyor (test edilmedi).
- Komutun ilk sorusu kurulum kodu. İndirme sayfası cihazı tanır, doğru satırı "Kopieren" ile gösterir.
- Kod imzalı `.exe` (yılda ~200–400 €, doğrulanmadı) **şimdilik yok** — gereksiz gider (Kemal).
- **K2b'de yapılacak** (Kemal onayı 05.10): indirme sayfası + `install.ps1`/`install.sh` başlatıcı +
  sürümlü paket praxura.de'de statik dosya (yeni Vercel fonksiyonu yok, G8 temiz) → **O-157 kapanır**
  (artık `main`'den değil yayınlanmış sürümden kurulum).

### A11. Sprint değişiklikleri — push'lu
- `ebd0e50` K-18 + K2b + §4 başında Melih notu (Hat M neredeyse etkilenmiyor; M3.1 kamera notu; **M2
  prompt'undaki eski "migration numarasını rezerve et" talimatı düzeltildi** — §2 madde 3 geçerli).
- `d721a67` K2b.2 onprem şartları + O-155 kısmi.
- `2478efa` K2b.2 ad seçimi.
- Konsey kaydı `9517917`, günlük `fortschritte/2026-10-05.md` (Hat K bölümü).

---

## (B) ONAYLANDI AMA HENÜZ SPRİNTE İŞLENMEDİ — yeni sohbette toplu işlenecek

| # | Karar (Kemal onaylı) | Sprintte nereye | Not |
|---|---|---|---|
| B1 | **Kurulum jetonu (`SETUP_TOKEN`) praksise gösterilmez** — kurulum programı tarayıcıyı jeton içine yerleştirilmiş hâlde açar (`…/setup.html#jeton` gibi). Jeton kutuda üretilmeye devam eder (biz bilmeyiz → owner hesabını biz açamayız; bilinçli güvenlik kararı) | K2b.5 | iki kodu tek koda indirmek DEĞİL, jetonu gözden kaldırmak |
| B2 | **Şifre kuralı: Inhaber ≥ 12, çalışan ≥ 8** (bugün tersi: owner 8, çalışan 12) | K2b (yeni madde) | yerler: `setup.html:223` `minlength`, `api-backend/setup/router.js:188`, `api-backend/routes/mitarbeiter-zugang.js:542-545`, `login.js:299` (erst), `login.js:262` (newPw — owner mı çalışan mı bak) + metin "mindestens 12 Zeichen" (`login.html:352`) |
| B3 | **"Passwort zurücksetzen" düğmesi** — Inhaber Team listesinde çalışan için yeni Einrichtungscode üretir, çalışan aynı Erstanmeldung ekranından yeni şifre koyar | K2b (yeni madde) — `dashboard.js` ORTAK, `module/` → Hat M alanı, koordine et | **Backend + modül HAZIR:** `POST /api/team/mitarbeiter/:id/einrichtungscode` (`mitarbeiter-zugang.js:417`, açık oturumları da düşürüyor — K1.3), `module/mitarbeiter-zugang.js:100 neuerEinrichtungscode()` + `:167 zeigeEinrichtungscode()`. **Eksik olan yalnız düğme** (hiçbir yer çağırmıyor — doğrulandı). Erstanmeldung ucunun var olan kullanıcıda şifreyi güncellediğini doğrula |
| B4 | **K-11 satın alma akışı** sprint dışı kalır, ama **tek kurulum kodu** mantığıyla bağlanacağı not edilir (satın al → kod → kurulum programı kodu sorar → ad + sertifika) | §1 K-11 satırına not | — |
| B5 | **İndirme sayfası + başlatıcılar** K2b'de (A10) | K2b (yeni madde) | O-157 kapanır |
| B6 | **Lisans dosyası şimdi** ("Alle Rechte vorbehalten", kopyalama/kullanma yasak) depoya + kutuya | sprint dışı, hemen | **legal-de metni yazar** — henüz ÇALIŞTIRILMADI |
| B7 | **Depo bölme** sprint sonu, betalardan önce (A9) | §8 / yeni "sprint sonrası" satırı | — |
| B8 | **2FA yok** (A7) | K2b.7'deki "TOTP → Kemal kararı" satırı kapatılır: "yok, legal-de 02.10" | K2b.7 metnini düzelt |

Bilgi (sprinte gerek yok, yeni sohbette bilinmeli):
- **Einrichtungscode nasıl üretiliyor:** owner Team'de çalışan ekler → sunucu 10 karakter rastgele kod
  (`XXXXX-XXXXX`, karışan I/O/0/1 yok, `mitarbeiter-zugang-code.js`) → yalnız bir kez gösterilir → DB'de
  yalnız SHA-256 hash → **7 gün** geçerli → çalışan e-posta + kod + kendi şifresiyle hesabı açar, mail yok.
- **İlk hesap (Inhaber) bugün:** `install.sh` sonunda iki değer bir kez gösterilir: **veri anahtarı**
  (`DATA_ENCRYPTION_KEY` — kaybolursa şifreli alanlar yedekten bile dönmez, `GESICHERT` yazılana kadar
  bekler) + **kurulum jetonu** (`SETUP_TOKEN`) → tarayıcıda `setup.html` → jeton → Inhaber hesabı
  (e-posta, şifre, praksis adı, Fachbereich; onay maili yok; `professional/active` doğar) →
  `login.html`. Inhaber şifre sıfırlama: sunucuda `reset-owner-passwort.sh`.

---

## (C) HÂLÂ KARAR BEKLEYENLER — yeni sohbette TEK TEK sorulacak

| # | Soru | Seçenekler | Önerim |
|---|---|---|---|
| **C1** | **Online randevu kutuda nasıl çalışsın?** (her kutuda AYNI çalışmalı — Kemal şartı: "Hetzner olur LAN olmaz" kabul değil) | **Y1** hiç yok (sayfalar gizli, maillerde "antworten/anrufen") · **Y2** boş saatler praxura.de'de, talep hastanın **kendi mail programından** praksise (bizden hasta verisi geçmez, 1–2 gün) · **Y3** şifreli posta kutusu: veri tarayıcıda praksisin anahtarıyla şifrelenir, sunucumuz okuyamaz, kutu çeker (tam otomatik; konsey + legal-de; birkaç gün) | Launch'ta **Y2**, Y3 "Update (nach Launch)" kartı |
| **C2** | **Mail yorumu teyidi:** sprintte "Mail vorbereiten" (mailto — praksisin kendi mail programını hazır metinle açar, sıfır kurulum) yapılsın mı, yoksa sprintte kutuda **hiç mail** olmasın mı? Otomatik gönderme zaten Update kartında | mailto sprintte · sprintte hiç mail yok | mailto sprintte |
| **C3** | **Grup-2 çözümleri** (D2) uygun mu: rota linki (OSM/Google Maps, API yok) · `.ics` dışa aktarma · destek maili (`support@praxura.de`, mailto) · kutuda ödeme/"ödeme gecikti" ekranlarını hiç göstermemek · `admin.praxura.de` linkini gizlemek | hepsi evet · tek tek | hepsi evet |
| **C4** | **Çalışan sınırı kutuda** (bugün `professional` = 8, 9.'da "upgraden" ama yol yok) | şimdilik sınırsız · `klinik` (15) · lisansa bağla (K-11 ile) | şimdilik sınırsız, lisans gelince bağla |
| **C5** | **O-155 artığı** — C1'e bağlı: Y1/Y2'de hasta maillerinde link yok ("antworten/anrufen"), Y3'te linkler posta kutusu üzerinden çalışır | C1'le birlikte çözülür | — |
| **C6** | **`app.praxura.de`'nin kaderi** — betalar test kutularına geçince kapatılsın mı (A9 bölmesiyle) | evet · SaaS test ortamı kalsın | evet (bölme günü) |
| **C7** | **K12 sponsorlu beta kutuları** — bizim Hetzner hesabımızda mı (o zaman AVV + §393 yükü bizde), praksisin kendi hesabında mı? (O-165) | praksisin hesabı · bizim hesap + AVV | praksisin hesabı (ya da betanın kendi PC'si) |
| **C8** | **Stash sahibi:** depoda commit'lenmemiş bir yarım iş duruyor: `stash@{0}: On main: fussbefund-versionierung + warteliste` (13 dosya, eski commit `69c02d0` üstünde). Kimin? | Melih'e sor | **Dokunma.** 05.10'da yanlışlıkla bir an açıldı, çakıştı, temizlendi; stash aynen duruyor |

---

## (D) ARAŞTIRMA RAPORU — "SaaS'ta çalışıyor, kutuda pürüz çıkarıyor"

Yöntem (05.10 gece): 4 paralel agy worker'ı (Gemini 3.8 Flash, salt-okur `--mode plan`): ön yüz ·
backend · Vercel/Supabase/ödeme/analitik · siciller. Ardından ana oturum en ciddi iddiaları **kodda
tek tek doğruladı**; iki abartılı iddia ayıklandı (D5). Ham raporlar: `C:/tmp/agy-tasks/onprem-puerz/w{1..4}-*.md`.

**Ölçüt:** çözüm her kutuda AYNI çalışmalı (LAN'daki PC/laptop/sunucu/mini-PC ve Hetzner). Bunun pratik
anlamı: kutu **dışarıya** bağlanabilir (her kutuda var), ama **dışarıdan kutuya** bağlanılamaz (LAN'da yok).
Hasta/dış dünyanın kutuya ulaşmasını gerektiren her şey ya kaldırılır ya da kutunun dışarı çıkan
bağlantısıyla / hastanın kendi araçlarıyla çözülür.

### D1. Grup 1 — Hastanın dışarıdan ulaşması gereken (asıl zor kısım)

| Özellik | Kod | Bugün kutuda |
|---|---|---|
| Online randevu (`booking.html?u=…`) | `booking.js:246,445` · link üretimi `dashboard.js:705`, `:14829`, `:14879` · public uçlar `server.js:1005`, `:1026` | LAN'da hasta evden açamaz; Hetzner'de çalışır |
| Termin-Anfrage formu | `booking-request.js:1239` · uçlar `server.js:3984`, `:4349`, `:4500` | aynı |
| Hasta maillerindeki iptal/kabul linkleri | `server.js:4107`, `:4127`, `:4300`, `:4430` (`appBaseUrl()`) | LAN'da hasta açamaz (O-155) |
| Çalışana özel randevu linki | `routes/mitarbeiter-zugang.js:195` | aynı |
| Public lookup uçları (Leistungen/Team/Kassen) | `server.js:3869`, `:3899`, `:3925`, `:3949` | yalnız randevu sayfaları için |

Çözüm seçenekleri → **C1** (Y1/Y2/Y3). Hangisi seçilirse seçilsin: randevu sayfalarındaki
Impressum/Datenschutz linkleri (D3-4) ve çalışan linki aynı karara göre düzenlenir.

### D2. Grup 2 — Merkezi servislere bağlı olanlar

| Özellik | Kod | Bugün kutuda | Her kutuda çalışan basit çözüm |
|---|---|---|---|
| Hausbesuch mesafe/rota | `dashboard.js:5084`, `:5121`, `:5157` (Supabase Edge Functions → openrouteservice); kutuda `module/hausbesuch-route.js:19-29` düğmeyi gizliyor | km elle | **"Route öffnen"** düğmesi: tarayıcıda OpenStreetMap/Google Maps rotası açılır, km kullanıcı girer. API anahtarı yok, maliyet yok |
| Google Takvim senkronu | `server.js:186-191`, `:535-576`; `kalender.js:781`; `dashboard.js:11487` | 503 (anahtar yok). Her kutunun adresi farklı → Google'a redirect kaydedilemez; sırrı kutuya koymak G2 | **`.ics` dışa aktarma** (tek termin + tüm takvim; Google/Outlook/iPhone açar) |
| Gmail ile gönderme | `server.js:620` `/api/gmail/send`, `dashboard.js:11055` | kapalı | mail kararı (A8/C2) |
| KI (Rezept-Scan, mail taslağı, B2C) | `ai/azureClient.js:38-42` prod'da `throw`; `server.js:2330`; `ai/router.js:32`; `dashboard.js:11353` | **500 hatası**, düzgün mesaj yok | sprintte **M4.1** zaten planlı (503 + Almanca mesaj); barkod (M3) yerel |
| Geri bildirim/destek formu | `dashboard.js:13501` → `feedbacks` tablosu | kutunun kendi DB'sine yazıyor, **kimse görmüyor** | **"Support kontaktieren"** → `support@praxura.de`'ye hazır mail (mailto, "keine Patientendaten" uyarısı) |
| Ödeme ekranı (paywall) + "ödeme gecikti" bandı | `dashboard.js:17750-17753`, `:18118` `__pwActivate`; `:1058` `#pastdue-fix-btn` → `/onboarding.html` (404) / Stripe portal (404) | IST_KUTU kontrolü yok; `plan_status` canceled/expired olursa **dashboard kilitlenir** | kutuda bu ekranlar hiç gösterilmez (IST_KUTU) |
| Çalışan sınırı | `dashboard.js:148` `PLAN_EMPLOYEE_LIMITS` (professional 8), `:13002-13004`; kutu `professional` doğuyor (`setup/router.js:224`, `lib/dagitim.js:10`) | 9. çalışanda "upgraden", yol yok | → **C4** |
| `admin.praxura.de` linki | `dashboard.js:15269`, `login.js:130`, `:142` | kutuda anlamsız | kutuda gizle |

Zaten iyi çözülmüş (dokunma): Apify/B2B arama (`lead-suche.js:22-32`, `server.js:686`) · n8n B2B kartı
(`lead-suche.js:30`) · Stripe ayar düğmeleri (`subscription-ui.js:14-20`) · Sentry (`telemetryEnabled:false`,
`server.js:419`) · Umami (imaja girmiyor) · fontlar/CDN (yerel) · DSGVO export/silme (`routes/dsgvo.js`) ·
çalışan girişi (Einrichtungscode) · owner şifre sıfırlama (betik) · realtime (kutuda `realtime` servisi var,
`docker-compose.yml:237`) · Storage (yerel) · §302 dosya üretimi (tamamen yerel) · n8n booking webhook
(env yoksa atlanıyor) · `pg_net` (kutuda kaldırılmış).

### D3. Grup 3 — Gerçek hatalar (kodda doğrulandı)

| # | Hata | Kod | Doğrulama | Çözüm | Nereye |
|---|---|---|---|---|---|
| 1 | 🔴 **Belegliste + CSV dışa aktarma kutuda hiç açılmıyor** | `dashboard.js:16692`, `:16835` `new URL(\`${API}/…\`)` | kutuda `apiBase:'/api'` (`server.js:409`) → `new URL('/api/x')` Node'da `ERR_INVALID_URL` attı; başka `new URL(\`${API}` yok | `new URL(…, location.origin)` — iki satır | K2b ya da hemen (küçük, ORTAK dosya, büyümez) |
| 2 | 🔴 **Alıcı sertifikaları taze kutuda boş (O-132)** — §302 şifrelemesi başarısız | `abrechnung.routes.js:1240`; tablo `empfaenger_zertifikate` yalnız `tools/empfaenger-zertifikat-laden.mjs` ile SaaS'ta dolduruluyor | sicilde açık (`onprem/REGISTER.md:465`, `:3932`) | seed migration ya da imajdan çözme — **Abrechnung'u bloke ediyor, K3'ten önce şart** | sprintte sahibi belirlenmeli (§302 → Hat M, kutu → onprem) |
| 3 | 🔴 **KI düğmeleri kutuda 500** | `ai/azureClient.js:40` | sicil + rapor | M4.1 | Hat M (planlı) |
| 4 | 🟠 **Randevu sayfalarındaki Impressum/Datenschutz kutuda 404** | `booking-request.html:659`, `:689-691`; `booking.html:752`, `:775-777`; `confirm.html:132-133`, `:161`; `employee-signup.html:432-434` | `onprem/frontend.Dockerfile` COPY listesinde bu sayfalar yok (doğrulandı) | C1'e bağlı: Y1'de sayfalar zaten gizli; Y2/Y3'te praksisin **kendi** Datenschutz/Impressum metni (Branding sayfasından, M2.4) — sorumlu praksis | C1 sonrası |
| 5 | 🟠 **Gece 23:55 mesai kapatma** — PC kapalıysa hiç çalışmıyor, açıksa iki kez (PM2 `-i 2`) | `server.js:3831-3856` `setInterval`; `api-backend/Dockerfile` CMD `-i 2` (doğrulandı) | — | iş yalnız bir kopyada (`NODE_APP_INSTANCE==='0'`) + açılışta kaçırılan günü kapat — her kutuda çalışır | K2b ya da M |
| 6 | 🟠 **İnternet kesilince LAN'da ad çözülmüyor** (O-162) | — | sicilde | K2b.9 (ölç + yedek yol) | K2b (var) |
| 7 | 🟡 **"KI-Bericht" + "B2B-Bericht senden" ölü** — **SaaS'ta da** | `dashboard.js:12894` `${API}/ai-summarize`, `:12948` `${API}/b2b-mail-agent` | `server.js` / `ai/router.js`'te bu uçlar yok (grep doğrulandı) | kaldır ya da M4 kapısına bağla | Hat M (M4) |
| 8 | 🟡 Eski yedek adresler: `/api/config` düşerse ön yüz `n8n.infinitymade.de/api`'ye token gönderir | `supabase-config.js:18`, `dashboard.js:705`, `:14829` | — | kutuda yedek adres yok, config yoksa hata göster | K2b |
| 9 | 🟡 Kullanılmayan uçlar | `server.js:1335` verify-code (eski), `:3045` prescription lookup (n8n) | — | temizlik (K-13: kod borcu sprint dışı) | Update/backlog |

### D4. Ek gözlem
- Zygote 3D görüntüleyici: kutuda CSP iframe'i engelliyor, dış link + SVG yedeği var — sorun değil.
- DTA portal linkleri (ITSG, Davaso, DDG, Bitmarck): dışarı giden düz linkler — her kutuda çalışır.

### D5. agy'nin yanıldığı / abarttığı (ayıklandı)
- "LAN kutusunda canlı takvim sertifika yüzünden çalışmaz" — bugün doğru, **K2b gerçek sertifikayla kalkar**.
- "Kiosk tableti hız sınırına takılır (aynı IP)" — LAN'da her cihazın kendi IP'si var; zayıf, listeye alınmadı.

### D6. Sprinte girecekler (C kararlarından bağımsız olanlar)
D3-1 (Belegliste), D3-2 (O-132 sahibi + K3 önkoşulu), D3-5 (23:55 işi), D3-8 (yedek adres), D3-7 (M4'e
not), D2'deki ödeme/paywall gizleme + admin linki (C3 teyidiyle). C kararlarına bağlı olanlar: online
randevu (C1), mail (C2), rota/.ics/destek (C3), çalışan sınırı (C4).

---

## Ortam durumu (Kemal'in makinesi, 05.10 gece)

- **Test kutusu** (WSL `Praxura`): `SITE_URL=https://kemal.speedport.ip` (geçici; eski hâli
  `/opt/praxura/onprem/.env.vor-speedport`). 8 servis sağlıklı. Autostart **oturum açınca** (şifresiz
  hesap). Windows hosts: `praxis.home.arpa` ve `kemal.speedport.ip` → `127.0.0.1`. Kök sertifika Windows'a
  eklendi; kopyası masaüstünde `praxura-wurzelzertifikat.crt`. Yedek hedefi `/root/sicherung` (test).
  Ağ profili "Privat".
- **Yapılmamış testler** (K2b gerçek adresle yapılınca anlamlı): tablet/telefon girişi, yeniden başlatma
  sonrası kalkma, çalışan kaldırınca girişin reddi, Hausbesuch kaydı (O-11 düzeltmesi `63359ad`) kutuda.
- **Git:** `main` temiz, son push `2478efa`. Stash: C8.
- **agy ham raporları:** `C:/tmp/agy-tasks/onprem-puerz/` (`w1-frontend.md`, `w2-backend.md`,
  `w3-cloud.md`, `w4-register.md` + görev metinleri `*.full.md`).
- **Melih'e iletilecekler:** stash (C8) · M2 prompt'u düzeltildi · §4 başındaki 05.10 notu · Ops'taki yeni
  "Update (nach Launch)" kartı · D3-2/D3-7 Hat M'ye düşebilir.

## İlgili dosyalar
`KUTU_HAZIRLIK_SPRINT.md` (plan) · `konsey/tutanak/2026-10-04-kutu-erisim-modeli.md` ·
`onprem/REGISTER.md` (O-155, O-157, O-161…O-165, O-132, O-11) · `compliance/LEGAL_DECISIONS.md`
(2026-10-02: 2FA) · `onprem/KURULUM.md` (K2b.8'de yeniden yazılacak) ·
`onprem/windows/praxura-installieren.ps1` · `fortschritte/2026-10-05.md`
