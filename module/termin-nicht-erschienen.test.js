import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  markiereNichtErschienen,
  rebindeNoShowSitzungen,
  baueSessionLinks,
} from './termin-nicht-erschienen.js';

/**
 * Ein Supabase-Doppel, das genug kann fuer die drei Ketten dieses Moduls:
 *   select().eq().maybeSingle()          — Rueckfahrkarte lesen
 *   select().eq()                        — Sitzungszeilen des Termins
 *   update().eq()                        — Termin / Freigabe
 *   update().eq().is().select()          — Rueckbindung einer einzelnen Zeile
 *
 * Die Kette ist `then`-faehig, damit `await` an jeder Stelle endet, an der der
 * echte PostgREST-Client auch endet.
 */
function doppel({ sitzungen = [], links = [], linksLeseFehler = null, linksSchreibFehler = null } = {}) {
  const log = { termin: [], freigabe: [], rueckfahrkarte: [], gebunden: [] };
  const zeilen = sitzungen.map(s => ({ ...s }));

  function kette(tabelle, art, patch) {
    const f = {};
    const nicht = [];
    const passt = (s) => s.booking_id === f.booking_id && nicht.every(([sp, w]) => s[sp] !== w);
    const ergebnis = () => {
      if (art === 'select') {
        if (tabelle === 'prescription_sessions') {
          return { data: zeilen.filter(passt), error: null };
        }
        if (linksLeseFehler) return { data: null, error: linksLeseFehler };
        return { data: { no_show_session_links: links }, error: null };
      }
      if (tabelle === 'bookings') {
        if ('no_show_session_links' in patch) {
          if (linksSchreibFehler) return { data: null, error: linksSchreibFehler };
          log.rueckfahrkarte.push(patch.no_show_session_links);
        } else {
          log.termin.push(patch);
        }
        return { data: null, error: null };
      }
      // prescription_sessions.update — mit `id` ist es die Rueckbindung einer
      // einzelnen Zeile, mit `booking_id` die Freigabe aller Zeilen des Termins.
      if (f.id) {
        const s = zeilen.find(x => x.id === f.id);
        const frei = !!s && s.booking_id == null;
        if (frei) { Object.assign(s, patch); log.gebunden.push(f.id); }
        return { data: frei ? [{ id: f.id }] : [], error: null };
      }
      log.freigabe.push(patch);
      for (const s of zeilen) if (passt(s)) Object.assign(s, patch);
      return { data: null, error: null };
    };
    const k = {
      select: () => k,
      eq: (sp, v) => { f[sp] = v; return k; },
      neq: (sp, v) => { nicht.push([sp, v]); return k; },
      is: (sp, v) => { f[sp] = v; return k; },
      maybeSingle: () => Promise.resolve(ergebnis()),
      then: (ok, fehler) => Promise.resolve(ergebnis()).then(ok, fehler),
    };
    return k;
  }

  return {
    log,
    zeilen,
    supabase: {
      from: (tabelle) => ({
        select: () => kette(tabelle, 'select'),
        update: (patch) => kette(tabelle, 'update', patch),
      }),
    },
  };
}

const KEIN_FORTSCHRITT = async () => null;

// --- baueSessionLinks ---

test('die Momentaufnahme traegt dieselben vier Felder wie #192', () => {
  const links = baueSessionLinks([
    { id: 's1', prescription_id: 'rx1', session_number: 3, heilmittel_index: 0, status: 'planned' },
  ]);
  assert.deepEqual(links, [
    { session_id: 's1', prescription_id: 'rx1', session_number: 3, heilmittel_index: 0 },
  ]);
});

test('Zeilen ohne id kommen nicht in die Momentaufnahme', () => {
  assert.deepEqual(baueSessionLinks([{ prescription_id: 'rx1' }, null]), []);
});

// --- markiereNichtErschienen ---

test('Termin wird festgeschrieben und die Einheit freigegeben', async () => {
  const d = doppel({ sitzungen: [{ id: 's1', booking_id: 'b1', prescription_id: 'rx1', session_number: 3, status: 'planned' }] });
  const r = await markiereNichtErschienen({ supabase: d.supabase }, { id: 'b1' }, {
    grund: 'verschlafen', fortschritt: KEIN_FORTSCHRITT,
  });

  assert.equal(d.log.termin[0].status, 'no_show');
  assert.equal(d.log.termin[0].no_show, true);
  assert.ok(d.log.termin[0].no_show_noted_at);
  assert.equal(d.log.termin[0].cancellation_reason, 'verschlafen');

  // Die Einheit gehoert zurueck in den Topf: kein Termin, wieder 'planned'.
  assert.deepEqual(d.log.freigabe[0], { booking_id: null, status: 'planned' });
  assert.equal(d.zeilen[0].booking_id, null);
  assert.equal(d.zeilen[0].status, 'planned');
  assert.equal(r.freigegeben, 1);
  assert.equal(r.rueckfahrkarte, true);
  assert.deepEqual(r.rezepte, ['rx1']);
});

