---
titel: Praxura — offene Punkte bei nächster Nachfrage
datum: 2026-11-11
typ: sitzung
tags: [offene-punkte, restarbeiten, wiederaufnahme, abnahme]
---

# Offene Punkte — Einstieg für nächste Nachfrage

Nutzerauftrag: Bei „Was ist noch offen?“ diesen Stand finden, gegen neuere Originalbelege prüfen und verbleibende Punkte nennen. Nicht erneut planen oder bereits erledigte Arbeiten wieder öffnen. Diese Notiz ist gespeicherter Gesprächsstand, keine neue konkurrierende Aufgabenliste. Führende Nachweismatrix: `fortschritte/2026-11-06.md`. Neue Fachbelege und zuständige Bearbeiter haben Vorrang vor historischen Aussagen.

## Zuletzt genannter Reststand

| Thema | Noch fehlend / nächster Schritt | Verantwortlich |
|---|---|---|
| Auslieferung und Feiertage | Aktuelle Frontend-/Backendversion bestätigen; Feiertagsbutton im autorisierten QA-Mandanten klicken, Persistenz prüfen. 33 lokale Tests ersetzen Live-Abnahme nicht | Integrator; QA-Sitzung durch Nutzer |
| Räume | Tatsächlich gleichzeitige Buchung letzter automatischer Raumkapazität nachweisen; vorhandene Ausstattungs-/Buchungsbelege wiederverwenden | Integrator, exklusiver Browser |
| F11 | Persönliche Mitarbeiteroberfläche, eigene Anstellung und Mandantentrennung mit echter autorisierter Mitarbeitersitzung prüfen; bestehende Teamrechte erhalten | Integrator/F11-Bearbeiter; Nutzer stellt Sitzung bereit |
| Rechnungsrechte / 0081 | Inaktive Mitarbeiter, Modulrechte und Storno-/Wartelistenreferenzen anhand aktueller Originaltests prüfen und schließen; 0119 schützt nur Rechnungs-Ownerwechsel | Zuständiger DB-/Rechtebearbeiter, Kemal fachlich; Integrator koordiniert |
| Mail/KI | Authentifizierter Live-Nachtest; echte KI-Entwurfserzeugung erst nach separater Freigabe und technischer Begrenzung auf höchstens drei Aufrufe / 1 EUR. Kein Versand | Mailbearbeiter/Integrator; Nutzer Zugänge und KI-GO |
| Physio-Abrechnung | Vollständiger Quellen-/Katalogabgleich, Befreiungsnachweise und ursprünglicher Behandlungsbeginn, Korrektur-/Wiederaufnahmekette sowie unabhängige Gesamtabnahme; neuere Fachfortschritte vor erneuter Aufgabenvergabe prüfen | Bestehender Physio-Bearbeiter; Kemal/Praxis fachlich |
| Dokumentation und Gesamtabschluss | O-242 im tatsächlichen Releasekanal, aktuelle Matrix und Anforderungs-/Belegabgleich | Integrator |
| Kontext-/Limitautomatik | Steuerbare Kontextschwelle und automatische Limit-Reset-Erkennung nicht nachgewiesen. Native Kompaktierung nicht als vollständige Automatik ausgeben | Integrator; dokumentierte Werkzeugfähigkeiten zuerst prüfen |

## Nachtrag 18.11.2026 — Backend-401 / Zahlungsjournal / Rechnung

Herkunft: [[2026-11-18_backend-401-beendete-sitzung-csv-export]] (Fixes `0e6552d1`, `daa56924` live). Erledigt und nicht erneut öffnen: Wächter für beendete Sitzung, `signOut` lokal im Dashboard, lesbare Fehlertexte, CSV-Export, Zuzahlung nur mit Verordnung + Leistung, Straße ohne Hausnummer-Rest, Kachel „nur GKV“.

