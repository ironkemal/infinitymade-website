import test from 'node:test';
import assert from 'node:assert/strict';
import { createSitzungsabschluss } from './sitzung-abschliessen.js';

const TERMIN_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const RX_ID = '44444444-4444-4444-8444-444444444444';
const START = '2026-11-19T09:00:00.000Z';

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

test('lehnt ungültige Eingaben und fehlende Anmeldung mit 400/401 ab', async () => {
  const handler = createSitzungsabschluss({ clientFuerToken: () => { throw new Error('darf nicht laufen'); } });

  const r1 = await rufeAuf(handler, { params: { id: 'keine-uuid' } });
  assert.equal(r1.status, 400);

  const r2 = await rufeAuf(handler, { body: { startzeit: 'kein-datum' } });
  assert.equal(r2.status, 400);

  const r3 = await rufeAuf(handler, { body: { startzeit: START, notiz: 123 } });
  assert.equal(r3.status, 400);

  const r4 = await rufeAuf(handler, { headers: {} });
  assert.equal(r4.status, 401);
});

test('Chrome1911 sendet nur Termin, Startzeit und Notiz mit authentifiziertem Client', async () => {
  const handler = createSitzungsabschluss({ clientFuerToken: token => {
    assert.equal(token, 'test-jwt');
    return { async rpc(/** @type {string} */ name, /** @type {object} */ args) {
      assert.equal(name, 'sitzung_abschliessen');
      assert.deepEqual(args, { p_booking_id: TERMIN_ID, p_startzeit: START, p_notiz: null });
      return { data: [RX_ID], error: null };
    } };
  } });
  assert.deepEqual(await rufeAuf(handler), { status: 200, body: { prescriptionIds: [RX_ID] } });
});

test('Chrome1911 übersetzt fachliche RPC-Ablehnungen und gibt interne Fehler neutral zurück', async () => {
  for (const [code,message,status,text] of [
    ['PT401','ANMELDUNG',401,'anmelden'], ['PT404','TERMIN_FEHLT',404,'nicht gefunden'],
    ['PT409','KEINE_SITZUNG',409,'offene Einheit'], ['PT409','ZUKUNFT',409,'Zukunft'],
    ['PT409','ENTWURF',409,'Entwurf'], ['PT409','PODO',409,'Podologie'], ['PT409','GRUPPE',409,'Gruppe'],
    ['PT409','STATUS',409,'Status'], ['PT409','FAHRT',409,'Fahrt'], ['PT409','VERORDNUNG_FEHLT',409,'Verordnung'],
    ['PT409','TERMIN_GEAENDERT',409,'geändert'], ['XX000','interne Diagnose',503,'nicht bestätigt'],
  ]) {
    const handler = createSitzungsabschluss({ clientFuerToken: () => ({ rpc: async () => ({error: {code,message}}) }) });
    const r = await rufeAuf(handler);
    assert.equal(r.status, status);
    assert.ok(r.body.error.includes(text));
  }
});
