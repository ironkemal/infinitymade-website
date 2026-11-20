import test from 'node:test';
import assert from 'node:assert/strict';
import { createSitzungsabschluss } from './sitzung-abschliessen.js';

const TERMIN_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const RX_ID = '44444444-4444-4444-8444-444444444444';
const RX_ID_2 = '55555555-5555-4555-8555-555555555555';
const START = '2026-11-19T09:00:00.000Z';
const JETZT = Date.parse('2026-11-19T10:00:00.000Z');

/**
 * Minimaler In-Memory-Supabase-Stub für Bookings + Prescription Sessions.
 * @param {{
 *   termin?: any,
 *   sitzungen?: any[],
 *   vorBookingUpdate?: (state: { termin: any, sitzungen: any[] }) => void,
 *   fehlerBei?: string,
 * }} opts
 */
function baueStub({ termin = null, sitzungen = [], vorBookingUpdate, fehlerBei } = {}) {
  const state = {
    termin: termin ? structuredClone(termin) : null,
    sitzungen: structuredClone(sitzungen),
    bookingUpdates: /** @type {any[]} */ ([]),
    sessionUpdates: /** @type {any[]} */ ([]),
  };

  /** @param {string} tabelle */
  function from(tabelle) {
    /** @type {'select'|'update'|null} */
    let modus = null;
    /** @type {any} */
    let patch = null;
    /** @type {Array<(row: any) => boolean>} */
    const filter = [];

    /** @returns {Promise<{ data: any, error: any }>} */
    async function ausfuehren(einzel = false) {
      if (fehlerBei === `${tabelle}:${modus}`) {
        return { data: null, error: { code: 'PGRST999', message: 'simuliert' } };
      }
      if (tabelle === 'bookings') {
        if (modus === 'update' && vorBookingUpdate) vorBookingUpdate(state);
        const zeilen = state.termin && filter.every(fn => fn(state.termin)) ? [state.termin] : [];
        if (modus === 'update') {
          state.bookingUpdates.push({ patch: structuredClone(patch), treffer: zeilen.length });
          for (const z of zeilen) Object.assign(z, patch);
        }
        return { data: einzel ? (zeilen[0] ? structuredClone(zeilen[0]) : null) : structuredClone(zeilen), error: null };
      }
      if (tabelle === 'prescription_sessions') {
        const zeilen = state.sitzungen.filter(row => filter.every(fn => fn(row)));
        if (modus === 'update') {
          state.sessionUpdates.push({ patch: structuredClone(patch), ids: zeilen.map(z => z.id) });
          for (const z of zeilen) Object.assign(z, patch);
        }
        return { data: einzel ? (zeilen[0] ? structuredClone(zeilen[0]) : null) : structuredClone(zeilen), error: null };
      }
      throw new Error(`Unerwartete Tabelle: ${tabelle}`);
    }

    const q = {
      select() { if (!modus) modus = 'select'; return q; },
      /** @param {any} p */
      update(p) { modus = 'update'; patch = p; return q; },
      /** @param {string} col @param {any} val */
      eq(col, val) { filter.push(row => row[col] === val); return q; },
      /** @param {string} col @param {any} val */
      is(col, val) { filter.push(row => (val === null ? row[col] == null : row[col] === val)); return q; },
      /** @param {string} col @param {any[]} vals */
      in(col, vals) { filter.push(row => vals.includes(row[col])); return q; },
      /** @param {string} expr */
      or(expr) {
        // owner_id.eq.<tenant>,and(owner_id.is.null,user_id.eq.<user>)
        const m = expr.match(/owner_id\.eq\.([^,]+),and\(owner_id\.is\.null,user_id\.eq\.([^)]+)\)/);
        if (m) filter.push(row => row.owner_id === m[1] || (row.owner_id == null && row.user_id === m[2]));
        return q;
      },
      maybeSingle() { return ausfuehren(true); },
      /** @param {(v: any) => any} resolve @param {(e: any) => any} reject */
      then(resolve, reject) { return ausfuehren(false).then(resolve, reject); },
    };
    return q;
  }

  return { sb: { from }, state };
}

/**
 * @param {import('express').RequestHandler} handler
 * @param {any} reqPatch
 */
async function rufeAuf(handler, reqPatch = {}) {
  let statusCode = 200;
  /** @type {any} */
  let jsonBody = null;
  const req = /** @type {any} */ ({
    params: { id: TERMIN_ID },
    body: { startzeit: START, notiz: '' },
    auth: { tenantId: TENANT_ID, userId: USER_ID },
    headers: { authorization: 'Bearer test-jwt' },
    ...reqPatch,
  });
  const res = /** @type {any} */ ({
    status(/** @type {number} */ code) { statusCode = code; return res; },
    json(/** @type {any} */ body) { jsonBody = body; return res; },
  });
  await handler(req, res, () => {});
  return { status: statusCode, body: jsonBody };
}

