// § 302 SGB V — Tests für POST /abrechnung/zuzahlungsforderung
//
// Ausführen: node --test api-backend/billing/api/zuzahlungsforderung.routes.test.js

import { test } from 'node:test';
import forge from 'node-forge';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildDtaFile } from '../dta/builder.js';
import { parseOriginalDtaMessage } from '../dta/zuzahlungsforderung-ursprung.js';
import { podoFixture } from '../dta/fixtures.js';
import { createZuzahlungsforderungRouter } from './zuzahlungsforderung.routes.js';

const validProof2 = Object.freeze({
  art: 'zahlungsaufforderung43c', referenz: 'MAHN-2026-01', versandDatum: '2026-09-01', versandArt: 'post',
  nachweisBeigefuegtBestaetigt: true, erfolgloserEinzugBestaetigt: true, bestaetigt: true,
});
function auditedProof2(testData) {
  return { ...validProof2, geprueftAm: '2026-09-15', geprueftZeitpunkt: '2026-09-15T08:00:00.000Z',
    prueferId: testData.ownerId, patientId: testData.patientId, kostentraegerIk: testData.sourceHeader.kostentraeger_ik };
}

function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Erzeugt eine gültige DTA-Datei und passende Mock-Daten für Tests.
 */
function erstelleTestDta({ claim20 = false } = {}) {
  const f = structuredClone(podoFixture);
  f.absender.ik = '800000000'; // Gültige LE-IK Prüfziffer
  f.empfaenger.ik = '108310400';
  f.prescriptions[0].verordnung.kostentraegerIk = '108310400';
  f.prescriptions[0].verordnung.krankenkasseIk = '108310400';

  if (claim20) {
    f.prescriptions[0].sessions = [
      { positionsnummer: '78010', datumLeistung: '2026-08-28', anzahl: 1, einzelbetrag: 100.00, zuzahlungProPos: 10.00 }
    ];
  }

  const dta = buildDtaFile(f);
  const buf = Buffer.from(dta.content, 'latin1');
  const hash = sha256Hex(buf);

  const ownerId = '11111111-1111-1111-1111-111111111111';
  const zeileId = '22222222-2222-2222-2222-222222222222';
  const rxId = '33333333-3333-3333-3333-333333333333';
  const headerId = '44444444-4444-4444-4444-444444444444';
  const mahnungId = '55555555-5555-5555-5555-555555555555';
  const patientId = 'c1111111-1111-1111-1111-111111111111';

  const sourceHeader = {
    id: headerId,
    owner_id: ownerId,
    business_id: 'b1111111-1111-1111-1111-111111111111',
    empfaenger_ik: '108310400',
    absender_ik: '800000000',
    kostentraeger_ik: '108310400',
    rechnungsnummer: f.rechnung.sammelRechnungsnummer,
    status: 'accepted',
    verarbeitungskennzeichen: '01',
    storage_path: `${ownerId}/2026/08/${headerId}/ESOL0024.dta`,
    dta_sha256: hash,
  };

  const sourceZeile = {
    id: zeileId,
    abrechnung_id: headerId,
    owner_id: ownerId,
    business_id: 'b1111111-1111-1111-1111-111111111111',
    prescription_id: rxId,
    kostentraeger_ik: '108310400',
    karten_ik: '108310400',
    einzel_rechnungsnummer: '0',
    belegnummer: f.prescriptions[0].patient.belegnummer,
    patient_name: 'Erika Schulz',
    versichertennummer: f.prescriptions[0].patient.kvnr,
    verordnungsdatum: '2026-08-20',
    therapie_bereich: 'podo',
    leistungen: [{ positionsnummer: '78010', anzahl: 1, einzelbetrag: claim20 ? 100 : 28.90 }],
    zuzahlung_eur: claim20 ? 20.00 : 12.89,
    netto_eur: claim20 ? 80.00 : 16.01,
    brutto_eur: claim20 ? 100.00 : 28.90,
    status: 'akzeptiert',
    herkunft: 'einreichung',
  };

  const result = { f, dta, buf, hash, ownerId, zeileId, rxId, headerId, mahnungId, patientId, sourceHeader, sourceZeile };
  result.historicalSessions = parseOriginalDtaMessage({ dtaContent: buf, expectedSha256: hash, sourceHeader, sourceZeile,
    reason: '2', selectedSessionIndices: [0], currentSenderIk: '800000000', sourcePatientId: patientId,
    verifiedSourcePatientId: patientId, nachweisPruefung: auditedProof2(result) }).prescription.sessions;
  return result;
}

/**
 * Simulierter HTTP-Aufruf gegen den Express-Router.
 */
async function callPostRoute(router, { body = {}, headers = {}, token = 'valid-token' } = {}) {
  const reqHeaders = { ...headers };
  if (token && !reqHeaders.authorization) {
    reqHeaders.authorization = `Bearer ${token}`;
  }

  let statusCode = 200;
  let responseData = null;

  const req = {
    method: 'POST',
    url: '/abrechnung/zuzahlungsforderung',
    path: '/abrechnung/zuzahlungsforderung',
    headers: reqHeaders,
    body,
    ip: '127.0.0.1',
  };

  await new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) {
        statusCode = code;
        this.statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        resolve();
        return this;
      },
    };

    router(req, res, (err) => {
      if (err) {
        statusCode = err.status || 500;
        responseData = { error: err.message };
      }
      resolve();
    });
  });

  return { status: statusCode, body: responseData };
}

const ABRECHNUNG_COLUMNS = new Set([
  'id', 'owner_id', 'kostentraeger_ik', 'dateiname', 'rechnungsnummer',
  'total_eur', 'zuzahlung_total', 'status', 'dta_file_size', 'dta_segment_count',
  'prescription_count', 'rejected_count', 'storage_path', 'begleitzettel_path',
  'zaa_uploaded_at', 'paid_at', 'created_at', 'updated_at', 'signed_storage_path',
  'signed_at', 'signed_by_cert_thumbprint', 'business_id', 'auftragsdatei_path',
  'auftragsdatei_size', 'dta_sha256', 'auftragsdatei_sha256', 'signed_sha256',
  'betriebsart', 'datenaustauschreferenz', 'transfernummer', 'empfaenger_ik',
  'verwerfungsgrund', 'encrypted_storage_path', 'encrypted_sha256', 'verschluesselt_am',
  'verschluesselt_fuer_fingerprint', 'verschluesselung_hinweis',
  'verarbeitungskennzeichen', 'zuzahlungsforderung_ursprung_id', 'zuzahlungsforderung_daten',
]);

const ABRECHNUNG_ZEILE_COLUMNS = new Set([
  'id', 'abrechnung_id', 'owner_id', 'business_id', 'prescription_id',
  'kostentraeger_ik', 'karten_ik', 'einzel_rechnungsnummer', 'sort_order',
  'belegnummer', 'patient_name', 'versichertennummer', 'verordnungsdatum',
  'therapie_bereich', 'heilmittel_position', 'anzahl_einheiten', 'leistungen',
  'brutto_eur', 'zuzahlung_eur', 'netto_eur', 'status', 'absetzung_eur',
  'absetzung_grund', 'absetzung_am', 'herkunft', 'created_at', 'updated_at',
]);

