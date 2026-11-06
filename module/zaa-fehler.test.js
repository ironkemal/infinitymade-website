// Gemeinsame ZAA-Fehlertabelle (06.11.2026): beide Wege in #zaaResult zeigen
// dieselben Spalten. Beleg ist Pflicht (gkv-302, Anlage 1 TP5 V21 Kap. 7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zaaZeilenAusDb, zaaZeilenAusUpload, renderZaaFehlerTabelle, renderZaaUploadResult } from './zaa-fehler.js';

const db = zaaZeilenAusDb([
  { fehler_code: 'E01', uebersetzung: 'IK falsch', loesung_hint: 'IK prüfen', status: 'offen', prescription_id: 'rx-1', prescriptions: { belegnummer: 'B-100' } },
  { fehler_code: 'E02', fehler_text: 'roh', status: 'offen', prescription_id: null, prescriptions: null },
]);

test('DB-Zeilen: Beleg kommt per Join, ohne Zuordnung bleibt er leer', () => {
  assert.equal(db[0].beleg, 'B-100');
  assert.equal(db[0].rxId, 'rx-1');
  assert.equal(db[1].beleg, null);
  assert.equal(db[1].fehler, 'roh');
});

test('Upload-Zeilen: Beheben-Ziel über Belegnummer, Rohnummer bleibt ohne Treffer', () => {
  const z = zaaZeilenAusUpload([
    { code: 'E01', belegnummer: 'B-100', uebersetzung: 'IK falsch' },
    { code: 'E03', belegnummer: 'B-999', text: 'unbekannt' },
  ], db);
  assert.equal(z[0].rxId, 'rx-1');
  assert.equal(z[1].rxId, null);
  assert.equal(z[1].beleg, 'B-999');
});

test('Tabelle: sechs Spalten inkl. Beleg und Beheben-Link nur mit Verordnung', () => {
  const html = renderZaaFehlerTabelle(db);
  for (const k of ['Code', 'Beleg', 'Status', 'Fehler', 'Lösung', 'Aktion']) assert.match(html, new RegExp(`<th>${k}</th>`));
  assert.equal((html.match(/zaa-fix-link/g) || []).length, 1);
  assert.match(html, /B-100/);
  assert.equal(renderZaaFehlerTabelle([]), '');
});

test('Upload-Ergebnis: Zusammenfassung, Warnung, gemeinsame Tabelle', () => {
  const html = renderZaaUploadResult({ errorCount: 1, nichtZugeordnet: 1, errors: [{ code: 'E03', belegnummer: 'B-999' }] });
  assert.match(html, /1 Fehler erkannt/);
  assert.match(html, /keinem Beleg zugeordnet/);
  assert.match(html, /<th>Beleg<\/th>/);
  assert.match(renderZaaUploadResult({ errorCount: 0, errors: [] }), /Keine Fehler erkannt/);
});

test('escapeHtml wird auf alle Felder angewandt', () => {
  const esc = (s) => String(s ?? '').replace(/</g, '&lt;');
  const html = renderZaaFehlerTabelle([{ code: '<x>', beleg: '<b>', status: 'offen', fehler: '<f>', loesung: '<l>', rxId: null }], { escapeHtml: esc });
  assert.doesNotMatch(html, /<x>|<b>|<f>|<l>/);
});
