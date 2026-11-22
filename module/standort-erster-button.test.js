// Testbox 22.11.2026: In einer frisch installierten Box (noch keine businesses-Zeile) reagierte
// „＋ Neues Geschäft hinzufügen" nicht. renderBusinessesSection() kehrte bei leerer Liste zurück,
// BEVOR Button und Formular verdrahtet wurden. Ohne ersten Standort kann sich in der Box kein
// Mitarbeiter anmelden (loadModulePermissions → PERMISSIONS_UNAVAILABLE).
// Kein Netzwerk, keine echten Daten: die Produktionsfunktion läuft in einer VM gegen Attrappen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dashboard = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');

/** @param {string} name */
function funktion(name) {
  const start = dashboard.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Produktionsfunktion ${name} vorhanden`);
  return dashboard.slice(start, dashboard.indexOf('\n}\n', start) + 2);
}

/** @param {any[]} businesses */
function abschnitt(businesses) {
  /** @type {Record<string, Function[]>} */
  const klicks = { add: [], section: [] };
  const geoeffnet = [];
  let verdrahtet = 0;
  const section = { hidden: true, dataset: {}, addEventListener: (/** @type {string} */ ev, /** @type {Function} */ fn) => { assert.equal(ev, 'click'); klicks.section.push(fn); } };
  const listEl = { innerHTML: '', querySelectorAll: () => [] };
  const addBtn = { addEventListener: (/** @type {string} */ ev, /** @type {Function} */ fn) => { assert.equal(ev, 'click'); klicks.add.push(fn); } };
  const ids = /** @type {Record<string, any>} */ ({ settingsBusinessesSection: section, businessesList: listEl, addBusinessBtn: addBtn });
  const context = vm.createContext({
    IST_KUTU: true, ENTERPRISE_PLANS: new Set(['enterprise']),
    currentProfile: { role: 'owner', plan: 'professional', plan_status: 'active' },
    myBusinesses: businesses, ownerProfile: null,
    window: { location: { origin: 'https://box.example.test' } },
    document: { getElementById: (/** @type {string} */ id) => ids[id] ?? null },
    escapeHtml: (/** @type {string} */ s) => String(s ?? ''),
    ICON: { link: '', clipboard: '' }, t: (/** @type {string} */ k) => k, showToast() {},
    navigator: { clipboard: { writeText: async () => {} } },
    openBusinessModal: (/** @type {any} */ biz) => { geoeffnet.push(biz); },
    deleteBusiness: async () => {},
    wireBusinessModal: () => { verdrahtet++; },
  });
  vm.runInContext(funktion('isEnterprise') + '\n' + funktion('renderBusinessesSection'), context);
  return {
    render: () => vm.runInContext('renderBusinessesSection()', context),
    section, listEl, klicks, geoeffnet, verdrahtet: () => verdrahtet,
  };
}

test('Box ohne Standort: Button „Neues Geschäft" öffnet das Formular', () => {
  const a = abschnitt([]);
  a.render();
  assert.equal(a.section.hidden, false, 'Abschnitt sichtbar');
  assert.match(a.listEl.innerHTML, /Noch kein Geschäft/);
  assert.equal(a.klicks.add.length, 1, 'Button verdrahtet, obwohl Liste leer');
  assert.equal(a.verdrahtet(), 1, 'Formular (Speichern) verdrahtet, obwohl Liste leer');
  a.klicks.add[0]();
  assert.deepEqual(a.geoeffnet, [null], 'Formular für neues Geschäft geöffnet');
});

test('Erneutes Zeichnen verdrahtet nicht doppelt (sonst doppelte Inserts beim Speichern)', () => {
  const a = abschnitt([]);
  a.render();
  a.render();
  assert.equal(a.klicks.add.length, 1);
  assert.equal(a.verdrahtet(), 1);
});

test('Mit vorhandenem Standort bleibt der Button verdrahtet', () => {
  const a = abschnitt([{ id: 'synthetic-1', business_name: 'Teststandort', booking_slug: null }]);
  a.render();
  assert.equal(a.klicks.add.length, 1);
  assert.match(a.listEl.innerHTML, /Teststandort/);
});
