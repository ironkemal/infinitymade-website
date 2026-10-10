import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ladeErbrachteSitzungen, flacheBehandlungen } from './erbrachte-sitzungen.js';

test('flacheBehandlungen: Behandlung × HPNR, eindeutige ids, chronologisch', () => {
  const z = flacheBehandlungen([
    { id: 'b2', behandlungsdatum: '2026-10-09', hpnr_codes: ['78610', '78610'] },
    { id: 'b1', behandlungsdatum: '2026-10-02', hpnr_codes: ['78030', '78020', ' '] },
  ]);
  assert.deepEqual(z.map(x => x.id), ['b1:78030', 'b1:78020', 'b2:78610', 'b2:78610:2']);
  assert.equal(new Set(z.map(x => x.id)).size, z.length);
  assert.equal(z[0].done_at, '2026-10-02');
});

function fakeSupabase(rows, log) {
  const q = {
    from(t) { log.push(['from', t]); return q; },
    select() { return q; },
    is(k, v) { log.push(['is', k, v]); return q; },
    eq(k, v) { log.push(['eq', k, v]); return q; },
    order() { return Promise.resolve({ data: rows, error: null }); },
  };
  return q;
}

test('Podologie liest podologie_behandlungen (nicht storniert, eigener Mandant)', async () => {
  const log = [];
  const supabase = fakeSupabase([{ id: 'b1', behandlungsdatum: '2026-10-10', hpnr_codes: ['78020'] }], log);
  const r = await ladeErbrachteSitzungen({ supabase, rx: { id: 'rx1', therapie_bereich: 'podo', prescription_sessions: [] }, tenantId: 't1' });
  assert.equal(r.podo, true);
  assert.deepEqual(r.sitzungen, [{ id: 'b1:78020', done_at: '2026-10-10', code: '78020' }]);
  assert.deepEqual(log, [['from', 'podologie_behandlungen'], ['is', 'storniert_am', null], ['eq', 'owner_id', 't1'], ['eq', 'verordnung_id', 'rx1']]);
});

test('Physio: nur done-Sitzungen mit heilmittel_position, sortiert, ohne DB', async () => {
  const supabase = { from() { throw new Error('keine DB erwartet'); } };
  const r = await ladeErbrachteSitzungen({ supabase, tenantId: 't1', rx: {
    therapie_bereich: 'physio', heilmittel_position: 'X0501',
    prescription_sessions: [
      { id: 's2', status: 'done', done_at: '2026-10-05T10:00:00Z' },
      { id: 's3', status: 'planned', done_at: null },
      { id: 's1', status: 'done', done_at: '2026-10-01T10:00:00Z' },
    ] } });
  assert.equal(r.podo, false);
  assert.deepEqual(r.sitzungen.map(s => [s.id, s.code]), [['s1', 'X0501'], ['s2', 'X0501']]);
});
