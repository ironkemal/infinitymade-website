import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ABRECHNUNG_VERSION_FELDER,
  pruefeEntwurfsVersion,
  aktualisiereArtefaktVersion,
  artefaktVersuchPfad,
} from './artefakt-version.js';

class FakeDB {
  constructor(initialRow) {
    this.currentRow = initialRow ? { ...initialRow } : null;
    this.calls = [];
    this.error = null;
    this.forcedResult = null;
    this.versionTick = 1;
  }

  from(table) {
    this.calls.push({ method: 'from', table });
    const self = this;
    let updatePatch = null;
    const filters = [];
    let selectFields = null;

    const builder = {
      update(patch) {
        self.calls.push({ method: 'update', patch });
        updatePatch = patch;
        return builder;
      },
      eq(col, val) {
        self.calls.push({ method: 'eq', col, val });
        filters.push({ type: 'eq', col, val });
        return builder;
      },
      is(col, val) {
        self.calls.push({ method: 'is', col, val });
        filters.push({ type: 'is', col, val });
        return builder;
      },
      select(fields) {
        self.calls.push({ method: 'select', fields });
        selectFields = fields;
        return builder;
      },
      then(onFulfilled, onRejected) {
        const promise = (async () => {
          await Promise.resolve();
          if (self.error) return { data: null, error: self.error };
          if (self.forcedResult !== null) return { data: self.forcedResult, error: null };
          if (!self.currentRow) return { data: [], error: null };

          for (const f of filters) {
            if (f.type === 'eq' && self.currentRow[f.col] !== f.val) return { data: [], error: null };
            if (f.type === 'is' && self.currentRow[f.col] !== f.val) return { data: [], error: null };
          }

          self.currentRow = {
            ...self.currentRow,
            ...updatePatch,
            updated_at: `2026-10-04 10:49:19.${String(self.versionTick++).padStart(6, '0')}`,
          };
          return { data: [{ ...self.currentRow }], error: null };
        })();
        return promise.then(onFulfilled, onRejected);
      },
    };
    return builder;
  }
}

function createSnapshot(overrides = {}) {
  const fields = ABRECHNUNG_VERSION_FELDER.split(',').map((f) => f.trim());
  const base = Object.fromEntries(fields.map((f) => [f, null]));
  return {
    ...base,
    id: 'abr-001',
    owner_id: 'own-001',
    updated_at: '2026-10-04 10:49:19.123456',
    status: 'erstellt',
    ...overrides,
  };
}

test('successful CAS returns advanced version and matches query filters', async () => {
  const snapshot = createSnapshot();
  const db = new FakeDB(snapshot);
  const patch = { status: 'heruntergeladen' };

  const result = await aktualisiereArtefaktVersion({ db, vorher: snapshot, patch });

  assert.strictEqual(result.status, 'heruntergeladen');
  assert.notStrictEqual(result.updated_at, snapshot.updated_at);

  const eqUpdatedAt = db.calls.find((c) => c.method === 'eq' && c.col === 'updated_at');
  assert.ok(eqUpdatedAt, 'expected .eq for updated_at');
  assert.strictEqual(eqUpdatedAt.val, snapshot.updated_at);

  const isSigned = db.calls.find((c) => c.method === 'is' && c.col === 'signed_storage_path');
  assert.ok(isSigned, 'expected .is for null field signed_storage_path');
  assert.strictEqual(isSigned.val, null);

  const selectCall = db.calls.find((c) => c.method === 'select');
  assert.strictEqual(selectCall?.fields, ABRECHNUNG_VERSION_FELDER);
});

test('two concurrent operations with same before result in exact one winner and other 409', async () => {
  const snapshot = createSnapshot();
  const db = new FakeDB(snapshot);

  const op1 = aktualisiereArtefaktVersion({
    db,
    vorher: snapshot,
    patch: { status: 'heruntergeladen' },
  });
  const op2 = aktualisiereArtefaktVersion({
    db,
    vorher: snapshot,
    patch: { status: 'heruntergeladen' },
  });

  const [res1, res2] = await Promise.allSettled([op1, op2]);
  const fulfilled = [res1, res2].filter((r) => r.status === 'fulfilled');
  const rejected = [res1, res2].filter((r) => r.status === 'rejected');

  assert.strictEqual(fulfilled.length, 1);
  assert.strictEqual(rejected.length, 1);

  const err = rejected[0].reason;
  assert.strictEqual(err.status ?? err.statusCode, 409);
  assert.strictEqual(err.code, 'ABRECHNUNG_VERSION_CONFLICT');
});

