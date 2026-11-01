import test from 'node:test';
import assert from 'node:assert/strict';

// Das Routenmodul baut beim Import einen Supabase-Client; ohne Netz, nur damit der Import gelingt.
process.env.SUPABASE_URL ||= 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-key';
const { standortplanAufraeumen } = await import('./mitarbeiter-zugang.js');

function fakeDb(ergebnis) {
  const aufrufe = [];
  return {
    aufrufe,
    from(tabelle) {
      const a = { tabelle, op: null, filter: {} };
      aufrufe.push(a);
      const b = {
        delete() { a.op = 'delete'; return b; },
        eq(k, v) { a.filter[k] = v; return b; },
        then(ok, fehl) {
          if (ergebnis instanceof Error) return Promise.reject(ergebnis).then(ok, fehl);
          return Promise.resolve(ergebnis).then(ok, fehl);
        },
      };
      return b;
    },
  };
}

test('Aufraeumen loescht nur den Einsatzplan des Mitarbeiters im eigenen Mandanten', async () => {
  const db = fakeDb({ error: null });
  assert.equal(await standortplanAufraeumen(db, { ownerId: 'o1', employeeId: 'e1' }), true);
  assert.equal(db.aufrufe.length, 1);
  assert.deepEqual(db.aufrufe[0], { tabelle: 'employee_standort_plan', op: 'delete', filter: { owner_id: 'o1', employee_id: 'e1' } });
});

test('Anstellung wird beim Entfernen nicht angefasst (Resturlaub-Abgeltung)', async () => {
  const db = fakeDb({ error: null });
  await standortplanAufraeumen(db, { ownerId: 'o1', employeeId: 'e1' });
  assert.ok(!db.aufrufe.some(a => a.tabelle === 'mitarbeiter_anstellung'));
});

test('DB-Fehler oder Ausnahme -> false, wirft nicht (Sperre bleibt gueltig)', async () => {
  const fehler = console.error;
  console.error = () => {};
  try {
    assert.equal(await standortplanAufraeumen(fakeDb({ error: { code: 'PGRST205' } }), { ownerId: 'o1', employeeId: 'e1' }), false);
    assert.equal(await standortplanAufraeumen(fakeDb(new Error('netz')), { ownerId: 'o1', employeeId: 'e1' }), false);
  } finally {
    console.error = fehler;
  }
});
