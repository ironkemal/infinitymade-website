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

test('Zusatz 9.3a: statistikMonatsfenster & berlinMonatKey (Europe/Berlin + kein Monatsende-Überlauf)', async () => {
  const { statistikMonatsfenster, berlinMonatKey } = await import('./statistik.routes.js');

  // Monatsende-Überlauf: 31.03.2026 mit monate=1 darf NICHT auf 03.03. springen
  const maerz31 = statistikMonatsfenster(1, new Date('2026-03-31T10:00:00Z'));
  assert.deepEqual(maerz31.monateListe, ['2026-03']);
  assert.equal(maerz31.cutoffDate, '2026-03-01');
  assert.equal(maerz31.cutoffIso, '2026-02-28T23:00:00.000Z'); // 01.03.2026 00:00 CET
  assert.equal(maerz31.startOfThisMonth, '2026-02-28T23:00:00.000Z');
  assert.equal(maerz31.startOfLastMonth, '2026-01-31T23:00:00.000Z');

  // Jahreswechsel + 6 Monate rückwärts am 31.01.2026
  const jan31 = statistikMonatsfenster(6, new Date('2026-01-31T12:00:00Z'));
  assert.deepEqual(jan31.monateListe, ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01']);
  assert.equal(jan31.cutoffDate, '2025-08-01');
  assert.equal(jan31.cutoffIso, '2025-07-31T22:00:00.000Z'); // 01.08.2025 00:00 CEST

  // Mitternachtsgrenze in Europe/Berlin (UTC noch Vormonat, Berlin schon neuer Monat)
  const kurzNachMitternachtNov = statistikMonatsfenster(1, new Date('2026-10-31T23:30:00Z'));
  assert.deepEqual(kurzNachMitternachtNov.monateListe, ['2026-11']);
  assert.equal(kurzNachMitternachtNov.cutoffIso, '2026-10-31T23:00:00.000Z'); // 01.11.2026 00:00 CET

  // Beleg-Gruppierung in Europe/Berlin statt UTC (Winterzeit CET & Sommerzeit CEST)
  assert.equal(berlinMonatKey('2026-10-31T23:30:00.000Z'), '2026-11'); // 01.11. 00:30 CET
  assert.equal(berlinMonatKey('2026-10-31T22:59:59.000Z'), '2026-10'); // 31.10. 23:59 CET
  assert.equal(berlinMonatKey('2026-06-30T22:30:00.000Z'), '2026-07'); // 01.07. 00:30 CEST
  assert.equal(berlinMonatKey('2026-06-30T21:59:59.000Z'), '2026-06'); // 30.06. 23:59 CEST
});

test('Zusatz 9.3b: Storno-Klassifizierung nach Originalbeleg (kein negatives bezahlt bei Rechnungs-Storno)', async (t) => {
  const { istForderungsBeleg } = await import('./statistik.routes.js');
  const origMap = new Map([
    ['orig-zuz', 'zuzahlung'],
    ['orig-aus', 'ausfall'],
    ['orig-rec', 'rechnung'],
    ['orig-bar', 'barverkauf'],
  ]);

  assert.equal(istForderungsBeleg({ type: 'zuzahlung' }, origMap), true);
  assert.equal(istForderungsBeleg({ type: 'ausfall' }, origMap), true);
  assert.equal(istForderungsBeleg({ type: 'rechnung' }, origMap), false);
  assert.equal(istForderungsBeleg({ type: 'barverkauf' }, origMap), false);

  // Storno folgt Originaltyp über storno_von
  assert.equal(istForderungsBeleg({ type: 'storno', storno_von: 'orig-zuz' }, origMap), true);
  assert.equal(istForderungsBeleg({ type: 'storno', storno_von: 'orig-aus' }, origMap), true);
  assert.equal(istForderungsBeleg({ type: 'storno', storno_von: 'orig-rec' }, origMap), false);
  assert.equal(istForderungsBeleg({ type: 'storno', storno_von: 'orig-bar' }, origMap), false);

  // Altstornos ohne storno_von: invoice_id vs. prescription_id vs. unreferenziert
  assert.equal(istForderungsBeleg({ type: 'storno', storno_von: null, invoice_id: 'inv-1', prescription_id: null }, origMap), false);
  assert.equal(istForderungsBeleg({ type: 'storno', storno_von: null, invoice_id: null, prescription_id: 'rx-1' }, origMap), true);
  assert.equal(istForderungsBeleg({ type: 'storno', storno_von: null, invoice_id: null, prescription_id: null }, origMap), true);

  // End-to-End am Router: Rechnungs-Storno (im Zeitraum + außerhalb des Fensters) drückt bezahlt NICHT ins Negative
  const nowIso = new Date().toISOString();
  const belege = [
    { id: 'b-zuz', created_at: nowIso, amount_eur: 20, type: 'zuzahlung', prescription_id: prescriptionId, invoice_id: null, storno_von: null },
    { id: 'b-rec', created_at: nowIso, amount_eur: 50, type: 'rechnung', prescription_id: null, invoice_id: 'inv-1', storno_von: null },
    { id: 'b-rec-storno', created_at: nowIso, amount_eur: -50, type: 'storno', prescription_id: null, invoice_id: 'inv-1', storno_von: 'b-rec' },
    { id: 'b-old-rec-storno', created_at: nowIso, amount_eur: -30, type: 'storno', prescription_id: null, invoice_id: null, storno_von: 'b-old-rec' },
  ];
  let lookedUpOldStorno = false;
  t.mock.method(globalThis, 'fetch', async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const reply = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Range': '*/0' } });
    if (url.pathname === '/auth/v1/user') return reply({ id: userId });
    const table = url.pathname.slice('/rest/v1/'.length);
    if (table === 'profiles') return reply({ id: userId, role: 'owner', owner_id: null });
    if (table === 'belegliste' && url.searchParams.get('select') === 'id,type') {
      assert.equal(url.searchParams.get('owner_id'), `eq.${userId}`);
      assert.equal(url.searchParams.get('id'), 'in.(b-old-rec)');
      lookedUpOldStorno = true;
      return reply([{ id: 'b-old-rec', type: 'rechnung' }]);
    }
    if (table === 'belegliste' && url.searchParams.has('created_at')) return reply(belege);
    return reply([]);
  });
  const { default: router } = await import('./statistik.routes.js');
  const handler = router.stack.find(layer => layer.route?.path === '/statistik' && layer.route.methods.get).route.stack[0].handle;
  const response = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handler({ headers: { authorization: 'Bearer synthetic-token' }, query: { monate: '1' } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(lookedUpOldStorno, true);
  assert.equal(response.body.monatlich.length, 1);
  // umsatz = 20 + 50 - 50 - 30 = -10 (alle Kassenbuch-Buchungen), bezahlt = +20 (nur Zuzahlung, Rechnungs-Stornos zählen nicht!)
  assert.equal(response.body.monatlich[0].umsatz, -10);
  assert.equal(response.body.monatlich[0].bezahlt, 20);
});
