// Minimal tests for ZAA parser.
import { parseZaaFile } from './parser.js';
import { translateZaaCode } from './error-translations.js';

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { console.log('  ok  ', msg); passed++; }
  else      { console.error(' FAIL ', msg); failed++; }
}

// 1. Translation dictionary
const tr = translateZaaCode('101');
ok(tr && tr.text.includes('Positionsnummer'), 'translate 101 → Positionsnummer text');
ok(translateZaaCode('999') === null, 'unknown code → null');
ok(translateZaaCode('1') && translateZaaCode('1').text === translateZaaCode('01').text,
   'numeric → zero-padded fallback');

// 2. EDIFACT FEHL
const ediSample = [
  "UNB+UNOC:3+TESTABS+TESTREC+250519:1200+1'",
  "UNH+1+SLLA:21:0:0'",
  "INV+A1234567890123:1+0+0001234'",
  "FEHL+101+0001234+Positionsnummer 99999 unbekannt'",
  "FEHL+15+0001234+KVNR fehlt'",
  "UNT+5+1'",
  "UNZ+1+1'",
].join('');
const r1 = parseZaaFile(ediSample);
ok(r1.format === 'edifact', 'detects EDIFACT format');
ok(r1.errors.length === 2, 'extracts 2 FEHL rows');
ok(r1.errors[0].code === '101' && r1.errors[0].belegnummer === '0001234', 'first FEHL row code+belegnummer');
ok(r1.errors[0].uebersetzung && r1.errors[0].uebersetzung.includes('Positionsnummer'), 'enriches with translation');
ok(r1.errors[1].loesung, 'second row has fix hint');

// 3. Plain text
const plainSample = `Bericht ZAA — Davaso\n` +
  `0001234\t101\tPositionsnummer unbekannt\n` +
  `0001235\t15\tKVNR fehlt\n` +
  `Code: 401  Beleg: 0001236  Genehmigung erforderlich`;
const r2 = parseZaaFile(plainSample);
ok(r2.format === 'plain', 'detects plain text format');
ok(r2.errors.length === 3, 'extracts 3 plain-text rows');
ok(r2.errors[0].code === '101' && r2.errors[0].belegnummer === '0001234', 'plain row 1');
ok(r2.errors[2].code === '401', 'plain row 3 via Code/Beleg pattern');

// 4. Empty
const r3 = parseZaaFile('no errors here\nblob blob');
ok(r3.format === 'empty', 'empty format when nothing matches');
ok(r3.errors.length === 0, 'no errors when nothing matches');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
