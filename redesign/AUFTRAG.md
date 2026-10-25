# AUFTRAG: Praxura-Redesign (für Claude Code)

> **Ab 25.10.2026 gilt `redesign/PLAN-V2.md`** (Melihs OK): Ziel, Phasen (V0–V10), Entscheidungen E1–E10 und Stopp-Punkte stehen dort und gehen dieser Datei vor. Weiter gültig aus dieser Datei: Schleife 3.3, Teststufen (Abschnitt 6), Reparatur-Regeln, Kontext sparen (8), Pflichten (10). Fortschritt nur in `redesign/STATUS.md` (Paketliste).

> **Start-Satz für Melih im Terminal:**
> `Lies redesign/AUFTRAG.md und führe den Auftrag vollständig aus: analysieren, planen, bauen, testen, reparieren – bis redesign/STATUS.md komplett erledigt ist.`
>
> **Weitermachen in einer neuen Sitzung:**
> `Lies redesign/AUFTRAG.md und redesign/STATUS.md und mach beim nächsten offenen Punkt weiter.`

---

## 0. So liest du diesen Auftrag

1. Lies in dieser Reihenfolge: `CLAUDE.md` (ganz) → diese Datei → `redesign/REFERENZ.md` → `redesign/WERKZEUGE.md` → `redesign/STATUS.md`.
2. Das Bild `redesign/referenz/quicken-dashboard-mobbin.png` darfst du ansehen. Es ist lizenziert (Mobbin) und **gitignored**. Nie committen, nie kopieren, nie in eine ausgelieferte Datei einbinden.
3. `CLAUDE.md` geht immer vor. Ausnahmen, die Melih **hier ausdrücklich freigibt**:
   - Du darfst die Projekt-Agenten aus `WERKZEUGE.md` **ohne Rückfrage** aufrufen, auch `builder` und `/konsey`, und die eingebauten Subagenten (Explore, Plan, general-purpose).
   - Du darfst nach jeder **abgeschlossenen** Phase oder jedem fertigen Bereich auf `main` pushen, weil alles hinter dem Design-Schalter liegt (Abschnitt 4).
4. `redesign/STATUS.md` ist **dein Gedächtnis**. Was dort nicht steht, ist für die nächste Sitzung verloren.

## 1. Ziel und Fertig-Definition

**Ziel:** Alle 27 Bereiche von `dashboard.html` bekommen die neue Optik nach `REFERENZ.md` (kühles Grau, weiße Karten, Praxura-Akzent). Code, Funktionen, Supabase, Backend und Datenbank bleiben dieselben. Es wird **umgestaltet, nicht neu gebaut**. Die Übersicht bekommt zusätzlich neue Kennzahlen (auch mit neuen Abfragen).

**Fertig ist es erst, wenn alles stimmt:**
- [ ] Jede Zeile in `STATUS.md` ist ✓ (alle Phasen, alle 27 Bereiche mit allen Prüfspalten).
- [ ] Teststufen T1–T5 grün, T6 (live mit `?design=neu`) ohne neue Fehler.
- [ ] Ohne Schalter sieht und verhält sich die App **genau wie vorher**.
- [ ] Fehlerbuch in `STATUS.md` hat keinen offenen Eintrag.
- [ ] Abschlussbericht für Melih steht in `STATUS.md`.
- [ ] Phase 8 (neues Design als Standard) **nur nach Melihs OK**. Bis dahin ist „fertig“ = bereit zum Umschalten.

## 2. Feste Entscheidungen von Melih (nicht neu diskutieren)

1. Mit Kemal abgesprochen. Kemals `dashboard-feinschliff.css` (20.–21.10.2026) ist die Basis, wir überschreiben darüber.
2. Umfang: **alle Bereiche**.
3. Farben: **kühles Hellgrau + weiße Karten + Praxura-Akzent** (Espresso/Bronze), Werte in `REFERENZ.md`.
4. Die Übersicht darf **neue Kennzahlen mit neuen Abfragen** bekommen.

## 3. Der Arbeitsablauf (die Schleife)

