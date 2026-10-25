#!/usr/bin/env node
/**
 * redesign-wachen.mjs — statische Wachen für das Redesign v2 (PLAN-V2 V0.09, Teststufe T1).
 *
 * Warum
 * ─────
 * Fünf Fehlerarten sind im v1-Lauf passiert oder fast passiert und fallen keinem
 * Bildvergleich auf, weil sie erst später oder woanders wirken:
 *  1. Scope: eine Regel ohne `[data-design="neu"]` ändert das alte Design (Option A, E1).
 *  2. `!important` ohne Begründung: niemand weiß später, wogegen es stand (AUFTRAG 4.1).
 *  3. Cache: Datei geändert, `?v=` gleich geblieben → Browser zeigen alten Stand (AUFTRAG 4.9).
 *  4. Auslieferung: Datei lädt in dashboard.html, fehlt aber im Kutu-Image oder im
 *     Image-Workflow (genau so O-219: Feinschliff fehlte bis 24.10. in der Box).
 *  5. Schrumpf: gemeinsame Datei durch ein Skript geleert (STATUS R-13).
 *
 *   node tools/redesign-wachen.mjs     prüfen (Exit 1 bei Verstoß)
 * Die reinen Prüfungen sind exportiert und in tools/redesign-wachen.test.js getestet;
 * die Auslieferungsprüfung läuft dort zusätzlich gegen die echten Dateien (npm test).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Neu-Design-CSS: Tokens/Bausteine + alle Schichten im Ordner design/. */
export function neuCssDateien(wurzel = WURZEL) {
  const out = ['praxura-design.css'];
  const d = join(wurzel, 'design');
  if (existsSync(d)) for (const f of readdirSync(d).sort()) if (f.endsWith('.css')) out.push(`design/${f}`);
  return out.filter((f) => existsSync(join(wurzel, f)));
}

/** Selektorliste an Kommas der obersten Ebene trennen (nicht in `:is(a, b)` oder `[x="a,b"]`). */
export function trenneSelektoren(kopf) {
  const teile = [];
  let tiefe = 0, anfang = 0, inText = null;
  for (let i = 0; i < kopf.length; i++) {
    const c = kopf[i];
    if (inText) { if (c === inText) inText = null; continue; }
    if (c === '"' || c === "'") inText = c;
    else if (c === '(' || c === '[') tiefe++;
    else if (c === ')' || c === ']') tiefe--;
    else if (c === ',' && tiefe === 0) { teile.push(kopf.slice(anfang, i)); anfang = i + 1; }
  }
  teile.push(kopf.slice(anfang));
  return teile.map((s) => s.trim()).filter(Boolean);
}

/** 1) Jeder Selektor außerhalb von @keyframes/@font-face muss `data-design="neu"` enthalten. */
export function pruefeScope(css, name = 'css') {
  const fehler = [];
  const ohneKommentar = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const stapel = []; // Art je offener Klammer: 'at-keyframes' | 'at' | 'regel'
  let start = 0;
  for (let i = 0; i < ohneKommentar.length; i++) {
    const c = ohneKommentar[i];
    if (c === '{') {
      const kopf = ohneKommentar.slice(start, i).trim();
      const zeile = ohneKommentar.slice(0, i).split('\n').length;
      if (kopf.startsWith('@')) {
        stapel.push(/^@(-\w+-)?keyframes|^@font-face/.test(kopf) ? 'at-frei' : 'at');
      } else {
        const inFrei = stapel.includes('at-frei');
        if (!inFrei) {
          for (const sel of trenneSelektoren(kopf)) {
            if (!sel.includes('data-design="neu"')) fehler.push(`${name}:${zeile} Selektor ohne [data-design="neu"]: ${sel.slice(0, 80)}`);
          }
        }
        stapel.push('regel');
      }
      start = i + 1;
    } else if (c === '}') {
      stapel.pop();
      start = i + 1;
    } else if (c === ';' && stapel.at(-1) !== 'regel') {
      start = i + 1; // @import/@charset u. ä. auf oberster Ebene
    }
  }
  return fehler;
}

