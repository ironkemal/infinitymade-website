# STATUS v2: Praxura-Redesign

> Gedächtnis des Dauerlaufs. Plan: `redesign/PLAN-V2.md` (Melihs OK 25.10.2026). Regeln: `redesign/AUFTRAG.md` (Schleife 3.3, Tests, Reparatur) mit den Abweichungen aus PLAN-V2 §2/§7. v1-Verlauf (Phasen 0–4 alt, Messwerte, Entscheidungen bis 24.10.): `redesign/STATUS-V1.md`.
> **Diese Datei nach JEDEM Schritt aktualisieren.** `node tools/redesign-status-check.mjs` prüft sie (T1).

## 0 Kurzzustand
- Branch `redesign/praxura-design` · Worktree `~/.t3/worktrees/infinitymade-website/redesign-praxura-design` · Haupt-Checkout nie anfassen
- Letzter grüner Stand: `0a63ce0f` (v1, rd16) · npm test 4.071 grün · Alt 159 Bilder 0 ✗ gegen `vorher-vollbasis7c92`
- Aktuelles Paket: V0.07 · Schritt: ANALYSE
- Nicht committete eigene Dateien: keine
- Cache-Nummern: praxura-design.css ?v=20261024rd16
- Gültige Referenzen: alt=`alt-main-6fd0cce` (aus `origin/main` 6fd0cce3, Basis `.redesign-shots/_basis/6fd0cce`; bei neuem main: `node tools/redesign-basis.mjs` + Lauf mit `--wurzel`) · neu=noch keine (wird nach V3 eingefroren)
- Wartet auf Melih: nichts
- Nächstes Paket: V0.07

## 1 Geltende Regeln (Kurzfassung, Details PLAN-V2 §2, §7, §9)
- Melihs Entscheidungen E1–E10 (PLAN-V2 §2). Stopp-Punkte nur PLAN-V2 §7. Bei Stopp: hier „Wartet auf Melih“ setzen, betroffene Pakete `wartet-Melih`, unabhängige weiter.
- 1 Paket = 1 Schleifendurchlauf = 1 Produkt-Commit (STATUS im selben Commit; Commit-Spalte „dieser Commit“, wird im nächsten Paket durch den SHA ersetzt).
- T1 **nach** `git add`: `sh tools/check-syntax.sh`, `sh tools/check-dashboard-size.sh`, `node tools/check-redesign-ids.mjs`, `node tools/redesign-status-check.mjs`, `node tools/redesign-wachen.mjs` (Scope, `!important`, Cache, Auslieferung, Schrumpf). T2 `npm test`. T4 Alt-Vergleich gegen gültige alt-Referenz = 0 ✗. Neu-Bilder ansehen.
- Gemeinsame Dateien (`dashboard.*`, `praxura-design.css`, `design/*`, `STATUS.md`) nur mit Edit ändern. Kein `sed -i`, kein Skript-Überschreiben, kein `open(p,'w')` vor dem Lesen. Nach jeder Änderung `git diff --numstat`.
- Pro Fehler max. 3 Versuche, danach zurücknehmen, Fehlerbuch, nächstes unabhängiges Paket.
- Nach jeder Phase: `origin/main` einmergen, T1–T5 auf dem Ergebnis, Push `main` (Vordergrund, Hauptkontext), T6 `canli-test` mit `?design=neu`.
- Pflicht-Agenten je Paket: PLAN-V2 §6.

## 2 Paketliste (einzige Quelle für Fortschritt)
Status: offen · in Arbeit · blockiert · wartet-Melih · fertig. Pakete ab V3 werden zu Phasenbeginn verfeinert (Zeilen ergänzen, nicht umnummerieren).

