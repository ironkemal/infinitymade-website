// Echte Express-Route und Supabase-SDK, ausschließlich synthetische HTTP-Antworten.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'http://mahnwesen.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-test-key';
const originalFetch = globalThis.fetch;
let scenario;
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(String(input));
  assert.equal(url.hostname, 'mahnwesen.test', 'Kein echter Backend-Zugriff erlaubt');
  const table = url.pathname.split('/').at(-1);
  scenario.requests.push({ table, url, method: options.method || 'GET' });
  let data;
  if (url.pathname === '/auth/v1/user') data = { id: 'owner-test', email: 'owner@example.test' };
  else if (table === 'profiles') data = { id: 'owner-test', role: scenario.role || 'owner', business_name: 'Testpraxis' };
  else if (table === 'prescriptions') {
    if (scenario.list) return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
    scenario.rxReads++;
    if (scenario.rxReads === 2 && scenario.freshError) return responseError('fresh read unavailable');
    data = { ...scenario.rx, ...(scenario.rxReads > 1 ? scenario.fresh : {}) };
  } else if (table === 'belegliste') {
    assert.equal(url.searchParams.get('owner_id'), 'eq.owner-test');
    assert.equal(url.searchParams.get('prescription_id'), 'in.(12345678-rx-test)');
    assert.equal(url.searchParams.get('type'), 'in.(zuzahlung,storno)');
    if (scenario.ledgerError) return responseError('ledger unavailable');
    data = scenario.belege;
  } else if (table === 'ausfallrechnungen') data = scenario.ausfall;
  else if (table === 'mahnungen' && options.method === 'POST') {
    scenario.inserts.push(JSON.parse(options.body));
    data = { id: 'mahnung-test', mahnung_nr: 1 };
  } else if (table === 'mahnungen') {
    if (scenario.historyError) return responseError('history unavailable');
    data = scenario.history || [];
  } else throw new Error('Unerwartete Testabfrage: ' + url);
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
};
function responseError(message) {
  return new Response(JSON.stringify({ message, code: 'TEST_ERROR' }), {
    status: 500, headers: { 'Content-Type': 'application/json' },
  });
}
after(() => { globalThis.fetch = originalFetch; });
const { default: router } = await import('./mahnwesen.routes.js');
const handler = router.stack.find(layer => layer.route?.path === '/mahnwesen/create').route.stack[0].handle;
const listHandler = router.stack.find(layer => layer.route?.path === '/mahnwesen/offene').route.stack[0].handle;

async function create(overrides = {}, body = { prescriptionId: '12345678-rx-test', level: 1 }) {
  scenario = {
    requests: [], inserts: [], rxReads: 0, belege: [],
    rx: { id: '12345678-rx-test', owner_id: 'owner-test', patient_id: 'patient-test',
      zuzahlung_eur: 30, zuzahlung_befreit: false, abrechnung_id: 'billing-test',
      ausstellungsdatum: '2026-01-01', zuzahlung_kassiert_am: null,
      leads: { first_name: 'Test', last_name: 'Patient' } },
    ...overrides,
  };
  const result = { status: 200 };
  const res = {
    status(code) { result.status = code; return this; },
    json(value) { result.body = value; return this; },
    set() { return this; },
    send(value) { result.body = value; return this; },
  };
  await (overrides.list ? listHandler : handler)({ headers: { authorization: 'Bearer synthetic-token' }, body }, res);
  return { ...result, ...scenario };
}
const beleg = amount_eur => ({ prescription_id: '12345678-rx-test', amount_eur });

