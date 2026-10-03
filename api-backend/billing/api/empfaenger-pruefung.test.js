// § 302 SGB V Abrechnung — Empfänger-Zertifikatsprüfung (GET /abrechnung/:id/empfaenger-pruefung)
// Tests für Authentifizierung, Mandantentrennung, DB-Abfrage und vollständige V4-PKI-Prüfung.
// Ausführung: node --test api-backend/billing/api/empfaenger-pruefung.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import forge from 'node-forge';

// Dummy env vars damit Supabase createClient beim Import nicht wirft
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

const { handleEmpfaengerPruefung, ermittleEmpfaengerZertifikatStatus } = await import('./abrechnung.routes.js');
import { pruefeTrustAnchorFrische } from '../dta/itsg-trust-anchor.js';

function forgeCertToDer(forgeCert) {
  const asn1 = forge.pki.certificateToAsn1(forgeCert);
  const derHex = forge.asn1.toDer(asn1).toHex();
  return Buffer.from(derHex, 'hex');
}

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Erzeugt ein synthetisches CA- und Blattzertifikat für PKI-Tests
 */
function createSyntheticPki({
  caModulusLength = 4096,
  leafModulusLength = 4096,
  leafIk = '661430035',
  leafKeyEncipherment = true,
  leafNotBeforeDays = -1,
  leafNotAfterDays = 365,
  signWithUntrustedCa = false,
} = {}) {
  // CA
  const { publicKey: caPubPem, privateKey: caPrivPem } = crypto.generateKeyPairSync('rsa', {
    modulusLength: caModulusLength,
    publicExponent: 65537,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
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
    { name: 'organizationName', value: 'ITSG TrustCenter Test' },
    { name: 'commonName', value: 'ITSG TrustCenter Root CA' },
  ];
  caCert.setSubject(caAttrs);
  caCert.setIssuer(caAttrs);
  caCert.setExtensions([
    { name: 'basicConstraints', cA: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true },
  ]);
  caCert.sign(caForgePriv, forge.md.sha256.create());
  const caDer = forgeCertToDer(caCert);

  // Zweite untrusted CA falls gefordert
  let signingPrivKey = caForgePriv;
  let signingIssuerAttrs = caAttrs;
  if (signWithUntrustedCa) {
    const { publicKey: uPubPem, privateKey: uPrivPem } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicExponent: 65537,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    signingPrivKey = forge.pki.privateKeyFromPem(uPrivPem);
    signingIssuerAttrs = [
      { name: 'countryName', value: 'DE' },
      { name: 'organizationName', value: 'Untrusted Rogue CA' },
      { name: 'commonName', value: 'Rogue CA' },
    ];
  }

  // Blattzertifikat
  const { publicKey: leafPubPem } = crypto.generateKeyPairSync('rsa', {
    modulusLength: leafModulusLength,
    publicExponent: 65537,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const leafForgePub = forge.pki.publicKeyFromPem(leafPubPem);
  const leafCert = forge.pki.createCertificate();
  leafCert.publicKey = leafForgePub;
  leafCert.serialNumber = '10002';
  leafCert.validity.notBefore = new Date(Date.now() + leafNotBeforeDays * 24 * 60 * 60 * 1000);
  leafCert.validity.notAfter = new Date(Date.now() + leafNotAfterDays * 24 * 60 * 60 * 1000);

  const leafAttrs = [
    { name: 'countryName', value: 'DE' },
    { name: 'organizationName', value: 'Davaso Datenannahmestelle' },
    { name: 'organizationalUnitName', value: `IK${leafIk}` },
    { name: 'commonName', value: 'Davaso Annahmestelle' },
  ];
  leafCert.setSubject(leafAttrs);
  leafCert.setIssuer(signingIssuerAttrs);

  const keyUsageExt = {
    name: 'keyUsage',
    digitalSignature: true,
  };
  if (leafKeyEncipherment) {
    keyUsageExt.keyEncipherment = true;
  }
  leafCert.setExtensions([
    { name: 'basicConstraints', cA: false },
    keyUsageExt,
  ]);
  leafCert.sign(signingPrivKey, forge.md.sha256.create());
  const leafDer = forgeCertToDer(leafCert);

  return { caDer, leafDer, caCert, leafCert };
}

function createMockReqRes({
  authorization = 'Bearer valid-token',
  params = { id: 'ab-1' },
} = {}) {
  const req = {
    headers: { authorization },
    params,
  };
  let responseStatusCode = 200;
  let responseData = null;
  const res = {
    status(code) {
      responseStatusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    get statusCode() {
      return responseStatusCode;
    },
    get data() {
      return responseData;
    },
  };
  return { req, res };
}

// -------------------------------------------------------------
// 1. Auth & Tenant Isolation (Wiring-Tests)
// -------------------------------------------------------------

test('Auth-Guard: Fehlender Bearer-Token -> 401, certQuery wird nie aufgerufen', async () => {
  const { req, res } = createMockReqRes({ authorization: '' });
  let certQueryCalled = false;
  const db = {
    from(table) {
      if (table === 'empfaenger_zertifikate') certQueryCalled = true;
      return {};
    },
  };

  await handleEmpfaengerPruefung(req, res, { db });
  assert.equal(res.statusCode, 401);
  assert.equal(res.data?.error, 'Missing bearer token');
  assert.equal(certQueryCalled, false, 'empfaenger_zertifikate darf bei fehlendem Token nie abgefragt werden');
});

test('Auth-Guard: Ungültiger Token -> 401, certQuery wird nie aufgerufen', async () => {
  const { req, res } = createMockReqRes({ authorization: 'Bearer invalid-token' });
  let certQueryCalled = false;
  const auth = {
    async getUser() {
      return { data: null, error: new Error('jwt expired') };
    },
  };
  const db = {
    from(table) {
      if (table === 'empfaenger_zertifikate') certQueryCalled = true;
      return {};
    },
  };

  await handleEmpfaengerPruefung(req, res, { db, auth });
  assert.equal(res.statusCode, 401);
  assert.equal(res.data?.error, 'Invalid token');
  assert.equal(certQueryCalled, false, 'empfaenger_zertifikate darf bei invalidem Token nie abgefragt werden');
});

test('Tenant-Guard: Fremder Mandant (owner_id !== tenantId) -> 403, certQuery wird nie aufgerufen', async () => {
  const { req, res } = createMockReqRes({ authorization: 'Bearer token-user-a' });
  let certQueryCalled = false;
  const auth = {
    async getUser() {
      return { data: { user: { id: 'user-a' } }, error: null };
    },
  };
  const db = {
    from(table) {
      if (table === 'profiles') {
        return {
          select() {
            return {
              eq() {
                return {
                  async single() {
                    return { data: { id: 'user-a', role: 'owner' } };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'abrechnung') {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        id: 'ab-1',
                        owner_id: 'owner-different', // fremder Inhaber!
                        kostentraeger_ik: '108310400',
                        empfaenger_ik: '661430035',
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'empfaenger_zertifikate') {
        certQueryCalled = true;
        return {};
      }
      throw new Error(`Unerwartete Tabelle: ${table}`);
    },
  };

  await handleEmpfaengerPruefung(req, res, { db, auth });
  assert.equal(res.statusCode, 403);
  assert.equal(res.data?.error, 'Nicht berechtigt');
  assert.equal(certQueryCalled, false, 'empfaenger_zertifikate darf bei 403 nie abgefragt werden');
});

test('Tenant-Guard: Mitarbeiter-Rolle löst korrekt auf Inhaber auf', async () => {
  const { req, res } = createMockReqRes();
  const auth = {
    async getUser() {
      return { data: { user: { id: 'emp-1' } }, error: null };
    },
  };
  let queriedIk = null;
  const db = {
    from(table) {
      if (table === 'profiles') {
        return {
          select() {
            return {
              eq() {
                return {
                  async single() {
                    return { data: { id: 'emp-1', role: 'employee', owner_id: 'owner-1' } };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'abrechnung') {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        id: 'ab-1',
                        owner_id: 'owner-1',
                        kostentraeger_ik: '108310400',
                        empfaenger_ik: '661430035',
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'empfaenger_zertifikate') {
        return {
          select() {
            return {
              eq(col, val) {
                queriedIk = val;
                return {
                  async maybeSingle() {
                    return { data: null, error: null }; // kein Cert vorhanden -> fehlend
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`Unerwartete Tabelle: ${table}`);
    },
  };

  await handleEmpfaengerPruefung(req, res, {
    db,
    auth,
    bereichFn: async () => ({ bereich: 'physio', eigenerAbrechnungscode: '01' }),
    pruefeEmpfaengerFn: async () => ({ blockiert: false, meldungen: [], heuteIk: '108310400', gespeichertIk: '661430035' }),
  });

  assert.equal(res.statusCode, 200);
  assert.equal(queriedIk, '661430035');
  assert.equal(res.data?.empfCert?.status, 'fehlend');
});

// -------------------------------------------------------------
// 2. Ziel-IK & Stichtag-Semantik
// -------------------------------------------------------------

test('Handler: DB-Fehler und unerwartete Exceptions geben keine internen Details zurück', async () => {
  const intern = 'secret_internal_db_addr abgelaufen';
  for (const wirft of [false, true]) {
    const { req, res } = createMockReqRes();
    const auth = { getUser: async () => ({ data: { user: { id: 'owner-1' } } }) };
    const db = {
      from(table) {
        if (table === 'profiles') return { select: () => ({ eq: () => ({ single: async () => ({ data: { role: 'owner' } }) }) }) };
        assert.equal(table, 'abrechnung');
        return { select: () => ({ eq: () => ({ maybeSingle: async () => {
          if (wirft) throw new Error(intern);
          return { data: null, error: { message: intern } };
        } }) }) };
      },
    };
    await handleEmpfaengerPruefung(req, res, { db, auth });
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.data, { error: wirft
      ? 'Interner Serverfehler bei der Empfängerprüfung.'
      : 'Datenbankfehler beim Laden der Abrechnung.' });
    assert.doesNotMatch(JSON.stringify(res.data), /secret_internal_db_addr/);
  }
});

test('Metadaten: unbekannte Anchor-/PKI-Exceptions und bekannte Kategorien verraten keine internen Details', async () => {
  const { caDer, leafDer } = createSyntheticPki();
  const db = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
    data: { zertifikat_der: leafDer, fingerprint_sha256: null }, error: null,
  }) }) }) }) };
  for (const [phase, message, status, hinweis] of [
    ['anchor', 'secret_internal_db_addr abgelaufen', 'nicht_pruefbar', 'ITSG-Trust-Anchor-Liste ist nicht verfügbar oder fehlerhaft konfiguriert.'],
    ['cert', 'secret_internal_db_addr', 'ungueltig', 'Zertifikatsprüfung fehlgeschlagen.'],
    ['cert', 'KeyUsage secret_internal_db_addr', 'ungueltig', 'Zertifikatsprüfung fehlgeschlagen: Ungültige KeyUsage (keyEncipherment fehlt).'],
  ]) {
    const res = await ermittleEmpfaengerZertifikatStatus({
      empfaengerIk: '661430035', db,
      ladeAnchors: () => {
        if (phase === 'anchor') throw new Error(message);
        return { anchors: [caDer], meta: { zertifikate: [{ notAfter: '2030-01-01' }] } };
      },
      pruefeZertifikat: () => { throw new Error(message); },
    });
    assert.equal(res.status, status);
    assert.equal(res.hinweis, hinweis);
    assert.doesNotMatch(JSON.stringify(res), /secret_internal_db_addr/);
  }
});

test('Ziel-IK: Fragt exakt ab.empfaenger_ik ab, NICHT kostentraeger_ik und NICHT heuteIk', async () => {
  const { req, res } = createMockReqRes();
  const auth = {
    async getUser() {
      return { data: { user: { id: 'owner-1' } }, error: null };
    },
  };
  let queriedCertIk = null;
  const db = {
    from(table) {
      if (table === 'profiles') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'owner-1', role: 'owner' } }) }) }) };
      }
      if (table === 'abrechnung') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'ab-1',
                  owner_id: 'owner-1',
                  kostentraeger_ik: '108310400', // Kostenträger
                  empfaenger_ik: '661430035',    // Gespeicherte Annahmestelle
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'empfaenger_zertifikate') {
        return {
          select: () => ({
            eq: (col, val) => {
              queriedCertIk = val;
              return { maybeSingle: async () => ({ data: null, error: null }) };
            },
          }),
        };
      }
      throw new Error(`Unerwartete Tabelle: ${table}`);
    },
  };

  await handleEmpfaengerPruefung(req, res, {
    db,
    auth,
    bereichFn: async () => ({ bereich: 'physio', eigenerAbrechnungscode: '01' }),
    pruefeEmpfaengerFn: async () => ({
      blockiert: true,
      meldungen: [{ code: 'EMPFAENGER_GEAENDERT', stufe: 'block', text: 'Geändert' }],
      heuteIk: '999999999', // Heute-IK abweichend
      gespeichertIk: '661430035',
    }),
  });

  assert.equal(res.statusCode, 200);
  assert.equal(queriedCertIk, '661430035', 'Muss ab.empfaenger_ik sein, nicht kostentraeger_ik oder heuteIk');
  assert.equal(res.data.blockiert, true, 'Bestehende blockiert-Semantik bleibt unverändert');
  assert.equal(res.data.heuteIk, '999999999');
  assert.equal(res.data.gespeichertIk, '661430035');
  assert.equal(res.data.empfCert.status, 'fehlend');
  assert.equal(res.data.empfCert.ik, '661430035');
});

test('Fehlendes ab.empfaenger_ik auf Abrechnung -> status: fehlend ohne DB-Zertifikatsabfrage', async () => {
  let certQueryRun = false;
  const db = {
    from(table) {
      if (table === 'empfaenger_zertifikate') certQueryRun = true;
      return {};
    },
  };

  const res = await ermittleEmpfaengerZertifikatStatus({ empfaengerIk: null, db });
  assert.equal(res.status, 'fehlend');
  assert.equal(res.ik, null);
  assert.match(res.hinweis, /fehlt eine Datenannahmestellen-Zuordnung/);
  assert.equal(certQueryRun, false);
});

// -------------------------------------------------------------
// 3. DB-Fehler & Bytea-Dekodierung
// -------------------------------------------------------------

test('DB-Fehler bei Zertifikatsabfrage -> status: nicht_pruefbar (kontrolliertes Deutsch, kein Roh-Stack)', async () => {
  const db = {
    from(table) {
      assert.equal(table, 'empfaenger_zertifikate');
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: { message: 'connection timeout secret_internal_db_addr' } }),
          }),
        }),
      };
    },
  };

  const res = await ermittleEmpfaengerZertifikatStatus({ empfaengerIk: '661430035', db });
  assert.equal(res.status, 'nicht_pruefbar');
  assert.equal(res.hinweis, 'Fehler beim Laden des Empfängerzertifikats aus der Datenbank.');
  assert.doesNotMatch(res.hinweis, /secret_internal_db_addr/);
});

