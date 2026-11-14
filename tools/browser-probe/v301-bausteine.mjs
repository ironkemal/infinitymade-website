#!/usr/bin/env node
/**
 * v301-bausteine.mjs — Baustein-Katalog (tools/redesign-katalog.html) gegen die Tokens messen (V3.01).
 *
 *   node tools/browser-probe/v301-bausteine.mjs [--shots]   (Screenshots: .redesign-shots/v301/)
 *   Exit 1 bei Verstoß gegen Tokens/Überlauf/Fokus/Schriftgröße; Befunde (Hinweise) bleiben Exit 0.
 *
 * Läuft neu × {hell, dunkel} × {1440, 390 px}; dazu je Lauf der Alt-Zustand (ohne data-design) als Gegenprobe.
 *
 * Erwartungswerte (praxura-design.css, Block `:root[data-design="neu"]` ab Zeile 45; Token-Werte werden
 * zur Laufzeit aus der Datei gelesen, die Quellzeilen unten sind die Regeln, die sie anwenden):
 *   Baustein                          Eigenschaft              Erwartung              Quelle
 *   karte, kennzahl                   border-radius            --radius               praxura-design.css:351 (Gruppe ab 345)
 *   knopf-primaer/zweit/gefahr/       border-radius            --radius-sm            praxura-design.css:441
 *     umriss/klein                    min-height               >= 36 px               praxura-design.css:443
 *   feld-text/-auswahl/-mehrzeilig    border-radius            --radius-sm            praxura-design.css:513
 *                                     Höhe                     >= 40 px (Text/Auswahl) praxura-design.css:514
 *                                                              >= 80 px (mehrzeilig)  praxura-design.css:519
 *   tabelle                           border-radius            --radius               praxura-design.css:555
 *   badge-*                           border-radius            --radius-xs (Pille)    praxura-design.css:589
 *   modal                             border-radius            --radius               praxura-design.css:607
 *   filter / filter-aktiv             border-radius            --radius-sm            praxura-design.css:632
 *                                     Höhe                     >= 32 px               praxura-design.css:631
 *   banner, hinweis-v3w               border-radius            --radius-md            praxura-design.css:665 / shell.css:604
 *   toast                             border-radius            --radius-md            praxura-design.css:679
 *   mini                              border-radius            --radius-md            startseite.css:177
 *   skelett                           border-radius            7 px (fest)            startseite.css:88
 *   alle                              font-size                >= 12 px               (--fs-meta, praxura-design.css:61)
 *   Knopf/Feld/Filter/Tab             Fokus (focus())          outline-Breite>0 oder box-shadow  praxura-design.css:690-698
 *   390 px                            Knopf/Feld Höhe          >= 44 px nur als Hinweis: das CSS setzt 44 px
 *                                                              nur in #panel-anamnese (formulare.css:11-56), nicht allgemein.
 *   390 px                            Seitenüberlauf           scrollWidth <= Viewport (Fehler)
 */
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { WURZEL, ruhe, starteBrowser, starteServer } from '../redesign-harness.mjs';

process.env.REDESIGN_PORT ||= '18301';
const MIT_BILDERN = process.argv.includes('--shots');

