// Wortlaut und Reihenfolge von „Zu erledigen“ auf dem neuen Start (Redesign V6.F01, 13.11.2026).
// Warum festgeschrieben: gkv-302 und podoloji haben den alten Text „Verordnung überfällig /
// Gültigkeit abgelaufen“ als irreführend eingestuft; die Quelle `gueltig_bis` ist je
// Speicherweg verschieden. Der Test verhindert, dass der Text unbemerkt zurückkommt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zuErledigen, nutzbareLuecken } from './startseite-darstellung.js';

// Freie Zeit (V6.F03): Uhr 10:15 = 615 Minuten.
test('nutzbareLuecken: vergangen weg, laufend ab jetzt, unter 30 Min weg', () => {
  const r = nutzbareLuecken([
    { start: '08:45', end: '09:00' }, { start: '09:30', end: '09:45' }, // vergangen
    { start: '10:10', end: '10:30' },                                   // läuft, Rest 15 → zu kurz
    { start: '10:00', end: '11:00' },                                   // läuft, Rest 45
    { start: '11:25', end: '13:00' }, { start: '13:00', end: '13:20' }, // 95 / 20 → zu kurz
  ], { jetztMin: 615 });
  assert.deepEqual(r.liste, [{ start: '10:15', end: '11:00', dauer: 45 }, { start: '11:25', end: '13:00', dauer: 95 }]);
  assert.equal(r.summeMin, 140);
});

test('nutzbareLuecken: ohne Uhr nur Mindestdauer; kaputte Zeiten werden ignoriert', () => {
  assert.deepEqual(nutzbareLuecken([{ start: '9:00', end: '9:30' }, { start: 'x', end: '10:00' }, { start: '12:00', end: '11:00' }]).liste,
    [{ start: '09:00', end: '09:30', dauer: 30 }]);
  assert.deepEqual(nutzbareLuecken(null), { liste: [], summeMin: 0 });
  assert.equal(nutzbareLuecken([{ start: '08:00', end: '08:20' }], { minDauer: 15 }).liste.length, 1);
});

test('Beginnfrist-Zeilen neutral beschriftet, dringend zuerst', () => {
  const z = zuErledigen({ anfragen: 3, voUeberfaellig: 1, voBald: 2 });
  assert.deepEqual(z.map(x => x.id), ['vo-ueberfaellig', 'vo-bald', 'anfragen']);
  assert.equal(z[0].titel, 'Beginnfrist überschritten');
  assert.equal(z[0].text, 'Behandlungsbeginn prüfen');
  assert.equal(z[1].titel, 'Beginnfrist endet');
  for (const zeile of z) assert.doesNotMatch(`${zeile.titel} ${zeile.text}`, /Gültigkeit|überfällig|läuft ab/);
});

test('null/0 erzeugen keine Zeile', () => {
  assert.deepEqual(zuErledigen({ anfragen: 0, voUeberfaellig: null, voBald: undefined }), []);
  assert.deepEqual(zuErledigen(), []);
});