test('Kein Datensatz in empfaenger_zertifikate -> status: fehlend mit deutscher Erklärung', async () => {
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
  };

  const res = await ermittleEmpfaengerZertifikatStatus({ empfaengerIk: '661430035', db });
  assert.equal(res.status, 'fehlend');
  assert.equal(res.ik, '661430035');
  assert.match(res.hinweis, /liegt noch kein Verschlüsselungszertifikat vor/);
});

test('Bytea-Dekodierung: Malformed Hex (ungerade Länge oder ungültige Hex-Zeichen) -> status: ungueltig', async () => {
  const dbOdd = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { zertifikat_der: '\\x30820' }, error: null }) }),
      }),
    }),
  };
  const resOdd = await ermittleEmpfaengerZertifikatStatus({ empfaengerIk: '661430035', db: dbOdd });
  assert.equal(resOdd.status, 'ungueltig');
  assert.match(resOdd.hinweis, /beschädigt/);

  const dbInvalidChar = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { zertifikat_der: '\\x3082ZZ' }, error: null }) }),
      }),
    }),
  };
  const resInvalid = await ermittleEmpfaengerZertifikatStatus({ empfaengerIk: '661430035', db: dbInvalidChar });
  assert.equal(resInvalid.status, 'ungueltig');
  assert.match(resInvalid.hinweis, /beschädigt/);
});

