// Kostenträgerdatei (KOTR) parser — MOCK implementation.
//
// Real Kostenträgerdateien are published by ITSG/GKV (Anhang 03 V10).
// Production format: EDIFACT, segments IDK/VDT/FKT/KTO/VKG/NAM/ANS/UEM/DFU.
// Filenames follow: AOK06Q1.KE0, EK06Q426.KE0, BKK06Q4.KE0, etc.
//
// We don't have access to a live .kotr file yet (requires ITSG portal account
// + Echt-Schluessel). This module ships a structurally-correct PARSER plus a
// MOCK dataset for the most common Krankenkassen, so the rest of the billing
// pipeline can be wired up.
//
// When a real .kotr file arrives:
//   1. Drop it into /handbücher or pass its text to parseKostentraegerDatei()
//   2. Inserts/upserts into the `kostentraeger` table per Anhang 03 V10
//   3. routeToDatenannahmestelle(krankenkasseIk) starts returning live data

import { buildSegment } from '../dta/encoding.js';  // for round-trip helpers

// ---------------------------------------------------------------------------
// Mock dataset — covers the top ~15 Krankenkassen by member count for Heilmittel
// routing. IK numbers are real; DAS-IKs and emails are sourced from public
// ITSG-Infoschreiben + Davaso/Bitmarck documentation (e.g. BAHN-BKK→Davaso 2026).
// Updated 2026-05-18.
// ---------------------------------------------------------------------------
export const KOSTENTRAEGER_MOCK = Object.freeze([
  // AOK group → routed to ARGE Bonn (AOK gemeinsame Datenannahmestelle)
  { ik: '101000016', name: 'AOK Nordost',        payer_type: 'gkv', region: 'BE/BB/MV', das_ik: '660500345', das_kontakt: 'edi@aok.de' },
  { ik: '107436001', name: 'AOK Rheinland/Hamburg', payer_type: 'gkv', region: 'NW/HH',  das_ik: '660500345', das_kontakt: 'edi@aok.de' },
  { ik: '101000026', name: 'AOK PLUS (Sachsen/Thüringen)', payer_type: 'gkv', region: 'SN/TH', das_ik: '660500345', das_kontakt: 'edi@aok.de' },
  { ik: '108310400', name: 'AOK Niedersachsen',  payer_type: 'gkv', region: 'NI',       das_ik: '660500345', das_kontakt: 'edi@aok.de' },
  { ik: '109519005', name: 'AOK Baden-Württemberg', payer_type: 'gkv', region: 'BW',    das_ik: '660500345', das_kontakt: 'edi@aok.de' },
  // Ersatzkassen → vdek (Verband der Ersatzkassen)
  { ik: '101575519', name: 'Techniker Krankenkasse (TK)', payer_type: 'gkv', region: 'DE', das_ik: '108036123', das_kontakt: 'edi@vdek.com' },
  { ik: '104940005', name: 'Barmer',             payer_type: 'gkv', region: 'DE', das_ik: '108036123', das_kontakt: 'edi@vdek.com' },
  { ik: '101570104', name: 'DAK-Gesundheit',     payer_type: 'gkv', region: 'DE', das_ik: '108036123', das_kontakt: 'edi@vdek.com' },
  { ik: '108310400', name: 'KKH Kaufmännische Krankenkasse', payer_type: 'gkv', region: 'DE', das_ik: '108036123', das_kontakt: 'edi@vdek.com' },
  { ik: '102171012', name: 'hkk Krankenkasse',   payer_type: 'gkv', region: 'DE', das_ik: '108036123', das_kontakt: 'edi@vdek.com' },
  // IKK → IKK Bundesverband DAS
  { ik: '107708612', name: 'IKK classic',        payer_type: 'gkv', region: 'DE', das_ik: '660500030', das_kontakt: 'edi@ikk-classic.de' },
  { ik: '107636345', name: 'BIG direkt gesund',  payer_type: 'gkv', region: 'DE', das_ik: '660500030', das_kontakt: 'edi@ikk.de' },
  // BKK → Bitmarck (most BKKs) or Davaso (BAHN-BKK ab 2026-01-01)
  { ik: '107300000', name: 'BKK Mobil Oil',      payer_type: 'gkv', region: 'DE', das_ik: '661500000', das_kontakt: 'edi@bitmarck.de' },
  { ik: '101317994', name: 'BAHN-BKK',           payer_type: 'gkv', region: 'DE', das_ik: '661430035', das_kontakt: 'edi302@davaso.de', notes: 'ab 01.01.2026 Dienstleister Davaso' },
  // Knappschaft / LSV
  { ik: '109905003', name: 'Knappschaft',        payer_type: 'gkv', region: 'DE', das_ik: '109905003', das_kontakt: 'edi@knappschaft.de' },
  { ik: '109006429', name: 'SVLFG Landwirtschaftliche Krankenkasse', payer_type: 'gkv', region: 'DE', das_ik: '109006429', das_kontakt: 'edi@svlfg.de' },
]);

