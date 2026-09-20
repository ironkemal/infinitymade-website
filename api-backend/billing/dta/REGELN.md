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
2. **`F:03002` — Sammelrechnungsnummer „max. 14 Zeichen".** Diese Grenze ist
   im Text von Anlage 1 TP5 V21 nicht auffindbar (Kap. 5.5.2, REC). Woher
   stammt sie? Wenn die echte Grenze größer ist, weisen wir heute gültige
   Nummern ab; wenn sie kleiner ist, lassen wir ungültige durch.
3. **`S:01005` (Leistungsdatum in der Zukunft) ist heute `hart`.** Das war die
   Ursache von `c4332d5`. Richtig ist die Regel — aber sollte sie die ganze
   Datei kosten oder nur den einen Abrechnungsfall herausnehmen?
4. **`kasse: 'unbekannt'`** steht bei 8 Regeln. Für jede davon wäre die
   Prüfstufe (1/2/3) hilfreich, falls sie sich belegen lässt.