### 3.1 Start jeder Sitzung
1. `git status` prüfen. Fremde, nicht gespeicherte Änderungen **nicht anfassen und nie mitcommitten**. Immer nur eigene Dateien einzeln mit `git add <pfad>` aufnehmen.
2. `git pull --rebase` (Kemal arbeitet parallel auf `main`). Sicherstellen: `git config core.hooksPath .githooks`.
3. `STATUS.md` lesen und den nächsten offenen Punkt nehmen.

### 3.2 Erste Sitzung: Analyse neu machen und Plan schreiben
Die Zahlen in `REFERENZ.md` stammen vom 23.10.2026 und können veraltet sein. **Prüfe sie selbst neu**, mit dem Subagenten *Explore*, damit dein Kontext klein bleibt:
- alle Panels (`id="panel-…"` in `dashboard.html`) mit Rollen/Gruppen aus `nav-registry.js` und Fachbereich-Sichtbarkeit,
- feste Farben (Hex/rgb) je Datei in `dashboard.js`, `module/*.js` (ohne Tests), `dashboard.html`, Inline-`style=`,
- Klassen und IDs, die JS abfragt oder setzt,
- welche Daten die Übersicht schon lädt (über `fonksiyon-ustasi`),
- Ausgangslage: `npm test`, `npm run probe` (vorher schon rote Tests notieren, nicht als deine Fehler zählen).

Dann den **Plan in `STATUS.md`** konkret machen: jede Phase in kleine Arbeitspakete zerlegen, jedes mit „fertig, wenn …“. Für Entscheidungen mit echten Alternativen (Aufbau der Übersicht, Seitenleiste) `/konsey` nutzen.

### 3.3 Die Schleife pro Arbeitspaket
```
WIEDERHOLE für jedes offene Paket in STATUS.md:
  1. ANALYSE   – betroffene Dateien, IDs, Klassen, Abhängigkeiten lesen.
                 Vorher die Pflicht-Agenten fragen (WERKZEUGE.md, Abschnitt "Wann Pflicht").
  2. PLAN      – 3–8 Zeilen im Paket in STATUS.md: was genau, welche Dateien, wie getestet.
  3. BAUEN     – kleinste Änderung, die das Paket erfüllt.
  4. TESTEN    – Teststufen aus Abschnitt 6, die zum Paket passen (immer mindestens T1+T2).
  5. REPARIEREN – bei Fehler: Ursache finden → beheben → zurück zu 4.
                 Höchstens 3 Versuche pro Fehler. Danach: Änderung zurücknehmen,
                 Fehler ins Fehlerbuch, Paket als "blockiert" markieren, nächstes Paket.
  6. PRÜFEN    – eigenen Diff lesen (Skill engineering:code-review, falls vorhanden).
                 Im Browser ansehen: hell + dunkel, mit und ohne ?design=neu.
  7. COMMIT    – kleine Commits, z. B. "feat(design): Karten-Optik Patienten".
  8. STATUS    – Paket abhaken, Funde, Messwerte, nächster Schritt.
ENDE einer Phase: T1–T5 komplett → Push (Vordergrund, Hauptkontext) → T6 mit canli-test.
                  Neue Fehler aus T6 → als Pakete in STATUS.md → Schleife.
```

### 3.4 Die Abschluss-Schleife
Wenn alle Pakete ✓ sind: **kompletter Durchlauf** T1–T6 über alle 27 Bereiche. Jeder Fund wird ein neues Paket → Schleife 3.3 → wieder kompletter Durchlauf. **Wiederholen, bis ein kompletter Durchlauf null Funde hat.** Dann Abschlussbericht in `STATUS.md` und Melih fragen wegen Phase 8.

**Hör nicht vorher auf.** Eine Sitzung endet nur an einem Stopp-Punkt (Abschnitt 9) oder wenn der Kontext knapp wird (Abschnitt 8). Auch dann: `STATUS.md` aktuell, alles committet.

## 4. Technischer Ansatz (verbindlich)

