import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createConfirmationService } from './ki-rueckfrage.js';

const TEST_TASK = 'b2c-draft';
const TEST_USER = 'user-test-1';
const TEST_TENANT = '44444444-4444-4444-8444-444444444444';

function getTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ki-test-'));
}

test('creates challenge with HMAC and bounded candidates', () => {
  const tempDir = getTempDir();
  const service = createConfirmationService({ secret: Buffer.alloc(32, 7), directory: tempDir });
  const payload = { intent: 'Nachricht an Dr. Müller' };
  const candidates = [
    { id: 'c1', text: 'Dr. Müller', type: 'ANREDE_REST' },
    { id: 'c2', text: '022411234567', type: 'ZIFFERNFOLGE' }
  ];

  const challenge = service.createChallenge({
    task: TEST_TASK,
    userId: TEST_USER,
    tenantId: TEST_TENANT,
    payload,
    candidates
  });

  assert.ok(challenge.challengeId.includes('.'));
  assert.equal(challenge.candidates.length, 2);
  assert.ok(challenge.expiresAt > Date.now());
});

test('successfully verifies confirmation with valid choices', () => {
  const tempDir = getTempDir();
  const service = createConfirmationService({ secret: Buffer.alloc(32, 7), directory: tempDir });
  const payload = { intent: 'Nachricht an Dr. Müller' };
  const candidates = [{ id: 'c1', text: 'Dr. Müller', type: 'ANREDE_REST' }];

  const challenge = service.createChallenge({
    task: TEST_TASK,
    userId: TEST_USER,
    tenantId: TEST_TENANT,
    payload,
    candidates
  });

  const verification = service.verifyConfirmation({
    task: TEST_TASK,
    userId: TEST_USER,
    tenantId: TEST_TENANT,
    payload,
    currentCandidates: candidates,
    kiConfirmation: {
      challengeId: challenge.challengeId,
      choices: [{ id: 'c1', action: 'maskieren' }]
    }
  });

  assert.equal(verification.valid, true);
  assert.deepEqual(verification.choices, [{ id: 'c1', action: 'maskieren' }]);
});

test('payload tampering invalidates confirmation', () => {
  const tempDir = getTempDir();
  const service = createConfirmationService({ secret: Buffer.alloc(32, 7), directory: tempDir });
  const originalPayload = { intent: 'Original Text' };
  const candidates = [{ id: 'c1', text: 'Verdacht', type: 'NAME' }];

  const challenge = service.createChallenge({
    task: TEST_TASK,
    userId: TEST_USER,
    tenantId: TEST_TENANT,
    payload: originalPayload,
    candidates
  });

  const modifiedPayload = { intent: 'Modified Text Attacker' };

  const verification = service.verifyConfirmation({
    task: TEST_TASK,
    userId: TEST_USER,
    tenantId: TEST_TENANT,
    payload: modifiedPayload,
    currentCandidates: candidates,
    kiConfirmation: {
      challengeId: challenge.challengeId,
      choices: [{ id: 'c1', action: 'kein_name' }]
    }
  });

  assert.equal(verification.valid, false);
  assert.equal(verification.code, 'KI_CHALLENGE_TAMPERED');
});

test('replay protection: challenge cannot be reused', () => {
  const tempDir = getTempDir();
  const service = createConfirmationService({ secret: Buffer.alloc(32, 7), directory: tempDir });
  const payload = { intent: 'Replay Test' };
  const candidates = [{ id: 'c1', text: 'Name', type: 'NAME' }];

  const challenge = service.createChallenge({
    task: TEST_TASK,
    userId: TEST_USER,
    tenantId: TEST_TENANT,
    payload,
    candidates
  });

  const confirmation = {
    challengeId: challenge.challengeId,
    choices: [{ id: 'c1', action: 'maskieren' }]
  };

  const first = service.verifyConfirmation({
    task: TEST_TASK,
    userId: TEST_USER,
    tenantId: TEST_TENANT,
    payload,
    currentCandidates: candidates,
    kiConfirmation: confirmation
  });
  assert.equal(first.valid, true);

  const second = service.verifyConfirmation({
    task: TEST_TASK,
    userId: TEST_USER,
    tenantId: TEST_TENANT,
    payload,
    currentCandidates: candidates,
    kiConfirmation: confirmation
  });
  assert.equal(second.valid, false);
  assert.equal(second.code, 'KI_CHALLENGE_REPLAY');
});

