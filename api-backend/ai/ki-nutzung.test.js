import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

process.env.SUPABASE_URL ||= 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'synthetic-unused-key';

const { createAiRouter } = await import('./router.js');
const { createFakeOwnerDecisionStore } = await import('./ki-einwilligung.js');
const {
  mountKiNutzung,
  formatDiktatZeit,
  formatMonatLabel,
  shiftMonat
} = await import('../../module/ki-nutzung.js');

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const EMPLOYEE_ID = '33333333-3333-4333-8333-333333333333';

const ownerAuth = { role: 'owner', userId: TENANT_A, tenantId: TENANT_A };
const employeeAuth = { role: 'employee', userId: EMPLOYEE_ID, tenantId: TENANT_A };

/** @param {any} req @param {any} res @param {any} next */
const authMiddleware = (req, res, next) => (req.auth ? next() : res.status(401).json({ success: false, error: 'Authentifizierung erforderlich' }));

/**
 * Erstellt einen Mock-Supabase-Client für `ai_audit_log`-Abfragen mit Filter-, Order- und Range-Tracking.
 * @param {{
 *   rows?: Array<Record<string, any>>,
 *   missingExtendedCols?: boolean,
 *   failError?: any,
 *   customBatcher?: (state: { page: number, selectedCols: string }) => { data: any[], error: any }
 * }} [cfg]
 */
function createMockSupabase(cfg = {}) {
  /** @type {Array<{ selectedCols: string, filters: Array<{ op: string, col: string, val: any }>, orderedBy: { col: string, ascending: boolean } | null, range: [number, number] | null }>} */
  const queries = [];

  const supabase = {
    from(/** @type {string} */ table) {
      assert.equal(table, 'ai_audit_log');
      /** @type {any} */
      const state = {
        selectedCols: '',
        filters: [],
        orderedBy: null,
        range: null
      };
      const builder = {
        select(/** @type {string} */ cols) {
          state.selectedCols = cols;
          return builder;
        },
        eq(/** @type {string} */ col, /** @type {any} */ val) {
          state.filters.push({ op: 'eq', col, val });
          return builder;
        },
        gte(/** @type {string} */ col, /** @type {any} */ val) {
          state.filters.push({ op: 'gte', col, val });
          return builder;
        },
        lt(/** @type {string} */ col, /** @type {any} */ val) {
          state.filters.push({ op: 'lt', col, val });
          return builder;
        },
        order(/** @type {string} */ col, /** @type {{ ascending: boolean }} */ opts) {
          state.orderedBy = { col, ascending: Boolean(opts?.ascending) };
          return builder;
        },
        range(/** @type {number} */ from, /** @type {number} */ to) {
          state.range = [from, to];
          return builder;
        },
        then(/** @type {(res: any) => any} */ resolve, /** @type {(err: any) => any} */ reject) {
          return execute().then(resolve, reject);
        }
      };

      async function execute() {
        const snapshot = {
          selectedCols: state.selectedCols,
          filters: [...state.filters],
          orderedBy: state.orderedBy,
          range: state.range
        };
        queries.push(snapshot);

        if (cfg.failError) {
          return { data: null, error: cfg.failError };
        }

        if (cfg.missingExtendedCols && (
          state.selectedCols.includes('reasoning_tokens') || state.selectedCols.includes('audio_seconds')
        )) {
          return {
            data: null,
            error: { code: '42703', message: 'column ai_audit_log.reasoning_tokens does not exist' }
          };
        }

        if (typeof cfg.customBatcher === 'function') {
          const page = state.range ? Math.floor(state.range[0] / 1000) : 0;
          return cfg.customBatcher({ page, selectedCols: state.selectedCols });
        }

        const all = Array.isArray(cfg.rows) ? cfg.rows : [];
        const filtered = all.filter((row) => {
          for (const f of state.filters) {
            if (f.op === 'eq' && row[f.col] !== f.val) return false;
            if (f.op === 'gte' && String(row[f.col]) < String(f.val)) return false;
            if (f.op === 'lt' && String(row[f.col]) >= String(f.val)) return false;
          }
          return true;
        });
        filtered.sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

        const sliced = state.range
          ? filtered.slice(state.range[0], state.range[1] + 1)
          : filtered;

        const cols = state.selectedCols.split(',').map((s) => s.trim()).filter(Boolean);
        const projected = sliced.map((r) => {
          /** @type {Record<string, any>} */
          const out = {};
          for (const c of cols) out[c] = r[c] ?? null;
          return out;
        });

        return { data: projected, error: null };
      }

      return builder;
    }
  };

  return { supabase, queries };
}

