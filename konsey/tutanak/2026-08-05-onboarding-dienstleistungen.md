# Konsey Kararı — Onboarding "Ihre Dienstleistungen" adımı
Tarih: 2026-08-05 · Oturan üyeler: muhalif, deger-mi, gkv-302, podoloji (+ dış göz: yanıt gelmedi)

## KARAR

Adım **kaldırılmayacak**, **dönüştürülecek** (Seçenek B — küçültülmüş sürüm). Onboarding'in
"Dienstleistungen" adımı bundan böyle **yalnızca Selbstzahler/Privat hizmetlerin** adımıdır ve
**atlanabilir**. GKV tarafına onboarding hiçbir şekilde dokunmaz: ne yazar, ne siler, ne fiyat
sorar — GKV kataloğu `dashboard.js:9681 autoSeedGkvServices()`'in tekelindedir ve ekranda sadece
tek satırlık bir bilgi kutusuyla ("GKV-Leistungen werden automatisch angelegt") anılır. Ayrıca
`onboarding.js:660-678`'deki delete-then-insert `gkv_position_nr IS NULL` filtresiyle daraltılır,
`SERVICE_TEMPLATES`'ten Heilmittel dışı sektörler ve GKV adı taşıyan kalemler temizlenir.
"Mindestens eine Dienstleistung" zorunluluğu kaldırılır. Podoloji'nin önerdiği üç toggle
(Nagelspange / Hausbesuch / Selbstzahler-Fußpflege) **bu karara dahil değildir** → Backlog.

## Gerekçe

Dört üye de bağımsız olarak B'de buluştu; çelişki olmadığı için kör nokta turu çalıştırılmadı.
Belirleyici olan gkv-302'nin olgusu: §302 zinciri Positionsnummer'ı ve Vergütung'u `services`
tablosundan **hiç okumuyor** (`billing/codes/*_positions.js` + `heilmittel_tarif`,
`abrechnung.routes.js:394-401`) — dolayısıyla bu adımın hukuki/faturasal bir riski yok, sorun
tamamen **seçici karışıklığı ve sessiz gelir kaybı**: `gkv_position_nr`'sız ikinci bir "KG" satırı
"✦ Private Leistungen" altında görünüyor (`dashboard.js:5510`), terapist onu seçerse seans GKV
faturasına hiç girmiyor. Adımı tamamen kaldırmak (A) da güvenliydi ama deger-mi'nin ölçümü
belirleyici oldu: STEPS dizisi 8 yerde geçiyor, resume akışı ve `booking.html`'in ilk günü buna
bağlı — A, B-lite'ın 2-3 katı efor ve podoloji vertikalinden yarım gün çalıyor.

## Ödün verilenler

- Onboarding 7 adım olarak kalıyor; akış kısalmıyor. Beklenen kazanç kısalık değil, **doğru soru**.
- Kullanıcı GKV fiyatlarını onboarding'de göremeyecek (sadece "otomatik hazırlandı" bilgisi) —
  salt-okunur GKV listesi çizmek katalog import zinciri demekti, bilinçli olarak yapılmıyor.
- Adım atlanabilir olunca hiç private hizmeti girmeyen owner'lar olacak; `booking.html` onlarda
  ilk gün yalnızca GKV kalemlerini gösterecek.

## Uzlaşma

- **C (olduğu gibi bırak) elendi** — dört üyenin dördü de reddetti.
- `onboarding.js:660-678` delete-then-insert'i seçenekten bağımsız bir **hata**; hemen düzeltilmeli.
- `SERVICE_TEMPLATES`'teki barber/beauty/nails/tattoo/spa/gym/restaurant blokları ölü kod.
- Onboarding aşamasında GKV/Privat ayrımını kullanıcıya **sormanın değeri yok** — GKV tarafı
  zaten kullanıcı girdisinden bağımsız.

## Anlaşmazlık

Yok. gkv-302 ve podoloji A'yı da kabul edilebilir buldu, deger-mi eforu gerekçesiyle A'yı erteledi;
muhalif B'de netti. Tercih farkı, çelişki değil.

## Kör noktalar

**Silmenin gerçek sonucu, hiçbir üyenin tahmin ettiği gibi değil.** Konsey sonrası şema doğrulandı
(`information_schema`, canlı proje):

