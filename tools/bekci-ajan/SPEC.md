# Bekçi-Ajan — düşünen otomasyon katmanı (SPEC)

> Durum: **taslak v1 — 24.11.2026**, Kemal'in talimatıyla yazıldı. İnceleme: onprem · guvenlik · fonksiyon-ustasi.
> Kapsam: `.github/workflows/` altındaki zamanlanmış bekçiler (preise · kostenträger · itsg · quellen).

## 1. Kemal'in kararları (24.11.2026) — tartışılmaz girdi

| # | Karar |
|---|---|
| K-A1 | **YZ rakam girebilir**, ama **çift dikişle**: iki bağımsız okuma (deterministik araç + YZ, gerekirse ikinci model) aynı sonucu bulursa yazılır. Bu, CLAUDE.md'deki "sayı taşıyan tablo YZ ile çevrilmez" kuralının yerine geçer: kural artık "**tek** YZ okuması yetmez" demektir. |
| K-A2 | Sorun yoksa **sessiz devam** + kısa Telegram raporu ("şunu yaptım"). |
| K-A3 | Sorun varsa **Telegram'dan interaktif**: hangi dosya, ne oldu, ne öneriyor. Kemal'in cevabına göre devam eder. |
| K-A4 | **PC kapalıyken çalışır** → her şey GitHub Actions'ta. Yerel makine ve Claude oturumu gerekmez. |
| K-A5 | Yayındaki bütün bekçilere yayılacak; ilk iş fiyat ve Kostenträgerdatei. |

## 2. Mimari — üç katman

```
 [Katman 0] Deterministik bekçi (bugünkü script'ler, değişmez)
      │  temiz → bugünkü gibi kendi yolunda (ör. güvenli fiyat penceresi otomatik)
      │  "insan bakmalı" (needsReview / yeni dosya / hata) → bulgu.json
      ▼
 [Katman 1] Ajan (Claude Code, GitHub Actions içinde)
      │  bulguyu + kaynağı okur, ne değiştiğini çıkarır, öneri üretir:
      │  karar.json { tur, guven, ozet, dosyalar, yama.patch, okunan_rakamlar }
      ▼
 [Katman 2] Çift dikiş (Doğrulayıcı)
      │  a) deterministik kontrol: yama yalnız izinli dosyalara mı, testler yeşil mi,
      │     sözdizimi, rakam aralığı (bugünkü preise_autoupdate korkulukları)
      │  b) ikinci bağımsız okuma: AYNI kaynaktan rakamları ayrı bir model/araç çıkarır,
      │     karar.json'daki okunan_rakamlar ile birebir karşılaştırılır
      │
      ├─ hepsi uyuşuyor → uygula (commit + push + deploy) → kısa Telegram raporu
      └─ herhangi biri uyuşmuyor / ajan emin değil → VAKA aç → Telegram'da sor
```

### 2.1 Ajan motoru
- **Ana ajan:** `anthropics/claude-code-action` (Claude Code, Actions'ta). Kimlik: `CLAUDE_CODE_OAUTH_TOKEN`
  secret'ı (Kemal'in mevcut aboneliği, `claude setup-token` ile bir kez üretilir — ek API faturası yok).
- **İkinci okuyucu (çift dikiş b):** GitHub Models (`permissions: models: read`, ek secret gerekmez, ücretsiz kota).
  Veriler herkese açık resmî belgeler, gizlilik sorunu yok. Ana ajandan **farklı** bir model ailesi seçilir ki
  aynı hatayı iki kez yapmasınlar.
- Ajan yalnız bulgu varsa çalışır (her gün değil) → kota tüketimi düşük.

### 2.2 Vaka (interaktif soru) döngüsü
1. Doğrulayıcı uyuşmazlık bulursa `vaka-<tarih>-<bekci>-<n>` açar. Vaka kaydı **`bekci-vakalar`** dalında
   `vakalar/<id>.json` olarak tutulur (durum makinesi: `acik → cevaplandi → uygulandi | birakildi`).
