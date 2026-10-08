import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createJetonClient } from './ki-jeton.js';
import { createAiConfig } from './ki-config.js';

const FAKE_HOST = 'praxura-fake-central.services.ai.azure.com';
const ALLOWED_HOSTS = [FAKE_HOST];

function makeJetonConfig(overrides = {}) {
  return createAiConfig({
    AI_MODE: 'jeton',
    AI_ACTIVATION_READY: '1',
    AI_REGION: 'swedencentral',
    ...overrides
  }, { allowedHosts: ALLOWED_HOSTS });
}

function mockMerkezSuccess({
  token = 'jeton-mock-valid-token-string-12345', // secret-scan: ignore — synthetic test token, no credential
  exp = Math.floor(Date.now() / 1000) + 1800,
  endpoint = `https://${FAKE_HOST}`,
  deployment = 'gpt-4o-mini',
  region = 'swedencentral',
  apiVersion = '2024-10-21',
  acknowledgedReportId
} = {}) {
  return async () => ({
    status: 200,
    ok: true,
    json: {
      token,
      exp,
      endpoint,
      deployment,
      region,
      apiVersion,
      ...(acknowledgedReportId ? { acknowledgedReportId } : {})
    }
  });
}

test('valid token issuance: returns structured token payload', async () => {
  const fakeNow = 1_700_000_000_000;
  const expSec = Math.floor(fakeNow / 1000) + 1800;
  const merkezImpl = mockMerkezSuccess({ exp: expSec });

  const client = createJetonClient({
    config: makeJetonConfig(),
    merkezFetchImpl: merkezImpl,
    now: () => fakeNow,
    allowedHosts: ALLOWED_HOSTS
  });

  const res = await client.getToken();
  assert.equal(res.token, 'jeton-mock-valid-token-string-12345');
  assert.equal(res.exp, expSec);
  assert.equal(res.endpoint, `https://${FAKE_HOST}`);
  assert.equal(res.deployment, 'gpt-4o-mini');
  assert.equal(res.region, 'swedencentral');
  assert.equal(res.apiVersion, '2024-10-21');
});

test('TTL rejection: rejects TTL > 3600 s rather than truncating', async () => {
  const fakeNow = 1_700_000_000_000;
  const expSec = Math.floor(fakeNow / 1000) + 3601;
  const merkezImpl = mockMerkezSuccess({ exp: expSec });

  const client = createJetonClient({
    config: makeJetonConfig(),
    merkezFetchImpl: merkezImpl,
    now: () => fakeNow,
    allowedHosts: ALLOWED_HOSTS
  });

  await assert.rejects(
    async () => client.getToken(),
    (err) => err.code === 'AI_TOKEN_TTL_EXCEEDED'
  );
});

test('expired rejection: rejects already expired token', async () => {
  const fakeNow = 1_700_000_000_000;
  const expSec = Math.floor(fakeNow / 1000) - 10;
  const merkezImpl = mockMerkezSuccess({ exp: expSec });

  const client = createJetonClient({
    config: makeJetonConfig(),
    merkezFetchImpl: merkezImpl,
    now: () => fakeNow,
    allowedHosts: ALLOWED_HOSTS
  });

  await assert.rejects(
    async () => client.getToken(),
    (err) => err.code === 'AI_TOKEN_EXPIRED'
  );
});

test('malformed payload rejection: constant safe error message without leaking untrusted fields', async () => {
  const fakeNow = 1_700_000_000_000;
  const expSec = Math.floor(fakeNow / 1000) + 1800;

  // Unallowed host
  const badHostClient = createJetonClient({
    config: makeJetonConfig(),
    merkezFetchImpl: mockMerkezSuccess({ endpoint: 'https://evil.azure.com', exp: expSec }),
    now: () => fakeNow,
    allowedHosts: ALLOWED_HOSTS
  });
  await assert.rejects(
    async () => badHostClient.getToken(),
    (err) => {
      assert.equal(err.code, 'AI_HOST_NOT_ALLOWED');
      assert.equal(err.message, 'KI-Jeton-Antwort ungültig');
      return true;
    }
  );

  // Non-integer exp
  const floatExpClient = createJetonClient({
    config: makeJetonConfig(),
    merkezFetchImpl: mockMerkezSuccess({ exp: 1700000000.5 }),
    now: () => fakeNow,
    allowedHosts: ALLOWED_HOSTS
  });
  await assert.rejects(
    async () => floatExpClient.getToken(),
    (err) => {
      assert.equal(err.code, 'AI_TOKEN_RESPONSE_INVALID');
      assert.equal(err.message, 'KI-Jeton-Antwort ungültig');
      return true;
    }
  );
});

