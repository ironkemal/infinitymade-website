// Prueft die „+"-Zeilen der Terminmaske im echten Browser (Ops 235).
//
// Die Unit-Tests decken das Modell ab — Summe, Zeilenlogik, Vorschlagsregel.
// Was sie NICHT sehen: ob der Knopf verdrahtet ist, ob die vorgeschlagene
// Zeile wirklich erscheint, und ob die Dauer dort landet, wo der Speicherpfad
// sie liest. Genau das steht hier.
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
page.setDefaultTimeout(8000);   // haengende Schritte sollen scheitern, nicht warten
const fehler = [];
page.on('pageerror', e => fehler.push(String(e.message)));
page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });

await page.goto('http://localhost:8081/tools/browser-probe/leistungen-probe.html', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.title === 'fertig', null, { timeout: 15000 }).catch(() => {});

let schlecht = 0;
const p = (t, ok, z = '') => { if (!ok) schlecht++; console.log(`   ${ok ? '✓' : '✗'} ${t}${z ? '  — ' + z : ''}`); };

const zeilen = () => page.locator('#bkLeistungExtra > div').count();
const dauer = () => page.evaluate(() =>
  Number(document.getElementById('bkDurationValue')?.value || 0));
const hinweis = () => page.evaluate(() => {
  const el = document.getElementById('bkLeistungHinweis');
  return el.hidden ? '' : el.textContent.trim();
});

console.log('\n══ „+"-KNOPF');
p('startet mit einer Zeile', await zeilen() === 0, `${await zeilen()} Zusatzzeilen`);
await page.click('#bkLeistungAdd');
p('„+" legt eine Zeile an', await zeilen() === 1, `${await zeilen()}`);
await page.click('#bkLeistungExtra [data-rolle="entfernen"]');
p('„✕" nimmt sie wieder weg', await zeilen() === 0, `${await zeilen()}`);

console.log('\n══ BEFUNDUNG SETZT SICH VON SELBST');
await page.selectOption('#bkService', 's-beh-gr');
await page.waitForTimeout(250);
const nachWahl = await page.evaluate(() => window.__probe.leseLeistungen());
p('neuer Patient bekommt eine zweite Zeile', nachWahl.length === 2, `${nachWahl.length} Zeilen`);
p('und zwar die Eingangsbefundung', nachWahl[1]?.serviceId === 's-eing', String(nachWahl[1]?.serviceId));
p('sie ist als Vorschlag markiert', nachWahl[1]?.auto === true);
p('die Rueckfrage nach 01.11.2023 steht da', /01\.11\.2023/.test(await hinweis()));

console.log('\n══ DAUER');
p('Block ist so lang wie beide Leistungen', await dauer() === 70, `${await dauer()} Min (50 + 20)`);
p('Dauerauswahl ist sichtbar', await page.evaluate(() => !document.getElementById('bkDurationGroup').hidden));

console.log('\n══ NAGELZWEIG — hier gibt es die Eingangsbefundung nicht');
await page.selectOption('#bkService', 's-nsp');
await page.waitForTimeout(250);
const nachNagel = await page.evaluate(() => window.__probe.leseLeistungen());
p('der alte Vorschlag ist weggeraeumt', nachNagel.length === 1, `${nachNagel.length} Zeile`);
p('stattdessen ein Hinweis auf 78110/78100', /78110/.test(await hinweis()), (await hinweis()).slice(0, 60) + '…');

console.log('\n══ GRUPPENTERMIN');
await page.selectOption('#bkService', 's-beh-gr');
await page.waitForTimeout(250);
await page.check('#bkIsGroup');
p('„+" ist im Gruppenmodus ausgeblendet', await page.evaluate(() => document.getElementById('bkLeistungAdd').hidden));
p('und die Zusatzzeile ist weg', await zeilen() === 0, `${await zeilen()}`);

console.log('\n══ „+" UND DANN DIESELBE LEISTUNG NOCH EINMAL');
// Der Klickweg aus der Praxis — und zugleich die Regressionsprobe auf das
// Einfrieren vom 03.09.2026: „+" druecken und in der neuen Zeile die Leistung
// waehlen, die die Software oben schon vorgeschlagen hat. Zwei Fragen auf
// einmal: haengt der Hauptthread wieder (dann laeuft der Schritt in den
// Timeout, statt still zu bestehen), und entstehen zwei identische Zeilen
// (die `UNIQUE (booking_id, service_id)` beim Speichern abweist)?
//
// Steht am Ende, weil der Abschnitt eine Handauswahl hinterlaesst: die
// bleibt absichtlich stehen, wenn spaeter die Hauptleistung wechselt, und
// haette dem Nagelzweig-Abschnitt darueber die Grundlage entzogen.
await page.uncheck('#bkIsGroup');
await page.evaluate(() => { document.getElementById('bookingModal').hidden = true; });
await page.evaluate(() => { document.getElementById('bookingModal').hidden = false; });
await page.waitForTimeout(100);
await page.selectOption('#bkService', 's-beh-gr');
await page.waitForTimeout(300);
p('frische Maske, Vorschlag steht wieder', await zeilen() === 1, `${await zeilen()}`);
await page.click('#bkLeistungAdd');
p('„+" legt daneben eine leere Zeile an', await zeilen() === 2, `${await zeilen()}`);
await page.selectOption('#bkLeistungExtra > div:last-child select', 's-eing');
await page.waitForTimeout(250);
const nachDoppel = await page.evaluate(() => window.__probe.leseLeistungen());
p('die Seite reagiert noch', await page.evaluate(() => document.title) === 'fertig');
p('keine zweite identische Zeile', nachDoppel.length === 2, `${nachDoppel.length} Zeilen`);
p('stattdessen zaehlt die Menge', nachDoppel[1]?.anzahl === 2, `Anzahl ${nachDoppel[1]?.anzahl}`);
p('und der Block waechst mit', await dauer() === 90, `${await dauer()} Min (50 + 2x20)`);


console.log(fehler.length ? `\n   ✗ Konsolenfehler:\n     ${fehler.join('\n     ')}` : '\n   keine Konsolenfehler');
await browser.close();
process.exit(schlecht || fehler.length ? 1 : 0);
