# Belge Arşivi Haritası (INDEX)

> **Bu dosya arşivin tek giriş kapısıdır.** `Handbücher/`, `Podoloji/` ve `verordnung rezept/`
> klasörlerindeki tüm GKV/§302/Heilmittel belgelerinin ne olduğunu, hangi sürümde olduğunu ve
> ne zaman lazım olacağını listeler.
>
> Son güncelleme: 2026-08-04 · 33 belge kayıtlı

---

## 🔁 PROTOKOL — her belge okumasında uygulanır

Bu üç kural istisnasız işler. Bir dosyayı okumak istediğinde, kim istemiş olursa olsun:

**1. ÖNCE BURAYA BAK.**
Okumak istediğin dosyanın bu haritada kaydı var mı? Varsa çoğu zaman kaydı okumak yeterlidir —
dosyanın tamamını açma. Aradığın şey kayıtta yoksa devam et.

**2. HEDEFLİ OKU, TAMAMINI OKUMA.**
Kayıttaki "Anahtar bölümler" listesinden hangi bölümün lazım olduğunu belirle, `Grep` ile o
bölümü bul, sadece o aralığı oku. Bir belgenin tamamını okumak neredeyse her zaman hatadır
(bkz. aşağıdaki maliyet tablosu).

**3. SONRA BURAYA KAYDET.**
Haritada kaydı olmayan bir dosyayı okuduysan, okuma bitince aşağıdaki formatta kaydını
**bu dosyaya eklemek zorundasın.** Yeni bir belge arşive girdiğinde de aynısı geçerli.
Böylece arşiv her okumada kendini zenginleştirir ve aynı belge iki kez baştan okunmaz.

Kayıt formatı:
```
### <dosya yolu>
- **Ne:** <1-2 cümle, belgenin kendi başlığından>
- **Kapsam:** <içerdiği konular>
- **Sürüm:** <belgede yazan; yoksa "belirtilmemiş">
- **Anzuwenden ab:** <geçerlilik tarihi; yoksa "belirtilmemiş">
- **Ne zaman lazım:** <somut kullanım durumu>
- **Anahtar bölümler:** <bölüm no + başlık>
```

Bilinmeyen bir alana **"belirtilmemiş" yaz, tahmin etme.**

---

## 💸 Neden bu protokol var — maliyet tablosu

| Yöntem | Yaklaşık maliyet |
|---|---|
| `icd10gm2026syst_kodes.txt` (4.2 MB) tamamını okumak | **~1.000.000+ token** — imkânsız |
| `Anlage_1_TP5_V21` (507 KB) tamamını okumak | **~130.000 token** |
| `HeilM-RL` (221 KB) tamamını okumak | **~60.000 token** |
| Bu haritayı okumak | **~8.000 token** |
| Haritadan bölüm bulup `Grep` ile o kısmı okumak | **~1.000–3.000 token** |

---

## ✅ Hangi sürüm geçerli (2026-08-04 itibarıyla, kapak sayfalarından doğrulandı)

