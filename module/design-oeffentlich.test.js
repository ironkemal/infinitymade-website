import { test } from 'node:test';
import assert from 'node:assert/strict';
const { leseWunsch, wendeAn } = await import('./design-oeffentlich-logik.js');
const speicher = (wert, wirft = false) => ({ getItem: () => { if (wirft) throw new Error('x'); return wert; } });
const wurzel = () => { const a = new Map(); return { setAttribute: (k, v) => a.set(k, v), removeAttribute: (k) => a.delete(k), get: (k) => a.get(k) }; };

test('Wunsch: Query vor Speicher, Fehler = kein Wunsch', () => {
  assert.equal(leseWunsch('?design=neu', speicher(null)), 'neu');
  assert.equal(leseWunsch('?design=alt', speicher('neu')), 'alt');
  assert.equal(leseWunsch('', speicher('neu')), 'neu');
  assert.equal(leseWunsch('', speicher('x')), null);
  assert.equal(leseWunsch('', speicher('neu', true)), null);
  assert.equal(leseWunsch('?design=quatsch', null), null);
});

test('Anwenden: nur mit designVorschau UND Wunsch neu; sonst Alt (SaaS/Box)', () => {
  let w = wurzel();
  assert.equal(wendeAn({ vorschau: true, suche: '?design=neu', speicher: speicher(null), wurzel: w }), 'neu'); assert.equal(w.get('data-design'), 'neu');
  w = wurzel(); w.setAttribute('data-design', 'neu');
  assert.equal(wendeAn({ vorschau: false, suche: '?design=neu', speicher: speicher('neu'), wurzel: w }), 'alt'); assert.equal(w.get('data-design'), undefined);
  assert.equal(wendeAn({ vorschau: undefined, suche: '?design=neu', speicher: speicher('neu'), wurzel: w }), 'alt');
  assert.equal(wendeAn({ vorschau: true, suche: '?design=alt', speicher: speicher('neu'), wurzel: w }), 'alt');
});
