import test from 'node:test';
import assert from 'node:assert/strict';
import { mountTerminKonflikte, terminFreigabe } from './termin-konflikte.js';

const konfliktFeld = {
  replaceChildren() {},
  append() {},
  scrollIntoView() {},
};
const felder = {
  bookingModal: { hidden: false, addEventListener() {} },
  bkKonflikte: konfliktFeld,
  bkEmployee: { value: 'Chrome1911 Emp' },
  bkRaum: { value: 'Chrome1911 Gruppe' },
  bkStart: { value: '2026-11-23T10:00' },
};
globalThis.document = {
  getElementById: id => felder[id],
  createElement: () => ({ style: {}, append() {} }),
};
globalThis.MutationObserver = class { observe() {} };

const abwesenheit = { grund: 'Therapeut:in ist wegen Abwesenheit nicht verfügbar.', sperre: false };
const gruppe = { grund: 'Im Gruppenraum ist ein weiterer Platz frei.', sperre: false };
const arbeitszeit = { grund: 'Termin liegt außerhalb der Arbeitszeit.', sperre: false };

function verdrahte(t, konflikte, antwort) {
  const fragen = [], meldungen = [];
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({ konflikte, vorschlaege: [] }),
  }));
  mountTerminKonflikte({
    apiBase: '/api',
    getToken: async () => 'Chrome1911',
    getDauerMin: () => 25,
    getBusinessId: () => null,
    getLeistungen: () => [{ serviceId: 'Chrome1911 KG' }],
    showConfirmModal: async frage => { fragen.push(frage); return antwort; },
    showToast: meldung => meldungen.push(meldung),
  });
  return { fragen, meldungen };
}

test('Abwesenheit, Arbeitszeit und Gruppenraum erscheinen in einer Bestätigung', async t => {
  const { fragen } = verdrahte(t, [abwesenheit, arbeitszeit, gruppe], true);
  assert.equal(await terminFreigabe(25), true);
  assert.equal(fragen.length, 1);
  assert.equal(fragen[0].confirmText, 'Trotzdem eintragen');
  assert.equal(fragen[0].message, [abwesenheit, arbeitszeit, gruppe].map(k => k.grund).join('\n'));
});

test('Abbrechen verwirft die Freigabe', async t => {
  const { fragen } = verdrahte(t, [abwesenheit], false);
  assert.equal(await terminFreigabe(25), false);
  assert.equal(fragen.length, 1);
});

test('Therapeutenüberschneidung sperrt den Termin ohne Weiter-Knopf', async t => {
  const belegt = { grund: 'Therapeut:in ist belegt.', sperre: true };
  const { fragen, meldungen } = verdrahte(t, [belegt], true);
  assert.equal(await terminFreigabe(25), false);
  assert.deepEqual(fragen, []);
  assert.deepEqual(meldungen, [belegt.grund]);
});

test('Freier Termin benötigt keine Bestätigung', async t => {
  const { fragen } = verdrahte(t, [], false);
  assert.equal(await terminFreigabe(25), true);
  assert.deepEqual(fragen, []);
});
