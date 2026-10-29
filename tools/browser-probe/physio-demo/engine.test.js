import test from 'node:test';
import assert from 'node:assert/strict';
import { fuehreDemoAktionAus, QUELLEN_SHA256 } from './engine.mjs';

function tables() {
  return {
    profiles: [{ id: 'OWNER', role: 'owner', owner_id: null, is_active: true }, { id: 'THERAPIST', role: 'employee', owner_id: 'OWNER', is_active: true }],
    leads: [{ id: 'PATIENT', owner_id: 'OWNER', first_name: 'Mara', last_name: 'Test', geburtsdatum: '1985-03-12' }, { id: 'FOREIGN', owner_id: 'OTHER' }],
    services: [{ id: 'KG', owner_id: 'OWNER', title: 'Krankengymnastik', duration_minutes: 20 }],
    aerzte: [], prescriptions: [], prescription_validations: [], bookings: [], invoices: [],
    kostentraeger: [{ id: 'KASSE', ik: '123456789', abrechnender_kt_ik: null, active: true, payer_type: 'gkv', datensatz_status: 'echt', valid_from: null, valid_to: null }],
  };
}
function prescription() {
  return { patient_id: 'PATIENT', parsed: {
    patient: { first_name: 'Mara', last_name: 'Test', geburtsdatum: '1985-03-12', krankenkasse_ik: '123456789' },
    arzt: { name: 'Dr. Demo', lanr: '123456789', bsnr: '987654321', ausstellungsdatum: '2026-10-29' },
    rezept: { therapiebereich: 'physio', heilmittel: 'KG', heilmittel_position: 'X0501', anzahl_einheiten: 6, diagnosegruppe: 'WS', icd10: 'M54.5', frequenz: '1-3x wöchentlich', behandlungsbeginn: '2026-10-30', rezeptart: 'kassen' },
  } };
}
const confirm = (tabellen, body = prescription()) => fuehreDemoAktionAus({ pfad: '/api/rezept/confirm', methode: 'POST', body, tabellen });
const batchBody = () => ({ userId: 'THERAPIST', serviceId: 'KG', startDate: '2026-10-30', time: '10:00', recurrence: 'weekly', count: 3, leadId: 'PATIENT', customerName: 'Mara Test' });
const batch = (tabellen, body = batchBody()) => fuehreDemoAktionAus({ pfad: '/api/booking/batch-create', methode: 'POST', body, tabellen });

test('source fingerprint is recorded without server bootstrap', () => assert.match(QUELLEN_SHA256, /^[a-f0-9]{64}$/));

test('original confirm uses real validator, physician resolver, payer and position helpers', async () => {
  const original = tables(), before = structuredClone(original);
  const out = await confirm(original);
  assert.equal(out.status, 200, JSON.stringify(out.body));
  assert.equal(out.body.success, true);
  assert.equal(out.body.validation.engine, 'standard');
  assert.equal(out.body.validation.ok, true);
  assert.equal(out.body.status, 'confirmed');
  assert.deepEqual(original, before, 'input must not mutate');
  const row = out.tabellen.prescriptions[0];
  assert.equal(row.patient_id, 'PATIENT'); assert.equal(row.owner_id, 'OWNER');
  assert.equal(row.heilmittel_position, '20501');
  assert.equal(row.kostentraeger_ik, '123456789');
  assert.equal(row.anzahl_einheiten, 6);
  assert.equal(out.tabellen.aerzte[0].lanr, '123456789');
  assert.equal(out.tabellen.prescription_validations.length, 1);
  assert.equal(out.tabellen.prescription_validations[0].prescription_id, row.id);
});

test('invalid real clinical input remains draft with actual blockers', async () => {
  const input = prescription(); input.parsed.rezept.diagnosegruppe = 'NOT_REAL'; input.parsed.rezept.anzahl_einheiten = 0;
  const out = await confirm(tables(), input);
  assert.equal(out.status, 200, JSON.stringify(out.body));
  assert.equal(out.body.status, 'parsed'); assert.equal(out.body.validation.ok, false);
  assert.ok(out.body.validation.blockers.some(b => b.code === 'DG_UNKNOWN'));
  assert.ok(out.body.validation.blockers.some(b => b.code === 'ANZAHL_REQUIRED'));
  assert.equal(out.tabellen.prescriptions[0].confirmed_at, null);
});

