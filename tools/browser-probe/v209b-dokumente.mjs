/** V2.09b: Inhaber-Dokumentsuche (Verordnung/Rechnung) in der Kopfleiste, nur Neu-Design.
 *  Synthetische App ohne Login (redesign-harness), nur lesend. Hart: process.exitCode 1 bei Abweichung. Eine JSON-Zeile.
 *  Die gemeinsame Fixture erzeugt IDs mit 7-stelligem Kopf (keine UUID); die Suche verwirft solche Zeilen absichtlich.
 *  Diese Probe korrigiert das nur für sich (`fixtureAnpassen`), der Lauf ohne Korrektur prüft den Fehlerzustand. */
import assert from 'node:assert/strict';
import { oeffneDashboard, starteBrowser, starteServer, ruhe } from '../redesign-harness.mjs';
const server = await starteServer(); const browser = await starteBrowser();
const UUIDS = t => t.replace('`${gruppe}000000-0000-4000-8000-', '`${gruppe}0000000-0000-4000-8000-');
// Beträge der Fixture: 42 · 84 · 28,4 · 126 (in jeder Schreibweise), dazu €-Zeichen und deutsches Komma-Format.
const BETRAG = /€|\d,\d{2}\b|\b28[.,]4\b|(?<![\d.-])(42|84|126)(?:[.,]0+)?(?![\d.-])/;
const lies = page => page.evaluate(() => { const z = {}; for (const t of (window.__rsFixture?.reads || [])) z[t] = (z[t] || 0) + 1; return z; });
const plus = (a, b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v - (a[k] || 0)]).filter(([, v]) => v));
const lauf = async (opt, fn) => {
  const { page, kontext, protokoll } = await oeffneDashboard(browser, { basis: server.basis, theme: 'hell', szenario: 'voll', breite: 1440, design: 'neu', rolle: 'owner', fixtureAnpassen: UUIDS, ...opt });
  await ruhe(page, 800);
  try { const erg = await fn(page); return { ...erg, writes: await page.evaluate(() => (window.__rsFixture?.writes || []).length), fehler: protokoll.seitenfehler }; }
  finally { await kontext.close(); }
};
const suchen = async (page, art, text) => {
  await page.selectOption('.px-suche-art', art); await page.click('#pxSuche'); await ruhe(page, 600);
  await page.fill('#pxSuche', text); await ruhe(page, 500);
  return page.evaluate(() => ({ hinweis: document.querySelector('.px-suche-hinweis')?.textContent || '',
    treffer: [...document.querySelectorAll('.px-suche .patient-search-list li[data-id]')].map(l => ({ text: l.textContent, id: l.dataset.id, attr: [...l.attributes].map(a => a.value).join(' ') })) }));
};
const erg = {};
try {
  // a) Inhaberin 1440: Auswahl, Rechnung suchen und öffnen
  const rg = await lauf({}, async page => {
    const arten = await page.evaluate(() => [...document.querySelectorAll('.px-suche-art option')].map(o => o.value));
    const r0 = await lies(page); const s = await suchen(page, 'rechnung', 'RE-2026'); const r1 = await lies(page);
    await page.keyboard.press('ArrowDown'); await ruhe(page, 500);
    const a11y = await page.evaluate(() => { const f = document.getElementById('pxSuche'), l = document.querySelector('.px-suche .patient-search-list');
      return { rolle: f.getAttribute('role'), expanded: f.getAttribute('aria-expanded'), controls: f.getAttribute('aria-controls') === l?.id, liste: l?.getAttribute('role'),
        optionen: l ? [...l.querySelectorAll('li[data-id]')].every(li => li.getAttribute('role') === 'option') : false,
        aktiv: !!f.getAttribute('aria-activedescendant') && document.getElementById(f.getAttribute('aria-activedescendant'))?.classList.contains('active'),
        ansage: document.querySelector('.px-suche-ansage')?.textContent || '', ansageSichtbar: (() => { const r = document.querySelector('.px-suche-ansage')?.getBoundingClientRect(); return r ? r.width > 1 || r.height > 1 : null; })() }; });
    await page.click('.px-suche .patient-search-list li[data-id] >> nth=0'); await ruhe(page, 800);
    return { arten, s, a11y, reads: plus(r0, r1), panel: await page.evaluate(() => ({ aktiv: document.getElementById('panel-rechnungen')?.classList.contains('active'), ansicht: document.getElementById('invView')?.hidden === false })) };
  });
  assert.deepEqual(rg.arten, ['patient', 'verordnung', 'rechnung'], 'a) drei Suchbereiche');
  assert.ok(rg.s.treffer.length >= 1, 'a) Rechnungstreffer'); assert.ok(rg.s.treffer.every(t => t.id.startsWith('rechnung:')), 'a) typisierte IDs');
  assert.ok(rg.s.treffer.every(t => !BETRAG.test(t.text) && !BETRAG.test(t.attr)), 'a) kein Betrag im Treffer, auch nicht in Attributen');
  assert.equal(rg.reads.invoices, 1, `a) genau ein Rechnungs-Read (${JSON.stringify(rg.reads)})`);
  assert.deepEqual(rg.panel, { aktiv: true, ansicht: true }, 'a) Rechnung im vorhandenen Panel geöffnet');
  // A11y (web-barrierefreiheit 13.11.): Combobox-Muster, aktive Zeile, Trefferzahl-Ansage unsichtbar
  assert.deepEqual({ rolle: rg.a11y.rolle, expanded: rg.a11y.expanded, controls: rg.a11y.controls, liste: rg.a11y.liste, optionen: rg.a11y.optionen, aktiv: rg.a11y.aktiv },
    { rolle: 'combobox', expanded: 'true', controls: true, liste: 'listbox', optionen: true, aktiv: true }, 'a) ARIA-Combobox');
  assert.match(rg.a11y.ansage, /^\d+ Treffer$/, `a) Trefferzahl angesagt (${rg.a11y.ansage})`); assert.equal(rg.a11y.ansageSichtbar, false, 'a) Ansage nur für Screenreader');
  // b) Verordnung suchen und öffnen
  const vo = await lauf({}, async page => {
    const s = await suchen(page, 'verordnung', 'a');
    await page.click('.px-suche .patient-search-list li[data-id] >> nth=0'); await ruhe(page, 900);
    return { s, panel: await page.evaluate(() => ({ aktiv: document.getElementById('panel-verordnungen')?.classList.contains('active'),
      detail: (document.getElementById('vordDetailContent')?.textContent || '').trim().length > 20 })) };
  });
  assert.ok(vo.s.treffer.length >= 1, `b) Verordnungstreffer (Hinweis: ${vo.s.hinweis})`); assert.ok(vo.s.treffer.every(t => t.id.startsWith('verordnung:')), 'b) typisierte IDs');
  assert.ok(vo.s.treffer.every(t => !BETRAG.test(t.text)), 'b) kein Betrag');
  assert.deepEqual(vo.panel, { aktiv: true, detail: true }, 'b) Verordnung im vorhandenen Panel geöffnet');
  // c) Mitarbeiterin: keine Auswahl im DOM, Tippen löst keinen Rechnungs-/Verordnungs-Read aus
  const ma = await lauf({ rolle: 'employee' }, async page => {
    const r0 = await lies(page); await page.click('#pxSuche'); await page.fill('#pxSuche', 'a'); await ruhe(page, 600); const r1 = await lies(page);
    return { art: await page.locator('.px-suche-art').count(), reads: plus(r0, r1) };
  });
  // Die Patientensuche liest schon vor V2.09b je 1× leads + prescriptions (ensureLeadsCache, Abrechnungsstand als Beiwerk;
  // gemessen vor/nach 13.11.). Keine Dokumentquelle darf dazukommen: keine Rechnungen, nichts aus dem VO-Lader.
  assert.equal(ma.art, 0, 'c) Mitarbeiterin ohne Suchbereich im DOM');
  assert.ok(!ma.reads.invoices && !ma.reads.podologie_behandlungen && !ma.reads.diagnosegruppen && (ma.reads.prescriptions || 0) <= 1, `c) keine Dokument-Reads (${JSON.stringify(ma.reads)})`);
  // d) Alt-Design: keine Auswahl sichtbar
  const alt = await lauf({ design: 'alt' }, async page => ({ art: await page.evaluate(() => { const e = document.querySelector('.px-suche-art'); return !!e && !!e.getClientRects().length; }) }));
  assert.equal(alt.art, false, 'd) Alt ohne Suchbereich');
  // e) 390: Auswahl in der aufgeklappten Zeile, kein Überlauf
  const handy = await lauf({ breite: 390 }, async page => {
    await page.click('.px-suche-knopf'); await ruhe(page, 200);
    return page.evaluate(() => { const w = document.querySelector('.px-suche').getBoundingClientRect(), a = document.querySelector('.px-suche-art')?.getBoundingClientRect();
      return { a: a ? [a.left, a.right, a.height] : null, w: [w.left, w.right], ueberlauf: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
  });
  assert.ok(handy.a && handy.a[0] >= handy.w[0] && handy.a[1] <= handy.w[1] && handy.a[2] >= 44, 'e) Suchbereich in der Zeile, ≥ 44 hoch'); assert.ok(handy.ueberlauf <= 0, 'e) kein Überlauf');
  // f) Fehlerpfade: Fixture ohne gültige UUIDs bzw. Szenario „fehler“ → Hinweis, kein Treffer aus altem Bestand
  const kaputt = await lauf({ fixtureAnpassen: undefined }, async page => suchen(page, 'rechnung', 'RE'));
  assert.match(kaputt.hinweis, /nicht geladen/, 'f) Fehlerhinweis'); assert.equal(kaputt.treffer.length, 0, 'f) keine Treffer bei Fehler');
  const fehl = await lauf({ szenario: 'fehler' }, async page => suchen(page, 'rechnung', 'RE'));
  assert.equal(fehl.treffer.length, 0, 'f) Szenario fehler: keine Treffer'); assert.match(fehl.hinweis, /nicht/, 'f) Szenario fehler: Hinweis');
  // guvenlik 13.11.: auch Verordnungen melden Fehler als „nicht verfügbar“, nie „0 Treffer“ ohne Hinweis
  const voFehl = await lauf({ szenario: 'fehler' }, async page => suchen(page, 'verordnung', 'a'));
  assert.equal(voFehl.treffer.length, 0, 'f) VO-Fehler: keine Treffer'); assert.match(voFehl.hinweis, /nicht/, `f) VO-Fehler: Hinweis (${voFehl.hinweis})`);
  for (const [n, l] of Object.entries({ rg, vo, ma, alt, handy, kaputt, fehl, voFehl })) { assert.deepEqual(l.fehler, [], `g) ${n}: 0 Seitenfehler`); assert.equal(l.writes, 0, `g) ${n}: 0 Schreibversuche`); }
  erg.ok = true; erg.rechnungen = rg.s.treffer.length; erg.verordnungen = vo.s.treffer.length; erg.maReads = ma.reads; erg.fehlerHinweis = kaputt.hinweis;
  console.log(JSON.stringify(erg));
} catch (e) { console.error(JSON.stringify({ ok: false, fehler: String(e.message).slice(0, 400) })); process.exitCode = 1; }
finally { await browser.close(); await server.stop(); }
