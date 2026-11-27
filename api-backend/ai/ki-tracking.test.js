import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { chat, transcribe } from './azureClient.js';
import { executeKiTask } from './ki-gateway.js';
import { logCall, makeUsageAggregateSupplier } from './audit.js';
import { createFakeOwnerDecisionStore } from './ki-einwilligung.js';
import { pruefeKiBericht, kiBerichtHash } from '../merkez-istemci/ki-bericht-schema.js';
import { oeffneDb } from '../../merkez/db.js';

process.env.SUPABASE_URL ||= 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'synthetic-unused-key';
const { createAiRouter } = await import('./router.js');

const FAKE_HOST = 'praxura-test.services.ai.azure.com';

function makeDirectConfig(extra = {}) {
  return {
    mode: 'direkt',
    valid: true,
    activationReady: true,
    mailReady: true,
    allowFreeText: false,
    endpoint: `https://${FAKE_HOST}`,
    deployment: 'gpt-5-mini',
    transcribeDeployment: 'gpt-4o-transcribe',
    apiKey: 'synthetic-api-key-12345',
    apiVersion: '2024-10-21',
    region: 'germanywestcentral',
    modelFamily: 'reasoning',
    allowedHosts: [FAKE_HOST],
    ...extra,
  };
}

test('azureClient.chat: extrahiert reasoning_tokens wenn vorhanden und lässt es sonst weg', async () => {
  const cfg = makeDirectConfig();

  const withReasoning = await chat({
    config: cfg,
    messages: [{ role: 'user', content: 'Hallo' }],
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({
        model: 'gpt-5-mini-2025-08-07',
        choices: [{ message: { content: 'OK' } }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 80,
          total_tokens: 180,
          completion_tokens_details: { reasoning_tokens: 48 },
        },
      }),
    }),
  });

  assert.deepEqual(withReasoning.usage, {
    prompt_tokens: 100,
    completion_tokens: 80,
    total_tokens: 180,
    reasoning_tokens: 48,
  });

  const withoutReasoning = await chat({
    config: makeDirectConfig({ modelFamily: 'standard', deployment: 'gpt-4o-mini' }),
    messages: [{ role: 'user', content: 'Hallo' }],
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({
        model: 'gpt-4o-mini',
        choices: [{ message: { content: 'OK' } }],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 20,
          total_tokens: 70,
        },
      }),
    }),
  });

  assert.deepEqual(withoutReasoning.usage, {
    prompt_tokens: 50,
    completion_tokens: 20,
    total_tokens: 70,
  });
  assert.equal('reasoning_tokens' in withoutReasoning.usage, false);
});

test('azureClient.transcribe: bevorzugt json.usage.seconds, sonst Fallback auf audioSeconds', async () => {
  const cfg = makeDirectConfig();
  const audioBuffer = Buffer.from([1, 2, 3, 4]);

  // 1. Azure liefert usage.seconds -> bevorzugt (gerundet) gegenüber audioSeconds
  const fromAzure = await transcribe({
    config: cfg,
    audioBuffer,
    audioSeconds: 42,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ text: 'Befund gut', usage: { type: 'duration', seconds: 37.6 } }),
    }),
  });
  assert.deepEqual(fromAzure.usage, {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    audio_seconds: 38,
  });

  // 2. Azure liefert kein usage.seconds -> Fallback auf übergebene audioSeconds
  const fromInput = await transcribe({
    config: cfg,
    audioBuffer,
    audioSeconds: 29.4,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ text: 'Befund stabil' }),
    }),
  });
  assert.deepEqual(fromInput.usage, {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    audio_seconds: 29,
  });

  // 3. Weder Azure noch Eingabe -> audio_seconds weggelassen
  const omitted = await transcribe({
    config: cfg,
    audioBuffer,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ text: 'Ohne Dauer' }),
    }),
  });
  assert.deepEqual(omitted.usage, {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  });
  assert.equal('audio_seconds' in omitted.usage, false);

  // 4. Mock-Modus mit audioSeconds
  const mocked = await transcribe({
    mock: true,
    mockFn: () => 'Mock-Text',
    audioBuffer,
    audioSeconds: 15,
  });
  assert.deepEqual(mocked.usage, {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    audio_seconds: 15,
  });
});

