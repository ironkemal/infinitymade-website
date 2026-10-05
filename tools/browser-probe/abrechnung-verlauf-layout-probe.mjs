// Misst die Liste „Bisherige Abrechnungen" (§302) über mehrere Breiten:
// passt die Tabelle in ihre Karte, ist die Status-Spalte ohne seitliches
// Scrollen sichtbar, scrollt die Seite selbst waagerecht?
// Anlass: Live-QA 05.10.2026 — bei ~829 px Status-Spalte abgeschnitten.
//
//   node dev_server.cjs &   (Port 8081)
//   node tools/browser-probe/abrechnung-verlauf-layout-probe.mjs [screenshot-ordner]
import { chromium } from 'playwright';

const BREITEN = [360, 390, 414, 768, 800, 829, 900, 1024, 1025, 1100, 1280, 1440];
const shotDir = process.argv[2] || null;

const browser = await chromium.launch();
let alleOk = true;
const fehler = [];

console.log('\n══ BISHERIGE ABRECHNUNGEN — Tabelle in der Karte');
console.log('   Breite | Seite scrollt | wrap sichtbar/Inhalt | Status-Spalte rechts / wrap rechts | sichtbar ohne Scrollen');
for (const w of BREITEN) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  page.on('pageerror', e => fehler.push(String(e.message)));
  page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
  await page.goto('http://localhost:8081/tools/browser-probe/abrechnung-verlauf-layout-probe.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.title === 'fertig', null, { timeout: 15000 });

  const m = await page.evaluate(() => {
    const wrap = document.querySelector('#panel-abrechnung .table-wrap');
    const th = document.querySelector('#abVerlaufKopf th[data-sort="status"]');
    const main = document.getElementById('mainArea');
    const wr = wrap.getBoundingClientRect();
    const tr = th.getBoundingClientRect();
    // Badges in der Status-Spalte: ragt eines über den sichtbaren Rand?
    const badges = [...document.querySelectorAll('#abVerlaufTbody tr td:last-child > span')];
    const badgeRechts = Math.max(...badges.map(b => b.getBoundingClientRect().right));
    return {
      seiteScrollt: document.documentElement.scrollWidth > window.innerWidth
                    || main.scrollWidth > main.clientWidth,
      wrapClient: wrap.clientWidth, wrapScroll: wrap.scrollWidth,
      wrapRechts: Math.round(wr.right), statusRechts: Math.round(tr.right),
      badgeRechts: Math.round(badgeRechts),
      tabelle: Math.round(document.querySelector('#panel-abrechnung .data-table').getBoundingClientRect().width),
    };
  });
  const sichtbar = m.statusRechts <= m.wrapRechts + 1 && m.badgeRechts <= m.wrapRechts + 1;
  // Unter 768 px ist seitliches Scrollen der Tabelle innerhalb .table-wrap
  // gewollt (dashboard.css: .data-table min-width 560px). Darüber muss sie passen.
  const soll = w > 768;
  const ok = !m.seiteScrollt && (!soll || sichtbar);
  if (!ok) alleOk = false;
  console.log(`   ${ok ? '✓' : '✗'} ${String(w).padStart(4)} | ${m.seiteScrollt ? 'JA ' : 'nein'}          | ${m.wrapClient}/${m.wrapScroll}`.padEnd(48)
    + ` | ${m.statusRechts} (Badge ${m.badgeRechts}) / ${m.wrapRechts}`.padEnd(32)
    + ` | ${sichtbar ? 'ja' : 'NEIN'}${soll ? '' : ' (Scrollen in .table-wrap erlaubt)'}`);
  if (shotDir) {
    await page.locator('#panel-abrechnung .card').first().screenshot({ path: `${shotDir}/abrechnung-verlauf-${w}.png` });
  }
  await page.close();
}

await browser.close();
if (fehler.length) { console.log('\n   ⚠ Konsolenfehler:'); [...new Set(fehler)].forEach(f => console.log('     · ' + f.slice(0, 200))); alleOk = false; }
else console.log('\n   keine Konsolenfehler');
process.exit(alleOk ? 0 : 1);
