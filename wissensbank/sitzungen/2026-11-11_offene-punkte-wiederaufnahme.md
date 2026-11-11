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
