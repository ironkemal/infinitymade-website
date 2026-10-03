import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefePodologieEmpfangsnachweise, enthaeltHpnr78040 } from './podo-empfangsnachweis.js';

test('enthaeltHpnr78040 identifiziert 78040 streng per String-Array', () => {
  assert.equal(enthaeltHpnr78040(['78040']), true);
  assert.equal(enthaeltHpnr78040(['78010', '78040']), true);
  assert.equal(enthaeltHpnr78040(['78010', '78020']), false);
  assert.equal(enthaeltHpnr78040([78040]), false); // Keine Number-Koerzierung
  assert.equal(enthaeltHpnr78040('78040'), false); // Kein String/CSV-Fallback
  assert.equal(enthaeltHpnr78040('78010, 78040'), false);
  assert.equal(enthaeltHpnr78040(null), false);
  assert.equal(enthaeltHpnr78040(undefined), false);
});

test('pruefePodologieEmpfangsnachweise: Leere Liste erfordert keine DB-Abfragen', async () => {
  let dbCalls = 0;
  const fakeSupabase = {
    from() {
      dbCalls++;
      return this;
    },
  };
  const res = await pruefePodologieEmpfangsnachweise({
    supabase: fakeSupabase,
    tenantId: '11111111-1111-4111-8111-111111111111',
    behandlungen: [],
  });
  assert.equal(res.ok, true);
  assert.equal(res.gepruefteIds.length, 0);
  assert.equal(dbCalls, 0);
});

test('pruefePodologieEmpfangsnachweise: Nicht-78040 Behandlungen (z.B. Physio/78010) werden ignoriert', async () => {
  let dbCalls = 0;
  const fakeSupabase = {
    from() {
      dbCalls++;
      return this;
    },
  };
  const res = await pruefePodologieEmpfangsnachweise({
    supabase: fakeSupabase,
    tenantId: '11111111-1111-4111-8111-111111111111',
    behandlungen: [
      { id: 'b1', hpnr_codes: ['78010'], storniert_am: null, behandlungsdatum: '2026-10-01' },
      { id: 'b2', hpnr_codes: ['78040'], storniert_am: '2026-10-02T10:00:00Z', behandlungsdatum: '2026-10-01' },
    ],
  });
  assert.equal(res.ok, true);
  assert.equal(dbCalls, 0);
});

test('pruefePodologieEmpfangsnachweise: DB-Fehler führt zu Fail-Closed 503', async () => {
  const fakeSupabase = {
    from(table) {
      assert.equal(table, 'podologie_empfangsnachweise');
      return {
        select() { return this; },
        eq() { return this; },
        in() { return this; },
        order() {
          return Promise.resolve({ data: null, error: { message: 'DB connection failure' } });
        },
      };
    },
  };

  const res = await pruefePodologieEmpfangsnachweise({
    supabase: fakeSupabase,
    tenantId: '11111111-1111-4111-8111-111111111111',
    behandlungen: [
      { id: 'beh-1', hpnr_codes: ['78040'], storniert_am: null, behandlungsdatum: '2026-10-01' },
    ],
  });

  assert.equal(res.ok, false);
  assert.equal(res.status, 503);
  assert.match(res.error, /Datenbankfehler/);
});

test('pruefePodologieEmpfangsnachweise: Fehlender Nachweis führt zu 422', async () => {
  const fakeSupabase = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        in() { return this; },
        order() {
          return Promise.resolve({ data: [], error: null });
        },
      };
    },
  };

  const res = await pruefePodologieEmpfangsnachweise({
    supabase: fakeSupabase,
    tenantId: '11111111-1111-4111-8111-111111111111',
    behandlungen: [
      { id: 'beh-missing', hpnr_codes: ['78040'], storniert_am: null, behandlungsdatum: '2026-10-01' },
    ],
  });

  assert.equal(res.ok, false);
  assert.equal(res.status, 422);
  assert.deepEqual(res.fehlendeBehandlungIds, ['beh-missing']);
});

