// formular-signieren.test.js — Tests für POST /api/dokument/formular-signieren
//
// Prüft:
//   - Reine Eingabeprüfung pruefeFormularSignierenEingabe (ohne I/O, ohne Netz)
//   - Router-Endpunkt mit Mock-Supabase (400, 404, 409, 500 und 200 Erfolgsfälle)
//   - Pfadvalidierung (tenantId-Präfix, kein .., kein //)
//   - Cleanup von Signatur-PNG bei Consent-Fehler

import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import crypto from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-key';
const { pruefeFormularSignierenEingabe, createFormularSignierenRouter } = await import('./formular-signieren.js');
import { MAX_PNG_BYTES, PNG_MAGIC_BYTES } from '../lib/formular-pdf.js';

// Gültiges 1x1 Pixel PNG
const EIN_MAL_EINS_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const GUELTIGE_FORMULAR_ID = '11111111-2222-3333-4444-555555555555';
const GUELTIGE_LEAD_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const TENANT_ID = '99999999-9999-9999-9999-999999999999';
const USER_ID = '88888888-8888-8888-8888-888888888888';

// ============================================================================
// 1. Tests für reine Eingabeprüfung (pruefeFormularSignierenEingabe)
// ============================================================================

test('pruefeFormularSignierenEingabe: akzeptiert gültige Eingaben', () => {
  const body = {
    formular_id: GUELTIGE_FORMULAR_ID,
    lead_id: GUELTIGE_LEAD_ID,
    signaturen: [
      { feld_index: 0, png_base64: EIN_MAL_EINS_PNG_BASE64 },
    ],
    signed_name: 'Max Mustermann',
  };

  const res = pruefeFormularSignierenEingabe(body);
  assert.equal(res.ok, true);
  assert.equal(res.fehler, null);
  assert.equal(res.werte.formular_id, GUELTIGE_FORMULAR_ID);
  assert.equal(res.werte.lead_id, GUELTIGE_LEAD_ID);
  assert.equal(res.werte.signaturen.length, 1);
  assert.equal(res.werte.signaturen[0].feld_index, 0);
  assert.equal(res.werte.signed_name, 'Max Mustermann');
  assert.ok(Buffer.isBuffer(res.werte.signaturen[0].buffer));
});

test('pruefeFormularSignierenEingabe: weist fehlenden oder ungültigen Body ab', () => {
  assert.equal(pruefeFormularSignierenEingabe(null).ok, false);
  assert.equal(pruefeFormularSignierenEingabe(undefined).ok, false);
  assert.equal(pruefeFormularSignierenEingabe('text').ok, false);
});

test('pruefeFormularSignierenEingabe: prüft formular_id und lead_id auf UUID-Format', () => {
  const f1 = pruefeFormularSignierenEingabe({ lead_id: GUELTIGE_LEAD_ID, signaturen: [] });
  assert.equal(f1.ok, false);
  assert.match(f1.fehler, /Formular-ID/i);

  const f2 = pruefeFormularSignierenEingabe({ formular_id: 'keine-uuid', lead_id: GUELTIGE_LEAD_ID, signaturen: [] });
  assert.equal(f2.ok, false);
  assert.match(f2.fehler, /Formular-ID/i);

  const l1 = pruefeFormularSignierenEingabe({ formular_id: GUELTIGE_FORMULAR_ID, signaturen: [] });
  assert.equal(l1.ok, false);
  assert.match(l1.fehler, /Patienten-ID/i);

  const l2 = pruefeFormularSignierenEingabe({ formular_id: GUELTIGE_FORMULAR_ID, lead_id: '12345', signaturen: [] });
  assert.equal(l2.ok, false);
  assert.match(l2.fehler, /Patienten-ID/i);
});

