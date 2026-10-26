---
titel: GKV_LEISTUNGSKATALOG Physio/Ergo/Logo — Denetim gegen Anlage 2 + HPNR 2026
typ: sitzung
angelegt: 2026-10-26
autor: gkv-302 (Claude Code)
tags: [sitzung, gkv-302, leistungskatalog, physio, ergo, logo, hpnr, preise]
---

# §302 Değerlendirme — GKV_LEISTUNGSKATALOG (Physio · Ergo · Logo)

Tarih: 2026-10-26 · Spesifikasyon: Anlage 2 §125 SGB V (Physio Lesefassung ab 01.01.2026 · Ergo Lesefassung Stand 01.07.2026 · SSSST i. d. F. 12.02.2026) + Heilmittelpositionsnummernverzeichnis gültig ab 01.01.2026
Leistungserbringergruppe: Physio · Ergo · Logo

> ⚠️ Bu not kaynak değildir (bkz. [[SITZUNGEN]]). Fatura iddiası her zaman orijinal + bölüm + Fassung'a dayanır.

## Özet

`GKV_LEISTUNGSKATALOG` **`module/leistungskatalog.js`'te değil, `dashboard.js:8390-8481`'de** duruyor
(`module/leistungskatalog.js` yalnız `katalogNachladen()` bekçisini içeriyor). 20 satır incelendi:

| Alan | Satır | Sahte kod | Fiyat yanlış | Etiket/süre yanlış |
|---|---|---|---|---|
| Physio | 11 | 0 | 0 (koda göre) | **X0102** etiketi yanlış (fiilen yanlış hizmet → yanlış fiyat), **X1201** süre etiketi yanlış |
| Ergo | 4 | **4/4** (`ET1`–`ET4`) | **4/4** | HLT süresi 60 → doğrusu 45 |
| Logo | 5 | **5/5** (`09560`–`09580`) | **5/5** | Stimm/Schluck ayrımı uydurma — fiyat Heilmittel'e değil süreye bağlı |

Toplam: **9 sahte kod**, **9 yanlış fiyat** + 1 anlamsal yanlış (X0102). Physio fiyatları koda göre doğru.

Ayrıca: **Ergo'nun arşivdeki Anlage 2'si (Stand 01.06.2024) üç kez geçersiz kılınmış** — geçerli Fassung
**Lesefassung Stand 01.07.2026** (Schiedsstelle 1 HE 12-26). Arşivde yok; `wissensbank` ajanına giriş için verildi (aşağıda).

## Bulgular

