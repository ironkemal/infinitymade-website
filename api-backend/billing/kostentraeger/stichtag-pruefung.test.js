// Tests für Stichtag-Prüfung am Übermittlungstag (§ 302, Quartalswechsel)
//   node --test api-backend/billing/kostentraeger/stichtag-pruefung.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  quartalVon,
  berlinTagVon,
  anschriftGleich,
  bewerteEmpfaengerWechsel,
  pruefeEmpfaenger,
} from './stichtag-pruefung.js';

// ---------------------------------------------------------------------------
// 1. quartalVon
// ---------------------------------------------------------------------------

test('quartalVon: Q1 bis Q4 und Jahreswechsel', () => {
  assert.equal(quartalVon('2026-01-15'), 'Q1/2026');
  assert.equal(quartalVon('2026-03-31'), 'Q1/2026');
  assert.equal(quartalVon('2026-04-01'), 'Q2/2026');
  assert.equal(quartalVon('2026-06-30'), 'Q2/2026');
  assert.equal(quartalVon('2026-07-01'), 'Q3/2026');
  assert.equal(quartalVon('2026-09-30'), 'Q3/2026');
  assert.equal(quartalVon('2026-10-01'), 'Q4/2026');
  assert.equal(quartalVon('2026-12-31'), 'Q4/2026');
  assert.equal(quartalVon('2027-01-01'), 'Q1/2027');
  assert.equal(quartalVon(''), '');
  assert.equal(quartalVon(null), '');
});

// ---------------------------------------------------------------------------
// 2. berlinTagVon
// ---------------------------------------------------------------------------

test('berlinTagVon: Zeitzonen-Sicherheit für Berliner Tag', () => {
  // 30.09. 22:30 UTC = 01.10. 00:30 MESZ (Berlin)
  assert.equal(berlinTagVon('2026-09-30T22:30:00.000Z'), '2026-10-01');
  // 30.09. 10:00 UTC = 30.09. 12:00 MESZ (Berlin)
  assert.equal(berlinTagVon('2026-09-30T10:00:00.000Z'), '2026-09-30');
  // Plain date string
  assert.equal(berlinTagVon('2026-09-30'), '2026-09-30');
  assert.equal(berlinTagVon(null), null);
});

// ---------------------------------------------------------------------------
// 3. anschriftGleich
// ---------------------------------------------------------------------------

test('anschriftGleich: erkennt gleiche und abweichende Adressen', () => {
  const adr1 = { art: '1', plz: '10115', ort: 'Berlin', strasse: 'Musterstr. 10' };
  const adr2 = { art: '1', plz: '10115', ort: 'berlin', strasse: 'Musterstr. 10' }; // Case-insensitive
  const adr3 = { art: '1', plz: '10115', ort: 'Berlin', strasse: 'Neue Str. 5' };

  assert.equal(anschriftGleich(adr1, adr2), true);
  assert.equal(anschriftGleich(adr1, adr3), false);
  assert.equal(anschriftGleich(null, null), true);
  assert.equal(anschriftGleich(adr1, null), false);
});

// ---------------------------------------------------------------------------
// 4. bewerteEmpfaengerWechsel (Kernregeln)
// ---------------------------------------------------------------------------

test('gleiche IK / gleiches Quartal → leer (keine Meldungen, nicht blockiert)', () => {
  const r = bewerteEmpfaengerWechsel({
    gespeichertIk: '100000001',
    heuteDas:      { ok: true, ik: '100000001', name: 'AOK DAS' },
    papierDamals:  { ok: true, ik: '200000001', anschrift: { plz: '10115', ort: 'Berlin', strasse: 'A 1' } },
    papierHeute:   { ok: true, ik: '200000001', anschrift: { plz: '10115', ort: 'Berlin', strasse: 'A 1' } },
    erstelltTag:   '2026-10-05',
    heuteTag:      '2026-10-10',
  });

  assert.equal(r.blockiert, false);
  assert.deepEqual(r.meldungen, []);
});

