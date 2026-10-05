import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import forge from 'node-forge';
import { pruefeSignedDta } from '../dta/signed-original.js';
import { ABRECHNUNG_VERSION_FELDER, pruefeEntwurfsVersion, aktualisiereArtefaktVersion, artefaktVersuchPfad } from './artefakt-version.js';
import { reserviereUndLadeHoch, veroeffentliche } from './artefakt-registry.js';
import { erzeugeRegistryFake, blobAusUploads } from './artefakt-registry-fake.js';

// Read actual abrechnung.routes.js via new URL
const routeUrl = new URL('./abrechnung.routes.js', import.meta.url);
const routeSource = fs.readFileSync(routeUrl, 'utf8');

// Extract exact router.post upload-signed handler from source
function extractUploadSignedHandlerSource(source) {
  const match = source.match(/router\.post\(\s*['"]\/abrechnung\/:id\/upload-signed['"]/);
  if (!match) {
    throw new Error("Could not find router.post('/abrechnung/:id/upload-signed') in abrechnung.routes.js");
  }
  const startIndex = match.index;
  let depth = 0;
  let inString = null;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = startIndex; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (char === '\\') {
        i++;
      } else if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (char === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      inString = char;
      continue;
    }

    if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;
      if (depth === 0) {
        let endIndex = i + 1;
        if (source[endIndex] === ';') endIndex++;
        return source.slice(startIndex, endIndex);
      }
    }
  }
  throw new Error('Failed to find matching closing parenthesis for router.post');
}

const handlerCode = extractUploadSignedHandlerSource(routeSource);

// Generate synthetic RSA2048 self-signed cert at runtime
const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048 });
const cert = forge.pki.createCertificate();
cert.publicKey = keypair.publicKey;
cert.serialNumber = '01' + Date.now().toString(16);
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

const certAttrs = [
  { name: 'commonName', value: 'Synthetic Test Signer (No CA Trust)' },
  { name: 'organizationName', value: 'Synthetic Test Suite (Non-Production)' },
  { name: 'countryName', value: 'DE' },
];
cert.setSubject(certAttrs);
cert.setIssuer(certAttrs);
cert.sign(keypair.privateKey, forge.md.sha256.create());

// Synthetic test payload with latin1 0xff and 0x00 bytes
const rawPayloadBuffer = Buffer.concat([
  Buffer.from('SYNTHETIC_TEST_PAYLOAD_NON_BILLING_PREFIX_'),
  Buffer.from([0xff, 0x00, 0xfe, 0x01]),
  Buffer.from('_SYNTHETIC_TEST_PAYLOAD_NON_BILLING_SUFFIX'),
]);
const expectedDtaSha256 = crypto.createHash('sha256').update(rawPayloadBuffer).digest('hex');

// Real CMS binary signature generator with authenticatedAttributes
function createCmsSignedData(payloadBuf, options = {}) {
  const p7 = forge.pkcs7.createSignedData();
  const binaryPayload = payloadBuf.toString('binary');
  p7.content = forge.util.createBuffer(binaryPayload, 'raw');
  p7.addCertificate(cert);
  p7.addSigner({
    key: keypair.privateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      {
        type: forge.pki.oids.contentType,
        value: forge.pki.oids.data,
      },
      {
        type: forge.pki.oids.messageDigest,
      },
      {
        type: forge.pki.oids.signingTime,
        value: new Date(),
      },
    ],
  });
  p7.sign({ detached: !!options.detached });
  const asn1 = p7.toAsn1();
  const der = forge.asn1.toDer(asn1).getBytes();
  return Buffer.from(der, 'binary');
}

const validSignedBytes = createCmsSignedData(rawPayloadBuffer);
const detachedSignedBytes = createCmsSignedData(rawPayloadBuffer, { detached: true });

