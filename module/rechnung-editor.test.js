import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { terminAuswahlLaden, leererEditorZustand, terminLeistungen, terminBeschriftung, preisAusService } from './rechnung-editor.js';

// Pinnt die Auslassung, die den Versichertentyp-Leck verursacht hat
// (Ops-Meldung, 09.09.2026): nach einer Privatrechnung blieb
// invPatientInsuranceType stehen, weil resetInvEditor() es nicht zurücksetzte.
test('leererEditorZustand() setzt invPatientInsuranceType auf null', () => {
  const zustand = leererEditorZustand();
  assert.deepEqual(zustand, {
    invLines: [], invPatientId: null, invPrescriptionId: null,
    invVerordnungId: null, invBehandlungIds: [], invPatientInsuranceType: null,
  });
});

test('Terminauswahl der Rechnung enthält keine abgesagten Termine', async () => {
  const sb = createClient('https://test.invalid', 'test-key', { auth: { persistSession: false }, global: {
    fetch: async url => {
      const u = new URL(url);
      let data = [];
      if (u.pathname.endsWith('/leads')) data = { title: 'Testpatient' };
      if (u.pathname.endsWith('/bookings')) {
        assert.equal(u.searchParams.get('owner_id'), 'eq.praxis');
        assert.equal(u.searchParams.get('status'), 'neq.cancelled');
        data = [{ id: 'aktiv', status: 'confirmed' }, { id: 'abgesagt', status: 'cancelled' }]
          .filter(b => b.status !== 'cancelled');
      }
      return new Response(JSON.stringify(data));
    },
  } });
  assert.deepEqual(await terminAuswahlLaden(sb, { ownerId: 'praxis', leadId: 'patient' }), [{ id: 'aktiv', status: 'confirmed' }]);
});

/* ── Ops 59e8e698: der Kombi-Termin auf der Selbstzahlerrechnung ──────────── */

test('die Abfrage holt booking_leistungen mit — sonst fehlt die zweite Leistung', async () => {
  let gesehen = '';
  const sb = createClient('https://test.invalid', 'test-key', { auth: { persistSession: false }, global: {
    fetch: async url => {
      const u = new URL(url);
      if (u.pathname.endsWith('/bookings')) gesehen = u.searchParams.get('select') || '';
      return new Response(JSON.stringify(u.pathname.endsWith('/leads') ? {} : []));
    },
  } });
  await terminAuswahlLaden(sb, { ownerId: 'praxis', leadId: 'patient' });
  assert.match(gesehen, /booking_leistungen/);
  assert.match(gesehen, /anzahl/);
  assert.match(gesehen, /sort_order/);
});

test('zwei Leistungen an einem Termin werden zwei Zeilen — in sort_order', () => {
  const zeilen = terminLeistungen({
    id: 'b1', service_id: 's1',
    services: { title: 'Behandlung', price: 40 },
    booking_leistungen: [
      { anzahl: 1, sort_order: 1, services: { title: 'Eingangsbefundung', price: 15, duration_minutes: 10 } },
      { anzahl: 1, sort_order: 0, services: { title: 'Behandlung', price: 40, duration_minutes: 30 } },
    ],
  });
  assert.deepEqual(zeilen.map(z => z.title), ['Behandlung', 'Eingangsbefundung']);
  assert.equal(zeilen.reduce((s, z) => s + z.unit_price * z.quantity, 0), 55);
});

test('anzahl wird als Menge übernommen, nicht als zweite Zeile', () => {
  const zeilen = terminLeistungen({
    booking_leistungen: [{ anzahl: 3, sort_order: 0, services: { title: 'Spange', price: 20 } }],
  });
  assert.equal(zeilen.length, 1);
  assert.equal(zeilen[0].quantity, 3);
});

// Termine von ausserhalb der Terminmaske (Backend, Serie, Warteliste,
// Termin-Anfrage) schreiben keine booking_leistungen-Zeile. Ohne Rückfall wäre
// ihre Rechnung leer — schlimmer als die Lücke, die die Karte beschreibt.
test('ohne booking_leistungen zählt die Hauptleistung des Termins', () => {
  const zeilen = terminLeistungen({
    service_id: 's1', services: { title: 'Podologie', price: 0, duration_minutes: 30,
      price_config: { durations: { 30: { active: true, price: 32.5 } } } },
    booking_leistungen: [],
  });
  assert.deepEqual(zeilen, [{ title: 'Podologie', unit_price: 32.5, quantity: 1, duration: 30 }]);
});

test('Termin ganz ohne Leistung liefert keine Zeile statt einer leeren', () => {
  assert.deepEqual(terminLeistungen({ id: 'b1' }), []);
  assert.deepEqual(terminLeistungen(null), []);
});

test('preisAusService: price schlägt price_config, sonst erste aktive Stufe', () => {
  assert.equal(preisAusService({ price: 40, price_config: { durations: { 30: { active: true, price: 99 } } } }), 40);
  assert.equal(preisAusService({ price_config: { durations: { 20: { active: false, price: 10 }, 30: { active: true, price: 25 } } } }), 25);
  assert.equal(preisAusService(null), 0);
});

test('die Beschriftung nennt beide Leistungen und ihre Summe', () => {
  const esc = s => String(s);
  const eur = n => n.toFixed(2) + ' €';
  const txt = terminBeschriftung({
    start_time: '2026-09-16T08:00:00Z',
    booking_leistungen: [
      { anzahl: 1, sort_order: 0, services: { title: 'Behandlung', price: 40, duration_minutes: 30 } },
      { anzahl: 2, sort_order: 1, services: { title: 'Eingangsbefundung', price: 15, duration_minutes: 10 } },
    ],
  }, { escapeHtml: esc, formatEur: eur });
  assert.match(txt, /Behandlung \+ 2× Eingangsbefundung/);
  assert.match(txt, /70\.00 €/);
  assert.match(txt, /40 Min/);
});
