/**
 * Tests für die Verordnungsprüfung (Ops-Karte 76).
 *
 * Der Motor ist bewusst eine reine Funktion — deshalb sind die Regeln hier
 * ohne DOM und ohne Datenbank prüfbar. Die Regelzeilen unten sind Ausschnitte
 * echter `diagnosegruppen`-Zeilen (Stand 03.09.2026).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pruefeVerordnung, zaehleBefunde, SCHWERE } from './verordnung-pruefung.js';
import { regelnFuerBereich, dgWurzel, bereichSchluessel, POD_HOECHSTMENGE } from './verordnung-regeln.js';

// Ausschnitt aus `diagnosegruppen` (bereich = podologie). `hoechstmenge` ist
// dort heute NULL — genau deshalb greift der Rückfall aus verordnung-regeln.js.
const PODO_ZEILEN = [
  {
    code: 'DF', label: 'Diabetisches Fußsyndrom', hoechstmenge: null,
    icd_accept: [{ re: '^E1[0-4]\\.7[45]$' }, { re: '^E1[0-4]\\.4[01]$' }],
    icd_exclude: [], icd_accept_unsicher: [], icd_enforcement: 'warn',
  },
  {
    code: 'UI1', label: 'Unguis incarnatus 1', hoechstmenge: null,
    icd_accept: [{ re: '^L60\\.0$' }],
    icd_exclude: [], icd_accept_unsicher: [], icd_enforcement: 'hard_before_dta',
  },
  {
    code: 'UI2', label: 'Unguis incarnatus 2', hoechstmenge: null,
    icd_accept: [{ re: '^L60\\.0$' }],
    icd_exclude: [], icd_accept_unsicher: [], icd_enforcement: 'warn',
  },
];

// Physio: Höchstmenge gepflegt, ICD-Zuordnung leer.
const PHYSIO_ZEILEN = [
  { code: 'WS2', label: 'Wirbelsäule 2', hoechstmenge: 6, icd_accept: [], icd_exclude: [], icd_accept_unsicher: [], icd_enforcement: 'warn' },
];

const PODO = regelnFuerBereich('podologie', PODO_ZEILEN);
const PHYSIO = regelnFuerBereich('physiotherapy', PHYSIO_ZEILEN);

/** Eine in jeder Hinsicht saubere podologische Verordnung. */
function saubereVo(ueber = {}) {
  return {
    bereich: 'podologie',
    icd: 'E11.74',
    diagnosegruppe: 'DF',
    leitsymptomatik: ['a'],
    heilmittel: 'Hornhautabtragung',
    heilmittelPosition: '78010',
    anzahl: 6,
    frequenz: '1x wöchentlich',
    ausstellungsdatum: '2026-09-01',
    behandlungsbeginn: '2026-09-10',
    dringend: false,
    versichertennummer: 'A123456789',
    kasseIk: '101575519',
    arztLanr: '123456789',
    arztBsnr: '987654321',
    rezeptart: 'gkv',
    ...ueber,
  };
}

const HEUTE = { heute: '2026-09-03' };
const codes = e => e.befunde.map(b => b.code);

// ── Regelsatz ───────────────────────────────────────────────────────────────

test('dgWurzel schneidet die Leitsymptomatik ab, UI-Gruppen bleiben ganz', () => {
  assert.equal(dgWurzel('DF-a'), 'DF');
  assert.equal(dgWurzel('df'), 'DF');
  assert.equal(dgWurzel('UI 1'), 'UI1');
  assert.equal(dgWurzel(''), '');
});

test('bereichSchluessel bildet die englische DB-Schreibweise ab', () => {
  assert.equal(bereichSchluessel('Podologie'), 'podologie');
  assert.equal(bereichSchluessel('physiotherapy'), 'physiotherapy');
  assert.equal(bereichSchluessel('physiotherapie'), 'physiotherapy');
  assert.equal(bereichSchluessel('logopaedie'), 'logopaedie');
});

test('Höchstmenge kommt aus dem Rückfall, solange die Spalte leer ist', () => {
  assert.equal(PODO.gruppen.UI1.hoechstmenge, POD_HOECHSTMENGE.UI1);
  assert.equal(PODO.gruppen.UI2.hoechstmenge, 4);
  assert.match(PODO.gruppen.UI2.hoechstmengeQuelle, /Anlage 3/);
});

test('ein gepflegter Datenbankwert gewinnt gegen den Rückfall', () => {
  const r = regelnFuerBereich('podologie', [{ ...PODO_ZEILEN[0], hoechstmenge: 9 }]);
  assert.equal(r.gruppen.DF.hoechstmenge, 9);
  assert.equal(r.gruppen.DF.hoechstmengeQuelle, 'diagnosegruppen.hoechstmenge');
});

