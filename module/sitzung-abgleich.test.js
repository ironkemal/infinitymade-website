import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fehlendeSitzungsnummern, gleicheSitzungenAb } from './sitzung-abgleich.js';

// Der Fund vom 16.08.2026: Verordnung über 18 Einheiten, 13 Sitzungszeilen.
test('der Echtfall — 18 verordnet, 13 vorhanden', () => {
  const da = Array.from({ length: 13 }, (_, i) => ({ session_number: i + 1 }));
  assert.deepEqual(fehlendeSitzungsnummern(da, 18), [14, 15, 16, 17, 18]);
});

test('vollständig — nichts zu tun', () => {
  const da = Array.from({ length: 6 }, (_, i) => ({ session_number: i + 1 }));
  assert.deepEqual(fehlendeSitzungsnummern(da, 6), []);
});

// Lücken in der Mitte entstehen, wenn eine Sitzung gelöscht wurde. Sie müssen
// geschlossen werden, sonst zählt die Verordnung dauerhaft zu wenig Einheiten.
test('Lücke in der Mitte wird geschlossen', () => {
  const da = [{ session_number: 1 }, { session_number: 3 }, { session_number: 4 }];
  assert.deepEqual(fehlendeSitzungsnummern(da, 4), [2]);
});

test('gar keine Zeilen — alle werden ergänzt', () => {
  assert.deepEqual(fehlendeSitzungsnummern([], 3), [1, 2, 3]);
  assert.deepEqual(fehlendeSitzungsnummern(null, 2), [1, 2]);
});

// Überzählige Zeilen bleiben. Eine Zeile oberhalb der Sollzahl kann ein echter
// Termin sein; gelöscht würde daraus ein Abrechnungsverlust.
test('mehr Zeilen als verordnet führt zu keiner Aktion', () => {
  const da = Array.from({ length: 8 }, (_, i) => ({ session_number: i + 1 }));
  assert.deepEqual(fehlendeSitzungsnummern(da, 6), []);
});

test('unbrauchbare Sollzahl prüft nicht', () => {
  assert.deepEqual(fehlendeSitzungsnummern([], null), []);
  assert.deepEqual(fehlendeSitzungsnummern([], 0), []);
  assert.deepEqual(fehlendeSitzungsnummern([], -3), []);
  assert.deepEqual(fehlendeSitzungsnummern([], 'viele'), []);
});

// ── gleicheSitzungenAb mit einem Supabase-Doppel ───────────────────────────

function supabaseDoppel({ vorhandene = [], leseFehler = null, schreibFehler = null } = {}) {
  const geschrieben = [];
  const kette = {
    select: () => kette,
    eq: () => Promise.resolve({ data: vorhandene, error: leseFehler }),
    upsert: (zeilen, optionen) => {
      geschrieben.push({ zeilen, optionen });
      return Promise.resolve({ error: schreibFehler });
    },
  };
  return { supabase: { from: () => kette }, geschrieben };
}

test('fehlende Zeilen werden ergänzt', async () => {
  const { supabase, geschrieben } = supabaseDoppel({
    vorhandene: Array.from({ length: 13 }, (_, i) => ({ session_number: i + 1 })),
  });
  const r = await gleicheSitzungenAb({ supabase, prescriptionId: 'rx-1', anzahlEinheiten: 18 });
  assert.equal(r.ergaenzt, 5);
  assert.equal(r.fehler, null);
  assert.deepEqual(geschrieben[0].zeilen.map(z => z.session_number), [14, 15, 16, 17, 18]);
  assert.equal(geschrieben[0].zeilen[0].status, 'planned');
});

// Zwei Mitarbeiter öffnen dieselbe Verordnung gleichzeitig: der Eindeutigkeits-
// schlüssel muss den zweiten ins Leere laufen lassen, nicht in ein Duplikat.
test('Schreibvorgang läuft über den Eindeutigkeitsschlüssel', async () => {
  const { supabase, geschrieben } = supabaseDoppel({ vorhandene: [] });
  await gleicheSitzungenAb({ supabase, prescriptionId: 'rx-1', anzahlEinheiten: 2 });
  assert.equal(geschrieben[0].optionen.onConflict, 'prescription_id,session_number');
  assert.equal(geschrieben[0].optionen.ignoreDuplicates, true);
});

test('nichts zu tun heisst kein Schreibvorgang', async () => {
  const { supabase, geschrieben } = supabaseDoppel({
    vorhandene: [{ session_number: 1 }, { session_number: 2 }],
  });
  const r = await gleicheSitzungenAb({ supabase, prescriptionId: 'rx-1', anzahlEinheiten: 2 });
  assert.equal(r.ergaenzt, 0);
  assert.equal(geschrieben.length, 0);
});

// Der Abgleich hängt an einer Anzeige — ein Fehler darf sie nie verhindern.
test('Lesefehler wird gemeldet, nicht geworfen', async () => {
  const { supabase } = supabaseDoppel({ leseFehler: { message: 'boom' } });
  const r = await gleicheSitzungenAb({ supabase, prescriptionId: 'rx-1', anzahlEinheiten: 6 });
  assert.equal(r.ergaenzt, 0);
  assert.equal(r.fehler, 'boom');
});

test('Schreibfehler wird gemeldet, nicht geworfen', async () => {
  const { supabase } = supabaseDoppel({ vorhandene: [], schreibFehler: { message: 'rls' } });
  const r = await gleicheSitzungenAb({ supabase, prescriptionId: 'rx-1', anzahlEinheiten: 6 });
  assert.equal(r.ergaenzt, 0);
  assert.equal(r.fehler, 'rls');
});

// Im Bestand steckt eine bereits abgerechnete Verordnung ohne Sitzungszeilen.
// Legte der Abgleich ihr offene Sitzungen nach, stünde sie wieder als
// „in Behandlung" da.
test('abgeschlossene Verordnungen werden nicht angefasst', async () => {
  for (const status of ['completed', 'billed', 'cancelled']) {
    const { supabase, geschrieben } = supabaseDoppel({ vorhandene: [] });
    const r = await gleicheSitzungenAb({ supabase, prescriptionId: 'rx-1', anzahlEinheiten: 6, status });
    assert.equal(r.ergaenzt, 0, status);
    assert.equal(geschrieben.length, 0, status);
  }
});

test('aktive Verordnungen werden ergänzt', async () => {
  for (const status of ['confirmed', 'in_therapy', 'parsed', null]) {
    const { supabase, geschrieben } = supabaseDoppel({ vorhandene: [] });
    const r = await gleicheSitzungenAb({ supabase, prescriptionId: 'rx-1', anzahlEinheiten: 2, status });
    assert.equal(r.ergaenzt, 2, String(status));
    assert.equal(geschrieben.length, 1, String(status));
  }
});

test('ohne prescriptionId passiert nichts', async () => {
  const { supabase, geschrieben } = supabaseDoppel({ vorhandene: [] });
  const r = await gleicheSitzungenAb({ supabase, prescriptionId: null, anzahlEinheiten: 6 });
  assert.equal(r.ergaenzt, 0);
  assert.equal(geschrieben.length, 0);
});
