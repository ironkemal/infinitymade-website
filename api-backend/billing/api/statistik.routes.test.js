import { test } from 'node:test';
import assert from 'node:assert/strict';

const origin = 'https://synthetic.invalid';
const userId = '00000000-0000-4000-8000-000000000001';
const otherOwnerId = '00000000-0000-4000-8000-000000000002';
const prescriptionId = '00000000-0000-4000-8000-000000000003';
const ownerKeys = [
  'monatlich', 'patienten', 'sitzungen', 'abrechnung',
  'offene_zuzahlungen', 'offene_zuzahlungen_summe', 'offen_gesamt_summe',
  'offen_ausserhalb_fenster', 'ausfallrechnungen', 'no_show', 'mahnungen',
  'therapeuten', 'aerzte',
];
const deniedBody = { error: 'Nur für Praxisinhaber verfügbar', code: 'NUR_INHABER' };

// Nur synthetische Werte im isolierten node:test-Prozess, kein dotenv/Server.
process.env.SUPABASE_URL = origin;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-role-key';

function fixture({
  profile = { id: userId, role: 'owner', owner_id: null },
  authStatus = 200,
  authBody = { id: userId },
  profileStatus = 200,
  prescriptions = [],
} = {}) {
  const calls = [];
  const violations = [];
  const reject = (reason) => {
    violations.push(reason);
    throw new Error(reason);
  };
  const fetch = async (input, init) => {
    let url;
    try {
      url = new URL(input instanceof Request ? input.url : input);
    } catch {
      return reject('Ungültiges Fetch-Ziel');
    }
    if (url.origin !== origin || url.username || url.password) {
      return reject('Fetch außerhalb des synthetischen Origins blockiert');
    }
    const method = init?.method || (input instanceof Request ? input.method : 'GET');
    if (!['GET', 'HEAD'].includes(method)) return reject('Unerwartete Fetch-Methode');
    const reply = (body, status = 200) => new Response(
      method === 'HEAD' ? null : JSON.stringify(body),
      { status, headers: { 'Content-Type': 'application/json', 'Content-Range': '*/0' } },
    );
    if (url.pathname === '/auth/v1/user' && method === 'GET') {
      calls.push({ kind: 'auth', url });
      return reply(authBody, authStatus);
    }
    const table = url.pathname.slice('/rest/v1/'.length);
    if (!url.pathname.startsWith('/rest/v1/') || ![
      'profiles', 'belegliste', 'leads', 'prescription_sessions', 'abrechnung',
      'prescriptions', 'mahnungen', 'bookings', 'ausfallrechnungen',
    ].includes(table)) return reject('Unerwarteter synthetischer Endpoint');
    if (table === 'profiles') {
      calls.push({ kind: 'profile', url });
      assert.equal(url.searchParams.get('select'), 'id,role,owner_id');
      assert.equal(url.searchParams.get('id'), `eq.${userId}`);
      return reply(profileStatus === 200 ? profile : { message: 'Synthetic profile failure', code: '42501' }, profileStatus);
    }
    calls.push({ kind: 'business', table, method, url });
    const data = table === 'prescriptions' && url.searchParams.get('select').startsWith('id,zuzahlung_eur,')
      ? prescriptions : [];
    return reply(data);
  };
  return { calls, violations, fetch };
}

function assertCalls(f, expected) {
  assert.deepEqual(f.violations, [], 'Fetch-Zaun darf nicht verletzt werden');
  assert.deepEqual(f.calls.map(c => c.kind), expected);
}

function assertTenantFilters(f, expectedCount) {
  const business = f.calls.filter(c => c.kind === 'business');
  assert.equal(business.length, expectedCount);
  for (const { table, url } of business) {
    const column = table === 'prescription_sessions' ? 'prescriptions.owner_id' : 'owner_id';
    assert.equal(url.searchParams.get(column), `eq.${userId}`, `Tenantfilter für ${table}`);
  }
}

