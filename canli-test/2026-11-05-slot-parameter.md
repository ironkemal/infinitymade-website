# Öffentliche Slot-Parameter — lokale Fehlerkorrektur, 05.11.2026

Status: geschrieben, lokal getestet und unabhängig geprüft. Nicht veröffentlicht, nicht live abgenommen.

## Befund und Korrektur

`api-backend/server.js` übergab negative Schrittweiten an `getAvailableSlots`. Dessen Schleife erhöht die laufende Minute um `step`; ein negativer Wert kann die Schleife unbegrenzt weiterlaufen lassen. `parseInt(...) || Standardwert` verdeckte zusätzlich Nullwerte und teilweise ungültige Eingaben.

Vor Korrektur: gezielte Route-Regression mit 9 fehlgeschlagenen und 2 bestandenen Tests. Ungültige Eingaben erreichten die simulierte Slot-Engine. Eine tatsächlich hängende Serverinstanz wurde nicht erzeugt; die Schleifenfolge ergibt sich aus dem Quellcode.

Neue gemeinsame Prüfung `api-backend/booking/slot-parameter.js` verwendet vorhandenes `isStrictInteger`: Dauer und Schritt 1–1440 Minuten, Puffer 0–1440. Numerische Minutenstrings bleiben erlaubt. Null als Schritt, negative Werte, Dezimalzahlen, nicht endliche Zahlen, falsche Typen und beschädigte Strings werden abgewiesen. Fehlender Puffer bleibt 0, fehlender Schritt 15.

Öffentliche Slot-Abfrage und Buchungserstellung antworten bei ungültigen Parametern mit HTTP 400. Die interne Slot-Engine prüft ebenfalls vor Kalender-/Datenzugriff und liefert `invalid_slot_params`. Gültige Slots, Raster und Puffer sind durch die tatsächliche extrahierte Slot-Engine mit simulierten Datenzugriffen abgedeckt.

## Nachweise

- `node --test api-backend/booking/slot-parameter.test.js api-backend/booking/public-handlers.test.js api-backend/booking/from-request.test.js api-backend/booking/series.test.js`: **60 bestanden, 0 fehlgeschlagen**; unabhängig durch Review-Agent wiederholt.
- `npm run test:backend`: **1868 Tests, 1863 bestanden, 5 übersprungen, 0 fehlgeschlagen**. Übersprungene Tests zählen nicht als Abnahme; darunter PostgreSQL-Integrationen für Räume, Tagesdeckel und Urlaub.
- `node --check api-backend/server.js`: bestanden.
- `node tools/funktionskarte.mjs --check`: frisch, 4370 Funktionen / 538 Dateien.
- Unabhängiges fokussiertes Code-Review: keine blockierenden Befunde. Funktionsberater vor Änderung konsultiert und anschließend über Zweck/Einsatz informiert.

## Grenzen und verbleibende Arbeit

Keine echte DB, keine Mail, keine Browser-Schreibtests, keine Migration, kein Push oder Deploy. QA-Schreibpause, Mail-STOP und Janik-Testverbot bleiben bestehen. Standort-, Raum-, Sondertag- und Widget-Live-Restfälle bleiben offen; F11-Mitarbeiterabnahme gehört Chat1. Diese Korrektur schließt ausschließlich die Slot-Parameter-Lücke.
