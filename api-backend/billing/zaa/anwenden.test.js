import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zaaRueckmeldungAnwenden } from './anwenden.js';

function mockDb({ rpcResult = { data: { konflikt: false, zeilen: 1 }, error: null } } = {}) {
  const calls = { rpc: [], mutationen: 0 };
  const db = {
    from(t) {
      const b = {
        select() { return b; },
        eq: async () => ({ data: t === 'prescriptions' ? [{ id: 'aaaaaaaaaa-bbbb', belegnummer: '1-1' }] : [], error: null }),
        delete() { calls.mutationen++; return b; },
        update() { calls.mutationen++; return b; },
        insert() { calls.mutationen++; return b; },
      };
      return b;
    },
    async rpc(fn, args) { calls.rpc.push({ fn, args }); return rpcResult; },
  };
  return { db, calls };
}
const basis = { tenantId: 'o', abrechnungId: 'ab1', ab: { updated_at: '2026-10-05T10:00:00.123456+00:00' }, abgesetztStatus: 'abgesetzt', heute: '2026-10-05' };
const gueltig = Buffer.from("UNB+UNOC:3+A+B+250519:1200+1'UNH+1+SLLA:21:0:0'FEHL+101+1-1+Positionsnummer unbekannt'UNT+3+1'UNZ+1+1'");

for (const [name, inhalt, reason] of [
  ['leere Datei', Buffer.from('   '), 'empty'],
  ['unbekannte Datei', Buffer.from('Hallo Welt'), 'unknown'],
  ['EDIFACT-Huelle ohne Fehler (keine Annahme erfinden)', Buffer.from("UNB+UNOC:3+A+B+250519:1200+1'UNH+1+SLLA:21:0:0'UNT+2+1'UNZ+1+1'"), 'unknown'],
  ['kaputtes FEHL', Buffer.from("UNB+x'FEHL++1-1+Text'"), 'invalid'],
]) {
  test(`ungueltige ZAA (${name}): 422, keine Mutation, kein RPC`, async () => {
    const { db, calls } = mockDb();
    const r = await zaaRueckmeldungAnwenden({ ...basis, db, buf: inhalt });
    assert.equal(r.status, 422);
    assert.equal(r.body.unveraendert, true);
    assert.equal(r.body.reason, reason);
    assert.equal(calls.rpc.length, 0);
    assert.equal(calls.mutationen, 0);
  });
}

test('gueltige Fehlerliste: genau ein atomarer RPC mit Version, nie accepted', async () => {
  const { db, calls } = mockDb();
  const r = await zaaRueckmeldungAnwenden({ ...basis, db, buf: gueltig });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'rejected');
  assert.equal(r.body.errorCount, 1);
  assert.equal(calls.rpc.length, 1);
  assert.equal(calls.rpc[0].fn, 'zaa_fehler_anwenden');
  assert.equal(calls.rpc[0].args.p_expected_updated_at, basis.ab.updated_at);
  assert.equal(calls.rpc[0].args.p_gruende[0].prescription_id, 'aaaaaaaaaa-bbbb');
  assert.equal(calls.mutationen, 0, 'alle Mutationen nur innerhalb der RPC');
});

test('Fehlertexte mit Umlauten (Live-QA C-6)', async () => {
  const { db } = mockDb();
  const r = await zaaRueckmeldungAnwenden({ ...basis, db, buf: Buffer.from('Hallo Welt') });
  assert.match(r.body.error, /Rückmeldung wurde nicht verarbeitet, es wurde nichts verändert/);
});

test('Versionskonflikt: 409 unveraendert', async () => {
  const { db } = mockDb({ rpcResult: { data: { konflikt: true }, error: null } });
  const r = await zaaRueckmeldungAnwenden({ ...basis, db, buf: gueltig });
  assert.equal(r.status, 409);
  assert.equal(r.body.unveraendert, true);
});

test('RPC-Fehler: 500 ohne Details', async () => {
  const { db } = mockDb({ rpcResult: { data: null, error: { message: 'geheim' } } });
  const r = await zaaRueckmeldungAnwenden({ ...basis, db, buf: gueltig });
  assert.equal(r.status, 500);
  assert.ok(!JSON.stringify(r.body).includes('geheim'));
});
