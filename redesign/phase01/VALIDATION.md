# Aktuelle Prüfung — 10.11.2026

## Tatsächlich ausgeführt

- `git fetch`, `git status -sb`, `git worktree list --porcelain`: vorbereiteter Arbeitsbranch sauber vor Beginn; Quellenpins frisch. Original-main fünf Commits vor origin/main, fremde Änderungen ausgeschlossen. Kein Pull/Rebase auf bewegtem Original.
- Impeccable `context`: erfolgreich. Fehlende PRODUCT/DESIGN dokumentiert; bestätigte Nutzerangaben übernommen, kein neues Interview. Kein UI-Edit, deshalb craft-floor/Detector noch nicht anwendbar.
- `agy-context --local-only`: lokale V803/V804-Evidenz, `provider_invoked: false`. Kein Gemini-/anderer kostenpflichtiger Provideraufruf. Keine gemessene Nettoersparnis.
- Python-Struktur-/Hashprüfung: 44 private Quelldateien und vorhandene Patches SHA256 korrekt; Snapshotverzeichnis 0700, Quelldateien 0600. 12 aktuelle Designhashes korrekt. Beide Original-HEAD-Pins nach Erstellung unverändert.
- Inventarprüfung: 464 eindeutige Typ/ID-Paare; 27 Panelzeilen und 42 Modulzeilen; jede Zeile enthält Quelle, Ziel, Lücke, Scope, Zustände, Besitzer/Welle, Verfahren und Status. Dies beweist Struktur, keine fachliche Vollständigkeit.
- `git diff --check` und `git diff --cached --check`: bestanden. Selektiver Commit mit `core.hooksPath=.githooks` erfolgreich (Exit 0); keine Gate-Skips. Hash-/Inventarchecks nach Reviewkorrektur erneut bestanden. Abschließendes `git fetch` erfolgreich, Arbeitsbranch nach Dokumentcommit sauber.

## Unabhängiger Review

Enger nativer qa-code-review abgeschlossen: Dokumente und gezielte Inventarstichprobe, read-only. Zwei gelbe Befunde: zu breite Kartenunion als Transferziel und Tabellenklassen durch unscharfe tab-Suche. Lokal korrigiert: Modulziele ausdrücklich ungeprüfte Kandidaten mit separatem candidate_panels-Feld; statische Erfassung unterscheidet Form/Dialog/Tab und Kandidaten, trägt parent_view und entfernt Tabellenfehlmatches. 349 statt 392 statische Kandidaten, insgesamt 464 Zeilen. Reparatur selbst strukturell geprüft, kein erneuter unabhängiger Review. Kein Produkt-/UI-Review daraus ableiten.

## Bewusst nicht ausgeführt

Keine Produkt-/Browser-/Pixel-/Fokus-/Mobil-/Fullsuiteprüfung, weil keine UI/Fachfunktion verändert wurde. Kein Live-/Login-/DB-/RLS-/Schreibnachweis. Keine historischen V803/V804/V9/V10-Zahlen als neue Tests. Eltern-VM-Fälle nicht selbst ausgeführt und nicht gezählt. Keine Vollständigkeitsbehauptung für dynamische Unteransichten.

## Offene Gates

Fünf fehlende Moduldateien ohne Karten-UI-Pfad (Ergänzungsmitbuchung, Formular-PDF, Signaturanbindung, Logo-Upload, Erinnerungs-Einstellung) gezielt anbinden. 349 statische Kandidaten enthalten auch Wrapper/Backdrop-/Tab-Elemente; echte Unteransichtengrenzen deduplizieren. 36 dynamische Kandidaten auf Laufzeiterreichbarkeit prüfen. Fehlende vollständige Sicherung der Token-WIP-Datei vor Transfer klären. Danach P01-REP und aktuelle repräsentative Ansichtennachweise.

## P01-REP CSS-Zwischenkandidat

Produktdiff und genaue Befehle/Ergebnisse: P01-HANDOFF.md. 24 passende Scope-/Kontrasttests bestanden; 60 aktuelle Panelprüfungen, 12 pixelgleiche Alt-Vergleiche, isolierter Anamnese-Schreibfehler mit erhaltenem Input. Rohdaten und Bilder evidence/p01/. Unabhängiger Review und vollständige Phase-1-Abnahme offen.

