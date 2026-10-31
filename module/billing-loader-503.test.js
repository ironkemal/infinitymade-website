import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const AUSFALL = 'Authentifizierungsdienst vorübergehend nicht verfügbar. Bitte später erneut versuchen.';
const antwort = status => ({ ok: status === 200, status, json: async () => status === 200
  ? { positions: [{ hpnr: '78010', preis: 36.1, zuzahlung: 3.61 }] }
  : { error: status === 503 ? AUSFALL : 'Invalid token', ...(status === 503 ? { code: 'AUTH_UNAVAILABLE' } : {}) } });
const session = { auth: { getSession: async () => ({ data: { session: { access_token: 'synthetic' } } }) } };
const els = new Map();
const el = id => {
  if (!els.has(id)) els.set(id, { id, dataset: {}, style: {}, innerHTML: '', textContent: '',
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {} });
  return els.get(id);
};
globalThis.document = { getElementById: el, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
globalThis.window = { addEventListener() {} };
// Kein Netzwerk: selbst Konfiguration nur synthetisch, alle anderen Ziele schlagen fehl.
globalThis.fetch = async url => {
  assert.equal(url, '/api/config');
  return { ok: true, json: async () => ({ supabaseUrl: 'https://synthetic.invalid', supabaseAnonKey: 'synthetic-public', apiBase: '/api' }) };
};
const podo = await import('./podologie-positionen.js');
const geld = await import('./rezeptinfo-geld.js');
const detail = await import('./abrechnung-detail.js');
const dashboard = fs.readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
const declaration = name => {
  const start = dashboard.indexOf(`function ${name}(`);
  assert.ok(start >= 0);
  return dashboard.slice(start).match(/^[\s\S]*?\n\}/)[0];
};

for (const status of [503, 401, 200]) test(`echter Podoloader: ${status}, parallel dedupliziert, Fehler nicht erfolgreich gecacht`, async () => {
  let calls = 0;
  globalThis.fetch = async (url, opts) => {
    assert.match(url, /^\/api\/billing\/positions\/podologie\?date=/);
    assert.equal(opts.headers.Authorization, 'Bearer synthetic');
    assert.equal(opts.method || 'GET', 'GET'); calls++;
    return antwort(status);
  };
  const date = `2026-11-${status === 503 ? '01' : status === 401 ? '02' : '03'}`;
  const [a, b] = await Promise.all([podo.ladePodoPositionen(session, date), podo.ladePodoPositionen(session, date)]);
  assert.equal(a, b); assert.equal(calls, 1); assert.ok(a instanceof Map);
  if (status !== 200) {
    assert.equal(a.size, 0); assert.equal(a.ladefehler.status, status);
    assert.match(a.ladefehler.message, status === 503 ? /Authentifizierungsdienst/ : /401/);
    await podo.ladePodoPositionen(session, date); assert.equal(calls, 2, 'nur bewusster Folgeaufruf versucht erneut');
  } else {
    assert.equal(a.get('78010').preis, 36.1); assert.equal(a.ladefehler, undefined);
    await podo.ladePodoPositionen(session, date); assert.equal(calls, 1);
  }
});

for (const status of [503, 401, 200]) test(`echter Physioloader: ${status}, ein Request, Hinweis, expliziter Folgeaufruf`, async () => {
  let calls = 0; const hints = [];
  const state = { positions: [], positionsLoaded: false };
  const ctx = vm.createContext({ _abState: state, supabase: session, API: '/api',
    AUTH_DIENST_AUSFALL: AUSFALL, escapeHtml: String, console: { warn() {} },
    showToast: message => hints.push(message), fetch: async (url, opts) => {
      assert.equal(url, '/api/billing/positions'); assert.equal(opts.method || 'GET', 'GET');
      assert.equal(opts.headers.Authorization, 'Bearer synthetic'); calls++; return antwort(status);
    } });
  vm.runInContext('async ' + declaration('loadPhysioPositions') + '\n' + declaration('buildPositionOptionsHtml'), ctx);
  const [a, b] = await Promise.all([ctx.loadPhysioPositions(), ctx.loadPhysioPositions()]);
  assert.equal(calls, 1); assert.equal(a, b); assert.ok(Array.isArray(a));
  assert.equal(state.positionsLoaded, status === 200);
  if (status !== 200) {
    assert.equal(a.ladefehler.status, status); assert.equal(hints.length, 1);
    assert.match(ctx.buildPositionOptionsHtml('X0501'), status === 503 ? /Authentifizierungsdienst/ : /401/);
  }
  await ctx.loadPhysioPositions(); assert.equal(calls, status === 200 ? 1 : 2);
});

