import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindeSitzungenAnTermin, bindungsFehlerText } from './sitzung-bindung.js';

/** Minimaler Supabase-Doppelgänger: `.from().update().in().select()`. */
function sbAttrappe({ data = null, error = null, protokoll = {} } = {}) {
  return {
    from(tabelle) {
      protokoll.tabelle = tabelle;
      return {
        update(werte) {
          protokoll.werte = werte;
          return {
            in(spalte, ids) {
              protokoll.ids = ids;
              return { select: async () => ({ data, error }) };
            },
          };
        },
      };
    },
  };
}

test('der Kombi-Fall — zwei Einheiten, beide gebunden', async () => {
  const protokoll = {};
  const sb = sbAttrappe({ data: [{ id: 's1' }, { id: 's2' }], protokoll });
  const r = await bindeSitzungenAnTermin(sb, 'b1', ['s1', 's2']);
  assert.equal(r.ok, true);
  assert.equal(r.gebunden, 2);
  assert.deepEqual(r.fehlend, []);
  assert.equal(r.meldung, '');
  assert.equal(protokoll.tabelle, 'prescription_sessions');
  assert.equal(protokoll.werte.booking_id, 'b1');
  // Gebunden heisst geplant, nicht erbracht.
  assert.equal(protokoll.werte.status, 'planned');
});

// Der eigentliche Befund der Karte: der Index schlägt zu, KEINE der beiden
// Zeilen wird gebunden — und bis zum 16.09.2026 meldete die Maske trotzdem
// „gespeichert".
test('Indexverletzung — Fehler wird durchgereicht, nicht verschluckt', async () => {
  const sb = sbAttrappe({ error: { message: 'duplicate key value violates unique constraint' } });
  const r = await bindeSitzungenAnTermin(sb, 'b1', ['s1', 's2']);
  assert.equal(r.ok, false);
  assert.equal(r.gebunden, 0);
  assert.deepEqual(r.fehlend, ['s1', 's2']);
  assert.match(r.meldung, /NICHT zugeordnet/);
  assert.match(r.meldung, /duplicate key/);
});

// PostgREST meldet keinen Fehler, wenn das UPDATE null Zeilen trifft. Ohne
// Nachzählen wäre das wieder ein stiller Verlust.
test('kein Fehler, aber keine Zeile getroffen — gilt als Fehlschlag', async () => {
  const sb = sbAttrappe({ data: [] });
  const r = await bindeSitzungenAnTermin(sb, 'b1', ['s1']);
  assert.equal(r.ok, false);
  assert.equal(r.gebunden, 0);
  assert.deepEqual(r.fehlend, ['s1']);
});

test('teilweise gebunden — die Zahl steht in der Meldung', async () => {
  const sb = sbAttrappe({ data: [{ id: 's1' }] });
  const r = await bindeSitzungenAnTermin(sb, 'b1', ['s1', 's2']);
  assert.equal(r.ok, false);
  assert.equal(r.gebunden, 1);
  assert.deepEqual(r.fehlend, ['s2']);
  assert.match(r.meldung, /nur 1 von 2/);
});

test('doppelte Ids werden einmal gezählt', async () => {
  const protokoll = {};
  const sb = sbAttrappe({ data: [{ id: 's1' }], protokoll });
  const r = await bindeSitzungenAnTermin(sb, 'b1', ['s1', 's1', null]);
  assert.equal(r.ok, true);
  assert.equal(r.erwartet, 1);
  assert.deepEqual(protokoll.ids, ['s1']);
});

// Ohne vorgemerkte Sitzung ist nichts zu tun — und das ist kein Fehler.
test('nichts vorgemerkt — stiller Erfolg, kein Datenbankzugriff', async () => {
  let beruehrt = false;
  const sb = { from() { beruehrt = true; return {}; } };
  const r = await bindeSitzungenAnTermin(sb, 'b1', []);
  assert.equal(r.ok, true);
  assert.equal(r.erwartet, 0);
  assert.equal(beruehrt, false);
});

