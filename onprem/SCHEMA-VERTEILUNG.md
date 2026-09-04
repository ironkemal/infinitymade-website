# ŞEMA DAĞITIM ZİNCİRİ — gereksinim, seçenekler, tavsiye

> **Bu dosya nedir:** `onprem/REGISTER.md` → **O-39**'un çözüm belgesi. Bugün müşterinin
> kutusundaki Postgres'e bir kolon eklemenin yolu yok; kod dağıtımı çözülmüş (K11 +
> Watchtower), şema dağıtımı çözülmemiş. Bu dosya o boşluğu tarif eder, seçenekleri
> tartar ve **tek bir tavsiye** verir.
>
> **Bu dosya kod değildir.** Aracı `builder` yazar. Burada yazan şey: ne yapması gerektiği,
> hangi tuzağa basmaması gerektiği, hangi kararın önce kullanıcıya sorulacağı.
>
> **Sahibi:** `onprem` ajanı · **Yazıldı:** 2026-09-04 · **Girdi:** `ONPREM_MIGRATION_PLAYBOOK.md`
> (K1-K14, G1-G8, §10 Faz 0 PoC notları) · `onprem/REGISTER.md` · `db/README.md` ·
> `db/SCHEMA.sql` · `db/SCHEMA-RLS.sql` · `onprem/schema/live_schema_2026-07-06.sql` ·
> `onprem/supabase-docker/volumes/db/*`
>
> **Depo public:** bu dosyada sır, anahtar, bağlantı dizesi, hasta verisi yoktur ve olmayacaktır.

---

## 0. Bir sayfada özet

| Soru | Cevap |
|---|---|
| **Bugün ne var?** | Elle uygulanan migration'lar. Repo'daki `supabase/migrations/` **14 dosya**, canlıda **227** kayıt (04.09.2026'da MCP ile sayıldı; belgenin gerisinde geçen 195 rakamı `CLAUDE.md`'den gelen bayat değerdir — bkz. §10). Çalıştırılabilir tek şema dosyası `onprem/schema/live_schema_2026-07-06.sql` — **2 ay bayat** (71 tablo, bugün 83) |
| **`db/SCHEMA.sql` kullanılabilir mi?** | **Hayır.** Kolonlar arasında virgül yok, `SCHEMA-RLS.sql` ise tamamen yorum satırı. İkisi de **belgedir**, çalıştırılabilir değildir (bilinçli — insan okusun diye). Bkz. §1.2 |
| **Public dump ne kaçırıyor?** | **9 kalem** — extension'lar (sıra dahil), `auth.users` trigger'ı, storage bucket'ları + policy'leri, realtime publication üyeliği, roller/grant'lar, Vault secret'ları, sequence sahiplikleri, `auth` şeması ön koşulu, `db/` dökümünün formatı. Tam envanter: §2 |
| **Tavsiye** | **Kendi Node runner'ımız** (`api-backend/db/migrate.js`), advisory-lock'lu, ileri-yönlü, sıralı, atomik, hata olunca **durup** kurulum moduna geçen. Ek bağımlılık sıfır. Gerekçe: §8-§9 |
| **195-vs-14 kararı** | **Baseline.** Bugünkü canlı şemadan tek bir `0000_baseline.sql` üretilir, zincir bugünden başlar. Geçmiş 195 tarih olarak kalır, yeniden oynatılmaz. Gerekçe ve bedeli: §5 |
| **En büyük risk** | Zincir kurulduktan sonra birinin yine MCP'den elle migration uygulaması. Kapı olmadan bu kesin olur — §5.4 |

---

## 1. Bugünkü gerçek — sayılarla

### 1.1 Elimizde ne var

| Kaynak | Ne | Çalıştırılabilir mi | Güncel mi |
|---|---|---|---|
| Canlı DB (`njvuclullotbksskpwgk`) | 83 tablo · 1231 kolon · 158 RLS policy · 67 fonksiyon · 66 trigger · 301 index · 4 view (`db/SCHEMA.sql` başlığından, 2026-09-04) | — | ★ **otorite** |
| `db/SCHEMA.sql` (2.081 satır) | Tablo/kolon/constraint **belgesi** | ❌ hayır (§1.2) | ✅ 2026-09-04 |
| `db/SCHEMA-RLS.sql` (961 satır) | Policy/fonksiyon/trigger/index **belgesi** | ❌ hayır (§1.2) | ✅ 2026-09-04 |
| `onprem/schema/live_schema_2026-07-06.sql` (9.193 satır) | Gerçek `pg_dump --schema=public --schema-only` | ✅ evet | ❌ **2 ay bayat** (71 tablo) |
| `onprem/schema/reference_data_2026-07-06.sql` (14.359 satır) | Referans verisi (`icd10_titles` 13.041 · `heilmittel_tarif` 928 · `krankenkassen` 94 · `dta_schluessel` 94) | ✅ evet | ⚠️ tazelenmeli (O-38) |
| `supabase/migrations/` (14 dosya) | Elle yazılmış migration dosyaları | ✅ evet, tek tek | ❌ zincir değil (§1.3) |
| `onprem/supabase-docker/volumes/db/*.sql` | Upstream Supabase init (roller, JWT, realtime, webhooks) | ✅ evet | vendor kopyası |

### 1.2 ⚠️ `db/SCHEMA.sql` ve `SCHEMA-RLS.sql` kurulum için **kullanılamaz**

Bu, bu turun en kolay yapılacak hatasıydı; kayda geçiyor ki bir daha denenmesin.

`db/SCHEMA.sql:118-127` — kolonlar arasında **virgül yok**:

```
CREATE TABLE accommodations (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  user_id uuid
  name text NOT NULL
);
```

`db/SCHEMA-RLS.sql:109-112` — policy'ler **tamamen yorum satırı**:

```
-- abrechnung
--   abrechnung_owner_all [ALL]
--     USING (auth.uid() = owner_id OR ...)
```

İkisi de bilinçli olarak insan-okunur formatta. `db/README.md` bunu zaten söylüyor
("**Momentaufnahme**, keine Leitung"). Yani şema gerçeğinin **içeriği** `db/` altında,
**çalıştırılabilir hâli hiçbir yerde yok.**

### 1.3 `supabase/migrations/` bir zincir değil — sürüm adları bile tutmuyor

14 dosya var, canlıda 195 kayıt. Ama asıl sorun sayı farkı değil; **eşleşmeyen sürüm
adları.** `db/SCHEMA.sql` başlığındaki canlı migration listesiyle repo dosya adları
karşılaştırıldığında:

| Durum | Adet | Örnek |
|---|---|---|
| Repo dosyası = canlı sürüm adı (birebir) | **3** | `20260814101707_patient_consents` · `20260814101624_kiosk_pin_hardening` · `20260814083941_fussbefund_termin_legende` |
| Aynı iş, **farklı** sürüm adı | **3** | repo `20260831120000_zuzahlung_korrektur` ↔ canlı `20260901093310_zuzahlung_korrektur` |
| Repo'da var, canlı listede adı geçmiyor | **1** | `20260902090000_services_kostentraeger_typ` (doğrulanmalı) |
| Repo'da var, canlıda adsız uygulanmış (MCP) | **7** | `20260713000000_ausfallgebuehr.sql:2` kendi kendine yazıyor: *"Applied to live DB via MCP (migration name: ausfallgebuehr)"* |
| Canlıda var, repo'da **hiç yok** | **≥20** | son 2 gündekiler dahil: `verordnungstopf_faz1…faz5c`, `bookings_verordnung_id_podologie_termin_bindung`, `booking_leistungen`, `invoices_ust_nummernkreis_gobd`, `tighten_avatars_storage_policies` (12.08. — **storage** migration'ı!) |

**Sonuç:** `supabase_migrations.schema_migrations` tablosu bir defter değil, bir kayıt
tutanağı. Hiçbir standart migration aracı bu tabloyu doğru okuyamaz — dosya adı ile
sürüm dizesi eşleşmediği için ya her şeyi yeniden oynatır ya da hepsini atlar.
**Bu boşluk kapanmadan on-prem migration zinciri kurulamaz** (G7: iki şema gerçeği olur).

Drift bugün de sürüyor: en yeni 12 migration (03-04.09, Verordnung havuzu birleştirmesi)
repoya **hiç girmedi**.

---

## 2. ★ Public dump'ın DIŞINDA kalanlar — envanter

