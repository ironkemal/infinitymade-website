// §302-Echtbetrieb, Schritt 1.7 (20.09.2026, gkv-302).
// Tests fuer ladeBetriebsart({ ownerId, empfaengerIk, cert, db }) in betriebsart.js.
//
// ⚠️ Der Import geht ausdruecklich auf `./betriebsart.js` und NICHT auf
// `./abrechnung.routes.js`: die Route baut beim Laden den service-role-Client
// und soll ohne Umgebungsvariablen hart sterben. Ein Test darf diesen Riegel
// nicht aufweichen — deshalb liegt die Logik in einem eigenen Modul.
//
// Fachlicher Hintergrund:
// Anlage 1 TP5 V21 Kap. 2 (1)(2), Kap. 3 (1) + Kap. 8, Anhang 2 zur Anlage 1
// Kap. 9 § 1/§ 5/§ 6: Erprobung und Zulassung zum Echtverfahren laufen zwischen
// Absender und Empfaenger. Die Ausnahme je Empfaenger (betriebsart_empfaenger)
// ueberschreibt den Vorgabewert des Zertifikats (terapeut_zertifikat.betriebsart).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ladeBetriebsart } from './betriebsart.js';

function erstelleMockDb({ data = null, error = null }) {
  return {
    from(table) {
      assert.equal(table, 'betriebsart_empfaenger');
      return {
        select(spalten) {
          return {
            eq(k1, v1) {
              return {
                eq(k2, v2) {
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
    },
  };
}

test('1. Zeile in betriebsart_empfaenger vorhanden -> deren Wert gewinnt, auch wenn Zertifikat abweicht', async () => {
  // Zertifikat sagt 'echt', aber fuer diese DAS ist 'test' konfiguriert
  const dbTest = erstelleMockDb({
    data: { betriebsart: 'test', zulassung_referenz: null, zulassung_datum: null },
  });
  const certEcht = {
    betriebsart: 'echt',
    zulassung_referenz: 'ZUL-PRAXIS-1',
    zulassung_datum: '2026-01-15',
  };
  const res1 = await ladeBetriebsart({
    ownerId: 'owner-uuid-1',
    empfaengerIk: '660530010',
    cert: certEcht,
    db: dbTest,
  });
  assert.equal(res1, 'test');

  // Zertifikat sagt 'test', aber fuer diese DAS ist 'erprobung' konfiguriert
  const dbErprobung = erstelleMockDb({
    data: { betriebsart: 'erprobung', zulassung_referenz: null, zulassung_datum: null },
  });
  const res2 = await ladeBetriebsart({
    ownerId: 'owner-uuid-1',
    empfaengerIk: '660530010',
    cert: { betriebsart: 'test' },
    db: dbErprobung,
  });
  assert.equal(res2, 'erprobung');

  // Zertifikat sagt 'test', aber fuer diese DAS ist 'echt' mit Zulassung konfiguriert
  const dbEcht = erstelleMockDb({
    data: {
      betriebsart: 'echt',
      zulassung_referenz: 'ZUL-DAS-99',
      zulassung_datum: '2026-06-01',
    },
  });
  const res3 = await ladeBetriebsart({
    ownerId: 'owner-uuid-1',
    empfaengerIk: '660530010',
    cert: { betriebsart: 'test' },
    db: dbEcht,
  });
  assert.equal(res3, 'echt');
});

test('2. Keine Zeile in betriebsart_empfaenger -> Vorgabewert aus cert.betriebsart gilt', async () => {
  const dbLeer = erstelleMockDb({ data: null });
  const certErprobung = { betriebsart: 'erprobung' };

  const res = await ladeBetriebsart({
    ownerId: 'owner-uuid-1',
    empfaengerIk: '660530010',
    cert: certErprobung,
    db: dbLeer,
  });
  assert.equal(res, 'erprobung');
});

test('3. Weder Zeile noch Zertifikat-Betriebsart vorhanden -> Rueckfall auf "test"', async () => {
  const dbLeer = erstelleMockDb({ data: null });

  // cert ist null
  const res1 = await ladeBetriebsart({
    ownerId: 'owner-uuid-1',
    empfaengerIk: '660530010',
    cert: null,
    db: dbLeer,
  });
  assert.equal(res1, 'test');

  // cert hat ungueltige/unbekannte Betriebsart
  const res2 = await ladeBetriebsart({
    ownerId: 'owner-uuid-1',
    empfaengerIk: '660530010',
    cert: { betriebsart: 'fantasie_modus' },
    db: dbLeer,
  });
  assert.equal(res2, 'test');
});

test('4. Zeile sagt "echt", Zulassungsangaben fehlen -> wirft mit status 422', async () => {
  // Referenz fehlt
  const dbOhneRef = erstelleMockDb({
    data: { betriebsart: 'echt', zulassung_referenz: '', zulassung_datum: '2026-02-01' },
  });
  await assert.rejects(
    async () => {
      await ladeBetriebsart({
        ownerId: 'owner-uuid-1',
        empfaengerIk: '660530010',
        cert: null,
        db: dbOhneRef,
      });
    },
    (err) => {
      assert.equal(err.status, 422);
      assert.match(err.message, /660530010/);
      assert.match(err.message, /Krankenkasse/);
      assert.match(err.message, /Zulassung/);
      return true;
    }
  );

  // Datum fehlt
  const dbOhneDatum = erstelleMockDb({
    data: { betriebsart: 'echt', zulassung_referenz: 'REF-123', zulassung_datum: null },
  });
  await assert.rejects(
    async () => {
      await ladeBetriebsart({
        ownerId: 'owner-uuid-1',
        empfaengerIk: '660530010',
        cert: null,
        db: dbOhneDatum,
      });
    },
    (err) => {
      assert.equal(err.status, 422);
      return true;
    }
  );
});

test('5. Vorgabewert sagt "echt", Zulassungsangaben fehlen -> wirft mit status 422', async () => {
  const dbLeer = erstelleMockDb({ data: null });
  const certEchtOhneZulassung = {
    betriebsart: 'echt',
    zulassung_referenz: '   ',
    zulassung_datum: null,
  };

  await assert.rejects(
    async () => {
      await ladeBetriebsart({
        ownerId: 'owner-uuid-1',
        empfaengerIk: '660530010',
        cert: certEchtOhneZulassung,
        db: dbLeer,
      });
    },
    (err) => {
      assert.equal(err.status, 422);
      assert.match(err.message, /Krankenkasse/);
      assert.match(err.message, /Zulassung/);
      return true;
    }
  );
});

test('6. Tabelle existiert nicht (42P01 / 42703) -> Vorgabewert, kein Wurf', async () => {
  const db42P01 = erstelleMockDb({
    error: { code: '42P01', message: 'relation "betriebsart_empfaenger" does not exist' },
  });
  const certErprobung = { betriebsart: 'erprobung' };

  const res = await ladeBetriebsart({
    ownerId: 'owner-uuid-1',
    empfaengerIk: '660530010',
    cert: certErprobung,
    db: db42P01,
  });
  assert.equal(res, 'erprobung');
});

test('8. Unvollstaendige Argumente -> wirft, statt still den Vorgabewert zu nehmen', async () => {
  // Befund der Kaltpruefung vom 20.09.2026: der frueher hier stehende
  // `if (db && ownerId && empfaengerIk)` uebersprang die Ausnahme stillschweigend.
  // Genau das ist der teure Fall: fuer diese Annahmestelle steht 'echt', der
  // Aufrufer vergisst die IK, und es geht eine Testdatei raus, die keine
  // Zahlung ausloest — ohne dass irgendwo etwas rot wird.
  const dbEcht = erstelleMockDb({
    data: { betriebsart: 'echt', zulassung_referenz: 'REF-1', zulassung_datum: '2026-05-05' },
  });

  for (const fehlend of [
    { ownerId: null,           empfaengerIk: '660530010', db: dbEcht },
    { ownerId: 'owner-uuid-1', empfaengerIk: null,        db: dbEcht },
    { ownerId: 'owner-uuid-1', empfaengerIk: '660530010', db: null   },
  ]) {
    await assert.rejects(
      async () => { await ladeBetriebsart({ ...fehlend, cert: { betriebsart: 'test' } }); },
      (err) => {
        assert.equal(err.status, 500);
        assert.match(err.message, /Pflicht/);
        return true;
      }
    );
  }
});

test('7. Beliebiger anderer DB-Fehler -> wirft Fehler mit status 500 (faellt nicht still auf "test")', async () => {
  const dbNetzwerkFehler = erstelleMockDb({
    error: { code: '08006', message: 'connection failure' },
  });
  const certEchtMitZulassung = {
    betriebsart: 'echt',
    zulassung_referenz: 'ZUL-123',
    zulassung_datum: '2026-03-01',
  };

  await assert.rejects(
    async () => {
      await ladeBetriebsart({
        ownerId: 'owner-uuid-1',
        empfaengerIk: '660530010',
        cert: certEchtMitZulassung,
        db: dbNetzwerkFehler,
      });
    },
    (err) => {
      assert.equal(err.status, 500);
      assert.match(err.message, /Fehler beim Lesen der Betriebsart/);
      assert.match(err.message, /connection failure/);
      return true;
    }
  );
});
