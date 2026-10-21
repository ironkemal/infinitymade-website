import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createClient } from '@supabase/supabase-js';
import { patientenNameMuster } from './patienten-namensabgleich.js';

const source = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const start = source.indexOf("app.get('/api/patients/lookup'");
const end = source.indexOf('// GET /api/services/public', start);
assert.ok(start >= 0 && end > start);

function like(value, pattern) {
  let regex = '^';
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === '\\' && i + 1 < pattern.length) regex += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    else if (char === '%' || char === '*') regex += '.*';
    else if (char === '_') regex += '.';
    else regex += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(regex + '$', 'iu').test(value);
}

async function lookup(query, rows = [{ id: 'patient-synthetic', vorname: 'Änne', nachname: 'Müller', owner_id: 'praxis-a', geburtsdatum: '1980-02-01' }], dbError = false) {
  const requests = [];
  const supabase = createClient('http://patienten.synthetic.invalid', 'synthetic-key', {
    auth: { persistSession: false },
    global: { fetch: async input => {
      const url = new URL(String(input));
      assert.equal(url.hostname, 'patienten.synthetic.invalid');
      requests.push(url);
      if (dbError) return new Response(JSON.stringify({ message: 'synthetic failure' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      const matches = rows.filter(row => [...url.searchParams].every(([key, value]) => {
        if (value.startsWith('eq.')) return row[key] === value.slice(3);
        if (value.startsWith('ilike.')) return like(row[key], value.slice(6));
        return true;
      })).slice(0, Number(url.searchParams.get('limit')) || Infinity);
      return new Response(JSON.stringify(matches), { headers: { 'Content-Type': 'application/json' } });
    } },
  });
  let handler;
  vm.runInNewContext(source.slice(start, end), {
    patientenNameMuster, supabase,
    app: { get: (route, limiter, fn) => { assert.equal(route, '/api/patients/lookup'); assert.equal(limiter, rateLimit); handler = fn; } },
    patientLookupLimiter: rateLimit,
    console: { error() {} },
  });
  const result = { status: 200 };
  const res = { status(code) { result.status = code; return this; }, json(body) { result.body = body; return this; } };
  await handler({ query: { owner_id: 'praxis-a', geburtsdatum: '1980-02-01', ...query } }, res);
  return { ...result, requests };
}
function rateLimit() {}

test('Nachname-Wildcards verraten keine unbekannte Identität', async () => {
  for (const nachname of ['%', '_üller', 'M%', '*', 'M*']) {
    const result = await lookup({ nachname });
    assert.ok(result.status === 400 || result.body.patient === null, nachname);
  }
});
test('Vorname-Wildcards lösen Mehrdeutigkeit nicht auf', async () => {
  const result = await lookup({ nachname: 'Müller', vorname: '%' });
  assert.ok(result.status === 400 || result.body.patient === null);
});
test('Leere und strukturierte Namen werden vor Datenbankzugriff abgewiesen', async () => {
  for (const query of [{ nachname: '  ' }, { nachname: ['Müller'] }, { nachname: { x: 'Müller' } }, { nachname: 'Müller', vorname: ['Änne'] }]) {
    const result = await lookup(query);
    assert.equal(result.status, 400);
    assert.equal(result.requests.length, 0);
  }
});
test('Literalnamen mit Umlauten, Großschreibung und Rand-Leerzeichen bleiben gültig', async () => {
  const result = await lookup({ nachname: '  MÜLLER ', vorname: 'änne' });
  assert.equal(result.status, 200);
  assert.equal(result.body.patient.display_name, 'Ä. Müller');
  assert.equal(result.body.patient.id, 'patient-synthetic');
});
test('Prozent, Unterstrich und Backslash bleiben literale Namenszeichen', async () => {
  for (const nachname of ['Test%name', 'Test_name', 'Test\\name']) {
    const result = await lookup({ nachname }, [{ id: 'literal', vorname: 'Test', nachname, owner_id: 'praxis-a', geburtsdatum: '1980-02-01' }]);
    assert.equal(result.body.patient?.id, 'literal', nachname);
    assert.equal(result.requests[0].searchParams.get('nachname'), 'ilike.' + patientenNameMuster(nachname));
  }
});
test('Mehrfachtreffer, fremde Praxis und Lesefehler geben keine Patientendaten aus', async () => {
  const rows = [{ id: 'a', vorname: 'Änne', nachname: 'Müller', owner_id: 'praxis-a', geburtsdatum: '1980-02-01' }, { id: 'b', vorname: 'Zweite', nachname: 'Müller', owner_id: 'praxis-a', geburtsdatum: '1980-02-01' }];
  const multiple = await lookup({ nachname: 'Müller' }, rows);
  assert.equal(multiple.body.multiple, true);
  assert.equal(multiple.body.patient, null);
  assert.equal((await lookup({ nachname: 'Müller', owner_id: 'praxis-b' }, rows)).body.patient, null);
  const error = await lookup({ nachname: 'Müller' }, rows, true);
  assert.equal(error.status, 500);
  assert.equal(error.body.patient, undefined);
});

async function duplicatePatient(patient, existing, lookupError = false) {
  const routeStart = source.indexOf("app.post('/api/booking-request/create'");
  const branchStart = source.indexOf('    let resolvedPatientId = patient_id || null;', routeStart);
  const branchEnd = source.indexOf('    const { data: request, error: reqErr }', branchStart);
  assert.ok(branchStart > routeStart && branchEnd > branchStart);
  const calls = [];
  const supabase = createClient('http://patienten.synthetic.invalid', 'synthetic-key', {
    auth: { persistSession: false }, global: { fetch: async (input, options = {}) => {
      const url = new URL(String(input));
      assert.equal(url.hostname, 'patienten.synthetic.invalid');
      assert.equal(url.pathname, '/rest/v1/patients');
      calls.push({ url, method: options.method || 'GET' });
      if (options.method === 'POST') return new Response(JSON.stringify({ code: '23505', message: 'synthetic duplicate' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
      assert.equal(url.searchParams.get('owner_id'), 'eq.praxis-a');
      assert.equal(url.searchParams.get('geburtsdatum'), 'eq.1980-02-01');
      assert.equal(url.searchParams.get('nachname'), 'ilike.' + patientenNameMuster(patient.nachname));
      assert.equal(url.searchParams.get('vorname'), 'ilike.' + patientenNameMuster(patient.vorname));
      return new Response(JSON.stringify(lookupError ? { message: 'synthetic failure' } : existing), { status: lookupError ? 500 : 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const result = { status: 200 };
  const res = { status(code) { result.status = code; return this; }, json(body) { result.body = body; return this; } };
  const run = vm.runInNewContext('(async () => {\n' + source.slice(branchStart, branchEnd) + '\nreturn resolvedPatientId; })', {
    patient_id: null, owner_id: 'praxis-a', patient, supabase, patientenNameMuster, res,
  });
  try { result.id = await run(); } catch { result.failed = true; }
  return { ...result, calls };
}

test('Duplikat-Zuordnung verwendet beide Literalnamen und genau einen Treffer', async () => {
  const patient = { vorname: 'Änne', nachname: 'Test%_\\name', geburtsdatum: '1980-02-01' };
  const result = await duplicatePatient(patient, [{ id: 'exact-synthetic' }]);
  assert.equal(result.id, 'exact-synthetic');
  assert.equal(result.calls.length, 2);
  for (const existing of [[], [{ id: 'a' }, { id: 'b' }]]) {
    const ambiguous = await duplicatePatient(patient, existing);
    assert.equal(ambiguous.status, 409);
    assert.equal(typeof ambiguous.id, 'object'); // res, kein auflösbarer Patienten-Identifier
  }
  assert.equal((await duplicatePatient(patient, [], true)).failed, true);
});
test('Duplikat-Zuordnung weist Sternmuster vor dem Insert ab', async () => {
  const result = await duplicatePatient({ vorname: 'Änne', nachname: '*', geburtsdatum: '1980-02-01' }, []);
  assert.equal(result.status, 400);
  assert.equal(result.calls.length, 0);
});
