import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { validateBelegEntry, generateCsvString } from '../belegliste/helper.js';
import { berlinTagesgrenzen } from '../../lib/berlin-tag.js';

// Exercise the actual registered route handlers with an in-memory, owner-scoped
// PostgREST adapter. No production credentials, HTTP requests or database writes.
const source = fs.readFileSync(new URL('./abrechnung.routes.js', import.meta.url), 'utf8');
const routeSource = source.slice(source.indexOf("router.get('/belegliste',"), source.indexOf('// POST /api/billing/abrechnung/preflight'));
function fixture(initialRows = [], { employee = false, queryError = null, insertError = null } = {}) {
  const rows = structuredClone(initialRows);
  const handlers = {};
  const calls = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: employee ? 'employee' : 'owner' } } }) },
    from(table) {
      const filters = [];
      let insertion;
      const q = {
        select() { return q; },
        eq(k, v) { filters.push(r => r[k] === v); return q; },
        in(k, v) { filters.push(r => v.includes(r[k])); return q; },
        gte(k, v) { calls.push(['gte', k, v]); filters.push(r => Date.parse(r[k]) >= Date.parse(v)); return q; },
        lt(k, v) { calls.push(['lt', k, v]); filters.push(r => Date.parse(r[k]) < Date.parse(v)); return q; },
        order() { return q; },
        insert(v) { insertion = v; return q; },
        async maybeSingle() { return { data: rows.find(r => filters.every(f => f(r))) || null, error: queryError }; },
        async single() {
          if (table === 'profiles') return { data: { id: employee ? 'employee' : 'owner', role: employee ? 'employee' : 'owner', owner_id: employee ? 'owner' : null } };
          if (insertError) return { data: null, error: insertError };
          const row = { ...insertion, id: 'new-' + rows.length, beleg_nr: rows.length + 1, created_at: '2026-10-16T10:00:00Z' };
          rows.push(row);
          return { data: row };
        },
        then(resolve, reject) { return Promise.resolve({ data: rows.filter(r => filters.every(f => f(r))), error: queryError }).then(resolve, reject); },
      };
      return q;
    },
  };
  vm.runInNewContext(routeSource, { supabase, validateBelegEntry, generateCsvString, berlinTagesgrenzen, Buffer, console: { error() {} }, router: {
    get(path, fn) { handlers['GET ' + path] = fn; }, post(path, fn) { handlers['POST ' + path] = fn; },
  } });
  return { rows, calls, async call(key, { query = {}, body = {}, token = 'synthetic' } = {}) {
    let status = 200, output;
    const res = { status(code) { status = code; return this; }, json(value) { output = value; return this; }, send(value) { output = value; return this; }, setHeader() {} };
    await handlers[key]({ headers: token ? { authorization: 'Bearer ' + token } : {}, query, body }, res);
    return { status, output };
  } };
}
const payment = (extra = {}) => ({ id: 'original', owner_id: 'owner', beleg_nr: 1, type: 'zuzahlung', amount_eur: 30, zahlart: 'bar', patient_id: 'patient', prescription_id: 'rx', abrechnung_id: null, invoice_id: null, created_at: '2026-10-16T09:00:00Z', ...extra });

test('Einzelstorno übernimmt Betrag, Zahlart und Bezüge vom mandantengebundenen Original', async () => {
  const f = fixture([payment()], { employee: true });
  const result = await f.call('POST /belegliste', { body: { type: 'storno', original_id: 'original', amount_eur: -999, zahlart: 'paypal', patient_id: 'fremd', prescription_id: 'fremd', abrechnung_id: 'fremd' } });
  assert.equal(result.status, 201);
  assert.equal(result.output.amount_eur, -30);
  assert.equal(result.output.zahlart, 'bar');
  assert.equal(result.output.patient_id, 'patient');
  assert.equal(result.output.prescription_id, 'rx');
  assert.equal(result.output.abrechnung_id, null);
  assert.equal(result.output.owner_id, 'owner');
  assert.equal(result.output.created_by, 'employee');
  const cash = await f.call('GET /belegliste', { query: { zahlart: 'bar' } });
  assert.equal(cash.output.reduce((sum, r) => sum + r.amount_eur, 0), 0);
  const csv = await f.call('GET /belegliste/export', { query: { zahlart: 'bar' } });
  assert.match(csv.output.toString('latin1'), /-30,00/);
});

