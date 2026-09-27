// Regression für Ops #302 (QA-Nachtrag, 27.09.2026): die Patientensuche im
// Muster-13-Kopf lieferte zweimal in Folge 0 Treffer, weil ein Refresh-Aufruf
// des Suchfelds VOR der Cache-Zuweisung des Aufrufers lag — der Closure sah
// noch die alte (leere) Liste. Der zweite Rutscher (beim Verschieben der
// Ladelogik hierher) blieb bei `node --test` unsichtbar, weil kein Test die
// Reihenfolge prüfte. Dieser hier tut das über einen klaren Vertrag:
// `ladePatientenCache()` darf das Suchfeld NICHT selbst anstoßen — das ist
// Sache des Aufrufers, NACHDEM er den Cache zugewiesen hat.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ladePatientenCache } from './rezept-patientenfeld.js';

function fakeQuery(rows) {
  const q = {
    select: () => q,
    eq: () => q,
    order: () => Promise.resolve({ data: rows, error: null }),
  };
  return q;
}

test('ladePatientenCache: kein eigener Zugriff auf #rzPatientSearch', async () => {
  let getElementByIdCalls = [];
  globalThis.document = {
    getElementById: (id) => { getElementByIdCalls.push(id); return null; },
  };
  const rows = [{ id: 'p1', last_name: 'Demir' }, { id: 'p2', last_name: 'Ranauro' }];
  const supabase = { from: () => fakeQuery(rows) };
  const bizScope = (query) => query;
  const getOwnerId = () => 'owner-1';

  const result = await ladePatientenCache({ supabase, bizScope, getOwnerId });

  assert.deepEqual(result.leads, rows, 'liefert die Rohdaten unverändert');
  assert.equal(result.ownerId, 'owner-1');
  assert.ok(
    !getElementByIdCalls.includes('rzPatientSearch'),
    'ladePatientenCache darf das Suchfeld nicht selbst lesen/anstoßen — ' +
    'sonst liest `_patientSearchApi.refresh()` den Cache, BEVOR der ' +
    'Aufrufer ihn zugewiesen hat (genau der Bug, zweimal reingerutscht).'
  );
});

test('ladePatientenCache: Fehlerfall liefert leere Liste, kein Throw', async () => {
  globalThis.document = { getElementById: () => null };
  const supabase = { from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: null, error: new Error('boom') }) }) }) }) };
  const bizScope = (query) => query;
  const getOwnerId = () => 'owner-1';

  const result = await ladePatientenCache({ supabase, bizScope, getOwnerId });

  assert.deepEqual(result.leads, []);
  assert.equal(result.ownerId, null);
});
