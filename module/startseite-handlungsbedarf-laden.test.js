import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { ladeHandlungsbedarfInput } from './startseite-handlungsbedarf-laden.js';
import { berechneHandlungsbedarf } from './startseite-handlungsbedarf.js';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = id(1), patient = id(2);
const scope = () => ({ rolle: 'owner', uid: owner, ownerId: owner, umfang: 'mandant', vollstaendig: true });
const rx = (n = 10, extra = {}) => ({ id: id(n), owner_id: owner, patient_id: patient, status: 'confirmed', abrechnung_status: null, rezeptart: 'kassen', rezept_typ: 'standard', is_blanko: false, is_lhb_bvb: false, therapie_bereich: 'podo', ausstellungsdatum: '2026-10-01', is_dringend: false, behandlungsbeginn: null, anzahl_einheiten: 6, ...extra });
const beh = (n = 20, extra = {}) => ({ id: id(n), owner_id: owner, verordnung_id: id(10), behandlungsdatum: '2026-10-01', hpnr_codes: ['78010'], storniert_am: null, ...extra });
const booking = (n = 30, extra = {}) => ({ id: id(n), owner_id: owner, verordnung_id: id(10), start_time: '2026-10-28T09:00:00Z', status: 'confirmed', no_show: false, ...extra });
const session = (n = 40, extra = {}) => ({ id: id(n), prescription_id: id(10), booking_id: null, status: 'planned', done_at: null, heilmittel_index: 0, prescriptions: { id: id(10), owner_id: owner }, ...extra });

// Closed in-memory transport: no fetch fallback, only four known tables and read operators.
function client(tables = {}, options = {}) {
  const calls = [];
  const allowed = new Set(['prescriptions', 'podologie_behandlungen', 'prescription_sessions', 'bookings']);
  return { calls, from(table) {
    assert.ok(allowed.has(table), `unexpected table ${table}`);
    const c = { table, filters: [], projection: '', limit: null, order: null, signal: null };
    const q = {
      select(v) { c.projection = v; return q; },
      eq(k, v) { c.filters.push(['eq', k, v]); return q; },
      in(k, v) { c.filters.push(['in', k, [...v]]); return q; },
      gt(k, v) { c.filters.push(['gt', k, v]); return q; },
      order(k, v) { c.order = [k, v]; return q; },
      limit(v) { c.limit = v; return q; },
      abortSignal(v) { c.signal = v; return q; },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          calls.push(structuredClone({ ...c, signal: null }));
          options.onCall?.(c, calls.length);
          const override = options.respond?.(c, calls.length);
          if (override) return override;
          let rows = [...(tables[table] || [])];
          for (const [op, key, value] of c.filters) rows = rows.filter(row => {
            const v = key === 'prescriptions.owner_id' ? row.prescriptions?.owner_id : row[key];
            return op === 'eq' ? v === value : op === 'in' ? value.includes(v) : v > value;
          });
          rows.sort((a, b) => a.id.localeCompare(b.id));
          return { data: rows.slice(0, Math.min(c.limit, options.cap || Infinity)), error: null };
        }).then(resolve, reject);
      },
    };
    return q;
  } };
}
const load = (sb, extra = {}) => ladeHandlungsbedarfInput({ supabase: sb, heute: '2026-10-27', scope: scope(), ...extra });
const calc = input => berechneHandlungsbedarf(input);

test('complete empty source permits known empty', async () => {
  const sb = client(); const r = await load(sb);
  assert.equal(calc(r).entwarnung, true);
  assert.deepEqual(r.verordnungen.daten, []);
  assert.equal(sb.calls.length, 1);
});

