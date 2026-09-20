// §302-Echtbetrieb, Schritt 1.10 (20.09.2026).
// Tests fuer uebermittlungProtokollieren({ ... }, { db }) in uebermittlung.js.
//
// ⚠️ Der Import geht ausdruecklich auf `./uebermittlung.js` und NICHT auf
// `./abrechnung.routes.js`: die Route baut beim Laden den service-role-Client
// und soll ohne Umgebungsvariablen hart sterben (server.js:166). Ein Test darf
// diesen Riegel nicht aufweichen — deshalb liegt die Hilfsfunktion in einem
// eigenen Modul und erhaelt die DB als Parameter.
//
// Gesetzliche Grundlage:
// Anlage 1 TP5 Kap. 3(2) (mindestens 2 Jahre Aufbewahrung fuer den gesamten
// Datenaustausch) und Anhang 1 § 4.5(2) (gesetzliche Mindestfelder).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uebermittlungProtokollieren, ERLAUBTE_RICHTUNGEN } from './uebermittlung.js';

function erstelleMockDb({
  data = { id: 'uebermittlung-uuid-1' },
  error = null,
  throwException = false,
} = {}) {
  const inserts = [];
  return {
    inserts,
    from(table) {
      assert.equal(table, 'abrechnung_uebermittlung');
      return {
        insert(row) {
          if (throwException) {
            throw new Error('Harter Datenbankfehler beim Insert-Aufruf');
          }
          inserts.push(row);
          return {
            select(cols) {
              assert.equal(cols, 'id');
              return {
                async maybeSingle() {
                  if (error) return { data: null, error };
                  return { data, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
}

test('1. Erfolgsfall: erwartete Pflicht- und Zusatzfelder landen im Insert, id kommt zurueck', async () => {
  const mockDb = erstelleMockDb({ data: { id: 'ubm-abc-123' } });
  const erstelltAm = new Date('2026-09-20T12:00:00Z');
  const begonnenAm = new Date('2026-09-20T12:00:01Z');
  const beendetAm = new Date('2026-09-20T12:00:05Z');

  const id = await uebermittlungProtokollieren(
    {
      owner_id: 'owner-uuid-42',
      business_id: 'biz-uuid-1',
      abrechnung_id: 'abr-uuid-99',
      antwort_auf: 'ubm-vorgaenger-0',
      richtung: 'senden',
      physikalischer_dateiname: 'ED010001',
      erstellt_am: erstelltAm,
      laufende_nummer: 1,
      transfernummer: 101,
      partner_ik: '109999999',
      partner_name: 'AOK Testkasse',
      begonnen_am: begonnenAm,
      beendet_am: beendetAm,
      dateigroesse_bytes: 4096,
      verarbeitungshinweise: 'Testnachricht ohne Fehler',
      verarbeitungskennzeichen: '01',
      fehlerstatus: 'ok',
      fehlertext: null,
      uebertragungsweg: 'dfue',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      betriebsart: 'test',
      absender_ik: '108888888',
      created_by: 'user-uuid-11',
    },
    { db: mockDb }
  );

  assert.equal(id, 'ubm-abc-123');
  assert.equal(mockDb.inserts.length, 1);
  const row = mockDb.inserts[0];
  assert.equal(row.owner_id, 'owner-uuid-42');
  assert.equal(row.business_id, 'biz-uuid-1');
  assert.equal(row.abrechnung_id, 'abr-uuid-99');
  assert.equal(row.antwort_auf, 'ubm-vorgaenger-0');
  assert.equal(row.richtung, 'senden');
  assert.equal(row.physikalischer_dateiname, 'ED010001');
  assert.equal(row.erstellt_am, '2026-09-20T12:00:00.000Z');
  assert.equal(row.laufende_nummer, 1);
  assert.equal(row.transfernummer, 101);
  assert.equal(row.partner_ik, '109999999');
  assert.equal(row.partner_name, 'AOK Testkasse');
  assert.equal(row.begonnen_am, '2026-09-20T12:00:01.000Z');
  assert.equal(row.beendet_am, '2026-09-20T12:00:05.000Z');
  assert.equal(row.dateigroesse_bytes, 4096);
  assert.equal(row.verarbeitungshinweise, 'Testnachricht ohne Fehler');
  assert.equal(row.verarbeitungskennzeichen, '01');
  assert.equal(row.fehlerstatus, 'ok');
  assert.equal(row.fehlertext, null);
  assert.equal(row.uebertragungsweg, 'dfue');
  assert.equal(row.sha256, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(row.betriebsart, 'test');
  assert.equal(row.absender_ik, '108888888');
  assert.equal(row.created_by, 'user-uuid-11');
});

test('2. DB-Fehler -> gibt null zurueck, KEIN Wurf (Kernzusage: Request-Fluss wird nie unterbrochen)', async () => {
  const mockDb = erstelleMockDb({
    error: { message: 'deadlock detected or connection lost', code: '40P01' },
  });

  const res = await uebermittlungProtokollieren(
    {
      owner_id: 'owner-1',
      richtung: 'senden',
      physikalischer_dateiname: 'ED010001',
      erstellt_am: '2026-09-20T12:00:00Z',
      partner_ik: '109999999',
    },
    { db: mockDb }
  );

  assert.equal(res, null);
});

test('3. Harte Exception beim DB-Zugriff -> wird geschluckt, gibt null zurueck, kein Wurf', async () => {
  const mockDb = erstelleMockDb({ throwException: true });

  const res = await uebermittlungProtokollieren(
    {
      owner_id: 'owner-1',
      richtung: 'senden',
      physikalischer_dateiname: 'ED010001',
      erstellt_am: '2026-09-20T12:00:00Z',
      partner_ik: '109999999',
    },
    { db: mockDb }
  );

  assert.equal(res, null);
});

test('4. Tabelle fehlt (42P01, Migration 0034 noch nicht eingespielt) -> gibt null zurueck, kein Wurf', async () => {
  const mockDb = erstelleMockDb({
    error: { message: 'relation "abrechnung_uebermittlung" does not exist', code: '42P01' },
  });

  const res = await uebermittlungProtokollieren(
    {
      owner_id: 'owner-1',
      richtung: 'senden',
      physikalischer_dateiname: 'ED010001',
      erstellt_am: '2026-09-20T12:00:00Z',
      partner_ik: '109999999',
    },
    { db: mockDb }
  );

  assert.equal(res, null);
});

test('5. Pflichtfeld fehlt -> gibt null zurueck, KEIN Insert-Versuch', async () => {
  const mockDb = erstelleMockDb();

  const basis = {
    owner_id: 'owner-1',
    richtung: 'senden',
    physikalischer_dateiname: 'ED010001',
    erstellt_am: '2026-09-20T12:00:00Z',
    partner_ik: '109999999',
  };

  // owner_id fehlt
  const r1 = await uebermittlungProtokollieren({ ...basis, owner_id: '' }, { db: mockDb });
  assert.equal(r1, null);

  // richtung fehlt
  const r2 = await uebermittlungProtokollieren({ ...basis, richtung: null }, { db: mockDb });
  assert.equal(r2, null);

  // physikalischer_dateiname fehlt
  const r3 = await uebermittlungProtokollieren({ ...basis, physikalischer_dateiname: '   ' }, { db: mockDb });
  assert.equal(r3, null);

  // erstellt_am fehlt
  const r4 = await uebermittlungProtokollieren({ ...basis, erstellt_am: null }, { db: mockDb });
  assert.equal(r4, null);

  // partner_ik fehlt
  const r5 = await uebermittlungProtokollieren({ ...basis, partner_ik: undefined }, { db: mockDb });
  assert.equal(r5, null);

  // Keiner dieser fehlerhaften Aufrufe darf einen Insert versucht haben
  assert.equal(mockDb.inserts.length, 0);
});

test('6. richtung ausserhalb "senden"|"empfangen" -> wird abgefangen, gibt null zurueck, kein Insert-Versuch', async () => {
  const mockDb = erstelleMockDb();

  // Begruendung: Ein ungueltiger Richtungswert wuerde in der DB den Check-Constraint
  // abr_uebermittlung_richtung_chk verletzen. Ein vorheriges Abfangen spart den unnoetigen
  // DB-Roundtrip und verhindert fehlerhafte Zeileneintraege.
  const ungueltigeRichtungen = ['upload', 'download', 'post', 'get', 'mail', 'unbekannt', ''];

  for (const r of ungueltigeRichtungen) {
    const res = await uebermittlungProtokollieren(
      {
        owner_id: 'owner-1',
        richtung: r,
        physikalischer_dateiname: 'ED010001',
        erstellt_am: '2026-09-20T12:00:00Z',
        partner_ik: '109999999',
      },
      { db: mockDb }
    );
    assert.equal(res, null);
  }

  assert.equal(mockDb.inserts.length, 0);

  // Gegenprobe: 'empfangen' ist erlaubt und fuehrt zu einem erfolgreichen Insert
  const resEmpfangen = await uebermittlungProtokollieren(
    {
      owner_id: 'owner-1',
      richtung: 'empfangen',
      physikalischer_dateiname: 'RE010001',
      erstellt_am: '2026-09-20T12:00:00Z',
      partner_ik: '109999999',
    },
    { db: mockDb }
  );
  assert.equal(resEmpfangen, 'uebermittlung-uuid-1');
  assert.equal(mockDb.inserts.length, 1);
  assert.equal(mockDb.inserts[0].richtung, 'empfangen');
});

test('7. Kein db-Client uebergeben -> gibt null zurueck, wirft nicht', async () => {
  const res = await uebermittlungProtokollieren({
    owner_id: 'owner-1',
    richtung: 'senden',
    physikalischer_dateiname: 'ED010001',
    erstellt_am: '2026-09-20T12:00:00Z',
    partner_ik: '109999999',
  });
  assert.equal(res, null);
});

test('8. Striktes Whitelisting (PHI-Schutz): Patientenfelder landen niemals im Insert-Objekt', async () => {
  const mockDb = erstelleMockDb();

  await uebermittlungProtokollieren(
    {
      owner_id: 'owner-1',
      richtung: 'senden',
      physikalischer_dateiname: 'ED010001',
      erstellt_am: '2026-09-20T12:00:00Z',
      partner_ik: '109999999',
      // Versehentlich mitgelieferte Patientenfelder
      patient_name: 'Erika Mustermann',
      versichertennummer: 'A123456789',
      geburtsdatum: '1980-01-01',
      diagnose: 'M79.1',
      arzt_name: 'Dr. Test',
    },
    { db: mockDb }
  );

  assert.equal(mockDb.inserts.length, 1);
  const row = mockDb.inserts[0];
  assert.equal(row.patient_name, undefined);
  assert.equal(row.versichertennummer, undefined);
  assert.equal(row.geburtsdatum, undefined);
  assert.equal(row.diagnose, undefined);
  assert.equal(row.arzt_name, undefined);
});
