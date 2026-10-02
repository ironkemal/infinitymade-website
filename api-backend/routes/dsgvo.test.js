import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
// ai/auth.js baut beim Laden einen Supabase-Client — ohne URL wirft supabase-js.
// Dummy-Werte, kein Netz: alle Aufrufe gehen an den Mock unten.
process.env.SUPABASE_URL ||= 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-dummy';
const { createDsgvoRouter } = await import('./dsgvo.js');
const { antworttextFallB, kontoLoeschen } = await import('../dsgvo/loeschen.js');

/**
 * Startet einen temporaeren Express-Server auf einem freien Port fuer isolierte Route-Tests.
 */
async function withServer(router, fn) {
  const app = express();
  app.use(express.json());
  app.use(router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

/**
 * Erzeugt einen flexiblen Mock-Supabase-Client fuer DSGVO-Tests.
 */
function createMockSupabase(handlers = {}) {
  const calls = {
    deleteUser: 0,
    updateUserById: 0,
    rpcCalls: [],
    insertedLogs: [],
  };

  const client = {
    calls,
    auth: {
      admin: {
        getUserById: async (id) => ({
          data: { user: { id, email: `owner-${id}@praxis-test.de` } },
          error: null,
        }),
        updateUserById: async (id, payload) => {
          calls.updateUserById++;
          return { data: { id, ...payload }, error: null };
        },
        deleteUser: async (_id) => {
          calls.deleteUser++;
          throw new Error('deleteUser darf NIE aufgerufen werden!');
        },
      },
    },
    rpc: async (fnName, params) => {
      calls.rpcCalls.push({ fnName, params });
      return { data: null, error: null };
    },
    storage: {
      from: (_bucket) => ({
        list: async () => ({ data: [], error: null }),
        remove: async () => ({ data: [], error: null }),
      }),
    },
    from: (tableName) => {
      let selectedCols = '*';
      const filters = [];

      const query = {
        select: (cols) => {
          selectedCols = cols;
          return query;
        },
        eq: (col, val) => {
          filters.push({ type: 'eq', col, val });
          return query;
        },
        not: (col, op, val) => {
          filters.push({ type: 'not', col, op, val });
          return query;
        },
        in: (col, vals) => {
          filters.push({ type: 'in', col, vals });
          return query;
        },
        gte: (col, val) => {
          filters.push({ type: 'gte', col, val });
          return query;
        },
        limit: (_n) => query,
        order: () => query,
        range: async () => {
          if (handlers[tableName]?.select) {
            const res = await handlers[tableName].select(filters);
            return { data: res, error: null };
          }
          return { data: [], error: null };
        },
        maybeSingle: async () => {
          if (handlers[tableName]?.maybeSingle) {
            return handlers[tableName].maybeSingle(filters);
          }
          return { data: null, error: null };
        },
        single: async () => {
          if (handlers[tableName]?.single) {
            return handlers[tableName].single(filters);
          }
          return { data: null, error: null };
        },
        update: (payload) => ({
          eq: async (col, val) => {
            if (handlers[tableName]?.update) {
              return handlers[tableName].update(payload, { col, val });
            }
            return { data: null, error: null };
          },
        }),
        delete: () => ({
          eq: async (col, val) => {
            if (handlers[tableName]?.delete) {
              return handlers[tableName].delete({ col, val });
            }
            return { data: null, error: null };
          },
          in: async (col, vals) => {
            if (handlers[tableName]?.delete) {
              return handlers[tableName].delete({ col, vals });
            }
            return { data: null, error: null };
          },
        }),
        insert: async (rows) => {
          if (tableName === 'data_access_log') {
            calls.insertedLogs.push(rows);
          }
          if (handlers[tableName]?.insert) {
            return handlers[tableName].insert(rows);
          }
          return { data: rows, error: null };
        },
        then: (resolve) => {
          if (handlers[tableName]?.select) {
            Promise.resolve(handlers[tableName].select(filters)).then((res) => {
              resolve({ data: res, error: null });
            });
          } else {
            resolve({ data: [], error: null });
          }
        },
      };

      return query;
    },
  };

  return client;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Route-Tests fuer POST /dsgvo/loeschen
// ─────────────────────────────────────────────────────────────────────────────

test('DSGVO Route: 404 in der Box (istKutu = true)', async () => {
  const router = createDsgvoRouter({
    istKutu: () => true,
    requireAuth: (req, _res, next) => {
      req.auth = { userId: 'usr-1', tenantId: 'usr-1', role: 'owner' };
      next();
    },
    skipRateLimit: true,
  });

  await withServer(router, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/dsgvo/loeschen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'LÖSCHEN' }),
    });

    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, 'Not found');
  });
});

test('DSGVO Route: 403 fuer Mitarbeiter (role != owner)', async () => {
  const router = createDsgvoRouter({
    istKutu: () => false,
    requireAuth: (req, _res, next) => {
      req.auth = { userId: 'emp-1', tenantId: 'usr-1', role: 'employee' };
      next();
    },
    skipRateLimit: true,
  });

  await withServer(router, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/dsgvo/loeschen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'LÖSCHEN' }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /Praxisinhaber/);
  });
});

