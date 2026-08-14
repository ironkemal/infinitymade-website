# Konsey Kararı — Frontend mimarisi: framework mi, yerinde katman mı
Tarih: 2026-08-13 · Oturan üyeler: muhalif, deger-mi, fonksiyon-ustasi, legal-de, gkv-302

## Tetikleyen

Kullanıcı projede framework olmadığını fark etti ve dört acıyı doğruladı: (1) aynı veriye
çok yerden yazılıyor, (2) "kaydettim ama ekranda eskisi duruyor", (3) yazım hataları ancak
çalışma anında çıkıyor, (4) model `dashboard.js`'i kavrayamıyor. Soru: React'a mı geçmeli?

## Ölçüm (2026-08-13)

| | |
|---|---|
| `dashboard.js` | 26.857 satır · 779 fonksiyon tanımı · 78 `window.X =` (51 benzersiz) |
| DOM | `getElementById` 2.097 · `innerHTML` 347 · `addEventListener` 454 · `onclick` ref 122 (+13 HTML) |
| DB | `dashboard.js` içinde 457 doğrudan `.from(` — araya katman yok |
| Tip/lint | `jsconfig.json` · `tsconfig.json` · eslint → **hiçbiri yok** |
| ES module | **altyapı var ve çalışıyor** — `dashboard.js:1-8`, 8 import |

## KARAR

**React/Next'e GEÇİLMEYECEK ve 27k satır YENİDEN YAZILMAYACAK.** Bunun yerine eksik katmanlar
vanilla kalınarak, aşağıdaki **yeniden sıralanmış** paketle eklenir. Chairman'ın ilk önerisi
konseyde iki noktada bozuldu ve düzeltildi: (a) CDN yerelleştirmesi yarım gün değil ~1,5 gündür
ve tek satır değil 8+ yeri kapsar, (b) `profiles` yazma yollarını tek kapıya bağlamak ilk turda
**yapılmayacak** — bu maddenin regresyon riski, iddia edilen faydasından büyük.

Sıra: **S1 → S2 → S3 → S4.** S5 ertelenir, tetiğe bağlanır.

