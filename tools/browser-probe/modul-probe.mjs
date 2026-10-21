import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const fehler = [];
page.on('pageerror', e => fehler.push(String(e.message)));
page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
await page.goto('http://localhost:8081/tools/browser-probe/modul-probe.html', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.title === 'fertig' && Array.isArray(window.__probe), null, { timeout: 15000 })
  .catch(e => fehler.push(`Modulprobe nicht abgeschlossen: ${e.message}`));
const res = await page.evaluate(() => window.__probe || []);
await browser.close();
let schlecht = 0;
if (!res.length) { schlecht++; console.log('   ✗ Die Modulprobe hat kein Ergebnis geliefert.'); }
for (const r of res) {
  if (r.ok) console.log(`   ✓ ${r.p}  (${r.exporte} Exporte)`);
  else { schlecht++; console.log(`   ✗ ${r.p}\n       ${r.fehler}`); }
}
console.log(`\n   ${res.filter(r => r.ok).length}/${res.length} Module laden im Browser`);
if (fehler.length) { console.log('\n   Konsolenfehler:'); [...new Set(fehler)].forEach(f => console.log('     · ' + f.slice(0,180))); }
if (schlecht || fehler.length) process.exitCode = 1;
