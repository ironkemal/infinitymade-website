import { test } from 'node:test';
import assert from 'node:assert/strict';
import { behandlungspositionVorschlag } from './podo-behandlungsposition-regel.js';

test('Maßnahme a) Hornhautabtragung -> immer 78010', () => {
  assert.equal(behandlungspositionVorschlag('a'), '78010');
  // auch wenn das Rezept (falsch) 78020 traegt — a)/b) sind nie 78020.
  assert.equal(behandlungspositionVorschlag('a', '78020'), '78010');
});

test('Maßnahme b) Nagelbearbeitung -> immer 78010', () => {
  assert.equal(behandlungspositionVorschlag('b'), '78010');
  assert.equal(behandlungspositionVorschlag('b', '78020'), '78010');
});

test('Maßnahme c) Komplexbehandlung -> Vorschlag 78010, nicht 78020', () => {
  // 78020 ist bei c) zulaessig, aber die >20-Minuten-Entscheidung faellt je
  // Sitzung — das Rezept allein rechtfertigt keine Vorbelegung auf 78020.
  assert.equal(behandlungspositionVorschlag('c'), '78010');
  assert.equal(behandlungspositionVorschlag('c', '78020'), '78010');
});

test('unbekannte Maßnahme (Altbestand) -> rohe Rezeptposition, wenn 78010/78020', () => {
  assert.equal(behandlungspositionVorschlag('', '78010'), '78010');
  assert.equal(behandlungspositionVorschlag('', '78020'), '78020');
});

test('unbekannte Maßnahme + unbekannte/andere Position -> keine Vorbelegung', () => {
  assert.equal(behandlungspositionVorschlag('', ''), '');
  assert.equal(behandlungspositionVorschlag('', '78610'), '');
  assert.equal(behandlungspositionVorschlag(undefined, undefined), '');
});

// Reform Podoloji (b), 30.09.2026 — Diagnosegruppe als Rückfall (QA 3e256b9a: leere Vorbelegung).
test('DF/NF/QF ohne Maßnahme und ohne Rezeptposition -> 78010', () => {
  for (const dg of ['DF', 'NF', 'QF', 'df', 'DF-a', ' NF ']) {
    assert.equal(behandlungspositionVorschlag('', '', dg), '78010', dg);
  }
});
test('UI1/UI2/leer/unbekannt ohne Maßnahme -> weiter keine Vorbelegung', () => {
  for (const dg of ['UI1', 'UI2', '', undefined, 'XX']) {
    assert.equal(behandlungspositionVorschlag('', '', dg), '');
  }
});
test('DG ändert nichts, wo Maßnahme oder Rezeptposition entscheidet', () => {
  assert.equal(behandlungspositionVorschlag('', '78020', 'DF'), '78020');
  assert.equal(behandlungspositionVorschlag('c', '78020', 'DF'), '78010');
  assert.equal(behandlungspositionVorschlag('a', '', 'UI1'), '78010');
});

import { ohneBehandlungsposition, leitsymptomatikNotiz, LS_FEHLT_NOTIZ } from './podo-behandlungsposition-regel.js';
test('ohneBehandlungsposition: nur DF/NF/QF, nur wenn etwas gewählt und weder 78010 noch 78020', () => {
  assert.equal(ohneBehandlungsposition('DF', ['78030']), true);
  assert.equal(ohneBehandlungsposition('NF', ['78040', '78030']), true);
  assert.equal(ohneBehandlungsposition('QF', ['78030', '78010']), false);
  assert.equal(ohneBehandlungsposition('DF', ['78020']), false);
  assert.equal(ohneBehandlungsposition('DF', []), false);         // nichts gewählt bleibt Blocker (pod_kein_hpnr)
  assert.equal(ohneBehandlungsposition('UI1', ['78610']), false);
  assert.equal(ohneBehandlungsposition('', ['78030']), false);
});
test('leitsymptomatikNotiz: nur DF/NF/QF ohne jede Leitsymptomatik', () => {
  assert.equal(leitsymptomatikNotiz({ dg: 'DF' }), LS_FEHLT_NOTIZ);
  assert.equal(leitsymptomatikNotiz({ dg: 'NF', massnahme: '', roh: ' ', freitext: '' }), LS_FEHLT_NOTIZ);
  assert.equal(leitsymptomatikNotiz({ dg: 'DF', massnahme: 'a' }), '');
  assert.equal(leitsymptomatikNotiz({ dg: 'DF', freitext: 'individuell' }), '');
  assert.equal(leitsymptomatikNotiz({ dg: 'DF', roh: '0001' }), '');
  assert.equal(leitsymptomatikNotiz({ dg: 'UI1' }), '');
  assert.equal(leitsymptomatikNotiz({ dg: 'UI2' }), '');
});

// P1 canli-test 30.09.2026: Maske speichert die an4-Bitmaske.
import { massnahmeAusLeitsymptomatik as mls } from './podo-behandlungsposition-regel.js';
test('massnahmeAusLeitsymptomatik: Buchstabe, DG-Präfix und an4-Bitmaske', () => {
  assert.equal(mls('c'), 'c');
  assert.equal(mls('DF-b'), 'b');
  assert.equal(mls('0010'), 'c');
  assert.equal(mls('1000'), 'a');
  assert.equal(mls('0100'), 'b');
  assert.equal(mls('1010'), 'c');   // c umfasst a+b
  assert.equal(mls('1100'), '');    // zwei Kreuze ohne c: keine geratene Regel
  assert.equal(mls('0001'), '');    // nur patientenindividuell
  assert.equal(mls('0000'), '');
  assert.equal(mls(''), '');
});
