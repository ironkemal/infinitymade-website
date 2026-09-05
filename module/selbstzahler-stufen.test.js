import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STUFEN_MAX, normalisiereStufen, stufenAusProfil, letztePreiseAusRechnungen,
} from './selbstzahler-stufen.js';

test('normalisiereStufen: leere und kaputte Eingaben ergeben eine leere Liste', () => {
  assert.deepEqual(normalisiereStufen(null), []);
  assert.deepEqual(normalisiereStufen('sb1'), []);
  assert.deepEqual(normalisiereStufen([]), []);
  assert.deepEqual(normalisiereStufen([null, 7, 'x']), []);
});

test('normalisiereStufen: ohne Namen oder ohne positiven Betrag fliegt raus', () => {
  const raus = normalisiereStufen([
    { id: 'a', name: '  ', betrag_eur: 50 },
    { id: 'b', name: 'SB1', betrag_eur: 0 },
    { id: 'c', name: 'SB2', betrag_eur: -5 },
    { id: 'd', name: 'SB3', betrag_eur: 'abc' },
    { id: 'e', name: 'SB4', betrag_eur: 68 },
  ]);
  assert.deepEqual(raus, [{ id: 'e', name: 'SB4', betrag_eur: 68 }]);
});

test('normalisiereStufen: Betrag wird auf Cent gerundet, Name getrimmt', () => {
  const [s] = normalisiereStufen([{ id: 'a', name: '  Hausbesuch  ', betrag_eur: 68.005 }]);
  assert.equal(s.name, 'Hausbesuch');
  assert.equal(s.betrag_eur, 68.01);
});

test('normalisiereStufen: doppelte Ids werden neu vergeben, nicht zusammengeworfen', () => {
  const raus = normalisiereStufen([
    { id: 'gleich', name: 'A', betrag_eur: 10 },
    { id: 'gleich', name: 'B', betrag_eur: 20 },
  ]);
  assert.equal(raus.length, 2);
  assert.notEqual(raus[0].id, raus[1].id);
});

test('normalisiereStufen: mehr als STUFEN_MAX wird gekappt', () => {
  const viele = Array.from({ length: STUFEN_MAX + 4 }, (_, i) => ({ id: `i${i}`, name: `S${i}`, betrag_eur: i + 1 }));
  assert.equal(normalisiereStufen(viele).length, STUFEN_MAX);
});

test('stufenAusProfil: fehlende Spalte ist kein Fehler', () => {
  assert.deepEqual(stufenAusProfil(undefined), []);
  assert.deepEqual(stufenAusProfil({}), []);
  assert.equal(stufenAusProfil({ selbstzahler_stufen: [{ id: 'a', name: 'SB1', betrag_eur: 50 }] }).length, 1);
});

test('letztePreiseAusRechnungen: je Bezeichnung gewinnt die jüngste Rechnung', () => {
  const raus = letztePreiseAusRechnungen([
    { created_at: '2026-09-01', line_items: [{ title: 'Podologische Behandlung', unit_price: 68 }] },
    { created_at: '2026-06-01', line_items: [{ title: 'Podologische Behandlung', unit_price: 50 }] },
  ]);
  assert.deepEqual(raus, [{ title: 'Podologische Behandlung', betrag_eur: 68, datum: '2026-09-01' }]);
});

test('letztePreiseAusRechnungen: issued_at schlägt created_at als Datum', () => {
  const [e] = letztePreiseAusRechnungen([
    { issued_at: '2026-08-20', created_at: '2026-08-19', line_items: [{ title: 'X', unit_price: 5 }] },
  ]);
  assert.equal(e.datum, '2026-08-20');
});

test('letztePreiseAusRechnungen: Zeilen ohne Titel oder ohne Betrag zählen nicht', () => {
  const raus = letztePreiseAusRechnungen([
    { created_at: '2026-09-01', line_items: [
      { title: '', unit_price: 40 },
      { title: 'Gratis', unit_price: 0 },
      { title: 'Echt', unit_price: 33.5 },
    ] },
  ]);
  assert.deepEqual(raus, [{ title: 'Echt', betrag_eur: 33.5, datum: '2026-09-01' }]);
});

test('letztePreiseAusRechnungen: maxEintraege begrenzt die Ausgabe', () => {
  const raus = letztePreiseAusRechnungen([
    { created_at: '2026-09-01', line_items: [
      { title: 'A', unit_price: 1 }, { title: 'B', unit_price: 2 }, { title: 'C', unit_price: 3 },
    ] },
  ], 2);
  assert.equal(raus.length, 2);
  assert.deepEqual(raus.map(e => e.title), ['A', 'B']);
});

test('letztePreiseAusRechnungen: kaputte line_items werfen nicht', () => {
  assert.deepEqual(letztePreiseAusRechnungen([{ created_at: 'x', line_items: null }]), []);
  assert.deepEqual(letztePreiseAusRechnungen(null), []);
});