test('ki-gateway & router: duration (0..180) fließt bis transcribe() und audit.logCall', async () => {
  const cfg = makeDirectConfig();
  const ownerDecisionStore = createFakeOwnerDecisionStore({ defaultEnabled: true });

  /** @type {unknown} */
  let seenAudioSeconds;
  const gwRes = await executeKiTask({
    task: 'transkribieren',
    payload: {
      audioBuffer: Buffer.from([1, 2, 3]),
      mimeType: 'audio/webm',
      duration: 64,
    },
    context: {
      auth: {
        userId: '11111111-1111-4111-8111-111111111111',
        tenantId: '11111111-1111-4111-8111-111111111111',
        role: 'owner',
      },
    },
    dependencies: {
      config: cfg,
      ownerDecisionStore,
      transcribeTransport: async (opts) => {
        seenAudioSeconds = opts.audioSeconds;
        return {
          text: 'Diktat',
          model: 'gpt-4o-transcribe',
          deployment: 'gpt-4o-transcribe',
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, audio_seconds: 64 },
          dry_run: false,
          latency_ms: 12,
        };
      },
    },
  });
  assert.equal(seenAudioSeconds, 64);
  assert.equal(gwRes.meta.usage?.audio_seconds, 64);

  // Router /transkribieren: Fallback im finally-Block wenn Task-Mock audio_seconds nicht zurückgibt
  /** @type {Record<string, unknown> | null} */
  let loggedRow = null;
  const fakeSupabase = /** @type {any} */ ({
    from: () => ({
      insert: async (/** @type {Record<string, unknown>} */ row) => {
        loggedRow = row;
        return { error: null };
      },
    }),
  });
  /** @type {number | undefined} */
  let receivedDuration;
  const r = createAiRouter({
    store: ownerDecisionStore,
    configProvider: () => cfg,
    authMiddleware: (req, _res, next) => {
      req.auth = {
        userId: '11111111-1111-4111-8111-111111111111',
        tenantId: '11111111-1111-4111-8111-111111111111',
        role: 'owner',
      };
      next();
    },
    supabase: fakeSupabase,
    tasks: {
      transkribieren: async (payload) => {
        receivedDuration = payload.duration;
        return {
          text: 'Hallo',
          _meta: {
            model: 'gpt-4o-transcribe',
            deployment: 'gpt-4o-transcribe',
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          },
        };
      },
    },
  });

  const app = express();
  app.use('/api/ai', r);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const addr = /** @type {import('node:net').AddressInfo} */ (server.address());
    const resp = await fetch(`http://127.0.0.1:${addr.port}/api/ai/transkribieren`, {
      method: 'POST',
      headers: {
        'content-type': 'audio/webm',
        'x-audio-duration': '47',
      },
      body: Buffer.from([1, 2, 3, 4]),
    });
    assert.equal(resp.status, 200);
    assert.equal(receivedDuration, 47);
    assert.ok(loggedRow);
    assert.equal(/** @type {any} */ (loggedRow).audio_seconds, 47);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('audit: logCall & makeUsageAggregateSupplier mit reasoning_tokens und audio_seconds', async () => {
  /** @type {Record<string, unknown> | null} */
  let savedRow = null;
  const fakeSupabase = /** @type {any} */ ({
    from: () => ({
      insert: async (/** @type {Record<string, unknown>} */ row) => {
        savedRow = row;
        return { error: null };
      },
    }),
  });

  await logCall({
    tenantId: '11111111-1111-4111-8111-111111111111',
    userId: '11111111-1111-4111-8111-111111111111',
    task: 'b2c-draft',
    model: 'gpt-5-mini',
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
      reasoning_tokens: 30,
      audio_seconds: /** @type {any} */ (-5), // ungültig -> null
    },
    status: 'ok',
  }, fakeSupabase);

  assert.equal(/** @type {any} */ (savedRow).reasoning_tokens, 30);
  assert.equal(/** @type {any} */ (savedRow).audio_seconds, null);

  // Aggregation: nur > 0 werden aufgenommen; 0/null bleibt bei exakt 4 Feldern
  const mockRows = [
    { task: 'b2c-draft', prompt_tokens: 100, completion_tokens: 50, total_tokens: 150, reasoning_tokens: 20, audio_seconds: null },
    { task: 'b2c-draft', prompt_tokens: 100, completion_tokens: 60, total_tokens: 160, reasoning_tokens: 15, audio_seconds: 0 },
    { task: 'transkribieren', prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, reasoning_tokens: null, audio_seconds: 45 },
    { task: 'rezept-validate', prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, reasoning_tokens: 0, audio_seconds: 0 },
  ];

  const aggClient = /** @type {any} */ ({
    from() {
      const b = {
        select: () => b,
        eq: () => b,
        gte: () => b,
        lt: () => b,
        order: () => b,
        range: async () => ({ data: mockRows, error: null }),
      };
      return b;
    },
  });

  const supplier = makeUsageAggregateSupplier(aggClient, 'tenant-1', {
    now: Date.UTC(2026, 10, 27, 12, 0, 0),
  });
  const report = await supplier();

  assert.deepEqual(report.taskTotals['b2c-draft'], {
    calls: 2,
    prompt_tokens: 200,
    completion_tokens: 110,
    total_tokens: 310,
    reasoning_tokens: 35,
  });
  assert.deepEqual(report.taskTotals['transkribieren'], {
    calls: 1,
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    audio_seconds: 45,
  });
  assert.deepEqual(report.taskTotals['rezept-validate'], {
    calls: 1,
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15,
  });
});

