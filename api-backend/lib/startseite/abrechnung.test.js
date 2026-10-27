import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import express from 'express';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';
import { ladeAbrechnung } from './abrechnung.js';
import { createFinanzlader, ladeMandantenZeilen } from './finanzadapter.js';
import { zeilenAusDta, betraegeFuerVerordnung } from '../../billing/utils/abrechnung-zeilen.js';
import { flacheBehandlungen } from '../../billing/zuzahlung/erbrachte-sitzungen.js';
import { resolvePreis } from '../../billing/preise/resolver.js';
import { legsFuer, abrechnungscodeAusLegs } from '../../billing/codes/legs.js';
import { verordnungFestschreiben } from '../../billing/api/betriebsart.js';
import { berlinHeute, istStichtag } from '../berlin-tag.js';

const tenantId = '00000000-0000-4000-8000-000000000001';
const foreign = '00000000-0000-4000-8000-000000000002';
const jetzt = new Date('2026-10-27T12:00:00Z');
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const rx = (n = 1, patch = {}) => ({ id: id(n), owner_id: tenantId, rezeptart: 'kassen',
  abrechnung_status: 'bereit', therapie_bereich: 'podo', heilmittel_position: null,
  zuzahlung_befreit: true, abrechnung_id: null, belegnummer: null, ...patch });
const behandlung = (n, verordnung_id = id(1), patch = {}) => ({ id: id(n), owner_id: tenantId,
  verordnung_id, behandlungsdatum: '2026-07-01', hpnr_codes: ['78010'], storniert_am: null, ...patch });
const session = (n, prescription_id = id(1), patch = {}) => ({ id: id(n), prescription_id,
  status: 'done', done_at: '2026-07-01T10:00:00Z', heilmittel_index: 0, prescriptions: { owner_id: tenantId }, ...patch });

// Strict synthetic PostgREST query fixture. No fetch/SDK/env/client creation.
function db(tables = {}, { cap = 1000, change } = {}) {
  const calls = [];
  const supabase = { from(table) {
    const q = { table, eq: [], in: [], gt: [], order: null, limit: null, select: null };
    const builder = {
      select(value) { q.select = value; return this; },
      eq(...args) { q.eq.push(args); return this; },
      in(...args) { q.in.push(args); return this; },
      gt(...args) { q.gt.push(args); return this; },
      order(...args) { q.order = args; return this; },
      async limit(value) {
        q.limit = value; calls.push(q);
        assert.deepEqual(q.order, ['id', { ascending: true }]);
        assert.equal(value, 1000);
        assert.ok(q.eq.some(([key, val]) => key === (table === 'prescription_sessions' ? 'prescriptions.owner_id' : 'owner_id') && val === tenantId));
        assert.doesNotMatch(q.select, /\*|patient|geburt|notes|notizen|versichert|leads/);
        if (table === 'prescription_sessions') {
          assert.equal(q.select, 'id,prescription_id,status,done_at,heilmittel_index,prescriptions!inner(owner_id)');
          assert.ok(q.eq.some(([k, v]) => k === 'status' && v === 'done'));
          assert.equal(q.in.length, 1);
          assert.equal(q.in[0][0], 'prescription_id');
          assert.ok(q.in[0][1].length > 0 && q.in[0][1].length <= 200);
          assert.ok(!q.eq.some(([k]) => k === 'owner_id'));
        }
        let rows = [...(tables[table] || [])].sort((a, b) => a.id.localeCompare(b.id));
        for (const [key, val] of q.eq) rows = rows.filter(row => (key === 'prescriptions.owner_id' ? row.prescriptions?.owner_id : row[key]) === val);
        for (const [key, values] of q.in) rows = rows.filter(row => values.includes(row[key]));
        for (const [key, val] of q.gt) rows = rows.filter(row => row[key] > val);
        rows = rows.slice(0, Math.min(value, cap));
        return change?.(q, rows, calls) ?? { data: rows, error: null };
      },
    };
    return builder;
  } };
  return { supabase, calls };
}
async function load(tables, options, loader = ladeAbrechnung) {
  const fixture = db(tables, options);
  const result = await loader({ supabase: fixture.supabase, tenantId, jetzt });
  return { result, ...fixture };
}
const reasons = result => Array.from(result.bereit.gruende, g => g.code);
function snapshot(rezept = rx(1), patch = {}, kopfPatch = {}) {
  const abrechnungId = id(9000);
  const prescription = { ...rezept, abrechnung_id: abrechnungId, belegnummer: 'SYN-001' };
  // Production snapshot writer, synthetic patient shape; no patient projection/read.
  const [zeile] = zeilenAusDta({ abrechnungId, ownerId: tenantId, kostentraegerIk: 'synthetic',
    dta: {}, prescriptions: [{ patient: { belegnummer: 'SYN-001' },
      sessions: [{ einzelbetrag: 50, anzahl: 2, zuzahlungProPos: 5 }],
      verordnung: { zuzahlungskennzeichen: '3' } }], quellen: [prescription] });
  return { prescriptions: [prescription], abrechnung_zeile: [{ ...zeile, id: id(8000), absetzung_eur: 0, ...patch }],
    abrechnung: [{ id: abrechnungId, owner_id: tenantId, status: 'erstellt', betriebsart: 'echt', verarbeitungskennzeichen: '01', ...kopfPatch }] };
}

