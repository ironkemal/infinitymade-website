/** V7.02p: Akte → vorhandene Doku-Formulare (Anamnese, Notiz, Fußbefund) mit richtigem Patienten.
 *  Synthetische App ohne Login (redesign-harness). Hart: Exit 1 bei Abweichung. Eine JSON-Zeile. */
import assert from 'node:assert/strict';
import { oeffneDashboard, starteBrowser, starteServer, ruhe, fixtureLog } from '../redesign-harness.mjs';
process.env.REDESIGN_PORT ||= '18702';
const server = await starteServer(); const browser = await starteBrowser();
const oeffne = (design, extra = {}) => oeffneDashboard(browser, { basis: server.basis, theme: 'hell', szenario: 'voll', breite: 1440, rolle: 'owner', design, ...extra });
const ohneAnamnese = (f) => f.replace("module !== 'abrechnung'", "module !== 'abrechnung' && module !== 'anamnese'");
const akteOeffnen = async (page) => {
  await page.evaluate(() => window.switchPanel('kunden')); await ruhe(page, 700);
  await page.locator('#panel-kunden tr.lead-row').first().click();
  await page.waitForSelector('#patientDetailModal:not([hidden])', { timeout: 8000 }); await ruhe(page, 900);
};
const knopf = (page, panel) => page.locator(`#${panel} .px-akte-aktionen button`);
const erg = {};
try {
  const n = await oeffne('neu'); const { page } = n;
  await akteOeffnen(page);
  const zahl = await page.locator('#patientDetailModal .px-akte-aktionen button').count();
  assert.equal(zahl, 3, `Inhaberin/Podologie: 3 Knöpfe (${zahl})`); erg.knoepfe = zahl;
  assert.equal(await page.locator('#patientDetailModal .px-akte-aktionen').count(), 3, 'drei Zeilen');
  const texte = await page.locator('#patientDetailModal .px-akte-aktionen button').allTextContents();
  assert.deepEqual(texte.sort(), ['Anamnese bearbeiten', 'Fußbefund erfassen', 'Notiz schreiben']);
  const name = (await page.locator('#pdModalTitle').innerText()).trim();
  const leadId = await page.locator('#panel-kunden tr.lead-row').first().getAttribute('data-lead-id');
  const schreibVor = (await fixtureLog(page)).writes.length;
  const klick = async (panel) => {
    if (await page.locator('#patientDetailModal .modal-close').isVisible()) await page.locator('#patientDetailModal .modal-close').click();
    await ruhe(page, 300);
    await akteOeffnen(page);
    await page.locator(`#${panel} .px-akte-aktionen button`).evaluate(b => b.click()); await ruhe(page, 1200);
  };
  // Anamnese
  await klick('pdPanelAnamnese');
  assert.equal(await page.locator('#patientDetailModal:not([hidden])').count(), 0, 'Anamnese: Akte geschlossen');
  erg.anamnese = await page.evaluate(() => ({ panel: document.querySelector('.panel.active')?.id, sichtbarerDialog: [...document.querySelectorAll('.modal-overlay,.modal')].filter(m => !m.hidden && getComputedStyle(m).display !== 'none' && m.offsetParent !== null).map(m => m.id).filter(Boolean) }));
  const blob = JSON.stringify(erg.anamnese) + await page.evaluate(() => document.body.innerText.slice(0, 20000));
  assert.ok(blob.includes(name.split(' ')[0]), `Anamnese: Patient ${name} vorgewählt/sichtbar`);
  // Notiz
  await klick('pdPanelNotes');
  assert.equal(await page.evaluate(() => document.getElementById('panel-notizen')?.classList.contains('active')), true, 'Notizen-Panel aktiv');
  await ruhe(page, 800);
  const notizId = await page.evaluate(() => document.getElementById('notesPatient')?.value || '');
  const notizText = await page.evaluate(() => document.getElementById('notesPatientInput')?.value || '');
  assert.equal(notizId, leadId, `Notizen: Vorwahl = Patient (${notizText})`);
  // Fußbefund
  await klick('pdPanelFussbefund');
  assert.equal(await page.locator('#patientDetailModal:not([hidden])').count(), 0, 'Fußbefund: Akte geschlossen');
  assert.equal(await page.evaluate(() => document.getElementById('panel-fussstatus')?.classList.contains('active')), true, 'Fußbefund-Panel aktiv');
  const fb = await page.evaluate(() => document.getElementById('panel-fussstatus').innerText + [...document.querySelectorAll('#panel-fussstatus input,#panel-fussstatus select')].map(e => e.value + (e.selectedOptions?.[0]?.text || '')).join(' '));
  erg.fussbefundPanel = fb.slice(0, 80).replace(/\s+/g, ' ');
  assert.equal(await page.evaluate(() => document.getElementById('fbpPatient')?.value || ''), leadId, `Fußbefund: Vorwahl = Patient ${name}`);
  const schreibNach = (await fixtureLog(page)).writes.length;
  assert.equal(schreibNach, schreibVor, `0 Schreibzugriffe durch Öffnen (${schreibVor} → ${schreibNach})`);
  assert.deepEqual(n.protokoll.seitenfehler, [], 'neu: keine Seitenfehler');
  await n.kontext.close();

  // Mitarbeiterin ohne Recht anamnese: kein Anamnese-/Fußbefund-/Notiz-Knopf
  const m = await oeffne('neu', { rolle: 'employee', fixtureAnpassen: ohneAnamnese });
  await akteOeffnen(m.page);
  assert.equal(await m.page.locator('#patientDetailModal .px-akte-aktionen').count(), 0, 'Mitarbeiterin ohne anamnese: keine Aktionen');
  assert.deepEqual(m.protokoll.seitenfehler, [], 'employee ohne Recht: keine Seitenfehler'); await m.kontext.close();
  // Mitarbeiterin mit Recht: Anamnese + Fußbefund, kein Notiz-Knopf
  const e = await oeffne('neu', { rolle: 'employee' });
  await akteOeffnen(e.page);
  assert.equal(await knopf(e.page, 'pdPanelNotes').count(), 0, 'Mitarbeiterin: kein Notiz-Knopf');
  assert.equal(await knopf(e.page, 'pdPanelAnamnese').count(), 1, 'Mitarbeiterin: Anamnese-Knopf');
  assert.equal(await knopf(e.page, 'pdPanelFussbefund').count(), 1, 'Mitarbeiterin: Fußbefund-Knopf');
  // Wechsel auf Alt bei offener Akte: Knöpfe verschwinden sofort (Lead-Nachtrag)
  await e.page.evaluate(() => document.documentElement.removeAttribute('data-design')); await ruhe(e.page, 200);
  assert.equal(await e.page.locator('.px-akte-aktionen').count(), 0, 'neu→alt bei offener Akte: keine Zeilen mehr');
  assert.deepEqual(e.protokoll.seitenfehler, [], 'employee: keine Seitenfehler'); await e.kontext.close();
  // alt
  const a = await oeffne('alt'); await akteOeffnen(a.page);
  assert.equal(await a.page.locator('.px-akte-aktionen').count(), 0, 'alt: keine Zeilen');
  assert.deepEqual(a.protokoll.seitenfehler, [], 'alt: keine Seitenfehler'); await a.kontext.close();
  // 390 px
  const h = await oeffne('neu', { breite: 390 }); await akteOeffnen(h.page);
  assert.equal(await h.page.locator('.px-akte-aktionen button').count(), 3, '390: 3 Knöpfe');
  const ueber = await h.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(ueber <= 0, `390 px ohne Überlauf (${ueber})`);
  assert.deepEqual(h.protokoll.seitenfehler, [], 'mobil: keine Seitenfehler'); await h.kontext.close();
  console.log(JSON.stringify({ ok: true, ...erg }));
} catch (err) {
  console.log(JSON.stringify({ ok: false, fehler: err.message, ...erg }));
  process.exitCode = 1;
} finally { await browser.close(); await server.close?.(); }
process.exit(process.exitCode ?? 0);
