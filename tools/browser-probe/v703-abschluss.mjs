/** V7.03p: „Zuzahlung kassieren (x €)" als dritter Knopf der Folgetermin-Frage (Podologie).
 *  Synthetische App ohne Login (redesign-harness), keine echte DB. Hart: Exit 1 bei Abweichung. Eine JSON-Zeile.
 *  Teil A: normaler Bestätigungsdialog (alt + neu) — `#confirmModalExtra` bleibt versteckt; mit `extraText`
 *          sichtbar, Klick → 'extra', Escape → false; 390 px ohne Überlauf.
 *  Teil B: echte Tagesbehandlung speichern (Fixture: Insert erlaubt, eine frühere Behandlung, Positionspreise)
 *          → Drei-Knopf-Frage mit Betrag; Kassieren abbrechen → keine zweite Frage; Kassieren durchführen →
 *          danach die normale Zwei-Knopf-Frage. Mitarbeiterin ohne Recht `abrechnung` → zwei Knöpfe. */
import assert from 'node:assert/strict';
import { oeffneDashboard, starteBrowser, starteServer, ruhe, fixtureLog, API_ANTWORTEN } from '../redesign-harness.mjs';
process.env.REDESIGN_PORT ||= '18703';
API_ANTWORTEN['/api/billing/positions/podologie'] = { positions: [{ hpnr: '78010', preis: 36.1, zuzahlung: 3.61 }] };
API_ANTWORTEN['/api/billing/belegliste'] = { beleg_nr: 4711 };
const server = await starteServer(); const browser = await starteBrowser();
const VO = '50000000-0000-4000-8000-000000000002';   // uid('5', 2): Patient 2, 6 Einheiten, GKV (V9.04: echte UUID)
// Fixture-Anpassungen nur für diese Probe: laufende VO (abrechnung_status NULL), Arztangaben vollständig,
// eine frühere Behandlung, Schreiben nur dort erlaubt, wo die Probe es ausdrücklich freigibt.
const anpassen = (f) => {
  const ersetze = (alt, neu) => { assert.ok(f.includes(alt), `Fixture-Anker fehlt: ${alt.slice(0, 50)}`); f = f.replace(alt, neu); };
  ersetze("doctor_name: 'Dr. med. Erfunden',", "doctor_name: 'Dr. med. Erfunden', doctor_lanr: '999999900', unterschrift_vorhanden: true,");
  ersetze('leads, services, bookings, prescriptions, invoices, working_hours: workingHours,',
    "leads, services, bookings, prescriptions, invoices, working_hours: workingHours, podologie_behandlungen: [{ id: uid('9', 50), owner_id: OWNER, verordnung_id: uid('5', 2), lead_id: leads[1].id, behandlungsdatum: plusTage(-28), hpnr_codes: ['78010'], storniert_am: null, created_at: plusTage(-28) + 'T09:00:00Z' }],");
  ersetze("log.writes.push({ tabelle: this.tabelle, art: this.schreib[0] });",
    "log.writes.push({ tabelle: this.tabelle, art: this.schreib[0] }); if ((window.__v703Erlaubt || []).includes(this.tabelle + ':' + this.schreib[0])) return { data: this.schreib[0] === 'update' ? [{ id: 'synth' }] : null, error: null };");
  // HPNR-Katalog der Tagesbehandlung (RPC search_heilmittel): nur die verordnete Position, erfundener Preis.
  ersetze("if (name === 'get_default_business') return { data: BIZ, error: null };",
    "if (name === 'search_heilmittel') return { data: [{ code: '78010', label: 'Hornhautabtragung', preis_eur: 36.1 }], error: null }; if (name === 'get_default_business') return { data: BIZ, error: null };");
  return f;
};
const oeffne = (design, extra = {}) => oeffneDashboard(browser, { basis: server.basis, theme: 'hell', szenario: 'voll', breite: 1440, rolle: 'owner', design, ...extra });
const dialogOffen = (page) => page.locator('#confirmModal:not([hidden])').count().then(n => n > 0);
const extraSichtbar = (page) => page.evaluate(() => { const b = document.getElementById('confirmModalExtra');
  return !!b && !b.hidden && getComputedStyle(b).display !== 'none' && b.offsetParent !== null; });
