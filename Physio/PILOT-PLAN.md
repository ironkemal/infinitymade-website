# Physio-Pilot P1 — iş planı ve iş bölümü (Kemal ↔ Melih)

> Başlangıç 30.10.2026. Depo **public** → müşteri adı, şehir ve fiyat bu dosyaya yazılmaz.
> Müşteriye rumuz **P1** denir. Ham görüşme notları depo dışında (Kemal'de).
> Bu dosya bilgisayar kapalıyken GitHub'dan açılan oturumların (claude.ai/code) da tek
> bağlamıdır — karar değişince burası güncellenir.

## 0. Neden

P1 iki Standort'lu bir Physio praxis'i, THEORG'dan geliyor. İkinci Standort Ende Dez / Anfang
Jan açılıyor, orada test edip geçmek istiyor. P1 **müşteriden bağımsız** iki şey veriyor:
bir son tarih ve "bir Physio praxis'inde ne eksik" listesi. Hedef müşteriye özel kod değil,
**Physio'yu genel olarak bitirmek.** Müşteriye özel bilgi (IK, fax sağlayıcısı, export)
istenmez — her şey genel ve ayarlanabilir yazılır.

## 1. Kemal'in kararları (30.10.2026) — yeniden açılmaz

| Konu | Karar |
|---|---|
| Dağıtım | P1'in kendi Hetzner hesabında, praxis adına açılan sunucuda **tek Praxura kutusu**. Kurulumu biz yaparız, **hasta verisi girilmeden önce erişimimizi praxise devrederiz.** K10/K12 değişmez (onprem O-225) |
| Vertikal | **Physio istisnası:** P1 ilk Physio müşterisi. Physio ince ayarı P1 ile birlikte bitirilir |
| KI | **Kutuda KI açılıyor** (maskeli Azure + jeton, O-169). Avukata sorulmaz; Microsoft C5 kabul edilir, eksik çıkarsa sonra tamamlanır — **Inhaber'in yazılı risk kabulü** (30.10.2026). Serbest metin (mail asistanı, sesle yazdırma) dahil. Bu artık bir iş engeli olarak sunulmaz |
| Foto-Rezept-OCR | **Kapalı kalır** (503). Barkod yolu çalışıyor |
| Abrechnung | İlk aylarda P1'in faturası THEORG'da kalabilir; Praxura'da paralel test edilir. Zulassung ayrı takvim (§5) |
| Tasarım | **Mevcut tasarımdan (`main`) ilerlenir.** Redesign dalı karışmaz, sonra entegre edilir |
| Fiyat | Yapılanlara göre sonra konuşulur — bu depoda rakam yok |

## 2. İş bölümü — çakışmasın diye **alan** bazlı

Kural: herkes kendi alanının dosyalarına dokunur. Yeni kod `module/<alan>.js`'e (dashboard.js
büyümez). Ortak dosyalara dokunma kuralları §3'te.

### 🟦 Melih — "Planung": Kalender · Räume · Standorte · Team · Online-Buchung

| # | İş | Bitti sayılır |
|---|---|---|
| M1 | **Raumplan** — Melih'in yerel taslağı doğru formata: `rooms` tablosu (Standort'a bağlı), Termin'e oda, odalar Einstellungen'de yönetilir | Oda eklenir/silinir; Termin'e oda atanır; aynı odaya çakışan Termin'de uyarı |
| M2 | **Raum auf einen Blick** — takvimde oda görünümü + "şu an hangi terapist hangi odada" şeridi; **randevu ekranında boş odalar** | Gün görünümünde odalar sütun; Termin açarken boş odalar listelenir |
| M3 | **Mehrstandort kutuda (O-224)** — kutu owner'ı `professional` doğduğu için Standort ekranları gizli. `isEnterprise()` yerine `employeeLimit()`'teki `IST_KUTU` deseni | Kutuda Standort ekle, switcher, Datenfreigabe görünür ve çalışır (canli-test) |
| M4 | **Çalışanı Standort'a atama** — haftalık desen (Mo A / Di B) + tek günlük değişiklik, takvimde görünür; "Mitarbeiter zum anderen Standort versetzen" yüzeyde tek akış | Pazartesi A'da çalışan B'nin takviminde Pazartesi görünmez; tek gün değişince iki takvim de doğru |
| M5 | **Team** — Teilzeit/Vollzeit, Urlaubsanspruch girişi (bugün sabit 30, yazan UI yok), izinli güne Termin verilince uyarı | Alanlar kaydedilir; Resturlaub doğru; izinli güne Termin'de uyarı |
| M6 | **Sondertage** — iç takvimde blok/görünüm + etkilenen hastalara mail | Sondertag iç takvimde görünür; o güne Termin'i olan hastaya mail gider (kutuda SMTP) |
| M7 | **Buchungs-Widget** — dashboard'da gömme kodu üreteci (iframe snippet kopyala) | Einstellungen'den kod kopyalanır, harici sayfada çalışır |

