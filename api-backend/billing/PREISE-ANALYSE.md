# Woher kommen die Preise? — Bestandsaufnahme

**Stand:** 10.08.2026 · **Anlass:** Loop-Aufgabe 2 „Zuzahlung- und GKV-Preise zentral und
versioniert pflegen" (`Podoloji/loop-tasks-kassieren.md`).

Melih hat am 10.08.2026 entschieden: **erst analysieren, nicht umbauen.** Dieses Dokument
ist die Analyse. Es ändert nichts am Code.

---

## Kurzfassung

Es gibt **drei** Preisquellen, nicht eine. Zwei davon sind Codedateien, eine ist eine
Datenbanktabelle. Sie werden von unterschiedlichen Codepfaden gelesen, und sie können
sich widersprechen — die gedruckte Patientenrechnung und die §302-Datei an die Kasse
laufen über getrennte Wege.

Versionierung („gültig ab") gibt es **nur bei Podologie** vollständig. Physio-Preise
gelten zeitlos, obwohl der Dateikopf sie als „valid from 2026-01-01" bezeichnet.

---

## Die drei Quellen

### 1. `billing/codes/physio_positions.js` — Physio, **ohne** Datumsfenster

58 Positionen, Form `{ x, label, preis, zuzahlung, dauer, kat, gruppe?, telemed?, hausbesuch? }`.

- **Kein `gueltig_ab`, kein `gueltig_bis`.** Der Dateikopf (Zeile 3) sagt
  „Valid from 2026-01-01", das ist aber ein Kommentar, kein Feld.
- `findPosition(code, abrechnungscode)` nimmt **kein Datum** entgegen — es gibt zu jedem
  Code genau einen Preis, für alle Zeiten.
- **Folge:** Eine Behandlung aus Dezember 2025, die heute abgerechnet wird, bekommt den
  2026er Preis. Rückwirkende Abrechnungen und Korrekturverfahren rechnen mit dem falschen
  Betrag, und zwar ohne Fehlermeldung.

### 2. `billing/codes/podologie_positions.js` — Podologie, **korrekt versioniert**

Zwei Preistabellen: `PODOLOGIE_POSITIONS_2025` (ab 01.07.2025) und `_2026` (ab 01.07.2026).
Jede Zeile trägt `gueltig_ab`, `gueltig_bis`, teils `deprecated`, `ersetzt_durch`,
`ungueltig_ab`, `max_pro_tag`, `max_pro_termin`.

`findPodologiePosition(hpnr, dateStr)` filtert auf `gueltig_ab <= d && gueltig_bis >= d`.
**Das ist das Modell, das für Physio fehlt.**

### 3. DB-Tabelle `heilmittel_tarif` — die einzige Quelle mit Region und Kasse

Spalten: `bundesland, kostentraeger_ik, position_nr, heilmittel_code, preis_eur,
zuzahlung_pflicht, gueltig_ab, gueltig_bis` (`database_v11_billing_a2.sql:36`).

- Befüllt von `seed_tarifs.js`: 16 Bundesländer × Physio-Positionen, **alle** mit
  `gueltig_ab: '2026-01-01'`, `gueltig_bis: null`, `kostentraeger_ik` leer.
  Die Bundesland- und Kassen-Dimension existiert also im Schema, ist aber ungenutzt —
  überall steht derselbe Bundespreis.
- Gelesen von `findPriceForDate()` (`billing/api/abrechnung.routes.js:80`), eingesetzt in
  der §302-Sammelabrechnung (`:147`, `:178`) mit Rückfall auf die Codedatei.

### Projektion: `heilmittel_katalog`

`sync_heilmittel_katalog.js` schreibt beide Codedateien in die Tabelle `heilmittel_katalog`
(Konfliktschlüssel `bereich,code,gueltig_ab`). Der Dateikopf ist eindeutig:

> „Quelle der Wahrheit bleiben die Codedateien … Diese Tabelle ist nur ihre Projektion."

Aus dieser Tabelle speist sich die Oberfläche (`katalog-suche.js` → RPC `search_heilmittel`).
Physio-Positionen bekommen dabei die Ersatzwerte `gueltig_ab = '1900-01-01'` und
`gueltig_bis = '9999-12-31'` (`sync_heilmittel_katalog.js:57`).

---

## Wo es sich widerspricht

**1. Rechnungsdruck und §302 nehmen verschiedene Wege.**
`GET /prescription/:id/zuzahlungsrechnung` und `…/rechnung` fragen `heilmittel_tarif`
**gar nicht** ab — sie gehen direkt an die Codedateien. Die §302-Sammelabrechnung fragt
zuerst `heilmittel_tarif`. Sobald jemand einen Tarif in der DB ändert, weichen die
gedruckte Rechnung und die Datei an die Kasse voneinander ab.

**2. Die Zuzahlungsformel steht zweimal im Code.**
`billing/zuzahlung/calculator.js` und `billing/dta/builder.js:68` rechnen unabhängig
voneinander. Unterschiede: der Builder richtet sich nach dem DTA-Zuzahlungskennzeichen
statt nach den drei Befreiungsflags, multipliziert mit `anzahl`, und benutzt `||` statt
`!= null` — dadurch kippt eine Zuzahlung von **exakt 0** in den 10-%-Fall.

**3. `heilmittel_tarif.zuzahlung_pflicht` verliert die genauen Beträge.**
Das Feld ist ein Boolean; bei `true` rechnet der Code pauschal `preis * 0.10`
(`abrechnung.routes.js:150`, `:181`). Die exakten Zuzahlungsbeträge aus den Codedateien
(z. B. Podologie 78010 → 3,52 €) gehen auf diesem Weg verloren.

**4. Physio kann Preisänderungen nicht abbilden.**
Die Heilmittelpreise ändern sich regelmäßig zum 01.07. Bei Podologie ist das im Datenmodell
vorgesehen, bei Physio nicht — dort müsste man die Datei überschreiben und verlöre damit
den alten Preisstand.

**5. `heilmittel_katalog` hat keine Migrationsdatei im Repo.**
Die Tabelle existiert nur in Supabase und in den Erwartungen des Sync-Skripts. Für die
geplante On-Premise-Migration (`ONPREM_MIGRATION_PLAYBOOK.md`) fehlt damit die Definition.

---

## Wenn umgebaut wird: der kleinste sinnvolle Schnitt

Nicht jetzt umsetzen — hier nur festgehalten, damit die Entscheidung später nicht neu
erarbeitet werden muss.

1. **Physio wie Podologie versionieren.** `gueltig_ab`/`gueltig_bis` an jede Zeile,
   `findPosition(code, abrechnungscode, datum)` datumsabhängig machen. Keine alten
   Preisstände erfinden — nur das bekannte Startdatum eintragen. Damit sind künftige
   Preisrunden abbildbar, ohne die Historie zu verlieren.
2. **Eine Preisauflösung für alle Pfade.** Eine Funktion, die Bereich + Code + Datum
   entgegennimmt und Preis + Zuzahlung liefert; Druckrouten und §302 rufen dieselbe auf.
3. **Die zweite Zuzahlungsformel in `dta/builder.js` durch `calculator.js` ersetzen.**
4. `heilmittel_tarif` entweder ernsthaft nutzen (Bundesland/Kasse befüllen und
   `zuzahlung_eur` statt `zuzahlung_pflicht` führen) oder abschaffen. Der heutige
   Zwischenzustand ist die Hauptquelle der Widersprüche.

Schritt 1 und 3 sind klein und gut testbar. Schritt 4 ist die eigentliche Entscheidung
und sollte nicht nebenbei fallen.

---

## Offene Fachfrage für `gkv-302`

**Löst eine Verordnung, die ausschließlich aus zuzahlungsfreien Positionen besteht, die
10-€-Verordnungspauschale aus?**

Stand 10.08.2026 lautet die Antwort im Code **ja** — sowohl auf der Rechnung als auch im
§302-Weg (`dta/builder.js` berechnet sie, sobald das Zuzahlungskennzeichen `0` ist).
Beide Wege sind sich also einig, was wichtiger ist als die Frage selbst: weichen sie
voneinander ab, zieht die Kasse einen anderen Betrag ab als auf der Patientenrechnung steht.

Der häufigste Fall in der Praxis ist ohnehin abgedeckt: bei **KG-ZNS Kinder** ist der Patient
unter 18, und `calcAbrechnungsfallZuzahlung` setzt dann alles auf 0 — Prozente **und**
Pauschale. Offen bleibt der seltene Fall eines erwachsenen Patienten auf einer rein
zuzahlungsfreien Position (z. B. Therapiebericht als einzige Position einer Verordnung).

Vor der ersten echten Abrechnung sollte das jemand mit §302-Kenntnis bestätigen.

---

## Was hier NICHT drinsteht

Ob die aktuell hinterlegten Preise **inhaltlich** korrekt sind. Dafür müssten die
Beträge gegen die Vertragsanlagen geprüft werden
(`Handbücher/INDEX.md` → Anlage 2 Physiotherapie bzw. Podologie). Das ist eine eigene
Aufgabe und in dieser Analyse bewusst nicht enthalten.
