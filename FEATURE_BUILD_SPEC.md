# Funktionen-Walkthrough — Build Spec (single source of truth)

> Amaç: praxura.de anasayfasında (`index.html`) **#funktionen** bölümünü, ürünün TÜM
> fonksiyonlarını adım-adım gerçek ekran görüntüleriyle anlatan **interaktif bir
> "ekran" component'i** ile değiştirmek. Kullanıcı isteği: solda fonksiyon listesi,
> sağda bir tarayıcı/ekran çerçevesi içinde seçili fonksiyonun screenshot'ı; çok-adımlı
> fonksiyonlarda nokta göstergesi + otomatik slayt + ileri/geri (slideshow hissi).

## Görseller (HAZIR) — `assets/img/fn/*.webp` (1600px, ~46KB ort.)
Tek-adım paneller: overview, calendar, patients, notes, fahrtenbuch, services, hours,
employees, doctors, anamnese, invoices, billing302, cashbook, dunning, waitinglist,
statistics, b2b, b2c, settings.
Çok-adım kareleri: rezept-1, rezept-2, rezept-3 · billing302-w1, billing302-w2,
billing302-w3 · calendar-new · patients-detail · invoices-pdf · fahrtenbuch-new ·
anamnese-wizard · dunning-modal.

## Tasarım token'ları (assets/system.css :root) — SADECE bunları kullan
- Zemin: `--bg #F8F3E8` (krem), kart: `--bg-card #FFFEFB`, sıcak: `--bg-warm #F1E9D6`, derin: `--bg-deep #E8DCC0`
- Metin: `--ink #1A1611`, `--ink-soft #4A4036`, `--ink-mute #7A6F61`, `--ink-quiet #B5AB99`
- Çizgi: `--line`, `--line-soft`
- Accent: `--bronze #6B5538`, `--bronze-deep #523F26`, `--highlight #C9A876` (gold), `--rose #9C3A3A`, `--sage #4E5C45`
- Font: `--serif 'Fraunces'` (başlık), `--sans 'Plus Jakarta Sans'` (gövde), `--mono 'JetBrains Mono'` (etiket/URL)
- KURAL: gradient YOK, emoji YOK, yeni renk YOK, AI-slop YOK. Mevcut editorial-luxury stile (px-feature, px-demo-frame) birebir uy. Aktif "nokta" rengi = `--bronze` (veya `--rose`).

## Mevcut bölüm
`index.html` içinde `<section class="block" id="funktionen" ...>` (≈ satır 1006).
İçindeki `<div class="px-features-2x2">...4 kart...</div>` + alttaki "Alle Funktionen"
CTA'sı KALDIRILACAK/DEĞİŞTİRİLECEK. `section-head` (eyebrow + title + lede) korunabilir
ama metni güncelle: eyebrow `01 · Funktionen`, title örn. *"Sehen Sie, wie Praxura
arbeitet."*, lede: her modülün gerçek arayüzde nasıl çalıştığını adım adım gösterir.
Component CSS'i index.html `<head>` içindeki mevcut `<style>` bloğuna eklenecek
(px-demo-frame stilleri orada, ~satır 360-490). JS sona `<script>` olarak.

## Fonksiyon verisi (DE) — kategori → fonksiyon → adımlar
Her adım: `{img, t (adım başlığı), d (1 cümle açıklama)}`. Tek-adım fonksiyonda 1 adım.

### A · KI & Abrechnung
1. **rezept-scan** · "KI-Rezept-Scan" · tagline: "Verordnung scannen, KI prüft auf Absetzung"
   - rezept-1 · "Verordnung fotografieren" · "Rezept per Smartphone abfotografieren oder als PDF hochladen."
   - rezept-2 · "KI-Texterkennung läuft" · "Die OCR-KI liest Diagnose, ICD-10-Code und Heilmittelpositionen automatisch aus."
   - rezept-3 · "Geprüft & übernommen" · "Alle Felder erkannt und sofort auf formale Absetzungsgründe geprüft — kein teurer Rückläufer."
