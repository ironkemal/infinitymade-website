import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ladeNaechsteTermineJePatient } from './naechste-termine.js';

// V9.14: Sammel-Lader „nächster Termin je Patient“ — Filter, Blöcke à 100, erster Termin je Patient, Fehler.
function sbAufzeichnung(antworten) {
  const aufrufe = [];
  return {
    aufrufe,
    from: (t) => {
      const q = { t, f: [] }; aufrufe.push(q);
      const kette = {
        select: () => kette, order: () => kette, limit: () => kette,
        eq: (k, v) => { q.f.push(['eq', k, v]); return kette; },
        gte: (k, v) => { q.f.push(['gte', k, v]); return kette; },
        in: (k, v) => { q.f.push(['in', k, v]); return kette; },
        then: (ok) => ok(antworten.shift() || { data: [], error: null }),
      };
      return kette;
    },
  };
}

test('erster Termin je Patient, Statusregel, nur eigener Owner', async () => {
  const sb = sbAufzeichnung([{ data: [
    { lead_id: 'A', start_time: '2026-11-20T08:00:00Z' },
    { lead_id: 'A', start_time: '2026-11-21T08:00:00Z' },
    { lead_id: 'B', start_time: '2026-11-22T08:00:00Z' },
  ], error: null }]);
  const { naechste, error } = await ladeNaechsteTermineJePatient(sb, { ownerId: 'O', leadIds: ['A', 'B', 'A', null] });
  assert.equal(error, null);
  assert.equal(naechste.get('A'), '2026-11-20T08:00:00Z');
  assert.equal(naechste.get('B'), '2026-11-22T08:00:00Z');
  const f = sb.aufrufe[0].f;
  assert.deepEqual(f.find(x => x[1] === 'owner_id'), ['eq', 'owner_id', 'O']);
  assert.deepEqual(f.find(x => x[1] === 'status'), ['in', 'status', ['confirmed', 'pending']]);
  assert.deepEqual(f.find(x => x[1] === 'lead_id')[2], ['A', 'B']);
});

test('250 Patienten = 3 Abrufe; ohne Owner oder IDs kein Abruf; Fehler wird gemeldet', async () => {
  const sb = sbAufzeichnung([]);
  await ladeNaechsteTermineJePatient(sb, { ownerId: 'O', leadIds: Array.from({ length: 250 }, (_, i) => 'L' + i) });
  assert.equal(sb.aufrufe.length, 3);
  const leer = sbAufzeichnung([]);
  await ladeNaechsteTermineJePatient(leer, { ownerId: '', leadIds: ['A'] });
  await ladeNaechsteTermineJePatient(leer, { ownerId: 'O', leadIds: [] });
  assert.equal(leer.aufrufe.length, 0);
  const kaputt = sbAufzeichnung([{ data: null, error: { message: 'x' } }]);
  const r = await ladeNaechsteTermineJePatient(kaputt, { ownerId: 'O', leadIds: ['A'] });
  assert.ok(r.error);
  assert.equal(r.naechste.size, 0);
});
