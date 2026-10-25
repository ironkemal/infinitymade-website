#!/usr/bin/env node
/**
 * redesign-shots.mjs — Teststufe T4 des Redesigns (redesign/AUFTRAG.md, Abschnitt 6).
 *
 * Bilder aller Bereiche in der synthetischen Praxis (ohne Login, siehe
 * tools/redesign-harness.mjs) und Pixel-Vergleich zweier Läufe.
 *
 *   node tools/redesign-shots.mjs --lauf vorher
 *        [--design alt|neu|beide] [--theme hell|dunkel|beide] [--breite 1440,390]
 *        [--panels overview,kunden] [--szenario voll|leer] [--rolle owner]
 *   node tools/redesign-shots.mjs --vergleich vorher nachher [--toleranz 0]
 *        [--ueberschreiben]  vorhandene Bilder derselben Kombination ersetzen (sonst Abbruch)
 *        [--wurzel <ordner>]  anderen Code-Stand ausliefern (Alt-Referenz aus origin/main,
 *                             siehe tools/redesign-basis.mjs)
 *
 * Bilder landen in .redesign-shots/<lauf>/<rolle>-<szenario>/<design>-<theme>-<breite>/NN-<panel>.png
 * (gitignored). NN ist die Stelle des Panels in PANELS (nicht in --panels), damit Teil- und
 * Volläufe dieselben Namen tragen (Ursache von R-10). Teilläufe zeigen trotzdem einen anderen
 * Navigationszustand: für Abnahmen immer Volläufe vergleichen. Der Vergleich schreibt Diff-Bilder nach .redesign-shots/diff-<a>-<b>/ und
 * endet mit Exit 1, sobald ein Bildpaar mehr als --toleranz Anteil abweichender Pixel hat.
 * Gedacht für „alt vorher“ gegen „alt nachher“: ohne Schalter muss die App gleich bleiben.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { PANELS, WURZEL, oeffneDashboard, starteBrowser, starteServer, wechsle, fixtureLog, ruhe } from './redesign-harness.mjs';

const ZIEL = join(WURZEL, '.redesign-shots');
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const liste = (wert, alle) => (wert === 'beide' ? alle : String(wert).split(',').map((s) => s.trim()).filter(Boolean));

if (process.argv.includes('--vergleich')) await vergleiche();
else await aufnehmen();

async function aufnehmen() {
  const lauf = arg('lauf');
  if (!lauf || !/^[\w.-]+$/.test(lauf)) { console.error('--lauf <name> fehlt (Buchstaben, Ziffern, . _ -)'); process.exit(2); }
  const designs = liste(arg('design', 'alt'), ['alt', 'neu']);
  const themes = liste(arg('theme', 'beide'), ['hell', 'dunkel']);
  const breiten = liste(arg('breite', '1440,390'), []).map(Number);
  const panels = arg('panels') ? liste(arg('panels'), []) : PANELS;
  const unbekannt = panels.filter((p) => !PANELS.includes(p));
  if (unbekannt.length) { console.error(`unbekannte Panels: ${unbekannt.join(', ')}`); process.exit(2); }
  const ueberschreiben = process.argv.includes('--ueberschreiben');
  const rolle = arg('rolle', 'owner');
  const szenario = arg('szenario', 'voll');

  // Kein stilles Überschreiben: ein zweiter Lauf mit gleichem Namen hätte eine Referenz ersetzt.
  for (const design of designs) for (const theme of themes) for (const breite of breiten) {
    const ordner = join(ZIEL, lauf, `${rolle}-${szenario}`, `${design}-${theme}-${breite}`);
    const belegt = existsSync(ordner) && (await readdir(ordner)).some((d) => d.endsWith('.png'));
    if (belegt && !ueberschreiben) {
      console.error(`.redesign-shots/${relative(ZIEL, ordner)} enthält schon Bilder. Anderen --lauf wählen oder --ueberschreiben.`);
      process.exit(2);
    }
  }

  const server = await starteServer({ wurzel: arg('wurzel') ? resolve(arg('wurzel')) : undefined });
  const browser = await starteBrowser();
  const berichtPfad = join(ZIEL, lauf, `${rolle}-${szenario}`, 'bericht.json');
  const frueher = existsSync(berichtPfad) ? JSON.parse(await readFile(berichtPfad, 'utf8')) : null;
  const bericht = { lauf, zeit: new Date().toISOString(), rolle, szenario, bilder: [] };
  try {
    for (const design of designs) for (const theme of themes) for (const breite of breiten) {
      const ordner = join(ZIEL, lauf, `${rolle}-${szenario}`, `${design}-${theme}-${breite}`);
      await mkdir(ordner, { recursive: true });
      const { kontext, page, protokoll } = await oeffneDashboard(browser, { basis: server.basis, breite, theme, design, rolle, szenario });
      await ruhe(page, 1500); // Einrichtungs-Ring u. ä. erscheinen verzögert
      for (const panel of panels) {
        const vorher = { k: protokoll.konsole.length, s: protokoll.seitenfehler.length };
        const aktiv = await wechsle(page, panel);
        const datei = join(ordner, `${String(PANELS.indexOf(panel) + 1).padStart(2, '0')}-${panel}.png`);
        if (aktiv) await ganzesPanel(page, breite, datei);
        bericht.bilder.push({ datei: relative(ZIEL, datei), panel, design, theme, breite, aktiv,
          konsole: protokoll.konsole.slice(vorher.k), seitenfehler: protokoll.seitenfehler.slice(vorher.s) });
        process.stdout.write(aktiv ? '.' : 'x');
      }
      bericht[`fixture-${design}-${theme}-${breite}`] = { ...(await fixtureLog(page)), fremd: [...new Set(protokoll.fremd)] };
      await kontext.close();
      process.stdout.write(` ${design}-${theme}-${breite}\n`);
    }
  } finally { await browser.close(); await server.stop(); }
  // Mehrere Aufrufe in denselben Lauf (z. B. erst alt, dann neu) ergänzen den Bericht.
  if (frueher) {
    const neu = new Set(bericht.bilder.map((b) => b.datei));
    for (const [k, v] of Object.entries(frueher)) if (k.startsWith('fixture-') && !(k in bericht)) bericht[k] = v;
    bericht.bilder = [...frueher.bilder.filter((b) => !neu.has(b.datei)), ...bericht.bilder];
  }
  await writeFile(berichtPfad, JSON.stringify(bericht, null, 2));
  const inaktiv = bericht.bilder.filter((b) => !b.aktiv).map((b) => b.panel);
  const mitFehler = bericht.bilder.filter((b) => b.konsole.length || b.seitenfehler.length);
  console.log(`${bericht.bilder.length} Bilder → .redesign-shots/${lauf}/${rolle}-${szenario}/`
    + (inaktiv.length ? `  · nicht erreichbar: ${[...new Set(inaktiv)].join(', ')}` : '')
    + (mitFehler.length ? `  · mit Konsolenfehlern: ${[...new Set(mitFehler.map((b) => b.panel))].join(', ')}` : ''));
}

/** Das Panel scrollt in #mainArea, nicht im Dokument: Fenster kurz auf volle Höhe ziehen. */
async function ganzesPanel(page, breite, datei) {
  const hoehe = await page.evaluate(() => {
    const main = document.getElementById('mainArea');
    const oben = main ? main.getBoundingClientRect().top : 0;
    return Math.ceil(oben + (main ? main.scrollHeight : document.documentElement.scrollHeight));
  });
  const alt = page.viewportSize();
  await page.setViewportSize({ width: breite, height: Math.min(Math.max(hoehe, alt.height), 9000) });
  await page.evaluate(() => document.fonts.ready);
  // Erst speichern, wenn zwei Aufnahmen hintereinander gleich sind — sonst erwischt der
  // Vergleich nachladende Inhalte als Scheinabweichung (wie Playwrights toHaveScreenshot).
  let vorher = null, bild = null;
  for (let v = 0; v < 6; v++) {
    await page.waitForTimeout(250);
    bild = await page.screenshot({ animations: 'disabled', caret: 'hide' });
    if (vorher && bild.equals(vorher)) break;
    vorher = bild;
  }
  await writeFile(datei, bild);
  await page.setViewportSize(alt);
}

