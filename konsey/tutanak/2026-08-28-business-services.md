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
- `onboarding.js:581`'deki eşleşme `business_services.id` üzerinden gidiyor; tablo
  gidince eşleşme yalnız isme kalır → hizmet adı değişirse "sil + yeni" davranışı.
- Tablo bugün hâlâ duruyor: yarım bir durum, ve yarım durumlar unutulur. Kayıt bu
  yüzden burada ve Ops-Dashboard'da.

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

- **`onboarding.js` şu an kırık olabilir.** `muhalif` buldu, `fonksiyon-ustasi`
  bağımsız doğruladı: payload `code` alanı yazıyor ama `business_services`'te o
  kolon yok (PGRST204), ve FK `business_id → businesses(id)` iken `userId`
  yazılıyor (23503). İkisi de `throw` ediyordu → kullanıcı Dienstleistungen
  adımında kilitlenirdi. **Canlıda doğrulanmadı** (DB erişimi yok). Bu yüzden
  bugünkü müdahale kodu "düzeltmek" değil **bloklamaktan çıkarmak** oldu: hangi
  varsayım doğru çıkarsa çıksın, kullanıcı ilerleyebilir.
- Beta müşterilerinin bu adımı geçmiş olması, adımın **opsiyonel** olmasıyla
  açıklanabilir (boş liste geçerli) — yani hata hiç tetiklenmemiş olabilir.
- `business_lookup_for_twilio` RPC'leri bu tablodan okuyordu; o fonksiyonlar
  DROP edilmiş, güncel dökümde yok. Ek iş çıkarmıyor.

## Uygulama

- [x] `api/stripe/webhook.js` — `business_services` insert'i silindi — K1
- [x] `api-backend/server.js` — aynı — K1
- [x] `api/dsgvo.js` — filtre `owner_id` → `business_id` — K1
- [x] `onboarding.js` — ayna yazımı/okuması bloklamıyor, `console.warn` — K1
- [ ] **MCP gelince:** `code` kolonu ve FK canlıda doğrulanır — K0
- [ ] **MCP gelince:** `onboarding.js` yalnız `services`'e yazar; `is_active` +
      `display_order` ya `services`'e eklenir ya formdan çıkar — K2
- [ ] **MCP gelince:** `business_services` DROP + `api/dsgvo.js` listesinden çıkar
      + `db/SCHEMA*.sql` tazelenir + harita güncellenir — K2
- [ ] Tetikleyici: podoloji uçtan uca tarayıcı testi PASS

## Backlog (karara dahil DEĞİL)

- `services`'te `is_active` / `display_order` olmaması — hizmetleri pasife alma ve
  sıralama bugün hiçbir yerde yok. Ürün eksiği, ayrı karar.
- `employee_services` için "Public read" politikası dökümde uyarılı.

## Sert veto

Yok. `legal-de` oturmadı; oturmuş olsaydı yalnız DSGVO kalemi üzerinde konuşurdu
ve o kalem zaten kararın içinde (Auskunft düzeltildi, DROP sırasında tablonun
listeden çıkarılması işaretlendi).

## Avukat/DSB'ye

Yok. Ama `legal-de`'ye **tablo DROP edilmeden önce** tek satırlık bir soru
gitmeli: Art. 15 kapsamındaki bir tabloyu kaldırırken, içindeki veri başka bir
tabloda (burada `services`) zaten mevcutsa, ihraç listesinden çıkarmak kapsamı
daraltmış olur mu? Beklenen cevap hayır, ama kayda geçmeli.