test('pruefeFormularSignierenEingabe: Signatur-Array-Regeln (min 1, max 10)', () => {
  const s0 = pruefeFormularSignierenEingabe({
    formular_id: GUELTIGE_FORMULAR_ID,
    lead_id: GUELTIGE_LEAD_ID,
    signaturen: [],
  });
  assert.equal(s0.ok, false);
  assert.match(s0.fehler, /Mindestens eine Signatur/i);

  const elfSignaturen = Array.from({ length: 11 }, (_, i) => ({
    feld_index: i,
    png_base64: EIN_MAL_EINS_PNG_BASE64,
  }));
  const s11 = pruefeFormularSignierenEingabe({
    formular_id: GUELTIGE_FORMULAR_ID,
    lead_id: GUELTIGE_LEAD_ID,
    signaturen: elfSignaturen,
  });
  assert.equal(s11.ok, false);
  assert.match(s11.fehler, /Maximal 10/i);
});

test('pruefeFormularSignierenEingabe: feld_index muss ganzzahlig, nicht-negativ und eindeutig sein', () => {
  const fFloat = pruefeFormularSignierenEingabe({
    formular_id: GUELTIGE_FORMULAR_ID,
    lead_id: GUELTIGE_LEAD_ID,
    signaturen: [{ feld_index: 0.5, png_base64: EIN_MAL_EINS_PNG_BASE64 }],
  });
  assert.equal(fFloat.ok, false);
  assert.match(fFloat.fehler, /Feld-Index/i);

  const fNeg = pruefeFormularSignierenEingabe({
    formular_id: GUELTIGE_FORMULAR_ID,
    lead_id: GUELTIGE_LEAD_ID,
    signaturen: [{ feld_index: -1, png_base64: EIN_MAL_EINS_PNG_BASE64 }],
  });
  assert.equal(fNeg.ok, false);
  assert.match(fNeg.fehler, /Feld-Index/i);

  const fDuplikat = pruefeFormularSignierenEingabe({
    formular_id: GUELTIGE_FORMULAR_ID,
    lead_id: GUELTIGE_LEAD_ID,
    signaturen: [
      { feld_index: 0, png_base64: EIN_MAL_EINS_PNG_BASE64 },
      { feld_index: 0, png_base64: EIN_MAL_EINS_PNG_BASE64 },
    ],
  });
  assert.equal(fDuplikat.ok, false);
  assert.match(fDuplikat.fehler, /Doppelter feld_index/i);
});

test('pruefeFormularSignierenEingabe: PNG-Validierung in Base64 (Magic-Bytes & Größe)', () => {
  const fBadB64 = pruefeFormularSignierenEingabe({
    formular_id: GUELTIGE_FORMULAR_ID,
    lead_id: GUELTIGE_LEAD_ID,
    signaturen: [{ feld_index: 0, png_base64: '@@@ungueltig@@@' }],
  });
  assert.equal(fBadB64.ok, false);

  const textBase64 = Buffer.from('Ich bin kein PNG').toString('base64');
  const fKeinPng = pruefeFormularSignierenEingabe({
    formular_id: GUELTIGE_FORMULAR_ID,
    lead_id: GUELTIGE_LEAD_ID,
    signaturen: [{ feld_index: 0, png_base64: textBase64 }],
  });
  assert.equal(fKeinPng.ok, false);
  assert.match(fKeinPng.fehler, /PNG/i);

  const gross = Buffer.alloc(MAX_PNG_BYTES + 100);
  gross.set(PNG_MAGIC_BYTES, 0);
  const grossBase64 = gross.toString('base64');
  const fGross = pruefeFormularSignierenEingabe({
    formular_id: GUELTIGE_FORMULAR_ID,
    lead_id: GUELTIGE_LEAD_ID,
    signaturen: [{ feld_index: 0, png_base64: grossBase64 }],
  });
  assert.equal(fGross.ok, false);
  assert.match(fGross.fehler, /400 KB/i);
});

