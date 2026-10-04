# Konsey Kararı — Kutuya erişim modeli (kolay kurulum + her yerden erişim)
Tarih: 2026-10-04 · Oturan üyeler: legal-de, onprem, guvenlik, muhalif, deger-mi, fonksiyon-ustasi
(dış göz oturmadı)

## Çerçeve
- SORU: Praxura yalnız on-prem satılacak (SaaS iptal, Kemal 04.10.2026). Kutu kolay kurulmalı ve
  PC/tablet/telefondan, praksis içinden VE dışarıdan açılmalı. Hangi barındırma/erişim modeli?
- TETİK: 04.10.2026 Windows yönetici testi (`praxura-installieren.ps1` 11/11). Bugünkü model (Caddy
  internal CA + `praxis.home.arpa` + router DNS) her cihaza kök sertifika yükletiyor (iPhone'da ek
  güven anahtarı). Telekom Speedport Smart 2'de elle DNS kaydı imkânsız (test kutusu
  `kemal.speedport.ip`'ye çevrildi). Erişim yalnız LAN'dan. Boş Windows şifresinde autostart ancak
  oturum açılınca kalkıyor.
- SEÇENEKLER:
  - A) Kutu müşterinin kendi Hetzner Cloud hesabında (playbook K12/K13/§4.2).
  - B) Praksis PC'si + bizim VPS'e dışarı tünel (SNI passthrough).
  - C) Praksis PC'si, yalnız LAN, gerçek sertifika (DNS-01).
- ON-PREM ETKİSİ (onprem): A ve C'de hasta verisi bizden geçmiyor. B'de şifreli PHI baytı ve hasta
  meta verisi bizim VPS'ten geçiyor.

## KARAR
**Varsayılan model A: kutu müşterinin KENDİ Hetzner Cloud hesabında bir sunucuda çalışır.**
- Alt ad: `praxis-XXXX.praxura.de` (ya da `.app`).
- Let's Encrypt sertifikası kutuda.
- Her cihazdan, her yerden erişilir. Sertifika yükleme ve router ayarı yok.

**İlk müşteriler elle kurulur.** Müşteri Hetzner hesabını randevudan ÖNCE açar (kimlik doğrulaması
günler sürebilir). Kurulum ekran paylaşımıyla, mevcut `install.sh` (Weg A) ile yapılır. Provisioner
(playbook §4.2) 3. müşteride ya da elle kurulum müşteri başına 2 saati aştığında yazılır.

**Seçenek C (praksiste duran sunucu, yalnız LAN, gerçek sertifika) ikinci yol olarak kalır.** Yalnız
"sunucu praksiste dursun" diyen müşteri için. Donanım önerisi: Windows resepsiyon PC'si değil,
önceden kurulmuş bir mini-PC. C'nin DNS-01 parçası ilk C müşterisine kadar yazılmaz.

**B (tünel) yapılmaz:** onprem sert vetosu (G8/G1). Cloudflare/ngrok tipi TLS'i açan servisler yasak
(legal-de ⛔ + guvenlik ⛔).

**K3 kutu testi bir Hetzner Cloud VM'de koşar**, praksis PC'sinde değil.

## Gerekçe
- legal-de: kolay kurulum + dış erişim şartını karşılayan, hukuken temiz tek seçenek A. §393 tetiklenir
  ama yükümlülük praksiste kalır, Hetzner'in C5 Typ-2 testatı var.
- onprem: A, playbook'un kilitli K12/K13 tasarımıyla birebir aynı. B'yi G8 ile kapattı.
- muhalif: "resepsiyon PC'si sunucu olamaz" itirazını A kökten çözüyor. Bu itiraz bu akşamki testte
  fiilen görüldü: şifresiz hesapta autostart yalnız oturum açılınca kalkıyor.

## Ödün verilenler
- "Veri fiziken praksiste" söylemi varsayılan modelde yok. Veri müşterinin kendi bulut sunucusunda
  duruyor; satış metni buna göre yazılmalı (UWG).
- Müşteri ayda ~€5–10 Hetzner öder ve bir Hetzner hesabı açmak zorundadır.
- İnternet kesilirse kutuya erişim kesilir (praksis içi yedek yol yok).
- K2'de yazılan Windows/WSL yolu varsayılan olmaktan çıkar.

