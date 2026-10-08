#!/usr/bin/env node
// O-178 / K2b.16 (08.10.2026) — Drittanbieter-Lizenzen des Backend-Images.
//
// Läuft beim Bau des Images (api-backend/Dockerfile, direkt nach `npm install
// --omit=dev`) und liest den ECHTEN Paketbaum in node_modules — nicht die
// Lockfile: das Dockerfile nutzt `npm install`, nicht `npm ci`, der Baum im
// Image ist also die Wahrheit (onprem O-178 Bedingung 1).
//
// Zwei Aufgaben in einem Lauf:
//   1. Lizenztor (O-42): verbotene Lizenz ODER leeres/unbekanntes Lizenzfeld
//      → Exit 1, der Image-Bau bricht ab. Unbekannt ist so gefährlich wie
//      verboten — wir wüssten nicht, was wir ausliefern.
//   2. THIRD-PARTY-NOTICES.txt — die Lizenztexte, die wir mit der Box weiter-
//      geben müssen (MIT/BSD/Apache verlangen genau das). Ausgeliefert über
//      GET /api/ueber/lizenzen (routes/ueber.js), angezeigt in ueber.html.
//
// Die Erlaubt-/Verboten-Liste steht NUR hier (Quelle: onprem/REGISTER.md O-42).
// Es gibt keine eingecheckte Kopie der Ausgabe und kein --check: die Datei
// entsteht im Image und nirgends sonst.
//
// Lokal (Baum enthält dev-Pakete):
//   node tools/lizenzen-erzeugen.mjs --lock package-lock.json --ausgabe /tmp/x.txt

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// ── Regeln (O-42) ────────────────────────────────────────────────────────────

export const ERLAUBT = new Set([
  'MIT', 'MIT-0', 'ISC', '0BSD', 'BSD-2-Clause', 'BSD-3-Clause', 'BSD',
  'Apache-2.0', 'PostgreSQL', 'MPL-2.0', 'CC0-1.0', 'Unlicense',
  'BlueOak-1.0.0', 'Python-2.0', 'Public-Domain',
  // Schriften (fonts/, Inter + Outfit): Weitergabe erlaubt, Lizenztext muss mit (O-178 Bed. 2).
  'OFL-1.1',
]);

// Copyleft und "source available" — dürfen nicht an zahlende Praxen gehen.
export const VERBOTEN = /\b(A?GPL|LGPL|SSPL|BUSL|Elastic|Commons[- ]Clause|Sustainable)/i;

// Benannte, begründete Ausnahmen. Jede Ausnahme muss im Baum noch vorkommen —
// sonst bricht der Bau ab ("veraltet"), damit sie mit dem Paket verschwindet.
export const AUSNAHMEN = {
  // O-179 Phase 2: der SaaS-VPS startet das Image per compose-"command:" noch
  // mit pm2-runtime. In der Box läuft pm2 seit 67b0cab5 nicht mehr (CMD =
  // start.mjs), das Paket liegt aber noch im Image. Fällt mit KHS §5b T20 —
  // dann pm2 aus package.json entfernen und diese beiden Zeilen löschen.
  'pm2': 'O-179: nur noch für den SaaS-VPS-Override, in der Box nicht gestartet',
  '@pm2/agent': 'O-179: Abhängigkeit von pm2, siehe dort',
};

const NORMAL = new Map([
  ['apache-2', 'Apache-2.0'], ['apache 2.0', 'Apache-2.0'], ['apache2', 'Apache-2.0'],
  ['apache', 'Apache-2.0'], ['apache license 2.0', 'Apache-2.0'],
  ['mit/x11', 'MIT'], ['x11', 'MIT'], ['expat', 'MIT'],
  ['public domain', 'Public-Domain'],
  ['bsd-3', 'BSD-3-Clause'], ['bsd-2', 'BSD-2-Clause'],
]);

/** Ein einzelner Lizenzname → SPDX-Schreibweise (soweit bekannt). */
export function normalisiereName(name) {
  const n = String(name || '').trim();
  if (!n) return '';
  return NORMAL.get(n.toLowerCase()) || n;
}

