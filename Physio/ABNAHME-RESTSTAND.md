# Planung: Abschlussaudit und verbleibende Abnahmen

Stand: 02.11.2026, nach QA-Nachweis `4bd18b23`. Kein pauschaler Abschluss des Gesamtziels.

| Anforderung | Nachweis | Status / nächster notwendiger Schritt |
|---|---|---|
| F2: fünf frische Widget-Ladungen in fremder HTTPS-Einbettung | QA `4bd18b23`: 5/5, Widget und Praxisroute HTTP200, Formular sichtbar, kein neuer CORS-Fehler, Cross-Origin-Zugriff des Hosts gesperrt | Ladeakzeptanz bestanden. Keine Dauer-/Cachegarantie; kein Submit oder Nachweis vollständiger Anfrageverarbeitung. |
| F8: schnelles Vor-/Zurückblättern der Woche | `012a5f36`, ergänzend `b8f2b715` | Lokal und live bestanden. |
| F10: Terminpanel beim Wechsel Team/Dashboard/Verordnungen schließen | `012a5f36` + `b8f2b715`, bestehende Regressionen | Alle drei Ziele live bestanden. |
| F9: Urlaubskarte ohne abgeschnittene Auswahl | `597670f8`: reale synthetische Vorlage, 12 Breiten-/Theme-Kombinationen ohne Überlauf | Lokal bestanden. Veröffentlichung benötigt ausdrückliches Push-/Deploy-GO; danach Live-Nachprüfung. |
| F11: Mitarbeiter sehen eigene Anstellung/Urlaub, nur lesend | `597670f8`: eigene ID-Filter, Fehler-/Leerzustände, Jahresgrenzen, veraltete Antworten; 28 gezielte Tests, 390/1280px hell/dunkel | Produktentscheidung umgesetzt, lokal bestanden. Veröffentlichung und Live-Mitarbeitersitzung noch offen. |
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

## Freigabegrenzen

Kein Push/Deploy bis ausdrückliche Antwort auf aktuelle Freigabeanfrage. Keine neuen Live-Migrationen, keine Löschung und keine Nutzung des Kundenkontos I6. QA-Chat besitzt `canli-test/REGISTER.md`; Unterstützungs-Chat besitzt AUTOPILOT und diese Matrix. F2 nicht parallel erneut ausführen.
