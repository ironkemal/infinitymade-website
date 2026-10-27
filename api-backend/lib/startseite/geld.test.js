import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ladeGeld } from './geld.js';
import { ladeMandantenZeilen } from './finanzadapter.js';

const tenantId = '00000000-0000-4000-8000-000000000001';
const fremd = '00000000-0000-4000-8000-000000000002';
const jetzt = new Date('2026-10-27T10:00:00Z');
const id = n => String(n).padStart(8, '0');
const beleg = (n, extra = {}) => ({ id: id(n), owner_id: tenantId, type: 'zuzahlung', amount_eur: '1.00', created_at: '2026-10-15T12:00:00Z', ...extra });
const zahlung = (n, extra = {}) => ({ id: id(n), owner_id: tenantId, art: 'zahlung', betrag_eur: '10.00', datum: '2026-10-15', ...extra });

// Closed in-memory PostgREST double: no client, env, socket or network fallback.
function fixture(tables = {}, { cap = 1000, fail, corrupt } = {}) {
  const calls = [];
  const supabase = { from(table) {
    assert.ok(['belegliste', 'abrechnung_zahlung', 'prescriptions', 'abrechnung', 'abrechnung_zeile'].includes(table), `Unzulässiger Read: ${table}`);
    const call = { table, filters: [] };
    const q = {
      select(spalten) { call.spalten = spalten; return q; },
      eq(feld, wert) { call.filters.push(['eq', feld, wert]); return q; },
      gt(feld, wert) { call.filters.push(['gt', feld, wert]); return q; },
      gte(feld, wert) { call.filters.push(['gte', feld, wert]); return q; },
      lt(feld, wert) { call.filters.push(['lt', feld, wert]); return q; },
      in(feld, wert) { assert.ok(wert.length <= 200); call.filters.push(['in', feld, wert]); return q; },
      order(feld, options) { assert.equal(feld, 'id'); assert.deepEqual(options, { ascending: true }); return q; },
      async limit(limit) {
        assert.equal(limit, 1000);
        assert.ok(call.filters.some(f => f[0] === 'eq' && f[1] === 'owner_id' && f[2] === tenantId));
        calls.push(call);
        if (fail?.(call, calls)) return { data: null, error: { message: 'RAW secret synthetic failure' } };
        let rows = (tables[table] || []).filter(row => call.filters.every(([op, k, v]) => {
          if (op === 'eq') return row[k] === v;
          if (op === 'in') return v.includes(row[k]);
          if (op === 'gt') return row[k] > v;
          // Timestamp comparison uses instants, DATE comparison uses calendar dates.
          const a = k === 'created_at' ? Date.parse(row[k]) : row[k];
          const b = k === 'created_at' ? Date.parse(v) : v;
          return op === 'gte' ? a >= b : a < b;
        })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).slice(0, Math.min(cap, limit));
        rows = rows.map(row => Object.fromEntries(call.spalten.split(',').map(k => [k, row[k]])));
        return { data: corrupt ? corrupt(rows, call, calls) : rows, error: null };
      },
    };
    return q;
  } };
  return { supabase, calls };
}

