# `db/migrations-geplant/` — baseline'dan önceki üç dosya

**Taşındı:** 10.09.2026 · **Sebep:** içerikleri artık `api-backend/db/migrations/0000_baseline.sql`'in içinde.

## Ne olmuştu

Bu üç dosya 03–09.09.2026 arasında yazıldı. Üçünün de başında
*„VORBEREITET, NICHT ANGEWENDET"* yazıyor — ama üçü de canlıya **elle uygulandı**
(MCP ile), dosyalar ise oldukları yerde kaldı. O sırada çalıştırılabilir bir
migration zinciri (`api-backend/db/migrations/`) henüz işlemiyordu: runner
04.09.2026'da yazılmıştı ama `0000_baseline.sql` üretilmediği için zincir boştu.

Sonuç: değişiklikler canlıda vardı, zincirde yoktu. Aynı boşluktan altı günde
yedi şema commit'i geçti. Bedeli bir kez ödendi — commit `a9cbb13`'ün başlığı:
*„rechnung_zahlung_buchen fehlte in Produktion"* (RPC canlıda yoktu, fatura akışı
bloke oldu).

## Niye zincire `0001/0002/0003` olarak eklenmediler

Çünkü **gerek yok.** `0000_baseline.sql` 10.09.2026'da **canlı veritabanından**
üretildi; yani bu üç dosyanın yaptığı her şey baseline'ın içinde zaten var:

| Dosya | Baseline'da karşılığı (doğrulandı) |
|---|---|
| `01_faz1_prescriptions_verordnungen_spalten.sql` | `prescriptions.lead_id`, `prescriptions.therapie_bereich` |
| `02_nagel_lokalisation_prescriptions.sql` | `prescriptions.nagel`, `prescriptions.nagelspange_erlaubt` |
| `03_abrechnung_zeile_und_zahlung.sql` | `abrechnung_zeile` + `abrechnung_zahlung` tabloları, `rechnung_zahlung_buchen()` |

Zincire ayrıca eklenselerdi, temiz bir müşteri kutusunda **ikinci kez**
uygulanmaya çalışılırlardı.

## Bundan sonra

Bu klasör bir daha kullanılmaz. Yeni şema değişikliği tek yoldan gider:

1. `api-backend/db/migrations/NNNN_ad.sql` dosyasını yaz
2. Aynı commit'te `db/SCHEMA.sql` dökümünü tazele
3. Canlıya uygula

Sıra bağlayıcıdır ve `tools/check-onprem.sh` bunu kapı olarak uygular:
döküm değişip zincire dosya girmediyse commit reddedilir.

Kurallar: `api-backend/db/migrations/README.md` · tasarım: `onprem/SCHEMA-VERTEILUNG.md`