const ohneKommentare = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
const css = ohneKommentare(await readFile(join(WURZEL, 'praxura-design.css'), 'utf8'));
const i0 = css.indexOf(':root[data-design="neu"] {');
if (i0 < 0) { console.error('Token-Block :root[data-design="neu"] fehlt'); process.exit(1); }
const tokens = Object.fromEntries([...css.slice(i0, css.indexOf('}', i0)).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const px = (t) => { const v = parseFloat(tokens[t]); if (Number.isNaN(v)) { console.error('Token ohne px-Wert: ' + t); process.exit(1); } return v; };

const FELD = (h) => ({ radius: '--radius-sm', minH: h, fokus: true });
const KNOPF = { radius: '--radius-sm', minH: 36, fokus: true };
const SPEC = {
  karte: { radius: '--radius' }, kennzahl: { radius: '--radius' },
  'knopf-primaer': KNOPF, 'knopf-zweit': KNOPF, 'knopf-gefahr': KNOPF, 'knopf-umriss': KNOPF, 'knopf-klein': KNOPF,
  'feld-text': FELD(40), 'feld-auswahl': FELD(40), 'feld-text-mehrzeilig': FELD(80),
  tabelle: { radius: '--radius' },
  'badge-gruen': { radius: '--radius-xs' }, 'badge-gelb': { radius: '--radius-xs' }, 'badge-blau': { radius: '--radius-xs' }, 'badge-grau': { radius: '--radius-xs' },
  modal: { radius: '--radius' },
  filter: { radius: '--radius-sm', minH: 32, fokus: true }, 'filter-aktiv': { radius: '--radius-sm', minH: 32, fokus: true },
  tab: { fokus: true }, 'tab-aktiv': { fokus: true },
  banner: { radius: '--radius-md' }, 'hinweis-v3w': { radius: '--radius-md' },
  leer: {}, toast: { radius: '--radius-md' },
  zustandskarte: {}, skelett: { radiusPx: 7 }, mini: { radius: '--radius-md' },
};

const MESS = () => {
  const aus = {};
  for (const el of document.querySelectorAll('[data-mess]')) {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    aus[el.dataset.mess] = { radius: parseFloat(cs.borderTopLeftRadius), h: r.height, w: r.width, fs: parseFloat(cs.fontSize),
      sichtbar: r.width > 0 && r.height > 0 };
  }
  return { aus, ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth };
};
const FOKUS = (name) => {
  const el = document.querySelector(`[data-mess="${name}"]`);
  el.focus();
  const cs = getComputedStyle(el);
  const ring = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
  const schatten = cs.boxShadow && cs.boxShadow !== 'none';
  el.blur();
  return { ring, schatten: !!schatten };
};

const server = await starteServer();
const browser = await starteBrowser();
let pruefungen = 0; const fehler = []; const befunde = [];
const fehl = (m) => { fehler.push(m); };
const pruef = (ok, m) => { pruefungen++; if (!ok) fehl(m); };

async function lade(breite, design, theme) {
  const kontext = await browser.newContext({ viewport: { width: breite, height: 900 }, locale: 'de-DE' });
  const page = await kontext.newPage();
  const fremd = [];
  await page.route('**/*', (route) => { const u = new URL(route.request().url()); if (u.origin !== server.basis) { fremd.push(u.host); return route.abort(); } return route.continue(); });
  await page.goto(`${server.basis}/tools/redesign-katalog.html?design=${design}&theme=${theme}`, { waitUntil: 'load' });
  await ruhe(page, 300);
  return { kontext, page, fremd };
}

try {
  for (const theme of ['hell', 'dunkel']) {
    for (const breite of [1440, 390]) {
      const etikett = `neu/${theme}/${breite}`;
      const alt = await lade(breite, 'alt', theme);
      const altMess = await alt.page.evaluate(MESS);
      await alt.kontext.close();

      const neu = await lade(breite, 'neu', theme);
      const { page } = neu;
      pruef(neu.fremd.length === 0, `${etikett}: Fremdzugriff ${neu.fremd.join(',')}`);
      const { aus, ueber } = await page.evaluate(MESS);
      if (breite === 390) pruef(ueber <= 0, `${etikett}: horizontaler Überlauf ${ueber}px`);
      const hat = await page.evaluate(() => document.documentElement.getAttribute('data-design') + '|' + (document.documentElement.getAttribute('data-theme') || ''));
      pruef(hat === 'neu|' + (theme === 'dunkel' ? 'dark' : ''), `${etikett}: Zustand ${hat}`);

      for (const [name, m] of Object.entries(aus)) {
        const s = SPEC[name];
        if (!s) { befunde.push(`${etikett}: ${name} ohne Spezifikation in der Probe`); continue; }
        pruef(m.sichtbar, `${etikett} ${name}: nicht sichtbar/ohne Größe`);
        const erw = s.radiusPx ?? (s.radius ? px(s.radius) : null);
        if (erw != null) pruef(Math.abs(m.radius - erw) < 0.6 || (s.radius === '--radius-xs' && m.radius >= 99), `${etikett} ${name}: border-radius ${m.radius}px, erwartet ${s.radius || ''} ${erw}px`);
        if (s.minH) pruef(m.h + 0.5 >= s.minH, `${etikett} ${name}: Höhe ${m.h.toFixed(1)}px < ${s.minH}px`);
        pruef(m.fs >= 12, `${etikett} ${name}: Schrift ${m.fs}px < 12px`);
        if (breite === 390 && s.minH && /^(knopf|feld|filter)/.test(name) && m.h < 44) befunde.push(`${etikett} ${name}: Höhe ${m.h.toFixed(0)}px < 44px (CSS setzt 44 nur in #panel-anamnese, formulare.css:11-56)`);
        if (s.fokus) {
          const f = await page.evaluate(FOKUS, name);
          pruef(f.ring || f.schatten, `${etikett} ${name}: kein sichtbarer Fokus (outline/box-shadow)`);
        }
        // Alt-Gegenprobe: greift der Neu-Wert im Alt-Zustand nicht?
        const a = altMess.aus[name];
        if (a && (s.radius || s.radiusPx) && breite === 1440 && theme === 'hell') {
          if (Math.abs(a.radius - m.radius) < 0.6) befunde.push(`Alt-Gegenprobe ${name}: border-radius in alt und neu gleich (${m.radius}px)`);
          else pruef(true, '');
        }
      }
      if (theme === 'hell' && breite === 1440) {
        const a = altMess.aus;
        const stich = { karte: a.karte?.radius, 'knopf-primaer': a['knopf-primaer']?.h, 'feld-text': a['feld-text']?.h, modal: a.modal?.radius, toast: a.toast?.radius };
        console.log('  alt-Stichprobe (1440/hell):', JSON.stringify(stich));
      }
      if (MIT_BILDERN && breite === 1440) {
        const ordner = join(WURZEL, '.redesign-shots/v301');
        await mkdir(ordner, { recursive: true });
        await page.screenshot({ path: join(ordner, `neu-${theme}-1440.png`), fullPage: true });
      }
      await neu.kontext.close();
      console.log(`${etikett}: ${Object.keys(aus).length} Bausteine gemessen`);
    }
  }
} finally { await browser.close(); await server.stop(); }

console.log(`\nPrüfungen: ${pruefungen}, Fehler: ${fehler.length}, Befunde: ${befunde.length}`);
for (const b of [...new Set(befunde)]) console.log('  BEFUND  ' + b);
for (const f of fehler) console.log('  FEHLER  ' + f);
process.exit(fehler.length ? 1 : 0);
