#!/usr/bin/env node
// Node-Teil von tools/check-security-definer-grants.sh — siehe dort für Gerechtfertigung.
import { execSync } from 'node:child_process';

// S-01/S-02/S-19 (0001) + S-24 (0002) — guvenlik/REGISTER.md §4 Behoben.
const PROTECTED = [
  'get_gmail_token',
  'set_gmail_token',
  'clear_gmail_token',
  'naechste_nummer',
  'naechste_verordnungsnummer',
];

const files = process.argv.slice(2);
const bad = [];

for (const f of files) {
  let content;
  try {
    content = execSync('git show :' + JSON.stringify(f), { encoding: 'utf8' });
  } catch {
    continue; // gelöschte Datei o. ä. — nichts zu prüfen
  }

  for (const name of PROTECTED) {
    const creates = new RegExp(
      'CREATE\\s+(OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.' + name + '\\s*\\(',
      'i'
    ).test(content);
    if (!creates) continue;

    const revokes = new RegExp(
      'REVOKE\\s+(EXECUTE|ALL)\\b[^;]*\\bpublic\\.' + name + '\\b[^;]*\\bFROM\\b[^;]*\\bPUBLIC\\b',
      'is'
    ).test(content);
    if (!revokes) bad.push({ file: f, name });
  }
}

if (bad.length) {
  console.error('');
  console.error("  ✗ COMMIT REDDEDILDI — SECURITY DEFINER fonksiyonu REVOKE'suz yeniden yaratiliyor (S-04)");
  console.error('');
  for (const { file, name } of bad) {
    console.error('      ' + file + '  →  ' + name + '()');
  }
  console.error('');
  console.error("  CREATE (OR REPLACE) FUNCTION Postgres'te PUBLIC EXECUTE hakkini sifirlar.");
  console.error('  Ayni dosyada su satir olmadan bu fonksiyon anon/authenticated\'a yeniden acilir:');
  console.error('');
  console.error('      REVOKE EXECUTE ON FUNCTION public.<isim>(...) FROM PUBLIC;');
  console.error('');
  console.error('  Sicil: guvenlik/REGISTER.md §4 — S-01/S-02/S-19 (0001), S-24 (0002).');
  console.error('  Bilincli istisna gerekiyorsa:  SKIP_SECDEF_GATE=1 git commit ...');
  console.error('');
  process.exit(1);
}