/**
 * @param {any} router
 * @param {{ path?: string, auth?: any }} [opts]
 */
async function callGet(router, { path = '/_nutzung', auth = ownerAuth } = {}) {
  const app = express();
  app.use((/** @type {any} */ req, /** @type {any} */ _res, /** @type {any} */ next) => {
    req.auth = auth;
    next();
  });
  app.use('/api/ai', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const res = await fetch(`http://127.0.0.1:${port}/api/ai${path}`);
    return { status: res.status, body: await res.json() };
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

function makeRouter(supabase, config = { mode: 'jeton', valid: true, activationReady: true }) {
  return createAiRouter({
    store: createFakeOwnerDecisionStore({ defaultEnabled: true }),
    configProvider: () => config,
    authMiddleware,
    supabase: /** @type {any} */ (supabase)
  });
}

test('GET /_nutzung: Auth & Owner-Schutz (401 ohne Login, 403 für employee und fremden Owner)', async () => {
  const { supabase } = createMockSupabase();
  const router = makeRouter(supabase);

  assert.equal((await callGet(router, { auth: null })).status, 401);
  assert.equal((await callGet(router, { auth: employeeAuth })).status, 403);
  assert.equal((await callGet(router, { auth: { role: 'owner', userId: EMPLOYEE_ID, tenantId: TENANT_A } })).status, 403);
});

test('GET /_nutzung: lehnt ungültige Monatsformate mit 400 ab', async () => {
  const { supabase, queries } = createMockSupabase();
  const router = makeRouter(supabase);

  for (const bad of ['2026-13', '2026-00', '2026-1', '26-11', 'november', '', '2026-11-01']) {
    const res = await callGet(router, { path: `/_nutzung?month=${encodeURIComponent(bad)}` });
    assert.equal(res.status, 400, `month="${bad}" muss 400 liefern`);
    assert.equal(res.body.success, false);
  }
  assert.equal(queries.length, 0, 'Bei ungültigem Monat darf keine DB-Abfrage laufen');
});

test('GET /_nutzung: strikter tenant_id-Filter, Monatsgrenzen, Aggregation, dry_run-Ausschluss, keine Preise/PHI', async () => {
  const rows = [
    // Mandant A im November 2026: ok text with reasoning
    {
      id: 1, tenant_id: TENANT_A, created_at: '2026-11-01T00:00:00.000Z',
      task: 'b2c-draft', prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500,
      reasoning_tokens: 200, audio_seconds: 0, status: 'ok', dry_run: false
    },
    // Mandant A im November 2026: transkribieren
    {
      id: 2, tenant_id: TENANT_A, created_at: '2026-11-15T12:00:00.000Z',
      task: 'transkribieren', prompt_tokens: 0, completion_tokens: 0, total_tokens: 0,
      reasoning_tokens: 0, audio_seconds: 540, status: 'ok', dry_run: false
    },
    // Mandant A im November 2026: error
    {
      id: 3, tenant_id: TENANT_A, created_at: '2026-11-20T09:00:00.000Z',
      task: 'rezept-ocr', prompt_tokens: 300, completion_tokens: 50, total_tokens: 350,
      reasoning_tokens: 0, audio_seconds: 0, status: 'error', dry_run: false
    },
    // Mandant A im November 2026: dry_run (darf nicht gezählt werden!)
    {
      id: 4, tenant_id: TENANT_A, created_at: '2026-11-21T09:00:00.000Z',
      task: 'b2c-draft', prompt_tokens: 9999, completion_tokens: 9999, total_tokens: 19998,
      reasoning_tokens: 5000, audio_seconds: 900, status: 'ok', dry_run: true
    },
    // Mandant A im Dezember (Grenze: exakt 2026-12-01T00:00:00.000Z -> exklusiv!)
    {
      id: 5, tenant_id: TENANT_A, created_at: '2026-12-01T00:00:00.000Z',
      task: 'b2b-draft', prompt_tokens: 400, completion_tokens: 100, total_tokens: 500,
      reasoning_tokens: 0, audio_seconds: 0, status: 'ok', dry_run: false
    },
    // Mandant B im November 2026 (fremder Mandant -> darf nie auftauchen!)
    {
      id: 6, tenant_id: TENANT_B, created_at: '2026-11-10T10:00:00.000Z',
      task: 'b2c-draft', prompt_tokens: 8000, completion_tokens: 2000, total_tokens: 10000,
      reasoning_tokens: 1000, audio_seconds: 300, status: 'ok', dry_run: false
    }
  ];

  const { supabase, queries } = createMockSupabase({ rows });
  const router = makeRouter(supabase);

  const res = await callGet(router, { path: '/_nutzung?month=2026-11' });
  assert.equal(res.status, 200);
  assert.equal(res.body.month, '2026-11');
  assert.equal(res.body.aiMode, 'jeton');
  assert.equal(res.body.totalCalls, 3);
  assert.equal(res.body.okCalls, 2);
  assert.equal(res.body.errorCalls, 1);
  assert.equal(res.body.dryRunCalls, 1);
  assert.equal(res.body.promptTokens, 1300);
  assert.equal(res.body.completionTokens, 550);
  assert.equal(res.body.totalTokens, 1850);
  assert.equal(res.body.reasoningTokens, 200);
  assert.equal(res.body.audioSeconds, 540);
  assert.equal(res.body.audioMinutes, 9.0);
  assert.equal(res.body.truncated, false);
  assert.deepEqual(res.body.byTask, [
    { task: 'b2c-draft', calls: 1, totalTokens: 1500, audioSeconds: 0 },
    { task: 'rezept-ocr', calls: 1, totalTokens: 350, audioSeconds: 0 },
    { task: 'transkribieren', calls: 1, totalTokens: 0, audioSeconds: 540 }
  ]);

  // Filter- und Order-Vertrag prüfen
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0].filters, [
    { op: 'eq', col: 'tenant_id', val: TENANT_A },
    { op: 'gte', col: 'created_at', val: '2026-11-01T00:00:00.000Z' },
    { op: 'lt', col: 'created_at', val: '2026-12-01T00:00:00.000Z' }
  ]);
  assert.deepEqual(queries[0].orderedBy, { col: 'id', ascending: true });

  // Keine Preise / EUR / PHI in Antwort
  const serialized = JSON.stringify(res.body);
  assert.equal(/costEur|inputEur|outputEur|audioEur|eur|price|preis|patient|tenant/i.test(serialized), false);
});

