# Prompt zum Weitermachen (Stand 24.10.2026)

Kopieren und in eine neue Claude-Code-Sitzung **im Worktree** einfügen:

```
Arbeitsordner: ~/.t3/worktrees/infinitymade-website/redesign-praxura-design (Branch redesign/praxura-design). Nicht im Haupt-Checkout arbeiten.

Lies CLAUDE.md, redesign/AUFTRAG.md, redesign/STATUS.md und wissensbank/sitzungen/2026-10-24_redesign-phase0-phase1.md. Mach beim nächsten offenen Punkt weiter und arbeite die Schleife aus AUFTRAG 3.3 ab, bis eine Phase fertig ist. Bei Session-Limit: warten, nach dem Reset automatisch weitermachen.

Wo ich stehe: Phase 0 fertig (Commit 7c92add1). O-219 behoben (2a683d24). Phase 1.1–1.4 liegen ungespeichert im Worktree: Schalter in dashboard.html, praxura-design.css, Eintrag in onprem/frontend.Dockerfile + .github/workflows/publish-frontend.yml, tools/redesign-kontrast.test.js (7/7 grün). Ohne ?design=neu 0 Pixel Abweichung.

Als Nächstes:
1. Prüfen: node tools/check-redesign-ids.mjs · sh tools/check-syntax.sh · sh tools/check-dashboard-size.sh · npm test (muss 4.064+ grün bleiben). Bei fehlender .redesign-shots/vorher/: auf Commit 7c92add1 (ohne Schalter) neu aufnehmen: node tools/redesign-shots.mjs --lauf vorher --theme beide --breite 1440,390 (und employee/leer wie in STATUS).
2. Phase 1.1–1.4 committen (nur eigene Dateien, git add einzeln; Co-Authored-By-Zeile).
3. 1.5: node tools/redesign-shots.mjs --lauf p1neu --design neu --theme beide --breite 1440,390 — alle Bilder ansehen (REFERENZ.md, Bild redesign/referenz/quicken-dashboard-mobbin.png), Ausreißer in praxura-design.css beheben. T5: node tools/redesign-smoke.mjs --lauf p1 --design beide --gegen vorher → 0 neue Funde.
4. 1.6: Branch pushen (nicht main). T6 erst nach Melihs Antwort F-01.
5. Dann Phase 2 → 8 laut STATUS.md. Phase 4 vorher podoloji + /konsey + guvenlik (R-06). Pflicht-Agenten: WERKZEUGE.md.

Regeln: dashboard.js keine Zeile länger. Keine IDs/Klassen-Haken umbenennen. Kein Push auf main, kein Live-DB-Eintrag, keine Preise/Klarnamen. Stopp-Punkte: AUFTRAG Abschnitt 9. Am Ende jeder Sitzung STATUS.md + wissensbank/sitzungen aktualisieren.
```
