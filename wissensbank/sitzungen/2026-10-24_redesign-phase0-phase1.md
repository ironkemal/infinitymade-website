---
titel: Praxura-Redesign — Phase 0 fertig, Phase 1 (Schalter + Token) begonnen
typ: sitzung
angelegt: 2026-10-24
tags: [sitzung, redesign, design, worktree, onprem, werkzeuge]
---

# Praxura-Redesign: Stand 24.10.2026

**Arbeitsort:** Worktree `~/.t3/worktrees/infinitymade-website/redesign-praxura-design`, Branch `redesign/praxura-design` (Melihs Wunsch, geht der Regel „direkt auf main“ vor). Basis `origin/main` `6fd0cce3`. Historischer Startstand; aktuelle Fortsetzung siehe unten.
**Quelle der Wahrheit:** `redesign/STATUS.md` (Plan, Fehlerbuch R-01–R-08, Entscheidungen E-01–E-05). Auftrag: `redesign/AUFTRAG.md`.

## Erledigt (lokal getestet, nicht live)
- **Phase 0 komplett**, Commit `7c92add1`: Ausgangslage `npm test` 4.064 grün, `npm run probe` grün. ID-/Klassen-Wache (1.271 IDs, 52 JS-Klassen). Harness ohne Login mit synthetischer Praxis (`tools/redesign-harness.mjs`, `tools/browser-probe/redesign-fixture.js`), Bilder + Pixel-Diff (`tools/redesign-shots.mjs`), Smoke (`tools/redesign-smoke.mjs`). Vorher-Läufe in `.redesign-shots/vorher/` (gitignored, auf neuer Maschine neu erzeugen).
- **O-219**, Commit `2a683d24`: `dashboard-feinschliff.css` fehlte im Kutu-Frontend-Image (COPY-Liste + `paths:`); Smoke-Test prüft jetzt auch `/dashboard.html` und `/attendance.html`. Eigenständig nach `main` übernehmbar. CI nicht gelaufen.
- **Phase 1.1/1.2 geschrieben, noch NICHT committet:** Schalter im `<head>` von `dashboard.html` (`?design=neu` / `?design=alt`, `localStorage px-design`), neue `praxura-design.css` (Token hell + dunkel, inkl. der 12 bisher undefinierten Variablen), `<link>` mit `?v=20261023rd1`, Eintrag in `onprem/frontend.Dockerfile` + `publish-frontend.yml`, Kontrast-Test `tools/redesign-kontrast.test.js` (7/7 grün).
- Gemessen: Ohne Schalter 0 Pixel Abweichung gegenüber „vorher“ (159 Bilder, 2 Subpixel-Rauschen-Warnungen). Mit Schalter Übersicht sichtbar grau/weiß/Creme.

## Offen / nächster Schritt
1. T1/T2 laufen lassen (`node tools/check-redesign-ids.mjs`, `sh tools/check-syntax.sh`, `sh tools/check-dashboard-size.sh`, `npm test`), dann **Phase 1.1–1.4 committen**.
2. 1.5: Neu-Bilder aller Panels (hell/dunkel, 1440/390) ansehen, Ausreißer beheben (Glas-Hintergründe, warme rgba-Töne, feste Hex-Farben → Phase 2).
3. 1.6: Phasenende; Push **nur Branch**; T6 live erst nach Antwort auf F-01 (Branch ist live nicht sichtbar).
4. Danach Phase 2 (Hex → `var(--x, alt)`), 3 (Bausteine), 4 (Übersicht, vorher podoloji + /konsey + guvenlik wegen R-06), 5 (Kalender), 6 (alle 27 Bereiche), 7, 8 (nur nach Melihs OK).

## Offene Fragen an Melih
F-01 T6/Live-Test vor Merge · F-02 `.env.local` nur nötig für echten Login · F-03 R-06 Rollenprüfung Statistik (vor Phase 4). O-219 nach `main` cherry-picken?

## Fallen
- Fester Harness-Port 18081, nur ein Lauf gleichzeitig. Fixture ändern ⇒ „vorher“ neu vergleichen.
- Pre-commit: Secret-Scan (Fixture-Token trägt `// secret-scan: ignore`), Dashboard-Größe (`dashboard.js` darf nicht wachsen).
- Kein `reducedMotion` im Harness (R-01 verdeckt mobil sonst alles).
- Nummer O-219 kann mit parallelen Einträgen auf `main` kollidieren.
- Session-Limit: Auto-Fortsetzung läuft als T3-Zeitplan alle 2 h in diesem Thread.


## Fortsetzung

