# STATUS: Praxura-Redesign

> Gedächtnis von Claude Code. Nach jedem Paket aktualisieren. Eine neue Sitzung muss allein mit dieser Datei weitermachen können.

**Stand:** Phase 0 fertig (23.10.2026). Werkzeuge T1/T4/T5 gebaut und geprüft, Vorher-Bilder + Smoke-Referenz liegen vor.
**Arbeitsort:** Worktree `~/.t3/worktrees/infinitymade-website/redesign-praxura-design`, Branch **`redesign/praxura-design`** (Melihs Wunsch 23.10.: eigener Worktree). Haupt-Checkout `~/infinitymade-website` nicht anfassen (fremde, nicht gespeicherte Änderungen).
**Aktuelle Phase:** 1
**Nächster Schritt:** 2.1 Rest (2 `<style>`-Blöcke in dashboard.html), dann 2.2 `dashboard.js`-Strings, 2.3 `dashboard.css`. Weitermach-Prompt: `redesign/WEITERMACHEN-PROMPT.md`
**Wartet auf Melih:** – (Fragen unten blockieren nichts)
**Auto-Fortsetzung:** geplanter T3-Task „Praxura-Redesign automatisch fortsetzen“ alle 2 h in diesem Thread. Abschalten: in T3 unter geplanten Aufgaben deaktivieren/löschen.

## Ausgangslage (Phase 0, 23.10.2026, Basis origin/main `6fd0cce3`)
- `npm test`: **4.064/4.064 grün** (frontend 2.152 · backend 1.625 · tools 287). Voraussetzung im Worktree: `node_modules`, `api-backend/node_modules`, `merkez/node_modules` (per `cp -cR` aus dem Haupt-Checkout geklont).
- `npm run probe`: **alle 14 Proben grün** (letzte: widget 55/55).
- Vorher schon rote Tests: keine.
- Zahlen neu geprüft (grep, 23.10.):
  - `dashboard.js` 18.415 Zeilen = Baseline (kein Puffer). 263 Hex, 70 rgb(a), 373 Inline-`style=`, 271 `.style.`, 1.619 getElementById/querySelector.
  - `module/*.js` ohne Tests: 216 Dateien, **495 Hex** (REFERENZ sagte 358 — anders gezählt; maßgeblich ist diese Zahl).
  - `dashboard.html`: **1.271 IDs** (keine doppelt), 154 Hex, 920 Inline-`style="` (62 mit Hex), 2 `<style>`-Blöcke (Z. 3766–4033, 5684–5729).
  - `dashboard.css` 8.455 Z., 1.140 `var(--`, 181 Hex, 146 `!important` · `dashboard-feinschliff.css` 491 Z., 84 `var(--`, 31 Hex, 47 `!important`.
  - 27 Panels bestätigt (Liste unten). Token: dashboard.css 59 hell + 28 dunkel, Feinschliff +22 hell / +13 dunkel, 67 verschiedene Namen benutzt.
  - **Benutzt, aber nirgends definiert:** `--accent --text-sub --border-color --border-subtle --primary-h/-s/-l --bg-elevated --shadow-sm --radius-md --danger-bg --warning-bg --warning-border` (Fallbacks greifen). → Phase 1.3.
- Verfügbare Skills: konsey, frontend-design, impeccable, dataviz, design:design-system, design:design-critique, design:accessibility-review, design:ux-copy, design:design-handoff, engineering:code-review, engineering:debug, engineering:testing-strategy — **alle vorhanden**.
- `.env.local` konnte nicht in den Worktree kopiert werden (Berechtigung abgelehnt). Darum Bilder/Smoke **ohne Login** über synthetische Fixture (Entscheidung E-05).

## Werkzeuge (Phase 0)
| Werkzeug | Zweck | Aufruf |
|---|---|---|
| `tools/check-redesign-ids.mjs` + `tools/redesign-id-baseline.txt` + `tools/redesign-klassen-baseline.txt` | T1: keine Baseline-ID weg, keine doppelt (1.271); 52 Klassen aus dashboard.html, die JS abfragt/setzt, bleiben | `node tools/check-redesign-ids.mjs` |
| `tools/redesign-harness.mjs` | Unterbau: eigener Server Port 18081 (fest, `REDESIGN_PORT`), tauscht `/vendor/supabase-js.js` gegen Fixture, beantwortet `/api/*`, bricht fremde Hosts ab, Uhr fest Fr 23.10.2026 10:15 | – |
| `tools/browser-probe/redesign-fixture.js` | synthetische Podologie-Praxis (8 Patienten, 4 Leistungen, Termine heute/morgen/vor 3 Tagen, 6 Verordnungen mit Fristen, 4 Rechnungen), Szenario `voll`/`leer`, Rolle `owner`/`employee` (Rechte: alles außer Abrechnung), nur lesend | – |
| `tools/redesign-shots.mjs` | T4: Bilder je Panel × Design × Theme × Breite (speichert erst, wenn zwei Aufnahmen gleich sind), Pixel-Diff zweier Läufe; ≤ 0,1 % in einem ≤ 24 px hohen Streifen = ⚠ Rauschen (Subpixel-Text, z. B. mahnwesen y 473), sonst ✗ | `--lauf X [--rolle employee]` · `--vergleich A B` |
| `tools/redesign-smoke.mjs` | T5: Panels öffnen, Umschalter klicken, Hauptknopf-Dialog öffnen/schließen, Überlauf messen, Konsole | `--lauf X [--gegen vorher]` |

