# Planung: Abschlussaudit und verbleibende Abnahmen

## Koordinierter Restabschluss 05.11.2026

Diese Ergänzung präzisiert die älteren Stände unten; historische Nachweise bleiben erhalten.

- **Aufteilung:** Planungs-Chat übernimmt F11 mit separater autorisierter QA-Mitarbeitersitzung und koordiniert restliche Standort-/Raumfälle mit canli-test. Unterstützungs-Chat besitzt Mail/KI und Matrix/AUTOPILOT. Keine parallelen Browser- oder QA-Datenänderungen; Reservierungen und Schreibpausen vor Zugriff abgleichen.
- **Urlaub:** Planungs-Chat meldet drei authentifizierte Live-Schreibwege mit korrektem UTC-Roundtrip und Reload-Nachweis (`0d1f4e4c`, `5b03a0c2`). Hier nicht wiederholt. Saldoänderung 6→3 wurde dort auf parallel geänderte Arbeitstage zurückgeführt; kein daraus belegter Cachefehler.
- **Mail-Ziel:** Fußzeile mit Logo/Kontaktdaten speichern, nach Neuladen auswählen und Vorschau sehen; aus synthetischer Anweisung echten KI-Mailentwurf erzeugen, Betreff/Text bearbeiten und kombinierten Text kopieren. Kein Versand/Gmail-Ersatzsetup, Janik/Yannik ausgeschlossen.
- **Voraussetzungen offen:** Live-Spalte `profiles.mail_signatur_einstellungen` und wirksame KI-Konfiguration samt Owner-Einwilligung. `api-backend/db/migrations/0105_mail_signaturen.sql` kennzeichnet sich lokal als nicht auf SaaS angewandt; kein Beweis des aktuellen Livezustands. Struktureller Connector-Read am 05.11. mit `MCP error -32600: You do not have permission to perform this action` gescheitert. Keine Migration ausgeführt.
- **KI-Gates laut Code:** `AI_ACTIVATION_READY=1`, `AI_MAIL_READY=1`, `AI_ALLOW_FREETEXT=1`, gültige Providerkonfiguration im Modus direkt/jeton sowie Owner-Freigabe. Gmail ist für Entwurfserzeugung nicht Voraussetzung. Gates nicht für Tests umgehen.
- **Abnahmefolge nach exklusiver QA-Übernahme:** synthetische Vorlage und Logo speichern → vollständig neu laden → Inhalt/Auswahl vergleichen → KI-Entwurf erzeugen → Betreff/Text ändern → „Text kopieren“ einschließlich Fußzeile prüfen. Versandknopf unbetätigt. Simulierte Tests ersetzen weder echte Speicherung noch Provideraufruf.
- **Hetzner/Box:** auf ausdrücklichen Nutzerwunsch später; keine Installation oder Serverauswahl hier.
- **Nutzerentscheidung im Anschluss:** echte Fußzeilen-Speicherprüfung ausdrücklich vorerst zurückgestellt. Keine erneute Zugriffsanforderung oder Migration dafür; Aufgabe bleibt offen, nicht bestanden.
- **Gezielter lokaler Nachtest:** `module/mail-signatur.test.js`, `module/ki-client.test.js`, `api-backend/lib/mail-signatur.test.js`, `module/ki-dashboard-contract.test.js` und `api-backend/ai/tasks.test.js`: zusammen 62 PASS, 0 FAIL/0 SKIP am Produktstand `2b52d4c7`. Keine Konten, DB-Zugriffe, Mails oder echten KI-Aufrufe. Neue Probe `node tools/browser-probe/mail-entwurf-bearbeiten-isoliert.mjs` prüft tatsächliche Compose-/Kopierhandler aus `dashboard.js` und echten Fußzeileneditor mit synthetischer KI-Antwort: nachträglich geänderter Betreff/Text und ausgewählte Fußzeile korrekt kopiert; drei Mutationen (alter Text, alter Betreff, fehlende Fußzeile) werden abgelehnt. Kein Nachweis echter Speicherung oder Provideranbindung.

Stand: 03.11.2026, nach freigegebenem Push und Frontend-Veröffentlichungsprüfung bis `8d8f7c0a`. Kein pauschaler Abschluss des Gesamtziels.