async function vergleiche() {
  const i = process.argv.indexOf('--vergleich');
  const [a, b] = [process.argv[i + 1], process.argv[i + 2]];
  const toleranz = Number(arg('toleranz', '0'));
  if (!a || !b) { console.error('--vergleich <laufA> <laufB>'); process.exit(2); }
  const dateien = await alleBilder(join(ZIEL, a));
  const diffOrdner = join(ZIEL, `diff-${a}-${b}`);
  let schlecht = 0, fehlt = 0, rauschen = 0;
  for (const rel of dateien) {
    const pb = join(ZIEL, b, rel);
    if (!existsSync(pb)) { fehlt++; console.log(`   ? fehlt in ${b}: ${rel}`); continue; }
    const [x, y] = [PNG.sync.read(await readFile(join(ZIEL, a, rel))), PNG.sync.read(await readFile(pb))];
    if (x.width !== y.width || x.height !== y.height) {
      schlecht++; console.log(`   ✗ ${rel}  Größe ${x.width}×${x.height} → ${y.width}×${y.height}`); continue;
    }
    const diff = new PNG({ width: x.width, height: x.height });
    const n = pixelmatch(x.data, y.data, diff.data, x.width, x.height, { threshold: 0.1, diffColor: [255, 0, 0] });
    const anteil = n / (x.width * x.height);
    if (anteil > toleranz) {
      await mkdir(join(diffOrdner, rel, '..'), { recursive: true });
      await writeFile(join(diffOrdner, rel), PNG.sync.write(diff));
      // Rauschen: Chromium setzt eine Textzeile zwischen zwei Läufen gelegentlich um einen
      // Subpixel versetzt (beobachtet 23.10. in mahnwesen, 1.083 px in einer 12 px hohen Zeile,
      // optisch gleich). Das zählt als Warnung, nicht als Fehler — Diff-Bild trotzdem ansehen.
      const box = rahmen(diff);
      if (anteil <= 0.001 && box.hoehe <= 24) {
        rauschen++; console.log(`   ⚠ ${rel}  ${n} px in einem ${box.hoehe} px hohen Streifen (y ${box.y}) — Rauschen?`);
      } else {
        schlecht++; console.log(`   ✗ ${rel}  ${n} px (${(anteil * 100).toFixed(3)} %), Bereich y ${box.y}–${box.y + box.hoehe}`);
      }
    }
  }
  // Bilder, die nur in B liegen: kein Fehler (z. B. neue Zustände), aber sichtbar machen.
  const nurB = existsSync(join(ZIEL, b)) ? (await alleBilder(join(ZIEL, b))).filter((r) => !dateien.includes(r)) : [];
  for (const r of nurB.slice(0, 20)) console.log(`   + neu in ${b}: ${r}`);
  if (nurB.length > 20) console.log(`   + … und ${nurB.length - 20} weitere neu in ${b}`);
  console.log(`\n${dateien.length} Bilder verglichen · ${schlecht} abweichend · ${rauschen} Rauschen · ${fehlt} fehlen · ${nurB.length} neu in B`
    + (schlecht ? ` · Diff-Bilder: .redesign-shots/diff-${a}-${b}/` : ''));
  process.exit(schlecht || fehlt ? 1 : 0);
}

/** Senkrechte Ausdehnung der roten Diff-Pixel. */
function rahmen(diff) {
  let oben = Infinity, unten = -1;
  for (let i = 0; i < diff.data.length; i += 4) {
    if (diff.data[i] === 255 && diff.data[i + 1] === 0 && diff.data[i + 2] === 0) {
      const y = Math.floor(i / 4 / diff.width); if (y < oben) oben = y; if (y > unten) unten = y;
    }
  }
  return unten < 0 ? { y: 0, hoehe: 0 } : { y: oben, hoehe: unten - oben + 1 };
}

async function alleBilder(ordner, basis = ordner) {
  const out = [];
  for (const e of await readdir(ordner, { withFileTypes: true })) {
    const p = join(ordner, e.name);
    if (e.isDirectory()) out.push(...await alleBilder(p, basis));
    else if (e.name.endsWith('.png')) out.push(relative(basis, p));
  }
  return out.sort();
}
