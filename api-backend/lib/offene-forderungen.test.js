import { test } from 'node:test';
import assert from 'node:assert/strict';
import { berechneOffeneForderungen, ladeOffeneForderungen } from './offene-forderungen.js';

const tenantId = '11111111-1111-1111-1111-111111111111';
const fremderTenant = '22222222-2222-2222-2222-222222222222';
const rx = (extra = {}) => ({
  id: 'rx', owner_id: tenantId, therapie_bereich: 'physio', rezeptart: 'kassen',
  belegnummer: 'beleg', abrechnung_id: 'original', zuzahlung_eur: 100,
  zuzahlung_befreit: false, zuzahlung_altsystem_eur: null, zuzahlung_kassiert_am: null, ...extra,
});
const beleg = (amount = 40, extra = {}) => ({
  id: 'beleg', owner_id: tenantId, prescription_id: 'rx', type: 'zuzahlung', amount_eur: amount, ...extra,
});
const kopf = (extra = {}) => ({
  id: 'original', owner_id: tenantId, status: 'paid', betriebsart: 'echt',
  verarbeitungskennzeichen: '01', zuzahlungsforderung_ursprung_id: null, ...extra,
});
const zeile = (extra = {}) => ({
  id: 'ursprung', owner_id: tenantId, abrechnung_id: 'original', prescription_id: 'rx',
  belegnummer: 'beleg', herkunft: 'einreichung', status: 'akzeptiert',
  zuzahlung_eur: 100, netto_eur: 900, absetzung_eur: 0, absetzung_am: null, ...extra,
});
const zahlung = (amount = 40, extra = {}) => ({
  id: 'zahlung', owner_id: tenantId, abrechnung_id: 'claim', art: 'zahlung', betrag_eur: amount, ...extra,
});
const grund = (result) => result.posten.map(p => p.grundCode);
function basis(extra = {}) {
  return { prescriptions: [rx()], belege: [], koepfe: [], zeilen: [], zahlungen: [], ...extra };
}
function forderung(status = 'gesendet', extra = {}) {
  return basis({
    koepfe: [kopf(), kopf({ id: 'claim', status, verarbeitungskennzeichen: '03', zuzahlungsforderung_ursprung_id: 'ursprung' })],
    zeilen: [zeile(), zeile({ id: 'claim-zeile', abrechnung_id: 'claim', netto_eur: 100, zuzahlung_eur: 0, status: 'eingereicht' })],
    ...extra,
  });
}
function unbekannt(result, code) {
  assert.equal(result.gesamtCent, null);
  assert.ok(result.unbekanntAnzahl > 0);
  assert.ok(result.posten.some(p => p.restCent === null));
  if (code) assert.ok(grund(result).includes(code), JSON.stringify(result));
}

test('Patient: 100 − 40 = 60; Altsystem 20 wird genau einmal abgezogen', () => {
  assert.equal(berechneOffeneForderungen(basis({ belege: [beleg()] })).patientBekanntCent, 6000);
  const result = berechneOffeneForderungen(basis({ prescriptions: [rx({ zuzahlung_altsystem_eur: '20.00' })], belege: [beleg()] }));
  assert.deepEqual([result.patientBekanntCent, result.kasseBekanntCent, result.klaerungBekanntCent, result.gesamtCent], [4000, 0, 0, 4000]);
  assert.equal(result.unbekanntAnzahl, 0);
});

test('Befreit ist 0; fehlendes/ungültiges Soll bleibt unbekannt, auch mit Kassiervermerk', () => {
  assert.equal(berechneOffeneForderungen(basis({ prescriptions: [rx({ zuzahlung_befreit: true, zuzahlung_eur: null })] })).gesamtCent, 0);
  for (const soll of [null, undefined, '', ' ', 'kaputt', true, [], Infinity, NaN, -1, 1e15]) {
    unbekannt(berechneOffeneForderungen(basis({ prescriptions: [rx({ zuzahlung_eur: soll, zuzahlung_kassiert_am: '2026-01-01' })] })), 'PATIENT_SOLL_UNBEKANNT');
  }
  assert.equal(berechneOffeneForderungen(basis({ prescriptions: [rx({ zuzahlung_eur: 0 })] })).gesamtCent, 0);
});

