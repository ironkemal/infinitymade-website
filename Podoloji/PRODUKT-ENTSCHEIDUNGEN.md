# Podoloji — Ürün Kararları

> Podoloji vertikalinde verilen ürün/klinik kararların kaydı. Sahibi: `podoloji` ajanı.
>
> **Amaç:** iki ay sonra "bunu neden böyle yaptık" sorusunun cevabı. Bu bilgi başka hiçbir
> yerde yazmıyor — koddan da git geçmişinden de çıkarılamaz.
>
> Kapatılmış bir karar, yeni bir olgu olmadan yeniden açılmaz.

---

### Podologie Blankoverordnung desteklenmeyecek — net ret mesajı verilecek
- **Karar:** Blanko motoruna Podologie desteği eklenmeyecek. Bunun yerine podoloji rezepti
  Blanko akışına düştüğünde **tek ve anlaşılır** bir mesajla reddedilecek:
  *"Blankoverordnung derzeit nur Physiotherapie (Schulter). Für Podologie besteht kein
  §125a-Vertrag — bitte als Standardverordnung / Muster 13 ausstellen."*
- **Neden:** Podologie için §125a Blankoverordnung sözleşmesi **yok** (KBV Praxiswissen 2026;
  Diagnoseliste 01.01.2026 Bölüm 2 sadece Ergo 04/2024 + Physio 11/2024). Podologda Blanko
  bugün fiilen sıfır — her şey Muster 13 üzerinden yürüyor.
  **Asıl sorun kural değil, mesaj:** bugün podolog ekranda *"ICD ist nicht auf der
  Blanko-Schulterliste"* ve *"nur Diagnosegruppe EX zulässig"* görüyor. Elinde DF/NF tanı grubu
  var, omuz listesinden haberi yok — kendi tanı grubunu yanlış sanıp veriyi bozmaya veya destek
  aramaya yöneliyor. **Yanlış hata mesajı, hata olmamasından pahalıdır.**
- **Tarih:** 2026-08-05
- **Etkilenen:** `api-backend/ai/validators/validate.js` (guard), `blankoRules.js` (kapsam
  yorumu), `dashboard.js` i18n sözlüğü (de/en/tr)
- **Reddedilen alternatif:** `GUELTIG_WOCHEN`'i Fachbereich bazlı tabloya çevirmek. Sözleşme
  yokken parametreleştirmek "destekleniyor" izlenimi yaratır; ayrıca podoloji sözleşmesi geldiğinde
  sadece süre değil tanı grupları, Ampel, Vergütung ve bonus tutarları da farklı olacak — doğru
  şekil tablo değil, **ayrı motor** (`blankoPodoRules.js`).
- **Test senaryosu:** DF-b tanılı hasta (ICD E11.7x tabanlı), Diagnosegruppe DF, HPNR 78030 +
  78001, sağ ayak → Blanko akışına sok, **tek** anlaşılır mesaj çıktığını doğrula.
- **Doğrulanmadı:** "Podolog Blanko'yu hiç kullanmıyor" tespiti `podoloji` ajanının varsayımı —
  gerçek bir podologla teyit edilmedi.
- **Tutanak:** `konsey/tutanak/2026-08-05-blanko-fachbereich.md`

---

### Privat/Selbstzahler akışı: GKV alanları gizlenmez, katlanır
- **Karar:** Podoloji Verordnung formunda `rezeptart ≠ kassen` (privat · selbstzahler · bg) iken
  sadece **Abrechnungs** alanları — Krankenkasse, Diagnosegruppe, ICD-10, Zuzahlung-Befreiung —
  varsayılan **kapalı** bir `GKV-Angaben` bölümüne girer. Diagnosegruppe zorunluluğu
  `rezeptart === 'kassen'` koşuluna bağlanır; boş bırakılırsa **NULL** yazılır (boş string
  değil — `verordnungen_diagnosegruppe_fkey` var). Yerine opsiyonel serbest metin
  `behandlungsanlass`, varsayılan `Podologische Komplexbehandlung`.
- **Wagner ve Fußbefund GİZLENMEZ.** Bunlar klinik dokümantasyondur, ödeyiciden bağımsızdır —
  diyabetik ayak PKV hastasında da Wagner ile belgelenir (§630f BGB, 10 yıl saklama).
  İlk çerçeveleme bunları yanlışlıkla "GKV alanı" saymıştı.
- **PKV ≠ Selbstzahler**, ama ayrım Verordnung formunda değil **fatura katmanında** yaşar:
  Selbstzahler çoğunlukla kozmetik Fußpflege → varsayılan **%19 USt**; PKV → varsayılan
  §4 Nr. 14 a UStG muafiyeti + `Steuerbefreiungshinweis`. **Yazılım muafiyeti otomatik
  varsaymaz**, podolog seçer ve seçim loglanır. Zorunlu bir "medizinische Indikation" alanı
  KONMAZ — podoloğu muafiyeti haksız işaretlemeye iter, riski azaltmak yerine üretir.
- **Neden:** Bugün DG zorunlu olduğu için Selbstzahler kaydında uydurma Diagnosegruppe
  giriliyor. Bu red değil **yanlış içerikli kabul** riski doğurur — en tehlikeli sınıf.
  Gizleme yerine katlamanın sebebi geri-çevrilebilirlik: hasta Rezept'i sonradan getirip kayıt
  `kassen`'e çevrildiğinde DG=NULL kayıt **sessizce eksik** kalır ve hata haftalar sonra
  abrechnung gününde çıkar.
- **Tarih:** 2026-08-10
- **Etkilenen:** `dashboard.js:23990-24067` (form), `:24123` (validasyon), `:24174` (insert),
  `api-backend/billing/api/abrechnung.routes.js:1817` (sunucu guard), `verordnungen` CHECK
  constraint, i18n sözlüğü (de/en/tr)
- **Kritik bulgu:** `abrechnung.routes.js`'te `rezeptart` **hiç geçmiyor** — privat kaydın
  §302 DTA'ya sızmasını engelleyen tek şey `kostentraeger_ik` eşitliği (`:1818`). Bu tesadüf,
  güvence değil. Açık guard + DB `CHECK (rezeptart <> 'kassen' OR diagnosegruppe IS NOT NULL)`
  eklenecek.
- **Reddedilen alternatif:** (1) Alanları tamamen kaldırmak — geri-çevrilebilirlik riski.
  (2) PKV + Selbstzahler'ı tek akışa koymak — KDV rejimleri zıt. (3) `insurance_type` ile
  `rezeptart`'ı senkron etmek — farklı sorulara cevap veriyorlar; GKV hastanın privat
  Verordnung'u meşrudur. Doğru şekil **tek yönlü ön seçim + satır içi uyarı**.
- **Ertelendi:** Behandlung → Rechnung köprüsü (Faz 3). Tetikleyici: Faz 1 canlıda **ve**
  haftada ≥5 Privatrechnung. `insurance_type`'a `selbstzahler` değeri Faz 2 —
  Selbstzahler payı %5'in üstünde çıkarsa.
- **Doğrulanmadı:** Podoloji praxisinde PKV/Selbstzahler hasta oranı (`podoloji` ajanı
  varsayımı, Stefan'a sorulacak). PKV kasalarının Erstattung için Diagnose satırı isteyip
  istemediği kasa bazlıdır. BG/DGUV'nin istediği alanlar (Unfalltag, Aktenzeichen) DGUV
  sözleşmesinden doğrulanmadı — BG şimdilik yarım kova.
- **Tutanak:** `konsey/tutanak/2026-08-10-privat-selbstzahler-akisi.md`
