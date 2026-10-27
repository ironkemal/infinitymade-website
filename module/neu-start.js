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

/**
 * V2.09: dashboard.js reicht hier einmal seine Helfer herein (ensureLeadsCache = gemeinsamer
 * Patienten-Cache mit bizScope, Patienten-Suchregeln). Die Neu-Teile bekommen nur einen Getter, weil die Shell
 * per import() geladen wird und vor oder nach diesem Aufruf starten kann. Im alten Design wird
 * der Kontext nur gemerkt und nie benutzt.
 */
let kontext = null;
export function neuKontext(k) { kontext = k && typeof k === 'object' ? k : null; }

if (istNeu()) {
  import('./shell-neu.js?v=20261027s223')
    .then((m) => m.start({ kontext: () => kontext }))
    .catch((e) => console.warn('[neu-start] Shell nicht geladen:', e));
}
