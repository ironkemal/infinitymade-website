# Konsey Kararı — Bulut (SaaS) kutunun yanında yeniden açılsın mı?
Tarih: 2026-10-28 · Oturan üyeler: legal-de, guvenlik, onprem, mentor, muhalif, deger-mi, fonksiyon-ustasi · dışarıdan göz (agy, gemini-4-argon-high) · araştırma: 4 agy worker (gemini-3.8-flash-high)

> ⚠️ **Durum: ÖNERİ.** Kemal karar vermedi ("birazcık daha araştıracağız"). K1 (04.10.2026) bu tutanakla değişmez; değişirse Kemal'in açık kararıyla.

## Çerçeve

```
SORU: Kutuya ek olarak bulut/SaaS satılsın mı, şartlar ve sıra?
SEÇENEKLER: A) yalnız kutu · B) hemen SaaS (tek Hetzner sunucusu, çok kiracılı, ISO paralel, bilinçli risk) · C) SaaS ancak ISO 27001 + eksik giderme planı ile
NEDEN ŞİMDİ: iki beta praxis "bana cloud yap yeter" deyip ayrıldı; K1'in gerekçesi (C5 ≈ 200 k€) C5GleichwV köprüsünü sorgulamamıştı
ON-PREM ETKİSİ: EVET — B/C'de hasta verisi bizde (G1/K6/K10/K12; Kemal bilinçli açıyor)
```

## Yeni olgular (bu turda birincil kaynaktan doğrulandı)

1. **§393 Abs. 4** (gesetze-im-internet.de, 28.10.2026): 30.06.2025 sonrası piyasaya çıkan sistem için ilk 18 ay **C5 Typ 1**, 19. aydan itibaren Typ 2. Eşdeğer standart yetkisinde **süre sınırı yok**.
2. **C5GleichwV §1**: ISO 27001 / IT-Grundschutz / CCM 4.0 + eksik giderme planı = geçici eşdeğer. Süreler **takvim tarihine değil planın oluşturulmasına** bağlı: eksikler ≤12 ay, C5 Typ 1 ≤18 ay, Typ 2 ≤24 ay. Bitiş tarihi yok. → legal-de'nin "KPMG tarihleri geçti" şüphesi **çürütüldü** (KPMG tarihleri §393'ün genel Typ1→Typ2 geçişine ait).
3. **Ama:** köprü **mevcut** bir sertifika ister ("bestehendes Zertifikat"). Sertifikasız yeni başlayan biri köprüye ISO gelmeden giremez (R1). ISO öncesi yasal yol yok.
4. **§393'ün kendi para cezası yok**; §397 SGB V onu saymıyor. 07/2024'ten bu yana bilinen bir uygulama, ceza ya da §3a UWG ihtarı **bulunamadı** (R1). Asıl risk dolaylı: DSGVO Art. 58 işleme yasağı, Art. 82 tazminat, §203 StGB.
5. **Pazar (R2, Gemini — tek tek doğrulanmadı):** MD Therapie, Optica Viva, THEORG-Cloud, Medondo, buchnerFLOW bulut satıyor, **kendi C5 testatını yayımlamıyor**. Yalnız veri merkezinin ISO/C5'ine dayanıyor. Kendi C5'i olanlar büyükler: Doctolib, CGM XDENT, samedi; küçük örnek: arztkonsultation (Typ 1).

