// Zuzahlung calculator for §302 Heilmittel.
//
// Rule (HeilM-RL + §32 SGB V + §43c SGB V):
//   - Zuzahlung = 10 % vom Bruttopreis je Heilmitteleinheit
//   - + Verordnungspauschale: 10,00 € je Verordnung
//   - Pauschale max. = Brutto - prozentuale Zuzahlung (kann nicht negativ werden)
//   - Versicherte unter 18: keine Zuzahlung
//   - Versicherte mit gültiger Befreiung (Belastungsgrenze §62 SGB V): keine Zuzahlung
//   - Positionen mit ZuzahlungsKZ-implizit "frei" (z.B. KG-ZNS Kinder, Bericht,
//     Geburtsvorbereitung): keine Zuzahlung am EHE-Eintrag
//
// All amounts use 2 decimal places, kaufmännische Rundung.

const r2 = (v) => Math.round((+v + Number.EPSILON) * 100) / 100;

/**
 * @param {object} opts
 * @param {number} opts.preis_eur       Brutto per Einheit (single session price)
 * @param {number|null} opts.zuzahlung_eur_position  Per-Position Zuzahlung (from heilmittel_position).
 *                                                    NULL ⇒ zuzahlungsfrei (KG-ZNS Kinder, Bericht, etc.)
 * @param {boolean} opts.position_frei   True ⇒ ignore percentage entirely.
 * @returns {number} Zuzahlung for one session.
 */
export function calcSessionZuzahlung({ preis_eur, zuzahlung_eur_position, position_frei = false }) {
  if (position_frei) return 0;
  if (zuzahlung_eur_position != null) return r2(zuzahlung_eur_position);
  // Fallback: 10 % vom Bruttopreis
  return r2(preis_eur * 0.10);
}

/**
 * Löst eine Katalogposition in Preis + Zuzahlung auf.
 *
 * Wichtig: die Katalogdateien (physio_positions.js, podologie_positions.js)
 * kennen drei verschiedene Zustände, die vorher alle mit `??` in denselben
 * 10-%-Fall gekippt sind:
 *
 *   1. Position gefunden, `zuzahlung` ist eine Zahl  → dieser Betrag gilt.
 *   2. Position gefunden, `zuzahlung` ist `null`     → die Position ist
 *      zuzahlungsfrei. Betrifft KG-ZNS Kinder (X0708/X0728/X0709), X0805,
 *      Therapiebericht (X1906), Übermittlungsgebühr (X9701),
 *      Geburtsvorbereitung/Rückbildung (21901/21904) sowie in der Podologie
 *      78220 und 78530. Diese Fälle mit 10 % zu belasten, belastet Patienten
 *      mit einer Zuzahlung, die sie gar nicht schulden.
 *   3. Position gar nicht gefunden (unbekannter/leerer Code) → wir wissen es
 *      nicht und rechnen ersatzweise mit 10 % vom Bruttopreis.
 *
 * @param {object|null|undefined} pos  Treffer aus findPosition/findPodologiePosition
 * @param {number} priceUnit           Bruttopreis je Einheit
 * @returns {{ preisUnit: number, zuzahlungUnit: number, positionFrei: boolean, gefunden: boolean }}
 */
export function resolvePositionZuzahlung(pos, priceUnit) {
  const preisUnit = Number(priceUnit) || 0;

  if (!pos) {
    return { preisUnit, zuzahlungUnit: r2(preisUnit * 0.10), positionFrei: false, gefunden: false };
  }
  if (pos.zuzahlung == null) {
    return { preisUnit, zuzahlungUnit: 0, positionFrei: true, gefunden: true };
  }
  return { preisUnit, zuzahlungUnit: r2(pos.zuzahlung), positionFrei: false, gefunden: true };
}

/**
 * Compute Abrechnungsfall (per prescription) totals.
 *
 * @param {object} opts
 * @param {Array} opts.sessions    [{ preis_eur, zuzahlung_eur_position, position_frei? }]
 * @param {object} opts.patient    { geburtsdatum, befreit_im_jahr }
 * @param {Date|string} opts.behandlungsende  Reference date for age check
 * @param {boolean} opts.verordnung_zuzahlungsfrei  ZuzahlungsKZ ≠ '0' / '3'
 * @returns {{brutto, prozZuzahlung, pauschZuzahlung, gesZuzahlung, netto, befreiungsgrund}}
 */
export function calcAbrechnungsfallZuzahlung({
  sessions,
  patient,
  behandlungsende,
  verordnung_zuzahlungsfrei = false,
}) {
  if (patient?.insurance_type === 'privat') {
    return { zuzahlung_eur: 0, befreit: false, grund: 'privat' };
  }

  const brutto = r2(sessions.reduce((a, s) => a + (+s.preis_eur || 0), 0));

  let befreiungsgrund = null;
  if (verordnung_zuzahlungsfrei) befreiungsgrund = 'verordnung';
  if (patient?.befreit_im_jahr) befreiungsgrund = 'befreiungsausweis';
  if (isUnter18(patient?.geburtsdatum, behandlungsende)) befreiungsgrund = 'unter_18';

  if (befreiungsgrund) {
    return {
      brutto,
      prozZuzahlung:   0,
      pauschZuzahlung: 0,
      gesZuzahlung:    0,
      netto:           brutto,
      befreiungsgrund,
    };
  }

  const prozZuzahlung = r2(sessions.reduce((a, s) => a + calcSessionZuzahlung(s), 0));
  // Pauschale 10€ je Verordnung, capped at remaining Brutto
  const pauschZuzahlung = Math.min(10.00, r2(brutto - prozZuzahlung));
  const gesZuzahlung   = r2(prozZuzahlung + Math.max(0, pauschZuzahlung));
  const netto          = r2(brutto - gesZuzahlung);

  return { brutto, prozZuzahlung, pauschZuzahlung: Math.max(0, pauschZuzahlung), gesZuzahlung, netto, befreiungsgrund: null };
}

export function isUnter18(geburtsdatum, referenceDate = new Date()) {
  if (!geburtsdatum) return false;
  const gb = geburtsdatum instanceof Date ? geburtsdatum : new Date(geburtsdatum);
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  if (Number.isNaN(gb.getTime()) || Number.isNaN(ref.getTime())) return false;
  let age = ref.getFullYear() - gb.getFullYear();
  const m = ref.getMonth() - gb.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < gb.getDate())) age--;
  return age < 18;
}

/** Determine if a patient is befreit for a given calendar year. */
export function isBefreit(befreiungenForPatient, jahr, referenceDate = new Date()) {
  if (!befreiungenForPatient || befreiungenForPatient.length === 0) return false;
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  return befreiungenForPatient.some(b => {
    if (b.jahr !== jahr) return false;
    if (new Date(b.befreit_ab) > ref) return false;
    if (b.befreit_bis && new Date(b.befreit_bis) < ref) return false;
    return true;
  });
}
