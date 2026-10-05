# Konsey Kararı — Merkezi „Praxura servisi" (Online-Anfrage Y3 · KI tek hesap · otomatik km)
Tarih: 2026-10-05 · Oturan üyeler: onprem, guvenlik, legal-de, podoloji, muhalif, deger-mi, fonksiyon-ustasi
Tetikleyen: Kemal 05.10 — Y2 (mail ile talep) reddedildi; ön eleme + otomatik akış istendi; KI'yı tek merkezi Azure hesabıyla (maskeli) sürdürme isteği; Hausbesuch km otomatik. Bağlam: `KUTU_HAZIRLIK_SPRINT.md` §3b, `compliance/LEGAL_DECISIONS.md` 2026-10-05.

## KARAR
**Tek bir "üç işli merkez servisi + tek AVV" KURULMAZ.** Üç ihtiyacın veri profili farklı; ayrı ayrı karara bağlandı:

1. **Online-Anfrage (Y3) — EVET, daraltılmış v1.** Hasta internette praksisin boş saatlerini görür, formu doldurur; form **tarayıcıda praksis kutusunun açık anahtarıyla şifrelenir**, merkezde yalnız şifreli paket durur, kutu dışarı bağlanıp çeker, mevcut `booking_requests` zincirine (approve/decline/offer, `anfrage-bearbeiten.js`) düşer, tek tık onay. **v1 fotoğrafsız**: ön eleme form alanlarıyla (Anliegen kartı, Rezept ja/nein, sigorta türü, Ausstellungsdatum, Heilmittel ifadesi, yeni: „Diabetiker ja/nein/weiß nicht"; Wunden-Hinweis mevcut S4 kararıyla). Fotoğraf v2 — tetikleyici: bir beta „form yetmiyor" der. **Zamanlama:** K3'ü geciktirmez; K3'ten sonra, **betaların kutuya geçişinin ve `app.praxura.de` kapanışının ön şartı** (betalar bugün SaaS'ta online randevu kullanıyor — gerileme olmasın). **Kemal'in açık G1 istisna kararı gerekir** (onprem), kayda geçer. Merkez ayrı küçük VPS'te, K2b ad servisiyle aynı `merkez/` altında, **ayrı süreç + ayrı sır**; n8n VPS'inde değil, n8n workflow'u değil. Kendi Hetzner'indeki kutu sayfayı aynı kodla, bayrakla kendisi sunar (rolümüz yok).
2. **KI merkezi relay (bizim Azure anahtarımız) — HAYIR.** `legal-de` ⛔ sert veto: maskeli metni biz açık okuruz → Art. 9 AV + relay §393 Abs. 3 Nr. 2 „Cloud-System" → C5 yok, satış/Behörde riski; Modified Abuse Monitoring reddi §203 zincirini zayıflatıyor. `guvenlik` şartlı veto (serbest metin %13 sızıyor = merkez yeni PHI durağı), `onprem` K6 + 09-28 kararı. **Açık yol:** kutu sağlayıcıya **doğrudan**, praksis başına ayrı anahtar/proje (K4 / B′ deseni), M4 maskelemesi ek koruma olarak kalır. Yeniden açılma koşulu: avukat „stateless relay §393 anlamında Cloud-System değildir" der **ve** relay'e yalnız yapısal (A sınıfı) alanlar gider.
3. **Otomatik km — merkez relay YOK.** Kutu openrouteservice'e **doğrudan**, praksisin **kendi ücretsiz anahtarıyla** (Ayarlar'da opsiyonel alan; O-11 (a)); anahtar yoksa „Route öffnen" + km elle (K2b.15). Bizim rolümüz yok. ⚠️ ORS ticari kullanım şartları doğrulanacak. Zamanlama: sprint dışı, launch sonrası (Update kartı); „Route öffnen" sprintte.

**Hasta bilgilendirme (Y3):** varsayılan **telefon** (yaşlı hasta status sayfasına bakmaz — podoloji); şifreli „Anfrage-Status" sayfası ek; otomatik onay maili praksisin kendi posta kutusu (Ops #335) gelince. Kutu günlerce kapalıysa: paket TTL ≤14 gün, hasta formda „Die Praxis meldet sich telefonisch" bilgisini görür.

## Gerekçe
`legal-de`'nin (2) üzerindeki sert vetosu ve `guvenlik`'in PHI-taşıma vetosu merkezi KI relay'i kapatıyor; maskeleme olasılığı düşürür ama rolü değiştirmez. (1) ise içerik okunamadığı için dar Portal-AVV ile taşınabiliyor — dört veto sahibinden hiçbiri (1)'i vetolamadı. Üçünü tek AVV'de toplamak en zayıf halkayı (düz metin işleyen relay'ler) bütün servisin seviyesi yapardı (`muhalif`). Zamanlamada `deger-mi`'nin gözlemi belirleyici: K3 bu üç işe bağlı değil; gerçek tetikleyici SaaS'ın kapanışı.

## Ödün verilenler
- Kutuda KI, praksis kendi anahtarını alana kadar yok (tek hesap kolaylığı yok).
- Otomatik km için praksis bir kez ORS'ta hesap açmak zorunda; açmazsa km elle.
- Online-Anfrage launch'ta (K3'te) yok; betaların geçişinden önce gelir. v1 fotoğrafsız.
- „Hasta verisine dokunmuyoruz" cümlesi Online-Anfrage için „içeriği okuyamıyoruz, yalnız teknik metadata (Portal-AVV)" olarak daralır.

