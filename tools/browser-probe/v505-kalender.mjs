/** V5.05m: Kalender-Bedienung alt = neu (Ansichten, Navigation, Spalten, Chips, Anlegen, Termin, Kontextmenü, Verschieben, Fehler/Überlauf).
 *  Synthetische App ohne Login. Eine JSON-Zeile; Exit 1 bei Abweichung ("Schritt N: alt X, neu Y"). */
import { oeffneDashboard, starteBrowser, starteServer, ruhe, wechsle } from '../redesign-harness.mjs';
process.env.REDESIGN_PORT ||= '18505';
const server = await starteServer(); const browser = await starteBrowser();
const sicht = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; }, sel);
const datum = (page) => page.locator('#dayViewDateLabel').innerText();
const ANSICHT = { day: '#dayViewGrid', week: '#weekViewGrid', month: '#monthViewWrap' };
const schliesseAlles = async (page) => {
  await page.keyboard.press('Escape'); await ruhe(page, 200);
  await page.evaluate(() => { document.querySelectorAll('.modal-overlay,[id$="Modal"]').forEach((m) => { if (m.id === 'bkActionModal') { m.hidden = true; m.style.display = 'none'; } }); });
};
async function lauf(design, breite) {
  const { kontext, page, protokoll } = await oeffneDashboard(browser, { basis: server.basis, theme: 'hell', szenario: 'voll', breite, rolle: 'owner', design });
  const r = {};
  try {
    if (!(await wechsle(page, 'calendar'))) throw new Error('calendar nicht aktiv');
    // 1 Ansichten
    r[1] = {};
    for (const v of ['week', 'month', 'day']) {
      await page.click(`.cal-view-btn[data-view="${v}"]`); await ruhe(page, 500);
      const s = {}; for (const [k, sel] of Object.entries(ANSICHT)) s[k] = await sicht(page, sel);
      r[1][v] = Object.entries(s).filter(([, x]) => x).map(([k]) => k).join(',');
    }
    if (breite < 1000) { r[4] = await anlegen(page); r[8] = { fehler: protokoll.seitenfehler.length, ueber: await ueber(page) }; return r; }
    // 2 Datum
    r[2] = {}; const d0 = await datum(page);
    await page.click('#dayViewNext'); await ruhe(page, 400); const d1 = await datum(page);
    await page.click('#dayViewPrev'); await ruhe(page, 400); await page.click('#dayViewPrev'); await ruhe(page, 400); const d2 = await datum(page);
    await page.click('#calTodayBtn'); await ruhe(page, 400); const d3 = await datum(page);
    r[2] = { weiter: d1 !== d0, zurueck: d2 !== d0 && d2 !== d1, heute: d3 === d0 };
    // 3 Spalten + Chips
    const spalten = () => page.locator('#dvColsWrap .dv-col').count();
    r[3] = { spalten: await spalten(), chips: await page.locator('.cal-emp-chip').count() };
    const chips = page.locator('#calEmpChips .cal-emp-chip');
    if (await chips.count() > 1) { await chips.nth(1).click(); await ruhe(page, 500); r[3].nachChip = await spalten(); await chips.nth(1).click(); await ruhe(page, 500); r[3].zurueck = await spalten(); }
    // 4 Anlegen
    r[4] = await anlegen(page);
    // 5 Termin -> Seitenpanel
    const blk = page.locator('#dvColsWrap .dv-booking-block').first();
    r[5] = { bloecke: await page.locator('#dvColsWrap .dv-booking-block').count() > 0 };
    if (r[5].bloecke) { await blk.click(); await ruhe(page, 700); r[5].panel = await sicht(page, '#bkActionModal'); }
    // 6 Kontextmenü
    r[6] = {};
    if (r[5].bloecke) {
      await schliesseAlles(page);
      await blk.click({ button: 'right' }); await ruhe(page, 400);
      r[6].offen = await sicht(page, '.kal-kontextmenue');
      r[6].eintraege = r[6].offen ? (await page.locator('.kal-kontextmenue-eintrag').allInnerTexts()).map((t) => t.trim()) : [];
      await page.keyboard.press('Escape'); await ruhe(page, 300);
      r[6].zu = !(await sicht(page, '.kal-kontextmenue'));
      // 7 Verschieben: Klick-Modus (kein echtes Drag&Drop); Ziel anklicken -> Vorschau, dann abbrechen => kein Schreibzugriff
      r[7] = {};
      await schliesseAlles(page);
      const mv = page.locator('.kal-kontextmenue-eintrag:not([disabled])', { hasText: /verschieb/i }).first();
      const nb = await page.locator('#dvColsWrap .dv-booking-block').count();
      for (let i = 0; i < nb; i++) {
        await schliesseAlles(page);
        await page.locator('#dvColsWrap .dv-booking-block').nth(i).click({ button: 'right' }); await ruhe(page, 300);
        if (await mv.count()) { r[7].block = i; break; }
      }
      if (await mv.count()) {
        await mv.click(); await ruhe(page, 500);
        r[7].banner = await sicht(page, '#calMoveBanner');
        const ziel = page.locator('#dvColsWrap .dv-col-slots .dv-slot').nth(await freiSlot(page, 4));
        await ziel.click({ position: { x: 20, y: 10 } }).catch(() => {}); await ruhe(page, 500);
        r[7].vorschau = await page.locator('.dv-ghost').count();
        await page.click('#calMoveCancelBtn').catch(() => {}); await ruhe(page, 300);
        r[7].banner_zu = !(await sicht(page, '#calMoveBanner'));
      } else r[7].verschieben = 'kein Termin mit aktivem Verschieben';
      r[7].schreib = protokoll.api.filter((x) => !x.startsWith('GET')).length;
    }
    r[8] = { fehler: protokoll.seitenfehler.length, ueber: await ueber(page) };
    return r;
  } finally { r.fehlertexte = protokoll.seitenfehler; await kontext.close(); }
}
async function freiSlot(page, ab) {
  return page.evaluate((a) => { const sl = [...document.querySelectorAll('#dvColsWrap .dv-col-slots .dv-slot')];
    for (let i = a; i < sl.length; i++) { sl[i].scrollIntoView({ block: 'center' }); const r = sl[i].getBoundingClientRect(); if (document.elementFromPoint(r.left + 20, r.top + 10) === sl[i]) return i; } return -1; }, ab);
}
async function ueber(page) { return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 0); }
async function anlegen(page) {
  await schliesseAlles(page);
  await page.click('#calAddBookingBtn'); await ruhe(page, 500);
  const o = { knopf: await sicht(page, '#bookingModal') };
  await page.evaluate(() => { const m = document.getElementById('bookingModal'); if (m) m.hidden = true; }); await ruhe(page, 200);
  o.zu = !(await sicht(page, '#bookingModal'));
  if (page.viewportSize().width >= 1000) {
    const idx = await freiSlot(page, 0);
    await page.locator('#dvColsWrap .dv-col-slots .dv-slot').nth(idx).dblclick({ position: { x: 20, y: 10 } }); await ruhe(page, 500);
    o.doppelklick = await sicht(page, '#bookingModal');
    await page.evaluate(() => { const m = document.getElementById('bookingModal'); if (m) m.hidden = true; });
  }
  return o;
}
const erg = { alt: {}, neu: {} }; const abw = [];
try {
  for (const [breite, name] of [[1440, 'd'], [390, 'm']]) {
    const a = await lauf('alt', breite), n = await lauf('neu', breite);
    erg.alt[name] = a; erg.neu[name] = n;
    for (const k of Object.keys({ ...a, ...n })) {
      if (k === 'fehlertexte') continue;
      const x = JSON.stringify(a[k]), y = JSON.stringify(n[k]);
      if (x !== y) abw.push(`Schritt ${k} (${breite}): alt ${x}, neu ${y}`);
    }
    if (a.fehlertexte.length || n.fehlertexte.length) abw.push(`Schritt 8 (${breite}): pageerror alt ${a.fehlertexte}, neu ${n.fehlertexte}`);
    for (const [w, e] of [['alt', a], ['neu', n]]) if (e[8].ueber !== true) abw.push(`Schritt 8 (${breite}): ${w} horizontaler Überlauf`);
  }
  console.log(JSON.stringify({ ok: abw.length === 0, abweichungen: abw, ...erg }));
  if (abw.length) { console.error(abw.join('\n')); process.exitCode = 1; }
} catch (e) { console.log(JSON.stringify({ ok: false, fehler: e.message, ...erg })); console.error(e.message); process.exitCode = 1; }
finally { await browser.close(); await server.stop?.(); }
process.exit(process.exitCode ?? 0);
