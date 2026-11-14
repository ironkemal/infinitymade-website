import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  kostentraegerFrischAbleiten,
  KOSTENTRAEGER_NICHT_AUFLOESBAR_CODE,
  KOSTENTRAEGER_IK_NEU_CODE,
} from './kostentraeger-frisch.js';

/** @typedef {import('@supabase/supabase-js').SupabaseClient} SbClient */
/** @typedef {NonNullable<Parameters<typeof kostentraegerFrischAbleiten>[2]>['aufloeser']} AufloeserFn */
const NULL_SB = /** @type {SbClient} */ (/** @type {unknown} */ (null));

test('1) gleiche IK: keine Warnung, Zeile unverändert', async () => {
  const zeile = {
    id: '11112222-3333-4444',
    krankenkasse_ik: '108310400',
    kostentraeger_ik: '108310400',
  };
  const mockAufloeser = async () => '108310400';

  const { warnungen } = await kostentraegerFrischAbleiten(NULL_SB, [zeile], { aufloeser: mockAufloeser });

  assert.equal(warnungen.length, 0);
  assert.equal(zeile.kostentraeger_ik, '108310400');
});

test('2) abweichende IK: Zeile aktualisiert, KOSTENTRAEGER_IK_NEU Warnung mit alt und neu', async () => {
  const zeile = {
    id: '11112222-3333-4444',
    krankenkasse_ik: '108310400',
    kostentraeger_ik: '108310400',
  };
  const mockAufloeser = async () => '103501080';

  const { warnungen } = await kostentraegerFrischAbleiten(NULL_SB, [zeile], { aufloeser: mockAufloeser });

  assert.equal(warnungen.length, 1);
  assert.equal(zeile.kostentraeger_ik, '103501080');
  assert.equal(warnungen[0].code, KOSTENTRAEGER_IK_NEU_CODE);
  assert.equal(warnungen[0].code, 'KOSTENTRAEGER_IK_NEU');
  assert.equal(warnungen[0].prescriptionId, '11112222-3333-4444');
  assert.equal(warnungen[0].alt, '108310400');
  assert.equal(warnungen[0].neu, '103501080');
  assert.equal(
    warnungen[0].text,
    'Verordnung 11112222: Kostenträger-IK laut aktueller Kostenträgerdatei 103501080 statt gespeicherter 108310400 — es wird mit 103501080 abgerechnet.'
  );
});

test('3) nicht auflösbar: wirft 422 KOSTENTRAEGER_NICHT_AUFLOESBAR mit Verordnungs-Kurz-ID und Patientennamen', async () => {
  const zeile = {
    id: 'abcdef12-3456-7890',
    krankenkasse_ik: '108310400',
    kostentraeger_ik: '108310400',
    leads: { first_name: 'Max', last_name: 'Mustermann' },
  };
  const mockAufloeser = async () => null;

  await assert.rejects(
    async () => {
      await kostentraegerFrischAbleiten(NULL_SB, [zeile], { aufloeser: mockAufloeser });
    },
    (/** @type {Error & { status?: number, code?: string, prescriptionId?: string }} */ err) => {
      assert.equal(err.status, 422);
      assert.equal(err.code, KOSTENTRAEGER_NICHT_AUFLOESBAR_CODE);
      assert.equal(err.code, 'KOSTENTRAEGER_NICHT_AUFLOESBAR');
      assert.equal(err.prescriptionId, 'abcdef12-3456-7890');
      assert.equal(
        err.message,
        'Verordnung abcdef12 (Max Mustermann): Zur IK der Versichertenkarte 108310400 wurde in der aktuellen Kostenträgerdatei kein Kostenträger gefunden — Verordnung prüfen bzw. Kostenträgerdatei aktualisieren.'
      );
      return true;
    }
  );
});

test('3b) nicht auflösbar ohne Patientennamen: Verordnung-Kurz-ID ohne Klammer', async () => {
  const zeile = {
    id: 'abcdef12-3456-7890',
    krankenkasse_ik: '108310400',
    kostentraeger_ik: '108310400',
  };
  const mockAufloeser = async () => null;

  await assert.rejects(
    async () => {
      await kostentraegerFrischAbleiten(NULL_SB, [zeile], { aufloeser: mockAufloeser });
    },
    (/** @type {Error & { status?: number, code?: string, prescriptionId?: string }} */ err) => {
      assert.equal(err.status, 422);
      assert.equal(err.code, 'KOSTENTRAEGER_NICHT_AUFLOESBAR');
      assert.equal(
        err.message,
        'Verordnung abcdef12: Zur IK der Versichertenkarte 108310400 wurde in der aktuellen Kostenträgerdatei kein Kostenträger gefunden — Verordnung prüfen bzw. Kostenträgerdatei aktualisieren.'
      );
      return true;
    }
  );
});