test('Statusmatrix: exakt bereit, GKV NULL, rejected/teilabsetzung getrennt; leer ohne abhängige Reads', async () => {
  const statuses = ['bereit', 'rejected', 'teilabsetzung', 'abgesetzt', 'teilabgesetzt', 'eingereicht', 'draft', 'in_behandlung', null];
  const prescriptions = statuses.map((s, i) => rx(i + 1, { abrechnung_status: s, rezeptart: null }));
  for (const art of ['privat', 'selbstzahler', 'bg']) prescriptions.push(rx(prescriptions.length + 1, { rezeptart: art }));
  const { result } = await load({ prescriptions });
  assert.equal(result.bereit.anzahl, 1);
  assert.deepEqual(result.abgesetzt, { anzahl: 1 });
  assert.deepEqual(result.teilabgesetzt, { anzahl: 1 });
  assert.equal(result.bereit.gesamtCent, null);
  for (const data of [[], prescriptions.filter(p => p.abrechnung_status !== 'bereit')]) {
    const { result: r, calls } = await load({ prescriptions: data });
    assert.deepEqual(r.bereit, { anzahl: 0, bekanntCent: 0, gesamtCent: 0, unbekanntAnzahl: 0, gruende: [] });
    assert.ok(calls.every(q => q.table === 'prescriptions'));
  }
});

test('Eingaben vor Reads geprüft; unbekannte Rezeptart ist Datenwiderspruch', async () => {
  let reads = 0;
  const supabase = { from() { reads++; throw new Error('read'); } };
  for (const patch of [{ tenantId: 'bad' }, { supabase: {} }, { jetzt: new Date(NaN) }, { jetzt: '2026-10-27' }]) {
    await assert.rejects(ladeAbrechnung({ supabase, tenantId, jetzt, ...patch }), TypeError);
  }
  assert.equal(reads, 0);
  await assert.rejects(load({ prescriptions: [rx(1, { rezeptart: 'gkv' })] }), /REZEPTART_WIDERSPRUCH/);
});

test('Echter Snapshot netto plus Unknown: keine Teil-VO-Summe; Snapshot braucht keine Leistungsreads', async () => {
  const tables = snapshot();
  tables.prescriptions.push(rx(2, { zuzahlung_befreit: false }));
  const { result, calls } = await load(tables);
  assert.deepEqual(result.bereit, { anzahl: 2, bekanntCent: 8000, gesamtCent: null, unbekanntAnzahl: 1,
    gruende: [{ code: 'BEFREIUNG_UNGEKLAERT', anzahl: 1 }] });
  assert.ok(!calls.some(q => ['podologie_behandlungen', 'prescription_sessions'].includes(q.table)));
  assert.equal(result.quelle, 'prescriptions.abrechnung_status');
  assert.equal(result.umfang, 'praxisweit; Kassenanteil-Schätzung; kein Transaktionssnapshot');
  const output = JSON.stringify(result);
  assert.doesNotMatch(output, /SYN-001|10000000|00000000|patient|owner_id|belegnummer|RAW/);
});

