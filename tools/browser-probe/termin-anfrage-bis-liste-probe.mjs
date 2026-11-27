/** Lokale Browserprobe: öffentliche Terminanfrage und Praxisliste mit synthetischen Daten. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import * as guards from '../../api-backend/booking/public-guards.js';
import * as widgetGuards from '../../api-backend/booking/widget-guards.js';
import { patientenNameMuster } from '../../api-backend/booking/patienten-namensabgleich.js';
import { requestToken } from '../../api-backend/booking/status.js';
import { API_ANTWORTEN, starteBrowser, starteServer } from '../redesign-harness.mjs';

const praxisId = '10000000-0000-4000-8000-000000000001';
const therapeutId = '10000000-0000-4000-8000-000000000002';
const leistung = {
  id: '10000000-0000-4000-8000-000000000004', owner_id: praxisId,
  title: 'Synthetische Fußpflege', duration_minutes: 30, kostentraeger_typ: 'selbstzahler',
};
const uhr = '2026-11-18T09:00:00+01:00';
const termin = { datum: '2026-11-20', uhrzeit: '10:30' };
const probe = { vorname: 'Synthetisch', nachname: 'Browserprobe', geburtsdatum: '1990-02-03', notiz: 'Synthetischer Terminwunsch.' };
const fehlerProbe = { ...probe, nachname: 'Fehlerprobe' };
const daten = {
  profiles: [
    { id: praxisId, owner_id: null, role: 'owner', is_active: true, email: null, booking_auto_approve: false },
    { id: therapeutId, owner_id: praxisId, role: 'employee', is_active: true },
  ],
  services: [leistung], patients: [], booking_requests: [],
};
const routingFehler = [];
const browserFehler = [];
const backendFehler = [];
const insertVersuche = [];
const anfragen = [];

// Die Abfrage unterstützt nur die Operationen, die Create und List für diesen Ablauf benötigen.
class Abfrage {
  constructor(tabelle) {
    assert.ok(Object.hasOwn(daten, tabelle), `Unerwartete Tabelle ${tabelle}`);
    this.tabelle = tabelle;
    this.filter = [];
  }
  select(spalten, optionen) { this.spalten = spalten; this.nurZaehlen = optionen?.head; return this; }
  eq(spalte, wert) { this.filter.push(zeile => zeile[spalte] === wert); return this; }
  gte(spalte, wert) { this.filter.push(zeile => zeile[spalte] >= wert); return this; }
  order(spalte, optionen) {
    assert.equal(spalte, 'created_at');
    assert.equal(optionen.ascending, false);
    this.neuesteZuerst = true;
    return this;
  }
  insert(zeile) {
    assert.ok(['patients', 'booking_requests'].includes(this.tabelle), `Unerwarteter Insert ${this.tabelle}`);
    assert.equal(zeile.owner_id, praxisId);
    this.eintrag = zeile;
    return this;
  }
  single() { this.eineZeile = true; return this; }
  maybeSingle() { this.eineZeile = true; return this; }
  then(ok, fehler) { return Promise.resolve().then(() => this.ergebnis()).then(ok, fehler); }

  ergebnis() {
    if (this.eintrag) {
      insertVersuche.push(this.tabelle);
      if (this.tabelle === 'patients') {
        assert.ok([probe.nachname, fehlerProbe.nachname].includes(this.eintrag.nachname));
        if (this.eintrag.nachname === fehlerProbe.nachname) {
          return { data: null, error: { message: 'Synthetischer Fehler beim Patienteneintrag' } };
        }
      } else {
        assert.equal(this.eintrag.patient_id, daten.patients[0]?.id);
        assert.equal(this.eintrag.service_id, leistung.id);
        assert.equal(this.eintrag.employee_id, therapeutId);
      }
      const defaults = this.tabelle === 'booking_requests' ? { status: 'pending' } : {};
      const zeile = { ...defaults, ...structuredClone(this.eintrag), id: randomUUID(), created_at: new Date().toISOString() };
      daten[this.tabelle].push(zeile);
      return { data: { id: zeile.id }, error: null };
    }

    const zeilen = daten[this.tabelle].filter(zeile => this.filter.every(passt => passt(zeile)));
    if (this.nurZaehlen) return { count: zeilen.length, error: null };
    if (this.neuesteZuerst) zeilen.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (this.eineZeile) return { data: zeilen[0] ?? null, error: null };
    assert.equal(this.tabelle, 'booking_requests');
    assert.match(this.spalten, /patients\(/);
    assert.match(this.spalten, /services\(/);
    return { data: zeilen.map(zeile => ({
      ...zeile, patients: daten.patients.find(p => p.id === zeile.patient_id),
      services: daten.services.find(s => s.id === zeile.service_id),
    })), error: null };
  }
}

// Wie in api-backend/booking/public-handlers.test.js die Originalhandler isoliert
// registrieren, ohne den vollständigen Express-Server oder seine Integrationen zu starten.
const quelle = await readFile(new URL('../../api-backend/server.js', import.meta.url), 'utf8');
const handler = new Map();
const ignorierteMiddleware = () => {};
const vmKontext = vm.createContext({
  ...guards, ...widgetGuards, patientenNameMuster, requestToken, ANFRAGEN_TAGESDECKEL: 100,
  supabase: { from: tabelle => new Abfrage(tabelle) },
  bookingRequestLimiter: ignorierteMiddleware, bookingRequestApprovalLimiter: ignorierteMiddleware,
  requireAuthAI: ignorierteMiddleware,
  app: {
    post: (pfad, ...kette) => handler.set(`POST ${pfad}`, kette.at(-1)),
    get: (pfad, ...kette) => handler.set(`GET ${pfad}`, kette.at(-1)),
  },
  console: { error: (...teile) => backendFehler.push(teile.join(' ')) },
  process: { env: { SUPABASE_SERVICE_ROLE_KEY: 'lokaler-synthetischer-hmac-platzhalter' } },
});
const herausnehmen = (anfang, ende) => {
  const von = quelle.indexOf(anfang);
  const bis = quelle.indexOf(ende, von + anfang.length);
  assert.ok(von >= 0 && bis > von, `Originalhandler fehlt ${anfang}`);
  vm.runInContext(quelle.slice(von, bis), vmKontext, { filename: 'api-backend/server.js' });
};
herausnehmen("app.post('/api/booking-request/create'", '// GET /api/booking-request/list');
herausnehmen("app.get('/api/booking-request/list'", '// Erlaubte Korrekturen');

const dashboardFixtureQuelle = await readFile(new URL('./redesign-fixture.js', import.meta.url), 'utf8');
const leereDashboardTabellen = Object.fromEntries([
  'data_sharing_settings', 'user_preferences', 'praxis_formulare', 'module_visibility', 'terapeut_zertifikat',
  'bookings', 'patient_notes', 'invoices', 'fahrten', 'leads', 'prescriptions', 'praxis_aufgaben', 'aerzte', 'admin_users',
].map(tabelle => [tabelle, []]));
assert.ok(dashboardFixtureQuelle.includes('const leer = {'));
const dashboardFixture = dashboardFixtureQuelle.replace('const leer = {', `const leer = { ...${JSON.stringify(leereDashboardTabellen)},`);
const oeffentlicheFixture = `
  export const createClient = () => ({
    rpc: async (name, args) => {
      if (args?.p_owner_id !== ${JSON.stringify(praxisId)}) throw new Error('Unerwartete öffentliche Praxiskennung');
      if (name === 'public_praxis_sector') return { data: 'podologie', error: null };
      if (name === 'public_praxis_angaben' && args.p_business_id === null) return { data: [{
        praxis_name: 'Podologie Musterpraxis', strasse: 'Musterweg', hausnummer: '1', plz: '00000', ort: 'Musterstadt'
      }], error: null };
      throw new Error('Unerwarteter öffentlicher RPC ' + name);
    }
  });
`;

const statischeDatei = /\.(?:css|js|json|svg|png|jpg|jpeg|ico|woff2|webmanifest)$/;
const dashboardStart = {
  'GET /api/attendance/report': API_ANTWORTEN['/api/attendance/report'],
  'GET /api/billing/statistik': API_ANTWORTEN['/api/billing/statistik']({ szenario: 'leer' }),
  'GET /api/ai/_config': { success: true, mode: 'aus', active: false, capabilities: {} },
  'GET /api/mailversand': { verfuegbar: false, einstellung: null },
  'GET /api/design/entscheidung': { neu: false },
};
async function seite(browser, basis, dashboard) {
  const kontext = await browser.newContext({
    viewport: { width: 1440, height: 900 }, locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block',
  });
  await kontext.routeWebSocket('**/*', ws => {
    routingFehler.push(`WebSocket ${ws.url()}`);
    return ws.close({ code: 1008, reason: 'Synthetische Browserprobe' });
  });
  await kontext.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const methode = request.method();
    const pfad = url.pathname;
    const schluessel = `${methode} ${pfad}`;
    const query = Object.fromEntries(url.searchParams);
    try {
      assert.equal(url.origin, basis, 'Externer Netzwerkzugriff');
      if (schluessel === 'GET /vendor/supabase-js.js') return route.fulfill({
        contentType: 'text/javascript', body: dashboard ? dashboardFixture : oeffentlicheFixture,
      });
      if (schluessel === 'GET /api/config') return route.fulfill({ json: {
        supabaseUrl: 'https://synthetic.invalid', supabaseAnonKey: 'synthetisch-anon', apiBase: '/api', telemetryEnabled: false,
      } });
      if (dashboard && Object.hasOwn(dashboardStart, schluessel)) return route.fulfill({ json: dashboardStart[schluessel] });
      if (!dashboard && schluessel === 'GET /api/services/public') {
        assert.deepEqual(query, { owner_id: praxisId });
        return route.fulfill({ json: { services: [{ id: leistung.id, name: leistung.title, duration: leistung.duration_minutes, kostentraeger_typ: leistung.kostentraeger_typ }] } });
      }
      if (!dashboard && schluessel === 'GET /api/team/public') {
        assert.deepEqual(query, { owner_id: praxisId });
        return route.fulfill({ json: { team: [{ id: therapeutId, full_name: 'Synthetische Behandlerin' }] } });
      }
      if (!dashboard && schluessel === 'POST /api/booking/get-slots') {
        assert.deepEqual(request.postDataJSON(), { userId: therapeutId, date: termin.datum, duration: leistung.duration_minutes });
        return route.fulfill({ json: { slots: [termin.uhrzeit] } });
      }
      if ((dashboard && schluessel === 'GET /api/booking-request/list') || (!dashboard && schluessel === 'POST /api/booking-request/create')) {
        const auth = dashboard ? { userId: praxisId } : undefined;
        const body = dashboard ? undefined : request.postDataJSON();
        const erwarteterToken = dashboard ? 'Bearer synthetisch-nur-redesign' : undefined;
        assert.equal(request.headers().authorization, erwarteterToken);
        if (dashboard) assert.equal(query.owner_id, praxisId);
        else assert.equal(body.owner_id, praxisId);
        const antwort = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(json) { this.body = json; } };
        await handler.get(schluessel)({ query, body, auth }, antwort);
        anfragen.push({ methode, status: antwort.statusCode, query });
        return route.fulfill({ status: antwort.statusCode, json: antwort.body });
      }
      const dokument = dashboard ? '/dashboard.html' : '/booking-request.html';
      const quellDatei = !pfad.startsWith('/api/') && statischeDatei.test(pfad) && ['script', 'stylesheet', 'font', 'image'].includes(request.resourceType());
      assert.ok(methode === 'GET' && (pfad === dokument || quellDatei), 'Unbekannte Anfrage');
      return route.continue();
    } catch (fehler) {
      routingFehler.push(`${schluessel}: ${fehler.message}`);
      return route.abort();
    }
  });
  const page = await kontext.newPage();
  page.setDefaultTimeout(10_000);
  page.on('pageerror', fehler => browserFehler.push(fehler.message));
  await page.clock.setFixedTime(new Date(uhr));
  if (dashboard) {
    await page.addInitScript(() => {
      window.__rsSzenario = 'leer'; window.__rsRolle = 'owner'; window.__rsDay = '2026-11-18';
    });
  }
  return page;
}