| # | Konu | Kaynak | Etki | Durum |
|---|---|---|---|---|
| 1 | Ergo `ET1`–`ET4` gerçek HPNR değil | HPNR-Verzeichnis 2026 CSV; Ergo Anlage 2 Stand 01.07.2026 | `services.gkv_position_nr`'a sahte kod seed edilir → §302 dosyasında **red** | Açık |
| 2 | Ergo fiyatları uydurma (55/78/74/95) | Ergo Anlage 2 Stand 01.07.2026 Teil A | Hatalı fatura tutarı, Absetzung | Açık |
| 3 | Logo `09560`–`09580` gerçek HPNR değil | HPNR CSV (yok); SSSST Anlage 2 §6 | **Red** | Açık |
| 4 | Logo fiyatları uydurma (54/72/92/74/54) | SSSST Anlage 2 §6 | Hatalı tutar | Açık |
| 5 | Physio X0102 "Massage Einzel 20–30 Min" | Physio Anlage 2 Teil A: X0102 = Unterwasserdruckstrahlmassage | **Sessiz yanlış hesap**: KMT yapan praxis X0102 ile 33,75 € faturalar (doğrusu X0106 21,63 €) — Prüfung'da Absetzung/Rückforderung | Açık |
| 6 | Physio X1201 `duration_label '20–30'` | Teil A: MT Regelbehandlungszeit 15–25 | Yalnız görünüm; fatura etkisi yok | Açık |
| 7 | Arşivdeki Ergo Anlage 2 eskimiş | Änderungsvereinbarung 25.07.2025 + Lesefassung 01.07.2026 | INDEX/REGISTER "✅ GEÇERLİ" diyor — yanlış | Açık |
| 8 | `.txt` (`-layout`) dosyalarında Pos.-Nr ↔ fiyat kayması | Physio/Ergo/Logo `.txt` | Okuyan yanlış eşler (ör. Logo txt Z.199'da 33103 ↔ 95,10 görünüyor; doğrusu 33104) | Açık |
| 9 | `billing/codes/README.md` önek listesi yanlış | Anlage 2'lerin "X ersetzen" bölümleri | Doküman hatası, kod değil | Açık |
| 10 | Backend'de Ergo/Logo fiyat kaynağı yok; `resolvePreis` Physio'ya düşer | `api-backend/billing/preise/resolver.js:66-70` | Ergo/Logo GKV faturası 0 € veya çakışma (59701 → physio X9701 1,40 €) | Bilinçli beklemede (vertikal sıralama) |
| 11 | `sync_heilmittel_katalog.js` Physio satırlarına `gueltig_ab='1900-01-01'` yazıyor | `sync_heilmittel_katalog.js:63-77` | 2027 fiyat penceresi geldiğinde aynı anahtar (bereich|code|gueltig_ab) → eski pencere ezilir, tarihçe kaybolur | Açık |

### Bulgu 5 — Physio X0102 yanlış etiket
**Spesifikasyon der ki:** Physio Anlage 2, Lesefassung gültig ab 01.01.2026, Teil A: "X0102 Unterwasserdruckstrahlmassage (Regelbehandlungszeit 15 bis 20 Minuten) 33,75 3,38" · "X0106 Klassische Massagetherapie (KMT) (Regelbehandlungszeit 15 bis 20 Minuten) 21,63 2,16". HPNR CSV Z.7: `20102 … Massage,Unterwasserdruckstrahlmassage`; Z.23: `20106 … Klassische Massagetherapie (KMT)`.
**Kodda:** `dashboard.js:8401` → `{ code: 'X0102', kuerzel: 'MAS', title: 'Massage Einzel', duration: 25, duration_label: '20–30', price: 33.75 … }`
**Fark:** Kod/fiyat çifti X0102 için doğru, ama etiket "Massage Einzel" — terapist bunu KMT sanar.
**Etki:** Sessiz yanlış hesap. Verordnung'da KMT varken dosyaya UWM kodu gider → Prüfstelle Verordnung↔Leistung uyuşmazlığı → Absetzung; geçerse 12,12 € fazla ödeme → sonradan Rückforderung.
**Düzeltme:** Satırı `X0106 · KMT · Klassische Massagetherapie (KMT) · 15–20 · 21,63` ile değiştir. Zaten seed edilmiş `services` satırları için `migratePodologieLegacyServices()` desenindeki gibi tek seferlik düzeltme (X0102 "Massage Einzel" → X0106) — yoksa autoSeed X0106'yı yanına ekler, eski hatalı kart kalır.

### Bulgu 1–4 — Ergo/Logo uydurma
**Kodda:** `dashboard.js:8467-8480`.
**Spesifikasyon der ki:** aşağıdaki "Doğru katalog" tabloları. `ET1..ET4` ve `09560..09580` HPNR CSV'de **yok** (`grep` → 0).
Logo'da fiyat Heilmittel'e (Stimm/Sprech/Sprach/Schluck) göre değil yalnız Regelbehandlungszeit'e (30/45/60) göre ayrışır — SSSST Anlage 2 §6 tek pozisyon ailesi "Stimm-, sprech-, sprach- und schlucktherapeutische Therapie", ve Leistungsbeschreibung Änderung 12.02.2026 Art. 2 e)–h) dört Heilmittel için aynı süre tablosunu verir.
**Etki:** Bugün ergo/logo praxis'i Leistungen'i açtığında `autoSeedGkvServices()` (`dashboard.js:8323-8348`) sahte kodu ve uydurma fiyatı `services`'e **kalıcı yazar**. GKV faturasında fiyat `GKV_PRICES`'ta olmadığı için `services.price`'tan gelir (`dashboard.js:13104-13109`, `13352-13354`) → uydurma tutar faturaya girer; DTA'da sahte HPNR → red.
**Düzeltme:** aşağıda.

### Bulgu 8 — `-layout` metin kayması (önemli okuma tuzağı)
Üç Anlage 2 `.txt`'sinde Pos.-Nr sütunu ile fiyat sütunu farklı satırlarda duruyor:
- Logo `.txt` Z.191-201: "ZL: 33103 … 95,10" aynı satırda görünüyor — **yanlış**; doğru sıra 33102=57,06 · 33122=57,06 · 33103=76,06 · 33123=76,06 · 33104=95,10.
- Ergo 2024 `.txt` Z.54: "X4002 … 52,77" — doğrusu X4002=38,43, X4102=52,77.
- Physio `.txt` Z.46-57: X0102…X0201 kodları bir blokta, fiyatlar ayrı satırlarda.

Bu denetimde eşleme `pdftotext -enc UTF-8 -raw` çıktısından yapıldı (satır sırası = okuma sırası); aşağıdaki "raw Z." numaraları bu komutun çıktısına aittir. **Öneri (`wissensbank`):** her Anlage 2 için `-raw` türevi de üretilsin; tablo okuması ondan yapılsın.

### Bulgu 9 — `billing/codes/README.md` önek listesi
README: "`1` = Physiotherapie · `2` = Podologie · `3` = Stimm… · `4` = Ergotherapie · `5` = Ernährungstherapie". Belgeler ise:
- Physio Anlage 2 Teil A: "1 - Masseur, Masseur und med. Bademeister · 2 - Krankengymnast/ Physiotherapeut · 6 - Krankenhaus · 8 - … Kurorten" (X yerine).
- Ergo Anlage 2 (2024 ve 01.07.2026): "5…. Zugelassener Leistungserbringer gemäß § 124 Absatz 1 SGB V · 6…. Krankenhaus · 8…. Kurorten" → X4102 → **54102**.
- Logo SSSST §6: numaralar açık yazılı, X yok: "ZL: 33102 · KH: 63102 · KB: 83102" → zugelassen = **3xxxx**.
- Podologie: 78xxx/79xxx (mevcut `podologie_positions.js`).
README'deki "4 = Ergo" ve "2 = Podologie" yanlış; düzeltilmeli (`builder`).

## Physio — satır satır

Kaynak: `wissensbank/physiotherapie/20251201_Physiotherapie_Vertrag_125_Anlage_2_barrierefrei.pdf`, Teil A "Für Behandlungen, die ab dem 01.01.2026 durchgeführt werden" (`.txt` Z.42). Raw Z. = `pdftotext -raw` satırı. Referans `api-backend/billing/codes/physio_positions.js` bu 11 satırın hepsinde belgeyle **birebir uyumlu** (fiyat, Zuzahlung, Regelbehandlungszeit).

| dashboard.js | Kod | Katalog etiketi | Gerçek (HPNR CSV) | Fiyat kat./belge | Zuz. | Süre kat. / belge | Raw Z. | physio_positions.js | Hüküm |
|---|---|---|---|---|---|---|---|---|---|
| 8392 | X0501 | KG Einzel | 20501 Allg. KG Einzelbehandlung (CSV Z.107) | 29,63 / 29,63 | 2,96 | 25 (15–25) / 15–25 | 111/115 | Z.49 | ✅ |
| 8393 | X1201 | Manuelle Therapie | 21201 MT Einzelbehandlung (CSV Z.327) | 35,59 / 35,59 | 3,56 | 25 (**20–30**) / 15–25 | 253/256 | Z.74 | ⚠️ süre etiketi |
| 8394 | X0201 | MLD 45 | 20201 (CSV Z.35) | 53,94 / 53,94 | 5,39 | 45 / 45 | 56/60 | Z.37 | ✅ |
| 8395 | X0202 | MLD 60 | 20202 (CSV Z.39) | 71,94 / 71,94 | 7,19 | 60 / 60 | 71/75 | Z.38 | ✅ |
| 8396 | X0507 | KG-Gerät | 20507 (CSV Z.131) | 55,81 / 55,81 | 5,58 | 60 / 60 | 122/126 | Z.51 | ✅ |
| 8397 | X0710 | KG-ZNS Bobath Erw. | 20710 (CSV Z.211) | 47,06 / 47,06 | 4,71 | 30 (25–35) / 25–35 | 190/196 | Z.62 | ✅ |
| 8398 | X0711 | KG-ZNS Vojta Erw. | 20711 (CSV Z.215) | 47,06 / 47,06 | 4,71 | 30 / 25–35 | 214/220 | Z.64 | ✅ |
| 8399 | X0712 | KG-ZNS PNF | 20712 (CSV Z.219) | 47,06 / 47,06 | 4,71 | 30 / 25–35 | 221/227 | Z.65 | ✅ |
| 8400 | X0702 | KG-Muko | 20702 (CSV Z.176) | 88,94 / 88,94 | 8,89 | 60 / 60 | 151/158 | Z.55 | ✅ |
| 8401 | X0102 | **Massage Einzel** | 20102 **Unterwasserdruckstrahlmassage** (CSV Z.7) | 33,75 / 33,75 | 3,38 | 25 (**20–30**) / 15–20 | 40/43 | Z.32 | ❌ etiket+süre |
| 8402 | X1104 | Traktion | 21104 Traktion mit Gerät (CSV Z.323) | 8,63 / 8,63 | 0,86 | 10 / 10–20 | 249/252 | Z.73 | ✅ |

`GKV_PRICES` (`dashboard.js:8353-8387`): 56 değerin tamamı Teil A ile aynı; yalnız X9701 (1,40 €) eksik. Kaynak ikiliği burada da var (aşağı bkz.).

### Physio — önerilen katalog (geçerlilik 01.01.2026, bir pencere)

LE-Gruppe 22 00 501 → önek **2**; 21 00 501 (Masseur) → **1**. Katalogda X-biçimi kalmalı (`resolvePositionsnummer()` çözüyor) çünkü iki önek de müşteri olabilir.

| Pos. (X) | PT → | Etiket | Regelbehandlungszeit | Preis | Zuz. | gültig ab | Raw Z. |
|---|---|---|---|---|---|---|---|
| X0501 | 20501 | Allgemeine Krankengymnastik (KG) Einzel | 15–25 | 29,63 | 2,96 | 01.01.2026 | 111-115 |
| X1201 | 21201 | Manuelle Therapie Einzel | 15–25 | 35,59 | 3,56 | 01.01.2026 | 253-256 |
| X0205 | 20205 | MLD 30 Min (Teilbehandlung) | 30 | 35,97 | 3,60 | 01.01.2026 | 77-81 |
| X0201 | 20201 | MLD 45 Min (Großbehandlung) | 45 | 53,94 | 5,39 | 01.01.2026 | 56-60 |
| X0202 | 20202 | MLD 60 Min (Ganzbehandlung) | 60 | 71,94 | 7,19 | 01.01.2026 | 71-75 |
| X0204 | 20204 | Kompressionsbandagierung einer Extremität | — | 22,92 | 2,29 | 01.01.2026 | 76 |
| X0507 | 20507 | KG-Gerät (parallel bis 3 Pat.) | 60 | 55,81 | 5,58 | 01.01.2026 | 122-126 |
| X0601 | 20601 | KG Gruppe (2–5) | 20–30 | 13,26 | 1,33 | 01.01.2026 | 127-133 |
| X0710 | 20710 | KG-ZNS Bobath Erwachsene | 25–35 | 47,06 | 4,71 | 01.01.2026 | 190-196 |
| X0711 | 20711 | KG-ZNS Vojta Erwachsene | 25–35 | 47,06 | 4,71 | 01.01.2026 | 214-220 |
| X0712 | 20712 | KG-ZNS PNF | 25–35 | 47,06 | 4,71 | 01.01.2026 | 221-227 |
| X0708 | 20708 | KG-ZNS-Kinder Bobath (bis 18) | 30–45 | 58,83 | — | 01.01.2026 | 168-174 |
| X0709 | 20709 | KG-ZNS-Kinder Vojta (bis 18) | 30–45 | 58,83 | — | 01.01.2026 | 183-189 |
| X0702 | 20702 | KG-Muko Einzel | 60 | 88,94 | 8,89 | 01.01.2026 | 151-158 |
| X0106 | 20106 | Klassische Massagetherapie (KMT) | 15–20 | 21,63 | 2,16 | 01.01.2026 | 44-47 |
| X0107 | 20107 | Bindegewebsmassage (BGM) | 20–30 | 25,98 | 2,60 | 01.01.2026 | 48-51 |
| X0301 | 20301 | Übungsbehandlung Einzel | 10–20 | 13,68 | 1,37 | 01.01.2026 | 82-85 |
| X1104 | 21104 | Traktionsbehandlung mit Gerät | 10–20 | 8,63 | 0,86 | 01.01.2026 | 249-252 |
| X1302 | 21302 | Elektrotherapie Einzel | 10–20 | 8,43 | 0,84 | 01.01.2026 | 262-265 |
| X1501 | 21501 | Warmpackung | 20–30 | 16,16 | 1,62 | 01.01.2026 | 291-295 |
| X1534 | 21534 | Kältetherapie | 5–10 | 11,95 | 1,20 | 01.01.2026 | 316-320 |
| X2001 | 22001 | D1 Standardisierte Heilmittelkombination | 60 | 70,45 | 7,05 | 01.01.2026 | 349-367 |
| X9950 | 29950 | Hausbesuch inkl. Wegegeld (ex X9933) | — | 22,78 | 2,28 | 01.01.2026 | 372-380 |
| X9951 | 29951 | Hausbesuch soziale Einrichtung (ex X9934) | — | 13,09 | 1,31 | 01.01.2026 | 381-400 |

Hangi satırların "Standardleistung kartı" olarak gösterileceği ürün kararıdır (`physio` ajanı); sayılar yukarıdaki gibi `physio_positions.js`'ten gelmeli. X0708/X0709/X0805 Zuzahlung'suz ("-").

## Ergo — satır satır

**Geçerli sürüm tespiti:**
1. Arşiv: `wissensbank/ergotherapie/20240531_…_BF.txt` — "Lesefassung Stand vom 01.06.2024" (Z.4), "Für Behandlungen, die ab dem 01.06.2024 erbracht werden" (Z.47), kündbar "frühestens jedoch zum 31.03.2025" (Z.509).
2. GKV-SV, 25.07.2025 Änderungsvereinbarung (1 HE 4-25): "…die Anlage 2 in der Fassung vom 01.06.2024 durch die Anlage 2 in der Fassung vom 25.07.2025 zu ersetzen." → iki pencere: "Diese Preisliste gilt für den Zeitraum vom 01.08.2025 bis 30.09.2025" ve "Für Behandlungen, die ab dem 01.10.2025 erbracht werden". Hausbesuch X9933/X9934 → **X9952/X9953**, Übermittlungsgebühr X9701 → **X9702** (HPNR CSV Z.1636, 1915, 1918: `gültig ab 2025-08-01`).
3. **Geçerli:** "Lesefassung Stand 01.07.2026", dipnot "Diese Anlage wurde durch die Schiedsstelle (1 HE 12-26) festgesetzt"; B(8) "Die Vergütungssätze gelten für Behandlungen, die ab dem 01.07.2026 erbracht werden. Diese dürfen frühestens zum 01.08.2026 erstmals abgerechnet werden."; B(9) kündbar "frühestens jedoch zum 31.03.2027".

Kaynak URL'leri (depoya alınmadı — `wissensbank` girişine verildi):
- `https://www.gkv-spitzenverband.de/media/dokumente/krankenversicherung_1/ambulante_leistungen/heilmittel/vertraege_125abs1/ergotherapie/20260629_Vertrag_125_Ergotherapie_Anlage_2.pdf` (MD5 `bc5f0c23ba625d1b7c2ad7d514103e0b`, 10 s.)
- `https://www.gkv-spitzenverband.de/media/dokumente/krankenversicherung_1/ambulante_leistungen/heilmittel/vertraege_125abs1/ergotherapie/20250725_Ergotherapie_Aenderungsvereinbarung_Anlage_2_bf.pdf` (MD5 `cd4c26ea74c218308a8a04763069089a`)
- Fassung 25.07.2025 Lesefassung — yalnız AOK kopyası bulundu: `https://www.aok.de/gp/fileadmin/user_upload/Heilmittel/Ergotherapie/20250725_Anlage_2_Vertrag_125_Ergotherapie_gueltig_ab_01.08.2025_bf.pdf` (MD5 `a5561023732b6a9fd4567810dc1b5f28`; GKV-SV orijinali aranmalı)

**Mevcut katalog (`dashboard.js:8467-8472`) vs gerçek (Stand 01.07.2026):**

| Katalog | Etiket | Gerçek Pos. | Fiyat kat. / belge | Süre kat. / Regelleistungszeit | Hüküm |
|---|---|---|---|---|---|
| ET1 | Motorisch-funktionelle Behandlung | X4102 → 54102 (CSV Z.1073) | 55,00 / **59,27** | 45 / 45 (30 Therapiezeit) | ❌ kod ❌ fiyat |
| ET2 | Sensomotorisch-perzeptive Behandlung | X4103 → 54103 (CSV Z.1076) | 78,00 / **79,03** | 60 / 60 (45) | ❌ kod ❌ fiyat |
| ET3 | Hirnleistungstraining / neuropsych. Üben | X4104 → 54104 (CSV Z.1079) | 74,00 / **59,27** | **60** / 45 (mind. 30) | ❌ kod ❌ fiyat ❌ süre |
| ET4 | Psychisch-funktionelle Behandlung | X4105 → 54105 (CSV Z.1082) | 95,00 / **98,79** | 75 / 75 (60) | ❌ kod ❌ fiyat |

### Ergo — önerilen katalog (Preisstaffel)

Önek: zugelassener LE → **5** (Ergo Anlage 2 Teil A). Kod tam 5 haneli saklanabilir (`54102`); KH/KB müşterimiz değil.
Raw Z.: 2024 = arşiv PDF'in `-raw` çıktısı; 2025 = Fassung 25.07.2025 `-raw`; 2026 = Lesefassung 01.07.2026 `-raw`.

| HPNR | Etiket | Regelleistungszeit / Therapiezeit | 01.06.2024 | 01.08.2025 | 01.10.2025 | **01.07.2026** | Raw Z. 2026 |
|---|---|---|---|---|---|---|---|
| 54002 | Analyse des ergotherapeutischen Bedarfs (1× je Verordnungsfall) | — | 38,43 / 3,84 | 42,98 / 4,30 | 41,46 / 4,15 | **43,16 / 4,32** | 46-50 |
| 54102 | Motorisch-funktionelle Behandlung Einzel | 45 / 30 | 52,77 / 5,28 | 59,02 / 5,90 | 56,93 / 5,69 | **59,27 / 5,93** | 51-53 |
| 54103 | Sensomotorisch-perzeptive Behandlung Einzel | 60 / 45 | 70,36 / 7,04 | 78,69 / 7,87 | 75,91 / 7,59 | **79,03 / 7,90** | 58-60 |
| 54104 | Ergoth. Hirnleistungstraining Einzel | 45 / mind. 30 | 52,77 / 5,28 | 59,02 / 5,90 | 56,93 / 5,69 | **59,27 / 5,93** | 65-68 |
| 54105 | Psychisch-funktionelle Behandlung Einzel | 75 / 60 | 87,95 / 8,80 | 98,36 / 9,84 | 94,89 / 9,49 | **98,79 / 9,88** | 74-76 |
| 54209 | Motorisch-funktionelle Gruppe (3–6) | 45 / 30 | — (doğrulanmadı) | 20,66 / 2,07 | 19,93 / 1,99 | **20,75 / 2,08** | 253-256 |
| 54301 | Thermische Anwendung (Wärme oder Kälte) | — | 7,89 / 0,79 | 8,82 / 0,88 | 8,51 / 0,85 | **8,86 / 0,89** | 289 |
| 59952 | Hausbesuch inkl. Wegegeld (2024: 59933) | — | 25,54 / 2,55 | 28,56 / 2,86 | 27,56 / 2,76 | **28,69 / 2,87** | 318-321 |
| 59953 | Hausbesuch soziale Einrichtung (2024: 59934) | — | 16,66 / 1,67 | 18,63 / 1,86 | 17,97 / 1,80 | **18,71 / 1,87** | 322-335 |
| 59702 | Übermittlungsgebühr Mitteilung/Bericht (2024: 59701) | — | 1,11 / — | 1,24 / — | 1,20 / — | **1,25 / —** | 307-309 |

2025 raw satırları: 01.08.2025 penceresi X4002 Z.36-40, X4102 41-43, X4103 48-50, X4104 55-58, X4105 64-66, X4209 233-236, X4301 269, X9702 283-285, X9952 294-297, X9953 298-311 · 01.10.2025 penceresi X4002 320-324, X4102 325-327, X4103 332-334, X4104 339-342, X4105 348-350, X4209 517-520, X4301 553, X9702 567-569, X9952 578-581, X9953 582-595.
2024 penceresi: arşiv `.txt` (layout) Z.47-365 — ⚠️ sütun kaymalı, değerler `-raw` sırasından alındı.

Not: 01.08.2025–30.09.2025 penceresi 01.10.2025'ten **yüksek** — belge böyle yazıyor (Vergleich 1 HE 4-25), yazım hatası değil.

## Logo — satır satır

Kaynak: `wissensbank/logopaedie/20260212_Vertrag_125_sssst_Anlage_2_Verguetungsvereinbarung.pdf` — "Diese Vergütungsvereinbarung tritt am 01.01.2026 in Kraft und gilt für Leistungen, die ab dem 01.07.2026 erbracht werden." (`.txt` Z.44-45). AOK'taki "sssst Änderungsvereinbarung ab 07 2026" kontrol edildi: Art. 3 aynı Anlage 2 i. d. F. 12.02.2026'yı koyuyor, Art. 4 a) "Artikel 1 und Artikel 3 treten zum 01.01.2026 in Kraft" — arşivdeki sürüm **günceldir**. Önceki Fassung "Schiedsspruch vom 12.11.2025 (4 HE-22-24)" — arşivde yok (01.07.2026 öncesi fiyatlar doğrulanamadı).