test('Fremder Mandant, Storno, negativer und fehlender Originalbeleg bleiben unverändert', async () => {
  for (const [row, expected] of [[payment({ owner_id: 'other' }), 404], [payment({ type: 'storno' }), 400], [payment({ amount_eur: -30 }), 400]]) {
    const f = fixture([row]);
    assert.equal((await f.call('POST /belegliste', { body: { type: 'storno', original_id: 'original' } })).status, expected);
    assert.equal(f.rows.length, 1);
  }
  const f = fixture();
  assert.equal((await f.call('POST /belegliste', { body: { type: 'storno', amount_eur: -30 } })).status, 400);
  assert.equal((await f.call('POST /belegliste', { body: { type: 'storno', original_id: 'missing' } })).status, 404);
  assert.equal(f.rows.length, 0);
});

test('Legacy-Rezeptstorno berechnet Saldo serverseitig, behält bekannte oder unbekannte Zahlart', async () => {
  for (const zahlart of ['bar', null]) {
    const f = fixture([payment({ zahlart }), payment({ id: 'prior', type: 'storno', amount_eur: -10, zahlart }), payment({ owner_id: 'other', amount_eur: 999 })]);
    const result = await f.call('POST /belegliste', { body: { type: 'storno', prescription_id: 'rx', amount_eur: -20, zahlart: 'paypal', patient_id: 'fremd' } });
    assert.equal(result.status, 201);
    assert.equal(result.output.amount_eur, -20);
    assert.equal(result.output.zahlart, zahlart);
    assert.equal(result.output.patient_id, 'patient');
  }
});

test('Legacy-Rezeptstorno blockiert veralteten Saldo, Zahlartmischung einschließlich NULL und uneindeutige Bezüge', async () => {
  for (const extra of [{ amount_eur: -99 }, { amount_eur: -60, rows: [payment({ id: 'second', zahlart: 'ec' })] }, { amount_eur: -60, rows: [payment({ id: 'second', zahlart: null })] }, { amount_eur: -60, rows: [payment({ id: 'second', invoice_id: 'invoice-2' })] }]) {
    const f = fixture([payment(), ...(extra.rows || [])]);
    const count = f.rows.length;
    assert.equal((await f.call('POST /belegliste', { body: { type: 'storno', prescription_id: 'rx', amount_eur: extra.amount_eur } })).status, 409);
    assert.equal(f.rows.length, count);
  }
});

test('Rechnungsbezug sperrt Journal-only Storno, damit Rechnungssaldo nicht abweicht', async () => {
  for (const body of [{ type: 'storno', original_id: 'original' }, { type: 'storno', prescription_id: 'rx', amount_eur: -30 }]) {
    const f = fixture([payment({ invoice_id: 'invoice' })]);
    const result = await f.call('POST /belegliste', { body });
    assert.equal(result.status, 409);
    assert.match(result.output.error, /Rechnungsstatus/);
    assert.equal(f.rows.length, 1);
  }
});

test('Lesefehler und fehlende Authentisierung erzeugen keine Gegenbuchung', async () => {
  const f = fixture([payment()], { queryError: { message: 'synthetic read failure' } });
  assert.equal((await f.call('POST /belegliste', { body: { type: 'storno', original_id: 'original' } })).status, 500);
  assert.equal((await f.call('POST /belegliste', { body: { type: 'storno', prescription_id: 'rx', amount_eur: -30 } })).status, 500);
  assert.equal((await f.call('POST /belegliste', { token: null })).status, 401);
  assert.equal(f.rows.length, 1);
});

for (const key of ['GET /belegliste', 'GET /belegliste/export']) {
  test(key + ': Berliner Tagesfilter enthält frühe Zahlung und letzte Mikrosekunde, schließt Folgetag aus', async () => {
    const f = fixture([
      payment({ amount_eur: 11, created_at: '2026-10-15T22:30:00Z' }),
      payment({ amount_eur: 22, created_at: '2026-10-16T21:59:59.999999Z' }),
      payment({ amount_eur: 33, created_at: '2026-10-16T22:00:00Z' }),
    ]);
    const result = await f.call(key, { query: { from: '2026-10-16', to: '2026-10-16' } });
    assert.equal(result.status, 200);
    if (key.endsWith('export')) {
      const csv = result.output.toString('latin1');
      assert.match(csv, /11,00/); assert.match(csv, /22,00/); assert.doesNotMatch(csv, /33,00/);
    } else assert.deepEqual(result.output.map(r => r.amount_eur), [11, 22]);
  });
  test(key + ': DST23/25h und offene Grenzen verwenden dieselben halb offenen Intervalle', async () => {
    for (const [day, start, end, hours] of [
      ['2026-03-29', '2026-03-28T23:00:00.000Z', '2026-03-29T22:00:00.000Z', 23],
      ['2026-10-25', '2026-10-24T22:00:00.000Z', '2026-10-25T23:00:00.000Z', 25],
    ]) {
      const f = fixture();
      assert.equal((await f.call(key, { query: { from: day, to: day } })).status, 200);
      assert.deepEqual(f.calls, [['gte', 'created_at', start], ['lt', 'created_at', end]]);
      assert.equal((Date.parse(end) - Date.parse(start)) / 3600000, hours);
      const open = fixture();
      assert.equal((await open.call(key, { query: { to: day } })).status, 200);
      assert.deepEqual(open.calls, [['lt', 'created_at', end]]);
      const fromOnly = fixture();
      assert.equal((await fromOnly.call(key, { query: { from: day } })).status, 200);
      assert.deepEqual(fromOnly.calls, [['gte', 'created_at', start]]);
    }
  });
  test(key + ': ungültige Daten und umgekehrter Zeitraum liefern 400', async () => {
    for (const query of [{ from: '2026-02-30' }, { to: '2026-13-01' }, { from: ['2026-10-16'] }, { from: '2026-10-17', to: '2026-10-16' }]) {
      assert.equal((await fixture().call(key, { query })).status, 400);
    }
  });
}