function parseSelectedColumns(cols) {
  if (!cols || cols === '*') return [];
  const result = [];
  let current = '';
  let depth = 0;
  for (const ch of cols) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function validateSelectedColumns(table, cols) {
  if (!cols || cols === '*') return;
  const parts = parseSelectedColumns(cols);
  for (const part of parts) {
    if (part.includes(':') || part.includes('(')) continue;
    const colName = part.split(/\s+/)[0];
    if (table === 'abrechnung') {
      assert.ok(ABRECHNUNG_COLUMNS.has(colName), `Column "${colName}" does not exist on table "abrechnung" in SCHEMA.sql`);
    } else if (table === 'abrechnung_zeile') {
      assert.ok(ABRECHNUNG_ZEILE_COLUMNS.has(colName), `Column "${colName}" does not exist on table "abrechnung_zeile" in SCHEMA.sql`);
    }
  }
}

/**
 * Erzeugt einen konfigurierbaren Supabase-Mock für Route-Tests mit vollständiger Chainability.
 */
function decorateClient(origClient, state, opts) {
  if (state.recording === undefined) {
    state.recording = true;
    state.events = [];
    state.storageRemovals = [];
  }
  let clock = 1;
  const getNextTimestamp = () => `2026-10-04T12:00:00.${String(clock++).padStart(6, '0')}+00:00`;
  function normalizeClaim(row) {
    if (!row) return null;
    if (opts.normalizeSnapshot === false) return structuredClone(row);
    const norm = {
      id: row.id || 'claim-uuid-999',
      owner_id: row.owner_id || (opts.testData ? opts.testData.ownerId : null),
      business_id: row.business_id || null,
      zuzahlungsforderung_ursprung_id: row.zuzahlungsforderung_ursprung_id !== undefined ? row.zuzahlungsforderung_ursprung_id : (opts.testData?.sourceZeile?.id || opts.testData?.zeileId || null),
      zuzahlungsforderung_daten: row.zuzahlungsforderung_daten || null,
      verarbeitungskennzeichen: row.verarbeitungskennzeichen || '03',
      ...structuredClone(row)
    };
    const coreFields = [
      'id', 'owner_id', 'status', 'updated_at',
      'dateiname', 'rechnungsnummer', 'total_eur', 'zuzahlung_total',
      'dta_file_size', 'dta_segment_count', 'prescription_count',
      'rejected_count', 'datenaustauschreferenz', 'transfernummer', 'empfaenger_ik',
      'kostentraeger_ik', 'betriebsart', 'storage_path', 'dta_sha256',
      'begleitzettel_path', 'auftragsdatei_path', 'auftragsdatei_size', 'auftragsdatei_sha256',
      'verwerfungsgrund', 'signed_storage_path', 'signed_sha256', 'signed_at',
      'signed_by_cert_thumbprint', 'encrypted_storage_path', 'encrypted_sha256',
      'verschluesselt_am', 'verschluesselt_fuer_fingerprint', 'verschluesselung_hinweis',
      'zaa_uploaded_at', 'paid_at'
    ];
    for (const f of coreFields) {
      if (norm[f] === undefined) norm[f] = null;
    }
    if (opts.existingClaimRow && row.id === opts.existingClaimRow.id) {
       if (norm.datenaustauschreferenz === null) norm.datenaustauschreferenz = opts.existingClaimRow.datenaustauschreferenz ?? 25;
       if (norm.transfernummer === null) norm.transfernummer = opts.existingClaimRow.transfernummer ?? 25;
       if (norm.rechnungsnummer === null) norm.rechnungsnummer = opts.existingClaimRow.rechnungsnummer ?? 'R2026-W40-025';
    }
    if (!norm.updated_at) norm.updated_at = getNextTimestamp();
    return norm;
  }

  if (opts.existingClaimRow) {
    state.currentClaim = normalizeClaim(opts.existingClaimRow);
  }

  const origFrom = origClient.from.bind(origClient);
  origClient.from = (table) => {
    const origTable = origFrom(table);

    if (table === 'abrechnung_zeile') {
       const origInsert = origTable.insert.bind(origTable);
       origTable.insert = (payload) => {
         if (opts.lineInsertError) {
           state.insertCalls.push({ table, payload });
           return {
             select() { return this; },
             then(resolve) { resolve({ data: null, error: opts.lineInsertError }); },
             async single() { return { data: null, error: opts.lineInsertError }; }
           };
         }
         return origInsert(payload);
       };
       return origTable;
    }

    if (table !== 'abrechnung') return origTable;

    return {
      select(cols) {
        const origQuery = origTable.select(cols);
        const filters = {};
        const query = {
          eq(c, v) { filters[c] = v; origQuery.eq(c, v); return query; },
          is(c, v) { filters[c] = v; return query; },
          async maybeSingle() {
            if (state.currentClaim && (!filters.id || filters.id === state.currentClaim.id)) {
                for (const k of Object.keys(filters)) {
                    if (filters[k] === null && state.currentClaim[k] !== null) return { data: null, error: null };
                    if (filters[k] !== null && state.currentClaim[k] !== filters[k]) return { data: null, error: null };
                }
                return { data: structuredClone(state.currentClaim), error: null };
            }
            return origQuery.maybeSingle();
          },
          async single() {
            const res = await query.maybeSingle();
            if (!res.data) return { data: null, error: { code: 'PGRST116' } };
            return res;
          },
          then(resolve) {
            query.maybeSingle().then(res => {
                resolve({ data: res.data ? [res.data] : [], error: null });
            });
          }
        };
        return query;
      },
      insert(payload) {
        const origInsert = origTable.insert(payload);
        return {
          select(cols) {
            return {
              async single() {
                const res = await origInsert.select(cols).single();
                if (res.error) return res;
                state.currentClaim = normalizeClaim(res.data);
                if (state.currentClaim) state.currentClaim.status = payload.status || 'erstellt';
                if (state.currentClaim && !state.currentClaim.updated_at) state.currentClaim.updated_at = getNextTimestamp();
                return { data: structuredClone(state.currentClaim), error: null };
              },
              then(resolve) { this.single().then(resolve); }
            };
          },
          then(resolve) { this.select().single().then(resolve); }
        };
      },
      update(payload) {
        const origUpdate = origTable.update(payload);
        const updateFilters = state.updateFilters[state.updateFilters.length - 1];

        let onceApplied = false;
        const query = {
          eq(c, v) { origUpdate.eq(c, v); return query; },
          is(c, v) { updateFilters[c] = v; return query; },
          select(cols) {
            return {
               async maybeSingle() { return query.executeOnce(); },
               async single() {
                 const r = await query.executeOnce();
                 if (!r.data) return { data: null, error: { code: 'PGRST116' } };
                 return r;
               },
               then(resolve) {
                 query.executeOnce().then(res => resolve(res.error ? res : { data: res.data ? [res.data] : [], error: null }));
               }
            };
          },
          then(resolve) {
            query.executeOnce().then(res => resolve(res));
          },
          async executeOnce() {
            if (onceApplied) return { data: structuredClone(state.currentClaim), error: null };
            onceApplied = true;

            if (opts.beforeUpdate) {
               const hookRes = await opts.beforeUpdate({ payload, filters: updateFilters, state });
               if (hookRes && hookRes.error) return hookRes;
            }

            if (state.currentClaim) {
                let match = true;
                for (const k of Object.keys(updateFilters)) {
                    if (updateFilters[k] === null) {
                        if (state.currentClaim[k] !== null) match = false;
                    } else {
                        if (state.currentClaim[k] !== updateFilters[k]) match = false;
                    }
                }
                if (!match) return { data: null, error: null };

                if (!opts.casWinner && payload.status === 'erstellt' && state.currentClaim.status === 'verworfen') {
                    return { data: null, error: null };
                }

                Object.assign(state.currentClaim, payload);
                state.currentClaim.updated_at = getNextTimestamp();
                if (state.recording) {
                    state.events.push({ type: 'update', payload: structuredClone(payload) });
                }
                return { data: structuredClone(state.currentClaim), error: null };
            }
            return origUpdate.select().maybeSingle();
          }
        };
        return query;
      }
    };
  };

  const origStorageFrom = origClient.storage.from.bind(origClient.storage);
  origClient.storage.from = (bucket) => {
     const origBucket = origStorageFrom(bucket);
     return {
       ...origBucket,
       async upload(path, buffer, uploadOpts) {
         if (opts.uploadBegleitError && path.endsWith('.html')) {
             return { data: null, error: opts.uploadBegleitError };
         }
         const isDtaOrSuffixless = path.endsWith('.dta') || /ESOL0\d{3}$/.test(path) || /TSOL0\d{3}$/.test(path);
         if (opts.uploadDtaError && isDtaOrSuffixless) {
             return { data: null, error: opts.uploadDtaError };
         }
         if (state.recording) {
            state.storageUploads.push({ path, length: buffer.length, opts: uploadOpts });
         }
         return { data: { path }, error: null };
       },
       async remove(paths) {
         if (state.recording) {
             if (!state.storageRemovals) state.storageRemovals = [];
             state.storageRemovals.push(paths);
             state.events.push({ type: 'storage_remove', paths });
         }
         if (opts.storageRemoveError) return { data: null, error: opts.storageRemoveError };
         return { data: paths.map(p => ({ name: p })), error: null };
       }
     };
  };

  return origClient;
}
function erstelleSupabaseMock({
  testData,
  role = 'owner',
  authError = null,
  profileError = null,
  sourceZeileOverride = null,
  sourceHeaderOverride = null,
  belegRows = [],
  rxRowOverride = undefined,
  mahnungRows = null,
  mahnungOverride = undefined,
  storageDownloadError = null,
  storageBytesOverride = null,
  insertReservationError = null,
  existingClaimRow = null,
  casWinner = true,
  uploadDtaError = null,
  existingSnapshotLine = null,
  docRowOverride = undefined,
  beforeUpdate = null,
  lineInsertError = null,
  uploadBegleitError = null,
  storageRemoveError = null,
  normalizeSnapshot = true,
} = {}) {
  const state = {
    insertCalls: [],
    updateCalls: [],
    storageUploads: [],
    storageRemovals: [],
    downloads: [],
    updateFilters: [],
    events: [],
    currentClaim: null,
    recording: true,
  };

  const client = {
    auth: {
      async getUser(token) {
        if (authError || token === 'invalid-token') {
          return { data: null, error: authError || new Error('Invalid token') };
        }
        return { data: { user: { id: testData.ownerId } }, error: null };
      },
    },
    from(table) {
      return {
        select(cols) {
          validateSelectedColumns(table, cols);
          const filters = {};
          const query = {
            eq(col, val) {
              filters[col] = val;
              return query;
            },
            async maybeSingle() {
              if (filters.owner_id && filters.owner_id !== testData.ownerId) {
                return { data: null, error: null };
              }

              if (table === 'abrechnung' && filters.zuzahlungsforderung_ursprung_id) {
                return { data: existingClaimRow, error: null };
              }
              if (table === 'abrechnung_zeile') {
                if (filters.abrechnung_id) {
                  return { data: existingSnapshotLine, error: null };
                }
                if (filters.id) {
                  if (sourceZeileOverride === 'not-found') return { data: null, error: null };
                  const z = sourceZeileOverride || testData.sourceZeile;
                  const h = sourceHeaderOverride || testData.sourceHeader;
                  return { data: { ...z, abrechnung: h }, error: null };
                }
              }
              if (table === 'profiles') {
                if (profileError) return { data: null, error: profileError };
                return {
                  data: {
                    id: testData.ownerId,
                    role,
                    owner_id: role === 'employee' ? testData.ownerId : null,
                    business_name: 'Podologie am Markt',
                    ik_number: '800000000',
                    sector: 'podologie',
                    street: 'Marktplatz',
                    house_number: '1',
                    zip: '80331',
                    city: 'München',
                    phone: '089123456',
                  },
                  error: null,
                };
              }
              if (table === 'terapeut_zertifikat') {
                return {
                  data: {
                    ik_nummer: '800000000',
                    betriebsart: 'echt',
                  },
                  error: null,
                };
              }
              if (table === 'kostentraeger') {
                return { data: { ik: '108310400', name: 'AOK Bayern' }, error: null };
              }
              if (table === 'prescriptions') {
                if (rxRowOverride === null) return { data: null, error: null };
                const rx = rxRowOverride !== undefined ? rxRowOverride : {
                  id: testData.rxId,
                  patient_id: testData.patientId || 'c1111111-1111-1111-1111-111111111111',
                  zuzahlung_kassiert_am: null,
                  zuzahlung_eur: testData.sourceZeile.zuzahlung_eur,
                };
                return { data: rx, error: null };
              }
              if (table === 'prescription_documents') {
                if (docRowOverride !== undefined) {
                  return { data: docRowOverride, error: null };
                }
                if (filters.id) {
                  return {
                    data: {
                      id: String(filters.id),
                      owner_id: testData.ownerId,
                      prescription_id: testData.rxId,
                      patient_id: testData.patientId || 'c1111111-1111-1111-1111-111111111111',
                      business_id: testData.sourceZeile?.business_id || 'b1111111-1111-1111-1111-111111111111',
                    },
                    error: null,
                  };
                }
                return { data: null, error: null };
              }
              if (table === 'mahnungen') {
                if (filters.id && filters.id === testData.mahnungId) {
                  if (mahnungOverride !== undefined) {
                    return { data: mahnungOverride, error: null };
                  }
                  return {
                    data: {
                      id: testData.mahnungId,
                      owner_id: testData.ownerId,
                      patient_id: testData.patientId || 'c1111111-1111-1111-1111-111111111111',
                      prescription_id: testData.rxId,
                      ausfallrechnung_id: null,
                      status: 'offen',
                      sent_at: '2026-09-01T10:00:00Z',
                      original_faelligkeit: '2026-08-20',
                      neue_faelligkeit: '2026-09-01',
                    },
                    error: null,
                  };
                }
                return { data: null, error: null };
              }
              return { data: null, error: null };
            },
            async single() {
              return query.maybeSingle();
            },
            then(resolve) {
              if (table === 'belegliste') {
                resolve({ data: belegRows, error: null });
              } else if (table === 'mahnungen') {
                let rows = mahnungRows !== null ? mahnungRows : [{
                  id: testData.mahnungId,
                  owner_id: testData.ownerId,
                  patient_id: testData.patientId || 'c1111111-1111-1111-1111-111111111111',
                  prescription_id: testData.rxId,
                  ausfallrechnung_id: null,
                  mahnung_nr: 1,
                  sent_at: '2026-08-30T10:00:00Z',
                  status: 'offen',
                }];
                if (filters.id) {
                  rows = rows.filter(r => r.id === filters.id);
                }
                resolve({ data: rows, error: null });
              } else {
                resolve({ data: [], error: null });
              }
            },
          };
          return query;
        },
        insert(payload) {
          state.insertCalls.push({ table, payload });
          if (table === 'abrechnung') {
            for (const k of Object.keys(payload)) {
              assert.ok(ABRECHNUNG_COLUMNS.has(k), `Column "${k}" does not exist on table "abrechnung" in SCHEMA.sql`);
            }
            assert.ok(payload.owner_id, 'owner_id is mandatory on abrechnung');
            assert.ok(payload.kostentraeger_ik, 'kostentraeger_ik is mandatory on abrechnung');
          } else if (table === 'abrechnung_zeile') {
            for (const k of Object.keys(payload)) {
              assert.ok(ABRECHNUNG_ZEILE_COLUMNS.has(k), `Column "${k}" does not exist on table "abrechnung_zeile" in SCHEMA.sql`);
            }
            assert.ok(payload.owner_id, 'owner_id is mandatory on abrechnung_zeile');
            assert.ok(payload.abrechnung_id, 'abrechnung_id is mandatory on abrechnung_zeile');
            assert.ok(payload.kostentraeger_ik, 'kostentraeger_ik is mandatory on abrechnung_zeile (SCHEMA.sql NOT NULL)');
            assert.ok(payload.einzel_rechnungsnummer, 'einzel_rechnungsnummer is mandatory on abrechnung_zeile');
            assert.ok(payload.business_id !== undefined, 'business_id from original is required on abrechnung_zeile');
            assert.ok(
              ['eingereicht', 'akzeptiert', 'abgesetzt', 'teilabgesetzt', 'nachgereicht'].includes(payload.status),
              `status "${payload.status}" must match CHECK constraint in SCHEMA.sql`
            );
          }

          return {
            select() {
              return {
                async single() {
                  if (table === 'abrechnung') {
                    if (insertReservationError) {
                      return { data: null, error: insertReservationError };
                    }
                    return { data: { id: 'claim-uuid-999', status: 'erstellt', ...payload }, error: null };
                  }
                  return { data: payload, error: null };
                },
                then(resolve) {
                  resolve({ data: [{ id: 'claim-zeile-uuid-1', ...payload }], error: null });
                },
              };
            },
            async then(resolve) {
              resolve({ data: payload, error: null });
            },
          };
        },
        update(payload) {
          state.updateCalls.push({ table, payload });
          if (table === 'abrechnung') {
            for (const k of Object.keys(payload)) {
              assert.ok(ABRECHNUNG_COLUMNS.has(k), `Column "${k}" does not exist on table "abrechnung" in SCHEMA.sql`);
            }
          } else if (table === 'abrechnung_zeile') {
            for (const k of Object.keys(payload)) {
              assert.ok(ABRECHNUNG_ZEILE_COLUMNS.has(k), `Column "${k}" does not exist on table "abrechnung_zeile" in SCHEMA.sql`);
            }
          }

          const updateFilters = {};
          state.updateFilters.push(updateFilters);
          const updateQuery = {
            eq(col, val) {
              updateFilters[col] = val;
              return updateQuery;
            },
            select() {
              return {
                async maybeSingle() {
                  if (table === 'abrechnung' && updateFilters.status === 'verworfen') {
                    if (!casWinner) return { data: null, error: null };
                    return {
                      data: {
                        id: updateFilters.id,
                        status: 'erstellt',
                        datenaustauschreferenz: 25,
                        transfernummer: 25,
                        rechnungsnummer: 'R2026-W40-025',
                      },
                      error: null,
                    };
                  }
                  return { data: { id: updateFilters.id }, error: null };
                },
                then(resolve) {
                  if (table === 'abrechnung' && updateFilters.status === 'verworfen') {
                    if (!casWinner) return resolve({ data: [], error: null });
                    return resolve({
                      data: [{
                        id: updateFilters.id,
                        status: 'erstellt',
                        datenaustauschreferenz: 25,
                        transfernummer: 25,
                        rechnungsnummer: 'R2026-W40-025',
                      }],
                      error: null,
                    });
                  }
                  resolve({ data: [{ id: updateFilters.id }], error: null });
                },
              };
            },
            then(resolve) {
              resolve({ data: { id: updateFilters.id }, error: null });
            },
          };
          return updateQuery;
        },
      };
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, 'abrechnungen');
        return {
          async download(path) {
            state.downloads.push(path);
            if (storageDownloadError) return { data: null, error: storageDownloadError };
            const bytes = storageBytesOverride || testData.buf;
            return {
              data: {
                async arrayBuffer() {
                  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
                },
              },
              error: null,
            };
          },
          async upload(path, buffer, opts) {
            state.storageUploads.push({ path, length: buffer.length });
            if (uploadDtaError && path.endsWith('.dta')) {
              return { data: null, error: uploadDtaError };
            }
            return { data: { path }, error: null };
          },
        };
      },
    },
  };

  return { client: decorateClient(client, state, { insertReservationError, casWinner, existingClaimRow, beforeUpdate, lineInsertError, uploadBegleitError, storageRemoveError, uploadDtaError, testData, normalizeSnapshot }), state };
}