test('Bekannte Teilsumme bleibt erhalten neben unbekanntem Posten; Eingaben unverändert', () => {
  const input = basis({ prescriptions: [rx(), rx({ id: 'unknown', zuzahlung_eur: null })] });
  const vorher = structuredClone(input);
  const result = berechneOffeneForderungen(input);
  assert.equal(result.patientBekanntCent, 10000);
  assert.equal(result.unbekanntAnzahl, 1);
  assert.equal(result.gesamtCent, null);
  assert.deepEqual(input, vorher);
});

test('Altbestandvermerk ohne Journal bezahlt; vorhandenes Nulljournal widerspricht Vermerk', () => {
  const prescriptions = [rx({ zuzahlung_kassiert_am: '2026-01-01' })];
  assert.equal(berechneOffeneForderungen(basis({ prescriptions })).gesamtCent, 0);
  unbekannt(berechneOffeneForderungen(basis({ prescriptions, belege: [beleg(0)] })), 'PATIENT_NULLJOURNAL_KASSIERVERMERK');
  unbekannt(berechneOffeneForderungen(basis({ prescriptions, belege: [beleg(40), beleg(-40, { id: 'storno', type: 'storno' })] })), 'PATIENT_NULLJOURNAL_KASSIERVERMERK');
});

test('Signed Journal: Storno, Negativsaldo, Überzahlung und ungültige Beträge', () => {
  assert.equal(berechneOffeneForderungen(basis({ belege: [beleg(40), beleg(-10, { id: 's', type: 'storno' })] })).gesamtCent, 7000);
  const negativ = berechneOffeneForderungen(basis({ belege: [beleg(-10, { type: 'storno' })] }));
  unbekannt(negativ, 'PATIENT_NEGATIVSALDO');
  assert.ok(negativ.anomalien.some(a => a.code === 'PATIENT_NEGATIVSALDO'));
  const ueber = berechneOffeneForderungen(basis({ belege: [beleg(110)] }));
  assert.equal(ueber.gesamtCent, 0);
  assert.ok(ueber.anomalien.some(a => a.code === 'PATIENT_UEBERZAHLUNG'));
  for (const b of [beleg(null), beleg('kaputt'), beleg(-1), beleg(1, { type: 'storno' }), beleg(Infinity)]) {
    unbekannt(berechneOffeneForderungen(basis({ belege: [b] })));
  }
  for (const alt of [-1, '', 'kaputt', Infinity, 1e15]) {
    unbekannt(berechneOffeneForderungen(basis({ prescriptions: [rx({ zuzahlung_altsystem_eur: alt })] })));
  }
});

test('Befreiung verdeckt weder Negativsaldo noch Nulljournal-Widerspruch', () => {
  const prescriptions = [rx({ zuzahlung_befreit: true })];
  const result = berechneOffeneForderungen(basis({ prescriptions, belege: [beleg(-10, { type: 'storno' })] }));
  unbekannt(result, 'PATIENT_NEGATIVSALDO');
  assert.ok(result.anomalien.some(a => a.code === 'PATIENT_NEGATIVSALDO'));
  prescriptions[0].zuzahlung_kassiert_am = '2026-01-01';
  unbekannt(berechneOffeneForderungen(basis({ prescriptions, belege: [beleg(0)] })), 'PATIENT_NULLJOURNAL_KASSIERVERMERK');
});

test('Befreiung validiert Journal und Altbetrag auch ohne gespeichertes Soll', () => {
  const prescriptions = [rx({ zuzahlung_befreit: true, zuzahlung_eur: null })];
  for (const amount of ['NaN', null, Infinity, 'kaputt']) {
    unbekannt(berechneOffeneForderungen(basis({ prescriptions, belege: [beleg(amount)] })), 'PATIENT_JOURNAL_UNGUELTIG');
  }
  for (const alt of ['NaN', -1, Infinity, 'kaputt']) {
    unbekannt(berechneOffeneForderungen(basis({ prescriptions: [rx({ zuzahlung_befreit: true, zuzahlung_eur: null, zuzahlung_altsystem_eur: alt })] })), 'PATIENT_ALTSYSTEM_UNGUELTIG');
  }
});

