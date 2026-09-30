# Preflight-Regeln: hart oder Warnung — und wie eine falsche Regel wieder rausgeht

> Entstanden zu Schritt 1.9c aus `ABRECHNUNG_ECHTBETRIEB_PLAN.md`
> (Befund `onprem` O-113, 20.09.2026). Zugehöriger Code:
> `regel-schwere.js` (Liste) · `regel-schwere.test.js` (Tor) · `preflight.js` (Regeln).

---

## 1. Worum es geht

`preflight()` wirft hart: schlägt eine Regel an, entsteht **gar keine Datei**.
Das ist die richtige Bauart. Eine §302-Datei mit falschen Zählern oder einem
leeren Muss-Segment wird von der Annahmestelle nicht zeilenweise beanstandet,
sondern **komplett** zurückgewiesen — sie gar nicht erst entstehen zu lassen,
ist billiger als ein verlorener Einreichungszyklus.

Der Preis ist die **Verteilung**. Das Regelwerk reist im Container-Image:

| Wo | Wie schnell ist eine falsche Regel wieder weg |
|---|---|
| SaaS (Hetzner) | ~4 Minuten: `git push` → GitHub Actions (~3 min, Image nach GHCR) → Watchtower pollt alle 60 s |
| Kundenbox, Kanal `:beta` | Nach dem nächsten Watchtower-Durchlauf der Box — frühestens Minuten, praktisch die nächste Nacht |
| Kundenbox, Kanal `:stable` | Erst mit dem nächsten Release-Tag (Playbook K11 / Faz 4.3) — Tage |
| Box ohne GHCR-Zugang | **Gar nicht**, bis jemand `update.sh` von Hand fährt |

Und: **wir sehen es nicht.** Aus den Boxen kommt keine Telemetrie (O-46). Eine
falsche harte Regel hält also die Abrechnung jedes betroffenen Kunden an, ohne
dass irgendwo eine Lampe angeht.

Das ist keine Befürchtung, sondern ein Vorfall. Commit `c4332d5` war genau
diese Sorte: **eine einzige** Behandlung mit einem Datum in der Zukunft ließ
die komplette Datei scheitern (Regel `S:01005`).

---

## 2. Die Klassifikation

`regel-schwere.js` führt jede Regel mit drei Angaben:

| Feld | Werte | Bedeutung |
|---|---|---|
| `schwere` | `hart` · `warnung` · `beides` | `hart` = `E()`, die Datei entsteht nicht · `warnung` = `W()`, die Datei entsteht |
| `kasse` | `datei` · `zeile` · `unbekannt` | Was die Annahmestelle täte, wenn es doch durchginge |
| `quelle` | Fundstelle oder `hausregel` | Spezifikationsstelle — oder ausdrücklich unsere eigene Sorgfaltsregel |

**`unbekannt` ist erlaubt und kommt oft vor.** Die Spezifikation nennt die
Prüfstufe nicht bei jedem einzelnen Feld. Eine erfundene Angabe wäre schlimmer
als eine fehlende: sie würde bei der nächsten Abwägung als Tatsache gelesen.

**`hausregel` ist ebenfalls erlaubt.** Manche Prüfungen schützen den Anwender
vor sich selbst (Tippfehler im Betrag) oder vor einer Absetzung, ohne dass die
Spezifikation sie verlangt. Das gehört benannt — gerade weil eine Hausregel
leichter zu lockern ist als eine Vertragspflicht.

---

## 3. Eine neue Regel einbauen

1. Regel in `preflight.js` schreiben.
2. **Vorher entscheiden: hart oder Warnung?**
   Faustregel: hart nur, wenn die Annahmestelle die **ganze Datei** zurückwiese.
   Betrifft der Fehler nur einen Abrechnungsfall, ist eine Warnung meist
   richtiger — die übrigen Fälle sollen Geld bringen.
3. **Eine neue HARTE Regel braucht die Zustimmung von `gkv-302`.**
   Nicht als Formalie: die Frage lautet „weist die Kasse dafür wirklich die
   Datei ab?", und sie ist aus der Spezifikation zu beantworten, nicht aus dem
   Bauch. Fällt die Antwort „nur die Zeile" aus, gehört die Regel zu `W()`.
4. Eintrag in `regel-schwere.js` ergänzen — mit Fundstelle.
5. `node --test api-backend/billing/dta/regel-schwere.test.js` muss grün sein.

Das Tor lässt sich nicht vergessen: ohne Eintrag schlägt der Test fehl, und die
Fehlermeldung nennt die Zustimmungspflicht.

⛔ **Was das Tor NICHT kann:** es prüft, ob eine Regel *klassifiziert* ist,
nicht ob die Klassifikation *stimmt*. Wer `hart` einträgt, wo `warnung` richtig
wäre, kommt durch. Das Tor ersetzt das Gespräch mit `gkv-302` nicht, es
erinnert nur daran.

---

## 4. Wenn eine falsche Regel schon draußen ist

**SaaS.** Korrektur committen und pushen. Ab `git push` bis live ~4 Minuten
(GitHub Actions ~3 min, Watchtower-Poll 60 s). Danach mit `canli-test`
nachsehen, dass die Abrechnung wieder durchläuft — nicht auf den grünen
Build-Haken vertrauen.

**Kundenbox.** Hier gibt es keinen schnellen Weg, und das ist der Grund für
diese ganze Datei:

- Kanal `:beta` bekommt jeden main-Push automatisch (Playbook K11) — die
  Korrektur kommt also, aber nicht sofort und nicht beobachtbar.
