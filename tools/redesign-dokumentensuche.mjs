/** Geschlossene synthetische UI-Probe; keine echten DB-/Zahlungs-/Sendeaktionen.
 * REDESIGN_PORT=18082 timeout -s KILL 180 node tools/redesign-dokumentensuche.mjs
 */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { WURZEL, starteServer, starteBrowser, oeffneDashboard } from './redesign-harness.mjs';
const out = '/tmp/praxura-v209b-ui'; await mkdir(out, { recursive: true });
// Nur diese Probe: gültige UUIDs und vollständige synthetische Rechnungsfelder.
// Globale Fixture/Alt-Referenzen bleiben unverändert.
const fixture = (await readFile(WURZEL + '/tools/browser-probe/redesign-fixture.js', 'utf8'))
  .replace('${gruppe}000000-', '${gruppe}0000000-')
  .replace('or() { return this; }', "or(expr) { if(expr === 'therapie_bereich.is.null,therapie_bereich.neq.podo') this.filter.push(r => r.therapie_bereich == null || r.therapie_bereich !== 'podo'); return this; }")
  .replace("invoice_number: 'RE-2026-'", "patient_id: i === 0 ? null : leads[i + 2].id, business_id: null, invoice_type: 'privat', total_patient: 42, subtotal: 42, line_items: [{ title: 'Synthetische Leistung', quantity: 1, unit_price: 42 }], invoice_number: 'RE-2026-'")
  .replace("select(sp = '*', opts = {}) {", "select(sp = '*', opts = {}) { if(sp.startsWith('id,owner_id,patient_id,ausstellungsdatum') || sp.startsWith('id,owner_id,business_id,patient_id,invoice_number')) (log.dokumentsuche ||= []).push(this.tabelle);")
  .replace('log.reads.push(this.tabelle);', "log.reads.push(this.tabelle); if(window.__sucheFehler && ['prescriptions','invoices'].includes(this.tabelle)) return {data:null,error:{code:'SYNTHETISCH'}};");