test('Befreiung: bereits erhaltenes Geld ergibt Nullrest mit Überzahlungsanomalie', () => {
  for (const input of [
    basis({ prescriptions: [rx({ zuzahlung_befreit: true })], belege: [beleg(20)] }),
    basis({ prescriptions: [rx({ zuzahlung_befreit: true, zuzahlung_eur: null, zuzahlung_altsystem_eur: 20 })] }),
  ]) {
    const result = berechneOffeneForderungen(input);
    assert.equal(result.gesamtCent, 0);
    assert.equal(result.unbekanntAnzahl, 0);
    assert.ok(result.anomalien.some(a => a.refId === 'rx' && a.code === 'PATIENT_UEBERZAHLUNG'));
  }
  const leer = berechneOffeneForderungen(basis({ prescriptions: [rx({ zuzahlung_befreit: true, zuzahlung_eur: null })] }));
  assert.equal(leer.gesamtCent, 0);
  assert.deepEqual(leer.anomalien, []);
});

test('Halbcenttoleranz greift vor Rundung: 0.0049 / 0.005 / 0.0051', () => {
  for (const [amount, expected] of [[99.9951, 0], [99.995, 0], [99.9949, 1]]) {
    assert.equal(berechneOffeneForderungen(basis({ belege: [beleg(amount)] })).gesamtCent, expected);
  }
  assert.equal(berechneOffeneForderungen(basis({ prescriptions: [rx({ zuzahlung_eur: 0.015 })], belege: [beleg(0.01)] })).gesamtCent, 0);
});

test('Dezimalstrings bleiben exakt bis zur sicheren Centgrenze; Summenüberlauf wirft', () => {
  assert.equal(berechneOffeneForderungen(basis({ prescriptions: [rx({ zuzahlung_eur: '90071992547409.91' })] })).gesamtCent, Number.MAX_SAFE_INTEGER);
  unbekannt(berechneOffeneForderungen(basis({ prescriptions: [rx({ zuzahlung_eur: '90071992547409.92' })] })));
  assert.throws(() => berechneOffeneForderungen(basis({ prescriptions: [rx({ zuzahlung_eur: '90071992547409.91' }), rx({ id: 'plus', zuzahlung_eur: 0.01 })] })), RangeError);
  assert.equal(berechneOffeneForderungen(basis({ prescriptions: [rx({ zuzahlung_eur: '1.5e-2' })], belege: [beleg('.01')] })).gesamtCent, 0);
});

test('Nur GKV kassen/NULL; übrige Belegtypen und gewöhnliches Kassen-paid tilgen keine Patientenzuzahlung', () => {
  const input = basis({
    prescriptions: [rx({ rezeptart: null }), rx({ id: 'privat', rezeptart: 'privat' }), rx({ id: 'bg', rezeptart: 'bg' })],
    belege: [beleg(100, { type: 'privat' })], koepfe: [kopf()], zeilen: [zeile()],
    zahlungen: [zahlung(900, { abrechnung_id: 'original' })],
  });
  const result = berechneOffeneForderungen(input);
  assert.equal(result.gesamtCent, 10000);
  assert.equal(result.posten.length, 1);
});

test('Podo braucht zugeordneten, echten und übereinstimmenden Snapshot; volles Soll − Alt − Journal', () => {
  const input = basis({ prescriptions: [rx({ therapie_bereich: 'podo', zuzahlung_altsystem_eur: 20 })], koepfe: [kopf()], zeilen: [zeile()], belege: [beleg()] });
  assert.equal(berechneOffeneForderungen(input).gesamtCent, 4000);
  for (const patch of [
    { zeilen: [] },
    { zeilen: [zeile({ herkunft: 'rekonstruiert' })] },
    { zeilen: [zeile({ herkunft: null })] },
    { zeilen: [zeile({ zuzahlung_eur: 80 })] },
    { zeilen: [zeile({ belegnummer: 'anders' })] },
    { zeilen: [zeile({ abrechnung_id: 'anders' })] },
    { zeilen: [zeile(), zeile({ id: 'zweite', zuzahlung_eur: 80 })] },
    { koepfe: [] },
    { koepfe: [kopf({ betriebsart: 'test' })] },
    { koepfe: [kopf({ betriebsart: null })] },
  ]) unbekannt(berechneOffeneForderungen({ ...input, ...patch }));
  assert.equal(berechneOffeneForderungen({ ...input, prescriptions: [rx({ therapie_bereich: 'podo', zuzahlung_befreit: true })], zeilen: [] }).gesamtCent, 0);
});

