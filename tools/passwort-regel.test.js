// tools/passwort-regel.test.js — Konsistenztest fuer Passwort-Mindestlaengen (K2b.12, K-19 g).
// Lauf: node --test tools/passwort-regel.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as backendRegel from '../api-backend/lib/passwort-regel.js';
import * as frontendRegel from '../module/passwort-regel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

test('Spiegelung: api-backend/lib/passwort-regel.js und module/passwort-regel.js exportieren identische Konstanten und Verhalten', () => {
  assert.equal(backendRegel.MIN_INHABER, 12, 'MIN_INHABER muss 12 sein');
  assert.equal(backendRegel.MIN_MITARBEITER, 8, 'MIN_MITARBEITER muss 8 sein');
  assert.equal(frontendRegel.MIN_INHABER, backendRegel.MIN_INHABER, 'MIN_INHABER in Frontend und Backend identisch');
  assert.equal(frontendRegel.MIN_MITARBEITER, backendRegel.MIN_MITARBEITER, 'MIN_MITARBEITER in Frontend und Backend identisch');

  const rollen = ['owner', 'employee', undefined, 'x', null, '', 'other'];
  for (const rolle of rollen) {
    assert.equal(
      frontendRegel.minPasswortLaenge(rolle),
      backendRegel.minPasswortLaenge(rolle),
      `minPasswortLaenge(${rolle}) muss uebereinstimmen`
    );
  }

  const passwoerter = ['1234567', '12345678', '12345678901', '123456789012', '', null, undefined, 12345];
  for (const rolle of ['owner', 'employee', undefined, 'unknown']) {
    for (const pw of passwoerter) {
      assert.equal(
        frontendRegel.pruefePasswort(rolle, pw),
        backendRegel.pruefePasswort(rolle, pw),
        `pruefePasswort(${rolle}, ${pw}) muss uebereinstimmen`
      );
    }
  }
});

test('onprem/docker-compose.yml: Dienst auth enthaelt GOTRUE_PASSWORD_MIN_LENGTH: "<MIN_MITARBEITER>"', () => {
  const composePfad = path.join(repoRoot, 'onprem', 'docker-compose.yml');
  const inhalt = fs.readFileSync(composePfad, 'utf8');

  // Prüfen, dass GOTRUE_PASSWORD_MIN_LENGTH den Wert von MIN_MITARBEITER hat ("8")
  const muster = new RegExp(`GOTRUE_PASSWORD_MIN_LENGTH:\\s*["']?${backendRegel.MIN_MITARBEITER}["']?`);
  assert.match(inhalt, muster, `onprem/docker-compose.yml muss GOTRUE_PASSWORD_MIN_LENGTH: "${backendRegel.MIN_MITARBEITER}" enthalten`);
});

test('onprem/reset-owner-passwort.sh enthaelt -ge <MIN_INHABER>', () => {
  const shPfad = path.join(repoRoot, 'onprem', 'reset-owner-passwort.sh');
  const inhalt = fs.readFileSync(shPfad, 'utf8');

  const muster = new RegExp(`-ge\\s+${backendRegel.MIN_INHABER}\\b`);
  assert.match(inhalt, muster, `reset-owner-passwort.sh muss -ge ${backendRegel.MIN_INHABER} enthalten`);
});

test('setup.html id="password" hat minlength="<MIN_INHABER>"', () => {
  const htmlPfad = path.join(repoRoot, 'setup.html');
  const inhalt = fs.readFileSync(htmlPfad, 'utf8');

  const muster = new RegExp(`<input[^>]*id=["']password["'][^>]*minlength=["']${backendRegel.MIN_INHABER}["']|<input[^>]*minlength=["']${backendRegel.MIN_INHABER}["'][^>]*id=["']password["']`);
  assert.match(inhalt, muster, `setup.html id="password" muss minlength="${backendRegel.MIN_INHABER}" haben`);
});

test('login.html erstPw und erstPw2 haben minlength="<MIN_MITARBEITER>"', () => {
  const htmlPfad = path.join(repoRoot, 'login.html');
  const inhalt = fs.readFileSync(htmlPfad, 'utf8');

  const muster1 = new RegExp(`<input[^>]*id=["']erstPw["'][^>]*minlength=["']${backendRegel.MIN_MITARBEITER}["']|<input[^>]*minlength=["']${backendRegel.MIN_MITARBEITER}["'][^>]*id=["']erstPw["']`);
  assert.match(inhalt, muster1, `login.html id="erstPw" muss minlength="${backendRegel.MIN_MITARBEITER}" haben`);

  const muster2 = new RegExp(`<input[^>]*id=["']erstPw2["'][^>]*minlength=["']${backendRegel.MIN_MITARBEITER}["']|<input[^>]*minlength=["']${backendRegel.MIN_MITARBEITER}["'][^>]*id=["']erstPw2["']`);
  assert.match(inhalt, muster2, `login.html id="erstPw2" muss minlength="${backendRegel.MIN_MITARBEITER}" haben`);
});

test('Kein .length < 6, .length < 8, .length < 12 mehr in Passwort-Zeilen', () => {
  const dateien = [
    path.join(repoRoot, 'api-backend', 'setup', 'router.js'),
    path.join(repoRoot, 'api-backend', 'routes', 'mitarbeiter-zugang.js'),
    path.join(repoRoot, 'api-backend', 'setup', 'owner-passwort-reset.mjs'),
    path.join(repoRoot, 'login.js'),
  ];

  const verbotenesMuster = /\.length\s*<\s*(?:6|8|12)\b/;
  const passwortZeilenMuster = /pw|passw|password/i;

  for (const datei of dateien) {
    const inhalt = fs.readFileSync(datei, 'utf8');
    const zeilen = inhalt.split(/\r?\n/);
    zeilen.forEach((zeile, idx) => {
      // Nur Zeilen mit pw/passw/password und Nicht-Kommentare
      if (passwortZeilenMuster.test(zeile) && !/^\s*\/\//.test(zeile)) {
        assert.doesNotMatch(
          zeile,
          verbotenesMuster,
          `Verbotene Längenprüfung in ${path.relative(repoRoot, datei)}: Zeile ${idx + 1}: ${zeile.trim()}`
        );
      }
    });
  }
});

test('dashboard.js pwChangeBtn / setPw Kontext nutzt minPasswortLaenge', () => {
  const dashPfad = path.join(repoRoot, 'dashboard.js');
  const inhalt = fs.readFileSync(dashPfad, 'utf8');

  // Prüfe Zeile mit pwChangeBtn / setPw
  const setPwIdx = inhalt.indexOf('document.getElementById(\'pwChangeBtn\')');
  assert.ok(setPwIdx !== -1, 'pwChangeBtn in dashboard.js gefunden');

  const ausschnitt = inhalt.slice(setPwIdx, setPwIdx + 300);
  assert.match(ausschnitt, /minPasswortLaenge/, 'dashboard.js muss minPasswortLaenge im pwChangeBtn Handler nutzen');
  assert.doesNotMatch(ausschnitt, /\.length\s*<\s*6\b/, 'dashboard.js darf kein pw.length < 6 mehr nutzen');
});

test('dashboard.html: setPw (Einstellungen, Rolle erst in JS bekannt) hat minlength = MIN_MITARBEITER', () => {
  const inhalt = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
  const zeile = inhalt.split(/\r?\n/).find((z) => z.includes('id="setPw"'));
  assert.ok(zeile, 'dashboard.html muss id="setPw" enthalten');
  assert.match(zeile, new RegExp(`minlength="${backendRegel.MIN_MITARBEITER}"`), 'setPw minlength muss MIN_MITARBEITER sein');
});
