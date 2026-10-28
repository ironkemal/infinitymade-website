/** V8.04b: gefülltes Fahrtenbuch im Original-Dashboard, ausschließlich synthetisch.
 * REDESIGN_PORT=18082 timeout -s KILL 180 node tools/redesign-fahrtenbuch-gefuellt.mjs
 * Keine Speicherung, Exporte, GPS oder Produkt-/globale Fixtureänderung.
 */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import { WURZEL, starteServer, starteBrowser, oeffneDashboard, wechsle, fixtureLog } from './redesign-harness.mjs';

const out = process.env.REDESIGN_FAHRTEN_OUT || '/tmp/praxura-v804b-fahrten';
await mkdir(out, { recursive: true });
const originalFixture = await readFile(WURZEL + '/tools/browser-probe/redesign-fixture.js', 'utf8');
// Vorhandene reine Kontrastberechnung wiederverwenden, ohne deren Tests zu importieren.
const kontrastQuelle = await readFile(WURZEL + '/tools/redesign-kontrast.test.js', 'utf8');
const farben = vm.createContext({ assert });
vm.runInContext(kontrastQuelle.slice(kontrastQuelle.indexOf('function rgb('), kontrastQuelle.indexOf('\nconst TEXT')) + '\nglobalThis.messeKontrast = kontrast;', farben);
const anchor = "const tabellen = SZENARIO === 'leer' ? leer : SZENARIO === 'gross' ? grossePraxis() : voll;";
assert.equal(originalFixture.split(anchor).length, 2, 'Eindeutiger lokaler Fixtureanker');
// Felder ausschließlich aus tatsächlichen Projektionen der drei bestehenden Lader.
const ergaenzung = `
Object.assign(tabellen, {
  vehicles: [OWNER, MITARB].map((user, i) => ({
    id: uid('a', i + 1), owner_id: OWNER, created_by: user, kind: i ? 'privat' : 'gewerblich',
    kennzeichen: 'K-TEST ' + (101 + i), label: 'Synthetisches Fahrzeug mit besonders langer Bezeichnung '.repeat(4),
    is_default: i === 0, is_active: true, created_at: TAG + 'T08:00:00Z'
  })),
  fahrten: [OWNER, MITARB].map((user, i) => ({
    id: uid('b', i + 1), owner_id: OWNER, user_id: user, booking_id: null, lead_id: leads[i].id,
    vehicle_id: uid('a', i + 1), kennzeichen_snapshot: 'K-TEST ' + (101 + i),
    kind_snapshot: i ? 'privat' : 'gewerblich', start_km: 1000, end_km: 1012.5,
    distance_km: 12.5, estimated_duration_min: 25,
    fahrt_started_at: TAG + 'T09:00:00Z', fahrt_arrived_at: TAG + 'T09:25:00Z', fahrt_ended_at: TAG + 'T09:30:00Z',
    notes: 'Nur synthetischer Layoutnachweis', zweck: 'Hausbesuch mit langem synthetischem Fahrtzweck '.repeat(4),
    abfahrtsort: 'Synthetische Praxis', zielort: 'Synthetischer Zielort mit langer Anschrift '.repeat(4),
    leads: clone(leads[i]), bookings: null
  })),
  fahrten_monthly_summary: [OWNER, MITARB].map((user, i) => ({
    user_id: user, vehicle_id: uid('a', i + 1), kennzeichen_snapshot: 'K-TEST ' + (101 + i),
    kind_snapshot: i ? 'privat' : 'gewerblich', trips: i + 2,
    total_km: i ? 8.5 : 12.5, total_minutes: i ? 25 : 45, month: TAG.slice(0, 7) + '-01T00:00:00Z'
  }))
});`;
const fixture = originalFixture.replace(anchor, anchor + ergaenzung);
const server = await starteServer(), browser = await starteBrowser(), bericht = [];
const newContext = browser.newContext.bind(browser);
browser.newContext = async options => {
  const c = await newContext({ ...options, serviceWorkers: 'block' });
  const erlaubt = r => new URL(r.request().url()).origin === server.basis && ['GET', 'HEAD'].includes(r.request().method());
  await c.routeWebSocket('**', ws => ws.close());
  await c.route('**/*', r => erlaubt(r) ? r.fallback() : r.abort());
  // Page-Routen haben Vorrang. Deshalb auch jeden Harness-Handler vor Erstnavigation einfassen.
  const newPage = c.newPage.bind(c);
  c.newPage = async (...args) => {
    const p = await newPage(...args), route = p.route.bind(p);
    p.route = (pattern, handler, options) => route(pattern, (r, q) => {
      if (!erlaubt(r)) return r.abort();
      if (new URL(r.request().url()).pathname === '/vendor/supabase-js.js') return r.fulfill({ status: 200, contentType: 'text/javascript', body: fixture });
      return handler(r, q);
    }, options);
    return p;
  };
  return c;
};

