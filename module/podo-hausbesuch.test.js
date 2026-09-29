import test from 'node:test';
import assert from 'node:assert/strict';
import { hausbesuchGesperrt, gesperrteHausbesuchKodes, hausbesuchSpeicherFehler } from './podo-hausbesuch.js';

test('Ja: nichts gesperrt', () => {
  assert.equal(hausbesuchGesperrt({ hausbesuch: true }, '79933'), false);
  assert.equal(hausbesuchSpeicherFehler({ hausbesuch: true }, ['78010', '79933']), '');
});
test('Nein/leer: 79933 und 79934 gesperrt, andere Kodes nicht', () => {
  for (const v of [{ hausbesuch: false }, { hausbesuch: null }, {}, null]) {
    assert.equal(hausbesuchGesperrt(v, '79933'), true);
    assert.equal(hausbesuchGesperrt(v, '79934'), true);
    assert.equal(hausbesuchGesperrt(v, '78010'), false);
  }
});
test('Speicherfehler nennt die Kodes', () => {
  assert.deepEqual(gesperrteHausbesuchKodes({ hausbesuch: false }, ['78010', '79934']), ['79934']);
  assert.match(hausbesuchSpeicherFehler({ hausbesuch: false }, ['79933']), /79933/);
});
