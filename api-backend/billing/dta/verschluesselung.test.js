// GGT Anlage 16 — CMS EnvelopedData Verschlüsselungsmodul & V4-Zertifikatsprüfung Tests.
// Ausführung: node --test api-backend/billing/dta/verschluesselung.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import forge from 'node-forge';
import * as asn1js from 'asn1js';

import { verschluesseleFuerEmpfaenger, entschluessele } from './verschluesselung.js';
import { pruefeEmpfaengerZertifikat } from './empfaenger-zertifikat-pruefung.js';

// Hilfsfunktion: Konvertiert Forge-Zertifikat in DER-Buffer
function forgeCertToDer(forgeCert) {
  const asn1 = forge.pki.certificateToAsn1(forgeCert);
  const derHex = forge.asn1.toDer(asn1).toHex();
  return Buffer.from(derHex, 'hex');
}

// Erzeugt ein Test-Zertifikat mit node-forge und Node.js-Kryptoschlüsseln
function erstelleTestZertifikat({
  modulusLength = 4096,
  notBefore = new Date(Date.now() - 24 * 60 * 60 * 1000),
  notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  keyUsageEncipherment = true,
  ik = '123456789'
} = {}) {
  const { publicKey: pubKeyPem, privateKey: privKeyPem } = crypto.generateKeyPairSync('rsa', {
    modulusLength,
    publicExponent: 65537,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const forgePublicKey = forge.pki.publicKeyFromPem(pubKeyPem);
  const forgePrivateKey = forge.pki.privateKeyFromPem(privKeyPem);

  const cert = forge.pki.createCertificate();
  cert.publicKey = forgePublicKey;
  cert.serialNumber = String(Math.floor(Math.random() * 1000000) + 1);
  cert.validity.notBefore = notBefore;
  cert.validity.notAfter = notAfter;

  const attrs = [
    { name: 'countryName', value: 'DE' },
    { name: 'organizationName', value: 'ITSG TrustCenter fuer sonstige Leistungserbringer' },
    { name: 'organizationalUnitName', value: `IK${ik}` },
    { name: 'commonName', value: `Annahmestelle IK ${ik}` }
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  const extensions = [];
  if (keyUsageEncipherment) {
    extensions.push({
      name: 'keyUsage',
      digitalSignature: true,
      keyEncipherment: true,
      dataEncipherment: false
    });
  } else {
    extensions.push({
      name: 'keyUsage',
      digitalSignature: true,
      keyEncipherment: false,
      dataEncipherment: false
    });
  }
  cert.setExtensions(extensions);

  cert.sign(forgePrivateKey, forge.md.sha256.create());

  const certDer = forgeCertToDer(cert);
  const certPem = forge.pki.certificateToPem(cert);

  return {
    certDer,
    certPem,
    pubKeyPem,
    privKeyPem
  };
}

// Basis-Fixtures für Tests (RSA-4096, gültig, keyEncipherment, IK 123456789)
const FIXTURE_4096 = erstelleTestZertifikat({ modulusLength: 4096, ik: '123456789' });

test('A1: verschluesseleFuerEmpfaenger erzeugt gültige CMS EnvelopedData und entschluessele führt Round-Trip durch', () => {
  const samplePayload = crypto.randomBytes(1024); // Simulierte SignedData .p7m-Bytes

  const enveloped = verschluesseleFuerEmpfaenger({
    signedBytes: samplePayload,
    empfaengerZertifikatDer: FIXTURE_4096.certDer,
    erwarteteIk: '123456789',
    itsgAnkerZertifikate: [FIXTURE_4096.certDer]
  });

  assert.ok(Buffer.isBuffer(enveloped));
  assert.ok(enveloped.length > samplePayload.length);

  // Round-Trip Entschlüsselung mit Test-Funktion
  const decrypted = entschluessele({
    envelopedBytes: enveloped,
    empfaengerPrivateKeyPem: FIXTURE_4096.privKeyPem
  });

  assert.equal(Buffer.compare(samplePayload, decrypted), 0, 'Entschlüsselte Bytes müssen exakt mit Original übereinstimmen');
});

test('A2: Jede Verschlüsselung erzeugt neuen zufälligen Sitzungsschlüssel und IV', () => {
  const samplePayload = Buffer.from('Praxura Abrechnung DTA Payload');

  const env1 = verschluesseleFuerEmpfaenger({
    signedBytes: samplePayload,
    empfaengerZertifikatDer: FIXTURE_4096.certDer,
    erwarteteIk: '123456789',
    itsgAnkerZertifikate: [FIXTURE_4096.certDer]
  });

  const env2 = verschluesseleFuerEmpfaenger({
    signedBytes: samplePayload,
    empfaengerZertifikatDer: FIXTURE_4096.certDer,
    erwarteteIk: '123456789',
    itsgAnkerZertifikate: [FIXTURE_4096.certDer]
  });

  assert.notEqual(env1.toString('hex'), env2.toString('hex'), 'Zwei Verschlüsselungen desselben Inhalts müssen unterschiedliche Chiffrate haben');
});

test('A3: ASN.1-Struktur entspricht exakt der SECON-Spezifikation (GGT Anlage 16)', () => {
  const samplePayload = Buffer.from('ASN.1 Syntaxverifikation');
  const enveloped = verschluesseleFuerEmpfaenger({
    signedBytes: samplePayload,
    empfaengerZertifikatDer: FIXTURE_4096.certDer,
    erwarteteIk: '123456789',
    itsgAnkerZertifikate: [FIXTURE_4096.certDer]
  });

  const ab = enveloped.buffer.slice(enveloped.byteOffset, enveloped.byteOffset + enveloped.byteLength);
  const root = asn1js.fromBER(ab);
  assert.equal(root.offset !== -1, true, 'ASN.1 Parsing erfolgreich');

  const contentInfoSeq = root.result;
  // ContentType id-envelopedData (1.2.840.113549.1.7.3)
  const contentTypeOid = contentInfoSeq.valueBlock.value[0].valueBlock.toString();
  assert.equal(contentTypeOid, '1.2.840.113549.1.7.3');

  // [0] EXPLICIT EnvelopedData
  const envConstructed = contentInfoSeq.valueBlock.value[1];
  assert.equal(envConstructed.idBlock.tagClass, 3);
  assert.equal(envConstructed.idBlock.tagNumber, 0);

  const envData = envConstructed.valueBlock.value[0];
  // version CMSVersion = 0
  assert.equal(envData.valueBlock.value[0].valueBlock.valueDec, 0);

  // recipientInfos
  const recipientInfos = envData.valueBlock.value[1];
  assert.equal(recipientInfos.valueBlock.value.length, 1);
  const ktri = recipientInfos.valueBlock.value[0];

  // ktri.version = 0
  assert.equal(ktri.valueBlock.value[0].valueBlock.valueDec, 0);

  // rid = IssuerAndSerialNumber (kein SubjectKeyIdentifier)
  const rid = ktri.valueBlock.value[1];
  assert.equal(rid.idBlock.tagClass, 1); // Universal Sequence

  // keyEncryptionAlgorithm = id-RSAES-OAEP (1.2.840.113549.1.1.7)
  const keyEncAlg = ktri.valueBlock.value[2];
  assert.equal(keyEncAlg.valueBlock.value[0].valueBlock.toString(), '1.2.840.113549.1.1.7');

  // RSAES-OAEP-params hat 3 explizite Felder: [0] hash, [1] mgf1, [2] pSource
  const oaepParams = keyEncAlg.valueBlock.value[1];
  assert.equal(oaepParams.valueBlock.value.length, 3);
  assert.equal(oaepParams.valueBlock.value[0].idBlock.tagNumber, 0); // [0] hash
  assert.equal(oaepParams.valueBlock.value[1].idBlock.tagNumber, 1); // [1] mgf1
  assert.equal(oaepParams.valueBlock.value[2].idBlock.tagNumber, 2); // [2] pSource

  // encryptedKey ist 512 Bytes (4096 Bit RSA)
  const encryptedKeyOctet = ktri.valueBlock.value[3];
  assert.equal(encryptedKeyOctet.valueBlock.valueHexView.byteLength, 512);

  // encryptedContentInfo
  const encContentInfo = envData.valueBlock.value[2];
  // contentType = id-data (1.2.840.113549.1.7.1)
  assert.equal(encContentInfo.valueBlock.value[0].valueBlock.toString(), '1.2.840.113549.1.7.1');
  // contentEncryptionAlgorithm = id-aes256-CBC (2.16.840.1.101.3.4.1.42) mit 16-Byte-IV
  const contentEncAlg = encContentInfo.valueBlock.value[1];
  assert.equal(contentEncAlg.valueBlock.value[0].valueBlock.toString(), '2.16.840.1.101.3.4.1.42');
  const ivOctet = contentEncAlg.valueBlock.value[1];
  assert.equal(ivOctet.valueBlock.valueHexView.byteLength, 16);

  // encryptedContent = [0] IMPLICIT OCTET STRING
  const encContent = encContentInfo.valueBlock.value[2];
  assert.equal(encContent.idBlock.tagClass, 3);
  assert.equal(encContent.idBlock.tagNumber, 0);
});

test('A4: OpenSSL CLI Kreuzvalidierung — unabhängige Entschlüsselung mit openssl cms -decrypt', () => {
  // Prüfen, ob openssl installiert ist
  let opensslVersion;
  try {
    opensslVersion = execFileSync('openssl', ['version'], { encoding: 'utf8' }).trim();
  } catch (err) {
    assert.fail(`OpenSSL CLI nicht verfügbar: ${err.message}`);
  }
  assert.ok(opensslVersion, `OpenSSL gefunden: ${opensslVersion}`);

  const samplePayload = crypto.randomBytes(2048); // 2 KB Test-Nutzdaten

  const enveloped = verschluesseleFuerEmpfaenger({
    signedBytes: samplePayload,
    empfaengerZertifikatDer: FIXTURE_4096.certDer,
    erwarteteIk: '123456789',
    itsgAnkerZertifikate: [FIXTURE_4096.certDer]
  });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-test-'));
  const encFile = path.join(tempDir, 'payload.p7m');
  const certFile = path.join(tempDir, 'recip.pem');
  const keyFile = path.join(tempDir, 'recip.key');
  const outFile = path.join(tempDir, 'decrypted.bin');

  try {
    fs.writeFileSync(encFile, enveloped);
    fs.writeFileSync(certFile, FIXTURE_4096.certPem);
    fs.writeFileSync(keyFile, FIXTURE_4096.privKeyPem);

    // openssl cms -decrypt -inform DER -in <encFile> -recip <certFile> -inkey <keyFile> -out <outFile> -binary
    // Hinweis: -binary verhindert CRLF-Kanonisierung unter Windows bei Binärdaten.
    execFileSync('openssl', [
      'cms',
      '-decrypt',
      '-inform', 'DER',
      '-in', encFile,
      '-recip', certFile,
      '-inkey', keyFile,
      '-out', outFile,
      '-binary'
    ]);

    const opensslDecrypted = fs.readFileSync(outFile);
    assert.equal(
      Buffer.compare(samplePayload, opensslDecrypted),
      0,
      'OpenSSL entschlüsselte Datei muss bit-identisch mit dem Original sein'
    );
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Temp-Cleanup
    }
  }
});

test('B1: V4-Prüfung — Gültiges Zertifikat besteht alle 5 Kontrollen', () => {
  const ergebnis = pruefeEmpfaengerZertifikat({
    zertifikatDer: FIXTURE_4096.certDer,
    erwarteteIk: '123456789',
    itsgAnkerZertifikate: [FIXTURE_4096.certDer]
  });

  assert.equal(ergebnis.ok, true);
  assert.equal(ergebnis.modulusLength, 4096);
});

test('B2: V4-Prüfung — Fehlende Trust-Anchor-Liste wird mit explizitem Fehler abgewiesen', () => {
  assert.throws(
    () => pruefeEmpfaengerZertifikat({
      zertifikatDer: FIXTURE_4096.certDer,
      erwarteteIk: '123456789'
      // itsgAnkerZertifikate fehlt absichtlich
    }),
    /ITSG-Trust-Anchor-Zertifikate fehlen/
  );

  assert.throws(
    () => pruefeEmpfaengerZertifikat({
      zertifikatDer: FIXTURE_4096.certDer,
      erwarteteIk: '123456789',
      itsgAnkerZertifikate: []
    }),
    /ITSG-Trust-Anchor-Zertifikate fehlen/
  );
});

test('B3: V4-Prüfung — Abgelaufenes Zertifikat wird abgewiesen', () => {
  const pastNotBefore = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const pastNotAfter = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 Tage in der Vergangenheit

  const expiredCert = erstelleTestZertifikat({
    modulusLength: 4096,
    notBefore: pastNotBefore,
    notAfter: pastNotAfter,
    ik: '123456789'
  });

  assert.throws(
    () => pruefeEmpfaengerZertifikat({
      zertifikatDer: expiredCert.certDer,
      erwarteteIk: '123456789',
      itsgAnkerZertifikate: [expiredCert.certDer]
    }),
    /Empfängerzertifikat ist abgelaufen/
  );
});

test('B4: V4-Prüfung — Noch nicht gültiges Zertifikat wird abgewiesen', () => {
  const futureNotBefore = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // In 10 Tagen
  const futureNotAfter = new Date(Date.now() + 375 * 24 * 60 * 60 * 1000);

  const futureCert = erstelleTestZertifikat({
    modulusLength: 4096,
    notBefore: futureNotBefore,
    notAfter: futureNotAfter,
    ik: '123456789'
  });

  assert.throws(
    () => pruefeEmpfaengerZertifikat({
      zertifikatDer: futureCert.certDer,
      erwarteteIk: '123456789',
      itsgAnkerZertifikate: [futureCert.certDer]
    }),
    /Empfängerzertifikat ist noch nicht gültig/
  );
});

test('B5: V4-Prüfung — Zertifikat ohne keyEncipherment wird abgewiesen', () => {
  const noEnciphermentCert = erstelleTestZertifikat({
    modulusLength: 4096,
    keyUsageEncipherment: false,
    ik: '123456789'
  });

  assert.throws(
    () => pruefeEmpfaengerZertifikat({
      zertifikatDer: noEnciphermentCert.certDer,
      erwarteteIk: '123456789',
      itsgAnkerZertifikate: [noEnciphermentCert.certDer]
    }),
    /keyEncipherment/
  );
});

test('B6: V4-Prüfung — RSA-Schlüssellänge < 4096 Bit (z. B. 2048 Bit) wird abgewiesen', () => {
  const cert2048 = erstelleTestZertifikat({
    modulusLength: 2048,
    ik: '123456789'
  });

  assert.throws(
    () => pruefeEmpfaengerZertifikat({
      zertifikatDer: cert2048.certDer,
      erwarteteIk: '123456789',
      itsgAnkerZertifikate: [cert2048.certDer]
    }),
    /mindestens 4096 Bit erforderlich/
  );
});

test('B7: V4-Prüfung — Falsche IK im Zertifikat wird abgewiesen', () => {
  assert.throws(
    () => pruefeEmpfaengerZertifikat({
      zertifikatDer: FIXTURE_4096.certDer,
      erwarteteIk: '987654321', // Zertifikat hat 123456789
      itsgAnkerZertifikate: [FIXTURE_4096.certDer]
    }),
    /Empfängerzertifikat IK stimmt nicht mit erwarteter IK/
  );
});

test('B8: Verschlüsselungsmodul erzwingt V4-Prüfung intern und bricht bei ungültigem Zertifikat ab', () => {
  const cert2048 = erstelleTestZertifikat({
    modulusLength: 2048,
    ik: '123456789'
  });

  assert.throws(
    () => verschluesseleFuerEmpfaenger({
      signedBytes: Buffer.from('test'),
      empfaengerZertifikatDer: cert2048.certDer,
      erwarteteIk: '123456789',
      itsgAnkerZertifikate: [cert2048.certDer]
    }),
    /mindestens 4096 Bit erforderlich/
  );
});