test('Bytea-Dekodierung: Nicht-ASN.1 / ungültiges X.509 -> status: ungueltig', async () => {
  const dbGarbage = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { zertifikat_der: '\\x1122334455' }, error: null }) }),
      }),
    }),
  };
  const res = await ermittleEmpfaengerZertifikatStatus({ empfaengerIk: '661430035', db: dbGarbage });
  assert.equal(res.status, 'ungueltig');
  assert.match(res.hinweis, /kein gültiges X\.509-Zertifikat/);
  assert.equal(res.fingerprintSha256, sha256Hex(Buffer.from('1122334455', 'hex')));
});

// -------------------------------------------------------------
// 4. Fingerprint-Abgleich & Normalisierung
// -------------------------------------------------------------

test('Fingerprint-Abweichung: DB-Fingerprint stimmt nicht mit errechnetem DER-Hash überein -> status: ungueltig', async () => {
  const { leafDer } = createSyntheticPki({ leafIk: '661430035' });
  const actualSha = sha256Hex(leafDer);

  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              zertifikat_der: leafDer,
              fingerprint_sha256: '00:11:22:33:44:55', // Falscher Fingerprint
            },
            error: null,
          }),
        }),
      }),
    }),
  };

  const res = await ermittleEmpfaengerZertifikatStatus({ empfaengerIk: '661430035', db });
  assert.equal(res.status, 'ungueltig');
  assert.match(res.hinweis, /Fingerprint-Abweichung/);
  assert.equal(res.fingerprintSha256, actualSha);
  assert.ok(res.subject);
  assert.ok(res.validTo);
});

