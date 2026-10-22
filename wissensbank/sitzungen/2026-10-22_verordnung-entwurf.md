---
titel: Verordnung als Entwurf speichern — Prüfhinweise, Abrechnungssperre und Push
typ: sitzung
angelegt: 2026-10-22
tags: [sitzung, verordnung, entwurf, pruefung, abrechnung, qa]
---

# Verordnung als Entwurf speichern

**Stand:** geschrieben, lokal getestet, committed und auf `origin/main` nachgewiesen. **Live-Funktion und echte Persistenz nicht nachgeprüft.** Diese Notiz dokumentiert eine Produktentscheidung und Implementierung; sie ist keine amtliche Quelle.

## Ausgangspunkt und Entscheidung

Beim Speichern einer Heilmittelverordnung mit offenen Angaben zeigte die Maske „Trotzdem speichern“, anschließend aber „Invalid token“. Zwei verschiedene Sachverhalte: fachliche Unvollständigkeit und technischer Authentifizierungsfehler.

Nutzerentscheidung: Unvollständige Verordnung soll ausdrücklich **als Entwurf** speicherbar bleiben. Erfasste Arbeit darf erhalten bleiben, ohne dadurch eine Abrechnungsfreigabe zu erhalten. Nutzer beauftragte Umsetzung, sorgfältige Tests und Dokumentation; danach ausdrücklich Commit und Push.

Bestehenden Speicherweg und bestehenden DB-Status wiederverwenden: `prescriptions.status = 'parsed'`, sichtbar als **Entwurf**. Kein neuer Status `draft`, keine zweite Verordnungstabelle, keine Migration und kein paralleler Speicherweg. Hartes Blockieren schon beim Erfassen wurde verworfen, weil fehlende Angaben nachgereicht werden können. Unvollständige Daten als „bestätigt“ zu speichern wurde ebenfalls verworfen: Speichern und Freigeben müssen unterscheidbar sein.

## Umgesetztes Verhalten

- `saveRezept` führt vorhandene Maskenprüfung beim Speichern erneut aus. Fehlende Angaben, Warnungen oder nicht verfügbare Prüfung bieten „Als Entwurf speichern“ beziehungsweise „Weiter bearbeiten“.
- Confirm und PATCH setzen bei übergangenen Hinweisen, fehlgeschlagener Serverprüfung oder Serverwarnungen `parsed`; Bestätigungsstempel bleiben leer. Antwort liefert tatsächlich gespeicherten Status zurück; Erfolgstext folgt diesem Status.
- Sauberes erneutes Speichern bestätigt einen bestehenden Entwurf als `confirmed`. Andere bestehende Bearbeitungsstatus bleiben bei sauberem Speichern erhalten. Erneute Unvollständigkeit führt zurück zu Entwurf; vorhandenes `abrechnung_status = 'bereit'` wird zurückgenommen.
- Liste, Patientenübersicht und Detail kennzeichnen Entwurf. Nach Entwurfsanlage keine automatische Sitzungsplanung oder Terminzuordnung. Sitzungs-/Mengenautomatik darf Entwurf nicht stillschweigend bestätigen oder abrechnungsbereit machen.
- Abrechnungsauswahl schließt Entwürfe aus. Beide serverseitigen DTA-Erstellungswege und manuelle podologische Abrechnungsfreigabe lehnen `parsed` mit HTTP 409 ab. Podologischer atomarer Übernahmefilter prüft Status zusätzlich vor Veröffentlichung.
- Mandantentrennung, Barcode-Papierbestätigung und Sperren bereits eingereichter Verordnungen bleiben aktiv. Entwurf umgeht keine Anmeldung.
- HTTP 401 erklärt Wiederherstellung: Anmeldung in zweitem Tab erneuern, danach erneut speichern. Offene Maske bleibt erhalten; kein automatischer zweiter POST. **Ursache des beobachteten Live-„Invalid token“ wurde in diesem Arbeitsblock nicht bestimmt oder behoben.**
- Bestätigungsdialog verwendet `--text-main` statt festem `#444`; Text bleibt im Dunkelmodus lesbar.

## Betroffene Stellen

| Bereich | Dateien / Funktionen |
|---|---|
| Speicherfluss | `dashboard.js` → `saveRezept`; `module/verordnung-maske.js` → `schreibeVerordnung`, `sendeAnServer`; `api-backend/server.js` → POST `/api/rezept/confirm`, PATCH `/api/rezept/:id` |
| Anzeige | `dashboard.html`, `module/abrechnungsstatus.js`, `module/verordnung-liste.js`, `module/verordnung-uebersicht.js`, `module/verordnung-detail.js` |
| Automatik / Auswahl | `module/sitzungsfortschritt.js`, `module/podologie-abrechnung.js`, `module/abrechnung-auswahl.js` |
| Serverseitige Freigabe | `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/verordnung-status.routes.js` |
| Neue Regressionen | `module/verordnung-speicherfehler.test.js`, `api-backend/billing/api/verordnung-entwurf-routes.test.js`; zugehörige bestehende Tests erweitert |
| Browser | `tools/browser-probe/verordnung-maske-probe.html` erweitert; vorhandene Masken-, Modul- und Abrechnungsproben verwendet |

`fonksiyon-ustasi` ordnete vorhandenen Speicherweg zu; `db-ustasi` bestätigte vorhandenen Status und wies auf automatische Hochstufungen hin. `gkv-302` befürwortete Trennung unter Bedingung erneuter Prüfung vor Bestätigung und serverseitiger Abrechnungssperre. Funktionsabsicht nach Implementierung nachgemeldet. Keine neue fachrechtliche Regel aus dieser Notiz ableiten.