test('stale status, signaturepath, hash, and encgroup individually yield 409', async () => {
  const cases = [
    {
      vorher: createSnapshot({ status: 'erstellt' }),
      current: createSnapshot({ status: 'heruntergeladen' }),
    },
    {
      vorher: createSnapshot({
        signed_storage_path: 'sig/1.p7m',
        signed_sha256: 'a'.repeat(64),
      }),
      current: createSnapshot({
        signed_storage_path: 'sig/2.p7m',
        signed_sha256: 'a'.repeat(64),
      }),
    },
    {
      vorher: createSnapshot({ dta_sha256: '1'.repeat(64) }),
      current: createSnapshot({ dta_sha256: '2'.repeat(64) }),
    },
    {
      vorher: createSnapshot({ encrypted_storage_path: null }),
      current: createSnapshot({
        encrypted_storage_path: 'enc/1',
        encrypted_sha256: 'e'.repeat(64),
        verschluesselt_am: '2026-10-04 10:00:00.000000',
        verschluesselt_fuer_fingerprint: 'fp-1',
      }),
    },
  ];

  for (const c of cases) {
    const db = new FakeDB(c.current);
    await assert.rejects(
      aktualisiereArtefaktVersion({ db, vorher: c.vorher, patch: { status: 'heruntergeladen' } }),
      (err) => (err.status ?? err.statusCode) === 409 && err.code === 'ABRECHNUNG_VERSION_CONFLICT'
    );
  }

  assert.throws(
    () => pruefeEntwurfsVersion(createSnapshot({ signed_storage_path: 'sig/1.p7m', signed_sha256: null })),
    (err) => (err.status ?? err.statusCode) === 409 && err.code === 'ABRECHNUNG_VERSION_CONFLICT'
  );
});

test('missing snapshot field or updated_at rejects BEFORE DB updates', async () => {
  const missingFieldSnap = createSnapshot();
  delete missingFieldSnap.status;

  const missingUpdatedSnap = createSnapshot();
  delete missingUpdatedSnap.updated_at;

  const emptyUpdatedSnap = createSnapshot({ updated_at: '' });

  for (const badSnap of [missingFieldSnap, missingUpdatedSnap, emptyUpdatedSnap]) {
    const db = new FakeDB(createSnapshot());
    await assert.rejects(
      aktualisiereArtefaktVersion({ db, vorher: badSnap, patch: { status: 'heruntergeladen' } }),
      (err) => (err.status ?? err.statusCode) === 409 && err.code === 'ABRECHNUNG_VERSION_CONFLICT'
    );
    assert.strictEqual(db.calls.length, 0, 'DB must not be called when snapshot is invalid');
  }
});

test('terminal status or completed workflow rejects with 409', async () => {
  const terminalCases = [
    createSnapshot({ status: 'gesendet' }),
    createSnapshot({ status: 'verworfen' }),
    createSnapshot({ status: 'abgelehnt' }),
    createSnapshot({ zaa_uploaded_at: '2026-10-04 10:00:00.000000' }),
    createSnapshot({ paid_at: '2026-10-04 10:00:00.000000' }),
  ];

  for (const snap of terminalCases) {
    assert.throws(
      () => pruefeEntwurfsVersion(snap),
      (err) => (err.status ?? err.statusCode) === 409 && err.code === 'ABRECHNUNG_VERSION_CONFLICT'
    );

    const db = new FakeDB(snap);
    await assert.rejects(
      aktualisiereArtefaktVersion({ db, vorher: snap, patch: {} }),
      (err) => (err.status ?? err.statusCode) === 409 && err.code === 'ABRECHNUNG_VERSION_CONFLICT'
    );
    assert.strictEqual(db.calls.length, 0);
  }
});

test('DB error throws 500 with ARTEFAKT_PERSISTENZ_FEHLER', async () => {
  const snap = createSnapshot();
  const db = new FakeDB(snap);
  db.error = new Error('Database connection failed');

  await assert.rejects(
    aktualisiereArtefaktVersion({ db, vorher: snap, patch: { status: 'heruntergeladen' } }),
    (err) => (err.status ?? err.statusCode) === 500 && err.code === 'ARTEFAKT_PERSISTENZ_FEHLER'
  );
});

