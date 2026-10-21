import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pauseLage, pauseMeldung } from './podo-unterbrechung.js';

test('84 Tage nach der letzten Behandlung noch gültig, 85 ungültig', () => {
  const behs = [{ behandlungsdatum: '2026-01-05' }];
  assert.equal(pauseLage(behs, '2026-03-30').ungueltig, false);
  const r = pauseLage(behs, '2026-03-31');
  assert.deepEqual(r, { ungueltig: true, letzteAm: '2026-01-05', tage: 85 });
  assert.match(pauseMeldung(r), /05\.01\.2026.*85 Tage.*§ 7 Abs\. 7/);
});

test('stornierte und spätere Behandlungen zählen nicht, ohne Vorgänger keine Sperre', () => {
  const behs = [{ behandlungsdatum: '2026-01-05' }, { behandlungsdatum: '2026-03-01', storniert_am: '2026-03-02' }, { behandlungsdatum: '2026-06-01' }];
  assert.equal(pauseLage(behs, '2026-04-30').ungueltig, true);    // 05.01. zählt, 01.03. storniert
  assert.equal(pauseLage([], '2026-04-30').ungueltig, false);
  assert.equal(pauseLage([{ behandlungsdatum: '2026-06-01' }], '2026-04-30').ungueltig, false);   // Nachtrag davor
});