test('Snapshotkonflikte sperren Fallback, niemals beliebig älteste/neuste Zeile', async t => {
  const mutations = {
    herkunft: d => { d.abrechnung_zeile[0].herkunft = 'rekonstruiert'; },
    beleg: d => { d.abrechnung_zeile[0].belegnummer = 'fremd'; },
    kopf: d => { d.prescriptions[0].abrechnung_id = id(9999); },
    fehlenderKopf: d => { d.abrechnung = []; },
    mehrereOriginale: d => { d.abrechnung_zeile.push({ ...d.abrechnung_zeile[0], id: id(8001), abrechnung_id: id(9001) }); },
    falschesRezept: d => { d.abrechnung_zeile[0].prescription_id = id(2); },
    test: d => { d.abrechnung[0].betriebsart = 'test'; },
    unbekannteBetriebsart: d => { d.abrechnung[0].betriebsart = null; },
    vkz03: d => { d.abrechnung[0].verarbeitungskennzeichen = '03'; },
    vkzNull: d => { d.abrechnung[0].verarbeitungskennzeichen = null; },
    verworfen: d => { d.abrechnung[0].status = 'verworfen'; },
    kopfRejected: d => { d.abrechnung[0].status = 'rejected'; },
    abgesetzt: d => { d.abrechnung_zeile[0].status = 'abgesetzt'; },
    teilabgesetzt: d => { d.abrechnung_zeile[0].status = 'teilabgesetzt'; },
    absetzung: d => { d.abrechnung_zeile[0].absetzung_eur = 1; },
    absetzungNull: d => { d.abrechnung_zeile[0].absetzung_eur = null; },
    fehlendeZuordnung: d => { d.prescriptions[0].belegnummer = null; },
    fehlt: d => { d.abrechnung_zeile = []; },
    unplausibel: d => { d.abrechnung_zeile[0].netto_eur = 81; },
    nullBetrag: d => { d.abrechnung_zeile[0].brutto_eur = null; },
    subcent: d => { d.abrechnung_zeile[0].brutto_eur = '100.001'; },
    negativ: d => { d.abrechnung_zeile[0].zuzahlung_eur = -1; },
    exponent: d => { d.abrechnung_zeile[0].netto_eur = '8e1'; },
    zuHoch: d => { d.abrechnung_zeile[0].zuzahlung_eur = 101; },
  };
  for (const [name, mutate] of Object.entries(mutations)) await t.test(name, async () => {
    const tables = snapshot(); mutate(tables);
    tables.podologie_behandlungen = [behandlung(4000)];
    const { result, calls } = await load(tables);
    assert.equal(result.bereit.gesamtCent, null);
    assert.equal(result.bereit.bekanntCent, 0);
    assert.equal(result.bereit.unbekanntAnzahl, 1);
    assert.ok(reasons(result).length);
    assert.ok(!calls.some(q => q.table === 'podologie_behandlungen'));
  });
});

test('Podo: mehrere + doppelte HPNR, Storno weg, Preis je Leistungsdatum; VO einmal', async () => {
  const tables = { prescriptions: [rx()], podologie_behandlungen: [
    behandlung(10, id(1), { behandlungsdatum: '2026-06-30', hpnr_codes: ['78010', '78610', '78610'] }),
    behandlung(11, id(1), { hpnr_codes: ['78010', '78530'] }),
    behandlung(12, id(1), { hpnr_codes: ['unknown'], storniert_am: '2026-07-02T00:00:00Z' }),
  ] };
  const flat = flacheBehandlungen(tables.podologie_behandlungen.filter(b => b.storniert_am === null));
  assert.equal(flat.length, 5);
  const expected = betraegeFuerVerordnung({ verordnung: { zuzahlungskennzeichen: '1' }, sessions: flat.map(s => {
    const p = resolvePreis({ bereich: 'podologie', code: s.code, datum: s.done_at,
      abrechnungscode: abrechnungscodeAusLegs(legsFuer('podologie')) });
    return { einzelbetrag: p.preis_eur, anzahl: 1, zuzahlungProPos: p.zuzahlung_eur };
  }) });
  const { result, calls } = await load(tables, { cap: 1 });
  assert.equal(result.bereit.anzahl, 1);
  assert.equal(result.bereit.gesamtCent, Math.round(expected.netto * 100));
  assert.equal(result.bereit.gesamtCent, 20039); // 35.16 + 2*55.90 + 36.10 + 17.33
  assert.equal(calls.filter(q => q.table === 'podologie_behandlungen').length, 4);
  assert.ok(!calls.some(q => q.table === 'abrechnung' || q.table === 'prescription_sessions'));
});

