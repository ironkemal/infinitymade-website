import { test } from 'node:test';
import assert from 'node:assert/strict';
import { holeFahrzeitBeimSpeichern } from './hausbesuch-route.js';

test('Speichern löst die Berechnung aus und wartet auf die Fahrzeit', async () => {
  const lead = { duration_min: null };
  const btn = { disabled: false, click() { setTimeout(() => { lead.duration_min = 12; }, 30); } };
  const ok = await holeFahrzeitBeimSpeichern(lead, { doc: { getElementById: () => btn }, maxMs: 500, schritt: 10 });
  assert.equal(ok, true);
});

test('ohne Ergebnis nach maxMs: false, schon vorhanden: true ohne Klick', async () => {
  let klicks = 0;
  const btn = { disabled: false, click() { klicks++; } };
  assert.equal(await holeFahrzeitBeimSpeichern({ duration_min: null }, { doc: { getElementById: () => btn }, maxMs: 50, schritt: 10 }), false);
  assert.equal(await holeFahrzeitBeimSpeichern({ duration_min: 7 }, { doc: { getElementById: () => btn } }), true);
  assert.equal(klicks, 1);
});
