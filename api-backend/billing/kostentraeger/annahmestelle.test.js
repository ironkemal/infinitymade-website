// Auflösung der Datenannahmestelle — Fallback-Kette (Ops #283).
//   node --test api-backend/billing/kostentraeger/annahmestelle.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  waehleAnnahmestelle,
  abrechnungscodeKette,
  ELEKTRONISCHE_DATENLIEFERUNG,
  VERKNUEPFUNGSART_KETTE,
} from './annahmestelle.js';

// Eine VKG-Zeile, wie sie in kostentraeger_annahmestellen steht.
const zeile = (partner_ik, abrechnungscode, opt = {}) => ({
  partner_ik,
  abrechnungscode,
  verknuepfungsart:   opt.va  ?? '03',
  art_datenlieferung: opt.adl ?? '07',
  bundesland:         opt.bl  ?? '',
});

const podoKette = abrechnungscodeKette('podologie', '71');
const physKette = abrechnungscodeKette('physiotherapy', '22');

// --- T9: der spezifische Code gewinnt ------------------------------------

test('T9: Podologie nimmt 71/72, obwohl 99 und 00 danebenstehen', () => {
  const t = waehleAnnahmestelle([
    zeile('100000001', '00'),
    zeile('100000002', '99'),
    zeile('100000003', '71'),
  ], { ketten: podoKette });

  assert.equal(t.partnerIk, '100000003');
  assert.equal(t.abrechnungscode, '71');
  assert.equal(t.stufe, 0);
});

test('T9b: 72 zaehlt gleichwertig zu 71 (dieselbe Stufe)', () => {
  const t = waehleAnnahmestelle([zeile('100000009', '72'), zeile('100000001', '00')],
    { ketten: podoKette });
  assert.equal(t.partnerIk, '100000009');
  assert.equal(t.stufe, 0);
});

test('T9c: Physio nimmt den eigenen Code vor dem Gruppenschluessel 20', () => {
  const t = waehleAnnahmestelle([
    zeile('100000001', '20'),
    zeile('100000004', '22'),
  ], { ketten: physKette });
  assert.equal(t.partnerIk, '100000004');
  assert.equal(t.abrechnungscode, '22');
});

// --- T10: Abstieg in der Kette -------------------------------------------

test('T10: ohne 71/72 faellt die Podologie auf 99 — NICHT auf 20', () => {
  const t = waehleAnnahmestelle([
    zeile('100000005', '20'),   // Gruppenschluessel Heilmittel — deckt Podologie nicht
    zeile('100000006', '99'),
    zeile('100000007', '00'),
  ], { ketten: podoKette });

  assert.equal(t.partnerIk, '100000006', 'muss 99 nehmen, nicht die 20');
  assert.equal(t.abrechnungscode, '99');
  assert.equal(t.stufe, 1);
});

test('T10b: ohne 71/72/99 bleibt der Sammelschluessel 00', () => {
  const t = waehleAnnahmestelle([zeile('100000005', '20'), zeile('100000007', '00')],
    { ketten: podoKette });
  assert.equal(t.partnerIk, '100000007');
  assert.equal(t.stufe, 2);
});

test('T10c: die 20 allein macht die Podologie NICHT aufloesbar', () => {
  const t = waehleAnnahmestelle([zeile('100000005', '20')], { ketten: podoKette });
  assert.equal(t, null, 'Anhang 03 §8.14 Fussnote 4 — 20 deckt 71/72 nicht ab');
});

test('T10d: Physio steigt eigener Code -> 20 -> 99 -> 00 ab', () => {
  const stufen = [
    [[zeile('1', '22'), zeile('2', '20'), zeile('3', '99'), zeile('4', '00')], '1', 0],
    [[zeile('2', '20'), zeile('3', '99'), zeile('4', '00')],                   '2', 1],
    [[zeile('3', '99'), zeile('4', '00')],                                     '3', 2],
    [[zeile('4', '00')],                                                       '4', 3],
  ];
  for (const [zeilen, erwartet, stufe] of stufen) {
    const t = waehleAnnahmestelle(zeilen, { ketten: physKette });
    assert.equal(t.partnerIk, erwartet);
    assert.equal(t.stufe, stufe);
  }
});

// --- Verknuepfungsart -----------------------------------------------------

test('03 schlaegt 02, auch wenn 02 den spezifischeren Code traegt', () => {
  const t = waehleAnnahmestelle([
    zeile('100000010', '71', { va: '02' }),
    zeile('100000011', '00', { va: '03' }),
  ], { ketten: podoKette });

  assert.equal(t.partnerIk, '100000011');
  assert.equal(t.verknuepfungsart, '03');
});

test('ohne jede 03-Zeile faellt die Auswahl auf 02', () => {
  const t = waehleAnnahmestelle([zeile('100000010', '71', { va: '02' })],
    { ketten: podoKette });
  assert.equal(t.partnerIk, '100000010');
  assert.equal(t.verknuepfungsart, '02');
});