for (const status of ['erstellt', 'heruntergeladen', 'gesendet', 'accepted', 'paid', 'rejected', 'verworfen']) {
  test(`VKZ03 Status ${status}: Forderung einmal und richtige Schuldnerachse`, () => {
    const result = berechneOffeneForderungen(forderung(status));
    if (status === 'rejected') {
      unbekannt(result, 'VKZ03_ABLEHNUNG_UNGEKLAERT');
      assert.equal(result.patientBekanntCent, 0);
      assert.equal(result.posten[0].quelle, 'klaerung');
    } else {
      const patient = ['erstellt', 'heruntergeladen', 'verworfen'].includes(status);
      assert.equal(result.patientBekanntCent, patient ? 10000 : 0);
      assert.equal(result.kasseBekanntCent, patient ? 0 : 10000);
      assert.equal(result.gesamtCent, 10000);
      assert.equal(result.posten.length, 1);
    }
  });
}

test('VKZ03 Teilzahlung, Abschreibung, signed Korrektur/Rücklastschrift statt Cashsumme', () => {
  const input = forderung('paid', { zahlungen: [zahlung(40), zahlung(20, { id: 'a', art: 'abschreibung' }), zahlung(-10, { id: 'k', art: 'korrektur' }), zahlung(-5, { id: 'r', art: 'ruecklastschrift' })] });
  assert.equal(berechneOffeneForderungen(input).kasseBekanntCent, 5500);
  assert.equal(berechneOffeneForderungen(forderung('paid')).kasseBekanntCent, 10000);
  assert.equal(berechneOffeneForderungen(forderung('paid', { zahlungen: [zahlung(100, { art: 'abschreibung' })] })).gesamtCent, 0);
});

test('VKZ03 dokumentierte Teilabsetzung rechenbar, Absetzungsstatus ohne Betrag unbekannt', () => {
  const input = forderung('accepted');
  input.zeilen[1] = { ...input.zeilen[1], status: 'teilabgesetzt', absetzung_eur: 20, absetzung_am: '2026-01-01' };
  input.zahlungen = [zahlung(30)];
  assert.equal(berechneOffeneForderungen(input).kasseBekanntCent, 5000);
  input.koepfe[1].status = 'rejected';
  assert.equal(berechneOffeneForderungen(input).klaerungBekanntCent, 5000);
  for (const patch of [{ absetzung_eur: 0 }, { absetzung_eur: null }, { absetzung_am: null }, { absetzung_eur: 120 }, { absetzung_eur: 'kaputt' }]) {
    unbekannt(berechneOffeneForderungen({ ...input, zeilen: [input.zeilen[0], { ...input.zeilen[1], ...patch }] }));
  }
});

test('Übertragen plus positiver Patientensaldo: unbekannt, Patient bleibt gesperrt', () => {
  for (const status of ['gesendet', 'accepted', 'paid', 'rejected']) {
    const result = berechneOffeneForderungen(forderung(status, { belege: [beleg(40)] }));
    unbekannt(result, 'VKZ03_PATIENTENZAHLUNG_KONFLIKT');
    assert.equal(result.patientBekanntCent, 0);
    assert.equal(result.kasseBekanntCent, 0);
    assert.equal(result.posten.length, 1);
    assert.ok(result.anomalien.some(a => a.code === 'VKZ03_PATIENTENZAHLUNG_KONFLIKT'));
  }
  const input = forderung('accepted', { prescriptions: [rx({ zuzahlung_befreit: true })], belege: [beleg(40)] });
  unbekannt(berechneOffeneForderungen(input), 'VKZ03_PATIENTENZAHLUNG_KONFLIKT');
  input.belege[0].amount_eur = 'kaputt';
  unbekannt(berechneOffeneForderungen(input), 'VKZ03_PATIENTENSALDO_UNKLAR');
});

test('VKZ03 Rest nutzt Halbcenttoleranz vor Rundung und meldet Überzahlung', () => {
  for (const [amount, expected] of [[99.9951, 0], [99.995, 0], [99.9949, 1], [110, 0]]) {
    const result = berechneOffeneForderungen(forderung('accepted', { zahlungen: [zahlung(amount)] }));
    assert.equal(result.gesamtCent, expected);
    if (amount === 110) assert.ok(result.anomalien.some(a => a.code === 'VKZ03_UEBERZAHLUNG'));
  }
});