function erstelleMockDeps(supabaseMock, { speichereAuftragError = null } = {}) {
  return {
    supabase: supabaseMock.client,
    async vergebeNummern(args) {
      assert.equal(arguments.length, 1, 'vergebeNummern must be called with a single argument object');
      assert.ok(args && typeof args === 'object', 'args must be an object');
      const { ownerId, absenderIk, empfaengerIk } = args;
      assert.ok(ownerId, 'ownerId is required in vergebeNummern');
      assert.ok(absenderIk, 'absenderIk is required in vergebeNummern');
      assert.ok(empfaengerIk, 'empfaengerIk is required in vergebeNummern');
      return { datennummer: 25, transfernummer: 25 };
    },
    async speichereAuftragsdatei(args) {
      assert.equal(arguments.length, 1, 'speichereAuftragsdatei must be called with a single argument object');
      const { dta, verzeichnis } = args || {};
      assert.ok(dta, 'dta is required in speichereAuftragsdatei');
      assert.ok(verzeichnis, 'verzeichnis is required in speichereAuftragsdatei');
      if (speichereAuftragError) {
        return { pfad: null, groesse: null, sha256: null, fehler: speichereAuftragError.message };
      }
      return {
        pfad: `${verzeichnis}/${dta.filename}.auf`,
        groesse: 348,
        sha256: 'auf-sha256-test',
        fehler: null,
      };
    },
    async baueBegleitzettel(args) {
      assert.equal(arguments.length, 1, 'baueBegleitzettel must be called with a single argument object');
      const { dta, belege, kk, kostentraegerIk, now, praxis, sammelRechnungsnummer, bereich, eigenerAbrechnungscode } = args || {};
      assert.ok(dta, 'dta is required in baueBegleitzettel');
      assert.ok(Array.isArray(belege), 'belege array is required');
      assert.equal(belege[0]._i, 0, '_i: 0 is required on each beleg');
      assert.ok(belege[0].belegnummer, 'belegnummer is required');
      assert.ok(belege[0].patient_nachname, 'patient_nachname is required');
      assert.ok(belege[0].brutto, 'brutto is required');
      assert.ok(praxis, 'praxis is required');
      assert.ok(praxis.name, 'praxis.name is required');
      assert.ok(sammelRechnungsnummer, 'sammelRechnungsnummer is required');
      assert.ok(bereich, 'bereich is required');
      assert.ok(eigenerAbrechnungscode, 'eigenerAbrechnungscode is required');
      return '<html>Begleitzettel</html>';
    },
    rechnungsartFuer(args) {
      assert.ok(args?.absenderIk, 'absenderIk required in rechnungsartFuer');
      return '1';
    },
    async ladeBetriebsart(args) {
      assert.equal(arguments.length, 1, 'ladeBetriebsart must be called with a single argument object');
      const { ownerId, empfaengerIk, cert, db } = args || {};
      assert.ok(ownerId, 'ownerId ist Pflicht in ladeBetriebsart');
      assert.ok(empfaengerIk, 'empfaengerIk ist Pflicht in ladeBetriebsart');
      assert.ok(db, 'db ist Pflicht in ladeBetriebsart');
      assert.ok(cert !== undefined, 'cert ist Pflicht in ladeBetriebsart');
      return 'echt';
    },
    async ladeAnnahmestelle() {
      return { ok: true, ik: '108310400' };
    },
    annahmestelleFehlt(res) {
      return res.status(422).json({ error: 'Annahmestelle fehlt' });
    },
    buildDtaFile,
    logAccess() {},
    isoWeek(d) {
      assert.ok(d instanceof Date, 'isoWeek requires Date');
      return { year: 2026, week: 40 };
    },
    buildSammelRechnungsnummer(y, w, s) {
      assert.ok(y && w && s, 'buildSammelRechnungsnummer requires year, week, seq');
      return `R${y}-W${String(w).padStart(2, '0')}-${String(s).padStart(3, '0')}`;
    },
    async bereichFuerAbrechnung(sb, hdr, { tenantId, tenantSector } = {}) {
      return { bereich: 'podologie', eigenerAbrechnungscode: '71' };
    },
  };
}

// ===========================================================================
// Testfälle
// ===========================================================================

test('1. Auth fail closed: Kein Token, ungültiger Token, fehlendes Profil, Angestellter abgelehnt', async () => {
  const testData = erstelleTestDta();

  // a) Kein Token -> 401
  const mock1 = erstelleSupabaseMock({ testData });
  const router1 = createZuzahlungsforderungRouter(erstelleMockDeps(mock1));
  const res1 = await callPostRoute(router1, { token: null, body: { zeileId: testData.zeileId, grund: '2', bestaetigt: true, nachweisDatum: '2026-09-01', mahnungId: testData.mahnungId } });
  assert.equal(res1.status, 401);

  // b) Ungültiger Token -> 401
  const res1b = await callPostRoute(router1, { token: 'invalid-token', body: { zeileId: testData.zeileId, grund: '2', bestaetigt: true, nachweisDatum: '2026-09-01', mahnungId: testData.mahnungId } });
  assert.equal(res1b.status, 401);

  // c) Fehlendes Profil -> 403
  const mock2 = erstelleSupabaseMock({ testData, profileError: new Error('Not found') });
  const router2 = createZuzahlungsforderungRouter(erstelleMockDeps(mock2));
  const res2 = await callPostRoute(router2, { body: { zeileId: testData.zeileId, grund: '2', bestaetigt: true, nachweisDatum: '2026-09-01', mahnungId: testData.mahnungId } });
  assert.equal(res2.status, 403);

  // d) Angestellter (role: employee) -> 403 NUR_INHABER (kein owner_id spoof)
  const mock3 = erstelleSupabaseMock({ testData, role: 'employee' });
  const router3 = createZuzahlungsforderungRouter(erstelleMockDeps(mock3));
  const res3 = await callPostRoute(router3, { body: { zeileId: testData.zeileId, grund: '2', bestaetigt: true, nachweisDatum: '2026-09-01', mahnungId: testData.mahnungId } });
  assert.equal(res3.status, 403);
  assert.equal(res3.body.code, 'NUR_INHABER');
});

test('2. Mandantentrennung: Fremder Beleg wirft 404', async () => {
  const testData = erstelleTestDta();
  const mock = erstelleSupabaseMock({ testData, sourceZeileOverride: 'not-found' });
  const router = createZuzahlungsforderungRouter(erstelleMockDeps(mock));

  const res = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
    },
  });
  assert.equal(res.status, 404);
  assert.equal(res.body.code, 'SOURCE_LINE_NOT_FOUND');
});

test('3. Bezahlte / teilbezahlte Zuzahlung wird strikt abgewiesen', async () => {
  const testData = erstelleTestDta();

  // a) Vollständig bezahlt über Kassenbuch -> 422
  const mockA = erstelleSupabaseMock({
    testData,
    belegRows: [{ prescription_id: testData.rxId, amount_eur: testData.sourceZeile.zuzahlung_eur, type: 'zuzahlung' }],
  });
  const routerA = createZuzahlungsforderungRouter(erstelleMockDeps(mockA));
  const resA = await callPostRoute(routerA, {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
    },
  });
  assert.equal(resA.status, 422);
  assert.equal(resA.body.code, 'COPAYMENT_ALREADY_PAID');

  // b) Bezahlt über Vermerk zuzahlung_kassiert_am -> 422
  const mockB = erstelleSupabaseMock({
    testData,
    rxRowOverride: { patient_id: testData.patientId, id: testData.rxId, zuzahlung_kassiert_am: '2026-08-25', zuzahlung_eur: testData.sourceZeile.zuzahlung_eur },
  });
  const routerB = createZuzahlungsforderungRouter(erstelleMockDeps(mockB));
  const resB = await callPostRoute(routerB, {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
    },
  });
  assert.equal(resB.status, 422);
  assert.equal(resB.body.code, 'COPAYMENT_ALREADY_PAID');

  // c) Teilzahlung vorhanden (saldo > 0) -> 422 PARTIAL_PAYMENT_REJECTED
  const mockC = erstelleSupabaseMock({
    testData,
    belegRows: [{ prescription_id: testData.rxId, amount_eur: 5.00, type: 'zuzahlung' }],
  });
  const routerC = createZuzahlungsforderungRouter(erstelleMockDeps(mockC));
  const resC = await callPostRoute(routerC, {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
    },
  });
  assert.equal(resC.status, 422);
  assert.equal(resC.body.code, 'PARTIAL_PAYMENT_REJECTED');
});

test('4. Fehlende Nachweise je Grund werden strikt abgewiesen', async () => {
  const testData = erstelleTestDta();
  const mock = erstelleSupabaseMock({ testData });
  const router = createZuzahlungsforderungRouter(erstelleMockDeps(mock));

  // a) Grund 2 ohne Bestätigung -> 422
  const resA = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: false,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
    },
  });
  assert.equal(resA.status, 422);
  assert.equal(resA.body.code, 'CONFIRMATION_REQUIRED');

  // b) Grund 2 ohne mahnungId -> 422
  const resB = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      nachweisPruefung: validProof2,
    },
  });
  assert.equal(resB.status, 422);
  assert.equal(resB.body.code, 'MAHNUNG_ID_REQUIRED');

  // c) Grund 1 ohne Nachweisdatum -> 422
  const resC = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId,
      grund: '1',
      bestaetigt: true,
    },
  });
  assert.equal(resC.status, 422);
  assert.equal(resC.body.code, 'INVALID_PROOF_DATE');
});

test('5. Prüfsummenfehler wird vor Reservierung/Nummernvergabe abgewiesen', async () => {
  const testData = erstelleTestDta();
  const mock = erstelleSupabaseMock({
    testData,
    sourceHeaderOverride: {
      ...testData.sourceHeader,
      dta_sha256: '0000000000000000000000000000000000000000000000000000000000000000',
    },
  });
  const router = createZuzahlungsforderungRouter(erstelleMockDeps(mock));

  const res = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
    },
  });

  assert.equal(res.status, 422);
  assert.equal(res.body.code, 'DTA_HASH_MISMATCH');
  assert.equal(mock.state.insertCalls.length, 0, 'Vor DTA-Prüfung darf keine Reservierung angelegt werden');
});

test('6. Exakte 20,00 € Forderung im Erfolgsfall: Interne Zeile brutto=netto=20 €, zuzahlung=0 €', async () => {
  const testData = erstelleTestDta({ claim20: true });
  const mock = erstelleSupabaseMock({ testData });
  const deps = erstelleMockDeps(mock);
  const router = createZuzahlungsforderungRouter(deps);

  const res = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.total_eur, 20.00);
  assert.equal(res.body.zuzahlung_total, 0);

  // Header-Update prüfen
  const headerUpdate = mock.state.updateCalls.find(u => u.table === 'abrechnung' && u.payload.total_eur !== undefined);
  assert.ok(headerUpdate, 'abrechnung-Header muss aktualisiert werden');
  assert.equal(headerUpdate.payload.total_eur, 20.00);
  assert.equal(headerUpdate.payload.zuzahlung_total, 0);
  assert.equal(headerUpdate.payload.prescription_count, 1);

  // Zeilen-Insert prüfen: Interne Zeile brutto=netto=claim, zuzahlung=0, SCHEMA-konform
  const zeilenInsert = mock.state.insertCalls.find(i => i.table === 'abrechnung_zeile');
  assert.ok(zeilenInsert, 'abrechnung_zeile muss eingefügt werden');
  assert.equal(zeilenInsert.payload.brutto_eur, 20.00);
  assert.equal(zeilenInsert.payload.netto_eur, 20.00);
  assert.equal(zeilenInsert.payload.zuzahlung_eur, 0);
  assert.equal(zeilenInsert.payload.status, 'eingereicht');
  assert.equal(zeilenInsert.payload.kostentraeger_ik, testData.sourceZeile.kostentraeger_ik);
  assert.equal(zeilenInsert.payload.business_id, testData.sourceZeile.business_id);

  // Frozen Intent prüfen
  const reservierung = mock.state.insertCalls.find(i => i.table === 'abrechnung');
  assert.ok(reservierung, 'abrechnung-Reservierung muss erfolgen');
  assert.deepEqual(reservierung.payload.zuzahlungsforderung_daten, {
    grund: '2',
    nachweisDatum: '2026-09-01',
    positionIndices: [0],
    bestaetigt: true,
    mahnungId: testData.mahnungId,
    nachweisPruefung: reservierung.payload.zuzahlungsforderung_daten.nachweisPruefung,
  });
  assert.equal(reservierung.payload.kostentraeger_ik, testData.sourceHeader.kostentraeger_ik);
});

