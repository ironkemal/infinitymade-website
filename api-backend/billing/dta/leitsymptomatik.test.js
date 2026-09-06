import test from 'node:test';
import assert from 'node:assert/strict';
import { leitsymptomatikAlsBitmaske, LEITSYMPTOMATIK_MUSTER } from './leitsymptomatik.js';
import { verordnungsartFuer, heilmittelBereichFuer } from './zhe-kennzeichen.js';

// ── Was die Maske schon richtig macht, bleibt unangetastet ────────────────
test('an4-Werte gehen unveraendert durch', () => {
  for (const w of ['0000', '1000', '0100', '0010', '0001', '1010', '1111']) {
    assert.equal(leitsymptomatikAlsBitmaske(w), w);
  }
});

test('9999 (Verordnung ausserhalb der HeilM-RL) bleibt stehen', () => {
  assert.equal(leitsymptomatikAlsBitmaske('9999'), '9999');
});

// ── Der Altbestand, der die ganze Datei gekippt haette ───────────────────
test('blosser Buchstabe wird zur Bitmaske', () => {
  assert.equal(leitsymptomatikAlsBitmaske('a'), '1000');
  assert.equal(leitsymptomatikAlsBitmaske('b'), '0100');
  assert.equal(leitsymptomatikAlsBitmaske('c'), '0010');
  assert.equal(leitsymptomatikAlsBitmaske('ab'), '1100');
  assert.equal(leitsymptomatikAlsBitmaske('ac'), '1010');
});

test('"DF-c" verliert die Diagnosegruppe und setzt NICHT die 4. Stelle', () => {
  // Der Kern des Fehlers: "DF" enthaelt ein d. Wer nur [abcd] filtert,
  // behauptet hier eine patientenindividuelle Leitsymptomatik.
  assert.equal(leitsymptomatikAlsBitmaske('DF-c', { diagnosegruppe: 'DF' }), '0010');
  assert.equal(leitsymptomatikAlsBitmaske('DF-c'), '0010');
});

test('Praefix auch ohne passende Diagnosegruppe und mit Leerzeichen', () => {
  assert.equal(leitsymptomatikAlsBitmaske('NF -b'), '0100');
  assert.equal(leitsymptomatikAlsBitmaske('UI1: a', { diagnosegruppe: 'UI1' }), '1000');
});

test('Grossschreibung und Rand-Leerzeichen stoeren nicht', () => {
  assert.equal(leitsymptomatikAlsBitmaske('  AC  '), '1010');
});

// ── Vierte Stelle ────────────────────────────────────────────────────────
test('ausdrueckliches d setzt die 4. Stelle', () => {
  assert.equal(leitsymptomatikAlsBitmaske('ad'), '1001');
});

test('Freitext setzt die 4. Stelle auch ohne d', () => {
  assert.equal(
    leitsymptomatikAlsBitmaske('a', { patientenText: 'Druckschmerz plantar' }),
    '1001'
  );
});

test('leerer Freitext setzt sie nicht', () => {
  assert.equal(leitsymptomatikAlsBitmaske('a', { patientenText: '   ' }), '1000');
});

test('vorhandener an4-Wert wird vom Freitext NICHT ueberschrieben', () => {
  // Das Kreuz auf dem Papier ist die Aussage des Arztes; die Maske hat es
  // bereits sauber uebersetzt.
  assert.equal(
    leitsymptomatikAlsBitmaske('0010', { patientenText: 'irgendwas' }),
    '0010'
  );
});

// ── Podologie-Sonderfall ─────────────────────────────────────────────────
test('UI1/UI2 fallen auf den Katalogbuchstaben zurueck', () => {
  // Podologie-Vertrag Anlage 3 l): UI1 = a, UI2 = b
  assert.equal(leitsymptomatikAlsBitmaske('', { diagnosegruppe: 'UI1' }), '1000');
  assert.equal(leitsymptomatikAlsBitmaske(null, { diagnosegruppe: 'UI2' }), '0100');
});

test('der Rueckfall greift NUR bei voelliger Leere', () => {
  assert.equal(leitsymptomatikAlsBitmaske('c', { diagnosegruppe: 'UI1' }), '0010');
});

test('DF ohne Buchstabe bleibt 0000 — es gibt keinen Katalogwert dafuer', () => {
  assert.equal(leitsymptomatikAlsBitmaske('', { diagnosegruppe: 'DF' }), '0000');
});

// ── Nichts darf das Muster verletzen ─────────────────────────────────────
test('jede Ausgabe passt ins ZHE-Feld', () => {
  const eingaben = ['', null, undefined, 'a', 'DF-c', 'Unsinn', '0010', '9999', 'xyz', '12'];
  for (const e of eingaben) {
    const raus = leitsymptomatikAlsBitmaske(e, { diagnosegruppe: 'DF' });
    assert.ok(LEITSYMPTOMATIK_MUSTER.test(raus), `"${e}" ergab "${raus}"`);
  }
});

// ── Verordnungsart ───────────────────────────────────────────────────────
test('Verordnungsart: Regelfall 03', () => {
  assert.equal(verordnungsartFuer({}), '03');
  assert.equal(verordnungsartFuer({ is_blanko: false, is_lhb_bvb: false }), '03');
});

test('Verordnungsart: langfristiger Heilmittelbedarf 04', () => {
  assert.equal(verordnungsartFuer({ is_lhb_bvb: true }), '04');
});

test('Verordnungsart: Blankoverordnung 05, und sie gewinnt', () => {
  assert.equal(verordnungsartFuer({ is_blanko: true }), '05');
  assert.equal(verordnungsartFuer({ is_blanko: true, is_lhb_bvb: true }), '05');
});

test('Verordnungsart gibt nie einen nicht belegten Schluessel zurueck', () => {
  const verboten = new Set(['01', '02', '10', '11']);
  for (const rx of [{}, { is_blanko: true }, { is_lhb_bvb: true }, null]) {
    assert.ok(!verboten.has(verordnungsartFuer(rx)));
  }
});

// ── Heilmittel-Bereich ───────────────────────────────────────────────────
test('Heilmittel-Bereich je Fachbereich', () => {
  assert.equal(heilmittelBereichFuer('physiotherapy'), '1');
  assert.equal(heilmittelBereichFuer('podologie'), '2');
  assert.equal(heilmittelBereichFuer('logopaedie'), '3');
  assert.equal(heilmittelBereichFuer('ergotherapie'), '4');
});

test('Podologie ist nicht 5 — das waere Ernaehrungstherapie', () => {
  assert.notEqual(heilmittelBereichFuer('podologie'), '5');
});

test('Unbekannter Fachbereich faellt wie beim LEGS auf Physio', () => {
  assert.equal(heilmittelBereichFuer('gaertnerei'), '1');
  assert.equal(heilmittelBereichFuer(undefined), '1');
});
