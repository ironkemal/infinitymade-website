#!/usr/bin/env node
/**
 * redesign-smoke.mjs — Teststufe T5 des Redesigns (redesign/AUFTRAG.md, Abschnitt 6).
 *
 * Öffnet jeden Bereich in der synthetischen Praxis (tools/redesign-harness.mjs,
 * ohne Login, nur lesend), klickt ungefährliche Umschalter (Tabs, Filter,
 * Ansicht), öffnet den Hauptknopf im Panel-Kopf und schließt den Dialog wieder,
 * und misst horizontalen Überlauf. Konsolen- und Seitenfehler werden je Bereich
 * gesammelt.
 *
 *   node tools/redesign-smoke.mjs --lauf vorher [--design alt|neu|beide] [--breite 1440,390]
 *        [--szenario voll|leer|beide] [--panels a,b]
 *        [--rolle owner|employee|beide] [--theme hell|dunkel|beide]
 *        [--navigation switch|klick]   klick = echte Klicks in der Seitenleiste (inkl. Gruppe
 *                                      aufklappen, mobil Hamburger) statt window.switchPanel
 *   node tools/redesign-smoke.mjs --lauf nachher --gegen vorher
 *   [--wurzel <ordner>]  anderen Code-Stand ausliefern (siehe tools/redesign-basis.mjs)
 *   [--uhr <ISO>]  andere feste Uhrzeit · Szenarien zusätzlich: gross, fehler, langsam
 *
 * Mit --gegen zählen nur Funde, die es im Vergleichslauf (gleiches Panel, gleiche Breite,
 * gleiches Szenario, gleiche Rolle und gleiches Theme) noch nicht gab: Exit 1, wenn es welche
 * gibt. Das Design gehört bewusst nicht zum Schlüssel, damit „neu“ gegen einen Alt-Lauf
 * geprüft werden kann. Überlauf wird numerisch verglichen: ein schon bekannter Überlauf,
 * der um mehr als 1 px wächst, zählt als neu (vorher verdeckte die Ziffern-Normierung das).
 * Vorbestehende Fehler gehören ins Fehlerbuch, nicht in diese Zählung.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PANELS, WURZEL, oeffneDashboard, ruhe, starteBrowser, starteServer, wechsle, fixtureLog } from './redesign-harness.mjs';

const ZIEL = join(WURZEL, '.redesign-shots');
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const liste = (wert, alle) => (wert === 'beide' ? alle : String(wert).split(',').map((s) => s.trim()).filter(Boolean));

const lauf = arg('lauf');
if (!lauf || !/^[\w.-]+$/.test(lauf)) { console.error('--lauf <name> fehlt'); process.exit(2); }
const designs = liste(arg('design', 'alt'), ['alt', 'neu']);
const breiten = liste(arg('breite', '1440,390'), []).map(Number);
const szenarien = liste(arg('szenario', 'beide'), ['voll', 'leer']);
const panels = arg('panels') ? liste(arg('panels'), []) : PANELS;
const rollen = liste(arg('rolle', 'owner'), ['owner', 'employee']);
const themes = liste(arg('theme', 'hell'), ['hell', 'dunkel']);
const navigation = arg('navigation', 'switch');
if (!['switch', 'klick'].includes(navigation)) { console.error('--navigation switch|klick'); process.exit(2); }
const UMSCHALTER = '.tab-btn, .pd-tab, .filter-btn, .sv-btn, .ov-count-btn, [role="tab"]';

// Erste Zeile der Playwright-Meldung plus die Zeile, die den Grund nennt (z. B. „… intercepts pointer events“).
const grund = (e) => { const z = String(e.message).split('\n'); return [z[0], z.find((l) => /intercepts|not visible|outside of the viewport|detached/.test(l))].filter(Boolean).join(' — ').replace(/\s+/g, ' '); };
// Zahlen, Ports und IDs aus Meldungen nehmen, damit „gleicher Fehler“ erkennbar bleibt.
const norm = (t) => String(t).replace(/:\d{2,5}\b/g, ':P').replace(/\b[0-9a-f]{8}-[0-9a-f-]{27}\b/g, 'UUID').replace(/\d+/g, 'N');

const server = await starteServer({ wurzel: arg('wurzel') ? resolve(arg('wurzel')) : undefined });
const browser = await starteBrowser();
const ergebnis = { lauf, zeit: new Date().toISOString(), funde: [] };
try {
  for (const design of designs) for (const rolle of rollen) for (const theme of themes) for (const szenario of szenarien) for (const breite of breiten) {
    const { kontext, page, protokoll } = await oeffneDashboard(browser, { basis: server.basis, breite, theme, design, szenario, rolle, uhr: arg('uhr') });
    await ruhe(page, 1200);
    const fund = (panel, art, text, wert) => ergebnis.funde.push({ design, rolle, theme, szenario, breite, panel, art,
      text: String(text).slice(0, 300), ...(wert != null ? { wert } : {}) });
    const oeffne = (pid) => (navigation === 'klick' ? perKlick(page, pid, breite) : wechsle(page, pid));
    for (const t of protokoll.konsole.splice(0)) fund('(start)', 'konsole', t);
    for (const t of protokoll.seitenfehler.splice(0)) fund('(start)', 'seitenfehler', t);

    for (const panel of panels) {
      const erreicht = await oeffne(panel);
      if (erreicht === 'nicht-in-navigation') { fund(panel, 'nicht-in-navigation', 'kein sichtbarer Eintrag in der Seitenleiste'); continue; }
      if (!erreicht) { fund(panel, 'nicht-erreichbar', `${navigation === 'klick' ? 'Klick in der Leiste' : 'switchPanel'} aktivierte das Panel nicht`); continue; }
      const ueber = await page.evaluate(() => {
        const d = document.documentElement, m = document.getElementById('mainArea');
        return { dok: d.scrollWidth - d.clientWidth, main: m ? m.scrollWidth - m.clientWidth : 0 };
      });
      if (ueber.dok > 1 || ueber.main > 1) fund(panel, 'ueberlauf', `Dokument ${ueber.dok}px, mainArea ${ueber.main}px`, Math.max(ueber.dok, ueber.main));

      // Umschalter im Panel nacheinander klicken (nur sichtbare, max. 12).
      const anzahl = await page.locator(`#panel-${panel} :is(${UMSCHALTER}):visible`).count();
      for (let i = 0; i < Math.min(anzahl, 12); i++) {
        const el = page.locator(`#panel-${panel} :is(${UMSCHALTER}):visible`).nth(i);
        await el.click({ timeout: 2000 }).catch((e) => fund(panel, 'klick', 'Umschalter ' + i + ': ' + grund(e)));
        await page.waitForTimeout(150);
      }

      // Hauptknopf im Panel-Kopf: öffnen, dann schließen (Escape, sonst Abbrechen/Schließen im Dialog).
      const haupt = page.locator(`#panel-${panel} .panel-header .btn-primary:visible`).first();
      if (await haupt.count()) {
        await haupt.click({ timeout: 2000 }).catch((e) => fund(panel, 'klick', 'Hauptknopf: ' + grund(e)));
        await page.waitForTimeout(400);
        if (await blockiert(page)) {
          await page.keyboard.press('Escape'); await page.waitForTimeout(250);
          for (let v = 0; v < 2 && await blockiert(page); v++) {
            await page.evaluate(() => {
              const oben = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
              const dialog = oben?.closest('[id$="Modal"], .modal-overlay, [role="dialog"], dialog') || oben?.parentElement;
              const knopf = [...(dialog?.querySelectorAll('button') || [])].find((b) => b.offsetParent
                && (/^(abbrechen|schließen|später|nicht jetzt|zurück)$/i.test(b.textContent.trim()) || /^[×✕✖]$/.test(b.textContent.trim())
                  || /close|schliessen|abbrechen/i.test(b.className + ' ' + b.id)));
              knopf?.click();
            });
            await page.waitForTimeout(300);
          }
          const rest = await blockiert(page);
          if (rest) {
            fund(panel, 'dialog', 'Dialog des Hauptknopfs ließ sich nicht schließen: ' + rest);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.waitForSelector('#sidebarNav .sidebar-item', { timeout: 20000 });
            await ruhe(page, 800);
          }
        }
        await oeffne(panel);
      }
      for (const t of protokoll.konsole.splice(0)) fund(panel, 'konsole', t);
      for (const t of protokoll.seitenfehler.splice(0)) fund(panel, 'seitenfehler', t);
      process.stdout.write('.');
    }
    const fx = await fixtureLog(page);
    if (fx.writes.length) fund('(fixture)', 'schreibversuch', fx.writes.map((w) => w.tabelle + '.' + w.art).join(', '));
    if (protokoll.fremd.length) fund('(netz)', 'fremder-host', [...new Set(protokoll.fremd)].join(', '));
    await kontext.close();
    process.stdout.write(` ${design}-${rolle}-${theme}-${szenario}-${breite}\n`);
  }
} finally { await browser.close(); await server.stop(); }

await mkdir(ZIEL, { recursive: true });
await writeFile(join(ZIEL, `smoke-${lauf}.json`), JSON.stringify(ergebnis, null, 2));

// Ältere Läufe kennen weder Rolle noch Theme: dort galt owner/hell.
const schluessel = (f) => [f.rolle || 'owner', f.theme || 'hell', f.szenario, f.breite, f.panel, f.art, norm(f.text)].join('|');
const ueberSchluessel = (f) => [f.rolle || 'owner', f.theme || 'hell', f.szenario, f.breite, f.panel].join('|');
const ueberWert = (f) => f.wert ?? Math.max(...(String(f.text).match(/\d+/g) || ['0']).map(Number));
let neu = ergebnis.funde;
const gegen = arg('gegen');
if (gegen) {
  const pfad = join(ZIEL, `smoke-${gegen}.json`);
  if (!existsSync(pfad)) { console.error(`Vergleichslauf fehlt: ${pfad}`); process.exit(2); }
  const altFunde = JSON.parse(await readFile(pfad, 'utf8')).funde;
  const alt = new Set(altFunde.filter((f) => f.art !== 'ueberlauf').map(schluessel));
  const altUeber = new Map();
  for (const f of altFunde.filter((f) => f.art === 'ueberlauf')) {
    altUeber.set(ueberSchluessel(f), Math.max(altUeber.get(ueberSchluessel(f)) ?? 0, ueberWert(f)));
  }
  neu = ergebnis.funde.filter((f) => (f.art === 'ueberlauf'
    ? !altUeber.has(ueberSchluessel(f)) || ueberWert(f) > altUeber.get(ueberSchluessel(f)) + 1
    : !alt.has(schluessel(f))));
}
const gruppen = {};
for (const f of neu) (gruppen[`${f.panel} · ${f.art}`] ||= new Set()).add(`${f.design}/${f.rolle}/${f.theme}/${f.szenario}/${f.breite}: ${f.text}`);
for (const [k, v] of Object.entries(gruppen)) { console.log(`   ✗ ${k}`); for (const z of [...v].slice(0, 4)) console.log('       ' + z); }
console.log(`\n${ergebnis.funde.length} Funde gesamt` + (gegen ? ` · ${neu.length} neu gegenüber „${gegen}“` : '')
  + ` → .redesign-shots/smoke-${lauf}.json`);
process.exit(gegen && neu.length ? 1 : 0);

/**
 * Bereich wie ein Mensch öffnen: Seitenleiste (mobil erst der Hamburger), Gruppe aufklappen,
 * Eintrag anklicken. Liefert true/false oder 'nicht-in-navigation', wenn es keinen sichtbaren
 * Eintrag gibt (Rolle, Sichtbarkeit, Fachbereich).
 */