test('Physio: done-Sessions, Kalenderdatum Berlin, Preisfenstergrenze ohne Jetzt-Fallback', async () => {
  const tables = { prescriptions: [rx(1, { therapie_bereich: 'physio', heilmittel_position: 'X0501' })],
    prescription_sessions: [session(10, id(1), { done_at: '2025-12-31T23:30:00Z' }), session(11), session(12, id(1), { status: 'planned' })] };
  const { result, calls } = await load(tables);
  assert.equal(result.bereit.gesamtCent, 5926);
  assert.ok(!calls.some(q => q.table === 'podologie_behandlungen'));
  tables.prescription_sessions[0].done_at = '2025-12-31T20:30:00Z';
  const unknown = (await load(tables)).result;
  assert.equal(unknown.bereit.bekanntCent, 0);
  assert.ok(reasons(unknown).includes('PREIS_UNBEKANNT'));
});

test('Physio-Zusatzheilmittel: unbelegter Sitzungsindex darf nicht Hauptposition kosten', async () => {
  for (const heilmittel_index of [1, 2, -1, '0', 0.5]) {
    const { result } = await load({ prescriptions: [rx(1, { therapie_bereich: 'physio', heilmittel_position: 'X0501' })],
      prescription_sessions: [session(10, id(1), { heilmittel_index })] });
    assert.equal(result.bereit.bekanntCent, 0);
    assert.equal(result.bereit.gesamtCent, null);
    assert.ok(reasons(result).includes('HEILMITTEL_ZUORDNUNG_UNGEKLAERT'));
  }
  for (const heilmittel_index of [0, null]) {
    const { result } = await load({ prescriptions: [rx(1, { therapie_bereich: 'physio', heilmittel_position: 'X0501' })],
      prescription_sessions: [session(10, id(1), { heilmittel_index })] });
    assert.equal(result.bereit.gesamtCent, 2963);
  }
});

test('Podo-HPNR: Ungültigkeitsdatum sperrt, historische Deprecated-Position bleibt bewertbar', async () => {
  // 2025-10: gar kein Preisfenster; 2026: Preis vorhanden, Position ungültig.
  for (const [behandlungsdatum, grund] of [['2025-10-01', 'PREIS_UNBEKANNT'], ['2026-07-01', 'POSITION_UNGUELTIG']]) {
    const { result } = await load({ prescriptions: [rx()], podologie_behandlungen: [
      behandlung(10, id(1), { behandlungsdatum, hpnr_codes: ['78210'] })] });
    assert.equal(result.bereit.bekanntCent, 0);
    assert.equal(result.bereit.gesamtCent, null);
    assert.ok(reasons(result).includes(grund));
  }
  const { result } = await load({ prescriptions: [rx()], podologie_behandlungen: [
    behandlung(10, id(1), { behandlungsdatum: '2025-09-30', hpnr_codes: ['78210'] })] });
  assert.equal(result.bereit.gesamtCent, 9904);
});

test('Keine erfundene Null: Datum/HPNR/Behandlungen fehlen oder fehlerhaft', async t => {
  const cases = [null, '', 'bad', '2026-02-30', '2026-01-01'];
  for (const datum of cases) await t.test(String(datum), async () => {
    const { result } = await load({ prescriptions: [rx()], podologie_behandlungen: [behandlung(10, id(1), { behandlungsdatum: datum })] });
    // 2026-01-01 hat einen belegten Podopreis; alle anderen Daten bleiben Unknown.
    assert.equal(result.bereit.gesamtCent, datum === '2026-01-01' ? 3516 : null);
  });
  for (const patch of [{ hpnr_codes: ['NO'] }, { hpnr_codes: [] }, { hpnr_codes: null }, { hpnr_codes: '78010' }, { hpnr_codes: ['78010', null] }]) {
    const { result } = await load({ prescriptions: [rx()], podologie_behandlungen: [behandlung(10, id(1), patch)] });
    assert.equal(result.bereit.gesamtCent, null);
    assert.equal(result.bereit.bekanntCent, 0);
  }
  assert.equal((await load({ prescriptions: [rx()] })).result.bereit.gesamtCent, null);
});

