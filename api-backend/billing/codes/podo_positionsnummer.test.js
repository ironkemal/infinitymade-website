import { test } from 'node:test';
import assert from 'node:assert/strict';
import { podoPositionsnummer } from './podo_positionsnummer.js';
import { isValidPositionsnummer } from '../dta/preflight.js';

test('die HPNR ist die Positionsnummer — kein Abrechnungscode davor', () => {
  assert.equal(podoPositionsnummer('78020'), '78020');
  assert.equal(podoPositionsnummer('78040'), '78040');
});

test('das Ergebnis besteht die Preflight-Prüfung S:01002', () => {
  for (const h of ['78010', '78020', '78030', '78040', '79933']) {
    assert.equal(isValidPositionsnummer(podoPositionsnummer(h)), true, h);
  }
});

test('der frühere Zusammenbau "71"+HPNR war für den Preflight ungültig (Regression)', () => {
  assert.equal(isValidPositionsnummer('71' + '78020'), false);
});

test('eine Nicht-Positionsnummer wird laut abgelehnt statt stillschweigend gekürzt', () => {
  assert.throws(() => podoPositionsnummer('7178020'), /5-stellige/);
  assert.throws(() => podoPositionsnummer(''), /5-stellige/);
  assert.throws(() => podoPositionsnummer(null), /5-stellige/);
});
