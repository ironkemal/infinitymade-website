import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { serienDaten, serienAnzahl, serienKnopfText, anzahlHinweisText } from './serien-termine.js';

// 2026-09-16 ist ein Mittwoch (Wochentag 3).
test('wöchentlich, ein Wochentag — sieben Tage Abstand', () => {
  assert.deepEqual(
    serienDaten({ startDatum: '2026-09-16', anzahl: 3, intervalDays: 7, wochentage: [3] }),
    ['2026-09-16', '2026-09-23', '2026-09-30'],
  );
});

test('Manuelle Serie ordnet nur erstellte Termine der ausgewählten Verordnung zu', async () => {
  const dashboard = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
  const start = dashboard.indexOf("document.getElementById('bkSaveBtn').addEventListener('click', async () => {");
  const ende = dashboard.indexOf('// "Offene Einheiten als Serie verteilen"', start);
  /** @type {Record<string, {value?: string, checked?: boolean}>} */
  const felder = {
    'bk-id': { value: '' }, bkEmployee: { value: 'therapeut' }, bkService: { value: 'leistung' },
    bkStart: { value: '2026-12-22T10:00' }, bkCustomer: { value: 'Synthetisch' }, bkCustomerId: { value: 'patient' },
    bkPhone: { value: '' }, bkNotes: { value: '' }, bkSelectedRxId: { value: 'physio-rezept' },
    bkHausbesuch: { checked: false }, bkSeriesToggle: { checked: true }, bkAnzahl: { value: '2' },
  };
  const erstellte = [{ id: 'termin-1', start_time: '2026-12-22T09:00:00Z' }];
  /** @type {{ id: string, termine: typeof erstellte }[]} */
  const links = [];
  /** @type {() => Promise<void>} */
  let speichern = async () => assert.fail('Speichern-Handler fehlt');
  /** @type {{slots: object[]}} */
  let gesendet = { slots: [] };
  let bestaetigung = { createdCount: 0, conflictCount: 0 };

  runInNewContext(dashboard.slice(start, ende), {
    document: { getElementById: (/** @type {string} */ id) => id === 'bkSaveBtn'
      ? { addEventListener: (/** @type {string} */ _, /** @type {typeof speichern} */ listener) => { speichern = listener; } }
      : felder[id] },
    checkPlanActive: () => true,
    loescheTerminFehler() {},
    raumFelder: () => ({ room_id: null }),
    parseNameMitGeburt: (/** @type {string} */ name) => ({ name }),
    window: { _physioFlow: { prescription_id: 'alte-verordnung' }, _bkGewaehlteRx: { id: 'physio-rezept' } },
    pruefeFrequenz: async () => ({ ok: true }),
    pruefeErsttermin: async () => ({ ok: true }),
    leseDauer: () => 25,
    computeSeriesPreview: () => ['2026-12-22', '2026-12-29'],
    serieFreigabe: async (/** @type {object[]} */ slots) => slots,
    getOwnerId: () => 'praxis',
    currentBusiness: null,
    API: '/api',
    supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'synthetisch' } } }) } },
    fetch: async (/** @type {string} */ url, /** @type {{body: string}} */ { body }) => {
      assert.equal(url, '/api/booking/batch-create-explicit');
      gesendet = JSON.parse(body);
      return { ok: true, json: async () => ({ created: erstellte, conflicts: [{ slot: gesendet.slots[1] }] }) };
    },
    speichereLeistungenFuerErstellte: async () => {},
    showToast() {},
    closeModal() {},
    refreshBookingViews: async () => {},
    linkBookingsToPrescriptionSessions: async (/** @type {string} */ id, /** @type {typeof erstellte} */ termine) => { links.push({ id, termine }); },
    showSeriterminConfirmDialog: (/** @type {typeof bestaetigung} */ info) => { bestaetigung = info; },
  });

  await speichern();
  assert.equal(gesendet.slots.length, 2);
  assert.deepEqual(links, [{ id: 'physio-rezept', termine: erstellte }]);
  assert.equal(bestaetigung.createdCount, 1);
  assert.equal(bestaetigung.conflictCount, 1);

  felder.bkSelectedRxId.value = '';
  await speichern();
  assert.equal(links.length, 1);
});