test('Befreiung false/NULL bleibt Unknown, auch positionsfrei; Ergo/Logo kein Physiofallback', async () => {
  for (const befreit of [false, null]) {
    const { result, calls } = await load({ prescriptions: [rx(1, { zuzahlung_befreit: befreit })], podologie_behandlungen: [behandlung(10, id(1), { hpnr_codes: ['78530'] })] });
    assert.deepEqual(reasons(result), ['BEFREIUNG_UNGEKLAERT']);
    assert.equal(result.bereit.gesamtCent, null);
    assert.ok(!calls.some(q => q.table === 'podologie_behandlungen'));
  }
  for (const therapie_bereich of ['ergo', 'logo', 'unknown', null]) {
    const { result, calls } = await load({ prescriptions: [rx(1, { therapie_bereich })] });
    assert.deepEqual(reasons(result), ['PREISBEREICH_NICHT_BELEGT']);
    assert.ok(!calls.some(q => ['prescription_sessions', 'podologie_behandlungen'].includes(q.table)));
    const { result: stored } = await load(snapshot(rx(1, { therapie_bereich })));
    assert.equal(stored.bereit.gesamtCent, 8000);
  }
});

// Real resolver and aggregation helpers, deterministic catalog source in memory.
// Does not alter price files, module cache, env, provider or production imports.
function withCatalog(position) {
  const resolverSource = fs.readFileSync(new URL('../../billing/preise/resolver.js', import.meta.url), 'utf8')
    .replace(/^import .*;$/gm, '').replace('export function resolvePreis', 'function resolvePreis');
  // Use real exported calculator via supplied dependency (loaded below in test).
  return async resolvePositionZuzahlung => {
    const resolve = vm.runInNewContext(`${resolverSource}\nresolvePreis`, {
      findPosition: () => position, findPodologiePosition: () => position, resolvePositionZuzahlung,
    });
    const source = fs.readFileSync(new URL('./abrechnung.js', import.meta.url), 'utf8')
      .replace(/^import .*;$/gm, '').replace('export async function ladeAbrechnung', 'async function ladeAbrechnung');
    return vm.runInNewContext(`${source}\nladeAbrechnung`, { Date, ladeMandantenZeilen,
      flacheBehandlungen, betraegeFuerVerordnung, resolvePreis: resolve, legsFuer, abrechnungscodeAusLegs,
      verordnungFestschreiben, berlinHeute, istStichtag });
  };
}

test('Resolver-Schutz: raw preis NULL/ungültig/außerhalb wird trotz resolver 0 Unknown; Positionszuzahlung NULL gültig', async () => {
  const { resolvePositionZuzahlung } = await import('../../billing/zuzahlung/calculator.js');
  for (const position of [null, { preis: null }, { preis: undefined }, { preis: NaN }, { preis: -1 }, { preis: '12.001' }, { preis: 12, ausserhalb_preisfenster: true }]) {
    const loader = await withCatalog(position)(resolvePositionZuzahlung);
    const { result } = await load({ prescriptions: [rx()], podologie_behandlungen: [behandlung(10)] }, {}, loader);
    assert.equal(result.bereit.gesamtCent, null);
    assert.deepEqual(reasons(result), ['PREIS_UNBEKANNT']);
  }
  const loader = await withCatalog({ preis: 12, zuzahlung: null })(resolvePositionZuzahlung);
  assert.equal((await load({ prescriptions: [rx()], podologie_behandlungen: [behandlung(10)] }, {}, loader)).result.bereit.gesamtCent, 1200);
});

