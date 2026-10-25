# Prompt zum Weitermachen (Stand 25.10.2026, Redesign v2)

Kopieren und in eine neue Claude-Code-Sitzung **im Worktree** einfügen:

```
Arbeitsordner: ~/.t3/worktrees/infinitymade-website/redesign-praxura-design (Branch redesign/praxura-design). Nicht im Haupt-Checkout arbeiten.

Lies CLAUDE.md, redesign/PLAN-V2.md (Melihs OK vom 25.10.2026), redesign/STATUS.md (Kurzzustand + Paketliste) und für Regeln redesign/AUFTRAG.md (Schleife 3.3, Tests, Reparatur). Mach beim „Nächsten Paket“ aus dem Kurzzustand weiter und arbeite die Paketliste ununterbrochen ab, bis V9 fertig ist. Nach jeder Phase: origin/main einmergen, T1–T5 auf dem Ergebnis, main pushen (Vordergrund), canli-test mit ?design=neu. Anhalten nur an den Stopp-Punkten aus PLAN-V2 §7 (dann „Wartet auf Melih“ in STATUS setzen und unabhängige Pakete weiterbauen). Bei Session-Limit: nach dem Reset automatisch weitermachen.

Start jeder Sitzung: git status, git log -1, Kurzzustand lesen, eigene halbe Arbeit testen oder verwerfen, node tools/redesign-status-check.mjs.
```
