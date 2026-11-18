/** V7.01p (Melih 15.11.2026): Notizen-Panel folgt Recht 'notes'; Anamnese-Liste nach Standort (bizScope).
 *  Synthetische App ohne Login (redesign-harness). Hart: Exit 1 bei Abweichung. Eine JSON-Zeile. */
import assert from 'node:assert/strict';
import { oeffneDashboard, starteBrowser, starteServer, ruhe } from '../redesign-harness.mjs';
process.env.REDESIGN_PORT ||= '18701';
const server = await starteServer(); const browser = await starteBrowser();
const oeffne = (design, extra = {}) => oeffneDashboard(browser, { basis: server.basis, theme: 'hell', szenario: 'voll', breite: 1440, design, ...extra });
const ohneNotes = (f) => f.replace("module !== 'abrechnung'", "module !== 'abrechnung' && module !== 'notes'");
const erg = {};
try {
  for (const design of ['alt', 'neu']) {
    // Mitarbeiterin ohne Recht notes: kein Menüeintrag, Panelwechsel verweigert
    const m = await oeffne(design, { rolle: 'employee', fixtureAnpassen: ohneNotes });
    await m.page.evaluate(() => window.switchPanel('notizen')); await ruhe(m.page, 600);
    const aktivOhne = await m.page.evaluate(() => document.getElementById('panel-notizen')?.classList.contains('active'));
    const menueOhne = await m.page.locator('#sidebarNav [data-panel="notizen"], #sidebarNav [data-id="notizen"]').count();
    assert.equal(aktivOhne, false, `${design}: ohne notes kein Notizen-Panel`);
    assert.deepEqual(m.protokoll.seitenfehler, [], `${design}: keine Seitenfehler (ohne notes)`);
    await m.kontext.close();
    // Mitarbeiterin mit Recht: Panel erreichbar
    const e = await oeffne(design, { rolle: 'employee' });
    await e.page.evaluate(() => window.switchPanel('notizen')); await ruhe(e.page, 600);
    const aktivMit = await e.page.evaluate(() => document.getElementById('panel-notizen')?.classList.contains('active'));
    assert.equal(aktivMit, true, `${design}: mit notes Notizen-Panel erreichbar`);
    await e.kontext.close();
    // V9.01 (S-68): ohne Recht customers ist auch das Patienten-Panel „kunden“ gesperrt
    const k = await oeffne(design, { rolle: 'employee', fixtureAnpassen: (f) => f.replace("module !== 'abrechnung'", "module !== 'abrechnung' && module !== 'customers'") });
    await k.page.evaluate(() => window.switchPanel('kunden')); await ruhe(k.page, 600);
    const kundenOhne = await k.page.evaluate(() => document.getElementById('panel-kunden')?.classList.contains('active'));
    assert.equal(kundenOhne, false, `${design}: ohne customers kein Patienten-Panel`);
    await k.kontext.close();
    erg[`${design}KundenOhneRecht`] = kundenOhne;
    // Inhaberin: Anamnese-Liste lädt, Patienten vorhanden
    const o = await oeffne(design, { rolle: 'owner' });
    await o.page.evaluate(() => window.switchPanel('anamnese')); await ruhe(o.page, 900);
    const optionen = await o.page.locator('#anamPatientSelect option').count();
    assert.ok(optionen > 1, `${design}: Anamnese-Liste hat Patienten (${optionen})`);
    // fremde Vorwahl wird nicht übernommen
    await o.page.evaluate(() => window.switchPanel('kunden')); await ruhe(o.page, 300);
    assert.deepEqual(o.protokoll.seitenfehler, [], `${design}: keine Seitenfehler (Inhaberin)`);
    // V9.12: Telefon unter dem Nachnamen nur im neuen Design sichtbar
    const tel = await o.page.evaluate(() => [...document.querySelectorAll('#leadTableBody .pat-tel')].filter(e => e.offsetHeight > 0).length);
    if (design === 'neu') assert.ok(tel > 0, 'V9.12 neu: Telefon sichtbar'); else assert.equal(tel, 0, 'V9.12 alt: Telefon unsichtbar');
    erg[`${design}Telefon`] = tel;
    await o.kontext.close();
    erg[design] = { ohneNotesPanel: aktivOhne, ohneNotesMenue: menueOhne, mitNotesPanel: aktivMit, anamneseOptionen: optionen };
  }
  console.log(JSON.stringify({ ok: true, ...erg }));
} catch (err) {
  console.log(JSON.stringify({ ok: false, fehler: err.message, ...erg }));
  process.exitCode = 1;
} finally { await browser.close(); await server.close?.(); }
process.exit(process.exitCode ?? 0);
