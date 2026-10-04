import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateHoneypot,
  checkHoneypot,
  getCanonicalOwnerId,
  validateOwnerProfile,
  validateTherapist,
  validateService,
  validateLead,
  validatePatient
} from './public-guards.js';

function createMockSupabase(fixtures = {}, errors = {}) {
  const queries = [];
  return {
    queries,
    from(table) {
      return {
        select(cols) {
          return {
            eq(col, val) {
              return {
                async maybeSingle() {
                  queries.push({ table, cols, col, val });
                  if (errors[table]) return { data: null, error: errors[table] };
                  const rows = fixtures[table] || [];
                  const found = rows.find(r => r[col] === val) || null;
                  return { data: found, error: null };
                }
              };
            }
          };
        }
      };
    }
  };
}

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

describe('Honeypot Guards', () => {
  it('handles legacy undefined, null, empty and whitespace', () => {
    for (const val of [undefined, null, '', '   ', '\t\n']) {
      assert.deepEqual(validateHoneypot(val), { ok: true, trapped: false });
    }
  });

  it('marks filled string as neutral trapped', () => {
    assert.deepEqual(validateHoneypot('https://spam.bot'), { ok: true, trapped: true });
    assert.deepEqual(validateHoneypot('  bot  '), { ok: true, trapped: true });
  });

  it('rejects invalid number, boolean, array, object with 400', () => {
    for (const val of [123, true, false, [], {}, () => {}]) {
      assert.deepEqual(validateHoneypot(val), { ok: false, status: 400, error: 'Ungültige Anfrage' });
    }
  });

  it('checkHoneypot routes trapped, invalid and clean requests', () => {
    const resTrapped = mockRes();
    assert.equal(checkHoneypot({ body: { website: 'bot.com' } }, resTrapped), true);
    assert.equal(resTrapped.statusCode, 200);
    assert.deepEqual(resTrapped.body, { success: true });

    const resInvalid = mockRes();
    assert.equal(checkHoneypot({ body: { website: 999 } }, resInvalid), true);
    assert.equal(resInvalid.statusCode, 400);
    assert.deepEqual(resInvalid.body, { error: 'Ungültige Anfrage' });

    const resClean = mockRes();
    assert.equal(checkHoneypot({ body: { website: '' } }, resClean), false);
    assert.equal(resClean.statusCode, null);
    assert.equal(checkHoneypot(null, resClean), false);
  });
});

describe('getCanonicalOwnerId', () => {
  it('gives owner_id priority even when user_id is different and falls back to null', () => {
    assert.equal(getCanonicalOwnerId(null), null);
    assert.equal(getCanonicalOwnerId('invalid'), null);
    assert.equal(getCanonicalOwnerId({}), null);
    assert.equal(getCanonicalOwnerId({ owner_id: 'own_1', user_id: 'usr_2' }), 'own_1');
    assert.equal(getCanonicalOwnerId({ user_id: 'usr_2' }), 'usr_2');
  });
});

describe('validateOwnerProfile', () => {
  it('requires role=owner, owner_id=null, is_active=true and checks DB errors', async () => {
    const fixtures = {
      profiles: [
        { id: 'p_valid', role: 'owner', owner_id: null, is_active: true },
        { id: 'p_staff', role: 'therapist', owner_id: null, is_active: true },
        { id: 'p_child', role: 'owner', owner_id: 'p_parent', is_active: true },
        { id: 'p_inactive', role: 'owner', owner_id: null, is_active: false }
      ]
    };
    const sb = createMockSupabase(fixtures);

    assert.deepEqual(await validateOwnerProfile(sb, null), { ok: false, status: 400, error: 'Ungültige Praxis' });
    assert.deepEqual(await validateOwnerProfile(sb, 'missing'), { ok: false, status: 400, error: 'Ungültige Praxis' });
    assert.deepEqual(await validateOwnerProfile(sb, 'p_staff'), { ok: false, status: 400, error: 'Ungültige Praxis' });
    assert.deepEqual(await validateOwnerProfile(sb, 'p_child'), { ok: false, status: 400, error: 'Ungültige Praxis' });
    assert.deepEqual(await validateOwnerProfile(sb, 'p_inactive'), { ok: false, status: 400, error: 'Ungültige Praxis' });

    const okRes = await validateOwnerProfile(sb, 'p_valid');
    assert.equal(okRes.ok, true);
    assert.equal(okRes.profile.id, 'p_valid');

    const lastQ = sb.queries.at(-1);
    assert.equal(lastQ.table, 'profiles');
    assert.ok(!lastQ.cols.includes('profiles.active'), 'must not select profiles.active');

    const errSb = createMockSupabase({}, { profiles: { message: 'db error' } });
    assert.deepEqual(await validateOwnerProfile(errSb, 'p_valid'), { ok: false, status: 500, error: 'Interner Serverfehler' });
  });
});

