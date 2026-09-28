// Probe: ICD ↔ Diagnosegruppe in der echten Muster-13-Maske (Ops #304, 26.09.2026).
// Tippt mit der Tastatur, verlässt Felder mit Tab — Bühne: icd-dg-probe.html.
// Aufruf: node dev_server.cjs  (Port 8081), dann node tools/browser-probe/icd-dg-probe.mjs
import { chromium } from 'playwright';

const URL = 'http://localhost:8081/tools/browser-probe/icd-dg-probe.html';
const browser = await chromium.launch();
const fehler = [];
const ergebnis = [];
const pruef = (name, ok, detail = '') => ergebnis.push({ name, ok: !!ok, detail: String(detail) });

async function buehne() {
  const page = await browser.newPage();
  page.on('pageerror', e => fehler.push(String(e.message)));
  page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__bereit || window.__fehler, null, { timeout: 20000 });
  const f = await page.evaluate(() => window.__fehler);
  if (f) throw new Error(f);
  return page;
}
const warte = ms => new Promise(r => setTimeout(r, ms));
async function tippe(page, id, text) {
  await page.click('#' + id);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  if (text) await page.keyboard.type(text, { delay: 5 });
  await page.keyboard.press('Tab');
  await warte(150);
}
const wert = (page, id) => page.$eval('#' + id, el => el.value);
const hinweis = page => page.$eval('#rzIcdDgWarning', el => (el.style.display === 'block' ? el.textContent : ''));
const podoBox = page => page.evaluate(() => document.getElementById('rzMaskeWrap')?.innerText || document.body.innerText);

try {
  // a) E11.74 → DF
  let p = await buehne();
  await tippe(p, 'rzIcd', 'E11.74');
  pruef('a) E11.74 → DF', await wert(p, 'rzDg') === 'DF', await wert(p, 'rzDg'));

  // d2) dann L60.0 im zweiten Feld → DF zurückgenommen, Kandidaten
  await tippe(p, 'rzIcd2', 'L60.0');
  pruef('d2) + L60.0 im zweiten Feld → DG leer', await wert(p, 'rzDg') === '', await wert(p, 'rzDg'));
  pruef('d2) Hinweis nennt DF, UI1, UI2', (await hinweis(p)) === 'Passende Diagnosegruppen: DF, UI1, UI2', await hinweis(p));
  pruef('kein zweiter DG-Hinweis aus verordnung-podo.js', !/Zulässige Diagnosegruppen|passt nicht zum eingegebenen/.test(await podoBox(p)));

  // Zweiten Kode löschen → DF kommt zurück
  await tippe(p, 'rzIcd2', '');
  pruef('zweiten Kode gelöscht → DF wieder', await wert(p, 'rzDg') === 'DF', await wert(p, 'rzDg'));
  await p.close();

  // d) beide in einem Feld → aufgeteilt
  p = await buehne();
  await tippe(p, 'rzIcd', 'E11.74, L60.0');
  pruef('d) „E11.74, L60.0" → Feld 1 = E11.74', await wert(p, 'rzIcd') === 'E11.74', await wert(p, 'rzIcd'));
  pruef('d) … Feld 2 = L60.0', await wert(p, 'rzIcd2') === 'L60.0', await wert(p, 'rzIcd2'));
  pruef('d) … DG leer', await wert(p, 'rzDg') === '', await wert(p, 'rzDg'));
  pruef('d) … Hinweis', /^2\. Code nach ICD 2 übernommen · Passende Diagnosegruppen: DF, UI1, UI2$/.test(await hinweis(p)), await hinweis(p));
  await p.close();

  // d2 in einem Feld ergänzt
  p = await buehne();
  await tippe(p, 'rzIcd', 'E11.74');
  await tippe(p, 'rzIcd', 'E11.74 L60.0');
  pruef('d2) „E11.74" → „E11.74 L60.0" (Leerzeichen) → DG leer, aufgeteilt',
    (await wert(p, 'rzDg')) === '' && (await wert(p, 'rzIcd2')) === 'L60.0', `${await wert(p, 'rzDg')} / ${await wert(p, 'rzIcd2')}`);
  await p.close();

  // c) DG von Hand leeren → DF sofort wieder
  p = await buehne();
  await tippe(p, 'rzIcd', 'E11.74');
  await tippe(p, 'rzDg', '');
  pruef('c) DG geleert → DF sofort wieder', await wert(p, 'rzDg') === 'DF', await wert(p, 'rzDg'));

  // Klick ins DG-Feld ohne Änderung schaltet die Automatik nicht ab
  await p.click('#rzDg'); await p.keyboard.press('Tab'); await warte(150);
  await tippe(p, 'rzIcd2', 'L60.0');
  pruef('Klick ins DG-Feld → Automatik bleibt, DF zurückgenommen', await wert(p, 'rzDg') === '', await wert(p, 'rzDg'));
  await p.close();

  // Von Hand gewählte DG bleibt
  p = await buehne();
  await tippe(p, 'rzDg', 'DF');
  await tippe(p, 'rzIcd', 'E11.74');
  await tippe(p, 'rzIcd2', 'L60.0');
  pruef('DF von Hand → bleibt bei E11.74 + L60.0', await wert(p, 'rzDg') === 'DF', await wert(p, 'rzDg'));
  await p.close();

  // f) E11.72 → nichts; L60.0 allein → UI1, UI2
  p = await buehne();
  await tippe(p, 'rzIcd', 'E11.72');
  pruef('f) E11.72 → kein DF', await wert(p, 'rzDg') === '', await wert(p, 'rzDg'));
  await tippe(p, 'rzIcd', 'L60.0');
  pruef('L60.0 allein → Hinweis UI1, UI2', (await hinweis(p)) === 'Passende Diagnosegruppen: UI1, UI2', await hinweis(p));
  await p.close();
} catch (e) {
  pruef('Probe lief durch', false, e.message);
}
await browser.close();

console.log('\n══ ICD ↔ DIAGNOSEGRUPPE (echte Maske, Tastatur + Tab)');
let schlecht = 0;
for (const r of ergebnis) {
  if (r.ok) console.log(`   ✓ ${r.name}${r.detail ? '  — ' + r.detail : ''}`);
  else { schlecht++; console.log(`   ✗ ${r.name}\n       ${r.detail}`); }
}
if (!ergebnis.length) { schlecht = 1; console.log('   ✗ Die Probe hat kein Ergebnis geliefert.'); }
if (fehler.length) {
  console.log('\n   Konsolenfehler:');
  [...new Set(fehler)].forEach(f => console.log('     · ' + f.slice(0, 200)));
}
console.log(`\n   ${ergebnis.length - schlecht}/${ergebnis.length} bestanden`);
process.exit(schlecht ? 1 : 0);
