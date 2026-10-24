# STATUS: Praxura-Redesign

> Gedächtnis von Claude Code. Nach jedem Paket aktualisieren. Eine neue Sitzung muss allein mit dieser Datei weitermachen können.

**Stand (24.10.2026):** Phase 0 fertig; Phase 1.1–1.5 lokal abgesichert. Phase 3.1 Topbar, 3.3 Panel-Kopf, 3.4 Karten, 3.5 Knöpfe und 3.6 Felder fertig und einzeln committet. Einzelabnahme der 27 Bereiche und T6 live bleiben offen.
**Arbeitsort:** Worktree `~/.t3/worktrees/infinitymade-website/redesign-praxura-design`, Branch **`redesign/praxura-design`** (Melihs Wunsch 23.10.: eigener Worktree). Haupt-Checkout `~/infinitymade-website` nicht anfassen (fremde, nicht gespeicherte Änderungen).
**Aktuelle Phase:** 3 — Bausteine beginnen (Phase 2 bleibt separat offen)
**Nächster Schritt:** 3.7 Tabellen (3.6 Felder fertig, rd7); jeweils CSS nur unter `[data-design="neu"]`, eigenes Paket/Commit mit T1, `npm test`, Altvergleich (`vorher-vollbasis7c92`) und Neu-Sichtung. Aktuell `praxura-design.css?v=20261024rd7`; nächste Änderung braucht neue Nummer. Phase 2 bleibt separat offen; `dashboard.css` und Feinschliff nicht umschreiben.
**Wartet auf Melih:** nächste CSS-Pakete frei; vor Phase 4 bei Daten-/Rollenfragen anhalten und Melih fragen. Merge/Live-Test F-01 und Standard-Umschaltung Phase 8 weiterhin ohne Freigabe.
**Auto-Fortsetzung:** früherer Eintrag: T3-Task alle 2 h in diesem Thread. Scheduler in dieser Fortsetzung nicht live geprüft oder geändert.

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
- Historischer Referenzlauf: `.redesign-shots/vorher/` (alt · owner-voll: hell+dunkel × 1440+390 = 108 · owner-leer: hell 1440 = 27 · employee-voll: hell 1440 = 27, davon 3 gesperrt) und `.redesign-shots/smoke-vorher.json` (44 Funde, alle vorbestehend: Vorlagen-Seed-Schreibversuche durch Fixture, Überlauf 390 px R-02/R-03).
- **Aktuelle T4-Referenz:** `.redesign-shots/vorher-vollbasis7c92/`, 159 Bilder aus Phase-0-Commit `7c92add1` mit aktuellem Harness (R-10/R-11). Vergleich: `node tools/redesign-shots.mjs --vergleich vorher-vollbasis7c92 X`. Referenz und Läufe sind gitignored. Falls sie fehlen: erneut mit Phase-0-Laufzeitdateien und aktuellem Harness aufnehmen, nicht den aktuellen Produktstand als Vorher verwenden. Originale Referenzen bleiben erhalten.
- **Regel:** Fixture ändern ⇒ danach `--lauf X` alt und Vergleich gegen gültige Basis → muss 0 ✗ sein, sonst Vorher-Läufe auf dem Basis-Commit neu aufnehmen. (23.10.: Mitarbeiter-RPCs ergänzt, Vergleich 0 ✗ / 1 ⚠.)
- `funktionen/INDEX.json` scannt `tools/` nicht (`SCAN_ROOTS`) → neue Werkzeuge ändern die Karte nicht. Karte ist auf `main` schon veraltet (`--check` rot, vorbestehend, nicht von uns).

## Phasen
- [x] **0 Vorbereitung**
  - [x] 0.1 Neu-Analyse (Explore + fonksiyon-ustasi), Ergebnis oben
  - [x] 0.2 `tools/redesign-id-baseline.txt` + `tools/check-redesign-ids.mjs`
  - [x] 0.3 `tools/redesign-shots.mjs` (T4) + `tools/redesign-smoke.mjs` (T5) + Harness + Fixture
  - [x] 0.4 Vorher-Bilder aller Panels (alt · hell/dunkel · 1440/390 · voll; leer hell 1440; employee hell 1440)
  - [x] 0.5 Plan je Phase (diese Datei)
  - [x] 0.6 Mitarbeiter-Rolle in der Fixture (`get_default_business`, `get_my_permissions`) — `--rolle employee` öffnet alle Panels außer den abrechnungsgebundenen (podologie-billing, fussstatus, abrechnung = gewollt gesperrt)
  - [x] 0.7 Klassen-Wache: 52 Klassen → `tools/redesign-klassen-baseline.txt`, Prüfung in `check-redesign-ids.mjs`
  - [x] 0.8 Commit `7c92add1`: Plan, Ignore-Einträge, Werkzeuge und `pixelmatch`/`pngjs`. Werkzeuge werden von der Funktionskarte nicht gescannt; keine Produktionsfunktion hinzugefügt.