test('IK anders → blockiert (EMPFAENGER_GEAENDERT)', () => {
  const r = bewerteEmpfaengerWechsel({
    gespeichertIk: '100000001',
    heuteDas:      { ok: true, ik: '100000002', name: 'Neue DAS' },
    papierDamals:  { ok: true, ik: '200000001' },
    papierHeute:   { ok: true, ik: '200000001' },
    erstelltTag:   '2026-10-05',
    heuteTag:      '2026-10-10',
  });

  assert.equal(r.blockiert, true);
  assert.equal(r.meldungen.length, 1);
  assert.equal(r.meldungen[0].code, 'EMPFAENGER_GEAENDERT');
  assert.equal(r.meldungen[0].stufe, 'block');
  assert.match(r.meldungen[0].text, /alt: 100000001, heute: 100000002/);
});

test('heute nicht auflösbar → blockiert (mit vorhandenem Grund)', () => {
  const r = bewerteEmpfaengerWechsel({
    gespeichertIk: '100000001',
    heuteDas:      { ok: false, grund: 'keine elektronische Datenannahmestelle hinterlegt' },
    papierDamals:  { ok: true, ik: '200000001' },
    papierHeute:   { ok: true, ik: '200000001' },
    erstelltTag:   '2026-10-05',
    heuteTag:      '2026-10-10',
  });

  assert.equal(r.blockiert, true);
  assert.equal(r.meldungen[0].code, 'KEINE_DATENANNAHMESTELLE');
  assert.equal(r.meldungen[0].stufe, 'block');
  assert.equal(r.meldungen[0].text, 'keine elektronische Datenannahmestelle hinterlegt');
});

test('Papier-IK anders → blockiert (PAPIERANNAHMESTELLE_GEAENDERT)', () => {
  const r = bewerteEmpfaengerWechsel({
    gespeichertIk: '100000001',
    heuteDas:      { ok: true, ik: '100000001' },
    papierDamals:  { ok: true, ik: '200000001' },
    papierHeute:   { ok: true, ik: '200000002' },
    erstelltTag:   '2026-10-05',
    heuteTag:      '2026-10-10',
  });

  assert.equal(r.blockiert, true);
  const m = r.meldungen.find(x => x.code === 'PAPIERANNAHMESTELLE_GEAENDERT');
  assert.ok(m);
  assert.equal(m.stufe, 'block');
  assert.match(m.text, /alt: 200000001, heute: 200000002/);
});

test('Papier-Anschrift anders → Warnung (PAPIERANNAHMESTELLE_ANSCHRIFT_GEAENDERT)', () => {
  const r = bewerteEmpfaengerWechsel({
    gespeichertIk: '100000001',
    heuteDas:      { ok: true, ik: '100000001' },
    papierDamals:  { ok: true, ik: '200000001', anschrift: { art: '1', plz: '10115', ort: 'Berlin', strasse: 'Alte Str. 1' } },
    papierHeute:   { ok: true, ik: '200000001', anschrift: { art: '1', plz: '10115', ort: 'Berlin', strasse: 'Neue Str. 2' } },
    erstelltTag:   '2026-10-05',
    heuteTag:      '2026-10-10',
  });

  assert.equal(r.blockiert, false);
  assert.equal(r.meldungen.length, 1);
  assert.equal(r.meldungen[0].code, 'PAPIERANNAHMESTELLE_ANSCHRIFT_GEAENDERT');
  assert.equal(r.meldungen[0].stufe, 'warnung');
});

test('30.09.2026 → 01.10.2026 → QUARTALSWECHSEL-Warnung', () => {
  const r = bewerteEmpfaengerWechsel({
    gespeichertIk: '100000001',
    heuteDas:      { ok: true, ik: '100000001' },
    papierDamals:  { ok: true, ik: '200000001', anschrift: { plz: '10115', ort: 'Berlin', strasse: 'Weg 1' } },
    papierHeute:   { ok: true, ik: '200000001', anschrift: { plz: '10115', ort: 'Berlin', strasse: 'Weg 1' } },
    erstelltTag:   '2026-09-30',
    heuteTag:      '2026-10-01',
  });

  assert.equal(r.blockiert, false);
  assert.equal(r.meldungen.length, 1);
  assert.equal(r.meldungen[0].code, 'QUARTALSWECHSEL');
  assert.equal(r.meldungen[0].stufe, 'warnung');
  assert.equal(
    r.meldungen[0].text,
    'Erstellt im Quartal Q3/2026, Übermittlung im Quartal Q4/2026 — Anschrift/Zertifikat der Annahmestelle prüfen.'
  );
});

