# Phase 0–1: lokaler Zwischenstand

Stand 10.11.2026. Gesamtziel Phasen 0–9 **offen**. Phase 0 Sicherung/Quelleninventar geschrieben; vollständige Laufzeit-/Scope-Zuordnung noch offen. Phase 1 Designvertrag geschrieben; begrenzter integrierter CSS-Kandidat lokal gebaut und geprüft; Startkomposition mit aktuellem Lader lokal integriert; Shell, vollständige Datenbindungen und Nutzerbestätigung **offen**. Kein Phase-0/1-Gesamtabschluss.

## Geliefert

- SOURCE-MANIFEST.json: aktuelle Quellenpins, 44 privat gesicherte Design-WIP-Dateien, Hashes, explizite Ausschlüsse. Keine Original-WIP übernommen.
- TRANSFER.md/.json: 27 Hauptpanels, 349 statische Unteransichts-Kandidaten, 36 dynamische Renderer-Kandidaten, 42 fehlende aktuelle Module, 10 externe Appseiten. Kandidaten sind keine abgenommenen eigenständigen Screens.
- PRODUCT.md, DESIGN.md, TOKEN-EVIDENCE.md und DESIGN-PINS.json: bestätigte Produkt-/Designangaben mit konkreten Quellwerten.
- INTEGRATION.md, FILE-OWNERS.tsv und NEXT-PATCH.md: selektiver Integrationsvertrag und P01-REP für nächste repräsentative Lieferung.

## Grenzen

P01-REP-CSS-Zwischenkandidat umgesetzt (siehe P01-HANDOFF.md). Synthetische lokale Browserprobe ausgeführt. Kein Login-/Live-/DB-/Migrations-/Push-/Deploylauf. Demo 18086 nicht bedient. Keine neuen Produktfunktionen, keine neue Query, kein Provideraufruf. agy-context --local-only nutzte lokale Evidenz; keine gemessene Netto-Tokenersparnis behauptet.

Private Sicherung bewusst auf freigegebene Whitelist begrenzt. praxura-design.css im P01-Schritt zusätzlich privat gesichert (token_css_supplement im Manifest); ursprüngliche 44 WIP-Sicherungen bleiben erhalten. Originweiter Designumschalter bleibt Risiko für spätere Aktivierung, keine Reparatur in Phase01. Eltern-VM-Nachweise sind fremde Vorarbeit und keine Tests dieses Pakets.

## Nächster Schritt

Nach unabhängigem Review stabilen Start-Viewadapter und bestätigte Shell integrieren. Elternbeleg zu den fünf Inventarbindungen liegt unter Downloads/Praxura-Redesign-Inventarbindungen-2026-11-10.md. Vor neuer Funktion Pflichtberatung, vor UI-Edit craft-floor, danach lokale aktuelle Sicht-/Regressionsnachweise und unabhängiger Review. Größerer Ausbau erst nach repräsentativer Vorlage gemäß genehmigtem Plan.

Aktuelle Prüfungen und Review werden in VALIDATION.md getrennt festgehalten.

## P01-START

Bestätigte Startkomposition über stabilen Viewadapter lokal integriert und synthetisch geprüft; siehe P01-START-HANDOFF.md. Aktuelle Aufgaben-/KPI-/Gaps-/Kalenderknoten erhalten. Finanzdaten und vollständige Phase-1-Abnahme bleiben offen. Separater Eltern-Touchbeleg: evidence/calendar-targets/README.md.


## Stand 11.11.2026 (Integrator, Branch t3/praxura-redesign-phase-one, nichts gepusht)
| Phase | Stand |
|---|---|
| 0 Sicherung/Inventar | geschrieben (TRANSFER.md/.json, SOURCE-MANIFEST.json) |
| 1 Gestaltungsvertrag | lokal integriert (Tokens, Kalender, Start, Anamnese, Shell); Nutzerbestätigung der Bilder offen |
| 2 Grundpaket + Pilotbegrenzung | lokal gebaut und getestet: serverseitige Entscheidung (`/api/design/entscheidung`, Env-Pilot, Fail-closed), Head-Skript nur Wunsch, onprem O-245. Env nirgends gesetzt |
| 3–6 Ansichten | Styling übernommen (`design/seiten.css`, `design/verwaltung.css`); Smoke alle Panels Neu≈Alt; keine Einzelabnahme je Unterformular |
| 7 Rollen/Fachbereiche | Smoke Owner/Employee × Podologie/Physio/Ergo/Logo grün gegenüber Alt; Fachabnahme nicht eingeholt |
| 8 Login/Onboarding/Buchung | nicht begonnen: kein bestätigtes Design für öffentliche Seiten, Aktivierung dort braucht Produktentscheidung |
| 9 Integrationskandidat | `npm test` 2744+2041(+5 Skips)+355+109 grün, 0 fail; Shell/Anamnese/Kalender/Aktivierungsproben grün; A11y-Prüfung, Cache-/Update-Rollbackprobe auf echtem Auslieferungsweg und unabhängiger Gesamtreview offen |
| 10 Deploy/Live | nicht begonnen; braucht eigenes GO |
Offene Befunde: Pixelkante Neu→Alt ≥1025 px; Aktivierungsfälle A04–A07, A09, A12, A14–A17, A21–A22; keine Gerätetests.
