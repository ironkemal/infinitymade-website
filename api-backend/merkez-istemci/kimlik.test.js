import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { erzeugeKimlik, ladeKimlik, speichereAd, uebernehmeNeueKimlik } from './kimlik.js';
import { merkezFetch } from './merkez-fetch.js';
import { leseSignaturKopf, pruefeSignatur } from './signatur.js';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'kimlik-')); }

test('erzeugeKimlik: Dateien, 0600 (POSIX), box_id aus Schlüssel, ad null', () => {
  const dir = path.join(tmp(), 'k');
  const k = erzeugeKimlik({ dir });
  for (const f of ['box.key', 'box.pub', 'box.json']) assert.ok(fs.existsSync(path.join(dir, f)));
  if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(dir, 'box.key')).mode & 0o777, 0o600);
  assert.match(k.boxId, /^[0-9a-f]{32}$/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'box.json'), 'utf8')).box_id, k.boxId);
  assert.equal(k.ad, null);
  assert.match(fs.readFileSync(path.join(dir, 'box.key'), 'utf8'), /BEGIN PRIVATE KEY/);
});

test('box.json und box.pub enthalten den geheimen Schlüssel nicht', () => {
  const dir = tmp();
  erzeugeKimlik({ dir });
  for (const f of ['box.pub', 'box.json']) assert.ok(!/PRIVATE/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
});

test('erzeugeKimlik überschreibt nicht still; ersetzen schreibt nur *.neu und lässt die alte Identität gültig', () => {
  const dir = tmp();
  const a = erzeugeKimlik({ dir });
  assert.throws(() => erzeugeKimlik({ dir }), /existiert bereits/);
  const b = erzeugeKimlik({ dir, ersetzen: true });
  assert.notEqual(a.boxId, b.boxId);
  assert.equal(b.neu, true);
  assert.equal(ladeKimlik({ dir }).boxId, a.boxId, 'alte Identität unverändert bis zur Übernahme');
  assert.equal(erzeugeKimlik({ dir, ersetzen: true }).boxId, b.boxId, 'vorhandenes .neu wird wiederverwendet');
  uebernehmeNeueKimlik({ dir });
  assert.equal(ladeKimlik({ dir }).boxId, b.boxId);
  assert.ok(!fs.existsSync(path.join(dir, 'box.key.neu')));
});

test('ladeKimlik: gleiche Identität, null wenn leer, Ad speicherbar', () => {
  const dir = tmp();
  assert.equal(ladeKimlik({ dir }), null);
  const k = erzeugeKimlik({ dir });
  assert.equal(ladeKimlik({ dir }).boxId, k.boxId);
  speichereAd({ dir, ad: 'sonne-tal-42' });
  assert.equal(ladeKimlik({ dir }).ad, 'sonne-tal-42');
});

test('merkezFetch: signiert, MERKEZ_URL Pflicht, https erzwungen, Serverzeit nur zurückgegeben', async () => {
  const dir = tmp();
  const kimlik = erzeugeKimlik({ dir });
  let gesehen;
  const fetchImpl = async (url, opt) => {
    gesehen = { url, opt };
    return { status: 401, ok: false, json: async () => ({ fehler: 'signatur', serverzeit: 123 }) };
  };
  await assert.rejects(merkezFetch('/v1/ip', { kimlik, fetchImpl }), /MERKEZ_URL/);
  await assert.rejects(merkezFetch('/v1/ip', { kimlik, fetchImpl, baseUrl: 'http://merkez.example.org' }), /https/);
  const r = await merkezFetch('/v1/ip', { kimlik, fetchImpl, baseUrl: 'https://merkez.example.org/', body: { modus: 'lan', ip: '192.168.1.5' } });
  assert.equal(r.serverzeit, 123);
  assert.equal(gesehen.url, 'https://merkez.example.org/v1/ip');
  const h = Object.fromEntries(Object.entries(gesehen.opt.headers).map(([a, b]) => [a.toLowerCase(), b]));
  const res = pruefeSignatur({
    method: 'POST', host: 'merkez.example.org', pfad: '/v1/ip', body: gesehen.opt.body,
    kopf: leseSignaturKopf(h), publicKey: kimlik.publicKey,
  });
  assert.equal(res.ok, true);
});

test('merkezFetch: Weiterleitungen werden nicht gefolgt', async () => {
  let opt;
  await merkezFetch('/v1/ip', { ohneSignatur: true, baseUrl: 'https://m.example.org', fetchImpl: async (u, o) => { opt = o; return { status: 200, ok: true, json: async () => ({}) }; } });
  assert.equal(opt.redirect, 'error');
});

test('merkezFetch ohne Kimlik und ohne ohneSignatur → Fehler', async () => {
  const alt = process.env.KIMLIK_DIR;
  process.env.KIMLIK_DIR = path.join(tmp(), 'leer');
  try {
    await assert.rejects(merkezFetch('/v1/ip', { baseUrl: 'https://m.example.org', fetchImpl: async () => ({}) }), /Kimlik/);
  } finally {
    if (alt === undefined) delete process.env.KIMLIK_DIR; else process.env.KIMLIK_DIR = alt;
  }
});