test('ki-bericht-schema & merkez/db: optionale Felder reasoning_tokens und audio_seconds', () => {
  const base = {
    reportId: 'rep_2026-11-27_box1',
    windowStart: '2026-11-27T00:00:00.000Z',
    windowEnd: '2026-11-28T00:00:00.000Z',
    taskTotals: {
      'b2c-draft': {
        calls: 2,
        prompt_tokens: 200,
        completion_tokens: 100,
        total_tokens: 300,
        reasoning_tokens: 40,
      },
      'transkribieren': {
        calls: 1,
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        audio_seconds: 55,
      },
    },
  };

  const reordered = {
    windowEnd: '2026-11-28T00:00:00.000Z',
    reportId: 'rep_2026-11-27_box1',
    taskTotals: {
      'transkribieren': {
        audio_seconds: 55,
        total_tokens: 0,
        completion_tokens: 0,
        prompt_tokens: 0,
        calls: 1,
      },
      'b2c-draft': {
        reasoning_tokens: 40,
        total_tokens: 300,
        completion_tokens: 100,
        prompt_tokens: 200,
        calls: 2,
      },
    },
    windowStart: '2026-11-27T00:00:00.000Z',
  };

  const p1 = pruefeKiBericht(base);
  const p2 = pruefeKiBericht(reordered);
  assert.equal(p1.ok, true);
  assert.equal(p2.ok, true);
  assert.equal(kiBerichtHash(base), kiBerichtHash(reordered));

  const changed = structuredClone(base);
  changed.taskTotals['b2c-draft'].reasoning_tokens = 41;
  assert.notEqual(kiBerichtHash(base), kiBerichtHash(changed));

  // Ungültige Werte abgelehnt
  const negReasoning = structuredClone(base);
  negReasoning.taskTotals['b2c-draft'].reasoning_tokens = -1;
  assert.deepEqual(pruefeKiBericht(negReasoning), { ok: false, grund: 'metrik' });

  const floatAudio = structuredClone(base);
  floatAudio.taskTotals['transkribieren'].audio_seconds = 12.5;
  assert.deepEqual(pruefeKiBericht(floatAudio), { ok: false, grund: 'metrik' });

  // merkez/db.js: berichtWaechst mit reasoning_tokens und audio_seconds
  const db = oeffneDb(':memory:');
  const v1 = {
    reportId: 'rep-grow',
    windowStart: '2026-11-27T00:00:00.000Z',
    windowEnd: '2026-11-28T00:00:00.000Z',
    taskTotals: {
      'b2c-draft': { calls: 1, prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    },
  };
  const v2 = {
    ...v1,
    taskTotals: {
      'b2c-draft': { calls: 2, prompt_tokens: 20, completion_tokens: 10, total_tokens: 30, reasoning_tokens: 8 },
    },
  };
  const v3Bad = {
    ...v1,
    taskTotals: {
      'b2c-draft': { calls: 3, prompt_tokens: 30, completion_tokens: 15, total_tokens: 45, reasoning_tokens: 5 },
    },
  };
  const v3Good = {
    ...v1,
    taskTotals: {
      'b2c-draft': { calls: 3, prompt_tokens: 30, completion_tokens: 15, total_tokens: 45, reasoning_tokens: 12 },
      'transkribieren': { calls: 1, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, audio_seconds: 30 },
    },
  };
  const v4BadAudio = {
    ...v1,
    taskTotals: {
      'b2c-draft': { calls: 3, prompt_tokens: 30, completion_tokens: 15, total_tokens: 45, reasoning_tokens: 12 },
      'transkribieren': { calls: 2, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, audio_seconds: 25 },
    },
  };

  assert.equal(db.kiBerichtSpeichern({ boxId: 'b1', reportId: 'rep-grow', payloadHash: 'h1', windowStart: v1.windowStart, empfangen: 100, daten: v1 }), 'neu');
  assert.equal(db.kiBerichtSpeichern({ boxId: 'b1', reportId: 'rep-grow', payloadHash: 'h2', windowStart: v1.windowStart, empfangen: 200, daten: v2 }), 'aktualisiert');
  assert.equal(db.kiBerichtSpeichern({ boxId: 'b1', reportId: 'rep-grow', payloadHash: 'h3b', windowStart: v1.windowStart, empfangen: 300, daten: v3Bad }), 'abweichend');
  assert.equal(db.kiBerichtSpeichern({ boxId: 'b1', reportId: 'rep-grow', payloadHash: 'h3g', windowStart: v1.windowStart, empfangen: 350, daten: v3Good }), 'aktualisiert');
  assert.equal(db.kiBerichtSpeichern({ boxId: 'b1', reportId: 'rep-grow', payloadHash: 'h4b', windowStart: v1.windowStart, empfangen: 400, daten: v4BadAudio }), 'abweichend');
  db.close();
});

test('audit.logCall: normalisiert versionierte Modellnamen und behaelt Status rueckfrage', async () => {
  /** @type {Array<Record<string, unknown>>} */
  const insertedRows = [];
  const fakeSupabase = /** @type {any} */ ({
    from: () => ({
      insert: async (/** @type {Record<string, unknown>} */ row) => {
        insertedRows.push(row);
        return { error: null };
      },
    }),
  });

  await logCall({
    tenantId: '11111111-1111-4111-8111-111111111111',
    userId: '11111111-1111-4111-8111-111111111111',
    task: 'rezept-validate',
    model: 'GPT-5-mini-2025-08-07',
    usage: { prompt_tokens: 120, completion_tokens: 45, total_tokens: 165, reasoning_tokens: 20 },
    status: 'rueckfrage',
  }, fakeSupabase);

  await logCall({
    tenantId: '11111111-1111-4111-8111-111111111111',
    userId: '11111111-1111-4111-8111-111111111111',
    task: 'transkribieren',
    model: 'gpt-4o-transcribe-2025-03-20',
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, audio_seconds: 18 },
    status: 'ok',
  }, fakeSupabase);

  assert.equal(insertedRows.length, 2);
  assert.equal(insertedRows[0].model, 'gpt-5-mini');
  assert.equal(insertedRows[0].status, 'rueckfrage');
  assert.equal(insertedRows[0].reasoning_tokens, 20);
  assert.equal(insertedRows[1].model, 'gpt-4o-transcribe');
  assert.equal(insertedRows[1].audio_seconds, 18);
});

