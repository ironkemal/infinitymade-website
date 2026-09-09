import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDmrzXml } from './rechnung-dmrz.js';

const minimal = {
  invoice: { invoice_number: 'INV-2026-0001', line_items: [] },
  patient: null,
  prescription: null,
  arzt: null,
  owner: {},
};

test('buildDmrzXml: erzeugt wohlgeformten Rahmen mit Rechnungsnummer', () => {
  const xml = buildDmrzXml(minimal);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.match(xml, /<DMRZExport xmlns="https:\/\/infinitymade\.de\/dmrz\/v1"/);
  assert.match(xml, /<Rechnung nummer="INV-2026-0001">/);
  assert.match(xml, /<\/DMRZExport>/);
});

test('buildDmrzXml: maskiert Sonderzeichen, damit das XML nicht zerbricht', () => {
  const xml = buildDmrzXml({
    ...minimal,
    owner: { business_name: 'Praxis <Müller> & "Co"' },
  });
  assert.match(xml, /<Name>Praxis &lt;Müller&gt; &amp; &quot;Co&quot;<\/Name>/);
  assert.ok(!xml.includes('<Müller>'));
});

test('buildDmrzXml: Positionen werden fortlaufend nummeriert und gerechnet', () => {
  const xml = buildDmrzXml({
    ...minimal,
    invoice: {
      invoice_number: 'INV-1',
      line_items: [
        { title: 'Hornhautabtragung', quantity: 2, unit_price: 15.5 },
        { title: 'Nagelspange', quantity: 1, unit_price: 40 },
      ],
    },
  });
  assert.match(xml, /<Leistung position="1">/);
  assert.match(xml, /<Leistung position="2">/);
  assert.match(xml, /<Gesamt>31\.00<\/Gesamt>/);
  assert.match(xml, /<Gesamt>40\.00<\/Gesamt>/);
});

test('buildDmrzXml: fehlende Menge/Preis werden als 1 bzw. 0 gerechnet, nicht als NaN', () => {
  const xml = buildDmrzXml({
    ...minimal,
    invoice: { invoice_number: 'INV-1', line_items: [{ title: 'Ohne Preis' }] },
  });
  assert.match(xml, /<Anzahl>1<\/Anzahl>/);
  assert.match(xml, /<Einzelpreis>0\.00<\/Einzelpreis>/);
  assert.ok(!xml.includes('NaN'));
});

test('buildDmrzXml: Beträge immer mit zwei Nachkommastellen', () => {
  const xml = buildDmrzXml({
    ...minimal,
    invoice: { invoice_number: 'INV-1', line_items: [], subtotal: 7, total_patient: '12.5' },
  });
  assert.match(xml, /<Zwischensumme>7\.00<\/Zwischensumme>/);
  assert.match(xml, /<GesamtPatient>12\.50<\/GesamtPatient>/);
});

test('buildDmrzXml: Patientenname faellt auf title zurueck, wenn Vor-/Nachname fehlen', () => {
  const mitNamen = buildDmrzXml({ ...minimal, patient: { first_name: 'Anna', last_name: 'Berg' } });
  assert.match(mitNamen, /<Name>Anna Berg<\/Name>/);

  const nurTitle = buildDmrzXml({ ...minimal, patient: { title: 'Unbekannt' } });
  assert.match(nurTitle, /<Name>Unbekannt<\/Name>/);
});

test('buildDmrzXml: Notizen erscheinen nur, wenn vorhanden', () => {
  assert.ok(!buildDmrzXml(minimal).includes('<Notizen>'));

  const mitNotiz = buildDmrzXml({
    ...minimal,
    invoice: { invoice_number: 'INV-1', line_items: [], notes: 'Selbstzahler' },
  });
  assert.match(mitNotiz, /<Notizen>Selbstzahler<\/Notizen>/);
});

test('buildDmrzXml: Hausbesuch/Dringend werden als true/false ausgegeben, nicht als undefined', () => {
  const xml = buildDmrzXml({
    ...minimal,
    prescription: { rezept_typ: 'blanko', hausbesuch: true, is_dringend: false },
  });
  assert.match(xml, /<Verordnung typ="blanko">/);
  assert.match(xml, /<Hausbesuch>true<\/Hausbesuch>/);
  assert.match(xml, /<Dringend>false<\/Dringend>/);
  assert.ok(!xml.includes('undefined'));
});
