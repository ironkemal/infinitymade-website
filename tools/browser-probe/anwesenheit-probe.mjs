import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const html = await readFile(new URL('../../attendance.html', import.meta.url), 'utf-8');
const source = await readFile(new URL('../../attendance.js', import.meta.url), 'utf-8');
const css = await readFile(new URL('../../dashboard.css', import.meta.url), 'utf-8');
const browser = await chromium.launch();
const issues = [];
const now = new Date().toISOString();
const berlinDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format();
const locations = [
  { id: 'location-a', business_name: 'Teststandort A' },
  { id: 'location-b', business_name: 'Teststandort B' },
];

async function scenario(available, verify, width = 375, height = 667) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
  const errors = [];
  await context.routeWebSocket('**/*', socket => {
    errors.push('Unerwarteter WebSocket');
    socket.close({ code: 1008, reason: 'Synthetischer Test' });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const bodies = [];
  let currentRecord = null;
  let finishCheckIn;
  let signalCheckIn;
  const checkInStarted = new Promise(resolve => { signalCheckIn = resolve; });
  const pendingCheckIn = new Promise(resolve => { finishCheckIn = resolve; });
  const trace = { bodies, checkInStarted, finishCheckIn };
  page.on('pageerror', err => errors.push(err.message));

  const history = [{ date: '2026-10-01', check_in_at: '2026-10-01T07:00:00.000Z',
    check_out_at: '2026-10-01T08:00:00.000Z', status: 'present', check_in_valid: false }];

  await page.addInitScript(() => {
    window.gpsCalls = 0;
    const gps = () => { window.gpsCalls++; throw new Error('unexpected GPS call'); };
    navigator.geolocation.getCurrentPosition = gps;
    navigator.geolocation.watchPosition = gps;
  });

  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (url.hostname !== 'attendance-qa.invalid') {
      errors.push('Unerwarteter externer Request');
      return route.abort();
    }
    if (path === '/attendance.html') return route.fulfill({ contentType: 'text/html', body: html });
    if (path === '/attendance.js') return route.fulfill({ contentType: 'text/javascript', body: source });
    if (path === '/dashboard.css') return route.fulfill({ contentType: 'text/css', body: css });
    if (path === '/fonts/system-fonts.css' || /^\/fonts\/self_hosted_[A-Za-z0-9_-]+\.woff2$/.test(path)) {
      return route.fulfill({ path: new URL('../..' + path, import.meta.url).pathname });
    }
    if (path === '/supabase-config.js') {
      return route.fulfill({ contentType: 'text/javascript', body: [
        "export const SUPABASE_URL = 'https://attendance-qa.invalid';",
        "export const SUPABASE_ANON_KEY = 'synthetic';",
        "export const API_BASE = '/api';",
      ].join('\n') });
    }
    if (path === '/vendor/supabase-js.js') {
      const body = `
        export function createClient() {
          return {
            auth: { async getSession() {
              return { data: { session: { access_token: 'synthetic', user: { id: 'employee-a' } } } };
            } },
            from(table) {
              if (!['profiles', 'businesses', 'attendance'].includes(table)) throw new Error('Unerwartete Tabelle: ' + table);
              const data = table === 'profiles' ? { owner_id: 'owner-a', role: 'employee' }
                : table === 'businesses' ? ${JSON.stringify(available)}
                : ${JSON.stringify(history)};
              const error = data === null ? { message: 'Standorte nicht erreichbar' } : null;
              return { select() { return this; }, eq() { return this; }, gte() { return this; },
                lte() { return this; }, order() { return this; }, single() { return Promise.resolve({ data }); },
                then(resolve) { return Promise.resolve({ data, error }).then(resolve); } };
            },
          };
        }`;
      return route.fulfill({ contentType: 'text/javascript', body });
    }
    if (path === '/api/attendance/today') return route.fulfill({ json: { record: currentRecord } });
    if (path === '/api/attendance/check-in') {
      bodies.push(route.request().postDataJSON());
      signalCheckIn();
      await pendingCheckIn;
      currentRecord = { date: berlinDate, check_in_at: now, check_out_at: null, status: 'present', check_in_valid: null };
      return route.fulfill({ json: { ...currentRecord, gps_checked: false } });
    }
    if (path === '/api/attendance/check-out') {
      currentRecord = { ...currentRecord, check_out_at: now };
      return route.fulfill({ json: { check_out_at: now } });
    }
    if (path === '/favicon.ico') return route.fulfill({ status: 204 });
    errors.push('Unerwartete Route ' + path);
    return route.abort();
  });
  try {
    await page.goto('https://attendance-qa.invalid/attendance.html');
    await page.locator('#app').waitFor({ state: 'visible' });
    if (available !== null) await page.locator('#historyList .att-history-row').waitFor({ state: 'visible' });
    await verify(page, trace);
    assert.equal(await page.evaluate(() => window.gpsCalls), 0);
    assert.deepEqual(errors, []);
  } finally {
    finishCheckIn();
    await context.close();
  }
}

