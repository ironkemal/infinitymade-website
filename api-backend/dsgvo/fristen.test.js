import test from 'node:test';
import assert from 'node:assert/strict';
import { grenzeIso, fristEintraege, fristenSchritt, starteFristen } from './fristen.js';
import { TABELLEN, KATEGORIEN } from './klassifikation.js';

// Mini-Fake für die genutzten supabase-js-Aufrufe; protokolliert jede Abfrage.
function fakeSupabase(daten = {}) {
  const log = [];
  const from = (table) => {
    const q = { table, op: 'select', filter: [] };
    const api = {
      select(cols) { q.cols = cols; return api; },
      delete(opt) { q.op = 'delete'; q.opt = opt; return api; },
      lt(f, v) { q.filter.push(['lt', f, v]); return api; },
      in(f, v) { q.filter.push(['in', f, v]); return api; },
      order() { return api; },
      range(a, b) { q.range = [a, b]; return api; },
      then(res, rej) {
        log.push(q);
        let out;
        if (q.op === 'delete') {
          const inIds = q.filter.find((f) => f[0] === 'in' && f[1] === 'id');
          out = { error: null, count: inIds ? inIds[2].length : (daten[`${table}:count`] ?? 0) };
        } else if (q.range) {
          out = { data: q.range[0] === 0 ? (daten[table] || []) : [], error: null };
        } else {
          const ids = q.filter.find((f) => f[0] === 'in')[2];
          out = { data: (daten[table] || []).filter((r) => ids.includes(r.patient_id)), error: null };
        }
        return Promise.resolve(out).then(res, rej);
      },
    };
    return api;
  };
  return { from, log };
}

test('grenzeIso: 6 Monate zurück', () => {
  assert.equal(grenzeIso(6, Date.parse('2026-10-09T12:00:00Z')), '2026-04-09T12:00:00.000Z');
});

test('Klassifikation: Fristen für booking_requests (6), patients (6, ohne Verweis), data_access_log (12)', () => {
  const m = Object.fromEntries(fristEintraege().map((e) => [e.table, e.loeschfrist]));
  assert.deepEqual(m.booking_requests.status, ['declined', 'cancelled', 'pending']);
  assert.equal(m.booking_requests.monate, 6);
  assert.equal(m.patients.nurOhneVerweis.table, 'booking_requests');
  assert.equal(m.data_access_log.monate, 12);
  const reihenfolge = fristEintraege().map((e) => e.table);
  assert.ok(reihenfolge.indexOf('booking_requests') < reihenfolge.indexOf('patients'), 'Anfragen vor patients');
});

test('Sicherheitsnetz: keine Frist auf Tabellen mit gesetzlicher Aufbewahrung', () => {
  for (const t of TABELLEN.filter((x) => x.loeschfrist)) {
    assert.ok(!Object.hasOwn(KATEGORIEN, t.kategorie), `${t.table} (${t.kategorie}) hat Aufbewahrungspflicht`);
  }
});

test('Lauf: Status-Filter, approved bleibt; patients nur ohne Verweis', async () => {
  const sb = fakeSupabase({
    'booking_requests:count': 3,
    patients: [{ id: 'p1' }, { id: 'p2' }],
    booking_requests: [{ patient_id: 'p2' }],
  });
  const r = await fristenSchritt(sb, { jetzt: Date.parse('2026-10-09T00:00:00Z') });
  const br = sb.log.find((q) => q.table === 'booking_requests' && q.op === 'delete');
  assert.deepEqual(br.filter.find((f) => f[0] === 'in'), ['in', 'status', ['declined', 'cancelled', 'pending']]);
  const pd = sb.log.find((q) => q.table === 'patients' && q.op === 'delete');
  assert.deepEqual(pd.filter, [['in', 'id', ['p1']]]);
  assert.deepEqual(r.map((x) => [x.table, x.geloescht]), [['booking_requests', 3], ['patients', 1], ['data_access_log', 0]]);
});

test('Start: nur Instanz 0; einmal je Tag', async () => {
  assert.equal(starteFristen({ supabase: {}, env: { NODE_APP_INSTANCE: '1' } }), null);
  let n = 0;
  const sb = { from: () => { n++; return fakeSupabase().from('x'); } };
  const h = starteFristen({ supabase: sb, env: {}, timer: { setTimeout: () => null, setInterval: () => null }, log: { log() {} }, jetzt: () => Date.parse('2026-10-09T10:00:00Z') });
  await h.tick();
  const nachErstem = n;
  await h.tick();
  assert.ok(nachErstem > 0);
  assert.equal(n, nachErstem, 'zweiter Tick am selben Tag tut nichts');
});
