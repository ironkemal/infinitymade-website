# Konsey Kararı — `business_services` tablosunun geleceği

Tarih: 2026-08-28 · Oturan üyeler: `muhalif`, `deger-mi`, `fonksiyon-ustasi`

> `legal-de` bu turda **oturmadı** — bir önceki denemede oturum limiti üç üyeyi
> birden düşürmüştü. DSGVO boyutu kararın içinde ama hukuki imza yok; aşağıdaki
> "Avukat/DSB'ye" bölümüne bakınız.

## KARAR

`business_services` **kaldırılacak (Seçenek B)**, ama tek hamlede değil — çünkü
tablonun DROP'u veritabanı erişimi istiyor ve bu oturumda yok. Bugün yapılan:
**tabloya yazan iki `service_role` yolu silindi** (`api/stripe/webhook.js`,
`api-backend/server.js`), böylece `business_id` sütunu **tek anlama indi** (yalnız
`onboarding.js` yazıyor ve orada her zaman `auth.uid()`); `api/dsgvo.js`'teki
filtre `owner_id` → `business_id` olarak düzeltildi, yani Art. 15 Auskunft bu
tabloyu artık gerçekten kapsıyor; ve `onboarding.js`'teki ayna yazımı **bloklayıcı
olmaktan çıkarıldı** — hatası artık konsola düşüyor, kullanıcıyı Dienstleistungen
adımında kilitlemiyor. Tablonun DROP'u, `onboarding.js`'in tek tabloya (`services`)
indirilmesi ve `api/dsgvo.js` listesinden çıkarılması **MCP/DB erişimi gelince**,
tek migration + tek commit halinde yapılacak. `services` **tek hizmet tablosudur.**

## Gerekçe

`fonksiyon-ustasi`'nın olguları tartışmayı bitirdi: tabloyu **okuyan yok** —
`booking.js`, `booking-request.js`, `dashboard.js`, `kalender.js` ve tüm
`api-backend` `services`'ten okuyor; tek okuyucu `onboarding.js`'in kendi yazdığını
prefill için geri okuması. **Hiçbir FK** `business_services(id)`'ye bakmıyor;
`bookings`, `booking_requests`, `warteliste`, `employee_services` hepsi
`services(id)`'ye bakıyor. Yani kaldırmak hiçbir kaydı kırmıyor. `muhalif` haklı
olarak "tek migration, beş şey birlikte" dedi; ona uyuldu — ama DB'siz yapılabilen
kısım bugüne alındı, çünkü `deger-mi`'nin işaret ettiği tek gerçek risk (kırık
DSGVO Auskunft) hukuki yükümlülük ve beklemeye değmez.

Sıra tartışmasında `deger-mi` haklı: podoloji uçtan uca bitmeden büyük şema işi
araya girmemeli. "Canlı müşteri yok" penceresi bir hızlandırıcı, sıra bozucu değil.

## Ödün verilenler

