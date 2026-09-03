import { test } from 'node:test';
import assert from 'node:assert/strict';
import { holeNachruecker, uebernimmSlot, machtWiederWartend } from './warteliste-nachruecker.js';

// ── Hilfsattrappen ─────────────────────────────────────────────────────────

/** Minimaler Supabase-Ersatz: merkt sich, was eingefügt werden sollte. */
function fakeSupabase({ fehler = null } = {}) {
  const gesehen = {};
  return {
    gesehen,
    from(tabelle) {
      gesehen.tabelle = tabelle;
      return {
        insert(payload) {
          gesehen.payload = payload;
          return {
            select: () => ({
              single: async () => fehler
                ? { data: null, error: fehler }
                : { data: { id: 'neu-1' }, error: null },
            }),
          };
        },
      };
    },
  };
}

function fakeFetch(antworten) {
  const rufe = [];
  const fn = async (url, opts) => {
    rufe.push({ url, opts });
    const a = antworten.shift();
    if (a instanceof Error) throw a;
    return {
      ok: a.ok !== false,
      status: a.status || 200,
      json: async () => a.body || {},
    };
  };
  fn.rufe = rufe;
  return fn;
}

const SLOT = {
  id: 'alt-1',
  user_id: 'mitarbeiter-7',
  service_id: 'leistung-praxis',
  start_time: '2026-09-10T08:00:00.000Z',
  end_time: '2026-09-10T08:20:00.000Z',
};

const EINTRAG = {
  id: 'wl-1',
  lead_id: 'lead-9',
  service_id: null,
  notes: 'Nur vormittags',
  leads: { first_name: 'Anna', last_name: 'Bauer', phone: '0221 123', email: 'a@b.de' },
};

// ── holeNachruecker ────────────────────────────────────────────────────────

test('holeNachruecker fragt die Match-Route mit der Termin-ID', async () => {
  global.fetch = fakeFetch([{ body: { candidates: [EINTRAG], total: 1 } }]);
  const r = await holeNachruecker({ apiBase: '/api', token: 'tok', bookingId: 'alt-1' });
  assert.equal(r.total, 1);
  assert.equal(global.fetch.rufe[0].url, '/api/warteliste/match');
  assert.deepEqual(JSON.parse(global.fetch.rufe[0].opts.body), { booking_id: 'alt-1' });
});

// Der Abgleich ist Zusatzhilfe. Fällt er aus, darf die Absage nicht daran
// scheitern — der Aufrufer fängt, aber nur wenn hier auch wirklich geworfen wird.
test('holeNachruecker wirft bei HTTP-Fehler', async () => {
  global.fetch = fakeFetch([{ ok: false, status: 503 }]);
  await assert.rejects(
    () => holeNachruecker({ apiBase: '/api', token: 'tok', bookingId: 'alt-1' }),
    /HTTP 503/,
  );
});

// ── uebernimmSlot ──────────────────────────────────────────────────────────

test('der neue Termin erbt Fenster und Mitarbeiter:in des abgesagten', async () => {
  const supabase = fakeSupabase();
  global.fetch = fakeFetch([{ body: {} }]);

  const r = await uebernimmSlot({
    supabase, apiBase: '/api', token: 'tok',
    eintrag: EINTRAG, slot: SLOT, ownerId: 'owner-1',
  });

  assert.equal(r.ok, true);
  assert.equal(r.bookingId, 'neu-1');
  assert.equal(supabase.gesehen.tabelle, 'bookings');
  const p = supabase.gesehen.payload;
  // Uhrzeit und Mitarbeiter:in dürfen NICHT abweichen, sonst kollidiert der
  // neue Termin mit dem nächsten im Kalender.
  assert.equal(p.user_id, 'mitarbeiter-7');
  assert.equal(p.start_time, SLOT.start_time);
  assert.equal(p.end_time, SLOT.end_time);
  assert.equal(p.owner_id, 'owner-1');
  assert.equal(p.lead_id, 'lead-9');
  assert.equal(p.customer_name, 'Anna Bauer');
  assert.equal(p.customer_phone, '0221 123');
  assert.equal(p.status, 'confirmed');
});

// Der Wartende hat sich für eine bestimmte Leistung eingetragen — die gilt,
// nicht die des abgesagten Termins.
test('Wunschleistung der Warteliste schlägt die des abgesagten Termins', async () => {
  const supabase = fakeSupabase();
  global.fetch = fakeFetch([{ body: {} }]);
  await uebernimmSlot({
    supabase, apiBase: '/api', token: 'tok',
    eintrag: { ...EINTRAG, service_id: 'leistung-wunsch' }, slot: SLOT, ownerId: 'owner-1',
  });
  assert.equal(supabase.gesehen.payload.service_id, 'leistung-wunsch');
});

test('ohne Wunschleistung bleibt die des abgesagten Termins', async () => {
  const supabase = fakeSupabase();
  global.fetch = fakeFetch([{ body: {} }]);
  await uebernimmSlot({
    supabase, apiBase: '/api', token: 'tok',
    eintrag: EINTRAG, slot: SLOT, ownerId: 'owner-1',
  });
  assert.equal(supabase.gesehen.payload.service_id, 'leistung-praxis');
});

