import test from 'node:test';
import assert from 'node:assert/strict';
import { mountMeinUrlaub } from './mein-urlaub.js';

function setup({ role = 'employee', contract = { vorhanden: true, beschaeftigung: 'teilzeit', wochenstunden: 20, urlaub_jahrestage: 25 }, hours = [{ day_of_week: 1, is_active: true }], hoursError = null, leaveError = null, leaves = [], contractError = null } = {}) {
  const calls = [];
  let profil = { id: 'me', role };
  const supabase = { from(table) {
    const response = table === 'mitarbeiter_anstellung' ? { data: contract, error: contractError } : table === 'working_hours' ? { data: hours, error: hoursError } : { data: leaves, error: leaveError };
    const q = { select(cols) { calls.push([table, 'select', cols]); return q; }, eq(key, value) { calls.push([table, key, value]); return q; }, lte() { return q; }, gte() { return q; }, maybeSingle() { return Promise.resolve(response); }, then(resolve) { return Promise.resolve(response).then(resolve); } };
    return q;
  } };
  const host = { hidden: false, innerHTML: '' };
  const api = mountMeinUrlaub(host, { supabase, getProfil: () => profil, jetzt: () => new Date('2026-11-02T12:00:00Z') });
  return { host, api, calls, setProfil: p => { profil = p; } };
}

test('own employment and balance are read-only, explicit own filters on all queries', async () => {
  const h = setup({ leaves: [{ start_date: '2026-11-02', end_date: '2026-11-02', type: 'urlaub' }] });
  await h.api.laden();
  assert.equal(h.host.hidden, false);
  assert.match(h.host.innerHTML, /24 Tage übrig/);
  assert.match(h.host.innerHTML, /20 Std/);
  assert.doesNotMatch(h.host.innerHTML, /<input|<button|<select/);
  for (const [table, column] of [['mitarbeiter_anstellung', 'employee_id'], ['working_hours', 'user_id'], ['time_offs', 'employee_id']]) assert.ok(h.calls.some(c => c[0] === table && c[1] === column && c[2] === 'me'));
  assert.ok(h.calls.some(c => c[0] === 'time_offs' && c[1] === 'select' && c[2] === 'start_date,end_date,type'));
});

for (const role of ['owner', undefined, 'admin']) test(`role ${role} does not query personal data`, async () => {
  const h = setup({ role: role ?? '' }); await h.api.laden(); assert.equal(h.host.hidden, true); assert.equal(h.calls.length, 0);
});

test('missing contract never shows default 30-day claim', async () => {
  const h = setup({ contract: null }); await h.api.laden(); assert.match(h.host.innerHTML, /Noch keine Anstellungsdaten/); assert.doesNotMatch(h.host.innerHTML, /30|Tage übrig/);
});

for (const opt of [{ hoursError: {} }, { leaveError: {} }, { hours: [] }]) test(`unverified balance withheld: ${JSON.stringify(opt)}`, async () => {
  const h = setup(opt); await h.api.laden(); assert.match(h.host.innerHTML, /Urlaubssaldo gerade nicht verfügbar/); assert.doesNotMatch(h.host.innerHTML, /Tage übrig/);
});

test('contract read error never renders fallback as truth', async () => {
  const h = setup({ contractError: {} }); await h.api.laden(); assert.match(h.host.innerHTML, /gerade nicht verfügbar/); assert.doesNotMatch(h.host.innerHTML, /Tage übrig|30 Tage/);
});

test('year-crossing leave counts only days within displayed year', async () => {
  const h = setup({ leaves: [{ type: 'urlaub', start_date: '2025-12-29', end_date: '2026-01-05' }] });
  await h.api.laden(); assert.match(h.host.innerHTML, /24 Tage übrig/);
});

test('invalidated or changed identity cannot paint old response', async () => {
  const h = setup(); const pending = h.api.laden(); h.api.verwerfen(); h.setProfil({ id: 'other', role: 'employee' }); await pending;
  assert.equal(h.host.hidden, true); assert.equal(h.host.innerHTML, '');
});

test('network rejection renders recoverable status without a fabricated balance', async () => {
  const host = { hidden: true, innerHTML: '' };
  const api = mountMeinUrlaub(host, { getProfil: () => ({ id: 'me', role: 'employee' }), supabase: { from() { throw new Error('network'); } } });
  await api.laden();
  assert.match(host.innerHTML, /role="status"/);
  assert.match(host.innerHTML, /später erneut öffnen/);
  assert.doesNotMatch(host.innerHTML, /Tage übrig/);
});

test('older pending request cannot overwrite newer identity result', async () => {
  let resolveOld;
  let profil = { id: 'old', role: 'employee' };
  const old = new Promise(resolve => { resolveOld = resolve; });
  const host = { hidden: true, innerHTML: '' };
  const supabase = { from(table) {
    let own;
    const q = { select() { return q; }, eq(key, value) { if (key === 'employee_id' || key === 'user_id') own = value; return q; }, gte() { return q; }, lte() { return q; }, maybeSingle() { return own === 'old' ? old : Promise.resolve({ data: null }); }, then(resolve) { return Promise.resolve({ data: [] }).then(resolve); } };
    return q;
  } };
  const api = mountMeinUrlaub(host, { supabase, getProfil: () => profil });
  const first = api.laden(); profil = { id: 'new', role: 'employee' }; await api.laden();
  const latest = host.innerHTML;
  resolveOld({ data: { beschaeftigung: 'vollzeit', urlaub_jahrestage: 60 } }); await first;
  assert.equal(host.innerHTML, latest); assert.match(latest, /Noch keine Anstellungsdaten/);
});


test('personal balance shares annual clipping and counts overlapping leave only once', async () => {
  const h = setup({
    hours: [1,2,3,4,5].map(day_of_week => ({day_of_week,is_active:true})),
    leaves: [
      {type:'urlaub',start_date:'2025-12-29',end_date:'2026-01-05'},
      {type:'urlaub',start_date:'2026-01-02',end_date:'2026-01-05'},
      {type:'urlaub',start_date:'2026-12-30T12:00:00+01:00',end_date:'2027-01-04'},
      {type:'urlaub',start_date:'2026-12-31T12:00:00+01:00',end_date:'2026-12-31T20:00:00+01:00'},
    ],
  });
  await h.api.laden();
  assert.match(h.host.innerHTML,/20 Tage übrig/);
  assert.match(h.host.innerHTML,/5 Tage eingetragen/);
});

for (const hours of [[{day_of_week:7,is_active:true}], [{day_of_week:'1',is_active:true}], [null]]) test(`invalid working days do not fabricate personal balance: ${JSON.stringify(hours)}`, async () => {
 const h=setup({hours}); await h.api.laden();
 assert.doesNotMatch(h.host.innerHTML,/Tage übrig/);
 assert.match(h.host.innerHTML,/Urlaubssaldo gerade nicht verfügbar/);
});