test('E13: alle Zahlarten, alle Einnahmetypen, signed Storno; Privat nur Journal, keine Ausbuchung', async () => {
  const zahlarten = ['bar', 'ec', 'ueberweisung', 'paypal', 'sonstiges', null];
  const f = fixture({
    belegliste: [...zahlarten.map((zahlart, i) => beleg(i, { zahlart })),
      beleg(10, { type: 'rechnung', amount_eur: '20.00', invoice_id: 'private' }),
      beleg(11, { type: 'ausfall', amount_eur: '3.00' }),
      beleg(12, { type: 'barverkauf', amount_eur: '2.00' }),
      beleg(13, { type: 'storno', amount_eur: '-1.00' })],
    // Must never be queried or added, including its non-cash write-off.
    rechnung_zahlungen: [{ art: 'zahlung', betrag_eur: 20 }, { art: 'ausbuchung', betrag_eur: 99 }],
  });
  const r = await ladeGeld({ supabase: f.supabase, tenantId, jetzt });
  assert.deepEqual(r.kassiert.patient, { bekanntCent: 3000, gesamtCent: 3000, unbekanntAnzahl: 0, gruende: [] });
  assert.equal(r.scope, 'mandant');
  assert.equal(r.monat, '2026-10');
  assert.equal(r.quelle.patient, 'belegliste.created_at');
  assert.match(r.umfang.patient, /Kassiert diesen Monat \(erfasst im Kassenbuch\)/);
  assert.match(r.umfang.erklaerung, /Zahlungsdatum/);
  for (const feld of ['privat', 'ausfall']) {
    assert.equal(r.offen[feld].bekanntCent, 0);
    assert.equal(r.offen[feld].gesamtCent, null);
    assert.equal(r.offen[feld].unbekanntAnzahl, null);
    assert.ok(r.offen[feld].gruende.length);
  }
  assert.equal(Object.hasOwn(r.offen, 'gesamtCent'), false);
  assert.equal(JSON.stringify(r).includes('invoice_id'), false);
});

test('Kasse: Zahlung minus Rücklastschrift; Abschreibung kein Cash; Korrektur und Vorzeichen Unknown', async () => {
  const f = fixture({ abrechnung_zahlung: [zahlung(1), zahlung(2, { art: 'ruecklastschrift', betrag_eur: '-2.00' }),
    zahlung(3, { art: 'abschreibung', betrag_eur: '99.00' }), zahlung(4, { art: 'korrektur', betrag_eur: '-3.00' }),
    zahlung(5, { art: 'zahlung', betrag_eur: '-1.00' }), zahlung(6, { art: 'ruecklastschrift', betrag_eur: '1.00' })] });
  const r = await ladeGeld({ ...f, tenantId, jetzt });
  assert.equal(r.kassiert.kasse.bekanntCent, 800);
  assert.equal(r.kassiert.kasse.gesamtCent, null);
  assert.equal(r.kassiert.kasse.unbekanntAnzahl, 3);
  assert.deepEqual(r.kassiert.kasse.gruende, ['KASSE_KORREKTUR_UNGEKLAERT', 'KASSE_VORZEICHEN_UNGUELTIG']);
  assert.deepEqual(r.anomalien, [{ code: 'KASSE_KORREKTUR_UNGEKLAERT', anzahl: 1 }, { code: 'KASSE_VORZEICHEN_UNGUELTIG', anzahl: 2 }]);
  assert.equal(r.quelle.kasse, 'abrechnung_zahlung.datum');
});

test('B03 unverändert: GKV-Aggregat einschließlich Unknown, Privat ausgeschlossen, keine Posten/IDs', async () => {
  const f = fixture({ prescriptions: [
    { id: 'gkv', owner_id: tenantId, rezeptart: 'kassen', therapie_bereich: 'physio', zuzahlung_eur: '10.00' },
    { id: 'unknown', owner_id: tenantId, rezeptart: 'kassen', therapie_bereich: 'physio', zuzahlung_eur: null },
    { id: 'private', owner_id: tenantId, rezeptart: 'privat', zuzahlung_eur: 900 },
  ], belegliste: [beleg(1, { prescription_id: 'gkv', amount_eur: '2.00' })] });
  const r = await ladeGeld({ ...f, tenantId, jetzt });
  assert.equal(r.offen.zuzahlung.patientBekanntCent, 800);
  assert.equal(r.offen.zuzahlung.bekanntCent, 800);
  assert.equal(r.offen.zuzahlung.gesamtCent, null);
  assert.equal(r.offen.zuzahlung.unbekanntAnzahl, 1);
  assert.deepEqual(r.offen.zuzahlung.gruende, ['PATIENT_SOLL_UNBEKANNT']);
  assert.equal(Object.hasOwn(r.offen.zuzahlung, 'posten'), false);
  assert.doesNotMatch(JSON.stringify(r), /refId|"gkv"|"unknown"|"private"|RAW/);
});

