import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-unused-key';

const { run: transkribieren } = await import('./transkribieren.js');
const { createAiRouter } = await import('../router.js');

const tenantId = '22222222-2222-4222-8222-222222222222';
const auth = { tenantId, userId: tenantId, role: 'owner' };

/**
 * @param {{
 *   mode?: string,
 *   transcribeDeployment?: string,
 *   activationReady?: boolean,
 *   mailReady?: boolean,
 *   ownerEnabled?: boolean,
 *   mockTransport?: ((opts: Record<string, unknown>) => Promise<Record<string, unknown>>) | null
 * }} [opts]
 */
function buildContext({
  mode = 'direkt',
  transcribeDeployment = 'whisper',
  activationReady = true,
  mailReady = true,
  ownerEnabled = true,
  mockTransport = null
} = {}) {
  const cfg = {
    valid: true,
    mode,
    activationReady,
    mailReady,
    transcribeDeployment,
    deployment: 'gpt-4o-mini',
    endpoint: 'https://kemal-mul58wcs-swedencentral.cognitiveservices.azure.com',
    apiKey: 'mock-key',
    region: 'swedencentral',
    apiVersion: '2024-10-21',
    allowedHosts: ['kemal-mul58wcs-swedencentral.cognitiveservices.azure.com']
  };

  return {
    tenantId,
    userId: tenantId,
    role: 'owner',
    dependencies: {
      config: cfg,
      configProvider: () => cfg,
      ownerDecision: { enabled: ownerEnabled },
      transcribeTransport: mockTransport || (async () => ({
        text: 'Transkribierter Text vom Mock',
        model: transcribeDeployment,
        deployment: transcribeDeployment,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        latency_ms: 10
      }))
    }
  };
}

test('transkribieren: mode aus returns 503 AI_MODE_AUS', async () => {
  const ctx = buildContext({ mode: 'aus' });
  const audioBuffer = Buffer.from('RIFF....fake-audio');
  await assert.rejects(
    () => transkribieren({ audioBuffer, mimeType: 'audio/webm' }, ctx),
    (/** @type {unknown} */ err) => {
      const e = /** @type {{ status?: number, code?: string }} */ (err);
      assert.equal(e.status, 503);
      assert.equal(e.code, 'AI_MODE_AUS');
      return true;
    }
  );
});

test('transkribieren: missing model in direct mode returns 503 AI_TRANSKRIPTION_NICHT_EINGERICHTET', async () => {
  const ctx = buildContext({ transcribeDeployment: '' });
  const audioBuffer = Buffer.from('fake-audio-bytes');
  await assert.rejects(
    () => transkribieren({ audioBuffer, mimeType: 'audio/webm' }, ctx),
    (/** @type {unknown} */ err) => {
      const e = /** @type {{ status?: number, code?: string }} */ (err);
      assert.equal(e.status, 503);
      assert.equal(e.code, 'AI_TRANSKRIPTION_NICHT_EINGERICHTET');
      return true;
    }
  );
});

test('transkribieren: payload size > 10 MB returns 413 AI_PAYLOAD_TOO_LARGE', async () => {
  const ctx = buildContext();
  const hugeBuffer = { length: 11 * 1024 * 1024 }; // mock large buffer
  Object.setPrototypeOf(hugeBuffer, Buffer.prototype);
  await assert.rejects(
    () => transkribieren({ audioBuffer: /** @type {Buffer} */ (/** @type {unknown} */ (hugeBuffer)), mimeType: 'audio/webm' }, ctx),
    (/** @type {unknown} */ err) => {
      const e = /** @type {{ status?: number, code?: string }} */ (err);
      assert.equal(e.status, 413);
      assert.equal(e.code, 'AI_PAYLOAD_TOO_LARGE');
      return true;
    }
  );
});

