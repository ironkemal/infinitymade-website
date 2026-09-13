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

// Bis 13.09.2026 musste Physio hier manuell bleiben: heilmittel_tarif konnte
// den Katalogpreis übersteuern (928 unbefristete Zeilen, DB-Check 04.09.2026),
// ein automatisch geschriebenes Preisfenster hätte dort keine reale Wirkung
// gehabt. Der Override ist entfernt (O-96, gkv-302-Review — resolver.js Kopf
// trägt die Begründung: Anlage 2 §125 Physio kennt keine Bundesland-
// Dimension). Katalog ist jetzt für beide Bereiche die einzige Preisquelle.
test('Physio und Podologie sind beide automatisierbar (kein DB-Override mehr)', () => {
  assert.equal(BEREICHE.physiotherapie.autoWrite, true);
  assert.equal(BEREICHE.podologie.autoWrite, true);
});

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

// ── Regressionstest: kaufmännische Rundung, NICHT .toFixed(2) ───────────────
// fonksiyon-ustasi, 04.09.2026: `50.55 * 0.10` ist binär 5.054999999999999…,
// .toFixed(2) rundet das fälschlich zu 5.05 ab statt zu 5.06 auf. 78020 kostet
// heute exakt 50.55 € mit veröffentlichter Zuzahlung 5.06 € — genau der Fall,
// der beim ersten Auto-Update-Lauf 1 Cent zu wenig erzeugt hätte.
{
  const { dir, ziel } = tempKopie();
  const grenzfall = aktuellesFenster.positionen.find(p => p.hpnr === '78020');
  assert.ok(grenzfall, 'Testvoraussetzung: 78020 muss im aktuellen Fenster existieren');
  const ergebnis = await versucheBereich('hpnr', ziel, [{ code: '78020', xmlPreis: 50.55, xmlGueltigAb: '2099-07-01' }]
      .concat(alleCodes.filter(c => c !== '78020').map(c => ({
        code: c, xmlPreis: aktuellesFenster.positionen.find(p => p.hpnr === c).preis, xmlGueltigAb: '2099-07-01',
      }))),
    aktuellesFenster, false);
  const geschrieben = readFileSync(ziel, 'utf8');
  rmSync(dir, { recursive: true, force: true });

  test('Rundungs-Grenzfall 50,55 € → Zuzahlung 5,06 € (nicht 5,05 €)', () => {
    assert.equal(ergebnis.ok, true, 'sollte ok:true liefern — ' + ergebnis.grund);
    const idx = geschrieben.lastIndexOf(`hpnr: '78020'`);
    const zeile = geschrieben.slice(idx, idx + 200);
    assert.ok(zeile.includes('zuzahlung: 5.06'), `erwartet "zuzahlung: 5.06" in: ${zeile}`);
    assert.ok(!zeile.includes('zuzahlung: 5.05'), 'darf NICHT auf 5.05 abrunden');
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
    code: p.hpnr, xmlPreis: Math.round(p.preis * 1.05 * 100) / 100, xmlGueltigAb: '2099-07-01',
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

// ── Fall 5: unsicher — Preissprung >15% bei einem bekannten Code ───────────
// gkv-302-Review, O-99, 13.09.2026: Sicherheitsventil gegen ein kaputtes/
// manipuliertes XML oder eine echte Vertragsänderung, die kein einfaches
// Preisupdate mehr ist.
{
  const { dir, ziel } = tempKopie();
  const vorher = readFileSync(ziel, 'utf8');
  const neuePreisrunde = aktuellesFenster.positionen.map(p => ({
    code: p.hpnr, xmlPreis: Math.round(p.preis * 1.30 * 100) / 100, xmlGueltigAb: '2099-07-01',
  }));
  const ergebnis = await versucheBereich('hpnr', ziel, neuePreisrunde, aktuellesFenster, false);
  const nachher = readFileSync(ziel, 'utf8');
  rmSync(dir, { recursive: true, force: true });

  test('unsicherer Fall (Preissprung >15%): ok:false', () => {
    assert.equal(ergebnis.ok, false);
    assert.ok(ergebnis.grund.includes('Preissprung'), `Grund sollte "Preissprung" nennen: ${ergebnis.grund}`);
  });
  test('unsicherer Fall (Preissprung >15%): Datei bleibt unverändert', () => {
    assert.equal(nachher, vorher);
  });
}

// ── Fall 6: unsicher — kaputtes Datumsformat in der XML ─────────────────────
// guvenlik-Review, O-99, 13.09.2026: xmlGueltigAb landet ungeschützt in
// interpoliertem JS-Quellcode (formatWert() wird dafür nicht durchlaufen).
{
  const { dir, ziel } = tempKopie();
  const vorher = readFileSync(ziel, 'utf8');
  const neuePreisrunde = aktuellesFenster.positionen.map(p => ({
    code: p.hpnr, xmlPreis: p.preis, xmlGueltigAb: "2099-07-01'; process.exit(1); //",
  }));
  const ergebnis = await versucheBereich('hpnr', ziel, neuePreisrunde, aktuellesFenster, false);
  const nachher = readFileSync(ziel, 'utf8');
  rmSync(dir, { recursive: true, force: true });

  test('unsicherer Fall (kaputtes Datumsformat): ok:false', () => {
    assert.equal(ergebnis.ok, false);
    assert.ok(ergebnis.grund.includes('Datumsformat'), `Grund sollte "Datumsformat" nennen: ${ergebnis.grund}`);
  });
  test('unsicherer Fall (kaputtes Datumsformat): Datei bleibt unverändert', () => {
    assert.equal(nachher, vorher);
  });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