test('GET /_nutzung: 42703-Fallback wenn reasoning_tokens / audio_seconds noch nicht migriert sind', async () => {
  const rows = [
    {
      id: 1, tenant_id: TENANT_A, created_at: '2026-11-05T10:00:00.000Z',
      task: 'b2b-draft', prompt_tokens: 600, completion_tokens: 200, total_tokens: 800,
      status: 'ok', dry_run: false
    }
  ];
  const { supabase, queries } = createMockSupabase({ rows, missingExtendedCols: true });
  const router = makeRouter(supabase, { mode: 'direkt', valid: true, activationReady: true });

  const res = await callGet(router, { path: '/_nutzung?month=2026-11' });
  assert.equal(res.status, 200);
  assert.equal(res.body.aiMode, 'direkt');
  assert.equal(res.body.totalCalls, 1);
  assert.equal(res.body.totalTokens, 800);
  assert.equal(res.body.reasoningTokens, 0);
  assert.equal(res.body.audioSeconds, 0);
  assert.equal(res.body.audioMinutes, 0);

  assert.equal(queries.length, 2);
  assert.ok(queries[0].selectedCols.includes('reasoning_tokens'));
  assert.ok(!queries[1].selectedCols.includes('reasoning_tokens'));
  assert.ok(!queries[1].selectedCols.includes('audio_seconds'));
});

