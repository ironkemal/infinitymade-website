# Konsey Karar Kaydı

> `/konsey` toplantılarından çıkan kararların dizini. Tam tutanaklar `konsey/tutanak/` altında.
>
> **Konsey toplanmadan önce bu dosyaya bakılır.** Buradaki kapatılmış bir karar, yeni bir olgu
> (mevzuat değişikliği, mimari değişiklik, eşik aşımı, müşteri talebi) olmadan yeniden
> tartışmaya açılmaz.

| Tarih | Karar | Oturanlar | Ödün | Tutanak |
|---|---|---|---|---|
| 2026-08-05 | **Blanko: Fachbereich tablosu YAPILMAYACAK.** `GUELTIG_WOCHEN=16` sabit kalır; `validate.js` yönlendirmesine guard eklenir, Podologie tek anlaşılır mesajla reddedilir. Gerekçe: Podologie §125a Blankoverordnung **yürürlükte değil** (KBV Praxiswissen 2026 s.1144; Diagnoseliste Bölüm 2 sadece Ergo 04/2024 + Physio 11/2024) | gkv-302, podoloji, muhalif, deger-mi, dış göz | Sözleşme geldiği gün kod hazır olmayacak; Fachbereich soyutlaması ertelendi | [2026-08-05-blanko-fachbereich](tutanak/2026-08-05-blanko-fachbereich.md) |

**Yeniden değerlendirme tetiği:** Podologie §125a Blankoverordnung sözleşmesi yayımlanır **ve**
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
