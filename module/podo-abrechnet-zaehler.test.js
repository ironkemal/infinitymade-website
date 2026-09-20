import { test } from 'node:test';
import assert from 'node:assert/strict';
import { podAbrechnetZaehler } from './podo-abrechnet-zaehler.js';

test('cutoffCreatedAt = null (noch nicht eingereicht) -> behFaturali = 0, alle aktiven noch offen', () => {
  const dokumentiert = [
    { id: '1', created_at: '2026-09-01T10:00:00Z', storniert_am: null },
    { id: '2', created_at: '2026-09-05T10:00:00Z', storniert_am: null },
    { id: '3', created_at: '2026-09-08T10:00:00Z', storniert_am: null },
  ];
  const ergebnis = podAbrechnetZaehler(dokumentiert, null);
  assert.deepEqual(ergebnis, { behFaturali: 0, behBekliyor: 3 });
});

test('cutoffCreatedAt gegeben: Behandlungen vor cutoff sind abgerechnet, danach noch offen', () => {
  const cutoff = '2026-09-10T12:00:00Z';
  const dokumentiert = [
    { id: '1', created_at: '2026-09-05T10:00:00Z', storniert_am: null },
    { id: '2', created_at: '2026-09-09T18:30:00Z', storniert_am: null },
    { id: '3', created_at: '2026-09-11T09:00:00Z', storniert_am: null },
    { id: '4', created_at: '2026-09-15T14:00:00Z', storniert_am: null },
  ];
  const ergebnis = podAbrechnetZaehler(dokumentiert, cutoff);
  assert.deepEqual(ergebnis, { behFaturali: 2, behBekliyor: 2 });
});

test('stornierte Behandlungen fliessen in keinen der Zaehler ein', () => {
  const cutoff = '2026-09-10T12:00:00Z';
  const dokumentiert = [
    { id: '1', created_at: '2026-09-05T10:00:00Z', storniert_am: '2026-09-06T08:00:00Z' }, // storniert, vor cutoff
    { id: '2', created_at: '2026-09-07T10:00:00Z', storniert_am: null },                    // aktiv, vor cutoff
    { id: '3', created_at: '2026-09-12T10:00:00Z', storniert_am: '2026-09-13T08:00:00Z' }, // storniert, nach cutoff
    { id: '4', created_at: '2026-09-14T10:00:00Z', storniert_am: null },                    // aktiv, nach cutoff
  ];
  const mitCutoff = podAbrechnetZaehler(dokumentiert, cutoff);
  assert.deepEqual(mitCutoff, { behFaturali: 1, behBekliyor: 1 });

  const ohneCutoff = podAbrechnetZaehler(dokumentiert, null);
  assert.deepEqual(ohneCutoff, { behFaturali: 0, behBekliyor: 2 });
});

test('created_at exakt gleich cutoffCreatedAt zaehlt als abgerechnet (<=)', () => {
  const cutoff = '2026-09-10T12:00:00.000Z';
  const dokumentiert = [
    { id: '1', created_at: '2026-09-10T12:00:00.000Z', storniert_am: null },
  ];
  const ergebnis = podAbrechnetZaehler(dokumentiert, cutoff);
  assert.deepEqual(ergebnis, { behFaturali: 1, behBekliyor: 0 });
});

test('leere, null oder undefined Eingaben kippen nicht und liefern 0/0', () => {
  assert.deepEqual(podAbrechnetZaehler([], '2026-09-10T12:00:00Z'), { behFaturali: 0, behBekliyor: 0 });
  assert.deepEqual(podAbrechnetZaehler(null, '2026-09-10T12:00:00Z'), { behFaturali: 0, behBekliyor: 0 });
  assert.deepEqual(podAbrechnetZaehler(undefined, '2026-09-10T12:00:00Z'), { behFaturali: 0, behBekliyor: 0 });
  assert.deepEqual(podAbrechnetZaehler(null, null), { behFaturali: 0, behBekliyor: 0 });
  assert.deepEqual(podAbrechnetZaehler(undefined, null), { behFaturali: 0, behBekliyor: 0 });
});