test('Fingerprint-Normalisierung: Doppelpunkte und Groß-/Kleinschreibung im DB-Fingerprint werden toleriert', async () => {
  const { caDer, leafDer } = createSyntheticPki({ leafIk: '661430035' });
  const actualSha = sha256Hex(leafDer);
  // Mit Doppelpunkten und Großbuchstaben
  const formattedSha = actualSha.match(/.{1,2}/g).join(':').toUpperCase();

  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              zertifikat_der: leafDer,
              fingerprint_sha256: formattedSha,
            },
            error: null,
          }),
        }),
      }),
    }),
  };

  const res = await ermittleEmpfaengerZertifikatStatus({
    empfaengerIk: '661430035',
    db,
    ladeAnchors: () => ({ anchors: [caDer], meta: { zertifikate: [{ notAfter: new Date(Date.now() + 864000000).toISOString() }] } }),
    pruefeFrische: () => ({ ok: true }),
  });

  assert.equal(res.status, 'geprueft');
  assert.equal(res.fingerprintSha256, actualSha);
  assert.equal(res.hinweis, null);
});

test('Fehlender DB-Fingerprint (null/leer): Errechneter tatsächlicher Fingerprint wird legitim ausgegeben', async () => {
  const { caDer, leafDer } = createSyntheticPki({ leafIk: '661430035' });
  const actualSha = sha256Hex(leafDer);

  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              zertifikat_der: leafDer,
              fingerprint_sha256: null,
            },
            error: null,
          }),
        }),
      }),
    }),
  };

  const res = await ermittleEmpfaengerZertifikatStatus({
    empfaengerIk: '661430035',
    db,
    ladeAnchors: () => ({ anchors: [caDer], meta: { zertifikate: [{ notAfter: new Date(Date.now() + 864000000).toISOString() }] } }),
    pruefeFrische: () => ({ ok: true }),
  });

  assert.equal(res.status, 'geprueft');
  assert.equal(res.fingerprintSha256, actualSha);
});

