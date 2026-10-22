# Verordnung als Entwurf speichern — 22.10.2026

Status: geschrieben und lokal getestet. Kein Commit, Push, Deployment oder Live-Schreibtest durch diesen Arbeitsblock. Keine Migration nötig; vorhandener Bearbeitungsstatus `prescriptions.status = 'parsed'` wird als **Entwurf** verwendet.

## Verhalten

- Beim Speichern wird die vorhandene Maskenprüfung erneut ausgeführt. Fehlende Angaben, Warnungen oder nicht verfügbare Regeldaten führen zur Frage **„Als Entwurf speichern?“**. Abbrechen heißt **„Weiter bearbeiten“**.
- Confirm und PATCH speichern bei übergangenen Hinweisen, fehlgeschlagener Serverprüfung oder Serverwarnungen als `parsed`. Entwürfe erhalten keinen Bestätigungsstempel. API liefert tatsächlich gespeicherten Status zurück; Erfolgstext richtet sich danach.
- Ein bestehender Entwurf wird nach erneutem sauberem Speichern `confirmed`; andere bestehende Bearbeitungsstatus werden bei sauberem Speichern erhalten. Ein erneuter fehlerhafter Stand wird wieder Entwurf; bestehende Abrechnungsbereitschaft `bereit` wird zurückgenommen.
- Liste, Patientenübersicht und Detail markieren Entwurf. Automatische Sitzungsplanung/Terminzuordnung nach Neuanlage wird für Entwürfe übersprungen. Sitzungs- und Mengenautomatik bestätigen Entwürfe nicht stillschweigend.
- Entwürfe fehlen in der Abrechnungsauswahl. Beide DTA-Erstellungsrouten sowie manuelle podologische Abrechnungsfreigabe lehnen `parsed` serverseitig mit 409 ab. Podologischer atomarer Übernahmefilter prüft Entwurfsstatus zusätzlich vor Veröffentlichung.
- Bestehende Mandanten-, Barcode-Papierbestätigungs- und Einreichungssperren bleiben aktiv. Entwurf ist kein Weg um Anmeldung oder diese Sperren herum.
- HTTP 401 beim Speichern zeigt verständlichen Hinweis: Anmeldung in zweitem Tab erneuern, dann nochmals speichern. Maske bleibt erhalten; kein automatisches Wiederholen eines POST. Ursache des auf Screenshots beobachteten Live-401 wurde hier **nicht** bestimmt oder behoben.
- Textfarbe des vorhandenen Bestätigungsdialogs nutzt `--text-main`; zuvor festes `#444` war im Dunkelmodus kaum lesbar.

## Dateien

Speicherweg: `dashboard.js`, `module/verordnung-maske.js`, `api-backend/server.js`.
Anzeige: `dashboard.html`, `module/abrechnungsstatus.js`, `module/verordnung-liste.js`, `module/verordnung-uebersicht.js`, `module/verordnung-detail.js`.
Abrechnung/Automatik: `module/abrechnung-auswahl.js`, `module/sitzungsfortschritt.js`, `module/podologie-abrechnung.js`, `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/verordnung-status.routes.js`.
Regressionen in zugehörigen Tests, neu `module/verordnung-speicherfehler.test.js` und `api-backend/billing/api/verordnung-entwurf-routes.test.js`. Vorhandene Browserprobe `tools/browser-probe/verordnung-maske-probe.html` um synthetischen Entwurfsspeicherlauf und 401 ergänzt.

## Nachweise

