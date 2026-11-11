# Mailversand — Anforderungsabgleich und Abnahme

Stand: 10.11.2026. Grundlage: freigegebener Mailversand-Plan, ergänzt um STARTTLS/587-Fix. Implementierung, lokale Tests und reale Abnahme sind getrennte Nachweise.

| Planbereich | Aktueller Nachweis | Grenze |
|---|---|---|
| 0118, RLS/service_role, verschlüsselte Geheimspalten, CHECKs, Trigger | api-backend/db/migrations/0118_praxis_mailversand.sql; DB-Test 13 PASS | SaaS-Anwendung zuvor dokumentiert; hier keine erneute Live-DB-Prüfung |
| DSGVO Auskunft/Löschung | dsgvo/klassifikation.js, loeschen.js; expliziter Passwort-/Token-Maskierungstest klassifikation.test.js | Synthetische Tests |
| Ein Versandselektor, DB/Env/Legacy-SaaS | lib/mail.js; sechs Booking-Aufrufer, dokument-mail, sondertag, terminerinnerung, update-alarm, verbindungen | Booking-Verbindungsfehler melden Status, Logs nur Fehlercode; reale Zustellung auf Kundenbox fehlt |
| Einstellungen-API, Owner-Grenze, Passwortschutz, Testziel, Trennen | routes/mailversand.js und Tests; SMTP-Integrationstest mit lokalem STARTTLS-Server | Echte Anbieter-Testmail fehlt |
| Google aus Einstellungen | server.js gmail_mailversand → speichereGmailMailversand; Vault-Fehlerprüfung, Moduswahl, SMTP-Geheimnisse entfernen; getesteter DB-Quellenstatus | Korrektur dd0ac3c lokal committet; OAuth mit Google live nicht nachgetestet |
| Anbieter, Status, Formular, Banner, Mitarbeiter-Sichtbarkeit | tools/browser-probe/mailversand-probe.mjs: 46/46, 1024/390 px | Synthetische API-Antworten |
| Einrichten-Links | rechnung-mail, therapiebericht, sondertag-mitteilung, terminerinnerung-einstellung; compose-Mailto ergänzt | Anfrage-Fallback ergänzt; 1280/390 px: einmaliger Link, richtiges Sprungziel, kein Überlauf |
| Setup vier Schritte, kein /test-smtp | setup.html/setup.js, api-backend/setup/router.js; RELEASE-STANDARD §5.4 Kontrolle 9 | Setup-Probe 9/9 bestanden; synthetische API |
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

**Erledigt am 10.11.2026 (live, QA-Physio-Inhaber/-Mitarbeiter, Playwright + API, KEIN Mailversand, nur falsche Passwörter):** authentifizierter SaaS-Nachtest — Speichern/Status/Testmail/Trennen, Passwort nie in Antworten, DB nach Trennen ohne Passwort, Banner und Sprung zu den Einstellungen (1280/390 px), Mitarbeiter 403, ungültiger Port und IP-Literal 400, **Zwei-Worker-Sperre: 6 gleichzeitige Testmail-Anfragen → 1× durchgeführt, 5× 429** (`245fbe4d`). Dabei gefunden und behoben: Port 465 ist auf dem SaaS-VPS gesperrt → Vorlagen jetzt 587/STARTTLS (`9c66c29e`); Sprung zu Einstellungen blieb auf halbem Weg stehen (`0b0949ba`). Eintrag in `canli-test/REGISTER.md`.

**Box-nahe lokale Abnahme (11.11.2026, `tools/box-abnahme-mail/abnahme.mjs`, 30/30 bestanden, wiederholbar):** der echte `api-backend` im Box-Modus gegen eine echte Datenbank mit der Migrationskette 0000–0121 (echter `migrate.js`), GoTrue und PostgREST, Mailversand an einen lokalen STARTTLS-Empfänger. Belegt: Einrichten (falsches/richtiges Passwort), Passwort nur verschlüsselt, Testmail beim Empfänger, Drossel, Transparenzseite, Rechnung per Mail inkl. Modulrecht, Terminerinnerung ohne Doppelversand, Update-Alarm aus der Datenbank, Rangfolge Praxis-Postfach > `SMTP_*` der Installation. **Nicht belegt** (siehe README des Werkzeugs): echter Anbieter, echtes Zertifikat, echte Installation (`install.sh`, Caddy, Kong, Watchtower), Therapiebericht-/Fax-/Sondertag-Versand.

**Weiter offen:** echte Testmail über ein freigegebenes Postfach (Melih); echte Kundenbox: Installation und Update-Zyklus, echte Zertifikatsprüfung, Therapiebericht/Fax/Sondertag. QA-Token-Eingabe wurde abgelehnt und wird nicht umgangen. Diese Nachweise bleiben offen, bis freigegebene Zugänge bzw. erreichbare Testbox verfügbar sind. Kein vollständiger Abschluss behauptet.

## Lokaler Abschlusslauf

- `npm test`: Frontend 2738/2738; Backend 2040 bestanden, 4 übersprungen (2044 gesamt); Tools 355/355; Merkez 109/109. Kein Fehler. Protokoll `/tmp/mailversand-final-tests.log`.
- `npm run probe`: vollständige Befehlsfolge mit Exit 0, inklusive Setup 9/9 und Mailversand 46/46. Protokoll `/tmp/mailversand-full-probes-backlog256.log`. Lokaler statischer Testserver liefert ausschließlich synthetische `/api/config`-Werte. Erste Läufe hatten lokale Socket-Resets/Timeouts; mit Testserver-Warteschlange 256 komplett bestanden. Keine Kalender-Produktänderung dafür.
- Anfrage-Fallback: vorhandenes `mailEntwurfOeffnen` ergänzt vor der Anfragenliste einmaligen Einrichten-Link. Mailto bleibt unverändert. Browser 1280/390 px: ein Hinweis, korrektes Sprungziel, keine horizontale Überbreite; mobile Darstellung angesehen. Nach letzter Platzierungskorrektur 10 gezielte Node-Tests erneut bestanden.
- Sechs Booking-Versandstellen nutzen `meldeVerbindungsfehler`; Rohmeldungen der SMTP-Fehler werden dort nicht protokolliert. Zusätzlicher Test `api-backend/booking/message-mail.test.js` führt tatsächlichen Nachrichten-Handler mit synthetischem EAUTH aus: DB-Postfach wird unterbrochen, Env-Kanal nicht verändert, Fehlerantwort bleibt 500, keine Empfängeradresse im Log. 2/2 bestanden.

Kein authentifizierter SaaS-/Anbieter-/Kundenbox-Nachweis aus diesen lokalen Erfolgen abgeleitet. Neue Fixes lokal committet, noch nicht als live ausgegeben.