2. Telegram mesajı (Türkçe, kısa):
   `⚠️ Fiyat bekçisi · Podologie 78010 · XML 36,10 → 37,20 € (%3) · ikinci okuma 37,02 diyor · dosya: podologie_positions.js`
   + düğmeler **[✅ Uygula] [❌ Bırak] [💬 Açıkla]**. Serbest metin cevap da kabul ("37,20 doğru, uygula").
3. `bekci-cevap.yml` her **10 dakikada** bir `getUpdates` okur (PC kapalıyken de çalışır, sunucu gerekmez).
   Yalnız `TELEGRAM_CHAT_ID` + Kemal'in kullanıcı id'sinden gelen mesajlar işlenir, diğerleri atılır.
4. Cevap vakaya bağlanır → `bekci-ajan.yml` `workflow_dispatch` ile vaka id + cevapla yeniden çalışır.
   "Açıkla" → ajan ayrıntılı açıklama yazar, vaka açık kalır. Serbest metin → ajan yorumlar, ne yapacağını
   **tek cümleyle** geri yazar ve uygulamadan önce bir kez [✅] ister (yanlış anlama sigortası).
5. Açık vaka her sabah tekrar hatırlatılır (bugünkü "susmaz" kuralı), 14 gün sonra "hâlâ açık" diye işaretlenir.

### 2.3 Telegram botu
`getUpdates` bot başına **tek okuyucu** kabul eder. `sosyal/yayinci` kendi botunu okuyor. Bekçi botu ondan
ayrı olmalı: GitHub'daki `TELEGRAM_BOT_TOKEN` yayıncı botuyla aynıysa bekçi için **yeni bot** açılır
(`TELEGRAM_BEKCI_BOT_TOKEN`). Mesaj gönderen mevcut bekçiler etkilenmez (sendMessage çakışmaz).

## 3. Güvenlik korkulukları (guvenlik incelemesine açık)

