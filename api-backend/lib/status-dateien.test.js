// O-191 / O-40 Scheibe 2 — Host-Zustandsdateien für /api/status.
// Abnahmekriterien guvenlik (S-60 Nachtrag 11.10.2026, B1–B4) + onprem-Vorgaben.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  statusSammeln, statusDateienLesen, backupBewerten, zeitBewerten, dataKeyVergleichen, digestAus,
} from './status.js';

const still = () => {};
const JETZT = Date.parse('2026-10-11T12:00:00Z');
const sek = (ms) => Math.floor(ms / 1000);
const STD = 3_600_000;
const FP = '0123456789abcdef'; // secret-scan: ignore (Fake-Testwert)
const FP2 = 'fedcba9876543210'; // secret-scan: ignore (Fake-Testwert)
const DIGEST = `sha256:${'a'.repeat(64)}`; // secret-scan: ignore (Fake-Testwert)

function tmpDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'praxura-status-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
const schreiben = (dir, name, inhalt) => fs.writeFileSync(path.join(dir, name), typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt));

// ── backup ───────────────────────────────────────────────────────────────────
test('backup: Verzeichnis fehlt → unbekannt (altes compose + neues Image)', () => {
  assert.deepEqual(backupBewerten(undefined, { verzeichnis: false, jetztMs: JETZT }), { status: 'unbekannt' });
});

test('backup: Verzeichnis da, nie gesichert → warnung keine (kein falsches Grün)', () => {
  assert.deepEqual(backupBewerten(undefined, { verzeichnis: true, jetztMs: JETZT }), { status: 'warnung', code: 'keine' });
});

test('backup: 2 h alt, Ziel außerhalb → ok; lokal → warnung, nie ok', () => {
  const basis = { v: 1, letzte_ok_epoch: sek(JETZT - 2 * STD), sebep: 'nightly' };
  const ok = backupBewerten({ ...basis, ziel_ausserhalb: true }, { verzeichnis: true, jetztMs: JETZT });
  assert.equal(ok.status, 'ok');
  assert.equal(ok.alter_stunden, 2);
  assert.equal(ok.anlass, 'nightly');
  const lokal = backupBewerten({ ...basis, ziel_ausserhalb: false }, { verzeichnis: true, jetztMs: JETZT });
  assert.equal(lokal.status, 'warnung');
  assert.equal(lokal.code, 'lokal');
});

test('backup: älter als 36 h → fehler alt (auch bei lokalem Ziel)', () => {
  const r = backupBewerten({ v: 1, letzte_ok_epoch: sek(JETZT - 37 * STD), ziel_ausserhalb: false }, { verzeichnis: true, jetztMs: JETZT });
  assert.equal(r.status, 'fehler');
  assert.equal(r.code, 'alt');
});

test('backup: Epoch +1 Tag, falsche Version, kaputter Typ → unbekannt, nie ok', () => {
  const o = { verzeichnis: true, jetztMs: JETZT };
  assert.equal(backupBewerten({ v: 1, letzte_ok_epoch: sek(JETZT + 24 * STD) }, o).status, 'unbekannt');
  assert.equal(backupBewerten({ v: 2, letzte_ok_epoch: sek(JETZT) }, o).status, 'unbekannt');
  assert.equal(backupBewerten({ v: 1, letzte_ok_epoch: '1760000000' }, o).status, 'unbekannt');
  assert.equal(backupBewerten(null, o).status, 'unbekannt');
});

test('backup: unbekannter Anlass und Fremdfelder werden nicht durchgereicht', () => {
  const r = backupBewerten(
    { v: 1, letzte_ok_epoch: sek(JETZT - STD), sebep: '<script>', ziel_ausserhalb: 'ja', pfad: '/mnt/nas/geheim', alter_stunden: 0 },
    { verzeichnis: true, jetztMs: JETZT },
  );
  assert.equal(r.anlass, null);
  assert.equal(r.ziel_ausserhalb, null);
  assert.ok(!JSON.stringify(r).includes('geheim'));
  assert.ok(!JSON.stringify(r).includes('script'));
  assert.equal(r.alter_stunden, 1);
});

// ── zeit ─────────────────────────────────────────────────────────────────────
test('zeit: synchron → ok, nicht synchron → warnung ntp, null → unbekannt', () => {
  const g = sek(JETZT - 60_000);
  assert.deepEqual(zeitBewerten({ v: 1, ntp_synchron: true, gemessen_epoch: g }, JETZT), { status: 'ok' });
  assert.deepEqual(zeitBewerten({ v: 1, ntp_synchron: false, gemessen_epoch: g }, JETZT), { status: 'warnung', code: 'ntp' });
  assert.deepEqual(zeitBewerten({ v: 1, ntp_synchron: null, gemessen_epoch: g }, JETZT), { status: 'unbekannt' });
  assert.deepEqual(zeitBewerten({ v: 1, ntp_synchron: 'true', gemessen_epoch: g }, JETZT), { status: 'unbekannt' });
});