test('31.12.2026 → 01.01.2027 → Q4/2026 vs Q1/2027 Warnung', () => {
  const r = bewerteEmpfaengerWechsel({
    gespeichertIk: '100000001',
    heuteDas:      { ok: true, ik: '100000001' },
    papierDamals:  { ok: true, ik: '200000001' },
    papierHeute:   { ok: true, ik: '200000001' },
    erstelltTag:   '2026-12-31',
    heuteTag:      '2027-01-01',
  });

  assert.equal(r.blockiert, false);
  assert.equal(r.meldungen.length, 1);
  assert.equal(r.meldungen[0].code, 'QUARTALSWECHSEL');
  assert.equal(r.meldungen[0].stufe, 'warnung');
  assert.equal(
    r.meldungen[0].text,
    'Erstellt im Quartal Q4/2026, Übermittlung im Quartal Q1/2027 — Anschrift/Zertifikat der Annahmestelle prüfen.'
  );
});

// ---------------------------------------------------------------------------
// 5. pruefeEmpfaenger mit Fake-Supabase
// ---------------------------------------------------------------------------

test('pruefeEmpfaenger: ruft ladeAnnahmestelle und ladePapierannahmestelle mit Stichtagen auf', async () => {
  // Fake-DB liefert am 30.09. Empfänger A, ab 01.10. Empfänger B
  const fakeVkgRows = [
    // Elektronisch (07 / 03)
    {
      partner_ik: '100000001',
      verknuepfungsart: '03',
      abrechnungscode: '20',
      art_datenlieferung: '07',
      bundesland: '',
      quelle: 'AO01',
      valid_from: '2026-07-01',
      valid_to: '2026-09-30',
    },
    {
      partner_ik: '100000002',
      verknuepfungsart: '03',
      abrechnungscode: '20',
      art_datenlieferung: '07',
      bundesland: '',
      quelle: 'AO01',
      valid_from: '2026-10-01',
      valid_to: null,
    },
    // Papier (21 / 09)
    {
      partner_ik: '200000001',
      verknuepfungsart: '09',
      abrechnungscode: '20',
      art_datenlieferung: '21',
      bundesland: '',
      valid_from: null,
      valid_to: null,
    },
  ];

  const fakeSupabase = {
    from(table) {
      return {
        select() {
          return {
            eq() {
              if (table === 'kostentraeger_annahmestellen') {
                return Promise.resolve({ data: fakeVkgRows, error: null });
              }
              if (table === 'kostentraeger') {
                return {
                  maybeSingle: async () => ({ data: { name: 'Krankenkasse A' }, error: null }),
                };
              }
              if (table === 'kostentraeger_anschriften') {
                return Promise.resolve({ data: [], error: null });
              }
              return Promise.resolve({ data: [], error: null });
            },
          };
        },
      };
    },
  };

  const abZeile = {
    kostentraeger_ik: '109999999',
    empfaenger_ik:    '100000001', // Am 30.09. erstellt
    created_at:       '2026-09-30T10:00:00Z',
  };

  // Testfall 1: Heute ist der 30.09.2026 -> Keine Änderung, kein Block
  const res30 = await pruefeEmpfaenger(fakeSupabase, abZeile, {
    bereich: 'physiotherapy',
    eigenerAbrechnungscode: '22',
    heuteTag: '2026-09-30',
  });
  assert.equal(res30.blockiert, false);
  assert.equal(res30.gespeichertIk, '100000001');
  assert.equal(res30.heuteIk, '100000001');

  // Testfall 2: Heute ist der 01.10.2026 -> Empfänger hat gewechselt -> Block!
  const res01 = await pruefeEmpfaenger(fakeSupabase, abZeile, {
    bereich: 'physiotherapy',
    eigenerAbrechnungscode: '22',
    heuteTag: '2026-10-01',
  });
  assert.equal(res01.blockiert, true);
  assert.equal(res01.gespeichertIk, '100000001');
  assert.equal(res01.heuteIk, '100000002');
  assert.ok(res01.meldungen.some(m => m.code === 'EMPFAENGER_GEAENDERT' && m.stufe === 'block'));
});

