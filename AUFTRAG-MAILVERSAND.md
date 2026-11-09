# İş tanımı — Praxis mail gönderimi (Einstellungen)

> **Kime:** Melih (ve Melih'in Claude oturumu). **Yazan:** Kemal + Claude, 09.11.2026.
> **Durum:** açık — kod yazılmadı. Danışılanlar: `onprem` (sicil **O-243**, hüküm "geçer, kayıtla"),
> `db-ustasi`. Bu dosya Claude'a doğrudan prompt olarak verilebilir.

---

## 1. Amaç — tek cümle

Praxis, **uygulama kurulduktan sonra, Einstellungen içinden ve isteğe bağlı olarak** kendi mail
hesabını bağlar; hastaya giden bütün mailler (Terminerinnerung, Rechnung, Dokument-Mail,
Sondertag-Mitteilung) bu tek bağlantıdan, praxisin kendi adresinden gider.

## 2. Kemal'in kararları (yeniden tartışılmaz)

- **Kurulumda mail sorulmaz.** Kurulum sihirbazından mail adımı kalkar. Kurulum hızlı biter,
  mail sonra sakin sakin ayarlanır.
- **Mail zorunlu değil.** Kurulmazsa yazılım tam çalışır; yalnız gönderim kapalıdır (bugünkü
  `kein` → mailto-taslağı davranışı). Mail gerektiren ekranlarda "E-Mail-Versand einrichten →"
  yönlendirmesi gösterilir, hata değil.
- **Kurulumu biz yapıyoruz.** Müşteriyle konuşurken "maili ne?" diye sorulur, birlikte bağlanır
  (gerekirse TeamViewer oturumunda). Ekran yine de müşterinin tek başına geçebileceği kadar açık
  olmalı.

## 3. Ekran — Einstellungen → „E-Mail-Versand"

Üstte durum kartı: **Nicht eingerichtet / Verbunden (adres) / Verbindung unterbrochen**,
son test zamanı ve sonucu.

Altta seçim (sağlayıcı havuzu, kartlar halinde):

| Seçenek | Yol | Not |
|---|---|---|
| **Microsoft 365 / Outlook** | „Mit Microsoft verbinden" — **device code flow** (ekranda kod + `microsoft.com/devicelogin` linki) | Public client, secret yok. Token kutuda kalır, kutu doğrudan Microsoft'a gider. Kurumsal tenant'ta admin onayı gerekebilir (ölçülmedi). v1'e yetişmezse geçici: SMTP + not |
| **Google / Gmail** | **SMTP + App-Passwort** (`smtp.gmail.com`) | Kutuda Google OAuth **yok** (aşağıda §5). Ekranda: „2-Faktor aktivieren → App-Passwort erstellen" adım adım, linkle |
| IONOS · Strato · 1&1 · T-Online · GMX · Web.de | Preset: host/port hazır, kullanıcı yalnız **adres + şifre** yazar | Sağlayıcıya özel ipucu (aşağıda) |
| **Andere** | Elle: host, port, güvenlik (SSL/STARTTLS), kullanıcı, şifre | |

Ortak alanlar: gönderici adresi (varsayılan = hesap adresi), görünen ad (varsayılan = praxis adı).

**Sağlayıcıya özel hata yönlendirmesi** — genel „Anmeldung fehlgeschlagen" yerine:
- T-Online → „Bitte ein separates **E-Mail-Passwort** im Kundencenter anlegen" (giriş şifresi çalışmaz)
- GMX / Web.de → „Unter Einstellungen **POP3/IMAP-Zugriff erlauben**"
- Gmail → „2-Faktor + App-Passwort nötig"
- Her ipucu kısa bir yardım sayfasına/ekran görüntüsüne bağlanır.

**Butonlar:** „Speichern" · **„Testmail senden"** (owner'ın kendi adresine) · „Trennen".
Test **her iki yolda** da olur — OAuth bağlantısı da kopar (şifre değişti, izin geri alındı,
`invalid_grant`). Gönderim sırasında bağlantı koparsa durum kartı „unterbrochen"a döner ve
dashboard'da görünür uyarı çıkar.

Metinler yalnız Almanca (`T.de`). Yeni kod `module/mailversand.js` gibi ayrı dosyada —
`dashboard.js` büyümez.

## 4. Arka taraf

**Tablo (db-ustasi önerisi):** yeni tablo, adı önerisi `praxis_mailversand`, PK
`owner_id → profiles(id) ON DELETE CASCADE`. Alanlar: mod (`aus | microsoft_oauth | smtp`;
SaaS'ta ayrıca `gmail_oauth`), preset, host, port, güvenlik, kullanıcı, şifre (şifreli),
gönderici adresi, görünen ad, son test zamanı/sonucu, bağlantı durumu.
- **`profiles`'a KONMAZ** — owner kendi profil satırını istemciden okur, şifre istemciye gider
  (guvenlik S-42 bunu bir kez yaşadı).
- **RLS açık, `authenticated` için policy yok** — erişim yalnız backend (desen:
  `datenaustausch_zaehler`, gmail RPC'lerindeki `REVOKE … FROM PUBLIC, anon, authenticated`).
  Backend route'u istemciye yalnız durum alanlarını ve „şifre kayıtlı mı" boolean'ını döner;
  **şifre/token asla dönmez.**
- Şifre `lib/phi-encrypt.js` (`encryptPHI`/`decryptPHI`) ile. Vault değil (Supabase'e özel,
  G8). `DATA_ENCRYPTION_KEY` yoksa kaydetme **reddedilir**, düz metin saklanmaz.
- ⚠️ **Kolon adı tuzağı:** şifre kolonu adı `smtp_passwort` gibi **`_passwort`/`_secret` ile
  bitmeli** — `dsgvo/export.js`'teki `GEHEIM` deseni ad sonuna bakar; `smtp_passwort_enc`
  maskelenmez ve Auskunft dosyasına çıkar.
- Gmail tokenı (SaaS) mevcut Vault RPC'lerinde kalır (`set/get/clear_gmail_token`) — ikinci
  token deposu açılmaz. Microsoft tokenı kutuda bu tabloda şifreli.
- Bugün dağınık duran gönderici alanları (`profiles.b2b_from_email`, `b2b_sender_name`,
  `b2b_setup_done`) yeni tabloya **iki adımda** taşınır: önce yeni tablo + okuma fallback'i,
  eski kolonlar sonra ayrı migration'la (`:beta` ve `:stable` aynı anda canlı).
- Sıra bağlayıcı: migration dosyası (`api-backend/db/migrations/NNNN_…sql`) → aynı commit'te
  `db/SCHEMA*.sql` tazeleme + `db/REGISTER.md` kaydı + `api-backend/dsgvo/klassifikation.js`
  girişi (`kategorie: 'loeschen'`, `export: { filter: 'owner_id' }`) → sonra canlı (MCP).
  `dsgvo/loeschen.js`'teki profiles null'lama bloğu yeni tabloyu da kapsamalı (ya da CASCADE'e
  güvenildiği kayda yazılır).

**Tek seçici `lib/mail.js` içinde** (ör. `mailKanal(ownerId)`), öncelik:
1. DB ayarı → 2. yoksa env `SMTP_*` (eski kutular + SaaS, **davranış birebir aynı**) →
3. yoksa `kein`.
- Env'den DB'ye otomatik kopya yapılmaz; env'den gelen ayar ekranda salt-okunur gösterilir.
- Compose'daki `SMTP_*` satırlarına dokunulmaz (`update.sh` kuralı).
- Bütün gönderenler bu seçiciden geçer: `routes/dokument-mail.js` (`versandWeg()`),
  `lib/terminerinnerung*.js`, `routes/sondertag-mitteilung.js`, `lib/gmail-senden.js`,
  `server.js` içindeki booking mailleri. ⚠️ **Sessiz kırılma riski:**
  `setup/update-alarm-mail.mjs` (yedek/güncelleme alarmı) ve `lib/verbindungen.js`
  (şeffaflık sayfası) da seçiciye bağlanmalı — yoksa UI'dan mail kuran kutuya alarm gitmez,
  şeffaflık sayfası „mail yok" der.

**Kaldırılacaklar:** `/api/setup/test-smtp` (`setup/router.js`) ve kurulum sihirbazının mail
adımı (`setup.js` Schritt 3). Yerine owner girişli Testmail ucu `api-backend`'de.
`RELEASE-STANDARD.md` §5.4 kontrol 9 aynı commit'te güncellenir. (`install.sh` SMTP'yi zaten
sormuyor — O-142.)

## 5. Sert korkuluklar (onprem veto — aşılmaz)

- **G1/K6:** şifre, token ve mail içeriği **merkezden geçmez.** OAuth için merkez üzerinden
  redirect relay **yok.** İçerik/alıcı/ek loglanmaz.
- **Google OAuth kutuda yok** (O-08): web akışı sabit public redirect + bizim
  `GOOGLE_CLIENT_SECRET`'ımızı ister; device flow `gmail.send` vermez; loopback kutuya değil
  kullanıcının PC'sine düşer. „Mit Google verbinden" yalnız SaaS'ta kalır
  (`GOOGLE_KONFIGURIERT`). Bu yüzden Google doğrulama videosu/incelemesi **bu işin parçası
  değil.**
- **G2:** image'da client secret yok; Microsoft yalnız public client.
- **G8:** Vercel fonksiyonu yok, n8n yok — bütün uçlar `api-backend`'de.
- **G7:** tek kod; SaaS davranışı değişmez.
- **Gönderen adresi hesabın kendi adresi** — kutuda `noreply@praxura.de` asla (O-51);
  kapıdaki `absender_fest` sayısı artamaz.
- **Sağlayıcı host/port listesi kodda sabit.** Dışarıya otomatik ayar sorgusu (Mozilla ISPDB,
  MX lookup) yapılmaz — yeni dış çağrı olur.
- **Belge mailinde `requireTLS` kalır** (legal-de 22.10.2026, O-216).

İlgili sicil: O-243 (bu iş) · O-08 · O-14 · O-51 · O-66 · O-142 · O-185 · O-216 · O-231 ·
O-233 · O-240 (`onprem/REGISTER.md`).

## 6. Kapsam dışı

- **§302 Abrechnung (DTA → DAS) gönderimi** — ayrı sertifika süreci, bu işe girmez.
- Mail alma/okuma (IMAP), gelen kutusu — yok.
- Google OAuth doğrulaması (yalnız SaaS, satılan ürün kutu).

## 7. Bitti sayılır

- [ ] `grep -rn "process.env.SMTP_" api-backend --include=*.js` yalnız `lib/mail.js` döndürür
- [ ] Kurulum sihirbazında mail adımı yok; kurulum mailsiz biter
- [ ] Mail kurulmamış praxiste her ekran çalışır, gönderim yerine yönlendirme çıkar
- [ ] Kutuda UI'dan kurulan SMTP (en az IONOS + Gmail App-Passwort) ile: Testmail, Terminerinnerung,
      Rechnung, Dokument-Mail, **update-alarm maili** ve **şeffaflık sayfası** doğru
- [ ] Microsoft device code ile bağlanıp Testmail (ya da v1'de yoksa SMTP notu)
- [ ] Yanlış şifre / T-Online / GMX senaryolarında sağlayıcıya özel ipucu görünür
- [ ] Şifre/token hiçbir API cevabında ve DSGVO Auskunft dosyasında yok
- [ ] SaaS'ta mevcut Gmail bağlantısı ve booking mailleri değişmeden çalışır
- [ ] `npm test` yeşil (`klassifikation.test.js` dahil), harita tazelendi, `fonksiyon-ustasi`'ye
      „niye + nerede" bildirildi, `onprem`'e O-243 kapanışı bildirildi

## 8. Ayrı bulgu (bu işin dışında, guvenlik'e gidiyor)

`calendar_integrations` tablosunda tokenlar düz metin ve `FOR ALL TO PUBLIC USING (auth.uid() =
user_id)` policy'si istemciye token döndürüyor. **Bu tabloyu örnek alma.**
