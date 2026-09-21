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

/**
 * Minimaler Supabase-Stub für die zwei Abfragen, die kostentraegerIkAufloesen benutzt:
 * `select().ilike('name').eq('active')` (Namenssuche) und `select().in('ik').eq('active')`
 * (Verweis-Endpunkte). Wie beim echten Client ist der Builder selbst awaitbar.
 * Zeilen: `{ name, ik, abrechnender_kt_ik?, active? }` — `active` fehlt = aktiv.
 * `optionen.fehler`: jede Abfrage liefert dann `error` statt Daten.
 */
function makeSupabaseStub(kkRows = [], optionen = {}) {
  let abfrage;
  const api = {
    from(table) {
      assert.equal(table, 'kostentraeger');
      abfrage = { ilike: null, in: null, active: null };
      return api;
    },
    select() { return api; },
    ilike(_col, val) { abfrage.ilike = String(val).replace(/%/g, '').toLowerCase(); return api; },
    in(col, liste) { assert.equal(col, 'ik'); abfrage.in = liste; return api; },
    eq(col, val) { assert.equal(col, 'active'); assert.equal(val, true); abfrage.active = val; return api; },
    then(resolve) {
      if (optionen.fehler) return resolve({ data: null, error: new Error('db down') });
      assert.equal(abfrage.active, true, 'jede Abfrage muss auf aktive Sätze einschränken');
      let zeilen = kkRows.filter(r => r.active !== false);
      if (abfrage.ilike !== null) zeilen = zeilen.filter(r => r.name.toLowerCase().includes(abfrage.ilike));
      if (abfrage.in) zeilen = zeilen.filter(r => abfrage.in.includes(r.ik));
      return resolve({
        data: zeilen.map(r => ({ ik: r.ik, abrechnender_kt_ik: r.abrechnender_kt_ik ?? null })),
        error: null,
      });
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

test('Kassenname nur aus Leerzeichen -> null, keine Suche', async () => {
  const supabase = makeSupabaseStub([{ name: 'AOK', ik: '999999999' }]);
  const ik = await kostentraegerIkAufloesen(supabase, { krankenkasse: '   ' });
  assert.equal(ik, null);
});

// ── Ops #301: eindeutig oder gar nicht ──────────────────────────────────────
// Die Beispiele sind echte Fälle aus der Kostenträgerdatei Q3/2026 (IKs
// unverändert), die Namen vereinfacht.

test('mehrere Treffer, die auf VERSCHIEDENE Kostenträger führen -> null (AOK NordWest: zwei Regionen)', async () => {
  const supabase = makeSupabaseStub([
    { name: 'AOK NORDWEST (Region Schleswig-Holstein)', ik: '101317004' },
    { name: 'AOK NORDWEST (Region Westfalen-Lippe)', ik: '103411401' },
  ]);
  const ik = await kostentraegerIkAufloesen(supabase, { krankenkasse: 'AOK NordWest' });
  assert.equal(ik, null);
});

test('mehrere Treffer, die alle auf EINEN Kostenträger führen -> dessen IK (Mobil)', async () => {
  const supabase = makeSupabaseStub([
    { name: 'Mobil Krankenkasse', ik: '101520078' },
    { name: 'Mobil Krankenkasse', ik: '102120076', abrechnender_kt_ik: '101520078' },
    { name: 'Mobil Krankenkasse Ost', ik: '102192471', abrechnender_kt_ik: '101520078' },
  ]);
  const ik = await kostentraegerIkAufloesen(supabase, { krankenkasse: 'Mobil Krankenkasse' });
  assert.equal(ik, '101520078');
});

test('trifft die Suche nur Filialen, wird der Kostenträger geliefert, nicht die Filiale', async () => {
  const supabase = makeSupabaseStub([
    { name: 'Filiale Nord', ik: '111111111', abrechnender_kt_ik: '999999999' },
    { name: 'Filiale Süd', ik: '222222222', abrechnender_kt_ik: '999999999' },
    { name: 'Hauptverwaltung', ik: '999999999' },
  ]);
  const ik = await kostentraegerIkAufloesen(supabase, { krankenkasse: 'Filiale' });
  assert.equal(ik, '999999999');
});

test('Verweiskette wird bis zum Kostenträger verfolgt (BIG direkt gesund)', async () => {
  const supabase = makeSupabaseStub([
    { name: 'BIG direkt gesund (vorm. BKK Victoria D.A.S.)', ik: '109531476', abrechnender_kt_ik: '104229606' },
    { name: 'BIG Zwischenstelle', ik: '104229606', abrechnender_kt_ik: '103501080' },
    { name: 'BIG direkt gesund (Haupt IK)', ik: '103501080' },
  ]);
  const ik = await kostentraegerIkAufloesen(supabase, { krankenkasse: 'vorm. BKK Victoria' });
  assert.equal(ik, '103501080');
});

test('Verweisschleife -> null statt Endlosschleife', async () => {
  const supabase = makeSupabaseStub([
    { name: 'Kreiskasse', ik: '111111111', abrechnender_kt_ik: '222222222' },
    { name: 'Andere Stelle', ik: '222222222', abrechnender_kt_ik: '111111111' },
  ]);
  const ik = await kostentraegerIkAufloesen(supabase, { krankenkasse: 'Kreiskasse' });
  assert.equal(ik, null);
});

test('Verweisziel nicht (mehr) aktiv -> null', async () => {
  const supabase = makeSupabaseStub([
    { name: 'Filiale Nord', ik: '111111111', abrechnender_kt_ik: '999999999' },
    { name: 'Hauptverwaltung', ik: '999999999', active: false },
  ]);
  const ik = await kostentraegerIkAufloesen(supabase, { krankenkasse: 'Filiale' });
  assert.equal(ik, null);
});

test('Verweisziel fehlt in kostentraeger -> null', async () => {
  const supabase = makeSupabaseStub([{ name: 'Filiale Nord', ik: '111111111', abrechnender_kt_ik: '999999999' }]);
  const ik = await kostentraegerIkAufloesen(supabase, { krankenkasse: 'Filiale' });
  assert.equal(ik, null);
});

test('Datenbankfehler -> null, kein Wurf', async () => {
  const supabase = makeSupabaseStub([{ name: 'AOK', ik: '999999999' }], { fehler: true });
  const ik = await kostentraegerIkAufloesen(supabase, { krankenkasse: 'AOK' });
  assert.equal(ik, null);
});
