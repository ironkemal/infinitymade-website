import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { authFehlerAntwort, authTransportFetch } from './auth-antwort.js';

// Searchable contract: no raw SDK message/body/header/code enters HTTP diagnostics.
const sensitiveFixture = 'synthetic-sensitive-message-body-header-code';
for (const [label, error, status] of [
  ['missing user', null, 401],
  ['rejected', new AuthApiError(sensitiveFixture, 401, sensitiveFixture), 401],
  ['expired', new AuthApiError(sensitiveFixture, 403, 'jwt_expired'), 401],
  ['unknown', new Error(sensitiveFixture), 401],
  ['untrusted error name', { name: 'AuthRetryableFetchError', message: sensitiveFixture }, 401],
  ['untrusted status string', { status: '503', message: sensitiveFixture }, 401],
  ['retryable network', new AuthRetryableFetchError(sensitiveFixture, 0), 503],
  ['native network', new TypeError(sensitiveFixture), 503],
  ...[408, 429, 500, 502, 503, 504, 599].map(status => [`upstream ${status}`, new AuthApiError(sensitiveFixture, status, sensitiveFixture), 503]),
]) {
  test(`${label}: ${status}, generic response without leakage`, () => {
    if (error) Object.assign(error, { body: sensitiveFixture, headers: { authorization: sensitiveFixture } });
    const res = { status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
    assert.equal(authFehlerAntwort(res, error), res);
    assert.equal(res.statusCode, status);
    assert.deepEqual(res.body, status === 401 ? { error: 'Invalid token' } : {
      error: 'Authentifizierungsdienst vorübergehend nicht verfügbar. Bitte später erneut versuchen.',
      code: 'AUTH_UNAVAILABLE',
    });
    assert.ok(!JSON.stringify(res.body).includes(sensitiveFixture));
  });
}

test('diagnostics never inspect untrusted raw fields', () => {
  const error = { status: 503 };
  for (const field of ['message', 'body', 'headers', 'code']) {
    Object.defineProperty(error, field, { get() { throw new Error('Raw field accessed'); } });
  }
  const res = { status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
  authFehlerAntwort(res, error);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'AUTH_UNAVAILABLE');
});

for (const [path, method, status, normalized] of [
  ['/auth/v1/user', 'GET', 200, false],
  ['/auth/v1/user', 'GET', 401, false],
  ['/auth/v1/user', 'GET', 403, false],
  ['/auth/v1/user', 'GET', 408, true],
  ['/auth/v1/user', 'GET', 429, true],
  ['/auth/v1/user', 'GET', 500, true],
  ['/auth/v1/user', 'GET', 503, true],
  ['/auth/v1/user', 'POST', 500, false],
  ['/rest/v1/profiles', 'GET', 500, false],
]) test(`transport ${method} ${path} ${status}: normalize=${normalized}, headers unchanged`, async () => {
  const previousFetch = globalThis.fetch;
  const input = new URL(path, 'https://synthetic-auth.invalid');
  const options = { method, headers: { Authorization: 'Bearer synthetic-user-token', apikey: 'synthetic-api-key' } };
  const response = new Response('synthetic non-JSON upstream detail', { status });
  try {
    globalThis.fetch = async (actualInput, actualOptions) => {
      assert.equal(actualInput, input);
      assert.equal(actualOptions, options);
      return response;
    };
    const actual = await authTransportFetch(input, options);
    assert.equal(actual.status, status);
    assert.equal(actual === response, !normalized);
    if (normalized) assert.deepEqual(await actual.json(), { message: 'Authentication service unavailable' });
  } finally { globalThis.fetch = previousFetch; }
});

test('transport does not reclassify thrown unknown errors', async () => {
  const previousFetch = globalThis.fetch;
  const error = new Error('synthetic internal failure');
  try {
    globalThis.fetch = async () => { throw error; };
    await assert.rejects(authTransportFetch('https://synthetic-auth.invalid/auth/v1/user'), actual => actual === error);
  } finally { globalThis.fetch = previousFetch; }
});
