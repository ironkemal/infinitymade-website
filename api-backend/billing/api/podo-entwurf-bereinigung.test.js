import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import {
  ABRECHNUNG_VERSION_FELDER,
  pruefeEntwurfsVersion,
  aktualisiereArtefaktVersion,
} from './artefakt-version.js';
import {
  bereinigeUnveroeffentlichtenEntwurf,
} from './entwurf-bereinigung.js';

function getExtractedRouteRegion() {
  const candidateUrls = [
    new URL('./abrechnung.routes.js', import.meta.url),
    new URL('../abrechnung.routes.js', import.meta.url),
    new URL('../routes/abrechnung.routes.js', import.meta.url),
    new URL('../../routes/abrechnung.routes.js', import.meta.url),
    new URL('../../src/routes/abrechnung.routes.js', import.meta.url),
  ];
  let fullSource = null;
  for (const u of candidateUrls) {
    try {
      if (existsSync(u)) {
        const content = readFileSync(u, 'utf8');
        if (content.includes("router.post('/abrechnung/create-podologie'")) {
          fullSource = content;
          break;
        }
      }
    } catch {}
  }
  if (!fullSource) {
    fullSource = readFileSync(new URL('./abrechnung.routes.js', import.meta.url), 'utf8');
  }

  const routePostIdx = fullSource.indexOf("router.post('/abrechnung/create-podologie'");
  assert.ok(routePostIdx !== -1, "router.post('/abrechnung/create-podologie' nicht in abrechnung.routes.js gefunden");
  const startMarker = '    // ---- insert abrechnung row ----';
  const endMarker = '    // Reform S2.3:';
  const startIdx = fullSource.indexOf(startMarker, routePostIdx);
  assert.ok(startIdx !== -1, 'Kommentar startMarker // ---- insert abrechnung row ---- nicht gefunden');
  const endIdx = fullSource.indexOf(endMarker, startIdx);
  assert.ok(endIdx !== -1, 'Kommentar endMarker // Reform S2.3: nicht gefunden');
  return fullSource.slice(startIdx, endIdx);
}

const EXTRACTED_REGION = getExtractedRouteRegion();
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const quietConsole = {
  log: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    _calledWith: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      res._calledWith = { status: res.statusCode, body: data };
      return res;
    },
  };
  return res;
}

class RouteMockSupabase {
  constructor({ abrechnungen = [], prescriptions = [] } = {}) {
    this.abrechnungen = new Map(abrechnungen.map((a) => [a.id, { ...a }]));
    this.prescriptions = new Map(prescriptions.map((p) => [p.id, { ...p }]));
    this.prescriptionValidations = [];
    this.storageFiles = new Map();
    this.storageUploads = [];
    this.storageRemoves = [];
    this.tick = 1;
    this.mockConfig = {
      failDtaUpload: false,
      failAuftragUpload: false,
      failBegleitUpload: false,
      failBaueBegleitzettel: false,
      failPrescriptionClaim: false,
      failPrescriptionRollback: false,
      failStorageRemove: false,
      failCasPublication: false,
      failCasCleanup: false,
      failInsertAbrechnung: false,
      missingVersionFieldsOnInsert: false,
      claimPhysicallyAssignsThenReturnsError: false,
      claimPhysicallyAssignsThenThrows: false,
      claimPartialListWithHiddenAssigned: false,
      publicationCommitsThenReturnsError: false,
    };
  }

  get storage() {
    const self = this;
    return {
      from(bucket) {
        return {
          upload: async (path, buffer, opts) => {
            self.storageUploads.push({ bucket, path, buffer, opts });
            if (self.mockConfig.failDtaUpload && path.endsWith('.dta')) {
              return { data: null, error: { message: 'Simulierter DTA-Upload-Fehler' } };
            }
            if (self.mockConfig.failAuftragUpload && path.endsWith('.auf')) {
              return { data: null, error: { message: 'Simulierter Auftrag-Upload-Fehler' } };
            }
            if (self.mockConfig.failBegleitUpload && path.endsWith('.html')) {
              return { data: null, error: { message: 'Simulierter Begleitzettel-Upload-Fehler' } };
            }
            self.storageFiles.set(path, buffer);
            return { data: { path }, error: null };
          },
          remove: async (paths) => {
            self.storageRemoves.push({ bucket, paths: [...paths] });
            if (self.mockConfig.failStorageRemove) {
              return { data: null, error: { message: 'Simulierter Storage-Remove-Fehler' } };
            }
            for (const p of paths) {
              self.storageFiles.delete(p);
            }
            return { data: paths.map((p) => ({ name: p })), error: null };
          },
        };
      },
    };
  }

