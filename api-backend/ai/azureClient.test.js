import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chat, configSummary } from './azureClient.js';
import { createAiConfig } from './ki-config.js';
import { createJetonClient } from './ki-jeton.js';

const FAKE_HOST = 'praxura-test.services.ai.azure.com';
const ALLOWED_HOSTS = [FAKE_HOST];

function makeDirectConfig() {
  return createAiConfig({
    AI_MODE: 'direkt',
    AI_ENDPOINT: `https://${FAKE_HOST}`,
    AI_API_KEY: 'secret-api-key-12345',
    AI_MODEL_TEXT: 'gpt-4o-mini',
    AI_REGION: 'swedencentral',
    AI_ACTIVATION_READY: '1'
  }, { allowedHosts: ALLOWED_HOSTS });
}

function makeJetonConfig() {
  return createAiConfig({
    AI_MODE: 'jeton',
    AI_ACTIVATION_READY: '1',
    AI_REGION: 'swedencentral'
  }, { allowedHosts: ALLOWED_HOSTS });
}

test('explicit mock: returns mock output when mock:true with mockFn', async () => {
  const res = await chat({
    mock: true,
    mockFn: ({ messages }) => `Echo: ${messages[0].content}`,
    messages: [{ role: 'user', content: 'Hallo Welt' }]
  });

  assert.equal(res.dry_run, true);
  assert.equal(res.content, 'Echo: Hallo Welt');
  assert.deepEqual(res.usage, { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
  assert.equal(typeof res.latency_ms, 'number');
});

test('explicit mock error: throws if mock:true without mockFn', async () => {
  await assert.rejects(
    async () => chat({
      mock: true,
      messages: [{ role: 'user', content: 'Hallo' }]
    }),
    /Expliziter Mock erfordert eine mockFn-Funktion/
  );
});

test('mode aus: safe German 503 error before network', async () => {
  const cfg = createAiConfig({ AI_MODE: 'aus', AI_ACTIVATION_READY: '1' });
  await assert.rejects(
    async () => chat({
      config: cfg,
      messages: [{ role: 'user', content: 'Hallo' }]
    }),
    (err) => {
      assert.equal(err.code, 'AI_MODE_AUS');
      assert.equal(err.status, 503);
      assert.equal(err.message, 'KI-Dienst ist deaktiviert');
      return true;
    }
  );
});

test('readiness gate: safe German 503 error if AI_ACTIVATION_READY is not 1', async () => {
  const cfg = createAiConfig({
    AI_MODE: 'direkt',
    AI_ENDPOINT: `https://${FAKE_HOST}`,
    AI_API_KEY: 'secret-key',
    AI_ACTIVATION_READY: '0'
  }, { allowedHosts: ALLOWED_HOSTS });

  await assert.rejects(
    async () => chat({
      config: cfg,
      messages: [{ role: 'user', content: 'Hallo' }]
    }),
    (err) => {
      assert.equal(err.code, 'AI_NOT_ACTIVATED');
      assert.equal(err.status, 503);
      assert.equal(err.message, 'KI-Dienst ist nicht betriebsbereit geschaltet');
      return true;
    }
  );
});

test('multimodal blocked: rejects image or non-string content blocks at transport', async () => {
  const cfg = makeDirectConfig();
  await assert.rejects(
    async () => chat({
      config: cfg,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Scanne das Rezept' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }
          ]
        }
      ]
    }),
    (err) => {
      assert.equal(err.code, 'AI_MULTIMODAL_BLOCKED');
      assert.equal(err.status, 400);
      assert.match(err.message, /Multimodale Inhalte und Bilder sind am KI-Transport nicht zulässig/);
      return true;
    }
  );
});

test('sanitized message transport: rejects unknown extra properties or unknown roles', async () => {
  const cfg = makeDirectConfig();

  // Unknown covert field
  await assert.rejects(
    async () => chat({
      config: cfg,
      messages: [{ role: 'user', content: 'Hallo', covert_injection: true }]
    }),
    (err) => err.code === 'AI_MESSAGES_INVALID'
  );

  // Unknown role
  await assert.rejects(
    async () => chat({
      config: cfg,
      messages: [{ role: 'hacker', content: 'Hallo' }]
    }),
    (err) => err.code === 'AI_MESSAGES_INVALID'
  );
});

