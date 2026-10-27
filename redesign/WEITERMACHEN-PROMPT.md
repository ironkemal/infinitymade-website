# Prompt zum Weitermachen (Stand 27.10.2026, Redesign v2)

Kopieren und in neue Sitzung **im Worktree** einfügen (Hauptrolle aktuell Sol 6.1):

```
Arbeitsordner: ~/.t3/worktrees/infinitymade-website/redesign-praxura-design (Branch redesign/praxura-design). Nicht im Haupt-Checkout arbeiten.

Lies CLAUDE.md, redesign/PLAN-V2.md (Melihs OK vom 25.10.2026), redesign/STATUS.md (Kurzzustand + Paketliste) und für Regeln redesign/AUFTRAG.md (Schleife 3.3, Tests, Reparatur). Mach beim „Nächsten Paket“ aus dem Kurzzustand weiter und arbeite die Paketliste ununterbrochen ab, bis V9 fertig ist. Melihs spätere Grenze geht vor: KEIN main-Push, keine Standardumschaltung/V10, keine Live-DB. Push ausschließlich redesign/praxura-design im Hauptkontext/Vordergrund. Hauptrolle Sol 6.1 übernimmt bisherige Claude-Dateien; Backendkollege behält seine exklusiven Dateien (STATUS). Anhalten nur an Stopp-Punkten PLAN-V2 §7; unabhängige Pakete weiterbauen. Bei Session-Limit nach Reset weitermachen.

Verbindliches Endziel / aktives GOAL (Melih 27.10.): Nach vollständiger Fertigstellung ersetzt Neu Alt als Standard für alle Nutzer, auch bestehende Kunden-Dashboards. Kein dauerhaftes Vorschau-/Opt-in-Endprodukt. Laufende Pakete fertigstellen, vollständig integrieren/testen, dann Umstellung reviewbar vorbereiten. V10-Abnahme aus PLAN-V2 §1 und STATUS: nackte /dashboard.html-URLs, frische Profile, vorhandener/fehlender/abweichender oder gesperrter localStorage, Besitzer/Mitarbeiter, direkte Panel-Einstiege, alle Bereiche/Zugänge, Box-Auslieferung. Funktionen/Rollen/Tenants/Daten erhalten; Umstellungsweg/Cache/Rückfall prüfen. Dockerfile-COPY belegt keine Kundeninstallation; Kundenstand separat nachweisen. Tatsächliche Veröffentlichung weiterhin nur nach gesonderter Freigabe; kein sofortiger Push/Deploy.

Start jeder Sitzung: git status, git log -1, Kurzzustand lesen, eigene halbe Arbeit testen oder verwerfen, node tools/redesign-status-check.mjs.
```