### 🟩 Kemal (+ Claude) — "Dokumentation · Akte · Versand · KI · Verordnung"

| # | İş | Bitti sayılır |
|---|---|---|
| K1 | ✅ **Zertifikatspositionen** — MT/MLD/KGG hizmetlerine `required_certificate` (seed + mevcutlara backfill) — 30.10.2026 | `module/physio-katalog-migration.js` testleri |
| K2 | ✅ **KG-ZNS sertifikası** — CHECK constraint'e Bobath/Vojta/PNF değerleri (migration) + X07xx eşlemesi | Sertifikasız terapiste KG-ZNS Termin'inde uyarı |
| K3 | **Physio ICD ↔ Diagnosegruppe kontrolü** (`verordnung-regeln.js` `icd_accept` boş) — `physio` + `gkv-302` | "Verordnung prüfen" uyumsuz ICD/DG'de uyarı |
| K4 | **KI kutuda açılır** (jeton modu, O-169) + risk kabulü kaydı | Kutuda Serienplanung + Mail-Assistent çalışır |
| K5 | **Sesle yazdırma** — mikrofon → kutu → Azure transkripsiyon (EU) → metin kutuda maskelenir → mail taslağı. Tarayıcının Web Speech API'si **kullanılmaz** (sesi Google'a gönderir) | Mail-Assistent'te mikrofon düğmesi, Almanca dikte çalışır |
| K6 | **Vorlagen-Studio: kendi belgeler** — praxis kendi metnini yazar ya da PDF yükler, imza alanını sürükleyip yerleştirir, tablette (Kiosk) imzalatır, akteye kaydolur. Sayfada "Inhalt verantwortet die Praxis" notu | Aufklärungsbogen + Ausfallregel kendi metniyle imzalanıp aktede görünür |
| K7 | **E-Akte** — hastaya dosya yükleme; Physio'da Dokumente sekmesi | Yüklenen dosya aktede listelenir, açılır, silinir |
| K8 | **Physio-Befund formu** (ROM, Kraft, Tests — alanları `physio` ajanı verir) | Befund kaydedilir, Therapiebericht'e taşınır |
| K9 | **Versand** — Rechnung'u hastaya mail; **Fax = Fax-to-Mail** (praxis'in sağlayıcı adres deseni ayarlanır, ör. `{nummer}@…`; bizim gateway yok, G8 temiz) | Rechnung maille gider; Therapiebericht fax adresine PDF olarak gider |
| K10 | **Startseite: elle görev** ekle/işaretle (otomatik uyarıların yanında) | Görev eklenir, abhaken, kalıcı |
| K11 | **Physio katalogu** — Wärme, Kälte, Elektro, Gruppen pozisyonları hazır listeye | Seed'de görünür, fiyat `physio_positions.js` ile aynı |
| K12 | Seans imza listesi (Physio) | Seans başı imza tablette alınır |
| K13 | **Datenübernahme (THEORG)** — hasta + açık VO importu. Ayrı kalem, en son | Örnek export'tan import |

### 🟨 Kemal — kutu altyapısı ve dış işler

| # | İş |
|---|---|
| I1 | Hetzner CX33'te **temiz kurulum provası** (T17a) + gerçek istemci IP'si (T8) |
| I2 | Yedek: Storage Box'a gerçek yedek + **geri yükleme tatbikatı** + anahtarın praxise teslimi |
| I3 | İzleme: alarm maili (O-192) + dış uptime kontrolü |
| I4 | Güncelleme kanalı: `:stable` terfisini uçtan uca koştur (O-189/O-187) ya da `:beta` + O-222 |
| I5 | **Erişim devir protokolü** — hasta verisi öncesi anahtarımız silinir, praxis teyit eder |
| I6 | ✅ Test hesabı (boş, uydurma veri) — app.praxura.de, Mehrstandort için Enterprise — Kemal elle açıyor (30.10.2026) |
| I7 | Physio QA tenant + `canli-test` uçtan uca tur |
| I8 | §302: AZE/DAS süreci, Physio TA-Validator, Erprobung → Zulassung (§5) |

