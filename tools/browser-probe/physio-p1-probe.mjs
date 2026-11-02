import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const fehler = [];
page.on('pageerror', (e) => fehler.push(String(e.message)));
page.on('console', (m) => {
  if (m.type() === 'error') fehler.push(m.text());
});

const port = process.env.PROBE_PORT || 8081;
await page.goto(`http://localhost:${port}/tools/browser-probe/physio-p1-probe.html`, {
  waitUntil: 'domcontentloaded',
});

await page
  .waitForFunction(() => document.title === 'fertig', null, { timeout: 25000 })
  .catch((e) => fehler.push(`Probe nicht abgeschlossen: ${e.message}`));

const res = await page.evaluate(() => window.__probe || []);

if (process.env.PROBE_BILD) {
  await page.screenshot({ path: `${process.env.PROBE_BILD}-1440.png`, fullPage: true });
}

// 768 px Viewport
await page.setViewportSize({ width: 768, height: 900 });
const ueberlauf768 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
if (process.env.PROBE_BILD) {
  await page.screenshot({ path: `${process.env.PROBE_BILD}-768.png`, fullPage: true });
}

// 390 px Viewport
await page.setViewportSize({ width: 390, height: 800 });
const ueberlauf390 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
if (process.env.PROBE_BILD) {
  await page.screenshot({ path: `${process.env.PROBE_BILD}-390.png`, fullPage: true });
}

await browser.close();

console.log('\n══ PHYSIO P1 BROWSER-PROBE: LAYOUT, ABMESSUNGEN & VERBINDUNGEN');
let schlecht = 0;
for (const { name, ok, detail } of res) {
  if (!ok) schlecht += 1;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${detail ? ' — ' + detail : ''}`);
}
if (!res.length) {
  schlecht += 1;
  console.log('FEHL Die Probe hat kein Ergebnis geliefert.');
}
if (ueberlauf768 > 0) {
  schlecht += 1;
  console.log(`FEHL Seite läuft bei 768 px um ${ueberlauf768} px über`);
}
if (ueberlauf390 > 0) {
  schlecht += 1;
  console.log(`FEHL Seite läuft bei 390 px um ${ueberlauf390} px über`);
}
for (const f of fehler) {
  schlecht += 1;
  console.log(`FEHL ${f}`);
}
const bestanden = res.length - res.filter((r) => !r.ok).length;
console.log(`\n${bestanden}/${res.length} Prüfungen bestanden, Überlauf 768 px: ${ueberlauf768}, Überlauf 390 px: ${ueberlauf390}`);
process.exit(schlecht ? 1 : 0);