test('7. Eindeutiger Index-Konflikt (23505): Idempotenz bei fertigen Artefakten vs. 409 bei laufendem Prozess', async () => {
  const testData = erstelleTestDta();

  // a) Bereits fertig mit Artefakten und Snapshot-Zeile -> Idempotent 200
  const mockA = erstelleSupabaseMock({
    testData,
    insertReservationError: { code: '23505', message: 'duplicate key value violates unique constraint' },
    existingClaimRow: {
      id: 'existing-claim-1',
      owner_id: testData.ownerId,
      status: 'erstellt',
      verarbeitungskennzeichen: '03',
      storage_path: `${testData.ownerId}/2026/08/existing/dta.dta`,
      dta_sha256: 'valid-sha256',
      begleitzettel_path: `${testData.ownerId}/2026/08/existing/begleitzettel.html`,
      auftragsdatei_path: `${testData.ownerId}/2026/08/existing/dta.auf`,
      auftragsdatei_size: 348,
      auftragsdatei_sha256: 'valid-auf-sha256',
      datenaustauschreferenz: 25,
      transfernummer: 25,
      rechnungsnummer: 'R2026-W36-001',
      total_eur: 12.89,
      zuzahlung_total: 0,
      zuzahlungsforderung_daten: {
        grund: '2',
        nachweisDatum: '2026-09-01',
        positionIndices: [0],
        bestaetigt: true,
        mahnungId: testData.mahnungId,
        nachweisPruefung: auditedProof2(testData),
      },
    },
    existingSnapshotLine: {
      ...testData.sourceZeile,
      leistungen: testData.historicalSessions,
      id: 'snap-1',
      prescription_id: testData.rxId,
      brutto_eur: 12.89,
      netto_eur: 12.89,
      zuzahlung_eur: 0,
      status: 'eingereicht',
    },
  });
  const routerA = createZuzahlungsforderungRouter(erstelleMockDeps(mockA));
  const resA = await callPostRoute(routerA, {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
    },
  });
  assert.equal(resA.status, 200);
  assert.equal(resA.body.idempotent, true);
  assert.equal(resA.body.total_eur, 12.89);

  // b) Noch im Erstellungsprozess (Artefakte fehlen) -> 409 CLAIM_IN_PROGRESS
  const mockB = erstelleSupabaseMock({
    testData,
    insertReservationError: { code: '23505', message: 'duplicate key value' },
    existingClaimRow: {
      id: 'existing-claim-2',
      zuzahlungsforderung_daten: { grund: '2', nachweisDatum: '2026-09-01', positionIndices: [0], bestaetigt: true, mahnungId: testData.mahnungId, nachweisPruefung: auditedProof2(testData) },
      owner_id: testData.ownerId,
      status: 'erstellt',
      verarbeitungskennzeichen: '03',
      storage_path: null,
    },
  });
  const routerB = createZuzahlungsforderungRouter(erstelleMockDeps(mockB));
  const resB = await callPostRoute(routerB, {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
    },
  });
  assert.equal(resB.status, 409);
  assert.equal(resB.body.code, 'CLAIM_IN_PROGRESS');
});

test('8. CAS-Wiederaufnahme einer verworfenen Forderung: Winner vs. Loser (409)', async () => {
  const testData = erstelleTestDta();

  // a) CAS Winner: setzt verworfen -> erstellt atomar und fährt fort
  const mockA = erstelleSupabaseMock({
    testData,
    insertReservationError: { code: '23505', message: 'duplicate key value' },
    existingClaimRow: {
      id: 'existing-claim-3',
      owner_id: testData.ownerId,
      status: 'verworfen',
      zuzahlungsforderung_daten: {
        grund: '2',
        nachweisDatum: '2026-09-01',
        positionIndices: [0],
        bestaetigt: true,
        mahnungId: testData.mahnungId,
        nachweisPruefung: auditedProof2(testData),
      },
    },
    casWinner: true,
  });
  const routerA = createZuzahlungsforderungRouter(erstelleMockDeps(mockA));
  const resA = await callPostRoute(routerA, {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
    },
  });
  assert.equal(resA.status, 200);
  assert.equal(resA.body.abrechnungId, 'existing-claim-3');

  // b) CAS Loser: anderer Prozess hat CAS gewonnen -> 409 CLAIM_RESUME_CONFLICT
  const mockB = erstelleSupabaseMock({
    testData,
    insertReservationError: { code: '23505', message: 'duplicate key value' },
    existingClaimRow: {
      id: 'existing-claim-3',
      owner_id: testData.ownerId,
      status: 'verworfen',
      zuzahlungsforderung_daten: {
        grund: '2',
        nachweisDatum: '2026-09-01',
        positionIndices: [0],
        bestaetigt: true,
        mahnungId: testData.mahnungId,
        nachweisPruefung: auditedProof2(testData),
      },
    },
    casWinner: false,
  });
  const routerB = createZuzahlungsforderungRouter(erstelleMockDeps(mockB));
  const resB = await callPostRoute(routerB, {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
    },
  });
  assert.equal(resB.status, 409);
  assert.equal(resB.body.code, 'CLAIM_RESUME_CONFLICT');
});

test('9. Fehler beim Erstellen der Artefakte bewahrt Reservierung und markiert status=verworfen ohne PHI-Log', async () => {
  const testData = erstelleTestDta();
  const mock = erstelleSupabaseMock({ testData });
  const deps = erstelleMockDeps(mock, {
    speichereAuftragError: new Error('Storage-Platte voll'),
  });
  const router = createZuzahlungsforderungRouter(deps);

  const res = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
    },
  });

  assert.equal(res.status, 500);

  // Prüfen: abrechnung wurde NICHT gelöscht, sondern auf 'verworfen' gesetzt
  const verworfenUpdate = mock.state.updateCalls.find(u => u.payload.status === 'verworfen');
  assert.ok(verworfenUpdate, 'Abrechnungskopf muss auf status=verworfen gesetzt werden');
  assert.match(verworfenUpdate.payload.verwerfungsgrund, /CREATION_FAILED/);
  assert.equal(mock.state.currentClaim.datenaustauschreferenz, 25);
  assert.equal(mock.state.currentClaim.transfernummer, 25);
});

test('10. Keine Mutation oder Umhängung der Ursprungszeile', async () => {
  const testData = erstelleTestDta();
  const mock = erstelleSupabaseMock({ testData });
  const router = createZuzahlungsforderungRouter(erstelleMockDeps(mock));

  await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
    },
  });

  const zeileUpdates = mock.state.updateCalls.filter(u => u.table === 'abrechnung_zeile');
  const rxUpdates = mock.state.updateCalls.filter(u => u.table === 'prescriptions');
  assert.equal(zeileUpdates.length, 0, 'Ursprungszeile darf nicht verändert werden');
  assert.equal(rxUpdates.length, 0, 'Verordnung darf nicht umgehängt werden');
});

test('11. Fehlende Migration führt zu sicherem 503 mit deutscher Meldung', async () => {
  const testData = erstelleTestDta();
  const mock = erstelleSupabaseMock({
    testData,
    insertReservationError: { code: '42703', message: 'column "verarbeitungskennzeichen" of relation "abrechnung" does not exist' },
  });
  const router = createZuzahlungsforderungRouter(erstelleMockDeps(mock));

  const res = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
    },
  });

  assert.equal(res.status, 503);
  assert.equal(res.body.code, 'MIGRATION_FEHLT');
  assert.match(res.body.error, /Datenbank-Migration für Zuzahlungsforderungen.*noch nicht angewendet/);
});

test('12. Zuzahlungsforderung mit Nachweisdatum in der Zukunft wird abgewiesen', async () => {
  const testData = erstelleTestDta();
  const mock = erstelleSupabaseMock({ testData });
  const router = createZuzahlungsforderungRouter(erstelleMockDeps(mock));

  const res = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2099-01-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
    },
  });

  assert.equal(res.status, 422);
  assert.equal(res.body.code, 'PROOF_DATE_IN_FUTURE');
});

test('13. CAS-Wiederaufnahme mit abweichendem Intent wirft 409 FROZEN_INTENT_MISMATCH', async () => {
  const testData = erstelleTestDta();
  const mock = erstelleSupabaseMock({
    testData,
    insertReservationError: { code: '23505', message: 'duplicate key value' },
    existingClaimRow: {
      id: 'existing-claim-4',
      owner_id: testData.ownerId,
      status: 'verworfen',
      zuzahlungsforderung_daten: {
        grund: '2',
        nachweisDatum: '2026-08-01', // Anderes Datum als im Request
        positionIndices: [0],
        bestaetigt: true,
        mahnungId: testData.mahnungId,
        nachweisPruefung: auditedProof2(testData),
      },
    },
  });
  const router = createZuzahlungsforderungRouter(erstelleMockDeps(mock));

  const res = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
    },
  });

  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'FROZEN_INTENT_MISMATCH');
});

test('14. Kassenbuch mit unlesbarer Verordnung oder negativem Saldo wird abgewiesen', async () => {
  const testData = erstelleTestDta();

  // a) Unlesbare Verordnung (rxRes.data === null) -> 422
  const mockA = erstelleSupabaseMock({ testData, rxRowOverride: null });
  const routerA = createZuzahlungsforderungRouter(erstelleMockDeps(mockA));
  const resA = await callPostRoute(routerA, {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
    },
  });
  assert.equal(resA.status, 422);
  assert.equal(resA.body.code, 'PRESCRIPTION_LOOKUP_FAILED');

  // b) Negativer Kassenbuch-Saldo -> 422 LEDGER_INVALID_SALDO
  const mockB = erstelleSupabaseMock({
    testData,
    belegRows: [{ prescription_id: testData.rxId, amount_eur: -10.00, type: 'storno' }],
  });
  const routerB = createZuzahlungsforderungRouter(erstelleMockDeps(mockB));
  const resB = await callPostRoute(routerB, {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
    },
  });
  assert.equal(resB.status, 422);
  assert.equal(resB.body.code, 'LEDGER_INVALID_SALDO');
});

test('15. Snapshot exists + final header write failure: Retry recovers same ID without new number or re-upload', async () => {
  const testData = erstelleTestDta();
  let vergebeNummernCalled = false;
  const mock = erstelleSupabaseMock({
    testData,
    insertReservationError: { code: '23505', message: 'duplicate key' },
    existingClaimRow: {
      id: 'existing-claim-15',
      owner_id: testData.ownerId,
      status: 'erstellt',
      verarbeitungskennzeichen: '03',
      storage_path: `${testData.ownerId}/2026/08/existing/dta.dta`,
      dta_sha256: 'valid-sha256',
      begleitzettel_path: `${testData.ownerId}/2026/08/existing/begleit.html`,
      auftragsdatei_path: `${testData.ownerId}/2026/08/existing/dta.auf`,
      auftragsdatei_size: 348,
      auftragsdatei_sha256: 'valid-auf-sha256',
      datenaustauschreferenz: 25,
      transfernummer: 25,
      rechnungsnummer: 'R2026-W36-001',
      total_eur: 12.89,
      zuzahlung_total: 0,
      zuzahlungsforderung_daten: {
        grund: '2',
        nachweisDatum: '2026-09-01',
        positionIndices: [0],
        bestaetigt: true,
        mahnungId: testData.mahnungId,
        nachweisPruefung: auditedProof2(testData),
      },
    },
    existingSnapshotLine: {
      ...testData.sourceZeile,
      leistungen: testData.historicalSessions,
      id: 'snap-15',
      prescription_id: testData.rxId,
      brutto_eur: 12.89,
      netto_eur: 12.89,
      zuzahlung_eur: 0,
      status: 'eingereicht',
    },
  });

  const deps = erstelleMockDeps(mock);
  const origVergebe = deps.vergebeNummern;
  deps.vergebeNummern = async (args) => {
    vergebeNummernCalled = true;
    return origVergebe(args);
  };

  const router = createZuzahlungsforderungRouter(deps);
  const res = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.abrechnungId, 'existing-claim-15');
  assert.equal(vergebeNummernCalled, false, 'Darf keine neuen Nummern ziehen');
});

test('16. Fortgeschrittene Status (gesendet, accepted, paid) antworten idempotent 200 statt 409', async () => {
  const testData = erstelleTestDta();
  for (const st of ['gesendet', 'accepted', 'paid']) {
    const mock = erstelleSupabaseMock({
      testData,
      insertReservationError: { code: '23505', message: 'duplicate key' },
      existingClaimRow: {
        id: `existing-claim-${st}`,
        owner_id: testData.ownerId,
        status: st,
        verarbeitungskennzeichen: '03',
        storage_path: `${testData.ownerId}/2026/08/existing/dta.dta`,
        dta_sha256: 'valid-sha256',
        begleitzettel_path: `${testData.ownerId}/2026/08/existing/begleit.html`,
        auftragsdatei_path: `${testData.ownerId}/2026/08/existing/dta.auf`,
        auftragsdatei_size: 348,
        auftragsdatei_sha256: 'valid-auf-sha256',
        datenaustauschreferenz: 25,
        transfernummer: 25,
        rechnungsnummer: 'R2026-W36-001',
        total_eur: 12.89,
        zuzahlung_total: 0,
        zuzahlungsforderung_daten: {
          grund: '2',
          nachweisDatum: '2026-09-01',
          positionIndices: [0],
          bestaetigt: true,
          mahnungId: testData.mahnungId,
          nachweisPruefung: auditedProof2(testData),
        },
      },
      existingSnapshotLine: {
      ...testData.sourceZeile,
      leistungen: testData.historicalSessions,
        id: `snap-${st}`,
        prescription_id: testData.rxId,
        brutto_eur: 12.89,
        netto_eur: 12.89,
        zuzahlung_eur: 0,
        status: 'eingereicht',
      },
    });

    const router = createZuzahlungsforderungRouter(erstelleMockDeps(mock));
    const res = await callPostRoute(router, {
      body: {
        zeileId: testData.zeileId,
        grund: '2',
        bestaetigt: true,
        nachweisDatum: '2026-09-01',
        mahnungId: testData.mahnungId,
        nachweisPruefung: validProof2,
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.idempotent, true);
    assert.equal(res.body.status, st);
  }
});

test('17. Abweichender Intent bei nachweisDokumentId wirft 409 FROZEN_INTENT_MISMATCH', async () => {
  const testData = erstelleTestDta();
  const mock = erstelleSupabaseMock({
    testData,
    insertReservationError: { code: '23505', message: 'duplicate key' },
    existingClaimRow: {
      id: 'existing-claim-doc-mismatch',
      owner_id: testData.ownerId,
      status: 'verworfen',
      zuzahlungsforderung_daten: {
        grund: '2',
        nachweisDatum: '2026-09-01',
        positionIndices: [0],
        bestaetigt: true,
        mahnungId: testData.mahnungId,
        nachweisPruefung: auditedProof2(testData),
        nachweisDokumentId: '10001',
      },
    },
  });
  const router = createZuzahlungsforderungRouter(erstelleMockDeps(mock));

  const res = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
      nachweisDokumentId: '10002',
    },
  });

  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'FROZEN_INTENT_MISMATCH');
});

