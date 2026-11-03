import { test } from 'node:test';
import assert from 'node:assert/strict';

import { montagDerWoche, wochenTage, pixelFuerMinute, renderWoche } from './kalender-woche.js';
import { mitDeckkraft } from './kalender-farben.js';
import { WV_SLOT_PX } from './kalender-raster.js';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

test('M4: Woche zeigt nur gespeicherten Standort und Alttermine, ohne Standort alle', async (t) => {
  const vorher = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => { if (vorher) Object.defineProperty(globalThis, 'document', vorher); else delete globalThis.document; });
  const element = () => ({ children: [], dataset: {}, style: {}, classList: { add() {} },
    appendChild(child) { this.children.push(child); }, addEventListener() {},
    set innerHTML(value) { this.children = []; },
  });
  const timeCol = element();
  const colsWrap = element();
  globalThis.document = { getElementById: id => id === 'wvTimeCol' ? timeCol : colsWrap, createElement: element };
  const rows = ['A', 'B', null].map((business_id, i) => ({ id: String(i), user_id: 'e', business_id,
    start_time: '2026-11-09T10:00:00Z', end_time: '2026-11-09T10:30:00Z' }));
  const supabase = { from(table) {
    let selected = '';
    const query = { select(value) { selected = value; return query; },
      then(resolve) { return Promise.resolve({ data: table === 'bookings' ? rows.map(row => {
        const copy = { ...row }; if (!selected.split(',').includes('business_id')) delete copy.business_id; return copy;
      }) : [] }).then(resolve); } };
    for (const method of ['eq', 'gte', 'lte', 'in', 'neq']) query[method] = () => query;
    return query;
  } };
  const ids = () => colsWrap.children.flatMap(col => col.children.flatMap(inner => inner.children || []))
    .filter(node => node._termin).map(node => node._termin.id);
  const options = { supabase, ownerId: 'o', dateStr: '2026-11-09', teamMembers: [{ id: 'e' }] };
  await renderWoche({ ...options, businessId: 'A' });
  assert.deepEqual(ids(), ['0', '2']);
  await renderWoche({ ...options, businessId: 'B' });
  assert.deepEqual(ids(), ['1', '2']);
  await renderWoche(options);
  assert.deepEqual(ids(), ['0', '1', '2']);
});

test('F8: langsame Termin- oder Abwesenheitsantwort darf neuere Woche nicht ergaenzen', async (t) => {
  const vorher = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => { if (vorher) Object.defineProperty(globalThis, 'document', vorher); else delete globalThis.document; });
  for (const langsam of ['bookings', 'time_offs']) {
    const element = () => ({
      children: [], dataset: {}, style: {}, classList: { add() {} },
      appendChild(child) { this.children.push(child); }, addEventListener() {},
      set innerHTML(value) { this.children = []; },
    });
    const timeCol = element();
    const colsWrap = element();
    globalThis.document = {
      getElementById: id => id === 'wvTimeCol' ? timeCol : colsWrap,
      createElement: element,
    };
    let freigeben;
    let erreicht;
    const wartet = new Promise(resolve => { erreicht = resolve; });
    const spaet = new Promise(resolve => { freigeben = resolve; });
    let erster = true;
    const supabase = { from(table) {
      const antwort = table === langsam && erster ? (erster = false, erreicht(), spaet) : Promise.resolve({ data: [] });
      const query = { then: antwort.then.bind(antwort) };
      for (const method of ['select', 'eq', 'gte', 'lte', 'in', 'neq']) query[method] = () => query;
      return query;
    } };
    let label;
    const optionen = { supabase, ownerId: 'synthetic', teamMembers: [{ id: 'synthetic-employee' }],
      setzeDatumsLabel: value => { label = value; } };
    const alt = renderWoche({ ...optionen, dateStr: '2026-11-09' });
    await wartet;
    await renderWoche({ ...optionen, dateStr: '2026-11-16' });
    freigeben({ data: [] });
    await alt;
    assert.equal(label, '16.11. – 22.11.');
    assert.deepEqual(colsWrap.children.map(col => col.children[0].dataset.datum),
      ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'], langsam);
  }
});