**Mevcut katalog (`dashboard.js:8473-8479`) vs gerçek:**

| Katalog | Etiket | Gerçek Pos. | Fiyat kat. / belge | Süre | Hüküm |
|---|---|---|---|---|---|
| 09560 | Sprachtherapie Einzel 30 | 33102 (CSV Z.876) | 54,00 / **57,06** | 30 RBZ / 45 RLZ | ❌ kod ❌ fiyat |
| 09561 | Sprachtherapie Einzel 45 | 33103 (CSV Z.880) | 72,00 / **76,06** | 45 / 60 | ❌ kod ❌ fiyat |
| 09562 | Sprachtherapie Einzel 60 | 33104 (CSV Z.884) | 92,00 / **95,10** | 60 / 75 | ❌ kod ❌ fiyat |
| 09570 | Schlucktherapie 45 | 33103 (aynı pozisyon) | 74,00 / **76,06** | 45 / 60 | ❌ kod ❌ fiyat ❌ ayrı pozisyon yok |
| 09580 | Stimmtherapie 30 | 33102 (aynı pozisyon) | 54,00 / **57,06** | 30 / 45 | ❌ kod ❌ fiyat ❌ ayrı pozisyon yok |

### Logo — önerilen katalog (ZL, gültig ab 01.07.2026)

