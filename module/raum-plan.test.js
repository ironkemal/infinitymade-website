import test from 'node:test';
import assert from 'node:assert/strict';
import {
  raumName, raumPlaetze, raumNameFrei, raeumeDesStandorts, terminZaehlt, belegungen, raumKonflikt, raumAuswahl, belegungJetzt,
} from './raum-plan.js';

const termin = (id, von, bis, extra = {}) => ({
  id, room_id: 'R', status: 'confirmed', group_parent_id: null,
  start_time: `2026-11-02T${von}:00Z`, end_time: `2026-11-02T${bis}:00Z`, ...extra,
});
const R = { id: 'R', name: 'Raum 1', plaetze: 1, business_id: 'A' };
const start = '2026-11-02T09:15:00Z';
const ende = '2026-11-02T09:45:00Z';

test('Raumname wird bereinigt und begrenzt', () => {
  assert.equal(raumName('  Behandlungs   raum  '), 'Behandlungs raum');
  assert.throws(() => raumName(' '), /1–80/);
  assert.throws(() => raumName('x'.repeat(81)), /1–80/);
});

test('Plätze: leer ist 1, Unsinn wird abgewiesen', () => {
  assert.equal(raumPlaetze(''), 1);
  assert.equal(raumPlaetze('3'), 3);
  for (const falsch of [0, 100, 1.5, 'zwei']) assert.throws(() => raumPlaetze(falsch), /1–99/);
});

test('Name je Standort eindeutig, Umbenennen in sich selbst ist erlaubt', () => {
  const raeume = [{ id: 'R', name: 'Raum 1', business_id: 'A' }];
  assert.equal(raumNameFrei(raeume, 'raum 1', { businessId: 'A' }), false);
  assert.equal(raumNameFrei(raeume, 'raum 1', { businessId: 'B' }), true);
  assert.equal(raumNameFrei(raeume, 'RAUM 1', { id: 'R', businessId: 'A' }), true);
});

test('Standortliste zeigt nur aktive Räume des Standorts, sortiert', () => {
  const raeume = [
    { id: '1', name: 'Zeta', sort: 0, business_id: 'A' },
    { id: '2', name: 'Alpha', sort: 0, business_id: 'A' },
    { id: '3', name: 'Beta', sort: 0, business_id: 'B' },
    { id: '4', name: 'Aus', sort: 0, business_id: 'A', aktiv: false },
  ];
  assert.deepEqual(raeumeDesStandorts(raeume, 'A').map(r => r.name), ['Alpha', 'Zeta']);
  assert.equal(raeumeDesStandorts(raeume, null).length, 3);
});

test('Abgesagt, nicht erschienen und Gruppen-Kinder belegen nicht', () => {
  assert.equal(terminZaehlt(termin('a', '09:00', '09:30')), true);
  assert.equal(terminZaehlt(termin('a', '09:00', '09:30', { status: 'cancelled' })), false);
  assert.equal(terminZaehlt(termin('a', '09:00', '09:30', { status: 'no_show' })), false);
  assert.equal(terminZaehlt(termin('a', '09:00', '09:30', { group_parent_id: 'p' })), false);
  assert.equal(terminZaehlt({ ...termin('a', '09:00', '09:30'), end_time: 'kaputt' }), false);
});

test('Überschneidung erkannt, direkt angrenzend ist frei', () => {
  const termine = [termin('a', '09:00', '09:30')];
  assert.equal(raumKonflikt(R, termine, start, ende).voll, true);
  assert.equal(raumKonflikt(R, termine, '2026-11-02T09:30:00Z', '2026-11-02T10:00:00Z').voll, false);
  assert.equal(raumKonflikt(R, termine, '2026-11-02T08:30:00Z', '2026-11-02T09:00:00Z').voll, false);
});

test('Bearbeiten ignoriert den eigenen Termin', () => {
  const termine = [termin('a', '09:00', '09:30')];
  assert.equal(raumKonflikt(R, termine, start, ende, { ohneTerminId: 'a' }).voll, false);
});

test('Plätze: Wärmeraum warnt erst, wenn alle belegt sind', () => {
  const waerme = { ...R, plaetze: 2 };
  const termine = [termin('a', '09:00', '09:30')];
  assert.equal(raumKonflikt(waerme, termine, start, ende).voll, false);
  assert.equal(raumKonflikt(waerme, [...termine, termin('b', '09:10', '09:40')], start, ende).voll, true);
});

test('Termine anderer Räume stören nicht', () => {
  assert.equal(belegungen('R', [termin('a', '09:00', '09:30', { room_id: 'S' })], start, ende).length, 0);
});

test('Raumauswahl stellt freie Räume nach vorn', () => {
  const S = { id: 'S', name: 'Raum 2', plaetze: 1 };
  const auswahl = raumAuswahl([R, S], [termin('a', '09:00', '09:30')], start, ende);
  assert.deepEqual(auswahl.map(a => [a.raum.id, a.voll, a.belegt]), [['S', false, 0], ['R', true, 1]]);
});

test('Belegung jetzt: Rest in Minuten und Termine ohne Raum werden gezählt', () => {
  const S = { id: 'S', name: 'Raum 2', plaetze: 1 };
  const termine = [
    termin('a', '09:00', '09:30'),
    termin('b', '09:00', '09:40', { room_id: null }),
    termin('c', '09:00', '09:50', { room_id: 'weg' }),
    termin('d', '10:00', '10:30'),
  ];
  const stand = belegungJetzt([R, S], termine, '2026-11-02T09:20:00Z');
  assert.equal(stand.raeume[0].voll, true);
  assert.equal(stand.raeume[0].restMinuten, 10);
  assert.equal(stand.raeume[1].voll, false);
  assert.equal(stand.raeume[1].restMinuten, 0);
  assert.equal(stand.ohneRaum, 2);
});

test('Belegung jetzt: Terminende zählt nicht mehr, Terminbeginn schon', () => {
  const termine = [termin('a', '09:00', '09:30')];
  assert.equal(belegungJetzt([R], termine, '2026-11-02T09:30:00Z').raeume[0].voll, false);
  assert.equal(belegungJetzt([R], termine, '2026-11-02T09:00:00Z').raeume[0].voll, true);
});
