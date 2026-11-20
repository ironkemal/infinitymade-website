import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  tageszeitGruss,
  dauerKurzText,
  buchungenFuerTagAufbereiten,
  lueckenFiltern,
  zeitleisteZusammenfuehren,
  handlungsbedarfZusammenfassen,
} from './tageszentrale-logik.js';

test('tageszeitGruss wählt Morgen, Tag und Abend korrekt in Europe/Berlin', () => {
  assert.equal(tageszeitGruss(new Date('2026-11-20T08:15:00+01:00')), 'Guten Morgen');
  assert.equal(tageszeitGruss(new Date('2026-11-20T13:00:00+01:00')), 'Guten Tag');
  assert.equal(tageszeitGruss(new Date('2026-11-20T20:47:00+01:00')), 'Guten Abend');
  assert.equal(dauerKurzText(225), '3 h 45 min');
  assert.equal(dauerKurzText(60), '1 h');
  assert.equal(dauerKurzText(45), '45 min');
});

test('buchungenFuerTagAufbereiten erkennt laufenden und nächsten Termin, Fortschritt und Hausbesuche', () => {
  const jetzt = new Date('2026-11-20T09:42:00+01:00');
  const teamMap = new Map([['u1', 'Melih'], ['u2', 'Laura']]);
  const bookings = [
    { id: 'b1', user_id: 'u1', start_time: '2026-11-20T08:30:00+01:00', end_time: '2026-11-20T09:00:00+01:00', customer_name: 'Lukas Berger · 1951-03-14', status: 'completed', services: { title: 'KG' }, prescription_sessions: [{ id: 's6', session_number: 6, prescriptions: { anzahl_einheiten: 6, diagnosegruppe: 'WS2' } }] },
    { id: 'b2', user_id: 'u1', start_time: '2026-11-20T09:30:00+01:00', end_time: '2026-11-20T10:00:00+01:00', customer_name: 'Änne Größer', status: 'confirmed', services: { title: 'KG-ZNS' }, prescriptions: { anzahl_einheiten: 6, diagnosegruppe: 'ZN2', prescription_sessions: [{ status: 'done' }, { status: 'done' }] } },
    { id: 'b3', user_id: 'u2', start_time: '2026-11-20T10:00:00+01:00', end_time: '2026-11-20T10:30:00+01:00', customer_name: 'Bernd Weber', status: 'confirmed', hausbesuch: true, services: { title: 'MT' } },
    { id: 'b4', user_id: 'u1', start_time: '2026-11-20T11:00:00+01:00', end_time: '2026-11-20T11:30:00+01:00', customer_name: 'Abgesagt', status: 'cancelled' },
    { id: 'b5', user_id: 'u1', start_time: '2026-11-20T09:30:00+01:00', end_time: '2026-11-20T10:00:00+01:00', customer_name: 'Gruppenkind', group_parent_id: 'b2', status: 'confirmed' },
  ];

  const erg = buchungenFuerTagAufbereiten(bookings, { heuteIso: '2026-11-20', zielIso: '2026-11-20', jetzt, teamMap, istOwner: true });
  assert.equal(erg.gesamt, 3);
  assert.equal(erg.alle[0].patient, 'Lukas Berger');
  assert.equal(erg.alle[0].vo, 'WS2 · VO 6/6');
  assert.equal(erg.erledigt, 1);
  assert.equal(erg.offen, 2);
  assert.equal(erg.hausbesuche, 1);
  assert.equal(erg.prozent, 33);
  assert.equal(erg.aktuell?.id, 'b2');
  assert.equal(erg.aktuell?.restMin, 18);
  assert.equal(erg.aktuell?.vo, 'ZN2 · VO 2/6');
  assert.equal(erg.naechster?.id, 'b3');
  assert.equal(erg.naechster?.inMin, 18);
  assert.equal(erg.behandlerChips.length, 2);
});

test('lueckenFiltern schneidet vergangene Minuten heute ab und filtert Mini-Lücken (<15 Min)', () => {
  const jetzt = new Date('2026-11-20T09:42:00+01:00');
  const erg = lueckenFiltern([
    { start: '08:00', end: '09:00' }, // vorbei
    { start: '09:30', end: '10:30' }, // läuft → ab 09:45 (45 Min)
    { start: '11:00', end: '11:10' }, // zu kurz (10 Min)
    { start: '14:00', end: '15:30' }, // voll (90 Min)
  ], { istHeute: true, jetzt });

  assert.equal(erg.luecken.length, 2);
  assert.equal(erg.luecken[0].start, '09:45');
  assert.equal(erg.luecken[0].min, 45);
  assert.equal(erg.luecken[1].start, '14:00');
  assert.equal(erg.gesamtMin, 135);
});

test('zeitleisteZusammenfuehren sortiert Termine + Lücken chronologisch und respektiert Filter', () => {
  const termine = [
    { id: 't1', behandlerId: 'u1', startMin: 9 * 60 },
    { id: 't2', behandlerId: 'u2', startMin: 13 * 60 },
  ];
  const luecken = [{ start: '11:15', end: '12:30', startMin: 11 * 60 + 15, endMin: 12 * 60 + 30, min: 75 }];

  const alle = zeitleisteZusammenfuehren(termine, luecken);
  assert.deepEqual(alle.map((z) => z.typ), ['termin', 'luecke', 'termin']);

  const nurLuecken = zeitleisteZusammenfuehren(termine, luecken, { nurLuecken: true });
  assert.equal(nurLuecken.length, 1);
  assert.equal(nurLuecken[0].typ, 'luecke');

  const nurU1 = zeitleisteZusammenfuehren(termine, luecken, { behandlerFilter: 'u1' });
  assert.deepEqual(nurU1.map((z) => z.typ), ['termin', 'luecke']);
});

test('handlungsbedarfZusammenfassen priorisiert überfällige Fristen, Anfragen, Berichte und Warteliste auf max. 4 Zeilen', () => {
  const erg = handlungsbedarfZusammenfassen({
    fristen: [{ rxId: 'r1', schwere: 'danger', patientName: 'Karin', fristText: 'Überfällig', leistung: 'MT' }],
    anfragen: [{ id: 'a1', name: 'Lea', wunschText: 'Di 10:30', leistung: 'KG' }],
    berichte: [{ leadId: 'l1', patientName: 'Lukas', detail: 'Bericht fällig' }],
    warteliste: [{ id: 'w1', name: 'Maren', leistung: 'Massage', prioText: 'Dringend' }],
  });
  assert.equal(erg.counts.gesamt, 4);
  assert.equal(erg.counts.fristenUeberfaellig, 1);
  assert.equal(erg.eintraege.length, 4);
  assert.equal(erg.eintraege[0].kategorie, 'frist');
  assert.equal(erg.eintraege[1].kategorie, 'anfrage');
});

test('Tageszentrale-Module enthalten keine Emojis', () => {
  const emoji = /[\u{1F300}-\u{1FAFF}]/u;
  for (const f of ['./tageszentrale-logik.js', './tageszentrale-ansicht.js']) {
    const src = fs.readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.equal(emoji.test(src), false, `Keine Emojis in ${f}`);
  }
});
