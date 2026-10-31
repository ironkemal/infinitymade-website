import test from 'node:test';
import assert from 'node:assert/strict';
import {
  optionenFuerAuswahl, felderAusWahl, ladeRaumliste, ladeBelegungen, raumWarnung, raumFelder, terminWarnungen, tagesgrenzen,
} from './raum-auswahl.js';

const raeume = [
  { id: 'R', name: 'Raum 1', plaetze: 1, business_id: 'B' },
  { id: 'W', name: 'Wärme', plaetze: 2, business_id: 'B' },
  { id: 'E', name: 'Einzelpraxis', plaetze: 1, business_id: null },
];
const termine = [
  { id: 'a', room_id: 'R', status: 'confirmed', start_time: '2026-11-02T09:00:00Z', end_time: '2026-11-02T09:30:00Z' },
  { id: 'b', room_id: 'W', status: 'confirmed', start_time: '2026-11-02T09:00:00Z', end_time: '2026-11-02T09:30:00Z' },
];
const start = '2026-11-02T09:10:00Z';
const ende = '2026-11-02T09:40:00Z';

test('Optionen: „Kein Raum" zuerst, freie vor belegten, Plätze im Text', () => {
  const optionen = optionenFuerAuswahl(raeume, termine, start, ende);
  assert.equal(optionen[0].text, 'Kein Raum');
  assert.deepEqual(optionen.slice(1).map(o => o.text), ['Wärme (1 von 2 Plätzen belegt)', 'Einzelpraxis', 'Raum 1 (belegt)']);
});

test('Optionen ohne Zeit zeigen nur die Namen', () => {
  assert.deepEqual(optionenFuerAuswahl(raeume, termine, null, null).map(o => o.text), ['Kein Raum', 'Raum 1', 'Wärme', 'Einzelpraxis']);
});

test('Der eigene Termin blockiert seinen Raum beim Bearbeiten nicht', () => {
  const optionen = optionenFuerAuswahl([raeume[0]], termine, start, ende, { ohneTerminId: 'a' });
  assert.equal(optionen[1].text, 'Raum 1');
});

test('Der Raum bestimmt den Standort des Termins', () => {
  assert.deepEqual(felderAusWahl('R', raeume), { room_id: 'R', business_id: 'B' });
});

test('Raum ohne Standort setzt keinen Standort', () => {
  assert.deepEqual(felderAusWahl('E', raeume), { room_id: 'E' });
});

test('„Kein Raum" leert den Raum, unbekannter Raum fasst nichts an', () => {
  assert.deepEqual(felderAusWahl('', raeume), { room_id: null });
  assert.deepEqual(felderAusWahl('weg', raeume), {});
});

test('Warnung nennt den Raum, sonst null', () => {
  assert.match(raumWarnung(raeume[0], termine, start, ende), /Raum „Raum 1" ist zu dieser Zeit belegt/);
  assert.equal(raumWarnung(raeume[1], termine, start, ende), null);
  assert.equal(raumWarnung(undefined, termine, start, ende), null);
});

test('Lesefehler führen zu leerer Liste, nie zu einer Ausnahme', async () => {
  const kaputt = { from() { throw new Error('Tabelle fehlt'); } };
  assert.deepEqual(await ladeRaumliste(kaputt, 'O'), []);
  assert.deepEqual(await ladeBelegungen(kaputt, 'O', 'a', 'b'), []);
  const fehler = { from: () => ({ select: () => ({ eq: async () => ({ data: null, error: { code: '42P01' } }) }) }) };
  assert.deepEqual(await ladeRaumliste(fehler, 'O'), []);
});

test('Ohne verdrahtetes Modul bleibt alles beim Alten', async () => {
  assert.deepEqual(raumFelder(), {});
  assert.equal(await terminWarnungen({ empId: 'x', startIso: start, endIso: ende }), true);
});

test('Tagesgrenzen umfassen den ganzen lokalen Tag', () => {
  const { vonISO, bisISO } = tagesgrenzen('2026-11-02T09:10:00Z');
  assert.ok(Date.parse(vonISO) <= Date.parse('2026-11-02T09:10:00Z'));
  assert.ok(Date.parse(bisISO) >= Date.parse('2026-11-02T09:10:00Z'));
  assert.ok(Date.parse(bisISO) - Date.parse(vonISO) < 864e5);
});
