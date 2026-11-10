/** Isolated shell mounting after the current synthetic app boot. No product hook injected. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { starteServer, starteBrowser, WURZEL } from '../redesign-harness.mjs';
const out = `${WURZEL}/redesign/phase01/evidence/shell`;
await mkdir(out, { recursive: true });
const fixture = (await readFile(`${WURZEL}/tools/browser-probe/redesign-fixture.js`, 'utf8')).replace("sector: 'podologie'", "sector: 'physiotherapy'");
const sourcePaths = ['design/shell.css', 'module/shell-ansicht.js', 'module/kopf-menue.js', 'module/kopf-profil.js', 'module/kopf-neu.js', 'module/kopf-suche-ansicht.js', 'module/leiste-flyout.js', 'module/schublade-neu.js'];
const sourceHashes = await Promise.all(sourcePaths.map(async path => ({ path, sha256: createHash('sha256').update(await readFile(`${WURZEL}/${path}`)).digest('hex') })));
const server = await starteServer(), browser = await starteBrowser(), results = [];
try {
  for (const width of (process.env.P01_SHELL_CONTROL ? [390] : [390, 1024, 1025, 1440])) for (const theme of (process.env.P01_SHELL_CONTROL ? ['light'] : ['light', 'dark'])) for (const role of (process.env.P01_SHELL_CONTROL ? ['owner'] : ['owner', 'employee'])) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });
    const violations = [];
    await context.routeWebSocket('**/*', socket => { violations.push('WebSocket'); socket.close(); });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== server.basis || !['GET', 'HEAD'].includes(request.method())) { violations.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort(); }
      if (url.pathname === '/vendor/supabase-js.js') return route.fulfill({ contentType: 'text/javascript', body: fixture });
      if (url.pathname === '/api/config') return route.fulfill({ json: { supabaseUrl: 'https://synthetic.invalid', supabaseAnonKey: 'synthetic', apiBase: '/api', istKutu: false, telemetryEnabled: false } });
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { records: [] } });
      return route.continue();
    });
    await context.addInitScript(({ theme, role }) => { localStorage.setItem('im-theme', theme); window.__rsDay = '2026-10-23'; window.__rsRolle = role; window.__rsSzenario = 'voll'; }, { theme, role });
    const page = await context.newPage();
    page.on('pageerror', error => violations.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-23T10:15:00+02:00'));
    await page.goto(`${server.basis}/dashboard.html?design=alt`);
    await page.waitForSelector('#sidebarNav .sidebar-item'); await page.waitForTimeout(350);
    // Einrichtung has a documented delayed post-auth render; compare equally ready states.
    if (role === 'owner') await page.waitForFunction(() => !!document.getElementById('einrichtungRing')?.getAttribute('aria-label'));
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ url: `${server.basis}/design/shell.css` });
    await page.evaluate(() => {
      window.__shellOriginalNodes = [...document.querySelectorAll('#sidebarNav .sidebar-item')];
      window.__shellOriginalInert = document.getElementById('mainArea').inert;
    });
    const baseline = createHash('sha256').update(await page.screenshot({ path: `${out}/debug-${width}-${theme}-${role}-before.png`, animations: 'disabled' })).digest('hex');
    // Differential control: the current candidate already changes 21 antialias pixels on
    // a Neu→Alt reflow at 390/light/owner, without mounting any shell module.
    await page.evaluate(() => { document.documentElement.dataset.design = 'neu'; }); await page.waitForTimeout(1000);
    if (width <= 1024) {
      await page.locator('#hamburger').click(); await page.waitForTimeout(250);
      await page.locator('#sidebarOverlay').click({ position: { x: width - 8, y: 400 } }); await page.waitForTimeout(250);
    } else {
      await page.locator('#sidebarCollapseBtn').click(); await page.waitForTimeout(300);
      await page.locator('#sidebarCollapseBtn').click(); await page.waitForTimeout(300);
    }
    await page.evaluate(() => { document.documentElement.removeAttribute('data-design'); }); await page.waitForTimeout(1000);
    await page.evaluate(() => document.activeElement?.blur()); await page.mouse.move(0, 0);
    const controlAfter = createHash('sha256').update(await page.screenshot({ path: `${out}/control-${width}-${theme}-${role}-after.png`, animations: 'disabled' })).digest('hex');
    if (process.env.P01_SHELL_CONTROL) {
      const control = { withoutShellMount: true, baseline, after: controlAfter, pixelEqual: baseline === controlAfter, violations };
      await writeFile(`${out}/control.json`, JSON.stringify(control, null, 2)); console.log(JSON.stringify(control));
      await context.close(); continue;
    }
    const denied = await page.evaluate(async () => (await import('/module/shell-ansicht.js?v=20261110p01shell')).montiereShellansicht({}) === null);
    assert.equal(denied, true, 'unauthenticated mount denied');
    await page.evaluate(async role => {
      window.__shellIdentity = { uid: 'synthetic-user', role, scope: 'synthetic-scope' };
      const { montiereShellansicht } = await import('/module/shell-ansicht.js?v=20261110p01shell');
      window.__shellSearchCalls = { load: 0, matches: 0, label: 0 };
      window.__shell = montiereShellansicht({ uid: () => window.__shellIdentity.uid, rolle: () => window.__shellIdentity.role, scope: () => window.__shellIdentity.scope, name: () => role === 'owner' ? 'Synthetische Inhaberin' : 'Synthetischer Mitarbeiter',
        suche: { ensureLeadsCache: async () => { window.__shellSearchCalls.load++; return [{ id: 'synthetic-search-patient', first_name: 'Suchprobe', last_name: 'Synthetisch' }]; },
          patientMatchesQuery: (lead, q) => { window.__shellSearchCalls.matches++; return `${lead.first_name} ${lead.last_name}`.toLowerCase().includes(q); },
          displayNameWithBirth: lead => { window.__shellSearchCalls.label++; return `${lead.first_name} ${lead.last_name}`; },
          oeffnePatient: id => { window.__shellSelectedPatient = id; } } });
    }, role);
    const mountedAlt = createHash('sha256').update(await page.screenshot({ path: `${out}/mounted-alt-${width}-${theme}-${role}.png`, animations: 'disabled' })).digest('hex');
    assert.equal(mountedAlt, controlAfter, 'mount on Alt changes control pixels');
    await page.evaluate(() => { document.documentElement.dataset.design = 'neu'; });
    await page.waitForFunction(() => document.documentElement.dataset.pxShell === 'v2');
    await page.waitForTimeout(300);
    const entry = { width, theme, role, unauthenticatedDenied: denied, mountedAltPixelEqual: true, control: { baseline, after: controlAfter, pixelEqual: baseline === controlAfter } };
    entry.navigationIdentity = await page.evaluate(() => window.__shellOriginalNodes.every(node => node.isConnected && document.querySelector(`#sidebarNav .sidebar-item[data-panel="${node.dataset.panel}"]`) === node));
    assert.equal(entry.navigationIdentity, true);
    assert.equal(await page.locator('#sidebarNav [data-panel="overview"] > span:not(.icon):not(.nav-badge)').textContent(), 'Start');
    for (const id of ['ueberblick', 'anamnese', 'fussstatus', 'notizen']) {
      const node = page.locator(`#sidebarNav .sidebar-item[data-panel="${id}"]`);
      if (await node.count()) assert.equal(await node.evaluate(el => el.hidden), false, `${id} hidden by shell`);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'global overflow');
    await page.locator('.px-profil').click();
    assert.equal(await page.locator('#pxProfilMenue').isVisible(), true);
    assert.equal(await page.locator('#pxProfilMenue [role=menuitem]').last().textContent(), 'Abmelden');
    await page.keyboard.press('Escape'); assert.equal(await page.locator('.px-profil').evaluate(el => document.activeElement === el), true, 'profile Escape focus');
    await page.locator('.px-neu').click(); assert.ok(await page.locator('#pxNeuMenue [role=menuitem]').count() > 0, 'new menu empty');
    await page.keyboard.press('Escape');
    if (width >= 900) {
      await page.locator('#themeToggle').focus(); await page.keyboard.press('/');
      assert.equal(await page.locator('#pxSuche').evaluate(el => document.activeElement === el), true, 'slash search focus');
      await page.locator('#pxSuche').fill('Suchprobe');
      await page.locator('.px-suche li[data-id="synthetic-search-patient"]').click();
      assert.equal(await page.evaluate(() => window.__shellSelectedPatient), 'synthetic-search-patient');
      const calls = await page.evaluate(() => window.__shellSearchCalls);
      assert.ok(calls.load > 0 && calls.matches > 0 && calls.label > 0, 'injected search delegates');
      entry.patientSearchDelegates = true;
    } else assert.equal(await page.locator('#pxSuche').isVisible(), false, 'small-screen search hidden');
    if (width <= 1024) {
      await page.locator('#hamburger').click(); await page.waitForTimeout(250);
      assert.equal(await page.locator('#sidebar').evaluate(el => el.classList.contains('open') && !el.inert), true);
      assert.equal(await page.locator('#mainArea').evaluate(el => el.inert), true);
      for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.getElementById('sidebar').contains(document.activeElement) || document.activeElement.id === 'hamburger'), true, 'drawer focus trap'); }
      await page.keyboard.press('Escape'); await page.waitForTimeout(250);
      assert.equal(await page.locator('#sidebar').evaluate(el => !el.classList.contains('open') && el.inert), true);
      assert.equal(await page.locator('#hamburger').evaluate(el => document.activeElement === el && el.getAttribute('aria-expanded') === 'false'), true);
      entry.drawerEscapeFocusAndInert = true;
    } else {
      await page.locator('.px-einklappen').click(); await page.waitForTimeout(300);
      assert.equal(await page.locator('#sidebar').evaluate(el => el.classList.contains('collapsed') && el.getBoundingClientRect().width === 72), true, '72px collapsed sidebar');
      await page.locator('#sidebarNav .nav-group-header').first().click(); assert.ok(await page.locator('#pxFlyout [role=menuitem]').count() > 0, 'flyout empty');
      await page.keyboard.press('Escape'); assert.equal(await page.locator('#sidebarNav .nav-group-header').first().evaluate(el => document.activeElement === el), true);
      await page.locator('.px-einklappen').click(); await page.waitForTimeout(300); entry.collapseFlyoutEscape = true;
    }
    await page.locator('#themeToggle').focus();
    if (role === 'owner') await page.screenshot({ path: `${out}/${width}-${theme}.png`, animations: 'disabled' });
    await page.evaluate(() => { document.documentElement.removeAttribute('data-design'); }); await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => !document.documentElement.dataset.pxShell && document.getElementById('mainArea').inert === window.__shellOriginalInert), true, 'Alt restore/inert');
    // Explicit baseline focus, because menu operations intentionally move keyboard focus.
    await page.locator('#themeToggle').blur();
    await page.mouse.move(0, 0);
    const restored = createHash('sha256').update(await page.screenshot({ path: `${out}/debug-${width}-${theme}-${role}-after.png`, animations: 'disabled' })).digest('hex');
    entry.restoredAltMatchesControl = restored === controlAfter;
    entry.restoredAltHash = restored;
    await page.evaluate(() => { document.documentElement.dataset.design = 'neu'; }); await page.waitForTimeout(100);
    const changedField = width === 390 ? 'scope' : width === 1024 ? 'uid' : 'role';
    await page.evaluate(field => { window.__shellIdentity[field] = 'different-context'; window.__shell.aktualisieren(); }, changedField);
    assert.equal(await page.evaluate(() => !document.documentElement.dataset.pxShell && document.querySelector('.px-profil-wrap').hidden && document.getElementById('mainArea').inert === window.__shellOriginalInert), true, 'scope mismatch fail closed');
    entry.contextMismatch = { field: changedField, disabled: true };
    await page.reload(); await page.waitForSelector('#sidebarNav .sidebar-item'); await page.waitForTimeout(350);
    if (role === 'owner') await page.waitForFunction(() => !!document.getElementById('einrichtungRing')?.getAttribute('aria-label'));
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ url: `${server.basis}/design/shell.css` }); await page.mouse.move(0, 0);
    const reloadHash = createHash('sha256').update(await page.screenshot({ animations: 'disabled' })).digest('hex');
    assert.equal(reloadHash, baseline, 'reload Alt differs from fresh reference');
    entry.reloadAltPixelEqual = true;
    assert.deepEqual(violations, [], 'network fence/page errors');
    results.push(entry); await context.close();
  }
  for (const source of sourceHashes) assert.equal(createHash('sha256').update(await readFile(`${WURZEL}/${source.path}`)).digest('hex'), source.sha256, `source changed during probe: ${source.path}`);
  if (!process.env.P01_SHELL_CONTROL) { await writeFile(`${out}/sources.json`, JSON.stringify(sourceHashes, null, 2)); await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2)); console.log(JSON.stringify({ cases: results.length, functionalPassed: true, dynamicControlMismatches: results.filter(r => !r.restoredAltMatchesControl).map(r => ({ width: r.width, theme: r.theme, role: r.role })) })); }
} finally { await browser.close(); await server.stop(); }