for (const bad of [null, { ...scope(), rolle: 'employee', uid: id(3) }, { ...scope(), rolle: 'admin' }, { ...scope(), uid: id(3) }, { ...scope(), ownerId: 'bad' }, { ...scope(), umfang: 'standort' }, { ...scope(), vollstaendig: false }, { ...scope(), umfang: 'patienten', patientIds: null }]) test(`invalid/unproven scope has zero reads ${JSON.stringify(bad)}`, async () => {
  const sb = client(); const r = await load(sb, { scope: bad });
  assert.equal(sb.calls.length, 0); assert.equal(r.verordnungen.vollstaendig, false);
  assert.equal(calc(r).entwarnung, false);
});
test('explicit complete patient-ID scope filters prescriptions before await', async () => {
  const sb = client({ prescriptions: [rx(), rx(11, { patient_id: id(99) })] });
  const r = await load(sb, { scope: { ...scope(), umfang: 'patienten', patientIds: [patient] } });
  assert.deepEqual(r.verordnungen.daten.map(v => v.id), [id(10)]);
  assert.ok(sb.calls.filter(c => c.table === 'prescriptions').every(c => c.filters.some(f => f[0] === 'in' && f[1] === 'patient_id' && f[2][0] === patient)));
});
test('complete empty patient scope performs no reads and permits known empty', async () => {
  const sb = client(); const r = await load(sb, { scope: { ...scope(), umfang: 'patienten', patientIds: [] } });
  assert.equal(sb.calls.length, 0); assert.equal(calc(r).entwarnung, true);
});
test('Podo actual controls stay in history, consume no units, future appointment linked by VO', async () => {
  const sb = client({ prescriptions: [rx()], podologie_behandlungen: [beh(), beh(21, { hpnr_codes: ['78510'], behandlungsdatum: '2026-10-27' })], bookings: [booking()] }, { cap: 1 });
  const r = await load(sb); const v = r.verordnungen.daten[0];
  assert.equal(v.bereich, 'podologie'); assert.equal(v.restbedarf, true);
  assert.equal(v.behandlungen.daten.length, 2); assert.equal(v.termine.daten[0].status, 'geplant');
  assert.equal(calc(r).kategorien.pauseVerpasst.anzahl, 0);
  assert.equal(calc(r).kategorien.ohneFolgetermin.anzahl, 0);
});
test('Podo remaining units count actual history only, not undocumented old bookings', async () => {
  const sb = client({ prescriptions: [rx(10, { anzahl_einheiten: 1 })], bookings: [booking(30, { start_time: '2026-10-01T09:00:00Z' })] });
  assert.equal((await load(sb)).verordnungen.daten[0].restbedarf, true);
});
test('Podo exhausted/storno/legacy-HPNR histories preserve existing quantity semantics', async () => {
  const sb = client({ prescriptions: [rx(10, { anzahl_einheiten: 1 })], podologie_behandlungen: [beh(20, { hpnr_codes: null }), beh(21, { storniert_am: '2026-10-02T10:00:00Z' })] });
  assert.equal((await load(sb)).verordnungen.daten[0].restbedarf, false);
});
for (const amount of [null, '', '6', -1, 0, 1.2]) test(`unproven prescribed amount ${JSON.stringify(amount)} stays null`, async () => {
  const r = await load(client({ prescriptions: [rx(10, { anzahl_einheiten: amount })] }));
  assert.equal(r.verordnungen.daten[0].restbedarf, null);
});
test('Physio/Ergo/Logo use session parent and booking-ID, never infer remaining combination units', async () => {
  for (const [raw, area] of [['physio', 'physiotherapie'], ['ergo', 'ergotherapie'], ['stimme', 'logopaedie']]) {
    const sb = client({ prescriptions: [rx(10, { therapie_bereich: raw })], prescription_sessions: [session(40, { status: 'done', done_at: '2026-10-26T23:30:00Z' }), session(41, { booking_id: id(30), heilmittel_index: 1 })], bookings: [booking(30, { verordnung_id: null })] });
    const r = await load(sb), v = r.verordnungen.daten[0];
    assert.equal(v.bereich, area); assert.equal(v.restbedarf, null);
    assert.deepEqual(v.behandlungen.daten, [{ behandlungsdatum: '2026-10-27', storniert_am: null }]);
    assert.equal(v.termine.daten[0].status, 'geplant');
    const calls = sb.calls.filter(c => c.table === 'prescription_sessions');
    assert.ok(calls.every(c => c.filters.some(f => f[1] === 'prescriptions.owner_id' && f[2] === owner)));
    assert.ok(calls.every(c => c.projection.includes('heilmittel_index') && !c.projection.includes('planned_date')));
    assert.ok(sb.calls.filter(c => c.table === 'bookings').every(c => c.filters.some(f => f[1] === 'id')));
  }
});
for (const status of ['completed', 'billed', 'cancelled']) test(`processing terminal ${status} excluded`, async () => {
  const r = await load(client({ prescriptions: [rx(10, { status })] })); assert.equal(calc(r).entwarnung, true);
});
for (const abrechnung_status of ['in_abrechnung', 'gesendet', 'accepted', 'paid', 'storniert', 'archiviert']) test(`billing terminal ${abrechnung_status} excluded despite confirmed`, async () => {
  const sb = client({ prescriptions: [rx(10, { abrechnung_status })] });
  assert.equal(calc(await load(sb)).entwarnung, true); assert.equal(sb.calls.length, 2);
});
for (const extra of [{ status: 'parsed' }, { status: 'wild' }, { status: 'constructor' }, { abrechnung_status: 'wild' }, { therapie_bereich: null }, { rezeptart: 'wild' }, { rezept_typ: 'blanko' }, { is_blanko: true }, { is_lhb_bvb: true }, { is_lhb_bvb: null }]) test(`unproven applicability cannot imply all-clear ${JSON.stringify(extra)}`, async () => {
  const r = await load(client({ prescriptions: [rx(10, extra)] })); assert.equal(calc(r).entwarnung, false); assert.equal(r.verordnungen.vollstaendig, false);
});
test('known non-GKV/unsupported nutrition excluded, legacy NULL payer remains GKV', async () => {
  const sb = client({ prescriptions: [rx(10, { rezeptart: null }), rx(11, { rezeptart: 'privat' }), rx(12, { rezeptart: 'selbstzahler' }), rx(13, { rezeptart: 'bg' }), rx(14, { therapie_bereich: 'ernaehrung' })] });
  const r = await load(sb); assert.deepEqual(r.verordnungen.daten.map(v => v.id), [id(10)]);
});
for (const status of ['cancelled', 'no_show', 'completed']) test(`booking ${status} is no planned follow-up`, async () => {
  const sb = client({ prescriptions: [rx(10, { behandlungsbeginn: '2026-10-01' })], bookings: [booking(30, { status })] });
  assert.equal(calc(await load(sb)).kategorien.ohneFolgetermin.anzahl, 1);
});
test('no_show flag, pending, malformed booking, missing referenced booking remain safe', async () => {
  const sb = client({ prescriptions: [rx(10, { behandlungsbeginn: '2026-10-01' })], bookings: [booking(30, { no_show: true })] });
  assert.equal(calc(await load(sb)).kategorien.ohneFolgetermin.anzahl, 1);
  for (const extra of [{ status: 'pending' }, { start_time: 'bad' }, { status: 'wild' }, { no_show: null }]) {
    const r = await load(client({ prescriptions: [rx()], bookings: [booking(30, extra)] }));
    assert.equal(r.verordnungen.daten[0].termine.vollstaendig, false); assert.equal(calc(r).entwarnung, false);
  }
  const r = await load(client({ prescriptions: [rx(10, { therapie_bereich: 'physio' })], prescription_sessions: [session(40, { booking_id: id(30) })] }));
  assert.equal(r.verordnungen.daten[0].termine.vollstaendig, false);
});
for (const extra of [{ behandlungsdatum: '2026-10-28' }, { behandlungsdatum: '2026-02-30' }, { storniert_am: 'bad' }, { hpnr_codes: [42] }]) test(`invalid treatment is not evidence of absent/begun history ${JSON.stringify(extra)}`, async () => {
  const r = await load(client({ prescriptions: [rx()], podologie_behandlungen: [beh(20, extra)] }));
  assert.equal(r.verordnungen.daten[0].behandlungen.vollstaendig, false);
  assert.equal(r.verordnungen.daten[0].restbedarf, null); assert.equal(calc(r).kategorien.beginnBald.anzahl, null);
});
test('malformed/future done_at or contradictory non-done session stays unknown', async () => {
  for (const extra of [{ status: 'done', done_at: null }, { status: 'done', done_at: '2026-10-28T08:00:00Z' }, { status: 'planned', done_at: '2026-10-20T10:00:00Z' }, { status: 'wild' }]) {
    const r = await load(client({ prescriptions: [rx(10, { therapie_bereich: 'physio' })], prescription_sessions: [session(40, extra)] }));
    assert.equal(r.verordnungen.daten[0].behandlungen.vollstaendig, false);
  }
});
test('every page has Owner filter, stable cursor and explicit projection; page-cap 1 reads to empty', async () => {
  const sb = client({ prescriptions: [rx(), rx(11)], podologie_behandlungen: [beh(), beh(21)] }, { cap: 1 });
  await load(sb);
  for (const c of sb.calls) {
    assert.deepEqual(c.order, ['id', { ascending: true }]); assert.equal(c.limit, 200);
    assert.ok(c.filters.some(f => f[0] === 'eq' && ['owner_id', 'prescriptions.owner_id'].includes(f[1]) && f[2] === owner));
    assert.ok(!/\*|patient_name|diagnose|notizen|signature|zuzahlung|image|notes/.test(c.projection));
  }
  assert.equal(sb.calls.filter(c => c.table === 'prescriptions').length, 3);
  assert.equal(sb.calls.filter(c => c.table === 'podologie_behandlungen').length, 3);
});
test('more than 200 VO and session booking IDs get bounded independently paginated chunks', async () => {
  const prescriptions = Array.from({ length: 201 }, (_, n) => rx(100 + n, { therapie_bereich: 'physio' }));
  const sessions = prescriptions.map((p, n) => session(500 + n, { prescription_id: p.id, booking_id: id(900 + n), prescriptions: { id: p.id, owner_id: owner } }));
  const bookings = prescriptions.map((p, n) => booking(900 + n, { verordnung_id: null }));
  const sb = client({ prescriptions, prescription_sessions: sessions, bookings }, { cap: 97 });
  const r = await load(sb); assert.equal(r.verordnungen.daten.length, 201); assert.equal(r.verordnungen.vollstaendig, true);
  assert.ok(r.verordnungen.daten.every(v => v.termine.vollstaendig && v.termine.daten.length === 1));
  assert.ok(sb.calls.flatMap(c => c.filters).filter(f => f[0] === 'in').every(f => f[2].length <= 200));
});
test('later page error retains independent confirmed positives and marks affected source incomplete', async () => {
  const sb = client({ prescriptions: [rx(), rx(11)] }, { cap: 1, respond(c) {
    if (c.table === 'prescriptions' && c.filters.some(f => f[0] === 'gt')) return { data: null, error: { message: 'RAW_PRIVATE_ERROR' } };
  } });
  const r = await load(sb); assert.equal(r.verordnungen.daten.length, 1); assert.equal(r.verordnungen.vollstaendig, false);
  const k = calc({ ...r, heute: '2026-10-30' }).kategorien.beginnVerpasst;
  assert.equal(k.bekanntAnzahl, 1); assert.equal(k.anzahl, null); assert.ok(!JSON.stringify(r).includes('RAW_PRIVATE_ERROR'));
});
test('dependent source failure never becomes known empty; other sources stay usable', async () => {
  const sb = client({ prescriptions: [rx()], bookings: [booking()] }, { respond(c) {
    if (c.table === 'podologie_behandlungen') return { data: null, error: {} };
  } });
  const v = (await load(sb)).verordnungen.daten[0];
  assert.equal(v.behandlungen.vollstaendig, false); assert.equal(v.termine.vollstaendig, true); assert.equal(v.restbedarf, null);
});
test('foreign Owner, wrong parent, wrong ID scope and nonprogressing pages are rejected', async () => {
  for (const [table, row] of [['prescriptions', rx(10, { owner_id: id(999) })], ['podologie_behandlungen', beh(20, { verordnung_id: id(999) })], ['prescription_sessions', session(40, { prescriptions: { id: id(10), owner_id: id(999) } })], ['bookings', booking(30, { owner_id: id(999) })]]) {
    const sb = client({ prescriptions: [rx(10, { therapie_bereich: table === 'prescription_sessions' ? 'physio' : 'podo' })] }, { respond(c) {
      if (c.table === table) return { data: [row], error: null };
    } });
    const r = await load(sb); assert.equal(calc(r).entwarnung, false);
    assert.ok(!JSON.stringify(r).includes(id(999)));
    if (table === 'prescriptions') assert.equal(r.verordnungen.vollstaendig, false);
    else assert.equal(r.verordnungen.daten[0][table === 'bookings' ? 'termine' : 'behandlungen'].vollstaendig, false);
  }
  const sb = client({}, { respond: () => ({ data: [rx()], error: null }) });
  assert.equal((await load(sb)).verordnungen.vollstaendig, false); assert.ok(sb.calls.length < 10);
});
test('abort and stale scope before/after read return no old records; abort signal reaches transport', async () => {
  const ac = new AbortController(); ac.abort(); const sb = client();
  assert.equal((await load(sb, { signal: ac.signal })).verordnungen.vollstaendig, false); assert.equal(sb.calls.length, 0);
  let current = true; const sc = client({ prescriptions: [rx()] }, { onCall() { current = false; } });
  const r = await load(sc, { istAktuell: () => current }); assert.deepEqual(r.verordnungen.daten, []); assert.equal(r.verordnungen.vollstaendig, false); assert.equal(sc.calls.length, 1);
  const ac2 = new AbortController(); const sd = client({}, { onCall(c) { assert.equal(c.signal, ac2.signal); } });
  await load(sd, { signal: ac2.signal });
});
test('scope snapshot cannot be widened by mutation during awaits; no arbitrary fields escape', async () => {
  const s = { ...scope(), umfang: 'patienten', patientIds: [patient] };
  const sb = client({ prescriptions: [rx(10, { patient_name: 'PRIVATE_NAME' })] }, { onCall() { s.ownerId = id(999); s.patientIds.push(id(999)); } });
  const r = await load(sb, { scope: s });
  assert.ok(!JSON.stringify(r).includes('PRIVATE_NAME')); assert.ok(!JSON.stringify(r).includes(id(999)));
  assert.ok(sb.calls.every(c => c.filters.some(f => f[0] === 'eq' && f[2] === owner)));
});
test('invalid calendar day rejects before any source call', async () => {
  const sb = client(); await assert.rejects(load(sb, { heute: '2026-02-30' }), TypeError); assert.equal(sb.calls.length, 0);
});

