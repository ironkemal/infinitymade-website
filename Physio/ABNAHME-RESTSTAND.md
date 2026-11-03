# Planung: Abschlussaudit und verbleibende Abnahmen

Stand: 03.11.2026, nach freigegebenem Push und Frontend-Veröffentlichungsprüfung bis `8d8f7c0a`. Kein pauschaler Abschluss des Gesamtziels.

| Anforderung | Nachweis | Status / nächster notwendiger Schritt |
|---|---|---|
| Raumdetails und automatische passende Raumzuordnung | Abschlussübergabe `a95d8339`, zuständiger Chat: Ausstattung je Leistung; Beschreibung/Checkliste, beide Leistungseditoren, manuelle Vorschläge/Snapshot, lokale 0103/0104 mit Standort-/Mandanten-/Kapazitätsprüfung und öffentliches `room_name`. Gemeldet: 4865 PASS/4 SKIP, echte PG 29/29, Browser 43/43, frische Kette 0000–0104/105 SHA/Repeat 0/Zähler ok, Bezeichnerprüfung 254 Dateien und Build bestanden. Hier nicht erneut geprüft. | Nur lokal gebaut/getestet, keine Live-Abnahme. Neues Veröffentlichungs-GO sowie Migration/Schemaexport ausstehend. Öffentliche Slotliste ohne Raum-Vorabprüfung; Buchung prüft frisch (409 möglich). Dokumentierte lokale Gate-Ausnahmen `SKIP_SAAS_ZEILE_GATE`/`SKIP_SPALTEN_GATE`; Live-Dumps unverändert. Kein Push/Deploy/Live-DB/Mail. |
| F2: fünf frische Widget-Ladungen in fremder HTTPS-Einbettung | Technische Probe `4bd18b23`: 5/5, Widget und Praxisroute HTTP200, Formular sichtbar, kein neuer CORS-Fehler, Cross-Origin-Zugriff des Hosts gesperrt. Verwendeter DOM-Slug praxura-de nicht als ursprünglicher QA-Mandant bestätigt. | Technische Ladeprobe bestanden; QA-Abnahme offen bis eindeutige Mandantenzuordnung. Historischer QA-Slug test-podologie-qa darf nicht mit praxura-de gleichgesetzt werden. Keine weiteren Tests am unbestätigten Mandanten, kein Submit. Keine Dauer-/Cachegarantie oder vollständige Anfrageverarbeitung. |
| F8: schnelles Vor-/Zurückblättern der Woche | `012a5f36`, ergänzend `b8f2b715` | Lokal und live bestanden. |
| F10: Terminpanel beim Wechsel Team/Dashboard/Verordnungen schließen | `012a5f36` + `b8f2b715`, bestehende Regressionen | Alle drei Ziele live bestanden. |
| F9: Urlaubskarte ohne abgeschnittene Auswahl | `597670f8`: reale synthetische Vorlage, 12 Breiten-/Theme-Kombinationen ohne Überlauf | Lokal bestanden, veröffentlicht; Live-Dateien bytegleich geprüft. Funktionale Live-Abnahme benötigt bestätigte QA-Inhabersitzung. |
| F11: Mitarbeiter sehen eigene Anstellung/Urlaub, nur lesend | `597670f8`: eigene ID-Filter, Fehler-/Leerzustände, Jahresgrenzen, veraltete Antworten; 28 gezielte Tests, 390/1280px hell/dunkel | Produktentscheidung umgesetzt, lokal bestanden, veröffentlicht; Live-Dateien bytegleich geprüft. Funktionale Live-Abnahme benötigt zugehörige autorisierte QA-Mitarbeitersitzung. |
| Standortplanung live (S5/S6) | Vorhandene lokale Plan-/Browser-/Backendtests und Box-Vorprüfung | QA-Tarif mit Mehrstandortrecht und zwei synthetische Standorte laut Nutzer nicht vorbereitet. Keine Tarifänderung beauftragt. Danach Wochenmuster/Einzeltag/Standortfilter mit Testteam live prüfen. |
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
