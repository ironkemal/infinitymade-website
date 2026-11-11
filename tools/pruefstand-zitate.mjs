#!/usr/bin/env node
// Prüfstand-Zitate: prüft ohne KI, dass jedes Zitat der Prüfstand-Fälle wörtlich
// in der angegebenen wissensbank-Textdatei steht und die Fälle strukturell vollständig sind.
// Fixtures: api-backend/ai/validators/__tests__/fixtures/pruefstand/*.json (je Datei ein Array).
//
// Aufruf:  node tools/pruefstand-zitate.mjs [--kein-minimum]
//   --kein-minimum  schaltet nur die Mindestmengenprüfung (gesamt >= 80, podologie >= 25) ab.
// Das Zitat muss im Zeilenbereich stehen, den quelle.abschnitt nennt: "(Z. 678)" oder "(Z. 419–420)".
// So kann ein mehrfach vorkommender Satz (z. B. "bis zu 6x/VO") nicht der falschen Diagnosegruppe
// zugeschrieben werden.
// Wird auch von api-backend/ai/validators/__tests__/pruefstand.test.js importiert (pruefeZitate).
// Exit 0: alle Zitate gefunden (100 %) und keine Strukturfehler.
// Exit 1: sonst (auch: Ordner fehlt oder keine Fixtures).
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'api-backend/ai/validators/__tests__/fixtures/pruefstand');

const BEREICHE = ['podologie', 'physio', 'ergo', 'logo', 'uebergreifend'];
const ENGINES = ['standard', 'lhb_bvb', 'blanko'];
const STATUS = ['aktiv', 'bewusst', 'befund'];

const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
const nichtLeer = (v) => typeof v === 'string' && v.trim() !== '';
const cache = new Map();
function zeilen(rel) {
  if (!cache.has(rel)) cache.set(rel, readFileSync(path.join(ROOT, rel), 'utf8').split('\n'));
  return cache.get(rel);
}
// "(Z. 678)" / "(Z. 419–420)" → [von, bis] (1-basiert) oder null
function zeilenbereich(abschnitt) {
  const m = /\(Z\. (\d+)(?:[–-](\d+))?\)/.exec(String(abschnitt));
  if (!m) return null;
  const von = Number(m[1]), bis = Number(m[2] || m[1]);
  return von >= 1 && bis >= von ? [von, bis] : null;
}