test('pruefeFormularSignierenEingabe: signed_name wird auf max 200 Zeichen gekürzt oder null gesetzt', () => {
  const lange = 'A'.repeat(300);
  const res = pruefeFormularSignierenEingabe({
    formular_id: GUELTIGE_FORMULAR_ID,
    lead_id: GUELTIGE_LEAD_ID,
    signaturen: [{ feld_index: 0, png_base64: EIN_MAL_EINS_PNG_BASE64 }],
    signed_name: lange,
  });
  assert.equal(res.ok, true);
  assert.equal(res.werte.signed_name.length, 200);

  const ohneName = pruefeFormularSignierenEingabe({
    formular_id: GUELTIGE_FORMULAR_ID,
    lead_id: GUELTIGE_LEAD_ID,
    signaturen: [{ feld_index: 0, png_base64: EIN_MAL_EINS_PNG_BASE64 }],
  });
  assert.equal(ohneName.werte.signed_name, null);
});

// ============================================================================
// 2. HTTP-Endpunkt-Tests mit Mock-Supabase und lokalem Express-Server
// ============================================================================

async function mitServer(router, fn) {
  const app = express();
  app.use(express.json({ limit: '6mb' }));
  app.use('/api', router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function erstelleMockSupabase(konfiguration = {}) {
  const storageFiles = new Map(konfiguration.storageFiles || []);
  const storageUploads = [];
  const storageRemovals = [];
  const patientDokumenteRows = [];
  const patientConsentsRows = [];

  const client = {
    _storageUploads: storageUploads,
    _storageRemovals: storageRemovals,
    _patientDokumenteRows: patientDokumenteRows,
    _patientConsentsRows: patientConsentsRows,

    from(table) {
      const filters = {};
      return {
        select() {
          return this;
        },
        eq(col, val) {
          filters[col] = val;
          return this;
        },
        async maybeSingle() {
          if (table === 'praxis_formulare') {
            if (konfiguration.formularFehler) throw konfiguration.formularFehler;
            const f = konfiguration.formular;
            if (!f) return { data: null, error: null };
            if (filters.id && f.id !== filters.id) return { data: null, error: null };
            if (filters.owner_id && f.owner_id !== filters.owner_id) return { data: null, error: null };
            if (filters.aktiv !== undefined && f.aktiv !== filters.aktiv) return { data: null, error: null };
            return { data: f, error: null };
          }
          if (table === 'leads') {
            if (konfiguration.leadFehler) throw konfiguration.leadFehler;
            const l = konfiguration.lead;
            if (!l) return { data: null, error: null };
            if (filters.id && l.id !== filters.id) return { data: null, error: null };
            if (filters.owner_id && l.owner_id !== filters.owner_id) return { data: null, error: null };
            return { data: l, error: null };
          }
          return { data: null, error: null };
        },
        insert(row) {
          if (table === 'patient_dokumente') {
            if (konfiguration.patientDokumenteFehler) {
              return {
                select() {
                  return {
                    maybeSingle: async () => ({ data: null, error: konfiguration.patientDokumenteFehler }),
                  };
                },
              };
            }
            const dokId = crypto.randomUUID();
            const gespeicherteZeile = { id: dokId, ...row };
            patientDokumenteRows.push(gespeicherteZeile);
            return {
              select() {
                return {
                  maybeSingle: async () => ({ data: gespeicherteZeile, error: null }),
                };
              },
            };
          }
          if (table === 'patient_consents') {
            if (konfiguration.patientConsentsFehler) {
              return Promise.resolve({ data: null, error: konfiguration.patientConsentsFehler });
            }
            patientConsentsRows.push(row);
            return Promise.resolve({ data: row, error: null });
          }
          return Promise.resolve({ data: row, error: null });
        },
      };
    },

    storage: {
      from(bucket) {
        return {
          download: async (pfad) => {
            if (konfiguration.storageDownloadFehler) {
              return { data: null, error: konfiguration.storageDownloadFehler };
            }
            const datei = storageFiles.get(pfad);
            if (!datei) return { data: null, error: new Error('Datei nicht gefunden') };
            return { data: datei, error: null };
          },
          upload: async (pfad, inhalt, _opts) => {
            if (konfiguration.storageUploadFehler) {
              return { data: null, error: konfiguration.storageUploadFehler };
            }
            storageUploads.push({ pfad, inhalt });
            storageFiles.set(pfad, inhalt);
            return { data: { path: pfad }, error: null };
          },
          remove: async (pfade) => {
            for (const p of pfade) {
              storageRemovals.push(p);
              storageFiles.delete(p);
            }
            return { data: pfade, error: null };
          },
        };
      },
    },
  };

  return client;
}

const mockAuthMiddleware = (req, _res, next) => {
  req.auth = {
    userId: USER_ID,
    tenantId: TENANT_ID,
    role: 'owner',
  };
  next();
};

test('POST /api/dokument/formular-signieren: 400 bei ungültiger Eingabe', async () => {
  const supabase = erstelleMockSupabase();
  const router = createFormularSignierenRouter({
    supabase,
    requireAuth: mockAuthMiddleware,
    skipRateLimit: true,
  });

  await mitServer(router, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/dokument/formular-signieren`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /Formular-ID/i);
  });
});

test('POST /api/dokument/formular-signieren: 404 wenn Formular nicht gefunden oder inaktiv', async () => {
  const supabase = erstelleMockSupabase({
    formular: null,
    lead: { id: GUELTIGE_LEAD_ID, owner_id: TENANT_ID },
  });
  const router = createFormularSignierenRouter({
    supabase,
    requireAuth: mockAuthMiddleware,
    skipRateLimit: true,
  });

  await mitServer(router, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/dokument/formular-signieren`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formular_id: GUELTIGE_FORMULAR_ID,
        lead_id: GUELTIGE_LEAD_ID,
        signaturen: [{ feld_index: 0, png_base64: EIN_MAL_EINS_PNG_BASE64 }],
      }),
    });
    assert.equal(res.status, 404);
    const json = await res.json();
    assert.match(json.error, /Formular nicht gefunden/i);
  });
});

