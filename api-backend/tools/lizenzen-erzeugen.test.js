// O-178 / K2b.16 — Lizenztor: Bewertung, Ausnahmen, Bericht.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bewerteLizenz, lizenzAusdruck, sammlePakete, pruefe, erzeugeBericht } from './lizenzen-erzeugen.mjs';

test('erlaubte Lizenzen und Schreibvarianten', () => {
  for (const l of ['MIT', 'Apache-2', 'Apache', 'MIT/X11', 'BSD-3-Clause', 'ISC', '0BSD', 'BlueOak-1.0.0']) {
    assert.equal(bewerteLizenz(l).status, 'erlaubt', l);
  }
  assert.equal(bewerteLizenz('Apache-2').ausdruck, 'Apache-2.0');
});

test('OR: ein erlaubter Zweig reicht · AND: alle Teile müssen erlaubt sein', () => {
  assert.equal(bewerteLizenz('(MIT OR GPL-3.0)').status, 'erlaubt');
  assert.equal(bewerteLizenz('Public Domain OR MIT').status, 'erlaubt');
  assert.equal(bewerteLizenz('MIT AND GPL-2.0').status, 'verboten');
  assert.equal(bewerteLizenz('Apache-2.0 WITH LLVM-exception').status, 'erlaubt');
});

test('verboten: Copyleft und source-available', () => {
  for (const l of ['AGPL-3.0', 'GPL-2.0-only', 'LGPL-3.0', 'SSPL-1.0', 'BUSL-1.1', 'Elastic-2.0', 'Sustainable Use License']) {
    assert.equal(bewerteLizenz(l).status, 'verboten', l);
  }
});

test('leer / UNKNOWN / SEE LICENSE IN = unbekannt (bricht den Bau wie verboten)', () => {
  for (const l of ['', undefined, 'UNKNOWN', 'UNLICENSED', 'SEE LICENSE IN LICENSE.md', 'WTFPL-ish']) {
    assert.equal(bewerteLizenz(l).status, 'unbekannt', String(l));
  }
});

test('lizenzAusdruck liest alte Feldformen', () => {
  assert.equal(lizenzAusdruck({ license: { type: 'MIT' } }), 'MIT');
  assert.equal(lizenzAusdruck({ licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }] }), 'MIT OR Apache-2.0');
  assert.equal(lizenzAusdruck({}), '');
});

function baum(pakete) {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), 'lizenz-'));
  for (const [rel, pkg, lizenzText] of pakete) {
    const d = path.join(w, rel);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify(pkg));
    if (lizenzText) fs.writeFileSync(path.join(d, 'LICENSE'), lizenzText);
  }
  return w;
}

test('Baum: scoped + verschachtelt, Lizenz aus Datei erkannt, Bericht enthält Texte', () => {
  const w = baum([
    ['node_modules/a', { name: 'a', version: '1.0.0', license: 'MIT' }, 'MIT Text A'],
    ['node_modules/@s/b', { name: '@s/b', version: '2.0.0', license: 'ISC' }],
    ['node_modules/a/node_modules/c', { name: 'c', version: '0.1.0' }, 'The MIT License (MIT)\n\nText C'],
  ]);
  const pakete = sammlePakete(w);
  assert.deepEqual(pakete.map((p) => p.name), ['@s/b', 'a', 'c']);
  const { fehler, ergebnisse } = pruefe(pakete, {});
  assert.deepEqual(fehler, []);
  const bericht = erzeugeBericht(ergebnisse);
  assert.match(bericht, /MIT Text A/);
  assert.match(bericht, /c@0\.1\.0 {2}— {2}MIT \(aus Lizenzdatei\)/);
  assert.match(bericht, /keine eigene Lizenzdatei.*ISC/);
});

test('verbotenes Paket ohne Ausnahme → Fehler; mit Ausnahme → markiert', () => {
  const w = baum([['node_modules/x', { name: 'x', version: '1.0.0', license: 'AGPL-3.0' }]]);
  const pakete = sammlePakete(w);
  assert.equal(pruefe(pakete, {}).fehler.length, 1);
  const mit = pruefe(pakete, { x: 'Grund' });
  assert.deepEqual(mit.fehler, []);
  assert.match(erzeugeBericht(mit.ergebnisse), /in der Box nicht ausgeführt/);
});

test('veraltete Ausnahme bricht den Bau (verschwindet mit dem Paket)', () => {
  const w = baum([['node_modules/a', { name: 'a', version: '1.0.0', license: 'MIT' }]]);
  const { fehler } = pruefe(sammlePakete(w), { pm2: 'O-179' });
  assert.equal(fehler.length, 1);
  assert.match(fehler[0], /veraltet/);
});

test('dev-Pfade werden ausgelassen (lokaler Lauf mit --lock)', () => {
  const w = baum([
    ['node_modules/a', { name: 'a', version: '1.0.0', license: 'MIT' }],
    ['node_modules/d', { name: 'd', version: '1.0.0', license: 'GPL-3.0' }],
  ]);
  const pakete = sammlePakete(w, { devPfade: new Set(['node_modules/d']) });
  assert.deepEqual(pakete.map((p) => p.name), ['a']);
});
