import test from 'node:test';
import assert from 'node:assert/strict';
import { bestaetigePatientNeuanlage } from './patient-dublette.js';
import { patientKontaktFehler } from './patient-pflichtfelder.js';

test('Chrome1911 warnt bei Altdatum vor Neuanlage und bewahrt Abbruch', async () => {
  const query = { select() { return this; }, eq() { return this; }, or() { return this; } };
  const patient = { first_name: 'Chrome1911', last_name: 'Test', geburtsdatum: '2001-05-11' };
  const args = { patient, sb: { from: () => query }, bestaetige: async () => false,
    bizScope: async () => ({ data: [{ ...patient, geburtsdatum: null, altgeburt: patient.geburtsdatum }] }) };
  assert.equal(await bestaetigePatientNeuanlage(args), false);
  assert.equal(await bestaetigePatientNeuanlage({ ...args, bizScope: async () => ({ data: [] }) }), true);
  assert.match(patientKontaktFehler('abc', ''), /Postleitzahl/);
  assert.match(patientKontaktFehler('01234', 'abc'), /E-Mail/);
  assert.equal(patientKontaktFehler('01234', 'chrome1911@example.invalid'), null);
});
