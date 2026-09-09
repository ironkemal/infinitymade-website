import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const fehler = [];
page.on('pageerror', e => fehler.push(String(e.message)));
page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
await page.goto('http://localhost:8081/tools/browser-probe/abrechnung-probe.html', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.title === 'fertig', null, { timeout: 15000 }).catch(() => {});

const p = (t, ok, z = '') => console.log(`   ${ok ? '✓' : '✗'} ${t}${z ? '  — ' + z : ''}`);
let alleOk = true;
const P = (t, ok, z) => { p(t, ok, z); if (!ok) alleOk = false; };

console.log('\n══ MODUS-UMSCHALTER (Regressionstest für Bug 1, Ops-Meldung 09.09.2026)');
for (const modus of ['liste', 'editor', 'ansicht']) {
  const h = await page.evaluate((m) => window.__probe.rechnungsModus(m), modus);
  const sichtbar = ['invListWrap', 'invEditor', 'invView'].filter(id => !h[id]).length;
  P(`Modus "${modus}": genau eine Fläche sichtbar`, sichtbar === 1, JSON.stringify(h));
}

const nachAnsicht = await page.evaluate(() => {
  window.__probe.zeigeRechnungsModus('ansicht');
  return {
    invListWrap: document.getElementById('invListWrap').hidden,
    invEditor: document.getElementById('invEditor').hidden,
    invView: document.getElementById('invView').hidden,
    invNewBtn: document.getElementById('invNewBtn').hidden,
  };
});
P('zeigeRechnungsModus("ansicht") setzt alle vier Elemente', JSON.stringify(nachAnsicht) === JSON.stringify({ invListWrap: true, invEditor: true, invView: false, invNewBtn: true }), JSON.stringify(nachAnsicht));

console.log('\n══ RECHNUNGSLISTE');
const mit3 = await page.evaluate(() => {
  window.__probe.zeigeRechnungsModus('liste');
  window.__probe.renderInvList();
  return {
    zeilen: document.querySelectorAll('#invListBody tr').length,
    ansehenKnoepfe: document.querySelectorAll('.inv-view-btn').length,
    leerSichtbar: document.getElementById('invListEmpty').hidden,
  };
});
P('3 erfundene Rechnungen -> 3 Zeilen', mit3.zeilen === 3, String(mit3.zeilen));
P('.inv-view-btn an jeder Zeile gebunden', mit3.ansehenKnoepfe === 3, String(mit3.ansehenKnoepfe));
P('#invListEmpty bleibt versteckt', mit3.leerSichtbar === true);

const mit0 = await page.evaluate(() => {
  window.__setListe([]);
  window.__probe.renderInvList();
  return { leerSichtbar: document.getElementById('invListEmpty').hidden };
});
P('0 Rechnungen -> #invListEmpty wird sichtbar', mit0.leerSichtbar === false);

await browser.close();
if (fehler.length) { console.log('\n   ⚠ Konsolenfehler:'); [...new Set(fehler)].forEach(f => console.log('     · ' + f.slice(0, 200))); alleOk = false; }
else console.log('\n   keine Konsolenfehler');

process.exit(alleOk ? 0 : 1);