| ID | Phase | Titel | Typ | Wirkbereich | hängt ab | Status | Commit | Nachweis | Versuche |
|---|---|---|---|---|---|---|---|---|---|
| V0.01 | V0 | STATUS v2 + `tools/redesign-status-check.mjs` | Werkzeug | Doku | – | fertig | 32fa0183 | status-check grün | 0 |
| V0.02 | V0 | Shots: Bildnamen nach globaler Panel-Reihenfolge, kein stilles Überschreiben, „neu in B“ melden | Werkzeug | T4 | V0.01 | fertig | f6587dd9 | `v002alt` 159 Bilder 0 ✗ / 2 ⚠ gegen `vorher-vollbasis7c92`; Überschreiben verweigert; Teillauf `v002teil` = 04/17 | 0 |
| V0.03 | V0 | Harness `--wurzel` + Alt-Referenz aus `origin/main` | Werkzeug | T4 | V0.02 | fertig | 84cadcc9 | `tools/redesign-basis.mjs` → `_basis/6fd0cce`; `alt-main-6fd0cce` 159 Bilder: 0 ✗ / 0 ⚠ / 0 fehlen gegen `vorher-vollbasis7c92` | 0 |
| V0.04 | V0 | Text-Hash + API-Log je Panel in Shots-Bericht und Vergleich | Werkzeug | T4 | V0.02 | fertig | ab2a5f4c | `alt-main-6fd0cce` mit Prüfsummen neu aufgenommen; gegen `v004alt`: 159 Bilder 0 ✗ / 5 ⚠ (Text gleich) / 0 API anders | 1 (zsh trennt `$x` nicht → Argumente einzeln) |
| V0.05 | V0 | Smoke: Rolle, Theme, Klick-Navigation, numerischer Überlauf, Design im Schlüssel | Werkzeug | T5 | V0.01 | fertig | 8fd609df | Basis `smoke-alt-main` (main, beide Rollen, 100 Funde); Branch `v005` 0 neu; Klick-Lauf `v005klick`: Inhaberin alle Bereiche per Klick (außer doctors = in Podologie nicht im Menü), Mitarbeiterin ohne Inhaber-Bereiche; Schlüssel ohne Design (neu gegen alt prüfbar), mit Rolle/Theme | 0 |
| V0.06 | V0 | Fixture: Szenarien `fehler/langsam/gross`, Uhr-Parameter (`--uhr`, Sommerzeit-fest), API-Antworttabelle `API_ANTWORTEN` im Harness (Startseiten-Daten + `/api/startseite` folgen in V6 mit dem Vertrag) | Werkzeug | Fixture | V0.03 | fertig | dieser Commit | Alt `v006alt2` 108 Bilder 0 ✗ gegen Referenz; Szenarien als Kontaktbogen gesichtet (`v006sz`); `--uhr 2026-10-26T07:45+01:00` Termine korrekt 08:00 | 2 (langsam: Start blockiert → Boot-Tabellen ausgenommen; +02:00 fest → Berliner Versatz je Tag) |
| V0.07 | V0 | Zustände-Werkzeug (laden/leer/fehler, Flyout, Seitenpanel, 1024 px) | Werkzeug | T4 | V0.06 | offen | | | |
| V0.08 | V0 | Geometrie-Probe im Harness (Kalender-Slots, Köpfe, Hauptbreite) alt/neu | Werkzeug | T3 | V0.03 | fertig | f39f5854 | `geometrie-v008`: 12 Messungen (alt/neu × 1440/1024/390 × Tag/Woche), Slots 56/28, Kopf 44, 0 Verstöße; Gegenprobe mit manipulierter Datei meldet ✗ | 1 (versteckte Slots) |
| V0.09 | V0 | Statische Wachen: Scope, `!important`-Kommentar, Cache-Nummer, Auslieferung (Dockerfile/Workflow), Datei-Schrumpf | Werkzeug | T1 | V0.01 | fertig | 904f215d | `tools/redesign-wachen.mjs` grün auf aktuellem Stand; 9 Tests (inkl. echte Dateien: Auslieferung + Scope in `npm test`) | 1 (Kommas in `:is()`) |
| V0.10 | V0 | Flake-Register `tools/redesign-flakes.json` im Vergleich | Werkzeug | T4 | V0.04 | fertig | 1f6e73ae | Statistik dunkel/390 in `v004alt`, `p37alt`, `p311alt` gegen `vorher-vollbasis7c92` jetzt ⚑ statt ✗, sonst unverändert | 0 |
| V0.11 | V0 | Kontaktbogen (Übersichtsbild je Lauf) | Werkzeug | T4 | V0.02 | fertig | b1c2b56d | `alt-main-6fd0cce/kontakt-owner-voll-alt-hell-1440.png` 27 Bereiche, 1440×1837, gesichtet | 0 |
| V0.12 | V0 | Phasenabschluss V0: alles auf `0a63ce0f`-Stand grün, Merge main, Push, T6 | Abschluss | – | V0.02–V0.11 | offen | | | |
| V1.01 | V1 | Tokens v2: Abstand, Radius (12/8/6/4), Linien, Schatten-Stufen | CSS global | alle (neu) | V0.12 | offen | | | |
| V1.02 | V1 | Schriftstufen (feste px), Gewichte, `tabular-nums` | CSS global | alle (neu) | V1.01 | offen | | | |
| V1.03 | V1 | Farbrollen v2 (Text `#1A1D21`, Linie `#D6DAE0`, Feldrand ≥ 3:1, Creme `#F3E4D2`, Status-Töne, Diagrammpalette), hell + dunkel | CSS global | alle (neu) | V1.01 | offen | | | |
| V1.04 | V1 | Bewegung + `prefers-reduced-motion` (nur neu) | CSS global | alle (neu) | V1.01 | offen | | | |
| V1.05 | V1 | Kontrast-Test erweitert (neue Token, Diagrammpalette ≥ 3:1, Status-Töne) | Werkzeug | T2 | V1.03 | offen | | | |
| V1.06 | V1 | Phasenabschluss V1 | Abschluss | – | V1.01–V1.05 | offen | | | |
| V2.01 | V2 | Ordner `design/` + `shell.css`, Dockerfile/Workflow-Zeile, Auslieferungstest grün | CSS + Auslieferung | – | V1.06 | offen | | | |
| V2.02 | V2 | `module/neu-start.js` (Boot nur bei neu) + Import-Zeile + Hooks in `dashboard.js` (zeilenneutral) | JS-Modul | alle | V2.01 | offen | | | |
| V2.03 | V2 | Grid-Hülle (Leiste volle Höhe, Topbar rechts), ≥ 1025 px | CSS | Shell | V2.02 | offen | | | |
| V2.04 | V2 | Leiste v2 (Optik, Aktiv Creme, 40–44 px Einträge, Zählerplakette) | CSS | Shell | V2.03 | offen | | | |
| V2.05 | V2 | Navigation neu gruppiert (`nav-registry.js`, E7, wirkt auch alt → Alt-Referenz bewusst neu aufnehmen) + Menüzeilen Anamnese/Notizen/Fußbefund/Überblick ausgeblendet (nur neu) | JS + Verhalten (E7) | Shell, alt | V2.04 | offen | | | |
| V2.06 | V2 | Eingeklappt: Icon-Leiste 64–72 px mit Kurzlabel | CSS + Modul | Shell | V2.05 | offen | | | |
| V2.07 | V2 | Gruppen-Flyout (Klick, Tastatur, Escape, Touch) | JS-Modul | Shell | V2.06 | offen | | | |
| V2.08 | V2 | Topbar v2 (Einrichtung beschriftet, Ordnung, Profil) | CSS | Shell | V2.03 | offen | | | |
| V2.09 | V2 | Suche oben (`module/gehe-zu.js`, Taste „/“): Patient, Verordnung, Rechnung | JS-Modul (E7) | Topbar | V2.08 | offen | | | |
| V2.10 | V2 | „+ Neu“-Menü (Termin, Patient, Verordnung erfassen/scannen) | JS-Modul (E7) | Topbar | V2.08 | offen | | | |
| V2.11 | V2 | Schublade mobil + R-01-Lösung (nur neu), `inert` | CSS + Modul | Shell mobil | V2.04 | offen | | | |
| V2.12 | V2 | Tablet 1024/1025 + Tastaturlauf | Prüfung + CSS | Shell | V2.07–V2.11 | offen | | | |
| V2.13 | V2 | Phasenabschluss V2 | Abschluss | – | V2.01–V2.12 | offen | | | |
| V3.xx | V3 | Bausteine v2 (Karte, Knopf, Feld, Tabelle/Liste, Status-Tag, Modal, Seitenpanel, Tabs/Segment, Banner, Leer, Toast, Fokus; neu: Skeleton, Fehlerkarte, Kennzahl, Listenzeile, Mini-Karte, „Alle anzeigen“, SVG-Balken/-Ring), Katalogseite, Neu-Referenz einfrieren | CSS | Bausteine | V2.13 | offen | | | |
| V4.xx | V4 | Archetypen-Map + Test, Piloten kunden, verordnungen (+Seitenpanel), settings (+Abschnittsnavigation), statistik, warteliste | CSS + Modul | Piloten | V3 | offen | | | |
| V5.xx | V5 | Kalender (Toolbar, Raster, Blöcke, Kontextmenü, Heute-Linie, Spalten, Monat, Probes neu) | CSS | calendar | V4 | offen | | | |
| V6.Bxx | V6 | Backend: R-06, Forderungs-Modul, Monatsgrenzen, Router `startseite` (geld/mahnungen/abrechnung), freie Zeit serverseitig, guvenlik + onprem | Backend | API | V1.06 | offen | | | |
| V6.Fxx | V6 | Startseite „Heute“: Definitionen (podoloji, gkv-302), Rechnen, Daten, 7 Karten, Raster, Rollen, Zustände, Überblick aufgehen lassen | JS-Modul + CSS | overview | V5, V6.B | offen | | | |
| V7.xx | V7 | Abläufe: Akte-Reiter + Menü, Doku-Recht (guvenlik), Abschlussdialog | Verhalten (E7) | Akte, Behandlung | V6 | offen | | | |
| V8.xx | V8 | Übrige Bereiche nach Archetyp + feste Farben je Bereich + Status-Pillen (gkv-302) + 390 px | CSS + Hex | Bereiche | V4, V7 | offen | | | |
| V9.xx | V9 | Abnahme-Schleife bis 0 Funde, Abschlussbericht | Abnahme | alle | V8 | offen | | | |
| V10.xx | V10 | Umschalten (Standard neu) | Verhalten | alle | V9 | wartet-Melih | | | |