test('der Text sagt, dass der Termin trotzdem steht', () => {
  const t = bindungsFehlerText({ erwartet: 1, gebunden: 0, dbMeldung: '' });
  assert.match(t, /Termin gespeichert/);
  assert.match(t, /von Hand zuordnen/);
  assert.doesNotMatch(t, /undefined/);
});

test('bindeSitzungenAnTermin #339: Termin vor Ausstellungsdatum wird blockiert und kein UPDATE ausgeführt', async () => {
  let updateAufgerufen = false;
  const sb = {
    from() {
      return {
        update() {
          updateAufgerufen = true;
          return { in() { return { select: async () => ({ data: [{ id: 's1' }], error: null }) }; } };
        },
      };
    },
  };

  const r = await bindeSitzungenAnTermin(sb, 'b1', ['s1'], {
    terminZeit: '2026-10-05T09:00:00Z',
    ausstellungsdatum: '2026-10-10',
  });

  assert.equal(r.ok, false);
  assert.equal(r.gebunden, 0);
  assert.deepEqual(r.fehlend, ['s1']);
  assert.equal(r.meldung, 'Dieser Termin liegt vor dem Ausstellungsdatum der Verordnung und ist nicht abrechenbar.');
  assert.equal(updateAufgerufen, false, 'UPDATE darf nicht aufgerufen werden!');
});

test('bindeSitzungenAnTermin #339: Termin am selben Tag wie Ausstellung ist zulässig', async () => {
  const sb = sbAttrappe({ data: [{ id: 's1' }] });
  const r = await bindeSitzungenAnTermin(sb, 'b1', ['s1'], {
    terminZeit: '2026-10-10T09:00:00Z',
    ausstellungsdatum: '2026-10-10',
  });
  assert.equal(r.ok, true);
  assert.equal(r.gebunden, 1);
});

test('bindeSitzungenAnTermin: Seans sayısı Einheit aşınca (MT 6. seans, 5 verilmiş) bağlama engellenir', async () => {
  let updateAufgerufen = false;
  const sb = {
    from(tab) {
      if (tab === 'prescription_sessions') {
        return {
          select() {
            return {
              in(col, vals) {
                return Promise.resolve({
                  data: [{
                    id: 's6',
                    prescription_id: 'rx1',
                    session_number: 6,
                    heilmittel_index: 1,
                    status: 'planned',
                    booking_id: null,
                  }],
                });
              },
              eq(col, val) {
                return Promise.resolve({
                  data: [
                    { id: 's1', session_number: 1, heilmittel_index: 1, status: 'done', booking_id: 'b1' },
                    { id: 's2', session_number: 2, heilmittel_index: 1, status: 'done', booking_id: 'b2' },
                    { id: 's3', session_number: 3, heilmittel_index: 1, status: 'planned', booking_id: 'b3' },
                    { id: 's4', session_number: 4, heilmittel_index: 1, status: 'planned', booking_id: 'b4' },
                    { id: 's5', session_number: 5, heilmittel_index: 1, status: 'planned', booking_id: 'b5' },
                    { id: 's6', session_number: 6, heilmittel_index: 1, status: 'planned', booking_id: null },
                  ],
                });
              },
            };
          },
          update() {
            updateAufgerufen = true;
            return { in() { return { select: async () => ({ data: [{ id: 's6' }], error: null }) }; } };
          },
        };
      }
      if (tab === 'prescriptions') {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: 'rx1',
                      anzahl_einheiten: 11,
                      heilmittel_items: [
                        { code: 'X0501', einheiten: 6 },
                        { code: 'X1201', einheiten: 5 }, // MT: nur 5 verordnet!
                      ],
                    },
                  }),
                };
              },
            };
          },
        };
      }
      return {};
    },
  };

  const r = await bindeSitzungenAnTermin(sb, 'bNew', ['s6']);
  assert.equal(r.ok, false);
  assert.equal(r.gebunden, 0);
  assert.match(r.meldung, /alle 5 Einheiten vergeben/);
  assert.match(r.meldung, /Keine offene Einheit mehr verfügbar/);
  assert.equal(updateAufgerufen, false, 'UPDATE darf bei Überschreitung nicht laufen');
});

