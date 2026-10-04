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

// 2b. Entwertetes Apostroph im Freitext der Kasse.
// Der frühere naive split("'") zerschnitt das FEHL-Segment an dieser Stelle:
// die erste Absetzung verlor ihren Text, der Rest wurde als eigenes (unbekanntes)
// Segment gelesen. Mit segmenteTrennen bleibt das Segment ganz.
const ediEscaped = [
  "UNB+UNOC:3+TESTABS+TESTREC+250519:1200+1'",
  "UNH+1+SLLA:21:0:0'",
  "INV+A1234567890123:1+0+0001234'",
  "FEHL+101+0001234+Pos.Nr. im Vertrag ?'Anlage 5?' nicht gelistet'",
  "FEHL+15+0001235+KVNR fehlt'",
  "UNT+5+1'",
  "UNZ+1+1'",
].join('');
const r1b = parseZaaFile(ediEscaped);
ok(r1b.errors.length === 2, 'entwertetes Apostroph zerschneidet das Segment nicht');
ok(r1b.errors[0].belegnummer === '0001234' && r1b.errors[1].belegnummer === '0001235',
   'beide Absetzungen behalten ihre Belegnummer');
ok(r1b.errors[0].text.includes('Anlage 5'), 'Freitext der Kasse bleibt vollständig');

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

// 3b. Kurze Belegnummer im neuen Format <Patientennummer>-<Verordnungsnummer>.
// Mit der alten Untergrenze {4,20} war "1-1" unsichtbar: die Absetzung des
// ersten Rezepts des ersten Patienten waere still verlorengegangen.
const kurzSample = `Bericht ZAA\n1-1\t101\tPositionsnummer unbekannt\n147-12\t15\tKVNR fehlt`;
const r2b = parseZaaFile(kurzSample);
ok(r2b.errors.length === 2, 'kurze Belegnummern werden erkannt');
ok(r2b.errors[0].belegnummer === '1-1', 'Belegnummer 1-1 erkannt');
ok(r2b.errors[1].belegnummer === '147-12', 'Belegnummer 147-12 erkannt');

// 3c. Entwertetes Plus im Freitext (Schritt 1.9 e).
// `d8249d6` hat die SEGMENT-Trennung entwertungsfest gemacht, die FELD-Trennung
// nicht. Ein `?+` im Freitext zerschnitt das Segment eine Ebene tiefer an der
// falschen Stelle — die Absetzung landete auf dem falschen Beleg oder ganz im
// Nichts. Beides kostet Geld, und beides waere nicht aufgefallen.
const entwertet = "UNB+x'FEHL+101+0001234+Zuschlag A ?+ B nicht abrechenbar'";
const r2c = parseZaaFile(entwertet);
ok(r2c.errors.length === 1, 'ein FEHL trotz entwertetem Plus im Freitext');
ok(r2c.errors[0].code === '101', 'Fehlercode bleibt 101');
ok(r2c.errors[0].belegnummer === '0001234', 'Belegnummer bleibt am richtigen Beleg');
ok(/A \?\+ B/.test(r2c.errors[0].text), 'der Freitext bleibt in EINEM Feld: ' + r2c.errors[0].text);

// 4. Empty & Unknown
const r3 = parseZaaFile('no errors here\nblob blob');
ok(r3.format === 'empty', 'empty format when nothing matches');
ok(r3.errors.length === 0, 'no errors when nothing matches');
ok(r3.valid === false && r3.reason === 'unknown', 'unknown arbitrary text rejected as unknown (no success receipt inferred)');

// 5. Fail-closed: null, blank, wrong types
const rNull = parseZaaFile(null);
ok(rNull.valid === false && rNull.reason === 'empty' && rNull.format === 'empty' && rNull.errors.length === 0,
   'null input rejected as empty');

const rUndef = parseZaaFile(undefined);
ok(rUndef.valid === false && rUndef.reason === 'empty' && rUndef.format === 'empty' && rUndef.errors.length === 0,
   'undefined input rejected as empty');