## 3 Messwerte
- Ausgangslage v2 (25.10.2026, `97156628` = `0a63ce0f` + Doku): npm test 4.071 grün (2.152 / 1.625 / 294), Alt 159 Bilder 0 ✗ gegen `vorher-vollbasis7c92`, Smoke 44 bekannte Funde (neu) / 0 neue. `dashboard.js` = Baseline 18.415. `dashboard.html` 1.271 IDs.
- Laufzeiten (Entwickler-B-Bericht): ≈ 1,5 s je Bild; Alt-Vollmatrix 312 Bilder ≈ 7,7 min; Referenzvergleich 159 Bilder ≈ 4 min.

## 4 Fehlerbuch
Art: Produkt · Werkzeug · Flake · vorbestehend. R-01 bis R-12 siehe `STATUS-V1.md` (alle vorbestehend oder erledigt; R-01, R-05, R-06, R-07, R-08 bleiben relevant: R-01 in V2.11 nur neu gelöst, R-05/R-07 durch neue Startseite umgangen, R-06 in V6.B geschlossen, R-08 in V7 geprüft).

| # | Datum | Art | Bereich | Fehler | Ursache | Status | Versuche |
|---|---|---|---|---|---|---|---|
| R-13 | 24.10.2026 | Werkzeug | Arbeitsweise | `dashboard.html` durch Python-Einzeiler geleert (`open(p,'w')` vor dem Lesen) | Skript-Überschreiben | behoben (git restore), Regel in §1 | 1 |
| R-14 | 25.10.2026 | vorbestehend | viele Bereiche | Bei Datenbankfehler (Szenario `fehler`) zeigen Patienten, Verordnungen, Kalender, Dashboard leere Listen („Noch keine …“) statt eines Fehlers | Lade-Fehler werden still verschluckt | nicht im Redesign reparieren; neue Startseite (V6) bekommt echte Fehlerzustände; Ops-Karte beim Phasenabschluss | – |

