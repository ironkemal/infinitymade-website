/** Kalender 390 px: steht der Patientenname auf der Terminkarte (Woche + Tag)?
 *  Befund Box-Test K, 22.11.2026: „Terminkarte zeigt keinen Patientennamen“.
 *  Misst je Karte: Name im DOM? sichtbar? abgeschnitten (scrollWidth > clientWidth)? Kartenmaß.
 *  Synthetische App ohne Login über HTTP (redesign-harness), reducedMotion reduce + no-preference.
 *  Eine JSON-Zeile; Exit 1, wenn eine Karte bei 390 px keinen sichtbaren Namen zeigt.
 *  Aufruf: node tools/browser-probe/kalender-name-390-probe.mjs [--shot DIR] */
import { oeffneDashboard, starteBrowser, starteServer, ruhe, wechsle } from '../redesign-harness.mjs';
process.env.REDESIGN_PORT ||= '18523';
const shotDir = process.argv.includes('--shot') ? process.argv[process.argv.indexOf('--shot') + 1] : null;
const server = await starteServer(); const browser = await starteBrowser();

function messe() {
  const grid = [...document.querySelectorAll('#weekViewGrid, #dayViewGrid')].find((g) => g.getClientRects().length && !g.hidden);
  const karten = grid ? [...grid.querySelectorAll('.wv-booking-block, .dv-booking-block')].filter((k) => k.getClientRects().length) : [];
  // Wer scrollt intern? Erster Vorfahr mit overflow auto/scroll und Überhang.
  let sc = grid, scroller = null;
  while (sc && sc !== document.body) { const o = getComputedStyle(sc); if (/(auto|scroll)/.test(o.overflowY + o.overflowX) && (sc.scrollHeight > sc.clientHeight + 1 || sc.scrollWidth > sc.clientWidth + 1)) { scroller = { el: sc.id || sc.className.split(' ')[0], sh: sc.scrollHeight, ch: sc.clientHeight, sw: sc.scrollWidth, cw: sc.clientWidth }; break; } sc = sc.parentElement; }
  return {
    raster: grid ? { id: grid.id, scroller, seiteX: document.documentElement.scrollWidth > innerWidth } : null,
    karten: karten.map((k) => {
      const t = k._termin || {};
      const name = (t.customer_name || (k.title || '').split('\n')[0] || '').trim();
      const r = k.getBoundingClientRect();
      const nameEl = k.querySelector('.dv-booking-name, .wv-booking-name');
      const sicht = (k.innerText || '').replace(/\s+/g, ' ').trim();
      // Sichtbar = erster Namensteil steht im gerenderten Text und sein Element ist nicht auf 0 geklemmt
      const teil = name.split(/\s+/).pop() || name;
      const imDom = !!name && k.textContent.includes(teil);
      let breiteName = null, abgeschnitten = null;
      if (nameEl) { breiteName = Math.round(nameEl.getBoundingClientRect().width); abgeschnitten = nameEl.scrollWidth > nameEl.clientWidth + 1; }
      return { cls: k.className.split(' ')[0], kompakt: k.classList.contains('dv-booking-block--compact'),
        w: Math.round(r.width), h: Math.round(r.height), name: !!name, imDom,
        sichtbar: imDom && sicht.includes(teil.slice(0, 3)), text: sicht.slice(0, 50), breiteName, abgeschnitten };
    }),
  };
}

const erg = {}; let fehler = 0;
for (const breite of [390, 1280]) {
  for (const motion of ['reduce', 'no-preference']) {
    const { kontext, page } = await oeffneDashboard(browser, { basis: server.basis, theme: 'hell', szenario: 'voll', breite, hoehe: breite === 390 ? 844 : 900, rolle: 'owner' });
    await page.emulateMedia({ reducedMotion: motion });
    try {
      if (!(await wechsle(page, 'calendar'))) throw new Error('calendar nicht aktiv');
      for (const v of ['week', 'day']) {
        await page.click(`.cal-view-btn[data-view="${v}"]`); await ruhe(page, 700);
        const m = await page.evaluate(messe);
        const ohne = m.karten.filter((k) => k.name && !k.sichtbar).length;
        erg[`${breite}/${motion}/${v}`] = { raster: m.raster, karten: m.karten.length, ohneName: ohne, beispiel: m.karten.slice(0, 4) };
        if (breite === 390 && ohne) fehler++;
        if (shotDir && motion === 'reduce') await page.screenshot({ path: `${shotDir}/kalender-${v}-${breite}.png`, animations: 'disabled' });
      }
    } finally { await kontext.close(); }
  }
}
await browser.close(); await server.stop?.();
console.log(JSON.stringify(erg));
process.exit(fehler ? 1 : 0);
