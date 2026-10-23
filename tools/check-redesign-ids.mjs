#!/usr/bin/env node
/**
 * check-redesign-ids.mjs — Wache für das Redesign 2026-10 (redesign/AUFTRAG.md, Abschnitt 4.6).
 *
 * Warum
 * ─────
 * `dashboard.js` fragt über 1.600× per getElementById/querySelector nach
 * Elementen aus `dashboard.html`. Das Redesign darf Elemente verschieben und neu
 * verpacken, aber keine ID umbenennen oder löschen — sonst bricht eine
 * Funktion still (kein Fehler, nur ein `null`, das niemand bemerkt).
 *
 * Was geprüft wird
 * ────────────────
 * Jede ID aus `tools/redesign-id-baseline.txt` muss in `dashboard.html` noch
 * genau so vorkommen. Neue IDs sind erlaubt. Doppelte IDs werden gemeldet,
 * weil getElementById dann nur das erste Element findet.
 *
 * Dasselbe für Klassen (`tools/redesign-klassen-baseline.txt`): jede Klasse, die
 * in `dashboard.html` steht UND die JS abfragt oder setzt (classList, closest,
 * querySelector, matches), muss in `dashboard.html` erhalten bleiben. Neue
 * Gestaltungsklassen dürfen dazukommen, JS-Haken dürfen nicht verschwinden.
 *
 *   node tools/check-redesign-ids.mjs            prüfen (Exit 1 bei Verlust)
 *   node tools/check-redesign-ids.mjs --baseline Baseline neu schreiben
 *                                               (nur bewusst, z. B. nach Melihs OK)
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPfad = join(wurzel, 'dashboard.html');
const baselinePfad = join(wurzel, 'tools', 'redesign-id-baseline.txt');
const klassenPfad = join(wurzel, 'tools', 'redesign-klassen-baseline.txt');

const html = readFileSync(htmlPfad, 'utf8');
const alle = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
const vorhanden = new Set(alle);

const doppelt = [...new Set(alle.filter((id, i) => alle.indexOf(id) !== i))].sort();

// Klassen, die im HTML stehen (statische class="…"-Attribute).
const htmlKlassen = new Set([...html.matchAll(/\bclass="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean));

/** Klassen, die JS abfragt oder setzt — aus Selektor-Strings und classList-Aufrufen. */
function jsKlassen() {
  const dateien = ['dashboard.js', 'nav-registry.js', 'katalog-suche.js', 'patient-suche.js', 'calendar-widget.js',
    'bestaetigungs-dialog.js', ...readdirSync(join(wurzel, 'module')).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js')).map((f) => 'module/' + f)];
  const out = new Set();
  for (const f of dateien) {
    let q; try { q = readFileSync(join(wurzel, f), 'utf8'); } catch { continue; }
    for (const m of q.matchAll(/classList\.(?:add|remove|toggle|contains|replace)\(([^)]*)\)/g)) {
      for (const k of m[1].matchAll(/['"`]([\w-]+)['"`]/g)) out.add(k[1]);
    }
    for (const m of q.matchAll(/(?:querySelector(?:All)?|closest|matches)\(\s*(['"`])((?:(?!\1).)*)\1/g)) {
      for (const k of m[2].matchAll(/\.([A-Za-z_][\w-]*)/g)) out.add(k[1]);
    }
  }
  return out;
}

if (process.argv.includes('--baseline')) {
  const kopf = '# Alle id="…" aus dashboard.html — Stand der Redesign-Baseline (redesign/AUFTRAG.md 4.6).\n'
    + '# Geprüft von tools/check-redesign-ids.mjs. Nicht von Hand kürzen.\n';
  writeFileSync(baselinePfad, kopf + [...vorhanden].sort().join('\n') + '\n');
  const js = jsKlassen();
  const haken = [...htmlKlassen].filter((k) => js.has(k)).sort();
  writeFileSync(klassenPfad, '# Klassen aus dashboard.html, die JS abfragt oder setzt (redesign/AUFTRAG.md 4.6).\n'
    + '# Geprüft von tools/check-redesign-ids.mjs. Nicht von Hand kürzen.\n' + haken.join('\n') + '\n');
  console.log(`Baseline geschrieben: ${vorhanden.size} IDs, ${haken.length} Klassen`);
  process.exit(0);
}

const baseline = readFileSync(baselinePfad, 'utf8')
  .split('\n').map((z) => z.trim()).filter((z) => z && !z.startsWith('#'));
const fehlend = baseline.filter((id) => !vorhanden.has(id));
const klassenBaseline = readFileSync(klassenPfad, 'utf8')
  .split('\n').map((z) => z.trim()).filter((z) => z && !z.startsWith('#'));
const klassenFehlend = klassenBaseline.filter((k) => !htmlKlassen.has(k));

if (doppelt.length) {
  console.error(`✗ Doppelte IDs in dashboard.html (${doppelt.length}): ${doppelt.join(', ')}`);
}
if (fehlend.length) {
  console.error(`✗ ${fehlend.length} Baseline-ID(s) fehlen in dashboard.html:`);
  for (const id of fehlend) console.error('   - ' + id);
  console.error('  IDs dürfen im Redesign nicht umbenannt oder gelöscht werden (AUFTRAG 4.6).');
}
if (klassenFehlend.length) {
  console.error(`✗ ${klassenFehlend.length} JS-Klasse(n) fehlen in dashboard.html: ${klassenFehlend.join(', ')}`);
}
if (fehlend.length || doppelt.length || klassenFehlend.length) process.exit(1);
console.log(`✓ redesign-ids: alle ${baseline.length} Baseline-IDs vorhanden, keine doppelt (${vorhanden.size} gesamt)`
  + ` · ${klassenBaseline.length} JS-Klassen vorhanden`);
