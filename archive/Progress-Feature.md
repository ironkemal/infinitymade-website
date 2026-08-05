# Progress — Funktionen-Walkthrough Feature

> **Resume talimatı (yeni session/agent için):** Bu dosyayı oku, `FEATURE_BUILD_SPEC.md`'i
> oku, "SONRAKİ ADIM"dan devam et. Kullanıcı bilgisayar başında DEĞİL — tamamen özerk
> bitir. Heavy işi `agy` subagent'a delege et (orkestra şefi modeli), sen doğrula.
> Son adım: agy subagent ile tam-ekran screenshot alıp "tam istendiği gibi mi" test et.

**DURUM: ✅ TAMAMLANDI & DOĞRULANDI** (component kuruldu, desktop+mobil+etkileşim+console testi geçti).
agy subagent bağımsız final QA çalıştı → `FUNKTIONEN_QA_REPORT.md`.

**Son güncelleme:** Component canlı (`index.html` #funktionen). Token bitmeden bitti — 10%-handoff
ve 6:30-continue contingency'sine GEREK KALMADI (premise gerçekleşmedi). İş diskte, COMMIT EDİLMEDİ
(kullanıcı "commit only when asked" + GitHub repo'ya bağlı değil; kullanıcı isterse commit/push).

## Hedef
praxura.de `index.html` → `#funktionen` bölümünü, ürünün ~20 fonksiyonunu adım-adım
gerçek screenshot'larla anlatan interaktif "ekran" component'i ile değiştir
(sol fonksiyon listesi + sağ tarayıcı çerçevesi + nokta navigasyon + otomatik slideshow).
Tam detay: `FEATURE_BUILD_SPEC.md`.

## TAMAMLANAN
- [x] 19 panel screenshot'ı (Playwright + demo-dashboard, light tema) — `capture_funktionen.py`
- [x] 12 çok-adımlı akış karesi (rezept x3, §302 wizard x3, calendar/patient/invoice/trip/anamnese/dunning modalları) — `capture_flows.py`
- [x] **demo-dashboard.html'e yeni KI-Rezept-Scan modal eklendi** (3-adım wizard: Upload→OCR→Geparst+Absetzungscheck) + §302 panel başlığında "KI-Rezept-Scan" tetik butonu + JS (`openRezeptScan`, `navigateRezeptScan`, `updateRezeptScanStep`). Tutarlı light temada, gerçek parsed data (Peter Mustermann, M54.41 vb.).
- [x] 31 görsel webp'e optimize → `assets/img/fn/*.webp` (1600px, toplam 1.4MB, ort 46KB)
- [x] `FEATURE_BUILD_SPEC.md` yazıldı (tüm fonksiyon metinleri DE + tasarım tokenّları + yapı/davranış + kabul kriterleri)

## İTERASYON 2 (2026-06-05) — kullanıcı geri bildirimi uygulandı
- **Demo modal (demo-dashboard.html KI-Rezept-Scan):** step 2 (KI tarıyor) artık ~1.8s sonra
  KENDİ otomatik step 3'e geçiyor ("Weiter" yok); step 3 gerçek-dashboard stilinde DETAYLI
  parsed form (Patient/Arzt/Verordnung alanları, yeşil-çerçeveli değerler, "Gescanntes Original");
  her adımda **info bubble** (ⓘ) eklendi; modal 720px'e genişledi.
- **Marketing component (index.html #funktionen):** ekran üzerinde **radar gibi nabız atan kırmızı
  hotspot'lar** (`.fnx-hot`, --rose) + **info bubble** (`.fnx-bubble`); hotspot'a basınca SONRAKİ
  ekran görüntüsüne geçer. Her adımda hx/hy/hi verisi (FN objesinde). **Adım-bazlı süre** (`dur`):
  rezept tarama adımı hızlı (1.4s) → sonuca "bam"; autoplay setTimeout-recursive.
- **6:30 schedule kuruldu:** routine `trig_018ebUiEKvu5peJbhPbEXBrK`, 2026-06-05 04:30 UTC (06:30 Berlin),
  graceful prompt (repo'da feature yoksa yeniden inşa etmez, sadece QA/polish). ⚠ GitHub'a bağlı
  değil + iş push'lanmadı → uzak ajan muhtemelen feature'ı bulamayacak; gerçek fayda için /web-setup + push gerek.
- agy QA#2: PASS (hotspot 31/31 doğrulandı).

## agy FINAL QA SONUCU: ✅ PASS
20 fonksiyon / 31 adım test edildi · 0 bozuk görsel · 0 console hatası · 0 pageerror ·
mobil yatay rail doğrulandı · "kullanıcı isteği tamamen karşılanıyor". Detay: `FUNKTIONEN_QA_REPORT.md`,
QA screenshot'lar: `C:/tmp/agyqa/`.

## KALAN (opsiyonel, kullanıcıya bırakıldı)
- **Commit/push:** İş diskte hazır, commit edilmedi (GitHub repo'ya bağlı değil; "commit only when asked"). Kullanıcı isterse: branch + commit + push.
- **i18n EN/TR:** Atlandı — index.html'de dil değiştirici yok (DE-only). FN_I18N yapısı hazır; switcher eklenirse doldurulabilir.
- **6:30 schedule:** Kurulmadı — iş token bitmeden tamamlandı (contingency premise'i gerçekleşmedi) + uzak ajan local uncommitted işe erişemez. Sabah polish isterse kullanıcı kurabilir.

## (TARİHSEL) Build sırasındaki sonraki adımlar — tamamlandı
1. **Component build** (agy'a delege edildi / doğrulanacak): `index.html` #funktionen'i spec'e göre interaktif component ile değiştir. Eski `px-features-2x2` 4 kartı kaldır. CSS'i head `<style>`'a, JS'i `</body>` öncesi ekle. Sadece system.css tokenّları.
2. **Doğrula:** `python -m http.server 8899` (website dir) → Playwright ile `http://127.0.0.1:8899/index.html#funktionen` screenshot al, görsel kontrol. Konsol hatası yok mu? Slayt/nokta/otomatik-geçiş çalışıyor mu?
3. **i18n EN/TR** (agy'a delege): `FN_I18N.en` + `.tr` doldur (de zaten var). Site DE-only ama yapı hazır olsun.
4. **Final test** (agy subagent): tam-ekran screenshot'larla "tam istendiği gibi mi" değerlendir, rapor.
5. Gözden geçir, gerekirse polish. Commit (kullanıcı isterse push).

## Ortam / komutlar
- Local server: `cd website && python -m http.server 8899 --bind 127.0.0.1 &`
- Capture tekrar: `python capture_funktionen.py` (panels), `python capture_flows.py` (flows) — server açıkken
- Optimize: Pillow var (q82, 1600px webp → assets/img/fn/)
- agy delege: `agy -p "$(cat <prompt-file>)" --dangerously-skip-permissions` (yerel, dosyalara erişir)
- Görseller: `assets/img/fn/<slug>.webp` (slug listesi spec'te)

## Notlar / kararlar
- Eski koyu-tema `app ss/` rezept görselleri KULLANILMADI (tutarsız tema) — yerine demo-dashboard'a yeni modal eklenip yakalandı.
- Site DE-only (index.html'de lang switcher yok). DE varsayılan, EN/TR yapısal hazır.
- Accent = `--bronze`/`--rose`; krem zemin `--bg`; Fraunces serif. AI-slop/gradient/emoji YASAK (kullanıcı daha önce reddetti).
- 6:30 (token yenilenme) için /schedule kurulacak; ⚠ GitHub repo'ya bağlı DEĞİL → uzak ajan local uncommitted işi göremez. Gerçek resilience = bu handoff + local fresh session. Schedule yine de kuruluyor (kullanıcı isteği).
