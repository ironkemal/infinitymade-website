// Die Rezeptart des Termins — Weg hin und zurueck.
//
// Hintergrund: `bookings.rezeptart` wurde beim Bearbeiten eines bestehenden
// Termins bedingungslos geleert und beim Speichern als NULL zurueckgeschrieben.
// Ein als Selbstzahler angelegter Termin verlor seine Markierung, sobald
// jemand auch nur die Notiz aenderte. Diese Tests halten beide Richtungen fest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setzeRezeptartInMaske, rezeptartAusMaske, waehleVerordnung, zeigeVerordnungenFuerTermin, resetVerordnungFelder, aktualisiereBindungBeimSpeichern } from './termin-verordnung.js';

/** Minimales DOM: nur das eine versteckte Feld, an dem alles haengt. */
function mitFeld(startwert = '') {
  const feld = { value: startwert };
  globalThis.document = { getElementById: (id) => (id === 'bkIsSelbstzahler' ? feld : null) };
  return feld;
}

test('Selbstzahler-Termin kommt als gesetzter Schalter in die Maske', () => {
  const feld = mitFeld('');
  setzeRezeptartInMaske('selbstzahler');
  assert.equal(feld.value, '1');
});

test('Kassentermin setzt den Schalter NICHT — daran haengt die Verordnungskarte', () => {
  const feld = mitFeld('1');
  setzeRezeptartInMaske('kassen');
  assert.equal(feld.value, '');
});

test('fehlende Rezeptart raeumt den Schalter des vorigen Termins weg', () => {
  const feld = mitFeld('1');
  setzeRezeptartInMaske(null);
  assert.equal(feld.value, '');
  setzeRezeptartInMaske(undefined);
  assert.equal(feld.value, '');
});

test('Rueckweg: gesetzter Schalter ergibt selbstzahler', () => {
  mitFeld('1');
  assert.equal(rezeptartAusMaske(), 'selbstzahler');
});

test('Rueckweg: leerer Schalter ergibt null, nicht den leeren String', () => {
  mitFeld('');
  assert.equal(rezeptartAusMaske(), null);
});

test('hin und zurueck aendert den Wert nicht', () => {
  mitFeld('');
  setzeRezeptartInMaske('selbstzahler');
  assert.equal(rezeptartAusMaske(), 'selbstzahler');
});

test('fehlendes Feld wirft nicht — die Maske kann geschlossen sein', () => {
  globalThis.document = { getElementById: () => null };
  assert.doesNotThrow(() => setzeRezeptartInMaske('selbstzahler'));
  assert.equal(rezeptartAusMaske(), null);
});

// ── waehleVerordnung ────────────────────────────────────────────────────────

function setupWaehleDom() {
  const elements = {
    bkIsSelbstzahler: { value: '', style: {} },
    bkSelectedRxId: { value: '', style: {} },
    bkSelectedSessionId: { value: '', style: {} },
    bkSelbstzahlerBtn: { style: {} },
    bkSessionPickerBlock: { hidden: true },
    bkSessionDots: { innerHTML: '', querySelectorAll: () => [], querySelector: () => null },
    bkSessionPickerTitle: { textContent: '' },
    bkSessionPickerInfo: { textContent: '' },
  };

  globalThis.document = {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: () => [],
    querySelector: () => null,
  };
  globalThis.window = globalThis;
  window._pendingRxSession = null;

  return elements;
}

function mockSupabase(bookings = []) {
  const qb = {
    select: () => qb,
    eq: () => qb,
    neq: () => qb,
    is: () => qb,
    not: () => qb,
    order: () => qb,
    limit: () => qb,
    then: (resolve) => Promise.resolve({ data: bookings, error: null }).then(resolve),
  };
  return { from: () => qb };
}

