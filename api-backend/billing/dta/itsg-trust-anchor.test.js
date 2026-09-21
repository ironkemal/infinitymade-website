// § 302 SGB V SECON — ITSG Trust Anchor Modul Tests.
// Ausführung: node --test api-backend/billing/dta/itsg-trust-anchor.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import forge from 'node-forge';

import {
  parseAnnahmeliste,
  schreibeItsgTrustAnchors,
  ladeItsgTrustAnchors,
  pruefeTrustAnchorFrische
} from './itsg-trust-anchor.js';

import { pruefeEmpfaengerZertifikat } from './empfaenger-zertifikat-pruefung.js';

// Hilfsfunktion: Konvertiert Forge-Zertifikat in DER-Buffer
function forgeCertToDer(forgeCert) {
  const asn1 = forge.pki.certificateToAsn1(forgeCert);
  const derHex = forge.asn1.toDer(asn1).toHex();
  return Buffer.from(derHex, 'hex');
}

test('Test 1: parseAnnahmeliste parst synthetische PKCS#7 SignedData .p7b Bündeldatei (openssl crl2pkcs7)', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'itsg-p7b-test-'));
  const k1 = path.join(tempDir, 'k1.pem');
  const c1 = path.join(tempDir, 'c1.pem');
  const k2 = path.join(tempDir, 'k2.pem');
  const c2 = path.join(tempDir, 'c2.pem');
  const bundleP7b = path.join(tempDir, 'bundle.p7b');

  try {
    // 2 selbstsignierte Zertifikate mit openssl erzeugen
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-keyout', k1, '-out', c1,
      '-days', '365', '-nodes', '-subj', '/CN=ITSG-Test-Anker-1/O=ITSG-Test'
    ]);
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-keyout', k2, '-out', c2,
      '-days', '365', '-nodes', '-subj', '/CN=ITSG-Test-Anker-2/O=ITSG-Test'
    ]);

    // Zu degeneriertem PKCS#7 Zertifikatsbündel bündeln (openssl crl2pkcs7 -nocrl)
    execFileSync('openssl', [
      'crl2pkcs7', '-nocrl', '-certfile', c1, '-certfile', c2,
      '-outform', 'DER', '-out', bundleP7b
    ]);

    const p7bBytes = fs.readFileSync(bundleP7b);
    const certs = parseAnnahmeliste(p7bBytes);

    assert.equal(certs.length, 2, 'Genau 2 Zertifikate müssen extrahiert werden');

    // Beide Zertifikate prüfen
    const subjects = certs.map(c => c.subject);
    assert.ok(subjects.some(s => s.includes('CN=ITSG-Test-Anker-1')), 'Anker 1 Subject vorhanden');
    assert.ok(subjects.some(s => s.includes('CN=ITSG-Test-Anker-2')), 'Anker 2 Subject vorhanden');

    for (const c of certs) {
      assert.ok(Buffer.isBuffer(c.der), 'der muss ein Buffer sein');
      assert.ok(c.der.length > 0, 'der darf nicht leer sein');
      assert.equal(c.sha256.length, 64, 'sha256 muss 64 hex zeichen sein');
      assert.ok(c.notBefore instanceof Date, 'notBefore muss Date sein');
      assert.ok(c.notAfter instanceof Date, 'notAfter muss Date sein');
      assert.ok(c.notAfter > c.notBefore, 'notAfter muss nach notBefore liegen');

      // Verifizieren, dass der berechnete sha256 mit den DER-Bytes übereinstimmt
      const expectedSha256 = crypto.createHash('sha256').update(c.der).digest('hex').toLowerCase();
      assert.equal(c.sha256, expectedSha256, 'SHA-256 Fingerprint stimmt mit DER überein');
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Test 2: schreibeItsgTrustAnchors -> ladeItsgTrustAnchors Round-Trip in Temp-Verzeichnis', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'itsg-roundtrip-test-'));

  try {
    // 2 Test-Zertifikats-Buffer erstellen
    const certDer1 = crypto.randomBytes(512);
    const certDer2 = crypto.randomBytes(640);
    const sha1 = crypto.createHash('sha256').update(certDer1).digest('hex');
    const sha2 = crypto.createHash('sha256').update(certDer2).digest('hex');

    const testCerts = [
      {
        der: certDer1,
        sha256: sha1,
        subject: 'CN=Anker 1',
        issuer: 'CN=Root 1',
        notBefore: new Date('2025-01-01T00:00:00.000Z'),
        notAfter: new Date('2028-12-31T23:59:59.000Z')
      },
      {
        der: certDer2,
        sha256: sha2,
        subject: 'CN=Anker 2',
        issuer: 'CN=Root 2',
        notBefore: new Date('2025-06-01T00:00:00.000Z'),
        notAfter: new Date('2029-06-01T00:00:00.000Z')
      }
    ];

    const metaGeschrieben = schreibeItsgTrustAnchors({
      certs: testCerts,
      verzeichnis: tempDir,
      quelle: 'https://trustcenter-data.itsg.de/dale/annahme-rsa4096.key',
      quelleDatum: '2026-09-21',
      onaylayan: 'CI-Bot'
    });

    assert.equal(metaGeschrieben.ankerAnzahl, 2);
    assert.equal(metaGeschrieben.quelleDatum, '2026-09-21');
    assert.equal(metaGeschrieben.onaylayan, 'CI-Bot');

    // Prüfen, ob meta.json und .der Dateien existieren (16-Hex-Präfix)
    assert.ok(fs.existsSync(path.join(tempDir, 'meta.json')));
    assert.ok(fs.existsSync(path.join(tempDir, `anchor-${sha1.slice(0, 16)}.der`)));
    assert.ok(fs.existsSync(path.join(tempDir, `anchor-${sha2.slice(0, 16)}.der`)));

    // Wieder einladen
    const geladen = ladeItsgTrustAnchors({ verzeichnis: tempDir });
    assert.ok(geladen.meta, 'Metadaten müssen geladen werden');
    assert.equal(geladen.anchors.length, 2, 'Genau 2 Anker müssen geladen werden');

    // Byte-Identität prüfen (Buffer.compare === 0)
    assert.equal(Buffer.compare(geladen.anchors[0], certDer1), 0, 'Anker 1 DER-Bytes sind byte-identisch');
    assert.equal(Buffer.compare(geladen.anchors[1], certDer2), 0, 'Anker 2 DER-Bytes sind byte-identisch');

    assert.equal(geladen.meta.quelle, 'https://trustcenter-data.itsg.de/dale/annahme-rsa4096.key');
    assert.equal(geladen.meta.zertifikate.length, 2);
    assert.equal(geladen.meta.zertifikate[0].sha256, sha1);
    assert.equal(geladen.meta.zertifikate[1].sha256, sha2);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Test 3: pruefeTrustAnchorFrische — Gültig, Vorwarnung (30 Tage), Einzelner abgelaufen (Warnung), Alle abgelaufen (Stopp)', () => {
  const pruefzeit = new Date('2026-09-21T12:00:00.000Z');

  // Fall (a): Anker weit in der Zukunft gültig (> 60 Tage, z. B. bis 2028/2029)
  const metaZukunft = {
    quelle: 'test',
    zertifikate: [
      { datei: 'a.der', sha256: 'abc', notAfter: '2028-12-31T23:59:59.000Z' },
      { datei: 'b.der', sha256: 'def', notAfter: '2029-06-30T23:59:59.000Z' }
    ]
  };
  const resZukunft = pruefeTrustAnchorFrische({ meta: metaZukunft, jetzt: pruefzeit, warnTageVorher: 60 });
  assert.equal(resZukunft.ok, true);
  assert.equal(resZukunft.warnung, null, 'Keine Warnung bei Gültigkeit weit in der Zukunft');
  assert.equal(resZukunft.ankerGueltigBis.toISOString(), '2029-06-30T23:59:59.000Z', 'ankerGueltigBis ist spätestes notAfter');
  assert.equal(resZukunft.fruehesterAblauf.toISOString(), '2028-12-31T23:59:59.000Z', 'fruehesterAblauf ist frühestes notAfter');

  // Fall (b): Ein Anker läuft in 30 Tagen ab (innerhalb der 60 Tage Vorwarnzeit)
  const datumIn30Tagen = new Date(pruefzeit.getTime() + 30 * 24 * 60 * 60 * 1000);
  const metaBaldAbgelaufen = {
    quelle: 'test',
    zertifikate: [
      { datei: 'a.der', sha256: 'abc', notAfter: datumIn30Tagen.toISOString() },
      { datei: 'b.der', sha256: 'def', notAfter: '2028-12-31T23:59:59.000Z' }
    ]
  };
  const resBaldAbgelaufen = pruefeTrustAnchorFrische({ meta: metaBaldAbgelaufen, jetzt: pruefzeit, warnTageVorher: 60 });
  assert.equal(resBaldAbgelaufen.ok, true);
  assert.ok(typeof resBaldAbgelaufen.warnung === 'string' && resBaldAbgelaufen.warnung.length > 0, 'Warnung muss gesetzt sein');
  assert.match(resBaldAbgelaufen.warnung, /läuft in 30 Tagen ab/, 'Warnung muss verbleibende Tage nennen');
  assert.equal(resBaldAbgelaufen.ankerGueltigBis.toISOString(), '2028-12-31T23:59:59.000Z');
  assert.equal(resBaldAbgelaufen.fruehesterAblauf.toISOString(), datumIn30Tagen.toISOString());

  // Fall (c): EIN Anker bereits abgelaufen, aber ANDERE noch gültig (Semantik: nur warnen, ok: true, kein harter Stopp)
  const datumAbgelaufen = new Date(pruefzeit.getTime() - 5 * 24 * 60 * 60 * 1000);
  const metaEinzelnAbgelaufen = {
    quelle: 'test',
    zertifikate: [
      { datei: 'a.der', sha256: 'abc', notAfter: datumAbgelaufen.toISOString() },
      { datei: 'b.der', sha256: 'def', notAfter: '2028-12-31T23:59:59.000Z' }
    ]
  };
  const resEinzelnAbgelaufen = pruefeTrustAnchorFrische({ meta: metaEinzelnAbgelaufen, jetzt: pruefzeit, warnTageVorher: 60 });
  assert.equal(resEinzelnAbgelaufen.ok, true, 'Einzelner abgelaufener Anker darf noch gültige Kassen nicht blockieren');
  assert.ok(typeof resEinzelnAbgelaufen.warnung === 'string', 'Warnung muss gesetzt sein');
  assert.match(resEinzelnAbgelaufen.warnung, /bereits abgelaufen/, 'Warnung muss auf abgelaufenen Anker hinweisen');
  assert.equal(resEinzelnAbgelaufen.ankerGueltigBis.toISOString(), '2028-12-31T23:59:59.000Z');
  assert.equal(resEinzelnAbgelaufen.fruehesterAblauf.toISOString(), datumAbgelaufen.toISOString());

  // Fall (d): ALLE Anker im Store sind abgelaufen (harter Stopp — wirft Exception)
  const metaAlleAbgelaufen = {
    quelle: 'test',
    zertifikate: [
      { datei: 'a.der', sha256: 'abc', notAfter: datumAbgelaufen.toISOString() },
      { datei: 'b.der', sha256: 'def', notAfter: new Date(pruefzeit.getTime() - 1000).toISOString() }
    ]
  };
  assert.throws(
    () => pruefeTrustAnchorFrische({ meta: metaAlleAbgelaufen, jetzt: pruefzeit, warnTageVorher: 60 }),
    /vollständig abgelaufen/,
    'Muss mit Fehler abbrechen, wenn der gesamte Store abgelaufen ist'
  );
});

