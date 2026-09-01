// Die Regel hinter der Eingangsbefundung (78040). Jeder Fall hier ist ein Fall,
// der ohne Pruefung Geld kostet — entweder als Absetzung (zu viel abgerechnet)
// oder als entgangene Leistung (zu Unrecht gesperrt).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { darf78040 } from './eingangsbefundung-regel.js';

test('Patient ohne jede Behandlung — 78040 erlaubt', () => {
  const r = darf78040([], '2026-09-01');
  assert.equal(r.erlaubt, true);
  assert.equal(r.ersteAm, null);
});

test('null/undefined statt Liste kippt nicht um', () => {
  assert.equal(darf78040(null, '2026-09-01').erlaubt, true);
  assert.equal(darf78040(undefined, '2026-09-01').erlaubt, true);
});

test('78040 am selben Tag wie die erste Behandlung — erlaubt', () => {
  // Anlage 1a Teil 1 Nr. 2: „kann am gleichen Tag wie die podologische
  // Leistung durchgeführt werden." Das ist der Normalfall, nicht die Ausnahme.
  const r = darf78040(
    [{ behandlungsdatum: '2026-09-01', hpnr_codes: ['78010', '78030'] }],
    '2026-09-01',
  );
  assert.equal(r.erlaubt, true, '78040 neben 78010 am selben Tag ist ausdruecklich erlaubt');
});

test('bereits abgerechnete 78040 sperrt — auch ueber Verordnungen hinweg', () => {
  const r = darf78040(
    [
      { behandlungsdatum: '2026-03-02', hpnr_codes: ['78040', '78010'] },
      { behandlungsdatum: '2026-03-09', hpnr_codes: ['78030', '78010'] },
    ],
    '2026-09-01',
  );
  assert.equal(r.erlaubt, false);
  assert.equal(r.grund, 'schon_abgerechnet');
  assert.equal(r.schonAm, '2026-03-02', 'die Meldung nennt den Tag der ersten Abrechnung');
});

test('frueherer Behandlungstag ohne 78040 sperrt ebenfalls — der eigentliche Fehler', () => {
  // Das ist der Fall, der bis 31.08.2026 durchging: nie abgerechnet, aber die
  // Serie laeuft schon. „Vor der ersten Abgabe" ist damit vorbei.
  const r = darf78040(
    [
      { behandlungsdatum: '2026-08-04', hpnr_codes: ['78030', '78010'] },
      { behandlungsdatum: '2026-08-11', hpnr_codes: ['78030', '78010'] },
    ],
    '2026-08-18',
  );
  assert.equal(r.erlaubt, false);
  assert.equal(r.grund, 'nicht_erste_behandlung');
  assert.equal(r.ersteAm, '2026-08-04');
});

test('Nachtragen auf einen frueheren Tag als die erste Behandlung bleibt moeglich', () => {
  // Der Podologe traegt die vergessene Eingangsbefundung auf den Tag der ersten
  // Behandlung nach — datum == ersteAm, also nicht „frueher", also erlaubt.
  const r = darf78040(
    [{ behandlungsdatum: '2026-08-04', hpnr_codes: ['78030', '78010'] }],
    '2026-08-04',
  );
  assert.equal(r.erlaubt, true);
});

test('unsortierte Eingabe wird sortiert — ersteAm ist wirklich der frueheste Tag', () => {
  const r = darf78040(
    [
      { behandlungsdatum: '2026-08-11', hpnr_codes: ['78010'] },
      { behandlungsdatum: '2026-08-04', hpnr_codes: ['78010'] },
    ],
    '2026-08-18',
  );
  assert.equal(r.ersteAm, '2026-08-04');
});

test('Zeilen ohne Datum werden ignoriert statt zu sperren', () => {
  const r = darf78040(
    [{ behandlungsdatum: null, hpnr_codes: ['78010'] }, null],
    '2026-09-01',
  );
  assert.equal(r.erlaubt, true);
});

test('fehlendes hpnr_codes wird nicht als 78040 gelesen', () => {
  const r = darf78040([{ behandlungsdatum: '2026-09-01' }], '2026-09-01');
  assert.equal(r.erlaubt, true);
});
