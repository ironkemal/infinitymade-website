import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNameErrors, filterGegenBaseline, fuehreTscAus } from './check-tanimsiz.mjs';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

test('parseNameErrors: erkennt TS2304 und TS2552 Fehler korrekt', () => {
  const tscOut = `
dashboard.js(13676,12): error TS2304: Cannot find name 'g'.
module/mein-modul.js(42,5): error TS2552: Cannot find name 'alteFn'. Did you mean 'neueFn'?
module/anderes.js(10,2): error TS7006: Parameter 'x' implicitly has an 'any' type.
`;
  const fehler = parseNameErrors(tscOut);
  assert.equal(fehler.length, 2);
  assert.equal(fehler[0].datei, 'dashboard.js');
  assert.equal(fehler[0].code, 'TS2304');
  assert.equal(fehler[0].meldung, "Cannot find name 'g'.");
  assert.equal(fehler[1].datei, 'module/mein-modul.js');
  assert.equal(fehler[1].code, 'TS2552');
});

test('filterGegenBaseline: ignoriert Fehler, die in der Baseline stehen', () => {
  const fehler = [
    { schluessel: "dashboard.js:Cannot find name 'Cropper'.", meldung: "Cannot find name 'Cropper'." },
    { schluessel: "dashboard.js:Cannot find name 'g'.", meldung: "Cannot find name 'g'." },
  ];
  const baseline = new Set(["dashboard.js:Cannot find name 'Cropper'."]);
  const gefiltert = filterGegenBaseline(fehler, baseline);
  assert.equal(gefiltert.length, 1);
  assert.equal(gefiltert[0].meldung, "Cannot find name 'g'.");
});

test('fuehreTscAus: findet undeklarierte Variable in Testdatei', () => {
  // Eigenes Temp-Verzeichnis außerhalb module/, damit parallele Repository-Scans
  // (z. B. onprem-setup-kapi.test.js) keine transiente Datei treffen (R-21).
  const tempDir = mkdtempSync(join(tmpdir(), 'praxura-tanimsiz-'));
  const tempOrdnerName = basename(tempDir);
  const testDatei = join(tempDir, 'temp-test-tanimsiz.js');
  try {
    writeFileSync(testDatei, 'export function foo() { const x = unbestimmterName123 + 1; return x; }\n', 'utf8');
    const out = fuehreTscAus([testDatei]);
    // tsc gibt Pfade außerhalb des Arbeitsverzeichnisses relativ (z. B. ../../../var/...) aus.
    const fehler = parseNameErrors(out, (/** @type {string} */ f) => f.endsWith(`${tempOrdnerName}/temp-test-tanimsiz.js`));
    assert.ok(fehler.length > 0);
    assert.ok(fehler.some(f => f.meldung.includes('unbestimmterName123')));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
