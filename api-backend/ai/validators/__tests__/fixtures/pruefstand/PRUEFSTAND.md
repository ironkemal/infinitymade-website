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
| aktiv | 95 |
| befund | 16 |
| bewusst | 11 |

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

| id | Regel (Soll laut Quelle) | Was der Validator tut | Quelle und Zitat |
|---|---|---|---|
| BLK-006 | Blanko: dringlich: spätester Beginn nach 14 Kalendertagen | blankoRules.js kennt is_dringend nicht (immer 28 Tage). § 13a Abs. 2 verweist auf die Zeiträume des § 15, also auch 14 Tage bei dringlichem Bedarf. | § 15 Abs. 1 Satz 2 (Z. 679–680) — „2Liegt ein dringlicher Behandlungsbedarf vor, hat die Behandlung spätestens innerhalb von 14 Kalendertagen zu beginnen." |
| BLK-007 | Blanko: M75.1 fällt unter „M75.-" der Blanko-Liste | Katalog hält M75.-, S43.-, S46.-, S49.- nur als wörtliche Schlüssel; echte Kodes werden nicht gefunden → BLANKO_NICHT_VERFUEGBAR. | Abschnitt 2, Physiotherapie ab 1. November 2024 (Z. 1579) — „M75.- EX Schulterläsionen" |
| BLK-008 | Blanko: S42.00 (Fraktur der Klavikula): Liste führt »S42.0 -« | S42.0-, S42.1-, S42.2- fehlen im Katalog (blanko_physio_shoulder). | Abschnitt 2, Physiotherapie ab 1. November 2024 (Z. 1613) — „S42.0 - EX Fraktur der Klavikula" |
| LHB-006 | LHB/BVB: G10 + ZN, 37 Einheiten übersteigen 12 Wochen bei Frequenzempfehlung 1-3x | diagnosegruppen.json führt ZN mit frequency_hint „2-5 x wöchentlich" → Schwelle 60 statt 36. Katalog nennt für ZN 1-3x wöchentlich. | Heilmittelkatalog I, Diagnosegruppe ZN, Frequenzempfehlung (Z. 2759) — „- 1-3x wöchentlich" |
| LHB-009 | LHB/BVB: G60.0 + CS: Diagnosegruppe nicht bei diesem ICD gelistet | heilmittel-catalog.json führt bei G60.0 zusätzlich CS, SO4, SB1 (Kürzel der Nachbarzeilen) → keine Warnung. | Abschnitt 1, Zeile G60.0 (Z. 251) — „G60.0 Hereditäre sensomotorische Neuropathie WS/EX/PN SB2/EN3 SP3" |
| LHB-012 | LHB/BVB: Q66.0 + SB1: SB1 ist bei Q66.0 nicht gelistet (nur SB2) | heilmittel-catalog.json führt bei Q66.0 zusätzlich SB1 und SB3 → keine Warnung. | Abschnitt 1, Zeile Q66.0 (Z. 841) — „Q66.0 Pes equinovarus congenitus (Klumpfuß) EX SB2" |
| LHB-016 | LHB/BVB: G35.10 + ZN: Liste führt »G35.1 -« (alle Kodes der Kategorie) | heilmittel-catalog.json enthält 238 von 400 ICD-Zeilen der Liste (162 fehlen, u. a. G35.1–G35.9). Fehlende Kodes laufen als Standardrezept: Engine standard + OVER_HOECHSTMENGE. | Abschnitt 1, Zeile G35.1 (Z. 196) — „G35.1 - Multiple Sklerose mit vorherrschend" |
| LHB-018 | LHB/BVB: R15 + SO2: Alterskriterium „ab vollendetem 70. Lebensjahr" muss angezeigt werden | Hinweis fehlt im Katalog (hinweis: null). Alterskriterien sind nach § 7 Abs. 7 HeilM-RL bindend. | Abschnitt 1, Zeile R15 (Z. 1230–1231) — „R15 Stuhlinkontinenz SO2 ab vollendetem 70. Lebensjahr" |
| LHB-019 | LHB/BVB: G61.0 + PN: bei diesem ICD steht keine Spezifikation | Katalog ordnet G61.0 den CIDP-Hinweis der Nachbarzeile (G61.8) zu → falsche Bedingung wird angezeigt. | Abschnitt 1, Zeile G61.0 (Z. 258) — „G61.0 Guillain-Barré-Syndrom PN EN3" |
| LHB-021 | LHB/BVB: Beginn am 29. Kalendertag muss gemeldet werden | lhbBvbRules.js prüft den Behandlungsbeginn nicht (nur computed.latest_start_date). § 15 gilt unabhängig von LHB/BVB. | § 15 Abs. 1 Satz 1 (Z. 678) — „Die Behandlung hat innerhalb von 28 Kalendertagen nach Verordnung zu beginnen." |
| LHB-022 | LHB/BVB: Beginn vor Ausstellung muss blockieren | lhbBvbRules.js prüft den Behandlungsbeginn nicht. | § 15 Abs. 1 Satz 1 (Z. 678) — „Die Behandlung hat innerhalb von 28 Kalendertagen nach Verordnung zu beginnen." |
| PHY-STD-011 | Physio: SO5 mit 6 Einheiten (Diagnosegruppe steht im Katalog) | SO5 fehlt in diagnosegruppen.json → DG_UNKNOWN, obwohl der Heilmittelkatalog die Gruppe führt. | Heilmittelkatalog I, Diagnosegruppe SO5 (Z. 3328–3329) — „Höchstmenge je VO: - bis zu 6x/VO" |
| PHY-STD-012 | Physio: EX3 ist keine Diagnosegruppe des geltenden Katalogs (nur EX, bis zu 6x/VO) | diagnosegruppen.json führt Alt-Varianten (WS1/WS2, EX1–3, ZN1/2, AT1–3, LY1–3); EX3 und LY3 mit Höchstmenge 10 statt 6. Validator akzeptiert sie. | Heilmittelkatalog I, Diagnosegruppe EX (Z. 2603–2604) — „Höchstmenge je VO: - bis zu 6x/VO" |
| POD-STD-041 | Podologie: NF mit G60.0, 6 Einheiten: Podologie steht nicht auf der LHB-Liste → Standardprüfung | Validator wählt Engine lhb_bvb allein wegen des ICD (validate.js:27), obwohl G60.0 auf der Liste nur mit WS/EX/PN, SB2/EN3, SP3 geführt ist. Folge: DG_MISMATCH_LHB statt Podologie-Prüfung. | Abschnitt 1, Zeile G60.0 (Z. 251) — „G60.0 Hereditäre sensomotorische Neuropathie WS/EX/PN SB2/EN3 SP3" |
| POD-STD-042 | Podologie: NF mit G60.0, 7 Einheiten: Höchstmenge 6 muss gemeldet werden | Wegen Engine-Wechsel auf lhb_bvb entfällt die Höchstmengenprüfung der Podologie (6 je VO); 7 Einheiten bleiben unbemerkt. | Heilmittelkatalog II.1, Diagnosegruppe NF (Z. 3436–3437) — „Höchstmenge je VO: - bis zu 6 x/VO" |
| POD-STD-043 | Podologie: QF mit Q05.9 (Spina bifida): Podologie-Prüfung statt LHB | Validator wechselt auf lhb_bvb und meldet DG_MISMATCH_LHB; LHB gilt nur in Verbindung mit der gelisteten Diagnosegruppe, QF ist dort nicht geführt. | § 8 Abs. 2 Satz 1 (Z. 453–455) — „1Bei den in der Anlage 2 gelisteten Diagnosen in Verbindung mit der jeweils aufgeführ- ten Diagnosegruppe des Heilmittelkataloges ist vom Vorliegen eines langfristigen Heilmittel- bedarfs im Sinne von § 32 Absatz 1a SGB V auszugehen." |

