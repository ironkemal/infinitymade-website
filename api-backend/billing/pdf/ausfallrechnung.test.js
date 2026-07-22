// Smoke test: Ausfallrechnung template renders valid HTML, escapes user input.
//   node api-backend/billing/pdf/ausfallrechnung.test.js
import { renderAusfallrechnung } from './ausfallrechnung.template.js';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}

console.log('ausfallrechnung template');

const html = renderAusfallrechnung({
  praxis:  { name: 'Praxis Müller', strasse: 'Königsallee 1', plz_ort: '40213 Düsseldorf', telefon: '0211 1234567', steuernummer: 'NW123/4567', email: 'info@praxis.de' },
  patient: { nachname: 'Müller', vorname: 'Hans', strasse: 'Hauptstr. 5', plz: '40221', ort: 'Düsseldorf' },
  rechnung: { nummer: 'AF-0003', datum: '2026-07-13', faelligkeit: '2026-07-27' },
  termin:  { datum: '2026-07-10T09:30:00+02:00', leistung: 'KG Einzel', reason: 'no_show' },
  amount_eur: 35,
  bankverbindung: 'Musterbank · IBAN: DE12 3456 7890 1234 5678 90 · BIC: AAAABBCC',
});

test('starts with doctype', () => assert.ok(html.startsWith('<!DOCTYPE html>')));
test('shows invoice number', () => assert.ok(html.includes('AF-0003')));
test('formats amount de-DE', () => assert.ok(html.includes('35,00 €')));
test('mentions Ausfallhonorar + Schadensersatz', () => {
  assert.ok(html.includes('Ausfallhonorar'), 'Ausfallhonorar');
  assert.ok(html.includes('Schadensersatz'), 'Schadensersatz');
});
test('umsatzsteuerfrei clause present', () => assert.ok(html.includes('§ 1 Abs. 1 Nr. 1 UStG')));
test('reason label no_show', () => assert.ok(html.includes('Nicht wahrgenommener Termin')));
test('reason label late_cancel', () => {
  const lc = renderAusfallrechnung({ rechnung: {}, termin: { reason: 'late_cancel' }, amount_eur: 10 });
  assert.ok(lc.includes('Kurzfristige Terminabsage'));
});
test('custom hinweis overrides default', () => {
  const c = renderAusfallrechnung({ rechnung: {}, termin: {}, amount_eur: 10, hinweisText: 'Gemäß Vereinbarung vom 01.01.2026.' });
  assert.ok(c.includes('Gemäß Vereinbarung vom 01.01.2026.'));
  assert.ok(!c.includes('nicht fristgerecht abgesagt'));
});
test('escapes potential XSS', () => {
  const evil = renderAusfallrechnung({
    praxis: { name: '<script>alert(1)</script>' },
    rechnung: {}, termin: { leistung: '<img onerror=x>' }, amount_eur: 1,
  });
  assert.ok(!evil.includes('<script>alert(1)'));
  assert.ok(evil.includes('&lt;script&gt;'));
  assert.ok(!evil.includes('<img onerror'));
});
test('berlin time shown for termin', () => assert.ok(/09:30/.test(html)));

test('Geburtsdatum wird gerendert wenn vorhanden', () => {
  const gbd = '1990-05-15';
  const res = renderAusfallrechnung({
    rechnung: {}, termin: {}, amount_eur: 10,
    patient: { vorname: 'Hans', nachname: 'Müller', geburtsdatum: gbd }
  });
  const expectedGbd = new Date(gbd).toLocaleDateString('de-DE');
  assert.ok(res.includes(`geb. ${expectedGbd}`));
});

test('Geburtsdatum wird weggelassen wenn nicht vorhanden', () => {
  const res = renderAusfallrechnung({
    rechnung: {}, termin: {}, amount_eur: 10,
    patient: { vorname: 'Hans', nachname: 'Müller', geburtsdatum: null }
  });
  assert.ok(!res.includes('geb.'));
});

test('vorlage.zahlungsziel_tage ändert das Fälligkeitsdatum', () => {
  const datum = new Date('2026-07-13T12:00:00');
  const res = renderAusfallrechnung({
    rechnung: { datum },
    termin: {},
    amount_eur: 10,
    vorlage: { zahlungsziel_tage: 5 }
  });
  const expectedFaelligkeit = new Date(datum.getTime() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE');
  assert.ok(res.includes(expectedFaelligkeit));
});

test('vorlage.hinweis erscheint wenn business.ausfall_hinweis fehlt', () => {
  const res = renderAusfallrechnung({
    rechnung: {}, termin: {}, amount_eur: 10,
    hinweisText: null,
    vorlage: { hinweis: 'Hinweistext aus der Vorlage' }
  });
  assert.ok(res.includes('Hinweistext aus der Vorlage'));
});

test('business.ausfall_hinweis hat Vorrang vor vorlage.hinweis', () => {
  const res = renderAusfallrechnung({
    rechnung: {}, termin: {}, amount_eur: 10,
    hinweisText: 'Hinweistext aus Business',
    vorlage: { hinweis: 'Hinweistext aus der Vorlage' }
  });
  assert.ok(res.includes('Hinweistext aus Business'));
  assert.ok(!res.includes('Hinweistext aus der Vorlage'));
});

test('vorlage.betreff ueberschreibt die Rechnungs-Ueberschrift', () => {
  const res = renderAusfallrechnung({
    rechnung: {}, termin: {}, amount_eur: 10,
    vorlage: { betreff: 'Eigene Ueberschrift' }
  });
  assert.ok(res.includes('Eigene Ueberschrift'));
  assert.ok(!res.includes('<h1>Ausfallrechnung</h1>'));
});

test('vorlage.fusszeile ueberschreibt den Footer', () => {
  const res = renderAusfallrechnung({
    rechnung: {}, termin: {}, amount_eur: 10,
    invoiceFooterText: 'Standard Footer',
    vorlage: { fusszeile: 'Eigene Fusszeile' }
  });
  assert.ok(res.includes('Eigene Fusszeile'));
  assert.ok(!res.includes('Standard Footer'));
});

test('plz-Fallback (praxisProfile ohne zip aber mit plz)', () => {
  const praxisProfile1 = { zip: '40213', city: 'Düsseldorf' };
  const praxisProfile2 = { plz: '40213', city: 'Düsseldorf' };
  
  const plz_ort1 = [praxisProfile1.zip || praxisProfile1.plz, praxisProfile1.city].filter(Boolean).join(' ').trim();
  const plz_ort2 = [praxisProfile2.zip || praxisProfile2.plz, praxisProfile2.city].filter(Boolean).join(' ').trim();
  
  assert.equal(plz_ort1, '40213 Düsseldorf');
  assert.equal(plz_ort2, '40213 Düsseldorf');

  const htmlPlz = renderAusfallrechnung({
    praxis: { name: 'Test Praxis', plz_ort: plz_ort2 },
    rechnung: {}, termin: {}, amount_eur: 10
  });
  assert.ok(htmlPlz.includes('40213 Düsseldorf'));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