for (const status of [503, 401, 200]) test(`echtes Abrechnungsdetail: ${status}, genau GET, Laden endet`, async () => {
  let calls = 0;
  globalThis.fetch = async (url, opts) => {
    assert.equal(url, '/api/billing/abrechnung/synthetic/zeilen');
    assert.equal(opts.method || 'GET', 'GET'); assert.equal(opts.headers.Authorization, 'Bearer synthetic');
    calls++; const result = antwort(status);
    if (status === 200) result.json = async () => ({ abrechnung: { id: 'synthetic', status: 'erstellt', dateiname: 'TSOLTEST' }, gruppen: [], zeilen: [], geld: {} });
    return result;
  };
  detail.initAbrechnungDetail({ supabase: session, apiBase: '/api', escapeHtml: String, aktionen: {} });
  const content = el('abDetailContent'); content.innerHTML = ''; content.dataset = {}; content.style = {};
  await detail.zeigeAbrechnungDetail('synthetic');
  assert.equal(calls, 1); assert.equal(content.style.opacity, ''); assert.doesNotMatch(content.innerHTML, /Lädt…/);
  assert.match(content.innerHTML, status === 503 ? /Authentifizierungsdienst/ : status === 401 ? /Invalid token/ : /Erstellt/);
});

for (const status of [503, 401, 200]) test(`Podo-Geldzeile: ${status}, ein Ladevorgang, sichtbarer Zustand und Kassiersperre`, async () => {
  let calls = 0, writes = 0;
  globalThis.fetch = async (url, opts) => {
    assert.match(url, /positions\/podologie/); assert.equal(opts.method || 'GET', 'GET'); calls++; return antwort(status);
  };
  const date = `2026-11-${status === 503 ? '04' : status === 401 ? '06' : '07'}`;
  const beh = [{ behandlungsdatum: date, hpnr_codes: ['78010'] }];
  const sb = { ...session, from(table) {
    const q = { select() { return q; }, eq() { return q; }, is() { return q; }, order() { return q; },
      in() { return q; }, limit() { return q; }, maybeSingle: async () => ({ data: null }),
      then(resolve) { return Promise.resolve({ data: table === 'podologie_behandlungen' ? beh : [], error: null }).then(resolve); } };
    return q;
  } };
  const button = {}; const content = { isConnected: true, innerHTML: '', querySelector: () => button };
  const rx = { id: 'synthetic', rezeptart: 'kassen', therapie_bereich: 'podo', heilmittel_position: '78010', anzahl_einheiten: 3, ausstellungsdatum: date };
  const wired = geld.verdrahteGeldzeile({ el: content, rx, erbracht: 1, deps: {
    sb, ownerId: 'synthetic-owner', sector: 'podologie', ladePodoPositionen: date => podo.ladePodoPositionen(sb, date),
    kassieren: () => { writes++; }, services: [],
  } });
  wired.patientGesetzt({ insurance_type: 'gkv' });
  for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1, 'Ausstellungs- und Behandlungstag teilen dasselbe Promise auch nach Fehler');
  if (status === 200) {
    assert.doesNotMatch(content.innerHTML, /role="status"/);
    assert.match(content.innerHTML, /13,61/);
  } else {
    assert.match(content.innerHTML, status === 503 ? /role="status"[^>]*>Authentifizierungsdienst/ : /role="status"[^>]*>Preiskatalog.*401/);
  }
  assert.doesNotMatch(content.innerHTML, /Position steht nicht im Katalog|Für diese Position steht kein Preis/);
  assert.equal(button.disabled, status !== 200); assert.equal(writes, 0);
});

