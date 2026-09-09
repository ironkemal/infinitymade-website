/**
 * abrechnung-zeilen.js — aus einer fertig gebauten DTA-Datei die Zeilen machen,
 * die in `abrechnung_zeile` eingefroren werden.
 *
 * Warum diese Datei
 * ─────────────────
 * Beide Einreichwege (`/abrechnung/create` für Physio/Ergo/Logo,
 * `/abrechnung/create-podologie`) haben nach dem Bauen der Datei dieselben drei
 * Dinge nebeneinander liegen — in derselben Reihenfolge, mit demselben Index:
 *
 *     prescriptions[i]   die DTA-Form (patient · verordnung · sessions)
 *     quellen[i]         die rohe `prescriptions`-Zeile aus der Datenbank
 *     dta.gruppen[]      die Gesamtrechnungs-Gruppen mit prescriptionIndices
 *
 * Daraus die Zeilen zu bauen ist in beiden Wegen dieselbe Rechnung. Zweimal
 * geschrieben liefe sie irgendwann auseinander — und weil hier der Betrag
 * entsteht, der zehn Jahre lang als „das ist rausgegangen" gilt, wäre das teuer.
 *
 * Warum ein Schnappschuss und keine Verbindungstabelle
 * ────────────────────────────────────────────────────
 * Eine Verbindungstabelle zeigte die LEBENDE Verordnung. Wird ein abgesetztes
 * Rezept korrigiert (andere Position, andere Einheiten) und neu eingereicht,
 * zeigte die alte Datei rückwirkend die HEUTIGEN Zahlen unter dem Datum von
 * gestern. `prescriptions.abrechnung_id` bleibt daneben bestehen und heisst
 * weiter „in welcher Datei liegt die Zeile GERADE" (Arbeitsachse);
 * `abrechnung_zeile` ist die Geschichtsachse. Nicht zusammenlegen.
 * (ABRECHNUNG_BILDSCHIRM_PLAN.md, Abschnitt 4 · db/REGISTER.md)
 *
 * ⚠️ Die Zuzahlungsformel unten ist WÖRTLICH dieselbe wie die Summenschleife in
 * beiden Routen (`totalBrutto`/`totalZu`). Wer eine ändert, ändert beide —
 * sonst weicht die Summe der Zeilen von der Kopfsumme `abrechnung.total_eur`
 * ab, und der §302-Bildschirm zeigt zwei verschiedene Wahrheiten für dieselbe
 * Datei. Der 10-€-Deckel steht in Anlage 1 TP5 V21 §5.5.2 (GES).
 */

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Brutto · Zuzahlung · Netto EINER Verordnung, aus ihren DTA-Sitzungen.
 *
 * @param {{sessions: Array<{einzelbetrag:number, anzahl:number, zuzahlungProPos:number}>,
 *          verordnung: {zuzahlungskennzeichen: string}}} p
 * @returns {{brutto:number, zuzahlung:number, netto:number}}
 */
export function betraegeFuerVerordnung(p) {
  const sessions = Array.isArray(p?.sessions) ? p.sessions : [];
  const brutto = r2(sessions.reduce(
    (a, s) => a + (Number(s.einzelbetrag) || 0) * (Number(s.anzahl) || 1), 0));

  // '1' heisst zuzahlungsbefreit — dann zahlt die Kasse alles.
  let zuzahlung = 0;
  if (p?.verordnung?.zuzahlungskennzeichen === '0') {
    const proz = r2(sessions.reduce(
      (a, s) => a + (Number(s.zuzahlungProPos) || 0) * (Number(s.anzahl) || 1), 0));
    zuzahlung = r2(Math.min(brutto, proz + 10));
  }

  return { brutto, zuzahlung, netto: r2(brutto - zuzahlung) };
}

/**
 * Die Sitzungen einer Verordnung als `leistungen`-jsonb.
 * Bewusst nur die vier Felder, die VKZ 04 braucht („nicht zuvor vergütete
 * Positionen", Anlage 1 TP5 V21 §7.4.3) — Therapeut und Zertifikat gehören zur
 * Prüfung vor der Einreichung, nicht in den eingefrorenen Beleg.
 */
