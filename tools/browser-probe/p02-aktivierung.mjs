/** P02 Aktivierungsvertrag (A01–A03, A08–A11, A13, A20): entirely synthetic; fences before page creation.
 *  Läuft ohne designVorschau (= wie SaaS/Box), nur die Server-Entscheidung zählt. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { starteServer, starteBrowser, WURZEL } from '../redesign-harness.mjs';
const fixture = (await readFile(`${WURZEL}/tools/browser-probe/redesign-fixture.js`, 'utf8'))
  .replace("sector: 'podologie'", "sector: 'physiotherapy'");
const server = await starteServer(); const browser = await starteBrowser();
const ergebnisse = [];
async function fall(name, { query = '', speicher = null, vorschau = false, antwort }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'de-DE', serviceWorkers: 'block' });
  const log = { foreign: [], writes: [], errors: [], entscheidungen: [], auth: [], urls: [] };
  await context.routeWebSocket('**/*', ws => ws.close());
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== server.basis) { log.foreign.push(url.origin); return route.abort(); }
    if (!['GET', 'HEAD'].includes(req.method())) { log.writes.push(req.method() + ' ' + url.pathname); return route.fulfill({ status: 503, json: {} }); }
    if (url.pathname === '/vendor/supabase-js.js') return route.fulfill({ contentType: 'text/javascript', body: fixture });
    if (url.pathname === '/api/config') return route.fulfill({ json: { supabaseUrl: 'https://synthetic.invalid', supabaseAnonKey: 'synthetic', apiBase: '/api', istKutu: false, telemetryEnabled: false, ...(vorschau ? { designVorschau: true } : {}) } });
    if (url.pathname === '/api/design/entscheidung') {
      log.entscheidungen.push(1); log.auth.push(req.headers().authorization || ''); log.urls.push(req.url());
      return antwort(route);
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { records: [] } });
    return route.continue();
  });
  await context.addInitScript(({ speicher }) => {
    localStorage.setItem('im-theme', 'light'); window.__rsDay = '2026-10-23'; window.__rsRolle = 'owner'; window.__rsSzenario = 'voll';
    if (speicher && !sessionStorage.getItem('p02-init')) { localStorage.setItem('px-design', speicher); sessionStorage.setItem('p02-init', '1'); }
  }, { speicher });
  const page = await context.newPage(); page.on('pageerror', e => log.errors.push(e.message)); page.on('console', m => { if (process.env.P02_DEBUG && /init|shell|error/i.test(m.text())) console.log('[console]', m.text().slice(0, 200)); });
  await page.clock.setFixedTime(new Date('2026-10-23T10:15:00+02:00'));
  await page.goto(`${server.basis}/dashboard.html${query}`);
  await page.waitForFunction(() => { const a = document.getElementById('app'); return a && a.style.display !== 'none'; }, null, { timeout: 30000 });
  await page.waitForTimeout(600);
  const zustand = await page.evaluate(() => ({ design: document.documentElement.dataset.design || null, marken: document.querySelectorAll('.px-leiste-marke').length, shell: document.documentElement.dataset.pxShell || null, wunsch: window.__pxDesignWunsch ?? null }));
  if (process.env.P02_DEBUG) console.log('[zustand]', name, JSON.stringify(zustand), await page.evaluate(() => ({ app: document.getElementById('app')?.style.display, marke: !!document.querySelector('.px-leiste-marke'), mod: performance.getEntriesByType('resource').map(e=>e.name).filter(n=>/shell-ansicht|startseite-ansicht|design-entsch/.test(n)).map(n=>n.split('/').pop()), html: document.documentElement.outerHTML.length })));
  const ok = { ...zustand, log };
  assert.equal(log.foreign.length + log.writes.length, 0, name + ': fences');
  assert.equal(log.errors.length, 0, name + ': page errors ' + log.errors.join('|'));
  ergebnisse.push({ name, ...zustand, anfragen: log.entscheidungen.length });
  await context.close();
  return ok;
}
const json = (neu) => (route) => route.fulfill({ json: { neu } });
try {
  // A01/A02: nicht freigegeben, ?design=neu und gespeichertes Neu → Alt, Anwendung läuft
  let r = await fall('A02-nicht-freigegeben', { query: '?design=neu', antwort: json(false) });
  assert.deepEqual([r.design, r.marken, r.shell], [null, 0, null]);
  r = await fall('A02-gespeichert-neu', { speicher: 'neu', antwort: json(false) });
  assert.equal(r.design, null); assert.equal(r.marken, 0);
  // A03/A13: freigegeben (auch ohne Query) → Neu, genau ein Shellstart; Bearer, kein Token in URL (A20)
  r = await fall('A03-freigegeben', { antwort: json(true) });
  assert.deepEqual([r.design, r.marken, r.shell], ['neu', 1, 'v2']);
  assert.equal(r.log.entscheidungen.length, 1); assert.match(r.log.auth[0], /^Bearer .+/);
  assert.ok(r.log.urls.every(u => !/token|tenant|role/i.test(new URL(u).search)), 'keine Parameter in URL');
  // A08: 500, 403, ungültiges JSON, falscher Typ → Alt
  for (const [n, a] of [['500', route => route.fulfill({ status: 500, json: { neu: true } })], ['403', route => route.fulfill({ status: 403, json: { neu: true } })],
    ['json', route => route.fulfill({ status: 200, body: 'kaputt{', contentType: 'application/json' })], ['typ', route => route.fulfill({ json: { neu: 'true' } })], ['abbruch', route => route.abort()]]) {
    r = await fall('A08-' + n, { antwort: a }); assert.deepEqual([r.design, r.marken], [null, 0], n);
  }
  // A10: freigegeben, aber ausdrücklich Alt → Alt, gespeichertes Neu wird nicht erzwungen
  r = await fall('A10-alt-gewaehlt', { query: '?design=alt', speicher: 'neu', antwort: json(true) });
  assert.deepEqual([r.design, r.marken], [null, 0]);
  // A18: lokale Vorschau nur mit Konfig-Flag, ohne Servergespräch
  r = await fall('A18-vorschau', { query: '?design=neu', vorschau: true, antwort: json(false) });
  assert.deepEqual([r.design, r.marken, r.shell], ['neu', 1, 'v2']); assert.equal(r.log.entscheidungen.length, 0);
  r = await fall('A18-vorschau-ohne-wunsch', { vorschau: true, antwort: json(false) });
  assert.equal(r.design, null);
  console.log(JSON.stringify({ faelle: ergebnisse.length, ergebnisse }, null, 1));
} finally { await browser.close(); await server.stop(); }