test('waehleVerordnung: Podologie mit offenen Einheiten setzt _pendingRxSession und Restanzahl', async () => {
  const el = setupWaehleDom();
  const rx = {
    id: 'rx-podo-1',
    therapie_bereich: 'podo',
    anzahl_einheiten: 6,
    heilmittel: 'Podologische Behandlung',
  };
  const mockSb = mockSupabase([
    { id: 'b1', status: 'confirmed' },
    { id: 'b2', status: 'completed' },
  ]);

  await waehleVerordnung(rx, [], {
    sb: mockSb,
    ownerId: 'owner-123',
    leadId: 'lead-456',
  });

  assert.deepEqual(window._pendingRxSession, { prescriptionId: 'rx-podo-1', podoVordId: 'rx-podo-1' });
  assert.equal(el.bkSessionPickerInfo.textContent, 'Noch 4 von 6 Einheiten offen.');
  assert.equal(el.bkSessionDots.innerHTML, '');
  assert.equal(el.bkSessionPickerBlock.hidden, false);
});

test('waehleVerordnung: Podologie voll vergeben blockiert mit Null-Session', async () => {
  const el = setupWaehleDom();
  const rx = {
    id: 'rx-podo-full',
    therapie_bereich: 'podo',
    anzahl_einheiten: 2,
    heilmittel: 'Podologische Behandlung',
  };
  const mockSb = mockSupabase([
    { id: 'b1', status: 'confirmed' },
    { id: 'b2', status: 'confirmed' },
  ]);

  await waehleVerordnung(rx, [], {
    sb: mockSb,
    ownerId: 'owner-123',
  });

  assert.equal(window._pendingRxSession, null);
  assert.equal(el.bkSessionPickerInfo.textContent, 'Alle Sitzungen bereits vergeben.');
});

test('waehleVerordnung: Podologie Fallback wenn sb/ownerId fehlen', async () => {
  const el = setupWaehleDom();
  const rx = {
    id: 'rx-podo-fallback',
    therapie_bereich: 'podo',
    anzahl_einheiten: 6,
  };

  await waehleVerordnung(rx, []);

  assert.deepEqual(window._pendingRxSession, { prescriptionId: 'rx-podo-fallback', podoVordId: 'rx-podo-fallback' });
  assert.equal(el.bkSessionPickerInfo.textContent, 'Termin wird der Verordnung zugeordnet.');
});

test('waehleVerordnung: Physio setzt Sitzungspunkte und naechste Session', async () => {
  const el = setupWaehleDom();
  const rx = {
    id: 'rx-physio-1',
    therapie_bereich: 'physio',
    anzahl_einheiten: 6,
    heilmittel: 'Krankengymnastik',
  };
  const sessions = [
    { id: 'sess-1', session_number: 1, status: 'planned', booking_id: null },
    { id: 'sess-2', session_number: 2, status: 'planned', booking_id: null },
  ];

  await waehleVerordnung(rx, sessions);

  assert.deepEqual(window._pendingRxSession, { sessionId: 'sess-1', prescriptionId: 'rx-physio-1' });
  assert.equal(el.bkSessionPickerInfo.textContent, 'Nächste: Sitzung 1 von 6');
  assert.equal(el.bkSelectedSessionId.value, 'sess-1');
});

test('waehleVerordnung: Physio meldet Alle vergeben wenn sessions leer sind', async () => {
  const el = setupWaehleDom();
  const rx = {
    id: 'rx-physio-leer',
    therapie_bereich: 'physio',
    anzahl_einheiten: 6,
  };

  await waehleVerordnung(rx, []);

  assert.equal(window._pendingRxSession, null);
  assert.equal(el.bkSessionPickerInfo.textContent, 'Alle Sitzungen bereits vergeben.');
});

// ── zeigeVerordnungenFuerTermin & resetVerordnungFelder ────────────────────

