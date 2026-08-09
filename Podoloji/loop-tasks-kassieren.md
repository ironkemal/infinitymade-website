# Loop-Liste: Kassieren, Zuzahlung, Rechnungen

Quelle: Ops-Dashboard → Podoloji → "Kassieren, Zuzahlung ve fatura akışı" (Meeting 08.08.2026)
Regel für den builder-Agenten: von oben nach unten abarbeiten. Ein Punkt mit `Zuerst:` erst
angehen, wenn die genannte Nummer `[x]` ist.

- [x] 1. Kassieren-Ablauf neu bauen — Zahlart wählen (Bar/Überweisung) → Drucken → als "kassiert" markieren [Priorität: Hoch]
      Geändert: `database_v32_kassieren_zahlart.sql` (neu) · `dashboard.js` (Dialog `openKassierenDialog`,
      `kassiereZuzahlung`, `storniereZuzahlung`, `openZuzahlungsrechnung`, i18n de/en/tr, beide
      Einstiegspunkte, `flipAbrechnungStatus` entkoppelt) · `dashboard.html` (Kassenbuch-Spalte Zahlart,
      Cache-Version) · `dashboard.css` (`--success`, `--success-dim`, `--warning-text`) ·
      `api-backend/billing/belegliste/helper.js` · `api-backend/billing/belegliste.test.js` ·
      `api-backend/billing/api/abrechnung.routes.js` (Zahlart + Token-Fix) ·
      `api-backend/billing/api/mahnwesen.routes.js` (Stornos gegenrechnen)
      ⚠️ SQL-Migration muss vor dem Deploy im Supabase SQL-Editor laufen.

- [ ] 2. Zuzahlung- und GKV-Preise zentral und versioniert pflegen
      Code: prüfen wo Preise aktuell herkommen — `katalog-suche.js`, `api-backend/sync_heilmittel_katalog.js`.
      Vermutlich fehlt eine Tabelle mit "gültig ab Datum" für Preisänderungen.

- [x] 3. Ein-Klick-Zuzahlungsrechnung — 10 % vom Heilmittel + 10 €, automatisch berechnet
      (Sperre "Zuerst: 2" von Melih am 10.08.2026 aufgehoben — geht auch ohne den Preis-Umbau.)
      Geändert: `api-backend/billing/zuzahlung/calculator.js` (neu: `resolvePositionZuzahlung`) ·
      `api-backend/billing/zuzahlung/calculator.test.js` (10 neue Fälle) ·
      `api-backend/billing/api/abrechnung.routes.js` (Zuzahlungsrechnung + RZG-Quittung)
      Befund: Formel 10 % + 10 € war korrekt, aber zuzahlungsfreie Positionen wurden mit
      10 % belastet. Ein Klick liefert der Kassieren-Dialog aus Aufgabe 1.

- [x] 4. Zuzahlung-Bildschirm vereinfachen — nur Summe in Gelb, wird grün sobald bezahlt
      Geändert: `dashboard.js` (eine Zeile statt zwei, drei Zustände: befreit/offen/bezahlt) ·
      `dashboard.html` (Zeile "RZG" entfernt — zeigte denselben Betrag als Abkürzung nochmal) ·
      `dashboard.css` (`--success`, `--success-dim`, `--warning-text` als lesbare Textfarbe)
      Alle festen Farben (#fbbf24, #4ade80, rgba(34,197,94,…)) sind raus.

- [x] 5. Nach dem Kassieren dauerhafte Verlinkung zur Rechnung — von Termin/Patient aus öffenbar
      Geändert: `dashboard.js` (`openZuzahlungsrechnung`, Link im Termin-Panel und in der
      Patientenakte, Beleg-Nr. aus dem Kassenbuch in der Rezeptzeile)
      Der Link ist dauerhaft gültig: die Rechnung wird bei jedem Aufruf frisch aus dem Rezept
      erzeugt (Nummer ZU-<Rezept-ID>), es gibt keinen gespeicherten Rechnungsdatensatz.

- [ ] 6. Monatsübersicht Zahlungsstatus — welche Rechnung bezahlt, welche offen ist
      Code: `api-backend/billing/api/statistik.routes.js` prüfen, ob das schon als Basis reicht.

- [ ] 7. Ausfallrechnung-Muster von Stefan holen
      ⚠️ Menschliche Aufgabe, kein Code — der builder-Agent kann das nicht selbst erledigen.
      Melih muss das Muster besorgen, dann diesen Punkt selbst abhaken.

- [ ] 8. Ausfallrechnung-Vorlage mit Stefans Muster abgleichen und fertigstellen
      Zuerst: 7
      Code: `api-backend/billing/pdf/ausfallrechnung.template.js` + `ausfallrechnung.test.js`
      (Vorlage existiert schon, muss mit dem Muster verglichen werden).

- [ ] 9. Mahnung-Vorlage für unbezahlte Ausfallrechnungen
      Zuerst: 8
      Code: `api-backend/billing/pdf/mahnung.template.js` + `api-backend/billing/api/mahnwesen.routes.js`
      (existiert schon — prüfen ob Ausfallrechnung dort mit abgedeckt ist).

- [ ] 10. Bei Namenskorrektur automatisch aktuellen Namen auf neuer Rechnung anzeigen — kein Freitext auf der Rechnung erlaubt
      Code: `api-backend/billing/pdf/rechnung.template.js` prüfen, woher der Patientenname gezogen wird.

---

## Für den builder-Agenten

- Diese Datei ist die einzige Quelle für "was ist als nächstes dran".
- Nach jeder erledigten Aufgabe: Checkbox auf `[x]` setzen + eine kurze Zeile darunter,
  welche Dateien geändert wurden.
- Bei Punkt 7 (menschliche Aufgabe) oder bei echten Unklarheiten: nicht raten, anhalten,
  Melih in einfachen Worten fragen was fehlt.
- Themen rund um Zuzahlung/Abrechnung (§302 SGB V) sind rechtlich/fachlich heikel —
  im Zweifel lieber fragen statt selbst zu entscheiden.