test('POST /api/dokument/formular-signieren: 404 wenn Patient (lead) nicht gefunden', async () => {
  const supabase = erstelleMockSupabase({
    formular: { id: GUELTIGE_FORMULAR_ID, owner_id: TENANT_ID, aktiv: true, signatur_felder: [] },
    lead: null,
  });
  const router = createFormularSignierenRouter({
    supabase,
    requireAuth: mockAuthMiddleware,
    skipRateLimit: true,
  });

  await mitServer(router, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/dokument/formular-signieren`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formular_id: GUELTIGE_FORMULAR_ID,
        lead_id: GUELTIGE_LEAD_ID,
        signaturen: [{ feld_index: 0, png_base64: EIN_MAL_EINS_PNG_BASE64 }],
      }),
    });
    assert.equal(res.status, 404);
    const json = await res.json();
    assert.match(json.error, /Patient nicht gefunden/i);
  });
});

test('POST /api/dokument/formular-signieren: 400 wenn Signaturen nicht exakt zu signatur_felder passen', async () => {
  const supabase = erstelleMockSupabase({
    formular: {
      id: GUELTIGE_FORMULAR_ID,
      owner_id: TENANT_ID,
      aktiv: true,
      signatur_felder: [
        { seite: 1, x: 10, y: 10, w: 20, h: 10 },
        { seite: 1, x: 40, y: 10, w: 20, h: 10 },
      ],
    },
    lead: { id: GUELTIGE_LEAD_ID, owner_id: TENANT_ID },
  });
  const router = createFormularSignierenRouter({
    supabase,
    requireAuth: mockAuthMiddleware,
    skipRateLimit: true,
  });

  await mitServer(router, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/dokument/formular-signieren`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formular_id: GUELTIGE_FORMULAR_ID,
        lead_id: GUELTIGE_LEAD_ID,
        signaturen: [{ feld_index: 0, png_base64: EIN_MAL_EINS_PNG_BASE64 }],
      }),
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.error, 'Alle Unterschriftsfelder muessen unterschrieben sein.');
  });
});

