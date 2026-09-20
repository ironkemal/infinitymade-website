// § 302-Abrechnung — Tests für verworfeneNummerFesthalten() in verworfen.js.
//
// ⚠️ Der Import geht ausdrücklich auf `./verworfen.js` und NICHT auf
// `./abrechnung.routes.js`: die Route instanziiert beim Laden den service-role-Client
// und soll ohne Umgebungsvariablen laut sterben (server.js:166 process.exit(1)).
// Ein Test darf diesen Riegel nicht aufweichen — deshalb liegt die Funktion in
// einem eigenständigen Modul.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verworfeneNummerFesthalten, formatiereVerwerfungsgrund } from './verworfen.js';

function erstelleMockDb({ onInsert, error = null, throws = false }) {
  return {
    from(table) {
      assert.equal(table, 'abrechnung');
      return {
        async insert(payload) {
          if (onInsert) onInsert(payload);
          if (throws) throw new Error('DB-Netzwerkfehler');
          if (error) return { data: null, error };
          return { data: [payload], error: null };
        },
      };
    },
  };
}

test('0a. Ein gewoehnlicher Builder-Fehler wird NICHT als Preflight ausgegeben', () => {
  // Befund der Kaltpruefung 20.09.2026: der Ausdruck griff frueher auf jede
  // eckige Klammer zu und machte aus
  //   "prescription[0].verordnung.verordnungsart required"
  // die Begruendung "Preflight [0]". In einem GoBD-Feld ist eine falsche
  // Erklaerung schlimmer als gar keine — die Luecke waere dauerhaft falsch
  // dokumentiert gewesen.
  const grund = formatiereVerwerfungsgrund(
    new Error('prescription[0].verordnung.verordnungsart required')
  );
  assert.ok(!/^Preflight/.test(grund), `darf nicht als Preflight gelten: ${grund}`);
  assert.match(grund, /verordnungsart/);
});

test('0b. Ein echter Preflight-String liefert nur die Regelcodes', () => {
  const grund = formatiereVerwerfungsgrund(
    new Error('Preflight failed (2 errors): [F:03001] rechnung: fehlt; [P:01003] p[0].patient: fehlt')
  );
  assert.match(grund, /F:03001/);
  assert.match(grund, /P:01003/);
  // Kein Freitext aus der Meldung — nur Codes.
  assert.ok(!/patient/i.test(grund), `kein Freitext erwartet: ${grund}`);
});

test('0c. Parameterloser Aufruf wirft nicht', async () => {
  // Ohne `= {}` in der Signatur stuerzt schon das Destructuring ab, und zwar
  // VOR dem try/catch — also an der Zusage "wirft nie" vorbei.
  const ergebnis = await verworfeneNummerFesthalten();
  assert.equal(ergebnis, null);
});

test('1. Erfolgsfall schreibt die erwarteten Felder', async () => {
  let geschriebeneZeile = null;
  const mockDb = erstelleMockDb({
    onInsert(payload) {
      geschriebeneZeile = payload;
    },
  });

  const pfError = new Error('Preflight failed');
  pfError.preflight = {
    ok: false,
    errors: [
      { code: 'F:03001', severity: 'error', where: 'rechnung.datennummer', message: 'Datennummer ungültig' },
    ],
  };

  const res = await verworfeneNummerFesthalten({
    db: mockDb,
    ownerId: 'owner-uuid-123',
    kostentraegerIk: '108018007',
    sammelRechnungsnummer: 'SR-2026-38-00042',
    datennummer: 42,
    transfernummer: 5,
    empfaengerIk: '660530010',
    error: pfError,
  });

  assert.ok(res, 'Sollte ein Ergebnis zurückgeben');
  assert.ok(geschriebeneZeile, 'Insert muss aufgerufen worden sein');
  assert.equal(geschriebeneZeile.status, 'verworfen');
  assert.equal(geschriebeneZeile.owner_id, 'owner-uuid-123');
  assert.equal(geschriebeneZeile.kostentraeger_ik, '108018007');
  assert.equal(geschriebeneZeile.rechnungsnummer, 'SR-2026-38-00042');
  assert.equal(geschriebeneZeile.datenaustauschreferenz, 42);
  assert.equal(geschriebeneZeile.transfernummer, 5);
  assert.equal(geschriebeneZeile.empfaenger_ik, '660530010');
  assert.match(geschriebeneZeile.verwerfungsgrund, /F:03001/);

  // Keine Datei- oder Storage-Felder
  assert.equal(geschriebeneZeile.dateiname, undefined);
  assert.equal(geschriebeneZeile.storage_path, undefined);
  assert.equal(geschriebeneZeile.dta_file_size, undefined);
});

