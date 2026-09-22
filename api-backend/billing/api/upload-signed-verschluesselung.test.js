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

function createMockDb({
  certRow = null,
  certError = null,
  storageError = null,
  onStorageUpload = null,
  onAbrechnungUpdate = null,
} = {}) {
  return {
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
        // O-131 (22.09.2026): verarbeiteVerschluesselungsSchritt() schreibt
        // nach JEDEM Lauf die fünf Verschlüsselungsspalten als eine Gruppe.
        return {
          update(patch) {
            return {
              eq(col, val) {
                if (onAbrechnungUpdate) onAbrechnungUpdate({ patch, col, val });
                return Promise.resolve({ error: null });
              },
            };
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
            return { error: null };
          },
        };
      },
    },
  };
}

const DUMMY_SIGNED_BYTES = Buffer.from('30820100synthetic-signed-pkcs7-payload', 'utf8');

test('Schritt 1.3 D: empfaenger_ik fehlt -> überspringen mit erklärendem Hinweis', async () => {
  const res = await verarbeiteVerschluesselungsSchritt({
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
  const res = await verarbeiteVerschluesselungsSchritt({
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
  const res = await verarbeiteVerschluesselungsSchritt({
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
  const res = await verarbeiteVerschluesselungsSchritt({
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
  const res = await verarbeiteVerschluesselungsSchritt({
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
  const res = await verarbeiteVerschluesselungsSchritt({
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
  const res = await verarbeiteVerschluesselungsSchritt({
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

  // basePath entspricht hier bewusst dem echten storage_path-Format
  // (`${dta.filename}.dta`, siehe abrechnung.routes.js dtaPath) — nicht einem
  // Stamm ohne ".dta". Vor O-131 verschleierte ein basePath ohne ".dta" genau
  // die Dateinamenskollision mit dem unverschlüsselten signedPath
  // (`${basePath}.p7m`), die mit einem realistischen basePath aufgetreten wäre.
  const basePath = '123e4567/test-ab-7/ESOL0001.dta';
  const signedPath = `${basePath}.p7m`;

  let persistedPatch = null;

  const res = await verarbeiteVerschluesselungsSchritt({
    abrechnungId: 'test-ab-7',
    empfaengerIk: '108310400',
    basePath,
    signedBytes: DUMMY_SIGNED_BYTES,
    db: createMockDb({
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
    }),
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
  assert.equal(res.encryptedPath, '123e4567/test-ab-7/ESOL0001.dta.enc.p7m');
  // O-131: encryptedPath darf niemals mit dem unverschlüsselten signedPath
  // zusammenfallen — sonst überschreibt der upsert-Upload der verschlüsselten
  // Datei stillschweigend die signierte.
  assert.notEqual(res.encryptedPath, signedPath);
  assert.equal(res.encryptedSha256, expectedSha256);
  assert.equal(uploadedPath, '123e4567/test-ab-7/ESOL0001.dta.enc.p7m');
  assert.deepEqual(uploadedBytes, syntheticEncrypted);
  assert.equal(uploadedOpts.contentType, 'application/pkcs7-mime');
  assert.equal(uploadedOpts.upsert, true);

  // O-131 (db-ustasi 22.09.2026): Erfolg schreibt alle fünf Spalten als eine
  // Gruppe; empfaengerFingerprint ist ein interner Übergabewert für die
  // Persistenz, kein Teil des öffentlichen Rückgabewerts.
  assert.equal(persistedPatch.encrypted_storage_path, '123e4567/test-ab-7/ESOL0001.dta.enc.p7m');
  assert.equal(persistedPatch.encrypted_sha256, expectedSha256);
  assert.ok(persistedPatch.verschluesselt_am);
  assert.equal(persistedPatch.verschluesselt_fuer_fingerprint, 'aa:bb:cc');
  assert.equal(persistedPatch.verschluesselung_hinweis, null);
  assert.equal(res.empfaengerFingerprint, undefined);
});

test('O-131: Fehlschlag löscht alte Verschlüsselungsspalten (kein Stand von einem früheren erfolgreichen Lauf bleibt stehen)', async () => {
  let persistedPatch = null;

  const res = await verarbeiteVerschluesselungsSchritt({
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
  const dbMitKaputterPersistenz = {
    from(table) {
      if (table === 'empfaenger_zertifikate') {
        return {
          select() {
            return { eq() { return { async maybeSingle() { return { data: { zertifikat_der: '\\x308201', fingerprint_sha256: 'aa:bb' }, error: null }; } }; } };
          },
        };
      }
      if (table === 'abrechnung') {
        return { update() { return { eq() { return Promise.resolve({ error: new Error('Postgres connection lost during persist') }); } }; } };
      }
      throw new Error(`Unerwartete Tabelle: ${table}`);
    },
    storage: { from() { return { async upload() { return { error: null }; } }; } },
  };

  const res = await verarbeiteVerschluesselungsSchritt({
    abrechnungId: 'test-ab-9',
    empfaengerIk: '108310400',
    basePath: 'tenant1/test-ab-9/ESOL0003.dta',
    signedBytes: DUMMY_SIGNED_BYTES,
    db: dbMitKaputterPersistenz,
    ladeAnchors: () => ({ anchors: [Buffer.from('3082', 'hex')], meta: { zertifikate: [{ notAfter: '2030-01-01' }] } }),
    pruefeFrische: () => ({ ok: true, warnung: null }),
    verschluessele: () => Buffer.from('synthetic-enveloped-bytes'),
  });

  // Die Verschlüsselung selbst war erfolgreich, aber weil der DB-Schreibversuch
  // scheiterte, MUSS der Response verschluesselt:false melden — sonst denkt das
  // Frontend, die Datei sei da, obwohl in der DB nichts davon steht (O-131-Nachaudit,
  // unabhängige Kaltprüfung 22.09.2026, Befund 3.2.2).
  assert.equal(res.verschluesselt, false);
  assert.match(res.verschluesselungHinweis, /nicht gespeichert werden/);
});

test('Bytea-Konvertierung: Unterstützt Hex mit \\x, Hex ohne \\x und Buffer', async () => {
  const rawBytes = Buffer.from([0x30, 0x82, 0x01, 0x02]);

  for (const variant of [`\\x${rawBytes.toString('hex')}`, rawBytes.toString('hex'), rawBytes]) {
    let capturedDer = null;
    await verarbeiteVerschluesselungsSchritt({
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

  const res = await verarbeiteVerschluesselungsSchritt({
    abrechnungId: 'test-ab-outer-err',
    empfaengerIk: '108310400',
    basePath: 't/ab/payload',
    signedBytes: DUMMY_SIGNED_BYTES,
    db: brokenDb,
  });

  assert.equal(res.verschluesselt, false);
  assert.equal(res.verschluesselungHinweis, 'Unerwarteter Fehler bei der Verschlüsselung.');
});