export function leistungenAusSessions(sessions) {
  return (Array.isArray(sessions) ? sessions : []).map(s => ({
    datum:           s.datumLeistung || null,
    positionsnummer: s.positionsnummer || null,
    anzahl:          Number(s.anzahl) || 1,
    einzelbetrag:    r2(s.einzelbetrag),
  }));
}

/**
 * Baut die Einfügezeilen für `abrechnung_zeile`.
 *
 * Die Reihenfolge folgt `dta.gruppen[]` — also genau der Reihenfolge, in der
 * die Belege in der Datei stehen und in der die Urbelege zu liefern sind
 * (Richtlinien-Text 20.11.2006 § 4 Abs. 2). `sort_order` zählt INNERHALB der
 * Gesamtrechnung, nicht über die Datei: die Gruppe ist die Einheit, die die
 * Kasse bezahlt.
 *
 * @param {object} o
 * @param {string} o.abrechnungId
 * @param {string} o.ownerId
 * @param {string|null} [o.businessId]
 * @param {string} o.kostentraegerIk   Fallback, wenn die Gruppe keinen trägt
 * @param {{gruppen?: Array<{kostentraegerIk?:string, kartenIk?:string,
 *          einzelRechnungsnummer?:string, prescriptionIndices:number[]}>}} o.dta
 * @param {Array<object>} o.prescriptions  DTA-Form, Index = Index in `quellen`
 * @param {Array<object>} o.quellen        rohe `prescriptions`-Zeilen
 * @returns {Array<object>} Zeilen für den INSERT
 */
export function zeilenAusDta({ abrechnungId, ownerId, businessId = null,
                               kostentraegerIk, dta, prescriptions, quellen }) {
  const gruppen = Array.isArray(dta?.gruppen) && dta.gruppen.length
    ? dta.gruppen
    // Ältere/andere Bauwege liefern keine Gruppen. Dann ist die ganze Datei
    // EINE Gesamtrechnung mit der Einzelrechnungsnummer '0' — genau das, was
    // beide Routen bis zum 07.09.2026 übergeben haben.
    : [{ kostentraegerIk, kartenIk: null, einzelRechnungsnummer: '0',
         prescriptionIndices: (prescriptions || []).map((_, i) => i) }];

  const zeilen = [];
  for (const g of gruppen) {
    let sort = 0;
    for (const i of (g.prescriptionIndices || [])) {
      const p = prescriptions?.[i];
      const q = quellen?.[i];
      if (!p || !q) continue;   // darf nicht vorkommen; still auslassen ist besser als abbrechen

      const { brutto, zuzahlung, netto } = betraegeFuerVerordnung(p);
      const name = [p.patient?.vorname, p.patient?.nachname].filter(Boolean).join(' ').trim();

      zeilen.push({
        abrechnung_id:          abrechnungId,
        owner_id:               ownerId,
        business_id:            businessId,
        prescription_id:        q.id,

        kostentraeger_ik:       g.kostentraegerIk || kostentraegerIk,
        karten_ik:              g.kartenIk || null,
        einzel_rechnungsnummer: String(g.einzelRechnungsnummer ?? '0'),
        sort_order:             sort++,

        belegnummer:            p.patient?.belegnummer || q.belegnummer || null,
        // Name und KVNR aus der DTA-Form, nicht aus der Datenbankzeile: was in
        // der Datei steht, ist der Urbeleg. Eine spätere Namenskorrektur in der
        // Akte darf den eingereichten Beleg nicht rückwirkend umschreiben.
        patient_name:           name || null,
        versichertennummer:     p.patient?.kvnr || null,
        verordnungsdatum:       p.verordnung?.ausstellungsdatum || q.ausstellungsdatum || null,
        therapie_bereich:       q.therapie_bereich || null,
        // In der Podologie stehen mehrere verschiedene Positionen an einer
        // Verordnung — die stehen in `leistungen`, nicht hier.
        heilmittel_position:    q.heilmittel_position || null,
        anzahl_einheiten:       q.anzahl_einheiten ?? null,
        leistungen:             leistungenAusSessions(p.sessions),

        brutto_eur:             brutto,
        zuzahlung_eur:          zuzahlung,
        netto_eur:              netto,

        status:                 'eingereicht',
        herkunft:               'einreichung',
      });
    }
  }
  return zeilen;
}
