import test from 'node:test';
import assert from 'node:assert/strict';
import { BG_FELDER, bgAusWerte, bgFehltFuerRechnung, bgHinweiseBeimSpeichern, bgEmpfaengerBlock, bgAusZeile, bgKostenzusageHinweis, bgHinweiseBeiRechnung, bgAusMaske, EINVERSTAENDNIS_VERSION, EINVERSTAENDNIS_TEXT } from './bg-angaben.js';

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

test('Kostenzusage-Hinweis: nur bei BG ohne Datum, sonst null', () => {
  assert.match(bgKostenzusageHinweis({ rezeptart: 'bg' }), /Kostenzusage der BG fehlt/);
  assert.match(bgKostenzusageHinweis({ rezeptart: 'bg', bg_kostenzusage_datum: '  ' }), /vor der Behandlung/);
  assert.equal(bgKostenzusageHinweis({ rezeptart: 'bg', bg_kostenzusage_datum: '2026-09-20' }), null);
  assert.equal(bgKostenzusageHinweis({ rezeptart: 'privat' }), null);
  assert.equal(bgKostenzusageHinweis({}), null);
  assert.equal(bgKostenzusageHinweis(null), null);
});

test('Rechnungs-Hinweise (nicht blockierend): Einverständnis und Kostenzusage', () => {
  assert.deepEqual(bgHinweiseBeiRechnung(VOLL), []);
  assert.deepEqual(bgHinweiseBeiRechnung({ ...VOLL, einverstaendnis_am: null }), ['Einverständnis zur Übermittlung an den UV-Träger nicht erfasst']);
  assert.equal(bgHinweiseBeiRechnung({}).length, 2);
});

test('bgAusMaske: Version des Wortlauts nur zusammen mit dem Einverständnis-Datum', () => {
  const doc = (werte) => ({ getElementById: (id) => ({ value: werte[id] ?? '' }) });
  const mit = bgAusMaske(doc({ rzBgEinverstaendnis: '2026-09-21' }));
  assert.equal(mit.einverstaendnis_version, EINVERSTAENDNIS_VERSION);
  assert.match(EINVERSTAENDNIS_VERSION, /^bg-einverstaendnis-v1-/);
  assert.equal(bgAusMaske(doc({})).einverstaendnis_version, null);
});