test('dynamic config enforcement: mode aus or missing activationReady fails closed before network', async () => {
  let networkCalls = 0;
  const mockMerkez = async () => { networkCalls++; return { status: 200, ok: true, json: {} }; };

  let dynamicMode = 'aus';
  let dynamicReady = false;

  const client = createJetonClient({
    configProvider: () => createAiConfig({
      AI_MODE: dynamicMode,
      AI_ACTIVATION_READY: dynamicReady ? '1' : '0'
    }),
    merkezFetchImpl: mockMerkez,
    allowedHosts: ALLOWED_HOSTS
  });

  // 1. Mode aus -> rejects before network
  await assert.rejects(
    async () => client.getToken(),
    (err) => err.code === 'AI_MODE_NOT_JETON'
  );
  assert.equal(networkCalls, 0);

  // 2. Mode jeton but activationReady=false -> rejects before network
  dynamicMode = 'jeton';
  await assert.rejects(
    async () => client.getToken(),
    (err) => err.code === 'AI_NOT_ACTIVATED'
  );
  assert.equal(networkCalls, 0);

  // 3. Activation enabled -> succeeds
  dynamicReady = true;
  const fakeNow = 1_700_000_000_000;
  const expSec = Math.floor(fakeNow / 1000) + 1800;
  const validClient = createJetonClient({
    configProvider: () => createAiConfig({
      AI_MODE: 'jeton',
      AI_ACTIVATION_READY: '1'
    }, { allowedHosts: ALLOWED_HOSTS }),
    merkezFetchImpl: mockMerkezSuccess({ exp: expSec }),
    now: () => fakeNow,
    allowedHosts: ALLOWED_HOSTS
  });
  const tok = await validClient.getToken();
  assert.ok(tok.token);
});

test('revalidate cached target against changing allowlist', async () => {
  const fakeNow = 1_700_000_000_000;
  const expSec = Math.floor(fakeNow / 1000) + 1800;
  let dynamicAllowedHosts = [FAKE_HOST];

  const client = createJetonClient({
    configProvider: () => createAiConfig({
      AI_MODE: 'jeton',
      AI_ACTIVATION_READY: '1'
    }, { allowedHosts: dynamicAllowedHosts }),
    merkezFetchImpl: mockMerkezSuccess({ exp: expSec }),
    now: () => fakeNow
  });

  // Obtain cached token with host allowed
  const t1 = await client.getToken();
  assert.equal(t1.token, 'jeton-mock-valid-token-string-12345');

  // Change allowlist (revoke host)
  dynamicAllowedHosts = ['other-host.services.ai.azure.com'];

  // Subsequent call rejects because cached endpoint is no longer in current allowlist
  await assert.rejects(
    async () => client.getToken(),
    (err) => err.code === 'AI_HOST_NOT_ALLOWED'
  );
});

test('singleflight refresh with isolated caller abort: caller A aborts, caller B succeeds', async () => {
  let calls = 0;
  const fakeNow = 1_700_000_000_000;
  const expSec = Math.floor(fakeNow / 1000) + 1800;

  const slowMerkez = async () => {
    calls++;
    await new Promise(r => setTimeout(r, 40));
    return {
      status: 200,
      ok: true,
      json: {
        token: 'token-singleflight-valid', // secret-scan: ignore — synthetic test token, no credential
        exp: expSec,
        endpoint: `https://${FAKE_HOST}`,
        deployment: 'gpt-4o-mini',
        region: 'swedencentral',
        apiVersion: '2024-10-21'
      }
    };
  };

  const client = createJetonClient({
    config: makeJetonConfig(),
    merkezFetchImpl: slowMerkez,
    now: () => fakeNow,
    allowedHosts: ALLOWED_HOSTS
  });

  const abortControllerA = new AbortController();
  setTimeout(() => abortControllerA.abort(), 10);

  const promiseA = client.getToken({ signal: abortControllerA.signal });
  const promiseB = client.getToken(); // Caller B does not abort

  await assert.rejects(
    async () => promiseA,
    (err) => err.name === 'AbortError'
  );

  const resB = await promiseB;
  assert.equal(resB.token, 'token-singleflight-valid');
  assert.equal(calls, 1);
});

