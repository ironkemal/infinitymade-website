// Statistik „Überweisende Ärzte": Heilmittel nach Positionsnummer bündeln.
//
// QA TEST-Physio 17.11.2026, Fund 8: X0501 stand zweimal in der Liste — „Allgemeine
// Krankengymnastik (KG) Einzel (8)" und „Krankengymnastik Einzel (4)" —, weil nach dem
// Freitext `prescriptions.heilmittel` gezählt wurde und der je nach Erfassungsweg anders lautet.
// Jetzt zählt die Positionsnummer (aus heilmittel_items, sonst aus dem Text, sonst aus
// heilmittel_position); die Bezeichnung kommt aus dem Physio-Katalog. Podologie unverändert.
import { findPosition } from '../codes/physio_positions.js';

const X_CODE = /\bX\d{4}\b/;

/** @param {unknown} text */
function ohneCode(text) {
  return String(text || '').replace(/^\s*X\d{4}\s*[–—-]\s*/, '').trim();
}

/**
 * @param {string} code  Vorlage X0501
 * @param {unknown} [bezeichnung]
 */
function anzeige(code, bezeichnung) {
  const label = findPosition(code)?.label || ohneCode(bezeichnung);
  return label ? `${code} ${label}` : code;
}

/**
 * Heilmittel einer Verordnung als Zählschlüssel (je Heilmittel einmal).
 * @param {{ therapie_bereich?: string|null, heilmittel?: string|null, heilmittel_items?: any, heilmittel_position?: string|null }} rx
 * @returns {string[]}
 */
export function heilmittelSchluessel(rx) {
  const items = Array.isArray(rx?.heilmittel_items) ? rx.heilmittel_items : [];
  if (rx?.therapie_bereich === 'podo') {
    return items.map((/** @type {any} */ i) => i?.bezeichnung || i?.code).filter(Boolean);
  }
  /** @type {string[]} */
  const aus = [];
  for (const i of items) {
    const code = String(i?.code || '').match(X_CODE)?.[0] || String(i?.bezeichnung || '').match(X_CODE)?.[0];
    const wert = code ? anzeige(code, i?.bezeichnung) : ohneCode(i?.bezeichnung || i?.code);
    if (wert && !aus.includes(wert)) aus.push(wert);
  }
  if (aus.length) return aus;
  const ausText = String(rx?.heilmittel || '').match(X_CODE)?.[0];
  const ausPosition = /^\d{5}$/.test(String(rx?.heilmittel_position || '')) ? 'X' + String(rx?.heilmittel_position).slice(1) : null;
  const code = ausText || (ausPosition && findPosition(ausPosition) ? ausPosition : null);
  if (code) return [anzeige(code, rx?.heilmittel)];
  return rx?.heilmittel ? [String(rx.heilmittel)] : [];
}