test('VKZ03 Orphans bleiben separat unbekannt; keine Ersatzzuordnung anhand Belegnummer', () => {
  const input = forderung();
  input.koepfe[1].zuzahlungsforderung_ursprung_id = 'nicht-vorhanden';
  const result = berechneOffeneForderungen(input);
  unbekannt(result, 'VKZ03_URSPRUNG_FEHLT');
  assert.equal(result.patientBekanntCent, 10000);
  assert.equal(result.posten.length, 2);
  input.koepfe[1].zuzahlungsforderung_ursprung_id = 'ursprung';
  input.zeilen[0].prescription_id = null;
  unbekannt(berechneOffeneForderungen(input), 'VKZ03_REZEPT_FEHLT');
});

test('VKZ03 Dubletten und widersprüchliche Snapshots blockieren nur betroffenen Posten', () => {
  const input = forderung();
  input.koepfe.push({ ...input.koepfe[1], id: 'doppelt' });
  input.prescriptions.push(rx({ id: 'unbeteiligt', zuzahlung_eur: 20 }));
  const result = berechneOffeneForderungen(input);
  unbekannt(result, 'VKZ03_MEHRDEUTIG');
  assert.equal(result.patientBekanntCent, 2000);
  assert.equal(result.unbekanntAnzahl, 1);
  for (const patch of [
    { prescription_id: 'falsches-rezept' }, { belegnummer: 'falsch' },
    { herkunft: 'rekonstruiert' }, { zuzahlung_eur: 100 }, { netto_eur: null },
  ]) {
    const data = forderung();
    data.zeilen[1] = { ...data.zeilen[1], ...patch };
    const r = berechneOffeneForderungen(data);
    unbekannt(r);
    assert.equal(r.patientBekanntCent, 0);
  }
  const missing = forderung();
  missing.zeilen.pop();
  unbekannt(berechneOffeneForderungen(missing));
});

test('Test-VKZ03 überträgt nichts; unbekannte Betriebsart erzeugt Klärung', () => {
  const input = forderung();
  input.koepfe[1].betriebsart = 'test';
  assert.equal(berechneOffeneForderungen(input).patientBekanntCent, 10000);
  input.koepfe[1].betriebsart = null;
  unbekannt(berechneOffeneForderungen(input));
});

test('Unbekannte Ledgerwerte und doppelte Journal-IDs werden nicht als null Euro verbucht', () => {
  for (const z of [zahlung(null), zahlung('kaputt'), zahlung(1, { art: 'falsch' })]) {
    unbekannt(berechneOffeneForderungen(forderung('accepted', { zahlungen: [z] })));
  }
  unbekannt(berechneOffeneForderungen(basis({ belege: [beleg(), beleg()] })));
  unbekannt(berechneOffeneForderungen(forderung('accepted', { zahlungen: [zahlung(), zahlung()] })));
});

const projections = {
  prescriptions: 'id,owner_id,therapie_bereich,rezeptart,belegnummer,abrechnung_id,zuzahlung_eur,zuzahlung_befreit,zuzahlung_altsystem_eur,zuzahlung_kassiert_am',
  belegliste: 'id,owner_id,prescription_id,type,amount_eur',
  abrechnung: 'id,owner_id,status,betriebsart,verarbeitungskennzeichen,zuzahlungsforderung_ursprung_id',
  abrechnung_zeile: 'id,owner_id,abrechnung_id,prescription_id,belegnummer,herkunft,status,zuzahlung_eur,netto_eur,absetzung_eur,absetzung_am',
  abrechnung_zahlung: 'id,owner_id,abrechnung_id,art,betrag_eur',
};

