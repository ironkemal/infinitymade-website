# Konsey Kararı — Podoloji Verordnung listesinde Standort zuschnitt'i
Tarih: 2026-08-28 · Oturan üyeler: gkv-302, legal-de, podoloji, deger-mi, fonksiyon-ustasi
· `muhalif` **oturamadı** (oturum limiti / HTTP 429, 20:40 Berlin'de sıfırlanıyor) — bu tutanağın
tek eksiği odur, aşağıda "Eksik ses" başlığında ne kaçırmış olabileceğimiz yazılı.

## Soru

Podoloji Verordnung listesi çok-Standort'lu bir praxis'te başka Standort'un kayıtlarını
gösteriyor olabilir. Ops kartı "`bizScope` uygula" diyordu. **Uygulanamadı:** `bizScope`
`business_id` kolonuna filtre atar, `verordnungen` tablosunda o kolon yok.

A) Migration — `verordnungen` + `podologie_behandlungen`'e `business_id`, `leads`ten backfill,
mevcut `trg_set_business_id` bağlanır.
B) Migration yok — gömülü hasta üzerinden filtre (`leads!lead_id(business_id)`), `lead_id`
NULL kayıtlar düşer.
C) Başka bir yol.

ON-PREM ETKİSİ: hayır — her iki yol da müşterinin kendi veritabanında kalır.

## KARAR

**C — "praxisweit varsayılan, istenirse zuschnitt, hiçbir satır gizlenmez".**
Podoloji Verordnung listesi **varsayılan olarak praxis genelindedir ve bu bilinçli bir
karardır**, unutulmuş bir filtre değil: Muster 13'te Standort alanı yoktur, kasaya giden IK
praxis'in IK'sıdır, Standort'a ait olan Verordnung değil ona bağlanan **seanstır**. Bu karar
`module/standort-zuschnitt.js`'in başında kodda yazılıdır — kartın "Bitti sayılır" ölçütünün
ikinci şıkkı tam olarak budur. Filtre yalnızca inhaber `data_sharing_settings`'te `patients`
kategorisini **açıkça "ayrı"** yaptıysa VE birden fazla Standort varsa devreye girer.
`lead_id` NULL olan ve hastasının `business_id`'si olmayan satırlar **her Standort'ta
görünmeye devam eder** ve "Praxisweit" rozetiyle işaretlenir. Migration (A) **yapılmaz**,
ertelenir; tetikleyicisi ve kapsamı aşağıda yazılıdır.

## Gerekçe

Belirleyici olan `podoloji` ile `gkv-302`'nin **aynı yöne bakan** iki cümlesi oldu: Verordnung
praxis'e aittir (podoloji), ve bir Verordnung'un listeden düşmesi 28/14 günlük Behandlungsfrist
uyarısını da düşürür, yani Frist kaçar ve GoBD Vollständigkeit bozulur (gkv-302). İkisi
birleşince B'nin "düşürme" kısmı elenir, A'nın aciliyeti ise düşer — çünkü fazla göstermenin
§302 tarafında bedeli yoktur. `legal-de` ihlalin bizde değil praxis'te doğacağını, bizim
kusurumuzun "sorumluya kendi kararını uygulayacak tekniği vermemek" (Art. 28 Abs. 3 lit. c)
olduğunu söyledi — bu kusur tam olarak inhaberin "ayrı" seçimini uygulayan zuschnitt ile
kapanır, migration'a gerek kalmadan. `fonksiyon-ustasi`'nin karşı-olgusu kararı çivileyen şey
oldu: **`abrechnung` tablosunda `business_id` kolonu var ve tek bir yerde bile filtre olarak
kullanılmıyor** — yani kolon eklemek filtreyi getirmiyor, asıl iş çağrı yerlerinde. A'yı
yapıp çağrı yerlerine dokunmasak, kartı kapatmadan sadece şema borcu almış olurduk.

## Ödün verilenler

- Podoloji verisinde Standort ekseni hâlâ **türetilmiş**: hastadan geliyor, kendi kolonu yok.
  Hasta bir Standort'tan diğerine taşınırsa eski Verordnung'ları onunla birlikte taşınır.
- `podologie_behandlungen` (asıl Standort'a ait olan tablo) hâlâ Standort'suz — seans bazında
  "hangi şubede yapıldı" sorusu bugün cevaplanamıyor.
- Zuschnitt istemci tarafında; RLS seviyesinde bir engel değil. Kötü niyetli bir çalışan
  doğrudan API'ye giderse yine görür. (Tenant sınırı RLS'te duruyor, bu Standort sınırı.)
- `arzt-register.js:463` `ladeZuweisungen` ve `statistik.routes.js:174` hâlâ owner-geniş
  okuyor — doktor detayındaki Zuweisung sayıları Standort'lar arası toplam.

## Uzlaşma

- Beş üyenin **hiçbiri** B'nin "lead_id NULL kayıtlar düşsün" hâlini kabul etmedi.
- Eksik göstermek fazla göstermekten pahalıdır (gkv-302 ve podoloji birbirinden bağımsız aynı
  sonuca vardı).
- Bugün Art. 33 anlamında bildirilecek bir olay **yok**: çok-Standort'lu müşteri yok.
- A eninde sonunda gerekli; tartışma "yapılacak mı" değil "ne zaman".

## Anlaşmazlık

`gkv-302` ve `legal-de` "A, şimdi" dedi; `deger-mi` ve `podoloji` "A'yı ertele, küçük sürümü
şimdi yap" dedi. Chairman **erteleyenler lehine** karar verdi, üç ölçüye dayanarak: (1) A'nın
maliyeti 2–4 gün ve Katman 4, (2) bugün semptom yok, (3) `fonksiyon-ustasi`'nin `abrechnung`
karşı-olgusu A'nın tek başına sorunu çözmediğini gösterdi. `gkv-302`'nin asıl bulgusu zaten
bu kartın konusu değil (aşağıda).

