import test from 'node:test';
import assert from 'node:assert/strict';
import { FESTGESCHRIEBENE_SPALTEN, payloadFuerUpdate } from './rechnung-festschreibung.js';

const payload = {
  owner_id: 'o', patient_id: 'p', patient_name: 'A B', line_items: [1], subtotal: 10, total_patient: 10, status: 'draft',
  notes: 'neu', invoice_type: 'privat', steuer_status: 'regel', steuerhinweis_text: 'x', steuernummer_snapshot: '1', ust_id_snapshot: null,
  leistung_von: '2026-09-01', leistung_bis: '2026-09-02', tax_summary: [], netto_gesamt: 1, steuer_gesamt: 0, brutto_gesamt: 1,
  eigenanteil_pct: 0, eigenanteil_eur: 0, kassenzuzahlung: 0, prescription_id: null, verordnung_id: null,
};

test('Entwurf: alles wird geschrieben, wie bisher', () => {
  assert.deepEqual(payloadFuerUpdate(payload, 'draft'), payload);
  assert.deepEqual(payloadFuerUpdate(payload, undefined), payload);
  assert.deepEqual(payloadFuerUpdate(payload, null), payload);
});

test('Festgeschrieben (sent/paid/cancelled): gesperrte Spalten und status fallen weg, notes bleibt', () => {
  for (const st of ['sent', 'paid', 'cancelled']) {
    const r = payloadFuerUpdate(payload, st);
    for (const sp of FESTGESCHRIEBENE_SPALTEN) assert.ok(!(sp in r), `${st}: ${sp}`);
    assert.ok(!('status' in r), 'status darf nicht auf draft zurückfallen');
    assert.equal(r.notes, 'neu');
    assert.equal(r.owner_id, 'o');
  }
});

test('Die Liste deckt alle Spalten der DB-Sperre (Migration 0070) ab', () => {
  const db = ['line_items', 'subtotal', 'total_patient', 'netto_gesamt', 'steuer_gesamt', 'brutto_gesamt', 'tax_summary', 'patient_id', 'issued_at',
    'steuerhinweis_text', 'steuernummer_snapshot', 'ust_id_snapshot', 'steuer_status', 'leistung_von', 'leistung_bis', 'patient_name', 'invoice_type'];
  for (const sp of db) assert.ok(FESTGESCHRIEBENE_SPALTEN.includes(sp), sp);
});

test('Original wird nicht verändert', () => {
  const kopie = JSON.parse(JSON.stringify(payload));
  payloadFuerUpdate(payload, 'sent');
  assert.deepEqual(payload, kopie);
});