// Ausschließlich synthetisch: unterstützt nur erlaubte Leseoperationen und
// bildet auch einen serverseitigen Page-Cap kleiner als .limit() ab.
function double(tables = {}, { cap = 1000, fail, leak = false, badData = false } = {}) {
  const queries = [];
  return {
    queries,
    from(table) {
      assert.ok(Object.hasOwn(projections, table), `Unerlaubte Tabelle: ${table}`);
      const q = { table, filters: [], order: null, limit: null };
      queries.push(q);
      const builder = {
        select(columns) { assert.equal(columns.replaceAll(' ', ''), projections[table]); return builder; },
        eq(column, value) { assert.equal(column, 'owner_id'); assert.equal(value, tenantId); q.filters.push(['eq', column, value]); return builder; },
        in(column, ids) { assert.ok(ids.length > 0 && ids.length <= 200); q.filters.push(['in', column, [...ids]]); return builder; },
        order(column, options) { assert.equal(column, 'id'); assert.equal(options?.ascending, true); q.order = column; return builder; },
        gt(column, value) { assert.equal(column, 'id'); assert.equal(typeof value, 'string'); q.filters.push(['gt', column, value]); return builder; },
        limit(n) { assert.ok(n > 0 && n <= 1000); q.limit = n; return builder; },
        then(resolve, reject) {
          try {
            assert.ok(q.filters.some(([op, col]) => op === 'eq' && col === 'owner_id'));
            assert.equal(q.order, 'id');
            assert.ok(q.limit);
            if (fail?.(q)) return Promise.resolve({ data: null, error: new Error('synthetischer Folgeseitenfehler') }).then(resolve, reject);
            if (badData) return Promise.resolve({ data: null, error: null }).then(resolve, reject);
            let rows = [...(tables[table] || [])];
            for (const [op, col, value] of q.filters) {
              if (leak && col === 'owner_id') continue;
              rows = rows.filter(row => op === 'eq' ? row[col] === value : op === 'in' ? value.includes(row[col]) : row[col] > value);
            }
            rows.sort((a, b) => a.id.localeCompare(b.id));
            return Promise.resolve({ data: rows.slice(0, Math.min(cap, q.limit)), error: null }).then(resolve, reject);
          } catch (error) { return Promise.reject(error).then(resolve, reject); }
        },
      };
      return builder;
    },
  };
}
const id = (prefix, n) => `${prefix}-${String(n).padStart(5, '0')}`;

test('Loader: >1000 Rezepte/Köpfe, >200 IDs, jede Chunk-Seite, exakt volle Seite plus leerer Folgelauf', async () => {
  const prescriptions = Array.from({ length: 1200 }, (_, i) => rx({ id: id('rx', i), zuzahlung_eur: 1 }));
  const koepfe = Array.from({ length: 1200 }, (_, i) => kopf({ id: id('kopf', i) }));
  const tables = {
    prescriptions, abrechnung: koepfe,
    belegliste: prescriptions.map((r, i) => beleg(0.25, { id: id('b', i), prescription_id: r.id })),
    abrechnung_zeile: koepfe.map((k, i) => zeile({ id: id('z', i), abrechnung_id: k.id, prescription_id: prescriptions[i].id })),
    abrechnung_zahlung: koepfe.map((k, i) => zahlung(0.5, { id: id('p', i), abrechnung_id: k.id })),
  };
  for (const table of Object.keys(tables)) tables[table].push({ ...tables[table][0], id: 'fremd', owner_id: fremderTenant });
  const supabase = double(tables, { cap: 100 });
  const result = await ladeOffeneForderungen({ supabase, tenantId });
  assert.equal(result.gesamtCent, 90000);
  assert.equal(result.posten.length, 1200);
  for (const table of ['belegliste', 'abrechnung_zeile', 'abrechnung_zahlung']) {
    const queries = supabase.queries.filter(q => q.table === table);
    const chunks = new Set(queries.map(q => JSON.stringify(q.filters.find(f => f[0] === 'in')[2])));
    assert.equal(chunks.size, 6);
    for (const chunk of chunks) {
      const pages = queries.filter(q => JSON.stringify(q.filters.find(f => f[0] === 'in')[2]) === chunk);
      assert.equal(pages.length, 3); // 100 + 100 + leere Seite
      assert.equal(pages.filter(q => q.filters.some(f => f[0] === 'gt')).length, 2);
    }
  }
  assert.equal(supabase.queries.filter(q => q.table === 'prescriptions').length, 13);
  assert.equal(supabase.queries.filter(q => q.table === 'abrechnung').length, 13);
});

test('Loader: tatsächliche 1000er-Grenze wird überschritten und exakt volle Seite hat Folgelauf', async () => {
  for (const n of [1000, 1001]) {
    const supabase = double({ prescriptions: Array.from({ length: n }, (_, i) => rx({ id: id('r', i), zuzahlung_eur: 1 })) });
    assert.equal((await ladeOffeneForderungen({ supabase, tenantId })).gesamtCent, n * 100);
    assert.equal(supabase.queries.filter(q => q.table === 'prescriptions').length, n === 1000 ? 2 : 3);
  }
});

