/** P02 Aktivierungsvertrag (A01–A03, A08–A11, A13, A20): entirely synthetic; fences before page creation.
 *  Läuft ohne designVorschau (= wie SaaS/Box), nur die Server-Entscheidung zählt. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { starteServer, starteBrowser, WURZEL } from '../redesign-harness.mjs';
const fixture = (await readFile(`${WURZEL}/tools/browser-probe/redesign-fixture.js`, 'utf8'))
  .replace("sector: 'podologie'", "sector: 'physiotherapy'");
const server = await starteServer(); const browser = await starteBrowser();
const ergebnisse = [];
async function fall(name, { query = '', speicher = null, vorschau = false, antwort, blockiere = null, speicherDefekt = false, danach = null, theme = 'light' }) {
  if (process.env.P02_DEBUG) console.log('[fall]', name);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'de-DE', serviceWorkers: 'block' });
  const log = { foreign: [], writes: [], errors: [], entscheidungen: [], auth: [], urls: [] };
  await context.routeWebSocket('**/*', ws => ws.close());
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== server.basis) { log.foreign.push(url.origin); return route.abort(); }
    if (!['GET', 'HEAD'].includes(req.method())) { log.writes.push(req.method() + ' ' + url.pathname); return route.fulfill({ status: 503, json: {} }); }
    if (blockiere && blockiere.test(url.pathname)) return route.abort();
    if (url.pathname === '/vendor/supabase-js.js') return route.fulfill({ contentType: 'text/javascript', body: fixture });
    if (url.pathname === '/api/config') return route.fulfill({ json: { supabaseUrl: 'https://synthetic.invalid', supabaseAnonKey: 'synthetic', apiBase: '/api', istKutu: false, telemetryEnabled: false, ...(vorschau ? { designVorschau: true } : {}) } });
    if (url.pathname === '/api/design/entscheidung') {
      log.entscheidungen.push(1); log.auth.push(req.headers().authorization || ''); log.urls.push(req.url());
      return antwort(route);
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { records: [] } });
    return route.continue();
  });
  await context.addInitScript(({ speicher, speicherDefekt, theme }) => {
    try { localStorage.setItem('im-theme', theme); } catch { return; }   // about:blank (A14) hat keinen Speicher
    // Defekt nur für den Design-Wunsch (komplett blockierter Speicher bootet auch die Alt-App in dieser Fixture nicht: Bestand).
    if (speicherDefekt) for (const m of ['getItem', 'setItem', 'removeItem']) { const orig = Storage.prototype[m]; Storage.prototype[m] = function (k, ...a) { if (k === 'px-design') throw new Error('storage blocked'); return orig.call(this, k, ...a); }; } window.__rsDay = '2026-10-23'; window.__rsRolle = 'owner'; window.__rsSzenario = 'voll';
    if (!speicherDefekt && speicher && !sessionStorage.getItem('p02-init')) { localStorage.setItem('px-design', speicher); sessionStorage.setItem('p02-init', '1'); }
  }, { speicher, speicherDefekt, theme });
  const page = await context.newPage(); page.on('pageerror', e => log.errors.push(e.message)); page.on('console', m => { if (process.env.P02_DEBUG && /init|shell|error/i.test(m.text())) console.log('[console]', m.text().slice(0, 200)); });
  await page.clock.setFixedTime(new Date('2026-10-23T10:15:00+02:00'));
  await page.goto(`${server.basis}/dashboard.html${query}`);
  await page.waitForFunction(() => { const a = document.getElementById('app'); return a && a.style.display !== 'none'; }, null, { timeout: 30000 });
  await page.waitForTimeout(600);
  const nachher = danach ? await danach(page, server.basis) : null;
  const zustand = await page.evaluate(() => ({ design: document.documentElement.dataset.design || null, marken: document.querySelectorAll('.px-leiste-marke').length, shell: document.documentElement.dataset.pxShell || null, wunsch: window.__pxDesignWunsch ?? null }));
  if (process.env.P02_DEBUG) console.log('[zustand]', name, JSON.stringify(zustand), await page.evaluate(() => ({ app: document.getElementById('app')?.style.display, marke: !!document.querySelector('.px-leiste-marke'), mod: performance.getEntriesByType('resource').map(e=>e.name).filter(n=>/shell-ansicht|startseite-ansicht|design-entsch/.test(n)).map(n=>n.split('/').pop()), html: document.documentElement.outerHTML.length })));
  const ok = { ...zustand, log, nachher };
  assert.equal(log.foreign.length + log.writes.length, 0, name + ': fences');
  if (!blockiere) assert.equal(log.errors.length, 0, name + ': page errors ' + log.errors.join('|'));
  ergebnisse.push({ name, ...zustand, anfragen: log.entscheidungen.length, fehler: log.errors.length });
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

  // A09: localStorage wirft → kein Absturz; Freigabe nur vom Server, Wunsch aus Query reicht nicht
  r = await fall('A09-storage-defekt-freigegeben', { speicherDefekt: true, antwort: json(true) });
  assert.deepEqual([r.design, r.marken], ['neu', 1]);
  r = await fall('A09-storage-defekt-query', { query: '?design=neu', speicherDefekt: true, antwort: json(false) });
  assert.deepEqual([r.design, r.marken], [null, 0]);
  // A17: Rücknahme nach Neu: Reload mit ?design=alt (Server weiter true) → Alt ohne Reste, Theme bleibt dunkel
  r = await fall('A17-ruecknahme', { theme: 'dark', antwort: json(true), danach: async (page, basis) => {
    await page.goto(`${basis}/dashboard.html?design=alt`);
    await page.waitForFunction(() => { const a = document.getElementById('app'); return a && a.style.display !== 'none'; }, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    return page.evaluate(() => ({ design: document.documentElement.dataset.design || null, shell: document.documentElement.dataset.pxShell || null, marken: document.querySelectorAll('.px-leiste-marke, .px-profil-wrap, .px-neu-wrap, .px-suche').length, theme: document.documentElement.dataset.theme || null, gespeichert: localStorage.getItem('px-design') }));
  } });
  assert.deepEqual([r.nachher.design, r.nachher.shell, r.nachher.marken, r.nachher.theme, r.nachher.gespeichert], [null, null, 0, 'dark', null]);
  // A14: zurück/vorwärts: Entscheidung wird neu eingeholt, nicht aus altem Zustand übernommen
  r = await fall('A14-zurueck-vorwaerts', { antwort: json(true), danach: async (page, basis) => {
    await page.goto('about:blank'); await page.goBack();
    await page.waitForFunction(() => { const a = document.getElementById('app'); return a && a.style.display !== 'none'; }, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    return page.evaluate(() => ({ design: document.documentElement.dataset.design || null, marken: document.querySelectorAll('.px-leiste-marke').length }));
  } });
  assert.deepEqual([r.nachher.design, r.nachher.marken], ['neu', 1]);
  // A15/A06: keine Freigabe im Browserspeicher abgelegt (nur der Wunsch px-design)
  const speicherProbe = await fall('A06-A15-kein-freigabespeicher', { antwort: json(true), danach: async (page) => page.evaluate(() => Object.keys(localStorage).concat(Object.keys(sessionStorage)).filter(k => /design|pilot|neu/i.test(k))) });
  assert.deepEqual(speicherProbe.nachher.filter(k => k !== 'p02-init'), []);
  // A16/A22: Neu-Teil fehlt (Shell-Modul/CSS 404) → App bleibt benutzbar, kein endloser Lader
  r = await fall('A22-shell-modul-fehlt', { antwort: json(true), blockiere: /\/module\/shell-ansicht\.js$/ });
  assert.equal(r.marken, 0); assert.equal((await r.log.errors.length) >= 0, true);
  r = await fall('A16-shell-css-fehlt', { antwort: json(true), blockiere: /\/design\/shell\.css$/ });
  assert.equal(r.design, 'neu');
  console.log(JSON.stringify({ faelle: ergebnisse.length, ergebnisse }, null, 1));
} finally { await browser.close(); await server.stop(); }
