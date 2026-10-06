import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REZEPTARTEN, normalisiereRezeptart, rezeptartLabel, istKasse, istBg, brauchtGkvAngaben,
  vorauswahlAusPatient, umschaltSperre, diagnosegruppeFuerSpeichern, rezeptartFuerSpeichern,
} from './rezeptart.js';

test('Werteliste: genau die vier Arten, in Anzeigereihenfolge', () => {
  assert.deepEqual(REZEPTARTEN, ['kassen', 'privat', 'selbstzahler', 'bg']);
});

test('normalisiere: NULL/leer/gkv/kasse -> kassen (Altzeilen gelten als Kasse)', () => {
  for (const w of [null, undefined, '', '  ', 'gkv', 'GKV', 'kasse', 'Kassen']) {
    assert.equal(normalisiereRezeptart(w), 'kassen', String(w));
  }
});

test('normalisiere: bekannte Werte bleiben, pkv -> privat', () => {
  assert.equal(normalisiereRezeptart('privat'), 'privat');
  assert.equal(normalisiereRezeptart('pkv'), 'privat');
  assert.equal(normalisiereRezeptart('selbstzahler'), 'selbstzahler');
  assert.equal(normalisiereRezeptart(' BG '), 'bg');
});

test('normalisiere: Unbekanntes faellt auf kassen (Altverhalten), nie auf bg', () => {
  assert.equal(normalisiereRezeptart('xyz'), 'kassen');
});

test('istKasse / istBg / brauchtGkvAngaben', () => {
  assert.equal(istKasse(null), true);
  assert.equal(istKasse('privat'), false);
  assert.equal(istBg('bg'), true);
  assert.equal(istBg('privat'), false);
  assert.equal(brauchtGkvAngaben('kassen'), true);
  for (const a of ['privat', 'selbstzahler', 'bg']) assert.equal(brauchtGkvAngaben(a), false, a);
});

test('Labels sind deutsch und eindeutig', () => {
  assert.equal(rezeptartLabel('kassen'), 'Kasse (GKV)');
  assert.equal(rezeptartLabel('privat'), 'Privat (PKV/Beihilfe)');
  assert.equal(rezeptartLabel('selbstzahler'), 'Selbstzahler');
  assert.equal(rezeptartLabel('bg'), 'BG / Unfallkasse');
  assert.equal(rezeptartLabel(null), 'Kasse (GKV)');
});

test('Vorauswahl: nur privat wird vorgewaehlt, sonst Kasse — nie Selbstzahler/BG', () => {
  assert.equal(vorauswahlAusPatient('privat'), 'privat');
  assert.equal(vorauswahlAusPatient('gkv'), 'kassen');
  assert.equal(vorauswahlAusPatient(null), 'kassen');
  assert.equal(vorauswahlAusPatient('selbstzahler'), 'kassen');
  assert.equal(vorauswahlAusPatient('bg'), 'kassen');
});

test('Sperre: Belegnummer sperrt (gleiche Bedingung wie Trigger 0020)', () => {
  const m = umschaltSperre({ belegnummer: 'B-1' });
  assert.match(m, /Kasse übermittelt|übermittelt/);
});

test('Sperre: nicht stornierte Rechnung sperrt (Doppelabrechnung)', () => {
  const m = umschaltSperre({ offeneRechnung: true });
  assert.match(m, /Rechnung/);
  assert.match(m, /stornier/i);
});

test('Sperre: frei, wenn weder Beleg noch Rechnung', () => {
  assert.equal(umschaltSperre({}), null);
  assert.equal(umschaltSperre(), null);
  assert.equal(umschaltSperre({ belegnummer: '', offeneRechnung: false }), null);
});

test('Diagnosegruppe: leer/Leerzeichen -> null, nie leerer String (FK)', () => {
  assert.equal(diagnosegruppeFuerSpeichern(''), null);
  assert.equal(diagnosegruppeFuerSpeichern('   '), null);
  assert.equal(diagnosegruppeFuerSpeichern(null), null);
  assert.equal(diagnosegruppeFuerSpeichern(' DF '), 'DF');
});

test('rezeptartFuerSpeichern: immer ein ausdruecklicher Wert, nie gkv/NULL', () => {
  assert.equal(rezeptartFuerSpeichern(null), 'kassen');
  assert.equal(rezeptartFuerSpeichern('gkv'), 'kassen');
  assert.equal(rezeptartFuerSpeichern('bg'), 'bg');
});
