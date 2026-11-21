# Rezept-Prüfstand

Synthetische Grenzfall-Verordnungen, die `validateRezept` (`api-backend/ai/validators/validate.js`)
gegen die offiziellen Regeln prüfen. Jeder Fall hat Eingabe, erwartetes Ergebnis und eine wörtliche
Fundstelle aus einer `.txt` unter `wissensbank/`. Die Fälle laufen ohne KI bei jedem `npm test` mit.

**Abweichungen zwischen Validator und Quelle sind hier nur festgehalten, nicht behoben.**
Der Validator-Code wurde für den Prüfstand nicht angefasst.

## Wie entstanden

- Datum: 11.11.2026, ein einmaliger Lauf. Auftrag: `BRIEF.md` (liegt daneben).
- Fälle erzeugt von Claude Fable 5.2 aus ausgeschnittenen Regelabschnitten. Tabellenwerte
  (Höchstmengen, Frequenzen, ICD-Zeilen) hat ein Skript aus den Quelldateien geholt, nicht das Modell.
- Fachprüfung: Projekt-Agent `gkv-302` (Opus 5.5), 99 Fälle, **kein ⛔**. Beanstandet: 2 nicht
  endständige ICD-Kodes in der Eingabe, 4 Zitate, die die Erwartung nicht trugen, 3 unsichere Fälle.
  Alle Beanstandungen sind eingearbeitet (siehe „Unsicher / offen").
- Unabhängige Stichprobe (Opus 5.5, frischer Agent): 15 Physio-Fälle, die `gkv-302` nicht gesehen
  hat — alle richtig. Derselbe Agent hat Runner und Zitat-Skript geprüft; 7 Punkte, alle behoben.
- Suchen/Ausschneiden: Haiku 5.5. Runner und Skript: Sonnet 5.5.
- Keine echten Personen- oder Patientendaten. Die Eingaben enthalten gar keine Personendaten.
- Preise werden in keinem Fall geprüft.

## Quellen

| Datei (unter `wissensbank/`) | Stand |
|---|---|
| `gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt` | Fassung 15.05.2025, in Kraft 05.08.2025 (Textteil + Heilmittelkatalog) |
| `gemeinsam/heilmittel-richtlinie/heilmittel-diagnoseliste.txt` | KBV-Diagnoseliste LHB/BVB/Blanko, Stand 01.01.2026 |
| `podologie/20250617_Podologie_Vertrag-Lesefassung.txt` | Vertrag § 125 Podologie, Änderungen bis 16.06.2025 |
| `podologie/20250617_Podologie_Anlage_3_Lesefassung.txt` | Anlage 3 (Angaben auf der Verordnung), i. d. F. 16.06.2025 |

Gültigkeit laut `wissensbank/REGISTER.md` (Stand 07.11.2026) vom `wissensbank`-Agenten bestätigt.
Endständigkeit von ICD-Kodes (G35.10, S42.00) aus `gemeinsam/icd-10-gm/` per `grep` geholt.

## Zahlen

Gesamt: **122 Fälle**.

| Datei | Fälle |
|---|---|
| `blanko.json` | 14 |
| `lhb_bvb.json` | 24 |
| `standard-physio-ergo-logo.json` | 41 |
| `standard-podologie.json` | 43 |

| Bereich | Fälle |
|---|---|
| physio | 53 |
| podologie | 45 |
| ergo | 12 |
| logo | 10 |
| uebergreifend | 2 |

| Engine erwartet | Fälle |
|---|---|
| blanko | 13 |
| standard | 83 |
| lhb_bvb | 24 |
| null | 2 |

| Status | Fälle |
|---|---|
| aktiv | 119 |
| befund | 0 |
| bewusst | 3 |

## Aufbau eines Falls

```json
{
  "id": "POD-STD-002",
  "titel": "…",
  "bereich": "podologie | physio | ergo | logo | uebergreifend",
  "engine_erwartet": "standard | lhb_bvb | blanko | null",
  "eingabe": { "…": "genau das Objekt für validateRezept" },
  "erwartet": {
    "ok": true, "engine": "standard",
    "blocker_enthaelt": [], "blocker_enthaelt_nicht": [],
    "warnung_enthaelt": [], "warnung_enthaelt_nicht": [],
    "computed": { "max_sessions": 6 }
  },
  "quelle": { "datei": "wissensbank/….txt", "abschnitt": "§ … (Z. 678)", "version": "…", "zitat": "wörtlich" },
  "status": "aktiv | befund | bewusst",
  "grund": "Pflicht bei befund/bewusst: was der Validator heute tut"
}
```

- `erwartet` beschreibt, was **die Quelle** verlangt, ausgedrückt in stabilen Kennungen des
  Validators. Meldungstexte werden nie geprüft. `computed` wird nur als Teilmenge verglichen.
- Der Validator meldet Höchstmengen- und Fristverstöße absichtlich als **Warnung**, nicht als
  Blocker (Entscheidung im Code, `standardRules.js`). Deshalb steht bei solchen Fällen
  `warnung_enthaelt` und kein `ok: false`.
- `quelle.abschnitt` muss eine Zeilenangabe `(Z. n)` oder `(Z. n–m)` enthalten. Das Zitat wird nur
  in diesen Zeilen gesucht — „bis zu 6x/VO" steht im Katalog bei sieben Diagnosegruppen.
- `status: aktiv` → Test muss grün sein. `befund` / `bewusst` → läuft als `todo` und darf scheitern.
  Besteht ein solcher Fall eines Tages, schlägt der Test „Befundliste aktuell" an: dann ist die
  Abweichung behoben, Status auf `aktiv` setzen und unten austragen.

## Befundliste (Validator weicht von der Quelle ab)

Keine offenen `befund`-Fälle (0 Stück; mit Paket D wurden `LHB-006`, `PHY-STD-011` und `PHY-STD-012` behoben).

### Befunde ohne eigenen Fall (aus dem Tabellenabgleich, nicht als Test abgebildet)

- **Zweit-ICD** (Spalte „2. ICD-10", z. B. `Z98.88` bei `M23.5-`, `Z96.60`, `M24.41`; `Z43.0` bei
  `Z99.0`; `G99.2`/`G55.x` bei `M47.0-`..`M51.1`) ist in `heilmittel-catalog.json` strukturiert
  hinterlegt (`second_icd`/`second_icds`), wird zur Laufzeit in den Regeln aber noch nicht geprüft.
- **`lookupLhbBvb` / `lookupBlankoShoulder`** normalisieren Eingaben per `trim().toUpperCase()`
  inkl. Wildcards (`XXX.-`, `XXX.Y-`, `G73.6*`, `C00-C97`); kommaseparierte Listen (z. B.
  „G60.0, M54.5") werden jedoch nicht aufgesplittet.
- **Veraltete Physio-Alt-DGs außerhalb von `diagnosegruppen.json`**: `api-backend/ai/catalogs/rezept-optionen.js` (`DIAGNOSEGRUPPEN`: jetzt die 44 gültigen HeilM-RL-Codes ab 2021/2025), `module/verordnung-import.js` (`PHYSIO_FALLBACK_HOECHSTMENGE`: jetzt die 13 Physio-Codes inkl. `SO4`/`SO5`, ohne Alt- und Ergo-Codes) und `api-backend/billing/dta/preflight.js` (`isValidDiagnosegruppe` prüft TP5-Syntax `..4 AN M` inkl. ZÄ/Ersatzwert `'9999'`, Warnung `V:01019` bei Abweichung vom 44er-HeilM-RL-Katalog) sind bereinigt. Live-DB: ✅ am 21.11.2026 auf SaaS angewandt (`20261121181821`, 44 aktiv / 59 gesamt) und als Migration [`api-backend/db/migrations/0122_diagnosegruppen_heilm_rl_bereinigen.sql`](../../../../../db/migrations/0122_diagnosegruppen_heilm_rl_bereinigen.sql) überführt (O-129 / G7), Grundlage `api-backend/db/migrations/0011_seed_diagnosegruppen.sql` (14 Alt-Codes + `'SM'`, ohne `SAS`/`CF`).

## Bewusste Abweichungen (kein Fehler)

| id | Regel (Soll laut Quelle) | Warum gewollt / was der Validator tut | Quelle und Zitat |
|---|---|---|---|
| BLK-012 | Blanko: Ergotherapie SB1 mit Blanko-Kennzeichnung ist seit 01.04.2024 zulässig | Ergo-Blankoverordnung (seit 01.04.2024) ist im Validator bewusst nicht abgebildet (validate.js:33-39, Ratsbeschluss 2026-08-05; Ops-Dashboard → Teknik). | Abschnitt 2, Ergotherapie ab 1. April 2024 (Z. 1487) — „SB1 Erkrankungen der Wirbelsäule, Gelenke und Extremitäten" |
| BLK-013 | Blanko: Ergotherapie PS4 mit Blanko-Kennzeichnung ist seit 01.04.2024 zulässig | Ergo-Blankoverordnung (seit 01.04.2024) ist im Validator bewusst nicht abgebildet (validate.js:33-39, Ratsbeschluss 2026-08-05; Ops-Dashboard → Teknik). | Abschnitt 2, Ergotherapie ab 1. April 2024 (Z. 1492) — „PS4 Dementielle Syndrome" |
| POD-STD-039 | Podologie: DF ganz ohne Diagnose (weder ICD-10-Kode noch Klartext) | ICD ist im Validator bewusst optional (diagnosegruppen.json → _global.ICD_OPTIONAL; vgl. Minimal-Konvention ohne `diagnosetext` in `validators.test.js`); ohne Kode läuft keine Diagnoseprüfung. Laut Anlage 3 muss eine fehlende Diagnose ärztlich ergänzt werden. Anm. (`gkv-302` 2026-11-14): `POD-STD-039.erwartet` führt historisch `ICD_DG_MISMATCH_STRENG`, obwohl kein ICD-Kode vorliegt. | Buchst. k Diagnose, Korrekturmöglichkeit (Z. 563–566) — „Fehlt die Angabe der Diagnose oder ist diese erkennbar nicht therapierelevant, ist diese mit einer erneuten Arztunterschrift und Datumsangabe zu ergänzen oder zu korrigieren." |

## Unsicher / offen

- **BLK-003 (Blanko, 16 Wochen):** „ab Verordnungsdatum gültig" lässt zwei Zählweisen zu
  (Ende 21.06. oder 22.06.2026 bei Ausstellung 02.03.). Der Fall hält das heutige Ergebnis des
  Validators fest (Ausstellung + 112 Tage). Entscheiden kann das nur der Vertrag nach § 125a
  Physiotherapie — der liegt nicht als `.txt` vor.
- **LHB-015:** Der Blocker `NOT_ON_LHB_BVB_LIST` ist nur ohne Kassengenehmigung richtig
  (HeilM-RL § 8 Abs. 3). Die Eingabe kennt kein Feld für eine Genehmigung.
- **LHB-006:** Die 12-Wochen-Warnung ist eine Heuristik. Maßgeblich ist die Frequenz auf der
  Verordnung (§ 7 Abs. 6), und die gehört nicht zur Eingabe.

## Was der Prüfstand nicht abdeckt

- **Quelle fehlt als `.txt`:** Verträge nach § 125a (Physio, Ergo). Deshalb keine Fälle zu
  Blanko-Kennzeichnung (`BLANKO_MARKER_MISSING`), Ampel (`BLANKO_RED_AMPEL`), Bedarfsdiagnostik.
  Ebenso keine Fälle zur Zuzahlung (`ZUZAHLUNG_BEFREIT`, privat) — § 61 SGB V liegt nicht vor.
- **Über `validateRezept` nicht erreichbar:** `NOT_ON_BLANKO_LIST`, `BLANKO_DG_NOT_EX` (der Guard
  in `validate.js` bricht vorher mit `BLANKO_NICHT_VERFUEGBAR` ab).
- **Nicht Teil der Eingabe:** Leitsymptomatik, Therapiefrequenz, Heilmittel, Hausbesuch,
  Unterbrechung (Podologie: 12 Kalenderwochen), Wagner-Stadium, Alter bei Alterskriterien.
- Von `gkv-302` genannte fehlende Grenzfälle: Entlassmanagement (Beginn binnen 7 Kalendertagen,
  Podologie-Vertrag § 6 Abs. 3), Alterskriterium „ab vollendetem 70. Lebensjahr" am Geburtstag,
  nicht endständiger ICD-Kode als eigener Fall.
- Paketgrenze: `api-backend/Dockerfile` kopiert `ai/` samt `__tests__/` ins Image, also auch diese
  Fixtures (wie schon `validators.test.js`). `onprem`: unbedenklich, `.dockerignore` gehört in einen
  eigenen Commit mit Build- und Box-Prüfung.

## Prüfen

```bash
node tools/pruefstand-zitate.mjs                 # Zitate + Struktur + Mindestmengen, Exit 0 bei 100 %
cd api-backend && node --test ai/validators/__tests__/pruefstand.test.js
```
Die Zitatprüfung läuft auch im Test mit (wird übersprungen, wo `tools/` fehlt, z. B. im Image).

## Eine Regel später neu erzeugen

Kein Komplettlauf nötig. Nur die betroffene Regel:

1. Neue Quelldatei über den `wissensbank`-Agenten ablegen (`.txt`, Register).
2. Betroffene Fälle finden: `grep -n '"datei": "…alte Datei…"' *.json` bzw. nach dem Abschnitt.
3. Abschnitt aus der neuen Datei ausschneiden (`sed -n 'a,bp'`), Zahl und Zitat daraus übernehmen,
   `quelle.datei`, `abschnitt` (mit neuer Zeilenangabe) und `version` anpassen.
4. `node tools/pruefstand-zitate.mjs` → 100 %. Test laufen lassen.
5. Scheitert ein `aktiv`-Fall: Validator weicht jetzt ab → Status `befund` mit `grund`, hier eintragen.
   Fachlich unklare Fälle `gkv-302` vorlegen.