- Bilder sind **deterministisch** (zwei Läufe, 16/16 pixelgleich). Kein `?design=` vor Phase 1 wirksam.
- **Nur ein Harness-Lauf gleichzeitig** (fester Port).
- Referenzläufe: `.redesign-shots/vorher/` (alt · owner-voll: hell+dunkel × 1440+390 = 108 · owner-leer: hell 1440 = 27 · employee-voll: hell 1440 = 27, davon 3 gesperrt) und `.redesign-shots/smoke-vorher.json` (44 Funde, alle vorbestehend: Vorlagen-Seed-Schreibversuche durch Fixture, Überlauf 390 px R-02/R-03).
- **Regel:** Fixture ändern ⇒ danach `--lauf X` alt und `--vergleich vorher X` → muss 0 ✗ sein, sonst Vorher-Läufe auf dem Basis-Commit neu aufnehmen. (23.10.: Mitarbeiter-RPCs ergänzt, Vergleich 0 ✗ / 1 ⚠.)
- `funktionen/INDEX.json` scannt `tools/` nicht (`SCAN_ROOTS`) → neue Werkzeuge ändern die Karte nicht. Karte ist auf `main` schon veraltet (`--check` rot, vorbestehend, nicht von uns).

## Phasen
- [ ] **0 Vorbereitung**
  - [x] 0.1 Neu-Analyse (Explore + fonksiyon-ustasi), Ergebnis oben
  - [x] 0.2 `tools/redesign-id-baseline.txt` + `tools/check-redesign-ids.mjs`
  - [x] 0.3 `tools/redesign-shots.mjs` (T4) + `tools/redesign-smoke.mjs` (T5) + Harness + Fixture
  - [x] 0.4 Vorher-Bilder aller Panels (alt · hell/dunkel · 1440/390 · voll; leer hell 1440; employee hell 1440)
  - [x] 0.5 Plan je Phase (diese Datei)
  - [x] 0.6 Mitarbeiter-Rolle in der Fixture (`get_default_business`, `get_my_permissions`) — `--rolle employee` öffnet alle Panels außer den abrechnungsgebundenen (podologie-billing, fussstatus, abrechnung = gewollt gesperrt)
  - [x] 0.7 Klassen-Wache: 52 Klassen → `tools/redesign-klassen-baseline.txt`, Prüfung in `check-redesign-ids.mjs`
  - [ ] 0.8 Commit: `redesign/*.md`, Ignore-Einträge, Werkzeuge, `pixelmatch`/`pngjs` (devDependencies), Funktionskarte tazelen + fonksiyon-ustasi „niye + nerede“
