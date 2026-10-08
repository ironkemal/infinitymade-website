import test from 'node:test';
import assert from 'node:assert/strict';

// Set dummy Supabase env vars before dynamically importing auth.js so createClient does not throw on import
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://synthetic-test-project.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'synthetic-dummy-service-role-key';

const { requireAuth, queryTokenErlaubt } = await import('./auth.js');

test('queryTokenErlaubt: only permits GET on whitelisted OAuth paths', () => {
  assert.equal(queryTokenErlaubt({ method: 'GET', path: '/api/gmail/connect' }), true);
  assert.equal(queryTokenErlaubt({ method: 'GET', path: '/api/calendar/google-auth' }), true);
  assert.equal(queryTokenErlaubt({ method: 'POST', path: '/api/gmail/connect' }), false);
  assert.equal(queryTokenErlaubt({ method: 'GET', path: '/api/ai/b2c-draft' }), false);
});

test('requireAuth: safe catch logging logs fixed code AUTH_CHECK_FAILED without leaking raw errors', async () => {
  const originalConsoleError = console.error;
  const loggedErrors = [];
  console.error = (...args) => loggedErrors.push(args.join(' '));

  try {
    // Malformed request where accessing headers throws an error containing sensitive details
    const sensitiveMessage = 'SENSITIVE_INTERNAL_DATABASE_OR_TOKEN_LEAK_SECRET';
    const explosiveReq = {
      get headers() {
        const err = new Error(sensitiveMessage);
        err.cause = 'Sensitive token cause';
        throw err;
      }
    };

    let responseStatus = null;
    let responseJson = null;

    const res = {
      status(s) {
        responseStatus = s;
        return {
          json(j) {
            responseJson = j;
          }
        };
      }
    };

    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await requireAuth(explosiveReq, res, next);

    assert.equal(nextCalled, false);
    assert.equal(responseStatus, 500);
    assert.deepEqual(responseJson, { error: 'Auth check failed' });

    const combinedLogs = loggedErrors.join('\n');
    assert.ok(combinedLogs.includes('[ai/auth] AUTH_CHECK_FAILED'), 'Must log fixed technical code');
    assert.ok(!combinedLogs.includes(sensitiveMessage), 'Must never leak raw error message in logs');
    assert.ok(!combinedLogs.includes('Sensitive token cause'), 'Must never leak cause in logs');
  } finally {
    console.error = originalConsoleError;
  }
});
