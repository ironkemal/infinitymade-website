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
