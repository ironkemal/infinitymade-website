import assert from 'node:assert/strict';
import test from 'node:test';
import { bereitschaftsFehler } from './verordnung-bereitschaft.js';

test('Chrome1911 schützt manuelle Bereitschaft bei fehlender Kasse und kritischen Prüfpunkten', async () => {
  assert.match(await bereitschaftsFehler(null, {}), /Karten-IK/);
  const query = { select() { return this; }, eq() { return this; }, order() { return { data: [] }; } };
  const result = await bereitschaftsFehler({ from: () => query }, { krankenkasse_ik: '123456789', kostentraeger_ik: '123456789', therapie_bereich: 'physio' });
  assert.match(result, /Verordnung korrigieren/);
});
