// Smoke test: templates render valid HTML, escape user input, include key fields.
//   node api-backend/billing/pdf/templates.test.js
import { renderZuzahlungsrechnung } from './zuzahlungsrechnung.template.js';
import { renderBegleitzettel } from './begleitzettel.template.js';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}

console.log('zuzahlungsrechnung template');

const zhr = renderZuzahlungsrechnung({
  praxis:   { name: 'Praxis Müller', strasse: 'Königsallee 1', plz_ort: '40213 Düsseldorf', telefon: '0211 1234567', ik: '123456789', steuernummer: 'NW123/4567', email: 'info@praxis.de' },
  patient:  { nachname: 'Müller', vorname: 'Hans', strasse: 'Hauptstr. 5', plz: '40221', ort: 'Düsseldorf', kvnr: 'A123456789', geburtsdatum: '1972-04-13' },
  verordnung: { ausstellungsdatum: '2026-05-02', krankenkasse: 'AOK Rheinland/Hamburg' },
  rechnung: { nummer: 'ZZ-2026-W20-001', datum: '2026-05-18', faelligkeit: '2026-06-01' },
  sessions: [
    { datum: '2026-05-05', position: '20501', bezeichnung: 'KG Einzel', brutto: 29.63, zuzahlung: 2.96 },
    { datum: '2026-05-07', position: '20501', bezeichnung: 'KG Einzel', brutto: 29.63, zuzahlung: 2.96 },
  ],
  totals: { brutto: 59.26, prozZuzahlung: 5.92, pauschZuzahlung: 10.00, gesZuzahlung: 15.92 },
  bankverbindung: 'IBAN DE12 3456 7890 1234 5678 90<br>BIC AAAABBCC',
});

test('starts with doctype', () => assert.ok(zhr.startsWith('<!DOCTYPE html>')));
test('escapes umlauts intact', () => assert.ok(zhr.includes('Müller, Hans') || zhr.includes('Müller</strong>')));
test('formats EUR with comma + €', () => assert.ok(zhr.includes('29,63 €') || zhr.includes('29,63 €')));
test('shows session table rows', () => {
  // de-DE locale yields '5.5.2026' (no leading zeros)
  assert.ok(/(05|5)\.(05|5)\.2026/.test(zhr), 'session date');
  assert.ok(zhr.includes('KG Einzel'), 'leistung name');
});
test('includes Pauschale 10€', () => assert.ok(zhr.includes('Verordnungspauschale (10 €)')));
test('escapes potential XSS', () => {
  const evil = renderZuzahlungsrechnung({
    praxis: { name: '<script>alert(1)</script>' },
    rechnung: {}, totals: {},
  });
  assert.ok(!evil.includes('<script>alert(1)'));
  assert.ok(evil.includes('&lt;script&gt;'));
});

console.log('begleitzettel template');

const bz = renderBegleitzettel({
  praxis:    { name: 'Praxis Müller', strasse: 'Königsallee 1', plz_ort: '40213 Düsseldorf', ik: '123456789' },
  empfaenger:{ name: 'AOK Gemeinsame Datenannahmestelle', strasse: 'Kortrijker Str. 1', plz_ort: '53177 Bonn', ik: '660500345' },
  abrechnung:{
    dateiname: 'EHK5678900000023',
    rechnungsnummer: 'R2026-W20-001',
    datum: '2026-05-18',
    prescription_count: 2,
    total_brutto: 270.50,
    total_zuzahlung: 27.05,
    total_netto: 243.45,
    krankenkasse_name: 'AOK Rheinland/Hamburg',
    krankenkasse_ik: '107436001',
    abrechnungsmonat: '202605',
    leistungsbereich: 'B',
  },
  belege: [
    { belegnummer: '0000001', patient_nachname: 'Müller', patient_vorname: 'Hans', verordnungsdatum: '2026-05-02', brutto: 177.78 },
    { belegnummer: '0000002', patient_nachname: 'Schmidt', patient_vorname: 'Anna', verordnungsdatum: '2026-04-28', brutto:  92.72 },
  ],
});

test('begleitzettel starts with doctype', () => assert.ok(bz.startsWith('<!DOCTYPE html>')));
test('shows DTA filename', () => assert.ok(bz.includes('EHK5678900000023')));
test('shows both Belege', () => {
  assert.ok(bz.includes('Müller, Hans'));
  assert.ok(bz.includes('Schmidt, Anna'));
});
test('checklist count matches Belege length', () => assert.ok(bz.includes('Alle 2 Original-Verordnungen')));
test('totals box has brutto / zuzahlung / netto', () => {
  assert.ok(bz.includes('270,50'));
  assert.ok(bz.includes('27,05'));
  assert.ok(bz.includes('243,45'));
});
test('signature lines present', () => assert.ok(bz.includes('Unterschrift Leistungserbringer')));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
