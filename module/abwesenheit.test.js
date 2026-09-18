import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ladeAbwesenheiten, istAbwesend, abwesendeMitarbeiterIds, abwesenheitsGrund } from './abwesenheit.js';

const EIN_TAG = [{ employee_id: 'a', start_date: '2026-09-10T00:00:00+00:00', end_date: '2026-09-10T23:59:59+00:00' }];

test('istAbwesend erkennt den genauen Tag', () => {
  assert.equal(istAbwesend(EIN_TAG, 'a', '2026-09-10'), true);
  assert.equal(istAbwesend(EIN_TAG, 'a', '2026-09-09'), false);
  assert.equal(istAbwesend(EIN_TAG, 'a', '2026-09-11'), false);
});

test('istAbwesend ignoriert fremde Mitarbeiter', () => {
  assert.equal(istAbwesend(EIN_TAG, 'b', '2026-09-10'), false);
});

test('istAbwesend mit leerer/fehlender Liste', () => {
  assert.equal(istAbwesend([], 'a', '2026-09-10'), false);
  assert.equal(istAbwesend(null, 'a', '2026-09-10'), false);
});

test('mehrtaegiger Eintrag deckt den ganzen Zeitraum ab', () => {
  const urlaub = [{ employee_id: 'a', start_date: '2026-09-10T00:00:00+00:00', end_date: '2026-09-14T00:00:00+00:00' }];
  assert.equal(istAbwesend(urlaub, 'a', '2026-09-10'), true);
  assert.equal(istAbwesend(urlaub, 'a', '2026-09-12'), true);
  assert.equal(istAbwesend(urlaub, 'a', '2026-09-14'), true);
  assert.equal(istAbwesend(urlaub, 'a', '2026-09-15'), false);
});

test('reines Datum ohne Uhrzeit (haeufigste Schreibweise) trifft trotzdem den Tag', () => {
  // Eine schreibende Stelle speichert nur 'YYYY-MM-DD' -> Postgres macht daraus 00:00 UTC.
  const nurDatum = [{ employee_id: 'a', start_date: '2026-09-10', end_date: '2026-09-10' }];
  assert.equal(istAbwesend(nurDatum, 'a', '2026-09-10'), true);
});

test('abwesendeMitarbeiterIds sammelt ohne Duplikate', () => {
  const zwei = [
    { employee_id: 'a', start_date: '2026-09-10T00:00:00+00:00', end_date: '2026-09-10T23:59:59+00:00' },
    { employee_id: 'b', start_date: '2026-09-10T00:00:00+00:00', end_date: '2026-09-10T23:59:59+00:00' },
    { employee_id: 'a', start_date: '2026-09-10T00:00:00+00:00', end_date: '2026-09-12T23:59:59+00:00' },
  ];
  const ids = abwesendeMitarbeiterIds(zwei, '2026-09-10');
  assert.equal(ids.length, 2);
  assert.ok(ids.includes('a') && ids.includes('b'));
});

test('abwesenheitsGrund: reason vor note vor Typ-Label vor Standardtext', () => {
  assert.equal(abwesenheitsGrund([{ employee_id: 'a', start_date: '2026-09-10', end_date: '2026-09-10', reason: 'Zahnarzt' }], 'a', '2026-09-10'), 'Zahnarzt');
  assert.equal(abwesenheitsGrund([{ employee_id: 'a', start_date: '2026-09-10', end_date: '2026-09-10', note: 'Fortbildung extern' }], 'a', '2026-09-10'), 'Fortbildung extern');
  assert.equal(abwesenheitsGrund([{ employee_id: 'a', start_date: '2026-09-10', end_date: '2026-09-10', type: 'krank' }], 'a', '2026-09-10'), 'Krank');
  assert.equal(abwesenheitsGrund([{ employee_id: 'a', start_date: '2026-09-10', end_date: '2026-09-10' }], 'a', '2026-09-10'), 'Abwesend');
  assert.equal(abwesenheitsGrund([], 'a', '2026-09-10'), null);
});

test('ladeAbwesenheiten ohne Mitarbeiter fragt gar nicht erst an', async () => {
  const result = await ladeAbwesenheiten(null, { empIds: [], vonISO: 'x', bisISO: 'y' });
  assert.deepEqual(result, []);
});

test('ladeAbwesenheiten filtert ueber employee_id und Zeitraum', async () => {
  const aufrufe = [];
  const fake = {
    from(tabelle) { aufrufe.push(['from', tabelle]); return this; },
    select(felder) { aufrufe.push(['select', felder]); return this; },
    in(spalte, werte) { aufrufe.push(['in', spalte, werte]); return this; },
    lte(spalte, wert) { aufrufe.push(['lte', spalte, wert]); return this; },
    gte(spalte, wert) { aufrufe.push(['gte', spalte, wert]); return Promise.resolve({ data: EIN_TAG }); },
  };
  const result = await ladeAbwesenheiten(fake, { empIds: ['a'], vonISO: '2026-09-08T00:00:00Z', bisISO: '2026-09-14T23:59:59Z' });
  assert.deepEqual(result, EIN_TAG);
  assert.deepEqual(aufrufe[0], ['from', 'time_offs']);
  assert.deepEqual(aufrufe[2], ['in', 'employee_id', ['a']]);
});
