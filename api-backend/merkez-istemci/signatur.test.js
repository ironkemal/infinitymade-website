import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  signiereAnfrage, pruefeSignatur, leseSignaturKopf, boxIdAusPublicKey, zerlegeUrl,
  sha256Hex, baueSignaturString, publicKeyAlsBase64url, neueNonce,
} from './signatur.js';

function neueKimlik() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return { boxId: boxIdAusPublicKey(publicKey), privateKey, publicKey };
}

const URL_ = 'https://merkez.example.org/v1/ip?x=1';
const JETZT = 1_800_000_000_000;

function lege({ body = '{"modus":"lan"}', method = 'POST', url = URL_, nonce } = {}) {
  const k = neueKimlik();
  const s = signiereAnfrage({ method, url, body, kimlik: k, jetzt: JETZT, nonce });
  const kopf = leseSignaturKopf(Object.fromEntries(Object.entries(s.headers).map(([a, b]) => [a.toLowerCase(), b])));
  return { k, s, kopf, body, method };
}

function pruefe(l, ueberschreibe = {}) {
  return pruefeSignatur({
    method: l.method, host: l.s.host, pfad: l.s.pfad, body: l.body, kopf: l.kopf,
    publicKey: l.k.publicKey, jetzt: JETZT, ...ueberschreibe,
  });
}

test('Roundtrip: signieren → prüfen', () => {
  const l = lege();
  assert.equal(l.kopf.boxId, l.k.boxId);
  assert.deepEqual(pruefe(l), { ok: true });
});

test('Format der Kopfzeilen: Nonce 128 Bit (22 Zeichen base64url), Signatur 86 Zeichen', () => {
  const l = lege();
  assert.match(l.s.headers['X-Praxura-Nonce'], /^[A-Za-z0-9_-]{22}$/);
  assert.match(l.s.headers['X-Praxura-Signatur'], /^[A-Za-z0-9_-]{86}$/);
  assert.match(l.s.headers['X-Praxura-Box'], /^[0-9a-f]{32}$/);
  assert.equal(neueNonce().length, 22);
});

