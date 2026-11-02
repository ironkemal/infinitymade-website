import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  pruefeTerminVoDatum,
  FEHLER_TERMIN_VOR_AUSSTELLUNG,
  terminKalendertagBerlin,
  verordnungAusstellungstagBerlin,
} from './termin-vo-datum.js';

test('pruefeTerminVoDatum: Termin am selben Kalendertag wie Ausstellung ist zulässig (T339-05)', () => {
  const res = pruefeTerminVoDatum('2026-10-10T09:00:00Z', '2026-10-10');
  assert.equal(res.ok, true);
  assert.equal(res.fehler, undefined);
});

test('pruefeTerminVoDatum: Termin nach dem Ausstellungsdatum ist zulässig', () => {
  const res = pruefeTerminVoDatum('2026-10-15T14:30:00Z', '2026-10-10');
  assert.equal(res.ok, true);
  assert.equal(res.fehler, undefined);
});

test('pruefeTerminVoDatum: Termin vor dem Ausstellungsdatum wird blockiert (T339-02)', () => {
  const res = pruefeTerminVoDatum('2026-10-05T08:00:00Z', '2026-10-10');
  assert.equal(res.ok, false);
  assert.equal(res.fehler, FEHLER_TERMIN_VOR_AUSSTELLUNG);
  assert.equal(res.fehler, 'Dieser Termin liegt vor dem Ausstellungsdatum der Verordnung und ist nicht abrechenbar.');
});

test('pruefeTerminVoDatum: Termin-Objekt mit start_time und Verordnungsobjekt mit ausstellungsdatum', () => {
  const termin = { id: 'b-1', start_time: '2026-10-05T08:00:00Z' };
  const vord = { id: 'v-1', ausstellungsdatum: '2026-10-10' };
  const res = pruefeTerminVoDatum(termin, vord);
  assert.equal(res.ok, false);
  assert.equal(res.fehler, FEHLER_TERMIN_VOR_AUSSTELLUNG);
});

test('pruefeTerminVoDatum: Termin-Objekt mit date und time', () => {
  const termin = { date: '2026-10-12', time: '10:00' };
  const vord = { ausstellungsdatum: '2026-10-10' };
  const res = pruefeTerminVoDatum(termin, vord);
  assert.equal(res.ok, true);
});

test('pruefeTerminVoDatum: Berlin-Zeitzone DST / Mitternacht (UTC-Spätzeit ist bereits nächster Tag in Berlin)', () => {
  // 2026-10-09 23:30 UTC ist im Sommer/Herbst (MESZ, +2) der 2026-10-10 01:30 in Berlin.
  // Liegt also NICHT vor dem 2026-10-10.
  const res = pruefeTerminVoDatum('2026-10-09T23:30:00Z', '2026-10-10');
  assert.equal(res.ok, true);
});

test('pruefeTerminVoDatum: leere oder fehlende Daten blockieren nicht fälschlich', () => {
  assert.equal(pruefeTerminVoDatum(null, '2026-10-10').ok, true);
  assert.equal(pruefeTerminVoDatum('2026-10-10', null).ok, true);
  assert.equal(pruefeTerminVoDatum(undefined, undefined).ok, true);
});

test('terminKalendertagBerlin und verordnungAusstellungstagBerlin Helfer', () => {
  assert.equal(terminKalendertagBerlin('2026-10-05'), '2026-10-05');
  assert.equal(terminKalendertagBerlin({ start: '2026-10-05T10:00:00Z' }), '2026-10-05');
  assert.equal(verordnungAusstellungstagBerlin({ verordnungsdatum: '2026-10-08' }), '2026-10-08');
});
