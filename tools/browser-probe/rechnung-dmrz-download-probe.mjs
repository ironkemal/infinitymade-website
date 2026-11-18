/** Lokale DMRZ-Browserabnahme: echte Rechnungsansicht, synthetische Supabase-Fixture.
 *  rtk proxy env REDESIGN_PORT=0 node tools/browser-probe/rechnung-dmrz-download-probe.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { API_ANTWORTEN, starteBrowser, starteServer } from '../redesign-harness.mjs';

const uhr = '2026-11-18T09:15:00.000Z';
const apiAntworten = {
  ...API_ANTWORTEN,
  '/api/ai/_config': { enabled: false, provider: null, configured: false, kiEnabled: false },
  '/api/mailversand': {
    kutu: false, verfuegbar: false, einstellung: null, quelle: null, env: null,
    google: { verfuegbar: false, verbunden: false, adresse: null }, presets: {}, hinweise: {}, vorgaben: {},
  },
};
const basisFixture = await readFile(new URL('./redesign-fixture.js', import.meta.url), 'utf8');
const fixture = basisFixture + `
  const patient = leads[0];
  const rezept = prescriptions[0];
  const arzt = tabellen.aerzte[0];
  Object.assign(ownerProfil, {
    sector: 'physiotherapy', business_name: 'Musterpraxis Müller & Partner',
    phone: '+49 000 12345', ik_number: '999999901',
  });
  Object.assign(patient, { last_name: 'Müller & Sohn' });
  arzt.arzt_name = 'Dr. med. Erfunden';
  Object.assign(rezept, {
    therapie_bereich: 'physio', arzt_id: arzt.id, aerzte: arzt, hausbesuch: true,
    abrechnung_status: 'bereit', dmrz_exported_at: null, status: 'completed',
    heilmittel: 'Krankengymnastik', diagnosegruppe: 'WS', icd10: 'M54.5',
    ausstellungsdatum: '2026-10-12', behandlungsbeginn: '2026-10-21', frequenz: '1–2x wöchentlich',
  });
  const gkv = {
    ...invoices[0], patient_id: patient.id, patient_name: 'Erika Müller & Sohn',
    prescription_id: rezept.id, rx1: clone(rezept), invoice_type: 'gkv',
    status: 'sent', subtotal: 70.5, eigenanteil_pct: 10, eigenanteil_eur: 7.05,
    kassenzuzahlung: 10, total_patient: 17.05, notes: 'Probe <intern>',
    line_items: [
      { title: 'Übung & Beratung', quantity: 2, unit_price: 15.25 },
      { title: 'Hausbesuch', quantity: 1, unit_price: 40 },
    ],
  };
  const privat = { ...gkv, id: invoices[1].id, invoice_number: 'SYN-PRIVAT', invoice_type: 'privat' };
  const alt = { ...gkv, id: invoices[2].id, invoice_number: 'SYN-ALT',
    prescription_id: null, verordnung_id: rezept.id, rx1: null, rx2: clone(rezept) };
  const veraltet = { ...gkv, id: invoices[3].id, invoice_number: 'SYN-VERALTET' };
  gkv.invoice_number = 'SYN-GKV';
  tabellen.invoices = [gkv, privat, alt, veraltet];

  const probe = window.__dmrzProbe = {
    rezeptId: rezept.id, reads: log.reads, attempts: [], allowed: false,
    entferneRezeptbezug: () => { veraltet.prescription_id = null; },
    stand: () => clone({ invoices: tabellen.invoices, prescriptions: tabellen.prescriptions,
      writes: log.writes, storage: log.storage, functions: log.functions }),
  };
  const vorherFiltern = Abfrage.prototype._f;
  Abfrage.prototype._f = function (op, spalte, wert, negiert = false) {
    (this.dmrzFilter ??= []).push({ op, spalte, wert, negiert });
    return vorherFiltern.call(this, op, spalte, wert, negiert);
  };
  const vorherAusfuehren = Abfrage.prototype.lauf;
  Abfrage.prototype.lauf = function () {
    if (!this.schreib) return vorherAusfuehren.call(this);
    const [art, daten] = this.schreib;
    const filter = this.dmrzFilter ?? [];
    const versuch = clone({ tabelle: this.tabelle, art, daten, filter });
    probe.attempts.push(versuch);
    const [ziel] = filter;
    if (!probe.allowed || probe.attempts.length !== 1 || this.tabelle !== 'prescriptions' ||
        art !== 'update' || filter.length !== 1 || this.filter.length !== 1 ||
        ziel.op !== 'eq' || ziel.negiert || ziel.spalte !== 'id' || ziel.wert !== rezept.id ||
        !daten || Object.keys(daten).length !== 1 || daten.dmrz_exported_at !== '${uhr}') {
      return vorherAusfuehren.call(this);
    }
    rezept.dmrz_exported_at = daten.dmrz_exported_at;
    return { data: null, error: null };
  };
`;

const server = await starteServer();
let browser;
const verletzungen = [];
try {
  browser = await starteBrowser();
  const context = await browser.newContext({ acceptDownloads: true, serviceWorkers: 'block',
    viewport: { width: 1440, height: 1000 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  await context.routeWebSocket('**/*', socket => {
    verletzungen.push('WebSocket');
    socket.close({ code: 1008, reason: 'Lokale Browserprobe' });
  });
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === server.basis && request.method() === 'GET') {
      if (url.pathname === '/vendor/supabase-js.js') {
        return route.fulfill({ contentType: 'text/javascript', body: fixture });
      }
      if (url.pathname === '/api/config') {
        return route.fulfill({ json: { supabaseUrl: 'https://synthetic.invalid',
          supabaseAnonKey: 'synthetic', apiBase: '/api', istKutu: false,
          telemetryEnabled: false, designVorschau: true } });
      }
      if (Object.hasOwn(apiAntworten, url.pathname)) {
        const antwort = apiAntworten[url.pathname];
        return route.fulfill({ json: typeof antwort === 'function' ? antwort({ szenario: 'voll' }) : antwort });
      }
      if (!url.pathname.startsWith('/api/') &&
          /\.(html|js|css|json|png|svg|ico|webp|woff2|woff|ttf|webmanifest)$/.test(url.pathname)) {
        return route.continue();
      }
    }
    verletzungen.push(`${request.method()} ${url.origin}${url.pathname}`);
    return route.abort();
  });
  await context.addInitScript(() => {
    window.__rsDay = '2026-11-18';
    window.__rsRolle = 'owner';
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => verletzungen.push(error.message));
  const downloads = [];
  page.on('download', download => downloads.push(download));
  await page.clock.setFixedTime(new Date(uhr));
  await page.goto(`${server.basis}/dashboard.html?design=alt`);
  const abrechnung = page.locator('#sidebarNav [data-group-id="abrechnung"]');
  const rechnungen = abrechnung.locator('[data-panel="rechnungen"]');
  await rechnungen.waitFor({ state: 'attached' });
  if (!await rechnungen.isVisible()) {
    await abrechnung.locator('.nav-group-header').click();
  }
  await rechnungen.click();
  await page.locator('#invListBody tr').filter({ hasText: 'SYN-GKV' }).waitFor();

  const exportKnopf = page.getByRole('button', { name: 'DMRZ XML', exact: true });
  const dialog = page.locator('#confirmModal');
  const dialogText = dialog.locator('#confirmModalText');
  const oeffneRechnung = async nummer => {
    await page.locator('#invListBody tr').filter({ hasText: nummer })
      .getByRole('button', { name: 'Ansehen', exact: true }).click();
    await exportKnopf.waitFor();
  };
  const zurueck = () => page.locator('#invvBackBtn').click();
  const pruefeUnveraendert = async fall => {
    assert.equal(downloads.length, 0, fall + ' ohne Download');
    assert.deepEqual(await page.evaluate(() => window.__dmrzProbe.attempts), [], fall + ' ohne Schreibversuch');
    assert.deepEqual(await page.evaluate(() => window.__dmrzProbe.stand()), ausgangsstand, fall + ' ohne Datenänderung');
  };
  const bestaetigung = async () => {
    await exportKnopf.click();
    await dialog.waitFor();
    assert.equal(await dialog.locator('#confirmModalTitle').innerText(), 'DMRZ-Export (interner Export) erstellen?');
    assert.match(await dialogText.innerText(), /KEIN §302-Versand an die Krankenkasse/);
    assert.match(await dialogText.innerText(), /markiert die Rechnung NICHT als abgerechnet/);
  };

  await oeffneRechnung('SYN-GKV');
  const ausgangsstand = await page.evaluate(() => window.__dmrzProbe.stand());
  assert.deepEqual(ausgangsstand.writes, [], 'kein Schreibversuch beim Start');
  assert.equal(await exportKnopf.isEnabled(), true, 'GKV-Rechnung mit Rezept');
  await bestaetigung();
  const vorher = await page.evaluate(() => window.__dmrzProbe.reads.length);
  await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => window.__dmrzProbe.reads.length), vorher, 'keine Exportabfrage nach Abbruch');
  await pruefeUnveraendert('Abbruch');
  await zurueck();

  for (const [nummer, fall] of [['SYN-PRIVAT', 'Privatbeleg'], ['SYN-ALT', 'Beleg ohne prescription_id']]) {
    await oeffneRechnung(nummer);
    assert.equal(await exportKnopf.isDisabled(), true, fall);
    assert.match(await exportKnopf.getAttribute('title'), /exportierbarer GKV-Verordnung/, fall);
    // Native Mausaktion auf den sichtbaren, deaktivierten Knopf.
    const rect = await exportKnopf.boundingBox();
    await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
    assert.equal(await dialog.isVisible(), false, fall + ' ohne Exportdialog');
    await pruefeUnveraendert(fall);
    await zurueck();
  }

  await oeffneRechnung('SYN-VERALTET');
  await bestaetigung();
  // Die geöffnete Ansicht hat noch den alten Bezug, die erneute Leseabfrage nicht.
  await page.evaluate(() => window.__dmrzProbe.entferneRezeptbezug());
  const vorPruefung = await page.evaluate(() => window.__dmrzProbe.reads.length);
  await dialog.getByRole('button', { name: 'Exportieren', exact: true }).click();
  await page.locator('#toastContainer').getByText(/prescription_id fehlt/).waitFor();
  assert.deepEqual(await page.evaluate(ab => window.__dmrzProbe.reads.slice(ab), vorPruefung), ['invoices']);
  assert.equal(downloads.length, 0, 'Veralteter Bezug ohne Download');
  assert.deepEqual(await page.evaluate(() => window.__dmrzProbe.attempts), [], 'Veralteter Bezug ohne Schreibversuch');
  await zurueck();

  await oeffneRechnung('SYN-GKV');
  await bestaetigung();
  const vorExport = await page.evaluate(() => {
    window.__dmrzProbe.allowed = true;
    return { leseIndex: window.__dmrzProbe.reads.length, stand: window.__dmrzProbe.stand() };
  });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Exportieren', exact: true }).click(),
  ]);
  await page.locator('#toastContainer').getByText('DMRZ XML heruntergeladen ✓', { exact: true }).waitFor();
  assert.equal(await download.failure(), null);
  assert.equal(download.suggestedFilename(), 'DMRZ-SYN-GKV.xml');
  assert.equal(downloads.length, 1, 'genau ein Browserdownload');
  const xml = await readFile(await download.path(), 'utf8');
  const xmlWerte = await page.evaluate(text => {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const root = doc.documentElement;
    return {
      parseFehler: !!doc.querySelector('parsererror'),
      wurzel: root.localName,
      namespace: root.namespaceURI,
      format: root.getAttribute('format'),
      erzeugt: root.getAttribute('erzeugt'),
      nummer: root.querySelector('Rechnung')?.getAttribute('nummer'),
      typ: root.querySelector('Verordnung')?.getAttribute('typ'),
      zeilen: Array.from(root.querySelectorAll('Rechnung > Leistungen > Leistung'), el =>
        [el.getAttribute('position'), ...Array.from(el.children, tag => tag.textContent)]),
      felder: Object.fromEntries([
        'Leistungserbringer > Name', 'Leistungserbringer > IK', 'Versicherter > Name',
        'Versicherter > Geburtsdatum', 'Versicherter > Versichertennummer', 'Versicherter > Krankenkasse',
        'Arzt > Name', 'Arzt > LANR', 'Arzt > BSNR', 'Verordnung > Ausstellungsdatum',
        'Verordnung > ICD10', 'Verordnung > Diagnosegruppe', 'Verordnung > Heilmittel',
        'Verordnung > Frequenz', 'Verordnung > Hausbesuch', 'Verordnung > Dringend',
        'Rechnung > Zwischensumme', 'Rechnung > EigenanteilEuro', 'Rechnung > Kassenzuzahlung',
        'Rechnung > GesamtPatient', 'Rechnung > Notizen',
      ].map(pfad => [pfad, root.querySelector(pfad)?.textContent])),
    };
  }, xml);
  assert.deepEqual(xmlWerte, {
    parseFehler: false,
    wurzel: 'DMRZExport',
    namespace: 'https://infinitymade.de/dmrz/v1',
    format: '§302-vereinfacht-v1',
    erzeugt: uhr,
    nummer: 'SYN-GKV',
    typ: 'standard',
    zeilen: [['1', 'Übung & Beratung', '2', '15.25', '30.50'], ['2', 'Hausbesuch', '1', '40.00', '40.00']],
    felder: {
      'Leistungserbringer > Name': 'Musterpraxis Müller & Partner', 'Leistungserbringer > IK': '999999901',
      'Versicherter > Name': 'Erika Müller & Sohn', 'Versicherter > Geburtsdatum': '1951-03-14',
      'Versicherter > Versichertennummer': 'X000000000', 'Versicherter > Krankenkasse': 'AOK Synthetisch',
      'Arzt > Name': 'Dr. med. Erfunden', 'Arzt > LANR': '999999900', 'Arzt > BSNR': '999999900',
      'Verordnung > Ausstellungsdatum': '2026-10-12', 'Verordnung > ICD10': 'M54.5',
      'Verordnung > Diagnosegruppe': 'WS', 'Verordnung > Heilmittel': 'Krankengymnastik',
      'Verordnung > Frequenz': '1–2x wöchentlich', 'Verordnung > Hausbesuch': 'true', 'Verordnung > Dringend': 'false',
      'Rechnung > Zwischensumme': '70.50', 'Rechnung > EigenanteilEuro': '7.05',
      'Rechnung > Kassenzuzahlung': '10.00', 'Rechnung > GesamtPatient': '17.05', 'Rechnung > Notizen': 'Probe <intern>',
    },
  });
  const nachExport = await page.evaluate(ab => {
    const probe = window.__dmrzProbe;
    return { rezeptId: probe.rezeptId, stand: probe.stand(), attempts: probe.attempts, reads: probe.reads.slice(ab) };
  }, vorExport.leseIndex);
  assert.deepEqual(nachExport.reads, ['invoices', 'leads', 'prescriptions', 'aerzte'], 'genau die Exportabfragen');
  assert.deepEqual(nachExport.attempts, [{
    tabelle: 'prescriptions', art: 'update', daten: { dmrz_exported_at: uhr },
    filter: [{ op: 'eq', spalte: 'id', wert: nachExport.rezeptId, negiert: false }],
  }], 'ein Update für genau das verknüpfte Rezept');
  const erwartet = vorExport.stand;
  const exportiertesRezept = erwartet.prescriptions.find(rezept => rezept.id === nachExport.rezeptId);
  assert.equal(exportiertesRezept.dmrz_exported_at, null);
  exportiertesRezept.dmrz_exported_at = uhr;
  assert.deepEqual(nachExport.stand, erwartet, 'ausschließlich der Exportzeitpunkt ändert sich');
  assert.deepEqual(verletzungen, [], 'keine unerwarteten Browseranfragen oder Seitenfehler');
  console.log(JSON.stringify({
    ok: true, datei: download.suggestedFilename(), downloads: downloads.length, fixtureUpdates: nachExport.attempts.length,
    gegenproben: ['Abbruch', 'Privatbeleg', 'fehlende prescription_id', 'veralteter Rezeptbezug'],
    grenze: 'Lokales Chromium mit synthetischer Supabase- und API-Fixture',
  }));
} catch (error) {
  if (verletzungen.length) console.error(JSON.stringify({ verletzungen }));
  throw error;
} finally {
  await browser?.close();
  await server.stop();
}
