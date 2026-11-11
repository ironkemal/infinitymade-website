# Briefing: Rezept-Prüfstand (einmaliger Fable-Lauf)

Du bist der Hauptagent dieser Sitzung (Modell Fable 5.2). Fable ist teuer. Du arbeitest
**einmal** an diesem Ziel, danach läuft nichts davon dauerhaft weiter. Das Ergebnis sind
statische Testdateien im Repo, die ohne KI bei jedem `npm test` mitlaufen.

## Ziel

Synthetische Grenzfall-Verordnungen erzeugen, die `api-backend/ai/validators/validate.js`
(`validateRezept`) gegen die offiziellen Regeln prüfen. Jeder Fall hat:
Eingabe · erwartetes Ergebnis · wörtliche Fundstelle (Datei, Abschnitt, Version).
Abweichungen zwischen Validator und Regel werden **gefunden und berichtet, nicht behoben**.

## Kostendisziplin (wichtigste Regel)

Dein eigener Kontext ist der teuerste. Halte ihn klein.

| Wer | Modell | Wofür |
|---|---|---|
| **Du (Fable 5.2)** | — | Nur: Plan, Erzeugen der Grenzfälle (Phase 3), Endurteil. Keine Massenlektüre. |
| Haiku 5.5 | `model: "haiku"` | Suchen und Lokalisieren: welche Regel steht wo, welche Fälle testen die vorhandenen Tests schon, Abschnitte per `grep`/`sed` ausschneiden |
| Sonnet 5.5 | `model: "sonnet"` | Code: Test-Runner, Prüfskript für Zitate, Tests laufen lassen, Prüf-Gates, Commit |
| Opus 5.5 | `model: "opus"` | Unabhängige Zweitprüfung: sind deine Grenzfälle fachlich richtig? Review des Codes |

- Subagenten über das Agent-Tool mit `model`-Parameter starten. Projekt-Agenten (`.claude/agents/`)
  ebenfalls mit `model`-Override.
- **Höchstens 2 Subagenten gleichzeitig.** Bei Folgefragen denselben Agenten per `SendMessage`
  fortsetzen statt neu starten.
- Subagenten liefern **kurze** Ergebnisse (Tabellen, Pfad:Zeile, max. ~300 Wörter), keine Datei-Dumps.
- Kontext-Fragen zuerst über `rtk proxy agy-context --root <repo> '<frage>'` (siehe globale CLAUDE.md),
  erst danach gezielt lesen.
- Phase 3 (Erzeugen) machst du in **einem** Durchgang, höchstens ein Nachbesserungs-Durchgang.

## Pflicht-Agenten des Projekts

| Agent | Modell | Wann |
|---|---|---|
| `fonksiyon-ustasi` | haiku | Phase 1: "gibt es schon Test-Fixtures/Runner für Validatoren?" · Phase 6: neue Dateien melden (warum + wo genutzt) |
| `wissensbank` | haiku | Phase 1: welche Dokumente und Versionen gelten heute (HeilM-RL, Diagnoseliste, Podologie-Anlagen, TP5 = V21) |
| `gkv-302` | opus | Phase 4: fachliche Prüfung der Grenzfälle. Sein ⛔ ist ein hartes Veto |
| `podoloji` / `physio` | sonnet | Nur bei Zweifel, ob ein Fall in der Praxis realistisch ist |
| `onprem` | sonnet | Nur wenn `tools/check-onprem.sh` anschlägt oder etwas außerhalb von `__tests__/` geändert werden müsste |

Skills: `engineering:testing-strategy` (Phase 1, Abdeckungsplan) · `caveman-commit` (Commit-Text).

## Harte Regeln (nicht verhandelbar)

1. **Keine echten Personen- oder Patientendaten.** Nur erfundene Namen, erfundene Versichertennummern
   im gültigen Format, Geburtsdaten passend zum Fall. Keine echten Kundennamen (Gate `tools/check-namen.sh`).
2. **Zahlen aus Tabellen schreibt keine KI ab** (Positionsnummern, IK, Preise, ICD-Listen, Höchstmengen).
   Solche Werte werden per `grep`/Skript aus der Quelldatei geholt, nie aus dem Gedächtnis.
   **Preise werden in keinem Fall geprüft.**
