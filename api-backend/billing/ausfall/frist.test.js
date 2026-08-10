// Tests für die serverseitige Absagefrist-Prüfung.
//   node api-backend/billing/ausfall/frist.test.js
import { pruefeAusfallFrist, uebersteuerungsNotiz, ABLEHNUNGSGRUND } from './frist.js';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}

console.log('ausfall/frist');

const JETZT = new Date('2026-08-10T10:00:00Z');
const in5h  = new Date('2026-08-10T15:00:00Z').toISOString();  // 5 h Vorlauf
const in30h = new Date('2026-08-11T16:00:00Z').toISOString();  // 30 h Vorlauf

// ------------------------------------------------------------- deaktiviert
test('Ausfallgebühr aus → abgelehnt', () => {
  const r = pruefeAusfallFrist({ enabled: false, reason: 'no_show', jetzt: JETZT });
  assert.equal(r.erlaubt, false);
  assert.equal(r.grund, ABLEHNUNGSGRUND.DEAKTIVIERT);
  assert.ok(r.meldung.includes('Einstellungen'));
});

test('Ausfallgebühr aus schlägt auch no_show', () => {
  const r = pruefeAusfallFrist({ enabled: false, reason: 'no_show', terminStart: in5h, jetzt: JETZT });
  assert.equal(r.erlaubt, false);
});

// ----------------------------------------------------------------- no_show
test('no_show ist immer erlaubt, ohne Fristprüfung', () => {
  const r = pruefeAusfallFrist({ enabled: true, reason: 'no_show', jetzt: JETZT });
  assert.equal(r.erlaubt, true);
  assert.equal(r.grund, null);
});

test('no_show auch bei grossem Vorlauf erlaubt', () => {
  const r = pruefeAusfallFrist({ enabled: true, reason: 'no_show', terminStart: in30h, jetzt: JETZT });
  assert.equal(r.erlaubt, true);
});

// ------------------------------------------------------------- late_cancel
test('Absage 5 h vorher bei 24 h Frist → erlaubt', () => {
  const r = pruefeAusfallFrist({ enabled: true, reason: 'late_cancel', cutoffHours: 24, terminStart: in5h, jetzt: JETZT });
  assert.equal(r.erlaubt, true);
  assert.ok(Math.abs(r.vorlaufStunden - 5) < 0.01);
});

test('Absage 30 h vorher bei 24 h Frist → abgelehnt (rechtzeitig)', () => {
  const r = pruefeAusfallFrist({ enabled: true, reason: 'late_cancel', cutoffHours: 24, terminStart: in30h, jetzt: JETZT });
  assert.equal(r.erlaubt, false);
  assert.equal(r.grund, ABLEHNUNGSGRUND.RECHTZEITIG);
});

test('Grenze genau erreicht zählt als rechtzeitig', () => {
  const exakt24 = new Date('2026-08-11T10:00:00Z').toISOString();
  const r = pruefeAusfallFrist({ enabled: true, reason: 'late_cancel', cutoffHours: 24, terminStart: exakt24, jetzt: JETZT });
  assert.equal(r.erlaubt, false, '24,0 h Vorlauf ist noch fristgerecht');
});

test('48-h-Frist macht aus 30 h Vorlauf einen Ausfall', () => {
  const r = pruefeAusfallFrist({ enabled: true, reason: 'late_cancel', cutoffHours: 48, terminStart: in30h, jetzt: JETZT });
  assert.equal(r.erlaubt, true);
});

test('bereits vergangener Termin → negativer Vorlauf, erlaubt', () => {
  const gestern = new Date('2026-08-09T10:00:00Z').toISOString();
  const r = pruefeAusfallFrist({ enabled: true, reason: 'late_cancel', cutoffHours: 24, terminStart: gestern, jetzt: JETZT });
  assert.equal(r.erlaubt, true);
  assert.ok(r.vorlaufStunden < 0);
});

test('fehlendes Termindatum → abgelehnt, Frist nicht prüfbar', () => {
  const r = pruefeAusfallFrist({ enabled: true, reason: 'late_cancel', terminStart: null, jetzt: JETZT });
  assert.equal(r.erlaubt, false);
  assert.equal(r.grund, ABLEHNUNGSGRUND.KEIN_TERMINDATUM);
});

test('unlesbares Termindatum → abgelehnt', () => {
  const r = pruefeAusfallFrist({ enabled: true, reason: 'late_cancel', terminStart: 'kein-datum', jetzt: JETZT });
  assert.equal(r.erlaubt, false);
  assert.equal(r.grund, ABLEHNUNGSGRUND.KEIN_TERMINDATUM);
});

test('ungültige cutoffHours fallen auf 24 zurück', () => {
  const r = pruefeAusfallFrist({ enabled: true, reason: 'late_cancel', cutoffHours: null, terminStart: in30h, jetzt: JETZT });
  assert.equal(r.erlaubt, false, 'null → Vorgabe 24 h → 30 h ist rechtzeitig');
});

// ------------------------------------------------------------- Übersteuern
test('override hebt die Sperre auf, Grund bleibt erhalten', () => {
  const r = pruefeAusfallFrist({
    enabled: true, reason: 'late_cancel', cutoffHours: 24,
    terminStart: in30h, jetzt: JETZT, override: true,
  });
  assert.equal(r.erlaubt, true);
  assert.equal(r.uebersteuert, true);
  assert.equal(r.grund, ABLEHNUNGSGRUND.RECHTZEITIG, 'Grund muss für notes erhalten bleiben');
});

test('override wirkt auch bei deaktivierter Ausfallgebühr', () => {
  const r = pruefeAusfallFrist({ enabled: false, reason: 'no_show', jetzt: JETZT, override: true });
  assert.equal(r.erlaubt, true);
  assert.equal(r.uebersteuert, true);
});

test('regulär erlaubt ist nicht uebersteuert', () => {
  const r = pruefeAusfallFrist({ enabled: true, reason: 'late_cancel', cutoffHours: 24, terminStart: in5h, jetzt: JETZT });
  assert.equal(r.uebersteuert, false);
});

// ---------------------------------------------------------------- Protokoll
test('uebersteuerungsNotiz nur bei Übersteuerung', () => {
  const ohne = pruefeAusfallFrist({ enabled: true, reason: 'no_show', jetzt: JETZT });
  assert.equal(uebersteuerungsNotiz(ohne), null);

  const mit = pruefeAusfallFrist({
    enabled: true, reason: 'late_cancel', cutoffHours: 24,
    terminStart: in30h, jetzt: JETZT, override: true,
  });
  const notiz = uebersteuerungsNotiz(mit, new Date('2026-08-10T12:00:00Z'));
  assert.ok(notiz.includes('rechtzeitig_abgesagt'));
  assert.ok(notiz.includes('10.8.2026'));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