- [ ] **1 Variablen + Schalter**
  - [x] 1.1 Schalter (geschrieben, 0 px Diff alt; nicht committet) im Inline-Script `dashboard.html:8`: `?design=neu` → `localStorage px-design='neu'` + `<html data-design="neu">`; gespeichert → setzen; `?design=alt` → löschen; try/catch. Fertig: T4 alt = vorher (0 px Diff), Attribut nur mit Schalter
  - [x] 1.2 `praxura-design.css` (geschrieben; Kutu-Image-Eintrag erledigt; nicht committet) (Kopfkommentar wie Feinschliff), nach `dashboard-feinschliff.css` geladen, `?v=20261023rd1`. Token aus REFERENZ §2 unter `:root[data-design="neu"]:not([data-theme="dark"])` / `:root[data-design="neu"][data-theme="dark"]` (0,3,0). Fertig: alt 0 px Diff, neu = kühles Grau + weiße Karten
  - [x] 1.3 Fehlende Token (`--accent --text-sub --border-color --border-subtle --bg-elevated --shadow-sm --radius-md --danger-bg --warning-bg --warning-border --primary-h/s/l`) **nur im neu-Bereich** definieren. Fertig: neu nutzt nirgends mehr den Fallback
  - [x] 1.4 Kontrast-Test (7/7) `tools/redesign-kontrast.test.js` (liest Token aus `praxura-design.css`, prüft Text ≥ 4,5:1, große Schrift/Symbole ≥ 3:1, hell + dunkel). Läuft in `npm test`
  - [x] 1.5 Neu-Bilder aller Panels (hell+dunkel 1440, hell+dunkel 390 gesichtet 24.10.; dunkel+390 zeigen dieselben Funde, keine neuen): Token greifen überall (Grau/Weiß/Creme/Espresso). Funde für Phase 2/3, noch nicht behoben: (a) settings: Kopf „ALLGEMEIN“ mintgrün (fester Hex/rgba(34,197,94) in dashboard.css/html), (b) verordnungen: orange Randlinie je Zeile + gemischte Badge-Stile, (c) abrechnung: große dunkle „Neue Abrechnung“-Kachel (Espresso, zu schwer), (d) statistik: Kachelreihe umbricht auf 2. Zeile, (e) leere Zustände uneinheitlich, (f) kalender: grüne rgba(34,197,94)-Töne bleiben (Phase 2). Noch offen: dunkel + 390 px ansehen, Smoke `--design neu --gegen vorher`
  - [ ] 1.6 Phasenende: T1–T5, Push Branch, T6 (siehe Frage F-01)
- [ ] **2 Feste Farben** (Hex → `var(--name, ALT)`; Ausnahmen AUFTRAG 4.4; alt muss pixelgleich bleiben)
  - [~] 2.1 `dashboard.html` Inline-`style=`: 24 Stellen auf `var(--px-*, alt)` (ok/fehler/text-2/text-3/linie, Namen im alten Design undefiniert → pixelgleich, mit p2base-Gegenprobe 0 px). Bewusst nicht umgefärbt: Beleg-Fußzeile Z.1259, Logo-Vorschau #fff, Video #000, Vorlagen-Mock, Aktionsknöpfe blau/grün/orange (Z.5004–5035). Offen: die 2 `<style>`-Blöcke
  - [ ] 2.2 `dashboard.js` (263 Hex, 70 rgb) — nur gleiche Zeile, keine Zeile mehr; Ausnahmen (Alpha-Anhang `${c}22`, Canvas, Druck, `EMP_COLORS`) in Liste unten
  - [ ] 2.3 `module/*.js` gruppiert: verordnung-* · abrechnung-*/rechnung-* · kalender-*/termin-* (ohne `kalender-farben.js`) · podologie-*/fuss* · Rest. Ggf. `builder` mit Gemini
  - [ ] 2.4 Wiederkehrende Inline-Stile → Klassen in `praxura-design.css`
  - Fertig je Paket: T4 alt 0 px Diff, neu folgt Token
- [ ] **3 Rahmen + Bausteine** (alles unter `[data-design="neu"]`)
  - [ ] 3.1 Topbar · [ ] 3.2 Seitenleiste (Labels bleiben; eingeklappt = Icon-Leiste mit Tooltip — **/konsey**) · [ ] 3.3 Panel-Kopf (Titel normal, graue Unterzeile)
  - [ ] 3.4 Karten (`.card .kpi-card .settings-section`, Radius 16–20, Innenabstand 24–32, kaum Schatten) · [ ] 3.5 Knöpfe (`.btn-primary/-ghost/-danger/-icon/-sm/-outline-sm/-success`: normal/hover/fokus/deaktiviert) · [ ] 3.6 Felder (`.form-*`, `.toggle-switch`, katalog-suche, patient-suche, calendar-widget)
  - [ ] 3.7 Tabellen (`.data-table .table-wrap .table-empty`, `tabular-nums`, Beträge rechts) · [ ] 3.8 Badges (`.badge-*`, `.status-dot`) · [ ] 3.9 Modale (`.modal*`) · [ ] 3.10 Tabs/Filter (`.tab-bar .tab-btn .pd-tab .filter-btn`)
  - [ ] 3.11 Banner (`.dash-banner*`) · [ ] 3.12 Leerzustände (einheitliche Optik für `.upcoming-empty .gap-empty .pd-empty .emp-day-empty .table-empty`) · [ ] 3.13 Toast · [ ] 3.14 Fokusring sichtbar · [ ] 3.15 `komponenten.html` nachziehen (hat eigenes Inline-CSS)
