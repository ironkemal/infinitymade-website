# WERKZEUGE: Agenten, Subagenten, Skills

Melih gibt alle hier genannten Werkzeuge für das Redesign frei. Du musst **nicht** einzeln fragen. Das gilt auch für `builder` und `/konsey`, die laut `CLAUDE.md` sonst eine Nutzer-Anfrage brauchen: **diese Datei ist die Anfrage.**

## 1. Projekt-Agenten (`.claude/agents/`)

| Agent | Wann im Redesign | Pflicht? |
|---|---|---|
| `fonksiyon-ustasi` | Vor jeder neuen Funktion, jedem neuen Modul und jeder neuen Klasse mit Logik: „Gibt es das schon?“ Danach: niye + nerede melden. Auch: Welche Daten lädt die Übersicht schon? Welche Klassen setzt JS? | **ja** |
| `db-ustasi` | Vor jeder neuen Abfrage, RPC, View oder Kolon für die Übersicht. Schreibt die Migration, falls nötig | **ja** bei Daten |
| `onprem` | Vor jeder neuen Abfrage, jedem Umgebungswert, jeder festen Adresse, jedem neuen Ordner im Auslieferungspaket. Prüft G8 (kein CDN, keine neue Cloud-Kette) | **ja** bei Daten/Infra |
| `guvenlik` | Neue Kennzahlen mit Patienten- oder Geld-Daten (Rollen owner/employee!), Screenshot-Ordner, Testkonto-Nutzung. Vetorecht in 4 Themen | **ja** bei Daten |
| `podoloji` | Konzept der Übersicht, jeder Podologie-Bereich (podologie-billing, fussstatus, verordnungen, kalender): Ist das für eine Podologin klar und mit wenig Klicks? | **ja** Phase 4/5/6 |
| `mobil-ui` | Nach jedem fertigen Bereich: 390 px messen (Überlappung, Überlauf, Tippflächen). Repariert nur CSS | **ja** pro Bereich |
| `canli-test` | Nach jedem Push: live auf `app.praxura.de/dashboard.html?design=neu` prüfen und Sicil fortschreiben. Fragt bei Fachfragen selbst `podoloji` | **ja** pro Phase |
| `/konsey` (Skill) | Echte A-oder-B-Entscheidungen: Aufbau der Übersicht, Seitenleiste, Tabellen-Stil, Umgang mit Sonderfällen. Ergebnis in `STATUS.md` → Entscheidungen | bei Entscheidungen |
| `muhalif` | Sitzt im Konsey. Allein nutzen, wenn ein Plan zu glatt wirkt: „Wo bricht das?“ | optional |
| `deger-mi` | Lohnt sich eine neue Kennzahl oder ein Sonderwunsch, oder reicht eine kleinere Version? | optional |
| `builder` | Nur für große, mechanische Fleißarbeit, z. B. Phase 2 (Hex → `var()` in vielen Modulen). Nur mit **Gemini-Modell** in `agy` (spart Claude-Kontingent). Jedes Ergebnis selbst prüfen (T1–T4). Wenn `agy` nicht verfügbar ist: selbst machen | optional |
| `gkv-302` | Nur wenn in Abrechnung, Rechnungen oder Verordnungen Status-Texte, Zählungen oder Hinweise anders dargestellt werden. Die Bedeutung darf sich nicht ändern | bei Abrechnungs-Bereichen |
| `legal-de` | Nur wenn neue Karten Patientendaten an neuen Stellen oder für Mitarbeiter zeigen | selten |
| `todo-maker` | Am Ende: offene Punkte und vorbestehende Fehler als Ops-Karten | Abschluss |
| `wissensbank`, `mentor` | Für das Redesign nicht nötig | – |

## 2. Eingebaute Subagenten von Claude Code

| Subagent | Wofür |
|---|---|
| **Explore** | Inventare und breite Suchen (feste Farben zählen, IDs/Klassen sammeln, wo wird eine Klasse gesetzt). Spart Kontext |
| **Plan** | Plan für komplexe Pakete (Übersicht, Kalender), bevor du baust |
| **general-purpose** | Parallele, **nur lesende** Prüfungen (z. B. drei Bereiche gleichzeitig auf Konsolenfehler) oder Arbeit an **getrennten** Dateien |

Regel: Gemeinsame Dateien (`dashboard.html`, `dashboard.js`, `praxura-design.css`, `STATUS.md`) ändert **nur der Hauptkontext**.

## 3. Skills

Prüfe zu Beginn, welche Skills in deinem Claude Code verfügbar sind. Nutze die vorhandenen. Fehlt einer, gelten die Kurzregeln dahinter, und notiere das in `STATUS.md`. Melih kann fehlende Plugins nachinstallieren.

| Skill | Wofür | Kurzregel, falls nicht vorhanden |
|---|---|---|
| `konsey` (im Projekt) | Entscheidungen | – |
| `frontend-design` | Klare Linie, keine Standard-Optik | Ruhig, viel Weißraum, eine Akzentfarbe, Titel nicht fett, klare Rangfolge |
| `dataviz` | Ring, Balken, Kennzahl-Kacheln, Diagrammfarben | Direkte Beschriftung statt Legende, keine 3D-Effekte, Achsen sparsam, Farben in hell und dunkel prüfen |
| `design:design-system` | Bausteine einheitlich (Knöpfe, Karten, Felder) | Jeder Baustein: Normal, Hover, Fokus, Deaktiviert, Fehler |
| `design:design-critique` | Jeden fertigen Bereich gegen `REFERENZ.md` bewerten | Rangfolge, Abstände, Ausrichtung, Einheitlichkeit prüfen |
| `design:accessibility-review` | Kontrast, Fokus, Tastatur, Tippflächen | Kontrast ≥ 4,5:1 (Text), ≥ 3:1 (große Schrift, Symbole), Fokusring sichtbar, Tippfläche ≥ 44 px |
| `design:ux-copy` | Texte für Leerzustände, neue Karten (nur Deutsch, `T.de`) | Kurz, freundlich, sagt was als Nächstes zu tun ist |
| `design:design-handoff` | `komponenten.html` aktualisieren | – |
| `engineering:code-review` | Eigenen Diff vor jedem Phasen-Push prüfen | Auf vergessene IDs, harte Farben, Zeilenwachstum, Konsolenfehler achten |
| `engineering:debug` | Reparatur-Schleife | Erst reproduzieren, dann Ursache isolieren, dann beheben |
| `engineering:testing-strategy` | Aufbau von `redesign-smoke.mjs` | – |

## 4. MCP-Server und Werkzeuge

| Werkzeug | Wofür | Grenze |
|---|---|---|
| Supabase-MCP (nutzt `db-ustasi`) | Schema prüfen, Abfragen testen | Lesen frei, `apply_migration` **nur nach Melihs OK** |
| Playwright (`tools/browser-probe/`, schon im Projekt) | T3, T4, T5 | kein `playwright install` nötig, wenn vorhanden |
| `node dev_server.cjs` → `http://localhost:8081` | lokales Testen mit Login | QA-Konto aus `.env.local`, Zugangsdaten nie ausgeben |
| Vercel (falls verbunden) | prüfen, ob der Deploy angekommen ist | nur lesen |
