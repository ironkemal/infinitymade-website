import test from 'node:test';
import assert from 'node:assert/strict';
import { ladeStandortPlan, spaltenNachPlan, planSpalten, _planSperreZuruecksetzen } from './standort-plan-laden.js';

function fake(result, zaehler) {
  const q = { select: () => q, eq: () => q, in: () => { zaehler.n++; if (result instanceof Error) throw result; return Promise.resolve(result); } };
  return { from: (t) => { assert.equal(t, 'employee_standort_plan'); return q; } };
}
const team = [{ id: 'e1' }, { id: 'e2' }];
// e1: Montag B, Dienstag A (ein Wochentag ohne Eintrag hiesse "alle", nicht "frei").
const plan = [{ employee_id: 'e1', business_id: 'B', weekday: 1, datum: null }, { employee_id: 'e1', business_id: 'A', weekday: 2, datum: null }];

test('Tabelle fehlt -> [], danach kein zweiter Request', async () => {
  _planSperreZuruecksetzen();
  const z = { n: 0 };
  const sb = fake({ data: null, error: { code: '42P01', message: 'relation does not exist' } }, z);
  assert.deepEqual(await ladeStandortPlan(sb, { ownerId: 'o', employeeIds: ['e1'] }), []);
  assert.deepEqual(await ladeStandortPlan(sb, { ownerId: 'o', employeeIds: ['e1'] }), []);
  assert.equal(z.n, 1);
});

test('Exception -> [] ohne Wurf', async () => {
  _planSperreZuruecksetzen();
  assert.deepEqual(await ladeStandortPlan(fake(new Error('x'), { n: 0 }), { ownerId: 'o', employeeIds: ['e1'] }), []);
});

test('Sperre laeuft ab', async () => {
  _planSperreZuruecksetzen();
  const z = { n: 0 };
  const sb = fake({ data: null, error: { message: 'boom' } }, z);
  await ladeStandortPlan(sb, { ownerId: 'o', employeeIds: ['e1'] }, 1000);
  await ladeStandortPlan(sb, { ownerId: 'o', employeeIds: ['e1'] }, 1000 + 61000);
  assert.equal(z.n, 2);
});

test('Spalten: kein Plan / kein Standort -> unveraendert', () => {
  assert.equal(spaltenNachPlan(team, [], '2026-11-02', 'B'), team);
  assert.equal(spaltenNachPlan(team, plan, '2026-11-02', null), team);
});

test('Spalten: e1 Montag (2026-11-02) bei B sichtbar, Dienstag nicht', () => {
  assert.deepEqual(spaltenNachPlan(team, plan, '2026-11-02', 'B').map((e) => e.id), ['e1', 'e2']);
  assert.deepEqual(spaltenNachPlan(team, plan, '2026-11-03', 'B').map((e) => e.id), ['e2']);
});

test('Spalten: Termin am Tag haelt Spalte sichtbar', () => {
  const r = spaltenNachPlan(team, plan, '2026-11-03', 'B', [{ user_id: 'e1' }]);
  assert.deepEqual(r.map((e) => e.id), ['e1', 'e2']);
});

test('Spalten: Plan darf nicht erweitern, Standort A bleibt fuer e1 aus am Montag', () => {
  assert.deepEqual(spaltenNachPlan(team, plan, '2026-11-02', 'A').map((e) => e.id), ['e2']);
});

test('Spalten: alle nach verifiziertem Plan am anderen Standort -> leer', () => {
  const p = [{ employee_id: 'e1', business_id: 'A', weekday: 2, datum: null }, { employee_id: 'e2', business_id: 'A', weekday: 2, datum: null }];
  assert.deepEqual(spaltenNachPlan(team, p, '2026-11-03', 'B'), []);
  assert.deepEqual(spaltenNachPlan(team, p, '2026-11-03', 'B', [{ user_id: 'e1', business_id: 'B' }]), [team[0]]);
  assert.deepEqual(spaltenNachPlan(team, p, '2026-11-03', 'B', [{ user_id: 'e1', business_id: 'A' }]), []);
});

test('planSpalten: Fehler -> Team unveraendert, eine Anfrage', async () => {
  _planSperreZuruecksetzen();
  const z = { n: 0 };
  const sb = fake({ data: null, error: { code: 'PGRST205' } }, z);
  assert.equal(await planSpalten(sb, { team, bookings: [], datum: '2026-11-03', businessId: 'B', ownerId: 'o' }), team);
  assert.equal(await planSpalten(sb, { team, bookings: [], datum: '2026-11-03', businessId: 'B', ownerId: 'o' }), team);
  assert.equal(z.n, 1);
});

test('planSpalten: ein Mitarbeiter wird nach Tagesplan ebenfalls ausgeblendet', async () => {
  _planSperreZuruecksetzen();
  const z = { n: 0 };
  const sb = fake({ data: plan }, z);
  assert.deepEqual(await planSpalten(sb, { team: [team[0]], datum: '2026-11-03', businessId: 'B', ownerId: 'o' }), []);
  assert.deepEqual(await planSpalten(sb, { team: [team[0]], datum: '2026-11-02', businessId: 'B', ownerId: 'o' }), [team[0]]);
  assert.deepEqual(await planSpalten(sb, { team: [team[0]], bookings: [{ user_id: 'e1', business_id: 'B' }], datum: '2026-11-03', businessId: 'B', ownerId: 'o' }), [team[0]]);
  assert.equal(z.n, 3);
});

test('planSpalten: leerer Plan oder Lesefehler lässt auch ein Einzelteam unverändert', async () => {
  const einzel = [team[0]];
  for (const antwort of [{ data: [] }, { data: null }, { data: null, error: { code: 'PGRST205' } }, new Error('Lesefehler')]) {
    _planSperreZuruecksetzen();
    assert.equal(await planSpalten(fake(antwort, { n: 0 }), { team: einzel, datum: '2026-11-03', businessId: 'B', ownerId: 'o' }), einzel);
  }
});

test('planSpalten: kein Team oder kein Standort -> keine Anfrage', async () => {
  _planSperreZuruecksetzen();
  const z = { n: 0 };
  const sb = fake({ data: plan }, z);
  await planSpalten(sb, { team: [], datum: '2026-11-03', businessId: 'B', ownerId: 'o' });
  await planSpalten(sb, { team, datum: '2026-11-03', businessId: null, ownerId: 'o' });
  assert.equal(z.n, 0);
});