test('B03 VKZ03 wird ausschließlich aggregiert übernommen; paid-Status erzeugt keinen Cash', async () => {
  const f = fixture({
    prescriptions: [{ id: 'rx', owner_id: tenantId, rezeptart: 'kassen', therapie_bereich: 'physio',
      belegnummer: 'beleg', zuzahlung_eur: '10.00', zuzahlung_befreit: false }],
    abrechnung: [
      { id: 'original', owner_id: tenantId, status: 'paid', betriebsart: 'echt', verarbeitungskennzeichen: '01' },
      { id: 'claim', owner_id: tenantId, status: 'gesendet', betriebsart: 'echt', verarbeitungskennzeichen: '03', zuzahlungsforderung_ursprung_id: 'ursprung' },
    ],
    abrechnung_zeile: [
      { id: 'ursprung', owner_id: tenantId, abrechnung_id: 'original', prescription_id: 'rx', belegnummer: 'beleg',
        herkunft: 'einreichung', status: 'akzeptiert', zuzahlung_eur: '10.00', netto_eur: '90.00', absetzung_eur: '0.00' },
      { id: 'claim-zeile', owner_id: tenantId, abrechnung_id: 'claim', prescription_id: 'rx', belegnummer: 'beleg',
        herkunft: 'einreichung', status: 'eingereicht', zuzahlung_eur: '0.00', netto_eur: '10.00', absetzung_eur: '0.00' },
    ],
  }, { cap: 1 });
  const r = await ladeGeld({ ...f, tenantId, jetzt });
  assert.deepEqual(r.offen.zuzahlung, { bekanntCent: 1000, gesamtCent: 1000, unbekanntAnzahl: 0,
    gruende: [], patientBekanntCent: 0, kasseBekanntCent: 1000, klaerungBekanntCent: 0 });
  assert.equal(r.kassiert.kasse.gesamtCent, 0);
  assert.doesNotMatch(JSON.stringify(r), /refId|"rx"|"claim"|"ursprung"|"beleg"/);
});

test('B03 abhängige ID-Chunks ≤200 und gekappte Seiten bleiben vollständig; Folgefehler propagiert', async () => {
  const tables = {
    prescriptions: Array.from({ length: 201 }, (_, n) => ({ id: id(n), owner_id: tenantId, rezeptart: 'kassen', therapie_bereich: 'physio', zuzahlung_eur: '2.00' })),
    belegliste: Array.from({ length: 201 }, (_, n) => beleg(n, { prescription_id: id(n) })),
    abrechnung: [{ id: 'kopf', owner_id: tenantId, status: 'erstellt' }],
    abrechnung_zeile: [{ id: 'zeile', owner_id: tenantId, abrechnung_id: 'kopf' }],
  };
  const f = fixture(tables, { cap: 77 });
  const r = await ladeGeld({ ...f, tenantId, jetzt });
  assert.equal(r.offen.zuzahlung.gesamtCent, 20100);
  const chunks = f.calls.filter(c => c.table === 'belegliste' && c.filters.some(v => v[0] === 'in'));
  assert.ok(chunks.some(c => c.filters.some(v => v[0] === 'in' && v[2].length === 200)));
  assert.ok(chunks.some(c => c.filters.some(v => v[0] === 'in' && v[2].length === 1)));
  assert.ok(chunks.some(c => c.filters.some(v => v[0] === 'gt')));
  for (const table of ['belegliste', 'abrechnung_zeile', 'abrechnung_zahlung']) {
    const broken = fixture(tables, { cap: 77, fail: c => c.table === table && c.filters.some(v => v[0] === 'in') });
    await assert.rejects(ladeGeld({ ...broken, tenantId, jetzt }));
  }
});