test('Teilzahlung: Mahnung und Brief fordern nur 10 statt 30 Euro', async () => {
  const result = await create({ belege: [beleg(20)] });
  assert.equal(result.status, 200);
  assert.equal(result.inserts[0].amount_eur, 10);
  assert.match(result.body, /10,00/);
  assert.equal(result.rxReads, 2);
});
test('Vollzahlung und Überzahlung: kein Mahnungseintrag', async () => {
  for (const amount of [30, 35, 29.999]) {
    const result = await create({ belege: [beleg(amount)] });
    assert.equal(result.status, 400);
    assert.equal(result.inserts.length, 0);
  }
});
test('Altbestand ohne Beleg: kassiert-Vermerk verhindert Mahnung', async () => {
  const result = await create({ fresh: { zuzahlung_kassiert_am: '2026-01-02' } });
  assert.equal(result.status, 400);
  assert.equal(result.inserts.length, 0);
});
test('Belegsaldo mit Teilstorno bleibt maßgeblich trotz kassiert-Vermerk', async () => {
  const result = await create({ fresh: { zuzahlung_kassiert_am: '2026-01-02' }, belege: [beleg(30), beleg(-10)] });
  assert.equal(result.status, 200);
  assert.equal(result.inserts[0].amount_eur, 10);
});
test('Cent-Rest bleibt offen, Rundung erzeugt exakten Centbetrag', async () => {
  const result = await create({ belege: [beleg(29.99)] });
  assert.equal(result.status, 200);
  assert.equal(result.inserts[0].amount_eur, 0.01);
});
test('Aktueller Rezeptbetrag wird vor Erstellung erneut gelesen', async () => {
  const result = await create({ fresh: { zuzahlung_eur: 25 }, belege: [beleg(20)] });
  assert.equal(result.status, 200);
  assert.equal(result.inserts[0].amount_eur, 5);
});
test('Lesefehler bei Saldo, frischem Rezept oder Historie: kein Schreiben', async () => {
  for (const flag of ['ledgerError', 'freshError', 'historyError']) {
    const result = await create({ [flag]: true });
    assert.equal(result.status, 500);
    assert.equal(result.inserts.length, 0);
  }
});
test('Frische Befreiung oder entfernte Abrechnung: kein Schreiben', async () => {
  for (const fresh of [{ zuzahlung_befreit: true }, { abrechnung_id: null }]) {
    const result = await create({ fresh });
    assert.equal(result.status, 400);
    assert.equal(result.inserts.length, 0);
  }
});
test('Fremder Mandant und Mitarbeiter bleiben ausgeschlossen', async () => {
  const employee = await create({ role: 'employee' });
  assert.equal(employee.status, 403);
  assert.equal(employee.inserts.length, 0);
  const foreign = await create({ rx: { id: '12345678-rx-test', owner_id: 'foreign-owner' } });
  assert.equal(foreign.status, 403);
  assert.equal(foreign.inserts.length, 0);
});
test('Mahnstufe darf weiterhin nicht übersprungen werden', async () => {
  const result = await create({}, { prescriptionId: '12345678-rx-test', level: 3 });
  assert.equal(result.status, 400);
  assert.equal(result.inserts.length, 0);
});
test('Ausfallrechnung behält Betrag und Forderungsart ohne Zuzahlungsabfrage', async () => {
  const result = await create({ ausfall: { id: 'ausfall-test', owner_id: 'owner-test',
    patient_id: 'patient-test', amount_eur: 45, status: 'offen', created_at: '2026-01-01', faellig_am: '2026-01-15',
    rechnung_nr: 7, leads: { first_name: 'Test' } } }, { ausfallrechnungId: 'ausfall-test', level: 1 });
  assert.equal(result.status, 200);
  assert.equal(result.inserts[0].amount_eur, 45);
  assert.equal(result.inserts[0].prescription_id, null);
  assert.equal(result.inserts[0].ausfallrechnung_id, 'ausfall-test');
  assert.equal(result.requests.some(req => req.table === 'belegliste'), false);
});

test('Ausfallmahnung: ursprüngliches gespeichertes Zahlungsziel statt pauschaler14Tage', async () => {
  const result = await create({ ausfall: { id: 'ausfall-test', owner_id: 'owner-test', amount_eur: 45, status: 'offen', created_at: '2026-01-01', faellig_am: '2026-02-01', rechnung_nr: 7 } }, { ausfallrechnungId: 'ausfall-test', level: 1 });
  assert.equal(result.status, 200);
  assert.equal(result.inserts[0].original_faelligkeit.slice(0, 10), '2026-02-01');
});
test('Altbeleg ohne nachgewiesene Fälligkeit und noch nicht überfällige AF werden nicht gemahnt', async () => {
  for (const [faellig_am, expected] of [[null, 409], ['9999-01-01', 400]]) {
    const result = await create({ ausfall: { id: 'ausfall-test', owner_id: 'owner-test', amount_eur: 45, status: 'offen', created_at: '2026-01-01', faellig_am, rechnung_nr: 7 } }, { ausfallrechnungId: 'ausfall-test', level: 1 });
    assert.equal(result.status, expected);
    assert.equal(result.inserts.length, 0);
  }
});

test('Offene-Liste nutzt gespeicherte Fälligkeit und schließt Altbeleg/noch nicht fällige AF aus', async () => {
  const result = await create({ list: true, ausfall: [
    { id: 'old', created_at: '2020-01-01', faellig_am: null },
    { id: 'future', created_at: '2020-01-01', faellig_am: '9999-01-01' },
    { id: 'overdue', created_at: '2020-01-01', faellig_am: '2020-02-01', amount_eur: 45, rechnung_nr: 7 },
  ] });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.map(row => row.id), ['overdue']);
});
