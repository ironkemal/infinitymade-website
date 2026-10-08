#!/usr/bin/env node
// O-178 / K2b.16 (08.10.2026) — vendor/LICENSES.txt neu erzeugen.
//
// Die Oberfläche liefert Fremdcode aus vendor/ (lokal, kein CDN) und die
// Schriften aus fonts/ aus. Deren Lizenztexte müssen mit — MIT/BSD verlangen
// den Hinweis, die SIL OFL 1.1 den vollständigen Lizenztext.
//
// Ablauf: genau die Versionen aus vendor/README.md in ein Wegwerf-Verzeichnis
// installieren und denselben Lizenztor wie im Backend-Image darüberlaufen
// lassen (api-backend/tools/lizenzen-erzeugen.mjs). Der Baum enthält auch
// Laufzeit-Abhängigkeiten, die im Browser-Bundle nicht stecken (z. B. ws) —
// ein Hinweis zu viel schadet nicht, einer zu wenig schon.
//
// Bei jedem Versionswechsel in vendor/ oder fonts/: PAKETE anpassen, dann
//   node tools/vendor-lizenzen.mjs
// und vendor/LICENSES.txt mitcommitten.

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sammlePakete, pruefe, erzeugeBericht } from '../api-backend/tools/lizenzen-erzeugen.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Muss zu vendor/README.md und fonts/*.css passen.
const PAKETE = [
  '@supabase/supabase-js@2.112.3',
  'node-forge@1.3.1',
  'fullcalendar@6.1.11',
  '@fullcalendar/core@6.1.11',
  'cropperjs@1.6.1',
  // Schriften: nur wegen des OFL-Lizenztexts samt Copyright-Zeile des Projekts.
  // fonts/inter.css · outfit.css · system-fonts.css (Fraunces, Plus Jakarta Sans, JetBrains Mono).
  '@fontsource/inter',
  '@fontsource/outfit',
  '@fontsource/fraunces',
  '@fontsource/plus-jakarta-sans',
  '@fontsource/jetbrains-mono',
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vendor-lizenzen-'));
fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"vendor-lizenzen","private":true}');
// PAKETE sind feste Konstanten oben — keine Eingabe von außen in der Kommandozeile.
execSync(`npm install --omit=dev --ignore-scripts --no-audit --no-fund ${PAKETE.join(' ')}`,
  { cwd: tmp, stdio: 'inherit' });

const { fehler, ergebnisse } = pruefe(sammlePakete(tmp), {});
if (fehler.length) {
  console.error('✗ Lizenztor (O-42):');
  for (const f of fehler) console.error('  ·', f);
  process.exit(1);
}
const kopf = [
  'Praxura — Lizenzen der Fremdbestandteile der Oberfläche (vendor/ und fonts/)',
  'Erzeugt mit tools/vendor-lizenzen.mjs. Enthalten: Supabase-Client, node-forge,',
  'FullCalendar, Cropper.js sowie die Schriften Inter, Outfit, Fraunces, Plus Jakarta Sans',
  'und JetBrains Mono (alle SIL Open Font License 1.1).',
  'node-forge wird unter der BSD-3-Clause-Lizenz genutzt (Wahl aus „BSD-3-Clause OR GPL-2.0").',
];
const ziel = path.join(ROOT, 'vendor', 'LICENSES.txt');
fs.writeFileSync(ziel, erzeugeBericht(ergebnisse, kopf));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`✓ ${ergebnisse.length} Pakete → ${path.relative(ROOT, ziel)}`);
