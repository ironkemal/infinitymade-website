import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBookingsFromRequestFactory } from './from-request.js';

// Minimaler Supabase-Ersatz: merkt sich alle Inserts in bookings und liefert
// vorgegebene Antworten fuer services.
function fakeSupabase({ duration = 30, insertError = null } = {}) {
  const inserts = [];
  return {
    inserts,
    from(table) {
      if (table === 'services') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { duration_minutes: duration } }) }) }),
        };
      }
      if (table === 'bookings') {
        return {
          insert(row) {
            inserts.push(row);
            const err = typeof insertError === 'function' ? insertError(inserts.length) : insertError;
            return {
              error: err,
              select: () => ({ single: async () => ({ data: err ? null : { id: `booking-${inserts.length}` }, error: err }) }),
              // Ohne .select() wird das Insert direkt awaited (Folgetermine).
              then: (resolve) => resolve({ error: err }),
            };
          },
        };
      }
      throw new Error(`unerwartete Tabelle: ${table}`);
    },
  };
}

const berlinLocalToUTC = (dateStr, timeStr) => new Date(`${dateStr}T${timeStr}:00.000Z`);
const generateRecurringDates = (startDate, recurrence, count) => {
  const step = recurrence === 'daily' ? 1 : 7;
  const out = [];
  const d = new Date(`${startDate}T00:00:00.000Z`);
  for (let i = 0; i < count; i++) {
    out.push(new Date(d.getTime() + i * step * 86400000).toISOString().substring(0, 10));
  }
  return out;
};
const allSlotsFree = async () => ({ slots: ['09:00', '10:00', '11:00'] });

const baseRequest = {
  service_id: 'svc-1',
  preferred_date: '2026-09-01',
  preferred_time: '10:00',
  verordnung_sitzungen: 1,
  frequenz: null,
};

test('Termin wird mit user_id angelegt, nicht mit employee_id', async () => {
  const supabase = fakeSupabase();
  const create = createBookingsFromRequestFactory({
    supabase, berlinLocalToUTC, generateRecurringDates, getAvailableSlots: allSlotsFree,
  });

  const result = await create(baseRequest, 'owner-1', 'therapeut-1', 'Max Mustermann');

  assert.equal(supabase.inserts.length, 1);
  const row = supabase.inserts[0];
  // Der Therapeut MUSS in user_id stehen — nur darueber greift die
  // Doppelbuchungs-Sperre no_overlapping_bookings.
  assert.equal(row.user_id, 'therapeut-1');
  assert.equal(row.owner_id, 'owner-1');
  assert.ok(!('employee_id' in row), 'bookings hat keine Spalte employee_id');
  assert.equal(row.status, 'confirmed');
  assert.equal(row.customer_name, 'Max Mustermann');
  assert.equal(result.booking_id, 'booking-1');
  assert.equal(result.sessions_total, 1);
  assert.equal(result.sessions_created, 1);
});

test('Termindauer kommt aus der Leistung', async () => {
  const supabase = fakeSupabase({ duration: 45 });
  const create = createBookingsFromRequestFactory({
    supabase, berlinLocalToUTC, generateRecurringDates, getAvailableSlots: allSlotsFree,
  });

  await create(baseRequest, 'owner-1', 'therapeut-1', 'Max Mustermann');

  const row = supabase.inserts[0];
  const minutes = (new Date(row.end_time) - new Date(row.start_time)) / 60000;
  assert.equal(minutes, 45);
});

test('1x/Woche legt die ganze Serie an — alle mit user_id', async () => {
  const supabase = fakeSupabase();
  const create = createBookingsFromRequestFactory({
    supabase, berlinLocalToUTC, generateRecurringDates, getAvailableSlots: allSlotsFree,
  });

  const result = await create(
    { ...baseRequest, verordnung_sitzungen: 3, frequenz: '1x/Woche' },
    'owner-1', 'therapeut-1', 'Max Mustermann',
  );

  assert.equal(result.sessions_total, 3);
  assert.equal(result.sessions_created, 3);
  assert.equal(result.sessions_conflicts, 0);
  assert.equal(supabase.inserts.length, 3);
  assert.ok(supabase.inserts.every(r => r.user_id === 'therapeut-1'));
  assert.deepEqual(
    supabase.inserts.map(r => r.start_time.substring(0, 10)),
    ['2026-09-01', '2026-09-08', '2026-09-15'],
  );
});

test('belegter Folgetermin wird gezaehlt, nicht gebucht', async () => {
  const supabase = fakeSupabase();
  // Nur der erste Wunschtermin ist frei, die Folgewoche ist ausgebucht.
  const getAvailableSlots = async (_emp, dateStr) =>
    dateStr === '2026-09-08' ? { slots: [] } : { slots: ['10:00'] };
  const create = createBookingsFromRequestFactory({
    supabase, berlinLocalToUTC, generateRecurringDates, getAvailableSlots,
  });

  const result = await create(
    { ...baseRequest, verordnung_sitzungen: 3, frequenz: '1x/Woche' },
    'owner-1', 'therapeut-1', 'Max Mustermann',
  );

  assert.equal(result.sessions_created, 2);
  assert.equal(result.sessions_conflicts, 1);
  assert.equal(supabase.inserts.length, 2);
});

