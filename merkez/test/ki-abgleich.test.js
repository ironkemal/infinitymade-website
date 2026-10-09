// O-169 Bed. 7 — nächtlicher KI-Abgleich mit gefälschter Azure-Summe (Azure selbst ist ORG, kein Netzaufruf).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oeffneDb } from '../db.js';
import { adminBefehl } from '../admin.js';
import { abgleichen, berichtTokens, utcTag } from '../ki-abgleich.js';

const TAG = '2026-10-08';
const WS = `${TAG}T00:00:00.000Z`;
const NACH_TAG = Date.parse('2026-10-09T03:00:00Z');
const bericht = (tokens) => ({ taskTotals: { 'rezept-normalize': { calls: 1, prompt_tokens: 0, completion_tokens: 0, total_tokens: tokens } } });

function aufbau() {
  const db = oeffneDb(':memory:');
  let n = 0;
  const speichere = (boxId, tokens, empfangen, windowStart = WS) => db.kiBerichtSpeichern({
    boxId, reportId: `${boxId}-${windowStart.slice(0, 10)}`, payloadHash: `h${++n}`, windowStart, empfangen, daten: bericht(tokens),
  });
  return { db, speichere };
}
const lauf = (db, argv, jetzt = NACH_TAG) => adminBefehl({ db, cloudflare: null, boxDomain: 'box.example', jetzt: () => jetzt, akteur: 'test' }, argv);
const log = (db, aktion) => db.adminLogLesen().filter((z) => z.aktion === aktion);

test('berichtTokens: Summe über Aufgaben, Unlesbares/Ungültiges zählt 0 (nie NaN)', () => {
  assert.equal(berichtTokens(JSON.stringify({ taskTotals: { a: { total_tokens: 5 }, b: { total_tokens: 7 } } })), 12);
  assert.equal(berichtTokens('{kaputt'), 0);
  assert.equal(berichtTokens({ taskTotals: { a: { total_tokens: 'x' }, b: { total_tokens: -3 }, c: { total_tokens: 1.5 }, d: {} } }), 0);
  assert.equal(berichtTokens(null), 0);
});

test('abgleichen: Grenze = gemeldet·(1+%)+Tokens, ungültige Azure-Zahl wirft statt still ok', () => {
  const b = [{ box_id: 'a', daten: bericht(100000) }];
  assert.equal(abgleichen({ berichte: b, azureTokens: 130000 }).ueberschritten, false); // Grenze 130000
  assert.equal(abgleichen({ berichte: b, azureTokens: 130001 }).ueberschritten, true);
  assert.equal(abgleichen({ berichte: b, azureTokens: '50000' }).mehrGemeldet, true);
  for (const falsch of ['abc', '-1', '1.5', NaN, undefined, -1, '']) {
    assert.throws(() => abgleichen({ berichte: b, azureTokens: falsch }), /ganze Zahl/, String(falsch));
  }
  assert.throws(() => abgleichen({ berichte: b, azureTokens: 1, toleranz: { prozent: 101, tokens: 0 } }), /Prozent/);
  assert.equal(abgleichen({ berichte: [], azureTokens: 20001 }).ueberschritten, true); // keine Berichte = fail-closed
});

test('utcTag: nur echte Kalendertage', () => {
  assert.deepEqual(utcTag('2026-10-08'), { windowStart: WS, von: Date.parse(WS) / 1000, bis: Date.parse(WS) / 1000 + 86400 });
  for (const t of ['2026-02-30', '2026-10-8', '08.10.2026', '', undefined]) assert.throws(() => utcTag(t), /JJJJ-MM-TT/);
});

test('db.kiBerichteTag: je Box die letzte Zeile des Tages, andere Tage nicht', () => {
  const { db, speichere } = aufbau();
  speichere('box-a', 1000, 100);
  speichere('box-a', 1500, 200); // O-183: wächst → gleiche Zeile aktualisiert
  speichere('box-b', 700, 150);
  speichere('box-b', 9999, 300, '2026-10-07T00:00:00.000Z');
  const z = db.kiBerichteTag(WS);
  assert.deepEqual(z.map((r) => [r.box_id, berichtTokens(r.daten)]), [['box-a', 1500], ['box-b', 700]]);
});

test('ki-abgleich: im Rahmen → Exit 0, kein Schalten, Adminlog nur Zahlen', async () => {
  const { db, speichere } = aufbau();
  db.einstellungSetzen('ki_global', 'an');
  speichere('box-a', 100000, 100);
  const r = await lauf(db, ['ki-abgleich', TAG, '120000', '--abschalten']);
  assert.equal(r.exitCode, 0);
  assert.match(r.text, /Im Rahmen/);
  assert.equal(db.einstellungLesen('ki_global'), 'an');
  const d = JSON.parse(log(db, 'ki-abgleich')[0].details);
  assert.equal(d.gemeldet, 100000);
  assert.equal(d.abgeschaltet, false);
});

test('ki-abgleich ohne --abschalten: Überschreitung → Exit 2, Schalter bleibt (O-186 offen)', async () => {
  const { db, speichere } = aufbau();
  db.einstellungSetzen('ki_global', 'an');
  speichere('box-a', 100000, 100);
  const r = await lauf(db, ['ki-abgleich', TAG, '500000']);
  assert.equal(r.exitCode, 2);
  assert.match(r.text, /nur Bericht/);
  assert.equal(db.einstellungLesen('ki_global'), 'an');
});

test('ki-abgleich --abschalten: Überschreitung schaltet global aus (eigener Akteur), nie ein; Zuordnung ohne Bericht', async () => {
  const { db, speichere } = aufbau();
  db.einstellungSetzen('ki_global', 'an');
  speichere('box-a', 100000, 100);
  db.kiAusgabeEintragen({ boxId: 'box-c', zeit: Date.parse(WS) / 1000 + 3600, monat: '2026-10', exp: 0, entraExp: 0 });
  const r = await lauf(db, ['ki-abgleich', TAG, '500000', '--abschalten']);
  assert.equal(r.exitCode, 2);
  assert.equal(db.einstellungLesen('ki_global'), 'aus');
  assert.match(r.text, /kein Bericht: box-c/);
  const auto = log(db, 'ki-global');
  assert.equal(auto.length, 1);
  assert.equal(auto[0].akteur, 'ki-abgleich-auto');
  // zweiter Lauf: bereits aus → kein zweites Schalten
  const r2 = await lauf(db, ['ki-abgleich', TAG, '500000', '--abschalten']);
  assert.match(r2.text, /bereits aus/);
  assert.equal(log(db, 'ki-global').length, 1);
});

test('ki-abgleich: ungültige Eingaben werfen (CLI Exit 1), laufender Tag abgelehnt, Toleranz-Optionen', async () => {
  const { db, speichere } = aufbau();
  speichere('box-a', 100000, 100);
  await assert.rejects(lauf(db, ['ki-abgleich', TAG, 'viel']), /ganze Zahl/);
  await assert.rejects(lauf(db, ['ki-abgleich', TAG, '1', '--egal']), /Unbekannte Option/);
  await assert.rejects(lauf(db, ['ki-abgleich', TAG, '1'], Date.parse('2026-10-08T23:00:00Z')), /nicht abgeschlossen/);
  const r = await lauf(db, ['ki-abgleich', TAG, '100001', '--toleranz-prozent=0', '--toleranz-tokens=0']);
  assert.equal(r.exitCode, 2);
  assert.equal(log(db, 'ki-abgleich').length, 1); // nur der gültige Lauf protokolliert
});