test('foreign patient rejected before any write', async () => {
  const initial = tables(); const input = { ...prescription(), patient_id: 'FOREIGN' };
  const out = await confirm(initial, input);
  assert.equal(out.status, 403); assert.deepEqual(out.tabellen, initial);
});

test('missing parsed rejected with no write', async () => {
  const initial = tables(); const out = await confirm(initial, {});
  assert.equal(out.status, 400); assert.deepEqual(out.tabellen, initial);
});

test('name/date matching reuses patient and physician on second original save', async () => {
  const first = await confirm(tables());
  const input = prescription(); delete input.patient_id;
  const second = await confirm(JSON.parse(JSON.stringify(first.tabellen)), input);
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.equal(second.tabellen.leads.length, 2);
  assert.equal(second.tabellen.aerzte.length, 1);
  assert.equal(second.tabellen.prescriptions.length, 2);
});

test('original PATCH persists corrections and fresh validation snapshot across JSON reload', async () => {
  const first = await confirm(tables());
  assert.equal(first.status, 200);
  const input = prescription(); input.parsed.rezept.anzahl_einheiten = 5;
  const out = await fuehreDemoAktionAus({ pfad: `/api/rezept/${first.body.prescription_id}`, methode: 'PATCH', body: input, tabellen: JSON.parse(JSON.stringify(first.tabellen)) });
  assert.equal(out.status, 200, JSON.stringify(out.body));
  assert.equal(out.tabellen.prescriptions.length, 1);
  assert.equal(out.tabellen.prescriptions[0].anzahl_einheiten, 5);
  assert.equal(out.tabellen.prescription_validations.length, 2);
});

test('foreign prescription and locked billed prescription remain unchanged', async () => {
  for (const row of [{ id: 'RX', owner_id: 'OTHER' }, { id: 'RX', owner_id: 'OWNER', belegnummer: 'FIXED', rezeptart: 'kassen' }]) {
    const initial = tables(); initial.prescriptions.push(row);
    const out = await fuehreDemoAktionAus({ pfad: '/api/rezept/RX', methode: 'PATCH', body: prescription(), tabellen: initial });
    assert.equal(out.status, row.owner_id === 'OTHER' ? 403 : 409);
    assert.deepEqual(out.tabellen, initial);
  }
});

test('original batch uses real series and Berlin time, preserving links and chosen duration', async () => {
  const out = await batch(tables());
  assert.equal(out.status, 200, JSON.stringify(out.body)); assert.equal(out.body.count, 3);
  assert.deepEqual(out.body.conflicts, []);
  assert.deepEqual(out.body.created.map(b => b.date), ['2026-10-30', '2026-11-06', '2026-11-13']);
  for (const row of out.tabellen.bookings) {
    assert.equal(row.lead_id, 'PATIENT'); assert.equal(row.service_id, 'KG');
    assert.equal(row.owner_id, 'OWNER'); assert.equal(row.user_id, 'THERAPIST');
    assert.equal(Date.parse(row.end_time) - Date.parse(row.start_time), 20 * 60000);
    assert.match(row.start_time, /T09:00:00\.000Z$/);
  }
});

test('overlap rejected by synthetic constraint, original handler reports conflict', async () => {
  const first = await batch(tables());
  const second = await batch(JSON.parse(JSON.stringify(first.tabellen)));
  assert.equal(second.status, 200); assert.equal(second.body.count, 0);
  assert.equal(second.body.conflicts.length, 3);
  assert.ok(second.body.conflicts.every(c => c.reason === 'Slot bereits belegt'));
  assert.equal(second.tabellen.bookings.length, 3);
});

test('foreign/inactive therapist and foreign service rejected by real guards', async () => {
  for (const kind of ['therapist', 'inactive', 'service']) {
    const initial = tables();
    if (kind === 'therapist') initial.profiles[1].owner_id = 'OTHER';
    if (kind === 'inactive') initial.profiles[1].is_active = false;
    if (kind === 'service') initial.services[0].owner_id = 'OTHER';
    const out = await batch(initial);
    assert.equal(out.status, 400, kind); assert.deepEqual(out.tabellen, initial);
  }
});

test('foreign lead rejected by extra demo fence, original batch null-link fallback not claimed as success', async () => {
  const initial = tables(); const out = await batch(initial, { ...batchBody(), leadId: 'FOREIGN' });
  assert.equal(out.status, 403); assert.deepEqual(out.tabellen, initial);
});