test('Podo-Finder und Verordnungsrender: Dienstausfall statt fachlicher Kataloglücke', async () => {
  globalThis.fetch = async () => antwort(503);
  const finder = await podo.podoPositionsFinder(session, [{ behandlungsdatum: '2026-11-05' }]);
  assert.equal(finder('78010', '2026-11-05'), null);
  assert.equal(finder.ladefehler.status, 503);
  const { verordnungDetailHtml } = await import('./verordnung-detail.js');
  const html = verordnungDetailHtml({ id: 'synthetic', status: 'aktiv', rezeptart: 'kassen', behandlungseinheiten: 3,
    podologie_behandlungen: [{ behandlungsdatum: '2026-11-05', hpnr_codes: ['78010'] }] }, {
    quelle: 'podologie', escapeHtml: String,
    summe: { brutto: 0, gesamt: 10, unbekannt: ['78010'], ladefehler: finder.ladefehler },
  });
  assert.match(html, /role="status"[^>]*>Authentifizierungsdienst/);
  assert.doesNotMatch(html, /Ohne Preis im Katalog/);
});

for (const status of [503, 401, 200]) test(`echtes Podo-Verordnungsdetail: ${status}, ein GET, Ladezustand endet ohne Write`, async () => {
  let calls = 0;
  const date = `2026-12-${status === 503 ? '01' : status === 401 ? '02' : '03'}`;
  const rx = { id: 'synthetic-rx', owner_id: 'synthetic-owner', therapie_bereich: 'podo',
    abrechnung_status: 'gesendet', rezeptart: 'kassen', anzahl_einheiten: 3,
    podologie_behandlungen: [{ behandlungsdatum: date, hpnr_codes: ['78010'] }] };
  globalThis.fetch = async (url, opts) => {
    assert.equal(url, `/api/billing/positions/podologie?date=${date}`);
    assert.equal(opts.method || 'GET', 'GET'); assert.equal(opts.headers.Authorization, 'Bearer synthetic');
    calls++; return antwort(status);
  };
  const sb = { ...session, from(table) {
    assert.ok(['prescriptions', 'bookings'].includes(table), `unerwartete Tabelle: ${table}`);
    const q = { select() { return q; }, eq() { return q; }, neq() { return q; }, order() { return q; },
      maybeSingle: async () => ({ data: rx, error: null }),
      then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); } };
    return q; // Keine Schreibmethoden: schon der Versuch wirft.
  } };
  const content = { ...el('podo-verordnung'), dataset: { geladen: '1' }, style: {},
    querySelector: () => null, querySelectorAll: () => [] };
  const { zeigeVerordnungDetail } = await import('./verordnung-detail.js');
  const result = await zeigeVerordnungDetail({ supabase: sb, verordnungId: rx.id, quelle: 'podologie',
    inhalt: content, escapeHtml: String });
  assert.equal(result.id, rx.id); assert.equal(calls, 1); assert.equal(content.style.opacity, '');
  assert.equal(content.dataset.geladen, '1'); assert.doesNotMatch(content.innerHTML, /Lade…|Ohne Preis im Katalog/);
  if (status === 200) assert.match(content.innerHTML, /13,61/);
  else assert.match(content.innerHTML, status === 503 ? /role="status"[^>]*>Authentifizierungsdienst/ : /role="status"[^>]*>Preiskatalog.*401/);
});

test('Podo: Fehlerantwort wird nach bewusstem Folgeaufruf durch erfolgreichen Cache ersetzt', async () => {
  let calls = 0;
  globalThis.fetch = async () => antwort(++calls === 1 ? 503 : 200);
  const failed = await podo.ladePodoPositionen(session, '2026-12-04');
  assert.equal(failed.ladefehler.code, 'AUTH_UNAVAILABLE');
  const good = await podo.ladePodoPositionen(session, '2026-12-04');
  assert.equal(good.get('78010').preis, 36.1); assert.equal(good.ladefehler, undefined);
  assert.equal(await podo.ladePodoPositionen(session, '2026-12-04'), good); assert.equal(calls, 2);
});