describe('validateTherapist', () => {
  it('rejects foreign, missing, inactive therapists and accepts valid tenant matches', async () => {
    const fixtures = {
      profiles: [
        { id: 't_self_owner', owner_id: null, is_active: true },
        { id: 't_staff', owner_id: 'own_1', is_active: true },
        { id: 't_foreign', owner_id: 'other_own', is_active: true },
        { id: 't_inactive', owner_id: 'own_1', is_active: false }
      ]
    };
    const sb = createMockSupabase(fixtures);

    assert.deepEqual(await validateTherapist(sb, null, 'own_1'), { ok: false, status: 400, error: 'Ungültiger Therapeut' });
    assert.deepEqual(await validateTherapist(sb, 'missing', 'own_1'), { ok: false, status: 400, error: 'Therapeut nicht verfügbar' });
    assert.deepEqual(await validateTherapist(sb, 't_inactive', 'own_1'), { ok: false, status: 400, error: 'Therapeut nicht verfügbar' });
    assert.deepEqual(await validateTherapist(sb, 't_foreign', 'own_1'), { ok: false, status: 400, error: 'Ungültiger Therapeut' });

    assert.equal((await validateTherapist(sb, 't_self_owner', 't_self_owner')).ok, true);
    assert.equal((await validateTherapist(sb, 't_staff', 'own_1')).ok, true);

    const errSb = createMockSupabase({}, { profiles: { message: 'db error' } });
    assert.deepEqual(await validateTherapist(errSb, 't_staff', 'own_1'), { ok: false, status: 500, error: 'Interner Serverfehler' });
  });
});

describe('validateService', () => {
  it('rejects internal services, owner mismatches, DB errors and asserts selects', async () => {
    const fixtures = {
      services: [
        { id: 's_ok', owner_id: 'own_1', is_internal: false },
        { id: 's_internal', owner_id: 'own_1', is_internal: true },
        { id: 's_no_owner', is_internal: false }
      ]
    };
    const sb = createMockSupabase(fixtures);

    assert.deepEqual(await validateService(sb, null), { ok: false, status: 400, error: 'Service not found' });
    assert.deepEqual(await validateService(sb, 'missing'), { ok: false, status: 400, error: 'Service nicht verfügbar' });
    assert.deepEqual(await validateService(sb, 's_internal'), { ok: false, status: 400, error: 'Service nicht verfügbar' });
    assert.deepEqual(await validateService(sb, 's_no_owner'), { ok: false, status: 400, error: 'Service not found' });
    assert.deepEqual(await validateService(sb, 's_ok', 'other_own'), { ok: false, status: 400, error: 'Service not found' });

    const okRes = await validateService(sb, 's_ok', 'own_1');
    assert.equal(okRes.ok, true);
    assert.equal(okRes.canonicalOwnerId, 'own_1');

    const lastQ = sb.queries.at(-1);
    assert.equal(lastQ.table, 'services');
    assert.ok(!lastQ.cols.includes('is_active'), 'no nonexistent services.is_active');

    const errSb = createMockSupabase({}, { services: { message: 'db error' } });
    assert.deepEqual(await validateService(errSb, 's_ok'), { ok: false, status: 500, error: 'Interner Serverfehler' });
  });
});

describe('validateLead & validatePatient', () => {
  it('validates optional presence, tenant matching and DB errors', async () => {
    const fixtures = {
      leads: [{ id: 'lead_1', owner_id: 'own_1' }],
      patients: [{ id: 'pat_1', owner_id: 'own_1' }]
    };
    const sb = createMockSupabase(fixtures);

    assert.deepEqual(await validateLead(sb, null, 'own_1'), { ok: true });
    assert.deepEqual(await validateLead(sb, 'missing', 'own_1'), { ok: false, status: 400, error: 'Ungültiger Lead' });
    assert.deepEqual(await validateLead(sb, 'lead_1', 'other_own'), { ok: false, status: 400, error: 'Ungültiger Lead' });
    const leadRes = await validateLead(sb, 'lead_1', 'own_1');
    assert.equal(leadRes.ok, true);
    assert.equal(leadRes.lead.id, 'lead_1');

    assert.deepEqual(await validatePatient(sb, null, 'own_1'), { ok: true });
    assert.deepEqual(await validatePatient(sb, 'missing', 'own_1'), { ok: false, status: 400, error: 'Ungültiger Patient' });
    assert.deepEqual(await validatePatient(sb, 'pat_1', 'other_own'), { ok: false, status: 400, error: 'Ungültiger Patient' });
    const patRes = await validatePatient(sb, 'pat_1', 'own_1');
    assert.equal(patRes.ok, true);
    assert.equal(patRes.patient.id, 'pat_1');

    const errSb = createMockSupabase({}, { leads: { message: 'err' }, patients: { message: 'err' } });
    assert.deepEqual(await validateLead(errSb, 'lead_1', 'own_1'), { ok: false, status: 500, error: 'Interner Serverfehler' });
    assert.deepEqual(await validatePatient(errSb, 'pat_1', 'own_1'), { ok: false, status: 500, error: 'Interner Serverfehler' });
  });
});