| Thema | Noch fehlend / nächster Schritt | Verantwortlich |
|---|---|---|
| Mitarbeiter anlegen/entfernen | Live **schreibend** im QA-Mandanten prüfen (anlegen → Einrichtungscode, entfernen → Bestätigung nennt Namen, Zugang gesperrt). Bisher nur lesend + Code; auch der schreibende Lauf vom 18.11. (`write-live.mjs`) deckte das nicht ab | Melih (Lauf), Integrator |
| Auslöser der beendeten Sitzung | Nicht bewiesen, welcher Abmeldevorgang am 17./18.11. die Sitzung beendet hat. Optional in den Supabase-Auth-Logs nach `logout` für das betroffene Konto suchen | Melih (Supabase-Dashboard) |
| Weitere `signOut()` ohne `scope` | `onboarding.js`, `admin-login.js`, `admin.js` beenden weiter alle Geräte. Entscheiden, ob auch dort `{ scope: 'local' }`; `dsgvo-client.js` (Kontolöschung) bleibt bewusst global | Integrator, `guvenlik` kurz fragen |
| Rohtexte außerhalb des Dashboards | Der Wächter und `fehlertextAus` wirken nur in `dashboard.js` und den genannten Modulen. `booking-request.js` (`apiFetch`) reicht `body.error` ungefiltert durch; andere Seiten (`kalender.html` u. a.) nicht geprüft | Integrator, Vorab `fonksiyon-ustasi` |
| QA-Konto Datenpflege | Einstellungen → Praxis: Straße + Nr. eintragen. Einstellungen → DATEV: Berater- und Mandantennummer (DATEV-Export antwortet sonst 409 `DATEV_ANGABEN_FEHLEN`) | Melih |
| Praxiseinnahmen inkl. Bar | Falls gewünscht: eigene Kachel/Reihe für alle Einnahmen (Belegliste inkl. Barzahlungen). Heute nur Beschriftung „nur GKV“; wäre eine neue Funktion | Entscheidung Melih/Kemal |
| Ops-Dashboard | Diese Punkte im Ops-Dashboard (Kategorie Teknik/Launch) anlegen; hier nur gespeichert | Melih oder lokale Sitzung mit `ops/.env.ops` |

Bewusst **kein** Handlungsbedarf: INV-2026-0003 druckt im Kopf weiter „1“ — eingefrorener `aussteller_snapshot` (§ 147 AO), nicht nachträglich ändern. Neue Rechnungen sind korrekt (INV-2026-0004 `strasse = ""`).

## Nachtrag 19.11.2026 — Physio-Launch Stufe 1, 0081, Raum-Concurrency & AZE

Herkunft: [[2026-11-19_physio-launch-stufe1-sitzung-auth-raeume-ueberblick]] (`b4009e27` auf `origin/main` gepusht). **Erledigt und nicht erneut öffnen:**
- **Rechnungsrechte / 0081** (alle 3 Teilpunkte: inaktive Mitarbeiter, Modulrecht `abrechnung`, Storno- & Wartelistenreferenzen) — über `0120`/`0121` seit 11.11.2026 live, in `Physio/LAUNCH-P1.md` (`92bf589d`) abgehakt.
- **Weitere `signOut()` ohne `scope`** (`admin-login.js`, `admin.js`, `onboarding.js`) → `{ scope: 'local' }` (`f159d224`).
- **Rohtexte außerhalb des Dashboards** (`booking-request.js`, `booking.js`, `login.js`, `onboarding.js`) → `api-sitzung.js` + deutsche Netzwerk-/Login-Fehler (`f159d224`, `4b9ced90`).
- **Räume (gleichzeitige Buchung letzter automatischer Kapazität)** → lokal auf `postgres:17.11` bewiesen (`0104-raum-kapazitaet-concurrency-proof.mjs`, `748148ef`).
- **Überblick-CSS (`redesign-wachen`)** → nach `dashboard-ueberblick.css` verschoben (`b4009e27`), `npm test` 100 % grün.

**Verbleibend für Physio-Launch Stufe 1:**
- Melih: `canli-test/2026-11-19-physio-launch-checkliste.md` (15-Minuten-Live-Checkliste: Gerätetests, QA-Datenpflege Straße/DATEV, Feiertag, Mitarbeiter anlegen/F11/entfernen, Physio-Kernfluss).
- Kemal: Box `L1–L7` und 4 Partnerfragen (`#13`, `#14`, `#1`, `#22`) laut `Physio/LAUNCH-P1.md`.
- Stufe 2 / extern: AZE-Antwort auf `TSOL0101–0105` (Betreff `590537440`) abwarten; Entlassmanagement-Freigabe (`0112–0115`) + Tages-Zuzahlung (`#22`).

## Nachtrag 20.–21.11.2026 — Migrationen 0124–0129, QA-Fixes F-01–F-13 & Verordnungsliste-Pagination