async function perKlick(page, pid, breite) {
  if (breite <= 1024) {
    const offen = await page.evaluate(() => document.getElementById('sidebar')?.classList.contains('open'));
    if (!offen) { await page.locator('#hamburger').click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(300); }
  }
  const da = await page.evaluate((id) => {
    const b = document.querySelector(`#sidebarNav .sidebar-item[data-panel="${id}"]`);
    if (!b) return false;
    const g = b.closest('.nav-group');
    if (g && !g.classList.contains('open')) g.querySelector('.nav-group-header')?.click();
    return true;
  }, pid);
  if (!da) return 'nicht-in-navigation';
  await page.waitForTimeout(200);
  const ok = await page.locator(`#sidebarNav .sidebar-item[data-panel="${pid}"]`).click({ timeout: 3000 }).then(() => true).catch(() => false);
  await ruhe(page, 700);
  if (!ok) return false;
  return page.evaluate((id) => {
    const aktiv = !!document.getElementById('panel-' + id)?.classList.contains('active');
    if (aktiv) document.getElementById('mainArea')?.scrollTo(0, 0);
    return aktiv;
  }, pid);
}

/** Liegt etwas über dem Inhalt? Prüft die Bildmitte: gehört das oberste Element nicht zu
 *  #mainArea, Kopfleiste oder Seitenleiste, deckt ein Dialog/Overlay die Seite ab. */
async function blockiert(page) {
  return page.evaluate(() => {
    const oben = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    if (!oben || oben.closest('#mainArea, .topbar, #sidebar')) return null;
    const d = oben.closest('[id]');
    return d ? '#' + d.id : oben.tagName.toLowerCase() + '.' + oben.className;
  });
}