test('Serienzuordnung behält parallel vergebene Sitzungen und meldet Teilfehler', async () => {
  const dashboard = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
  const start = dashboard.indexOf('async function linkBookingsToPrescriptionSessions(');
  const ende = dashboard.indexOf('async function maybeOfferAppointmentConfirmEmail(', start);
  const sitzungen = new Map([['s1', 'parallel'], ['s2', null]]);
  /** @type {string[]} */
  const gemeldet = [];
  const from = (/** @type {string} */ tabelle) => {
    let id = '';
    let nurOffene = false;
    let nurGeplante = false;
    let bookingId = '';
    const abfrage = {
      select: () => abfrage,
      eq(/** @type {string} */ feld, /** @type {string} */ wert) {
        if (feld === 'id') id = wert;
        if (feld === 'status') nurGeplante = wert === 'planned';
        return abfrage;
      },
      is(/** @type {string} */ feld, /** @type {null} */ wert) {
        nurOffene = feld === 'booking_id' && wert === null;
        return abfrage;
      },
      not: () => ({ count: 0 }),
      maybeSingle: () => ({ data: { status: 'confirmed' } }),
      order: () => ({ data: [{ id: 's1' }, { id: 's2' }] }),
      update(/** @type {{booking_id: string}} */ daten) { bookingId = daten.booking_id; return abfrage; },
      then: (/** @type {(r: {data: {id: string}[]}) => void} */ fertig) => {
        assert.equal(tabelle, 'prescription_sessions');
        assert.equal(nurGeplante, true);
        assert.equal(nurOffene, true);
        if (sitzungen.get(id) !== null) return fertig({ data: [] });
        sitzungen.set(id, bookingId);
        fertig({ data: [{ id }] });
      },
    };
    return abfrage;
  };
  const verknuepfen = runInNewContext(`${dashboard.slice(start, ende)}\nlinkBookingsToPrescriptionSessions`, {
    supabase: { from },
    meldePodoSerienBindung: async () => false,
    getOwnerId: () => 'praxis',
    gleicheSitzungenAb: async () => ({}),
    terminZielToplam: () => 6,
    emit: (/** @type {string} */ meldung) => gemeldet.push(meldung),
    showToast: (/** @type {string} */ meldung) => gemeldet.push(meldung),
    console,
  });

  await verknuepfen('rx', [{ id: 'termin-1' }, { id: 'termin-2' }]);
  assert.equal(sitzungen.get('s1'), 'parallel');
  assert.equal(sitzungen.get('s2'), 'termin-2');
  assert.equal(gemeldet[0], 'verordnungen:changed');
  assert.match(gemeldet[1], /^1 von 2 Serienterminen/);
});

test('ohne Wochentagsangabe gilt der Wochentag des Starts', () => {
  assert.deepEqual(
    serienDaten({ startDatum: '2026-09-16', anzahl: 2, intervalDays: 7 }),
    ['2026-09-16', '2026-09-23'],
  );
});

test('zwei Wochentage je Woche — Mi und Fr', () => {
  assert.deepEqual(
    serienDaten({ startDatum: '2026-09-16', anzahl: 4, intervalDays: 7, wochentage: [3, 5] }),
    ['2026-09-16', '2026-09-18', '2026-09-23', '2026-09-25'],
  );
});

test('alle zwei Wochen', () => {
  assert.deepEqual(
    serienDaten({ startDatum: '2026-09-16', anzahl: 3, intervalDays: 14, wochentage: [3] }),
    ['2026-09-16', '2026-09-30', '2026-10-14'],
  );
});

// Die einzige bewusste Abweichung vom alten Verhalten: „täglich" heisst täglich.
test('täglich zählt Kalendertage, nicht Wochen', () => {
  assert.deepEqual(
    serienDaten({ startDatum: '2026-09-16', anzahl: 4, taeglich: true, wochentage: [3] }),
    ['2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19'],
  );
});

// Über die Sommerzeitgrenze (25.10.2026): der Wochentag darf nicht verrutschen.
test('Zeitumstellung verschiebt den Wochentag nicht', () => {
  const tage = serienDaten({ startDatum: '2026-10-21', anzahl: 3, intervalDays: 7, wochentage: [3] });
  assert.deepEqual(tage, ['2026-10-21', '2026-10-28', '2026-11-04']);
});

test('Jahreswechsel', () => {
  assert.deepEqual(
    serienDaten({ startDatum: '2026-12-30', anzahl: 2, intervalDays: 7, wochentage: [3] }),
    ['2026-12-30', '2027-01-06'],
  );
});

test('unbrauchbare Eingaben liefern nichts statt zu raten', () => {
  assert.deepEqual(serienDaten({ startDatum: '', anzahl: 5 }), []);
  assert.deepEqual(serienDaten({ startDatum: '2026-09-16', anzahl: 0 }), []);
  assert.deepEqual(serienDaten({ startDatum: '2026-09-16', anzahl: 'drei' }), []);
});