test('Loader: ein abhängiger Chunk mit >1000 Zeilen wird vollständig geladen', async () => {
  const input = forderung('accepted');
  const supabase = double({
    prescriptions: input.prescriptions, abrechnung: input.koepfe, abrechnung_zeile: input.zeilen,
    abrechnung_zahlung: Array.from({ length: 1001 }, (_, i) => zahlung(0.01, { id: id('zahlung', i) })),
  });
  assert.equal((await ladeOffeneForderungen({ supabase, tenantId })).kasseBekanntCent, 8999);
  assert.equal(supabase.queries.filter(q => q.table === 'abrechnung_zahlung').length, 3);
});

test('Loader: jeder Folgeseitenfehler verwirft Gesamtergebnis', async () => {
  for (const table of Object.keys(projections)) {
    const tables = {
      prescriptions: [rx(), rx({ id: 'rx-z' })], abrechnung: [kopf(), kopf({ id: 'original-z' })],
      belegliste: [beleg(), beleg(10, { id: 'beleg-z' })],
      abrechnung_zeile: [zeile(), zeile({ id: 'ursprung-z' })],
      abrechnung_zahlung: [zahlung(10, { abrechnung_id: 'original' }), zahlung(20, { id: 'zahlung-z', abrechnung_id: 'original' })],
    };
    const supabase = double(tables, { cap: 1, fail: q => q.table === table && q.filters.some(f => f[0] === 'gt') });
    await assert.rejects(ladeOffeneForderungen({ supabase, tenantId }), /laden|Laden/);
  }
});

test('Loader: ungültiger Tenant vor erster Abfrage; fremde Rows und kaputte Antwort kein Erfolg', async () => {
  for (const bad of [null, undefined, '', ' ', 'keine-uuid', 42, {}, `${tenantId} `]) {
    const supabase = double();
    await assert.rejects(ladeOffeneForderungen({ supabase, tenantId: bad }), /tenantId/);
    assert.equal(supabase.queries.length, 0);
  }
  const supabase = double({ prescriptions: [rx({ owner_id: fremderTenant })] }, { leak: true });
  await assert.rejects(ladeOffeneForderungen({ supabase, tenantId }), /Mandant/);
  await assert.rejects(ladeOffeneForderungen({ supabase: double({}, { badData: true }), tenantId }), /laden/);
  assert.deepEqual(await ladeOffeneForderungen({ supabase: double(), tenantId }), {
    patientBekanntCent: 0, kasseBekanntCent: 0, klaerungBekanntCent: 0,
    gesamtCent: 0, unbekanntAnzahl: 0, posten: [], anomalien: [],
  });
});

test('Loader: Ownerprüfung auch auf allen abhängigen Tabellen und Köpfen', async () => {
  for (const table of ['belegliste', 'abrechnung', 'abrechnung_zeile', 'abrechnung_zahlung']) {
    const tables = {
      prescriptions: [rx()], abrechnung: [kopf()], belegliste: [beleg()],
      abrechnung_zeile: [zeile()], abrechnung_zahlung: [zahlung(40, { abrechnung_id: 'original' })],
    };
    tables[table][0].owner_id = fremderTenant;
    await assert.rejects(ladeOffeneForderungen({ supabase: double(tables, { leak: true }), tenantId }), /Mandant/);
  }
});

test('Loader: Fehler im zweiten ID-Chunk liefert keinen ersten Teilwert', async () => {
  const prescriptions = Array.from({ length: 201 }, (_, i) => rx({ id: id('rx', i) }));
  const supabase = double({ prescriptions }, { fail: q => q.table === 'belegliste' && q.filters.some(([op, , ids]) => op === 'in' && ids.includes(id('rx', 200))) });
  await assert.rejects(ladeOffeneForderungen({ supabase, tenantId }), /laden/);
});

test('Loader: gezielt fehlende Ursprungs-ID mit Ownerfilter laden; keine Ersatzzuordnung', async () => {
  const input = forderung();
  const supabase = double({
    prescriptions: input.prescriptions,
    abrechnung: [input.koepfe[1]], // Kopf des Ursprungs fehlt, Zeile ist separat erreichbar.
    abrechnung_zeile: input.zeilen,
  });
  unbekannt(await ladeOffeneForderungen({ supabase, tenantId }));
  assert.ok(supabase.queries.some(q => q.table === 'abrechnung_zeile' && q.filters.some(([op, col, ids]) => op === 'in' && col === 'id' && ids.includes('ursprung'))));
});