- [ ] **1 Variablen + Schalter**
  - [x] 1.1 Schalter (Commit `1f096769`, alt ohne echte Abweichung) im Inline-Script `dashboard.html:11`: `?design=neu` → `localStorage px-design='neu'` + `<html data-design="neu">`; gespeichert → setzen; `?design=alt` → löschen; try/catch. Fertig: T4 alt = vorher (0 px Diff), Attribut nur mit Schalter
  - [x] 1.2 `praxura-design.css` (Commit `1f096769`; Kutu-Image-Eintrag erledigt) (Kopfkommentar wie Feinschliff), nach `dashboard-feinschliff.css` geladen, `?v=20261023rd1`. Token aus REFERENZ §2 unter `:root[data-design="neu"]:not([data-theme="dark"])` / `:root[data-design="neu"][data-theme="dark"]` (0,3,0). Fertig: alt 0 px Diff, neu = kühles Grau + weiße Karten
  - [x] 1.3 Fehlende Token (`--accent --text-sub --border-color --border-subtle --bg-elevated --shadow-sm --radius-md --danger-bg --warning-bg --warning-border --primary-h/s/l`) **nur im neu-Bereich** definieren. Fertig: neu nutzt nirgends mehr den Fallback
  - [x] 1.4 Kontrast-Test (7/7) `tools/redesign-kontrast.test.js` (liest Token aus `praxura-design.css`, prüft Text ≥ 4,5:1, große Schrift/Symbole ≥ 3:1, hell + dunkel). Läuft in `npm test`
  - [x] 1.5 Neu-Bilder aller Panels (hell+dunkel 1440, hell+dunkel 390 gesichtet 24.10.; dunkel+390 zeigen dieselben Funde, keine neuen): Token greifen überall (Grau/Weiß/Creme/Espresso). Funde für Phase 2/3: (a) settings: mintgrüner Gruppenkopf in 3.4 behoben (Creme), (b) verordnungen: orange Randlinie je Zeile + gemischte Badge-Stile, (c) abrechnung: große dunkle „Neue Abrechnung“-Kachel (Espresso, zu schwer), (d) statistik: ungleichmäßiger Umbruch in 3.4 behoben (Desktop 3×2), (e) leere Zustände uneinheitlich, (f) kalender: grüne rgba(34,197,94)-Töne bleiben (Phase 2). Dunkel + 390 px wurden bereits im Commit `c0fc003c` gesichtet; erneute Prüfung mit aktuellem Branch-Stand: `p1checkneu` 108 neue Bilder, `smoke-p1check.json` beide Designs/voll+leer/1440+390: 0 neue Funde (88 bekannte Funde für zwei Designs). T4: `vorher-basis7c92` gegen `p1checkalt`: 159 Bilder, 0 abweichend, 2 Rauschen, 0 fehlen. R-10 behoben.
  - [~] 1.6 T1–T5 lokal grün, Branch-Push mit Abschluss dieser Fortsetzung; T6 bleibt bis Merge-/Live-Freigabe offen (F-01).
- [ ] **2 Feste Farben** (Hex → `var(--name, ALT)`; Ausnahmen AUFTRAG 4.4; alt muss pixelgleich bleiben)
  - [~] 2.1 `dashboard.html` Inline-`style=`: 24 Stellen auf `var(--px-*, alt)` (ok/fehler/text-2/text-3/linie, Namen im alten Design undefiniert → pixelgleich, mit p2base-Gegenprobe 0 px). Bewusst nicht umgefärbt: Beleg-Fußzeile Z.1259, Logo-Vorschau #fff, Video #000, Vorlagen-Mock, Aktionsknöpfe blau/grün/orange (Z.5004–5035). Offen: die 2 `<style>`-Blöcke
  - [ ] 2.2 `dashboard.js` (263 Hex, 70 rgb) — nur gleiche Zeile, keine Zeile mehr; Ausnahmen (Alpha-Anhang `${c}22`, Canvas, Druck, `EMP_COLORS`) in Liste unten
  - [ ] 2.3 `module/*.js` gruppiert: verordnung-* · abrechnung-*/rechnung-* · kalender-*/termin-* (ohne `kalender-farben.js`) · podologie-*/fuss* · Rest. Ggf. `builder` mit Gemini
  - [ ] 2.4 Wiederkehrende Inline-Stile → Klassen in `praxura-design.css`
  - Fertig je Paket: T4 alt 0 px Diff, neu folgt Token