## 3. Çakışma kuralları (ikimiz de `main`'de)

1. **Migration:** yazmadan hemen önce `git pull`, sıradaki numarayı al, **migration dosyasını
   tek başına hemen commit + push et** (kodu sonra). İki kişi aynı numarayı alırsa sonra gelen
   numarasını değiştirir — uygulanmış dosya asla değiştirilmez.
2. **Üretilen dosyalar** (`funktionen/INDEX.*`, `db/SCHEMA*.sql`, `db/NUTZUNG.*`) elle
   birleştirilmez: çakışırsa kendi tarafını at, pull sonrası yeniden üret.
3. **`dashboard.js`**: yalnız import satırı + mevcut fonksiyonda tek satırlık bağlantı. Yeni
   mantık `module/`'e. Aynı fonksiyona ikimiz dokunacaksak önce haber.
4. **`dashboard.html`**: yeni panel/modal ayrı blok olarak sona; mevcut bloğu taşıma.
5. **Ortak modüller** (`katalog-suche.js`, `patient-suche.js`, `calendar-widget.js`,
   `nav-registry.js`) değişecekse önce diğerine haber.
6. Kesişen tek yer: **Sondertage maili (M6) ve Rechnung maili (K9) aynı mail altyapısını**
   kullanır — K9 önce mail gönderme yardımcısını `module/`'e çıkarırsa M6 onu kullanır.
7. Yazmadan önce `fonksiyon-ustasi`, şema için `db-ustasi`, kutu/env/dış çağrı için `onprem`.

## 4. Ticari düşünce: ne temel, ne ek kalem (rakamsız)

İşletmeci gözüyle: **temel iş akışını parçalamayız** — Termin, Patient, Verordnung,
Dokumentation, Raumplan, Vorlagen, Versand, Rechnungen, Abrechnungsvorbereitung pakette.
THEORG'un modül modül satışı müşterinin şikâyet ettiği "alt" hissinin parçası.
Ek kalem yalnız **bize gerçek maliyeti olan** yerlerde:

| Kalem | Tip | Gerekçe |
|---|---|---|
| Einrichtung (Hetzner kurulumu, ilk ayar, devir) | tek sefer | Bizim emeğimiz |
| Datenübernahme (THEORG vb.) | tek sefer | Her kaynak sistem ayrı iş |
| KI-Paket (Serie, Mail-Assistent, Diktat) | aylık | Azure kullanım maliyeti |
| Weiterer Standort | aylık, Standort başına | Destek + ölçek |
| Schulung / Vor-Ort-Tag | tek sefer | Zaman |
| TI-Anbindung | ileride | Ayrı ürün |

Hetzner ücreti praxis'in kendi hesabından ödenir (sunucu onun).

## 5. Zulassung — ne, nasıl

§302 dosyasını Kassen adına alan Datenannahmestelle (DAS) yeni bir göndereni hemen "gerçek"
saymaz: kayıt (Kommunikationspartner) → test dosyaları (Testindikator 0) → Erprobung →
Zulassung. Onay gönderen×alıcı DAS başına. Kod `echt` modunu Zulassung no + tarih girilmeden
açmaz (`api-backend/billing/api/betriebsart.js`). Podoloji dosyası TA-Validator'dan hatasız
geçti (21.09.2026), Physio henüz koşmadı. **Süre hiçbir resmî belgede yazmıyor** — AZE'nin
cevabına bağlı. AZE'ye sorulacak iki soru: (1) ne kadar sürer, (2) Selbstabrechner praxis
yazılım değiştirince Testverfahren'i yeniden koşar mı. Plan: `ABRECHNUNG_ECHTBETRIEB_PLAN.md`.

## 6. Durum

Ops-Dashboard'da üst kart: **"Physio-Pilot P1"** (alt kartlar = bu tablodaki numaralar).
Biten iş burada ✅ ile işaretlenir ve Ops kartı kapanır.
