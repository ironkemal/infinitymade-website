# Integrations- und Eigentümervertrag

## Basis und Grenzen

Arbeitsbranch t3/praxura-redesign-phase-one, vorbereitetes Worktree. Funktionsbasis 94eaf6357d099ab36237dc6eb5d328317a654a7a (frisch gegenüber dem älteren Plan-Pin). Kein Merge kompletter Design-Dashboards. Originalcheckouts und Demo 18086 bleiben unverändert. Original-main enthält fremde db/NUTZUNG-WIP und untracked Outputs/Werkzeuge: ausgeschlossen.

Snapshot: SOURCE-MANIFEST.json; private Dateien unter dortigem private_path, Verzeichnis 0700, Dateien 0600. Nur sichere Quellcode-Whitelist, keine Daten/Logs/Binärdateien/env. Main: keine WIP-Datei innerhalb Whitelist. Design: 44 Dateien gesichert. Patches beziehen sich auf jeweiliges HEAD und liegen ausschließlich privat. Ausgeschlossene Dateien bleiben im Original. Insbesondere praxura-design.css liegt außerhalb expliziter Snapshot-Whitelist: nur aktueller Hash in DESIGN-PINS.json, keine Sicherungskopie; dessen WIP-Reproduzierbarkeit deshalb vor Transfer separat klären. Keine WIP-Bytes ins Produkt übernommen.

## Besitz

Integrator besitzt ausschließlich in diesem Worktree dashboard.html/.js/.css, dashboard-feinschliff.css, praxura-design.css, nav-registry.js, gemeinsame Shell-/Cache-/Importkette, Funktionskarte, STATUS, PRODUCT und DESIGN. Kein anderer Worker darf diese Dateien ändern. FILE-OWNERS.tsv führt alle aktuellen module/- und relevanten Designdateien einzeln; dortige Integrator-Reservierung bedeutet keine Besitzübernahme fremder Original-WIP.

Bestehende Originalreservierungen: V803 benennt design/formulare.css plus Übergabe; V804 design/verwaltung.css plus Übergabe. STATUS im Designcheckout enthält spätere zentrale V804e-Integration (Quelle 89074c1e), während Übergabe-Einstieg ältere Teilstände beschreibt. Beides historische Lieferreservierungen; keine aktuelle ACK-Freigabe für fremde Originaldateien daraus ableiten. Kein neues paralleles Baupaket vergeben. Worktree-Liste frisch gelesen; prunable Einträge nicht gelöscht.

## Lieferabgleich

- V803: 29.10. lokal geliefert; frühere Baustopptexte überholt. Wrapper/Abschnittsnavigation gemeinsam mit CSS prüfen, nicht erneut bauen.
- V804: Gruppen Team/Ärzte/Fahrtenbuch, Notizen/Feedback/Demo, B2B/B2C und spätere statistik/ueberblick/podologie-billing/abrechnung laut STATUS:329 berücksichtigen. Vor Transfer tatsächliche Selektoren und Hashes vergleichen.
- V9/V10: historisch, kein neuer grüner Test.
- 42 aktuelle Moduldateien: TRANSFER.json enthält jede Datei mit Kartenfunktionen und Zielkandidaten. Aktuelle Dateien bleiben vollständig erhalten.

## Reihenfolge

1. Offene Aufrufer-/Unteransichtsbindungen in TRANSFER.json auflösen und statische Kandidaten deduplizieren. Fehlende aktuelle Rechteprofile pro Ansicht ergänzen. Keine Vollständigkeitsabnahme aus Kandidatenzahl.
2. Folgepatch P01-REP laut NEXT-PATCH.md: enges isoliertes Darstellungsgrundpaket, Start/Kalender/Formular/Mobil; kein Aktivierungsbau.
3. Eigenständiger Review und aktuelle synthetische Messung. Repräsentative integrierte Ansichten vor größerem Ausbau vorlegen.
4. Phasen 2–9 bleiben separates lokales Gesamtziel. Deploy/Pilot/Push benötigen eigenes GO.

Keine Queries, Tabellen oder Backendänderungen in diesem Paket. fonksiyon-ustasi vor neuer Funktion, danach Zweck/Einsatz melden; db-ustasi erst vor Datenannahme/Query. mobil-ui für nächste tatsächliche Responsiveprüfung, qa-code-review für fertigen Kandidaten.