test('18. KZ2 Mahnung-Validierungen: Entwurf, bezahlt, Frist nicht abgelaufen, Ausfallrechnung, Patienten-Mismatch', async () => {
  const testData = erstelleTestDta();

  const validProof2 = {
    art: 'zahlungsaufforderung43c',
    referenz: 'MAHN-2026-01',
    versandDatum: '2026-09-01',
    versandArt: 'post',
    nachweisBeigefuegtBestaetigt: true,
    erfolgloserEinzugBestaetigt: true,
    bestaetigt: true
  };

  // b) Mahnung Entwurf / nicht offen
  const mockB = erstelleSupabaseMock({
    testData,
    mahnungOverride: {
      id: testData.mahnungId,
      owner_id: testData.ownerId,
      patient_id: testData.patientId,
      prescription_id: testData.rxId,
      ausfallrechnung_id: null,
      status: 'entwurf',
      neue_faelligkeit: '2026-08-01',
    },
  });
  const resB = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mockB)), {
    body: { zeileId: testData.zeileId, grund: '2', bestaetigt: true, nachweisDatum: '2026-09-01', mahnungId: testData.mahnungId, nachweisPruefung: validProof2 },
  });
  assert.equal(resB.status, 422);
  assert.equal(resB.body.code, 'MAHNUNG_NOT_OPEN');

  // c) Mahnung bezahlt / nicht offen
  const mockC = erstelleSupabaseMock({
    testData,
    mahnungOverride: {
      id: testData.mahnungId,
      owner_id: testData.ownerId,
      patient_id: testData.patientId,
      prescription_id: testData.rxId,
      ausfallrechnung_id: null,
      status: 'bezahlt',
      neue_faelligkeit: '2026-08-01',
    },
  });
  const resC = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mockC)), {
    body: { zeileId: testData.zeileId, grund: '2', bestaetigt: true, nachweisDatum: '2026-09-01', mahnungId: testData.mahnungId, nachweisPruefung: validProof2 },
  });
  assert.equal(resC.status, 422);
  assert.equal(resC.body.code, 'MAHNUNG_NOT_OPEN');

  // d) Mahnung Frist in Zukunft (neue_faelligkeit > heute)
  const mockD = erstelleSupabaseMock({
    testData,
    mahnungOverride: {
      id: testData.mahnungId,
      owner_id: testData.ownerId,
      patient_id: testData.patientId,
      prescription_id: testData.rxId,
      ausfallrechnung_id: null,
      status: 'offen',
      neue_faelligkeit: '2099-12-31',
    },
  });
  const resD = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mockD)), {
    body: { zeileId: testData.zeileId, grund: '2', bestaetigt: true, nachweisDatum: '2026-09-01', mahnungId: testData.mahnungId, nachweisPruefung: validProof2 },
  });
  assert.equal(resD.status, 422);
  assert.equal(resD.body.code, 'MAHNUNG_DEADLINE_NOT_EXPIRED');

  // e) Mahnung für Ausfallrechnung
  const mockE = erstelleSupabaseMock({
    testData,
    mahnungOverride: {
      id: testData.mahnungId,
      owner_id: testData.ownerId,
      patient_id: testData.patientId,
      prescription_id: testData.rxId,
      ausfallrechnung_id: '66666666-6666-6666-6666-666666666666',
      status: 'offen',
      neue_faelligkeit: '2026-08-01',
    },
  });
  const resE = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mockE)), {
    body: { zeileId: testData.zeileId, grund: '2', bestaetigt: true, nachweisDatum: '2026-09-01', mahnungId: testData.mahnungId, nachweisPruefung: validProof2 },
  });
  assert.equal(resE.status, 422);
  assert.equal(resE.body.code, 'MAHNUNG_AUSFALLRECHNUNG_NOT_ALLOWED');

  // f) Mahnung anderer Patient
  const mockF = erstelleSupabaseMock({
    testData,
    mahnungOverride: {
      id: testData.mahnungId,
      owner_id: testData.ownerId,
      patient_id: '99999999-9999-9999-9999-999999999999',
      prescription_id: testData.rxId,
      ausfallrechnung_id: null,
      status: 'offen',
      neue_faelligkeit: '2026-08-01',
    },
  });
  const resF = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mockF)), {
    body: { zeileId: testData.zeileId, grund: '2', bestaetigt: true, nachweisDatum: '2026-09-01', mahnungId: testData.mahnungId, nachweisPruefung: validProof2 },
  });
  assert.equal(resF.status, 422);
  assert.equal(resF.body.code, 'MAHNUNG_PATIENT_MISMATCH');

  // g) Teilselektion für Grund 2 wird abgewiesen
  const mockG = erstelleSupabaseMock({ testData });
  const resG = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mockG)), {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      positionIndices: [],
      nachweisPruefung: validProof2
    },
  });
  assert.equal(resG.status, 422);
  assert.equal(resG.body.code, 'PARTIAL_SELECTION_REJECTED');
});

test('19. Grund 1 (belastungsgrenze62): Erfolgsfall erzeugt VKZ 03 mit angereichertem nachweisPruefung', async () => {
  const testData = erstelleTestDta({ claim20: true });
  const mock = erstelleSupabaseMock({ testData });
  const router = createZuzahlungsforderungRouter(erstelleMockDeps(mock));

  const clientProof = {
    art: 'belastungsgrenze62',
    referenz: 'BEFR-2026-KK-4421',
    gueltigAb: '2026-01-01',
    gueltigBis: '2026-12-31',
    bestaetigt: true,
  };

  const res = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId,
      grund: '1',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      nachweisPruefung: clientProof,
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.total_eur, 20.00);
  assert.equal(res.body.zuzahlung_total, 0);

  // Überprüfen, dass die Reservierung die angereicherten Server-Audit-Felder enthält
  const reservationCall = mock.state.insertCalls.find(c => c.table === 'abrechnung');
  assert.ok(reservationCall, 'Reservierung in abrechnung muss erfolgt sein');
  const savedProof = reservationCall.payload.zuzahlungsforderung_daten?.nachweisPruefung;
  assert.ok(savedProof, 'nachweisPruefung muss in zuzahlungsforderung_daten gespeichert werden');
  assert.equal(savedProof.art, 'belastungsgrenze62');
  assert.equal(savedProof.referenz, 'BEFR-2026-KK-4421');
  assert.equal(savedProof.gueltigAb, '2026-01-01');
  assert.equal(savedProof.gueltigBis, '2026-12-31');
  assert.equal(savedProof.prueferId, testData.ownerId);
  assert.equal(savedProof.patientId, testData.patientId);
  assert.equal(savedProof.kostentraegerIk, testData.sourceHeader.kostentraeger_ik);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(savedProof.geprueftAm));
  assert.ok(savedProof.geprueftZeitpunkt.endsWith('Z'));
  assert.equal(savedProof.bestaetigt, true);
});

test('20. Grund 5 (statuswechsel_jahreswechsel): Erfolgsfall mit expliziten Positionsindizes und Zusatzfeldern', async () => {
  const testData = erstelleTestDta({ claim20: true });
  const mock = erstelleSupabaseMock({ testData });
  const router = createZuzahlungsforderungRouter(erstelleMockDeps(mock));

  const clientProof = {
    art: 'statuswechsel_jahreswechsel',
    referenz: 'STATUSWECHSEL-2026-001',
    gueltigAb: '2025-01-01',
    gueltigBis: '2025-12-31',
    statusWechselDatum: '2026-01-01',
    zahlungsaufforderungReferenz: 'ZA-2026-W35-99',
    zahlungsaufforderungDatum: '2026-08-28',
    originalAbzugBestaetigt: true,
    bestaetigt: true,
  };

  const res = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId,
      grund: '5',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      positionIndices: [0],
      nachweisPruefung: clientProof,
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.total_eur, 20.00);

  const reservationCall = mock.state.insertCalls.find(c => c.table === 'abrechnung');
  assert.ok(reservationCall);
  const savedProof = reservationCall.payload.zuzahlungsforderung_daten?.nachweisPruefung;
  assert.ok(savedProof);
  assert.equal(savedProof.art, 'statuswechsel_jahreswechsel');
  assert.equal(savedProof.statusWechselDatum, '2026-01-01');
  assert.equal(savedProof.zahlungsaufforderungReferenz, 'ZA-2026-W35-99');
  assert.equal(savedProof.zahlungsaufforderungDatum, '2026-08-28');
  assert.equal(savedProof.originalAbzugBestaetigt, true);
  assert.equal(savedProof.prueferId, testData.ownerId);
  assert.equal(savedProof.patientId, testData.patientId);
  assert.equal(savedProof.kostentraegerIk, testData.sourceHeader.kostentraeger_ik);
});

test('21. Client-seitige Manipulationsversuche an Audit-Feldern werfen 422 UNEXPECTED_PROOF_KEYS', async () => {
  const testData = erstelleTestDta();
  const mock = erstelleSupabaseMock({ testData });
  const router = createZuzahlungsforderungRouter(erstelleMockDeps(mock));

  const forbiddenKeys = [
    { prueferId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    { patientId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' },
    { kostentraegerIk: '108310400' },
    { geprueftAm: '2026-09-01' },
    { geprueftZeitpunkt: '2026-09-01T12:00:00.000Z' },
  ];

  for (const extra of forbiddenKeys) {
    const res = await callPostRoute(router, {
      body: {
        zeileId: testData.zeileId,
        grund: '1',
        bestaetigt: true,
        nachweisDatum: '2026-09-01',
        nachweisPruefung: {
          art: 'belastungsgrenze62',
          referenz: 'REF-123',
          gueltigAb: '2026-01-01',
          gueltigBis: '2026-12-31',
          bestaetigt: true,
          ...extra,
        },
      },
    });

    assert.equal(res.status, 422, `Unerlaubter Schlüssel ${Object.keys(extra)[0]} muss 422 werfen`);
    assert.equal(res.body.code, 'UNEXPECTED_PROOF_KEYS');
  }
});

test('22. Validierungsfehler bei nachweisPruefung für Grund 1 (fehlend, falsche Art, Referenz, Datum, außerhalb Befreiung)', async () => {
  const testData = erstelleTestDta();
  const mock = erstelleSupabaseMock({ testData });
  const router = createZuzahlungsforderungRouter(erstelleMockDeps(mock));

  // a) nachweisPruefung fehlt komplett
  const resA = await callPostRoute(router, {
    body: { zeileId: testData.zeileId, grund: '1', bestaetigt: true, nachweisDatum: '2026-09-01' },
  });
  assert.equal(resA.status, 422);
  assert.equal(resA.body.code, 'EXEMPTION_EVIDENCE_UNVERIFIED');

  // b) Falsche Nachweisart
  const resB = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId, grund: '1', bestaetigt: true, nachweisDatum: '2026-09-01',
      nachweisPruefung: { art: 'falsche_art', referenz: 'REF-1', gueltigAb: '2026-01-01', gueltigBis: '2026-12-31', bestaetigt: true },
    },
  });
  assert.equal(resB.status, 422);
  assert.equal(resB.body.code, 'INVALID_PROOF_ART');

  // c) Leere Referenz
  const resC = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId, grund: '1', bestaetigt: true, nachweisDatum: '2026-09-01',
      nachweisPruefung: { art: 'belastungsgrenze62', referenz: '   ', gueltigAb: '2026-01-01', gueltigBis: '2026-12-31', bestaetigt: true },
    },
  });
  assert.equal(resC.status, 422);
  assert.equal(resC.body.code, 'INVALID_PROOF_REFERENCE');

  // d) gueltigAb > gueltigBis
  const resD = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId, grund: '1', bestaetigt: true, nachweisDatum: '2026-09-01',
      nachweisPruefung: { art: 'belastungsgrenze62', referenz: 'REF-1', gueltigAb: '2026-12-31', gueltigBis: '2026-01-01', bestaetigt: true },
    },
  });
  assert.equal(resD.status, 422);
  assert.equal(resD.body.code, 'INVALID_PROOF_PERIOD');

  // e) Ungültiges Kalenderdatum (Februar 31)
  const resE = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId, grund: '1', bestaetigt: true, nachweisDatum: '2026-09-01',
      nachweisPruefung: { art: 'belastungsgrenze62', referenz: 'REF-1', gueltigAb: '2026-02-31', gueltigBis: '2026-12-31', bestaetigt: true },
    },
  });
  assert.equal(resE.status, 422);
  assert.equal(resE.body.code, 'INVALID_PROOF_PERIOD');

  // f) Behandlungsdatum (2026-08-28) liegt außerhalb des Befreiungszeitraums (2026-01-01 bis 2026-06-30)
  const resF = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId, grund: '1', bestaetigt: true, nachweisDatum: '2026-09-01',
      nachweisPruefung: { art: 'belastungsgrenze62', referenz: 'REF-1', gueltigAb: '2026-01-01', gueltigBis: '2026-06-30', bestaetigt: true },
    },
  });
  assert.equal(resF.status, 422);
  assert.equal(resF.body.code, 'EXEMPTION_EVIDENCE_UNVERIFIED');
});

