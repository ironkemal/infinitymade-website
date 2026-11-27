// End-to-End-Pipeline-Test für den §302 E-Mail-Weg ohne dakota.le (F1 → F2 → F3 → F5 → F10)
// am realen AZE-Testsatz (Klass-68-IK 590537440 → AZE Emmendingen 107436557, mhplus BKK 108035612).
//
// Beweist die vollständige lokale Versandkette ohne DB und ohne externe Netzwerkaufrufe:
//   1. buildDtaFile() erzeugt TSOL0001 + 348-Byte-Auftragsdatei (00/00)
//   2. entschluesseleP12UndSigniere() signiert per WebCrypto RSASSA-PSS (F1)
//   3. pruefeSignedDta(checkCertValidity: true) verifiziert Signatur + Ablaufdatum (F1/F10)
//   4. findeEmpfaengerZertifikatInTrustAnchors('107436557') + verschluesseleFuerEmpfaenger() (F3)
//   5. aktualisiereAuftragsdateiFuerVerschluesselung() setzt 03/03 + verschlüsselte Bytegröße (F2)
//   6. buildVersandDateinamen('TSOL0001') liefert exakt TSOL0001 + TSOL0001.AUF (F5)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import forge from 'node-forge';
import { buildDtaFile } from './builder.js';
import { pruefeSignedDta } from './signed-original.js';
import { ladeItsgTrustAnchors, findeEmpfaengerZertifikatInTrustAnchors } from './itsg-trust-anchor.js';
import { verschluesseleFuerEmpfaenger } from './verschluesselung.js';
import { aktualisiereAuftragsdateiFuerVerschluesselung } from './auftragsdatei.js';
import { buildVersandDateinamen } from './filename.js';
import { entschluesseleP12UndSigniere } from '../../../module/dta-signatur.js';

function erstelleSynthetischeP12() {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '010203';
  cert.validity.notBefore = new Date('2026-01-01T00:00:00Z');
  cert.validity.notAfter = new Date('2028-12-31T23:59:59Z');
  const attrs = [
    { name: 'countryName', value: 'DE' },
    { name: 'organizationName', value: 'ITSG TrustCenter fuer sonstige Leistungserbringer' },
    { shortName: 'OU', value: 'Praxura Softwaretest' },
    { shortName: 'OU', value: 'IK590537440' },
    { name: 'commonName', value: 'Test Signer' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'test-pin', { algorithm: '3des' });
  const bin = forge.asn1.toDer(p12Asn1).getBytes();
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 0xff;
  return bytes;
}

describe('AZE E2E-Pipeline (F1 → F2 → F3 → F5 → F10)', () => {
  it('erzeugt signiertes & AZE-verschlüsseltes Versandpaar TSOL0001 + TSOL0001.AUF (03/03)', async () => {
    // 1. DTA + Roh-Auftragsdatei (00/00) für AZE (107436557) / mhplus BKK (108035612)
    const dta = buildDtaFile({
      absender: { ik: '590537440', name: 'Praxura Softwaretest' },
      empfaenger: { ik: '107436557', name: 'Abrechnungszentrum Emmendingen' },
      davIk: '107436557',
      kassenart: 'BK',
      rechnung: {
        sammelRechnungsnummer: 'T2026-11-001',
        einzelRechnungsnummer: '0',
        datum: '2026-11-27',
        datennummer: 1,
        rechnungsart: '1',
      },
      kind: 'test',
      transfernummer: 1,
      vkz: '01',
      prescriptions: [
        {
          patient: {
            kvnr: 'T100000015',
            versichertenstatus: '10000',
            nachname: 'Probe',
            vorname: 'Anna',
            geburtsdatum: '1952-03-14',
            strasse: 'Teststraße 1',
            plz: '53721',
            ort: 'Siegburg',
            belegnummer: '0000001',
          },
          verordnung: {
            arztLanr: '999999900',
            arztBsnr: '999999999',
            ausstellungsdatum: '2026-10-15',
            icd10: 'E11.74',
            diagnosegruppe: 'DF',
            verordnungsart: '03',
            leitsymptomatik: '1010',
            dringend: false,
            hausbesuch: false,
            heilmittelBereich: '2',
            therapiefrequenz: '0',
            zuzahlungskennzeichen: '3',
            kostentraegerIk: '108035612',
            krankenkasseIk: '108035612',
          },
          tarif: { abrechnungscode: '71', tarifkennzeichen: '00501' },
          sessions: [
            { positionsnummer: '78020', datumLeistung: '2026-10-20', anzahl: 1, einzelbetrag: 48.87, zuzahlungProPos: 4.89 },
          ],
        },
      ],
    });

    assert.equal(dta.filename, 'TSOL0001');
    assert.equal(dta.auftragsdatei.length, 348);
    assert.equal(dta.auftragsdatei.slice(206, 210), '0000');

    const dtaBuf = Buffer.from(dta.content, 'latin1');
    const dtaSha256 = createHash('sha256').update(dtaBuf).digest('hex');

    // 2. RSASSA-PSS-Signatur (F1)
    const p12Bytes = erstelleSynthetischeP12();
    const sig = await entschluesseleP12UndSigniere({
      p12Bytes,
      pin: 'test-pin',
      dtaBytes: new Uint8Array(dtaBuf),
      forge,
    });
    const signedBuf = Buffer.from(sig.signedBytes);

    // 3. Backend-Signatur- & Ablaufprüfung (F1 + F10)
    const extrahiert = await pruefeSignedDta({
      signedBytes: signedBuf,
      expectedDtaSha256: dtaSha256,
      checkCertValidity: true,
      now: new Date('2026-11-27T12:00:00Z'),
    });
    assert.ok(extrahiert.equals(dtaBuf));

    // 4. Empfängerzertifikat AZE (107436557) direkt aus Trust-Anchors + Verschlüsselung (F3)
    const { anchors } = ladeItsgTrustAnchors();
    const azeCert = findeEmpfaengerZertifikatInTrustAnchors('107436557', {
      jetzt: new Date('2026-11-27T12:00:00Z'),
    });
    assert.ok(azeCert, 'AZE-Empfängerzertifikat (107436557) muss in trust-anchors/ vorliegen');

    const encryptedBuf = verschluesseleFuerEmpfaenger({
      signedBytes: signedBuf,
      empfaengerZertifikatDer: azeCert.zertifikat_der,
      erwarteteIk: '107436557',
      itsgAnkerZertifikate: anchors,
      pruefDatum: new Date('2026-11-27T12:00:00Z'),
    });
    assert.ok(encryptedBuf.length > signedBuf.length);

    // 5. Auftragsdatei auf 03/03 + verschlüsselte Bytegröße aktualisieren (F2)
    const auf03 = aktualisiereAuftragsdateiFuerVerschluesselung(dta.auftragsdatei, encryptedBuf.length);
    assert.equal(auf03.length, 348);
    assert.equal(auf03.slice(178, 190), String(dtaBuf.length).padStart(12, '0'));
    assert.equal(auf03.slice(190, 202), String(encryptedBuf.length).padStart(12, '0'));
    assert.equal(auf03.slice(206, 210), '0303');

    // 6. Versand-Dateinamen (F5)
    const namen = buildVersandDateinamen(dta.filename);
    assert.deepEqual(namen, { nutzdatei: 'TSOL0001', auftragsdatei: 'TSOL0001.AUF' });
  });
});
