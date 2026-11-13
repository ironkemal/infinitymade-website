/** V2.12b: Patientensuche unter 900 px über die Lupe in der Kopfleiste (nur Neu-Design).
 *  Synthetische App ohne Login (redesign-harness), nur lesend. Hart: process.exit(1) bei Abweichung. Eine JSON-Zeile. */
import assert from 'node:assert/strict';
import { oeffneDashboard, starteBrowser, starteServer, ruhe } from '../redesign-harness.mjs';
const server = await starteServer(); const browser = await starteBrowser();
const sicht = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect();
  return { da: !!e.getClientRects().length && getComputedStyle(e).display !== 'none', x: r.x, y: r.y, w: r.width, h: r.height, rechts: r.right, inert: !!e.closest('[inert]') }; }, sel);
const lauf = async (opt, fn) => {
  const { page, kontext, protokoll } = await oeffneDashboard(browser, { basis: server.basis, theme: 'hell', szenario: 'voll', breite: 390, design: 'neu', rolle: 'owner', ...opt });
  await ruhe(page, 800);
  try {
    const erg = await fn(page);
    const writes = await page.evaluate(() => (window.__rsFixture?.writes || []).length);
    return { ...erg, writes, fehler: protokoll.seitenfehler };
  } finally { await kontext.close(); }
};
const erg = {};
try {
  // a) 390 Inhaberin: Lupe da, Feld zu; Klick öffnet, Fokus im Feld; Treffer; Escape schließt mit Fokus zurück; „/“ öffnet.
  const handy = await lauf({}, async page => {
    const vorher = { knopf: await sicht(page, '.px-suche-knopf'), feld: await sicht(page, '.px-suche'), expanded: await page.getAttribute('.px-suche-knopf', 'aria-expanded') };
    const leadsVor = await page.evaluate(() => (window.__rsFixture?.reads || []).filter(t => t === 'leads').length);
    await page.click('.px-suche-knopf'); await ruhe(page, 200);
    const offen = { feld: await sicht(page, '.px-suche'), fokus: await page.evaluate(() => document.activeElement?.id), expanded: await page.getAttribute('.px-suche-knopf', 'aria-expanded'),
      ueberlauf: await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) };
    await page.keyboard.type('a'); await ruhe(page, 500);
    const treffer = await page.evaluate(() => { const l = document.querySelector('.px-suche .patient-search-list'); const li = l ? [...l.querySelectorAll('li')] : [];
      const r = l?.getBoundingClientRect(); return { n: li.length, da: !!l && !!l.getClientRects().length && getComputedStyle(l).display !== 'none', rechts: r?.right ?? 0, links: r?.left ?? 0, hoehe: li[0]?.getBoundingClientRect().height ?? 0 }; });
    await page.keyboard.press('Escape'); await ruhe(page, 200);
    const zu = { feld: await sicht(page, '.px-suche'), fokus: await page.evaluate(() => document.activeElement?.className), expanded: await page.getAttribute('.px-suche-knopf', 'aria-expanded') };
    await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('/'); await ruhe(page, 200);
    const slash = { feld: await sicht(page, '.px-suche'), fokus: await page.evaluate(() => document.activeElement?.id) };
    // Auswahl schließt die Zeile (Reads vorher zählen: die Akte danach lädt selbst)
    await page.keyboard.type('a'); await ruhe(page, 500);
    const leadsNach = await page.evaluate(() => (window.__rsFixture?.reads || []).filter(t => t === 'leads').length);
    await page.click('.px-suche .patient-search-list li[data-idx], .px-suche .patient-search-list li >> nth=0').catch(() => {}); await ruhe(page, 400);
    const auswahl = { feld: await sicht(page, '.px-suche'), expanded: await page.getAttribute('.px-suche-knopf', 'aria-expanded') };
    return { vorher, offen, treffer, zu, slash, auswahl, leadsExtra: leadsNach - leadsVor, dialoge: await page.evaluate(() => document.querySelectorAll('.modal-overlay.active, .modal-overlay[style*="flex"]').length) };
  });
  assert.equal(handy.vorher.knopf?.da, true, 'a) Lupe sichtbar'); assert.ok(handy.vorher.knopf.w >= 44 && handy.vorher.knopf.h >= 44, 'a) Lupe ≥ 44 px');
  assert.equal(handy.vorher.feld?.da, false, 'a) Feld zu'); assert.equal(handy.vorher.expanded, 'false', 'a) aria-expanded false');
  assert.equal(handy.offen.feld.da, true, 'a) Feld offen'); assert.equal(handy.offen.fokus, 'pxSuche', 'a) Fokus im Feld'); assert.equal(handy.offen.expanded, 'true', 'a) aria-expanded true');
  assert.ok(handy.offen.feld.x >= 0 && handy.offen.feld.rechts <= 390.5 && handy.offen.feld.h >= 44, 'a) Zeile im Viewport, ≥ 44 hoch'); assert.ok(handy.offen.ueberlauf <= 0, 'a) kein Überlauf');
  assert.ok(handy.treffer.da && handy.treffer.n > 0, 'a) Treffer da'); assert.ok(handy.treffer.links >= 0 && handy.treffer.rechts <= 390.5, 'a) Trefferliste im Viewport'); assert.ok(handy.treffer.hoehe >= 44, 'a) Treffer ≥ 44 hoch');
  assert.equal(handy.zu.feld.da, false, 'a) Escape schließt'); assert.match(handy.zu.fokus || '', /px-suche-knopf/, 'a) Fokus zurück auf Lupe'); assert.equal(handy.zu.expanded, 'false', 'a) aria-expanded zurück');
  assert.equal(handy.slash.feld.da, true, 'a) „/“ öffnet'); assert.equal(handy.slash.fokus, 'pxSuche', 'a) „/“ fokussiert');
  assert.equal(handy.auswahl.feld.da, false, 'a) Auswahl schließt'); assert.equal(handy.auswahl.expanded, 'false', 'a) Auswahl: aria-expanded false');
  assert.ok(handy.leadsExtra <= 1, `a) höchstens der vorhandene Cache-Lader (${handy.leadsExtra} leads-Reads)`);
  // b) 768: Lupe; 900/1440: Feld in der Kopfleiste, Lupe aus
  const tablet = await lauf({ breite: 768 }, async page => ({ knopf: await sicht(page, '.px-suche-knopf'), feld: await sicht(page, '.px-suche'), ueberlauf: await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) }));
  assert.equal(tablet.knopf?.da, true, 'b) 768 Lupe'); assert.equal(tablet.feld?.da, false, 'b) 768 Feld zu'); assert.ok(tablet.ueberlauf <= 0, 'b) 768 kein Überlauf');
  // mobil-ui 13.11.: 769–899 px gewann die Tablet-Breite (clamp 180–260) über left/right, Zeile war 198 px schmal.
  const schmalTablet = await lauf({ breite: 899 }, async page => { await page.click('.px-suche-knopf'); await ruhe(page, 200); return { feld: await sicht(page, '.px-suche') }; });
  assert.ok(schmalTablet.feld.da && schmalTablet.feld.w >= 899 - 16 - 1, `b) 899 offene Zeile volle Breite (${Math.round(schmalTablet.feld.w)} px)`);
  for (const breite of [900, 1440]) {
    const gross = await lauf({ breite }, async page => ({ knopf: await sicht(page, '.px-suche-knopf'), feld: await sicht(page, '.px-suche') }));
    assert.equal(gross.knopf?.da, false, `b) ${breite} Lupe aus`); assert.equal(gross.feld?.da, true, `b) ${breite} Feld in der Kopfleiste`);
  }
  // c) Alt-Design: weder Lupe noch Feld
  const alt = await lauf({ design: 'alt' }, async page => ({ knopf: await sicht(page, '.px-suche-knopf'), feld: await sicht(page, '.px-suche') }));
  assert.ok(!alt.knopf?.da && !alt.feld?.da, 'c) Alt ohne Lupe und Feld');
  // d) Mitarbeiterin 390: Lupe nur, wenn „Patienten“ in der Leiste steht (gleiche Regel wie das Feld)
  const ma = await lauf({ rolle: 'employee' }, async page => ({ knopf: await sicht(page, '.px-suche-knopf'),
    kunden: await page.evaluate(() => !!document.querySelector('#sidebarNav .sidebar-item[data-panel="kunden"]:not([hidden])')) }));
  assert.equal(ma.knopf?.da ?? false, ma.kunden, 'd) Lupe folgt dem Patienten-Recht');
  // e) Offene Schublade sperrt die Lupe (inert)
  const schublade = await lauf({}, async page => { await page.click('#hamburger'); await ruhe(page, 400); return { knopf: await sicht(page, '.px-suche-knopf'), inertSelbst: await page.evaluate(() => document.querySelector('.px-suche-knopf')?.inert) }; });
  assert.ok(schublade.knopf.inert || schublade.inertSelbst, 'e) Lupe hinter offener Schublade inert');
  for (const [n, l] of Object.entries({ handy, tablet, alt, ma, schublade })) { assert.deepEqual(l.fehler, [], `f) ${n}: 0 Seitenfehler`); assert.equal(l.writes, 0, `f) ${n}: 0 Schreibversuche`); }
  erg.ok = true; erg.treffer = handy.treffer.n; erg.leadsExtra = handy.leadsExtra; erg.maKunden = ma.kunden;
  console.log(JSON.stringify(erg));
} catch (e) { console.error(JSON.stringify({ ok: false, fehler: String(e.message).slice(0, 400) })); process.exitCode = 1; }
finally { await browser.close(); await server.stop(); }