test('zero, multiple, or malformed returned rows fail closed', async () => {
  const snap = createSnapshot();

  const dbZero = new FakeDB(snap);
  dbZero.forcedResult = [];
  await assert.rejects(
    aktualisiereArtefaktVersion({ db: dbZero, vorher: snap, patch: { status: 'heruntergeladen' } }),
    (err) => (err.status ?? err.statusCode) === 409 && err.code === 'ABRECHNUNG_VERSION_CONFLICT'
  );

  const dbMultiple = new FakeDB(snap);
  dbMultiple.forcedResult = [snap, snap];
  await assert.rejects(
    aktualisiereArtefaktVersion({ db: dbMultiple, vorher: snap, patch: { status: 'heruntergeladen' } }),
    (err) => (err.status ?? err.statusCode) === 409 && err.code === 'ABRECHNUNG_VERSION_CONFLICT'
  );

  const dbMalformed = new FakeDB(snap);
  dbMalformed.forcedResult = [{ id: snap.id, status: 'heruntergeladen' }];
  await assert.rejects(
    aktualisiereArtefaktVersion({ db: dbMalformed, vorher: snap, patch: { status: 'heruntergeladen' } }),
    (err) => (err.status ?? err.statusCode) === 500 && err.code === 'ARTEFAKT_PERSISTENZ_FEHLER'
  );
});

test('artefaktVersuchPfad produces unique collision-free paths and rejects path traversal', () => {
  const paths = new Set();
  for (let i = 0; i < 50; i++) {
    const p = artefaktVersuchPfad({ ownerId: 'own-001', abrechnungId: 'abr-001', kind: 'unsigned' });
    assert.match(p, /^own-001\/abr-001\/versuche\/[0-9a-f-]+\/payload\.dta$/);
    paths.add(p);
  }
  assert.strictEqual(paths.size, 50);

  const signedPath = artefaktVersuchPfad({ ownerId: 'own-001', abrechnungId: 'abr-001', kind: 'signed' });
  assert.ok(signedPath.endsWith('/payload.p7m'));

  const encPath = artefaktVersuchPfad({ ownerId: 'own-001', abrechnungId: 'abr-001', kind: 'encrypted' });
  assert.ok(encPath.endsWith('/payload.dta.enc.p7m'));

  assert.throws(() => artefaktVersuchPfad({ ownerId: 'own-001', abrechnungId: 'abr-001', kind: 'invalid' }));

  const unsafeInputs = [
    { ownerId: '../evil', abrechnungId: 'abr-001' },
    { ownerId: 'own-001', abrechnungId: 'abr/nested' },
    { ownerId: 'own\\bad', abrechnungId: 'abr-001' },
    { ownerId: 'own%20bad', abrechnungId: 'abr-001' },
    { ownerId: 'own 001', abrechnungId: 'abr-001' },
    { ownerId: '', abrechnungId: 'abr-001' },
    { ownerId: 'own-001', abrechnungId: '' },
  ];

  for (const input of unsafeInputs) {
    assert.throws(() => artefaktVersuchPfad({ ...input, kind: 'unsigned' }));
  }
});

test('old version cannot clear newer encryption state', async () => {
  const encGroup = {
    encrypted_storage_path: 'own-001/abr-001/versuche/uuid/payload.dta.enc.p7m',
    encrypted_sha256: 'e'.repeat(64),
    verschluesselt_am: '2026-10-04 10:49:19.123456',
    verschluesselt_fuer_fingerprint: 'fp-123456',
  };

  const db = new FakeDB(createSnapshot(encGroup));
  const oldVorher = createSnapshot({ encrypted_storage_path: null });

  await assert.rejects(
    aktualisiereArtefaktVersion({
      db,
      vorher: oldVorher,
      patch: { encrypted_storage_path: null, encrypted_sha256: null },
    }),
    (err) => (err.status ?? err.statusCode) === 409 && err.code === 'ABRECHNUNG_VERSION_CONFLICT'
  );

  assert.strictEqual(db.currentRow.encrypted_storage_path, encGroup.encrypted_storage_path);
  assert.strictEqual(db.currentRow.encrypted_sha256, encGroup.encrypted_sha256);
});