## P01-START

Befehle, Identitäts-/Fehler-/Rückkehrbelege und Grenzen: P01-START-HANDOFF.md, Rohdaten evidence/p01-start/. Zusätzlicher Elternbeleg für Kalender-Touchziele evidence/calendar-targets/README.md. Unabhängiger Review ausstehend.

## P01-SHELL-HOOK (10.11.2026, integrierter Lauf)
Shell-Adapter in dashboard.js eingehängt (nach Auth/Profil/Scope, nur bei `data-design=neu`, zeilenneutral) plus `design/shell.css` in dashboard.html. Probe `physio-demo-p01.mjs` (P01_OUT=integrated-final): 28 Einträge; 0 Fremdrequests/Writes/WebSockets; kein Layout-Überlauf; Alt-Pixelvergleich 390/1440 hell/dunkel identisch. Einziger Seitenfehler im Szenario „langsam": `loadAnamnese` (`module/anamnese.js:280`, `d` noch nicht initialisiert, weil Probe das Panel vor Ende von init öffnet). Tritt ohne Shell-Hook identisch auf, also Bestand, kein Shell-Befund; offen als eigener Punkt. Probe wartet nun auf `attached` statt `visible` (Schublade ist mobil geschlossen). Bilder 1440 hell Start und 390 dunkel Kalender gesichtet. Offen: Pixelkante Neu→Alt ab 1025 px, Aktivierung nur fürs Physio-Testkonto, unabhängiger Review, echte Geräte.

## P01-SHELL-REVIEW (10.11.2026)
Unabhängiger Review (6 Befunde, 0 kritisch). Behoben: WeakMap statt Map (Speicher), try/catch um Shell-Hook (Adapterfehler darf init nicht abbrechen), Menüaktion gibt Fokus zurück; Cache-Nummer p01shell2. Shell-Probe nach Fix: erster Lauf einmal Pixelabweichung bei „Mount auf Alt" (Rauschen, nicht reproduziert), zweiter Lauf 16/16 funktional grün. Integrierte Probe: nur der bekannte `loadAnamnese`-Race im Szenario langsam. **Offen (nicht behoben, nicht browserverifiziert):** Fokus geht nach Navigationsklick (mobile Schublade, Desktop-Flyout) auf body; bei offener mobiler Schublade bleiben Kopfleistenelemente (Suche, Neu, Profil) nicht inert.

## P01-SHELL-FIX2 (11.11.2026)
Behoben (vorher offen): Kopfleiste (`.topbar-right`, Suche, Standortwechsler) bei offener mobiler Schublade `inert`, Ursprungswerte per WeakMap wiederhergestellt; Fokus nach Navigationsklick (Schublade und Desktop-Flyout) landet auf aktivem Eintrag/Menüknopf statt `body`. Probe um drei Zusicherungen erweitert (Kopf inert, Kopf wiederhergestellt, Fokus nach Navigation); 16/16 funktional grün, Cache `p01shell3`. Hinweis: Der neue Navigationsschritt der Probe verändert den Zustand vor dem Neu→Alt-Kontrollvergleich, daher listet `dynamicControlMismatches` zusätzlich 390/1024 (Owner). Ohne diesen Schritt (Vergleichslauf) bleiben die Abweichungen wie bisher auf ≥1025 px begrenzt. Pixelkante weiter offen, nicht browserverifiziert auf echten Geräten.

## P01-PROBE-INIT (11.11.2026)
Der `loadAnamnese`-Fehler im Szenario „langsam" war ein Probenfehler: Die Probe öffnete Panels, bevor `init` fertig war (`#app` noch versteckt; in der echten App unerreichbar). Probe wartet jetzt auf sichtbares `#app`. Volllauf `physio-demo-p01.mjs` mit Shell: 0 pageErrors, 0 Fences, alle Zusicherungen grün, Alt pixelgleich. Damit ist der frühere „Bestandsfehler" kein offener Punkt mehr.

