import test from 'node:test';
import assert from 'node:assert/strict';
import { raumDetails } from './raum-details.js';

test('Raumdetails bereinigen Beschreibung und vorhandene Ausstattung', () => {
  assert.deepEqual(raumDetails('  Licht und Ruhe  ', ['  Liege ', 'Waschbecken']), { beschreibung: 'Licht und Ruhe', ausstattung: ['Liege', 'Waschbecken'] });
  assert.deepEqual(raumDetails(), { beschreibung: '', ausstattung: [] });
});
test('Raumdetails weisen unbrauchbare und überlange Inhalte ab', () => {
  for (const [text, liste] of [['x'.repeat(2001), []], ['', [' ']], ['', ['Liege', ' Liege']], ['', [null]], ['', ['x'.repeat(81)]], ['', Array.from({ length: 31 }, (_, i) => String(i))], ['', 'Liege']]) {
    assert.throws(() => raumDetails(text, liste));
  }
  assert.equal(raumDetails('😀'.repeat(2000), ['😀'.repeat(80)]).ausstattung.length, 1);
});
