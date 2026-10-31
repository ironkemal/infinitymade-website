// Vorbedingung: sicherer statischer Server auf 8081, ohne .env/Liveverbindung.
//   rtk proxy node tools/browser-probe/billing-loader-503-probe.mjs [Screenshotordner]
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch();
const shotDir = process.argv[2];
try {
  for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    const unexpected = [], pageErrors = [];
    await context.route('**/*', route => {
      const req = route.request(), url = new URL(req.url());
      // API-Aufrufe müssen im Fixture beantwortet sein. Browser darf nur
      // lokale statische Quellen laden; kein Proxy/Backend, kein Write.
      if (url.origin === 'http://localhost:8081' && req.method() === 'GET'
          && !url.pathname.startsWith('/api/') && !/(?:^|\/)\.[^/]+/.test(url.pathname)) return route.continue();
      unexpected.push(req.method() + ' ' + url.origin + url.pathname);
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(`http://localhost:8081/tools/browser-probe/billing-loader-503-probe.html?theme=${theme}`);
    await page.waitForFunction(() => window.__billing503Probe?.ready === true);
    const result = await page.evaluate(() => ({ ...window.__billing503Probe,
      overflow: document.documentElement.scrollWidth > innerWidth,
      mainOverflow: document.getElementById('mainArea').scrollWidth > document.getElementById('mainArea').clientWidth,
    }));
    assert.equal(result.error, undefined, result.error);
    assert.ok(result.checks.every(c => c.ok), JSON.stringify(result.checks.filter(c => !c.ok)));
    assert.deepEqual(result.unexpected, []); assert.deepEqual(unexpected, []); assert.deepEqual(pageErrors, []);
    assert.equal(result.overflow, false, `${width}/${theme}: Seitenüberlauf`);
    assert.equal(result.mainOverflow, false, `${width}/${theme}: Inhaltsüberlauf`);
    if (shotDir) {
      await page.screenshot({ path: `${shotDir}/billing-loader-503-${width}-${theme}.png`, fullPage: true });
      // Reviewfälle separat lesbar halten, statt nur eine stark verkleinerte Gesamtseite zu prüfen.
      for (const id of ['fallback-503', 'mixed-vord-true', 'recovery-good']) {
        const target = id === 'mixed-vord-true'
          ? page.locator('#' + id).getByText('Verschreibung', { exact: true }).locator('..')
          : page.locator('#' + id).locator('..');
        await target.screenshot({
          path: `${shotDir}/billing-loader-503-${width}-${theme}-${id}.png`,
        });
      }
    }
    console.log(`${width}/${theme}: ${result.checks.length} Prüfungen grün; ${result.requests.length} synthetische GETs; keine Writes/externen Requests/Überläufe.`);
    await context.close();
  }
} finally {
  await browser.close();
}