test('DSGVO Route: 400 wenn confirm nicht "LÖSCHEN" lautet', async () => {
  const router = createDsgvoRouter({
    istKutu: () => false,
    requireAuth: (req, _res, next) => {
      req.auth = { userId: 'usr-1', tenantId: 'usr-1', role: 'owner' };
      next();
    },
    skipRateLimit: true,
  });

  await withServer(router, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/dsgvo/loeschen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'ja bitte' }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'Bestätigung fehlt');
  });
});

test('DSGVO Route: 429 bei bereits laufendem Loeschantrag (Doppelantrag-Sperre)', async () => {
  const mockSupabase = createMockSupabase({
    data_access_log: {
      select: (filters) => {
        const isDeletionCheck = filters.some((f) => f.val === 'dsgvo_deletion');
        if (isDeletionCheck) {
          return [{ id: 'existing-log-1', action: 'dsgvo_deletion' }];
        }
        return [];
      },
    },
  });

  const router = createDsgvoRouter({
    istKutu: () => false,
    supabase: mockSupabase,
    requireAuth: (req, _res, next) => {
      req.auth = { userId: 'usr-1', tenantId: 'usr-1', role: 'owner' };
      next();
    },
    skipRateLimit: true,
  });

  await withServer(router, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/dsgvo/loeschen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'LÖSCHEN' }),
    });

    assert.equal(res.status, 429);
    const body = await res.json();
    assert.match(body.error, /bereits im Löschprozess/);
  });
});

test('DSGVO Route: 409 wenn vor der Loeschung kein Export innerhalb 24h vorliegt', async () => {
  const mockSupabase = createMockSupabase({
    data_access_log: {
      select: (_filters) => {
        // Kein Export-Log vorhanden
        return [];
      },
    },
  });

  const router = createDsgvoRouter({
    istKutu: () => false,
    supabase: mockSupabase,
    requireAuth: (req, _res, next) => {
      req.auth = { userId: 'usr-1', tenantId: 'usr-1', role: 'owner' };
      next();
    },
    skipRateLimit: true,
  });

  await withServer(router, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/dsgvo/loeschen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'LÖSCHEN' }),
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.code, 'EXPORT_FEHLT');
  });
});

test('DSGVO Route: 502 wenn Stripe-Kuendigung fehlschlaegt (Abo aktiv, aber kein Key)', async () => {
  const mockSupabase = createMockSupabase({
    data_access_log: {
      select: (filters) => {
        const isExportCheck = filters.some((f) => f.val === 'dsgvo_export');
        if (isExportCheck) {
          return [{ id: 'export-log-1', action: 'dsgvo_export' }];
        }
        return [];
      },
    },
    profiles: {
      maybeSingle: () => ({
        data: { stripe_subscription_id: 'sub_live_123', stripe_customer_id: 'cus_123' },
        error: null,
      }),
    },
  });

  const router = createDsgvoRouter({
    istKutu: () => false,
    supabase: mockSupabase,
    stripeKey: null, // Fehlender Key fuehrt zu kontrolliertem Abbruch
    requireAuth: (req, _res, next) => {
      req.auth = { userId: 'usr-1', tenantId: 'usr-1', role: 'owner' };
      next();
    },
    skipRateLimit: true,
  });

  await withServer(router, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/dsgvo/loeschen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'LÖSCHEN' }),
    });

    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Abo konnte nicht gekündigt werden/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Route-Tests fuer GET /dsgvo/export
// ─────────────────────────────────────────────────────────────────────────────

