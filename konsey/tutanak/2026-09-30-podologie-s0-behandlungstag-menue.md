# Konsey Kararı — Podologie Reform S0: Behandlungstag, Termin-Aktionen, Wagner, Vorbelegung, Menü
Tarih: 2026-09-30 · Oturan üyeler: podoloji, gkv-302, muhalif, deger-mi, fonksiyon-ustasi

ON-PREM ETKİSİ: hayır (ön yüz düzeni; tek şema adımı 2a — yalnız kolon, `db-ustasi` + oturum B).

## KARAR

**(1) Behandlungstag = B+ (yeni ekran YOK).** Tagesbehandlung (`module/podologie-abrechnung.js`)
seansın tek kayıt ekranı olarak kalır; `podologie_behandlungen`'e ikinci bir yazma yolu açılmaz.
Üç ekleme: (a) Tagesbehandlung'un içinde **açılır-kapanır Fußbefund bölümü** — varsayılan kapalı,
başlıkta son Befund tarihi + „Befund unverändert / aktualisieren"; açılınca mevcut `mountFussbefund`
(`module/fussbefund.js`) gömülür, `pat_fussbefund`'a kendi kayıt yolundan yazar. (b) Kaydetmeden
sonra küçük **„Folgetermin?" diyaloğu** (Tarih önerisi Verordnung frekansından; „Später" ile geçilir)
— kayıt değil, yalnız mevcut randevu maskesini önceden doldurarak açar. (c) S1.6 ve 30.09 blokları
aynen bu tek yolda kalır. **Termin-Aktionen (`#bkActionModal`, bugün 17 düğme):** görünür en fazla
6 — durum düğmesi (Fahrt starten / Angekommen / **Termin starten** / Fahrt beenden, biri görünür,
birincil) · Verordnung · Patientenakte · Folgetermin · Verschieben (= Bearbeiten) · Nicht erschienen.
Geri kalanı „…" menüsüne: Absagen/Löschen (etiketleri ayrılır), Terminzettel, Adresse kopieren,
Fußbefund (artık Tagesbehandlung içinde de). Ausfallrechnung / „Doch behandelt" koşullu kalır
(yalnız no-show sonrası, o durumda Nicht erschienen'in yerini alır). Verordnung kartının iç
düğmeleri (Serie verteilen, Leistungen …) karta aittir, sayıma girmez.

**(2a) Wagner — geri gelir, tek girişli.** Giriş yeri **Fußbefund**; `pat_fussbefund`'a `wagner_grad`
(smallint 0–5, NULL) kolonu — şema işi: `db-ustasi` + oturum B (migration dosyası → döküm → canlı).
Gösterim: **salt-okunur rozet** hasta başlığında ve Tagesbehandlung başlığında, son Befund tarihiyle;
yalnız DG=DF ya da E10/E11 tanılı hastada. Rozet son Fußbefund'dan okur; yoksa geçiş dönemi için
`prescriptions.wagner_grad`'a düşer (yeni yazım oraya yapılmaz). Maskeye geri konmaz.

**(2b) Vorbelegung — resmî okuma kabul, iki yüzey iki kural bilinçli.** *Planlama* (Termin/Serie
maskesi, `termin-leistungen.js`): verordnete pozisyon önseçili, 78030/78040 önerili-**işaretsiz**.
*Fiilî gün* (Tagesbehandlung): kural motoru işaretleyebilir (78030 her Behandlung ile, 78040 ilk
başvuruda, 79933 Hausbesuch'ta) çünkü S1.6/30.09 blokları aynı kayıtta. Ekler: öneri/işaret yanında
sebep metni („erste Behandlung dieser VO" vb.); Tagesbehandlung'da „Verordnet: 78xxx" satırı
görünür (OCR hatası fark edilsin). **c) Komplexbehandlung:** 78020 Therapiezeit > 20 dk'ya bağlı —
c)'de Therapiezeit alanı zorunlu, pozisyon ondan türetilir (önce bugün kalıcı bir alan var mı
bakılır; yoksa şema → B).

**(2c) Fahrtenbuch hasta adı** — `e9d0286` ile kapandı (S-35, OFD Frankfurt 19.01.2011): zweck
„Patientenbesuch", ayrı Patientenverzeichnis. Kayda geçti, iş yok.

