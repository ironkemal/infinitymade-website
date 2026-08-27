# Konsey Kararı — Podoloji: Privat/Selbstzahler akışının GKV alanlarından ayrılması
Tarih: 2026-08-10 · Oturan üyeler: `gkv-302`, `legal-de`, `podoloji`, `muhalif`, `deger-mi`
Tetikleyen: Beta müşteri Beta-1 (Podologe), 08.08.2026 toplantısı §1.6

## KARAR

Podoloji Verordnung formu **`rezeptart` odaklı** hale getirilir, ama alanlar **silinmez —
katlanır**. `rezeptart = kassen` dışındaki her değerde (`privat`, `selbstzahler`, `bg`) sadece
**Abrechnungs alanları** — Krankenkasse, Diagnosegruppe, ICD-10, Zuzahlung-Befreiung —
varsayılan **kapalı** bir `GKV-Angaben` bölümüne girer ve Diagnosegruppe zorunluluğu kalkar
(boş bırakılırsa **NULL** yazılır, boş string değil — FK var). **Wagner ve Fußbefund klinik
dokümantasyondur, hasta tipinden bağımsız her zaman görünür kalır.** Yerine opsiyonel serbest
metin `behandlungsanlass` alanı gelir, varsayılan değeri `Podologische Komplexbehandlung`.
Frontend gizlemesi tek başına yeterli sayılmaz: `abrechnung.routes.js`'e açık
`rezeptart NOT IN ('privat','selbstzahler','bg')` guard'ı ve DB'ye
`CHECK (rezeptart <> 'kassen' OR diagnosegruppe IS NOT NULL)` eklenir. **PKV ile Selbstzahler
tek akış değildir** ama ayrım Verordnung formunda değil, **fatura katmanında** yaşar
(bkz. Faz 3). `leads.insurance_type` ile `verordnungen.rezeptart` **senkron edilmez** — tek
yönlü ön seçim + satır içi uyarı. Rechnung köprüsü **bu karara dahil değildir**, ayrı iş
olarak ertelenir.

## Gerekçe