| Anforderung | Nachweis | Status / nächster notwendiger Schritt |
|---|---|---|
| Raumdetails und automatische passende Raumzuordnung | Release-Übergabe: `a95d8339`, `c7a4a56d`, `6f462002` auf origin/main; 0103/0104 live, echter Schemaexport vorhanden. Backend-Build grün, /health 200, Vercel laut zuständigem Chat geprüft. Hier nicht erneut live getestet. | Veröffentlicht; funktionale QA-Abnahme separat offen. Migrationen nicht wiederholen. Öffentliche Slotliste ohne Raum-Vorabprüfung, Buchung prüft frisch (409 möglich). |
| F2: fünf frische Widget-Ladungen in fremder HTTPS-Einbettung | Technische Probe `4bd18b23`: 5/5, Widget und Praxisroute HTTP200, Formular sichtbar, kein neuer CORS-Fehler, Cross-Origin-Zugriff des Hosts gesperrt. Verwendeter DOM-Slug praxura-de nicht als ursprünglicher QA-Mandant bestätigt. | Technische Ladeprobe bestanden; QA-Abnahme offen bis eindeutige Mandantenzuordnung. Historischer QA-Slug test-podologie-qa darf nicht mit praxura-de gleichgesetzt werden. Keine weiteren Tests am unbestätigten Mandanten, kein Submit. Keine Dauer-/Cachegarantie oder vollständige Anfrageverarbeitung. |
| F8: schnelles Vor-/Zurückblättern der Woche | `012a5f36`, ergänzend `b8f2b715` | Lokal und live bestanden. |
| F10: Terminpanel beim Wechsel Team/Dashboard/Verordnungen schließen | `012a5f36` + `b8f2b715`, bestehende Regressionen | Alle drei Ziele live bestanden. |
| F9: Urlaubskarte ohne abgeschnittene Auswahl | `597670f8`: reale synthetische Vorlage, 12 Breiten-/Theme-Kombinationen ohne Überlauf | Lokal bestanden, veröffentlicht; Live-Dateien bytegleich geprüft. Funktionale Live-Abnahme benötigt bestätigte QA-Inhabersitzung. |
| F11: Mitarbeiter sehen eigene Anstellung/Urlaub, nur lesend | `597670f8`: eigene ID-Filter, Fehler-/Leerzustände, Jahresgrenzen, veraltete Antworten; 28 gezielte Tests, 390/1280px hell/dunkel | Produktentscheidung umgesetzt, lokal bestanden, veröffentlicht; Live-Dateien bytegleich geprüft. Funktionale Live-Abnahme benötigt zugehörige autorisierte QA-Mitarbeitersitzung. |
| Standortplanung live (S5/S6) | Vorhandene lokale Plan-/Browser-/Backendtests und Box-Vorprüfung | Separates QA-Konto vom Nutzer freigegeben; Release-Chat bestätigt reine QA-Praxis mit zwei Standorten. Autorisierte Inhaber-/Mitarbeitersitzung dort koordiniert. Danach Wochenmuster/Einzeltag/Standortfilter live prüfen. |
| Standorte in installierter Box (M3) | `tools/box-standort-abnahme.test.js`: tatsächlicher Speicherpfad/Planmodule, acht Fälle, zwei synthetische Standorte im Speicher | Lokale Vorprüfung bestanden. Kein Ersatz für installierte Box, PostgreSQL-RLS, Browser-Switcher, Neustart/Persistenz. Isolierte installierte Box erforderlich; Ablauf in `tools/box-standort-abnahme.md`. |
| S8/S9: Sondertag-Mail | HTTP-/Transport-/UI-Regressionen; Maildialog ohne Versandweg live in `012a5f36` | Ohne Versandweg bestanden. Echter Mailtest ausdrücklich zurückgestellt; weder Gmail verbinden noch Mail/Ersatzsetup ohne erneute Aufnahme. |
| F12: atomare Tagesgrenze | `8d7badfb`, Live-Anwendung/ACL/Schemaexport `f6bc1277`; aktueller echter PostgreSQL-Lauf 10/10 | Lokaler Paralleltest und dokumentierte Live-Anwendung vorhanden. Kein echter Versandnachweis. |

## Aktuelle Gesamtprüfung

`npm test` im unveränderten Produktstand nach `597670f8`: Frontend 2558 PASS, Backend 1823 PASS/2 SKIP, Tools 336 PASS, Merkez 109 PASS. Insgesamt 4826 bestanden, null Fehler.

- Opt-in PostgreSQL-Test separat explizit ausgeführt: `PRAXURA_QUOTA_PG_TEST=1 node --test api-backend/db/termin-mitteilungen-quota.integration.test.js` → 10/10 PASS, kein Skip. Dieser Lauf prüft 0101/0102 mit synthetischen Abhängigkeiten; kein neuer Vollkettennachweis.
- Zweiter Standard-Skip: Vergleich mit offizieller DATEV-Musterdatei, die im Checkout fehlt (gitignored). Kein bestandener Referenzvergleich behauptet.
- Dashboard-Bundle mit esbuild erfolgreich. Keine erneute Suite ohne Codeänderung oder neuen Befund erforderlich.
- Funktionskarte frisch geprüft: 4285 Funktionen / 528 Dateien.

