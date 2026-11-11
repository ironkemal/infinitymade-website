/** P08: alle Onboarding-Schritte einzeln (Alt gegen Neu), Überlauf, axe (WCAG2 A/AA), Tastaturfokus sichtbar. Synthetisch. */
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { starteServer, starteBrowser, WURZEL } from '../redesign-harness.mjs';
const axe = await readFile(process.env.AXE_JS || '/tmp/axe/node_modules/axe-core/axe.min.js', 'utf8');
const out = process.env.P08_OUT || `${WURZEL}/redesign/phase01/evidence/oeffentlich-schritte`;
await mkdir(out, { recursive: true });
const server = await starteServer(); const browser = await starteBrowser();
const erg = [];
try {
  for (const breite of [1440, 390]) for (const design of ['alt', 'neu']) {
    const ctx = await browser.newContext({ viewport: { width: breite, height: 900 }, locale: 'de-DE', serviceWorkers: 'block' });
    await ctx.routeWebSocket('**/*', ws => ws.close());
    await ctx.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== server.basis) return route.abort();
      if (!['GET', 'HEAD'].includes(route.request().method())) return route.fulfill({ status: 503, json: {} });
      if (url.pathname === '/api/config') return route.fulfill({ json: { supabaseUrl: 'https://synthetic.invalid', supabaseAnonKey: 'synthetic', apiBase: '/api', istKutu: false, telemetryEnabled: false, designVorschau: true } });
      if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 404, json: {} });
      if (url.pathname === '/vendor/supabase-js.js') return route.fulfill({ contentType: 'text/javascript', body: 'export const createClient = () => ({ auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } });' });
      return route.continue();
    });
    const page = await ctx.newPage();
    await page.goto(`${server.basis}/onboarding.html?design=${design}`); await page.waitForTimeout(800);
    const schritte = await page.evaluate(() => [...document.querySelectorAll('.ob-step')].map(s => s.dataset.step));
    for (const id of schritte) {
      await page.evaluate((id) => document.querySelectorAll('.ob-step').forEach(s => { s.hidden = s.dataset.step !== id; }), id);
      await page.waitForTimeout(900);   // Einblend-Animation der Schritte abwarten (sonst misst axe halbtransparente Farben)
      await page.evaluate(axe);
      const v = await page.evaluate(async () => (await window.axe.run(document.querySelector('.ob-step:not([hidden])'), { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map(x => x.id + ':' + x.nodes.length));
      const z = await page.evaluate(() => ({ ueberlauf: document.documentElement.scrollWidth - innerWidth }));
      // Tastatur: jedes fokussierbare Element im Schritt zeigt beim Fokus einen sichtbaren Rand/Schatten
      const fokus = await page.evaluate(() => {
        const sicht = [...document.querySelectorAll('.ob-step:not([hidden]) :is(input,select,textarea,button,a[href]):not([type=hidden])')].filter(e => e.offsetParent);
        let ohne = 0;
        for (const e of sicht) { e.focus({ preventScroll: true }); const c = getComputedStyle(e); const hat = (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) || (c.boxShadow && c.boxShadow !== 'none'); if (!hat) ohne++; }
        return { gesamt: sicht.length, ohneFokusanzeige: ohne };
      });
      if (breite === 390 || id === 'account') await page.screenshot({ path: `${out}/${id}-${design}-${breite}.png`, animations: 'disabled' });
      erg.push({ breite, design, schritt: id, axe: v.join(',') || '-', ...z, ...fokus });
    }
    await ctx.close();
  }
  const neu = erg.filter(e => e.design === 'neu'), alt = erg.filter(e => e.design === 'alt');
  for (const n of neu) { assert.ok(n.ueberlauf <= 0, `Überlauf ${n.schritt}/${n.breite}`); assert.equal(n.ohneFokusanzeige, 0, `Fokus ${n.schritt}/${n.breite}`); }
  console.log(JSON.stringify({ schritte: neu.length / 2, neuAxe: neu.map(e => `${e.breite}/${e.schritt}: ${e.axe}`), altAxe: alt.map(e => `${e.breite}/${e.schritt}: ${e.axe}`) }, null, 1));
} finally { await browser.close(); await server.stop(); }
