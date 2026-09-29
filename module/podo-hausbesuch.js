/**
 * podo-hausbesuch.js — Tagesbehandlung: 79933/79934 nur bei „Hausbesuch: Ja".
 *
 * Reform S2.6, Podologie Anlage 3 i.d.F. 16.06.2025 c). Reine Entscheidung,
 * kein DOM. Die Sperre in der Abrechnung selbst steht in
 * `abrechnung-auswahl.js` (`podoHausbesuchSperren`) und im Backend
 * (`api-backend/billing/dta/hausbesuch-regeln.js`); hier geht es nur darum,
 * die Positionen gar nicht erst wählbar zu machen bzw. beim Speichern zu
 * stoppen (Altdaten).
 */

export const HAUSBESUCH_CODES = ['79933', '79934'];

export const HAUSBESUCH_HINWEIS =
  'Nur abrechenbar, wenn auf der Verordnung „Hausbesuch: Ja" angekreuzt ist.';

/** true = diese Position ist für die Verordnung gesperrt. */
export function hausbesuchGesperrt(vord, code) {
  return HAUSBESUCH_CODES.includes(String(code ?? '').trim()) && vord?.hausbesuch !== true;
}

/** Gewählte gesperrte Hausbesuch-Kodes (leer = in Ordnung). */
export function gesperrteHausbesuchKodes(vord, codes) {
  return (Array.isArray(codes) ? codes : []).map(c => String(c ?? '').trim())
    .filter(c => hausbesuchGesperrt(vord, c));
}

/** Kurzmeldung fürs Speichern, oder '' wenn alles in Ordnung. */
export function hausbesuchSpeicherFehler(vord, codes) {
  const g = gesperrteHausbesuchKodes(vord, codes);
  if (!g.length) return '';
  return `Hausbesuch (${g.join('/')}) ist nicht abrechenbar — auf der Verordnung ist „Hausbesuch: Ja" nicht angekreuzt. ` +
    'Bitte die Position abwählen oder die Verordnung vom Arzt korrigieren lassen.';
}
