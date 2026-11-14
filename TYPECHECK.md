# Tip kontrolü — TypeScript'e geçmeden

> Konsey 2026-08-13, S4. Tam gerekçe:
> `konsey/tutanak/2026-08-13-frontend-mimari-katman.md`

```bash
npm run typecheck
```

## Ne değişiyor, ne değişmiyor

**Değişmiyor:** dosya uzantıları (`.js` kalıyor) · tarayıcıya giden kod (birebir
aynı) · deploy (build adımı **yok**) · on-prem kurulumu.

**Değişiyor:** editör ve model, yanlış tipi **yazarken** görüyor. Eskiden bu
hatalar ancak müşteri tıklayınca — §302'de ise ancak kasa dosyayı reddedince —
ortaya çıkıyordu.

TypeScript **derleyici olarak değil, denetçi olarak** kullanılıyor
(`devDependencies`, `noEmit: true`). Ürün kodunda TypeScript yok.

## Cırcır kuralı — liste sadece büyür

`jsconfig.json` içindeki `include` **tüm projeyi değil, temiz dosyaları**
kapsar. Sebep ölçüm:

| Kapsam | `checkJs` açılınca hata |
|---|---|
| `api-backend/billing/dta` | **252** |
| `api-backend/billing/zuzahlung` | **105** |
| `api-backend/billing/codes` | **34** |
| `module/` tamamı (2026-08-14) | **191** |
| **Başlangıç kapsamı (2026-08-14)** | **4 giriş, 0 hata** |
| **Ara kapsam (2026-11-14 başı)** | **74 giriş (73 dosya + 1 glob), 0 hata** |
| **Güncel kapsam (2026-11-14 sonu)** | **682 giriş (681 dosya + 1 glob), 0 hata** |

> **682 giriş dağılımı (`2026-11-14`):** `root: 4` · `module: 205` (`203` dosya + `globals.d.ts` + `typen/**/*.js`) · `api: 17` (`%100`) · `api-backend: 391` (`ai: 51`, `billing: 172`, `booking: 24`, `db: 10`, `dsgvo: 6`, `lib: 69`, `merkez-istemci: 11`, `routes: 24`, `setup: 8`, `tools: 2`, `_lib + kök: 14`) · `ops: 5` · `tools: 60`.
> **Bilinçli ertelenenler (`jsconfig.json` dışında):** (1) Dev monolith/karmaşık route'lar: `api-backend/server.js`, `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/zuzahlungsforderung.routes.js` ve bunları doğrudan çeken 6 test/harness dosyası (`billing-auth-contract.test.js`, `empfaenger-pruefung.test.js`, `upload-signed-verschluesselung.test.js`, `zuzahlungsforderung.routes.test.js`, `podo-empfangsnachweis-gates.harness.mjs`, `billing/kostentraeger/stichtag-pruefung.test.js`); (2) `?v=` cache-buster göreceli import'larına veya `vendor/` modüllerine bağlı tarayıcı dosyaları (`dashboard.js`, sayfa giriş dosyaları, `ops/{app,board,decisions,fahrtenbuch,files,finance,meetings,wissen}.js`, `?v=` çeken kalan `module/` dosyaları ve `api-backend/ai/{router.test.js,__tests__/m4-corpus.test.js}`); (3) Playwright/tarayıcı harness araçları (`tools/browser-probe/`, `tools/box-abnahme-mail/`, `tools/db-vollkette/`, `tools/redesign-{geometrie,harness,kontaktbogen,shots,smoke,zustaende}.mjs`, `tools/funktionskarte.mjs`).

191 hatalı bir liste kırmızı bir duvardır; duvar görmezden gelinir, görmezden
gelinen araç ölür. Bu yüzden kapsam sıfır hatayla başlar ve **dosya temizlendikçe
büyür.**

### Bir dosyayı listeye ekleme

> **`tsc -p` tuzağı:** `npx tsc -p jsconfig.json --noEmit <dosya>` komutu TypeScript'te
> `TS5042` (*Option 'project' cannot be mixed with source files*) hatası verir.
> Tekil aday veya kapalı import zinciri ölçümü için yardımcı betiği kullanın:

```bash
sh tools/typecheck-kandidat.sh <dosya>      # jsconfig.json + adayı geçici birleşimde ölçer
# hataları düzelt, sonra jsconfig.json > include listesine ekle
npm run typecheck                            # 0 olmalı
```

**Listeden dosya çıkarmak yasaktır.** Kazanım geri alınmaz — `dashboard.js`
satır kapısıyla aynı mantık (`tools/check-dashboard-size.sh`).

## §302 tip sözlüğü

`module/typen/gkv.js` — `gkv-302`'nin "sessiz gelir kaybı" diye işaretlediği
alanlar. Her madde 2026-08-14'te şemaya ve koda karşı doğrulandı, kaynağı
yanında yazılı:

| Alan | Doğru tip | Yanlış olursa |
|---|---|---|
| `Positionsnummer` | **string** | `'07301'` → `7301`, başka bir leistung |
| `Abrechnungscode` | **string** | baştaki sıfır kaybolur |
| `Tarifkennzeichen` | **string**, 5 hane | `'01001'` → `1001` |
| `IK` | **string**, 9 hane | FK boşa düşer |
| `BetragEur` | **number, EURO** (cent değil) | 100 kat sapma |
| `DtaDatum` | **`'YYYYMMDD'`** | dosya reddi |

> **Konseyde açık kalan soru cevaplandı:** tutarlar **Euro**, cent-integer değil.
> Kanıt: `db/SCHEMA.sql` `numeric(10,2)` + `*_eur` kolon adları ·
> `api-backend/billing/dta/builder.js:43` `r2 = v => +Number(v).toFixed(2)` ·
> `encoding.js:39` `fmtAmount(eur, decimals = 2)`.

Sözlük **yalnızca tip** içerir. Çalışma-zamanı doğrulaması backend'de kalır
(`api-backend/billing/dta/preflight.js`, `encoding.js`) — ikinci bir validator
yazmak, birinciyle çelişme riski demektir.

## Bilinen sınırlama — `?v=` cache busting

Proje modül URL'lerine `./signal.js?v=20260813` gibi bir ek koyuyor. Tarayıcı
anlıyor, TypeScript anlamıyor ("Cannot find module").

`module/globals.d.ts` içindeki `declare module '*?v=*';` bu hatayı yalnızca yalın modül
adlarında susturuyor; göreceli `./...js?v=...` import'larında TypeScript 7 (`tsgo`) yine
`TS2307` üretir (ör. `supabase-config.js`, `design-oeffentlich.js`). Üstelik susturulan
import'lar editörde `any` olur ve tipini kaybeder.

Tam tip isteyen modülden modüle `?v=` **olmadan** import eder; cache-buster
yalnızca HTML'in yüklediği giriş modülünde kalır. (`supabase-config.js`,
`module/design-oeffentlich.js` ve istisna göreceli imzalar `module/globals.d.ts`
üzerinden yönetilir; ayrıca `api/` içindeki kök `nodemailer` kullanımı için
`module/globals.d.ts` içinde tipli `declare module 'nodemailer'` tanımı eklenmiştir.
SaaS `max-age=0, must-revalidate` ve On-Prem Caddy `file_server` ETag/Last-Modified
doğrulandı.)
