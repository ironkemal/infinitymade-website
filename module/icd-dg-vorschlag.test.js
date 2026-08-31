/**
 * icd-dg-vorschlag.test.js — Vorschlag und Sperre von Diagnosegruppen.
 *
 * Prueft die reine Logik aus icd-dg-match.js (dgSperrenFuerIcd / dgVorschlag /
 * normDgCode). Die Regeln sind hier bewusst als Kopie der Podologie-Zeilen aus
 * der Tabelle `diagnosegruppen` notiert — der Test soll fehlschlagen, wenn sich
 * die Semantik aendert, nicht wenn sich ein Datensatz aendert.
 *
 * Der wichtigste Satz steht in der Fallgruppe „warn sperrt nicht": nach
 * Anlage 3 k HeilM-RL ist der ICD nicht Pflicht, deshalb darf eine
 * warn-Regel nie eine Auswahl verhindern.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { normDgCode, dgSperrenFuerIcd, dgVorschlag } from '../icd-dg-match.js';
import { dgOptionenSperren } from './diagnosegruppen-regeln.js';

const REGELN = {
  DF: {
    icd_accept: [{ re: '^E1[0-4]\\.7[45]$' }, { re: '^E1[0-4]\\.4[01]$' }, { re: '^G63\\.2\\*?$' }],
    icd_exclude: [],
    icd_auto_select: [{ re: '^E1[0-4]\\.7[45]$' }, { re: '^E1[0-4]\\.4[01]$' }, { re: '^G63\\.2\\*?$' }],
    icd_accept_unsicher: [{ re: '^E1[0-4]\\.7[23]$' }],
    icd_enforcement: 'warn',
  },
  NF: {
    icd_accept: [{ re: '^G60\\.' }, { re: '^G61\\.' }, { re: '^G62\\.' }, { re: '^G63\\.[013-68]\\*?$' }],
    icd_exclude: [{ re: '^G63\\.2\\*?$', note: 'diabetisch → DF' }, { re: '^E1[0-4]\\.' }],
    icd_auto_select: [{ re: '^G6[012]\\.' }, { re: '^G63\\.[013-68]\\*?$' }],
    icd_accept_unsicher: [],
    icd_enforcement: 'warn',
  },
  QF: {
    icd_accept: [{ re: '^G82\\.[0-5][0-3]$' }, { re: '^T09\\.3$' }],
    icd_exclude: [], icd_auto_select: [{ re: '^T09\\.3$' }], icd_accept_unsicher: [],
    icd_enforcement: 'warn',
  },
  UI1: { icd_accept: [{ re: '^L60\\.0$' }], icd_exclude: [], icd_auto_select: [], icd_accept_unsicher: [], icd_enforcement: 'hard_before_dta' },
  UI2: { icd_accept: [{ re: '^L60\\.0$' }], icd_exclude: [], icd_auto_select: [], icd_accept_unsicher: [], icd_enforcement: 'hard_before_dta' },
};

test('normDgCode schneidet die Untergruppe ab', () => {
  assert.equal(normDgCode('DF-a'), 'DF');
  assert.equal(normDgCode(' df-c '), 'DF');
  assert.equal(normDgCode('UI2'), 'UI2');
  assert.equal(normDgCode(''), '');
  assert.equal(normDgCode(null), '');
});

test('harte Regel sperrt: E11.74 schliesst UI1/UI2 aus, mit erwartetem Kode', () => {
  const gesperrt = dgSperrenFuerIcd(['E11.74'], REGELN);
  assert.deepEqual(gesperrt.map(g => g.dg).sort(), ['UI1', 'UI2']);
  assert.equal(gesperrt[0].grund, 'hart');
  assert.equal(gesperrt[0].erwartet, 'L60.0');   // speist „nur mit L60.0"
});

test('warn sperrt nicht: DF/NF/QF bleiben bei jedem Kode waehlbar', () => {
  // Anlage 3 k: der ICD ist nicht Pflicht, ein abweichender Kode kann richtig
  // sein. Eine warn-Regel darf deshalb nie sperren — nur warnen.
  for (const codes of [['E11.74'], ['G60.9'], ['T09.3'], ['Z99.9']]) {
    const dgs = dgSperrenFuerIcd(codes, REGELN).map(g => g.dg);
    assert.ok(!dgs.includes('DF') && !dgs.includes('NF') && !dgs.includes('QF'),
      `warn-Gruppe gesperrt bei ${codes}: ${dgs}`);
  }
});

test('passender Kode sperrt seine eigene Gruppe nicht', () => {
  assert.deepEqual(dgSperrenFuerIcd(['L60.0'], REGELN), []);
});

test('ohne Kode wird nichts gesperrt', () => {
  assert.deepEqual(dgSperrenFuerIcd([], REGELN), []);
  assert.deepEqual(dgVorschlag([], REGELN).gesperrt, []);
});

test('dgVorschlag: eindeutiger Kode wird vorgeschlagen', () => {
  const v = dgVorschlag(['E11.74'], REGELN);
  assert.equal(v.auto, 'DF');
  assert.deepEqual(v.kandidaten, ['DF']);
  assert.equal(v.normativ, false);
});

test('dgVorschlag: L60.0 schlaegt nichts vor, benennt aber die Kandidaten', () => {
  // UI1 und UI2 unterscheiden sich im Stadium, nicht im Kode — das kann die
  // Software nicht entscheiden. Deshalb Rueckfrage statt Auswahl.
  const v = dgVorschlag(['L60.0'], REGELN);
  assert.equal(v.auto, null);
  assert.deepEqual(v.kandidaten.sort(), ['UI1', 'UI2']);
  assert.equal(v.normativ, true);
  assert.deepEqual(v.gesperrt.map(g => g.dg).sort(), ['DF', 'NF', 'QF']);
  assert.ok(v.gesperrt.every(g => g.grund === 'normativ'));
});

test('dgVorschlag: L60.0 neben einem freien Kode sperrt NICHT normativ', () => {
  // Diabetiker mit eingewachsenem Nagel. Die fest verdrahtete L60.0-Behandlung
  // hat DF hier frueher ausgeblendet — falsch, beide Befunde stehen nebeneinander.
  const v = dgVorschlag(['L60.0', 'E11.74'], REGELN);
  assert.equal(v.normativ, false);
  assert.ok(v.kandidaten.includes('DF'));
  assert.deepEqual(v.gesperrt, [], 'kein Ausschluss, solange die Kodemenge nicht eindeutig ist');
});

test('dgVorschlag: Ausschlussregel schlaegt durch — G63.2 ist DF, nicht NF', () => {
  const v = dgVorschlag(['G63.2'], REGELN);
  assert.equal(v.auto, 'DF');
  assert.ok(!v.kandidaten.includes('NF'));
});

test('dgVorschlag: mehrdeutiger Kode schlaegt nichts vor, nennt aber alle Treffer', () => {
  const zweideutig = { ...REGELN, XX: { ...REGELN.DF } };
  const v = dgVorschlag(['E11.74'], zweideutig);
  assert.equal(v.auto, null, 'zwei Gruppen passen → keine automatische Auswahl');
  assert.deepEqual(v.kandidaten.sort(), ['DF', 'XX']);
});

test('unbekannter Kode: keine Kandidaten, aber die harten Gruppen sind gesperrt', () => {
  const v = dgVorschlag(['Z99.9'], REGELN);
  assert.equal(v.auto, null);
  assert.deepEqual(v.kandidaten, []);
  assert.deepEqual(v.gesperrt.map(g => g.dg).sort(), ['UI1', 'UI2']);
});

// ── dgOptionenSperren ───────────────────────────────────────────────────────
// Kein jsdom: das Modul fasst nur tagName/options/value und je Option
// dataset/textContent/disabled/style an. Ein Stellvertreter mit genau diesen
// Feldern prueft dasselbe Verhalten und laesst den Test in `node --test` laufen.
function fakeSelect(werte, gewaehlt = '') {
  const options = werte.map(v => ({
    value: v, textContent: v ? v + ' - Text' : '- Waehlen -',
    dataset: {}, disabled: false, style: {},
  }));
  return { tagName: 'SELECT', options, value: gewaehlt };
}
const T = { pod_dg_nur_mit: 'nur mit {icd}', pod_dg_passt_nicht: 'passt nicht zu {icd}' };
const t = k => T[k] || k;
const WERTE = ['', 'DF-a', 'DF-b', 'NF', 'QF', 'UI1', 'UI2'];

test('sperren: die Begruendung steht an der Option, nichts wird ausgeblendet', () => {
  const sel = fakeSelect(WERTE);
  const v = dgVorschlag(['E11.74'], REGELN);
  const res = dgOptionenSperren(sel, v, { codes: ['E11.74'], t });

  assert.deepEqual(res.gesperrt.sort(), ['UI1', 'UI2']);
  const ui1 = sel.options.find(o => o.value === 'UI1');
  assert.equal(ui1.disabled, true);
  assert.equal(ui1.textContent, 'UI1 - Text — nur mit L60.0', 'der Grund muss lesbar dastehen');
  // Keine stumme Sperre: sichtbar bleibt sie in jedem Fall.
  assert.ok(sel.options.every(o => o.style.display === ''), 'nichts wird ausgeblendet');
  // warn-Gruppen bleiben waehlbar.
  assert.equal(sel.options.find(o => o.value === 'DF-a').disabled, false);
  assert.equal(sel.options.find(o => o.value === '').disabled, false, 'Platzhalter bleibt waehlbar');
});

test('sperren: Untergruppen erben die Sperre ihrer Wurzel', () => {
  const sel = fakeSelect(WERTE);
  dgOptionenSperren(sel, dgVorschlag(['L60.0'], REGELN), { codes: ['L60.0'], t });
  assert.equal(sel.options.find(o => o.value === 'DF-a').disabled, true);
  assert.equal(sel.options.find(o => o.value === 'DF-b').disabled, true);
  assert.equal(sel.options.find(o => o.value === 'DF-a').textContent, 'DF-a - Text — passt nicht zu L60.0');
  assert.equal(sel.options.find(o => o.value === 'UI1').disabled, false);
});

test('sperren: eine gesperrte Auswahl wird nur beim Verlassen des Feldes geraeumt', () => {
  // Waehrend des Tippens ist "L60" auf dem Weg zu "L60.0" kurz ein Fehltreffer.
  const tippen = fakeSelect(WERTE, 'UI2');
  const vTeil  = dgVorschlag(['L60'], REGELN);
  const r1 = dgOptionenSperren(tippen, vTeil, { codes: ['L60'], t, raeumen: false });
  assert.equal(tippen.options.find(o => o.value === 'UI2').disabled, true);
  assert.equal(tippen.value, 'UI2', 'die Auswahl darf beim Tippen nicht verlorengehen');
  assert.equal(r1.geraeumt, false);

  const verlassen = fakeSelect(WERTE, 'UI2');
  const r2 = dgOptionenSperren(verlassen, dgVorschlag(['E11.74'], REGELN), { codes: ['E11.74'], t, raeumen: true });
  assert.equal(verlassen.value, '', 'beim Verlassen wird die unmoegliche Auswahl geraeumt');
  assert.equal(r2.geraeumt, true);
});

test('sperren: Zuruecksetzen stellt jede Beschriftung wieder her', () => {
  const sel = fakeSelect(WERTE);
  dgOptionenSperren(sel, dgVorschlag(['E11.74'], REGELN), { codes: ['E11.74'], t });
  const res = dgOptionenSperren(sel, null, { t });
  assert.deepEqual(res.gesperrt, []);
  assert.ok(sel.options.every(o => o.disabled === false));
  assert.equal(sel.options.find(o => o.value === 'UI1').textContent, 'UI1 - Text');
});

test('sperren: ein Textfeld bleibt unberuehrt (dort engt nurCodes ein)', () => {
  const input = { tagName: 'INPUT', value: 'UI1' };
  const res = dgOptionenSperren(input, dgVorschlag(['E11.74'], REGELN), { codes: ['E11.74'], t });
  assert.deepEqual(res, { gesperrt: [], geraeumt: false });
  assert.equal(input.value, 'UI1');
});
