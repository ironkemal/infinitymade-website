/**
 * kopf-neu.js — „+ Neu“ in der Kopfleiste des neuen Designs (Redesign v2, PLAN-V2 V2.10, E7).
 *
 * Ein Knopf, ein Menü: Termin, Patient, Verordnung erfassen, Rezept scannen. „Rezept scannen“
 * wandert damit aus der Kopfleiste hier hinein. Jeder Eintrag löst nur den bestehenden Öffner
 * aus dashboard.js aus — keine zweite Anlage-Logik:
 *   Termin            → window.openBookingModal(null)         (wie #calAddBookingBtn, dashboard.js:2154)
 *   Patient           → #leadAddBtn.click()                   (dashboard.js:8006)
 *   Verordnung        → window.openRezeptModal(null, null)    (wie „+ Neue Verordnung“, dashboard.js:13937)
 *   Rezept scannen    → #rezeptScanBtn.click()                (module/rezept-barcode-dialog.js:30)
 * Rechte: ein Eintrag erscheint nur, wenn sein Bereich in der Leiste steht (Rolle/Plan/Sichtbarkeit
 * entscheidet dashboard.js) bzw. der Scan-Knopf von initBarcodeDialog freigeschaltet wurde.
 */
import { kopfMenue } from './kopf-menue.js?v=20261026s212';

const SVG = (pfad) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pfad}</svg>`;
const SYMBOL = {
  termin: SVG('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4"/>'),
  patient: SVG('<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M19 8v6M16 11h6"/>'),
  verordnung: SVG('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15h6"/>'),
  scannen: SVG('<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>'),
};

const inLeiste = (panel) => !!document.querySelector(`#sidebarNav .sidebar-item[data-panel="${panel}"]`);
const fn = (name) => (typeof window[name] === 'function' ? window[name] : null);

/** Reine Hilfe (testbar): welche Einträge erlaubt sind, aus dem, was dashboard.js freigeschaltet hat. */
export function neuEintraege({ kalender, patienten, verordnungen, scan, oeffneTermin, oeffneVerordnung, leadKnopf }) {
  const liste = [];
  if (kalender && oeffneTermin) liste.push('termin');
  if (patienten && leadKnopf) liste.push('patient');
  if (verordnungen && oeffneVerordnung) liste.push('verordnung');
  if (scan) liste.push('scannen');
  return liste;
}

function lage() {
  const scanKnopf = document.getElementById('rezeptScanBtn');
  return {
    kalender: inLeiste('calendar'),
    patienten: inLeiste('kunden'),
    verordnungen: inLeiste('verordnungen'),
    scan: !!scanKnopf && scanKnopf.style.display !== 'none',
    oeffneTermin: fn('openBookingModal'),
    oeffneVerordnung: fn('openRezeptModal'),
    leadKnopf: document.getElementById('leadAddBtn'),
  };
}

function fuellen({ menue, eintrag }) {
  const l = lage();
  const aktion = {
    termin: () => eintrag('Termin', SYMBOL.termin, () => l.oeffneTermin(null)),
    patient: () => eintrag('Patient', SYMBOL.patient, () => l.leadKnopf.click()),
    verordnung: () => eintrag('Verordnung erfassen', SYMBOL.verordnung, () => l.oeffneVerordnung(null, null)),
    scannen: () => eintrag('Rezept scannen', SYMBOL.scannen, () => document.getElementById('rezeptScanBtn')?.click()),
  };
  for (const id of neuEintraege(l)) menue.appendChild(aktion[id]());
}

let fertig = false;
/** Einmal einhängen, ganz links in der rechten Kopfleisten-Gruppe. */
export function verdrahteNeu() {
  if (fertig) return;
  const rechts = document.querySelector('.topbar .topbar-right');
  if (!rechts) return;
  fertig = true;
  const m = kopfMenue({ klasse: 'px-neu', id: 'pxNeuMenue', fuellen });
  m.knopf.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Neu</span>';
  m.knopf.setAttribute('aria-label', 'Neu anlegen');
  rechts.prepend(m.wrap);
  // Erst jetzt den alten Scan-Knopf ausblenden: „Rezept scannen“ steht ab hier im Menü.
  document.documentElement.classList.add('px-neu-bereit');
}