test('Alle Gründe pro VO einmal, feste Codes sortiert; bekannte VO niemals teilweise', async () => {
  const { result } = await load({ prescriptions: [rx(1), rx(2)], podologie_behandlungen: [
    behandlung(10, id(1), { behandlungsdatum: null, hpnr_codes: ['NO'] }),
    behandlung(11, id(1), { hpnr_codes: ['78010', 'NO', 'NO'] }),
    behandlung(12, id(2), { hpnr_codes: ['NO'] }),
  ] });
  assert.deepEqual(result.bereit, { anzahl: 2, bekanntCent: 0, gesamtCent: null, unbekanntAnzahl: 2,
    gruende: [{ code: 'LEISTUNGSDATUM_UNGEKLAERT', anzahl: 1 }, { code: 'PREIS_UNBEKANNT', anzahl: 2 }] });
});

test('>1000 Owner-Keyset und >200 Sessions-ID-Chunks: jede Seite bis leer, Cursor je Chunk neu', async () => {
  const prescriptions = Array.from({ length: 1001 }, (_, i) => rx(i + 1, { therapie_bereich: 'physio', heilmittel_position: 'X0501' }));
  const prescription_sessions = Array.from({ length: 1001 }, (_, i) => session(i + 2000, id(1)));
  for (const p of prescriptions.slice(1)) prescription_sessions.push(session(prescription_sessions.length + 4000, p.id));
  const { result, calls } = await load({ prescriptions, prescription_sessions });
  assert.equal(result.bereit.anzahl, 1001);
  assert.equal(result.bereit.gesamtCent, prescription_sessions.length * 2963);
  const owners = calls.filter(q => q.table === 'prescriptions');
  assert.equal(owners.length, 3);
  const sessions = calls.filter(q => q.table === 'prescription_sessions');
  const chunks = new Map();
  for (const q of sessions) { const key = q.in[0][1][0]; if (!chunks.has(key)) chunks.set(key, []); chunks.get(key).push(q); }
  assert.equal(chunks.size, 6);
  for (const pages of chunks.values()) { assert.equal(pages[0].gt.length, 0); assert.ok(pages.at(-1).gt.length); }
  assert.equal([...chunks.values()][0].length, 3);
  const small = await load({ prescriptions: prescriptions.slice(0, 201), prescription_sessions: prescription_sessions.filter(s => s.prescription_id !== id(1)).slice(0, 201) }, { cap: 1 });
  assert.equal(small.result.bereit.anzahl, 201);
  assert.equal(small.calls.filter(q => q.table === 'prescriptions').length, 202);
});

test('Jeder Owner-Reader: Fremdowner, Cursor/ID und Folgefehler führen zu keinem Teilerfolg', async () => {
  for (const table of ['prescriptions', 'abrechnung_zeile', 'abrechnung', 'podologie_behandlungen']) {
    const tables = table === 'podologie_behandlungen'
      ? { prescriptions: [rx()], podologie_behandlungen: [behandlung(10), behandlung(11)] }
      : snapshot();
    for (const bad of ['owner', 'id', 'cursor', 'error', 'null']) {
      let page = 0;
      await assert.rejects(load(tables, { cap: 1, change(q, rows) {
        if (q.table !== table) return;
        page++;
        if (page !== 2) return;
        if (bad === 'error') return { data: null, error: { message: 'RAW synthetic secret' } };
        if (bad === 'null') return { data: null, error: null };
        const row = (tables[table] || [])[0];
        return { data: [{ ...row, ...(bad === 'owner' ? { owner_id: foreign } : {}), ...(bad === 'id' ? { id: null } : {}) }], error: null };
      } }), /STARTSEITE_/);
    }
  }
});

test('Sessionsreader validiert Parentowner/Idliste/status/Keyset und Fehler auf Folgeseite', async () => {
  for (const bad of ['owner', 'parent', 'foreignId', 'id', 'cursor', 'status', 'error', 'null']) {
    let page = 0;
    await assert.rejects(load({ prescriptions: [rx(1, { therapie_bereich: 'physio', heilmittel_position: 'X0501' })], prescription_sessions: [session(10), session(11)] },
      { cap: 1, change(q, rows) {
        if (q.table !== 'prescription_sessions' || ++page !== 2) return;
        if (bad === 'error') return { data: null, error: { message: 'RAW synthetic' } };
        if (bad === 'null') return { data: null, error: null };
        const patch = { owner: { prescriptions: { owner_id: foreign } }, parent: { prescriptions: null },
          foreignId: { prescription_id: id(999) }, id: { id: '' }, cursor: { id: id(10) }, status: { status: 'planned' } }[bad];
        return { data: [{ ...rows[0], ...patch }], error: null };
      } }), /STARTSEITE_/);
  }
});