test('Test 4: Integrationstest — echte Zertifikatskette (Anker = CA, Empfänger = von CA signiert, Anker != Empfänger)', () => {
  // 1) CA-Schlüsselpaar und CA-Zertifikat (Vertrauensanker, RSA-4096)
  const { publicKey: caPubPem, privateKey: caPrivPem } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicExponent: 65537,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const caForgePub = forge.pki.publicKeyFromPem(caPubPem);
  const caForgePriv = forge.pki.privateKeyFromPem(caPrivPem);

  const caCert = forge.pki.createCertificate();
  caCert.publicKey = caForgePub;
  caCert.serialNumber = '10001';
  caCert.validity.notBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
  caCert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const caAttrs = [
    { name: 'countryName', value: 'DE' },
    { name: 'organizationName', value: 'ITSG TrustCenter fuer sonstige Leistungserbringer' },
    { name: 'commonName', value: 'ITSG TrustCenter Root CA' }
  ];
  caCert.setSubject(caAttrs);
  caCert.setIssuer(caAttrs);
  caCert.setExtensions([
    { name: 'basicConstraints', cA: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true }
  ]);
  caCert.sign(caForgePriv, forge.md.sha256.create());
  const ankerCertDer = forgeCertToDer(caCert);

  // 2) Empfängerschlüsselpaar und Empfängerzertifikat (vom Anker signiert, RSA-4096, IK661430035)
  const { publicKey: leafPubPem } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicExponent: 65537,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const leafForgePub = forge.pki.publicKeyFromPem(leafPubPem);
  const leafCert = forge.pki.createCertificate();
  leafCert.publicKey = leafForgePub;
  leafCert.serialNumber = '10002';
  leafCert.validity.notBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
  leafCert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const leafAttrs = [
    { name: 'countryName', value: 'DE' },
    { name: 'organizationName', value: 'ITSG TrustCenter fuer sonstige Leistungserbringer' },
    { name: 'organizationalUnitName', value: 'IK661430035' },
    { name: 'commonName', value: 'Davaso Datenannahmestelle' }
  ];
  leafCert.setSubject(leafAttrs);
  leafCert.setIssuer(caAttrs); // Ausgestellt von der CA!
  leafCert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true }
  ]);
  // Wichtig: Signiert mit dem PRIVATEN Schlüssel der CA (Anker)
  leafCert.sign(caForgePriv, forge.md.sha256.create());
  const empfaengerCertDer = forgeCertToDer(leafCert);

  // Bestätigen, dass Anker und Empfängerzertifikat NICHT identisch sind
  assert.notEqual(Buffer.compare(ankerCertDer, empfaengerCertDer), 0, 'Anker und Empfängerzertifikat dürfen nicht identisch sein');

  // Prüfen über das existierende empfaenger-zertifikat-pruefung.js Modul
  // Muss über x509Cert.checkIssued(ankerX509) / verify(ankerX509.publicKey) validieren
  const pruefErgebnis = pruefeEmpfaengerZertifikat({
    zertifikatDer: empfaengerCertDer,
    erwarteteIk: '661430035',
    itsgAnkerZertifikate: [ankerCertDer]
  });

  assert.equal(pruefErgebnis.ok, true, 'Zertifikatsketten-Prüfung muss bestanden werden');
  assert.equal(pruefErgebnis.modulusLength, 4096, 'Modulus muss 4096 Bit sein');
  assert.match(pruefErgebnis.subject, /IK661430035/, 'Subject muss IK enthalten');
});

