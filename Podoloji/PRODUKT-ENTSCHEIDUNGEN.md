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
