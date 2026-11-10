# Mailversand — Anforderungsabgleich und Abnahme

Stand: 10.11.2026. Grundlage: freigegebener Mailversand-Plan, ergänzt um STARTTLS/587-Fix. Implementierung, lokale Tests und reale Abnahme sind getrennte Nachweise.

| Planbereich | Aktueller Nachweis | Grenze |
|---|---|---|
| 0118, RLS/service_role, verschlüsselte Geheimspalten, CHECKs, Trigger | api-backend/db/migrations/0118_praxis_mailversand.sql; DB-Test 13 PASS | SaaS-Anwendung zuvor dokumentiert; hier keine erneute Live-DB-Prüfung |
| DSGVO Auskunft/Löschung | dsgvo/klassifikation.js, loeschen.js; expliziter Passwort-/Token-Maskierungstest klassifikation.test.js | Synthetische Tests |
| Ein Versandselektor, DB/Env/Legacy-SaaS | lib/mail.js; sechs Booking-Aufrufer, dokument-mail, sondertag, terminerinnerung, update-alarm, verbindungen | Reale Zustellung aller Mailtypen auf Kundenbox fehlt |
| Einstellungen-API, Owner-Grenze, Passwortschutz, Testziel, Trennen | routes/mailversand.js und Tests; SMTP-Integrationstest mit lokalem STARTTLS-Server | Echte Anbieter-Testmail fehlt |
| Google aus Einstellungen | server.js gmail_mailversand → speichereGmailMailversand; Vault-Fehlerprüfung, Moduswahl, SMTP-Geheimnisse entfernen; getesteter DB-Quellenstatus | Korrektur dd0ac3c lokal committet; OAuth mit Google live nicht nachgetestet |
| Anbieter, Status, Formular, Banner, Mitarbeiter-Sichtbarkeit | tools/browser-probe/mailversand-probe.mjs: 46/46, 1024/390 px | Synthetische API-Antworten |
| Einrichten-Links | rechnung-mail, therapiebericht, sondertag-mitteilung, terminerinnerung-einstellung; compose-Mailto ergänzt | Anfrage-Toasts nennen Einstellungen; vollständige klickbare Anfrage-Fallback-Prüfung noch offen |
| Setup vier Schritte, kein /test-smtp | setup.html/setup.js, api-backend/setup/router.js; RELEASE-STANDARD §5.4 Kontrolle 9 | Vollständiger aktueller Setup-Browserlauf noch offen |
| Register und Funktionskarte | db/REGISTER.md, onprem/REGISTER.md O-244, funktionen/INDEX.*, fortschritte/ | Karte wird vom Commit-Hook aktualisiert |
| SMTP_ nur zentral | Produktionsquellen: process.env.SMTP_ nur lib/mail.js | Tests setzen zusätzlich synthetische Umgebungswerte |
| Microsoft-Gerätecode | Ausdrücklich Phase 2 | Kein fehlendes v1-Deliverable |

## Erneuerter DB-Nachweis

10.11.: vorhandener lokaler Läufer tools/db-vollkette/vollkette-box.sh mit TESTS_B=0118_praxis_mailversand.test.sql; keine Änderung am fremden/unversionierten Läufer. Isolierte temporäre Container mit lokal vorhandenen Supabase PostgreSQL 17.6.1.136 / Storage 1.74.0, kein externer Datenbankzugriff.

- Erster Migrationslauf: 120 angewandt, letzte 0119; zweiter Lauf: 0 angewandt.
- Ledger-Prüfsummen entsprechen allen 120 Originaldateien.
- schema-zaehler: keine Abweichungen; public_tablo 100, rls_policy 188, fonksiyon 143, trigger 176, index 358.
- Test 0118: Exit 0, 13 PASS, 0 FAIL/ERROR.
- Grenzen: keine GoTrue-Anmeldung, kein vollständiger Kundenstack, keine reale Box und kein Mailanbieter.
- Rohprotokolle dieser Messung: temporärer Ordner /var/folders/63/7kx2wp_j22g5p98c7kmnqz_40000gn/T/tmp.sZESC0PCbb (lokal, nicht Teil des Repos).

## Compose-Fallback

Vorhandenen einrichtenLink-Baustein neben Mail vorbereiten wiederverwendet. Link schließt zuerst Compose-Modal, bevor Einstellungen geöffnet werden; wiederholte Initialisierung erzeugt keinen zweiten Knopf. Browserprüfung bei 1280/390 px: genau ein Mailto-Knopf, richtiges Sprungziel, Modal geschlossen, kein horizontaler Überlauf. Impeccable-Detektor: keine Befunde.

## Noch erforderliche externe Nachweise

Authentifizierter SaaS-Nachtest inklusive Zwei-Worker-Sperre; echte Testmail über freigegebenes Postfach; reale Kundenbox: Testmail, Erinnerung, Rechnung, Dokument, Update-Alarm, Transparenzseite. QA-Token-Eingabe wurde abgelehnt und wird nicht umgangen. Diese Nachweise bleiben offen, bis freigegebene Zugänge bzw. erreichbare Testbox verfügbar sind. Kein vollständiger Abschluss behauptet.
