import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeAbrechnungssperre, korrigiereNoShow } from './booking-status-korrektur.js';

function supabaseDoppel({ abrechnungStatus = null, schreibFehler = null, links = null, freieSitzungen = [] } = {}) {
  const geschrieben = { bookings: [], sessions: [], korrekturen: [], gebunden: [] };
  // `update().eq()` endet meistens hier — bei der Rueckbindung einer einzelnen
  // Sitzungszeile geht die Kette aber noch ueber `.is().select()` weiter
  // (module/termin-nicht-erschienen.js). Deshalb ist die Kette `then`-faehig
  // statt an einer festen Stelle ein Promise zu liefern.
  const kette = (tabelle, istUpdate = false) => {
    const f = {};
    const ergebnis = () => {
      if (istUpdate && tabelle === 'sessions' && f.id) {
        const frei = freieSitzungen.includes(f.id);
        if (frei) geschrieben.gebunden.push(f.id);
        return { data: frei ? [{ id: f.id }] : [], error: null };
      }
      return { error: schreibFehler };
    };
    const k = {
      select: () => k,
      eq: (spalte, wert) => { f[spalte] = wert; return k; },
      neq: () => k,
      is: (spalte, wert) => { f[spalte] = wert; return k; },
      maybeSingle: () => Promise.resolve({
        data: abrechnungStatus === null && links === null
          ? null
          : { abrechnung_status: abrechnungStatus, no_show_session_links: links },
        error: null,
      }),
      update: (patch) => { geschrieben[tabelle].push(patch); return kette(tabelle, true); },
      insert: (row) => { geschrieben[tabelle].push(row); return Promise.resolve({ error: null }); },
      then: (ok, fehler) => Promise.resolve(ergebnis()).then(ok, fehler),
    };
    return k;
  };
  return {
    supabase: {
      from: (t) => kette(t === 'bookings' ? 'bookings' : t === 'prescription_sessions' ? 'sessions' : 'korrekturen'),
      auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'u-1' } } } }) },
    },
    geschrieben,
  };
}

function toast() {
  const calls = [];
  return { fn: (msg, art) => calls.push({ msg, art }), calls };
}

// --- pruefeAbrechnungssperre ---

test('kein verordnung_id, keine prescription_sessions -> nicht gesperrt', async () => {
  const { supabase } = supabaseDoppel();
  const r = await pruefeAbrechnungssperre(supabase, { id: 'b1' });
  assert.equal(r.gesperrt, false);
});

test('Podologie: bereits abgerechnete Verordnung sperrt', async () => {
  const { supabase } = supabaseDoppel({ abrechnungStatus: 'abgerechnet' });
  const r = await pruefeAbrechnungssperre(supabase, { id: 'b1', verordnung_id: 'rx-1' });
  assert.equal(r.gesperrt, true);
});

test('Podologie: aktive Verordnung sperrt nicht', async () => {
  const { supabase } = supabaseDoppel({ abrechnungStatus: 'aktiv' });
  const r = await pruefeAbrechnungssperre(supabase, { id: 'b1', verordnung_id: 'rx-1' });
  assert.equal(r.gesperrt, false);
});

test('Physio: gebilltes prescription_sessions sperrt', async () => {
  const { supabase } = supabaseDoppel({ abrechnungStatus: 'billed' });
  const r = await pruefeAbrechnungssperre(supabase, {
    id: 'b1', prescription_sessions: [{ prescription_id: 'rx-2' }],
  });
  assert.equal(r.gesperrt, true);
});

// --- korrigiereNoShow ---

test('gesperrte Verordnung: bookings.status bleibt unangetastet', async () => {
  const { supabase, geschrieben } = supabaseDoppel({ abrechnungStatus: 'abgerechnet' });
  const t = toast();
  const ok = await korrigiereNoShow({ supabase, showToast: t.fn }, {
    id: 'b1', owner_id: 'o1', status: 'no_show', verordnung_id: 'rx-1',
  });
  assert.equal(ok, false);
  assert.equal(geschrieben.bookings.length, 0);
  assert.equal(t.calls[0].art, 'error');
});

test('unbeschränkte Korrektur schreibt Status + Korrekturzeile', async () => {
  const { supabase, geschrieben } = supabaseDoppel();
  const t = toast();
  const booking = { id: 'b1', owner_id: 'o1', status: 'no_show' };
  const ok = await korrigiereNoShow({ supabase, showToast: t.fn }, booking);
  assert.equal(ok, true);
  assert.equal(geschrieben.bookings[0].status, 'completed');
  assert.equal(geschrieben.sessions[0].status, 'done');
  assert.equal(geschrieben.korrekturen[0].alter_status, 'no_show');
  assert.equal(geschrieben.korrekturen[0].neuer_status, 'completed');
  assert.ok(geschrieben.korrekturen[0].grund.length >= 3);
  assert.equal(geschrieben.korrekturen[0].geaendert_von, 'u-1');
  assert.equal(booking.status, 'completed');
});

test('freigegebene Einheit wird ueber die Rueckfahrkarte wieder angebunden', async () => {
  // Seit dem 14.09.2026 gibt das no_show `booking_id` frei — `.eq('booking_id')`
  // findet die Zeile nicht mehr. Ohne den zweiten Weg waere die Korrektur
  // stillschweigend wirkungslos (Ops-Karte a8186cb8).
  const { supabase, geschrieben } = supabaseDoppel({
    links: [{ session_id: 's1', prescription_id: 'rx1', session_number: 3 }],
    freieSitzungen: ['s1'],
  });
  const t = toast();
  const ok = await korrigiereNoShow({ supabase, showToast: t.fn }, { id: 'b1', owner_id: 'o1', status: 'no_show' });
  assert.equal(ok, true);
  assert.deepEqual(geschrieben.gebunden, ['s1']);
  const rueckbindung = geschrieben.sessions.find(p => p.booking_id === 'b1');
  assert.equal(rueckbindung.status, 'done');
});

test('Schreibfehler auf bookings wird gemeldet, nicht geworfen', async () => {
  const { supabase } = supabaseDoppel({ schreibFehler: { message: 'rls' } });
  const t = toast();
  const ok = await korrigiereNoShow({ supabase, showToast: t.fn }, { id: 'b1', owner_id: 'o1', status: 'no_show' });
  assert.equal(ok, false);
  assert.match(t.calls[0].msg, /rls/);
});
