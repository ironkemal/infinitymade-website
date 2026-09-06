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
p('nach Kostenträger gruppiert', JSON.stringify(d.gruppen) === JSON.stringify(['gkv','privat','selbstzahler','bg','intern']), d.gruppen.join(' · '));
p('alle 5 Leistungen als Zeile', d.zeilen === 5, String(d.zeilen));

console.log('\n══ GKV-KATALOG');
p('2 Katalogzeilen + 1 Hinweiszeile', d.gkvZeilen === 3, String(d.gkvZeilen));
p('eingerichtete Zeile markiert', d.gkvAktiv === 1, String(d.gkvAktiv));
p('Trenner eingeblendet', d.dividerVersteckt === false);

// Interaktion
console.log('\n══ INTERAKTION');
await page.dblclick('.wv-col-slots .dv-slot[data-time$="T14:30"]');
await page.click('.wv-booking-block');
await page.click('.month-cell[data-datum="2026-08-19"]');
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
const monatKlick = ev.find(e => e.was === 'monat-klick');
p('Klick auf Monatszelle meldet Tag', hat('monat-klick'));
// Ops-Karte adaf10bf: der Klick auf den 19. oeffnete den 18. Ursache war
// toISOString() auf einer lokalen Mitternacht — Berlin liegt vor UTC.
p('Klick auf den 19. meldet auch den 19. (kein Tagesversatz)',
  monatKlick?.gemeldet === '2026-08-19',
  `geklickt 2026-08-19, gemeldet ${monatKlick?.gemeldet ?? '—'}`);
p('Klick auf Leistungszeile öffnet Bearbeitung', hat('leistung-bearbeiten'));
p('GKV "+ Einrichten" meldet Code', hat('gkv-einrichten'));
p('Rechtsklick öffnet Menü', menueOffen, eintraege.join(' | '));
p('Escape schließt Menü', menueOffen && menueZu, menueOffen ? '' : 'nicht pruefbar — Menü ging nicht auf');

console.log('');
console.log('══ WARTELISTE');
const wl = await page.evaluate(() => ({
  wartend: window.__wlWartend, vermittelt: window.__wlVermittelt, leer: window.__wlLeer,
  modalOffen: !document.getElementById('wlMatchModal').hidden,
  karten: document.querySelectorAll('#wlMatchList .wl-candidate-card').length,
  vergebenKnoepfe: document.querySelectorAll('#wlMatchList [data-nachruecker]').length,
  slotZeile: document.getElementById('wlMatchSlot').hidden ? null : document.getElementById('wlMatchSlot').textContent,
}));
p('wartende Eintraege als Zeile', wl.wartend.zeilen === 2, String(wl.wartend.zeilen));
p('in der Wartend-Ansicht kein Weg zurueck', wl.wartend.zurueckKnoepfe === 0, String(wl.wartend.zurueckKnoepfe));
p('Reiter meldet den gewaehlten Stand', wl.wartend.status === 'waiting' && wl.vermittelt.status === 'matched', `${wl.wartend.status} → ${wl.vermittelt.status}`);
p('vermittelter Eintrag bietet den Weg zurueck', wl.vermittelt.zurueckKnoepfe === 1, String(wl.vermittelt.zurueckKnoepfe));
// Dort zaehlt, WANN vermittelt wurde (01.09.), nicht wann eingetragen (05.08.).
p('vermittelte Ansicht zeigt das Vermittlungsdatum', wl.vermittelt.datum === '1.9.2026', String(wl.vermittelt.datum));
p('Leermeldung folgt dem Reiter', wl.leer.sichtbar && /vermittelt/.test(wl.leer.text), wl.leer.text);
p('Nachruecker-Dialog offen mit beiden Kandidaten', wl.modalOffen && wl.karten === 2, `offen=${wl.modalOffen}, Karten=${wl.karten}`);
p('jede Karte kann den Platz bekommen', wl.vergebenKnoepfe === 2, String(wl.vergebenKnoepfe));
p('der frei gewordene Platz steht im Dialog', /10\.09/.test(wl.slotZeile || ''), wl.slotZeile ?? '— nicht sichtbar');

