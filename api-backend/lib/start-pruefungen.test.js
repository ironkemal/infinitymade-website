import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startWarnungen } from './start-pruefungen.js';

test('KI: ungueltige Konfiguration in direkt/jeton warnt, aus nicht', () => {
  assert.equal(startWarnungen({ aiConfig: { mode: 'direkt', valid: false, code: 'AI_DEPLOYMENT_INVALID' } }).length, 1);
  assert.match(startWarnungen({ aiConfig: { mode: 'jeton', valid: false } })[0], /KI-Konfiguration/);
  assert.equal(startWarnungen({ aiConfig: { mode: 'aus', valid: false } }).length, 0);
  assert.equal(startWarnungen({ aiConfig: { mode: 'direkt', valid: true } }).length, 0);
});

test('Box-Kimlik ohne SUPABASE_PUBLIC_URL warnt, SaaS ohne Kimlik nicht', () => {
  assert.equal(startWarnungen({ env: {}, kimlikVorhanden: true }).length, 1);
  assert.equal(startWarnungen({ env: { SUPABASE_PUBLIC_URL: 'https://x' }, kimlikVorhanden: true }).length, 0);
  assert.equal(startWarnungen({ env: {}, kimlikVorhanden: false }).length, 0);
});

test('keine env-Werte im Text', () => {
  const t = startWarnungen({ env: { SUPABASE_PUBLIC_URL: '' }, kimlikVorhanden: true, aiConfig: { mode: 'direkt', valid: false, code: 'X' } }).join(' ');
  assert.ok(!/https?:\/\//.test(t));
});
