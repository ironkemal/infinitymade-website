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