/** package.json-Lizenzfeld (String, {type}, [{type}], licenses[]) → Ausdruck. */
export function lizenzAusdruck(pkg) {
  const roh = pkg?.license ?? pkg?.licenses;
  const einzeln = (x) => (typeof x === 'string' ? x : x?.type || '');
  if (Array.isArray(roh)) return roh.map(einzeln).filter(Boolean).join(' OR ');
  return einzeln(roh).trim();
}

/**
 * Bewertet einen SPDX-Ausdruck. OR: ein erlaubter Zweig reicht. AND: alle Teile
 * müssen erlaubt sein. WITH-Ausnahmen (z. B. LLVM-exception) werden ignoriert.
 * @returns {{status: 'erlaubt'|'verboten'|'unbekannt', ausdruck: string}}
 */
export function bewerteLizenz(ausdruck) {
  const roh = String(ausdruck || '').trim();
  if (!roh || /^(UNKNOWN|UNLICENSED|NONE)$/i.test(roh) || /^SEE LICEN[SC]E/i.test(roh)) {
    return { status: 'unbekannt', ausdruck: roh };
  }
  const zweige = roh.replace(/[()]/g, ' ').split(/\s+OR\s+/i).map((zweig) =>
    zweig.split(/\s+AND\s+/i).map((teil) => normalisiereName(teil.replace(/\s+WITH\s+.*$/i, ''))),
  );
  const normal = zweige.map((z) => z.join(' AND ')).join(' OR ');
  if (zweige.some((z) => z.every((t) => ERLAUBT.has(t)))) return { status: 'erlaubt', ausdruck: normal };
  if (zweige.some((z) => z.some((t) => VERBOTEN.test(t)))) return { status: 'verboten', ausdruck: normal };
  return { status: 'unbekannt', ausdruck: normal };
}

// ── Baum lesen ───────────────────────────────────────────────────────────────

const LIZENZDATEI = /^(licen[sc]e|copying|notice)([-._].*)?$/i;

function lizenzDateien(dir) {
  try {
    return fs.readdirSync(dir).filter((f) => LIZENZDATEI.test(f)).sort()
      .filter((f) => fs.statSync(path.join(dir, f)).isFile());
  } catch { return []; }
}

/** Fehlt das Feld, aus der ersten Zeile der Lizenzdatei erkennen (nur eindeutige Fälle). */
function ausDateiErkennen(text) {
  const kopf = text.slice(0, 200);
  if (/\bMIT License\b/i.test(kopf)) return 'MIT';
  if (/\bISC License\b/i.test(kopf)) return 'ISC';
  if (/Apache License,?\s+Version 2\.0/i.test(kopf)) return 'Apache-2.0';
  return '';
}

/**
 * Alle Pakete unter <wurzel>/node_modules, rekursiv (auch verschachtelte
 * node_modules), dedupliziert nach name@version.
 * @param {string} wurzel
 * @param {{devPfade?: Set<string>}} [opt] relative Pfade, die als dev gelten (nur lokal)
 */
