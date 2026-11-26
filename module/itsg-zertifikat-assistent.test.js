import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import forge from 'node-forge';
import {
  bereinigePrintableString,
  baueItsgSubjectDn,
  erzeugeItsgAntragP10,
  buendleP7cZuP12,
  extrahiereRohCertsAusP7c,
} from './itsg-zertifikat-assistent.js';
import {
  entschluesseleP12UndSigniere,
  extrahiereRohCertDerAusForgeBag,
  uint8ToBinStr,
} from './dta-signatur.js';

describe('module/itsg-zertifikat-assistent.js (F4)', () => {
  it('transliteriert Umlaute und erlaubt nur SECON §4.4.4 PrintableString-Zeichen', () => {
    assert.equal(bereinigePrintableString('Podologie Müller & Söhne (GmbH)'), 'Podologie Mueller Soehne (GmbH)');
    assert.equal(bereinigePrintableString('Straße 12/A - Übung'), 'Strasse 12/A - Uebung');
  });

  it('baut SECON-Subject-DN in exakter Reihenfolge C, O, OU(Praxis), OU(IK), CN', () => {
    const dn = baueItsgSubjectDn({
      praxisName: 'Praxis Südstadt',
      ik: '590537440',
      ansprechpartner: 'Jörg Weiß',
    });
    assert.equal(
      dn.subjectText,
      'C=DE, O=ITSG TrustCenter fuer sonstige Leistungserbringer, OU=Praxis Suedstadt, OU=IK590537440, CN=Joerg Weiss'
    );
  });

  it('erzeugt gültige .p10 (RSASSA-PSS) verifiziert mit OpenSSL und bündelt .p7c → .p12 bis zur Signatur', async () => {
    const antrag = await erzeugeItsgAntragP10({
      praxisName: 'Praxura Softwaretest',
      ik: '590537440',
      ansprechpartner: 'Max Mustermann',
      keyPasswort: 'MeinSicheresKeyPasswort1!',
      forge,
      modulusLength: 2048, // im Unit-Test 2048 für Geschwindigkeit; UI nutzt fest 4096
    });

    assert.equal(antrag.p10Dateiname, '590537440.p10');
    assert.equal(antrag.keyDateiname, '590537440.key.pem');
    assert.match(antrag.sha256Hex, /^[0-9A-F]{64}$/);
    assert.ok(antrag.encryptedPrivateKeyPem.includes('BEGIN ENCRYPTED PRIVATE KEY'));

    // 1. Mit OpenSSL prüfen: PKCS#10 Signatur + Subject-DN + RSASSA-PSS + saltLength 32
    const dir = mkdtempSync(join(tmpdir(), 'praxura-f4-'));
    try {
      const p10Path = join(dir, '590537440.p10');
      writeFileSync(p10Path, antrag.p10Bytes);
      const reqOut = execFileSync('openssl', ['req', '-in', p10Path, '-inform', 'DER', '-verify', '-text', '-noout'], {
        encoding: 'utf8',
      });
      assert.ok(reqOut.includes('C=DE'), 'C=DE muss im CSR stehen');
      assert.ok(reqOut.includes('ITSG TrustCenter fuer sonstige Leistungserbringer'), 'O muss ITSG sein');
      assert.ok(reqOut.includes('OU=IK590537440'), 'OU=IK590537440 muss im CSR stehen');
      assert.ok(reqOut.includes('CN=Max Mustermann'), 'CN muss im CSR stehen');
      assert.ok(reqOut.includes('rsassaPss'), 'CSR muss mit RSASSA-PSS signiert sein');
      assert.match(reqOut, /Salt Length:\s*(32|0x20)/i, 'CSR saltLength muss 32 sein');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    // 2. Synthetische ITSG-.p7c-Antwort (degeneriertes SignedData) für diesen Public Key bauen
    const privKey = forge.pki.decryptRsaPrivateKey(antrag.encryptedPrivateKeyPem, 'MeinSicheresKeyPasswort1!');
    const pubKey = forge.pki.setRsaPublicKey(privKey.n, privKey.e);
    const cert = forge.pki.createCertificate();
    cert.publicKey = pubKey;
    cert.serialNumber = '098765';
    cert.validity.notBefore = new Date('2026-01-01T00:00:00Z');
    cert.validity.notAfter = new Date('2028-01-01T00:00:00Z');
    const attrs = [
      { name: 'countryName', value: 'DE' },
      { name: 'organizationName', value: 'ITSG TrustCenter fuer sonstige Leistungserbringer' },
      { shortName: 'OU', value: 'Praxura Softwaretest' },
      { shortName: 'OU', value: 'IK590537440' },
      { name: 'commonName', value: 'Max Mustermann' },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(privKey, forge.md.sha256.create());

    const p7 = forge.pkcs7.createSignedData();
    p7.addCertificate(cert);
    const p7cBin = forge.asn1.toDer(p7.toAsn1()).getBytes();
    const p7cBytes = new Uint8Array(p7cBin.length);
    for (let i = 0; i < p7cBin.length; i++) p7cBytes[i] = p7cBin.charCodeAt(i) & 0xff;

    // 3. .p7c + Schlüssel → .p12 bündeln
    const p12Res = buendleP7cZuP12({
      p7cBytes,
      encryptedPrivateKeyPem: antrag.encryptedPrivateKeyPem,
      keyPasswort: 'MeinSicheresKeyPasswort1!',
      p12Pin: 'neue-p12-pin',
      forge,
    });
    assert.equal(p12Res.p12Dateiname, '590537440.p12');
    assert.equal(p12Res.certCount, 1);

    // 4. Ende-zu-Ende: Die erzeugte .p12 direkt mit F1 (entschluesseleP12UndSigniere) nutzen!
    const sigRes = await entschluesseleP12UndSigniere({
      p12Bytes: p12Res.p12Bytes,
      pin: 'neue-p12-pin',
      dtaBytes: new Uint8Array(Buffer.from("UNB+UNOC:3+590537440+107436557+261126:1200+00001'", 'latin1')),
      forge,
    });
    assert.ok(sigRes.signedBytes.length > 200);
    assert.ok(sigRes.certSubject.includes('IK590537440'));
  });

  it('bewahrt echte ITSG RSASSA-PSS-Zertifikate 100 % byte-identisch (kein forge-CA-Signaturbruch)', () => {
    const azeDer = new Uint8Array(readFileSync('api-backend/billing/dta/trust-anchors/anchor-dc5d1604b7f639e5.der'));
    const rawAsn1 = forge.asn1.fromDer(uint8ToBinStr(azeDer));
    const cert = forge.pki.certificateFromAsn1(rawAsn1);

    // Simuliere .p12-Bag mit Original-ASN.1 und prüfe Byte-Identität via extrahiereRohCertDerAusForgeBag
    const bag = { cert, asn1: rawAsn1 };
    const roundtrip = extrahiereRohCertDerAusForgeBag(bag, forge);
    assert.deepEqual(roundtrip, azeDer, 'Echtes ITSG RSASSA-PSS-Zertifikat muss 100 % byte-identisch bleiben');
    assert.equal(typeof extrahiereRohCertsAusP7c, 'function');
  });
});
