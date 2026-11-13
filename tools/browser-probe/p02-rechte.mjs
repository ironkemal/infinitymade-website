/** P02 A21/A12: Das Design erteilt keine Rechte. Owner/Employee × Alt/Neu: gleiche Navigation, gleiche erreichbare Panels,
 *  gleiche gelesene Tabellen je Panel; nach Reload (Standortwechsel-Pfad) bleibt Neu mit genau einer Shell. Rein synthetisch. */
import assert from 'node:assert/strict';
import { PANELS, oeffneDashboard, starteBrowser, starteServer, wechsle, ruhe } from '../redesign-harness.mjs';
const server = await starteServer(); const browser = await starteBrowser();
const lesen = (page) => page.evaluate(() => (window.__rsFixture?.reads || []).slice());
async function profil(design, rolle) {
  const { page, kontext } = await oeffneDashboard(browser, { basis: server.basis, design, breite: 1440, theme: 'hell', rolle, szenario: 'voll' });
  const nav = await page.evaluate(() => [...document.querySelectorAll('#sidebarNav .sidebar-item')].map(b => b.dataset.panel).filter(Boolean).sort());
  const panels = {};
  for (const id of PANELS) {
    const vorher = (await lesen(page)).length;
    const aktiv = await wechsle(page, id);
    const neu = (await lesen(page)).slice(vorher);
    panels[id] = { aktiv, reads: [...new Set(neu)].sort() };
  }
  const schreib = await page.evaluate(() => (window.__rsFixture?.writes || []).map(w => (typeof w === 'string' ? w : JSON.stringify(w))).map(s => s.replace(/\d+/g, '#')).sort());
  let reload = null;
  if (design === 'neu') {
    await page.reload(); await page.waitForFunction(() => { const a = document.getElementById('app'); return a && a.style.display !== 'none'; }, null, { timeout: 30000 }); await ruhe(page);
    reload = await page.evaluate(() => ({ design: document.documentElement.dataset.design || null, marken: document.querySelectorAll('.px-leiste-marke').length }));
  }
  await kontext.close();
  return { nav, panels, schreib, reload };
}
const erg = {};
try {
  for (const rolle of ['owner', 'employee']) {
    const alt = await profil('alt', rolle), neu = await profil('neu', rolle);
    assert.deepEqual(neu.nav, alt.nav, rolle + ': Navigation identisch');
    for (const id of PANELS) {
      assert.equal(neu.panels[id].aktiv, alt.panels[id].aktiv, `${rolle}/${id}: Erreichbarkeit`);
      // Neu darf nie mehr lesen als Alt. Einzige erlaubte Lücke: der Aktivitätsfeed der Übersicht, den das neue
      // Design weder lädt noch zeigt (V6.F05, E8, guvenlik S-66; loadActivityFeed liest genau diese Tabellen).
      const FEED = new Set(['bookings', 'fahrten', 'invoices', 'leads', 'patient_notes']);
      const a = alt.panels[id].reads, n = neu.panels[id].reads;
      assert.deepEqual(n.filter(t => !a.includes(t)), [], `${rolle}/${id}: Neu liest keine Tabelle, die Alt nicht liest`);
      const fehlt = a.filter(t => !n.includes(t));
      if (id === 'overview') assert.ok(fehlt.every(t => FEED.has(t)), `${rolle}/${id}: nur Feed-Tabellen fehlen (${fehlt})`);
      else assert.deepEqual(fehlt, [], `${rolle}/${id}: gelesene Tabellen`);
    }
    assert.deepEqual(neu.schreib, alt.schreib, rolle + ': Schreibversuche identisch');
    assert.deepEqual(neu.reload, { design: 'neu', marken: 1 }, rolle + ': Reload hält Neu, eine Shell (design=neu per Vorschau)');
    erg[rolle] = { navItems: alt.nav.length, panelsErreichbar: PANELS.filter(id => alt.panels[id].aktiv).length, panelsGesamt: PANELS.length };
  }
  console.log(JSON.stringify(erg));
} finally { await browser.close(); await server.stop(); }