test('fehlende Regeldaten werden als Lücke benannt, nicht verschwiegen', () => {
  const ergo = regelnFuerBereich('ergotherapie', [
    { code: 'SB1', hoechstmenge: null, icd_accept: [], icd_exclude: [], icd_accept_unsicher: [] },
  ]);
  assert.equal(ergo.luecken.length, 3);
  assert.ok(ergo.luecken.some(l => /Höchstmengen/.test(l)));
  assert.ok(ergo.luecken.some(l => /ICD-Zuordnung/.test(l)));
  assert.ok(ergo.luecken.some(l => /Leitsymptomatik/.test(l)));
});

// ── Der saubere Fall ────────────────────────────────────────────────────────

test('eine stimmige Verordnung meldet gar nichts', () => {
  const e = pruefeVerordnung(saubereVo(), PODO, HEUTE);
  assert.equal(e.ok, true);
  assert.equal(e.sauber, true, `unerwartet: ${JSON.stringify(e.befunde)}`);
  assert.deepEqual(codes(e), []);
  assert.ok(e.geprueft.includes('ICD ⇄ Diagnosegruppe'));
  assert.deepEqual(e.ungeprueft, []);
});

test('ohne eingetragenen Beginn nennt die Pruefung die laufende Frist', () => {
  const e = pruefeVerordnung(saubereVo({ behandlungsbeginn: '' }), PODO, HEUTE);
  const b = e.befunde.find(x => x.code === 'FRIST_LAEUFT');
  assert.equal(b.schwere, SCHWERE.hinweis);
  assert.match(b.text, /29\.09\.2026/);
  assert.equal(e.sauber, true, 'ein Hinweis truebt das Urteil nicht');
});

// ── Pflichtangaben ──────────────────────────────────────────────────────────

test('fehlende Pflichtangaben blockieren, fehlende LANR warnt nur', () => {
  const e = pruefeVerordnung(saubereVo({ versichertennummer: '', arztLanr: '' }), PODO, HEUTE);
  assert.equal(e.ok, false);
  const vsnr = e.befunde.find(b => b.code === 'PFLICHT_VERSICHERTENNUMMER');
  const lanr = e.befunde.find(b => b.code === 'PFLICHT_ARZTLANR');
  assert.equal(vsnr.schwere, SCHWERE.blocker);
  assert.equal(lanr.schwere, SCHWERE.warnung);
});

test('beim Selbstzahler entfallen Kasse, Versichertennummer und Arztnummern', () => {
  const e = pruefeVerordnung(
    saubereVo({ rezeptart: 'selbstzahler', versichertennummer: '', kasseIk: '', arztLanr: '', arztBsnr: '', heilmittelPosition: '' }),
    PODO, HEUTE);
  assert.equal(e.ok, true);
  assert.equal(codes(e).filter(c => c.startsWith('PFLICHT_')).length, 0);
  assert.ok(!codes(e).includes('POSITION_FEHLT'));
});

test('Anzahl 0 ist ein Blocker', () => {
  const e = pruefeVerordnung(saubereVo({ anzahl: 0 }), PODO, HEUTE);
  assert.ok(codes(e).includes('PFLICHT_ANZAHL'));
  assert.equal(e.ok, false);
});

test('ohne ICD blockiert die Podologie, Physio gibt nur einen Hinweis', () => {
  const podo = pruefeVerordnung(saubereVo({ icd: '' }), PODO, HEUTE);
  assert.equal(podo.befunde.find(b => b.code === 'PFLICHT_ICD').schwere, SCHWERE.blocker);

  const physio = pruefeVerordnung({
    bereich: 'physiotherapy', icd: '', diagnosegruppe: 'WS2', heilmittel: 'KG',
    heilmittelPosition: 'X0501', anzahl: 6, frequenz: '2x wöchentlich',
    ausstellungsdatum: '2026-09-01', versichertennummer: 'A1', kasseIk: '101575519',
    arztLanr: '1', arztBsnr: '2', rezeptart: 'gkv',
  }, PHYSIO, HEUTE);
  assert.equal(physio.befunde.find(b => b.code === 'ICD_FEHLT').schwere, SCHWERE.hinweis);
  assert.equal(physio.ok, true);
});

// ── ICD ⇄ Diagnosegruppe ────────────────────────────────────────────────────