test('23. Validierungsfehler bei nachweisPruefung für Grund 5 (statusWechsel, Zahlungsaufforderung, Abzug, Indizes)', async () => {
  const testData = erstelleTestDta();
  const mock = erstelleSupabaseMock({ testData });
  const router = createZuzahlungsforderungRouter(erstelleMockDeps(mock));

  const validProof5 = {
    art: 'statuswechsel_jahreswechsel',
    referenz: 'STATUS-1',
    gueltigAb: '2025-01-01',
    gueltigBis: '2025-12-31',
    statusWechselDatum: '2026-01-01',
    zahlungsaufforderungReferenz: 'ZA-1',
    zahlungsaufforderungDatum: '2026-08-28',
    originalAbzugBestaetigt: true,
    bestaetigt: true,
  };

  // a) statusWechselDatum <= gueltigBis
  const resA = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId, grund: '5', bestaetigt: true, nachweisDatum: '2026-09-01', positionIndices: [0],
      nachweisPruefung: { ...validProof5, statusWechselDatum: '2025-12-31' },
    },
  });
  assert.equal(resA.status, 422);
  assert.equal(resA.body.code, 'YEAR_TRANSITION_EVIDENCE_UNVERIFIED');

  // b) zahlungsaufforderungDatum < statusWechselDatum
  const resB = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId, grund: '5', bestaetigt: true, nachweisDatum: '2026-09-01', positionIndices: [0],
      nachweisPruefung: { ...validProof5, zahlungsaufforderungDatum: '2025-12-15' },
    },
  });
  assert.equal(resB.status, 422);
  assert.equal(resB.body.code, 'YEAR_TRANSITION_EVIDENCE_UNVERIFIED');

  // c) zahlungsaufforderungDatum in der Zukunft
  const resC = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId, grund: '5', bestaetigt: true, nachweisDatum: '2026-09-01', positionIndices: [0],
      nachweisPruefung: { ...validProof5, zahlungsaufforderungDatum: '2099-01-01' },
    },
  });
  assert.equal(resC.status, 422);
  assert.equal(resC.body.code, 'YEAR_TRANSITION_EVIDENCE_UNVERIFIED');

  // d) originalAbzugBestaetigt nicht true
  const resD = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId, grund: '5', bestaetigt: true, nachweisDatum: '2026-09-01', positionIndices: [0],
      nachweisPruefung: { ...validProof5, originalAbzugBestaetigt: false },
    },
  });
  assert.equal(resD.status, 422);
  assert.equal(resD.body.code, 'YEAR_TRANSITION_EVIDENCE_UNVERIFIED');

  // e) Fehlende positionIndices bei Grund 5
  const resE = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId, grund: '5', bestaetigt: true, nachweisDatum: '2026-09-01',
      nachweisPruefung: validProof5,
    },
  });
  assert.equal(resE.status, 422);
  assert.equal(resE.body.code, 'POSITION_INDICES_REQUIRED');
});

test('24. Replay mit Zeitverschiebung behält ursprüngliche Server-Audit-Felder bei (Idempotenz 200)', async () => {
  const testData = erstelleTestDta({ claim20: true });

  const originalGeprueftAm = '2026-09-01';
  const originalGeprueftZeitpunkt = '2026-09-01T10:00:00.000Z';

  const existingClaimRow = {
    id: 'completed-claim-1',
    owner_id: testData.ownerId,
    status: 'erstellt',
    storage_path: 'path/to/dta',
    dta_sha256: 'hash-val',
    begleitzettel_path: 'path/to/begleit',
    auftragsdatei_path: 'path/to/auftrag',
    auftragsdatei_size: 123,
    auftragsdatei_sha256: 'auftrag-hash',
    datenaustauschreferenz: 101,
    transfernummer: 1,
    rechnungsnummer: 'R2026-W35-999',
    verarbeitungskennzeichen: '03',
    total_eur: 20.00,
    zuzahlung_total: 0,
    zuzahlungsforderung_daten: {
      grund: '1',
      nachweisDatum: '2026-09-01',
      positionIndices: [0],
      bestaetigt: true,
      nachweisPruefung: {
        art: 'belastungsgrenze62',
        referenz: 'BEFR-ORIGINAL-99',
        gueltigAb: '2026-01-01',
        gueltigBis: '2026-12-31',
        geprueftAm: originalGeprueftAm,
        geprueftZeitpunkt: originalGeprueftZeitpunkt,
        prueferId: testData.ownerId,
        patientId: testData.patientId,
        kostentraegerIk: testData.sourceHeader.kostentraeger_ik,
        bestaetigt: true,
      },
    },
  };

  const existingSnapshotLine = {
    ...testData.sourceZeile,
    leistungen: testData.historicalSessions,
    id: 'line-snap-1',
    abrechnung_id: existingClaimRow.id,
    prescription_id: testData.rxId,
    brutto_eur: 20.00,
    netto_eur: 20.00,
    zuzahlung_eur: 0,
    status: 'eingereicht',
  };

  const mock = erstelleSupabaseMock({
    testData,
    insertReservationError: { code: '23505', message: 'duplicate key' },
    existingClaimRow,
    existingSnapshotLine,
  });
  const router = createZuzahlungsforderungRouter(erstelleMockDeps(mock));

  // Client sendet denselben Nachweis später erneut (Serverzeit wäre heute)
  const res = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId,
      grund: '1',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      nachweisPruefung: {
        art: 'belastungsgrenze62',
        referenz: 'BEFR-ORIGINAL-99',
        gueltigAb: '2026-01-01',
        gueltigBis: '2026-12-31',
        bestaetigt: true,
      },
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.idempotent, true);
  assert.equal(res.body.abrechnungId, existingClaimRow.id);
  assert.equal(res.body.rechnungsnummer, existingClaimRow.rechnungsnummer);
});

test('25. Replay mit abweichender Referenz oder Zeitraum in nachweisPruefung wirft 409 FROZEN_INTENT_MISMATCH', async () => {
  const testData = erstelleTestDta({ claim20: true });

  const existingClaimRow = {
    id: 'completed-claim-1',
    owner_id: testData.ownerId,
    status: 'erstellt',
    storage_path: 'path/to/dta',
    dta_sha256: 'hash-val',
    begleitzettel_path: 'path/to/begleit',
    auftragsdatei_path: 'path/to/auftrag',
    auftragsdatei_size: 123,
    auftragsdatei_sha256: 'auftrag-hash',
    datenaustauschreferenz: 101,
    transfernummer: 1,
    rechnungsnummer: 'R2026-W35-999',
    verarbeitungskennzeichen: '03',
    total_eur: 20.00,
    zuzahlung_total: 0,
    zuzahlungsforderung_daten: {
      grund: '1',
      nachweisDatum: '2026-09-01',
      positionIndices: [0],
      bestaetigt: true,
      nachweisPruefung: {
        art: 'belastungsgrenze62',
        referenz: 'BEFR-ORIGINAL-99',
        gueltigAb: '2026-01-01',
        gueltigBis: '2026-12-31',
        geprueftAm: '2026-09-01',
        geprueftZeitpunkt: '2026-09-01T10:00:00.000Z',
        prueferId: testData.ownerId,
        patientId: testData.patientId,
        kostentraegerIk: testData.sourceHeader.kostentraeger_ik,
        bestaetigt: true,
      },
    },
  };

  const mock = erstelleSupabaseMock({
    testData,
    insertReservationError: { code: '23505', message: 'duplicate key' },
    existingClaimRow,
  });
  const router = createZuzahlungsforderungRouter(erstelleMockDeps(mock));

  // a) Abweichende Referenz
  const resA = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId,
      grund: '1',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      nachweisPruefung: {
        art: 'belastungsgrenze62',
        referenz: 'BEFR-GEAENDERT-99',
        gueltigAb: '2026-01-01',
        gueltigBis: '2026-12-31',
        bestaetigt: true,
      },
    },
  });
  assert.equal(resA.status, 409);
  assert.equal(resA.body.code, 'FROZEN_INTENT_MISMATCH');

  // b) Abweichender Gültigkeitszeitraum
  const resB = await callPostRoute(router, {
    body: {
      zeileId: testData.zeileId,
      grund: '1',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      nachweisPruefung: {
        art: 'belastungsgrenze62',
        referenz: 'BEFR-ORIGINAL-99',
        gueltigAb: '2026-02-01',
        gueltigBis: '2026-12-31',
        bestaetigt: true,
      },
    },
  });
  assert.equal(resB.status, 409);
  assert.equal(resB.body.code, 'FROZEN_INTENT_MISMATCH');
});

test('26. Nachweisdokument Validierungen: Nicht gefunden, falscher Patient, falsche Betriebsstätte', async () => {
  const testData = erstelleTestDta();

  // a) Dokument nicht gefunden
  const mockA = erstelleSupabaseMock({ testData, docRowOverride: null });
  const resA = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mockA)), {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
      nachweisDokumentId: '99999',
    },
  });
  assert.equal(resA.status, 422);
  assert.equal(resA.body.code, 'DOCUMENT_NOT_FOUND');

  // b) Dokument anderer Patient
  const mockB = erstelleSupabaseMock({
    testData,
    docRowOverride: {
      id: '10001',
      owner_id: testData.ownerId,
      prescription_id: testData.rxId,
      patient_id: '99999999-9999-9999-9999-999999999999',
      business_id: testData.sourceZeile.business_id,
    },
  });
  const resB = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mockB)), {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
      nachweisDokumentId: '10001',
    },
  });
  assert.equal(resB.status, 422);
  assert.equal(resB.body.code, 'DOCUMENT_PATIENT_MISMATCH');

  // c) Dokument andere Betriebsstätte
  const mockC = erstelleSupabaseMock({
    testData,
    docRowOverride: {
      id: '10001',
      owner_id: testData.ownerId,
      prescription_id: testData.rxId,
      patient_id: testData.patientId,
      business_id: '88888888-8888-8888-8888-888888888888',
    },
  });
  const resC = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mockC)), {
    body: {
      zeileId: testData.zeileId,
      grund: '2',
      bestaetigt: true,
      nachweisDatum: '2026-09-01',
      mahnungId: testData.mahnungId,
      nachweisPruefung: validProof2,
      nachweisDokumentId: '10001',
    },
  });
  assert.equal(resC.status, 422);
  assert.equal(resC.body.code, 'DOCUMENT_BUSINESS_MISMATCH');
});



function completedClaimFixture(testData) {
  const existingClaimRow = {
    id: '77777777-7777-7777-7777-777777777777', owner_id: testData.ownerId,
    status: 'erstellt', verarbeitungskennzeichen: '03', storage_path: 'saved/original.dta',
    dta_sha256: 'a'.repeat(64), begleitzettel_path: 'saved/begleit.html',
    auftragsdatei_path: 'saved/original.auf', auftragsdatei_size: 348, auftragsdatei_sha256: 'b'.repeat(64),
    datenaustauschreferenz: 24, transfernummer: 24, rechnungsnummer: 'R2026-W36-001',
    total_eur: testData.sourceZeile.zuzahlung_eur, zuzahlung_total: 0,
    zuzahlungsforderung_daten: { grund: '2', nachweisDatum: '2026-09-01', positionIndices: [0],
      bestaetigt: true, mahnungId: testData.mahnungId, nachweisPruefung: auditedProof2(testData) },
  };
  const existingSnapshotLine = {
    ...testData.sourceZeile, id: '88888888-8888-8888-8888-888888888888',
    abrechnung_id: existingClaimRow.id, leistungen: testData.historicalSessions,
    brutto_eur: testData.sourceZeile.zuzahlung_eur, netto_eur: testData.sourceZeile.zuzahlung_eur,
    zuzahlung_eur: 0, status: 'eingereicht',
  };
  return { existingClaimRow, existingSnapshotLine };
}
function claimRequest(testData, overrides = {}) {
  return { zeileId: testData.zeileId, grund: '2', bestaetigt: true, nachweisDatum: '2026-09-01',
    mahnungId: testData.mahnungId, nachweisPruefung: validProof2, ...overrides };
}

test('27. Vollständiger eingefrorener Snapshot: kein Builder, Upload, Nummernaufruf oder Update; JSONB-Schlüsselreihenfolge egal', async () => {
  const testData = erstelleTestDta();
  const saved = completedClaimFixture(testData);
  saved.existingSnapshotLine.leistungen = testData.historicalSessions.map(s => Object.fromEntries(Object.entries(s).reverse()));
  const mock = erstelleSupabaseMock({ testData, ...saved });
  const deps = erstelleMockDeps(mock);
  for (const key of ['buildDtaFile', 'vergebeNummern', 'speichereAuftragsdatei', 'baueBegleitzettel']) {
    deps[key] = () => { assert.fail(`${key} darf unveränderlichen Snapshot nicht neu bauen`); };
  }
  const res = await callPostRoute(createZuzahlungsforderungRouter(deps), { body: claimRequest(testData) });
  assert.equal(res.status, 200);
  assert.equal(res.body.storage_path, saved.existingClaimRow.storage_path);
  assert.equal(mock.state.storageUploads.length, 0);
  assert.equal(mock.state.insertCalls.length, 0);
  assert.equal(mock.state.updateCalls.length, 0);
});

