import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verordnungPatientenAbgleich } from './verordnung-patient-abgleich.js';

function doppel({ confirmResult = true } = {}) {
  const geschrieben = [];
  const kette = {
    update: (patch) => { geschrieben.push(patch); return kette; },
    eq: () => kette,
    then: (resolve) => resolve({ error: null }),
  };
  const confirmCalls = [];
  return {
    supabase: { from: () => kette },
    showConfirmModal: async (opts) => { confirmCalls.push(opts); return confirmResult; },
    geschrieben,
    confirmCalls,
  };
}

const basisFelder = {
  ownerId: 'o-1', patientId: 'p-1',
  lead: { first_name: 'Anna', last_name: 'Muster' },
  vorname: 'Anna', nachname: 'Muster',
  versichertennummer: '', krankenkasse: '', versichertenstatus: '',
  strasse: '', ort: '', geburtsdatum: ''
};

test('ohne patientId passiert nichts', async () => {
  const { supabase, showConfirmModal, geschrieben, confirmCalls } = doppel();
  await verordnungPatientenAbgleich({ supabase, showConfirmModal }, { ...basisFelder, patientId: null });
  assert.equal(geschrieben.length, 0);
  assert.equal(confirmCalls.length, 0);
});

test('Name stimmt überein — keine Nachfrage, keine leeren Felder zu übernehmen', async () => {
  const { supabase, showConfirmModal, geschrieben, confirmCalls } = doppel();
  await verordnungPatientenAbgleich({ supabase, showConfirmModal }, basisFelder);
  assert.equal(confirmCalls.length, 0);
  assert.equal(geschrieben.length, 0);
});

// Ops #268: weicht der Verordnungsname vom Stammdatensatz ab, fragt die
// Funktion nach und übernimmt nur bei Zustimmung.
test('Name weicht ab und wird bei Zustimmung übernommen', async () => {
  const { supabase, showConfirmModal, geschrieben, confirmCalls } = doppel({ confirmResult: true });
  await verordnungPatientenAbgleich({ supabase, showConfirmModal }, {
    ...basisFelder, nachname: 'Musterfrau'
  });
  assert.equal(confirmCalls.length, 1);
  assert.equal(geschrieben[0].last_name, 'Musterfrau');
  assert.equal(geschrieben[0].first_name, 'Anna');
  assert.equal(geschrieben[0].title, 'Anna Musterfrau');
});

test('Name weicht ab, Nutzer lehnt ab — Stammdatensatz bleibt unangetastet', async () => {
  const { supabase, showConfirmModal, geschrieben, confirmCalls } = doppel({ confirmResult: false });
  await verordnungPatientenAbgleich({ supabase, showConfirmModal }, {
    ...basisFelder, nachname: 'Musterfrau'
  });
  assert.equal(confirmCalls.length, 1);
  assert.equal(geschrieben.length, 0);
});

test('Groß-/Kleinschreibung allein löst keine Nachfrage aus', async () => {
  const { showConfirmModal, confirmCalls, supabase } = doppel();
  await verordnungPatientenAbgleich({ supabase, showConfirmModal }, {
    ...basisFelder, nachname: 'MUSTER'
  });
  assert.equal(confirmCalls.length, 0);
});

test('leere Felder werden unabhängig vom Namensabgleich übernommen', async () => {
  const { supabase, showConfirmModal, geschrieben } = doppel();
  await verordnungPatientenAbgleich({ supabase, showConfirmModal }, {
    ...basisFelder,
    lead: { first_name: 'Anna', last_name: 'Muster' },
    krankenkasse: 'AOK', versichertennummer: 'A123456789'
  });
  assert.equal(geschrieben[0].krankenkasse, 'AOK');
  assert.equal(geschrieben[0].versichertennummer, 'A123456789');
});

test('vorhandene Stammdaten werden nie überschrieben', async () => {
  const { supabase, showConfirmModal, geschrieben } = doppel();
  await verordnungPatientenAbgleich({ supabase, showConfirmModal }, {
    ...basisFelder,
    lead: { first_name: 'Anna', last_name: 'Muster', krankenkasse: 'Barmer' },
    krankenkasse: 'AOK'
  });
  assert.equal(geschrieben.length, 0);
});
