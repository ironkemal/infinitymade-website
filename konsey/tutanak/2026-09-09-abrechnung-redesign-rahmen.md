# Konsey Kararı — Abrechnung-Redesign: gemeinsamer Rahmen + Reihenfolge

Tarih: 2026-09-09 · Oturan üyeler: `muhalif`, `deger-mi`, `fonksiyon-ustasi`, `mobil-ui`

## SORU (tarafsızlaştırılmış)

Welchen gemeinsamen Rahmen sollen Rechnungen/Kassenbuch/Mahnwesen/Podologie-Abrechnung
tragen, und in welcher Reihenfolge? On-Prem-Wirkung: nein (reine Frontend-Refaktorierung).

## KARAR

**Diese Sitzung liefert nur S3+S4 (Formatierer + Statusrozetten), korrigiert gegenüber dem
Vorschlag. Die eigentliche Interaktions-/Layout-Redesign der vier Screens wird NICHT in
dieser Sitzung gebaut — sie ist größer als angenommen und braucht einen eigenen Anlauf.**

Konkret für S3+S4:
- **Kein neues `module/abrechnung-badges.js`.** `module/abrechnungsstatus.js` ist bereits
  der Rozet-Modul (5 Importeure: dashboard.js, podologie-abrechnung.js, verordnung-liste.js,
  verordnung-detail.js, patientenliste.js). Eine zweite Datei wäre die Dopplung, vor der der
  Rahmen eigentlich schützen soll. Statusrozetten für Rechnungen/Mahnwesen/Kassenbuch werden
  **in `abrechnungsstatus.js` ergänzt**, nicht in einer neuen Datei.
- **Namenskollision beachten:** `dashboard.js:1394` hat ein eigenes `statusBadge(s)`
  (Booking, gibt eine CSS-Klasse zurück), `module/abrechnungsstatus.js:332` hat ein
  gleichnamiges `statusBadge(key)` (gibt HTML zurück, importiert als `abrStatusBadge`). Jede
  neue Funktion in diesem Bereich mit anderem Namen als `statusBadge` versehen oder explizit
  aliasen — sonst schreibt ein falscher Import stillschweigend Klartext `badge-green` in eine
  Zelle.
- **"5 feste Hex-Werte in `module/podologie-abrechnung.js`" war falsch.** Die Datei
  verwendet bereits CSS-Variablen, 0 Treffer für rohes Hex. Die echten Hex-Werte liegen in
  `dashboard.js:19761` (`LEVEL_COLORS`) und `:3423`. **S5 (Podologie übernimmt Badges) entfällt
  ersatzlos** — nichts zu übernehmen.
- **Geld-Vereinheitlichung ist größer als angenommen und ändert sichtbaren Text.** Nicht 5,
  sondern **11 unabhängige Implementierungen** (u. a. `verordnung-detail.js:139 _euro`,
  `rechnung-zahlungseingang.js:168 eur`, `zuzahlung-korrektur.js:43 eur`,
  `rezeptinfo-geld.js:68`, `katalog-suche.js:465`, plus 6× im Backend-PDF-Template) — und sie
  benutzen **drei verschiedene Ausgabeformate** (`Intl.NumberFormat` mit NBSP,
  `toLocaleString + ' €'`, `toFixed(2).replace` ohne Tausendertrennzeichen). Eine
  Vereinheitlichung ist eine sichtbare Textänderung auf gedruckten Rechnungen/Belegen, kein
  reines Refactoring — braucht visuelle Gegenprüfung vor dem Ausliefern, nicht nur
  `npm test`. **`module/geld.js` bündelt nur die 5 Frontend-Dashboard-Stellen** (`formatEur`,
  `fmtEur`, die drei lokal verdeckenden `const fmtEur` in Mahnwesen/Ausfallrechnungen/
  Statistik — Letztere war unbekannt, jetzt auch gefunden). Die 6 Backend-PDF-Stellen und die
  4 übrigen Frontend-Einzelfälle bleiben unberührt — anderer Schnitt, andere Sitzung.

**S6 (`abrechnung-rahmen.js` verallgemeinert) und S6b (optionale Kassenbuch-Detailansicht)
werden NICHT gebaut.** S6b ist eine neue Funktion, keine Redesign-Aufgabe — braucht ein
Nachfragesignal (Beta-Kunde fragt nach Belegdetail, oder ein Betragsstreit in Mahnwesen), kein
Ticket ohne das. S6 wird nicht vorab verallgemeinert — Rechnungens Umschalter bleibt der
einzige, bis ein zweiter Screen ihn tatsächlich braucht.

**Die Layout-/Interaktions-Redesign der vier Screens (worum der Ops-Auftrag eigentlich
bittet — "spürbar besser in der Bedienung, weniger Klicks") ist ein separater, mehrtägiger
Auftrag** (13–23 Std., über 2–3 Tage — `deger-mi`s Schätzung). Voraussetzung dafür, die hier
neu auftaucht: `loadBelegliste()` und `loadMahnwesen()` (~360 Zeilen) stehen noch komplett in
`dashboard.js`. Jede echte Layout-Änderung an diesen zwei Screens fügt Markup hinzu — bei
Baseline 22097 mit Null Puffer geht das nur, wenn zuerst ein Umzug nach
`module/kassenbuch-ansicht.js` + `module/mahnwesen-ansicht.js` (analog zu S0 bei Rechnungen)
Platz schafft. Das ist ein eigener Schritt, kein Bugfix, und wurde im ursprünglichen Plan
übersehen.

