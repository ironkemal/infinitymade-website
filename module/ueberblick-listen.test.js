import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  fristenGruppieren,
  aktuelleAbwesenheiten,
  datumMitJahr,
  abwesenheitTyp,
  fristenAuswerten,
  geburtstageAufbereiten,
  abwesenheitenAufbereiten,
  nichtErscheinerAufbereiten,
  initialen,
  suchePasst,
} from './ueberblick-listen.js';

test('Fund 8: gleiche Fristmeldungen werden mit Anzahl zusammengefasst', () => {
  const t = 'TEST-Anna — Behandlungsbeginn in 14 Tagen fällig (bis 01.12.2026)';
  const r = fristenGruppieren([
    { type: 'warning', text: t },
    { type: 'warning', text: t },
    { type: 'warning', text: t },
    { type: 'danger', text: 'Bernd — ABGELAUFEN' },
  ]);
  assert.equal(r.length, 2);
  assert.equal(r[0].text, `${t} · 3 Verordnungen`);
  assert.equal(r[1].text, 'Bernd — ABGELAUFEN');
});

test('Fund 8: Abwesenheiten nur laufend oder in 14 Tagen, Datum mit Jahr', () => {
  const zeilen = [
    { id: 'a', start_date: '2026-12-07T00:00:00+00:00', end_date: '2026-12-13T00:00:00+00:00' },
    { id: 'b', start_date: '2027-07-01T00:00:00+00:00', end_date: '2027-07-01T00:00:00+00:00' },
    { id: 'c', start_date: '2026-11-10T00:00:00+00:00', end_date: '2026-11-20T00:00:00+00:00' },
    { id: 'e', start_date: '2026-12-01T00:00:00+00:00', end_date: '2026-12-01T00:00:00+00:00' },
    { id: 'f', start_date: '2026-12-02T00:00:00+00:00', end_date: '2026-12-02T00:00:00+00:00' },
    { id: 'd', start_date: '2026-11-01T00:00:00+00:00', end_date: '2026-11-05T00:00:00+00:00' },
  ];
  assert.deepEqual(aktuelleAbwesenheiten(zeilen, '2026-11-17').map(z => z.id), ['c', 'e']);
  assert.equal(datumMitJahr('2026-12-31T00:00:00+00:00'), '31.12.2026');
  assert.equal(abwesenheitTyp('urlaub'), 'Urlaub');
});

test('fristenAuswerten: gruppiert Mehrfach-Verordnungen, sortiert nach Dringlichkeit und berücksichtigt 14/28-Tage-Regel', () => {
  const heute = '2026-11-19';
  const rezepte = [
    // Normal, Frist in 12 Tagen (01.12.2026), 2x gleicher Patient → 1 Zeile mit anzahl=2
    {
      id: 'rx-1', patient_id: 'p-anna', ausstellungsdatum: '2026-11-03', behandlungsbeginn: null,
      is_dringend: false, heilmittel: 'KG', diagnosegruppe: 'WS2', therapie_bereich: 'physio',
      leads: { id: 'p-anna', first_name: 'Anna', last_name: 'Beispiel' },
    },
    {
      id: 'rx-2', patient_id: 'p-anna', ausstellungsdatum: '2026-11-03', behandlungsbeginn: null,
      is_dringend: false, heilmittel: 'KG', diagnosegruppe: 'WS2', therapie_bereich: 'physio',
      leads: { id: 'p-anna', first_name: 'Anna', last_name: 'Beispiel' },
    },
    // Dringend (14 Tage ab 2026-11-01 = 2026-11-15 → 4 Tage überfällig!)
    {
      id: 'rx-3', patient_id: 'p-joerg', ausstellungsdatum: '2026-11-01', behandlungsbeginn: null,
      is_dringend: true, heilmittel: 'MT', diagnosegruppe: 'EX2', therapie_bereich: 'physio',
      leads: { id: 'p-joerg', first_name: 'Jörg', last_name: 'Müller' },
    },
    // Bald fällig (≤ 7 Tage: 2026-10-28 + 28 = 2026-11-25 → in 6 Tagen)
    {
      id: 'rx-4', patient_id: 'p-clara', ausstellungsdatum: '2026-10-28', behandlungsbeginn: null,
      is_dringend: false, heilmittel: 'Podologische Komplexbehandlung', diagnosegruppe: 'DF', therapie_bereich: 'podo',
      leads: { id: 'p-clara', first_name: 'Clara', last_name: 'Weber' },
    },
    // Begonnen, 9-Monate-Abrechnungsfrist in 20 Tagen (2026-03-10 + 274 = 2026-12-09)
    {
      id: 'rx-5', patient_id: 'p-bernd', ausstellungsdatum: '2026-03-01', behandlungsbeginn: '2026-03-10',
      is_dringend: false, heilmittel: 'MLD', diagnosegruppe: 'LY', therapie_bereich: 'physio',
      leads: { id: 'p-bernd', first_name: 'Bernd', last_name: 'Schmidt' },
    },
  ];

  const erg = fristenAuswerten(rezepte, heute);
  assert.equal(erg.length, 4);
  // Reihenfolge: Überfällig → Bald (≤7T) → Geplant (8–28T) → Abrechnung
  assert.equal(erg[0].kategorie, 'ueberfaellig');
  assert.equal(erg[0].patientName, 'Jörg Müller');
  assert.equal(erg[0].dringend, true);
  assert.equal(erg[0].tageDiff, -4);
  assert.equal(erg[0].fristLabel, 'Seit 4 Tagen überfällig');

  assert.equal(erg[1].kategorie, 'bald');
  assert.equal(erg[1].quelle, 'podologie');
  assert.equal(erg[1].tageDiff, 6);

  assert.equal(erg[2].kategorie, 'geplant');
  assert.equal(erg[2].anzahl, 2);
  assert.equal(erg[2].stichtagDe, '01.12.2026');

  assert.equal(erg[3].kategorie, 'abrechnung');
  assert.equal(erg[3].art, 'abrechnung');
});

