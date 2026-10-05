import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import forge from 'node-forge';

import {
  ABRECHNUNG_VERSION_FELDER,
  pruefeEntwurfsVersion,
  aktualisiereArtefaktVersion,
  artefaktVersuchPfad,
} from './artefakt-version.js';
import { pruefeSignedDta } from '../dta/signed-original.js';
import { reserviereUndLadeHoch, veroeffentliche } from './artefakt-registry.js';
import { erzeugeRegistryFake, blobAusUploads } from './artefakt-registry-fake.js';

// --- Synthetic RSA2048 + CMS Generator (No Live / CA Trust Claim) ---
const { privateKey: privPem, publicKey: pubPem } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const privKey = forge.pki.privateKeyFromPem(privPem);
const pubKey = forge.pki.publicKeyFromPem(pubPem);

const synthCert = forge.pki.createCertificate();
synthCert.publicKey = pubKey;
synthCert.serialNumber = '01';
synthCert.validity.notBefore = new Date();
synthCert.validity.notAfter = new Date(Date.now() + 86400000);
const synthAttrs = [{ name: 'commonName', value: 'Synthetic Test Only - No CA Trust' }];
synthCert.setSubject(synthAttrs);
synthCert.setIssuer(synthAttrs);
synthCert.sign(privKey, forge.md.sha256.create());

const certDerBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(synthCert)).getBytes();
const certThumbprint = crypto.createHash('sha256').update(Buffer.from(certDerBytes, 'binary')).digest('hex');

function createSignedCms(rawPayload) {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(rawPayload.toString('binary'));
  p7.addCertificate(synthCert);
  p7.addSigner({
    key: privKey,
    certificate: synthCert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign();
  return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary');
}

// --- Extract Route Handlers from on-disk abrechnung.routes.js ---
const routesSrc = fs.readFileSync(new URL('./abrechnung.routes.js', import.meta.url), 'utf8');
const uploadMatch = routesSrc.match(/router\.post\('\/abrechnung\/:id\/upload-signed'[\s\S]*?\n\}\);/);
const markSentMatch = routesSrc.match(/router\.post\('\/abrechnung\/:id\/mark-sent'[\s\S]*?\n\}\);/);
if (!uploadMatch || !markSentMatch) throw new Error('Routes not found in on-disk file');
const extractedRoutesCode = `${uploadMatch[0]}\n${markSentMatch[0]}`;

// --- Test Fixtures & Shared Atomic Fake DB ---
const RAW_DTA = Buffer.from('TEST-DTA-DATA-LINE-1\nTEST-DTA-DATA-LINE-2');
const DTA_HASH = crypto.createHash('sha256').update(RAW_DTA).digest('hex');
const SIGNED_CMS_BYTES = createSignedCms(RAW_DTA);
const SIGNED_BASE64 = SIGNED_CMS_BYTES.toString('base64');

function makeInitialRow(overrides = {}) {
  return {
    id: 'ab-123',
    owner_id: 'owner-tenant-1',
    updated_at: '2026-10-04T10:00:00.123456Z',
    status: 'erstellt',
    storage_path: 'owner-tenant-1/ab-123/payload.dta',
    dta_sha256: DTA_HASH,
    signed_storage_path: null,
    signed_sha256: null,
    signed_at: null,
    signed_by_cert_thumbprint: null,
    encrypted_storage_path: null,
    encrypted_sha256: null,
    verschluesselt_am: null,
    verschluesselt_fuer_fingerprint: null,
    verschluesselung_hinweis: null,
    zaa_uploaded_at: null,
    paid_at: null,
    auftragsdatei_path: null,
    begleitzettel_path: null,
    empfaenger_ik: '109999999',
    kostentraeger_ik: '108888888',
    created_at: '2026-10-04T09:00:00.000000Z',
    datenaustauschreferenz: 17, transfernummer: 7, rechnungsnummer: 'SYNTHETIC-17',
    ...overrides,
  };
}

