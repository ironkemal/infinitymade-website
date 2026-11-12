/** V2.05: Gruppenzuordnung der Seitenleiste nur im Neu-Design (module/leiste-zuordnung.js, shell-ansicht.js).
 *  Synthetische App ohne Login (redesign-harness), nur lesend. Hart: process.exit(1) bei Abweichung. Eine JSON-Zeile. */
import assert from 'node:assert/strict';
import { oeffneDashboard, starteBrowser, starteServer, wechsle, ruhe } from '../redesign-harness.mjs';
const server = await starteServer(); const browser = await starteBrowser();
const struktur = (page) => page.evaluate(() => {
  const nav = document.getElementById('sidebarNav');
  const comments = []; const w = document.createTreeWalker(nav, NodeFilter.SHOW_COMMENT); while (w.nextNode()) comments.push(w.currentNode.data);
  return { gruppen: [...nav.querySelectorAll('.nav-group')].map(g => ({ id: g.dataset.groupId, hidden: g.hidden || g.hasAttribute('hidden'),
    open: g.classList.contains('open'), aktivKopf: !!g.querySelector('.nav-group-header.has-active'),
    panels: [...g.querySelectorAll('.sidebar-item[data-panel]')].map(b => b.dataset.panel) })), comments: comments.filter(c => c === 'px-zuordnung').length };
});
const ids = (s) => s.gruppen.flatMap(g => g.panels).sort();
const gruppeVon = (s, p) => s.gruppen.find(g => g.panels.includes(p))?.id;
const hinter = (s, g, p) => { const l = s.gruppen.find(x => x.id === g).panels; return l[l.indexOf(p) - 1]; };
const nurGruppen = (s) => s.gruppen.map(g => ({ id: g.id, hidden: g.hidden, panels: g.panels }));
async function lauf(sektor, design, rolle, fn) {
  if (sektor) process.env.REDESIGN_SEKTOR = sektor; else delete process.env.REDESIGN_SEKTOR;
  const { page, kontext, protokoll } = await oeffneDashboard(browser, { basis: server.basis, design, breite: 1440, theme: 'hell', rolle, szenario: 'voll' });
  const s = await struktur(page);
  const extra = fn ? await fn(page, s) : null;
  const schreib = await page.evaluate(() => (window.__rsFixture?.writes || []).map(w => JSON.stringify(w)));
  await kontext.close();
  return { s, extra, fehler: protokoll.seitenfehler, schreib };
}
const erg = {}; let ok = false;
try {
  for (const [name, sektor] of [['podologie', 'podologie'], ['physio', 'physiotherapy']]) {
    // Alt-Referenz: frischer Alt-Start; Schreibversuche beim Öffnen von Panels sind Fixture-Eigenheit (services legt synthetisch an) und müssen im Neu-Design gleich sein.
    const ziel0 = name === 'podologie' ? 'services' : 'fahrtenbuch';
    const alt = await lauf(sektor, 'alt', 'owner', async (page) => { await wechsle(page, ziel0); });
    assert.equal(alt.s.comments, 0, name + ' alt: keine Platzhalter');
    assert.ok(alt.s.gruppen.every(g => !g.hidden), name + ' alt: keine versteckten Gruppen');
    let abschalt = null;
    const neu = await lauf(sektor, 'neu', 'owner', async (page, s) => {
      // f) Stabilität 1 s
      const mutationen = await page.evaluate(() => new Promise(r => { let n = 0; const o = new MutationObserver(m => { n += m.length; });
        o.observe(document.getElementById('sidebarNav'), { childList: true, subtree: true, attributes: true }); setTimeout(() => { o.disconnect(); r(n); }, 1000); }));
      // d) Klick auf verschobenen Eintrag
      const ziel = name === 'podologie' ? 'services' : 'fahrtenbuch';
      const quelle = gruppeVon(s, ziel);
      await page.evaluate((p) => document.querySelector(`#sidebarNav .sidebar-item[data-panel="${p}"]`)?.click(), ziel);
      await ruhe(page, 700);
      const nachKlick = await struktur(page);
      const aktivPanel = await page.evaluate(() => document.querySelector('.panel.active')?.id);
      // c) Abschalten: Neu → Alt im selben Dokument
      await page.evaluate(() => { document.documentElement.dataset.design = 'alt'; });
      await ruhe(page, 500);
      abschalt = await struktur(page);
      return { mutationen, nachKlick, aktivPanel, ziel, quelle };
    });
    const { s } = neu;
    assert.deepEqual(ids(s), ids(alt.s), name + ': gleiche Panel-ID-Menge wie alt');
    assert.equal(neu.extra.mutationen, 0, name + ': Leiste stabil (0 Mutationen in 1 s)');
    if (name === 'podologie') {
      assert.equal(gruppeVon(s, 'podologie-billing'), 'uebersicht'); assert.equal(hinter(s, 'uebersicht', 'podologie-billing'), 'overview');
      assert.equal(gruppeVon(s, 'services'), 'team'); assert.equal(gruppeVon(s, 'b2c'), 'team');
    } else {
      assert.equal(gruppeVon(s, 'verordnungen'), 'patienten'); assert.equal(hinter(s, 'patienten', 'verordnungen'), 'kunden');
      for (const p of ['fahrtenbuch', 'b2b', 'b2c', 'doctors']) if (ids(s).includes(p)) assert.equal(gruppeVon(s, p), 'team', p + ' in team');
    }
    const e = neu.extra, k = e.nachKlick;
    assert.equal(e.aktivPanel, 'panel-' + e.ziel, name + ': Panel aktiv');
    const zg = k.gruppen.find(g => g.id === 'team');
    assert.ok(zg.open && zg.aktivKopf, name + ': Zielgruppe offen + has-active');
    if (e.quelle !== 'team') assert.equal(k.gruppen.find(g => g.id === e.quelle)?.aktivKopf ?? false, false, name + ': Quellkopf nicht aktiv');
    // c) Abschalten == frischer Alt-Start
    assert.deepEqual(nurGruppen(abschalt), nurGruppen(alt.s), name + ': Abschalten stellt Registry-Ausgabe wieder her');
    assert.equal(abschalt.comments, 0, name + ': keine Platzhalter nach Abschalten');
    assert.deepEqual(neu.fehler, [], name + ' neu: Seitenfehler'); assert.deepEqual(alt.fehler, [], name + ' alt: Seitenfehler');
    assert.deepEqual(neu.schreib, alt.schreib, name + ': Schreibversuche wie im Alt-Design (Fixture-Insert beim Panelöffnen, keine echte DB)');
    erg[name] = { altGruppen: nurGruppen(alt.s).map(g => g.id + ':' + g.panels.length).join(','), neuGruppen: s.gruppen.map(g => g.id + ':' + g.panels.length + (g.hidden ? '(h)' : '')).join(','), panelIds: ids(s).length, mutationen: e.mutationen, schreib: neu.schreib.length };
  }
  // e) Mitarbeiterin
  for (const [name, sektor] of [['podologie', 'podologie'], ['physio', 'physiotherapy']]) {
    const alt = await lauf(sektor, 'alt', 'employee'); const neu = await lauf(sektor, 'neu', 'employee');
    assert.deepEqual(ids(neu.s), ids(alt.s), 'employee/' + name + ': gleiche Panel-ID-Menge');
    assert.deepEqual(neu.fehler, []); assert.deepEqual(neu.schreib, []);
    erg['employee-' + name] = { panelIds: ids(neu.s).length };
  }
  ok = true; console.log(JSON.stringify({ ok, ...erg }));
} catch (e) { console.log(JSON.stringify({ ok: false, fehler: String(e.message).slice(0, 600), erg })); }
finally { await browser.close(); await server.stop(); }
process.exit(ok ? 0 : 1);