- [ ] **3 Rahmen + Bausteine** (alles unter `[data-design="neu"]`)
  - [x] 3.1 Topbar · [ ] 3.2 Seitenleiste (Labels bleiben; eingeklappt = Icon-Leiste mit Tooltip — **/konsey**) · [x] 3.3 Panel-Kopf (Titel normal, graue Unterzeile)
  - [x] 3.4 Karten (`.card .kpi-card .settings-section`, Radius 16–20, Innenabstand 24–32, kaum Schatten) · [x] 3.5 Knöpfe (`.btn-primary/-ghost/-danger/-icon/-sm/-outline-sm/-success`: normal/hover/fokus/deaktiviert) · [ ] 3.6 Felder (`.form-*`, `.toggle-switch`, katalog-suche, patient-suche, calendar-widget)
  - [ ] 3.7 Tabellen (`.data-table .table-wrap .table-empty`, `tabular-nums`, Beträge rechts) · [ ] 3.8 Badges (`.badge-*`, `.status-dot`) · [ ] 3.9 Modale (`.modal*`) · [ ] 3.10 Tabs/Filter (`.tab-bar .tab-btn .pd-tab .filter-btn`)
  - [ ] 3.11 Banner (`.dash-banner*`) · [ ] 3.12 Leerzustände (einheitliche Optik für `.upcoming-empty .gap-empty .pd-empty .emp-day-empty .table-empty`) · [ ] 3.13 Toast · [ ] 3.14 Fokusring sichtbar · [ ] 3.15 `komponenten.html` nachziehen (hat eigenes Inline-CSS)
- [ ] **4 Übersicht** (Konzept zuerst: podoloji + /konsey; guvenlik wegen F-03)
  - [ ] 4.0 Konzept + Entscheidung (Aufbau REFERENZ §4) · [ ] 4.1 Raster (nur CSS/Hülle, IDs bleiben) · [ ] 4.2 „Praxis heute“ (aus schon geladenen Daten) · [ ] 4.3 Auslastungs-Ring (`ringStrich` aus `module/einrichtung-fortschritt.js` wiederverwenden) · [ ] 4.4 Nächste Termine · [ ] 4.5 Fristen & Hinweise (2×2 + „Alle anzeigen“ → ueberblick) · [ ] 4.6 Leistungen diesen Monat (owner; Podologie zählt `podologie_behandlungen` — neue Abfrage → db-ustasi + onprem) · [ ] 4.7 Lade/Leer/Fehler je Karte + Tests `module/uebersicht-*.test.js`
- [ ] **5 Terminkalender** — nur Optik; `layout-probe` + `render-probe` grün; Prüfliste AUFTRAG §5
- [ ] **6 Alle Bereiche** (Tabelle unten)
- [ ] **7 Abnahme** (Durchläufe bis null Funde)
- [ ] **8 Umschalten** – nur nach Melihs OK

## Arbeitspakete dieser Fortsetzung (24.10.2026)