test('audit.logCall: 42703-Fallback schreibt Alt-Zeile ohne reasoning_tokens und audio_seconds', async () => {
  const originalConsoleError = console.error;
  /** @type {unknown[]} */
  const logs = [];
  console.error = (msg) => logs.push(msg);

  try {
    /** @type {Array<Record<string, unknown>>} */
    const attempts = [];
    const preMigrationSupabase = /** @type {any} */ ({
      from: () => ({
        insert: async (/** @type {Record<string, unknown>} */ row) => {
          attempts.push(row);
          if ('reasoning_tokens' in row || 'audio_seconds' in row) {
            return { error: { code: '42703', message: 'column "reasoning_tokens" of relation "ai_audit_log" does not exist' } };
          }
          return { error: null };
        },
      }),
    });

    await logCall({
      tenantId: '11111111-1111-4111-8111-111111111111',
      userId: '11111111-1111-4111-8111-111111111111',
      task: 'b2c-draft',
      model: 'gpt-5-mini-2025-08-07',
      usage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120, reasoning_tokens: 15 },
      status: 'ok',
    }, preMigrationSupabase);

    assert.equal(attempts.length, 2);
    assert.equal('reasoning_tokens' in attempts[0], true);
    assert.equal('audio_seconds' in attempts[0], true);
    assert.equal('reasoning_tokens' in attempts[1], false);
    assert.equal('audio_seconds' in attempts[1], false);
    assert.equal(attempts[1].model, 'gpt-5-mini');
    assert.equal(attempts[1].total_tokens, 120);
    assert.equal(logs.length, 0);

    // Auch PostgREST-Meldung ohne code='42703' triggert den Fallback
    /** @type {Array<Record<string, unknown>>} */
    const msgAttempts = [];
    const postgrestCacheSupabase = /** @type {any} */ ({
      from: () => ({
        insert: async (/** @type {Record<string, unknown>} */ row) => {
          msgAttempts.push(row);
          if ('audio_seconds' in row) {
            return { error: { message: "Could not find the 'audio_seconds' column of 'ai_audit_log' in the schema cache" } };
          }
          return { error: null };
        },
      }),
    });

    await logCall({
      tenantId: '11111111-1111-4111-8111-111111111111',
      task: 'transkribieren',
      model: 'gpt-4o-transcribe',
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, audio_seconds: 32 },
      status: 'ok',
    }, postgrestCacheSupabase);

    assert.equal(msgAttempts.length, 2);
    assert.equal('audio_seconds' in msgAttempts[1], false);
    assert.equal('reasoning_tokens' in msgAttempts[1], false);
    assert.equal(logs.length, 0);
  } finally {
    console.error = originalConsoleError;
  }
});