1. **Neue Datei `praxura-design.css`**, in `dashboard.html` direkt **nach** `dashboard-feinschliff.css` geladen. In `dashboard.css` und `dashboard-feinschliff.css` wird nichts umgeschrieben. Kopfkommentar im Stil von `dashboard-feinschliff.css`: warum, woher die Farben, und bei jedem `!important`, wogegen es steht.
2. **Design-Schalter:** Im vorhandenen Inline-Script im `<head>` von `dashboard.html` (dort, wo `im-theme` gelesen wird) wird `<html data-design="neu">` gesetzt, wenn `?design=neu` in der URL steht (dann `localStorage` `px-design='neu'` merken) oder `px-design==='neu'` gespeichert ist. `?design=alt` löscht es. `localStorage` immer in try/catch.
   - **Spezifität:** `dashboard-feinschliff.css` nutzt `:root:not([data-theme="dark"])` (0,2,0). Darum hier `:root[data-design="neu"]:not([data-theme="dark"])` und `:root[data-design="neu"][data-theme="dark"]` (0,3,0). Komponenten-Regeln mit `[data-design="neu"] .klasse`.
3. **Variablen zuerst:** Die vorhandenen Variablennamen (`--bg-main`, `--primary` usw.) bekommen neue Werte. Neue Rollen bekommen neue Variablen in `praxura-design.css`.
4. **Feste Farben** in JS/HTML werden durch `var(--name, ALTER_WERT)` ersetzt. Der alte Wert bleibt als Fallback, damit das alte Design gleich bleibt.
   - **Nicht ersetzen**, wo JS mit dem Wert rechnet (Alpha angehängt wie `${c}22`, Canvas, PDF/Druck, aus Daten gelesene Farben), sowie `module/kalender-farben.js`, Belege, Rechnungen, Druckansichten, E-Mail-Vorlagen. Im Zweifel stehen lassen und in `STATUS.md` notieren.
   - Wiederkehrende Inline-Stile werden zu Klassen in `praxura-design.css`.
5. **`dashboard.js` wird keine Zeile länger** (`tools/check-dashboard-size.sh`). Ersetzungen erfolgen in derselben Zeile. Neue Logik kommt nur in `module/uebersicht-*.js` (+ `*.test.js`), angebunden mit einer `import`-Zeile **ohne Netto-Zuwachs**.
6. **IDs sind heilig.** In Phase 0: `tools/redesign-id-baseline.txt` (alle `id="…"` aus `dashboard.html`) und `tools/check-redesign-ids.mjs` (jede Baseline-ID muss noch existieren). Elemente dürfen verschoben und neu verpackt werden, aber nie umbenannt oder gelöscht. Das Gleiche gilt für Klassen, die JS abfragt oder setzt.
7. **Diagramme** mit eigenem SVG. Keine neue Bibliothek, kein CDN (G8).
8. **Bestehende Bausteine stylen, nicht ersetzen:** `nav-registry.js`, `katalog-suche.js`, `patient-suche.js`, `calendar-widget.js`, `bestaetigungs-dialog.js`, Modale.
9. **Cache-Nummer** `?v=` für jede geänderte CSS/JS-Datei neu setzen, nie wiederverwenden.
10. **Neue Abfragen** (nur Übersicht): erst prüfen, ob die Daten schon geladen sind. Supabase-Client mit RLS, Patiententabelle heißt **`leads`**, optionale Lookups mit `.maybeSingle()`, vorher `db/README.md` lesen. Neue RPC oder View nur über den Migrations-Weg (Datei `api-backend/db/migrations/NNNN_…sql` → `db/SCHEMA*.sql` tazeleme im selben Commit → `db/REGISTER.md` → **live erst nach Melihs OK**). Geld-Kennzahlen **nur für `owner`**. Jede Karte hat Lade-, Leer- und Fehlerzustand.
11. **Nicht anfassen:** öffentliche Seiten (`index.html`, `booking*.html`, Landingpages), Backend-Logik, Edge Functions, §302-Logik.

## 5. Phasen (Startgliederung, in `STATUS.md` verfeinern)