| Risk | Önlem |
|---|---|
| Prompt injection: indirilen PDF/HTML içinde "şunu yap" metni | Kaynak **veri** olarak verilir; ajanın ağ erişimi yalnız bekçi allowlist'indeki hostlar; ajan job'ında yazma yetkisi YOK (`contents: read`), çıktısı yalnız yama + karar.json artefaktı |
| Ajan yanlış dosyayı değiştirir | Doğrulayıcı yama yolunu bekçi başına **izinli dosya listesine** karşı kontrol eder (fiyat: `billing/codes/*_positions.js`; kostenträger: yeni seed/migration dosyası). Dışarısı = vaka |
| Yazma yetkisi | Uygulama ayrı job'da (`contents: write`), `npm ci` ve proje kodu çalıştırmadan yalnız yamayı uygular — preise-check'in bugünkü iki-job deseni (O-99, S-28) |
| Telegram'dan sahte komut | chat_id + from.id kontrolü; düğme verisi yalnız vaka id + eylem; vaka `acik` değilse cevap yok sayılır |
| Kaçak çalışma | Ajan yalnız repo değişkeni `BEKCI_AJAN` = `an` iken çalışır (varsayılan kapalı); `an` değilse bekçiler bugünkü gibi yalnız haber verir — acil fren = değişkeni silmek |
| Sessiz ölüm | Pazartesi sabahı tek satır nabız: "4 bekçi çalıştı, 0 açık vaka" |
| Public depo | Vaka dosyaları yalnız herkese açık bilgi içerir (resmî fiyat, kaynak URL'si); Kemal'in serbest metni vakaya **yazılmaz**, yalnız çıkarılan karar (`uygula/birak/aciklama`) yazılır |

### 3.0 guvenlik incelemesi (S-64, 24.11.2026) — bağlayıcı, veto şartları
1. **Ajan kod/SQL YAZMAZ, yalnız JSON değer üretir** (`{code, preis, zuzahlung, gueltig_ab, label, ...}`). JS'i ve seed SQL'ini
   deterministik üretici yazar (`preise_autoupdate` / `sync_heilmittel_katalog` / `seed-generieren`). Diff kapısı:
   "bilinen satır biçiminde yalnız literal değişti"; başka her şey = ret. Yeni kod/kaybolan kod = **her zaman vaka**.
2. **Kostenträger SQL'i yalnız parser üretir**; kapı yalnız kostentraeger tablolarına INSERT/UPSERT kabul eder (aksi = mandant vetosu).
3. Çift dikişin bir bacağı **her zaman deterministik ayrıştırma** (XML/XLSX). İki YZ okuması tek başına sayılmaz (ikisi de aynı zehirli kaynağı okur).
4. Ajan job'ı: tetik yalnız `schedule` + `workflow_dispatch` (`issue_comment`/`pull_request_target` YASAK); ajana Bash/WebFetch/
   dosya yazma YOK (yalnız çıktı dosyası); kaynağı önceki adım indirir; action commit SHA ile sabit; sırlar yalnız `main`'e açık
   GitHub Environment `bekci`'de; Telegram token ajan job'ına girmez; loglara Kemal'in cevabı / getUpdates çıktısı basılmaz
   (curl çıktısı `-o /dev/null` — bugünkü bekçiler sohbet adını public loga basıyor, düzeltilecek).
5. Telegram mesajındaki rakamlar **diff'ten deterministik** basılır + yamanın SHA-256'sı; "Uygula" yalnız aynı SHA'lı yamayı uygular (TOCTOU).
6. Apply job `bekci-vakalar` dal içeriğine güvenmez: yamayı `main` checkout'undaki `dogrula.mjs` ile yeniden doğrular; symlink,
   mode değişikliği, rename, binary reddedilir.

### 3.0b Uygulamada netleşenler (24.11.2026, iki soğuk denetim turu sonrası)
- **Faz 2'de ajan hiçbir yama üretmez.** Ajanın etkisi iki şeyle sınırlı: `karar.json` (sıkı şemayla doğrulanır) ve oradan
  çıkan `erlaube_sprung` kod listesi. Yamayı her zaman `preise_autoupdate.mjs` XML'den üretir. Otomatik yol = bugünkü
  otomatik yolun aynısı, tek farkla: sözleşme metniyle birebir doğrulanmış kodlarda %15 korkuluğu atlanır.
- `dogrula.mjs` kapısı bu yüzden **ikinci emniyet**tir: yalnız veri satırı kalıplarına (tek satırlık pozisyon kaydı,
  `PREISSTAND`, fenster bloğu) izin verir, fonksiyon/tablo satırlarına hiç izin vermez. Genel amaçlı "her JS yamasını
  güvenli yap" kapısı değildir. Yeni kod / kaybolan kod Faz 2'de otomatik uygulanmaz (`elle`).
- Telegram sırları (`TELEGRAM_BEKCI_*`) **repo sırrı**: ortak yazma adımı (`preise-uebernehmen.yml`, `workflow_call`)
  ortam sırlarına erişemiyor. Claude jetonu `bekci-ajan` ortamında (yalnız `main`), yalnız `ajan` job'ında.
- Açma düğmesi: repo değişkeni `BEKCI_AJAN=an`. Yoksa hiçbir bekçi-ajan iş akışı çalışmaz, mevcut bekçiler bugünkü gibi.
- Serbest metin cevap Faz 1'de yok (Kemal'in metni public loga/dala düşmesin diye): yalnız düğmeler + `/vakalar`.

### 3.1 onprem incelemesi (O-257, 24.11.2026) — bağlayıcı
- **İzinli dosyalar (fiyat):** `billing/codes/*_positions.js` + heilmittel_katalog seed migration'ı + `db/erwartete-zaehler.json`.
  Seed'i ajan YAZMAZ: `sync_heilmittel_katalog.js --sql` üretir (O-95 tekrarlanmasın).
