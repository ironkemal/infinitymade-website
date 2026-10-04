import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { kontoLoeschen, bereinigeStorage } from './loeschen.js';
import { TABELLEN } from './klassifikation.js';

function buildSupabaseMock({
  freezeResult = { data: true, error: null },
  freezeThrows = false,
  registryPages = [],
  registryThrows = false,
  storageListImpl = null,
  storageRemoveImpl = null,
} = {}) {
  const calls = {
    rpc: [],
    from: [],
    rangeCalls: [],
    deletes: [],
    storageList: [],
    storageRemove: [],
    stripeReads: [],
  };

  let regPageIndex = 0;

  const client = {
    rpc: async (fn, args) => {
      calls.rpc.push({ fn, args });
      if (freezeThrows) {
        throw new Error('Simulated RPC network exception');
      }
      if (typeof freezeResult === 'function') {
        return freezeResult(fn, args);
      }
      return freezeResult;
    },
    from: (table) => {
      calls.from.push(table);
      const builder = {
        _table: table,
        _filters: {},
        select: function (cols, opts) {
          this._select = { cols, opts };
          return this;
        },
        eq: function (col, val) {
          this._filters[col] = val;
          return this;
        },
        order: function () { return this; },
        not: function (col, op, val) {
          this._not = { col, op, val };
          return this;
        },
        range: async function (from, to) {
          calls.rangeCalls.push({ table, from, to, filters: { ...this._filters } });
          if (table === 'abrechnung_artefakt_version') {
            if (registryThrows) {
              throw new Error('Simulated registry DB query failure');
            }
            const page = registryPages[regPageIndex++] || { data: [], error: null, count: 0 };
            return page;
          }
          return { data: [], error: null, count: 0 };
        },
        delete: function () {
          return {
            eq: async (col, val) => {
              calls.deletes.push({ table, col, val });
              return { data: null, error: null };
            },
          };
        },
        maybeSingle: async function () {
          if (table === 'profiles') {
            calls.stripeReads.push({ filters: { ...this._filters } });
            return { data: { stripe_subscription_id: null, stripe_customer_id: null }, error: null };
          }
          return { data: null, error: null };
        },
        single: async function () {
          if (table === 'profiles') {
            calls.stripeReads.push({ filters: { ...this._filters } });
            return { data: { stripe_subscription_id: null, stripe_customer_id: null }, error: null };
          }
          return { data: null, error: null };
        },
        then: function (resolve) {
          if (table === 'profiles') {
            calls.stripeReads.push({ filters: { ...this._filters } });
            resolve({ data: { stripe_subscription_id: null, stripe_customer_id: null }, error: null });
          } else {
            resolve({ data: [], error: null });
          }
        },
      };
      return builder;
    },
    storage: {
      from: (bucket) => ({
        list: async (prefix, opts) => {
          calls.storageList.push({ bucket, prefix, opts });
          if (storageListImpl) return storageListImpl(bucket, prefix, opts);
          return { data: [], error: null };
        },
        remove: async (paths) => {
          calls.storageRemove.push({ bucket, paths });
          if (storageRemoveImpl) return storageRemoveImpl(bucket, paths);
          return { data: null, error: null };
        },
      }),
    },
  };

  return { client, calls };
}

