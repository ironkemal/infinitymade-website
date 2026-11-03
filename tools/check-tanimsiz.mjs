#!/usr/bin/env node
// tools/check-tanimsiz.mjs — Gate fuer nicht deklarierte/tanimsiz Bezeichner in dashboard.js und module/*.js.
// Anlass: In dashboard.js:13676 fuehrte ein undeklariertes `g` in saveRezept zu einem P0-Laufzeitfehler.
//
// Nutzung:
//   node tools/check-tanimsiz.mjs          (nur staged Dateien — Pre-Commit-Modus)
//   node tools/check-tanimsiz.mjs --alle   (dashboard.js und alle module/*.js)
//   node tools/check-tanimsiz.mjs --datei <pfad>

import { execSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function leseBaseline(baselinePfad) {
  if (!existsSync(baselinePfad)) return new Set();
  const inhalt = readFileSync(baselinePfad, 'utf8');
  return new Set(inhalt.split('\n').map(z => z.trim()).filter(Boolean));
}

export function parseNameErrors(tscOutput, dateiFilter = null) {
  const fehler = [];
  const zeilen = (tscOutput || '').split('\n');
  const muster = /^(.+?)\((\d+),(\d+)\): error (TS2304|TS2552): (.+)$/;

  for (const raw of zeilen) {
    const z = raw.trim();
    const m = z.match(muster);
    if (!m) continue;
    const [, datei, line, col, code, meldung] = m;
    const normDatei = datei.replace(/\\/g, '/');
    if (dateiFilter && !dateiFilter(normDatei)) continue;
    fehler.push({
      datei: normDatei,
      line: parseInt(line, 10),
      col: parseInt(col, 10),
      code,
      meldung,
      schluessel: `${normDatei}:${meldung}`,
    });
  }
  return fehler;
}

export function filterGegenBaseline(fehler, baselineSet) {
  return fehler.filter(f => !baselineSet.has(f.schluessel) && !baselineSet.has(f.meldung));
}

export function ermittleZuPruefendeDateien(args = []) {
  if (args.includes('--alle')) {
    const moduleDateien = readdirSync('module')
      .filter(f => f.endsWith('.js') && !f.endsWith('.test.js'))
      .map(f => `module/${f}`);
    return ['dashboard.js', ...moduleDateien];
  }

  const dateiIdx = args.indexOf('--datei');
  if (dateiIdx !== -1 && args[dateiIdx + 1]) {
    return [args[dateiIdx + 1]];
  }

  // Pre-Commit-Modus: nur gestagte dashboard.js / module/*.js
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', { encoding: 'utf8' });
    const staged = out.split('\n')
      .map(s => s.trim().replace(/\\/g, '/'))
      .filter(f => f === 'dashboard.js' || (f.startsWith('module/') && f.endsWith('.js') && !f.endsWith('.test.js')));
    return staged;
  } catch {
    return [];
  }
}

export function fuehreTscAus(dateien) {
  if (!dateien.length) return '';
  const alle = ['module/globals.d.ts', ...dateien];
  const dateiArgs = alle.map(f => `"${f}"`).join(' ');
  const cmd = `node node_modules/typescript/bin/tsc --allowJs --checkJs --noEmit --target es2022 ${dateiArgs}`;
  try {
    execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 15 * 1024 * 1024 });
    return '';
  } catch (e) {
    return (e.stdout || '') + '\n' + (e.stderr || '');
  }
}

// Hauptprogramm
if (process.argv[1] && process.argv[1].endsWith('check-tanimsiz.mjs')) {
  const args = process.argv.slice(2);
  const dateien = ermittleZuPruefendeDateien(args);

  if (!dateien.length) {
    process.exit(0);
  }

  const baselinePfad = join(process.cwd(), 'tools/.tanimsiz-baseline');
  const baseline = leseBaseline(baselinePfad);

  const tscOut = fuehreTscAus(dateien);
  const dateiSet = new Set(dateien.map(d => d.replace(/\\/g, '/')));
  const alleFehler = parseNameErrors(tscOut, f => dateiSet.has(f));
  const neueFehler = filterGegenBaseline(alleFehler, baseline);

  if (neueFehler.length > 0) {
    console.error('\n❌ TANIMSIZ BEZEICHNER GEFUNDEN:');
    for (const f of neueFehler) {
      console.error(`  ${f.datei}:${f.line}:${f.col} - [${f.code}] ${f.meldung}`);
    }
    console.error(`\nBitte Variablen/Funktionen deklarieren oder importieren.`);
    console.error(`Bypass fuer Ausnahmen: SKIP_TANIMSIZ_GATE=1 git commit\n`);
    process.exit(1);
  } else {
    console.log(`✓ Tanimsiz bezeichner pruefung bestanden (${dateien.length} Datei(en) geprueft).`);
    process.exit(0);
  }
}