Ausgangsprüfung auf `84920b8d`: T1 grün, `npm test` 4.071/4.071, alle 14 Browser-Probes grün. T4 159/159 ohne echte Abweichung (2 Rauschen); T5 beide Designs 0 neue Funde. Referenz ab jetzt **`vorher-vollbasis7c92`** (R-10/R-11): alle 159 Bilder vollständig mit Laufzeitdateien aus Phase-0-Commit `7c92add1` und aktuellem Harness neu erzeugt. Ursprüngliche Referenzen `vorher` und `vorher-basis7c92` bleiben erhalten. Der erste normalisierte Vergleich war grün; spätere Rasterabweichung ließ sich auch mit dem unveränderten Phase-0-Code reproduzieren. Bei Neuaufnahmen immer dieselbe Panel-Reihenfolge nutzen; Einzelpanel-Aufnahmen ändern Nummerierung und Navigationszustand.
- **3.1 Topbar — erledigt:** bestehende Höhe und Kalendergeometrie erhalten; feste neutrale Fläche, ruhige Typografie, Uhr mit gleich breiten Ziffern, Bedienelemente sauber gruppieren. Nur `praxura-design.css` + Cache-Nummer in `dashboard.html` (`20261024rd3`). T1, 4.071 Tests und Layout-/Render-Probes grün; Alt 108 Bilder = 0 abweichend / 1 Rauschen gegen frische Basis, 12 Neu-Bilder hell/dunkel × 1440/390 gesichtet.
- **3.3 Panel-Kopf — erledigt:** vorhandene `.panel-header h2` mit normalem Gewicht, 24–28 px responsiv; graue Unterzeile und klare Abstände; Texte, IDs und Aktionen unverändert. Cache `20261024rd4`. T1, 4.071 Tests, reguläre Layout-/Render-Probes grün. Alt 108 Bilder: 0 abweichend / 0 Rauschen. 16 Neu-Bilder gesichtet. Direkter Dashboard-Vergleich Alt/Neu in vier Theme-/Breitenkombinationen: Kalender-Slots, Köpfe, Topbar-Höhe und Breite identisch; Theme-Schalter und Tastaturfokus funktionieren (`geometrie-kopf.json`).
- **3.4 Karten — erledigt:** `.card`, `.kpi-card`, `.settings-section`; Radius 16 px, 24–32 px Innenabstand am Desktop, mobil platzsparend; keine Glas-Unschärfe oder schweren Schatten. Kalender-Raster und Druck-/Belegflächen aussparen. Einstellungen erhalten einen cremefarbenen Gruppenkopf; die sechs bestehenden Statistik-Karten werden bei Desktopbreite ausgewogen 3×2 angeordnet. Cache `20261024rd5`. T1, 4.071 Tests und alle 14 Browser-Probes grün. Alt 159 Bilder: 0 abweichend / 1 Rauschen / 0 fehlen; 108 Neu-Bilder gesichtet. Direkter Alt/Neu-Kalendervergleich erneut grün (`geometrie-karten.json`). Abschließender Smoke-Lauf `p3`: beide Designs, volle/leere Praxis, 1440/390; 88 bekannte Funde insgesamt, **0 neue** gegenüber `vorher`.
- **Abnahme je Paket:** T1 (IDs, Syntax, Größenlimit), `npm test`, Alt-Bilder mit 0 echten Abweichungen; Neu-Bilder hell/dunkel, 1440/390 ansehen. T3 passende Browser-Probes; abschließend T5 beide Designs.
- **Grenzen:** keine neuen Funktionen/Abfragen, keine Rollenänderung; weitere Bausteine bleiben als nächste Pakete offen. Branch-Push ausdrücklich erlaubt, Merge/Live-Prüfung weiterhin offen (F-01). Melihs Fortsetzungsauftrag ersetzt Agenten-/Skill-Verweise aus AUFTRAG/WERKZEUGE: neue Funktionen selbst in `funktionen/INDEX.json` suchen; vor DB-Themen `db/README.md` und `db/REGISTER.md` lesen; Phase-4-Daten-/Rollenfragen zuerst mit Melih klären.
- **Zusätzliche Sichtprüfung:** Impeccable-Detektor einmal ausgeführt: 0 Befunde in `praxura-design.css`, 30 heuristische Hinweise im unveränderten HTML. HTML-Diff dieser Fortsetzung ist ausschließlich die Cache-Nummer; keine daraus abgeleitete Funktions-/DOM-Änderung. Kein grünes Gesamturteil aus dem Detektor abgeleitet.

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
| R-09 | 24.10.2026 | Browser-Probes / Testserver | Barcode-Abbruchtest zunächst 38/39 | temporärer Probe-Dateiserver lieferte PDF als `application/octet-stream`, daher scheiterte Formatprüfung vor dem Abbruchpfad | behoben: Server-MIME auf `application/pdf` korrigiert; `npm run probe` anschließend alle 14 Probes grün (Barcode 39/39, Widget 55/55). Keine Produkt-/Teständerung | 1 Infrastrukturkorrektur |
| R-10 | 24.10.2026 | T4-Referenz | Vier Team-Bilder heißen `01-team.png` statt `21-team.png`; owner-leer/Team enthält alten Attendance-Fehler und hat andere Höhe | frühere gezielte Neuaufnahme mit `--panels team` änderte Nummerierung; Harness-Korrektur nicht für owner-leer übernommen | behoben: `vorher-basis7c92`, fünf Team-Bilder aus `7c92add1` mit aktuellem Harness und identischer Panel-Reihenfolge; ursprüngliches `vorher` bleibt erhalten | 0 Produktreparaturen, Referenzvergleich grün |
| R-11 | 24.10.2026 | T4 Statistik dunkel/390 | frühere Referenz zeigt abweichende Rasterung an Kartenkanten (1.425 px, 0,219 %) | frische Aufnahme des unveränderten Phase-0-Commits reproduziert exakt denselben Unterschied zur alten Referenz; Topbar-Stand ist dort pixelgleich zur frischen Basis | behoben: vollständige neue Referenz `vorher-vollbasis7c92`, keine Schwelle/Tests geändert; Topbar 108 Bilder, 0 abweichend, 1 Rauschen | 2 Nachprüfungen, 0 Produktreparaturen |
| R-12 | 24.10.2026 | zusätzliche T3-Prüfung | Legacy-Layout-Probe erwartet Tageskopf 44 px, sobald produktiver Feinschliff zusätzlich geladen wird aber Tag 0 px | `dashboard-feinschliff.css:297` blendet Einzelspaltenkopf absichtlich aus; Fehler identisch mit Feinschliff allein und mit neuem Design. Regulärer `npm run probe` bleibt grün | Prüfaufbau-Limit, kein neuer Produktfehler; direkter Alt/Neu-Geometrievergleich im Dashboard grün (`geometrie-kopf.json`), reguläre Probes grün | 1 Gegenprobe, 0 Änderungen |

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
| 24.10.2026 | E-06 Referenz nach R-10/R-11 | vollständige Neuaufnahme aus `7c92add1` mit aktuellem Harness, gleicher Panel-Reihenfolge und unveränderten Vergleichsschwellen; gültige Basis `vorher-vollbasis7c92`, Originale erhalten | Codex, technisch nachgewiesen |

