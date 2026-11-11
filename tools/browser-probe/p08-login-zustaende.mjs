/** P08: Login gefüllt + Fehlermeldungen (falsches Passwort, unbestätigte E-Mail), Alt gegen Neu, 390/1440. Synthetisch, SDK-Stub. */
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { starteServer, starteBrowser, WURZEL } from '../redesign-harness.mjs';
const axe = await readFile(process.env.AXE_JS || '/tmp/axe/node_modules/axe-core/axe.min.js', 'utf8');
const out = process.env.P08_OUT || `${WURZEL}/redesign/phase01/evidence/oeffentlich-login`;
await mkdir(out, { recursive: true });
const stub = (fehler) => `export const createClient = () => ({ auth: { getSession: async () => ({ data: { session: null } }), getUser: async () => ({ data: { user: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signInWithPassword: async () => ({ error: { message: '${fehler}', code: '${fehler === 'Email not confirmed' ? 'email_not_confirmed' : 'invalid_credentials'}' } }), resend: async () => ({ error: null }) } });`;
const server = await starteServer(); const browser = await starteBrowser();
const erg = [];
try {
  for (const fehler of ['Invalid login credentials', 'Email not confirmed']) for (const breite of [1440, 390]) for (const design of ['alt', 'neu']) {
    const ctx = await browser.newContext({ viewport: { width: breite, height: 900 }, locale: 'de-DE', serviceWorkers: 'block' });
    await ctx.routeWebSocket('**/*', ws => ws.close());
    await ctx.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== server.basis) return route.abort();
      if (!['GET', 'HEAD'].includes(route.request().method())) return route.fulfill({ status: 503, json: {} });
      if (url.pathname === '/api/config') return route.fulfill({ json: { supabaseUrl: 'https://synthetic.invalid', supabaseAnonKey: 'synthetic', apiBase: '/api', istKutu: false, telemetryEnabled: false, designVorschau: true } });
      if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 404, json: {} });
      if (url.pathname === '/vendor/supabase-js.js') return route.fulfill({ contentType: 'text/javascript', body: stub(fehler) });
      return route.continue();
    });
    const page = await ctx.newPage(); const fehlerSeite = []; page.on('pageerror', e => fehlerSeite.push(e.message));
    await page.goto(`${server.basis}/login.html?design=${design}`); await page.waitForTimeout(700);
    await page.fill('#email', 'person@example.invalid'); await page.fill('#password', 'falsches-passwort');
    await page.keyboard.press('Enter');   // per Tastatur absenden
    await page.waitForTimeout(900);
    const sichtbar = await page.evaluate(() => { const m = document.getElementById('message'), b = document.getElementById('confirmBanner'); return { meldung: m?.textContent.trim() || '', banner: !!b && getComputedStyle(b).display !== 'none', ueberlauf: document.documentElement.scrollWidth - innerWidth, knopfWieder: !document.getElementById('submitBtn').disabled }; });
    await page.evaluate(axe);
    const v = await page.evaluate(async () => (await window.axe.run(document.body, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map(x => x.id + ':' + x.nodes.length).join(',') || '-');
    await page.screenshot({ path: `${out}/${fehler.startsWith('Email') ? 'unbestaetigt' : 'falsch'}-${design}-${breite}.png`, animations: 'disabled' });
    erg.push({ fehler, breite, design, ...sichtbar, axe: v, seitenfehler: fehlerSeite.length });
    assert.equal(sichtbar.knopfWieder, true, 'Knopf wieder aktiv');
    assert.ok(sichtbar.ueberlauf <= 0, 'kein Überlauf');
    if (fehler.startsWith('Invalid')) assert.ok(sichtbar.meldung.length > 5, 'Fehlermeldung sichtbar'); else assert.equal(sichtbar.banner, true, 'Bestätigungshinweis sichtbar');
    await ctx.close();
  }
  console.log(JSON.stringify(erg, null, 1));
} finally { await browser.close(); await server.stop(); }