- **Yayın tetiği:** `GITHUB_TOKEN` push'u publish'i tetiklemez → uygulama job'ı push'tan sonra `gh workflow run publish-calendar-api.yml` (O-102).
  `bekci-vakalar` dalı `main`'e asla merge edilmez.
- **Rapor dürüstlüğü:** "`:beta`'ya çıktı, `:stable` için elle promote bekliyor"; `gueltig_ab` son promote'tan sonraysa uyarı satırı;
  migration eklendiyse "sonraki sürüm MINOR olmalı" (R6).
- **Kostenträger (Faz 4):** yalnız migration zinciri — `kostentraeger-annahmestellen-laden.mjs` → `seed-generieren.mjs` →
  `valid_from/valid_to` + md5 kanıtlı seed (O-139). Çalışma anında indirme yok, ajanın elle SQL'i yok. SaaS'a uygulama için
  Actions'ta DB sırrı gerekir → guvenlik kararı; o zamana kadar vaka "yerel oturumda uygula" der. Önce O-118 kapısı
  (`check-onprem.sh` kostentraeger) yazılır.

## 4. Bekçi başına plan

| Bekçi | Bugün | Ajanla |
|---|---|---|
| **Fiyat** (`preise-check`) | Güvenli fark → otomatik; geri kalanı (yeni/kaybolan kod, >%15, tarih çelişkisi) yalnız Telegram | needsReview → ajan Anlage 2/XML'i okur, yeni kod için etiket/diagnosegruppe/zuzahlung önerir, eski pencereyi kapatıp yenisini ekleyen yamayı yazar → çift dikiş → uygula ya da sor |
| **Kostenträger** (`kostentraeger-check`) | Yeni dosya → yalnız haber | Yeni dosyayı indirir, mevcut parser ile içe aktarım (geçerlilik tarihiyle) hazırlar; ajan farkı yorumlar (kaç IK değişti, alışılmadık sıçrama var mı) → çift dikiş → uygula ya da sor. **Şema/DB yolu db-ustasi ve onprem onayıyla kesinleşir (Faz 3)** |
| **Kaynak** (`quellen-waechter`) | Yeni belge → haber, "biliniyor" işaretini insan yapar | Ajan belgeyi indirir, eski sürümle karşılaştırır, "bizi etkiler mi, hangi dosyayı" çıkarır, kısa özet + öneri (biliniyor işaretle / iş kartı aç) → Kemal'in cevabıyla `bekannt` listesini günceller |
| **ITSG** | Otomatik | Yalnız hata olursa ajan teşhis eder ve sorar |
| publish-* / promote | — | Faz 4: build kırılırsa teşhis raporu (otomatik düzeltme yok) |

## 5. Fazlar

| Faz | İçerik | Bitti sayılır |
|---|---|---|
| **1** | Ortak çatı: `tools/bekci-ajan/` (telegram.mjs, vaka.mjs, dogrula.mjs) + `bekci-cevap.yml` + `bekci-ajan.yml` + birim testleri | Sahte bir vaka açılır, Telegram'a düşer, düğmeye basınca durum değişir (testte mock, canlıda bir deneme) |
| **2** | Fiyat bekçisini bağla | Uydurma bir needsReview bulgusuyla uçtan uca: ajan önerir → çift dikiş → vaka/uygulama |
| **3** | Kaynak bekçisi analizi | Bugünkü 5 yeni belge için Telegram'a özet düşer |
| **4** | Kostenträger otomatik içe aktarım | db-ustasi + onprem onayı, ardından test dosyasıyla uçtan uca |
| **5** | ITSG/publish hata teşhisi | — |

## 6. Kemal'den gerekenler (en sona toplu)
1. `claude setup-token` çalıştırıp çıkan jetonu GitHub → Settings → Secrets'a `CLAUDE_CODE_OAUTH_TOKEN` olarak eklemek.
2. Gerekirse BotFather'dan yeni bot (bkz. 2.3) + Kemal'in Telegram kullanıcı id'si.
3. İlk canlı vakada düğmeye basıp akışı denemek.
