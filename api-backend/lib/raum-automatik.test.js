import test from 'node:test';
import assert from 'node:assert/strict';
import { raumLeistungenFelder, raumBuchungsFehler, raumNameFuerBuchung } from './raum-automatik.js';
const id = '00000000-0000-4000-8000-000000000001';
test('API-Snapshot fehlt bei Altaufrufern; gültige IDs begrenzt und dedupliziert', () => {
  assert.deepEqual(raumLeistungenFelder(undefined), { ok: true, felder: {} });
  assert.deepEqual(raumLeistungenFelder([id, id]), { ok: true, felder: { raum_service_ids: [id] } });
  for (const input of [null, 'id', ['fremd'], Array(31).fill(id), [null]]) assert.equal(raumLeistungenFelder(input).ok, false);
});
test('Raumfehler wird verständlich gemeldet, sonst keine internen DB-Meldungen', () => {
  assert.match(raumBuchungsFehler({ code: 'P0001', message: 'Kein freier Raum mit der benötigten Ausstattung xyz' }), /Bitte Zeit/);
  assert.equal(raumBuchungsFehler({ code: 'P0001', message: 'interne Information' }), null);
});
test('Bestätigung liest nur zugeordneten Raumname im selben Mandanten und Standort', async () => {
  const calls = [];
  const query = { select: x => { calls.push(['select', x]); return query; }, eq: (k, v) => { calls.push(['eq', k, v]); return query; }, is: (k, v) => { calls.push(['is', k, v]); return query; }, maybeSingle: async () => ({ data: { name: 'Raum 1' }, error: null }) };
  const db = { from: name => { calls.push(['from', name]); return query; } };
  assert.equal(await raumNameFuerBuchung(db, { room_id: 'r', business_id: 'b' }, 'o'), 'Raum 1');
  assert.deepEqual(calls, [['from', 'rooms'], ['select', 'name'], ['eq', 'id', 'r'], ['eq', 'owner_id', 'o'], ['eq', 'business_id', 'b']]);
  calls.length = 0;
  await raumNameFuerBuchung(db, { room_id: 'r', business_id: null }, 'o');
  assert.deepEqual(calls.at(-1), ['is', 'business_id', null]);
  assert.equal(await raumNameFuerBuchung({ from() { throw Error('offline'); } }, { room_id: 'r' }, 'o'), null);
  assert.equal(await raumNameFuerBuchung(db, {}, 'o'), null);
});
