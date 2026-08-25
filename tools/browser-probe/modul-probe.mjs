import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const fehler = [];
page.on('pageerror', e => fehler.push(String(e.message)));
page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
await page.goto('http://localhost:8081/tools/browser-probe/modul-probe.html', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__probe, null, { timeout: 15000 }).catch(() => {});
const res = await page.evaluate(() => window.__probe || []);
await browser.close();
let schlecht = 0;
for (const r of res) {
  if (r.ok) console.log(`   ✓ ${r.p}  (${r.exporte} Exporte)`);
  else { schlecht++; console.log(`   ✗ ${r.p}\n       ${r.fehler}`); }
}
console.log(`\n   ${res.length - schlecht}/${res.length} Module laden im Browser`);
if (fehler.length) { console.log('\n   Konsolenfehler:'); [...new Set(fehler)].forEach(f => console.log('     · ' + f.slice(0,180))); }