test('payload parameter bounds: rejects invalid responseFormat, temperature, or maxTokens', async () => {
  const cfg = makeDirectConfig();

  // Invalid responseFormat
  await assert.rejects(
    async () => chat({
      config: cfg,
      messages: [{ role: 'user', content: 'Test' }],
      responseFormat: { type: 'invalid_format' }
    }),
    (err) => err.code === 'AI_PAYLOAD_INVALID'
  );

  // Negative temperature
  await assert.rejects(
    async () => chat({
      config: cfg,
      messages: [{ role: 'user', content: 'Test' }],
      temperature: -0.1
    }),
    (err) => err.code === 'AI_PAYLOAD_INVALID'
  );

  // Out of bound maxTokens
  await assert.rejects(
    async () => chat({
      config: cfg,
      messages: [{ role: 'user', content: 'Test' }],
      maxTokens: 0
    }),
    (err) => err.code === 'AI_PAYLOAD_INVALID'
  );
});

test('direct mode transport: sends api-key, store:false, redirect:error, and returns golden shape', async () => {
  const cfg = makeDirectConfig();
  let requestedUrl = null;
  let requestedHeaders = null;
  let requestedBody = null;

  const mockFetch = async (url, opts) => {
    requestedUrl = url;
    requestedHeaders = opts.headers;
    requestedBody = JSON.parse(opts.body);
    assert.equal(opts.redirect, 'error');

    return {
      status: 200,
      ok: true,
      text: async () => '',
      json: async () => ({
        choices: [{ message: { content: 'Antwort vom Modell' } }],
        usage: { prompt_tokens: 15, completion_tokens: 25, total_tokens: 40 },
        model: 'gpt-4o-mini'
      })
    };
  };

  const res = await chat({
    config: cfg,
    fetchImpl: mockFetch,
    messages: [{ role: 'user', content: 'Termin prüfen' }],
    responseFormat: { type: 'json_object' }
  });

  assert.equal(res.dry_run, false);
  assert.equal(res.content, 'Antwort vom Modell');
  assert.deepEqual(res.usage, { prompt_tokens: 15, completion_tokens: 25, total_tokens: 40 });
  assert.equal(res.model, 'gpt-4o-mini');
  assert.equal(res.deployment, 'gpt-4o-mini');
  assert.equal(typeof res.latency_ms, 'number');

  assert.equal(requestedHeaders['api-key'], 'secret-api-key-12345');
  assert.equal(requestedHeaders['Authorization'], undefined);
  assert.equal(requestedBody.store, false);
  assert.deepEqual(requestedBody.response_format, { type: 'json_object' });
  assert.ok(requestedUrl.startsWith(`https://${FAKE_HOST}/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-10-21`));
});

