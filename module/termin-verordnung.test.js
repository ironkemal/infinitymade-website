// Die Rezeptart des Termins — Weg hin und zurueck.
//
// Hintergrund: `bookings.rezeptart` wurde beim Bearbeiten eines bestehenden
// Termins bedingungslos geleert und beim Speichern als NULL zurueckgeschrieben.
// Ein als Selbstzahler angelegter Termin verlor seine Markierung, sobald
// jemand auch nur die Notiz aenderte. Diese Tests halten beide Richtungen fest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setzeRezeptartInMaske, rezeptartAusMaske, waehleVerordnung } from './termin-verordnung.js';

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