- **S1 — Büyüme kapısı (10 dk).** `CLAUDE.md`'ye kural: "yeni kod yeni dosyaya, `dashboard.js`
  büyümez." Kural yetmez, **kapı** kurulur: pre-commit hook, `dashboard.js` satır sayısı
  bugünkü değerden büyükse commit reddedilir. (muhalif'in mekanizması; deger-mi "tartışmasız,
  bugün" dedi.)
- **S2 — Olay/sinyal katmanı (1 gün).** ~50 satır pub/sub. Projede **hiç yok** (doğrulandı:
  `dispatchEvent`in 17 kullanımı DOM form senkronu, veri sinyali değil). Değer üreten tek
  katman ve en çok şikayet edilen acıyı kapatan madde.
- **S3 — CDN yerelleştirme (1,5 gün).** `legal-de` Art. 32 gerekçesiyle bu haftaya çekti.
  Kapsam düz indirme değil `?bundle&target=es2020`: düz indirme transitive import yüzünden
  kırılır. Yerler: `dashboard.js:1` + `:21212` (node-forge), `kalender.js:1`, `login.js:1`,
  `employee-signup.js:1`, `confirm.html:115`, `lib/supabase.js:47`, `ops/app.js:4`,
  `kalender.html:14-15` (FullCalendar). Sentry loader ayrı karar.
- **S4 — Tip kontrolü (0,5 gün).** `jsconfig.json` + `checkJs`. TypeScript'e geçilmez, build
  adımı doğmaz, tarayıcıya giden kod aynı kalır. JSDoc önceliği `gkv-302`'nin beş alanı.
- **S5 — Veri katmanı (ERTELENDİ).** İlk tur **yalnızca okuma + olay yayını**; hiçbir yazma
  yolu değiştirilmez. Yazanlar dokunuldukça göç eder (kuşatma). İlk hedef tablo `profiles`
  **değil**, `verordnungen` + `podologie_behandlungen` (gkv-302).

Toplam bugünkü paket: **~3 gün**, ama bileşimi ilk öneriden farklı.

## Gerekçe

Dört acıdan üçü (çok yerden yazma, tip hataları, dosya kavranamaması) framework'le ilgisizdir;
React'ta da aynen yaşanır — bunlar katman ve araç eksikliğidir. React'a geçiş ~2-3 ay sürer,
sıfır müşteri değeri üretir, canlı betada regresyon riski taşır ve her on-prem kuruluma build
adımı + Node runtime bindirerek tek gerçek stratejik avantajı bozar. Belirleyici olan üç görüş:
`deger-mi`nin "3 gün blok değil 3 parça" küçültmesi, `muhalif`in K0/K3 ölçüm düzeltmesi,
`legal-de`nin Art. 32 gerekçesiyle CDN'i öne çekmesi.

## Ödün verilenler

- **Melez kod tabanı kabul ediliyor.** Bir süre iki desen yan yana yaşayacak (eski doğrudan
  çağrılar + yeni katman). `muhalif`: kaçınılmaz, ama tek yönlü olmalı — geri göç yasak.
- **Eski 27k satır bu turda düzelmiyor.** Acılar yeni kodda biter, eskide sürer.
- **`profiles`'ın 10 yazma yolu bu turda birleşmiyor** — 1. acı kısmen açık kalır.
- **Frontend veri katmanı kurulsa bile yazımların ~%25'ini kapsar.** Kalanı `onboarding.js` (8),
  `kalender.js` (1) ve backend `service_role` (52 yer). Tek kapı iddiası bu haliyle eksiktir.
- **İşe alımda "React" diyemiyoruz** — maliyet gerçek, on-prem avantajı karşılığında kabul edildi.

## Uzlaşma

- Üç üye (muhalif, deger-mi, gkv-302) bağımsız olarak **S5'in ertelenmesinde** birleşti.
- Olay katmanının elle yazılması (~50 satır, sıfır bağımlılık) doğru bulundu — on-prem dostu.
- `deger-mi` ve `muhalif` S1'i (kural + kapı) en yüksek getirili madde saydı.
- Hiç kimse React'a geçişi savunmadı.

## Anlaşmazlık

**S3'ün (CDN) zamanlaması.** `deger-mi`: "bu tartışmaya ait değil, on-prem kovasına yaz"
(ertele). `legal-de`: "bu hafta düzelt" (Art. 32).
**Chairman `legal-de` lehine karar verdi.** Gerekçe: `deger-mi`ye brifingde CDN yalnızca
teknik bir temizlik olarak sunuldu, Art. 32 çerçevesi verilmedi — dolayısıyla değerlendirmesi
eksik girdiyle yapıldı. Bulgunun ağırlığı DSGVO aktarımı değil **tedarik zinciri**: CDN ele
geçirilirse tarayıcıda keyfi kod çalışır ve oturumdaki tüm hasta verisine erişir. Beta
müşterilerde gerçek hasta verisi var.

## Kör noktalar

1. **`lib/supabase.js` ölü kod — veri katmanı bu projede bir kez yazılmış ve terk edilmiş.**
   11 fonksiyonluk sarmalayıcı mevcut; tek geçtiği yer `komponenten.html:899`'daki açıklama
   metni, hiçbir sayfa import etmiyor (doğrulandı). Bu, S5'in ertelenmesini destekleyen en
   güçlü kanıt: aynı fikir daha önce denenmiş ve benimsenmemiş. S5 açıldığında bu dosya ya
   canlandırılır ya silinir — üçüncü bir kopya yazılmaz.
2. **`profiles` yazma yolları aynı işi yapmıyor — en az 4 farklı yetki bağlamı var:**
   `.eq('id', currentSession.user.id)` (self), `.eq('id', empId)` (başkasının profili:
   12095/12170/12188/12234), `.eq('id', ownerId)` (6034, 26826/26834), onboarding'de
   `.eq('id', userId)` + auth henüz yarım. Backend `service_role` RLS'i tamamen atlıyor.
   "Hepsi aynı" varsayımı yanlıştı.
3. **`dashboard.js` tematik ayrıma direniyor.** Haritada tek bir fonksiyon bile tek modüle ait
   değil: 148 fonksiyon abrechnung+kunden+team'e ortak, 447 fonksiyon (12.506 satır)
   sınıflanamıyor. Satır aralığı olarak bitişik **tek** küme podoloji: **24030–25696**
   (20 fn / 626 satır). Yani eski kodu bölmek sanıldığından zor; ilk kuşatma hedefi podoloji
   olmalı — hem bitişik hem de güncel vertikal.
4. **⚠️ Kapsam dışı ama ciddi: `verordnungen` için GoBD değişmezlik koruması yok.**
   `db/SCHEMA-RLS.sql`'de yalnızca `belegliste` korunuyor (439, 501: `prevent_belegliste_mod()`).
   `verordnungen.status='abgerechnet'` sonrası UPDATE'i engelleyen trigger yok. §302'ye girmiş
   bir kayıt sonradan düzenlenirse gönderilen DTA ile DB ayrışır → Korrekturverfahren (VKZ 04)
   yanlış temele oturur, ZAA-Absetzung eşleşmez. **Sessiz yanlış hesap sınıfı.** Bu karara
   dahil değildir, ayrı iş olarak kaydedilir.
5. **Chairman'ın kör noktası (muhalif teşhisi):** dört acının üçü React aleyhine delil olarak
   kullanıldı; oysa React onları zaten çözmez. B seçeneği bu delil olmadan da haklıdır —
   gerekçe düzeltildi.

## Uygulama — builder'a

- [ ] S1a `CLAUDE.md`'ye "yeni kod yeni dosyaya" kuralı — K0
- [ ] S1b pre-commit hook: `dashboard.js` satır sayısı artarsa commit reddi — K1
- [ ] S2 olay/sinyal katmanı (~50 satır) + ilk tüketici olarak mevcut `refresh*` helper'larının
      birine bağlanması (`refreshBookingViews`, dashboard.js:1716) — K2
- [ ] S3 CDN yerelleştirme, `?bundle&target=es2020`, 8 yer + FullCalendar; airgap testi
      (ağı kes, dashboard açılıyor mu) — K2
- [ ] S4 `jsconfig.json` + `checkJs`; JSDoc önce §302 tip sözlüğü: Positionsnummer /
      Abrechnungscode / Tarifkennzeichen **string** (baştaki sıfır), IK 9 haneli string,
      tutar cent-integer mi euro-float mu, tarih `YYYYMMDD`, Menge/Faktör — K2
- [ ] S3-sonrası: TOM'a "keine externen CDN-Ressourcen im Anwendungskontext", DSFA'ya
      supply-chain notu, VVT'de esm.sh yok teyidi (legal-de) — K1

## Backlog (karara dahil DEĞİL)

- `verordnungen` GoBD değişmezlik trigger'ı (kör nokta 4) — ayrı iş, gkv-302 alanı
- `lib/supabase.js`: canlandır ya da sil (kör nokta 1)
- Sentry CDN loader — on-prem'de kapatılmalı, ayrı karar
- Google Fonts açık maddesi — S3 ile aynı hukuki gerekçe, aynı sweep'te kapatılabilir
- Podoloji kümesinin (24030–25696) ayrı modüle çıkarılması — ilk kuşatma hedefi

## Sert veto

`legal-de` ⛔ — **kapsamı on-prem sürümüdür, bugünkü SaaS'ı bloklamaz.** On-prem imajında tek
bir dış runtime çağrısı kalamaz; "Ihre Daten bleiben auf Ihrem Server" iddiası internet
bağımlılığıyla birlikte UWG §5 irreführende Angabe ve §434 BGB Sachmangel açar. **Etrafından
dolaşma yolu yok, doğrudan uyulur:** on-prem release checklist'ine zorunlu airgap testi
(ağ kesik, uygulama açılıyor mu) eklenir. S3 bu şartın ön ödemesidir.

## Yeniden değerlendirme tetiği

Bu karar (React'a geçmeme) şu ikisinden biri gerçekleşirse yeniden açılır:
**(a)** iki geliştirici aynı dosyada düzenli merge çakışması yaşamaya başlarsa,
**(b)** `dashboard.js` 30.000 satırı aşarsa.

S5 (veri katmanı yazma yolları) tetiği: Melih'in ilk PR'ı **veya** `profiles` yazma
çakışmasından doğan bir hata.
