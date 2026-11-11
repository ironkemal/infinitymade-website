/** P08 öffentliche Seiten: Alt gegen Neu, 1440/390. Synthetisch; Fremdhosts/Schreiben gesperrt. Bilder → P08_OUT. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { starteServer, starteBrowser, WURZEL } from '../redesign-harness.mjs';
const out = process.env.P08_OUT || `${WURZEL}/redesign/phase01/evidence/oeffentlich`;
await mkdir(out, { recursive: true });
const seiten = { login: 'login.html', signup: 'employee-signup.html', onboarding: 'onboarding.html', buchung: 'booking.html?slug=muster', anfrage: 'booking-request.html?slug=muster' };
const server = await starteServer(); const browser = await starteBrowser();
const erg = [];
try {
  for (const [name, pfad] of Object.entries(seiten)) for (const breite of [1440, 390]) for (const design of ['alt', 'neu']) {
    const ctx = await browser.newContext({ viewport: { width: breite, height: 900 }, locale: 'de-DE', serviceWorkers: 'block' });
    const log = { foreign: [], writes: [], errors: [] };
    await ctx.routeWebSocket('**/*', ws => ws.close());
    await ctx.route('**/*', route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin !== server.basis) { log.foreign.push(url.origin); return route.abort(); }
      if (!['GET', 'HEAD'].includes(req.method())) { log.writes.push(url.pathname); return route.fulfill({ status: 503, json: {} }); }
      if (url.pathname === '/api/config') return route.fulfill({ json: { supabaseUrl: 'https://synthetic.invalid', supabaseAnonKey: 'synthetic', apiBase: '/api', istKutu: false, telemetryEnabled: false, designVorschau: true } });
      if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 404, json: {} });
      if (url.pathname === '/vendor/supabase-js.js') return route.fulfill({ contentType: 'text/javascript', body: 'export const createClient = () => ({ auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } });' });
      return route.continue();
    });
    const page = await ctx.newPage(); page.on('pageerror', e => log.errors.push(e.message));
    await page.goto(`${server.basis}/${pfad}${pfad.includes('?') ? '&' : '?'}design=${design}`);
    await page.waitForTimeout(900);
    const z = await page.evaluate(() => ({ design: document.documentElement.dataset.design || null, ueberlauf: document.documentElement.scrollWidth - innerWidth, kleinesZiel: [...document.querySelectorAll('button:not([hidden]), a.btn, input[type=submit]')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 40 && e.getBoundingClientRect().height > 0).length }));
    await page.screenshot({ path: `${out}/${name}-${design}-${breite}.png`, animations: 'disabled' });
    assert.equal(log.foreign.length + log.writes.length, 0, `${name}: Fences`);
    erg.push({ name, design, breite, ...z, fehler: log.errors.length });
    await ctx.close();
  }
  for (const r of erg.filter(x => x.design === 'neu')) assert.equal(r.design, 'neu');
  for (const r of erg.filter(x => x.design === 'alt')) assert.equal(r.design, null);
  console.log(JSON.stringify(erg));
} finally { await browser.close(); await server.stop(); }
