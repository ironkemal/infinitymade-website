// Prüfstand: Fälle aus offiziellen Quellen (wissensbank) gegen validateRezept().
// Jeder Fall trägt ein wörtliches Zitat; Zitate prüft tools/pruefstand-zitate.mjs.
// Status: aktiv = muss grün sein; bewusst/befund = todo (darf fehlschlagen, ohne den Lauf rot zu machen).
// Besteht ein bewusst/befund-Fall inzwischen, schlägt der Test "Befundliste aktuell" fehl:
// dann ist die Abweichung behoben und der Status gehört auf "aktiv" (PRUEFSTAND.md anpassen).
// Aufbau, Schema und Regeln: fixtures/pruefstand/PRUEFSTAND.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { validateRezept } from '../validate.js';

/**
 * @typedef {{
 *   id: string,
 *   titel?: string,
 *   status: string,
 *   grund?: string,
 *   eingabe: import('../validate.js').RezeptEingabe,
 *   erwartet?: {
 *     ok?: boolean,
 *     engine?: string,
 *     blocker_enthaelt?: string[],
 *     blocker_enthaelt_nicht?: string[],
 *     warnung_enthaelt?: string[],
 *     warnung_enthaelt_nicht?: string[],
 *     computed?: Record<string, unknown>
 *   },
 *   quelle?: { zitat?: string },
 *   engine_erwartet?: string
 * }} PruefstandFall
 */

const DIR = new URL('./fixtures/pruefstand/', import.meta.url);
const dateien = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
/** @type {PruefstandFall[]} */
const faelle = dateien.flatMap((f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8')));

const BEKANNT = new Set([
  'ok', 'engine', 'blocker_enthaelt', 'blocker_enthaelt_nicht',
  'warnung_enthaelt', 'warnung_enthaelt_nicht', 'computed',
]);

test('Prüfstand: Struktur (Dateien, eindeutige ids, Zitate)', () => {
  assert.ok(dateien.length >= 1, 'keine Fixture-Datei im Prüfstand-Ordner');
  const ids = faelle.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length, 'ids nicht eindeutig');
  for (const f of faelle) {
    assert.ok(f.quelle && typeof f.quelle.zitat === 'string' && f.quelle.zitat.trim().length > 0, `${f.id}: quelle.zitat fehlt`);
    if (f.erwartet && 'engine' in f.erwartet) assert.equal(f.erwartet.engine, f.engine_erwartet, `${f.id}: erwartet.engine ≠ engine_erwartet`);
    // Ein aktiver Fall braucht mindestens eine positive Erwartung, sonst wäre er grundlos grün.
    const e = f.erwartet || {};
    const positiv = 'ok' in e || (e.blocker_enthaelt || []).length > 0 || (e.warnung_enthaelt || []).length > 0
      || Object.keys(e.computed || {}).length > 0;
    assert.ok(positiv, `${f.id}: erwartet hat keine positive Erwartung (ok, *_enthaelt oder computed)`);
  }
});

// Zitate wörtlich in der Quelle? Läuft nur, wo wissensbank/ und das Werkzeug vorhanden sind
// (im Repo ja, im Docker-Image nicht).
const WERKZEUG = new URL('../../../../tools/pruefstand-zitate.mjs', import.meta.url);
test('Prüfstand: Zitate stehen wörtlich in der Quelle', { skip: !existsSync(WERKZEUG) && 'tools/ nicht vorhanden' }, async () => {
  const { pruefeZitate } = await import(WERKZEUG.href);
  const r = pruefeZitate({ minimum: true });
  assert.deepStrictEqual(r.fehler, [], r.fehler.join('\n'));
  assert.equal(r.zitateOk, r.gesamt);
});

/**
 * @param {PruefstandFall} fall
 */
function pruefe(fall) {
  const e = fall.erwartet || {};
  const unbekannt = Object.keys(e).filter((k) => !BEKANNT.has(k));
  assert.deepStrictEqual(unbekannt, [], `${fall.id}: unbekannte Schlüssel in erwartet: ${unbekannt.join(', ')}`);
  for (const k of /** @type {const} */ (['blocker_enthaelt', 'blocker_enthaelt_nicht', 'warnung_enthaelt', 'warnung_enthaelt_nicht'])) {
    if (k in e) assert.ok(Array.isArray(e[k]), `${fall.id}: erwartet.${k} muss ein Array sein`);
  }
  const r = validateRezept(fall.eingabe);
  const bl = (r.blockers || []).map((b) => b.code);
  const wa = (r.warnings || []).map((w) => w.code);
  const info = `${fall.id}: erhalten blockers=[${bl.join(', ')}] warnings=[${wa.join(', ')}] engine=${r.engine} ok=${r.ok}`;
  if ('ok' in e) assert.equal(r.ok, e.ok, `ok — ${info}`);
  if ('engine' in e) assert.equal(r.engine, e.engine, `engine — ${info}`);
  for (const c of e.blocker_enthaelt || []) assert.ok(bl.includes(c), `Blocker ${c} fehlt — ${info}`);
  for (const c of e.blocker_enthaelt_nicht || []) assert.ok(!bl.includes(c), `Blocker ${c} unerwartet — ${info}`);
  for (const c of e.warnung_enthaelt || []) assert.ok(wa.includes(c), `Warnung ${c} fehlt — ${info}`);
  for (const c of e.warnung_enthaelt_nicht || []) assert.ok(!wa.includes(c), `Warnung ${c} unerwartet — ${info}`);
  for (const [k, v] of Object.entries(e.computed || {})) {
    assert.deepStrictEqual((r.computed || {})[k], v, `computed.${k} — ${info}`);
  }
}

for (const fall of faelle) {
  const opts = fall.status === 'aktiv' ? {} : { todo: `${fall.id} [${fall.status}] ${fall.grund || ''}` };
  test(`${fall.id} — ${fall.titel}`, opts, () => pruefe(fall));
}

test('Prüfstand: Befundliste aktuell (kein bewusst/befund-Fall besteht inzwischen)', () => {
  const behoben = faelle.filter((f) => f.status !== 'aktiv').filter((f) => {
    try { pruefe(f); return true; } catch { return false; }
  }).map((f) => f.id);
  assert.deepStrictEqual(behoben, [], `Diese Fälle bestehen jetzt — Status auf "aktiv" setzen: ${behoben.join(', ')}`);
});