test('transkribieren: duration > 180s returns 413 AI_PAYLOAD_TOO_LARGE', async () => {
  const ctx = buildContext();
  const audioBuffer = Buffer.from('fake-audio-bytes');
  await assert.rejects(
    () => transkribieren({ audioBuffer, mimeType: 'audio/webm', duration: 185 }, ctx),
    (/** @type {unknown} */ err) => {
      const e = /** @type {{ status?: number, code?: string }} */ (err);
      assert.equal(e.status, 413);
      assert.equal(e.code, 'AI_PAYLOAD_TOO_LARGE');
      return true;
    }
  );
});

test('transkribieren: success returns text and metadata', async () => {
  const ctx = buildContext({
    mockTransport: async () => ({
      text: 'Erfolgreich diktiert: Bitte Rezept verlängern.',
      model: 'whisper',
      deployment: 'whisper',
      usage: { total_tokens: 0 },
      latency_ms: 15
    })
  });
  const audioBuffer = Buffer.from('fake-audio-bytes');
  const res = await transkribieren({ audioBuffer, mimeType: 'audio/webm' }, ctx);
  assert.equal(res.text, 'Erfolgreich diktiert: Bitte Rezept verlängern.');
  assert.equal(res._meta.model, 'whisper');
});

test('router /transkribieren route: success and audit log does not leak content', async () => {
  /** @type {Record<string, unknown> | null} */
  let auditRow = null;
  const mockDb = {
    /** @param {string} table */
    from: (table) => {
      assert.equal(table, 'ai_audit_log');
      return {
        /** @param {Record<string, unknown>} row */
        insert: async (row) => {
          auditRow = row;
          return { error: null };
        }
      };
    }
  };

  const secretSpeech = 'Streng geheimer diktierter Patiententext!';
  const audioData = Buffer.from('fake-audio-binary-content-12345');

  const cfg = {
    valid: true,
    mode: 'direkt',
    activationReady: true,
    mailReady: true,
    transcribeDeployment: 'whisper',
    deployment: 'gpt-4o-mini',
    endpoint: 'https://kemal-mul58wcs-swedencentral.cognitiveservices.azure.com',
    apiKey: 'mock-key',
    region: 'swedencentral',
    apiVersion: '2024-10-21',
    allowedHosts: ['kemal-mul58wcs-swedencentral.cognitiveservices.azure.com']
  };

  const fakeTasks = {
    transkribieren: async () => ({
      text: secretSpeech,
      _meta: { model: 'whisper', deployment: 'whisper', latency_ms: 25 }
    })
  };

  const router = createAiRouter({
    configProvider: () => cfg,
    tasks: fakeTasks,
    supabase: /** @type {import('@supabase/supabase-js').SupabaseClient} */ (/** @type {unknown} */ (mockDb)),
    authMiddleware: (/** @type {import('express').Request} */ req, /** @type {import('express').Response} */ _res, /** @type {import('express').NextFunction} */ next) => {
      req.auth = auth;
      next();
    },
    rateLimiter: (/** @type {import('express').Request} */ _req, /** @type {import('express').Response} */ _res, /** @type {import('express').NextFunction} */ next) => next()
  });

  const app = express();
  app.use('/api/ai', router);

  /** @type {import('node:http').Server} */
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Expected AddressInfo');
    const url = `http://127.0.0.1:${addr.port}/api/ai/transkribieren`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'audio/webm',
        'x-audio-duration': '35'
      },
      body: audioData
    });

    assert.equal(res.status, 200);
    const json = /** @type {{ success?: boolean, text?: string }} */ (await res.json());
    assert.equal(json.success, true);
    assert.equal(json.text, secretSpeech);

    // Verify audit log
    const writtenRow = /** @type {Record<string, unknown> | null} */ (auditRow);
    assert.ok(writtenRow, 'Audit log row was written');
    assert.equal(writtenRow.task, 'transkribieren');
    assert.equal(writtenRow.status, 'ok');
    assert.equal(writtenRow.model, 'whisper');
    assert.equal(writtenRow.request_hash, null);

    // Verify ZERO content leakage into audit log
    const auditStr = JSON.stringify(writtenRow);
    assert.ok(!auditStr.includes(secretSpeech), 'Transcript must not be in audit log');
    assert.ok(!auditStr.includes('fake-audio-binary-content-12345'), 'Audio binary must not be in audit log');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
