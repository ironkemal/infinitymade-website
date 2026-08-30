import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const fehler = [];
page.on('pageerror', e => fehler.push(String(e.message)));
page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
await page.goto('http://localhost:8081/tools/browser-probe/render-probe.html', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.title === 'fertig', null, { timeout: 15000 }).catch(() => {});

const p = (t, ok, z='') => console.log(`   ${ok ? '✓' : '✗'} ${t}${z ? '  — ' + z : ''}`);

const d = await page.evaluate(() => {
  const q = (s) => document.querySelectorAll(s);
  const bloecke = [...q('.wv-booking-block')];
  const ersterBlock = bloecke[0]?.getBoundingClientRect();
  const slot0900 = [...q('.wv-col-slots .dv-slot')].find(el => el.dataset.time?.endsWith('T09:00'));
  return {
    wochenSpalten: q('.week-view-grid .dv-col').length,
    wochenSlots: q('.wv-col-slots .dv-slot').length,
    wochenBloecke: bloecke.length,
    blockOben: ersterBlock ? Math.round(ersterBlock.top) : null,
    slotOben: slot0900 ? Math.round(slot0900.getBoundingClientRect().top) : null,
    blockFlaeche: bloecke[0] ? getComputedStyle(bloecke[0]).backgroundColor : null,
    blockRand: bloecke[0] ? getComputedStyle(bloecke[0]).borderLeftColor : null,
    blockerSchraffur: [...q('.wv-booking-block--blocker')].length,
    monatsZellen: q('.month-cell').length,
    monatsPillen: q('.month-event-pill').length,
    gruppen: [...q('#servicesGrid .srv-gruppe')].map(s => s.dataset.typ),
    zeilen: q('#servicesGrid tbody tr').length,
    gkvZeilen: q('#gkvCatalogSection tbody tr').length,
    gkvAktiv: q('#gkvCatalogSection .gkv-zeile--aktiv').length,
    dividerVersteckt: document.getElementById('privatSrvDivider').hidden,
  };
});

console.log('\n══ WOCHENANSICHT');
p('7 Tagesspalten', d.wochenSpalten === 7, String(d.wochenSpalten));
p('24 Rasterfelder je Tag (7×24=168)', d.wochenSlots === 168, String(d.wochenSlots));
p('Termine gezeichnet', d.wochenBloecke === 2, String(d.wochenBloecke));
p('09:00-Termin sitzt exakt auf der 09:00-Linie', d.blockOben === d.slotOben, `Block ${d.blockOben}, Slot ${d.slotOben}`);
p('Blockfläche trägt die Leistungsfarbe', /239, 68, 68/.test(d.blockFlaeche || ''), d.blockFlaeche);
p('linker Rand trägt die Mitarbeiterfarbe', /34, 197, 94/.test(d.blockRand || ''), d.blockRand);
p('Blocker ist schraffiert markiert', d.blockerSchraffur === 1, String(d.blockerSchraffur));

console.log('\n══ MONATSANSICHT');
p('volle Wochen (durch 7 teilbar)', d.monatsZellen % 7 === 0, `${d.monatsZellen} Zellen`);
p('Termin-Pillen gezeichnet', d.monatsPillen > 0, String(d.monatsPillen));

console.log('\n══ LEISTUNGSLISTE');
p('nach Kostenträger gruppiert', JSON.stringify(d.gruppen) === JSON.stringify(['gkv','privat','bg','intern']), d.gruppen.join(' · '));
p('alle 4 Leistungen als Zeile', d.zeilen === 4, String(d.zeilen));

console.log('\n══ GKV-KATALOG');
p('2 Katalogzeilen + 1 Hinweiszeile', d.gkvZeilen === 3, String(d.gkvZeilen));
p('eingerichtete Zeile markiert', d.gkvAktiv === 1, String(d.gkvAktiv));
p('Trenner eingeblendet', d.dividerVersteckt === false);

// Interaktion
console.log('\n══ INTERAKTION');
await page.dblclick('.wv-col-slots .dv-slot[data-time$="T14:30"]');
await page.click('.wv-booking-block');
await page.click('.month-cell');
await page.click('#servicesGrid tbody tr');
await page.click('#gkvCatalogSection [data-gkv="78020"]');
await page.click('.wv-booking-block', { button: 'right' });
await page.waitForTimeout(300);
const menueOffen = await page.evaluate(() => !!document.querySelector('.kal-kontextmenue'));
const eintraege = await page.evaluate(() => [...document.querySelectorAll('.kal-kontextmenue-eintrag')].map(e => e.textContent.trim()));
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
const menueZu = await page.evaluate(() => !document.querySelector('.kal-kontextmenue'));
const ev = await page.evaluate(() => window.__ereignisse);

const hat = (was) => ev.some(e => e.was === was);
p('Doppelklick Woche meldet Zeit', hat('woche-dblclick'), JSON.stringify(ev.find(e=>e.was==='woche-dblclick')||{}));
p('Klick auf Wochentermin meldet Termin', hat('woche-termin'));
p('Klick auf Monatszelle meldet Tag', hat('monat-klick'));
p('Klick auf Leistungszeile öffnet Bearbeitung', hat('leistung-bearbeiten'));
p('GKV "+ Einrichten" meldet Code', hat('gkv-einrichten'));
p('Rechtsklick öffnet Menü', menueOffen, eintraege.join(' | '));
p('Escape schließt Menü', menueOffen && menueZu, menueOffen ? '' : 'nicht pruefbar — Menü ging nicht auf');

await browser.close();
if (fehler.length) { console.log('\n   ⚠ Konsolenfehler:'); [...new Set(fehler)].forEach(f => console.log('     · ' + f.slice(0,200))); }
else console.log('\n   keine Konsolenfehler');
