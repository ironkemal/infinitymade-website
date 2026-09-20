import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leiteBehandlungsbeginnAb } from './behandlungsbeginn.js';

/** Supabase-Ersatz: liefert die erste Behandlung und merkt sich das UPDATE. */
function fakeSb({ erste = null, selectFehler = null, updateFehler = null } = {}) {
  const gesehen = { updates: [] };
  return {
    gesehen,
    from(tabelle) {
      if (tabelle === 'podologie_behandlungen') {
        const b = {
          // `is` gehört seit Migration 0026 dazu (.is('storniert_am', null)) —
          // ohne diesen Platzhalter bricht die Kette im Test, nicht im Code.
          select: () => b, eq: () => b, is: () => b, order: () => b,
          limit: async () => selectFehler
            ? { data: null, error: selectFehler }
            : { data: erste ? [{ behandlungsdatum: erste }] : [], error: null },
        };
        return b;
      }
      return {
        update(payload) {
          gesehen.updates.push({ tabelle, payload });
          return { eq: async () => ({ error: updateFehler }) };
        },
      };
    },
  };
}

test('erste Behandlung wird zum Behandlungsbeginn, wenn noch keiner steht', async () => {
  const sb = fakeSb({ erste: '2026-07-15' });
  const r = await leiteBehandlungsbeginnAb(sb, 'v1', null);
  assert.deepEqual(r, { ok: true, geaendert: true, beginn: '2026-07-15' });
  assert.deepEqual(sb.gesehen.updates, [{ tabelle: 'prescriptions', payload: { behandlungsbeginn: '2026-07-15' } }]);
});

test('der Beginn ist das MINIMUM — eine spätere Behandlung verschiebt ihn nicht', async () => {
  // Bekannter Beginn 15.07.; die Abfrage liefert (aufsteigend) weiter den 15.07.
  const sb = fakeSb({ erste: '2026-07-15' });
  const r = await leiteBehandlungsbeginnAb(sb, 'v1', '2026-07-15');
  assert.equal(r.geaendert, false);
  assert.equal(r.beginn, '2026-07-15');
  assert.equal(sb.gesehen.updates.length, 0, 'kein UPDATE, wenn sich nichts ändert');
});

test('eine nachträglich erfasste frühere Behandlung zieht den Beginn nach vorn', async () => {
  const sb = fakeSb({ erste: '2026-07-10' });
  const r = await leiteBehandlungsbeginnAb(sb, 'v1', '2026-07-15');
  assert.deepEqual(r, { ok: true, geaendert: true, beginn: '2026-07-10' });
});

test('ohne dokumentierte Behandlung bleibt alles wie es ist', async () => {
  const sb = fakeSb({ erste: null });
  const r = await leiteBehandlungsbeginnAb(sb, 'v1', null);
  assert.deepEqual(r, { ok: true, geaendert: false, beginn: null });
  assert.equal(sb.gesehen.updates.length, 0);
});

test('ein gescheitertes UPDATE (gesperrte Verordnung) meldet den Fehler, wirft aber nicht', async () => {
  const sb = fakeSb({ erste: '2026-07-15', updateFehler: { message: 'gesperrt' } });
  const r = await leiteBehandlungsbeginnAb(sb, 'v1', null);
  assert.equal(r.ok, false);
  assert.equal(r.fehler, 'gesperrt');
  assert.equal(r.beginn, null);
});

test('ohne Verordnungs-Id passiert nichts', async () => {
  const r = await leiteBehandlungsbeginnAb(fakeSb(), '', '2026-07-01');
  assert.deepEqual(r, { ok: true, geaendert: false, beginn: '2026-07-01' });
});