Fortgesetzt am 24.10.2026 mit Codex, ausschließlich im Worktree und Branch `redesign/praxura-design`. Tatsächlicher Start war bereits `84920b8d` (Phase 1.5 abgeschlossen, Phase 2.1 begonnen), sauberer Arbeitsbaum; vorhandene Arbeit erhalten. Die Angaben oben dokumentieren den früheren Startstand. Maßgeblich bleibt `redesign/STATUS.md`.

**Fertig und lokal geprüft:**
- Phase 1.5 erneut abgesichert. Fehlende/falsch nummerierte Team-Referenzen und inkonsistente Rasterung im alten Statistik-Bild eingegrenzt. Alle 159 Referenzbilder aus Phase-0-Commit `7c92add1` mit aktuellem synthetischem Harness und gleicher Panel-Reihenfolge neu aufgenommen: `.redesign-shots/vorher-vollbasis7c92/`. Ursprüngliche Referenzen erhalten, keine Vergleichsschwelle verändert.
- **3.1 Topbar** (`da531d07`): neutrale Fläche, klare Gruppen, Uhr mit gleich breiten Ziffern, kein Leuchteffekt; Höhe unverändert.
- **3.3 Panel-Kopf** (`6dffd962`): Titel mit normalem Gewicht, 24–28 px responsiv, graue Unterzeilen, klare Abstände.
- **3.4 Karten** (`35367a07`): Radius 16 px, Desktop-Innenabstand 24–32 px, mobil kompakter; keine schweren Schatten. Einstellungsköpfe Creme, bestehende Statistik-Karten am Desktop ausgewogen 3×2.
- Alle Regeln nur unter `[data-design="neu"]` und für Bildschirm. HTML ausschließlich Cache-Nummer geändert, zuletzt `praxura-design.css?v=20261024rd5`. `dashboard.js`, Basis-CSS, Backend, DB, Druckvorlagen und Leistungsfarben unverändert.

**Nachweise:**
- Vor Beginn und nach jedem CSS-Paket: T1 grün (1.271 IDs, 52 JS-Klassen, Syntax, Größenlimit); `npm test` jeweils **4.071/4.071** (2.152 Frontend + 1.625 Backend + 294 Tools).
- Regulärer `npm run probe`: alle 14 Probes grün, zuletzt erneut nach Kartenpaket. Temporärer Probe-Server brauchte synthetische `/api/config` und korrekten PDF-MIME-Typ; keine Zugangsdaten verwendet.
- T4 zuletzt: **159 Altbilder, 0 echte Abweichungen, 1 Rauschen, 0 fehlen**. 108 Neu-Bilder aller 27 Bereiche in Hell/Dunkel und 1440/390 px gesichtet; Statistik und Einstellungen zusätzlich im Detail.
- T5: `smoke-p3.json`, beide Designs, volle/leere Praxis, 1440/390 px: **0 neue Funde**, 88 bekannte Funde insgesamt. Nur synthetische, schreibgeschützte Praxis.
- Direkter Dashboard-Vergleich `geometrie-karten.json`: Kalender-Slots, Köpfe, Topbar-Höhe und Breite zwischen Alt/Neu in allen vier Theme-/Breitenkombinationen identisch. Theme-Schalter und Tastaturfokus funktionieren.
- Zusätzlicher Legacy-Probe-Aufbau mit produktivem Feinschliff erwartet fälschlich einen 44-px-Tageskopf; Feinschliff blendet ihn bereits absichtlich aus. Identisch ohne neues Design reproduziert, als R-12 dokumentiert. Tests unverändert gelassen; direkte Dashboard-Messung ergänzte den Nachweis.
- Impeccable-Detektor: 0 CSS-Befunde; 30 Hinweise auf unverändertes HTML, kein grünes Gesamturteil daraus. Referenzbild und Screenshot-Artefakte bleiben gitignored.

**Commits dieser Fortsetzung:** `dc6365fb` Absicherung/Referenz, `da531d07` Topbar, `6dffd962` Panel-Köpfe, `35367a07` Karten; anschließend Dokumentationsabschluss. Push ausschließlich auf `origin/redesign/praxura-design` im Vordergrund. Keine Übernahme nach `main` und kein Live-Test/T6 in dieser Fortsetzung.

**Nächster Schritt:** 3.5 Knöpfe, danach Felder und Tabellen, weitere Phase-3-Bausteine einzeln. Phase 2 bleibt separat offen; alle 27 Bereiche sind noch nicht einzeln abgenommen. Vor Phase 4 bei Daten-/Rollenfragen Melih fragen; Merge/Live-Freigabe F-01 und Standard-Umschaltung Phase 8 benötigen sein GO. Fehlerbuch R-09–R-12 enthält Ursachen und Prüfgrenzen dieser Fortsetzung.