- Vor Fix: vier neue Regressionen reproduzierten falschen Bestätigungsstatus und automatische Hochstufung eines Entwurfs.
- `npm run test:frontend`: **2143/2143**.
- `npm run test:backend`: **1619/1619** im abschließenden Lauf.
- `npm run test:tools`: **277/277**.
- Erster Gesamtlauf enthielt elf Fehler, weil vorhandener Abrechnungs-Racetestmock den neuen `.neq('status','parsed')`-Filter nicht unterstützte. Mock filtert jetzt real; zusätzlicher Racetest beweist, dass kurz vor Übernahme zum Entwurf gewordene Verordnung keine DTA veröffentlicht. Abschließend alle **15/15** Race-/Bereinigungstests und vollständige Backendsuite bestanden.
- Maskenprobe: **61/61**, einschließlich echtem Frontend-Sender mit synthetischer API-Antwort, leeren Angaben und 401 ohne zweiten POST.
- Modulprobe: **93/93** Browserimporte. Abrechnungsprobe: Rechnungsmodi, Liste, Rezeptblock und BG-Druckansicht bestanden, keine Konsolenfehler.
- Dialog mit echtem HTML, Styles und Bestätigungshandler sowie Dialogoptionen aus aktuellem `saveRezept`: 390/1280 px, hell/dunkel, kein horizontaler Überlauf, Bestätigung löst korrekt auf. Screenshots und `browser-messwerte.json` hier im Ordner. Keine Anmeldung oder echte Persistenz dabei.
- Syntax: zwölf betroffene Produkt-JS-Dateien bestanden `node --check`. `git diff --check` erfolgreich. `dashboard.js`: 18415 Zeilen, Baseline 18416; Datei wächst nicht. Funktionskarte erzeugt und `--check`: **3768 Funktionen / 470 Dateien**, aktuell.
- Impeccable-Detektor einmal ausgeführt: 34 Hinweise im gesamten gelesenen Bestand; kein behauptetes vollständiges UI-Audit. Geänderter Dialog separat gerendert und visuell geprüft.

## Prüfgrenzen und Arbeitsweise

Nur synthetische Testdaten und lokale Dateien. Keine Produkt-DB oder Migration, keine Patientenanlage und kein Live-Speichern, keine Abrechnungsübermittlung. Authentifizierung und tatsächliche Persistenz auf SaaS bleiben ungetestet; Frontend und Backend müssen gemeinsam ausgeliefert werden, bevor neues Verhalten live verfügbar ist.

Lokaler Probeserver nutzte ausschließlich synthetisches `/api/config`, ohne `.env` zu lesen. Erste parallele Browserläufe scheiterten an TCP-Verbindungsabbrüchen bei kleinem Server-Backlog; nach Vergrößerung auf 256 wiederholt und bestanden. T3-Vorschau zweimal: `Preview automation snapshot timed out after 15000ms.` Danach vorhandener Playwright-Probeweg verwendet. Screenshots erst nach Styles, Fonts und Animationen aufgenommen.

Vorhandene fremde Änderungen im gemeinsamen Checkout erhalten, insbesondere heutiger separater Billing-Authfix und Dokumentation. Änderungen an derselben Routendatei ergänzen ausschließlich Entwurfssperren.

Pflichtberatung: `fonksiyon-ustasi` ordnete bestehende Funktionen zu; `db-ustasi` bestätigte vorhandenen Status und warnte vor Statusautomatik; `gkv-302` befürwortete Trennung unter Bedingung erneuter Prüfung und serverseitiger Abrechnungssperre. Funktionsabsicht nach Implementierung nachgemeldet. Kein neuer paralleler Speicherweg.

Provider: Kontextbridge scheiterte an Konflikt `gemini-3.8-flash-high`/`effort=low`; gemeldete Provider-Tokens 0, kein erfolgreicher Cacheeintrag. Anschließend gezielte direkte Quellenprüfung. Keine gemessene Netto-Tokenersparnis behauptet.


## Commit-/Push-Nachweis

Nach ausdrücklicher Freigabe „committe und pushe“ am 22.10.2026: Während der isolierten Commitvorbereitung hat ein paralleler Projektthread die Entwurfsänderung zusammen mit seinem Billing-Auth-/Ops-Block in `ff58303e0213fb79c39e9fe63770af94289558f7` übernommen und gepusht. `git ls-remote origin refs/heads/main` bestätigt exakt diesen Stand. Kein doppelter Produktcommit. Dieser Prüfbericht, Messwerte und vier ausschließlich lokale, synthetische Dialogscreenshots werden separat als Dokumentation committed. Kein zusätzlicher Live-Funktionstest oder DB-Nachweis daraus abgeleitet.