// Mutate actual SignerInfo signature OCTET STRING via forge.asn1 without guessing byte offsets
function createTamperedSignature(validDerBuffer) {
  const asn1Obj = forge.asn1.fromDer(validDerBuffer.toString('binary'));
  const contentContext = asn1Obj.value[1]; // [0] EXPLICIT SignedData
  const signedDataSeq = contentContext.value[0]; // SignedData SEQUENCE

  // Find signerInfos SET (the last SET in SignedData sequence)
  let signerInfosSet = null;
  for (let i = signedDataSeq.value.length - 1; i >= 0; i--) {
    if (signedDataSeq.value[i].type === forge.asn1.Type.SET) {
      signerInfosSet = signedDataSeq.value[i];
      break;
    }
  }
  if (!signerInfosSet || !signerInfosSet.value || signerInfosSet.value.length === 0) {
    throw new Error('SignerInfos not found in SignedData ASN.1');
  }

  const lastSigner = signerInfosSet.value[signerInfosSet.value.length - 1];
  const sigOctet = lastSigner.value.find((item) => item.type === forge.asn1.Type.OCTETSTRING);
  if (!sigOctet || typeof sigOctet.value !== 'string') {
    throw new Error('Signature OCTET STRING not found in SignerInfo');
  }

  // Mutate signature bytes while preserving eContent, OIDs, and attributes
  const sigBytes = Buffer.from(sigOctet.value, 'binary');
  sigBytes[sigBytes.length - 1] ^= 0xff;
  sigOctet.value = sigBytes.toString('binary');

  const derString = forge.asn1.toDer(asn1Obj).getBytes();
  return Buffer.from(derString, 'binary');
}

const tamperedSignedBytes = createTamperedSignature(validSignedBytes);

