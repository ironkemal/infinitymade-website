import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configAusEnv } from '../server.js';

const basis = { BOX_DOMAIN: 'box.example.org', CF_ZONE_ID: 'z', CF_API_TOKEN: 't', ACME_DNS_INTERN_URL: 'http://127.0.0.1:1', ACME_DNS_URL: 'https://a.example.org' };

test('MERKEZ_HOST ist Pflicht, außer MERKEZ_DEV=1', () => {
  assert.throws(() => configAusEnv({ ...basis, MERKEZ_TRUST_PROXY: '1' }), /MERKEZ_HOST/);
  assert.equal(configAusEnv({ ...basis, MERKEZ_HOST: 'm.example.org', MERKEZ_TRUST_PROXY: '1' }).hostErwartet, 'm.example.org');
  assert.equal(configAusEnv({ ...basis, MERKEZ_DEV: '1' }).hostErwartet, null);
});

test('MERKEZ_TRUST_PROXY: nur ganze Zahl; bei Loopback-Bindung Pflicht', () => {
  const e = { ...basis, MERKEZ_HOST: 'm.example.org' };
  assert.throws(() => configAusEnv({ ...e, MERKEZ_TRUST_PROXY: 'true' }), /ganze Zahl/);
  assert.throws(() => configAusEnv({ ...e, MERKEZ_TRUST_PROXY: '1.5' }), /ganze Zahl/);
  assert.throws(() => configAusEnv(e), /MERKEZ_TRUST_PROXY fehlt/);
  assert.throws(() => configAusEnv({ ...e, HOST: '127.0.0.1' }), /MERKEZ_TRUST_PROXY fehlt/);
  assert.equal(configAusEnv({ ...e, HOST: '0.0.0.0' }).trustProxy, false);
  assert.equal(configAusEnv({ ...e, MERKEZ_TRUST_PROXY: '2' }).trustProxy, 2);
});

test('fehlende Pflichtvariablen', () => {
  assert.throws(() => configAusEnv({ MERKEZ_DEV: '1' }), /Fehlende/);
});