2. **billing302** · "§302 DTA-Abrechnung" · tagline: "Direkt mit den Kassen abrechnen — 0 % Provision"
   - billing302 · "Abrechnungsbereite Rezepte" · "Alle fälligen Heilmittelverordnungen auf einen Blick, Gesamtbetrag live berechnet."
   - billing302-w1 · "Plausibilitätsprüfung" · "Jedes Rezept wird auf Vollständigkeit und Abrechnungsfähigkeit geprüft."
   - billing302-w2 · "Digitale Signatur" · "Die Sammelabrechnung wird rechtskonform digital signiert."
   - billing302-w3 · "DTA-Paket erstellt" · "Verschlüsseltes DTA-Paket fertig zum eigenständigen Upload ins Kassenportal."

### B · Termine & Patienten
3. **calendar** · "Terminkalender" · "Mehr-Therapeuten-Kalender ohne Doppelbuchung"
   - calendar · "Alle Therapeuten in einer Ansicht" · "Termine farbcodiert je Therapeut, Tag-/Wochen-/Monatsansicht."
   - calendar-new · "Termin in Sekunden anlegen" · "Patient, Leistung und Therapeut wählen — Slot wird automatisch geprüft."
4. **b2c** · "Online-Buchung (B2C)" · "Patienten buchen 24/7 selbst"
   - b2c · "Selbstbuchung per Link & QR" · "Persönlicher Buchungslink und QR-Code; gebuchte Termine fließen direkt in den Kalender."
5. **patients** · "Patientenakte" · "Digitale Karteikarte mit ganzer Historie"
   - patients · "Alle Patienten zentral" · "Durchsuchbare Liste mit Krankenkasse, Therapeut und Status."
   - patients-detail · "Vollständige Akte" · "Stammdaten, Termine und Anamnese pro Patient an einem Ort."
6. **waitinglist** · "Warteliste" · "Freie Slots automatisch nachbesetzen"
   - waitinglist · "Lücken sofort füllen" · "Bei Absagen rücken wartende Patienten automatisch nach."
7. **anamnese** · "Anamnese & Befund" · "Strukturierte Erstbefundung"
   - anamnese · "Befundungen verwalten" · "Alle Anamnesen je Patient sauber dokumentiert."
   - anamnese-wizard · "Geführte Befundung" · "Schritt-für-Schritt-Assistent für die Erstaufnahme."
8. **notes** · "Notizen" · "Schnelle interne Absprachen"
   - notes · "Team-Notizen zentral" · "Interne Vermerke und Absprachen an einem Ort."

### C · Finanzen & Compliance
9. **invoices** · "Rechnungen" · "Privatrechnungen mit einem Klick"
   - invoices · "Rechnungsübersicht" · "Alle Rechnungen mit Status: bezahlt, offen, gesendet."
   - invoices-pdf · "Profi-Rechnung als PDF" · "Fertige Rechnung drucken oder direkt versenden."
10. **cashbook** · "Kassenbuch (GoBD)" · "Revisionssichere Barkasse"
    - cashbook · "GoBD-konforme Kasse" · "Bargeldbewegungen finanzamtsfest und revisionssicher erfassen."
11. **dunning** · "Mahnwesen" · "Offene Posten automatisch anmahnen"
    - dunning · "Offene Posten im Blick" · "Überfällige Rechnungen werden automatisch erkannt."
    - dunning-modal · "Mahnung in einem Klick" · "Zahlungserinnerung und Mahnstufen automatisch erstellt."
12. **fahrtenbuch** · "Fahrtenbuch" · "Hausbesuche & Pauschalen automatisch"
    - fahrtenbuch · "Elektronisches Fahrtenbuch" · "Hausbesuchsfahrten GoBD-konform und steuersicher dokumentiert."
    - fahrtenbuch-new · "Fahrt in Sekunden erfassen" · "Strecke, Patient und Pauschale werden automatisch berechnet."
13. **statistics** · "Statistik & Berichte" · "Praxis-Kennzahlen auf einen Blick"
    - statistics · "Umsatz & Auslastung" · "Umsatzentwicklung, Auslastung und GKV/Privat-Anteil sofort sichtbar."

### D · Praxis & Team
14. **overview** · "Dashboard-Übersicht" · "Ihr Praxistag auf einen Blick"
    - overview · "Tagesstart in Sekunden" · "Termine heute, Umsatz, Auslastung und letzte Aktivitäten kompakt."