Herkunft: `fortschritte/2026-11-20.md`, `fortschritte/2026-11-21.md`, [[2026-11-21_dashboard-ueberblick-qa-fixes]] (`6a61ac95` auf `origin/main` + lokale Pagination-Umstellung vom 21.11.). **Erledigt und nicht erneut öffnen:**
- **Migrationen `0124`–`0129`** am 20.11.2026 live auf SaaS angewandt (`20261120212231 praxura_0124_bis_0129_physio_qa`), `db/SCHEMA.sql` & `db/SCHEMA-RLS.sql` exportiert.
- **Fach-/Produktentscheidungen (20.11.):** Gruppenraumregel per `0129` umgesetzt (1 Haupttermin je Raum, Gruppenteilnehmende teilen den Raum); GPS-Check-in entfernt & auf `attendance.html` blockiert; Zuweiser bleibt; Rechnungsvorgaben je Praxis zurückgestellt.
- **Dashboard- & Überblick-QA-Fixes (`F-01`–`F-13` + `9.1`–`9.6`)** am 21.11. vollständig umgesetzt, lokal + Playwright verifiziert, gemergt (`629094db`) und gepusht (`6a61ac95`).
- **Verordnungsliste & Kopfleisten-Suche Pagination (`module/verordnung-uebersicht.js`, `module/kopf-dokumente.js`):** Beide `prescriptions`-Töpfe von `.limit(200)` auf stabile Keyset-Pagination (`id ASC`, 200er-Seiten, bis 5000 je Topf) umgestellt; `podologie_behandlungen` in 100er-UUID-Blöcken + 500er-Keyset-Seiten geladen; lokal mit Unit-Tests, `typecheck` und Browser-Probes verifiziert (lokal committet auf `main`, Push nach GO).

**Verbleibend für Physio-Launch Stufe 1 (Stand 21.11.2026):**
- **Push-GO:** Lokale Commits vom 21.11. (Verordnungsliste-Pagination + Doku-Abgleich) nach Melihs GO pushen.
- ~~**Optionales DB-GO:** Einmal-Skript `api-backend/db/physio-sitzungen-nachziehen.sql`~~ — **Erledigt 21.11.2026 (Melih-GO):** `api-backend/db/physio-sitzungen-nachziehen.sql` live auf SaaS (`njvuclullotbksskpwgk`) ausgeführt — offene, unabgerechnete Physio-Verordnungen ohne Sitzungsplan: 5 → 0. Reiner Daten-Nachlauf, keine Schema-Änderung.
- **Melih (Live-Abnahme):** Aktualisierte Checkliste `canli-test/2026-11-19-physio-launch-checkliste.md` (Blöcke A–D inkl. Live-Schreibtests Teil D & echte Smartphones iOS/Android).
- **Kemal:** Box `L1–L7` und 4 Partnerfragen (`#13`, `#14`, `#1`, `#22`) laut `Physio/LAUNCH-P1.md`.
- **Stufe 2 / extern:** AZE-Antwort auf `TSOL0101–0105` (Betreff `590537440`) abwarten; Entlassmanagement-Freigabe (`0112–0115`) + Tages-Zuzahlung (`#22`).

## Externe Mitwirkung

- Nutzer: sichere autorisierte QA-Mitarbeitersitzung, Bestätigung sicheren Passwortwechsels nach früherer Offenlegung; getrenntes KI-GO, wenn Kostenbegrenzung belegt.
- Kemal: Erinnerungsregel zum Buchungsalter vor Aktivierung bestätigen; Rechnungs-/Abrechnungs- und Sondertag-/Zeitfensterabnahmen.
- Praxis: eigener Wochenplan und fachlicher Gesamtdurchlauf. DATEV lokal, Steuerberater und Praxis getrennt führen.

## Bewusst zurückgestellt und Schutzgrenzen

Widget-Gesamtablauf, Box/Hetzner sowie Live-Speicherung von Fußzeile/Logo bleiben zurückgestellt. Mailversand gesperrt; keine zusätzlichen SaaS-Migrationen, Löschungen oder Kostenprovider ohne konkretes GO. Yannick/Janik nicht anmelden, testen oder verändern. Nur autorisierte synthetische QA-Daten; keine Secrets in Notiz oder Chat.

## Bereits erledigt / nicht erneut anfordern

Fünf Commits bis `d384c2b4` wurden auf ausdrücklichen Auftrag nach `origin/main` gepusht; Remote-SHA bestätigt. Beide Image-Builds für diesen SHA erfolgreich: Backend `42883517621`, Frontend `42883517335`. Dies beweist Image-Builds, keine funktionale Live-Abnahme. Spätere parallele Commits sind gesondert zuzuordnen.

Originale: `fortschritte/2026-11-10.md`, `fortschritte/2026-11-06_RELEASE_HANDOFF.md`, `onprem/MAILVERSAND-ABNAHME.md`, `wissensbank/sitzungen/2026-11-07_physio-fertigstellung.md`, `db/REGISTER.md`, `canli-test/REGISTER.md`.

Bei Speicherung war lokaler Branch bereits gegenüber origin divergiert. Deshalb vor nächster Umsetzung HEAD, Remote, aktive Bearbeiter und Reservierungen frisch prüfen; nicht automatisch rebasen oder fremde Änderungen stagen. Diese Notiz ist ausdrücklich kein aktueller Gesamtabschlussnachweis.