### Befunde ohne eigenen Fall (aus dem Tabellenabgleich, nicht als Test abgebildet)

- **Orientierende Behandlungsmenge** in `diagnosegruppen.json` weicht vom Katalog ab: WS, EX, AT 6
  statt 18 · ZN 40 statt 30 · LY 18 statt 30. (`validateRezept` gibt den Wert nicht aus, deshalb
  kein Fall.)
- **Frequenzempfehlung** fehlt für DF/NF/QF (`null`; Katalog: „alle 4 bis 6 Wochen") und UI2
  (`null`; Katalog: „nach Bedarf"). PN steht mit „2-3 x" statt 1-3x.
- **LHB/BVB-Katalog** (`heilmittel-catalog.json`): 238 von 400 ICD-Zeilen der Liste vorhanden.
  Bei 10 von 16 Stichproben-ICDs enthält die Diagnosegruppen-Liste Kürzel der Nachbarzeilen
  (u. a. G60.0, G61.0, M45.0, Q66.0, R15, G54.6, M23.5, Z96.60, B94.1, G95.0). Hinweise fehlen
  (R15, G54.6, E41, C70.0, E88.20) oder sind verklebt („…AkutereignisI60" bei G95.0).
- **Zweit-ICD** (Spalte „2. ICD-10", z. B. Z98.88 bei M23.5, Z96.60, M24.41) wird nirgends geprüft.
- **`lookupLhbBvb` / `lookupBlankoShoulder`** vergleichen nur nach `trim()`: Kleinschreibung oder
  eine Komma-Liste („G60.0, M54.5") führen zu „nicht gefunden".
- Kommentar und Meldung in `blankoRules.js` nennen „114" Blanko-Diagnosen, der Katalog hat 62.

## Bewusste Abweichungen (kein Fehler)

| id | Regel (Soll laut Quelle) | Warum gewollt / was der Validator tut | Quelle und Zitat |
|---|---|---|---|
| BLK-012 | Blanko: Ergotherapie SB1 mit Blanko-Kennzeichnung ist seit 01.04.2024 zulässig | Ergo-Blankoverordnung (seit 01.04.2024) ist im Validator bewusst nicht abgebildet (validate.js:33-39, Ratsbeschluss 2026-08-05; Ops-Dashboard → Teknik). | Abschnitt 2, Ergotherapie ab 1. April 2024 (Z. 1487) — „SB1 Erkrankungen der Wirbelsäule, Gelenke und Extremitäten" |
| BLK-013 | Blanko: Ergotherapie PS4 mit Blanko-Kennzeichnung ist seit 01.04.2024 zulässig | Ergo-Blankoverordnung (seit 01.04.2024) ist im Validator bewusst nicht abgebildet (validate.js:33-39, Ratsbeschluss 2026-08-05; Ops-Dashboard → Teknik). | Abschnitt 2, Ergotherapie ab 1. April 2024 (Z. 1492) — „PS4 Dementielle Syndrome" |
| ERG-STD-001 | Ergo: SB1 genau Höchstmenge (10) | Ergo-/Logo-Diagnosegruppen sind im Validator bewusst nicht hinterlegt (diagnosegruppen.json → _global.NUR_PODOLOGIE; Vertikal-Reihenfolge: Podologie zuerst). Ergebnis heute: DG_UNKNOWN. | Heilmittelkatalog IV, Diagnosegruppe SB1 (Z. 4472–4473) — „Höchstmenge je VO: - bis zu 10x/VO" |
| ERG-STD-002 | Ergo: SB1 eine Einheit über Höchstmenge (11) | Ergo-/Logo-Diagnosegruppen sind im Validator bewusst nicht hinterlegt (diagnosegruppen.json → _global.NUR_PODOLOGIE; Vertikal-Reihenfolge: Podologie zuerst). Ergebnis heute: DG_UNKNOWN. | Heilmittelkatalog IV, Diagnosegruppe SB1 (Z. 4472–4473) — „Höchstmenge je VO: - bis zu 10x/VO" |
| ERG-STD-003 | Ergo: PS2 genau Höchstmenge (20) | Ergo-/Logo-Diagnosegruppen sind im Validator bewusst nicht hinterlegt (diagnosegruppen.json → _global.NUR_PODOLOGIE; Vertikal-Reihenfolge: Podologie zuerst). Ergebnis heute: DG_UNKNOWN. | Heilmittelkatalog IV, Diagnosegruppe PS2 (Z. 4973–4974) — „Höchstmenge je VO: - bis zu 20x/VO" |
| ERG-STD-004 | Ergo: PS2 eine Einheit über Höchstmenge (21) | Ergo-/Logo-Diagnosegruppen sind im Validator bewusst nicht hinterlegt (diagnosegruppen.json → _global.NUR_PODOLOGIE; Vertikal-Reihenfolge: Podologie zuerst). Ergebnis heute: DG_UNKNOWN. | Heilmittelkatalog IV, Diagnosegruppe PS2 (Z. 4973–4974) — „Höchstmenge je VO: - bis zu 20x/VO" |
| LOG-STD-001 | Logo: SP1 genau Höchstmenge (10) | Ergo-/Logo-Diagnosegruppen sind im Validator bewusst nicht hinterlegt (diagnosegruppen.json → _global.NUR_PODOLOGIE; Vertikal-Reihenfolge: Podologie zuerst). Ergebnis heute: DG_UNKNOWN. | Heilmittelkatalog III, Diagnosegruppe SP1 (Z. 3851–3852) — „Höchstmenge je VO: - bis zu 10x/VO" |
| LOG-STD-002 | Logo: SP1 eine Einheit über Höchstmenge (11) | Ergo-/Logo-Diagnosegruppen sind im Validator bewusst nicht hinterlegt (diagnosegruppen.json → _global.NUR_PODOLOGIE; Vertikal-Reihenfolge: Podologie zuerst). Ergebnis heute: DG_UNKNOWN. | Heilmittelkatalog III, Diagnosegruppe SP1 (Z. 3851–3852) — „Höchstmenge je VO: - bis zu 10x/VO" |
| LOG-STD-003 | Logo: SP4 genau Höchstmenge (20) | Ergo-/Logo-Diagnosegruppen sind im Validator bewusst nicht hinterlegt (diagnosegruppen.json → _global.NUR_PODOLOGIE; Vertikal-Reihenfolge: Podologie zuerst). Ergebnis heute: DG_UNKNOWN. | Heilmittelkatalog III, Diagnosegruppe SP4 (Z. 4027–4028) — „Höchstmenge je VO: - bis zu 20x/VO" |
| LOG-STD-004 | Logo: SP4 eine Einheit über Höchstmenge (21) | Ergo-/Logo-Diagnosegruppen sind im Validator bewusst nicht hinterlegt (diagnosegruppen.json → _global.NUR_PODOLOGIE; Vertikal-Reihenfolge: Podologie zuerst). Ergebnis heute: DG_UNKNOWN. | Heilmittelkatalog III, Diagnosegruppe SP4 (Z. 4027–4028) — „Höchstmenge je VO: - bis zu 20x/VO" |
| POD-STD-039 | Podologie: DF ganz ohne Diagnose (weder ICD-10-Kode noch Klartext) | ICD ist im Validator bewusst optional (diagnosegruppen.json → _global.ICD_OPTIONAL); ohne Kode läuft keine Diagnoseprüfung. Laut Anlage 3 muss eine fehlende Diagnose ärztlich ergänzt werden. | Buchst. k Diagnose, Korrekturmöglichkeit (Z. 563–566) — „Fehlt die Angabe der Diagnose oder ist diese erkennbar nicht therapierelevant, ist diese mit einer erneuten Arztunterschrift und Datumsangabe zu ergänzen oder zu korrigieren." |

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