test('Geldzustände: Ladehinweis verändert vorhandene Handlungen nicht', () => {
  const scenarios = [
    [{}, { zahler: 'gkv', unbekannt: true, gesamt: 0 }, 'keine'],
    [{}, { zahler: 'gkv', gesamt: 20 }, 'kassieren'],
    [{ zuzahlung_befreit: true }, { zahler: 'gkv' }, 'beleg'],
    [{ zuzahlung_kassiert_am: '2026-10-01' }, { zahler: 'gkv', unbekannt: true }, 'beleg'],
    [{}, { zahler: 'unbekannt' }, 'fragen'],
    [{}, { zahler: 'privat', unbekannt: true }, 'keine'],
  ];
  for (const [rx, stand, action] of scenarios) {
    assert.equal(geld.euroZustand(rx, stand).aktion, action);
    assert.equal(geld.euroZustand(rx, { ...stand, ladefehler: { message: AUSFALL } }).aktion, action);
  }
});

// Review-r1: echte Loader plus Frontend-Fallback und gespeicherte Beträge.
// Eindeutige Tage verhindern, dass erfolgreiche Loader-Caches Fehler verdecken.
async function geldProbe(behs, date, status) {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    assert.equal(opts.method || 'GET', 'GET');
    assert.equal(opts.headers.Authorization, 'Bearer synthetic');
    calls.push(url);
    return antwort(typeof status === 'function' ? status(url) : status);
  };
  const sb = { ...session, from(table) {
    const q = { select: () => q, eq: () => q, is: () => q, order: () => q, in: () => q, limit: () => q,
      maybeSingle: async () => ({ data: null }),
      then: resolve => Promise.resolve({ data: table === 'podologie_behandlungen' ? behs : [], error: null }).then(resolve) };
    return q; // Kein Write, Refresh oder Logout verfügbar.
  } };
  const button = {}, content = { isConnected: true, innerHTML: '', querySelector: () => button };
  const rx = { id: 'synthetic-fallback', rezeptart: 'kassen', therapie_bereich: 'podo',
    heilmittel_position: '78010', anzahl_einheiten: 3, ausstellungsdatum: date };
  const wired = geld.verdrahteGeldzeile({ el: content, rx, erbracht: 0, deps: {
    sb, ownerId: 'synthetic-owner', sector: 'podologie', katalog: [{ code: '78010', price: 36.1 }],
    ladePodoPositionen: d => podo.ladePodoPositionen(sb, d), services: [],
    kassieren: () => assert.fail('Kassieren nicht erlaubt'),
  } });
  wired.patientGesetzt({ insurance_type: 'gkv' });
  for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve));
  return { html: content.innerHTML, button, calls };
}

for (const status of [503, 401, 200]) test(`r1 Rezeptinfo ohne Behandlungen: Frontendpreis 36,10, Loader ${status}`, async () => {
  const date = `2027-01-${status === 503 ? '01' : status === 401 ? '02' : '03'}`;
  const result = await geldProbe([], date, status);
  assert.equal(result.calls.length, 1);
  assert.equal(result.button.disabled, status !== 200, 'Ladefehler muss Fallback-Kassieren sperren');
  if (status === 200) assert.match(result.html, /20,83/);
  else {
    assert.match(result.html, status === 503 ? /Authentifizierungsdienst/ : /HTTP 401/);
    assert.doesNotMatch(result.html, /20,83|108,30|0,00\s*€/);
  }
});

test('r1 Rezeptinfo gemischte Tage: 200-Zeile plus 503 ist keine kassierbare Teilsumme', async () => {
  const result = await geldProbe([
    { behandlungsdatum: '2027-01-04', hpnr_codes: ['78010'], betrag_gkv: 36.1 },
    { behandlungsdatum: '2027-01-05', hpnr_codes: ['78010'], betrag_gkv: 36.1 },
  ], '2027-01-04', url => url.endsWith('2027-01-05') ? 503 : 200);
  assert.equal(result.calls.length, 2);
  assert.equal(result.button.disabled, true);
  assert.match(result.html, /Authentifizierungsdienst/);
  assert.doesNotMatch(result.html, /13,61|36,10|0,00\s*€/);
});

test('r1 Rezeptinfo: bewusste Wiederöffnung nach 503 zeigt unveränderten 200-Betrag', async () => {
  const failed = await geldProbe([], '2027-01-06', 503);
  assert.equal(failed.button.disabled, true);
  const good = await geldProbe([], '2027-01-06', 200);
  assert.equal(good.calls.length, 1);
  assert.equal(good.button.disabled, false);
  assert.match(good.html, /20,83/);
  assert.doesNotMatch(good.html, /Authentifizierungsdienst/);
});

