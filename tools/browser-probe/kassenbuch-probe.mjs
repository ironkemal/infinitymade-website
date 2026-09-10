import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
const fehler = [];
page.on('pageerror', e => fehler.push(String(e.message)));
page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
await page.goto('http://localhost:8081/tools/browser-probe/kassenbuch-probe.html', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.title === 'fertig', null, { timeout: 15000 }).catch(() => {});

const p = (t, ok, z = '') => console.log(`   ${ok ? '✓' : '✗'} ${t}${z ? '  — ' + z : ''}`);
let alleOk = true;
const P = (t, ok, z) => { p(t, ok, z); if (!ok) alleOk = false; };

console.log('\n══ BARVERKAUF-MODAL (Redesign, Ops-Meldung 10.09.2026)');

await page.click('#blAddManualBtn');
const chips = await page.evaluate(() => document.querySelectorAll('#blManualZahlartGrid .zahlart-chip').length);
P('5 Zahlart-Chips gerendert (bar/ec/ueberweisung/paypal/sonstiges)', chips === 5, String(chips));

const nachOeffnen = await page.evaluate(() => document.getElementById('blManualSaveBtn').disabled);
P('Save-Knopf startet deaktiviert', nachOeffnen === true);

await page.fill('#blManualAmount', '25');
await page.fill('#blManualRef', '1x Gutschein Massage');
const ohneZahlart = await page.evaluate(() => document.getElementById('blManualSaveBtn').disabled);
P('Betrag + Referenz allein reichen NICHT — Zahlart ist Pflicht, kein Default', ohneZahlart === true);

await page.click('#blManualZahlartGrid .zahlart-chip[data-zahlart="paypal"]');
const mitZahlart = await page.evaluate(() => document.getElementById('blManualSaveBtn').disabled);
P('nach Zahlart-Wahl: Save-Knopf frei', mitZahlart === false);

await page.click('#blManualSaveBtn');
await page.waitForTimeout(80);
const ergebnis = await page.evaluate(() => ({
  posted: window.__posted,
  closed: window.__closed,
  neuGeladen: window.__neuGeladen,
  toast: window.__toasts[0] || '',
}));
P('POST-Payload trägt zahlart="paypal"', ergebnis.posted?.zahlart === 'paypal', JSON.stringify(ergebnis.posted));
P('type bleibt "barverkauf"', ergebnis.posted?.type === 'barverkauf');
P('Modal schließt nach Erfolg', ergebnis.closed === true);
P('Liste wird neu geladen', ergebnis.neuGeladen === true);
P('Erfolgs-Toast nennt die gewählte Zahlart', /PayPal/.test(ergebnis.toast), ergebnis.toast);

await browser.close();
if (fehler.length) { console.log('\n   ⚠ Konsolenfehler:'); [...new Set(fehler)].forEach(f => console.log('     · ' + f.slice(0, 200))); alleOk = false; }
else console.log('\n   keine Konsolenfehler');

process.exit(alleOk ? 0 : 1);