| HPNR | Etiket | Regelbehandlungszeit / Regelleistungszeit | Preis | Zuz. | Raw Z. |
|---|---|---|---|---|---|
| 33010 | Erstdiagnostik (1. VO des Verordnungsfalls, nicht am Therapietag) | 60 / — | 120,86 | 12,09 | 103-121 |
| 33011 | Bedarfsdiagnostik (ab 2. VO; max. 2 Diagnostik-Einheiten/Kalenderjahr) | 30 / — | 60,43 | 6,04 | 122-137 |
| 33102 | Einzeltherapie 30 Min | 30 / 45 | 57,06 | 5,71 | 159-166 |
| 33103 | Einzeltherapie 45 Min | 45 / 60 | 76,06 | 7,61 | 176-183 |
| 33104 | Einzeltherapie 60 Min | 60 / 75 | 95,10 | 9,51 | 193-200 |
| 33220 | Gruppe 2 Pat., 45 Min (je Pat.) | 45 / 60 | 68,45 | 6,85 | 217-225 |
| 33223 | Gruppe 2 Pat., 90 Min (je Pat.) | 90 / 105 | 119,83 | 11,98 | 236-244 |
| 33222 | Gruppe 3–5 Pat., 45 Min (je Pat.) | 45 / 60 | 34,24 | 3,42 | 255-263 |
| 33224 | Gruppe 3–5 Pat., 90 Min (je Pat.) | 90 / 105 | 59,91 | 5,99 | 274-282 |
| 39901 | Hausbesuch inkl. Wegegeld | — | 23,06 | 2,31 | 309-321 |
| 33302 | Bericht an verordnende Ärztin/Arzt (Anhang A) | — | 6,72 | — | 324-338 |
| 33303 | Bericht auf besondere Anforderung (Anhang B/C) | — | 120,86 | — | 339-353 |