// Test execution harness via Node.js vm
function createHarness(options = {}) {
  const tracker = {
    selectCalls: [],
    updateCalls: [],
    storageUploadCalls: [],
    receiverCalls: [],
    pruefeCalls: [],
  };

  const headerOverrides = options.abrechnungRow !== undefined
    ? options.abrechnungRow
    : {
        id: 'synthetic-ab-001',
        owner_id: 'tenant-owner-001',
        storage_path: 'tenant-owner-001/synthetic-ab-001/payload',
        empfaenger_ik: '123456789',
        kostentraeger_ik: '987654321',
        created_at: new Date().toISOString(),
        dta_sha256: options.expectedDtaSha256 !== undefined ? options.expectedDtaSha256 : expectedDtaSha256,
      };

  const syntheticHeaderRow = { ...Object.fromEntries(ABRECHNUNG_VERSION_FELDER.split(',').map(k => [k, null])), updated_at: '2026-10-04T10:00:00.123456Z', status: 'erstellt', ...headerOverrides };

  let headerRow = syntheticHeaderRow;
  const registry = erzeugeRegistryFake({
    getRow: () => headerRow,
    setRow: (r) => { headerRow = r; },
    bumpUpdatedAt: () => '2026-10-04T10:00:00.999999Z',
  });
  const supabaseMock = {
    rpc: (name, args) => registry.rpc(name, args),
    from: (table) => ({
      select: (fields) => {
        tracker.selectCalls.push({ table, fields });
        return {
          eq: () => ({
            maybeSingle: async () => {
              if (table === 'abrechnung') {
                return {
                  data: syntheticHeaderRow,
                  error: null,
                };
              }
              return { data: null, error: null };
            },
          }),
        };
      },
      update: (payload) => {
        tracker.updateCalls.push({ table, payload });
        return {
          eq: () => Promise.resolve({ data: null, error: null }),
        };
      },
      upsert: async () => ({ data: null, error: null }),
    }),
    storage: {
      from: (bucket) => ({
        upload: async (path, bytes, uploadOpts) => {
          tracker.storageUploadCalls.push({ bucket, path, bytes, uploadOpts });
          if (options.uploadError) {
            return { error: options.uploadError };
          }
          return { data: { path }, error: null };
        },
        ...blobAusUploads(tracker.storageUploadCalls),
      }),
    },
  };

  let capturedHandler = null;
  const router = {
    post: (path, handler) => {
      capturedHandler = handler;
    },
  };

  const trackingPruefeSignedDta = async (args) => {
    tracker.pruefeCalls.push(args);
    return pruefeSignedDta(args);
  };

  const sandbox = {
    ABRECHNUNG_VERSION_FELDER, pruefeEntwurfsVersion, aktualisiereArtefaktVersion, artefaktVersuchPfad,
    reserviereUndLadeHoch, veroeffentliche,
    Buffer,
    console: {
      log: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    router,
    nurInhaber: async () => {
      return options.nurInhaberResult !== undefined
        ? options.nurInhaberResult
        : { tenantId: 'tenant-owner-001' };
    },
    supabase: supabaseMock,
    pruefeSignedDta: trackingPruefeSignedDta,
    bereichFuerAbrechnung: async () => ({
      bereich: 'synthetic-bereich',
      eigenerAbrechnungscode: 'synthetic-code',
    }),
    pruefeEmpfaenger: async (sb, ab, opts) => {
      tracker.receiverCalls.push({ ab, opts });
      if (options.receiverBlocked) {
        return {
          blockiert: true,
          meldungen: [
            {
              stufe: 'block',
              text: 'Synthetic recipient blocked on cutoff date.',
              code: 'STICHTAG_BLOCKIERT',
            },
          ],
        };
      }
      return { blockiert: false, meldungen: [] };
    },
    sha256Hex: (bytes) => crypto.createHash('sha256').update(bytes).digest('hex'),
    verarbeiteVerschluesselungsSchritt: async () => ({
      verschluesselt: false,
      verschluesselungHinweis: 'Synthetic test non-encrypted step.',
    }),
  };

  const context = vm.createContext(sandbox);
  const script = new vm.Script(handlerCode);
  script.runInContext(context);

  if (!capturedHandler) {
    throw new Error('Failed to capture router.post upload-signed handler in vm');
  }

  return { handler: capturedHandler, tracker };
}

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

function createMockReq(signedBytes) {
  return {
    params: { id: 'synthetic-ab-001' },
    body: {
      signedBase64: signedBytes ? signedBytes.toString('base64') : null,
      certSubject: 'CN=Synthetic Test Signer (No CA Trust)',
      certValidTo: '2030-01-01',
      certThumbprint: 'SYNTHETICTHUMBPRINT123456',
      certSerial: '1001',
    },
  };
}

describe('synthetic upload-signed handler route verification', () => {
  it('valid signature reaches storage upload (simulate deliberate upload error 500, so later updates unnecessary)', async () => {
    const { handler, tracker } = createHarness({
      uploadError: { message: 'Deliberate test storage error 500' },
    });
    const req = createMockReq(validSignedBytes);
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 500);
    assert.match(res.body?.error || '', /Upload fehlgeschlagen/);

    const abSelect = tracker.selectCalls.find((c) => c.table === 'abrechnung');
    assert.ok(abSelect, 'abrechnung table must be selected');
    assert.match(abSelect.fields, /\bdta_sha256\b/, 'select query must request dta_sha256');

    assert.equal(tracker.pruefeCalls.length, 1);
    assert.equal(tracker.pruefeCalls[0].expectedDtaSha256, expectedDtaSha256);

    assert.equal(tracker.receiverCalls.length, 1);

    assert.equal(tracker.storageUploadCalls.length, 1);
    assert.equal(tracker.storageUploadCalls[0].bucket, 'abrechnungen');
    assert.ok(tracker.storageUploadCalls[0].bytes.equals(validSignedBytes));

    assert.equal(tracker.updateCalls.length, 0);
  });

  it('wrong original hash gets 422 DTA_HASH_MISMATCH no storage/update/receiver lookup', async () => {
    const wrongHash = '0000000000000000000000000000000000000000000000000000000000000000';
    const { handler, tracker } = createHarness({
      expectedDtaSha256: wrongHash,
    });
    const req = createMockReq(validSignedBytes);
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 422);
    assert.equal(res.body?.code, 'DTA_HASH_MISMATCH');

    const abSelect = tracker.selectCalls.find((c) => c.table === 'abrechnung');
    assert.ok(abSelect);
    assert.match(abSelect.fields, /\bdta_sha256\b/);

    assert.equal(tracker.receiverCalls.length, 0);
    assert.equal(tracker.storageUploadCalls.length, 0);
    assert.equal(tracker.updateCalls.length, 0);
  });

  it('missing stored original hash 422 no effects', async () => {
    const { handler, tracker } = createHarness({
      expectedDtaSha256: null,
    });
    const req = createMockReq(validSignedBytes);
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 422);
    assert.equal(res.body?.code, 'DTA_HASH_REQUIRED');

    const abSelect = tracker.selectCalls.find((c) => c.table === 'abrechnung');
    assert.ok(abSelect);
    assert.match(abSelect.fields, /\bdta_sha256\b/);

    assert.equal(tracker.receiverCalls.length, 0);
    assert.equal(tracker.storageUploadCalls.length, 0);
    assert.equal(tracker.updateCalls.length, 0);
  });

  it('modified signature bytes 422 no effects (preserve DER and early OID)', async () => {
    const { handler, tracker } = createHarness();
    const req = createMockReq(tamperedSignedBytes);
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 422);
    assert.match(res.body?.code || '', /^(INVALID_SIGNATURE|CRYPTO_VERIFY_FAILED|SIGNATURE_.*)$/);

    const abSelect = tracker.selectCalls.find((c) => c.table === 'abrechnung');
    assert.ok(abSelect);
    assert.match(abSelect.fields, /\bdta_sha256\b/);

    assert.equal(tracker.receiverCalls.length, 0);
    assert.equal(tracker.storageUploadCalls.length, 0);
    assert.equal(tracker.updateCalls.length, 0);
  });

  it('detached signed content 422 no effects', async () => {
    const { handler, tracker } = createHarness();
    const req = createMockReq(detachedSignedBytes);
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 422);
    assert.equal(res.body?.code, 'DETACHED_CONTENT_NOT_ALLOWED');

    const abSelect = tracker.selectCalls.find((c) => c.table === 'abrechnung');
    assert.ok(abSelect);
    assert.match(abSelect.fields, /\bdta_sha256\b/);

    assert.equal(tracker.receiverCalls.length, 0);
    assert.equal(tracker.storageUploadCalls.length, 0);
    assert.equal(tracker.updateCalls.length, 0);
  });

  it('foreign owner 403 before crypto/storage/receiver', async () => {
    const { handler, tracker } = createHarness({
      abrechnungRow: {
        id: 'synthetic-ab-001',
        owner_id: 'different-tenant-owner-999',
        storage_path: 'different-tenant-owner-999/synthetic-ab-001/payload',
        empfaenger_ik: '123456789',
        kostentraeger_ik: '987654321',
        created_at: new Date().toISOString(),
        dta_sha256: expectedDtaSha256,
      },
    });
    const req = createMockReq(validSignedBytes);
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.error, 'Forbidden');

    assert.equal(tracker.pruefeCalls.length, 0);
    assert.equal(tracker.receiverCalls.length, 0);
    assert.equal(tracker.storageUploadCalls.length, 0);
    assert.equal(tracker.updateCalls.length, 0);
  });

  it('receiver block 409 after valid crypto but before writes', async () => {
    const { handler, tracker } = createHarness({
      receiverBlocked: true,
    });
    const req = createMockReq(validSignedBytes);
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body?.code, 'STICHTAG_BLOCKIERT');

    assert.equal(tracker.pruefeCalls.length, 1);
    assert.equal(tracker.receiverCalls.length, 1);
    assert.equal(tracker.storageUploadCalls.length, 0);
    assert.equal(tracker.updateCalls.length, 0);
  });
});
