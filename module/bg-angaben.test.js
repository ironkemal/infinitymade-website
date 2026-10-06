import test from 'node:test';
import assert from 'node:assert/strict';
import { BG_FELDER, bgAusWerte, bgFehltFuerRechnung, bgHinweiseBeimSpeichern, bgEmpfaengerBlock, bgAusZeile, EINVERSTAENDNIS_TEXT } from './bg-angaben.js';

const VOLL = {
  traeger_name: 'BG Holz und Metall', traeger_anschrift: 'Musterstr. 1\n12345 Musterstadt',
  unfalltag: '2026-09-15', aktenzeichen: 'AZ 1', kostenzusage_datum: '2026-09-20',
  kostenzusage_zeichen: 'KZ-7', einverstaendnis_am: '2026-09-21',
};

test('sieben Felder, Schlüssel passen zur Backend-Liste', () => {
  assert.deepEqual(BG_FELDER.map(f => f.key), [
    'traeger_name', 'traeger_anschrift', 'unfalltag', 'aktenzeichen',
    'kostenzusage_datum', 'kostenzusage_zeichen', 'einverstaendnis_am']);
});

test('bgAusWerte trimmt, leer wird null, Zeilenumbrüche der Anschrift bleiben', () => {
  const r = bgAusWerte({ traeger_name: ' BG ', traeger_anschrift: ' A\nB ', unfalltag: '', aktenzeichen: '  ' });
  assert.equal(r.traeger_name, 'BG');
  assert.equal(r.traeger_anschrift, 'A\nB');
  assert.equal(r.unfalltag, null);
  assert.equal(r.aktenzeichen, null);
  assert.equal(r.einverstaendnis_am, null);
});

test('Rechnung: Träger (Name+Anschrift) und Unfalltag sind Pflicht, Rest nicht', () => {
  assert.deepEqual(bgFehltFuerRechnung(VOLL), []);
  assert.deepEqual(bgFehltFuerRechnung({ ...VOLL, aktenzeichen: null, kostenzusage_datum: null, einverstaendnis_am: null }), []);
  assert.deepEqual(bgFehltFuerRechnung({}), ['UV-Träger (Name)', 'UV-Träger (Anschrift)', 'Unfalltag']);
  assert.deepEqual(bgFehltFuerRechnung({ ...VOLL, unfalltag: '  ' }), ['Unfalltag']);
});

test('Speichern warnt (blockiert nie): Träger, Unfalltag, Kostenzusage, Einverständnis', () => {
  assert.deepEqual(bgHinweiseBeimSpeichern(VOLL), []);
  const h = bgHinweiseBeimSpeichern({ traeger_name: 'BG' });
  assert.ok(h.includes('BG: UV-Träger (Anschrift)'));
  assert.ok(h.includes('BG: Unfalltag'));
  assert.ok(h.includes('BG: Kostenzusage (Datum)'));
  assert.ok(h.includes('BG: Einverständnis zur Übermittlung'));
  assert.ok(!h.some(x => /Aktenzeichen/.test(x)), 'Aktenzeichen ist optional');
});

test('Empfängerblock der Rechnung: Träger, Versicherte Person, Unfalltag, Aktenzeichen', () => {
  const b = bgEmpfaengerBlock(VOLL, { patientName: 'Anna Muster', geburtsdatum: '1970-03-08' });
  assert.equal(b.empfaenger[0], 'BG Holz und Metall');
  assert.deepEqual(b.empfaenger.slice(1), ['Musterstr. 1', '12345 Musterstadt']);
  assert.deepEqual(b.bezug, ['Versicherte Person: Anna Muster (geb. 08.03.1970)', 'Unfalltag: 15.09.2026', 'Aktenzeichen: AZ 1']);
});

test('Empfängerblock ohne Aktenzeichen/Geburtsdatum lässt die Zeilen weg', () => {
  const b = bgEmpfaengerBlock({ ...VOLL, aktenzeichen: null }, { patientName: 'Anna Muster' });
  assert.deepEqual(b.bezug, ['Versicherte Person: Anna Muster', 'Unfalltag: 15.09.2026']);
});

test('Einverständnis-Wortlaut ist der von legal-de (§ 100 SGB X)', () => {
  assert.match(EINVERSTAENDNIS_TEXT, /§ 100 SGB X/);
  assert.match(EINVERSTAENDNIS_TEXT, /nur privat abgerechnet/);
});

test('bgAusZeile liest die bg_*-Spalten, Datum auf 10 Zeichen, null bleibt null', () => {
  const z = bgAusZeile({ bg_traeger_name: ' BG ', bg_unfalltag: '2026-09-15T00:00:00+00', bg_aktenzeichen: null });
  assert.equal(z.traeger_name, 'BG');
  assert.equal(z.unfalltag, '2026-09-15');
  assert.equal(z.aktenzeichen, null);
  assert.equal(bgAusZeile(null).traeger_name, null);
});
