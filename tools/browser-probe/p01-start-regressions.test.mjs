import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { starteServer, starteBrowser, WURZEL } from '../redesign-harness.mjs';

test('existing request loader publishes success, zero, loading and error states', async () => {
  const source = await readFile(`${WURZEL}/dashboard.js`, 'utf8');
  const loader = source.slice(source.indexOf('async function loadAnfragen(status)'), source.indexOf('function renderAnfragenList(requests)'));
  const badgeFunction = source.slice(source.indexOf('function updateAnfragenBadge('), source.indexOf('function showAnfrageDetail('));
  assert.ok(loader.startsWith('async function loadAnfragen')); assert.ok(badgeFunction.startsWith('function updateAnfragenBadge'));
  const badge = { dataset: {}, style: {} }, list = {};
  let response = { ok: true, requests: [{ status: 'pending' }, { status: 'pending' }] };
  let loadingObserved = false;
  const context = vm.createContext({ document: { getElementById: id => id === 'anfragenNavBadge' ? badge : list }, anfragenCurrentStatus: 'pending', anfragenCurrentRequests: [], currentProfile: { id: 'synthetic' }, supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'synthetic' } } }) } }, API: '/api', console: { error() {} }, renderAnfragenList() {}, fetch: async () => { loadingObserved = badge.dataset.pxStatus === 'laden' && !('pxCount' in badge.dataset); return { ok: response.ok, json: async () => ({ requests: response.requests }) }; } });
  vm.runInContext(loader + badgeFunction, context);
  await vm.runInContext('loadAnfragen()', context);
  assert.equal(loadingObserved, true); assert.deepEqual(badge.dataset, { pxStatus: 'ok', pxCount: '2' });
  response = { ok: true, requests: [] }; await vm.runInContext('loadAnfragen()', context);
  assert.deepEqual(badge.dataset, { pxStatus: 'ok', pxCount: '0' });
  response = { ok: false, requests: [] }; await vm.runInContext('loadAnfragen()', context);
  assert.deepEqual(badge.dataset, { pxStatus: 'fehler' });
  response = { ok: true, requests: undefined }; await vm.runInContext('loadAnfragen()', context);
  assert.deepEqual(badge.dataset, { pxStatus: 'fehler' });
});

test('start snapshot becomes unavailable after Berlin midnight instead of showing yesterday', async () => {
  const server = await starteServer(), browser = await starteBrowser();
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const violations = [];
    await context.routeWebSocket('**/*', socket => { violations.push('ws'); socket.close(); });
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== server.basis || request.method() !== 'GET') { violations.push(request.url()); return route.abort(); }
      if (url.pathname === '/p01-start-review.html') return route.fulfill({ contentType: 'text/html', body: '<html data-design="neu"><body><div id="sidebarNav"></div><section id="panel-overview" class="active"><div id="startAufgaben"></div></section></body></html>' });
      return route.continue();
    });
    const page = await context.newPage(); page.on('pageerror', error => violations.push(error.message));
    await page.clock.install({ time: new Date('2026-11-10T23:59:30+01:00') });
    await page.goto(`${server.basis}/p01-start-review.html`);
    await page.evaluate(async () => {
      const { montiereStartansicht } = await import('/module/startseite-ansicht.js');
      const adapter = montiereStartansicht({ uid: () => 'synthetic', rolle: () => 'owner', scope: () => 'synthetic-owner' });
      adapter.termine({ date: new Date(), bookings: [{ id: 'synthetic', user_id: 'synthetic', customer_name: 'Synthetic yesterday marker', start_time: '2026-11-10T23:59:50+01:00', end_time: '2026-11-11T00:20:00+01:00' }] });
    });
    assert.equal(await page.locator('#pxStartseite').getByText('Synthetic yesterday marker', { exact: true }).count() > 0, true);
    await page.clock.runFor(61000);
    assert.equal((await page.locator('#pxStartseite').innerText()).includes('Synthetic yesterday marker'), false);
    assert.equal((await page.locator('#pxStartseite').innerText()).includes('konnten nicht geladen werden'), true);
    assert.deepEqual(violations, []);
    await context.close();
  } finally { await browser.close(); await server.stop(); }
});
