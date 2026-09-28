---
titel: Ops #304 Nachtrag — ein DG-Schreiber, zwei ICD-Felder, Belege zu UI1/UI2 und zum dritten Code
datum: 2026-09-26
typ: sitzung
ticket: "Ops #304"
bereich: podologie (Maske Muster 13 gilt für alle Bereiche; DIA-Regel für alle Heilmittel)
status: umgesetzt, committet und gepusht (632d1f0, 0e163ba) · live bestätigt Aufteilen + d/d2 · „Trotzdem speichern?"-Zeile bei >2 Codes nur per Test, nicht live gesehen
tags: [sitzung, muster-13, diagnosegruppe, icd-10, podologie, anlage-3-podologie, dta-dia, preflight, automatik, wettlauf]
verwandt: ["[[SITZUNGEN]]", "[[SPEC-RULES]]", "[[REGISTER]]", "[[INDEX]]", "[[2026-09-25_ops-304_icd-dg-automatik]]", "[[2026-09-26_qa-test-sieben-befunde]]"]
---

# Ops #304 Nachtrag — ein DG-Schreiber, zwei ICD-Felder

## In einem Satz

Die Logik vom 25.09. ([[2026-09-25_ops-304_icd-dg-automatik]]) war richtig, live setzte „E11.74, L60.0" trotzdem DF —
weil ein **zweiter Schreiber** die Diagnosegruppe ohne Besitzmarke schrieb. Jetzt gibt es **einen** Schreiber, beide
ICD-Felder zählen, mehrere Kodes in einem Feld werden verteilt, und zwei Normfragen sind mit Quelle beantwortet.

## Ausgangslage

- Fehlermeldung aus dem canli-test (Szenarien d/d2): ICD „E11.74, L60.0" → DG wird automatisch „DF", obwohl DF, UI1
  und UI2 in Frage kommen; ein zuvor gesetztes DF wird beim Ergänzen von L60.0 nicht entfernt.
- `icd-dg-match.js` `dgVorschlag` lieferte für genau diese Eingabe bereits `auto = null`, Kandidaten DF, UI1, UI2
  (gegen die Live-Regeln der Tabelle `diagnosegruppen` nachgerechnet). Der Fehler lag also nicht im Matcher.

## Was gefunden wurde

| # | Befund | Stelle | Wirkung |
|---|---|---|---|
| 1 | **Zweiter Schreiber ohne Marke** — `dgAuswahlEingrenzen` schrieb DF bei genau einer erlaubten Gruppe, ohne `dataset.dgAuto` | `module/verordnung-podo.js` (vor `632d1f0`) | Kam seine Regelabfrage vor der der Verdrahtung zurück, galt DF als ärztliche Angabe und wurde nie zurückgenommen → d/d2 kaputt, Szenario c ebenso. **Reihenfolge hing am Netz.** |
| 2 | Zweites ICD-Feld zählte nicht | Verdrahtung las nur `rzIcd` | E11.74 in Feld 1 + L60.0 in Feld 2 → DF |
| 3 | Komma-Liste in einem Feld passt nicht zum Datenmodell | `prescriptions.icd10` hält **einen** Kode; Preflight prüft ihn als einen (`preflight.js` V:01002); DIA-Liste = `[icd10, icd10_2]` (`abrechnung.routes.js:537`) | „E11.74, L60.0" wäre erst in der Abrechnung aufgefallen. Prod: 0 Datensätze mit Komma (26.09.2026 gezählt) |
| 4 | Fachbereich = Mandant, nicht Maske | `_getDiagnoseBereich()` = `getSector()` | Mandant `praxis` (interdisziplinär) hatte keine Regeln → Automatik stumm; nur Schreiber 1 lief |
| 5 | Derselbe Hinweis zweimal | `rzIcdDgWarning` + Podologie-Hinweisbox | „Passende …" und rot „… passt nicht / Zulässig: …" |
| 6 | Preflight: `icd10` leer + `icd10_2` gefüllt | `preflight.js` (von `gkv-302` gefunden) | V:01002 „ungültiges Format" auf leerem Feld; der einzige Kode wurde als „= icd10" übersprungen, also nie geprüft |
| 7 | Tote Übergabe `_wireDgIcdPair` in `podoCtx()` | `dashboard.js` | Beim Umzug wäre das ein ReferenceError geworden (`fonksiyon-ustasi`) |

Reproduktion von 1: Harness mit echtem Quelltext beider Schreiber, beide Netz-Reihenfolgen. Alter Code: 8/12 bzw.
11/12, neuer Code 12/12. Kein Browser, keine Live-Daten.

## Norm und Praxis (Befragung 26.09.2026)