describe('DSGVO K4 Artefakt-Schutz', () => {
  describe('Freeze RPC pre-condition', () => {
    it('aborts without destructive calls when freeze RPC returns error', async () => {
      const ownerId = 'own-freeze-err';
      const { client, calls } = buildSupabaseMock({
        freezeResult: { data: null, error: { message: 'db error' } },
      });

      const res = await kontoLoeschen(client, { ownerId, ownerEmail: 'test@example.com' });
      assert.equal(res.status, 'fehler');
      assert.deepEqual(res.gesperrt, []);
      assert.deepEqual(res.unerwartet, ['artefakt:owner_freeze']);
      assert.equal(calls.deletes.length, 0);
      assert.equal(calls.storageRemove.length, 0);
      assert.equal(calls.stripeReads.length, 0);
      assert.equal(calls.rpc.length, 1);
      assert.equal(calls.rpc[0].fn, 'artefakt_owner_freeze');
      assert.deepEqual(calls.rpc[0].args, { p_owner: ownerId });
    });

    it('aborts without destructive calls when freeze RPC returns false', async () => {
      const ownerId = 'own-freeze-false';
      const { client, calls } = buildSupabaseMock({
        freezeResult: { data: false, error: null },
      });

      const res = await kontoLoeschen(client, { ownerId, ownerEmail: 'test@example.com' });
      assert.equal(res.status, 'fehler');
      assert.deepEqual(res.unerwartet, ['artefakt:owner_freeze']);
      assert.equal(calls.deletes.length, 0);
      assert.equal(calls.storageRemove.length, 0);
    });

    it('aborts without destructive calls when freeze RPC returns null', async () => {
      const ownerId = 'own-freeze-null';
      const { client, calls } = buildSupabaseMock({
        freezeResult: { data: null, error: null },
      });

      const res = await kontoLoeschen(client, { ownerId, ownerEmail: 'test@example.com' });
      assert.equal(res.status, 'fehler');
      assert.deepEqual(res.unerwartet, ['artefakt:owner_freeze']);
      assert.equal(calls.deletes.length, 0);
      assert.equal(calls.storageRemove.length, 0);
    });

    it('aborts without destructive calls when freeze RPC throws exception', async () => {
      const ownerId = 'own-freeze-throw';
      const { client, calls } = buildSupabaseMock({
        freezeThrows: true,
      });

      const res = await kontoLoeschen(client, { ownerId, ownerEmail: 'test@example.com' });
      assert.equal(res.status, 'fehler');
      assert.deepEqual(res.unerwartet, ['artefakt:owner_freeze']);
      assert.equal(calls.deletes.length, 0);
      assert.equal(calls.storageRemove.length, 0);
    });
  });

  describe('Registry preflight validation', () => {
    it('aborts when registry query fails after freeze', async () => {
      const ownerId = 'own-reg-err';
      const { client, calls } = buildSupabaseMock({
        registryPages: [{ data: null, error: { message: 'query failed' }, count: null }],
      });

      const res = await kontoLoeschen(client, { ownerId, ownerEmail: 'test@example.com' });
      assert.equal(res.status, 'fehler');
      assert.deepEqual(res.unerwartet, ['artefakt:registry_check']);
      assert.equal(calls.deletes.length, 0);
      assert.equal(calls.storageRemove.length, 0);
      assert.equal(calls.stripeReads.length, 0);
    });

    it('aborts when registry query throws exception', async () => {
      const ownerId = 'own-reg-throw';
      const { client, calls } = buildSupabaseMock({
        registryThrows: true,
      });

      const res = await kontoLoeschen(client, { ownerId, ownerEmail: 'test@example.com' });
      assert.equal(res.status, 'fehler');
      assert.deepEqual(res.unerwartet, ['artefakt:registry_check']);
      assert.equal(calls.deletes.length, 0);
      assert.equal(calls.storageRemove.length, 0);
    });

    it('aborts when registry row contains malformed state', async () => {
      const ownerId = 'own-reg-state';
      const { client, calls } = buildSupabaseMock({
        registryPages: [{
          data: [{ storage_path: `${ownerId}/art.dta`, state: 'unknown_state' }],
          error: null,
          count: 1,
        }],
      });

      const res = await kontoLoeschen(client, { ownerId, ownerEmail: 'test@example.com' });
      assert.equal(res.status, 'fehler');
      assert.deepEqual(res.unerwartet, ['artefakt:registry_check']);
      assert.equal(calls.deletes.length, 0);
      assert.equal(calls.storageRemove.length, 0);
    });

    it('aborts when registry storage_path is not prefixed with ownerId/', async () => {
      const ownerId = 'own-reg-path';
      const { client, calls } = buildSupabaseMock({
        registryPages: [{
          data: [{ storage_path: 'other-owner/art.dta', state: 'published' }],
          error: null,
          count: 1,
        }],
      });

      const res = await kontoLoeschen(client, { ownerId, ownerEmail: 'test@example.com' });
      assert.equal(res.status, 'fehler');
      assert.deepEqual(res.unerwartet, ['artefakt:registry_check']);
      assert.equal(calls.deletes.length, 0);
      assert.equal(calls.storageRemove.length, 0);
    });

    it('aborts when registry count is inconsistent across pages', async () => {
      const ownerId = 'own-reg-unstable';
      const { client, calls } = buildSupabaseMock({
        registryPages: [
          {
            data: [{ storage_path: `${ownerId}/1.dta`, state: 'reserved' }],
            error: null,
            count: 2,
          },
          {
            data: [{ storage_path: `${ownerId}/2.dta`, state: 'published' }],
            error: null,
            count: 3,
          },
        ],
      });

      const res = await kontoLoeschen(client, { ownerId, ownerEmail: 'test@example.com' });
      assert.equal(res.status, 'fehler');
      assert.deepEqual(res.unerwartet, ['artefakt:registry_check']);
      assert.equal(calls.deletes.length, 0);
      assert.equal(calls.storageRemove.length, 0);
    });

    it('aborts when registry fetched count does not equal exact count (truncated)', async () => {
      const ownerId = 'own-reg-trunc';
      const { client, calls } = buildSupabaseMock({
        registryPages: [{
          data: [{ storage_path: `${ownerId}/1.dta`, state: 'published' }],
          error: null,
          count: 2,
        }],
      });

      const res = await kontoLoeschen(client, { ownerId, ownerEmail: 'test@example.com' });
      assert.equal(res.status, 'fehler');
      assert.deepEqual(res.unerwartet, ['artefakt:registry_check']);
      assert.equal(calls.deletes.length, 0);
      assert.equal(calls.storageRemove.length, 0);
    });
  });

  describe('Registry pagination & owner filter', () => {
    it('paginates 1001 paths including reserved and signed with owner filter', async () => {
      const ownerId = 'own-paginate';
      const states = ['reserved', 'published', 'retire_pending', 'retired'];
      const page1 = Array.from({ length: 1000 }, (_, i) => ({
        storage_path: `${ownerId}/art_${i}.dta`,
        state: states[i % states.length],
      }));
      const page2 = [
        { storage_path: `${ownerId}/art_1000_signed.dta`, state: 'reserved' },
      ];
      const { client, calls } = buildSupabaseMock({
        registryPages: [
          { data: page1, error: null, count: 1001 },
          { data: page2, error: null, count: 1001 },
        ],
      });

      await kontoLoeschen(client, { ownerId, ownerEmail: 'p@test.de' });

      assert.equal(calls.rangeCalls.length, 2);
      assert.deepEqual(calls.rangeCalls[0], {
        table: 'abrechnung_artefakt_version',
        from: 0,
        to: 999,
        filters: { owner_id: ownerId },
      });
      assert.deepEqual(calls.rangeCalls[1], {
        table: 'abrechnung_artefakt_version',
        from: 1000,
        to: 1999,
        filters: { owner_id: ownerId },
      });
      assert.equal(calls.rpc[0].fn, 'artefakt_owner_freeze');
      assert.deepEqual(calls.rpc[0].args, { p_owner: ownerId });
      assert.equal(calls.deletes.filter((d) => d.table === 'abrechnung_artefakt_version').length, 0);
    });
  });

  describe('Storage cleanup boundaries', () => {
    it('direct bereinigeStorage keeps abrechnungen without list/remove while other buckets clean up', async () => {
      const ownerId = 'own-storage-test';
      const unerwartet = [];
      const log = [];
      const protectedPaths = new Set([`${ownerId}/active_1.dta`, `${ownerId}/active_2.dta`]);

      let abrechnungenListCalled = false;
      let abrechnungenRemoveCalled = false;

      const { client, calls } = buildSupabaseMock({
        storageListImpl: (bucket) => {
          if (bucket === 'abrechnungen') {
            abrechnungenListCalled = true;
            throw new Error('abrechnungen bucket list must NOT be called');
          }
          if (bucket === 'avatars') {
            return { data: [{ name: 'avatar.png', id: '1' }], error: null };
          }
          return { data: [], error: null };
        },
        storageRemoveImpl: (bucket) => {
          if (bucket === 'abrechnungen') {
            abrechnungenRemoveCalled = true;
            throw new Error('abrechnungen bucket remove must NOT be called');
          }
          return { data: null, error: null };
        },
      });

      await bereinigeStorage(client, ownerId, unerwartet, log, protectedPaths);

      assert.equal(abrechnungenListCalled, false, 'abrechnungen bucket list must NOT be called');
      assert.equal(abrechnungenRemoveCalled, false, 'abrechnungen bucket remove must NOT be called');

      const abLog = log.find((l) => l.step === 'storage:abrechnungen');
      assert.ok(abLog, 'storage:abrechnungen log entry exists');
      assert.equal(abLog.ok, true);
      assert.equal(abLog.geloescht, 0);
      assert.equal(abLog.retainedCount, 2);
      assert.equal(abLog.nonRetiredCount, 2);
      assert.equal(abLog.policy, 'unknown_historical_retained');

      const otherBucketLists = calls.storageList.filter((s) => s.bucket !== 'abrechnungen');
      assert.ok(otherBucketLists.length > 0, 'other buckets had storage list called');
    });
  });

  describe('Registry metadata classification', () => {
    it('TABELLEN contains abrechnung_artefakt_version with correct metadata and no invented categories', () => {
      const entry = TABELLEN.find((t) => t.table === 'abrechnung_artefakt_version');
      assert.ok(entry, 'entry for abrechnung_artefakt_version exists in TABELLEN');
      assert.equal(entry.kategorie, 'artefakt_lebenszyklus');
      assert.equal(entry.export?.filter, 'owner_id');
      assert.notEqual(entry.kategorie, 'beleg');
      assert.notEqual(entry.kategorie, 'blanket8year');
      assert.match(entry.anmerkung, /unsigned/i);
      assert.match(entry.anmerkung, /signed/i);
      assert.match(entry.anmerkung, /encrypted/i);
      assert.match(entry.anmerkung, /keine pauschale 8-Jahre-Frist|retention|lebenszyklus/i);
    });
  });

  describe('End-to-end positive account workflow', () => {
    it('executes freeze before any delete/storage without real auth', async () => {
      const ownerId = 'own-positive-test';
      const { client, calls } = buildSupabaseMock({
        freezeResult: { data: true, error: null },
        registryPages: [{
          data: [
            { storage_path: `${ownerId}/sample.dta`, state: 'published' },
          ],
          error: null,
          count: 1,
        }],
      });

      await kontoLoeschen(client, {
        ownerId,
        ownerEmail: 'praxis@example.com',
        vorgangId: 'v-pos-1',
        stripeKey: null,
      });

      assert.equal(calls.rpc.length, 1);
      assert.equal(calls.rpc[0].fn, 'artefakt_owner_freeze');
      assert.deepEqual(calls.rpc[0].args, { p_owner: ownerId });

      assert.ok(calls.rangeCalls.some((r) => r.table === 'abrechnung_artefakt_version'));
      assert.equal(calls.storageList.filter((s) => s.bucket === 'abrechnungen').length, 0);
      assert.equal(calls.storageRemove.filter((s) => s.bucket === 'abrechnungen').length, 0);
      assert.equal(calls.deletes.filter((d) => d.table === 'abrechnung_artefakt_version').length, 0);
    });
  });
});
