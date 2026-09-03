import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  spalteAusZeilen,
  ermittleKostentraegerSpalte,
  kostentraegerSpalteDa,
  _spaltenwissenZuruecksetzen,
} from './kostentraeger-spalte.js';

beforeEach(() => _spaltenwissenZuruecksetzen());

/**
 * Ein Supabase-Doppel, das nur `from().select().limit()` kann — und dabei das
 * ECHTE PostgREST nachahmt, nicht ein bequemes Wunschbild.
 *
 * Der Unterschied ist nicht akademisch: die erste Fassung dieses Doppels gab
 * bei jedem Aufruf brav `{ code: '42703' }` zurueck, egal wie gefragt wurde.
 * Damit sah eine Sonde mit `{ head: true }` gruen aus, die gegen echtes
 * PostgREST NIE einen Code bekommt (HEAD-Antworten haben keinen Rumpf). Am
 * 03.09.2026 gegen ein PostgREST im Docker gemessen:
 *
 *   HEAD + fehlende Spalte -> 400, error = { message: '' }  ← kein code
 *   GET  + fehlende Spalte -> 400, error.code = '42703'
 *
 * Deshalb verschluckt das Doppel den Code bei `head`, genau wie das Original.
 */
function clientDoppel({ fehler = null, verzoegern = false } = {}) {
  const aufrufe = [];
  const optionen = [];
  const grenzen = [];
  let loesen;
  const tor = verzoegern ? new Promise(r => { loesen = r; }) : null;
  return {
    aufrufe, optionen, grenzen,
    freigeben: () => loesen && loesen(),
    from(tabelle) {
      aufrufe.push(tabelle);
      return {
        select: (spalten, opt) => {
          optionen.push(opt);
          return {
            limit: async (n) => {
              grenzen.push(n);
              if (tor) await tor;
              if (!fehler) return { data: [], error: null };
              // HEAD liefert keinen Rumpf -> der Client sieht keinen Code.
              const durchgereicht = opt && opt.head ? { message: '' } : fehler;
              return { data: null, error: durchgereicht };
            },
          };
        },
      };
    },
  };
}

test('Zeilen mit der Spalte sind Beweis genug', () => {
  assert.equal(spalteAusZeilen([{ id: '1', kostentraeger_typ: null }]), true);
});

test('Zeilen ohne die Spalte sind ebenfalls Beweis', () => {
  // select('*') liefert jede vorhandene Spalte mit, auch wenn ihr Wert NULL ist.
  // Fehlt der Schluessel, gibt es die Spalte nicht.
  assert.equal(spalteAusZeilen([{ id: '1', title: 'KG' }]), false);
});

test('keine Zeile beweist gar nichts', () => {
  // Genau der Fall, an dem die alte Einzeiler-Pruefung scheiterte:
  // [].some() ist false, was faelschlich "Spalte fehlt" hiess.
  assert.equal(spalteAusZeilen([]), null);
  assert.equal(spalteAusZeilen(null), null);
  assert.equal(spalteAusZeilen(undefined), null);
});

test('bei vorhandenen Zeilen wird nicht nachgefragt', async () => {
  const client = clientDoppel();
  assert.equal(await ermittleKostentraegerSpalte([{ id: '1', kostentraeger_typ: 'bg' }], client), true);
  assert.deepEqual(client.aufrufe, [], 'keine zusaetzliche Abfrage noetig');
  assert.equal(kostentraegerSpalteDa(), true);
});

test('leere Praxis: eine Abfrage, und die Spalte gibt es', async () => {
  const client = clientDoppel();
  assert.equal(await ermittleKostentraegerSpalte([], client), true);
  assert.deepEqual(client.aufrufe, ['services']);
  assert.equal(kostentraegerSpalteDa(), true);
});

test('leere Praxis: PostgREST meldet die fehlende Spalte', async () => {
  const client = clientDoppel({ fehler: { code: '42703', message: 'column services.kostentraeger_typ does not exist' } });
  assert.equal(await ermittleKostentraegerSpalte([], client), false);
  assert.equal(kostentraegerSpalteDa(), false);
});

test('festgestellt wird nur einmal je Sitzung', async () => {
  const client = clientDoppel();
  await ermittleKostentraegerSpalte([], client);
  await ermittleKostentraegerSpalte([], client);
  await ermittleKostentraegerSpalte([], client);
  assert.equal(client.aufrufe.length, 1, 'keine wiederholten Abfragen');
});

test('ein geworfener Fehler blendet das Feld aus, statt abzustuerzen', async () => {
  const kaputt = { from() { throw new Error('offline'); } };
  assert.equal(await ermittleKostentraegerSpalte([], kaputt), false);
});

test('ohne Client bleibt das Feld aus', async () => {
  assert.equal(await ermittleKostentraegerSpalte([], null), false);
});

test('vor der ersten Feststellung ist die Antwort false, nicht undefined', () => {
  // Der Speicherpfad haengt daran: ein `undefined` waere falsy und damit
  // zufaellig richtig — aber nur zufaellig.
  assert.equal(kostentraegerSpalteDa(), false);
});

