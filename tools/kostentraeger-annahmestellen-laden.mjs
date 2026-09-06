#!/usr/bin/env node
// Lädt die VKG-Verknüpfungen (Datenannahmestelle-Routing) aus den echten
// Kostenträgerdateien in `kostentraeger_annahmestellen`.
//
// Warum das hier steht (06.09.2026, Ops #264): der erste Import lief per Hand
// über einzelne SQL-Batches, nicht wiederholbar — beim nächsten Quartalswechsel
// (neue Dateien unter wissensbank/gemeinsam/kostentraeger/, Kart W-01) wäre die
// Arbeit sonst von vorn nötig. Dieses Script macht sie mit einem Aufruf erneut.
//
// Nutzung:
//   node tools/kostentraeger-annahmestellen-laden.mjs           # nur anzeigen
//   node tools/kostentraeger-annahmestellen-laden.mjs --write   # tatsächlich laden
//
// Voraussetzung: api-backend/.env mit SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
// Lädt NICHT automatisch — bei neuen Dateien zuerst die Liste ECHT_DATEIEN und
// die Stichtage (quelle_stand, von der Herausgeberseite / VDT-Segment) unten
// von Hand aktualisieren. `--write` räumt die Tabelle komplett und baut sie neu
// auf (TRUNCATE + INSERT) — sicher, weil `kostentraeger_annahmestellen` laut
// db/REGISTER.md noch codeStumm ist (kein Produktionscode liest sie).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseKostentraegerDatei } from '../api-backend/billing/kostentraeger/parser.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const REPO = join(HIER, '..');
const ECHT_DIR = join(REPO, 'wissensbank', 'gemeinsam', 'kostentraeger');

// Aktuelles Quartal je Kassenart-Datei — VDT-Segment / Herausgeberseite prüfen,
// siehe wissensbank/REGISTER.md Kart W-01. EK05Q226 (alte Quartalsversion,
// Ersatzkassen) bewusst ausgelassen — EK05Q426 ist ihr Nachfolger.
const ECHT_DATEIEN = {
  'AO05Q326_KE3.txt': '2026-07-27',
  'BK05Q326_KE1.txt': '2026-07-01',
  'IK05Q326_KE1.txt': '2026-07-01',
  'BN050526_KE0.txt': '2026-05-01',
  'LK05Q226_KE0.txt': '2025-08-26',
  'EK05Q426_KE0.txt': '2026-10-01',
};

const ns = (v) => (v === null || v === undefined ? '' : v);

function ladeZeilen() {
  const rows = [];
  for (const [datei, stand] of Object.entries(ECHT_DATEIEN)) {
    const text = readFileSync(join(ECHT_DIR, datei), 'utf8');
    const records = parseKostentraegerDatei(text);
    for (const r of records) {
      for (const v of r.datenannahmestellen) {
        rows.push({
          kostentraeger_ik: r.ik,
          verknuepfungsart: ns(v.verknuepfungsart),
          partner_ik: ns(v.partner_ik),
          leistungserbringergruppe: ns(v.leistungserbringergruppe),
          abrechnungscode: ns(v.abrechnungscode),
          art_datenlieferung: ns(v.art_datenlieferung),
          uebermittlungsmedium: ns(v.uebermittlungsmedium),
          bundesland: ns(v.bundesland),
          quelle: datei,
          quelle_stand: stand,
        });
      }
    }
  }
  return rows;
}

function envLesen() {
  const text = readFileSync(join(REPO, 'api-backend', '.env'), 'utf8');
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

async function main() {
  const write = process.argv.includes('--write');
  const rows = ladeZeilen();
  console.log(`${rows.length} VKG-Zeilen aus ${Object.keys(ECHT_DATEIEN).length} Dateien geparst.`);

  if (!write) {
    console.log('Nur-Anzeige-Modus. Zum Laden: --write');
    return;
  }

  const env = envLesen();
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen in api-backend/.env');
    process.exit(1);
  }

  // TRUNCATE geht nur per SQL (Management API / MCP), nicht per REST — das
  // muss vor diesem Script separat laufen (siehe Kommentar oben: die Tabelle
  // ist codeStumm, ein TRUNCATE vor dem Neu-Laden ist sicher).
  console.log('⚠️  Dieses Script LÄDT nur (Upsert per on_conflict) — TRUNCATE vorher separat ausführen,');
  console.log('    sonst bleiben veraltete Zeilen aus dem letzten Quartal stehen.');

  const onConflict = 'kostentraeger_ik,verknuepfungsart,partner_ik,abrechnungscode,art_datenlieferung,uebermittlungsmedium,bundesland';
  const endpoint = `${SUPABASE_URL}/rest/v1/kostentraeger_annahmestellen?on_conflict=${onConflict}`;

  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error(`Batch ${i}-${i + chunk.length} fehlgeschlagen: ${res.status} ${t.slice(0, 500)}`);
      process.exit(1);
    }
    inserted += chunk.length;
    console.log(`${inserted}/${rows.length}`);
  }
  console.log('Fertig.');
}

main();