// -------------------------------------------------------------
// 5. Trust-Anchor-Prüfung & Frische
// -------------------------------------------------------------

test('Trust-Anchors fehlen oder leer -> status: nicht_pruefbar (kein skipAnchorCheck)', async () => {
  const { leafDer } = createSyntheticPki({ leafIk: '661430035' });
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { zertifikat_der: leafDer, fingerprint_sha256: null }, error: null }),
        }),
      }),
    }),
  };

  const res = await ermittleEmpfaengerZertifikatStatus({
    empfaengerIk: '661430035',
    db,
    ladeAnchors: () => ({ anchors: [], meta: null }),
  });

  assert.equal(res.status, 'nicht_pruefbar');
  assert.match(res.hinweis, /nicht verfügbar oder fehlerhaft konfiguriert/);
  assert.ok(res.subject);
  assert.ok(res.validTo);
});

test('Trust-Anchors abgelaufen (pruefeFrische wirft) -> status: nicht_pruefbar', async () => {
  const { caDer, leafDer } = createSyntheticPki({ leafIk: '661430035' });
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { zertifikat_der: leafDer, fingerprint_sha256: null }, error: null }),
        }),
      }),
    }),
  };

  const jetztGesternAbgelaufen = new Date('2025-01-02T10:00:00Z'); // nach notAfter

  const res = await ermittleEmpfaengerZertifikatStatus({
    empfaengerIk: '661430035',
    db,
    jetzt: jetztGesternAbgelaufen,
    ladeAnchors: () => ({ anchors: [caDer], meta: { zertifikate: [{ notAfter: '2025-01-01' }] } }),
    pruefeFrische: pruefeTrustAnchorFrische,
  });

  assert.equal(res.status, 'nicht_pruefbar');
  assert.match(res.hinweis, /vollständig abgelaufen/);
});

