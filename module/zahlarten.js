/**
 * zahlarten.js — die eine Liste der Zahlarten, die überall gilt.
 *
 * Warum es das gibt
 * ─────────────────
 * Bis 10.09.2026 stand dieselbe Liste an drei Stellen, jede mit einer
 * eigenen Idee davon, wie viele Zahlarten es gibt:
 *   - api-backend/billing/belegliste/helper.js: 5 (mit 'paypal')
 *   - dashboard.html #blFilterZahlart:          5 (mit 'paypal')
 *   - dashboard.js ZAHLARTEN (Kassieren-Dialog): 4 (ohne 'paypal')
 * Ops #271 (08.09.2026) hat 'paypal' in die ersten zwei nachgezogen, die
 * dritte vergessen — eine PayPal-Zahlung lief seither ungeübersetzt als
 * rohes "paypal" durch den Kassieren-Dialog und die Kassenbuch-Zeile.
 * Diese Datei ist jetzt die einzige Quelle für den Dialog-Teil (Icon +
 * i18n-Schlüssel); der Backend-Wertebereich bleibt in belegliste/helper.js,
 * weil Frontend und Backend getrennt deployt werden (Watchtower/Vercel).
 *
 * Erste Verwendung: dashboard.js (openKassierenDialog, zahlartLabel),
 * module/kassenbuch-beleg.js (Barverkauf-Formular).
 */

export const ZAHLARTEN = [
  { key: 'bar',          icon: '💶', i18n: 'kass_bar' },
  { key: 'ec',           icon: '💳', i18n: 'kass_ec' },
  { key: 'ueberweisung', icon: '🏦', i18n: 'kass_ueberweisung' },
  { key: 'paypal',       icon: '💰', i18n: 'kass_paypal' },
  { key: 'sonstiges',    icon: '⋯',  i18n: 'kass_sonstiges' },
];

/**
 * @param {string} key
 * @param {(key: string) => string} t  Übersetzungsfunktion (dashboard.js: t())
 */
export function zahlartLabel(key, t) {
  const z = ZAHLARTEN.find(x => x.key === key);
  return z ? t(z.i18n) : (key || '—');
}

/**
 * Markup für die Zahlart-Chip-Auswahl — bis 10.09.2026 in dashboard.js
 * (openKassierenDialog) und module/kassenbuch-beleg.js je eine eigene, leicht
 * abweichende Kopie (Padding, Gap, Klassenname). Jetzt eine Quelle; die
 * Auswahl-Optik kommt aus der CSS-Klasse `.zahlart-chip.active`
 * (dashboard.css), nicht mehr aus inline gesetzten Style-Werten.
 *
 * @param {{escapeHtml: (s:string) => string, t: (key:string) => string}} deps
 */
export function zahlartChipsHtml({ escapeHtml, t }) {
  return ZAHLARTEN.map(z => `
    <button type="button" class="zahlart-chip" data-zahlart="${z.key}">
      <span aria-hidden="true">${z.icon}</span><span>${escapeHtml(t(z.i18n))}</span>
    </button>`).join('');
}
