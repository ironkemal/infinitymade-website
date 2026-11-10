/** Synthetic calendar toolbar target checks; no live accounts or data. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { starteServer, starteBrowser, WURZEL, wechsle } from '../redesign-harness.mjs';

const out = `${WURZEL}/redesign/phase01/evidence/calendar-targets`;
await mkdir(out, { recursive: true });
const fixture = (await readFile(`${WURZEL}/tools/browser-probe/redesign-fixture.js`, 'utf8'))
  .replace("sector: 'podologie'", "sector: 'physiotherapy'");
const server = await starteServer();
const browser = await starteBrowser();
const results = [];
try {
  for (const width of [390, 768, 1440]) for (const theme of ['light', 'dark']) {
    const altHashes = [];
    for (const variant of ['neu', 'alt', 'alt-without-calendar-css']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });
      const violations = [];
      await context.routeWebSocket('**/*', socket => { violations.push('WebSocket'); socket.close(); });
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== server.basis || !['GET', 'HEAD'].includes(request.method())) {
          violations.push(`${request.method()} ${url.origin}${url.pathname}`);
          return route.abort();
        }
        if (url.pathname === '/vendor/supabase-js.js') return route.fulfill({ contentType: 'text/javascript', body: fixture });
        if (variant === 'alt-without-calendar-css' && url.pathname === '/design/kalender.css') return route.fulfill({ contentType: 'text/css', body: '' });
        if (url.pathname === '/api/config') return route.fulfill({ json: { supabaseUrl: 'https://synthetic.invalid', supabaseAnonKey: 'synthetic', apiBase: '/api', istKutu: false, telemetryEnabled: false } });
        if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { records: [] } });
        return route.continue();
      });
      await context.addInitScript(theme => { localStorage.setItem('im-theme', theme); window.__rsDay = '2026-10-23'; window.__rsRolle = 'owner'; window.__rsSzenario = 'voll'; }, theme);
      const page = await context.newPage();
      page.on('pageerror', error => violations.push(error.message));
      await page.clock.setFixedTime(new Date('2026-10-23T10:15:00+02:00'));
      await page.goto(`${server.basis}/dashboard.html?design=${variant === 'neu' ? 'neu' : 'alt'}`);
      await page.waitForSelector('#sidebarNav .sidebar-item');
      await wechsle(page, 'calendar');
      await page.waitForTimeout(300);
      if (variant === 'neu') {
        const targets = await page.locator('#panel-calendar :is(#dayViewPrev, #dayViewNext, #calTodayBtn, #myBookingCopy, #calAddLeaveBtn, #calAddBookingBtn, .cal-view-btn, .cal-emp-chip)').evaluateAll(elements => elements.filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(e => ({ id: e.id || e.className, width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height })));
        for (const id of ['dayViewPrev', 'dayViewNext', 'calTodayBtn', 'myBookingCopy', 'calAddLeaveBtn', 'calAddBookingBtn']) assert.ok(targets.some(t => t.id === id), `missing ${id}`);
        assert.ok(targets.filter(t => t.id.includes('cal-view-btn')).length === 3, 'three view controls');
        assert.ok(targets.some(t => t.id.includes('cal-emp-chip')), 'employee filter exists');
        assert.ok(targets.every(t => t.width >= 44 && t.height >= 44), JSON.stringify(targets));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'viewport overflow');
        await page.screenshot({ path: `${out}/${width}-${theme}.png`, animations: 'disabled' });
        results.push({ width, theme, targets });
      } else altHashes.push(createHash('sha256').update(await page.screenshot({ animations: 'disabled' })).digest('hex'));
      assert.deepEqual(violations, [], 'network fence / page errors');
      await context.close();
    }
    assert.equal(altHashes[0], altHashes[1], 'Alt pixel regression');
    results.at(-1).altPixelEqual = true;
  }
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ cases: results.length, allTargetsAtLeast44: true, altPixelEqual: true }));
} finally { await browser.close(); await server.stop(); }
