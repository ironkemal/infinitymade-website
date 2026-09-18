# Konsey Kararı — On-Prem Şema Reformu: Multi-Tenant Desen (owner_id/business_id/RLS)
Tarih: 2026-09-18 · Oturan üyeler: muhalif, deger-mi, fonksiyon-ustasi, db-ustasi, onprem, guvenlik, gkv-302, podoloji

## KARAR

Multi-tenant desen (`owner_id`/`business_id`/RLS) on-prem için **sadeleştirilmiyor, kaldırılmıyor** — SaaS'ta da on-prem'de de mevcut haliyle kalır. Bunun yerine iki ayrı, düşük riskli adım:

1. **Okunabilirlik sorunu dokümanla çözülür, şemayla değil.** `db/REGISTER.md`'ye kısa bir "kolon anlamı" notu eklenir: `owner_id` = kiracı ekseni — SaaS'ta müşteri ayrımı, on-prem'de employee↔owner bağı, **her iki dağıtımda da aktif, sökülemez**. `business_id` = praxis-içi Standort ekseni — RLS'te izolasyon **sağlamıyor** (yalnız uygulama katmanında yumuşak filtre, `bizScope()`), kaldırılacak fazlalık değil, tam tersi zaten yarım kurulu bir eksen.
2. **Gerçekten ölü, dört kaynaktan doğrulanmış** 5 tablo (`accommodations`, `applications`, `trip_history`, `trip_plans`, `user_credits`) ve 5 kolon (`whatsapp_waba_id`, `whatsapp_phone_number_id`, `whatsapp_access_token_secret_id`, `has_dta_pro`, `dta_pro_subscription_item_id`) yeni bir migration ile silinir (mevcut zincirin üstüne, `0026...`) — ama **bu hafta değil**, açık Katman 3/4 işi (Verordnung/Podologie-Abrechnung) bittikten sonra, normal `db-ustasi` işi olarak.

## Gerekçe

8 üyeden 7'si bağımsız ölçümle aynı sonuca vardı: `owner_id`, tek-kiracılı on-prem kutusunda bile employee↔owner ayrımını taşıyan aktif eksen (RLS'in ~%95'i, 172 policy'nin 115'i, 699 kod referansı, `profiles.owner_id` üzerinden `COALESCE` tanımı) — sökülemez. `business_id` ise zaten hiçbir yerde kiracı sınırı sağlamıyor (yalnız 4 tabloda 7 policy'de geçiyor, gerçek izolasyon değil, sadece index/yumuşak filtre) — yani "fazlalık gibi duran" şey aslında korunmak istenen Standort ekseninin ta kendisi, yarım kurulu. `gkv-302`'nin "business_id §302 zincirinde (abrechnung/prescriptions/terapeut_zertifikat) kalmalı" şartı bu kararla zaten sağlanıyor — o tablolardaki hiçbir kolona dokunulmuyor.

## Ödün verilenler

Kemal'in "tabloya bakınca ne olduğunu hemen anlama" isteği şemadan değil dokümandan karşılanıyor — bir tabloyu doğrudan Supabase Studio'da açtığında `owner_id`/`business_id` hâlâ isimden anlaşılmayacak, `db/REGISTER.md`'ye bakmak gerekecek. Gerçek dağınıklık (5 ölü tablo, 5 ölü kolon) bu turda silinmiyor, ayrı zamanlı bir işe kalıyor — yani "temiz" his bu turda gelmiyor.

## Uzlaşma

7/8 üye A yönünde (podoloji, fonksiyon-ustasi, db-ustasi, onprem, guvenlik, muhalif, deger-mi). `gkv-302` farklı bir harf (B) işaretledi ama savunduğu içerik — business_id §302 tablolarında dokunulmasın, sadeleşecekse owner_id sadeleşsin — üç bağımsız ölçümle (fonksiyon-ustasi, db-ustasi, onprem) çürütüldü: owner_id de sökülemez, çünkü aynı eksen employee↔owner bağını taşıyor. Eylem düzeyinde (KARAR'ın ne yaptığı) gerçek bir anlaşmazlık yok — gkv-302'nin talebi zaten sağlanıyor.

## Anlaşmazlık

`gkv-302`'nin etiketiyle (B) diğer 6 üyenin etiketi (A) arasındaki görünen çelişki, chairman tarafından kör nokta turu açılmadan, doğrudan çelişen sayısal bulgularla çözüldü (fonksiyon-ustasi'nin 699 referans + db-ustasi'nin 172 policy ölçümü + onprem'in 86 `auth.uid()` policy sayımı, hepsi owner_id'nin employee↔owner bağı için de aktif olduğunu gösteriyor). Maliyet disiplini gereği ayrı bir tur açılmadı; gerekçe burada şeffaf yazılı.

## Kör noktalar

- **Chairman'ın kendi çerçevelemesi hatalıydı.** İki üye (muhalif, onprem) bağımsız olarak "baseline henüz dondurulmadı, bedelsiz pencere" iddiasının **yanlış** olduğunu buldu: `api-backend/db/migrations/0000_baseline.sql` zaten var, üstünde 0001-0025 migration koşuyor, uygulanmış dosyalar SHA-256 ile kilitli. Bedelsiz pencere **10.09.2026'da kapandı** — kullanıcıya önceki turda verilen "şimdi bedava, sonra pahalı" bilgisi düzeltilmesi gerekiyor.
- `db-ustasi` sorulmayan ama bulunan bir şey getirdi: **15 tabloda 19 RLS policy'si tamamen açık (`true`/`true`)** — bu konudan bağımsız, muhtemelen daha acil bir güvenlik konusu (bkz. Backlog).

## Uygulama — builder'a

- [ ] `db/REGISTER.md`'ye owner_id/business_id semantik notu eklensin (owner_id=kiracı ekseni, sökülemez; business_id=Standort ekseni, RLS'te izolasyon sağlamıyor) — karmaşıklık: K0
- [ ] (ertelenebilir, bu hafta değil) Yeni migration: 5 ölü tablo + 5 ölü kolon DROP, öncesinde db-ustasi dört-kaynak doğrulamasını tazeler, sonrasında guvenlik'in istediği GRANT/ACL karşılaştırması yapılır — karmaşıklık: K1
- [x] onprem bu kararı kendi sicline işledi — `onprem/REGISTER.md` **O-111** (O-100 değil; ajanın konsey turundaki numarası sözlüksel sıralama hatasıydı, düzeltildi) — karmaşıklık: K0

## Backlog (karara dahil DEĞİL)

- **guvenlik'in bulduğu 19 tamamen açık (`true`/`true`) RLS policy'si, 15 tablo** — bu konudan bağımsız, ayrı görevlendirme gerekir, muhtemelen bu karardan daha acil.
- guvenlik'in genel şartı: bundan sonraki herhangi bir DROP migration'ı sonrası GRANT/ACL karşılaştırması standart adım olsun (S-03/S-04 emsali — DROP+CREATE EXECUTE/GRANT'i PUBLIC'e sıfırlıyor).

## Sert veto varsa

Yok. `gkv-302` ve `legal-de`'den (oturmadı) hiçbiri ⛔ vermedi. `guvenlik`'in vetosu yalnız "RLS'in kendisinin kaldırılması" senaryosuna bağlıydı — KARAR bunu yapmıyor, RLS'e dokunulmuyor.