// ---------------------------------------------------------------------------
// 6. bereichFuerAbrechnung (Routen-Helfer)
// ---------------------------------------------------------------------------

test('bereichFuerAbrechnung: erkennt Podologie vs. Physio/Ergo', async () => {
  // Mock dummy env vars for routes import
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

  const { bereichFuerAbrechnung } = await import('../api/abrechnung.routes.js');

  // Fall 1: abrechnung_zeile hat 'podo'
  const mockDbPodoZeile = {
    from(table) {
      if (table === 'abrechnung_zeile') {
        return {
          select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { therapie_bereich: 'podo' } }) }) }) }),
        };
      }
      throw new Error(`Unbekannte Tabelle: ${table}`);
    },
  };
  const r1 = await bereichFuerAbrechnung(mockDbPodoZeile, { id: 'ab-1' });
  assert.equal(r1.bereich, 'podologie');
  assert.equal(r1.eigenerAbrechnungscode, '71');

  // Fall 2: Keine Zeile, aber prescription hat 'podo'
  const mockDbPodoRx = {
    from(table) {
      if (table === 'abrechnung_zeile') {
        return {
          select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
        };
      }
      if (table === 'prescriptions') {
        return {
          select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { therapie_bereich: 'podo' } }) }) }) }),
        };
      }
      throw new Error(`Unbekannte Tabelle: ${table}`);
    },
  };
  const r2 = await bereichFuerAbrechnung(mockDbPodoRx, { id: 'ab-2' });
  assert.equal(r2.bereich, 'podologie');
  assert.equal(r2.eigenerAbrechnungscode, '71');

  // Fall 3: Physio über Mandantenprofil
  const mockDbPhysio = {
    from(table) {
      if (table === 'abrechnung_zeile') {
        return {
          select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { therapie_bereich: 'physio' } }) }) }) }),
        };
      }
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { sector: 'physiotherapy' } }) }) }),
        };
      }
      throw new Error(`Unbekannte Tabelle: ${table}`);
    },
  };
  const r3 = await bereichFuerAbrechnung(mockDbPhysio, { id: 'ab-3', owner_id: 't-1' });
  assert.equal(r3.bereich, 'physiotherapy');
  assert.equal(r3.eigenerAbrechnungscode, '22');

  // Fall 4: Ergotherapie
  const mockDbErgo = {
    from(table) {
      if (table === 'abrechnung_zeile') {
        return {
          select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
        };
      }
      if (table === 'prescriptions') {
        return {
          select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
        };
      }
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { sector: 'ergotherapie' } }) }) }),
        };
      }
      throw new Error(`Unbekannte Tabelle: ${table}`);
    },
  };
  const r4 = await bereichFuerAbrechnung(mockDbErgo, { id: 'ab-4', owner_id: 't-2' });
  assert.equal(r4.bereich, 'ergotherapie');
  assert.equal(r4.eigenerAbrechnungscode, '26');
});

test('bewerteEmpfaengerWechsel: ohne gespeicherte empfaenger_ik kein Block (Altbestand)', () => {
  const r = bewerteEmpfaengerWechsel({
    gespeichertIk: null,
    heuteDas: { ok: true, ik: '109905003' },
    erstelltTag: '2026-10-01', heuteTag: '2026-10-01',
  });
  assert.equal(r.blockiert, false);
  assert.deepEqual(r.meldungen, []);
});
