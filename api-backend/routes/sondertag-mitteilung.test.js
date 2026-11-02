import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-test-key';
const { ladeLage, sendeLauf, createSondertagMitteilungRouter } = await import('./sondertag-mitteilung.js');
const { MITTEILUNG_OPTION_TEXT } = await import('../lib/sondertag-mitteilung.js');

const T = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const JA = `Kopf\n[X] ${MITTEILUNG_OPTION_TEXT}: JA`;

/** Minimaler PostgREST-Fake: Tabellen als Arrays, eq/in/gte/lte als Filter; merkt sich jede Abfrage. */
function fakeDb(tabellen) {
  const log = [];
  return {
    log,
    from(name) {
      const f = [];
      const eintrag = { name, filter: f };
      log.push(eintrag);
      const b = {
        select() { return b; },
        eq(k, v) { f.push(r => r[k] === v); eintrag[`eq:${k}`] = v; return b; },
        in(k, v) { f.push(r => v.includes(r[k])); return b; },
        gte(k, v) { f.push(r => String(r[k]) >= v); return b; },
        lte(k, v) { f.push(r => String(r[k]) <= v); return b; },
        maybeSingle() { const d = (tabellen[name] || []).filter(r => f.every(x => x(r))); return Promise.resolve({ data: d[0] || null, error: null }); },
        then(ok, fehl) { const d = (tabellen[name] || []).filter(r => f.every(x => x(r))); return Promise.resolve({ data: d, error: null }).then(ok, fehl); },
      };
      return b;
    },
  };
}

const basis = () => ({
  custom_days: [
    { id: 'd1', owner_id: T, date: '2026-12-24', type: 'closed', start_time: null, end_time: null, business_id: null },
    { id: 'dx', owner_id: 'fremd', date: '2026-12-24', type: 'closed', start_time: null, end_time: null, business_id: null },
  ],
  bookings: [
    { id: 'b1', owner_id: T, start_time: '2026-12-24T09:00:00Z', status: 'confirmed', lead_id: 'l1', customer_name: 'A', customer_phone: '1' },
    { id: 'b2', owner_id: T, start_time: '2026-12-24T10:00:00Z', status: 'confirmed', lead_id: 'l2', customer_name: 'B', customer_phone: '2' },
    { id: 'bf', owner_id: 'fremd', start_time: '2026-12-24T09:00:00Z', status: 'confirmed', lead_id: 'lf' },
  ],
  leads: [
    { id: 'l1', owner_id: T, email: 'a@b.de' }, { id: 'l2', owner_id: T, email: 'b@b.de' }, { id: 'lf', owner_id: 'fremd', email: 'f@f.de' },
  ],
  patient_consents: [
    { patient_id: 'l1', owner_id: T, consent_type: 'datenschutz', text_version: 'datenschutz-v6-2026-11-05', text_snapshot: JA, consented_at: '2026-11-01', revoked_at: null },
    { patient_id: 'l2', owner_id: T, consent_type: 'datenschutz', text_version: 'datenschutz-v5-2026-10-30', text_snapshot: JA, consented_at: '2026-11-01', revoked_at: null },
  ],
  termin_mitteilungen: [],
  profiles: [{ id: T, business_name: 'Physio Test', phone: '0221', b2b_from_email: null }],
});

const jetzt = new Date('2026-12-01T00:00:00Z');

