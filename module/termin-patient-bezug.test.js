import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNameMitGeburt, findeLeadIdZuTermin } from './termin-patient-bezug.js';

// Wirft die Abfrage nie ab: alle Fälle hier arbeiten mit `opts.leads`.
const sbNie = { from() { throw new Error('Es darf keine Abfrage laufen.'); } };
const OWNER = 'owner-1';

test('parseNameMitGeburt trennt Name und Geburtsdatum', () => {
  assert.deepEqual(parseNameMitGeburt('Frank Becker · 1977-04-05'),
    { name: 'Frank Becker', geburtsdatum: '1977-04-05' });
});

test('parseNameMitGeburt lässt einen Namen ohne Datum unangetastet', () => {
  assert.deepEqual(parseNameMitGeburt('Rolf Kramer'),
    { name: 'Rolf Kramer', geburtsdatum: null });
});

test('parseNameMitGeburt behält einen Mittelpunkt, der kein Datum abtrennt', () => {
  // „Praxis · Raum 2" ist kein Patient mit Geburtsdatum.
  assert.deepEqual(parseNameMitGeburt('Praxis · Raum 2'),
    { name: 'Praxis · Raum 2', geburtsdatum: null });
});

test('parseNameMitGeburt verträgt leer und null', () => {
  assert.deepEqual(parseNameMitGeburt(null), { name: '', geburtsdatum: null });
});

test('lead_id am Termin schlägt jede weitere Suche', async () => {
  const treffer = await findeLeadIdZuTermin(sbNie,
    { lead_id: 'lead-9', customer_name: 'Ganz Anders' }, OWNER, { leads: [] });
  assert.equal(treffer, 'lead-9');
});

test('findet den Patienten über den Namen', async () => {
  const leads = [
    { id: 'a', first_name: 'Klaus', last_name: 'Fischer' },
    { id: 'b', first_name: 'Renate', last_name: 'Lehmann' },
  ];
  const treffer = await findeLeadIdZuTermin(sbNie,
    { customer_name: 'Klaus Fischer · 1972-07-23' }, OWNER, { leads });
  assert.equal(treffer, 'a');
});

test('Namensvergleich ist unabhängig von Groß- und Kleinschreibung', async () => {
  const leads = [{ id: 'a', first_name: 'Klaus', last_name: 'Fischer' }];
  assert.equal(await findeLeadIdZuTermin(sbNie,
    { customer_name: 'klaus fischer' }, OWNER, { leads }), 'a');
});

test('Telefonnummer gewinnt gegen abweichende Schreibweise', async () => {
  // Der Termin trägt die Nummer formatiert, die Akte unformatiert.
  const leads = [
    { id: 'a', first_name: 'Klaus', last_name: 'Fischer', phone_normalized: '4917012345' },
    { id: 'b', title: 'Fischer, Klaus' },
  ];
  const treffer = await findeLeadIdZuTermin(sbNie,
    { customer_name: 'Fischer, Klaus', customer_phone: '+49 170 / 1234-5' }, OWNER, { leads });
  assert.equal(treffer, 'a');
});

test('Geburtsdatum entscheidet die Namensdopplung', async () => {
  const leads = [
    { id: 'alt', first_name: 'Klaus', last_name: 'Fischer', geburtsdatum: '1949-01-02' },
    { id: 'jung', first_name: 'Klaus', last_name: 'Fischer', geburtsdatum: '1972-07-23' },
  ];
  const treffer = await findeLeadIdZuTermin(sbNie,
    { customer_name: 'Klaus Fischer · 1972-07-23' }, OWNER, { leads });
  assert.equal(treffer, 'jung');
});

test('Geburtsdatum auch aus dem Altbestand in metadata', async () => {
  const leads = [
    { id: 'alt', first_name: 'Klaus', last_name: 'Fischer', metadata: { geburtsdatum: '1949-01-02' } },
    { id: 'jung', first_name: 'Klaus', last_name: 'Fischer', metadata: { geburtsdatum: '1972-07-23' } },
  ];
  assert.equal(await findeLeadIdZuTermin(sbNie,
    { customer_name: 'Klaus Fischer · 1972-07-23' }, OWNER, { leads }), 'jung');
});

test('zwei gleichnamige Patienten OHNE Geburtsdatum → lieber nichts als falsch', async () => {
  const leads = [
    { id: 'a', first_name: 'Klaus', last_name: 'Fischer' },
    { id: 'b', first_name: 'Klaus', last_name: 'Fischer' },
  ];
  const treffer = await findeLeadIdZuTermin(sbNie,
    { customer_name: 'Klaus Fischer' }, OWNER, { leads });
  assert.equal(treffer, null);
});

test('kein Treffer bleibt null — es wird nicht der Ähnlichste geraten', async () => {
  const leads = [{ id: 'a', first_name: 'Klaus', last_name: 'Fischer' }];
  assert.equal(await findeLeadIdZuTermin(sbNie,
    { customer_name: 'Klaus Fischbach' }, OWNER, { leads }), null);
});

test('ohne ownerId wird nichts zugeordnet', async () => {
  const leads = [{ id: 'a', first_name: 'Klaus', last_name: 'Fischer' }];
  assert.equal(await findeLeadIdZuTermin(sbNie,
    { customer_name: 'Klaus Fischer' }, null, { leads }), null);
});
