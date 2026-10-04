import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import forge from 'node-forge';
import { pruefeSignedDta, ladeDtaOriginalbytes } from './signed-original.js';

// Module-scope synthetic 2048-bit RSA keypair & self-signed cert (no real keys/CA trust)
const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 });
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date('2020-01-01T00:00:00Z');
cert.validity.notAfter = new Date('2040-01-01T00:00:00Z');
const certAttrs = [{ name: 'commonName', value: 'Synthetic test signer' }];
cert.setSubject(certAttrs);
cert.setIssuer(certAttrs);
cert.sign(keys.privateKey, forge.md.sha256.create());

const sha256Hex = (buf) => createHash('sha256').update(buf).digest('hex');

function createSigned(payload, { detached = false, signers = 1, contentType = forge.pki.oids.data } = {}) {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(payload.toString('binary'));
  p7.addCertificate(cert);
  for (let i = 0; i < signers; i++) {
    p7.addSigner({
      key: keys.privateKey,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: contentType },
        { type: forge.pki.oids.messageDigest }
      ]
    });
  }
  p7.sign({ detached });
  return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary');
}

// Recognizable Latin-1 original buffer containing 0xff and 0x00
const syntheticOriginal = Buffer.from('DTA-TEST-\xff\x00-ORIGINAL-DATA-\x80\xfe', 'latin1');
const validDtaHash = sha256Hex(syntheticOriginal);
const validSigned = createSigned(syntheticOriginal);
const validSignedHash = sha256Hex(validSigned);

function createMockDb({ files = {}, errors = {} } = {}) {
  const downloadCalls = [];
  return {
    downloadCalls,
    storage: {
      from: (bucket) => {
        assert.equal(bucket, 'abrechnungen');
        return {
          download: async (path) => {
            downloadCalls.push(path);
            if (errors[path]) {
              const e = errors[path];
              const err = e instanceof Error ? e : Object.assign(new Error(e.message || 'Storage error'), e);
              return { data: null, error: err };
            }
            if (!(path in files)) {
              const err = new Error(`Not found: ${path}`);
              err.status = 404;
              err.statusCode = 404;
              return { data: null, error: err };
            }
            const val = files[path];
            const buf = Buffer.isBuffer(val) ? val : Buffer.from(val);
            return { data: new Blob([buf]), error: null };
          },
          upload: () => { throw new Error('DB write/upload forbidden'); },
          remove: () => { throw new Error('DB remove forbidden'); }
        };
      }
    },
    from: () => ({
      insert: () => { throw new Error('DB write forbidden'); },
      update: () => { throw new Error('DB write forbidden'); },
      delete: () => { throw new Error('DB remove forbidden'); }
    })
  };
}

const baseAbrechnung = {
  owner_id: 'owner123',
  dta_sha256: validDtaHash,
  signed_sha256: validSignedHash,
  storage_path: 'owner123/direct.dta',
  signed_storage_path: 'owner123/signature.p7m'
};