## Veröffentlichung 03.11.2026

Melih hat Push und Frontend-Veröffentlichung ausdrücklich freigegeben. Neun lokale Commits nach `f6bc1277` bis einschließlich `8d8f7c0ad7085911d2ff0e2d30ff02c33767c4ac` nach `origin/main` gepusht. GitHub Actions `41560406839` (Frontend-Image) erfolgreich; beide GitHub-Vercel-Statuskontexte `infinitymade-website` und `infinitymade-website-q9nm` erfolgreich. Vercel-Plug-in selbst wegen Team-Zugriffsfehler 403 nicht als Nachweis verwendet.

Öffentliche Dateien auf `https://app.praxura.de` in eigenem Vorschau-Tab ohne Zugangsdaten (`credentials: omit`, `cache: no-store`) gelesen, jeweils HTTP200 und SHA-256 identisch zum veröffentlichten lokalen Stand:

| Datei | SHA-256 |
|---|---|
| `/dashboard.html` | `fc323d8e6279125a126c0f656851ecadc803a017452096bd1d16c3027987731d` |
| `/dashboard.js` | `f8d194825aad981d741ddc3eb85eee42aed02c935dfc0e4dbc486ba763ea640a` |
| `/dashboard.css` | `15e969b9694d570946164bc5bb57f07d76a0db06a76276aa2593f63ca48ebabe` |
| `/module/mein-urlaub.js` | `db2c9625d6c1429c883defa6d0397e67ec9873ad2cc1360937a285eaaf732220` |
| `/module/planung-bruecke.js` | `76823d718875d68668a35373cc42cba1a057e17d24fa149204d33e0cce1e3b79` |

Dies bestätigt öffentliche Auslieferung, keine funktionale F9/F11-Abnahme im QA-Konto und keine Installation auf einer Kundenbox. Keine Suite ohne Codeänderung wiederholt.

## Freigabegrenzen

Freigegebener Push/Frontend-Release bis `8d8f7c0a` ausgeführt. Keine neuen Live-Migrationen, keine Löschung und keine Nutzung des Kundenkontos I6. Historischer QA-Slug `test-podologie-qa` und UUID-Präfix `c4fbded4` reichen nicht zur Bestätigung einer aktuellen Sitzung; `praxura-de` bleibt unbestätigt. QA-Chat besitzt `canli-test/REGISTER.md`; Unterstützungs-Chat besitzt AUTOPILOT und diese Matrix. F2 nicht parallel erneut ausführen. Mail bleibt ausdrücklich gestoppt.

## Neue lokale Planungskorrekturen 03.11.2026

M4: Standortfilter Tag/Woche/Monat einschließlich NULL-Altbestand, Einzelmitarbeiter und verifiziert leerer Pläne; alte Monatsantworten verworfen. M5: Jahresbegrenzung und Deduplizierung beider Urlaubsansichten, Fehlersaldo gesperrt, vorhandene Abwesenheiten trotzdem sichtbar/löschbar. M7 folgt Support-Entscheidung `17a966c2`. Noch keine neue Live-Abnahme; isolierte Box zuletzt. Separates QA-Konto ist freigegeben und laut Release-Chat zugeordnet; Mitarbeiterzugang wird dort koordiniert.

## Vertiefte lokale Nachprüfung 03.11.2026

- Tatsächliche Tagesansicht mit verzögerten Buchungs-, Einsatzplan- und Abwesenheitsantworten geprüft. Sieben Regressionen zuerst rot: alter Tag überschreibt neuen, alter Lauf füllt neues leeres Team, geänderter Standort/Filter/Ansicht bleibt unbeachtet. Startgeneration und Kontextprüfung verhindern jetzt veraltete DOM-Updates. Nach Fix sieben grün. Keine Aussage über neue Live-Abnahme.
- „Mein Urlaub“ verwendete abweichende Arbeitszeitprüfung: ungültige aktive Wochentage ergaben einen vollen Saldo. Drei synthetische Randfälle zuerst rot; gemeinsamer `ladeArbeitstage`-Loader behebt sie, ohne zusätzliche Query.
- Unabhängige Tageszählung prüft Jahreswechsel, Schaltjahr und sieben Schichtmuster über drei Jahre (21 Vergleiche). Frontend insgesamt2659/2659, null Fehler/Skips; Dashboard-Bundle grün.

Echte isolierte Browserprobe `node tools/browser-probe/kalender-tag-antwort.mjs`:22/22 PASS bei390/1280px; tatsächlicher Tagesrenderer und persönlicher Urlaubsbaustein, alle Netzwerkanfragen abgefangen. Keine Konten, Live-DB oder Mails.
