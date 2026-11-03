/** Actual day renderer in a real DOM; all dependencies synthetic, all network intercepted. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const root = new URL('../../', import.meta.url);
const dashboard = await readFile(new URL('dashboard.js', root), 'utf8');
const start = dashboard.indexOf('async function renderDayView(');
const end = dashboard.indexOf('\nasync function renderWeekView(', start);
assert.ok(start >= 0 && end > start, 'actual day renderer found');
const renderer = dashboard.slice(start, end);
const css = await readFile(new URL('dashboard.css', root), 'utf8');
const personal = await build({ stdin: { resolveDir: root.pathname, contents:
  "import { mountMeinUrlaub } from './module/mein-urlaub.js'; window.mountMeinUrlaub = mountMeinUrlaub;" },
bundle: true, write: false, format: 'iife' });
const harness = `(() => {
  let tagesAufbau = 0, calendarView = 'day', calEmpFilter = 'all', teamMembers = [], currentBusiness = { id: 'A' };
  let phase, first, release;
  const formatDateDE = d => d.toISOString().slice(0, 10), toISODate = formatDateDE;
  const getOwnerId = () => 'synthetic-owner', TERMIN_SELECT = 'id,business_id';
  const EMP_COLORS = ['#123456'], moveBooking = null;
  const termineDesStandorts = rows => rows;
  const rasterStunden = () => ({ von: 8, bis: 9 });
  const istAbwesend = () => false;
  async function delay(where, value) {
    if (first && where === phase) { first = false; window.dayProbe.reached = true; await new Promise(resolve => { release = resolve; }); }
    return value;
  }
  const supabase = { from() {
    const query = { select() { return query; }, eq() { return query; }, gte() { return query; }, lte() { return query; },
      neq() { return delay('bookings', { data: [] }); } };
    return query;
  } };
  const planSpalten = async (_, { team }) => delay('plan', team);
  const ladeAbwesenheiten = async () => delay('absences', []);
  ${renderer}
  window.dayProbe = {
    reset(where) {
      tagesAufbau++; calendarView = 'day'; calEmpFilter = 'all'; currentBusiness = { id: 'A' };
      teamMembers = [{ id: 'e', business_name: 'TEST-Therapeut' }]; phase = where; first = true; release = null;
      this.reached = false;
      document.body.innerHTML = '<div id="dayViewDateLabel"></div><div class="day-view-grid"><div id="dvTimeCol"></div><div id="dvColsWrap"></div></div>';
    },
    startOld() { this.old = renderDayView('2026-02-02'); },
    render: renderDayView,
    async finish() { release(); await this.old; },
    emptyTeam() { teamMembers = []; },
    change(kind) {
      if (kind === 'business') currentBusiness = { id: 'B' };
      if (kind === 'filter') calEmpFilter = 'other';
      if (kind === 'view') calendarView = 'month';
      document.getElementById('dayViewDateLabel').textContent = 'Aktueller Kontext';
    },
  };
})();`;

const browser = await chromium.launch();
let checks = 0, blockedRequests = 0;
const results = [];
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    blockedRequests++;
    if (route.request().url() === 'https://synthetic.invalid/') {
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="de"><head><title>Isolierte Kalenderprobe</title></head><body></body></html>' });
    }
    return route.abort();
  });
  await page.goto('https://synthetic.invalid/');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: harness });
  await page.addScriptTag({ content: personal.outputFiles[0].text });
  const pass = name => { checks++; results.push(name); };
  const waitOld = async phase => {
    await page.evaluate(phase => { dayProbe.reset(phase); dayProbe.startOld(); }, phase);
    await page.waitForFunction(() => dayProbe.reached);
  };
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const phase of ['bookings', 'plan', 'absences']) {
      await waitOld(phase);
      await page.evaluate(() => dayProbe.render('2026-02-03'));
      await page.evaluate(() => dayProbe.finish());
      assert.deepEqual(await page.locator('#dvColsWrap .dv-slot').evaluateAll(slots => slots.map(slot => slot.dataset.time)),
        ['2026-02-03T08:00', '2026-02-03T08:30']);
      assert.equal(await page.locator('#dayViewDateLabel').innerText(), '2026-02-03');
      assert.equal(await page.locator('#dvColsWrap .dv-col').count(), 1);
      pass(width + ': alte ' + phase + '-Antwort verworfen, Slots/Datum aktuell');
    }
    await waitOld('bookings');
    await page.evaluate(async () => { dayProbe.emptyTeam(); await dayProbe.render('2026-02-03'); await dayProbe.finish(); });
    assert.equal(await page.locator('#dvColsWrap .dv-col').count(), 0);
    assert.equal(await page.locator('#dvTimeCol .dv-slot').count(), 0);
    assert.equal(await page.locator('#dayViewDateLabel').innerText(), '2026-02-03');
    pass(width + ': neuer leerer Teamfilter bleibt leer');
    for (const kind of ['business', 'filter', 'view']) {
      await waitOld('bookings');
      await page.evaluate(async kind => { dayProbe.change(kind); await dayProbe.finish(); }, kind);
      assert.equal(await page.locator('#dvColsWrap .dv-col').count(), 0);
      assert.equal(await page.locator('#dayViewDateLabel').innerText(), 'Aktueller Kontext');
      pass(width + ': alter Aufbau nach ' + kind + '-Wechsel verworfen');
    }
    // Real personal-summary module: malformed/missing working days must not invent a leave balance.
    for (const kind of ['missing', 'invalid', 'error', 'valid']) {
      const state = await page.evaluate(async kind => {
        document.body.innerHTML = '<section id="personal"></section>';
        const hours = kind === 'missing' ? [] : kind === 'invalid'
          ? [{ day_of_week: 7, is_active: true }, { day_of_week: '1', is_active: true }, null]
          : [{ day_of_week: 1, is_active: true }];
        const supabase = { from(table) {
          const result = table === 'mitarbeiter_anstellung'
            ? { data: { beschaeftigung: 'teilzeit', wochenstunden: 20, urlaub_jahrestage: 24 } }
            : table === 'working_hours' ? { data: hours, error: kind === 'error' ? { message: 'synthetic' } : null }
              : { data: [] };
          const query = { then(resolve) { return Promise.resolve(result).then(resolve); } };
          for (const method of ['select', 'eq', 'lte', 'gte', 'maybeSingle']) query[method] = () => query;
          return query;
        } };
        const host = document.getElementById('personal');
        await mountMeinUrlaub(host, { supabase, getProfil: () => ({ id: 'synthetic-employee', role: 'employee' }),
          jetzt: () => new Date('2026-11-03T12:00:00Z') }).laden();
        return { text: host.innerText, controls: host.querySelectorAll('input,select,textarea,button').length,
          overflow: document.documentElement.scrollWidth > innerWidth };
      }, kind);
      assert.equal(state.controls, 0);
      assert.equal(state.overflow, false);
      if (kind === 'valid') assert.match(state.text, /24 Tage übrig/);
      else { assert.match(state.text, /Urlaubssaldo gerade nicht verfügbar/); assert.doesNotMatch(state.text, /Tage? übrig/); }
      pass(width + ': Mein Urlaub ' + kind + ', keine erfundenen Salden');
    }
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, pass: true, results, dashboardSha256: createHash('sha256').update(dashboard).digest('hex'),
    interceptedRequests: blockedRequests, accountsUsed: 0, realDbWrites: 0, mailsSent: 0 }));
} finally {
  await browser.close();
}
