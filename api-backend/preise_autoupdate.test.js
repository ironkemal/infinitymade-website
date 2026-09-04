// Standalone smoke test for preise_autoupdate.
//   node api-backend/preise_autoupdate.test.js
//
// Arbeitet auf TEMPORÄREN Kopien von podologie_positions.js (os.tmpdir) — fasst
// niemals die echte Datei an. Deckt genau die Fälle ab, die den Unterschied
// zwischen "sicher automatisierbar" und "braucht einen Menschen" ausmachen
// (siehe Kopfkommentar in preise_autoupdate.mjs). `versucheBereich` ist async,
// deshalb wird hier mit Top-Level-await VOR den test()-Aufrufen aufgelöst —
// der test()-Helfer selbst bleibt synchron, wie im Rest des Repos üblich.

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { versucheBereich, BEREICHE } from './preise_autoupdate.mjs';
import { PODOLOGIE_PREISFENSTER } from './billing/codes/podologie_positions.js';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}

console.log('preise_autoupdate');

function tempKopie() {
  const dir = mkdtempSync(join(tmpdir(), 'praxura-preise-test-'));
  const ziel = join(dir, 'podologie_positions.js');
  writeFileSync(ziel, readFileSync(BEREICHE.podologie.datei, 'utf8'), 'utf8');
  return { dir, ziel };
}

const aktuellesFenster = PODOLOGIE_PREISFENSTER.find(f => f.gueltig_bis === '9999-12-31');
const alleCodes = aktuellesFenster.positionen.map(p => p.hpnr);

// ── Fall 1: sicher — exakt dieselbe Code-Menge, ein neues Datum ─────────────
{
  const { dir, ziel } = tempKopie();
  const neuePreisrunde = aktuellesFenster.positionen.map(p => ({
    code: p.hpnr, xmlPreis: Math.round(p.preis * 1.05 * 100) / 100, xmlGueltigAb: '2099-07-01',
  }));
  const ergebnis = await versucheBereich('hpnr', ziel, neuePreisrunde, aktuellesFenster, false);
  const geschrieben = readFileSync(ziel, 'utf8');
  rmSync(dir, { recursive: true, force: true });

  test('sicherer Fall: liefert ok:true und schreibt die erwartete Positionsanzahl', () => {
    assert.equal(ergebnis.ok, true, 'sollte ok:true liefern — ' + ergebnis.grund);
    assert.equal(ergebnis.anzahl, alleCodes.length);
  });
  test('sicherer Fall: altes Fenster wird auf den Vortag geschlossen', () => {
    assert.ok(geschrieben.includes(`gueltig_ab: '${aktuellesFenster.gueltig_ab}', gueltig_bis: '2099-06-30'`));
  });
  test('sicherer Fall: neues Fenster ist offen (9999-12-31)', () => {
    assert.ok(geschrieben.includes(`gueltig_ab: '2099-07-01', gueltig_bis: '9999-12-31', positionen:`));
  });
  test('sicherer Fall: zuzahlungsfreie Position bleibt zuzahlungsfrei', () => {
    const zuzahlungsfrei = aktuellesFenster.positionen.find(p => p.zuzahlung === null);
    assert.ok(zuzahlungsfrei, 'Testvoraussetzung: mind. eine zuzahlungsfreie Position muss existieren');
    const idx = geschrieben.lastIndexOf(`hpnr: '${zuzahlungsfrei.hpnr}'`);
    assert.ok(geschrieben.slice(idx, idx + 200).includes('zuzahlung: null'));
  });
  test('sicherer Fall: geschriebene Datei bleibt syntaktisch gültiges JS', () => {
    // new Function statt eval — reiner Parse-Check, kein Ausführen von Modul-Semantik nötig
    assert.doesNotThrow(() => new Function(geschrieben.replace(/^export /gm, '')));
  });
}

// ── Fall 2: unsicher — ein Code fehlt in der XML ─────────────────────────────
{
  const { dir, ziel } = tempKopie();
  const vorher = readFileSync(ziel, 'utf8');
  const ohneEinen = aktuellesFenster.positionen
    .filter(p => p.hpnr !== alleCodes[0])
    .map(p => ({ code: p.hpnr, xmlPreis: p.preis + 1, xmlGueltigAb: '2099-07-01' }));
  const ergebnis = await versucheBereich('hpnr', ziel, ohneEinen, aktuellesFenster, false);
  const nachher = readFileSync(ziel, 'utf8');
  rmSync(dir, { recursive: true, force: true });

  test('unsicherer Fall (fehlender Code): ok:false, Grund nennt den Code', () => {
    assert.equal(ergebnis.ok, false);
    assert.ok(ergebnis.grund.includes(alleCodes[0]));
  });
  test('unsicherer Fall (fehlender Code): Datei bleibt unverändert', () => {
    assert.equal(nachher, vorher);
  });
}

// ── Fall 3: unsicher — uneinheitliche Startdaten in der XML ─────────────────
{
  const { dir, ziel } = tempKopie();
  const vorher = readFileSync(ziel, 'utf8');
  const gemischt = aktuellesFenster.positionen.map((p, i) => ({
    code: p.hpnr, xmlPreis: p.preis + 1, xmlGueltigAb: i === 0 ? '2099-01-01' : '2099-07-01',
  }));
  const ergebnis = await versucheBereich('hpnr', ziel, gemischt, aktuellesFenster, false);
  const nachher = readFileSync(ziel, 'utf8');
  rmSync(dir, { recursive: true, force: true });

  test('unsicherer Fall (uneinheitliche Startdaten): ok:false', () => {
    assert.equal(ergebnis.ok, false);
    assert.ok(ergebnis.grund.includes('uneinheitliche'));
  });
  test('unsicherer Fall (uneinheitliche Startdaten): Datei bleibt unverändert', () => {
    assert.equal(nachher, vorher);
  });
}

// ── Fall 4: --dry-run meldet ok:true, schreibt aber nichts ──────────────────
{
  const { dir, ziel } = tempKopie();
  const vorher = readFileSync(ziel, 'utf8');
  const neuePreisrunde = aktuellesFenster.positionen.map(p => ({
    code: p.hpnr, xmlPreis: p.preis + 1, xmlGueltigAb: '2099-07-01',
  }));
  const ergebnis = await versucheBereich('hpnr', ziel, neuePreisrunde, aktuellesFenster, true);
  const nachher = readFileSync(ziel, 'utf8');
  rmSync(dir, { recursive: true, force: true });

  test('dry-run: ok:true, aber geschrieben:false', () => {
    assert.equal(ergebnis.ok, true);
    assert.equal(ergebnis.geschrieben, false);
  });
  test('dry-run: Datei bleibt unverändert', () => {
    assert.equal(nachher, vorher);
  });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
