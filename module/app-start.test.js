import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { ladeAppKonfiguration, pruefeStartprofil, zeigeStartfehler } from './app-start.js';

const config = { supabaseUrl: 'https://synthetic.invalid', supabaseAnonKey: 'synthetic-public', apiBase: '/api' };
test('Konfiguration: gültiger Vertrag und relative Boxadresse bleiben erhalten', async () => {
  assert.deepEqual(await ladeAppKonfiguration({ fetchFn: async (url, opts) => {
    assert.equal(url, '/api/config'); assert.equal(opts.cache, 'no-store');
    return { ok: true, json: async () => config };
  } }), config);
});
test('Konfiguration: HTTP-/JSON-/Schemafehler werden abgelehnt', async () => {
  const responses = [{ ok: false }, { ok: true, json: async () => { throw new SyntaxError('bad JSON'); } },
    ...[{}, { ...config, supabaseAnonKey: '' }, { ...config, supabaseUrl: 'javascript:alert(1)' },
      { ...config, apiBase: '//external.invalid/api' }].map(value => ({ ok: true, json: async () => value }))];
  for (const response of responses) await assert.rejects(ladeAppKonfiguration({ fetchFn: async () => response }));
});
test('Konfiguration: Frist begrenzt sowohl Fetch als auch hängenden JSON-Body', async () => {
  for (const bodyHangs of [false, true]) {
    let signal;
    await assert.rejects(ladeAppKonfiguration({ timeoutMs: 10, fetchFn: (_, opts) => {
      signal = opts.signal;
      return bodyHangs ? Promise.resolve({ ok: true, json: () => new Promise(() => {}) }) : new Promise(() => {});
    } }), /CONFIG_TIMEOUT/);
    assert.equal(signal.aborted, true);
  }
});
test('Profil: fehlend, fremd, unbekannte Rolle und deaktivierter Mitarbeiter erhalten keine Ownerrechte', () => {
  for (const profile of [null, { id: 'other', role: 'owner' }, { id: 'user', role: 'admin' },
    { id: 'user', role: 'employee' }, { id: 'user', role: 'employee', owner_id: 'owner', is_active: false },
    { id: 'user', role: 'owner', plan_status: 'deleted' }]) assert.throws(() => pruefeStartprofil(profile, 'user'));
  for (const role of ['owner', 'employee']) {
    const profile = { id: 'user', role, owner_id: 'owner' };
    assert.equal(pruefeStartprofil(profile, 'user'), profile);
  }
});

function declaration(source, name) {
  const start = source.indexOf(`function ${name}(`);
  const match = source.slice(start).match(/^[\s\S]*?\n\}/);
  assert.ok(start >= 0 && match);
  return match[0];
}
const dashboard = fs.readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
test('Echte Rechtefunktionen: Mitarbeiter ohne Cache gesperrt, Owner bleibt freigegeben', async () => {
  const ctx = vm.createContext({ currentProfile: { role: 'employee' }, modulePermissions: null,
    currentBusiness: { id: 'practice' }, zeigeStartfehler() {}, supabase: { rpc: async () => ({ error: { message: 'offline' } }) } });
  vm.runInContext(declaration(dashboard, 'hasModuleAccess') + '\nasync ' + declaration(dashboard, 'loadModulePermissions'), ctx);
  assert.equal(ctx.hasModuleAccess('abrechnung'), false);
  await assert.rejects(ctx.loadModulePermissions(), /PERMISSIONS_UNAVAILABLE/);
  assert.equal(ctx.hasModuleAccess('abrechnung'), false);
  ctx.currentProfile = { role: 'owner' };
  await ctx.loadModulePermissions(); assert.equal(ctx.hasModuleAccess('abrechnung'), true);
  ctx.currentProfile = { role: 'employee' }; ctx.currentBusiness = null;
  await assert.rejects(ctx.loadModulePermissions(), /PERMISSIONS_UNAVAILABLE/);
});
test('Startfehler: zugängliche Sperre, vorhandene UI verborgen, Wiederholen lädt neu', () => {
  const elements = new Map(); let retried = false;
  const make = () => ({ hidden: false, style: {}, setAttribute(k, v) { this[k] = v; },
    append(...children) { this.children = children; }, addEventListener(_, fn) { this.click = fn; }, focus() {} });
  const app = make();
  const doc = { readyState: 'complete', body: { children: [app], append(el) { elements.set(el.id, el); } },
    createElement: make, getElementById: id => elements.get(id) };
  zeigeStartfehler(doc, () => { retried = true; });
  const panel = elements.get('appStartFehler');
  assert.equal(app.hidden, true); assert.equal(panel.role, 'alert');
  assert.equal(panel.children[0].textContent, 'Praxura konnte nicht geladen werden.');
  panel.children[2].click(); assert.equal(retried, true);
});
test('Echter Boot: Betriebsfehler zeigt Startfehler ohne Redirect, fehlende Sitzung führt zu Login', async () => {
  const begin = dashboard.indexOf('(async function boot()');
  const boot = dashboard.slice(begin, dashboard.indexOf('\n})();', begin) + '\n})();'.length);
  for (const scenario of ['no-session', 'profile-error', 'missing-profile', 'init-error']) {
    let startError = false;
    const session = scenario === 'no-session' ? null : { user: { id: 'user' } };
    const query = { select() { return this; }, eq() { return this; }, single: async () => ({
      data: scenario === 'missing-profile' ? null : { id: 'user', role: 'owner' },
      error: scenario === 'profile-error' ? {} : null,
    }) };
    const ctx = vm.createContext({ currentSession: null, currentProfile: null,
      supabase: { auth: { getSession: async () => ({ data: { session } }) }, from: () => query },
      window: { location: { href: 'dashboard.html' } }, console: { log() {}, error() {} },
      pruefeStartprofil, zeigeStartfehler: () => { startError = true; }, refreshKiControls() {},
      API: '/api', IST_KUTU: false, init: async () => { throw new Error('init failed'); } });
    await vm.runInContext(boot, ctx);
    assert.equal(ctx.window.location.href, scenario === 'no-session' ? 'login.html' : 'dashboard.html');
    assert.equal(startError, scenario !== 'no-session');
    if (scenario === 'missing-profile' || scenario === 'profile-error') assert.equal(ctx.currentProfile, null);
  }
});