Telemedizin karşılıkları: 33122/33123/33124 (Einzel), 33240/33243/33242/33244 (Gruppe) — aynı fiyat.
Doppelbehandlung: "Sofern das Heilmittel als zusammenhängende Therapie (Doppelbehandlung) verordnet und erbracht wurde, kann die entsprechende Positions-Nr. zweimal abgerechnet werden." (§6, raw Z.~150).
Etiket önerisi: Heilmittel adı (Stimm/Sprech/Sprach/Schluck) **etikette değil Verordnung'da** durur; katalog kartı "Einzeltherapie 45 Min" olmalı.

## Yapı: `preise` staffeli ve `applyGueltigePreise`

`dashboard.js:8487-8498`: her satır `preise: { 'YYYY-MM-DD': preis }` taşıyorsa yükleme anında bugünkü pencere seçilip `price/price_min/price_max/gueltig_ab` yazılıyor. Physio/Ergo/Logo için aynı yapı doldurulabilir:
- Physio: `preise: { '2026-01-01': 29.63 }` (tek pencere).
- Ergo: dört anahtar (`2024-06-01`, `2025-08-01`, `2025-10-01`, `2026-07-01`) — tablo yukarıda.
- Logo: `preise: { '2026-07-01': … }` (öncesi doğrulanamadı → bugünkü tarih için yeterli).

