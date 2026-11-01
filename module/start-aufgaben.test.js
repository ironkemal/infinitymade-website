import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bereinigeText,
  istUeberfaellig,
  darfLoeschen,
  sortiereOffene,
  letzteErledigte,
  patientenSucheOptionen,
} from './start-aufgaben.js';
import { readFileSync } from 'node:fs';

test('bereinigeText: schneidet Leerzeichen ab', () => {
  assert.equal(bereinigeText('   Aufgabe erledigen   '), 'Aufgabe erledigen');
});

test('bereinigeText: leer oder Whitespace liefert null', () => {
  assert.equal(bereinigeText(''), null);
  assert.equal(bereinigeText('   \t\n  '), null);
  assert.equal(bereinigeText(null), null);
  assert.equal(bereinigeText(undefined), null);
});

test('bereinigeText: maximal 500 Zeichen', () => {
  const lang = 'x'.repeat(600);
  const gekuerzt = bereinigeText(lang);
  assert.equal(gekuerzt.length, 500);
  assert.equal(gekuerzt, 'x'.repeat(500));
});

test('istUeberfaellig: Datum vor heute ist ueberfaellig', () => {
  const heute = '2026-10-31';
  assert.equal(istUeberfaellig({ faellig_am: '2026-10-30' }, heute), true);
  assert.equal(istUeberfaellig({ faellig_am: '2026-09-01' }, heute), true);
});

test('istUeberfaellig: heute oder Zukunft ist nicht ueberfaellig', () => {
  const heute = '2026-10-31';
  assert.equal(istUeberfaellig({ faellig_am: '2026-10-31' }, heute), false);
  assert.equal(istUeberfaellig({ faellig_am: '2026-11-01' }, heute), false);
});

test('istUeberfaellig: erledigte Aufgaben sind nie ueberfaellig', () => {
  const heute = '2026-10-31';
  assert.equal(
    istUeberfaellig({ faellig_am: '2026-10-25', erledigt_at: '2026-10-26T10:00:00Z' }, heute),
    false
  );
});

test('istUeberfaellig: ohne Faelligkeit oder ohne Datum ist false', () => {
  const heute = '2026-10-31';
  assert.equal(istUeberfaellig({ faellig_am: null }, heute), false);
  assert.equal(istUeberfaellig({}, heute), false);
  assert.equal(istUeberfaellig(null, heute), false);
  assert.equal(istUeberfaellig({ faellig_am: '2026-10-25' }, ''), false);
});

test('darfLoeschen: Inhaber darf jede Aufgabe loeschen', () => {
  const aufgabe = { erstellt_von: 'user-1' };
  assert.equal(darfLoeschen(aufgabe, { userId: 'user-2', istInhaber: true }), true);
  assert.equal(darfLoeschen(aufgabe, { userId: 'user-2', istInhaber: () => true }), true);
});

test('darfLoeschen: Ersteller darf eigene Aufgabe loeschen', () => {
  const aufgabe = { erstellt_von: 'user-1' };
  assert.equal(darfLoeschen(aufgabe, { userId: 'user-1', istInhaber: false }), true);
  assert.equal(
    darfLoeschen(aufgabe, { userId: () => 'user-1', istInhaber: () => false }),
    true
  );
});

test('darfLoeschen: fremder Nicht-Inhaber darf nicht loeschen', () => {
  const aufgabe = { erstellt_von: 'user-1' };
  assert.equal(darfLoeschen(aufgabe, { userId: 'user-2', istInhaber: false }), false);
  assert.equal(darfLoeschen(aufgabe, { userId: null, istInhaber: false }), false);
  assert.equal(darfLoeschen(null, { userId: 'user-1', istInhaber: true }), false);
});

test('sortiereOffene: filtert erledigte Aufgaben heraus', () => {
  const liste = [
    { id: 1, text: 'offen', erledigt_at: null },
    { id: 2, text: 'erledigt', erledigt_at: '2026-10-31T10:00:00Z' },
  ];
  const sortiert = sortiereOffene(liste, '2026-10-31');
  assert.equal(sortiert.length, 1);
  assert.equal(sortiert[0].id, 1);
});

