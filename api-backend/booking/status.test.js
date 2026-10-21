import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestToken, tokenMatches, berlinLocal, toPublicStatus } from './status.js';

test('Token ist derselbe HMAC wie im Patientenlink und prueft zeitkonstant', () => {
  const t = requestToken('geheim', 'anfrage-1', 'patient-1');
  assert.equal(t.length, 32);
  assert.equal(t, requestToken('geheim', 'anfrage-1', 'patient-1'));
  assert.notEqual(t, requestToken('geheim', 'anfrage-1', 'patient-2'));
  assert.equal(tokenMatches(t, t), true);
  assert.equal(tokenMatches(t, 'x'.repeat(32)), false);
  assert.equal(tokenMatches(t, undefined), false);
  assert.equal(tokenMatches(t, t.slice(1)), false);
});

test('berlinLocal rechnet Sommer- und Winterzeit richtig', () => {
  assert.equal(berlinLocal('2026-07-01T07:30:00Z'), '2026-07-01T09:30');
  assert.equal(berlinLocal('2026-12-01T08:30:00Z'), '2026-12-01T09:30');
  assert.equal(berlinLocal('kaputt'), null);
});

test('Status-Abbildung: pending / accepted / rejected, nichts Personenbezogenes', () => {
  assert.equal(toPublicStatus({ status: 'pending' }).status, 'pending');
  assert.equal(toPublicStatus({ status: 'declined' }).status, 'rejected');
  assert.equal(toPublicStatus({ status: 'cancelled' }).status, 'rejected');
  const ok = toPublicStatus({ status: 'approved', preferred_date: '2026-10-20', preferred_time: '09:30:00' });
  assert.deepEqual(ok, { status: 'accepted', confirmedSlot: '2026-10-20T09:30', message: 'Ihr Termin wurde bestätigt.' });
  const mitBooking = toPublicStatus({ status: 'approved', preferred_date: '2026-10-20', preferred_time: '09:30:00' }, '2026-10-21T07:00:00Z');
  assert.equal(mitBooking.confirmedSlot, '2026-10-21T09:00');
  const angebot = toPublicStatus({ status: 'pending', alternativ_angeboten_at: '2026-10-11T10:00:00Z' });
  assert.equal(angebot.status, 'pending');
  assert.match(angebot.message, /anderen Termin/);
  assert.deepEqual(Object.keys(toPublicStatus({ status: 'pending', patient_id: 'x', notizen: 'geheim' })).sort(), ['message', 'status']);
});
