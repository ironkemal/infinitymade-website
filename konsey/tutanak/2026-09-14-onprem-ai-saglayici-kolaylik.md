# Konsey Kararı — On-prem AI: "kolay sağlayıcı" sorusu

Tarih: 2026-09-14 (aynı gün, üçüncü tur) · Oturan üyeler: legal-de, onprem, muhalif, deger-mi
Önceki turlar: [2026-09-12](2026-09-12-onprem-ai-modeli.md) (sağlayıcı kararı ertelendi),
[2026-09-14 ilk tur](2026-09-14-onprem-ai-uygulama-kapsami.md) (BYO-key onaylandı, UI ilk
müşteriye ertelendi)

## KARAR

**"Daha kolay hesap açılan sağlayıcı" arayışı YANLIŞ SORU.** Azure'ı zor yapan kurumsal
kayıt süreci değil, hiçbir adayın (OpenAI, Mistral, IONOS) bugün C5 Typ-2 barajını
geçmemesi — en kolay hesap açılan sağlayıcı bile bu baraja takılıyor. Sağlayıcı önerme
konusunda: **Praxura hiçbir sağlayıcıyı isimle önermez** (Falschberatung riski — `legal-de`:
BYO-key'de §393 yükümlülüğü Praxura'dan kalkıyor ama **praxis'e geçiyor**, kaybolmuyor).
Bunun yerine: (1) nötr bir Almanca uyarı metni + 3 soruluk uygunluk kontrol listesi
yayımlanır, sağlayıcı seçimi tamamen müşteriye bırakılır; (2) kurulum sürtünmesi kod/UI
ile değil, `install.sh`'ın mevcut 16 adımlı akışına eklenen 17. soruyla ("AI anahtarı —
opsiyonel, boşsa AI kapalı kalır") + ilk müşterilerle elle/ekran-paylaşımlı kurulumla
çözülür; (3) IONOS'a AI Model Hub'ın C5 kapsamında olup olmadığını soran mail atılır (tek
gerçekçi "kolay + savunulabilir" aday, §393 Abs.4'ün 18 aylık Typ-1 geçiş toleransı
sayesinde); (4) `ai_audit_log` kullanım ölçümü (iki turdur işaretsiz duran madde) şimdi
yapılır.

## Gerekçe

`legal-de` üç adayı da araştırdı: OpenAI C5 yok + Drittland sorunu (⛔), Mistral C5 yok
(ISO27001 "eşdeğer" sayılabilir ama denklik kararı BMG'ye ait, bize değil), IONOS C5 Typ-1
+ AI Model Hub'ın kapsamda olduğu teyitsiz. `onprem` CSP/reseller modelinin (Praxura
müşteri adına kaynak sağlar) 09-12'de veto edilen relay sorununu birebir tekrarladığını
doğruladı — araştırmaya değmedi. `muhalif` üçüncü kez aynı kalıbı işaretledi: ölçülmemiş
bir sürtünmeye (kurucunun "insanlar hesap açamaz" sezgisi, muhalif'e göre bu kez **haklı**
ama henüz test edilmedi) pahalı çözüm tasarlanıyordu. `deger-mi` otomasyonun (2-3 gün) roadmap'te
zaten doğru yerde (playbook 2.2) durduğunu, bugünkü ihtiyacın 45 dakikalık bir Sales-Ops
notu olduğunu gösterdi.

## Ödün verilenler

On-prem'in ilk birkaç müşterisinde AI kurulumu self-servis değil — Praxura ekibi ekran
paylaşımıyla elle kurar. Tek-tık/önerilen sağlayıcı yok; müşteri kendi C5 durumunu kendi
araştırır (biz checklist veririz, karar vermeyiz).

## Uzlaşma

4 üye de: (a) sağlayıcı araştırmasının bugün erken olduğunda, (b) CSP/reseller modelinin
09-12 vetosunu tekrarladığında, (c) `install.sh`'a tek soru eklemenin yeterli olduğunda
hemfikir.

## Anlaşmazlık

Yok.

## Kör noktalar

- ~~`legal-de`'nin bulduğu teknik kaçış yolu (reçete görüntüsünü kırpıp Sozialdatum
  göndermeme)~~ — **ÇÜRÜTÜLDÜ, 2026-09-14 aynı gün, Kemal'in sorusu üzerine.** Kod
  incelendi: `server.js:2519-2527` OCR'dan gelen ad+soyad+`geburtsdatum` ile `leads`
  tablosunda hasta eşleştiriyor (bulamazsa yeni hasta açıyor) — otomatik hasta bulma
  özelliğinin **kendisi** bu alanlara bağlı. Kırpma bu özelliği yok eder, tam da
  korunmak istenen konforu kaybettirir. Ayrıca KVNR de formda ayrı bir Sozialdatum —
  tek başına isim/DOB kırpmak yetmez. İki-aşamalı ayrım (kimlik için AI-siz yerel OCR +
  tedavi için bulut AI) da gerçekçi değil: reçeteler el yazısı, klasik OCR motorları
  güvenilir okuyamaz — zaten bu yüzden vision-LLM kullanılıyor. **Backlog'dan
  düşürüldü.**