function erstelleSbMock({ bookingVerordnungId = null, rxs = [] } = {}) {
  let bookingAbfrage = 0;
  let rxAbfrage = 0;

  const sb = {
    from(table) {
      if (table === 'bookings') {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    bookingAbfrage++;
                    return { data: bookingVerordnungId ? { verordnung_id: bookingVerordnungId } : null, error: null };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'prescriptions') {
        return {
          select() {
            return {
              eq() {
                return {
                  not() {
                    return {
                      order() {
                        return {
                          async limit() {
                            rxAbfrage++;
                            return { data: rxs, error: null };
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
      throw new Error('Unbekannte Tabelle in Mock: ' + table);
    },
    get bookingAbfrage() { return bookingAbfrage; },
    get rxAbfrage() { return rxAbfrage; },
  };
  return sb;
}

test('resetVerordnungFelder: leert Felder, Pending-Session und blendet Picker aus', () => {
  const el = setupWaehleDom();
  el.bkSelectedRxId.value = 'rx-alt';
  el.bkSelectedSessionId.value = 'sess-alt';
  el.bkSessionPickerBlock.hidden = false;
  window._pendingRxSession = { prescriptionId: 'rx-alt' };
  window._bkGewaehlteRx = { id: 'rx-alt' };

  resetVerordnungFelder();

  assert.equal(el.bkSelectedRxId.value, '');
  assert.equal(el.bkSelectedSessionId.value, '');
  assert.equal(el.bkSessionPickerBlock.hidden, true);
  assert.equal(window._pendingRxSession, null);
  assert.equal(window._bkGewaehlteRx, null);
});

test('zeigeVerordnungenFuerTermin: ohne leadId wird Verordnung-Bereich ausgeblendet und reset ausgefuehrt', async () => {
  let resetAufgerufen = false;
  const veroSection = { hidden: false };
  const sb = erstelleSbMock();

  await zeigeVerordnungenFuerTermin(sb, { leadId: null }, {
    veroSection,
    resetFelder: () => { resetAufgerufen = true; },
  });

  assert.equal(veroSection.hidden, true);
  assert.equal(resetAufgerufen, true);
  assert.equal(sb.rxAbfrage, 0);
  assert.equal(sb.bookingAbfrage, 0);
});

test('zeigeVerordnungenFuerTermin: bekannteVerordnungId === null ueberspringt bookings-Abfrage', async () => {
  const veroSection = { hidden: true };
  const rxs = [{ id: 'rx-1', therapie_bereich: 'podo' }];
  const sb = erstelleSbMock({ bookingVerordnungId: 'rx-aus-db', rxs });
  let gerendert = false;

  await zeigeVerordnungenFuerTermin(sb, { leadId: 'lead-1', bookingId: 'b-1', bekannteVerordnungId: null }, {
    veroSection,
    rendereVeroKarten: () => { gerendert = true; },
  });

  assert.equal(sb.bookingAbfrage, 0, 'bookings darf bei bekannteVerordnungId === null nicht abgefragt werden');
  assert.equal(sb.rxAbfrage, 1);
  assert.equal(veroSection.hidden, false);
  assert.equal(gerendert, true);
});

test('zeigeVerordnungenFuerTermin: bekannteVerordnungId undefined mit bookingId laedt verordnung_id und waehlt Match vor', async () => {
  const veroSection = { hidden: true };
  const rx1 = { id: 'rx-1', therapie_bereich: 'podo' };
  const rx2 = { id: 'rx-2', therapie_bereich: 'podo', prescription_sessions: [] };
  const sb = erstelleSbMock({ bookingVerordnungId: 'rx-2', rxs: [rx1, rx2] });

  let gewaehltRx = null;
  await zeigeVerordnungenFuerTermin(sb, { leadId: 'lead-1', bookingId: 'b-1', bekannteVerordnungId: undefined }, {
    veroSection,
    rendereVeroKarten: () => {},
    onSelect: (rx) => { gewaehltRx = rx; },
  });

  assert.equal(sb.bookingAbfrage, 1, 'bookings muss abgefragt werden, wenn bekannteVerordnungId undefined ist');
  assert.equal(veroSection.hidden, false);
  assert.equal(gewaehltRx?.id, 'rx-2', 'Gefundene Verordnung muss per onSelect vorgewählt werden');
});

test('zeigeVerordnungenFuerTermin: bekannteVerordnungId direkt uebergeben waehlt Match ohne DB-Terminabfrage', async () => {
  const veroSection = { hidden: true };
  const rx1 = { id: 'rx-1', therapie_bereich: 'podo', prescription_sessions: [{ id: 's-1' }] };
  const sb = erstelleSbMock({ rxs: [rx1] });

  let gewaehltRx = null;
  let gewaehlteSessions = null;
  await zeigeVerordnungenFuerTermin(sb, { leadId: 'lead-1', bookingId: 'b-1', bekannteVerordnungId: 'rx-1' }, {
    veroSection,
    rendereVeroKarten: () => {},
    onSelect: (rx, sessions) => {
      gewaehltRx = rx;
      gewaehlteSessions = sessions;
    },
  });

  assert.equal(sb.bookingAbfrage, 0);
  assert.equal(gewaehltRx?.id, 'rx-1');
  assert.deepEqual(gewaehlteSessions, [{ id: 's-1' }]);
});

test('zeigeVerordnungenFuerTermin: unbekannte oder archivierte Verordnungs-ID wirft nicht und ruft kein onSelect', async () => {
  const veroSection = { hidden: true };
  const rx1 = { id: 'rx-aktiv', therapie_bereich: 'podo' };
  const sb = erstelleSbMock({ bookingVerordnungId: 'rx-archiviert-oder-abgerechnet', rxs: [rx1] });

  let selectAufgerufen = false;
  await assert.doesNotReject(async () => {
    await zeigeVerordnungenFuerTermin(sb, { leadId: 'lead-1', bookingId: 'b-1' }, {
      veroSection,
      rendereVeroKarten: () => {},
      onSelect: () => { selectAufgerufen = true; },
    });
  });

  assert.equal(veroSection.hidden, false);
  assert.equal(selectAufgerufen, false, 'Nicht mehr vorhandene Verordnung darf kein onSelect ausloesen');
});


// ── aktualisiereBindungBeimSpeichern (S1.2) ────────────────────────────────

function sbMitUpdates(protokoll) {
  return {
    from(t) {
      return {
        update(werte) {
          return { eq(_c, id) { return { async select() { protokoll.push({ t, werte, id }); return { data: [{ id }], error: null }; } }; } };
        },
      };
    },
  };
}

test('aktualisiereBindung: unveraenderte Bindung schreibt nichts', async () => {
  const el = setupWaehleDom();
  el.bkSelectedRxId.value = 'rx-1';
  window._bkUrspruenglicheVordId = 'rx-1';
  window._pendingRxSession = { prescriptionId: 'rx-1', podoVordId: 'rx-1' };
  const log = []; let gebunden = 0;
  const r = await aktualisiereBindungBeimSpeichern(sbMitUpdates(log), 'b-1', { binde: async () => { gebunden++; return { ok: true }; } });
  assert.equal(r, null);
  assert.equal(gebunden, 0);
  assert.equal(log.length, 0);
});

test('aktualisiereBindung: neue Verordnung wird gebunden', async () => {
  setupWaehleDom();
  window._bkUrspruenglicheVordId = null;
  window._pendingRxSession = { prescriptionId: 'rx-2', podoVordId: 'rx-2' };
  let arg = null;
  const r = await aktualisiereBindungBeimSpeichern(sbMitUpdates([]), 'b-1', { binde: async (_sb, id, pend) => { arg = [id, pend.podoVordId]; return { ok: true }; } });
  assert.deepEqual(arg, ['b-1', 'rx-2']);
  assert.equal(r.ok, true);
  assert.equal(window._pendingRxSession, null);
});

test('aktualisiereBindung: Abwaehlen einer gebundenen Verordnung loest die Bindung', async () => {
  const el = setupWaehleDom();
  el.bkSelectedRxId.value = '';
  window._bkUrspruenglicheVordId = 'rx-1';
  window._pendingRxSession = null;
  const log = [];
  const r = await aktualisiereBindungBeimSpeichern(sbMitUpdates(log), 'b-1', { binde: async () => { throw new Error('nicht erwartet'); } });
  assert.deepEqual(log, [{ t: 'bookings', werte: { verordnung_id: null }, id: 'b-1' }]);
  assert.equal(r.ok, true);
});

test('aktualisiereBindung: Physio-Auswahl (keine podoVordId) bleibt unberuehrt', async () => {
  const el = setupWaehleDom();
  el.bkSelectedRxId.value = 'rx-physio';
  window._bkUrspruenglicheVordId = null;
  window._pendingRxSession = { sessionId: 's-1', prescriptionId: 'rx-physio' };
  const log = [];
  const r = await aktualisiereBindungBeimSpeichern(sbMitUpdates(log), 'b-1', { binde: async () => { throw new Error('nicht erwartet'); } });
  assert.equal(r, null);
  assert.equal(log.length, 0);
});