/** 2) Jede Zeile mit !important braucht einen Kommentar in den 10 Zeilen davor (Gruppen-Kommentar zählt). */
export function pruefeImportant(css, name = 'css') {
  const zeilen = css.split('\n');
  const fehler = [];
  let imKommentar = false;
  zeilen.forEach((z, i) => {
    const warImKommentar = imKommentar;
    const auf = z.lastIndexOf('/*'), zu = z.lastIndexOf('*/');
    if (auf > zu) imKommentar = true; else if (zu > auf) imKommentar = false;
    if (warImKommentar || !z.includes('!important')) return;
    const code = z.replace(/\/\*.*?\*\//g, '');
    if (!code.includes('!important')) return;
    const davor = zeilen.slice(Math.max(0, i - 10), i + 1).join('\n');
    if (!/\/\*|\*\//.test(davor)) fehler.push(`${name}:${i + 1} !important ohne Kommentar (wogegen?)`);
  });
  return fehler;
}

/** Lokale CSS/JS aus <link>/<script> in dashboard.html mit ?v=. */
export function lokaleAssets(html) {
  return [...html.matchAll(/(?:href|src)="\/?([^"#:?]+\.(?:css|js))(?:\?v=([^"]*))?"/g)]
    .map((m) => ({ datei: m[1], version: m[2] ?? null }));
}

/** 3) Geänderte Datei ⇒ andere ?v= als in HEAD. `geaendert(datei)` und `htmlHead` kommen von git. */
export function pruefeCache(html, htmlHead, geaendert) {
  const fehler = [];
  const vorher = new Map(lokaleAssets(htmlHead ?? '').map((a) => [a.datei, a.version]));
  for (const a of lokaleAssets(html)) {
    if (a.datei.startsWith('vendor/') || a.datei.startsWith('fonts/')) continue;
    if (!geaendert(a.datei)) continue;
    if (!a.version) fehler.push(`${a.datei} geändert, wird aber ohne ?v= geladen`);
    else if (vorher.get(a.datei) === a.version) fehler.push(`${a.datei} geändert, ?v=${a.version} ist unverändert (neue Nummer vergeben)`);
  }
  return fehler;
}

/** 4) Jede lokale Datei aus dashboard.html steht im Kutu-Dockerfile (COPY) und im Workflow (paths). */
export function pruefeAuslieferung(html, dockerfile, workflow) {
  const fehler = [];
  const kopiert = dockerfile.split('\n').filter((z) => /^COPY\s/.test(z) && !z.includes('--from='))
    .flatMap((z) => z.replace(/^COPY\s+/, '').trim().split(/\s+/).slice(0, -1));
  const pfade = [...workflow.matchAll(/^\s+-\s+'([^']+)'/gm)].map((m) => m[1]);
  // Eintrag deckt die Datei selbst oder ihren Ordner (`module`, `module/**`, `design/`).
  const deckt = (liste, datei) => liste.some((e) => {
    const sauber = e.replace(/\/\*\*$/, '').replace(/\/$/, '');
    return e === datei || datei.startsWith(sauber + '/');
  });
  for (const { datei } of lokaleAssets(html)) {
    if (!deckt(kopiert, datei)) fehler.push(`${datei}: fehlt in onprem/frontend.Dockerfile (COPY)`);
    if (!deckt(pfade, datei)) fehler.push(`${datei}: fehlt in .github/workflows/publish-frontend.yml (paths)`);
  }
  return fehler;
}

/** 5) Gemeinsame Datei auf unter 90 % ihrer HEAD-Größe geschrumpft (Zeichen). */
export function pruefeSchrumpf(jetzt, head, name) {
  if (head == null || head.length < 200) return [];
  return jetzt.length < head.length * 0.9 ? [`${name}: ${jetzt.length} statt ${head.length} Zeichen (−${Math.round((1 - jetzt.length / head.length) * 100)} %) — versehentlich geleert/gekürzt?`] : [];
}

export const GEMEINSAM = ['dashboard.html', 'dashboard.js', 'dashboard.css', 'dashboard-feinschliff.css', 'praxura-design.css', 'nav-registry.js', 'redesign/STATUS.md'];

function gitShow(pfad) {
  try { return execFileSync('git', ['show', `HEAD:${pfad}`], { cwd: WURZEL, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return null; }
}
function geaendertGegenHead(pfad) {
  try { execFileSync('git', ['diff', '--quiet', 'HEAD', '--', pfad], { cwd: WURZEL, stdio: 'ignore' }); return false; }
  catch { return true; }
}

const istHaupt = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (istHaupt) {
  const lies = (p) => readFileSync(join(WURZEL, p), 'utf8');
  const html = lies('dashboard.html');
  const fehler = [];
  for (const f of neuCssDateien()) { const css = lies(f); fehler.push(...pruefeScope(css, f), ...pruefeImportant(css, f)); }
  fehler.push(...pruefeCache(html, gitShow('dashboard.html'), geaendertGegenHead));
  fehler.push(...pruefeAuslieferung(html, lies('onprem/frontend.Dockerfile'), lies('.github/workflows/publish-frontend.yml')));
  for (const f of [...GEMEINSAM, ...neuCssDateien().filter((f) => f.startsWith('design/'))]) {
    if (existsSync(join(WURZEL, f)) && statSync(join(WURZEL, f)).isFile()) fehler.push(...pruefeSchrumpf(lies(f), gitShow(f), f));
  }
  if (fehler.length) {
    console.error(`✗ redesign-wachen: ${fehler.length} Verstoß/Verstöße`);
    for (const f of fehler.slice(0, 40)) console.error('   - ' + f);
    process.exit(1);
  }
  console.log(`✓ redesign-wachen: Scope + !important (${neuCssDateien().join(', ')}), Cache-Nummern, Auslieferung, Schrumpf ok`);
}