async function durchFormular(page, person) {
  await page.getByRole('button', { name: 'Neuer Patient', exact: true }).click();
  await page.locator('#step0Next').click();
  await page.locator('[data-anliegen="ohne_rezept"]').click();
  await page.locator('#pay-selbst').click();
  await page.locator('#step1Next').click();
  await page.getByRole('button', { name: leistung.title, exact: true }).click();
  await page.locator('#sessionPlus').click();
  await page.locator('#step2Next').click();
  await page.getByRole('button', { name: /Synthetische Behandlerin/ }).click();
  await page.locator('#step-3').getByRole('button', { name: 'Montag', exact: true }).click();
  await page.locator('#step-3').getByRole('button', { name: 'Mittwoch', exact: true }).click();
  await page.locator('#step-3').getByRole('button', { name: 'Vormittags (08–12 Uhr)', exact: true }).click();
  await page.locator('#step3Next').click();
  await page.locator('#patVorname').fill(person.vorname);
  await page.locator('#patNachname').fill(person.nachname);
  await page.locator('#patGeburt').fill(person.geburtsdatum);
  await page.locator('#step5Next').click();
  await page.locator('#notizen').fill(person.notiz);
  await page.getByRole('button', { name: 'Anfrage senden', exact: true }).click();
}

async function aktionenMitListenabruf(page, button) {
  const [antwort] = await Promise.all([
    page.waitForResponse(r => r.request().method() === 'GET' && new URL(r.url()).pathname === '/api/booking-request/list'),
    button.click(),
  ]);
  assert.equal(antwort.status(), 200);
  return (await antwort.json()).requests;
}

