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
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { versucheBereich, fuehreAus, BEREICHE } from './preise_autoupdate.mjs';
import { PODOLOGIE_PREISFENSTER } from './billing/codes/podologie_positions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let pass = 0, fail = 0;
/**
 * @param {string} name
 * @param {() => void} fn
 */
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + (e instanceof Error ? e.message : String(e))); fail++; }
}

console.log('preise_autoupdate');

function tempKopie() {
  const dir = mkdtempSync(join(tmpdir(), 'praxura-preise-test-'));
  const ziel = join(dir, 'podologie_positions.js');
  writeFileSync(ziel, readFileSync(BEREICHE.podologie.datei, 'utf8'), 'utf8');
  return { dir, ziel };
}

const aktuellesFenster = /** @type {{ gueltig_ab: string, gueltig_bis: string, positionen: ReadonlyArray<Record<string, any>> }} */ (
  PODOLOGIE_PREISFENSTER.find(f => f.gueltig_bis === '9999-12-31')
);
const alleCodes = aktuellesFenster.positionen.map(p => String(p.hpnr));

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
    assert.equal(ergebnis.ok, true, 'sollte ok:true liefern — ' + (/** @type {any} */ (ergebnis)).grund);
    assert.equal((/** @type {any} */ (ergebnis)).anzahl, alleCodes.length);
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
        code: c, xmlPreis: (/** @type {Record<string, any>} */ (aktuellesFenster.positionen.find(p => p.hpnr === c))).preis, xmlGueltigAb: '2099-07-01',
      }))),
    aktuellesFenster, false);
  const geschrieben = readFileSync(ziel, 'utf8');
  rmSync(dir, { recursive: true, force: true });

  test('Rundungs-Grenzfall 50,55 € → Zuzahlung 5,06 € (nicht 5,05 €)', () => {
    assert.equal(ergebnis.ok, true, 'sollte ok:true liefern — ' + (/** @type {any} */ (ergebnis)).grund);
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
    assert.ok((/** @type {any} */ (ergebnis)).grund.includes(alleCodes[0]));
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
    assert.ok((/** @type {any} */ (ergebnis)).grund.includes('uneinheitliche'));
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
    assert.equal((/** @type {any} */ (ergebnis)).geschrieben, false);
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
    assert.ok((/** @type {any} */ (ergebnis)).grund.includes('Preissprung'), `Grund sollte "Preissprung" nennen: ${(/** @type {any} */ (ergebnis)).grund}`);
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
    assert.ok((/** @type {any} */ (ergebnis)).grund.includes('Datumsformat'), `Grund sollte "Datumsformat" nennen: ${(/** @type {any} */ (ergebnis)).grund}`);
  });
  test('unsicherer Fall (kaputtes Datumsformat): Datei bleibt unverändert', () => {
    assert.equal(nachher, vorher);
  });
}

// ── Fall 7: Import-Schutz ──────────────────────────────────────────────────
// main() darf nur ausgeführt werden, wenn die Datei direkt per CLI gestartet wird.
// Beim Importieren darf kein stdout erzeugt und kein main() angestoßen werden.
{
  let sawJsonMarker = false;
  const origLog = console.log;
  console.log = (...args) => {
    if (args.some(a => typeof a === 'string' && a.includes('---JSON---'))) {
      sawJsonMarker = true;
    }
  };
  try {
    await import(`./preise_autoupdate.mjs?import_guard_test=${Date.now()}`);
  } finally {
    console.log = origLog;
  }
  test('import edince main çalışmıyor (---JSON--- yazılmıyor)', () => {
    assert.equal(sawJsonMarker, false, 'Import esnasında main() çalışıp stdout çıktısı vermemeli');
  });
}

