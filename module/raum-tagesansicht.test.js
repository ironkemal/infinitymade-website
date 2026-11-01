import test from 'node:test';
import assert from 'node:assert/strict';
import { spurenVerteilen, spaltenModell, spaltenKopf, blockGeometrie, OHNE_RAUM_ID } from './raum-tagesansicht.js';

const t = (id, room, von, bis, extra = {}) => ({
  id, room_id: room, status: 'confirmed', customer_name: `Patient ${id}`,
  start_time: `2026-11-02T${von}:00`, end_time: `2026-11-02T${bis}:00`, ...extra,
});

test('Spuren: hintereinander bleibt eine Spur', () => {
  const e = spurenVerteilen([t('a', 'r', '09:00', '09:30'), t('b', 'r', '09:30', '10:00')]);
  assert.deepEqual(e.map(x => [x.spur, x.spuren]), [[0, 1], [0, 1]]);
});

test('Spuren: Überschneidung ergibt zwei Spuren für beide', () => {
  const e = spurenVerteilen([t('a', 'r', '09:00', '10:00'), t('b', 'r', '09:30', '10:30')]);
  assert.deepEqual(e.map(x => [x.termin.id, x.spur, x.spuren, x.gleichzeitig]), [['a', 0, 2, 2], ['b', 1, 2, 2]]);
});

test('Spuren: spätere Gruppe fängt wieder bei einer Spur an', () => {
  const e = spurenVerteilen([t('a', 'r', '09:00', '10:00'), t('b', 'r', '09:30', '10:30'), t('c', 'r', '11:00', '11:30')]);
  assert.deepEqual(e.map(x => x.spuren), [2, 2, 1]);
});

test('Spaltenmodell: eine Spalte je Raum in Reihenfolge, Termine nach room_id', () => {
  const raeume = [{ id: 'r1', name: 'Raum 1', plaetze: 1 }, { id: 'r2', name: 'Wärme', plaetze: 2 }];
  const m = spaltenModell(raeume, [t('a', 'r1', '09:00', '09:30'), t('b', 'r2', '09:00', '09:30')]);
  assert.deepEqual(m.spalten.map(s => [s.id, s.eintraege.length]), [['r1', 1], ['r2', 1]]);
});

test('Spaltenmodell: Ohne-Raum-Spalte nur, wenn es solche Termine gibt', () => {
  const raeume = [{ id: 'r1', name: 'Raum 1', plaetze: 1 }];
  assert.equal(spaltenModell(raeume, [t('a', 'r1', '09:00', '09:30')]).spalten.length, 1);
  const m = spaltenModell(raeume, [t('a', null, '09:00', '09:30'), t('b', 'unbekannt', '10:00', '10:30')]);
  const lose = m.spalten.at(-1);
  assert.equal(lose.id, OHNE_RAUM_ID);
  assert.equal(lose.name, 'Ohne Raum');
  assert.equal(lose.eintraege.length, 2);
});

test('Spaltenmodell: abgesagte Termine und Gruppenkinder zählen nicht', () => {
  const raeume = [{ id: 'r1', name: 'Raum 1', plaetze: 1 }];
  const m = spaltenModell(raeume, [t('a', 'r1', '09:00', '09:30', { status: 'cancelled' }), t('b', 'r1', '09:00', '09:30', { group_parent_id: 'x' }), t('c', 'r1', '10:00', '10:30')]);
  assert.deepEqual(m.spalten[0].eintraege.map(e => e.termin.id), ['c']);
});

test('Plätze: zwei Termine bei 2 Plätzen stehen nebeneinander ohne Überbelegung', () => {
  const m = spaltenModell([{ id: 'w', name: 'Wärme', plaetze: 2 }], [t('a', 'w', '09:00', '09:30'), t('b', 'w', '09:00', '09:30')]);
  assert.deepEqual(m.spalten[0].eintraege.map(e => [e.spur, e.spuren, e.ueberbelegt]), [[0, 2, false], [1, 2, false]]);
  assert.equal(m.spalten[0].ueberbelegt, false);
});

test('Überschneidung bei 1 Platz: beide nebeneinander, nur als Hinweis markiert', () => {
  const m = spaltenModell([{ id: 'r', name: 'Raum', plaetze: 1 }], [t('a', 'r', '09:00', '09:30'), t('b', 'r', '09:15', '09:45')]);
  assert.equal(m.spalten[0].eintraege.length, 2);
  assert.ok(m.spalten[0].eintraege.every(e => e.ueberbelegt));
  assert.equal(m.spalten[0].ueberbelegt, true);
});

test('Spaltenkopf nennt Plätze erst ab zwei', () => {
  assert.equal(spaltenKopf({ name: 'Raum 1', plaetze: 1 }), 'Raum 1');
  assert.equal(spaltenKopf({ name: 'Wärme', plaetze: 2 }), 'Wärme (2 Plätze)');
  assert.equal(spaltenKopf({ name: 'Ohne Raum', plaetze: 1, ohneRaum: true }), 'Ohne Raum');
});

test('Blockgeometrie: Position, Höhe und Spurbreite', () => {
  const e = spurenVerteilen([t('a', 'r', '09:00', '10:00'), t('b', 'r', '09:30', '10:30')]);
  const g = blockGeometrie(e[1], 8);
  assert.equal(g.top, (90 / 30) * 56);
  assert.equal(g.hoehe, 2 * 56);
  assert.equal(g.breite, 50);
  assert.equal(g.links, 50);
});

test('Keine Räume: leeres Modell, keine Spalten', () => {
  assert.deepEqual(spaltenModell([], []).spalten, []);
  assert.deepEqual(spaltenModell(undefined, undefined).spalten, []);
});