6. **Dört rakip yakından (28.10.2026, rakiplerin kendi sayfaları + sunucu adresleri):** Hiçbiri §393'ten tam kurtulmuyor; hiçbiri **belgesiz** satmıyor — her birinin arkasında kendi ya da ana şirketinin ISO 27001'i var.

   | Rakip | Model | Belge |
   |---|---|---|
   | THEORG (SOVDWAER) | Praxis başına ayrı kurulum, kendi veri merkezleri, uzaktan bağlantı | Kendi ISO 27001'i (Nisan 2027'ye kadar); C5'ten bahis yok |
   | Thevea (opta data, ~2.500 kişi) | Klasik çok kiracılı bulut | ISO ana şirketin veri merkezine ait; kendi C5'i yok. Veritabanı opta data Essen'de, AWS'de yalnız Rezept görüntüleri |
   | Optica Viva (Dr. Güldener, ~1.400 kişi) | Tarayıcıda uçtan uca şifreleme, anahtar yalnız praxis'te; §302 dosyası ayrı Windows programıyla; SMS/mail için iletişim verisi şifresiz | ISO iddiası doğrulanamadı; uygulama Arvato'da (C5'li bulut hizmeti), yalnız web/mail Hetzner'de |
   | DMRZ | Kendi bulutu | Kendi C5'i |

   **Düzeltme:** R2'deki "Optica Hetzner'de" ve "Thevea AWS'de" iddiaları yanlış (yukarıdaki satırlar). **Sonuç:** "C5'siz" mümkün, "ISO'suz" değil. Bizim "barındırılan kutu" modelimiz THEORG modelinin aynısı.
   **Optica tipi şifreleme:** §393'ten muaf tutmaz (kanunda istisna yok; EDPB 01/2025 ve EuGH C-413/23 P şifreli veriyi kişisel veri sayıyor), ama sızıntı ve §203 riskini büyük ölçüde düşürür. Bizde bedeli: `dashboard.js`'te ~310 doğrudan DB erişimi + §302/PDF/istatistik/randevu sunucu tarafında açık veriyle çalışıyor → aylarca yeniden yazım; anahtar kaybı = 10 yıllık saklama yükümlü verinin kaybı. Tam "biz göremeyiz" modeli backlog'a.
   ⚠️ **Düzeltme (fonksiyon-ustasi, 28.10.2026):** "praxis başına ayrı anahtar zaten var" doğru DEĞİL. `DATA_ENCRYPTION_KEY` kutu başına üretiliyor (`onprem/install.sh:686`), ama `encryptPHI`/`decryptPHI` (`api-backend/lib/phi-encrypt.js:77/96`) üretimde hiç çağrılmıyor. Alan şifrelemesi 30.09.2026'da bilinçli bırakıldı (Reform 3.12, `server.js:249-252`); koruma RLS + disk şifrelemesi. Barındırılan modelde praxis'leri fiilen ayıran: ayrı Postgres, ayrı `JWT_SECRET`, ayrı yedek anahtarı (`AGE_SECRET_KEY`). "Ayrı anahtar" iddiası pazarlamada/AVV'de kullanılmaz; `guvenlik` S-34 ile birlikte değerlendirir.

## KARAR (öneri)

**Bulut kapısı açılır, ama B açılmaz.** "Sertifikasız, tek ortak veritabanıyla hemen satış" yapılmaz. `guvenlik` iki veto konusunda ⛔ verdi (hasta verisini yeni bir yere taşımak + bugünkü kodla odalar arası sınır). Yol:

**(1) Şimdi, para harcamadan:** Talep testi. İki eski beta praxis + 5 yeni praxis aranır. Ölçü sözlü istek değil, **yazılı ve ücretli pilot niyet beyanı**dır. Aynı anda başlayacak işler:
- ISO 27001 hazırlığı; danışman yok, işi biz yaparız;
- UG kuruluşu;
- sigorta teklifi;
- 2–3 ISO sertifika kuruluşundan ve 2 C5 denetçisinden (örneğin FIDES, ADVANTA) teklif.

**(2) Pilot, ISO öncesi, 1–3 praxis:** Model **"barındırılan kutu"**:
- tek Hetzner Cloud sunucusu (Almanya);
- **her praxis için ayrı konteyner yığını, ayrı veritabanı, ayrı anahtar**; ortak RLS havuzu yok.

Bu, Kemal'in "tek sunucu, ayrı odalar" fikrinin `guvenlik`'in şartına uyan hâli. Mevcut kutu imajını yeniden kullanır ve aynı kod tabanında kalır.

Gerçek hasta verisiyle pilot yalnız şu şartlarla:
- `guvenlik`'in pilot öncesi listesindeki maddeler kapanmış olmalı;
- UG kurulmuş, sigorta yapılmış olmalı;
- AVV + §203 taahhüdü imzalanmış olmalı;
- praxis'e yazılı risk bilgisi verilmiş olmalı ("ISO hazırlanıyor, C5 yok").

Bu, Kemal'in bilinçli olarak üstlendiği riskin kendisidir ve kararı Kemal verir.

**(3) ISO sertifikası + eksik giderme planı:** Gerçekçi süre 6–9 ay (`muhalif`; 4 ay iyimser). Resmî satış o gün başlar. Pazarlamada yalnız doğru olan yazılır.

**(4) 18. ay C5 Typ 1, 24. ay Typ 2.** Para gelirden ödenir.

**Kutu ürün olarak kalır.** Tek kod tabanı, açık bir dağıtım modu bayrağı olur. Bugün böyle bir bayrak yok; `istKutu()` örtük bir sinyale dayanıyor.

## Gerekçe

- **Belirleyici olgu:** Kanun metni köprünün geçerli olduğunu ve süre sınırı olmadığını gösteriyor. Ama köprünün giriş bileti ISO sertifikası. ISO öncesi dönem hukuken "yasal" değil, yalnız "fiilen düşük riskli". Ceza maddesi yok, bilinen bir uygulama yok, pazar da aynı şekilde çalışıyor.
- **İkinci belirleyici:** `guvenlik`'in odalar arası sınır ölçümü. S-39 gibi sınır hataları 4 hafta öncesine kadar sık bulunuyordu. Çok kiracılı tek veritabanında tek bir hata bütün praxis'leri açığa çıkarır. Her praxis'e ayrı yığın, bu en büyük riski geliştirme yapmadan kapatıyor.
- **Üçüncü:** `mentor`, `muhalif`, `deger-mi` ve dış göz aynı noktada birleşti. İki ücretsiz praxis'in sözlü isteği kanıt değil. Önce yazılı ve ücretli niyet beyanı gelmeli.

## Ödün verilenler

- Hemen satış yok. İlk aylar en fazla 1–3 pilot praxis olur.
- Praxis başına maliyet çok kiracılı modelden yüksek. Ayrı yığınların her biri yaklaşık 1–2 GB bellek ister. Dedicated işlemcili Hetzner sunucusu aylık 43,49 €'dan başlıyor; 8 çekirdek / 32 GB sınıfı ikincil kaynağa göre aylık yaklaşık 165 € (R4). Dedicated root sunucu C5 kapsamındaysa maliyet düşer; **bu doğrulanmadı.**
- ISO işi her yıl süren bir iş yükü: belge, kayıt, ara denetim.
- Kutunun bitirilmesi ve podoloji ince ayarı yavaşlar (`deger-mi`).
- İki dağıtım biçimi = iki destek yüzeyi (O-165).

## Uzlaşma

- B yapılmaz: `guvenlik` ⛔; `legal-de`, `mentor`, `muhalif` ve `onprem` de karşı.
- Önce talep testi.
- Kutu kalır, kod tabanı çatallanmaz.
- Supabase'in İrlanda'daki bulutu hasta verisi için bırakılır, yalnız Almanya'daki Hetzner kullanılır.
- Pazarlamada C5, "sicher" ya da "DSGVO-konform" iddiası yok.
- Şahıs şirketiyle (Einzelunternehmen) bulut olmaz; UG şart.
- Kendi yapay zekamız için ekran kartlı sunucu yok. `gpt-4o-mini` sayfa başı yaklaşık 0,05 cent (R4, ikincil kaynak); ekran kartlı sunucu ancak çok yüksek hacimde kendini öder.

## Anlaşmazlık

- **ISO öncesi gerçek veriyle pilot:** `legal-de` "C-light" diyor (2–3 praxis, yazılı risk üstlenme, UG, sigorta). `guvenlik` "önce test verisiyle, liste kapanınca" diyor. Chairman, `guvenlik`'in listesini ön şart yaptı; gerçek veriye geçiş kararını Kemal'e bıraktı.
- **Barındırma yeri:** Dış göz C5'li başka bir altyapı öneriyor (Open Telekom Cloud, STACKIT, plusserver; 8 çekirdek / 32 GB aylık yaklaşık 280–330 €, R4). Hetzner'in C5 Typ 2'si zaten var (25.03.2026). Fiyat farkı ~2× olduğu için Hetzner'de kalındı.

## Kör noktalar

- **Köprünün ön şartı:** Bu sohbette de "ISO'ya başlayınca köprü açılır" diye anlatılmıştı. Köprü ancak sertifika **eline geçince** açılıyor (R1 + yönetmelik metni "bestehendes").
- **UG ceza hukukunu kapatmaz.** §203 StGB kişiye bağlı bir suç (`guvenlik`, dış göz). UG yalnız tazminat/medeni hukuk riskini sınırlar.
- **Sigorta, kanuni yükümlülük ihlalinde ödemeyi kısabilir.** DSGVO para cezası hiç sigortalanamaz (R3). "Bilinçli risk" sigortacıya açıkça söylenmeli.
- **Ayrılma sebebi:** Betaların asıl şikâyeti kurulum ve bakım zorluğuysa, bulut aslında bir "kurulum sorunu"nu çözüyor (`mentor`). Bu yüzden talep testinde **sebep** sorulur.
- **Vercel'e bağlı parçalar:** SaaS'ın bazı parçaları Vercel ve Supabase buluta bağlı:
  - `api/stripe/*`, `api/onboarding/*`, `api/admin/*`;
  - Fahrtenbuch Edge Functions (Deno);
  - pg_net Telegram tetikleyicisi;
  - Vault.

  Barındırılan modelde bunlar `api-backend`'e taşınmalı (`fonksiyon-ustasi`, `onprem`). G8 yeni buluta bağımlılık eklemeyi yasakladığı için kapı zaten bu yönde.

## Pilot öncesi kapanması gerekenler (`guvenlik`)

1. S-08: sızan anahtarların iptali **kanıtlanmalı**.
2. S-04: her migration'dan sonra yetki tablosu otomatik kontrol edilmeli.
3. S-30: `service_role` kullanan her yolda `owner_id` doğrulanmalı. Barındırılan kutuda hafifler, ama merkez ve faturalama için yine geçerli.
4. S-34: hasta verisi şifrelemesinin şifrelenmemiş ikizi var, `leads.*_enc` hiç yazılmıyor.
5. S-22: şifreleme anahtarının (`DATA_ENCRYPTION_KEY`) yedeklenmesi ve yenilenmesi tasarlanmalı.
6. S-10/S-32: Art. 17 silme taleplerinde dosya deposu da silinmeli.
7. S-06/S-09: rate limit ve sızmış parola koruması.
8. S-31: §302 ara durumu dosya deposunda şifresiz duruyor.
9. S-42/S-17/S-21: denetim kaydı (audit log) ve rol başına ayrı veritabanı parolası.
10. Gerçek yığında bağımsız bir sızma testi: A praxis'i B praxis'ine erişebiliyor mu.

## Uygulama — builder'a (yalnız Kemal "evet" derse)

- [ ] Talep testi: soru listesi + niyet beyanı taslağı (kod yok) — K0
- [ ] ISO/C5 teklif mailleri (2–3 sertifika kuruluşu + 2 Wirtschaftsprüfer) — K0
- [ ] Açık dağıtım modu bayrağı (`kutu` / `barindirilan`); `istKutu()` örtük olmaktan çıkar — K2
- [ ] Barındırılan kutu: aynı sunucuda praxis başına ayrı yığın; kurulum betiği yeniden kullanılır, anahtarlar praxis başına üretilir — K3
- [ ] Vercel/Edge parçalarının `api-backend`'e taşınması (yalnız barındırılan modde gerekenler) — K3
- [ ] `guvenlik` pilot listesi 1–10 — K4
- [ ] ISMS belge seti (risk analizi, politikalar, olay planı, tedarikçi kontrolü) — K2, sürekli

## Backlog (karara dahil DEĞİL)

- Hetzner'e yazılı soru: Dedicated root sunucular ve ekran kartlı sunucular C5 Typ 2 kapsamında mı? R4 "evet" diyor ama doğrulanamadı. Kapsamdaysa praxis başına maliyet düşer.
- K-19 (`app.praxura.de` kapanışı) "kapat" yerine "taşı" olarak yeniden yazılır. Ancak Kemal "evet" derse.
- Pilotlar barındırılan kutuya geçince Supabase'in İrlanda'daki bulutu tamamen kapanır.
- Optica tipi istemci tarafı şifreleme ("biz göremeyiz"): gelir gelince yeniden değerlendirilir; önce anahtar kurtarma tasarımı (10 yıllık saklama yükümlülüğü).

## Sert veto

- `guvenlik` ⛔ **B** (hasta verisini yeni yere taşımak + odalar arası sınır). Etrafından dolaşma yolu: praxis başına ayrı yığın + pilot öncesi liste. ISO köprüsü de ancak sertifikayla açılır.
- `legal-de` ⛔ vermedi (🔧 KOŞULLU).
- `onprem` ⛔ vermedi. Kutu tarafında G2/G3/G8/K10 aynen geçerli.

## Ek: barındırılan kutu — teknik durum (onprem + fonksiyon-ustasi, 28.10.2026)

- **Bugün aynı sunucuda ikinci kutu kurulamaz.** `install.sh` 80/443'ü dolu bulup durur (güvenli). Port kontrolü atlatılırsa ikinci praxis birincinin kimliğini devralır (sabit compose adı `name: praxura` + paylaşılan `kimlik`/`acmedns`/`caddy_data` volume'leri) → **O-223**.
- **Gereken:** tek `PRAXURA_INSTANZ` değeri (compose adı, konteyner adları, systemd şablon birimleri, kurulum klasörü, yedek/geri yükleme) + SNI ile yönlendiren ön vekil ≈ **3–5 gün**; açık mod bayrağı `PRAXURA_DAGITIM=kutu|barindirilan` (`dagitim.js`'e `dagitimModu()`, `istKutu()` korunur) ≈ **1–2 gün**. Hazır olanlar: veri klasör bazlı ayrı, merkezin `internet` modu (praxis başına `ad.box.praxura.de`), barkod/yazıcı tarayıcıda, migration defteri DB başına, `AI_MODE`.
- **Sıfırdan:** yığınlar arası admin/feedback toplama, ORS aracısı (O-11), ödeme durumu (pilotta elle fatura + `iptal` yeter).
- **Kaynak:** boşta yığın başına ~0,9–1,0 GB (türetilmiş, **ölçülmedi**); CPU/disk ölçülmedi. Tavsiye: bir CCX'te 3 yığın, `docker stats` + `df`, yarım gün.
- **Ürün gerçekleri:** praxis'in interneti kesilirse yazılım durur (AGB/satış metnine); TI-Konnektör ileride köprü ister (büyük iş, sonra).
- **Kilitli kararlarla çatışma:** K1, K10 ("veriye erişim yok"), K12 ("bizim Hetzner hesabımızda hasta verisi yok") ve G1. Sunucunun root'u biz olduğumuz için K10 yalnız organizasyonel önlemle tutulur. **Bunlar Kemal açıkça değiştirmeden gerçek hasta verisiyle barındırılan kutu yok.** Test verisiyle çoklu yığın hazırlığı: geçer (çatal yok, G2/G3/G8 temiz).
- **Şifreleme:** `DATA_ENCRYPTION_KEY` yığın başına üretiliyor ama hasta alanlarını şifrelemiyor (bkz. olgu 6 düzeltmesi).

## Kaynaklar (birincil)

- §393 SGB V: https://www.gesetze-im-internet.de/sgb_5/__393.html
- §384 SGB V: https://www.gesetze-im-internet.de/sgb_5/__384.html
- C5GleichwV §1: https://www.gesetze-im-internet.de/c5gleichwv/__1.html
- Hetzner C5 Typ 2 duyurusu (25.03.2026): https://www.hetzner.com/de/news/hetzner-receives-bsi-c5-certification/
- Hetzner Cloud fiyatları (28.10.2026 bakıldı): https://www.hetzner.com/cloud/

Araştırma çıktılarının tamamı (Gemini, ikincil kaynaklar işaretli): `C:\tmp\agy-tasks\cloud\out-r1…r4.json` — depo dışında.
