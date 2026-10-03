import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createPodoEmpfangsnachweisRouter } from './podo-empfangsnachweis.routes.js';

describe('Podo Empfangsnachweis Routes (Integration via Express)', () => {
  let server;
  let baseUrl;

  const ownerId = '11111111-1111-4111-8111-111111111111';
  const employeeId = '22222222-2222-4222-8222-222222222222';
  const validTreatmentId = '33333333-3333-4333-8333-333333333333';

  let mockProfileRole = 'owner';
  let mockProfileOwnerId = null;
  let mockEmployeeOwnerId = ownerId;
  let mockTreatment = {
    id: validTreatmentId,
    owner_id: ownerId,
    behandlungsdatum: '2026-10-01',
    hpnr_codes: ['78040'],
    storniert_am: null,
    verordnung_id: '44444444-4444-4444-8444-444444444444',
  };
  let mockRpcResponse = {
    data: {
      id: '55555555-5555-4555-8555-555555555555',
      status: 'bestaetigt',
      behandlung_id: validTreatmentId,
      owner_id: ownerId,
      geprueft_von: ownerId,
      behandlungsdatum: '2026-10-01',
      hpnr_code: '78040',
      event_seq: 1,
    },
    error: null,
  };
  let mockExistingEvent = null;

  const fakeSupabase = {
    auth: {
      async getUser(token) {
        if (token === 'valid-owner-token') {
          return { data: { user: { id: ownerId } }, error: null };
        }
        if (token === 'valid-employee-token') {
          return { data: { user: { id: employeeId } }, error: null };
        }
        return { data: { user: null }, error: { message: 'Invalid token' } };
      },
    },
    from(table) {
      if (table === 'profiles') {
        return {
          select() { return this; },
          eq(col, val) {
            return {
              async maybeSingle() {
                if (val === ownerId) {
                  return { data: { id: ownerId, role: mockProfileRole, owner_id: mockProfileOwnerId }, error: null };
                }
                if (val === employeeId) {
                  return { data: { id: employeeId, role: 'employee', owner_id: mockEmployeeOwnerId }, error: null };
                }
                return { data: null, error: null };
              },
            };
          },
        };
      }
      if (table === 'podologie_behandlungen') {
        return {
          select() { return this; },
          eq(col, val) {
            this._filter = this._filter || {};
            this._filter[col] = val;
            return this;
          },
          async maybeSingle() {
            if (this._filter?.id === validTreatmentId && this._filter?.owner_id === ownerId) {
              return { data: mockTreatment, error: null };
            }
            return { data: null, error: null };
          },
        };
      }
      if (table === 'podologie_empfangsnachweise') {
        return {
          select() { return this; },
          eq() { return this; },
          order() { return this; },
          limit() { return this; },
          async maybeSingle() {
            return { data: mockExistingEvent, error: null };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
    async rpc(fn, args) {
      if (fn === 'podologie_empfangsnachweis_append') {
        if (typeof mockRpcResponse === 'function') {
          return mockRpcResponse(args);
        }
        return mockRpcResponse;
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    },
  };

  before(async () => {
    const app = express();
    app.use(express.json());
    const router = createPodoEmpfangsnachweisRouter({ supabase: fakeSupabase });
    app.use(router);

    await new Promise((resolve, reject) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
      server.on('error', reject);
    });
  });

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  test('401 wenn Authorization Header fehlt', async () => {
    const res = await fetch(`${baseUrl}/podologie/behandlungen/${validTreatmentId}/empfangsnachweis`);
    assert.equal(res.status, 401);
  });

  test('403 wenn Rolle ungültig ist (z.B. owner mit gesetztem owner_id)', async () => {
    mockProfileRole = 'owner';
    mockProfileOwnerId = 'some-other-id';
    const res = await fetch(`${baseUrl}/podologie/behandlungen/${validTreatmentId}/empfangsnachweis`, {
      headers: { Authorization: 'Bearer valid-owner-token' },
    });
    assert.equal(res.status, 403);
    mockProfileOwnerId = null;
  });

  test('403 wenn Employee versucht einen POST-Request abzusetzen (Owner write only)', async () => {
    const res = await fetch(`${baseUrl}/podologie/behandlungen/${validTreatmentId}/empfangsnachweis`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-employee-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'bestaetigt',
        therapeuteninitialen: 'TH',
      }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /Nur Praxisinhaber/);
  });

  test('200 wenn Employee einen GET-Request absetzt (Team read)', async () => {
    mockExistingEvent = null;
    const res = await fetch(`${baseUrl}/podologie/behandlungen/${validTreatmentId}/empfangsnachweis`, {
      headers: { Authorization: 'Bearer valid-employee-token' },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { nachweis: null });
  });

  test('400 bei ungültiger UUID in der URL', async () => {
    const res = await fetch(`${baseUrl}/podologie/behandlungen/not-a-uuid/empfangsnachweis`, {
      headers: { Authorization: 'Bearer valid-owner-token' },
    });
    assert.equal(res.status, 400);
  });

  test('404 Controlled Tenant Leakage: Behandlung gehört anderem Owner', async () => {
    const otherUuid = '99999999-9999-4999-8999-999999999999';
    const res = await fetch(`${baseUrl}/podologie/behandlungen/${otherUuid}/empfangsnachweis`, {
      headers: { Authorization: 'Bearer valid-owner-token' },
    });
    assert.equal(res.status, 404);
  });

  test('400 POST lehnt unbekannte oder Server-Felder (z.B. owner_id) ab', async () => {
    const res = await fetch(`${baseUrl}/podologie/behandlungen/${validTreatmentId}/empfangsnachweis`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-owner-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'bestaetigt',
        therapeuteninitialen: 'TH',
        owner_id: 'injected',
      }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /Unerlaubtes Feld/);
  });

  test('400 POST bestaetigt erfordert gültige Initialen (1..16 Zeichen)', async () => {
    const res = await fetch(`${baseUrl}/podologie/behandlungen/${validTreatmentId}/empfangsnachweis`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-owner-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'bestaetigt',
        therapeuteninitialen: '   ',
      }),
    });
    assert.equal(res.status, 400);
  });

  test('400 POST widerrufen erfordert Begründung', async () => {
    const res = await fetch(`${baseUrl}/podologie/behandlungen/${validTreatmentId}/empfangsnachweis`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-owner-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'widerrufen',
      }),
    });
    assert.equal(res.status, 400);
  });

  test('201 POST bestaetigt führt RPC aus und gibt { nachweis } zurück', async () => {
    mockRpcResponse = {
      data: {
        id: 'ev-new',
        status: 'bestaetigt',
        behandlung_id: validTreatmentId,
        owner_id: ownerId,
        geprueft_von: ownerId,
        behandlungsdatum: '2026-10-01',
        hpnr_code: '78040',
        event_seq: 1,
      },
      error: null,
    };

    const res = await fetch(`${baseUrl}/podologie/behandlungen/${validTreatmentId}/empfangsnachweis`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-owner-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'bestaetigt',
        therapeuteninitialen: 'MD',
        dokument_id: '9007199254740995',
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.nachweis.id, 'ev-new');
  });

  test('400 POST lehnt Array als Anforderungskörper ab', async () => {
    const res = await fetch(`${baseUrl}/podologie/behandlungen/${validTreatmentId}/empfangsnachweis`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-owner-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ status: 'bestaetigt' }]),
    });
    assert.equal(res.status, 400);
  });

  test('400 POST lehnt ungültige dokument_id (Booleans, Unsafe Integers, Overflow) ab', async () => {
    for (const badDocId of [true, false, [123], -5, 0, 1.5, 9007199254740992, '999999999999999999999999999999999999']) {
      const res = await fetch(`${baseUrl}/podologie/behandlungen/${validTreatmentId}/empfangsnachweis`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-owner-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'bestaetigt',
          therapeuteninitialen: 'MD',
          dokument_id: badDocId,
        }),
      });
      assert.equal(res.status, 400);
    }
  });

  test('403 Mitarbeiter mit owner_id === user.id (Self-Owner) wird abgewiesen', async () => {
    const res = await fetch(`${baseUrl}/podologie/behandlungen/${validTreatmentId}/empfangsnachweis`, {
      headers: { Authorization: 'Bearer valid-employee-token' },
    });
    assert.equal(res.status, 200);

    mockEmployeeOwnerId = employeeId;
    const resSelf = await fetch(`${baseUrl}/podologie/behandlungen/${validTreatmentId}/empfangsnachweis`, {
      headers: { Authorization: 'Bearer valid-employee-token' },
    });
    assert.equal(resSelf.status, 403);
    mockEmployeeOwnerId = ownerId;
  });

  test('201 POST normalisiert RPC-Array mit 1 Element und validiert Rückgabefelder', async () => {
    mockRpcResponse = {
      data: [{
        id: 'ev-array-1',
        status: 'bestaetigt',
        behandlung_id: validTreatmentId,
        owner_id: ownerId,
        geprueft_von: ownerId,
        behandlungsdatum: '2026-10-01',
        hpnr_code: '78040',
        event_seq: 2,
      }],
      error: null,
    };

    const res = await fetch(`${baseUrl}/podologie/behandlungen/${validTreatmentId}/empfangsnachweis`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-owner-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'bestaetigt',
        therapeuteninitialen: 'MD',
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.nachweis.id, 'ev-array-1');
  });

  test('500 POST lehnt leeres RPC-Array oder inkonsistenten Snapshot ab', async () => {
    mockRpcResponse = { data: [], error: null };
    const resEmpty = await fetch(`${baseUrl}/podologie/behandlungen/${validTreatmentId}/empfangsnachweis`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-owner-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'bestaetigt',
        therapeuteninitialen: 'MD',
      }),
    });
    assert.equal(resEmpty.status, 500);

    mockRpcResponse = {
      data: {
        id: 'ev-corrupt',
        status: 'bestaetigt',
        behandlung_id: validTreatmentId,
        owner_id: ownerId,
        geprueft_von: 'wrong-user',
        behandlungsdatum: '2026-10-01',
        hpnr_code: '78040',
        event_seq: 1,
      },
      error: null,
    };
    const resCorrupt = await fetch(`${baseUrl}/podologie/behandlungen/${validTreatmentId}/empfangsnachweis`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-owner-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'bestaetigt',
        therapeuteninitialen: 'MD',
      }),
    });
    assert.equal(resCorrupt.status, 500);
  });
});