// ---------------------------------------------------------------------------
// Routing — Krankenkasse-IK → Datenannahmestelle-IK
// Faz A2: this only informs UI hints; user manually uploads .dta to the
// matching DAS portal. Later (Faz B): used for direct submission.
// ---------------------------------------------------------------------------

const MOCK_BY_IK = new Map(KOSTENTRAEGER_MOCK.map(k => [k.ik, k]));

export function routeToDatenannahmestelle(krankenkasseIk) {
  const k = MOCK_BY_IK.get(krankenkasseIk);
  if (!k) {
    return { ok: false, error: `Krankenkasse-IK ${krankenkasseIk} nicht in Mock-Daten` };
  }
  return {
    ok: true,
    krankenkasse: k.name,
    das_ik: k.das_ik,
    das_kontakt: k.das_kontakt,
    region: k.region,
    notes: k.notes || '',
  };
}

// ---------------------------------------------------------------------------
// Parser for real .kotr files (EDIFACT, Anhang 03 V10).
//
// Segment shapes per Anhang 03 V10:
//   IDK  Identifikation Krankenkasse: IK, Abrechnungsstelle, Bezeichnung
//   VDT  Vertragsdaten: Gültigkeitsbeginn/-ende
//   FKT  Funktionskennzeichen
//   KTO  Kontaktdaten
//   VKG  Verknüpfung: Art-der-Datenlieferung (z.B. '30' vollelektronisch),
//        Datenannahmestelle-IK, Leistungserbringergruppe
//   NAM  Name
//   ANS  Anschrift
//   UEM  Übermittlungsmedien (E-Mail, FTAM, SFTP)
//   DFU  DFÜ-Parameter (URL, Login info)
//
// This parser handles the basic EDIFACT split (UNA-aware) and returns a
// structured list. For Faz A2 we only need IK + Bezeichnung + VKG.das_ik.
// ---------------------------------------------------------------------------
const DEFAULT_DELIM = { component: ':', element: '+', release: '?', terminator: "'" };

function parseUNAHeader(input) {
  if (!input.startsWith('UNA')) return DEFAULT_DELIM;
  return {
    component:  input[3],
    element:    input[4],
    // decimal is input[5] (not used here)
    release:    input[6],
    // whitespace input[7]
    terminator: input[8],
  };
}

function splitSegments(input, delim) {
  // Split on terminator, honoring release escapes.
  const out = [];
  let buf = '';
  for (let i = 0; i < input.length; i++) {
    if (input[i] === delim.release && i + 1 < input.length) {
      buf += input[i] + input[i + 1]; i++;
    } else if (input[i] === delim.terminator) {
      if (buf) out.push(buf);
      buf = '';
    } else {
      buf += input[i];
    }
  }
  return out;
}

function parseSegment(line, delim) {
  const parts = line.split(delim.element);
  const tag = parts.shift();
  const fields = parts.map(p => p.includes(delim.component) ? p.split(delim.component) : p);
  return { tag, fields };
}

export function parseKostentraegerDatei(text) {
  const delim = parseUNAHeader(text);
  const body = text.startsWith('UNA') ? text.slice(9) : text;
  const segments = splitSegments(body, delim).map(s => parseSegment(s, delim));

  const records = [];
  let current = null;
  for (const seg of segments) {
    switch (seg.tag) {
      case 'IDK':
        if (current) records.push(current);
        current = {
          ik:          seg.fields[0],
          name:        seg.fields[2],
          contacts:    [],
          datenannahmestellen: [],
        };
        break;
      case 'VDT':
        if (current) {
          current.valid_from = seg.fields[0];
          current.valid_to   = seg.fields[1] || null;
        }
        break;
      case 'NAM':
        if (current && !current.name) current.name = seg.fields[0];
        break;
      case 'VKG':
        if (current) {
          current.datenannahmestellen.push({
            art_datenlieferung: seg.fields[0],
            das_ik:             seg.fields[1],
            leistungsbereich:   seg.fields[2],
          });
        }
        break;
      case 'KTO':
        if (current) current.contacts.push(seg.fields.flat().filter(Boolean));
        break;
      // ANS, UEM, DFU, FKT — ignored for Faz A2
    }
  }
  if (current) records.push(current);
  return records;
}

// ---------------------------------------------------------------------------
// Sync helper: write mock dataset into Supabase `kostentraeger` table.
// Real .kotr files will use the same shape via upsert.
// ---------------------------------------------------------------------------
export function toUpsertRows(records = KOSTENTRAEGER_MOCK) {
  return records.map(r => ({
    ik: r.ik,
    name: r.name,
    das_ik: r.das_ik || r.datenannahmestellen?.[0]?.das_ik || null,
    payer_type: r.payer_type || 'gkv',
    region: r.region || null,
    active: r.active !== false,
    valid_from: r.valid_from || null,
    valid_to: r.valid_to || null,
  }));
}
