/** Barcode provenance is a small part of computed, never the barcode payload.
 * prescriptions.quelle stays 'papier' under its existing CHECK constraint.
 */
export function validiereBarcodeErfassung(input) {
  if (input == null) return null;
  if (typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).some(k => !['quelle', 'format', 'parser_version', 'bestaetigt'].includes(k))
      || !['barcode', 'barcode+korrigiert'].includes(input.quelle)
      || input.format !== 'PDF417' || input.parser_version !== 'KBV-BFB-4.80-M13-10'
      || input.bestaetigt !== true) {
    throw new Error('Barcode-Angaben müssen mit dem Papier verglichen und bestätigt werden.');
  }
  return { quelle: input.quelle, format: 'PDF417', parser_version: input.parser_version, bestaetigt: true };
}

export function computedMitErfassung(computed, input = null, vorher = null) {
  const neu = validiereBarcodeErfassung(input);
  const alt = vorher?.erfassung ? validiereBarcodeErfassung(vorher.erfassung) : null;
  if (alt && !neu) throw new Error('Barcode-Angaben müssen vor jeder Änderung erneut mit dem Papier verglichen und bestätigt werden.');
  const erfassung = alt ? { ...(neu || alt), quelle: 'barcode+korrigiert' } : neu;
  return erfassung ? { ...(computed || {}), erfassung } : (computed || null);
}