- **`podoloji`:** Beide Felder gemeinsam auswerten — ja. Zwei Kodes im ersten Feld ins zweite **verschieben** statt
  nur warnen (auf dem Papier steht ein Kode je Zeile; Warnung kostet ~4 Handgriffe). Leerzeichen als Trenner kommt vor.
  Bei ≥3 Kodes wünschte `podoloji` hartes Anhalten beim Speichern — **nicht übernommen**, s. u. (Annahmen, nicht mit
  Beta-1 geprüft.)
- **`gkv-302`, mit Quellen:**
  - Mehrere Kodes sind zulässig: Podologie Anlage 3 i. d. F. 16.06.2025 Ziffer 5 k „eines oder mehrerer
    ICD-10-Schlüssel" (`podologie/20250617_Podologie_Anlage_3_Lesefassung.txt:533-537`); HeilM-RL § 13 Abs. 2 k.
  - DIA „1 mal je Diagnose", „immer der im Feld … ‚ICD-10-Code' eingetragene ICD-10-Code" — Anlage 1 TP5 V21
    Kap. 5.5.3.3 (`gemeinsam/302-tp5/Anlage_1_TP5_V21_20260115.txt:3492-3500`). Keine Obergrenze.
  - Sperre bei ≥3 Kodes bringt kein Geld — die Verordnung ist gültig.
  - Keine vorgeschriebene Reihenfolge (DF: Diabetes-Kode irgendwo; UI: L60.0 irgendwo).
- **Eigene Gegenprüfung am Original:**
  - **UI1/UI2 mit L60.0 + weiterem Kode ist gültig.** Ziffer 5 k c) „ausschließlich der ICD-Schlüssel L60.0 maßgeblich,
    bei anderen Diagnosen ist eine Korrektur erforderlich" + Korrekturmöglichkeit derselben Ziffer „Weitere Angaben …
    in Form eines oder mehrerer ICD-10-Schlüssel … unschädlich" (`:552-562`). „Maßgeblich" benennt den bestimmenden
    Kode; Korrektur nur, wenn L60.0 **fehlt**. Frontend (`matchIcdToDg`) und Backend-Spiegel (`icdDgRules.js`
    `checkIcdDg`) verhalten sich schon so — mit Live-Regeln ausprobiert. → [[SPEC-RULES]] „UI1/UI2: L60.0 varsa …".
  - **Fehlender dritter Kode ist ein Korrekturanlass:** Anlage 1 V21 Kap. 7, Fußnote 2, S. 171: „Fehlende Daten die auf
    den Originalunterlagen vorhanden sind (z.B. ICD-10 Code)" (`…Anlage_1_TP5_V21_20260115.txt:8318`).
  - **Nicht belegt:** Zahl der ICD-Kästchen auf Muster 13. `gemeinsam/heilmittel-richtlinie/praxiswissen-heilmittel.txt:2192`
    gibt nur die Überschrift „Behandlungsrelevante Diagnose(n) / ICD-10 - Code"; die KBV-Vordruckerläuterung fehlt in
    `wissensbank/`.

## Entschieden (26.09.2026 — Melih hat die Entscheidungen an Claude übertragen: „entscheide du")

1. **Ein einziger automatischer Schreiber für `rzDg`:** `module/icd-dg-verdrahtung.js` `verdrahteIcdDg`.
   `verordnung-podo.js` engt nur noch die Auswahlliste ein (`data-pod-erlaubt`). Das war die offene „Kopie-Entscheidung"
   vom 25.09. (L5).
2. **Fachbereich aus der Maske** (`rzTherapieBereich`), sonst Mandant (L6). Umkreuzen wertet den ICD neu aus; ein
   eigener Vorschlag ohne Regelgrundlage wird zurückgenommen, eine geladene DG bleibt.
3. **Beide ICD-Felder zählen; zwei Kodes in Feld 1 + Feld 2 leer → Verschieben beim Verlassen.**
4. **≥3 Kodes: warnen, nicht sperren.** Hinweis + Zeile in der „Trotzdem speichern?"-Liste; Text nennt den Diagnosetext.
   Gründe: Verordnung gültig (Anlage 3 k), Hausregel „was auf Papier existiert, muss erfassbar bleiben".
5. **Kein Schema für einen dritten Kode jetzt.** Prod 26.09.2026: 67 Verordnungen, zweiter Kode 2×, drei Kodes 0×.
   **Wieder aufgreifen, wenn:** erste echte Verordnung mit drei Kodes oder eine Kassen-Beanstandung „ICD fehlt" →
   `db-ustasi` (Array-Spalte).
6. **Ein Hinweis statt zwei**, am ICD-Feld; „passt nicht" nennt die passenden Gruppen mit.
7. **Preflight-Fix** (Befund 6) mit Test.

## Verworfen

