/**
 * Tests für den Fußbefund-Verlauf — `gruppiereBefunde()` aus fussbefund.js.
 *
 * Warum ausgerechnet diese Funktion (30.08.2026)
 * ----------------------------------------------
 * Bis zum 30.08.2026 hat das Speichern eines offenen Befunds ein UPDATE
 * ausgelöst: der Stand von letzter Woche war danach weg. Jetzt entsteht bei
 * jedem Speichern eine neue Zeile, und `gruppiereBefunde()` ist die einzige
 * Stelle, die aus diesen flachen Zeilen wieder „ein Befund und seine
 * Fassungen" macht.
 *
 * Geht sie kaputt, sieht man das nicht an einem Fehler, sondern daran, dass
 * eine Fassung in der Liste fehlt oder eine falsche als die gültige gilt —
 * in einer Behandlungsdokumentation der teuerste Fehler, den es hier gibt.
 * Deshalb steht sie unter Test und nicht die Darstellung darum herum.
 *
 * Die zwei Achsen, die nie zusammenfallen dürfen:
 *   eintrag_id  derselbe Befund, nochmal gespeichert (Korrektur)
 *   serie_id    Farbgruppe über Termine hinweg (klinischer Verlauf)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gruppiereBefunde, SERIE_FARBEN } from './fussbefund.js';

const BLAU = SERIE_FARBEN[0];
const ROT  = SERIE_FARBEN[1];

/** Eine Zeile, wie sie aus `pat_fussbefund` käme. */
function zeile(o) {
  return {
    id: o.id,
    eintrag_id: o.eintrag_id || o.id,
    version: o.version || 1,
    ist_aktuell: o.ist_aktuell !== false,
    serie_id: o.serie_id || o.id,
    serie_farbe: o.serie_farbe || BLAU,
    erstellt_am: o.erstellt_am,
    created_at: o.created_at || o.erstellt_am,
    uebernommen_von: o.uebernommen_von || null,
    booking_id: o.booking_id || null,
    befund: o.befund || {},
    markierungen: o.markierungen || [],
  };
}

test('drei Fassungen desselben Termins bleiben EIN Eintrag', () => {
  const rows = [
    zeile({ id: 'a3', eintrag_id: 'a1', version: 3, erstellt_am: '2026-08-30T09:00:00Z' }),
    zeile({ id: 'a2', eintrag_id: 'a1', version: 2, ist_aktuell: false, erstellt_am: '2026-08-30T09:00:00Z' }),
    zeile({ id: 'a1', eintrag_id: 'a1', version: 1, ist_aktuell: false, erstellt_am: '2026-08-30T09:00:00Z' }),
  ];

  const serien = gruppiereBefunde(rows);
  assert.equal(serien.length, 1, 'eine Serie');
  assert.equal(serien[0].eintraege.length, 1, 'ein Eintrag, nicht drei');
  assert.equal(serien[0].eintraege[0].versionen.length, 3);
});

test('Kopf eines Eintrags ist die gültige Fassung, nicht die zuerst geladene', () => {
  // Absichtlich in falscher Reihenfolge: PostgREST sortiert nach erstellt_am,
  // und das ist bei allen Fassungen identisch — die Reihenfolge ist beliebig.
  const rows = [
    zeile({ id: 'a1', eintrag_id: 'a1', version: 1, ist_aktuell: false, erstellt_am: '2026-08-30T09:00:00Z' }),
    zeile({ id: 'a3', eintrag_id: 'a1', version: 3, erstellt_am: '2026-08-30T09:00:00Z' }),
    zeile({ id: 'a2', eintrag_id: 'a1', version: 2, ist_aktuell: false, erstellt_am: '2026-08-30T09:00:00Z' }),
  ];

  const eintrag = gruppiereBefunde(rows)[0].eintraege[0];
  assert.equal(eintrag.kopf.id, 'a3', 'die gültige Fassung führt den Eintrag an');
  assert.deepEqual(eintrag.versionen.map(v => v.version), [3, 2, 1], 'neueste zuerst');
});

test('zwei Termine derselben Serie teilen die Farbe und stehen im selben Block', () => {
  const rows = [
    zeile({ id: 'b1', serie_id: 'a1', serie_farbe: BLAU, uebernommen_von: 'a1', erstellt_am: '2026-08-23T09:00:00Z' }),
    zeile({ id: 'a1', serie_id: 'a1', serie_farbe: BLAU, erstellt_am: '2026-08-16T09:00:00Z' }),
  ];

  const serien = gruppiereBefunde(rows);
  assert.equal(serien.length, 1);
  assert.equal(serien[0].farbe, BLAU);
  assert.equal(serien[0].eintraege.length, 2, 'zwei Sitzungen, ein Farbblock');
  assert.deepEqual(serien[0].eintraege.map(e => e.kopf.id), ['b1', 'a1'], 'neuester Termin oben');
});

test('eine neu begonnene Serie ist ein eigener Block mit eigener Farbe', () => {
  const rows = [
    zeile({ id: 'c1', serie_id: 'c1', serie_farbe: ROT,  erstellt_am: '2026-08-30T09:00:00Z' }),
    zeile({ id: 'a1', serie_id: 'a1', serie_farbe: BLAU, erstellt_am: '2026-08-16T09:00:00Z' }),
  ];

  const serien = gruppiereBefunde(rows);
  assert.deepEqual(serien.map(s => s.farbe), [ROT, BLAU], 'jüngste Serie oben');
  assert.equal(serien.every(s => s.eintraege.length === 1), true);
});

test('Serien sortieren nach ihrem jüngsten Eintrag, nicht nach ihrem Beginn', () => {
  // Die ältere Serie wurde zuletzt fortgeschrieben — sie gehört nach oben.
  const rows = [
    zeile({ id: 'a2', serie_id: 'a1', serie_farbe: BLAU, uebernommen_von: 'a1', erstellt_am: '2026-08-30T09:00:00Z' }),
    zeile({ id: 'c1', serie_id: 'c1', serie_farbe: ROT,  erstellt_am: '2026-08-20T09:00:00Z' }),
    zeile({ id: 'a1', serie_id: 'a1', serie_farbe: BLAU, erstellt_am: '2026-06-02T09:00:00Z' }),
  ];

  const serien = gruppiereBefunde(rows);
  assert.deepEqual(serien.map(s => s.farbe), [BLAU, ROT]);
  assert.equal(new Date(serien[0].beginn).toISOString(), '2026-06-02T09:00:00.000Z',
    'der Beginn bleibt das älteste Datum der Serie');
});

test('Altbestand ohne die neuen Spalten fällt nicht heraus', () => {
  // Zeilen, die vor der Migration geschrieben wurden und deren Backfill
  // ausgeblieben wäre: kein eintrag_id, kein Flag, keine Farbe.
  const rows = [
    { id: 'alt1', erstellt_am: '2026-07-01T09:00:00Z', befund: {}, markierungen: [] },
    { id: 'alt2', erstellt_am: '2026-07-08T09:00:00Z', befund: {}, markierungen: [] },
  ];

  const serien = gruppiereBefunde(rows);
  assert.equal(serien.length, 2, 'jede Zeile ist ihre eigene Serie');
  assert.equal(serien.every(s => s.eintraege[0].versionen.length === 1), true);
  assert.equal(serien.every(s => !!s.farbe), true, 'nie ohne Farbe — sonst kein Rahmen');
});

test('leere Liste ergibt keine Serie und wirft nicht', () => {
  assert.deepEqual(gruppiereBefunde([]), []);
});
