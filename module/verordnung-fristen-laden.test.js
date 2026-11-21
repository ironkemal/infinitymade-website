import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ladeOffeneVerordnungenPaginiert,
  RX_FRISTEN_SELECT_KPI,
  RX_FRISTEN_SELECT_VOLL,
} from './verordnung-fristen-laden.js';

function baueMockSupabase(alleZeilen, { fehlerAbSeite = null } = {}) {
  const aufrufe = [];
  let seitenZaehler = 0;
  return {
    aufrufe,
    from(tabelle) {
      const state = { tabelle, select: null, filters: [], gtId: null, limit: null, orFilter: null };
      const q = {
        select(s) { state.select = s; return q; },
        eq(k, v) { state.filters.push(['eq', k, v]); return q; },
        not(k, op, v) { state.filters.push(['not', k, op, v]); return q; },
        or(expr) { state.orFilter = expr; return q; },
        order() { return q; },
        gt(k, v) { if (k === 'id') state.gtId = v; return q; },
        limit(n) { state.limit = n; return q; },
        then(resolve, reject) {
          seitenZaehler += 1;
          aufrufe.push({ ...state });
          if (fehlerAbSeite === seitenZaehler) {
            return Promise.resolve({ data: null, error: { message: 'db down' } }).then(resolve, reject);
          }
          const gefiltert = alleZeilen
            .filter(r => (state.gtId === null ? true : r.id > state.gtId))
            .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
            .slice(0, state.limit || 200);
          return Promise.resolve({ data: gefiltert, error: null }).then(resolve, reject);
        },
      };
      return q;
    },
  };
}

test('ladeOffeneVerordnungenPaginiert: liest mehr als 200 Zeilen über mehrere Seiten und filtert cancelled', async () => {
  const zeilen = Array.from({ length: 245 }, (_, i) => ({
    id: `rx-${String(i + 1).padStart(4, '0')}`,
    status: 'confirmed',
  }));
  const sb = baueMockSupabase(zeilen);
  let bizScopeAktiv = false;
  const res = await ladeOffeneVerordnungenPaginiert(sb, {
    ownerId: 'owner-1',
    select: RX_FRISTEN_SELECT_VOLL,
    bizScope: (q, cat) => {
      assert.equal(cat, 'patients');
      bizScopeAktiv = true;
      return q.or('business_id.eq.b1,business_id.is.null');
    },
    seitenGroesse: 100,
  });

  assert.equal(res.error, null);
  assert.equal(res.data.length, 245);
  assert.equal(bizScopeAktiv, true);
  assert.equal(sb.aufrufe.length, 3);
  assert.deepEqual(
    sb.aufrufe[0].filters.find(f => f[0] === 'not'),
    ['not', 'status', 'in', '(completed,billed,cancelled)']
  );
  assert.equal(sb.aufrufe[0].gtId, null);
  assert.equal(sb.aufrufe[1].gtId, 'rx-0100');
  assert.equal(sb.aufrufe[2].gtId, 'rx-0200');
});

test('ladeOffeneVerordnungenPaginiert: leere Praxis und Fehlerfall werden sauber zurückgegeben', async () => {
  const leer = await ladeOffeneVerordnungenPaginiert(baueMockSupabase([]), {
    ownerId: 'owner-1',
    select: RX_FRISTEN_SELECT_KPI,
  });
  assert.equal(leer.error, null);
  assert.deepEqual(leer.data, []);

  const zeilen = Array.from({ length: 12 }, (_, i) => ({ id: `rx-${String(i + 1).padStart(3, '0')}` }));
  const errRes = await ladeOffeneVerordnungenPaginiert(baueMockSupabase(zeilen, { fehlerAbSeite: 2 }), {
    ownerId: 'owner-1',
    seitenGroesse: 5,
  });
  assert.ok(errRes.error);
  assert.equal(errRes.data.length, 5);
});