test('zeit: 1 h alte Datei (Timer tot), Zukunft, fehlend → unbekannt', () => {
  assert.equal(zeitBewerten({ v: 1, ntp_synchron: true, gemessen_epoch: sek(JETZT - STD) }, JETZT).status, 'unbekannt');
  assert.equal(zeitBewerten({ v: 1, ntp_synchron: true, gemessen_epoch: sek(JETZT + STD) }, JETZT).status, 'unbekannt');
  assert.equal(zeitBewerten(undefined, JETZT).status, 'unbekannt');
});

// ── data_key.vergleich ───────────────────────────────────────────────────────
test('data_key: gleich · abweichung → fehler · null in der Künye → unbekannt', () => {
  const feld = { status: 'ok', rundlauf: true, vergleich: 'unbekannt' };
  assert.equal(dataKeyVergleichen(feld, { v: 1, data_key_fingerprint: FP }, () => FP).vergleich, 'gleich');
  const ab = dataKeyVergleichen(feld, { v: 1, data_key_fingerprint: FP2 }, () => FP);
  assert.equal(ab.status, 'fehler');
  assert.equal(ab.code, 'schluessel_abweichung');
  assert.equal(ab.vergleich, 'abweichung');
  const nul = dataKeyVergleichen(feld, { v: 1, data_key_fingerprint: null }, () => FP);
  assert.equal(nul.status, 'ok');
  assert.equal(nul.vergleich, 'unbekannt');
});

test('data_key: _erst hält die Abweichung fest, auch wenn die letzte Sicherung wieder passt', () => {
  const feld = { status: 'ok', rundlauf: true };
  const r = dataKeyVergleichen(feld, { v: 1, data_key_fingerprint: FP, data_key_fingerprint_erst: FP2 }, () => FP);
  assert.equal(r.status, 'fehler');
  assert.equal(r.vergleich, 'abweichung');
});

test('data_key: bestehender Fehler (Rundlauf) behält seinen Code; Abdruck nie in der Antwort', () => {
  const r = dataKeyVergleichen({ status: 'fehler', code: 'rundlauf', rundlauf: false }, { v: 1, data_key_fingerprint: FP2 }, () => FP);
  assert.equal(r.code, 'rundlauf');
  assert.equal(r.vergleich, 'abweichung');
  const text = JSON.stringify(r);
  assert.ok(!text.includes(FP) && !text.includes(FP2));
  assert.equal(dataKeyVergleichen({ status: 'ok' }, { v: 1, data_key_fingerprint: 'KEIN-HEX' }, () => FP).vergleich, 'unbekannt');
  assert.equal(dataKeyVergleichen({ status: 'ok' }, { v: 1, data_key_fingerprint: FP }, () => { throw new Error('x'); }).vergleich, 'unbekannt');
});

// ── digest ───────────────────────────────────────────────────────────────────
test('digest: nur sha256:<64 hex>, sonst null', () => {
  assert.equal(digestAus({ v: 1, api_digest: DIGEST }), DIGEST);
  assert.equal(digestAus({ v: 1, api_digest: '<script>' }), null);
  assert.equal(digestAus({ v: 1, api_digest: 'sha256:abc' }), null);
  assert.equal(digestAus(undefined), null);
});

// ── Dateien lesen ────────────────────────────────────────────────────────────
test('lesen: Verzeichnis fehlt → verzeichnis false', async () => {
  assert.deepEqual(await statusDateienLesen(path.join(os.tmpdir(), 'praxura-gibt-es-nicht-status')), { verzeichnis: false });
});

test('lesen: gültig · fehlend (undefined) · kaputtes JSON (null) · 9 KB (null) · Array (null)', async (t) => {
  const dir = tmpDir(t);
  schreiben(dir, 'sicherung.json', { v: 1, letzte_ok_epoch: 1 });
  schreiben(dir, 'zeit.json', '{kein json');
  let r = await statusDateienLesen(dir);
  assert.equal(r.verzeichnis, true);
  assert.deepEqual(r.sicherung, { v: 1, letzte_ok_epoch: 1 });
  assert.equal(r.stand, undefined);
  assert.equal(r.zeit, null);
  schreiben(dir, 'sicherung.json', JSON.stringify({ v: 1, fuell: 'x'.repeat(9 * 1024) }));
  schreiben(dir, 'stand.json', '[1,2]');
  r = await statusDateienLesen(dir);
  assert.equal(r.sicherung, null);
  assert.equal(r.stand, null);
});

