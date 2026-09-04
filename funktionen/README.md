# Funktionskarte — projedeki her fonksiyonun haritası

`db/` klasörünün koda uygulanmış hâli. `db/` "hangi tablo var"ı, burası **"hangi fonksiyon
var, nerede kullanılıyor, neyle besleniyor"**u tutar.

## Neden var

`dashboard.js` 24.000+ satır; projede 1700'den fazla fonksiyon var. "Böyle bir şey zaten var
mı" sorusu okuyarak cevaplanamaz — hiçbir model bu hacmi tek seferde kapsayamaz, okur ve
**makul ama eksik** bir cevap üretir. Bu klasör o soruyu okumaya değil **saymaya** çevirir.

Somut sebep: 12.08.2026 beta görüşmesinde aynı işin iki ayrı yerde ayrı kodla yapıldığı
görüldü (Fußbefund iki yerden kaydediliyor, Zuzahlungsbefreiung dört ayrı yoldan yazılıyor).
Bunlar tek tek bug değil, **bir kalıp**. Kalıbı görmek için envanter gerekiyordu.

## Dosyalar

| Dosya | İçerik |
|---|---|
| `INDEX.json` | Makine okuru. Her fonksiyon: dosya/satır, dokunduğu tablolar, yazma işlemleri, çağırdıkları, **onu çağıranlar**, hangi sidebar modülünden erişilebildiği, tıklama yolu. |
| `INDEX.md` | İnsan okuru. Kopya adayları, en çok yazılan tablolar, çift isimler. |

İkisi de **üretilir, elle düzenlenmez.** Yanlış varsa düzeltilecek yer
`tools/funktionskarte.mjs`, çıktı değil.

## Tazeleme

```bash
node tools/funktionskarte.mjs
```

**Kural:** fonksiyon eklendiğinde, silindiğinde veya taşındığında harita aynı commit'te
tazelenir. Tetikleyici cümle: **"harita güncelle"**.

Eski harita hiç haritadan kötüdür — okuyan ona inanır. `db/README.md`'deki şema tazeleme
kuralıyla aynı gerekçe.

## Kopya adayları nasıl okunur

`INDEX.md`'deki her küme, **aynı tabloya yazan ama birbirini çağırmayan** kod yollarını
gösterir. Bu bir suçlama listesi değil, **inceleme kuyruğu.**

Bu projede bilinçli bir katmanlama var ve script onu ayırt edemez:

- ✅ **Doğru:** ortak taban + üstüne binen alan bloğu (podolojide ayak şeması), ya da tek
  uygulamanın parametreyle daraltılması (`attachDiagnoseSearch(..., { strict: true })`)
- ⚠️ **ARTIK GEÇERSİZ (04.09.2026):** "iki veri havuzu kasıtlıdır, birleştirme kırar"
  maddesi kalktı. Kemal'in kararıyla podoloji `verordnungen`'den `prescriptions`'a taşındı
  (hedef: 9 kolon / 7 satır / 72 kod noktası — 47 / 242 / 168 yerine). Podolojinin kendi
  kelime dağarcığı (`lead_id`, `behandlungseinheiten`, `therapiefrequenz`, `dringend`,
  `icd10` dizisi, aktiv/abrechenbar/abgesetzt durum ekseni) sıfırdan yeniden yazılmadı;
  arada **`module/verordnung-topf.js`** sınır modülü duruyor (`ausTopf`/`inTopf`,
  `statusAusTopf`/`statusInTopf`, `fuehrtSitzungsbuch`). Yani `prescriptions`'a iki farklı
  kelimeyle yazan yolları görürsen bu kopya değil, **çeviri katmanıdır.**
  ⚠️ `api-backend/billing/utils/einreichbar.js` içindeki `statusAusAbrechnungStatus` /
  `abrechnungStatusAusStatus` bu modülün **bilinçli aynasıdır** (`SPIEGEL` yorumlu):
  Docker imajı `module/`'ü içermediği için paylaşılamıyor. Biri değişirse ikisi değişir.
- 🔴 **Kopya:** aynı iş için ikinci kez sıfırdan yazılmış kod
- 🔴 **Veri riski:** aynı tabloya farklı kurallarla yazan yollar (biri `onConflict` kullanıyor,
  diğeri kullanmıyor gibi)

Karar `fonksiyon-ustasi` ajanında; şüpheli olan kullanıcıya **tıklama yoluyla** sorulur,
sessizce birleştirilmez.

## Bilinen sınır

`uiPfad` alanı, `dashboard.js`'teki `if (id === '...')` modül yönlendiricisinden ileriye
doğru çağrı grafiğiyle hesaplanır. Olay dinleyicisiyle bağlanan fonksiyonlar bu zincirin
dışında kalıp "UI yolu çözülemedi" görünebilir; çok yerden çağrılan yardımcılar da
`gemeinsam: true` ile işaretlenir. Kullanıcıya verilecek ekran tarifi bu alandan körü körüne
kopyalanmaz, `canli-test` ile doğrulanır.
