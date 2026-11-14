/** V4.02p: Abschnittsnavigation (Einstellungen, Leistungen, Arbeitszeiten, Anamnese) mit exakter Wiederherstellung.
 *  Synthetische App ohne Login (redesign-harness). Hart: Exit 1 bei Abweichung. Eine JSON-Zeile. */
import assert from 'node:assert/strict';
import { oeffneDashboard, starteBrowser, starteServer, ruhe, wechsle } from '../redesign-harness.mjs';
process.env.REDESIGN_PORT ||= '18402';
const server = await starteServer(); const browser = await starteBrowser();
const PANELS = ['settings', 'services', 'hours', 'anamnese'];
const oeffne = (design, extra = {}) => oeffneDashboard(browser, { basis: server.basis, theme: 'hell', szenario: 'voll', breite: 1440, rolle: 'owner', design, ...extra });
const signatur = (page, id) => page.evaluate((pid) => {
  const sig = (el, tiefe) => [...el.childNodes].map(n => n.nodeType === 1 ? `${n.tagName}#${n.id}.${n.className}` + (tiefe ? `[${sig(n, tiefe - 1)}]` : '') : n.nodeType === 8 ? `<!--${n.data}-->` : '').filter(Boolean).join('|');
  const p = document.getElementById('panel-' + pid);
  return p.className.replace(/\bactive\b/g, '').trim() + '::' + sig(p, 0) + '::' + (p.querySelector('.settings-sections')?.querySelectorAll('[id]').length ?? '');
}, id);
const wechsel = async (page, d) => { await page.evaluate((x) => { document.documentElement.dataset.design = x; }, d); await ruhe(page, 500); };
const erg = {};
try {
  // alt von Anfang an
  const a = await oeffne('alt'); const altSig = {};
  for (const id of PANELS) {
    assert.ok(await wechsle(a.page, id), `${id} aktiv (alt)`);
    assert.equal(await a.page.locator(`#panel-${id} .px-abschnitte`).count(), 0, `${id}: alt ohne Nav`);
    altSig[id] = await signatur(a.page, id);
  }
  assert.deepEqual(a.protokoll.seitenfehler, [], 'alt: keine Seitenfehler');
  await a.kontext.close();

  const n = await oeffne('neu'); const { page } = n; erg.links = {};
  for (const id of PANELS) {
    assert.ok(await wechsle(page, id), `${id} aktiv (neu)`);
    const nav = page.locator(`#panel-${id} .px-abschnitte`);
    assert.equal(await nav.count(), 1, `${id}: eine Nav`);
    assert.ok(await nav.isVisible(), `${id}: Nav sichtbar`);
    const links = page.locator(`#panel-${id} .px-abschnitte a.px-abschnitt`);
    const anzahl = await links.count(); erg.links[id] = anzahl;
    assert.ok(anzahl >= 2, `${id}: >= 2 Links (${anzahl})`);
    const ziel = await links.nth(anzahl - 1).getAttribute('data-ziel');
    await links.nth(anzahl - 1).click(); await ruhe(page, 2500);
    const r = await page.evaluate((zid) => { const el = document.getElementById(zid).getBoundingClientRect(); return { top: el.top, h: innerHeight, bottom: el.bottom }; }, ziel);
    assert.ok(r.top < r.h && r.bottom > 0, `${id}: Ziel im Viewport (${JSON.stringify(r)})`);
    assert.equal(await page.locator(`#panel-${id} .px-abschnitte a.aktiv`).getAttribute('data-ziel'), ziel, `${id}: aktiv markiert`);
  }
  // neu -> alt: exakt wie alt von Anfang an
  await wechsel(page, 'alt');
  for (const id of PANELS) {
    assert.equal(await page.locator(`#panel-${id} .px-abschnitte`).count(), 0, `${id}: neu→alt ohne Nav`);
    assert.equal(await signatur(page, id), altSig[id], `${id}: DOM-Signatur wie alt`);
  }
  // alt -> neu: wieder da
  await wechsel(page, 'neu'); await wechsle(page, 'settings');
  assert.equal(await page.locator('#panel-settings .px-abschnitte a.px-abschnitt').count() >= 2, true, 'settings: nach alt→neu wieder Nav');
  // scrollIntoView auf bekannte Section-ID (gehZuEinstellung)
  const ok = await page.evaluate(async () => {
    if (typeof window.gehZuEinstellung !== 'function') return 'nofn';
    await window.gehZuEinstellung('settingsProfileSection'); await new Promise(r => setTimeout(r, 700));
    const r = document.getElementById('settingsProfileSection').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0;
  });
  assert.ok(ok === true || ok === 'nofn', 'gehZuEinstellung landet'); erg.gehZu = ok;
  assert.deepEqual(n.protokoll.seitenfehler, [], 'neu: keine Seitenfehler');
  await n.kontext.close();

  // Mitarbeiterin
  const m = await oeffne('neu', { rolle: 'employee' });
  for (const id of PANELS) await wechsle(m.page, id);
  assert.deepEqual(m.protokoll.seitenfehler, [], 'employee: keine Seitenfehler');
  await m.kontext.close();

  // 390 px
  const h = await oeffne('neu', { breite: 390 });
  for (const id of PANELS) {
    await wechsle(h.page, id);
    const ueber = await h.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(ueber <= 0, `${id}: 390 px ohne Überlauf (${ueber})`);
  }
  assert.deepEqual(h.protokoll.seitenfehler, [], 'mobil: keine Seitenfehler');
  await h.kontext.close();
  console.log(JSON.stringify({ ok: true, ...erg }));
} catch (e) {
  console.log(JSON.stringify({ ok: false, fehler: e.message, ...erg }));
  process.exitCode = 1;
} finally { await browser.close(); await server.close?.(); }
process.exit(process.exitCode ?? 0);
