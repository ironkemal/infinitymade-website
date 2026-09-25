---
titel: Ops #304 — ICD-Code setzt die Diagnosegruppe (Podologie): nur leeres Feld, nie die ärztliche Angabe
datum: 2026-09-25
typ: sitzung
ticket: "Ops #304"
bereich: podologie (Abgrenzung physiotherapie, ergotherapie, logopaedie)
status: L1–L3 umgesetzt und lokal getestet · committet (a7b1ff3), nicht gepusht, nicht live · L4 + Kennzeichnung „aus ICD" offen
tags: [sitzung, muster-13, diagnosegruppe, icd-10, podologie, anlage-3-podologie, dta-zhe, automatik]
verwandt: ["[[SITZUNGEN]]", "[[SPEC-RULES]]", "[[REGISTER]]", "[[INDEX]]", "[[2026-09-21_ops-300_ik-suche-kassenfeld]]"]
---

# Ops #304 — ICD-Code setzt die Diagnosegruppe (Podologie)

## In einem Satz

Die Automatik ICD → Diagnosegruppe (DG) war schon da, hat aber eine vom Papier geladene oder von Hand gewählte DG still
überschrieben, sich nach dem ersten Klick ins Feld für die ganze Sitzung abgeschaltet und bei mehrdeutigen Kodes
geraten. Jetzt gilt: **die Automatik füllt nur ein leeres Feld oder ersetzt ihren eigenen Vorschlag — die DG auf der
Verordnung ist ärztliche Angabe und wird nie geändert.**

## Ausgangslage

- Beta-1-Wunsch (Meeting 18.09.2026): „ICD-Code soll die Diagnosegruppe automatisch setzen".
- Vorhanden: einziger Matcher `icd-dg-match.js` (`dgVorschlag`, `autoSelectDg`, `matchIcdToDg`), Verdrahtung
  `dashboard.js` `_wireDgIcdPair` (Feldpaar `rzIcd` → `rzDg`, Hinweis `rzIcdDgWarning`), Brücke `ensureDgIcdWiring`
  → `module/verordnung-maske.js` `fuelleMuster13` (Scan, Bearbeiten, Folgeverordnung), Regeln aus Tabelle
  `diagnosegruppen` (`module/diagnosegruppen-regeln.js`).
- Test `module/icd-dg-vorschlag.test.js` prüfte nur die reine Logik, nicht die Verdrahtung.

## Was gefunden wurde

Reproduziert mit einem Harness im Scratchpad: Quelltext von `_wireDgIcdPair` unverändert aus `dashboard.js`
ausgeschnitten, gegen Fake-DOM und die Podologie-Regelkopie aus dem Test ausgeführt. **Kein Browser, keine Live-Daten.**

| # | Lücke | Stelle (vor dem Fix) |
|---|---|---|
| L1 | Geladene DG (Scan/Bearbeiten/Folge) wird durch den Vorschlag ersetzt, „DF-a" wird zu „DF" | `_setDgProgrammatically` prüfte nur `manualOverride` |
| L2 | `manualOverride` wurde nie gelöscht und schon durch den Fokus-Anstoß (`input`) und `verordnung-podo.js:schreibe()` gesetzt → Automatik für die Sitzung tot | `markManual` auf `input` + `change` |
| L3 | E11.74 + L60.0 → DF gesetzt, obwohl DF/UI1/UI2 in Frage kommen | `autoSelectDg` wertet UI1/UI2 nicht aus (leeres `icd_auto_select`) |
| L4 | Fachfremder (Z99.9) oder „unsicherer" Kode (E11.72/.73) bei leerer DG → kein Hinweis | Hinweis nur bei > 1 Kandidat |
| L5 | Zweiter Schreiber auf `rzDg` mit anderer Regel | `module/verordnung-podo.js:494-521` (`dgAuswahlEingrenzen`, `podRegelnLaden`) |
| L6 | Fachbereich kommt aus dem Mandanten, nicht aus dem Formular | `_getDiagnoseBereich()`, beim Verdrahten eingefroren |

Das externe Review (Skill `code-review`) fand im ersten Fix eine weitere Lücke: ein automatisch gesetztes DF blieb
stehen, wenn danach L60.0 dazukam (Mehrdeutigkeit) — ohne Hinweis und ohne Warnung. Behoben (s. Gebaut).