// Port 0 vergibt einen freien lokalen Port, damit keine andere Instanz getroffen wird.
process.env.REDESIGN_PORT = '0';
const server = await starteServer();
let browser;
try {
  browser = await starteBrowser();
  const praxis = await seite(browser, server.basis, true);
  await praxis.goto(`${server.basis}/dashboard.html`);
  assert.deepEqual(await aktionenMitListenabruf(praxis, praxis.locator('#sidebarNav [data-panel="anfragen"]')), []);
  const liste = praxis.locator('#anfragenList');
  await liste.getByText('Keine Anfragen.', { exact: true }).waitFor();
  const link = await praxis.locator('#bookingRequestLinkInput').inputValue();
  assert.equal(link, `${server.basis}/booking-request.html?business=${praxisId}`);

  const oeffentlich = await seite(browser, server.basis, false);
  await oeffentlich.goto(link);
  await durchFormular(oeffentlich, probe);
  const bestaetigung = oeffentlich.getByRole('heading', { name: 'Ihre Anfrage wurde erfolgreich gesendet!', exact: true });
  await bestaetigung.waitFor();
  const bestaetigungText = await bestaetigung.innerText();
  assert.equal(daten.patients.length, 1);
  assert.equal(daten.booking_requests.length, 1);
  const [eintrag] = daten.booking_requests;
  assert.equal(eintrag.status, 'pending');
  assert.equal(eintrag.notizen, `Zeit: Mo, Mi · Vormittag\nWie bald: So bald wie möglich\nAnliegen: Ohne Rezept – Fußpflege / Beratung\n${probe.notiz}`);
  assert.equal(eintrag.preferred_date, null);
  assert.equal(eintrag.preferred_time, null);

  const offen = praxis.getByRole('button', { name: 'Offen', exact: true });
  const karten = liste.locator('.anfragen-card');
  const name = `${probe.vorname} ${probe.nachname}`;
  const nachErfolg = await aktionenMitListenabruf(praxis, offen);
  assert.deepEqual(nachErfolg.map(zeile => zeile.id), [eintrag.id]);
  await karten.getByText(name, { exact: true }).waitFor();
  assert.equal(await karten.count(), 1);
  assert.equal(await karten.locator('.anfragen-badge').innerText(), 'SZ');
  assert.deepEqual(await karten.locator('.anfragen-card-info span').allInnerTexts(), [
    `${leistung.title} · 2 Sitzung(en)`, 'Mo, Mi · Vormittag',
  ]);
  assert.equal(await praxis.locator('#anfragenNavBadge').innerText(), '1');
  await karten.getByRole('button', { name: 'Annehmen', exact: true }).waitFor();
  await karten.getByRole('button', { name: 'Anderer Termin', exact: true }).waitFor();

  await oeffentlich.getByRole('button', { name: 'Neue Anfrage stellen', exact: true }).click();
  await durchFormular(oeffentlich, fehlerProbe);
  const meldung = oeffentlich.getByText('Fehler beim Senden: Anfrage konnte nicht gespeichert werden. Bitte erneut versuchen.', { exact: true });
  await meldung.waitFor();
  assert.equal(await bestaetigung.isVisible(), false);
  assert.equal(await oeffentlich.getByRole('button', { name: 'Anfrage senden', exact: true }).isEnabled(), true);
  assert.deepEqual(await aktionenMitListenabruf(praxis, offen), nachErfolg);
  await karten.getByText(name, { exact: true }).waitFor();
  assert.equal(await karten.count(), 1);
  assert.equal(await liste.getByText(`${fehlerProbe.vorname} ${fehlerProbe.nachname}`, { exact: true }).count(), 0);

  assert.deepEqual(insertVersuche, ['patients', 'booking_requests', 'patients']);
  assert.equal(daten.patients.length, 1);
  assert.equal(daten.booking_requests.length, 1);
  assert.deepEqual(anfragen.filter(a => a.methode === 'POST').map(a => a.status), [200, 500]);
  const listenaufrufe = anfragen.filter(a => a.methode === 'GET');
  assert.ok(listenaufrufe.length >= 3);
  assert.ok(listenaufrufe.every(a => a.status === 200 && a.query.owner_id === praxisId && a.query.status === 'pending'));
  assert.deepEqual(backendFehler, ['[booking-request/create] Synthetischer Fehler beim Patienteneintrag']);
  assert.deepEqual(routingFehler, []);
  assert.deepEqual(browserFehler, []);
  const sdkZugriffe = await praxis.evaluate(() => {
    const { writes, unbekannt, storage, functions, rpc } = window.__rsFixture;
    return { writes, unbekannt, storage, functions, rpc };
  });
  const { rpc, ...sdkNebenwirkungen } = sdkZugriffe;
  assert.deepEqual(sdkNebenwirkungen, { writes: [], unbekannt: [], storage: [], functions: [] });
  assert.deepEqual(rpc.filter(name => !['get_default_business', 'get_my_permissions'].includes(name)), []);
  console.log(JSON.stringify({ ok: true, bestaetigung: bestaetigungText, offeneAnfragen: await karten.count(),
    name, leistung: leistung.title, termin, fehlermeldung: await meldung.innerText(), http: anfragen.map(a => `${a.methode} ${a.status}`),
    synthetischeInserts: { patients: daten.patients.length, booking_requests: daten.booking_requests.length }, routingFehler, browserFehler }));
} catch (fehler) {
  console.error(JSON.stringify({ routingFehler, browserFehler, backendFehler, anfragen }));
  throw fehler;
} finally {
  try { await browser?.close(); } finally { await server.stop(); }
}
