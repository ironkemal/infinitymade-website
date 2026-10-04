import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ABRECHNUNG_VERSION_FELDER,
  pruefeEntwurfsVersion,
  aktualisiereArtefaktVersion,
  artefaktVersuchPfad,
} from './artefakt-version.js';
import {
  bereinigeUnveroeffentlichtenEntwurf,
} from './entwurf-bereinigung.js';

const quietConsole = {
  log: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

class FakeDB {
  constructor(initialRow) {
    this.currentRow = initialRow ? { ...initialRow } : null;
    this.calls = [];
    this.storageCalls = [];
    this.error = null;
    this.forcedResult = null;
    this.versionTick = 1;
    this.storageRemoveResult = { data: [], error: null };
    this.storageRemoveThrows = false;

    const self = this;
    this.storage = {
      from(bucket) {
        self.calls.push({ method: 'storage.from', bucket });
        return {
          remove(pfade) {
            assert.equal(self.currentRow.status, 'verworfen', 'Committed discard precedes deletion');
            self.calls.push({ method: 'storage.remove', pfade: [...pfade] });
            self.storageCalls.push({ bucket, pfade: [...pfade] });
            if (self.storageRemoveThrows) {
              throw new Error('Simulierter Storage-Netzwerkfehler');
            }
            if (self.storageRemoveResult.data && Array.isArray(self.storageRemoveResult.data) && self.storageRemoveResult.data.length === 0) {
              return Promise.resolve({ data: pfade.map((p) => ({ name: p })), error: null });
            }
            return Promise.resolve(self.storageRemoveResult);
          },
        };
      },
    };
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

test('emptylist CAS discarded noStorage', async () => {
  const snapshot = createSnapshot();
  const db = new FakeDB(snapshot);
  const verzeichnis = `${snapshot.owner_id}/2026/10/${snapshot.id}/versuch-001`;

  const result = await bereinigeUnveroeffentlichtenEntwurf({
    db,
    vorher: snapshot,
    pfade: [],
    verzeichnis,
    grund: 'TEST_VERWERFUNG',
  });

  assert.deepEqual(result, { verworfen: true, bereinigt: true });
  assert.equal(db.storageCalls.length, 0, 'storage.remove darf bei leerer Pfadliste niemals aufgerufen werden');
  assert.equal(db.currentRow.status, 'verworfen');
  assert.equal(db.currentRow.verwerfungsgrund, 'TEST_VERWERFUNG');
});

test('success3files afterstatusdiscarded callback', async () => {
  const snapshot = createSnapshot();
  const db = new FakeDB(snapshot);
  const verzeichnis = `${snapshot.owner_id}/2026/10/${snapshot.id}/versuch-002`;
  const pfade = [
    `${verzeichnis}/payload.dta`,
    `${verzeichnis}/payload.auf`,
    `${verzeichnis}/begleitzettel.html`,
  ];

  const result = await bereinigeUnveroeffentlichtenEntwurf({
    db,
    vorher: snapshot,
    pfade,
    verzeichnis,
  });

  assert.deepEqual(result, { verworfen: true, bereinigt: true });
  assert.equal(db.storageCalls.length, 1);
  assert.deepEqual(db.storageCalls[0].pfade, pfade);

  const updateIdx = db.calls.findIndex((c) => c.method === 'update');
  const removeIdx = db.calls.findIndex((c) => c.method === 'storage.remove');
  assert.ok(updateIdx !== -1, 'CAS-Update muss ausgefuehrt worden sein');
  assert.ok(removeIdx !== -1, 'Storage.remove muss ausgefuehrt worden sein');
  assert.ok(updateIdx < removeIdx, 'CAS-Update muss zwingend VOR storage.remove stattfinden');
  assert.equal(db.currentRow.status, 'verworfen');
});

test('exacttimestamp stale409/noRemove', async () => {
  const initialRow = createSnapshot({ updated_at: '2026-10-04 10:49:19.999999' });
  const db = new FakeDB(initialRow);
  const staleSnapshot = createSnapshot({ updated_at: '2026-10-04 10:49:19.111111' });
  const verzeichnis = `${staleSnapshot.owner_id}/2026/10/${staleSnapshot.id}/versuch-003`;
  const pfade = [`${verzeichnis}/payload.dta`];

  await assert.rejects(
    async () => {
      await bereinigeUnveroeffentlichtenEntwurf({
        db,
        vorher: staleSnapshot,
        pfade,
        verzeichnis,
      });
    },
    (err) => {
      assert.equal(err.status || err.statusCode, 409);
      return true;
    }
  );

  assert.equal(db.storageCalls.length, 0, 'Bei 409-Versionskonflikt darf keine Datei geloescht werden');
  assert.equal(db.currentRow.status, 'erstellt', 'Header darf bei CAS-Konflikt nicht ueberschrieben werden');
});

test('signed/published/paid/terminalrejectbeforeDB', async () => {
  const verzeichnis = 'own-001/2026/10/abr-001/versuch-004';
  const pfade = [`${verzeichnis}/payload.dta`];

  const ungueltigeSnapshots = [
    createSnapshot({ storage_path: 'own-001/2026/10/abr-001/v/payload.dta' }),
    createSnapshot({ dta_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
    createSnapshot({ auftragsdatei_path: 'own-001/2026/10/abr-001/v/payload.auf' }),
    createSnapshot({ begleitzettel_path: 'own-001/2026/10/abr-001/v/begleitzettel.html' }),
    createSnapshot({
      signed_storage_path: 'own-001/2026/10/abr-001/v/payload.p7m',
      signed_sha256: 'abc123hash',
    }),
    createSnapshot({
      encrypted_storage_path: 'own-001/2026/10/abr-001/v/payload.enc.p7m',
      encrypted_sha256: 'enc123hash',
    }),
    createSnapshot({ status: 'abgerechnet' }),
    createSnapshot({ status: 'verworfen' }),
    createSnapshot({ status: 'bezahlt' }),
    createSnapshot({ zaa_uploaded_at: '2026-10-04 10:49:19.000000' }),
    createSnapshot({ paid_at: '2026-10-04 10:49:19.000000' }),
  ];

  for (const snap of ungueltigeSnapshots) {
    const db = new FakeDB(snap);
    await assert.rejects(
      async () => {
        await bereinigeUnveroeffentlichtenEntwurf({
          db,
          vorher: snap,
          pfade,
          verzeichnis,
        });
      },
      (err) => {
        assert.equal(err.status || err.statusCode, 409);
        return true;
      }
    );
    assert.equal(db.calls.length, 0, 'Vorabpruefung muss abweisen bevor DB/Storage beruehrt werden');
  }
});

test('wrongowner/headerid/nested/duplicate/4files/traversal/.p7m/.enc/undefinedfields reject', async () => {
  const snapshot = createSnapshot();
  const validDir = `${snapshot.owner_id}/2026/10/${snapshot.id}/versuch-005`;

  const unzulaessigeAufrufe = [
    { verzeichnis: `fremd-owner/2026/10/${snapshot.id}/versuch-005`, pfade: [] },
    { verzeichnis: `${snapshot.owner_id}/2026/10/falsche-abr-id/versuch-005`, pfade: [] },
    { verzeichnis: `${snapshot.owner_id}/${snapshot.id}/../versuch-005`, pfade: [] },
    { verzeichnis: `${snapshot.owner_id}/2026/10/${snapshot.id}/versuch mit leerzeichen`, pfade: [] },
    { verzeichnis: snapshot.owner_id + '\\2026\\10\\' + snapshot.id + '\\versuch-005', pfade: [] },
    { verzeichnis: `${snapshot.owner_id}/2026%2f10/${snapshot.id}/versuch-005`, pfade: [] },
    { verzeichnis: validDir, pfade: [`${validDir}/dup.dta`, `${validDir}/dup.dta`] },
    {
      verzeichnis: validDir,
      pfade: [
        `${validDir}/f1.dta`,
        `${validDir}/f2.auf`,
        `${validDir}/f3.html`,
        `${validDir}/f4.dta`,
      ],
    },
    { verzeichnis: validDir, pfade: [`${validDir}/../geheim.dta`] },
    { verzeichnis: validDir, pfade: [`${validDir}/payload.p7m`] },
    { verzeichnis: validDir, pfade: [`${validDir}/payload.dta.enc`] },
    { verzeichnis: validDir, pfade: [`${validDir}/malware.exe`] },
    { verzeichnis: validDir, pfade: [`${validDir}/payload.txt`] },
    { verzeichnis: validDir, pfade: [`${validDir}/ESOL01`] },
    { verzeichnis: validDir, pfade: [`${validDir}/payload.dta`], grund: 'ungueltig mit kleinbuchstaben' },
  ];

  for (const params of unzulaessigeAufrufe) {
    const db = new FakeDB(snapshot);
    await assert.rejects(
      async () => {
        await bereinigeUnveroeffentlichtenEntwurf({
          db,
          vorher: snapshot,
          ...params,
        });
      },
      (err) => {
        assert.equal(err.status || err.statusCode, 409);
        return true;
      }
    );
    assert.equal(db.calls.length, 0, 'Fehlerhafte Pfade oder Parameter muessen vor DB-Aufruf abgelehnt werden');
  }

  const undefinedSnapshot = createSnapshot();
  delete undefinedSnapshot.dta_sha256;
  const dbUndef = new FakeDB(undefinedSnapshot);
  await assert.rejects(
    async () => {
      await bereinigeUnveroeffentlichtenEntwurf({
        db: dbUndef,
        vorher: undefinedSnapshot,
        pfade: [],
        verzeichnis: validDir,
      });
    },
    (err) => {
      assert.equal(err.status || err.statusCode, 409);
      return true;
    }
  );
  assert.equal(dbUndef.calls.length, 0);
});

test('failed/throw/undefined Storage returnfalse andheaderpreserved', async () => {
  const snapshot = createSnapshot();
  const verzeichnis = `${snapshot.owner_id}/2026/10/${snapshot.id}/versuch-006`;
  const pfade = [`${verzeichnis}/payload.dta`];

  {
    const dbError = new FakeDB(snapshot);
    dbError.storageRemoveResult = { data: null, error: { message: 'Storage S3 Error 503' } };
    const res = await bereinigeUnveroeffentlichtenEntwurf({
      db: dbError,
      vorher: snapshot,
      pfade,
      verzeichnis,
    });
    assert.deepEqual(res, { verworfen: true, bereinigt: false });
    assert.equal(dbError.currentRow.status, 'verworfen', 'Header muss trotz Storage-Fehler als verworfen markiert bleiben');
  }

  {
    const dbThrow = new FakeDB(snapshot);
    dbThrow.storageRemoveThrows = true;
    const res = await bereinigeUnveroeffentlichtenEntwurf({
      db: dbThrow,
      vorher: snapshot,
      pfade,
      verzeichnis,
    });
    assert.deepEqual(res, { verworfen: true, bereinigt: false });
    assert.equal(dbThrow.currentRow.status, 'verworfen');
  }

  {
    const dbUndef = new FakeDB(snapshot);
    dbUndef.storageRemoveResult = { data: undefined, error: null };
    const res = await bereinigeUnveroeffentlichtenEntwurf({
      db: dbUndef,
      vorher: snapshot,
      pfade,
      verzeichnis,
    });
    assert.deepEqual(res, { verworfen: true, bereinigt: false });
    assert.equal(dbUndef.currentRow.status, 'verworfen');
  }
});

test('counter/headerfields preserved', async () => {
  const snapshot = createSnapshot({
    rechnungsnummer: 'RE-2026-9999',
    total_eur: '1234.56',
    zuzahlung_total: '100.00',
    prescription_count: 7,
    dta_file_size: 4096,
    dta_segment_count: 24,
    kostentraeger_ik: '109999999',
    dateiname: 'TK9999',
  });
  const db = new FakeDB(snapshot);
  const verzeichnis = `${snapshot.owner_id}/2026/10/${snapshot.id}/versuch-007`;

  const res = await bereinigeUnveroeffentlichtenEntwurf({
    db,
    vorher: snapshot,
    pfade: [],
    verzeichnis,
    grund: 'BERECHNUNGS_ABBRUCH',
  });

  assert.deepEqual(res, { verworfen: true, bereinigt: true });
  assert.equal(db.currentRow.status, 'verworfen');
  assert.equal(db.currentRow.verwerfungsgrund, 'BERECHNUNGS_ABBRUCH');
  assert.equal(db.currentRow.rechnungsnummer, 'RE-2026-9999');
  assert.equal(db.currentRow.total_eur, '1234.56');
  assert.equal(db.currentRow.zuzahlung_total, '100.00');
  assert.equal(db.currentRow.prescription_count, 7);
  assert.equal(db.currentRow.dta_file_size, 4096);
  assert.equal(db.currentRow.dta_segment_count, 24);
  assert.equal(db.currentRow.kostentraeger_ik, '109999999');
  assert.equal(db.currentRow.dateiname, 'TK9999');
});

test('DBfailurebeforeRemove', async () => {
  const snapshot = createSnapshot();
  const db = new FakeDB(snapshot);
  db.error = { message: 'Supabase Verbindung abgebrochen' };
  const verzeichnis = `${snapshot.owner_id}/2026/10/${snapshot.id}/versuch-008`;
  const pfade = [`${verzeichnis}/payload.dta`];

  await assert.rejects(
    async () => {
      await bereinigeUnveroeffentlichtenEntwurf({
        db,
        vorher: snapshot,
        pfade,
        verzeichnis,
      });
    },
    (err) => {
      assert.equal(err.code, 'ARTEFAKT_PERSISTENZ_FEHLER');
      return true;
    }
  );

  assert.equal(db.storageCalls.length, 0, 'Storage.remove darf bei DB-Ausfall niemals gerufen werden');
});
