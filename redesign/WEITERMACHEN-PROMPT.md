# Prompt zum Weitermachen (Stand 12.11.2026, Redesign v2 Delta-Lauf)

Kopieren und in eine neue Claude-Code-Sitzung **im Worktree** einfügen:

```
Arbeitsordner: ~/.t3/worktrees/infinitymade-website/redesign-delta-20261112 (Branch redesign/delta-20261112). Nicht im Haupt-Checkout arbeiten.

Lies CLAUDE.md, redesign/STATUS.md (Kurzzustand + Paketliste), redesign/PLAN-V2.md (Delta-Hinweis 12.11. oben zuerst) und für Regeln redesign/AUFTRAG.md (Schleife 3.3, Tests, Reparatur). Mach beim „Nächsten Paket“ aus dem Kurzzustand weiter: V1.07 (Abgleich) → V2 (Abnahme + Lücken) → V6.F00–F06. Ein Paket = ein lokaler Commit inkl. STATUS. Ein Worker (Sonnet) je Bau-Paket, nie parallel; gemeinsame Dateien ändert nur der Hauptkontext. Fehlende Teile gezielt aus rettung/design-wip-20261031 portieren und gegen aktuelle Loader neu prüfen, nie blind kopieren.

Kein Push, kein Deploy, keine Env-/Pilot-Aktivierung, keine Live-DB ohne Melihs ausdrückliche Freigabe. Anhalten an den Stopp-Punkten aus PLAN-V2 §7 (dann „Wartet auf Melih“ in STATUS setzen und unabhängige Pakete weiterbauen). Bei Session-Limit: nach dem Reset beim nächsten offenen Paket weitermachen; ein Reset ist nie eine Freigabe.

Start jeder Sitzung: git fetch, git status -sb, git log -1, Kurzzustand lesen, eigene halbe Arbeit testen oder verwerfen, node tools/redesign-status-check.mjs. node_modules sind verlinkt (siehe Kurzzustand); Probes brauchen den Dev-Server aus diesem Worktree mit erfundener Konfiguration (STATUS R-16).
```