test('invalid count/date does not write bookings', async () => {
  for (const patch of [{ count: 0 }, { count: 53 }, { startDate: '2026-02-31' }]) {
    const initial = tables(); const out = await batch(initial, { ...batchBody(), ...patch });
    assert.equal(out.status, 400); assert.deepEqual(out.tabellen, initial);
  }
});

test('unknown API, non-owner, missing source and excessive tables fail closed', async () => {
  const initial = tables();
  const unknown = await fuehreDemoAktionAus({ pfad: '/api/gmail/send', methode: 'POST', body: {}, tabellen: initial });
  assert.equal(unknown.status, 501);
  const employee = await fuehreDemoAktionAus({ pfad: '/api/rezept/confirm', methode: 'POST', body: prescription(), tabellen: initial, rolle: 'employee' });
  assert.equal(employee.status, 403);
  const missing = tables(); delete missing.aerzte;
  const failure = await confirm(missing); assert.equal(failure.status, 500); assert.deepEqual(failure.tabellen, missing);
  const excessive = tables(); excessive.leads = new Array(10001).fill({ id: 'BAD' });
  assert.equal((await confirm(excessive)).status, 500);
});

test('required audit failure rolls back all local changes, no invented save success', async () => {
  const initial = tables(); delete initial.prescription_validations;
  const out = await confirm(initial);
  assert.equal(out.status, 500); assert.deepEqual(out.tabellen, initial);
  assert.equal(initial.aerzte.length, 0); assert.equal(initial.prescriptions.length, 0);
});

test('literal physician-name fallback preserves escaped percent and underscore', async () => {
  const input = prescription(); input.parsed.arzt = { name: 'Dr. 10%_Demo', ausstellungsdatum: '2026-10-29' };
  const initial = tables(); initial.aerzte.push({ id: 'DOCTOR', owner_id: 'OWNER', arzt_name: 'Dr. 10%_Demo', lanr: null });
  const out = await confirm(initial, input);
  assert.equal(out.status, 200, JSON.stringify(out.body));
  assert.equal(out.body.arzt_id, 'DOCTOR'); assert.equal(out.tabellen.aerzte.length, 1);
});

test('real payer helper refuses expired rows instead of fabricating mapped IK', async () => {
  const initial = tables(); initial.kostentraeger[0].valid_to = '2000-01-01';
  const out = await confirm(initial);
  assert.equal(out.status, 200); assert.equal(out.tabellen.prescriptions[0].kostentraeger_ik, null);
  assert.equal(out.tabellen.prescriptions[0].krankenkasse_ik, '123456789');
});

test('original Berlin conversion changes offset across autumn DST boundary', async () => {
  const out = await batch(tables(), { ...batchBody(), startDate: '2026-10-23', count: 2 });
  assert.equal(out.status, 200); assert.equal(out.body.count, 2);
  assert.equal(out.tabellen.bookings[0].start_time, '2026-10-23T08:00:00.000Z');
  assert.equal(out.tabellen.bookings[1].start_time, '2026-10-30T09:00:00.000Z');
});

test('original physician API creates then reuses/enriches physician after JSON reload', async () => {
  const body = { name: 'Dr. Test', lanr: '123456789', bsnr: '987654321', owner_id: 'FOREIGN' };
  const first = await fuehreDemoAktionAus({ pfad: '/api/arzt/resolve', methode: 'POST', body, tabellen: tables() });
  assert.equal(first.status, 200); assert.equal(first.body.created, true);
  assert.equal(first.tabellen.aerzte[0].owner_id, 'OWNER');
  assert.equal(first.body.arzt.lanr, '123456789');
  const second = await fuehreDemoAktionAus({ pfad: '/api/arzt/resolve', methode: 'POST', body: { ...body, telefon: '0221 000000' }, tabellen: JSON.parse(JSON.stringify(first.tabellen)) });
  assert.equal(second.status, 200); assert.equal(second.body.created, false);
  assert.equal(second.body.arzt_id, first.body.arzt_id);
  assert.equal(second.tabellen.aerzte.length, 1);
  assert.equal(second.body.arzt.telefon, '0221 000000');
  assert.ok(second.body.enriched.includes('telefon'));
});

test('original physician API rejects empty input without writes', async () => {
  const initial = tables();
  const out = await fuehreDemoAktionAus({ pfad: '/api/arzt/resolve', methode: 'POST', body: {}, tabellen: initial });
  assert.equal(out.status, 400); assert.deepEqual(out.tabellen, initial);
});