test('Berliner Monat: Jahreswechsel, DST und Storno bleibt im Erfassungsmonat', async () => {
  for (const [clock, monat, von, bis] of [
    ['2026-12-31T23:30:00Z', '2027-01', '2026-12-31T23:00:00.000Z', '2027-01-31T23:00:00.000Z'],
    ['2026-03-29T12:00:00Z', '2026-03', '2026-02-28T23:00:00.000Z', '2026-03-31T22:00:00.000Z'],
    ['2026-10-27T12:00:00Z', '2026-10', '2026-09-30T22:00:00.000Z', '2026-10-31T23:00:00.000Z'],
  ]) {
    const folgeMonat = monat === '2027-01' ? '2027-02-01' : monat === '2026-03' ? '2026-04-01' : '2026-11-01';
    const davor = new Date(Date.parse(`${monat}-01T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
    const letzterTag = new Date(Date.parse(`${folgeMonat}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
    const f = fixture({ belegliste: [beleg(1, { created_at: new Date(Date.parse(von) - 1).toISOString() }),
      beleg(2, { created_at: von }), beleg(3, { created_at: bis }),
      beleg(4, { type: 'storno', amount_eur: '-0.40', created_at: new Date(Date.parse(bis) - 1).toISOString() })],
      abrechnung_zahlung: [
        zahlung(1, { datum: davor, betrag_eur: '1000.00' }),
        zahlung(2, { datum: `${monat}-01`, betrag_eur: '10.00' }),
        zahlung(3, { datum: letzterTag, betrag_eur: '2.00' }),
        zahlung(4, { datum: folgeMonat, betrag_eur: '1000.00' }),
      ] }, { cap: 1 });
    const r = await ladeGeld({ ...f, tenantId, jetzt: new Date(clock) });
    assert.equal(r.monat, monat);
    assert.equal(r.kassiert.patient.gesamtCent, 60);
    assert.equal(r.kassiert.kasse.gesamtCent, 1200);
    const kassenCalls = f.calls.filter(c => c.table === 'abrechnung_zahlung');
    assert.equal(kassenCalls.length, 3, 'Zwei Monatszeilen plus leere Schlussseite bei Servercap 1');
    for (const call of f.calls.filter(c => ['belegliste', 'abrechnung_zahlung'].includes(c.table))) {
      assert.deepEqual(call.filters.filter(v => v[0] === 'gte' || v[0] === 'lt'), call.table === 'belegliste'
        ? [['gte', 'created_at', von], ['lt', 'created_at', bis]]
        : [['gte', 'datum', `${monat}-01`], ['lt', 'datum', folgeMonat]]);
    }
  }
  const f = fixture({ belegliste: [beleg(1, { amount_eur: '10.00', created_at: '2026-09-15T10:00:00Z' }),
    beleg(2, { amount_eur: '-10.00', type: 'storno', created_at: '2026-10-15T10:00:00Z' })] });
  assert.equal((await ladeGeld({ ...f, tenantId, jetzt })).kassiert.patient.gesamtCent, -1000);
  assert.equal((await ladeGeld({ ...f, tenantId, jetzt: new Date('2026-09-20') })).kassiert.patient.gesamtCent, 1000);
});

test('Keyset: >1000, Servercap und exakt volle Seite jeweils bis leer, alle Monatsfilter erneut', async () => {
  for (const [count, cap] of [[1001, 1000], [7, 2], [1000, 1000]]) {
    const f = fixture({ belegliste: Array.from({ length: count }, (_, n) => beleg(n)) }, { cap });
    const r = await ladeGeld({ ...f, tenantId, jetzt });
    assert.equal(r.kassiert.patient.gesamtCent, count * 100);
    const calls = f.calls.filter(c => c.table === 'belegliste' && c.filters.some(v => v[0] === 'gte'));
    assert.equal(calls.length, Math.ceil(count / cap) + 1);
    assert.ok(calls.slice(1).every(c => c.filters.some(v => v[0] === 'gt' && v[1] === 'id')));
  }
});

test('Fehler jeder Folgequelle/Seite werfen statt partieller Erfolg; keine rohen Fehler', async () => {
  for (const table of ['belegliste', 'abrechnung_zahlung', 'prescriptions', 'abrechnung']) {
    const f = fixture({ [table]: table === 'belegliste' ? [beleg(1)] : table === 'abrechnung_zahlung' ? [zahlung(1)] : [{ id: '1', owner_id: tenantId }] },
      { cap: 1, fail: c => c.table === table && c.filters.some(v => v[0] === 'gt') });
    await assert.rejects(ladeGeld({ ...f, tenantId, jetzt }));
  }
  for (const table of ['belegliste', 'abrechnung_zahlung']) {
    const f = fixture({}, { fail: c => c.table === table });
    await assert.rejects(ladeGeld({ ...f, tenantId, jetzt }), e => !e.message.includes('RAW'));
  }
});

test('Reader weist Fremdowner, fehlende IDs, unsortierte/doppelte/wiederholte Seiten ab', async () => {
  for (const rows of [[beleg(1, { owner_id: fremd })], [beleg(1, { id: null })], [beleg(2), beleg(1)], [beleg(1), beleg(1)]]) {
    const f = fixture({}, { corrupt: () => rows });
    await assert.rejects(ladeMandantenZeilen({ ...f, tenantId, tabelle: 'belegliste', spalten: 'id,owner_id,type,amount_eur' }));
  }
  const f = fixture({}, { corrupt: () => [beleg(1)] });
  await assert.rejects(ladeMandantenZeilen({ ...f, tenantId, tabelle: 'belegliste', spalten: 'id,owner_id' }));
  assert.equal(f.calls.length, 2);
});

test('Invalid Tenant/Uhr vor jedem Read; bekannte Null ist 0, fehlender Umfang bleibt null', async () => {
  const f = fixture();
  for (const value of [undefined, null, '', 'owner', ` ${tenantId}`]) {
    await assert.rejects(ladeGeld({ ...f, tenantId: value, jetzt }));
    await assert.rejects(ladeMandantenZeilen({ ...f, tenantId: value, tabelle: 'belegliste', spalten: 'id,owner_id' }));
  }
  for (const value of [null, new Date('invalid'), '2026-10-01']) await assert.rejects(ladeGeld({ ...f, tenantId, jetzt: value }));
  for (const zeitraum of [null, {}, { von: '2026-10-01', bisExklusiv: '2026-11-01' }]) {
    await assert.rejects(ladeMandantenZeilen({ ...f, tenantId, tabelle: 'belegliste', spalten: 'id,owner_id', zeitraum }));
  }
  assert.equal(f.calls.length, 0);
  const r = await ladeGeld({ ...f, tenantId, jetzt });
  assert.deepEqual(r.kassiert.patient, { bekanntCent: 0, gesamtCent: 0, unbekanntAnzahl: 0, gruende: [] });
  assert.equal(r.offen.privat.gesamtCent, null);
});

test('Beträge: exakte Dezimalstrings, kein NaN/Infinity/leer/subcent/unsafe als 0, Typen und Vorzeichen Unknown', async () => {
  const invalid = [null, undefined, '', ' ', false, NaN, Infinity, '1.001', '90071992547409.92', '1e1000', '0x10', {}, []];
  const f = fixture({ belegliste: [beleg(1, { amount_eur: '0.2900' }), ...invalid.map((amount_eur, n) => beleg(n + 2, { amount_eur })),
    beleg(90, { type: 'neu' }), beleg(91, { amount_eur: '-1' }), beleg(92, { type: 'storno', amount_eur: '1' })] });
  const r = await ladeGeld({ ...f, tenantId, jetzt });
  assert.equal(r.kassiert.patient.bekanntCent, 29);
  assert.equal(r.kassiert.patient.gesamtCent, null);
  assert.equal(r.kassiert.patient.unbekanntAnzahl, invalid.length + 3);
  assert.ok(r.kassiert.patient.gruende.includes('PATIENT_TYP_UNBEKANNT'));
  const overflow = fixture({ belegliste: [beleg(1, { amount_eur: '90071992547409.91' }), beleg(2)] });
  await assert.rejects(ladeGeld({ ...overflow, tenantId, jetzt }), RangeError);
});
