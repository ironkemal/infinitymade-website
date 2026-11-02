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

const { austrittVermerken } = await import('./mitarbeiter-zugang.js');

function anstellungDb(vorhanden, { fehler = null } = {}) {
  const log = [];
  return {
    log,
    from(tabelle) {
      const a = { tabelle, op: 'select', filter: {}, wert: null, opt: null };
      log.push(a);
      const b = {
        select() { return b; }, eq(k, v) { a.filter[k] = v; return b; },
        maybeSingle() { return Promise.resolve(fehler ? { data: null, error: fehler } : { data: vorhanden, error: null }); },
        upsert(wert, opt) { a.op = 'upsert'; a.wert = wert; a.opt = opt; return Promise.resolve({ error: null }); },
      };
      return b;
    },
  };
}

test('Austritt: ohne Datum wird heute vermerkt (Upsert auf employee_id, eigener Mandant)', async () => {
  const db = anstellungDb(null);
  assert.equal(await austrittVermerken(db, { ownerId: 'o1', employeeId: 'e1', heute: '2026-11-02' }), true);
  const up = db.log.find(x => x.op === 'upsert');
  assert.deepEqual(up.wert, { employee_id: 'e1', owner_id: 'o1', austritt_am: '2026-11-02' });
  assert.deepEqual(up.opt, { onConflict: 'employee_id' });
  assert.deepEqual(db.log[0].filter, { owner_id: 'o1', employee_id: 'e1' });
});

test('Austritt: vorhandenes Datum wird nicht verschoben', async () => {
  const db = anstellungDb({ austritt_am: '2026-05-01' });
  assert.equal(await austrittVermerken(db, { ownerId: 'o1', employeeId: 'e1', heute: '2026-11-02' }), true);
  assert.ok(!db.log.some(x => x.op === 'upsert'));
});

test('Austritt: Lesefehler -> false, wirft nicht', async () => {
  const fehler = console.error; console.error = () => {};
  try {
    assert.equal(await austrittVermerken(anstellungDb(null, { fehler: { code: 'X' } }), { ownerId: 'o1', employeeId: 'e1' }), false);
  } finally { console.error = fehler; }
});