const rBlank = parseZaaFile('   \n\t  \r\n');
ok(rBlank.valid === false && rBlank.reason === 'empty' && rBlank.format === 'empty' && rBlank.errors.length === 0,
   'whitespace/blank input rejected as empty');

const rEmptyStr = parseZaaFile('');
ok(rEmptyStr.valid === false && rEmptyStr.reason === 'empty' && rEmptyStr.format === 'empty' && rEmptyStr.errors.length === 0,
   'empty string input rejected as empty');

const rObj = parseZaaFile({ some: 'data' });
ok(rObj.valid === false && rObj.reason === 'invalid' && rObj.format === 'empty' && rObj.errors.length === 0,
   'object input rejected as invalid');

const rArr = parseZaaFile(['FEHL+101+1-1+Test']);
ok(rArr.valid === false && rArr.reason === 'invalid' && rArr.format === 'empty' && rArr.errors.length === 0,
   'array input rejected as invalid');

const rNum = parseZaaFile(12345);
ok(rNum.valid === false && rNum.reason === 'invalid' && rNum.format === 'empty' && rNum.errors.length === 0,
   'number input rejected as invalid');

// 6. Zero recognized errors in EDIFACT envelope (no authentic DAS acceptance inferred, no fallback)
const ediNoErrors = "UNB+UNOC:3+TESTABS+TESTREC+250519:1200+1'UNH+1+SLLA:21:0:0'UNT+2+1'UNZ+1+1'";
const rNoErr = parseZaaFile(ediNoErrors);
ok(rNoErr.valid === false && rNoErr.reason === 'unknown' && rNoErr.format === 'empty' && rNoErr.errors.length === 0,
   'EDIFACT with zero recognized errors rejected as unknown (no success receipt inferred)');

const ediEnvelopePlainLike = [
  "UNB+UNOC:3+TESTABS+TESTREC+250519:1200+1'",
  "UNH+1+SLLA:21:0:0'",
  "INV+A1234567890123:1+0+0001234'",
  "UNT+3+1'",
  "UNZ+1+1'",
  "0001234\t101\tThis plain line after envelope must not be parsed",
].join('\n');
const rEdiNoFallback = parseZaaFile(ediEnvelopePlainLike);
// Text hinter dem UNZ-Terminator macht die Datei strukturell ungueltig ('invalid');
// entscheidend ist: abgelehnt, keine Zeile aus dem Plaintext-Anhang uebernommen.
ok(rEdiNoFallback.valid === false && rEdiNoFallback.reason === 'invalid' && rEdiNoFallback.format === 'empty' && rEdiNoFallback.errors.length === 0,
   'EDIFACT envelope followed by plain-like line is rejected as invalid, no fallback rows');
const rEdiPlainBefore = parseZaaFile(ediEnvelopePlainLike.split('\n').slice(0, 5).join('\n'));
ok(rEdiPlainBefore.valid === false && rEdiPlainBefore.reason === 'unknown' && rEdiPlainBefore.errors.length === 0,
   'clean EDIFACT envelope without errors stays unknown (no plain fallback, no acceptance)');

// 7. FEHL missing code & malformed segments
const rMissingCode = parseZaaFile("UNB+x'FEHL++0001234+Positionsnummer unbekannt'");
ok(rMissingCode.valid === false && rMissingCode.reason === 'invalid' && rMissingCode.format === 'empty' && rMissingCode.errors.length === 0,
   'FEHL with missing code rejected as invalid');

const rFehlPlusOnly = parseZaaFile("UNB+x'FEHL+'");
ok(rFehlPlusOnly.valid === false && rFehlPlusOnly.reason === 'invalid' && rFehlPlusOnly.format === 'empty' && rFehlPlusOnly.errors.length === 0,
   'FEHL+ with missing code rejected as invalid');

