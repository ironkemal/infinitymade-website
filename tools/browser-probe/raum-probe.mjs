import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const fehler = [];
page.on('pageerror', e => fehler.push(String(e.message)));
page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
await page.goto(`http://localhost:${process.env.PROBE_PORT || 8081}/tools/browser-probe/raum-probe.html`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.title === 'fertig', null, { timeout: 20000 })
  .catch(e => fehler.push(`Probe nicht abgeschlossen: ${e.message}`));
const res = await page.evaluate(() => window.__probe || []);
if (process.env.PROBE_BILD) await page.screenshot({ path: `${process.env.PROBE_BILD}-1440.png`, fullPage: true });
if (process.env.PROBE_BILD) {
  await page.evaluate(() => { document.getElementById('panel-calendar').classList.remove('active'); document.getElementById('panel-hours').classList.add('active'); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${process.env.PROBE_BILD}-verwaltung.png`, fullPage: true });
  await page.evaluate(() => { document.getElementById('panel-hours').classList.remove('active'); document.getElementById('panel-calendar').classList.add('active'); });
  await page.waitForTimeout(150);
}
await page.setViewportSize({ width: 390, height: 800 });
const ueberlauf = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
if (process.env.PROBE_BILD) await page.screenshot({ path: `${process.env.PROBE_BILD}-390.png`, fullPage: true });
await browser.close();
let schlecht = 0;
for (const { name, ok } of res) { if (!ok) schlecht += 1; console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}`); }
if (ueberlauf > 0) { schlecht += 1; console.log(`FEHL Seite läuft bei 390 px um ${ueberlauf} px über`); }
for (const f of fehler) { schlecht += 1; console.log(`FEHL ${f}`); }
console.log(`${res.length - res.filter(r => !r.ok).length}/${res.length} Prüfungen, Überlauf 390 px: ${ueberlauf}`);
process.exit(schlecht ? 1 : 0);