// ── Fall 8: fuehreAus Kernfunktion mit bestehendem Test-Fixture ────────────
{
  const { dir, ziel } = tempKopie();
  const origDatei = BEREICHE.podologie.datei;
  BEREICHE.podologie.datei = ziel;

  const xmlEntries = aktuellesFenster.positionen.map(p => {
    const neuPreis = Math.round(p.preis * 1.05 * 100) / 100;
    return `<HMP><HMP4>X${String(p.hpnr).slice(1)}</HMP4><Heilmittelbereich>Podologie</Heilmittelbereich><Hoechstpreis>${neuPreis}</Hoechstpreis><Gueltig_ab>2099-07-01</Gueltig_ab><Bezeichnung>${p.label || 'Test'}</Bezeichnung></HMP>`;
  });
  const xml = xmlEntries.join('\n');

  let bericht;
  try {
    bericht = await fuehreAus({ xml, stand: '01-01-99', dryRun: false });
  } finally {
    BEREICHE.podologie.datei = origDatei;
    rmSync(dir, { recursive: true, force: true });
  }

  test('fuehreAus mevcut test fixture ile aynı sonucu veriyor', () => {
    assert.equal(bericht.changed.length, 1);
    assert.equal(bericht.changed[0].bereich, 'podologie');
    assert.equal(bericht.changed[0].gueltig_ab, '2099-07-01');
    assert.equal(bericht.changed[0].anzahl, alleCodes.length);
    assert.equal(bericht.changed[0].geschrieben, true);
    assert.equal(bericht.needsReview.length, 0);
    assert.deepEqual(bericht.erlaubteSpruenge, []);
  });
}

// ── Fall 9: Abdeckung aller `art`-Werte ─────────────────────────────────────
// 9.1: art: 'abweichend' (Preisabweichung bei bereits bekanntem Fenster)
{
  const xml = `<HMP><HMP4>X8010</HMP4><Heilmittelbereich>Podologie</Heilmittelbereich><Hoechstpreis>999.00</Hoechstpreis><Gueltig_ab>${aktuellesFenster.gueltig_ab}</Gueltig_ab><Bezeichnung>Test</Bezeichnung></HMP>`;
  const bericht = await fuehreAus({ xml, dryRun: true });
  test('art: abweichend (bilinen fenstere uymayan fiyat)', () => {
    assert.equal(bericht.changed.length, 0);
    const abw = bericht.needsReview.find(r => r.art === 'abweichend');
    assert.ok(abw, 'needsReview abweichend girdisi içermeli');
    assert.ok(abw.grund.includes('Preisabweichung'));
  });
}

// 9.2: art: 'sprung' + sprungCodes ({ code, altPreis, neuPreis, prozent })
{
  const { dir, ziel } = tempKopie();
  const vorher = readFileSync(ziel, 'utf8');
  const neuePreisrunde = aktuellesFenster.positionen.map(p => ({
    code: p.hpnr,
    xmlPreis: p.hpnr === '78010' ? Math.round(p.preis * 1.30 * 100) / 100 : p.preis,
    xmlGueltigAb: '2099-07-01',
  }));
  const res = await versucheBereich('hpnr', ziel, neuePreisrunde, aktuellesFenster, false, new Set());
  const nachher = readFileSync(ziel, 'utf8');
  rmSync(dir, { recursive: true, force: true });

  test('art: sprung (versucheBereich: art, grund, sprungCodes)', () => {
    assert.equal(res.ok, false);
    assert.equal(res.art, 'sprung');
    assert.ok(Array.isArray(res.sprungCodes) && res.sprungCodes.length === 1);
    const sp = res.sprungCodes[0];
    assert.equal(sp.code, '78010');
    assert.ok(typeof sp.altPreis === 'number');
    assert.ok(typeof sp.neuPreis === 'number');
    assert.equal(sp.prozent, 30);
    assert.equal(nachher, vorher);
  });
}