try {
  for (const width of [375, 768, 1920]) {
    await scenario(locations, async (page, trace) => {
      const button = page.locator('#btnCheckIn');
      const select = page.locator('#bizSelect');
      assert.equal(await select.inputValue(), '');
      if (await button.isEnabled()) {
        await button.click();
        await trace.checkInStarted;
        issues.push(`${width}px: Anwesenheit trotz leerer Standortwahl. Anfrage: ${JSON.stringify(trace.bodies[0])}`);
        trace.finishCheckIn();
        await page.locator('#btnCheckOut').waitFor({ state: 'visible' });
      }
    }, width, width === 375 ? 667 : width === 768 ? 1024 : 1080);
  }

  await scenario(locations, async (page, trace) => {
    const button = page.locator('#btnCheckIn');
    const select = page.locator('#bizSelect');
    await select.selectOption('location-a');
    await button.click();
    await trace.checkInStarted;
    assert.deepEqual(trace.bodies, [{ business_id: 'location-a' }]);
    if (await select.isEnabled()) await select.selectOption('location-b');
    if (await button.isEnabled()) {
      const sent = page.waitForRequest(req => req.url().endsWith('/api/attendance/check-in') && req.postDataJSON().business_id === 'location-b');
      await button.click();
      await sent;
      issues.push('Standortwechsel schaltet laufenden Check-in frei und ermöglicht eine zweite Anfrage.');
    }
    trace.finishCheckIn();
    await page.locator('#btnCheckOut').waitFor({ state: 'visible' });
    await page.locator('#btnCheckOut').click();
    await page.locator('#attBadgeText').getByText('Arbeitstag abgeschlossen').waitFor();
    console.log('PASS: Standort A ausgewählt, GPS-freier Check-in und Check-out, historische Zeitnachweise sichtbar.');
  });

  for (const [available, expected] of [[[], null], [[locations[0]], locations[0].id]]) {
    await scenario(available, async (page, trace) => {
      trace.finishCheckIn();
      await page.locator('#btnCheckIn').click();
      await trace.checkInStarted;
      await page.locator('#btnCheckOut').waitFor({ state: 'visible' });
      assert.deepEqual(trace.bodies, [{ business_id: expected }]);
    });
  }
  console.log('PASS: Einzelpraxis mit und ohne Standortzuordnung.');
  await scenario(null, async (page, trace) => {
    await page.getByText('Fehler beim Laden. Bitte Seite neu laden.').waitFor();
    assert.equal(await page.locator('#btnCheckIn').isDisabled(), true);
    assert.deepEqual(trace.bodies, []);
  });
  console.log('PASS: Check-in bleibt bei fehlgeschlagenem Laden der Standorte gesperrt.');
  if (issues.length) {
    for (const issue of issues) console.error('FAIL:', issue);
    process.exitCode = 1;
  } else {
    console.log('PASS: Pflichtauswahl auf Desktop, Tablet und Mobil sowie Schutz gegen zweiten Check-in.');
  }
} finally {
  await browser.close();
}
