# Ausfallrechnung — Entwurf und Sollzustand

**Stand:** 10.08.2026 · **Anlass:** Loop-Liste "Kassieren", Aufgabe 7
**Entscheidung Melih, 10.08.2026:** nicht länger auf Stefans Muster warten — Entwurf selbst
erstellen. Kommt Stefans Muster später doch, wird es **gegen dieses Dokument abgeglichen**,
nicht neu gebaut.

---

## 0. Wichtigster Befund: das meiste existiert schon

Die Aufgabe war als "Vorlage entwerfen" formuliert. Beim Lesen des Codes zeigte sich, dass
die Ausfallrechnung bereits weitgehend gebaut und fachlich richtig gerahmt ist:

| Baustein | Ort |
|---|---|
| Tabelle `ausfallrechnungen` + laufende Nr. je Praxis + RLS | `supabase/migrations/20260713000000_ausfallgebuehr.sql` |
| Einstellungen `ausfall_enabled/_mode/_amount_eur/_percent/_cutoff_hours/_hinweis` auf **`profiles`** | `supabase/migrations/20260725000000_ausfall_settings_on_profiles.sql` |
| Routen: erstellen, auflisten, neu drucken, Status setzen | `api-backend/billing/api/ausfall.routes.js` |
| HTML-Vorlage A4, Browser-Druck | `api-backend/billing/pdf/ausfallrechnung.template.js` |
| Tests | `api-backend/billing/pdf/ausfallrechnung.test.js` |
| UI: Einstellung "Absagefrist (Std.)", Dialog beim Absagen/No-Show | `dashboard.html:2387`, `dashboard.js` |
| Buchung in die GoBD-Belegliste beim Kassieren | `ausfall.routes.js` (Typ `ausfall`) |

Dieser Entwurf hält deshalb fest, **was richtig ist und so bleiben soll**, und listet die
**vier echten Lücken**, die Aufgabe 8 schliesst.

---

## 1. Fachlicher Rahmen — was eine Ausfallrechnung ist

**Privatrechnung an den Patienten, niemals an die Krankenkasse.** Ein versäumter Termin ist
keine erbrachte Leistung und damit unter keinen Umständen GKV-abrechenbar. Auf dem Dokument
haben HPNR, Kostenträger-IK, Diagnosegruppe und Verordnungsdaten **nichts zu suchen**.

**Ausfallhonorar ist Schadensersatz, nicht Entgelt für eine Leistung.** Daraus folgt: kein
Leistungsaustausch im Sinne des § 1 Abs. 1 Nr. 1 UStG, also **keine Umsatzsteuer**. Die
Vorlage sagt das bereits ausdrücklich. (Der bei Heilmittelleistungen sonst übliche § 4 Nr. 14
UStG ist hier gar nicht einschlägig — der befreit *Leistungen*; hier gibt es schon keine.)

**Voraussetzung der Durchsetzbarkeit ist eine vorher getroffene Ausfallvereinbarung.** Ohne
sie gibt es in aller Regel keinen Anspruch. Das Dokument nimmt darauf Bezug und benennt als
berechnete Position ausdrücklich **nicht** eine "Behandlung".

**Der Anlass muss die Absagefrist wirklich verletzt haben.** Zwei Fälle:
- `no_show` — Patient erscheint nicht. Keine Fristprüfung nötig.
- `late_cancel` — Absage kam später als die eingestellte Frist (`ausfall_cutoff_hours`).

---

## 2. Pflichtangaben auf dem Dokument

| Angabe | Status |
|---|---|
| Rechnungsnummer (`AF-0001`, je Praxis fortlaufend) | ✅ vorhanden |
| Rechnungsdatum | ✅ |
| Praxisname, Strasse, PLZ/Ort, Telefon | ✅ |
| Patient: Name, Anschrift, Geburtsdatum | ✅ |
| Beschreibung des versäumten Termins: Datum, Uhrzeit, reservierte Leistung | ✅ (⚠️ Lücke L3) |
| Grund (nicht erschienen / kurzfristig abgesagt) | ✅ |
| Betrag, ohne USt-Ausweis | ✅ |
| Hinweis "Schadensersatz, keine Erstattung durch die Krankenkasse" | ✅ |
| Zahlungsziel + Fälligkeitsdatum (Vorgabe 14 Tage, pro Vorlage änderbar) | ✅ |
| Bankverbindung, Verwendungszweck = Rechnungsnummer | ✅ |
| Steuernummer, E-Mail in der Fusszeile | ✅ |
| **Kein** HPNR / Kostenträger / IK | ✅ korrekt weggelassen |

