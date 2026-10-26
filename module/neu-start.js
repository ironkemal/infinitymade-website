/**
 * neu-start.js — Einstieg des neuen Designs (Redesign v2, PLAN-V2 V2.02).
 *
 * Warum
 * ─────
 * Die neue Struktur (Leiste, Flyout, Suche, Startseite) soll das alte Design nicht
 * berühren und dashboard.js nicht wachsen lassen (Kapı). Darum gibt es genau einen
 * Einstieg: dashboard.js importiert diese Datei. Im alten Design (ohne ?design=neu)
 * kehrt sie sofort zurück und lädt nichts. Im neuen lädt sie die Neu-Teile per
 * dynamischem import(), damit das alte Design keinen zusätzlichen Code ausführt.
 */
export const istNeu = () => typeof document !== 'undefined' && document.documentElement.dataset.design === 'neu';

if (istNeu()) {
  import('./shell-neu.js?v=20261026s208')
    .then((m) => m.start())
    .catch((e) => console.warn('[neu-start] Shell nicht geladen:', e));
}