test('POST /api/dokument/formular-signieren: 400 bei unzulässigem Vorlagenpfad (tenantId, .., //)', async () => {
  const supabaseFalscherTenant = erstelleMockSupabase({
    formular: {
      id: GUELTIGE_FORMULAR_ID,
      owner_id: TENANT_ID,
      aktiv: true,
      storage_path: 'fremder-tenant/formulare/test.pdf',
      signatur_felder: [{ seite: 1, x: 10, y: 10, w: 20, h: 10 }],
    },
    lead: { id: GUELTIGE_LEAD_ID, owner_id: TENANT_ID },
  });

  const router = createFormularSignierenRouter({
    supabase: supabaseFalscherTenant,
    requireAuth: mockAuthMiddleware,
    skipRateLimit: true,
  });

  await mitServer(router, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/dokument/formular-signieren`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formular_id: GUELTIGE_FORMULAR_ID,
        lead_id: GUELTIGE_LEAD_ID,
        signaturen: [{ feld_index: 0, png_base64: EIN_MAL_EINS_PNG_BASE64 }],
      }),
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.error, 'Ungültiger Vorlagenpfad.');
  });
});

test('POST /api/dokument/formular-signieren: 409 wenn Vorlagen-PDF modifiziert wurde (SHA-256 Abweichung)', async () => {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([400, 600]);
  const pdfBytes = await pdfDoc.save();
  const falscherHash = '0000000000000000000000000000000000000000000000000000000000000000';

  const vorlagePfad = `${TENANT_ID}/formulare/vorlage.pdf`;
  const supabase = erstelleMockSupabase({
    formular: {
      id: GUELTIGE_FORMULAR_ID,
      owner_id: TENANT_ID,
      aktiv: true,
      storage_path: vorlagePfad,
      pdf_sha256: falscherHash,
      signatur_felder: [{ seite: 1, x: 10, y: 10, w: 20, h: 10 }],
    },
    lead: { id: GUELTIGE_LEAD_ID, owner_id: TENANT_ID },
    storageFiles: [[vorlagePfad, Buffer.from(pdfBytes)]],
  });
  const router = createFormularSignierenRouter({
    supabase,
    requireAuth: mockAuthMiddleware,
    skipRateLimit: true,
  });

  await mitServer(router, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/dokument/formular-signieren`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formular_id: GUELTIGE_FORMULAR_ID,
        lead_id: GUELTIGE_LEAD_ID,
        signaturen: [{ feld_index: 0, png_base64: EIN_MAL_EINS_PNG_BASE64 }],
      }),
    });
    assert.equal(res.status, 409);
    const json = await res.json();
    assert.equal(json.error, 'Formular wurde veraendert');
  });
});

