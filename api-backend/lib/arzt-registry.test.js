// Tests für das Ärzte-Register. Kein echtes Supabase — ein In-Memory-Stub, der
// genau die Aufrufkette nachbildet, die arzt-registry.js benutzt.
//
//   node lib/arzt-registry.test.js

import assert from 'node:assert/strict';
import { resolveOrCreateArzt, normalizeArztName } from './arzt-registry.js';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log('  ok   ' + name); passed++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); failed++; }
}

// --------------------------------------------------------------------------
// Supabase-Stub
// --------------------------------------------------------------------------
function makeStub(rows = []) {
  const store = rows.map((r, i) => ({ id: r.id || `id-${i + 1}`, ...r }));
  let seq = store.length;

  function builder() {
    const filters = [];
    const api = {
      _mode: null, _payload: null,
      select() { return api; },
      eq(col, val)    { filters.push(r => r[col] === val); return api; },
      is(col, val)    { filters.push(r => (r[col] ?? null) === val); return api; },
      ilike(col, val) {
        const needle = String(val).toLowerCase();
        filters.push(r => String(r[col] ?? '').toLowerCase() === needle);
        return api;
      },
      _match() { return store.filter(r => filters.every(f => f(r))); },
      async maybeSingle() { return { data: api._match()[0] || null, error: null }; },
      async single() {
        if (api._mode === 'insert') {
          const row = api._payload;
          // Unique-Indizes aus v32 nachbilden.
          const clash = store.find(r =>
            r.owner_id === row.owner_id && (
              (row.lanr && r.lanr === row.lanr) ||
              (!row.lanr && !r.lanr &&
                String(r.arzt_name).toLowerCase() === String(row.arzt_name).toLowerCase())
            ));
          if (clash) return { data: null, error: { code: '23505', message: 'duplicate key' } };
          const created = { id: `id-${++seq}`, ...row };
          store.push(created);
          return { data: created, error: null };
        }
        return { data: api._match()[0] || null, error: null };
      },
      insert(payload) { api._mode = 'insert'; api._payload = payload; return api; },
      update(patch) {
        api._mode = 'update';
        return {
          async eq(col, val) {
            for (const r of store) if (r[col] === val) Object.assign(r, patch);
            return { error: null };
          }
        };
      }
    };
    return api;
  }

  return { from: () => builder(), _store: store };
}

const OWNER = 'owner-1';

// --------------------------------------------------------------------------
console.log('arzt-registry — Identität');

await test('normalizeArztName kürzt Mehrfach-Leerzeichen', () => {
  assert.equal(normalizeArztName('  Dr.   med.  Meyer '), 'Dr. med. Meyer');
});

await test('legt einen unbekannten Arzt an', async () => {
  const db = makeStub();
  const r = await resolveOrCreateArzt(db, OWNER,
    { name: 'Dr. med. Meyer', lanr: '123456789', bsnr: '987654321' }, { quelle: 'ocr' });
  assert.equal(r.created, true);
  assert.equal(db._store.length, 1);
  assert.equal(db._store[0].lanr, '123456789');
  assert.equal(db._store[0].quelle, 'ocr');
});

await test('erkennt denselben Arzt an der LANR wieder — kein Doppelter', async () => {
  const db = makeStub([{ owner_id: OWNER, arzt_name: 'Dr. med. Meyer', lanr: '123456789' }]);
  const r = await resolveOrCreateArzt(db, OWNER, { name: 'Dr. med. Meyer', lanr: '123456789' });
  assert.equal(r.created, false);
  assert.equal(r.matchedBy, 'lanr');
  assert.equal(db._store.length, 1);
});

await test('Heirat: gleiche LANR, neuer Nachname -> Name wird aktualisiert', async () => {
  const db = makeStub([{ owner_id: OWNER, arzt_name: 'Dr. med. Anna Klein', lanr: '123456789' }]);
  const r = await resolveOrCreateArzt(db, OWNER, { name: 'Dr. med. Anna Berger', lanr: '123456789' });
  assert.equal(r.created, false);
  assert.equal(db._store.length, 1, 'darf keinen zweiten Datensatz anlegen');
  assert.equal(db._store[0].arzt_name, 'Dr. med. Anna Berger');
});

await test('Praxiswechsel: gleiche LANR, neue BSNR/Adresse -> aktualisiert', async () => {
  const db = makeStub([{
    owner_id: OWNER, arzt_name: 'Dr. Meyer', lanr: '123456789',
    bsnr: '111111111', adresse: 'Altstr. 1, 10115 Berlin'
  }]);
  await resolveOrCreateArzt(db, OWNER, {
    name: 'Dr. Meyer', lanr: '123456789',
    bsnr: '222222222', adresse: 'Neustr. 9, 20095 Hamburg'
  });
  assert.equal(db._store.length, 1);
  assert.equal(db._store[0].bsnr, '222222222');
  assert.equal(db._store[0].adresse, 'Neustr. 9, 20095 Hamburg');
});

await test('zwei Ärzte gleichen Namens mit verschiedener LANR bleiben getrennt', async () => {
  const db = makeStub([{ owner_id: OWNER, arzt_name: 'Dr. Müller', lanr: '111111111' }]);
  const r = await resolveOrCreateArzt(db, OWNER, { name: 'Dr. Müller', lanr: '222222222' });
  assert.equal(r.created, true);
  assert.equal(db._store.length, 2);
});

