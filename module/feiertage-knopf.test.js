import test from 'node:test';
import assert from 'node:assert/strict';
import { feiertageKnopf } from './feiertage-knopf.js';

// Lokale DOM-/DB-Doubles; keine Browser-, RLS- oder Live-Abnahme.
function maske(t, { bookings = [], readError, writeError, rejectWrite = false, rejectRead = false, refreshError = false, existing = [], now = '2026-11-10T12:00:00Z' } = {}) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(now).getTime() });
  const originalDocument = globalThis.document;
  t.after(() => { globalThis.document = originalDocument; });
  const nodes = {
    '#fnLand': { value: 'NW', addEventListener() {} },
    '#fnOptional': { dataset: {}, querySelectorAll: () => [] },
    '#fnHinweis': {},
    '#fnEintragen': { disabled: false, addEventListener(_event, fn) { this.click = fn; } },
  };
  const box = { style: {}, querySelector: s => nodes[s] };
  let mounted = false;
  let mounts = 0;
  const liste = {
    parentNode: { querySelector: () => mounted ? box : null },
    insertAdjacentElement() { mounted = true; mounts++; },
  };
  globalThis.document = { createElement: () => box };
  const rows = new Map(existing.map(r => [r.date, { ...r }]));
  const messages = [];
  const filters = [];
  let refreshes = 0;
  const supabase = { from(table) {
    if (table === 'custom_days') return { async upsert(input, options) {
      assert.equal(options.ignoreDuplicates, true);
      assert.equal(options.onConflict, 'owner_id,date');
      if (rejectWrite) throw new Error('synthetic transport failure');
      if (!writeError) for (const row of input) if (!rows.has(row.date)) rows.set(row.date, row);
      return { error: writeError };
    } };
    assert.equal(table, 'bookings');
    const q = {
      select: () => q,
      eq(key, value) { assert.equal(key, 'owner_id'); assert.equal(value, 'synthetic-owner'); return q; },
      gte(_key, value) { filters.push(['gte', value]); return q; },
      lte(_key, value) { filters.push(['lte', value]); return q; },
      lt(_key, value) { filters.push(['lt', value]); return q; },
      not: () => q,
      then(resolve, reject) {
        if (rejectRead) return Promise.reject(new Error('synthetic read transport failure')).then(resolve, reject);
        const data = bookings.filter(b => filters.every(([op, value]) =>
          op === 'gte' ? Date.parse(b.start_time) >= Date.parse(value)
            : op === 'lt' ? Date.parse(b.start_time) < Date.parse(value)
              : Date.parse(b.start_time) <= Date.parse(value)));
        return Promise.resolve({ data, error: readError }).then(resolve, reject);
      },
    };
    return q;
  } };
  const options = { supabase, ownerId: 'synthetic-owner', showToast: (...m) => messages.push(m), nachher: () => {
    refreshes++;
    if (refreshError) throw new Error('synthetic refresh failure');
  } };
  feiertageKnopf(liste, options);
  return { nodes, rows, messages, filters, click: () => nodes['#fnEintragen'].click({ target: nodes['#fnEintragen'] }),
    get refreshes() { return refreshes; }, get mounts() { return mounts; }, mount: () => feiertageKnopf(liste, options) };
}

test('Feiertagshinweis zählt Berliner Feiertage statt UTC-Datum, im Winter und Sommer', async t => {
  const m = maske(t, { bookings: [
    { start_time: '2026-12-24T23:30:00Z' }, // 25.12 00:30 Berlin
    { start_time: '2027-05-05T22:30:00Z' }, // Himmelfahrt 06.05 00:30 Berlin
    { start_time: '2027-05-06T22:30:00Z' }, // 07.05, kein Feiertag
    { start_time: '2027-12-26T23:00:00Z' }, // Folgetag der letzten Grenze
  ] });
  await m.click();
  assert.match(m.messages[0][0], /2 Termin\(e\)/);
  assert.ok(m.filters.some(([op, value]) => op === 'gte' && value === '2026-12-24T23:00:00.000Z'));
  assert.ok(m.filters.some(([op, value]) => op === 'lt' && value === '2027-12-26T23:00:00.000Z'));
});

test('Fehler beim Terminlesen warnt, statt keine betroffenen Termine vorzutäuschen', async t => {
  const m = maske(t, { readError: { message: 'synthetic denied' } });
  await m.click();
  assert.match(m.messages[0][0], /Termine konnten nicht geprüft werden/);
  assert.equal(m.refreshes, 1);
  assert.equal(m.nodes['#fnEintragen'].disabled, false);
});

test('Wiederholtes Eintragen erhält Sonderöffnung und behauptet keine neuen Datensätze', async t => {
  const existing = { date: '2026-12-25', type: 'special', start_time: '09:00', end_time: '12:00', note: 'synthetic opening' };
  const m = maske(t, { existing: [existing] });
  await m.click();
  const size = m.rows.size;
  await m.click();
  assert.equal(m.rows.size, size);
  assert.deepEqual(m.rows.get(existing.date), existing);
  assert.ok(m.messages.every(([message]) => /verarbeitet/.test(message) && !/\d+ Feiertage eingetragen/.test(message)));
  m.mount();
  assert.equal(m.mounts, 1);
});

test('Abgewiesener Schreibtransport zeigt Fehler und entsperrt Knopf', async t => {
  const m = maske(t, { rejectWrite: true });
  await m.click();
  assert.equal(m.messages[0][1], 'error');
  assert.equal(m.refreshes, 0);
  assert.equal(m.nodes['#fnEintragen'].disabled, false);
});

test('DB-Schreibfehler zeigt Fehler ohne Erfolg oder Refresh', async t => {
  const m = maske(t, { writeError: { message: 'synthetic denied' } });
  await m.click();
  assert.equal(m.messages.length, 1);
  assert.equal(m.messages[0][1], 'error');
  assert.equal(m.refreshes, 0);
  assert.equal(m.nodes['#fnEintragen'].disabled, false);
});

test('Berliner Jahreswechsel bestimmt beide Jahre auch bei abweichender Browserzeitzone', async t => {
  const m = maske(t, { now: '2026-12-31T23:30:00Z' }); // Berlin bereits 2027
  await m.click();
  assert.ok(m.rows.has('2027-01-01'));
  assert.ok(m.rows.has('2028-01-01'));
  assert.ok([...m.rows.keys()].every(date => date >= '2027-01-01' && date < '2029-01-01'));
});

test('Abgewiesener Lesetransport warnt und aktualisiert bereits gespeicherte Tage', async t => {
  const m = maske(t, { rejectRead: true });
  await m.click();
  assert.match(m.messages[0][0], /Termine konnten nicht geprüft werden/);
  assert.equal(m.refreshes, 1);
  assert.equal(m.nodes['#fnEintragen'].disabled, false);
});

test('Fehlgeschlagener Refresh behauptet keinen fehlgeschlagenen Speichervorgang', async t => {
  const m = maske(t, { refreshError: true });
  await m.click();
  assert.ok(m.rows.size > 0);
  assert.match(m.messages[1][0], /Ansicht konnte nicht aktualisiert werden.*neu laden/);
  assert.equal(m.messages[1][1], 'error');
  assert.equal(m.nodes['#fnEintragen'].disabled, false);
});
