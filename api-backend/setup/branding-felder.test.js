import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brandingFelderPruefen } from './branding-felder.js';

test('leerer Rumpf: nichts zu schreiben, kein Fehler (der Schritt ist überspringbar)', () => {
  assert.deepEqual(brandingFelderPruefen({}), { felder: {}, fehler: [] });
  assert.deepEqual(brandingFelderPruefen(null), { felder: {}, fehler: [] });
  assert.deepEqual(brandingFelderPruefen({ street: '  ', plz: '' }), { felder: {}, fehler: [] });
});

test('gültige Angaben werden getrimmt und normalisiert (IBAN ohne Leerzeichen, groß)', () => {
  const r = brandingFelderPruefen({
    street: ' Hauptstr. 5 ', plz: '53721', city: 'Siegburg', phone: '02241 1',
    steuernummer: '220/5070/0815', ust_id: 'de123456789', tax_exempt_note: 'Umsatzsteuerfrei nach § 4 Nr. 14 UStG',
    iban: 'de02 1203 0000 0000 2020 51', bic: 'byladem1001', bank_name: 'Bank', ik_number: '123456789',
  });
  assert.deepEqual(r.fehler, []);
  assert.equal(r.felder.street, 'Hauptstr. 5');
  assert.equal(r.felder.iban, 'DE02120300000000202051');
  assert.equal(r.felder.bic, 'BYLADEM1001');
  assert.equal(r.felder.ust_id, 'DE123456789');
  assert.equal(r.felder.ik_number, '123456789');
});

test('ungültige Angaben: deutsche Fehler je Feld, nichts davon wird geschrieben', () => {
  const r = brandingFelderPruefen({ plz: '123', iban: 'XYZ', bic: '1', ik_number: '12', ust_id: 'abc', street: 'x'.repeat(200) });
  assert.equal(r.fehler.length, 6);
  assert.match(r.fehler.join(' | '), /Postleitzahl/);
  assert.match(r.fehler.join(' | '), /IBAN/);
  assert.match(r.fehler.join(' | '), /BIC/);
  assert.match(r.fehler.join(' | '), /Institutionskennzeichen/);
  assert.match(r.fehler.join(' | '), /USt-IdNr/);
  assert.match(r.fehler.join(' | '), /Straße/);
  assert.deepEqual(r.felder, {});
});

test('unbekannte Schlüssel werden verworfen (Whitelist, kein Mass-Assignment)', () => {
  const r = brandingFelderPruefen({ city: 'Köln', plan: 'enterprise', role: 'admin', owner_id: 'x', business_name: 'Fremd' });
  assert.deepEqual(r.felder, { city: 'Köln' });
});

test('Nicht-Strings werden nicht als Text durchgereicht', () => {
  const r = brandingFelderPruefen({ city: { $ne: 1 }, phone: ['1'], plz: 53721 });
  assert.deepEqual(r.felder, {});
  assert.ok(r.fehler.length >= 1);
});
