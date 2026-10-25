#!/usr/bin/env node
/**
 * redesign-zustaende.mjs — Bilder von Zuständen statt Bereichen (PLAN-V2 V0.07, Teil von T4).
 *
 * Warum
 * ─────
 * redesign-shots.mjs fotografiert jeden Bereich im Ruhezustand. Die Fehler des neuen Designs
 * stecken aber oft in Zuständen: Laden, leer, Fehler, offener Dialog, offene Schublade,
 * Flyout der Icon-Leiste, Seitenpanel, Tablet-Grenze 1024/1025. Jedes Rezept hier stellt
 * einen Zustand her und nimmt das sichtbare Fenster auf (Overlays liegen über dem Inhalt,
 * ein Ganzseitenbild würde sie abschneiden oder verdoppeln).
 *
 *   node tools/redesign-zustaende.mjs --lauf X [--design alt|neu|beide] [--theme hell|dunkel|beide]
 *        [--nur name1,name2] [--wurzel <ordner>]
 *   → .redesign-shots/X/zustaende/<design>-<theme>/<name>.png (+ zustaende.json)
 *   Vergleich wie gewohnt: node tools/redesign-shots.mjs --vergleich A B
 *
 * Rezepte, deren Auslöser es noch nicht gibt (z. B. Flyout vor V2.07), werden übersprungen
 * und im Bericht als „fehlt“ geführt — so zeigt das Werkzeug auch, was noch zu bauen ist.
 * Ladebilder hängen an Zeit: sie landen unter sichtung/ und werden nicht pixelgenau verglichen.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { WURZEL, oeffneDashboard, ruhe, starteBrowser, starteServer, wechsle } from './redesign-harness.mjs';

const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const liste = (w, alle) => (w === 'beide' ? alle : String(w).split(',').map((s) => s.trim()).filter(Boolean));
const lauf = arg('lauf');
if (!lauf) { console.error('--lauf <name> fehlt'); process.exit(2); }

/** Ein Rezept: name, Szenario/Rolle/Breite, aktion(page) → true | 'fehlt'. `sichtung`: zeitabhängig. */
export const REZEPTE = [
  { name: 'leer-start', szenario: 'leer', breite: 1440, aktion: async (p) => wechsle(p, 'overview') },
  { name: 'fehler-start', szenario: 'fehler', breite: 1440, aktion: async (p) => wechsle(p, 'overview') },
  { name: 'fehler-patienten', szenario: 'fehler', breite: 1440, aktion: async (p) => wechsle(p, 'kunden') },
  { name: 'laden-start', szenario: 'langsam', breite: 1440, sichtung: true, ohneRuhe: true, aktion: async () => true },
  { name: 'gross-patienten', szenario: 'gross', breite: 1440, aktion: async (p) => wechsle(p, 'kunden') },
  { name: 'gross-verordnungen-390', szenario: 'gross', breite: 390, aktion: async (p) => wechsle(p, 'verordnungen') },
  { name: 'dialog-neuer-patient', breite: 1440, aktion: async (p) => klickNach(p, 'kunden', '#leadAddBtn') },
  { name: 'dialog-neuer-termin', breite: 1440, aktion: async (p) => klickNach(p, 'calendar', '#calAddBookingBtn') },
  { name: 'mobil-schublade', breite: 390, aktion: async (p) => { await p.locator('#hamburger').click({ timeout: 2000 }); await ruhe(p, 500); return true; } },
  { name: 'tablet-1024-start', breite: 1024, aktion: async (p) => wechsle(p, 'overview') },
  { name: 'tablet-1025-start', breite: 1025, aktion: async (p) => wechsle(p, 'overview') },
  { name: 'tablet-1024-kalender', breite: 1024, aktion: async (p) => wechsle(p, 'calendar') },
  { name: 'mitarbeiterin-start', rolle: 'employee', breite: 1440, aktion: async (p) => wechsle(p, 'overview') },
  // Ab V2/V3 vorhanden (bis dahin „fehlt“):
  { name: 'leiste-eingeklappt', breite: 1440, aktion: async (p) => klickNach(p, 'overview', '#sidebarCollapseBtn') },
  { name: 'flyout-gruppe', breite: 1440, aktion: async (p) => {
    if ((await klickNach(p, 'overview', '#sidebarCollapseBtn')) !== true) return 'fehlt';
    // Heute klappt die Leiste auf Breite 0 zu: kein sichtbarer Gruppenkopf → Flyout gibt es noch nicht.
    const leiste = await p.locator('#sidebar').boundingBox();
    const kopf = p.locator('#sidebarNav .nav-group-header').nth(2);
    if (!leiste || leiste.width < 40 || !(await kopf.count())) return 'fehlt';
    if (!(await kopf.click({ timeout: 2000 }).then(() => true).catch(() => false))) return 'fehlt';
    await ruhe(p, 400);
    return (await p.locator('.px-flyout').count()) ? true : 'fehlt';
  } },
  { name: 'seitenpanel-verordnung', breite: 1440, aktion: async (p) => {
    if (!(await wechsle(p, 'verordnungen'))) return false;
    const zeile = p.locator('#vordTbody tr').first();
    if (!(await zeile.count())) return 'fehlt';
    await zeile.click({ timeout: 2000 }); await ruhe(p, 500);
    return (await p.locator('.px-seitenpanel:visible').count()) ? true : 'fehlt';
  } },
  { name: 'suche-offen', breite: 1440, aktion: async (p) => {
    if (!(await p.locator('#pxSuche').count())) return 'fehlt';
    await p.keyboard.press('/'); await ruhe(p, 300); return true;
  } },
];