test('ein fachfremder Kode warnt — bei harter Regel blockiert er', () => {
  const weich = pruefeVerordnung(saubereVo({ icd: 'M54.5' }), PODO, HEUTE);
  assert.equal(weich.befunde.find(b => b.code === 'ICD_DG_MISMATCH').schwere, SCHWERE.warnung);
  assert.equal(weich.ok, true);

  const hart = pruefeVerordnung(
    saubereVo({ diagnosegruppe: 'UI1', icd: 'E11.74', leitsymptomatik: ['a'], heilmittel: 'Nagelspangenbehandlung', anzahl: 8 }),
    PODO, HEUTE);
  const b = hart.befunde.find(x => x.code === 'ICD_DG_MISMATCH');
  assert.equal(b.schwere, SCHWERE.blocker);
  assert.match(b.text, /setzt diese Kombination ab/);
  assert.equal(hart.ok, false);
});

test('eine unbekannte Diagnosegruppe des falschen Fachbereichs blockiert', () => {
  const e = pruefeVerordnung(saubereVo({ diagnosegruppe: 'WS2' }), PODO, HEUTE);
  assert.ok(codes(e).includes('DG_UNBEKANNT'));
  assert.equal(e.ok, false);
});

test('ohne ICD-Regeldaten wird die Zuordnung nicht geprüft und als Lücke gemeldet', () => {
  const e = pruefeVerordnung({
    bereich: 'physiotherapy', icd: 'M54.5', diagnosegruppe: 'WS2', heilmittel: 'KG',
    heilmittelPosition: 'X0501', anzahl: 6, frequenz: '2x', ausstellungsdatum: '2026-09-01',
    versichertennummer: 'A1', kasseIk: '1', arztLanr: '1', arztBsnr: '2', rezeptart: 'gkv',
  }, PHYSIO, HEUTE);
  assert.ok(!e.geprueft.includes('ICD ⇄ Diagnosegruppe'));
  assert.ok(e.ungeprueft.some(l => /ICD-Zuordnung/.test(l)));
});

// ── Höchstmenge ─────────────────────────────────────────────────────────────

test('UI 2 warnt ab der fünften Einheit und erklärt die orientierende Menge', () => {
  const e = pruefeVerordnung(
    saubereVo({ diagnosegruppe: 'UI2', icd: 'L60.0', anzahl: 8, heilmittel: 'Nagelspangenbehandlung' }),
    PODO, HEUTE);
  const b = e.befunde.find(x => x.code === 'UEBER_HOECHSTMENGE');
  assert.equal(b.schwere, SCHWERE.warnung);
  assert.match(b.text, /maximal 4/);
  assert.match(b.text, /orientierende Menge/);
  assert.equal(e.ok, true, 'die Papierverordnung muss erfassbar bleiben');
});

test('UI 1 erlaubt acht Einheiten', () => {
  const e = pruefeVerordnung(
    saubereVo({ diagnosegruppe: 'UI1', icd: 'L60.0', anzahl: 8, heilmittel: 'Nagelspangenbehandlung' }),
    PODO, HEUTE);
  assert.ok(!codes(e).includes('UEBER_HOECHSTMENGE'));
});

// ── Leitsymptomatik ─────────────────────────────────────────────────────────

test('b) gibt es in UI 1 nicht — das ist ein Fehler auf der Verordnung', () => {
  const e = pruefeVerordnung(
    saubereVo({ diagnosegruppe: 'UI1', icd: 'L60.0', anzahl: 8, leitsymptomatik: ['b'], heilmittel: 'Nagelspangenbehandlung' }),
    PODO, HEUTE);
  const b = e.befunde.find(x => x.code === 'LS_UNBEKANNT');
  assert.equal(b.schwere, SCHWERE.blocker);
  assert.match(b.text, /nur die Leitsymptomatik a\)/);
});

test('a und b zusammen ergeben in DF die Komplexbehandlung', () => {
  const e = pruefeVerordnung(
    saubereVo({ leitsymptomatik: ['a', 'b'], heilmittel: 'Podologische Komplexbehandlung' }),
    PODO, HEUTE);
  assert.ok(!codes(e).includes('LS_HEILMITTEL_ABWEICHUNG'));
});

test('weicht das Heilmittelfeld vom Katalog ab, wird das benannt statt überschrieben', () => {
  const e = pruefeVerordnung(saubereVo({ leitsymptomatik: ['b'] }), PODO, HEUTE);
  const b = e.befunde.find(x => x.code === 'LS_HEILMITTEL_ABWEICHUNG');
  assert.match(b.text, /Nagelbearbeitung/);
  assert.match(b.text, /Hornhautabtragung/);
  assert.equal(b.schwere, SCHWERE.warnung);
});