// Echter HTTP-Router inklusive requireAuth; ausschließlich synthetische Auth/DB und Stub-Mail.
test('HTTP: Auth, Mandant, Eingaben und getrennte Rate-Limits', async t => {
  const { default: express } = await import('express');
  const { createServer } = await import('node:http');
  const originalFetch = globalThis.fetch;
  const employee = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const inactive = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const other = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  let authCalls = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url || String(input));
    assert.equal(url.origin, 'http://127.0.0.1:9', 'Kein externer Auth-Aufruf erlaubt');
    const token = new Headers(init?.headers || input.headers).get('authorization')?.replace('Bearer ', '');
    if (url.pathname === '/auth/v1/user') {
      authCalls++;
      if (token === 'invalid') return Response.json({ message: 'invalid token' }, { status: 401 });
      return Response.json({ id: token === 'owner' ? T : token === 'inactive' ? inactive : token === 'other' ? other : employee });
    }
    assert.equal(url.pathname, '/rest/v1/profiles');
    const id = url.searchParams.get('id').replace('eq.', '');
    return Response.json({ id, role: [T, other].includes(id) ? 'owner' : 'employee',
      owner_id: T, is_active: id !== inactive, plan_status: 'active' });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  async function harness() {
    const tables = basis();
    tables.bookings[0].id = ID1;
    const db = schreibDb(tables);
    const tr = transport();
    const queries = [];
    const from = db.from.bind(db);
    db.from = name => {
      const q = from(name); const eq = q.eq;
      q.eq = (key, value) => { queries.push({ name, key, value }); return eq(key, value); };
      return q;
    };
    const app = express(); app.use(express.json());
    app.use('/api', createSondertagMitteilungRouter({ supabase: db, transportFabrik: tr.fabrik,
      env: { SMTP_HOST: 'synthetic.invalid' }, kutu: () => true, jetzt: () => jetzt }));
    const server = createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve()); server.closeAllConnections();
    }));
    return { db, tr, queries, post: async (route, body = {}, token = 'owner') => {
      const response = await originalFetch(`http://127.0.0.1:${server.address().port}/api/sondertag/mitteilung/${route}`, {
        method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    } };
  }
  const period = { von: '2026-12-24', bis: '2026-12-24' };
  await t.test('fehlendes Token und Query-Token werden vor DB abgewiesen', async () => {
    const h = await harness(); const before = authCalls;
    assert.equal((await h.post('vorschau', period, null)).status, 401);
    assert.equal((await h.post('senden?token=owner', { ...period, bookingIds: [ID1] }, null)).status, 401);
    assert.equal(authCalls, before); assert.equal(h.queries.length, 0); assert.equal(h.tr.log.length, 0);
  });
  await t.test('ungültiges Token und deaktivierter Mitarbeiter gesperrt', async () => {
    const h = await harness();
    assert.equal((await h.post('vorschau', period, 'invalid')).status, 401);
    assert.equal((await h.post('senden', { ...period, bookingIds: [ID1] }, 'inactive')).status, 403);
    assert.equal(h.queries.length, 0); assert.equal(h.tr.log.length, 0);
  });
  await t.test('Mitarbeiter verwendet Owner-Mandant; Body kann Mandant und Empfänger nicht ersetzen', async () => {
    const h = await harness();
    const preview = await h.post('vorschau', { ...period, tenantId: 'fremd' }, 'employee');
    assert.equal(preview.status, 200); assert.deepEqual(preview.body.mail.map(x => x.bookingId), [ID1]);
    const result = await h.post('senden', { ...period, bookingIds: [ID1], tenantId: 'fremd', email: 'attacker@example.invalid' }, 'employee');
    assert.equal(result.status, 200); assert.equal(result.body.gesendet, 1);
    assert.equal(h.tr.log[0].to, 'a@b.de');
    assert.equal(h.db.tabellen.termin_mitteilungen[0].owner_id, T);
    assert.equal(h.db.tabellen.termin_mitteilungen[0].freigegeben_von, employee);
    assert.ok(h.queries.filter(q => q.key === 'owner_id').every(q => q.value === T));
  });
  await t.test('fremde Buchungs-ID bewirkt keinen Versand', async () => {
    const h = await harness();
    const r = await h.post('senden', { ...period, bookingIds: ['22222222-2222-4222-8222-222222222222'] });
    assert.equal(r.status, 200); assert.equal(r.body.abgelehnt, 1); assert.equal(h.tr.log.length, 0);
  });
  await t.test('ungültige IDs, leere/zu große Liste und Zeitraum liefern 400', async () => {
    for (const bookingIds of [[], ['invalid'], Array(201).fill(ID1), 'invalid']) {
      const h = await harness();
      assert.equal((await h.post('senden', { ...period, bookingIds })).status, 400);
      assert.equal(h.queries.length, 0); assert.equal(h.tr.log.length, 0);
    }
    const h = await harness();
    assert.equal((await h.post('vorschau', { von: 'invalid' })).status, 400);
    assert.equal((await h.post('senden', { von: 'invalid', bookingIds: [ID1] })).status, 400);
  });
  await t.test('Senden: vierter Lauf desselben Mandanten liefert 429; Vorschau bleibt nutzbar', async () => {
    const h = await harness();
    for (const token of ['owner', 'employee', 'owner'])
      assert.equal((await h.post('senden', { ...period, bookingIds: [ID1] }, token)).status, 200);
    assert.equal((await h.post('senden', { ...period, bookingIds: [ID1] }, 'employee')).status, 429);
    assert.equal(h.tr.log.length, 1);
    assert.equal((await h.post('vorschau', period)).status, 200);
  });
  await t.test('Vorschau: Request 31 liefert 429; anderer Mandant hat eigenen Zähler', async () => {
    const h = await harness();
    for (let i = 0; i < 30; i++) assert.equal((await h.post('vorschau', period)).status, 200);
    assert.equal((await h.post('vorschau', period)).status, 429);
    assert.equal((await h.post('vorschau', period, 'other')).status, 200);
    assert.equal(h.tr.log.length, 0);
  });
});