test('r1 bereits kassiert: bei Katalogausfall nur belegter Istbetrag, kein berechneter Ersatzbetrag', () => {
  const rx = { zuzahlung_kassiert_am: '2026-10-01' };
  const stand = { zahler: 'gkv', unbekannt: true, gesamt: 20.83, ladefehler: { message: AUSFALL } };
  const unknown = geld.euroZustand(rx, stand);
  assert.equal(unknown.aktion, 'beleg'); assert.equal(unknown.text, '—');
  const paid = geld.euroZustand(rx, { ...stand, kassiert: 12.5 });
  assert.equal(paid.aktion, 'beleg'); assert.match(paid.text, /12,50/);
  assert.doesNotMatch(paid.titel, /nachkassieren|zu viel/);
});

async function verordnungProbe(behs, status) {
  const original = structuredClone(behs), calls = [];
  const rx = { id: 'synthetic-saved-price', owner_id: 'synthetic-owner', therapie_bereich: 'podo',
    abrechnung_status: 'gesendet', rezeptart: 'kassen', anzahl_einheiten: 3, podologie_behandlungen: behs };
  globalThis.fetch = async (url, opts) => {
    assert.equal(opts.method || 'GET', 'GET');
    assert.equal(opts.headers.Authorization, 'Bearer synthetic'); calls.push(url);
    return antwort(typeof status === 'function' ? status(url) : status);
  };
  const sb = { ...session, from(table) {
    assert.ok(['prescriptions', 'bookings'].includes(table));
    const q = { select: () => q, eq: () => q, neq: () => q, order: () => q,
      maybeSingle: async () => ({ data: rx, error: null }),
      then: resolve => Promise.resolve({ data: [], error: null }).then(resolve) };
    return q;
  } };
  const content = { dataset: {}, style: {}, innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  const { zeigeVerordnungDetail } = await import('./verordnung-detail.js');
  const result = await zeigeVerordnungDetail({ supabase: sb, verordnungId: rx.id,
    quelle: 'podologie', inhalt: content, escapeHtml: String });
  assert.ok(result); assert.equal(content.style.opacity, '');
  assert.deepEqual(behs.map(({ _betrag, ...b }) => b), original, 'gespeicherte Preise bleiben unverändert');
  return { html: content.innerHTML, calls };
}

for (const status of [503, 401, 200]) test(`r1 echtes Detail: gespeicherte 36,10 bei Loader ${status}`, async () => {
  const date = `2027-02-${status === 503 ? '01' : status === 401 ? '02' : '03'}`;
  const result = await verordnungProbe([{ behandlungsdatum: date, hpnr_codes: ['78010'], betrag_gkv: 36.1 }], status);
  assert.equal(result.calls.length, 1);
  if (status === 200) { assert.match(result.html, /36,10/); assert.match(result.html, /13,61/); }
  else {
    assert.match(result.html, status === 503 ? /Authentifizierungsdienst/ : /HTTP 401/);
    assert.doesNotMatch(result.html, /0,00\s*€|36,10|13,61|10,00\s*€/);
    assert.match(result.html, /nicht berechenbar|unvollständig/);
  }
});

for (const gespeichert of [false, true]) test(`r1 echtes Detail: gemischte 200/503-Tage, gespeicherte Preise ${gespeichert}`, async () => {
  const good = gespeichert ? '2027-02-06' : '2027-02-04';
  const bad = gespeichert ? '2027-02-07' : '2027-02-05';
  const result = await verordnungProbe([good, bad].map(behandlungsdatum => ({
    behandlungsdatum, hpnr_codes: ['78010'], ...(gespeichert ? { betrag_gkv: 36.1 } : {}),
  })), url => url.endsWith(bad) ? 503 : 200);
  assert.equal(result.calls.length, 2);
  assert.match(result.html, /Authentifizierungsdienst/);
  assert.match(result.html, /nicht berechenbar|unvollständig/);
  assert.doesNotMatch(result.html, /0,00\s*€|13,61|10,00\s*€/);
  assert.equal((result.html.match(/36,10/g) || []).length, 1, 'nur verifizierte 200-Zeile behält ihren Betrag');
});
