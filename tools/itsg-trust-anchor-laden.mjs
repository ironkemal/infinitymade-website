#!/usr/bin/env node
// § 302 SECON / O-116 — Lädt ITSG Trust-Anchor-Zertifikate (annahme-rsa4096.key)
// manuell in das lokale Datei-Artefaktverzeichnis `api-backend/billing/dta/trust-anchors/`.
//
// Nutzung:
//   node tools/itsg-trust-anchor-laden.mjs <pfad-zur-annahme-rsa4096.key> \
//     --quelle "https://trustcenter-data.itsg.de/dale/annahme-rsa4096.key" \
//     --onaylayan "Admin"
//
// Optionale Parameter:
//   --datum <YYYY-MM-DD>       Abrufdatum (Standard: heute)
//   --verzeichnis <zielordner> Zielverzeichnis (Standard: api-backend/billing/dta/trust-anchors/)
//
// G7-Regel:
//   Nutzt strikt parseAnnahmeliste() und schreibeItsgTrustAnchors() aus
//   api-backend/billing/dta/itsg-trust-anchor.js — keine eigene Parsing-Logik.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  parseAnnahmeliste,
  schreibeItsgTrustAnchors,
  DEFAULT_TRUST_ANCHORS_DIR
} from '../api-backend/billing/dta/itsg-trust-anchor.js';

function parseArgs() {
  const args = process.argv.slice(2);
  let keyPath = null;
  const opts = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      opts[key] = val;
    } else if (!keyPath) {
      keyPath = arg;
    }
  }

  if (opts.file) keyPath = opts.file;

  return { keyPath, opts };
}

function printHilfe() {
  console.error(`
Verwendung:
  node tools/itsg-trust-anchor-laden.mjs <pfad-zur-annahme-rsa4096.key> \\
    --quelle "<Herkunftstext>" \\
    --onaylayan "<Kürzel/Rolle>"

Optionale Parameter:
  --datum <YYYY-MM-DD>       Abrufdatum (Standard: heute)
  --verzeichnis <zielordner> Zielverzeichnis (Standard: api-backend/billing/dta/trust-anchors/)

Hinweis:
  Als --onaylayan bitte ausschließlich Rollen/Kürzel wie 'Admin' oder 'CI-Bot'
  verwenden (keine Klarnamen im Repository).
`.trim());
}

async function main() {
  const { keyPath, opts } = parseArgs();

  if (!keyPath || !opts.quelle || !opts.onaylayan) {
    printHilfe();
    console.error('\nFehlende Pflichtparameter:');
    if (!keyPath) console.error('  • Dateipfad fehlt');
    if (!opts.quelle) console.error('  • --quelle fehlt');
    if (!opts.onaylayan) console.error('  • --onaylayan fehlt');
    process.exit(1);
  }

  if (!existsSync(keyPath)) {
    console.error(`Fehler: Datei "${keyPath}" wurde nicht gefunden.`);
    process.exit(1);
  }

  console.log(`Lese Annahmeliste aus: ${keyPath}`);
  const rawBytes = readFileSync(keyPath);

  let certs;
  try {
    certs = parseAnnahmeliste(rawBytes);
  } catch (err) {
    console.error(`Fehler beim Parsen der Annahmeliste: ${err.message}`);
    process.exit(1);
  }

  console.log(`\n✅ ${certs.length} Zertifikat(e) erfolgreich geparst.\n`);

  const zielVerzeichnis = opts.verzeichnis || DEFAULT_TRUST_ANCHORS_DIR;
  const quelle = String(opts.quelle).trim();
  const quelleDatum = opts.datum ? String(opts.datum).trim() : new Date().toISOString().split('T')[0];
  const onaylayan = String(opts.onaylayan).trim();

  const meta = schreibeItsgTrustAnchors({
    certs,
    verzeichnis: zielVerzeichnis,
    quelle,
    quelleDatum,
    onaylayan
  });

  console.log('--- Extrahierte Vertrauensanker-Zertifikate ---');
  let earliestNotAfter = null;

  certs.forEach((c, idx) => {
    const validFrom = c.notBefore instanceof Date ? c.notBefore.toISOString() : c.notBefore;
    const validTo = c.notAfter instanceof Date ? c.notAfter.toISOString() : c.notAfter;
    const certNotAfter = new Date(validTo);

    if (!earliestNotAfter || certNotAfter < earliestNotAfter) {
      earliestNotAfter = certNotAfter;
    }

    const shortSubject = c.subject.replace(/\r?\n/g, ', ');
    console.log(`[${String(idx + 1).padStart(2, ' ')}] SHA-256: ${c.sha256.slice(0, 16)}... | Gültig bis: ${validTo} | ${shortSubject}`);
  });

  console.log('\n--- Zusammenfassung ---');
  console.log(`Zielverzeichnis:       ${zielVerzeichnis}`);
  console.log(`Anzahl Anker:          ${certs.length}`);
  console.log(`Frühestes Ablaufdatum: ${earliestNotAfter?.toISOString() || 'unbekannt'}`);
  console.log(`Quelle:                ${quelle}`);
  console.log(`Abrufdatum:            ${quelleDatum}`);
  console.log(`Onaylayan:             ${onaylayan}`);
  console.log(`meta.json geschrieben: ${join(zielVerzeichnis, 'meta.json')}`);

  console.log('\n============================================================');
  console.log('Bitte jetzt manuell prüfen und committen:');
  console.log('  git add api-backend/billing/dta/trust-anchors/');
  console.log('  git commit -m "chore(302): ITSG Trust-Anchor-Liste aktualisiert"');
  console.log('============================================================\n');
}

main().catch(err => {
  console.error('Unerwarteter Fehler:', err);
  process.exit(1);
});