- `muhalif`: kurulum otomasyonu fikri kayganlaşıp "anahtarı biz yönetiriz"e kayarsa
  K6 + `legal-de`'nin Seçenek A vetosuna geri düşer — sınır net çizilmeli.

## Uygulama — builder'a

- [ ] `install.sh`'a 17. soru: "AI anahtarı (opsiyonel, boş bırakılabilir)" — O-66
      SMTP deseniyle aynı, K0
- [ ] `ai_audit_log` Beta-1/Beta-2 OCR kullanım oranı sorgusu — K0 (iki turdur bekliyor)
- [ ] `legal-de`: IONOS'a AI Model Hub C5 kapsam sorusu maili — K0
- [ ] `legal-de`: nötr Almanca uygunluk metni + 3 soruluk checklist taslağı — K1
- [ ] Sales-Ops notu: "ilk N on-prem müşterisinde AI anahtarını ekiple birlikte, ekran
      paylaşımıyla kurarız, anahtar müşterinin kalır" — K0, kod değil
- [ ] `onprem/REGISTER.md`: **O-106** (BYO-key kurulum sürtünmesi, `offen`, tetikleyici
      ilk müşteri)

## Backlog (karara dahil DEĞİL)

- Azure CLI otomasyon script'i — sağlayıcı belli olunca (playbook 2.2)
- Mistral'in Almanya yerleşikliği (duyuruldu, henüz gerçek değil) — takip edilecek

## Sert veto

`legal-de` ⛔ — Praxura'nın herhangi bir sağlayıcıyı isimle "önerilen/uyumlu" diye
göstermesi, kapsam teyidi yazılı gelmeden yapılmaz (IONOS dahil). `onprem`/`legal-de`
ortak ⛔ — CSP/reseller modeli (Praxura müşteri adına sağlayıcı hesabı açar) 09-12
Seçenek B vetosunun aynısı, dolanma yolu yok.

---

## Ek — derin araştırma turu (2026-09-14, aynı gün, dördüncü tur)

Kemal "IONOS'u kapsamlı araştır" dedi. `legal-de` (hukuki derinlik) + `general-purpose`
(ürün/ticari) paralel iki rapor üretti. Özet bulgular:

- **IONOS'un kendi dokümantasyonu artık açıkça "AI Model Hub BSI C5 kapsamındadır"
  diyor** — 09-12'deki "kapsam teyitsiz" boşluğu kapandı.
- **Ama iki yeni engel çıktı:** (a) 18 aylık Typ-1 toleransı muhtemelen işlemiyor — AI
  Model Hub 30.06.2025 kesim tarihinden ÖNCE (Ağustos 2024) piyasaya çıktı; (b) daha önce
  kimsenin görmediği **§393 Abs.3 Nr.3**: praxis, testatın Prüfbericht'indeki "müşteri
  tarafı kriterlerini" kendi işletmesinde uygulamak zorunda — tek başına IONOS'un Typ-2
  alması yetmiyor.