test('Lage: nur eigener Mandant; v6 -> Mail, v5 -> Anrufliste; Box mit SMTP', async () => {
  const db = fakeDb(basis());
  const lage = await ladeLage(db, T, '2026-12-24', '2026-12-24', { env: { SMTP_HOST: 'smtp.x' }, kutu: true, jetzt });
  assert.equal(lage.weg, 'smtp');
  assert.deepEqual(lage.mail.map(x => [x.termin.id, x.email]), [['b1', 'a@b.de']]);
  assert.deepEqual(lage.anruf.map(x => [x.termin.id, x.grund]), [['b2', 'keine_einwilligung']]);
  for (const q of db.log.filter(q => ['custom_days', 'bookings', 'leads', 'patient_consents', 'termin_mitteilungen'].includes(q.name))) {
    assert.equal(q['eq:owner_id'], T, `${q.name} ohne Mandantenfilter`);
  }
});

test('Lage: SaaS ohne verbundenes Gmail -> kein Versandweg, alle auf die Anrufliste', async () => {
  const lage = await ladeLage(fakeDb(basis()), T, '2026-12-24', '2026-12-24', { env: {}, kutu: false, jetzt });
  assert.equal(lage.weg, null);
  assert.equal(lage.mail.length, 0);
  assert.ok(lage.anruf.every(x => ['versand_nicht_eingerichtet', 'keine_einwilligung'].includes(x.grund)));
});

test('Lage: SaaS mit Gmail -> Weg gmail', async () => {
  const d = basis(); d.profiles[0].b2b_from_email = 'praxis@gmail.com';
  const lage = await ladeLage(fakeDb(d), T, '2026-12-24', '2026-12-24', { env: {}, kutu: false, jetzt });
  assert.equal(lage.weg, 'gmail');
  assert.equal(lage.mail.length, 1);
});

test('Lage: bereits gesendet -> nicht erneut; fehler-Zeile -> wieder versendbar', async () => {
  const d = basis();
  d.termin_mitteilungen = [{ owner_id: T, booking_id: 'b1', anlass: 'sondertag_geschlossen', termin_beginn: '2026-12-24T09:00:00Z', status: 'gesendet' }];
  let lage = await ladeLage(fakeDb(d), T, '2026-12-24', '2026-12-24', { env: { SMTP_HOST: 'x' }, kutu: true, jetzt });
  assert.deepEqual(lage.schon.map(x => x.termin.id), ['b1']);
  assert.equal(lage.mail.length, 0);
  d.termin_mitteilungen[0].status = 'fehler';
  d.termin_mitteilungen[0].fehler_code = 'ECONNREFUSED';
  lage = await ladeLage(fakeDb(d), T, '2026-12-24', '2026-12-24', { env: { SMTP_HOST: 'x' }, kutu: true, jetzt });
  assert.deepEqual(lage.mail.map(x => x.termin.id), ['b1']);
});

test('Lage: ohne eingetragenen geschlossenen Sondertag nichts betroffen (frei gewaehltes von/bis reicht nicht)', async () => {
  const lage = await ladeLage(fakeDb(basis()), T, '2026-12-23', '2026-12-23', { env: { SMTP_HOST: 'x' }, kutu: true, jetzt });
  assert.equal(lage.mail.length + lage.anruf.length, 0);
});

test('Lage: ungueltiger Zeitraum -> 400', async () => {
  const lage = await ladeLage(fakeDb(basis()), T, 'kaputt', 'kaputt', { env: {}, kutu: true, jetzt });
  assert.equal(lage.status, 400);
});

