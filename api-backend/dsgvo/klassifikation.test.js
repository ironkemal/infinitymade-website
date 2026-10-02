import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  KATEGORIEN,
  TABELLEN,
  AUSNAHMEN,
  LEAD_BEZUEGE,
} from './klassifikation.js';

test('DSGVO Drift-Test: Alle Tabellen mit Personenbezug in SCHEMA.sql sind klassifiziert', () => {
  const schemaUrl = new URL('../../db/SCHEMA.sql', import.meta.url);
  const schemaText = readFileSync(schemaUrl, 'utf8');

  // Parse alle CREATE TABLE Bloecke
  const tableRegex = /CREATE TABLE\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\n\);/g;
  const klassifizierteTabellen = new Set(TABELLEN.map(t => t.table));
  const ausnahmenSet = new Set(AUSNAHMEN);
  const gefundeneTabellen = new Set();

  let match;
  while ((match = tableRegex.exec(schemaText)) !== null) {
    const tableName = match[1];
    const columnsBlock = match[2];
    gefundeneTabellen.add(tableName);

    // Pruefen, ob die Tabelle eine Spalte mit Personenbezug enthaelt
    const hatPersonenSpalte = /\b(owner_id|user_id|employee_id|owner_user_id)\b/.test(columnsBlock);

    if (hatPersonenSpalte) {
      const istErfasst = klassifizierteTabellen.has(tableName) || ausnahmenSet.has(tableName);
      assert.ok(
        istErfasst,
        `Tabelle "${tableName}" enthaelt Personenbezug, fehlt aber in TABELLEN oder AUSNAHMEN: neue Tabelle → dsgvo/klassifikation.js`
      );
    }
  }

  // Jede Tabelle in TABELLEN muss in SCHEMA.sql existieren
  for (const { table } of TABELLEN) {
    assert.ok(
      gefundeneTabellen.has(table),
      `Tabelle "${table}" aus TABELLEN existiert nicht in SCHEMA.sql`
    );
  }

  // Jede Kategorie mit Frist muss in KATEGORIEN existieren
  const fristKategorien = new Set(['behandlung', 'einwilligung', 'beleg', 'grundaufzeichnung', 'geschaeftsbrief']);
  for (const { table, kategorie } of TABELLEN) {
    if (fristKategorien.has(kategorie)) {
      assert.ok(
        KATEGORIEN[kategorie],
        `Kategorie "${kategorie}" von Tabelle "${table}" existiert nicht in KATEGORIEN`
      );
      assert.ok(typeof KATEGORIEN[kategorie].jahre === 'number', `Jahre fuer "${kategorie}" muss Zahl sein`);
      assert.ok(typeof KATEGORIEN[kategorie].grundlage === 'string', `Grundlage fuer "${kategorie}" fehlt`);
    }
  }
});

test('DSGVO Drift-Test: LEAD_BEZUEGE deckt alle Fremdschluessel auf leads in SCHEMA.sql ab', () => {
  const schemaUrl = new URL('../../db/SCHEMA.sql', import.meta.url);
  const schemaText = readFileSync(schemaUrl, 'utf8');

  // Teile SCHEMA.sql in Abschnitte je CREATE TABLE
  const sections = schemaText.split(/CREATE TABLE\s+(?:public\.)?/);
  const schemaFks = [];

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const tableMatch = section.match(/^([a-zA-Z0-9_]+)/);
    if (!tableMatch) continue;
    const tableName = tableMatch[1];

    // Nur bis zum naechsten Block oder Ende
    const bodyAndComments = section.split(/\n-- =+/)[0];

    // Suche nach Referenzen auf leads(id)
    // z. B. "FK patient_id -> leads(id)", "lead_id -> leads(id)", "patient_id uuid REFERENCES public.leads(id)"
    const fkMatches = bodyAndComments.matchAll(/(?:FK\s+)?([a-zA-Z0-9_]+)\s*->\s*leads(?:\(id\))?|([a-zA-Z0-9_]+)\s+uuid\s+REFERENCES\s+(?:public\.)?leads/gi);
    for (const fm of fkMatches) {
      const colName = fm[1] || fm[2];
      if (colName && colName !== 'id') {
        schemaFks.push([tableName, colName]);
      }
    }
  }

  assert.ok(schemaFks.length > 0, 'Mindestens ein FK auf leads sollte in SCHEMA.sql existieren');

  for (const [table, col] of schemaFks) {
    const vorhanden = LEAD_BEZUEGE.some(([t, c]) => t === table && c === col);
    assert.ok(
      vorhanden,
      `LEAD_BEZUEGE deckt Fremdschluessel ${table}.${col} auf leads nicht ab`
    );
  }
});
