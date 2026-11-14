/**
 * Barcode provenance is a small part of computed, never the barcode payload.
 * prescriptions.quelle stays 'papier' under its existing CHECK constraint.
 * @typedef {{ quelle: 'barcode' | 'barcode+korrigiert', format: 'PDF417', parser_version: 'KBV-BFB-4.80-M13-10', bestaetigt: true }} BarcodeErfassung
 */

/**
 * @param {unknown} input
 * @returns {BarcodeErfassung | null}
 */
export function validiereBarcodeErfassung(input) {
  if (input == null) return null;
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Barcode-Angaben müssen mit dem Papier verglichen und bestätigt werden.');
  }
  const obj = /** @type {Record<string, unknown>} */ (input);
  if (Object.keys(obj).some(k => !['quelle', 'format', 'parser_version', 'bestaetigt'].includes(k))
      || (obj.quelle !== 'barcode' && obj.quelle !== 'barcode+korrigiert')
      || obj.format !== 'PDF417' || obj.parser_version !== 'KBV-BFB-4.80-M13-10'
      || obj.bestaetigt !== true) {
    throw new Error('Barcode-Angaben müssen mit dem Papier verglichen und bestätigt werden.');
  }
  return { quelle: obj.quelle, format: 'PDF417', parser_version: obj.parser_version, bestaetigt: true };
}

/**
 * @param {Record<string, unknown> | null | undefined} computed
 * @param {unknown} [input]
 * @param {{ erfassung?: unknown } | null} [vorher]
 * @returns {Record<string, unknown> | null}
 */
export function computedMitErfassung(computed, input = null, vorher = null) {
  const neu = validiereBarcodeErfassung(input);
  const alt = vorher?.erfassung ? validiereBarcodeErfassung(vorher.erfassung) : null;
  if (alt && !neu) throw new Error('Barcode-Angaben müssen vor jeder Änderung erneut mit dem Papier verglichen und bestätigt werden.');
  const erfassung = alt ? { ...(neu || alt), quelle: 'barcode+korrigiert' } : neu;
  return erfassung ? { ...(computed || {}), erfassung } : (computed || null);
}