// ── POST /senden als sendeLauf (Review 02.11.: Reservierung, Transportfehler, Dedup) ───────────────────────
/** Fake mit Schreiben: insert (UNIQUE booking_id+anlass+termin_beginn), update(...).eq/neq.select().maybeSingle(),
 *  select count head. updateFehler: Set von Status-Werten, bei deren Update die DB einen Fehler liefert. */
function schreibDb(tabellen, { updateFehler = new Set() } = {}) {
  let n = 0;
  return {
    tabellen,
    from(name) {
      const f = [];
      let op = 'select'; let wert = null; let head = false;
      const rows = () => (tabellen[name] ||= []);
      const treffer = () => rows().filter(r => f.every(x => x(r)));
      const b = {
        select(_c, opt) { if (opt?.head) head = true; return b; },
        eq(k, v) { f.push(r => r[k] === v); return b; },
        neq(k, v) { f.push(r => r[k] !== v); return b; },
        in(k, v) { f.push(r => v.includes(r[k])); return b; },
        gte(k, v) { f.push(r => String(r[k]) >= v); return b; },
        lte(k, v) { f.push(r => String(r[k]) <= v); return b; },
        insert(w) { op = 'insert'; wert = w; return b; },
        update(w) { op = 'update'; wert = w; return b; },
        maybeSingle() { return b.ausfuehren(true); },
        then(ok, fehl) { return b.ausfuehren(false).then(ok, fehl); },
        async ausfuehren(einzeln) {
          if (op === 'insert') {
            const dup = rows().some(r => r.booking_id === wert.booking_id && r.anlass === wert.anlass && new Date(r.termin_beginn).getTime() === new Date(wert.termin_beginn).getTime());
            if (dup) return { data: null, error: { code: '23505' } };
            const z = { id: `m${++n}`, created_at: '2026-12-01T00:00:00Z', ...wert };
            rows().push(z);
            return { data: { id: z.id }, error: null };
          }
          if (op === 'update') {
            if (updateFehler.has(wert.status)) return { data: null, error: { code: 'DB_WRITE_FAILED' } };
            const t = treffer();
            t.forEach(r => Object.assign(r, wert));
            return { data: einzeln ? (t[0] ? { id: t[0].id } : null) : t, error: null };
          }
          if (head) return { count: treffer().length, error: null };
          const d = treffer();
          return { data: einzeln ? d[0] || null : d, error: null };
        },
      };
      return b;
    },
  };
}

const ID1 = '11111111-1111-4111-8111-111111111111';
const lageMit = (start = '2026-12-24T09:00:00Z') => ({
  weg: 'smtp', profil: { business_name: 'Physio Test', phone: '0221' },
  mail: [{ termin: { id: ID1, start_time: start }, tag: { id: 'd1' }, email: 'a@b.de' }],
});
const transport = (fehlerCode = null) => {
  const log = [];
  return { log, fabrik: () => ({ sendMail: async (m) => { log.push(m); if (fehlerCode) { const e = new Error('x'); e.code = fehlerCode; throw e; } } }) };
};
const still = async (fn) => { const e = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = e; } };
const lauf = (db, tr, extra = {}) => still(() => sendeLauf(db, { tenantId: T, userId: 'u1', ids: [ID1], lage: lageMit(extra.start), transportFabrik: tr.fabrik, jetzt, ...extra }));

test('Senden: Erfolg -> eine Mail, Zeile gesendet, Absender/Empfaenger aus Lage', async () => {
  const db = schreibDb({}); const tr = transport();
  const r = await lauf(db, tr);
  assert.equal(r.status, 200);
  assert.deepEqual({ ...r.body }, { gesendet: 1, fehler: 0, doppelt: 0, abgelehnt: 0, unklar: 0 });
  assert.equal(tr.log.length, 1);
  assert.equal(tr.log[0].to, 'a@b.de');
  assert.equal(db.tabellen.termin_mitteilungen[0].status, 'gesendet');
  assert.equal(db.tabellen.termin_mitteilungen[0].freigegeben_von, 'u1');
});