> **Bu bölüm bu turun asıl işi.** PoC tek bir örneği gösterdi (`handle_new_user`), ama
> aynı tuzağa düşen **dokuz kalem** var. Hepsi `pg_dump --schema=public --schema-only`
> çıktısının dışında; hiçbiri `db/SCHEMA.sql`'de çalıştırılabilir hâlde değil.
>
> Yöntem: `onprem/schema/live_schema_2026-07-06.sql` (gerçek pg_dump) taranarak, dump'ın
> **çağırdığı ama yaratmadığı** her obje çıkarıldı. Emin olunamayan kalemler
> **`doğrulanmalı`** işaretli — tahminle doldurulmadı.

### V-1 — Extension'lar: dump hiçbirini yaratmıyor, altısını **kullanıyor**

`grep "CREATE EXTENSION" onprem/schema/live_schema_2026-07-06.sql` → **0 sonuç.**
Ama dump şunları çağırıyor:

| Extension | Kanıt (dosya:satır) | Hangi şemada | Kim kurar |
|---|---|---|---|
| **postgis** | `:1278` `:2272` `:2611` → `location public.geography(Point,4326)` · `:1099` `:1118` → `ST_SetSRID`/`ST_MakePoint` | **`public`** ⚠️ | biz (install) |
| **pg_trgm** | `:4006` `:4013` → `USING gin (code public.gin_trgm_ops)` | **`public`** ⚠️ | biz (install) |
| **btree_gist** | `:3633` → `EXCLUDE USING gist (user_id WITH =, tstzrange(...) WITH &&)` — uuid eşitlik operatörü gist'te btree_gist olmadan **yok** | `doğrulanmalı` | biz (install) |
| **uuid-ossp** | `:1506` `:1625` `:1704` `:1943` `:2741` `:2814` `:3025` → `DEFAULT extensions.uuid_generate_v4()` | `extensions` | biz (install) |
| **supabase_vault** (+ `pgsodium`) | `:167` `:303` `:309` `:333` `:598` `:772` `:791` `:813` `:818` `:1004` `:1006` → `vault.create_secret`, `vault.decrypted_secrets`, `vault.secrets` | `vault` | Supabase image (PoC 0.2'de doğrulandı, §9-A4 çözüldü) |
| **pg_net** | `:711-729` → `net.http_post` (tek kullanım: `notify_feedback_telegram`) | `extensions` | upstream `webhooks.sql:3` kurar |

**Tuzak 1 — kurulum sırası.** Playbook §10'da yazılı: `DROP SCHEMA public CASCADE`
postgis'i **de siler**, çünkü postgis `public` şemasında. Aynı şey `pg_trgm` için de
geçerli (`public.gin_trgm_ops`). Yani `public` şemasını temizleyen her adım iki
extension'ı beraberinde götürür. Doğru sıra §3'te.

**Tuzak 2 — `spatial_ref_sys`.** `db/SCHEMA.sql:1761` bu tabloyu listeliyor, ama gerçek
pg_dump'ta **yok** (extension'a ait tablolar dump'a girmez, doğru davranış). `db/SCHEMA.sql`'e
bakıp "bu tabloyu da yaratayım" denirse postgis kurulumuyla çakışır.

**Tuzak 3 — `pg_net` gidiyor.** O-21 / Faz 1.6 `notify_feedback_telegram` trigger'ını
kaldırıyor. Sonrasında bizim şemamız pg_net'e hiç dokunmaz (upstream yine kurar, zararsız).
Kutuda dışarı çıkışı olan tek DB objesi buydu.

**`doğrulanmalı`:** `btree_gist`'in canlıda hangi şemada kurulu olduğu · `pgcrypto`'nun
bizim kodumuzca kullanılıp kullanılmadığı (dump'ta `crypt(` / `digest(` / `pgp_sym`
→ **0 sonuç**, yani muhtemelen yalnız Vault'un iç ihtiyacı) · `pg_stat_statements`,
`pg_graphql`, `pgjwt` gibi Supabase varsayılanlarının bizim şemamızca kullanılmadığı.

### V-2 — `auth` şeması **ön koşul**, dump onu yaratmıyor ama her tabloda ona FK veriyor

`grep "REFERENCES auth.users"` → dump boyunca onlarca satır (`:5297` `:5313` `:5329`
`:5337` …). Yani public dump, `auth.users` tablosu **var olmadan** yüklenemez.

Sonuç, kurulum sırasını zorunlu kılıyor: Supabase stack ayağa kalkar → GoTrue kendi `auth`
şemasını migrate eder → **ancak ondan sonra** bizim şemamız yüklenir. Bu, "önce şemayı
yükle sonra servisleri başlat" tarzı her kurulum script'ini kırar.

### V-3 — `handle_new_user` trigger'ı `auth.users` üzerinde — PoC'nin ısırdığı yer

- Fonksiyon `public.handle_new_user()` **dump'ta var** (`db/SCHEMA-RLS.sql:510`).
- Trigger `on_auth_user_created ON auth.users` **dump'ta yok** — `auth` şemasında.

PoC 0.3 notu (playbook §10): *"signup → handle_new_user trigger'ı profil oluşturdu (trigger
auth şemasında, public dump'a girmez — kurulumda ayrıca CREATE edilmeli!)"*

Bu tek trigger olmadan: kullanıcı kaydolur, `auth.users` satırı oluşur, `profiles` satırı
**oluşmaz** → uygulama giriş sonrası boş açılır. Sessiz ve teşhisi zor.

**`doğrulanmalı`:** `auth` şemasında **başka** trigger/policy var mı. Bilinen tek girişimiz
bu; ama `db/SCHEMA-RLS.sql` yalnız `public`'i belgelediği için canlı DB'ye şu sorulmalı:

```
SELECT n.nspname, c.relname, t.tgname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('auth','storage','realtime') AND NOT t.tgisinternal;
```

Aynı soru policy'ler için `pg_policies` üzerinden de sorulmalı.

### V-4 — Storage: 5 bucket + `storage.objects` policy'leri, hiçbiri dump'ta yok

`grep "storage\." onprem/schema/live_schema_2026-07-06.sql` → **0 sonuç.**
`db/SCHEMA-RLS.sql:63-73` bunu açıkça yazıyor: *"NICHT ENTHALTEN: storage.objects-Policies"*.

| Bucket | Görünürlük | İçerik | Klasör deseni |
|---|---|---|---|
| `avatars` | public | çalışan fotoğrafı + praxis logosu | `<profile_id>/…` |
| `prescriptions` | privat | reçete görüntüleri (**PHI**) | `owner_id` |
| `patient-documents` | privat | hasta belgeleri + `patient_consents` imzaları (**PHI**) | `owner_id` |
| `abrechnungen` | privat, salt-okunur | §302 DTA + Begleitzettel | `owner_id` |
| `referrals` | privat | Überweisung ekleri | `doğrulanmalı` |

Koddaki kanıt: `dashboard.js:11269` `:12523` (avatars) · `dashboard.js:8565` (patient-documents) ·
`dashboard.js:19992` + `api-backend/billing/api/abrechnung.routes.js:665` `:723` `:862` `:2387`
(abrechnungen) · `module/patienten-einwilligung.js:47` (`patient-documents` — imza için yeni
bucket **açılmadı**, doğru karar).

Bucket'lar yoksa: reçete yüklenemez, DTA dosyası kaydedilemez, imza görünmez. Policy'ler
yoksa daha kötüsü: bucket açık kalır → mandant sınırı yok → müşterinin kutusunda tek tenant
olduğu için fark edilmez, ama **SaaS'ta felaket** (G7: aynı zincir orada da çalışacak).

⚠️ Canlıda 12.08.2026'da `tighten_avatars_storage_policies` adlı bir migration çalıştı
(`db/SCHEMA-RLS.sql` başlığında yazılı) — **repoda yok.** Yani bugün storage policy'lerinin
doğru hâlini yalnızca canlı DB biliyor.

### V-5 — Realtime publication üyeliği

`grep "PUBLICATION" onprem/schema/live_schema_2026-07-06.sql` → **0 sonuç.**

PoC 0.1 notu (playbook §10): *"realtime publication bookings eklendi"* — yani elle.
Gereken adım: `ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;`
(`supabase_realtime` publication'ını upstream realtime migration'ı yaratır;
`onprem/supabase-docker/volumes/db/realtime.sql` yalnız `_realtime` şemasını açar.)

Bu satır olmadan takvim canlı güncellenmez: `refreshBookingViews()` akışı ölür ama uygulama
açılır — yine **sessiz** kırılma, en pahalı tür.

**`doğrulanmalı`:** canlıda publication üyesi gerçekten yalnız `bookings` mi (playbook D9
"beklenen" diyor, PoC doğruladı — ama 2 ay geçti):
`SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';`

### V-6 — Roller ve grant'lar

Dump'ta `CREATE ROLE` **yok**, ama **344 `GRANT`** satırı ve 24 `ALTER DEFAULT PRIVILEGES`
satırı var (`:9132-9185`) — hepsi `anon`, `authenticated`, `service_role`, `postgres`,
`supabase_admin` rollerini var kabul ediyor.

İyi haber: bu rolleri upstream stack kuruyor (`onprem/supabase-docker/volumes/db/roles.sql`
+ Postgres image'ının kendi init'i). Kendi rol yönetimimizi yazmıyoruz — **ama sıra yine
önemli**: roller yoksa dump'ın son ~350 satırı hata verir ve o hata şema yüklendikten
**sonra** gelir, yani yarım kurulum.

`ALTER DEFAULT PRIVILEGES … FOR ROLE postgres` / `FOR ROLE supabase_admin` satırlarının
self-host'ta sorunsuz geçtiği PoC 0.1'de dolaylı doğrulandı (71=71 tablo paritesi);
yine de `doğrulanmalı`.

### V-7 — Vault secret'ları: şema gelir, **içerik gelmez** (ve gelmemeli)

`vault.secrets` / `vault.decrypted_secrets` extension'a ait; dump onları taşımaz. Bugün
canlıda 8 secret var (playbook D6). Kutuda ne olmalı:

- **Temiz kurulumda:** boş. Doğru davranış — kutunun kendi secret'ları sihirbazda oluşur.
- **SaaS'tan taşınan tenant'ta:** Faz 5.1 kuralı geçerli — *düz metin export ETME, hedefte
  yeniden şifrele*. Bu, şema dağıtımının değil **veri migration'ının** işi; buraya yalnız
  sınır çizgisi olarak yazıldı.

Bugün tek canlı Vault kullanımı `pending_signups.password_secret_id` (merkez tarafı, O-17)
+ Gmail token'ları (O-08, on-prem v1'de kapalı). Yani kutuda Vault **kurulu ama neredeyse
boş** olacak.

### V-8 — Sequence'ler ve sahiplikleri

Dump'ta 5 `CREATE SEQUENCE` + 10 `OWNED BY` var — yani `public` içindeki sequence'ler dump'a
**giriyor**. Sorun sequence'lerin kendisi değil, **`setval` durumu**: şema dump'ı sequence'i
sıfırdan yaratır. Temiz kurulumda doğru; **veri geri yüklemesinde** (§7) `--schema-only` +
ayrı veri yüklemesi yapılırsa sequence'ler geride kalır ve ilk insert'te PK çakışması olur.

⚠️ Bizde numara üretiminin çoğu sequence değil **`nummernkreise` tablosu** üzerinden
(`naechste_nummer(owner, kreis, jahr)` — `db/README.md` tuzak 6). O tablo normal veri
olduğu için normal yedeğe girer; iyi haber, ama iki farklı mekanizmanın var olduğunun
bilinmesi şart.

### V-9 — Fonksiyonların `search_path`'i

Dump'ta 46 `SET search_path` satırı ve 20 `SECURITY DEFINER` fonksiyon var — bunlar `public`
içinde, yani dump'a **giriyor**. Kayda geçiyor ki "acaba bu da mı kayıp" sorusu ikinci kez
sorulmasın: **kayıp değil.**

Ama bağlı bir tuzak var: `SET search_path = public, extensions` gibi bir tanım, kutuda
extension'lar başka şemadaysa sessizce yanlış çalışır.
`supabase/migrations/20260901093500_zuzahlung_korrektur_search_path_haerten.sql` zaten bu
sınıftan bir düzeltme. Runner'ın ilk işi, extension'ları canlıdakiyle **aynı** şemaya
kurmak olmalı (§3).

### Envanter özeti

| # | Kalem | Public dump'ta | Kim sağlayacak | Kanıt |
|---|---|---|---|---|
| V-1 | 6 extension (postgis · pg_trgm · btree_gist · uuid-ossp · vault · pg_net) | ❌ | install adımı — 2'si `public` şemasında (sıra tuzağı) | `:1278` `:4006` `:3633` `:1506` `:167` `:711` |
| V-2 | `auth` şeması ön koşulu (FK hedefi) | ❌ | GoTrue, şemadan **önce** | `:5297` vd. |
| V-3 | `on_auth_user_created` trigger'ı | ❌ | install adımı | PoC 0.3 |
| V-4 | 5 storage bucket + `storage.objects` policy'leri | ❌ | install adımı | `SCHEMA-RLS.sql:63-73` |
| V-5 | `supabase_realtime` publication üyeliği (`bookings`) | ❌ | install adımı | PoC 0.1 |
| V-6 | Roller (`anon` / `authenticated` / `service_role`) | ❌ (grant'lar var) | upstream stack | `:9132-9185`, `roles.sql` |
| V-7 | Vault secret **içeriği** | ❌ | sihirbaz / veri migration'ı | D6 |
| V-8 | Sequence `setval` durumu | kısmen | yedek/geri-yükleme yolu (§7) | 5× `CREATE SEQUENCE` |
| V-9 | Fonksiyon `search_path`'leri | ✅ var | — (ama extension şeması eşleşmeli) | 46 satır |

---

## 3. Soru 1 — temiz kutuya ilk kurulum

**Hedef:** boş bir Ubuntu makinede `docker compose up` sonrası, insan müdahalesi olmadan,
83 tablo + 158 policy + 67 fonksiyon + 66 trigger + 301 index + 4 view + §2'deki dokuz
kalem **eksiksiz** ayakta.

### 3.1 Zorunlu sıra

Sıra tartışmaya açık değil — her adımın bir öncekine somut bağımlılığı var (§2).

| # | Adım | Niye burada | Kaynak |
|---|---|---|---|
| 1 | Postgres ayağa kalkar, upstream init çalışır | roller (`anon`/`authenticated`/`service_role`), JWT, `_realtime`, `supabase_functions` + `pg_net` | `onprem/supabase-docker/volumes/db/{roles,jwt,realtime,webhooks}.sql` |
| 2 | GoTrue / Storage / Realtime servisleri kendi şemalarını migrate eder | **V-2:** `auth.users` olmadan bizim şemamız yüklenemez | upstream imajlar |
| 3 | **Extension'lar** — `postgis`, `pg_trgm` → `public`; `uuid-ossp` → `extensions`; `btree_gist` → (`doğrulanmalı`) | **V-1.** Şemadan önce; `public`'e kuruluyorlar ve `public`'i temizleyen her adım onları da siler | `db/migrations/0000_baseline.sql`'in başı ya da ayrı `0000a_extensions.sql` |
| 4 | **Baseline şema** — `public` içindeki her şey | asıl yük | `0000_baseline.sql` (§5.2) |
| 5 | **`auth.users` trigger'ı** — `on_auth_user_created` | **V-3.** `public.handle_new_user()` 4. adımda geldi, trigger burada bağlanır | baseline'ın sonu |
| 6 | **Storage bucket'ları + `storage.objects` policy'leri** — 5 bucket | **V-4** | baseline'ın sonu |
| 7 | **Realtime publication** — `ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings` | **V-5** | baseline'ın sonu |
| 8 | **Referans verisi (seed)** — `icd10_titles` (13.041) · `heilmittel_tarif` (928) · `krankenkassen` (94) · `dta_schluessel` (94) · `heilmittel_katalog` · `diagnosegruppen` · `icd_sector_ranges` · `kostentraeger` · `heilmittel_position` | O-38. Tenant verisi **değil**, image'la gelir; kutu dış kaynağa çıkmaz (O-34 deseni) | `db/seed/*.sql` |
| 9 | `NOTIFY pgrst, 'reload schema'` | PostgREST şema cache'i; PoC 0.1'de gerekliydi | runner'ın son adımı |
| 10 | Sonraki migration'lar (varsa) sırayla | §4 | `db/migrations/00NN_*.sql` |
| 11 | **Self-check** → sonuç panelde | §3.3 | runner |

⚠️ 3. adımın **öncesinde** `DROP SCHEMA public CASCADE` yapılmaz. PoC'de tam bu yüzden
postgis kayboldu (playbook §10). Temiz kurulumda zaten gerek yok; runner "boş DB" varsayar
ve boş değilse durur.

### 3.2 Baseline nasıl üretilir

`db/SCHEMA.sql` **kullanılamaz** (§1.2). Üretim yolu tek: canlı DB'den gerçek `pg_dump`.

```
pg_dump --schema-only --no-owner --no-privileges \
        --schema=public  > 0000_baseline_public.sql
```

…ve buna elle **eklenir**: extension'lar (V-1) · `auth.users` trigger'ı (V-3) · bucket'lar
ve storage policy'leri (V-4) · publication satırı (V-5).

Bu ek kısımlar **elle yazılmaz, canlıdan çekilir**:
- storage bucket'ları: `SELECT * FROM storage.buckets`
- storage policy'leri: `SELECT * FROM pg_policies WHERE schemaname = 'storage'`
- publication: `SELECT * FROM pg_publication_tables`
- `auth` trigger'ları: §2 V-3'teki sorgu
- extension'lar ve şemaları: `SELECT extname, extnamespace::regnamespace FROM pg_extension`

Bu beş sorgu bir kere çalıştırılır, çıktısı baseline'ın sonuna eklenir, **ve tekrar
üretilebilir olması için `tools/schema-dump.mjs`'e yazılır** — yoksa altı ay sonra baseline
yenilenirken aynı beş şey tekrar unutulur. (Bu, "şema güncelle" tetikleyicisinin doğal
uzantısı — bkz. §5.4.)

### 3.3 Kurulum sonrası self-check — sayarak, varsayarak değil

PoC 0.1'in yaptığı paritenin otomatik hâli. Runner kurulum sonunda şunları sayar ve
beklenen değerle karşılaştırır (beklenen değerler baseline üretilirken dosyaya yazılır):

| Sayaç | Bugünkü beklenen |
|---|---|
| `public` tablo sayısı | 83 |
| RLS policy sayısı (`public`) | 158 |
| Fonksiyon sayısı (`public`, extension'a ait olmayan) | 67 |
| Trigger sayısı | 66 |
| Index sayısı | 301 |
| RLS **kapalı** tablo sayısı | 1 (`spatial_ref_sys`) |
| `auth` şemasında bizim trigger | 1 (`on_auth_user_created`) |
| storage bucket | 5 |
| publication üyesi tablo | 1 (`bookings`) |
| `icd10_titles` satır | 13.041 |

Bir sayı tutmazsa: kurulum **başarısız** sayılır, kutu kurulum modunda kalır, panelde hangi
sayının tutmadığı yazar. "Uygulama açılsın, eksik kalanı sonra bakarız" **yok** — eksik
policy sessizce mandant sınırı deler.

> Bu tablo O-39'un kabul kriteridir. Sayılar `db/SCHEMA.sql` başlığından gelir ve **her
> baseline yenilemesinde** birlikte güncellenir.

---

## 4. Soru 2 — sonraki değişiklikler kutuya nasıl varacak

### 4.1 Nereden gelir: **image'ın içinden**

Migration dosyaları `db/migrations/` altında repoda yaşar ve `api-backend/Dockerfile`'ın
açık `COPY` listesine eklenir (O-35 disiplini korunur — `COPY . .` yok). Yani:

```
main'e commit → image build → :beta veya :stable tag'i → Watchtower çeker
→ container kalkar → runner migration'ları uygular
```

Kutu hiçbir şey **indirmez**. Bu tip B'dir (O-34 deseni), tip A değil. Kutunun bizim
sunucumuza migration sormasına gerek yok — migration zaten image'ın içinde geldi. G1 temiz.

**Alternatif reddedildi:** "migration'ları merkezden bir endpoint'ten çeksin" — kutu bizim
sunucumuza bağımlı hâle gelir, biz kapalıyken kutu güncellenemez, ve o kanal ileride veri
taşımaya açık bir kapı olur. Tip A'ya dönüştürme önerisi reddedilir.

### 4.2 Ne zaman çalışır: **api container'ının açılışında, uygulama dinlemeye başlamadan önce**

Ayrı bir init container **değil**. Gerekçe:

- Init container Watchtower ile birlikte çalışmıyor — Watchtower tek container'ı yeniler,
  init container'ı yeniden koşturmaz. Şema güncellemesi sessizce atlanır.
- Aynı zincir SaaS'ta da çalışacak (G7); orada da "api açılırken" en doğal nokta.
- Tek kişilik ekip: iki yerine bir çalışan parça.

Akış: `server.js` başlar → `await runMigrations()` → başarılıysa `app.listen()` →
başarısızsa **dinlemeye geçmez**, kurulum/bakım modunda kalır (§4.4).

### 4.3 Kim kilitler: Postgres advisory lock

İki instance aynı anda kalkarsa (bugün `pm2-runtime` **2 instance** çalıştırıyor —
`CLAUDE.md`, ve Watchtower yenilerken eski/yeni bir an üst üste biner) ikisi de aynı
migration'ı uygulamaya kalkar.

Çözüm, ek bağımlılık olmadan, Postgres'in kendi aracıyla:

```
SELECT pg_advisory_lock(<sabit bigint>);   -- tek kişi girer, diğerleri bekler
...migration'lar...
SELECT pg_advisory_unlock(<sabit bigint>);
```

Kilit bağlantı ömrüne bağlıdır: süreç ölürse Postgres kilidi kendiliğinden bırakır — yani
"kilitte kalmış migration" diye bir durum oluşmaz. Bekleyen instance kilidi alınca defteri
okur, uygulanacak bir şey kalmadığını görür ve devam eder.

**Zaman aşımı şart:** `lock_timeout` (örn. 60 sn) — sonsuza kadar bekleyen container,
healthcheck'i de asar.

### 4.4 Başarısızlıkta ne olur: **dur, yarım bırakma, panelde göster**

Üç kural:

1. **Her migration tek transaction.** Hata → o dosya tamamen geri alınır. Yarım uygulanmış
   dosya yok. (İstisna: `CREATE INDEX CONCURRENTLY` transaction içinde çalışmaz — böyle bir
   ihtiyaç çıkarsa dosyaya `-- no-transaction` işareti konur ve **o dosya idempotent**
   yazılır. Bugün böyle bir migration'ımız yok.)
2. **İlk hatada dur.** Sonraki dosyalar denenmez. Sıra bozulmaz.
3. **Uygulama açılmaz, kurulum modunda kalır.** Panelde: hangi dosya, hangi Postgres hata
   kodu, hangi satır, ve "Diagnose-Paket indir" butonu (K10 — bizim erişimimiz yok, teşhisi
   müşteri gönderir).

⛔ **"Hata varsa atla ve devam et" seçeneği yok.** Yarım şema, çalışan ama yanlış veri
yazan bir uygulamadan daha ucuzdur.

⚠️ **Crash-loop yasak.** O-28'in dersi: `process.exit(1)` + Watchtower = 60 saniyede bir
yeniden başlayan, müşterinin hiçbir şey göremediği bir kutu. Migration hatasında süreç
**ölmez**; ayakta kalır, yalnız `/health` ve kurulum/hata sayfasını servis eder.

### 4.5 Defter: `praxura_migrations` tablosu — `supabase_migrations` **değil**

Kendi tablomuz, kendi şemamızda:

| Kolon | Ne için |
|---|---|
| `version` (PK) | dosya adının başındaki sıra numarası (`0001`, `0002`, …) |
| `name` | dosya adı |
| `checksum` | dosya içeriğinin SHA-256'sı |
| `applied_at` | zaman |
| `duration_ms` | yavaşlayan migration'ı görmek için |
| `app_version` | hangi image sürümü uyguladı (`:beta`/`:stable` ayrımında lazım) |

Niye `supabase_migrations.schema_migrations` kullanılmıyor: §1.3 — o tablodaki sürüm
dizeleri repo dosya adlarıyla eşleşmiyor ve tablo Supabase araçlarının malı. Ona yazmak
ileride Supabase CLI ile çakışır. **Kendi defterimiz kendi elimizde.**

**`checksum`'ın işi:** uygulanmış bir migration dosyası sonradan **değiştirilirse** runner
bunu görür ve durur. Bu, tek kişilik ekipte en kolay yapılan hatadır ("küçük bir düzeltme
yaparım") ve SaaS ile kutular arasında sessiz şema farkı yaratır. Uygulanmış dosya
**değiştirilmez**, yeni dosya yazılır.

### 4.6 İleri-yönlü, `down` yok

Migration'ın `down` adımı **yazılmaz**. Gerekçe:

- Tek kişilik ekip, 20 kutu, bizim erişimimiz yok (K10). Geri alma script'i yazılır ama
  hiç test edilmez; ihtiyaç anında da çalışmaz.
- Gerçek geri dönüş yolu **yedektir** (§7) — ve o zaten test edilmek zorunda (Faz 2.3).
- Yanlış giden şey için doğru cevap: **ileri doğru düzelten yeni migration**.

Bu, K11'in kod tarafındaki karşılığıyla da uyumlu: yanlış giden image için çözüm
`git revert` + yeni image, eski image'a el ile dönmek değil.
---

## 5. Soru 3 — SaaS ile TEK zincir (en kritik soru)

Bu bölüm çözülmezse geri kalanı boşa gider. İki şema gerçeği (biri canlıda, biri kutularda)
G7'nin doğrudan ihlali ve geçişin en pahalı hatası olur.

### 5.1 Karar: geçmiş **baseline** kabul edilir

**İki seçenek vardı:**

| | (a) 195'i yeniden inşa et | (b) **Baseline** (tavsiye) |
|---|---|---|
| Ne yapılır | Canlıdaki 195 migration'ın SQL'i tek tek çıkarılır, sıraya dizilir, repoya yazılır; zincir sıfırdan oynatılabilir olur | Bugünkü canlı şemadan tek `0000_baseline.sql` üretilir; zincir bugünden başlar |
| Bedeli | 195 migration'ın gövdesi `supabase_migrations.schema_migrations`'ta duruyor olabilir ama **sırası ve tekrar oynatılabilirliği** garanti değil. Kök `database_v*.sql` (39 dosya) zaten çakışan numaralarla dolu (v28/v29/v31 ikişer kez, v13/v14 yok — `CLAUDE.md`). Sıfırdan oynatma denemesi günler alır ve büyük ihtimalle **hiç yeşile dönmez** | Geçmişteki tek tek adımlar tarih olur. "Bu kolon niye eklendi" sorusu artık migration'dan değil `db/REGISTER.md` ve `fortschritte/`'den cevaplanır — **ki zaten oradan cevaplanıyor** |
| Kazancı | Teorik: her şema durumu yeniden üretilebilir | Bir günde bitiyor; kutu ile SaaS aynı noktadan başlıyor |
| Riski | Yüksek: 195 adımın hiçbiri kutuda test edilmedi, çoğu ölü tabloları yaratıp sonra düşürüyor | Düşük: baseline canlının **birebir fotoğrafı**, PoC 0.1 bu yolun çalıştığını zaten kanıtladı (71=71 tablo, 136=136 policy, sıfır hata) |

**Karar: (b).** Gerekçe tek cümlede: *baseline yolunun doğruluğu PoC'de ölçüldü, 195'i
yeniden inşa etmenin doğruluğu ise hiç ölçülmedi ve ölçmenin maliyeti tek kişilik ekipte
haftalarla ifade edilir.*

**Baseline'ın kaybettirdiği tek şey, kaybetmediğimiz şey:** "geçmişte şu tarihte şema neydi"
sorusu. O soru bize hiç sorulmadı; sorulursa cevabı `onprem/schema/live_schema_2026-07-06.sql`
(Temmuz fotoğrafı) ve git geçmişindeki `db/SCHEMA.sql` sürümleri.

### 5.2 Somut plan

```
db/
├── migrations/
│   ├── 0000_baseline.sql        ← canlıdan pg_dump + §2'nin dokuz kalemi (§3.2)
│   ├── 0001_<ad>.sql            ← bugünden sonraki her şema değişikliği
│   └── ...
├── seed/                         ← referans verisi (O-38), migration değil
└── SCHEMA.sql / SCHEMA-RLS.sql   ← belge olarak KALIR (§1.2), üretilmeye devam eder
```

- Numaralandırma **dört haneli sıra** (`0001`, `0002`), zaman damgası değil. Tek kişilik
  ekipte paralel dal yok (proje kuralı: doğrudan `main`), yani çakışma riski yok; sıra
  numarası okunması ve sıralanması daha kolay.
- **Canlıya uygulama:** ilk kez baseline uygulanmaz — canlı zaten o durumda. Bunun yerine
  canlıya tek satır yazılır: `INSERT INTO praxura_migrations (version, name, checksum, …)
  VALUES ('0000', 'baseline', …)`. Yani canlı "baseline'ı zaten uygulamışım" der ve
  `0001`'den itibaren aynı zinciri yürür. **Kutuda 0000'dan, SaaS'ta 0001'den — aynı defter,
  aynı dosyalar.** Fork yok.
- `supabase/migrations/` (14 dosya) **silinmez**, `archive/`'e taşınır ve `archive/README.md`'ye
  niye taşındığı yazılır. Silinirse altı ay sonra "bu migration'lar nerede" diye aranır.

### 5.3 Bugünden sonra: canlıya nasıl uygulanacak

Bugün: `mcp__supabase__apply_migration` → doğrudan canlı. Repo'ya girmesi kimsenin
sorumluluğunda değil, bu yüzden girmiyor (§1.3: son 12 migration repoda yok).

Yeni protokol — **dosya önce, uygulama sonra**:

1. Migration `db/migrations/00NN_<ad>.sql` olarak **önce dosyaya** yazılır.
2. Canlıya aynı dosyanın içeriği uygulanır (MCP ya da runner — ikisi de olur, içerik aynı).
3. `praxura_migrations`'a satır düşer (runner otomatik; MCP kullanıldıysa elle).
4. Aynı commit'te: migration dosyası + `db/SCHEMA.sql` + `db/SCHEMA-RLS.sql` tazelenir
   (mevcut "şema güncelle" tetikleyicisi) + gerekiyorsa `db/REGISTER.md` (mevcut tablo
   kaydı kapısı).

Yani "şema güncelle" tetikleyicisi genişliyor: **dökümü tazele + migration dosyasının
commit'te olduğunu doğrula.**

### 5.4 Garanti: kapı, protokol değil

Protokol yazmak yetmez — bu sicilin var oluş sebebi tam olarak budur (playbook 2026-07-06'da
G8'i yazdı, `module/` altındaki dört dosya yine de sabit host gömdü).

`tools/check-onprem.sh`'e **iki yeni sayaç** eklenir:

| Kontrol | Mantık | Sonuç |
|---|---|---|
| **Şema dökümü değişti ama migration dosyası yok** | `db/SCHEMA.sql` veya `db/SCHEMA-RLS.sql` staged **ve** `db/migrations/` altında yeni dosya yok → **red** | Drift'in tek giriş kapısı bu |
| **Uygulanmış migration değişti** | `db/migrations/` altında **var olan** bir dosya değiştirilmiş (yeni değil) → **red** | §4.5 checksum'ın commit tarafındaki eşi |

Kaçış yine `SKIP_ONPREM_GATE=1` — ama bilinçli olur, kazara değil.

⚠️ Kapı **canlıya uygulamayı** göremez (MCP commit'ten bağımsız). Yani kapı "dosya var mı"
sorusunu çözer, "canlıya uygulandı mı" sorusunu çözmez. İkincisinin cevabı runner'ın kendi
self-check'i: SaaS'ta da runner çalıştığı için, dosyada olup canlıda olmayan bir migration
bir sonraki deploy'da **kendiliğinden** uygulanır. Yani protokol tersine çevriliyor:
**dosya kaynak, canlı türev.** Bugünkü durumun tam tersi.

---

## 6. Soru 4 — `:beta` / `:stable` aynı anda canlı

K11: `:beta` her main push'unda, `:stable` yalnız release tag'inde. İkisi aynı anda
sahada. Bir migration `:beta` ile gider, `:stable` müşterisi hâlâ eski kodu çalıştırır —
ama **veritabanı ortak değildir**, her kutunun kendi Postgres'i vardır. Yani asıl soru
şu değil "iki kod bir DB'ye bakarsa ne olur"; asıl soru:

> `:stable` müşterisi eski image'da; `:beta` kanalında `0007` uygulandı. Müşteri `:stable`'a
> güncellenince `0005`'ten `0007`'ye atlayacak. Bu arada `0006` `:stable` kodunun kullandığı
> bir kolonu silmiş olabilir mi?

### 6.1 İki kural

**Kural 1 — `:stable` ileri sürümün şemasına düşmez.** Runner yalnızca **kendi image'ında
bulunan** migration dosyalarını uygular. Dosya image'ın içinde geldiği için (§4.1) bu
kendiliğinden sağlanır: `:stable` image'ında `0006` dosyası yoksa uygulanmaz. Ek bir
sürüm kontrolüne gerek yok — **paketleme zaten kilitliyor.**

**Kural 2 — ileri uyum, iki adımlı silme.** Yine de bir kutu `:beta`'dan `:stable`'a geri
alınabilir (Watchtower tag değişimi) ya da yedek geri yüklenebilir (§7). Bu yüzden:

> **Bir migration, bir önceki `:stable` sürümünün kodunu bozamaz.**

Pratikte: kolon silme ve yeniden adlandırma **tek adımda yapılmaz**.

| Yapılmak istenen | Yanlış (tek adım) | Doğru (iki sürüm) |
|---|---|---|
| Kolon sil | `ALTER TABLE … DROP COLUMN x` | Sürüm N: kod x'i okumayı bırakır · Sürüm N+1: `DROP COLUMN x` |
| Kolon adı değiştir | `RENAME COLUMN x TO y` | Sürüm N: `y` eklenir, çift yazılır, kod `y`'yi okur · Sürüm N+1: `x` düşer |
| `NOT NULL` ekle | doğrudan `SET NOT NULL` | Sürüm N: default + backfill · Sürüm N+1: `SET NOT NULL` |
| Tablo sil | `DROP TABLE` | Aynı desen — ve `db/REGISTER.md`'ye gerekçesi |

Bu disiplini projenin kendisi zaten bir kez uyguladı: `verordnungen` tablosu 04.09.2026'da
düşürülmeden önce **üç gün donduruldu** ve veri `prescriptions`'a taşındı (`CLAUDE.md`).
Doğru refleks var; yazılı kural yoktu.

### 6.2 Bu disiplin nasıl zorlanır: kapı **kısmen**, kural **tamamen**

Dürüst cevap: **tam mekanik kapı kurulamaz.** "Bu `DROP COLUMN` bir önceki sürümün kodunu
bozuyor mu" sorusu kodun tamamını bilmeyi gerektirir; kapı bunu yapamaz.

Yapılabilecek olan, ve yeterli olan:

- **Kapı (mekanik):** yeni migration dosyasında `DROP COLUMN`, `DROP TABLE`, `RENAME COLUMN`,
  `SET NOT NULL`, `DROP CONSTRAINT` geçiyorsa **red** — ancak dosyanın başında şu satır
  varsa geçer:
  `-- ZWEISTUFIG: <önceki adımın migration numarası> · <kısa gerekçe>`
  Yani kapı yıkıcı işlemi engellemez, **düşünüldüğüne dair kanıt ister.** Yazması iki
  dakika, unutması imkânsız.
- **Yargı (`onprem` ajanı):** yıkıcı migration §6'nın tetikleyicilerinden biri; ön kontrol
  (§3 tanım) çalışır, ilk adımın hangi sürümde gittiği sicile yazılır.

Kapının %80'i, yargının %20'si — projenin geri kalanındaki bölüşümün aynısı.

### 6.3 `:beta` kutusu `:stable`'a geri alınırsa

Bu durum K12'nin sponsor dönemi boyunca gerçekten olacak. Kural açık ve kayda geçiyor:

> **Kanal geri alma (`:beta` → `:stable`) desteklenmez.** Migration ileri-yönlüdür (§4.6);
> `0007` uygulanmış bir DB'ye `:stable` (max `0005`) image'ı bağlanırsa runner defterde
> **kendi bilmediği** iki kayıt görür ve **durur**, kurulum modunda kalır, panelde "bu kutu
> daha yeni bir şema sürümünde (0007), bu image 0005'e kadar biliyor" der.
>
> Geri alma yolu: yedekten geri yükleme (§7). Başka yol yok, ve olmasına gerek de yok —
> beta kutuları bizim sponsor makinelerimiz (K12), ücretli müşteri hiç `:beta`'da olmaz.

Runner'ın "defterde bilmediğim kayıt var" kontrolü bu yüzden **zorunlu**: sessizce devam
ederse eski kod yeni şemaya çarpar ve hata mesajı hiçbir şey anlatmaz.
---

## 7. Soru 5 — yedek / geri-yükleme ile ilişkisi

Yedekleme Faz 2.3'ün işi (O-26), ama şema sürümüyle üç noktada kesişiyor ve o üç nokta
burada yazılmazsa "yedek başarılı görünür, geri yükleme yarım açılır" hatası kaçınılmaz.

### 7.1 Yedek **şema sürümünü de** taşır

`pg_dump` `praxura_migrations` tablosunu zaten içerir (normal bir tablodur) — yani
"bu yedek hangi şema sürümünde alındı" bilgisi yedeğin **içinde** gelir. Bu iyi haber ve
tasarımın bilinçli bir sonucu: ayrı bir sürüm dosyası tutmaya gerek yok.

Ek olarak yedek setinin yanına düz metin bir künye konur (`backup.meta.json`):
`schema_version` · `app_version` (image tag + digest) · `taken_at` · `dump_bytes` ·
`storage_bytes` · `data_key_fingerprint` (§7.3). Künye, arşivi açmadan bakılabilsin diye.

### 7.2 Eski yedek + yeni image = ne olur

Üç durum, üç davranış. Runner geri yüklemeden **sonra** ilk açılışta bunu ayırt eder:

| Durum | Ne demek | Davranış |
|---|---|---|
| Yedek `0005`, image `0007` biliyor | Normal ileri geçiş | `0006` ve `0007` uygulanır, açılır. **Beklenen ve desteklenen yol.** |
| Yedek `0007`, image `0005` biliyor | Eski image'a geri dönüş | **Dur** (§6.3). Panelde: "yedek 0007, bu sürüm 0005'e kadar biliyor — `:stable` yerine `:beta` gerekiyor" |
| Yedek `0007`, image `0007` | Aynı sürüm | Doğrudan açılır |

⚠️ **Sıra tuzağı:** geri yükleme, `restore.sh` çalışırken **api container'ı durmuş** olmalı.
Aksi hâlde runner yarı yüklenmiş bir DB'ye migration uygulamaya kalkar. `restore.sh`'in ilk
adımı api'yi durdurmak, son adımı başlatmak olmalı — ve o sırada runner normal akışıyla
(§4.2) devreye girip eksik migration'ları tamamlar.

### 7.3 O-29 — `DATA_ENCRYPTION_KEY` ile bağı

Sicildeki O-29 burada somutlaşıyor: şema sürümü doğru gelse bile, `DATA_ENCRYPTION_KEY`
farklıysa `icd10_enc` ve `ocr_raw_enc` alanları **açılmaz** (`api-backend/lib/phi-encrypt.js:24-33`,
kullanım `api-backend/server.js:2441-2442`). Uygulama açılır, veri "orada" görünür,
ama reçete OCR çıktısı ve şifreli ICD kodu okunamaz. Sessiz, kalıcı, geri dönüşsüz.

Üç şart, üçü de `restore.sh` ve runner'ın işi:

1. **Yedek anahtarı içermez** (G2 — yedek müşterinin Storage Box'ında durur).
2. **Yedek künyesi anahtarın parmak izini içerir** — anahtarın kendisi değil, ondan türeyen
   bir HMAC/hash. Böylece geri yükleme, anahtarın doğru olup olmadığını **veriye dokunmadan**
   anlar.
3. **`restore.sh` uyuşmazlıkta geri yüklemeden ÖNCE durur** ve sebebi yazar. Yarım bırakmaz.

Ayrıca: kurulumda anahtar üretilir ve sihirbaz müşteriye **bir kez gösterip saklamasını
ister** (K10 — bizde kopyası yok, olmamalı). Bu, Faz 2.1'in işi ve O-29'da yazılı.

> Kısaca: **şema sürümü yedeğin içinde, şifreleme anahtarı yedeğin dışında.** İkisi de
> kontrol edilmeden geri yükleme başlamaz.

### 7.4 Storage yedeği (D3 hatırlatması)

`pg_dump` 5 bucket'taki dosyaları **yedeklemez** — reçete görüntüleri, DTA dosyaları, hasta
belgeleri, imzalar. DB ve storage **tek yedek seti** olmalı ve **aynı ana** ait olmalı;
yoksa geri yükleme sonrası `prescriptions` satırı var, görüntüsü yok. Bu Faz 2.3'ün
kabul kriteri, buraya bağ olarak yazıldı (O-26).

---

## 8. Seçenek karşılaştırması — hazır araç mı, kendi runner'ımız mı

Ölçütler kısıtlardan geliyor: tek kişilik ekip · terminal görmeyen müşteri · kutuya
erişimimiz yok (K10) · aynı zincir SaaS'ta da çalışacak (G7) · kutuya gereksiz bağımlılık
girmez · **ücretli müşteriye dağıtılıyor** (K8/n8n dersi: lisans, dağıtımdan önce okunur).

| Araç | Kutuya ek bağımlılık | Lisans (dağıtım) | Postgres dışı bağımlılık | Tek kişi bakabilir mi | Hüküm |
|---|---|---|---|---|---|
| **Kendi Node runner'ımız** | **yok** — Express zaten orada, `pg`/`postgres-js` zaten bağımlılık | bizim | yok | evet, ~200 satır | ★ **tavsiye** |
| **dbmate** | tek statik Go binary image'a girer (~10 MB) | MIT — dağıtım serbest | yok | evet | iyi 2. sıra |
| **Sqitch** | Perl + CPAN modülleri (`App::Sqitch`) — image'a Perl runtime girer | MIT/Artistic | yok | ⚠️ Perl bilgisi gerekir | hayır |
| **Flyway** | JRE + Flyway (~100 MB+) | Community Apache-2.0, ama **özelliklerin bir kısmı ticari** — sınır ürün ömrü boyunca izlenmek zorunda | JVM | JVM'i kutuda beslemek ayrı iş | hayır |
| **Atlas** | Go binary | Apache-2.0 çekirdek + **ticari "Atlas Pro"**; declarative mod tam da bizim istemediğimiz yer (planı araç üretir, biz denetleyemeyiz) | opsiyonel bulut kaydı — G1/G8 açısından kabul edilemez | öğrenme eğrisi | hayır |
| **Supabase CLI migration** | CLI binary + Docker-in-Docker beklentileri | Apache-2.0 | ⚠️ `supabase_migrations.schema_migrations`'a bağlı — **§1.3'teki bozuk defter** | evet | hayır — sorunun kaynağına yazıyor |

### Neden hazır araç değil

1. **Lisans riski bir kez ısırdı.** K8: n8n'in Sustainable Use License'ı yüzünden pakete
   giremedi ve bu geç fark edildi. Flyway ve Atlas'ın ücretsiz/ticari sınırı ürün ömrü
   boyunca izlenmesi gereken bir yük. Kendi runner'ımızda bu yük **sıfır**.
2. **Bize gereken şey küçük.** İhtiyaç listesi: dosyaları sırayla oku · defterle karşılaştır ·
   advisory lock · transaction · checksum · hata → dur. Bunların hepsi Node + `pg` ile
   ~200 satır. Hazır araçların geri kalan %90'ı (down migration, çoklu ortam profili,
   baseline yönetimi, dry-run planlayıcı) bizim kullanmayacağımız yüzey.
3. **Hata mesajı bizim.** Müşteri terminal görmüyor (K10, kurulum akışı §4.3). Hatanın
   panelde, Almanca, "hangi dosya / ne oldu / ne yapmalıyım" biçiminde çıkması gerek.
   Harici binary'nin stderr'ini panele çevirmek, hatayı baştan kendimiz üretmekten
   daha çok iş.
4. **Sürecin içinde çalışması gerekiyor** (§4.2 — init container değil, api açılışı).
   Harici binary çağırmak `child_process` + PATH + image katmanı demek; Node fonksiyonu
   çağırmak sadece `await`.

### dbmate niye 2. sırada (ve ne zaman tercih edilir)

dbmate tek statik binary, MIT, düz SQL dosyaları, kendi defter tablosu. Yani bizim
kuracağımız şeyin hazır hâli. **Eğer** ileride runner'ı sürdürmek yük olursa geçiş kolay:
dosya formatı zaten düz SQL, defter tablosunun adı değişir, o kadar. Bu, kendi runner'ımızı
yazmanın tek yönlü bir kapı olmadığını gösteriyor — kararın geri dönüşü ucuz.

**dbmate'in bizde çözmediği şey:** advisory lock'u var ama hata → "kurulum modunda kal +
panelde göster" davranışı yok; onu yine biz sarmak zorundayız. Sardıktan sonra kalan kazanç
~200 satır — kutuya bir binary daha koymaya değmiyor.

---

## 9. TAVSİYE

> **Kendi Node migration runner'ımız: `api-backend/db/migrate.js`.**
> Düz SQL dosyaları `db/migrations/` altında, image'ın `COPY` listesinde; api açılışında,
> `app.listen()`'den önce, advisory-lock altında, dosya başına tek transaction, checksum
> doğrulamalı, ileri-yönlü, hata olunca **durup kurulum moduna geçen** — asla crash-loop'a
> girmeyen. Aynı runner SaaS'ta da çalışır; fark yalnızca defterin `0000`'ı içerip
> içermemesidir.

### 9.1 `builder` için görev listesi (uygulama sırası)

| # | İş | Bağlı |
|---|---|---|
| 1 | Canlıdan `db/migrations/0000_baseline.sql` üret — pg_dump + §2'nin dokuz kalemi (§3.2). Beş "kayıp obje" sorgusunu `tools/schema-dump.mjs`'e yaz | §2, §3.2 |
| 2 | `praxura_migrations` tablosu (§4.5) — baseline'ın parçası. Canlıya `0000` satırını elle düş | §5.2 |
| 3 | `api-backend/db/migrate.js` — runner (§4.2-§4.6) + self-check sayaçları (§3.3) | §4 |
| 4 | `server.js`: `await runMigrations()` → başarılıysa `listen`, değilse kurulum modu + `/health` + hata sayfası. **`process.exit(1)` yok** (O-28) | §4.4 |
| 5 | `api-backend/Dockerfile`: `db/migrations/` + `db/seed/` `COPY` listesine (O-35 disiplini — `COPY . .` yok) | §4.1 |
| 6 | `supabase/migrations/` → `archive/`, `archive/README.md`'ye gerekçe | §5.2 |
| 7 | `tools/check-onprem.sh`: iki yeni sayaç (§5.4) + yıkıcı-DDL kapısı (§6.2) | §5.4, §6.2 |
| 8 | `db/README.md` ve `CLAUDE.md`'nin "şema güncelle" bölümüne yeni protokol (§5.3) | §5.3 |
| 9 | `restore.sh` + künye kontrolü (§7.1-§7.3) — Faz 2.3 ile birlikte | §7 |

### 9.2 Faza bağlanması

Bu iş **Faz 1'in sonuna** girer — Faz 2 (paketleme) başlamadan bitmiş olmalı, çünkü
Faz 2.1'in `install.sh`'i baseline'a ve runner'a dayanacak. Faz 1'in mevcut görevleriyle
çakışmıyor; paralel yürüyebilir.

Playbook güncellemesi gerekiyor: **Faz 1.7 — Şema dağıtım zinciri** diye yeni bir görev
açılır ve bu dosyaya referans verir. Playbook'ta bugün hiçbir fazda karşılığı yok
(`onprem/REGISTER.md` §9, "playbook'un eksikleri", 1. madde).

### 9.3 Kabul kriterleri

- ✅ Temiz Ubuntu makinede `docker compose up` → hiçbir elle adım olmadan §3.3'teki
  **on sayacın onu da** beklenen değerde.
- ✅ Yeni bir kolon migration'ı yazıldı → `:beta` image'ı çıktı → sponsor kutu Watchtower
  ile güncellendi → kolon kutuda **var**. Elle müdahale yok.
- ✅ Kasten bozuk bir migration → kutu açılmadı, panelde dosya adı + hata kodu göründü,
  container **crash-loop'a girmedi**, DB yarım kalmadı.
- ✅ İki instance aynı anda kalktı → migration **bir kez** uygulandı (advisory lock).
- ✅ SaaS'ta aynı runner çalıştı, regresyon yok (`qa_crawl_prod.py` PASS).
- ✅ `0007` şemalı yedek + `0005` bilen image → geri yükleme **durdu**, sebebini yazdı.
- ✅ Yanlış `DATA_ENCRYPTION_KEY` ile geri yükleme → veriye dokunmadan **durdu** (O-29).

---

## 10. `doğrulanmalı` — canlı DB'ye sorulacaklar

Bu dosya MCP erişimi olmadan, dosyalara karşı yazıldı. Aşağıdakiler **tahmin edilmedi**,
işaretlendi. Baseline üretilmeden önce cevaplanmalı — hepsi tek oturumda, birkaç sorgu.

### ✅ 04.09.2026 — 7/9 cevaplandı (ana bağlam, Supabase MCP ile canlıya soruldu)

**Sayı düzeltmesi:** canlıda **227** migration kaydı var, 195 değil (`20260506141134` →
`20260904090537`). 195 rakamı `CLAUDE.md`'den geliyor ve bayat. Baseline kararını
**değiştirmez**, aksine güçlendirir — makas büyümüş.

| # | Cevap |
|---|---|
| 1 | **9 extension.** ⚠️ Üçü `public` şemasında: **`postgis`, `pg_trgm`, `btree_gist`** — `DROP SCHEMA public CASCADE` bunları da siler, kurulum sırası bu yüzden kritik. `extensions` şemasında: `pgcrypto`, `uuid-ossp`, `pg_net`, `pg_stat_statements`. Ayrıca `supabase_vault` (vault), `plpgsql`. **`pgcrypto` kurulu** — playbook §9-A4'ün Vault alternatifi elimizde |
| 2 | **6 trigger var ama yalnız 1'i BİZİM:** `auth.users` → `on_auth_user_created` → `public.handle_new_user`. Diğer 5'i Supabase'in kendi imajıyla geliyor (`tr_check_filters`, `enforce_bucket_name_length_trigger`, `protect_buckets_delete`, `protect_objects_delete`, `update_objects_updated_at` — `storage.protect_delete` gövdesi okundu, stok Supabase koruması). **§2'nin bu kalemi daralıyor: taşınacak tek trigger var** |
| 3 | **9 storage policy**, hepsi `storage.objects` üzerinde: `avatars_*` (4 — biri `public_read`), `prescriptions_storage_owner_*` (3), `patient_documents_owner_all`, `abrechnungen_owner_read`. Baseline'a girmeli |
| 4 | **5 bucket.** `avatars` **public**; `prescriptions` + `abrechnungen` private/10 MB; `patient-documents` private/5 MB; `referrals` private, sınırsız |
| 5 | ✅ Doğrulandı — publication'da yalnız **`bookings`** var |
| 6 | En son kayıt `20260904090537`. Repodaki 14 dosyayla eşleşme sorunu **teyitli** |
| 7 | ✅ **`pg_cron` kurulu DEĞİL.** Playbook doğru, Faz 2.4a'nın node-cron kararı geçerli |
| 8 | ⬜ Açık — PoC stack'inde denenmeli, sorgu ile cevaplanamaz |
| 9 | `referrals` bucket'ında **0 nesne**. Ölü adayı, ama hüküm dört-kaynak kuralı olmadan verilmez → `db-ustasi` işi, baseline'ı bloklamaz (boş bucket taşımak bedavadır) |

**Baseline üretilmeden önce kalan tek engel: 8.**

---

| # | Soru | Sorgu |
|---|---|---|
| 1 | Hangi extension'lar kurulu, hangi şemada? (özellikle `btree_gist`, `pgcrypto`) | `SELECT extname, extnamespace::regnamespace, extversion FROM pg_extension` |
| 2 | `auth`/`storage`/`realtime` şemalarında **bizim** trigger'ımız başka var mı? | §2 V-3'teki sorgu |
| 3 | `storage.objects` policy'lerinin bugünkü hâli (12.08. `tighten_avatars_storage_policies` sonrası) | `SELECT * FROM pg_policies WHERE schemaname = 'storage'` |
| 4 | Bucket tanımları (public mi, boyut/MIME sınırı var mı) | `SELECT * FROM storage.buckets` |
| 5 | `supabase_realtime` publication üyeleri gerçekten yalnız `bookings` mi? | `SELECT * FROM pg_publication_tables WHERE pubname='supabase_realtime'` |
| 6 | `20260902090000_services_kostentraeger_typ` canlıda hangi adla kayıtlı? | `SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 40` |
| 7 | `pg_cron` gerçekten yok mu? (playbook doğruladı, 2 ay geçti) | `SELECT 1 FROM pg_extension WHERE extname='pg_cron'` |
| 8 | `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin` satırları self-host'ta hatasız geçiyor mu? | PoC stack'inde deneme |
| 9 | `referrals` bucket'ının gerçek kullanımı (kodda çağrısı görünmüyor — ölü mü?) | `SELECT count(*) FROM storage.objects WHERE bucket_id='referrals'` + dört-kaynak kuralı |

---

## 11. Kararlar — ✅ ÜÇÜ DE VERİLDİ (04.09.2026)

Kullanıcı üç kararı da ana bağlama devretti ("sen nasıl uygun görüyorsan öyle yap").
Üçü de ajanın tavsiyesi yönünde kapandı; **artık kilitli**, yeniden açılmaz.

| # | Karar | Gerekçe |
|---|---|---|
| 1 | ✅ **Baseline.** Bugünkü canlıdan tek `0000_baseline.sql`; zincir bugünden başlar, 227 geçmiş migration tarih olur | Baseline yolunun çalıştığı PoC 0.1'de ölçüldü (71=71 tablo, 136=136 policy, sıfır hata). 227'yi yeniden oynatmanın çalışacağı **hiç ölçülmedi** ve kök `database_v*.sql` zaten çakışan numaralarla dolu. Ölçülmüş yol, ölçülmemiş yola tercih edilir |
| 2 | ✅ **`supabase/migrations/` → `archive/supabase-migrations-vor-baseline/`** | 14 dosyanın yalnız 3'ü canlıyla eşleşiyor. Yerinde bırakmak "iki dizin iki gerçek" demek; bu projede tam olarak bu hata `onprem/schema` ile bir kez yapıldı ve dosya 2 ay bayat kaldı. Silinmiyor, taşınıyor — gerekçesi `archive/README.md`'ye yazılır |
| 3 | ✅ **Sıra numarası** (`0000_baseline.sql`, `0001_…`, dört hane) | Doğrudan `main`'de çalışıyoruz, paralel dal yok — zaman damgasının çözdüğü birleştirme-sırası sorunu bizde **yok**. Buna karşılık sıra numarası §6.3'teki "bilmediğim kayıt var" kontrolünü aritmetik yapıyor: `:stable` kutusu `0007`'de, dosya `0009` ise fark **iki sürüm** olarak okunur. Zaman damgasında bu soru bulanıklaşır |

**Not — `:beta`/`:stable` ile ilişki:** sıra numarası tek dal varsayar. İleride ikinci bir
dal açılırsa (bugün yasak — `CLAUDE.md` "doğrudan main") bu karar yeniden değerlendirilir;
o güne kadar geçerli.

Üçü `konsey/KARARLAR.md`'ye ve `db/README.md`'ye işlenecek.

<details>
<summary>Kararın öncesindeki ajan metni (kayıt için)</summary>

Bu üçü ajanın kararı değil; **kilitli karar sınıfına girecek** ve bir kez verilince
formatı dondurur.

1. **195-vs-14 → baseline (§5.1).** Tavsiye net ve gerekçeli, ama geçmişi resmen "tarih"
   ilan etmek kullanıcının kararıdır. Onaylanınca `konsey/KARARLAR.md`'ye yazılır.
2. **`supabase/migrations/` arşive taşınsın mı, yerinde kalsın mı.** Tavsiye: `archive/`.
   Yerinde kalırsa iki dizin iki gerçek olur ve altı ay sonra hangisinin kaynak olduğu
   yeniden sorulur.
3. **Migration adlandırması: sıra numarası (`0001`) mi, zaman damgası (`20260905…`) mı.**
   Tavsiye: sıra numarası (tek dal, çakışma yok, okuması kolay). Zaman damgası seçilirse
   §6.3'teki "bilmediğim kayıt var" kontrolü karşılaştırma yapamaz hâle gelir — sıralama
   leksik kalır ama "daha yeni mi" sorusu bulanıklaşır.

</details>

---

## 12. Bu dosyanın sicildeki yeri

`onprem/REGISTER.md` → **O-39**. Bu dosya yazıldığında O-39 `offen` → `geplant` oldu.
`gelöst` olması için §9.3'teki yedi kabul kriterinin tamamı yeşile dönmeli ve commit
numarası sicile yazılmalı.

Bağlı maddeler: **O-25** (`:beta`/`:stable` kanalları — §6) · **O-26** (yedekleme — §7) ·
**O-29** (`DATA_ENCRYPTION_KEY` — §7.3) · **O-38** (referans verisi seed'i — §3.1 adım 8) ·
**O-20** (kapı — §5.4, §6.2) · **O-28** (crash-loop yasağı — §4.4).

*Yazıldı: 2026-09-04 · `onprem` ajanı · kod yazılmadı, gereksinim yazıldı.*
