#!/usr/bin/env node
// Prueft .from('tabelle').select('spalten') und Filter (.eq, .order, ...) gegen db/SCHEMA.sql.
// Anlass: module/start-aufgaben.js fragte leads.birth_date ab, die Spalte gibt es nicht.
// PostgREST antwortet dann mit Fehler, und der Aufrufer zeigte eine leere Liste.
//
// Nur feste Zeichenketten werden geprueft, Spaltenlisten aus Variablen bleiben unsichtbar.
// Unbekannte Namen in .from() (Storage-Buckets, Views) werden uebersprungen.
//
//   node tools/check-select-spalten.mjs           staged Dateien (Pre-Commit)
//   node tools/check-select-spalten.mjs --alle    ganzes Repo, Arbeitskopie
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const AUSGESCHLOSSEN = /^(ops|merkez|archive|vendor|onprem|tools|sosyal|Claude outputs|supabase\/migrations|\.claude)\/|(^|\/)node_modules\//;
const WINDOW = 1200;

export function leseTabellen(schema) {
  const tabellen = new Map();
  const norm = schema.replace(/\r\n/g, '\n');
  for (const m of norm.matchAll(/CREATE TABLE public\."?([^\s"(]+)"? \(([\s\S]*?)\n\);/g)) {
    const spalten = new Set();
    for (const z of m[2].split('\n')) {
      const s = z.trim().match(/^"?([^\s",]+)"?\s/)?.[1];
      if (s) spalten.add(s);
    }
    tabellen.set(m[1], spalten);
  }
  return tabellen;
}

// Eingebettete Beziehungen ("arzt:aerzte(name, lanr)"), auch verschachtelt, entfernen.
function ohneEinbettungen(liste) {
  let s = liste;
  let vorher;
  do {
    vorher = s;
    s = s.replace(/[\w"!:]+\s*\([^()]*\)/g, '');
  } while (s !== vorher);
  return s;
}

export function spaltenAusSelect(liste) {
  const namen = [];
  for (const teil of ohneEinbettungen(liste).split(',')) {
    const t = teil.trim();
    if (!t || t === '*' || t.includes('*')) continue;
    // alias:spalte, spalte::typ, spalte->>feld
    const ohneCast = t.split('::')[0];
    const ohneJson = ohneCast.split(/->/)[0];
    const name = ohneJson.includes(':') ? ohneJson.split(':').pop() : ohneJson;
    if (name.trim()) namen.push(name.trim());
  }
  return namen;
}

export function pruefeQuelle(src, tabellen) {
  const funde = [];
  const ohneKommentare = src.replace(/^\s*(\/\/|\*).*$/gm, (z) => ' '.repeat(z.length));
  for (const m of ohneKommentare.matchAll(/\.from\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const spalten = tabellen.get(m[1]);
    if (!spalten) continue;
    let rest = ohneKommentare.slice(m.index + m[0].length, m.index + m[0].length + WINDOW);
    const ende = rest.search(/;\s*(\n|$)|\.from\(|\.rpc\(/);
    if (ende >= 0) rest = rest.slice(0, ende);
    const namen = [];
    const sel = rest.match(/\.select\(\s*(['"])([^'"]*)\1/);
    if (sel) namen.push(...spaltenAusSelect(sel[2]));
    for (const f of rest.matchAll(/\.(eq|neq|in|is|gte|lte|gt|lt|order|ilike|like|contains)\(\s*['"]([\w"]+)['"]/g)) {
      namen.push(f[2].replace(/"/g, ''));
    }
    for (const n of new Set(namen)) {
      if (!spalten.has(n)) {
        funde.push({ zeile: src.slice(0, m.index).split('\n').length, tabelle: m[1], spalte: n });
      }
    }
  }
  return funde;
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
}

function alleDateien(dir, basis = '') {
  const liste = [];
  for (const n of readdirSync(dir)) {
    const rel = basis ? `${basis}/${n}` : n;
    if (n === '.git' || AUSGESCHLOSSEN.test(`${rel}/`)) continue;
    const pfad = join(dir, n);
    if (statSync(pfad).isDirectory()) liste.push(...alleDateien(pfad, rel));
    else liste.push(rel);
  }
  return liste;
}

const istRelevant = (f) => /\.(js|mjs|cjs)$/.test(f) && !/\.test\.(js|mjs)$/.test(f) && !AUSGESCHLOSSEN.test(f);

function main() {
  const root = git('rev-parse', '--show-toplevel').trim();
  process.chdir(root);
  const alle = process.argv.includes('--alle');
  const schema = alle ? readFileSync('db/SCHEMA.sql', 'utf8') : git('show', ':db/SCHEMA.sql');
  const tabellen = leseTabellen(schema);
  if (!tabellen.size) {
    console.error('check-select-spalten: keine Tabellen in db/SCHEMA.sql gefunden');
    process.exit(1);
  }
  const dateien = (alle ? alleDateien('.') : git('diff', '--cached', '--name-only', '--diff-filter=ACMR').split('\n')).filter(istRelevant);
  let anzahl = 0;
  for (const f of dateien) {
    const src = alle ? readFileSync(f, 'utf8') : git('show', `:${f}`);
    for (const x of pruefeQuelle(src, tabellen)) {
      console.error(`  ${f}:${x.zeile}  ${x.tabelle}.${x.spalte} gibt es nicht`);
      anzahl++;
    }
  }
  if (anzahl) {
    console.error(`\ncheck-select-spalten: ${anzahl} Spalte(n) fehlen in db/SCHEMA.sql.`);
    console.error('Spaltenname korrigieren oder Schema-Dump auffrischen. Ueberspringen: SKIP_SPALTEN_GATE=1');
    process.exit(1);
  }
  if (alle) console.log(`check-select-spalten: ${dateien.length} Dateien geprueft, ${tabellen.size} Tabellen, keine fehlende Spalte`);
}

if (process.argv[1]?.endsWith('check-select-spalten.mjs')) main();