describe('pruefeSignedDta', () => {
  it('roundtrips binary payload with 0xff and 0x00 correctly', async () => {
    const res = await pruefeSignedDta({ signedBytes: validSigned, expectedDtaSha256: validDtaHash });
    assert.ok(Buffer.isBuffer(res));
    assert.ok(res.equals(syntheticOriginal));
    assert.ok(res.includes(0xff));
    assert.ok(res.includes(0x00));
  });

  it('verifies signed DER hash when expectedSignedSha256 is provided', async () => {
    const res = await pruefeSignedDta({
      signedBytes: validSigned,
      expectedDtaSha256: validDtaHash,
      expectedSignedSha256: validSignedHash
    });
    assert.ok(res.equals(syntheticOriginal));
  });

  it('rejects missing or invalid format expectedDtaSha256', async () => {
    await assert.rejects(async () => pruefeSignedDta({ signedBytes: validSigned }));
    await assert.rejects(async () => pruefeSignedDta({ signedBytes: validSigned, expectedDtaSha256: '' }));
    await assert.rejects(async () => pruefeSignedDta({ signedBytes: validSigned, expectedDtaSha256: 'not-a-hash' }));
    await assert.rejects(async () => pruefeSignedDta({ signedBytes: validSigned, expectedDtaSha256: validDtaHash.slice(0, 63) }));
    await assert.rejects(async () => pruefeSignedDta({ signedBytes: validSigned, expectedDtaSha256: 'z'.repeat(64) }));
  });

  it('rejects mismatched expectedDtaSha256', async () => {
    await assert.rejects(async () => pruefeSignedDta({ signedBytes: validSigned, expectedDtaSha256: '0'.repeat(64) }));
  });

  it('rejects null or mismatched expectedSignedSha256', async () => {
    await assert.rejects(async () => pruefeSignedDta({
      signedBytes: validSigned,
      expectedDtaSha256: validDtaHash,
      expectedSignedSha256: null
    }));
    await assert.rejects(async () => pruefeSignedDta({
      signedBytes: validSigned,
      expectedDtaSha256: validDtaHash,
      expectedSignedSha256: '1'.repeat(64)
    }));
  });

  it('rejects mutated signature last byte', async () => {
    const mutated = Buffer.from(validSigned);
    mutated[mutated.length - 1] ^= 0x01;
    await assert.rejects(async () => pruefeSignedDta({ signedBytes: mutated, expectedDtaSha256: validDtaHash }));
  });

  it('rejects tampered embedded payload bytes even if expectedDtaSha256 matches tampered payload', async () => {
    const offset = validSigned.indexOf(syntheticOriginal);
    assert.ok(offset >= 0, 'syntheticOriginal must be found inside validSigned DER');
    const tampered = Buffer.from(validSigned);
    tampered[offset] ^= 0x01;
    const modifiedPayload = tampered.subarray(offset, offset + syntheticOriginal.length);
    const tamperedDtaHash = sha256Hex(modifiedPayload);
    await assert.rejects(async () => pruefeSignedDta({ signedBytes: tampered, expectedDtaSha256: tamperedDtaHash }));
  });

  it('rejects detached PKCS#7 signature lacking embedded data', async () => {
    const detached = createSigned(syntheticOriginal, { detached: true });
    await assert.rejects(async () => pruefeSignedDta({ signedBytes: detached, expectedDtaSha256: validDtaHash }));
  });

  it('rejects CMS container with 2 signers', async () => {
    const twoSigners = createSigned(syntheticOriginal, { signers: 2 });
    await assert.rejects(async () => pruefeSignedDta({ signedBytes: twoSigners, expectedDtaSha256: validDtaHash }));
  });

  it('rejects trailing bytes appended to DER', async () => {
    const trailing = Buffer.concat([validSigned, Buffer.from([0x00])]);
    await assert.rejects(async () => pruefeSignedDta({ signedBytes: trailing, expectedDtaSha256: validDtaHash }));
  });

  it('rejects invalid CMS header / fake OID DER sequence', async () => {
    const fakeDer = Buffer.from([0x30, 0x09, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01]);
    await assert.rejects(async () => pruefeSignedDta({ signedBytes: fakeDer, expectedDtaSha256: validDtaHash }));
  });

  it('rejects non-data contentType authenticated attribute', async () => {
    const wrongType = createSigned(syntheticOriginal, { contentType: forge.pki.oids.sha256 });
    await assert.rejects(async () => pruefeSignedDta({ signedBytes: wrongType, expectedDtaSha256: validDtaHash }));
  });

  it('rejects payload exceeding 20MiB limit', async () => {
    const oversize = Buffer.alloc(20 * 1024 * 1024 + 1);
    await assert.rejects(async () => pruefeSignedDta({ signedBytes: oversize, expectedDtaSha256: validDtaHash }));
  });
});

