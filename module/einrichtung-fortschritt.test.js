import test from 'node:test';
import assert from 'node:assert/strict';
import { einrichtungFortschritt, ringStrich } from './einrichtung-fortschritt.js';

const VOLL = {
  business_name: 'Praxis Nord', owner_first_name: 'Erika', owner_last_name: 'Muster', street: 'Weg 1', plz: '53721', city: 'Siegburg',
  phone: '1', ik_number: '123456789', iban: 'DE02', steuernummer: '1/2/3', tax_exempt_note: '§ 4 Nr. 14 UStG',
};

test('leeres Profil: 0 %, alles fehlt, Pflicht vor Soll', () => {
  const r = einrichtungFortschritt({});
  assert.equal(r.prozent, 0);
  assert.equal(r.fehlend.length, 8);
  assert.deepEqual(r.fehlend.slice(0, 5).map(x => x.stufe), Array(5).fill('pflicht'));
  assert.deepEqual(r.fehlend.slice(5).map(x => x.stufe), Array(3).fill('soll'));
});

test('volles Profil: 100 %, nichts fehlt', () => {
  const r = einrichtungFortschritt(VOLL);
  assert.equal(r.prozent, 100);
  assert.deepEqual(r.fehlend, []);
});

test('Pflicht zählt doppelt: nur Praxisname fehlt = 85 %, nur Telefon fehlt = 92 %', () => {
  assert.equal(einrichtungFortschritt({ ...VOLL, business_name: '' }).prozent, 85);
  assert.equal(einrichtungFortschritt({ ...VOLL, phone: '' }).prozent, 92);
});

test('nie falsche 100 %: eine Lücke deckelt bei 99 (auch wenn Rundung 100 ergäbe)', () => {
  const r = einrichtungFortschritt({ ...VOLL, ik_number: '' });
  assert.ok(r.prozent < 100);
  assert.equal(r.fehlend.length, 1);
});

test('nur Leerzeichen zählt als leer', () => {
  const r = einrichtungFortschritt({ ...VOLL, iban: '   ', city: '  ' });
  assert.deepEqual(r.fehlend.map(x => x.schluessel), ['anschrift', 'bank']);
  assert.ok(r.prozent < 100);
});

test('Optik (Logo/Stempel/Fußzeile) zählt nicht in den Ring', () => {
  const r = einrichtungFortschritt(VOLL);   // ohne Logo/Stempel/Fußzeile
  assert.equal(r.prozent, 100);
});

test('jede Lücke hat Beschriftung und Ziel-Abschnitt (Klick springt dorthin)', () => {
  for (const x of einrichtungFortschritt({}).fehlend) {
    assert.ok(x.label && /^settings[A-Za-z]+Section$/.test(x.zielAnsicht), JSON.stringify(x));
  }
});

test('null/undefined werfen nicht', () => {
  assert.equal(einrichtungFortschritt(null).prozent, 0);
  assert.equal(einrichtungFortschritt(undefined).fehlend.length, 8);
});

test('ringStrich: Umfang und Versatz für den SVG-Ring, begrenzt auf 0..100', () => {
  const u = 2 * Math.PI * 15;
  assert.ok(Math.abs(ringStrich(0, 15).umfang - u) < 1e-9);
  assert.equal(ringStrich(0, 15).versatz, ringStrich(0, 15).umfang);
  assert.ok(Math.abs(ringStrich(100, 15).versatz) < 1e-9);
  assert.ok(Math.abs(ringStrich(50, 15).versatz - u / 2) < 1e-9);
  assert.equal(ringStrich(-5, 15).versatz, ringStrich(0, 15).versatz);
  assert.ok(Math.abs(ringStrich(500, 15).versatz) < 1e-9);
});