  from(table) {
    const self = this;

    if (table === 'prescription_validations') {
      return {
        insert: async (rows) => {
          self.prescriptionValidations.push(...rows);
          return { error: null };
        },
      };
    }

    if (table === 'abrechnung') {
      return {
        insert(insertPayload) {
          return {
            select(fields) {
              return {
                single: async () => {
                  if (self.mockConfig.failInsertAbrechnung) {
                    return { data: null, error: { message: 'Insert fehlgeschlagen' } };
                  }
                  const id = `abr-podo-${String(self.tick).padStart(3, '0')}`;
                  const nowStr = `2026-10-04 10:49:19.${String(self.tick++).padStart(6, '0')}`;
                  const versionFields = ABRECHNUNG_VERSION_FELDER.split(',').map((f) => f.trim());
                  const base = Object.fromEntries(versionFields.map((f) => [f, null]));
                  const row = {
                    ...base,
                    business_id: 'biz-test-1',
                    id,
                    status: 'erstellt',
                    updated_at: nowStr,
                    ...insertPayload,
                  };
                  if (self.mockConfig.missingVersionFieldsOnInsert) {
                    delete row.dta_sha256;
                  }
                  self.abrechnungen.set(id, row);
                  return { data: { ...row }, error: null };
                },
              };
            },
          };
        },
        update(patch) {
          const filters = [];
          let selectedFields = null;
          const builder = {
            eq(col, val) {
              filters.push({ type: 'eq', col, val });
              return builder;
            },
            is(col, val) {
              filters.push({ type: 'is', col, val });
              return builder;
            },
            select(fields) {
              selectedFields = fields;
              return builder;
            },
            then(onFulfilled, onRejected) {
              const promise = (async () => {
                await Promise.resolve();
                const idFilter = filters.find((f) => f.col === 'id');
                if (!idFilter) return { data: [], error: null };
                const current = self.abrechnungen.get(idFilter.val);
                if (!current) return { data: [], error: null };

                if (self.mockConfig.failCasPublication && patch.storage_path) {
                  return { data: [], error: null };
                }
                if (self.mockConfig.failCasCleanup && patch.status === 'verworfen') {
                  return { data: [], error: null };
                }

                for (const f of filters) {
                  if (f.type === 'eq' && current[f.col] !== f.val) {
                    return { data: [], error: null };
                  }
                  if (f.type === 'is' && current[f.col] !== f.val) {
                    return { data: [], error: null };
                  }
                }

                if (patch.storage_path) assert.ok([...self.prescriptions.values()].some(row => row.abrechnung_id === idFilter.val), 'Publication requires prior successful prescription claim');
                const updated = {
                  ...current,
                  ...patch,
                  updated_at: `2026-10-04 10:49:19.${String(self.tick++).padStart(6, '0')}`,
                };
                self.abrechnungen.set(idFilter.val, updated);

                if (self.mockConfig.publicationCommitsThenReturnsError && patch.storage_path) {
                  return { data: null, error: { message: 'DB Commit Acknowledgement Error' } };
                }

                return { data: [{ ...updated }], error: null };
              })();
              return promise.then(onFulfilled, onRejected);
            },
          };
          return builder;
        },
      };
    }

    if (table === 'prescriptions') {
      return {
        update(patch) {
          const inFilters = [];
          const eqFilters = [];
          let orFilter = null;
          let selectFields = null;

          const builder = {
            in(col, vals) {
              inFilters.push({ col, vals: [...vals] });
              return builder;
            },
            eq(col, val) {
              eqFilters.push({ col, val });
              return builder;
            },
            or(filterStr) {
              orFilter = filterStr;
              return builder;
            },
            select(fields) {
              selectFields = fields;
              return builder;
            },
            then(onFulfilled, onRejected) {
              const promise = (async () => {
                await Promise.resolve();
                if (self.mockConfig.transferClaimBeforeRollback && patch.abrechnung_id === null) {
                  const target = self.prescriptions.get(eqFilters.find(f => f.col === 'id')?.val);
                  if (target) Object.assign(target, { abrechnung_id: 'abr-transfer-999', abrechnung_status: 'abgerechnet' });
                }
                if (self.mockConfig.failPrescriptionRollback && patch.abrechnung_id === null) {
                  return { data: null, error: { message: 'Prescription rollback DB error' } };
                }

                if (patch.abrechnung_status === 'abgerechnet') {
                  if (self.mockConfig.claimPhysicallyAssignsThenThrows) {
                    for (const [id, row] of self.prescriptions.entries()) {
                      let match = true;
                      for (const inf of inFilters) {
                        if (!inf.vals.includes(row[inf.col])) match = false;
                      }
                      if (match) {
                        Object.assign(row, patch);
                      }
                    }
                    throw new Error('Claim Abrupt Connection Dropped Exception');
                  }

                  if (self.mockConfig.claimPhysicallyAssignsThenReturnsError) {
                    for (const [id, row] of self.prescriptions.entries()) {
                      let match = true;
                      for (const inf of inFilters) {
                        if (!inf.vals.includes(row[inf.col])) match = false;
                      }
                      if (match) {
                        Object.assign(row, patch);
                      }
                    }
                    return { data: null, error: { message: 'Claim DB Network severed after write' } };
                  }

                  if (self.mockConfig.claimPartialListWithHiddenAssigned) {
                    const matched = [];
                    for (const [id, row] of self.prescriptions.entries()) {
                      let match = true;
                      for (const inf of inFilters) {
                        if (!inf.vals.includes(row[inf.col])) match = false;
                      }
                      if (match) {
                        Object.assign(row, patch);
                        if (id === 'vo-podo-1') {
                          matched.push({ id: row.id });
                        }
                      }
                    }
                    return { data: matched, error: { message: 'Partial batch write error' } };
                  }

                  if (self.mockConfig.failPrescriptionClaim) {
                    return { data: [], error: null };
                  }
                }

                const matched = [];
                for (const [id, row] of self.prescriptions.entries()) {
                  let match = true;
                  for (const inf of inFilters) {
                    if (!inf.vals.includes(row[inf.col])) {
                      match = false;
                      break;
                    }
                  }
                  if (!match) continue;

                  for (const eqf of eqFilters) {
                    if (row[eqf.col] !== eqf.val) {
                      match = false;
                      break;
                    }
                  }
                  if (!match) continue;

                  if (orFilter) {
                    const isClaimable = (row.abrechnung_status === null || row.abrechnung_status === 'abrechenbar' || row.abrechnung_status === 'korrigiert') && !row.abrechnung_id;
                    if (!isClaimable) {
                      match = false;
                    }
                  }

                  if (match) {
                    Object.assign(row, patch);
                    matched.push({ id: row.id });
                  }
                }

                return { data: matched, error: null };
              })();
              return promise.then(onFulfilled, onRejected);
            },
          };
          return builder;
        },
      };
    }

    throw new Error(`Nicht unterstuetzte Tabelle: ${table}`);
  }
}