15. **employees** · "Mitarbeiter" · "Team & Rollen verwalten"
    - employees · "Team zentral steuern" · "Mitarbeiter, Rollen und Berechtigungen an einem Ort."
16. **services** · "Dienstleistungen" · "Leistungskatalog pflegen"
    - services · "Behandlungen definieren" · "Leistungen mit Dauer und Preis festlegen."
17. **hours** · "Arbeitszeiten" · "Verfügbarkeiten je Therapeut"
    - hours · "Arbeits- & Öffnungszeiten" · "Verfügbarkeiten steuern die Online-Buchung automatisch."
18. **doctors** · "Ärzte" · "Verordner-Verzeichnis"
    - doctors · "Ärzte-Verzeichnis" · "Verordnende Ärzte für schnelle Rezeptzuordnung pflegen."
19. **b2b** · "B2B-Kontakte" · "Zuweiser & Partner"
    - b2b · "Kooperationspartner pflegen" · "B2B-Kontakte und Zuweiser zentral verwalten."
20. **settings** · "Einstellungen" · "Praxis-Konfiguration"
    - settings · "Praxis-Einstellungen" · "Stammdaten, Integrationen und Konfiguration zentral."

## Component yapısı & davranış
- Layout: 2 sütun. SOL (~280-320px): kategori başlıkları + fonksiyon adları listesi (rail);
  aktif olan vurgulu (`--bronze` sol-border + `--bg-card`). SAĞ: tarayıcı çerçevesi
  (`px-demo-bar` stiline benzer üst bar: 3 nokta + mono URL `app.praxura.de/dashboard`)
  içinde aktif adımın `<img>`'i (lazy, decoding async, 16:10). Çerçeve altında **caption bar**:
  adım başlığı (serif) + açıklama (sans, --ink-soft) + sağda adım **noktaları** (çok-adımlıysa)
  + ‹ › ok butonları.
- Otomatik slayt: aktif fonksiyonun adımları arasında ~3sn'de bir ilerle; son adımdan sonra
  bir SONRAKİ fonksiyona (adım 1) geç → tüm fonksiyonların slideshow'u. Kullanıcı bir
  fonksiyona/ok/noktaya tıklayınca otomatik oynatma DURUR (veya play/pause toggle). Hover'da duraklat.
- Noktalar tıklanabilir (kullanıcının "kırmızı noktalar basınca ilerliyor" isteği). Aktif nokta `--bronze`.
- İlk yükte img'leri lazy yükle; sadece aktif + komşu adımları öncele. `prefers-reduced-motion`'da otomatik oynatmayı kapat.
- Erişilebilirlik: fonksiyon rail butonları `aria-selected`, noktalar `aria-label="Schritt n"`, oklar `aria-label`. Klavye: rail'de ok tuşları, Enter seç.
- Mobil (<860px): rail üstte yatay kaydırılabilir chip satırına dönüşür; ekran + caption altına stack. Görseller tam genişlik.

## i18n
- Site şu an DE-only (index.html'de lang switcher YOK). DE'yi varsayılan yap.
- TÜM string'leri (fonksiyon adı, tagline, adım t/d, bölüm başlıkları) bir JS objesinde topla
  ki sonradan EN/TR eklensin. Yapı: `FN_DATA` (resim+key) + `FN_I18N = { de:{...}, en:{...}, tr:{...} }`.
  EN/TR ayrı görevde doldurulacak — şimdilik de doldur, en/tr boş bırakılabilir (fallback de).

## Kabul kriterleri
- [ ] #funktionen artık interaktif ekran component'i; eski 4 kart gitti.
- [ ] 20 fonksiyon rail'de kategorize; tıklayınca sağdaki ekran değişir.
- [ ] Çok-adımlı fonksiyonlarda nokta + ok + otomatik slayt çalışır; tek-adımda nokta gizli.
- [ ] Görseller `assets/img/fn/<slug>.webp` doğru eşleşir, lazy.
- [ ] Mobilde düzgün stack, yatay rail.
- [ ] Sadece system.css token'ları; gradient/emoji yok; mevcut stille tutarlı.
- [ ] Konsol hatasız; reduced-motion'da otomatik kapalı.
