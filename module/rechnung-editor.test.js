import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { terminAuswahlLaden } from './rechnung-editor.js';

test('Terminauswahl der Rechnung enthält keine abgesagten Termine', async () => {
  const sb = createClient('https://test.invalid', 'test-key', { auth: { persistSession: false }, global: {
    fetch: async url => {
      const u = new URL(url);
      let data = [];
      if (u.pathname.endsWith('/leads')) data = { title: 'Testpatient' };
      if (u.pathname.endsWith('/bookings')) {
        assert.equal(u.searchParams.get('owner_id'), 'eq.praxis');
        assert.equal(u.searchParams.get('status'), 'neq.cancelled');
        data = [{ id: 'aktiv', status: 'confirmed' }, { id: 'abgesagt', status: 'cancelled' }]
          .filter(b => b.status !== 'cancelled');
      }
      return new Response(JSON.stringify(data));
    },
  } });
  assert.deepEqual(await terminAuswahlLaden(sb, { ownerId: 'praxis', leadId: 'patient' }), [{ id: 'aktiv', status: 'confirmed' }]);
});