test('Test 5: parseAnnahmeliste parst Base64-Blöcke (ITSG-Format annahme-rsa4096.key)', () => {
  // 2 Zertifikate mit openssl generieren und als rohe Base64-Blöcke (ohne PEM-Header) formatieren
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'itsg-b64-test-'));
  const k1 = path.join(tempDir, 'k1.pem');
  const c1 = path.join(tempDir, 'c1.pem');
  const k2 = path.join(tempDir, 'k2.pem');
  const c2 = path.join(tempDir, 'c2.pem');

  try {
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-keyout', k1, '-out', c1,
      '-days', '365', '-nodes', '-subj', '/CN=Base64-Anker-1'
    ]);
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-keyout', k2, '-out', c2,
      '-days', '365', '-nodes', '-subj', '/CN=Base64-Anker-2'
    ]);

    const pem1 = fs.readFileSync(c1, 'utf8');
    const pem2 = fs.readFileSync(c2, 'utf8');

    // Headers entfernen, wie in der echten annahme-rsa4096.key
    const b64_1 = pem1.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----/g, '').trim();
    const b64_2 = pem2.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----/g, '').trim();

    const itsgFormatText = `${b64_1}\n\n${b64_2}\n`;
    const certs = parseAnnahmeliste(Buffer.from(itsgFormatText, 'utf8'));

    assert.equal(certs.length, 2, 'Genau 2 Zertifikate aus Base64-Blöcken geparst');
    assert.ok(certs[0].subject.includes('Base64-Anker-1') || certs[1].subject.includes('Base64-Anker-1'));
    assert.ok(certs[0].subject.includes('Base64-Anker-2') || certs[1].subject.includes('Base64-Anker-2'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Test 6: Fehlerbehandlung bei ungültigen Eingaben', () => {
  // Leere/ungültige Eingaben bei parseAnnahmeliste
  assert.throws(() => parseAnnahmeliste(null), /Annahmeliste-Daten fehlen oder sind leer/);
  assert.throws(() => parseAnnahmeliste(Buffer.alloc(0)), /Annahmeliste-Daten fehlen oder sind leer/);
  assert.throws(() => parseAnnahmeliste(Buffer.from('beschädigte ungültige daten')), /Annahmeliste enthält keine gültigen X.509-Zertifikate/);

  // schreibeItsgTrustAnchors ohne Zertifikate
  assert.throws(() => schreibeItsgTrustAnchors({ certs: [] }), /Keine Zertifikate zum Schreiben übergeben/);

  // ladeItsgTrustAnchors auf nicht-existentem Ordner wirft NICHT
  const leer = ladeItsgTrustAnchors({ verzeichnis: '/pfad/existiert/garantiert/nicht/' });
  assert.deepEqual(leer, { anchors: [], meta: null });

  // pruefeTrustAnchorFrische ohne Zertifikate
  assert.throws(() => pruefeTrustAnchorFrische({ meta: null }), /ITSG-Trust-Anchor-Metadaten fehlen/);
  assert.throws(() => pruefeTrustAnchorFrische({ meta: { zertifikate: [] } }), /ITSG-Trust-Anchor-Metadaten fehlen/);
});