const server = await starteServer(), browser = await starteBrowser(), result = [];
const original = browser.newContext.bind(browser);
browser.newContext = async (...args) => { const c = await original(...args); await c.routeWebSocket('**', ws => ws.close()); return c; };
const cases = [
  ...['hell', 'dunkel'].flatMap(theme => ['owner', 'employee'].map(rolle => ({ design: 'neu', theme, rolle, breite: 1440 }))),
  ...['hell', 'dunkel'].map(theme => ({ design: 'alt', theme, rolle: 'owner', breite: 1440 })),
  { design: 'neu', theme: 'hell', rolle: 'owner', breite: 900 },
  { design: 'neu', theme: 'dunkel', rolle: 'owner', breite: 390 },
];
if (process.argv.includes('--kurz')) cases.splice(1);
try { for (const o of cases) {
  const c = await oeffneDashboard(browser, { basis: server.basis, ...o, szenario: 'voll' }), p = c.page;
  p.setDefaultTimeout(12000);
  try {
    await p.route('**/vendor/supabase-js.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: fixture }));
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.locator('#sidebarNav .sidebar-item[data-panel="kunden"]').waitFor({ state: 'attached' });
    const input = p.locator('#pxSuche'), select = p.getByRole('combobox', { name: 'Suchbereich' });
    if (o.design === 'alt') assert.equal(await input.count(), 0);
    else if (o.breite < 900) assert.equal(await input.isVisible(), false);
    else if (o.rolle === 'employee') {
      assert.equal(await select.isVisible(), false);
      const vor = await p.evaluate(() => window.__rsFixture.reads.filter(t => t === 'invoices').length);
      await input.fill('Test'); await p.locator('.px-suche .patient-search-list li[data-id]').first().waitFor();
      assert.equal(await p.evaluate(() => window.__rsFixture.reads.filter(t => t === 'invoices').length), vor);
      assert.deepEqual(await p.evaluate(() => window.__rsFixture.dokumentsuche || []), [], 'Keine neuen Dokumentquellen; vorhandener Patientencache liest weiterhin sein VO-Beiwerk');
    } else {
      const invoiceNumber = o.theme === 'hell' ? 'RE-2026-101' : 'RE-2026-102';
      for (const art of ['verordnung', 'rechnung']) {
        await select.focus(); await select.selectOption(art); await input.fill(art === 'rechnung' ? invoiceNumber : 'Erika');
        const li = p.locator(`.px-suche li[data-id^="${art}:"]`).first(); await li.waitFor();
        assert.match(await p.locator('#pxSucheHinweis').innerText(), /Teilbestand/);
        await input.press('ArrowDown'); await input.press('Enter');
        const dialog = p.locator('#pxDokumentDialog'); await dialog.waitFor({ state: 'visible' });
        if (art === 'rechnung') {
          await p.waitForFunction(nr => document.querySelector('#pxDokumentDialog [data-px-id="invvNumber"]')?.textContent === nr, invoiceNumber);
          assert.match(await dialog.innerText(), /Synthetische Leistung/);
          assert.equal(await p.locator('#invvNumber').innerText(), '—', 'Bestehender Rechnungsbereich unberührt');
          assert.equal(await dialog.locator('button').count(), 1, 'Kein neuer Druck-/Schreibweg');
        } else await p.waitForFunction(() => document.querySelector('#pxDokumentDialog .px-dokument-inhalt')?.textContent.includes('Erika'));
        assert.equal(await dialog.locator('button').count(), 1, 'Leseansicht enthält ausschließlich Schließen');
        await dialog.screenshot({ path: out + '/' + o.theme + '-' + o.breite + '-' + art + '.png' });
        if (art === 'rechnung') await p.keyboard.press('Escape');
        else await p.getByRole('button', { name: 'Schließen', exact: true }).click();
        await dialog.waitFor({ state: 'detached' });
        assert.equal(await select.evaluate(el => document.activeElement === el), true, 'Fokus kehrt zur Suchauswahl zurück');
      }
      await p.evaluate(() => { window.__sucheFehler = true; });
      await select.focus(); await select.selectOption('patient'); await select.focus(); await select.selectOption('rechnung');
      await p.waitForFunction(() => document.querySelector('#pxSucheHinweis')?.textContent.includes('konnten nicht geladen'));
      assert.equal(await p.locator('.px-suche li[data-id]').count(), 0);
    }
    assert.deepEqual(c.protokoll.seitenfehler, []); assert.deepEqual(c.protokoll.fremd, []);
    assert.deepEqual(await p.evaluate(() => window.__rsFixture.writes), []);
    const breite = await p.evaluate(() => ({ innen: innerWidth, seite: document.documentElement.scrollWidth }));
    assert.ok(breite.seite <= breite.innen, JSON.stringify(breite));
    const suchfeldSichtbar = await input.isVisible(), auswahlSichtbar = await select.isVisible();
    const auswahlMass = auswahlSichtbar ? await select.evaluate(el => ({ breite: el.getBoundingClientRect().width, hoehe: el.getBoundingClientRect().height })) : null;
    if (auswahlMass) assert.ok(auswahlMass.breite >= 44 && auswahlMass.hoehe >= 44, JSON.stringify(auswahlMass));
    await p.screenshot({ path: out + '/' + o.design + '-' + o.rolle + '-' + o.theme + '-' + o.breite + '.png' });
    result.push({ ...o, suchfeldSichtbar, auswahlSichtbar, auswahlMass, viewport: breite, schreibt: 0, seitenfehler: 0, fremdhosts: 0 }); console.log(JSON.stringify(result.at(-1)));
  } catch (e) { await p.screenshot({ path: out + '/fehler.png' }); console.log(JSON.stringify(c.protokoll)); throw e; }
  finally { await c.kontext.close(); }
} await writeFile(out + '/bericht.json', JSON.stringify(result, null, 2)); }
finally { await browser.close(); await server.stop(); }