## 5 Flake-Register
Einzige Quelle: `tools/redesign-flakes.json` (Vergleich zeigt ⚑). Eingetragen: Statistik `owner-voll/alt-dunkel-390` (1.425 px, y 778–1316, R-11, 5× gesehen). Mahnwesen y ≈ 473 und Fußstatus 1-px-Streifen fallen schon unter die Rausch-Regel (Text gleich) und brauchen keinen Eintrag. Neue Einträge erst ab 3 Beobachtungen am selben Ort.

## 6 Entscheidungen
Bis 24.10.: `STATUS-V1.md` (E-01 bis E-06). Ab 25.10.: PLAN-V2 §2 (E1–E10) und:

| Datum | Frage | Entscheidung | Wer |
|---|---|---|---|
| 25.10.2026 | Plan v2 | freigegeben („OK“) | Melih |
| 25.10.2026 | Navigation | beschriftete Leiste Standard, eingeklappt Icon-Leiste mit Kurzlabel + Gruppen-Flyout; Leiste 260 px (Kalender-Geometrie) | Team (podoloji, Designer A, Architektur, übereinstimmend) |
| 25.10.2026 | Modulnamen Startseite | `module/startseite-*.js` (statt `uebersicht-*` aus AUFTRAG 4.5) | Claude |
| 25.10.2026 | v1-STATUS | nach `redesign/STATUS-V1.md` verschoben, nichts gelöscht | Claude |