test('Test 7: schreibeItsgTrustAnchors bricht bei Dateinamenskollision zweier unterschiedlicher Zertifikate mit gleichem 16-Hex-Präfix ab', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'itsg-collision-test-'));

  try {
    const certDer1 = crypto.randomBytes(512);
    const certDer2 = crypto.randomBytes(640);

    // Künstlich konstruierter gleicher 16-Zeichen-Präfix, aber unterschiedliche Gesamthashes
    const prefix16 = '0123456789abcdef';
    const sha1 = prefix16 + '111111111111111111111111111111111111111111111111';
    const sha2 = prefix16 + '222222222222222222222222222222222222222222222222';

    const testCerts = [
      {
        der: certDer1,
        sha256: sha1,
        subject: 'CN=Kollision 1',
        issuer: 'CN=Root',
        notBefore: new Date('2025-01-01T00:00:00.000Z'),
        notAfter: new Date('2028-12-31T23:59:59.000Z')
      },
      {
        der: certDer2,
        sha256: sha2,
        subject: 'CN=Kollision 2',
        issuer: 'CN=Root',
        notBefore: new Date('2025-01-01T00:00:00.000Z'),
        notAfter: new Date('2028-12-31T23:59:59.000Z')
      }
    ];

    // Dokumentiertes beobachtetes Verhalten:
    // schreibeItsgTrustAnchors() schreibt das erste Zertifikat, erkennt beim zweiten Zertifikat
    // dieselbe Zieldatei (anchor-0123456789abcdef.der) für einen unterschiedlichen SHA-256-Hash,
    // und wirft sofort mit einer Dateinamenskollisions-Exception ab.
    // Resultat auf der Festplatte: Nur die erste Datei wurde angelegt, meta.json wurde nicht geschrieben.
    assert.throws(
      () => schreibeItsgTrustAnchors({ certs: testCerts, verzeichnis: tempDir }),
      /Dateinamenskollision/,
      'Muss bei unterschiedlichen Zertifikaten mit gleichem Dateinamen abbrechen'
    );

    // Bestätigung des tatsächlichen Dateisystem-Zustands:
    // Erste Datei existiert, meta.json wurde durch den vorzeitigen Abbruch NICHT angelegt
    assert.ok(fs.existsSync(path.join(tempDir, `anchor-${prefix16}.der`)), 'Erste Datei vor Abbruch angelegt');
    assert.ok(!fs.existsSync(path.join(tempDir, 'meta.json')), 'meta.json wurde wegen Abbruch nicht geschrieben');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