| Phase | Inhalt | Fertig, wenn … |
|---|---|---|
| 0 Vorbereitung | Neu-Analyse (3.2), ID-Baseline + Check, Screenshot- und Smoke-Werkzeuge (Abschnitt 6), Vorher-Screenshots, Plan in `STATUS.md` | Ausgangslage dokumentiert, Werkzeuge laufen |
| 1 Variablen + Schalter | `praxura-design.css`, Schalter, Farbwerte, Kontrast-Prüfung | mit `?design=neu` alles lesbar, ohne Schalter unverändert |
| 2 Feste Farben | Hex/rgb → `var(--…, alt)` in JS/HTML/Modulen | T4: altes Design pixelgleich, neues folgt den Variablen |
| 3 Rahmen + Bausteine | Seitenleiste (Labels bleiben; eingeklappt = schmale Icon-Leiste mit Tooltip), Topbar, Panel-Kopf, Karten, Knöpfe, Felder, Tabellen, Badges, Modale, Tabs, Banner, Leerzustände; `komponenten.html` nachziehen | Bausteine überall gleich |
| 4 Übersicht | Karten-Raster + neue Kennzahlen (`REFERENZ.md` Abschnitt 4), Konzept vorher mit `podoloji` + `/konsey` | alte Funktionen laufen, neue Karten mit Lade-/Leer-/Fehlerzustand |
| 5 Terminkalender | Kemals Kalender-Aufbau bleibt, nur neue Optik; Geometrie (Zeilenhöhen, Spalten, `--sidebar-w`) unverändert | Kalender-Probes grün; Tag/Woche/Monat, Mitarbeiter-Spalten, Drag & Drop, anlegen/ändern/absagen, Serien, Kontextmenü, Heute-Linie, Hinweise ok |
| 6 Alle Bereiche | Reihenfolge in `STATUS.md`. Pro Bereich alle Prüfspalten | jede Bereichszeile ✓ |
| 7 Abnahme | Abschluss-Schleife 3.4 | ein Durchlauf ohne Funde |
| 8 Umschalten | Standard = neu, `?design=alt` eine Woche als Notausgang, danach aufräumen | **nur nach Melihs OK** |

## 6. Teststufen

| Stufe | Was | Wann |
|---|---|---|
| **T1 Statisch** | `sh tools/check-syntax.sh`, `sh tools/check-dashboard-size.sh`, `node tools/check-redesign-ids.mjs`, Pre-commit-Hook | jedes Paket |
| **T2 Unit** | `npm test` (nicht schlechter als die Ausgangslage) | jedes Paket |
| **T3 Probes** | `npm run probe` oder die passende Einzel-Probe | jedes Paket mit Layout-Bezug, jede Phase |
| **T4 Bilder** | Baue `tools/redesign-shots.mjs` (Playwright, `node dev_server.cjs`, Login mit QA-Konto aus `.env.local` wie `qa_credentials.py`). Alle Panels × hell/dunkel × 1440/390 px × alt/neu. Bilder nach `.redesign-shots/` (gitignored). Vergleich alt-vorher gegen alt-nachher mit Pixel-Diff (`pixelmatch` als devDependency ist ok). Neu-Bilder selbst ansehen und mit `REFERENZ.md` vergleichen | jede Phase, jeder Bereich |
| **T5 Funktion** | Baue `tools/redesign-smoke.mjs`: jedes Panel öffnen, Konsole und Netzwerk auf Fehler prüfen, ungefährliche Knöpfe, Filter, Tabs, Modale öffnen/schließen, Formular füllen + abbrechen. Als Inhaber **und** als Mitarbeiter | jeder Bereich, jede Phase |
| **T6 Live** | Nach Push: `canli-test` auf `app.praxura.de/dashboard.html?design=neu` (Deploy angekommen? Konsole sauber? Bereich bedienbar?). Sicil `canli-test/REGISTER.md` fortschreiben | Phasenende |
| Zusätzlich | `mobil-ui` für 390 px (nur CSS-Fixes), Barrierefreiheit (Kontrast ≥ 4,5:1, Fokus sichtbar, Tastatur) | jeder Bereich |