test('audit.makeUsageAggregateSupplier: 42703-Fallback waehlt Alt-Spalten und bleibt fuer Folgeseiten darauf', async () => {
  /** @type {string[]} */
  const selects = [];
  const page1 = [
    { task: 'b2c-draft', prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    { task: 'b2c-draft', prompt_tokens: 40, completion_tokens: 20, total_tokens: 60 },
  ];
  const page2 = [
    { task: 'rezept-validate', prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 },
  ];

  const preMigrationSupabase = /** @type {any} */ ({
    from() {
      let currentSelect = '';
      const b = {
        /** @param {string} cols */
        select(cols) {
          currentSelect = cols;
          selects.push(cols);
          return b;
        },
        eq: () => b,
        gte: () => b,
        lt: () => b,
        order: () => b,
        /** @param {number} from */
        async range(from) {
          if (currentSelect.includes('reasoning_tokens') || currentSelect.includes('audio_seconds')) {
            return { data: null, error: { code: '42703', message: 'column ai_audit_log.reasoning_tokens does not exist' } };
          }
          return { data: from === 0 ? page1 : page2, error: null };
        },
      };
      return b;
    },
  });

  const supplier = makeUsageAggregateSupplier(preMigrationSupabase, 'tenant-legacy', {
    now: Date.UTC(2026, 10, 27, 12, 0, 0),
    pageSize: 2,
  });

  const report = await supplier();
  assert.deepEqual(selects, [
    'task, prompt_tokens, completion_tokens, total_tokens, reasoning_tokens, audio_seconds',
    'task, prompt_tokens, completion_tokens, total_tokens',
    'task, prompt_tokens, completion_tokens, total_tokens',
  ]);
  assert.deepEqual(report.taskTotals['b2c-draft'], {
    calls: 2,
    prompt_tokens: 140,
    completion_tokens: 70,
    total_tokens: 210,
  });
  assert.deepEqual(report.taskTotals['rezept-validate'], {
    calls: 1,
    prompt_tokens: 30,
    completion_tokens: 10,
    total_tokens: 40,
  });
});