test('POST /api/dokument/formular-signieren: 200 Erfolgsfall (Standard-Formular, keine Einwilligung)', async () => {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([595.28, 841.89]);
  const pdfBytes = await pdfDoc.save();
  const pdfSha256 = crypto.createHash('sha256').update(pdfBytes).digest('hex');

  const vorlagePfad = `${TENANT_ID}/formulare/anamnese.pdf`;
  const supabase = erstelleMockSupabase({
    formular: {
      id: GUELTIGE_FORMULAR_ID,
      owner_id: TENANT_ID,
      titel: 'Anamnesebogen & Aufklärung',
      aktiv: true,
      version: 1,
      storage_path: vorlagePfad,
      pdf_sha256: pdfSha256,
      signatur_felder: [{ seite: 1, x: 15, y: 70, w: 30, h: 10 }],
      ist_einwilligung: false,
    },
    lead: { id: GUELTIGE_LEAD_ID, owner_id: TENANT_ID },
    storageFiles: [[vorlagePfad, Buffer.from(pdfBytes)]],
  });
  const router = createFormularSignierenRouter({
    supabase,
    requireAuth: mockAuthMiddleware,
    skipRateLimit: true,
  });

  await mitServer(router, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/dokument/formular-signieren`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formular_id: GUELTIGE_FORMULAR_ID,
        lead_id: GUELTIGE_LEAD_ID,
        signaturen: [{ feld_index: 0, png_base64: EIN_MAL_EINS_PNG_BASE64 }],
        signed_name: 'Max Mustermann',
      }),
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json.dokument_id);
    assert.equal(json.einwilligung_gespeichert, false);

    assert.equal(supabase._patientDokumenteRows.length, 1);
    const docRow = supabase._patientDokumenteRows[0];
    assert.equal(docRow.owner_id, TENANT_ID);
    assert.equal(docRow.lead_id, GUELTIGE_LEAD_ID);
    assert.equal(docRow.kategorie, 'formular_signiert');
    assert.equal(docRow.dateiname, 'anamnesebogen-aufklaerung-unterschrieben.pdf');
    assert.equal(docRow.created_by, USER_ID);

    assert.equal(supabase._patientConsentsRows.length, 0);
  });
});

test('POST /api/dokument/formular-signieren: 200 Erfolgsfall mit Einwilligung (patient_consents)', async () => {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([595.28, 841.89]);
  const pdfBytes = await pdfDoc.save();
  const pdfSha256 = crypto.createHash('sha256').update(pdfBytes).digest('hex');

  const vorlagePfad = `${TENANT_ID}/formulare/einwilligung.pdf`;
  const supabase = erstelleMockSupabase({
    formular: {
      id: GUELTIGE_FORMULAR_ID,
      owner_id: TENANT_ID,
      titel: 'Datenschutz & Behandlung',
      aktiv: true,
      version: 2,
      storage_path: vorlagePfad,
      pdf_sha256: pdfSha256,
      signatur_felder: [{ seite: 1, x: 20, y: 75, w: 35, h: 10 }],
      ist_einwilligung: true,
      consent_type: 'datenschutz',
    },
    lead: { id: GUELTIGE_LEAD_ID, owner_id: TENANT_ID },
    storageFiles: [[vorlagePfad, Buffer.from(pdfBytes)]],
  });
  const router = createFormularSignierenRouter({
    supabase,
    requireAuth: mockAuthMiddleware,
    skipRateLimit: true,
  });

  await mitServer(router, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/dokument/formular-signieren`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formular_id: GUELTIGE_FORMULAR_ID,
        lead_id: GUELTIGE_LEAD_ID,
        signaturen: [{ feld_index: 0, png_base64: EIN_MAL_EINS_PNG_BASE64 }],
        signed_name: 'Erika Musterfrau',
      }),
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json.dokument_id);
    assert.equal(json.einwilligung_gespeichert, true);

    assert.equal(supabase._patientConsentsRows.length, 1);
    const cRow = supabase._patientConsentsRows[0];
    assert.equal(cRow.owner_id, TENANT_ID);
    assert.equal(cRow.patient_id, GUELTIGE_LEAD_ID);
    assert.equal(cRow.consent_type, 'datenschutz');
    assert.equal(cRow.text_version, 'v2');
    assert.equal(cRow.text_sha256, pdfSha256);
    assert.match(cRow.text_snapshot, /Datenschutz & Behandlung/);
    assert.equal(cRow.signed_name, 'Erika Musterfrau');
    assert.equal(cRow.captured_by_user_id, USER_ID);
    assert.equal(cRow.device_label, 'Praxis-Formular');
  });
});