function createSpeichereAuftragsdatei(supabase, sha256HexFn) {
  return async function speichereAuftragsdatei({ dta, verzeichnis, upsert = true }) {
    if (!dta?.auftragsdatei) return { pfad: null, groesse: null, sha256: null, fehler: 'nicht erzeugt' };
    const puffer = Buffer.from(dta.auftragsdatei, 'latin1');
    const pfad = `${verzeichnis}/${dta.filename}.auf`;
    const up = await supabase.storage.from('abrechnungen').upload(pfad, puffer, {
      contentType: 'application/octet-stream', upsert,
    });
    if (up.error) {
      return { pfad: null, groesse: puffer.length, sha256: sha256HexFn(puffer), fehler: up.error.message };
    }
    return { pfad, groesse: puffer.length, sha256: sha256HexFn(puffer), fehler: null };
  };
}

function buildTestContext(supabase, overrides = {}) {
  const tenantId = 'tenant-test-001';
  const kostentraegerIk = '109999999';
  const dasIk = '108888888';
  const sammelRechnungsnummer = 'RE-2026-0001';
  const totalBrutto = '150.00';
  const totalZu = '10.00';
  const betriebsart = 'standard';
  const datennummer = 'DN-2026-001';
  const year = 2026;
  const now = new Date('2026-10-04T10:49:19Z');

  const dta = {
    filename: 'TK001',
    byteLength: 2048,
    segmentCount: 12,
    transfernummer: 'TR-100',
    content: 'SYNTHETIC_DTA_CONTENT_LATIN1',
    auftragsdatei: 'SYNTHETIC_AUF_CONTENT_LATIN1',
  };

  const vords = [
    {
      id: 'vo-podo-1',
      ausstellungsdatum: '2026-09-01',
      status: 'abrechenbar',
      abrechnung_id: null,
      leads: 'Mustermann, Max',
    },
  ];

  const prescriptions = [
    {
      id: 'vo-podo-1',
      patient: { belegnummer: 'BEL-1001' },
      sessions: [{ einzelbetrag: '50.00', anzahl: 3 }],
    },
  ];

  const verordnungIds = ['vo-podo-1'];
  const res = createMockRes();

  const speichereAuftragsdatei = createSpeichereAuftragsdatei(supabase, sha256Hex);

  const baueBegleitzettel = async () => {
    if (supabase.mockConfig.failBaueBegleitzettel) {
      throw new Error('Begleitzettel Generator Ausnahme');
    }
    return '<!DOCTYPE html><html><body>Synthetic Begleitzettel</body></html>';
  };

  const context = {
    supabase,
    tenantId,
    kostentraegerIk,
    dasIk,
    sammelRechnungsnummer,
    totalBrutto,
    totalZu,
    betriebsart,
    datennummer,
    dta,
    prescriptions,
    vords,
    verordnungIds,
    year,
    now,
    res,
    uebersteuerteSperren: [],
    u: { user: { id: 'user-001' } },
    kk: { ik: kostentraegerIk, name: 'AOK Test' },
    profile: {
      business_name: 'Podologie Testpraxis',
      street: 'Testweg',
      house_number: '12',
      zip: '10115',
      city: 'Berlin',
      phone: '030123456',
    },
    cert: { ik_nummer: '123456789' },
    nameParts: () => ({ vorname: 'Max', nachname: 'Mustermann' }),
    verordnungFestschreiben: () => true,
    abrechnungStatusAusStatus: (s) => (s === 'abgerechnet' ? 'abgerechnet' : (s || 'abrechenbar')),
    einreichbarFilterAbrechnungStatus: () => 'abrechnung_status.is.null,abrechnung_status.eq.abrechenbar',
    sha256Hex,
    randomUUID,
    Buffer,
    console: quietConsole,
    ABRECHNUNG_VERSION_FELDER,
    pruefeEntwurfsVersion,
    aktualisiereArtefaktVersion,
    bereinigeUnveroeffentlichtenEntwurf,
    speichereAuftragsdatei,
    baueBegleitzettel,
    ...overrides,
  };

  return context;
}

