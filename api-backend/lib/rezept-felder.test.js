import { test } from 'node:test';
import assert from 'node:assert/strict';

import { heilmittelPositionAufloesen, kostentraegerIkAufloesen } from './rezept-felder.js';

// ── heilmittelPositionAufloesen ─────────────────────────────────────────────

test('explizite Template-Positionsnummer wird aufgelöst', () => {
  assert.equal(heilmittelPositionAufloesen({ heilmittel_position: 'X0501' }), '20501');
});

test('schon aufgelöste Positionsnummer bleibt stehen', () => {
  assert.equal(heilmittelPositionAufloesen({ heilmittel_position: '20501' }), '20501');
});

test('unbekanntes Format wird nicht verworfen — der Therapeut hat etwas eingetragen', () => {
  assert.equal(heilmittelPositionAufloesen({ heilmittel_position: 'was auch immer' }), 'was auch immer');
});

test('ohne explizite Angabe wird aus dem Heilmittel-Kurzcode geraten', () => {
  assert.equal(heilmittelPositionAufloesen({ heilmittel: 'KG' }), '20501');
});

test('kein Heilmittel und keine Position -> null, nicht geraten', () => {
  assert.equal(heilmittelPositionAufloesen({}), null);
  assert.equal(heilmittelPositionAufloesen(undefined), null);
});

test('explizite Position gewinnt gegen den Rate-Zweig', () => {
  assert.equal(heilmittelPositionAufloesen({ heilmittel_position: 'X1201', heilmittel: 'KG' }), '21201');
});

// ── kostentraegerIkAufloesen ────────────────────────────────────────────────

/** Minimaler Supabase-Stub für die eine Kette, die kostentraegerIkAufloesen benutzt. */
function makeSupabaseStub(kkRows = []) {
  let letzteIlike = null;
  const api = {
    from(table) {
      assert.equal(table, 'kostentraeger');
      return api;
    },
    select() { return api; },
    ilike(_col, val) { letzteIlike = val; return api; },
    eq(col, val) { assert.equal(col, 'active'); assert.equal(val, true); return api; },
    limit() { return api; },
    async maybeSingle() {
      const needle = String(letzteIlike || '').replace(/%/g, '').toLowerCase();
      const treffer = kkRows.find(r => r.name.toLowerCase().includes(needle));
      return { data: treffer ? { ik: treffer.ik } : null, error: null };
    },
  };
  return api;
}

test('ein mitgegebenes IK gewinnt immer — keine Suche', async () => {
  const supabase = makeSupabaseStub([{ name: 'AOK', ik: '999999999' }]);
  const ik = await kostentraegerIkAufloesen(supabase, { kostentraeger_ik: '104212505', krankenkasse: 'AOK' });
  assert.equal(ik, '104212505');
});

test('ohne IK wird über den Kassennamen gesucht', async () => {
  const supabase = makeSupabaseStub([{ name: 'AOK Rheinland/Hamburg', ik: '104212505' }]);
  const ik = await kostentraegerIkAufloesen(supabase, { krankenkasse: 'AOK Rheinland/Hamburg' });
  assert.equal(ik, '104212505');
});

test('weder IK noch Kassenname -> null, keine Suche', async () => {
  const supabase = makeSupabaseStub([{ name: 'AOK', ik: '999999999' }]);
  const ik = await kostentraegerIkAufloesen(supabase, {});
  assert.equal(ik, null);
});

test('kein Treffer -> null', async () => {
  const supabase = makeSupabaseStub([{ name: 'AOK', ik: '999999999' }]);
  const ik = await kostentraegerIkAufloesen(supabase, { krankenkasse: 'Unbekannte Kasse' });
  assert.equal(ik, null);
});