// ── Falle (a): nicht jeder Fehler heisst "Spalte fehlt" ─────────────────────

test('ein Netzfehler wird NICHT als fehlende Spalte eingebrannt', async () => {
  // supabase-js wirft bei Netzfehlern nicht, sondern liefert ebenfalls
  // { error } — im vendorten Client steht FetchError, 42703 kommt dort gar
  // nicht vor. Wuerde man `bekannt = !error` setzen, waere ein einziger
  // Offline-Moment fuer die ganze Sitzung bindend.
  const client = clientDoppel({ fehler: { message: 'FetchError: failed to fetch', code: '' } });
  assert.equal(await ermittleKostentraegerSpalte([], client), false, 'sichere Seite: Feld aus');
  assert.equal(await ermittleKostentraegerSpalte([], client), false);
  assert.equal(client.aufrufe.length, 2, 'unklare Lage wird NICHT gemerkt, es wird neu gefragt');
});

test('nach einem Netzfehler gilt eine spaetere klare Antwort', async () => {
  const kaputt = clientDoppel({ fehler: { message: 'FetchError', code: '' } });
  await ermittleKostentraegerSpalte([], kaputt);
  assert.equal(kostentraegerSpalteDa(), false);

  const heil = clientDoppel();
  assert.equal(await ermittleKostentraegerSpalte([], heil), true);
  assert.equal(kostentraegerSpalteDa(), true);
});

test('nur 42703 heisst wirklich "Spalte fehlt" — und wird gemerkt', async () => {
  const client = clientDoppel({ fehler: { code: '42703', message: 'column ... does not exist' } });
  assert.equal(await ermittleKostentraegerSpalte([], client), false);
  await ermittleKostentraegerSpalte([], client);
  assert.equal(client.aufrufe.length, 1, 'eindeutige Antwort wird gemerkt');
});

// ── Falle (b): zwei Ladevorgaenge koennen sich ueberholen ───────────────────

test('gleichzeitige Aufrufe teilen sich EINE Sonde', async () => {
  // loadServices() wird an zwei Stellen ohne await gestartet
  // (dashboard.js:1154, :17367) — Ueberlappung ist real, nicht theoretisch.
  const client = clientDoppel({ verzoegern: true });
  const beide = Promise.all([
    ermittleKostentraegerSpalte([], client),
    ermittleKostentraegerSpalte([], client),
  ]);
  client.freigeben();
  assert.deepEqual(await beide, [true, true]);
  assert.equal(client.aufrufe.length, 1, 'nicht zwei Abfragen');
});

test('eine spaete Sonde ueberschreibt kein bereits richtiges Ergebnis', async () => {
  // Aufruf B startet bei leerem Cache eine Sonde. Waehrend sie laeuft, liefert
  // Aufruf A aus echten Zeilen die Antwort. Die Sonde darf sie nicht kippen.
  const client = clientDoppel({ verzoegern: true, fehler: { code: '42703' } });
  const spaet = ermittleKostentraegerSpalte([], client);

  await ermittleKostentraegerSpalte([{ id: '1', kostentraeger_typ: null }], client);
  assert.equal(kostentraegerSpalteDa(), true, 'aus Zeilen abgeleitet');

  client.freigeben();
  await spaet;
  assert.equal(kostentraegerSpalteDa(), true, 'die Sonde hat es NICHT gekippt');
});

// ── Falle (c): die Aufrufform der Sonde ist nicht beliebig ──────────────────

test('die Sonde fragt per GET mit limit(0) — nicht mit head', async () => {
  // Beides zusammen ist noetig und beides hat einen Grund:
  //   limit(0)  -> PostgREST prueft die Spaltenliste, liefert aber keine Zeile.
  //               Ohne das laese die Sonde bei leerer Praxis den Datensatz
  //               einer FREMDEN Praxis (Policy "Public read services").
  //   kein head -> HEAD-Antworten haben keinen Rumpf, also kaeme der Fehlercode
  //               nie beim Client an, und nichts wuerde je gemerkt.
  const client = clientDoppel();
  await ermittleKostentraegerSpalte([], client);
  assert.deepEqual(client.grenzen, [0], 'limit(0), nicht limit(1)');
  assert.ok(!client.optionen[0] || !client.optionen[0].head, 'kein head:true');
});

test('mit head:true waere die Erkennung kaputt — der Nachweis', async () => {
  // Kein Vorwurf an die Zukunft, sondern eine Falle mit Schild: wer hier
  // head:true einbaut, bekommt einen Fehler ohne Code. Das Doppel bildet das
  // nach (gegen echtes PostgREST gemessen). Der Test zeigt, was dann passiert.
  const client = clientDoppel({ fehler: { code: '42703', message: 'column ... does not exist' } });
  const ohneCode = await client.from('services').select('kostentraeger_typ', { head: true }).limit(0);
  assert.equal(ohneCode.error.code, undefined, 'HEAD verschluckt den Code');

  const mitCode = await client.from('services').select('kostentraeger_typ').limit(0);
  assert.equal(mitCode.error.code, '42703', 'GET liefert ihn');
});