test('jeton mode transport: sends Bearer token and uses jeton endpoint', async () => {
  const cfg = makeJetonConfig();
  const expSec = Math.floor(Date.now() / 1000) + 1800;

  const jetonClient = createJetonClient({
    config: cfg,
    merkezFetchImpl: async () => ({
      status: 200,
      ok: true,
      json: {
        token: 'token-jeton-bearer-12345', // secret-scan: ignore — synthetic test token, no credential
        exp: expSec,
        endpoint: `https://${FAKE_HOST}`,
        deployment: 'gpt-4o-mini',
        region: 'swedencentral',
        apiVersion: '2024-10-21'
      }
    }),
    allowedHosts: ALLOWED_HOSTS
  });

  let requestedHeaders = null;
  const mockFetch = async (url, opts) => {
    requestedHeaders = opts.headers;
    return {
      status: 200,
      ok: true,
      text: async () => '',
      json: async () => ({
        choices: [{ message: { content: 'Antwort mit Jeton' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
      })
    };
  };

  const res = await chat({
    config: cfg,
    jetonClient,
    fetchImpl: mockFetch,
    messages: [{ role: 'user', content: 'Test Jeton' }]
  });

  assert.equal(res.content, 'Antwort mit Jeton');
  assert.equal(requestedHeaders['Authorization'], 'Bearer token-jeton-bearer-12345');
  assert.equal(requestedHeaders['api-key'], undefined);
});

test('provider response validation: rejects malformed choice or non-integer usage', async () => {
  const cfg = makeDirectConfig();

  // Missing choices
  const mockNoChoices = async () => ({
    status: 200,
    ok: true,
    text: async () => '',
    json: async () => ({ choices: [], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } })
  });

  await assert.rejects(
    async () => chat({ config: cfg, fetchImpl: mockNoChoices, messages: [{ role: 'user', content: 'hi' }] }),
    (err) => err.code === 'AI_RESPONSE_MALFORMED'
  );

  // Negative usage
  const mockNegativeUsage = async () => ({
    status: 200,
    ok: true,
    text: async () => '',
    json: async () => ({
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: -5, completion_tokens: 1, total_tokens: 2 }
    })
  });

  await assert.rejects(
    async () => chat({ config: cfg, fetchImpl: mockNegativeUsage, messages: [{ role: 'user', content: 'hi' }] }),
    (err) => err.code === 'AI_RESPONSE_MALFORMED'
  );
});

test('fast timeout seam: timeoutMs triggers safe AI_TIMEOUT quickly', async () => {
  const cfg = makeDirectConfig();
  const hangingFetch = async (url, opts) => {
    await new Promise(r => setTimeout(r, 200));
    return { status: 200, ok: true };
  };

  await assert.rejects(
    async () => chat({
      config: cfg,
      fetchImpl: hangingFetch,
      timeoutMs: 25, // Explicit short timeout seam
      messages: [{ role: 'user', content: 'Timeout Test' }]
    }),
    (err) => {
      assert.equal(err.code, 'AI_TIMEOUT');
      assert.equal(err.status, 503);
      return true;
    }
  );
});

test('401 jeton retry: exactly one forced refresh and retry, successful second call', async () => {
  const cfg = makeJetonConfig();
  let tokenCounter = 0;
  const expSec = Math.floor(Date.now() / 1000) + 1800;

  const jetonClient = createJetonClient({
    config: cfg,
    merkezFetchImpl: async () => {
      tokenCounter++;
      return {
        status: 200,
        ok: true,
        json: {
          token: `token-version-${tokenCounter}`,
          exp: expSec,
          endpoint: `https://${FAKE_HOST}`,
          deployment: 'gpt-4o-mini',
          region: 'swedencentral',
          apiVersion: '2024-10-21'
        }
      };
    },
    allowedHosts: ALLOWED_HOSTS
  });

  let fetchAttempts = 0;
  const authHeadersSeen = [];

  const mockFetch = async (url, opts) => {
    fetchAttempts++;
    authHeadersSeen.push(opts.headers['Authorization']);
    if (fetchAttempts === 1) {
      return { status: 401, ok: false, text: async () => 'Unauthorized' };
    }
    return {
      status: 200,
      ok: true,
      text: async () => '',
      json: async () => ({
        choices: [{ message: { content: 'Erfolg nach 401 Refresh' } }],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
      })
    };
  };

  const res = await chat({
    config: cfg,
    jetonClient,
    fetchImpl: mockFetch,
    messages: [{ role: 'user', content: 'Test 401' }]
  });

  assert.equal(res.content, 'Erfolg nach 401 Refresh');
  assert.equal(fetchAttempts, 2);
  assert.equal(authHeadersSeen[0], 'Bearer token-version-1');
  assert.equal(authHeadersSeen[1], 'Bearer token-version-2');
});

test('401 jeton fail: second 401 results in safe 503 unavailable', async () => {
  const cfg = makeJetonConfig();
  const expSec = Math.floor(Date.now() / 1000) + 1800;

  const jetonClient = createJetonClient({
    config: cfg,
    merkezFetchImpl: async () => ({
      status: 200,
      ok: true,
      json: {
        token: 'token-always-401',
        exp: expSec,
        endpoint: `https://${FAKE_HOST}`,
        deployment: 'gpt-4o-mini',
        region: 'swedencentral',
        apiVersion: '2024-10-21'
      }
    }),
    allowedHosts: ALLOWED_HOSTS
  });

  const mockFetch = async () => ({
    status: 401,
    ok: false,
    text: async () => 'Always Unauthorized'
  });

  await assert.rejects(
    async () => chat({
      config: cfg,
      jetonClient,
      fetchImpl: mockFetch,
      messages: [{ role: 'user', content: 'Test' }]
    }),
    (err) => {
      assert.equal(err.code, 'AI_UNAVAILABLE');
      assert.equal(err.status, 503);
      assert.match(err.message, /Authentifizierung fehlgeschlagen/);
      return true;
    }
  );
});

test('429 retry: re-resolves target and retries with retry-after header', async () => {
  const cfg = makeDirectConfig();
  let attempts = 0;

  const mockFetch = async () => {
    attempts++;
    if (attempts === 1) {
      return {
        status: 429,
        ok: false,
        headers: new Map([['retry-after', '0.01']]),
        text: async () => 'Rate limit exceeded'
      };
    }
    return {
      status: 200,
      ok: true,
      text: async () => '',
      json: async () => ({
        choices: [{ message: { content: 'Erfolg nach 429' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
      })
    };
  };

  const res = await chat({
    config: cfg,
    fetchImpl: mockFetch,
    messages: [{ role: 'user', content: 'Test 429' }]
  });

  assert.equal(res.content, 'Erfolg nach 429');
  assert.equal(attempts, 2);
});

test('abort signal: cancels request and throws AI_ABORTED without leaking signal reason', async () => {
  const cfg = makeDirectConfig();
  const controller = new AbortController();
  controller.abort('secret-token-12345-leak-attempt');

  await assert.rejects(
    async () => chat({
      config: cfg,
      signal: controller.signal,
      messages: [{ role: 'user', content: 'Abbruch' }]
    }),
    (err) => {
      assert.equal(err.name, 'AbortError');
      assert.equal(err.code, 'AI_ABORTED');
      assert.ok(!err.message.includes('secret-token-12345-leak-attempt'));
      return true;
    }
  );
});

test('error sanitization: does not leak secret in network failure', async () => {
  const cfg = makeDirectConfig();
  const failingFetch = async () => {
    throw new Error('connect to https://secret-url.com failed with key secret-api-key-12345');
  };

  await assert.rejects(
    async () => chat({
      config: cfg,
      fetchImpl: failingFetch,
      messages: [{ role: 'user', content: 'Test' }]
    }),
    (err) => {
      assert.equal(err.code, 'AI_COMMUNICATION_ERROR');
      assert.equal(err.status, 503);
      assert.ok(!err.message.includes('secret-api-key-12345'));
      assert.ok(!err.message.includes('https://secret-url.com'));
      return true;
    }
  );
});

test('configSummary: whitelisted metadata never reflects arbitrary provider secrets', () => {
  const dirtyConfig = {
    endpoint: 'https://valid-host.services.ai.azure.com',
    deployment: 'gpt-4o-mini\r\nX-Injected-Secret: leak',
    apiVersion: '2024-10-21',
    region: 'swedencentral\nmalicious',
    mode: 'direkt',
    activationReady: true,
    valid: true,
    code: 'OK'
  };

  const summary = configSummary(dirtyConfig);

  assert.equal(summary.endpoint, 'valid-host.…');
  assert.equal(summary.deployment, '(invalid)'); // Filtered due to control chars!
  assert.equal(summary.region, '(unset)'); // Filtered due to control chars!
  assert.equal(summary.dry_run, false);
  assert.equal(summary.mode, 'direkt');
  assert.equal(summary.available, true);
  assert.equal(summary.code, 'OK');
});