await test('ohne LANR greift der Namensvergleich (unabhängig von Groß/Klein)', async () => {
  const db = makeStub([{ owner_id: OWNER, arzt_name: 'Dr. Schulz', lanr: null }]);
  const r = await resolveOrCreateArzt(db, OWNER, { name: 'dr. schulz' });
  assert.equal(r.created, false);
  assert.equal(r.matchedBy, 'name');
  assert.equal(db._store.length, 1);
});

await test('Namenstreffer mit neuer LANR trägt die Identität nach', async () => {
  const db = makeStub([{ owner_id: OWNER, arzt_name: 'Dr. Schulz', lanr: null }]);
  await resolveOrCreateArzt(db, OWNER, { name: 'Dr. Schulz', lanr: '123456789' });
  assert.equal(db._store.length, 1);
  assert.equal(db._store[0].lanr, '123456789');
});

await test('anderer Inhaber -> eigener Datensatz (Mandantentrennung)', async () => {
  const db = makeStub([{ owner_id: 'owner-2', arzt_name: 'Dr. Meyer', lanr: '123456789' }]);
  const r = await resolveOrCreateArzt(db, OWNER, { name: 'Dr. Meyer', lanr: '123456789' });
  assert.equal(r.created, true);
  assert.equal(db._store.length, 2);
});

console.log('arzt-registry — Anreicherung');

await test('füllt leere Felder auf', async () => {
  const db = makeStub([{ owner_id: OWNER, arzt_name: 'Dr. Meyer', lanr: '123456789' }]);
  const r = await resolveOrCreateArzt(db, OWNER, {
    name: 'Dr. Meyer', lanr: '123456789', telefon: '030 123456', fachrichtung: 'Orthopädie'
  });
  assert.deepEqual(r.enriched.sort(), ['fachrichtung', 'telefon']);
  assert.equal(db._store[0].telefon, '030 123456');
});

await test('überschreibt gepflegte Fachrichtung nicht', async () => {
  const db = makeStub([{
    owner_id: OWNER, arzt_name: 'Dr. Meyer', lanr: '123456789', fachrichtung: 'Orthopädie'
  }]);
  await resolveOrCreateArzt(db, OWNER, { name: 'Dr. Meyer', lanr: '123456789', fachrichtung: 'Chirurgie' });
  assert.equal(db._store[0].fachrichtung, 'Orthopädie');
});

await test('bei Namenstreffer bleiben vorhandene Stammdaten stehen', async () => {
  const db = makeStub([{
    owner_id: OWNER, arzt_name: 'Dr. Schulz', lanr: null, adresse: 'Gute Adresse 1'
  }]);
  await resolveOrCreateArzt(db, OWNER, { name: 'Dr. Schulz', adresse: 'Schlecht gescannt' });
  assert.equal(db._store[0].adresse, 'Gute Adresse 1');
});

console.log('arzt-registry — Robustheit');

await test('unbrauchbare LANR wird verworfen, nicht gespeichert', async () => {
  const db = makeStub();
  await resolveOrCreateArzt(db, OWNER, { name: 'Dr. Meyer', lanr: '0176 1111111' });
  assert.equal(db._store[0].lanr, null, 'eine Telefonnummer darf nie als LANR landen');
});

await test('LANR mit Trennzeichen wird normalisiert', async () => {
  const db = makeStub();
  await resolveOrCreateArzt(db, OWNER, { name: 'Dr. Meyer', lanr: '123 456 789' });
  assert.equal(db._store[0].lanr, '123456789');
});

await test('ohne Name und ohne LANR passiert nichts', async () => {
  const db = makeStub();
  const r = await resolveOrCreateArzt(db, OWNER, { bsnr: '123456789' });
  assert.equal(r.id, null);
  assert.equal(db._store.length, 0);
});

await test('nur LANR, kein Name -> auffindbarer Platzhalter', async () => {
  const db = makeStub();
  const r = await resolveOrCreateArzt(db, OWNER, { lanr: '123456789' });
  assert.equal(r.created, true);
  assert.equal(db._store[0].arzt_name, 'Unbekannt (LANR 123456789)');
});

await test('Wettlauf (unique violation) liefert den vorhandenen Datensatz', async () => {
  const db = makeStub([{ id: 'race-1', owner_id: OWNER, arzt_name: 'Dr. Meyer', lanr: '123456789' }]);
  // Suche künstlich blind stellen, damit der INSERT-Pfad in den 23505 läuft.
  const echt = db.from;
  let ersterAufruf = true;
  db.from = () => {
    const b = echt();
    if (ersterAufruf) {
      ersterAufruf = false;
      const orig = b.maybeSingle.bind(b);
      b.maybeSingle = async () => { b.maybeSingle = orig; return { data: null, error: null }; };
    }
    return b;
  };
  const r = await resolveOrCreateArzt(db, OWNER, { name: 'Dr. Meyer', lanr: '123456789' });
  assert.equal(r.id, 'race-1');
  assert.equal(r.created, false);
  assert.equal(db._store.length, 1, 'kein Doppelter trotz Wettlauf');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