- Kanal `:stable` bekommt sie erst mit dem nächsten Release-Tag (Faz 4.3).
  Für einen Abrechnungs-Blocker heißt das: **es braucht einen außerplanmäßigen
  Release**, kein Warten auf den nächsten regulären.
- Eine Box ohne GHCR-Zugang bekommt sie gar nicht. Dort bleibt nur der Weg
  über `update.sh` am Kundensystem.

⚠️ **Der Kunde meldet sich nicht unbedingt.** Er sieht eine Fehlermeldung beim
Erstellen der Abrechnung und denkt, er habe etwas falsch gemacht. Wer eine
harte Regel ändert, sollte deshalb selbst nachfassen, statt auf einen Anruf zu
warten.

---

## 5. Offene Fragen an `gkv-302`

Aufgenommen beim Klassifizieren am 20.09.2026, **nicht** eigenmächtig
entschieden:

1. **`D:01001` ist doppelt belegt.** Derselbe Code steht einmal als Fehler
   (LANR nicht 9-stellig) und einmal als Warnung (Prüfziffer stimmt nicht).
   Für den Anwender sind die beiden Fälle damit nicht unterscheidbar.
   Vorschlag: die Warnung bekommt einen eigenen Code. Nicht hier geändert —
   das wäre eine Verhaltensänderung an einer Regel, und genau dafür gilt der
   Absatz oben.
2. **`S:01005` (Leistungsdatum in der Zukunft) ist heute `hart`.** Das war die
   Ursache von `c4332d5`. Richtig ist die Regel — aber sollte sie die ganze
   Datei kosten oder nur den einen Abrechnungsfall herausnehmen?
3. **`kasse: 'unbekannt'`** steht bei 8 Regeln. Für jede davon wäre die
   Prüfstufe (1/2/3) hilfreich, falls sie sich belegen lässt.

---

## 6. Beschlossene Änderungen und Belege (20.09.2026)

### Beantwortete Fragen
- **`F:03002` (Sammelrechnungsnummer max. 14 Zeichen):** Belegt durch Anlage 1 TP5 V21,
  Kap. 5.5.2 (SLGA REC, S. 34) und Kap. 5.5.3.1 (SLLA REC, S. 44): Sammel-Rechnungsnummer
  `..14 AN M` (Notation Kap. 5.1 (8): `..n` = höchstmögliche Stellenbelegung, alphanumerisch, Mussfeld).
  Prüfstufe 2 (Anhang 2 Kap. 9 § 3.2) weist bei Längenverstoß die ganze Datei ab (`kasse: 'datei'`, `schwere: 'hart'`).

### Neue harte Regeln (Zustimmung von `gkv-302` liegt vor)
Gemäß § 3 Punkt 3 wurden folgende neue harte Regeln nach Freigabe durch `gkv-302` aufgenommen:
- **`F:03006` — Zeichenvorrat Sammelrechnungsnummer:** Nur Alphanumerik (`A-Z`, `a-z`, `0-9`),
  als Gliederungszeichen ausschließlich `-` und `/`, nie am Anfang oder Ende, nie aufeinanderfolgend
  (Anlage 1 TP5 V21, Kap. 5.5.2 SLGA REC, S. 34 + Kap. 5.5.3.1 SLLA REC, S. 44). `kasse: 'datei'`, `schwere: 'hart'`.
- **`F:03007` — Länge Einzelrechnungsnummer:** Höchstens 6 Stellen (`..6 AN M`, Anlage 1 TP5 V21,
  Kap. 5.5.3.1 SLLA REC, S. 44). Ein Längenverstoß führt in Prüfstufe 2 zur Abweisung der Datei (`kasse: 'datei'`, `schwere: 'hart'`).
- **`V:01017` — Karten-IK Pflicht (30.09.2026):** Anlage 1 TP5 V21 §5.5.2 S. 32 („zwingend anzugeben,
  außer es handelt sich um eine Sammelrechnung-SLGA … identisch mit SLLA.FKT") + §5.5.3.1. Feldart NK,
  Pflicht aus der Erläuterung (nicht aus der Feldart). `kasse: 'unbekannt'` (Prüfstufe nicht belegt),
  `schwere: 'hart'`. Kein Rückfall auf die Kostenträger-IK (vgl. `F:03006`/`F:03007` oben).
- **`V:01018` — ICD↔Diagnosegruppe (30.09.2026, Oturum C):** Zustimmung `gkv-302` 30.09.2026
  (Devir A→B §2.1). Hart nur bei Status `mismatch` in einer DG mit `icd_enforcement =
  'hard_before_dta'` (UI1/UI2; DF/NF/QF seit Migration 0047) **und** fehlendem Diagnosetext.
  DF/NF/QF mit Diagnosetext → Warnung (FAK Podologie Nr. 28). `unsicher`/nicht endständig bleiben
  Warnung. `kasse: 'zeile'` — kein Prüfstufe-1-3-Grund, Folge ist die Absetzung der Verordnung.
- **`S:01013` — ein Behandlungstag je Tag (30.09.2026, Oturum C):** Zustimmung `gkv-302`
  30.09.2026 (Devir §2.4). HeilM-RL § 12 Abs. 8: mehr als eine 78010/78020 je Kalendertag an
  derselben Verordnung → keine Datei. 78610 bis 2× je Tag (Anlage 2 § 2 c), 78620 zählt nicht.
  Regel: `billing/utils/behandlungstage.js`. `kasse: 'zeile'`.

