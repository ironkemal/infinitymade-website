/**
 * check_diagnosegruppen_icd.js
 *
 * Projiziert die ICD-Regeln der Podologie-Diagnosegruppen aus
 * `ai/validators/diagnosegruppen.json` (Abschnitt `podologie`) in die Tabelle
 * `diagnosegruppen`.
 *
 * Warum das Skript existiert: die Regeln werden an zwei Stellen gebraucht.
 * Das Backend liest die JSON-Datei (eigenes Docker-Image, kein Zugriff auf das
 * Repo-Wurzelverzeichnis), die Oberfläche liest die Tabelle. Ohne einen
 * Abgleich würden die beiden lautlos auseinanderlaufen — und ein Anwender
 * bekäme im Formular eine andere Auskunft als der Rezept-Validator.
 * Quelle der Wahrheit ist die JSON-Datei, die Tabelle ist ihre Projektion.
 *
 *   node check_diagnosegruppen_icd.js           # schreiben
 *   node check_diagnosegruppen_icd.js --check   # nur prüfen (Drift-Test, CI-tauglich)
 *
 * Bei --check ist Exit-Code 1 = DB weicht von der JSON-Datei ab.
 *
 * Voraussetzung: Migration database_v33_diagnosegruppen_icd_rules.sql ist
 * eingespielt (Spalten icd_accept / icd_exclude / icd_auto_select /
 * icd_accept_unsicher / icd_enforcement).
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHECK_ONLY = process.argv.includes('--check');

// ⚠ SUPABASE_SERVICE_ROLE_KEY — nicht SUPABASE_SERVICE_KEY. Der falsche Name
//   hat in Produktion schon eine Crash-Loop ausgelöst.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const JSON_SPALTEN = ['icd_accept', 'icd_exclude', 'icd_auto_select', 'icd_accept_unsicher'];

/** Regeln aus der JSON-Datei; Schlüssel mit führendem `_` sind Metadaten. */
function regelnAusJson() {
  const datei = join(__dirname, 'ai/validators/diagnosegruppen.json');
  const podo = JSON.parse(readFileSync(datei, 'utf-8')).podologie || {};
  const out = {};
  for (const [code, regel] of Object.entries(podo)) {
    if (code.startsWith('_')) continue;
    out[code] = {
      icd_accept:          regel.icd_accept          || [],
      icd_exclude:         regel.icd_exclude         || [],
      icd_auto_select:     regel.icd_auto_select     || [],
      icd_accept_unsicher: regel.icd_accept_unsicher || [],
      icd_enforcement:     regel.enforcement         || 'warn',
    };
  }
  return out;
}

/**
 * Jeden Regulärausdruck kompilieren. Ein kaputtes Muster fiele sonst erst zur
 * Laufzeit in der Oberfläche auf — und dort still, weil ungültige Muster
 * übersprungen werden.
 */
function pruefeRegex(regeln) {
  const fehler = [];
  for (const [code, regel] of Object.entries(regeln)) {
    for (const spalte of JSON_SPALTEN) {
      for (const eintrag of regel[spalte]) {
        if (typeof eintrag?.re !== 'string' || !eintrag.re) {
          fehler.push(`${code}.${spalte}: Eintrag ohne 're'`);
          continue;
        }
        try { new RegExp(eintrag.re); }
        catch (e) { fehler.push(`${code}.${spalte}: ${eintrag.re} — ${e.message}`); }
      }
    }
  }
  return fehler;
}

/** Vergleichbare Form: Reihenfolge der Einträge zählt, Schlüssel sortiert. */
function normalise(wert) {
  if (Array.isArray(wert)) {
    return JSON.stringify(wert.map(e => ({ re: e?.re ?? null, note: e?.note ?? null })));
  }
  return JSON.stringify(wert ?? null);
}

async function main() {
  const want = regelnAusJson();
  const codes = Object.keys(want);
  if (!codes.length) { console.error('✗ Keine Podologie-Regeln in diagnosegruppen.json gefunden'); process.exit(1); }

  const regexFehler = pruefeRegex(want);
  if (regexFehler.length) {
    console.error(`✗ ${regexFehler.length} ungültige(r) Regulärausdruck/-ausdrücke:`);
    for (const f of regexFehler) console.error(`  ${f}`);
    process.exit(1);
  }

  const { data: have, error } = await supabase
    .from('diagnosegruppen')
    .select('code,' + JSON_SPALTEN.join(',') + ',icd_enforcement')
    .eq('bereich', 'podologie');
  if (error) {
    console.error('✗ Lesen fehlgeschlagen:', error.message);
    if (/column .* does not exist/i.test(error.message)) {
      console.error('  → Migration database_v33_diagnosegruppen_icd_rules.sql ist noch nicht eingespielt.');
    }
    process.exit(1);
  }

  const haveMap = new Map((have || []).map(r => [r.code, r]));
  const fehlend = codes.filter(c => !haveMap.has(c));
  const ueberzaehlig = (have || []).map(r => r.code).filter(c => !want[c]);

  const abweichungen = [];
  for (const code of codes) {
    const ist = haveMap.get(code);
    if (!ist) continue;
    for (const spalte of [...JSON_SPALTEN, 'icd_enforcement']) {
      if (normalise(ist[spalte]) !== normalise(want[code][spalte])) {
        abweichungen.push(`${code}.${spalte}`);
      }
    }
  }

  console.log(`JSON-Datei: ${codes.length} Diagnosegruppen (${codes.join(', ')})`);
  console.log(`Datenbank:  ${(have || []).length} Zeilen mit bereich='podologie'`);
  console.log(`fehlend ${fehlend.length} · überzählig ${ueberzaehlig.length} · abweichend ${abweichungen.length}`);

  if (CHECK_ONLY) {
    for (const c of fehlend)      console.log(`  fehlt in der DB: ${c}`);
    for (const c of ueberzaehlig) console.log(`  überzählig in der DB: ${c}`);
    for (const a of abweichungen) console.log(`  abweichend: ${a}`);
    const drift = fehlend.length + ueberzaehlig.length + abweichungen.length;
    if (drift) {
      console.error(`\n✗ DRIFT: ${drift} Abweichung(en). 'node check_diagnosegruppen_icd.js' ausführen.`);
      process.exit(1);
    }
    console.log('\n✓ Datenbank deckungsgleich mit diagnosegruppen.json.');
    return;
  }

  // Bewusst nur UPDATE, kein Upsert: die fünf Zeilen sind Stammdaten und
  // existieren. Fehlt eine, ist das ein Befund und keine Gelegenheit, sie
  // nebenbei mit halben Angaben (label, sort, untergruppen) anzulegen.
  if (fehlend.length) {
    console.error(`✗ Diese Diagnosegruppen fehlen in der Tabelle und werden hier NICHT angelegt: ${fehlend.join(', ')}`);
    process.exit(1);
  }
  if (ueberzaehlig.length) {
    console.warn(`⚠ In der Tabelle stehen zusätzliche Podologie-Gruppen, die die JSON-Datei nicht kennt: ${ueberzaehlig.join(', ')} (unverändert gelassen)`);
  }

  for (const code of codes) {
    const { error: e } = await supabase
      .from('diagnosegruppen')
      .update(want[code])
      .eq('bereich', 'podologie')
      .eq('code', code);
    if (e) { console.error(`✗ Schreiben ${code}:`, e.message); process.exit(1); }
  }
  console.log(`✓ ${codes.length} Diagnosegruppen synchronisiert.`);
}

main();