test('Signierter String: fester Aufbau, leerer Body = sha256("")', () => {
  const s = baueSignaturString({ method: 'post', host: 'h', pfad: '/p?q', boxId: 'b', zeit: 5, nonce: 'n', body: undefined });
  assert.equal(s, 'praxura-v1\nPOST\nh\n/p?q\nb\n5\nn\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex(''), sha256Hex(undefined));
});

test('Manipulation: Host → Fehler', () => {
  const l = lege();
  assert.equal(pruefe(l, { host: 'boese.example.org' }).ok, false);
});

test('Manipulation: Pfad und Query → Fehler', () => {
  const l = lege();
  assert.equal(pruefe(l, { pfad: '/v1/caa?x=1' }).grund, 'signatur');
  assert.equal(pruefe(l, { pfad: '/v1/ip?x=2' }).grund, 'signatur');
  assert.equal(pruefe(l, { pfad: '/v1/ip' }).grund, 'signatur');
});

test('Manipulation: Methode und Body → Fehler', () => {
  const l = lege();
  assert.equal(pruefe(l, { method: 'PUT' }).grund, 'signatur');
  assert.equal(pruefe(l, { body: '{"modus":"internet"}' }).grund, 'signatur');
  assert.equal(pruefe(l, { body: undefined }).grund, 'signatur');
});

test('Manipulation: Zeit / Nonce / Box-ID im Kopf → Fehler', () => {
  const l = lege();
  assert.equal(pruefe(l, { kopf: { ...l.kopf, zeit: l.kopf.zeit + 1 } }).grund, 'signatur');
  assert.equal(pruefe(l, { kopf: { ...l.kopf, nonce: neueNonce() } }).grund, 'signatur');
  const fremd = neueKimlik();
  assert.equal(pruefe(l, { kopf: { ...l.kopf, boxId: fremd.boxId } }).grund, 'box');
});

test('Fremder Schlüssel → Fehler', () => {
  const l = lege();
  assert.equal(pruefe(l, { publicKey: neueKimlik().publicKey }).ok, false);
});

test('Zeitfenster ±300 s', () => {
  const l = lege();
  assert.equal(pruefe(l, { jetzt: JETZT + 300_000 }).ok, true);
  assert.equal(pruefe(l, { jetzt: JETZT - 300_000 }).ok, true);
  assert.equal(pruefe(l, { jetzt: JETZT + 301_000 }).grund, 'zeit');
  assert.equal(pruefe(l, { jetzt: JETZT - 301_000 }).grund, 'zeit');
});

test('Replay: zweiter Versuch mit gleicher Nonce → Fehler', () => {
  const l = lege();
  const gesehen = new Set();
  const nonceNeu = (b, n) => { const k = b + n; if (gesehen.has(k)) return false; gesehen.add(k); return true; };
  assert.equal(pruefe(l, { nonceNeu }).ok, true);
  assert.equal(pruefe(l, { nonceNeu }).grund, 'replay');
});

test('Nonce wird bei ungültiger Signatur NICHT gemerkt', () => {
  const l = lege();
  let aufrufe = 0;
  pruefe(l, { body: 'anders', nonceNeu: () => { aufrufe++; return true; } });
  assert.equal(aufrufe, 0);
});

test('erwarteterHost wird durchgesetzt', () => {
  const l = lege();
  assert.equal(pruefe(l, { erwarteterHost: 'merkez.example.org' }).ok, true);
  assert.equal(pruefe(l, { erwarteterHost: 'anderer.example.org' }).grund, 'host');
});

test('Kopfzeilen: fehlend / formal ungültig → null (keine Zeilenumbruch-Einschleusung)', () => {
  assert.equal(leseSignaturKopf({}), null);
  const l = lege();
  const h = Object.fromEntries(Object.entries(l.s.headers).map(([a, b]) => [a.toLowerCase(), b]));
  assert.equal(leseSignaturKopf({ ...h, 'x-praxura-zeit': 'abc' }), null);
  assert.equal(leseSignaturKopf({ ...h, 'x-praxura-nonce': 'kurz' }), null);
  assert.equal(leseSignaturKopf({ ...h, 'x-praxura-box': 'A'.repeat(32) }), null);
  assert.equal(leseSignaturKopf({ ...h, 'x-praxura-signatur': ['a'] }), null);
});

test('Roher Pfad bleibt unverändert; Host klein, Standardport weg', () => {
  assert.deepEqual(zerlegeUrl('HTTPS://Merkez.Example.org:443/a/../b%2Fc?x=%41&y'), { schema: 'https', host: 'merkez.example.org', pfad: '/a/../b%2Fc?x=%41&y' });
  assert.equal(zerlegeUrl('http://127.0.0.1:8080').pfad, '/');
  assert.equal(zerlegeUrl('http://127.0.0.1:8080').host, '127.0.0.1:8080');
  assert.throws(() => zerlegeUrl('ftp://x'));
});

test('Öffentlicher Schlüssel als base64url-SPKI und PEM akzeptiert; RSA abgelehnt', () => {
  const l = lege();
  const b64 = publicKeyAlsBase64url(l.k.publicKey);
  const pem = l.k.publicKey.export({ type: 'spki', format: 'pem' });
  assert.equal(pruefe(l, { publicKey: b64 }).ok, true);
  assert.equal(pruefe(l, { publicKey: pem }).ok, true);
  const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey;
  assert.equal(pruefe(l, { publicKey: rsa }).grund, 'schluessel');
});

test('sha256Hex akzeptiert nur Buffer/string/leer', () => {
  assert.throws(() => sha256Hex({}), TypeError);
  assert.throws(() => sha256Hex(42), TypeError);
  assert.equal(sha256Hex(Buffer.alloc(0)), sha256Hex(null));
});
