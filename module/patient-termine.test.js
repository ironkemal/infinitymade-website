import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { ladePatientTermine, patientTerminZeile } from './patient-termine.js';

test('Patientenakte blendet Stornos standardmäßig aus und lädt sie auf Wunsch mit', async () => {
  const rows = [{ id: 'aktiv', status: 'confirmed' }, { id: 'storno', status: 'cancelled' }];
  const sb = createClient('https://test.invalid', 'test-key', { auth: { persistSession: false }, global: {
    fetch: async url => {
      const q = new URL(url).searchParams;
      assert.equal(q.get('owner_id'), 'eq.praxis');
      assert.equal(q.get('customer_phone'), 'eq.0123');
      return new Response(JSON.stringify(q.get('status') === 'neq.cancelled' ? rows.slice(0, 1) : rows));
    },
  } });
  const opts = { ownerId: 'praxis', lead: { phone: '0123' } };
  assert.deepEqual((await ladePatientTermine(sb, opts)).map(b => b.id), ['aktiv']);
  assert.deepEqual((await ladePatientTermine(sb, { ...opts, mitAbgesagten: true })).map(b => b.id), ['aktiv', 'storno']);
});

test('Absagegrund wird als Text angezeigt; historische Einträge haben keine Schreibaktion', () => {
  const html = patientTerminZeile({ status: 'cancelled', cancellation_reason: '<script>alert(1)</script>' }, {
    fmtDate: String, fmtTime: String,
  });
  assert.match(html, /Abgesagt/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>|<button|onclick/);
});

test('ohne Patientenkennung werden keine Termine anderer Patienten geladen', async () => {
  let requested = false;
  const sb = createClient('https://test.invalid', 'test-key', { global: { fetch: async () => { requested = true; } } });
  assert.deepEqual(await ladePatientTermine(sb, { ownerId: 'praxis' }), []);
  assert.equal(requested, false);
});

test('Akte mit lead_id: Termine über lead_id, Telefon nur zusätzlich (canli-test P2 30.09)', async () => {
  const seen = [];
  const sb = createClient('https://test.invalid', 'test-key', { auth: { persistSession: false }, global: {
    fetch: async url => { seen.push(new URL(url).searchParams); return new Response('[]'); },
  } });
  await ladePatientTermine(sb, { ownerId: 'praxis', lead: { id: 'L1', phone: '+49 1' } });
  await ladePatientTermine(sb, { ownerId: 'praxis', lead: { id: 'L1' } });
  assert.equal(seen[0].get('or'), '(lead_id.eq.L1,and(lead_id.is.null,customer_phone.eq."+49 1"))');
  assert.equal(seen[1].get('lead_id'), 'eq.L1');
  assert.match(patientTerminZeile({ status: 'completed' }, { fmtDate: String, fmtTime: String }), /Erledigt/);
});

test('Geteilte Telefonnummer holt nur unzugeordnete Alttermine, niemals explizit fremde lead_id', async () => {
  const rows = [
    { id:'own',owner_id:'praxis',lead_id:'A',customer_phone:'0123' },
    { id:'other',owner_id:'praxis',lead_id:'B',customer_phone:'0123' },
    { id:'legacy',owner_id:'praxis',lead_id:null,customer_phone:'0123' },
  ];
  const sb = createClient('https://test.invalid','test-key',{auth:{persistSession:false},global:{fetch:async url=>{
    const predicate = new URL(url).searchParams.get('or');
    // Transport evaluates the actual query shape, not the returned patient's name.
    assert.equal(predicate,'(lead_id.eq.A,and(lead_id.is.null,customer_phone.eq."0123"))');
    return new Response(JSON.stringify(rows.filter(r=>r.lead_id==='A'||(r.lead_id==null&&r.customer_phone==='0123'))));
  }}});
  assert.deepEqual((await ladePatientTermine(sb,{ownerId:'praxis',lead:{id:'A',phone:'0123'}})).map(r=>r.id),['own','legacy']);
});
