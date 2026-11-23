// O-251: Reiter „Berechtigungen" ohne Standort — sichtbar, Formular aus, Hinweis + Knopf;
// mit Standort wieder genau der alte Zustand. Kein jsdom: kleine Element-Attrappe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rechteReiterVorbereiten, standortAnlegenOeffnen, HINWEIS_ID } from './rechte-ohne-standort.js';

function element(/** @type {string} */ id = '', hidden = false) {
  /** @type {any} */
  const el = {
    id, hidden, dataset: {}, children: /** @type {any[]} */ ([]), innerHTML: '', className: '', klicks: [],
    prepend(/** @type {any} */ kind) { kind.parent = el; el.children.unshift(kind); },
    remove() { if (el.parent) el.parent.children = el.parent.children.filter((/** @type {any} */ k) => k !== el); },
    addEventListener(/** @type {string} */ ev, /** @type {Function} */ fn) { assert.equal(ev, 'click'); el.klicks.push(fn); },
    querySelector: () => el.knopf,
    click() { el.klicks.forEach((/** @type {Function} */ f) => f()); },
  };
  return el;
}

function dom() {
  const inhalt = element('tab-permissions');
  const standortWrap = element('empStandortWrap', true); // gehört renderEmpStandortList()
  const gruppe = element('');
  const speichern = element('empPermSaveBtn');
  for (const k of [standortWrap, gruppe, speichern]) { k.parent = inhalt; inhalt.children.push(k); }
  const reiter = element('empTabPermissions', true);
  /** @type {Record<string, any>} */
  const ids = { 'tab-permissions': inhalt, empTabPermissions: reiter };
  const doc = /** @type {any} */ ({
    getElementById: (/** @type {string} */ id) => ids[id] ?? inhalt.children.find((/** @type {any} */ k) => k.id === id) ?? null,
    createElement: () => { const e = element(); e.knopf = element(); return e; },
  });
  return { doc, inhalt, standortWrap, gruppe, speichern, reiter, ids };
}

test('ohne Standort: Reiter sichtbar, Formular aus, Hinweis mit Knopf, Rückgabe false', () => {
  const d = dom();
  let geklickt = 0;
  assert.equal(rechteReiterVorbereiten(d.doc, { hatStandort: false, onStandortAnlegen: () => { geklickt++; } }), false);
  assert.equal(d.reiter.hidden, false);
  assert.equal(d.gruppe.hidden, true);
  assert.equal(d.speichern.hidden, true);
  const hinweis = d.inhalt.children[0];
  assert.equal(hinweis.id, HINWEIS_ID);
  assert.match(hinweis.innerHTML, /noch keinen Standort/);
  hinweis.knopf.click();
  assert.equal(geklickt, 1);
});

test('zweiter Aufruf ohne Standort legt keinen zweiten Hinweis an', () => {
  const d = dom();
  rechteReiterVorbereiten(d.doc, { hatStandort: false });
  rechteReiterVorbereiten(d.doc, { hatStandort: false });
  assert.equal(d.inhalt.children.filter((/** @type {any} */ k) => k.id === HINWEIS_ID).length, 1);
});

test('mit Standort danach: Hinweis weg, nur selbst Versteckte wieder sichtbar', () => {
  const d = dom();
  rechteReiterVorbereiten(d.doc, { hatStandort: false });
  assert.equal(rechteReiterVorbereiten(d.doc, { hatStandort: true }), true);
  assert.equal(d.inhalt.children.some((/** @type {any} */ k) => k.id === HINWEIS_ID), false);
  assert.equal(d.gruppe.hidden, false);
  assert.equal(d.speichern.hidden, false);
  assert.equal(d.standortWrap.hidden, true, 'empStandortWrap bleibt in der Hand von renderEmpStandortList');
});

test('Standort anlegen: wechselt zu Einstellungen und öffnet das Formular, wenn sichtbar', async () => {
  const d = dom();
  const abschnitt = element('settingsBusinessesSection', false);
  const neu = element('addBusinessBtn');
  let geoeffnet = 0;
  neu.addEventListener('click', () => { geoeffnet++; });
  d.ids.settingsBusinessesSection = abschnitt; d.ids.addBusinessBtn = neu;
  /** @type {string[]} */
  const panels = [];
  assert.equal(await standortAnlegenOeffnen({ wechslePanel: id => panels.push(id), doc: d.doc, warte: async () => {} }), true);
  assert.deepEqual(panels, ['settings']);
  assert.equal(geoeffnet, 1);
  abschnitt.hidden = true;
  assert.equal(await standortAnlegenOeffnen({ wechslePanel: () => {}, doc: d.doc, warte: async () => {} }), false);
  assert.equal(geoeffnet, 1);
});

test('Standort anlegen öffnet über gehZuEinstellung auch den Bereich „Standorte“ (Bereichs-Navigation, 23.11.2026)', async () => {
  const d = dom();
  d.ids.settingsBusinessesSection = element('settingsBusinessesSection', false);
  d.ids.addBusinessBtn = element('addBusinessBtn');
  /** @type {string[]} */ const gesprungen = []; /** @type {string[]} */ const panels = [];
  globalThis.gehZuEinstellung = async (id) => { gesprungen.push(id); };
  try {
    assert.equal(await standortAnlegenOeffnen({ wechslePanel: id => panels.push(id), doc: d.doc, warte: async () => {} }), true);
    assert.deepEqual(gesprungen, ['settingsBusinessesSection']);
    assert.deepEqual(panels, [], 'kein zusätzlicher Panelwechsel');
  } finally { delete globalThis.gehZuEinstellung; }
});
