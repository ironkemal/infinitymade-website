// lib/modulrecht.js: Modulrecht 'abrechnung' im Backend (guvenlik S-65 + Rechnung per Mail). Nur Logik, keine Datenbank.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-key';
const { hatAbrechnungsRecht } = await import('./modulrecht.js');
const { praxenFuerPruefung } = await import('../billing/api/verordnung-status.routes.js');

const owner = { userId: 'o1', role: 'owner' }; const emp = { userId: 'e1', role: 'employee' };
/** @param {string} module */
const mit = (module, has_access = true) => async () => ({ data: [{ module, has_access }, { module: 'calendar', has_access: true }], error: null });

test('Inhaber immer, ohne Rechteabfrage; fremder Inhaber nicht', async () => {
  let n = 0;
  assert.equal(await hatAbrechnungsRecht({ auth: owner, ownerId: 'o1', businessIds: [], token: null, rpc: async () => { n += 1; return { data: [], error: null }; } }), true);
  assert.equal(n, 0);
  assert.equal(await hatAbrechnungsRecht({ auth: owner, ownerId: 'o2', businessIds: ['b'], token: 't', rpc: mit('abrechnung') }), false);
});

test('Mitarbeiter: Recht für mindestens eine Praxis genügt; sonst fail closed', async () => {
  /** @type {(t: string, b: string) => Promise<{ data: Array<{ module: string, has_access: boolean }> | null, error: unknown }>} */
  const rpc = async (_t, b) => (b === 'b2' ? { data: [{ module: 'abrechnung', has_access: true }], error: null } : { data: [{ module: 'abrechnung', has_access: false }], error: null });
  assert.equal(await hatAbrechnungsRecht({ auth: emp, ownerId: 'o1', businessIds: ['b1', 'b2'], token: 't', rpc }), true, 'zweite Praxis berechtigt');
  assert.equal(await hatAbrechnungsRecht({ auth: emp, ownerId: 'o1', businessIds: ['b1'], token: 't', rpc }), false, 'ausdrücklich verweigert');
  assert.equal(await hatAbrechnungsRecht({ auth: emp, ownerId: 'o1', businessIds: ['b1'], token: 't', rpc: mit('calendar') }), false, 'anderes Modul');
  assert.equal(await hatAbrechnungsRecht({ auth: emp, ownerId: 'o1', businessIds: [], token: 't', rpc: mit('abrechnung') }), false, 'keine Praxis');
  assert.equal(await hatAbrechnungsRecht({ auth: emp, ownerId: 'o1', businessIds: ['b1'], token: null, rpc: mit('abrechnung') }), false, 'ohne Token');
  assert.equal(await hatAbrechnungsRecht({ auth: emp, ownerId: 'o1', businessIds: ['b1'], token: 't', rpc: async () => ({ data: null, error: { code: 'x' } }) }), false, 'Abfragefehler');
  assert.equal(await hatAbrechnungsRecht({ auth: emp, ownerId: 'o1', businessIds: ['b1'], token: 't', rpc: async () => { throw new Error('netz'); } }), false, 'Ausnahme');
  assert.equal(await hatAbrechnungsRecht({ auth: undefined, ownerId: 'o1', businessIds: ['b1'], token: 't', rpc: mit('abrechnung') }), false, 'ohne Auth');
});

test('Abrechnungsstatus: Praxen für die Prüfung — Praxis der Verordnung, sonst eigene Zuordnungen beim Inhaber, Fehler → leer', async () => {
  /**
   * @param {unknown[]} zuo
   * @param {unknown[]} praxen
   * @returns {import('@supabase/supabase-js').SupabaseClient}
   */
  const fake = (zuo, praxen, wirf = false) => /** @type {import('@supabase/supabase-js').SupabaseClient} */ (/** @type {unknown} */ ({
    /** @param {string} t */
    from(t) {
      const b = { select() { return b; }, eq() { return b; }, in() { return b; },
        /** @param {(v: any) => any} ok @param {(e: any) => any} no */
        then(ok, no) { if (wirf) return Promise.reject(new Error('db')).then(ok, no); return Promise.resolve({ data: t === 'employee_business_assignments' ? zuo : praxen }).then(ok, no); } };
      return b;
    },
  }));
  assert.deepEqual(await praxenFuerPruefung(fake([], []), { userId: 'e1', ownerId: 'o1', businessId: 'b9' }), ['b9'], 'Praxis der Verordnung hat Vorrang');
  assert.deepEqual(await praxenFuerPruefung(fake([{ business_id: 'b1' }, { business_id: 'bX' }], [{ id: 'b1' }]), { userId: 'e1', ownerId: 'o1', businessId: null }), ['b1'], 'nur Praxen des Inhabers');
  assert.deepEqual(await praxenFuerPruefung(fake([], []), { userId: 'e1', ownerId: 'o1', businessId: null }), [], 'ohne Zuordnung');
  assert.deepEqual(await praxenFuerPruefung(fake([], [], true), { userId: 'e1', ownerId: 'o1', businessId: null }), [], 'Fehler → leer');
});
