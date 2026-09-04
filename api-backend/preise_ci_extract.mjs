/**
 * preise_ci_extract.mjs — nur für den GitHub-Actions-Workflow preise-check.yml.
 *
 * Liest die von `preise_autoupdate.mjs` erzeugte Ausgabe (Text + "---JSON---" +
 * ein JSON-Objekt in der letzten Zeile), trennt sie sauber und schreibt:
 *   - GITHUB_OUTPUT: changed=true|false, needs_review=true|false
 *   - preise-telegram-message.txt: der menschenlesbare Teil (für den curl-Schritt)
 *
 * Warum ein eigenes Skript statt bash-String-Fummelei in der YAML: JSON in einer
 * einzigen Shell-Zeile zu parsen (grep/contains auf rohem Text) ist genau die
 * Art Textmagie, die bei diesem Feature schon einmal vermieden wurde (siehe
 * preise_pruefen.mjs Kopf, "kein PDF-Parser, keine KI"). Hier ist es dieselbe
 * Haltung auf die CI-Klebe-Schicht angewendet: strukturierte Daten (JSON)
 * werden strukturiert gelesen, nicht mit Regex aus rohem Text gefischt.
 *
 * Nutzung: node preise_ci_extract.mjs <stdout-datei>
 */

import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';

const stdoutDatei = process.argv[2];
if (!stdoutDatei) {
  console.error('Nutzung: node preise_ci_extract.mjs <stdout-datei>');
  process.exit(1);
}

const inhalt = readFileSync(stdoutDatei, 'utf8');
const marker = '---JSON---';
const idx = inhalt.indexOf(marker);
if (idx === -1) {
  console.error('Kein "---JSON---"-Marker in der Ausgabe gefunden — preise_autoupdate.mjs abgestürzt?');
  process.exit(1);
}

const menschenlesbar = inhalt.slice(0, idx).trim();
const jsonZeile = inhalt.slice(idx + marker.length).trim().split('\n')[0];

let bericht;
try {
  bericht = JSON.parse(jsonZeile);
} catch (e) {
  console.error('JSON-Zeile nicht lesbar:', e.message, '\nZeile war:', jsonZeile);
  process.exit(1);
}

const changed = Array.isArray(bericht.changed) && bericht.changed.length > 0;
const needsReview = Array.isArray(bericht.needsReview) && bericht.needsReview.length > 0;

writeFileSync('preise-telegram-message.txt', menschenlesbar, 'utf8');

const githubOutput = process.env.GITHUB_OUTPUT;
if (githubOutput) {
  appendFileSync(githubOutput, `changed=${changed}\nneeds_review=${needsReview}\n`, 'utf8');
} else {
  console.log(`changed=${changed}`);
  console.log(`needs_review=${needsReview}`);
}
