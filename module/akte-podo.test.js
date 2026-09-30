import test from 'node:test';
import assert from 'node:assert/strict';
import { akteReiterPlan, setzeAkteReiter, verdrahteAkteKopf, PODO_AKTE_REITER, PODO_PANEL_UMZUG } from './akte-podo.js';

const sichtbarListe = (p) => Object.keys(p.sichtbar).filter(k => p.sichtbar[k]);

test('Podologie: genau die sechs Reiter, Rezepte heisst „Verordnungen"', () => {
  const p = akteReiterPlan({ isPhysio: true, isPodo: true });
  assert.deepEqual(sichtbarListe(p).sort(), [...PODO_AKTE_REITER].sort());
  assert.equal(PODO_AKTE_REITER.length, 6);
  assert.equal(p.rezepteText, 'Verordnungen');
  for (const weg of ['notes', 'einwilligung', 'ueberweisung', 'messreihen', 'termine', 'mail']) assert.equal(p.sichtbar[weg], false, weg);
});

test('Physio unverändert: Rezepte + Messreihen sichtbar, Fußbefund/Dokumente nicht', () => {
  const p = akteReiterPlan({ isPhysio: true, isPodo: false });
  assert.equal(p.rezepteText, 'Rezepte');
  assert.deepEqual(sichtbarListe(p).sort(),
    ['verlauf', 'notes', 'anamnese', 'einwilligung', 'ueberweisung', 'rezepte', 'messreihen', 'rechnungen', 'termine', 'mail'].sort());
});

test('Nicht-Praxis-Sektor: kein Rezepte/Messreihen wie bisher', () => {
  const p = akteReiterPlan({ isPhysio: false, isPodo: false });
  assert.equal(p.sichtbar.rezepte, false);
  assert.equal(p.sichtbar.messreihen, false);
  assert.equal(p.sichtbar.fussbefund, false);
});

// Minimales DOM: Elemente mit classList, style, hidden, parentElement, appendChild.
function el(id) {
  const klassen = new Set();
  return {
    id, hidden: false, style: {}, textContent: '', parentElement: null, children: [], _l: {},
    classList: { add: (...c) => c.forEach(x => klassen.add(x)), remove: (...c) => c.forEach(x => klassen.delete(x)), has: c => klassen.has(c) },
    appendChild(k) { k.parentElement = this; this.children.push(k); },
    addEventListener(t, f) { this._l[t] = f; },
  };
}
function fakeDoc(ids, tabs) {
  const byId = Object.fromEntries(ids.map(i => [i, el(i)]));
  const tabEl = Object.fromEntries(tabs.map(t => [t, el('tab-' + t)]));
  return { byId, tabEl,
    getElementById: (i) => byId[i] || null,
    querySelector: (s) => { const m = s.match(/data-tab="([^"]+)"/); return m ? tabEl[m[1]] || null : null; } };
}
const ALLE = ['verlauf', 'notes', 'anamnese', 'einwilligung', 'ueberweisung', 'rezepte', 'messreihen', 'fussbefund', 'dokumente', 'rechnungen', 'termine', 'mail'];
const IDS = [...PODO_PANEL_UMZUG.flat(), 'pdVerlaufNotizenBox', 'pdVerlaufTermineBox', 'pdDokEinwilligungBox', 'pdDokUeberweisungBox', 'pdDokMailBox', 'pdRezLoading', 'pdRezLeer', 'pdKopfAktionen'];

test('setzeAkteReiter Podologie: Reiter, Umzug der Panels (ids bleiben), Abschnitte + Kopf frei', () => {
  const d = fakeDoc(IDS, ALLE);
  setzeAkteReiter({ isPhysio: true, isPodo: true }, d);
  assert.equal(d.tabEl.notes.style.display, 'none');
  assert.equal(d.tabEl.fussbefund.style.display, '');
  assert.equal(d.tabEl.dokumente.style.display, '');
  assert.equal(d.tabEl.rezepte.textContent, 'Verordnungen');
  for (const [panel, ziel] of PODO_PANEL_UMZUG) assert.equal(d.byId[panel].parentElement, d.byId[ziel], panel);
  assert.equal(d.byId.pdPanelNotes.classList.has('pd-unter'), true);
  assert.equal(d.byId.pdPanelNotes.classList.has('pd-panel'), false);
  assert.equal(d.byId.pdVerlaufNotizenBox.hidden, false);
  assert.equal(d.byId.pdRezLoading.hidden, true);
  assert.equal(d.byId.pdRezLeer.hidden, false);
  assert.equal(d.byId.pdKopfAktionen.hidden, false);
  // idempotent: zweiter Aufruf verschiebt nichts doppelt
  setzeAkteReiter({ isPhysio: true, isPodo: true }, d);
  assert.equal(d.byId.pdDokMailHost.children.length, 1);
});

test('setzeAkteReiter Physio: nichts wird verschoben, Kopf-Knöpfe bleiben zu', () => {
  const d = fakeDoc(IDS, ALLE);
  d.byId.pdKopfAktionen.hidden = true; d.byId.pdVerlaufNotizenBox.hidden = true; d.byId.pdRezLoading.hidden = false;
  setzeAkteReiter({ isPhysio: true, isPodo: false }, d);
  assert.equal(d.tabEl.rezepte.style.display, '');
  assert.equal(d.tabEl.rezepte.textContent, 'Rezepte');
  assert.equal(d.tabEl.fussbefund.style.display, 'none');
  assert.equal(d.tabEl.dokumente.style.display, 'none');
  assert.equal(d.byId.pdPanelNotes.parentElement, null);
  assert.equal(d.byId.pdKopfAktionen.hidden, true);
  assert.equal(d.byId.pdVerlaufNotizenBox.hidden, true);
  assert.equal(d.byId.pdRezLoading.hidden, false);
});

test('Kopf-Knöpfe: „+ Termin" schliesst die Akte, öffnet die Maske leer und setzt den Patienten; „+ Verordnung" öffnet die Wahl', async () => {
  const d = fakeDoc(['pdKopfTerminBtn', 'pdKopfVerordnungBtn'], []);
  const log = [];
  globalThis._bkApplyLead = (id) => log.push('apply:' + id);
  verdrahteAkteKopf({
    leadId: () => 'L1', closeModal: (m) => log.push('close:' + m),
    prefillBookingModal: async (s) => { log.push('prefill:' + s); },
    oeffneAnlegenWahl: (id) => log.push('wahl:' + id),
  }, d);
  await d.byId.pdKopfTerminBtn._l.click();
  d.byId.pdKopfVerordnungBtn._l.click();
  delete globalThis._bkApplyLead;
  assert.deepEqual(log, ['close:patientDetailModal', 'prefill:null', 'apply:L1', 'close:patientDetailModal', 'wahl:L1']);
});

test('Kopf-Knöpfe: ohne Patient passiert nichts', async () => {
  const d = fakeDoc(['pdKopfTerminBtn', 'pdKopfVerordnungBtn'], []);
  const log = [];
  verdrahteAkteKopf({ leadId: () => null, closeModal: () => log.push('c'), prefillBookingModal: async () => log.push('p'), oeffneAnlegenWahl: () => log.push('w') }, d);
  await d.byId.pdKopfTerminBtn._l.click(); d.byId.pdKopfVerordnungBtn._l.click();
  assert.deepEqual(log, []);
});
