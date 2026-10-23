---
titel: Praxura-Redesign — Phase 0 fertig, Phase 1 (Schalter + Token) begonnen
typ: sitzung
angelegt: 2026-10-24
tags: [sitzung, redesign, design, worktree, onprem, werkzeuge]
---

# Praxura-Redesign: Stand 24.10.2026

**Arbeitsort:** Worktree `~/.t3/worktrees/infinitymade-website/redesign-praxura-design`, Branch `redesign/praxura-design` (Melihs Wunsch, geht der Regel „direkt auf main“ vor). Basis `origin/main` `6fd0cce3`. Noch **nichts gepusht**.
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