## P02-AKTIVIERUNG (11.11.2026) — KORREKTUR + Phase 2 lokal
**Korrektur:** Commit `ae311aee` (Review-Fix) hat den `montiereShellansicht`-Aufruf aus `dashboard.js` versehentlich gelöscht (leerer `try {}`); `7eed0449` und `57fb2043` waren daher ohne Shell, die dortigen Probenläufe zählen nicht als Shell-Nachweis (die Probe prüfte Shell-Präsenz nicht). Behoben; neue Absicherung: `physio-demo-p01.mjs` assertiert `data-px-shell=v2`, Quellwache in `module/design-entscheidung.test.js`. Frische Läufe nach Reparatur: Integrierte Probe voll grün (0 Fehler, Alt pixelgleich), Shell-Probe 16/16, Anamnese 4/4, Kalender-Touchziele 6/6.
**Phase 2 (lokal, nicht deployed):** Neues Design nur noch nach Entscheidung: `?design`/localStorage = Wunsch; lokale Vorschau nur bei `/api/config designVorschau:true` (nur `dev_server.cjs`); sonst `GET /api/design/entscheidung` (Env-Pilot, fail-closed). Tests: Backend 2/2, Modul 6/6, Browser `p02-aktivierung.mjs` (A02 nicht freigegeben/gespeichert Neu → Alt, A03 freigegeben → Neu mit genau einem Shellstart, A08 500/403/JSON/Typ/Abbruch → Alt, A10 explizit Alt, A18 Vorschau nur mit Flag, A20 Bearer ohne Parameter in URL). Nicht geprüft: A04–A07, A09, A12, A14–A17, A19 (Backend-Test deckt Mandant vom Client ignoriert ab), A21–A22, echte Auth/Live. Env noch nirgends gesetzt; Aktivierung im SaaS braucht eigenes GO.

## P03–P06-CSS (11.11.2026) — Seiten- und Verwaltungs-CSS übernommen
`design/seiten.css` (Arbeitsstand inkl. V7.03-Abschlussregel) und `design/verwaltung.css` (Commit 7fcc1b37 des Design-Worktrees) übernommen, in `dashboard.html` nach `startseite.css` eingebunden (Cache p3); Scope/!important-Wache grün. Smoke T5 über alle Panels, Owner+Employee, 1440/390, hell, Szenario voll, Neu gegen Alt: 64 vs 66 Funde, keine neuen Überläufe/Konsolenfehler/Erreichbarkeitsfunde. Als „neu" markiert nur die Fixture-Schreibversuchszeile: Neu 9 statt 6 `document_vorlagen.insert`, Alt 3 `user_preferences.upsert` (Fixture fängt Schreibwege ab; Auto-Seed des Vorlagenpanels, Bestandsverhalten, kein Produktwrite). Sichtprüfung: Verordnungen 1440, Einstellungen 1440, Rechnungen 390 (konsistent, Tabelle mobil horizontal scrollbar im Container). Harness wartet jetzt auf `#app` statt sichtbare Sidebar. Nicht geprüft: dunkel, die übrigen Panels einzeln gesichtet, Fachbereich Ergo/Logo, Gefüllt-/Langtext-Zustände, echte Daten. `tools/redesign-shots.mjs` läuft hier nicht (pixelmatch/pngjs fehlen im verlinkten node_modules).

## P07-FACHBEREICHE (11.11.2026)
Smoke T5 dunkel, Owner+Employee, 1440/390, Szenario voll, Neu gegen Alt, je Fachbereich per `REDESIGN_SEKTOR` (physiotherapy, ergotherapie, logopaedie; Podologie hell siehe P03–P06): Konsolenfunde 52 = 52 (Bestand), Erreichbarkeit 6 = 6 (Bestand, Employee ohne Panelrechte), Überlauf Neu ≤ Alt (Physio Alt 4 / Neu 2, Ergo/Logo je 2/2), Fixture-Schreibversuche identisch (Auto-Seeds, Writes gefangen). Keine neue Fundkategorie. Nicht geprüft: Fachbereichsfelder inhaltlich (Fachabnahme physio/podoloji nicht eingeholt), Interdisziplinär, Gefüllt-/Langtextzustände, Employee-Rechteprofile jenseits des Fixture-Employee.
