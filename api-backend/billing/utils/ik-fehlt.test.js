import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ikFehltAntwort, IK_FEHLT_CODE } from './ik-fehlt.js';

test('ikFehltAntwort: 400, Code IK_FEHLT, Hinweis auf Einstellungen', () => {
  const r = ikFehltAntwort();
  assert.equal(r.status, 400);
  assert.equal(r.body.code, IK_FEHLT_CODE);
  assert.match(r.body.error, /Einstellungen › Abrechnung/);
  assert.match(r.body.error, /9-stellige IK/);
});
