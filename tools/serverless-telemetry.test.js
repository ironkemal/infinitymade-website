import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelemetryReporter, safeTelemetryEvent, withServerlessTelemetry } from '../api/_lib/telemetry.js';

const dsn = 'https://00000000000000000000000000000000@o123.ingest.de.sentry.io/456';

test('fehlendes Opt-in oder ungültiger DSN verhindert sogar SDK-Initialisierung', async () => {
  for (const env of [{}, { SENTRY_DSN_SERVERLESS: dsn }, { SENTRY_SERVERLESS_ENABLED: '1' },
    { SENTRY_SERVERLESS_ENABLED: '1', SENTRY_DSN_SERVERLESS: 'https://x@attacker.invalid/1' }]) {
    const report = createTelemetryReporter({ env, loadSdk: () => assert.fail('SDK darf nicht laden') });
    await report('contact', 'unhandled', 500);
  }
});

test('tatsächliches SDK-Envelope enthält ausschließlich feste Metadaten', async () => {
  const envelopes = [];
  const report = createTelemetryReporter({
    env: { SENTRY_SERVERLESS_ENABLED: '1', SENTRY_DSN_SERVERLESS: dsn, VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40) },
    transport: () => ({ send: async envelope => { envelopes.push(envelope); return { statusCode: 200 }; }, flush: async () => true }),
  });
  await report('contact', 'handled_5xx', 503);
  assert.equal(envelopes.length, 1);
  const item = envelopes[0][1].find(([header]) => header.type === 'event');
  assert.ok(item);
  const event = item[1];
  assert.deepEqual(event.tags, { route: 'contact', code: 'handled_5xx', status: '503' });
  assert.equal(event.message, 'serverless.request.failed');
  assert.equal(event.release, 'a'.repeat(40));
  for (const key of ['exception', 'request', 'user', 'contexts', 'breadcrumbs', 'extra', 'server_name', 'transaction']) {
    assert.equal(key in event, false, key);
  }
  await report('/contact?email=private@example.invalid', 'unhandled', 500);
  await report('contact', 'private@example.invalid', 500);
  await report('contact', 'unhandled', 200);
  assert.equal(envelopes.length, 1);
  assert.doesNotMatch(JSON.stringify(envelopes), /private@example|authorization|cookie|password|patient|stacktrace/i);
});

test('Positivliste rekonstruiert Ereignis und verwirft sämtliche freien Daten', () => {
  const safe = safeTelemetryEvent({
    tags: { route: 'contact', code: 'unhandled', status: 500, patient: 'secret' },
    message: 'secret', request: { body: 'secret' }, user: { email: 'secret' },
    breadcrumbs: ['secret'], exception: { values: ['secret'] }, release: 'secret',
  });
  assert.deepEqual(safe, { message: 'serverless.request.failed', level: 'error',
    tags: { route: 'contact', code: 'unhandled', status: '500' } });
});

test('globale und Isolation-Scope-Anhänge verlassen niemals den finalen Transport', async t => {
  const sdk = await import('@sentry/node');
  const global = sdk.getGlobalScope();
  const isolated = sdk.getIsolationScope();
  global.addAttachment({ filename: 'private-global.txt', data: 'GLOBAL_PRIVATE_PROBE' });
  isolated.addAttachment({ filename: 'private-isolation.txt', data: 'ISOLATION_PRIVATE_PROBE' });
  global.setUser({ email: 'private-probe@example.invalid' });
  isolated.setExtra('private', 'EXTRA_PRIVATE_PROBE');
  t.after(() => { global.clear(); isolated.clear(); });
  const envelopes = [];
  const report = createTelemetryReporter({
    env: { SENTRY_SERVERLESS_ENABLED: '1', SENTRY_DSN_SERVERLESS: dsn },
    transport: () => ({ send: async envelope => { envelopes.push(envelope); return { statusCode: 200 }; }, flush: async () => true }),
  });
  await report('contact', 'unhandled', 500);
  assert.equal(envelopes.length, 1);
  assert.deepEqual(envelopes[0][1].map(([header]) => header.type), ['event']);
  assert.deepEqual(Object.keys(envelopes[0][0]).sort(), ['event_id', 'sent_at']);
  assert.doesNotMatch(JSON.stringify(envelopes), /PRIVATE_PROBE|private-probe|private-global|private-isolation/);
});

test('SDK-Ausfall bleibt ohne Einfluss auf Anfrage', async () => {
  const report = createTelemetryReporter({ env: { SENTRY_SERVERLESS_ENABLED: '1', SENTRY_DSN_SERVERLESS: dsn },
    loadSdk: async () => { throw new Error('private'); } });
  await assert.doesNotReject(report('contact', 'unhandled', 500));
});

test('Wrapper meldet behandelte 5xx, keine 4xx und gibt keine Exception an Reporter weiter', async () => {
  const seen = [];
  const reporter = (...args) => { seen.push(args); };
  const res = { statusCode: 503 };
  await withServerlessTelemetry('contact', async () => 'result', reporter)({}, res);
  assert.deepEqual(seen, [['contact', 'handled_5xx', 503]]);
  res.statusCode = 400;
  await withServerlessTelemetry('contact', async () => {}, reporter)({}, res);
  assert.equal(seen.length, 1);
  const failure = { statusCode: 200, setHeader() {}, end(body) { this.body = body; } };
  await withServerlessTelemetry('contact', async () => { throw new Error('secret'); }, reporter)({}, failure);
  assert.equal(failure.statusCode, 500);
  assert.doesNotMatch(failure.body, /secret/);
  assert.deepEqual(seen.at(-1), ['contact', 'unhandled', 500]);
});

test('unbehandelte Exception wird ohne Meldungstext im Funktionslog vermerkt', async t => {
  const logs = [];
  t.mock.method(console, 'error', (...a) => { logs.push(a); });
  const res = { statusCode: 200, setHeader() {}, end() {} };
  await withServerlessTelemetry('contact', async () => { throw new TypeError('geheim@example.invalid'); }, () => {})({}, res);
  assert.equal(logs.length, 1);
  assert.deepEqual(logs[0], ['[telemetry] unhandled', 'contact', 'TypeError']);
});
