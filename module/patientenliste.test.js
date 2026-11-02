import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patientPasstZurSuche } from './patientenliste.js';

test('patientPasstZurSuche: findet Patient mit ISO-Geburtsdatum', () => {
  const lead = { first_name: 'Max', last_name: 'Mustermann', geburtsdatum: '1985-03-12' };
  const helfer = {
    nameMitGeburt: (l) => `${l.first_name} ${l.last_name} · 12.03.1985`,
    geburtsdatum: (l) => l.geburtsdatum,
  };

  assert.equal(patientPasstZurSuche(lead, '12.03.1985', helfer), true);
  assert.equal(patientPasstZurSuche(lead, '12.3.1985', helfer), true);
  assert.equal(patientPasstZurSuche(lead, 'max', helfer), true);
  assert.equal(patientPasstZurSuche(lead, 'muster', helfer), true);
  assert.equal(patientPasstZurSuche(lead, '01.01.2000', helfer), false);
});

test('patientPasstZurSuche: findet Patient mit bereits deutschem Geburtsdatum', () => {
  const lead = { first_name: 'Erika', last_name: 'Musterfrau', geburtsdatum: '05.04.1977' };
  const helfer = {
    nameMitGeburt: (l) => `${l.first_name} ${l.last_name} · 05.04.1977`,
    geburtsdatum: (l) => l.geburtsdatum,
  };

  assert.equal(patientPasstZurSuche(lead, '05.04.1977', helfer), true);
  assert.equal(patientPasstZurSuche(lead, '5.4.1977', helfer), true);
  assert.equal(patientPasstZurSuche(lead, 'erika', helfer), true);
  assert.equal(patientPasstZurSuche(lead, '12.03.1985', helfer), false);
});

test('patientPasstZurSuche: Patient ohne Geburtsdatum (leer/null)', () => {
  const lead = { first_name: 'Hans', last_name: 'Ohne', geburtsdatum: null };
  const helfer = {
    nameMitGeburt: (l) => `${l.first_name} ${l.last_name}`,
    geburtsdatum: () => null,
  };

  assert.equal(patientPasstZurSuche(lead, '', helfer), true);
  assert.equal(patientPasstZurSuche(lead, 'hans', helfer), true);
  assert.equal(patientPasstZurSuche(lead, '12.03.1985', helfer), false);
});
