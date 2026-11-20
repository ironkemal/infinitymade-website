---
titel: Dashboard-Redesign (#panel-overview) nach DESIGN.md und Überblick-Feinschliff
typ: sitzung
angelegt: 2026-11-20
tags: [sitzung, redesign, dashboard, ueberblick, ui, a11y]
---

# Dashboard-Redesign (`#panel-overview`) und Überblick-Feinschliff (`#panel-ueberblick`)

## Kontext & Auftrag
- Produktiv lief auf `app.praxura.de` weiterhin das Standard-Design (`:not([data-design="neu"])`), weil `[data-design="neu"]` serverseitig über `GET /design/entscheidung` freigeschaltet wird (`module/design-entscheidung.js`).
- Im Standard-Dashboard fielen mehrere Altlasten auf: dicke farbige `4 px`-Seitenbalken auf den Verordnungs-KPIs (`#physioRezKpi`), ein Olivgold-Verlauf auf „Freie Zeiten“, Emoji-Icons (`📅`, `📝`, `💶`, `🚗`, `👤`) plus Serifen-Überschrift in „Letzte Aktivität“ sowie unruhige Inline-Stile in `#startAufgaben`.
- Ziel: `#panel-overview` im Standard-Design ruhig, handwerklich und konsistent zum Redesign-Vertrag (`DESIGN.md`, `redesign/PLAN-V2.md`, `design/startseite.css`) umbauen — ohne `[data-design="neu"]` (`#pxStartseite`) zu verändern — und `#panel-ueberblick` (aus Phase 1: `e41c6346`, `330c288d`, `d2efd6f1`, `b4009e27`) leicht nachzuschärfen, damit beide Seiten dieselbe visuelle Sprache sprechen.

## Befunde & Entscheidungen

### 1. Dashboard-Startseite (`dashboard-start.css`, `module/start-aufgaben.js`, `module/aktivitaet-zeile.js`)
- **Architektur / Scope-Regel:** Gemeinsames bzw. Alt-Design-CSS liegt als `dashboard-start.css` im Root (wie `dashboard-feinschliff.css` und `dashboard-ueberblick.css`), da `tools/redesign-wachen.mjs` für alles unter `design/*.css` strikt `[data-design="neu"]` erzwingt. Eingetragen in `dashboard.html` (`?v=20261119start1`), `onprem/frontend.Dockerfile` und `.github/workflows/publish-frontend.yml`.
- **2-Spalten-Raster über benannte Grid-Areas:** `:root:not([data-design="neu"]) #panel-overview.active` ordnet `welcome` + `kpi` oben bündig, `today` + `tasks` links (`1.62fr`) und `rez` + `gaps` + `act` rechts (`1fr`). Dynamisch eingefügte Knoten wie `#meinUrlaub` verschieben das Raster nicht.
- **Keine Karte-in-Karte-Boxen und keine bunten Seitenbalken:**
  - `#physioRezKpi` nutzt dieselbe bündige `1 px`-Haarlinien-Leiste wie `.ubl-metric-bar`; `.rez-kpi-overdue` wird erst über `data-ueberfaellig="1"` (gesetzt in `loadPhysioRezKpis()` in `dashboard.js`) rot markiert, damit eine Null keinen Fehlalarm zeigt.
  - `.gaps-section` und `.upcoming-bookings-card` nutzen ruhige Haarlinien statt des alten Olivgold-Verlaufs oder eingerahmter Innenkästen.
  - `.schedule-today-btn` in `.gaps-header` bekam `margin-left: 0`, damit `[<] Freie Zeiten [>] [Heute]` zusammenbleiben und `[8h 0min]` rechtsbündig steht.
- **Aufgaben (`module/start-aufgaben.js`):** Inline-Stile und Text-Glyphen (`⚠`, `✕`, `✓`) durch `.sa-*`-Klassen und monochrome `1.7 px`-SVGs ersetzt; alle 16 bestehenden IDs, Button-Klassen und die Live-Knoten-Identität (`#startAufgaben`) bleiben unverändert. Auf Desktop passen Eingabe, Datum, Patient-Verknüpfung und „Hinzufügen“ in eine Zeile; Checkboxen und Löschen-Icons fluchten mit dem Kartenrand (`margin-left/-right: -9px`).
- **Letzte Aktivität (`module/aktivitaet-zeile.js` + `module/aktivitaet-zeile.test.js`):** Emoji-Zeilen aus `loadActivityFeed()` ausgelagert und durch monochrome SVGs + semantische Klassen ersetzt. `dashboard.js` schrumpfte dadurch um 34 Zeilen (`17675 -> 17641`, Baseline automatisch nachgezogen).

### 2. Überblick-Feinschliff (`dashboard-ueberblick.css`, `module/ueberblick-ansicht.js`, `module/ueberblick-listen.js`)
- **Ruhe & Konsistenz:** Dicke linke Statusbalken entfernt (ersetzt durch dezente `6 px`-Statuspunkte); Slot 5 (`Abwesenheiten`) in der KPI-Leiste einheitlich numerisch; 7-Tage-Chart mit Untergrenze `Math.max(6, ...)` (1 Termin wird kein 100-%-Balken), warmem Akzentton für `Heute` im Dark Mode statt grellem `#FFFFFF`, und vollem AA-Textkontrast an Wochenenden (`opacity` nur auf `.ubl-day-track`).
- **Mobile & `[data-design="neu"]`-Bugs behoben (per Playwright-Screenshots + Design-Critic-Review gefunden):**
  - `.ubl-tab { flex: 0 0 auto; }` verhindert Tab-Kollisionen in der horizontal scrollbaren Tab-Leiste bei `390 px`.
  - `.ubl-scope` (`height: auto; min-height: 44px`) + `.ubl-search-input` (`44 px`) auf `<= 1024 px` verhindern Höhenversatz/Überlauf der `Praxis | Meine`-Umschaltung.
  - `.ubl-row:has(.ubl-links)` stapelt mobil auch in „Nicht erschienen“ sauber statt Namen abzuschneiden.
  - `#panel-ueberblick .card.ubl-card { padding: 0 !important; }` behebt doppeltes Padding unter `[data-design="neu"]`; `:root[data-design="neu"] #panel-ueberblick .ubl-name-btn { margin-block: -12px; }` hält `44 px`-Tippflächen ohne Zeilen-Aufblähung (`86 px -> 67 px`).
  - ARIA (`role="tab"`, `aria-selected`) auf beiden Tab-Leisten ergänzt, Tippfehler „1 offener Therapiebericht“ korrigiert.

## Nachweise (lokal gemessen)
- **Commit:** `713c5429` (`feat(dashboard): Startseite nach Redesign-Vertrag und Überblick-Feinschliff`).
- **Tests & Gates:**
  - `npm run typecheck` (`tsc -p jsconfig.json`): `0` Fehler.
  - `npm run test:frontend`: `3.033 / 3.033` bestanden (inkl. neuer `module/aktivitaet-zeile.test.js` und angepasster `module/ueberblick-listen.test.js`).
  - `npm run test:tools`: `355 / 355` bestanden.
  - `node tools/redesign-wachen.mjs`, `node tools/check-select-spalten.mjs`, `bash tools/check-dashboard-size.sh`, `tools/check-namen.sh`, `node tools/funktionskarte.mjs`: alle grün.
  - Impeccable-Detektor (`impeccable detect --json` auf alle 5 geänderten UI-Dateien): `[]` (`0` Funde).
- **Browser-Probes & visuelle Prüfung:**
  - `tools/browser-probe/layout-probe.mjs`: alle Kalender- und Spaltenprüfungen grün.
  - `tools/browser-probe/v303-emoji.mjs`: `{"ok":true}`.
  - `tools/browser-probe/v602-handlungsbedarf.mjs`: `{"ok":true}` (Alt- und Neu-Design-Parität unverletzt).
  - Synthetische Playwright-Screenshots für Dashboard (Desktop Hell/Dunkel, Mobil `390 px`) und Überblick (Desktop Hell/Dunkel/`[data-design="neu"]`, Mobil `390 px`): `0` Konsolenfehler, `0 px` horizontaler Überlauf auf Desktop und Mobil.

## Offen
- Live-Sichtprüfung auf `app.praxura.de` nach Vercel-Deploy (inkl. belegter Tagesansicht im Kalender und Aufgaben-Interaktion mit echten Praxisdaten).

## Lernpunkte
- **Visuelle Mobile-Screenshots fangen Flex-Fallen ab, die kein Unit-Test sieht:** Ohne `flex: 0 0 auto` kollabieren `white-space: nowrap`-Tabs mit `min-width: 0` in horizontal scrollbaren Leisten auf `390 px`; ebenso deckten die Screenshots sofort `.cal-emp-chips { flex: 1 }` aus `dashboard.css` und `.schedule-today-btn { margin-left: auto }` auf.
- **Zero-State-Alarm vermeiden:** Eine rote `0` auf „überfällig“ signalisiert fälschlich Dringlichkeit — semantische Warnfarbe nur über explizites Daten-Attribut (`data-ueberfaellig="1"`) bei Werten `> 0` setzen.