async function executeRouteSnippet(regionCode, context) {
  const keys = Object.keys(context);
  const values = Object.values(context);
  const wrappedBody = `
    ${regionCode}
    return {
      success: true,
      ab,
      uebernommen,
      erfolgreichePfade,
      dtaPath,
      begleitPath,
      auftrag,
    };
  `;
  const fn = new AsyncFunction(...keys, wrappedBody);
  return await fn(...values);
}

test('happyfullpublicationONLYafterclaims, filesupsertfalse unique', async () => {
  const supabase = new RouteMockSupabase({
    prescriptions: [
      { id: 'vo-podo-1', therapie_bereich: 'podo', abrechnung_status: null, abrechnung_id: null },
    ],
  });
  const ctx = buildTestContext(supabase);

  const result = await executeRouteSnippet(EXTRACTED_REGION, ctx);
  assert.equal(result.success, true);
  assert.equal(result.ab.status, 'erstellt');
  assert.ok(result.ab.storage_path, 'storage_path muss publiziert sein');
  assert.ok(result.ab.auftragsdatei_path, 'auftragsdatei_path muss publiziert sein');
  assert.ok(result.ab.begleitzettel_path, 'begleitzettel_path muss publiziert sein');
  assert.ok(result.ab.dta_sha256, 'dta_sha256 muss publiziert sein');

  assert.equal(supabase.storageUploads.length, 3, 'Genau 3 Dateien muessen hochgeladen werden');
  for (const up of supabase.storageUploads) {
    assert.equal(up.opts.upsert, false, 'Jeder Upload muss strikt mit upsert: false erfolgen');
  }
  const uploadPaths = supabase.storageUploads.map((u) => u.path);
  assert.equal(new Set(uploadPaths).size, 3, 'Alle 3 Uploadpfade muessen eindeutig sein');

  const p1 = supabase.prescriptions.get('vo-podo-1');
  assert.equal(p1.abrechnung_status, 'abgerechnet');
  assert.equal(p1.abrechnung_id, result.ab.id);
});

