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

- [x] 2. Zuzahlung- und GKV-Preise zentral und versioniert pflegen
      Geändert: `api-backend/billing/preise/resolver.js` (neu: `resolvePreis`, `findTarifForDate`) ·
      `api-backend/billing/preise/resolver.test.js` (neu, 18 Fälle) ·
      `api-backend/billing/codes/physio_positions.js` (`PHYSIO_PREISFENSTER`, `findPosition`
      datumsfähig) · `api-backend/billing/api/abrechnung.routes.js` (alle 6 Preisstellen auf den
      Auflöser umgehängt, `findPriceForDate` entfernt, `zuzahlung`/`zuzahlung_frei` im
      `/positions`-Payload) · `api-backend/billing/dta/builder.js` (zweite Zuzahlungsformel raus) ·
      `dashboard.js` (beide Abrechnungs-Vorschauen rechnen zuzahlungsfreie Positionen als 0 €)
      Quelle geprüft: GKV-Anlage 2 erneut abgerufen — unverändert (i.d.F. 01.07.2025, zwei
      Preisfenster), Preise stimmen exakt mit der Referenzdatei überein.
      Befund: Druck und §302 nennen jetzt denselben Betrag. Zwei echte Geldfehler behoben —
      `||` in builder.js kippte eine Zuzahlung von genau 0 € in den 10-%-Zweig, und die
      Abrechnungs-Vorschau zeigte für zuzahlungsfreie Positionen 10 % statt 0 €.
      ⚠️ Offen gemeldet: 10-€-Verordnungspauschale bei rein zuzahlungsfreien Rezepten;
      Physio-`gueltig_ab` 2026-01-01 ist eine übernommene, nie gegen Anlage 2 geprüfte Annahme.

      ✅ Freigegeben (Entscheidung Melih, 10.08.2026): Umbau JA, Sperre aufgehoben.
      Analyse: `api-backend/billing/PREISE-ANALYSE.md`
      Kurz: es gibt DREI Preisquellen (physio_positions.js ohne Datumsfenster,
      podologie_positions.js mit, DB-Tabelle heilmittel_tarif). Die Druckrouten fragen
      heilmittel_tarif gar nicht ab — gedruckte Rechnung und §302-Datei können deshalb
      unterschiedliche Preise nennen.
      Offizielle Preisquelle für Podologie (von Melih geliefert, 10.08.2026):
      `api-backend/billing/GKV-PODOLOGIE-PREISE-2025-2026.md` — GKV-Spitzenverband
      Anlage 2 zum Vertrag § 125 Abs. 1 SGB V, zwei Preisfenster (ab 01.07.2025 und ab
      01.07.2026) pro HPNR. Genau diese Zwei-Fenster-Struktur muss die zentrale Tabelle
      abbilden können.

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

- [x] 6. Monatsübersicht Zahlungsstatus — welche Rechnung bezahlt, welche offen ist
      Geändert: `api-backend/billing/api/statistik.routes.js` (Offen-Reihe je Monat, offener
      Betrag statt nur Anzahl, Ausfallrechnungen mit drin, zwei kaputte Spaltennamen) ·
      `dashboard.js` (gestapeltes Balkendiagramm grün/gelb + Farblegende, KPI zeigt Betrag) ·
      `dashboard.html` (KPI-Kachel)
      Die Basis reichte nicht: es gab nur Umsatz (also ausschliesslich Bezahltes) und keine
      Offen-Reihe.

- [x] 7. Ausfallrechnung-Vorlage selbst entwerfen (Stefans Muster liegt nicht vor)
      Geändert: `Podoloji/AUSFALLRECHNUNG-ENTWURF.md` (neu)
      Befund: die Ausfallrechnung existiert bereits fast vollständig (Tabelle, Einstellungen
      auf `profiles`, vier Routen, Vorlage, 18 Tests, UI-Dialog) und ist fachlich richtig
      gerahmt — Privatrechnung, Schadensersatz, keine USt, kein HPNR. Der Entwurf hält den
      Sollzustand fest und benennt vier echte Lücken für Aufgabe 8: fehlende serverseitige
      Fristprüfung, kein Nachweis der Ausfallvereinbarung, Zeitzonenfehler beim Termindatum,
      `.single()` statt `.maybeSingle()`. Drei Rechtsfragen sind bewusst offen gemeldet.
      ✅ Freigegeben (Entscheidung Melih, 10.08.2026): nicht mehr auf Stefan warten —
      der builder-Agent baut eine korrekte Ausfallrechnung selbst, nach üblicher Praxis
      für Ausfallhonorar in Heilmittelpraxen (siehe Hinweise im Loop-Prompt). Wenn Stefans
      Muster später doch noch kommt: gegen diesen Entwurf abgleichen statt neu zu bauen.

