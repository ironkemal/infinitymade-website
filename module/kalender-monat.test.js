import { test } from 'node:test';
import assert from 'node:assert/strict';

import { monatsKacheln, SPRUNG_VERZOEGERUNG_MS, renderMonat } from './kalender-monat.js';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function rendererUmgebung(t, antwort) {
  const vorher = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => { if (vorher) Object.defineProperty(globalThis, 'document', vorher); else delete globalThis.document; });
  const element = () => ({ children: [], dataset: {}, style: {}, appendChild(child) { this.children.push(child); },
    addEventListener() {}, set innerHTML(value) { this.children = []; } });
  const header = element();
  const grid = element();
  globalThis.document = { getElementById: id => id === 'monthGridHeader' ? header : grid, createElement: element };
  const supabase = { from(table) {
    let selected = '';
    const query = { select(value) { selected = value; return query; }, then(resolve) { return Promise.resolve(antwort(table, selected)).then(resolve); } };
    for (const method of ['eq', 'gte', 'lte', 'in', 'neq']) query[method] = () => query;
    return query;
  } };
  return { grid, supabase, ids: () => grid.children.flatMap(cell => cell.children.flatMap(child => child.children || []))
    .filter(node => node._termin).map(node => node._termin.id) };
}

test('M4: Monat zeigt Standort A/B und NULL-Alttermine, ohne Standort alle', async (t) => {
  const rows = ['A', 'B', null].map((business_id, i) => ({ id: String(i), business_id, user_id: 'e', start_time: '2026-11-09T10:00:00Z' }));
  const env = rendererUmgebung(t, (table, selected) => ({ data: table === 'bookings' ? rows.map(row => {
    const copy = { ...row }; if (!selected.split(',').includes('business_id')) delete copy.business_id; return copy;
  }) : [] }));
  const options = { supabase: env.supabase, year: 2026, month: 10, ownerId: 'o', teamMembers: [{ id: 'e' }] };
  await renderMonat({ ...options, businessId: 'A' });
  assert.deepEqual(env.ids(), ['0', '2']);
  await renderMonat({ ...options, businessId: 'B' });
  assert.deepEqual(env.ids(), ['1', '2']);
  await renderMonat(options);
  assert.deepEqual(env.ids(), ['0', '1', '2']);
});

test('M4: langsame Termin-/Abwesenheitsantwort überschreibt neueren Monatsstandort nicht', async (t) => {
  for (const langsam of ['bookings', 'time_offs']) {
    await t.test(langsam, async (t) => {
      let freigeben;
      let erreicht;
      const wartet = new Promise(resolve => { erreicht = resolve; });
      const spaet = new Promise(resolve => { freigeben = resolve; });
      let erster = true;
      const rows = [{ id: 'A', business_id: 'A', user_id: 'e', start_time: '2026-11-09T10:00:00Z' },
        { id: 'B', business_id: 'B', user_id: 'e', start_time: '2026-11-09T11:00:00Z' }];
      const env = rendererUmgebung(t, table => {
        if (table === langsam && erster) { erster = false; erreicht(); return spaet; }
        return { data: table === 'bookings' ? rows : [] };
      });
      const options = { supabase: env.supabase, year: 2026, month: 10, ownerId: 'o', teamMembers: [{ id: 'e' }] };
      const alt = renderMonat({ ...options, businessId: 'A' });
      await wartet;
      await renderMonat({ ...options, businessId: 'B' });
      freigeben({ data: langsam === 'bookings' ? rows : [] });
      await alt;
      assert.deepEqual(env.ids(), ['B'], langsam);
      assert.equal(env.grid.children.length, monatsKacheln(2026, 10).length);
    });
  }
});

test('immer volle Wochen', () => {
  for (let m = 0; m < 12; m++) {
    const k = monatsKacheln(2026, m);
    assert.equal(k.length % 7, 0, `Monat ${m + 1}`);
  }
});

test('erste Kachel ist ein Montag, letzte ein Sonntag', () => {
  for (let m = 0; m < 12; m++) {
    const k = monatsKacheln(2026, m);
    assert.equal(k[0].date.getDay(), 1, `Monat ${m + 1} beginnt nicht am Montag`);
    assert.equal(k[k.length - 1].date.getDay(), 0, `Monat ${m + 1} endet nicht am Sonntag`);
  }
});

test('August 2026 beginnt an einem Samstag — die Woche davor wird aufgefuellt', () => {
  const k = monatsKacheln(2026, 7);
  assert.equal(iso(k[0].date), '2026-07-27');
  assert.equal(k[0].otherMonth, true);
  assert.equal(iso(k[5].date), '2026-08-01');
  assert.equal(k[5].otherMonth, false);
});

test('ein Monat, der an einem Sonntag beginnt, rutscht nicht eine Woche vor', () => {
  // getDay() liefert fuer Sonntag 0. Ohne Umrechnung auf Montag = 0 stuende
  // der Erste ganz links statt ganz rechts in der ersten Zeile.
  const k = monatsKacheln(2026, 2); // 01.03.2026 ist ein Sonntag
  const ersterDesMonats = k.find(z => !z.otherMonth);
  assert.equal(iso(ersterDesMonats.date), '2026-03-01');
  assert.equal(k.indexOf(ersterDesMonats), 6, 'der Erste gehoert in die letzte Spalte');
});

test('alle Tage des Monats kommen genau einmal vor', () => {
  const k = monatsKacheln(2026, 1); // Februar
  const eigene = k.filter(z => !z.otherMonth).map(z => iso(z.date));
  assert.equal(eigene.length, 28);
  assert.equal(new Set(eigene).size, 28);
  assert.equal(eigene[0], '2026-02-01');
  assert.equal(eigene[27], '2026-02-28');
});

test('Schaltjahr wird nicht abgeschnitten', () => {
  const eigene = monatsKacheln(2028, 1).filter(z => !z.otherMonth);
  assert.equal(eigene.length, 29);
});

test('lueckenlose Kette ohne Sprung ueber den Monatswechsel', () => {
  const k = monatsKacheln(2026, 11); // Dezember, Jahreswechsel
  for (let i = 1; i < k.length; i++) {
    const diff = (k[i].date - k[i - 1].date) / 86400000;
    assert.ok(Math.abs(diff - 1) < 0.01, `Sprung bei ${iso(k[i].date)}`);
  }
});

test('die Sprungverzoegerung bleibt unter einer halben Sekunde', () => {
  // Darueber fuehlt sich der Einfachklick kaputt an.
  assert.ok(SPRUNG_VERZOEGERUNG_MS > 0 && SPRUNG_VERZOEGERUNG_MS <= 400);
});
