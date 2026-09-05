// Die Rezeptart des Termins — Weg hin und zurueck.
//
// Hintergrund: `bookings.rezeptart` wurde beim Bearbeiten eines bestehenden
// Termins bedingungslos geleert und beim Speichern als NULL zurueckgeschrieben.
// Ein als Selbstzahler angelegter Termin verlor seine Markierung, sobald
// jemand auch nur die Notiz aenderte. Diese Tests halten beide Richtungen fest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setzeRezeptartInMaske, rezeptartAusMaske } from './termin-verordnung.js';

/** Minimales DOM: nur das eine versteckte Feld, an dem alles haengt. */
function mitFeld(startwert = '') {
  const feld = { value: startwert };
  globalThis.document = { getElementById: (id) => (id === 'bkIsSelbstzahler' ? feld : null) };
  return feld;
}

test('Selbstzahler-Termin kommt als gesetzter Schalter in die Maske', () => {
  const feld = mitFeld('');
  setzeRezeptartInMaske('selbstzahler');
  assert.equal(feld.value, '1');
});

test('Kassentermin setzt den Schalter NICHT — daran haengt die Verordnungskarte', () => {
  const feld = mitFeld('1');
  setzeRezeptartInMaske('kassen');
  assert.equal(feld.value, '');
});

test('fehlende Rezeptart raeumt den Schalter des vorigen Termins weg', () => {
  const feld = mitFeld('1');
  setzeRezeptartInMaske(null);
  assert.equal(feld.value, '');
  setzeRezeptartInMaske(undefined);
  assert.equal(feld.value, '');
});

test('Rueckweg: gesetzter Schalter ergibt selbstzahler', () => {
  mitFeld('1');
  assert.equal(rezeptartAusMaske(), 'selbstzahler');
});

test('Rueckweg: leerer Schalter ergibt null, nicht den leeren String', () => {
  mitFeld('');
  assert.equal(rezeptartAusMaske(), null);
});

test('hin und zurueck aendert den Wert nicht', () => {
  mitFeld('');
  setzeRezeptartInMaske('selbstzahler');
  assert.equal(rezeptartAusMaske(), 'selbstzahler');
});

test('fehlendes Feld wirft nicht — die Maske kann geschlossen sein', () => {
  globalThis.document = { getElementById: () => null };
  assert.doesNotThrow(() => setzeRezeptartInMaske('selbstzahler'));
  assert.equal(rezeptartAusMaske(), null);
});
