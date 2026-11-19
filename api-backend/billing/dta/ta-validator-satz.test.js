// Wächter für die externen Testsätze (TA-Validator / AZE-Testpostfach).
//
// Warum: Die Skripte laufen nur von Hand. Als der Preflight die KVNR-Prüfziffer
// verschärfte (hasKvnrChecksum), fiel der Podologie-Satz still auf 0/8 — bemerkt
// erst am 19.11.2026 beim Versuch, ihn zu verschicken. Dieser Test lässt beide
// Sätze in beiden Modi laufen; bricht eine Builder-/Preflight-Änderung sie,
// wird `npm test` rot statt erst die Annahmestelle.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = dirname(fileURLToPath(import.meta.url));

/**
 * @param {string} skript
 * @param {string[]} args
 */
function lauf(skript, args) {
  const ordner = mkdtempSync(join(tmpdir(), 'ta-satz-'));
  try {
    const r = spawnSync(process.execPath, [join(hier, skript), ordner, ...args], { encoding: 'utf8' });
    return { status: r.status, out: r.stdout + r.stderr, eintraege: readdirSync(ordner) };
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
}

const faelle = [
  { skript: 'ta-validator-satz.mjs', args: [], erwartet: 8 },
  { skript: 'ta-validator-satz.mjs', args: ['--aze'], erwartet: 7 },
  { skript: 'ta-validator-satz-physio.mjs', args: [], erwartet: 5 },
  { skript: 'ta-validator-satz-physio.mjs', args: ['--aze'], erwartet: 5 },
];

for (const { skript, args, erwartet } of faelle) {
  test(`${skript} ${args.join(' ') || '(Validator)'}: alle ${erwartet} Dateien bestehen Builder + Preflight`, () => {
    const r = lauf(skript, args);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, new RegExp(`\\n${erwartet}/${erwartet} Dateien`), r.out);
    assert.doesNotMatch(r.out, /^ERR /m, r.out);
  });
}

test('Physio-AZE-Satz nummeriert ab TSOL0101 (keine Kollision mit Podologie TSOL0001 …)', () => {
  const r = lauf('ta-validator-satz-physio.mjs', ['--aze']);
  const namen = r.eintraege.filter(n => n.startsWith('TSOL')).map(n => n.slice(0, 8)).sort();
  assert.deepEqual(namen, ['TSOL0101', 'TSOL0102', 'TSOL0103', 'TSOL0104', 'TSOL0105']);
});