3. **Jede Fundstelle ist ein wörtliches Zitat** (≤ 300 Zeichen) aus einer `.txt` unter `wissensbank/`.
   Ein Skript prüft das ohne KI (Phase 4). PDFs nicht öffnen.
4. **Validator-Code wird nicht geändert.** Kein Fix an `*Rules.js`, `validate.js`, `catalog.js`.
   Abweichungen werden Befunde.
5. **Bewusste Abweichungen sind keine Bugs.** Beispiel: Ergo-Blankoverordnung ist seit 01.04.2024
   erlaubt, der Code blockiert sie absichtlich (Ops-Dashboard → Teknik). Solche Fälle bekommen
   `"status": "bewusst"` und einen Verweis, keinen Bug-Befund.
6. **Vertikale Reihenfolge:** Podologie zuerst und am gründlichsten, danach Physio/Ergo/Logo.
7. Repo ist **öffentlich**. Nichts Sensibles in Dateien oder Commit-Texte.
8. Arbeit direkt auf `main` (Projektregel), **kein Push**. Commit am Ende ist Pflicht (AUTO-COMMIT).
9. Wenn du blockiert bist: **einmal klar benennen**, nichts vortäuschen, keine Schleife.
   Melih bietet dann `/goal clear` an.

## Phasen

### Phase 0 — Start (Sonnet)
- `git config core.hooksPath .githooks` · `git fetch && git status -sb`; wenn `behind`: `git pull --rebase`.
- Prüfen, ob eine andere Sitzung gerade Dateien unter `api-backend/ai/validators/` geändert hat.
  Fremde Änderungen nicht mitcommitten.

### Phase 1 — Bestand (Haiku, parallel max. 2)
- A: `api-backend/ai/validators/__tests__/validators.test.js` → Tabelle: welche Regeln/Engines sind
  schon getestet, welche nicht. Dazu: exaktes Eingabeformat von `validateRezept` und Rückgabeform
  `{ ok, warnings, blockers, computed, engine }` — welche Felder sind stabil prüfbar
  (Codes/Kennungen statt deutscher Meldungstexte)?
- B: `wissensbank`-Agent + `wissensbank/INDEX.md` → Liste der gültigen Quelldateien mit Version und
  den Abschnitten, die für Rezeptprüfung zählen (HeilM-RL, Diagnoseliste, LHB/BVB, Blanko,
  Podologie-Anlagen, `wissensbank/SPEC-RULES.md`).
- `fonksiyon-ustasi`: gibt es Vorhandenes, das wiederverwendet werden muss?

### Phase 2 — Plan (du)
Abdeckungsplan (Skill `engineering:testing-strategy`): 80–120 Fälle, verteilt auf
`standard`, `lhb_bvb`, `blanko`. Schwerpunkte: Höchstmengen/Frequenz, ICD ↔ Diagnosegruppe,
Leitsymptomatik, Ausstellungs- und Behandlungsbeginn-Fristen, Podologie (Diabetes/Neuropathie-
Voraussetzung, Positionsnummern), LHB/BVB-Erkennung, Blanko-Geltungsbereich, Grenzwerte genau
auf der Kante (letzter erlaubter Tag, erste unerlaubte Menge). Plan kurz halten (Tabelle).

### Phase 3 — Erzeugen (du, ein Durchgang)
Nur die von Haiku ausgeschnittenen Abschnitte als Kontext. Ausgabe als JSON-Dateien in
`api-backend/ai/validators/__tests__/fixtures/pruefstand/` (eine Datei je Engine):

```json
{
  "id": "POD-STD-007",
  "titel": "Podologie: Frequenz eine Einheit über Höchstmenge",
  "bereich": "podologie",
  "engine_erwartet": "standard",
  "eingabe": { "...": "exakt im Format von validateRezept" },
  "erwartet": { "ok": false, "blocker_enthaelt": ["<stabiler Code>"] },
  "quelle": {
    "datei": "wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt",
    "abschnitt": "§ …",
    "version": "2025-05-15, in Kraft 2025-08-05",
    "zitat": "wörtlich aus der Datei"
  },
  "status": "aktiv"
}
```
`status`: `aktiv` | `bewusst` (gewollte Abweichung, mit Verweis) | `befund` (Validator weicht ab).
Tabellenwerte (Positionsnummern, ICD, Höchstmengen) vorher per Sonnet-Skript aus der Quelle holen lassen.

