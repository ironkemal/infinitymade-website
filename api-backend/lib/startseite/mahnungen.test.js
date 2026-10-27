import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import express from 'express';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';
import { ladeMahnungen } from './mahnungen.js';
import { createFinanzlader } from './finanzadapter.js';

const id = n => `abcdef00-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tenantId = id(1), fremd = id(2), rezept = id(10), ausfall = id(11);
const jetzt = new Date('2026-10-27T10:00:00Z');
const mahnung = (n, extra = {}) => ({ id: id(100 + n), owner_id: tenantId,
  prescription_id: rezept, ausfallrechnung_id: null, level: 1, status: 'offen', ...extra });
const af = (extra = {}) => ({ id: ausfall, owner_id: tenantId, status: 'offen', amount_eur: '40.12', ...extra });
const rx = (extra = {}) => ({ id: rezept, owner_id: tenantId, therapie_bereich: 'physio', rezeptart: 'kassen',
  belegnummer: 'synthetic-beleg', abrechnung_id: null, zuzahlung_eur: '30.00', zuzahlung_befreit: false,
  zuzahlung_altsystem_eur: '5.00', zuzahlung_kassiert_am: null, ...extra });
const beleg = (extra = {}) => ({ id: id(300), owner_id: tenantId, prescription_id: rezept,
  type: 'zuzahlung', amount_eur: '10.00', ...extra });
const afMahnung = (n, extra = {}) => mahnung(n, { prescription_id: null, ausfallrechnung_id: ausfall, ...extra });

// Closed synthetic SDK surface: no client construction, env, sockets or fetch.
// Every executed page records its complete owner/projection/keyset contract.
function client(tables = {}, { cap = 1000, failure, ownerLeak = false } = {}) {
  const calls = [];
  const supabase = { from(table) {
    const state = { table, eq: [], gt: [], ins: [], orders: [] };
    const q = {
      select(columns) { state.columns = columns; return q; },
      eq(...args) { state.eq.push(args); return q; },
      gt(...args) { state.gt.push(args); return q; },
      in(...args) { state.ins.push(args); return q; },
      order(...args) { state.orders.push(args); return q; },
      async limit(limit) {
        calls.push({ ...state, limit });
        if (failure?.(state, calls)) return { data: null, error: { message: 'RAW synthetic patient secret' } };
        let rows = [...(tables[table] || [])];
        for (const [key, value] of state.eq) if (!ownerLeak || key !== 'owner_id') rows = rows.filter(r => r[key] === value);
        for (const [key, values] of state.ins) rows = rows.filter(r => values.includes(r[key]));
        for (const [key, value] of state.gt) rows = rows.filter(r => r[key] > value);
        rows.sort((a, b) => a.id.localeCompare(b.id));
        return { data: rows.slice(0, Math.min(cap, limit)), error: null };
      },
    };
    return q;
  } };
  return { supabase, calls };
}
async function run(tables = {}, options) {
  const c = client(tables, options);
  const result = await ladeMahnungen({ supabase: c.supabase, tenantId, jetzt });
  return { result, calls: c.calls };
}
const stufe = (result, n = 1) => result.stufen[n - 1];
const rest = (result, n = 1) => stufe(result, n).rest;
const leer = () => ({ scope: 'mandant', umfang: 'Bereits gemahnte Forderungen; höchste Stufe; aktueller belegter Rest',
  stufen: [1, 2, 3].map(stufe => ({ stufe, bekanntAnzahl: 0, anzahl: 0,
    rest: { bekanntCent: 0, gesamtCent: 0, unbekanntAnzahl: 0, gruende: [] } })), anomalien: [] });

test('Leer: echte drei Nullaggregate, ausschließlich Mahnhistorie bis leer', async () => {
  const { result, calls } = await run();
  assert.deepEqual(result, leer());
  assert.deepEqual(calls.map(c => c.table), ['mahnungen']);
});

test('Tenant UUID normalisiert; Client und gültige Date vor jedem Read validiert', async () => {
  const { supabase, calls } = client();
  for (const extra of [{ tenantId: 'invalid' }, { tenantId: null }, { jetzt: new Date(NaN) }, { jetzt: '2026-01-01' }, { supabase: {} }]) {
    await assert.rejects(ladeMahnungen({ supabase, tenantId, jetzt, ...extra }), TypeError);
  }
  assert.equal(calls.length, 0);
  await ladeMahnungen({ supabase, tenantId: tenantId.toUpperCase(), jetzt });
  assert.deepEqual(calls[0].eq, [['owner_id', tenantId]]);
});

test('Höchste Stufe einmal: Duplikate, Reihenfolge, niedrige Wiederholung; 30−5−10 = 1500', async () => {
  const history = [mahnung(1), mahnung(2, { level: 3 }), mahnung(3, { level: 3 }), mahnung(4, { level: 2 }), mahnung(5)];
  const tables = { mahnungen: history, prescriptions: [rx()], belegliste: [beleg()] };
  const { result, calls } = await run(tables);
  assert.equal(stufe(result, 3).anzahl, 1);
  assert.equal(rest(result, 3).gesamtCent, 1500);
  assert.equal(stufe(result).anzahl, 0);
  assert.equal(stufe(result, 2).anzahl, 0);
  assert.equal(calls.filter(c => c.table === 'prescriptions' && c.gt.length === 0).length, 1);
  assert.deepEqual((await run({ ...tables, mahnungen: history.toReversed().map((m, n) => ({ ...m, id: id(100 + n) })) })).result, result);
});

test('Gleiche UUID in verschiedenen Forderungsarten bleibt getrennt; FK UUID normalisiert', async () => {
  const { result } = await run({ mahnungen: [mahnung(1, { prescription_id: rezept.toUpperCase() }), afMahnung(2, { ausfallrechnung_id: rezept })],
    prescriptions: [rx()], ausfallrechnungen: [af({ id: rezept })] });
  assert.equal(stufe(result).anzahl, 2);
  assert.equal(rest(result).gesamtCent, 6512);
});

test('Höhere terminale Stufe ersetzt alte offene; kein Zahlungsbeweis und keine Restreads', async () => {
  for (const status of ['bezahlt', 'abgeschrieben']) {
    const { result, calls } = await run({ mahnungen: [mahnung(1), mahnung(2, { level: 2, status }), mahnung(3)] });
    assert.deepEqual(result, leer());
    assert.ok(calls.every(c => c.table === 'mahnungen'));
  }
});

test('Widersprüchliche höchste Status: Count und Sum Unknown, bekannte Teilwerte bleiben', async () => {
  for (const status of ['bezahlt', 'abgeschrieben']) {
    const { result, calls } = await run({ mahnungen: [mahnung(1), mahnung(2, { level: 3 }), mahnung(3, { level: 3, status }),
      afMahnung(4, { level: 3 })], ausfallrechnungen: [af()] });
    assert.deepEqual(stufe(result, 3), { stufe: 3, bekanntAnzahl: 1, anzahl: null,
      rest: { bekanntCent: 4012, gesamtCent: null, unbekanntAnzahl: 1, gruende: ['MAHNSTATUS_WIDERSPRUCH'] } });
    assert.equal(stufe(result).anzahl, 0);
    assert.ok(!calls.some(c => c.table === 'prescriptions'));
    assert.deepEqual(result.anomalien, [{ code: 'MAHNSTATUS_WIDERSPRUCH', anzahl: 1 }]);
  }
});

test('Defekte Herkunft, Status oder Stufe: fester Quellfehler statt vollständiger Null', async () => {
  for (const patch of [
    { prescription_id: null }, { ausfallrechnung_id: ausfall }, { prescription_id: 'RAW private name' },
    { level: 0 }, { level: 4 }, { level: '1' }, { level: null }, { status: 'RAW private status' }, { status: null },
  ]) {
    await assert.rejects(run({ mahnungen: [mahnung(1, patch)] }), { message: 'MAHNUNGEN_QUELLE_NICHT_VERFUEGBAR' });
  }
});

test('B03 Befreiung, Storno, Overpay, Unknown, Negativsaldo und Halbcent bleiben B03', async () => {
  const cases = [
    { patch: { zuzahlung_befreit: true }, belege: [], expected: 0, anomalie: true },
    { belege: [beleg(), beleg({ id: id(301), type: 'storno', amount_eur: '-4.00' })], expected: 1900 },
    { belege: [beleg({ amount_eur: '50.00' })], expected: 0, anomalie: true },
    { patch: { zuzahlung_eur: null }, belege: [], expected: null },
    { patch: { zuzahlung_altsystem_eur: 0 }, belege: [beleg({ type: 'storno', amount_eur: '-1.00' })], expected: null, anomalie: true },
    { patch: { zuzahlung_altsystem_eur: 0 }, belege: [beleg({ amount_eur: '29.995' })], expected: 0 },
  ];
  for (const c of cases) {
    const { result } = await run({ mahnungen: [mahnung(1)], prescriptions: [rx(c.patch)], belegliste: c.belege });
    assert.equal(rest(result).gesamtCent, c.expected);
    assert.equal(stufe(result).anzahl, 1);
    if (c.expected === null) assert.deepEqual(rest(result).gruende, ['B03_REST_UNBEKANNT']);
    if (c.anomalie) assert.ok(result.anomalien.some(a => a.code === 'B03_ANOMALIE'));
  }
});

function vkz(status) {
  const original = id(400), claim = id(401), ursprung = id(402);
  return { mahnungen: [mahnung(1)], prescriptions: [rx({ abrechnung_id: original, zuzahlung_altsystem_eur: 0 })],
    abrechnung: [
      { id: original, owner_id: tenantId, status: 'paid', betriebsart: 'echt', verarbeitungskennzeichen: '01', zuzahlungsforderung_ursprung_id: null },
      { id: claim, owner_id: tenantId, status, betriebsart: 'echt', verarbeitungskennzeichen: '03', zuzahlungsforderung_ursprung_id: ursprung },
    ], abrechnung_zeile: [
      { id: ursprung, owner_id: tenantId, abrechnung_id: original, prescription_id: rezept, belegnummer: 'synthetic-beleg', herkunft: 'einreichung', status: 'akzeptiert', zuzahlung_eur: 30, netto_eur: 900, absetzung_eur: 0, absetzung_am: null },
      { id: id(403), owner_id: tenantId, abrechnung_id: claim, prescription_id: rezept, belegnummer: 'synthetic-beleg', herkunft: 'einreichung', status: 'eingereicht', zuzahlung_eur: 0, netto_eur: 30, absetzung_eur: 0, absetzung_am: null },
    ] };
}

test('VKZ03 Entwurf bleibt Patient; übertragen/rejected erzeugen keinen neuen Patientenrest', async () => {
  for (const status of ['erstellt', 'heruntergeladen', 'gesendet', 'accepted', 'paid', 'rejected']) {
    const { result } = await run(vkz(status));
    const draft = ['erstellt', 'heruntergeladen'].includes(status);
    assert.equal(rest(result).gesamtCent, draft ? 3000 : null, status);
    assert.deepEqual(rest(result).gruende, draft ? [] : ['B03_REST_NICHT_ZUORDENBAR']);
  }
});

test('Fehlende Rezeptposten und Privat/BG bleiben unbekannt; doppelte Quell-IDs werfen', async () => {
  for (const prescriptions of [[], [rx({ rezeptart: 'privat' })], [rx({ rezeptart: 'bg' })]]) {
    const { result } = await run({ mahnungen: [mahnung(1)], prescriptions });
    assert.equal(rest(result).gesamtCent, null);
    assert.equal(rest(result).unbekanntAnzahl, 1);
    assert.ok(rest(result).gruende.length > 0);
  }
  await assert.rejects(run({ mahnungen: [mahnung(1)], prescriptions: [rx(), rx()] }), /ungültige Keyset-Seite/);
});

test('Podo braucht B03 Snapshot: ohne Snapshot Unknown, mit echtem Snapshot 1500', async () => {
  const tables = vkz('erstellt');
  tables.abrechnung = tables.abrechnung.slice(0, 1);
  tables.abrechnung_zeile = tables.abrechnung_zeile.slice(0, 1);
  tables.prescriptions = [rx({ therapie_bereich: 'podo', abrechnung_id: id(400) })];
  tables.belegliste = [beleg()];
  assert.equal(rest((await run(tables)).result).gesamtCent, 1500);
  tables.abrechnung_zeile = [];
  assert.equal(rest((await run(tables)).result).gesamtCent, null);
});

test('Ausfall: offen gespeicherter positiver Betrag; terminal Null; fehlend/ungültig Unknown', async () => {
  for (const status of ['offen', 'bezahlt', 'storniert', 'abgeschrieben']) {
    const { result, calls } = await run({ mahnungen: [afMahnung(1)], ausfallrechnungen: [af({ status })],
      belegliste: [beleg({ type: 'ausfall', amount_eur: 40.12, reference_text: ausfall })] });
    assert.equal(rest(result).gesamtCent, status === 'offen' ? 4012 : 0);
    assert.ok(calls.every(c => ['mahnungen', 'ausfallrechnungen'].includes(c.table)));
  }
  for (const amount_eur of [null, undefined, '', 'garbage', '1.001', 0, -1, Infinity, NaN, true]) {
    const { result } = await run({ mahnungen: [afMahnung(1)], ausfallrechnungen: [af({ amount_eur })] });
    assert.deepEqual(rest(result), { bekanntCent: 0, gesamtCent: null, unbekanntAnzahl: 1, gruende: ['AUSFALL_BETRAG_UNGUELTIG'] });
  }
  for (const rows of [[], [af({ status: 'fremd' })]]) {
    const { result } = await run({ mahnungen: [afMahnung(1)], ausfallrechnungen: rows });
    assert.equal(rest(result).gesamtCent, null);
  }
});

test('Known Teilwerte, Stufenlokalität, feste Gründe sortiert; keine Personen/IDs/Freitexte', async () => {
  const { result } = await run({ mahnungen: [mahnung(1), afMahnung(2), afMahnung(3, { ausfallrechnung_id: id(12), level: 2 })],
    prescriptions: [rx({ zuzahlung_eur: null, name: 'RAW synthetic patient' })],
    ausfallrechnungen: [af({ amount_eur: 'bad', notes: 'RAW private note' }), af({ id: id(12) })] });
  assert.deepEqual(rest(result).gruende, ['AUSFALL_BETRAG_UNGUELTIG', 'B03_REST_UNBEKANNT']);
  assert.equal(rest(result).unbekanntAnzahl, 2);
  assert.equal(stufe(result).bekanntAnzahl, 2);
  assert.equal(rest(result, 2).gesamtCent, 4012);
  const json = JSON.stringify(result);
  for (const value of [tenantId, rezept, ausfall, 'RAW', 'synthetic patient', 'private note', 'owner_id', 'prescription_id']) assert.ok(!json.includes(value));
});

test('Owner-Keyset: >1000, cap1, volle Seite; Filter/Projektion auf jeder Seite bis leer', async () => {
  for (const [count, cap] of [[1001, 1000], [3, 1], [1000, 1000]]) {
    const { result, calls } = await run({ mahnungen: Array.from({ length: count }, (_, n) => afMahnung(n)), ausfallrechnungen: [af()] }, { cap });
    assert.equal(stufe(result).anzahl, 1);
    const mh = calls.filter(c => c.table === 'mahnungen');
    assert.equal(mh.length, Math.ceil(count / cap) + 1);
    for (const c of calls) {
      assert.deepEqual(c.eq, [['owner_id', tenantId]]);
      assert.equal(c.limit, 1000);
      assert.deepEqual(c.orders, [['id', { ascending: true }]]);
      assert.equal(c.columns, c.table === 'mahnungen' ? 'id,owner_id,prescription_id,ausfallrechnung_id,level,status' : 'id,owner_id,status,amount_eur');
    }
    assert.equal(mh[0].gt.length, 0);
    assert.ok(mh.slice(1).every(c => c.gt.length === 1));
  }
});

test('Fremdowner und Folgeseitenfehler werfen, auch leere Schlussseite; keine Teilantwort', async () => {
  await assert.rejects(run({ mahnungen: [mahnung(1, { owner_id: fremd })] }, { ownerLeak: true }));
  await assert.rejects(run({ mahnungen: [afMahnung(1)], ausfallrechnungen: [af({ owner_id: fremd })] }, { ownerLeak: true }));
  for (const table of ['mahnungen', 'ausfallrechnungen', 'prescriptions']) {
    const tables = { mahnungen: [mahnung(1), afMahnung(2)], prescriptions: [rx()], ausfallrechnungen: [af()] };
    await assert.rejects(run(tables, { cap: 1, failure: s => s.table === table && s.gt.length > 0 }));
  }
});

test('Exakte sichere Centgrenze; Einzel- und Summenüberlauf werfen', async () => {
  const base = { mahnungen: [afMahnung(1)], ausfallrechnungen: [af({ amount_eur: '90071992547409.91' })] };
  assert.equal(rest((await run(base)).result).gesamtCent, Number.MAX_SAFE_INTEGER);
  assert.equal(rest((await run({ mahnungen: [afMahnung(1)], ausfallrechnungen: [af({ amount_eur: '0.29' })] })).result).gesamtCent, 29);
  await assert.rejects(run({ ...base, ausfallrechnungen: [af({ amount_eur: '90071992547409.92' })] }), RangeError);
  await assert.rejects(run({ mahnungen: [afMahnung(1), afMahnung(2, { ausfallrechnung_id: id(12) })],
    ausfallrechnungen: [...base.ausfallrechnungen, af({ id: id(12), amount_eur: '0.01' })] }), RangeError);
});

// Real B04 route evaluated unchanged except environment-owned auth import;
// required auth injection avoids SDK construction and all network/env access.
const source = fs.readFileSync(new URL('../../routes/startseite.js', import.meta.url), 'utf8')
  .replace("import { Router } from 'express';", '')
  .replace("import { requireAuth } from '../ai/auth.js';", '')
  .replace('export function createStartseiteRouter', 'function createStartseiteRouter');
const createStartseiteRouter = vm.runInNewContext(`${source}\ncreateStartseiteRouter`, {
  Router: express.Router, URLSearchParams, requireAuth() { throw new Error('Auth muss injiziert sein'); },
});
function request(router, query = '') {
  const app = express(); app.use('/api', router);
  const socket = new Duplex({ read() {}, write(_chunk, _encoding, done) { done(); } });
  const req = new IncomingMessage(socket); req.method = 'GET'; req.url = `/api/startseite/zusammenfassung${query}`;
  const res = new ServerResponse(req);
  return new Promise((resolve, reject) => {
    res.end = chunk => { try { resolve({ status: res.statusCode, body: JSON.parse(String(chunk)) }); } catch (error) { reject(error); } return res; };
    app.handle(req, res, error => reject(error || new Error('Route nicht erreicht')));
  });
}

test('Reale B04-Grenze + Factory + B06: Employee 0 Reads; Owner Teil200/Gesamt503 maskiert', async () => {
  const c = client({ mahnungen: [mahnung(1, { status: 'RAW private status' })] });
  const lader = createFinanzlader({ supabase: c.supabase, jetzt, lader: { mahnungen: ladeMahnungen,
    geld: async () => ({ synthetic: true }), abrechnung: async () => { throw new Error('RAW private failure'); } } });
  const router = role => createStartseiteRouter({ lader, auth(req, _res, next) {
    req.auth = { role, tenantId, userId: role === 'owner' ? tenantId : fremd }; next();
  } });
  assert.deepEqual(await request(router('employee')), { status: 200, body: { bloecke: {} } });
  assert.equal((await request(router('employee'), '?bloecke=mahnungen')).status, 403);
  assert.equal(c.calls.length, 0);
  const partial = await request(router('owner'));
  assert.equal(partial.status, 200);
  assert.equal(partial.body.bloecke.geld.status, 'ok');
  assert.deepEqual(partial.body.bloecke.mahnungen, { status: 'fehler', code: 'BLOCK_NICHT_VERFUEGBAR' });
  assert.equal((await request(router('owner'), '?bloecke=mahnungen,abrechnung')).status, 503);
  assert.equal((await request(router('owner'), '?tenantId=fremd')).status, 400);
  assert.doesNotMatch(JSON.stringify(partial), /RAW|private|patient|QUELLE/);
  const good = client();
  const ok = createStartseiteRouter({ auth(req, _res, next) { req.auth = { role: 'owner', tenantId, userId: tenantId }; next(); },
    lader: createFinanzlader({ supabase: good.supabase, jetzt, lader: { mahnungen: ladeMahnungen } }) });
  const success = await request(ok, '?bloecke=mahnungen');
  assert.equal(success.status, 200);
  assert.deepEqual(success.body.bloecke.mahnungen.daten, leer());
});


test('B03-Zuordnungsgrenze: mehrdeutige Posten Unknown, keine Gesamtsumme/Fremdcodes übernehmen', async () => {
  const adapterSource = fs.readFileSync(new URL('./mahnungen.js', import.meta.url), 'utf8')
    .replace("import { ladeMandantenZeilen } from './finanzadapter.js';", '')
    .replace("import { ladeOffeneForderungen } from '../offene-forderungen.js';", '')
    .replace('export async function ladeMahnungen', 'async function ladeMahnungen');
  let reads = 0;
  const adapter = vm.runInNewContext(`${adapterSource}\n ladeMahnungen`, {
    Date, ladeMandantenZeilen: async () => [mahnung(1)],
    ladeOffeneForderungen: async () => { reads++; return {
      gesamtCent: 9999999, posten: [
        { quelle: 'patient', refId: rezept, restCent: 1500 },
        { quelle: 'patient', refId: rezept, restCent: 1500 },
        { quelle: 'patient', refId: id(99), restCent: 99999 },
      ], anomalien: [{ refId: rezept, code: 'RAW synthetic private name' }],
    }; },
  });
  const result = await adapter({ supabase: { from() {} }, tenantId, jetzt });
  assert.equal(reads, 1);
  assert.equal(rest(result).gesamtCent, null);
  assert.equal(rest(result).bekanntCent, 0);
  assert.equal(rest(result).gruende.join(), 'B03_REST_NICHT_ZUORDENBAR');
  assert.doesNotMatch(JSON.stringify(result), /RAW|synthetic|private|99999/);
});

test('B03-Gesamtbestand außerhalb gemahnter Rezeptgruppe bleibt ausgeschlossen', async () => {
  const { result } = await run({ mahnungen: [mahnung(1)], prescriptions: [rx(), rx({ id: id(99), zuzahlung_eur: 900 })], belegliste: [beleg()] });
  assert.equal(rest(result).gesamtCent, 1500);
});

test('Beide terminalen Höchststatus widersprechen sich, niedriger Status bleibt ausgeschlossen', async () => {
  const { result, calls } = await run({ mahnungen: [mahnung(1), mahnung(2, { level: 2, status: 'bezahlt' }), mahnung(3, { level: 2, status: 'abgeschrieben' })] });
  assert.equal(stufe(result, 2).anzahl, null);
  assert.equal(rest(result, 2).gesamtCent, null);
  assert.ok(calls.every(c => c.table === 'mahnungen'));
});

test('Ausfallreader lädt >1000 und leere Schlussseite ownergefiltert; kein Datumsfilter', async () => {
  const { result, calls } = await run({ mahnungen: [afMahnung(1)],
    ausfallrechnungen: [af(), ...Array.from({ length: 1000 }, (_, n) => af({ id: id(1000 + n) }))] });
  assert.equal(rest(result).gesamtCent, 4012);
  const pages = calls.filter(c => c.table === 'ausfallrechnungen');
  assert.equal(pages.length, 3);
  for (const page of pages) {
    assert.deepEqual(page.eq, [['owner_id', tenantId]]);
    assert.equal(page.columns, 'id,owner_id,status,amount_eur');
  }
});