test('Trust-Anchors missing meta -> status: nicht_pruefbar', async () => {
  const { caDer, leafDer } = createSyntheticPki({ leafIk: '661430035' });
  const db = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { zertifikat_der: leafDer, fingerprint_sha256: null }, error: null }) }) }) })
  };

  const res = await ermittleEmpfaengerZertifikatStatus({
    empfaengerIk: '661430035',
    db,
    ladeAnchors: () => ({ anchors: [caDer], meta: null }),
    pruefeFrische: pruefeTrustAnchorFrische,
  });

  assert.equal(res.status, 'nicht_pruefbar');
  assert.match(res.hinweis, /ITSG-Trust-Anchor-Liste ist nicht verfügbar oder fehlerhaft konfiguriert/);
});

test('Trust-Anchors bald ablaufend (soonexpire) -> status: geprueft, hinweis sichtbar', async () => {
  const { caDer, leafDer } = createSyntheticPki({ leafIk: '661430035' });
  const db = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { zertifikat_der: leafDer, fingerprint_sha256: null }, error: null }) }) }) })
  };

  const jetzt = new Date();
  const baldAblaufend = new Date(jetzt.getTime() + 7 * 86400000); // 7 days later
  const nextUpdateStr = baldAblaufend.toISOString();

  const res = await ermittleEmpfaengerZertifikatStatus({
    empfaengerIk: '661430035',
    db,
    ladeAnchors: () => ({ anchors: [caDer], meta: { nextUpdate: nextUpdateStr, zertifikate: [{ notAfter: nextUpdateStr }] } }),
    pruefeFrische: pruefeTrustAnchorFrische,
  });

  assert.equal(res.status, 'geprueft');
  assert.match(res.hinweis, /läuft in \d+ Tagen ab/);
});

