// Box-Test 22.11.2026 / O-172 (ii): Zertifikat und Restore-Reste im Systemstatus.
import test from 'node:test';
import assert from 'node:assert/strict';
import { zertifikatBewerten, restoreResteAnhaengen, gesamtStatus } from './status.js';

const jetzt = Date.parse('2026-11-23T08:00:00Z');
const s = (/** @type {number} */ ms) => Math.floor(ms / 1000);
const roh = (/** @type {any} */ x) => ({ v: 1, art: 'le', gemessen_epoch: s(jetzt - 3600e3), ...x });

test('LE: > 21 Tage ok, darunter warnung, abgelaufen fehler', () => {
  assert.equal(zertifikatBewerten(roh({ not_after_epoch: s(jetzt + 60 * 864e5) }), { verzeichnis: true, jetztMs: jetzt }).status, 'ok');
  const w = zertifikatBewerten(roh({ not_after_epoch: s(jetzt + 10 * 864e5) }), { verzeichnis: true, jetztMs: jetzt });
  assert.equal(w.status, 'warnung'); assert.equal(w.tage_rest, 10);
  assert.equal(zertifikatBewerten(roh({ not_after_epoch: s(jetzt - 864e5) }), { verzeichnis: true, jetztMs: jetzt }).status, 'fehler');
});

test('lokale CA: Warnung ab 90 Tagen, Code intern', () => {
  const r = zertifikatBewerten(roh({ art: 'lokale_ca', not_after_epoch: s(jetzt + 60 * 864e5) }), { verzeichnis: true, jetztMs: jetzt });
  assert.equal(r.status, 'warnung'); assert.equal(r.code, 'intern');
  assert.equal(zertifikatBewerten(roh({ art: 'lokale_ca', not_after_epoch: s(jetzt + 400 * 864e5) }), { verzeichnis: true, jetztMs: jetzt }).status, 'ok');
});

test('fehlend, veraltet, kaputt → info/unbekannt (verschlechtert den Gesamtzustand nicht)', () => {
  assert.deepEqual(zertifikatBewerten(undefined, { verzeichnis: true, jetztMs: jetzt }), { status: 'info', code: 'nicht_ueberwacht' });
  assert.equal(zertifikatBewerten(roh({ gemessen_epoch: s(jetzt - 49 * 3600e3), not_after_epoch: s(jetzt + 9e9) }), { verzeichnis: true, jetztMs: jetzt }).status, 'unbekannt');
  assert.equal(zertifikatBewerten(roh({ art: 'fremd', not_after_epoch: 1 }), { verzeichnis: true, jetztMs: jetzt }).status, 'unbekannt');
  assert.equal(zertifikatBewerten(roh({}), { verzeichnis: false }).status, 'unbekannt');
  assert.equal(gesamtStatus({ a: { status: 'ok' }, zertifikat: { status: 'unbekannt' } }), 'ok');
});

test('Restore-Reste hängen am Disk-Feld, ohne Reste unverändert', () => {
  const disk = { status: 'ok', frei_prozent: 50 };
  assert.equal(restoreResteAnhaengen(disk, []), disk);
  assert.deepEqual(restoreResteAnhaengen(disk, [{ name: 'postgres_onceki_20261122', bytes: 2.3e6 }]).restore_reste, [{ name: 'postgres_onceki_20261122', bytes: 2.3e6 }]);
});
