/**
 * hausbesuch-regeln.js — 79933/79934 nur bei „Hausbesuch: Ja" auf der Verordnung.
 *
 * Podologie-Reform-Sprint S2.6. Quelle: Podologie Anlage 3 i.d.F. 16.06.2025,
 * Abschnitt c) Hausbesuch (siehe `wissensbank/SPEC-RULES.md`): Die Positionen
 * 79933 (Hausbesuch, ärztlich verordnet, inkl. Wegegeld) und 79934
 * (Hausbesuch in sozialer Einrichtung, inkl. Wegegeld) sind nur abrechenbar,
 * wenn auf der Verordnung „Hausbesuch" mit „Ja" angekreuzt ist. „Nein" oder
 * ein leeres Feld: nicht abrechenbar (die Verordnung bleibt gültig; eine
 * Änderung auf „Ja" nur durch die Ärztin/den Arzt mit erneuter Unterschrift
 * und Datum, vor der Einreichung). Harte Sperre, kein Übersteuern.
 *
 * Reine Funktion — kein DOM, kein Netz, keine DB. Gespiegelt in
 * `module/abrechnung-auswahl.js` (`podoHausbesuchSperren`).
 */

export const HAUSBESUCH_POSITIONEN = ['79933', '79934'];

function formatDatum(datum) {
  const s = String(datum ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : (s || 'unbekanntem Datum');
}

/**
 * @param {{ hausbesuch: any, tage: Array<{datum: string, positionen: string[]}> }} arg
 * @returns {string[]} harte Gründe, leer = in Ordnung
 */
export function hausbesuchRegeln({ hausbesuch, tage } = {}) {
  if (hausbesuch === true) return [];
  const gruende = [];
  for (const tag of (Array.isArray(tage) ? tage : [])) {
    const pos = (Array.isArray(tag?.positionen) ? tag.positionen : []).map(p => String(p ?? '').trim());
    const treffer = HAUSBESUCH_POSITIONEN.filter(c => pos.includes(c));
    if (treffer.length) {
      gruende.push(
        `Hausbesuch (${treffer.join('/')}) am ${formatDatum(tag?.datum)} nicht abrechenbar — ` +
        'auf der Verordnung ist „Hausbesuch: Ja" nicht angekreuzt (Podologie Anlage 3 c)). ' +
        'Änderung nur durch die Ärztin/den Arzt mit erneuter Unterschrift und Datum.'
      );
    }
  }
  return gruende;
}