function createFakeDb(initialRow) {
  let currentRow = initialRow ? { ...initialRow } : null;
  let microCounter = 100000;
  const storageUploads = [];
  const certUpserts = [];
  let failDbUpdate = false;
  let beforeUpdateHook = null;

  const registry = erzeugeRegistryFake({
    getRow: () => currentRow,
    setRow: r => { currentRow = r; },
    bumpUpdatedAt: () => { microCounter++; return `2026-10-04T10:00:00.${microCounter}Z`; },
    hooks: { get failPublish() { return failDbUpdate; } },
  });

  const db = {
    rpc: (name, args) => registry.rpc(name, args),
    auth: {
      async getUser(token) {
        if (!token || token === 'invalid') return { data: null, error: { message: 'invalid' } };
        return { data: { user: { id: token === 'valid-token' ? 'owner-tenant-1' : token } }, error: null };
      },
    },
    storage: {
      from(bucket) {
        return {
          async upload(path, bytes, options) {
            storageUploads.push({ bucket, path, bytes, options });
            return { data: { path }, error: null };
          },
          ...blobAusUploads(storageUploads),
        };
      },
    },
    from(table) {
      if (table === 'terapeut_zertifikat') {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() { return { data: { ik_nummer: '123456789' }, error: null }; },
                };
              },
            };
          },
          async upsert(record) {
            certUpserts.push(record);
            return { data: record, error: null };
          },
        };
      }
      if (table === 'profiles') {
        return {
          select() {
            return {
              eq(_col, val) {
                return {
                  async single() {
                    return { data: { id: val, role: 'owner', owner_id: null, ik_number: '123456789' }, error: null };
                  },
                  async maybeSingle() { return { data: { ik_number: '123456789' }, error: null }; },
                };
              },
            };
          },
        };
      }

      const filters = [];
      let isUpdate = false;
      let patchData = null;

      const builder = {
        select() { return builder; },
        update(patch) {
          isUpdate = true;
          patchData = patch;
          return builder;
        },
        eq(col, val) { filters.push(r => r && r[col] === val); return builder; },
        is(col, val) { filters.push(r => r && r[col] === val); return builder; },
        async maybeSingle() {
          const match = currentRow && filters.every(f => f(currentRow)) ? { ...currentRow } : null;
          return { data: match, error: null };
        },
        async single() {
          const match = currentRow && filters.every(f => f(currentRow)) ? { ...currentRow } : null;
          return { data: match, error: match ? null : { message: 'not found' } };
        },
        then(resolve, reject) {
          const run = async () => {
            if (failDbUpdate) return { data: null, error: new Error('DB persist failure') };
            if (beforeUpdateHook) await beforeUpdateHook();
            if (isUpdate) {
              const matches = currentRow && filters.every(f => f(currentRow));
              if (!matches) return { data: [], error: null };
              microCounter++;
              currentRow = {
                ...currentRow,
                ...patchData,
                updated_at: `2026-10-04T10:00:00.${microCounter}Z`,
              };
              return { data: [{ ...currentRow }], error: null };
            }
            const match = currentRow && filters.every(f => f(currentRow)) ? [{ ...currentRow }] : [];
            return { data: match, error: null };
          };
          return run().then(resolve, reject);
        },
      };
      return builder;
    },
  };

  return {
    db,
    getCurrentRow: () => currentRow,
    setCurrentRow: r => { currentRow = r ? { ...r } : null; },
    getStorageUploads: () => storageUploads,
    getCertUpserts: () => certUpserts,
    setFailDbUpdate: v => { failDbUpdate = v; },
    setBeforeUpdateHook: fn => { beforeUpdateHook = fn; },
  };
}

function createReqRes({ params = {}, body = {}, headers = {}, user = { id: 'owner-tenant-1' } } = {}) {
  const req = {
    params: { id: 'ab-123', ...params },
    body,
    headers: { authorization: 'Bearer ' + user.id, ...headers },
    user,
  };
  let statusCode = 200;
  let resBody = null;
  const res = {
    status(code) { statusCode = code; return res; },
    json(data) { resBody = data; return res; },
    get statusCode() { return statusCode; },
    get body() { return resBody; },
  };
  return { req, res };
}