test('expired challenge is rejected', () => {
  const tempDir = getTempDir();
  let simulatedTime = 1000;
  const service = createConfirmationService({
    secret: Buffer.alloc(32, 7),
    directory: tempDir,
    ttlMs: 50,
    now: () => simulatedTime
  });

  const payload = { intent: 'Expire Test' };
  const candidates = [{ id: 'c1', text: 'Name', type: 'NAME' }];

  const challenge = service.createChallenge({
    task: TEST_TASK,
    userId: TEST_USER,
    tenantId: TEST_TENANT,
    payload,
    candidates
  });

  simulatedTime = 2000;

  const verification = service.verifyConfirmation({
    task: TEST_TASK,
    userId: TEST_USER,
    tenantId: TEST_TENANT,
    payload,
    currentCandidates: candidates,
    kiConfirmation: {
      challengeId: challenge.challengeId,
      choices: [{ id: 'c1', action: 'maskieren' }]
    }
  });

  assert.equal(verification.valid, false);
  assert.equal(verification.code, 'KI_CHALLENGE_EXPIRED');
});

test('invalid action choice is rejected', () => {
  const tempDir = getTempDir();
  const service = createConfirmationService({ secret: Buffer.alloc(32, 7), directory: tempDir });
  const payload = { intent: 'Test' };
  const candidates = [{ id: 'c1', text: 'Name', type: 'NAME' }];

  const challenge = service.createChallenge({
    task: TEST_TASK,
    userId: TEST_USER,
    tenantId: TEST_TENANT,
    payload,
    candidates
  });

  const verification = service.verifyConfirmation({
    task: TEST_TASK,
    userId: TEST_USER,
    tenantId: TEST_TENANT,
    payload,
    currentCandidates: candidates,
    kiConfirmation: {
      challengeId: challenge.challengeId,
      choices: [{ id: 'c1', action: 'illegal_bypass' }]
    }
  });

  assert.equal(verification.valid, false);
  assert.equal(verification.code, 'KI_CHOICES_INVALID');
});


test('shared secret and directory enforce replay across independent workers', () => {
  const directory = getTempDir(); const opts = { secret: Buffer.alloc(32, 8), directory };
  const one = createConfirmationService(opts); const two = createConfirmationService(opts);
  const args = { task: TEST_TASK, userId: TEST_USER, tenantId: TEST_TENANT, payload: { intent: 'Test' }, candidates: [{ id: 'one', text: 'MaybeName', type: 'FUZZY_NAME_REST' }] };
  const challenge = one.createChallenge(args); const verify = { ...args, currentCandidates: args.candidates, kiConfirmation: { challengeId: challenge.challengeId, choices: [{ id: 'one', action: 'maskieren' }] } };
  assert.equal(two.verifyConfirmation(verify).valid, true);
  assert.equal(one.verifyConfirmation(verify).code, 'KI_CHALLENGE_REPLAY');
  const files = fs.readdirSync(directory); assert.equal(files.length, 1);
  assert.match(files[0], /^\.challenge-[a-f0-9]{64}\.consumed$/);
  const stored = fs.readFileSync(path.join(directory, files[0]), 'utf8'); assert.ok(!stored.includes('MaybeName')); assert.deepEqual(Object.keys(JSON.parse(stored)), ['expiresAt']);
});
test('confirmation rejects duplicate, unknown, subset and malformed expiry without consuming', () => {
  const service = createConfirmationService({ secret: Buffer.alloc(32, 9), directory: getTempDir(), now: () => 1000 });
  const args = { task: TEST_TASK, userId: TEST_USER, tenantId: TEST_TENANT, payload: { intent: 'Test' }, candidates: [{ id: 'one', text: 'NameOne', type: 'NAME' }, { id: 'two', text: 'NameTwo', type: 'NAME' }] };
  const challenge = service.createChallenge(args);
  const verify = choices => service.verifyConfirmation({ ...args, currentCandidates: args.candidates, kiConfirmation: { challengeId: challenge.challengeId, choices } });
  for (const ids of [['one', 'one'], ['one', 'unknown'], ['one']]) assert.equal(verify(ids.map(id => ({ id, action: 'maskieren' }))).code, 'KI_CHOICES_INVALID');
  assert.equal(service.verifyConfirmation({ ...args, currentCandidates: args.candidates, kiConfirmation: { challengeId: challenge.challengeId + 'junk', choices: [] } }).code, 'KI_CHALLENGE_MALFORMED');
  assert.equal(verify(['one', 'two'].map(id => ({ id, action: 'maskieren' }))).valid, true);
});
test('missing key rejects and unsafe replay directory fails closed', () => {
  assert.throws(() => createConfirmationService({ directory: getTempDir() }));
  const directory = getTempDir(); fs.chmodSync(directory, 0o755);
  const service = createConfirmationService({ secret: Buffer.alloc(32, 9), directory });
  assert.throws(() => service.createChallenge({ task: TEST_TASK, userId: TEST_USER, tenantId: TEST_TENANT, payload: {}, candidates: [{ id: 'one', text: 'Name', type: 'NAME' }] }));
});
