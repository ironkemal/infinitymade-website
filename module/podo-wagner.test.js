import test from 'node:test';
import assert from 'node:assert/strict';
import { wagnerWert, wagnerRelevant, wagnerAnzeige, wagnerRozetHtml, ladeWagnerRozet } from './podo-wagner.js';

const esc = (s) => String(s);

test('wagnerWert: 0..5, leer = nicht erhoben, Rest null', () => {
  assert.equal(wagnerWert('0'), 0);
  assert.equal(wagnerWert(5), 5);
  for (const x of ['', null, undefined, '6', -1, 1.5, 'x']) assert.equal(wagnerWert(x), null, String(x));
});

test('wagnerRelevant: DF oder E10/E11', () => {
  assert.equal(wagnerRelevant({ dgs: ['DF'] }), true);
  assert.equal(wagnerRelevant({ dgs: ['DF-c'] }), true);
  assert.equal(wagnerRelevant({ icd10: ['E11.74'] }), true);
  assert.equal(wagnerRelevant({ icd10: ['E10'] }), true);
  assert.equal(wagnerRelevant({ dgs: ['NF', 'UI1'], icd10: ['L60.0', 'E12.1', 'E110'] }), false);
  assert.equal(wagnerRelevant({}), false);
});

test('wagnerAnzeige: Befund vor Verordnung, Wagner 0 zählt', () => {
  assert.deepEqual(wagnerAnzeige({ befund: { wagner_grad: 1, erstellt_am: '2026-09-12T08:00:00Z' }, vord: { wagner_grad: 3, ausstellungsdatum: '2026-01-02' } }),
    { grad: 1, datum: '12.09.2026', quelle: 'befund' });
  assert.deepEqual(wagnerAnzeige({ befund: { wagner_grad: 0, erstellt_am: '2026-09-12' } }), { grad: 0, datum: '12.09.2026', quelle: 'befund' });
  assert.deepEqual(wagnerAnzeige({ befund: null, vord: { wagner_grad: 2, ausstellungsdatum: '2026-01-02' } }), { grad: 2, datum: '02.01.2026', quelle: 'verordnung' });
  assert.equal(wagnerAnzeige({ befund: { wagner_grad: null }, vord: { wagner_grad: null } }), null);
});

test('wagnerRozetHtml: Text, Stufe, leer', () => {
  assert.equal(wagnerRozetHtml(null, esc), '');
  assert.match(wagnerRozetHtml({ grad: 1, datum: '12.09.2026', quelle: 'befund' }, esc), />Wagner 1 · 12\.09\.2026</);
  assert.match(wagnerRozetHtml({ grad: 4, datum: '', quelle: 'befund' }, esc), /anam-rozet--rot/);
  assert.match(wagnerRozetHtml({ grad: 0, datum: '', quelle: 'verordnung' }, esc), /anam-rozet--mehr/);
});

function fakeSb({ vs, befund, wirft }) {
  const kette = (daten) => { const k = { select: () => k, eq: () => k, not: () => k, order: () => k, limit: () => k,
    maybeSingle: async () => ({ data: daten }), then: (f) => f({ data: daten }) }; return k; };
  return { from: (t) => { if (wirft) throw new Error('x'); return kette(t === 'prescriptions' ? vs : befund); } };
}

test('ladeWagnerRozet: nur bei DF/E11, sonst leer; Fehler → leer', async () => {
  const b = { wagner_grad: 2, erstellt_am: '2026-09-12' };
  assert.match(await ladeWagnerRozet(fakeSb({ vs: [{ diagnosegruppe: 'DF' }], befund: b }), 'o', 'l', esc), /Wagner 2 · 12\.09\.2026/);
  assert.match(await ladeWagnerRozet(fakeSb({ vs: [{ diagnosegruppe: 'NF', icd10: 'E11.9' }], befund: b }), 'o', 'l', esc), /Wagner 2/);
  assert.equal(await ladeWagnerRozet(fakeSb({ vs: [{ diagnosegruppe: 'NF', icd10: 'L60.0' }], befund: b }), 'o', 'l', esc), '');
  assert.match(await ladeWagnerRozet(fakeSb({ vs: [{ diagnosegruppe: 'DF', wagner_grad: 3, ausstellungsdatum: '2026-01-02' }], befund: null }), 'o', 'l', esc), /Wagner 3 · 02\.01\.2026/);
  assert.equal(await ladeWagnerRozet(fakeSb({ wirft: true }), 'o', 'l', esc), '');
  assert.equal(await ladeWagnerRozet(null, 'o', 'l', esc), '');
});