test('2. DB-Fehler wird geschluckt (kein Wurf)', async () => {
  // 2a: DB meldet Fehler (z. B. CHECK-Constraint lehnt 'verworfen' ab, weil Migration 0033 aussteht)
  const mockDbFehler = erstelleMockDb({
    error: { message: 'new row for relation "abrechnung" violates check constraint "abrechnung_status_check"' },
  });

  let threw = false;
  try {
    const res = await verworfeneNummerFesthalten({
      db: mockDbFehler,
      ownerId: 'owner-uuid-123',
      kostentraegerIk: '108018007',
      sammelRechnungsnummer: 'SR-1',
      datennummer: 1,
      transfernummer: 0,
      empfaengerIk: '660530010',
      error: new Error('Preflight fehlgeschlagen'),
    });
    assert.equal(res, null);
  } catch {
    threw = true;
  }
  assert.equal(threw, false, 'DB-Fehler darf nicht geworfen werden');

  // 2b: DB-Aufruf wirft eine Exception
  const mockDbException = erstelleMockDb({ throws: true });
  threw = false;
  try {
    const res = await verworfeneNummerFesthalten({
      db: mockDbException,
      ownerId: 'owner-uuid-123',
      kostentraegerIk: '108018007',
      error: new Error('irgendein Fehler'),
    });
    assert.equal(res, null);
  } catch {
    threw = true;
  }
  assert.equal(threw, false, 'Unerwartete Exception beim DB-Insert darf nicht geworfen werden');
});

test('3. Fehlende Pflichtfelder führen nicht zum Wurf', async () => {
  const mockDb = erstelleMockDb({});

  // Gar keine Argumente
  let res = await verworfeneNummerFesthalten({});
  assert.equal(res, null);

  // Ohne DB-Client
  res = await verworfeneNummerFesthalten({
    ownerId: 'owner-1',
    kostentraegerIk: '108018007',
  });
  assert.equal(res, null);

  // Ohne ownerId
  res = await verworfeneNummerFesthalten({
    db: mockDb,
    kostentraegerIk: '108018007',
  });
  assert.equal(res, null);

  // Ohne kostentraegerIk
  res = await verworfeneNummerFesthalten({
    db: mockDb,
    ownerId: 'owner-1',
  });
  assert.equal(res, null);
});

test('4. verwerfungsgrund enthält keine durchgereichte Freitext-Patientenangabe', async () => {
  let geschriebeneZeile = null;
  const mockDb = erstelleMockDb({
    onInsert(payload) {
      geschriebeneZeile = payload;
    },
  });

  // Preflight-Fehler mit vertraulichen Patientendaten im Fehlertext
  const pfError = new Error(
    'Preflight failed (2 errors): [PFLICHT_NAME] prescriptions[0].patient.name: Max Mustermann; [PFLICHT_KVNR] prescriptions[0].patient.kvnr: X123456789 ungültig'
  );
  pfError.preflight = {
    ok: false,
    errors: [
      {
        code: 'PFLICHT_NAME',
        severity: 'error',
        where: 'prescriptions[0].patient.name',
        message: 'Name "Max Mustermann" darf nicht leer sein',
      },
      {
        code: 'PFLICHT_KVNR',
        severity: 'error',
        where: 'prescriptions[0].patient.versichertennummer',
        message: 'KVNR X123456789 Prüfziffer falsch',
      },
    ],
  };

  await verworfeneNummerFesthalten({
    db: mockDb,
    ownerId: 'owner-uuid-1',
    kostentraegerIk: '108018007',
    sammelRechnungsnummer: 'SR-1',
    datennummer: 10,
    transfernummer: 2,
    empfaengerIk: '660530010',
    error: pfError,
  });

  assert.ok(geschriebeneZeile);
  const grund = geschriebeneZeile.verwerfungsgrund;

  // Regelcodes müssen enthalten sein
  assert.match(grund, /PFLICHT_NAME/);
  assert.match(grund, /PFLICHT_KVNR/);

  // PHI darf NICHT enthalten sein!
  assert.equal(grund.includes('Max Mustermann'), false, 'Darf keinen Patientennamen enthalten');
  assert.equal(grund.includes('X123456789'), false, 'Darf keine Versichertennummer enthalten');

  // Direkter Check von formatiereVerwerfungsgrund
  const grundText = formatiereVerwerfungsgrund(
    'Preflight failed (1 errors): [F:03002] prescriptions[0].patient: Erika Musterfrau A987654321'
  );
  assert.match(grundText, /F:03002/);
  assert.equal(grundText.includes('Erika Musterfrau'), false);
  assert.equal(grundText.includes('A987654321'), false);
});