test('2parallelcreate sameprescriptions onepub success other409discard and cleanup ONLYits3files', async () => {
  const supabase = new RouteMockSupabase({
    prescriptions: [
      { id: 'vo-podo-1', therapie_bereich: 'podo', abrechnung_status: null, abrechnung_id: null },
    ],
  });

  const ctx1 = buildTestContext(supabase);
  const ctx2 = buildTestContext(supabase, { sammelRechnungsnummer: 'RE-2026-0002' });
  const [res1] = await Promise.all([executeRouteSnippet(EXTRACTED_REGION, ctx1), executeRouteSnippet(EXTRACTED_REGION, ctx2)]);
  assert.equal(res1.success, true);
  const ab1 = res1.ab;
  assert.equal(ab1.status, 'erstellt');
  const filesRun1 = [...supabase.storageFiles.keys()].filter(path => path.includes(`/${res1.ab.id}/`));
  assert.equal(filesRun1.length, 3, 'Erster Lauf hat genau 3 Dateien angelegt');


  assert.equal(ctx2.res.statusCode, 409);
  assert.match(ctx2.res.body.error, /soeben von einer anderen Anfrage abgerechnet/);
  assert.match(ctx2.res.body.error, /Der Entwurf wurde verworfen/);

  const allAbrechnungen = Array.from(supabase.abrechnungen.values());
  assert.equal(allAbrechnungen.length, 2);
  const ab2 = allAbrechnungen[1];
  assert.notEqual(ab1.id, ab2.id, 'Beide Laeufe muessen getrennte eindeutige IDs besitzen');
  assert.equal(ab2.status, 'verworfen');
  assert.equal(ab2.verwerfungsgrund, 'VERORDNUNG_ANSPRUCH_KONFLIKT');

  for (const f of filesRun1) {
    assert.ok(supabase.storageFiles.has(f), `Datei des erfolgreichen Gewinners darf nicht geloescht werden: ${f}`);
  }
  assert.equal(supabase.storageFiles.size, 3, 'Nur die 3 Dateien des fehlgeschlagenen Versuchs wurden geloescht, Gewinnerdateien bleiben erhalten');
});

test('partialclaim rollback only owned .eq(abrechnung_id), foreign transferredrownotreset', async () => {
  const supabase = new RouteMockSupabase({
    prescriptions: [
      { id: 'vo-foreign', therapie_bereich: 'podo', abrechnung_status: 'abgerechnet', abrechnung_id: 'abr-fremd-888' },
      { id: 'vo-owned', therapie_bereich: 'podo', abrechnung_status: null, abrechnung_id: null },
    ],
  });

  supabase.mockConfig.transferClaimBeforeRollback = true;
  const ctx = buildTestContext(supabase, {
    verordnungIds: ['vo-foreign', 'vo-owned'],
    vords: [
      { id: 'vo-foreign', status: 'abgerechnet', abrechnung_id: 'abr-fremd-888', ausstellungsdatum: '2026-09-01', leads: 'Fremd, Karl' },
      { id: 'vo-owned', status: 'abrechenbar', abrechnung_id: null, ausstellungsdatum: '2026-09-01', leads: 'Eigen, Otto' },
    ],
    prescriptions: [
      { id: 'vo-foreign', patient: { belegnummer: 'BEL-F' }, sessions: [{ einzelbetrag: '50.00', anzahl: 1 }] },
      { id: 'vo-owned', patient: { belegnummer: 'BEL-O' }, sessions: [{ einzelbetrag: '50.00', anzahl: 1 }] },
    ],
  });

  await executeRouteSnippet(EXTRACTED_REGION, ctx);
  assert.equal(ctx.res.statusCode, 409);

  const foreignRow = supabase.prescriptions.get('vo-foreign');
  assert.equal(foreignRow.abrechnung_status, 'abgerechnet');
  assert.equal(foreignRow.abrechnung_id, 'abr-fremd-888', 'Fremde Abrechnungs-ID darf niemals zurueckgesetzt werden');

  const ownedRow = supabase.prescriptions.get('vo-owned');
  assert.equal(ownedRow.abrechnung_status, 'abgerechnet');
  assert.equal(ownedRow.abrechnung_id, 'abr-transfer-999', 'Returned own claim transferred before rollback must remain untouched');
});

