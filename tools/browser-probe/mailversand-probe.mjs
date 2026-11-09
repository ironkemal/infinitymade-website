import { chromium } from 'playwright';
const browser = await chromium.launch();
let schlecht = 0; const alle = [];
for (const breite of [1024, 390]) {
  const page = await browser.newPage({ viewport: { width: breite, height: 900 } });
  const fehler = [];
  page.on('pageerror', e => fehler.push(String(e.message)));
  page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
  await page.goto(`http://localhost:${process.env.PROBE_PORT || 8081}/tools/browser-probe/mailversand-probe.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__probe, null, { timeout: 20000 }).catch(() => {});
  const res = await page.evaluate(() => window.__probe || []);
  console.log(`\n══ E-MAIL-VERSAND (Einstellungen) · ${breite}px`);
  for (const r of res) {
    if (r.ok) console.log(`   ✓ ${r.name}`);
    else { schlecht++; console.log(`   ✗ ${r.name}\n       ${r.detail}`); }
  }
  if (!res.length) { schlecht++; console.log('   ✗ Die Probe hat kein Ergebnis geliefert.'); }
  if (fehler.length) { schlecht++; console.log('\n   Konsolenfehler:'); [...new Set(fehler)].forEach(f => console.log('     · ' + f.slice(0, 200))); }
  alle.push(...res);
  await page.close();
}
await browser.close();
console.log(`\n   ${alle.length - schlecht}/${alle.length} bestanden`);
process.exit(schlecht ? 1 : 0);