const cases = [['owner', 'hell', 1440], ['owner', 'dunkel', 390], ['employee', 'hell', 390], ['employee', 'dunkel', 1440]];
try {
  for (const [rolle, theme, breite] of cases) {
    const c = await oeffneDashboard(browser, { basis: server.basis, design: 'neu', rolle, theme, breite, szenario: 'voll' });
    const p = c.page;
    p.setDefaultTimeout(10000);
    try {
      assert.equal(await wechsle(p, 'fahrtenbuch'), true);
      assert.equal(await p.locator('link[href*="design/verwaltung.css"]').evaluate(l => !!l.sheet && l.sheet.cssRules.length > 0), true);
      for (const [tab, tbody] of [['fahrten', 'fbFahrtenTbody'], ['vehicles', 'fbVehiclesTbody'], ['reports', 'fbReportByUserTbody']]) {
        await p.locator(`[data-fb-tab="${tab}"]`).click();
        await p.waitForFunction(id => document.getElementById(id)?.rows.length === 2, tbody);
        if (tab === 'reports') {
          assert.equal(await p.locator('#fbReportByVehicleTbody tr').count(), 2);
          assert.match(await p.locator('#fbReportByUserTbody').innerText(), /12\.5 km/);
          assert.match(await p.locator('#fbReportByUserTbody').innerText(), /8\.5 km/);
        }
        const mass = await p.locator('#panel-fahrtenbuch').evaluate(panel => {
          const sichtbar = e => !!e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
          const rect = e => { const r = e.getBoundingClientRect(); return { links: r.left, rechts: r.right, breite: r.width, hoehe: r.height }; };
          return {
            dokument: { client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth },
            main: { client: document.getElementById('mainArea').clientWidth, scroll: document.getElementById('mainArea').scrollWidth },
            kaesten: [...panel.querySelectorAll('.table-wrap')].filter(sichtbar).map(e => ({ ...rect(e), client: e.clientWidth, scroll: e.scrollWidth })),
            klein: [...panel.querySelectorAll('button,input:not([type=hidden]),select')].filter(sichtbar).filter(e => e.getBoundingClientRect().width < 43.9 || e.getBoundingClientRect().height < 43.9).map(e => ({ id: e.id, ...rect(e) }))
          };
        });
        assert.ok(mass.dokument.scroll <= mass.dokument.client + 1, 'Dokumentüberlauf');
        assert.ok(mass.main.scroll <= mass.main.client + 1, 'mainArea-Überlauf');
        assert.deepEqual(mass.klein, [], '44px-Ziele');
        for (const box of mass.kaesten) assert.ok(box.links >= -1 && box.rechts <= breite + 1, 'Tabellenkasten innerhalb Viewport');
        const box = p.locator('#' + tbody).locator('xpath=ancestor::div[contains(@class,"table-wrap")]').first();
        await box.evaluate(el => { el.scrollLeft = el.scrollWidth; });
        const action = tab === 'fahrten' ? p.locator('#fbFahrtenTbody [data-action="fb-edit"]').last()
          : tab === 'vehicles' ? p.locator('#fbVehiclesTbody .fb-veh-edit').last() : null;
        let ziel = null;
        if (action) {
          // Tatsächliche Tastaturnavigation: programmatischer Mausfokus belegt
          // keinen :focus-visible-Zustand und wäre eine falsche Gegenprobe.
          for (let n = 0; n < 40 && !(await action.evaluate(el => document.activeElement === el)); n++) await p.keyboard.press('Tab');
          await action.click({ trial: true });
          ziel = await action.evaluate(el => {
            const r = el.getBoundingClientRect(), b = el.closest('.table-wrap').getBoundingClientRect(), css = getComputedStyle(el);
            return { fokus: document.activeElement === el, links: r.left, rechts: r.right, boxLinks: b.left, boxRechts: b.right, outline: css.outlineStyle, outlineBreite: css.outlineWidth, farbe: css.color, hintergrund: css.backgroundColor };
          });
          assert.equal(ziel.fokus, true);
          assert.ok(ziel.links >= ziel.boxLinks - 1 && ziel.rechts <= ziel.boxRechts + 1, 'Letzte Aktion nach lokalem Scroll sichtbar');
          assert.notEqual(ziel.outline, 'none', 'Sichtbarer Fokus');
          assert.notEqual(ziel.outlineBreite, '0px', 'Sichtbarer Fokus');
          if (tab === 'vehicles') {
            ziel.kontrast = farben.messeKontrast(ziel.farbe, ziel.hintergrund, '#FFFFFF');
            console.log(JSON.stringify({ rolle, theme, breite, fahrzeugHover: ziel }));
            assert.ok(ziel.kontrast >= 4.5, 'Fahrzeug-Bearbeiten Hovertext ≥4,5:1');
          }
        }
        await p.screenshot({ path: `${out}/${rolle}-${theme}-${breite}-${tab}.png` });
        bericht.push({ rolle, theme, breite, tab, zeilen: 2, mass, ziel });
      }
      const log = { ...await fixtureLog(p), reads: await p.evaluate(() => window.__rsFixture.reads) };
      assert.deepEqual(log.writes, []);
      assert.deepEqual(c.protokoll.seitenfehler, []);
      assert.deepEqual(c.protokoll.fremd, []);
      for (const t of ['fahrten', 'vehicles', 'fahrten_monthly_summary']) {
        assert.ok(log.reads.includes(t), 'Tatsächlicher Quellenread ' + t);
        assert.ok(!log.unbekannt.includes(t), 'Quelle ausdrücklich gefüllt ' + t);
      }
      bericht.push({ rolle, theme, breite, reads: log.reads, writes: log.writes, seitenfehler: c.protokoll.seitenfehler, fremd: c.protokoll.fremd });
    } finally { await c.kontext.close(); }
  }
  for (const [rolle, theme] of [['owner', 'hell'], ['employee', 'dunkel']]) {
    const c = await oeffneDashboard(browser, { basis: server.basis, design: 'alt', rolle, theme, breite: 390, szenario: 'voll' });
    try {
      const p = c.page;
      assert.equal(await wechsle(p, 'fahrtenbuch'), true);
      await p.locator('[data-fb-tab="vehicles"]').click();
      await p.waitForFunction(() => document.querySelectorAll('#fbVehiclesTbody tr').length === 2);
      const action = p.locator('#fbVehiclesTbody .fb-veh-edit').last();
      await action.hover();
      const messen = () => action.evaluate(el => {
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        return { farbe: s.color, hintergrund: s.backgroundColor, breite: r.width, hoehe: r.height };
      });
      const vorher = await messen();
      await p.locator('link[href*="design/verwaltung.css"]').evaluate(l => { l.sheet.disabled = true; });
      assert.deepEqual(await messen(), vorher, 'Alt-Fahrzeugaktion mit/ohne Verwaltungs-CSS identisch');
      await p.screenshot({ path: `${out}/alt-${rolle}-${theme}-390-vehicles.png` });
      const log = await fixtureLog(p);
      assert.deepEqual(log.writes, []);
      assert.deepEqual(c.protokoll.seitenfehler, []);
      assert.deepEqual(c.protokoll.fremd, []);
      bericht.push({ design: 'alt', rolle, theme, breite: 390, hover: vorher, writes: log.writes });
    } finally { await c.kontext.close(); }
  }
  await writeFile(out + '/bericht.json', JSON.stringify(bericht, null, 2));
  console.log(JSON.stringify({ kontexte: cases.length, zustaende: bericht.filter(r => r.tab).length, report: out + '/bericht.json' }));
} finally { await browser.close(); await server.stop(); }
