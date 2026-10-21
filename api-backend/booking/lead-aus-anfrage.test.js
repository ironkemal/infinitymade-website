import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leadAusAnfrage } from './lead-aus-anfrage.js';

function fake(leads) {
  const inserts = [];
  return {
    inserts,
    from() {
      const f = [];
      const q = {
        select: () => q, limit: () => q,
        eq: (k, v) => { f.push(r => r[k] === v); return q; },
        ilike: (k, v) => { const s = v.replace(/\\/g, '').toLowerCase(); f.push(r => String(r[k]).toLowerCase() === s); return q; },
        insert: (row) => { inserts.push(row); const neu = { id: 'neu', ...row }; leads.push(neu); return { select: () => ({ single: async () => ({ data: { id: 'neu' }, error: null }) }) }; },
        then: (res) => Promise.resolve({ data: leads.filter(r => f.every(x => x(r))).map(r => ({ id: r.id })), error: null }).then(res),
      };
      return q;
    },
  };
}
const P = { vorname: 'Erna', nachname: 'Import', geburtsdatum: '1955-05-05', email: 'e@x.de', telefon: '0170' };

test('vorhandene Akte (Name + Geburtsdatum, Groß/Klein egal) wird genommen', async () => {
  const sb = fake([{ id: 'l1', owner_id: 'o', first_name: 'erna', last_name: 'IMPORT', geburtsdatum: '1955-05-05' }]);
  assert.equal(await leadAusAnfrage(sb, { ownerId: 'o', patient: P }), 'l1');
  assert.equal(sb.inserts.length, 0);
});

test('fremde Praxis oder anderes Geburtsdatum → neue Akte, pkv → privat', async () => {
  const sb = fake([{ id: 'x', owner_id: 'andere', first_name: 'Erna', last_name: 'Import', geburtsdatum: '1955-05-05' },
                   { id: 'y', owner_id: 'o', first_name: 'Erna', last_name: 'Import', geburtsdatum: '1960-01-01' }]);
  assert.equal(await leadAusAnfrage(sb, { ownerId: 'o', patient: P, paymentType: 'pkv' }), 'neu');
  assert.equal(sb.inserts[0].insurance_type, 'privat');
  assert.equal(sb.inserts[0].title, 'Erna Import');
  assert.equal(sb.inserts[0].status, 'booked');
});

test('mehrdeutig oder unvollständig → keine Akte', async () => {
  const zwei = [{ id: 'a', owner_id: 'o', first_name: 'Erna', last_name: 'Import', geburtsdatum: '1955-05-05' },
                { id: 'b', owner_id: 'o', first_name: 'Erna', last_name: 'Import', geburtsdatum: '1955-05-05' }];
  assert.equal(await leadAusAnfrage(fake(zwei), { ownerId: 'o', patient: P }), null);
  assert.equal(await leadAusAnfrage(fake([]), { ownerId: 'o', patient: { ...P, geburtsdatum: null } }), null);
  assert.equal(await leadAusAnfrage(fake([]), { ownerId: 'o', patient: null }), null);
});