// -------------------------------------------------------------
// 6. Echte PKI-Kriterien (Real RSA 4096 CA & Leaf)
// -------------------------------------------------------------

test('PKI: Abgelaufenes Empfängerzertifikat -> status: ungueltig (metadaten bleiben erhalten)', async () => {
  const { caDer, leafDer } = createSyntheticPki({
    leafIk: '661430035',
    leafNotBeforeDays: -30,
    leafNotAfterDays: -1, // gestern abgelaufen
  });
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { zertifikat_der: leafDer, fingerprint_sha256: null }, error: null }),
        }),
      }),
    }),
  };

  const res = await ermittleEmpfaengerZertifikatStatus({
    empfaengerIk: '661430035',
    db,
    ladeAnchors: () => ({ anchors: [caDer], meta: { zertifikate: [{ notAfter: '2030-01-01' }] } }),
    pruefeFrische: () => ({ ok: true }),
  });

  assert.equal(res.status, 'ungueltig');
  assert.match(res.hinweis, /abgelaufen/);
  assert.ok(res.subject);
  assert.ok(res.validTo);
  assert.equal(res.fingerprintSha256, sha256Hex(leafDer));
});

test('PKI: Noch nicht gültiges Empfängerzertifikat -> status: ungueltig', async () => {
  const { caDer, leafDer } = createSyntheticPki({
    leafIk: '661430035',
    leafNotBeforeDays: 10, // erst in 10 Tagen gültig
    leafNotAfterDays: 365,
  });
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { zertifikat_der: leafDer, fingerprint_sha256: null }, error: null }),
        }),
      }),
    }),
  };

  const res = await ermittleEmpfaengerZertifikatStatus({
    empfaengerIk: '661430035',
    db,
    ladeAnchors: () => ({ anchors: [caDer], meta: { zertifikate: [{ notAfter: '2030-01-01' }] } }),
    pruefeFrische: () => ({ ok: true }),
  });

  assert.equal(res.status, 'ungueltig');
  assert.match(res.hinweis, /noch nicht gültig/);
});

test('PKI: Nicht vertrauenswürdige CA (unbekannte Kette) -> status: ungueltig', async () => {
  const { caDer, leafDer } = createSyntheticPki({
    leafIk: '661430035',
    signWithUntrustedCa: true, // Signiert mit anderer CA als Trust Anchor!
  });
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { zertifikat_der: leafDer, fingerprint_sha256: null }, error: null }),
        }),
      }),
    }),
  };

  const res = await ermittleEmpfaengerZertifikatStatus({
    empfaengerIk: '661430035',
    db,
    ladeAnchors: () => ({ anchors: [caDer], meta: { zertifikate: [{ notAfter: '2030-01-01' }] } }),
    pruefeFrische: () => ({ ok: true }),
  });

  assert.equal(res.status, 'ungueltig');
  assert.match(res.hinweis, /failed trusted chain/);
});

test('PKI: KeyUsage ohne keyEncipherment -> status: ungueltig', async () => {
  const { caDer, leafDer } = createSyntheticPki({
    leafIk: '661430035',
    leafKeyEncipherment: false, // Bit 2 nicht gesetzt
  });
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { zertifikat_der: leafDer, fingerprint_sha256: null }, error: null }),
        }),
      }),
    }),
  };

  const res = await ermittleEmpfaengerZertifikatStatus({
    empfaengerIk: '661430035',
    db,
    ladeAnchors: () => ({ anchors: [caDer], meta: { zertifikate: [{ notAfter: '2030-01-01' }] } }),
    pruefeFrische: () => ({ ok: true }),
  });

  assert.equal(res.status, 'ungueltig');
  assert.match(res.hinweis, /Ungültige KeyUsage/);
});

