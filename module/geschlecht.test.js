/**
 * Tests für module/geschlecht.js.
 *
 * Der Kern ist `normalisiereGeschlecht()`: jeder Schreibpfad auf
 * `leads.geschlecht` geht dort durch, und die Spalte trägt einen CHECK auf
 * m/f/d. Was diese Funktion durchlässt, muss den CHECK überleben — sonst
 * scheitert das Anlegen eines Patienten, und zwar erst in der Produktion.
 * Genau das ist am 16.08.2026 an zwei Stellen passiert.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GESCHLECHT_CODES,
  normalisiereGeschlecht,
  geschlechtLabel,
  anredeFuerGeschlecht,
  geschlechtOptionenHtml,
} from './geschlecht.js';

test('gibt nur Werte zurück, die der CHECK erlaubt', () => {
  const eingaben = [
    'm', 'f', 'd', 'w', 'W', 'M', 'weiblich', 'männlich', 'divers', 'MÄNNLICH',
    'female', 'male', 'other', 'x', 'Frau', 'Herr', '1', '2', '3', ' f ',
    null, undefined, '', '   ', 'quatsch', 0, 42, {}, [],
  ];
  for (const e of eingaben) {
    const r = normalisiereGeschlecht(e);
    assert.ok(r === null || GESCHLECHT_CODES.includes(r),
      `${JSON.stringify(e)} ergab ${JSON.stringify(r)} — das verletzt den CHECK`);
  }
});

test('„w" ist weiblich — der Fehler aus der Rezept-OCR', () => {
  // Die OCR lieferte deutsch gedacht "w"; die Spalte kennt nur "f".
  assert.equal(normalisiereGeschlecht('w'), 'f');
  assert.equal(normalisiereGeschlecht('W'), 'f');
});

test('ausgeschriebene Wörter — der Fehler aus der Schnellanlage', () => {
  assert.equal(normalisiereGeschlecht('männlich'), 'm');
  assert.equal(normalisiereGeschlecht('weiblich'), 'f');
  assert.equal(normalisiereGeschlecht('divers'), 'd');
  // Ohne Umlaut geschrieben kommt dasselbe heraus.
  assert.equal(normalisiereGeschlecht('maennlich'), 'm');
});

test('kanonische Werte bleiben unverändert', () => {
  assert.equal(normalisiereGeschlecht('m'), 'm');
  assert.equal(normalisiereGeschlecht('f'), 'f');
  assert.equal(normalisiereGeschlecht('d'), 'd');
});

test('keine Angabe bleibt null und ist kein Fehler', () => {
  assert.equal(normalisiereGeschlecht(null), null);
  assert.equal(normalisiereGeschlecht(undefined), null);
  assert.equal(normalisiereGeschlecht(''), null);
  assert.equal(normalisiereGeschlecht('   '), null);
});

test('Unbekanntes wird null, nicht durchgereicht', () => {
  // Lieber keine Angabe als ein Wert, der den INSERT sprengt.
  assert.equal(normalisiereGeschlecht('quatsch'), null);
  assert.equal(normalisiereGeschlecht('unbekannt'), null);
});

test('Beschriftung', () => {
  assert.equal(geschlechtLabel('m'), 'männlich');
  assert.equal(geschlechtLabel('w'), 'weiblich');   // toleriert Altwerte
  assert.equal(geschlechtLabel('d'), 'divers');
  assert.equal(geschlechtLabel(null), '—');
  assert.equal(geschlechtLabel(null, ''), '');
});

test('Briefanrede — divers und leer bekommen keine', () => {
  assert.equal(anredeFuerGeschlecht('f'), 'Frau');
  assert.equal(anredeFuerGeschlecht('weiblich'), 'Frau');
  assert.equal(anredeFuerGeschlecht('m'), 'Herr');
  // Für „divers" gibt es keine etablierte Briefanrede — der Zettel weicht auf
  // die neutrale Begrüßung aus, statt jemanden falsch anzureden.
  assert.equal(anredeFuerGeschlecht('d'), '');
  assert.equal(anredeFuerGeschlecht(null), '');
});

test('Auswahlfeld bietet genau die erlaubten Werte an', () => {
  const html = geschlechtOptionenHtml();
  const werte = [...html.matchAll(/value="([^"]*)"/g)].map(m => m[1]);
  assert.deepEqual(werte, ['', ...GESCHLECHT_CODES]);
});

test('Auswahlfeld markiert den vorhandenen Wert — auch einen Altwert', () => {
  assert.match(geschlechtOptionenHtml('f'), /value="f" selected/);
  assert.match(geschlechtOptionenHtml('weiblich'), /value="f" selected/);
  assert.doesNotMatch(geschlechtOptionenHtml(''), /selected/);
});
