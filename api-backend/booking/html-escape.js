// guvenlik S-53 (11.10.2026): Patientenangaben aus oeffentlichen Formularen duerfen nie
// ungeprueft in HTML oder Betreffzeilen von Praxis-/Patientenmails landen.
const HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escHtml(wert) {
  return String(wert ?? '').replace(/[&<>"']/g, (c) => HTML[c]);
}

// Betreffzeile: keine Zeilenumbrueche (Header-Injection), begrenzte Laenge.
export function mailBetreff(wert, max = 120) {
  return String(wert ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}
