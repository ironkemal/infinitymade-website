import test from 'node:test';
import assert from 'node:assert/strict';
import * as browser from './standort-plan-regel.js';
import * as backend from '../api-backend/lib/standort-plan.js';
import { planErlaubt } from '../api-backend/lib/standort-plan-laden.js';
import { readFileSync } from 'node:fs';

const plan = [
  { employee_id: 'e1', business_id: 'A', weekday: 1, datum: null, von: '08:00:00', bis: '12:00:00' },
  { employee_id: 'e1', business_id: 'B', weekday: 1, datum: null, von: '14:00:00', bis: '18:00:00' },
  { employee_id: 'e1', business_id: 'A', weekday: 2, datum: null, von: null, bis: null },
  { employee_id: 'e1', business_id: 'B', weekday: null, datum: '2026-11-16' }, // Einzeltag Montag: ganztags B
];
const MO = '2026-11-09';
const h = (std, min = 0) => std * 60 + min;

for (const [name, r] of [['Browser', browser], ['Backend', backend]]) {
  test(`${name}: Mo 8–12 A, 14–18 B`, () => {
    assert.equal(r.imZeitfenster(plan, 'e1', MO, 'A', h(9), h(9, 30), ['A', 'B']), true);
    assert.equal(r.imZeitfenster(plan, 'e1', MO, 'A', h(11, 40), h(12, 10), ['A', 'B']), false, 'über das Ende');
    assert.equal(r.imZeitfenster(plan, 'e1', MO, 'A', h(15), h(15, 30), ['A', 'B']), false);
    assert.equal(r.imZeitfenster(plan, 'e1', MO, 'B', h(15), h(15, 30), ['A', 'B']), true);
    assert.equal(r.imZeitfenster(plan, 'e1', MO, 'B', h(9), h(9, 30), ['A', 'B']), false);
    assert.equal(r.imZeitfenster(plan, 'e1', MO, 'A', h(11, 30), h(12), ['A', 'B']), true, 'endet genau am Fensterende');
  });
  test(`${name}: ohne Fenster ganzer Tag, Einzeltag vor Muster, ohne Plan alle`, () => {
    assert.equal(r.imZeitfenster(plan, 'e1', '2026-11-10', 'A', h(19), h(19, 30), ['A', 'B']), true);
    assert.equal(r.imZeitfenster(plan, 'e1', '2026-11-16', 'B', h(9), h(9, 30), ['A', 'B']), true);
    assert.equal(r.imZeitfenster(plan, 'e1', '2026-11-16', 'A', h(9), h(9, 30), ['A', 'B']), false);
    assert.equal(r.imZeitfenster(plan, 'e2', MO, 'A', h(15), h(16), ['A', 'B']), true, 'anderer Mitarbeiter ohne Plan');
    assert.equal(r.imZeitfenster(plan, 'e1', '2026-11-11', 'B', h(7), h(8), ['A', 'B']), true, 'Mittwoch ohne Muster');
    assert.equal(r.imZeitfenster(plan, 'e1', MO, 'A', null, null, ['A', 'B']), true, 'ohne Zeit nur Tagesprüfung');
  });
  test(`${name}: zeitInMinuten`, () => {
    assert.equal(r.zeitInMinuten('08:30:00'), 510);
    assert.equal(r.zeitInMinuten('8:30'), null);
    assert.equal(r.zeitInMinuten(null), null);
  });
}

test('Backend planErlaubt: Slot-Zeit und Minuten, ohne Zeit nur Tag', () => {
  assert.equal(planErlaubt(plan, 'e1', MO, 'A', { start: '09:00', dauerMin: 30 }), true);
  assert.equal(planErlaubt(plan, 'e1', MO, 'A', { start: '15:00', dauerMin: 30 }), false);
  assert.equal(planErlaubt(plan, 'e1', MO, 'A', { vonMin: h(11, 45), dauerMin: 20 }), false);
  assert.equal(planErlaubt(plan, 'e1', MO, 'A'), true);
  assert.equal(planErlaubt([], 'e1', MO, 'A', { start: '15:00', dauerMin: 30 }), true);
});

test('Beide Regelkopien sind ab Zeile 12 textgleich (nur der Kopf darf abweichen)', () => {
  const rumpf = pfad => readFileSync(new URL(pfad, import.meta.url), 'utf8').split('\n').slice(11).join('\n');
  assert.equal(rumpf('../api-backend/lib/standort-plan.js'), rumpf('./standort-plan-regel.js'));
});