test('4) Karten-IK fehlt oder ungültig: Zeile unberührt, Auflöser wird nicht aufgerufen', async () => {
  let aufgerufen = false;
  const mockAufloeser = async () => {
    aufgerufen = true;
    return '108310400';
  };
  const zeilen = [
    { id: '11111111-0000', krankenkasse_ik: null, kostentraeger_ik: '108310400' },
    { id: '22222222-0000', krankenkasse_ik: '', kostentraeger_ik: '108310400' },
    { id: '33333333-0000', krankenkasse_ik: '12345', kostentraeger_ik: '108310400' },
    { id: '44444444-0000', krankenkasse_ik: '10831040a', kostentraeger_ik: '108310400' },
    { id: '55555555-0000', krankenkasse_ik: undefined, kostentraeger_ik: '108310400' },
  ];

  const { warnungen } = await kostentraegerFrischAbleiten(NULL_SB, zeilen, { aufloeser: mockAufloeser });

  assert.equal(aufgerufen, false);
  assert.equal(warnungen.length, 0);
  assert.equal(zeilen[0].kostentraeger_ik, '108310400');
  assert.equal(zeilen[1].kostentraeger_ik, '108310400');
  assert.equal(zeilen[2].kostentraeger_ik, '108310400');
  assert.equal(zeilen[3].kostentraeger_ik, '108310400');
  assert.equal(zeilen[4].kostentraeger_ik, '108310400');
});

test('5) Cache: gleiche Karten-IK in zwei Zeilen -> Auflöser wird nur 1 Mal aufgerufen', async () => {
  let anzahlAufrufe = 0;
  /** @type {AufloeserFn} */
  const mockAufloeser = async (_sb, _patient) => {
    anzahlAufrufe++;
    return '103501080';
  };
  const zeilen = [
    { id: '11111111-0000', krankenkasse_ik: '108310400', kostentraeger_ik: '108310400' },
    { id: '22222222-0000', krankenkasse_ik: '108310400', kostentraeger_ik: '108310400' },
  ];

  const { warnungen } = await kostentraegerFrischAbleiten(NULL_SB, zeilen, { aufloeser: mockAufloeser });

  assert.equal(anzahlAufrufe, 1);
  assert.equal(warnungen.length, 2);
  assert.equal(zeilen[0].kostentraeger_ik, '103501080');
  assert.equal(zeilen[1].kostentraeger_ik, '103501080');
});

test('6) Auflöser erhält kein krankenkasse (Name) Feld, nur krankenkasse_ik', async () => {
  /** @type {{ krankenkasse_ik?: string | null } | null} */
  let uebergebenesPatient = null;
  /** @type {AufloeserFn} */
  const mockAufloeser = async (_sb, patient) => {
    uebergebenesPatient = patient;
    return '108310400';
  };
  const zeile = {
    id: '11111111-0000',
    krankenkasse_ik: '108310400',
    kostentraeger_ik: '108310400',
    krankenkasse: 'Techniker Krankenkasse',
    leads: { krankenkasse: 'Techniker Krankenkasse' },
  };

  await kostentraegerFrischAbleiten(NULL_SB, [/** @type {import('./kostentraeger-frisch.js').KostentraegerZeileInput} */ (/** @type {unknown} */ (zeile))], { aufloeser: mockAufloeser });

  const geprueft = /** @type {{ krankenkasse_ik?: string | null } | null} */ (uebergebenesPatient);
  assert.ok(geprueft !== null);
  assert.equal(geprueft.krankenkasse_ik, '108310400');
  assert.equal('krankenkasse' in geprueft, false);
});

// ── gkv-302 Auflagen 1 + 3 (30.09.2026) ─────────────────────────────────────
import {
  kostentraegerIkZurueckschreiben,
  kostentraegerGeaendertAntwort,
} from './kostentraeger-frisch.js';