**(3) Menü = A, ucuz yoldan.** `NAV_GROUPS` (dashboard.js ~795) zaten 6 grup ve açılır render var;
`module_visibility` `module_id:role` anahtarlı, gruptan bağımsız → **modül id'lerine dokunulmaz.**
Yapılan: iki grup etiketi „Übersicht"→„Heute", „Team"→„Praxis"; podoloji girişlerinin (`nav-registry.js`
~88-119, 25 giriş) `group` alanları öneriye göre dağıtılır; podolojide gereksiz girişler
registry `roles`/varsayılan görünürlükle gizlenir (satır silinmez). „Heute" açılış ekranı olur mu:
**Beta-1'e bağlı** — o zamana kadar açılış ekranı değişmez.

## Gerekçe
Dört üyenin üçü (podoloji, muhalif, deger-mi) ikinci bir kayıt ekranını reddetti; gkv-302'nin şartı
(„tek yazma yolu, bloklar Abschließen'de de çalışmalı") B+ ile kendiliğinden sağlanıyor. Menüde
deger-mi ve muhalif B'yi A'nın maliyet ve id-kayması riski yüzünden istedi; fonksiyon-ustasi'nin
olgusu (gruplar ve görünürlük zaten ayrık) iki itirazı da düşürdü — bu yüzden çoğunluğa karşı A.
Wagner için „yeni alan açma" (deger-mi) ile „Fußbefund'da giriş" (podoloji, muhalif) çelişkisini
olgu çözdü: `pat_fussbefund`'da kolon yok, `prescriptions.wagner_grad`'ı hiçbir UI yazmıyor —
Wagner hastanın ayak durumudur, reçetenin değil; tek kolon eklemek en küçük doğru yol.

## Ödün verilenler
Tek „Behandlung dokumentieren" hissi tam gelmez (Fußbefund açılır bölüm, ayrı kayıt düğmesi).
Sağ panelde Löschen/Terminzettel bir tık derine iner. Wagner için küçük bir şema adımı B'ye kalır;
o gelene kadar rozet eski reçete değerini gösterir (çoğunlukla boş).

## Uzlaşma
Yeni kayıt ekranı yok · Folgetermin sorusu kaydetme sonrası · Wagner salt-okunur rozet, tek giriş ·
2b bugünkü davranış kurala uygun · 2c kapandı.

## Anlaşmazlık
Menü A (podoloji) ↔ B (deger-mi, muhalif) — olguyla A'ya kapandı. Sağ panel sayısı: podoloji 6,
muhalif 5 — 6 alındı (Folgetermin podologun en sık adımı).

## Kör noktalar
2b iki yüzeyde iki kuralla çalışıyordu ve kimse bunu karar olarak yazmamıştı (fonksiyon-ustasi) —
artık bilinçli ayrım. c) Therapiezeit'in kalıcı kaydı bilinmiyor (gkv-302 doğrulayamadı).
`"fußstatus"` tablosunda eski `wagner_grad` duruyor, kodda okuyan yok — temizlik adayı (db-ustasi).

## Uygulama — builder'a
- [ ] (3) `NAV_GROUPS` etiketleri + podo registry `group` dağılımı + gizleme; `?v=` zinciri — K1
- [ ] (1) Termin-Aktionen: ≤6 görünür + „…" menüsü; Absagen/Löschen etiket ayrımı; panel taşıma sonrası güncellenir — K2
- [ ] (1) Tagesbehandlung içinde açılır Fußbefund bölümü (`mountFussbefund` gömülür, kendi kaydı) — K2
- [ ] (1) Kaydetme sonrası „Folgetermin?" diyaloğu → randevu maskesi önceden dolu — K2
- [ ] (2b) sebep metni + „Verordnet: 78xxx" satırı — K1
- [ ] (2b) c) Therapiezeit: kalıcı alan var mı? varsa zorunlu + 78010/78020 türetme; yoksa B'ye şema — K2
- [ ] (2a) B: `pat_fussbefund.wagner_grad` migration (db-ustasi) → sonra A: Fußbefund girişi + rozet — K2
- [ ] Hepsi `dashboard.js` BÜYÜMEDEN, yeni kod `module/`'e; yalnız `de` metin; canli-test + podoloji testi (E11.74 DF, Wagner 1, 1. ve 2. seans)

## Beta-1'e bağlı
Befund her seansta mı güncellenir (açılır bölümün varsayılanı) · Hausbesuch'ta tablet mi telefon mu
(sağ panel sırası) · „Heute" açılış ekranı mı · Therapiezeit ekranda mı girilir.

## Backlog (karara dahil DEĞİL)
Takvimde sürükle-bırak · `"fußstatus"` tablosu temizliği · Physio başladığında menünün alan bazlı
yeniden düşünülmesi.

## Sert veto
Yok. gkv-302 KOŞULLU: tek yazma yolu + blokların korunması + c) Therapiezeit — karara işlendi.