const erg = {};

/** Teil A: Dialog direkt über dasselbe Modul (gleiche URL wie dashboard.js → dieselbe Instanz). */
async function teilA(design, breite = 1440) {
  const s = await oeffne(design, { breite }); const { page } = s;
  const r = await page.evaluate(async () => {
    const { zeigeBestaetigungsDialog } = await import('/module/bestaetigungs-dialog.js?v=20261115v703');
    const deps = { openModal: id => { document.getElementById(id).hidden = false; }, closeModal: id => { document.getElementById(id).hidden = true; } };
    const ex = document.getElementById('confirmModalExtra');
    const sichtbar = () => !ex.hidden && getComputedStyle(ex).display !== 'none';
    const out = {};
    let p = zeigeBestaetigungsDialog({ title: 'Probe', message: 'Normal' }, deps);
    out.normalExtraSichtbar = sichtbar(); document.getElementById('confirmModalOk').click(); out.normal = await p;
    p = zeigeBestaetigungsDialog({ title: 'Folgetermin?', message: 'Probe', confirmText: 'Folgetermin anlegen', cancelText: 'Später', extraText: 'Zuzahlung kassieren (13,61 €)' }, deps);
    out.dreiSichtbar = sichtbar(); out.dreiText = ex.textContent; out.abschluss = document.getElementById('confirmModal').dataset.abschluss || null;
    out.ueberlauf = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const fuss = document.querySelector('#confirmModal .modal-footer').getBoundingClientRect();
    out.knoepfeImFuss = [...document.querySelectorAll('#confirmModal .modal-footer button')].filter(b => !b.hidden)
      .every(b => { const r = b.getBoundingClientRect(); return r.left >= fuss.left - 1 && r.right <= fuss.right + 1; });
    ex.click(); out.drei = await p; out.nachherVersteckt = !sichtbar();
    return out;
  });
  // Escape über den echten Escape-Weg der App (module/modal-escape.js → closeModal).
  const escP = page.evaluate(async () => {
    const { zeigeBestaetigungsDialog } = await import('/module/bestaetigungs-dialog.js?v=20261115v703');
    return zeigeBestaetigungsDialog({ title: 'Esc', extraText: 'X' }, { openModal: id => { document.getElementById(id).hidden = false; }, closeModal: id => { document.getElementById(id).hidden = true; } });
  });
  await page.waitForSelector('#confirmModal:not([hidden])'); await page.keyboard.press('Escape');
  r.escape = await escP; r.escapeVersteckt = !(await extraSichtbar(page));
  assert.equal(r.normalExtraSichtbar, false, `${design}: normaler Dialog ohne dritten Knopf`); assert.equal(r.normal, true);
  assert.equal(r.dreiSichtbar, true, `${design}: dritter Knopf sichtbar`); assert.equal(r.dreiText, 'Zuzahlung kassieren (13,61 €)');
  assert.equal(r.abschluss, 'true'); assert.equal(r.drei, 'extra'); assert.equal(r.nachherVersteckt, true);
  assert.equal(r.escape, false, `${design}: Escape → false`); assert.equal(r.escapeVersteckt, true);
  assert.ok(r.ueberlauf <= 0, `${design}/${breite}: kein Überlauf (${r.ueberlauf})`); assert.equal(r.knoepfeImFuss, true, `${design}/${breite}: Knöpfe im Fuß`);
  assert.deepEqual(s.protokoll.seitenfehler, [], `${design}: keine Seitenfehler`);
  await s.kontext.close();
  return r;
}