## Offene Fragen an Melih
- **F-01** T6 verlangt live `app.praxura.de/dashboard.html?design=neu`. Live ist aber nur `main`. Optionen: (a) Branch-Stand nach jeder Phase nach `main` mergen (alles liegt hinter dem Schalter), (b) T6 erst beim Merge. Bis zur Antwort: Branch pushen, T6 offen lassen.
- **F-02** Für diese Fortsetzung erledigt: T4/T5 ausschließlich synthetisch, keine Zugangsdaten oder `.env`-Dateien nötig. Ein späterer echter Live-Test wird gesondert freigegeben.
- **F-03** (vor Phase 4 zuerst mit Melih klären): R-06 — Geld-Kennzahlen in der Übersicht nur owner; Statistik-Endpunkt hat keine Rollenprüfung.

## Sitzungsprotokoll
| Datum | Was erledigt | Commits | Nächster Schritt |
|---|---|---|---|
| 24.10.2026 | Fortsetzung ab `84920b8d`: Phase 1.5 erneut abgesichert, Referenz korrigiert; 3.1/3.3/3.4 fertig. T1, 4.071 Tests und 14 Probes grün; 159 Altbilder 0 echte Abweichungen, 108 Neu-Bilder gesichtet, Smoke beide Designs 0 neue Funde | `dc6365fb`, `da531d07`, `6dffd962`, `35367a07` | 3.5 Knöpfe, 3.6 Felder, 3.7 Tabellen |
| 24.10.2026 | Früherer Sitzungsstand: O-219 im Branch behoben; Phase 1.1–1.4 anschließend committet, Kontrast 7/7 | `2a683d24`, `1f096769` | danach Phase 1.5 (inzwischen erledigt) |
| 24.10.2026 | npm test 4.071 grün; Neu-Bilder hell gesichtet; Harness: attendance-Report-Antwort `{records:[]}` (Team-Fehler war Artefakt), Team-Vorher neu | `694fb0c8`, `c0fc003c` | danach 1.6 (T6 weiterhin offen) |
| 23.10.2026 | Worktree angelegt, Ausgangslage (Tests/Proben grün), Neu-Analyse, ID-Wache, Harness + Fixture + Shots + Smoke, Vorher-Läufe, Plan | `7c92add1` | anschließend Phase 1 |

## Abschlussbericht

**Zwischenabschluss 24.10.2026:** angeforderter Beginn von Phase 3 mit Topbar, Panel-Köpfen und Karten abgeschlossen, lokal getestet und einzeln committet. Dokumentation und Branch werden mit dieser Fortsetzung synchronisiert. Weitere Bausteine und die Einzelabnahme aller 27 Bereiche bleiben offen. Live/T6 ungeprüft; keine Freigabe für Merge auf `main`, Phase 4 oder Phase 8 daraus ableiten.
