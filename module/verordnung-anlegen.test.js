import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oeffneAnlegenWahl, bindeAnTerminNachAnlage } from './verordnung-anlegen.js';

globalThis.document ??= { getElementById: () => null };

// Kleine Supabase-Attrappe: bookings + prescriptions, merkt UPDATEs.
function sb({ bookings, rx }) {
  const updates = [];
  return {
    updates,
    from(tabelle) {
      const filter = [];
      let patch = null;
      const q = {
        select: () => q, order: () => q,
        eq: (k, v) => { filter.push(r => r[k] === v); return q; },
        is: (k, v) => { filter.push(r => (r[k] ?? null) === v); return q; },
        gte: (k, v) => { filter.push(r => r[k] >= v); return q; },
        neq: (k, v) => { filter.push(r => r[k] !== v); return q; },
        not: (k, op, v) => { const l = String(v).replace(/[()"]/g, '').split(','); filter.push(r => !l.includes(r[k])); return q; },
        or: () => q, in: (k, l) => { filter.push(r => l.includes(r[k])); return q; }, limit: () => q,
        update: (p) => { patch = p; return q; },
        maybeSingle: async () => {
          if (tabelle === 'prescriptions') return { data: rx, error: null };
          return { data: bookings.find(r => filter.every(f => f(r))) || null, error: null };
        },
        then: (res) => {
          const rows = (tabelle === 'bookings' ? bookings : []).filter(r => filter.every(f => f(r)));
          if (patch) { rows.forEach(r => Object.assign(r, patch)); updates.push(...rows.map(r => r.id)); }
          return Promise.resolve({ data: rows.map(r => ({ id: r.id, start_time: r.start_time })), error: null }).then(res);
        },
      };
      return q;
    },
  };
}

test('ohne Termin-Kontext: nichts zuordnen', async () => {
  oeffneAnlegenWahl('lead1');
  assert.equal(await bindeAnTerminNachAnlage(sb({ bookings: [], rx: null }), { ownerId: 'o', rxId: 'rx', patientId: 'lead1' }), null);
});

test('aus dem Termin: dieser + folgende unzugeordnete, gedeckelt auf die Menge', async () => {
  const bookings = [
    { id: 'vorher', lead_id: 'lead1', status: 'confirmed', verordnung_id: null, start_time: '2026-10-01T09:00:00Z' },
    { id: 'quelle', lead_id: 'lead1', status: 'confirmed', verordnung_id: null, start_time: '2026-10-21T09:00:00Z' },
    { id: 'f1', lead_id: 'lead1', status: 'confirmed', verordnung_id: null, start_time: '2026-11-04T09:00:00Z' },
    { id: 'f2', lead_id: 'lead1', status: 'confirmed', verordnung_id: null, start_time: '2026-11-18T09:00:00Z' },
    { id: 'schon', lead_id: 'lead1', status: 'confirmed', verordnung_id: 'alt', start_time: '2026-11-25T09:00:00Z' },
    { id: 'abgesagt', lead_id: 'lead1', status: 'cancelled', verordnung_id: null, start_time: '2026-12-01T09:00:00Z' },
  ];
  const s = sb({ bookings, rx: { anzahl_einheiten: 2, therapie_bereich: 'podo' } });
  oeffneAnlegenWahl('lead1', 'quelle');
  const erg = await bindeAnTerminNachAnlage(s, { ownerId: 'o', rxId: 'rxNeu', patientId: 'lead1' });
  assert.equal(erg.podo, true);
  assert.equal(erg.gebunden, 2);
  assert.deepEqual(bookings.filter(b => b.verordnung_id === 'rxNeu').map(b => b.id), ['quelle', 'f1']);
  assert.equal(bookings.find(b => b.id === 'vorher').verordnung_id, null);
  // Kontext ist verbraucht
  assert.equal(await bindeAnTerminNachAnlage(s, { ownerId: 'o', rxId: 'rxNeu', patientId: 'lead1' }), null);
});
