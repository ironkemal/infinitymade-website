// Box-Test 22.11.2026, Befund 4: Realtime-Unterbrechung ruhig melden und danach nachladen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { kanalStatusBehandler, VERZOEGERUNG_MS } from './realtime-status.js';

function umgebung() {
  /** @type {Record<string, any>} */ const els = {};
  /** @type {Array<{fn: Function, ms: number}>} */ const uhren = [];
  const doc = /** @type {any} */ ({
    getElementById: (/** @type {string} */ id) => els[id] || null,
    createElement: () => ({ style: {}, setAttribute() {}, remove() { delete els[this.id]; } }),
    body: { appendChild: (/** @type {any} */ el) => { els[el.id] = el; } },
  });
  return { doc, els, uhren, setTimeoutImpl: /** @type {any} */ ((fn, ms) => { uhren.push({ fn, ms }); return uhren.length; }), clearTimeoutImpl: /** @type {any} */ ((i) => { uhren[i - 1].fn = () => {}; }) };
}

test('kurzer Aussetzer: kein Band, aber Nachladen nach Wiederverbindung', () => {
  const u = umgebung(); let nach = 0;
  const h = kanalStatusBehandler({ nachholen: () => { nach++; }, ...u });
  h('SUBSCRIBED'); assert.equal(nach, 0, 'Erstverbindung lädt nicht nach');
  h('CHANNEL_ERROR'); assert.equal(u.uhren[0].ms, VERZOEGERUNG_MS);
  h('SUBSCRIBED'); u.uhren[0].fn();
  assert.equal(u.els.realtimeUnterbrochenBand, undefined);
  assert.equal(nach, 1);
});

test('lange Unterbrechung: Band nach Verzögerung, verschwindet bei SUBSCRIBED', () => {
  const u = umgebung(); let nach = 0;
  const h = kanalStatusBehandler({ nachholen: () => { nach++; }, ...u });
  h('TIMED_OUT'); h('CHANNEL_ERROR'); assert.equal(u.uhren.length, 1, 'nur eine Uhr');
  u.uhren[0].fn();
  assert.match(u.els.realtimeUnterbrochenBand.textContent, /wird wiederhergestellt/);
  h('SUBSCRIBED');
  assert.equal(u.els.realtimeUnterbrochenBand, undefined);
  assert.equal(nach, 1);
});

test('CLOSED (Kiosk schließt absichtlich) bleibt still', () => {
  const u = umgebung(); let nach = 0;
  const h = kanalStatusBehandler({ nachholen: () => { nach++; }, ...u });
  h('CLOSED'); h('SUBSCRIBED');
  assert.equal(u.uhren.length, 0); assert.equal(nach, 0);
});