test('Preflight: erste Zeile unauflösbar → Fehler je Zeile, spätere Zeilen frisch, aufgeloest enthält nur die aufgelösten', async () => {
  const z1 = { id: 'a1', krankenkasse_ik: '101111111', kostentraeger_ik: '101111111' };
  const z2 = { id: 'b2', krankenkasse_ik: '102222222', kostentraeger_ik: '100000000' };
  const z3 = { id: 'c3', krankenkasse_ik: '103333333', kostentraeger_ik: '103333333' };
  /** @type {AufloeserFn} */
  const auf = async (_s, { krankenkasse_ik }) => (krankenkasse_ik === '101111111' ? null : '109999999');
  const r = await kostentraegerFrischAbleiten(NULL_SB, [z1, z2, z3], { aufloeser: auf, preflight: true });
  assert.equal(r.fehler.length, 1);
  assert.equal(r.fehler[0].prescriptionId, 'a1');
  assert.equal(r.fehler[0].severity, 'stop');
  assert.equal(z2.kostentraeger_ik, '109999999');
  assert.equal(z3.kostentraeger_ik, '109999999');
  assert.deepEqual([...r.aufgeloest], ['b2', 'c3']);
  assert.equal(z1.kostentraeger_ik, '101111111');
});

test('ohne Preflight-Flag wirft unauflösbare Zeile weiterhin 422', async () => {
  const z = { id: 'a1', krankenkasse_ik: '101111111', kostentraeger_ik: '101111111' };
  await assert.rejects(
    kostentraegerFrischAbleiten(NULL_SB, [z], { aufloeser: async () => null }),
    (/** @type {Error & { status?: number, code?: string }} */ e) => e.status === 422 && e.code === KOSTENTRAEGER_NICHT_AUFLOESBAR_CODE);
});

/**
 * @param {Array<{ v: unknown, f: Record<string, unknown> }>} log
 * @param {{ fehler?: boolean }} [opts]
 * @returns {SbClient}
 */
function updateStub(log, { fehler = false } = {}) {
  /** @type {{ v?: unknown, f: Record<string, unknown> }} */
  const q = { f: {} };
  const api = {
    /** @param {string} t */
    from(t) { assert.equal(t, 'prescriptions'); q.f = {}; return api; },
    /** @param {unknown} v */
    update(v) { q.v = v; return api; },
    /** @param {string} c @param {unknown} v */
    eq(c, v) { q.f[c] = v; return api; },
    /** @param {string} c @param {unknown} v */
    is(c, v) { q.f[c] = v; return api; },
    select() {
      log.push({ v: q.v, f: { ...q.f } });
      return Promise.resolve(fehler ? { data: null, error: new Error('x') } : { data: [{ id: q.f.id }], error: null });
    },
  };
  return /** @type {SbClient} */ (/** @type {unknown} */ (api));
}

test('Zurückschreiben: nur bereit + ohne Belegnummer; Update-Bedingung im WHERE', async () => {
  const zeilen = [
    { id: 'a', abrechnung_status: 'bereit', belegnummer: null },
    { id: 'b', abrechnung_status: 'bereit', belegnummer: 'B-1' },
    { id: 'c', abrechnung_status: 'gesendet', belegnummer: null },
    { id: 'd', abrechnung_status: null, belegnummer: null },
  ];
  const warn = zeilen.map(z => ({ code: KOSTENTRAEGER_IK_NEU_CODE, prescriptionId: z.id, alt: '1', neu: '2' }));
  /** @type {Array<{ v: unknown, f: Record<string, unknown> }>} */
  const log = [];
  const ids = await kostentraegerIkZurueckschreiben(updateStub(log), zeilen, warn, 'owner-1');
  assert.deepEqual(ids, ['a']);
  assert.equal(log.length, 1);
  assert.deepEqual(log[0].v, { kostentraeger_ik: '2' });
  assert.deepEqual(log[0].f, { id: 'a', owner_id: 'owner-1', abrechnung_status: 'bereit', belegnummer: null });
});

test('Zurückschreiben: DB-Fehler wird nicht geworfen, id nicht gemeldet', async () => {
  const zeilen = [{ id: 'a', abrechnung_status: 'bereit', belegnummer: null }];
  const warn = [{ code: KOSTENTRAEGER_IK_NEU_CODE, prescriptionId: 'a', alt: '1', neu: '2' }];
  const orig = console.warn; console.warn = () => {};
  try {
    assert.deepEqual(await kostentraegerIkZurueckschreiben(updateStub([], { fehler: true }), zeilen, warn, 'o'), []);
  } finally { console.warn = orig; }
});

test('409-Text: „neu laden" nur wenn zurückgeschrieben, sonst ehrlicher Hinweis', () => {
  const ja = kostentraegerGeaendertAntwort('12345678xx', '1', '2', true);
  const nein = kostentraegerGeaendertAntwort('12345678xx', '1', '2', false);
  assert.equal(ja.code, 'KOSTENTRAEGER_GEAENDERT');
  assert.match(ja.error, /Liste neu laden/);
  assert.match(nein.error, /Neu-Laden allein hilft hier nicht/);
  assert.doesNotMatch(nein.error, /Bitte Liste neu laden/);
});
