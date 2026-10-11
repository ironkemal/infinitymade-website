// install.ps1 wird als `& ([scriptblock]::Create((irm https://praxura.de/install.ps1)))`
// gestartet. Windows PowerShell 5.1 reicht dabei ein UTF-8-BOM als erstes Zeichen
// durch; `<#` wird dann nicht mehr als Kommentarbeginn erkannt und der ganze
// Kopfkommentar als Code geparst (11.10.2026, erster echter Lauf auf einem
// sauberen Windows 11). Ohne BOM liest 5.1 eine Datei aber als ANSI — deshalb
// muss die Datei reines ASCII sein, dann stimmen beide Wege.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bytes = fs.readFileSync(path.join(repoRoot, 'installieren', 'install.ps1'));

test('install.ps1 beginnt ohne BOM direkt mit dem Kommentarblock', () => {
  assert.equal(bytes.subarray(0, 2).toString('latin1'), '<#');
});

test('install.ps1 ist reines ASCII', () => {
  const stelle = bytes.findIndex((b) => b > 127);
  const zeile = stelle < 0 ? 0 : bytes.subarray(0, stelle).toString('latin1').split('\n').length;
  assert.equal(stelle, -1, `Nicht-ASCII-Byte in Zeile ${zeile}`);
});