test('GET /_nutzung: Paginierung stoppt bei 20 Seiten und setzt truncated=true', async () => {
  let calls = 0;
  const { supabase } = createMockSupabase({
    customBatcher: ({ page }) => {
      calls += 1;
      const batch = Array.from({ length: 1000 }, (_, i) => ({
        id: page * 1000 + i + 1,
        task: 'b2c-draft',
        prompt_tokens: 1,
        completion_tokens: 1,
        total_tokens: 2,
        reasoning_tokens: 0,
        audio_seconds: 0,
        status: 'ok',
        dry_run: false
      }));
      return { data: batch, error: null };
    }
  });
  const router = makeRouter(supabase);

  const res = await callGet(router, { path: '/_nutzung?month=2026-11' });
  assert.equal(res.status, 200);
  assert.equal(calls, 20);
  assert.equal(res.body.totalCalls, 20000);
  assert.equal(res.body.totalTokens, 40000);
  assert.equal(res.body.truncated, true);
});

test('GET /_nutzung: liefert sauberen deutschen 500-Fehler bei Datenbankfehler ohne Leck', async () => {
  const { supabase } = createMockSupabase({
    failError: { code: 'XX000', message: 'PATIENT_SENTINEL internal db failure' }
  });
  const router = makeRouter(supabase);

  const res = await callGet(router, { path: '/_nutzung?month=2026-11' });
  assert.equal(res.status, 500);
  assert.equal(res.body.success, false);
  assert.ok(typeof res.body.error === 'string' && res.body.error.length > 0);
  assert.equal(JSON.stringify(res.body).includes('PATIENT_SENTINEL'), false);
});

test('module/ki-nutzung.js: Formatierung, Leer-/Fehlerzustand, Kacheln, Escaping und keine Preise/Hexfarben', async () => {
  assert.equal(formatDiktatZeit(540), '9 Min. 0 Sek.');
  assert.equal(formatDiktatZeit(65), '1 Min. 5 Sek.');
  assert.equal(formatMonatLabel('2026-11'), 'November 2026');
  assert.equal(shiftMonat('2026-01', -1), '2025-12');

  let html = '';
  const el = {
    get innerHTML() { return html; },
    set innerHTML(v) { html = v; },
    querySelector: () => null
  };

  await mountKiNutzung(/** @type {any} */ (el), {
    apiBase: '/api/ai',
    getToken: async () => 'synthetic-token',
    now: new Date('2026-11-27T12:00:00Z'),
    fetchImpl: async (url) => {
      assert.ok(String(url).endsWith('/api/ai/_nutzung?month=2026-11'));
      return /** @type {any} */ ({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          month: '2026-11',
          aiMode: 'jeton',
          totalCalls: 42,
          okCalls: 40,
          errorCalls: 2,
          promptTokens: 12000,
          completionTokens: 4500,
          totalTokens: 16500,
          reasoningTokens: 1800,
          audioSeconds: 540,
          audioMinutes: 9.0,
          byTask: [
            { task: 'transkribieren', calls: 12, totalTokens: 0, audioSeconds: 540 },
            { task: 'b2c-draft<script>', calls: 30, totalTokens: 16500, audioSeconds: 0 }
          ],
          truncated: false
        })
      });
    }
  });

  assert.ok(html.includes('KI-Nutzung (Monatsübersicht)'));
  assert.ok(html.includes('November 2026'));
  assert.ok(html.includes('id="kiNutzungNextBtn" class="btn btn-secondary" aria-label="Nächster Monat" disabled'));
  assert.ok(html.includes('42'));
  assert.ok(html.includes('40 erfolgreich · 2 Fehler'));
  assert.ok(html.includes('16.500 Token'));
  assert.ok(html.includes('1.800 Denk-Token'));
  assert.ok(html.includes('9 Min. 0 Sek.'));
  assert.ok(html.includes('Sprachdiktat'));
  assert.ok(html.includes('b2c-draft&lt;script&gt;') && !html.includes('<script>'));
  assert.ok(html.includes('Nur statistische Zählerstände — es werden keine Patientendaten gespeichert.'));
  assert.equal(/#[0-9a-f]{3,8}\b/i.test(html), false, 'Keine hardcoded Hexfarben im UI');
  assert.equal(/€|\bEUR\b/i.test(html), false, 'Keine EUR-Preise in Praxisansicht');

  // Leerzustand
  await mountKiNutzung(/** @type {any} */ (el), {
    apiBase: '/api/ai',
    getToken: async () => 'synthetic-token',
    now: new Date('2026-11-27T12:00:00Z'),
    fetchImpl: async () => /** @type {any} */ ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, month: '2026-11', totalCalls: 0, byTask: [] })
    })
  });
  assert.ok(html.includes('In diesem Monat noch keine KI-Aufrufe.'));

  // Fehlerzustand
  await mountKiNutzung(/** @type {any} */ (el), {
    apiBase: '/api/ai',
    getToken: async () => 'synthetic-token',
    now: new Date('2026-11-27T12:00:00Z'),
    fetchImpl: async () => /** @type {any} */ ({ ok: false, status: 500, json: async () => ({}) })
  });
  assert.ok(html.includes('Nutzungsdaten konnten derzeit nicht geladen werden.'));
});

