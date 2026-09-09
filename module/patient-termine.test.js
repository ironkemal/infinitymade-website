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