test('rollbackerror/throw markdiscard but noRemove', async () => {
  const supabase = new RouteMockSupabase({
    prescriptions: [
      { id: 'vo-foreign', therapie_bereich: 'podo', abrechnung_status: 'abgerechnet', abrechnung_id: 'abr-fremd-777' },
      { id: 'vo-partial', therapie_bereich: 'podo', abrechnung_status: null, abrechnung_id: null },
    ],
  });
  supabase.mockConfig.failPrescriptionRollback = true;

  const ctx = buildTestContext(supabase, {
    verordnungIds: ['vo-foreign', 'vo-partial'],
    vords: [
      { id: 'vo-foreign', status: 'abgerechnet', abrechnung_id: 'abr-fremd-777', ausstellungsdatum: '2026-09-01', leads: 'A, B' },
      { id: 'vo-partial', status: 'abrechenbar', abrechnung_id: null, ausstellungsdatum: '2026-09-01', leads: 'C, D' },
    ],
    prescriptions: [
      { id: 'vo-foreign', patient: { belegnummer: 'BEL-1' }, sessions: [{ einzelbetrag: '50.00', anzahl: 1 }] },
      { id: 'vo-partial', patient: { belegnummer: 'BEL-2' }, sessions: [{ einzelbetrag: '50.00', anzahl: 1 }] },
    ],
  });

  await executeRouteSnippet(EXTRACTED_REGION, ctx);
  assert.equal(ctx.res.statusCode, 409);
  assert.match(ctx.res.body.error, /erzeugte Dateien wurden einbehalten/);

  const ab = Array.from(supabase.abrechnungen.values())[0];
  assert.equal(ab.status, 'verworfen');
  assert.equal(supabase.storageRemoves.length, 0, 'Dateien muessen bei Rollback-Fehler im Storage verbleiben (pfade: [])');
  assert.equal(supabase.storageFiles.size, 3);
});

test('storageDTAfailure emptycleanup preservedheadernumbers', async () => {
  const supabase = new RouteMockSupabase({
    prescriptions: [
      { id: 'vo-podo-1', therapie_bereich: 'podo', abrechnung_status: null, abrechnung_id: null },
    ],
  });
  supabase.mockConfig.failDtaUpload = true;
  const ctx = buildTestContext(supabase);

  await executeRouteSnippet(EXTRACTED_REGION, ctx);
  assert.equal(ctx.res.statusCode, 500);
  assert.match(ctx.res.body.error, /Storage upload:/);

  const ab = Array.from(supabase.abrechnungen.values())[0];
  assert.equal(ab.status, 'verworfen');
  assert.equal(ab.verwerfungsgrund, 'STORAGE_UPLOAD_FEHLER');
  assert.equal(ab.rechnungsnummer, 'RE-2026-0001');
  assert.equal(ab.total_eur, '150.00');
  assert.equal(ab.zuzahlung_total, '10.00');
  assert.equal(supabase.storageRemoves.length, 0, 'Kein remove wenn keine Dateien hochgeladen wurden');
});

test('failingauf/beg optional preserved existingcontract', async () => {
  const supabase = new RouteMockSupabase({
    prescriptions: [
      { id: 'vo-podo-1', therapie_bereich: 'podo', abrechnung_status: null, abrechnung_id: null },
    ],
  });
  supabase.mockConfig.failAuftragUpload = true;
  supabase.mockConfig.failBegleitUpload = true;
  const ctx = buildTestContext(supabase);

  const res = await executeRouteSnippet(EXTRACTED_REGION, ctx);
  assert.equal(res.success, true);
  assert.equal(res.ab.status, 'erstellt');
  assert.ok(res.ab.storage_path, 'storage_path fuer DTA muss vorhanden sein');
  assert.equal(res.ab.auftragsdatei_path, null);
  assert.equal(res.ab.begleitzettel_path, null);
});

test('headerpublicationlostCAS new version noRemove andnotoverwrite', async () => {
  const supabase = new RouteMockSupabase({
    prescriptions: [
      { id: 'vo-podo-1', therapie_bereich: 'podo', abrechnung_status: null, abrechnung_id: null },
    ],
  });
  supabase.mockConfig.failCasPublication = true;
  supabase.mockConfig.failCasCleanup = true;
  const ctx = buildTestContext(supabase);

  await executeRouteSnippet(EXTRACTED_REGION, ctx);
  assert.equal(ctx.res.statusCode, 409);
  assert.match(ctx.res.body.error, /Abrechnung wurde zwischenzeitlich geändert/);
  assert.match(ctx.res.body.error, /Keine Dateien gelöscht/);

  assert.equal(supabase.storageFiles.size, 3, 'Dateien duerfen bei CAS-Verlust nicht geloescht werden');
  const currentAb = [...supabase.abrechnungen.values()][0];
  assert.equal(supabase.prescriptions.get('vo-podo-1').abrechnung_id, currentAb.id, 'Lost publication must not release claim');
  assert.equal(supabase.prescriptions.get('vo-podo-1').abrechnung_status, 'abgerechnet');
});

