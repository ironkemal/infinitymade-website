/** Reine Logik zu module/design-oeffentlich.js (ohne Konfig-Import, damit in Node testbar). */

/**
 * Wunsch aus Query/Speicher; jeder Zugriffsfehler = kein Wunsch.
 * @param {string | URLSearchParams} [suche]
 * @param {Pick<Storage, 'getItem'> | null} [speicher]
 * @returns {'alt' | 'neu' | null}
 */
export function leseWunsch(suche = '', speicher = null) {
  let d = null;
  try { d = new URLSearchParams(suche).get('design'); } catch { d = null; }
  if (d === 'alt' || d === 'neu') return d;
  try { return speicher?.getItem('px-design') === 'neu' ? 'neu' : null; } catch { return null; }
}

/**
 * Standard ist seit 26.11.2026 „neu“ auf allen öffentlichen Seiten (Buchung, Anfrage,
 * Login, Registrierung, Onboarding). `?design=alt` bleibt als expliziter Rückfall erhalten.
 * @param {{ vorschau?: boolean | undefined, suche?: string | URLSearchParams, speicher?: Pick<Storage, 'getItem'> | null, wurzel?: { setAttribute(k: string, v: string): void, removeAttribute(k: string): void } | null }} opts
 * @returns {'neu' | 'alt'}
 */
export function wendeAn({ suche, speicher, wurzel } = {}) {
  const wunsch = leseWunsch(suche, speicher);
  const neu = wunsch !== 'alt';
  if (wurzel) { if (neu) wurzel.setAttribute('data-design', 'neu'); else wurzel.removeAttribute('data-design'); }
  return neu ? 'neu' : 'alt';
}