**Eksikler (yapısal):**
1. **Zuzahlung taşınmıyor.** `preise` yalnız sayı. Öneri: `preise: { 'YYYY-MM-DD': { preis, zuzahlung } }` ya da paralel `zuzahlungen` haritası; `applyGueltigePreise` ikisini birlikte seçmeli. (Podologie satırları da aynı eksikliği taşıyor.)
2. **Seed sonrası güncellenmiyor.** `autoSeedGkvServices()` fiyatı `services.price`'a seed anında yazar (`dashboard.js:8340`). Pencere değişince `GKV_LEISTUNGSKATALOG` güncellenir ama `services` satırı eski fiyatla kalır. Physio'da `GKV_PRICES` bunu fatura ekranında örtüyor; Ergo/Logo'da örten yok → **sessiz yanlış hesap** (ör. 01.07.2026'dan önce seed edilmiş bir Ergo praxis'i). Fatura fiyatı her zaman katalogdan (tarihe göre) gelmeli, `services.price`'tan değil.
3. **Kodu değişen pozisyonlar.** Ergo HB 59933→59952, 59934→59953, Bericht 59701→59702 (01.08.2025). Staffel yalnız fiyatı değil **kodu** da tarihe göre değiştirebilmeli (`podologie_positions.js`'teki `ersetzt_durch`/`ungueltig_ab` alanları bunun için var).

## İki fiyat kaynağı olmasın — Physio türetimi

**Frontend `api-backend/`'i import edemez:** `.vercelignore` Z.47 `api-backend/` → Vercel'e çıkmıyor; tarayıcıdan `import '../api-backend/…'` canlıda 404. Bugün hiçbir canlı frontend dosyası api-backend import etmiyor (yalnız `module/heilmittel-suche-komplex.test.js` testte okuyor).

Seçenekler:
- **A — DB projeksiyonu üzerinden (mevcut yol):** `heilmittel_katalog` tablosu zaten `physio_positions.js` + `podologie_positions.js`'ten üretiliyor (`api-backend/sync_heilmittel_katalog.js`, kutuya `db/migrations/0012…` ile gidiyor) ve `preis_eur`, `zuzahlung_eur`, `dauer`, `gueltig_ab/bis` taşıyor. Leistungen ekranı kartları için kod listesi (hangi pozisyonlar "Standard") frontend'de kalır, **sayıların tamamı** `heilmittel_katalog`'tan okunur. Artı: tek kaynak, kutuda da çalışır. Eksi: `loadServices()` öncesi bir sorgu; ayrıca Bulgu 11 (Physio `gueltig_ab='1900-01-01'`) önce düzeltilmeli — `physioRows()` `PHYSIO_POSITIONS` yerine `PHYSIO_PREISFENSTER`'i gezmeli ve pencerenin `gueltig_ab/gueltig_bis`'ini yazmalı.
- **B — Üretilmiş modül + kapı:** `tools/` altında bir üretici `physio_positions.js`'ten `module/gkv-leistungskatalog.generated.js` yazar; `npm test`'e bir drift testi (`module/*.test.js` api-backend'i okuyabiliyor) eklenir. Artı: senkron, ağsız. Eksi: üretici çalıştırmayı unutma riski (test yakalar).

**Önerim: A**, çünkü projeksiyon zaten var ve `katalog-suche.js` aynı tabloyu okuyor; kutuya dağıtım (`onprem` sorusu) çözülmüş. `GKV_PRICES` (`dashboard.js:8353`) aynı adımda kaldırılıp fiyat `heilmittel_katalog`'tan (Leistungsdatum'a göre) çözülmeli. Ergo/Logo için önce backend'de `ergo_positions.js` / `logo_positions.js` (podologie_positions.js yapısında, `PREISFENSTER` dizisi) yazılmalı, `sync_heilmittel_katalog.js` onları da projekte etmeli, `resolvePreis()` `bereich`'e göre dallanmalı (Bulgu 10).

**Vertikal sıralamaya uygun en küçük adım (bugün):** Ergo/Logo kataloglarını boş diziye çek (`autoSeedGkvServices()` `!catalog.length` ile çıkar, `dashboard.js:8326`) — böylece sahte kod artık seed edilmez; doğru katalog Ergo/Logo ince ayarında `*_positions.js` ile gelir. Physio'da X0102→X0106 düzeltmesi ve X1201 süre etiketi hemen yapılabilir (geri alınabilir, küçük).

`dashboard.js` büyümemeli: katalog `module/gkv-leistungskatalog.js`'e taşınırsa dosya küçülür (kapı ile uyumlu).

## Doğrulanamayanlar

- Ergo Fassung 25.07.2025'in GKV-SV'deki orijinali — yalnız AOK kopyası okundu (başlık/LEGS GKV-SV belgesiyle aynı). `wissensbank` GKV-SV'den indirip doğrulamalı.
- Ergo 2024 penceresinde X4209 (Gruppe) fiyatı tabloya yazılmadı (bu denetimde okunmadı).
- Logo 01.07.2026 öncesi fiyatlar (Schiedsspruch 12.11.2025, 4 HE-22-24) — arşivde yok; 01.01.–30.06.2026 Leistungen için fiyat bilinmiyor.
- Ergo X4405/X4406 (Schiene) fiyatı Kostenvoranschlag'a bağlı, sabit değer yok.
- Hangi pozisyonların "Standardleistung" kartı olacağı ürün kararı (`physio` ajanı / Ergo-Logo ince ayarı).
- `services.duration_minutes` için Regelbehandlungszeit mi Regelleistungszeit mi kullanılacağı (Podologie'de `duration` = Regelleistungszeit, `therapiezeit` ayrı) — ürün kararı; sayılar iki türü de yukarıda.
- Mevcut beta praxis'lerinde `services` tablosunda kaç adet `ET*`/`095*`/`X0102` satırı olduğu (canlı DB'ye bakılmadı — `db-ustasi`).

## SPEC-RULES'a eklenenler

- "Heilmittelpositionsnummer önekleri (Physio 1/2, Ergo 5, Logo 3, Podologie 7)"
- "Ergo Vergütung: geçerli Fassung Lesefassung Stand 01.07.2026"
- "Logo: fiyat Heilmittel'e değil Regelbehandlungszeit'e bağlı"
- "Anlage 2 tablosu `-layout` txt'den okunmaz"