/** Teil B: Tagesbehandlung speichern bis zur Folgetermin-Frage. Liefert die Seite mit offener Frage. */
async function bisZurFrage(design, extra = {}) {
  const s = await oeffne(design, { fixtureAnpassen: anpassen, ...extra }); const { page } = s;
  await page.evaluate(() => { window.__v703Erlaubt = ['podologie_behandlungen:insert']; });
  await page.evaluate(() => window.switchPanel('podologie-billing')); await ruhe(page, 900);
  await page.locator(`[data-vord-id="${VO}"]`).first().click(); await ruhe(page, 1200);
  await page.locator('#podBehDatum').fill('2026-10-23');
  const cb = page.locator('.pod-hpnr-cb[value="78010"]');
  if (!(await cb.isChecked())) await cb.check();
  await page.locator('#podSaveBehBtn').click();
  // Zwischenfragen (z. B. Anamnese) bestätigen, bis die Folgetermin-Frage steht.
  const titel = [];
  for (let i = 0; i < 6; i++) {
    await page.waitForSelector('#confirmModal:not([hidden])', { timeout: 8000 }).catch(() => {});
    if (!(await dialogOffen(page))) break;
    const t = (await page.locator('#confirmModalTitle').innerText()).trim(); titel.push(t);
    if (t === 'Folgetermin?') break;
    await page.locator('#confirmModalOk').click(); await ruhe(page, 600);
  }
  const fehler = await page.locator('#podBehError').innerText().catch(() => '');
  return { ...s, titel, fehler };
}