test('die Rueckfahrkarte wird geschrieben, bevor die Einheit frei wird', async () => {
  const d = doppel({ sitzungen: [{ id: 's1', booking_id: 'b1', prescription_id: 'rx1', session_number: 3, status: 'planned' }] });
  await markiereNichtErschienen({ supabase: d.supabase }, { id: 'b1' }, { fortschritt: KEIN_FORTSCHRITT });
  assert.deepEqual(d.log.rueckfahrkarte[0], [
    { session_id: 's1', prescription_id: 'rx1', session_number: 3, heilmittel_index: null },
  ]);
});

test('bestehende Eintraege bleiben stehen — es wird angehaengt', async () => {
  // Ein Termin kann durch Korrektur und zurueck laufen. Ueberschreiben wuerde
  // die Rueckfahrkarte des ersten Durchlaufs vernichten.
  const alt = { session_id: 's0', prescription_id: 'rx1', session_number: 1, heilmittel_index: null };
  const d = doppel({
    links: [alt],
    sitzungen: [{ id: 's1', booking_id: 'b1', prescription_id: 'rx1', session_number: 3, status: 'planned' }],
  });
  await markiereNichtErschienen({ supabase: d.supabase }, { id: 'b1' }, { fortschritt: KEIN_FORTSCHRITT });
  assert.equal(d.log.rueckfahrkarte[0].length, 2);
  assert.deepEqual(d.log.rueckfahrkarte[0][0], alt);
});

test('ohne Rueckfahrkarte bleibt die Einheit am Termin (altes Verhalten)', async () => {
  // Alte Box, Migration 0016 noch nicht gelaufen: lieber die bekannte Unschaerfe
  // als eine Einheit, die die Korrektur nicht mehr findet.
  const d = doppel({
    linksSchreibFehler: { message: 'column does not exist' },
    sitzungen: [{ id: 's1', booking_id: 'b1', prescription_id: 'rx1', status: 'planned' }],
  });
  const r = await markiereNichtErschienen({ supabase: d.supabase }, { id: 'b1' }, { fortschritt: KEIN_FORTSCHRITT });
  assert.deepEqual(d.log.freigabe[0], { status: 'no_show' });
  assert.equal(d.zeilen[0].booking_id, 'b1');
  assert.equal(r.freigegeben, 0);
  assert.equal(r.rueckfahrkarte, false);
  // Der Termin selbst ist trotzdem geschrieben — daran darf nichts scheitern.
  assert.equal(d.log.termin[0].status, 'no_show');
});

test('auch ein Lesefehler auf der Linkspalte faellt auf das alte Verhalten zurueck', async () => {
  const d = doppel({
    linksLeseFehler: { message: 'column does not exist' },
    sitzungen: [{ id: 's1', booking_id: 'b1', prescription_id: 'rx1', status: 'planned' }],
  });
  const r = await markiereNichtErschienen({ supabase: d.supabase }, { id: 'b1' }, { fortschritt: KEIN_FORTSCHRITT });
  assert.equal(r.rueckfahrkarte, false);
  assert.deepEqual(d.log.freigabe[0], { status: 'no_show' });
});

test('Podologie-Termin ohne Sitzungszeilen: nur der Status, keine Freigabe', async () => {
  // Die Podologie zaehlt ueber bookings.verordnung_id, nicht ueber sessions.
  const d = doppel({ sitzungen: [] });
  const r = await markiereNichtErschienen({ supabase: d.supabase }, { id: 'b1' }, { fortschritt: KEIN_FORTSCHRITT });
  assert.equal(d.log.termin[0].status, 'no_show');
  assert.equal(d.log.freigabe.length, 0);
  assert.equal(d.log.rueckfahrkarte.length, 0);
  assert.deepEqual(r.rezepte, []);
});

test('eine abgesagte Sitzungszeile wird nicht wiederbelebt', async () => {
  // Der #192-Waechter laesst eine 'cancelled'-Zeile mit booking_id zu. Wuerde
  // der Ausfall sie auf 'planned' setzen, waere aus einer abgesagten Einheit
  // stillschweigend wieder eine offene geworden.
  const d = doppel({
    sitzungen: [
      { id: 's1', booking_id: 'b1', prescription_id: 'rx1', status: 'cancelled' },
      { id: 's2', booking_id: 'b1', prescription_id: 'rx1', status: 'planned' },
    ],
  });
  const r = await markiereNichtErschienen({ supabase: d.supabase }, { id: 'b1' }, { fortschritt: KEIN_FORTSCHRITT });
  assert.equal(r.freigegeben, 1);
  assert.equal(d.zeilen[0].status, 'cancelled');
  assert.equal(d.zeilen[0].booking_id, 'b1');
  assert.equal(d.zeilen[1].booking_id, null);
  assert.deepEqual(d.log.rueckfahrkarte[0].map(l => l.session_id), ['s2']);
});