**Betragsermittlung** (`dashboard.js`, `ausfallSuggestedAmount`): entweder Pauschale
(`ausfall_mode='fixed'` → `ausfall_amount_eur`) oder Anteil am Wert des reservierten Termins
(`ausfall_mode='percent'` → `ausfall_percent` × Preis der Leistung). Beides ist übliche Praxis.
Der vorgeschlagene Betrag ist im Dialog **überschreibbar** — das soll so bleiben, die Höhe im
Einzelfall ist eine Entscheidung der Praxis.

---

## 3. Die vier Lücken (→ Aufgabe 8)

### L1 — Der Server prüft die Absagefrist nicht
`POST /api/billing/ausfall/create` liest weder `ausfall_enabled` noch `ausfall_cutoff_hours`.
Geprüft wird **nur im Browser** (`dashboard.js`, beim Löschen eines Termins). Damit lässt sich
eine Ausfallrechnung auch dann erzeugen, wenn rechtzeitig abgesagt wurde oder die Funktion in
den Einstellungen ausgeschaltet ist. Genau die Bedingung, die die Forderung überhaupt trägt,
wird also nicht geprüft.
→ **Beschluss:** serverseitig blockieren (422), bewusstes Übersteuern per `override: true`
möglich und in `notes` protokolliert.

### L2 — Nichts belegt die Ausfallvereinbarung
Das Dokument behauptet "gemäß der mit Ihnen getroffenen Ausfallvereinbarung". Im System steht
nirgends, ob dieser Patient je eine unterschrieben hat.
→ **Beschluss:** Feld `leads.ausfallvereinbarung_am` anlegen; fehlt es, **warnt** der Dialog
deutlich, blockiert aber nicht (viele Praxen führen die Vereinbarung auf Papier).

### L3 — Zeitzonenfehler im Termindatum
`fmtDate()` nutzt `toLocaleDateString('de-DE')` **ohne** `timeZone`, `fmtTime()` dagegen mit
`Europe/Berlin`. Auf dem Server (UTC) erscheint ein Termin um 00:30 Berliner Zeit mit dem
**Vortagsdatum** — auf einem Dokument, dessen ganzer Zweck es ist, ein Datum zu behaupten.
→ **Beschluss:** `timeZone: 'Europe/Berlin'` ergänzen.

### L4 — `.single()` statt `.maybeSingle()`
Bei optionalen Abfragen liefert `.single()` einen 406 statt eines sauberen 404
(`ausfall.routes.js`, `mahnwesen.routes.js`). Verstösst gegen CLAUDE.md.
→ **Beschluss:** umstellen.

---

## 4. Rechtliche Punkte — gemeldet, nicht selbst entschieden

Es gibt in diesem Projekt (Stand 10.08.2026) keinen `legal-de`-Fachagenten. Die folgenden
Punkte sind echte Rechtsfragen und werden **nicht** vom Entwickler beantwortet:

1. **Ist die voreingestellte 24-Stunden-Frist wirksam?** Der Code setzt 24 Stunden als
   Vorgabe und macht sie einstellbar. Ob eine bestimmte Frist wirksam vereinbart werden kann,
   hängt am Wortlaut der Ausfallvereinbarung, nicht am Code. Die Vorgabe ist bewusst nur eine
   Vorgabe.
2. **Dürfen Mahngebühr oder Verzugszinsen auf ein Ausfallhonorar erhoben werden?**
   Betrifft Aufgabe 9. Es wird bewusst **keine** Gebühr implementiert.
3. **Reicht der Verweis auf die Ausfallvereinbarung im Hinweistext aus, oder muss das
   Vereinbarungsdatum genannt werden?** Der Praxisinhaber kann den Text über
   `profiles.ausfall_hinweis` bzw. die Dokumentvorlage frei setzen — es wird ihm nichts
   vorgeschrieben.

---

## 5. Abgleich mit Stefans Muster (wenn es kommt)

Checkliste für den Vergleich, damit nicht neu gebaut wird:

- [ ] Nennt Stefans Muster Positionen/Beträge anders als "Ausfallhonorar"?
- [ ] Wird die Ausfallvereinbarung mit Datum zitiert?
- [ ] Steht eine Umsatzsteuerzeile drauf — und wenn ja, mit welcher Begründung?
- [ ] Welches Zahlungsziel ist gesetzt (wir: 14 Tage)?
- [ ] Gibt es eine Mahngebührenankündigung?
- [ ] Wird der versäumte Termin mit Uhrzeit genannt oder nur mit Datum?

Abweichungen werden hier ergänzt, die Vorlage wird angepasst — der Rahmen aus Abschnitt 1
bleibt, solange kein fachlicher Grund dagegen spricht.