test('PKI: Zu kurze Schlüssellänge (2048 Bit < 4096 Bit gefordert) -> status: ungueltig', async () => {
  const { caDer, leafDer } = createSyntheticPki({
    leafIk: '661430035',
    leafModulusLength: 2048, // Nur 2048 Bit
  });
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { zertifikat_der: leafDer, fingerprint_sha256: null }, error: null }),
        }),
      }),
    }),
  };

  const res = await ermittleEmpfaengerZertifikatStatus({
    empfaengerIk: '661430035',
    db,
    ladeAnchors: () => ({ anchors: [caDer], meta: { zertifikate: [{ notAfter: '2030-01-01' }] } }),
    pruefeFrische: () => ({ ok: true }),
  });

  assert.equal(res.status, 'ungueltig');
  assert.match(res.hinweis, /RSA-Schlüssellänge unzureichend/);
});

test('PKI: Falsche IK im Zertifikat (OU IK999999999 != 661430035) -> status: ungueltig', async () => {
  const { caDer, leafDer } = createSyntheticPki({
    leafIk: '999999999', // Falsche IK
  });
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { zertifikat_der: leafDer, fingerprint_sha256: null }, error: null }),
        }),
      }),
    }),
  };

  const res = await ermittleEmpfaengerZertifikatStatus({
    empfaengerIk: '661430035',
    db,
    ladeAnchors: () => ({ anchors: [caDer], meta: { zertifikate: [{ notAfter: '2030-01-01' }] } }),
    pruefeFrische: () => ({ ok: true }),
  });

  assert.equal(res.status, 'ungueltig');
  assert.match(res.hinweis, /IK stimmt nicht mit erwarteter IK/);
});

test('PKI: Voller Erfolg — Echte RSA-4096 Kette, frische Anchors, passende IK -> status: geprueft', async () => {
  const { caDer, leafDer } = createSyntheticPki({ leafIk: '661430035' });
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { zertifikat_der: leafDer, fingerprint_sha256: sha256Hex(leafDer) },
            error: null,
          }),
        }),
      }),
    }),
  };

  const res = await ermittleEmpfaengerZertifikatStatus({
    empfaengerIk: '661430035',
    db,
    ladeAnchors: () => ({ anchors: [caDer], meta: { zertifikate: [{ notAfter: '2030-01-01' }] } }),
    pruefeFrische: () => ({ ok: true }),
  });

  assert.equal(res.status, 'geprueft');
  assert.equal(res.ik, '661430035');
  assert.match(res.subject, /IK661430035/);
  assert.ok(res.validTo);
  assert.equal(res.fingerprintSha256, sha256Hex(leafDer));
  assert.equal(res.hinweis, null);
  assert.ok(res.geprueftAm);
});

// -------------------------------------------------------------
// 7. Keine Teil-Grüns & Keine DER-Rückgabe im Response-Vertrag
// -------------------------------------------------------------

test('Vertragssicherheit: Kein DER-Schlüsselmaterial im Response-Objekt', async () => {
  const { caDer, leafDer } = createSyntheticPki({ leafIk: '661430035' });
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { zertifikat_der: leafDer }, error: null }),
        }),
      }),
    }),
  };

  const res = await ermittleEmpfaengerZertifikatStatus({
    empfaengerIk: '661430035',
    db,
    ladeAnchors: () => ({ anchors: [caDer], meta: { zertifikate: [{ notAfter: '2030-01-01' }] } }),
    pruefeFrische: () => ({ ok: true }),
  });

  assert.equal(res.zertifikat_der, undefined);
  assert.equal(res.der, undefined);
  assert.equal(res.key, undefined);
  assert.equal(res.publicKey, undefined);
  assert.equal(res.privateKey, undefined);
});
