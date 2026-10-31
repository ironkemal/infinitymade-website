import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patientPasstZurSuche } from './patientenliste.js';

const lead = { first_name: 'Testa', last_name: 'Muster', geburtsdatum: '1975-04-12' };
const helfer = {
  nameMitGeburt: () => 'Testa Muster · 1975-04-12',
  anzeigeName: () => 'Testa Muster · 12.04.1975',
  geburtsdatum: () => '1975-04-12',
};

test('Auswahlfeld findet den Patienten mit seinem eigenen Label wieder', () => {
  assert.equal(patientPasstZurSuche(lead, 'Testa Muster · 12.04.1975', helfer), true);
});

test('ISO-Form und Name bleiben suchbar, fremde Eingabe nicht', () => {
  assert.equal(patientPasstZurSuche(lead, 'Testa Muster · 1975-04-12', helfer), true);
  assert.equal(patientPasstZurSuche(lead, 'muster', helfer), true);
  assert.equal(patientPasstZurSuche(lead, 'Anderer Name · 12.04.1975', helfer), false);
});

test('ohne anzeigeName bleibt das bisherige Verhalten', () => {
  const { anzeigeName, ...alt } = helfer;
  assert.equal(patientPasstZurSuche(lead, 'Testa Muster · 1975-04-12', alt), true);
});
