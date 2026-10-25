import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WURZEL, neuCssDateien, pruefeAuslieferung, pruefeCache, pruefeImportant, pruefeSchrumpf, pruefeScope } from './redesign-wachen.mjs';

test('Scope: Regel ohne data-design wird gemeldet, @media/@keyframes nicht', () => {
  const css = `@media screen {\n  [data-design="neu"] .a, .b { color: red; }\n}\n@keyframes x { from { opacity: 0 } to { opacity: 1 } }\n:root[data-design="neu"] { --x: 1; }`;
  const f = pruefeScope(css, 't.css');
  assert.equal(f.length, 1);
  assert.match(f[0], /t\.css:2 .*\.b/);
});

test('Scope: Kommentar mit Klammern stört nicht', () => {
  assert.deepEqual(pruefeScope('/* .x { } */\n[data-design="neu"] .y { a: b; }', 't'), []);
});

test('!important braucht Kommentar in der Nähe', () => {
  const ohne = '.a{}\n.b{}\n.c{}\n.d{}\n.e{}\n.f{}\n.g{}\n.h{}\n.i{}\n.j{}\n.k{}\n[data-design="neu"] .x { color: red !important; }';
  assert.equal(pruefeImportant(ohne, 't').length, 1);
  const mit = '/* gegen Inline-Stil */\n[data-design="neu"] .x { color: red !important; }';
  assert.deepEqual(pruefeImportant(mit, 't'), []);
  assert.deepEqual(pruefeImportant('/*\n  `!important` nur im Kommentar\n*/', 't'), []);
});

test('Cache: geänderte Datei braucht neue Nummer', () => {
  const head = '<link href="a.css?v=1"><script src="b.js?v=1"></script>';
  const jetzt = '<link href="a.css?v=1"><script src="b.js?v=2"></script>';
  const f = pruefeCache(jetzt, head, (d) => d === 'a.css' || d === 'b.js');
  assert.equal(f.length, 1);
  assert.match(f[0], /a\.css/);
  assert.deepEqual(pruefeCache(jetzt, head, () => false), []);
});

test('Auslieferung: Ordner-Einträge decken Dateien, fehlende werden gemeldet', () => {
  const html = '<link href="design/shell.css?v=1"><link href="neu.css?v=1"><script src="/module/x.js"></script>';
  const docker = 'COPY design ./design\nCOPY module ./module\nCOPY --from=bau /x /y';
  const wf = "    paths:\n      - 'design/**'\n      - 'module/**'\n";
  const f = pruefeAuslieferung(html, docker, wf);
  assert.equal(f.length, 2);
  assert.ok(f.every((x) => x.startsWith('neu.css')));
});

test('Schrumpf: Verlust über 10 % wird gemeldet', () => {
  const head = 'x'.repeat(1000);
  assert.equal(pruefeSchrumpf('x'.repeat(850), head, 'd').length, 1);
  assert.deepEqual(pruefeSchrumpf('x'.repeat(950), head, 'd'), []);
  assert.deepEqual(pruefeSchrumpf('', null, 'neu'), []);
});

// Gegen die echten Dateien: Auslieferung und Scope gelten immer, nicht nur, wenn jemand T1 aufruft.
test('echte Dateien: jede in dashboard.html geladene Datei wird ausgeliefert (Kutu + Workflow)', () => {
  const lies = (p) => readFileSync(join(WURZEL, p), 'utf8');
  assert.deepEqual(pruefeAuslieferung(lies('dashboard.html'), lies('onprem/frontend.Dockerfile'), lies('.github/workflows/publish-frontend.yml')), []);
});

test('echte Dateien: Neu-CSS ist vollständig unter [data-design="neu"] und !important begründet', () => {
  for (const f of neuCssDateien()) {
    const css = readFileSync(join(WURZEL, f), 'utf8');
    assert.deepEqual([...pruefeScope(css, f), ...pruefeImportant(css, f)], [], f);
  }
});

test('Scope: Kommas in :is() trennen keine Selektoren', () => {
  assert.deepEqual(pruefeScope('[data-design="neu"] :is(.a, .b):hover { x: y; }', 't'), []);
});