test('POST /api/dokument/formular-signieren: 500 bei Fehler in patient_consents — Signatur-PNG entfernt, Dokument bleibt erhalten', async () => {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([595.28, 841.89]);
  const pdfBytes = await pdfDoc.save();
  const pdfSha256 = crypto.createHash('sha256').update(pdfBytes).digest('hex');

  const vorlagePfad = `${TENANT_ID}/formulare/vertrag.pdf`;
  const supabase = erstelleMockSupabase({
    formular: {
      id: GUELTIGE_FORMULAR_ID,
      owner_id: TENANT_ID,
      titel: 'Behandlungsvertrag',
      aktiv: true,
      version: 1,
      storage_path: vorlagePfad,
      pdf_sha256: pdfSha256,
      signatur_felder: [{ seite: 1, x: 10, y: 80, w: 40, h: 10 }],
      ist_einwilligung: true,
    },
    lead: { id: GUELTIGE_LEAD_ID, owner_id: TENANT_ID },
    storageFiles: [[vorlagePfad, Buffer.from(pdfBytes)]],
    patientConsentsFehler: new Error('DB-Trigger Sperre'),
  });
  const router = createFormularSignierenRouter({
    supabase,
    requireAuth: mockAuthMiddleware,
    skipRateLimit: true,
  });

  await mitServer(router, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/dokument/formular-signieren`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formular_id: GUELTIGE_FORMULAR_ID,
        lead_id: GUELTIGE_LEAD_ID,
        signaturen: [{ feld_index: 0, png_base64: EIN_MAL_EINS_PNG_BASE64 }],
      }),
    });
    assert.equal(res.status, 500);
    const json = await res.json();
    assert.ok(json.dokument_id);
    assert.equal(json.einwilligung_gespeichert, false);

    // Dokument in patient_dokumente bleibt erhalten
    assert.equal(supabase._patientDokumenteRows.length, 1);

    // Hochgeladene Signatur-PNG wurde wieder entfernt
    assert.equal(supabase._storageRemovals.length, 1);
    assert.match(supabase._storageRemovals[0], /einwilligung_praxis_formular_/);
  });
});

test('POST /api/dokument/formular-signieren: Rollback der Datei bei Fehler in patient_dokumente', async () => {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([595.28, 841.89]);
  const pdfBytes = await pdfDoc.save();
  const pdfSha256 = crypto.createHash('sha256').update(pdfBytes).digest('hex');

  const vorlagePfad = `${TENANT_ID}/formulare/vertrag.pdf`;
  const supabase = erstelleMockSupabase({
    formular: {
      id: GUELTIGE_FORMULAR_ID,
      owner_id: TENANT_ID,
      titel: 'Behandlungsvertrag',
      aktiv: true,
      storage_path: vorlagePfad,
      pdf_sha256: pdfSha256,
      signatur_felder: [{ seite: 1, x: 10, y: 80, w: 40, h: 10 }],
    },
    lead: { id: GUELTIGE_LEAD_ID, owner_id: TENANT_ID },
    storageFiles: [[vorlagePfad, Buffer.from(pdfBytes)]],
    patientDokumenteFehler: new Error('DB-Fehler beim Insert'),
  });
  const router = createFormularSignierenRouter({
    supabase,
    requireAuth: mockAuthMiddleware,
    skipRateLimit: true,
  });

  await mitServer(router, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/dokument/formular-signieren`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formular_id: GUELTIGE_FORMULAR_ID,
        lead_id: GUELTIGE_LEAD_ID,
        signaturen: [{ feld_index: 0, png_base64: EIN_MAL_EINS_PNG_BASE64 }],
      }),
    });
    assert.equal(res.status, 500);
    // Hochgeladenes PDF wieder entfernt
    assert.equal(supabase._storageRemovals.length, 1);
    assert.match(supabase._storageRemovals[0], /formular\.pdf/);
  });
});
