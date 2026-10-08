// tools/onprem-setup-jeton.test.js — Strukturtests fuer den Einrichtungs-Jeton (K2b.11, K-19 h).
// Lauf: node --test tools/onprem-setup-jeton.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const setupHtmlPfad = path.join(repoRoot, 'setup.html');
const setupJsPfad = path.join(repoRoot, 'setup.js');
const supabaseConfigPfad = path.join(repoRoot, 'supabase-config.js');
const installShPfad = path.join(repoRoot, 'onprem', 'install.sh');
const ps1Pfad = path.join(repoRoot, 'installieren', 'install.ps1');

test('setup.html: genau ein script-Tag (setup.js als module, relative Quelle) und keine externen http/https-Quellen in script/link', () => {
  const inhalt = fs.readFileSync(setupHtmlPfad, 'utf8');

  // Genau ein <script-Tag
  const scriptMatches = inhalt.match(/<script\b[^>]*>[\s\S]*?<\/script>|<script\b[^>]*\/>/gi) || [];
  assert.equal(scriptMatches.length, 1, `Erwartet genau 1 <script>-Tag in setup.html, gefunden: ${scriptMatches.length}`);

  const scriptTag = scriptMatches[0];
  assert.match(scriptTag, /type=["']module["']/i, 'Script-Tag muss type="module" haben');
  assert.match(scriptTag, /src=["']setup\.js(?:\?[^"']*)?["']/i, 'Script-Quelle muss setup.js sein (relative Quelle)');

  // Keine http:// oder https:// Quellen in <script> oder <link>
  const linkAndScriptTags = inhalt.match(/<(?:script|link)\b[^>]*>/gi) || [];
  for (const tag of linkAndScriptTags) {
    assert.doesNotMatch(tag, /\b(?:src|href)\s*=\s*["']https?:\/\//i, `Externe URL nicht erlaubt in: ${tag}`);
  }
});

test('setup.js: Imports nur supabase-config.js oder setup-fragment.js, kein dynamisches import, kein createElement script', () => {
  const inhalt = fs.readFileSync(setupJsPfad, 'utf8');
  const zeilen = inhalt.split(/\r?\n/);

  const importZeilen = zeilen.filter((z) => /^\s*import\b/.test(z));
  assert.ok(importZeilen.length > 0, 'Mindestens ein Import in setup.js erwartet');

  for (const z of importZeilen) {
    const gueltig = /from\s+['"]\.\/(?:supabase-config\.js|module\/setup-fragment\.js)['"]/.test(z);
    assert.ok(gueltig, `Unerlaubte Import-Zeile in setup.js: ${z}`);
  }

  // Kein dynamisches import(
  assert.doesNotMatch(inhalt, /\bimport\s*\(/, 'setup.js darf kein dynamisches import( enthalten');

  // Kein createElement('script')
  assert.doesNotMatch(inhalt, /createElement\s*\(\s*['"]script['"]\s*\)/i, 'setup.js darf kein createElement("script") enthalten');

  // Kein type = 'password' / type="password" (S-48)
  assert.doesNotMatch(inhalt, /type\s*=\s*['"]password['"]/i, 'setup.js darf kein type="password" setzen (S-48)');

  // Kein console.
  assert.doesNotMatch(inhalt, /\bconsole\s*\./, 'setup.js darf kein console.* enthalten');
});

test('setup.js: setup-fragment.js ist der ERSTE Import (vor supabase-config.js, dessen Top-Level-fetch sonst vor replaceState liefe)', () => {
  // Kommentarzeilen zählen nicht.
  const ohneKommentar = (text) => text.split(/\r?\n/).filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z)).join('\n');
  const inhalt = ohneKommentar(fs.readFileSync(setupJsPfad, 'utf8'));
  const importe = inhalt.split('\n').filter((z) => /^\s*import\s/.test(z));
  assert.ok(importe.length >= 2, 'setup.js muss mindestens zwei Imports haben');
  assert.match(importe[0], /from\s+['"]\.\/module\/setup-fragment\.js['"]/, 'erster Import muss ./module/setup-fragment.js sein');
  assert.match(importe[0], /fragmentJeton/, 'erster Import muss fragmentJeton holen');
  // Lesen + replaceState passieren beim Laden von setup-fragment.js
  const frag = ohneKommentar(fs.readFileSync(path.join(path.dirname(setupJsPfad), 'module', 'setup-fragment.js'), 'utf8'));
  assert.match(frag, /history\.replaceState\(/, 'setup-fragment.js muss replaceState aufrufen');
  assert.match(frag, /export const fragmentJeton/, 'setup-fragment.js muss fragmentJeton exportieren');
  assert.ok(!/\bfetch\(/.test(frag), 'setup-fragment.js darf selbst nichts abrufen');
});

test('supabase-config.js: kein sentry/umami, kein dynamisches import, kein createElement script', () => {
  const inhalt = fs.readFileSync(supabaseConfigPfad, 'utf8');

  // Kein Import von Sentry oder Umami
  assert.doesNotMatch(inhalt, /\b(?:sentry|umami)\b/i, 'supabase-config.js darf kein sentry oder umami enthalten');

  // Kein dynamisches import(
  assert.doesNotMatch(inhalt, /\bimport\s*\(/, 'supabase-config.js darf kein dynamisches import( enthalten');

  // Kein createElement script
  assert.doesNotMatch(inhalt, /createElement\s*\(\s*['"]script['"]\s*\)/i, 'supabase-config.js darf kein createElement("script") enthalten');
});

test('install.sh: setup.html# nur in reveal_once, nie in log; PRAXURA_BROWSER_OEFFNEN mit :- Default', () => {
  const inhalt = fs.readFileSync(installShPfad, 'utf8');
  const zeilen = inhalt.split(/\r?\n/);

  for (const [idx, z] of zeilen.entries()) {
    if (z.includes('setup.html#')) {
      assert.ok(
        /^\s*reveal_once\b/.test(z),
        `setup.html# darf nur in reveal_once vorkommen, gefunden in Zeile ${idx + 1}: ${z}`
      );
      assert.doesNotMatch(
        z,
        /^\s*log\b/,
        `setup.html# darf NIE in log vorkommen (Zeile ${idx + 1})`
      );
    }
  }

  // PRAXURA_BROWSER_OEFFNEN mit :-
  assert.match(
    inhalt,
    /\$\{PRAXURA_BROWSER_OEFFNEN:-\}/,
    'install.sh muss PRAXURA_BROWSER_OEFFNEN mit Default-Expansion ${PRAXURA_BROWSER_OEFFNEN:-} abfragen'
  );
});

test('praxura-installieren.ps1: UTF-8 BOM vorhanden', () => {
  const puffer = fs.readFileSync(ps1Pfad);
  assert.equal(puffer[0], 0xEF, 'BOM Byte 0 muss 0xEF sein');
  assert.equal(puffer[1], 0xBB, 'BOM Byte 1 muss 0xBB sein');
  assert.equal(puffer[2], 0xBF, 'BOM Byte 2 muss 0xBF sein');
});

test('praxura-installieren.ps1: PRAXURA_BROWSER_OEFFNEN=1 im wsl-Aufruf und Start-Process mit setup.html#', () => {
  const inhalt = fs.readFileSync(ps1Pfad, 'utf8');

  assert.match(inhalt, /env\s+PRAXURA_BROWSER_OEFFNEN=1\s+bash/, 'wsl.exe-Aufruf muss PRAXURA_BROWSER_OEFFNEN=1 setzen');
  assert.match(inhalt, /Start-Process\s+["']\$siteUrl\/setup\.html#\$jeton["']/, 'Start-Process muss $siteUrl/setup.html#$jeton aufrufen');
});

test('praxura-installieren.ps1: kein Log/Warn/Ok/Fehler mit $jeton', () => {
  const inhalt = fs.readFileSync(ps1Pfad, 'utf8');
  const zeilen = inhalt.split(/\r?\n/);

  for (const [idx, z] of zeilen.entries()) {
    if (/(?:Log|Warn|Ok|Fehler)\b/.test(z)) {
      assert.doesNotMatch(
        z,
        /\$jeton\b/,
        `Zeile ${idx + 1} enthaelt Log/Warn/Ok/Fehler und $jeton: ${z}`
      );
    }
  }
});
