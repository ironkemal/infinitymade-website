#!/usr/bin/env node
/**
 * redesign-basis.mjs — packt einen Git-Stand als Referenzbasis für T4/T5 aus (Redesign v2, PLAN-V2 V0.03).
 *
 * Warum
 * ─────
 * Die Alt-Referenz muss aus dem Stand kommen, gegen den gemergt wird (`origin/main`), nicht aus
 * dem eigenen Produktstand und nicht aus einem alten Commit. Sonst verdeckt die Referenz genau die
 * Abweichung, die sie finden soll (STATUS-V1 R-10/R-11).
 *
 *   node tools/redesign-basis.mjs [ref]      Standard: origin/main
 *     → .redesign-shots/_basis/<sha7>/   (gitignored, nur ausgelieferte Dateien, kein node_modules)
 *     Ausgabe: Pfad und SHA. Danach z. B.:
 *     node tools/redesign-shots.mjs --lauf alt-main-<sha7> --design alt --wurzel .redesign-shots/_basis/<sha7>
 *
 * `git archive` statt `git worktree add`: kein zusätzlicher Worktree-Eintrag im gemeinsamen
 * Repository, nichts zu entfernen, schreibgeschützt im Sinn von „wird nie bearbeitet“.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const ref = process.argv[2] || 'origin/main';
const sha = execFileSync('git', ['rev-parse', ref], { cwd: wurzel, encoding: 'utf8' }).trim();
const ziel = join(wurzel, '.redesign-shots', '_basis', sha.slice(0, 7));

if (!existsSync(join(ziel, 'dashboard.html'))) {
  mkdirSync(ziel, { recursive: true });
  const tar = execFileSync('git', ['archive', '--format=tar', sha], { cwd: wurzel, maxBuffer: 1 << 30 });
  execFileSync('tar', ['-x', '-C', ziel], { input: tar, maxBuffer: 1 << 30 });
}
console.log(`${relative(wurzel, ziel)}  (${ref} = ${sha})`);
