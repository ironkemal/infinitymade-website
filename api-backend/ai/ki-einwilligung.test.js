// Tests for ki-einwilligung.js (M4.1 / K4 / Konsey 08.10.2026).
//   node api-backend/ai/ki-einwilligung.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  createOwnerDecisionStore,
  createFakeOwnerDecisionStore,
  getBrowserOptInStatus,
  CURRENT_EINWILLIGUNG_VERSION
} from './ki-einwilligung.js';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const BOX_ID = 'box-test-siegburg-01';

test('owner can set and read opt-in decision atomically', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-optin-test-'));
  try {
    const store = createOwnerDecisionStore({
      directory: tmpDir,
      boxIdProvider: () => BOX_ID
    });

    const auth = { role: 'owner', userId: TENANT_A, tenantId: TENANT_A };
    const setResult = await store.set(auth, { enabled: true });

    assert.equal(setResult.ok, true);
    assert.equal(setResult.enabled, true);
    assert.equal(setResult.boxId, BOX_ID);
    assert.equal(setResult.version, CURRENT_EINWILLIGUNG_VERSION);

    // Read fresh
    const readResult = await store.read(TENANT_A);
    assert.equal(readResult.enabled, true);
    assert.equal(readResult.active, true);
    assert.equal(readResult.boxId, BOX_ID);

    // Verify file mode 0600
    const filePath = path.join(tmpDir, `${TENANT_A}.json`);
    const stat = fs.statSync(filePath);
    assert.equal(stat.mode & 0o777, 0o600);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('employee attempt to set opt-in is rejected with 403', async () => {
  const store = createFakeOwnerDecisionStore({ boxId: BOX_ID });
  const authEmployee = { role: 'employee', userId: 'emp-user-1', tenantId: TENANT_A };

  await assert.rejects(
    async () => store.set(authEmployee, { enabled: true }),
    (err) => {
      assert.equal(err.code, 'KI_OWNER_REQUIRED');
      assert.equal(err.status, 403);
      return true;
    }
  );
});

test('owner with tenant mismatch (userId !== tenantId) is rejected', async () => {
  const store = createFakeOwnerDecisionStore({ boxId: BOX_ID });
  const authMismatch = { role: 'owner', userId: 'user-diff', tenantId: TENANT_A };

  await assert.rejects(
    async () => store.set(authMismatch, { enabled: true }),
    (err) => {
      assert.equal(err.code, 'KI_OWNER_REQUIRED');
      assert.equal(err.status, 403);
      return true;
    }
  );
});

test('missing box identity returns inactive on read and throws on set', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-optin-test-'));
  try {
    const store = createOwnerDecisionStore({
      directory: tmpDir,
      boxIdProvider: () => null // missing box identity
    });

    const readRes = await store.read(TENANT_A);
    assert.equal(readRes.enabled, false);
    assert.equal(readRes.active, false);
    assert.equal(readRes.reason, 'BOX_IDENTITY_MISSING');

    const auth = { role: 'owner', userId: TENANT_A, tenantId: TENANT_A };
    await assert.rejects(
      async () => store.set(auth, { enabled: true }),
      (err) => {
        assert.equal(err.code, 'BOX_IDENTITY_MISSING');
        return true;
      }
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('foreign box record returns inactive (rejects foreign box migration/copy)', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-optin-test-'));
  try {
    const store = createOwnerDecisionStore({
      directory: tmpDir,
      boxIdProvider: () => 'my-box-current'
    });

    // Write file with foreign boxId
    const filePath = path.join(tmpDir, `${TENANT_A}.json`);
    const record = {
      boxId: 'foreign-box-stolen',
      tenantId: TENANT_A,
      actorId: TENANT_A,
      enabled: true,
      informationVersion: CURRENT_EINWILLIGUNG_VERSION,
      decidedAt: new Date().toISOString(),
      version: CURRENT_EINWILLIGUNG_VERSION
    };
    fs.writeFileSync(filePath, JSON.stringify(record), { mode: 0o600 });

    const readRes = await store.read(TENANT_A);
    assert.equal(readRes.enabled, false);
    assert.equal(readRes.active, false);
    assert.equal(readRes.reason, 'FOREIGN_BOX_ID');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('corrupt file or invalid version fails closed to inactive', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-optin-test-'));
  try {
    const store = createOwnerDecisionStore({
      directory: tmpDir,
      boxIdProvider: () => BOX_ID
    });

    const filePath = path.join(tmpDir, `${TENANT_A}.json`);
    fs.writeFileSync(filePath, 'invalid json content {[[', { mode: 0o600 });

    const readRes = await store.read(TENANT_A);
    assert.equal(readRes.enabled, false);
    assert.equal(readRes.active, false);
    assert.equal(readRes.reason, 'READ_ERROR');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('rejects symlinks without following', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-optin-test-'));
  try {
    const store = createOwnerDecisionStore({
      directory: tmpDir,
      boxIdProvider: () => BOX_ID
    });

    const realTarget = path.join(tmpDir, 'real.json');
    fs.writeFileSync(realTarget, JSON.stringify({
      boxId: BOX_ID,
      tenantId: TENANT_A,
      enabled: true,
      version: CURRENT_EINWILLIGUNG_VERSION
    }));

    const symlinkPath = path.join(tmpDir, `${TENANT_A}.json`);
    fs.symlinkSync(realTarget, symlinkPath);

    const readRes = await store.read(TENANT_A);
    assert.equal(readRes.enabled, false);
    assert.equal(readRes.active, false);
    assert.equal(readRes.reason, 'NOT_REGULAR_FILE');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('multiple parallel tenants have isolated state', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-optin-test-'));
  try {
    const store = createOwnerDecisionStore({
      directory: tmpDir,
      boxIdProvider: () => BOX_ID
    });

    await store.set({ role: 'owner', userId: TENANT_A, tenantId: TENANT_A }, { enabled: true });
    await store.set({ role: 'owner', userId: TENANT_B, tenantId: TENANT_B }, { enabled: false });

    const resA = await store.read(TENANT_A);
    const resB = await store.read(TENANT_B);

    assert.equal(resA.enabled, true);
    assert.equal(resB.enabled, false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('browser opt-in status respects operator readiness gate', async () => {
  const store = createFakeOwnerDecisionStore({ defaultEnabled: true, boxId: BOX_ID });

  // When activationReady is false, active is false even if owner enabled = true
  const statusNotReady = await getBrowserOptInStatus(store, TENANT_A, { activationReady: false });
  assert.equal(statusNotReady.enabled, true);
  assert.equal(statusNotReady.active, false);

  // When activationReady is true, active is true
  const statusReady = await getBrowserOptInStatus(store, TENANT_A, { activationReady: true, valid: true, mode: 'direkt' });
  assert.equal(statusReady.enabled, true);
  assert.equal(statusReady.active, true);
});


test('fresh reads reject future timestamps, old information version and oversized record', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-optin-guards-'));
  try {
    const now = () => Date.parse('2026-10-08T10:00:00.000Z');
    const store = createOwnerDecisionStore({ directory, boxIdProvider: () => BOX_ID, now });
    const auth = { role: 'owner', userId: TENANT_A, tenantId: TENANT_A };
    await assert.rejects(store.set(auth, { enabled: true, informationVersion: 'old' }), e => e.code === 'KI_EINWILLIGUNG_INVALID');
    await store.set(auth, { enabled: true });
    const file = path.join(directory, `${TENANT_A}.json`); const record = JSON.parse(fs.readFileSync(file));
    fs.writeFileSync(file, JSON.stringify({ ...record, decidedAt: '2026-10-08T10:00:01.000Z' }));
    assert.equal((await store.read(TENANT_A)).enabled, false);
    fs.writeFileSync(file, JSON.stringify({ ...record, informationVersion: 'old' }));
    assert.equal((await store.read(TENANT_A)).enabled, false);
    fs.writeFileSync(file, ' '.repeat(2049));
    assert.equal((await store.read(TENANT_A)).reason, 'RECORD_TOO_LARGE');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('unsafe existing directory and target symlink reject writes, without changing target', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-optin-writes-'));
  try {
    const store = createOwnerDecisionStore({ directory, boxIdProvider: () => BOX_ID });
    const auth = { role: 'owner', userId: TENANT_A, tenantId: TENANT_A };
    fs.chmodSync(directory, 0o755);
    await assert.rejects(store.set(auth, { enabled: true }));
    fs.chmodSync(directory, 0o700);
    const target = path.join(directory, 'untouched'); fs.writeFileSync(target, 'untouched');
    fs.symlinkSync(target, path.join(directory, `${TENANT_A}.json`));
    await assert.rejects(store.set(auth, { enabled: true }));
    assert.equal(fs.readFileSync(target, 'utf8'), 'untouched');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