- `is_active`, `display_order`, `follow_up_days` yalnız `business_services`'te var;
  tablo gidince kaybolacaklar. **Kimse okumuyor** (doğrulandı: hasta rezervasyonu
  `/api/services/public` üzerinden `services`'ten okuyor), yani işlevsel kayıp yok
  — ama onboarding formundaki "aktif" kutucuğu bugün zaten hiçbir şeyi
  etkilemiyordu ve bu, tablo gidince **görünür** hale gelecek. O noktada ya iki
  kolon `services`'e eklenir ya da kutucuk formdan çıkar. Ürün kararı, ertelendi.
- ~~`onboarding.js:581` eşleşmesi isme düşer~~ → **öyle olmadı, tersi oldu.**
  `row.dataset.svcId` artık gerçek bir `services.id` taşıdığı için eşleşme
  **önce id'den** gidiyor, isim yalnız şablon satırları için yedek yol. Yani
  hizmeti yeniden adlandırmak artık satırı kaybettirmiyor — eskisinden iyi.
- ~~Tablo bugün hâlâ duruyor~~ → **28.08.2026 akşamı düşürüldü**, yarım durum
  kapandı.
- `follow_up_days` gerçekten kayboldu (yalnız o tablodaydı, kimse okumuyordu).

## Uzlaşma

Üç üye de C'yi (yalnız belgele) reddetti ve B'yi doğru yön saydı. `deger-mi`'nin
"bugün 50 dakikalık iki parça" önerisi ile `muhalif`'in "tek commit'te beş şey"
uyarısı çelişmiyor: ilki DB gerektirmeyen kısım, ikincisi DB gerektiren kısım.

## Anlaşmazlık

Zamanlama. `muhalif` her şeyin tek commit'te olmasını istedi; `deger-mi` bugün
küçük parça, tam iş podoloji testinden sonra dedi. **Chairman `deger-mi` lehine
karar verdi**, çünkü tek commit zaten mümkün değil (DROP için DB yok) ve DSGVO
düzeltmesini o commit'e kadar bekletmek yükümlülüğü uzatırdı.

## Kör noktalar

- ~~**`onboarding.js` şu an kırık olabilir.**~~ ✅ **Canlıda doğrulandı
  (28.08.2026, MCP):** ikisi de doğruymuş. `business_services`'te `code` kolonu
  **yok** (11 kolon sayıldı), FK gerçekten `business_id → businesses(id) ON
  DELETE CASCADE` idi. Yani onboarding'in ayna yazımı **hiçbir zaman
  çalışmamış**; tabloya yazan tek şey silinen iki `service_role` yoluydu.
- ~~Beta müşterileri adımı geçmiş olabilir~~ → **Neden geçtikleri anlaşıldı:**
  hata `throw` ediyordu ama bu tabloya yazma denemesi zaten hiç başarılı
  olmamıştı; 26 satırın **hepsi** webhook/backend kaynaklı ve hepsinde
  `business_id` gerçek bir `businesses.id`. Policy `auth.uid() = business_id`
  olduğu için satırların **hiçbiri** kendi praksisine görünmüyordu.
- **Sonradan çıkan üçüncü kırık:** tablonun okunması da hep boş dönüyordu, ve
  onboarding'in silme mantığı (`bsNames`) tam olarak bu boş listeye bağlıydı.
  Yani formdan bir hizmet çıkarmak **hiçbir zaman bir şey silmiyordu**, ve
  onboarding'e geri dönen kullanıcı mevcut hizmetlerini **hiç görmüyordu**
  (yalnız branş şablonunu). Her ikisi de `services`'e geçişle düzeldi.
- ⚠️ **`business_lookup_for_twilio` hakkındaki not YANLIŞTI.** Tutanakta
  "o fonksiyonlar DROP edilmiş" yazıyordu; canlıda **duruyorlar** —
  `business_lookup_for_inbound` ve `business_lookup_for_twilio`. İkisi de bu
  tablodan okuyordu. Ancak: sıfır çağıran (depoda tek geçiş yok), yalnız
  `service_role`'a `EXECUTE` (anon/authenticated çağıramaz, güvenlik açığı
  değil) ve **zaten kırıklar** — `profiles.cal_api_key_secret_id` ile
  `profiles.cal_username` kolonları artık yok. DROP onları kötüleştirmedi.
  Akıbetleri ayrı bir karar (CLAUDE.md: "`business_lookup_for_twilio`
  RPC'sine dokunma").

## Uygulama

- [x] `api/stripe/webhook.js` — `business_services` insert'i silindi — K1
- [x] `api-backend/server.js` — aynı — K1
- [x] `api/dsgvo.js` — filtre `owner_id` → `business_id` — K1
- [x] `onboarding.js` — ayna yazımı/okuması bloklamıyor, `console.warn` — K1
- [x] `code` kolonu ve FK canlıda doğrulandı — **ikisi de doğru çıktı** — K0
- [x] `onboarding.js` yalnız `services`'e yazar; vorbelegme de `services`'ten
      okuyor (eskiden hep boş dönüyordu) — K2
- [x] `is_active`: **formda kaldı ama artık gerçekten çalışıyor** — işareti
      kaldırılan satır oluşturulmuyor. Eskiden yalnız ölü tabloya gidiyordu, yani
      her yeni praksis şablonun on önerisini de alıyordu. `display_order`
      düşürüldü: `services`'te böyle bir kolon yok, sıra `created_at`.
      Hizmetlerin sıralanabilir/pasifleştirilebilir olması **ayrı ürün kararı**
      (Ops-Dashboard) — kutucuğu CSS ızgarasından sökmek yerine anlamlandırmak
      daha ucuz ve dürüsttü
- [x] `business_services` DROP (`20260828202843_business_services_droppen_spiegeltabelle`)
      + `api/dsgvo.js`'in her iki listesinden çıkarıldı + `db/SCHEMA.sql` ·
      `db/SCHEMA-RLS.sql` · `db/README.md` tazelendi + harita güncellendi — K2
- [x] 26 satır DROP öncesi **depo dışına** yedeklendi (depo public):
      `Ops-Drive/infra/db-sicherung/2026-08-28_business_services_vor_drop.json`
- [x] DROP öncesi bağımlılık taraması: hiçbir FK, view veya rule bu tabloya
      bakmıyordu (`pg_depend`/`pg_rewrite` boş)
- [~] Tetikleyici "podoloji uçtan uca test PASS" **beklenmedi.** Sahibin açık
      talimatı: "Şu an canlı müşterimiz olmadığı için ikincisini istiyorsan
      yapabilirsin. Bir hata olursa sıkıntı yok, düzeltiriz." Yarım durumu
      taşımak, `deger-mi`'nin sıra gerekçesinden daha pahalıydı.

## Backlog (karara dahil DEĞİL)

- `services`'te `is_active` / `display_order` olmaması — hizmetleri pasife alma ve
  sıralama bugün hiçbir yerde yok. Ürün eksiği, ayrı karar.
- `employee_services` için "Public read" politikası dökümde uyarılı.

## Sert veto

Yok. `legal-de` oturmadı; oturmuş olsaydı yalnız DSGVO kalemi üzerinde konuşurdu
ve o kalem zaten kararın içinde (Auskunft düzeltildi, DROP sırasında tablonun
listeden çıkarılması işaretlendi).

## Avukat/DSB'ye

Soru soruluyordu: Art. 15 kapsamındaki bir tabloyu kaldırırken, ihraç listesinden
çıkarmak kapsamı daraltır mı? **Olgusal cevap DROP'tan önce toplandı ve daraltma
olmadığını gösteriyor:**

- Tablo **hasta verisi içermiyordu** — yalnız praksisin kendi hizmet adları,
  süreleri ve fiyatları (26 satır, tamamı incelendi).
- Aynı içerik `services`'te duruyor ve `services` ihraç listesinde **kalıyor**
  (`api/dsgvo.js:14`, `filter: 'owner_id'`), yani veri sahibi aynı bilgiye
  erişmeye devam ediyor.
- Kaldırılan satırlar RLS gereği ilgili praksise **hiç görünmüyordu**; bir
  Auskunft bu tabloyu bugüne kadar zaten pratikte boş döndürüyordu (filtre
  28.08. sabahına kadar var olmayan bir kolona bakıyordu, yani PostgREST 400).

**Yine de `legal-de`'nin imzası alınmadı** — bu turda oturmadı ve genel ajan
eşiği gereği kullanıcı istemeden çağrılmadı. Yukarıdaki üç madde olgudur, hukuki
değerlendirme değildir; güvenlik/hukuk turunda `legal-de`'ye gösterilecek.
