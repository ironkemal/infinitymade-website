#!/usr/bin/env node
/**
 * redesign-kontaktbogen.mjs — Übersichtsbild je Lauf und Kombination (PLAN-V2 V0.11, Teil von T4).
 *
 * Warum
 * ─────
 * Neu-Bilder müssen angesehen werden (AUFTRAG 3.3, Schritt PRÜFEN). 27 Bereiche × Theme × Breite
 * einzeln zu öffnen kostet Zeit und Kontext; ein Kontaktbogen zeigt alle Bereiche einer
 * Kombination auf einem Bild (oberer Ausschnitt je Bereich, beschriftet). Auffälliges wird danach
 * gezielt im Einzelbild geprüft.
 *
 *   node tools/redesign-kontaktbogen.mjs --lauf X [--ordner owner-voll/neu-hell-1440]
 *        [--spalten 4] [--ausschnitt 900]
 *   → .redesign-shots/X/kontakt-<rolle-szenario>-<design-theme-breite>.png
 *
 * Läuft ohne Testserver (lokale Datei im Browser), kann also parallel zu Shots/Smoke laufen.
 */
import { readdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { WURZEL } from './redesign-harness.mjs';

const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const lauf = arg('lauf');
if (!lauf) { console.error('--lauf <name> fehlt'); process.exit(2); }
const spalten = Number(arg('spalten', '4'));
const ausschnitt = Number(arg('ausschnitt', '900'));
const basis = join(WURZEL, '.redesign-shots', lauf);
if (!existsSync(basis)) { console.error(`Lauf fehlt: ${basis}`); process.exit(2); }

const ordner = [];
if (arg('ordner')) ordner.push(arg('ordner'));
else for (const rs of await readdir(basis, { withFileTypes: true })) {
  if (!rs.isDirectory()) continue;
  for (const k of await readdir(join(basis, rs.name), { withFileTypes: true })) if (k.isDirectory()) ordner.push(`${rs.name}/${k.name}`);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const browser = await chromium.launch();
try {
  for (const o of ordner.sort()) {
    const bilder = (await readdir(join(basis, o))).filter((d) => d.endsWith('.png')).sort();
    if (!bilder.length) continue;
    const breite = Number(o.match(/-(\d+)$/)?.[1] || 1440);
    const zelleB = Math.floor((1440 - 16 * (spalten + 1)) / spalten);
    const zelleH = Math.round(zelleB * Math.min(ausschnitt, breite * 2.2) / breite);
    const html = `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;padding:16px;background:#1d1f23;font:12px system-ui;color:#e6e6e6}
      h1{font-size:14px;margin:0 0 12px}
      .g{display:grid;grid-template-columns:repeat(${spalten},${zelleB}px);gap:16px}
      .z{background:#2a2d33;border-radius:6px;overflow:hidden}
      .z div{height:${zelleH}px;overflow:hidden;background:#fff}
      .z img{width:100%;display:block}
      .z p{margin:0;padding:6px 8px}</style>
      <h1>${esc(lauf)} · ${esc(o)} · ${bilder.length} Bilder · oberer Ausschnitt ${ausschnitt}px</h1>
      <div class="g">${bilder.map((b) => `<div class="z"><div><img src="${pathToFileURL(join(basis, o, b)).href}"></div><p>${esc(b.replace('.png', ''))}</p></div>`).join('')}</div>`;
    const tmp = join(basis, `.kontakt-${o.replace('/', '-')}.html`);
    await writeFile(tmp, html);
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(pathToFileURL(tmp).href);
    await page.waitForLoadState('load');
    const ziel = join(basis, `kontakt-${o.replace('/', '-')}.png`);
    await page.screenshot({ path: ziel, fullPage: true });
    await page.close();
    await rm(tmp);
    console.log(`.redesign-shots/${lauf}/kontakt-${o.replace('/', '-')}.png`);
  }
} finally { await browser.close(); }