## Uzlaşma
- B ve Cloudflare yok.
- C, LAN müşterisi için ikinci yol olarak kalır.
- İnternete açık kutu için güvenlik paketi ilk müşteriden önce şart.
- Mini-PC, A'ya rakip değil; C müşterisinin donanımıdır.
- S-43 iç CA'nın kalkmasıyla kapanır.
- O-155 A'da kendiliğinden çözülür.

## Anlaşmazlık
- İlk turda guvenlik B'yi (kendi passthrough tünelimizle) tercih etti. Kör nokta turunda G8 vetosunu
  görüp A'ya geçti.
- İlk turda muhalif A'ya "podolog Hetzner hesabını açamaz" diye itiraz etti. Elle, yanında kurulum
  koşuluyla itirazı düştü.

## Kör noktalar
- guvenlik: A'da da `praxura.de` DNS'i bizde, yani legal-de'nin MITM itirazı A'ya da uyar. Önlem:
  alt ad başına CAA `accounturi` (RFC 8657) + CT izleme; DNS/registrar hesabında 2FA.
- legal-de: playbook satır 28'deki "§393 uygulanmaz" ifadesi A için yanlış. Doğrusu: §393 tetiklenir,
  yükümlülük praksiste.
- legal-de: K12'deki sponsorlu instance döneminde bulut müşterisi biziz; o dönem AVV + §393 yükü
  bizde, ücretli dönemde hesap devri zorunlu.
- onprem: K1 (iki SKU) SaaS iptaliyle düştü.
- muhalif + onprem + guvenlik: C'de herkese açık DNS'in özel bir IP göstermesi FRITZ!Box rebind
  korumasına takılır; Speedport ölçülmedi.

## Uygulama — builder'a (sıralı)
- [ ] K3'ü Hetzner Cloud VM'de koş: test hesabı, `install.sh` Weg A, gerçek alt ad +
      `CADDY_TLS_ARG`=ACME e-postası; telefondan mobil veriyle giriş — K2
- [ ] guvenlik asgari paketi (ilk müşteriden önce): kurulum bitince `/api/setup/*` kapanır ve
      `SETUP_TOKEN` silinir; `/auth/v1/admin|signup` dışarıya kapalı; Caddy rate limit + `/token`
      brute-force freni; TOTP zorunlu; Hetzner firewall yalnız 80/443, SSH yalnız praksisin
      anahtarıyla; unattended-upgrades — K3
- [ ] Alt ad başına CAA `accounturi` + CT izleme; DNS hesabında 2FA — K2
- [ ] KURULUM.md'ye "Weg 0 — Hetzner Cloud (empfohlen)" + müşteri ön kontrol listesi (hesap
      önceden açılır, hesap/root müşterinin elinde, bizde erişim kalmaz) + §393 Kundenkriterien tek
      sayfası (legal-de) — K1
- [ ] Hetzner C5 Typ-2 testatının Cloud Server ürününü ve konumu kapsadığını doğrula (legal-de) — K1
- [ ] Playbook: K1 (iki SKU) → "yalnız kutu"; satır 28 §393 düzeltmesi; K12 sponsorlu dönem AVV notu
      — K1
- [ ] onprem/REGISTER + guvenlik/REGISTER: S-43 (A'da kapanır), O-155 (A'da çözülür), yeni maddeler
      (CAA, rate limit, TOTP, SETUP_TOKEN) — K1

## Backlog (karara dahil DEĞİL)
- Provisioner otomasyonu (§4.2): 3. müşteride.
- C için acme-dns delegasyonu + Speedport/FRITZ!Box rebind ölçümü: ilk C müşterisinde.
- Mini-PC imajı (önceden kurulmuş, Linux): C müşterisi gelince.
- B için avukat sorusu (§393 Abs. 3 Nr. 2 / §203 Abs. 3, TLS-passthrough relay): yalnız B yeniden
  gündeme gelirse.
- Windows yolunun kaderi (K-7): kılavuzda kalır mı, kaldırılır mı — ayrıca karar verilecek.

## Sert veto
- onprem ⛔ B: G8 (dış erişim bizim VPS'e bağlanır = buluta yeni runtime zinciri) + G1/K6 sınırı.
  Etrafından dolaşma yolu A.
- legal-de ⛔ ve guvenlik ⛔ Cloudflare/ngrok (TLS'i üçüncü taraf açar, PHI düz metin, ABD).
  Etrafından dolaşma yolu A ya da C.