test('pruefePodologieEmpfangsnachweise: Widerrufener Nachweis führt zu 422', async () => {
  const fakeSupabase = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        in() { return this; },
        order() {
          return Promise.resolve({
            data: [
              {
                event_seq: 2,
                owner_id: '11111111-1111-4111-8111-111111111111',
                behandlung_id: 'beh-withdrawn',
                behandlungsdatum: '2026-10-01',
                hpnr_code: '78040',
                therapeuteninitialen: 'MD',
                status: 'widerrufen',
              },
              {
                event_seq: 1,
                owner_id: '11111111-1111-4111-8111-111111111111',
                behandlung_id: 'beh-withdrawn',
                behandlungsdatum: '2026-10-01',
                hpnr_code: '78040',
                therapeuteninitialen: 'MD',
                status: 'bestaetigt',
              },
            ],
            error: null,
          });
        },
      };
    },
  };

  const res = await pruefePodologieEmpfangsnachweise({
    supabase: fakeSupabase,
    tenantId: '11111111-1111-4111-8111-111111111111',
    behandlungen: [
      { id: 'beh-withdrawn', hpnr_codes: ['78040'], storniert_am: null, behandlungsdatum: '2026-10-01' },
    ],
  });

  assert.equal(res.ok, false);
  assert.equal(res.status, 422);
  assert.deepEqual(res.fehlendeBehandlungIds, ['beh-withdrawn']);
});

test('pruefePodologieEmpfangsnachweise: Snapshot-Diskrepanz (falsches Datum) führt zu 422', async () => {
  const fakeSupabase = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        in() { return this; },
        order() {
          return Promise.resolve({
            data: [
              {
                event_seq: 1,
                owner_id: '11111111-1111-4111-8111-111111111111',
                behandlung_id: 'beh-mismatch',
                behandlungsdatum: '2026-09-30',
                hpnr_code: '78040',
                therapeuteninitialen: 'MD',
                status: 'bestaetigt',
              },
            ],
            error: null,
          });
        },
      };
    },
  };

  const res = await pruefePodologieEmpfangsnachweise({
    supabase: fakeSupabase,
    tenantId: '11111111-1111-4111-8111-111111111111',
    behandlungen: [
      { id: 'beh-mismatch', hpnr_codes: ['78040'], storniert_am: null, behandlungsdatum: '2026-10-01' },
    ],
  });

  assert.equal(res.ok, false);
  assert.equal(res.status, 422);
  assert.deepEqual(res.fehlendeBehandlungIds, ['beh-mismatch']);
});

test('pruefePodologieEmpfangsnachweise: Erfolgreiche Validierung mit gültigen Initialen', async () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const fakeSupabase = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        in() { return this; },
        order() {
          return Promise.resolve({
            data: [
              {
                event_seq: 5,
                owner_id: tenantId,
                behandlung_id: 'beh-ok',
                behandlungsdatum: '2026-10-01',
                hpnr_code: '78040',
                therapeuteninitialen: 'TH-PODO',
                status: 'bestaetigt',
              },
            ],
            error: null,
          });
        },
      };
    },
  };

  const res = await pruefePodologieEmpfangsnachweise({
    supabase: fakeSupabase,
    tenantId,
    behandlungen: [
      { id: 'beh-ok', hpnr_codes: ['78040'], storniert_am: null, behandlungsdatum: '2026-10-01' },
    ],
  });

  assert.equal(res.ok, true);
  assert.deepEqual(res.gepruefteIds, ['beh-ok']);
});

test('pruefePodologieEmpfangsnachweise: Relevante Behandlung ohne ID führt zu Fail-Closed 422', async () => {
  const res = await pruefePodologieEmpfangsnachweise({
    supabase: {},
    tenantId: '11111111-1111-4111-8111-111111111111',
    behandlungen: [
      { hpnr_codes: ['78040'], storniert_am: null, behandlungsdatum: '2026-10-01' },
    ],
  });
  assert.equal(res.ok, false);
  assert.equal(res.status, 422);
  assert.match(res.error, /unvollständig/);
});

test('pruefePodologieEmpfangsnachweise: Relevante Behandlung ohne Datum führt zu Fail-Closed 422', async () => {
  const res = await pruefePodologieEmpfangsnachweise({
    supabase: {},
    tenantId: '11111111-1111-4111-8111-111111111111',
    behandlungen: [
      { id: 'b-nodate', hpnr_codes: ['78040'], storniert_am: null },
    ],
  });
  assert.equal(res.ok, false);
  assert.equal(res.status, 422);
  assert.match(res.error, /unvollständig/);
});