async function klickNach(page, panel, selektor) {
  if (!(await wechsle(page, panel))) return false;
  const el = page.locator(`${selektor}:visible`).first();
  if (!(await el.count())) return 'fehlt';
  await el.click({ timeout: 2000 }).catch(() => {});
  await ruhe(page, 500);
  return true;
}

const designs = liste(arg('design', 'neu'), ['alt', 'neu']);
const themes = liste(arg('theme', 'hell'), ['hell', 'dunkel']);
const nur = arg('nur') ? new Set(liste(arg('nur'), [])) : null;
const rezepte = REZEPTE.filter((r) => !nur || nur.has(r.name));

const server = await starteServer({ wurzel: arg('wurzel') ? resolve(arg('wurzel')) : undefined });
const browser = await starteBrowser();
const bericht = { lauf, zeit: new Date().toISOString(), ergebnisse: [] };
try {
  for (const design of designs) for (const theme of themes) {
    const ordner = join(WURZEL, '.redesign-shots', lauf, 'zustaende', `${design}-${theme}`);
    const sichtung = join(WURZEL, '.redesign-shots', lauf, 'sichtung', `${design}-${theme}`);
    await mkdir(ordner, { recursive: true }); await mkdir(sichtung, { recursive: true });
    for (const r of rezepte) {
      const { kontext, page, protokoll } = await oeffneDashboard(browser, { basis: server.basis, breite: r.breite, theme, design,
        rolle: r.rolle || 'owner', szenario: r.szenario || 'voll' });
      if (!r.ohneRuhe) await ruhe(page, 1000);
      let ergebnis;
      try { ergebnis = await r.aktion(page); } catch (e) { ergebnis = 'fehler: ' + String(e.message).split('\n')[0]; }
      if (ergebnis === true) {
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: join(r.sichtung ? sichtung : ordner, `${r.name}.png`), animations: 'disabled', caret: 'hide' });
      }
      bericht.ergebnisse.push({ design, theme, name: r.name, ergebnis: ergebnis === true ? 'ok' : ergebnis || 'nicht erreicht',
        konsole: protokoll.konsole.slice(0, 5), seitenfehler: protokoll.seitenfehler.slice(0, 5) });
      process.stdout.write(ergebnis === true ? '.' : ergebnis === 'fehlt' ? '-' : 'x');
      await kontext.close();
    }
    process.stdout.write(` ${design}-${theme}\n`);
  }
} finally { await browser.close(); await server.stop(); }
await writeFile(join(WURZEL, '.redesign-shots', lauf, 'zustaende.json'), JSON.stringify(bericht, null, 2));
const zaehl = (f) => bericht.ergebnisse.filter(f).length;
const fehlt = [...new Set(bericht.ergebnisse.filter((e) => e.ergebnis === 'fehlt').map((e) => e.name))];
const kaputt = bericht.ergebnisse.filter((e) => e.ergebnis !== 'ok' && e.ergebnis !== 'fehlt');
for (const k of kaputt) console.log(`   ✗ ${k.design}-${k.theme} ${k.name}: ${k.ergebnis}`);
console.log(`${zaehl((e) => e.ergebnis === 'ok')} Zustände aufgenommen · ${fehlt.length} noch nicht vorhanden (${fehlt.join(', ') || '–'}) · ${kaputt.length} Fehler`
  + ` → .redesign-shots/${lauf}/zustaende/`);
process.exit(kaputt.length ? 1 : 0);
