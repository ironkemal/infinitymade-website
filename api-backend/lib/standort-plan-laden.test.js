import test from 'node:test';
import assert from 'node:assert/strict';
import { ladeStandortPlan, planErlaubt, _planSperreZuruecksetzen } from './standort-plan-laden.js';

function fake(result, z) {
  const q = { select: () => q, eq: () => q, in: () => { z.n++; if (result instanceof Error) throw result; return Promise.resolve(result); } };
  return { from: () => q };
}
const plan = [{ employee_id: 'e1', business_id: 'B', weekday: 1, datum: null }];

test('Tabelle fehlt -> [] und nur ein Request', async () => {
  _planSperreZuruecksetzen();
  const z = { n: 0 };
  const sb = fake({ data: null, error: { code: '42P01', message: 'relation "x" does not exist' } }, z);
  assert.deepEqual(await ladeStandortPlan(sb, { ownerId: 'o', employeeIds: ['e1'] }), []);
  assert.deepEqual(await ladeStandortPlan(sb, { ownerId: 'o', employeeIds: ['e1'] }), []);
  assert.equal(z.n, 1);
});

test('Exception -> []', async () => {
  _planSperreZuruecksetzen();
  assert.deepEqual(await ladeStandortPlan(fake(new Error('x'), { n: 0 }), { ownerId: 'o', employeeIds: ['e1'] }), []);
});

test('Daten werden durchgereicht, leer bleibt leer', async () => {
  _planSperreZuruecksetzen();
  assert.deepEqual(await ladeStandortPlan(fake({ data: plan }, { n: 0 }), { ownerId: 'o', employeeIds: ['e1'] }), plan);
  assert.deepEqual(await ladeStandortPlan(fake({ data: [] }, { n: 0 }), { ownerId: 'o', employeeIds: ['e1'] }), []);
});

test('planErlaubt: ohne Plan/Standort immer true', () => {
  assert.equal(planErlaubt([], 'e1', '2026-11-03', 'B'), true);
  assert.equal(planErlaubt(plan, 'e1', '2026-11-03', null), true);
});

test('planErlaubt: Montag ja, Dienstag nein, anderer Standort nein, anderer Mitarbeiter ja', () => {
  assert.equal(planErlaubt(plan, 'e1', '2026-11-02', 'B'), true);
  assert.equal(planErlaubt(plan, 'e1', '2026-11-03', 'B'), false);
  assert.equal(planErlaubt(plan, 'e1', '2026-11-02', 'A'), false);
  assert.equal(planErlaubt(plan, 'e2', '2026-11-03', 'B'), true);
});