Belirleyici olan `podoloji`nin düzeltmesiydi: ilk çerçeveleme "GKV alanları" kümesine Wagner'i
de sokuyordu, oysa Wagner klinik kayıttır ve PKV hastasında da tutulur — `muhalif` bu hatayı
kör nokta turunda kabul etti. `legal-de` başlangıçta zorunlu bir `medizinische Indikation`
alanı istedi, `podoloji`nin "Selbstzahler çoğunlukla kozmetik Fußpflege" tespitiyle bunu geri
çekti: zorunlu alan podoloğu §4 Nr. 14a muafiyetini haksız işaretlemeye iter, yani riski
azaltmak yerine üretir. `gkv-302`'nin sunucu guard şartı koda karşı doğrulandı ve **haklı
çıktı** — `abrechnung.routes.js`'te `rezeptart` hiç geçmiyor, bugünkü koruma sadece
`kostentraeger_ik` eşitliğinden gelen tesadüf ([:1818](../../api-backend/billing/api/abrechnung.routes.js#L1818)).
`deger-mi`nin küçültmesi kapsamı belirledi, `muhalif`in geri-çevrilebilirlik itirazı
"gizle" yerine "katla"yı seçtirdi.

## Ödün verilenler

- **Müşteri talebi tam karşılanmıyor.** Beta-1 "hiç görünmesin" dedi; biz "varsayılan kapalı,
  1 tıkla açılır" veriyoruz. Bitti-sayılır ölçütü ("formda ICD/DG alanı hiç görünmüyor")
  harfiyen değil, ruhen karşılanıyor — bu bilinçli.
- **§1.6 bu turda kapanmıyor.** "Doğrudan Rechnung üretimine git" maddesi Faz 3'e kalıyor;
  podolog fatura için hâlâ `invoices` panelinde hastayı elle seçecek.
- **BG şimdilik yarım kova.** GKV alanları gizleniyor ama DGUV'nin istediği Unfalltag/Az.
  alanları yok — BG rezepti olan podolog eksik kayıt tutar.
- `insurance_type`'a `selbstzahler` değeri Faz 2'ye kalıyor; o gelene kadar Selbstzahler hasta
  kayıtta `privat` görünür.

## Uzlaşma

- PKV/Selbstzahler'da Diagnosegruppe/ICD'nin §302 tarafında **hiçbir karşılığı yok**
  (HeilM-RL yalnızca "zulasten der GKV" için bağlayıcı) — `gkv-302`, itirazsız
- Diagnosegruppe zorunluluğu `rezeptart = kassen` koşuluna bağlanmalı — beş üye
- Wagner/Fußbefund klinik alandır, ödeyiciden bağımsız kalır — `podoloji`, `muhalif` (düzeltti),
  `deger-mi`
- `insurance_type` ve `rezeptart` **farklı sorulara** cevap verir, senkron edilmez —
  `muhalif`, `podoloji`, `legal-de`
- Podolog PKV/Selbstzahler'da **serbest fiyatla** fatura keser: GebüH Heilpraktiker'e, GOÄ
  hekime aittir, podologa **hiçbiri dayanak değildir**; HPNR sözleşme kodudur, sözleşme dışı
  faturada anlamsızdır — `gkv-302`
- §14 UStG açısından tek satır "Podologische Komplexbehandlung" **yeterlidir**
  (handelsübliche Bezeichnung); ICD/DG kodu UStG'de aranmaz — `legal-de`

## Anlaşmazlık

- **Gizle mi, katla mı:** `podoloji` + `deger-mi` gizlemeden yanaydı (tık ekonomisi, müşteri
  talebi harfiyen); `muhalif` katlamayı savundu (bilgi yolu kapanmasın). Kör nokta turunda
  `muhalif` katlamayı geri çekti, `podoloji` ise tersine "katlama > gizleme" dedi — yani ikisi
  yer değiştirdi. **Chairman katlamayı seçti:** geri-çevrilebilirlik riski (aşağıda) tık
  maliyetinden ağır basıyor, ve varsayılan kapalı olduğu için tık maliyeti sıfır.
- **Fatura kalemi:** `podoloji` tek satıra kilitlemeye karşı (Preisliste kalem bazlı);
  `legal-de` kör nokta turunda bunu KDV gerekçesiyle destekledi (aynı seansta tıbbi + kozmetik
  karışabilir, biri muaf biri %19). Talep "tek satır yeterli" diyordu. **Faz 3'e taşındı**,
  orada varsayılan tek satır + açılabilir kalem listesi olarak çözülecek.

## Kör noktalar

1. **Geri-çevrilebilirlik — kararın asıl gerekçesi.** Selbstzahler olarak açılıp DG'si NULL
   kalan kayıt, hasta Rezept'i sonradan getirince `kassen`'e çevrilir ve **sessizce eksik**
   kalır. `podoloji` bunun podoloji pratiğinde **sık** olduğunu doğruladı. Hata abrechnung
   gününde, haftalar sonra ortaya çıkar. → CHECK constraint bunun için var.
2. **Sunucu tarafında bugün koruma yok.** `abrechnung.routes.js`'te `rezeptart` hiç geçmiyor;
   privat kaydın DTA'ya sızmasını engelleyen tek şey `kostentraeger_ik` eşitliği. Bu tesadüf,
   güvence değil. Uydurma DG'li privat kaydın riski "red" değil **yanlış içerikli kabul** —
   en tehlikeli sınıf (`gkv-302`).
3. **KDV ayrımı Selbstzahler'da tersine dönüyor.** `legal-de`nin ilk refleksi "muafiyet
   varsayılan" idi; `podoloji` düzeltti — Selbstzahler çoğunlukla kozmetik Fußpflege, yani
   **%19 doğru varsayılan**. Yazılım muafiyeti otomatik varsayarsa podoloğun
   Betriebsprüfung'unda geriye dönük %19 + faiz doğar. Bize doğrudan Bußgeld yok, ama müşteri
   kaybı var.
4. **BG dördüncü kova.** Herkes üç kova (kassen/privat/selbstzahler) sandı; BG ayrı
   Vertragswesen'dir, §302 değildir ama "privat gibi" de davranmaz.

## Uygulama — builder'a

**Faz 1 — şimdi (~yarım gün)**

- [ ] Ön koşul: Beta-1'in verisinde `SELECT rezeptart, count(*) FROM verordnungen GROUP BY 1`
      çalıştır. Selbstzahler payı %5 altındaysa Faz 2'yi hiç açma. — K0
- [ ] `dashboard.js:23990-24067` — `rezeptart` değişiminde KK / Diagnosegruppe / ICD-10 /
      Zuzahlung-Befreiung alanlarını varsayılan **kapalı** `GKV-Angaben` bölümüne al
      (`rezeptart = kassen` → açık ve bugünkü davranış). Wagner ve Fußbefund **dokunma**. — K2
- [ ] `dashboard.js:24123` — DG zorunluluğunu `rezeptart === 'kassen'` koşuluna bağla — K1
- [ ] `dashboard.js:24174` insert — DG boşsa `''` değil **`null`** yaz (FK
      `verordnungen_diagnosegruppe_fkey`); `icd10` boş dizi kalabilir — K1
- [ ] Opsiyonel serbest metin `behandlungsanlass`, varsayılan
      `Podologische Komplexbehandlung`, sadece `rezeptart !== 'kassen'` iken görünür.
      Kolon yoksa migration gerekir — K1
- [ ] `api-backend/billing/api/abrechnung.routes.js:1817` doğrulama döngüsüne açık guard:
      `rezeptart NOT IN ('privat','selbstzahler','bg')` → 422 anlamlı mesaj. Ayrıca offene-
      Verordnungen / §302 seçim listesi bu üçünü hiç göstermesin — K2
- [ ] Migration: `CHECK (rezeptart <> 'kassen' OR diagnosegruppe IS NOT NULL)`. Önce mevcut
      ihlalleri say — varsa constraint `NOT VALID` ile ekle — K2
- [ ] Dark theme + i18n (de/en/tr) kuralları: yeni etiketler üç dilde — K0

**Faz 2 — Beta-1 Faz 1'i onayladıktan sonra**

- [ ] `leads.insurance_type`'a üçüncü değer `selbstzahler`; `gkv|privat` varsayan tüm okuma
      noktalarını tara (`zuzahlung/calculator.js:80`, `standardRules.js:130`,
      `dashboard.js:3584/8182/15840`) — K2
- [ ] Yeni Verordnung açılırken `insurance_type`'tan `rezeptart` **tek yönlü ön seçim**;
      uyuşmazlıkta engel değil satır içi uyarı ("Patient ist als privat hinterlegt") — K1
- [ ] Muster-13 modal ve Rezept-Scan girişleri GKV olmayan hastada gösterilmesin — K1

**Faz 3 — ayrı iş, ertelendi**

- [ ] Behandlung → Rechnung köprüsü. Tetikleyici: Faz 1 canlıda **ve** Beta-1 haftada ≥5
      Privatrechnung yazıyor. İçermesi gerekenler: §14 Abs. 4 UStG zorunlu alanları
      (fortlaufende Rechnungsnummer, Menge, Leistungsdatum, Entgelt), varsayılan tek satır +
      **açılabilir kalem listesi**, KDV seçimi (Selbstzahler → varsayılan %19; PKV →
      varsayılan §4 Nr. 14 a muafiyeti + `Steuerbefreiungshinweis`; Kleinunternehmer §19 UStG
      üçüncü seçenek), seçim **loglanır**, yazılım muafiyeti otomatik varsaymaz — K3

## Backlog (karara dahil DEĞİL)

- BG/DGUV dördüncü kovası: Unfalltag, Aktenzeichen, DGUV Vertragswesen alanları
  (`gkv-302`: DGUV sözleşmesinden doğrulanmalı, elde belge yok)
- PKV faturasında Diagnose satırının Erstattung için ne kadar zorunlu olduğu kasa bazlıdır —
  Beta-1'e sorulacak olgusal soru, ürün kararı değil
- Podoloji Preisliste yönetimi (kalem bazlı fiyat kataloğu) — Faz 3'ün ön koşulu olabilir

## Sert veto varsa

Yok. `gkv-302` ve `legal-de` 🔧 KOŞULLU verdi; her iki üyenin şartları da karara alındı
(sunucu guard'ı + NULL/FK disiplini; KDV varsayılanının otomatik muafiyet **olmaması** ve
zorunlu Indikation alanının **konmaması**).

## Yeniden değerlendirme tetiği

- Faz 2: Beta-1 Faz 1'i kullanmaya başlar **ve** Selbstzahler payı %5'in üstünde çıkarsa
- Faz 3: Faz 1 canlıda **ve** haftada ≥5 Privatrechnung
- Bütün karar: Podologie için bir Preisvereinbarung/Vertragswesen değişikliği yayımlanırsa
