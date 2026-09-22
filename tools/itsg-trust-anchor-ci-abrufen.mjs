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

// Validierung 2: Harter Stopp NUR, wenn die GESAMTE heruntergeladene Liste bereits
// abgelaufen ist — nicht schon, wenn nur EINZELNE Anker (z. B. rotierte Sub-CAs, die
// ITSG weiter in der Annahmeliste führt) abgelaufen sind. Muss dieselbe Semantik wie
// pruefeTrustAnchorFrische() in itsg-trust-anchor.js haben (Kaltprüfung 21.09.2026 fand
// die Laufzeit-Version bereits korrigiert, die CI-Version hatte die alte "ein Anker
// reicht" Logik behalten — hätte sonst ab dem ersten einzelnen Ablauf jedes künftige
// wöchentliche Update dauerhaft blockiert, bis der komplette Store 31.12.2027 ausläuft).
const jetzt = new Date();
const abgelaufene = certs.filter(c => c.notAfter < jetzt);

let changed = false;
let needsReview = false;
let message = '';

if (abgelaufene.length === certs.length) {
  needsReview = true;
  changed = false;
  message = `⚠️ ACHTUNG: ALLE ${certs.length} Zertifikate der heruntergeladenen ITSG-Annahmeliste sind bereits abgelaufen!\n` +
    `Automatischer Commit wurde gestoppt. Bitte manuell prüfen.\n` +
    `Abgelaufene Zertifikate:\n` +
    abgelaufene.map(c => `• ${c.sha256.slice(0, 16)}... (Gültig bis: ${c.notAfter.toISOString()}): ${c.subject.replace(/\r?\n/g, ', ')}`).join('\n');
  console.warn(message);
} else {
  if (abgelaufene.length > 0) {
    console.warn(
      `Hinweis: ${abgelaufene.length} von ${certs.length} heruntergeladenen Ankern sind bereits abgelaufen ` +
      `(vermutlich rotierte Sub-CAs, die ITSG weiter in der Liste führt). Update läuft trotzdem weiter, da ` +
      `${certs.length - abgelaufene.length} Anker noch gültig sind.`
    );
  }
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

    // O-131-Nachaudit (22.09.2026): "Frühestes Ablaufdatum" nur ueber die noch
    // GÜLTIGEN Anker bilden, nicht ueber alle (inkl. bereits rotierter/abge-
    // laufener Sub-CAs, die abgelaufene.length > 0 oben bewusst durchlaesst).
    // Sonst meldet die Erfolgsnachricht ein Datum in der Vergangenheit und ein
    // Operator haelt den frisch verifizierten Release faelschlich fuer bereits
    // ablaufend.
    const gueltige = certs.filter(c => c.notAfter >= jetzt);
    const dates = gueltige.map(c => c.notAfter.getTime());
    const earliestNotAfter = new Date(Math.min(...dates));

    message = `Neue ITSG-Trust-Anchor-Liste erfolgreich verifiziert und bereitgestellt.\n` +
      `• Anzahl Zertifikate: ${certs.length}` +
      (abgelaufene.length > 0 ? ` (davon ${abgelaufene.length} bereits abgelaufene Alt-Anker, ignoriert)` : '') + `\n` +
      `• Frühestes Ablaufdatum (unter den gültigen Ankern): ${earliestNotAfter.toISOString()}\n` +
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
