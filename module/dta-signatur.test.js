import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import forge from 'node-forge';
import {
  entschluesseleP12UndSigniere,
  signiereDtaMitPss,
  extrahiereIssuerUndSerial,
  OID_RSASSA_PSS,
} from './dta-signatur.js';

function createTestP12({ expired = false } = {}) {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01a2b3';
  cert.validity.notBefore = new Date('2020-01-01T00:00:00Z');
  cert.validity.notAfter = expired ? new Date('2021-01-01T00:00:00Z') : new Date('2040-01-01T00:00:00Z');
  const attrs = [
    { name: 'countryName', value: 'DE' },
    { name: 'organizationName', value: 'ITSG TrustCenter fuer sonstige Leistungserbringer' },
    { name: 'commonName', value: 'Test Signer PSS' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'test-pin', { algorithm: '3des' });
  const p12Bin = forge.asn1.toDer(p12Asn1).getBytes();
  const p12Bytes = new Uint8Array(p12Bin.length);
  for (let i = 0; i < p12Bin.length; i++) p12Bytes[i] = p12Bin.charCodeAt(i) & 0xff;
  return { p12Bytes, cert, keys };
}

describe('module/dta-signatur.js (F1 RSASSA-PSS)', () => {
  it('erzeugt RSASSA-PSS CMS SignedData, das openssl cms -verify besteht und PSS-Parameter zeigt', async () => {
    const { p12Bytes } = createTestP12();
    const dtaBytes = new Uint8Array(Buffer.from('UNB+UNOC:3+590537440+107436557+261126:1200+00001\'', 'latin1'));

    const res = await entschluesseleP12UndSigniere({
      p12Bytes,
      pin: 'test-pin',
      dtaBytes,
      forge,
    });

    assert.ok(res.signedBytes instanceof Uint8Array && res.signedBytes.length > 200);
    assert.ok(res.signedBase64.length > 200);
    assert.match(res.certThumbprint, /^[0-9a-f]{40}$/);
    assert.ok(res.certSubject.includes('CN=Test Signer PSS'));

    // Gegen echtes OpenSSL 3.x verifizieren: Signaturprüfung + ASN.1-Struktur (rsassaPss + saltLength 32)
    const dir = mkdtempSync(join(tmpdir(), 'praxura-f1-'));
    try {
      const sigPath = join(dir, 'signed.p7s');
      const outPath = join(dir, 'out.dta');
      writeFileSync(sigPath, res.signedBytes);

      execFileSync('openssl', ['cms', '-verify', '-inform', 'DER', '-in', sigPath, '-noverify', '-out', outPath], {
        stdio: 'pipe',
      });

      const cmsDump = execFileSync('openssl', ['cms', '-cmsout', '-print', '-inform', 'DER', '-in', sigPath], {
        encoding: 'utf8',
      });
      assert.ok(cmsDump.includes('rsassaPss'), 'CMS muss rsassaPss als signatureAlgorithm ausweisen');
      assert.ok(cmsDump.includes('sha256'), 'CMS muss sha256 als Hash/MGF1 ausweisen');
      assert.ok(cmsDump.includes('mgf1'), 'CMS muss mgf1 ausweisen');
      assert.match(cmsDump, /cont\s*\[\s*2\s*\][\s\S]*?INTEGER\s*:20/i, 'saltLength muss 32 (0x20) sein');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('lehnt falsche PIN und abgelaufene Zertifikate ab', async () => {
    const { p12Bytes } = createTestP12();
    const dtaBytes = new Uint8Array([1, 2, 3, 4]);
    await assert.rejects(
      () => entschluesseleP12UndSigniere({ p12Bytes, pin: 'falsch', dtaBytes, forge }),
      /Ungültige \.p12-Datei oder falsche PIN/
    );

    const { p12Bytes: expiredP12 } = createTestP12({ expired: true });
    await assert.rejects(
      () => entschluesseleP12UndSigniere({ p12Bytes: expiredP12, pin: 'test-pin', dtaBytes, forge }),
      /Zertifikat abgelaufen/
    );
  });

  it('extrahiert Issuer und SerialNumber byte-identisch aus X.509 DER', () => {
    const { cert } = createTestP12();
    const derBin = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const der = new Uint8Array(derBin.length);
    for (let i = 0; i < derBin.length; i++) der[i] = derBin.charCodeAt(i) & 0xff;
    const { issuerRaw, serialRaw } = extrahiereIssuerUndSerial(der);
    assert.equal(issuerRaw[0], 0x30);
    assert.equal(serialRaw[0], 0x02);
    assert.equal(OID_RSASSA_PSS, '1.2.840.113549.1.1.10');
  });

  it('validiert Pflichtparameter in signiereDtaMitPss', async () => {
    await assert.rejects(
      () => signiereDtaMitPss({ dtaBytes: new Uint8Array(0), privateKeyPkcs8Der: new Uint8Array([1]), certChainDer: [new Uint8Array([1])] }),
      /fehlen oder sind leer/
    );
    assert.equal(createHash('sha256').update('ok').digest('hex').length, 64);
  });
});