test('Senden: SMTP ECONNREFUSED + Fehler-Update scheitert -> 409, KEIN falscher Erfolg, Zeile bleibt IN_ARBEIT = unklar', async () => {
  const db = schreibDb({}, { updateFehler: new Set(['fehler']) }); const tr = transport('ECONNREFUSED');
  const r = await lauf(db, tr);
  assert.equal(r.status, 409);
  assert.equal(r.body.gesendet, 0);
  assert.equal(r.body.unklar, 1);
  const z = db.tabellen.termin_mitteilungen[0];
  assert.equal(z.status, 'fehler');
  assert.equal(z.fehler_code, 'IN_ARBEIT');
  // Naechste Vorschau: Anrufliste "Versandstatus unklar", nicht "bereits informiert", nicht erneut Mail
  const d = basis(); d.termin_mitteilungen = [{ owner_id: T, booking_id: 'b1', anlass: 'sondertag_geschlossen', termin_beginn: '2026-12-24T09:00:00Z', status: 'fehler', fehler_code: 'IN_ARBEIT' }];
  const lage = await ladeLage(fakeDb(d), T, '2026-12-24', '2026-12-24', { env: { SMTP_HOST: 'x' }, kutu: true, jetzt });
  assert.equal(lage.schon.length, 0);
  assert.deepEqual(lage.anruf.filter(x => x.termin.id === 'b1').map(x => x.grund), ['versand_unklar']);
  assert.ok(!lage.mail.some(x => x.termin.id === 'b1'));
});

test('Senden: Erfolgs-Update scheitert -> unklar gezaehlt, Zeile bleibt IN_ARBEIT (nie automatisch erneut)', async () => {
  const db = schreibDb({}, { updateFehler: new Set(['gesendet']) }); const tr = transport();
  const r = await lauf(db, tr);
  assert.equal(r.body.gesendet, 1);
  assert.equal(r.body.unklar, 1);
  assert.equal(db.tabellen.termin_mitteilungen[0].fehler_code, 'IN_ARBEIT');
  const tr2 = transport();
  const r2 = await lauf(db, tr2);
  assert.equal(r2.body.doppelt, 1);
  assert.equal(tr2.log.length, 0, 'IN_ARBEIT darf nicht uebernommen werden');
});

test('Senden: echter Fehler (kein Abbruch-Code) -> fehler_code gesetzt; spaeterer Lauf uebernimmt atomar und sendet', async () => {
  const db = schreibDb({}); const tr = transport('EENVELOPE');
  const r = await lauf(db, tr);
  assert.equal(r.status, 200);
  assert.equal(r.body.fehler, 1);
  assert.equal(db.tabellen.termin_mitteilungen[0].fehler_code, 'EENVELOPE');
  const tr2 = transport();
  const r2 = await lauf(db, tr2);
  assert.equal(r2.body.gesendet, 1);
  assert.equal(db.tabellen.termin_mitteilungen.length, 1);
  assert.equal(db.tabellen.termin_mitteilungen[0].status, 'gesendet');
});

test('Senden: bereits gesendet -> doppelt, kein Transport', async () => {
  const db = schreibDb({}); await lauf(db, transport());
  const tr = transport(); const r = await lauf(db, tr);
  assert.equal(r.body.doppelt, 1);
  assert.equal(tr.log.length, 0);
});

test('Senden: verschobener Termin (neuer Beginn) -> neue Zeile, neue Mail', async () => {
  const db = schreibDb({}); await lauf(db, transport());
  const tr = transport(); const r = await lauf(db, tr, { start: '2026-12-24T10:00:00Z' });
  assert.equal(r.body.gesendet, 1);
  assert.equal(db.tabellen.termin_mitteilungen.length, 2);
});

test('Senden: Tagesdeckel -> 429 ohne Versand; fremde/unzulaessige IDs -> abgelehnt', async () => {
  const voll = Array.from({ length: 500 }, (_, i) => ({ id: `x${i}`, owner_id: T, created_at: '2026-11-30T12:00:00Z', booking_id: `b${i}`, anlass: 'sondertag_geschlossen', termin_beginn: '2026-12-01T00:00:00Z', status: 'gesendet' }));
  const tr = transport();
  const r = await lauf(schreibDb({ termin_mitteilungen: voll }), tr);
  assert.equal(r.status, 429);
  assert.equal(tr.log.length, 0);
  const fremd = '22222222-2222-4222-8222-222222222222';
  const r2 = await still(() => sendeLauf(schreibDb({}), { tenantId: T, userId: 'u1', ids: [fremd], lage: lageMit(), transportFabrik: transport().fabrik, jetzt }));
  assert.equal(r2.body.abgelehnt, 1);
  assert.equal(r2.body.gesendet, 0);
});