test('leerer Grund schreibt keine cancellation_reason', async () => {
  const d = doppel({ sitzungen: [] });
  await markiereNichtErschienen({ supabase: d.supabase }, { id: 'b1' }, { grund: '   ', fortschritt: KEIN_FORTSCHRITT });
  assert.equal('cancellation_reason' in d.log.termin[0], false);
});

test('der Fortschritt wird je betroffener Verordnung genau einmal geprueft', async () => {
  const d = doppel({
    sitzungen: [
      { id: 's1', booking_id: 'b1', prescription_id: 'rx1', status: 'planned' },
      { id: 's2', booking_id: 'b1', prescription_id: 'rx1', status: 'planned' },
    ],
  });
  const gesehen = [];
  await markiereNichtErschienen({ supabase: d.supabase }, { id: 'b1' }, {
    fortschritt: async (_sb, id) => { gesehen.push(id); },
  });
  assert.deepEqual(gesehen, ['rx1']);
});

test('ein Fehler in der Fortschrittspruefung dreht den Vorgang nicht zurueck', async () => {
  const d = doppel({ sitzungen: [{ id: 's1', booking_id: 'b1', prescription_id: 'rx1', status: 'planned' }] });
  const r = await markiereNichtErschienen({ supabase: d.supabase }, { id: 'b1' }, {
    fortschritt: async () => { throw new Error('netz'); },
  });
  assert.equal(r.freigegeben, 1);
  assert.equal(d.zeilen[0].booking_id, null);
});

test('ohne Termin-Id passiert nichts', async () => {
  const d = doppel();
  await assert.rejects(() => markiereNichtErschienen({ supabase: d.supabase }, null), /Termin fehlt/);
});

// --- rebindeNoShowSitzungen ---

test('die Korrektur holt die freigegebene Einheit zurueck und zaehlt sie als erbracht', async () => {
  const d = doppel({
    links: [{ session_id: 's1', prescription_id: 'rx1', session_number: 3, heilmittel_index: null }],
    sitzungen: [{ id: 's1', booking_id: null, prescription_id: 'rx1', status: 'planned' }],
  });
  const r = await rebindeNoShowSitzungen(d.supabase, { id: 'b1' }, { fortschritt: KEIN_FORTSCHRITT });
  assert.equal(r.wiederverbunden, 1);
  assert.equal(d.zeilen[0].booking_id, 'b1');
  assert.equal(d.zeilen[0].status, 'done');
});

test('eine inzwischen neu verplante Einheit wird uebersprungen, nicht ueberschrieben', async () => {
  // Zwischen no_show und Korrektur koennen Tage liegen. Haengt die Einheit
  // inzwischen an einem Nachholtermin, gehoert sie dorthin.
  const d = doppel({
    links: [{ session_id: 's1', prescription_id: 'rx1', session_number: 3 }],
    sitzungen: [{ id: 's1', booking_id: 'b-neu', prescription_id: 'rx1', status: 'planned' }],
  });
  const r = await rebindeNoShowSitzungen(d.supabase, { id: 'b1' }, { fortschritt: KEIN_FORTSCHRITT });
  assert.equal(r.wiederverbunden, 0);
  assert.equal(r.uebersprungen, 1);
  assert.equal(d.zeilen[0].booking_id, 'b-neu');
});

test('doppelte Eintraege binden die Zeile nur einmal', async () => {
  const eintrag = { session_id: 's1', prescription_id: 'rx1', session_number: 3 };
  const d = doppel({
    links: [eintrag, eintrag],
    sitzungen: [{ id: 's1', booking_id: null, prescription_id: 'rx1', status: 'planned' }],
  });
  const r = await rebindeNoShowSitzungen(d.supabase, { id: 'b1' }, { fortschritt: KEIN_FORTSCHRITT });
  assert.equal(r.wiederverbunden, 1);
  assert.deepEqual(d.log.gebunden, ['s1']);
});

test('fehlt die Spalte, tut die Korrektur hier nichts — und stuerzt nicht ab', async () => {
  const d = doppel({ linksLeseFehler: { message: 'column does not exist' } });
  const r = await rebindeNoShowSitzungen(d.supabase, { id: 'b1' }, { fortschritt: KEIN_FORTSCHRITT });
  assert.deepEqual(r, { wiederverbunden: 0, uebersprungen: 0 });
});

test('die Fortschrittspruefung laeuft auch in der Gegenrichtung', async () => {
  const d = doppel({
    links: [{ session_id: 's1', prescription_id: 'rx1', session_number: 3 }],
    sitzungen: [{ id: 's1', booking_id: null, prescription_id: 'rx1', status: 'planned' }],
  });
  const gesehen = [];
  await rebindeNoShowSitzungen(d.supabase, { id: 'b1' }, { fortschritt: async (_sb, id) => { gesehen.push(id); } });
  assert.deepEqual(gesehen, ['rx1']);
});