- [ ] 8. Ausfallrechnung-Vorlage fertigstellen
      Zuerst: 7
      Code: `api-backend/billing/pdf/ausfallrechnung.template.js` + `ausfallrechnung.test.js`
      (Vorlage existiert schon als Gerüst — mit dem Entwurf aus Aufgabe 7 finalisieren).

- [ ] 9. Mahnung-Vorlage für unbezahlte Ausfallrechnungen
      Zuerst: 8
      ✅ Schema-Umbau freigegeben (Entscheidung Melih, 10.08.2026): der unter Aufgabe 9
      gefundene Blocker (`mahnungen.prescription_id NOT NULL`, Vorlage fest auf
      "Zuzahlung" formuliert, Mahnstufe wird nicht gegen Historie geprüft) darf gelöst
      werden — neue Spalte/Constraint-Änderung ist erlaubt, keine Rückfrage nötig, wenn
      es soweit ist.
      Code: `api-backend/billing/pdf/mahnung.template.js` + `api-backend/billing/api/mahnwesen.routes.js`
      (existiert schon — prüfen ob Ausfallrechnung dort mit abgedeckt ist).
      📋 Beim Lesen für Aufgabe 1 mit aufgefallen, damit es später nicht neu gesucht wird:
      Ausfallrechnungen sind dort **nicht** abgedeckt und können es ohne Schemaänderung auch
      nicht sein — `mahnungen.prescription_id` ist `NOT NULL` (`database_v28_mahnwesen.sql:10`),
      eine Ausfallrechnung hat aber kein Rezept. Auch die Vorlage ist auf Zuzahlung
      festgeschrieben ("Offene Zuzahlung", "Ausstehender Betrag (Zuzahlung)").
      Mahnstufen gibt es drei (14/10/7 Tage), die Stufe wird aber vom Aufrufer bestimmt und
      nicht gegen die Historie geprüft — Stufe 3 lässt sich als erste Mahnung verschicken.

- [x] 10. Bei Namenskorrektur automatisch aktuellen Namen auf neuer Rechnung anzeigen — kein Freitext auf der Rechnung erlaubt
      Geändert: `dashboard.js` (Rechnungsansicht nutzt nur noch die Patientenakte) ·
      `api-backend/billing/api/abrechnung.routes.js` (Podologie-§302: Freitext-Rückfall entfernt,
      klare 422-Meldung statt falschem Namen)
      Befund: alle rezeptbasierten Dokumente zogen den Namen schon live aus `leads` — dort war
      nichts zu tun. Zwei Freitext-Lücken gab es: `verordnungen.patient_name` (Podologie) und
      `invoices.patient_name` (Rechnungsansicht). Beide sind zu.
      Offen und gemeldet: die Rechnungs-Liste zeigt weiterhin die gespeicherte Namenskopie.

---

## Für den builder-Agenten

- Diese Datei ist die einzige Quelle für "was ist als nächstes dran".
- Nach jeder erledigten Aufgabe: Checkbox auf `[x]` setzen + eine kurze Zeile darunter,
  welche Dateien geändert wurden.
- Externe Quellen aktuell halten: `api-backend/billing/GKV-PODOLOGIE-PREISE-2025-2026.md`
  wurde am 10.08.2026 von zwei GKV-Spitzenverband-URLs abgeschrieben (Links stehen oben
  in der Datei). Bevor diese Datei für Aufgabe 2 verwendet wird: beide URLs erneut
  abrufen und prüfen, ob sich seit dem 10.08.2026 etwas geändert hat (neue
  Änderungsvereinbarung, neues Preisfenster). Falls ja: die Markdown-Tabelle aktualisieren,
  das Abrufdatum nachziehen, und Melih auf die Änderung hinweisen, bevor der Code
  darauf aufbaut. Dasselbe Prinzip gilt für jede künftige Referenzdatei mit externer
  Quelle: URL + Abrufdatum immer mit speichern, vor Gebrauch auf Aktualität prüfen.
- Bei Punkt 7 (menschliche Aufgabe) oder bei echten Unklarheiten: nicht raten, anhalten,
  Melih in einfachen Worten fragen was fehlt.
- Themen rund um Zuzahlung/Abrechnung (§302 SGB V) sind rechtlich/fachlich heikel —
  im Zweifel lieber fragen statt selbst zu entscheiden.
