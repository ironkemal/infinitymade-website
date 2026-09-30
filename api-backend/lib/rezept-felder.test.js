import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  heilmittelPositionAufloesen,
  kostentraegerIkAufloesen,
  kartenIkNormalisieren,
} from './rezept-felder.js';

// ── kartenIkNormalisieren ───────────────────────────────────────────────────

test('kartenIkNormalisieren: Leerzeichen entfernen, 9 Ziffern prüfen', () => {
  assert.equal(kartenIkNormalisieren('108 310 400'), '108310400');
  assert.equal(kartenIkNormalisieren('12345'), null);
  assert.equal(kartenIkNormalisieren(null), null);
  assert.equal(kartenIkNormalisieren(undefined), null);
  assert.equal(kartenIkNormalisieren('abc'), null);
});

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
  function filterZeilen() {
    assert.equal(abfrage.active, true, 'jede Abfrage muss auf aktive Sätze einschränken');
    assert.equal(abfrage.echt, true, 'nur datensatz_status = echt');
    assert.equal(abfrage.gkv, true, 'nur payer_type = gkv');
    assert.ok(abfrage.heuteVon, 'valid_from-Filter fehlt');
    assert.ok(abfrage.heute, 'abgelaufene Sätze (valid_to < heute) müssen ausgeschlossen werden');
    let zeilen = kkRows.filter(r => r.active !== false
      && (r.datensatz_status ?? 'echt') === 'echt'
      && (r.payer_type ?? 'gkv') === 'gkv'
      && (!r.valid_to || r.valid_to >= abfrage.heute)
      && (!r.valid_from || r.valid_from <= abfrage.heuteVon));
    if (abfrage.eqIk !== null) zeilen = zeilen.filter(r => r.ik === abfrage.eqIk);
    if (abfrage.ilike !== null) zeilen = zeilen.filter(r => (r.name || '').toLowerCase().includes(abfrage.ilike));
    if (abfrage.in) zeilen = zeilen.filter(r => abfrage.in.includes(r.ik));
    return zeilen.map(r => ({ ik: r.ik, abrechnender_kt_ik: r.abrechnender_kt_ik ?? null }));
  }

  const api = {
    from(table) {
      assert.equal(table, 'kostentraeger');
      abfrage = { ilike: null, in: null, active: null, eqIk: null, echt: false, gkv: false, heute: null, heuteVon: null };
      return api;
    },
    select() { return api; },
    ilike(_col, val) { abfrage.ilike = String(val).replace(/%/g, '').toLowerCase(); return api; },
    in(col, liste) { assert.equal(col, 'ik'); abfrage.in = liste; return api; },
    eq(col, val) {
      if (col === 'active') {
        assert.equal(val, true);
        abfrage.active = val;
      } else if (col === 'ik') {
        abfrage.eqIk = val;
      } else if (col === 'datensatz_status') {
        abfrage.echt = val === 'echt';
      } else if (col === 'payer_type') {
        abfrage.gkv = val === 'gkv';
      }
      return api;
    },
    or(filter) {
      const m = /^valid_to\.is\.null,valid_to\.gte\.(\d{4}-\d{2}-\d{2})$/.exec(filter);
      const v = /^valid_from\.is\.null,valid_from\.lte\.(\d{4}-\d{2}-\d{2})$/.exec(filter);
      assert.ok(m || v, `unerwarteter or()-Filter: ${filter}`);
      if (m) abfrage.heute = m[1]; else abfrage.heuteVon = v[1];
      return api;
    },
    maybeSingle() {
      if (optionen.fehler) return Promise.resolve({ data: null, error: new Error('db down') });
      const zeilen = filterZeilen();
      return Promise.resolve({ data: zeilen[0] || null, error: null });
    },
    then(resolve) {
      if (optionen.fehler) return resolve({ data: null, error: new Error('db down') });
      const zeilen = filterZeilen();
      return resolve({ data: zeilen, error: null });
    },
  };
  return api;
}

test('patient.kostentraeger_ik wird ignoriert — stattdessen Namenssuche oder null', async () => {
  const supabase = makeSupabaseStub([{ name: 'AOK Rheinland/Hamburg', ik: '104212505' }]);
  // kostentraeger_ik gegeben, aber kein krankenkasse_ik: kostentraeger_ik wird ignoriert, Kassenname aufgelöst
  const ik1 = await kostentraegerIkAufloesen(supabase, { kostentraeger_ik: '999999999', krankenkasse: 'AOK Rheinland/Hamburg' });
  assert.equal(ik1, '104212505');

  // Nur kostentraeger_ik ohne Kassenname und ohne krankenkasse_ik -> null
  const ik2 = await kostentraegerIkAufloesen(supabase, { kostentraeger_ik: '999999999' });
  assert.equal(ik2, null);
});

test('krankenkasse_ik gegeben: sucht mit ik = Karten-IK und liefert abrechnender_kt_ik (Ersatzkasse-Fall: Karte != Kostenträger)', async () => {
  const supabase = makeSupabaseStub([
    { name: 'Techniker Krankenkasse', ik: '101575519', abrechnender_kt_ik: '104212505' },
    { name: 'Techniker Krankenkasse (Zentrale)', ik: '104212505' },
  ]);
  const ik = await kostentraegerIkAufloesen(supabase, {
    krankenkasse_ik: '101575519',
    kostentraeger_ik: '111111111', // wird ignoriert
    krankenkasse: 'Techniker Krankenkasse',
  });
  assert.equal(ik, '104212505');
  assert.notEqual(ik, '101575519');
});