function setupVm(fakeDb, extraInjections = {}) {
  const handlers = {};
  const mockRouter = {
    post(path, fn) { handlers[path] = fn; },
  };

  const sandbox = {
    router: mockRouter,
    Buffer,
    Math,
    Date,
    console: { error() {}, warn() {} },
    ABRECHNUNG_VERSION_FELDER,
    pruefeEntwurfsVersion,
    aktualisiereArtefaktVersion,
    artefaktVersuchPfad,
    reserviereUndLadeHoch,
    veroeffentliche,
    pruefeSignedDta,
    supabase: fakeDb.db,
    nurInhaber: async req => ({ tenantId: req.user?.id || 'owner-tenant-1' }),
    bereichFuerAbrechnung: async () => ({ bereich: 'physio', eigenerAbrechnungscode: '12' }),
    pruefeEmpfaenger: async () => ({ blockiert: false, meldungen: [] }),
    sha256Hex: buf => crypto.createHash('sha256').update(buf).digest('hex'),
    verarbeiteVerschluesselungsSchritt: async ({ vorher }) => ({
      verschluesselt: true,
      encrypted_storage_path: 'mock/path.enc',
      version: vorher,
    }),
    ...extraInjections,
  };

  vm.runInContext(extractedRoutesCode, vm.createContext(sandbox));
  return handlers;
}

const validUploadBody = {
  signedBase64: SIGNED_BASE64,
  certSubject: 'Synthetic Test Only',
  certValidTo: '2027-01-01',
  certThumbprint,
  certSerial: '01',
};

