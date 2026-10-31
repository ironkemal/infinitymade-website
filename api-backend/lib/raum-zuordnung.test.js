import test from 'node:test';
import assert from 'node:assert/strict';
import { raumFelderFuerTermin } from './raum-zuordnung.js';

function falsch(ergebnis) {
  const filter = [];
  const kette = {
    select: () => kette,
    eq: (spalte, wert) => { filter.push([spalte, wert]); return kette; },
    maybeSingle: async () => ergebnis,
  };
  return { from: tabelle => { filter.push(['tabelle', tabelle]); return kette; }, filter };
}

test('Ohne Raum bleibt der Termin unverändert, kein Datenbankzugriff', async () => {
  const db = falsch({ data: null, error: null });
  assert.deepEqual(await raumFelderFuerTermin(db, null, 'O'), { ok: true, felder: {} });
  assert.equal(db.filter.length, 0);
});

test('Raum mit Standort liefert beide Felder und filtert nach Mandant', async () => {
  const db = falsch({ data: { id: 'R', business_id: 'B' }, error: null });
  assert.deepEqual(await raumFelderFuerTermin(db, 'R', 'O'), { ok: true, felder: { room_id: 'R', business_id: 'B' } });
  assert.deepEqual(db.filter, [['tabelle', 'rooms'], ['id', 'R'], ['owner_id', 'O']]);
});

test('Raum ohne Standort setzt keinen Standort', async () => {
  const db = falsch({ data: { id: 'R', business_id: null }, error: null });
  assert.deepEqual((await raumFelderFuerTermin(db, 'R', 'O')).felder, { room_id: 'R' });
});

test('Fremder oder fehlender Raum wird abgewiesen', async () => {
  assert.deepEqual(await raumFelderFuerTermin(falsch({ data: null, error: null }), 'R', 'O'), { ok: false });
  assert.deepEqual(await raumFelderFuerTermin(falsch({ data: null, error: { code: '42P01' } }), 'R', 'O'), { ok: false });
});
