/**
 * shell-neu.js — App-Shell des neuen Designs (Redesign v2, PLAN-V2 V2.02 ff.).
 *
 * Geladen nur von module/neu-start.js, also nur bei <html data-design="neu">.
 * Liest den von dashboard.js gerenderten DOM (Sichtbarkeit, Rollen, Rechte stecken schon
 * darin) und legt nur das Neu-Verhalten darüber — keine zweite Sichtbarkeitslogik.
 *
 * V2.02: macht den aktiven Bereich am <html> sichtbar (data-px-panel), damit design/*.css
 * je Bereich gestalten kann. Signale aus dashboard.js: 'panel:changed' { id }, 'nav:gerendert'.
 * Folgt: Icon-Leiste (V2.06), Flyout (V2.07), Suche (V2.09), „+ Neu“ (V2.10), Schublade (V2.11).
 */
import { on } from './signal.js?v=20260813';

/** Reine Hilfe (testbar): erlaubte Panel-ID oder null. */
export function panelId(wert) {
  return typeof wert === 'string' && /^[a-z0-9-]{1,40}$/.test(wert) ? wert : null;
}

let gestartet = false;
export function start() {
  if (gestartet) return;
  gestartet = true;
  const html = document.documentElement;
  html.dataset.pxShell = 'v2';
  const setze = (id) => { const p = panelId(id); if (p) html.dataset.pxPanel = p; };
  setze(document.querySelector('.panel.active')?.id?.replace(/^panel-/, ''));
  on('panel:changed', (d) => setze(d?.id));
}