// 9.3: fuehreAus art: 'sprung' trägt sprungCodes in details und im review-Item
{
  const { dir, ziel } = tempKopie();
  const origDatei = BEREICHE.podologie.datei;
  BEREICHE.podologie.datei = ziel;

  const xmlEntries = aktuellesFenster.positionen.map(p => {
    const neuPreis = p.hpnr === '78010' ? Math.round(p.preis * 1.30 * 100) / 100 : p.preis;
    return `<HMP><HMP4>X${String(p.hpnr).slice(1)}</HMP4><Heilmittelbereich>Podologie</Heilmittelbereich><Hoechstpreis>${neuPreis}</Hoechstpreis><Gueltig_ab>2099-07-01</Gueltig_ab><Bezeichnung>${p.label || 'Test'}</Bezeichnung></HMP>`;
  });
  let bericht;
  try {
    bericht = await fuehreAus({ xml: xmlEntries.join('\n'), dryRun: false });
  } finally {
    BEREICHE.podologie.datei = origDatei;
    rmSync(dir, { recursive: true, force: true });
  }

  test('art: sprung (fuehreAus: details.sprungCodes ve sprungCodes alanı)', () => {
    assert.equal(bericht.changed.length, 0);
    const sprung = bericht.needsReview.find(r => r.art === 'sprung');
    assert.ok(sprung, 'needsReview sprung girdisi içermeli');
    assert.ok(Array.isArray(sprung.sprungCodes));
    assert.equal(sprung.sprungCodes[0].code, '78010');
    assert.ok(sprung.details && Array.isArray(sprung.details.sprungCodes));
    assert.equal(sprung.details.sprungCodes[0].code, '78010');
  });
}

// 9.4: art: 'neue_codes' (neue Codes in XML)
{
  const { dir, ziel } = tempKopie();
  const mitNeuemCode = aktuellesFenster.positionen.map(p => ({
    code: p.hpnr, xmlPreis: p.preis, xmlGueltigAb: '2099-07-01',
  })).concat([{ code: '79999', xmlPreis: 50.0, xmlGueltigAb: '2099-07-01' }]);

  const res = await versucheBereich('hpnr', ziel, mitNeuemCode, aktuellesFenster, false);
  rmSync(dir, { recursive: true, force: true });

  test('art: neue_codes (XML yeni kod içeriyor)', () => {
    assert.equal(res.ok, false);
    assert.equal(res.art, 'neue_codes');
    assert.ok(res.grund.includes('nur in XML'));
  });
}

// 9.5: art: 'fehlende_codes' (unsere Codes fehlen in XML)
{
  const { dir, ziel } = tempKopie();
  const ohneEinen = aktuellesFenster.positionen
    .filter(p => p.hpnr !== alleCodes[0])
    .map(p => ({ code: p.hpnr, xmlPreis: p.preis, xmlGueltigAb: '2099-07-01' }));

  const res = await versucheBereich('hpnr', ziel, ohneEinen, aktuellesFenster, false);
  rmSync(dir, { recursive: true, force: true });

  test('art: fehlende_codes (XML eksik kod içeriyor)', () => {
    assert.equal(res.ok, false);
    assert.equal(res.art, 'fehlende_codes');
    assert.ok(res.grund.includes('fehlt in XML'));
  });
}

// 9.6: art: 'startdaten' (uneinheitliche Startdaten in XML)
{
  const { dir, ziel } = tempKopie();
  const gemischt = aktuellesFenster.positionen.map((p, i) => ({
    code: p.hpnr, xmlPreis: p.preis, xmlGueltigAb: i === 0 ? '2099-01-01' : '2099-07-01',
  }));
  const res = await versucheBereich('hpnr', ziel, gemischt, aktuellesFenster, false);
  rmSync(dir, { recursive: true, force: true });

  test('art: startdaten (uyuşmayan başlangıç tarihleri)', () => {
    assert.equal(res.ok, false);
    assert.equal(res.art, 'startdaten');
    assert.ok(res.grund.includes('uneinheitliche neue Startdaten'));
  });
}

// 9.7: art: 'datum' (kaputtes Datumsformat)
{
  const { dir, ziel } = tempKopie();
  const kaputt = aktuellesFenster.positionen.map(p => ({
    code: p.hpnr, xmlPreis: p.preis, xmlGueltigAb: '2099/07/01',
  }));
  const res = await versucheBereich('hpnr', ziel, kaputt, aktuellesFenster, false);
  rmSync(dir, { recursive: true, force: true });

  test('art: datum (bozuk tarih biçimi)', () => {
    assert.equal(res.ok, false);
    assert.equal(res.art, 'datum');
    assert.ok(res.grund.includes('kein gültiges Datumsformat'));
  });
}