test('lesen: Symlink wird nicht verfolgt (Linux) → backup unbekannt, kein Fremdinhalt', { skip: process.platform === 'win32' }, async (t) => {
  const dir = tmpDir(t);
  const fremd = path.join(dir, 'fremd.txt');
  fs.writeFileSync(fremd, JSON.stringify({ v: 1, letzte_ok_epoch: sek(Date.now()), geheim: 'GEHEIMWERT' }));
  fs.symlinkSync(fremd, path.join(dir, 'sicherung.json'));
  const r = await statusDateienLesen(dir);
  assert.equal(r.sicherung, null);
  const s = await statusSammeln({ dateien: () => statusDateienLesen(dir), version: {}, schema: {} }, { log: still });
  assert.equal(s.felder.backup.status, 'unbekannt');
  assert.ok(!JSON.stringify(s).includes('GEHEIMWERT'));
});

test('lesen: Verzeichnis statt Datei → null, kein Hänger', async (t) => {
  const dir = tmpDir(t);
  fs.mkdirSync(path.join(dir, 'zeit.json'));
  const r = await statusDateienLesen(dir);
  assert.equal(r.zeit, null);
});

// ── Zusammenspiel ────────────────────────────────────────────────────────────
test('statusSammeln: echte Dateien → backup ok, zeit ok, vergleich gleich, digest gesetzt; weder Pfad noch Abdruck in der Antwort', async (t) => {
  const dir = tmpDir(t);
  const jetzt = new Date(JETZT);
  schreiben(dir, 'sicherung.json', { v: 1, letzte_ok_epoch: sek(JETZT - 3 * STD), sebep: 'vor-migration', data_key_fingerprint: FP, data_key_fingerprint_erst: FP, ziel_ausserhalb: true });
  schreiben(dir, 'stand.json', { v: 1, sonuc: 'ok', version: '0.5.3+abc', api_digest: DIGEST, frontend_digest: DIGEST, zaman_epoch: sek(JETZT) });
  schreiben(dir, 'zeit.json', { v: 1, ntp_synchron: true, gemessen_epoch: sek(JETZT - 90_000) });
  const r = await statusSammeln({
    dateien: () => statusDateienLesen(dir),
    eigenerFingerprint: () => FP,
    dataKey: async () => ({ rundlauf: true, vergleich: 'unbekannt' }),
    version: { version: '0.5.3' }, schema: {},
  }, { log: still, jetzt: () => jetzt });
  assert.equal(r.felder.backup.status, 'ok');
  assert.equal(r.felder.zeit.status, 'ok');
  assert.equal(r.felder.data_key.vergleich, 'gleich');
  assert.equal(r.felder.version.digest, DIGEST);
  const text = JSON.stringify(r);
  assert.ok(!text.includes(FP));
  assert.ok(!text.includes(dir));
  assert.ok(!text.includes('praxura-status-'));
});

test('statusSammeln: nie gesichert färbt gesamt gelb; Lesefehler der Dateien bricht nichts', async (t) => {
  const dir = tmpDir(t);
  const gelb = await statusSammeln({ dateien: () => statusDateienLesen(dir), version: {}, schema: {} }, { log: still });
  assert.equal(gelb.felder.backup.code, 'keine');
  assert.equal(gelb.gesamt, 'warnung');
  const kaputt = await statusSammeln({ dateien: async () => { throw new Error('EIO /var/lib/praxura/status'); }, version: {}, schema: {} }, { log: still });
  assert.equal(kaputt.felder.backup.status, 'unbekannt');
  assert.equal(kaputt.felder.zeit.status, 'unbekannt');
  assert.equal(kaputt.gesamt, 'ok');
  assert.ok(!JSON.stringify(kaputt).includes('/var/lib'));
});

test('statusSammeln: alte Sicherung → gesamt fehler', async () => {
  const jetzt = new Date(JETZT);
  const r = await statusSammeln({
    dateien: async () => ({ verzeichnis: true, sicherung: { v: 1, letzte_ok_epoch: sek(JETZT - 50 * STD), ziel_ausserhalb: true } }),
    version: {}, schema: {},
  }, { log: still, jetzt: () => jetzt });
  assert.equal(r.felder.backup.code, 'alt');
  assert.equal(r.gesamt, 'fehler');
});