- [ ] **4 Übersicht** (Konzept zuerst: podoloji + /konsey; guvenlik wegen F-03)
  - [ ] 4.0 Konzept + Entscheidung (Aufbau REFERENZ §4) · [ ] 4.1 Raster (nur CSS/Hülle, IDs bleiben) · [ ] 4.2 „Praxis heute“ (aus schon geladenen Daten) · [ ] 4.3 Auslastungs-Ring (`ringStrich` aus `module/einrichtung-fortschritt.js` wiederverwenden) · [ ] 4.4 Nächste Termine · [ ] 4.5 Fristen & Hinweise (2×2 + „Alle anzeigen“ → ueberblick) · [ ] 4.6 Leistungen diesen Monat (owner; Podologie zählt `podologie_behandlungen` — neue Abfrage → db-ustasi + onprem) · [ ] 4.7 Lade/Leer/Fehler je Karte + Tests `module/uebersicht-*.test.js`
- [ ] **5 Terminkalender** — nur Optik; `layout-probe` + `render-probe` grün; Prüfliste AUFTRAG §5
- [ ] **6 Alle Bereiche** (Tabelle unten)
- [ ] **7 Abnahme** (Durchläufe bis null Funde)
- [ ] **8 Umschalten** – nur nach Melihs OK

## Bereiche (Phase 6)
Spalten: Optik · hell/dunkel · Inhaber/Mitarbeiter · 390 px (mobil-ui) · Funktionen (T5) · Live (T6). Rollen/Fachbereich aus `nav-registry.js` (o = owner, e = employee).

| # | Panel | Rollen | Optik | Hell/Dunkel | Rollen | 390 px | Funktionen | Live |
|---|---|---|---|---|---|---|---|---|
| 1 | overview (Phase 4) | o,e | | | | | | |
| 2 | calendar (Phase 5) | o,e | | | | | | |
| 3 | anfragen | o | | | | | | |
| 4 | kunden | o,e | | | | | | |
| 5 | podologie-billing | o (Po) | | | | | | |
| 6 | fussstatus | o,e (Po) | | | | | | |
| 7 | verordnungen | o,e | | | | | | |
| 8 | abrechnung | o + Plan | | | | | | |
| 9 | rechnungen | o,e | | | | | | |
| 10 | belegliste | o | | | | | | |
| 11 | mahnwesen | o | | | | | | |
| 12 | warteliste | o,e | | | | | | |
| 13 | ueberblick | o,e | | | | | | |
| 14 | anamnese | o,e | | | | | | |
| 15 | doctors | o,e (nicht Po) | | | | | | |
| 16 | fahrtenbuch | o,e | | | | | | |
| 17 | statistik | o | | | | | | |
| 18 | notizen | o,e | | | | | | |
| 19 | services | o,e | | | | | | |
| 20 | hours | o,e | | | | | | |
| 21 | team | o,e | | | | | | |
| 22 | vorlagen | o | | | | | | |
| 23 | settings | o,e | | | | | | |
| 24 | b2b | o,e | | | | | | |
| 25 | b2c | o,e | | | | | | |
| 26 | feedback | o,e | | | | | | |
| 27 | beispielmodus | o,e | | | | | | |

## Ausnahmen „nicht umfärben“ (wächst in Phase 2)
- `module/kalender-farben.js` (Leistungsfarben der Praxis), `EMP_COLORS` `dashboard.js:480`, Belege/Rechnungen/PDF/Druck/E-Mail-Vorlagen, öffentliche Seiten.

## Fehlerbuch
| # | Datum | Bereich | Fehler | Ursache | Status | Versuche |
|---|---|---|---|---|---|---|
| R-01 | 23.10.2026 | alle, mobil | Mit „Bewegung reduzieren“ (prefers-reduced-motion) bleibt die Seitenleiste ≤ 1024 px dauerhaft offen über dem Inhalt | `dashboard.css:7139` setzt `* { transform: none !important }`, hebt `.sidebar { transform: translateX(-100%) }` auf | vorbestehend · Ops-Karte offen | – |
| R-02 | 23.10.2026 | anamnese | 390 px: `#mainArea` 69 px horizontaler Überlauf | noch nicht untersucht | vorbestehend | – |
| R-03 | 23.10.2026 | services | 390 px: `#mainArea` 300 px horizontaler Überlauf | noch nicht untersucht | vorbestehend | – |
| R-04 | 23.10.2026 | mehrere | 12 CSS-Variablen benutzt, nie definiert; `hsla(var(--primary-h)…)` bei `dashboard.js:2548`, `module/rezeptinfo-geld.js:394` wirkungslos | Altlast | vorbestehend · im neuen Design Phase 1.3 | – |
| R-05 | 23.10.2026 | overview | KPI „in Therapie“ zählt `status='in_therapy'`, Podologie-Topf kennt den Status nicht → vermutlich immer 0 | fonksiyon-ustasi | vorbestehend · Verdacht, nicht live geprüft | – |
| R-06 | 23.10.2026 | overview/statistik | `/api/billing/statistik` prüft keine Rolle; Aktivitäts-Feed zeigt Rechnungsbeträge auch Mitarbeitern | fonksiyon-ustasi | vorbestehend · für guvenlik vor Phase 4 | – |
| R-07 | 23.10.2026 | overview | `renderGaps` + `renderGapsForDate` schreiben beide in `#gapsList`, erste Ausgabe sofort überschrieben | Doppelung | vorbestehend · nur notiert | – |
| R-08 | 23.10.2026 | fussstatus | Mitarbeiterin ohne Abrechnungsrecht kommt nicht in den Fußbefund (klinische Doku) | `SIDEBAR_TO_MODULE.fussstatus = 'abrechnung'` (`dashboard.js` ~Z. 621) | vorbestehend · Frage an podoloji, nicht im Redesign ändern (Verhalten) | – |

