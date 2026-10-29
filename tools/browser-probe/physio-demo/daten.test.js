import test from 'node:test';
import assert from 'node:assert/strict';
import { erstellePhysioDaten, DEMO_IDS } from './daten.mjs';
import { findPosition } from '../../../api-backend/billing/codes/physio_positions.js';

test('Physio-Profile und Patienten bleiben explizit synthetisch und mandantengebunden', () => {
  const d = erstellePhysioDaten();
  assert.equal(d.profiles.length, 2); assert.equal(d.leads.length, 10);
  assert.equal(d.profiles[0].id, DEMO_IDS.owner);
  assert.equal(d.profiles[1].owner_id, DEMO_IDS.owner);
  for (const p of d.profiles) { assert.equal(p.sector, 'physiotherapy'); assert.equal(p.plan, 'professional'); }
  for (const p of d.leads) { assert.equal(p.owner_id, DEMO_IDS.owner); assert.match(p.email, /@example\.invalid$/); }
  assert.deepEqual(d.podologie_behandlungen, []);
  assert.equal(d.prescriptions.some(p => p.therapie_bereich === 'podo'), false);
});

test('Leistungen verwenden vorhandenen datierten Katalog; Dauer bleibt Praxiseinstellung', () => {
  const d = erstellePhysioDaten();
  assert.deepEqual(d.services.map(s => s.code), ['X0501', 'X1201', 'X0507', 'X0205', 'X0106']);
  for (const s of d.services) {
    const p = findPosition(s.code, '22', '2026-10-30');
    assert.equal(s.title, p.label); assert.equal(Number(s.price), p.preis);
    assert.equal(s.gkv_position_nr, s.code); assert.equal(s.kostentraeger_typ, 'gkv');
    assert.equal(s.price_config.durations[s.duration_minutes].price, p.preis);
    assert.match(s.description, /keine aktuelle Tarif-/);
    if (s.required_certificate) for (const profile of d.profiles) {
      assert.ok(d.therapist_certificates.some(c => c.profile_id === profile.id && c.certificate === s.required_certificate));
    }
  }
  assert.equal(d.services[2].is_group, true); assert.equal(d.services[2].group_capacity, 3);
  assert.equal(d.employee_services.length, d.services.length * d.profiles.length);
  for (const z of d.employee_services) {
    assert.ok(d.profiles.some(p => p.id === z.employee_id));
    assert.ok(d.services.some(s => s.id === z.service_id));
    assert.equal(Object.hasOwn(z, 'owner_id'), false);
  }
});

test('Sitzungsbuch verbindet Patient, Verordnung, tatsächliche Leistung und Termin ohne Podo-FK', () => {
  const d = erstellePhysioDaten();
  assert.equal(d.prescription_sessions.length, 36);
  const ids = d.prescription_sessions.map(s => s.id); assert.equal(new Set(ids).size, ids.length);
  for (const rx of d.prescriptions) {
    assert.equal(rx.therapie_bereich, 'physio');
    assert.ok(d.leads.some(p => p.id === rx.patient_id));
    const rows = d.prescription_sessions.filter(s => s.prescription_id === rx.id);
    assert.equal(rows.length, rx.anzahl_einheiten);
    assert.deepEqual(rx.prescription_sessions, rows);
    assert.equal(rx.status === 'completed', rows.every(s => s.status === 'done'));
    assert.equal(rx.abrechnung_status, rx.status === 'completed' ? 'bereit' : null);
    for (const s of rows) {
      assert.ok(['done', 'planned'].includes(s.status)); assert.equal(s.heilmittel_index, 0);
      if (!s.booking_id) { assert.equal(s.bookings, null); continue; }
      const b = d.bookings.find(b => b.id === s.booking_id);
      assert.ok(b); assert.equal(b.lead_id, rx.patient_id); assert.equal(b.verordnung_id, null);
      assert.equal(b.services.code, rx.heilmittel_position);
      assert.equal(b.service_id, b.services.id);
      assert.ok(Date.parse(b.end_time) > Date.parse(b.start_time));
      assert.equal(b.status, s.status === 'done' ? 'completed' : 'confirmed');
      if (s.status === 'done') { assert.equal(s.done_at, b.end_time); assert.ok(s.notes); }
    }
  }
  assert.equal(new Set(d.bookings.map(b => b.id)).size, d.bookings.length);
});

test('Demotag bestimmt Berliner Terminzeit auch über Sommer-/Winterzeitgrenze', () => {
  for (const tag of ['2026-07-10', '2026-10-30']) {
    const d = erstellePhysioDaten({ tag });
    const rx = d.prescriptions[2];
    const b = d.bookings.find(b => b.id === rx.prescription_sessions[0].booking_id);
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' }).format(new Date(b.start_time));
    assert.equal(parts, '10');
    assert.equal(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(b.start_time)), tag);
  }
});

test('Unbelegte Datumstarife werden nicht als gültige Demo-Leistungen erzeugt', () => {
  for (const tag of ['2026-02-30', 'kein-tag', '2025-10-30']) assert.throws(() => erstellePhysioDaten({ tag }));
});

test('Aufrufe liefern unabhängige, deterministische JSON-Overrides ohne alte Rechnungen', () => {
  const a = erstellePhysioDaten(), b = erstellePhysioDaten();
  assert.deepEqual(a, b); assert.deepEqual(a, JSON.parse(JSON.stringify(a)));
  a.services[0].title = 'geändert'; a.prescriptions[0].prescription_sessions[0].notes = 'geändert';
  assert.notEqual(a.services[0].title, b.services[0].title);
  assert.notEqual(a.prescriptions[0].prescription_sessions[0].notes, a.prescription_sessions[0].notes);
  assert.deepEqual(b.invoices, []); assert.deepEqual(b.rechnung_zahlungen, []);
  assert.deepEqual(b.kostentraeger, []); assert.deepEqual(b.prescription_validations, []);
});
