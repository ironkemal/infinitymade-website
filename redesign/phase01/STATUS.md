# Phase 0–1: lokaler Zwischenstand

Stand 10.11.2026. Gesamtziel Phasen 0–9 **offen**. Phase 0 Sicherung/Quelleninventar geschrieben; vollständige Laufzeit-/Scope-Zuordnung noch offen. Phase 1 Designvertrag geschrieben; begrenzter integrierter CSS-Kandidat lokal gebaut und geprüft; exakte Shell-/Startkomposition sowie Nutzerbestätigung **offen**. Kein Phase-0/1-Gesamtabschluss.

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