### Phase 4 — Prüfen
1. **Ohne KI (Sonnet schreibt, du startest):** `tools/pruefstand-zitate.mjs` — prüft für jeden Fall,
   dass `quelle.datei` existiert und `quelle.zitat` wörtlich (`includes`, Whitespace normalisiert)
   darin steht. Ziel 100 %. Fälle ohne Treffer werden korrigiert oder gelöscht.
2. **Fachlich (`gkv-302`, Modell opus):** alle Fälle mit `ok: false` und mindestens 30 % der übrigen.
   Liefert pro Fall: richtig / falsch + Grund. Falsche Fälle korrigieren oder streichen.
3. **Unabhängig (Opus, frischer Agent):** Stichprobe 15 Fälle, die `gkv-302` nicht gesehen hat.

### Phase 5 — Test-Runner (Sonnet)
- `api-backend/ai/validators/__tests__/pruefstand.test.js` mit `node:test`, Stil wie
  `validators.test.js`. Liest alle Fixtures, ruft `validateRezept`, prüft nur stabile Felder.
- Fälle mit `status: "befund"` oder `"bewusst"` laufen als `{ todo: "<id + Grund>" }` →
  sie scheitern sichtbar, brechen den Lauf aber nicht.
- `cd api-backend && node --test` und danach `npm test` im Repo-Root: grün.
- Prüfen, ob die neuen Dateien ins Docker-Image/Box-Paket rutschen (`.dockerignore`,
  `tools/onprem-manifest.mjs`). Wenn das Gate anschlägt → `onprem` fragen.
- Code-Review durch Opus-Subagent (kurz, nur echte Fehler).

### Phase 6 — Abschluss (Sonnet + du)
- `api-backend/ai/validators/__tests__/fixtures/pruefstand/PRUEFSTAND.md`: wie entstanden
  (Datum, Modelle, Quellen + Versionen), Anzahl Fälle je Engine und Bereich, **Befundliste**
  (id · Regel · was der Validator tut · was die Quelle sagt · Zitat), bewusste Abweichungen,
  wie man einzelne Regeln später neu erzeugt (nur betroffene Regel, kein Komplettlauf).
- Dieses Briefing als `BRIEF.md` daneben ablegen (Nachvollziehbarkeit).
- `node tools/funktionskarte.mjs --check`; wenn veraltet: neu erzeugen.
- `fonksiyon-ustasi` melden: warum + wo genutzt (neuer Runner, Zitat-Prüfskript).
- `fortschritte/<heutiges Datum>.md`: Eintrag anhängen bzw. Datei anlegen (Regeln: `fortschritte/REGELN.md`).
- Alle Gates via pre-commit, dann **ein Commit** (nur eigene Dateien). **Kein Push.**
- Ops-Dashboard-Karten für Befunde **nicht** anlegen — nur auflisten; Melih entscheidet.

## Fertig, wenn (alles wahr)

1. Fixtures unter `api-backend/ai/validators/__tests__/fixtures/pruefstand/`, ≥ 80 Fälle, Podologie ≥ 25.
2. `node tools/pruefstand-zitate.mjs` → 100 % Zitate gefunden.
3. `gkv-302` hat geprüft; kein offenes ⛔.
4. `cd api-backend && node --test` und `npm test` grün (todo erlaubt).
5. `PRUEFSTAND.md` mit Befundliste existiert.
6. Commit auf `main` erstellt, nicht gepusht; Arbeitsverzeichnis ohne eigene offene Änderungen.

## Schlussbericht an Melih (Deutsch, kurz)
Status getrennt: geschrieben · lokal getestet · nicht gepusht. Anzahl Fälle, Anzahl Befunde
(Top 5 mit id), bewusste Abweichungen, Commit-Hash, welche Subagenten mit welchem Modell liefen,
grober Verbrauch, was offen bleibt.
