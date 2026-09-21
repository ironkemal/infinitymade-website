#!/usr/bin/env node
// § 302 SECON / O-116 — CI-Abruf & Staging-Skript für .github/workflows/itsg-trust-anchor-check.yml
//
// S-28 / O-99 / O-116: Läuft im leseberechtigten Job (contents: read).
// Importiert parseAnnahmeliste() und schreibeItsgTrustAnchors() und schreibt
// in ein Staging-Verzeichnis (Standard: api-backend/_staging_trust_anchors).
//
// Setzt GitHub Action Outputs:
//   changed=true|false
//   needs_review=true|false
//
// Schreibt:
//   api-backend/trust-anchors-telegram-message.txt (für Benachrichtigungen)

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  parseAnnahmeliste,
  schreibeItsgTrustAnchors
} from '../api-backend/billing/dta/itsg-trust-anchor.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const REPO = join(HIER, '..');

const keyPath = process.argv[2] || join(REPO, 'annahme-rsa4096.key');
const stagingDir = process.argv[3] || join(REPO, 'api-backend', '_staging_trust_anchors');

if (!existsSync(keyPath)) {
  console.error(`::error::Annahmeliste-Datei nicht gefunden: ${keyPath}`);
  process.exit(1);
}

const rawBytes = readFileSync(keyPath);

let certs;
try {
  certs = parseAnnahmeliste(rawBytes);
} catch (err) {
  console.error(`::error::Fehler beim Parsen der Annahmeliste: ${err.message}`);
  process.exit(1);
}

// Validierung 1: Mindestens 1 Zertifikat enthalten
if (!certs || certs.length === 0) {
  console.error('::error::Keine Zertifikate in Annahmeliste gefunden (0 Zertifikate).');
  process.exit(1);
}

console.log(`Geparst: ${certs.length} Zertifikate.`);

// Validierung 2: Kein geparster Anker darf zum Abrufzeitpunkt bereits abgelaufen sein
const jetzt = new Date();
const abgelaufene = certs.filter(c => c.notAfter < jetzt);

let changed = false;
let needsReview = false;
let message = '';

if (abgelaufene.length > 0) {
  needsReview = true;
  changed = false;
  message = `⚠️ ACHTUNG: Die heruntergeladene ITSG-Annahmeliste enthält ${abgelaufene.length} bereits abgelaufene Zertifikate!\n` +
    `Automatischer Commit wurde gestoppt. Bitte manuell prüfen.\n` +
    `Abgelaufene Zertifikate:\n` +
    abgelaufene.map(c => `• ${c.sha256.slice(0, 16)}... (Gültig bis: ${c.notAfter.toISOString()}): ${c.subject.replace(/\r?\n/g, ', ')}`).join('\n');
  console.warn(message);
} else {
  // Validierung 3: Fingerprints (SHA-256-Set) gegen vorhandene meta.json prüfen
  const existingMetaPath = join(REPO, 'api-backend', 'billing', 'dta', 'trust-anchors', 'meta.json');
  let existingSet = new Set();

  if (existsSync(existingMetaPath)) {
    try {
      const existingMeta = JSON.parse(readFileSync(existingMetaPath, 'utf8'));
      if (Array.isArray(existingMeta.zertifikate)) {
        existingSet = new Set(existingMeta.zertifikate.map(z => z.sha256.toLowerCase()));
      }
    } catch (err) {
      console.warn(`Vorhandene meta.json nicht lesbar: ${err.message}. Behandle als "alles neu".`);
    }
  }

  const newSet = new Set(certs.map(c => c.sha256.toLowerCase()));

  let differs = newSet.size !== existingSet.size;
  if (!differs) {
    for (const fp of newSet) {
      if (!existingSet.has(fp)) {
        differs = true;
        break;
      }
    }
  }

  if (differs) {
    changed = true;
    console.log(`Änderung erkannt: ${newSet.size} neue Anker vs ${existingSet.size} bestehende Anker.`);

    schreibeItsgTrustAnchors({
      certs,
      verzeichnis: stagingDir,
      quelle: 'https://trustcenter-data.itsg.de/dale/annahme-rsa4096.key',
      quelleDatum: new Date().toISOString().split('T')[0],
      onaylayan: 'CI-Bot'
    });

    const dates = certs.map(c => c.notAfter.getTime());
    const earliestNotAfter = new Date(Math.min(...dates));

    message = `Neue ITSG-Trust-Anchor-Liste erfolgreich verifiziert und bereitgestellt.\n` +
      `• Anzahl Zertifikate: ${certs.length}\n` +
      `• Frühestes Ablaufdatum: ${earliestNotAfter.toISOString()}\n` +
      `• Vorherige Anzahl: ${existingSet.size}\n` +
      `• Commit & Deploy erfolgen im anschließenden Job.`;
  } else {
    changed = false;
    console.log(`Keine Änderung: Alle ${newSet.size} Anker stimmen mit dem bestehenden Stand überein.`);
    message = `ITSG-Trust-Anchor-Liste geprüft: Keine Änderungen (${newSet.size} Zertifikate unverändert).`;
  }
}

const msgPath = join(REPO, 'api-backend', 'trust-anchors-telegram-message.txt');
writeFileSync(msgPath, message, 'utf8');

const ghOutput = process.env.GITHUB_OUTPUT;
if (ghOutput) {
  appendFileSync(ghOutput, `changed=${changed}\nneeds_review=${needsReview}\n`, 'utf8');
} else {
  console.log(`changed=${changed}`);
  console.log(`needs_review=${needsReview}`);
}
