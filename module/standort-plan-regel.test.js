import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { standorteFuerTag, istAmStandort } from './standort-plan-regel.js';

const V = JSON.parse(fs.readFileSync(new URL('./standort-plan-vektoren.json', import.meta.url), 'utf8'));

for (const f of V.faelle) {
  test('Vektor: ' + f.name, () => {
    const zeilen = 'zeilen' in f ? f.zeilen : V.zeilen;
    assert.deepEqual(standorteFuerTag(zeilen, f.employee, f.datum, V.alle), f.erwartet);
    for (const s of V.alle) {
      assert.equal(istAmStandort(zeilen, f.employee, f.datum, s, V.alle), f.erwartet.includes(s), s);
    }
  });
}

test('alleStandortIds kein Array -> []', () => {
  assert.deepEqual(standorteFuerTag(null, 'e1', '2026-11-02', undefined), []);
});

test('Rueckgabe ist Kopie, Eingabe bleibt unveraendert', () => {
  const alle = ['A'];
  const r = standorteFuerTag(null, 'e1', '2026-11-02', alle);
  r.push('X');
  assert.deepEqual(alle, ['A']);
});