// Die Obergrenze ist die Versicherung gegen die eingefrorene Maske.
test('die Schleife endet auch bei 52 Terminen', () => {
  const tage = serienDaten({ startDatum: '2026-09-16', anzahl: 52, intervalDays: 7, wochentage: [3] });
  assert.equal(tage.length, 52);
});

/* ── Ops 08fa9e2c: nur die angehakten Einheiten verteilen ─────────────────── */

/**
 * @param {number} anzahlAngehakt
 * @param {number} gesamt
 * @returns {any}
 */
function liste(anzahlAngehakt, gesamt) {
  return {
    querySelectorAll(/** @type {string} */ sel) {
      assert.equal(sel, '.rx-unv-cb:checked');
      return { length: anzahlAngehakt, _gesamt: gesamt };
    },
  };
}

test('nichts angehakt — alle offenen Einheiten, wie bisher', () => {
  assert.equal(serienAnzahl(liste(0, 9), 9), 9);
  assert.equal(serienAnzahl(null, 9), 9);
});

test('fünf von neun angehakt — nur die fünf', () => {
  assert.equal(serienAnzahl(liste(5, 9), 9), 5);
});

test('die Beschriftung nennt die Zahl, die gleich passiert', () => {
  assert.equal(serienKnopfText(9, false), '🗓 9 offene Einheiten als Serie verteilen');
  assert.equal(serienKnopfText(5, true), '🗓 5 ausgewählte Einheiten als Serie verteilen');
  assert.equal(serienKnopfText(1, true), '🗓 1 ausgewählte Einheit als Serie verteilen');
});

/* ── Ops 08fa9e2c: „Anzahl 3" darf auch einen einzigen Termin heissen ────── */

test('der Hinweis sagt, was mit dem Rest passiert', () => {
  assert.match(anzahlHinweisText(3, false), /übrigen 2 bleiben offen/);
  assert.match(anzahlHinweisText(3, true), /Alle 3 Termine/);
  assert.equal(anzahlHinweisText(1, false), '');
});

/* ── Bugfix 2026-10-14: Keine Termine vor Start, gewählte Wochentage, Sortierung ── */

test('start 2026-10-14 (Mi) gewählt [1] (Mo) liefert 2026-10-19 und niemals 2026-10-12', () => {
  const tage = serienDaten({ startDatum: '2026-10-14', anzahl: 2, intervalDays: 7, wochentage: [1] });
  assert.deepEqual(tage, ['2026-10-19', '2026-10-26']);
  assert.ok(tage.every(d => d >= '2026-10-14'), 'Kein Termin darf vor dem Startdatum liegen');
});

test('unsortierte Wochentage werden chronologisch sortiert und dedupliziert', () => {
  const tage = serienDaten({ startDatum: '2026-10-14', anzahl: 4, intervalDays: 7, wochentage: [5, 1, 5, 1] });
  // 2026-10-14 ist Mittwoch. Mo 12.10. liegt vor Start, also Fr 16.10., Mo 19.10., Fr 23.10., Mo 26.10.
  assert.deepEqual(tage, ['2026-10-16', '2026-10-19', '2026-10-23', '2026-10-26']);
});

test('benutzerdefiniertes Intervall (z.B. alle 3 Wochen / 21 Tage)', () => {
  const tage = serienDaten({ startDatum: '2026-10-14', anzahl: 3, intervalDays: 21, wochentage: [3] });
  assert.deepEqual(tage, ['2026-10-14', '2026-11-04', '2026-11-25']);
});

test('ungültige Wochentage oder Datum frieren die Berechnung nicht ein und werden verworfen', () => {
  assert.deepEqual(serienDaten({ startDatum: 'invalid-date', anzahl: 5 }), []);
  assert.deepEqual(serienDaten({ startDatum: '2026-10-14', anzahl: -3 }), []);
  // Kalender-Rollover (z.B. 30. Februar) wird strikt abgewiesen
  assert.deepEqual(serienDaten({ startDatum: '2026-02-30', anzahl: 2 }), []);
  // Nicht-ganzzahlige Terminzahl (1.5) wird abgewiesen
  assert.deepEqual(serienDaten({ startDatum: '2026-10-14', anzahl: 1.5 }), []);
  assert.deepEqual(serienDaten({ startDatum: '2026-10-14', anzahl: '1.5' }), []);
  // Ungültige Wochentag-Zahlen fallen NICHT still auf Startwochentag zurück
  assert.deepEqual(serienDaten({ startDatum: '2026-10-14', anzahl: 2, intervalDays: 7, wochentage: [99, -5] }), []);
});

