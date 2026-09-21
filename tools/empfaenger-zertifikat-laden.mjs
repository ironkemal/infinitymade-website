#!/usr/bin/env node
// §302 SECON — Lädt ein Empfänger-Verschlüsselungszertifikat (Annahmestelle / ITSG)
// in die Referenztabelle `public.empfaenger_zertifikate`.
//
// Nutzung:
//   node tools/empfaenger-zertifikat-laden.mjs <datei.pem|datei.der> \
//     --ik <9-stellige-IK> \
//     --fingerprint <sha256-hex> \
//     --quelle "<Herkunftsnachweis>" \
//     --onaylayan "<Admin-Pseudonym/Kürzel>"
//
// Sicherheitsregel (V4 / GGT Anlage 16):
//   Das Script berechnet den SHA-256-Fingerprint der DER-Bytes des Zertifikats selbst
//   und vergleicht ihn strikt mit dem übergebenen `--fingerprint`.
//   Weicht der Fingerprint ab, bricht das Script SOFORT ab, OHNE in die Datenbank zu schreiben.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import crypto from 'node:crypto';

const HIER = dirname(fileURLToPath(import.meta.url));
const REPO = join(HIER, '..');

function envLesen() {
  const envPath = join(REPO, 'api-backend', '.env');
  try {
    const text = readFileSync(envPath, 'utf8');
    const env = {};
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
    return env;
  } catch (err) {
    console.error(`Fehler beim Lesen von ${envPath}:`, err.message);
    process.exit(1);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  let certPath = null;
  const opts = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      opts[key] = val;
    } else if (!certPath) {
      certPath = arg;
    }
  }

  if (opts.file) certPath = opts.file;

  return { certPath, opts };
}

async function main() {
  const { certPath, opts } = parseArgs();

  if (!certPath || !opts.ik || !opts.fingerprint || !opts.quelle || !opts.onaylayan) {
    console.error(`
Verwendung:
  node tools/empfaenger-zertifikat-laden.mjs <datei.pem|datei.der> \\
    --ik <9-stellige-IK> \\
    --fingerprint <sha256-hex> \\
    --quelle "<Text>" \\
    --onaylayan "<Kürzel>"

Fehlende Parameter:
  ${!certPath ? '• Dateipfad fehlt\n' : ''}${!opts.ik ? '• --ik fehlt\n' : ''}${!opts.fingerprint ? '• --fingerprint fehlt\n' : ''}${!opts.quelle ? '• --quelle fehlt\n' : ''}${!opts.onaylayan ? '• --onaylayan fehlt\n' : ''}
    `.trim());
    process.exit(1);
  }

  const ik = String(opts.ik).trim().replace(/^IK/i, '');
  if (!/^\d{9}$/.test(ik)) {
    console.error(`Fehler: IK "${opts.ik}" ist kein gültiges 9-stelliges Institutionskennzeichen.`);
    process.exit(1);
  }

  const rawFile = readFileSync(certPath);
  let certDer;

  // Prüfen, ob PEM oder DER
  const textContent = rawFile.toString('utf8');
  if (textContent.includes('-----BEGIN CERTIFICATE-----')) {
    const base64 = textContent
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s+/g, '');
    certDer = Buffer.from(base64, 'base64');
  } else {
    certDer = rawFile;
  }

  // X.509 Validierung & Metadaten
  let x509;
  try {
    x509 = new crypto.X509Certificate(certDer);
  } catch (err) {
    console.error(`Fehler: Datei "${certPath}" enthält kein gültiges X.509-Zertifikat: ${err.message}`);
    process.exit(1);
  }

  // SHA-256 Fingerprint selbst berechnen
  const berechneterFingerprint = crypto.createHash('sha256').update(certDer).digest('hex').toLowerCase();
  const erwarteterFingerprint = String(opts.fingerprint).trim().replace(/[:\s]/g, '').toLowerCase();

  console.log('--- Zertifikatsdetails ---');
  console.log(`IK:            ${ik}`);
  console.log(`Subject:       ${x509.subject}`);
  console.log(`Issuer:        ${x509.issuer}`);
  console.log(`Gültig von:    ${x509.validFrom}`);
  console.log(`Gültig bis:    ${x509.validTo}`);
  console.log(`Berechneter SHA-256: ${berechneterFingerprint}`);
  console.log(`Erwarteter  SHA-256: ${erwarteterFingerprint}`);

  if (berechneterFingerprint !== erwarteterFingerprint) {
    console.error('\n❌ SICHERHEITSFEHLER: Der berechnete SHA-256-Fingerprint stimmt NICHT mit dem erwarteten Fingerprint überein!');
    console.error('Der Datensatz wird NICHT in die Datenbank geschrieben.');
    process.exit(2);
  }

  console.log('✅ Fingerprint stimmt exakt überein.');

  const env = envLesen();
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Fehler: SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen in api-backend/.env');
    process.exit(1);
  }

  const validFromDate = new Date(x509.validFrom).toISOString().split('T')[0];
  const validToDate = new Date(x509.validTo).toISOString().split('T')[0];
  const quelleDatum = opts.datum ? String(opts.datum).trim() : new Date().toISOString().split('T')[0];

  const payload = {
    ik,
    zertifikat_der: `\\x${certDer.toString('hex')}`,
    fingerprint_sha256: berechneterFingerprint,
    gueltig_von: validFromDate,
    gueltig_bis: validToDate,
    quelle: String(opts.quelle).trim(),
    quelle_datum: quelleDatum,
    onaylayan: String(opts.onaylayan).trim(),
    hochgeladen_am: new Date().toISOString()
  };

  const endpoint = `${SUPABASE_URL}/rest/v1/empfaenger_zertifikate?on_conflict=ik`;
  console.log(`\nSchreibe Empfängerzertifikat für IK ${ik} in ${endpoint}...`);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Fehler beim Speichern in Supabase (${res.status}): ${errText}`);
    process.exit(1);
  }

  console.log(`✅ Empfängerzertifikat für IK ${ik} erfolgreich in public.empfaenger_zertifikate gespeichert.`);
}

main().catch(err => {
  console.error('Unerwarteter Fehler:', err);
  process.exit(1);
});