- **Zweiten Schreiber behalten, nur Marke + Kriterium angleichen** (erster Stand, lokal): Datenrisiko wäre weg gewesen,
  aber doppelte Pflege, und bei Mandant `praxis` hätte niemand zurückgenommen.
- **Hart sperren bei ≥3 Kodes** (`podoloji`): blockiert eine gültige, abrechenbare Verordnung.
- **Dritten Kode automatisch in den Diagnosetext schreiben:** verändert eine ärztliche Freitextangabe ungefragt.
- **Rücknahme schon beim Tippen:** weiter verworfen (Begründung vom 25.09.); Verschieben und Rücknahme laufen beim
  Verlassen des Feldes.

## Gebaut

- `632d1f0` — `_wireDgIcdPair` → `module/icd-dg-verdrahtung.js` (`verdrahteIcdDg`, `icdAufZweiFelder`,
  `icdKodesAusFeld`), `dashboard.js` 20763 → 20631 Zeilen · Podo-Schreiber entfernt · Bereich aus Maske · Neu-Vorschlag
  nach Leeren · i18n `pod_icd_nach_feld2`, `pod_icd_je_feld` (de/en/tr) · Preflight-Fix · Tests
  `module/icd-dg-verdrahtung.test.js`, `preflight.test.js` +1 · Browser-Probe `tools/browser-probe/icd-dg-probe`
  (echte Maske aus `dashboard.html`, echte Tastatur + Tab) in `npm run probe`.
- `0e163ba` — Speicher-Regel als `icdMehrAlsEinKodeJeFeld` ins Modul (testbar) · Belege in [[SPEC-RULES]] ·
  `?v=20260926b`.

## Geprüft / ungeprüft

- ✅ `node --test module/*.test.js` 1054/1054 · Backend `billing` + `ai` 322/322 (nach `npm ci`) · Browser-Probes
  `icd-dg` 15/15, `modul` 91/91, `verordnung-maske` 33/33, `podo-maske` 32/32 · Mutationsproben: Tests schlagen ohne Fix an.
- ✅ **Live (angemeldet, Ergebnis von Melih gemeldet):** Aufteilen, d, d2.
- ⚠️ **Live nicht gesehen:** die Zeile „Mehr als zwei ICD-Codes …" im Speicher-Dialog. Nur per Test belegt (s. Lernpunkte).
- ❌ Szenarien „h" und „i" aus der ursprünglichen Meldung sind nirgends definiert.

## Lernpunkte

- **Zwei Schreiber auf ein Feld = Wettlauf.** Wer zuerst aus dem Netz kommt, gewinnt — Tests mit gecachten Regeln sehen
  das nie. Prüffrage vor jeder Automatik: *Wer schreibt dieses Feld noch?* (dritter Wettlauf an diesem Tag, vgl.
  [[2026-09-26_qa-test-sieben-befunde]] Befunde 1 und 3).
- **Feld und Datenmodell müssen dieselbe Kardinalität haben.** Ein Feld, das Listen annimmt, und eine Spalte für einen
  Wert erzeugen Fehler, die erst in der Abrechnung sichtbar werden.
- **`window.confirm()` ist für Browser-Automatisierung unsichtbar.** Regeln, die nur in einem nativen Dialog sichtbar
  werden, als reine Funktion testen; der Dialog selbst braucht einen Handgriff.
- **Mandanten-Fachbereich ≠ Fachbereich der Verordnung** — bei interdisziplinären Praxen gilt, was angekreuzt ist.
- **Geteiltes Arbeitsverzeichnis heißt auch geteilter Git-Index.** Parallel-Sitzungen committen dazwischen; nur eigene
  Hunks stagen (`git apply --cached`), nie `git commit -- <pfad>` bei gemischten Dateien, danach prüfen, dass nichts
  Fremdes zurückgedreht wurde.
- „Rote Tests" zuerst auf Umgebung prüfen: die drei Verschlüsselungstests scheiterten nur am lokal fehlenden `asn1js`.

## Offen

- Einmal von Hand (ohne Automatisierung): `E11.74, L60.0, G63.2` in Feld 1 → Speichern → Zeile „Mehr als zwei ICD-Codes …"
  im Dialog → Abbrechen.
- KBV-Vordruckerläuterung Muster 13 beschaffen (Protokoll `wissensbank/README.md`), Kästchenzahl belegen.
- Vom 25.09. weiter offen: L4 (Hinweis bei fachfremdem/„unsicherem" ICD), Kennzeichnung „aus ICD", Frontend-Blocker
  `PFLICHT_ICD` bei Klartext-Diagnose, Kommentar-Zitate „Anlage 3 k der HeilM-RL". Erledigt davon: L5, L6, Umzug nach `module/`.
