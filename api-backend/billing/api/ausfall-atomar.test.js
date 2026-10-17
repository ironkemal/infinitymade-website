// Reale Express-Handler und Supabase-SDK; ausschließlich synthetische Antworten.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_URL = 'http://ausfall.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-test-key';
const originalFetch = globalThis.fetch;
let scenario;
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(String(input));
  assert.equal(url.hostname, 'ausfall.test');
  const table = url.pathname.split('/').at(-1);
  const body = options.body ? JSON.parse(options.body) : null;
  scenario.requests.push({ table, method: options.method || 'GET', body });
  let data;
  if (url.pathname === '/auth/v1/user') data = { id: 'owner-test', email: 'owner@example.test' };
  else if (table === 'profiles') data = { id: 'owner-test', role: scenario.role || 'owner', business_name: 'Testpraxis', ausfall_enabled: true };
  else if (table === 'ausfall_status_buchen') {
    if (scenario.rpcError) return new Response(JSON.stringify(scenario.rpcError), { status: 400, headers: { 'Content-Type': 'application/json' } });
    data = null;
  } else if (table === 'document_vorlagen') data = { content_json: { zahlungsziel_tage: scenario.days ?? 30 } };
  else if (table === 'businesses') data = [];
  else if (table === 'bookings') data = { id: 'booking-test', owner_id: 'owner-test', start_time: '2026-01-01T12:00:00Z', status: 'no_show', customer_name: 'Test Patient' };
  else if (table === 'ausfallrechnungen' && options.method === 'POST') {
    scenario.insert = body;
    data = { ...body, id: 'af-test', rechnung_nr: 1 };
  } else if (table === 'ausfallrechnungen') data = url.searchParams.has('booking_id') ? [] : {
    id: 'af-test', owner_id: 'owner-test', rechnung_nr: 1, amount_eur: 30,
    created_at: '2026-01-01T12:00:00Z', faellig_am: scenario.legacy ? null : '2026-01-31',
  };
  else throw new Error('Unerwartete Abfrage: ' + url);
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
};
after(() => { globalThis.fetch = originalFetch; });
const { default: router } = await import('./ausfall.routes.js');
async function call(path, body = {}, overrides = {}) {
  scenario = { requests: [], ...overrides };
  const result = { status: 200 };
  const res = { status(value) { result.status = value; return this; }, json(value) { result.body = value; return this; }, set() { return this; }, send(value) { result.body = value; return this; } };
  const handler = router.stack.find(layer => layer.route?.path === path).route.stack[0].handle;
  await handler({ headers: { authorization: 'Bearer synthetic-token' }, params: { id: 'af-test' }, body }, res);
  return { ...result, ...scenario };
}
test('Zahlung schreibt ausschließlich atomare RPC mit Mandant und Akteur', async () => {
  const result = await call('/ausfall/:id/status', { status: 'bezahlt', zahlart: 'bar' });
  assert.equal(result.status, 200);
  const writes = result.requests.filter(r => r.method !== 'GET');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].table, 'ausfall_status_buchen');
  assert.deepEqual(writes[0].body, { p_owner_id: 'owner-test', p_actor_id: 'owner-test', p_ausfall_id: 'af-test', p_status: 'bezahlt', p_zahlart: 'bar' });
});
test('Fehlende RPC: 503 ohne REST-Fallback oder Statusänderung', async () => {
  for (const code of ['PGRST202', '42883']) {
    const result = await call('/ausfall/:id/status', { status: 'bezahlt', zahlart: 'bar' }, { rpcError: { code, message: 'missing function' } });
    assert.equal(result.status, 503);
    assert.equal(result.requests.some(r => ['belegliste', 'ausfallrechnungen'].includes(r.table)), false);
  }
});
test('Journalfehler wird Fehler statt falscher Zahlungsbestätigung', async () => {
  const result = await call('/ausfall/:id/status', { status: 'bezahlt', zahlart: 'bar' }, { rpcError: { code: 'XX000', message: 'journal failed' } });
  assert.equal(result.status, 500);
  assert.match(result.body.error, /nicht geändert/);
});
test('Konflikt, Fremdmandant und unbekannte Rechnung werden korrekt abgebildet', async () => {
  for (const [code, expected] of [['23514', 409], ['42501', 403], ['P0002', 404]]) {
    const result = await call('/ausfall/:id/status', { status: 'bezahlt', zahlart: 'bar' }, { rpcError: { code, message: 'blocked' } });
    assert.equal(result.status, expected);
  }
});
test('Mitarbeiter, ungültiger Status oder fehlende Zahlart erzeugen keine RPC', async () => {
  for (const [body, overrides] of [[{ status: 'bezahlt' }, {}], [{ status: 'offen' }, {}], [{ status: 'bezahlt', zahlart: 'bar' }, { role: 'employee' }]]) {
    const result = await call('/ausfall/:id/status', body, overrides);
    assert.ok([400, 403].includes(result.status));
    assert.equal(result.requests.some(r => r.table === 'ausfall_status_buchen'), false);
  }
});
test('Storno und Abschreibung nutzen ebenfalls atomaren Statusweg', async () => {
  for (const status of ['storniert', 'abgeschrieben']) {
    const result = await call('/ausfall/:id/status', { status });
    assert.equal(result.status, 200);
    assert.equal(result.requests.at(-1).body.p_zahlart, null);
  }
});
test('Neue Rechnung friert berechnetes Zahlungsziel beim INSERT ein', async () => {
  const result = await call('/ausfall/create', { bookingId: 'booking-test', amountEur: 30, reason: 'no_show' });
  assert.equal(result.status, 200);
  const { ausfallFaelligAm } = await import('../ausfall/faelligkeit.js');
  assert.equal(result.insert.faellig_am, ausfallFaelligAm(result.insert.created_at, 30));
});
test('Nachdruck behält gespeichertes Zahlungsziel trotz geänderter Vorlage', async () => {
  const result = await call('/ausfall/:id/print', {}, { days: 90 });
  assert.equal(result.status, 200);
  assert.match(result.body, /31\.1\.2026/);
});
test('Altbeleg zeigt festen Ersatzwert mit explizitem Nachweishinweis', async () => {
  const result = await call('/ausfall/:id/print', {}, { days: 90, legacy: true });
  assert.equal(result.status, 200);
  assert.match(result.body, /15\.1\.2026/);
  assert.match(result.body, /nicht nachgewiesen/);
  assert.match(result.body, /keine Grundlage für automatische Mahnungen/);
});
