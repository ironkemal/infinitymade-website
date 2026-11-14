/** V6.B03: Abrechnungskarte der Startansicht (nur Inhaberin, nur Neu-Design) aus GET /api/billing/statistik.
 *  Synthetische App ohne Login (redesign-harness), nur lesend. Hart: process.exit(1) bei Abweichung. Eine JSON-Zeile. */
import assert from 'node:assert/strict';
import { oeffneDashboard, starteBrowser, starteServer, ruhe } from '../redesign-harness.mjs';
const server = await starteServer(); const browser = await starteBrowser();
const STAT = 'GET /api/billing/statistik';
const lauf = async (opt, fn) => {
  const { page, kontext, protokoll } = await oeffneDashboard(browser, { basis: server.basis, theme: 'hell', szenario: 'voll', breite: 1440, ...opt });
  await page.waitForFunction(() => !document.querySelector('.px-k-geld')?.textContent.includes('werden geladen'), null, { timeout: 15000 }).catch(() => {});
  await ruhe(page, 600);
  try {
    const stand = await page.evaluate(() => {
      const k = document.querySelector('.px-k-geld');
      const sichtbar = !!k && !document.getElementById('pxStartseite')?.hidden;
      return { karte: !!k, sichtbar, text: k?.textContent.replace(/\s+/g, ' ').trim() || '', erneut: !!k?.querySelector('[data-aktion="geld-neu"]'),
        ueberlauf: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        aussen: k ? (() => { const r = k.getBoundingClientRect(); return r.right > innerWidth + 0.5 || r.left < -0.5; })() : false };
    });
    const extra = fn ? await fn(page, protokoll) : null;
    return { stand, extra, stat: protokoll.api.filter(a => a === STAT).length, fehler: protokoll.seitenfehler };
  } finally { await kontext.close(); }
};
const erg = {};
try {
  const owner = await lauf({ design: 'neu', rolle: 'owner' }, async (page, protokoll) => {
    const vorher = protokoll.api.filter(a => a === STAT).length;
    // Designwechsel neu → alt → neu: beim Verlassen wird geleert (kein Geldstand im verdeckten DOM), beim Zurückkehren genau ein neuer Request.
    await page.evaluate(() => { document.documentElement.dataset.design = 'alt'; }); await ruhe(page, 300);
    await page.evaluate(() => { document.documentElement.dataset.design = 'neu'; }); await ruhe(page, 900);
    const nachWechsel = protokoll.api.filter(a => a === STAT).length;
    await page.click('.px-k-geld [data-ziel="statistik"]').catch(() => {}); await ruhe(page, 400);
    const panel = await page.evaluate(() => document.querySelector('.panel.active')?.id || '');
    return { vorher, nachWechsel, panel };
  });
  assert.equal(owner.stand.sichtbar, true, 'Inhaberin: Karte sichtbar');
  assert.match(owner.stand.text, /Alle Standorte/, 'Hinweis „Alle Standorte“ (guvenlik-Auflage 5)');
  assert.match(owner.stand.text, /Kassiert im Oktober/, 'Monat aus der Statistik');
  assert.match(owner.stand.text, /316,50 €/, 'kassiert');
  assert.match(owner.stand.text, /Zuzahlungen offen ?4 · 60,00 €/, 'Zuzahlungen offen');
  assert.match(owner.stand.text, /Ausfallrechnungen offen ?1 · 42,00 €/, 'Ausfall offen');
  assert.match(owner.stand.text, /Mahnungen offen ?2/, 'Mahnungen offen');
  assert.doesNotMatch(owner.stand.text, /Umsatz/, 'E10: kein „Umsatz“');
  assert.equal(owner.extra.vorher, 1, 'genau ein Request beim Laden');
  assert.equal(owner.extra.nachWechsel, 2, 'nach neu → alt → neu genau ein weiterer');
  assert.equal(owner.extra.panel, 'panel-statistik', 'Sprung „Statistik öffnen“');
  erg.owner = { vorher: owner.extra.vorher, nachWechsel: owner.extra.nachWechsel, panel: owner.extra.panel };

  const ma = await lauf({ design: 'neu', rolle: 'employee' });
  assert.equal(ma.stand.karte, false, 'Mitarbeiterin: Karte nicht im DOM');
  assert.equal(ma.stat, 0, 'Mitarbeiterin: kein Statistik-Request');
  erg.ma = { karte: ma.stand.karte, stat: ma.stat };

  const alt = await lauf({ design: 'alt', rolle: 'owner' });
  assert.equal(alt.stat, 0, 'Alt-Design: kein Statistik-Request');
  erg.alt = { stat: alt.stat };

  const fehl = await lauf({ design: 'neu', rolle: 'owner', szenario: 'fehler' });
  assert.match(fehl.stand.text, /gerade nicht verfügbar/, 'Fehler: „nicht verfügbar“');
  assert.doesNotMatch(fehl.stand.text, /0,00 €/, 'Fehler: nie 0 €');
  assert.equal(fehl.stand.erneut, true, 'Fehler: Erneut versuchen');
  erg.fehler = fehl.stand.text.slice(0, 80);

  const handy = await lauf({ design: 'neu', rolle: 'owner', breite: 390 });
  assert.equal(handy.stand.ueberlauf <= 0, true, '390: kein Überlauf');
  assert.equal(handy.stand.aussen, false, '390: Karte im Bild');
  erg.handy = { ueberlauf: handy.stand.ueberlauf };

  for (const r of [owner, ma, alt, fehl, handy]) assert.deepEqual(r.fehler, [], 'keine Seitenfehler');
  console.log(JSON.stringify({ ok: true, ...erg }));
} catch (e) {
  console.log(JSON.stringify({ ok: false, fehler: e.message, ...erg }));
  process.exitCode = 1;
} finally { await browser.close(); await server.close?.(); }
