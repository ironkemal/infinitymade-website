# `api-backend/db/migrations/` — çalıştırılabilir şema zinciri

> ⚠️ **Kökteki `db/` ile karıştırma.** İkisi ayrı işler:
>
> | Klasör | Ne | Kim üretir |
> |---|---|---|
> | `db/` (kök) | **Belge.** `SCHEMA.sql` + `SCHEMA-RLS.sql` durum fotoğrafı, `REGISTER.md` niyet kaydı. **Çalıştırılamaz** — `SCHEMA.sql`'de kolonlar arası virgül bile yok, `SCHEMA-RLS.sql`'in %75'i yorum satırı | MCP ile üretilir |
> | `api-backend/db/migrations/` (burası) | **Çalıştırılabilir zincir.** Kutuya giden gerçek SQL | elle yazılır |
>
> Docker `COPY` bağlamı `./api-backend` olduğu için buranın api-backend altında
> olması zorunlu — kökteki `db/` image'a giremez.

Tasarım ve gerekçe: `onprem/SCHEMA-VERTEILUNG.md`. Runner: `../migrate.js`.

---

## Kural 1 — dosya adı: `NNNN_ad_alt_cizgili.sql`

Dört haneli sıra numarası, alt çizgili küçük harf ad. `0000_baseline.sql` ilk halka.

Farklı isimlendirilmiş bir `.sql` dosyası runner'ı **durdurur**. Bilinçli: sessizce
atlanan bir migration, kimsenin göremediği bir şema farkıdır.

Zaman damgası değil sıra numarası kullanıyoruz — doğrudan `main`'de çalıştığımız için
birleştirme sırası diye bir sorunumuz yok, buna karşılık "kutu `0007`'de, dosya `0009`"
farkı aritmetik okunuyor.

## Kural 2 — uygulanmış dosya **değiştirilmez**

Runner her dosyanın SHA-256'sını deftere (`praxura_migrations`) yazar. Uygulanmış bir
dosyayı sonradan düzenlersen runner açılışta durur ve kutu açılmaz.

Sert görünüyor ama tam olarak korunmak istenen şey bu: "küçük bir düzeltme yaparım"
tek kişilik ekipte en kolay yapılan hata, ve sonucu SaaS ile kutular arasında **sessiz**
şema farkı. Düzeltme her zaman **yeni dosyayla** yapılır.

## Kural 3 — geri alma yok, ileri düzeltme var

`down` adımı yazılmaz. Yazılsaydı hiç test edilmezdi ve lazım olduğu gün çalışmazdı.
Gerçek geri dönüş yolu **yedektir**. Yanlış giden şeyin cevabı: düzelten yeni migration.

## Kural 4 — `:beta` ve `:stable` aynı anda canlı → iki adımlı değişiklik

Eski image yeni şemayla çalışabilmeli. Yani **kolon silme ve yeniden adlandırma tek
adımda yapılmaz**:

```
✗  ALTER TABLE x RENAME COLUMN a TO b;      -- eski image "a"yı arar, patlar

✓  Sürüm N   : ALTER TABLE x ADD COLUMN b …;   (kod ikisini de yazar)
   Sürüm N+1 : ALTER TABLE x DROP COLUMN a;    (artık kimse "a"yı okumuyor)
```

Aradaki sürüm sayısı en az bir olmalı; `RELEASE-STANDARD.md`'deki destek penceresi
kadar beklemek daha güvenli.

## Kural 5 — transaction

Her dosya tek transaction içinde çalışır; hata olursa o dosya **tamamen** geri alınır.

`CREATE INDEX CONCURRENTLY` gibi transaction içinde çalışamayan bir ifade gerekiyorsa
dosyanın başına tek başına şu satır konur:

```sql
-- no-transaction
```

O dosya **idempotent** yazılmak zorundadır (`IF NOT EXISTS` vb.), çünkü yarıda kalırsa
geri alınmaz. Bugün böyle bir migration'ımız yok.

---

## Yeni migration yazarken

1. `db-ustasi`'na sor — kolon eklemek yetiyor mu, bu kavram zaten var mı.
2. Dosyayı buraya yaz, sıradaki numarayla.
3. `npm test` (api-backend) — runner testleri sıralama ve isimlendirmeyi yakalar.
4. Aynı commit'te kökteki `db/SCHEMA.sql` dökümünü tazele ("şema güncelle") ve
   gerekiyorsa `db/REGISTER.md`'ye tablo kaydını yaz.
5. Kişisel veri taşıyan yeni tablo açtıysan `api/dsgvo.js`'i de güncelle.

## Runner ne zaman çalışır

`server.js` açılışında, `app.listen()`'den **önce**. Başarısız olursa süreç **ölmez** —
bakım moduna geçer, `/health` ve hata bilgisini servis eder, gerisine 503 döner.
(`process.exit(1)` + Watchtower = 60 saniyede bir yeniden başlayan, müşterinin hiçbir
şey göremediği kutu. Bir kez yaşandı.)

`DATABASE_URL` **yoksa runner sessizce atlar.** Bugünkü SaaS bu durumda; davranış
değişmeden çalışmaya devam ediyor.
