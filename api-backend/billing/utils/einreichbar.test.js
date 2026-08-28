// Regression zu 28.08.2026: derselbe Fall zweimal bei der Kasse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERORDNUNG_EINREICHBAR, istEinreichbar, einreichbarFilter } from './einreichbar.js';

test('bereits eingereichte Verordnung darf nicht noch einmal', () => {
  assert.equal(istEinreichbar('abgerechnet'), false);
});

test('abgeschlossene Zustaende sind gesperrt', () => {
  assert.equal(istEinreichbar('storniert'), false);
  assert.equal(istEinreichbar('archiviert'), false);
});

test('laufende Verordnung darf eingereicht werden', () => {
  assert.equal(istEinreichbar('aktiv'), true);
  assert.equal(istEinreichbar('abrechenbar'), true);
});

test('Korrekturweg nach Kassenrueckmeldung bleibt offen', () => {
  // Absetzung heisst: Geld ist nicht gekommen. Wer hier sperrt, sperrt die
  // Nachforderung aus — genau der stille Einnahmeverlust, den die Arbeitsliste
  // sichtbar machen soll.
  assert.equal(istEinreichbar('abgesetzt'), true);
  assert.equal(istEinreichbar('teilabsetzung'), true);
});

test('fehlender Status zaehlt als laufend, nicht als eingereicht', () => {
  // verordnungen.status ist nullable. Eine alte Zeile ohne Wert darf nicht
  // an der Abrechnung scheitern.
  assert.equal(istEinreichbar(null), true);
  assert.equal(istEinreichbar(undefined), true);
  assert.equal(istEinreichbar(''), true);
});

test('unbekannter Status wird nicht durchgewunken', () => {
  assert.equal(istEinreichbar('irgendwas'), false);
});

test('Filter deckt dieselbe Menge ab und faengt NULL mit', () => {
  const f = einreichbarFilter();
  for (const s of VERORDNUNG_EINREICHBAR) assert.ok(f.includes(s), `${s} fehlt im Filter`);
  assert.ok(f.includes('status.is.null'), 'NULL-Zeilen wuerden ein falsches 409 ausloesen');
  assert.ok(!f.includes('abgerechnet'), 'abgerechnet darf im Anspruch-Filter nicht vorkommen');
});