- **Ürün tarafı beklenenden iyi:** OpenAI-uyumlu API, Azure'dan ucuz, vision modelleri
  (Qwen3.5-9B, Mistral Small 24B) var, hesap açma ~30 dk self-servis. ⚠️ IONOS'un kendi
  özel OCR modeli (LightOnOCR) **el yazısında güvenilir değil** — Alman reçeteleri büyük
  ölçüde el yazısı, test genel vision modelleriyle yapılmalı, LightOnOCR ile değil.
- **Kemal'in sorduğu iki yeni soru** (Azure'da yaşanan kota/kapasite sorunu + kurulum
  kolaylığı) mail taslağına 8. ve 9. madde olarak eklendi.

### Nihai mail — gönderilmeyi bekliyor (Kemal gönderecek, elimizde mail atma aracı yok)

```
Betreff: Auskunftsersuchen — C5-Testat vom 28.05.2026: Geltungsbereich für AI Model Hub, § 393 SGB V

Sehr geehrte Damen und Herren,

wir sind Hersteller einer Praxisverwaltungssoftware für Heilmittelerbringer
(Physiotherapie, Ergotherapie, Logopädie, Podologie) in Deutschland. Unsere Kunden
sind Leistungserbringer im Sinne des Vierten Kapitels SGB V und unterliegen damit
unmittelbar § 393 SGB V.

Unsere Software wird On-Premise beim Kunden betrieben. Für eine optionale Funktion
zur Texterkennung auf Heilmittelverordnungen prüfen wir, den Kunden zu ermöglichen,
mit ihrem eigenen IONOS-Vertrag und eigenem API-Schlüssel den IONOS AI Model Hub zu
nutzen. Wir selbst wären dabei nicht Vertragspartei und nicht Auftragsverarbeiter.

Da § 393 Abs. 3 Nr. 2 SGB V ein C5-Testat verlangt, das die im Rahmen des
Cloud-Computing-Dienstes tatsächlich eingesetzten Cloud-Systeme und die eingesetzte
Technik umfasst, bitten wir um schriftliche Auskunft zu folgenden Punkten:

1. Geltungsbereich des Testats. Ihre Produktdokumentation führt unter AI Model Hub
   → Governance and Compliance → Data Handling aus: „AI Model Hub falls within the
   scope of BSI C5." Bitte bestätigen Sie, dass der AI Model Hub als Service
   (Inferenz-Endpunkte, GPU-Infrastruktur, API-Gateway) namentlich im
   Geltungsbereich des am 28.05.2026 durch PwC erteilten C5:2020-Typ-1-Testats
   („33 Services in 10 Service-Clustern") aufgeführt ist. Falls ja: bitte
   übersenden Sie uns die Anlage mit der Liste der testierten Services oder teilen
   Sie mit, unter welchen Bedingungen (z. B. NDA) sie erhältlich ist.

2. Typ 2. § 393 Abs. 4 S. 2 SGB V verlangt seit dem 01.07.2025 ein
   C5-Typ-2-Testat. Gibt es einen verbindlichen Zeitplan für ein Typ-2-Testat, das
   den AI Model Hub einschließt? Ist beabsichtigt, dabei unmittelbar auf C5:2026
   umzustellen (Übergangsfrist bis 01.06.2027)?

3. Gleichwertigkeitsnachweis. Solange kein Typ-2-Testat vorliegt: Existiert für den
   AI Model Hub ein Maßnahmenplan nach § 1 Abs. 2 C5-Gleichwertigkeitsverordnung?
   Nach § 1 Abs. 3 C5GleichwV ist dieser Leistungserbringern auf Verlangen
   vorzulegen — wir bitten insoweit um Übersendung. Wir weisen darauf hin, dass
   Ihre ISO-27001-Zertifizierung auf Basis IT-Grundschutz (BSI-IGZ-0730-2025)
   ausweislich Ihrer eigenen Angaben nur Compute Engine, Object Storage und
   Managed Kubernetes umfasst, den AI Model Hub also nicht.

4. Korrespondierende Kundenkriterien. § 393 Abs. 3 Nr. 3 SGB V verpflichtet unsere
   Kunden, die im Prüfbericht enthaltenen korrespondierenden Kriterien für Kunden
   umzusetzen. Wie erhalten Ihre Kunden diesen Prüfbericht bzw. eine Aufstellung
   dieser Kundenkriterien?

5. Vertragspartner und AVV. Der AI Model Hub wird von der IONOS Cloud GmbH
   erbracht; die unter ionos.de/terms-gtc/AVV veröffentlichte AVV betrifft
   demgegenüber die IONOS SE. Bitte teilen Sie mit, welche AVV-Fassung
   (Version/Datum) für den AI Model Hub gilt und stellen Sie uns diese nebst
   TOM-Anlage und Unterauftragsverarbeiter-Liste zur Verfügung.

6. Unterauftragsverarbeiter und Verarbeitungsort. Ihre Dokumentation erklärt: „No
   third-party sub-processors are engaged for AI Model Hub" und „All inference is
   performed in IONOS CLOUD data centers in Germany." Bitte bestätigen Sie
   vertraglich verbindlich, dass (a) die gesamte GPU-Kapazität des AI Model Hub in
   Rechenzentren in Ihrem Betrieb liegt und nicht bei Dritten angemietet ist, und
   (b) keine Verarbeitung — auch nicht Support, Monitoring oder Failover —
   außerhalb der EU stattfindet.

7. Berufsgeheimnis. Unsere Kunden sind Berufsgeheimnisträger nach § 203 Abs. 1
   Nr. 1 StGB. Bieten Sie eine Vereinbarung nach § 203 Abs. 4 StGB (Verpflichtung
   mitwirkender Personen zur Geheimhaltung) an, wie sie einige Anbieter als
   „Zusatz zur Berufsgeheimnisträger-Verarbeitung" führen?

8. Kapazität und Verfügbarkeit. Bei vergleichbaren Cloud-KI-Diensten anderer
   Anbieter (z. B. Azure OpenAI in europäischen Regionen) haben wir wiederholt
   Kapazitätsengpässe erlebt — Anfragen an bild­fähige Modelle wurden mit
   Quota-/„capacity exceeded"-Fehlern abgelehnt, weil die Region ausgelastet war.
   Da unsere Anwendung auf zuverlässige, insbesondere bild­fähige
   (vision-)Modellaufrufe angewiesen ist: Gibt es beim AI Model Hub garantierte
   Kapazitäten bzw. ein Service-Level für die Verfügbarkeit vision-fähiger Modelle
   (z. B. Mistral Small 24B, Qwen3.5-9B), oder kann es bei hoher Nachfrage zu
   ähnlichen Ablehnungen kommen? Gibt es ein Monitoring/eine Statusseite für
   Kapazitätsauslastung je Modell?

9. Einrichtung/Onboarding. Unsere Endkunden sind überwiegend kleine
   Heilmittelpraxen ohne eigene IT-Abteilung. Kann ein technisch nicht versierter
   Praxisinhaber ein IONOS-Konto eröffnen und einen API-Schlüssel für den AI Model
   Hub selbstständig erzeugen, oder ist hierfür Unterstützung erforderlich? Bieten
   Sie einen vereinfachten Onboarding-Weg für Softwarepartner an (z. B. ein
   geführtes Einrichtungsformular, ein Partnerprogramm, oder eine Möglichkeit für
   uns als Softwarehersteller, den Einrichtungsprozess für unsere Kunden technisch
   zu vereinfachen, ohne selbst Vertragspartei zu werden)?

Wir bitten um schriftliche Rückmeldung, da diese Angaben Grundlage einer
Produktentscheidung und einer Empfehlung gegenüber unseren Kunden wären.

Mit freundlichen Grüßen
Yavuz Kemal Demir
InfinityMade (Praxura) · Siegburg
```

**Durum:** Mail atılmadı, sicile `pending` olarak düşüldü. Cevap geldiğinde `onprem/REGISTER.md`
O-74 ve bu tutanak güncellenecek.