// 8. Mixed valid and malformed rows (must fail closed, not discard malformed)
const rMixed = parseZaaFile([
  "UNB+x'",
  "FEHL+101+0001234+Positionsnummer 99999 unbekannt'",
  "FEHL++0001235+Fehlender Fehlercode'",
  "UNZ+1+1'",
].join(''));
ok(rMixed.valid === false && rMixed.reason === 'invalid' && rMixed.format === 'empty' && rMixed.errors.length === 0,
   'mixed valid and malformed FEHL rejected as invalid (does not discard malformed row)');

// 9. FEHL / FEH / ERR variants supported
const rErrVariant = parseZaaFile("UNB+x'INV+A:1+0+0001234'ERR+101+Positionsnummer unbekannt'UNZ+1+1'");
ok(rErrVariant.valid === true && rErrVariant.reason === null && rErrVariant.format === 'edifact',
   'ERR segment variant supported and valid');
ok(rErrVariant.errors.length === 1 && rErrVariant.errors[0].code === '101' && rErrVariant.errors[0].belegnummer === '0001234',
   'ERR inherits currentBeleg from INV');

const rFehVariant = parseZaaFile("UNB+x'FEH+15+0001235+KVNR fehlt'UNZ+1+1'");
ok(rFehVariant.valid === true && rFehVariant.reason === null && rFehVariant.format === 'edifact' && rFehVariant.errors.length === 1,
   'FEH segment variant supported and valid');

// 10. Truncated error segments & minimum structural field truncation
const rTruncFehl = parseZaaFile("UNB+x'FEHL'");
ok(rTruncFehl.valid === false && rTruncFehl.reason === 'invalid' && rTruncFehl.format === 'empty' && rTruncFehl.errors.length === 0,
   'truncated FEHL segment rejected as invalid');

const rBareFehl = parseZaaFile("FEHL");
ok(rBareFehl.valid === false && rBareFehl.reason === 'invalid' && rBareFehl.format === 'empty' && rBareFehl.errors.length === 0,
   'bare FEHL rejected as invalid');

const rTruncErr = parseZaaFile("UNB+x'ERR'");
ok(rTruncErr.valid === false && rTruncErr.reason === 'invalid' && rTruncErr.format === 'empty' && rTruncErr.errors.length === 0,
   'truncated ERR segment rejected as invalid');

const rFehlNoBelegSlot = parseZaaFile("UNB+x'FEHL+101'UNZ+1+1'");
ok(rFehlNoBelegSlot.valid === false && rFehlNoBelegSlot.reason === 'invalid' && rFehlNoBelegSlot.format === 'empty',
   'FEHL without explicit beleg slot (fields.length < 3) rejected as invalid');

const rErrNoTextSlot = parseZaaFile("UNB+x'ERR+101'UNZ+1+1'");
ok(rErrNoTextSlot.valid === false && rErrNoTextSlot.reason === 'invalid' && rErrNoTextSlot.format === 'empty',
   'ERR without explicit text slot (fields.length < 3) rejected as invalid');

// 11. Escape-aware terminal apostrophe, trailing ?', parity ??', and fused segments
const rUnterminated = parseZaaFile("UNB+x'INV+A:1+0+0001234'FEHL+101+0001234+Unterminated FEHL");
ok(rUnterminated.valid === false && rUnterminated.reason === 'invalid' && rUnterminated.format === 'empty',
   'unterminated FEHL missing terminal apostrophe rejected as invalid');

const rEscapedTerminal = parseZaaFile("UNB+x'FEHL+101+0001234+Text?'");
ok(rEscapedTerminal.valid === false && rEscapedTerminal.reason === 'invalid' && rEscapedTerminal.format === 'empty',
   'trailing ?\' is an escaped character, not a terminator; rejected as invalid');

const rParityTerminal = parseZaaFile("UNB+x'FEHL+101+0001234+Text??'");
ok(rParityTerminal.valid === true && rParityTerminal.reason === null && rParityTerminal.format === 'edifact',
   'trailing ??\' has even escape parity (escaped question mark), terminal apostrophe valid');
ok(rParityTerminal.errors.length === 1 && rParityTerminal.errors[0].code === '101',
   'parity ??\' extracts error correctly');