await page.click('#wlMatchList [data-nachruecker="0"]');
await page.click('#wlTableBody [data-wl-zurueck]');
await page.waitForTimeout(200);
const ev2 = await page.evaluate(() => window.__ereignisse);
p('„Diesen Termin geben" meldet den Eintrag', ev2.some(e => e.was === 'wl-uebernehmen' && e.id === 'w1'));
p('„Zurueck auf die Warteliste" meldet den Eintrag', ev2.some(e => e.was === 'wl-zurueck' && e.id === 'w2'));

// ── PATIENTENSUCHE: „heute im Haus" (Ops #267) ──────────────────────────────
console.log('\n══ PATIENTENSUCHE — heutiger Termin nach oben');
await page.focus('#psFeld');
await page.waitForTimeout(150);
const ps = await page.evaluate(() => {
  const li = [...document.querySelectorAll('#psWrap .patient-search-list li')];
  return {
    reihenfolge: li.filter(e => e.dataset.id).map(e => e.textContent.replace(/Heute.*$/, '').trim()),
    marke: li.find(e => e.querySelector('.ps-badge'))?.querySelector('.ps-badge').textContent,
    markeBei: li.find(e => e.querySelector('.ps-badge'))?.dataset.id,
    trennerText: document.querySelector('#psWrap .ps-sep')?.textContent,
    trennerNach: li.findIndex(e => e.classList.contains('ps-sep')),
  };
});
p('der heutige Patient steht ganz oben', ps.reihenfolge[0] === 'Bert Cem', ps.reihenfolge.join(' · '));
p('die anderen bleiben in ihrer Reihenfolge', ps.reihenfolge.slice(1).join(' · ') === 'Anna Bauer · Cem Demir', ps.reihenfolge.slice(1).join(' · '));
p('mit Uhrzeit beschriftet', ps.marke === 'Heute 14:30' && ps.markeBei === 'p2', `${ps.marke} @ ${ps.markeBei}`);
p('Trennzeile genau nach dem Vorschlag', ps.trennerNach === 1 && ps.trennerText === 'Alle Patienten', `Index ${ps.trennerNach}: ${ps.trennerText}`);

// Die Trennzeile darf die Pfeiltasten nicht verschlucken.
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
const ev3 = await page.evaluate(() => window.__ereignisse);
p('Pfeiltasten ueberspringen die Trennzeile', ev3.some(e => e.was === 'ps-wahl' && e.id === 'p1'),
  ev3.filter(e => e.was === 'ps-wahl').map(e => e.id).join(',') || '— keine Wahl');

// ── Der „+" in beiden Lagen ──
console.log('\n\u2550\u2550 VERORDNUNGSKARTEN \u2014 der \u201e+\u201c ist immer da');
const vk = await page.evaluate(() => ({
  leerKnopf:  document.querySelectorAll('#vkLeer .bk-vero-anlegen').length,
  leerText:   document.querySelector('#vkLeer .bk-vero-anlegen')?.textContent.replace(/\s+/g, ' ').trim(),
  vollKarten: document.querySelectorAll('#vkVoll .bk-vero-card').length,
  vollKnopf:  document.querySelectorAll('#vkVoll .bk-vero-anlegen').length,
  vollZuletzt: document.getElementById('vkVoll')?.lastElementChild?.className,
}));
p('ohne Verordnung: ein Anlegen-Knopf', vk.leerKnopf === 1, `${vk.leerKnopf} Knopf/Knoepfe`);
p('und er fragt statt nur festzustellen', /Jetzt eine anlegen\?/.test(vk.leerText || ''), vk.leerText);
p('mit Verordnung: die Karte steht', vk.vollKarten === 1, `${vk.vollKarten} Karte(n)`);
p('mit Verordnung: der „+" steht trotzdem', vk.vollKnopf === 1, `${vk.vollKnopf} Knopf/Knoepfe`);
p('und zwar UNTER den Karten', vk.vollZuletzt === 'bk-vero-anlegen', vk.vollZuletzt);

await page.click('#vkVoll .bk-vero-anlegen');
await page.waitForTimeout(80);
const ev4 = await page.evaluate(() => window.__ereignisse);
p('der Klick meldet sich', ev4.some(e => e.was === 'vk-anlegen' && e.lage === 'voll'),
  ev4.filter(e => e.was === 'vk-anlegen').map(e => e.lage).join(',') || '— nichts');

await browser.close();
if (fehler.length) { console.log('\n   ⚠ Konsolenfehler:'); [...new Set(fehler)].forEach(f => console.log('     · ' + f.slice(0,200))); }
else console.log('\n   keine Konsolenfehler');
