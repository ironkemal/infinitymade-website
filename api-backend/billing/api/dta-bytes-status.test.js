// dta-bytes ?zweck=signieren: Endstatus wird FRUEH (vor PIN) mit verstaendlicher Meldung abgelehnt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('./abrechnung.routes.js', import.meta.url), 'utf8');
const mMatch = src.match(/router\.get\('\/abrechnung\/:id\/dta-bytes'[\s\S]*?\n\}\);/);
if (!mMatch) throw new Error('dta-bytes-Route nicht gefunden');
const routeSrc = mMatch[0];

/**
 * @param {string} status
 * @param {Record<string, any>} [extra]
 * @returns {any}
 */
function handler(status, extra = {}) {
  /** @type {any} */
  let h;
  const ab = { id: 'a1', owner_id: 'o1', status, dateiname: 'TSOL0001', storage_path: 'o1/a1/x.dta', dta_sha256: 'a'.repeat(64) };
  const supabase = {
    from: () => {
      /** @type {any} */
      const b = { select() { return b; }, eq() { return b; }, async maybeSingle() { return { data: ab, error: null }; } };
      return b;
    },
  };
  const sandbox = {
    router: { get(/** @type {any} */ _p, /** @type {any} */ fn) { h = fn; } }, supabase, Buffer, console: { error() {} },
    nurInhaber: async () => ({ tenantId: 'o1' }),
    bereichFuerAbrechnung: async () => ({ bereich: 'podologie', eigenerAbrechnungscode: '71' }),
    pruefeEmpfaenger: async () => ({ blockiert: false, meldungen: [] }),
    ladeDtaOriginalbytes: async () => Buffer.from('DTA'),
    ...extra,
  };
  vm.runInContext(routeSrc, vm.createContext(sandbox));
  return h;
}
const res = () => {
  /** @type {{ code: number, body: any, status(c: number): any, json(b: any): any, setHeader(): void }} */
  const r = { code: 200, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; }, setHeader() {} };
  return r;
};

test('zweck=signieren + Endstatus: 409 ABRECHNUNG_STATUS_GESPERRT, kein Dateizugriff', async () => {
  for (const status of ['rejected', 'gesendet', 'accepted', 'paid', 'verworfen']) {
    let geladen = false;
    const h = handler(status, { ladeDtaOriginalbytes: async () => { geladen = true; return Buffer.from('x'); } });
    const r = res();
    await h({ params: { id: 'a1' }, query: { zweck: 'signieren' }, headers: {} }, r);
    assert.equal(r.code, 409, status);
    assert.equal(r.body.code, 'ABRECHNUNG_STATUS_GESPERRT');
    assert.equal(geladen, false);
  }
});

test('zweck=signieren im Entwurf (erstellt/heruntergeladen): liefert die Datei', async () => {
  for (const status of ['erstellt', 'heruntergeladen']) {
    const r = res();
    await handler(status)({ params: { id: 'a1' }, query: { zweck: 'signieren' }, headers: {} }, r);
    assert.equal(r.code, 200);
    assert.equal(r.body.contentBase64, Buffer.from('DTA').toString('base64'));
  }
});

test('ohne zweck-Parameter bleibt das bisherige Verhalten (auch bei Endstatus)', async () => {
  const r = res();
  await handler('gesendet')({ params: { id: 'a1' }, query: {}, headers: {} }, r);
  assert.equal(r.code, 200);
});
