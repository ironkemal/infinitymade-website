# Konsey Karar Kaydı

> `/konsey` toplantılarından çıkan kararların dizini. Tam tutanaklar `konsey/tutanak/` altında.
>
> **Konsey toplanmadan önce bu dosyaya bakılır.** Buradaki kapatılmış bir karar, yeni bir olgu
> (mevzuat değişikliği, mimari değişiklik, eşik aşımı, müşteri talebi) olmadan yeniden
> tartışmaya açılmaz.

| Tarih | Karar | Oturanlar | Ödün | Tutanak |
|---|---|---|---|---|
| 2026-08-06 | **Eş-kurucu Aşama-1: iki belge, ikisi de ISLAK İMZA, müşteri görüşmesinden ÖNCE.** (1) `Vertraulichkeits- und Verpflichtungserklärung` — NDA §23 GeschGehG + §53 BDSG Datengeheimnis + §203 StGB, son ikisi kendi başlıklı ayrı paragraf, nachvertraglich/unbefristet. (2) `Mitarbeits- und Rechteübertragungsvereinbarung` — ausschließliche Nutzungsrechte (§31a UrhG dahil, 2026-08-05'e geri dönük) + **yazılı Gegenleistung** (karşılıksız devir §32 UrhG'ye açık) + **ausdrücklicher GbR-Ausschluss** + "nur Testdaten". Ayrıca bağlayıcı olmayan 1 sayfa Term Sheet. **Yeni olgu: InfinityMade = Einzelunternehmung** → bugün devredilecek pay YOK, GbR-Ausschluss ertelenemez. UG/noter/Steuerberater ertelendi | legal-de, muhalif, deger-mi | E-posta onayı yöntemi kullanılamaz (Schriftform §126 BGB); "anlaşma çıkmazsa … EUR" fallback rakamı bugün konuşulmak zorunda; UG yok → sınırlı sorumluluk yok (bilinçli kabul) | [2026-08-06-esk-kurucu-asama1-belgeleri](tutanak/2026-08-06-esk-kurucu-asama1-belgeleri.md) |
| 2026-08-05 | **Onboarding "Dienstleistungen" adımı kalır ama SADECE Selbstzahler adımı olur ve atlanabilir.** GKV'ye onboarding hiç dokunmaz (yazmaz/silmez/fiyat sormaz) — katalog `autoSeedGkvServices()` tekelinde. `onboarding.js:660-678` delete-then-insert daraltılır; eski KOBİ şablonları + GKV adlı kalemler temizlenir. Gerekçe: §302 zinciri `services`'ten Positionsnummer/Vergütung okumuyor, sorun duplicate "KG" satırından doğan **sessiz gelir kaybı**. Kör nokta: `bookings.service_id` FK'sı NO ACTION → randevusu olan owner adımı hiç tamamlayamıyor | gkv-302, podoloji, muhalif, deger-mi | Akış kısalmıyor (7 adım kalır); GKV fiyatları onboarding'de görünmeyecek; adım atlanınca `booking.html` ilk gün sadece GKV gösterir | [2026-08-05-onboarding-dienstleistungen](tutanak/2026-08-05-onboarding-dienstleistungen.md) |
| 2026-08-05 | **Blanko: Fachbereich tablosu YAPILMAYACAK.** `GUELTIG_WOCHEN=16` sabit kalır; `validate.js` yönlendirmesine guard eklenir, Podologie tek anlaşılır mesajla reddedilir. Gerekçe: Podologie §125a Blankoverordnung **yürürlükte değil** (KBV Praxiswissen 2026 s.1144; Diagnoseliste Bölüm 2 sadece Ergo 04/2024 + Physio 11/2024) | gkv-302, podoloji, muhalif, deger-mi, dış göz | Sözleşme geldiği gün kod hazır olmayacak; Fachbereich soyutlaması ertelendi | [2026-08-05-blanko-fachbereich](tutanak/2026-08-05-blanko-fachbereich.md) |

**Yeniden değerlendirme tetiği (eş-kurucu / şirket formu):** UG kuruluşu + noter + Steuerberater
şu eşiklerden **hangisi önce gelirse** aynı hafta açılır: 5 ödeyen müşteri · ~500 €/ay MRR ·
ilk on-prem/Enterprise sözleşmesi · dış yatırım görüşmesi. Gelir/gider paylaşımı ve
Kleingewerbe-fatura modeli **Ekim 2026'da ayrı konsey** konusudur.

**Yeniden değerlendirme tetiği (onboarding):** 3 aktif müşteri onboarding'i bitirdikten sonra bu
adımdan gelen ortalama private hizmet sayısı **0** ise adım tamamen kaldırılır (Seçenek A).

**Yeniden değerlendirme tetiği (Blanko):** Podologie §125a Blankoverordnung sözleşmesi yayımlanır **ve**
en az 1 podoloji müşterisi Blanko rezept getirirse. O gün doğru şekil ayrı motor
(`blankoPodoRules.js`), Fachbereich tablosu değil.

---

## Konsey nasıl çalışır (özet)

`/konsey <soru>` → tarafsız çerçeveleme → ilgili uzmanlar paralel görüş → (çelişki varsa)
kör nokta turu → Chairman sentezi → **KARAR** → `builder` uygular.

**Daimî üyeler:** `muhalif`, `deger-mi`
**Konuya göre:** `legal-de`, `gkv-302`
**Dönüşümlü alan uzmanı:** `podoloji` (ileride `physio`, `logo`, `ergo`)
**Dışarıdan göz:** `agy`/Gemini — proje bağlamı olmadan, bedava

**Veto ağırlıkları:**
- 🔒 `legal-de` ve `gkv-302` ⛔ = **sert veto**, aşılamaz — ancak etrafından dolaşılır
- ⚠️ diğer üyelerin ⛔'ü = güçlü sinyal, bilinçli olarak aşılabilir

**Her üyenin mutlak kuralı:** çıkmaz sokak bırakmak yasak. "Olmaz" diyen, **ne olur** onu da
söyler — daraltılmış kapsam, manuel ikame, %20'lik sürüm, denk çözüm. Hedef her zaman
*"hem meşru hem ucuz hem işe yarar"* olan yol.

**Kapsam kayması freni:** Konsey sorulan soruyu cevaplar, yeni özellik önermez. Çıkan ekstra
fikirler tutanaktaki "Backlog" bölümüne düşer, karara karışmaz.

Detay: `.claude/skills/konsey/SKILL.md`
