# Konsey mini turu — Rezept-Scan: sınırlar, takma ad ve barkod
Tarih: 2026-09-28 · Oturan üyeler: legal-de, gkv-302, podoloji

## Soru
Reçetedeki kimlik bilgileri kutuda kalsın, AI'a yalnız kimliksiz tıbbi içerik gitsin (takma ad ya da kırpma). Bu yolla §393/§203 yükünden ve sertifikadan kurtulabilir miyiz? Sınır nerede çizilmeli?

## En önemli bulgu (gkv-302)
Matbu Muster 13 reçetelerin üzerinde bir **PDF417 barkodu** var. Kaynak: KBV Technisches Handbuch Blankoformularbedruckung V4.80 (13.05.2026), §3.11.1 "Barcode Inhalt Muster 13/E". Barkod 33 alan taşıyor:
- Kimlik bilgileri ve Kostenträgerkennung
- BSNR, LANR, Ausstellungsdatum
- Tıbbi içerik: ICD, Diagnosegruppe, Leitsymptomatik, Heilmittel, Einheiten, Frequenz ve diğerleri

Yer yetmese bile basılması zorunlu (§2.6g). Barkod kutuda, GPU olmadan, açık kaynak bir kütüphaneyle okunabilir. Yani **barkodlu reçetede bulut AI'a gerek yok.** Barkoddan gelmeyen alanlar: Therapieziele, Unfall/BVG, Zuzahlungsfrei (bu liste AÇIK, doğrulanmadı). El yazısıyla doldurulan reçetelerde barkod yok (örneğin Hausbesuch'ta yazılanlar). Matbu ile el yazısı reçetelerin oranı bilinmiyor.

## legal-de: KOŞULLU, B ve C'den daha güçlü bir yol
- **§203:** Alıcının kişiye bağlayamadığı bilgi "Offenbaren" sayılmaz (hâkim görüş; şerh doğrulanmadı).
- **DSGVO:** EuGH C-413/23 P (EDPS/SRB, 04.09.2025) bu yolu destekliyor. Kararın DSGVO'ya aktarılması bekleniyor, ama tartışmasız değil. Praxura Auftragsverarbeiter olmayabilir (AÇIK).
- **§393:** AÇIK. Hüküm praxis düzeyinde uygulanabilir; o durumda gereken testat Microsoft'unki olur.
- **Tablo eksiklikleri:**
  - Barkod görüntüden kaldırılmalı.
  - Kaşe, imza, serbest metin (Leitsymptomatik/Therapieziele), EXIF verisi ve dosya adı, nadir ICD kombinasyonları, zaman damgası.
  - Kırpma form koordinatına göre yapılmalı (tespite dayanmamalı). Mümkünse görüntü yerine metin gönderilmeli. Emin olunamazsa hiçbir şey gönderilmemeli (fail-closed).
- **Şart:** 20 reçetelik bir sızıntı testi (red-team) sıfır kimlik kalıntısıyla geçmeli.
- **Avukata tek soru** (~1 saat, €150–300), memodaki F1'in yerine geçer. Soru metni legal-de'nin raporunda.

## podoloji
- "Önce hasta, sonra reçete" sırası podologun doğal akışı. Kimlik bilgisi seçilen hastadan gelir; lokal motor yalnız eşleşmeyi kontrol eder.
- Kart okuyucu zorunlu tutulmamalı (Hausbesuch'ta okuyucu yok).
- Tek birleşik ekran, tek "Speichern" düğmesi.
- Bulut adımı praxis başına bir ayarla açılıp kapanmalı; Beta-1 için kapalı başlamalı ("KI kapalı" sözü korunur).

## KARAR
Rezept-Scan'in hedef mimarisi **"önce yerel"** olur:
1. **Barkodlu reçete:** PDF417 kutuda okunur. Buluta hiçbir şey gitmez. §393, §203 ve sertifika sorusu doğmaz.
2. **Barkodsuz reçete:** kimlik bilgisi seçilen hastadan gelir. Tıbbi bölge form koordinatına göre kırpılır (barkod, kaşe ve imza bölgeleri karartılır). Yalnız bu kısım, praxis ayarı açıksa buluta gider. Bu yol ancak avukatın tek soruya olumlu cevabından ve red-team testinden SONRA açılır. O zamana kadar bu alanlar elle girilir (`katalog-suche.js`).
3. 09-12 kararı (E) ve bugünkü B kararı bununla çelişmiyor. B'nin önemi büyük ölçüde azalıyor: bulut yalnız barkodsuz kalan az sayıdaki reçete için gerekiyor.

## Doğrulanacaklar
- Barkodlu ve el yazısı reçetelerin gerçek oranı (Beta-1'e sorulacak ya da örnek reçetelerden sayılacak).
- Barkod alan listesinde Therapieziele / Unfall / Zuzahlungsfrei var mı.
- Kassenwechsel durumunda eGK'daki IK ile reçetedeki IK'dan hangisi geçerli.
- `builder.js:186-187`'deki `999999999` yedek değerinin geçerli bir Ersatzwert olup olmadığı.

## Uygulama — builder'a
- [ ] Spike: lokal PDF417 okuma (açık kaynak, CPU). Test için gerçek biçimli örnek reçete gerekiyor: `archive/medya/demo rezept/Demo.png` barkodlu mu, kontrol edilecek. Barkod içeriği KBV §3.11.1 alan listesine göre ayrıştırılacak. — K2
- [ ] BFB Handbuch V4.80 wissensbank'a kaydedilecek (kimlik kartı + INDEX). — K0
- [ ] Konseyin önceki kararındaki 4 kod işi aynen geçerli: confidence kapısı, KVNR Prüfziffer, llmClient, azureClient throw. — K2