const rFused = parseZaaFile([
  "UNB+x'",
  "FEHL+101+0001234+Text without apostrophe",
  "FEHL+102+0001235+Second error'",
  "UNZ+1+1'",
].join('\n'));
ok(rFused.valid === false && rFused.reason === 'invalid' && rFused.format === 'empty' && rFused.errors.length === 0,
   'fused FEHL segments due to missing terminator between lines fails whole as invalid');

// 12. Numeric syntax (1-3 digits) vs garbage codes
const rGarbageCode = parseZaaFile("UNB+x'FEHL+ABC+0001234+Nonnumeric code'UNZ+1+1'");
ok(rGarbageCode.valid === false && rGarbageCode.reason === 'invalid' && rGarbageCode.format === 'empty',
   'non-numeric code ABC rejected as invalid');

const rFourDigitEdi = parseZaaFile("UNB+x'FEHL+1001+0001234+Four digit code'UNZ+1+1'");
ok(rFourDigitEdi.valid === false && rFourDigitEdi.reason === 'invalid' && rFourDigitEdi.format === 'empty',
   '4-digit code 1001 in EDIFACT rejected as invalid');

const rUnknownCode = parseZaaFile("UNB+x'FEHL+999+0001234+Unbekannter Kassencode'UNZ+1+1'");
ok(rUnknownCode.valid === true && rUnknownCode.reason === null && rUnknownCode.format === 'edifact',
   'unknown numeric dictionary code 999 remains valid');
ok(rUnknownCode.errors.length === 1 && rUnknownCode.errors[0].code === '999',
   'unknown code row extracted');
ok(rUnknownCode.errors[0].uebersetzung === null && rUnknownCode.errors[0].text === 'Unbekannter Kassencode',
   'unknown code preserves raw text without translation');

// 13. Plain malformed heuristic: ordinary headings vs corrupted rows
const plainMixedWithHeadings = [
  "Bericht ZAA — Davaso",
  "Fehlerbericht Q2",
  "Code Beleg Text",
  "0001234\t101\tPositionsnummer unbekannt",
  "0001235\t1001\tCorrupted four digit code",
].join('\n');
const rPlainCorrupted = parseZaaFile(plainMixedWithHeadings);
ok(rPlainCorrupted.valid === false && rPlainCorrupted.reason === 'invalid' && rPlainCorrupted.format === 'empty',
   'plain file with ordinary headings and corrupted 4-digit row fails closed as invalid');

const plainHeadingsOnlyValid = [
  "Bericht ZAA — Davaso",
  "Fehlerbericht Q2",
  "Code Beleg Text",
  "0001234\t101\tPositionsnummer unbekannt",
  "Code: 401  Beleg: 0001236  Genehmigung erforderlich",
].join('\n');
const rPlainHeadingsValid = parseZaaFile(plainHeadingsOnlyValid);
ok(rPlainHeadingsValid.valid === true && rPlainHeadingsValid.reason === null && rPlainHeadingsValid.format === 'plain',
   'ordinary headings (Bericht ZAA, Fehlerbericht, Code Beleg Text) do not trigger false positive rejection');
ok(rPlainHeadingsValid.errors.length === 2, 'valid rows extracted alongside ordinary headings');

const plainMissingTextRow = [
  "Bericht ZAA",
  "0001234\t101",
].join('\n');
const rPlainMissingText = parseZaaFile(plainMissingTextRow);
ok(rPlainMissingText.valid === false && rPlainMissingText.reason === 'invalid',
   'plain structured row with missing text fails closed as invalid');

// 14. Validity metadata verification on existing valid suites
ok(r1.valid === true && r1.reason === null, 'r1 valid metadata');
ok(r1b.valid === true && r1b.reason === null, 'r1b valid metadata');
ok(r2.valid === true && r2.reason === null, 'r2 valid metadata');
ok(r2b.valid === true && r2b.reason === null, 'r2b valid metadata');
ok(r2c.valid === true && r2c.reason === null, 'r2c valid metadata');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