describe('Abrechnung Artefakt Routes CAS & Lifecycle', () => {
  it('(1) two truly concurrent uploads same before -> one 200 one 409, immutable paths preserved, winner enc only, CAS reset', async () => {
    const fakeDb = createFakeDb(makeInitialRow());
    const encInvocations = [];
    const handlers = setupVm(fakeDb, {
      verarbeiteVerschluesselungsSchritt: async ({ vorher }) => {
        encInvocations.push(vorher);
        return { verschluesselt: true, encrypted_storage_path: 'enc/p.enc', version: vorher };
      },
    });

    const r1 = createReqRes({ body: validUploadBody });
    const r2 = createReqRes({ body: validUploadBody });

    await Promise.all([
      handlers['/abrechnung/:id/upload-signed'](r1.req, r1.res),
      handlers['/abrechnung/:id/upload-signed'](r2.req, r2.res),
    ]);

    const statuses = [r1.res.statusCode, r2.res.statusCode].sort();
    assert.equal(statuses[0], 200);
    assert.equal(statuses[1], 409);

    const uploads = fakeDb.getStorageUploads();
    assert.equal(uploads.length, 2);
    assert.notEqual(uploads[0].path, uploads[1].path);
    assert.equal(uploads[0].options.upsert, false);
    assert.equal(uploads[1].options.upsert, false);

    assert.equal(encInvocations.length, 1);
    const updated = fakeDb.getCurrentRow();
    assert.equal(updated.encrypted_storage_path, null);
    assert.equal(updated.signed_sha256, crypto.createHash('sha256').update(SIGNED_CMS_BYTES).digest('hex'));
  });

  it('(2) sequential resign same original keeps numbers/before artefacts and new path', async () => {
    const fakeDb = createFakeDb(makeInitialRow());
    const handlers = setupVm(fakeDb);

    const r1 = createReqRes({ body: validUploadBody });
    await handlers['/abrechnung/:id/upload-signed'](r1.req, r1.res);
    assert.equal(r1.res.statusCode, 200);
    const firstPath = r1.res.body.signedPath;

    const r2 = createReqRes({ body: validUploadBody });
    await handlers['/abrechnung/:id/upload-signed'](r2.req, r2.res);
    assert.equal(r2.res.statusCode, 200);
    const secondPath = r2.res.body.signedPath;

    assert.notEqual(firstPath, secondPath);
    const uploads = fakeDb.getStorageUploads();
    assert.equal(uploads.length, 2);
    assert.equal(uploads[0].path, firstPath);
    assert.equal(uploads[1].path, secondPath);
    assert.equal(fakeDb.getCurrentRow().signed_storage_path, secondPath);
    assert.equal(fakeDb.getCurrentRow().datenaustauschreferenz, 17);
    assert.equal(fakeDb.getCurrentRow().transfernummer, 7);
    assert.equal(fakeDb.getCurrentRow().rechnungsnummer, 'SYNTHETIC-17');
  });

  it('(3) upload terminal accepted/gesendet/paid/verworfen 409 zero Storage writes', async () => {
    for (const status of ['accepted', 'rejected', 'gesendet', 'paid', 'bezahlt', 'verworfen']) {
      const fakeDb = createFakeDb(makeInitialRow({ status }));
      const handlers = setupVm(fakeDb);
      const { req, res } = createReqRes({ body: validUploadBody });
      await handlers['/abrechnung/:id/upload-signed'](req, res);
      assert.equal(res.statusCode, 409);
      assert.equal(fakeDb.getStorageUploads().length, 0);
    }
  });

  it('(4) DB persist failure after upload 500 no enc invocation', async () => {
    const fakeDb = createFakeDb(makeInitialRow());
    fakeDb.setFailDbUpdate(true);
    let encInvoked = false;
    const handlers = setupVm(fakeDb, {
      verarbeiteVerschluesselungsSchritt: async () => { encInvoked = true; return {}; },
    });

    const { req, res } = createReqRes({ body: validUploadBody });
    await handlers['/abrechnung/:id/upload-signed'](req, res);
    assert.equal(res.statusCode, 503);
    assert.equal(fakeDb.getStorageUploads().length, 1);
    assert.equal(encInvoked, false);
  });

  it('(5) encryption CAS 409 propagated 409 not ok succ', async () => {
    const fakeDb = createFakeDb(makeInitialRow());
    const handlers = setupVm(fakeDb, {
      verarbeiteVerschluesselungsSchritt: async () => {
        const err = new Error('CAS conflict during enc');
        err.status = 409;
        err.code = 'ABRECHNUNG_VERSION_CONFLICT';
        throw err;
      },
    });

    const { req, res } = createReqRes({ body: validUploadBody });
    await handlers['/abrechnung/:id/upload-signed'](req, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'ABRECHNUNG_VERSION_CONFLICT');
    assert.notEqual(res.body.ok, true);
  });

  it('(6) missing version fail closed', async () => {
    const brokenRow = makeInitialRow();
    delete brokenRow.signed_storage_path;
    const fakeDb = createFakeDb(brokenRow);
    const handlers = setupVm(fakeDb);

    const { req, res } = createReqRes({ body: validUploadBody });
    await handlers['/abrechnung/:id/upload-signed'](req, res);
    assert.equal(res.statusCode, 409);
  });

  it('(7) mark sent current body four artifact fields -> gesendet 200', async () => {
    const fakeDb = createFakeDb(makeInitialRow({
      signed_storage_path: 'p/signed.p7m',
      signed_sha256: 'hash-signed-1',
      encrypted_storage_path: 'p/enc.p7m',
      encrypted_sha256: 'hash-enc-1',
    }));
    const handlers = setupVm(fakeDb);

    const { req, res } = createReqRes({
      body: {
        signed_storage_path: 'p/signed.p7m',
        signed_sha256: 'hash-signed-1',
        encrypted_storage_path: 'p/enc.p7m',
        encrypted_sha256: 'hash-enc-1',
      },
    });

    await handlers['/abrechnung/:id/mark-sent'](req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(fakeDb.getCurrentRow().status, 'gesendet');
    assert.notEqual(fakeDb.getCurrentRow().zaa_uploaded_at, null);
  });

  it('(8) UI stale body artifact path/hash mismatch 409 no DB update', async () => {
    const fakeDb = createFakeDb(makeInitialRow({
      signed_storage_path: 'p/signed.p7m',
      signed_sha256: 'hash-signed-1',
      encrypted_storage_path: 'p/enc.p7m',
      encrypted_sha256: 'hash-enc-1',
    }));
    const handlers = setupVm(fakeDb);

    const { req, res } = createReqRes({
      body: {
        signed_storage_path: 'p/signed.p7m',
        signed_sha256: 'mismatched-stale-hash',
        encrypted_storage_path: 'p/enc.p7m',
        encrypted_sha256: 'hash-enc-1',
      },
    });

    await handlers['/abrechnung/:id/mark-sent'](req, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'ABRECHNUNG_VERSION_CONFLICT');
    assert.equal(fakeDb.getCurrentRow().status, 'erstellt');
  });

  it('(9) change version during receiver await -> 409 no overwrite', async () => {
    const fakeDb = createFakeDb(makeInitialRow({
      signed_storage_path: 'p/signed.p7m',
      signed_sha256: 'hash-signed-1',
      encrypted_storage_path: 'p/enc.p7m',
      encrypted_sha256: 'hash-enc-1',
    }));
    const handlers = setupVm(fakeDb, {
      pruefeEmpfaenger: async () => {
        fakeDb.getCurrentRow().updated_at = '2026-10-04T11:22:33.999999Z';
        return { blockiert: false, meldungen: [] };
      },
    });

    const { req, res } = createReqRes({
      body: {
        signed_storage_path: 'p/signed.p7m',
        signed_sha256: 'hash-signed-1',
        encrypted_storage_path: 'p/enc.p7m',
        encrypted_sha256: 'hash-enc-1',
      },
    });

    await handlers['/abrechnung/:id/mark-sent'](req, res);
    assert.equal(res.statusCode, 409);
    assert.equal(fakeDb.getCurrentRow().status, 'erstellt');
  });

  it('(10) marksent terminal statuses cannot downgrade', async () => {
    const fakeDb = createFakeDb(makeInitialRow({
      status: 'gesendet',
      signed_storage_path: 'p/signed.p7m',
      signed_sha256: 'hash-signed-1',
      encrypted_storage_path: 'p/enc.p7m',
      encrypted_sha256: 'hash-enc-1',
      zaa_uploaded_at: '2026-10-04T08:00:00Z',
    }));
    const handlers = setupVm(fakeDb);

    const { req, res } = createReqRes({
      body: {
        signed_storage_path: 'p/signed.p7m',
        signed_sha256: 'hash-signed-1',
        encrypted_storage_path: 'p/enc.p7m',
        encrypted_sha256: 'hash-enc-1',
      },
    });

    await handlers['/abrechnung/:id/mark-sent'](req, res);
    assert.equal(res.statusCode, 409);
    assert.equal(fakeDb.getCurrentRow().status, 'gesendet');
  });

  it('(11) missing body rejected', async () => {
    const fakeDb = createFakeDb(makeInitialRow({
      signed_storage_path: 'p/signed.p7m',
      signed_sha256: 'hash-signed-1',
      encrypted_storage_path: 'p/enc.p7m',
      encrypted_sha256: 'hash-enc-1',
    }));
    const handlers = setupVm(fakeDb);

    const { req, res } = createReqRes({ body: {} });
    await handlers['/abrechnung/:id/mark-sent'](req, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'ABRECHNUNG_VERSION_CONFLICT');
  });

  it('(12) foreign owner 403 no mutation', async () => {
    const fakeDb = createFakeDb(makeInitialRow({
      signed_storage_path: 'p/signed.p7m',
      signed_sha256: 'hash-signed-1',
      encrypted_storage_path: 'p/enc.p7m',
      encrypted_sha256: 'hash-enc-1',
    }));
    const handlers = setupVm(fakeDb);

    const rUpload = createReqRes({
      body: validUploadBody,
      user: { id: 'foreign-intruder' },
    });
    await handlers['/abrechnung/:id/upload-signed'](rUpload.req, rUpload.res);
    assert.equal(rUpload.res.statusCode, 403);
    assert.equal(fakeDb.getStorageUploads().length, 0);

    const rMark = createReqRes({
      body: {
        signed_storage_path: 'p/signed.p7m',
        signed_sha256: 'hash-signed-1',
        encrypted_storage_path: 'p/enc.p7m',
        encrypted_sha256: 'hash-enc-1',
      },
      user: { id: 'foreign-intruder' },
    });
    await handlers['/abrechnung/:id/mark-sent'](rMark.req, rMark.res);
    assert.equal(rMark.res.statusCode, 403);
    assert.equal(fakeDb.getCurrentRow().status, 'erstellt');
  });
});