test('Montag einer Woche — Wochenmitte', () => {
  // 22.08.2026 ist ein Samstag.
  assert.equal(iso(montagDerWoche('2026-08-22')), '2026-08-17');
});

test('Montag bleibt Montag', () => {
  assert.equal(iso(montagDerWoche('2026-08-17')), '2026-08-17');
});

test('Sonntag gehoert zur Woche davor, nicht zur naechsten', () => {
  // getDay() liefert für Sonntag 0 — ohne Sonderfall landete man 6 Tage
  // in der Zukunft statt am Montag davor.
  assert.equal(iso(montagDerWoche('2026-08-23')), '2026-08-17');
});

test('Zeitumstellung verschiebt die Woche nicht', () => {
  // 29.03.2026 ist der Sonntag der Sommerzeitumstellung. Um Mitternacht
  // gerechnet kann der Tag lokal auf den Vortag rutschen — deshalb rechnet
  // montagDerWoche() mittags.
  assert.equal(iso(montagDerWoche('2026-03-29')), '2026-03-23');
  assert.equal(iso(montagDerWoche('2026-03-30')), '2026-03-30');
});

test('wochenTage liefert sieben Tage, Montag zuerst', () => {
  const tage = wochenTage('2026-08-22');
  assert.equal(tage.length, 7);
  assert.equal(iso(tage[0]), '2026-08-17');
  assert.equal(iso(tage[6]), '2026-08-23');
  assert.equal(tage[0].getDay(), 1); // Montag
  assert.equal(tage[6].getDay(), 0); // Sonntag
});

test('wochenTage ueberspringt keinen Tag ueber den Monatswechsel', () => {
  const tage = wochenTage('2026-08-31');
  assert.deepEqual(tage.map(iso), [
    '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03',
    '2026-09-04', '2026-09-05', '2026-09-06',
  ]);
});

test('pixelFuerMinute rechnet mit der Wochenhoehe, nicht mit der Tageshoehe', () => {
  assert.equal(pixelFuerMinute(8 * 60), 0);          // Rasteranfang
  assert.equal(pixelFuerMinute(8 * 60 + 30), WV_SLOT_PX);
  assert.equal(pixelFuerMinute(9 * 60), WV_SLOT_PX * 2);
  // Das war der Fehler vor dem 22.08.2026: die Zeitleiste rechnete mit 56 px
  // je halber Stunde, der Inhalt mit 28 — 09:00 lag doppelt so tief.
  assert.equal(pixelFuerMinute(9 * 60), 56);
});

test('pixelFuerMinute trifft auch zwischen den Rasterlinien', () => {
  // 09:20 liegt zwei Drittel im dritten Feld.
  assert.equal(Math.round(pixelFuerMinute(9 * 60 + 20)), Math.round(WV_SLOT_PX * 2 + WV_SLOT_PX * (20 / 30)));
});

test('mitDeckkraft: Hexfarbe bekommt das Alpha-Suffix', () => {
  assert.equal(mitDeckkraft('#22c55e'), '#22c55e22');
  assert.equal(mitDeckkraft('#22c55e', '25'), '#22c55e25');
});

test('mitDeckkraft: CSS-Variable wird nicht verstuemmelt', () => {
  // '#var(--primary)22' waere kein Farbwert — der Block haette keine Flaeche.
  // Das passiert, sobald ein Termin zu niemandem aus teamMembers gehoert.
  assert.equal(mitDeckkraft('var(--primary)'), 'color-mix(in srgb, var(--primary) 13%, transparent)');
});

test('mitDeckkraft: Kurzform und Grossbuchstaben', () => {
  assert.equal(mitDeckkraft('#ABCDEF'), '#ABCDEF22');
  // Dreistellige Kurzform ist kein sicherer Fall — dort ergaebe '#abc' + '22'
  // die Farbe '#abc22', also etwas voellig anderes.
  assert.equal(mitDeckkraft('#abc'), 'color-mix(in srgb, #abc 13%, transparent)');
});