test('28. Jede historische Snapshot-Abweichung wird abgewiesen; keine Änderungen oder Nummern', async () => {
  const testData = erstelleTestDta();
  const mutations = [
    { owner_id: '99999999-9999-9999-9999-999999999999' }, { business_id: null },
    { prescription_id: '99999999-9999-9999-9999-999999999999' }, { kostentraeger_ik: '123456789' },
    { karten_ik: '123456789' }, { belegnummer: 'OTHER' }, { versichertennummer: 'A999999999' },
    { verordnungsdatum: '2026-08-21' }, { patient_name: 'Anderer Patient' },
    { leistungen: [{ ...testData.historicalSessions[0], einzelbetrag: 1 }] },
    { brutto_eur: 12.90 }, { netto_eur: 12.90 }, { zuzahlung_eur: 0.01 },
  ];
  for (const mutation of mutations) {
    const saved = completedClaimFixture(testData);
    Object.assign(saved.existingSnapshotLine, mutation);
    const mock = erstelleSupabaseMock({ testData, ...saved });
    const res = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mock)), { body: claimRequest(testData) });
    assert.equal(res.status, 409, JSON.stringify(mutation));
    assert.equal(res.body.code, 'FROZEN_INTENT_MISMATCH');
    assert.equal(mock.state.storageUploads.length + mock.state.updateCalls.length + mock.state.insertCalls.length, 0);
  }
});

test('29. Snapshot ohne vollständige Artefakte oder konsistente Kopfbeträge bleibt unverändert mit 409', async () => {
  const testData = erstelleTestDta();
  for (const mutation of [{ storage_path: null }, { auftragsdatei_sha256: null }, { total_eur: 12.90 }, { zuzahlung_total: 0.01 }]) {
    const saved = completedClaimFixture(testData);
    Object.assign(saved.existingClaimRow, mutation);
    const mock = erstelleSupabaseMock({ testData, ...saved });
    const res = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mock)), { body: claimRequest(testData) });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'MISSING_ARTIFACTS_AFTER_SNAPSHOT');
    assert.equal(mock.state.storageUploads.length + mock.state.updateCalls.length, 0);
  }
});

test('30. Aktive unvollständige Reservierung auch mit gespeicherten Artefakten: niemals erstellt→erstellt-CAS', async () => {
  const testData = erstelleTestDta();
  const saved = completedClaimFixture(testData);
  const mock = erstelleSupabaseMock({ testData, existingClaimRow: saved.existingClaimRow });
  const res = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mock)), { body: claimRequest(testData) });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'CLAIM_IN_PROGRESS');
  assert.equal(mock.state.updateCalls.length + mock.state.storageUploads.length, 0);
});

test('31. Verworfene Reservierung ohne Snapshot: alle Artefakte neu bauen, gespeicherte Nummern behalten, keine alten Hashes mischen', async () => {
  const testData = erstelleTestDta();
  const saved = completedClaimFixture(testData);
  saved.existingClaimRow.status = 'verworfen';
  const mock = erstelleSupabaseMock({ testData, existingClaimRow: saved.existingClaimRow });
  const deps = erstelleMockDeps(mock);
  deps.vergebeNummern = () => assert.fail('Wiederaufnahme darf keine weitere Nummer verbrauchen');
  const res = await callPostRoute(createZuzahlungsforderungRouter(deps), { body: claimRequest(testData) });
  assert.equal(res.status, 200);
  assert.equal(mock.state.updateFilters[0].status, 'verworfen');
  assert.equal(mock.state.storageUploads.length, 2);
  const header = mock.state.updateCalls.find(c => c.payload.storage_path).payload;
  assert.notEqual(header.dta_sha256, saved.existingClaimRow.dta_sha256);
  assert.notEqual(header.storage_path, saved.existingClaimRow.storage_path);
  assert.equal(header.auftragsdatei_sha256, 'auf-sha256-test');
  assert.deepEqual(mock.state.updateCalls[0].payload.zuzahlungsforderung_daten.nachweisPruefung, auditedProof2(testData));
});

test('32. Gespeichertes Audit wird vor Parser validiert; falscher Patient oder ungültiger Timestamp verhindert Replay ohne Mutation', async () => {
  const testData = erstelleTestDta();
  for (const mutation of [{ patientId: '99999999-9999-9999-9999-999999999999' }, { geprueftZeitpunkt: '2026-02-31T08:00:00Z' }]) {
    const saved = completedClaimFixture(testData);
    Object.assign(saved.existingClaimRow.zuzahlungsforderung_daten.nachweisPruefung, mutation);
    const mock = erstelleSupabaseMock({ testData, ...saved });
    const res = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mock)), { body: claimRequest(testData) });
    assert.equal(res.status, 422);
    assert.equal(mock.state.updateCalls.length + mock.state.storageUploads.length + mock.state.insertCalls.length, 0);
  }
});

test('33. KZ2-Replay vergleicht alle menschlichen Nachweisfelder', async () => {
  const testData = erstelleTestDta();
  const saved = completedClaimFixture(testData);
  const mock = erstelleSupabaseMock({ testData, ...saved });
  const res = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mock)), {
    body: claimRequest(testData, { nachweisPruefung: { ...validProof2, versandArt: 'elektronisch' } }),
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'FROZEN_INTENT_MISMATCH');
  assert.equal(mock.state.updateCalls.length + mock.state.storageUploads.length, 0);
});

test('34. KZ2 echte Mahnungsdaten: sent_at kein Versandbeweis; Patient und verstrichene Frist zwingend', async () => {
  const testData = erstelleTestDta();
  const notice = { id: testData.mahnungId, owner_id: testData.ownerId, prescription_id: testData.rxId,
    patient_id: testData.patientId, status: 'offen', ausfallrechnung_id: null, sent_at: null, neue_faelligkeit: '2026-09-15' };
  const good = erstelleSupabaseMock({ testData, mahnungOverride: notice });
  const res = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(good)), { body: claimRequest(testData) });
  assert.equal(res.status, 200);
  for (const mutation of [{ patient_id: null }, { neue_faelligkeit: null }, { neue_faelligkeit: '2026-02-31' }, { neue_faelligkeit: '2099-12-31' }, { neue_faelligkeit: '2026-08-31' }, { status: 'abgeschrieben' }]) {
    const mock = erstelleSupabaseMock({ testData, mahnungOverride: { ...notice, ...mutation } });
    const bad = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mock)), { body: claimRequest(testData) });
    assert.equal(bad.status, 422, JSON.stringify(mutation));
    assert.equal(mock.state.insertCalls.length, 0);
  }
});

test('35. Dokument in Betriebsstätte bei Ursprung ohne Betriebsstätte wird abgewiesen', async () => {
  const testData = erstelleTestDta();
  const mock = erstelleSupabaseMock({ testData, sourceZeileOverride: { ...testData.sourceZeile, business_id: null },
    sourceHeaderOverride: { ...testData.sourceHeader, business_id: null },
    docRowOverride: { id: '1', owner_id: testData.ownerId, prescription_id: testData.rxId,
      patient_id: testData.patientId, business_id: 'b1111111-1111-1111-1111-111111111111' } });
  const res = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mock)), { body: claimRequest(testData, { nachweisDokumentId: '1' }) });
  assert.equal(res.status, 422);
  assert.equal(res.body.code, 'DOCUMENT_BUSINESS_MISMATCH');
  assert.equal(mock.state.insertCalls.length, 0);
});

test('36. Echte akzeptierte Ursprungszeile erforderlich; englische Kopfstatus ersetzen Zeilenstatus nicht', async () => {
  const testData = erstelleTestDta();
  for (const status of ['accepted', 'paid', 'eingereicht', 'abgesetzt', 'teilabgesetzt', 'nachgereicht']) {
    const mock = erstelleSupabaseMock({ testData, sourceZeileOverride: { ...testData.sourceZeile, status } });
    const res = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mock)), { body: claimRequest(testData) });
    assert.equal(res.status, 422, status);
    assert.equal(mock.state.insertCalls.length, 0);
  }
});


test('37. Vollständiger Snapshot bleibt idempotent, wenn Mahnung später bezahlt und Originalzahlung gestempelt wird', async () => {
  const testData = erstelleTestDta();
  const saved = completedClaimFixture(testData);
  const mock = erstelleSupabaseMock({ testData, ...saved,
    mahnungOverride: { id: testData.mahnungId, status: 'bezahlt' },
    belegRows: [{ prescription_id: testData.rxId, amount_eur: 12.89, type: 'zuzahlung' }],
    rxRowOverride: { id: testData.rxId, patient_id: testData.patientId, zuzahlung_kassiert_am: '2026-09-20', zuzahlung_eur: 12.89 },
  });
  const res = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mock)), { body: claimRequest(testData) });
  assert.equal(res.status, 200);
  assert.equal(res.body.idempotent, true);
  assert.equal(mock.state.insertCalls.length + mock.state.updateCalls.length + mock.state.storageUploads.length, 0);
});

test('38. Optionale Dokument-ID verlangt positiven Bigint-String; Zahlen, Null und leere Werte niemals still ignorieren', async () => {
  const testData = erstelleTestDta();
  for (const value of [1, 0, null, '', '0']) {
    const mock = erstelleSupabaseMock({ testData });
    const res = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mock)), { body: claimRequest(testData, { nachweisDokumentId: value }) });
    assert.equal(res.status, 422);
    assert.equal(res.body.code, 'INVALID_DOCUMENT_ID');
    assert.equal(mock.state.insertCalls.length, 0);
  }
});

test('39. Ein Cent Builder-Abweichung darf keine Forderung oder Artefakte veröffentlichen', async () => {
  const testData = erstelleTestDta();
  const mock = erstelleSupabaseMock({ testData });
  const deps = erstelleMockDeps(mock);
  const originalBuilder = deps.buildDtaFile;
  deps.buildDtaFile = args => {
    const dta = originalBuilder(args);
    return { ...dta, totals: { ...dta.totals, netto: Number(dta.totals.netto) + 0.01 } };
  };
  const res = await callPostRoute(createZuzahlungsforderungRouter(deps), { body: claimRequest(testData) });
  assert.equal(res.status, 422);
  assert.equal(res.body.code, 'CLAIM_AMOUNT_MISMATCH');
  assert.equal(mock.state.storageUploads.length, 0);
  assert.equal(mock.state.insertCalls.filter(c => c.table === 'abrechnung_zeile').length, 0);
  assert.equal(mock.state.updateCalls.at(-1).payload.status, 'verworfen');
});

test('40. VKZ03 verwendet kryptografisch geprüfte eingebettete Originaldaten ohne unsigned Datei', async () => {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2020-01-01T00:00:00Z');
  cert.validity.notAfter = new Date('2040-01-01T00:00:00Z');
  const attrs = [{ name: 'commonName', value: 'Synthetic signer' }];
  cert.setSubject(attrs); cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const baseData = erstelleTestDta({ claim20: true });
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(baseData.buf.toString('binary'));
  p7.addCertificate(cert);
  p7.addSigner({
    key: keys.privateKey, certificate: cert, digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
    ],
  });
  p7.sign({ detached: false });
  const signedDERBuffer = Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary');

  const expectedSignedPath = `${baseData.ownerId}/synthetic/source.p7m`;
  const makeTestData = (override = {}) => {
    const td = structuredClone(baseData);
    td.buf = Buffer.from(baseData.buf);
    td.sourceHeader.storage_path = null;
    td.sourceHeader.signed_storage_path = expectedSignedPath;
    td.sourceHeader.signed_sha256 = sha256Hex(signedDERBuffer);
    Object.assign(td.sourceHeader, override);
    return td;
  };

  const setupMock = (td, derBytes) => {
    const mock = erstelleSupabaseMock({ testData: td });
    const originalFrom = mock.client.storage.from.bind(mock.client.storage);
    mock.client.storage.from = (bucket) => {
      const api = originalFrom(bucket);
      return {
        ...api,
        async download(path) {
          mock.state.downloads.push(path);
          if (path !== expectedSignedPath) throw new Error(`Unexpected download path: ${path}`);
          return { data: new Blob([derBytes]), error: null };
        },
      };
    };
    return mock;
  };

  const reqBody = {
    zeileId: baseData.zeileId, grund: '2', bestaetigt: true, nachweisDatum: '2026-09-01',
    mahnungId: baseData.mahnungId, nachweisPruefung: validProof2,
  };

  // Fall 1: Gültige Signatur ohne unsigned Datei -> 200
  const td1 = makeTestData();
  const mock1 = setupMock(td1, signedDERBuffer);
  const res1 = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mock1)), { body: reqBody });
  assert.equal(res1.status, 200);
  assert.equal(res1.body.ok, true);
  assert.equal(res1.body.total_eur, 20.00);
  assert.equal(res1.body.zuzahlung_total, 0);
  assert.deepEqual(mock1.state.downloads, [expectedSignedPath]);
  const reservierung = mock1.state.insertCalls.find((i) => i.table === 'abrechnung');
  assert.ok(reservierung, 'abrechnung-Reservierung muss erfolgen');
  const zeilenInsert = mock1.state.insertCalls.find((i) => i.table === 'abrechnung_zeile');
  assert.ok(zeilenInsert, 'abrechnung_zeile muss eingefügt werden');
  assert.equal(zeilenInsert.payload.brutto_eur, 20.00);
  assert.equal(zeilenInsert.payload.netto_eur, 20.00);
  assert.equal(zeilenInsert.payload.zuzahlung_eur, 0);
  assert.ok(mock1.state.updateFilters.every((filter) => filter.id !== td1.sourceHeader.id), 'Ursprungskopf darf nicht aktualisiert werden');
  assert.equal(td1.sourceHeader.storage_path, null);

  // Fall 2: Signatur manipuliert (letztes Byte) + signed_sha256 angepasst -> 422
  const tamperedDER = Buffer.from(signedDERBuffer);
  tamperedDER[tamperedDER.length - 1] ^= 0xff;
  const td2 = makeTestData({ signed_sha256: sha256Hex(tamperedDER) });
  const mock2 = setupMock(td2, tamperedDER);
  const res2 = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mock2)), { body: reqBody });
  assert.equal(res2.status, 422);
  assert.equal(mock2.state.insertCalls.length, 0);
  assert.equal(mock2.state.updateCalls.length, 0);
  assert.equal(mock2.state.storageUploads.length, 0);

  // Fall 3: Gültiges DER aber signed_sha256 stimmt nicht -> 409
  const td3 = makeTestData({ signed_sha256: sha256Hex(Buffer.from('mismatch')) });
  const mock3 = setupMock(td3, signedDERBuffer);
  const res3 = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mock3)), { body: reqBody });
  assert.equal(res3.status, 409);
  assert.equal(mock3.state.insertCalls.length, 0);
  assert.equal(mock3.state.updateCalls.length, 0);
  assert.equal(mock3.state.storageUploads.length, 0);
});