test('unklare Frequenz legt nur den ersten Termin an und meldet Handarbeit', async () => {
  const supabase = fakeSupabase();
  const create = createBookingsFromRequestFactory({
    supabase, berlinLocalToUTC, generateRecurringDates, getAvailableSlots: allSlotsFree,
  });

  const result = await create(
    { ...baseRequest, verordnung_sitzungen: 6, frequenz: '2x/Woche' },
    'owner-1', 'therapeut-1', 'Max Mustermann',
  );

  assert.equal(result.needs_manual_scheduling, true);
  assert.equal(result.sessions_created, 1);
  assert.equal(supabase.inserts.length, 1);
});

test('booking_ids enthält jeden Termin der Serie, nicht nur den ersten', async () => {
  const supabase = fakeSupabase();
  const create = createBookingsFromRequestFactory({
    supabase, berlinLocalToUTC, generateRecurringDates, getAvailableSlots: allSlotsFree,
  });

  const result = await create(
    { ...baseRequest, verordnung_sitzungen: 3, frequenz: '1x/Woche' },
    'owner-1', 'therapeut-1', 'Max Mustermann',
  );

  // Ohne das bleiben beim Patienten-Storno die Folgetermine im Kalender stehen.
  assert.deepEqual(result.booking_ids, ['booking-1', 'booking-2', 'booking-3']);
  assert.equal(result.booking_id, 'booking-1');
});

test('booking_ids zählt einen belegten Folgetermin nicht mit', async () => {
  const supabase = fakeSupabase();
  const getAvailableSlots = async (_emp, dateStr) =>
    dateStr === '2026-09-08' ? { slots: [] } : { slots: ['10:00'] };
  const create = createBookingsFromRequestFactory({
    supabase, berlinLocalToUTC, generateRecurringDates, getAvailableSlots,
  });

  const result = await create(
    { ...baseRequest, verordnung_sitzungen: 3, frequenz: '1x/Woche' },
    'owner-1', 'therapeut-1', 'Max Mustermann',
  );

  assert.equal(result.booking_ids.length, 2);
  assert.equal(result.booking_ids.length, result.sessions_created);
});

test('belegter Wunschtermin: kein Insert, sondern conflict', async () => {
  const supabase = fakeSupabase();
  const create = createBookingsFromRequestFactory({
    supabase, berlinLocalToUTC, generateRecurringDates,
    getAvailableSlots: async () => ({ slots: ['09:00', '11:00'] }), // 10:00 fehlt
  });

  const result = await create(baseRequest, 'owner-1', 'therapeut-1', 'Max Mustermann');

  assert.equal(result.conflict, true);
  assert.equal(supabase.inserts.length, 0, 'bei Konflikt darf kein Termin entstehen');
});

test('geschlossener Tag (Feiertag/Urlaub) zaehlt ebenfalls als Konflikt', async () => {
  const supabase = fakeSupabase();
  const create = createBookingsFromRequestFactory({
    supabase, berlinLocalToUTC, generateRecurringDates,
    getAvailableSlots: async () => ({ slots: ['10:00'], reason: 'Feiertag' }),
  });

  const result = await create(baseRequest, 'owner-1', 'therapeut-1', 'Max Mustermann');

  assert.equal(result.conflict, true);
  assert.equal(supabase.inserts.length, 0);
});

test('Rennen mit der DB-Sperre (23P01) endet als conflict, nicht als Absturz', async () => {
  const supabase = fakeSupabase({ insertError: { code: '23P01', message: 'conflicting key value' } });
  const create = createBookingsFromRequestFactory({
    supabase, berlinLocalToUTC, generateRecurringDates, getAvailableSlots: allSlotsFree,
  });

  const result = await create(baseRequest, 'owner-1', 'therapeut-1', 'Max Mustermann');

  assert.equal(result.conflict, true);
});

test('andere Datenbankfehler werden durchgereicht, nichts wird stillschweigend geschluckt', async () => {
  const supabase = fakeSupabase({ insertError: { code: '23503', message: 'foreign key violation' } });
  const create = createBookingsFromRequestFactory({
    supabase, berlinLocalToUTC, generateRecurringDates, getAvailableSlots: allSlotsFree,
  });

  await assert.rejects(
    () => create(baseRequest, 'owner-1', 'therapeut-1', 'Max Mustermann'),
    (e) => e.code === '23503',
  );
});

test('ohne Wunschzeit wird nicht geprueft, der Termin entsteht trotzdem', async () => {
  const supabase = fakeSupabase();
  let geprueft = false;
  const create = createBookingsFromRequestFactory({
    supabase, berlinLocalToUTC, generateRecurringDates,
    getAvailableSlots: async () => { geprueft = true; return { slots: [] }; },
  });

  const result = await create(
    { ...baseRequest, preferred_date: null, preferred_time: null },
    'owner-1', 'therapeut-1', 'Max Mustermann',
  );

  assert.equal(geprueft, false);
  assert.equal(result.conflict, undefined);
  assert.equal(supabase.inserts.length, 1);
});
