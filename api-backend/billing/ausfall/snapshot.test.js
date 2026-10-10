import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ausfallAusstellerSnapshot, ausfallEmpfaengerSnapshot } from './snapshot.js';

const profil = {
  business_name: 'Praxis Fuß', street: 'Hauptstr.', house_number: '5', zip: '53721', city: 'Siegburg',
  phone: '02241 1', email: 'info@praxis.example', bank_name: 'Bank', iban: 'DE00 1234', bic: 'BICX',
  steuernummer: '220/123/45678', ik_number: '123456789',
};

test('Ausfall-Aussteller: Standortname/-telefon gewinnen, Steuernummer und Bank im Snapshot', () => {
  const a = ausfallAusstellerSnapshot(profil, { standort: { business_name: 'Standort Nord', phone: '0228 2' } });
  assert.equal(a.name, 'Standort Nord');
  assert.equal(a.telefon, '0228 2');
  assert.equal(a.strasse, 'Hauptstr. 5');
  assert.equal(a.plzOrt, '53721 Siegburg');
  assert.equal(a.steuernummer, '220/123/45678');
  assert.deepEqual(a.bank, { name: 'Bank', iban: 'DE00 1234', bic: 'BICX' });
  assert.equal(ausfallAusstellerSnapshot(profil).name, 'Praxis Fuß');
});

test('Ausfall-Aussteller: Praxis-Mail vor Login-Mail, Login-Mail nur als Ersatz', () => {
  assert.equal(ausfallAusstellerSnapshot(profil, { userEmail: 'chef@x.example' }).email, 'info@praxis.example');
  assert.equal(ausfallAusstellerSnapshot({ ...profil, email: '' }, { userEmail: 'chef@x.example' }).email, 'chef@x.example');
});

test('Ausfall-Empfänger: nur gedruckte Felder, leerer Name → null', () => {
  const e = ausfallEmpfaengerSnapshot({ vorname: 'Anna', nachname: 'Muster', strasse: 'Weg 1', plz: '53721', ort: 'Siegburg', geburtsdatum: '1950-03-04T00:00:00Z' });
  assert.deepEqual(e, { v: 1, art: 'patient', name: 'Anna Muster', strasse: 'Weg 1', plzOrt: '53721 Siegburg', geburtsdatum: '1950-03-04' });
  assert.equal(ausfallEmpfaengerSnapshot({ vorname: '', nachname: '' }), null);
  assert.equal(ausfallEmpfaengerSnapshot(null), null);
});
