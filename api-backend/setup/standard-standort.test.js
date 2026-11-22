// O-251: Box-Einrichtung legt den ersten Standort an — vier Fälle gegen eine Attrappe,
// kein Netz, keine echten Daten.
import test from 'node:test';
import assert from 'node:assert/strict';
import { legeStandardStandortAn } from './standard-standort.js';

/** @param {{ vorhanden?: any, leseFehler?: any, insertFehler?: any, wirft?: boolean }} o */
function attrappe(o = {}) {
  /** @type {any[]} */
  const eingefuegt = [];
  const sb = {
    from(/** @type {string} */ tabelle) {
      assert.equal(tabelle, 'businesses');
      if (o.wirft) throw new Error('Netz weg');
      const kette = {
        select: () => kette,
        eq: () => kette,
        maybeSingle: async () => ({ data: o.vorhanden ?? null, error: o.leseFehler ?? null }),
        insert: async (/** @type {any} */ zeile) => { eingefuegt.push(zeile); return { error: o.insertFehler ?? null }; },
      };
      return kette;
    },
  };
  return { sb, eingefuegt };
}

const angaben = { ownerId: 'owner-1', businessName: 'Praxis Muster', sector: 'physiotherapy' };

test('frische Box: Standard-Standort wird mit is_default angelegt', async () => {
  const { sb, eingefuegt } = attrappe();
  assert.deepEqual(await legeStandardStandortAn(sb, angaben), { status: 'angelegt' });
  assert.deepEqual(eingefuegt, [{ owner_id: 'owner-1', business_name: 'Praxis Muster', sector: 'physiotherapy', is_default: true }]);
});

test('schon vorhanden: kein zweiter Insert', async () => {
  const { sb, eingefuegt } = attrappe({ vorhanden: { id: 'biz-1' } });
  assert.deepEqual(await legeStandardStandortAn(sb, angaben), { status: 'vorhanden' });
  assert.equal(eingefuegt.length, 0);
});

test('Wettlauf mit uniq_businesses_default_per_owner (23505) gilt als vorhanden', async () => {
  const { sb } = attrappe({ insertFehler: { code: '23505', message: 'duplicate key' } });
  assert.deepEqual(await legeStandardStandortAn(sb, angaben), { status: 'vorhanden' });
});

test('andere Fehler werfen nicht, sondern melden — die Einrichtung läuft weiter', async () => {
  assert.equal((await legeStandardStandortAn(attrappe({ insertFehler: { code: '42501', message: 'rls' } }).sb, angaben)).status, 'fehler');
  assert.equal((await legeStandardStandortAn(attrappe({ leseFehler: { message: 'timeout' } }).sb, angaben)).status, 'fehler');
  assert.deepEqual(await legeStandardStandortAn(attrappe({ wirft: true }).sb, angaben), { status: 'fehler', fehler: 'Netz weg' });
});
