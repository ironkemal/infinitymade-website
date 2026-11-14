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

/**
 * @typedef {{
 *   table: string,
 *   selected: string | null,
 *   eqField: string | null,
 *   eqValue: string | null,
 *   range: [number, number] | null,
 *   isSingle: boolean,
 *   order: [string, boolean | undefined] | null
 * }} MockCall
 * @typedef {import('@supabase/supabase-js').SupabaseClient & { calls: MockCall[] }} MockSupabaseClient
 */

/**
 * @param {unknown} err
 * @returns {Error & { code?: string, status?: number }}
 */
function asDictError(err) {
  return /** @type {Error & { code?: string, status?: number }} */ (err);
}

/**
 * @param {{
 *   leads?: Array<Record<string, unknown>>,
 *   profiles?: Array<Record<string, unknown>>,
 *   ownerProfile?: Record<string, unknown> | null,
 *   aerzte?: Array<Record<string, unknown>>,
 *   failTable?: string | null
 * }} [options={}]
 * @returns {MockSupabaseClient}
 */
function createMockSupabase({ leads = [], profiles = [], ownerProfile = null, aerzte = [], failTable = null } = {}) {
  /** @type {MockCall[]} */
  const calls = [];

  const mock = {
    calls,
    /** @param {string} table */
    from(table) {
      /** @type {MockCall} */
      const call = { table, selected: null, eqField: null, eqValue: null, range: null, isSingle: false, order: null };
      calls.push(call);

      const builder = {
        /** @param {string} cols */
        select(cols) {
          call.selected = cols;
          return builder;
        },
        /**
         * @param {string} field
         * @param {string} val
         */
        eq(field, val) {
          call.eqField = field;
          call.eqValue = val;
          return builder;
        },
        /**
         * @param {string} column
         * @param {{ ascending?: boolean }} [options]
         */
        order(column, options) {
          call.order = [column, options?.ascending];
          return builder;
        },
        /**
         * @param {number} from
         * @param {number} to
         */
        range(from, to) {
          call.range = [from, to];
          return builder;
        },
        single() {
          call.isSingle = true;
          return builder;
        },
        /** @param {(res: { data: unknown, error: unknown }) => unknown} resolve */
        then(resolve) {
          if (failTable === table) {
            return resolve({ data: null, error: { message: `Simulated error on ${table}` } });
          }
          const [from, to] = call.range || [0, 499];
          if (table === 'leads') {
            return resolve({ data: leads.slice(from, to + 1), error: null });
          }
          if (table === 'profiles') {
            if (call.isSingle) {
              return resolve({ data: ownerProfile, error: null });
            }
            return resolve({ data: profiles.slice(from, to + 1), error: null });
          }
          if (table === 'aerzte') {
            return resolve({ data: aerzte.slice(from, to + 1), error: null });
          }
          return resolve({ data: [], error: null });
        }
      };
      return builder;
    }
  };
  return /** @type {MockSupabaseClient} */ (/** @type {unknown} */ (mock));
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
  assert.ok(leadsCall);
  assert.equal(leadsCall.selected, 'first_name, last_name, title');
  assert.equal(leadsCall.eqField, 'owner_id');
  assert.equal(leadsCall.eqValue, VALID_TENANT_ID);

  const ownerCall = mockDb.calls.find(c => c.table === 'profiles' && c.isSingle);
  assert.ok(ownerCall);
  assert.equal(ownerCall.selected, 'owner_first_name, owner_last_name');
  assert.equal(ownerCall.eqField, 'id');
  assert.equal(ownerCall.eqValue, VALID_TENANT_ID);

  const empCall = mockDb.calls.find(c => c.table === 'profiles' && !c.isSingle);
  assert.ok(empCall);
  assert.equal(empCall.selected, 'owner_first_name, owner_last_name');
  assert.equal(empCall.eqField, 'owner_id');
  assert.equal(empCall.eqValue, VALID_TENANT_ID);

  const docCall = mockDb.calls.find(c => c.table === 'aerzte');
  assert.ok(docCall);
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
    (rawErr) => {
      const err = asDictError(rawErr);
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
    (rawErr) => {
      const err = asDictError(rawErr);
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
    (rawErr) => {
      const err = asDictError(rawErr);
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
    (rawErr) => {
      const err = asDictError(rawErr);
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

test('every paged query has a fixed order so no name is skipped between pages', async () => {
  const leads = Array.from({ length: 501 }, (_, index) => ({ first_name: `Synthetic${index}`, last_name: `Family${index}` }));
  const db = createMockSupabase({ leads, ownerProfile: { owner_first_name: 'Owner' } });
  await loadTenantDictionary(db, VALID_AUTH);
  const paged = db.calls.filter(call => call.range !== null);
  assert.ok(paged.length >= 4);
  for (const call of paged) assert.deepEqual(call.order, ['id', true], `unsortierte Seite: ${call.table}`);
});
