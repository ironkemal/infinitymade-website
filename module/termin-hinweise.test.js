import { test } from 'node:test';
import assert from 'node:assert/strict';
import { terminHinweise, terminHinweiseHtml } from './termin-hinweise.js';

const keys = (b) => terminHinweise(b).map(h => h.key);

test('Hausbesuch, Kassenleistung ohne VO', () => {
  assert.deepEqual(keys({ hausbesuch: true, services: { code: '78010' } }), ['hausbesuch', 'ohne-vo']);
});

test('Privat/Selbstzahler oder nicht-Kassen-Leistung: kein „Ohne VO"', () => {
  assert.deepEqual(keys({ services: { code: '78010' }, rezeptart: 'privat' }), []);
  assert.deepEqual(keys({ services: { code: 'FUSS-W' } }), []);
  assert.deepEqual(keys({ services: { code: '78010' }, verordnung_id: 'v1' }), []);
});

test('Zuzahlung offen nur bei geladener, nicht befreiter, nicht kassierter VO', () => {
  const mit = (rx) => ({ services: { code: '20501' }, prescription_sessions: [{ prescriptions: rx }] });
  assert.deepEqual(keys(mit({})), ['zuzahlung']);
  assert.deepEqual(keys(mit({ zuzahlung_befreit: true })), []);
  assert.deepEqual(keys(mit({ zuzahlung_kassiert_am: '2026-10-01' })), []);
});

test('HTML maskiert und ist ohne Hinweis leer', () => {
  assert.equal(terminHinweiseHtml({}), '');
  assert.match(terminHinweiseHtml({ hausbesuch: true }), /termin-hinweis--hausbesuch/);
});

test('Podologie: Positionsnummer in gkv_position_nr, Kürzel als Code → „Ohne VO" (canli-test 21.10.2026)', () => {
  assert.deepEqual(keys({ services: { code: 'pod. Beh. kl.', gkv_position_nr: '78010' } }), ['ohne-vo']);
});