export function sammlePakete(wurzel, { devPfade } = {}) {
  const pakete = new Map();
  const besuche = (nmDir) => {
    let eintraege;
    try { eintraege = fs.readdirSync(nmDir); } catch { return; }
    for (const e of eintraege) {
      if (e.startsWith('.')) continue;
      if (e.startsWith('@')) {
        for (const s of fs.readdirSync(path.join(nmDir, e))) paket(path.join(nmDir, e, s));
      } else paket(path.join(nmDir, e));
    }
  };
  const paket = (dir) => {
    const rel = path.relative(wurzel, dir).split(path.sep).join('/');
    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch { return; }
    if (!devPfade?.has(rel) && pkg.name) {
      const schluessel = `${pkg.name}@${pkg.version}`;
      if (!pakete.has(schluessel)) {
        const dateien = lizenzDateien(dir);
        const texte = dateien.map((f) => ({ datei: f, text: fs.readFileSync(path.join(dir, f), 'utf8') }));
        let ausdruck = lizenzAusdruck(pkg);
        let erkannt = false;
        if (!ausdruck && texte[0]) { ausdruck = ausDateiErkennen(texte[0].text); erkannt = !!ausdruck; }
        const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url || pkg.homepage || '';
        pakete.set(schluessel, { name: pkg.name, version: pkg.version, ausdruck, erkannt, repo, texte });
      }
    }
    besuche(path.join(dir, 'node_modules'));
  };
  besuche(path.join(wurzel, 'node_modules'));
  return [...pakete.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

/** dev-Pfade aus einer package-lock.json (v2/v3) — nur für lokale Läufe. */
export function devPfadeAusLock(lockDatei) {
  const lock = JSON.parse(fs.readFileSync(lockDatei, 'utf8'));
  return new Set(Object.entries(lock.packages || {}).filter(([k, v]) => k && v.dev).map(([k]) => k));
}

// ── Prüfen + Bericht ─────────────────────────────────────────────────────────

/** @returns {{fehler: string[], ergebnisse: object[]}} */
export function pruefe(pakete, ausnahmen = AUSNAHMEN) {
  const fehler = [];
  const ergebnisse = pakete.map((p) => {
    const b = bewerteLizenz(p.ausdruck);
    const ausnahme = ausnahmen[p.name];
    if (b.status !== 'erlaubt' && !ausnahme) {
      fehler.push(`${p.name}@${p.version}: ${b.status === 'verboten' ? 'verbotene' : 'unbekannte'} Lizenz „${p.ausdruck || '(leer)'}"`);
    }
    return { ...p, lizenz: b.ausdruck || '(leer)', status: b.status, ausnahme };
  });
  const namen = new Set(pakete.map((p) => p.name));
  for (const n of Object.keys(ausnahmen)) {
    if (!namen.has(n)) fehler.push(`Ausnahme „${n}" ist veraltet — Paket nicht mehr im Baum, Zeile in AUSNAHMEN löschen`);
  }
  return { fehler, ergebnisse };
}

const KOPF_IMAGE = [
  'Praxura — Lizenzen der mitgelieferten Fremdbestandteile (Server-Komponente)',
  'Erzeugt beim Bau des Images aus dem tatsächlich enthaltenen Paketbaum.',
];

export function erzeugeBericht(ergebnisse, kopf = KOPF_IMAGE) {
  const z = [...kopf];
  z.push(`${ergebnisse.length} Pakete.`);
  z.push('');
  z.push('ÜBERSICHT');
  z.push('');
  for (const r of ergebnisse) {
    z.push(`${r.name}@${r.version}  —  ${r.lizenz}${r.erkannt ? ' (aus Lizenzdatei)' : ''}${r.ausnahme ? '  [im Image enthalten, in der Box nicht ausgeführt]' : ''}`);
  }
  for (const r of ergebnisse) {
    z.push('');
    z.push('='.repeat(78));
    z.push(`${r.name}@${r.version}  —  ${r.lizenz}`);
    if (r.repo) z.push(`Quelle: ${r.repo.replace(/^git\+/, '')}`);
    z.push('='.repeat(78));
    if (!r.texte.length) {
      z.push(`(Das Paket enthält keine eigene Lizenzdatei. Es gilt der Standardtext der Lizenz ${r.lizenz}.)`);
    }
    for (const t of r.texte) {
      if (r.texte.length > 1) z.push(`--- ${t.datei} ---`);
      z.push(t.text.trimEnd());
    }
  }
  return z.join('\n') + '\n';
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const wurzel = path.resolve(arg('--wurzel') || '.');
  const ausgabe = arg('--ausgabe') || path.join(wurzel, 'lizenzen', 'THIRD-PARTY-NOTICES.txt');
  const lock = arg('--lock');
  const pakete = sammlePakete(wurzel, { devPfade: lock ? devPfadeAusLock(lock) : undefined });
  if (!pakete.length) { console.error('✗ Keine Pakete gefunden unter', path.join(wurzel, 'node_modules')); process.exit(1); }
  const { fehler, ergebnisse } = pruefe(pakete);
  if (fehler.length) {
    console.error('✗ Lizenztor (O-42) — Image wird NICHT gebaut:');
    for (const f of fehler) console.error('  ·', f);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(ausgabe), { recursive: true });
  fs.writeFileSync(ausgabe, erzeugeBericht(ergebnisse));
  const ausn = ergebnisse.filter((r) => r.ausnahme).length;
  console.log(`✓ Lizenztor: ${ergebnisse.length} Pakete geprüft, ${ausn} begründete Ausnahme(n) → ${ausgabe}`);
}