test('c) zusätzlich zu a) ist redundant, aber kein Fehler', () => {
  const e = pruefeVerordnung(
    saubereVo({ leitsymptomatik: 'ac', heilmittel: 'Podologische Komplexbehandlung' }),
    PODO, HEUTE);
  assert.equal(e.befunde.find(x => x.code === 'LS_REDUNDANT').schwere, SCHWERE.hinweis);
  assert.equal(e.ok, true);
});

test('die drei Schreibweisen der Leitsymptomatik führen zum selben Ergebnis', () => {
  const alsListe = pruefeVerordnung(saubereVo({ leitsymptomatik: ['b'] }), PODO, HEUTE);
  const alsObjekt = pruefeVerordnung(saubereVo({ leitsymptomatik: { a: false, b: true } }), PODO, HEUTE);
  const alsMaske = pruefeVerordnung(saubereVo({ leitsymptomatik: '0100' }), PODO, HEUTE);
  assert.deepEqual(codes(alsObjekt), codes(alsListe));
  assert.deepEqual(codes(alsMaske), codes(alsListe));
});

test('keine Leitsymptomatik angekreuzt ist eine Warnung', () => {
  const e = pruefeVerordnung(saubereVo({ leitsymptomatik: [] }), PODO, HEUTE);
  assert.equal(e.befunde.find(x => x.code === 'LS_FEHLT').schwere, SCHWERE.warnung);
});

// ── Fristen ─────────────────────────────────────────────────────────────────

test('Behandlungsbeginn vor dem Ausstellungsdatum blockiert', () => {
  const e = pruefeVerordnung(saubereVo({ behandlungsbeginn: '2026-08-30' }), PODO, HEUTE);
  assert.equal(e.befunde.find(x => x.code === 'BEGINN_VOR_AUSSTELLUNG').schwere, SCHWERE.blocker);
  assert.equal(e.ok, false);
});

test('ein Ausstellungsdatum in der Zukunft blockiert', () => {
  const e = pruefeVerordnung(
    saubereVo({ ausstellungsdatum: '2026-09-20', behandlungsbeginn: '2026-09-25' }), PODO, HEUTE);
  assert.ok(codes(e).includes('AUSSTELLUNG_ZUKUNFT'));
});

test('28 Tage im Regelfall, 14 bei dringlichem Bedarf', () => {
  const spaet = { ausstellungsdatum: '2026-08-01', behandlungsbeginn: '2026-08-20' };
  const normal = pruefeVerordnung(saubereVo(spaet), PODO, HEUTE);
  assert.ok(!codes(normal).includes('FRIST_VERSAEUMT'), '19 Tage sind im Regelfall in Ordnung');

  const dringend = pruefeVerordnung(saubereVo({ ...spaet, dringend: true }), PODO, HEUTE);
  const b = dringend.befunde.find(x => x.code === 'FRIST_VERSAEUMT');
  assert.match(b.text, /14 Kalendertage/);
  assert.equal(b.schwere, SCHWERE.warnung);
});

test('abgelaufene Frist ohne begonnene Behandlung wird gemeldet', () => {
  const e = pruefeVerordnung(
    saubereVo({ ausstellungsdatum: '2026-07-01', behandlungsbeginn: '' }), PODO, HEUTE);
  const b = e.befunde.find(x => x.code === 'FRIST_ABGELAUFEN');
  assert.match(b.text, /29\.07\.2026/);
});

// ── Zählwerk ────────────────────────────────────────────────────────────────

test('zaehleBefunde trennt Blocker, Warnungen und Hinweise', () => {
  const e = pruefeVerordnung(
    saubereVo({ diagnosegruppe: 'UI1', icd: 'E11.74', anzahl: 9, leitsymptomatik: ['b'] }),
    PODO, HEUTE);
  const z = zaehleBefunde(e);
  assert.ok(z.blocker >= 2, JSON.stringify(codes(e)));
  assert.equal(e.ok, false);
});

test('ohne Regeldaten wird nichts erfunden', () => {
  const leer = regelnFuerBereich('logopaedie', []);
  const e = pruefeVerordnung({ bereich: 'logopaedie', diagnosegruppe: 'ST1', rezeptart: 'selbstzahler' }, leer, HEUTE);
  assert.ok(!e.geprueft.includes('Diagnosegruppe'));
  assert.ok(e.ungeprueft.some(l => /keine Diagnosegruppen hinterlegt/.test(l)));
});