test('pruefePodologieEmpfangsnachweise: Explizite Params überspringen Nicht-GKV / Nicht-Podo ohne DB-Query', async () => {
  let dbCalls = 0;
  const fakeSupabase = {
    from() {
      dbCalls++;
      return this;
    },
  };

  const resNonPodo = await pruefePodologieEmpfangsnachweise({
    supabase: fakeSupabase,
    tenantId: '11111111-1111-4111-8111-111111111111',
    therapieBereich: 'physio',
    behandlungen: [{ id: 'b1', hpnr_codes: ['78040'], behandlungsdatum: '2026-10-01' }],
  });
  assert.equal(resNonPodo.ok, true);
  assert.equal(dbCalls, 0);

  const resNonKassen = await pruefePodologieEmpfangsnachweise({
    supabase: fakeSupabase,
    tenantId: '11111111-1111-4111-8111-111111111111',
    rezeptart: 'privat',
    behandlungen: [{ id: 'b1', hpnr_codes: ['78040'], behandlungsdatum: '2026-10-01' }],
  });
  assert.equal(resNonKassen.ok, true);
  assert.equal(dbCalls, 0);
});

test('pruefePodologieEmpfangsnachweise: Event mit neuester event_seq überschreibt frühere Bestätigung', async () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const fakeSupabase = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        in() { return this; },
        order() {
          return Promise.resolve({
            data: [
              {
                event_seq: 1,
                owner_id: tenantId,
                behandlung_id: 'beh-seq',
                behandlungsdatum: '2026-10-01',
                hpnr_code: '78040',
                therapeuteninitialen: 'OK',
                status: 'bestaetigt',
              },
              {
                event_seq: 2,
                owner_id: tenantId,
                behandlung_id: 'beh-seq',
                behandlungsdatum: '2026-10-01',
                hpnr_code: '78040',
                therapeuteninitialen: 'OK',
                status: 'widerrufen',
              },
            ],
            error: null,
          });
        },
      };
    },
  };

  const res = await pruefePodologieEmpfangsnachweise({
    supabase: fakeSupabase,
    tenantId,
    behandlungen: [
      { id: 'beh-seq', hpnr_codes: ['78040'], storniert_am: null, behandlungsdatum: '2026-10-01' },
    ],
  });

  assert.equal(res.ok, false);
  assert.equal(res.status, 422);
  assert.deepEqual(res.fehlendeBehandlungIds, ['beh-seq']);
});

test('pruefePodologieEmpfangsnachweise: Nicht-Array behandlungen (null, Objekt, Zahl) liefert kontrollierten 503 vor DB', async () => {
  let dbCalled = false;
  const fakeSupabase = {
    from() {
      dbCalled = true;
      return this;
    },
  };

  for (const invalid of [null, undefined, {}, 'string', 12345]) {
    const res = await pruefePodologieEmpfangsnachweise({
      supabase: fakeSupabase,
      tenantId: '11111111-1111-4111-8111-111111111111',
      behandlungen: invalid,
    });
    assert.equal(res.ok, false);
    assert.equal(res.status, 503);
    assert.match(res.error, /Ungültiges Behandlungsformat/);
  }
  assert.equal(dbCalled, false);
});

test('pruefePodologieEmpfangsnachweise: Nicht-stornierte Zeile mit fehlerhaften/null hpnr_codes liefert kontrollierten 503', async () => {
  let dbCalled = false;
  const fakeSupabase = {
    from() {
      dbCalled = true;
      return this;
    },
  };

  const invalidRows = [
    { id: 'b1', hpnr_codes: null, storniert_am: null, behandlungsdatum: '2026-10-01' },
    { id: 'b2', hpnr_codes: undefined, storniert_am: null, behandlungsdatum: '2026-10-01' },
    { id: 'b3', hpnr_codes: '78040', storniert_am: null, behandlungsdatum: '2026-10-01' },
    { id: 'b4', hpnr_codes: [78040], storniert_am: null, behandlungsdatum: '2026-10-01' },
    { id: 'b5', hpnr_codes: ['78010', null], storniert_am: null, behandlungsdatum: '2026-10-01' },
    null,
    'invalid-row',
  ];

  for (const row of invalidRows) {
    const res = await pruefePodologieEmpfangsnachweise({
      supabase: fakeSupabase,
      tenantId: '11111111-1111-4111-8111-111111111111',
      behandlungen: [row],
    });
    assert.equal(res.ok, false);
    assert.equal(res.status, 503);
  }
  assert.equal(dbCalled, false);

  // Stornierte Zeilen mit unvollständigen HPNR dürfen dagegen ignoriert werden
  const stornoRes = await pruefePodologieEmpfangsnachweise({
    supabase: fakeSupabase,
    tenantId: '11111111-1111-4111-8111-111111111111',
    behandlungen: [
      { id: 'b-storno', hpnr_codes: null, storniert_am: '2026-10-02T10:00:00Z', behandlungsdatum: '2026-10-01' },
    ],
  });
  assert.equal(stornoRes.ok, true);
  assert.equal(dbCalled, false);
});

