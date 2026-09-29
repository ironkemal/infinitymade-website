import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fehlendeArztangaben } from './arztangaben.js';

test('vollstaendig -> nichts fehlt', () => {
  assert.deepEqual(fehlendeArztangaben({ doctor_lanr: '123456601', unterschrift_vorhanden: true }), []);
});
test('LANR leer, null, Leerzeichen, Ersatzwert -> fehlt', () => {
  for (const l of ['', null, undefined, '  ', '999999999']) {
    const r = fehlendeArztangaben({ doctor_lanr: l, unterschrift_vorhanden: true });
    assert.equal(r.length, 1);
    assert.match(r[0], /LANR/);
  }
});
test('Unterschrift false/null -> fehlt', () => {
  for (const u of [false, null, undefined]) {
    const r = fehlendeArztangaben({ doctor_lanr: '123456601', unterschrift_vorhanden: u });
    assert.equal(r.length, 1);
    assert.match(r[0], /Unterschrift/);
  }
});
test('beides fehlt -> zwei Meldungen', () => {
  assert.equal(fehlendeArztangaben({}).length, 2);
  assert.equal(fehlendeArztangaben(null).length, 2);
});