test('krankenkasse_ik gegeben: Verweiskette wird bis zum Endpunkt verfolgt', async () => {
  const supabase = makeSupabaseStub([
    { name: 'BIG direkt gesund (vorm. BKK Victoria D.A.S.)', ik: '109531476', abrechnender_kt_ik: '104229606' },
    { name: 'BIG Zwischenstelle', ik: '104229606', abrechnender_kt_ik: '103501080' },
    { name: 'BIG direkt gesund (Haupt IK)', ik: '103501080' },
  ]);
  const ik = await kostentraegerIkAufloesen(supabase, { krankenkasse_ik: '109531476' });
  assert.equal(ik, '103501080');
});

test('Karten-IK nicht in kostentraeger -> null (kein Rückfall auf Namenssuche)', async () => {
  const supabase = makeSupabaseStub([
    { name: 'AOK Bayern', ik: '108310400' },
  ]);
  const ik = await kostentraegerIkAufloesen(supabase, {
    krankenkasse_ik: '109999999',
    krankenkasse: 'AOK Bayern',
  });
  assert.equal(ik, null);
});

test('ungültige Karten-IK ("12345", "abc") wird zu null normalisiert -> fällt auf Namenssuche zurück', async () => {
  const supabase = makeSupabaseStub([
    { name: 'AOK Rheinland/Hamburg', ik: '104212505' },
  ]);
  const ik1 = await kostentraegerIkAufloesen(supabase, {
    krankenkasse_ik: '12345',
    krankenkasse: 'AOK Rheinland/Hamburg',
  });
  assert.equal(ik1, '104212505');

  const ik2 = await kostentraegerIkAufloesen(supabase, {
    krankenkasse_ik: 'abc',
    krankenkasse: 'AOK Rheinland/Hamburg',
  });
  assert.equal(ik2, '104212505');
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

test('Sätze, die die View kostentraeger_auswahl nicht anbietet, werden nie aufgelöst (abgelaufen, privat, Testsatz)', async () => {
  const supabase = makeSupabaseStub([
    { name: 'Alt', ik: '101111111', valid_to: '2020-01-01' },
    { name: 'Privat', ik: '102222222', payer_type: 'pkv' },
    { name: 'Test', ik: '103333333', datensatz_status: 'test' },
    { name: 'Gueltig', ik: '104444444', valid_to: '2999-12-31' },
  ]);
  assert.equal(await kostentraegerIkAufloesen(supabase, { krankenkasse_ik: '101111111' }), null);
  assert.equal(await kostentraegerIkAufloesen(supabase, { krankenkasse_ik: '102222222' }), null);
  assert.equal(await kostentraegerIkAufloesen(supabase, { krankenkasse_ik: '103333333' }), null);
  assert.equal(await kostentraegerIkAufloesen(supabase, { krankenkasse_ik: '104444444' }), '104444444');
  // auch die Namenssuche und der Verweis-Sprung unterliegen denselben Filtern
  assert.equal(await kostentraegerIkAufloesen(supabase, { krankenkasse: 'Alt' }), null);
  const verweis = makeSupabaseStub([
    { name: 'Karte', ik: '105555555', abrechnender_kt_ik: '101111111' },
    { name: 'Ziel abgelaufen', ik: '101111111', valid_to: '2020-01-01' },
  ]);
  assert.equal(await kostentraegerIkAufloesen(verweis, { krankenkasse_ik: '105555555' }), null);
});

test('valid_from in der Zukunft: Satz wird nicht aufgelöst; valid_from in der Vergangenheit/leer schon', async () => {
  const stub = makeSupabaseStub([
    { name: 'Zukunft', ik: '101111111', valid_from: '2999-01-01' },
    { name: 'Vergangen', ik: '102222222', valid_from: '2020-01-01' },
    { name: 'Ohne', ik: '103333333' },
  ]);
  assert.equal(await kostentraegerIkAufloesen(stub, { krankenkasse_ik: '101111111' }), null);
  assert.equal(await kostentraegerIkAufloesen(stub, { krankenkasse_ik: '102222222' }), '102222222');
  assert.equal(await kostentraegerIkAufloesen(stub, { krankenkasse_ik: '103333333' }), '103333333');
});

// ── Stichtag (O-139): dieselbe Tageslogik wie ladeAnnahmestelle ───────────────

test('kostentraegerIkAufloesen: expliziter Stichtag steuert valid_from/valid_to (30.09. alt, 01.10. neu)', async () => {
  const zeilen = [
    { name: 'Alt-Kasse', ik: '111111111', valid_to: '2026-09-30' },
    { name: 'Neu-Kasse', ik: '222222222', valid_from: '2026-10-01' },
  ];
  const patAlt = { krankenkasse_ik: '111111111' };
  const patNeu = { krankenkasse_ik: '222222222' };
  assert.equal(await kostentraegerIkAufloesen(makeSupabaseStub(zeilen), patAlt, { stichtag: '2026-09-30' }), '111111111');
  assert.equal(await kostentraegerIkAufloesen(makeSupabaseStub(zeilen), patAlt, { stichtag: '2026-10-01' }), null);
  assert.equal(await kostentraegerIkAufloesen(makeSupabaseStub(zeilen), patNeu, { stichtag: '2026-09-30' }), null);
  assert.equal(await kostentraegerIkAufloesen(makeSupabaseStub(zeilen), patNeu, { stichtag: '2026-10-01' }), '222222222');
});

test('kostentraegerIkAufloesen: kaputter Stichtag -> null (kein Raten)', async () => {
  const supabase = makeSupabaseStub([{ name: 'X', ik: '111111111' }]);
  assert.equal(await kostentraegerIkAufloesen(supabase, { krankenkasse_ik: '111111111' }, { stichtag: '2026-13-40' }), null);
});