## Norm und Praxis (Befragung 25.09.2026)

- `gkv-302`, mit Quellen (gegengeprüft in [[SPEC-RULES]], soweit dort eingetragen):
  - Die DG darf **nur der Arzt** ändern — Podologie-Vertrag Anlage 3, Ziffer 5 j
    (`podologie/20250617_Podologie_Anlage_3_Lesefassung.txt`); HeilM-RL Anlage 3 Zeile j.
  - In der DTA (SLLA B, ZHE) steht die DG **der Verordnung**, fehlt sie „9999" — Anlage 1 TP5 V21, 5.5.3.3.
  - Pflicht ist die **Diagnose**, der ICD kann durch Klartext ersetzt werden (Anlage 3 Ziffer 5 k; TA1 DIA).
    Der Code-Kommentar „ICD nach Anlage 3 k HeilM-RL nicht Pflicht" ist deshalb ungenau.
  - E11.74 + L60.0 nebeneinander ist zulässig („weitere Angaben unschädlich"), welche DG gilt, entscheidet das Papier.
- Gegenprüfung gegen die Originale (Ersatz für den in dieser Sitzung nicht verfügbaren `wissensbank`-Agenten, Ergebnis
  in [[SPEC-RULES]]): Regeln 1–3 bestätigt, mit Präzisierungen — HeilM-RL Anlage 3 Zeile j steht bei `:2373`; die DG
  ist auch nach der Abrechnung einmal über die Absetzung korrigierbar (Frist 3 Monate); „ohne ICD, nur Klartext" stützt
  sich **allein** auf Anlage 3 Podologie 5 k („und/oder als Klartext"), die HeilM-RL § 13 Abs. 2 k sagt „grundsätzlich
  als ICD-10-Code"; ob L60.0 in UI1/UI2 als Klartext genügt, lässt der Text offen. **FAK Nr. 28 regelt keine Frist**,
  nur die Heilung eines falschen ICD durch therapierelevanten Freitext — die Frist „vor Einreichung" stützt sich auf 5 k.
  In ZHE sind nur Ziffern/Buchstaben erlaubt (kein `DF-c`); „9999" ist Füllwert, keine Heilung einer fehlenden DG.
- `podoloji`: Die Podologin tippt ein ärztliches Formular ab — Automatik nur als Abtipphilfe für ein leeres Feld,
  ein Klick ins Feld ist keine Entscheidung, Leeren gibt die Automatik frei, Mehrdeutigkeit → anbieten statt setzen.
  Wunsch: Kennzeichnung „aus ICD" am vorgeschlagenen Wert, Kandidaten als Knöpfe. (Annahmen, nicht mit Beta-1 geprüft.)

## Entschieden (Melih, 25.09.2026)

- Jetzt nur L1–L3; L4 und die Kennzeichnung „aus ICD – mit Verordnung abgleichen" als Folgeschritt.
- Leeres DG-Feld wird weiter automatisch gefüllt (Beta-1-Wunsch), aber künftig als Vorschlag gekennzeichnet.
- Produktentscheidung eingetragen in `Podoloji/PRODUKT-ENTSCHEIDUNGEN.md`.

## Verworfen

- **`e.isTrusted` in `markManual`** (echte Eingabe von künstlicher unterscheiden): scheitert, weil `katalog-suche.js:236-237`
  bei echter Auswahl aus der Liste ebenfalls künstliche `input`/`change` feuert — die Handauswahl wäre nicht mehr erkannt worden.
- **`manualOverride` in `fuelleMuster13` setzen** (`module/verordnung-maske.js`): hätte fünf Importer mit neuer
  Cache-Version (`?v=`) erfordert — alle müssen dieselbe Version tragen, sonst entstehen zwei Modulinstanzen mit
  getrennter Brücke. Ersetzt durch die Marke `dgAuto` (Besitz statt Handmarke) und eine Zeile in der Brücke.
- **`autoSelectDg` ändern:** bricht die Parität mit `api-backend/ai/validators/icdDgRules.js`. Stattdessen entscheidet
  `dgVorschlag` (nur Frontend, einziger Verbraucher `_wireDgIcdPair`).
- **Automatik sofort beim Tippen zurücknehmen:** Zwischenstände wie „E11.7" hätten DF ständig entfernt und neu gesetzt
  und abhängige Logik (Wagner-Feld, Heilmittelliste) mitgerissen. Zurückgenommen wird nur beim Verlassen des ICD-Feldes.

## Gebaut (Commit `a7b1ff3`, nicht gepusht)

- `icd-dg-match.js` `dgVorschlag`: `auto` nur, wenn keine andere Gruppe per `icd_accept` ebenfalls passt.
- `dashboard.js` `_wireDgIcdPair`: Marke `dataset.dgAuto` statt `manualOverride`; ersetzt wird nur ein leeres Feld oder
  der eigene Wert; beim Verlassen des ICD-Feldes nimmt die Automatik ihren Vorschlag zurück, wenn er nicht mehr eindeutig
  ist oder der ICD geleert wurde; `markManual` nur auf `change`; Kandidaten-Hinweis immer bei > 1 Kandidat.
- Brücke `ensureDgIcdWiring` löscht `dgAuto` vor dem Laden → geladene DG gilt als Papierwert.
- i18n `pod_icd_mismatch` (de/en/tr): „Der ICD benennt nicht die für diese Diagnosegruppe geforderte Diagnose".
- Cache: `icd-dg-match.js?v=20260925a`, `dashboard.js?v=20260925a`. `dashboard.js` bleibt bei 20763 Zeilen (Gate).
- Tests: `module/icd-dg-vorschlag.test.js` +2 (E11.74 + L60.0 → kein Vorschlag; `auto_select` ohne Mitbewerber bleibt).

## Geprüft / ungeprüft

- ✅ `node --test module/*.test.js` 1032/1032 · `tools/check-dashboard-size.sh` exit 0 · `npm run probe` exit 0.
- ✅ Harness: 18 von 20 Soll-Fällen, die zwei offenen sind L4 (bewusst Folgeschritt).
- ⚠️ `npm test` gesamt: 3 Fehler in `api-backend/billing/…verschluesselung*`/`itsg-trust-anchor` — fehlendes Paket
  `asn1js` lokal, unabhängig von #304.
- ❌ **Live ungetestet.** Harness nutzt die Regelkopie aus dem Test, nicht die Live-Tabelle; Seed-QF wählt mehr Kodes
  automatisch als die Kopie.

## Lernpunkte

- Eine Handmarke („manuell") ist die falsche Frage. Die richtige ist **wem der Wert gehört**: ein Wert, den die
  Automatik nicht selbst gesetzt hat, ist Angabe des Arztes — egal auf welchem Weg er ins Feld kam.
- „Eindeutig" heißt: genau ein Treffer **und** kein Mitbewerber über eine andere Regelspalte.
- Wer einen Vorschlag setzt, muss ihn auch zurücknehmen können.

## Offen

- L4-Hinweise + Kennzeichnung „aus ICD" (braucht neue i18n-Texte; `dashboard.js` ist am Gate → `_wireDgIcdPair` nach
  `module/` umziehen, vorher `fonksiyon-ustasi`).
- Push, Live-Durchgang (`canli-test`, Szenarien a–g in `canli-test/REGISTER.md`).
- Folgekarten: Frontend-Blocker `PFLICHT_ICD` (`module/verordnung-pruefung.js:182-183`) sperrt Klartext-Verordnungen,
  die abrechenbar wären · Backend sperrt UI1/UI2-Mismatch nicht · `dgOptionenSperren` mit `raeumen` würde eine
  ärztliche DG leeren (heute unerreichbar) · Kommentare zitieren „Anlage 3 k der HeilM-RL" statt Anlage 3 Podologie
  Ziffer 5 k (`icd-dg-match.js:60,193`, `icdDgRules.js:10-11,71`, `abrechnung.routes.js:3012,3247`, `preflight.js:331`) ·
  SPEC-RULES-Regel „DIA je Diagnose" als unumgesetzt geführt, `dta/builder.js:222-235` schreibt aber schon je ICD ein
  DIA — prüfen · L5 · L6.