test('module/ki-einstellungen.js: mountet KI-Nutzung nur für Inhaber, nicht für Mitarbeiter', async () => {
  const { mountKiEinstellungen } = await import('../../module/ki-einstellungen.js');

  function makeDomContainer() {
    let html = '';
    const sub = {
      innerHTML: '',
      querySelector: () => null
    };
    return {
      get innerHTML() { return html; },
      set innerHTML(v) { html = v; },
      get sub() { return sub; },
      querySelector: (/** @type {string} */ sel) => (sel === '#kiNutzungMount' && html.includes('id="kiNutzungMount"') ? sub : null),
      querySelectorAll: () => []
    };
  }

  /** @type {string[]} */
  const ownerUrls = [];
  const ownerContainer = makeDomContainer();
  await mountKiEinstellungen(/** @type {any} */ (ownerContainer), {
    isOwner: () => true,
    getRole: () => 'owner',
    getSessionToken: async () => 'owner-token',
    apiBase: '/api/ai',
    fetchImpl: async (url) => {
      ownerUrls.push(String(url));
      if (String(url).includes('/_nutzung')) {
        return /** @type {any} */ ({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            month: '2026-11',
            totalCalls: 5,
            okCalls: 5,
            errorCalls: 0,
            promptTokens: 500,
            completionTokens: 100,
            totalTokens: 600,
            reasoningTokens: 0,
            audioSeconds: 0,
            byTask: [{ task: 'b2c-draft', calls: 5, totalTokens: 600, audioSeconds: 0 }]
          })
        });
      }
      return /** @type {any} */ ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, active: true, mode: 'jeton', operatorReady: true, ownerActive: true })
      });
    }
  });
  assert.ok(ownerUrls.some((u) => u.includes('/_nutzung')));
  assert.ok(ownerContainer.sub.innerHTML.includes('KI-Nutzung (Monatsübersicht)'));

  /** @type {string[]} */
  const empUrls = [];
  const empContainer = makeDomContainer();
  await mountKiEinstellungen(/** @type {any} */ (empContainer), {
    isOwner: () => false,
    getRole: () => 'employee',
    getSessionToken: async () => 'emp-token',
    apiBase: '/api/ai',
    fetchImpl: async (url) => {
      empUrls.push(String(url));
      return /** @type {any} */ ({ ok: true, status: 200, json: async () => ({ ok: true, active: false, mode: 'aus' }) });
    }
  });
  assert.equal(empUrls.some((u) => u.includes('/_nutzung')), false);
  assert.equal(empContainer.innerHTML.includes('id="kiNutzungMount"'), false);
  assert.equal(empContainer.sub.innerHTML, '');
});