test('der Wartelisten-Eintrag wird auf matched gesetzt', async () => {
  const supabase = fakeSupabase();
  global.fetch = fakeFetch([{ body: {} }]);
  await uebernimmSlot({
    supabase, apiBase: '/api', token: 'tok',
    eintrag: EINTRAG, slot: SLOT, ownerId: 'owner-1',
  });
  const ruf = global.fetch.rufe[0];
  assert.equal(ruf.url, '/api/warteliste/wl-1');
  assert.equal(ruf.opts.method, 'PATCH');
  assert.deepEqual(JSON.parse(ruf.opts.body), { status: 'matched', matched_booking_id: 'neu-1' });
});

// Ein doppelt angebotener Wartender ist ärgerlich, ein verlorener Termin wäre
// schlimmer: der Termin bleibt gültig, es gibt nur eine Warnung.
test('scheitert nur das Abhaken, bleibt der Termin bestehen', async () => {
  const supabase = fakeSupabase();
  global.fetch = fakeFetch([{ ok: false, status: 403 }]);
  const r = await uebernimmSlot({
    supabase, apiBase: '/api', token: 'tok',
    eintrag: EINTRAG, slot: SLOT, ownerId: 'owner-1',
  });
  assert.equal(r.ok, true);
  assert.equal(r.bookingId, 'neu-1');
  assert.match(r.warnung, /403/);
});

// Der häufigste echte Fehlschlag: der Platz ist inzwischen wieder belegt
// (EXCLUDE-Constraint no_overlapping_bookings).
test('belegter Platz meldet Fehler und hakt nichts ab', async () => {
  const supabase = fakeSupabase({ fehler: { message: 'no_overlapping_bookings' } });
  global.fetch = fakeFetch([]);
  const r = await uebernimmSlot({
    supabase, apiBase: '/api', token: 'tok',
    eintrag: EINTRAG, slot: SLOT, ownerId: 'owner-1',
  });
  assert.equal(r.ok, false);
  assert.match(r.error.message, /no_overlapping_bookings/);
  assert.equal(global.fetch.rufe.length, 0);
});

test('Wartender ohne hinterlegten Namen bekommt trotzdem einen Termin', async () => {
  const supabase = fakeSupabase();
  global.fetch = fakeFetch([{ body: {} }]);
  await uebernimmSlot({
    supabase, apiBase: '/api', token: 'tok',
    eintrag: { id: 'wl-2', lead_id: null, leads: null }, slot: SLOT, ownerId: 'owner-1',
  });
  assert.equal(supabase.gesehen.payload.customer_name, 'Unbekannter Patient');
  assert.equal(supabase.gesehen.payload.lead_id, null);
});

// ── Gruppentermine ─────────────────────────────────────────────────────────

// Der EXCLUDE-Riegel `no_overlapping_bookings` greift nur
// `WHERE status='confirmed' AND group_parent_id IS NULL`. Ohne den Elternbezug
// stuende der Nachruecker als eigenstaendiger Termin zur selben Zeit bei
// derselben Person — und die Datenbank wiese ihn gegen den Gruppentermin ab.
test('ein frei gewordener Gruppenplatz bleibt ein Gruppenplatz', async () => {
  const supabase = fakeSupabase();
  global.fetch = fakeFetch([{ body: {} }]);
  await uebernimmSlot({
    supabase, apiBase: '/api', token: 'tok', eintrag: EINTRAG,
    slot: { ...SLOT, group_parent_id: 'gruppe-1' }, ownerId: 'owner-1',
  });
  assert.equal(supabase.gesehen.payload.group_parent_id, 'gruppe-1');
});

test('ein normaler Termin bekommt kein group_parent_id angehaengt', async () => {
  const supabase = fakeSupabase();
  global.fetch = fakeFetch([{ body: {} }]);
  await uebernimmSlot({
    supabase, apiBase: '/api', token: 'tok', eintrag: EINTRAG, slot: SLOT, ownerId: 'owner-1',
  });
  assert.equal('group_parent_id' in supabase.gesehen.payload, false);
});

// ── Zurueck auf die Warteliste ─────────────────────────────────────────────

test('machtWiederWartend setzt waiting und leert den Terminbezug', async () => {
  global.fetch = fakeFetch([{ body: { id: 'wl-1', status: 'waiting' } }]);
  await machtWiederWartend({ apiBase: '/api', token: 'tok', eintragId: 'wl-1' });
  const ruf = global.fetch.rufe[0];
  assert.equal(ruf.url, '/api/warteliste/wl-1');
  assert.equal(ruf.opts.method, 'PATCH');
  assert.deepEqual(JSON.parse(ruf.opts.body), { status: 'waiting', matched_booking_id: null });
});

test('machtWiederWartend wirft bei HTTP-Fehler', async () => {
  global.fetch = fakeFetch([{ ok: false, status: 403 }]);
  await assert.rejects(
    () => machtWiederWartend({ apiBase: '/api', token: 'tok', eintragId: 'wl-1' }),
    /HTTP 403/,
  );
});