test('snapshotmustfull', async () => {
  const supabase = new RouteMockSupabase({
    prescriptions: [
      { id: 'vo-podo-1', therapie_bereich: 'podo', abrechnung_status: null, abrechnung_id: null },
    ],
  });
  supabase.mockConfig.missingVersionFieldsOnInsert = true;
  const ctx = buildTestContext(supabase);

  await assert.rejects(
    async () => {
      await executeRouteSnippet(EXTRACTED_REGION, ctx);
    },
    (err) => {
      assert.equal(err.status || err.statusCode, 409);
      assert.equal(err.code, 'ABRECHNUNG_VERSION_CONFLICT');
      return true;
    }
  );
});

test('prepublicationbaueBegleitthrow removes2ownedfiles afterdiscard', async () => {
  const supabase = new RouteMockSupabase({
    prescriptions: [
      { id: 'vo-podo-1', therapie_bereich: 'podo', abrechnung_status: null, abrechnung_id: null },
    ],
  });
  supabase.mockConfig.failBaueBegleitzettel = true;
  const ctx = buildTestContext(supabase);

  await executeRouteSnippet(EXTRACTED_REGION, ctx);
  assert.equal(ctx.res.statusCode, 500);
  assert.match(ctx.res.body.error, /Begleitzettel Generator Ausnahme/);

  const ab = Array.from(supabase.abrechnungen.values())[0];
  assert.equal(ab.status, 'verworfen');
  assert.equal(supabase.storageFiles.size, 0, 'Die 2 erzeugten Dateien (DTA + Auftrag) muessen geloescht sein');
  assert.equal(supabase.storageRemoves[0].paths.length, 2);
});

test('cleanupStoragefailed remainsblockeddiscard nofiledeletionclaim', async () => {
  const supabase = new RouteMockSupabase({
    prescriptions: [
      { id: 'vo-podo-1', therapie_bereich: 'podo', abrechnung_status: 'abgerechnet', abrechnung_id: 'abr-belegt' },
    ],
  });
  supabase.mockConfig.failStorageRemove = true;
  const ctx = buildTestContext(supabase);

  await executeRouteSnippet(EXTRACTED_REGION, ctx);
  assert.equal(ctx.res.statusCode, 409);
  assert.match(ctx.res.body.error, /erzeugte Dateien wurden einbehalten/);
  assert.doesNotMatch(ctx.res.body.error, /Der Entwurf wurde verworfen und nicht eingereicht — bitte die Liste neu laden/);
});

test('anspruchUnklar case a: claim physically assigns then returns error+null', async () => {
  const supabase = new RouteMockSupabase({
    prescriptions: [
      { id: 'vo-podo-1', therapie_bereich: 'podo', abrechnung_status: null, abrechnung_id: null },
    ],
  });
  supabase.mockConfig.claimPhysicallyAssignsThenReturnsError = true;
  const ctx = buildTestContext(supabase);

  await executeRouteSnippet(EXTRACTED_REGION, ctx);
  assert.equal(ctx.res.statusCode, 409);
  assert.match(ctx.res.body.error, /erzeugte Dateien wurden einbehalten/);

  const ab = Array.from(supabase.abrechnungen.values())[0];
  assert.equal(ab.status, 'verworfen');
  assert.equal(supabase.storageRemoves.length, 0, 'Kein Storage-Remove bei unklarem Anspruch');
  assert.equal(supabase.storageFiles.size, 3, 'Dateien muessen einbehalten werden');

  const p1 = supabase.prescriptions.get('vo-podo-1');
  assert.equal(p1.abrechnung_id, ab.id, 'Unbekannte Zeile bleibt unberuehrt ohne Erfindung');
});

test('anspruchUnklar case b: claim physically assigns then throws exception', async () => {
  const supabase = new RouteMockSupabase({
    prescriptions: [
      { id: 'vo-podo-1', therapie_bereich: 'podo', abrechnung_status: null, abrechnung_id: null },
    ],
  });
  supabase.mockConfig.claimPhysicallyAssignsThenThrows = true;
  const ctx = buildTestContext(supabase);

  await executeRouteSnippet(EXTRACTED_REGION, ctx);
  assert.equal(ctx.res.statusCode, 500);
  assert.match(ctx.res.body.error, /Claim Abrupt Connection Dropped Exception/);

  const ab = Array.from(supabase.abrechnungen.values())[0];
  assert.equal(ab.status, 'verworfen');
  assert.equal(supabase.storageRemoves.length, 0);
  assert.equal(supabase.storageFiles.size, 3);

  const p1 = supabase.prescriptions.get('vo-podo-1');
  assert.equal(p1.abrechnung_id, ab.id);
});

