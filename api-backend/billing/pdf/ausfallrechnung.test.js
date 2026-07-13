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

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