test('sortiereOffene: faellige/ueberfaellige zuerst (aufsteigend), NULL zuletzt, dann created_at', () => {
  const heute = '2026-10-31';
  const liste = [
    { id: 'ohne-2', faellig_am: null, created_at: '2026-10-05T12:00:00Z' },
    { id: 'zukunft', faellig_am: '2026-11-05', created_at: '2026-10-01T10:00:00Z' },
    { id: 'ueberfaellig-alt', faellig_am: '2026-10-20', created_at: '2026-10-01T10:00:00Z' },
    { id: 'ueberfaellig-neu', faellig_am: '2026-10-20', created_at: '2026-10-02T10:00:00Z' },
    { id: 'heute', faellig_am: '2026-10-31', created_at: '2026-10-01T10:00:00Z' },
    { id: 'ohne-1', faellig_am: null, created_at: '2026-10-01T08:00:00Z' },
  ];

  const ergebnis = sortiereOffene(liste, heute).map((x) => x.id);
  assert.deepEqual(ergebnis, [
    'ueberfaellig-alt',
    'ueberfaellig-neu',
    'heute',
    'zukunft',
    'ohne-1',
    'ohne-2',
  ]);
});

test('sortiereOffene: toleriert leere Eingabe', () => {
  assert.deepEqual(sortiereOffene([], '2026-10-31'), []);
  assert.deepEqual(sortiereOffene(null, '2026-10-31'), []);
});

test('letzteErledigte: filtert offene heraus und sortiert nach erledigt_at absteigend', () => {
  const liste = [
    { id: 1, text: 'A', erledigt_at: '2026-10-31T09:00:00Z' },
    { id: 2, text: 'B', erledigt_at: null },
    { id: 3, text: 'C', erledigt_at: '2026-10-31T11:00:00Z' },
    { id: 4, text: 'D', erledigt_at: '2026-10-31T10:00:00Z' },
  ];
  const ergebnis = letzteErledigte(liste, 5).map((x) => x.id);
  assert.deepEqual(ergebnis, [3, 4, 1]);
});

test('letzteErledigte: beschraenkt auf n Eintraege (Standard 5)', () => {
  const liste = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    erledigt_at: `2026-10-31T${String(10 + i).padStart(2, '0')}:00:00Z`,
  }));
  const standard = letzteErledigte(liste);
  assert.equal(standard.length, 5);
  assert.equal(standard[0].id, 9);
  assert.equal(standard[4].id, 5);

  const zwei = letzteErledigte(liste, 2);
  assert.equal(zwei.length, 2);
  assert.deepEqual(zwei.map((x) => x.id), [9, 8]);
});

test('letzteErledigte: toleriert leere Eingabe', () => {
  assert.deepEqual(letzteErledigte([]), []);
  assert.deepEqual(letzteErledigte(null), []);
});

test('Patientensuche: Abfrage, Treffer und Anzeige kommen vom Aufrufer', async () => {
  const leads = [{ id: '1' }];
  const patientPasst = () => true;
  const patientLabel = () => 'Name';
  const o = patientenSucheOptionen({ ladePatienten: async () => leads, patientPasst, patientLabel });
  assert.equal(await o.loadLeads(), leads);
  assert.equal(o.matches, patientPasst);
  assert.equal(o.labelOf, patientLabel);
});

test('Patientensuche: Ladefehler wird gemeldet, nicht verschluckt', async () => {
  const meldungen = [];
  const o = patientenSucheOptionen({
    ladePatienten: async () => { throw new Error('42703'); },
    showToast: (m, t) => meldungen.push([m, t]),
  });
  assert.deepEqual(await o.loadLeads(), []);
  assert.equal(meldungen.length, 1);
  assert.equal(meldungen[0][1], 'error');
});

test('Patientensuche: dashboard.js fragt nur Spalten ab, die leads wirklich hat', () => {
  const dash = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
  const stelle = dash.slice(dash.indexOf('mountStartAufgaben({'));
  const spalten = stelle.match(/from\('leads'\)\.select\('([^']+)'\)/)[1].split(',');
  const schema = readFileSync(new URL('../db/SCHEMA.sql', import.meta.url), 'utf8');
  const tabelle = schema.match(/CREATE TABLE public\.leads \(([\s\S]*?)\n\);/)[1];
  const vorhanden = new Set(tabelle.split('\n').map((z) => z.trim().split(/\s+/)[0]));
  for (const s of spalten) assert.ok(vorhanden.has(s), `leads.${s} gibt es nicht`);
  assert.match(stelle.slice(0, 700), /bizScope\(/);
});