test('recurrence biweekly ohne intervalDays liefert 14 Tage Abstand', () => {
  const tage = serienDaten({ startDatum: '2026-10-14', anzahl: 3, recurrence: 'biweekly', wochentage: [3] });
  assert.deepEqual(tage, ['2026-10-14', '2026-10-28', '2026-11-11']);
});

test('verdrahteSerienStarttag: automatische Tage folgen Start und Frequenz, Handeingabe bleibt bis zum Reset', async () => {
  const { verdrahteSerienStarttag } = await import('./serien-termine.js');
  const box = (/** @type {any} */ v, /** @type {any} */ c) => ({ value: String(v), checked: c, dispatchEvent: () => {} });
  const boxen = [box(1, true), box(2, false), box(3, false), box(4, false), box(5, false), box(6, false), box(0, false)];
  /** @type {Record<string, any[]>} */
  const hoerer = {};
  const el = (/** @type {any} */ id) => ({ id, value: id === 'bkStart' ? '2026-10-21T09:00' : '', addEventListener: (/** @type {any} */ t, /** @type {any} */ f) => { (hoerer[id + t] ||= []).push(f); } });
  const wrap = { ...el('bkSeriesWeekdays'), querySelectorAll: () => boxen };
  /** @type {Record<string, any>} */
  const els = { bkSeriesWeekdays: wrap, bkStart: el('bkStart'), bkSeriesToggle: { ...el('bkSeriesToggle'), checked: true }, bkSeriesRecurrence: el('bkSeriesRecurrence') };
  boxen[0].dispatchEvent = () => {};
  const reset = verdrahteSerienStarttag(/** @type {any} */ ({ getElementById: (/** @type {any} */ id) => els[id] }));
  hoerer.bkSeriesTogglechange[0]();
  assert.deepEqual(boxen.filter(b => b.checked).map(b => b.value), ['3']);
  els.bkSeriesRecurrence.value = '2x pro Woche';
  hoerer.bkSeriesRecurrencechange[0]();
  assert.deepEqual(boxen.filter(b => b.checked).map(b => b.value), ['2', '3']);
  els.bkStart.value = '2026-10-22T09:00';
  hoerer.bkStartinput[0]();
  assert.deepEqual(boxen.filter(b => b.checked).map(b => b.value), ['3', '4']);
  hoerer.bkSeriesWeekdayschange[0]({ isTrusted: true });   // Hand
  boxen.forEach(b => { b.checked = b.value === '5'; });
  els.bkStart.value = '2026-10-27T09:00';
  hoerer.bkStartchange[0]();
  assert.deepEqual(boxen.filter(b => b.checked).map(b => b.value), ['5']);
  reset();
  assert.deepEqual(boxen.filter(b => b.checked).map(b => b.value), ['1', '2']);
});

test('verdrahteSerienStarttag: Serie schlägt 6 vor und erhält eine eingegebene Anzahl', async () => {
  const { verdrahteSerienStarttag } = await import('./serien-termine.js');
  /** @type {Record<string, any[]>} */
  const hoerer = {};
  const el = (/** @type {any} */ id, value = '') => ({ id, value, dispatchEvent: (/** @type {any} */ e) => (hoerer[id + e.type] || []).forEach(f => f(e)), addEventListener: (/** @type {any} */ t, /** @type {any} */ f) => { (hoerer[id + t] ||= []).push(f); } });
  /** @type {Record<string, any>} */
  const els = { bkSeriesWeekdays: { ...el('bkSeriesWeekdays'), querySelectorAll: () => [] }, bkStart: el('bkStart', '2026-10-21T09:00'),
    bkSeriesToggle: { ...el('bkSeriesToggle'), checked: false }, bkAnzahl: { ...el('bkAnzahl', '1'), defaultValue: '1' } };
  verdrahteSerienStarttag(/** @type {any} */ ({ getElementById: (/** @type {any} */ id) => els[id] }));
  hoerer.bkSeriesTogglechange[0]();
  assert.equal(els.bkAnzahl.value, '1');
  els.bkSeriesToggle.checked = true;
  hoerer.bkSeriesTogglechange[0]();
  assert.equal(els.bkAnzahl.value, '6');
  els.bkSelectedRxId = { value: 'Chrome1911 KG', dataset: { offeneEinheiten: '3' } };
  els.bkAnzahl.value = '1';
  hoerer.bkSeriesTogglechange[0]();
  assert.equal(els.bkAnzahl.value, '3');
  els.bkAnzahl.value = '4';
  hoerer.bkSeriesTogglechange[0]();
  assert.equal(els.bkAnzahl.value, '4');
});
