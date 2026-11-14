/**
 * @typedef {{
 *   street?: string,
 *   plz?: string,
 *   city?: string,
 *   phone?: string,
 *   steuernummer?: string,
 *   ust_id?: string,
 *   tax_exempt_note?: string,
 *   iban?: string,
 *   bic?: string,
 *   bank_name?: string,
 *   ik_number?: string
 * }} BrandingFelder
 */

/**
 * @typedef {{
 *   label: string,
 *   max?: number,
 *   re?: RegExp,
 *   hinweis?: string,
 *   upper?: boolean,
 *   ohneLeer?: boolean
 * }} BrandingFeldRegel
 */

/**
 * Einrichtungsassistent, Schritt „Praxisangaben für Rechnungen" (KHS M2.5): prüft den Rumpf
 * von `POST /api/setup/branding`. Reine Funktion.
 *
 * Whitelist: nur diese elf Profilspalten, nie Plan/Rolle/Mandant. Leere Felder werden NICHT
 * geschrieben (der Schritt ist überspringbar; geleert wird später in den Einstellungen).
 * IBAN/BIC nur Form (kein Prüfziffern-Raten); die Pflichtangaben-Prüfung der Rechnung
 * (`fehlendePflichtangaben`) bleibt die eigentliche Schranke.
 *
 * @param {Record<string, unknown> | null | undefined} body
 * @returns {{felder: BrandingFelder, fehler: string[]}}
 */
/** @type {Record<string, BrandingFeldRegel>} */
const REGELN = {
  street:          { label: 'Straße und Hausnummer', max: 120 },
  plz:             { label: 'Postleitzahl', re: /^\d{5}$/, hinweis: 'fünf Ziffern' },
  city:            { label: 'Ort', max: 80 },
  phone:           { label: 'Telefonnummer', max: 40 },
  steuernummer:    { label: 'Steuernummer', max: 30 },
  ust_id:          { label: 'USt-IdNr.', re: /^[A-Z]{2}[0-9A-Z]{2,12}$/, upper: true, hinweis: 'z. B. DE123456789' },
  tax_exempt_note: { label: 'Hinweis zur Steuerbefreiung', max: 300 },
  iban:            { label: 'IBAN', re: /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/, upper: true, ohneLeer: true, hinweis: 'z. B. DE02 1203 0000 0000 2020 51' },
  bic:             { label: 'BIC', re: /^[A-Z0-9]{8}([A-Z0-9]{3})?$/, upper: true, ohneLeer: true, hinweis: '8 oder 11 Zeichen' },
  bank_name:       { label: 'Bank', max: 100 },
  ik_number:       { label: 'Institutionskennzeichen (IK)', re: /^\d{9}$/, hinweis: 'neun Ziffern' },
};

/**
 * @param {Record<string, unknown> | null | undefined} body
 * @returns {{felder: BrandingFelder, fehler: string[]}}
 */
export function brandingFelderPruefen(body) {
  /** @type {Record<string, string>} */
  const felder = {};
  /** @type {string[]} */
  const fehler = [];
  for (const [schluessel, regel] of Object.entries(REGELN)) {
    const roh = body?.[schluessel];
    if (roh === undefined || roh === null || roh === '') continue;
    if (typeof roh !== 'string') { fehler.push(`${regel.label}: ungültige Eingabe`); continue; }
    let wert = roh.trim();
    if (!wert) continue;
    if (regel.ohneLeer) wert = wert.replace(/\s+/g, '');
    if (regel.upper) wert = wert.toUpperCase();
    if (regel.max && wert.length > regel.max) { fehler.push(`${regel.label}: zu lang (höchstens ${regel.max} Zeichen)`); continue; }
    if (regel.re && !regel.re.test(wert)) { fehler.push(`${regel.label}: ungültig (${regel.hinweis})`); continue; }
    felder[schluessel] = wert;
  }
  // Eine einzige ungültige Angabe verwirft alles — sonst stünde nach „Fehler" halb Gespeichertes im Profil.
  return fehler.length ? { felder: {}, fehler } : { felder, fehler };
}
