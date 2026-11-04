import test from 'node:test';
import assert from 'node:assert/strict';
import { alsBerlinDatum } from './berlin-datum.js';
import { terminAmSondertag, markiereSondertagTermine, SONDERTAG_TERMIN_HINWEIS } from './sondertag.js';

const tage = [
  { date: '2026-12-24', type: 'holiday' },
  { date: '2026-12-11', type: 'closed', start_time: '08:00', end_time: '12:00' },
];

test('Berliner Kalendertag, nicht der UTC-Präfix (geteilter Helfer)', () => {
  assert.equal(alsBerlinDatum(new Date('2026-12-23T23:30:00Z')), '2026-12-24');
  assert.equal(alsBerlinDatum(new Date('2026-03-29T22:30:00Z')), '2026-03-30'); // nach Umstellung auf Sommerzeit
  assert.equal(terminAmSondertag({ start_time: 'kein Datum' }, [{ date: '', type: 'closed' }]), false);
});

test('nur geltende Termine am ganztägig geschlossenen Tag zählen', () => {
  assert.equal(terminAmSondertag({ start_time: '2026-12-24T09:00:00+01:00', status: 'confirmed' }, tage), true);
  assert.equal(terminAmSondertag({ start_time: '2026-12-23T23:30:00Z' }, tage), true);
  assert.equal(terminAmSondertag({ start_time: '2026-12-24T09:00:00+01:00', status: 'cancelled' }, tage), false);
  assert.equal(terminAmSondertag({ start_time: '2026-12-11T09:00:00+01:00' }, tage), false, 'Sonderöffnung');
  assert.equal(terminAmSondertag({ start_time: '2026-12-23T09:00:00+01:00' }, tage), false);
  assert.equal(terminAmSondertag(null, tage), false);
});

function element(termin) {
  return { _termin: termin, dataset: {}, style: {}, title: '' };
}

test('markiert betroffene Blöcke rot und lässt andere unberührt', () => {
  const rot = element({ start_time: '2026-12-24T10:00:00+01:00' });
  const normal = element({ start_time: '2026-12-22T10:00:00+01:00' });
  const ohne = { dataset: {}, style: {}, title: '' };
  const wurzel = { querySelectorAll: sel => { assert.match(sel, /dv-booking-block/); assert.match(sel, /month-event-pill/); return [rot, normal, ohne]; } };
  assert.equal(markiereSondertagTermine({ wurzel, tage }), 1);
  assert.equal(rot.dataset.sondertag, 'geschlossen');
  assert.match(rot.style.boxShadow, /danger/);
  assert.equal(rot.title, SONDERTAG_TERMIN_HINWEIS);
  assert.deepEqual(normal.style, {});
  assert.equal(markiereSondertagTermine({}), 0);
});
