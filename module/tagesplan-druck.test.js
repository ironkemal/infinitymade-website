import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gruppiereTagesplanTermine, erstelleTagesplanHtml } from './tagesplan-druck.js';

const BEISPIEL_TERMINE = [
  {
    id: 'b2',
    user_id: 'u-anna',
    therapeutName: 'Anna Muster',
    start_time: '2026-11-24T09:00:00+01:00',
    end_time: '2026-11-24T09:30:00+01:00',
    status: 'confirmed',
    patientName: 'Bernd Beispiel',
    leistung: 'Krankengymnastik',
    raum: 'Raum 2',
    hausbesuch: false,
    notes: 'Streng vertrauliche Diagnose',
  },
  {
    id: 'b1',
    user_id: 'u-anna',
    therapeutName: 'Anna Muster',
    start_time: '2026-11-24T08:00:00+01:00',
    end_time: '2026-11-24T08:30:00+01:00',
    status: 'confirmed',
    patientName: 'Clara Test',
    leistung: 'Manuelle Therapie',
    hausbesuch: true,
    strasse: 'Hauptstraße 12',
    plz: '10115',
    ort: 'Berlin',
    telefon: '030 123456',
  },
  {
    id: 'b3',
    user_id: 'u-ben',
    therapeutName: 'Ben Kollege',
    start_time: '2026-11-24T10:00:00+01:00',
    status: 'cancelled',
    patientName: 'Storniert',
  },
  {
    id: 'b4',
    user_id: 'u-ben',
    therapeutName: 'Ben Kollege',
    start_time: '2026-11-24T10:30:00+01:00',
    status: 'confirmed',
    group_parent_id: 'parent-1',
    patientName: 'Gruppenkind',
  },
  {
    id: 'b5',
    user_id: 'u-ben',
    therapeutName: 'Ben Kollege',
    start_time: '2026-11-24T11:00:00+01:00',
    status: 'confirmed',
    patientName: 'Dora Demo',
    leistung: 'Lymphdrainage',
    raum: 'Raum 1',
    hausbesuch: false,
  },
];

test('gruppiereTagesplanTermine: filtert stornierte & Gruppenkinder und sortiert chronologisch', () => {
  const g = gruppiereTagesplanTermine(BEISPIEL_TERMINE, { modus: 'praxis' });
  assert.equal(g.length, 2);
  assert.equal(g[0].therapeutName, 'Anna Muster');
  assert.deepEqual(g[0].eintraege.map(e => e.id), ['b1', 'b2']);
  assert.equal(g[1].therapeutName, 'Ben Kollege');
  assert.deepEqual(g[1].eintraege.map(e => e.id), ['b5']);
});

test('gruppiereTagesplanTermine: Hausbesuchs-Modus enthält nur Hausbesuche, Therapeut-Modus filtert Behandler', () => {
  const hb = gruppiereTagesplanTermine(BEISPIEL_TERMINE, { modus: 'hausbesuch' });
  assert.equal(hb.length, 1);
  assert.deepEqual(hb[0].eintraege.map(e => e.id), ['b1']);

  const th = gruppiereTagesplanTermine(BEISPIEL_TERMINE, { modus: 'therapeut', therapeutId: 'u-ben' });
  assert.equal(th.length, 1);
  assert.deepEqual(th[0].eintraege.map(e => e.id), ['b5']);
});

test('erstelleTagesplanHtml: datensparsam blendet Notizen aus, Hausbesuch druckt Adresse & XSS wird maskiert', () => {
  const htmlSparsam = erstelleTagesplanHtml({
    praxis: { name: 'Praxis <Test>' },
    datumIso: '2026-11-24',
    modus: 'praxis',
    termine: BEISPIEL_TERMINE,
    datensparsam: true,
    erstelltUm: '07:30',
  });
  assert.match(htmlSparsam, /Praxis &lt;Test&gt;/);
  assert.match(htmlSparsam, /08:00–08:30/);
  assert.match(htmlSparsam, /09:00–09:30/);
  assert.doesNotMatch(htmlSparsam, /Streng vertrauliche Diagnose/);
  assert.match(htmlSparsam, /Vertraulicher Praxis-Tagesplan/);

  const htmlHb = erstelleTagesplanHtml({
    praxis: { name: 'Praxis Test' },
    datumIso: '2026-11-24',
    modus: 'hausbesuch',
    termine: BEISPIEL_TERMINE,
    datensparsam: true,
  });
  assert.match(htmlHb, /Hausbesuchs-Tour/);
  assert.match(htmlHb, /Hauptstraße 12, 10115 Berlin/);
  assert.match(htmlHb, /030 123456/);
  assert.doesNotMatch(htmlHb, /Bernd Beispiel/);
});

test('tagesplan-druck.js: keine Emojis im Modul (Handwerk-Regel 4)', () => {
  const src = fs.readFileSync(new URL('./tagesplan-druck.js', import.meta.url), 'utf8');
  assert.equal(/\p{Extended_Pictographic}/u.test(src), false);
});