## Lokale Prüfnachweise

| Prüfung | Ergebnis |
|---|---|
| Frontend-Suite | 2143/2143 bestanden |
| Backend-Suite, abschließender Lauf | 1619/1619 bestanden |
| Werkzeugtests | 277/277 bestanden |
| Gesamtzahl dieser drei Suiten | 4039/4039 bestanden |
| Maskenprobe | 61/61, einschließlich echtem Frontend-Sender mit synthetischer Antwort und 401 ohne zweiten POST |
| Modulprobe | 93/93 Browserimporte |
| Abrechnungsprobe | Rechnungsmodi, Liste, Rezeptblock und BG-Druckansicht bestanden; keine Konsolenfehler |
| Dialog | 390/1280 px, hell/dunkel; kein horizontaler Überlauf; Bestätigung löst auf |
| Syntax / Diff | zwölf Produkt-JS-Dateien bestanden `node --check`; `git diff --check` erfolgreich |
| Funktionskarte im Implementierungsnachweis | erzeugt und geprüft: 3768 Funktionen / 470 Dateien |
| Dashboardgröße im Implementierungsnachweis | 18415 Zeilen bei damaliger Baseline 18416 |

Vier neue Regressionen reproduzierten vor Änderung falschen Bestätigungsstatus und automatische Hochstufung. Erster Gesamtlauf danach: elf Fehler in vorhandenem Abrechnungs-Racetestmock, weil neuer `.neq('status','parsed')`-Filter fehlte. Mock filtert nun real; zusätzlicher Racetest verhindert DTA-Veröffentlichung bei Entwurfswechsel kurz vor Übernahme. Abschließend Race-/Bereinigungstests 15/15 und vollständige Backendsuite grün. Nicht nachträglich nur erfolgreiche Zwischenstände behaupten.

Browser liefen ausschließlich mit synthetischem `/api/config` und synthetischen API-Antworten. Erster lokaler Probeserver verursachte TCP-Abbrüche; nach Backlog 256 wiederholt und bestanden. T3-Snapshot zweimal `Preview automation snapshot timed out after 15000ms.`; danach vorhandener Playwright-Probeweg. Screenshots nach Abschluss von Styles, Fonts und Animationen. Impeccable-Detektor meldete 34 Hinweise im Gesamtbestand; kein vollständiges UI-Audit/PASS behauptet.

## Dauerhafte Belege und Commits

- Vollständiger Prüfbericht: `Claude outputs/2026-10-22-verordnung-entwurf/README.md`.
- Messwerte: `Claude outputs/2026-10-22-verordnung-entwurf/browser-messwerte.json`.
- Vier Screenshots im selben Ordner: `dialog-dark-390.png`, `dialog-dark-1280.png`, `dialog-light-390.png`, `dialog-light-1280.png`. Belege am ursprünglichen Ort belassen; keine zweite Binärkopie in der Wissensbank.
- Tagesverlauf: `fortschritte/2026-10-22.md`, Abschnitt „Verordnung trotz offener Prüfung als Entwurf speichern“.
- Produktänderung: `ff58303e0213fb79c39e9fe63770af94289558f7`. Paralleler Projektthread übernahm sie während isolierter Commitvorbereitung zusammen mit seinem Billing-Auth-/Ops-Block. Kein doppelter Produktcommit.
- Prüfbericht und Screenshots: `7c36bdce0b30406b278c0c6ee680e00a02ae5a5e`, `docs(verordnung): record draft-save validation`.
- Push `ff58303e..7c36bdce main -> main` erfolgreich. `git ls-remote origin refs/heads/main` auch beim Anlegen dieser Wissensnotiz auf `7c36bdce0b30406b278c0c6ee680e00a02ae5a5e` geprüft.
- Paralleler Kontext: [[2026-10-22_hetzner-eigener-server-und-push]]. Dessen Installations-/Migrationsaussagen sind keine Freigabe dieses Speicherflows.

## Offene Grenzen und nächste Abnahme

**Push belegt keine erfolgreiche Auslieferung oder Live-Funktion.** Kein echter Patient angelegt, keine Produkt-DB gelesen/geändert, keine Migration angewandt, keine Abrechnung übermittelt. Anmeldung, tatsächliche Persistenz und Live-Speicherablauf wurden hier nicht nachgeprüft. Ursache des ursprünglichen Live-401 bleibt separat offen; dessen gleichzeitig entwickelter Billing-Authfix ist kein Beweis für Reparatur des Rezept-Speicherwegs.

Nach Auslieferung von Frontend und Backend ist mit freigegebener synthetischer Testpraxis zu prüfen: unvollständig speichern → Entwurf erneut öffnen → Angaben erhalten → Abrechnungsfreigabe gesperrt → korrigieren und erneut speichern → Bestätigung; zusätzlich Authfehler ohne Eingabeverlust. Eine Live-Schreibprüfung ist gesondert zu autorisieren. Offene Arbeit bleibt im Ops-Dashboard, nicht als neue Aufgabenverwaltung in dieser Notiz.

Kontextbridge versagte wegen Modell-/Effort-Konflikt; gemeldete Provider-Tokens 0. Danach gezielte lokale Quellenprüfung. Keine gemessene Netto-Tokenersparnis behauptet.