// 9.8: art: 'fenster' (offene Fenster !== 1)
{
  const { dir, ziel } = tempKopie();
  let content = readFileSync(ziel, 'utf8');
  content = content.replace(
    `gueltig_bis: '2026-06-30', positionen: PODOLOGIE_POSITIONS_2025`,
    `gueltig_bis: '9999-12-31', positionen: PODOLOGIE_POSITIONS_2025`
  );
  writeFileSync(ziel, content, 'utf8');

  const customBereiche = {
    podologie: {
      datei: ziel,
      codeFeld: 'hpnr',
      importName: 'PODOLOGIE_PREISFENSTER',
      autoWrite: true,
    },
  };
  const xmlEntries = aktuellesFenster.positionen.map(p =>
    `<HMP><HMP4>X${String(p.hpnr).slice(1)}</HMP4><Heilmittelbereich>Podologie</Heilmittelbereich><Hoechstpreis>${p.preis + 1}</Hoechstpreis><Gueltig_ab>2099-07-01</Gueltig_ab><Bezeichnung>T</Bezeichnung></HMP>`
  );

  const bericht = await fuehreAus({ xml: xmlEntries.join('\n'), dryRun: true, bereiche: customBereiche });
  rmSync(dir, { recursive: true, force: true });

  test('art: fenster (açık fenster ≠ 1)', () => {
    const fensterItem = bericht.needsReview.find(r => r.art === 'fenster');
    assert.ok(fensterItem, 'needsReview fenster girdisi içermeli');
    assert.ok(fensterItem.grund.includes('offene Fenster statt genau 1'));
  });
}

// 9.9: art: 'bereich' (unbekannter Bereich oder autoWrite: false)
{
  const customBereiche = {
    podologie: {
      datei: BEREICHE.podologie.datei,
      codeFeld: 'hpnr',
      importName: 'PODOLOGIE_PREISFENSTER',
      autoWrite: false,
    },
  };
  const xmlEntries = aktuellesFenster.positionen.map(p =>
    `<HMP><HMP4>X${String(p.hpnr).slice(1)}</HMP4><Heilmittelbereich>Podologie</Heilmittelbereich><Hoechstpreis>${p.preis + 1}</Hoechstpreis><Gueltig_ab>2099-07-01</Gueltig_ab><Bezeichnung>T</Bezeichnung></HMP>`
  );
  const bericht = await fuehreAus({ xml: xmlEntries.join('\n'), dryRun: true, bereiche: customBereiche });

  test('art: bereich (autoWrite kapalı)', () => {
    const bereichItem = bericht.needsReview.find(r => r.art === 'bereich');
    assert.ok(bereichItem, 'needsReview bereich girdisi içermeli');
    assert.ok(bereichItem.grund.includes('Auto-Write für diesen Bereich deaktiviert'));
  });
}

// 9.10: art: 'fehler' (ungültiger Code in erlaubeSprung / Skriptfehler)
{
  const res = await fuehreAus({ xml: '', erlaubeSprung: new Set(['UNGUELTIG!']) });
  test('art: fehler (geçersiz erlaubeSprung kodu)', () => {
    assert.equal(res.needsReview.length, 1);
    assert.equal(res.needsReview[0].art, 'fehler');
    assert.ok(res.needsReview[0].grund.includes('Ungültiger Code in erlaubeSprung'));
  });
}

