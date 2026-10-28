/** V2.09c: Originaldialog/-renderer mit altem DOM und verzögerten synthetischen Reads.
 * Kein Server: about:blank, HTTP/WS vor Page gesperrt, keine Schreibwege.
 * node tools/redesign-dokumentdialog.mjs
 */
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const source = name => readFile(new URL('../' + name, import.meta.url), 'utf8');
const src = (await (process.env.REDESIGN_DOKUMENT_QUELLE ? readFile(process.env.REDESIGN_DOKUMENT_QUELLE, 'utf8')
  : source('module/kopf-dokumente.js'))).replace(/^import .*;$/m, '').replace(/export /g, '');
const renderer = await source('module/rechnung-ansicht.js');
const a = renderer.indexOf('export async function openInvView(');
const renderFn = renderer.slice(a, renderer.indexOf('\nexport function closeInvView', a)).replace('export ', '');
const html = await source('dashboard.html');
const browser = await chromium.launch({ headless: true });
try {
  for (const modus of ['erfolg', 'fehler', 'timeout', 'scope']) {
    const context = await browser.newContext({ serviceWorkers: 'block' }), requests = [];
    await context.route('**/*', r => { requests.push(r.request().url()); return r.abort(); });
    await context.routeWebSocket('**', s => s.close());
    const page = await context.newPage();
    try {
      await page.evaluate(({ src, renderFn, html, modus }) => {
        const tree = new DOMParser().parseFromString(html, 'text/html');
        const panel = document.createElement('div'); panel.hidden = true;
        panel.append(tree.getElementById('invoicePrintArea')); document.body.append(panel);
        document.getElementById('invvNumber').textContent = 'RE-ALT-A';
        document.getElementById('invvPatient').textContent = 'Synthetischer Patient A';
        const owner = '10000000-0000-4000-8000-000000000001';
        const invoice = { id: '50000000-0000-4000-8000-000000000002', owner_id: owner, business_id: null,
          patient_id: '20000000-0000-4000-8000-000000000002', invoice_number: 'RE-NEU-B', aussteller_snapshot: {} };
        let resolve;
        const pending = new Promise(r => { resolve = r; });
        const sb = { from(table) {
          const q = new Proxy({}, { get(_, m) {
            if (m === 'then') return (ok, fail) => (table === 'invoices' ? Promise.resolve({ data: invoice }) : pending).then(ok, fail);
            return () => q;
          } }); return q;
        } };
        // Nur Renderer-Abhängigkeiten ohne Buchungs-/Preislogik synthetisch ersetzen.
        const deps = { liste: () => [], profile: () => ({}), supabase: sb, escapeHtml: s => String(s),
          leistungszeitraum: () => ({}), fuelleBelegPositionen() {} };
        const open = new Function('d', 'brandingAus', 'typKennzeichen', renderFn + ';return openInvView;')(deps, () => ({}), () => 'Rechnung');
        const f = new Function(src + ';return createDokumentSuche;')();
        const k = { rolle: 'owner', uid: owner, ownerId: owner, businessId: null, bereit: true, financeBereit: true,
          patientsGemeinsam: true, financeGemeinsam: true, rechnungenErlaubt: true, verordnungenErlaubt: true,
          supabase: sb, ladeRechnungen: async () => [invoice] };
        const s = f({ kontext: () => k, scopeLader: async () => null, rechnungOeffner: open, timeoutMs: modus === 'timeout' ? 500 : 30000 });
        window.__probe = { resolve, invalidate: () => { k.ownerId = 'ANDERER_SCOPE'; s.invalide(); } };
        window.__fertig = s.laden('rechnung').then(r => s.oeffnen(r.zeilen[0]));
      }, { src, renderFn, html, modus });
      const dialog = page.locator('#pxDokumentDialog');
      await dialog.waitFor({ state: 'visible' });
      assert.equal(await dialog.locator('[data-px-id="invvNumber"]').isVisible(), false, 'Alte Nummer während Read unsichtbar');
      assert.equal(await dialog.locator('[data-px-id="invvPatient"]').isVisible(), false, 'Alter Patient während Read unsichtbar');
      assert.match(await dialog.innerText(), /Rechnung wird geladen/);
      if (modus === 'scope') await page.evaluate(() => window.__probe.invalidate());
      if (modus !== 'timeout') await page.evaluate(fehler => window.__probe.resolve(fehler ? { error: { message: 'synthetisch' } }
        : { data: { first_name: 'Synthetischer', last_name: 'Patient B' } }), modus === 'fehler');
      const result = await page.evaluate(() => window.__fertig);
      assert.equal(result.status, modus === 'erfolg' ? 'ok' : modus === 'scope' ? 'veraltet' : 'fehler');
      if (modus === 'erfolg') {
        assert.equal(await dialog.locator('[data-px-id="invvNumber"]').innerText(), 'RE-NEU-B');
        assert.equal(await dialog.locator('[data-px-id="invvNumber"]').isVisible(), true);
        assert.match(await dialog.innerText(), /Synthetischer Patient B/);
        assert.doesNotMatch(await dialog.innerText(), /RE-ALT-A|Patient A|wird geladen/);
      } else if (modus !== 'scope') {
        assert.match(await dialog.innerText(), /Dokument konnte nicht geladen/);
        assert.doesNotMatch(await dialog.innerText(), /RE-ALT-A|Patient A/);
        if (modus === 'timeout') {
          await page.evaluate(() => window.__probe.resolve({ data: { first_name: 'Spaet', last_name: 'B' } }));
          assert.doesNotMatch(await dialog.innerText(), /RE-NEU-B|Spaet/);
        }
      } else assert.equal(await dialog.count(), 0);
      assert.equal(await page.locator('#invvNumber').textContent(), 'RE-ALT-A', 'Gemeinsame Originalansicht unverändert');
      assert.deepEqual(requests, []);
      console.log(JSON.stringify({ modus, status: result.status, requests: requests.length }));
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
