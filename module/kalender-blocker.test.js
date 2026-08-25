import { test } from 'node:test';
import assert from 'node:assert/strict';

import { istBlockerLeistung, BLOCKER_DEFS, ensureBlockerServices } from './kalender-blocker.js';

test('erkennt die beiden Blocker', () => {
  for (const def of BLOCKER_DEFS) {
    assert.equal(istBlockerLeistung({ is_internal: true, code: def.code }), true, def.code);
  }
});

test('eine normale Leistung ist kein Blocker', () => {
  assert.equal(istBlockerLeistung({ is_internal: false, code: 'KG' }), false);
  assert.equal(istBlockerLeistung(null), false);
  assert.equal(istBlockerLeistung(undefined), false);
  assert.equal(istBlockerLeistung({}), false);
});

test('interne Leistung mit fremdem Code ist kein Blocker', () => {
  // Die Blanko-Zuschlaege sind ebenfalls is_internal — sie duerfen im Kalender
  // nicht als Pause erscheinen.
  assert.equal(istBlockerLeistung({ is_internal: true, code: 'BLANKO_PD' }), false);
});

test('Code ohne is_internal zaehlt nicht', () => {
  // Sonst wuerde eine von Hand angelegte Leistung mit demselben Kuerzel
  // stillschweigend zum Blocker.
  assert.equal(istBlockerLeistung({ is_internal: false, code: 'BLOCK_PAUSE' }), false);
});

test('Definitionen sind vollstaendig und eindeutig', () => {
  const codes = BLOCKER_DEFS.map(d => d.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const d of BLOCKER_DEFS) {
    assert.ok(d.schluessel && d.titel && d.code);
    assert.match(d.farbe, /^#[0-9a-f]{6}$/i);
  }
});

test('ohne supabase oder Inhaber wird nichts angelegt', async () => {
  assert.equal((await ensureBlockerServices(null, 'owner')).size, 0);
  assert.equal((await ensureBlockerServices({}, null)).size, 0);
});

test('vorhandene Blocker werden nicht doppelt angelegt', async () => {
  const eingefuegt = [];
  const fake = {
    from() { return this; },
    select() { return this; },
    eq() { return this; },
    in() { return Promise.resolve({ data: BLOCKER_DEFS.map((d, i) => ({ id: 'id' + i, code: d.code, title: d.titel, is_internal: true })) }); },
    insert(row) { eingefuegt.push(row); return this; },
    update() { return this; },
    maybeSingle() { return Promise.resolve({ data: null }); },
  };
  const map = await ensureBlockerServices(fake, 'owner', 'user');
  assert.equal(map.size, BLOCKER_DEFS.length);
  assert.equal(eingefuegt.length, 0, 'nichts neu angelegt');
});

test('fehlendes is_internal wird geradegezogen', async () => {
  const updates = [];
  const fake = {
    from() { return this; },
    select() { return this; },
    eq() { return this; },
    in() { return Promise.resolve({ data: [{ id: 'x', code: BLOCKER_DEFS[0].code, is_internal: false }] }); },
    update(patch) { updates.push(patch); return this; },
    insert() { return this; },
    maybeSingle() { return Promise.resolve({ data: null }); },
  };
  await ensureBlockerServices(fake, 'owner', 'user');
  assert.deepEqual(updates[0], { is_internal: true });
});
