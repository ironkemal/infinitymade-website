import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER_TENANT = '22222222-2222-4222-8222-222222222222';
const childSource = `
import { createOwnerDecisionStore } from ${JSON.stringify(new URL('./ki-einwilligung.js', import.meta.url).href)};
import { createConfirmationService } from ${JSON.stringify(new URL('./ki-rueckfrage.js', import.meta.url).href)};
import crypto from 'node:crypto';
let store, confirmation;
process.on('message', async ({ id, op, config, args }) => {
  try {
    let value;
    if (op === 'init') {
      store = createOwnerDecisionStore({ directory: config.directory, boxIdProvider: () => config.boxId });
      const secret = crypto.createHmac('sha256', Buffer.from(config.pkcs8, 'base64'))
        .update('ki-rueckfrage-secret-domain-separation').digest();
      confirmation = createConfirmationService({ secret, directory: config.directory });
      value = { ready: true };
    } else if (op === 'read') value = await store.read(args.tenantId);
    else if (op === 'set') value = await store.set(args.auth, args.decision);
    else if (op === 'challenge') value = confirmation.createChallenge(args);
    else if (op === 'verify') value = confirmation.verifyConfirmation(args);
    else throw new Error('Unknown worker operation');
    process.send({ id, value });
  } catch (error) { process.send({ id, error: { code: error.code || 'WORKER_FAILED' } }); }
});
`;

async function worker(config) {
  const child = spawn(process.execPath, ['--input-type=module', '-e', childSource], {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });
  let nextId = 0;
  const pending = new Map();
  let diagnostics = '';
  child.stderr.on('data', data => { diagnostics = (diagnostics + data).slice(-2048); });
  child.on('message', ({ id, value, error }) => {
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    if (error) request.reject(new Error(error.code));
    else request.resolve(value);
  });
  child.on('exit', code => {
    for (const request of pending.values()) request.reject(new Error(`Worker exited (${code}): ${diagnostics}`));
    pending.clear();
  });
  function call(op, args) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      child.send({ id, op, args, ...(op === 'init' ? { config } : {}) }, error => {
        if (error) { pending.delete(id); reject(error); }
      });
    });
  }
  async function close() {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill();
    await exited;
  }
  try { assert.deepEqual(await call('init'), { ready: true }); }
  catch (error) { await close(); throw error; }
  return { call, close, pid: child.pid };
}

async function withWorkers(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'praxura-m4-process-'));
  fs.chmodSync(directory, 0o700);
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  const config = {
    directory, boxId: 'synthetic-m4-process-box',
    pkcs8: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')
  };
  const workers = [];
  try {
    workers.push(await worker(config), await worker(config));
    assert.notEqual(workers[0].pid, workers[1].pid);
    await run(workers, directory, config);
  } finally {
    await Promise.all(workers.map(child => child.close()));
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function ownerDecision(enabled, tenantId = TENANT) {
  return { auth: { role: 'owner', userId: tenantId, tenantId }, decision: { enabled } };
}

test('two live processes see owner opt-in and revocation without restarting or cache refresh', { timeout: 15_000 }, async () => {
  await withWorkers(async ([first, second], directory) => {
    assert.equal((await second.call('read', { tenantId: TENANT })).enabled, false);
    await first.call('set', ownerDecision(true));
    assert.equal((await second.call('read', { tenantId: TENANT })).enabled, true);
    await first.call('set', ownerDecision(false));
    assert.equal((await second.call('read', { tenantId: TENANT })).enabled, false);
    await second.call('set', ownerDecision(true));
    assert.equal((await first.call('read', { tenantId: TENANT })).enabled, true);
    assert.equal((await first.call('read', { tenantId: OTHER_TENANT })).enabled, false);
    const recordPath = path.join(directory, `${TENANT}.json`);
    assert.equal(fs.statSync(recordPath).mode & 0o777, 0o600);
    assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(recordPath))).sort(), [
      'actorId', 'boxId', 'decidedAt', 'enabled', 'informationVersion', 'tenantId', 'version'
    ]);
  });
});

test('two processes derive same identity key: one concurrent confirmation wins, restart cannot replay', { timeout: 15_000 }, async () => {
  await withWorkers(async (workers, directory, config) => {
    const [first, second] = workers;
    const context = {
      task: 'b2c-draft', userId: TENANT, tenantId: TENANT,
      payload: { prompt: 'Synthetische Reststelle QZTEST' },
      candidates: [{ id: 'candidate-1', text: 'QZTEST', type: 'NAME' }]
    };
    const challenge = await first.call('challenge', context);
    const verification = {
      ...context, currentCandidates: context.candidates,
      kiConfirmation: {
        challengeId: challenge.challengeId,
        choices: [{ id: 'candidate-1', action: 'maskieren' }]
      }
    };
    const results = await Promise.all([first.call('verify', verification), second.call('verify', verification)]);
    assert.equal(results.filter(result => result.valid === true).length, 1);
    assert.equal(results.filter(result => result.code === 'KI_CHALLENGE_REPLAY').length, 1);
    const markers = fs.readdirSync(directory);
    assert.equal(markers.length, 1);
    const marker = path.join(directory, markers[0]);
    assert.match(markers[0], /^\.challenge-[a-f0-9]{64}\.consumed$/);
    assert.equal(fs.statSync(marker).mode & 0o777, 0o600);
    const metadata = JSON.parse(fs.readFileSync(marker));
    assert.deepEqual(Object.keys(metadata), ['expiresAt']);
    assert.equal(metadata.expiresAt, challenge.expiresAt);
    await second.close();
    const restarted = await worker(config);
    workers.push(restarted);
    assert.notEqual(restarted.pid, second.pid);
    assert.equal((await restarted.call('verify', verification)).code, 'KI_CHALLENGE_REPLAY');
  });
});

test('cross-process confirmation rejects changed tenant or payload, untouched challenge still succeeds', { timeout: 15_000 }, async () => {
  await withWorkers(async ([first, second]) => {
    const context = {
      task: 'b2c-draft', userId: TENANT, tenantId: TENANT,
      payload: { prompt: 'Synthetische Reststelle QZTEST' },
      candidates: [{ id: 'candidate-1', text: 'QZTEST', type: 'NAME' }]
    };
    const challenge = await first.call('challenge', context);
    const verification = {
      ...context, currentCandidates: context.candidates,
      kiConfirmation: { challengeId: challenge.challengeId, choices: [{ id: 'candidate-1', action: 'maskieren' }] }
    };
    assert.equal((await second.call('verify', { ...verification, tenantId: OTHER_TENANT })).code, 'KI_CHALLENGE_TAMPERED');
    assert.equal((await second.call('verify', { ...verification, payload: { prompt: 'Geänderter synthetischer Text' } })).code, 'KI_CHALLENGE_TAMPERED');
    assert.equal((await second.call('verify', verification)).valid, true);
  });
});
