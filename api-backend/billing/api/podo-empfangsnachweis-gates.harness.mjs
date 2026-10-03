import { mock, test } from 'node:test';
import assert from 'node:assert/strict';

const tenantId = '11111111-1111-4111-8111-111111111111';

const testContext = {
  eventsMode: 'missing',
  writeCount: 0,
  recordedQueries: [],
  tenantId,
};

class FakeQueryBuilder {
  constructor(table, context) {
    this.table = table;
    this.context = context;
    this.filters = [];
    this.isSingle = false;
    this.isMaybeSingle = false;
  }

  select(fields) {
    this.fields = fields;
    return this;
  }

  eq(col, val) {
    this.filters.push({ type: 'eq', col, val });
    this.context.recordedQueries.push({ table: this.table, op: 'eq', col, val });
    return this;
  }

  is(col, val) {
    this.filters.push({ type: 'is', col, val });
    this.context.recordedQueries.push({ table: this.table, op: 'is', col, val });
    return this;
  }

  in(col, vals) {
    this.filters.push({ type: 'in', col, vals });
    this.context.recordedQueries.push({ table: this.table, op: 'in', col, vals });
    return this;
  }

  order(col, opts) {
    this.filters.push({ type: 'order', col, opts });
    return this;
  }

  or(clause) {
    this.filters.push({ type: 'or', clause });
    return this;
  }

  gt(col, val) {
    this.filters.push({ type: 'gt', col, val });
    return this;
  }

  not(col, op, val) {
    this.filters.push({ type: 'not', col, op, val });
    return this;
  }