test('B01 R-06: Statistik-Rollengrenze am echten Router und Supabase-SDK', async (t) => {
  let current;
  // Niemals auf ursprünglichen Fetch zurückfallen; SDK-Fehler können Throws abfangen,
  // deshalb zusätzlich jede Verletzung nach jedem Handler-Aufruf prüfen.
  t.mock.method(globalThis, 'fetch', (...args) => current.fetch(...args));
  const { default: router } = await import('./statistik.routes.js');
  const route = router.stack.find(layer => layer.route?.path === '/statistik' && layer.route.methods.get);
  assert.ok(route, 'Tatsächlichen GET /statistik-Handler prüfen');
  const handler = route.route.stack[0].handle;
  async function invoke(options = {}, token = 'synthetic-token') {
    current = fixture(options);
    const response = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await handler({
      headers: token === null ? {} : { authorization: `Bearer ${token}` },
      query: { monate: '6' },
    }, response);
    assert.deepEqual(current.violations, []);
    return { response, f: current };
  }

  await t.test('kein Token: 401 ohne Auth-, Profil- oder Fachabfrage', async () => {
    const { response, f } = await invoke({}, null);
    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.body, { error: 'Missing bearer token' });
    assertCalls(f, []);
  });

  for (const [name, authStatus, authBody] of [
    ['abgewiesenes Token', 401, { message: 'Synthetic rejected token', code: 'bad_jwt' }],
    ['abgelaufenes Token', 401, { message: 'Synthetic expired token', code: 'jwt_expired' }],
    ['Auth-Infrastrukturfehler', 503, { message: 'Synthetic auth unavailable' }],
    ['Auth-User nicht gefunden', 404, { message: 'Synthetic user not found', code: 'user_not_found' }],
  ]) {
    await t.test(`${name}: bestehende generische 401 ohne Profil/Fachdaten`, async () => {
      const { response, f } = await invoke({ authStatus, authBody });
      assert.equal(response.statusCode, 401);
      assert.deepEqual(response.body, { error: 'Invalid token' });
      assertCalls(f, ['auth']);
    });
  }

  for (const [name, options] of [
    ['Profil fehlt', { profile: null }],
    ['Profilabfrage fehlerhaft', { profileStatus: 403 }],
  ]) {
    await t.test(`${name}: bestehende 403 ohne Fachabfrage`, async () => {
      const { response, f } = await invoke(options);
      assert.equal(response.statusCode, 403);
      assert.deepEqual(response.body, { error: 'Profile not found' });
      assertCalls(f, ['auth', 'profile']);
    });
  }

  for (const [name, role, owner_id] of [
    ['Mitarbeiter mit owner_id', 'employee', otherOwnerId],
    ['Mitarbeiter ohne owner_id', 'employee', null],
    ['Rolle null', null, otherOwnerId],
    ['Rolle admin', 'admin', otherOwnerId],
    ['Rolle Owner', 'Owner', otherOwnerId],
    ['unbekannte Rolle', 'unknown', otherOwnerId],
  ]) {
    await t.test(`${name}: 403 NUR_INHABER vor jeder Fachabfrage`, async () => {
      const { response, f } = await invoke({ profile: { id: userId, role, owner_id } });
      assert.equal(response.statusCode, 403);
      assert.deepEqual(response.body, deniedBody);
      assert.ok(ownerKeys.every(key => !Object.hasOwn(response.body, key)), 'Keine Statistik-/Finanzschlüssel');
      assertCalls(f, ['auth', 'profile']);
    });
  }

  await t.test('Owner: 200 mit unveränderten Top-Level-Keys und allen Tenantfiltern', async () => {
    // Auch eine abweichende owner_id darf den Owner-Tenant nicht umbiegen.
    const { response, f } = await invoke({ profile: { id: userId, role: 'owner', owner_id: otherOwnerId } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(Object.keys(response.body), ownerKeys);
    assert.equal(response.body.monatlich.length, 6);
    for (const month of response.body.monatlich) {
      assert.deepEqual(Object.keys(month), ['monat', 'umsatz', 'bezahlt', 'offen']);
      assert.match(month.monat, /^\d{4}-\d{2}$/);
    }
    assertCalls(f, ['auth', 'profile', ...Array(11).fill('business')]);
    assertTenantFilters(f, 11);
  });

  await t.test('Owner: nachgeladene Zahlungseingänge bleiben auf Tenant und Rezept begrenzt', async () => {
    const { response, f } = await invoke({ prescriptions: [{
      id: prescriptionId, zuzahlung_eur: 25, ausstellungsdatum: '2020-01-01', zuzahlung_kassiert_am: null,
    }] });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(Object.keys(response.body), ownerKeys);
    assert.equal(response.body.offene_zuzahlungen, 1);
    assert.equal(response.body.offene_zuzahlungen_summe, 25);
    assertTenantFilters(f, 12);
    const payments = f.calls.filter(c => c.table === 'belegliste' && c.url.searchParams.has('prescription_id'));
    assert.equal(payments.length, 1);
    assert.equal(payments[0].url.searchParams.get('prescription_id'), `in.(${prescriptionId})`);
    assert.equal(payments[0].url.searchParams.get('type'), 'in.(zuzahlung,storno)');
  });
});
