# Enger Nachweis: Urlaubsdatum speichern und wieder lesen

Stand: 04.11.2026. Lokal geprüft; keine Live-Abnahme.

## Ausgangsmaterial und Erwartung

Drei tatsächliche INSERT-Objekte in dashboard.js (Kalender-Abwesenheit, Teamliste, Mitarbeiterdetail); time_offs.start_date/end_date laut db/SCHEMA.sql sind timestamptz. Bestehender Kalendervertrag in module/abwesenheit.js und Saldo in module/anstellung.js verwenden UTC-Kalendertage. Erwartung: Ein gewählter 01.01. bleibt nach Speicherung derselbe Tag, unabhängig von PostgreSQL-Sessionzeitzone.

## Reproduktion und Fix

`PRAXURA_URLAUB_DATUM_PG_TEST=1 node --test api-backend/db/urlaub-datum.integration.test.js`

Test wertet die drei echten INSERT-Objekte aus dem aktuellen Dashboard in VM aus. Payloads werden durch isoliertes PostgreSQL17.11 mit gleichem timestamptz-Datentyp geschrieben. JSON-Rückgabe wird in UTC gelesen und an tatsächliche Saldo-/Kalenderfunktionen übergeben. Keine bestehenden Container oder Datenbanken verwendet; eigener Container ohne Netzwerk/Ports/Volumes, danach entfernt.

Vor Fix: alle drei Europe/Berlin-Fälle rot, 01.01.2026 kam als 31.12.2025 UTC zurück. UTC-Fälle grün. Ursache: nacktes Datum wird in Sessionzeitzone als Mitternacht interpretiert. Bisheriger Kommentar behauptete fälschlich garantierte UTC-Speicherung.

Fix: drei bestehende Writer senden explizites T00:00:00Z. Kein neues Format für Altbestand, keine Datenkorrektur oder Schemaänderung. Dashboard-Cacheversion erhöht.

## Nachweis

- PostgreSQL-Lauf 7/7 PASS, kein Skip: drei Writer × zwei Sessionzeitzonen. Pro Kombination vier einzelne Werktage (Jahresanfang/-ende, Sommer-/Winterzeitwechsel) und ein mehrtägiger Teilzeiturlaub über Jahreswechsel. Insgesamt30 DB-Roundtrips; Teilzeit Mo/Di zählt 2025 zwei Tage, 2026 einen Tag.
- Gewähltes Datum bleibt erhalten; tatsächlicher Saldo zählt einen Tag; Kalender trifft gewählten Tag und nicht Vortag.
- 55 gezielte Modul-/Anschluss-/Modulgraphtests PASS, Dashboard-esbuild PASS.
- Unabhängiger qa-code-review prüfte Sourceextraktion, Erwartungswerte und Ansatz. Empfohlener Teilzeit-Jahresüberhang ergänzt.

## Grenzen

Kein Browser-Speicherhandler, kein PostgREST-Transport und keine RLS-Policies in dieser isolierten Tabelle geprüft. Kein Nachweis der aktuellen Live-Sessionzeitzone und keine Behauptung, produktive Datensätze seien bereits verschoben. Bestehende Offset-Altbestände werden nicht umgedeutet. Live-QA bleibt beim zuständigen Chat; Yanniks Konto ausgeschlossen, Mail STOP.

DB-Berater lieferte strukturelle Quellenbelege, brach anschließend wegen Provider-Nutzungslimit ab. Keine vollständige unabhängige DB-Abnahme behauptet. Funktionsberater und unabhängiger Code-Reviewer lieferten vollständige Beratung.
