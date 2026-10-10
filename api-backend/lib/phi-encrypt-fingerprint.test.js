// Ein Fingerabdruck-Verfahren fuer den Datenschluessel (Kemal 11.10.2026):
// Panel (setup/pruefungen.js) und Backup-Kuenye (onprem/backup.sh
// parmak_izi_dek → backup.meta.json data_key_fingerprint) muessen denselben
// Wert zeigen, sonst kann /status nicht sagen, ob das letzte Backup mit dem
// laufenden Schluessel gemacht wurde. Dieser Test bricht, wenn eine Seite
// das Verfahren aendert und die andere nicht.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import { keyFingerprint } from './phi-encrypt.js';

const DOMAIN = 'praxura-backup-fingerprint-v1:dek';
const SCHLUESSEL = 'a'.repeat(64); // secret-scan: ignore (Fake-Testwert)

test('keyFingerprint = HMAC-SHA256(Domain dek), erste 16 Hex-Zeichen', () => {
  const vorher = process.env.DATA_ENCRYPTION_KEY;
  process.env.DATA_ENCRYPTION_KEY = SCHLUESSEL;
  try {
    const erwartet = createHmac('sha256', SCHLUESSEL).update(DOMAIN).digest('hex').slice(0, 16);
    assert.equal(keyFingerprint(), erwartet);
    assert.match(keyFingerprint(), /^[0-9a-f]{16}$/);
  } finally {
    if (vorher === undefined) delete process.env.DATA_ENCRYPTION_KEY;
    else process.env.DATA_ENCRYPTION_KEY = vorher;
  }
});

test('keyFingerprint ohne Schluessel = null', () => {
  const vorher = process.env.DATA_ENCRYPTION_KEY;
  delete process.env.DATA_ENCRYPTION_KEY;
  try {
    assert.equal(keyFingerprint(), null);
  } finally {
    if (vorher !== undefined) process.env.DATA_ENCRYPTION_KEY = vorher;
  }
});

test('backup.sh und restore.sh rechnen mit derselben Domain und Laenge', () => {
  for (const datei of ['../../onprem/backup.sh', '../../onprem/restore.sh']) {
    const text = fs.readFileSync(new URL(datei, import.meta.url), 'utf8');
    assert.ok(text.includes(`createHmac("sha256", k).update("${DOMAIN}")`), `${datei}: Domain/Verfahren`);
  }
  const backup = fs.readFileSync(new URL('../../onprem/backup.sh', import.meta.url), 'utf8');
  const fn = backup.slice(backup.indexOf('parmak_izi_dek()'), backup.indexOf('parmak_izi_db_taraf()'));
  assert.ok(fn.includes('head -c 16'), 'backup.sh kuerzt auf 16 Zeichen');
});