## Uzlaşma
- (1) yapılabilir ve değerli; mevcut `booking_requests` zinciri yeniden kullanılır (fonksiyon-ustasi: list/approve/decline/offer, `createBookingsFromRequest`, `anfrage-bearbeiten.js` aynen; yeni: merkezden çek→çöz→insert, auto-approve dalı + public guard'lar çekme adımına).
- Merkez n8n VPS'inde koşmaz (O-159 disk dersi), ayrı küçük VPS.
- Kendi Hetzner'indeki kutu sayfayı kendisi sunar, aynı kod + bayrak (fork yok, G7).
- (2) relay şimdi yok.

## Anlaşmazlık
- **(1) zamanlaması:** onprem/legal-de/muhalif „sprintte olabilir"; deger-mi „K3'ten sonra, beta geçişinden önce"; podoloji „launch'ta olmasa da olur". Chairman deger-mi'yi seçti (K3'ü kaydırmamak) — ama beta geçişine bağladı, sonsuza ertelemedi.
- **(3) yolu:** legal-de stateless relay'e de şartlı açık; onprem/guvenlik relay'e karşı; muhalif PLZ-merkezi kuş uçuşu tahmini öneriyor. Chairman: praksisin kendi anahtarıyla doğrudan (herkesin kabul ettiği tek yol); PLZ tahmini backlog.
- Kör nokta turu çalıştırılmadı: çelişkiler zamanlama/yol tercihindeydi, veto çakışması yoktu; vetolar (legal-de, guvenlik) aynı yönü gösterdi.

## Kör noktalar
- `guvenlik`: E2E'nin asıl zayıflığı **aktif** merkez ele geçirme — JS'i biz sunuyoruz, sahte anahtar konabilir; SRI çözmez (HTML de bizden). Önlem: kutu dakikalarda bir yayındaki sayfa+JS'i çekip kendi sürüm hash'i ve kendi açık anahtarıyla karşılaştırır, farkta alarm + formu kapatır.
- `muhalif`: kutu günlerce kapalıyken talep sessizce bekler — TTL + hastaya bilgi ilk sürümde.
- `fonksiyon-ustasi`: tarayıcıda hazır şifreleme sarmalayıcısı yok (forge yalnız PKCS#12 okuyor, §302 EnvelopedData backend'de) — WebCrypto ile yeni küçük modül.
- `podoloji`: diyabetik + yara olan hasta online sıraya hiç girmemeli (mevcut Wunden-Hinweis); ön eleme alanları zaten S4/30.09 kararlarında tasarlı.

## Uygulama — builder'a
- [ ] Kemal: Y3 için **G1 istisna kararı** (onprem O-166) — K0
- [ ] `merkez/` VPS + postakutusu servisi (ayrı süreç/sır, env'den URL, bayrak varsayılan kapalı, IP ≤7 gün kodda, TTL ≤14 gün kodda, teslimde silme, PoW (ALTCHA tipi, kendi sunucumuz) + IP/kutu kotası + boyut sınırı, rastgele postakutusu ID, kutu başına ed25519 imzalı çekme) — K3
- [ ] Hasta sayfası (`termin.praxura.de/<rastgele>`): boş saatler (`getAvailableSlots` kutudan yayınlanır, isimsiz), form (v1 alanları), WebCrypto şifreleme modülü, Datenschutzhinweis + Einwilligung (legal-de metni) — K3
- [ ] Kutu: çekici (imzalı) → çöz → `booking_requests` insert; create'in auto-approve/public-guard mantığı buraya; yayındaki sayfa/JS bütünlük kontrolü + alarm — K3
- [ ] Hetzner varyantı: aynı sayfa kutudan, bayrakla — K2
- [ ] Portal-AVV (çerçeve + Anlage „Online-Anfrage", §203 Abs. 3/4 maddesi, alt AV yalnız Hetzner) — legal-de — K1
- [ ] Avukat brifingi: metadata §393 · eVO token Makelverbot · Portal-AVV yeterli mi · stateless relay = Cloud-System mi — K1
- [ ] Merkez düşerse: kutu „bitte Praxis anrufen"a düşer (O-155 bayrağı) — K3'ten önce yazılı — K1
- [ ] Ops: „Hausbesuch-km mit eigenem ORS-Schlüssel" Update kartı (ORS ticari şartları doğrula) — K0

## Backlog (karara dahil DEĞİL)
- Reçete fotoğrafı v2 (EXIF strip, ayrı onay, boyut/virüs) — tetikleyici beta geri bildirimi
- PLZ-merkezi kuş uçuşu km önerisi (muhalif, `tools/plz-orte.mjs`)
- Telefon için „Anfrage-Notiz" maskesi — aynı alanlar, 4–5 tap (podoloji)
- Ret gerekçe hazır metinleri (2 tap) — podoloji
- gkv-302'ye: ön elemede reçete tarihi kaç günden eski olunca uyarı

## Sert veto
- `legal-de` ⛔ (2) merkezi KI relay + bizim anahtar. Etrafından yol: praksis başına anahtar, kutudan doğrudan (K4/B′), maskeleme ek koruma.
- `guvenlik` şartlı ⛔ (2) ve (3) relay (PHI yeni yere). Etrafından yol: (2) yukarıdaki gibi; (3) praksisin kendi ORS anahtarıyla doğrudan.
- `onprem`: (1) için veto değil ama **G1 istisnası Kemal'in açık kararı** olmadan uygulanmaz.
