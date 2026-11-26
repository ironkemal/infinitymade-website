// F3 (Variante b / O-132): Frische Box ohne DB-Eintrag in `empfaenger_zertifikate`
// findet AZE (107436557) und DDG (660510336) direkt in `trust-anchors/` und verschlüsselt.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import forge from 'node-forge';
import {
  ladeItsgTrustAnchors,
  findeEmpfaengerZertifikatInTrustAnchors,
} from './itsg-trust-anchor.js';
import { verschluesseleFuerEmpfaenger } from './verschluesselung.js';
import { createPssSignedCmsSync } from './test-pss-cms.js';

describe('F3: Empfängerzertifikate direkt aus trust-anchors/ (Variante b)', () => {
  it('findet AZE (107436557) und DDG (660510336) ohne DB-Tabelle und verschlüsselt erfolgreich', () => {
    const { anchors } = ladeItsgTrustAnchors();
    assert.ok(anchors.length >= 60, 'Trust-Anchor-Store muss >= 60 Zertifikate enthalten');

    const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 });
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date('2020-01-01T00:00:00Z');
    cert.validity.notAfter = new Date('2040-01-01T00:00:00Z');
    cert.setSubject([{ name: 'commonName', value: 'F3 Test Signer' }]);
    cert.setIssuer([{ name: 'commonName', value: 'F3 Test Signer' }]);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    const signedBytes = createPssSignedCmsSync({
      payload: Buffer.from("UNB+UNOC:3+590537440+107436557+261126:1200+00001'", 'latin1'),
      privateKey: keys.privateKey,
      cert,
    });

    for (const [label, ik] of [['AZE', '107436557'], ['DDG', '660510336']]) {
      const gefunden = findeEmpfaengerZertifikatInTrustAnchors(ik, { jetzt: new Date('2026-11-26T12:00:00Z') });
      assert.ok(gefunden, `${label} (${ik}) muss in trust-anchors/ gefunden werden`);
      assert.ok(Buffer.isBuffer(gefunden.zertifikat_der) && gefunden.zertifikat_der.length > 500);
      assert.match(gefunden.fingerprint_sha256, /^[0-9a-f]{64}$/);
      assert.equal(gefunden.quelle, 'trust-anchors');

      const encrypted = verschluesseleFuerEmpfaenger({
        signedBytes,
        empfaengerZertifikatDer: gefunden.zertifikat_der,
        erwarteteIk: ik,
        itsgAnkerZertifikate: anchors,
        pruefDatum: new Date('2026-11-26T12:00:00Z'),
      });
      assert.ok(Buffer.isBuffer(encrypted) && encrypted.length > signedBytes.length);
    }
  });

  it('liefert null für unbekannte oder ungültige IK', () => {
    assert.equal(findeEmpfaengerZertifikatInTrustAnchors('999999999'), null);
    assert.equal(findeEmpfaengerZertifikatInTrustAnchors('invalid'), null);
  });
});
