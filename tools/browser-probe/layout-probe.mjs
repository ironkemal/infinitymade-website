import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:8081/tools/browser-probe/layout-probe.html', { waitUntil: 'networkidle' });

const mess = async (kompakt) => {
  await page.evaluate((k) => document.body.classList.toggle('compact-mode', k), kompakt);
  await page.waitForTimeout(120);
  return page.evaluate(() => {
    const h = (sel) => {
      const el = document.querySelector(sel);
      return el ? Math.round(el.getBoundingClientRect().height) : null;
    };
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), unten: Math.round(r.bottom) };
    };
    return {
      wocheZeitSlot: h('.week-view-grid .dv-time-col .dv-slot'),
      wocheSpaltenSlot: h('.week-view-grid .wv-col-slots .dv-slot'),
      wocheZeitspalte: box('.week-view-grid .dv-time-col'),
      wocheSpalte: box('.week-view-grid .dv-col'),
      wocheKopf: h('.week-view-grid .dv-col-header'),
      tagZeitSlot: h('.day-view-grid .dv-time-col .dv-slot'),
      tagSpaltenSlot: h('.day-view-grid .wv-col-slots .dv-slot'),
      tagKopf: h('.day-view-grid .dv-col-header'),
      gridAnzeige: getComputedStyle(document.getElementById('servicesGrid')).display,
      tabellenNebeneinander: (() => {
        const s = document.querySelectorAll('#servicesGrid .srv-gruppe');
        if (s.length < 2) return null;
        return Math.round(s[0].getBoundingClientRect().top) === Math.round(s[1].getBoundingClientRect().top);
      })(),
      menue: (() => {
        const el = document.getElementById('probeMenue');
        const st = getComputedStyle(el);
        return { position: st.position, zIndex: st.zIndex, breite: Math.round(el.getBoundingClientRect().width) };
      })(),
    };
  });
};

const normal = await mess(false);
const kompakt = await mess(true);
await browser.close();

const zeile = (t, w) => console.log('   ' + t.padEnd(34) + w);
const pruef = (t, ok, zusatz = '') => console.log(`   ${ok ? '✓' : '✗'} ${t}${zusatz ? '  — ' + zusatz : ''}`);

console.log('\n══ NORMAL');
zeile('Woche · Slot Zeitleiste', normal.wocheZeitSlot + ' px');
zeile('Woche · Slot Tagesspalte', normal.wocheSpaltenSlot + ' px');
zeile('Woche · Kopfzeile', normal.wocheKopf + ' px');
zeile('Tag   · Slot Zeitleiste', normal.tagZeitSlot + ' px');
zeile('Tag   · Slot Spalte', normal.tagSpaltenSlot + ' px');
zeile('Tag   · Kopfzeile', normal.tagKopf + ' px');
zeile('Zeitspalte endet bei', normal.wocheZeitspalte.unten + ' px');
zeile('Tagesspalte endet bei', normal.wocheSpalte.unten + ' px');

console.log('\n══ PRÜFUNGEN');
pruef('Woche: Zeitleiste und Spalte gleich hoch',
  normal.wocheZeitSlot === normal.wocheSpaltenSlot,
  `${normal.wocheZeitSlot} vs ${normal.wocheSpaltenSlot}`);
pruef('Woche: beide Spalten enden auf gleicher Höhe',
  Math.abs(normal.wocheZeitspalte.unten - normal.wocheSpalte.unten) <= 1,
  `${normal.wocheZeitspalte.unten} vs ${normal.wocheSpalte.unten}`);
pruef('Woche: Slot ist 28 px (WV_SLOT_PX)', normal.wocheSpaltenSlot === 28);
pruef('Tag: Slot ist 56 px (DV_SLOT_PX)', normal.tagSpaltenSlot === 56);
pruef('Kopfzeile beide 44 px', normal.wocheKopf === 44 && normal.tagKopf === 44,
  `Woche ${normal.wocheKopf}, Tag ${normal.tagKopf}`);
pruef('Leistungsliste ist kein CSS-Grid', normal.gridAnzeige !== 'grid', 'display: ' + normal.gridAnzeige);
pruef('Leistungstabellen stehen untereinander', normal.tabellenNebeneinander === false);
pruef('Kontextmenü ist fixed positioniert', normal.menue.position === 'fixed', 'z-index ' + normal.menue.zIndex);

console.log('\n══ KOMPAKTMODUS (bekannter Fehler — soll sich bestätigen)');
zeile('Woche · Slot Zeitleiste', kompakt.wocheZeitSlot + ' px');
zeile('Woche · Slot Tagesspalte', kompakt.wocheSpaltenSlot + ' px');
zeile('Tag   · Slot Spalte', kompakt.tagSpaltenSlot + ' px');
pruef('Kompaktmodus bricht das Tagesraster (32 statt 56)', kompakt.tagSpaltenSlot === 32,
  'JS rechnet weiter mit 56');
pruef('Kompaktmodus bricht auch die Woche (32 statt 28)', kompakt.wocheSpaltenSlot === 32,
  'JS rechnet weiter mit 28');