// Prüft alle Fixtures. Rückgabe: { fehler: string[], gesamt, zitateOk, jeDatei, jeBereich, jeStatus }
export function pruefeZitate({ minimum = true } = {}) {
const meldungen = [];
const leer = { fehler: meldungen, gesamt: 0, zitateOk: 0, jeDatei: {}, jeBereich: {}, jeStatus: {} };

if (!existsSync(DIR) || !statSync(DIR).isDirectory()) {
  meldungen.push(`FEHLER: Fixture-Ordner fehlt: ${path.relative(ROOT, DIR)}`);
  return leer;
}
const dateien = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
if (dateien.length === 0) {
  meldungen.push(`FEHLER: keine *.json-Fixtures in ${path.relative(ROOT, DIR)}`);
  return leer;
}

const melde = (id, grund) => { meldungen.push(`FEHLT ${id}: ${grund}`); };

const ids = new Set();
const jeDatei = {}, jeBereich = {}, jeStatus = {};
let gesamt = 0, zitateOk = 0;

for (const datei of dateien) {
  let faelle;
  try { faelle = JSON.parse(readFileSync(path.join(DIR, datei), 'utf8')); }
  catch (e) { melde(datei, `kein gültiges JSON (${e.message})`); continue; }
  if (!Array.isArray(faelle)) { melde(datei, 'Datei ist kein JSON-Array'); continue; }
  jeDatei[datei] = faelle.length;
  faelle.forEach((f, i) => {
    gesamt++;
    const id = f && nichtLeer(f.id) ? f.id : `${datei}#${i}`;
    if (!f || typeof f !== 'object') return melde(id, 'Fall ist kein Objekt');
    if (!nichtLeer(f.id)) melde(id, 'Pflichtfeld id fehlt');
    else if (ids.has(f.id)) melde(id, 'id doppelt');
    else ids.add(f.id);
    if (!nichtLeer(f.titel)) melde(id, 'Pflichtfeld titel fehlt');
    if (!BEREICHE.includes(f.bereich)) melde(id, `bereich ungültig: ${f.bereich}`);
    if (!('engine_erwartet' in f)) melde(id, 'Pflichtfeld engine_erwartet fehlt');
    else if (f.engine_erwartet !== null && !ENGINES.includes(f.engine_erwartet)) melde(id, `engine_erwartet ungültig: ${f.engine_erwartet}`);
    if (!('eingabe' in f)) melde(id, 'Pflichtfeld eingabe fehlt');
    if (!f.erwartet || typeof f.erwartet !== 'object') melde(id, 'Pflichtfeld erwartet fehlt');
    if (!STATUS.includes(f.status)) melde(id, `status ungültig: ${f.status}`);
    else if (f.status !== 'aktiv' && !nichtLeer(f.grund)) melde(id, `grund fehlt (Status ${f.status})`);
    jeBereich[f.bereich] = (jeBereich[f.bereich] || 0) + 1;
    jeStatus[f.status] = (jeStatus[f.status] || 0) + 1;

    const q = f.quelle;
    if (!q || typeof q !== 'object') return melde(id, 'Pflichtfeld quelle fehlt');
    for (const k of ['datei', 'abschnitt', 'version', 'zitat']) if (!nichtLeer(q[k])) melde(id, `quelle.${k} fehlt`);
    if (!nichtLeer(q.datei) || !nichtLeer(q.zitat)) return;
    let dateiOk = true;
    if (!q.datei.startsWith('wissensbank/') || !q.datei.endsWith('.txt') || q.datei.split(/[/\\]/).includes('..')) {
      melde(id, `quelle.datei ungültig: ${q.datei}`); dateiOk = false;
    } else if (!existsSync(path.join(ROOT, q.datei))) {
      melde(id, `quelle.datei existiert nicht: ${q.datei}`); dateiOk = false;
    }
    const zitat = norm(q.zitat);
    if (zitat.length < 15 || q.zitat.length > 300) melde(id, `Zitat-Länge ${zitat.length} außerhalb 15–300`);
    const bereich = zeilenbereich(q.abschnitt);
    if (!bereich) melde(id, 'quelle.abschnitt ohne Zeilenangabe "(Z. n)" bzw. "(Z. n–m)"');
    if (!dateiOk || !bereich) return;
    const ausschnitt = norm(zeilen(q.datei).slice(bereich[0] - 1, bereich[1]).join('\n'));
    if (ausschnitt.includes(zitat)) zitateOk++;
    else melde(id, `Zitat nicht wörtlich in ${q.datei} Z. ${bereich[0]}–${bereich[1]}`);
  });
}

if (minimum) {
  if (gesamt < 80) melde('MINIMUM', `nur ${gesamt} Fälle gesamt, mindestens 80 nötig`);
  const pod = jeBereich.podologie || 0;
  if (pod < 25) melde('MINIMUM', `nur ${pod} Fälle im Bereich podologie, mindestens 25 nötig`);
}

return { fehler: meldungen, gesamt, zitateOk, jeDatei, jeBereich, jeStatus };
}

// Direkter Aufruf (nicht beim Import aus dem Test)
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const r = pruefeZitate({ minimum: !process.argv.includes('--kein-minimum') });
  for (const m of r.fehler) console.log(m);
  const pct = r.gesamt ? ((r.zitateOk / r.gesamt) * 100).toFixed(1) : '0.0';
  const liste = (o) => Object.entries(o).map(([k, v]) => `${k}=${v}`).join(', ');
  console.log(`\nFälle gesamt: ${r.gesamt}`);
  console.log(`Je Datei: ${liste(r.jeDatei)}`);
  console.log(`Je Bereich: ${liste(r.jeBereich)}`);
  console.log(`Je Status: ${liste(r.jeStatus)}`);
  console.log(`Zitate gefunden: ${r.zitateOk}/${r.gesamt} (${pct} %)`);
  process.exit(r.gesamt > 0 && r.fehler.length === 0 && r.zitateOk === r.gesamt ? 0 : 1);
}