function standardTermin(patch = {}) {
  return {
    id: TERMIN_ID,
    owner_id: TENANT_ID,
    user_id: USER_ID,
    start_time: START,
    status: 'confirmed',
    no_show: false,
    hausbesuch: false,
    fahrt_status: null,
    is_group: false,
    group_parent_id: null,
    verordnung_id: null,
    ...patch,
  };
}

function standardSitzung(patch = {}) {
  return {
    id: 'sess-1',
    booking_id: TERMIN_ID,
    prescription_id: RX_ID,
    status: 'planned',
    done_at: null,
    notes: null,
    prescriptions: { owner_id: TENANT_ID, status: 'in_therapy', therapie_bereich: 'physio' },
    ...patch,
  };
}

test('lehnt ungültige Eingaben und fehlende Anmeldung mit 400/401 ab', async () => {
  const handler = createSitzungsabschluss({ clientFuerToken: () => { throw new Error('darf nicht laufen'); }, jetzt: () => JETZT });

  const r1 = await rufeAuf(handler, { params: { id: 'keine-uuid' } });
  assert.equal(r1.status, 400);

  const r2 = await rufeAuf(handler, { body: { startzeit: 'kein-datum' } });
  assert.equal(r2.status, 400);

  const r3 = await rufeAuf(handler, { body: { startzeit: START, notiz: 123 } });
  assert.equal(r3.status, 400);

  const r4 = await rufeAuf(handler, { headers: {} });
  assert.equal(r4.status, 401);
});

test('blockiert fremde, zukünftige, abgesagte, Gruppen- und Podologie-Termine sowie Hausbesuch ohne Ankunft', async () => {
  const fälle = [
    { name: 'fremder Mandant', termin: standardTermin({ owner_id: '99999999-9999-4999-8999-999999999999' }), status: 404 },
    { name: 'verschobene Startzeit', termin: standardTermin({ start_time: '2026-11-19T09:30:00.000Z' }), status: 409 },
    { name: 'Zukunft', termin: standardTermin({ start_time: '2026-11-19T12:00:00.000Z' }), body: { startzeit: '2026-11-19T12:00:00.000Z' }, status: 409 },
    { name: 'abgesagt', termin: standardTermin({ status: 'cancelled' }), status: 409 },
    { name: 'nicht erschienen', termin: standardTermin({ no_show: true }), status: 409 },
    { name: 'Gruppen-Elterntermin', termin: standardTermin({ is_group: true, group_parent_id: null }), status: 409 },
    { name: 'Podologie-Termin', termin: standardTermin({ verordnung_id: RX_ID }), status: 409 },
    { name: 'Hausbesuch vor Ankunft', termin: standardTermin({ hausbesuch: true, fahrt_status: 'fahrt_started' }), status: 409 },
  ];

  for (const f of fälle) {
    const { sb, state } = baueStub({ termin: f.termin, sitzungen: [standardSitzung()] });
    const handler = createSitzungsabschluss({ clientFuerToken: () => sb, jetzt: () => JETZT });
    const res = await rufeAuf(handler, f.body ? { body: f.body } : {});
    assert.equal(res.status, f.status, f.name);
    assert.equal(state.sessionUpdates.length, 0, `${f.name}: keine Sitzung schreiben`);
    assert.equal(state.bookingUpdates.length, 0, `${f.name}: keinen Termin schreiben`);
  }
});

test('blockiert Verordnungs-Entwurf, Podologie-Bereich, Fremdmandant und bereits abgerechnete geplante Sitzung', async () => {
  const fälle = [
    standardSitzung({ prescriptions: { owner_id: 'other', status: 'in_therapy', therapie_bereich: 'physio' } }),
    standardSitzung({ prescriptions: { owner_id: TENANT_ID, status: 'parsed', therapie_bereich: 'physio' } }),
    standardSitzung({ prescriptions: { owner_id: TENANT_ID, status: 'in_therapy', therapie_bereich: 'podo' } }),
    standardSitzung({ status: 'planned', prescriptions: { owner_id: TENANT_ID, status: 'billed', therapie_bereich: 'physio' } }),
  ];

  for (const sitzung of fälle) {
    const { sb, state } = baueStub({ termin: standardTermin(), sitzungen: [sitzung] });
    const handler = createSitzungsabschluss({ clientFuerToken: () => sb, jetzt: () => JETZT });
    const res = await rufeAuf(handler);
    assert.equal(res.status, 409);
    assert.equal(state.sessionUpdates.length, 0);
  }
});

test('Chrome1911: Termin ohne zugeordnete Einheit bleibt offen', async () => {
  const { sb, state } = baueStub({ termin: standardTermin() });
  const handler = createSitzungsabschluss({ clientFuerToken: () => sb, jetzt: () => JETZT });
  const res = await rufeAuf(handler);
  assert.equal(res.status, 409);
  assert.match(res.body.error, /offene Einheit/);
  assert.equal(state.termin.status, 'confirmed');
  assert.deepEqual(state.bookingUpdates, []);
});

