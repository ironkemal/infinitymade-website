import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

test('Die Liste deckt alle Spalten der DB-Sperre ab (jüngste Migration mit invoice_festschreibung)', () => {
  // Aus der Migrationskette gelesen statt abgeschrieben: eine neue gesperrte Spalte ohne Browser-Eintrag
  // ließe an einer versendeten Rechnung schon das Speichern einer Bemerkung scheitern (db-ustasi 09.10.2026).
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'api-backend', 'db', 'migrations');
  const datei = fs.readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort().reverse()
    .find((f) => /CREATE OR REPLACE FUNCTION public\.invoice_festschreibung/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
  assert.ok(datei, 'Migration mit invoice_festschreibung gefunden');
  const sql = fs.readFileSync(path.join(dir, datei), 'utf8');
  const db = [...new Set([...sql.matchAll(/NEW\.(\w+)\s+IS DISTINCT FROM OLD\.\1/g)].map((m) => m[1]))];
  assert.ok(db.length >= 24, `${datei}: ${db.length} Spalten`);
  for (const sp of db) assert.ok(FESTGESCHRIEBENE_SPALTEN.includes(sp), sp);
});

test('Original wird nicht verändert', () => {
  const kopie = JSON.parse(JSON.stringify(payload));
  payloadFuerUpdate(payload, 'sent');
  assert.deepEqual(payload, kopie);
});