**Chairman'ın çoğunluğa karşı verdiği ikinci karar:** `legal-de`'nin 1. şartı — "düzeltme
bitene kadar ikinci Standort onboarding'i teknik olarak kapalı" — **uygulanmadı.** Gerekçe:
o kapı, uygulanmayan bir vaadi telafi etmek içindi; vaat artık uygulanıyor (inhaber "ayrı"
derse liste ayrılıyor), dolayısıyla telafi edilecek Mangel kalmadı. Satılan bir Enterprise
özelliğini kapatmak, kalan riskle orantısız. `legal-de`'nin 2. ve 3. şartı **uygulandı.**

## Kör noktalar

- **`abrechnung.business_id` ölü kolon** — var, doldurulmuş olabilir, hiçbir sorguda
  filtre değil. A'nın tek başına yetmeyeceğinin kanıtı.
- **`gkv-302`: owner başına tek IK varsayımı sabitlenmiş.** `abrechnung.routes.js:409-427`
  IK'yı `terapeut_zertifikat`'tan `.eq('owner_id',…)` + `onConflict:'owner_id'` ile çekiyor.
  İkinci Standort **başka Bundesland'daysa** Tarifkennzeichen (Anlage 3 TP5 V21 §8.1.5.2:
  ilk iki hane Tarifbereich, 01 BW / 08 NRW…) ve LEGS yanlış üretilir → yanlış tutar ya da
  Absetzung, ikisi de sessiz. **Bu, bu karttan büyük ve ondan bağımsız bir risktir.**
- **`bizScope` NULL-toleranslıdır** (`business_id.is.null` OR'lu). 12.08 "Podologie Nord"
  kaybı `bizScope`'tan değil, hard `.eq`'ten geldi. Yani suçlu sanılan mekanizma masumdu.
- `abrechnungsstatus.js:164` owner-geniş okuyor ama `.not('lead_id','is',null)` + çağıran
  zaten bizScope'lu lead listesiyle eşliyor → görünür sızıntı yok, sadece fazla veri çekiyor.

## Eksik ses — `muhalif` oturamadı

Sorulan soru şuydu: *"bu gerçekten bir hata mı, yoksa henüz verilmemiş bir ürün kararının
hata gibi görünmesi mi?"* — ve konsey bu soruyu `muhalif` olmadan **onun beklediği yönde**
cevapladı: evet, verilmemiş bir ürün kararıydı, şimdi verildi ve kodda yazılı. `muhalif`'in
muhtemelen basacağı ikinci nokta — "A'yı yapıp altı ay sonra neye pişman oluruz" — kısmen
`fonksiyon-ustasi`'nin `abrechnung` karşı-olgusuyla karşılandı. **Karşılanmayan:** üç
tablonun (`podologie_behandlungen`, `prescription_sessions`, `pat_fussbefund`) yarım
bırakılmasının bedeli tartışılmadı. Tetikleyici notunda hepsinin **tek parça** yapılması
şartı bu boşluğa karşı konuldu.

## Uygulama — yapıldı

- [x] `module/standort-zuschnitt.js` — saf kural + gerekçe. Karmaşıklık: K1
- [x] `module/standort-zuschnitt.test.js` — 8 test; ikisi doğrudan "hiçbir satır kaybolmaz"
      regresyonu (`lead_id` NULL ve `business_id` NULL her Standort'ta görünür). K1
- [x] `module/podologie-abrechnung.js` — `leads(business_id)` seçimi, zuschnitt çağrısı,
      "Praxisweit" rozeti (yalnız ayrı-mod'da görünür). K1
- [x] `dashboard.js` — `podoCtx().aktiverStandort()`; satır sayısı artmadı (mevcut satıra
      eklendi, boyut kapısı korundu). K0
- [x] `compliance/TOM.md` §1.3 — "Multi-Business via `business_id`" ifadesi daraltıldı. K0
- [x] `compliance/LEGAL_DECISIONS.md` — süreli Risikoakzeptanz. K0

## Ertelenen — A'nın tetikleyicisi ve kapsamı

**Ne zaman:** İlk çok-Standort'lu podoloji müşterisi sözleşmeyi imzaladığında, **onboarding'inden
önce.** Daha erken değil, daha geç değil.

**Kapsam (tek parça, parçalanırsa iki kez ödenir):**
1. `verordnungen` + `podologie_behandlungen` + `pat_fussbefund` + `prescription_sessions`'a
   `business_id`, `leads`ten backfill, `trg_set_business_id` bağlanır.
2. **Çağrı yerleri** — kolon eklemek yetmez (`abrechnung` kanıtı). `fonksiyon-ustasi`'nin
   çıkardığı owner-geniş 12 yol tek tek geçilir.
3. IK/LEGS ekseni: `terapeut_zertifikat`'ın `owner_id` tekliği Standort'a açılır
   (`gkv-302` bulgusu). Bu olmadan çok-Standort'lu bir praxis **yanlış tutar** gönderir.

## Backlog (karara dahil DEĞİL)

- `abrechnung.business_id` ölü kolon: doldurulmuşsa filtreye alınmalı, doldurulmuyorsa
  düşürülmeli. Bugün ikisi de değil.
- `arzt-register.js:463` Zuweisung sayıları Standort'lar arası toplam.

## Sert veto

Yok. `legal-de` ve `gkv-302` ikisi de 🔧 KOŞULLU verdi, ⛔ vermedi.