// ── Fall 10: Preissprung mit erlaubeSprung (leer, partiell, voll) ────────────
{
  const { dir, ziel } = tempKopie();
  const vorher = readFileSync(ziel, 'utf8');

  // 78010: +30%, 78020: +25%, restliche Codes: +5%
  const neuePreisrunde = aktuellesFenster.positionen.map(p => {
    const code = String(p.hpnr);
    let neuPreis = p.preis;
    if (code === '78010') neuPreis = Math.round(p.preis * 1.30 * 100) / 100;
    else if (code === '78020') neuPreis = Math.round(p.preis * 1.25 * 100) / 100;
    else neuPreis = Math.round(p.preis * 1.05 * 100) / 100;
    return { code, xmlPreis: neuPreis, xmlGueltigAb: '2099-07-01' };
  });

  // 1) erlaubeSprung leer: art:'sprung' + sprungCodes, keine Änderung
  const resLeer = await versucheBereich('hpnr', ziel, neuePreisrunde, aktuellesFenster, false, new Set());
  test('sprung: erlaubeSprung boş -> art:sprung + sprungCodes; dosya değişmez', () => {
    assert.equal(resLeer.ok, false);
    assert.equal(resLeer.art, 'sprung');
    assert.equal(resLeer.sprungCodes.length, 2);
    assert.equal(readFileSync(ziel, 'utf8'), vorher);
  });

  // 2) Nur ein Teil in erlaubeSprung (78010): weiterhin sprung (78020), keine Änderung
  const resTeil = await versucheBereich('hpnr', ziel, neuePreisrunde, aktuellesFenster, false, new Set(['78010']));
  test('sprung: yalnız bir kısmı listede -> yine sprung, dosya değişmez', () => {
    assert.equal(resTeil.ok, false);
    assert.equal(resTeil.art, 'sprung');
    assert.equal(resTeil.sprungCodes.length, 1);
    assert.equal(resTeil.sprungCodes[0].code, '78020');
    assert.equal(readFileSync(ziel, 'utf8'), vorher);
  });

  // 3) Alle gesprungenen Codes in erlaubeSprung (78010, 78020) + nicht-gesprungener Code (78030)
  //    -> geschrieben, erlaubteSpruenge enthält nur tatsächlich übersprungene Codes
  const resVoll = await versucheBereich('hpnr', ziel, neuePreisrunde, aktuellesFenster, false, new Set(['78010', '78020', '78030']));
  const nachher = readFileSync(ziel, 'utf8');
  rmSync(dir, { recursive: true, force: true });

  test('sprung: tüm sıçrayan kodlar listede -> yazılır (ok:true), erlaubteSpruenge dolu (yalnız sıçrayanlar)', () => {
    assert.equal(resVoll.ok, true);
    assert.equal(resVoll.geschrieben, true);
    assert.deepEqual(resVoll.erlaubteSpruenge, ['78010', '78020']);
    assert.notEqual(nachher, vorher);
  });
}

// ── Fall 11: erlaubeSprung überstimmt KEINE Code-Mengen-Abweichung ───────────
{
  const { dir, ziel } = tempKopie();
  const vorher = readFileSync(ziel, 'utf8');
  const mitNeuemCodeUndSprung = aktuellesFenster.positionen.map(p => ({
    code: p.hpnr,
    xmlPreis: p.hpnr === '78010' ? Math.round(p.preis * 1.30 * 100) / 100 : p.preis,
    xmlGueltigAb: '2099-07-01',
  })).concat([{ code: '79999', xmlPreis: 60.0, xmlGueltigAb: '2099-07-01' }]);

  const res = await versucheBereich('hpnr', ziel, mitNeuemCodeUndSprung, aktuellesFenster, false, new Set(['78010', '79999']));
  const nachher = readFileSync(ziel, 'utf8');
  rmSync(dir, { recursive: true, force: true });

  test('erlaubeSprung kod kümesi farkını AŞMAZ (yeni kod varken liste dolu -> yine neue_codes)', () => {
    assert.equal(res.ok, false);
    assert.equal(res.art, 'neue_codes');
    assert.equal(nachher, vorher);
  });
}

// ── Fall 12: Ungültiger CLI-Parameter --erlaube-sprung ───────────────────────
{
  const cliScript = join(__dirname, 'preise_autoupdate.mjs');
  const proc = spawnSync(process.execPath, [cliScript, '--erlaube-sprung=78010,INVALID_CODE_123'], { encoding: 'utf8' });
  test('geçersiz --erlaube-sprung değeri CLI -> exit 0 + JSON art:fehler', () => {
    assert.equal(proc.status, 0, 'CLI exit code 0 olmalı');
    const parts = proc.stdout.split('---JSON---');
    assert.ok(parts.length > 1, '---JSON--- çıktısı olmalı');
    const jsonStr = parts[1].trim().split('\n')[0];
    const parsed = JSON.parse(jsonStr);
    assert.equal(parsed.needsReview.length, 1);
    assert.equal(parsed.needsReview[0].art, 'fehler');
    assert.ok(parsed.needsReview[0].grund.includes('Ungültiger Code in --erlaube-sprung'));
  });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