test('geburtstageAufbereiten: sortiert nach Nähe, berechnet Alter und unterstützt Jahreswechsel + Horizont', () => {
  const leads = [
    { id: '1', first_name: 'Sabine', last_name: 'Kurz', geburtsdatum: '1980-12-28' },
    { id: '2', first_name: 'Max', last_name: 'Winter', geburtsdatum: '1990-01-03' },
    { id: '3', first_name: 'Lena', last_name: 'Spät', geburtsdatum: '1975-01-20' },
  ];
  const r7 = geburtstageAufbereiten(leads, '2026-12-28', 7);
  assert.equal(r7.length, 2);
  assert.equal(r7[0].name, 'Sabine Kurz');
  assert.equal(r7[0].istHeute, true);
  assert.equal(r7[0].alterWird, 46);
  assert.equal(r7[1].name, 'Max Winter');
  assert.equal(r7[1].tageBis, 6);
  assert.equal(r7[1].alterWird, 37);

  const r30 = geburtstageAufbereiten(leads, '2026-12-28', 30);
  assert.equal(r30.length, 3);
});

test('abwesenheitenAufbereiten: laufende zuerst, Horizont 14 vs 30 Tage', () => {
  const zeilen = [
    { id: '1', start_date: '2026-12-10T00:00:00Z', end_date: '2026-12-12T00:00:00Z', type: 'urlaub', profiles: { business_name: 'Anna Berg' } },
    { id: '2', start_date: '2026-11-18T00:00:00Z', end_date: '2026-11-22T00:00:00Z', type: 'krank', profiles: { business_name: 'Tom Klein' } },
  ];
  const r14 = abwesenheitenAufbereiten(zeilen, '2026-11-19', 14);
  assert.equal(r14.length, 1);
  assert.equal(r14[0].istAktiv, true);
  assert.equal(r14[0].statusLabel, 'Aktiv');

  const r30 = abwesenheitenAufbereiten(zeilen, '2026-11-19', 30);
  assert.equal(r30.length, 2);
  assert.equal(r30[0].name, 'Tom Klein');
  assert.equal(r30[1].name, 'Anna Berg');
  assert.equal(r30[1].statusLabel, 'In 21 Tagen');
});

test('nichtErscheinerAufbereiten, initialen und suchePasst', () => {
  const ns = nichtErscheinerAufbereiten([
    { id: 'b1', lead_id: 'l1', customer_name: 'Paul Muster', start_time: '2026-11-18T13:30:00Z', services: { title: 'Krankengymnastik' } },
  ], '2026-11-19');
  assert.equal(ns.length, 1);
  assert.equal(ns[0].initialen, 'PM');
  assert.equal(ns[0].vorText, 'Gestern');
  assert.equal(ns[0].leistung, 'Krankengymnastik');

  assert.equal(initialen('Jörg TEST-Müller'), 'JT');
  assert.equal(initialen('Einzelname'), 'EI');
  assert.equal(suchePasst('müller', ['Jörg Müller', 'KG']), true);
  assert.equal(suchePasst('urlaub', ['Jörg Müller', 'KG']), false);
});

test('Überblick-Ansicht und Panel-Markup enthalten keine Emojis', () => {
  const emojiRe = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u;
  const html = fs.readFileSync(new URL('../dashboard.html', import.meta.url), 'utf8');
  const start = html.indexOf('id="panel-ueberblick"');
  const end = html.indexOf('</section>', start);
  assert.ok(start > 0 && end > start, 'panel-ueberblick im HTML vorhanden');
  assert.equal(emojiRe.test(html.slice(start, end)), false, 'panel-ueberblick ohne Emojis');

  const ansicht = fs.readFileSync(new URL('./ueberblick-ansicht.js', import.meta.url), 'utf8');
  assert.equal(emojiRe.test(ansicht), false, 'ueberblick-ansicht.js ohne Emojis');
});