| Belge | Sürüm | Anzuwenden ab | Durum |
|---|---|---|---|
| **Anlage 1 TP5** — ana teknik spesifikasyon | **V21** | 01.10.2025 | ✅ **GEÇERLİ** (V20 31.12.2025'te düştü) |
| **Anlage 3 TP5** — Schlüsselverzeichnisse | **V21** | 01.10.2025 | ✅ **GEÇERLİ** |
| Anlage 3 TP5 | V22 | **01.02.2027** | ⏳ Gelecek — henüz uygulama |
| Anhang 03 Anlage 1 TP5 — Kostenträgerdatei | V10 | **01.02.2027** | ⏳ Gelecek |
| Anhang 05 Anlage 1 TP5 — Digitales Rettungsprotokoll | 1.0 | 01.04.2026 | ✅ Geçerli — **ama bizi ilgilendirmiyor** (Rettungsdienst, Heilmittel değil) |
| **HeilM-RL** | 15.05.2025 değişikliği | 05.08.2025 | ✅ **GEÇERLİ** |
| Korrekturverfahren Umsetzungsempfehlungen | — | 01.10.2025 | ✅ Geçerli |

**Kural:** kod yazarken/doğrularken **V21 esas alınır.** V22'ye geçiş 01.02.2027 öncesinde
yapılmaz; ancak o tarihe hazırlık için farkları önceden çıkarmak serbesttir.

---

## 📂 Arşiv düzeni

```
Handbücher/          §302 teknik anlagen, Verträge nach §125, değişiklik belgeleri
Podoloji/            Podologie'ye özel Leistungsbeschreibungen + Anlage 3 V21
verordnung rezept/   Heilmittel-Richtlinie, Diagnoseliste, ICD-10-GM veri paketi
_duplikate_2026-08-04/  Mükerrer kopyalar (karantina — silinmedi, git'te olmadıkları için)
```

**PDF'ler `.gitignore`'da** (`*.pdf`). Yani arşiv sürüm kontrolünde değil ve yedeklenmiyor —
ama `.txt` karşılıkları ve bu harita git'te izleniyor.

Her PDF'in yanında UTF-8 `.txt` karşılığı var (`pdftotext -enc UTF-8 -layout` ile üretildi).
**Arama ve okuma her zaman `.txt` üzerinden yapılır**, PDF açılmaz.

Kapsam dışı bırakılanlar: `verordnung rezept/Zip ICD/Zusatzdateien/` altındaki klinik ölçek
PDF'leri (Barthel-Index, MMSE, FIM, FRB, Adipositas) — kodumuz bunlara dokunmuyor.

---

# Belge kayıtları

## §302 TP5 — Çekirdek teknik anlagen

### Handbücher/Anlage_1_TP5_V21_20260115.txt
- **Ne:** § 302 Abs. 2 SGB V uyarınca „Sonstigen Leistungserbringern“ ile Hebammen ve Entbindungspflegern (§ 301a SGB V) faturalandırma usulünün form ve içeriğine ilişkin rehberlerin, düzeltme usulündeki faturalar dahil makineyle/elektronik veri aktarımı için hazırlanan Technische Anlage 1 belgesidir.
- **Kapsam:** Allgemeines, Teilnahmeverfahren / Voraussetzungen, Abwicklung des Datenaustausches, Datenübermittlung, Aufbau und Struktur der Nutzdaten (SLGA ve SLLA mesaj tipleri ve alt segmentleri), Fehlerverfahren (Prüfstufen 1-4), Rechnungen im Korrekturverfahren (Nachforderung, Zuzahlungsforderung, Korrekturrechnung), Datenannahmestellen, Schlüsselverzeichnisse, Testverfahren, Kostenträgerdatei.
- **Sürüm:** 21
- **Anzuwenden ab:** 01.10.2025*
- **Ne zaman lazım:** Diğer hizmet sunucuları ve ebelerin GKV kapsamında elektronik ortamda faturalandırma verisi ve düzeltme verisi oluşturması, yapılandırması ve iletmesi gerektiğinde lazımdır.
- **Anahtar bölümler:**
  - 5 AUFBAU UND STRUKTUR DER NUTZDATEN
  - 5.5 Nachrichtenaufbau und -inhalte
  - 6 FEHLERVERFAHREN
  - 7 RECHNUNGEN IM KORREKTURVERFAHREN
  - 9 SCHLÜSSELVERZEICHNISSE

### Handbücher/Anlage_3_TP5_V22_20260218.txt
- **Ne:** § 302 Abs. 2 SGB V uyarınca „Sonstigen Leistungserbringern“ ile Hebammen ve Entbindungspflegern (§ 301a SGB V) faturalandırma usulünün form ve içeriğine ilişkin rehberlerin anahtar dizinlerini (Schlüsselverzeichnisse) içeren Anlage 3 belgesidir.
- **Kapsam:** Kleine Schlüsselsysteme (Unfall/Sonstiges, BVG/SER, Zuzahlung, Rechnungsart, Leistungserbringergruppe, Abrechnungscode, Tarifkennzeichen, Summenstatus, Verarbeitungskennzeichen, Kennzeichen Mehrwertsteuer, Prüfvermerk, Hilfsmittel, Verordnungsbesonderheiten vb.), Abrechnungspositionsnummern (Heilmittel, Hilfsmittel, Krankentransport, Hebammenhilfe vb.), Positionsnummer für Produktbesonderheiten von Hilfsmitteln, Abrechnungspositionsnummernverzeichnisse, Länderkennzeichen, Schlüssel Mengeneinheiten.
- **Sürüm:** 22
- **Anzuwenden ab:** 01.02.2027
- **Ne zaman lazım:** Faturalandırma verilerinin hazırlanmasında, doğrulanmasında ve işlenmesinde kullanılan kod ve veri anahtar değerlerinin (Schlüsselwerte) girilmesi ve kontrol edilmesi gerektiğinde lazımdır.
- **Anahtar bölümler:**
  - 8.1 Kleine Schlüsselsysteme
  - 8.2 Abrechnungspositionsnummern
  - 8.3 Positionsnummer für Produktbesonderheiten von Hilfsmitteln
  - 8.5 Länderkennzeichen
  - 8.6 Schlüssel Mengeneinheiten

### Podoloji/Anlage_3_TP5_V21_20250919.txt
- **Ne:** § 302 Abs. 2 SGB V uyarınca „Sonstigen Leistungserbringern“ ile Hebammen ve Entbindungspflegern (§ 301a SGB V) faturalandırma usulünün form ve içeriğine ilişkin rehberlerin anahtar dizinlerini (Schlüsselverzeichnisse) içeren Anlage 3 belgesidir.
- **Kapsam:** Kleine Schlüsselsysteme (Unfall/Sonstiges, BVG/SER, Zuzahlung, Rechnungsart, Leistungserbringergruppe, Abrechnungscode, Tarifkennzeichen, Summenstatus, Verarbeitungskennzeichen, Mehrwertsteuer vb.), Abrechnungspositionsnummern (Heilmittel, Hilfsmittel, Krankentransport, Hebammenhilfe vb.), Positionsnummer für Produktbesonderheiten von Hilfsmitteln, Abrechnungspositionsnummernverzeichnisse, Länderkennzeichen, Schlüssel Mengeneinheiten.
- **Sürüm:** 21
- **Anzuwenden ab:** 01.10.2025
- **Ne zaman lazım:** Podoloji ve diğer hizmet sunucularının 01.10.2025 tarihinden itibaren geçerli faturalandırma veri anahtarlarını ve pozisyon numaralarını referans alması gerektiğinde lazımdır.
- **Anahtar bölümler:**
  - 8.1 Kleine Schlüsselsysteme
  - 8.2 Abrechnungspositionsnummern
  - 8.3 Positionsnummer für Produktbesonderheiten von Hilfsmitteln
  - 8.5 Länderkennzeichen
  - 8.6 Schlüssel Mengeneinheiten

### Handbücher/Anhang_03_Anlage_1_TP5_V10_20260414.txt
- **Ne:** § 302 Abs. 2 SGB V uyarınca „Sonstigen Leistungserbringern“ ile Hebammen ve Entbindungspflegern (§ 301a SGB V) faturalandırma usulünün form ve içeriğine ilişkin rehberlerin Technische Anlage 1, Kapitel 10 "Kostenträgerdatei" düzenlemesini içeren Anhang 3 belgesidir.
- **Kapsam:** Verwendungszweck, Veröffentlichung, Allgemeine Systematik der Kostenträgerdatei, Logisches Datenmodell, Verknüpfungsregeln (Kostenträger, Datenannahmestellen, Papierannahmestellen), Dateiname, Dateistruktur (Servicesegmente, Nutzsegmente), Schlüsselverzeichnis (Art der Anschrift, Art der Datenlieferung, DFÜ-Protokoll, Komprimierungsart, Abrechnungscode, Tarifkennzeichen vb.).
- **Sürüm:** 10
- **Anzuwenden ab:** 01.02.2027
- **Ne zaman lazım:** Ödeme kurumlarının kurum kimlik kodları (IK), adres/yönlendirme bilgileri ve şifreleme sertifikalarının EDIFACT yapısında tanımlanması ve eşleştirilmesi gerektiğinde lazımdır.
- **Anahtar bölümler:**
  - 1. VERWENDUNGSZWECK
  - 3. ALLGEMEINE SYSTEMATIK DER KOSTENTRÄGERDATEI
  - 5. VERKNÜPFUNGSREGELN
  - 7. DATEISTRUKTUR
  - 8. SCHLÜSSELVERZEICHNIS

### Handbücher/Anhang_05_Anlage_1_TP5_20260401.txt
- **Ne:** § 302 Abs. 2 SGB V uyarınca „Sonstigen Leistungserbringern“ ile Hebammen ve Entbindungspflegern (§ 301a SGB V) faturalandırma usulünün form ve içeriğine ilişkin rehberlerin Technische Anlage 1 düzenlemesine ek Schnittstellenbeschreibung Digitales Rettungsprotokoll belgesidir.
- **Kapsam:** Datenübermittlung (physikalischer und logischer Dateiname), Aufbau und Struktur der Daten (EDIFACT-Struktur, Servicesegmente UNA, UNB, UNZ, UNH, UNT; Nachrichtentyp RETP ve Segmentzusammenstellung), Schlüsselverzeichnis (Fahrzeugtyp, Einsatzart, Geschlecht, Art der Erkrankung, Schwere der Verletzung, Art des Zugangs, NACA-Score).
- **Sürüm:** 1.0
- **Anzuwenden ab:** 01.04.2026
- **Ne zaman lazım:** Acil kurtarma hizmetlerinde acil durum verilerinin "Digitales Rettungsprotokoll" (RETP EDIFACT mesajı) olarak dijital ortamda iletilmesi ve faturalandırılması gerektiğinde lazımdır.
- **Anahtar bölümler:**
  - 1 Änderungshistorie
  - 2 Allgemeines
  - 3 Aufbau und Struktur der Daten
  - 3.5 Nachrichtentyp RETP
  - 4 Schlüsselverzeichnis

## §302 TP5 — Yan belgeler, düzeltme usulü, değişiklik geçmişi

### Handbücher/Gemeinsame_Umsetzungsempfehlungen_zum_Korrekturverfahren_Heilmittel_20250213.txt
- **Ne:** Gemeinsame Umsetzungsempfehlungen zum Korrekturverfahren im Heilmittelbereich. § 302 Abs. 2 SGB V kapsamındaki "Sonstige Leistungserbringer" ile Hebammen und Entbindungspflegern (§ 301a SGB V) maschinelle Abrechnung düzeltme süreçlerine ilişkin uygulama tavsiyelerini içerir.
- **Kapsam:** Heilmittelbereich maschinelle Abrechnung Korrekturverfahren, Verarbeitungskennzeichen (VKZ 01 Erstrechnung, VKZ 02 Nachforderung, VKZ 03 Zuzahlungsnachforderung, VKZ 04 Korrekturrechnung, VKZ 10 Wiederaufnahme Blankoverordnung), Zuzahlung, soru ve uygulama önerileri.
- **Sürüm:** belirtilmemiş
- **Anzuwenden ab:** 01.10.2025
- **Ne zaman lazım:** Heilmittelbereich faturalandırmalarında düzeltme faturaları (Korrekturrechnung), ek talepler (Nachforderung) veya Blankoverordnung tekrar açılışlarında doğru Verarbeitungskennzeichen ve DTA kurallarını uygulamak gerektiğinde.
- **Anahtar bölümler:** yok

### Handbücher/Anhang_04c_Anlage_1_TP5_20250924_Verfahrensdokumentation-Erlaeuterungen_zum_Formular.txt
- **Ne:** Anhang 4c: Verfahrensdokumentation zur Digitalisierung und elektronischen Aufbewahrung von Belegen/Abrechnungsbelegen sowie deren Vernichtung zur Anlage 1 zu den Richtlinien nach § 302 Abs. 2 SGB V (§ 301a SGB V).
- **Kapsam:** Abrechnungsbeleg'lerin dijitalleştirilmesi (ersetzendes Scannen), TR-RESISCAN standartlarına uygun elektronik saklama, eIDAS-VO kapsamında nitelikli elektronik imza/mühür (Integritätssicherung), süreç adımları (Dokumentenvorbereitung, Scannen, Nachverarbeitung, Integritätssicherung, Übermittlung der Images), Kurzzeitarchiv ve kağıt belgelerin imhası (DIN 66399 P-4), dijital arşiv silme kuralları ve kontrol hakkı (Kontrollrecht).
- **Sürüm:** belirtilmemiş
- **Anzuwenden ab:** 24.09.2025
- **Ne zaman lazım:** Hizmet sunucularının veya fatura hizmet sağlayıcılarının fiziki fatura belgelerini dijitalleştirerek (Imageverfahren) saklaması, imha etmesi ve elektronik ortamda kasalara iletmesi süreçlerini yapılandırırken.
- **Anahtar bölümler:**
  - 1. Allgemeines/Vorbemerkungen zur Verfahrensdokumentation
  - 2. Anwendungsbereich und rechtliche Rahmenbedingungen
  - 4. Prozessschritte
  - 5. Kurzzeitarchiv und ggf. Vernichtung der Papierbelege

### Handbücher/Anhang_04c_Anlage_1_TP5_20250924_Formular_Verfahrensbeschreibung_Image-Link-Verfahren (1).txt
- **Ne:** Formular Verfahrensbeschreibung Imageverfahren (Anlage zur Verfahrensbeschreibung).
- **Kapsam:** Şirket bilgileri (Angaben zum Unternehmen), sorumlular (Angaben zu verantwortlichen Personen: IT, QM, Datenschutz vb.), teknik/süreç ayrıntıları (Belegaufbereitung, Scannen, Dateiformat PDF/A, eIDAS-VO uyumu, Siegel-/Signaturserver, Kartenleser), elektronik ve kağıt belgelerin saklama/imha süreç beyanı.
- **Sürüm:** belirtilmemiş
- **Anzuwenden ab:** belirtilmemiş
- **Ne zaman lazım:** Imageverfahren (dijital belge/görüntü ile faturalandırma) yöntemini uygulayan işletmelerin şirket içi sorumluluklarını, tarama ve imza/mühür donanım-yazılım standartlarını yazılı olarak beyan etmesi ve belgelemesi gerektiğinde.
- **Anahtar bölümler:** yok

### Handbücher/Anlage_4_061101.txt
- **Ne:** Anlage 4 Begleitzettel für Urbelege zu den Richtlinien der Spitzenverbände der Krankenkassen nach § 302 Abs. 2 SGB V (§ 301a SGB V).
- **Kapsam:** EDV ile fatura düzenleyen "Sonstige Leistungserbringer" ve Abrechnungsstelle'lerin DTA faturalandırması sonrası kasalara fiziksel olarak göndereceği orijinal belgeler (Urbelege: Verordnungsblätter, Kostenvoranschläge vb.) için Begleitzettel doldurma zorunluluğu ve belgede bulunması gereken zorunlu veriler.
- **Sürüm:** 2.0
- **Anzuwenden ab:** 01.12.2006
- **Ne zaman lazım:** Elektronik fatura (DTA) ile birlikte orijinal kağıt belgeleri (Urbelege) sağlık kasalarına veya ilgili kurumlara fiziksel teslim ederken refakat formu (Begleitzettel) düzenlemek gerektiğinde.
- **Anahtar bölümler:** yok

### Handbücher/Aenderungshistorie.txt
- **Ne:** Änderungshistorie. Önceki sürümlere göre yapılan değişiklikleri ve eski sürümlerden kalan açık değişiklikleri tanımlar.
- **Kapsam:** Anlage 4 (DMP Adipositas, MDQ, PQV, AOP, MAA, MAS vb. yeni/güncellenen Verfahrenskennung'lar) ve Anlage 16 Security Schnittstelle SECON (sertifika geçerlilik süresinin 3 yıldan 1 yıla indirilmesi, DSRV tanımının kaldırılması, PCA şirket adı güncellemesi, dijital Zertifikatsanforderung vb.) değişiklik detayları.
- **Sürüm:** belirtilmemiş
- **Anzuwenden ab:** belirtilmemiş
- **Ne zaman lazım:** Faturalandırma ve veri transfer sistemlerinde Anlage 4 işlem kodları (Verfahrenskennungen) ile Anlage 16 güvenlik/sertifika (SECON) standartlarındaki en son değişiklikleri incelemek gerektiğinde.
- **Anahtar bölümler:** yok

### Handbücher/0_Änderungen.txt
- **Ne:** Stand 29.04.2026. XML şemalarında yapılan sürüm yükseltmeleri ve teknik değişiklik listesini içerir.
- **Kapsam:** SLP_BAS (1.1.0 -> 1.2.0), TP6 / PFL Schemas (PFL_DAT, PFL_BAS, PFL_ARN, PFL_ARF, PFL_LNW, PFL_FEH_TECH, PFL_FEH_FACH) ve HKP Schemas (HKP_DAT, HKP_BAS, HKP_ARN, HKP_ARF, HKP_LNW, HKP_FEH_TECH, HKP_FEH_FACH) veri tipleri, pattern/enumeration kısıtlamaları, yeni eklenen hata kodları (Fehlercode_Stp) ve şema import değişiklikleri.
- **Sürüm:** belirtilmemiş
- **Anzuwenden ab:** belirtilmemiş
- **Ne zaman lazım:** TP6 (Pflege) ve HKP (Häusliche Krankenpflege) faturalandırma sistemlerinde kullanılan XML şemalarının, veri alanı doğrulama kurallarının ve hata kodu listelerinin teknik güncellemelerini yaparken.
- **Anahtar bölümler:** yok

### Handbücher/anlage2.txt
- **Ne:** Anlage 2: Vergütungsvereinbarung zum Vertrag nach § 125 Absatz 1 SGB V für Physiotherapie (Lesefassung gültig ab 01.01.2026).
- **Kapsam:** § 125 SGB V kapsamındaki fizyoterapi hizmetleri için Vergütungsliste (fiyat ve Zuzahlung/katkı payı listesi), Leistungserbringergruppe kodları (LEGS: 2100501, 2200501 vb.), Heilmittelpositionsnummern (X0102 - X2001 vb.), uygulama ve faturalandırma şartları, Hausbesuch paşalları, yürürlük/fesih kuralları ve Hebammenhilfevertrag bağlamındaki özel pozisyonlar (21901, 21904).
- **Sürüm:** belirtilmemiş
- **Anzuwenden ab:** 01.01.2026
- **Ne zaman lazım:** 01.01.2026 tarihinden itibaren sağlanan fizyoterapi hizmetlerinin fiyatlandırmasını, hasta katkı paylarını ve ilgili pozisyon numaralarını faturalara doğru şekilde uygulamak için.
- **Anahtar bölümler:** yok

### Handbücher/Richtlinien-Text_061120.txt
- **Ne:** Richtlinien der Spitzenverbände der Krankenkassen nach § 302 Abs. 2 SGB V über Form und Inhalt des Abrechnungsverfahrens mit „Sonstigen Leistungserbringer“ sowie mit Hebammen und Entbindungspflegern (§ 301a SGB V) vom 9. Mai 1996 in der geänderten Fassung vom 20. November 2006.
- **Kapsam:** § 302 ve § 301a SGB V kapsamındaki hizmet sunucularının tanımı (§ 1), faturanın bileşenleri (§ 2), faturalandırma usulü (§ 7), teknik ve organizasyonel veri aktarımı ve ekler (§ 8), yürürlük ve katılım şartları (§ 9).
- **Sürüm:** belirtilmemiş
- **Anzuwenden ab:** 01.06.1996
- **Ne zaman lazım:** Diğer hizmet sunucuları (Sonstige Leistungserbringer) ve ebelerin SGK (GKV) ile yürüttüğü elektronik faturalandırma sürecinin yasal çerçevesini, tarafların sorumluluklarını ve temel fatura bileşenlerini öğrenmek veya uygulamak gerektiğinde.
- **Anahtar bölümler:**
  - § 1 Definition der Beteiligten
  - § 2 Bestandteile der Abrechnung
  - § 7 Abrechnungsverfahren
  - § 8 Technische und organisatorische Form der Datenübermittlung

### Handbücher/TP5_Infoschreiben_BAHN-BKK_wegen_Dienstleisterwechsel_zum_01.01.2026.txt
- **Ne:** Wechsel des Dienstleisters für die Abrechnungsprüfung gemäß § 301a, 302 SGB V (Infoschreiben BAHN-BKK wegen Dienstleisterwechsel zum 01.01.2026).
- **Kapsam:** BAHN-BKK bünyesinde § 301a ve § 302 SGB V fatura inceleme hizmet sağlayıcısının 01.01.2026 itibarıyla DAVASO GmbH'ye devredilmesi, yeni teslimat/posta adresleri, portal kullanımı, eski hizmet sağlayıcı (AZE) ile geçiş dönemi sorumluluk ve son teslim tarihleri ile istisna kapsamlardaki (§ 37c, § 39c SGB V) süreçler.
- **Sürüm:** belirtilmemiş
- **Anzuwenden ab:** 01.01.2026
- **Ne zaman lazım:** BAHN-BKK sigortalılarına verilen hizmetlerin 01.01.2026 sonrasındaki fatura ve fiziksel belge gönderim adreslerini belirlemek ve geçiş dönemi taleplerini yönetmek gerektiğinde.
- **Anahtar bölümler:** yok

### Handbücher/gkv-datenaustausch.de_media_dokumente_leistungserbringer_1_sonstige_leistungserbringer_technische_anlagen_aktuell_4_Anhang_04b_Anlage_1_TP5_20220519.xsd.txt
- **Ne:** Schemaentwurf für eAkte - Schnittstelle zur Metadatenübernahme (Anhang 04b Anlage 1 TP5 XML Schema).
- **Kapsam:** eAkte veri seti (t_eAkte_Dokumentdatensatz), metadatanın iletilmesine ilişkin XSD veri yapısı ve tipleri (Dokumentklasse, Eingangskanal, Erstellungszeitpunkt, Zugriffsschutz, KassenInstitutionskennzeichen, Ordnungsbegriffe, VariableNutzdaten).
- **Sürüm:** belirtilmemiş
- **Anzuwenden ab:** belirtilmemiş
- **Ne zaman lazım:** eAkte sistemi üzerinden fatura ve belge metadatasının aktarılması için XML şema doğrulama kurallarını ve veri tiplerini sisteme entegre ederken.
- **Anahtar bölümler:** yok

### Handbücher/2024_09_01_Empfehlungen_zur_Umsetzung_der_Beschaeftigtennummer.txt
- **Ne:** Empfehlungen des GKV-Spitzenverbandes des Verbände der Pflege- und Krankenkassen auf Bundesebene und der Verbände der Pflegedienste auf Bundesebene - Angabe der Beschäftigtennummer in den Abrechnungsunterlagen im Rahmen der Umsetzung des § 105 Abs. 1 Satz 1 Nr. 2 SGB XI und § 302 Abs. 1 Satz 2 SGB V.
- **Kapsam:** Bakım ve evde sağlık/yoğun bakım faturalarında çalışan numarası (Beschäftigtennummer - BfArM tarafından verilen) bildirim yükümlülüğü, elektronik veri setlerinde (Anlage 1 ve Anlage 3) yer alan veri alanları, yedek çalışan numarası (Ersatz-Beschäftigtennummer 999999997) kullanımı, elektronik ve kağıt bazlı hizmet belgeleri (Leistungsnachweise), 01.05.2025-31.08.2025 tarihleri arasındaki deneme süreci (Erprobungsphase).
- **Sürüm:** belirtilmemiş
- **Anzuwenden ab:** 01.09.2024
- **Ne zaman lazım:** Bakım ve sağlık hizmeti sunucularının fatura ve hizmet belgelerinde çalışan numarası (Beschäftigtennummer) veya yedek numara bildirim kurallarını uygularken.
- **Anahtar bölümler:** yok

## §125 SGB V sözleşmeleri, ücret anlaşmaları ve Podologie

### Handbücher/20251201_Physiotherapie_Vertrag_125_Anlage_2_barrierefrei.txt
- **Ne:** Anlage 2: Vergütungsvereinbarung zum Vertrag nach § 125 Absatz 1 SGB V für Physiotherapie über die Versorgung mit Leistungen der Physiotherapie und deren Vergütung.
- **Kapsam:** Leistungserbringergruppen, Heilmittelpositionsnummern, Vergütungsliste (Preise und Zuzahlungen für Physiotherapie-Leistungen sowie Geburtsvorbereitung/Rückbildungsgymnastik), Abrechnung der Leistungen und Laufzeit der Vereinbarung.
- **Sürüm:** Lesefassung
- **Geçerlilik:** 01.01.2026
- **Ne zaman lazım:** Physiotherapie (fizyoterapi) hizmetlerinin ve ev ziyaretlerinin faturalandırılması ile ücret listesinin ve pozisyon numaralarının kontrol edilmesi gerektiğinde.
- **İçerdiği fiyat/pozisyon numarası var mı:** evet, X0102 (33,75 Euro), X0201 (21,63 Euro)

### Handbücher/20260212_Vertrag_125_sssst_Anlage_2_Verguetungsvereinbarung.txt
- **Ne:** Anlage 2: Vergütungsvereinbarung i. d. F. vom 12.02.2026 zum Vertrag nach § 125 Absatz 1 SGB V für Stimm-, Sprech-, Sprach- und Schlucktherapie über die Versorgung mit Leistungen der Stimm-, Sprech-, Sprach- und Schlucktherapie und deren Vergütung.
- **Kapsam:** Inkrafttreten, Beendigung, Vergütung der Leistungen, Leistungserbringergruppen, Heilmittel-Positions-Nummern ve 01.07.2026 tarihinden itibaren geçerli Vergütungsliste (Erstdiagnostik, Einzel- und Gruppentherapie, Hausbesuch, Berichte).
- **Sürüm:** i. d. F. vom 12.02.2026
- **Geçerlilik:** 01.01.2026
- **Ne zaman lazım:** Stimm-, Sprech-, Sprach- und Schlucktherapie (ses, konuşma, dil ve yutma terapisi) hizmetlerinin 01.07.2026 tarihinden itibaren faturalandırılması ve ücret/pozisyon numarası kontrolü gerektiğinde.
- **İçerdiği fiyat/pozisyon numarası var mı:** evet, 33010 (120,86 Euro), 33102 (57,06 Euro)

### Handbücher/20240531_Ergo_Anlage_2_Vertrag_nach_125_SGB_V_Verguetungsvereinbarung_BF.txt
- **Ne:** Anlage 2: Vergütungsvereinbarung zum Vertrag nach § 125 Absatz 1 SGB V für Ergotherapie über die Versorgung mit Leistungen der Ergotherapie und deren Vergütung.
- **Kapsam:** Vergütungsliste nach § 125 Absatz 1 SGB V (Preise, Zuzahlungen und Positionsnummern für Motorisch-funktionelle Behandlung, Sensomotorisch-perzeptive Behandlung, Hirnleistungstraining, Psychisch-funktionelle Behandlung, Schienen, Hausbesuche), Leistungserbringergruppen, Abrechnung der Leistungen und Laufzeit der Vereinbarung.
- **Sürüm:** Lesefassung Stand vom 01.06.2024
- **Geçerlilik:** 01.06.2024
- **Ne zaman lazım:** Ergotherapie (ergoterapi) hizmetlerinin, geçici atellerin ve ev ziyaretlerinin faturalandırılması ile ücret listesinin kontrol edilmesi gerektiğinde.
- **İçerdiği fiyat/pozisyon numarası var mı:** evet, X4002 (38,43 Euro), X4102 (52,77 Euro)

### Handbücher/20220421_Lesefassung_Anlage_3_Ernaehrungstherapie.txt
- **Ne:** Anlage 3: notwendige Angaben auf der Heilmittelverordnung und einheitliche Regelungen zur Abrechnung zum Vertrag nach § 125 Absatz 1 SGB V für Ernährungstherapie über die Versorgung mit Leistungen der Ernährungstherapie und deren Vergütung.
- **Kapsam:** Verordnungsdaten (Personalienfeld, Hausbesuch, Dringlicher Behandlungsbedarf, Behandlungseinheiten, Heilmittel, Diagnosegruppe, ICD-10 Code, Leitsymptomatik), Korrekturmöglichkeiten, Form und Zeitpunkt von Korrekturen sowie einheitliche Regelungen zur Abrechnung von Ernährungstherapie.
- **Sürüm:** Lesefassung nach der Ergänzungsvereinbarung vom 25.04.2022
- **Geçerlilik:** belirtilmemiş
- **Ne zaman lazım:** Ernährungstherapie (beslenme terapisi) reçetelerinin eksiksizliğini kontrol etme, hataları düzeltme ve faturalandırma kurallarını uygulama durumlarında.
- **İçerdiği fiyat/pozisyon numarası var mı:** hayır

### Handbücher/GGT.txt
- **Ne:** Gemeinsame Grundsätze Technik für die elektronische Datenübermittlung gemäß § 95 SGB IV in der vom 01.01.2026 an geltenden Fassung.
- **Kapsam:** Datenaustauschverfahren (KKS, eXTra), Parameter für den Datenaustausch (Verfahrenskennung, Verfahrensteilnehmer), Datenaustauscharten (DFÜ, E-Mail, HTTP/HTTPS, FTP/SFTP, FTAM over IP, XML-Richtlinie, Kommunikationsserver) und Sicherheitsverfahren (Verschlüsselung, Signatur, IT-Sicherheit).
- **Sürüm:** in der vom 01.01.2026 an geltenden Fassung
- **Geçerlilik:** 01.01.2026
- **Ne zaman lazım:** Sosyal sigorta kurumları ve hizmet sunucuları arasında elektronik veri iletimi (Datenübermittlung) için teknik ve güvenlik standartlarının uygulanması gerektiğinde.
- **İçerdiği fiyat/pozisyon numarası var mı:** hayır

### Podoloji/20230524_Podologie_FAK_bf.txt
- **Ne:** Fragen-Antworten-Katalog Podologie.
- **Kapsam:** Podoloji uygulamalarına ilişkin sorular ve yanıtlar (Diagnosestellung, Bestätigung der Leistung, Maßnahmen, Befundpauschale, Behandlungsbeginn, Frequenzabweichung, Empfangsbestätigung, Nagelspangenbehandlung vb.).
- **Sürüm:** Stand: 24.05.2023
- **Geçerlilik:** belirtilmemiş
- **Ne zaman lazım:** Podoloji uygulamaları, reçete kontrolleri, Nagelspangenbehandlung ve faturalandırma süreçlerindeki pratik soruların yanıtlanması gerektiğinde.
- **İçerdiği fiyat/pozisyon numarası var mı:** evet, 78030, 78010

### Podoloji/Leistungen/20240725_Anlage_1a_Leistungsbeschreibung_lesefassung_b.txt
- **Ne:** Anlage 1a: Leistungsbeschreibung i. d. F. vom 17.06.2024 zum Vertrag nach § 125 Absatz 1 SGB V für Podologie i. d. F. vom 30.11.2020 über die Versorgung mit Leistungen der Podologie und deren Vergütung.
- **Kapsam:** Allgemeines zur Leistungsbeschreibung der Podologischen Therapie (Grundsätze, Befunderhebung, Vor- und Nachbereitung), Maßnahmen der Podologischen Therapie (Hornhautabtragung, Nagelbearbeitung, Podologische Komplexbehandlung, Podologische Eingangsbefundung, Podologische Befundung).
- **Sürüm:** i. d. F. vom 17.06.2024
- **Geçerlilik:** belirtilmemiş
- **Ne zaman lazım:** Podoloji terapi hizmetlerinin detaylı tanımlarını, uygulama içeriklerini, sürelerini ve ilgili pozisyon numaralarını incelemek gerektiğinde.
- **İçerdiği fiyat/pozisyon numarası var mı:** evet, 78010, 78020

### Podoloji/Leistungen/20240725_Anlage_1b_Leistungsbeschreibung_Lesefassung_b.txt
- **Ne:** Anlage 1b: Leistungsbeschreibung (Nagelspangenbehandlung) i. d. F. vom 17.06.2024 zum Vertrag nach § 125 Absatz 1 SGB V für Podologie i. d. F. vom 30.11.2020 über die Versorgung mit Leistungen der Podologie und deren Vergütung.
- **Kapsam:** Allgemeines zur Behandlung von eingewachsenen Nägeln (Unguis incarnatus) mittels Nagelkorrekturspangen (Grundsätze, Befunderhebung, Erstbefundung, Kontrollen, Behandlungsabschluss) ve farklı tırnak teli sistemlerinin (Ross Fraser, mehrteilige bilaterale, einteilige Kunststoff- oder Metall-Spange) uygulanması.
- **Sürüm:** i. d. F. vom 17.06.2024
- **Geçerlilik:** belirtilmemiş
- **Ne zaman lazım:** Batık tırnak (Unguis incarnatus) tedavisinde tırnak teli (Nagelkorrekturspange) uygulamalarının içeriklerini, işlem adımlarını ve sürelerini belirlemek gerektiğinde.
- **İçerdiği fiyat/pozisyon numarası var mı:** evet, X8100, X8110

### Podoloji/Leistungen/20250617_Podologie_Anlage_1c_Leistungsbeschreibung.txt
- **Ne:** Anlage 1c: Leistungsbeschreibung (Nagelspangenbehandlung) i. d. F. vom 01.07.2025 zum Vertrag nach § 125 Absatz 1 SGB V für Podologie i. d. F. vom 30.11.2020 über die Versorgung mit Leistungen der Podologie und deren Vergütung.
- **Kapsam:** Allgemeines zur Behandlung von eingewachsenen Nägeln (Unguis incarnatus) mittels Nagelkorrekturspangen (Grundsätze, Befunderhebung, Therapieziele, Vor-/Nachbereitung, übergreifende Leistungen), Anwendung der Spangensysteme ile Aufschlag für besonderen Aufwand.
- **Sürüm:** i. d. F. vom 01.07.2025
- **Geçerlilik:** 01.07.2025
- **Ne zaman lazım:** 01.07.2025 tarihinden itibaren batık tırnak tedavisinde tırnak teli (Nagelkorrekturspange) hizmetlerinin güncel standartlarını ve ek ücret kurallarını uygulamak gerektiğinde.
- **İçerdiği fiyat/pozisyon numarası var mı:** evet, X8100, X8620

### Podoloji/Leistungen/20250617_Podologie_Anlage_2.txt
- **Ne:** Anlage 2: Vergütung i. d. F. vom 01.07.2025 zum Vertrag nach § 125 Absatz 1 SGB V für Podologie i. d. F. vom 30.11.2020 über die Versorgung mit Leistungen der Podologie und deren Vergütung.
- **Kapsam:** Leistungserbringergruppen, Heilmittelpositionsnummern, Preisvereinbarungen ab 01.07.2025 und ab 01.07.2026 (für DF/NF/QF, UI1/UI2 Nagelspangenbehandlung, Befundung, Hausbesuche) ile Inkrafttreten und Laufzeit.
- **Sürüm:** i. d. F. vom 01.07.2025
- **Geçerlilik:** 01.07.2025
- **Ne zaman lazım:** Podoloji alanında 01.07.2025 ve 01.07.2026 tarihlerinden itibaren geçerli hizmet fiyatlarını, Zuzahlung tutarlarını ve pozisyon numaralarını kontrol edip faturalandırmak gerektiğinde.
- **İçerdiği fiyat/pozisyon numarası var mı:** evet, 78010 (35,16 €), 78020 (50,55 €)

### Podoloji/Leistungen/20250617_Podologie_Anlage_3_Lesefassung.txt
- **Ne:** Anlage 3: (notwendige Angaben auf der Heilmittelverordnung und einheitliche Regelungen zur Abrechnung „Ärzte“) i. d. F. vom 16.06.2025 zum Vertrag nach § 125 Absatz 1 SGB V für Podologie i. d. F. vom 30.11.2020 über die Versorgung mit Leistungen der Podologie und deren Vergütung.
- **Kapsam:** Ziel der Anlage, Formerfordernisse (Muster 13 / Muster 13E), Korrekturmöglichkeiten (-form und -zeitpunkt), Verordnungsdaten (Personalienfeld, Hausbesuch, Dringlicher Behandlungsbedarf, Behandlungseinheiten, Heilmittel, Frequenz, Diagnosegruppe, ICD-10 Code, Leitsymptomatik, Begründung bei UI1/UI2).
- **Sürüm:** i. d. F. vom 16.06.2025
- **Geçerlilik:** belirtilmemiş
- **Ne zaman lazım:** Podoloji reçetelerinin geçerliliğini ve eksiksizliğini denetleme, düzeltme prosedürlerini yürütme ve fatura kesintilerini (Nullretaxation) önleme durumlarında.
- **İçerdiği fiyat/pozisyon numarası var mı:** hayır

### Podoloji/Leistungen/20250617_Podologie_Aenderungsvereinbarung.txt
- **Ne:** Änderungsvereinbarung zum Vertrag nach § 125 Abs. 1 SGB V über die Versorgung mit Leistungen der Podologie und deren Vergütung vom 30.11.2020.
- **Kapsam:** Änderungen des Vertragstextes (Rubrum, § 1, § 3, § 3a, neuer § 3b Grundsätze der Leistungserbringung bei der Nagelspangenbehandlung, § 5, § 7), Ergänzung der neuen Anlage 1c und Anlage 2, Änderung von Anlage 3 sowie Inkrafttreten.
- **Sürüm:** vom 16.06.2025
- **Geçerlilik:** 01.07.2025
- **Ne zaman lazım:** Podoloji çerçeve sözleşmesindeki değişiklikleri, yeni § 3b kurallarını ve yeni eklerin yürürlük şartlarını incelemek gerektiğinde.
- **İçerdiği fiyat/pozisyon numarası var mı:** hayır

## Heilmittel-Richtlinie, Diagnoseliste, ICD-10-GM

### verordnung rezept/HeilM-RL_2025-05-15_iK-2025-08-05.txt
- **Ne:** Richtlinie des Gemeinsamen Bundesausschusses über die Verordnung von Heilmitteln in der vertragsärztlichen Versorgung (Heilmittel-Richtlinie/HeilM-RL). Yasal sağlık sigortası (GKV) kapsamında sözleşmeli hekimler ve yetkili psikoterapistler tarafından yasal sigortalı hastalara Heilmittel reçete edilmesini düzenleyen resmi yönetmeliktir.
- **Kapsam:** Allgemeine Grundsätze, Grundsätze der Heilmittelverordnung, Zusammenarbeit zwischen Verordnerinnen/Verordnern und Heilmittelerbringerinnen/Heilmittelerbringern, Maßnahmen der Physiotherapie, Podologischen Therapie, Stimm-, Sprech-, Sprach- und Schlucktherapie, Ergotherapie, Ernährungstherapie sowie Heilmittelkatalog (Zuordnung der Heilmittel zu Indikationen).
- **Sürüm / Stand:** Fassung vom 19. Mai 2011, zuletzt geändert am 15. Mai 2025 (veröffentlicht im Bundesanzeiger BAnz AT 04.08.2025 B3)
- **Geçerlilik (in Kraft):** 5. August 2025 (Ursprünglich in Kraft getreten am 1. Juli 2011)
- **Ne zaman lazım:** Sözleşmeli hekimler veya yetkili psikoterapistler hastalarına fizyoterapi, podoloji, ergoterapi, konuşma terapisi veya beslenme terapisi reçete ederken mevzuata uygunluk sağlamak amacıyla bu yönetmeliğe başvururlar.
- **Anahtar bölümler:**
  - § 3 Voraussetzungen der Verordnung
  - § 4 Heilmittelkatalog
  - § 7 Verordnungsfall, orientierende Behandlungsmenge, Höchstmenge je Verordnung
  - § 8 Langfristiger Heilmittelbedarf
  - § 13a Verordnung mit erweiterter Versorgungsverantwortung von Heilmittelerbringern („Blankoverordnung“)
  - Zweiter Teil: Zuordnung der Heilmittel zu Indikationen (Heilmittelkatalog)
- **Kaynak niteliği:** resmi mevzuat

### verordnung rezept/heilmittel-diagnoseliste.txt
- **Ne:** Kassenärztliche Bundesvereinigung (KBV) tarafından hazırlanan "Diagnoseliste Langfristiger Heilmittelbedarf / Besonderer Verordnungsbedarf / Blankoverordnung" başlıklı servis belgesidir.
- **Kapsam:** Langfristiger Heilmittelbedarf (§ 32 Abs. 1a SGB V), Besonderer Verordnungsbedarf (§ 106b Abs. 2 SGB V) ve Blankoverordnung kütük ve tanı listeleri, ICD-10 kodları, Diagnosegruppe eşleşmeleri ve özel açıklama/spezifikation hükümlerini içerir.
- **Sürüm / Stand:** Stand 1. Januar 2026
- **Geçerlilik (in Kraft):** belgede bulunamadı
- **Ne zaman lazım:** Hekimler ve psikoterapistler, reçete ettikleri Heilmittel'lerin bütçe denetiminden muaf tutulması (uzun süreli/özel ihtiyaç) veya Blankoverordnung kapsamında değerlendirilmesi durumlarını kontrol etmek istediklerinde lazım olur.
- **Anahtar bölümler:**
  - ALLGEMEINE HINWEISE
  - 1. LANGFRISTIGER HEILMITTELBEDARF UND BESONDERER VERORDNUNGSBEDARF
  - 2. BLANKOVERORDNUNG
- **Kaynak niteliği:** sektor rehberi

#### Ek Bilgi (heilmittel-diagnoseliste.txt yapısı):
- **Sütunlar ve Alan Yapısı:** Belge iki ana bölümden oluşur. 
  - Bölüm 1 (Langfristiger/Besonderer Bedarf): `DIAGNOSEGRUPPE`, `1. ICD-10`, `2. ICD-10`, `DIAGNOSE`, `PHYSIOTHERAPIE`, `ERGOTHERAPIE`, `STIMM-, SPRECH-, SPRACH-, SCHLUCKTHERAPIE`, `HINWEIS/ SPEZIFIKATION` sütunlarını içerir.
  - Bölüm 2 (Blankoverordnung): `1. ICD-10`, `2. ICD-10`, `DIAGNOSEGRUPPE`, `DIAGNOSE` sütunlarını içerir.
- **Kayıt Sayısı:** Belgede toplam kayıt sayısı sayısal olarak açıkça belirtilmemiştir; dosya 1645 satırlık metin ve tablo verisinden oluşmaktadır.
- **Diagnosegruppe Kod Formatı ve 3 Örnek Kod:** Heilmittelkatalog kapsamındaki tedavi alanlarına karşılık gelen 2-3 harfli kısaltma kodları formatındadır.
  - Örnek 3 kod: `ZN` (Zentrales Nervensystem), `EN1` (Ergotherapie / CNS), `EX` (Extremitäten / Schulter - Blankoverordnung).

### verordnung rezept/praxiswissen-heilmittel.txt
- **Ne:** Kassenärztliche Bundesvereinigung (KBV) tarafından yayımlanan "HEILMITTEL - Alles Wichtige zur Verordnung und Beispiele aus der Praxis" isimli bilgilendirme broşürüdür.
- **Kapsam:** Heilmittel reçeteleme kuralları, Muster 13 formunun kullanımı, Blankoverordnung uygulaması, video üzerinden tedavi imkanları, Physiotherapie, Podologische Therapie, Ergotherapie, Stimm-, Sprech-, Sprach-, Schlucktherapie ve Ernährungstherapie branşlarına ait pratik vakalar ile CME online eğitim bilgilerini kapsar.
- **Sürüm / Stand:** Aktualisierte Ausgabe 2026
- **Geçerlilik (in Kraft):** belgede bulunamadı
- **Ne zaman lazım:** Sağlık çalışanları ve muayenehane personeli Heilmittel reçeteleme kurallarını, form doldurma detaylarını ve pratik vaka örneklerini öğrenmek veya hatırlamak istediklerinde kullanılır.
- **Anahtar bölümler:**
  - Wichtige Regeln und Grundlagen der Heilmittelversorgung
  - Auf einen Blick: So funktioniert die Heilmittelverordnung
  - Fokus: Blankoverordnung
  - So wird verordnet (Physiotherapie, Podologische Therapie, Ergotherapie, Stimm-, Sprech-, Sprach-, Schlucktherapie, Ernährungstherapie)
  - Service: Fortbildungen nutzen
- **Kaynak niteliği:** sektor rehberi

### verordnung rezept/NOVENTI-Leitfaden-Blankoverordnung-Physiotherapie.txt
- **Ne:** NOVENTI Health SE tarafından hazırlanan "Rezeptabrechnung BLANKOVERORDNUNG PHYSIOTHERAPIE AUF EINEN BLICK: PRAXISLEITFADEN" başlıklı pratik rehberdir.
- **Kapsam:** Fizyoterapide Blankoverordnung uygulamasının esasları (omuz bölgesindeki 114 tanı için EX tanı grubu), 16 haftalık geçerlilik ve 28 günlük başlama süresi, Ampelsystem (trafik ışığı sistemi) ile harcama ve kesinti (Absetzung) denetimi, Muster 13 formundaki düzenlemeler, faturalandırma ve düzeltme imkanlarını kapsar.
- **Sürüm / Stand:** Stand März 2026
- **Geçerlilik (in Kraft):** 1. November 2024
- **Ne zaman lazım:** Fizyoterapistler ve faturalandırma (Abrechnung) uzmanları Blankoverordnung reçetelerini kesintisiz ve kurallara uygun biçimde faturalandırmak istediklerinde başvururlar.
- **Anahtar bölümler:**
  - Was ist die Blankoverordnung? (Anwendungsbereich und Gültigkeit)
  - Vorteile und Chancen (Sicherheit vor Absetzungen durch das Ampelsystem Blankoverordnung)
  - Umgang mit der Blankoverordnung (Wie sieht die Blankoverordnung aus?)
  - Regelungen zur Vergütung / Möglichkeiten zur Korrektur
- **Kaynak niteliği:** ticari yayın

### verordnung rezept/Zip ICD/icd10gm2026syst_metadaten_liesmich.txt
- **Ne:** BfArM tarafından yayımlanan "ICD-10-GM Version 2026 Systematisches Verzeichnis Metadaten TXT (CSV)" paketinin LIESMICH (beni oku) açıklama dosyasıdır.
- **Kapsam:** `icd10gm2026syst-meta.zip` paket içeriği, PDF referans sürümü uyarıları, ilişkisel veritabanı yapısı, yaş/cinsiyet denetimleri, § 295 ve § 301 kodlama kuralları ile TXT dosyalarının alan tanımları (Datensatzbeschreibung) ve SQL tablo oluşturma komutlarını içerir.
- **Sürüm / Stand:** Stand der Klassifikation: 12.09.2025 (ICD-10-GM Version 2026)
- **Geçerlilik (in Kraft):** belgede bulunamadı
- **Ne zaman lazım:** Tıbbi yazılım geliştiricileri ve veri analistleri ICD-10-GM 2026 tanı kütüklerini veritabanına aktarırken ve doğrulama mantıklarını kurarken kullanılır.
- **Anahtar bölümler:**
  - INHALT DES ZIP-FILES icd10gm2026syst-meta.zip
  - HINWEISE ZUR REFERENZFASSUNG
  - INFORMATIONEN ZU DEN METADATEN UND ZUM DATENBANKAUFBAU
  - DATENSATZBESCHREIBUNG
- **Kaynak niteliği:** veri dosyası

#### Ek Bilgi (icd10gm2026syst_metadaten_liesmich.txt paketi ve alan yapısı):
- **Paketteki Diğer Dosyalar ve İşlevleri:**
  - `downloadbedingungen-2025.pdf`: Veri indirme ve kullanım şartları dokümanı.
  - `icd10gm2026syst_kapitel.txt`: ICD-10 sistematiğinin bölüm (Kapitel) numaraları ve başlıkları (Feld 1-2).
  - `icd10gm2026syst_gruppen.txt`: Bölümler altındaki tanı grubu aralıkları ve grup başlıkları (Feld 1-4).
  - `morbl_2026.txt`: Morbidite istatistik kütük listesi (Feld 1-2).
  - `mortl1_2026.txt`, `mortl1grp_2026.txt`, `mortl2_2026.txt`, `mortl3_2026.txt`, `mortl3grp_2026.txt`, `mortl4_2026.txt`: WHO önerilerine dayalı 1-4 arası Mortalite listeleri ve grup tabloları.
  - `ZUSATZDATEIEN` klasöründeki PDF dosyaları (`icd10gm2026syst_01_...pdf` - `11_...pdf`): Ön yazılar, yorumlar, kodlama talimatı, morfoloji eki ve klinik değerlendirme ölçekleri (Barthel-Index, Erw. Barthel-Index, FRB, FIM, MMSE, Adipositas).
- **`Klassifikationsdateien/icd10gm2026syst_kodes.txt` Alan Yapısı (28 Alan):**
  - Feld 1: Klassifikationsebene (3=Dreisteller, 4=Viersteller, 5=Fünfsteller)
  - Feld 2: Ort der Schlüsselnummer im Klassifikationsbaum (T=terminale, N=nichtterminale)
  - Feld 3: Art der Vier- und Fünfsteller (X=explizit, S=per Subklassifikation)
  - Feld 4: Kapitelnummer (max. 2 Zeichen)
  - Feld 5: erster Dreisteller der Gruppe (3 Zeichen)
  - Feld 6: Schlüsselnummer ohne eventuelles Kreuz (bis zu 7 Zeichen)
  - Feld 7: Schlüsselnummer ohne Strich, Stern und Ausrufezeichen (bis zu 6 Zeichen)
  - Feld 8: Schlüsselnummer ohne Punkt, Strich, Stern und Ausrufezeichen (bis zu 5 Zeichen)
  - Feld 9: Klassentitel (zusammengesetzt, bis zu 255 Zeichen)
  - Feld 10: Titel des dreistelligen Kodes (bis zu 255 Zeichen)
  - Feld 11: Titel des vierstelligen Kodes (bis zu 255 Zeichen)
  - Feld 12: Titel des fünfstelligen Kodes (bis zu 255 Zeichen)
  - Feld 13: Verwendung der Schlüsselnummer nach Paragraph 295 (P, O, Z, V)
  - Feld 14: Verwendung der Schlüsselnummer nach Paragraph 301 (P, O, Z, V)
  - Feld 15: Bezug zur Mortalitätsliste 1
  - Feld 16: Bezug zur Mortalitätsliste 2
  - Feld 17: Bezug zur Mortalitätsliste 3
  - Feld 18: Bezug zur Mortalitätsliste 4
  - Feld 19: Bezug zur Morbiditätsliste
  - Feld 20: Geschlechtsbezug der Schlüsselnummer (9=kein, M=männlich, W=weiblich)
  - Feld 21: Art des Fehlers bei Geschlechtsbezug (9=irrelevant, K=Kann-Fehler)
  - Feld 22: untere Altersgrenze für eine Schlüsselnummer (9999, t000-t364, j001-j124)
  - Feld 23: obere Altersgrenze für eine Schlüsselnummer (9999, t000-t364, j001-j124)
  - Feld 24: Art des Fehlers bei Altersbezug (9=irrelevant, M=Muss-Fehler, K=Kann-Fehler)
  - Feld 25: Krankheit in Mitteleuropa sehr selten? (J=Ja, N=Nein)
  - Feld 26: Schlüsselnummer mit Inhalt belegt? (J=Ja, N=Nein)
  - Feld 27: IfSG-Meldung (Arzt-Meldepflicht nach Infektionsschutzgesetz: J=Ja, N=Nein)
  - Feld 28: IfSG-Labor (Laborausschlussziffer EBM 32006: J=Ja, N=Nein)