test('Papierannahmestelle (09) und Verweis (01) zaehlen nie', () => {
  for (const va of ['09', '01']) {
    assert.equal(waehleAnnahmestelle([zeile('100000012', '71', { va })], { ketten: podoKette }),
      null, `Verknuepfungsart ${va} darf keine Datenannahmestelle sein`);
  }
  assert.deepEqual(VERKNUEPFUNGSART_KETTE, ['03', '02']);
});

// --- Art der Datenlieferung ----------------------------------------------

test('nur 07 und 30 gelten als elektronisch', () => {
  assert.deepEqual([...ELEKTRONISCHE_DATENLIEFERUNG], ['07', '30']);
  for (const adl of ['21', '24', '26', '28', '29']) {
    assert.equal(waehleAnnahmestelle([zeile('100000013', '71', { adl })], { ketten: podoKette }),
      null, `art_datenlieferung ${adl} ist Papier`);
  }
  assert.ok(waehleAnnahmestelle([zeile('100000014', '71', { adl: '30' })], { ketten: podoKette }));
});

// --- Bundesland -----------------------------------------------------------

test('landesunabhaengig ist der LEERE STRING, nicht NULL', () => {
  // Die Spalte ist NOT NULL DEFAULT '' — wer hier auf NULL prueft, trifft nichts.
  const t = waehleAnnahmestelle([zeile('100000015', '71', { bl: '' })], { ketten: podoKette });
  assert.equal(t.partnerIk, '100000015');
});

test('99 gilt ebenfalls landesunabhaengig', () => {
  const t = waehleAnnahmestelle([zeile('100000016', '71', { bl: '99' })], { ketten: podoKette });
  assert.equal(t.partnerIk, '100000016');
});

test('eine landesspezifische Zeile zaehlt nur beim passenden Land', () => {
  const zeilen = [zeile('100000017', '71', { bl: '05' })];
  assert.equal(waehleAnnahmestelle(zeilen, { ketten: podoKette }), null,
    'ohne bekanntes Land darf die landesspezifische Zeile nicht gezogen werden');
  assert.equal(waehleAnnahmestelle(zeilen, { ketten: podoKette, bundeslandVkg: '05' }).partnerIk,
    '100000017');
  assert.equal(waehleAnnahmestelle(zeilen, { ketten: podoKette, bundeslandVkg: '01' }), null);
});

// --- T11: nicht aufloesbar -----------------------------------------------

test('T11: kein brauchbares Segment -> null (der Aufrufer muss 412 antworten)', () => {
  assert.equal(waehleAnnahmestelle([], { ketten: podoKette }), null);
  assert.equal(waehleAnnahmestelle(null, { ketten: podoKette }), null);
  assert.equal(waehleAnnahmestelle([
    zeile('100000018', '71', { va: '09' }),      // Papierannahmestelle
    zeile('100000019', '71', { adl: '21' }),     // Papier-Datenlieferung
    zeile('100000020', '05'),                    // Code ausserhalb jeder Stufe
  ], { ketten: podoKette }), null);
});

// --- Mehrdeutigkeit -------------------------------------------------------

test('zwei Empfaenger auf der 00-Stufe werden gemeldet, nicht geworfen', () => {
  const t = waehleAnnahmestelle([
    zeile('103411401', '00'),
    zeile('104212516', '00'),
  ], { ketten: podoKette });

  assert.ok(t, 'die Datei muss trotzdem rausgehen koennen');
  assert.equal(t.kandidaten, 2, 'aber die Mehrdeutigkeit bleibt sichtbar');
  assert.equal(t.partnerIk, '103411401');
});

test('dieselbe IK mehrfach ist NICHT mehrdeutig', () => {
  const t = waehleAnnahmestelle([zeile('661430035', '71'), zeile('661430035', '71', { adl: '30' })],
    { ketten: podoKette });
  assert.equal(t.kandidaten, 1);
});

// --- Kettenaufbau ---------------------------------------------------------

test('abrechnungscodeKette: Podologie ueberspringt die 20', () => {
  assert.deepEqual(abrechnungscodeKette('podologie', '71'), [['71', '72'], ['99'], ['00']]);
  assert.ok(!abrechnungscodeKette('podologie', '71').flat().includes('20'));
});

test('abrechnungscodeKette: Physio/Ergo/Logo behalten die 20', () => {
  assert.deepEqual(abrechnungscodeKette('physiotherapy', '22'), [['22'], ['20'], ['99'], ['00']]);
  assert.deepEqual(abrechnungscodeKette('ergotherapie', '25'), [['25'], ['20'], ['99'], ['00']]);
  assert.deepEqual(abrechnungscodeKette('logopaedie', '27'), [['27'], ['20'], ['99'], ['00']]);
});

test('abrechnungscodeKette: ohne eigenen Code faellt die erste Stufe weg', () => {
  assert.deepEqual(abrechnungscodeKette('physiotherapy', null), [['20'], ['99'], ['00']]);
});
