import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const fehler = [];
page.on('pageerror', e => fehler.push(String(e.message)));
page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
await page.goto('http://localhost:8081/tools/browser-probe/verordnung-maske-probe.html', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__probe, null, { timeout: 20000 }).catch(() => {});
const res = await page.evaluate(() => window.__probe || []);
await browser.close();

console.log('\n══ MUSTER-13-MASKE: UMZUG UND BEFUNDE AM FELD');
let schlecht = 0;
for (const r of res) {
  if (r.ok) console.log(`   ✓ ${r.name}${r.detail ? '  — ' + r.detail : ''}`);
  else { schlecht++; console.log(`   ✗ ${r.name}\n       ${r.detail}`); }
}
if (!res.length) { schlecht = 1; console.log('   ✗ Die Probe hat kein Ergebnis geliefert.'); }
if (fehler.length) {
  console.log('\n   Konsolenfehler:');
  [...new Set(fehler)].forEach(f => console.log('     · ' + f.slice(0, 200)));
}
console.log(`\n   ${res.length - schlecht}/${res.length} bestanden`);
process.exit(schlecht ? 1 : 0);
