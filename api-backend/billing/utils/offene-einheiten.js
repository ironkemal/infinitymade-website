// Teilabrechnung einer podologischen Verordnung (Reform S2.3).
//
// Eine Verordnung mit offenen Einheiten wird durch die Abrechnung beendet; die
// Restmenge ist auf ihr nicht mehr erbring- oder abrechenbar (Richtlinien § 302
// § 7 Abs. 1, Podo-Anlage 3 p)/q); Korrekturverfahren UE Frage 1). Der Server
// verlangt deshalb eine ausdrückliche Bestätigung — ein Riegel nur im Browser
// wäre keiner. Zähler wie überall: nicht stornierte podologie_behandlungen
// gegen prescriptions.anzahl_einheiten. Spiegel: module/offene-einheiten.js.

export const OFFENE_EINHEITEN_CODE = 'OFFENE_EINHEITEN';

export function offeneEinheiten(verordnet, erbracht) {
  const v = Number(verordnet);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.max(0, v - Math.max(0, Number(erbracht) || 0));
}

/**
 * @param {Array<{id:string, anzahl_einheiten?:number}>} vords
 * @param {Array<{verordnung_id:string}>} behs  nicht stornierte Behandlungen
 * @returns {Array<{id:string, verordnet:number, erbracht:number, offen:number}>}  nur offen > 0
 */
export function offeneJeVerordnung(vords, behs) {
  const zaehler = new Map();
  for (const b of behs || []) zaehler.set(b.verordnung_id, (zaehler.get(b.verordnung_id) || 0) + 1);
  const out = [];
  for (const v of vords || []) {
    const erbracht = zaehler.get(v.id) || 0;
    const offen = offeneEinheiten(v.anzahl_einheiten, erbracht);
    if (offen > 0) out.push({ id: v.id, verordnet: Number(v.anzahl_einheiten), erbracht, offen });
  }
  return out;
}

/**
 * @param {Array<{id:string}>} offene  Ergebnis von offeneJeVerordnung
 * @param {*} bestaetigt  Ids-Array (create-podologie) oder true (Einzel-Statuswechsel)
 * @returns {{fehlt:Array, bestaetigt:Array}}
 */
export function pruefeBestaetigung(offene, bestaetigt) {
  const ids = bestaetigt === true ? null : new Set(Array.isArray(bestaetigt) ? bestaetigt : []);
  const fehlt = [], ok = [];
  for (const o of offene || []) (ids === null || ids.has(o.id) ? ok : fehlt).push(o);
  return { fehlt, bestaetigt: ok };
}

/** Antwort 428 mit Code, damit die Oberfläche den Dialog zeigen kann. */
export function offeneEinheitenAntwort(fehlt) {
  return {
    status: 428,
    body: {
      error: 'Es sind noch Einheiten offen. Mit der Abrechnung wird die Verordnung beendet – die offenen Einheiten können auf dieser Verordnung nicht mehr erbracht oder abgerechnet werden. Bitte bestätigen.',
      code: OFFENE_EINHEITEN_CODE,
      offene: (fehlt || []).map(o => ({ id: o.id, offen: o.offen })),
    },
  };
}

/** Zeilen für prescription_validations (Muster: abrechnung-freigabe). */
export function protokollZeilen(bestaetigte, { abrechnungId, aktion, userId }) {
  return (bestaetigte || []).map(o => ({
    prescription_id:  o.id,
    engine:           'abrechnung-freigabe',
    input_snapshot:   { verordnet: o.verordnet, erbracht: o.erbracht, offen: o.offen },
    result:           aktion ? { aktion } : { abrechnung_id: abrechnungId },
    ok:               false,
    warnings_count:   0,
    blockers_count:   1,
    proceeded_anyway: true,
    overridden_rules: [OFFENE_EINHEITEN_CODE],
    proceed_reason:   'Vorzeitige Abrechnung bestätigt',
    validated_by:     userId,
  }));
}

/**
 * Reform S2.3b: Eine beim Bereit-Setzen erteilte Bestätigung („Verordnung
 * vorzeitig beenden") gilt weiter, solange sich nichts geändert hat: gleiche
 * Zahl offener Einheiten wie im Protokoll UND kein künftiger, nicht
 * stornierter Termin an der Verordnung. Sonst wird noch einmal gefragt.
 * Fehlende/ungültige Angaben => false (im Zweifel fragen).
 * @param {{offenJetzt:*, snapshotOffen:*, kuenftigeTermine:*}} p
 * @returns {boolean}
 */
export function bestaetigungNochGueltig({ offenJetzt, snapshotOffen, kuenftigeTermine } = {}) {
  if (offenJetzt == null || snapshotOffen == null || kuenftigeTermine == null) return false;
  const j = Number(offenJetzt), s = Number(snapshotOffen), t = Number(kuenftigeTermine);
  if (![j, s, t].every(Number.isFinite)) return false;
  return j > 0 && j === s && t === 0;
}

/**
 * Ids der offenen Verordnungen, deren Bereit-Bestätigung noch gilt.
 * ⚠️ `ok:false` im Protokoll heißt hier „bestätigt" — nicht danach filtern.
 * @param {Array<{id:string, offen:number}>} offene            offeneJeVerordnung
 * @param {Array<{prescription_id:string, input_snapshot?:{offen?:number}, created_at?:string}>} bereitZeilen
 *        prescription_validations (engine 'abrechnung-freigabe', result.aktion 'bereit')
 * @param {Array<{verordnung_id:string}>} kuenftigeTermine  künftige, nicht stornierte Termine
 * @returns {Set<string>}
 */
export function gueltigBestaetigteIds(offene, bereitZeilen, kuenftigeTermine) {
  const neueste = new Map();
  for (const z of bereitZeilen || []) {
    const alt = neueste.get(z?.prescription_id);
    if (!alt || String(z.created_at || '') > String(alt.created_at || '')) neueste.set(z?.prescription_id, z);
  }
  const termine = new Map();
  for (const t of kuenftigeTermine || []) termine.set(t.verordnung_id, (termine.get(t.verordnung_id) || 0) + 1);
  const out = new Set();
  for (const o of offene || []) {
    const z = neueste.get(o.id);
    if (!z) continue;
    if (bestaetigungNochGueltig({
      offenJetzt: o.offen, snapshotOffen: z.input_snapshot?.offen, kuenftigeTermine: termine.get(o.id) || 0,
    })) out.add(o.id);
  }
  return out;
}
