/** Synthetic section adapter probe. Product auth hook integrated separately. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { starteServer, starteBrowser, WURZEL, wechsle } from '../redesign-harness.mjs';
const out = `${WURZEL}/redesign/phase01/evidence/anamnese-sections`;
await mkdir(out, { recursive: true });
const fixture = (await readFile(`${WURZEL}/tools/browser-probe/redesign-fixture.js`, 'utf8')).replace("sector: 'podologie'", "sector: 'physiotherapy'");
const server = await starteServer(), browser = await starteBrowser(), results = [];
try {
  for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });
    const errors = [];
    await context.routeWebSocket('**/*', socket => { errors.push('WebSocket'); socket.close(); });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== server.basis || !['GET', 'HEAD'].includes(request.method())) { errors.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort(); }
      if (url.pathname === '/vendor/supabase-js.js') return route.fulfill({ contentType: 'text/javascript', body: fixture });
      if (url.pathname === '/api/config') return route.fulfill({ json: { supabaseUrl: 'https://synthetic.invalid', supabaseAnonKey: 'synthetic', apiBase: '/api', istKutu: false, telemetryEnabled: false } });
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { records: [] } });
      return route.continue();
    });
    await context.addInitScript(theme => { localStorage.setItem('im-theme', theme); window.__rsDay = '2026-10-23'; window.__rsRolle = 'owner'; window.__rsSzenario = 'voll'; }, theme);
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-23T10:15:00+02:00'));
    await page.goto(`${server.basis}/dashboard.html?design=alt`);
    await page.waitForSelector('#sidebarNav .sidebar-item'); await wechsle(page, 'anamnese');
    await page.waitForTimeout(1800); // existing setup ring settles before pixel baseline
    await page.locator('#anamHauptbeschwerde').fill('Synthetischer Entwurf bleibt erhalten.');
    await page.locator('#anamHauptbeschwerde').focus();
    await page.evaluate(() => {
      window.__anamInput = document.getElementById('anamHauptbeschwerde');
      window.__anamOriginalChildren = [...document.getElementById('panel-anamnese').children];
      window.__anamInput.setSelectionRange(3, 9);
      window.__anamScroll = [...document.querySelectorAll('*')].filter(element => element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth).map(element => ({ element, top: element.scrollTop, left: element.scrollLeft }));
    });
    await page.evaluate(() => window.__anamInput.blur()); await page.mouse.move(0, 0);
    await page.waitForTimeout(250);
    const initial = createHash('sha256').update(await page.screenshot({ path: `${out}/${width}-${theme}-alt-before.png`, animations: 'disabled' })).digest('hex');
    // Control the existing CSS/native-control repaint without mounting this adapter.
    await page.evaluate(() => { document.documentElement.dataset.design = 'neu'; });
    await page.screenshot({ animations: 'disabled' });
    await page.evaluate(() => { document.documentElement.dataset.design = 'alt'; });
    await page.evaluate(() => { for (const position of window.__anamScroll) { position.element.scrollTop = position.top; position.element.scrollLeft = position.left; } });
    const baseline = createHash('sha256').update(await page.screenshot({ path: `${out}/${width}-${theme}-alt-control.png`, animations: 'disabled' })).digest('hex');
    await page.evaluate(() => { window.__anamInput.focus({ preventScroll: true }); window.__anamInput.setSelectionRange(3, 9); });
    await page.evaluate(async () => {
      const { montiereAnamneseAbschnitte } = await import('/module/anamnese-abschnitte.js');
      window.__anamScope = 'synthetic-owner';
      window.__anamAdapter = montiereAnamneseAbschnitte({ uid: () => 'synthetic-owner', scope: () => window.__anamScope });
    });
    assert.equal(await page.locator('#panel-anamnese > .px-formular-inhalt').count(), 0, 'Alt must not wrap');
    await page.evaluate(() => { document.documentElement.dataset.design = 'neu'; });
    await page.waitForSelector('#panel-anamnese > .px-formular-inhalt');
    const identity = await page.evaluate(() => ({ same: document.getElementById('anamHauptbeschwerde') === window.__anamInput, focus: document.activeElement === window.__anamInput, selection: [window.__anamInput.selectionStart, window.__anamInput.selectionEnd], value: window.__anamInput.value }));
    assert.equal(identity.same, true); assert.equal(identity.focus, true); assert.deepEqual(identity.selection, [3, 9]);
    const links = page.locator('#panel-anamnese > .px-abschnitte a');
    assert.equal(await links.count(), 6, 'six current Physio sections');
    if (width === 1440) {
      await links.nth(1).click();
      assert.equal(await links.nth(1).evaluate(link => document.activeElement?.id === link.dataset.ziel), true, 'section focus');
      assert.ok((await links.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height))).every(height => height >= 44), 'section targets');
    } else assert.equal(await page.locator('#panel-anamnese > .px-abschnitte').isVisible(), false, 'confirmed mobile pattern');
    await page.screenshot({ path: `${out}/${width}-${theme}.png`, animations: 'disabled' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'overflow');
    const kioskHidden = await page.evaluate(() => {
      const panel = document.getElementById('panel-anamnese'), anchor = document.createComment('probe-kiosk'); panel.before(anchor);
      document.getElementById('kioskFormContent').append(panel);
      const hidden = getComputedStyle(panel.querySelector('.px-abschnitte')).display === 'none';
      anchor.after(panel); anchor.remove(); return hidden;
    });
    assert.equal(kioskHidden, true, 'section nav suppressed inside kiosk container');
    await page.evaluate(() => { document.documentElement.dataset.design = 'alt'; });
    await page.waitForFunction(() => !document.querySelector('#panel-anamnese > .px-formular-inhalt'));
    assert.equal(await page.evaluate(() => window.__anamOriginalChildren.every((node, index) => document.getElementById('panel-anamnese').children[index] === node)), true, 'original child order');
    assert.equal(await page.locator('#anamHauptbeschwerde').inputValue(), identity.value);
    await page.locator('#anamHauptbeschwerde').focus(); await page.mouse.move(0, 0);
    await page.evaluate(() => { window.__anamInput.setSelectionRange(3, 9); window.__anamInput.blur(); for (const position of window.__anamScroll) position.element.scrollTo({ top: position.top, left: position.left, behavior: 'instant' }); });
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => document.activeElement === window.__anamInput), false, 'canonical screenshot focus');
    const rollback = createHash('sha256').update(await page.screenshot({ path: `${out}/${width}-${theme}-alt-after.png`, animations: 'disabled' })).digest('hex');
    assert.equal(rollback, baseline, 'Alt pixel restoration');
    await page.evaluate(() => { document.documentElement.dataset.design = 'neu'; });
    await page.waitForSelector('#panel-anamnese > .px-formular-inhalt');
    await page.evaluate(() => { window.__anamScope = 'another-scope'; window.__anamAdapter.aktualisieren(); });
    assert.equal(await page.locator('#panel-anamnese > .px-formular-inhalt').count(), 0, 'scope change restores');
    assert.deepEqual(errors, [], 'fences and page errors');
    results.push({ width, theme, identity, sections: 6, kioskHidden, altPixelEqualToControl: true, initialHash: initial, controlHash: baseline, rollbackHash: rollback, existingDesignToggleChangesPixels: initial !== baseline, scopeRestore: true });
    await context.close();
  }
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ contexts: results.length, passed: true }));
} finally { await browser.close(); await server.stop(); }
