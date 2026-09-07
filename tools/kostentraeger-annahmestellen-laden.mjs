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

// Gültig-ab je Kassenart-Datei — VDT-Segment / Herausgeberseite prüfen,
// siehe wissensbank/REGISTER.md Kart W-01.
//
// ⛔ ZU LADEN IST DIE HEUTE GÜLTIGE AUSGABE, NICHT DIE NEUESTE.
// Der Wert rechts ist ein "gültig ab"-Datum. Liegt es in der Zukunft, gehört
// die Datei noch nicht in die DB — auch dann nicht, wenn sie die neuere ist.
// Genau das ist am 06.09.2026 passiert: EK05Q426 (vdek, gültig ab 01.10.2026)
// wurde geladen und EK05Q226 (gültig ab 01.04.2026, also die heute gültige)
// weggelassen, begründet mit "Q4 ist der Nachfolger von Q2". Bei quartalsweise
// datierten Stammdaten ist "das Neueste ist richtig" falsch: bis zum Stichtag
// gilt die alte Ausgabe, und eine Datenannahmestelle aus der falschen Periode
// heisst im §302 abgewiesene Datei. Nachgemessen wurde der Schaden dieses
// Falls (Q2 vs. Q4 zeichenweise): Unterschied sind zwei Zeilen bei der TK
// unter Abrechnungscode 30, unsere Codes 20/71/72 sind identisch — also heute
// harmlos, aber der Denkfehler bleibt. Details: db/REGISTER.md ->
// `kostentraeger_annahmestellen`, Abschnitt "ZEITFEHLER".
//
// Regel beim nächsten Quartalswechsel: erst am Stichtag umstellen, nicht
// vorher. Das Script warnt unten von selbst, wenn ein Datum in der Zukunft
// liegt oder zwei Dateien derselben Kassenart eingetragen sind.
const ECHT_DATEIEN = {
  'AO05Q326_KE3.txt': '2026-07-27',
  'BK05Q326_KE1.txt': '2026-07-01',
  'IK05Q326_KE1.txt': '2026-07-01',
  'BN050526_KE0.txt': '2026-05-01',
  'LK05Q226_KE0.txt': '2025-08-26',
  'EK05Q426_KE0.txt': '2026-10-01',
};

const ns = (v) => (v === null || v === undefined ? '' : v);

// Zeitprüfung: warnt, bevor eine noch nicht gültige Ausgabe in die DB geht,
// und wenn zwei Ausgaben derselben Kassenart gleichzeitig eingetragen sind
// (die beiden Präfixzeichen des Dateinamens sind die Kassenart: AO/BK/IK/BN/LK/EK).
function stichtageWarnen() {
  const heute = new Date().toISOString().slice(0, 10);
  let problem = false;

  for (const [datei, stand] of Object.entries(ECHT_DATEIEN)) {
    if (stand > heute) {
      console.warn(`⛔ ${datei} ist erst ab ${stand} gültig (heute ${heute}).`);
      console.warn('   Bis dahin gehört die vorherige Ausgabe derselben Kassenart in die DB.');
      console.warn('   Siehe db/REGISTER.md -> kostentraeger_annahmestellen, Abschnitt ZEITFEHLER.');
      problem = true;
    }
  }

  const proKassenart = {};
  for (const datei of Object.keys(ECHT_DATEIEN)) {
    const art = datei.slice(0, 2);
    (proKassenart[art] ||= []).push(datei);
  }
  for (const [art, dateien] of Object.entries(proKassenart)) {
    if (dateien.length > 1) {
      console.warn(`⚠️  Kassenart ${art}: ${dateien.length} Ausgaben gleichzeitig eingetragen (${dateien.join(', ')}).`);
      console.warn('   Der UNIQUE-Schlüssel enthält partner_ik, die Stände kollidieren also nicht —');
      console.warn('   sie stehen nebeneinander und die Routing-Abfrage bekommt zwei Antworten.');
      console.warn('   Nur zulässig, wenn der Leser datumsbewusst filtert (quelle_stand <= current_date).');
      problem = true;
    }
  }

  if (!problem) console.log('Stichtagsprüfung: in Ordnung (alle Ausgaben heute gültig, eine je Kassenart).');
  return problem;
}

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
  const zeitProblem = stichtageWarnen();
  if (zeitProblem && write && !process.argv.includes('--trotzdem')) {
    console.error('Abbruch: Stichtagsproblem (siehe oben). Bewusst trotzdem laden: --trotzdem');
    process.exit(2);
  }

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
