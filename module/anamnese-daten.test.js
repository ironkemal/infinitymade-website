import test from 'node:test';
import assert from 'node:assert/strict';
import { ladeAktuelle, ladeAlleAktuellen, hatAktuelle, speichereNeu, bestaetige, markiereGeprueft, ladeAltrisiken } from './anamnese-daten.js';

// Kette, die jeden Filteraufruf protokolliert; `ergebnis` kommt am Ende (maybeSingle/limit/single/is).
function sb(ergebnis, log = []) {
  const k = {
    select: (c) => { log.push(['select', c]); return k; },
    eq: (c, v) => { log.push(['eq', c, v]); return k; },
    is: (c, v) => { log.push(['is', c, v]); return Promise.resolve(ergebnis); },
    not: () => k,
    order: (c, o) => { log.push(['order', c, o?.ascending]); return k; },
    limit: (n) => { log.push(['limit', n]); return Object.assign(Promise.resolve(ergebnis), { maybeSingle: async () => ergebnis }); },
    maybeSingle: async () => ergebnis,
    single: async () => ergebnis,
    insert: (p) => { log.push(['insert', p]); return k; },
    update: (p) => { log.push(['update', p]); return k; },
  };
  return { from: (t) => { log.push(['from', t]); return k; }, log };
}

test('ladeAktuelle: ist_aktuell + Fachbereich + created_at absteigend', async () => {
  const log = [];
  const r = await ladeAktuelle(sb({ data: { id: 'a' }, error: null }, log), 'L1', 'podo');
  assert.deepEqual(r, { row: { id: 'a' }, fehler: false });
  assert.deepEqual(log.filter((x) => x[0] === 'eq'), [['eq', 'patient_id', 'L1'], ['eq', 'ist_aktuell', true], ['eq', 'fachbereich', 'podo']]);
  assert.deepEqual(log.find((x) => x[0] === 'order'), ['order', 'created_at', false]);
});

test('ladeAktuelle: owner_id nur wenn übergeben; Fehler/kein Client wirft nie', async () => {
  const log = [];
  await ladeAktuelle(sb({ data: null, error: null }, log), 'L1', 'physio', 'O1');
  assert.ok(log.some((x) => x[0] === 'eq' && x[1] === 'owner_id' && x[2] === 'O1'));
  assert.deepEqual(await ladeAktuelle(sb({ data: null, error: null }), 'L1', 'podo'), { row: null, fehler: false });
  assert.equal((await ladeAktuelle(sb({ data: null, error: { message: 'x' } }), 'L1', 'podo')).fehler, 'x');
  assert.equal((await ladeAktuelle({ from() { throw new Error('boom'); } }, 'L1', 'podo')).fehler, 'boom');
  assert.equal((await ladeAktuelle(null, 'L1', 'podo')).fehler, true);
  assert.equal((await ladeAktuelle(sb({}), null, 'podo')).fehler, true);
});

test('ladeAlleAktuellen filtert ist_aktuell, ohne Fachbereich', async () => {
  const log = [];
  const r = await ladeAlleAktuellen(sb({ data: [{ id: 1 }], error: null }, log), 'L1');
  assert.equal(r.rows.length, 1);
  assert.deepEqual(log.filter((x) => x[0] === 'eq'), [['eq', 'patient_id', 'L1'], ['eq', 'ist_aktuell', true]]);
});

test('hatAktuelle: true/false, Fehler → null', async () => {
  assert.equal(await hatAktuelle(sb({ data: { id: 'a' }, error: null }), 'L1', 'podo'), true);
  assert.equal(await hatAktuelle(sb({ data: null, error: null }), 'L1', 'podo'), false);
  assert.equal(await hatAktuelle(sb({ data: null, error: { message: 'x' } }), 'L1', 'podo'), null);
});

test('speichereNeu: reines INSERT (kein update), Fehler als Text', async () => {
  const log = [];
  const r = await speichereNeu(sb({ data: { id: 'n', version: 2 }, error: null }, log), { patient_id: 'p' });
  assert.deepEqual(r.row, { id: 'n', version: 2 });
  assert.ok(log.some((x) => x[0] === 'insert'));
  assert.ok(!log.some((x) => x[0] === 'update'));
  assert.equal((await speichereNeu(sb({ data: null, error: { message: 'kaputt' } }), {})).error, 'kaputt');
});

test('bestaetige: INSERT einer Kopie mit uebernommen_von', async () => {
  const log = [];
  await bestaetige(sb({ data: { id: 'n' }, error: null }, log), { id: 'A1', owner_id: 'o', patient_id: 'p', fachbereich: 'podo', felder: {}, version: 4 }, { userId: 'U', heute: '2026-09-30' });
  const ins = log.find((x) => x[0] === 'insert')[1];
  assert.equal(ins.uebernommen_von, 'A1');
  assert.equal('version' in ins, false);
  assert.equal((await bestaetige(sb({}), null)).error, 'Keine Anamnese zum Bestätigen');
});

test('markiereGeprueft: UPDATE nur geprueft_am/geprueft_von, nur wenn noch NULL', async () => {
  const log = [];
  const r = await markiereGeprueft(sb({ error: null }, log), 'A1', 'U');
  assert.deepEqual(r, {});
  const up = log.find((x) => x[0] === 'update')[1];
  assert.deepEqual(Object.keys(up).sort(), ['geprueft_am', 'geprueft_von']);
  assert.equal(up.geprueft_von, 'U');
  assert.deepEqual(log.find((x) => x[0] === 'is'), ['is', 'geprueft_am', null]);
  assert.ok(log.some((x) => x[0] === 'eq' && x[1] === 'id' && x[2] === 'A1'));
  assert.equal((await markiereGeprueft(sb({ error: { message: 'nein' } }), 'A1', 'U')).error, 'nein');
});

test('ladeAltrisiken: jüngster Befund mit risiken ohne anamnese_id; sonst null', async () => {
  const daten = [
    { befund: { risiken: { anamnese_id: 'A1', diabetes: true } }, erstellt_am: '2026-09-01' },   // schon Kopie aus der Anamnese → kein Vorschlag
    { befund: {}, erstellt_am: '2026-08-20' },
    { befund: { risiken: { diabetes: false } }, erstellt_am: '2026-08-10' },
  ];
  const r = await ladeAltrisiken(sb({ data: daten, error: null }), 'L1');
  assert.deepEqual(r, { risiken: { diabetes: false }, datum: '2026-08-10' });
  assert.equal(await ladeAltrisiken(sb({ data: [], error: null }), 'L1'), null);
  assert.equal(await ladeAltrisiken({ from() { throw new Error('x'); } }, 'L1'), null);
});
