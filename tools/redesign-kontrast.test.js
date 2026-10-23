// Kontrast-Wache für praxura-design.css (Redesign 2026-10, redesign/AUFTRAG.md 1.4 / REFERENZ §2).
//
// Liest die Farbwerte direkt aus der CSS-Datei — ändert jemand einen Wert, der
// unter die WCAG-Grenze fällt, wird `npm test` rot, bevor es jemand im Browser
// merkt. Text braucht 4,5:1, große Zahlen/Symbole/Linien 3:1.
// Halbtransparente Flächen (rgba) werden über ihren Untergrund gelegt gerechnet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const ohneKommentare = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
const css = ohneKommentare(readFileSync(join(wurzel, 'praxura-design.css'), 'utf8'));
const altCss = ohneKommentare(readFileSync(join(wurzel, 'dashboard.css'), 'utf8'));

/** Alle `--name: wert;` aus dem ersten Block, dessen Selektor genau `selektor` ist. */
function block(quelle, selektor) {
  const i = quelle.indexOf(selektor + ' {');
  assert.ok(i >= 0, `Block ${selektor} fehlt`);
  const inhalt = quelle.slice(i, quelle.indexOf('}', i));
  return Object.fromEntries([...inhalt.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const hell = block(css, ':root[data-design="neu"]:not([data-theme="dark"])');
// Im Dunkeln übernimmt das neue Design --success/--danger/--warning-text aus dashboard.css.
const dunkel = { ...block(altCss, '[data-theme="dark"]'), ...block(css, ':root[data-design="neu"][data-theme="dark"]') };

function rgb(wert) {
  const hex = wert.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)).concat(1);
  const r = wert.match(/^rgba?\(([^)]+)\)$/);
  assert.ok(r, `Farbe nicht lesbar: ${wert}`);
  const [a, b, c, alpha = '1'] = r[1].split(',').map((s) => s.trim());
  return [Number(a), Number(b), Number(c), Number(alpha)];
}
const ueber = (oben, unten) => oben.slice(0, 3).map((c, i) => c * oben[3] + unten[i] * (1 - oben[3])).concat(1);
const lum = ([r, g, b]) => [r, g, b].map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
  .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
function kontrast(vorne, hinten, grund) {
  const h = ueber(rgb(hinten), rgb(grund));
  const v = ueber(rgb(vorne), h);
  const [a, b] = [lum(v), lum(h)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const TEXT = ['--text-main', '--text-muted', '--text-sub', '--text-faint', '--accent', '--primary', '--success', '--danger', '--warning-text'];
const FLAECHEN = ['--bg-main', '--bg-card-solid', '--bg-input', '--bg-elevated'];

for (const [name, t] of [['hell', hell], ['dunkel', dunkel]]) {
  test(`Kontrast ${name}: Text auf allen Flächen ≥ 4,5:1`, () => {
    const zuSchwach = [];
    for (const f of FLAECHEN) for (const v of TEXT) {
      const k = kontrast(t[v], t[f], t['--bg-main']);
      if (k < 4.5) zuSchwach.push(`${v} auf ${f}: ${k.toFixed(2)}`);
    }
    assert.deepEqual(zuSchwach, []);
  });

  test(`Kontrast ${name}: Text auf zart getönten Flächen ≥ 4,5:1`, () => {
    const paare = [['--text-main', '--primary-dim'], ['--text-muted', '--primary-dim'], ['--primary', '--primary-dim'],
      ['--text-main', '--nav-active'], ['--primary', '--nav-active'], ['--text-main', '--bg-hover'],
      ['--danger', '--danger-bg'], ['--warning-text', '--warning-bg']];
    const zuSchwach = paare.map(([v, h]) => [v, h, kontrast(t[v], t[h], t['--bg-card-solid'])])
      .filter(([, , k]) => k < 4.5).map(([v, h, k]) => `${v} auf ${h}: ${k.toFixed(2)}`);
    assert.deepEqual(zuSchwach, []);
  });

  // --highlight (Champagner) ist reine Zierfarbe ohne Kontrastpflicht und wird hier nicht geprüft.
  test(`Kontrast ${name}: Symbole, Fokusring, Bronze ≥ 3:1`, () => {
    const zuSchwach = ['--bronze', '--focus-ring'].flatMap((v) => ['--bg-main', '--bg-card-solid']
      .map((f) => [v, f, kontrast(t[v], t[f], t['--bg-main'])]))
      .filter(([, , k]) => k < 3)
      .map(([v, f, k]) => `${v} auf ${f}: ${k.toFixed(2)}`);
    assert.deepEqual(zuSchwach, []);
  });
}

test('Kontrast hell: Knopftext Weiß auf --primary ≥ 4,5:1', () => {
  assert.ok(kontrast('#FFFFFF', hell['--primary'], hell['--bg-main']) >= 4.5);
});
