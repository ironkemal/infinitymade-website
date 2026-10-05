// § 302 SGB V Abrechnung — Schritt 1.3 D: CMS EnvelopedData Verschlüsselungsanbindung
// Tests für die Verzweigungs- und Fehlerbehandlungslogik in verarbeiteVerschluesselungsSchritt()
// in abrechnung.routes.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Dummy env vars damit supabase createClient beim Import von abrechnung.routes.js nicht stirbt
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

const { verarbeiteVerschluesselungsSchritt } = await import('./abrechnung.routes.js');

const ABRECHNUNG_VERSION_FELDER =
  'id,owner_id,updated_at,status,storage_path,dta_sha256,signed_storage_path,signed_sha256,signed_at,signed_by_cert_thumbprint,encrypted_storage_path,encrypted_sha256,verschluesselt_am,verschluesselt_fuer_fingerprint,verschluesselung_hinweis,zaa_uploaded_at,paid_at,auftragsdatei_path,begleitzettel_path';

import { erzeugeRegistryFake, blobAusUploads } from './artefakt-registry-fake.js';

const DUMMY_SIGNED_BYTES = Buffer.from('30820100synthetic-signed-pkcs7-payload', 'utf8');

function createVorherSnapshot({
  abrechnungId,
  basePath,
  signedBytes = DUMMY_SIGNED_BYTES,
  overrides = {},
}) {
  const ownerId = basePath.split('/')[0];
  const snapshot = {};
  for (const feld of ABRECHNUNG_VERSION_FELDER.split(',')) {
    snapshot[feld] = null;
  }
  return {
    ...snapshot,
    id: abrechnungId,
    owner_id: ownerId,
    updated_at: '2026-09-22T10:00:00.123456Z',
    status: 'erstellt',
    signed_storage_path: `${basePath}.p7m`,
    signed_sha256: crypto.createHash('sha256').update(signedBytes).digest('hex'),
    ...overrides,
  };
}