  limit(n) {
    this.filters.push({ type: 'limit', n });
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  insert() {
    this.context.writeCount++;
    throw new Error('Supabase insert blocked in test harness');
  }

  update() {
    this.context.writeCount++;
    throw new Error('Supabase update blocked in test harness');
  }

  delete() {
    this.context.writeCount++;
    throw new Error('Supabase delete blocked in test harness');
  }

  async _resolve() {
    const { table, isSingle, isMaybeSingle, context } = this;

    if (table === 'podologie_empfangsnachweise') {
      if (context.eventsMode === 'DBerror') {
        return { data: null, error: { message: 'Database connection failed (synthetic)' } };
      }
      if (context.eventsMode === 'latestwithdrawal') {
        return {
          data: [
            {
              event_seq: 2,
              owner_id: context.tenantId,
              behandlung_id: 'beh-1',
              behandlungsdatum: '2026-10-01',
              hpnr_code: '78040',
              therapeuteninitialen: 'MD',
              status: 'widerrufen',
            },
            {
              event_seq: 1,
              owner_id: context.tenantId,
              behandlung_id: 'beh-1',
              behandlungsdatum: '2026-10-01',
              hpnr_code: '78040',
              therapeuteninitialen: 'MD',
              status: 'bestaetigt',
            },
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    }

    if (table === 'profiles') {
      const p = {
        id: context.tenantId,
        role: 'owner',
        owner_id: null,
        business_name: 'Synthetic Praxis',
        phone: '012345678',
        city: 'Siegburg',
        zip: '53721',
        street: 'Markt',
        house_number: '1',
        ik_number: '123456789',
        sector: 'podologie',
      };
      if (isSingle || isMaybeSingle) return { data: p, error: null };
      return { data: [p], error: null };
    }

    if (table === 'terapeut_zertifikat') {
      const cert = {
        ik_nummer: '123456789',
        cert_subject: 'CN=Synthetic',
        cert_valid_to: '2030-01-01',
        betriebsart: '01',
        zulassung_referenz: 'Z123',
        zulassung_datum: '2020-01-01',
      };
      if (isSingle || isMaybeSingle) return { data: cert, error: null };
      return { data: [cert], error: null };
    }

    if (table === 'kostentraeger') {
      const kk = { ik: '101010101', name: 'AOK Synthetic' };
      if (isSingle || isMaybeSingle) return { data: kk, error: null };
      return { data: [kk], error: null };
    }

    if (table === 'prescriptions') {
      const rx = {
        id: 'vord-1',
        owner_id: context.tenantId,
        abrechnung_status: 'offen',
        therapie_bereich: 'podo',
        rezeptart: 'kassen',
        diagnosegruppe: 'DF',
        doctor_lanr: '123456789',
        unterschrift_vorhanden: true,
        leitsymptomatik: 'a',
        pat_leitsymptomatik: '',
        anzahl_einheiten: 1,
        patient_name: 'Max Mustermann',
        nagel: null,
        abrechnung_id: null,
        leads: {
          id: 'lead-1',
          first_name: 'Max',
          last_name: 'Mustermann',
          geburtsdatum: '1980-01-01',
          versichertennummer: 'A123456789',
          versichertenstatus: '1',
          patientennummer: '100',
          street: 'Markt 1',
          plz: '53721',
          city: 'Siegburg',
        },
        aerzte: {
          id: 'arzt-1',
          arzt_name: 'Dr. Med',
          lanr: '123456789',
          bsnr: '987654321',
        },
        prescription_sessions: [],
      };
      if (isSingle || isMaybeSingle) return { data: rx, error: null };
      return { data: [rx], error: null };
    }

    if (table === 'podologie_behandlungen') {
      const b = {
        id: 'beh-1',
        verordnung_id: 'vord-1',
        behandlungsdatum: '2026-10-01',
        hpnr_codes: ['78010', '78040'],
        storniert_am: null,
      };
      if (isSingle || isMaybeSingle) return { data: b, error: null };
      return { data: [b], error: null };
    }

    if (table === 'abrechnung_zeile') {
      const z = {
        id: 'zeile-1',
        status: 'abgesetzt',
        therapie_bereich: 'podo',
        prescription_id: 'vord-1',
        belegnummer: '1-1',
        einzel_rechnungsnummer: '1',
        kostentraeger_ik: '101010101',
        owner_id: context.tenantId,
        abrechnung: {
          id: 'abr-1',
          rechnungsnummer: 'OLD',
          created_at: '2026-10-01',
          kostentraeger_ik: '101010101',
        },
      };
      if (isSingle || isMaybeSingle) return { data: z, error: null };
      return { data: [z], error: null };
    }

    if (table === 'prescription_validations' || table === 'bookings' || table === 'therapist_certificates') {
      return { data: [], error: null };
    }

    if (isSingle || isMaybeSingle) return { data: null, error: null };
    return { data: [], error: null };
  }

  then(onFulfilled, onRejected) {
    return this._resolve().then(onFulfilled, onRejected);
  }
}

const fakeSupabase = {
  auth: {
    getUser: async (token) => {
      if (!token) return { data: null, error: { message: 'No token' } };
      return { data: { user: { id: testContext.tenantId } }, error: null };
    },
  },
  from: (table) => new FakeQueryBuilder(table, testContext),
  rpc: () => {
    testContext.writeCount++;
    throw new Error('Supabase RPC blocked in test harness');
  },
  storage: {
    from: () => ({
      upload: () => {
        testContext.writeCount++;
        throw new Error('Supabase storage upload blocked in test harness');
      },
    }),
  },
};

const supabaseResolvedUrl = import.meta.resolve('@supabase/supabase-js');
mock.module(supabaseResolvedUrl, {
  namedExports: {
    createClient: () => fakeSupabase,
  },
});

const annahmestelleUrl = new URL('../kostentraeger/annahmestelle.js', import.meta.url).href;
mock.module(annahmestelleUrl, {
  namedExports: {
    ladeAnnahmestelle: async () => ({ ok: true, ik: '987654321', name: 'synthetic' }),
    annahmestelleFehlt: (res, info) => res.status(400).json({ error: 'annahmestelle fehlt', info }),
    ladePapierannahmestelle: async () => ({ ok: true, ik: '987654321', name: 'synthetic' }),
  },
});

const { default: statusRouter } = await import('./verordnung-status.routes.js');
const { default: abrechnungRouter } = await import('./abrechnung.routes.js');

async function invokeRoute(router, method, pathPattern, req, res) {
  for (const layer of router.stack) {
    if (layer.route && layer.route.methods[method.toLowerCase()]) {
      const matches = typeof pathPattern === 'string'
        ? layer.route.path === pathPattern
        : pathPattern.test(layer.route.path);
      if (matches) {
        for (const s of layer.route.stack) {
          await s.handle(req, res, () => {});
        }
        return;
      }
    }
  }
  throw new Error(`Route not found for ${method} ${pathPattern}`);
}

function createMockReqRes({ method = 'GET', url = '/', headers = {}, params = {}, body = {} }) {
  const req = {
    method,
    url,
    headers: {
      authorization: 'Bearer synthetic-test-token',
      ...headers,
    },
    params,
    body,
  };

  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
    send(data) {
      responseData = data;
      return res;
    },
    getStatus: () => statusCode,
    getBody: () => responseData,
  };

  return { req, res };
}

test('PATCH /verordnung/:id/abrechnungsstatus: Fehlender Nachweis blockiert mit 422 und 0 Writes', async () => {
  testContext.eventsMode = 'missing';
  testContext.writeCount = 0;
  testContext.recordedQueries = [];

  const { req, res } = createMockReqRes({
    method: 'PATCH',
    params: { id: 'vord-1' },
    body: { status: 'abrechenbar', offeneEinheitenBestaetigt: true },
  });

  await invokeRoute(statusRouter, 'PATCH', /\/verordnung\/:id\/abrechnungsstatus/, req, res);

  assert.equal(res.getStatus(), 422);
  assert.equal(testContext.writeCount, 0);
  assert.deepEqual(res.getBody()?.fehlendeBehandlungIds, ['beh-1']);
});

test('PATCH /verordnung/:id/abrechnungsstatus: Widerrufener Nachweis blockiert mit 422 und 0 Writes', async () => {
  testContext.eventsMode = 'latestwithdrawal';
  testContext.writeCount = 0;
  testContext.recordedQueries = [];

  const { req, res } = createMockReqRes({
    method: 'PATCH',
    params: { id: 'vord-1' },
    body: { status: 'abrechenbar', offeneEinheitenBestaetigt: true },
  });

  await invokeRoute(statusRouter, 'PATCH', /\/verordnung\/:id\/abrechnungsstatus/, req, res);

  assert.equal(res.getStatus(), 422);
  assert.equal(testContext.writeCount, 0);
  assert.deepEqual(res.getBody()?.fehlendeBehandlungIds, ['beh-1']);
});

test('PATCH /verordnung/:id/abrechnungsstatus: DB-Fehler führt zu kontrolliertem 503 und 0 Writes', async () => {
  testContext.eventsMode = 'DBerror';
  testContext.writeCount = 0;
  testContext.recordedQueries = [];

  const { req, res } = createMockReqRes({
    method: 'PATCH',
    params: { id: 'vord-1' },
    body: { status: 'abrechenbar', offeneEinheitenBestaetigt: true },
  });

  await invokeRoute(statusRouter, 'PATCH', /\/verordnung\/:id\/abrechnungsstatus/, req, res);

  assert.equal(res.getStatus(), 503);
  assert.equal(testContext.writeCount, 0);
});

test('POST /abrechnung/create-podologie: Fehlender Nachweis blockiert mit 422 und 0 Writes/RPC', async () => {
  testContext.eventsMode = 'missing';
  testContext.writeCount = 0;
  testContext.recordedQueries = [];

  const { req, res } = createMockReqRes({
    method: 'POST',
    body: {
      kostentraegerIk: '101010101',
      verordnungIds: ['vord-1'],
      offeneEinheitenBestaetigt: true,
    },
  });

  await invokeRoute(abrechnungRouter, 'POST', /create-podologie/, req, res);

  assert.equal(res.getStatus(), 422);
  assert.equal(testContext.writeCount, 0);
  assert.deepEqual(res.getBody()?.fehlendeBehandlungIds, ['beh-1']);
});

test('POST /abrechnung/create-podologie: Widerrufener Nachweis blockiert mit 422 und 0 Writes/RPC', async () => {
  testContext.eventsMode = 'latestwithdrawal';
  testContext.writeCount = 0;
  testContext.recordedQueries = [];

  const { req, res } = createMockReqRes({
    method: 'POST',
    body: {
      kostentraegerIk: '101010101',
      verordnungIds: ['vord-1'],
      offeneEinheitenBestaetigt: true,
    },
  });

  await invokeRoute(abrechnungRouter, 'POST', /create-podologie/, req, res);

  assert.equal(res.getStatus(), 422);
  assert.equal(testContext.writeCount, 0);
  assert.deepEqual(res.getBody()?.fehlendeBehandlungIds, ['beh-1']);
});

test('POST /abrechnung/create-podologie: DB-Fehler führt zu kontrolliertem 503 und 0 Writes/RPC', async () => {
  testContext.eventsMode = 'DBerror';
  testContext.writeCount = 0;
  testContext.recordedQueries = [];

  const { req, res } = createMockReqRes({
    method: 'POST',
    body: {
      kostentraegerIk: '101010101',
      verordnungIds: ['vord-1'],
      offeneEinheitenBestaetigt: true,
    },
  });

  await invokeRoute(abrechnungRouter, 'POST', /create-podologie/, req, res);

  assert.equal(res.getStatus(), 503);
  assert.equal(testContext.writeCount, 0);
});

test('POST /abrechnung/korrektur: Fehlender Nachweis blockiert mit 422 und 0 Writes', async () => {
  testContext.eventsMode = 'missing';
  testContext.writeCount = 0;
  testContext.recordedQueries = [];

  const { req, res } = createMockReqRes({
    method: 'POST',
    body: {
      zeilenIds: ['zeile-1'],
      grund: 'Synthetischer Korrekturgrund',
    },
  });

  await invokeRoute(abrechnungRouter, 'POST', /korrektur/, req, res);

  assert.equal(res.getStatus(), 422);
  assert.equal(testContext.writeCount, 0);
  assert.deepEqual(res.getBody()?.fehlendeBehandlungIds, ['beh-1']);
});

test('POST /abrechnung/korrektur: Widerrufener Nachweis blockiert mit 422 und 0 Writes', async () => {
  testContext.eventsMode = 'latestwithdrawal';
  testContext.writeCount = 0;
  testContext.recordedQueries = [];

  const { req, res } = createMockReqRes({
    method: 'POST',
    body: {
      zeilenIds: ['zeile-1'],
      grund: 'Synthetischer Korrekturgrund',
    },
  });

  await invokeRoute(abrechnungRouter, 'POST', /korrektur/, req, res);

  assert.equal(res.getStatus(), 422);
  assert.equal(testContext.writeCount, 0);
  assert.deepEqual(res.getBody()?.fehlendeBehandlungIds, ['beh-1']);
});

test('POST /abrechnung/korrektur: DB-Fehler führt zu kontrolliertem 503 und 0 Writes', async () => {
  testContext.eventsMode = 'DBerror';
  testContext.writeCount = 0;
  testContext.recordedQueries = [];

  const { req, res } = createMockReqRes({
    method: 'POST',
    body: {
      zeilenIds: ['zeile-1'],
      grund: 'Synthetischer Korrekturgrund',
    },
  });

  await invokeRoute(abrechnungRouter, 'POST', /korrektur/, req, res);

  assert.equal(res.getStatus(), 503);
  assert.equal(testContext.writeCount, 0);
});

test('POST /abrechnung/preflight: Weist podo-Verordnung vorab mit 400 ab (kein Receipt-Gate-Query nötig)', async () => {
  testContext.eventsMode = 'missing';
  testContext.writeCount = 0;
  testContext.recordedQueries = [];

  const { req, res } = createMockReqRes({
    method: 'POST',
    body: {
      prescriptionIds: ['vord-1'],
    },
  });

  await invokeRoute(abrechnungRouter, 'POST', /preflight/, req, res);

  assert.equal(res.getStatus(), 400);
  assert.equal(testContext.writeCount, 0);
  const receiptQueries = testContext.recordedQueries.filter(q => q.table === 'podologie_empfangsnachweise');
  assert.equal(receiptQueries.length, 0);
});
