/** Reine Logik zu module/design-oeffentlich.js (ohne Konfig-Import, damit in Node testbar). */

/** Wunsch aus Query/Speicher; jeder Zugriffsfehler = kein Wunsch. */
export function leseWunsch(suche = '', speicher = null) {
  let d = null;
  try { d = new URLSearchParams(suche).get('design'); } catch { d = null; }
  if (d === 'alt' || d === 'neu') return d;
  try { return speicher?.getItem('px-design') === 'neu' ? 'neu' : null; } catch { return null; }
}

/** Neu nur bei `vorschau === true` UND Wunsch „neu“. Setzt/entfernt data-design, gibt 'neu' | 'alt' zurück. */
export function wendeAn({ vorschau, suche, speicher, wurzel }) {
  const neu = vorschau === true && leseWunsch(suche, speicher) === 'neu';
  if (wurzel) { if (neu) wurzel.setAttribute('data-design', 'neu'); else wurzel.removeAttribute('data-design'); }
  return neu ? 'neu' : 'alt';
}
