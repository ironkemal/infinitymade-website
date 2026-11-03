import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fehlendeSitzungsnummern, gleicheSitzungenAb, terminZiel, terminZielToplam } from './sitzung-abgleich.js';

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

// ── Doppelbehandlung (0089, gkv-302 27.10.2026): ein Termin = zwei Einheiten ──

test('terminZiel: Doppelbehandlung halbiert, ungerade rundet auf', () => {
  assert.equal(terminZiel(6, false), 6);
  assert.equal(terminZiel(6, true), 3);
  assert.equal(terminZiel(7, true), 4);
  assert.equal(terminZiel(null, true), null);
});

test('gleicheSitzungenAb legt bei Doppelbehandlung nur halb so viele Zeilen an', async () => {
  const { supabase, geschrieben } = supabaseDoppel({ vorhandene: [] });
  const r = await gleicheSitzungenAb({ supabase, prescriptionId: 'rx-1', anzahlEinheiten: 6, doppelbehandlung: true });
  assert.equal(r.ergaenzt, 3);
  assert.deepEqual(geschrieben[0].zeilen.map(z => z.session_number), [1, 2, 3]);
});

test('gleicheSitzungenAb: Mehrere Heilmittel-Items verteilen session_number und heilmittel_index ardışık', async () => {
  const { supabase, geschrieben } = supabaseDoppel({ vorhandene: [] });
  const items = [
    { code: 'X0501', einheiten: 6, doppelbehandlung: false },
    { code: 'X1201', einheiten: 6, doppelbehandlung: false },
  ];
  const r = await gleicheSitzungenAb({ supabase, prescriptionId: 'rx-1', items });
  assert.equal(r.ergaenzt, 12);
  const zeilen = geschrieben[0].zeilen;
  assert.equal(zeilen.length, 12);
  // Sitzungen 1..6 haben heilmittel_index 0
  for (let i = 0; i < 6; i++) {
    assert.equal(zeilen[i].session_number, i + 1);
    assert.equal(zeilen[i].heilmittel_index, 0);
  }
  // Sitzungen 7..12 haben heilmittel_index 1
  for (let i = 6; i < 12; i++) {
    assert.equal(zeilen[i].session_number, i + 1);
    assert.equal(zeilen[i].heilmittel_index, 1);
  }
});

test('gleicheSitzungenAb: Items mit Doppelbehandlung berechnen Soll je Item und setzen heilmittel_index', async () => {
  const { supabase, geschrieben } = supabaseDoppel({ vorhandene: [] });
  const items = [
    { code: 'X0501', einheiten: 6, doppelbehandlung: false }, // 6 Termine -> 1..6 (index 0)
    { code: 'X1201', einheiten: 6, doppelbehandlung: true },  // 3 Termine -> 7..9 (index 1)
  ];
  const r = await gleicheSitzungenAb({ supabase, prescriptionId: 'rx-1', items });
  assert.equal(r.ergaenzt, 9);
  const zeilen = geschrieben[0].zeilen;
  assert.deepEqual(zeilen.map(z => z.session_number), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(zeilen.map(z => z.heilmittel_index), [0, 0, 0, 0, 0, 0, 1, 1, 1]);
});

test('gleicheSitzungenAb: Vorhandene Zeilen werden bei Items nicht überschrieben, Lücken mit passendem Index gefüllt', async () => {
  const { supabase, geschrieben } = supabaseDoppel({
    vorhandene: [{ session_number: 1 }, { session_number: 2 }, { session_number: 7 }],
  });
  const items = [
    { code: 'X0501', einheiten: 6, doppelbehandlung: false }, // 1..6
    { code: 'X1201', einheiten: 4, doppelbehandlung: false }, // 7..10
  ];
  const r = await gleicheSitzungenAb({ supabase, prescriptionId: 'rx-1', items });
  assert.equal(r.ergaenzt, 7); // 3, 4, 5, 6 (index 0) und 8, 9, 10 (index 1)
  const zeilen = geschrieben[0].zeilen;
  assert.deepEqual(zeilen.map(z => [z.session_number, z.heilmittel_index]), [
    [3, 0], [4, 0], [5, 0], [6, 0],
    [8, 1], [9, 1], [10, 1]
  ]);
});

// P0-1: KG 3 + MT 3 registriert, KG auf 5 erhöht -> 2 neue mit index 0, MT bleibt unberührt
test('gleicheSitzungenAb: KG 3 + MT 3 registriert, KG auf 5 erhöht -> 2 neue mit index 0, MT unverändert', async () => {
  const vorhandene = [
    { session_number: 1, status: 'planned', heilmittel_index: 0 },
    { session_number: 2, status: 'done',    heilmittel_index: 0 },
    { session_number: 3, status: 'planned', heilmittel_index: 0 },
    { session_number: 4, status: 'planned', heilmittel_index: 1 },
    { session_number: 5, status: 'done',    heilmittel_index: 1 },
    { session_number: 6, status: 'planned', heilmittel_index: 1 },
  ];
  const { supabase, geschrieben } = supabaseDoppel({ vorhandene });
  const items = [
    { code: 'KG', einheiten: 5, doppelbehandlung: false },
    { code: 'MT', einheiten: 3, doppelbehandlung: false },
  ];
  const r = await gleicheSitzungenAb({ supabase, prescriptionId: 'rx-1', items });
  assert.equal(r.ergaenzt, 2);
  assert.equal(geschrieben.length, 1);
  const zeilen = geschrieben[0].zeilen;
  assert.deepEqual(zeilen.map(z => ({ num: z.session_number, idx: z.heilmittel_index })), [
    { num: 7, idx: 0 },
    { num: 8, idx: 0 },
  ]);
});

test('terminZielToplam: Mehrere Items summieren Terminziele unter Berücksichtigung von Doppelbehandlung', () => {
  const rxMulti = {
    heilmittel_items: [
      { code: 'KG', einheiten: 6, doppelbehandlung: false },
      { code: 'MT', einheiten: 6, doppelbehandlung: true },
    ],
  };
  assert.equal(terminZielToplam(rxMulti), 9); // 6 + 3 = 9
});

test('terminZielToplam: Einzelne Verordnung mit und ohne Doppelbehandlung', () => {
  assert.equal(terminZielToplam({ anzahl_einheiten: 6, doppelbehandlung: true }), 3);
  assert.equal(terminZielToplam({ anzahl_einheiten: 6, doppelbehandlung: false }), 6);
  assert.equal(terminZielToplam(null), 0);
});

test('Altbestand heilmittel_items ohne einheiten: Kapazität und Sitzungen laufen über anzahl_einheiten', async () => {
  const alt = [{ code: 'X0501', bezeichnung: 'KG' }];
  assert.equal(terminZielToplam({ heilmittel_items: alt, anzahl_einheiten: 6 }), 6);
  assert.equal(terminZielToplam({ heilmittel_items: ['KG'], anzahl_einheiten: 6, doppelbehandlung: true }), 3);
  const geschrieben = [];
  const supabase = { from: () => ({
    select: () => ({ eq: async () => ({ data: [], error: null }) }),
    upsert: async (z) => { geschrieben.push(...z); return { error: null }; },
  }) };
  const r = await gleicheSitzungenAb({ supabase, prescriptionId: 'p', anzahlEinheiten: 6, items: alt });
  assert.equal(r.ergaenzt, 6);
  assert.ok(geschrieben.every(z => z.heilmittel_index === 0));
});
