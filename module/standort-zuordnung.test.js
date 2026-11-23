import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sichtbareStandorte, standorteFuerNutzer } from './standort-zuordnung.js';

const A = { id: 'a', is_default: true };
const B = { id: 'b', is_default: false };
const C = { id: 'c', is_default: false };

test('Inhaber sieht alle Standorte', () => {
  assert.deepEqual(sichtbareStandorte([A, B, C], { rolle: 'owner' }), [A, B, C]);
});

test('Mitarbeiter sieht nur zugeordnete Standorte', () => {
  assert.deepEqual(sichtbareStandorte([A, B, C], { rolle: 'employee', zugeordneteIds: ['b', 'c'] }), [B, C]);
});

test('Mitarbeiter ohne Zuordnung oder bei Fehler: nur Standard, nie alle', () => {
  assert.deepEqual(sichtbareStandorte([A, B, C], { rolle: 'employee', zugeordneteIds: [] }), [A]);
  assert.deepEqual(sichtbareStandorte([A, B, C], { rolle: 'employee', fehler: true, zugeordneteIds: ['b'] }), [A]);
  assert.deepEqual(sichtbareStandorte([B, C], { rolle: 'employee', zugeordneteIds: [] }), []);
});

test('Zuordnung auf fremden Standort zählt nicht', () => {
  assert.deepEqual(sichtbareStandorte([A, B], { rolle: 'employee', zugeordneteIds: ['x'] }), [A]);
});

test('standorteFuerNutzer liest Zuordnungen nur für Mitarbeiter', async () => {
  let gelesen = 0;
  const sb = { from: () => ({ select: () => ({ eq: async () => { gelesen++; return { data: [{ business_id: 'c' }], error: null }; } }) }) };
  assert.deepEqual(await standorteFuerNutzer(sb, 'u', 'owner', [A, B, C]), [A, B, C]);
  assert.equal(gelesen, 0);
  assert.deepEqual(await standorteFuerNutzer(sb, 'u', 'employee', [A, B, C]), [C]);
  assert.equal(gelesen, 1);
  const kaputt = { from: () => ({ select: () => ({ eq: async () => ({ data: null, error: { message: 'x' } }) }) }) };
  const warn = console.warn; console.warn = () => {};
  try { assert.deepEqual(await standorteFuerNutzer(kaputt, 'u', 'employee', [A, B, C]), [A]); } finally { console.warn = warn; }
});