## Entscheidungen
| Datum | Frage | Entscheidung | Wer (Melih/Konsey) |
|---|---|---|---|
| 23.10.2026 | Abgesprochen mit Kemal? | ja | Melih |
| 23.10.2026 | Umfang | alle Bereiche | Melih |
| 23.10.2026 | Grundfarbe | kühles Grau + Praxura-Akzent | Melih |
| 23.10.2026 | Neue Abfragen Übersicht | erlaubt | Melih |
| 23.10.2026 | E-01 Arbeitsort | eigener Worktree + Branch `redesign/praxura-design` (Melihs ausdrücklicher Wunsch, geht der CLAUDE.md-Regel „direkt auf main“ und AUFTRAG 0.3 vor). Gepusht wird **nur der Branch**; Merge nach `main` erst mit Melihs OK | Melih |
| 23.10.2026 | E-02 Auto-Fortsetzung | T3-Zeitplan alle 2 h in diesem Thread | Melih (Wunsch) |
| 23.10.2026 | E-03 ID-Wache im Pre-commit-Hook? | nein, T1 manuell — Hook würde Kemal bei bewussten ID-Änderungen blockieren, ohne dass das abgesprochen ist | Claude |
| 23.10.2026 | E-04 Reduzierte Bewegung im Harness | aus (R-01 würde mobil jede Seite verdecken), Bilder stoppen Animationen selbst | Claude |
| 23.10.2026 | E-05 Bilder/Smoke mit Fixture statt QA-Login | synthetische Praxis: reproduzierbar, keine Zugangsdaten, kein Schreibzugriff möglich. Echter Login nur für T6 (canli-test) | Claude |

## Offene Fragen an Melih
- **F-01** T6 verlangt live `app.praxura.de/dashboard.html?design=neu`. Live ist aber nur `main`. Optionen: (a) Branch-Stand nach jeder Phase nach `main` mergen (alles liegt hinter dem Schalter), (b) T6 erst beim Merge. Bis zur Antwort: Branch pushen, T6 offen lassen.
- **F-02** QA-Zugang im Worktree: Wenn live-ähnliche Bilder mit echten QA-Daten gewünscht sind, bitte `.env.local` selbst in den Worktree kopieren. Für T4/T5 nicht nötig.
- **F-03** (für Phase 4, an guvenlik): R-06 — Geld-Kennzahlen in der Übersicht nur owner; Statistik-Endpunkt hat keine Rollenprüfung.

## Sitzungsprotokoll
| Datum | Was erledigt | Commits | Nächster Schritt |
|---|---|---|---|
| 24.10.2026 | O-219 (Feinschliff im Kutu-Image) im Branch behoben `2a683d24`; Phase 1.1–1.4 geschrieben, Kontrast 7/7, alt 0 px Diff | `2a683d24` | 1.1–1.4 committen, 1.5 |
| 24.10.2026 | npm test 4.071 grün; Neu-Bilder hell gesichtet; Harness: attendance-Report-Antwort `{records:[]}` (Team-Fehler war Artefakt), Team-Vorher neu | (folgt) | 1.5 Rest, 1.6 |
| 23.10.2026 | Worktree angelegt, Ausgangslage (Tests/Proben grün), Neu-Analyse, ID-Wache, Harness + Fixture + Shots + Smoke, Vorher-Läufe, Plan | (folgt 0.8) | 0.6/0.7, Commit, Phase 1 |

## Abschlussbericht
(am Ende ausfüllen)