## Gerechtfertigung

`fonksiyon-ustasi`s Faktencheck hat zwei falsche Annahmen im Vorschlag widerlegt (Podologie-
Hex existiert nicht; Geld-Formatierer sind 11 statt 5 mit 3 verschiedenen Ausgaben) und einen
bereits existierenden Rozet-Modul gefunden, den ein neues `abrechnung-badges.js` verdoppelt
hätte. `muhalif` hat den strukturellen Fehler im Zeitplan gefunden: Kassenbuch/Mahnwesen
haben keinen Ort für Redesign-Markup, solange sie in `dashboard.js` stehen — das S3-S6-Gerüst
hätte das erst beim ersten Redesign-Commit schmerzhaft entdeckt. `deger-mi`s Aufwandsschätzung
(13–23 Std.) bestätigt, dass der volle Umfang kein Sitzungsstück ist.

## Ödün verilenler

- Kein Redesign heute — nur die Formatierer/Rozet-Vereinheitlichung. Der Ops-Auftrag
  ("spürbar besser") ist nach dieser Sitzung **nicht erfüllt**, nur vorbereitet.
- Geld-Vereinheitlichung bleibt auf's Frontend-Dashboard beschränkt; Backend-PDFs und vier
  Einzelfälle (`_euro`, `eur`×2, `rezeptinfo-geld.js`, `katalog-suche.js`) bleiben
  unangetastet — Inkonsistenz bleibt dort bestehen, wird aber nicht schlimmer.

## Uzlaşma

Alle vier Mitglieder: Badges + Geld teilen ist richtig; kein genereller Tabellenrenderer;
Podologies 2-Spalten-Fläche bleibt eigenständig. `mobil-ui` bestätigt die Card-Stack-Frage
für <768px ist ungeklärt, aber für **später** (wenn tatsächlich Redesign-CSS geschrieben
wird) — nicht heute relevant, da heute kein Layout geändert wird.

## Anlaşmazlık

Keiner in der Sache — `muhalif`s Sequenzkritik und `deger-mi`s Umfangskürzung ergänzen sich,
beide landen auf "heute kleiner, Layout-Redesign separat".

## Kör noktalar

- Ursprünglicher Vorschlag nannte falsche Hex-Fundstellen (Podologie) und unterschätzte die
  Geld-Formatierer um mehr als das Doppelte.
- Die Voraussetzung für Kassenbuch/Mahnwesen-Redesign (Carve-out zuerst) fehlte im
  ursprünglichen Plan komplett.
- `ensureLeistungskatalog()` (aus der Bugfix-Phase) hat einen vierten, nicht gemeldeten
  Aufrufer: den DMRZ-Export-Pfad (`bindInvEvents` → `dmrzExport`-Closure). Harmlos (gleicher
  Guard), aber wer die Funktion künftig ändert, muss wissen, dass auch DMRZ-Export daran
  hängt, nicht nur der Rechnungseditor.

## Uygulama — builder'a

- [ ] `module/abrechnungsstatus.js` um Rechnungen-/Mahnwesen-/Kassenbuch-Status ergänzen
      (nicht neue Datei); Namenskollision mit `dashboard.js:1394 statusBadge` vermeiden —
      karmaşıklık: K1
- [ ] `dashboard.js:19761 LEVEL_COLORS` + `:3423` Hex durch `abrechnungsstatus.js`-Aufrufe
      ersetzen — karmaşıklık: K1
- [ ] Doppelte `statusMap`/`statusCls` in Rechnungen (`module/rechnung-ansicht.js`) auf
      `abrechnungsstatus.js` umstellen — karmaşıklık: K1
- [ ] `module/geld.js`: die 5 Frontend-Dashboard-Formatierer (`formatEur`, `fmtEur` global,
      3× lokal verdeckend in Mahnwesen/Ausfallrechnungen/Statistik) zusammenführen. Vor dem
      Ausliefern: visuelle Gegenprüfung, welches der 3 Ausgabeformate gewinnt (Betrag-Anzeige
      ändert sich sichtbar) — karmaşıklık: K2
- [ ] `dashboard.html?v=`-Tag + betroffene Modul-`?v=`-Tags erhöhen, `modul-probe.html`
      pflegen — karmaşıklık: K0

## Backlog (karara dahil DEĞİL)

- Layout-/Interaktions-Redesign aller vier Screens (der eigentliche Ops-Auftrag) — eigener,
  mehrtägiger Auftrag. Erster Schritt darin: `module/kassenbuch-ansicht.js` +
  `module/mahnwesen-ansicht.js` Carve-out (analog S0), BEVOR Layout-Änderungen möglich sind.
- Kassenbuch-Detailansicht (S6b) — braucht ein Nachfragesignal, kein Ticket ohne das.
- Backend-PDF-Templates (6 Geld-Stellen) + `verordnung-detail.js _euro` /
  `rechnung-zahlungseingang.js eur` / `zuzahlung-korrektur.js eur` / `rezeptinfo-geld.js` /
  `katalog-suche.js` — auf eine spätere, größere Geld-Vereinheitlichung verschoben.
- Breakpoint-Konsolidierung (`dashboard.css` hat >20 verschiedene `max-width`-Werte,
  12 verstreute `overflow-x`-Regeln) — `mobil-ui`s Fund, gehört zu keinem der vier Screens
  allein.

## Sert veto varsa

Keiner — `legal-de`/`gkv-302` saßen nicht (kein Rechtsrisiko, keine Abrechnungsregel
berührt).