test('real Supabase builder emits Owner/parent/ID/keyset filters through closed synthetic fetch', async () => {
  const calls = [], violations = [];
  const fetch = async (input, init) => {
    try {
      const url = new URL(typeof input === 'string' ? input : input.url);
      assert.equal(url.origin, 'https://synthetic.invalid');
      assert.equal(init?.method || 'GET', 'GET');
      assert.ok(url.pathname.startsWith('/rest/v1/'));
      const table = url.pathname.slice('/rest/v1/'.length), params = url.searchParams;
      assert.ok(['prescriptions', 'prescription_sessions', 'bookings'].includes(table));
      assert.equal(params.get('limit'), '200'); assert.equal(params.get('order'), 'id.asc');
      assert.equal(params.get(table === 'prescription_sessions' ? 'prescriptions.owner_id' : 'owner_id'), `eq.${owner}`);
      calls.push({ table, params });
      let rows = [];
      if (!params.has('id') || !params.get('id').startsWith('gt.')) {
        if (table === 'prescriptions') {
          assert.ok(params.get('select').split(',').includes('is_lhb_bvb'));
          rows = [rx(10, { therapie_bereich: 'physio' })];
        }
        if (table === 'prescription_sessions') {
          assert.equal(params.get('prescription_id'), `in.(${id(10)})`);
          assert.ok(params.get('select').includes('prescriptions!inner(id,owner_id)'));
          rows = [session(40, { booking_id: id(30) })];
        }
        if (table === 'bookings') {
          // ID IN is retained beside cursor GT on subsequent pages (getAll).
          assert.ok(params.getAll('id').includes(`in.(${id(30)})`));
          rows = [booking(30, { verordnung_id: null })];
        }
      }
      // Both constraints may be present; any gt cursor means empty final page.
      if (params.getAll('id').some(v => v.startsWith('gt.'))) rows = [];
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (e) { violations.push(e); throw e; }
  };
  const sb = createClient('https://synthetic.invalid', 'synthetic-anon', { global: { fetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const r = await load(sb);
  assert.deepEqual(violations, []); assert.equal(calls.length, 6);
  assert.equal(r.verordnungen.vollstaendig, true);
  assert.equal(r.verordnungen.daten[0].termine.vollstaendig, true);
  assert.equal(r.verordnungen.daten[0].termine.daten.length, 1);
});
