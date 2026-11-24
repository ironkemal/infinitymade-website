import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { findeFreieVertreter, erstelleAnruflisteHtml } from './abwesenheit-termine.js';

const TEAM = [
  { id: 'u-krank', name: 'Anna Ausfall' },
  { id: 'u-frei', name: 'Ben Bereit' },
  { id: 'u-belegt', name: 'Clara Belegt' },
  { id: 'u-urlaub', name: 'Dora Urlaub' },
  { id: 'u-falsch', name: 'Emil AndereLeistung' },
];

const TERMIN = {
  id: 'b-1',
  user_id: 'u-krank',
  service_id: 'svc-mt',
  start_time: '2026-11-24T09:00:00+01:00',
  end_time: '2026-11-24T09:30:00+01:00',
  status: 'confirmed',
};

test('findeFreieVertreter: schließt abwesende, belegte und unpassende Kollegen zuverlässig aus', () => {
  const ergebnis = findeFreieVertreter({
    termin: TERMIN,
    team: TEAM,
    employeeServices: [
      { employee_id: 'u-frei', service_id: 'svc-mt' },
      { employee_id: 'u-belegt', service_id: 'svc-mt' },
      { employee_id: 'u-urlaub', service_id: 'svc-mt' },
      { employee_id: 'u-falsch', service_id: 'svc-mld' },
    ],
    alleTermine: [
      // Clara hat zeitgleichen Termin -> raus
      { id: 'b-c', user_id: 'u-belegt', start_time: '2026-11-24T09:15:00+01:00', end_time: '2026-11-24T09:45:00+01:00', status: 'confirmed' },
      // Ben hat nur einen stornierten Termin + einen späteren Termin -> frei!
      { id: 'b-b1', user_id: 'u-frei', start_time: '2026-11-24T09:00:00+01:00', end_time: '2026-11-24T09:30:00+01:00', status: 'cancelled' },
      { id: 'b-b2', user_id: 'u-frei', start_time: '2026-11-24T09:30:00+01:00', end_time: '2026-11-24T10:00:00+01:00', status: 'confirmed' },
    ],
    abwesenheiten: [
      { employee_id: 'u-urlaub', start_date: '2026-11-23', end_date: '2026-11-27' },
    ],
    abwesenderId: 'u-krank',
  });

  assert.deepEqual(ergebnis.map(x => x.id), ['u-frei']);
  assert.equal(ergebnis[0].passtLeistung, true);
});

test('findeFreieVertreter: kleine Praxis ohne employee_services bekommt alle freien Kollegen', () => {
  const ergebnis = findeFreieVertreter({
    termin: TERMIN,
    team: TEAM,
    employeeServices: [],
    alleTermine: [],
    abwesenheiten: [{ employee_id: 'u-urlaub', start_date: '2026-11-24', end_date: '2026-11-24' }],
    abwesenderId: 'u-krank',
  });

  assert.deepEqual(ergebnis.map(x => x.id), ['u-frei', 'u-belegt', 'u-falsch']);
});

test('erstelleAnruflisteHtml: datensparsam, maskiert XSS und nennt niemals Krankheitsgründe', () => {
  const html = erstelleAnruflisteHtml({
    therapeutName: 'Anna <Muster>',
    von: '2026-11-24',
    bis: '2026-11-24',
    termine: [
      {
        start_time: '2026-11-24T09:00:00+01:00',
        end_time: '2026-11-24T09:30:00+01:00',
        patientName: 'Bernd <Test>',
        telefon: '030 987654',
        leistung: 'Manuelle Therapie',
      },
    ],
  });
  assert.match(html, /Anna &lt;Muster&gt;/);
  assert.match(html, /Bernd &lt;Test&gt;/);
  assert.match(html, /030 987654/);
  assert.match(html, /keine Gesundheitsdaten von Mitarbeitenden nennen/);
});

test('findeFreieVertreter: Teilzeit / freier Tag / außerhalb Arbeitszeit werden ausgeschlossen', () => {
  // 2026-11-24 ist ein Dienstag (day_of_week = 2), 09:00–09:30 Berlin
  const ergebnis = findeFreieVertreter({
    termin: TERMIN,
    team: [
      { id: 'u-krank', name: 'Anna Ausfall' },
      { id: 'u-dienst', name: 'Ben ImDienst' },
      { id: 'u-spaet', name: 'Clara Nachmittags' },
      { id: 'u-frei-tag', name: 'Dora DienstagsFrei' },
      { id: 'u-ohne-wh', name: 'Emil OhneDienstplan' },
    ],
    workingHours: [
      { user_id: 'u-dienst', day_of_week: 2, start_time: '08:00:00', end_time: '14:00:00', is_active: true },
      { user_id: 'u-spaet', day_of_week: 2, start_time: '13:00:00', end_time: '18:00:00', is_active: true },
      { user_id: 'u-frei-tag', day_of_week: 1, start_time: '08:00:00', end_time: '16:00:00', is_active: true },
      { user_id: 'u-frei-tag', day_of_week: 2, start_time: '08:00:00', end_time: '16:00:00', is_active: false },
    ],
    abwesenderId: 'u-krank',
  });
  assert.deepEqual(ergebnis.map(x => x.id), ['u-dienst', 'u-ohne-wh']);
});

test('abwesenheit-termine.js: keine Emojis (Handwerk-Regel 4)', () => {
  const src = fs.readFileSync(new URL('./abwesenheit-termine.js', import.meta.url), 'utf8');
  assert.equal(/\p{Extended_Pictographic}/u.test(src), false);
});