test('Sichere Integercent: Einzel- und Summenüberlauf werfen', async () => {
  const huge = snapshot(rx(1), { brutto_eur: '90071992547409.92', netto_eur: '90071992547409.92', zuzahlung_eur: 0 });
  await assert.rejects(load(huge), RangeError);
  const sum = snapshot(rx(1), { brutto_eur: '90071992547409.91', netto_eur: '90071992547409.91', zuzahlung_eur: 0 });
  const two = snapshot(rx(2), { id: id(8001), brutto_eur: 1, netto_eur: 1, zuzahlung_eur: 0 });
  two.prescriptions[0].belegnummer = 'SYN-002'; two.abrechnung_zeile[0].belegnummer = 'SYN-002';
  sum.prescriptions.push(...two.prescriptions); sum.abrechnung_zeile.push(...two.abrechnung_zeile);
  await assert.rejects(load(sum), RangeError);
});

// Existing B04 handler in an isolated VM, injected auth. No import of auth SDK.
const routeSource = fs.readFileSync(new URL('../../routes/startseite.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/gm, '').replace('export function createStartseiteRouter', 'function createStartseiteRouter');
const createStartseiteRouter = vm.runInNewContext(`${routeSource}\ncreateStartseiteRouter`, {
  Router: express.Router, URLSearchParams, requireAuth() { throw new Error('Auth muss injiziert sein'); },
});
function request(router, query = '') {
  const app = express(); app.use('/api', router);
  const socket = new Duplex({ read() {}, write(_chunk, _encoding, done) { done(); } });
  const req = new IncomingMessage(socket); req.method = 'GET'; req.url = `/api/startseite/zusammenfassung${query}`;
  const res = new ServerResponse(req);
  return new Promise((resolve, reject) => {
    res.end = chunk => { try { resolve({ status: res.statusCode, body: JSON.parse(String(chunk)) }); } catch (e) { reject(e); } return res; };
    app.handle(req, res, e => reject(e || new Error('Route nicht erreicht')));
  });
}
test('Factory + B04: Employee 0 Reads, Teil 200, Gesamt 503, injizierte Auth ohne listen()', async () => {
  const fixture = db({ prescriptions: [rx(1, { rezeptart: 'gkv' })] });
  const lader = createFinanzlader({ supabase: fixture.supabase, jetzt, lader: {
    abrechnung: ladeAbrechnung, geld: async () => ({ bekanntCent: 7 }),
  } });
  const router = role => createStartseiteRouter({ lader, auth(req, _res, next) {
    req.auth = { tenantId, role, userId: role === 'owner' ? tenantId : foreign }; next();
  } });
  assert.deepEqual(await request(router('employee')), { status: 200, body: { bloecke: {} } });
  assert.equal((await request(router('employee'), '?bloecke=abrechnung')).status, 403);
  assert.equal(fixture.calls.length, 0);
  const partial = await request(router('owner'), '?bloecke=geld,abrechnung');
  assert.equal(partial.status, 200);
  assert.equal(partial.body.bloecke.geld.status, 'ok');
  assert.equal(partial.body.bloecke.abrechnung.code, 'BLOCK_NICHT_VERFUEGBAR');
  const all = await request(router('owner'), '?bloecke=abrechnung');
  assert.equal(all.status, 503);
  assert.doesNotMatch(JSON.stringify(all), /RAW|REZEPTART|10000000|owner_id/);
  const success = createFinanzlader({ supabase: db(snapshot()).supabase, jetzt, lader: { abrechnung: ladeAbrechnung } });
  assert.equal((await success.abrechnung({ tenantId })).bereit.gesamtCent, 8000);
});


test('Alle Owner-Tabellen >1000: keine still abgeschnittenen Snapshots oder Podobehandlungen', async () => {
  const tables = { prescriptions: [], abrechnung_zeile: [], abrechnung: [] };
  for (let i = 1; i <= 1001; i++) {
    const data = snapshot(rx(i), { id: id(2000 + i), abrechnung_id: id(4000 + i), belegnummer: `SYN-${i}` }, { id: id(4000 + i) });
    Object.assign(data.prescriptions[0], { abrechnung_id: id(4000 + i), belegnummer: `SYN-${i}` });
    for (const key of Object.keys(tables)) tables[key].push(...data[key]);
  }
  const { result, calls } = await load(tables);
  assert.equal(result.bereit.gesamtCent, 8000 * 1001);
  for (const table of Object.keys(tables)) assert.equal(calls.filter(q => q.table === table).length, 3);
  assert.ok(!calls.some(q => q.table === 'podologie_behandlungen' || q.table === 'prescription_sessions'));
  const podo = await load({ prescriptions: [rx()], podologie_behandlungen: Array.from({ length: 1001 }, (_, i) => behandlung(i + 10)) });
  assert.equal(podo.result.bereit.gesamtCent, 3610 * 1001);
  assert.equal(podo.calls.filter(q => q.table === 'podologie_behandlungen').length, 3);
});

test('Session-Chunks mit cap1: jede nichtleere Seite plus leere Schlussseite; leerer Chunk ohne Cursor', async () => {
  const prescriptions = Array.from({ length: 401 }, (_, i) => rx(i + 1, { therapie_bereich: 'physio', heilmittel_position: 'X0501' }));
  const prescription_sessions = [session(1000, id(1)), session(1001, id(1)), session(1002, id(201)), session(1003, id(202))];
  const { result, calls } = await load({ prescriptions, prescription_sessions }, { cap: 1 });
  assert.equal(result.bereit.bekanntCent, 4 * 2963);
  assert.equal(result.bereit.unbekanntAnzahl, 398);
  const queries = calls.filter(q => q.table === 'prescription_sessions');
  assert.equal(queries.length, 7); // 2+leer, 2+leer, leer
  assert.deepEqual(queries.map(q => q.gt.length), [0, 1, 1, 0, 1, 1, 0]);
  assert.equal(queries[0].in[0][1].length, 200);
  assert.equal(queries[3].in[0][1].length, 200);
  assert.equal(queries[6].in[0][1].length, 1);
});

test('Snapshotkonflikte sammeln alle Codes, doppelte Belegzuordnung bleibt Unknown', async () => {
  const data = snapshot(rx(), { herkunft: 'rekonstruiert', status: 'teilabgesetzt', netto_eur: 77 }, { betriebsart: 'test' });
  const r = (await load(data)).result;
  assert.deepEqual(reasons(r), ['SNAPSHOT_ABSETZUNG_UNGEKLAERT', 'SNAPSHOT_BETRAG_UNGUELTIG', 'SNAPSHOT_HERKUNFT_UNKLAR', 'SNAPSHOT_KOPF_UNKLAR']);
  const ambiguous = snapshot();
  ambiguous.prescriptions.push(rx(2, { belegnummer: 'SYN-001', abrechnung_status: 'rejected' }));
  assert.ok(reasons((await load(ambiguous)).result).includes('SNAPSHOT_ZUORDNUNG_UNKLAR'));
  const erprobung = snapshot(rx(), {}, { betriebsart: 'erprobung' });
  assert.equal((await load(erprobung)).result.bereit.gesamtCent, 8000);
});

test('Fehler/NULL auf erster Seite werfen; kein Quellfehler wird als leere Praxis oder Nullpreis verborgen', async () => {
  for (const table of ['prescriptions', 'abrechnung_zeile', 'abrechnung', 'podologie_behandlungen', 'prescription_sessions']) {
    const tables = table === 'prescription_sessions' ? { prescriptions: [rx(1, { therapie_bereich: 'physio', heilmittel_position: 'X0501' })] }
      : table === 'podologie_behandlungen' ? { prescriptions: [rx()] } : snapshot();
    for (const response of [{ data: null, error: null }, { data: [], error: { message: 'RAW detail' } }]) {
      await assert.rejects(load(tables, { change(q) { if (q.table === table) return response; } }), /STARTSEITE_QUELLE_NICHT_VERFUEGBAR/);
    }
  }
});