test('401 race: parallel caller reuses already refreshed token without duplicate network call', async () => {
  let counter = 0;
  const fakeNow = 1_700_000_000_000;
  const expSec = Math.floor(fakeNow / 1000) + 1800;

  const merkezImpl = async () => {
    counter++;
    return {
      status: 200,
      ok: true,
      json: {
        token: `token-version-${counter}`,
        exp: expSec,
        endpoint: `https://${FAKE_HOST}`,
        deployment: 'gpt-4o-mini',
        region: 'swedencentral',
        apiVersion: '2024-10-21'
      }
    };
  };

  const client = createJetonClient({
    config: makeJetonConfig(),
    merkezFetchImpl: merkezImpl,
    now: () => fakeNow,
    allowedHosts: ALLOWED_HOSTS
  });

  const t1 = await client.getToken();
  assert.equal(t1.token, 'token-version-1');

  // Caller 1 experiences 401 on token-version-1 and forces refresh
  const t2 = await client.getToken({ forceRefresh: true, rejectedToken: 'token-version-1' });
  assert.equal(t2.token, 'token-version-2');
  assert.equal(counter, 2);

  // Caller 2 also experienced 401 on the old token-version-1, but comes after Caller 1 refreshed:
  // It passes rejectedToken: 'token-version-1'. Since currentToken is already 'token-version-2',
  // it reuses token-version-2 WITHOUT triggering another network call!
  const t2Reused = await client.getToken({ forceRefresh: true, rejectedToken: 'token-version-1' });
  assert.equal(t2Reused.token, 'token-version-2');
  assert.equal(counter, 2); // Counter did not increase!
});

test('aggregate usage contract: stages snapshot and piggybacks on next jeton fetch', async () => {
  let sentReport = null;
  const fakeNow = 1_700_000_000_000;
  const expSec = Math.floor(fakeNow / 1000) + 1800;

  const mockMerkez = async (path, opts) => {
    assert.equal(path, '/v1/ki/jeton');
    sentReport = opts.body.report;
    return {
      status: 200,
      ok: true,
      json: {
        token: 'token-with-report-ack',
        exp: expSec,
        endpoint: `https://${FAKE_HOST}`,
        deployment: 'gpt-4o-mini',
        region: 'swedencentral',
        apiVersion: '2024-10-21',
        acknowledgedReportId: 'rep-day-20261008'
      }
    };
  };

  const client = createJetonClient({
    config: makeJetonConfig(),
    merkezFetchImpl: mockMerkez,
    now: () => fakeNow,
    allowedHosts: ALLOWED_HOSTS
  });

  const report = {
    reportId: 'rep-day-20261008',
    windowStart: '2026-10-08T00:00:00.000Z',
    windowEnd: '2026-10-09T00:00:00.000Z',
    taskTotals: {
      'rezept-ocr': { calls: 10, prompt_tokens: 1000, completion_tokens: 200, total_tokens: 1200 },
      'b2c-draft': { calls: 4, prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 }
    }
  };

  // Stage report
  const stageRes = await client.reportUsage(report);
  assert.equal(stageRes.ok, true);
  assert.equal(stageRes.staged, true);
  assert.equal(client.getState().hasPendingReport, true);

  // Re-staging identical report succeeds
  await client.reportUsage(report);

  await assert.rejects(
    async () => client.reportUsage({ ...report, taskTotals: { ...report.taskTotals, 'b2c-draft': { calls: 5, prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 } } }),
    /Bestehende reportId darf nicht mit abweichenden Daten überschrieben werden/
  );

  // Trigger token fetch which sends staged report
  const tok = await client.getToken();
  assert.equal(tok.token, 'token-with-report-ack');
  assert.equal(sentReport.reportId, 'rep-day-20261008');

  // Since acknowledgedReportId matched, pending report is cleared!
  assert.equal(client.getState().hasPendingReport, false);
});

