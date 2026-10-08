// Tests for ki-woerterbuch.js (M4.1 / M4.3 / K4 safety).
//   node api-backend/ai/ki-woerterbuch.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTenantDictionary } from './ki-woerterbuch.js';

const VALID_TENANT_ID = '33333333-3333-4333-8333-333333333333';
const VALID_AUTH = {
  role: 'owner',
  userId: VALID_TENANT_ID,
  tenantId: VALID_TENANT_ID
};

function createMockSupabase({ leads = [], profiles = [], ownerProfile = null, aerzte = [], failTable = null } = {}) {
  const calls = [];

  return {
    calls,
    from(table) {
      const call = { table, selected: null, eqField: null, eqValue: null, range: null, isSingle: false };
      calls.push(call);

      const builder = {
        select(cols) {
          call.selected = cols;
          return builder;
        },
        eq(field, val) {
          call.eqField = field;
          call.eqValue = val;
          return builder;
        },
        range(from, to) {
          call.range = [from, to];
          return builder;
        },
        single() {
          call.isSingle = true;
          return builder;
        },
        then(resolve) {
          if (failTable === table) {
            return resolve({ data: null, error: { message: `Simulated error on ${table}` } });
          }
          if (table === 'leads') {
            return resolve({ data: leads.slice(call.range[0], call.range[1] + 1), error: null });
          }
          if (table === 'profiles') {
            if (call.isSingle) {
              return resolve({ data: ownerProfile, error: null });
            }
            return resolve({ data: profiles.slice(call.range[0], call.range[1] + 1), error: null });
          }
          if (table === 'aerzte') {
            return resolve({ data: aerzte.slice(call.range[0], call.range[1] + 1), error: null });
          }
          return resolve({ data: [], error: null });
        }
      };
      return builder;
    }
  };
}

test('asserts exact minimal columns and strict tenant filters', async () => {
  const mockDb = createMockSupabase({
    leads: [{ first_name: 'Max', last_name: 'Mustermann', title: 'Prof.' }],
    ownerProfile: { owner_first_name: 'Erika', owner_last_name: 'Praxisinhaber' },
    profiles: [{ owner_first_name: 'Hans', owner_last_name: 'Therapeut' }],
    aerzte: [{ arzt_name: 'Dr. Kroll', praxis_name: 'Orthopädie Siegburg' }]
  });

  const dict = await loadTenantDictionary(mockDb, VALID_AUTH);

  // Assert queries made
  const leadsCall = mockDb.calls.find(c => c.table === 'leads');
  assert.equal(leadsCall.selected, 'first_name, last_name, title');
  assert.equal(leadsCall.eqField, 'owner_id');
  assert.equal(leadsCall.eqValue, VALID_TENANT_ID);

  const ownerCall = mockDb.calls.find(c => c.table === 'profiles' && c.isSingle);
  assert.equal(ownerCall.selected, 'owner_first_name, owner_last_name');
  assert.equal(ownerCall.eqField, 'id');
  assert.equal(ownerCall.eqValue, VALID_TENANT_ID);

  const empCall = mockDb.calls.find(c => c.table === 'profiles' && !c.isSingle);
  assert.equal(empCall.selected, 'owner_first_name, owner_last_name');
  assert.equal(empCall.eqField, 'owner_id');
  assert.equal(empCall.eqValue, VALID_TENANT_ID);

  const docCall = mockDb.calls.find(c => c.table === 'aerzte');
  assert.equal(docCall.selected, 'arzt_name, praxis_name');
  assert.equal(docCall.eqField, 'owner_id');
  assert.equal(docCall.eqValue, VALID_TENANT_ID);

  // Assert dictionary terms parsed
  assert.ok(dict.includes('Mustermann'));
  assert.ok(dict.includes('Erika'));
  assert.ok(dict.includes('Kroll'));
  assert.ok(dict.includes('Orthopädie'));
});

test('fails closed on DB error without falling back to empty array and safe constant message', async () => {
  const mockDb = createMockSupabase({ failTable: 'leads' });

  await assert.rejects(
    async () => loadTenantDictionary(mockDb, VALID_AUTH),
    (err) => {
      assert.equal(err.code, 'KI_WOERTERBUCH_FEHLER');
      assert.equal(err.status, 503);
      assert.equal(err.message, 'Wörterbuchabfrage fehlgeschlagen');
      return true;
    }
  );
});

test('blocks when owner profile is missing', async () => {
  const mockDb = createMockSupabase({
    leads: [],
    ownerProfile: null,
    profiles: [],
    aerzte: []
  });

  await assert.rejects(
    async () => loadTenantDictionary(mockDb, VALID_AUTH),
    (err) => {
      assert.equal(err.code, 'KI_WOERTERBUCH_FEHLER');
      assert.equal(err.status, 503);
      assert.equal(err.message, 'Inhaberprofil fehlt; unvollständiges Wörterbuch blockiert');
      return true;
    }
  );
});

test('rejects invalid role with 403', async () => {
  const mockDb = createMockSupabase();
  const badAuth = { role: 'guest', userId: VALID_TENANT_ID, tenantId: VALID_TENANT_ID };

  await assert.rejects(
    async () => loadTenantDictionary(mockDb, badAuth),
    (err) => {
      assert.equal(err.code, 'KI_AUTH_REQUIRED');
      assert.equal(err.status, 403);
      return true;
    }
  );
});

test('blocks when result count hits limit indicating incomplete dictionary', async () => {
  // Array of 1000 items triggers finite bounds check
  const hugeLeads = Array.from({ length: 20_000 }, (_, i) => ({ first_name: `Patient${i}`, last_name: 'Test' }));
  const mockDb = createMockSupabase({ leads: hugeLeads });

  await assert.rejects(
    async () => loadTenantDictionary(mockDb, VALID_AUTH),
    (err) => {
      assert.equal(err.code, 'KI_WOERTERBUCH_FEHLER');
      assert.equal(err.status, 503);
      assert.equal(err.code, 'KI_WOERTERBUCH_FEHLER');
      return true;
    }
  );
});


test('pagination includes names beyond first 1000 without losing tenant filters', async () => {
  const leads = Array.from({ length: 1201 }, (_, index) => ({ first_name: `Synthetic${index}`, last_name: `Family${index}` }));
  const db = createMockSupabase({ leads, ownerProfile: { owner_first_name: 'Owner' } });
  const dictionary = await loadTenantDictionary(db, VALID_AUTH);
  assert.ok(dictionary.includes('Family1200'));
  const pages = db.calls.filter(call => call.table === 'leads');
  assert.deepEqual(pages.map(page => page.range), [[0, 499], [500, 999], [1000, 1499]]);
  for (const page of pages) { assert.equal(page.eqField, 'owner_id'); assert.equal(page.eqValue, VALID_TENANT_ID); assert.equal(page.selected, 'first_name, last_name, title'); }
});