## 7 Offene Fragen
- Kemal über Wegfall der Farbregel „jeder Status eigene Farbe“ informieren (Melih). Betrifft erst V8 (Verordnungen/Abrechnung).
- An `gkv-302` vor V6.F: eine Fristenregel; darf „≈ €“ Kassenanteil gezeigt werden; Zuzahlung Altsystem; Zählweise Podo-Leistungen.

## 8 Protokoll (nur anhängen)
| Datum | Was | Commits | Nächstes |
|---|---|---|---|
| 25.10.2026 | Analyse mit 8 Agenten, Entwürfe, PLAN-V2 geschrieben; Melih OK | `97156628` | V0.01 |
| 25.10.2026 | V0.01: STATUS v2 + Status-Prüfskript | `32fa0183` | V0.02 |
| 25.10.2026 | V0.02: Shots-Namen global, kein Überschreiben, Bericht ergänzt statt ersetzt, „neu in B“ | `f6587dd9` | V0.03 |
| 25.10.2026 | V0.03: `--wurzel` in Harness/Shots/Smoke, `redesign-basis.mjs`, Alt-Referenz `alt-main-6fd0cce` | `84cadcc9` | V0.09 |
| 25.10.2026 | V0.09: statische Wachen `redesign-wachen.mjs` (+ Test in npm test) | `904f215d` | V0.04 |
| 25.10.2026 | V0.04: Text-Prüfsummen (Panel, Rahmen) + API-Aufrufe je Bild; Rauschen nur bei gleichem Text; Alt-Referenz neu mit Prüfsummen. Beobachtet: Statistik dunkel/390 (R-11) trat auch zwischen zwei frischen Läufen einmal auf → echtes Rendering-Rauschen, kommt in V0.10 ins Flake-Register | `ab2a5f4c` | V0.05 |
| 25.10.2026 | V0.10: Flake-Register (Statistik dunkel/390 = ⚑) | `1f6e73ae` | V0.05 (Smoke-Läufe laufen) |
| 25.10.2026 | V0.11: Kontaktbogen `tools/redesign-kontaktbogen.mjs` (ohne Testserver) | `b1c2b56d` | V0.05 |
| 25.10.2026 | V0.05: Smoke mit Rolle/Theme/Klick-Navigation/numerischem Überlauf; Basis `smoke-alt-main`. Für Klick-Vergleiche beim Phasenabschluss einen Klick-Basislauf aus main aufnehmen | `8fd609df` | V0.08 |
| 25.10.2026 | V0.08: Geometrie-Probe `tools/redesign-geometrie.mjs` (alt/neu, Tag/Woche, 3 Breiten) | `f39f5854` | V0.06 |
| 25.10.2026 | V0.06: Szenarien fehler/langsam/gross, `--uhr`, `API_ANTWORTEN`; Kontaktbogen aus dem Vergleich ausgenommen; Befund R-14 | dieser Commit | V0.07 |

## 9 Abschluss
offen