test('aggregate validation: rejects unknown task name or non-integer tokens', async () => {
  const client = createJetonClient({
    config: makeJetonConfig(),
    allowedHosts: ALLOWED_HOSTS
  });

  // Unknown task name
  await assert.rejects(
    async () => client.reportUsage({
      reportId: 'rep-1',
      windowStart: '2026-10-08T00:00:00.000Z',
      windowEnd: '2026-10-09T00:00:00.000Z',
      taskTotals: { 'patient-name-injection': { calls: 1, prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }
    }),
    /Unbekannter Task in taskTotals/
  );

  // Non-integer token count
  await assert.rejects(
    async () => client.reportUsage({
      reportId: 'rep-2',
      windowStart: '2026-10-08T00:00:00.000Z',
      windowEnd: '2026-10-09T00:00:00.000Z',
      taskTotals: { 'rezept-ocr': { calls: 1.5, prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }
    }),
    /Token-Metriken müssen nicht-negative Ganzzahlen sein/
  );
});

test('centre failure: retains unexpired valid token on centre downtime', async () => {
  let fakeNow = 1_700_000_000_000;
  const expSec = Math.floor(fakeNow / 1000) + 1800;
  let shouldFail = false;

  const merkezImpl = async () => {
    if (shouldFail) {
      throw new Error('Merkez connection refused');
    }
    return {
      status: 200,
      ok: true,
      json: {
        token: 'initial-token',
        exp: expSec,
        endpoint: `https://${FAKE_HOST}`,
        deployment: 'gpt-4o-mini',
        region: 'swedencentral',
        apiVersion: '2024-10-21'
      }
    };
  };

  const client = createJetonClient({
    config: makeJetonConfig(),
    merkezFetchImpl: merkezImpl,
    now: () => fakeNow,
    allowedHosts: ALLOWED_HOSTS,
    refreshSkewMs: 10_000
  });

  const t1 = await client.getToken();
  assert.equal(t1.token, 'initial-token');

  // Move time into skew window so a refresh is attempted
  fakeNow = (expSec - 5) * 1000;
  shouldFail = true;

  // Refresh fails, but token is not yet expired -> retained!
  const tRetained = await client.getToken();
  assert.equal(tRetained.token, 'initial-token');

  // Once expired, centre failure throws safe error
  fakeNow = (expSec + 1) * 1000;
  await assert.rejects(async () => client.getToken(), /Zentrum für KI-Jeton nicht erreichbar/);
});

test('quota error: centre quota status disables token immediately and throws AI_QUOTA_EXCEEDED', async () => {
  const fakeNow = 1_700_000_000_000;
  let shouldQuota = false;

  const merkezImpl = async () => {
    if (shouldQuota) {
      return {
        status: 429,
        ok: false,
        json: { code: 'AI_QUOTA_EXCEEDED', error: 'quota' }
      };
    }
    return {
      status: 200,
      ok: true,
      json: {
        token: 'active-token-string-1234', // secret-scan: ignore — synthetic test token, no credential
        exp: Math.floor(fakeNow / 1000) + 1800,
        endpoint: `https://${FAKE_HOST}`,
        deployment: 'gpt-4o-mini',
        region: 'swedencentral',
        apiVersion: '2024-10-21'
      }
    };
  };

  const client = createJetonClient({
    config: makeJetonConfig(),
    merkezFetchImpl: merkezImpl,
    now: () => fakeNow,
    allowedHosts: ALLOWED_HOSTS
  });

  const t1 = await client.getToken();
  assert.equal(t1.token, 'active-token-string-1234');

  // Now trigger quota error on forced refresh
  shouldQuota = true;
  await assert.rejects(
    async () => client.getToken({ forceRefresh: true }),
    (err) => err.code === 'AI_QUOTA_EXCEEDED'
  );

  const state = client.getState();
  assert.equal(state.tokenDisabled, true);
  assert.equal(state.disabledReason, 'AI_QUOTA_EXCEEDED');

  await assert.rejects(
    async () => client.getToken(),
    (err) => err.code === 'AI_QUOTA_EXCEEDED'
  );
});

test('independent PM2 workers: two client instances have independent RAM token states', async () => {
  const fakeNow = 1_700_000_000_000;
  let counter = 0;

  const merkezImpl = async () => {
    counter++;
    return {
      status: 200,
      ok: true,
      json: {
        token: `worker-token-valid-${counter}`,
        exp: Math.floor(fakeNow / 1000) + 1800,
        endpoint: `https://${FAKE_HOST}`,
        deployment: 'gpt-4o-mini',
        region: 'swedencentral',
        apiVersion: '2024-10-21'
      }
    };
  };

  const worker1 = createJetonClient({
    config: makeJetonConfig(),
    merkezFetchImpl: merkezImpl,
    now: () => fakeNow,
    allowedHosts: ALLOWED_HOSTS
  });
  const worker2 = createJetonClient({
    config: makeJetonConfig(),
    merkezFetchImpl: merkezImpl,
    now: () => fakeNow,
    allowedHosts: ALLOWED_HOSTS
  });

  const t1 = await worker1.getToken();
  const t2 = await worker2.getToken();

  assert.equal(t1.token, 'worker-token-valid-1');
  assert.equal(t2.token, 'worker-token-valid-2');

  // Invalidate worker 1 does not affect worker 2
  worker1.invalidate();
  assert.equal(worker1.getState().hasToken, false);
  assert.equal(worker2.getState().hasToken, true);
});