const kassierDialog = (page) => page.waitForSelector('#_kassierenModal', { timeout: 8000 });
try {
  erg.alt = await teilA('alt'); erg.neu = await teilA('neu'); erg.neu390 = await teilA('neu', 390);

  // B1: Inhaberin, offene Zuzahlung → drei Knöpfe; Kassieren abbrechen → keine zweite Frage, kein Schreiben.
  for (const design of ['neu', 'alt']) {
    const b = await bisZurFrage(design); const { page } = b;
    assert.equal(b.titel.at(-1), 'Folgetermin?', `${design}: Folgetermin-Frage erreicht (${b.titel.join(' > ')} ${b.fehler})`);
    assert.equal(await extraSichtbar(page), true, `${design}: dritter Knopf sichtbar`);
    const text = (await page.locator('#confirmModalExtra').innerText()).trim();
    assert.match(text, /^Zuzahlung kassieren \(13,61\s€\)$/, `${design}: Betrag wie Geldzeile (${text})`);
    assert.equal((await page.locator('#confirmModalOk').innerText()).trim(), 'Folgetermin anlegen');
    assert.equal((await page.locator('#confirmModalCancel').innerText()).trim(), 'Später');
    erg[`b1_${design}`] = { titel: b.titel, knopf: text };
    const schreibVor = (await fixtureLog(page)).writes.length;
    await page.locator('#confirmModalExtra').click(); await kassierDialog(page);
    assert.equal(await dialogOffen(page), false, `${design}: Frage geschlossen während Kassieren`);
    await page.locator('#_kassCancel').click(); await ruhe(page, 800);
    assert.equal(await dialogOffen(page), false, `${design}: Abbruch → keine zweite Frage`);
    assert.equal((await fixtureLog(page)).writes.length, schreibVor, `${design}: Abbruch schreibt nichts`);
    assert.deepEqual(b.protokoll.seitenfehler, [], `${design}: keine Seitenfehler`);
    await b.kontext.close();
  }

  // B2: Kassieren durchführen (Fixture lässt Anspruch zu, Beleg-API antwortet) → danach Zwei-Knopf-Frage.
  {
    const b = await bisZurFrage('neu'); const { page } = b;
    await page.evaluate(() => { window.__v703Erlaubt.push('prescriptions:update'); });
    await page.locator('#confirmModalExtra').click(); await kassierDialog(page);
    await page.locator('#_kassPrint').uncheck();
    await page.locator('#_kassierenModal .zahlart-chip').first().click();
    await page.waitForSelector('#confirmModal:not([hidden])', { timeout: 8000 });
    assert.equal((await page.locator('#confirmModalTitle').innerText()).trim(), 'Folgetermin?', 'nach Kassieren: Folgetermin-Frage');
    assert.equal(await extraSichtbar(page), false, 'nach Kassieren: nur zwei Knöpfe');
    const log = await fixtureLog(page);
    erg.b2 = { writes: log.writes.map(w => `${w.tabelle}:${w.art}`), api: b.protokoll.api.filter(a => a.includes('belegliste')) };
    assert.ok(erg.b2.writes.includes('prescriptions:update'), 'Anspruch über vorhandenen Kassierweg');
    assert.ok(erg.b2.api.includes('POST /api/billing/belegliste'), 'Beleg über vorhandenen Kassierweg');
    await page.locator('#confirmModalCancel').click(); await ruhe(page, 300);
    assert.deepEqual(b.protokoll.seitenfehler, [], 'B2: keine Seitenfehler'); await b.kontext.close();
  }

  // B3: Mitarbeiterin MIT Recht `abrechnung` → drei Knöpfe (Melih 15.11.: auch Angestellte mit Recht).
  {
    const mitRecht = (f) => anpassen(f).replace("has_access: module !== 'abrechnung'", 'has_access: true');
    const b = await bisZurFrage('neu', { rolle: 'employee', fixtureAnpassen: mitRecht }); const { page } = b;
    assert.equal(b.titel.at(-1), 'Folgetermin?', `employee mit Recht: Folgetermin-Frage erreicht (${b.titel.join(' > ')} ${b.fehler})`);
    assert.equal(await extraSichtbar(page), true, 'employee mit abrechnung: dritter Knopf');
    erg.b3 = { titel: b.titel };
    assert.deepEqual(b.protokoll.seitenfehler, [], 'B3: keine Seitenfehler'); await b.kontext.close();
  }
  // B5: Inhaberin, Verordnung zuzahlungsbefreit → Frage exakt wie bisher (zwei Knöpfe).
  {
    const befreit = (f) => anpassen(f).replace('zuzahlung_befreit: false,', 'zuzahlung_befreit: true,');
    const b = await bisZurFrage('neu', { fixtureAnpassen: befreit }); const { page } = b;
    assert.equal(b.titel.at(-1), 'Folgetermin?', `befreit: Folgetermin-Frage erreicht (${b.titel.join(' > ')} ${b.fehler})`);
    assert.equal(await extraSichtbar(page), false, 'befreit: kein dritter Knopf');
    erg.b5 = { titel: b.titel };
    assert.deepEqual(b.protokoll.seitenfehler, [], 'B5: keine Seitenfehler'); await b.kontext.close();
  }
  // B4: Mitarbeiterin OHNE Recht `abrechnung` (Fixture-Standard): das Behandlungen-Panel selbst hängt an
  // `abrechnung` (SIDEBAR_TO_MODULE) — sie erreicht weder Speichern noch Frage. Der Rechte-Zweig im Dialog
  // ist damit nur Zweitschutz und per Unit-Test (kassierAngebot darf:false) geprüft.
  {
    const s = await oeffne('neu', { rolle: 'employee', fixtureAnpassen: anpassen }); const { page } = s;
    const panel = await page.evaluate(async () => { try { await window.switchPanel('podologie-billing'); } catch { /* egal */ } return document.querySelector('.panel.active')?.id; });
    assert.notEqual(panel, 'panel-podologie-billing', 'employee ohne abrechnung: Behandlungen-Panel gesperrt');
    erg.b4 = { panel };
    assert.deepEqual(s.protokoll.seitenfehler, [], 'B4: keine Seitenfehler'); await s.kontext.close();
  }
  console.log(JSON.stringify({ ok: true, ...erg }));
} catch (err) {
  console.log(JSON.stringify({ ok: false, fehler: err.message, ...erg }));
  process.exitCode = 1;
} finally { await browser.close(); await server.stop?.(); }
process.exit(process.exitCode ?? 0);