test('DSGVO Route: GET /dsgvo/export liefert 200, Content-Disposition und protokolliert im Access-Log', async () => {
  const mockSupabase = createMockSupabase({
    aufbewahrung_sperre: {
      select: () => [],
    },
    profiles: {
      select: () => [{ id: 'usr-1', role: 'owner', email: 'owner@test.de' }],
    },
  });

  const router = createDsgvoRouter({
    istKutu: () => false,
    supabase: mockSupabase,
    requireAuth: (req, _res, next) => {
      req.auth = { userId: 'usr-1', tenantId: 'usr-1', role: 'owner' };
      next();
    },
    skipRateLimit: true,
  });

  await withServer(router, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/dsgvo/export`);
    assert.equal(res.status, 200);
    assert.equal(
      res.headers.get('content-disposition'),
      'attachment; filename="dsgvo-export-usr-1.json"'
    );

    const body = await res.json();
    assert.equal(body.user_id, 'usr-1');
    assert.equal(body.legal_basis, 'DSGVO Art. 15 (Recht auf Auskunft)');
    assert.ok(Array.isArray(body.gesperrt));

    // Access-Log-Pruefung
    const exportLogged = mockSupabase.calls.insertedLogs.some(
      (entry) => entry.action === 'dsgvo_export' && entry.user_id === 'usr-1'
    );
    assert.ok(exportLogged, 'Export muss in data_access_log geschrieben werden');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Antworttext-Format (antworttextFallB)
// ─────────────────────────────────────────────────────────────────────────────

test('antworttextFallB: formatiert Daten im deutschen Format DD.MM.YYYY und nennt Rechtsgrundlagen', () => {
  const gesperrt = [
    {
      kategorie: 'behandlung',
      label: 'Behandlungsdokumentation, Verordnungen',
      grundlage: '§ 630f Abs. 3 BGB',
      gesperrt_bis: '2036-12-31',
    },
    {
      kategorie: 'beleg',
      label: 'Rechnungen und Abrechnungsdateien',
      grundlage: '§ 147 Abs. 1 Nr. 4 AO, § 14b UStG',
      gesperrt_bis: '2034-12-31',
    },
    {
      kategorie: 'geschaeftsbrief',
      label: 'Mahnungen',
      grundlage: '§ 147 Abs. 1 Nr. 3 AO',
      gesperrt_bis: '2032-12-31',
    },
  ];

  const text = antworttextFallB(gesperrt);

  // Deutsches Datumsformat DD.MM.YYYY
  assert.ok(text.includes('31.12.2036'), 'Muss deutsches Datum 31.12.2036 enthalten');
  assert.ok(text.includes('31.12.2034'), 'Muss deutsches Datum 31.12.2034 enthalten');
  assert.ok(text.includes('31.12.2032'), 'Muss deutsches Datum 31.12.2032 enthalten');

  // Rechtsgrundlagen
  assert.ok(text.includes('§ 630f Abs. 3 BGB'));
  assert.ok(text.includes('§ 147 Abs. 1 Nr. 4 AO, § 14b UStG'));
  assert.ok(text.includes('§ 147 Abs. 1 Nr. 3 AO'));

  // Einleitung und Erklaerung
  assert.match(text, /Ihr Konto wurde gelöscht – mit einer Ausnahme/);
  assert.match(text, /Betriebsprüfung/);
});

test('antworttextFallB: gibt Standardmeldung aus wenn kein Sperrbestand verbleibt', () => {
  const text = antworttextFallB([]);
  assert.equal(
    text,
    'Ihr Konto wurde gelöscht. Es verbleiben keine aufbewahrungspflichtigen Unterlagen.'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Kern-Garantien von kontoLoeschen
// ─────────────────────────────────────────────────────────────────────────────

test('kontoLoeschen: bricht bei existierendem Abo ohne Stripe-Key sofort mit status=fehler und stripe_fehler=true ab', async () => {
  const mockSupabase = createMockSupabase({
    profiles: {
      maybeSingle: () => ({
        data: { stripe_subscription_id: 'sub_abc_999' },
        error: null,
      }),
    },
  });

  const res = await kontoLoeschen(mockSupabase, {
    ownerId: 'usr-1',
    vorgangId: 'vorgang-1',
    stripeKey: null,
  });

  assert.equal(res.status, 'fehler');
  assert.equal(res.stripe_fehler, true);
  assert.deepEqual(res.gesperrt, []);
  assert.ok(res.unerwartet.includes('stripe'));
  // Keine weiteren Aktionen ausgefuehrt
  assert.equal(mockSupabase.calls.updateUserById, 0);
  assert.equal(mockSupabase.calls.deleteUser, 0);
});

test('kontoLoeschen: ruft NIE auth.admin.deleteUser auf, sondern bannt per updateUserById und beendet Sitzungen', async () => {
  const mockSupabase = createMockSupabase({
    profiles: {
      maybeSingle: () => ({
        data: { stripe_subscription_id: null },
        error: null,
      }),
      select: () => [
        { id: 'emp-1' },
      ],
      update: () => ({ error: null }),
    },
    prescriptions: {
      select: () => [],
    },
    aufbewahrung_sperre: {
      insert: () => ({ error: null }),
    },
    businesses: {
      select: () => [{ id: 'biz-1' }],
      delete: () => ({ error: null }),
    },
    leads: {
      select: () => [],
      delete: () => ({ error: null }),
    },
  });

  const res = await kontoLoeschen(mockSupabase, {
    ownerId: 'usr-1',
    vorgangId: 'vorgang-2',
    stripeKey: null,
  });

  // deleteUser darf unter keinen Umstaenden aufgerufen worden sein!
  assert.equal(
    mockSupabase.calls.deleteUser,
    0,
    'auth.admin.deleteUser darf NIE aufgerufen werden (guvenlik S-40)'
  );

  // updateUserById muss fuer Owner und Mitarbeiter aufgerufen worden sein (2 Aufrufe)
  assert.equal(
    mockSupabase.calls.updateUserById,
    2,
    'Owner und Mitarbeiter muessen per updateUserById gebannt werden'
  );

  // Sitzungsbeendigung via RPC aufgerufen
  const rpcCalls = mockSupabase.calls.rpcCalls.filter((c) => c.fnName === 'auth_sitzungen_beenden');
  assert.equal(rpcCalls.length, 2, 'auth_sitzungen_beenden muss fuer alle Accounts aufgerufen werden');

  assert.ok(res.status === 'geloescht' || res.status === 'teilweise_geloescht');
});
