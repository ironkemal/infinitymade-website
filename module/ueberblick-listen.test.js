import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fristenGruppieren, aktuelleAbwesenheiten, datumMitJahr, abwesenheitTyp } from './ueberblick-listen.js';

test('Fund 8: gleiche Fristmeldungen werden mit Anzahl zusammengefasst', () => {
  const t = 'TEST-Anna — Behandlungsbeginn in 14 Tagen fällig (bis 01.12.2026)';
  const r = fristenGruppieren([{ type: 'warning', text: t }, { type: 'warning', text: t }, { type: 'warning', text: t }, { type: 'danger', text: 'Bernd — ABGELAUFEN' }]);
  assert.equal(r.length, 2);
  assert.equal(r[0].text, `${t} · 3 Verordnungen`);
  assert.equal(r[1].text, 'Bernd — ABGELAUFEN');
});

test('Fund 8: Abwesenheiten nur laufend oder in 30 Tagen, Datum mit Jahr', () => {
  const zeilen = [
    { id: 'a', start_date: '2026-12-07T00:00:00+00:00', end_date: '2026-12-13T00:00:00+00:00' },
    { id: 'b', start_date: '2027-07-01T00:00:00+00:00', end_date: '2027-07-01T00:00:00+00:00' },
    { id: 'c', start_date: '2026-11-10T00:00:00+00:00', end_date: '2026-11-20T00:00:00+00:00' },
    { id: 'd', start_date: '2026-11-01T00:00:00+00:00', end_date: '2026-11-05T00:00:00+00:00' },
  ];
  assert.deepEqual(aktuelleAbwesenheiten(zeilen, '2026-11-17').map(z => z.id), ['a', 'c']);
  assert.equal(datumMitJahr('2026-12-31T00:00:00+00:00'), '31.12.2026');
  assert.equal(abwesenheitTyp('urlaub'), 'Urlaub');
});
