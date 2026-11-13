// Wortlaut und Reihenfolge von „Zu erledigen“ auf dem neuen Start (Redesign V6.F01, 13.11.2026).
// Warum festgeschrieben: gkv-302 und podoloji haben den alten Text „Verordnung überfällig /
// Gültigkeit abgelaufen“ als irreführend eingestuft; die Quelle `gueltig_bis` ist je
// Speicherweg verschieden. Der Test verhindert, dass der Text unbemerkt zurückkommt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zuErledigen } from './startseite-darstellung.js';

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