function createMockDb({
  certRow = null,
  certError = null,
  storageError = null,
  onStorageUpload = null,
  onAbrechnungUpdate = null,
  abrechnungRow = null,
  abrechnungError = null,
} = {}) {
  let currentAbrechnung = abrechnungRow ? { ...abrechnungRow } : null;
  const uploads = [];
  const registry = erzeugeRegistryFake({
    getRow: () => currentAbrechnung,
    setRow: (r) => { currentAbrechnung = r; },
    bumpUpdatedAt: () => '2026-09-22T10:00:01.000000Z',
    hooks: { lenient: true, get failPublish() { return !!abrechnungError; } },
  });

  return {
    rpc: (name, args) => registry.rpc(name, args),
    _getCurrentAbrechnung() {
      return currentAbrechnung;
    },
    from(table) {
      if (table === 'empfaenger_zertifikate') {
        return {
          select(cols) {
            assert.equal(cols, 'zertifikat_der, fingerprint_sha256');
            return {
              eq(col, val) {
                assert.equal(col, 'ik');
                return {
                  async maybeSingle() {
                    if (certError) return { data: null, error: certError };
                    return { data: certRow, error: null };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'abrechnung') {
        return {
          select() {
            const b = { eq() { return b; }, async maybeSingle() { return { data: currentAbrechnung, error: null }; } };
            return b;
          },
          update(patch) {
            const filters = {};
            const builder = {
              eq(col, val) {
                filters[col] = val;
                if (col === 'id' && onAbrechnungUpdate) {
                  onAbrechnungUpdate({ patch, col, val });
                }
                return builder;
              },
              is(col, val) {
                filters[col] = val;
                return builder;
              },
              select(cols) {
                return builder;
              },
              then(resolve) {
                if (abrechnungError) {
                  return resolve({ data: null, error: abrechnungError });
                }

                if (currentAbrechnung) {
                  for (const [col, val] of Object.entries(filters)) {
                    if (currentAbrechnung[col] !== val) {
                      return resolve({ data: [], error: null });
                    }
                  }
                  currentAbrechnung = {
                    ...currentAbrechnung,
                    ...patch,
                    updated_at: '2026-09-22T10:00:01.000000Z',
                  };
                  return resolve({ data: [currentAbrechnung], error: null });
                }

                const row = {
                  ...filters,
                  ...patch,
                  updated_at: '2026-09-22T10:00:01.000000Z',
                };
                return resolve({ data: [row], error: null });
              },
            };
            return builder;
          },
        };
      }
      throw new Error(`Unerwartete Tabelle im Mock: ${table}`);
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, 'abrechnungen');
        return {
          async upload(path, bytes, opts) {
            if (onStorageUpload) onStorageUpload({ path, bytes, opts });
            if (storageError) return { error: storageError };
            uploads.push({ path, bytes });
            return { error: null };
          },
          ...blobAusUploads(uploads),
        };
      },
    },
  };
}

test('Schritt 1.3 D: empfaenger_ik fehlt -> überspringen mit erklärendem Hinweis', async () => {
  const vorher = createVorherSnapshot({
    abrechnungId: 'test-ab-1',
    basePath: 'tenant1/test-ab-1/payload',
  });

  const res = await verarbeiteVerschluesselungsSchritt({
    vorher,
    abrechnungId: 'test-ab-1',
    empfaengerIk: null,
    basePath: 'tenant1/test-ab-1/payload',
    signedBytes: DUMMY_SIGNED_BYTES,
    db: createMockDb(),
  });

  assert.equal(res.verschluesselt, false);
  assert.match(res.verschluesselungHinweis, /fehlt.*Datenannahmestellen-Zuordnung/i);
});

test('Fall A: Kein Empfängerzertifikat in empfaenger_zertifikate hinterlegt -> verschluesselt: false mit Inhaber-Hinweis', async () => {
  const vorher = createVorherSnapshot({
    abrechnungId: 'test-ab-2',
    basePath: 'tenant1/test-ab-2/payload',
  });

  const res = await verarbeiteVerschluesselungsSchritt({
    vorher,
    abrechnungId: 'test-ab-2',
    empfaengerIk: '108310400',
    basePath: 'tenant1/test-ab-2/payload',
    signedBytes: DUMMY_SIGNED_BYTES,
    db: createMockDb({ certRow: null }),
  });

  assert.equal(res.verschluesselt, false);
  assert.match(res.verschluesselungHinweis, /Für die zuständige Datenannahmestelle \(IK 108310400\) liegt noch kein Verschlüsselungszertifikat vor/);
  assert.match(res.verschluesselungHinweis, /Die signierte Datei ist gespeichert/);
});

test('Fall A (Variante): DB-Fehler bei Zertifikatsabfrage -> verschluesselt: false mit Fehlermeldung', async () => {
  const vorher = createVorherSnapshot({
    abrechnungId: 'test-ab-2b',
    basePath: 'tenant1/test-ab-2b/payload',
  });

  const res = await verarbeiteVerschluesselungsSchritt({
    vorher,
    abrechnungId: 'test-ab-2b',
    empfaengerIk: '108310400',
    basePath: 'tenant1/test-ab-2b/payload',
    signedBytes: DUMMY_SIGNED_BYTES,
    db: createMockDb({ certError: new Error('Postgres connection lost') }),
  });

  assert.equal(res.verschluesselt, false);
  assert.match(res.verschluesselungHinweis, /Fehler beim Laden des Empfängerzertifikats: Postgres connection lost/);
});

test('Fall B: Zertifikat vorhanden, aber Trust-Anchors leer -> verschluesselt: false mit Trust-Anchor-Meldung', async () => {
  const vorher = createVorherSnapshot({
    abrechnungId: 'test-ab-3',
    basePath: 'tenant1/test-ab-3/payload',
  });

  const res = await verarbeiteVerschluesselungsSchritt({
    vorher,
    abrechnungId: 'test-ab-3',
    empfaengerIk: '108310400',
    basePath: 'tenant1/test-ab-3/payload',
    signedBytes: DUMMY_SIGNED_BYTES,
    db: createMockDb({ certRow: { zertifikat_der: '\\x308201' } }),
    ladeAnchors: () => ({ anchors: [], meta: null }),
  });

  assert.equal(res.verschluesselt, false);
  assert.match(res.verschluesselungHinweis, /ITSG-Trust-Anchor-Liste ist leer oder nicht vorhanden/);
});

test('Fall B: Zertifikat vorhanden, aber Trust-Anchor abgelaufen (pruefeFrische wirft) -> verschluesselt: false', async () => {
  const vorher = createVorherSnapshot({
    abrechnungId: 'test-ab-4',
    basePath: 'tenant1/test-ab-4/payload',
  });

  const res = await verarbeiteVerschluesselungsSchritt({
    vorher,
    abrechnungId: 'test-ab-4',
    empfaengerIk: '108310400',
    basePath: 'tenant1/test-ab-4/payload',
    signedBytes: DUMMY_SIGNED_BYTES,
    db: createMockDb({ certRow: { zertifikat_der: '\\x308201' } }),
    ladeAnchors: () => ({ anchors: [Buffer.from('3082', 'hex')], meta: { zertifikate: [{ notAfter: '2020-01-01' }] } }),
    pruefeFrische: () => { throw new Error('ITSG-Trust-Anchor ist abgelaufen. Keine Verschlüsselung möglich.'); },
  });

  assert.equal(res.verschluesselt, false);
  assert.match(res.verschluesselungHinweis, /ITSG-Trust-Anchor ist abgelaufen/);
});

test('Fall C (Fehlschlag): Krypto-/V4-Fehler in verschluesseleFuerEmpfaenger -> verschluesselt: false mit Fehlermeldung', async () => {
  const vorher = createVorherSnapshot({
    abrechnungId: 'test-ab-5',
    basePath: 'tenant1/test-ab-5/payload',
  });

  const res = await verarbeiteVerschluesselungsSchritt({
    vorher,
    abrechnungId: 'test-ab-5',
    empfaengerIk: '108310400',
    basePath: 'tenant1/test-ab-5/payload',
    signedBytes: DUMMY_SIGNED_BYTES,
    db: createMockDb({ certRow: { zertifikat_der: '\\x308201' } }),
    ladeAnchors: () => ({ anchors: [Buffer.from('3082', 'hex')], meta: { zertifikate: [{ notAfter: '2030-01-01' }] } }),
    pruefeFrische: () => ({ ok: true, warnung: null }),
    verschluessele: () => { throw new Error('Empfängerzertifikat abgelaufen (V4-Kontrolle 1)'); },
  });

  assert.equal(res.verschluesselt, false);
  assert.match(res.verschluesselungHinweis, /Empfängerzertifikat abgelaufen \(V4-Kontrolle 1\)/);
});

test('Fall C (Fehlschlag): Storage-Upload schlägt fehl -> verschluesselt: false mit Hinweis auf Storage-Fehler', async () => {
  const vorher = createVorherSnapshot({
    abrechnungId: 'test-ab-6',
    basePath: 'tenant1/test-ab-6/payload',
  });

  const res = await verarbeiteVerschluesselungsSchritt({
    vorher,
    abrechnungId: 'test-ab-6',
    empfaengerIk: '108310400',
    basePath: 'tenant1/test-ab-6/payload',
    signedBytes: DUMMY_SIGNED_BYTES,
    db: createMockDb({
      certRow: { zertifikat_der: '\\x308201' },
      storageError: new Error('Bucket storage quota exceeded'),
    }),
    ladeAnchors: () => ({ anchors: [Buffer.from('3082', 'hex')], meta: { zertifikate: [{ notAfter: '2030-01-01' }] } }),
    pruefeFrische: () => ({ ok: true, warnung: null }),
    verschluessele: () => Buffer.from('synthetic-enveloped-bytes'),
  });

  assert.equal(res.verschluesselt, false);
  assert.match(res.verschluesselungHinweis, /Verschlüsselung erfolgreich, Speichern fehlgeschlagen: Bucket storage quota exceeded/);
});

test('Fall C (Erfolg): Voller Erfolg -> verschluesselt: true, encryptedPath und encryptedSha256', async () => {
  let uploadedPath = null;
  let uploadedBytes = null;
  let uploadedOpts = null;

  const syntheticEncrypted = Buffer.from('synthetic-cms-enveloped-data-payload');
  const expectedSha256 = crypto.createHash('sha256').update(syntheticEncrypted).digest('hex');

  const basePath = '123e4567/test-ab-7/ESOL0001.dta';
  const signedPath = `${basePath}.p7m`;

  let persistedPatch = null;

  const vorher = createVorherSnapshot({
    abrechnungId: 'test-ab-7',
    basePath,
  });

  const mockDb = createMockDb({
      certRow: { zertifikat_der: '\\x308201', fingerprint_sha256: 'aa:bb:cc' },
      onStorageUpload: ({ path, bytes, opts }) => {
        uploadedPath = path;
        uploadedBytes = bytes;
        uploadedOpts = opts;
      },
      onAbrechnungUpdate: ({ patch, col, val }) => {
        persistedPatch = patch;
        assert.equal(col, 'id');
        assert.equal(val, 'test-ab-7');
      },
  });
  const res = await verarbeiteVerschluesselungsSchritt({
    vorher,
    abrechnungId: 'test-ab-7',
    empfaengerIk: '108310400',
    basePath,
    signedBytes: DUMMY_SIGNED_BYTES,
    db: mockDb,
    ladeAnchors: () => ({ anchors: [Buffer.from('3082', 'hex')], meta: { zertifikate: [{ notAfter: '2030-01-01' }] } }),
    pruefeFrische: () => ({ ok: true, warnung: null }),
    verschluessele: ({ signedBytes, empfaengerZertifikatDer, erwarteteIk, itsgAnkerZertifikate }) => {
      assert.deepEqual(signedBytes, DUMMY_SIGNED_BYTES);
      assert.equal(erwarteteIk, '108310400');
      assert.equal(itsgAnkerZertifikate.length, 1);
      assert.equal(empfaengerZertifikatDer.toString('hex'), '308201');
      return syntheticEncrypted;
    },
  });

  assert.equal(res.verschluesselt, true);
  assert.match(res.encryptedPath, /^123e4567\/test-ab-7\/versuche\/[0-9a-f-]+\/payload\.dta\.enc\.p7m$/);
  assert.notEqual(res.encryptedPath, signedPath);
  assert.equal(res.encryptedSha256, expectedSha256);
  assert.equal(uploadedPath, res.encryptedPath);
  assert.deepEqual(uploadedBytes, syntheticEncrypted);
  assert.equal(uploadedOpts.contentType, 'application/pkcs7-mime');
  assert.equal(uploadedOpts.upsert, false);

  persistedPatch = mockDb._getCurrentAbrechnung();
  assert.equal(persistedPatch.encrypted_storage_path, res.encryptedPath);
  assert.equal(persistedPatch.encrypted_sha256, expectedSha256);
  assert.ok(persistedPatch.verschluesselt_am);
  assert.equal(persistedPatch.verschluesselt_fuer_fingerprint, 'aa:bb:cc');
  assert.equal(persistedPatch.verschluesselung_hinweis, null);
  assert.equal(res.empfaengerFingerprint, undefined);
});

test('O-131: Fehlschlag löscht alte Verschlüsselungsspalten (kein Stand von einem früheren erfolgreichen Lauf bleibt stehen)', async () => {
  let persistedPatch = null;

  const vorher = createVorherSnapshot({
    abrechnungId: 'test-ab-8',
    basePath: 'tenant1/test-ab-8/ESOL0002.dta',
  });

  const res = await verarbeiteVerschluesselungsSchritt({
    vorher,
    abrechnungId: 'test-ab-8',
    empfaengerIk: '108310400',
    basePath: 'tenant1/test-ab-8/ESOL0002.dta',
    signedBytes: DUMMY_SIGNED_BYTES,
    db: createMockDb({
      certRow: { zertifikat_der: '\\x308201', fingerprint_sha256: 'aa:bb:cc' },
      onAbrechnungUpdate: ({ patch }) => { persistedPatch = patch; },
    }),
    ladeAnchors: () => ({ anchors: [Buffer.from('3082', 'hex')], meta: { zertifikate: [{ notAfter: '2030-01-01' }] } }),
    pruefeFrische: () => ({ ok: true, warnung: null }),
    verschluessele: () => { throw new Error('Empfängerzertifikat abgelaufen (V4-Kontrolle 1)'); },
  });

  assert.equal(res.verschluesselt, false);
  assert.equal(persistedPatch.encrypted_storage_path, null);
  assert.equal(persistedPatch.encrypted_sha256, null);
  assert.equal(persistedPatch.verschluesselt_am, null);
  assert.equal(persistedPatch.verschluesselt_fuer_fingerprint, null);
  assert.match(persistedPatch.verschluesselung_hinweis, /Empfängerzertifikat abgelaufen \(V4-Kontrolle 1\)/);
});

test('O-131-Nachaudit: Verschlüsselung erfolgreich, aber DB-Persistenz schlägt fehl -> Response behauptet NICHT verschluesselt:true', async () => {
  const vorher = createVorherSnapshot({
    abrechnungId: 'test-ab-9',
    basePath: 'tenant1/test-ab-9/ESOL0003.dta',
  });

  const res = await verarbeiteVerschluesselungsSchritt({
    vorher,
    abrechnungId: 'test-ab-9',
    empfaengerIk: '108310400',
    basePath: 'tenant1/test-ab-9/ESOL0003.dta',
    signedBytes: DUMMY_SIGNED_BYTES,
    db: createMockDb({
      certRow: { zertifikat_der: '\\x308201', fingerprint_sha256: 'aa:bb' },
      abrechnungError: new Error('Postgres connection lost during persist'),
    }),
    ladeAnchors: () => ({ anchors: [Buffer.from('3082', 'hex')], meta: { zertifikate: [{ notAfter: '2030-01-01' }] } }),
    pruefeFrische: () => ({ ok: true, warnung: null }),
    verschluessele: () => Buffer.from('synthetic-enveloped-bytes'),
  });

  assert.equal(res.verschluesselt, false);
  assert.match(res.verschluesselungHinweis, /nicht gespeichert werden/);
});

test('Bytea-Konvertierung: Unterstützt Hex mit \\x, Hex ohne \\x und Buffer', async () => {
  const rawBytes = Buffer.from([0x30, 0x82, 0x01, 0x02]);

  for (const variant of [`\\x${rawBytes.toString('hex')}`, rawBytes.toString('hex'), rawBytes]) {
    let capturedDer = null;
    const vorher = createVorherSnapshot({
      abrechnungId: 'test-bytea',
      basePath: 't/ab/payload',
    });
    await verarbeiteVerschluesselungsSchritt({
      vorher,
      abrechnungId: 'test-bytea',
      empfaengerIk: '108310400',
      basePath: 't/ab/payload',
      signedBytes: DUMMY_SIGNED_BYTES,
      db: createMockDb({ certRow: { zertifikat_der: variant } }),
      ladeAnchors: () => ({ anchors: [Buffer.from('30', 'hex')], meta: { zertifikate: [{ notAfter: '2030-01-01' }] } }),
      pruefeFrische: () => ({ ok: true, warnung: null }),
      verschluessele: ({ empfaengerZertifikatDer }) => {
        capturedDer = empfaengerZertifikatDer;
        return Buffer.from('ok');
      },
    });

    assert.deepEqual(capturedDer, rawBytes);
  }
});

test('Äußerer try/catch: Unerwartete Exception wird gefangen und führt nie zu ungehandeltem Wurf', async () => {
  const brokenDb = {
    from() {
      throw new Error('Fatal database driver crash');
    },
  };

  const vorher = createVorherSnapshot({
    abrechnungId: 'test-ab-outer-err',
    basePath: 't/ab/payload',
  });
  const res = await verarbeiteVerschluesselungsSchritt({
    vorher,
    abrechnungId: 'test-ab-outer-err',
    empfaengerIk: '108310400',
    basePath: 't/ab/payload',
    signedBytes: DUMMY_SIGNED_BYTES,
    db: brokenDb,
  });

  assert.equal(res.verschluesselt, false);
  assert.equal(res.verschluesselungHinweis, 'Unerwarteter Fehler bei der Verschlüsselung.');
});

test('Versionskonflikt: Veralteter Snapshot vs. neuerer DB-Stand führt zu 409 und keinem NULL-Reset', async () => {
  const basePath = 'tenant1/test-ab-conflict/ESOL0001.dta';
  const vorher = createVorherSnapshot({
    abrechnungId: 'test-ab-conflict',
    basePath,
    updated_at: '2026-09-22T10:00:00.123456Z',
  });

  const neuererDbStand = {
    ...vorher,
    updated_at: '2026-09-22T10:05:00.000000Z',
  };

  const mockDb = createMockDb({
    abrechnungRow: neuererDbStand,
    certRow: { zertifikat_der: '\\x308201', fingerprint_sha256: 'aa:bb:cc' },
  });

  await assert.rejects(
    async () => {
      await verarbeiteVerschluesselungsSchritt({
        vorher,
        abrechnungId: 'test-ab-conflict',
        empfaengerIk: '108310400',
        basePath,
        signedBytes: DUMMY_SIGNED_BYTES,
        db: mockDb,
        ladeAnchors: () => ({ anchors: [Buffer.from('3082', 'hex')], meta: { zertifikate: [{ notAfter: '2030-01-01' }] } }),
        pruefeFrische: () => ({ ok: true, warnung: null }),
        verschluessele: () => Buffer.from('synthetic-enveloped-bytes'),
      });
    },
    (err) => {
      assert.equal(err.status || err.statusCode, 409);
      assert.equal(err.code, 'ABRECHNUNG_VERSION_CONFLICT');
      return true;
    }
  );

  const unveranderterDbStand = mockDb._getCurrentAbrechnung();
  assert.equal(unveranderterDbStand.updated_at, '2026-09-22T10:05:00.000000Z');
  assert.equal(unveranderterDbStand.signed_storage_path, vorher.signed_storage_path);
  assert.equal(unveranderterDbStand.signed_sha256, vorher.signed_sha256);
});

test('Versionskonflikt: Falsche signedBytes führen zu 409 vor Zertifikatsabfrage oder Storage-Upload', async () => {
  let certAbfrageAufgerufen = false;
  let storageUploadAufgerufen = false;

  const vorher = createVorherSnapshot({
    abrechnungId: 'test-ab-wrong-bytes',
    basePath: 'tenant1/test-ab-wrong-bytes/payload',
  });

  const abweichendeBytes = Buffer.from('manipulated-or-wrong-signed-bytes');

  const mockDb = createMockDb({
    certRow: { zertifikat_der: '\\x308201' },
    onStorageUpload: () => { storageUploadAufgerufen = true; },
  });

  const originalFrom = mockDb.from.bind(mockDb);
  mockDb.from = (table) => {
    if (table === 'empfaenger_zertifikate') {
      certAbfrageAufgerufen = true;
    }
    return originalFrom(table);
  };

  await assert.rejects(
    async () => {
      await verarbeiteVerschluesselungsSchritt({
        vorher,
        abrechnungId: 'test-ab-wrong-bytes',
        empfaengerIk: '108310400',
        basePath: 'tenant1/test-ab-wrong-bytes/payload',
        signedBytes: abweichendeBytes,
        db: mockDb,
      });
    },
    (err) => {
      assert.equal(err.status || err.statusCode, 409);
      assert.equal(err.code, 'ABRECHNUNG_VERSION_CONFLICT');
      return true;
    }
  );

  assert.equal(certAbfrageAufgerufen, false);
  assert.equal(storageUploadAufgerufen, false);
});