| Çocuk tablo | `services` satırı silinince |
|---|---|
| `bookings.service_id` | **NO ACTION** — silme reddedilir |
| `booking_requests.service_id` | SET NULL |
| `warteliste.service_id` | SET NULL |
| `employee_services.service_id` | CASCADE |

Yani muhalif'in "randevular boş hizmete bakar" senaryosu **gerçekleşmiyor**; bunun yerine
`bookings` FK'sı silmeyi bloklar → `onboarding.js:666` `throw delSvc` → **randevusu olan bir owner
onboarding'e geri döndüğünde Dienstleistungen adımını hiç tamamlayamaz.** Buna karşılık
`booking_requests` ve `warteliste` üzerindeki SET NULL sessiz veri kaybıdır. Bu, delete filtresini
"iyi olur"dan **zorunlu**a çıkarıyor ve daraltmanın `gkv_position_nr IS NULL` ile bitmemesi
gerektiğini gösteriyor.

## Uygulama — builder'a

- [ ] `onboarding.js:660-678` — silme kapsamını daralt: yalnızca `gkv_position_nr IS NULL`
      **ve** hiçbir `bookings` kaydına bağlı olmayan satırlar silinsin. Tercih edilen şekil:
      delete-then-insert yerine `id` varsa update / yoksa insert (upsert) — böylece
      `booking_requests`/`warteliste` üzerindeki SET NULL kaybı da doğmaz — karmaşıklık: **K3**
- [ ] `onboarding.js:11` `SERVICE_TEMPLATES` — barber/beauty/nails/tattoo/spa/gym/restaurant/
      massage/praxis bloklarını sil; kalan 4 praxis şablonundan GKV adı taşıyan kalemleri
      (KG, MT, MLD, KMT, ES, US, Hornhautabtragung, Nagelbearbeitung, Komplexbehandlung,
      "Podologische Erstbehandlung") çıkar — karmaşıklık: **K1**
- [ ] `onboarding.html:257-280` — başlık/açıklamayı Selbstzahler odağına çevir + tek satırlık
      bilgi kutusu: "GKV-Leistungen werden automatisch angelegt — hier nur Ihre
      Selbstzahler-Leistungen." — karmaşıklık: **K1**
- [ ] `onboarding.js:655` — "Mindestens eine Dienstleistung wird benötigt" kapısını kaldır,
      adıma "Später ausfüllen" / atla düğmesi ekle (billing adımındaki `billingSkip` deseni
      zaten var) — karmaşıklık: **K2**
- [ ] Yeni/değişen metinler **de/en/tr** üç dilde — karmaşıklık: **K1**
- [ ] Cache busting: `?v=20260805` — karmaşıklık: **K0**
- [ ] Doğrulama: yeni podologie owner'ı ile kayıt → dashboard aç → `autoSeedGkvServices()` sonrası
      onboarding'e geri dön ve adımı tekrar submit et. Beklenen: HPNR'li satırlar duruyor, submit
      hata vermiyor, seçicide duplicate isim yok — karmaşıklık: **K2**

## Backlog (karara dahil DEĞİL)

- Podoloji'nin üç toggle'ı: Nagelspange sunuluyor mu · Hausbesuche yapılıyor mu ·
  Selbstzahler-Fußpflege var mı. Gerçek değeri var (ayrı takip, randevu süresi, ayrı fiyat listesi)
  ama sorulan soru "bu adım ne olmalı"ydı, "bu adıma ne ekleyelim" değil.
- Podoloji şablon isimlerinin klinik doğruluğu ("Podologische Erstbehandlung" vs Erstbefund/
  Befunderhebung) — bir podologla teyit edilmeli.
- deger-mi'nin ölçüm tetiği: 3 aktif müşteri onboarding'i bitirdikten sonra bu adımdan gelen
  ortalama private hizmet sayısına bak. **0 ise** adımı tamamen kaldır (Seçenek A) —
  bu kararın yeniden değerlendirme tetiğidir.

## Sert veto varsa

Yok. gkv-302 sert veto kullanmadı; koyduğu şart ("onboarding `gkv_position_nr IS NOT NULL`
satırı ne siler ne yazar") karara aynen alındı.