test('pruefePodologieEmpfangsnachweise: Fehlerhafte Events-Antwort (nicht-Array oder nicht-Objekt) liefert kontrollierten 503', async () => {
  for (const malformedData of ['not-an-array', 123, null, [null], ['string-event']]) {
    const fakeSupabase = {
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          in() { return this; },
          order() {
            return Promise.resolve({ data: malformedData, error: null });
          },
        };
      },
    };

    const res = await pruefePodologieEmpfangsnachweise({
      supabase: fakeSupabase,
      tenantId: '11111111-1111-4111-8111-111111111111',
      behandlungen: [
        { id: 'b1', hpnr_codes: ['78040'], storniert_am: null, behandlungsdatum: '2026-10-01' },
      ],
    });
    assert.equal(res.ok, false);
    assert.equal(res.status, 503);
  }
});

test('pruefePodologieEmpfangsnachweise: Ungültige oder unsichere event_seq liefert kontrollierten 503 ohne Exception', async () => {
  for (const badSeq of ['invalid', '0', '-5', -1, 0, 1.5, 9007199254740992, '9007199254740992-bad']) {
    const fakeSupabase = {
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          in() { return this; },
          order() {
            return Promise.resolve({
              data: [{
                event_seq: badSeq,
                owner_id: '11111111-1111-4111-8111-111111111111',
                behandlung_id: 'beh-badseq',
                behandlungsdatum: '2026-10-01',
                hpnr_code: '78040',
                therapeuteninitialen: 'OK',
                status: 'bestaetigt',
              }],
              error: null,
            });
          },
        };
      },
    };

    const res = await pruefePodologieEmpfangsnachweise({
      supabase: fakeSupabase,
      tenantId: '11111111-1111-4111-8111-111111111111',
      behandlungen: [
        { id: 'beh-badseq', hpnr_codes: ['78040'], storniert_am: null, behandlungsdatum: '2026-10-01' },
      ],
    });
    assert.equal(res.ok, false);
    assert.equal(res.status, 503);
    assert.match(res.error, /Ungültige Ereignis-Sequenz/);
  }
});

test('pruefePodologieEmpfangsnachweise: BigInt-Sortierung bei 9007199254740992 vs 9007199254740993 als Strings (neuere Rücknahme blockiert mit 422)', async () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  // Unsortiert zurückgegeben: ältere Bestätigung zuerst
  const fakeSupabase = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        in() { return this; },
        order() {
          return Promise.resolve({
            data: [
              {
                event_seq: '9007199254740992',
                owner_id: tenantId,
                behandlung_id: 'beh-bigint',
                behandlungsdatum: '2026-10-01',
                hpnr_code: '78040',
                therapeuteninitialen: 'OK',
                status: 'bestaetigt',
              },
              {
                event_seq: '9007199254740993',
                owner_id: tenantId,
                behandlung_id: 'beh-bigint',
                behandlungsdatum: '2026-10-01',
                hpnr_code: '78040',
                therapeuteninitialen: 'OK',
                status: 'widerrufen',
              },
            ],
            error: null,
          });
        },
      };
    },
  };

  const res = await pruefePodologieEmpfangsnachweise({
    supabase: fakeSupabase,
    tenantId,
    behandlungen: [
      { id: 'beh-bigint', hpnr_codes: ['78040'], storniert_am: null, behandlungsdatum: '2026-10-01' },
    ],
  });

  assert.equal(res.ok, false);
  assert.equal(res.status, 422);
  assert.deepEqual(res.fehlendeBehandlungIds, ['beh-bigint']);
});
