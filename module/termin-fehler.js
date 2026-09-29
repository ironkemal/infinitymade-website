/**
 * termin-fehler.js — Fehlermeldung der Terminmaske IN der Maske
 *
 * Reform S3.5 (canli-test 28.09.2026, B-078): Die Fehler beim Speichern
 * (Ueberschneidung, fehlende Pflichtangabe, Beginn-Frist ...) kamen als Toast in
 * der Bildschirmecke, weit weg vom Modal, und waren nach wenigen Sekunden
 * verschwunden. Jetzt steht die Meldung ueber dem Speichern-Knopf und bleibt,
 * bis erneut gespeichert oder die Maske geschlossen wird.
 *
 * Erfolgsmeldungen bleiben Toasts — dieses Modul kennt nur Fehler.
 */

/** Rein: Text -> Anzeigezustand der Fehlerbox. */
export function fehlerAnzeige(text) {
  const t = String(text ?? '').trim();
  return { sichtbar: t.length > 0, text: t };
}

function box() { return document.getElementById('bkSaveError'); }

export function zeigeTerminFehler(text) {
  const el = box();
  if (!el) return;
  const a = fehlerAnzeige(text);
  el.textContent = a.text;
  el.hidden = !a.sichtbar;
  if (a.sichtbar) el.scrollIntoView?.({ block: 'nearest' });
}

export function loescheTerminFehler() { zeigeTerminFehler(''); }

/** Box leeren, sobald die Maske auf- oder zugeht. */
export function verdrahteTerminFehler() {
  const modal = document.getElementById('bookingModal');
  if (!modal || typeof MutationObserver === 'undefined') return;
  new MutationObserver(loescheTerminFehler).observe(modal, { attributes: true, attributeFilter: ['hidden'] });
}
