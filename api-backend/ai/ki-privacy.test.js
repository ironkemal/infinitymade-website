import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  safeAiError,
  hashRequest,
  KNOWN_AI_CODES,
  GENERIC_AI_ERROR,
  KNOWN_AI_TASKS
} from './ki-privacy.js';

test('safeAiError: maps known KI codes to fixed German messages and statuses', () => {
  for (const [code, expected] of Object.entries(KNOWN_AI_CODES)) {
    const errObj = { code, message: 'RAW_UNSAFE_INTERNAL_DETAIL_LEAK' };
    const safe = safeAiError(errObj);
    assert.equal(safe.code, code);
    assert.equal(safe.message, expected.message);
    assert.equal(safe.status, expected.status);
    assert.ok(!safe.message.includes('RAW_UNSAFE'));
  }
});

test('safeAiError: accepts string codes directly', () => {
  const safe = safeAiError('AI_MODE_AUS');
  assert.equal(safe.code, 'AI_MODE_AUS');
  assert.equal(safe.message, 'KI-Dienst ist deaktiviert');
  assert.equal(safe.status, 503);
});

test('safeAiError: unknown raw provider exceptions map to generic fixed error', () => {
  const providerErr = new Error('Azure OpenAI: 404 Model deployment not found at https://eastus.api.cognitive.microsoft.com/');
  providerErr.cause = 'Sensitive upstream prompt or patient details';
  providerErr.status = 404;

  const safe = safeAiError(providerErr);
  assert.equal(safe.code, GENERIC_AI_ERROR.code);
  assert.equal(safe.message, GENERIC_AI_ERROR.message);
  assert.equal(safe.status, GENERIC_AI_ERROR.status);

  const json = JSON.stringify(safe);
  assert.ok(!json.includes('Azure'));
  assert.ok(!json.includes('eastus'));
  assert.ok(!json.includes('Sensitive'));
});

test('safeAiError: handles null, undefined, primitive and empty inputs safely', () => {
  assert.deepEqual(safeAiError(null), GENERIC_AI_ERROR);
  assert.deepEqual(safeAiError(undefined), GENERIC_AI_ERROR);
  assert.deepEqual(safeAiError(''), GENERIC_AI_ERROR);
  assert.deepEqual(safeAiError(12345), GENERIC_AI_ERROR);
  assert.deepEqual(safeAiError({}), GENERIC_AI_ERROR);
});

test('hashRequest: uses HMAC with random process seed and retains signature', () => {
  const payload = { prompt: 'SYNTHETIC_TEST_PROMPT', model: 'gpt-4o' };

  const hash1 = hashRequest(payload);
  const hash2 = hashRequest(payload);

  assert.equal(typeof hash1, 'string');
  assert.match(hash1, /^[a-f0-9]{64}$/);
  assert.equal(hash1, hash2, 'Hash must be consistent within same process execution');

  // Verify it is NOT raw SHA-256 (no raw content hash)
  const rawSha256 = crypto.createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');

  assert.notEqual(hash1, rawSha256, 'Must not match raw unsalted content hash');
});

test('hashRequest: handles undefined, null, and non-serializable payloads', () => {
  assert.equal(hashRequest(undefined), null);
  assert.equal(hashRequest(null), null);

  const circular = {};
  circular.self = circular;
  assert.equal(hashRequest(circular), null);
});

test('KNOWN_AI_TASKS: contains all required standard tasks', () => {
  assert.ok(KNOWN_AI_TASKS.has('b2c-draft'));
  assert.ok(KNOWN_AI_TASKS.has('rezept-validate'));
  assert.ok(KNOWN_AI_TASKS.has('rezept-ocr'));
  assert.ok(KNOWN_AI_TASKS.has('appointment-confirm-draft'));
  assert.ok(KNOWN_AI_TASKS.has('series-scheduler'));
  assert.ok(KNOWN_AI_TASKS.has('b2b-draft'));
  assert.ok(KNOWN_AI_TASKS.has('rezept-normalize'));
  assert.equal(KNOWN_AI_TASKS.size, 7);
});

test('safeAiError: generic safe fallback preserves 400/401/403/409/502/503 statuses but hides message and uses generic code', () => {
  const err400 = { message: 'Secret', status: 400 };
  const safe400 = safeAiError(err400);
  assert.equal(safe400.code, 'AI_UNAVAILABLE');
  assert.equal(safe400.status, 400);
  assert.equal(safe400.message, GENERIC_AI_ERROR.message);

  const err409 = new Error('Conflict leak');
  err409.status = 409;
  const safe409 = safeAiError(err409);
  assert.equal(safe409.status, 409);
  assert.equal(safe409.message, GENERIC_AI_ERROR.message);
});
