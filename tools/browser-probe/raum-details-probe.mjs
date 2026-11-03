// Reale DOM-Interaktionen mit synthetischer DB; kein Server und kein Live-Zugriff.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser = await chromium.launch();
let checks = 0;
try {
  const page = await browser.newPage();
  await page.route('https://raum-test.invalid/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><div id="raeume"></div>' });
    if (!/^\/module\/[a-z-]+\.js$/.test(path)) return route.abort();
    await route.fulfill({ contentType: 'text/javascript', body: await readFile(new URL(`../..${path}`, import.meta.url), 'utf8') });
  });
  await page.goto('https://raum-test.invalid/');
  await page.addStyleTag({ content: await readFile(new URL('../../dashboard.css', import.meta.url), 'utf8') });
  await page.evaluate(async () => {
    const { mountRaumVerwaltung } = await import('/module/raum-verwaltung.js');
    window.fixture = { rows: [], writes: [], errors: [], old: false };
    const supabase = { from() {
      let op = 'select', payload, columns;
      const filters = {};
      const q = {
        select(c) { columns = c; return q; },
        eq(k, v) { filters[k] = v; return q; },
        insert(p) { op = 'insert'; payload = p; return q; },
        update(p) { op = 'update'; payload = p; return q; },
        then(resolve) {
          if (op === 'select') return Promise.resolve(window.fixture.old && columns.includes('ausstattung')
            ? { error: { code: '42703' } } : { data: structuredClone(window.fixture.rows), error: null }).then(resolve);
          window.fixture.writes.push({ op, payload, filters });
          if (op === 'insert') window.fixture.rows.push({ id: 'raum-1', ...payload });
          else Object.assign(window.fixture.rows.find(r => r.id === filters.id), payload);
          return Promise.resolve({ error: null }).then(resolve);
        },
      };
      return q;
    } };
    window.mountFixture = istInhaber => mountRaumVerwaltung(document.querySelector('#raeume'), {
      supabase, ownerId: 'qa-owner', istInhaber,
      showToast: (text, type) => { if (type === 'error') window.fixture.errors.push(text); },
    });
    await window.mountFixture(true);
  });
  const form = page.locator('.card').first();
  await page.locator('#raumNeuName').fill('Therapieraum');
  await form.locator('.raum-beschreibung').fill('Fenster zum Hof');
  for (const text of ['Therapieliege', '<img src=x onerror=alert(1)>']) {
    await form.locator('.raum-ausstattung-neu').fill(text);
    await form.locator('.raum-ausstattung-hinzufuegen').click();
  }
  assert.equal(await form.locator('.raum-ausstattung-check').count(), 2); checks++;
  assert.equal(await page.locator('img').count(), 0); checks++;
  await form.locator('.raum-ausstattung-check').last().uncheck();
  await page.locator('#raumNeuBtn').click();
  await page.waitForFunction(() => document.querySelector('.raum-edit-name'));
  let state = await page.evaluate(() => window.fixture);
  assert.deepEqual(state.rows[0].ausstattung, ['Therapieliege']); checks++;
  assert.equal(state.rows[0].beschreibung, 'Fenster zum Hof'); checks++;
  const row = page.locator('.raum-zeile');
  await row.locator('.raum-ausstattung-entfernen').click();
  await row.locator('[data-action="speichern"]').click();
  await page.waitForFunction(() => window.fixture.writes.length === 2);
  state = await page.evaluate(() => window.fixture);
  assert.deepEqual(state.rows[0].ausstattung, []); checks++;
  assert.equal(state.writes[1].filters.owner_id, 'qa-owner'); checks++;
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Überlauf bei ${width}px/${theme}`); checks++;
      if (process.env.PRAXURA_RAUM_PROBE_SHOTS) await page.screenshot({ path: `${process.env.PRAXURA_RAUM_PROBE_SHOTS}-${width}-${theme}.png`, fullPage: true });
    }
  }
  await page.evaluate(() => window.mountFixture(false));
  assert.equal(await page.locator('.raum-details, .raum-btn-save').count(), 0); checks++;
  assert.ok((await page.locator('#raeume').innerText()).includes('Fenster zum Hof')); checks++;
  await page.evaluate(async () => { window.fixture.old = true; await window.mountFixture(true); });
  assert.equal(await page.locator('.raum-details').count(), 0); checks++;
  assert.ok((await page.locator('#raeume').innerText()).includes('derzeit nicht verfügbar')); checks++;
  assert.equal((await page.evaluate(() => window.fixture.errors)).length, 0); checks++;
  console.log(`${checks}/${checks} Browserprüfungen PASS; nur synthetische Raumverwaltung, kein Live-Nachweis.`);
} finally {
  await browser.close();
}