describe('ladeDtaOriginalbytes', () => {
  it('downloads only original when original is valid and hash matches', async () => {
    const db = createMockDb({ files: { 'owner123/direct.dta': syntheticOriginal } });
    const res = await ladeDtaOriginalbytes({ db, abrechnung: baseAbrechnung });
    assert.ok(res.equals(syntheticOriginal));
    assert.deepEqual(db.downloadCalls, ['owner123/direct.dta']);
  });

  it('rejects on original hash mismatch without falling back to signed', async () => {
    const db = createMockDb({
      files: {
        'owner123/direct.dta': Buffer.from('corrupt original'),
        'owner123/signature.p7m': validSigned
      }
    });
    await assert.rejects(async () => ladeDtaOriginalbytes({ db, abrechnung: baseAbrechnung }));
    assert.deepEqual(db.downloadCalls, ['owner123/direct.dta']);
  });

  it('rejects empty downloaded original buffer', async () => {
    const db = createMockDb({ files: { 'owner123/direct.dta': Buffer.alloc(0) } });
    await assert.rejects(async () => ladeDtaOriginalbytes({ db, abrechnung: baseAbrechnung }));
    assert.deepEqual(db.downloadCalls, ['owner123/direct.dta']);
  });

  it('rejects malformed numeric storage_path before attempting any download even with valid signed fallback', async () => {
    const db = createMockDb({ files: { 'owner123/signature.p7m': validSigned } });
    await assert.rejects(async () => ladeDtaOriginalbytes({
      db,
      abrechnung: { ...baseAbrechnung, storage_path: 123 }
    }));
    assert.deepEqual(db.downloadCalls, []);
  });

  it('falls back to signed download when original path is missing', async () => {
    const db = createMockDb({ files: { 'owner123/signature.p7m': validSigned } });
    const abrechnung = { ...baseAbrechnung, storage_path: null };
    const res = await ladeDtaOriginalbytes({ db, abrechnung });
    assert.ok(res.equals(syntheticOriginal));
    assert.deepEqual(db.downloadCalls, ['owner123/signature.p7m']);
  });

  it('falls back to signed download on explicit 404 error (number or string)', async () => {
    const dbNum = createMockDb({
      files: { 'owner123/signature.p7m': validSigned },
      errors: { 'owner123/direct.dta': { status: 404, message: 'Not found' } }
    });
    const resNum = await ladeDtaOriginalbytes({ db: dbNum, abrechnung: baseAbrechnung });
    assert.ok(resNum.equals(syntheticOriginal));
    assert.deepEqual(dbNum.downloadCalls, ['owner123/direct.dta', 'owner123/signature.p7m']);

    const dbStr = createMockDb({
      files: { 'owner123/signature.p7m': validSigned },
      errors: { 'owner123/direct.dta': { statusCode: '404', message: 'Not found' } }
    });
    const resStr = await ladeDtaOriginalbytes({ db: dbStr, abrechnung: baseAbrechnung });
    assert.ok(resStr.equals(syntheticOriginal));
    assert.deepEqual(dbStr.downloadCalls, ['owner123/direct.dta', 'owner123/signature.p7m']);
  });

  it('does not attempt signed download on 500, 403 or unknown error', async () => {
    for (const errObj of [{ status: 500 }, { statusCode: 403 }, new Error('Network timeout')]) {
      const db = createMockDb({
        files: { 'owner123/signature.p7m': validSigned },
        errors: { 'owner123/direct.dta': errObj }
      });
      await assert.rejects(async () => ladeDtaOriginalbytes({ db, abrechnung: baseAbrechnung }));
      assert.deepEqual(db.downloadCalls, ['owner123/direct.dta']);
    }
  });

  it('rejects when mandatory header hashes are missing', async () => {
    const db = createMockDb({ files: { 'owner123/direct.dta': syntheticOriginal } });
    await assert.rejects(async () => ladeDtaOriginalbytes({
      db,
      abrechnung: { ...baseAbrechnung, dta_sha256: undefined }
    }));
    await assert.rejects(async () => ladeDtaOriginalbytes({
      db,
      abrechnung: { ...baseAbrechnung, storage_path: null, signed_sha256: undefined }
    }));
  });

  it('rejects signed path belonging to a foreign owner', async () => {
    const db = createMockDb({ files: { 'otherowner/signature.p7m': validSigned } });
    await assert.rejects(async () => ladeDtaOriginalbytes({
      db,
      abrechnung: {
        ...baseAbrechnung,
        storage_path: null,
        signed_storage_path: 'otherowner/signature.p7m'
      }
    }));
  });

  it('rejects directory traversal in storage paths', async () => {
    const db1 = createMockDb({ files: { 'owner123/../direct.dta': syntheticOriginal } });
    await assert.rejects(async () => ladeDtaOriginalbytes({
      db: db1,
      abrechnung: { ...baseAbrechnung, storage_path: 'owner123/../direct.dta' }
    }));

    const db2 = createMockDb({ files: { 'owner123/../../signature.p7m': validSigned } });
    await assert.rejects(async () => ladeDtaOriginalbytes({
      db: db2,
      abrechnung: { ...baseAbrechnung, storage_path: null, signed_storage_path: 'owner123/../../signature.p7m' }
    }));
  });

  it('rejects when downloaded signed storage bytes do not match expected signed hash', async () => {
    const db = createMockDb({
      files: { 'owner123/signature.p7m': Buffer.from('corrupted signed bytes') }
    });
    await assert.rejects(async () => ladeDtaOriginalbytes({
      db,
      abrechnung: { ...baseAbrechnung, storage_path: null }
    }));
  });

  it('never invokes db upload, write or remove during operations', async () => {
    const db = createMockDb({ files: { 'owner123/direct.dta': syntheticOriginal } });
    await ladeDtaOriginalbytes({ db, abrechnung: baseAbrechnung });
    assert.deepEqual(db.downloadCalls, ['owner123/direct.dta']);
  });
});