test('anspruchUnklar case c: error+partial list while other unreturned rows own ab', async () => {
  const supabase = new RouteMockSupabase({
    prescriptions: [
      { id: 'vo-podo-1', therapie_bereich: 'podo', abrechnung_status: null, abrechnung_id: null },
      { id: 'vo-podo-2', therapie_bereich: 'podo', abrechnung_status: null, abrechnung_id: null },
    ],
  });
  supabase.mockConfig.claimPartialListWithHiddenAssigned = true;

  const ctx = buildTestContext(supabase, {
    verordnungIds: ['vo-podo-1', 'vo-podo-2'],
    vords: [
      { id: 'vo-podo-1', status: 'abrechenbar', abrechnung_id: null, ausstellungsdatum: '2026-09-01', leads: 'A, B' },
      { id: 'vo-podo-2', status: 'abrechenbar', abrechnung_id: null, ausstellungsdatum: '2026-09-01', leads: 'C, D' },
    ],
    prescriptions: [
      { id: 'vo-podo-1', patient: { belegnummer: 'BEL-1' }, sessions: [{ einzelbetrag: '50.00', anzahl: 1 }] },
      { id: 'vo-podo-2', patient: { belegnummer: 'BEL-2' }, sessions: [{ einzelbetrag: '50.00', anzahl: 1 }] },
    ],
  });

  await executeRouteSnippet(EXTRACTED_REGION, ctx);
  assert.equal(ctx.res.statusCode, 409);
  assert.match(ctx.res.body.error, /erzeugte Dateien wurden einbehalten/);

  const ab = Array.from(supabase.abrechnungen.values())[0];
  assert.equal(ab.status, 'verworfen');
  assert.equal(supabase.storageRemoves.length, 0, 'Kein remove wenn unklarer Anspruch trotz Ruecknahme zurueckgegebener Zeilen');
  assert.equal(supabase.storageFiles.size, 3);

  const p1 = supabase.prescriptions.get('vo-podo-1');
  assert.equal(p1.abrechnung_id, null, 'Uebernommene Zeile wurde zurueckgesetzt');

  const p2 = supabase.prescriptions.get('vo-podo-2');
  assert.equal(p2.abrechnung_id, ab.id, 'Nicht zurueckgegebene Zeile bleibt unberuehrt');
});

test('anspruchUnklar case d: publication commits then returns DB error, cleanup CAS loses => noRemove, published row intact', async () => {
  const supabase = new RouteMockSupabase({
    prescriptions: [
      { id: 'vo-podo-1', therapie_bereich: 'podo', abrechnung_status: null, abrechnung_id: null },
    ],
  });
  supabase.mockConfig.publicationCommitsThenReturnsError = true;
  const ctx = buildTestContext(supabase);

  await executeRouteSnippet(EXTRACTED_REGION, ctx);
  assert.equal(ctx.res.statusCode, 409);
  assert.match(ctx.res.body.error, /Abrechnung wurde zwischenzeitlich geändert/);
  assert.match(ctx.res.body.error, /Keine Dateien gelöscht/);

  assert.equal(supabase.storageRemoves.length, 0, 'Kein remove wenn CAS-Bereinigung wegen vorherigem Commit verloren geht');
  assert.equal(supabase.storageFiles.size, 3, 'Dateien verbleiben unangetastet');

  const ab = Array.from(supabase.abrechnungen.values())[0];
  assert.ok(ab.storage_path, 'Publizierter storage_path bleibt in DB intakt');
  assert.ok(ab.dta_sha256, 'Publizierter dta_sha256 bleibt in DB intakt');
  assert.equal(ab.status, 'erstellt', 'Header-Status bleibt erhalten');

  const p = supabase.prescriptions.get('vo-podo-1');
  assert.equal(p.abrechnung_id, ab.id, 'Verordnungsanspruch bleibt bei publiziertem Header bestehen (kein Release)');
  assert.equal(p.abrechnung_status, 'abgerechnet', 'Verordnungsstatus bleibt abgerechnet');
});
