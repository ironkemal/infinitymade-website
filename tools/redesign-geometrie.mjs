#!/usr/bin/env node
/**
 * redesign-geometrie.mjs — Kalender- und Rahmen-Geometrie alt/neu messen (PLAN-V2 V0.08, Teststufe T3).
 *
 * Warum
 * ─────
 * Kemals Kalender-Aufbau hängt an Pixelwerten, die JS und CSS gemeinsam festlegen
 * (Slot-Höhe, Spaltenkopf, `--sidebar-w`). Die regulären Probes (`npm run probe`) laden nur
 * dashboard.css, sehen das neue Design also gar nicht (Entwickler-B-Bericht B-2). Dieses
 * Werkzeug misst im echten Dashboard (synthetische Praxis, tools/redesign-harness.mjs) beide
 * Designs nebeneinander. Regel: Slot- und Kopfhöhen im neuen Design = alt. Breiten dürfen sich
 * mit der neuen Leiste ändern, werden aber ausgewiesen.
 *
 *   node tools/redesign-geometrie.mjs --lauf X [--breite 1440,1024,390] [--design beide] [--gegen Y]
 *   → .redesign-shots/geometrie-X.json, Exit 1 bei Verstoß
 *   Ohne --gegen: neu wird gegen alt aus demselben Lauf geprüft.
 *   Mit --gegen: jede Messung wird zusätzlich gegen denselben Schlüssel im Lauf Y geprüft.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { WURZEL, oeffneDashboard, ruhe, starteBrowser, starteServer, wechsle } from './redesign-harness.mjs';

const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const liste = (w, alle) => (w === 'beide' ? alle : String(w).split(',').map((s) => s.trim()).filter(Boolean));
const lauf = arg('lauf');
if (!lauf) { console.error('--lauf <name> fehlt'); process.exit(2); }
const designs = liste(arg('design', 'beide'), ['alt', 'neu']);
const breiten = liste(arg('breite', '1440,1024,390'), []).map(Number);

async function miss(page) {
  return page.evaluate(() => {
    const r = (el) => (el ? el.getBoundingClientRect() : null);
    // Tag- und Wochenraster liegen beide im DOM; nur das sichtbare zählt.
    const sichtbar = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null);
    const h = (sel, n = 8) => sichtbar(sel).slice(0, n).map((e) => Math.round(e.getBoundingClientRect().height));
    const main = r(document.getElementById('mainArea'));
    const sidebar = r(document.getElementById('sidebar'));
    return {
      topbar: Math.round(r(document.querySelector('header.topbar'))?.height ?? 0),
      leiste: sidebar ? { x: Math.round(sidebar.x), breite: Math.round(sidebar.width) } : null,
      main: main ? { x: Math.round(main.x), breite: Math.round(main.width) } : null,
      ueberlauf: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      zeitSlots: h('#panel-calendar .dv-time-col .dv-slot'),
      spaltenSlots: h('#panel-calendar .wv-col-slots .dv-slot'),
      koepfe: sichtbar('#panel-calendar .dv-col-header').slice(0, 8).map((e) => Math.round(e.getBoundingClientRect().height)),
      spaltenBreiten: sichtbar('#panel-calendar .dv-col').slice(0, 8).map((e) => Math.round(e.getBoundingClientRect().width)),
    };
  });
}

async function ansicht(page, view) {
  const ok = await page.evaluate((v) => {
    const b = document.querySelector(`#panel-calendar .cal-view-btn[data-view="${v}"]`);
    if (!b) return false; b.click(); return true;
  }, view);
  await ruhe(page, 700);
  return ok;
}

const server = await starteServer({ wurzel: arg('wurzel') ? resolve(arg('wurzel')) : undefined });
const browser = await starteBrowser();
const messungen = [];
try {
  for (const design of designs) for (const breite of breiten) {
    const { kontext, page } = await oeffneDashboard(browser, { basis: server.basis, breite, theme: 'hell', design });
    await ruhe(page, 1000);
    if (!(await wechsle(page, 'calendar'))) { messungen.push({ design, breite, fehler: 'Kalender nicht erreichbar' }); await kontext.close(); continue; }
    for (const view of ['day', 'week']) {
      const da = await ansicht(page, view);
      messungen.push({ design, breite, ansicht: view, ...(da ? await miss(page) : { fehler: `Ansicht ${view} fehlt` }) });
    }
    await kontext.close();
    process.stdout.write('.');
  }
} finally { await browser.close(); await server.stop(); }
process.stdout.write('\n');
await writeFile(join(WURZEL, '.redesign-shots', `geometrie-${lauf}.json`), JSON.stringify(messungen, null, 2));

const fehler = [];
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const schluessel = (m) => `${m.breite}/${m.ansicht}`;
const pruefe = (a, b, wo) => {
  if (a.fehler || b.fehler) { fehler.push(`${wo}: ${a.fehler || b.fehler}`); return; }
  for (const k of ['zeitSlots', 'spaltenSlots', 'koepfe', 'topbar']) if (!gleich(a[k], b[k])) fehler.push(`${wo} ${k}: ${JSON.stringify(b[k])} statt ${JSON.stringify(a[k])}`);
};
const alt = new Map(messungen.filter((m) => m.design === 'alt').map((m) => [schluessel(m), m]));
for (const m of messungen.filter((x) => x.design === 'neu')) if (alt.has(schluessel(m))) pruefe(alt.get(schluessel(m)), m, `neu↔alt ${schluessel(m)}`);
const gegen = arg('gegen');
if (gegen) {
  const p = join(WURZEL, '.redesign-shots', `geometrie-${gegen}.json`);
  if (!existsSync(p)) { console.error(`fehlt: ${p}`); process.exit(2); }
  const vorher = new Map(JSON.parse(await readFile(p, 'utf8')).map((m) => [`${m.design}/${schluessel(m)}`, m]));
  for (const m of messungen) { const v = vorher.get(`${m.design}/${schluessel(m)}`); if (v) pruefe(v, m, `${m.design} ${schluessel(m)} gegen ${gegen}`); }
}
for (const m of messungen) {
  if (m.fehler) continue;
  console.log(`   ${m.design.padEnd(3)} ${String(m.breite).padStart(4)} ${m.ansicht.padEnd(4)}  Leiste ${m.leiste?.breite ?? '–'}  Main x${m.main?.x}/${m.main?.breite}  Slots ${m.zeitSlots[0] ?? '–'}  Kopf ${m.koepfe[0] ?? '–'}  Spalten ${m.spaltenBreiten.join(',') || '–'}  Überlauf ${m.ueberlauf}`);
}
for (const f of fehler) console.log('   ✗ ' + f);
console.log(`\n${messungen.length} Messungen · ${fehler.length} Verstöße → .redesign-shots/geometrie-${lauf}.json`);
process.exit(fehler.length ? 1 : 0);