**Verbotene Testaktionen** (die App hängt an der echten Datenbank): keine §302-Abrechnung senden oder freigeben, kein Stripe/Zahlung, keine E-Mail/SMS an echte Empfänger, keine DSGVO-Löschung/-Sperre, nichts in echten Praxen. Schreibende Tests **nur im QA-Testkonto**, und selbst angelegte Testdaten am Ende wieder entfernen (über die App, nicht per SQL).

### Reparatur-Regeln
- Erst die **Ursache** finden (Skill `engineering:debug`, falls vorhanden), dann beheben. Nicht raten.
- **Nie** einen Test löschen, abschwächen oder überspringen, um grün zu werden. Nie `SKIP_*`-Variablen ohne Melihs OK.
- Nach 3 erfolglosen Versuchen: zurücknehmen (`git restore`/`git revert`), Fehlerbuch-Eintrag mit Ursache-Vermutung, weiter mit dem nächsten Paket.
- Fehler, die nicht vom Redesign kommen: ins Fehlerbuch als „vorbestehend“ und als Ops-Karte (Kategorie Teknik), **nicht** im Redesign mitreparieren.

## 7. Agenten, Skills, Subagenten

Alles steht in `redesign/WERKZEUGE.md`. Kurzfassung der **Pflichten**:
- vor jeder neuen Funktion/Datei → `fonksiyon-ustasi` fragen, danach „niye + nerede“ melden, `node tools/funktionskarte.mjs` tazelen
- vor jeder Abfrage, RPC, Tabelle → `db-ustasi` + `onprem`
- neue Kennzahl mit Patienten- oder Geld-Daten → `guvenlik`
- Übersicht-Konzept, Podologie-Bereiche → `podoloji`
- jeder fertige Bereich → `mobil-ui`; jede Phase nach Push → `canli-test`
- echte A-oder-B-Entscheidung → `/konsey`

## 8. Kontext sparen

- Breite Suchen und Inventare an den Subagenten *Explore* geben, nur das Ergebnis zurückholen.
- Nur der Hauptkontext ändert gemeinsame Dateien (`dashboard.html`, `dashboard.js`, `praxura-design.css`). Subagenten analysieren oder arbeiten an getrennten Dateien. Nie zwei Bearbeiter gleichzeitig an derselben Datei.
- Nach jedem Paket ist `STATUS.md` so aktuell, dass eine neue Sitzung ohne Vorwissen weitermachen kann. Wird der Kontext knapp: alles committen, `STATUS.md` aktualisieren, `/compact`, dann mit `STATUS.md` weiter.

## 9. Stopp-Punkte: anhalten und Melih fragen
- Live-Datenbank-Änderung (Migration anwenden)
- etwas soll gelöscht werden (Datei, ID, Funktion, Tabelle, Testdaten außerhalb des QA-Kontos)
- das **Verhalten** einer Funktion würde sich ändern (nicht nur die Optik)
- Konflikt mit Kemals Änderungen, der nicht eindeutig lösbar ist
- ein Sicherheits- oder Rechts-Veto (`guvenlik`, `legal-de`, `gkv-302`, `onprem`)
- Phase 8 (Umschalten)

Sonst: selbstständig weiterarbeiten.

## 10. Pflichten nebenbei
- `fortschritte/JJJJ-MM-TT.md`: eine Datei pro Tag, Arbeit dort ergänzen (`fortschritte/REGELN.md`).
- Neue offene Punkte → Ops-Dashboard (`ops/tools/ingest.mjs`), Kategorie Teknik.
- Keine Kunden-/Beta-Namen (Rumuz `Beta-1`/`Beta-2`). Oberfläche nur Deutsch, Texte in `T.de`. Kein `<datalist>`.
- Neue Ordner: in `.vercelignore` prüfen (`.redesign-shots/` und `redesign/` stehen schon drin).
- Push nur im Vordergrund im Hauptkontext. Live-Fehler: `git revert` + Push.

## 11. Ende jeder Sitzung
`STATUS.md` aktuell (Stand, nächster Schritt, offene Fragen) → alles Eigene committet → kurze Zusammenfassung für Melih: was fertig, was als Nächstes, wo du ihn brauchst.
