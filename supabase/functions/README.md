# Supabase Edge Functions — Fahrtenbuch

Üç fonksiyon, üçü de **canlıda çalışıyor** (`ACTIVE`, version 3). Fahrtenbuch'un
adres→koordinat, iki nokta arası mesafe ve çoklu ev ziyareti rota hesabını yapıyorlar.
Hepsi OpenRouteService'e (ORS) giden birer aracı.

| Fonksiyon | Ne yapar | Dışarı ne çıkıyor |
|---|---|---|
| `fahrtenbuch-geocode` | Adres → enlem/boylam | **adres metni** (kişisel veri) |
| `fahrtenbuch-route` | İki nokta arası km + dakika | yalnız koordinat |
| `fahrtenbuch-matrix` | Zincirleme ev ziyareti planı (en fazla 25 nokta) | yalnız koordinat |

Çağıran taraf: `dashboard.js` → `invokeFahrtenbuchFn()`.

---

## Bu klasör niye 04.09.2026'da açıldı

**Kaynak kod hiçbir yerde yoktu.** Üç fonksiyon aylardır canlıda çalışıyordu ama
ne bu depoda ne de git geçmişinde tek satırı vardı — muhtemelen Supabase panelinden
veya başka bir makineden deploy edilmişlerdi.

Bunun iki sonucu vardı:

1. **Kaybolma riski.** Fonksiyonlar silinse veya bozulsa kimse yeniden yazamazdı.
   Ne yaptıklarının tek kaydı Supabase'in kendi sunucusundaydı.
2. **On-prem geçişi planı yanlış bilgiye dayanıyordu.** `ONPREM_MIGRATION_PLAYBOOK.md`
   Faz 1.5 "bu fonksiyonları Express'e taşı" diyordu — taşınacak dosya yoktu.
   Bulgu: `onprem/REGISTER.md` → O-11.

Kod buraya **canlıdan geri çekilerek** yazıldı (Supabase MCP, 04.09.2026). İçerik
birebir aynıdır, tek satır değiştirilmedi.

> ⚠️ **Bu dosyalar canlıdakinin kopyasıdır, kaynağı değil.** Depoda değişiklik
> yapmak canlıyı değiştirmez — deploy ayrı bir adımdır. Değiştirirsen aynı commit'te
> deploy et, yoksa ikisi sessizce ayrışır ve bu sorunu bir daha yaşarız.

## Anahtar

`ORS_API_KEY` ortam değişkeninden okunuyor, **kodun içinde değil** — depoya
alınabilmesinin sebebi bu (depo public).

Bugün anahtar bizim. On-prem'de bu bir soru işareti: müşterinin ev adresleri ORS'a
gidiyor ve kimin anahtarıyla gideceği henüz karara bağlanmadı
(`ONPREM_MIGRATION_PLAYBOOK.md` §9-A8; öneri: müşterinin kendi ücretsiz anahtarı,
günde 2000 istek).

## Klasörün tarihçesi

Aynı yolda (`supabase/migrations/`) eskiden 14 migration dosyası duruyordu.
Onlar şemanın kaynağı **değildi** ve 04.09.2026'da
`archive/supabase-migrations-vor-baseline/` altına taşındı. Şemanın yeni ve tek
zinciri: `api-backend/db/migrations/`. Gerekçe: `onprem/SCHEMA-VERTEILUNG.md`.