test('Alter Journal-Client löst exakte Belegnummer auf, auch ohne Rezept; kein Gesamtsaldo-Storno', async () => {
  for (const prescription_id of ['rx', null]) {
    const f = fixture([payment({ prescription_id }), payment({ id: 'second', beleg_nr: 2, amount_eur: 50 })]);
    const result = await f.call('POST /belegliste', { body: { type: 'storno', amount_eur: -30, prescription_id, reference_text: 'STORNO für Beleg-Nr: 1 (Testbeleg)' } });
    assert.equal(result.status, 201);
    assert.equal(result.output.amount_eur, -30);
    assert.equal(result.output.zahlart, 'bar');
    assert.equal(result.output.prescription_id, prescription_id);
  }
  const f = fixture([payment({ owner_id: 'other' })]);
  assert.equal((await f.call('POST /belegliste', { body: { type: 'storno', amount_eur: -30, reference_text: 'STORNO für Beleg-Nr: 1 (Testbeleg)' } })).status, 404);
  for (const number of ['9007199254740993', '1abc', '1.5', '-1']) {
    const result = await fixture([payment()]).call('POST /belegliste', { body: { type: 'storno', amount_eur: -30, reference_text: `STORNO für Beleg-Nr: ${number} (Testbeleg)` } });
    assert.equal(result.status, 400);
  }
});

test('Nicht endliche Beträge bleiben auch bei normalen Zahlungseingängen gesperrt', async () => {
  for (const amount_eur of [Infinity, -Infinity, 'Infinity']) {
    assert.equal((await fixture().call('POST /belegliste', { body: { type: 'zuzahlung', amount_eur } })).status, 400);
  }
});

test('Einzelstorno schreibt storno_von; Insert-Fehler 23505/23514 wird als 409 gemeldet', async () => {
  const f = fixture([payment()]);
  const ok = await f.call('POST /belegliste', { body: { type: 'storno', original_id: 'original' } });
  assert.equal(ok.status, 201);
  assert.equal(ok.output.storno_von, 'original');
  for (const code of ['23505', '23514']) {
    const g = fixture([payment()], { insertError: { code, message: 'x' } });
    const dup = await g.call('POST /belegliste', { body: { type: 'storno', original_id: 'original' } });
    assert.equal(dup.status, 409, code);
    assert.match(dup.output.error, /bereits storniert/);
  }
});

test('GET markiert bereits stornierte Originale, auch bei Filter und Altformat ohne storno_von', async () => {
  const f = fixture([
    payment({ id: 'a', beleg_nr: 1 }),
    payment({ id: 'b', beleg_nr: 2 }),
    payment({ id: 'c', beleg_nr: 3 }),
    { id: 's1', owner_id: 'owner', beleg_nr: 4, type: 'storno', amount_eur: -30, storno_von: 'a', reference_text: 'x', created_at: '2026-10-16T09:30:00Z' },
    { id: 's2', owner_id: 'owner', beleg_nr: 5, type: 'storno', amount_eur: -30, storno_von: null, reference_text: 'STORNO für Beleg-Nr: 2 (Altbestand)', created_at: '2026-10-16T09:31:00Z' },
  ]);
  const all = await f.call('GET /belegliste');
  const flag = Object.fromEntries(all.output.map(r => [r.id, r.bereits_storniert]));
  assert.deepEqual(flag, { a: true, b: true, c: false, s1: false, s2: false });
  const filtered = await f.call('GET /belegliste', { query: { type: 'zuzahlung' } });
  assert.deepEqual(filtered.output.map(r => [r.id, r.bereits_storniert]).sort(), [['a', true], ['b', true], ['c', false]]);
});