test('schließt Physio-Kombi-Termin mit Notiz ab und setzt Leistungsdatum auf Terminbeginn', async () => {
  const { sb, state } = baueStub({
    termin: standardTermin(),
    sitzungen: [
      standardSitzung({ id: 's-1', prescription_id: RX_ID }),
      standardSitzung({ id: 's-2', prescription_id: RX_ID }),
      standardSitzung({ id: 's-3', prescription_id: RX_ID_2 }),
    ],
  });
  let erhaltenesToken = null;
  const handler = createSitzungsabschluss({
    clientFuerToken: token => { erhaltenesToken = token; return sb; },
    jetzt: () => JETZT,
  });

  const res = await rufeAuf(handler, { body: { startzeit: START, notiz: 'Schulter mobilisiert' } });
  assert.equal(res.status, 200);
  assert.equal(erhaltenesToken, 'test-jwt');
  assert.deepEqual(res.body, { prescriptionIds: [RX_ID, RX_ID_2] });
  assert.equal(state.termin.status, 'completed');
  for (const s of state.sitzungen) {
    assert.equal(s.status, 'done');
    assert.equal(s.done_at, START);
    assert.equal(s.notes, 'Schulter mobilisiert');
  }
});

test('Hausbesuch nach Ankunft setzt fahrt_status auf fahrt_return_pending und Wiederholung bleibt idempotent', async () => {
  const { sb, state } = baueStub({
    termin: standardTermin({ hausbesuch: true, fahrt_status: 'fahrt_arrived' }),
    sitzungen: [standardSitzung()],
  });
  const handler = createSitzungsabschluss({ clientFuerToken: () => sb, jetzt: () => JETZT });

  const erst = await rufeAuf(handler);
  assert.equal(erst.status, 200);
  assert.equal(state.termin.status, 'completed');
  assert.equal(state.termin.fahrt_status, 'fahrt_return_pending');

  // Zweiter Klick (z. B. nach Fehler beim Verordnungsfortschritt) bleibt 200 und überschreibt nichts
  const wiederholung = await rufeAuf(handler, { body: { startzeit: START, notiz: 'Neu' } });
  assert.equal(wiederholung.status, 200);
  assert.deepEqual(wiederholung.body, { prescriptionIds: [RX_ID] });
  assert.equal(state.sitzungen[0].notes, null);
});

test('setzt geschriebene Sitzungen zurück, wenn der Termin parallel verschoben wird', async () => {
  const { sb, state } = baueStub({
    termin: standardTermin(),
    sitzungen: [
      standardSitzung({ id: 's-geplant', status: 'planned', done_at: null, notes: null }),
      standardSitzung({ id: 's-schon-fertig', status: 'done', done_at: '2026-11-18T08:00:00.000Z', notes: 'Alt' }),
    ],
    vorBookingUpdate: st => {
      st.termin.start_time = '2026-11-20T09:00:00.000Z';
    },
  });
  const handler = createSitzungsabschluss({ clientFuerToken: () => sb, jetzt: () => JETZT });

  const res = await rufeAuf(handler, { body: { startzeit: START, notiz: 'Wird gerollt' } });
  assert.equal(res.status, 409);
  assert.equal(state.sitzungen[0].status, 'planned');
  assert.equal(state.sitzungen[0].done_at, null);
  assert.equal(state.sitzungen[0].notes, null);
  // Bereits vorher erledigte Sitzung bleibt unberührt
  assert.equal(state.sitzungen[1].status, 'done');
  assert.equal(state.sitzungen[1].notes, 'Alt');
});

test('setzt geschriebene Sitzungen auch bei paralleler Absage oder Nicht-Erscheinen zurück', async () => {
  for (const patch of [{ status: 'cancelled' }, { no_show: true }]) {
    const { sb, state } = baueStub({
      termin: standardTermin(),
      sitzungen: [standardSitzung({ id: 's-1', status: 'planned', done_at: null, notes: null })],
      vorBookingUpdate: st => { Object.assign(st.termin, patch); },
    });
    const handler = createSitzungsabschluss({ clientFuerToken: () => sb, jetzt: () => JETZT });

    const res = await rufeAuf(handler, { body: { startzeit: START, notiz: 'Notiz' } });
    assert.equal(res.status, 409);
    assert.equal(state.sitzungen[0].status, 'planned', 'Sitzung muss nach paralleler Absage/No-Show wieder planned sein');
    assert.equal(state.sitzungen[0].done_at, null);
    assert.equal(state.sitzungen[0].notes, null);
  }
});

test('liefert bei DB-Fehler 503 mit deutscher Meldung ohne interne Details', async () => {
  const { sb } = baueStub({ termin: standardTermin(), fehlerBei: 'bookings:select' });
  const handler = createSitzungsabschluss({ clientFuerToken: () => sb, jetzt: () => JETZT });

  const res = await rufeAuf(handler);
  assert.equal(res.status, 503);
  assert.doesNotMatch(res.body.error, /PGRST|simuliert/);
});