test('41 Fehlgeschlagener Auftrag löscht nur DTA nach Status-Verwerfung und behält Nummern', async () => {
  const testData = erstelleTestDta();
  const mock = erstelleSupabaseMock({ testData });
  const deps = erstelleMockDeps(mock, { speichereAuftragError: new Error('Auftrag fehlgeschlagen') });
  const res = await callPostRoute(createZuzahlungsforderungRouter(deps), { body: claimRequest(testData) });
  assert.strictEqual(res.status, 500);
  const updateIdx = mock.state.events.findIndex(e => e.type === 'update' && e.payload?.status === 'verworfen');
  const removeIdx = mock.state.events.findIndex(e => e.type === 'storage_remove');
  assert.ok(updateIdx !== -1 && removeIdx !== -1 && updateIdx < removeIdx);
  assert.deepStrictEqual(mock.state.storageRemovals.flat(), [mock.state.storageUploads[0].path]);
  assert.strictEqual(mock.state.currentClaim.status, 'verworfen');
  assert.strictEqual(mock.state.currentClaim.datenaustauschreferenz, 25);
  assert.ok(mock.state.currentClaim.id);
});

test('42 Begleitzettel-Fehler entfernt nur eigene Versuchs-Dateien mit upsert false', async () => {
  const testData = erstelleTestDta();
  const mock = erstelleSupabaseMock({ testData, uploadBegleitError: new Error('Begleit fehlgeschlagen') });
  const deps = erstelleMockDeps(mock);
  const origSave = deps.speichereAuftragsdatei;
  deps.speichereAuftragsdatei = async (args) => {
    assert.strictEqual(args.upsert, false);
    return origSave(args);
  };
  const res = await callPostRoute(createZuzahlungsforderungRouter(deps), { body: claimRequest(testData) });
  assert.strictEqual(res.status, 500);
  const removed = mock.state.storageRemovals.flat();
  assert.strictEqual(removed.length, 2);
  assert.ok(removed.every(p => p.includes('/versuche/') && !p.includes('signed') && !p.includes('saved')));
  assert.ok(mock.state.storageUploads.every(u => u.opts?.upsert === false));
  assert.strictEqual(mock.state.currentClaim.status, 'verworfen');
});

test('43 Nummern-CAS 500 Retry erfolgreich mit Beibehaltung, bei Dauerfehler erstellt', async () => {
  const testData = erstelleTestDta();
  let numCalls = 0;
  const mockA = erstelleSupabaseMock({
    testData,
    uploadDtaError: new Error('DTA Abbruch'),
    beforeUpdate: async ({ payload }) => {
      if (payload.datenaustauschreferenz !== undefined && !payload.storage_path && payload.status === undefined) {
        if (numCalls++ === 0) return { error: { code: '500', message: 'synthetic' } };
      }
    }
  });
  const resA = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mockA)), { body: claimRequest(testData) });
  assert.strictEqual(resA.status, 500);
  assert.ok(numCalls >= 2);
  assert.strictEqual(mockA.state.currentClaim.datenaustauschreferenz, 25);
  assert.strictEqual(mockA.state.currentClaim.status, 'verworfen');
  assert.strictEqual(mockA.state.storageRemovals.length, 0);

  const testDataB = erstelleTestDta();
  const mockB = erstelleSupabaseMock({
    testData: testDataB,
    beforeUpdate: async ({ payload }) => {
      if (payload.datenaustauschreferenz !== undefined && !payload.storage_path && payload.status === undefined) {
        return { error: { code: '500', message: 'synthetic' } };
      }
    }
  });
  const resB = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mockB)), { body: claimRequest(testDataB) });
  assert.strictEqual(resB.status, 500);
  assert.strictEqual(mockB.state.currentClaim.status, 'erstellt');
  assert.strictEqual(mockB.state.storageRemovals.length, 0);
});

test('44 Finaler Publish-CAS Race 409 behält accepted Status ohne Löschung', async () => {
  const testData = erstelleTestDta();
  const mock = erstelleSupabaseMock({
    testData,
    beforeUpdate: async ({ payload, state }) => {
      if (payload.storage_path) {
        state.currentClaim.status = 'accepted';
        state.currentClaim.updated_at = new Date(Date.now() + 5000).toISOString();
      }
    }
  });
  const res = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mock)), { body: claimRequest(testData) });
  assert.strictEqual(res.status, 409);
  assert.strictEqual(mock.state.currentClaim.status, 'accepted');
  assert.ok(mock.state.storageUploads.length > 0);
  assert.ok(mock.state.storageUploads.every(u => u.opts?.upsert === false));
  assert.strictEqual(mock.state.storageRemovals.length, 0);
});

test('45 Zeileninsert-Fehler nach Publish verwirft ohne Löschung, Race behält accepted', async () => {
  const testData = erstelleTestDta();
  const mockA = erstelleSupabaseMock({ testData, lineInsertError: new Error('Zeilenfehler') });
  const resA = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mockA)), { body: claimRequest(testData) });
  assert.strictEqual(resA.status, 500);
  assert.strictEqual(mockA.state.currentClaim.status, 'verworfen');
  assert.ok(mockA.state.storageUploads.length >= 2);
  assert.strictEqual(mockA.state.storageRemovals.length, 0);

  const testDataB = erstelleTestDta();
  const mockB = erstelleSupabaseMock({
    testData: testDataB,
    lineInsertError: new Error('Zeilenfehler'),
    beforeUpdate: async ({ payload, state }) => {
      if (payload.status === 'verworfen') {
        state.currentClaim.status = 'accepted';
        state.currentClaim.updated_at = new Date(Date.now() + 5000).toISOString();
      }
    }
  });
  const resB = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mockB)), { body: claimRequest(testDataB) });
  assert.strictEqual(resB.status, 500);
  assert.strictEqual(mockB.state.currentClaim.status, 'accepted');
  assert.strictEqual(mockB.state.storageRemovals.length, 0);
});

test('46 Resume-Marker blockieren Wiederaufnahme mit 409 ohne Storage-Aktionen', async () => {
  const testData = erstelleTestDta();
  const markerCases = [
    { signed_storage_path: 's/a.dta', signed_sha256: 'c'.repeat(64), signed_at: '2026-09-01T10:00:00Z' },
    { encrypted_storage_path: 'e/a.enc', encrypted_sha256: 'd'.repeat(64), verschluesselt_am: '2026-09-01T10:00:00Z' },
    { zaa_uploaded_at: '2026-09-01T10:00:00Z' },
    { paid_at: '2026-09-01T10:00:00Z' }
  ];
  for (const markers of markerCases) {
    const { existingClaimRow } = completedClaimFixture(testData);
    existingClaimRow.status = 'verworfen';
    Object.assign(existingClaimRow, markers);
    const mock = erstelleSupabaseMock({ testData, existingClaimRow });
    const res = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mock)), { body: claimRequest(testData) });
    assert.strictEqual(res.status, 409);
    assert.strictEqual(mock.state.storageUploads.length, 0);
    assert.strictEqual(mock.state.storageRemovals.length, 0);
  }
});

test('47 Wiederaufnahme verworfener Forderung behält Altdaten, nutzt neue Pfade und Nummer 24', async () => {
  const testData = erstelleTestDta();
  const { existingClaimRow } = completedClaimFixture(testData);
  existingClaimRow.status = 'verworfen';
  const mock = erstelleSupabaseMock({ testData, existingClaimRow });
  const deps = erstelleMockDeps(mock);
  deps.vergebeNummern = () => assert.fail('Keine Neuvergabe bei Wiederaufnahme');
  const res = await callPostRoute(createZuzahlungsforderungRouter(deps), { body: claimRequest(testData) });
  assert.ok(res.status === 200 || res.status === 201);
  const removed = mock.state.storageRemovals.flat();
  assert.ok(!removed.includes(existingClaimRow.storage_path));
  assert.ok(!removed.includes(existingClaimRow.auftragsdatei_path));
  assert.ok(mock.state.storageUploads.length > 0);
  assert.ok(mock.state.storageUploads[0].path.includes('/versuche/'));
  assert.strictEqual(mock.state.currentClaim.datenaustauschreferenz, 24);
});

test('48 Fehlende Normalisierung bei Neuanlage bricht vor Storage mit Fehler 500 ab', async () => {
  const testData = erstelleTestDta();
  const mock = erstelleSupabaseMock({ testData, normalizeSnapshot: false });
  const res = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mock)), { body: claimRequest(testData) });
  assert.strictEqual(res.status, 500);
  assert.strictEqual(mock.state.storageUploads.length, 0);
  assert.strictEqual(mock.state.storageRemovals.length, 0);
});

test('49 CAS-Race während Bereinigung nach Auftragsfehler verhindert Löschung', async () => {
  const testData = erstelleTestDta();
  const mock = erstelleSupabaseMock({
    testData,
    beforeUpdate: async ({ payload, state }) => {
      if (payload.status === 'verworfen') {
        state.currentClaim.status = 'accepted';
        state.currentClaim.updated_at = new Date(Date.now() + 5000).toISOString();
      }
    }
  });
  const deps = erstelleMockDeps(mock, { speichereAuftragError: new Error('Auftrag Plattenfehler') });
  const res = await callPostRoute(createZuzahlungsforderungRouter(deps), { body: claimRequest(testData) });
  assert.strictEqual(res.status, 500);
  assert.strictEqual(mock.state.currentClaim.status, 'accepted');
  assert.strictEqual(mock.state.storageRemovals.length, 0);
});

test('50 Wiederaufnahme prüft Mikrosekunden und NULL-Filter, DTA-Fehler verwirft ohne Löschung', async () => {
  const testData = erstelleTestDta();
  const exactMicroseconds = '2026-09-01T12:00:00.123456Z';
  const { existingClaimRow } = completedClaimFixture(testData);
  existingClaimRow.status = 'verworfen';
  existingClaimRow.updated_at = exactMicroseconds;
  existingClaimRow.signed_storage_path = null;
  existingClaimRow.encrypted_storage_path = null;
  const mock = erstelleSupabaseMock({
    testData,
    existingClaimRow,
    uploadDtaError: new Error('DTA Netzwerkabbruch')
  });
  const res = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mock)), { body: claimRequest(testData) });
  assert.strictEqual(res.status, 500);
  assert.strictEqual(mock.state.updateFilters[0].updated_at, exactMicroseconds);
  assert.strictEqual(mock.state.updateFilters[0].signed_storage_path, null);
  assert.strictEqual(mock.state.updateFilters[0].encrypted_storage_path, null);
  assert.strictEqual(mock.state.currentClaim.status, 'verworfen');
  assert.strictEqual(mock.state.storageRemovals.length, 0);
});

test('51 Fehler beim Storage-Löschen belässt Header als verworfen und liefert 500', async () => {
  const testData = erstelleTestDta();
  const mock = erstelleSupabaseMock({
    testData,
    uploadBegleitError: new Error('Begleit Upload fehlgeschlagen'),
    storageRemoveError: new Error('Storage Löschen fehlgeschlagen')
  });
  const res = await callPostRoute(createZuzahlungsforderungRouter(erstelleMockDeps(mock)), { body: claimRequest(testData) });
  assert.strictEqual(res.status, 500);
  assert.notStrictEqual(res.status, 200);
  assert.strictEqual(mock.state.currentClaim.status, 'verworfen');
  assert.ok(mock.state.storageRemovals.length > 0);
});
